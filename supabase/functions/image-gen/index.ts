// image-gen — один файл для вставки в редактор Supabase (Edge Functions -> Via Editor)
// Генерація картинки для сцени через Gemini (модель Nano Banana).
// POST { prompt, style?, ref?: base64 JPEG/PNG, refType?, aspect? }  (Authorization: Bearer <токен користувача>)
// -> { image: base64, mime, left }  — left: скільки генерацій залишилось сьогодні
// Секрети: GEMINI_API_KEY (обов'язково), GEMINI_IMAGE_MODEL (необов'язково).
// Дешевий шлях: CF_ACCOUNT_ID + CF_AI_TOKEN (Cloudflare Workers AI, FLUX.1 schnell) — ~$0.0006 за картинку,
// 10 000 «нейронів» на день безкоштовно (~170 картинок). Якщо задано — використовується для нових картинок без референсу;
// Gemini лишається для перемальовування за фото/малюнком і як запасний.

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
const PAID_SVC = "image_gen";
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
const MODEL = () => env("GEMINI_IMAGE_MODEL", "gemini-2.5-flash-image");
const ASPECTS = new Set(["1:1", "9:16", "16:9", "3:4", "4:3"]);

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const key = env("GEMINI_API_KEY"), cfAcc = env("CF_ACCOUNT_ID"), cfTok = env("CF_AI_TOKEN");
  if (!key && !(cfAcc && cfTok)) throw new HttpError(503, "no_key");
  const { id: userId } = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").trim().slice(0, 2000);
  const style = String(body.style ?? "").trim().slice(0, 600);
  const ref = typeof body.ref === "string" && body.ref.length < 3_000_000 ? body.ref : "";
  const refType = body.refType === "image/png" ? "image/png" : "image/jpeg";
  const aspect = ASPECTS.has(body.aspect) ? body.aspect : "1:1";
  if (prompt.length < 3) throw new HttpError(400, "empty_prompt");

  const db = admin();
  const { data: ok, error: te } = await db.rpc("img_take", { p_user: userId });
  if (te) throw new Error(te.message);
  if (!ok) throw new HttpError(429, "limit");
  // ліміт за тарифом: пробні → місячні → пакет
  const { data: take, error: qe } = await db.rpc("quota_take", { p_user: userId, p_kind: "img", p_amount: 1 });
  if (qe) { await db.rpc("img_refund", { p_user: userId }); throw new Error(qe.message); }
  if (!take) { await db.rpc("img_refund", { p_user: userId }); throw new HttpError(402, "no_quota"); }


  // Генеруємо з повторами: якщо модель не дала картинку — пробуємо ще; якщо дала, Claude перевіряє,
  // чи відповідає вона опису кадру, і за потреби уточнює опис. Не більше MAX_TRIES звернень до Gemini.
  const MAX_TRIES = 3;
  const useCf = !!(cfAcc && cfTok) && !ref;
  const flux = async (sceneText: string) => {
    const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAcc}/ai/run/@cf/black-forest-labs/flux-1-schnell`, {
      method: "POST", headers: { Authorization: `Bearer ${cfTok}`, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: `${sceneText}. Style: ${style}. Absolutely no text, no letters, no words, no captions.`.slice(0, 2048), steps: 4 }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.result?.image) {
      console.error("cf", r.status, JSON.stringify(j).slice(0, 400));
      await db.rpc("svc_log", { p_service: "cf_image", p_units: 0, p_ok: false, p_err: `${r.status} ${JSON.stringify(j).slice(0, 200)}` }).then(() => {}, () => {});
      return null;
    }
    return { data: j.result.image as string, mime: "image/jpeg" };
  };
  const gemini = async (sceneText: string) => {
    const t = ref
      ? `Redraw the attached image as one new picture. Keep its main subject and composition. Scene: ${sceneText}. Style: ${style}. No text, no letters.`
      : `Create one picture. Scene: ${sceneText}. Style: ${style}. No text, no letters, no captions.`;
    const ps: unknown[] = [];
    if (ref) ps.push({ inline_data: { mime_type: refType, data: ref } });
    ps.push({ text: t });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL()}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: ps }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } } }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error("gemini", r.status, JSON.stringify(j).slice(0, 500));
      await db.rpc("svc_log", { p_service: "gemini_image", p_units: 0, p_ok: false, p_err: `${r.status} ${JSON.stringify(j).slice(0, 200)}` }).then(() => {}, () => {});
      if (r.status === 429) throw new HttpError(503, "busy");
      return null; // тимчасова помилка — спробуємо ще раз
    }
    for (const c of j.candidates ?? []) for (const p of c.content?.parts ?? []) {
      const d = p.inlineData ?? p.inline_data;
      if (d?.data) return { data: d.data as string, mime: (d.mimeType ?? d.mime_type ?? "image/png") as string };
    }
    return null;
  };
  // Перевірка від Claude: { ok, fix } — fix = уточнений опис сцени англійською
  const check = async (img: { data: string; mime: string }, sceneText: string): Promise<{ ok: boolean; fix?: string }> => {
    const ak = env("ANTHROPIC_API_KEY");
    if (!ak || env("IMG_CHECK", "on") === "off") return { ok: true };
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": ak, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: env("AI_MODEL", "claude-haiku-5-5"), max_tokens: 300,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: img.mime, data: img.data } },
            { type: "text", text: `This picture must show this scene for a short video: "${sceneText}". Check: is the main subject and action clearly there; no visible text or letters; no broken hands/faces or obvious defects. Be lenient about style and small details. Reply ONLY JSON: {"ok":true} or {"ok":false,"fix":"a corrected, more explicit scene description in English, 20-40 words"}.` },
          ] }],
        }),
      });
      if (!r.ok) return { ok: true };
      const j = await r.json();
      await db.rpc("svc_log", { p_service: "image_check", p_units: 1, p_ok: true }).then(() => {}, () => {});
      const t = (j.content ?? []).map((c: { text?: string }) => c.text ?? "").join("").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      const v = JSON.parse(t);
      return { ok: v.ok !== false, fix: typeof v.fix === "string" ? v.fix.slice(0, 600) : undefined };
    } catch (_) { return { ok: true }; } // перевірка не вдалась — не блокуємо картинку
  };

  type Img = { data: string; mime: string };
  let out: Img | null = null, fallback: Img | null = null, scene = prompt, tries = 0;
  try {
    while (tries < MAX_TRIES && !out) {
      tries++;
      let img = useCf ? await flux(scene) : null;
      if (!img && key) img = await gemini(scene);
      if (!img) continue;
      if (tries === MAX_TRIES) { out = img; break; }
      if (useCf && env("IMG_CHECK_CF", "off") === "off") { out = img; break; }   // перевірка коштує дорожче за саму картинку — для дешевого шляху вимкнена
      const c = await check(img, scene);
      if (c.ok) out = img; else { fallback = img; if (c.fix) scene = c.fix; }
    }
    out = out ?? fallback;
    if (!out) throw new HttpError(422, "no_image"); // модель відмовилась (наприклад, через правила безпеки)
  } catch (e) {
    await db.rpc("img_refund", { p_user: userId });
    await db.rpc("quota_refund", { p_take: take });
    throw e;
  }
  await db.rpc("svc_log", { p_service: useCf ? "cf_image" : "gemini_image", p_units: tries, p_ok: true }).then(() => {}, () => {});
  const { data: q } = await db.rpc("quota_state", { p_user: userId });
  const qi = q?.img ?? {};
  const left = (qi.trial ?? 0) + (qi.month ?? 0) + (qi.pack ?? 0);
  return json({ image: out.data, mime: out.mime, left });
}));
