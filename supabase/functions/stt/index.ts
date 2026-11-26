// stt — один файл для вставки в редактор Supabase (Edge Functions -> Via Editor)
// Розпізнавання мови з часом кожного слова — для «Розкажи своїми словами» (монтаж живого голосу).
// POST { audio: base64 (wav/mp3/m4a/webm), mime }  (Authorization: Bearer <токен користувача>)
// -> { words: [{ w, s, e }], text, provider }
// Дешевий і точний шлях: CF_ACCOUNT_ID + CF_AI_TOKEN (Cloudflare Workers AI, Whisper large v3 turbo) — ~$0.0005 за хвилину.
// Запасний: GEMINI_API_KEY (час по фразах, всередині фрази розподіляємо за довжиною слів). GEMINI_STT_MODEL — необов'язково.
// Ліміт на людину на день — той самий, що для текстів (ai_take).

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
const PAID_SVC = "stt";
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
type W = { w: string; s: number; e: number };
const MAX_B64 = 14_000_000; // ≈ 4 хв мовлення у 16 кГц моно WAV

// фраза з часом → слова з часом (пропорційно до кількості літер)
function spread(text: string, s: number, e: number): W[] {
  const parts = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length || !(e > s)) return [];
  const L = parts.map((p) => p.replace(/[^\p{L}\p{N}]/gu, "").length + 1), tot = L.reduce((a, b) => a + b, 0);
  let t = s; return parts.map((w, i) => { const d = (e - s) * L[i] / tot; const o = { w, s: +t.toFixed(3), e: +(t + d).toFixed(3) }; t += d; return o; });
}

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const { id: userId } = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const audio = String(body.audio ?? ""), mime = String(body.mime ?? "audio/wav").slice(0, 60);
  if (audio.length < 1000) throw new HttpError(400, "empty_audio");
  if (audio.length > MAX_B64) throw new HttpError(413, "too_long");
  const cfAcc = env("CF_ACCOUNT_ID"), cfTok = env("CF_AI_TOKEN"), gKey = env("GEMINI_API_KEY");
  if (!(cfAcc && cfTok) && !gKey) throw new HttpError(503, "no_key");
  const db = admin();
  const { data: ok, error } = await db.rpc("ai_take", { p_user: userId });
  if (error) throw new Error(error.message);
  if (!ok) throw new HttpError(429, "limit");

  let words: W[] = [], provider = "";
  if (cfAcc && cfTok) {
    try {
      const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAcc}/ai/run/@cf/openai/whisper-large-v3-turbo`, {
        method: "POST", headers: { Authorization: `Bearer ${cfTok}`, "Content-Type": "application/json" },
        body: JSON.stringify({ audio, language: "uk", initial_prompt: "Ну, коротше, е-е, типу, от. Розмовна українська мова." }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.result) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 200)}`);
      for (const sg of j.result.segments ?? []) {
        const ws = (sg.words ?? []).map((x: { word: string; start: number; end: number }) => ({ w: String(x.word).trim(), s: +x.start, e: +x.end })).filter((x: W) => x.w);
        words.push(...(ws.length ? ws : spread(sg.text, +sg.start, +sg.end)));
      }
      provider = "cf_whisper";
      await db.rpc("svc_log", { p_service: "cf_stt", p_units: 1, p_ok: true }).then(() => {}, () => {});
    } catch (e) {
      console.error("cf_stt", String(e));
      await db.rpc("svc_log", { p_service: "cf_stt", p_units: 0, p_ok: false, p_err: String(e).slice(0, 200) }).then(() => {}, () => {});
      words = [];
    }
  }
  if (!words.length && gKey) {
    const model = env("GEMINI_STT_MODEL", "gemini-2.5-flash");
    const prompt = "Транскрибуй цей запис ДОСЛІВНО українською (або мовою оригіналу), зберігаючи все: слова-паразити (ну, типу, коротше, е-е), повтори, обірвані слова. " +
      "Розбий на короткі фрази по 2–6 слів, межі фраз — на паузах. Для кожної фрази вкажи точний час початку і кінця в секундах від початку запису. " +
      'Відповідай тільки JSON-масивом: [{"t":"текст фрази","s":0.00,"e":1.23}]';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gKey}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mime, data: audio } }, { text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0 } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      await db.rpc("svc_log", { p_service: "gemini_stt", p_units: 0, p_ok: false, p_err: `${r.status} ${JSON.stringify(j).slice(0, 200)}` }).then(() => {}, () => {});
      throw new HttpError(502, "stt_failed");
    }
    const t = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    let arr: { t: string; s: number; e: number }[] = [];
    try { arr = JSON.parse(t.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch (_) { arr = []; }
    for (const p of Array.isArray(arr) ? arr : []) words.push(...spread(p.t, +p.s, +p.e));
    provider = "gemini";
    await db.rpc("svc_log", { p_service: "gemini_stt", p_units: 1, p_ok: !!words.length }).then(() => {}, () => {});
  }
  if (!words.length) throw new HttpError(422, "no_speech");
  words.sort((a, b) => a.s - b.s);
  return json({ words, text: words.map((x) => x.w).join(" "), provider });
}));
