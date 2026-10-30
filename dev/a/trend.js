/* YuVi · «Відео під тренд» (тест, лише власник).
   Запис екрана з трендом (або готовий шаблон) → розбір: кадри, тривалість, текст, ритм →
   картки «що зняти» (ескіз + схема камери + опис) → вбудована камера з контуром-підказкою →
   автовибір найкращого моменту → збірка точно в ритм → збереження. Трендовий звук людина додає в Instagram/TikTok.
   Двигун шторок/записів — спільний з озвучкою (talk.js). */
(() => {
  "use strict";
  const E = () => window.YVTalk._t;
  const OW = 1080, OH = 1920, FPS = 30;
  const $ = (r, s) => r.querySelector(s);
  const escH = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const say = (t) => { try { toast(t); } catch (e) {} };
  const track = (st, m) => { try { window.yvTrack?.("trend", st, m); } catch (e) {} };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const AC = () => (window.__yvTalkAC ||= new (window.AudioContext || window.webkitAudioContext)());
  const busyRun = (k, fn) => E().busyRun(k, fn);

  /* ---------- готові шаблони (коли тренду немає) ---------- */
  const CAMS = { front: "спереду", side: "збоку", top: "зверху", low: "знизу", selfie: "селфі", pov: "від першої особи" };
  const TPL = {
    list: { n: "3 речі, які…", shots: [
      { d: 1.6, what: "Ти дивишся в камеру з виразом «зараз скажу важливе»", cam: { pos: "selfie", dist: "close", move: "static" }, text: "3 речі, які я зрозумів", sketch: "person looking at camera, serious face, close-up" },
      { d: 1.4, what: "Деталь, що ілюструє першу думку (руки, предмет, екран)", cam: { pos: "top", dist: "close", move: "in" }, text: "1.", sketch: "hands holding a phone, top view" },
      { d: 1.4, what: "Друга думка: ти робиш дію (пишеш, йдеш, готуєш)", cam: { pos: "side", dist: "mid", move: "static" }, text: "2.", sketch: "person writing in a notebook, side view" },
      { d: 1.4, what: "Третя думка: інший ракурс або місце", cam: { pos: "low", dist: "mid", move: "right" }, text: "3.", sketch: "person walking on a street, low angle" },
      { d: 2.0, what: "Фінал: усмішка або жест у камеру", cam: { pos: "selfie", dist: "close", move: "out" }, text: "Збережи, щоб не забути", sketch: "person smiling and pointing at camera" } ] },
    pov: { n: "POV", shots: [
      { d: 2.2, what: "Ти дивишся в камеру, ніби глядач — це хтось поруч", cam: { pos: "pov", dist: "mid", move: "static" }, text: "POV: …", sketch: "person looking at viewer, point of view shot" },
      { d: 1.6, what: "Реакція: здивування або сміх", cam: { pos: "selfie", dist: "close", move: "in" }, text: "", sketch: "surprised face close-up" },
      { d: 2.2, what: "Дія, яка завершує історію", cam: { pos: "front", dist: "mid", move: "static" }, text: "", sketch: "person doing a gesture, medium shot" } ] },
    ba: { n: "До / після", shots: [
      { d: 2.0, what: "«До»: як було (безлад, старе, втома)", cam: { pos: "front", dist: "mid", move: "static" }, text: "До", sketch: "messy desk, front view" },
      { d: 0.8, what: "Перехід: закрий камеру рукою", cam: { pos: "front", dist: "close", move: "in" }, text: "", sketch: "hand covering the camera lens" },
      { d: 2.4, what: "«Після»: той самий ракурс, результат", cam: { pos: "front", dist: "mid", move: "static" }, text: "Після", sketch: "clean organized desk, front view" } ] },
    photos: { n: "Фото → відео", shots: Array.from({ length: 6 }, (_, i) => ({ d: 1.0, what: i ? `Фото ${i + 1}` : "Перше фото — найяскравіше", cam: { pos: "front", dist: "mid", move: i % 2 ? "in" : "out" }, text: i ? "" : "Мій тиждень", sketch: "", photo: true })) },
  };

  /* ---------- стан ---------- */
  let T = null;
  const fresh = () => ({ ref: null, refAud: null, beats: [], shots: [], topic: "", gallery: false, clips: [], cur: 0, textStyle: { color: "#FFFFFF", pos: .2, upper: false } });

  /* ---------- аналіз запису тренду ---------- */
  const mkVideo = (url) => { const v = document.createElement("video"); v.src = url; v.muted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "auto"; return v; };
  const loadMeta = (el) => new Promise((ok, no) => { if (el.readyState >= 1) return ok(); el.addEventListener("loadedmetadata", () => ok(), { once: true }); el.addEventListener("error", () => no(new Error("video")), { once: true }); try { el.load(); } catch (e) {} setTimeout(ok, 15000); });
  const seekTo = (v, t) => new Promise((ok) => { const f = () => { v.removeEventListener("seeked", f); ok(); }; v.addEventListener("seeked", f); v.currentTime = Math.max(0, Math.min(t, (v.duration || t) - .03)); setTimeout(f, 1500); });
  // кадри відео: зменшені сірі «відбитки» для пошуку склейок + чіткості/руху
  async function scan(v, step = .2, w = 36, h = 64) {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true });
    const out = []; for (let t = 0; t < v.duration - .05; t += step) { await seekTo(v, t); x.drawImage(v, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
      for (let i = 0; i < g.length; i++) g[i] = (d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11) / 255;
      let lap = 0; for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) { const k = yy * w + xx, l = 4 * g[k] - g[k - 1] - g[k + 1] - g[k - w] - g[k + w]; lap += l * l; }
      const prev = out[out.length - 1]?.g; let diff = 0; if (prev) for (let i = 0; i < g.length; i++) diff += Math.abs(g[i] - prev[i]); out.push({ t, g, sharp: lap / g.length, diff: prev ? diff / g.length : 0 }); }
    return out;
  }
  // склейки = різкі стрибки картинки
  function cutsFrom(fr) { const ds = fr.map((f) => f.diff), m = ds.slice().sort((a, b) => a - b)[Math.floor(ds.length * .5)] || 0; const thr = Math.max(.09, m * 4); const cuts = [0];
    fr.forEach((f) => { if (f.diff > thr && f.t - cuts[cuts.length - 1] > .35) cuts.push(f.t); }); return cuts; }
  // ритм: сильні долі зі звуку запису (спектральний потік → піки)
  function beatsFrom(x, sr) {
    const hop = Math.round(sr * .01), n = Math.floor(x.length / hop), en = new Float32Array(n); let prev = 0;
    for (let f = 0; f < n; f++) { let s = 0; for (let i = f * hop; i < (f + 1) * hop && i < x.length; i++) s += x[i] * x[i]; const e = Math.log(1e-6 + s); en[f] = Math.max(0, e - prev); prev = e; }
    const out = []; for (let f = 8; f < n - 8; f++) { let loc = 0; for (let k = f - 25; k <= f + 25; k++) loc += en[Math.max(0, Math.min(n - 1, k))]; loc /= 51; if (en[f] > loc * 2.2 && en[f] > .6 && en[f] === Math.max(...en.slice(f - 8, f + 9)) && (!out.length || f * .01 - out[out.length - 1] > .22)) out.push(f * .01); }
    return out;
  }
  const snapBeat = (t) => { let b = t, d = .18; for (const x of T.beats) if (Math.abs(x - t) < d) { d = Math.abs(x - t); b = x; } return b; };
  // «контактний лист» кадрів для AI (одна картинка — до 12 кадрів з номерами)
  async function sheetOf(v, times) {
    const cols = 4, rows = Math.ceil(times.length / cols), cw = 180, ch = 320, c = document.createElement("canvas"); c.width = cols * cw; c.height = rows * ch; const x = c.getContext("2d");
    x.fillStyle = "#111"; x.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < times.length; i++) { await seekTo(v, times[i]); const cx = (i % cols) * cw, cy = Math.floor(i / cols) * ch, r = Math.max(cw / v.videoWidth, ch / v.videoHeight), dw = v.videoWidth * r, dh = v.videoHeight * r;
      x.save(); x.beginPath(); x.rect(cx, cy, cw, ch); x.clip(); x.drawImage(v, cx + (cw - dw) / 2, cy + (ch - dh) / 2, dw, dh); x.restore();
      x.fillStyle = "#ffd60a"; x.fillRect(cx + 6, cy + 6, 34, 30); x.fillStyle = "#000"; x.font = "bold 22px sans-serif"; x.fillText(String(i + 1), cx + 12, cy + 29); }
    return c.toDataURL("image/jpeg", .82).split(",")[1];
  }
  async function analyze(file) {
    const url = URL.createObjectURL(file), v = mkVideo(url); await loadMeta(v); if (!(v.duration > 1)) throw new Error("short");
    if (v.duration > 61) throw new Error("long");
    const buf = await file.arrayBuffer(); let aud = null; try { aud = await E().decode(buf); } catch (e) {}
    T.ref = { url, dur: v.duration }; T.refAud = aud; T.beats = aud ? beatsFrom(aud, E().SR) : [];
    const fr = await scan(v), cuts = cutsFrom(fr); let bounds = cuts.concat([v.duration]);
    // надто довгі шматки ділимо по ритму, щоб відео не «стояло»
    const out = []; for (let i = 0; i < bounds.length - 1; i++) { let a = bounds[i]; const b = bounds[i + 1]; while (b - a > 3.2) { const m = snapBeat(a + 2); out.push([a, m]); a = m; } out.push([a, b]); }
    const shots = out.filter(([a, b]) => b - a > .25).slice(0, 12).map(([a, b]) => ({ a: snapBeat(a), b: snapBeat(b) }));
    const mids = shots.map((s) => (s.a + s.b) / 2), img = await sheetOf(v, mids);
    let r = null;
    try {
      r = await SRV.aiVision(`Це кадри з трендового короткого відео (номери в жовтих квадратах — по порядку). Людина хоче повторити цей тренд зі своєю темою: «${T.topic || "своя тема, на твій розсуд — просто й універсально"}».
Для КОЖНОГО кадру (${shots.length} шт.) опиши, що людині зняти, щоб вийшло так само. Пиши українською, коротко, простими словами, без технічних термінів.
Поверни тільки JSON: {"shots":[{"what":"що в кадрі (1 речення)","how":"як зняти: що поставити/зробити (1 речення)","cam":{"pos":"front|side|top|low|selfie|pov","dist":"close|mid|far","move":"static|in|out|left|right|follow"},"text":"текст на екрані в цьому кадрі, адаптований під тему людини, або \\"\\"","sketch":"short English description for a simple line sketch of this shot"}],
"textStyle":{"color":"#RRGGBB","pos":0.1-0.9,"upper":true|false}}`, [{ data: img, mime: "image/jpeg" }]);
    } catch (e) { console.warn(e); }
    const A = Array.isArray(r?.shots) ? r.shots : [];
    T.shots = shots.map((s, i) => { const q = A[i] || {}; return { d: Math.max(.3, s.b - s.a), what: String(q.what || `Кадр ${i + 1}`), how: String(q.how || ""), cam: { pos: CAMS[q.cam?.pos] ? q.cam.pos : "front", dist: ["close", "mid", "far"].includes(q.cam?.dist) ? q.cam.dist : "mid", move: q.cam?.move || "static" }, text: String(q.text || ""), sketch: String(q.sketch || q.what || "") }; });
    if (r?.textStyle) T.textStyle = { color: /^#[0-9a-f]{6}$/i.test(r.textStyle.color) ? r.textStyle.color : "#FFFFFF", pos: clamp(+r.textStyle.pos || .2, .1, .9), upper: !!r.textStyle.upper };
  }

  /* ---------- ескізи (дешева модель) ---------- */
  async function sketches() {
    for (const s of T.shots) { if (s.img || !s.sketch || s.photo) continue;
      try { const r = await SRV.genImage({ prompt: `simple black marker line sketch on pure white background, minimal, no text, no shading: ${s.sketch}`, style: "clean thin black outlines only, white background, storyboard doodle", aspect: "9:16", quiet: true });
        if (r?.image) s.img = `data:${r.mime || "image/jpeg"};base64,${r.image}`; drawCards?.(); } catch (e) { break; } }
  }

  /* ---------- схема камери (малюється кодом — завжди точна і безкоштовна) ---------- */
  function camSVG(c) {
    const P = { front: [60, 92, 0], side: [100, 52, 90], top: [60, 10, 180], low: [60, 100, -20], selfie: [60, 80, 0], pov: [60, 96, 0] }[c.pos] || [60, 92, 0];
    const k = c.dist === "close" ? .55 : c.dist === "far" ? 1.25 : .85, px = 60 + (P[0] - 60) * k, py = 52 + (P[1] - 52) * k;
    const mv = { in: `<path d="M${px} ${py}L${60 + (px - 60) * .55} ${52 + (py - 52) * .55}" stroke="#30d158" stroke-width="3" marker-end="url(#ah)"/>`, out: `<path d="M${px} ${py}L${60 + (px - 60) * 1.35} ${52 + (py - 52) * 1.35}" stroke="#30d158" stroke-width="3" marker-end="url(#ah)"/>`,
      left: `<path d="M${px + 12} ${py + 16}L${px - 18} ${py + 16}" stroke="#30d158" stroke-width="3" marker-end="url(#ah)"/>`, right: `<path d="M${px - 12} ${py + 16}L${px + 18} ${py + 16}" stroke="#30d158" stroke-width="3" marker-end="url(#ah)"/>`,
      follow: `<path d="M${px - 14} ${py + 16}q14 10 28 0" fill="none" stroke="#30d158" stroke-width="3" marker-end="url(#ah)"/>` }[c.move] || "";
    const subj = c.pos === "selfie" || c.pos === "pov" ? `<circle cx="60" cy="40" r="11" fill="#f5f5f7"/><path d="M42 72q18-22 36 0" fill="#f5f5f7"/>` : `<circle cx="60" cy="44" r="10" fill="#f5f5f7"/><path d="M44 72q16-20 32 0" fill="#f5f5f7"/>`;
    return `<svg viewBox="0 0 120 120" class="cam"><defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#30d158"/></marker></defs>
      <rect x="1" y="1" width="118" height="118" rx="18" fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.12)"/>${subj}
      <g transform="translate(${px} ${py}) rotate(${P[2]})"><rect x="-8" y="-13" width="16" height="26" rx="4" fill="#ffd60a"/><circle cx="0" cy="-8" r="2.4" fill="#0b0b0d"/></g>${mv}</svg>`;
  }

  /* ---------- вбудована камера з контуром ---------- */
  async function camera(shot, onDone) {
    let stream = null, facing = shot.cam.pos === "selfie" ? "user" : "environment";
    const ov = document.createElement("div"); ov.className = "tcam";
    ov.innerHTML = `<video playsinline muted autoplay></video>${shot.img ? `<img class="ghost" src="${shot.img}" alt="">` : ""}<div class="ttop"><button class="tcx" aria-label="Закрити">×</button><span>${escH(shot.how || shot.what)}</span><button class="tflip" aria-label="Інша камера">⟲</button></div>
      <div class="tcnt"></div><div class="tbot"><button class="tghost" ${shot.img ? "" : "hidden"}>Контур</button><button class="trec" aria-label="Записати"><i></i></button><span class="tdur">${shot.d.toFixed(1)} с</span></div>`;
    UI.root.appendChild(ov); const vid = $(ov, "video");
    const start = async () => { stream?.getTracks().forEach((t) => t.stop()); try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false }); } catch (e) { stream = null; }
      if (!stream) { closeCam(); onDone(null, "nocam"); return; } vid.srcObject = stream; vid.style.transform = facing === "user" ? "scaleX(-1)" : ""; };
    const closeCam = () => { stream?.getTracks().forEach((t) => t.stop()); ov.remove(); };
    await start();
    $(ov, ".tcx").onclick = () => { closeCam(); onDone(null); };
    $(ov, ".tflip").onclick = () => { facing = facing === "user" ? "environment" : "user"; start(); };
    $(ov, ".tghost").onclick = () => ov.classList.toggle("noghost");
    $(ov, ".trec").onclick = async (e) => {
      const btn = e.currentTarget; if (btn._rec) { btn._rec.stop(); return; }
      const cnt = $(ov, ".tcnt"); for (const n of [3, 2, 1]) { cnt.textContent = n; await sleep(650); } cnt.textContent = "";
      const mime = ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : {}), ch = []; btn._rec = rec; ov.classList.add("rec");
      rec.ondataavailable = (x) => x.data.size && ch.push(x.data);
      const need = shot.d + 1.6, t0 = Date.now(), tm = setInterval(() => { const s = (Date.now() - t0) / 1000; $(ov, ".tdur").textContent = `${s.toFixed(1)} / ${shot.d.toFixed(1)} с`; if (s >= need) rec.stop(); }, 100);
      rec.onstop = () => { clearInterval(tm); btn._rec = null; ov.classList.remove("rec"); const blob = new Blob(ch, { type: (rec.mimeType || mime || "video/webm").split(";")[0] }); review(blob); };
      rec.start(200);
    };
    const review = (blob) => {
      const url = URL.createObjectURL(blob), box = document.createElement("div"); box.className = "trev";
      box.innerHTML = `<video src="${url}" playsinline autoplay loop muted></video><div class="tbot2"><button class="tbtn" data-a="again">↻ Переписати</button><button class="tbtn main" data-a="ok">✓ Готово</button></div>`;
      ov.appendChild(box);
      box.querySelector('[data-a="again"]').onclick = () => { box.remove(); URL.revokeObjectURL(url); };
      box.querySelector('[data-a="ok"]').onclick = () => { closeCam(); onDone(new File([blob], `kadr_${Date.now()}.${blob.type.includes("mp4") ? "mp4" : "webm"}`, { type: blob.type })); };
    };
  }

  /* ---------- автовибір найкращого моменту в кліпі ---------- */
  async function pickBest(clip, shot) {
    const v = clip.el; const dur = v.duration || 0, need = Math.min(shot.d, dur);
    if (dur <= need + .15) return { in: 0, len: need };
    const fr = await scan(v, .15, 24, 42); const wantMove = shot.cam.move !== "static";
    let best = .3, bs = -1; const lo = Math.min(.4, dur - need), hi = Math.max(lo, dur - need - .3);
    for (let a = lo; a <= hi + 1e-6; a += .15) { const W = fr.filter((f) => f.t >= a && f.t <= a + need); if (!W.length) continue;
      const sh = W.reduce((s, f) => s + f.sharp, 0) / W.length, mo = W.reduce((s, f) => s + f.diff, 0) / W.length, jit = Math.max(...W.map((f) => f.diff));
      const sc = sh * (wantMove ? 1 + mo * 8 : 1 / (1 + mo * 6)) / (1 + Math.max(0, jit - .12) * 10); if (sc > bs) { bs = sc; best = a; } }
    return { in: best, len: need };
  }

  /* ---------- збірка і програвання ---------- */
  function cover(x, el, W, H, z = 1) { const w = el.videoWidth || el.naturalWidth || W, h = el.videoHeight || el.naturalHeight || H, r = Math.max(W / w, H / h) * z, dw = w * r, dh = h * r; x.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh); }
  function drawText(x, s, W, H, age) {
    if (!s.text) return; const k = W / OW, st = T.textStyle, t = st.upper ? s.text.toUpperCase() : s.text, px = Math.round(70 * k), pop = age < .12 ? .85 + age / .12 * .15 : 1;
    x.save(); x.font = `800 ${px}px "Manrope", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
    const words = t.split(/\s+/), lines = [""]; words.forEach((w) => { const c = lines[lines.length - 1] ? lines[lines.length - 1] + " " + w : w; if (x.measureText(c).width > W * .84 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = c; });
    const cy = H * st.pos; x.translate(W / 2, cy); x.scale(pop, pop);
    lines.forEach((l, i) => { const y = (i - (lines.length - 1) / 2) * px * 1.2; x.lineJoin = "round"; x.lineWidth = px * .16; x.strokeStyle = "rgba(0,0,0,.85)"; x.strokeText(l, 0, y); x.fillStyle = st.color; x.fillText(l, 0, y); });
    x.restore();
  }
  const timeline = () => { let o = 0; return T.shots.map((s, i) => { const r = { i, o, d: s.d }; o += s.d; return r; }); };
  const total = () => T.shots.reduce((a, s) => a + s.d, 0);
  let PL = null;
  function stopPlay() { if (!PL) return; cancelAnimationFrame(PL.raf); try { PL.src?.stop(); } catch (e) {} T.clips.forEach((c) => c?.el.pause()); PL.end?.(); PL = null; }
  async function frameAt(x, t, W, H) {
    const tl = timeline(), seg = tl.find((q) => t < q.o + q.d) || tl[tl.length - 1], s = T.shots[seg.i], c = T.clips[seg.i];
    x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
    if (c) { const age = t - seg.o, z = s.photo ? 1 + .08 * clamp(age / s.d) * (s.cam.move === "out" ? -1 : 1) + (s.cam.move === "out" ? .08 : 0) : 1; cover(x, c.el, W, H, z); }
    else { x.fillStyle = "#1c1c20"; x.fillRect(0, 0, W, H); x.fillStyle = "#71717a"; x.font = `600 ${Math.round(40 * W / OW)}px system-ui`; x.textAlign = "center"; x.fillText(`Кадр ${seg.i + 1} ще не знято`, W / 2, H / 2); }
    drawText(x, s, W, H, t - seg.o); return seg;
  }
  async function play(cv, from = 0, opts = {}) {
    stopPlay(); const ac = AC(); try { await ac.resume(); } catch (e) {}
    const x = cv.getContext("2d"), W = cv.width, H = cv.height, tl = timeline(), TOT = total();
    let src = null; if (T.refAud && opts.music !== false) { const b = ac.createBuffer(1, T.refAud.length, E().SR); b.copyToChannel(T.refAud, 0); src = ac.createBufferSource(); src.buffer = b;
      if (opts.dest) { const g = ac.createGain(); g.gain.value = 0; src.connect(g); g.connect(ac.destination); } else src.connect(ac.destination); }
    const t0 = ac.currentTime + .08 - from; src?.start(t0 + from, from); let segI = -1;
    PL = { src, raf: 0, end: opts.onend };
    const loop = () => { if (!PL) return; const t = ac.currentTime - t0; if (t >= TOT) { const d = opts.done; stopPlay(); d?.(); return; }
      const seg = tl.find((q) => t < q.o + q.d) || tl[tl.length - 1];
      if (seg.i !== segI) { if (segI >= 0) T.clips[segI]?.el.pause(); segI = seg.i; const c = T.clips[seg.i]; if (c && c.kind === "video") { c.el.currentTime = c.in + Math.max(0, t - seg.o); c.el.play().catch(() => {}); } }
      frameAt(x, Math.max(0, t), W, H); opts.tick?.(t / TOT, seg.i); PL.raf = requestAnimationFrame(loop); };
    PL.raf = requestAnimationFrame(loop);
  }
  async function exportVideo(prog) {
    try { await document.fonts?.ready; } catch (e) {}
    const cv = document.createElement("canvas"); cv.width = OW; cv.height = OH; const ac = AC(), dest = ac.createMediaStreamDestination(), stream = cv.captureStream(FPS);
    const mime = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp9", "video/webm"].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error("no recorder");
    for (const c of T.clips) if (c?.kind === "video") await seekTo(c.el, c.in);
    await frameAt(cv.getContext("2d"), 0, OW, OH);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 9e6 }), ch = []; rec.ondataavailable = (e) => e.data.size && ch.push(e.data);
    const stopped = new Promise((r) => rec.onstop = r); rec.start(500);
    await new Promise((res) => play(cv, 0, { dest, music: !!T.refAud, tick: (p) => prog(p), done: res, onend: res }));
    await sleep(200); rec.stop(); await stopped; void dest;
    return { blob: new Blob(ch, { type: mime.split(";")[0] }), ext: mime.includes("mp4") ? "mp4" : "webm" };
  }
  async function share(files) {
    if (navigator.canShare?.({ files })) { try { await navigator.share({ files }); return true; } catch (e) { if (e?.name === "AbortError") return true; } }
    for (const f of files) { const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); } return true;
  }

  /* ---------- інтерфейс ---------- */
  const CSS = `
#yvtr{position:fixed;inset:0;z-index:9000;background:#0b0b0d;color:#f5f5f7;display:flex;flex-direction:column;font:15px/1.45 var(--pfont,system-ui,-apple-system,sans-serif);padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
#yvtr *{box-sizing:border-box}
#yvtr .vh{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 4px}#yvtr .vh b{font-size:17px}
#yvtr .vx{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font-size:20px;cursor:pointer;display:grid;place-items:center}
#yvtr .vb{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:4px 0 6px}
#yvtr .vf{padding:8px 14px 12px;display:grid;gap:8px;border-top:1px solid rgba(255,255,255,.08)}
#yvtr .vdev{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#ff9f0a;color:#0b0b0d;font-size:10.5px;font-weight:800;vertical-align:2px}
#yvtr .btn,#yvtr .tbtn{width:100%;padding:13px;border-radius:15px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#f5f5f7;font:700 15px inherit;cursor:pointer;display:flex;gap:7px;align-items:center;justify-content:center}
#yvtr .btn.main,#yvtr .tbtn.main{background:#f5f5f7;color:#0b0b0d;border-color:transparent}#yvtr .btn:disabled{opacity:.4}
#yvtr .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#yvtr .chip{flex:none;padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e4e4e7;font:600 13px inherit;cursor:pointer}
#yvtr .chip[aria-pressed=true]{background:#f5f5f7;color:#0b0b0d}
#yvtr .up{flex:1;min-height:0;width:min(78%,320px);margin:0 auto;display:grid;place-items:center;align-content:center;gap:8px;border-radius:26px;border:1.5px dashed rgba(255,255,255,.22);background:rgba(255,255,255,.04);color:#f5f5f7;cursor:pointer;text-align:center;font:700 16px inherit;padding:16px}
#yvtr .up small{color:#a1a1aa;font-weight:500;font-size:12.5px}
#yvtr .tpls{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;padding:12px 14px 0}
#yvtr input[type=text]{width:100%;padding:11px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font:15px inherit}
#yvtr .dots{display:flex;gap:5px;justify-content:center;padding:4px 14px 8px;flex-wrap:wrap}#yvtr .dots button{width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:#d4d4d8;font:700 12px inherit;cursor:pointer}
#yvtr .dots button.ok{background:#30d158;color:#0b0b0d;border-color:transparent}#yvtr .dots button.on{outline:2px solid #f5f5f7}
#yvtr .card{flex:1;min-height:0;display:flex;flex-direction:column;gap:10px;padding:0 16px}
#yvtr .cvis{flex:1;min-height:0;display:flex;gap:10px;align-items:stretch;justify-content:center}
#yvtr .sk{flex:1;min-height:0;max-width:240px;border-radius:18px;background:#fff center/contain no-repeat;position:relative;overflow:hidden}
#yvtr .sk.load::after{content:"малюю…";position:absolute;inset:auto 0 10px;text-align:center;color:#71717a;font-size:12px}
#yvtr .sk video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#yvtr .side{width:110px;display:flex;flex-direction:column;gap:8px}#yvtr .cam{width:110px;height:110px}
#yvtr .tag{font-size:12px;color:#a1a1aa;line-height:1.3}#yvtr .tag b{color:#f5f5f7;display:block;font-size:13px}
#yvtr .what{font-size:16px;font-weight:700;line-height:1.35}#yvtr .how{font-size:14px;color:#a1a1aa;margin-top:2px}
#yvtr .ostxt{display:inline-block;margin-top:4px;padding:2px 8px;border-radius:8px;background:rgba(255,214,10,.14);color:#ffe27a;font-size:12.5px}
#yvtr .stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}#yvtr .cvw{position:relative;border-radius:16px;overflow:hidden;background:#000}#yvtr .cvw canvas{display:block;width:100%;height:100%}
#yvtr .pb{position:absolute;inset:0;display:grid;place-items:center;background:none;border:0;color:#fff;cursor:pointer}#yvtr .pb i{width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.45);display:grid;place-items:center}
#yvtr .tg{display:flex;align-items:center;gap:10px;font-size:13.5px;color:#d4d4d8;justify-content:center}#yvtr .tg input{width:20px;height:20px;accent-color:#30d158}
#yvtr .tip{margin:6px 16px 0;padding:9px 12px;border-radius:14px;background:rgba(48,209,88,.1);border:1px solid rgba(48,209,88,.3);color:#bdf5cf;font-size:13px;text-align:center}
.tcam{position:fixed;inset:0;z-index:9500;background:#000;color:#fff;font:15px/1.4 var(--pfont,system-ui)}
.tcam>video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.tcam .ghost{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.32;mix-blend-mode:screen;filter:invert(1);pointer-events:none}.tcam.noghost .ghost{display:none}
.tcam .ttop{position:absolute;left:0;right:0;top:0;padding:calc(env(safe-area-inset-top) + 10px) 12px 12px;display:flex;gap:10px;align-items:center;background:linear-gradient(rgba(0,0,0,.6),transparent)}
.tcam .ttop span{flex:1;font-weight:600;text-shadow:0 1px 4px #000;font-size:14px}
.tcam .tcx,.tcam .tflip{width:40px;height:40px;border-radius:50%;border:0;background:rgba(0,0,0,.45);color:#fff;font-size:20px;flex:none}
.tcam .tcnt{position:absolute;inset:0;display:grid;place-items:center;font-size:120px;font-weight:800;text-shadow:0 4px 20px #000;pointer-events:none}
.tcam .tbot{position:absolute;left:0;right:0;bottom:0;padding:16px 20px calc(env(safe-area-inset-bottom) + 22px);display:grid;grid-template-columns:1fr auto 1fr;align-items:center;background:linear-gradient(transparent,rgba(0,0,0,.6))}
.tcam .trec{width:78px;height:78px;border-radius:50%;border:5px solid #fff;background:none;display:grid;place-items:center}.tcam .trec i{width:58px;height:58px;border-radius:50%;background:#ff3b30;transition:all .2s}.tcam.rec .trec i{width:30px;height:30px;border-radius:8px}
.tcam .tghost{justify-self:start;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.35);color:#fff;font:600 13px inherit}.tcam .tdur{justify-self:end;font-weight:700;text-shadow:0 1px 4px #000}
.tcam .trev{position:absolute;inset:0;background:#000;z-index:2}.tcam .trev video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.tcam .tbot2{position:absolute;left:14px;right:14px;bottom:calc(env(safe-area-inset-bottom) + 18px);display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tcam .tbtn{padding:15px;border-radius:16px;border:0;background:rgba(255,255,255,.18);color:#fff;font:700 16px inherit;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}.tcam .tbtn.main{background:#30d158;color:#0b0b0d}
${E().SHEET_CSS.replace(/^\./gm, "#yvtr .")}`;
  const UI = { root: null };
  let drawCards = null;
  function shell(title) {
    if (!document.getElementById("yvtrcss")) { const st = document.createElement("style"); st.id = "yvtrcss"; st.textContent = CSS; document.head.appendChild(st); }
    UI.root?.remove(); const d = document.createElement("div"); d.id = "yvtr";
    d.innerHTML = `<div class="vh"><b>${title}<span class="vdev">ТЕСТ</span></b><button class="vx" type="button" id="tclose" aria-label="Закрити">×</button></div><div class="vb"></div><div class="vf"></div>`;
    document.body.appendChild(d); UI.root = d; $(d, "#tclose").onclick = close; return d;
  }
  function close() { stopPlay(); UI.root?.remove(); UI.root = null; drawCards = null; }
  const FILM = `<svg viewBox="0 0 24 24" width="40" height="40"><path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10 9.5v5l4-2.5z" fill="currentColor"/></svg>`;

  function screenStart() {
    T = fresh(); const d = shell("Відео під тренд"), B = $(d, ".vb"), F = $(d, ".vf");
    B.innerHTML = `<label class="up" for="tref">${FILM}<span>Запис екрана з трендом</span><small>Побачив тренд — запиши екран 5–30 с і закинь сюди</small></label><input type="file" id="tref" accept="video/*" hidden>
      <div class="tpls"><span style="width:100%;text-align:center;color:#a1a1aa;font-size:12.5px">або без тренду:</span>${Object.entries(TPL).map(([k, v]) => `<button class="chip" type="button" data-tpl="${k}">${v.n}</button>`).join("")}</div>
      <div style="padding:12px 16px 0"><input type="text" id="ttopic" placeholder="Про що твоє відео? (необов'язково)"></div>`;
    F.innerHTML = `<div class="tg"><input type="checkbox" id="tgal"><label for="tgal">Також зберігати зняті кадри в галерею</label></div>`;
    const topic = () => { T.topic = $(B, "#ttopic").value.trim(); T.gallery = $(F, "#tgal").checked; };
    $(B, "#tref").onchange = async (e) => { const f = e.target.files?.[0]; if (!f) return; topic(); track("start", { v: "trend" });
      try { await busyRun("montage", () => analyze(f)); } catch (x) { console.error(x); say(x?.message === "long" ? "Запис задовгий — до 60 секунд" : "Не вийшло розібрати запис. Спробуй інший."); return; }
      T.clips = new Array(T.shots.length).fill(null); screenCards(); sketches(); };
    B.querySelectorAll("[data-tpl]").forEach((b) => b.onclick = async () => { topic(); const k = b.dataset.tpl; track("start", { v: k });
      T.shots = TPL[k].shots.map((s) => ({ ...s, cam: { ...s.cam }, how: s.how || "" })); T.clips = new Array(T.shots.length).fill(null);
      if (T.topic && sample) { try { const r = await sample.json(`Короткий вертикальний ролик без голосу, шаблон «${TPL[k].n}». Тема людини: «${T.topic}». Ось кадри: ${JSON.stringify(T.shots.map((s) => ({ what: s.what, text: s.text })))}.
Адаптуй під тему: для кожного кадру — що зняти (1 речення, просто) і короткий текст на екрані (до 6 слів, можна ""). Відповідай тільки JSON: {"shots":[{"what":"…","text":"…"}]}`, { cache: false });
        (r?.shots || []).forEach((q, i) => { if (T.shots[i]) { if (q.what) T.shots[i].what = String(q.what); if (typeof q.text === "string") T.shots[i].text = q.text; } }); } catch (x) {} }
      screenCards(); sketches(); });
  }

  function screenCards() {
    const d = UI.root, B = $(d, ".vb"), F = $(d, ".vf"); stopPlay(); B.dataset.v = "cards";
    drawCards = () => {
      if (!UI.root || B.dataset.v !== "cards") return;
      const s = T.shots[T.cur], c = T.clips[T.cur], all = T.clips.every(Boolean);
      B.dataset.v = "cards";
      B.innerHTML = `<div class="dots">${T.shots.map((_, i) => `<button class="${T.clips[i] ? "ok" : ""}${i === T.cur ? " on" : ""}" data-go="${i}">${i + 1}</button>`).join("")}</div>
        <div class="card"><div class="cvis"><div class="sk${s.img || c || s.photo ? "" : " load"}" style="${s.img ? `background-image:url(${s.img})` : s.photo ? "background:#1c1c20" : ""}">${c ? `<video src="${c.url}" playsinline muted autoplay loop></video>` : s.photo ? `<span style="position:absolute;inset:0;display:grid;place-items:center;color:#a1a1aa">фото</span>` : ""}</div>
          <div class="side">${camSVG(s.cam)}<div class="tag"><b>${CAMS[s.cam.pos]}</b>${{ close: "близько", mid: "середньо", far: "далеко" }[s.cam.dist]}${s.cam.move !== "static" ? " · рух" : " · нерухомо"}</div><div class="tag"><b>${s.d.toFixed(1)} с</b>знімай довше — найкраще виберемо</div></div></div>
          <div><div class="what">${escH(s.what)}</div>${s.how ? `<div class="how">${escH(s.how)}</div>` : ""}${s.text ? `<span class="ostxt">Текст: «${escH(s.text)}»</span>` : ""}</div></div>`;
      F.innerHTML = `<div class="two">${s.photo ? `<label class="btn" for="tfile">${c ? "↻ Інше фото" : "Вибрати фото"}</label>` : `<button class="btn main" type="button" id="tshoot">${c ? "↻ Переписати" : "● Зняти"}</button><label class="btn" for="tfile">З галереї</label>`}</div><input type="file" id="tfile" accept="${s.photo ? "image/*" : "video/*"}" hidden>
        <button class="btn${all ? " main" : ""}" type="button" id="tbuild"${T.clips.some(Boolean) ? "" : " disabled"}>${all ? "Зібрати відео →" : `Зібрати (${T.clips.filter(Boolean).length} з ${T.shots.length})`}</button>`;
      B.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => { T.cur = +b.dataset.go; drawCards(); });
      const take = async (file, fromCam) => { if (!file) return; const i = T.cur; const url = URL.createObjectURL(file), isV = /^video/.test(file.type) || /\.(mp4|mov|webm|m4v)$/i.test(file.name);
        let el; if (isV) { el = mkVideo(url); await loadMeta(el); } else { el = new Image(); el.src = url; await el.decode().catch(() => {}); }
        const clip = { kind: isV ? "video" : "img", el, url, file, in: 0, fromCam }; if (isV) { const p = await pickBest(clip, T.shots[i]); clip.in = p.in; }
        T.clips[i] = clip; track("shoot", { v: isV ? "video" : "photo" });
        const next = T.clips.findIndex((x, k) => !x && k > i); T.cur = next >= 0 ? next : T.clips.findIndex((x) => !x) >= 0 ? T.clips.findIndex((x) => !x) : i; drawCards();
        if (next >= 0 && !T.shots[next].photo && clip.fromCam) setTimeout(() => $(F, "#tshoot")?.click(), 350); };
      $(F, "#tfile").onchange = async (e) => { const f = e.target.files?.[0]; e.target.value = ""; await take(f); };
      $(F, "#tshoot")?.addEventListener("click", () => camera(s, async (file, err) => { if (err === "nocam") { say("Камера недоступна — вибери з галереї"); $(F, "#tfile").click(); return; } if (!file) return;
        await take(file, true); }));
      $(F, "#tbuild").onclick = () => screenResult();
    };
    drawCards();
  }

  function screenResult() {
    const d = UI.root, B = $(d, ".vb"), F = $(d, ".vf"); stopPlay(); B.dataset.v = "res";
    B.innerHTML = `<div class="stage"><div class="cvw"><canvas id="tcv" width="540" height="960"></canvas><button class="pb" type="button" id="tpb"><i><svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg></i></button></div></div>
      ${T.refAud ? `<div class="tip">Звук тренду грає лише тут, для перевірки ритму. У Instagram/TikTok вибери цей звук при публікації — так відео потрапить у тренд.</div>` : ""}`;
    F.innerHTML = `<div class="two"><button class="btn" type="button" id="tback">← Кадри</button><button class="btn main" type="button" id="tsave">Зберегти відео</button></div>`;
    const cv = $(B, "#tcv"), cw = $(B, ".cvw"), st = $(B, ".stage"); const fit = () => { const h = st.clientHeight - 6, w = Math.min(h * 9 / 16, st.clientWidth - 32); cw.style.width = w + "px"; cw.style.height = w * 16 / 9 + "px"; }; fit(); requestAnimationFrame(fit);
    frameAt(cv.getContext("2d"), 0, cv.width, cv.height);
    const pb = $(B, "#tpb"); pb.onclick = () => { if (PL) { stopPlay(); return; } pb.style.opacity = 0; play(cv, 0, { onend: () => { pb.style.opacity = 1; } }); };
    $(F, "#tback").onclick = () => { stopPlay(); screenCards(); };
    $(F, "#tsave").onclick = async (e) => { const b = e.currentTarget; stopPlay(); b.disabled = true; b.innerHTML = `Зберігаю… <b id="tpp">0%</b>`;
      try { const out = await exportVideo((p) => { const x = $(F, "#tpp"); if (x) x.textContent = Math.round(clamp(p) * 100) + "%"; });
        track("save", { v: T.refAud ? "trend" : "tpl" });
        // звук тренду не вшиваємо (права) — лише відео; людина додає звук у соцмережі
        const files = [new File([out.blob], `yuvi_trend_${new Date().toISOString().slice(0, 10)}.${out.ext}`, { type: out.blob.type })];
        if (T.gallery) T.clips.forEach((c, i) => c?.file && files.push(new File([c.file], `kadr_${i + 1}.${(c.file.name.split(".").pop() || "mp4")}`, { type: c.file.type })));
        await share(files);
      } catch (x) { console.error(x); say("Не вдалося зберегти відео"); }
      b.disabled = false; b.textContent = "Зберегти відео"; };
  }

  window.YVTrend = { open() { screenStart(); track("open"); }, _t: { T: () => T, set: (t) => { T = t; }, beatsFrom, cutsFrom, scan, analyze, camSVG, pickBest, screenCards, screenResult, exportVideo, fresh, TPL } };
})();
