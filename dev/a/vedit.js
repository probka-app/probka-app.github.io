/* YuVi · «Монтаж ваших відео» (тест, лише власник у /dev/).
   Людина завантажує своє відео (+ за бажанням скрін-приклад субтитрів, вставки, побажання голосом) →
   чистимо звук, розпізнаємо слова, AI вирізає паузи й паразити, ставить хук-плашку, зуми, акценти →
   превʼю з субтитрами → правки голосом/текстом/тапом → «Зберегти відео».
   Без генерації відео: усе поверх відзнятого людиною. Двигун звуку — спільний з озвучкою (talk.js). */
(() => {
  "use strict";
  const E = () => window.YVTalk._t;
  const OW = 1080, OH = 1920, FPS = 30;
  const $ = (r, s) => r.querySelector(s);
  const escH = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const say = (t) => { try { toast(t); } catch (e) {} };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const AC = () => (window.__yvTalkAC ||= new (window.AudioContext || window.webkitAudioContext)());

  /* ---------- стилі субтитрів ---------- */
  const FONTS = ["Manrope", "Unbounded", "Rubik", "Comfortaa", "Pangolin", "Caveat", "Lobster", "Kurale", "Neucha"];
  const BASE = { font: "Manrope", weight: 800, size: 1, color: "#FFFFFF", hl: "#FFD60A", hlMode: "color", box: "none", boxColor: "#000000", outline: 7, outlineColor: "#000000", shadow: true, glow: false, upper: false, pos: .72, words: 3, anim: "pop" };
  const PRESETS = {
    yellow: { n: "Жовте слово", s: { upper: true } },
    classic: { n: "Класика", s: { hlMode: "none", outline: 8 } },
    box: { n: "Плашка", s: { box: "line", boxColor: "#000000", outline: 0, shadow: false, hl: "#FFD60A" } },
    pill: { n: "Виділене слово", s: { hlMode: "box", hl: "#FF3B30", outline: 0, shadow: true } },
    minimal: { n: "Мінімал", s: { font: "Rubik", weight: 500, size: .82, outline: 0, shadow: true, hlMode: "none", pos: .8, words: 4 } },
    neon: { n: "Неон", s: { font: "Comfortaa", weight: 700, glow: true, hl: "#30D158", outline: 0, shadow: false } },
    hand: { n: "Від руки", s: { font: "Pangolin", weight: 400, size: 1.1, outline: 6, hl: "#FFD60A" } },
  };

  /* ---------- стан ---------- */
  let P = null; // проєкт
  const fresh = () => ({ main: null, media: [], styleImgs: [], wish: "", aud: null, words: [], cut: new Set(), zoom: new Set(), emph: new Set(), broll: [], hook: "", style: { ...BASE, ...PRESETS.yellow.s }, preset: "yellow", hist: [] });
  const snapState = () => JSON.stringify({ cut: [...P.cut], zoom: [...P.zoom], emph: [...P.emph], broll: P.broll, hook: P.hook, style: P.style, preset: P.preset });
  const pushHist = () => { P.hist.push(snapState()); if (P.hist.length > 30) P.hist.shift(); };
  const popHist = () => { const s = P.hist.pop(); if (!s) return false; const o = JSON.parse(s); P.cut = new Set(o.cut); P.zoom = new Set(o.zoom); P.emph = new Set(o.emph); P.broll = o.broll; P.hook = o.hook; P.style = o.style; P.preset = o.preset; return true; };

  /* ---------- таймлайн: які шматки відео лишаються ---------- */
  let SEG = [], TOT = 0, OUTA = null, CHUNKS = [], WOUT = [];
  function build() {
    const W = P.words, keep = W.map((w, i) => i).filter((i) => !P.cut.has(i)), SR = E().SR, src = { x: P.aud };
    const runs = []; let r = null;
    for (const i of keep) { if (r && i === r.last + 1 && W[i].s - W[r.last].e < .6) { r.e = W[i].e; r.last = i; } else { r && runs.push(r); r = { s: W[i].s, e: W[i].e, last: i }; } }
    r && runs.push(r);
    let segs = runs.map((q) => ({ a: E().snap(src, Math.max(0, q.s - .07), -1) / SR, b: Math.min(P.main.dur, E().snap(src, q.e + .1, 1) / SR) }));
    segs = segs.filter((s) => s.b - s.a > .08).reduce((acc, s) => { const l = acc[acc.length - 1]; if (l && s.a <= l.b + .02) l.b = Math.max(l.b, s.b); else acc.push({ ...s }); return acc; }, []);
    if (!segs.length) segs = [{ a: 0, b: Math.min(1, P.main.dur) }];
    let o = 0; segs.forEach((s) => { s.o = o; o += s.b - s.a; }); SEG = segs; TOT = o;
    // аудіо: склейка з м'якими стиками
    const n = Math.ceil(TOT * SR) + 1, y = new Float32Array(n), F = Math.round(SR * .01);
    for (const s of SEG) { const a = Math.round(s.a * SR), L = Math.round((s.b - s.a) * SR), oo = Math.round(s.o * SR);
      for (let j = 0; j < L && oo + j < n; j++) { const f = Math.min(1, j / F, (L - j) / F); y[oo + j] += (P.aud[a + j] || 0) * f; } }
    OUTA = E().master(y);
    // час кожного слова у фінальному відео
    WOUT = W.map((w, wi) => { if (P.cut.has(wi)) return null; const s = SEG.find((q) => w.s >= q.a - .08 && w.s < q.b); return s ? { s: s.o + Math.max(0, w.s - s.a), e: s.o + Math.min(s.b - s.a, w.e - s.a) } : null; });
    // субтитри: короткі шматки по кілька слів
    CHUNKS = []; let c = null; const maxW = clamp(P.style.words | 0, 1, 6);
    keep.forEach((i) => { const t = WOUT[i]; if (!t) return; const wd = W[i].w, len = c ? c.idx.reduce((a, k) => a + W[k].w.length + 1, 0) : 0;
      if (!c || c.idx.length >= maxW || len + wd.length > (maxW <= 2 ? 14 : 20) || /[.!?…,:;]$/.test(W[c.idx[c.idx.length - 1]].w) || t.s - c.e > .45) { c && CHUNKS.push(c); c = { idx: [i], s: t.s, e: t.e }; }
      else { c.idx.push(i); c.e = t.e; } });
    c && CHUNKS.push(c);
    CHUNKS.forEach((q, k) => { q.until = CHUNKS[k + 1] ? Math.min(CHUNKS[k + 1].s, q.e + .6) : q.e + .6; });
  }
  const outToSrc = (t) => { for (const s of SEG) if (t < s.o + (s.b - s.a)) return { seg: s, src: s.a + Math.max(0, t - s.o) }; const l = SEG[SEG.length - 1]; return { seg: l, src: l.b }; };
  const wordAt = (t) => { let best = -1; P.words.forEach((w, i) => { const o = WOUT[i]; if (o && t >= o.s - .03 && t < o.e + .12) best = i; }); return best; };

  /* ---------- малювання кадру ---------- */
  function cover(x, el, w, h, W, H, k = 1) { const r = Math.max(W / w, H / h) * k, dw = w * r, dh = h * r; x.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh); }
  function drawMain(x, el, W, H, zoom) {
    const vw = el.videoWidth || el.naturalWidth || W, vh = el.videoHeight || el.naturalHeight || H;
    if (!vw || !vh) return;
    x.save(); x.translate(W / 2, H / 2); x.scale(zoom, zoom); x.translate(-W / 2, -H / 2);
    if (vw / vh > .8) { // горизонтальне/квадратне — розмитий фон + відео по ширині
      if ("filter" in x) { x.filter = "blur(40px) brightness(.6)"; cover(x, el, vw, vh, W, H, 1.1); x.filter = "none"; } else { cover(x, el, vw, vh, W, H); x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, 0, W, H); }
      const r = W / vw, dh = vh * r; x.drawImage(el, 0, (H - dh) / 2, W, dh);
    } else cover(x, el, vw, vh, W, H);
    x.restore();
  }
  const fontStr = (st, px) => `${st.weight || 800} ${px}px "${st.font}", system-ui, sans-serif`;
  function rr(x, a, b, w, h, r) { x.beginPath(); x.roundRect ? x.roundRect(a, b, w, h, r) : x.rect(a, b, w, h); }
  function drawSubs(x, t, W, H) {
    const st = P.style, k = W / OW, ch = CHUNKS.find((c) => t >= c.s - .04 && t < c.until); if (!ch) return;
    const cur = wordAt(t), px = Math.round(66 * (st.size || 1) * k), words = ch.idx.map((i) => ({ i, t: st.upper ? P.words[i].w.toUpperCase() : P.words[i].w.replace(/[.,!?…:;]+$/, (m) => m === "," ? "" : m) }));
    x.font = fontStr(st, px); x.textBaseline = "middle"; x.textAlign = "left";
    const sp = x.measureText(" ").width, maxW = W * .84, lines = [[]]; let lw = 0;
    words.forEach((w) => { w.w = x.measureText(w.t).width; if (lines[lines.length - 1].length && lw + sp + w.w > maxW) { lines.push([]); lw = 0; } lines[lines.length - 1].push(w); lw += (lw ? sp : 0) + w.w; });
    const lh = px * 1.25, cy = H * clamp(st.pos, .12, .9), age = t - ch.s, pop = st.anim === "pop" ? (age < .12 ? .86 + age / .12 * .14 : 1) : 1;
    x.save(); x.translate(W / 2, cy); x.scale(pop, pop); x.translate(-W / 2, -cy);
    lines.forEach((L, li) => {
      const tw = L.reduce((a, w) => a + w.w, 0) + sp * (L.length - 1), y = cy + (li - (lines.length - 1) / 2) * lh; let xx = (W - tw) / 2;
      if (st.box === "line") { x.fillStyle = hexA(st.boxColor, .62); rr(x, xx - px * .35, y - lh / 2 + px * .02, tw + px * .7, lh - px * .04, px * .25); x.fill(); }
      L.forEach((w) => {
        const isCur = w.i === cur, isEm = P.emph.has(w.i), useHl = (st.hlMode === "color" && isCur) || isEm;
        if (st.hlMode === "box" && isCur) { x.fillStyle = st.hl; rr(x, xx - px * .14, y - px * .62, w.w + px * .28, px * 1.24, px * .22); x.fill(); }
        x.lineJoin = "round"; x.miterLimit = 2;
        if (st.shadow) { x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = px * .18; x.shadowOffsetY = px * .05; }
        if (st.glow) { x.shadowColor = useHl ? st.hl : st.color; x.shadowBlur = px * .45; x.shadowOffsetY = 0; }
        if (st.outline > 0) { x.lineWidth = st.outline * 2 * k * (st.size || 1); x.strokeStyle = st.outlineColor; x.strokeText(w.t, xx, y); }
        x.fillStyle = useHl && !(st.hlMode === "box" && isCur) ? st.hl : st.color; x.fillText(w.t, xx, y);
        x.shadowColor = "transparent"; x.shadowBlur = 0; x.shadowOffsetY = 0; xx += w.w + sp; });
    });
    x.restore();
  }
  function hexA(h, a) { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); if (!m) return `rgba(0,0,0,${a})`; const n = parseInt(m[1], 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
  function drawHook(x, t, W, H) {
    if (!P.hook || t > 2.9) return; const k = W / OW, a = t < .25 ? t / .25 : t > 2.6 ? (2.9 - t) / .3 : 1, s = t < .25 ? .8 + .2 * (1 - Math.pow(1 - t / .25, 3)) : 1;
    const px = Math.round(58 * k), maxW = W * .8; x.font = `600 ${px}px "Unbounded", "Manrope", sans-serif`;
    const ws = P.hook.split(/\s+/), lines = [""]; ws.forEach((w) => { const tt = lines[lines.length - 1] ? lines[lines.length - 1] + " " + w : w; if (x.measureText(tt).width > maxW && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = tt; });
    const lh = px * 1.28, bw = Math.max(...lines.map((l) => x.measureText(l).width)) + px * 1.1, bh = lines.length * lh + px * .7, cx = W / 2, cy = H * .17;
    x.save(); x.globalAlpha = clamp(a); x.translate(cx, cy); x.scale(s, s); x.rotate(-.025);
    x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 30 * k; x.shadowOffsetY = 10 * k; x.fillStyle = "#FFFFFF"; rr(x, -bw / 2, -bh / 2, bw, bh, px * .35); x.fill(); x.shadowColor = "transparent";
    x.fillStyle = "#0B0B0D"; x.textAlign = "center"; x.textBaseline = "middle"; lines.forEach((l, i) => x.fillText(l, 0, (i - (lines.length - 1) / 2) * lh)); x.restore();
  }
  function zoomAt(t) { let z = 1; for (const i of P.zoom) { const o = WOUT[i]; if (!o) continue; const d = t - (o.s - .05); if (d < 0 || d > 1.35) continue; const e = d < .18 ? 1 - Math.pow(1 - d / .18, 3) : d > 1.05 ? 1 - (d - 1.05) / .3 : 1; z = Math.max(z, 1 + .13 * clamp(e)); } return z; }
  function brollAt(t) { for (const b of P.broll) { const a = WOUT[b.a], e = WOUT[b.b]; if (!a || !e) continue; if (t >= a.s && t < e.e + .2) return { b, t0: a.s, t1: e.e + .2 }; } return null; }
  function drawFrame(x, t, W, H, vEl) {
    x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
    const br = brollAt(t), z = zoomAt(t);
    drawMain(x, vEl, W, H, z);
    if (br) { const m = P.media[br.b.m]; if (m) { const fa = clamp(Math.min((t - br.t0) / .12, (br.t1 - t) / .12)); x.save(); x.globalAlpha = fa;
      const el = m.el, k = m.kind === "img" ? 1 + .06 * clamp((t - br.t0) / Math.max(.5, br.t1 - br.t0)) : 1; cover(x, el, el.videoWidth || el.naturalWidth || W, el.videoHeight || el.naturalHeight || H, W, H, k); x.restore(); } }
    drawSubs(x, t, W, H); drawHook(x, t, W, H);
  }

  /* ---------- програвач: два відео-елементи по черзі, щоб склейки були без «замерзань» ---------- */
  let PL = null;
  const mkVideo = (url) => { const v = document.createElement("video"); v.src = url; v.muted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "auto"; v.crossOrigin = "anonymous"; return v; };
  const seekTo = (v, t) => new Promise((ok) => { if (Math.abs(v.currentTime - t) < .02 && v.readyState >= 2) return ok(); const f = () => { v.removeEventListener("seeked", f); ok(); }; v.addEventListener("seeked", f); v.currentTime = t; setTimeout(f, 1500); });
  function stopPlay() { if (!PL) return; cancelAnimationFrame(PL.raf); try { PL.src.stop(); } catch (e) {} PL.vids.forEach((v) => v.pause()); P.media.forEach((m) => m.kind === "video" && m.el.pause()); PL.onend?.(); PL = null; }
  async function playFrom(t0, cv, opts = {}) {
    stopPlay(); const ac = AC(); try { await ac.resume(); } catch (e) {}
    const x = cv.getContext("2d"), W = cv.width, H = cv.height, vids = P.vids; let segI = SEG.indexOf(outToSrc(t0).seg), cur = vids[0], nxt = vids[1];
    await seekTo(cur, outToSrc(t0).src); if (SEG[segI + 1]) seekTo(nxt, SEG[segI + 1].a);
    const b = ac.createBuffer(1, OUTA.length, E().SR); b.copyToChannel(OUTA, 0); const src = ac.createBufferSource(); src.buffer = b;
    if (opts.dest) src.connect(opts.dest); if (!opts.silent) src.connect(ac.destination); else { const g = ac.createGain(); g.gain.value = 0; src.connect(g); g.connect(ac.destination); }
    const start = ac.currentTime + .08; src.start(start, t0); cur.play().catch(() => {});
    PL = { src, vids, raf: 0, onend: opts.onend };
    let brEl = null;
    const loop = () => { if (!PL) return; const t = t0 + ac.currentTime - start;
      if (t >= TOT) { drawFrame(x, TOT - .01, W, H, cur); opts.prog?.(1); const done = opts.done; stopPlay(); done?.(); return; }
      const m = outToSrc(Math.max(0, t)), si = SEG.indexOf(m.seg);
      if (si !== segI) { // перехід на наступний шматок: підготовлене відео вже на місці
        segI = si; cur.pause(); [cur, nxt] = [nxt, cur]; if (Math.abs(cur.currentTime - m.src) > .2) cur.currentTime = m.src; cur.play().catch(() => {}); if (SEG[si + 1]) { nxt.pause(); nxt.currentTime = SEG[si + 1].a; } }
      else if (t > 0 && Math.abs(cur.currentTime - m.src) > .25) cur.currentTime = m.src;
      const br = brollAt(t); const me = br && P.media[br.b.m];
      if (me && me.kind === "video") { if (brEl !== me.el) { brEl && brEl.pause(); brEl = me.el; brEl.currentTime = Math.max(0, t - br.t0); brEl.play().catch(() => {}); } }
      else if (brEl) { brEl.pause(); brEl = null; }
      drawFrame(x, Math.max(0, t), W, H, cur); opts.prog?.(t / TOT); opts.tick?.(t);
      PL.raf = requestAnimationFrame(loop); };
    PL.raf = requestAnimationFrame(loop);
  }
  async function still(t, cv) { const m = outToSrc(t), v = P.vids[0]; await seekTo(v, m.src); const br = brollAt(t), me = br && P.media[br.b.m]; if (me?.kind === "video") await seekTo(me.el, Math.max(0, t - br.t0)); drawFrame(cv.getContext("2d"), t, cv.width, cv.height, v); }

  /* ---------- збереження: запис кадрів у реальному часі ---------- */
  async function exportVideo(onProg) {
    try { await document.fonts?.ready; } catch (e) {}
    const cv = document.createElement("canvas"); cv.width = OW; cv.height = OH; const ac = AC(), dest = ac.createMediaStreamDestination();
    const stream = cv.captureStream(FPS); dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mime = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error("no recorder");
    await still(0, cv);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 9e6 }), ch = []; rec.ondataavailable = (e) => e.data.size && ch.push(e.data);
    const stopped = new Promise((r) => rec.onstop = r); rec.start(500);
    await new Promise((res) => playFrom(0, cv, { dest, silent: true, prog: onProg, done: res, onend: res }));
    await new Promise((r) => setTimeout(r, 250)); rec.stop(); await stopped;
    return { blob: new Blob(ch, { type: mime.split(";")[0] }), ext: mime.includes("mp4") ? "mp4" : "webm" };
  }
  async function saveBlob(blob, name) {
    const file = new File([blob], name, { type: blob.type });
    if (/iPhone|iPad|Android/i.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch (e) { if (e?.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- AI ---------- */
  const numbered = () => P.words.map((w, i) => `${P.cut.has(i) ? "[" : ""}${i}:${w.w}${P.cut.has(i) ? "]" : ""}`).join(" ");
  const mediaList = () => P.media.length ? P.media.map((m, k) => `${k}: ${m.kind === "img" ? "фото" : "відео"} «${m.name}»`).join("; ") : "немає";
  async function aiPlan() {
    let r = null;
    try {
      r = await sample.json(`Ти монтажер коротких вертикальних відео (Reels/TikTok/Shorts). Людина завантажила своє відео — ось дослівна розшифровка, кожне слово з номером:
${numbered()}

Побажання людини: ${P.wish ? `«${P.wish}»` : "немає — зроби як для сильного Reels"}.
Вставки, які людина завантажила (номер: тип «назва»): ${mediaList()}.

Склади план монтажу. Можна ТІЛЬКИ вирізати (порядок слів не змінюється).
- keep: діапазони номерів слів, які лишаються (у хронологічному порядку). Виріж слова-паразити (ну, типу, коротше, е-е, значить, от), повтори й фальстарти (лиши вдалий варіант), обірвані фрази, «зараз скажу». Кожен шматок має звучати граматично цілим.
- hook: коротка плашка-заголовок на перші 2–3 секунди (до 6 слів, без лапок), яка чіпляє увагу. Якщо людина просила без плашки — "".
- zoom: 2–5 номерів слів, на яких зробити легкий наїзд камери (найсильніші моменти).
- emph: 2–6 номерів ключових слів, які виділити кольором у субтитрах.
- broll: куди поставити вставки [{"m":номер вставки,"a":номер слова початку,"b":номер слова кінця}] — тільки якщо зрозуміло з назви вставки або з побажань; інакше [].
Відповідай тільки JSON: {"keep":[[a,b],...],"hook":"...","zoom":[...],"emph":[...],"broll":[...]}`, { cache: false });
    } catch (e) { r = null; }
    const n = P.words.length, keep = new Set();
    if (Array.isArray(r?.keep)) for (const [a, b] of r.keep) for (let i = Math.max(0, a | 0); i <= Math.min(n - 1, b | 0); i++) keep.add(i);
    if (!keep.size) P.words.forEach((w, i) => { if (!E().FILLERS.test(E().norm(w.w))) keep.add(i); });
    P.cut = new Set(P.words.map((w, i) => i).filter((i) => !keep.has(i)));
    P.hook = typeof r?.hook === "string" ? r.hook.trim().slice(0, 60) : "";
    const okI = (v) => Number.isInteger(v) && v >= 0 && v < n;
    P.zoom = new Set((r?.zoom || []).filter(okI)); P.emph = new Set((r?.emph || []).filter(okI));
    P.broll = (r?.broll || []).filter((b) => okI(b.a) && okI(b.b) && b.b >= b.a && P.media[b.m]).map((b) => ({ m: b.m, a: b.a, b: b.b }));
  }
  async function aiStyleFromShots() {
    if (!P.styleImgs.length || !SRV.aiVision) return;
    try {
      const s = await SRV.aiVision(`На скріні(ах) — приклад субтитрів у відео, які людина хоче повторити. Визнач стиль субтитрів і поверни тільки JSON:
{"font": один з ${JSON.stringify(FONTS)} — найближчий на вигляд (жирний гротеск → Manrope; широкий геометричний → Unbounded; округлий → Comfortaa; рукописний → Pangolin або Caveat),
"weight": 400|600|800, "upper": true|false, "color": "#RRGGBB" основного тексту, "hl": "#RRGGBB" колір поточного/виділеного слова (або той самий),
"hlMode": "color" (поточне слово іншим кольором) | "box" (поточне слово на кольоровій плашці) | "none",
"box": "none" | "line" (уся фраза на плашці), "boxColor": "#RRGGBB", "outline": 0-10 (товщина обведення), "outlineColor": "#RRGGBB", "shadow": true|false, "glow": true|false,
"size": 0.6-1.5 (відносно звичайного), "pos": 0.1-0.9 (вертикальне положення центру тексту від верху кадру), "words": 1-5 (скільки слів одночасно на екрані)}`, P.styleImgs);
      if (s && typeof s === "object") { P.style = sanitizeStyle({ ...P.style, ...s }); P.preset = "shot"; }
    } catch (e) { console.warn(e); }
  }
  function sanitizeStyle(s) {
    const hex = (v, d) => /^#[0-9a-f]{6}$/i.test(String(v)) ? v : d;
    return { ...BASE, ...s, font: FONTS.includes(s.font) ? s.font : "Manrope", weight: [400, 500, 600, 700, 800].includes(+s.weight) ? +s.weight : 800, color: hex(s.color, "#FFFFFF"), hl: hex(s.hl, "#FFD60A"), boxColor: hex(s.boxColor, "#000000"), outlineColor: hex(s.outlineColor, "#000000"),
      hlMode: ["color", "box", "none"].includes(s.hlMode) ? s.hlMode : "color", box: s.box === "line" ? "line" : "none", outline: clamp(+s.outline || 0, 0, 10), size: clamp(+s.size || 1, .6, 1.5), pos: clamp(+s.pos || .72, .1, .9), words: clamp(+s.words | 0 || 3, 1, 6), upper: !!s.upper, shadow: s.shadow !== false, glow: !!s.glow };
  }
  async function aiCommand(text, words) {
    const r = await sample.json(`Ти монтажер. Поточний монтаж відео людини. Слова розшифровки з номерами (у квадратних дужках — вирізані):
${numbered()}
Плашка-хук: «${P.hook || "немає"}». Стиль субтитрів: ${JSON.stringify(P.style)}. Готові стилі: ${Object.entries(PRESETS).map(([k, v]) => `${k}=«${v.n}»`).join(", ")}. Шрифти: ${FONTS.join(", ")}.
Вставки: ${mediaList()}. Зараз стоять: ${JSON.stringify(P.broll)}. Наїзди на словах: ${JSON.stringify([...P.zoom])}. Виділені слова: ${JSON.stringify([...P.emph])}.

Людина ${words ? "сказала голосом" : "написала"}: «${text}»

Перетвори це на операції (масив ops):
{"op":"cut","start":N,"end":M} — вирізати слова; {"op":"restore","start":N,"end":M} — повернути вирізане;
{"op":"hook","text":"..."} ("" — прибрати плашку); {"op":"preset","name":"ключ готового стилю"};
{"op":"style","set":{...поля стилю: font, weight, upper, color, hl, hlMode, box, boxColor, outline, outlineColor, shadow, glow, size (0.6-1.5), pos (0.1-0.9), words (1-6)}};
{"op":"zoom","idx":N} / {"op":"unzoom","idx":N}; {"op":"emph","idx":N} / {"op":"unemph","idx":N};
{"op":"broll","m":номер вставки,"start":N,"end":M} / {"op":"unbroll","m":номер}.
Місце шукай за змістом. «Більші/менші субтитри» — size, «вище/нижче» — pos, «жовті» — color або hl. Якщо незрозуміло — ops порожні.
Відповідай тільки JSON: {"ops":[...],"say":"одне коротке речення — що зроблено"}`, { cache: false });
    const ops = Array.isArray(r?.ops) ? r.ops : [], n = P.words.length, okI = (v) => Number.isInteger(v) && v >= 0 && v < n;
    if (!ops.length) return r?.say || "Не зрозумів. Спробуй інакше, напр.: «зроби субтитри більшими і жовтими».";
    pushHist();
    for (const o of ops) {
      if (o.op === "cut" && okI(o.start) && okI(o.end)) for (let i = o.start; i <= o.end; i++) P.cut.add(i);
      else if (o.op === "restore" && okI(o.start) && okI(o.end)) for (let i = o.start; i <= o.end; i++) P.cut.delete(i);
      else if (o.op === "hook" && typeof o.text === "string") P.hook = o.text.slice(0, 60);
      else if (o.op === "preset" && PRESETS[o.name]) { P.style = sanitizeStyle({ ...BASE, ...PRESETS[o.name].s }); P.preset = o.name; }
      else if (o.op === "style" && o.set && typeof o.set === "object") { P.style = sanitizeStyle({ ...P.style, ...o.set }); P.preset = "custom"; }
      else if (o.op === "zoom" && okI(o.idx)) P.zoom.add(o.idx); else if (o.op === "unzoom") P.zoom.delete(o.idx);
      else if (o.op === "emph" && okI(o.idx)) P.emph.add(o.idx); else if (o.op === "unemph") P.emph.delete(o.idx);
      else if (o.op === "broll" && P.media[o.m] && okI(o.start) && okI(o.end)) { P.broll = P.broll.filter((b) => b.m !== o.m); P.broll.push({ m: o.m, a: o.start, b: Math.max(o.start, o.end) }); }
      else if (o.op === "unbroll") P.broll = P.broll.filter((b) => b.m !== o.m);
    }
    return r?.say || "Готово.";
  }

  /* ---------- завантаження файлів ---------- */
  const fileB64 = (f, max = 1280) => new Promise((ok, no) => { const im = new Image(); im.onload = () => { const r = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * r); c.height = Math.round(im.height * r); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", .85).split(",")[1]); }; im.onerror = no; im.src = URL.createObjectURL(f); });
  const loadMeta = (el) => new Promise((ok, no) => { if (el.readyState >= 1) return ok(); el.onloadedmetadata = () => ok(); el.onerror = () => no(new Error("video")); setTimeout(ok, 8000); });
  async function addMedia(f) {
    const url = URL.createObjectURL(f), isV = /^video\//.test(f.type) || /\.(mov|mp4|m4v|webm)$/i.test(f.name);
    if (isV) { const v = mkVideo(url); v.loop = true; await loadMeta(v); P.media.push({ kind: "video", el: v, url, name: f.name.replace(/\.[^.]+$/, "") }); }
    else { const im = new Image(); im.src = url; await im.decode().catch(() => {}); P.media.push({ kind: "img", el: im, url, name: f.name.replace(/\.[^.]+$/, "") }); }
  }

  /* ---------- інтерфейс ---------- */
  const ICON = {
    play: `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" width="20" height="20"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    film: `<svg viewBox="0 0 24 24" width="40" height="40"><rect x="3" y="5" width="13" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M16 10l5-3v10l-5-3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  };
  const CSS = `
#yvved{position:fixed;inset:0;z-index:9000;background:#0b0b0d;color:#f5f5f7;display:flex;flex-direction:column;font:15px/1.45 var(--pfont,system-ui,-apple-system,sans-serif);padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
#yvved *{box-sizing:border-box}
#yvved .vh{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 6px}#yvved .vh b{font-size:17px}
#yvved .vx{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font-size:20px;cursor:pointer}
#yvved .vb{flex:1;overflow-y:auto;padding:4px 14px 14px;-webkit-overflow-scrolling:touch}
#yvved .vf{padding:8px 14px 12px;display:grid;gap:8px;border-top:1px solid rgba(255,255,255,.08)}
#yvved .vdev{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#ff9f0a;color:#0b0b0d;font-size:10.5px;font-weight:800;vertical-align:2px}
#yvved .hint{color:#a1a1aa;font-size:13.5px;margin:2px 0 12px}
#yvved .up{display:grid;place-items:center;gap:6px;width:100%;padding:26px 14px;border-radius:22px;border:1.5px dashed rgba(255,255,255,.22);background:rgba(255,255,255,.04);color:#f5f5f7;cursor:pointer;text-align:center;font:600 15px inherit}
#yvved .up small{color:#a1a1aa;font-weight:500}#yvved .up.ok{border-style:solid;border-color:rgba(52,208,122,.6);background:rgba(52,208,122,.08)}
#yvved .opt{margin-top:12px;padding:12px;border-radius:18px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
#yvved .opt h4{margin:0 0 2px;font-size:14.5px}#yvved .opt p{margin:0 0 8px;color:#a1a1aa;font-size:12.5px}
#yvved .thumbs{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}#yvved .thumbs span{width:54px;height:72px;border-radius:10px;background:#222 center/cover;position:relative;font-size:10px;display:grid;place-items:end center;color:#fff;overflow:hidden}
#yvved .btn{width:100%;padding:12px;border-radius:15px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#f5f5f7;font:700 14.5px inherit;cursor:pointer;display:flex;gap:7px;align-items:center;justify-content:center}
#yvved .btn.main{background:#f5f5f7;color:#0b0b0d;border-color:transparent}#yvved .btn.rec{background:#ff453a;border-color:transparent}#yvved .btn:disabled{opacity:.4}
#yvved .two{display:grid;grid-template-columns:1fr 1fr;gap:8px}#yvved .three{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
#yvved .chip{flex:none;padding:6px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e4e4e7;font:600 12.5px inherit;cursor:pointer}
#yvved .chip[aria-pressed=true]{background:#f5f5f7;color:#0b0b0d}
#yvved .row{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0}#yvved .row::-webkit-scrollbar{display:none}
#yvved textarea{width:100%;min-height:54px;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font:15px inherit;resize:none}
#yvved .stage{display:flex;gap:10px;align-items:flex-start}
#yvved .cvw{position:relative;flex:none;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 10px 30px rgba(0,0,0,.5)}
#yvved .cvw canvas{display:block;width:100%;height:100%}
#yvved .cvw .pb{position:absolute;inset:0;display:grid;place-items:center;background:none;border:0;color:#fff;cursor:pointer}
#yvved .cvw .pb i{width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.45);display:grid;place-items:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#yvved .side{flex:1;min-width:0;display:grid;gap:8px;align-content:start}
#yvved .side .lbl{font-size:12px;color:#a1a1aa;font-weight:600;margin-top:2px}
#yvved .seek{width:100%;accent-color:#f5f5f7;margin:6px 0 2px}
#yvved .meta{display:flex;justify-content:space-between;color:#a1a1aa;font-size:12px}
#yvved .msg{margin:8px 0 0;padding:9px 12px;border-radius:14px;background:rgba(255,214,10,.1);border:1px solid rgba(255,214,10,.3);color:#ffe27a;font-size:13px}
#yvved .txt{font-size:17px;line-height:1.7;margin-top:10px;user-select:none;-webkit-user-select:none}
#yvved .w{padding:1px 1px;border-radius:6px;cursor:pointer}#yvved .w.cut{color:#5b5b63;text-decoration:line-through;font-size:13.5px}
#yvved .w.z{box-shadow:inset 0 -3px 0 #0a84ff}#yvved .w.em{color:#ffd60a}#yvved .w.br{background:rgba(52,208,122,.16)}#yvved .w.now{background:#ffd60a;color:#0b0b0d}
#yvved .leg{display:flex;gap:10px;flex-wrap:wrap;color:#a1a1aa;font-size:11.5px;margin-top:10px}#yvved .leg i{font-style:normal}
#yvved .pop{position:fixed;left:10px;right:10px;bottom:calc(env(safe-area-inset-bottom) + 120px);z-index:9001;background:rgba(28,28,32,.97);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:10px;display:grid;gap:6px;box-shadow:0 20px 50px rgba(0,0,0,.6)}
#yvved .pop .q{color:#a1a1aa;font-size:12.5px;padding:2px 4px}
#yvved .prog{height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}#yvved .prog i{display:block;height:100%;width:0;background:#30d158}`;
  const UI = { root: null };
  function shell(title) {
    if (!document.getElementById("yvvedcss")) { const st = document.createElement("style"); st.id = "yvvedcss"; st.textContent = CSS; document.head.appendChild(st); }
    UI.root?.remove(); const d = document.createElement("div"); d.id = "yvved";
    d.innerHTML = `<div class="vh"><b>${title}<span class="vdev">ТЕСТ</span></b><button class="vx" type="button" aria-label="Закрити">×</button></div><div class="vb"></div><div class="vf"></div>`;
    document.body.appendChild(d); UI.root = d; $(d, ".vx").onclick = close; return d;
  }
  function close() { stopPlay(); UI.root?.remove(); UI.root = null; }
  const busyRun = (k, fn) => E().busyRun(k, fn);

  function screenStart() {
    P = fresh(); const d = shell("Монтаж твого відео"), B = $(d, ".vb"), F = $(d, ".vf");
    B.innerHTML = `<p class="hint">Завантаж відео, де ти говориш у камеру. Ми приберемо паузи й «ну-е-типу», почистимо звук і додамо субтитри, плашку й наїзди. Усе можна поправити голосом.</p>
      <label class="up" id="upmain" for="vmain">${ICON.film}<span id="upt">Вибрати відео</span><small>до 3 хвилин · вертикальне найкраще</small></label><input type="file" id="vmain" accept="video/*" hidden>
      <div class="opt"><h4>Приклад субтитрів <small style="color:#a1a1aa;font-weight:500">· необов'язково</small></h4><p>Скрін з відео, де тобі подобаються субтитри — зробимо схоже.</p><label class="btn" for="vshot">+ Скрін-приклад</label><input type="file" id="vshot" accept="image/*" multiple hidden><div class="thumbs" id="shots"></div></div>
      <div class="opt"><h4>Вставки <small style="color:#a1a1aa;font-weight:500">· необов'язково</small></h4><p>Фото чи короткі відео, які показати поверх. Назва файлу підкаже, куди їх ставити — або скажеш потім.</p><label class="btn" for="vins">+ Фото або відео</label><input type="file" id="vins" accept="image/*,video/*" multiple hidden><div class="thumbs" id="ins"></div></div>
      <div class="opt"><h4>Що має бути у відео? <small style="color:#a1a1aa;font-weight:500">· необов'язково</small></h4><p>Розкажи голосом або напиши: стиль, що виділити, що прибрати.</p><textarea id="vwish" rows="2" placeholder="Напр.: динамічно, субтитри великі жовті, без плашки на початку"></textarea><button class="btn" type="button" id="vwrec" style="margin-top:6px">${ICON.mic} Сказати голосом</button></div>`;
    F.innerHTML = `<button class="btn main" type="button" id="vgo" disabled>Змонтувати</button>`;
    $(B, "#vmain").onchange = async (e) => { const f = e.target.files?.[0]; if (!f) return; if (f.size > 400e6) { say("Файл завеликий — до 400 МБ"); return; }
      const url = URL.createObjectURL(f), v = mkVideo(url); try { await loadMeta(v); } catch (x) { say("Це відео не відкривається в браузері"); return; }
      if (v.duration > 185) { say("Відео задовге — до 3 хвилин"); return; }
      P.main = { file: f, url, dur: v.duration, w: v.videoWidth, h: v.videoHeight }; $(B, "#upmain").classList.add("ok"); $(B, "#upt").textContent = "✓ " + f.name.slice(0, 32) + ` · ${fmt(v.duration)}`; $(F, "#vgo").disabled = false; };
    $(B, "#vshot").onchange = async (e) => { for (const f of [...e.target.files].slice(0, 3 - P.styleImgs.length)) { try { const d64 = await fileB64(f); P.styleImgs.push({ data: d64, mime: "image/jpeg" }); $(B, "#shots").insertAdjacentHTML("beforeend", `<span style="background-image:url(data:image/jpeg;base64,${d64})"></span>`); } catch (x) {} } };
    $(B, "#vins").onchange = async (e) => { for (const f of [...e.target.files].slice(0, 8)) { await addMedia(f); const m = P.media[P.media.length - 1]; $(B, "#ins").insertAdjacentHTML("beforeend", `<span style="background-image:url(${m.kind === "img" ? m.url : ""})">${m.kind === "video" ? "▶ " : ""}${escH(m.name.slice(0, 10))}</span>`); } };
    const wr = $(B, "#vwrec"), wl = wr.innerHTML;
    wr.onclick = () => E().record(wr, wl, async (buf) => { try { const t = await sttBuf(buf); $(B, "#vwish").value = ($(B, "#vwish").value + " " + t).trim(); } catch (x) { say("Не вийшло розпізнати"); } });
    $(F, "#vgo").onclick = () => { P.wish = $(B, "#vwish").value.trim(); run(); };
  }
  async function sttBuf(buf) {
    const raw = await E().decode(buf), small = await E().resample(raw, E().SR, 16000);
    const r = await SRV.stt({ audio: E().b64(E().wav(small, 16000)), mime: "audio/wav" }); return (r.words || []).map((w) => w.w).join(" ");
  }

  async function run() {
    try {
      const buf = await P.main.file.arrayBuffer();
      const raw = await busyRun("voice", () => E().decode(buf).catch(() => { throw new Error("noaudio"); }));
      P.aud = await busyRun("voice", async () => { await new Promise((r) => setTimeout(r, 40)); return E().processTake(raw); });
      const small = await E().resample(P.aud, E().SR, 16000);
      const r = await busyRun("listen", () => SRV.stt({ audio: E().b64(E().wav(small, 16000)), mime: "audio/wav", quiet: true }));
      const dur = P.aud.length / E().SR;
      P.words = (r.words || []).map((w) => ({ w: String(w.w), s: Math.max(0, +w.s || 0), e: Math.min(dur, Math.max((+w.s || 0) + .05, +w.e || 0)) })).filter((w) => w.w.trim());
      if (!P.words.length) { say("Не почув слів у відео"); return; }
      await aiStyleFromShots();
      await aiPlan();
      P.vids = [mkVideo(P.main.url), mkVideo(P.main.url)]; await Promise.all(P.vids.map(loadMeta));
      build(); screenEdit();
    } catch (e) { console.error(e); say(e?.message === "noaudio" ? "Не вдалося дістати звук з відео. Спробуй інший файл (MP4/MOV)." : e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло обробити відео. Спробуй ще раз."); }
  }

  function screenEdit(msg) {
    const d = UI.root?.querySelector(".stage") ? UI.root : shell("Монтаж твого відео"), B = $(d, ".vb"), F = $(d, ".vf");
    stopPlay();
    const cutN = P.cut.size, vw = Math.min(window.innerWidth * .5, (window.innerHeight * .46) * 9 / 16);
    B.innerHTML = `<div class="stage"><div class="cvw" style="width:${vw}px;height:${vw * 16 / 9}px"><canvas id="vcv" width="540" height="960"></canvas><button class="pb" type="button" id="vpb" aria-label="Дивитись"><i>${ICON.play}</i></button></div>
        <div class="side"><div class="lbl">Субтитри</div><div style="display:flex;flex-wrap:wrap;gap:5px">${Object.entries(PRESETS).map(([k, v]) => `<button class="chip" type="button" data-pr="${k}" aria-pressed="${P.preset === k}">${v.n}</button>`).join("")}${P.preset === "shot" ? `<button class="chip" type="button" aria-pressed="true">Як на скріні</button>` : ""}</div>
          <div class="lbl">Розмір</div><input class="seek" type="range" id="vsz" min="60" max="150" value="${Math.round(P.style.size * 100)}">
          <div class="lbl">Висота</div><input class="seek" type="range" id="vps" min="12" max="88" value="${Math.round(P.style.pos * 100)}"></div></div>
      <input class="seek" type="range" id="vseek" min="0" max="1000" value="0"><div class="meta"><span id="vtm">0:00 / ${fmt(TOT)}</span><span>було ${fmt(P.main.dur)} · вирізано слів: ${cutN}</span></div>
      ${msg ? `<div class="msg">${escH(msg)}</div>` : ""}
      <div class="opt" style="margin-top:10px;padding:10px"><div class="lbl" style="font-size:12px;color:#a1a1aa;font-weight:600">Плашка на початку</div><input id="vhook" value="${escH(P.hook)}" placeholder="без плашки" style="width:100%;margin-top:4px;padding:9px 11px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font:600 14.5px inherit"></div>
      <div class="txt">${P.words.map((w, i) => `<span class="w${P.cut.has(i) ? " cut" : ""}${P.zoom.has(i) ? " z" : ""}${P.emph.has(i) ? " em" : ""}${P.broll.some((b) => i >= b.a && i <= b.b) ? " br" : ""}" data-i="${i}">${escH(w.w)}</span>`).join(" ")}</div>
      <div class="leg"><i>Тапни слово: вирізати, наїзд, виділити, вставка</i><i style="text-decoration:line-through">вирізано</i><i style="box-shadow:inset 0 -3px 0 #0a84ff">наїзд</i><i style="color:#ffd60a">виділено</i><i style="background:rgba(52,208,122,.16)">вставка</i></div>`;
    F.innerHTML = `<div class="two"><button class="btn" type="button" id="vvoice">${ICON.mic} Сказати правку</button><button class="btn" type="button" id="vwrite">✍ Написати</button></div>
      <div class="three"><button class="btn" type="button" id="vundo"${P.hist.length ? "" : " disabled"}>↶</button><label class="btn" for="vins2">+ Вставка</label><button class="btn" type="button" id="vnew">Інше відео</button></div><input type="file" id="vins2" accept="image/*,video/*" multiple hidden>
      <button class="btn main" type="button" id="vsave">Зберегти відео</button>`;
    const cv = $(B, "#vcv"), pb = $(B, "#vpb"), seek = $(B, "#vseek"), tm = $(B, "#vtm"); let pos = 0;
    const setPlay = (on) => { pb.innerHTML = on ? "" : `<i>${ICON.play}</i>`; };
    const hlWord = (t) => { B.querySelectorAll(".w.now").forEach((e) => e.classList.remove("now")); const i = wordAt(t); if (i >= 0) B.querySelector(`.w[data-i="${i}"]`)?.classList.add("now"); };
    still(0, cv);
    pb.onclick = () => { if (PL) { stopPlay(); return; } setPlay(true); playFrom(pos >= TOT - .1 ? 0 : pos, cv, { tick: (t) => { pos = t; seek.value = Math.round(t / TOT * 1000); tm.textContent = `${fmt(t)} / ${fmt(TOT)}`; hlWord(t); }, onend: () => setPlay(false), done: () => { pos = 0; } }); };
    seek.oninput = () => { stopPlay(); pos = seek.value / 1000 * TOT; tm.textContent = `${fmt(pos)} / ${fmt(TOT)}`; still(pos, cv); };
    const restyle = () => { build(); if (!PL) still(pos, cv); };
    B.querySelectorAll("[data-pr]").forEach((b) => b.onclick = () => { pushHist(); P.preset = b.dataset.pr; P.style = sanitizeStyle({ ...BASE, ...PRESETS[P.preset].s }); B.querySelectorAll("[data-pr]").forEach((o) => o.setAttribute("aria-pressed", o === b)); $(B, "#vsz").value = Math.round(P.style.size * 100); $(B, "#vps").value = Math.round(P.style.pos * 100); restyle(); });
    $(B, "#vsz").oninput = (e) => { P.style.size = e.target.value / 100; restyle(); };
    $(B, "#vps").oninput = (e) => { P.style.pos = e.target.value / 100; restyle(); };
    $(B, "#vhook").onchange = (e) => { pushHist(); P.hook = e.target.value.trim(); if (!PL) still(Math.min(pos, 1), cv); };
    B.querySelectorAll(".w").forEach((w) => w.onclick = () => wordMenu(+w.dataset.i, w, cv, (t) => { pos = t; }));
    $(F, "#vundo").onclick = () => { if (popHist()) { build(); screenEdit("Скасовано."); } };
    $(F, "#vnew").onclick = () => { stopPlay(); screenStart(); };
    $(F, "#vins2").onchange = async (e) => { for (const f of [...e.target.files].slice(0, 8)) await addMedia(f); say("Вставку додано — тапни слово, щоб поставити, або скажи голосом"); };
    $(F, "#vwrite").onclick = () => writeCmd();
    const vv = $(F, "#vvoice"), vl = vv.innerHTML;
    vv.onclick = () => { stopPlay(); if (!vv._rec) say("Кажи, що змінити: «субтитри більші», «вирізай частину про…»"); E().record(vv, vl, async (buf) => {
      try { const t = await busyRun("listen", () => sttBuf(buf)); if (!t.trim()) { say("Не почув"); return; } const m = await aiCommand(t, true); build(); screenEdit(`«${t}» → ${m}`); } catch (x) { console.error(x); say("Не вийшло застосувати правку"); } }); };
    $(F, "#vsave").onclick = async () => {
      stopPlay(); const sv = $(F, "#vsave"); sv.disabled = true; sv.innerHTML = `<span style="flex:1">Зберігаю… <b id="vpp">0%</b></span>`;
      try { const out = await exportVideo((p) => { const e = $(F, "#vpp"); if (e) e.textContent = Math.round(clamp(p) * 100) + "%"; });
        await saveBlob(out.blob, `yuvi_montazh_${new Date().toISOString().slice(0, 10)}.${out.ext}`); if (out.ext !== "mp4") say("Збережено у webm — для Instagram краще зберігати в Safari на iPhone");
      } catch (x) { console.error(x); say("Не вдалося зберегти відео"); }
      sv.disabled = false; sv.textContent = "Зберегти відео"; still(0, cv); };
  }

  function wordMenu(i, el, cv, setPos) {
    stopPlay(); UI.root.querySelectorAll(".pop").forEach((p) => p.remove());
    const p = document.createElement("div"), inB = P.broll.find((b) => i >= b.a && i <= b.b); p.className = "pop";
    p.innerHTML = `<div class="q">«${escH(P.words[i].w)}»</div>
      <div class="two"><button class="btn" data-a="cut">${P.cut.has(i) ? "Повернути" : "Вирізати"}</button><button class="btn" data-a="sent">${P.cut.has(i) ? "Повернути до крапки" : "Вирізати до крапки"}</button></div>
      <div class="two"><button class="btn" data-a="zoom">${P.zoom.has(i) ? "Без наїзду" : "Наїзд тут"}</button><button class="btn" data-a="em">${P.emph.has(i) ? "Не виділяти" : "Виділити"}</button></div>
      ${P.media.length ? `<div class="q">Вставка з цього слова (≈2 с):</div><div class="row">${P.media.map((m, k) => `<button class="chip" data-m="${k}">${m.kind === "video" ? "▶ " : ""}${escH(m.name.slice(0, 14))}</button>`).join("")}${inB ? `<button class="chip" data-m="-1">Прибрати вставку</button>` : ""}</div>` : ""}
      <div class="two"><button class="btn" data-a="go">▶ Дивитись звідси</button><button class="btn" data-a="x">Закрити</button></div>`;
    UI.root.appendChild(p);
    const apply = (fn) => { pushHist(); fn(); p.remove(); build(); screenEdit(); };
    p.querySelector('[data-a="x"]').onclick = () => p.remove();
    p.querySelector('[data-a="cut"]').onclick = () => apply(() => { P.cut.has(i) ? P.cut.delete(i) : P.cut.add(i); });
    p.querySelector('[data-a="sent"]').onclick = () => apply(() => { const to = !P.cut.has(i); for (let j = i; j < P.words.length; j++) { to ? P.cut.add(j) : P.cut.delete(j); if (/[.!?…]$/.test(P.words[j].w)) break; } });
    p.querySelector('[data-a="zoom"]').onclick = () => apply(() => { P.zoom.has(i) ? P.zoom.delete(i) : P.zoom.add(i); });
    p.querySelector('[data-a="em"]').onclick = () => apply(() => { P.emph.has(i) ? P.emph.delete(i) : P.emph.add(i); });
    p.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => apply(() => { const m = +b.dataset.m; if (m < 0) { P.broll = P.broll.filter((q) => q !== inB); return; }
      let j = i, t0 = P.words[i].s; while (j + 1 < P.words.length && P.words[j + 1].e - t0 < 2.2) j++; P.broll = P.broll.filter((q) => q.m !== m); P.broll.push({ m, a: i, b: j }); }));
    p.querySelector('[data-a="go"]').onclick = () => { p.remove(); const o = WOUT[i] || WOUT.find((q, k) => k > i && q); const t = o ? Math.max(0, o.s - .1) : 0; setPos(t); UI.root.querySelector("#vpb")?.click(); };
  }
  function writeCmd() {
    UI.root.querySelectorAll(".pop").forEach((p) => p.remove());
    const p = document.createElement("div"); p.className = "pop";
    p.innerHTML = `<div class="q">Що змінити? Напр.: «субтитри по одному слову і більші», «прибери частину про ціни», «плашка: Як я заробив перші 1000»</div><textarea id="vcmd" rows="3"></textarea><div class="two"><button class="btn" data-a="x">Скасувати</button><button class="btn main" data-a="go">Застосувати</button></div>`;
    UI.root.appendChild(p); const ta = $(p, "#vcmd"); setTimeout(() => ta.focus(), 50);
    p.querySelector('[data-a="x"]').onclick = () => p.remove();
    p.querySelector('[data-a="go"]').onclick = async () => { const v = ta.value.trim(); if (!v) return; p.remove(); try { const m = await aiCommand(v, false); build(); screenEdit(m); } catch (x) { say("Не вийшло застосувати правку"); } };
  }

  window.YVVideo = { open() { screenStart(); }, _t: { set: (p) => { P = p; }, fresh, build, drawFrame, screenEdit, aiPlan, aiCommand, outToSrc, seg: () => SEG, tot: () => TOT, chunks: () => CHUNKS, exportVideo, P: () => P, mkVideo, loadMeta, run: () => run() } };
})();
