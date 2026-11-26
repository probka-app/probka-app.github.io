// kb-chat — один файл для вставки в редактор Supabase (Edge Functions -> Via Editor)
// «Навчання агента» — чат засновника з Claude. Claude відповідає як учень, перепитує
// і витягує з розповіді знання (елементи, принципи, правила, гіпотези) — вони чекають підтвердження.
// POST { message }  (Authorization: Bearer <токен власника>)  -> { reply, items: [...] }
// Секрети: ANTHROPIC_API_KEY; KB_MODEL (необов'язково, за замовчуванням claude-sonnet-5-5).

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
const PAID_SVC = "kb_chat";
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
const SYSTEM = `Ти — AI-агент платформи YuVi Studio, який вчиться в засновника, як працює короткий вертикальний контент (Reels, TikTok, Shorts).
Засновник має великий практичний досвід: його відео набирали від десятків тисяч до ~900 тисяч переглядів; він свідомо додає елементи, які утримують увагу.
Твоя роль — уважний учень і співрозмовник:
1) Відповідай коротко, живою українською, по суті. Якщо щось незрозуміло або суперечить попереднім знанням — перепитай (1–2 конкретні питання). Можеш висловлювати свої гіпотези, але чесно позначай їх як гіпотези.
2) Витягни з повідомлення засновника нові знання. Типи: element (елемент відео, що утримує увагу), principle (загальний принцип), rule (конкретне правило «роби так»), hypothesis (неперевірене припущення), note (інше корисне).
   Для кожного: title (коротко, до 12 слів), body (що саме), why (чому працює — якщо засновник пояснив або це очевидно з контексту), how (як зробити на практиці), niche (ніша, якщо стосується конкретної, інакше порожньо).
   Не вигадуй знань, яких засновник не казав. Не дублюй те, що вже є в базі.
Відповідай ТІЛЬКИ JSON: {"reply":"...","items":[{"kind":"element","title":"...","body":"...","why":"...","how":"...","niche":""}]}`;

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const key = env("ANTHROPIC_API_KEY");
  if (!key) throw new HttpError(503, "no_key");
  const { client } = await requireUser(req);
  const { data: owner } = await client.rpc("is_owner");
  if (!owner) throw new HttpError(403, "forbidden");
  const body = await req.json().catch(() => ({}));
  const msg = String(body.message ?? "").trim().slice(0, 8000);
  if (msg.length < 2) throw new HttpError(400, "empty");
  const db = admin();

  const { data: hist } = await db.from("kb_chat").select("role,content").order("id", { ascending: false }).limit(16);
  const { data: items } = await db.from("kb_items").select("kind,title,body,status").neq("status", "rejected").order("updated_at", { ascending: false }).limit(80);
  const known = (items ?? []).map((i: { kind: string; title: string; body: string; status: string }) => `- [${i.kind}${i.status === "pending" ? ", не підтверджено" : ""}] ${i.title}${i.body ? ": " + i.body : ""}`).join("\n") || "(база поки порожня)";
  const messages = [
    ...(hist ?? []).reverse().map((h: { role: string; content: string }) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: `Що вже є в базі знань:\n${known}\n\nНове повідомлення засновника:\n${msg}` },
  ];
  // повідомлення мають чергуватися user/assistant — зливаємо підряд однакові
  const merged: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) { const last = merged[merged.length - 1]; if (last && last.role === m.role) last.content += "\n\n" + m.content; else merged.push({ ...m }); }
  while (merged.length && merged[0].role !== "user") merged.shift();

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: env("KB_MODEL", "claude-sonnet-5-5"), max_tokens: 2500, system: SYSTEM, messages: merged }),
  });
  if (!r.ok) {
    await db.rpc("svc_log", { p_service: "claude", p_units: 0, p_ok: false, p_err: `kb ${r.status}` });
    throw new HttpError(r.status === 429 || r.status === 529 ? 503 : 502, r.status === 429 || r.status === 529 ? "busy" : "ai_failed");
  }
  const j = await r.json();
  await db.rpc("svc_log", { p_service: "claude", p_units: 3, p_ok: true });
  const t = (j.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  let out: { reply?: string; items?: { kind?: string; title?: string; body?: string; why?: string; how?: string; niche?: string }[] } = {};
  try { out = JSON.parse(t); } catch (_) { const m = /\{[\s\S]*\}/.exec(t); try { out = m ? JSON.parse(m[0]) : { reply: t }; } catch (_) { out = { reply: t }; } }
  const reply = String(out.reply ?? "").slice(0, 6000) || "Записав.";
  const kinds = new Set(["element", "principle", "rule", "hypothesis", "note"]);
  const rows = (out.items ?? []).filter((i) => i && i.title).slice(0, 12).map((i) => ({
    kind: kinds.has(String(i.kind)) ? String(i.kind) : "note", title: String(i.title).slice(0, 160), body: String(i.body ?? "").slice(0, 1200),
    why: String(i.why ?? "").slice(0, 800), how: String(i.how ?? "").slice(0, 800), niche: String(i.niche ?? "").slice(0, 60), status: "pending", source: "founder",
  }));
  await db.from("kb_chat").insert([{ role: "user", content: msg }, { role: "assistant", content: reply }]);
  let saved: unknown[] = [];
  if (rows.length) { const { data } = await db.from("kb_items").insert(rows).select(); saved = data ?? []; }
  return json({ reply, items: saved });
}));