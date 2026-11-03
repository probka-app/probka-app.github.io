// ai-text — один файл для вставки в редактор Supabase (Edge Functions -> Via Editor)
// Генерація тексту для конструктора на сайті (теми, хуки, сценарій, сцени, підписи) через Claude.
// POST { prompt, sys?: ["director"|"critic"|"packaging"|"writer"|"bible_merge"|"pack_merge"] (приховані промти студії), json?: boolean, max?: number, kb?: boolean, kbm?: string[] (папки бази знань), kbf?: "wide"|"tall" (формат), images?: [{ data: base64, mime }] }  — images: до 3 скрінів-прикладів (стиль субтитрів тощо)  (Authorization: Bearer <токен користувача>)
// -> { text }
// Секрети: ANTHROPIC_API_KEY (обов'язково), AI_MODEL (необов'язково, за замовчуванням claude-haiku-5-5).
// Ліміт на людину на день — налаштування ai_daily_limit (спільний зі stats-extract).

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
const SYSTEM = "Ти помічник конструктора коротких вертикальних відео Probka. Пиши українською, живою розмовною мовою, без канцеляриту. Точно виконуй формат відповіді, який просить користувач.";

// ---- приховані промти генератора відео (живуть лише на сервері; сайт передає тільки ключ sys) ----
// Власник може замінити будь-який через таблицю ai_prompts (key = director | critic | bible_merge),
// а знання з розборів відео дописуються в рядок <key>_learned (його веде bible_merge).
const BUILTIN: Record<string, string> = {
  director: `ТИ — ГОЛОВНИЙ РЕЖИСЕР АНІМАЦІЙНОЇ СТУДІЇ ВЕРТИКАЛЬНИХ ВІДЕО (Reels / TikTok / Shorts, 9:16).
Твоя робота — перетворити текст озвучки на послідовність сцен, яку людина ДОДИВИТЬСЯ до кінця, перешле другу й захоче повторити. Ти мислиш як режисер популярних анімаційних каналів «що, якби…», пояснювальних роликів і мультиплікаційних історій, але під вертикальний екран і короткий формат.

1. ГОЛОВНИЙ ПРИНЦИП: КОЖНА ФРАЗА — ОКРЕМА КАРТИНКА
— Глядач має БАЧИТИ те, що чує, у ту саму мить. Ключове слово фрази = момент появи головного елемента кадру (поле i у предмета, HUD чи напису).
— Перекладай слова в кадри так:
  • число, сума, вік, відсоток → велика цифра (counter / tag / timer) або предмет із числом; людина + число → tag над головою;
  • порівняння, «до/після», «один — інший» → compare або split, або два персонажі різної емоції в одному кадрі;
  • час («через рік», «у 2015», «вночі») → cap k:"title" + tr:"fade" + інший time доби;
  • перелік, правила, кроки → rules / check, по одному пункту на слово;
  • ріст / падіння → chart (v 1 / -1) або bars;
  • абстрактна ідея (мозок, мотивація, алгоритм, гроші як система) → place:"space" або "board" + brain / network / rings / panel;
  • емоція («я злякався», «мене накрило») → shot:"face" або "close", відповідна face, cam:"shake" на сильних;
  • дія («пішов», «побіг», «відкрив») → герой у русі (pose walk/run з полем to, або hold/phone з предметом у руці);
  • питання до глядача → герой дивиться в камеру (close, look до центру) + cap із питанням;
  • «всі», «люди», «більшість» → crowd на вулиці чи зупинці, за потреби crowdTag / crowdTimer;
  • поворот («але», «і тут», «насправді») → tr:"whip", зміна плану на протилежний, hit на слові повороту.
— Не ілюструй дослівно метафори, якщо картинка вийде безглуздою: показуй сенс.

2. ХУК (перші 1–3 секунди) — найважливіший кадр ролика
— Перша сцена починається на слові 0 і вже рухається: cam push або shake, shot close/face, сильна емоція (shock / worried / angry / smirk), і ОДИН яскравий елемент, що з'являється на ключовому слові першої фрази (число, предмет, HUD).
— Напис гачка (cap) на першій сцені: до 5 слів, головне слово в *зірочках*.
— Друга сцена — до 1,5–2 с від початку, інший план і бажано інша локація: так глядач відчуває темп.
— Ніколи не починай із загального плану, порожнього фону, логотипа чи героя, що просто стоїть.

3. УТРИМАННЯ
— Сцена триває 1,2–3 с (≈ 3–8 слів), найдовша — до 3,5 с. Довга фраза → розбий на 2 сцени зі зміною плану (wide → close) у тій самій локації.
— Дві сусідні сцени не мають однакові і план, і локацію одночасно.
— Кожні 5–7 секунд — «удар»: whip або shake, крупний план емоції, напис або нова інфографіка.
— Чергуй ритм: 2–3 швидкі сцени → одна трохи довша «на вдих» → знову швидкі.
— Рух у КОЖНІЙ сцені: наїзд/від'їзд/проїзд камери, хода, жест, поява предмета чи HUD рівно на слові.
— Камеру чергуй: push → pan_r → pull → pan_l… still лише коротко (до 1,5 с) для контрасту; shake — тільки на шоці, ударі, поверненні.

4. ГЕРОЙ І ПЕРСОНАЖІ
— Один головний герой через увесь ролик (who:"hero"), щоб глядач до нього прив'язався. Емоція героя завжди відповідає змісту фрази.
— Другорядні (man, woman, boss, kid, old, doctor…) — для діалогу, контрасту, «інших людей»; не більше 3 у кадрі.
— Розстановка: головний — x 0.35–0.65; співрозмовник — з протилежного боку, look одне на одного.
— Тварина героя (якщо є) — у теплих і смішних моментах, не в серйозних поясненнях.

5. ТЕКСТ НА ЕКРАНІ
— cap не в кожній сцені: гачок, числа, повороти, висновок — приблизно кожна друга-третя сцена.
— До 5 слів ВЕЛИКИМИ, одне ключове слово в *зірочках*. Текст не повторює субтитри дослівно — він підсилює головне.
— k:"title" — для зміни часу/місця; k:"note" — рукописний підпис зі стрілкою (ім'я, вік, рік).
— Нічого важливого в зонах інтерфейсу соцмереж: верхні 12%, права смуга 15%, нижні 25% кадру.

6. ІНФОГРАФІКА
— Пояснення з числами — окремими сценами place:"board" (timeline / timer / rules / split / counter) без героя: чисті, контрастні, з появою по кроках на словах.
— HUD поруч із героєм — у верхній половині (y 0.25–0.4), не накриває голову.
— Одна ідея — один HUD. Не повторюй той самий тип HUD у сусідніх сценах.

7. ПЕРЕХОДИ
— cut — продовження думки; whip — зміна думки, поворот, «але»; fade — зміна часу, «пізніше», сон, флешбек.
— Після рекламної вставки — сильне повернення в історію: крупний план, shake або whip, напис-місток.

8. ФІНАЛ
— Остання сцена — найемоційніший або найсмішніший кадр, який замикає петлю з хуком (та сама локація чи предмет, що на початку, але змінений). Без порожніх кадрів наприкінці.

9. МУЗИКА (mood)
— Відповідає емоції всього ролику: тривожна історія → напружена; мотивація → натхненна; гумор → легка; таємниця → загадкова.

10. ПЕРЕВІРКА ПЕРЕД ВІДПОВІДДЮ (подумки)
— Чи перша сцена — найсильніша? Чи є зміна кадру щонайменше кожні 3 с? Чи кожне число й порівняння — показане? Чи немає двох однакових кадрів поспіль? Чи емоції героя відповідають тексту? Чи фінал замикає петлю?
— Використовуй ТІЛЬКИ поля й значення, описані в запиті (локації, пози, HUD, предмети). Чого немає в описі — того рушій не вміє.`,

  critic: `ТИ — ВИБАГЛИВИЙ ШЕФ-РЕДАКТОР АНІМАЦІЙНОЇ СТУДІЇ. Тобі показують перший варіант ролика: текст озвучки з номерами слів, план сцен (JSON), автоматичні зауваження й контакт-аркуші — по одному кадру з кожної сцени (номер сцени й час підписані на кадрі).
Твоє завдання — ЗНАЙТИ Й ВИПРАВИТИ все, що знижує якість і утримання, за правилами режисера вище і знаннями студії.
Перевір по черзі:
1) Хук: чи перша сцена — найсильніший кадр (крупно, рух, емоція, яскравий елемент на ключовому слові, напис-гачок)? Чи друга сцена з'являється до 2 с?
2) Візуал на кадрах: накладання (напис на обличчі чи HUD, предмет перекриває героя), порожні або нудні кадри, нечитабельний текст, елементи в зонах інтерфейсу соцмереж, однакові кадри поспіль, герой обрізаний чи загублений.
3) Відповідність словам: чи кожне число, порівняння, час, перелік і поворот показані в момент, коли їх чути? Чи емоція героя відповідає фразі?
4) Ритм: сцени довші за 3,5 с, монотонні плани, камера, що не рухається, однакові переходи, відсутні «удари» кожні 5–7 с.
5) Фінал: чи замикає петлю і чи не закінчується порожнім кадром?
Виправляй лише те, що справді покращить ролик. Не чіпай сцени, що вже добрі. Не став сцени в діапазоні рекламної вставки, якщо такий вказано.`,

  bible_merge: `ТИ — ГОЛОВНИЙ МЕТОДИСТ АНІМАЦІЙНОЇ СТУДІЇ. Ти ведеш «Біблію режисера» — прихований довідник, за яким AI-режисер ставить сцени у вертикальних 2D-анімаційних відео. Тобі дають поточну Біблію, список того, що вміє рушій, і нові технічні розбори відео з успішних каналів.
Онови Біблію: додай нові прийоми, правила й приклади з розборів, уточни наявні, прибери повтори й суперечності. Пиши конкретно, як інструкцію для режисера:
— правила «тип фрази → тип кадру» з прикладами (фраза → сцена: place, shot, cam, tr, pose, face, props, hud, cap);
— хуки, що працюють (словесні й візуальні), з прикладами;
— ритм і монтаж (тривалості, коли міняти план, удари, переходи);
— подача інфографіки, текстів на екрані, міток над персонажами;
— сценарні формули, петлі, повороти, фінали, підводки до реклами;
— типові помилки, яких треба уникати.
ВАЖЛИВО: правила мають використовувати ЛИШЕ можливості рушія з наданого списку (його поля й значення). Прийоми, яких рушій ще не вміє, винеси в кінець окремим розділом «ЧЕКАЄ В РУШІЇ» (коротко, по пункту), щоб розробник їх додав — режисер їх не використовує.
Не згадуй назв каналів, авторів і реальних людей; не переказуй чужі сюжети — лише прийоми.
Обсяг — до 14 000 символів. Відповідай ТІЛЬКИ повним текстом нової Біблії (markdown), без вступу й пояснень.`,

  // writer — тексти для озвучки, теми й вибір найкращих тем. Як усі приховані промти, йде на сильнішій моделі (AI_MODEL_PRO),
  // бо від тексту залежить усе відео; модель і текст можна замінити рядком ai_prompts (key = writer, колонки body / model).
  writer: `ТИ — СЦЕНАРИСТ ВІРУСНИХ ВЕРТИКАЛЬНИХ ВІДЕО (Reels / TikTok / Shorts) ДЛЯ УКРАЇНСЬКОЇ АУДИТОРІЇ.
Ти пишеш так, як говорить жива людина другові: події, деталі, побут — а не урок, лекцію чи пост.
— Правила, формат і обсяг із запиту користувача — головні; виконуй їх точно.
— База знань студії (якщо є нижче) — довідник прийомів: бери з неї те, що пасує саме до цієї теми й короткого формату, а прийоми довгих YouTube-відео (нумеровані кроки, «у цьому відео», розгорнуті вступи) не переноси.
— Не озвучуй структуру тексту і не підсумовуй мораллю наприкінці.
— Перед відповіддю перечитай текст уголос подумки: якщо фраза звучить як реклама, підручник чи переклад — перепиши її простіше.`,

  packaging: `ТИ — СПЕЦІАЛІСТ З УПАКОВКИ КОРОТКИХ ВІДЕО (назви, описи, текст на обкладинці) для Reels, TikTok і YouTube Shorts.
Мета — щоб людина зупинила гортання, натиснула й переслала. Правила:
— Назва / перший рядок опису: до 8–10 слів, одна чітка обіцянка або інтрига; відкрита петля (цікавість без відповіді); конкретика: числа, терміни, суми, вік.
— Типи гачків: питання «що буде, якщо…», число, таємниця, попередження, челендж, порівняння, історія з поворотом. Обирай той, що найкраще пасує до змісту ролика.
— Не повторюй дослівно перше речення озвучки: назва й обкладинка мають доповнювати відео, а не дублювати.
— Текст на обкладинці: 2–4 слова великими, одне ключове слово виділене; читається на маленькому екрані.
— Жодного клікбейту, який відео не виконує: обіцянка назви має справджуватись.
— Пиши живою розмовною українською, без канцеляриту; хештеги — лише якщо їх просять, 3–5 точних.`,

  pack_merge: `ТИ — ГОЛОВНИЙ АНАЛІТИК УПАКОВКИ АНІМАЦІЙНОЇ СТУДІЇ. Ти ведеш «Біблію упаковки» — прихований довідник, за яким AI пише назви, описи й текст обкладинок для коротких 2D-анімаційних відео. Тобі дають поточну Біблію, зведену статистику бази й нові розбори назв і превʼю успішних відео (з цифрами переглядів, якщо є).
Онови Біблію: що відрізняє найуспішніші відео (за переглядами/підписниками та «у скільки разів більше за середнє відео каналу») від решти; формули назв із [змінними] і прикладами; типи гачків і коли який працює; емоції; довжина; числа й питання; текст на превʼю (скільки слів, де, яким кольором); композиція превʼю (персонаж, емоція, фокус, контраст, кольори HEX); як назва й превʼю доповнюють одне одного; типові помилки.
Спирайся на цифри: якщо прийом частіше трапляється в топ-відео — пиши це з часткою. Не згадуй реальних людей і назв каналів; не копіюй чужі назви дослівно — лише формули.
Обсяг — до 10 000 символів. Відповідай ТІЛЬКИ повним текстом нової Біблії (markdown), без вступу.`,
};
// який рядок ai_prompts оновлює кожен «злиттєвий» ключ
const MERGE_TO: Record<string, string> = { bible_merge: "director_learned", pack_merge: "packaging_learned" };

