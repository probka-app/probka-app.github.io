// tts — один файл для вставки в редактор Supabase (Edge Functions -> Via Editor)
// Озвучка тексту прямо на сайті.
// POST { text, voice: { kind: "preset", id } | { kind: "clone" }, tone?: "calm" | "neutral" | "energetic" }  (Authorization: Bearer <токен користувача>)
// -> { audio: base64, mime, alignment?: { chars, starts, ends }, provider, fallback, seconds, left }
// Секрети: ELEVENLABS_API_KEY (для найкращих голосів і клону), GEMINI_API_KEY (запасний голос).
// Необов'язково: ELEVENLABS_MODEL (за замовчуванням eleven_multilingual_v2), GEMINI_TTS_MODEL.
// Ліміт: готові голоси — безкоштовно до tts_free_daily_sec с на добу; свій голос (клон) — з «Озвучки голосом людини» (продукт або доповнення),
// а якщо її нема — зі старих лімітів озвучки (пробні, Студія, пакет). Якщо озвучка не вдалась — секунди повертаються.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";

// ---- спільне: змінні, клієнти, відповіді ----

const env = (k: string, fallback = ""): string => Deno.env.get(k) ?? fallback;

// mock — тестові оплати без банку; mono — справжні оплати через plata by mono
const PAY_MODE = env("PAY_MODE", "mock") as "mock" | "mono";
const SITE_URL = env("SITE_URL", "http://localhost:5173");
const FUNCTIONS_URL = env("FUNCTIONS_URL", `${env("SUPABASE_URL")}/functions/v1`);

const cors = {
  "Access-Control-Allow-Origin": env("ALLOWED_ORIGIN", "*"),
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Клієнт з правами сервера (обходить RLS). Тільки всередині функцій.
const admin = (): SupabaseClient =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

// Клієнт від імені користувача (його токен з заголовка Authorization).
const asUser = (req: Request): SupabaseClient =>
  createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });

