// video-spec — один файл для вставки в редактор Supabase (Edge Functions -> Via Editor)
// Технічний розбір відео-прикладу «для коду»: Gemini дивиться відео (посилання YouTube або файл зі сховища) і пише детальне ТЗ.
// Секрети: GEMINI_API_KEY; необовʼязково YOUTUBE_API_KEY (перегляди, лайки, підписники — для аналітики назв і превʼю).
// POST { packOnly?: true (лише назва й превʼю), url?: string (YouTube), path?: string (media/<uid>/...), mins?: number, caps?: string, id?: uuid (рядок черги dev_specs) } -> { id, title, spec }
// Лише власник. Секрети: GEMINI_API_KEY (обов'язково), VIDEO_SPEC_MODEL (необов'язково, за замовчуванням gemini-2.5-flash), VIDEO_SPEC_RES (необов'язково: MEDIA_RESOLUTION_LOW | MEDIUM | HIGH).
// Розбір містить розділи 14 (озвучка дослівно) і 15 (картки для бази знань у JSON) — сайт сам кладе картки в базу «на перевірку».

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
const G = "https://generativelanguage.googleapis.com";
const PROMPT = (caps: string) => `Ти — технічний аналітик 2D-анімації й моушн-дизайну. Розбери це відео так детально, щоб програміст відтворив його СТИЛЬ і ПРИЙОМИ в canvas-рушії вертикальних відео 9:16. Сюжет не переказуй — опиши, ЯК зроблено. Пиши українською, з конкретними числами (секунди, пікселі у відсотках кадру, HEX-кольори), без загальних слів.

## 0. Коротко
Назва стилю, одним абзацом — у чому його сила.
Окремим рядком рівно так: ФОРМАТ: tall (вертикальне 9:16) або wide (горизонтальне 16:9) · ТРИВАЛІСТЬ: N с · ТИП: reels|shorts|youtube-long.
## 1. Таймлайн сцен
Таблиця: таймкод | тривалість | що в кадрі | план (загальний/середній/крупний/обличчя) | рух камери (тип, швидкість, звідки куди) | перехід у сцену.
## 2. Персонажі
Пропорції (голова/тіло/кінцівки у % висоти), форми, товщина ліній, кольори HEX, очі/рот/брови, набір емоцій, пози й жести, як рухаються (хода, моргання, дихання), аксесуари, як відрізняються персонажі між собою.
## 3. Фони й локації
Перелік локацій, як намальовані (шари, глибина, туман, деталізація), палітри HEX, освітлення.
## 4. Текст на екрані
Шрифт (на що схожий), розмір у % висоти кадру, колір, обведення/тінь, позиція, анімація появи/зникання з тривалістю, мітки над персонажами, виділення слів.
## 5. Інфографіка й графіка
Кожен елемент (шкали, таймери, лічильники, таблиці, іконки, стрілки, кола): вигляд, кольори, анімація по кроках і тривалості.
## 6. Звук
Музика (настрій, темп BPM), звукові ефекти: на які події і як звучать.
## 7. Темп і утримання
Середня тривалість сцени, хук у перші 3 с (візуальний і словесний), повороти, як тримається увага.
## 8. 15 прийомів
Кожен: що це → як реалізувати програмно (що малювати, які параметри, таймінги).
## 9. Як слова перетворюються на кадри
Найважливіший розділ. 25+ прикладів підряд: «фраза диктора (дослівно або близько)» → що показано (план, камера, персонаж: поза й емоція, предмет, інфографіка, текст на екрані, звук) → чому саме так. Потім виведи 10 загальних правил «тип фрази → тип кадру» (число, порівняння, час, емоція, абстрактна ідея, питання, поворот, висновок).
## 10. Сценарій і подача
Формула хука (дослівно перше речення й що в цей момент у кадрі), структура (етапи з таймкодами), довжина речень, як відкривається й закривається петля, повороти, типові фрази-зв'язки, фінал. Якщо є реклама чи заклик — як до нього підводять (дослівно) і як повертаються в історію.
## 11. Монтаж і ритм
Розподіл тривалостей сцен (мін/середня/макс), де ріже на слові чи на паузі, як часто змінюється план і локація, де «удари» камери, як поводиться камера між сценами, кольорокорекція, загальна динаміка по хвилинах.
## 12. Чого бракує нашому рушію
Ось що рушій УЖЕ вміє:
${caps || "(не передано)"}
Порівняй і випиши, чого бракує, щоб відтворити це відео: кожен пункт — назва, опис, пріоритет (високий/середній/низький), складність.
## 13. План реалізації
Нумерований список задач для програміста в порядку користі: що додати в рушій, з параметрами за замовчуванням.
## 14. Озвучка дослівно
Увесь текст диктора дослівно, мовою оригіналу, фраза за фразою з таймкодами («0:03 — …»). Потім одним рядком: слів усього, слів за секунду, середня довжина речення в словах. Якщо голосу немає — так і напиши і дай текст із екрана.
## 15. Картки для бази знань
Лише прийоми, які можна перенести в короткі вертикальні 2D-анімаційні відео іншої теми (без назв каналів, брендів і реальних людей; сюжет не переказуй). 8–20 карток. Відповідь цього розділу — один блок \`\`\`json з таким вмістом:
{"fmt":"tall|wide","cards":[{"module":"hook|script|story|adlead|board|edit|camera|sound|color|title|niche","kind":"rule|element|example","title":"коротка назва прийому до 10 слів","body":"роби так: конкретне правило для нашого відео","how":"приклад із цього відео: дослівна фраза або що в кадрі й на якій секунді","why":"чому це тримає увагу — одне речення","confidence":0.0}]}
confidence — наскільки ти впевнений, що прийом справді працює саме тут (0–1). Прийоми, що мають сенс лише в довгому горизонтальному відео, познач fmt "wide".`;

