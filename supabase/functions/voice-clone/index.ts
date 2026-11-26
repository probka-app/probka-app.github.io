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

// ---- Шлюз платних операцій (виправлення безпеки 2026-11-26, етап 2) ----
// Платні виклики ВИМКНЕНІ за замовчуванням для всіх, включно з власником. Власник явно вмикає конкретну операцію в public.settings:
//   paid_<svc>_enabled = 1  і  paid_<svc>_daily_max = N (платних звернень на добу для всіх користувачів разом).
// Ключів немає, значення некоректні або налаштування не читаються → платну дію заборонено (fail-closed). Платного fallback немає.
async function paidGate(svc: string, logService: string): Promise<void> {
  const db = admin();
  const { data, error } = await db.from("settings").select("key,value").in("key", [`paid_${svc}_enabled`, `paid_${svc}_daily_max`]);
  if (error) throw new HttpError(503, "policy_unavailable");
  const v: Record<string, number> = Object.fromEntries((data ?? []).map((r: { key: string; value: unknown }) => [r.key, Number(r.value)]));
  if (v[`paid_${svc}_enabled`] !== 1) throw new HttpError(403, "paid_disabled");
  const max = v[`paid_${svc}_daily_max`];
  if (!Number.isFinite(max) || max <= 0) throw new HttpError(403, "paid_budget_missing");
  const today = new Date().toISOString().slice(0, 10);
  const { data: u, error: e2 } = await db.from("service_usage").select("calls,errors").eq("day", today).eq("service", logService).maybeSingle();
  if (e2) throw new HttpError(503, "policy_unavailable");
  if ((Number(u?.calls) || 0) + (Number(u?.errors) || 0) >= max) throw new HttpError(429, "paid_budget_exhausted");
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
  await paidGate("voice_clone", "elevenlabs_clone");
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