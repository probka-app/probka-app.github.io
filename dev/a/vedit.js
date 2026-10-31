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
  const track = (st, m) => { try { window.yvTrack?.("vedit", st, m); } catch (e) {} };
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
  // що додавати під час монтажу — галочки на старті (запам'ятовуємо)
  const OPTS = [["subs", "Субтитри"], ["hook", "Плашка-хук"], ["stock", "Фото й відео-вставки"], ["music", "Музика"], ["amb", "Фонові звуки"]];
  const loadOpt = () => { let o = {}; try { o = JSON.parse(localStorage.getItem("yv_ved_opt") || "{}"); } catch (e) {} return { subs: true, hook: true, stock: true, music: true, amb: false, ...o }; };
  const saveOpt = (o) => { try { localStorage.setItem("yv_ved_opt", JSON.stringify(o)); } catch (e) {} };
  const fresh = () => ({ opt: loadOpt(), main: null, media: [], styleImgs: [], wish: "", aud: null, words: [], cut: new Set(), zoom: new Set(), emph: new Set(), broll: [], hook: "", style: { ...BASE, ...PRESETS.yellow.s }, preset: "yellow", hist: [] });
  const snapState = () => JSON.stringify({ cut: [...P.cut], zoom: [...P.zoom], emph: [...P.emph], broll: P.broll, hook: P.hook, style: P.style, preset: P.preset });
  const pushHist = () => { P.hist.push(snapState()); if (P.hist.length > 30) P.hist.shift(); };
  const popHist = () => { const s = P.hist.pop(); if (!s) return false; const o = JSON.parse(s); P.cut = new Set(o.cut); P.zoom = new Set(o.zoom); P.emph = new Set(o.emph); P.broll = o.broll; P.hook = o.hook; P.style = o.style; P.preset = o.preset; return true; };

  /* ---------- таймлайн: які шматки відео лишаються ---------- */
  let SEG = [], TOT = 0, OUTA = null, CHUNKS = [], WOUT = [];
  function build() {
    const W = P.words, keep = W.map((w, i) => i).filter((i) => !P.cut.has(i)), SR = E().SR, src = { x: P.aud };
    const runs = []; let r = null;
    for (const i of keep) { if (r && i === r.last + 1 && W[i].s - W[r.last].e < .6 && clipIx(W[i].s) === clipIx(W[r.last].s)) { r.e = W[i].e; r.last = i; } else { r && runs.push(r); r = { s: W[i].s, e: W[i].e, last: i }; } }
    r && runs.push(r);
    // шматки з мовою + цілі кліпи без мови (наприклад, красиві кадри без слів)
    let segs = runs.map((q) => { const c = clipIx(q.s), C = P.clips[c]; return { c, a: Math.max(C.off, E().snap(src, Math.max(0, q.s - .12), -1) / SR), b: Math.min(C.off + C.dur - .02, E().snap(src, q.e + .22, 1) / SR) }; });
    P.clips.forEach((C, c) => { if (!W.some((w) => clipIx(w.s) === c)) segs.push({ c, a: C.off, b: C.off + C.dur - .02 }); });
    segs.sort((x, y) => x.a - y.a);
    segs = segs.filter((s) => s.b - s.a > .08).reduce((acc, s) => { const l = acc[acc.length - 1]; if (l && l.c === s.c && s.a <= l.b + .02) l.b = Math.max(l.b, s.b); else acc.push({ ...s }); return acc; }, []);
    if (!segs.length) segs = [{ c: 0, a: 0, b: Math.min(1, P.clips[0].dur) }];
    const per = {}; segs.forEach((s) => { const k = per[s.c] = (per[s.c] ?? -1) + 1; s.v = P.clips[s.c].vids[k % 2]; });
    let o = 0; segs.forEach((s) => { s.o = o; o += s.b - s.a; }); SEG = segs; TOT = o;
    // аудіо: склейка з м'якими стиками
    const n = Math.ceil(TOT * SR) + 1, y = new Float32Array(n), F = Math.round(SR * .01);
    for (const s of SEG) { const a = Math.round(s.a * SR), L = Math.round((s.b - s.a) * SR), oo = Math.round(s.o * SR);
      for (let j = 0; j < L && oo + j < n; j++) { const f = Math.min(1, j / F, (L - j) / F); y[oo + j] += (P.aud[a + j] || 0) * f; } }
    OUTA = E().master(y); OUTB = OUTA; FXK = ""; OUTV = null;
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
  // «Звук голосу» (пресети з озвучки) — накладаємо на готове аудіо перед програванням/збереженням
  let OUTB = null, FXK = "";
  let OUTV = null;
  async function ensureFx() { const want = P.fx || "orig", key = want + "|" + bedKey();
    if (FXK === key) return; if (!OUTV || FXK.split("|")[0] !== want) OUTV = want === "orig" ? OUTB : await E().applyFxTo(OUTB, { k: want, pitch: 0, tone: 0 });
    OUTA = mixBeds(OUTV); FXK = key; }
  const bedKey = () => ["music", "amb"].map((k) => P[k] && !P[k].off ? `${P[k].i}:${P[k].vol}` : "-").join(",");
  // музика й фон: по колу на всю довжину, плавний початок/кінець, тихішають, коли людина говорить
  function mixBeds(v) {
    const beds = ["music", "amb"].map((k) => P[k]).filter((b) => b && !b.off && b.buf?.length); if (!beds.length) return v;
    const SR = E().SR, y = Float32Array.from(v), env = E().envelope(v, Math.round(SR * .01)), n = env.length, duck = new Float32Array(n); let g = 1;
    for (let f = 0; f < n; f++) { const t = env[f] > .02 ? .45 : 1; g += (t < g ? .25 : .03) * (t - g); duck[f] = g; }
    for (const b of beds) { const src = b.buf, L = src.length, fade = SR * 1.2;
      for (let i = 0; i < y.length; i++) { const d = duck[Math.min(n - 1, (i / (SR * .01)) | 0)], e = Math.min(1, i / fade, (y.length - i) / fade); y[i] += src[i % L] * b.vol * d * e; } }
    return E().master(y);
  }
  const clipIx = (t) => { const C = P.clips; for (let i = C.length - 1; i >= 0; i--) if (t >= C[i].off - 1e-6) return i; return 0; };
  const local = (seg, src) => Math.max(0, src - P.clips[seg.c].off + (P.clips[seg.c].base || 0));
  const outToSrc = (t) => { for (const s of SEG) if (t < s.o + (s.b - s.a)) return { seg: s, src: s.a + Math.max(0, t - s.o) }; const l = SEG[SEG.length - 1]; return { seg: l, src: l.b }; };
  const wordAt = (t) => { let best = -1; P.words.forEach((w, i) => { const o = WOUT[i]; if (o && t >= o.s - .03 && t < o.e + .12) best = i; }); return best; };

  /* ---------- малювання кадру ---------- */
  function cover(x, el, w, h, W, H, k = 1) { const r = Math.max(W / w, H / h) * k, dw = w * r, dh = h * r; x.drawImage(el, (W - dw) / 2, (H - dh) / 2, dw, dh); }
  function drawMain(x, el, W, H, zoom) {
    const vw = el.videoWidth || el.naturalWidth || el.width || W, vh = el.videoHeight || el.naturalHeight || el.height || H;
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
    if (P.style.off) return; const st = P.style, k = W / OW, ch = CHUNKS.find((c) => t >= c.s - .04 && t < c.until); if (!ch) return;
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
  // вставка: на весь екран або віконцем (розмір і положення — повзунками), з вирізаним фоном для фото
  function drawLayer(x, m, br, t, W, H, ov) {
    const L = br.b, fa = clamp(Math.min((t - br.t0) / .12, (br.t1 - t) / .12)), el = L.cutBg && m.cut ? m.cut : (ov || m.el), ew = el.videoWidth || el.naturalWidth || el.width || W, eh = el.videoHeight || el.naturalHeight || el.height || H;
    const grow = m.kind === "img" ? 1 + .06 * clamp((t - br.t0) / Math.max(.5, br.t1 - br.t0)) : 1;
    x.save(); x.globalAlpha = fa;
    if (L.full !== false && !(L.cutBg && m.cut)) { cover(x, el, ew, eh, W, H, grow); x.restore(); return; }
    const sz = clamp(L.size ?? .6, .2, 1), w = W * sz, h = w * eh / ew, cx = W / 2 + (L.x || 0) * (W - w) / 2, cy = H / 2 + (L.y ?? -.3) * (H - h) / 2, pop = fa < 1 ? .92 + .08 * fa : 1;
    x.translate(cx, cy); x.scale(pop * grow, pop * grow);
    if (L.cutBg && m.cut) { x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 24 * W / OW; x.drawImage(el, -w / 2, -h / 2, w, h); }
    else { const r = 26 * W / OW; x.shadowColor = "rgba(0,0,0,.45)"; x.shadowBlur = 30 * W / OW; x.shadowOffsetY = 8 * W / OW; rr(x, -w / 2, -h / 2, w, h, r); x.fillStyle = "#000"; x.fill(); x.shadowColor = "transparent"; x.clip(); x.drawImage(el, -w / 2, -h / 2, w, h); }
    x.restore();
  }
  function drawFrame(x, t, W, H, vEl, brEl) {
    x.fillStyle = "#000"; x.fillRect(0, 0, W, H);
    const br = brollAt(t), z = zoomAt(t);
    drawMain(x, vEl, W, H, z);
    if (br) { const m = P.media[br.b.m]; if (m) drawLayer(x, m, br, t, W, H, brEl); }
    drawSubs(x, t, W, H); drawHook(x, t, W, H);
  }

  /* ---------- програвач: два відео-елементи по черзі, щоб склейки були без «замерзань» ---------- */
  let PL = null;
  const mkVideo = (url) => { const v = document.createElement("video"); v.src = url; v.muted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "auto"; v.crossOrigin = "anonymous"; return v; };
  const seekTo = (v, t) => new Promise((ok) => { if (Math.abs(v.currentTime - t) < .02 && v.readyState >= 2) return ok(); const f = () => { v.removeEventListener("seeked", f); ok(); }; v.addEventListener("seeked", f); v.currentTime = t; setTimeout(f, 1500); });
  function stopPlay() { if (!PL) return; cancelAnimationFrame(PL.raf); try { PL.src.stop(); } catch (e) {} P.clips.forEach((c) => c.vids.forEach((v) => v.pause())); P.media.forEach((m) => m.kind === "video" && m.el.pause()); PL.onend?.(); PL = null; }
  async function playFrom(t0, cv, opts = {}) {
    stopPlay(); const ac = AC(); try { await ac.resume(); } catch (e) {}
    await ensureFx();
    const x = cv.getContext("2d"), W = cv.width, H = cv.height, m0 = outToSrc(t0); let segI = SEG.indexOf(m0.seg), cur = m0.seg.v;
    await seekTo(cur, local(m0.seg, m0.src)); const pre = (i) => { const n = SEG[i]; if (n && n.v !== cur) { n.v.pause(); n.v.currentTime = local(n, n.a); } }; pre(segI + 1);
    const b = ac.createBuffer(1, OUTA.length, E().SR); b.copyToChannel(OUTA, 0); const src = ac.createBufferSource(); src.buffer = b;
    if (opts.dest) src.connect(opts.dest); if (!opts.silent) src.connect(ac.destination); else { const g = ac.createGain(); g.gain.value = 0; src.connect(g); g.connect(ac.destination); }
    const start = ac.currentTime + .08; src.start(start, t0); cur.play().catch(() => {});
    PL = { src, raf: 0, onend: opts.onend };
    let brEl = null;
    const loop = () => { if (!PL) return; const t = t0 + ac.currentTime - start;
      if (t >= TOT) { drawFrame(x, TOT - .01, W, H, cur); opts.prog?.(1); const done = opts.done; stopPlay(); done?.(); return; }
      const m = outToSrc(Math.max(0, t)), si = SEG.indexOf(m.seg);
      const lt = local(m.seg, m.src);
      if (si !== segI) { // перехід на наступний шматок: підготовлене відео вже на місці
        segI = si; if (cur !== m.seg.v) cur.pause(); cur = m.seg.v; if (Math.abs(cur.currentTime - lt) > .2) cur.currentTime = lt; cur.play().catch(() => {}); pre(si + 1); }
      else if (t > 0 && Math.abs(cur.currentTime - lt) > .25) cur.currentTime = lt;
      const br = brollAt(t); const me = br && P.media[br.b.m];
      if (me && me.kind === "video") { if (brEl !== me.el) { brEl && brEl.pause(); brEl = me.el; brEl.currentTime = Math.max(0, t - br.t0); brEl.play().catch(() => {}); } }
      else if (brEl) { brEl.pause(); brEl = null; }
      drawFrame(x, Math.max(0, t), W, H, cur); opts.prog?.(t / TOT); opts.tick?.(t);
      PL.raf = requestAnimationFrame(loop); };
    PL.raf = requestAnimationFrame(loop);
  }
  async function still(t, cv) { const m = outToSrc(t), v = m.seg.v; await seekTo(v, local(m.seg, m.src)); const br = brollAt(t), me = br && P.media[br.b.m]; if (me?.kind === "video") await seekTo(me.el, Math.max(0, t - br.t0)); drawFrame(cv.getContext("2d"), t, cv.width, cv.height, v); }

  /* ---------- збереження: покадрово (рівно 30 кадрів/с, без ривків) через Mediabunny; запасний шлях — запис у реальному часі ---------- */
  const MBURL = "https://cdn.jsdelivr.net/npm/mediabunny@1.45.0/+esm";
  async function exportVideo(onProg) {
    try { return await exportFrames(onProg); }
    catch (e) { console.warn("frames export → realtime", e); track("exp_fallback", { v: String(e?.message || e).slice(0, 30) }); onProg?.(0); return exportRealtime(onProg); }
  }
  async function exportFrames(onProg) {
    const M = await (MB ||= import(MBURL));
    if (!window.VideoEncoder) throw new Error("noenc");
    const can = (c) => M.canEncodeVideo(c, { width: OW, height: OH, bitrate: 1e7 }).catch(() => false);
    // H.264 (iPhone, Mac, Windows) → MP4; де його немає — VP9 у WebM
    const vc = (await can("avc")) ? "avc" : (await can("vp9")) ? "vp9" : null; if (!vc) throw new Error("noavc");
    // звук: AAC у MP4; якщо браузер не вміє AAC — MOV з нестисненим звуком (iPhone і Instagram його приймають)
    const aac = vc === "avc" && await M.canEncodeAudio("aac").catch(() => false), webm = vc !== "avc";
    try { await document.fonts?.ready; } catch (e) {}
    await ensureFx();
    // кадри відео людини читаємо напряму з файлу — точно, послідовно, швидше за реальний час
    const SZ = 1920, mkSink = async (blob) => { const inp = new M.Input({ formats: M.ALL_FORMATS, source: new M.BlobSource(blob) }), tr = await inp.getPrimaryVideoTrack();
      if (!tr || !(await tr.canDecode())) throw new Error("nodecode"); const dw = +(await tr.getDisplayWidth()) || 0, dh = +(await tr.getDisplayHeight()) || 0, k = dw && dh ? Math.min(1, SZ / Math.max(dw, dh)) : 1;
      let dur = 0; try { dur = await tr.computeDuration(); } catch (e) {}
      return { sink: new M.CanvasSink(tr, k < 1 ? { width: Math.round(dw * k), height: Math.round(dh * k), fit: "fill", poolSize: 2 } : { poolSize: 2 }), dur }; };
    const sinks = await Promise.all(P.clips.map((c) => mkSink(c.file)));
    const bsinks = new Map();
    const bSink = async (m) => { if (!bsinks.has(m)) bsinks.set(m, (async () => { try { return await mkSink(await (await fetch(m.url)).blob()); } catch (e) { return null; } })()); return bsinks.get(m); };
    const cv = document.createElement("canvas"); cv.width = OW; cv.height = OH; const x = cv.getContext("2d", { alpha: false });
    const out = new M.Output({ format: webm ? new M.WebMOutputFormat() : aac ? new M.Mp4OutputFormat({ fastStart: "in-memory" }) : new M.MovOutputFormat({ fastStart: "in-memory" }), target: new M.BufferTarget() });
    const vs = new M.CanvasSource(cv, { codec: vc, bitrate: 1e7, keyFrameInterval: 2 }), as = new M.AudioBufferSource(webm ? { codec: "opus", bitrate: 160e3 } : aac ? { codec: "aac", bitrate: 192e3 } : { codec: "pcm-s16" });
    out.addVideoTrack(vs, { frameRate: FPS }); out.addAudioTrack(as); await out.start();
    // звук подаємо шматками по секунді разом з кадрами — так файл збирається рівно, без накопичення в пам'яті
    const SR = E().SR, A = OUTA; let aPos = 0;
    const pushAudio = async (upto) => { upto = Math.min(A.length, Math.round(upto)); if (upto <= aPos) return; const L = upto - aPos, ab = new AudioBuffer({ length: L, numberOfChannels: 2, sampleRate: SR }), part = A.subarray(aPos, upto);
      ab.copyToChannel(part, 0); ab.copyToChannel(part, 1); aPos = upto; await as.add(ab); };
    const N = Math.max(1, Math.round(TOT * FPS)); let segI = -1, it = null, cur = null, bKey = null, bit = null, bcur = null;
    const pull = async (iter, prev) => { if (!iter) return prev; const r = await iter.next(); return r.done || !r.value ? prev : r.value.canvas; };
    for (let i = 0; i < N; i++) {
      if (i % FPS === 0) await pushAudio((i / FPS + 1) * SR);
      const t = Math.min(i / FPS, TOT - .001), m = outToSrc(t), si = SEG.indexOf(m.seg);
      if (si !== segI) { await it?.return?.(); segI = si; const sg = m.seg, ts = [];
        for (let j = i; j < N; j++) { const tt = Math.min(j / FPS, TOT - .001); if (outToSrc(tt).seg !== sg) break; ts.push(Math.max(0, local(sg, sg.a + tt - sg.o))); }
        it = sinks[sg.c].sink.canvasesAtTimestamps(ts); }
      cur = await pull(it, cur);
      const br = brollAt(t), me = br && P.media[br.b.m];
      if (me?.kind === "video") { if (bKey !== br.b) { await bit?.return?.(); bKey = br.b; bcur = null; const S = await bSink(me), ts = [];
          for (let j = i; j < N; j++) { const tt = j / FPS, q = brollAt(tt); if (q?.b !== br.b) break; const d = S?.dur || me.el.duration || 5; ts.push((tt - br.t0) % Math.max(.5, d - .05)); }
          bit = S ? S.sink.canvasesAtTimestamps(ts) : null; }
        bcur = await pull(bit, bcur); }
      else if (bKey) { await bit?.return?.(); bKey = null; bit = null; bcur = null; }
      drawFrame(x, t, OW, OH, cur || P.clips[m.seg.c].vids[0], bcur || undefined);
      await vs.add(i / FPS, 1 / FPS); onProg?.((i + 1) / N * .98);
    }
    await it?.return?.(); await bit?.return?.(); await pushAudio(A.length);
    vs.close(); as.close(); await out.finalize(); onProg?.(1);
    const [type, ext] = webm ? ["video/webm", "webm"] : aac ? ["video/mp4", "mp4"] : ["video/quicktime", "mov"];
    return { blob: new Blob([out.target.buffer], { type }), ext };
  }
  async function exportRealtime(onProg) {
    try { await document.fonts?.ready; } catch (e) {}
    const cv = document.createElement("canvas"); cv.width = OW; cv.height = OH; const ac = AC(), dest = ac.createMediaStreamDestination();
    const stream = cv.captureStream(FPS); dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mime = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime) throw new Error("no recorder");
    await still(0, cv);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 14e6 }), ch = []; rec.ondataavailable = (e) => e.data.size && ch.push(e.data);
    const stopped = new Promise((r) => rec.onstop = r); rec.start(500);
    await new Promise((res) => playFrom(0, cv, { dest, silent: true, prog: onProg, done: res, onend: res }));
    await new Promise((r) => setTimeout(r, 250)); rec.stop(); await stopped;
    return { blob: new Blob(ch, { type: mime.split(";")[0] }), ext: mime.includes("mp4") ? "mp4" : "webm" };
  }

  /* ---------- AI ---------- */
  // правила монтажу з розбору топових рілсів (див. документ «Розбір 5 відеоскілів»); база знань засновника додається окремо (kb)
  const RULES = `Правила хорошого монтажу коротких відео:
- Переходи — прості склейки; середній план ≈3 с; не роби наїзд на кожній склейці (дратує), максимум 3 наїзди на ролик.
- Вставки: одна на думку, а не на кожен іменник; 20–35% тривалості; не закривати обличчя без потреби — частіше віконцем; перелік краще лишити в субтитрах, ніж трьома стоковими кліпами.
- З кількох спроб однієї фрази лишай пізнішу вдалу; вирізай фальстарти, «е-е», повтори; кожен шматок має звучати цілим реченням.
- Хук-плашка не повторює перші сказані слова, а доповнює їх.
- Музика спокійно під голосом, не забиває його.`;
  const numbered = () => P.words.map((w, i) => `${P.cut.has(i) ? "[" : ""}${i}:${w.w}${P.cut.has(i) ? "]" : ""}`).join(" ");
  const mediaList = () => P.media.length ? P.media.map((m, k) => `${k}: ${m.kind === "img" ? "фото" : "відео"} «${m.name}»`).join("; ") : "немає";
  async function aiPlan() {
    let r = null;
    try {
      r = await sample.json(`Ти монтажер коротких вертикальних відео (Reels/TikTok/Shorts). Людина завантажила своє відео — ось дослівна розшифровка, кожне слово з номером:
${numbered()}

Побажання людини: ${P.wish ? `«${P.wish}»` : "немає — зроби як для сильного Reels"}. Якщо в побажаннях названо конкретні вставки, музику чи звуки — використай саме їх.
Плашка-хук: ${P.opt.hook ? "потрібна" : "НЕ потрібна (hook: \"\")"}.
Вставки, які людина завантажила (номер: тип «назва»): ${mediaList()}.

${RULES}

Склади план монтажу. Можна ТІЛЬКИ вирізати (порядок слів не змінюється).
- keep: діапазони номерів слів, які лишаються (у хронологічному порядку). Виріж слова-паразити (ну, типу, коротше, е-е, значить, от), повтори й фальстарти (лиши вдалий варіант), обірвані фрази, «зараз скажу». Кожен шматок має звучати граматично цілим.
- hook: коротка плашка-заголовок на перші 2–3 секунди (до 6 слів, без лапок), яка чіпляє увагу. Якщо людина просила без плашки — "".
- zoom: 1–3 номери слів, на яких зробити легкий наїзд камери (лише найсильніші моменти, не більше 3 на ролик).
- emph: 2–6 номерів ключових слів, які виділити кольором у субтитрах.
- broll: куди поставити вставки людини [{"m":номер вставки,"a":номер слова початку,"b":номер слова кінця}] — тільки якщо зрозуміло з назви вставки або з побажань; інакше [].
- stock: ${P.opt.stock ? "ОБОВ'ЯЗКОВО 3–6" : "НЕ ПОТРІБНО, поверни []. Інакше"} місць, де доречна вставка з бібліотеки безкоштовних відео/фото (наочні речі: гроші, кава, місто, телефон, природа, люди за роботою…): одна вставка на думку, разом 20–35% тривалості, не частіше ніж раз на 4–6 секунд і не на першій фразі; якщо фразу нічим наочно не показати — без вставки: [{"a":слово початку,"b":слово кінця (1.5–3 с),"q":"2–4 англійські слова для пошуку","kind":"video" або "photo","full":true (на весь екран) або false (віконцем поверх людини)}]. Чергуй: частіше video, іноді photo; частіше віконцем (full:false), щоб людину було видно.
- music: ${P.opt.music ? "ОБОВ'ЯЗКОВО" : "не потрібна — поверни \"\". Формат:"} 2–4 англійські слова — настрій фонової музики під зміст і темп (напр. "calm lofi", "upbeat energetic", "inspiring piano", "funny quirky", "cinematic tension", "corporate motivational").
- amb: ${P.opt.amb ? "ОБОВ'ЯЗКОВО" : "не потрібен — поверни \"\". Формат:"} 2–3 англійські слова — фоновий звук атмосфери під зміст (напр. "forest birds", "city street", "cafe ambience", "rain", "office ambience").
Відповідай тільки JSON: {"keep":[[a,b],...],"hook":"...","zoom":[...],"emph":[...],"broll":[...],"stock":[...],"music":"...","amb":"..."}`, { cache: false, kb: true });
    } catch (e) { r = null; }
    const n = P.words.length, keep = new Set();
    if (Array.isArray(r?.keep)) for (const [a, b] of r.keep) for (let i = Math.max(0, a | 0); i <= Math.min(n - 1, b | 0); i++) keep.add(i);
    if (!keep.size) P.words.forEach((w, i) => { if (!E().FILLERS.test(E().norm(w.w))) keep.add(i); });
    P.cut = new Set(P.words.map((w, i) => i).filter((i) => !keep.has(i)));
    P.hook = P.opt.hook && typeof r?.hook === "string" ? r.hook.trim().slice(0, 60) : "";
    const okI = (v) => Number.isInteger(v) && v >= 0 && v < n;
    P.zoom = new Set((r?.zoom || []).filter(okI)); P.emph = new Set((r?.emph || []).filter(okI));
    P.broll = (r?.broll || []).filter((b) => okI(b.a) && okI(b.b) && b.b >= b.a && P.media[b.m]).map((b) => ({ m: b.m, a: b.a, b: b.b, full: true, size: .6, x: 0, y: -.3 }));
    P.plan = { stock: P.opt.stock ? (r?.stock || []).filter((q) => okI(q.a) && okI(q.b) && q.b >= q.a && typeof q.q === "string" && q.q.trim()).slice(0, 6) : [],
      music: P.opt.music ? String(r?.music || "").trim() || "upbeat inspiring" : "", amb: P.opt.amb ? String(r?.amb || "").trim() || "cafe ambience" : "" };
    // якщо AI не запропонував вставок, а людина їх хоче — рівномірно по відео, пошук за змістом фрази
    if (P.opt.stock && !P.plan.stock.length && n > 12) for (let k = 1; k <= 3; k++) { const a = Math.floor(n * k / 4); P.plan.stock.push({ a, b: Math.min(n - 1, a + 4), q: "", kind: k % 2 ? "video" : "photo", full: k !== 2 }); }
    for (const q of P.plan.stock) if (!q.q) q.q = await toEn(P.words.slice(q.a, q.b + 1).map((w) => w.w).join(" ")).catch(() => "lifestyle");
  }
  /* ---------- бібліотеки: найкращий варіант одразу + 7 на заміну ---------- */
  async function loadStock(item) {
    const url = await SRV.mediaFile(item.src);
    if (item.kind === "video") { const v = mkVideo(url); v.loop = true; await loadMeta(v); return { kind: "video", el: v, url, name: item.q || item.by || "відео", stock: item }; }
    const im = new Image(); im.src = url; await im.decode().catch(() => {}); return { kind: "img", el: im, url, name: item.q || item.by || "фото", stock: item };
  }
  let LIBERR = "";
  const libFail = (e) => { LIBERR = e?.message === "login" ? "Увійди в акаунт, щоб брати матеріали з бібліотек" : "Бібліотеки фото й музики зараз недоступні"; console.warn("lib", e); };
  async function toEn(t) { const r = await sample.json(`Зроби з цього 2–4 англійські слова для пошуку стокового відео/фото (наочний предмет або дія): «${String(t).slice(0, 200)}». Тільки JSON {"q":"..."}`, { cache: true }); return String(r?.q || "").trim() || "lifestyle"; }
  // вставка з бібліотеки на слова a..b: одразу найкращий варіант + ще 6 на заміну
  async function addStock(q, a, b, kind = "video", full = true) {
    const items = await SRV.media(kind === "photo" ? "photo" : "video", q, 7); if (!items.length) return false;
    items.forEach((it) => it.q = q); let m = null;
    for (let k = 0; k < Math.min(3, items.length) && !m; k++) { try { m = await loadStock(items[k]); m.ai = k; } catch (e) { m = null; } }
    if (!m) return false; m.alts = items; P.media.push(m);
    P.broll.push({ m: P.media.length - 1, a, b, full: full !== false, size: .62, x: 0, y: -.32, stock: true }); return true;
  }
  async function setBed(k, q) {
    const items = await SRV.media(k === "music" ? "music" : "sound", q, 7); if (!items.length) return false;
    P[k] = { q, alts: items, i: 0, vol: P[k]?.vol ?? (k === "music" ? .3 : .22), buf: await bedBuf(items[0]) }; return true;
  }
  async function fillStock() {
    LIBERR = ""; if (!SRV.media || !P.plan) return;
    await Promise.all(P.plan.stock.map((q) => addStock(q.q, q.a, q.b, q.kind, q.full).catch(libFail)));
    await Promise.all([["music", P.plan.music], ["amb", P.plan.amb]].map(([k, q]) => q && setBed(k, q).catch(libFail)));
  }
  const BEDS = new Map();
  async function bedBuf(item) { if (BEDS.has(item.src)) return BEDS.get(item.src); const u = await SRV.mediaFile(item.src); const ab = await (await fetch(u)).arrayBuffer(); const x = await E().decode(ab); BEDS.set(item.src, x); return x; }
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
      hlMode: ["color", "box", "none"].includes(s.hlMode) ? s.hlMode : "color", box: s.box === "line" ? "line" : "none", outline: clamp(+s.outline || 0, 0, 10), size: clamp(+s.size || 1, .6, 1.5), pos: clamp(+s.pos || .72, .1, .9), words: clamp(+s.words | 0 || 3, 1, 6), upper: !!s.upper, off: !!s.off, shadow: s.shadow !== false, glow: !!s.glow };
  }
  async function aiCommand(text, words) {
    const r = await sample.json(`Ти монтажер. Поточний монтаж відео людини. Слова розшифровки з номерами (у квадратних дужках — вирізані):
${numbered()}
Плашка-хук: «${P.hook || "немає"}». Стиль субтитрів: ${JSON.stringify(P.style)}. Готові стилі: ${Object.entries(PRESETS).map(([k, v]) => `${k}=«${v.n}»`).join(", ")}. Шрифти: ${FONTS.join(", ")}.
Вставки: ${mediaList()}. Музика: ${P.music && !P.music.off ? `«${P.music.q}»` : "немає"}. Фоновий звук: ${P.amb && !P.amb.off ? `«${P.amb.q}»` : "немає"}. Зараз стоять: ${JSON.stringify(P.broll)}. Наїзди на словах: ${JSON.stringify([...P.zoom])}. Виділені слова: ${JSON.stringify([...P.emph])}.

Людина ${words ? "сказала голосом" : "написала"}: «${text}»

Перетвори це на операції (масив ops):
{"op":"cut","start":N,"end":M} — вирізати слова; {"op":"restore","start":N,"end":M} — повернути вирізане;
{"op":"hook","text":"..."} ("" — прибрати плашку); {"op":"preset","name":"ключ готового стилю"};
{"op":"style","set":{...поля стилю: font, weight, upper, color, hl, hlMode, box, boxColor, outline, outlineColor, shadow, glow, size (0.6-1.5), pos (0.1-0.9), words (1-6)}};
{"op":"zoom","idx":N} / {"op":"unzoom","idx":N}; {"op":"emph","idx":N} / {"op":"unemph","idx":N};
{"op":"broll","m":номер вставки,"start":N,"end":M} / {"op":"unbroll","m":номер};
{"op":"stock","start":N,"end":M,"q":"2–4 англійські слова для пошуку","kind":"video"|"photo","full":true|false} — додати нову вставку з бібліотеки безкоштовних відео/фото (якщо місце не вказане — сам вибери доречні місця, можна кілька ops);
{"op":"music","q":"англійський настрій, напр. calm lofi"} — поставити/змінити фонову музику; {"op":"nomusic"} — прибрати;
{"op":"amb","q":"англійською, напр. rain"} — фоновий звук; {"op":"noamb"} — прибрати;
{"op":"vol","k":"music"|"amb","v":0.05-0.8} — гучність; {"op":"subs","on":true|false} — показати/сховати субтитри.
Місце шукай за змістом. «Більші/менші субтитри» — size, «вище/нижче» — pos, «жовті» — color або hl. Якщо незрозуміло — ops порожні.
${RULES}
Відповідай тільки JSON: {"ops":[...],"say":"одне коротке речення — що зроблено"}`, { cache: false, kb: true });
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
      else if (o.op === "subs") P.style.off = o.on === false;
      else if ((o.op === "nomusic" || o.op === "noamb") && P[o.op.slice(2)]) P[o.op.slice(2)].off = true;
      else if (o.op === "vol" && P[o.k] && +o.v > 0) P[o.k].vol = clamp(+o.v, .02, .9);
    }
    // те, що треба знайти в бібліотеках
    LIBERR = ""; let added = 0;
    await busyRun("montage", () => Promise.all(ops.map(async (o) => {
      if (o.op === "stock" && okI(o.start) && typeof o.q === "string" && o.q.trim()) { if (await addStock(o.q, o.start, okI(o.end) && o.end >= o.start ? o.end : Math.min(n - 1, o.start + 4), o.kind, o.full).catch(libFail)) added++; }
      else if ((o.op === "music" || o.op === "amb") && typeof o.q === "string" && o.q.trim()) { if (await setBed(o.op, o.q).catch(libFail)) added++; }
    })));
    if (LIBERR) say(LIBERR);
    return r?.say || "Готово.";
  }

  /* ---------- завантаження файлів ---------- */
  const fileB64 = (f, max = 1280) => new Promise((ok, no) => { const im = new Image(); im.onload = () => { const r = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement("canvas"); c.width = Math.round(im.width * r); c.height = Math.round(im.height * r); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL("image/jpeg", .85).split(",")[1]); }; im.onerror = no; im.src = URL.createObjectURL(f); });
  const loadMeta = (el) => new Promise((ok, no) => { if (el.readyState >= 1) return ok(); el.addEventListener("loadedmetadata", () => ok(), { once: true }); el.addEventListener("error", () => no(new Error("video")), { once: true }); setTimeout(ok, 15000); });
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
#yvved .vh{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 4px}#yvved .vh b{font-size:17px}
#yvved .vx{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font-size:20px;cursor:pointer;display:grid;place-items:center}
#yvved .vb{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:4px 0 6px}
#yvved .vf{padding:8px 14px 12px;display:grid;gap:8px;border-top:1px solid rgba(255,255,255,.08)}
#yvved .vdev{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#ff9f0a;color:#0b0b0d;font-size:10.5px;font-weight:800;vertical-align:2px}
#yvved .btn{width:100%;padding:13px;border-radius:15px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#f5f5f7;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer;display:flex;gap:7px;align-items:center;justify-content:center}
#yvved .btn.main{background:#f5f5f7;color:#0b0b0d;border-color:transparent}#yvved .btn.rec{background:#ff453a;border-color:transparent}#yvved .btn:disabled{opacity:.4}
#yvved .rowf{display:flex;gap:8px}#yvved .rowf .btn:first-child{flex:1}#yvved .btn.sq{width:52px;flex:none;padding:0}
#yvved .chip{flex:none;padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e4e4e7;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer;display:inline-flex;gap:4px;align-items:center}
#yvved .chip[aria-pressed=true]{background:#f5f5f7;color:#0b0b0d}#yvved .chip svg{width:15px;height:15px}
#yvved .chips{display:flex;flex-wrap:wrap;gap:6px}
#yvved textarea,#yvved input[type=text]{width:100%;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font-size:15px;font-family:inherit;resize:none}
#yvved .lbl{font-size:12.5px;color:#a1a1aa;font-weight:600;margin:10px 0 4px}
#yvved input[type=range]{width:100%;accent-color:#f5f5f7}
#yvved .vstage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 6px}
#yvved .bar{display:flex;flex-direction:column;gap:8px;flex:none}
#yvved .bar .yvtool{width:58px;font-size:11px;padding:8px 2px 6px}#yvved .vx[hidden]{display:none}
#yvved .cvw{position:relative;flex:none;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 10px 30px rgba(0,0,0,.5)}
#yvved .cvw canvas{display:block;width:100%;height:100%}
#yvved .cvw .pb{position:absolute;inset:0;display:grid;place-items:center;background:none;border:0;color:#fff;cursor:pointer}
#yvved .cvw .pb i{width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.45);display:grid;place-items:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#yvved .seekrow{display:flex;align-items:center;gap:10px;padding:6px 16px 0;flex:none}#yvved .seekrow span{color:#a1a1aa;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
#yvved .msg{flex:none;margin:6px 14px 0;padding:8px 12px;border-radius:14px;background:rgba(255,214,10,.1);border:1px solid rgba(255,214,10,.3);color:#ffe27a;font-size:13px;text-align:center}
#yvved .vb.shon .msg{display:none}
#yvved .txt{font-size:17px;line-height:1.7;user-select:none;-webkit-user-select:none}
#yvved .w{padding:1px 1px;border-radius:6px;cursor:pointer}#yvved .w.cut{color:#5b5b63;text-decoration:line-through;font-size:13.5px}
#yvved .w.z{box-shadow:inset 0 -3px 0 #0a84ff}#yvved .w.em{color:#ffd60a}#yvved .w.br{background:rgba(52,208,122,.16)}#yvved .w.now{background:#ffd60a;color:#0b0b0d}#yvved .w.sel{outline:2px solid #ffd60a}
#yvved .act{position:sticky;top:-4px;z-index:2;display:flex;gap:6px;flex-wrap:wrap;padding:6px 0 8px;background:rgba(26,26,30,.98)}#yvved .act .q{color:#a1a1aa;font-size:13px;padding:6px 2px}
#yvved .clips{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;padding:0 12px}#yvved .clips.empty{align-items:center}
#yvved .crow{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding:6px 2px}#yvved .crow::-webkit-scrollbar{display:none}
#yvved .clip{position:relative;flex:none;width:96px;height:170px;border-radius:14px;overflow:hidden;background:#1c1c20;border:1px solid rgba(255,255,255,.12)}
#yvved .clip video,#yvved .clip canvas{width:100%;height:100%;object-fit:cover;display:block}
#yvved .clip .cdur{position:absolute;left:6px;bottom:6px;z-index:2;font-size:11px;font-weight:700;background:rgba(0,0,0,.55);padding:1px 6px;border-radius:6px}
#yvved .clip .cx,#yvved .clip .cmv{position:absolute;top:5px;z-index:2;width:26px;height:26px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:#fff;font-size:16px;line-height:1;cursor:pointer}#yvved .clip .cx{right:5px}#yvved .clip .cmv{left:5px}
#yvved .clip.add{display:grid;place-items:center;font-size:34px;color:#a1a1aa;border-style:dashed;cursor:pointer}
#yvved .ctot{text-align:center;color:#a1a1aa;font-size:12.5px;margin-top:6px}
#yvved .prep{flex:none;min-height:22px;text-align:center;font-size:13px;color:#d4d4d8;padding:4px 16px;display:grid;gap:5px;justify-items:center}#yvved .prep i{display:block;width:60%;height:4px;border-radius:2px;background:rgba(255,255,255,.12);overflow:hidden}#yvved .prep b{display:block;height:100%;background:#30d158;transition:width .3s}
#yvved .prep.wait i b{width:35%!important;animation:yvwait 1.2s ease-in-out infinite}@keyframes yvwait{0%{transform:translateX(-100%)}100%{transform:translateX(290%)}}
#yvved .prep.ok{color:#30d158}#yvved .prep.err{color:#ff9f0a}
#yvved .up{flex:1;min-height:0;width:min(78%,330px);margin:0 auto;display:grid;place-items:center;align-content:center;gap:8px;border-radius:26px;border:1.5px dashed rgba(255,255,255,.22);background:rgba(255,255,255,.04);color:#f5f5f7;cursor:pointer;text-align:center;font-weight:700;font-size:16px;font-family:inherit;position:relative;overflow:hidden}
#yvved .up small{color:#a1a1aa;font-weight:500;font-size:12.5px}#yvved .up.ok{border-style:solid;border-color:rgba(52,208,122,.6)}
#yvved .up video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55}#yvved .up span,#yvved .up svg,#yvved .up small{position:relative}
#yvved .tools{display:flex;justify-content:center;gap:10px;padding:12px 0 2px;flex:none}
#yvved .yvtool{position:relative}#yvved .yvtool .n{position:absolute;top:-5px;right:-5px;min-width:19px;height:19px;border-radius:10px;background:#30d158;color:#0b0b0d;font-size:11px;font-weight:800;display:grid;place-items:center;padding:0 5px}
#yvved .alts{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:2px 0}#yvved .alts::-webkit-scrollbar{display:none}
#yvved .alt{flex:none;width:58px;height:84px;border-radius:12px;border:2px solid transparent;background:#222 center/cover;color:#fff;font-weight:700;font-size:13px;font-family:inherit;cursor:pointer;text-shadow:0 1px 3px #000}
#yvved .alt.on{border-color:#30d158}#yvved .alt.load{opacity:.4}#yvved .alt.more{background:rgba(255,255,255,.08);border:1px dashed rgba(255,255,255,.3)}
#yvved .alt.snd{width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.08)}#yvved .alt.snd.on{background:#30d158;color:#0b0b0d}
#yvved .attr{margin:10px 0 0;font-size:11px;color:#71717a;text-align:center}#yvved .attr a{color:#a1a1aa}
#yvved .modes{flex:none;display:flex;gap:4px;margin:2px 14px 6px;padding:4px;border-radius:14px;background:rgba(255,255,255,.06)}#yvved .modes button{flex:1;padding:9px 6px;border-radius:11px;border:0;background:none;color:#a1a1aa;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer}#yvved .modes button[aria-pressed=true]{background:#f5f5f7;color:#0b0b0d}
#yvved .shl{flex:1;min-height:0;overflow-y:auto;padding:4px 12px 8px;display:grid;gap:8px;align-content:start}
#yvved .shc{display:flex;gap:10px;padding:8px;border-radius:16px;border:1.5px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);text-align:left;color:inherit;font-family:inherit;cursor:pointer}#yvved .shc.on{border-color:#30d158;background:rgba(48,209,88,.08)}
#yvved .shc .th{position:relative;flex:none;width:62px;height:110px;border-radius:10px;overflow:hidden;background:#222}#yvved .shc .th canvas{width:100%;height:100%;object-fit:cover;display:block}#yvved .shc .th i{position:absolute;inset:0;display:grid;place-items:center;font-style:normal;font-size:22px;text-shadow:0 2px 6px #000}
#yvved .shc .tx{flex:1;min-width:0;display:grid;gap:3px;align-content:start}#yvved .shc .tm{font-size:12px;color:#a1a1aa;display:flex;gap:6px;align-items:center}#yvved .shc .sc{padding:1px 7px;border-radius:8px;background:#30d158;color:#0b0b0d;font-weight:800;font-size:11.5px}#yvved .shc .sc.mid{background:#ffd60a}
#yvved .shc b{font-size:14.5px;line-height:1.3}#yvved .shc small{font-size:12.5px;color:#a1a1aa;line-height:1.35}#yvved .shc .ck2{flex:none;width:24px;height:24px;border-radius:8px;border:1.5px solid rgba(255,255,255,.3);display:grid;place-items:center;font-weight:900;font-size:14px}#yvved .shc.on .ck2{background:#30d158;border-color:#30d158;color:#0b0b0d}
#yvved .shnav{display:flex;align-items:center;gap:4px}#yvved .shnav:empty{display:none}#yvved .shnav span{font-size:13px;font-weight:800;min-width:34px;text-align:center}
#yvpv{position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.85);display:grid;place-items:center}#yvpv video{max-width:92vw;max-height:80vh;border-radius:16px}
#yvved .opts{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}
#yvved .chip.ck{padding:7px 11px 7px 7px}#yvved .chip.ck i{width:18px;height:18px;border-radius:6px;border:1.5px solid rgba(255,255,255,.35);display:grid;place-items:center;font-style:normal;font-size:12px;font-weight:900}
#yvved .chip.ck[aria-pressed=true]{background:rgba(48,209,88,.16);color:#f5f5f7;border-color:rgba(48,209,88,.55)}#yvved .chip.ck[aria-pressed=true] i{background:#30d158;border-color:#30d158;color:#0b0b0d}
#yvved .thumbs{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}#yvved .thumbs span{width:56px;height:74px;border-radius:10px;background:#222 center/cover;font-size:10px;display:grid;place-items:end center;color:#fff;overflow:hidden;padding:2px}
${E().SHEET_CSS.replace(/^\./gm, "#yvved .")}`;
  const IC2 = {
    style: `<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7v12M15 12h5M17.5 12v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    plaque: `<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 12h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    ins: `<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 16l5-5 4 4 3-3 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    shot: `<svg viewBox="0 0 24 24"><path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 13h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`,
    wish: `<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    find: `<svg viewBox="0 0 24 24" width="20" height="20"><circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15 15l5 5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
    neu: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  };
  const tool = (k, ic, t, n) => `<button class="yvtool" type="button" data-sh="${k}">${ic}${t}${n ? `<b class="n">${n}</b>` : ""}</button>`;
  const UI = { root: null };
  function shell(title) {
    if (!document.getElementById("yvvedcss")) { const st = document.createElement("style"); st.id = "yvvedcss"; st.textContent = CSS; document.head.appendChild(st); }
    UI.root?.remove(); const d = document.createElement("div"); d.id = "yvved";
    d.innerHTML = `<div class="vh"><b>${title}<span class="vdev">ТЕСТ</span></b><span style="display:flex;gap:8px"><span class="shnav" id="shnav"></span><button class="vx" type="button" id="vundo" aria-label="Скасувати" hidden>${E().IC.undo}</button><button class="vx" type="button" id="vclose" aria-label="Закрити">×</button></span></div><div class="vb"></div><div class="vf"></div>`;
    document.body.appendChild(d); UI.root = d; $(d, "#vclose").onclick = close;
    $(d, "#vundo").onclick = () => { if (popHist()) { build(); screenEdit("Скасовано"); } }; return d;
  }
  function close() { stopPlay(); UI.root?.remove(); UI.root = null; }
  const busyRun = (k, fn) => E().busyRun(k, fn);
  // кнопки-інструменти відкривають шторку; повторний тап — закриває
  function wireTools(B, open, after) {
    B.querySelectorAll("[data-sh]").forEach((b) => b.onclick = () => { const was = b.classList.contains("on"); B.querySelectorAll(".yvsh").forEach((x) => x._close(true)); B.classList.remove("shon"); B.querySelectorAll("[data-sh]").forEach((o) => o.classList.remove("on"));
      if (!was) { b.classList.add("on"); const S = open[b.dataset.sh]?.(); if (S) { const c = S.close; S.box._close = (q) => { c(q); after?.(); }; } } after?.(); });
  }

  /* ---------- кліпи: легке читання (лише звук), підготовка у фоні одразу після вибору ---------- */
  let MB = null;
  // звук з відео: 1) розкодувати браузером; 2) якщо не вміє — витягти лише звукову доріжку в маленький m4a і розкодувати її; 3) весь файл
  async function audioOf(file, dur) {
    const SR = E().SR, n = Math.max(1, Math.ceil(dur * SR)), why = [];
    const fit = (y) => { if (y.length >= n) return y.subarray(0, n).slice(); const z = new Float32Array(n); z.set(y); return z; };
    const short = (e) => String(e?.message || e || "?").slice(0, 60);
    let M = null, input = null, tr = null;
    try { M = await (MB ||= import(MBURL)); input = new M.Input({ formats: M.ALL_FORMATS, source: new M.BlobSource(file) }); tr = await input.getPrimaryAudioTrack(); if (!tr) return new Float32Array(n); } catch (e) { why.push("open " + short(e)); }
    if (tr) try {
      if (!(await tr.canDecode())) throw new Error("nodecode");
      const rate = await tr.getSampleRate(), out = new Float32Array(Math.ceil(dur * rate) + rate), sink = new M.AudioBufferSink(tr);
      for await (const w of sink.buffers()) { const b = w.buffer, ch = b.numberOfChannels, L = b.length, o = Math.round((w.timestamp || 0) * rate);
        const d0 = b.getChannelData(0), d1 = ch > 1 ? b.getChannelData(1) : null; for (let i = 0; i < L && o + i < out.length; i++) out[o + i] = d1 ? (d0[i] + d1[i]) / 2 : d0[i]; }
      return fit(rate === SR ? out : await E().resample(out, rate, SR));
    } catch (e) { why.push("dec " + short(e)); }
    if (input) try {
      const o = new M.Output({ format: new M.Mp4OutputFormat(), target: new M.BufferTarget() });
      const c = await M.Conversion.init({ input, output: o, video: { discard: true }, showWarnings: false }); if (!c.isValid) throw new Error("invalid");
      await c.execute(); return fit(await E().decode(o.target.buffer));
    } catch (e) { why.push("m4a " + short(e)); }
    if (file.size > 700e6) throw new Error("big");
    try { return fit(await E().decode(await file.arrayBuffer())); } catch (e) { why.push("whole " + short(e)); }
    const er = new Error("audio"); er.why = why.join(" · "); throw er;
  }
  // мініатюра кліпу — прямо з файлу (iPhone не завжди малює кадр прихованого відео)
  async function thumbOf(file) {
    const M = await (MB ||= import(MBURL)), input = new M.Input({ formats: M.ALL_FORMATS, source: new M.BlobSource(file) }), tr = await input.getPrimaryVideoTrack();
    if (!tr || !(await tr.canDecode())) return null; const w = await new M.CanvasSink(tr, { width: 200 }).getCanvas(Math.min(.6, ((await tr.computeDuration().catch(() => 1)) || 1) / 3)); return w?.canvas || null;
  }
  let PREP = null, PREPK = 0;
  function prepare(onStage) {
    const k = ++PREPK, clips = P.clips.slice(); let step = "audio";
    const job = (async () => {
      let off = 0; clips.forEach((c) => { c.off = off; off += c.dur; }); P.main = { dur: off };
      const parts = [];
      for (let i = 0; i < clips.length; i++) { if (k !== PREPK) return; onStage?.(`Слухаю відео ${clips.length > 1 ? `${i + 1} з ${clips.length}` : ""}…`, i / clips.length * .5);
        clips[i].aud ||= await audioOf(clips[i].file, clips[i].dur); parts.push(clips[i].aud); }
      const SR = E().SR, all = new Float32Array(parts.reduce((a, x) => a + x.length, 0)); let o = 0; parts.forEach((x) => { all.set(x, o); o += x.length; });
      step = "clean"; if (k !== PREPK) return; onStage?.("Чищу звук…", .55); await new Promise((r) => setTimeout(r, 30));
      const aud = await E().processTake(all); if (k !== PREPK) return;
      step = "stt"; onStage?.("Розпізнаю слова…", .7);
      const small = await E().resample(aud, SR, 16000), r = await SRV.stt({ audio: E().b64(E().wav(small, 16000)), mime: "audio/wav", quiet: true }); if (k !== PREPK) return;
      const dur = aud.length / SR;
      P.aud = aud; P.words = (r.words || []).map((w) => ({ w: String(w.w), s: Math.max(0, +w.s || 0), e: Math.min(dur, Math.max((+w.s || 0) + .05, +w.e || 0)) })).filter((w) => w.w.trim());
      onStage?.("✓ Готово до монтажу", 1); return true;
    })();
    PREP = job; job.catch((e) => { job.failed = true; if (k !== PREPK) return; console.error("prep", step, e, e?.why);
      const msg = String(e?.message || ""), det = (e?.why || msg).slice(0, 140); track("prep_err", { v: (step + ":" + det).slice(0, 80) });
      onStage?.(msg === "big" ? "Файл завеликий — зніми в 1080p" : msg === "limit" ? "Ліміт на сьогодні вичерпано" : msg === "login" ? "Увійди в акаунт, щоб монтувати"
        : `Не вдалося ${{ audio: "прочитати звук з відео", clean: "почистити звук", stt: "розпізнати слова" }[step]}. Натисни «Змонтувати», щоб спробувати ще раз`, -1, msg === "big" || msg === "limit" || msg === "login" ? "" : det); }); return job;
  }

  function screenStart() {
    P = fresh(); P.clips = []; P.mode = MODE; SH = null; const d = shell("Монтаж відео"), B = $(d, ".vb"), F = $(d, ".vf");
    B.innerHTML = `<div class="modes"><button type="button" data-md="one" aria-pressed="${MODE === "one"}">Змонтувати відео</button><button type="button" data-md="shorts" aria-pressed="${MODE === "shorts"}">Нарізати на шортси</button></div><div class="clips" id="clips"></div><div class="prep" id="prep"></div><div class="tools"></div><input type="file" id="vmain" accept="video/*" multiple hidden>`;
    F.innerHTML = `<div class="opts" id="vopts"></div><button class="btn main" type="button" id="vgo" disabled>${MODE === "shorts" ? "Знайти шортси" : "Змонтувати"}</button>`;
    const drawOpts = () => { const o = $(F, "#vopts"); o.innerHTML = OPTS.map(([k, n]) => `<button class="chip ck" type="button" data-o="${k}" aria-pressed="${!!P.opt[k]}"><i>${P.opt[k] ? "✓" : ""}</i>${n}</button>`).join("");
      o.querySelectorAll("[data-o]").forEach((b) => b.onclick = () => { P.opt[b.dataset.o] = !P.opt[b.dataset.o]; saveOpt(P.opt); drawOpts(); }); };
    drawOpts();
    const st = $(B, "#prep"); let deb = 0;
    const stage = (t, p, det) => { st.innerHTML = t ? `<span>${escH(t)}</span>${p >= 0 && p < 1 ? `<i><b style="width:${Math.round(p * 100)}%"></b></i>` : ""}${det ? `<small style="opacity:.6;font-size:11px">${escH(det)}</small>` : ""}` : ""; st.className = "prep" + (p < 0 ? " err" : p >= 1 ? " ok" : ""); };
    const LIM = () => MODE === "shorts" ? 5405 : 305;
    const restart = () => { clearTimeout(deb); PREP = null; PREPK++; if (!P.clips.length) { stage(""); return; }
      if (MODE === "shorts") { const tot = P.clips.reduce((a, c) => a + c.dur, 0); stage(tot < 120 ? "Для нарізки потрібне довше відео — від 2 хвилин" : `Знайдемо найкращі шматки на 15–60 с у ${fmt(tot)} відео`, tot < 120 ? -1 : 1); return; }
      stage("Готую…", 0); deb = setTimeout(() => prepare(stage), 350); };
    B.querySelectorAll("[data-md]").forEach((b) => b.onclick = () => { if (MODE === b.dataset.md) return; const tot = P.clips.reduce((a, c) => a + c.dur, 0);
      if (b.dataset.md === "one" && tot > 305) { say("Для монтажу одного відео — до 5 хв. Прибери зайві кліпи або нарізай на шортси"); return; }
      MODE = P.mode = b.dataset.md; B.querySelectorAll("[data-md]").forEach((x) => x.setAttribute("aria-pressed", x === b)); $(F, "#vgo").textContent = MODE === "shorts" ? "Знайти шортси" : "Змонтувати"; drawClips(); restart(); });
    const drawClips = () => {
      const box = $(B, "#clips"), total = P.clips.reduce((a, c) => a + c.dur, 0);
      if (!P.clips.length) { box.className = "clips empty"; box.innerHTML = (MODE === "shorts" ? `<label class="up" for="vmain">${ICON.film}<span>Додати довге відео</span><small>подкаст, ефір, лекція, інтерв'ю · до 90 хв</small><small style="opacity:.75">Знайдемо найкращі шматки і змонтуємо з них Reels</small></label>` : `<label class="up" for="vmain">${ICON.film}<span>Додати відео</span><small>одне або кілька · до 5 хв разом</small><small style="opacity:.75">Кілька: тапни відео, потім «Додати» вгорі</small></label>`); }
      else { box.className = "clips"; box.innerHTML = `<div class="crow">${P.clips.map((c, i) => `<div class="clip" data-i="${i}"><span class="cdur">${fmt(c.dur)}</span>${i ? `<button type="button" class="cmv" data-mv="${i}" aria-label="Раніше">‹</button>` : ""}<button type="button" class="cx" data-x="${i}" aria-label="Прибрати">×</button></div>`).join("")}<label class="clip add" for="vmain">+</label></div><div class="ctot">${P.clips.length} ${P.clips.length === 1 ? "відео" : "відео"} · ${fmt(total)}</div>`;
        box.querySelectorAll(".clip[data-i]").forEach((el) => { const c = P.clips[+el.dataset.i]; el.prepend(c.thumb); });
        box.querySelectorAll("[data-x]").forEach((b) => b.onclick = () => { P.clips.splice(+b.dataset.x, 1); drawClips(); restart(); });
        box.querySelectorAll("[data-mv]").forEach((b) => b.onclick = () => { const i = +b.dataset.mv; [P.clips[i - 1], P.clips[i]] = [P.clips[i], P.clips[i - 1]]; drawClips(); restart(); }); }
      $(F, "#vgo").disabled = !P.clips.length;
    };
    const draw = () => {
      B.querySelector(".tools").innerHTML = tool("shot", IC2.shot, "Стиль", P.styleImgs.length) + tool("ins", IC2.ins, "Вставки", P.media.length) + tool("wish", IC2.wish, "Побажання", P.wish ? "✓" : "");
      wireTools(B, { shot: shotSheet, ins: insSheet, wish: wishSheet }); };
    // iPhone спершу тягне відео з iCloud, а сайт нічого не отримує, поки воно не завантажиться — показуємо, що чекаємо
    const inp = $(B, "#vmain"); let picking = false, pickT = 0;
    const waitMsg = () => { if (!picking) return; stage("Отримую відео з телефона… Якщо воно в iCloud, iPhone спершу його завантажить — це може зайняти хвилину", 0); st.classList.add("wait"); };
    B.addEventListener("click", (e) => { if (e.target.closest('label[for="vmain"]')) { picking = true; clearTimeout(pickT); pickT = setTimeout(waitMsg, 1500); } });
    addEventListener("focus", () => { if (picking) { clearTimeout(pickT); pickT = setTimeout(waitMsg, 400); } });
    inp.addEventListener("cancel", () => { picking = false; clearTimeout(pickT); st.classList.remove("wait"); if (!P.clips.length) stage(""); });
    inp.onchange = async (e) => { picking = false; clearTimeout(pickT); st.classList.remove("wait"); const fs = [...(e.target.files || [])]; e.target.value = ""; if (!fs.length) return;
      stage(`Відкриваю ${fs.length > 1 ? fs.length + " відео" : "відео"}…`, 0);
      for (const f of fs.slice(0, 12 - P.clips.length)) {
        const url = URL.createObjectURL(f), v = mkVideo(url); v.className = "cth"; v.style.cssText = "position:fixed;left:-9999px;width:2px;height:2px"; document.body.appendChild(v);
        try { await loadMeta(v); } catch (x) {} v.remove(); v.style.cssText = "";
        if (!(v.duration > 0)) { say(`«${f.name.slice(0, 20)}» не відкривається тут`); continue; }
        const total = P.clips.reduce((a, c) => a + c.dur, 0); if (total + v.duration > LIM()) { say(MODE === "shorts" ? "Разом до 90 хвилин — решту не додав" : "Разом до 5 хвилин — решту не додав. Для довгого — «Нарізати на шортси»"); break; }
        try { v.currentTime = Math.min(.6, v.duration / 3); } catch (x) {}
        const C = { file: f, url, dur: v.duration, w: v.videoWidth, h: v.videoHeight, thumb: v, vids: [v, mkVideo(url)] }; P.clips.push(C);
        thumbOf(f).then((cv) => { if (cv && P.clips.includes(C)) { C.thumb = cv; drawClips(); } }).catch(() => {});
      }
      drawClips(); restart(); };
    const shotSheet = () => { const S = E().sheet(B, "Субтитри як на скріні", `<label class="btn" for="vshot">${IC2.shot} Додати скрін</label><input type="file" id="vshot" accept="image/*" multiple hidden><div class="thumbs">${P.styleImgs.map((m) => `<span style="background-image:url(data:image/jpeg;base64,${m.data})"></span>`).join("")}</div>`);
      $(S.body, "#vshot").onchange = async (e) => { for (const f of [...e.target.files].slice(0, 3 - P.styleImgs.length)) { try { P.styleImgs.push({ data: await fileB64(f), mime: "image/jpeg" }); } catch (x) {} } S.close(true); draw(); }; return S; };
    const insSheet = () => { const S = E().sheet(B, "Вставки", `<label class="btn" for="vins">${IC2.ins} Фото або відео</label><input type="file" id="vins" accept="image/*,video/*" multiple hidden><div class="thumbs">${P.media.map((m) => `<span style="background-image:url(${m.kind === "img" ? m.url : ""})">${m.kind === "video" ? "▶ " : ""}${escH(m.name.slice(0, 9))}</span>`).join("")}</div>`);
      $(S.body, "#vins").onchange = async (e) => { for (const f of [...e.target.files].slice(0, 8)) await addMedia(f); S.close(true); draw(); }; return S; };
    const wishSheet = () => { const S = E().sheet(B, "Що має бути у відео?", `<textarea id="vwish" rows="3" placeholder="Напр.: динамічно, великі жовті субтитри, без плашки">${escH(P.wish)}</textarea><button class="btn" type="button" id="vwrec" style="margin-top:8px">${ICON.mic} Сказати голосом</button>`);
      const ta = $(S.body, "#vwish"); ta.oninput = () => { P.wish = ta.value.trim(); };
      const wr = $(S.body, "#vwrec"), wl = wr.innerHTML;
      wr.onclick = () => E().record(wr, wl, async (buf) => { try { const t = await sttBuf(buf); ta.value = (ta.value + " " + t).trim(); P.wish = ta.value; } catch (x) { say("Не вийшло розпізнати"); } }); return S; };
    $(F, "#vgo").onclick = () => { B.querySelectorAll(".yvsh").forEach((x) => x._close(true)); track("start", { v: `${P.clips.length}clips` + (P.media.length ? "+ins" : "") + (P.wish ? "+wish" : "") + "|" + OPTS.filter(([k]) => P.opt[k]).map(([k]) => k).join(",") }); MODE === "shorts" ? findShorts(stage) : run(stage); };
    drawClips(); draw();
  }
  async function sttBuf(buf) {
    const raw = await E().decode(buf), small = await E().resample(raw, E().SR, 16000);
    const r = await SRV.stt({ audio: E().b64(E().wav(small, 16000)), mime: "audio/wav" }); return (r.words || []).map((w) => w.w).join(" ");
  }

  /* ---------- ШОРТСИ з довгого відео: звук шматками → слова → AI шукає найкращі шматки → вибір → монтаж кожного ---------- */
  let MODE = "one", SH = null, SHI = 0, LW = null;
  const INPUTS = new Map();
  async function inputOf(file) { const M = await (MB ||= import(MBURL)); if (!INPUTS.has(file)) INPUTS.set(file, new M.Input({ formats: M.ALL_FORMATS, source: new M.BlobSource(file) })); return { M, input: INPUTS.get(file) }; }
  // звук відрізка [t0, t1) файлу з потрібною частотою — без читання всього файлу
  async function rangeAudio(file, t0, t1, rate) {
    const { M, input } = await inputOf(file), tr = await input.getPrimaryAudioTrack(), n = Math.max(1, Math.ceil((t1 - t0) * rate));
    if (!tr) return new Float32Array(n);
    let y = null, r0 = 0;
    if (await tr.canDecode().catch(() => false)) {
      try { r0 = await tr.getSampleRate(); y = new Float32Array(Math.ceil((t1 - t0) * r0) + 8); const sink = new M.AudioBufferSink(tr);
        for await (const w of sink.buffers(t0, t1)) { const b = w.buffer, ch = b.numberOfChannels, L = b.length, o = Math.round(((w.timestamp || 0) - t0) * r0);
          const d0 = b.getChannelData(0), d1 = ch > 1 ? b.getChannelData(1) : null; for (let i = Math.max(0, -o); i < L && o + i < y.length; i++) y[o + i] = d1 ? (d0[i] + d1[i]) / 2 : d0[i]; }
      } catch (e) { y = null; }
    }
    if (!y) { // запасний шлях (iPhone без розкодування звуку): лише цей відрізок у маленький m4a
      const o = new M.Output({ format: new M.Mp4OutputFormat(), target: new M.BufferTarget() });
      const c = await M.Conversion.init({ input, output: o, video: { discard: true }, trim: { start: t0, end: t1 }, showWarnings: false }); if (!c.isValid) throw new Error("audio");
      await c.execute(); y = await E().decode(o.target.buffer); r0 = E().SR; }
    const z = r0 === rate ? y : await E().resample(y, r0, rate); if (z.length >= n) return z.subarray(0, n).slice(); const q = new Float32Array(n); q.set(z); return q;
  }
  // усі слова довгого відео: по 3,5 хв на запит
  async function longWords(onStage) {
    const W = []; let off = 0; const tot = P.clips.reduce((a, c) => a + c.dur, 0), WIN = 210;
    for (let ci = 0; ci < P.clips.length; ci++) { const C = P.clips[ci];
      for (let t0 = 0; t0 < C.dur - .5; t0 += WIN) { const t1 = Math.min(C.dur, t0 + WIN);
        onStage(`Слухаю відео… ${fmt(off + t0)} з ${fmt(tot)}`, (off + t0) / tot * .8);
        const y = await rangeAudio(C.file, t0, t1, 16000); let r = null;
        for (let a = 0; a < 2 && !r; a++) { try { r = await SRV.stt({ audio: E().b64(E().wav(y, 16000)), mime: "audio/wav", quiet: true }); } catch (e) { if (e?.code === "limit" || /limit/.test(e?.message)) throw new Error("limit"); if (a) throw e; } }
        for (const w of r.words || []) { const s = +w.s || 0; if (!String(w.w).trim()) continue; W.push({ w: String(w.w), s: off + t0 + s, e: off + t0 + Math.max(s + .05, +w.e || 0), c: ci }); } }
      off += C.dur; }
    return W;
  }
  // AI оцінює шматки (правила з Claude Shorts): хук 30%, зрозуміло без контексту 25%, емоція 20%, користь 15%, фінал 10%
  async function scoreShorts(W, onStage) {
    const lines = []; let cur = null;
    W.forEach((w) => { if (!cur || /[.!?…]$/.test(cur.t) || w.s - cur.e > .8 || cur.n >= 14) { cur && lines.push(cur); cur = { s: w.s, e: w.e, t: w.w, n: 1 }; } else { cur.t += " " + w.w; cur.e = w.e; cur.n++; } });
    cur && lines.push(cur);
    const parts = []; let buf = [], len = 0;
    for (const l of lines) { const s = `[${Math.round(l.s)}] ${l.t}`; if (len + s.length > 9000 && buf.length) { parts.push(buf); buf = []; len = 0; } buf.push(s); len += s.length + 1; }
    buf.length && parts.push(buf);
    const out = [];
    for (let k = 0; k < parts.length; k++) { onStage(`Шукаю найкращі моменти… ${k + 1} з ${parts.length}`, .8 + .18 * k / parts.length);
      try { const r = await sample.json(`Ти продюсер коротких вертикальних відео. Ось частина розшифровки довгого відео (у дужках — секунда початку фрази):
${parts[k].join("\n")}

Знайди ${parts.length > 1 ? "2–4" : "4–8"} найкращих шматків, які стануть окремими Reels/TikTok/Shorts по 15–55 с (найкраще 25–40 с).
Оціни кожен 0–100 за вагами: хук у перших 3 секундах 30% (сміливе твердження, інтрига, конкретна цифра, «я перевірив»; слабко — «сьогодні хочу розповісти»), зрозуміло без решти відео 25% (без «як я казав раніше», займенників без пояснення, обриву думки), емоція 20%, користь 15%, сильний фінал 10%. Нижче 60 — не бери. Шматки про різне, не перетинаються.
Для кожного: s і e — секунди початку і кінця (початок фрази, кінець — кінець речення), score, hook — плашка-хук до 7 слів (не повторює перші сказані слова, а доповнює), why — чому спрацює (до 12 слів).
Відповідай тільки JSON: {"clips":[{"s":0,"e":0,"score":0,"hook":"…","why":"…"}]}`, { cache: false, kb: true, max: 1500 });
        for (const c of r?.clips || []) if (+c.e - +c.s >= 10 && +c.score >= 50) out.push({ s: +c.s, e: +c.e, score: Math.round(+c.score), hook: String(c.hook || "").slice(0, 60), why: String(c.why || "").slice(0, 120) });
      } catch (e) { if (e?.code === "rate_limited") throw new Error("limit"); console.warn("score", e); } }
    // межі — по словах: початок речення, кінець речення (до +3 с), 15–60 с, усередині одного кліпу
    const snap = (c) => { let i = W.findIndex((w) => w.s >= c.s - .6); if (i < 0) return null; for (let k = i; k > 0 && k > i - 6; k--) if (/[.!?…]$/.test(W[k - 1].w)) { if (c.s - W[k].s < 2.5) i = k; break; }
      let j = W.length - 1; for (let k = i; k < W.length; k++) { if (W[k].c !== W[i].c) { j = k - 1; break; } if (W[k].e > c.e + .3) { j = k - 1; break; } j = k; }
      for (let k = j; k < W.length && W[k].e < W[j].e + 3 && W[k].c === W[i].c; k++) if (/[.!?…]$/.test(W[k].w)) { j = k; break; }
      while (j > i && W[j].e - W[i].s > 60) j--; if (W[j].e - W[i].s < 12) return null;
      return { ...c, a: i, b: j, s: W[i].s, e: W[j].e }; };
    const res = []; for (const c of out.sort((x, y) => y.score - x.score)) { const q = snap(c); if (q && !res.some((r) => q.s < r.e && q.e > r.s)) res.push(q); if (res.length >= 10) break; }
    return res.sort((x, y) => x.s - y.s);
  }
  async function findShorts(stage) {
    const tot = P.clips.reduce((a, c) => a + c.dur, 0); if (tot < 120) { say("Для нарізки потрібне відео від 2 хвилин"); return; }
    const go = UI.root?.querySelector("#vgo"); if (go) go.disabled = true;
    try {
      if (!LW || LW.key !== P.clips.map((c) => c.file.name + c.dur).join("|")) { const W = await longWords(stage); LW = { key: P.clips.map((c) => c.file.name + c.dur).join("|"), W }; }
      if (LW.W.length < 30) { stage("Майже не чути слів — нарізка працює для відео, де говорять", -1); return; }
      const cands = await scoreShorts(LW.W, stage);
      if (!cands.length) { stage("Не знайшов шматків, які спрацюють окремо. Спробуй інше відео", -1); return; }
      track("shorts_found", { v: `${cands.length}/${Math.round(tot / 60)}m` }); stage("", 1); screenShorts(cands);
    } catch (e) { console.error(e); stage(e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : e?.message === "login" ? "Увійди в акаунт" : "Не вдалося обробити відео. Спробуй ще раз", -1, String(e?.message || "").slice(0, 80)); }
    finally { if (go) go.disabled = false; }
  }
  async function thumbAt(file, t) { const { M, input } = await inputOf(file), tr = await input.getPrimaryVideoTrack(); if (!tr || !(await tr.canDecode())) return null; const w = await new M.CanvasSink(tr, { width: 160 }).getCanvas(t); return w?.canvas || null; }
  function preview(C, s, e) { document.getElementById("yvpv")?.remove(); const d = document.createElement("div"); d.id = "yvpv"; const v = document.createElement("video"); v.src = C.url; v.playsInline = true; v.setAttribute("playsinline", ""); v.controls = true; d.appendChild(v); document.body.appendChild(d);
    const end = () => { v.pause(); d.remove(); }; d.onclick = (x) => { if (x.target === d) end(); }; v.addEventListener("loadedmetadata", () => { v.currentTime = s; v.play().catch(() => {}); }, { once: true }); v.ontimeupdate = () => { if (v.currentTime >= e) end(); }; }
  function screenShorts(cands) {
    const base = P, d = UI.root, B = $(d, ".vb"), F = $(d, ".vf"), sel = new Set(cands.slice().sort((x, y) => y.score - x.score).slice(0, 3).map((c) => c));
    const clipOf = (c) => { const ci = LW.W[c.a].c; let off = 0; for (let i = 0; i < ci; i++) off += base.clips[i].dur; return { C: base.clips[ci], s: c.s - off, e: c.e - off }; };
    B.className = "vb"; B.innerHTML = `<div class="prep ok" style="min-height:0"><span>Знайшов ${cands.length} ${cands.length < 5 ? "шматки" : "шматків"} — вибери, які змонтувати</span></div><div class="shl">${cands.map((c, i) => `<div class="shc${sel.has(c) ? " on" : ""}" data-k="${i}"><div class="th" data-pv="${i}"><i>▶</i></div><div class="tx"><div class="tm"><span class="sc${c.score < 75 ? " mid" : ""}">${c.score}</span>${fmt(c.s)}–${fmt(c.e)} · ${Math.round(c.e - c.s)} с</div><b>${escH(c.hook || LW.W.slice(c.a, c.a + 8).map((w) => w.w).join(" "))}</b><small>${escH(c.why)}</small></div><span class="ck2">${sel.has(c) ? "✓" : ""}</span></div>`).join("")}</div>`;
    const upd = () => { B.querySelectorAll("[data-k]").forEach((el) => { const on = sel.has(cands[+el.dataset.k]); el.classList.toggle("on", on); el.querySelector(".ck2").textContent = on ? "✓" : ""; }); const g = $(F, "#shgo"); g.disabled = !sel.size; g.textContent = `Змонтувати ${sel.size || ""} ${sel.size === 1 ? "шортс" : sel.size >= 2 && sel.size <= 4 ? "шортси" : "шортсів"}`; };
    F.innerHTML = `<button class="btn main" type="button" id="shgo"></button><button class="btn" type="button" id="shbk">← Інше відео</button>`;
    B.querySelectorAll("[data-k]").forEach((el) => el.onclick = (e) => { const c = cands[+el.dataset.k]; if (e.target.closest("[data-pv]")) { const q = clipOf(c); preview(q.C, q.s, q.e); return; } sel.has(c) ? sel.delete(c) : sel.add(c); upd(); });
    cands.forEach((c, i) => { const q = clipOf(c); thumbAt(q.C.file, q.s + 1).then((cv) => { const th = B.querySelector(`[data-pv="${i}"]`); if (cv && th) th.prepend(cv); }).catch(() => {}); });
    $(F, "#shbk").onclick = () => { MODE = "shorts"; screenStart(); };
    $(F, "#shgo").onclick = () => { const pick = cands.filter((c) => sel.has(c)); track("shorts_pick", { v: `${pick.length}/${cands.length}` });
      SH = pick.map((c) => ({ c, q: clipOf(c), P: null })); SH.base = base; openShort(0); };
    upd();
  }
  async function openShort(i) {
    stopPlay(); if (SH[SHI]?.P === P) build();
    SHI = i; const it = SH[i], base = SH.base;
    if (it.P) { P = it.P; build(); screenEdit(); return; }
    try {
      await busyRun("montage", async () => {
        const { C, s, e } = it.q, url = C.url, np = fresh();
        Object.assign(np, { opt: base.opt, wish: [base.wish, it.c.hook ? `Плашка-хук: «${it.c.hook}»` : ""].filter(Boolean).join(". "), styleImgs: base.styleImgs, media: base.media.slice(), mode: "short" });
        np.clips = [{ file: C.file, url, dur: e - s, base: s, off: 0, w: C.w, h: C.h, vids: [mkVideo(url), mkVideo(url)] }];
        np.words = LW.W.slice(it.c.a, it.c.b + 1).map((w) => ({ w: w.w, s: Math.max(0, w.s - it.c.s), e: Math.min(e - s, w.e - it.c.s) }));
        P = np; P.main = { dur: e - s };
        P.aud = await E().processTake(await rangeAudio(C.file, s, e, E().SR));
        if (base.style && base.preset === "shot") { P.style = { ...base.style }; P.preset = "shot"; } else if (P.styleImgs.length && !SH.styled) { await aiStyleFromShots(); SH.style = P.style; SH.styled = true; } else if (SH.style) { P.style = { ...SH.style }; P.preset = "shot"; }
        await aiPlan(); if (P.opt.hook && it.c.hook) P.hook = it.c.hook; P.style.off = !P.opt.subs;
        await fillStock(); await Promise.all(P.clips[0].vids.map((v) => loadMeta(v).catch(() => {})));
        it.P = P; build();
      });
      track("short_ready", { v: `${i + 1}/${SH.length}` });
      screenEdit(LIBERR ? LIBERR + " — змонтував без них" : `Шортс ${i + 1} з ${SH.length}. Перемикай стрілками вгорі`);
    } catch (e) { console.error(e); say(e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло змонтувати цей шортс"); if (it.P) { P = it.P; build(); screenEdit(); } }
  }

  async function run(stage) {
    try {
      if (!PREP || PREP.failed) prepare(stage);
      const ok = await busyRun("listen", () => PREP);
      if (!ok) throw new Error("prep");
      if (!P.words.length) say("Не почув слів — змонтую кліпи як є");
      await aiStyleFromShots();
      if (P.words.length) await aiPlan(); else P.plan = { stock: [], music: P.opt.music ? "upbeat energetic" : "", amb: P.opt.amb ? "city street" : "" };
      P.style.off = !P.opt.subs;
      await busyRun("montage", () => fillStock());
      await Promise.all(P.clips.flatMap((c) => c.vids.map((v) => loadMeta(v).catch(() => {}))));
      build(); track("ready", { v: P.styleImgs.length ? "shot" : P.preset });
      const got = P.broll.some((b) => b.stock) || P.music || P.amb;
      screenEdit(LIBERR ? LIBERR + " — змонтував без них" : got ? "Не подобається вставка чи музика? Кнопки «Вставки» і «Музика» збоку — там інші варіанти" : "");
    } catch (e) { console.error(e); say(e?.message === "big" ? "Файл завеликий — зніми в 1080p або коротше" : e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло обробити відео. Спробуй ще раз."); }
  }

  let POS = 0, SELW = -1, SELL = null;
  const IC3 = { trash: `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>` };
  const wordsOf = (L) => P.words.slice(L.a, L.b + 1).map((w) => w.w).join(" ");
  // шторка «Вставки»: усі вставки по черзі → для вибраної: 7 варіантів, весь екран/віконце, розмір, положення, прибрати фон
  function insSheet(B, cv, getPos, redraw, refresh, playIt) {
    const S = E().sheet(B, "Вставки", ""), b = S.body;
    const draw = () => {
      if (SELL && !P.broll.includes(SELL)) SELL = null; if (!SELL) SELL = P.broll.find((L) => brollAt(getPos())?.b === L) || P.broll[0] || null;
      const L = SELL, m = L && P.media[L.m], alts = m?.alts || [];
      b.innerHTML = `${P.broll.length ? `<div class="chips">${P.broll.map((q, k) => `<button class="chip" type="button" data-l="${k}" aria-pressed="${q === L}">«${escH(wordsOf(q).slice(0, 18))}»</button>`).join("")}</div>` : `<p style="margin:0 0 8px;color:#a1a1aa;font-size:13px">Вставок ще немає. Додай своє або тапни слово в «Текст».</p>`}
        ${L ? `${alts.length ? `<div class="lbl">Інший варіант</div><div class="alts">${alts.map((it, k) => `<button type="button" class="alt${k === m.ai ? " on" : ""}" data-alt="${k}" style="background-image:url('${escH(it.thumb)}')">${it.kind === "video" ? "▶" : ""}</button>`).join("")}<button type="button" class="alt more" id="vmore">Ще</button></div>` : ""}
          <div class="chips" style="margin-top:10px"><button class="chip" type="button" id="vfull" aria-pressed="${L.full !== false}">На весь екран</button><button class="chip" type="button" id="vwin" aria-pressed="${L.full === false}">Віконцем</button>${m?.kind === "img" ? `<button class="chip" type="button" id="vcut" aria-pressed="${!!L.cutBg}">Прибрати фон</button>` : ""}<button class="chip" type="button" id="vdel">${IC3.trash} Прибрати</button></div>
          ${L.full === false || L.cutBg ? `<div class="lbl">Розмір</div><input type="range" id="lsz" min="20" max="100" value="${Math.round((L.size ?? .6) * 100)}"><div class="lbl">↕ Вгору / вниз</div><input type="range" id="ly" min="-100" max="100" value="${Math.round((L.y ?? -.3) * 100)}"><div class="lbl">↔ Вліво / вправо</div><input type="range" id="lx" min="-100" max="100" value="${Math.round((L.x || 0) * 100)}">` : ""}` : ""}
        <div class="rowf" style="margin-top:12px"><input type="text" id="vq" placeholder="Знайти: гроші, кава, місто…" enterkeyhint="search"><button class="btn sq" type="button" id="vqgo" aria-label="Знайти">${IC2.find}</button></div>
        <label class="btn" for="vins2" style="margin-top:8px">${IC2.ins} Додати своє фото або відео</label><input type="file" id="vins2" accept="image/*,video/*" multiple hidden>
        <p class="attr">Матеріали: <a href="https://www.pexels.com" target="_blank" rel="noopener">Pexels</a>, <a href="https://pixabay.com" target="_blank" rel="noopener">Pixabay</a>, <a href="https://freesound.org" target="_blank" rel="noopener">Freesound</a></p>`;
      const jump = () => { const o = WOUT[L.a]; if (o) { POS = o.s + .3; still(POS, cv); const sk = UI.root?.querySelector("#vseek"), tm = UI.root?.querySelector("#vtm"); if (sk) sk.value = Math.round(POS / TOT * 1000); if (tm) tm.textContent = `${fmt(POS)} / ${fmt(TOT)}`; } };
      b.querySelectorAll("[data-l]").forEach((x) => x.onclick = () => { SELL = P.broll[+x.dataset.l]; draw(); jump(); });
      b.querySelectorAll("[data-alt]").forEach((x) => x.onclick = async () => { const k = +x.dataset.alt, it = alts[k]; x.classList.add("load");
        try { const nm = await loadStock(it); Object.assign(m, { kind: nm.kind, el: nm.el, url: nm.url, cut: null, ai: k }); L.cutBg = false; track("alt", { v: it.kind }); draw(); jump(); } catch (e) { say("Не вдалося завантажити"); x.classList.remove("load"); } });
      $(b, "#vmore")?.addEventListener("click", async () => { try { const q = m.stock?.q || m.name, it = await SRV.media(m.kind === "video" ? "video" : "photo", q + " " + ["close up", "people", "aesthetic", "cinematic", "top view"][Math.floor(Math.random() * 5)], 7); if (it.length) { m.alts = it; m.ai = -1; draw(); } } catch (e) { say("Не вдалося знайти"); } });
      $(b, "#vfull")?.addEventListener("click", () => { pushHist(); L.full = true; L.cutBg = false; draw(); jump(); });
      $(b, "#vwin")?.addEventListener("click", () => { pushHist(); L.full = false; draw(); jump(); });
      $(b, "#vdel")?.addEventListener("click", () => { pushHist(); P.broll = P.broll.filter((q) => q !== L); SELL = null; redraw(); draw(); });
      $(b, "#vcut")?.addEventListener("click", async () => { pushHist(); if (L.cutBg) { L.cutBg = false; draw(); jump(); return; }
        if (!m.cut) { try { m.cut = await busyRun("image", () => cutout(m.el)); } catch (e) { console.warn(e); say("Не вдалося прибрати фон"); return; } }
        L.cutBg = true; L.full = false; draw(); jump(); });
      const sl = (id, key, k) => { const r = $(b, id); if (r) r.oninput = () => { L[key] = +r.value / k; still(getPos(), cv); }; };
      sl("#lsz", "size", 100); sl("#ly", "y", 100); sl("#lx", "x", 100);
      const span = () => { const i0 = Math.max(0, wordAt(getPos())); let j = i0; const t0 = P.words[i0]?.s || 0; while (j + 1 < P.words.length && P.words[j + 1].e - t0 < 2.4) j++; return [i0, j]; };
      const find = async () => { const q = $(b, "#vq").value.trim(); if (q.length < 2 || !P.words.length) return; const [i0, j] = span(); LIBERR = "";
        try { const ok = await busyRun("montage", async () => addStock(await toEn(q), i0, j, "video", true)); if (LIBERR) { say(LIBERR); return; } if (!ok) { say("Нічого не знайшлося — спробуй інше слово"); return; }
          pushHist(); SELL = P.broll[P.broll.length - 1]; track("find", { v: q.slice(0, 30) }); redraw(); draw(); jump(); } catch (e) { libFail(e); say(LIBERR); } };
      $(b, "#vqgo").onclick = find; $(b, "#vq").onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); find(); } };
      $(b, "#vins2").onchange = async (e) => { const n0 = P.media.length; for (const f of [...e.target.files].slice(0, 8)) await addMedia(f);
        if (P.media.length > n0) { const i0 = Math.max(0, wordAt(getPos())); let j = i0; const t0 = P.words[i0]?.s || 0; while (j + 1 < P.words.length && P.words[j + 1].e - t0 < 2.2) j++;
          pushHist(); SELL = { m: n0, a: i0, b: j, full: true, size: .6, x: 0, y: -.3 }; P.broll.push(SELL); redraw(); draw(); jump(); } };
    };
    draw(); return S;
  }
  // прибрати фон з фото — прямо в телефоні (безкоштовно); модель завантажується один раз
  let BGR = null;
  async function cutout(img) {
    BGR ||= import("https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.4.5/+esm");
    const mod = await BGR, c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext("2d").drawImage(img, 0, 0);
    const blob = await new Promise((r) => c.toBlob(r, "image/png")); const out = await mod.removeBackground(blob);
    const im = new Image(); im.src = URL.createObjectURL(out); await im.decode(); return im;
  }
  // шторка «Звук»: голос, музика, фон — по 7 варіантів, гучність, «без»
  const MOODS = [["Спокійна", "calm lofi"], ["Енергійна", "upbeat energetic"], ["Натхненна", "inspiring piano"], ["Смішна", "funny quirky"], ["Кіно", "cinematic tension"]];
  const AMBS = [["Ліс", "forest birds"], ["Дощ", "rain"], ["Місто", "city street"], ["Кафе", "cafe ambience"], ["Море", "ocean waves"], ["Офіс", "office ambience"]];
  function soundSheet(B, getPos, playIt) {
    const S = E().sheet(B, "Звук", ""), b = S.body, FXP = E().FXP;
    const bed = (k, title, presets) => { const o = P[k]; return `<div class="lbl">${title}</div><div class="chips">${presets.map(([n, q]) => `<button class="chip" type="button" data-bq="${k}|${q}" aria-pressed="${o && !o.off && o.q === q}">${n}</button>`).join("")}<button class="chip" type="button" data-boff="${k}" aria-pressed="${!o || !!o.off}">Без</button></div>
      ${o && !o.off && o.alts?.length ? `<div class="alts">${o.alts.map((it, i) => `<button type="button" class="alt snd${i === o.i ? " on" : ""}" data-bi="${k}|${i}">${i + 1}</button>`).join("")}</div><input type="range" data-bv="${k}" min="0" max="100" value="${Math.round(o.vol * 100)}">` : ""}`; };
    const draw = () => {
      b.innerHTML = `<div class="lbl" style="margin-top:0">Голос</div><div class="chips">${Object.entries(FXP).map(([k, v]) => `<button class="chip" type="button" data-fx="${k}" aria-pressed="${(P.fx || "orig") === k}">${v.n}</button>`).join("")}</div>
        ${bed("music", "Музика", MOODS)}${bed("amb", "Фоновий звук", AMBS)}`;
      const replay = () => { stopPlay(); playIt(getPos()); };
      b.querySelectorAll("[data-fx]").forEach((x) => x.onclick = () => { P.fx = x.dataset.fx; track("fx", { v: P.fx }); draw(); replay(); });
      b.querySelectorAll("[data-bq]").forEach((x) => x.onclick = async () => { const [k, q] = x.dataset.bq.split("|"); try {
        const items = await busyRun("text", () => SRV.media(k === "music" ? "music" : "sound", q, 7)); if (!items.length) { say("Нічого не знайшлося"); return; }
        P[k] = { q, alts: items, i: 0, vol: P[k]?.vol ?? (k === "music" ? .3 : .22), buf: await busyRun("voice", () => bedBuf(items[0])) }; track(k, { v: q }); draw(); replay(); } catch (e) { say("Не вдалося завантажити"); } });
      b.querySelectorAll("[data-boff]").forEach((x) => x.onclick = () => { const k = x.dataset.boff; if (P[k]) P[k].off = true; draw(); replay(); });
      b.querySelectorAll("[data-bi]").forEach((x) => x.onclick = async () => { const [k, i] = x.dataset.bi.split("|"), o = P[k]; try { o.buf = await busyRun("voice", () => bedBuf(o.alts[+i])); o.i = +i; o.off = false; draw(); replay(); } catch (e) { say("Не вдалося завантажити"); } });
      b.querySelectorAll("[data-bv]").forEach((x) => x.onchange = () => { P[x.dataset.bv].vol = x.value / 100; replay(); });
    };
    draw(); return S;
  }
  function screenEdit(msg) {
    const d = UI.root?.querySelector(".vstage") ? UI.root : shell("Монтаж відео"), B = $(d, ".vb"), F = $(d, ".vf");
    stopPlay(); SELW = -1; POS = Math.min(POS, Math.max(0, TOT - .05)); $(d, "#vundo").hidden = !P.hist.length;
    const nav = $(d, "#shnav"); if (nav) { nav.innerHTML = SH && SH.length > 1 ? `<button class="vx" type="button" data-sh2="-1" aria-label="Попередній"${SHI ? "" : " disabled"}>‹</button><span>${SHI + 1}/${SH.length}</span><button class="vx" type="button" data-sh2="1" aria-label="Наступний"${SHI < SH.length - 1 ? "" : " disabled"}>›</button>` : "";
      nav.querySelectorAll("[data-sh2]").forEach((b) => b.onclick = () => { POS = 0; openShort(SHI + +b.dataset.sh2); }); }
    B.className = "vb";
    B.innerHTML = `<div class="vstage"><div class="bar">${tool("style", IC2.style, "Стиль")}${tool("hook", IC2.plaque, "Плашка")}${tool("text", E().IC.text, "Текст")}</div>
        <div class="cvw"><canvas id="vcv" width="540" height="960"></canvas><button class="pb" type="button" id="vpb" aria-label="Дивитись"><i>${ICON.play}</i></button></div>
        <div class="bar">${tool("ins", IC2.ins, "Вставки", P.media.length)}${tool("fx", E().IC.eq, "Музика")}${tool("neu", IC2.neu, "Нове")}</div></div>
      <div class="seekrow"><input type="range" id="vseek" min="0" max="1000" value="${Math.round(POS / Math.max(.1, TOT) * 1000)}"><span id="vtm">${fmt(POS)} / ${fmt(TOT)}</span></div>
      ${msg ? `<div class="msg">${escH(msg)}</div>` : ""}`;
    F.innerHTML = `<div class="rowf"><button class="btn" type="button" id="vvoice">${ICON.mic} Скажи, що змінити</button><button class="btn sq" type="button" id="vwrite" aria-label="Написати">${E().IC.pen}</button></div>
      <button class="btn main" type="button" id="vsave">Зберегти відео</button>`;
    const cv = $(B, "#vcv"), pb = $(B, "#vpb"), seek = $(B, "#vseek"), tm = $(B, "#vtm"), cw = $(B, ".cvw"), stage = $(B, ".vstage");
    // відео завжди максимально велике між кнопками, без прокрутки
    const fit = () => { const h = stage.clientHeight - 8, bars = [...stage.querySelectorAll(".bar")].reduce((a, b) => a + b.offsetWidth, 0) + 16, w = Math.max(90, Math.min(h * 9 / 16, stage.clientWidth - bars - 12)); cw.style.width = w + "px"; cw.style.height = w * 16 / 9 + "px"; };
    fit(); requestAnimationFrame(fit); const ro = new ResizeObserver(fit); ro.observe(stage);
    const setPlay = (on) => { pb.innerHTML = on ? "" : `<i>${ICON.play}</i>`; };
    const hlWord = (t) => { B.querySelectorAll(".w.now").forEach((e) => e.classList.remove("now")); const i = wordAt(t); if (i >= 0) B.querySelector(`.w[data-i="${i}"]`)?.classList.add("now"); };
    const showAt = (t) => { POS = t; seek.value = Math.round(t / TOT * 1000); tm.textContent = `${fmt(t)} / ${fmt(TOT)}`; };
    still(POS, cv);
    const playIt = (from) => { setPlay(true); playFrom(from, cv, { tick: (t) => { showAt(t); hlWord(t); }, onend: () => setPlay(false), done: () => { POS = 0; } }); };
    pb.onclick = () => { const br = brollAt(POS); if (!PL && br && SELL !== br.b) { SELL = br.b; B.querySelectorAll(".yvsh").forEach((x) => x._close(true)); $(B, '[data-sh="ins"]')?.click(); return; } if (PL) { stopPlay(); return; } playIt(POS >= TOT - .1 ? 0 : POS); };
    seek.oninput = () => { stopPlay(); showAt(seek.value / 1000 * TOT); still(POS, cv); };
    const redraw = () => { build(); if (!PL) still(POS, cv); };
    const refresh = (m) => { build(); screenEdit(m); };
    wireTools(B, {
      style: () => { const S = E().sheet(B, "Субтитри", `<div class="chips"><button class="chip" type="button" id="vsoff" aria-pressed="${!!P.style.off}">Без субтитрів</button>${Object.entries(PRESETS).map(([k, v]) => `<button class="chip" type="button" data-pr="${k}" aria-pressed="${P.preset === k}">${v.n}</button>`).join("")}${P.preset === "shot" ? `<button class="chip" type="button" aria-pressed="true">Як на скріні</button>` : ""}</div>
          <div class="lbl">Розмір</div><input type="range" id="vsz" min="60" max="150" value="${Math.round(P.style.size * 100)}"><div class="lbl">Висота</div><input type="range" id="vps" min="12" max="88" value="${Math.round(P.style.pos * 100)}">
          <div class="lbl">Слів на екрані</div><div class="chips">${[1, 2, 3, 4].map((n) => `<button class="chip" type="button" data-wn="${n}" aria-pressed="${P.style.words === n}">${n}</button>`).join("")}</div>`), b = S.body;
        $(b, "#vsoff").onclick = (e) => { pushHist(); P.style.off = !P.style.off; e.currentTarget.setAttribute("aria-pressed", P.style.off); redraw(); };
        b.querySelectorAll("[data-pr]").forEach((x) => x.onclick = () => { pushHist(); P.preset = x.dataset.pr; track("style", { v: P.preset }); P.style = sanitizeStyle({ ...BASE, ...PRESETS[P.preset].s }); $(b, "#vsoff").setAttribute("aria-pressed", "false"); b.querySelectorAll("[data-pr]").forEach((o) => o.setAttribute("aria-pressed", o === x)); $(b, "#vsz").value = Math.round(P.style.size * 100); $(b, "#vps").value = Math.round(P.style.pos * 100); redraw(); $(d, "#vundo").hidden = false; });
        $(b, "#vsz").oninput = (e) => { P.style.size = e.target.value / 100; redraw(); };
        $(b, "#vps").oninput = (e) => { P.style.pos = e.target.value / 100; redraw(); };
        b.querySelectorAll("[data-wn]").forEach((x) => x.onclick = () => { P.style.words = +x.dataset.wn; b.querySelectorAll("[data-wn]").forEach((o) => o.setAttribute("aria-pressed", o === x)); redraw(); }); return S; },
      hook: () => { const S = E().sheet(B, "Плашка на початку", `<input type="text" id="vhook" value="${escH(P.hook)}" placeholder="Без плашки"><div class="chips" style="margin-top:8px"><button class="chip" type="button" id="vhno">Без плашки</button></div>`), b = S.body;
        const h = $(b, "#vhook"); h.oninput = () => { P.hook = h.value.trim(); POS = Math.min(POS, 1); showAt(POS); still(POS, cv); }; h.onfocus = () => pushHist();
        $(b, "#vhno").onclick = () => { pushHist(); P.hook = ""; h.value = ""; still(POS, cv); }; return S; },
      text: () => textSheet(B, cv, playIt, refresh),
      ins: () => insSheet(B, cv, () => POS, redraw, refresh, playIt),
      fx: () => soundSheet(B, () => POS, playIt),
      neu: () => { const S = E().sheet(B, "Почати нове відео?", `<p style="margin:0 0 10px;color:#a1a1aa;font-size:13.5px">Поточний монтаж не збережеться.</p><button class="btn" type="button" id="vnew">Так, нове відео</button>`); $(S.body, "#vnew").onclick = () => { stopPlay(); SH = null; screenStart(); }; return S; },
    }, fit);
    $(F, "#vwrite").onclick = () => { B.querySelectorAll(".yvsh").forEach((x) => x._close(true)); const S = E().sheet(B, "Що змінити?", `<textarea id="vcmd" rows="3" placeholder="Напр.: субтитри більші й жовті, прибери частину про ціни"></textarea><button class="btn main" type="button" id="vgo2" style="margin-top:8px">Застосувати</button>`); fit();
      const ta = $(S.body, "#vcmd"); setTimeout(() => ta.focus(), 50);
      $(S.body, "#vgo2").onclick = async () => { const v = ta.value.trim(); if (!v) return; S.close(true); try { refresh(await aiCommand(v, false)); track("cmd_text"); } catch (x) { say("Не вийшло застосувати правку"); } }; };
    const vv = $(F, "#vvoice"), vl = vv.innerHTML;
    vv.onclick = () => { stopPlay(); if (!vv._rec) say("Кажи: «субтитри більші», «виріж частину про…»"); E().record(vv, vl, async (buf) => {
      try { const t = await busyRun("listen", () => sttBuf(buf)); if (!t.trim()) { say("Не почув"); return; } refresh(`«${t}» → ${await aiCommand(t, true)}`); track("cmd_voice"); } catch (x) { console.error(x); say("Не вийшло застосувати правку"); } }); };
    $(F, "#vsave").onclick = async () => {
      stopPlay(); const sv = $(F, "#vsave"); sv.disabled = true; sv.innerHTML = `Зберігаю… <b id="vpp">0%</b>`;
      try { const out = await exportVideo((p) => { const e = $(F, "#vpp"); if (e) e.textContent = Math.round(clamp(p) * 100) + "%"; });
        track("save", { v: P.preset + "|" + out.ext }); if (out.ext === "webm") say("Вийшов webm — для Instagram краще зберігати в Safari на iPhone");
        // iPhone дозволяє «Зберегти відео» в Фото лише після свіжого тапу — тому окрема кнопка, коли файл готовий
        E().offerSave(F, [new File([out.blob], `yuvi_${SH ? "short" + (SHI + 1) : "montazh"}_${new Date().toISOString().slice(0, 10)}.${out.ext}`, { type: out.blob.type })], () => screenEdit(), () => track("saved"));
        still(POS, cv); return;
      } catch (x) { console.error(x); say("Не вдалося зберегти відео"); }
      sv.disabled = false; sv.textContent = "Зберегти відео"; still(POS, cv); };
  }

  function textSheet(B, cv, playIt, refresh) {
    const cls = (i) => `w${P.cut.has(i) ? " cut" : ""}${P.zoom.has(i) ? " z" : ""}${P.emph.has(i) ? " em" : ""}${P.broll.some((b) => i >= b.a && i <= b.b) ? " br" : ""}`;
    const S = E().sheet(B, "Текст", `<div class="act" id="vact"><span class="q">Тапни слово</span></div><div class="txt">${P.words.map((w, i) => `<span class="${cls(i)}" data-i="${i}">${escH(w.w)}</span>`).join(" ")}</div>`), b = S.body;
    const reopen = () => { refresh(); $(UI.root, '.vb [data-sh="text"]')?.click(); };
    b.querySelectorAll(".w").forEach((w) => w.onclick = () => { const i = SELW = +w.dataset.i; b.querySelectorAll(".w.sel").forEach((x) => x.classList.remove("sel")); w.classList.add("sel");
      const inB = P.broll.find((q) => i >= q.a && i <= q.b), bar = $(b, "#vact");
      bar.innerHTML = `<button class="chip" data-a="cut">${P.cut.has(i) ? "Повернути" : "Вирізати"}</button><button class="chip" data-a="sent">${P.cut.has(i) ? "Повернути речення" : "До крапки"}</button><button class="chip" data-a="zoom">${P.zoom.has(i) ? "Без наїзду" : "Наїзд"}</button><button class="chip" data-a="em">${P.emph.has(i) ? "Не виділяти" : "Виділити"}</button>${P.media.map((m, k) => `<button class="chip" data-m="${k}">${IC2.ins}${escH(m.name.slice(0, 10))}</button>`).join("")}${inB ? `<button class="chip" data-m="-1">Без вставки</button>` : ""}<button class="chip" data-a="go">▶</button>`;
      const apply = (fn) => { pushHist(); fn(); reopen(); };
      $(bar, '[data-a="cut"]').onclick = () => apply(() => { P.cut.has(i) ? P.cut.delete(i) : P.cut.add(i); });
      $(bar, '[data-a="sent"]').onclick = () => apply(() => { const to = !P.cut.has(i); for (let j = i; j < P.words.length; j++) { to ? P.cut.add(j) : P.cut.delete(j); if (/[.!?…]$/.test(P.words[j].w)) break; } });
      $(bar, '[data-a="zoom"]').onclick = () => apply(() => { P.zoom.has(i) ? P.zoom.delete(i) : P.zoom.add(i); });
      $(bar, '[data-a="em"]').onclick = () => apply(() => { P.emph.has(i) ? P.emph.delete(i) : P.emph.add(i); });
      bar.querySelectorAll("[data-m]").forEach((x) => x.onclick = () => apply(() => { const m = +x.dataset.m; if (m < 0) { P.broll = P.broll.filter((q) => q !== inB); return; }
        let j = i; const t0 = P.words[i].s; while (j + 1 < P.words.length && P.words[j + 1].e - t0 < 2.2) j++; P.broll = P.broll.filter((q) => q.m !== m); P.broll.push({ m, a: i, b: j }); }));
      $(bar, '[data-a="go"]').onclick = () => { const o = WOUT[i] || WOUT.find((q, k) => k > i && q); stopPlay(); playIt(o ? Math.max(0, o.s - .1) : 0); }; });
    return S;
  }

  window.YVVideo = { open() { screenStart(); track("open"); }, _t: { set: (p) => { P = p; }, fresh, audioOf, thumbOf, build, drawFrame, screenEdit, aiPlan, aiCommand, outToSrc, seg: () => SEG, tot: () => TOT, chunks: () => CHUNKS, exportVideo, P: () => P, mkVideo, loadMeta, run: () => run() } };
})();
