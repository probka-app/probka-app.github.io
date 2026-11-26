// voice-clone — один файл для вставки в редактор Supabase (Edge Functions -> Via Editor)
// Клон голосу людини: лише її власний голос і лише зі згодою.
// POST { audio: base64, mime, consent: true }  — створити (старий клон видаляється)
// POST { delete: true }                         — видалити свій клон
// (Authorization: Bearer <токен користувача>)
// Секрет: ELEVENLABS_API_KEY.
// Безпека (2026-11-26): створення клону — лише власник і лише за paid_voice_clone_enabled=1 та paid_voice_clone_daily_max>0.

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
const PAID_SVC = "voice_clone";
const FREE_HOSTS = new Set<string>([]);
const _rawFetch: typeof fetch = globalThis.fetch.bind(globalThis);
const supaHost = (): string => { try { return new URL(env("SUPABASE_URL")).hostname; } catch { return ""; } };
function isPaidRequest(u: URL, method = "GET"): boolean {
  if (u.hostname === supaHost() || FREE_HOSTS.has(u.hostname)) return false;
  // Видалення власного клону в ElevenLabs безкоштовне й має лишатися доступним (право користувача прибрати свій голос).
  if (method === "DELETE" && u.hostname === "api.elevenlabs.io" && /^\/v1\/voices\/[^/]+$/.test(u.pathname)) return false;
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
  const method = String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (isPaidRequest(u, method)) await paidRpc("paid_reserve");
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
Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new HttpError(503, "no_key");
  const { id: userId } = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const db = admin();
  const { data: prof, error: profErr } = await db.from("profiles").select("clone_voice_id,nickname,is_owner").eq("id", userId).maybeSingle();
  if (profErr) throw new HttpError(503, "policy_unavailable");

  const drop = async (id: string) => {
    await fetch(`https://api.elevenlabs.io/v1/voices/${encodeURIComponent(id)}`, { method: "DELETE", headers: { "xi-api-key": key } }).catch(() => {});
  };

  if (body.delete === true) {
    if (prof?.clone_voice_id) await drop(prof.clone_voice_id);
    await db.rpc("set_clone", { p_user: userId, p_voice: null });
    return json({ ok: true });
  }

  // Створення клону — платна дія ElevenLabs: лише власник (роль з бази, не з браузера) і лише після явного ввімкнення й бюджету.
  // Видалення власного клону вище лишається доступним усім (безкоштовне, право на видалення своїх даних).
  if (prof?.is_owner !== true) throw new HttpError(403, "owner_only");
  await paidRpc("paid_check");
  if (body.consent !== true) throw new HttpError(400, "consent_required");
  const b64 = typeof body.audio === "string" ? body.audio : "";
  if (b64.length < 40_000) throw new HttpError(400, "too_short");      // ~20+ секунд запису
  if (b64.length > 14_000_000) throw new HttpError(400, "too_long");   // ~10 МБ
  const mime = String(body.mime || "audio/webm").split(";")[0];
  const ext = mime.includes("mp4") || mime.includes("m4a") ? "m4a" : mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : "webm";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  const fd = new FormData();
  fd.append("name", `yuvi-${userId.slice(0, 8)}`);
  fd.append("description", "Власний голос користувача YuVi Studio (згода надана на сайті)");
  fd.append("remove_background_noise", "true");
  fd.append("files", new Blob([bytes], { type: mime }), `voice.${ext}`);
  const r = await fetch("https://api.elevenlabs.io/v1/voices/add", { method: "POST", headers: { "xi-api-key": key }, body: fd });
  if (!r.ok) {
    const t = (await r.text()).slice(0, 300);
    await db.rpc("svc_log", { p_service: "elevenlabs_clone", p_units: 0, p_ok: false, p_err: `${r.status} ${t}` });
    // найчастіше: закінчились місця для голосів у тарифі
    throw new HttpError(r.status === 400 && /limit|slot/i.test(t) ? 503 : 502, r.status === 400 && /limit|slot/i.test(t) ? "slots_full" : "clone_failed");
  }
  const j = await r.json();
  if (prof?.clone_voice_id) await drop(prof.clone_voice_id);
  await db.rpc("set_clone", { p_user: userId, p_voice: j.voice_id });
  await db.rpc("svc_log", { p_service: "elevenlabs_clone", p_units: 1, p_ok: true });
  return json({ ok: true });
}));