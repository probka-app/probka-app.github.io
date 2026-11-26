// voices-admin — один файл для вставки в редактор Supabase (Edge Functions -> Via Editor)
// Для власника: пошук голосів у бібліотеці ElevenLabs і додавання їх на сайт.
// POST { action: "search", q?, gender? }                         -> { voices: [...] }  (українські голоси)
// POST { action: "add", owner_id, voice_id, name, descr?, gender?, preview? } -> { id }
// (Authorization: Bearer <токен власника>)
// Секрет: ELEVENLABS_API_KEY.

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
const PAID_SVC = "voices_admin";
const FREE_HOSTS = new Set<string>([]);
const _rawFetch: typeof fetch = globalThis.fetch.bind(globalThis);
const supaHost = (): string => { try { return new URL(env("SUPABASE_URL")).hostname; } catch { return ""; } };
function isPaidRequest(u: URL): boolean {
  if (u.hostname === supaHost() || FREE_HOSTS.has(u.hostname)) return false;
  // Gemini Files API (завантаження файлу й опитування стану) не тарифікується; тарифікуються generate*/predict/embed.
  if (u.hostname === "generativelanguage.googleapis.com" && (/^\/upload\/v1beta\/files$/.test(u.pathname) || /^\/v1beta\/files\/[A-Za-z0-9_-]+$/.test(u.pathname))) return false;
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
Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new HttpError(503, "no_key");
  const { client } = await requireUser(req);
  const { data: owner } = await client.rpc("is_owner");
  if (!owner) throw new HttpError(403, "forbidden");
  await paidRpc("paid_check"); // і для власника: лише після явного ввімкнення й бюджету
  const body = await req.json().catch(() => ({}));

  if (body.action === "search") {
    const u = new URL("https://api.elevenlabs.io/v1/shared-voices");
    u.searchParams.set("page_size", "40");
    u.searchParams.set("language", "uk");
    if (body.q) u.searchParams.set("search", String(body.q).slice(0, 60));
    if (body.gender === "male" || body.gender === "female") u.searchParams.set("gender", body.gender);
    const r = await fetch(u, { headers: { "xi-api-key": key } });
    if (!r.ok) throw new HttpError(502, "search_failed");
    const j = await r.json();
    const voices = (j.voices ?? []).map((v: Record<string, unknown>) => ({
      owner_id: v.public_owner_id, voice_id: v.voice_id, name: v.name, gender: v.gender, age: v.age, accent: v.accent,
      descr: v.description ?? v.descriptive ?? "", use_case: v.use_case, preview: v.preview_url,
    }));
    return json({ voices });
  }

  if (body.action === "add") {
    const ownerId = String(body.owner_id ?? ""), sharedId = String(body.voice_id ?? ""), name = String(body.name ?? "").slice(0, 40);
    if (!ownerId || !sharedId || !name) throw new HttpError(400, "bad_request");
    const r = await fetch(`https://api.elevenlabs.io/v1/voices/add/${encodeURIComponent(ownerId)}/${encodeURIComponent(sharedId)}`, {
      method: "POST", headers: { "xi-api-key": key, "Content-Type": "application/json" }, body: JSON.stringify({ new_name: `YuVi ${name}` }),
    });
    if (!r.ok) throw new HttpError(502, "add_failed");
    const j = await r.json();
    const { data: id, error } = await client.rpc("admin_voice_save", {
      p_id: null, p_provider: "elevenlabs", p_voice_id: j.voice_id, p_name: name, p_descr: String(body.descr ?? "").slice(0, 120),
      p_gender: String(body.gender ?? ""), p_preview: String(body.preview ?? ""), p_sort: 0, p_enabled: true,
    });
    if (error) throw new Error(error.message);
    return json({ id });
  }
  throw new HttpError(400, "bad_action");
}));