// ---- назва й превʼю: метадані YouTube + аналіз обкладинки (окремий швидкий запит, JSON для бази аналітики) ----
const ytId = (u: string) => u.match(/(?:v=|shorts\/|youtu\.be\/)([\w-]{11})/)?.[1] ?? "";
const PACK_PROMPT = (t: string, ch: string, st: string) => `Ти — аналітик упаковки відео (назви й превʼю/обкладинки) для YouTube, Shorts і Reels. Перед тобою превʼю відео.
Назва: «${t}»
Канал: ${ch || "—"}
Статистика: ${st || "немає"}
Розбери назву і превʼю максимально детально — для бази аналітики, з якої студія вчитиметься робити назви й обкладинки для власних 2D-анімаційних відео. Не згадуй реальних людей у шаблонах.
Відповідай ТІЛЬКИ JSON такого вигляду (значення українською, числа — числами):
{"title":{"lang":"uk|en|ru|інша","words":0,"chars":0,"hook":"question|number|what_if|secret|warning|challenge|story|how_to|comparison|list|shock|other","formula":"узагальнена формула з [змінними]","emotion":"цікавість|страх|заздрість|гнів|радість|шок|ностальгія|інше","curiosity_gap":0,"has_number":false,"has_question":false,"caps_words":0,"power_words":[],"promise":"що обіцяє глядачу","why":"чому працює або ні — 1–2 речення"},
"thumb":{"style":"2d-анімація|3d|фото|скрін|колаж|текст|інше","subject":"головний обʼєкт","characters":0,"faces":0,"emotion":"емоція головного персонажа","text":"текст на превʼю дослівно або порожньо","text_words":0,"text_pos":"верх|центр|низ|ліво|право|немає","colors":["#hex","#hex","#hex"],"bg":"фон","contrast":0,"focal":"куди дивиться око першим","objects":[],"arrows_circles":false,"readable_small":0,"link":"як превʼю доповнює назву (не дублює?)","why":"1–2 речення"},
"ctr_guess":0,
"templates":{"title":["3 шаблони назви з [змінними] для наших відео"],"thumb":"шаблон превʼю для 2D-анімації: що в кадрі, емоція, текст, кольори"}}
curiosity_gap, contrast, readable_small, ctr_guess — від 0 до 10.`;
async function packOf(key: string, url: string) {
  const id = ytId(url); if (!id) return null;
  const watch = `https://www.youtube.com/watch?v=${id}`;
  let title = "", channel = "", thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, stats: Record<string, unknown> = {};
  try { const o = await (await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`)).json(); title = String(o.title ?? ""); channel = String(o.author_name ?? ""); } catch (_) { /* приватне чи недоступне */ }
  // необовʼязково: справжні цифри через YouTube Data API (секрет YOUTUBE_API_KEY)
  const yk = env("YOUTUBE_API_KEY");
  if (yk) try {
    const v = (await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${id}&key=${yk}`)).json()).items?.[0];
    if (v) { const sn = v.snippet ?? {}, s2 = v.statistics ?? {}; title = sn.title || title; channel = sn.channelTitle || channel;
      const th = sn.thumbnails ?? {}; thumb = (th.maxres ?? th.standard ?? th.high ?? {}).url || thumb;
      const d = String(v.contentDetails?.duration ?? "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/), dur = d ? (+(d[1] ?? 0)) * 3600 + (+(d[2] ?? 0)) * 60 + (+(d[3] ?? 0)) : 0;
      const views = +(s2.viewCount ?? 0), days = Math.max(1, (Date.now() - Date.parse(sn.publishedAt)) / 864e5);
      stats = { views, likes: +(s2.likeCount ?? 0), comments: +(s2.commentCount ?? 0), published: sn.publishedAt, dur, vpd: Math.round(views / days), tags: (sn.tags ?? []).slice(0, 15), channel_id: sn.channelId };
      const c = (await (await fetch(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${sn.channelId}&key=${yk}`)).json()).items?.[0]?.statistics;
      if (c) { const subs = +(c.subscriberCount ?? 0), cv = +(c.viewCount ?? 0), cn = +(c.videoCount ?? 0); stats.subs = subs; stats.ratio = subs ? +(views / subs).toFixed(2) : null; stats.outlier = cn && cv ? +(views / (cv / cn)).toFixed(2) : null; } }
  } catch (_) { /* без цифр */ }
  // обкладинка: найкраща доступна якість
  let img: Uint8Array | null = null;
  for (const q of [thumb, `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`]) { try { const r = await fetch(q); if (r.ok) { const b = new Uint8Array(await r.arrayBuffer()); if (b.length > 3000) { img = b; thumb = q; break; } } } catch (_) { /* далі */ } }
  let pack: unknown = null;
  if (img) {
    let b64 = ""; for (let i = 0; i < img.length; i += 32768) b64 += String.fromCharCode(...img.subarray(i, i + 32768)); b64 = btoa(b64);
    const st = stats.views != null ? `переглядів ${stats.views}, лайків ${stats.likes}, коментарів ${stats.comments}, підписників каналу ${stats.subs ?? "?"}, перегляди/підписники ${stats.ratio ?? "?"}, у ${stats.outlier ?? "?"} раз(и) більше за середнє відео каналу` : "";
    const r = await fetch(`${G}/v1beta/models/${env("VIDEO_SPEC_MODEL", "gemini-2.5-flash")}:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ inline_data: { mime_type: "image/jpeg", data: b64 } }, { text: PACK_PROMPT(title, channel, st) }] }], generationConfig: { maxOutputTokens: 3000, temperature: 0.2, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }) });
    const j = await r.json().catch(() => ({}));
    const t = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
    try { pack = JSON.parse(t.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch (_) { pack = null; }
  }
  return { yt_id: id, yt_title: title.slice(0, 300), channel: channel.slice(0, 120), thumb, stats, pack };
}

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const key = env("GEMINI_API_KEY"); if (!key) throw new HttpError(503, "no_key");
  const { id: userId } = await requireUser(req);
  const { data: prof } = await admin().from("profiles").select("is_owner").eq("id", userId).maybeSingle();
  if (!prof?.is_owner) throw new HttpError(403, "forbidden");
  const body = await req.json().catch(() => ({}));
  const url = String(body.url ?? "").trim(), path = String(body.path ?? "").trim(), mins = Math.min(30, Math.max(1, Number(body.mins) || 10));
  const caps = String(body.caps ?? "").slice(0, 6000);
  const qid = /^[0-9a-f-]{36}$/.test(String(body.id ?? "")) ? String(body.id) : "";
  // packOnly: лише назва й превʼю (доповнити старі розбори, без повторного перегляду відео)
  if (body.packOnly === true) {
    if (!qid || !ytId(url)) throw new HttpError(400, "bad_url");
    const pk = await packOf(key, url); if (!pk?.pack) throw new HttpError(502, "ai_failed");
    const { error: e4 } = await admin().from("dev_specs").update(pk).eq("id", qid); if (e4) throw new Error(e4.message);
    return json({ id: qid, ...pk });
  }
  let fileUri = "", mime = "video/mp4", title = url;
  if (url) {
    if (!/^https:\/\/(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)[\w-]{6,}/.test(url)) throw new HttpError(400, "bad_url");
    fileUri = url;
  } else if (path) {
    if (!path.startsWith(userId + "/")) throw new HttpError(403, "forbidden_path");
    const { data: blob, error } = await admin().storage.from("media").download(path);
    if (error || !blob) throw new HttpError(404, "file_not_found");
    mime = blob.type || "video/mp4"; title = path.split("/").pop() || path;
    const start = await fetch(`${G}/upload/v1beta/files?key=${key}`, { method: "POST", headers: { "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start", "X-Goog-Upload-Header-Content-Length": String(blob.size), "X-Goog-Upload-Header-Content-Type": mime, "Content-Type": "application/json" }, body: JSON.stringify({ file: { display_name: title.slice(0, 100) } }) });
    const up = start.headers.get("x-goog-upload-url"); if (!up) throw new HttpError(502, "upload_start_failed");
    const fin = await fetch(up, { method: "POST", headers: { "X-Goog-Upload-Command": "upload, finalize", "X-Goog-Upload-Offset": "0" }, body: blob });
    const fj = await fin.json().catch(() => ({})); let f = fj.file; if (!f?.uri) throw new HttpError(502, "upload_failed");
    for (let i = 0; i < 40 && f.state === "PROCESSING"; i++) { await new Promise((r) => setTimeout(r, 2500)); f = await (await fetch(`${G}/v1beta/${f.name}?key=${key}`)).json(); }
    if (f.state !== "ACTIVE") throw new HttpError(502, "file_not_ready");
    fileUri = f.uri; mime = f.mimeType || mime;
  } else throw new HttpError(400, "no_video");

  const model = env("VIDEO_SPEC_MODEL", "gemini-2.5-flash");
  // якість перегляду відео: LOW — дешево (за замовчуванням), MEDIUM/HIGH — краще читає дрібний текст і деталі, але дорожче (секрет VIDEO_SPEC_RES)
  const RES = ["MEDIA_RESOLUTION_LOW", "MEDIA_RESOLUTION_MEDIUM", "MEDIA_RESOLUTION_HIGH"].includes(env("VIDEO_SPEC_RES")) ? env("VIDEO_SPEC_RES") : "MEDIA_RESOLUTION_LOW";
  const packP = url ? packOf(key, url).catch((e) => { console.error("pack", e); return null; }) : Promise.resolve(null);
  // кілька спроб: якщо Gemini відхилив запит (400), пробуємо простіший варіант — без обрізки за часом і без додаткових налаштувань
  const yt = !!url;
  const vpart = (cut: boolean) => ({ file_data: yt ? { file_uri: fileUri } : { file_uri: fileUri, mime_type: mime }, ...(cut ? { video_metadata: { start_offset: "0s", end_offset: `${mins * 60}s` } } : {}) });
  const tries = [
    { parts: [vpart(true), { text: PROMPT(caps) }], cfg: { maxOutputTokens: 24000, temperature: 0.3, mediaResolution: RES, thinkingConfig: { thinkingBudget: 1024 } } },
    { parts: [vpart(false), { text: PROMPT(caps) }], cfg: { maxOutputTokens: 24000, temperature: 0.3, mediaResolution: RES } },
    { parts: [vpart(false), { text: PROMPT(caps) }], cfg: { maxOutputTokens: 16000, temperature: 0.3 } },
  ];
  let r: Response | null = null, j: any = {}, emsg = "";
  for (const t of tries) {
    r = await fetch(`${G}/v1beta/models/${model}:generateContent?key=${key}`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: t.parts }], generationConfig: t.cfg }) });
    j = await r.json().catch(() => ({}));
    if (r.ok) break;
    emsg = String(j?.error?.message ?? "").replace(/key=[\w-]+/g, "key=…").slice(0, 160);
    console.error("gemini", r.status, JSON.stringify(j).slice(0, 400));
    await admin().rpc("svc_log", { p_service: "gemini", p_units: 0, p_ok: false, p_err: `${r.status} ${emsg}` }).then(() => {}, () => {});
    if (r.status === 429) throw new HttpError(503, "busy");
    if (r.status !== 400 && r.status < 500) break; // 403/404 — повтор не допоможе
  }
  if (!r?.ok) throw new HttpError(502, emsg ? `gemini: ${emsg}` : "ai_failed");
  const spec = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("").trim();
  if (!spec) throw new HttpError(502, "empty");
  const t0 = (spec.match(/^#*\s*0\.[^\n]*\n+([^\n]{3,90})/m)?.[1] ?? "").replace(/[*#]/g, "").trim();
  const pk = await packP;
  const rowv = { owner: userId, url: url || path, title: (pk?.yt_title || t0 || title).slice(0, 140), spec, status: "new", err: "", ...(pk ?? {}) };
  const { data: row, error: e2 } = qid ? await admin().from("dev_specs").update(rowv).eq("id", qid).select("id").single() : await admin().from("dev_specs").insert(rowv).select("id").single();
  if (e2) throw new Error(e2.message);
  await admin().rpc("svc_log", { p_service: "gemini", p_units: 1, p_ok: true }).then(() => {}, () => {});
  return json({ id: row.id, title: rowv.title, spec, pack: pk?.pack ?? null });
}));
