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