async function requireUser(req: Request): Promise<{ id: string; client: SupabaseClient }> {
  const client = asUser(req);
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "not_authenticated");
  await paidRpc("paid_check"); // відмова до списання квот, якщо платний шлях вимкнено
  return { id: data.user.id, client };
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// ---- ШЛЮЗ ПЛАТНИХ ОПЕРАЦІЙ (Phase 02, 2026-11-26) ----
// Усі платні звернення вимкнені за замовчуванням для ВСІХ, включно з власником. Увімкнення — лише в public.settings:
// paid_<PAID_SVC>_enabled = 1 і paid_<PAID_SVC>_daily_max = N (спільний добовий ліміт, UTC). Атомарність — у SQL paid_reserve().
// Перехоплюється КОЖЕН вихідний запит: окрім бази Supabase і явно безкоштовних адрес, будь-який хост вимагає резерву
// (новий провайдер не обійде шлюз). Кожна спроба/повтор/запасний провайдер резервує окрему одиницю. Помилка шлюзу → відмова.
const PAID_SVC = "tts";
const FREE_HOSTS = new Set<string>([]);
const _rawFetch: typeof fetch = globalThis.fetch.bind(globalThis);
const supaHost = (): string => { try { return new URL(env("SUPABASE_URL")).hostname; } catch { return ""; } };
function isPaidRequest(u: URL): boolean {
  if (u.hostname === supaHost() || FREE_HOSTS.has(u.hostname)) return false;
  // Gemini Files API (завантаження файлу й опитування стану) не тарифікується; тарифікуються generate*/predict/embed.
  if (u.hostname === "generativelanguage.googleapis.com" && (u.pathname.startsWith("/upload/") || /^\/v1(beta)?\/files(\/|$)/.test(u.pathname))) return false;
  return true;
}
async function paidRpc(fn: "paid_reserve" | "paid_check"): Promise<void> {
  const base = env("SUPABASE_URL"), key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!base || !key) throw new HttpError(503, "policy_unavailable");
  let v: unknown = null;
  try {
    const r = await _rawFetch(`${base}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_svc: PAID_SVC }) });
    if (!r.ok) throw new Error(String(r.status));
    v = await r.json();
  } catch { throw new HttpError(503, "policy_unavailable"); }
  if (v === "ok") return;
  if (v === "paid_budget_exhausted") throw new HttpError(429, v);
  if (v === "paid_disabled" || v === "paid_budget_missing") throw new HttpError(403, v);
  throw new HttpError(503, "policy_unavailable");
}
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  let u: URL;
  try { u = new URL(input instanceof Request ? input.url : String(input)); } catch { throw new HttpError(503, "policy_unavailable"); }
  if (isPaidRequest(u)) await paidRpc("paid_reserve");
  return _rawFetch(input as Request, init);
}) as typeof fetch;

function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
    try {
      return await fn(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status);
      console.error(e);
      return json({ error: "server_error" }, 500);
    }
  };
}

// ---- сама функція ----
const SEC_PER_CHAR = 1 / 14; // українська мова: ~14 символів за секунду

function wavFromPcm(b64: string, rate = 24000): string {
  const pcm = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const h = new ArrayBuffer(44), v = new DataView(h);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length); out.set(new Uint8Array(h), 0); out.set(pcm, 44);
  let s = ""; for (let i = 0; i < out.length; i += 0x8000) s += String.fromCharCode(...out.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const { id: userId } = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").replace(/\s+\n/g, "\n").trim().slice(0, 5000);
  if (text.length < 2) throw new HttpError(400, "empty_text");
  const tone = ["calm", "neutral", "energetic"].includes(body.tone) ? body.tone as string : "neutral";
  const db = admin();

  // який голос
  let provider = "gemini", voiceId = "Kore", isClone = false;
  if (body.voice?.kind === "clone") {
    const { data: p } = await db.from("profiles").select("clone_voice_id").eq("id", userId).maybeSingle();
    if (!p?.clone_voice_id) throw new HttpError(400, "no_clone");
    provider = "elevenlabs"; voiceId = p.clone_voice_id; isClone = true;
  } else if (body.voice?.id) {
    const { data: v } = await db.from("tts_voices").select("provider,voice_id,enabled").eq("id", String(body.voice.id)).maybeSingle();
    if (!v || !v.enabled) throw new HttpError(400, "bad_voice");
    provider = v.provider; voiceId = v.voice_id;
  }

  const est = Math.max(1, Math.ceil(text.length * SEC_PER_CHAR));
  const { data: take, error: qe } = await db.rpc("voice_take", { p_user: userId, p_clone: isClone, p_secs: est });
  if (qe) throw new Error(qe.message);
  if (!take) throw new HttpError(402, isClone ? "no_clone_quota" : "free_limit");

  const elKey = env("ELEVENLABS_API_KEY"), gKey = env("GEMINI_API_KEY");
  const eleven = async () => {
    const st = tone === "calm" ? { stability: 0.7, similarity_boost: 0.8, style: 0.05 } : tone === "energetic" ? { stability: 0.32, similarity_boost: 0.8, style: 0.45 } : { stability: 0.5, similarity_boost: 0.8, style: 0.2 };
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": elKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: env("ELEVENLABS_MODEL", "eleven_multilingual_v2"), voice_settings: { ...st, use_speaker_boost: true } }),
    });
    if (!r.ok) {
      const t = (await r.text()).slice(0, 300);
      await db.rpc("svc_log", { p_service: "elevenlabs_tts", p_units: 0, p_ok: false, p_err: `${r.status} ${t}` });
      throw new Error(`el_${r.status}`);
    }
    const j = await r.json();
    await db.rpc("svc_log", { p_service: "elevenlabs_tts", p_units: text.length, p_ok: true });
    const a = j.alignment ?? j.normalized_alignment;
    return { audio: j.audio_base64 as string, mime: "audio/mpeg",
      alignment: a ? { chars: a.characters, starts: a.character_start_times_seconds, ends: a.character_end_times_seconds } : null };
  };
  const gemini = async (name: string) => {
    if (!gKey) throw new HttpError(503, "no_key");
    const style = tone === "calm" ? "спокійно і тепло" : tone === "energetic" ? "енергійно, бадьоро, з запалом" : "природно, впевнено, як у розмові";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${env("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": gKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Прочитай українською, ${style}. Читай лише текст, нічого не додавай:\n${text}` }] }],
        generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: name } } } },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      await db.rpc("svc_log", { p_service: "gemini_tts", p_units: 0, p_ok: false, p_err: `${r.status} ${JSON.stringify(j).slice(0, 250)}` });
      throw new HttpError(r.status === 429 ? 503 : 502, r.status === 429 ? "busy" : "tts_failed");
    }
    const part = (j.candidates ?? [])[0]?.content?.parts?.find((p: { inlineData?: unknown; inline_data?: unknown }) => p.inlineData ?? p.inline_data);
    const d = part?.inlineData ?? part?.inline_data;
    if (!d?.data) throw new HttpError(502, "tts_failed");
    const rate = Number(/rate=(\d+)/.exec(d.mimeType ?? d.mime_type ?? "")?.[1] ?? 24000);
    const secs = (atob(d.data).length / 2) / rate;
    await db.rpc("svc_log", { p_service: "gemini_tts", p_units: Math.ceil(secs), p_ok: true });
    return { audio: wavFromPcm(d.data, rate), mime: "audio/wav", alignment: null };
  };

  try {
    let out, fallback = false, used = provider;
    if (provider === "elevenlabs") {
      if (!elKey) {
        if (isClone) throw new HttpError(503, "no_key");
        out = await gemini("Kore"); fallback = true; used = "gemini";
      } else {
        try { out = await eleven(); }
        catch (e) {
          if (isClone) throw new HttpError(503, "busy"); // свій голос не підміняємо чужим
          out = await gemini("Kore"); fallback = true; used = "gemini";
        }
      }
    } else {
      out = await gemini(voiceId);
    }
    if (isClone) await db.from("profiles").update({ clone_used_at: new Date().toISOString() }).eq("id", userId);
    const { data: left } = await db.rpc("voice_left", { p_user: userId, p_clone: isClone });
    return json({ ...out, provider: used, fallback, seconds: est, left: left ?? null, clone: isClone });
  } catch (e) {
    await db.rpc("voice_refund", { p_take: take });
    throw e;
  }
}));
