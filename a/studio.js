/* YuVi · «Студія автора»: закриті інструменти власника (і друзів, яким він відкрив доступ).
   Переробка тексту відео → назви й прев'ю → опис і теги. Знання беруться з папок бази знань (додає лише власник). */
(() => {
  "use strict";
  const $ = (r, s) => r.querySelector(s);
  const H = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const say = (t) => { try { toast(t); } catch (e) {} };
  const track = (st, m) => { try { window.yvTrack?.("studio", st, m); } catch (e) {} };
  const wc = (t) => (String(t).match(/\S+/g) || []).length;
  const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); say("Скопійовано"); } catch (e) { say("Не вдалося скопіювати"); } };
  const load = (src) => new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = src + "?v=" + (window.YV_BUILD || Date.now()); sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
  const aiErr = (x) => x?.code === "rate_limited" || x?.message === "limit" ? "Ліміт AI на сьогодні вичерпано." : x?.code === "login" ? "" : "Не вийшло. Спробуй ще раз.";
  // спільна пам'ять між інструментами: перероблений текст іде в «Назви й прев'ю» і «Опис»
  const MEM = (() => { try { return JSON.parse(sessionStorage.getItem("yvStudio") || "{}"); } catch (e) { return {}; } })();
  const saveMem = () => { try { sessionStorage.setItem("yvStudio", JSON.stringify(MEM)); } catch (e) {} };

  const CSS = `
.stsheet h4{margin:14px 0 6px;font-size:14px}.stsheet .hint{display:block}
.stsheet .chip{font-family:var(--pfont);font-size:13.5px;font-weight:600;border:1px solid var(--p-line,rgba(255,255,255,.16));border-radius:999px;padding:7px 12px;background:var(--p-field);color:var(--p-text);cursor:pointer}
.stsheet .chip[aria-pressed=true],.stsheet .chip.ink{background:var(--p-text);color:var(--p-bg);border-color:transparent}
.stsheet .chips{display:flex;flex-wrap:wrap;gap:6px}
.stsheet .res{margin-top:14px;display:grid;gap:10px}
.stsheet .card{padding:12px;border-radius:14px;border:1px solid var(--p-line,rgba(255,255,255,.12));background:var(--p-field);display:grid;gap:6px}
.stsheet .card small{color:var(--p-muted)}.stsheet .card b{font-size:15px}
.stsheet .row2{display:flex;gap:6px;flex-wrap:wrap}
.stsheet .beats{margin:0;padding-left:18px;display:grid;gap:3px;font-size:14px}
.stsheet canvas.th{width:100%;border-radius:12px;display:block;background:#111}
.stsheet .thw{display:grid;gap:10px}.stsheet .thw.tall{grid-template-columns:repeat(3,1fr)}
.stsheet .acc{display:flex;align-items:center;gap:8px;justify-content:space-between;padding:10px 12px;border-radius:12px;border:1px solid var(--p-line,rgba(255,255,255,.12));margin-top:6px}
.stsheet .acc span{font-size:13px;color:var(--p-muted)}`;
  function sheet(title, html) {
    if (!document.getElementById("stcss")) { const st = document.createElement("style"); st.id = "stcss"; st.textContent = CSS; document.head.appendChild(st); }
    openSheet(`<div class="pshead"><h3>${title}</h3></div>${html}`, "plat stsheet"); return BS;
  }
  const chips = (key, opts, cur) => `<div class="chips">${opts.map(([v, n]) => `<button class="chip" type="button" data-${key}="${v}" aria-pressed="${String(cur) === String(v)}">${n}</button>`).join("")}</div>`;
  const pickChips = (root, key, set) => root.querySelectorAll(`[data-${key}]`).forEach((b) => b.onclick = () => { root.querySelectorAll(`[data-${key}]`).forEach((o) => o.setAttribute("aria-pressed", o === b)); set(b.dataset[key]); });
  // текст із файла: субтитри — без таймкодів, аудіо/відео — розпізнаємо
  async function fileText(f, st) {
    if (/^(audio|video)\//.test(f.type) || /\.(mp3|m4a|wav|mp4|mov|webm|ogg)$/i.test(f.name)) return kbTranscribe(f, (i, n) => st.textContent = `Розпізнаю «${f.name}»: ${i + 1} з ${n}…`);
    return String(await f.text()).replace(/^\d+\s*$/gm, "").replace(/^[\d:,.]+\s*-->\s*[\d:,.]+.*$/gm, "").replace(/^WEBVTT.*$/m, "").replace(/\n{3,}/g, "\n\n").trim();
  }

  /* ---------- 1. Переробка тексту відео ---------- */
  const DUR = [["orig", "Як в оригіналі"], ["30", "30 с"], ["60", "1 хв"], ["90", "1,5 хв"], ["180", "3 хв"], ["300", "5 хв"], ["600", "10 хв"]];
  const TONE = [["keep", "Зберегти стиль"], ["live", "Живіше, розмовно"], ["fun", "З гумором"], ["serious", "Серйозно"]];
  async function rewrite(src, o, onStage) {
    const en = o.lang === "en", wps = en ? 2.5 : 2.3, srcW = wc(src), target = o.dur === "orig" ? Math.min(1500, Math.max(40, Math.round(srcW * .92))) : Math.round(+o.dur * wps);
    // довгий оригінал: спершу стискаємо шматки в сюжетні кроки з усіма фактами
    let base = src;
    if (src.length > 9000) { const parts = kbChunks(src, 8500), beats = [];
      for (let i = 0; i < parts.length; i++) { onStage?.(`Читаю оригінал: ${i + 1} з ${parts.length}…`);
        const r = await sample.json(`Ось шматок ${i + 1} з ${parts.length} тексту відео:\n<<<\n${parts[i]}\n>>>\nСтисни його в послідовність сюжетних кроків своїми словами. Збережи ВСІ ключові факти, числа, імена, приклади, повороти й жарти. Відповідай тільки JSON {"beats":["…"]}`, { cache: false, max: 3000, quiet: true });
        beats.push(...(r?.beats || []).map(String)); }
      base = beats.map((b, i) => `${i + 1}. ${b}`).join("\n").slice(0, 9000); }
    onStage?.("Пишу свій варіант…");
    const r = await sample.json(`Ти сценарист YuVi. ${src.length > 9000 ? "Ось сюжетні кроки оригінального відео" : "Ось текст оригінального відео"}:
<<<
${base}
>>>
Перероби його в НОВИЙ текст для озвучки ${en ? "англійською мовою (природна розмовна англійська)" : "українською (жива розмовна, без канцеляриту)"}:
- збережи сценарій: ту саму послідовність подій, структуру, суть, ключові факти й числа, гачок на початку і фінал;
- пиши СВОЇМИ словами: не повторюй речення оригіналу; коротка ключова репліка-цитата — максимум одне речення;
- обсяг ≈ ${target} слів (${o.dur === "orig" ? "як оригінал" : "≈ " + fmtT(+o.dur)}), прибери воду й повтори;
- подача: ${{ keep: "збережи тон оригіналу", live: "живіше, розмовно, як другу", fun: "з легким гумором", serious: "серйозно, впевнено" }[o.tone]};
- перше речення — сильний гачок; без ремарок, хештегів, емодзі й заголовків у тексті.
Також дай title — робочу назву (до 70 знаків) і beats — 4–10 кроків сценарію одним рядком кожен.
Відповідай тільки JSON {"title":"…","beats":["…"],"text":"…"}`, { cache: false, kb: ["script", "story", "hook", "general"], ...(o.dur !== "orig" ? { kbFmt: +o.dur > 90 ? "wide" : "tall" } : {}), max: 4000, quiet: true });
    if (!r?.text) throw new Error("empty");
    return { title: String(r.title || ""), beats: (r.beats || []).map(String).slice(0, 12), text: String(r.text).trim(), lang: o.lang, dur: o.dur };
  }
  function openRewrite() {
    const O = { dur: "60", lang: "uk", tone: "keep", ...(MEM.rwOpt || {}) }; let files = [];
    const B = sheet("Переробка тексту відео", `<p class="hint">Встав текст оригінального відео або додай аудіо чи відео — отримаєш свій текст: той самий сценарій і суть, але своїми словами.</p>
      <textarea class="cpd" id="rwsrc" rows="7" placeholder="Встав текст оригіналу…">${H(MEM.rwSrc || "")}</textarea>
      <div class="chips" style="margin:8px 0"><label class="chip">📄 Текст, аудіо чи відео<input type="file" id="rwfile" accept=".txt,.md,.srt,.vtt,audio/*,video/*" hidden></label></div><p class="note" id="rwfl" style="margin:0"></p>
      <h4>Тривалість</h4>${chips("rd", DUR, O.dur)}<h4>Мова</h4>${chips("rl", [["uk", "Українська"], ["en", "Англійська"]], O.lang)}<h4>Подача</h4>${chips("rt", TONE, O.tone)}
      <button class="big" type="button" id="rwgo">Переробити</button><p class="status" id="rwst"></p><div class="res" id="rwres"></div>`);
    const st = $(B, "#rwst"), res = $(B, "#rwres"), ta = $(B, "#rwsrc");
    pickChips(B, "rd", (v) => O.dur = v); pickChips(B, "rl", (v) => O.lang = v); pickChips(B, "rt", (v) => O.tone = v);
    $(B, "#rwfile").onchange = (e) => { files = [...e.target.files]; e.target.value = ""; $(B, "#rwfl").textContent = files.map((f) => "📄 " + f.name).join(" · "); };
    const show = (R) => { const n = wc(R.text), sec = n / (R.lang === "en" ? 2.5 : 2.3);
      res.innerHTML = `<div class="card"><small>Назва</small><input class="cpd" id="rwt" value="${H(R.title)}"></div>
        ${R.beats.length ? `<div class="card"><small>Сценарій по кроках</small><ol class="beats">${R.beats.map((b) => `<li>${H(b)}</li>`).join("")}</ol></div>` : ""}
        <div class="card"><small>Текст · <span id="rwn">${n} слів · ≈ ${fmtT(sec)}</span></small><textarea class="cpd" id="rwtx" rows="12">${H(R.text)}</textarea>
          <div class="row2"><button class="chip" type="button" id="rwcp">Копіювати</button><button class="chip" type="button" id="rwagain">↻ Інший варіант</button></div></div>
        <button class="big" type="button" id="rwanim">Зробити анімацію з цього тексту</button>
        <div class="row2"><button class="chip ink" type="button" id="rwpack">Назви й прев'ю →</button><button class="chip ink" type="button" id="rwdesc">Опис і теги →</button></div>`;
      const tx = $(res, "#rwtx"), sync = () => { R.text = tx.value; R.title = $(res, "#rwt").value; MEM.rw = R; saveMem(); $(res, "#rwn").textContent = `${wc(R.text)} слів · ≈ ${fmtT(wc(R.text) / (R.lang === "en" ? 2.5 : 2.3))}`; };
      tx.oninput = sync; $(res, "#rwt").oninput = sync;
      $(res, "#rwcp").onclick = () => copy(tx.value);
      $(res, "#rwagain").onclick = () => $(B, "#rwgo").click();
      $(res, "#rwpack").onclick = () => openPack(); $(res, "#rwdesc").onclick = () => openDesc();
      $(res, "#rwanim").onclick = async () => { sync(); try { if (!window.YVTalk) await load("a/talk.js"); if (!window.YVLines) await load("a/lines.js"); } catch (e) { say("Не вдалося завантажити"); return; }
        closeSheet(); track("to_lines"); YVLines.open({ wide: +R.dur > 90 || (R.dur === "orig" && sec > 90), text: R.text, topic: R.title }); }; };
    if (MEM.rw?.text) show(MEM.rw);
    $(B, "#rwgo").onclick = async (e) => { const b = e.currentTarget; let src = ta.value.trim(); b.disabled = true; st.className = "status";
      try { for (const f of files) src += (src ? "\n\n" : "") + await fileText(f, st);
        if (wc(src) < 15) { say("Встав текст оригіналу або додай файл"); b.disabled = false; return; }
        MEM.rwSrc = src.slice(0, 60000); MEM.rwOpt = O; saveMem(); files = []; $(B, "#rwfl").textContent = ""; ta.value = MEM.rwSrc;
        const R = await rewrite(src, O, (t) => st.textContent = t); MEM.rw = R; saveMem(); st.textContent = ""; track("rewrite", { v: `${O.dur}|${O.lang}|${O.tone}` }); show(R); }
      catch (x) { console.error(x); st.className = "status err"; st.textContent = aiErr(x); }
      b.disabled = false; };
  }

  /* ---------- 2. Назви й прев'ю (на прикладах із папок «Назви» і «Прев'ю») ---------- */
  function openPack() {
    const O = { fmt: "wide", lang: MEM.rw?.lang || "uk", ...(MEM.pkOpt || {}) };
    const B = sheet("Назви й прев'ю", `<p class="hint">Опиши, про що відео, або візьми текст з «Переробки». Вийде 3 назви й 3 прев'ю — на основі твоїх прикладів.</p>
      <textarea class="cpd" id="pksrc" rows="5" placeholder="Про що відео: тема або текст">${H(MEM.rw?.text ? (MEM.rw.title ? MEM.rw.title + "\n\n" : "") + MEM.rw.text : MEM.pkSrc || "")}</textarea>
      <h4>Формат прев'ю</h4>${chips("pf", [["wide", "YouTube 16:9"], ["tall", "Reels / Shorts 9:16"]], O.fmt)}<h4>Мова</h4>${chips("pl", [["uk", "Українська"], ["en", "Англійська"]], O.lang)}
      <button class="big" type="button" id="pkgo">Згенерувати</button><p class="status" id="pkst"></p><div class="res" id="pkres"></div>`);
    const st = $(B, "#pkst"), res = $(B, "#pkres");
    pickChips(B, "pf", (v) => O.fmt = v); pickChips(B, "pl", (v) => O.lang = v);
    const draw = (R) => { const wide = R.fmt !== "tall", [w, h] = wide ? [1280, 720] : [1080, 1920];
      res.innerHTML = `<h4 style="margin:4px 0 0">Назви</h4>${R.titles.map((t, i) => `<div class="card"><b>${H(t.t)}</b>${t.why ? `<small>${H(t.why)}</small>` : ""}<div class="row2"><button class="chip" type="button" data-cpt="${i}">Копіювати</button></div></div>`).join("")}
        <h4 style="margin:8px 0 0">Прев'ю</h4><div class="thw${wide ? "" : " tall"}">${R.thumbs.map((c, i) => `<div class="card" style="padding:8px"><canvas class="th" width="${w}" height="${h}" data-th="${i}"></canvas><small>${H(c.scene || "")}</small><div class="row2"><button class="chip" type="button" data-dl="${i}">Зберегти</button><button class="chip" type="button" data-rs="${i}">Інший стиль</button></div></div>`).join("")}</div>
        <button class="chip ink" type="button" id="pkdesc" style="justify-self:start">Опис і теги →</button>`;
      const render = (i) => { const cv = res.querySelector(`[data-th="${i}"]`); try { YVLines.thumb(cv, { ...R.thumbs[i], wide }); } catch (e) { console.warn(e); } };
      R.thumbs.forEach((_, i) => render(i)); setTimeout(() => R.thumbs.forEach((_, i) => render(i)), 1200);
      res.querySelectorAll("[data-cpt]").forEach((b) => b.onclick = () => copy(R.titles[+b.dataset.cpt].t));
      res.querySelectorAll("[data-rs]").forEach((b) => b.onclick = () => { const c = R.thumbs[+b.dataset.rs], L = YVLines.presets(); c.style = L[(L.indexOf(c.style) + 1 + Math.floor(Math.random() * 3)) % L.length]; render(+b.dataset.rs); });
      res.querySelectorAll("[data-dl]").forEach((b) => b.onclick = () => { const cv = res.querySelector(`[data-th="${b.dataset.dl}"]`); cv.toBlob(async (bl) => { const f = new File([bl], `yuvi_preview_${+b.dataset.dl + 1}.png`, { type: "image/png" });
        try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f] }); return; } } catch (e) { if (e?.name === "AbortError") return; }
        const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); }, "image/png"); });
      $(res, "#pkdesc").onclick = () => openDesc(); };
    if (MEM.pk) { (window.YVLines ? Promise.resolve() : load("a/lines.js")).then(() => draw(MEM.pk)).catch(() => {}); }
    $(B, "#pkgo").onclick = async (e) => { const b = e.currentTarget, src = $(B, "#pksrc").value.trim(); if (wc(src) < 2) { say("Напиши, про що відео"); return; } b.disabled = true; st.className = "status"; st.textContent = "Думаю над назвами…";
      try { if (!window.YVLines) await load("a/lines.js"); MEM.pkSrc = src.slice(0, 20000); MEM.pkOpt = O; saveMem();
        const P = YVLines.presets(), en = O.lang === "en";
        const r = await sample.json(`Ти пакуєш відео для ${O.fmt === "wide" ? "YouTube" : "Reels / Shorts / TikTok"}. Про відео:
<<<
${src.slice(0, 7000)}
>>>
Спирайся на приклади назв і прев'ю з бази знань (стиль, довжина, прийоми), але НЕ копіюй їх.
titles — 3 різні назви ${en ? "англійською" : "українською"} до 70 знаків: інтрига або конкретна вигода, число чи несподіванка, без брехні й без капсу на все речення; why — чому клікнуть (до 80 знаків).
thumbs — 3 різні прев'ю. Кожне: text — 2–4 слова великим текстом на прев'ю ${en ? "англійською" : "українською"} (не повторює назву дослівно); scene — що в кадрі одним реченням; who — man|woman|girl|boy|grandma|grandpa; emo — shock|cheer|think|sad|happy|point; prop — один предмет англійським словом (money, phone, laptop, rocket, clock…); color — yellow|green|red|blue; style — один з: ${P.join(", ")}.
Відповідай тільки JSON {"titles":[{"t":"…","why":"…"}],"thumbs":[{"text":"…","scene":"…","who":"man","emo":"shock","prop":"money","color":"yellow","style":"youtube"}]}`, { cache: false, kb: ["title", "thumb", "hook", "niche"], kbFmt: O.fmt === "wide" ? "wide" : "tall", max: 2000, quiet: true });
        const R = { fmt: O.fmt, titles: (r?.titles || []).filter((t) => t?.t).slice(0, 3).map((t) => ({ t: String(t.t).slice(0, 100), why: String(t.why || "").slice(0, 120) })),
          thumbs: (r?.thumbs || []).filter((c) => c?.text).slice(0, 3).map((c, i) => ({ text: String(c.text).slice(0, 40), scene: String(c.scene || "").slice(0, 160), who: String(c.who || "man"), emo: String(c.emo || "shock"), prop: String(c.prop || "").slice(0, 30), color: String(c.color || "yellow"), style: P.includes(c.style) ? c.style : P[i % P.length] })) };
        if (!R.titles.length) throw new Error("empty"); MEM.pk = R; saveMem(); st.textContent = ""; track("pack", { v: O.fmt }); draw(R); }
      catch (x) { console.error(x); st.className = "status err"; st.textContent = aiErr(x); }
      b.disabled = false; };
  }

  /* ---------- 3. Опис і теги (на прикладах із папки «Опис і теги») ---------- */
  function openDesc() {
    const O = { lang: MEM.rw?.lang || "uk", ...(MEM.dsOpt || {}) }, title = MEM.pk?.titles?.[0]?.t || MEM.rw?.title || "";
    const B = sheet("Опис і теги", `<p class="hint">Назва й текст відео — і отримаєш опис для YouTube з тегами та короткий підпис для Reels / TikTok з хештегами, у стилі твоїх прикладів.</p>
      <input class="cpd" id="dst" placeholder="Назва відео" value="${H(title)}"><textarea class="cpd" id="dssrc" rows="5" placeholder="Текст або коротко, про що відео" style="margin-top:6px">${H(MEM.rw?.text || MEM.dsSrc || "")}</textarea>
      <h4>Мова</h4>${chips("dl", [["uk", "Українська"], ["en", "Англійська"]], O.lang)}
      <button class="big" type="button" id="dsgo">Написати</button><p class="status" id="dsst"></p><div class="res" id="dsres"></div>`);
    const st = $(B, "#dsst"), res = $(B, "#dsres"); pickChips(B, "dl", (v) => O.lang = v);
    const draw = (R) => { const yt = R.yt.description + "\n\n" + R.yt.hashtags.join(" "), sh = R.short.caption + "\n\n" + R.short.hashtags.join(" ");
      res.innerHTML = `<div class="card"><small>YouTube — опис</small><textarea class="cpd" rows="8" id="dsyt">${H(yt)}</textarea><div class="row2"><button class="chip" type="button" id="cpyt">Копіювати опис</button></div></div>
        <div class="card"><small>YouTube — теги (через кому)</small><textarea class="cpd" rows="3" id="dstg">${H(R.yt.tags.join(", "))}</textarea><div class="row2"><button class="chip" type="button" id="cptg">Копіювати теги</button></div></div>
        <div class="card"><small>Reels / Shorts / TikTok — підпис</small><textarea class="cpd" rows="5" id="dssh">${H(sh)}</textarea><div class="row2"><button class="chip" type="button" id="cpsh">Копіювати підпис</button></div></div>`;
      $(res, "#cpyt").onclick = () => copy($(res, "#dsyt").value); $(res, "#cptg").onclick = () => copy($(res, "#dstg").value); $(res, "#cpsh").onclick = () => copy($(res, "#dssh").value); };
    if (MEM.ds) draw(MEM.ds);
    $(B, "#dsgo").onclick = async (e) => { const b = e.currentTarget, t = $(B, "#dst").value.trim(), src = $(B, "#dssrc").value.trim(); if (wc(t + " " + src) < 3) { say("Додай назву або текст"); return; } b.disabled = true; st.className = "status"; st.textContent = "Пишу…";
      try { MEM.dsSrc = src.slice(0, 20000); MEM.dsOpt = O; saveMem(); const en = O.lang === "en";
        const r = await sample.json(`Назва відео: «${t}». Про що:\n<<<\n${src.slice(0, 7000)}\n>>>
Напиши ${en ? "англійською" : "українською"}, у стилі прикладів з бази знань (довжина, структура, тон), не копіюючи їх:
yt.description — опис для YouTube: перші 2 рядки — гачок з головною вигодою (їх видно до «ще»), далі 3–6 коротких рядків про зміст і заклик (підписатися/коментар); без вигаданих посилань і таймкодів;
yt.hashtags — 3 хештеги; yt.tags — 10–15 пошукових тегів (фрази, як люди шукають);
short.caption — підпис для Reels/Shorts/TikTok до 150 знаків з гачком і питанням до глядача; short.hashtags — 4–6 хештегів.
Відповідай тільки JSON {"yt":{"description":"…","hashtags":["#…"],"tags":["…"]},"short":{"caption":"…","hashtags":["#…"]}}`, { cache: false, kb: ["desc", "niche", "general"], max: 2000, quiet: true });
        const tagify = (a) => (Array.isArray(a) ? a : []).map((h) => "#" + String(h).replace(/^#+/, "").replace(/\s+/g, "")).filter((h) => h.length > 1).slice(0, 8);
        const R = { yt: { description: String(r?.yt?.description || "").trim(), hashtags: tagify(r?.yt?.hashtags), tags: (r?.yt?.tags || []).map(String).slice(0, 20) }, short: { caption: String(r?.short?.caption || "").trim(), hashtags: tagify(r?.short?.hashtags) } };
        if (!R.yt.description && !R.short.caption) throw new Error("empty"); MEM.ds = R; saveMem(); st.textContent = ""; track("desc"); draw(R); }
      catch (x) { console.error(x); st.className = "status err"; st.textContent = aiErr(x); }
      b.disabled = false; };
  }

  /* ---------- 4. Доступи (лише власник) ---------- */
  const TN = { rewrite: "Переробка тексту", pack: "Назви й прев'ю", desc: "Опис і теги" };
  function openAccess() {
    const B = sheet("Доступи до студії", `<p class="hint">Друг реєструється на сайті — ти вводиш його пошту й відмічаєш, які інструменти відкрити. Друзі лише користуються: додавати знання й приклади можеш тільки ти.</p>
      <input class="cpd" id="acem" type="email" placeholder="Пошта друга (як у його акаунті)" autocomplete="off">
      <div class="chips" style="margin:8px 0">${Object.entries(TN).map(([k, n]) => `<button class="chip" type="button" data-at="${k}" aria-pressed="true">${n}</button>`).join("")}</div>
      <button class="big" type="button" id="acgo">Відкрити доступ</button><p class="status" id="acst"></p><h4>Мають доступ</h4><div id="aclist"><p class="status">Завантажую…</p></div>`);
    const st = $(B, "#acst"), list = $(B, "#aclist");
    B.querySelectorAll("[data-at]").forEach((b) => b.onclick = () => b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true"));
    const refresh = async () => { let L = []; try { L = await SRV.studioList(); } catch (x) { list.innerHTML = `<p class="status err">Спершу запусти в Supabase крок «Студія автора».</p>`; return; }
      list.innerHTML = L.length ? L.map((u) => `<div class="acc"><div><b style="font-size:14px">${H(u.email)}</b><br><span>${(u.tools || []).map((t) => TN[t] || t).join(" · ")}</span></div><button class="chip" type="button" data-rv="${u.user_id}">Забрати</button></div>`).join("") : `<p class="note">Поки нікому.</p>`;
      list.querySelectorAll("[data-rv]").forEach((b) => b.onclick = async () => { try { await SRV.studioRevoke(b.dataset.rv); refresh(); } catch (x) { say("Не вдалося"); } }); };
    $(B, "#acgo").onclick = async () => { const em = $(B, "#acem").value.trim(), tools = [...B.querySelectorAll("[data-at]")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.dataset.at);
      if (!/@/.test(em)) { say("Введи пошту"); return; } st.className = "status"; st.textContent = "";
      try { await SRV.studioGrant(em, tools); $(B, "#acem").value = ""; st.textContent = tools.length ? "Доступ відкрито ✓" : "Доступ забрано"; refresh(); }
      catch (x) { st.className = "status err"; st.textContent = /no_user/.test(x.message) ? "Такого акаунта ще немає — хай друг спершу зареєструється на сайті." : /function|does not exist/.test(x.message) ? "Спершу запусти в Supabase крок «Студія автора»." : "Не вдалося."; } };
    refresh();
  }

  window.YVStudio = { open(k) { track("open_" + k); ({ rewrite: openRewrite, pack: openPack, desc: openDesc, access: openAccess }[k] || openRewrite)(); } };
})();