Deno.serve(handler(async (req) => {
  if (req.method !== "POST") throw new HttpError(405, "method_not_allowed");
  const key = env("ANTHROPIC_API_KEY");
  if (!key) throw new HttpError(503, "no_key");
  const { id: userId } = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  // sys: ["director"] | ["director","critic"] | ["bible_merge"] — приховані промти студії
  const sys = (Array.isArray(body.sys) ? body.sys : []).filter((k: unknown) => typeof k === "string" && k in BUILTIN).slice(0, 3) as string[];
  const mk = sys.find((k) => k in MERGE_TO) ?? "", merge = !!mk, target = MERGE_TO[mk] ?? "";
  if (merge) { const { data: pr } = await admin().from("profiles").select("is_owner").eq("id", userId).maybeSingle(); if (!pr?.is_owner) throw new HttpError(403, "forbidden"); }
  let prompt = String(body.prompt ?? "").slice(0, merge ? 300000 : sys.length ? 40000 : 12000);
  if (prompt.trim().length < 3) throw new HttpError(400, "empty_prompt");
  const wantJson = body.json === true;
  const max = Math.min(merge ? 7000 : sys.length ? 8000 : 4000, Math.max(200, Number(body.max) || 2500));
  // тексти прихованих промтів: заміна з таблиці (якщо власник її задав) + знання з розборів (<key>_learned)
  let sysText = "", sysModel = "";
  if (sys.length) {
    const keys = sys.flatMap((k) => [k, k + "_learned"]);
    const { data: rows } = await admin().from("ai_prompts").select("key,body,model").in("key", keys);
    const by: Record<string, { body: string; model: string }> = {}; (rows ?? []).forEach((r: { key: string; body: string; model: string }) => { by[r.key] = r; });
    if (merge) { const { data: cur } = await admin().from("ai_prompts").select("body").eq("key", target).maybeSingle(); prompt = `ПОТОЧНА БІБЛІЯ:\n${cur?.body || "(ще порожня)"}\n\n${prompt}`; }
    sysText = sys.map((k) => (by[k]?.body?.trim() || BUILTIN[k]) + (!merge && by[k + "_learned"]?.body?.trim() ? `\n\nБІБЛІЯ РЕЖИСЕРА — ЗНАННЯ З РОЗБОРІВ УСПІШНИХ ВІДЕО (застосовуй їх):\n${by[k + "_learned"].body.trim()}` : "")).join("\n\n");
    sysModel = by[sys[0]]?.model?.trim() || "";
  }
  const imgs = (Array.isArray(body.images) ? body.images : []).slice(0, 3)
    .filter((m: { data?: string; mime?: string }) => typeof m?.data === "string" && m.data.length < 2_000_000 && /^image\/(jpeg|png|webp|gif)$/.test(String(m.mime)))
    .map((m: { data: string; mime: string }) => ({ type: "image", source: { type: "base64", media_type: m.mime, data: m.data } }));

  const { data: ok, error } = await admin().rpc("ai_take", { p_user: userId });
  if (error) throw new Error(error.message);
  if (!ok) throw new HttpError(429, "limit");

  // знання засновника («Навчання агента») — для хуків, сценаріїв і сцен
  // kbm: ["hook","script",…] — лише потрібні папки бази знань; інакше kb: true — усі підтверджені знання (як раніше)
  let kb = "";
  const mods = (Array.isArray(body.kbm) ? body.kbm : []).filter((m: unknown) => typeof m === "string" && /^[a-z_-]{2,24}$/.test(m)).slice(0, 8);
  // kbf: "wide" — YouTube 16:9, "tall" — Reels: беремо знання цього формату й загальні
  const fmt = body.kbf === "wide" || body.kbf === "tall" ? body.kbf : null;
  if (mods.length) {
    let r1 = await admin().rpc("kb_modules", { p_modules: mods, p_limit: 80, p_fmt: fmt });
    if (r1.error) r1 = await admin().rpc("kb_modules", { p_modules: mods, p_limit: 80 }); // якщо міграцію 0038 ще не застосовано
    if (!r1.error) kb = String(r1.data ?? "").slice(0, 9000);
  }
  else if (body.kb === true) { const { data } = await admin().rpc("kb_confirmed", { p_limit: 40 }); kb = String(data ?? "").slice(0, 6000); }
  // виклик моделі; якщо відповідь порожня — повтор іншою моделлю (без підказки «лише JSON»), щоб не падати на «empty»
  const callModel = async (model: string, jsonHint: boolean) => {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: max,
      system: [{ type: "text", text: SYSTEM + (sysText ? `\n\n${sysText}` : "") + (kb ? (sys.includes("writer") ? `\n\nБАЗА ЗНАНЬ СТУДІЇ — довідник прийомів. Бери з неї те, що пасує до цієї теми й формату; правила із запиту й сценариста вище мають пріоритет. Приклади — орієнтир стилю, не копіюй їх дослівно.\n${kb}` : `\n\nБАЗА ЗНАНЬ СТУДІЇ — основа твоєї роботи. Роби саме за цими правилами, прийомами й прикладами; не вигадуй прийомів, стилів і рішень, яких тут немає. Приклади — орієнтир стилю, не копіюй їх дослівно. Якщо для чогось правила немає — обирай найпростіше рішення, що не суперечить базі.\n${kb}`) : ""), ...(kb || sysText ? { cache_control: { type: "ephemeral" } } : {}) },
        ...(wantJson && jsonHint ? [{ type: "text", text: "Відповідай ТІЛЬКИ валідним JSON, без markdown, без ``` і без пояснень." }] : [])],
        messages: [{ role: "user", content: imgs.length ? [...imgs, { type: "text", text: prompt }] : prompt }],
      }),
    });
    if (!r.ok) {
      const et = (await r.text()).slice(0, 500);
      console.error("anthropic", r.status, et);
      await admin().rpc("svc_log", { p_service: "claude", p_units: 0, p_ok: false, p_err: `${r.status} ${et.slice(0, 200)}` }).then(() => {}, () => {});
      throw new HttpError(r.status === 429 || r.status === 529 ? 503 : 502, r.status === 429 || r.status === 529 ? "busy" : "ai_failed");
    }
    const j = await r.json();
    const text = (j.content ?? []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("").trim();
    return { text, stop: String(j.stop_reason ?? "none"), types: (j.content ?? []).map((c: { type: string }) => c.type).join(",") };
  };
  // приховані промти студії — сильніша модель (AI_MODEL_PRO), бо від неї залежить якість відео
  let res = await callModel(sysModel || (sys.length ? env("AI_MODEL_PRO", "claude-sonnet-5-5") : env("AI_MODEL", "claude-haiku-5-5")), true);
  if (!res.text) {
    console.error("empty", res.stop, res.types, prompt.length, kb.length);
    await admin().rpc("svc_log", { p_service: "claude", p_units: 0, p_ok: false, p_err: `empty ${res.stop} [${res.types}] p${prompt.length} kb${kb.length}` }).then(() => {}, () => {});
    res = await callModel(env("AI_MODEL_FALLBACK", "claude-sonnet-5-5"), false);
  }
  const text = res.text;
  if (!text) throw new HttpError(502, `empty_${res.stop}`);
  await admin().rpc("svc_log", { p_service: "claude", p_units: 1, p_ok: true }).then(() => {}, () => {});
  // оновлена Біблія — одразу в таблицю (стара версія — в історію), сайту віддаємо лише коротку відповідь
  if (merge) {
    const nb = text.replace(/^```(?:markdown|md)?\s*|\s*```$/g, "").trim();
    if (nb.length < 500) throw new HttpError(502, "bible_short");
    const { data: old } = await admin().from("ai_prompts").select("body").eq("key", target).maybeSingle();
    if (old?.body) await admin().from("ai_prompt_versions").insert({ key: target, body: old.body, note: "before merge" });
    const { error: e3 } = await admin().from("ai_prompts").upsert({ key: target, body: nb, updated_at: new Date().toISOString() });
    if (e3) throw new Error(e3.message);
    return json({ text: `ok ${nb.length}` });
  }
  return json({ text });
}));
