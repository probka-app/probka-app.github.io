// stats-extract — один файл для вставки в редактор Supabase (Edge Functions -> Via Editor)
// Розпізнавання скріншотів статистики (Instagram / TikTok / YouTube) у числа.
// POST { mode?: "video" | "account", today?: "YYYY-MM-DD", images: [{ type: "image/jpeg", data: "<base64>" }, ...] }
// video   -> { stats: { instagram?: {...}, tiktok?: {...}, youtube?: {...} } }
// account -> { account: { instagram?: { total_views?, followers?, daily: [{ date, views }] }, ... } }
// Потрібен секрет ANTHROPIC_API_KEY (платний ключ з console.anthropic.com). Без нього відповідає 501.

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
const PAID_SVC = "stats_extract";
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
const FIELDS = ["views", "reach", "likes", "comments", "shares", "reposts", "saves", "follows", "avg_watch_sec", "retention_pct", "watch_time_min"];

const PROMPT = `Це скріншоти статистики ОДНОГО короткого відео з соцмереж (Instagram Reels, TikTok або YouTube Shorts), інтерфейс може бути українською, англійською чи іншою мовою.
Визнач платформу кожного скріншота й витягни числа. Поля (усі необов'язкові, лише те, що реально видно):
- views: перегляди / відтворення / plays / views
- reach: охоплення / accounts reached / унікальні глядачі
- likes: вподобання / likes
- comments: коментарі
- shares: поширення / надсилання / shares / sends
- reposts: репости / reposts (окремо від поширень, якщо є)
- saves: збереження / saves / favorites / додано в обране
- follows: нові підписники з цього відео / follows
- avg_watch_sec: середній час перегляду в секундах
- retention_pct: відсоток, що додивились до кінця / утримання, у відсотках (0-100)
- watch_time_min: загальний час перегляду в хвилинах
Перетвори скорочення в повні числа: 1,2 тис. = 1200; 3.4K = 3400; 1,1 млн = 1100000; "0:07" = 7 секунд; "1 хв 5 с" = 65 секунд.
Відповідай ТІЛЬКИ JSON без пояснень у форматі {"instagram":{...},"tiktok":{...},"youtube":{...}} — лише платформи, які є на скріншотах, і лише числа.`;

const ACCOUNT_PROMPT = (today: string) => `Це скріншоти ЗАГАЛЬНОЇ аналітики акаунту в соцмережі (Instagram, TikTok або YouTube): перегляди за період, графік по днях тощо. Сьогодні ${today}.
Для кожної платформи витягни:
- total_views: усі перегляди за показаний період (число)
- followers: кількість підписників, якщо видно
- daily: масив {"date":"YYYY-MM-DD","views":число} — ТІЛЬКИ для днів, де число видно явно (підписи на графіку, таблиця, підказка). Не вгадуй значення з висоти стовпчиків.
Рік визначай із контексту (найближчий до сьогоднішньої дати, не в майбутньому). Скорочення перетворюй у числа (1,2 тис. = 1200; 3.4K = 3400).
Відповідай ТІЛЬКИ JSON: {"instagram":{"total_views":...,"followers":...,"daily":[...]},"tiktok":{...},"youtube":{...}} — лише платформи зі скріншотів.`;

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const key = env("ANTHROPIC_API_KEY");
  if (!key) throw new HttpError(501, "ai_not_configured");
  const { id: userId } = await requireUser(req);

  const body = await req.json().catch(() => ({}));
  const images = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
  const mode = body.mode === "account" ? "account" : "video";
  const today = /^\d{4}-\d{2}-\d{2}$/.test(body.today ?? "") ? body.today : new Date().toISOString().slice(0, 10);
  if (!images.length) throw new HttpError(400, "no_images");
  for (const im of images) {
    if (!/^image\/(jpeg|png|webp)$/.test(im?.type) || typeof im?.data !== "string" || im.data.length > 2_800_000) throw new HttpError(400, "bad_image");
  }

  const { data: ok, error } = await admin().rpc("ai_take", { p_user: userId });
  if (error) throw new Error(error.message);
  if (!ok) throw new HttpError(429, "daily_limit");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: env("AI_MODEL", "claude-haiku-5-5"),
      max_tokens: mode === "account" ? 3000 : 800,
      messages: [{
        role: "user",
        content: [
          ...images.map((im: { type: string; data: string }) => ({ type: "image", source: { type: "base64", media_type: im.type, data: im.data } })),
          { type: "text", text: mode === "account" ? ACCOUNT_PROMPT(today) : PROMPT },
        ],
      }],
    }),
  });
  if (!r.ok) { console.error("anthropic", r.status, await r.text()); throw new HttpError(502, "ai_failed"); }
  const out = await r.json();
  const text: string = (out.content ?? []).map((c: { text?: string }) => c.text ?? "").join("");
  const m = text.match(/\{[\s\S]*\}/);
  let raw: Record<string, Record<string, unknown>> = {};
  try { raw = m ? JSON.parse(m[0]) : {}; } catch { raw = {}; }

  if (mode === "account") {
    const account: Record<string, { total_views?: number; followers?: number; daily: { date: string; views: number }[] }> = {};
    for (const p of ["instagram", "tiktok", "youtube"]) {
      const src = raw[p] as Record<string, unknown> | undefined; if (!src || typeof src !== "object") continue;
      const tv = Number(src.total_views), fl = Number(src.followers);
      const daily = (Array.isArray(src.daily) ? src.daily : [])
        .map((d: { date?: string; views?: number }) => ({ date: String(d?.date ?? ""), views: Number(d?.views) }))
        .filter((d: { date: string; views: number }) => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && d.date <= today && Number.isFinite(d.views) && d.views >= 0)
        .slice(0, 120);
      const o: { total_views?: number; followers?: number; daily: { date: string; views: number }[] } = { daily };
      if (Number.isFinite(tv) && tv >= 0) o.total_views = Math.round(tv);
      if (Number.isFinite(fl) && fl >= 0) o.followers = Math.round(fl);
      if (daily.length || o.total_views != null || o.followers != null) account[p] = o;
    }
    return json({ account });
  }

  // лишаємо тільки відомі платформи й поля, тільки невід'ємні числа
  const stats: Record<string, Record<string, number>> = {};
  for (const p of ["instagram", "tiktok", "youtube"]) {
    const src = raw[p]; if (!src || typeof src !== "object") continue;
    const dst: Record<string, number> = {};
    for (const f of FIELDS) { const v = Number((src as Record<string, unknown>)[f]); if (Number.isFinite(v) && v >= 0) dst[f] = Math.round(v * 10) / 10; }
    if (Object.keys(dst).length) stats[p] = dst;
  }
  return json({ stats });
}));
