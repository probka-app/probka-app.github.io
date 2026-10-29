/* Probka: з'єднання конструктора з сервером (Supabase).
   Підключається лише у версії сайту на хостингу. Усередині Claude сайт працює в тестовому режимі без цього файлу.
   Порядок підключення в index.html: config -> supabase-js -> server.js -> основний скрипт. */
(() => {
  // Тестовий показ: studio.yuvi.life/?demo (або ?preview) — сайт працює без сервера, як демо: без реєстрації, нічого не зберігається.
  // Вийти з показу: ?live
  try {
    const q = location.search;
    // Показ живе тільки в цій вкладці (sessionStorage): закрив вкладку або відкрив адресу заново — звичайний сайт.
    if (localStorage.getItem("yvDemo")) { localStorage.removeItem("yvDemo"); localStorage.removeItem("rilsWallet"); }
    if (/[?&](demo|preview)\b/.test(q)) sessionStorage.setItem("yvDemo", "1");
    if (/[?&]live\b/.test(q)) { sessionStorage.removeItem("yvDemo"); sessionStorage.removeItem("rilsWalletDemo"); }
    if (sessionStorage.getItem("yvDemo") === "1") { window.YV_DEMO = true; return; }
  } catch (e) {}
  const CFG = window.PROBKA_CONFIG;
  const sb = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "implicit" } });
  const FN = `${CFG.url}/functions/v1`;
  const ls = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} } };
  const kop = (v) => (v || 0) / 100;

  // --- партнерський код з посилання ?ref=ABC123 ---
  const qs = new URLSearchParams(location.search);
  if (qs.get("ref")) ls.set("probkaRef", qs.get("ref").toUpperCase());

  // --- «збереження у файли» поза Claude: на телефоні — меню «Поділитися» (там є «Зберегти відео»), на комп'ютері — звичайне завантаження ---
  const downloadsShim = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (navigator.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
        try { await navigator.share({ files: [file] }); return { status: "saved" }; } catch (e) { if (e?.name === "AbortError") throw { code: "declined" }; }
      }
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
      return { status: "saved" };
    },
  };
  // --- генерація текстів поза Claude: той самий інтерфейс sample(), але через функцію ai-text на сервері ---
  const busy = (kind, fn, quiet) => { if (quiet || !window.yvBusy) return fn(); window.yvBusy.start(kind); let ok = false; return Promise.resolve().then(fn).then((v) => { ok = true; return v; }).finally(() => window.yvBusy.end(ok)); };
  async function aiText(prompt, opts, asJson) {
    if (!SRV.session) { loginSheet("Щоб генерувати тексти, увійди або зареєструйся."); throw { code: "login" }; }
    return busy("text", () => aiTextRaw(prompt, opts, asJson), opts?.quiet);
  }
  async function aiTextRaw(prompt, opts, asJson) {
    let r;
    try {
      r = await fetch(`${FN}/ai-text`, { method: "POST", signal: opts?.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${SRV.session.access_token}`, apikey: CFG.key },
        body: JSON.stringify({ prompt, json: !!asJson, max: opts?.max, kb: !!opts?.kb }) });
    } catch (e) { if (e?.name === "AbortError") throw { code: "cancelled" }; throw { code: "network" }; }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw { code: { limit: "rate_limited", busy: "busy", no_key: "no_key" }[j.error] || "server", message: j.error };
    return j.text || "";
  }
  // якщо відповідь обрізалась посередині (довгий JSON) — відрізаємо незавершений елемент і закриваємо дужки
  function repairJson(t) {
    const closersFor = (pre) => { const st = []; let inS = false, esc = false;
      for (const ch of pre) { if (inS) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inS = false; continue; }
        if (ch === '"') inS = true; else if (ch === "{" || ch === "[") st.push(ch); else if (ch === "}" || ch === "]") st.pop(); }
      return inS ? null : st.reverse().map((c) => (c === "{" ? "}" : "]")).join(""); };
    let pos = t.length;
    for (let k = 0; k < 80; k++) {
      pos = t.lastIndexOf("}", pos - 1); if (pos < 0) break;
      const pre = t.slice(0, pos + 1), cl = closersFor(pre); if (cl == null) continue;
      try { return JSON.parse(pre + cl); } catch (e) {}
    }
    return undefined;
  }
  const sampleShim = Object.assign(async (prompt, opts = {}) => {
    const text = await aiText(prompt, opts, false); opts.onText?.({ text }); return { text };
  }, {
    json: async (prompt, opts = {}) => {
      const t = (await aiText(prompt, { ...opts, max: 4000 }, true)).replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
      const a = Math.min(...["[", "{"].map((c) => { const i = t.indexOf(c); return i < 0 ? Infinity : i; }));
      const b = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
      try { return JSON.parse(a === Infinity ? t : t.slice(a, b + 1)); } catch (e) {}
      const fixed = repairJson(a === Infinity ? t : t.slice(a));
      if (fixed !== undefined) return fixed;
      throw { code: "invalid_json" };
    },
  });
  window.claude = window.claude || { use: async (cap) => (cap === "downloads" ? downloadsShim : cap === "sample" ? sampleShim : null) };

  // --- стан ---
  const SRV = { me: null, session: null };
  window.SRV = SRV;

  async function rpc(name, args) { const { data, error } = await sb.rpc(name, args); if (error) throw new Error(error.message); return data; }
  async function call(fn, body) {
    const t = SRV.session?.access_token;
    const r = await fetch(`${FN}/${fn}`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}`, apikey: CFG.key }, body: JSON.stringify(body || {}) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `http_${r.status}`);
    return j;
  }

  SRV.refresh = async () => {
    if (!SRV.session) { SRV.me = null; if (typeof WL !== "undefined") { for (const k of Object.keys(WL)) delete WL[k]; Object.assign(WL, { balance: 0, pending: 0, total: 0, req: null, history: [], unlocked: {}, saved: 0, refs: 0, vesting: [], passPeople: 0, held: 0 }); ls.set("rilsWallet", null); window.renderBal?.(); } return; }
    try {
      const me = await rpc("me");
      SRV.me = me;
      WL.balance = kop(me.available_kop); WL.pending = kop(me.pending_kop); WL.total = kop(me.earned_kop); WL.refs = me.refs_total;
      WL.unlocked = me.active ? { marker: true } : {};
      sb.rpc("is_owner").then(({ data }) => { SRV.isOwner = !!data; window.applyUIF?.(); });
      sb.rpc("is_admin").then(async ({ data }) => { SRV.isAdmin = !!data;
        if (data) { try { const f = await SRV.adminFailed(); const day = new Date().toDateString(); if (f.length && ls.get("yvFailSeen") !== day) { ls.set("yvFailSeen", day); setTimeout(() => toast(`⚠ Виплати не пройшли: ${f.length}. Деталі — у панелі власника`), 1500); } } catch (e) {} } });
      sb.rpc("test_paid").then(({ data, error }) => { SRV.testReady = !error; if (typeof TEST !== "undefined" && data != null) { TEST.paid = !!data; localStorage.setItem("rilsTestPaid", JSON.stringify(!!data)); window.renderTest?.(); } });
      WL.vesting = me.vesting || []; WL.srvT = Date.parse(me.server_time) || 0; WL.cliT = Date.now(); WL.passPeople = me.passive_people || 0;
      WL.held = kop(me.held_kop); WL.heldUntil = me.held_until || null;
      // нові зарахування за перші оплати → анімація «+200 грн» на головній
      const firsts = (me.history || []).filter((h) => h.kind === "ref_first" && h.amount_kop > 0);
      const seen = ls.get("rilsSeenCredit") ? JSON.parse(ls.get("rilsSeenCredit")) : null;
      if (!seen) { const top = firsts.map((h) => h.created_at).sort().pop(); localStorage.setItem("rilsSeenCredit", JSON.stringify(top || new Date().toISOString())); }
      else { const fresh = firsts.filter((h) => h.created_at > seen).sort((a, b) => a.created_at.localeCompare(b.created_at));
        if (fresh.length && typeof addCredits === "function") { WL.balance = WL.balance; addCredits(fresh.map((h) => ({ key: h.created_at + "|" + h.amount_kop, amount_kop: h.amount_kop, created_at: h.created_at }))); } }
      window.renderBal?.(); window.renderTop?.(); window.renderSubs?.();
    } catch (e) { console.warn("me", e); }
  };
  SRV.refCode = () => SRV.me?.ref_code || "";

  // --- профіль ---
  SRV.saveProfile = async (nickname, phone) => { try { await rpc("set_profile", { p_nickname: nickname, p_phone: phone }); } catch (x) { throw new Error({ nick_taken: "Цей нік уже зайнятий — спробуй інший.", phone_taken: "Цей номер уже прив'язаний до іншого акаунта.", bad_nick: "Нік — від 2 до 30 символів: літери, цифри, крапка, підкреслення.", bad_phone: "Перевір номер телефону.", nick_too_long: "Нік задовгий." }[x.message] || "Не вдалося зберегти. Спробуй ще раз."); } await SRV.refresh(); };

  // --- бібліотека відео ---
  const uid = () => SRV.session?.user?.id;
  const fromRow = (r) => ({ vid: r.vid, title: r.title || "", thumb: r.thumb || "", stats: r.stats || {}, note: r.note || "", created: Date.parse(r.created_at) || Date.now(), updated: Date.parse(r.updated_at) || 0 });
  const toRow = (it) => ({ user_id: uid(), vid: it.vid, title: it.title || "", thumb: (it.thumb || "").length < 60000 ? it.thumb || null : null, stats: it.stats || {}, note: it.note || null,
    created_at: new Date(it.created || Date.now()).toISOString(), updated_at: new Date(it.updated || Date.now()).toISOString() });
  SRV.libSave = async (it) => { if (!uid()) return; const { error } = await sb.from("library").upsert(toRow(it)); if (error) console.warn("lib save", error); };
  SRV.libDel = async (vid) => { if (!uid()) return; await sb.from("library").delete().eq("user_id", uid()).eq("vid", vid); };
  SRV.libSync = async () => {
    if (!uid() || typeof LIB === "undefined") return false;
    const { data, error } = await sb.from("library").select("*");
    if (error) { console.warn("lib sync", error); return false; }
    const remote = (data || []).map(fromRow), byVid = new Map(remote.map((r) => [r.vid, r]));
    LIB.merge(remote);
    for (const it of LIB.items) { const r = byVid.get(it.vid); if (!r || (it.updated || 0) > (r.updated || 0)) SRV.libSave(it); } // локальні новіші — на сервер
    return true;
  };

  // --- аналітика ---
  SRV.payoutMethod = async () => { try { return (await rpc("payout_info"))?.method || null; } catch (e) { return null; } };
  SRV.earnings = async (from, to) => (await rpc("earnings_daily", { p_from: from, p_to: to })) || [];
  SRV.accSave = async (platform, day, views) => { if (!uid()) return; const { error } = await sb.from("account_stats").upsert({ user_id: uid(), platform, day, views, updated_at: new Date().toISOString() }); if (error) console.warn("acc save", error); };
  SRV.accDel = async (platform, day) => { if (!uid()) return; await sb.from("account_stats").delete().eq("user_id", uid()).eq("platform", platform).eq("day", day); };
  SRV.accSync = async () => {
    if (!uid() || typeof ACC === "undefined") return false;
    const { data, error } = await sb.from("account_stats").select("platform,day,views");
    if (error) { console.warn("acc sync", error); return false; }
    const remote = {}; for (const r of data || []) { (remote[r.platform] = remote[r.platform] || {})[r.day] = r.views; }
    for (const p of Object.keys(ACC.data)) for (const day of Object.keys(ACC.data[p])) if (remote[p]?.[day] == null) SRV.accSave(p, day, ACC.data[p][day]);
    for (const p of Object.keys(remote)) ACC.data[p] = { ...(ACC.data[p] || {}), ...remote[p] };
    ACC.save(); return true;
  };

  // --- розпізнавання скріншотів статистики ---
  async function shrink(file) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1500 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    const b64 = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
    return { type: "image/jpeg", data: b64 };
  }
  SRV.extract = async (files, mode) => {
    const images = [];
    for (const f of files) { try { images.push(await shrink(f)); } catch (e) {} }
    if (!images.length) throw new Error("no_images");
    const d = new Date(), today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const j = await call("stats-extract", { images, mode: mode || "video", today });
    return mode === "account" ? j.account || {} : j.stats || {};
  };

  SRV.publicStats = async () => { const { data, error } = await sb.rpc("public_stats"); if (error) throw error; return data; };

  // --- ідеї та голосування ---
  SRV.ideas = async () => (await rpc("ideas_list")) || [];
  SRV.ideaAdd = async (t) => rpc("idea_add", { p_text: t });
  SRV.ideaVote = async (id) => rpc("idea_vote", { p_id: id });
  SRV.adminIdeas = async () => (await rpc("admin_ideas")) || [];
  SRV.adminIdeaSave = async (id, o) => rpc("admin_idea_save", { p_id: id, p_status: o.status, p_title: o.title ?? null, p_descr: o.descr ?? null, p_note: o.note ?? null });
  SRV.adminIdeaCreate = async (o) => rpc("admin_idea_create", { p_title: o.title, p_descr: o.descr || "", p_status: o.status || "planned" });
  SRV.uiFlags = async () => { try { const { data } = await sb.rpc("ui_flags"); return data || null; } catch (e) { return null; } };
  SRV.setFlag = async (k, on) => rpc("owner_set_flag", { p_key: k, p_on: !!on });
  SRV.soon = async () => { try { const { data } = await sb.rpc("ideas_soon"); return data || []; } catch (e) { return []; } };
  SRV.adminVisits = async () => rpc("admin_visits", { p_limit: 100 });
  SRV.adminPayoutFailed = async (id) => rpc("admin_payout_failed", { p_id: id });
  SRV.adminMonthly = async () => rpc("admin_monthly_payouts");
  SRV.adminAudit = async (from, to) => (await rpc("admin_audit", { p_from: from, p_to: to })) || [];
  SRV.adminAuditCheck = async () => rpc("admin_audit_check");
  SRV.adminFailed = async () => (await rpc("admin_failed_payouts")) || [];
  SRV.ownerAnalytics = async (days) => rpc("admin_analytics", { p_days: days || 30 });
  SRV.leaderboard = async (period) => rpc("leaderboard", { p_period: period || null });
  SRV.setHideRating = async (hide) => rpc("set_hide_rating", { p_hide: !!hide });
  SRV.adminIdeaSet = async (id, st, note) => rpc("admin_idea_set", { p_id: id, p_status: st, p_note: note ?? null });

  // --- панель власника ---
  SRV.isAdmin = false;
  SRV.adminStats = async (days) => rpc("admin_stats", { p_days: days || 30 });
  SRV.adminSetPayout = async (id, status) => rpc("admin_set_payout", { p_id: id, p_status: status });
  SRV.payoutsCsv = async () => {
    const r = await fetch(`${FN}/payouts-csv`, { method: "POST", headers: { Authorization: `Bearer ${SRV.session?.access_token}`, apikey: CFG.key } });
    if (!r.ok) throw new Error("csv");
    const blob = await r.blob(), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `vyplaty_${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove();
  };

  // --- генерація картинок (функція image-gen, ключ Gemini у секретах Supabase) ---
  SRV.genImage = async (o) => {
    if (!SRV.session) { loginSheet("Щоб створювати картинки, увійди або зареєструйся."); throw new Error("login"); }
    return busy("image", () => call("image-gen", o), o?.quiet);
  };
  SRV.imgLeft = async () => { try { return SRV.session ? await rpc("img_left") : null; } catch (e) { return null; } };
  // --- тарифи, ліміти, пакети ---
  SRV.quota = async () => { try { return SRV.session ? await rpc("quota_info") : null; } catch (e) { return null; } };
  // --- озвучка ---
  SRV.voices = async () => { try { const { data } = await sb.rpc("voices_list"); return data || []; } catch (e) { return []; } };
  SRV.tts = async (o) => {
    if (!SRV.session) { loginSheet("Щоб озвучувати, увійди або зареєструйся."); throw new Error("login"); }
    return busy("voice", () => call("tts", o), o?.quiet);
  };
  // --- обробка на сервері: сховище і завдання ---
  SRV.upload = async (rel, blob) => {
    const u = uid(); if (!u) throw new Error("login");
    const path = `${u}/${rel}`;
    const { error } = await sb.storage.from("media").upload(path, blob, { upsert: true, contentType: blob.type || "application/octet-stream" });
    if (error) throw new Error(/exceed|too large|413|size/i.test(error.message || "") ? "too_big" : "upload_failed");
    return path;
  };
  SRV.job = async (kind, input) => { try { return await rpc("job_create", { p_kind: kind, p_input: input }); } catch (x) { throw new Error(x.message); } };
  SRV.jobGet = async (id) => rpc("job_get", { p_id: id });
  SRV.montageLeft = async () => { try { return await rpc("montage_left"); } catch (e) { return null; } };
  SRV.consentVoice = async () => { try { await rpc("log_consent", { p_doc: "voice", p_ver: "2026-10-29" }); return true; } catch (e) { return false; } };
  SRV.myClone = async () => { try { return SRV.session ? await rpc("my_clone") : null; } catch (e) { return null; } };
  SRV.clone = async (o) => call("voice-clone", o);
  // --- власник ---
  SRV.voicesAdmin = async (o) => call("voices-admin", o);
  SRV.adminVoices = async () => (await rpc("admin_voices")) || [];
  SRV.adminVoiceSave = async (v) => rpc("admin_voice_save", { p_id: v.id || null, p_provider: v.provider || "elevenlabs", p_voice_id: v.voice_id || "", p_name: v.name, p_descr: v.descr || "", p_gender: v.gender || "", p_preview: v.preview || "", p_sort: v.sort ?? 0, p_enabled: v.enabled !== false });
  SRV.adminVoiceDel = async (id) => rpc("admin_voice_del", { p_id: id });
  SRV.services = async (days) => rpc("admin_services", { p_days: days || 30 });
  SRV.kvGet = async (k) => rpc("owner_kv_get", { p_key: k });
  SRV.kvSet = async (k, v) => rpc("owner_kv_set", { p_key: k, p_value: v });
  SRV.setPrices = async (o) => rpc("owner_set_prices", { p_studio: o.studio ?? null, p_studio_early: o.early ?? null, p_pack_voice: o.voice ?? null, p_pack_img: o.img ?? null });
  SRV.kbList = async () => (await rpc("kb_list")) || [];
  SRV.kbSet = async (id, o) => rpc("kb_set", { p_id: id, p_status: o.status ?? null, p_title: o.title ?? null, p_body: o.body ?? null, p_why: o.why ?? null, p_how: o.how ?? null, p_kind: o.kind ?? null, p_niche: o.niche ?? null });
  SRV.kbChatList = async () => (await rpc("kb_chat_list", { p_limit: 60 })) || [];
  SRV.kbChat = async (message) => busy("text", () => call("kb-chat", { message }));

  // --- вхід посиланням на пошту ---
  // --- вхід: пошта або телефон + пароль; реєстрація з ніком; «забули пароль» — посилання на пошту ---
  const HERE = () => location.origin + location.pathname;
  const isMail = (v) => /@/.test(v);
  const eye = (id) => `<button class="pweye" type="button" data-eye="${id}" aria-label="Показати пароль"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>`;
  const wireEyes = () => BS.querySelectorAll("[data-eye]").forEach((b) => (b.onclick = () => { const i = BS.querySelector("#" + b.dataset.eye); i.type = i.type === "password" ? "text" : "password"; }));
  const AUTH_ERR = (m) => /invalid login|invalid_credentials/i.test(m) ? "Неправильна пошта, телефон або пароль." : /not confirmed/i.test(m) ? "Пошту ще не підтверджено — відкрий лист від нас." : /already registered|already been registered|user_already_exists/i.test(m) ? "Ця пошта вже зареєстрована. Увійди або віднови пароль." : /rate|limit|too_many|429/i.test(m) ? "Забагато спроб. Зачекай кілька хвилин." : /password.*(6|8|short|weak)/i.test(m) ? "Пароль занадто простий — мінімум 8 символів." : "Не вдалося. Спробуй ще раз.";
  async function phoneAuth(body) {
    const r = await fetch(`${FN}/auth-phone`, { method: "POST", headers: { "Content-Type": "application/json", apikey: CFG.key }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || `http_${r.status}`); return j;
  }
  // --- реєстрація: пошта + пароль + повтор пароля (+ телефон, коли людина стає партнером) ---
  const regFieldsHTML = (withPhone) => `
      <label class="fl" for="rmail">Пошта</label><input id="rmail" type="email" inputmode="email" autocomplete="email" placeholder="you@gmail.com" value="${esc(ls.get("probkaMail") || "")}">
      <label class="fl" for="rpass">Пароль</label><div class="pwrow"><input id="rpass" type="password" autocomplete="new-password" placeholder="мінімум 8 символів">${eye("rpass")}</div>
      <label class="fl" for="rpass2">Повтори пароль</label><div class="pwrow"><input id="rpass2" type="password" autocomplete="new-password">${eye("rpass2")}</div>
      ${withPhone ? phoneFieldHTML() : ""}`;
  const phoneFieldHTML = () => `<label class="fl" for="rphone">Номер телефону</label><input id="rphone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+380 67 123 45 67"><p class="fhint" style="display:block">${PHONE_WHY}</p>`;
  // повертає true, якщо акаунт створено і людина вже увійшла
  async function regSubmit(withPhone, b, err, label) {
    const email = BS.querySelector("#rmail").value.trim(), pass = BS.querySelector("#rpass").value, pass2 = BS.querySelector("#rpass2").value;
    const phone = withPhone ? BS.querySelector("#rphone").value.trim() : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) { err.textContent = "Перевір пошту."; return false; }
    if (pass.length < 8) { err.textContent = "Пароль — мінімум 8 символів."; return false; }
    if (pass !== pass2) { err.textContent = "Паролі не збігаються."; return false; }
    if (withPhone && !/^\d{9,15}$/.test(phone.replace(/\D/g, ""))) { err.textContent = phone ? "Перевір номер телефону." : "Вкажи номер телефону."; return false; }
    b.disabled = true; b.textContent = "Створюю акаунт…"; err.textContent = "";
    try {
      if (phone) { const { data: pOk } = await sb.rpc("phone_available", { p_phone: phone }); if (pOk === false) throw new Error("phone"); }
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { phone: phone || null }, emailRedirectTo: HERE() } });
      if (error) throw error;
      ls.set("probkaMail", email);
      if (!data.session) {
        openSheet(`<div class="psok"><p class="pslbl">Майже готово</p><h3 style="margin:8px 0 6px">Підтверди пошту</h3><p class="pssub">Ми надіслали лист на <b>${esc(email)}</b>. Натисни в ньому посилання — і продовжимо.</p><button class="big" type="button" id="lok">Зрозуміло</button></div>`, "plat");
        BS.querySelector("#lok").onclick = closeSheet; return false;
      }
      SRV.session = data.session; await SRV.refresh(); return true;
    } catch (x) {
      b.disabled = false; b.textContent = label;
      err.textContent = x.message === "phone" ? "Цей номер уже прив'язаний до іншого акаунта." : AUTH_ERR(x.message || ""); return false;
    }
  }
  // «Стати партнером»: гість — реєстрація з телефоном; увійшов без телефону — лише телефон
  SRV.becomePartner = () => {
    const guest = !SRV.session;
    openSheet(`<div class="pshead"><h3>Стати партнером</h3></div><p class="hint" style="display:block">${guest ? "Створи акаунт і вкажи номер телефону — одразу отримаєш своє посилання." : "Вкажи номер телефону — і одразу отримаєш своє посилання."}</p>
      ${guest ? regFieldsHTML(true) : phoneFieldHTML()}
      <div class="err" id="lerr"></div><button class="big" type="button" id="bpgo">${guest ? "Створити акаунт і отримати посилання" : "Отримати посилання"}</button>
      ${guest ? `<button class="lnk" type="button" id="bpin">Вже є акаунт? Увійти</button><p class="tnote">Реєструючись, ти погоджуєшся з ${LLINK("privacy", "Політикою конфіденційності")}.</p>` : ""}`, "plat");
    wireEyes();
    const err = BS.querySelector("#lerr");
    BS.querySelector("#bpin")?.addEventListener("click", () => loginSheet("Увійди — і отримаєш своє посилання.", "earn", "in"));
    BS.querySelector("#bpgo").onclick = async (e) => {
      const b = e.currentTarget, label = b.textContent;
      if (guest) { if (!(await regSubmit(true, b, err, label))) return; }
      else {
        const phone = BS.querySelector("#rphone").value.trim();
        if (!/^\d{9,15}$/.test(phone.replace(/\D/g, ""))) return (err.textContent = phone ? "Перевір номер телефону." : "Вкажи номер телефону.");
        b.disabled = true; b.textContent = "Зберігаю…";
        try { await SRV.saveProfile(SRV.me?.nickname || "", phone); } catch (x) { b.disabled = false; b.textContent = label; return (err.textContent = x.message); }
      }
      toast("Ти партнер ✓ Ось твоє посилання"); openEarn();
    };
  };
  function loginSheet(why, after, tab) {
    if (after) ls.set("probkaAfter", after);
    const reg = tab === "reg";
    openSheet(`<div class="pshead"><h3>${reg ? "Реєстрація" : "Вхід"}</h3></div>${why ? `<p class="hint" style="display:block">${esc(why)}</p>` : ""}
      <div class="atabs autht"><button type="button" data-at="in" aria-pressed="${!reg}">Увійти</button><button type="button" data-at="reg" aria-pressed="${reg}">Зареєструватися</button></div>
      ${reg ? `
      ${regFieldsHTML(false)}
      <div class="err" id="lerr"></div><button class="big" type="button" id="rgo">Створити акаунт</button><p class="tnote">Реєструючись, ти погоджуєшся з ${LLINK("privacy","Політикою конфіденційності")}.</p>`
      : `
      <label class="fl" for="lid">Пошта або телефон</label><input id="lid" type="text" autocomplete="username" placeholder="you@gmail.com або +380…" value="${esc(ls.get("probkaMail") || "")}">
      <label class="fl" for="lpass">Пароль</label><div class="pwrow"><input id="lpass" type="password" autocomplete="current-password">${eye("lpass")}</div>
      <div class="err" id="lerr"></div><button class="big" type="button" id="lgo">Увійти</button>
      <div class="authl"><button class="lnk" type="button" id="lforgot">Забули пароль?</button><button class="lnk" type="button" id="lmagic">Увійти посиланням на пошту</button></div>`}`, "plat authc");
    wireEyes();
    const err = BS.querySelector("#lerr");
    BS.querySelectorAll("[data-at]").forEach((b) => (b.onclick = () => loginSheet(why, null, b.dataset.at)));
    if (reg) {
      BS.querySelector("#rgo").onclick = async (e) => {
        const b = e.currentTarget;
        if (await regSubmit(false, b, err, "Створити акаунт")) { closeSheet(); toast("Акаунт створено ✓"); }
      };
      return;
    }
    const id = BS.querySelector("#lid");
    BS.querySelector("#lgo").onclick = async (e) => {
      const b = e.currentTarget, v = id.value.trim(), pass = BS.querySelector("#lpass").value;
      if (!v || !pass) return (err.textContent = "Введи пошту або телефон і пароль.");
      b.disabled = true; b.textContent = "Входжу…"; err.textContent = "";
      try {
        if (isMail(v)) { const { error } = await sb.auth.signInWithPassword({ email: v, password: pass }); if (error) throw error; ls.set("probkaMail", v); }
        else { const t = await phoneAuth({ action: "login", phone: v, password: pass }); const { error } = await sb.auth.setSession(t); if (error) throw error; }
        closeSheet(); toast("Ти увійшов ✓");
      } catch (x) { b.disabled = false; b.textContent = "Увійти"; err.textContent = AUTH_ERR(x.message || ""); }
    };
    BS.querySelector("#lforgot").onclick = () => forgotSheet(id.value.trim());
    BS.querySelector("#lmagic").onclick = () => magicSheet(isMail(id.value) ? id.value.trim() : "");
  }
  function forgotSheet(pre) {
    openSheet(`<div class="pshead"><h3>Відновити пароль</h3></div><p class="hint" style="display:block">Введи пошту або телефон акаунта. Ми надішлемо на пошту посилання: перейдеш за ним — і одразу задаси новий пароль.</p>
      <label class="fl" for="fid">Пошта або телефон</label><input id="fid" type="text" autocomplete="username" value="${esc(pre || "")}">
      <div class="err" id="ferr"></div><button class="big" type="button" id="fgo">Надіслати посилання</button><button class="lnk" type="button" id="fback">← Назад до входу</button>`, "plat");
    BS.querySelector("#fback").onclick = () => loginSheet();
    BS.querySelector("#fgo").onclick = async (e) => {
      const b = e.currentTarget, v = BS.querySelector("#fid").value.trim(), err = BS.querySelector("#ferr"); if (!v) return (err.textContent = "Введи пошту або телефон.");
      b.disabled = true; b.textContent = "Надсилаю…";
      try {
        let hint = v;
        if (isMail(v)) { const { error } = await sb.auth.resetPasswordForEmail(v, { redirectTo: HERE() }); if (error) throw error; }
        else { const j = await phoneAuth({ action: "reset", phone: v, redirect: HERE() }); hint = j.email_hint; }
        openSheet(`<div class="psok"><p class="pslbl">Лист надіслано</p><h3 style="margin:8px 0 6px">Перевір пошту</h3><p class="pssub">Посилання для нового пароля надіслали на <b>${esc(hint)}</b>. Листа немає? Глянь у «Спам».</p><button class="big" type="button" id="lok" style="margin-top:16px">Добре</button></div>`, "plat");
        BS.querySelector("#lok").onclick = closeSheet;
      } catch (x) { b.disabled = false; b.textContent = "Надіслати посилання"; err.textContent = x.message === "phone_unknown" ? "Такого номера немає в акаунтах." : AUTH_ERR(x.message || ""); }
    };
  }
  function magicSheet(pre) {
    openSheet(`<div class="pshead"><h3>Вхід без пароля</h3></div><p class="hint" style="display:block">Надішлемо на пошту посилання — натиснеш і одразу в акаунті.</p>
      <label class="fl" for="mmail">Пошта</label><input id="mmail" type="email" inputmode="email" autocomplete="email" value="${esc(pre || ls.get("probkaMail") || "")}">
      <div class="err" id="merr2"></div><button class="big" type="button" id="mgo">Надіслати посилання</button><button class="lnk" type="button" id="mback">← Назад до входу</button>`, "plat");
    BS.querySelector("#mback").onclick = () => loginSheet();
    BS.querySelector("#mgo").onclick = async (e) => {
      const b = e.currentTarget, email = BS.querySelector("#mmail").value.trim(), err = BS.querySelector("#merr2");
      if (!/^\S+@\S+\.\S+$/.test(email)) return (err.textContent = "Перевір пошту.");
      b.disabled = true; b.textContent = "Надсилаю…"; ls.set("probkaMail", email);
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: HERE(), shouldCreateUser: false } });
      if (error) { b.disabled = false; b.textContent = "Надіслати посилання"; err.textContent = /signups not allowed|not found/i.test(error.message) ? "Такої пошти немає — зареєструйся." : AUTH_ERR(error.message); return; }
      openSheet(`<div class="psok"><p class="pslbl">Лист надіслано</p><h3 style="margin:8px 0 6px">Перевір пошту</h3><p class="pssub">Натисни посилання в листі на <b>${esc(email)}</b> — повернешся сюди вже в акаунті.</p><button class="big" type="button" id="lok" style="margin-top:16px">Добре</button></div>`, "plat");
      BS.querySelector("#lok").onclick = closeSheet;
    };
  }
  function newPassSheet(title) {
    openSheet(`<div class="pshead"><h3>${title || "Новий пароль"}</h3></div><p class="hint" style="display:block">Придумай пароль, з яким надалі входитимеш за поштою або телефоном.</p>
      <label class="fl" for="np">Новий пароль</label><div class="pwrow"><input id="np" type="password" autocomplete="new-password" placeholder="мінімум 8 символів">${eye("np")}</div>
      <div class="err" id="nerr"></div><button class="big" type="button" id="ngo">Зберегти пароль</button>`, "plat");
    wireEyes();
    BS.querySelector("#ngo").onclick = async (e) => {
      const b = e.currentTarget, p = BS.querySelector("#np").value, err = BS.querySelector("#nerr");
      if (p.length < 8) return (err.textContent = "Мінімум 8 символів.");
      b.disabled = true; b.textContent = "Зберігаю…";
      const { error } = await sb.auth.updateUser({ password: p });
      if (error) { b.disabled = false; b.textContent = "Зберегти пароль"; err.textContent = /same/i.test(error.message) ? "Це твій старий пароль — придумай новий." : AUTH_ERR(error.message); return; }
      closeSheet(); toast("Пароль збережено ✓");
    };
  }
  SRV.changePassword = () => newPassSheet("Змінити пароль");
  SRV.register = (why) => loginSheet(why, null, "reg");
  SRV.login = loginSheet;
  const needLogin = (why, after) => { if (SRV.session) return false; loginSheet(why, after, (after === "pay" || after === "paytest") && !ls.get("probkaMail") ? "reg" : undefined); return true; };
  // згода з документами: хто, коли і яку редакцію прийняв (доказ укладення договору)
  SRV.consent = (docs, ver) => { if (!SRV.session) return; for (const d of docs) sb.rpc("log_consent", { p_doc: d, p_ver: ver }).then(({ error }) => { if (error) console.warn("consent", error.message); }); };
  SRV.signOut = async () => { await sb.auth.signOut(); closeSheet(); toast("Ти вийшов з акаунта"); };

  // --- оплата підписки ---
  let afterPay = null;
  let payOpts = null;
  SRV.pay = (onDone, opts) => {
    afterPay = onDone || null; payOpts = opts || null;
    if (!offerGate("offer", () => SRV.pay(onDone, opts))) return;
    const guest = !SRV.session;
    const test = opts?.product === "test", custom = !!opts?.product && opts.product !== "marker", once = !!opts?.once;
    const bal = WL.balance, price = custom ? opts.price : kop(SRV.me?.price_kop || 39900);
    const balBtn = !custom && bal >= price ? `<button class="pm bal" type="button" id="pbal">З балансу <small>${money(bal)} доступно</small></button>` : "";
    openSheet(`<div class="pshead"><h3>${custom ? esc(opts.title) : "Підписка «Рілс маркером»"}</h3><span class="psprice">${test ? `<small class="psl">Підписка</small>+` : ""}${money(price)}${once ? "" : "<small>/міс</small>"}</span></div>
      ${custom ? `<p class="hint" style="display:block">${opts.note || ""}</p>` : `<ul class="ben"><li>Збереження всіх відео в цьому форматі</li><li>Без водяних знаків</li><li>30 днів від дня оплати, без автосписань</li></ul><p class="hint" style="display:block">${typeof priceNote === "function" ? priceNote("marker") : ""}</p>`}
      ${guest ? `<p class="hint" style="display:block;margin-top:4px"><b>Створи акаунт</b> — щоб відео і підписка збереглися за тобою.</p>${regFieldsHTML(false)}` : ""}
      <p class="tnote" style="margin:8px 0 10px">Ти погодився з ${LLINK("offer","Публічною офертою")}.</p><div class="pms">${guest ? "" : balBtn}<button class="big" type="button" id="pgo">${guest ? `Зареєструватися і оплатити ${money(price)}` : `Оплатити ${money(price)}`}</button></div>
      ${guest ? `<button class="lnk" type="button" id="phave">Вже є акаунт? Увійти</button>` : ""}
      <div class="err" id="perr"></div><p class="tnote">Картка, Apple Pay, Google Pay, monobank, Приват24. Дані картки бачить лише банк.</p>`, "plat");
    const err = BS.querySelector("#perr");
    if (guest) { wireEyes(); BS.querySelector("#phave").onclick = () => loginSheet("Увійди — і продовжимо оплату.", test ? "paytest" : "pay", "in"); }
    BS.querySelector("#pgo").onclick = async (e) => {
      const b = e.currentTarget;
      if (guest && !(await regSubmit(false, b, err, `Зареєструватися і оплатити ${money(price)}`))) return;
      b.disabled = true; b.textContent = "Відкриваю оплату…";
      try {
        const j = await call("pay-create", { ref: ls.get("probkaRef"), product: custom ? opts.product : undefined, embed: true });
        const m = /[?&]mockpay=([^&]+)/.exec(j.url);
        if (m) return mockSheet(decodeURIComponent(m[1]), kop(j.amount_kop) || price);
        ls.set("probkaAfter", test ? "paidtest" : "paid");
        payFrame(j.url, j.payment_id);
      } catch (x) { b.disabled = false; b.textContent = `Оплатити ${money(price)}`; err.textContent = "Не вдалося відкрити оплату. Спробуй ще раз."; console.warn(x); }
    };
    BS.querySelector("#pbal")?.addEventListener("click", async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { await rpc("pay_with_balance"); await SRV.refresh(); paidSheet("balance"); } catch (x) { b.disabled = false; err.textContent = "Не вистачає доступного балансу."; }
    });
  };
  // Тестова форма оплати (поки банк не підключено): виглядає як справжня, гроші не списуються.
  function mockSheet(invoice, price) {
    openSheet(payFormHTML(price), "plat");
    wirePayForm(price, async (ok, via, fail) => {
      await new Promise((r) => setTimeout(r, 900));
      try { await call("mock-pay", { invoice, status: ok ? "success" : "failure" }); await SRV.refresh();
        if (ok) paidSheet(via); else fail(); }
      catch (x) { fail("Помилка тестової оплати."); console.warn(x); }
    });
  }


  // Справжня оплата: форма банку (картка, Apple Pay, Google Pay, monobank) прямо на сторінці, без переходів.
  function payFrame(url, paymentId) {
    closeSheet();
    const ov = document.createElement("div"); ov.className = "pfov";
    ov.innerHTML = `<div class="pfbox"><div class="pfhead"><b>Оплата</b><button type="button" class="bsx" aria-label="Закрити">×</button></div><iframe title="monopay" allow="payment *" src="${url}"></iframe><p class="pfnote" id="pfst">Захищена сторінка monobank. Дані картки ми не бачимо.</p></div>`;
    document.body.appendChild(ov);
    let done = false, timer = 0;
    const close = () => { done = true; clearInterval(timer); removeEventListener("message", onMsg); ov.remove(); };
    const onMsg = (e) => { let d = e.data; try { if (typeof d === "string") d = JSON.parse(d); } catch (x) { return; }
      if (d?.message === "close-button") close(); else if (d?.message === "monopay-link" && d.value) location.href = d.value; else if (d?.probka === "paid") check(); };
    addEventListener("message", onMsg);
    ov.querySelector(".bsx").onclick = close;
    const check = async () => {
      if (done) return;
      const { data } = await sb.from("payments").select("status").eq("id", paymentId).maybeSingle();
      if (data?.status === "success") { close(); await SRV.refresh(); paidSheet(); }
      else if (data?.status === "failure") { const st = ov.querySelector("#pfst"); if (st) st.textContent = "Банк відхилив оплату. Спробуй іншу картку або спосіб."; }
    };
    timer = setInterval(check, 2500);
  }
  function paidSheet(via) {
    const test = payOpts?.product === "test";
    const cb = afterPay; afterPay = null;
    paySuccess({ amount: payOpts?.price || 399, via, title: "Підписку оформлено",
      sub: test ? "Це була тестова оплата." : cb ? "Зберігаю твоє відео…" : "Тепер можна зберігати всі відео." });
    cb?.();
  }


  // --- гаманець і вивід ---
  SRV.setAutoRenew = async (on) => { await rpc("set_auto_renew", { p_on: !!on }); await SRV.refresh(); };
  SRV.openWallet = async () => {
    if (needLogin("Щоб бачити заробіток і виводити гроші, увійди або зареєструйся.", "wallet")) return;
    withdrawSheet(await walletCtx());
  };
  const ERR = { below_minimum: "Сума менша за мінімум для виводу.", need_details: "Спершу вкажи рахунок.", need_fop_details: "Вивід на картку запрацює після оновлення сервера. Поки — тільки на рахунок ФОП.",
    bad_iban: "IBAN має починатися з UA і мати 29 символів.", bad_name: "Вкажи повне ПІБ.", bad_ipn: "ІПН — 10 цифр." };
  const rpcU = async (n, a) => { try { return await rpc(n, a); } catch (x) { throw new Error(ERR[x.message] || "Не вдалося. Спробуй пізніше."); } };
  SRV.walletCtx = () => walletCtx();
  async function walletCtx() {
    await SRV.refresh();
    const me = SRV.me || {};
    let info = null; try { info = await rpc("payout_info"); } catch (e) {}
    const pays = info ? info.payouts : (me.payouts || []).map((p) => ({ ...p, gross_kop: p.amount_kop, tax_kop: 0, method: "fop" }));
    const subBtn = kop(me.available_kop) >= kop(me.price_kop) && !me.active ? `<button class="lnk" type="button" id="wsub">Оплатити свою підписку з балансу</button>` : "";
    return {
      avail: kop(me.available_kop), min: kop(info?.min_out_kop ?? me.min_out_kop),
      method: info ? info.method : (me.payout_ready ? "fop" : null), last4: info?.iban_last4 || null, name: info?.name || "",
      history: pays.map((p) => ({ date: new Date(p.created_at).toLocaleDateString("uk-UA"), net: kop(p.amount_kop), tax: kop(p.tax_kop || 0), method: p.method, status: p.status })),
      save: async (d) => { await rpcU("set_payout_details", { p_iban: d.iban, p_name: d.name, p_ipn: d.ipn, p_is_fop: d.isFop }); return walletCtx(); },
      request: async () => { const r = await rpcU("request_payout"); await SRV.refresh();
        const gross = kop(r.gross_kop ?? r.amount_kop), net = kop(r.amount_kop); return { gross, net, tax: +(gross - net).toFixed(2) }; },
      extra: `${subBtn}<button class="lnk" type="button" id="wout">Вийти з акаунта</button>`,
      wire: (bs) => { bs.querySelector("#wout").onclick = SRV.signOut; bs.querySelector("#wsub")?.addEventListener("click", () => SRV.pay()); },
    };
  }

  // --- старт (після того, як завантажився основний скрипт сторінки) ---
  let visitLogged = false;
  const logOpen = () => { if (visitLogged) return; visitLogged = true;
    let v = null; try { v = localStorage.getItem("yvVid"); if (!v) { v = Math.random().toString(36).slice(2, 12); localStorage.setItem("yvVid", v); } } catch (e) {}
    let r = null; try { r = new URLSearchParams(location.search).get("ref"); } catch (e) {}
    sb.rpc("log_visit", { p_kind: "open", p_visitor: v, p_ref: r, p_ua: navigator.userAgent }).then(() => {}, () => {}); };
  // Гість може все дивитися й пробувати інструменти. Реєстрація — лише коли зберігає відео (перед оплатою) або виводить гроші.
  const authCss = document.createElement("style");
  authCss.textContent = ".bs.authc .fhint{display:none}.bs.authc input:focus+.fhint,.bs.authc .fhint.ok,.bs.authc .fhint.bad{display:block}";
  document.head.appendChild(authCss);
  const start = () => sb.auth.onAuthStateChange(async (_ev, session) => {
    const was = !!SRV.session; SRV.session = session;
    if (!document.documentElement.classList.contains("gate")) logOpen(); else { const mo = new MutationObserver(() => { if (!document.documentElement.classList.contains("gate")) { mo.disconnect(); logOpen(); } }); mo.observe(document.documentElement, { attributes: true }); }
    if (_ev === "PASSWORD_RECOVERY") setTimeout(() => newPassSheet(), 300);
    await SRV.refresh();
    if (session) SRV.libSync().then((c) => { if (c && !document.getElementById("lib")?.hidden) window.renderLib?.(); });
    if (session) { try { for (const k of ["offer", "rules"]) { const g = localStorage.getItem("yvAgree_" + k + "_local"); if (g) { localStorage.setItem("yvAgree_" + k + "_" + session.user.id, g); localStorage.removeItem("yvAgree_" + k + "_local"); } }
      const pc = JSON.parse(localStorage.getItem("yvPendConsent") || "null"); if (pc) { localStorage.removeItem("yvPendConsent"); SRV.consent(pc.docs, pc.ver); } } catch (e) {} }
    if (session && !was) {
      const after = ls.get("probkaAfter"); ls.set("probkaAfter", null);
      if (after && after.startsWith("tool:")) { const id = after.slice(5); const el = id.startsWith("open-") ? document.querySelector(`.fmts [data-open="${id.slice(5)}"]`) : document.getElementById(id); setTimeout(() => el?.click(), 150); }
      else if (after === "pay" || after === "paytest") { if (payOpts || afterPay || after === "pay") setTimeout(() => SRV.pay(afterPay, payOpts), 150); else document.getElementById("testfmt")?.click(); } else if (after === "paidtest") toast("Перевіряємо тестову оплату…"); else if (after === "wallet") SRV.openWallet(); else if (after === "earn") openEarn(); else if (after === "paid") toast(SRV.me?.active ? "Підписку оформлено ✓" : "Перевіряємо оплату…");
    }
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  // поки сторінка відкрита — раз на 20 с перевіряємо нові зарахування
  setInterval(() => { if (SRV.session && document.visibilityState === "visible") SRV.refresh(); }, 20000);
})();
