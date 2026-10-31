/* YuVi · «Анімація лініями» (тест, лише власник).
   Людина наговорює голос (або завантажує запис) → розпізнаємо слова → AI складає сцени з «деталей»
   (чоловічок-паличка з рухами, предмети, написи) → сайт сам малює лінії: промальовування, «живі» лінії, рух на словах.
   Без генерації картинок і відео: усе — лінії в коді, тому майже безкоштовно і завжди чисто. */
(() => {
  "use strict";
  const E = () => window.YVTalk._t;
  const OW = 1080, OH = 1920, FPS = 30;
  const $ = (r, s) => r.querySelector(s);
  const escH = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const say = (t) => { try { toast(t); } catch (e) {} };
  const track = (st, m) => { try { window.yvTrack?.("lines", st, m); } catch (e) {} };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const AC = () => (window.__yvTalkAC ||= new (window.AudioContext || window.webkitAudioContext)());
  const rnd = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  const ease = (v) => v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
  const back = (v) => { const c = 1.7; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };
  const D = Math.PI / 180;

  /* ---------- предмети: лінії в одиницях (≈ −1…1) ---------- */
  const arc = (cx, cy, r, a0 = 0, a1 = 360, n = 28) => { const p = []; for (let i = 0; i <= n; i++) { const a = (a0 + (a1 - a0) * i / n) * D; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; };
  const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  const SH = {
    money: () => [rect(-1, -.55, 2, 1.1), arc(0, 0, .3), [[-.78, -.32], [-.78, .32]], [[.78, -.32], [.78, .32]]],
    coin: () => [arc(0, 0, .8), arc(0, 0, .55, 0, 360, 22)],
    coins: () => [arc(-.35, .25, .5), arc(.4, .1, .5), arc(0, -.35, .5)],
    bag: () => [[[-.3, -.75], [-.55, -1], [.55, -1], [.3, -.75]], [[-.3, -.75], [-.85, -.1], [-.9, .45], [-.6, .85], [.6, .85], [.9, .45], [.85, -.1], [.3, -.75], [-.3, -.75]], arc(0, .15, .28)],
    phone: () => [[[-.5, -1], [.5, -1], [.5, 1], [-.5, 1], [-.5, -1]], [[-.12, .8], [.12, .8]], [[-.5, -.75], [.5, -.75]]],
    laptop: () => [rect(-.85, -.8, 1.7, 1.15), [[-1.15, .45], [1.15, .45], [1, .62], [-1, .62], [-1.15, .45]]],
    camera: () => [rect(-.9, -.5, 1.8, 1.2), arc(0, .1, .4), [[-.35, -.5], [-.2, -.75], [.2, -.75], [.35, -.5]]],
    arrow: () => [[[-1, 0], [1, 0]], [[.55, -.4], [1, 0], [.55, .4]]],
    up: () => [[[-1, .8], [-.35, .05], [.05, .4], [1, -.7]], [[.5, -.72], [1, -.7], [.97, -.2]]],
    down: () => [[[-1, -.8], [-.35, -.05], [.05, -.4], [1, .7]], [[.5, .72], [1, .7], [.97, .2]]],
    chart: () => [[[-1, -1], [-1, 1], [1, 1]], rect(-.75, .35, .35, .65), rect(-.25, -.05, .35, 1.05), rect(.25, -.6, .35, 1.6)],
    question: () => [[...arc(0, -.4, .42, 190, 380, 18), [.12, -.05], [0, .2], [0, .4]], arc(0, .8, .09, 0, 360, 10)],
    exclaim: () => [[[0, -1], [0, .45]], arc(0, .82, .09, 0, 360, 10)],
    heart: () => [[[0, .9], [-.85, 0], ...arc(-.45, -.35, .45, 140, 340, 10).slice(1), ...arc(.45, -.35, .45, 200, 400, 10).slice(1), [.85, 0], [0, .9]]],
    star: () => { const p = []; for (let i = 0; i <= 10; i++) { const a = (-90 + i * 36) * D, r = i % 2 ? .42 : 1; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return [p]; },
    house: () => [[[-.8, -.1], [0, -.9], [.8, -.1]], [[-.65, -.25], [-.65, .9], [.65, .9], [.65, -.25]], rect(-.18, .35, .36, .55)],
    bulb: () => [[...arc(0, -.25, .62, 135, 405, 24), [.25, .55], [-.25, .55], [-.44, .19]], [[-.22, .72], [.22, .72]], [[-.15, .88], [.15, .88]]],
    clock: () => [arc(0, 0, .95)],
    box: () => [[[-.8, -.3], [0, -.7], [.8, -.3], [0, .1], [-.8, -.3]], [[-.8, -.3], [-.8, .55], [0, .95], [.8, .55], [.8, -.3]], [[0, .1], [0, .95]]],
    eye: () => [[...arc(0, .7, 1.05, 220, 320, 14)], [...arc(0, -.7, 1.05, 40, 140, 14)], arc(0, 0, .3, 0, 360, 16)],
    cloud: () => [[...arc(-.5, .1, .4, 90, 270, 10), ...arc(-.1, -.3, .45, 190, 340, 10), ...arc(.45, -.05, .42, 250, 450, 12), [-.5, .5]], arc(-.75, .85, .12, 0, 360, 10), arc(-.95, 1.1, .07, 0, 360, 8)],
    bolt: () => [[[.15, -1], [-.45, .1], [.05, .1], [-.2, 1], [.5, -.25], [0, -.25], [.15, -1]]],
    target: () => [arc(0, 0, .95), arc(0, 0, .6, 0, 360, 22), arc(0, 0, .25, 0, 360, 14)],
    check: () => [[[-.8, 0], [-.25, .6], [.85, -.6]]],
    cross: () => [[[-.7, -.7], [.7, .7]], [[.7, -.7], [-.7, .7]]],
    gear: () => { const p = []; for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, r = (Math.floor(i / 3) % 2) ? .75 : .95; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return [p, arc(0, 0, .3, 0, 360, 14)]; },
    rocket: () => [[[0, -1], [.35, -.45], [.35, .5], [-.35, .5], [-.35, -.45], [0, -1]], arc(0, -.2, .14, 0, 360, 10), [[-.35, .2], [-.65, .7], [-.35, .55]], [[.35, .2], [.65, .7], [.35, .55]], [[-.15, .6], [0, .95], [.15, .6]]],
    book: () => [[[0, -.6], [-.9, -.8], [-.9, .7], [0, .9], [.9, .7], [.9, -.8], [0, -.6], [0, .9]]],
    lock: () => [rect(-.6, -.1, 1.2, 1), [...arc(0, -.25, .38, 180, 360, 12)], [[0, .25], [0, .55]]],
    rope: () => [[[0, -1], [0, 1]]],
  };
  const KINDS = Object.keys(SH);

  /* ---------- чоловічок: скелет і рухи ---------- */
  // пози в градусах: b — нахил тулуба, h — нахил голови; руки/ноги: 1 — від плеча/стегна (від вертикалі вниз), 2 — згин ліктя/коліна; y — присід; r — поворот усього тіла
  // sv: 1 — вигляд збоку («+» — уперед), інакше спереду («+» — назовні, в свій бік)
  const P0 = { b: 0, h: 0, la1: 14, la2: 6, ra1: 14, ra2: 6, ll1: 7, ll2: 0, rl1: 7, rl2: 0, y: 0, r: 0, sv: 0 };
  const POSE = {
    stand: () => ({}),
    walk: (t) => { const s = Math.sin(t * 7); return { sv: 1, ll1: 28 * s, rl1: -28 * s, ll2: Math.max(0, -s) * 40, rl2: Math.max(0, s) * 40, la1: -24 * s, ra1: 24 * s, la2: 20, ra2: 20, y: -Math.abs(Math.cos(t * 7)) * .08 + .06, b: 4 }; },
    run: (t) => { const s = Math.sin(t * 11); return { sv: 1, ll1: 50 * s, rl1: -50 * s, ll2: 25 + Math.max(0, -s) * 75, rl2: 25 + Math.max(0, s) * 75, la1: -50 * s, ra1: 50 * s, la2: 85, ra2: 85, y: -Math.abs(Math.cos(t * 11)) * .22 + .14, b: 14 }; },
    jump: (t, d) => { const p = clamp(t / d); if (p < .25) { const q = p / .25; return { sv: 1, y: .45 * q, ll1: 35 * q, rl1: 35 * q, ll2: 70 * q, rl2: 70 * q, la1: -45 * q, ra1: -45 * q, b: 18 * q }; }
      if (p < .8) { const q = (p - .25) / .55; return { sv: 1, y: -1.3 * Math.sin(q * Math.PI), la1: 165, ra1: 155, la2: 10, ra2: 10, ll1: 15, rl1: -12, ll2: 25, rl2: 25 }; }
      const q = (p - .8) / .2; return { sv: 1, y: .3 * (1 - q), ll1: 15 * (1 - q), rl1: 15 * (1 - q), ll2: 45 * (1 - q), rl2: 45 * (1 - q) }; },
    wave: (t) => ({ ra1: 125, ra2: 25 + 30 * Math.sin(t * 12), h: 8 }),
    cheer: (t) => ({ la1: 145 + 12 * Math.sin(t * 10), ra1: 145 - 12 * Math.sin(t * 10), la2: 15, ra2: 15, y: -Math.abs(Math.sin(t * 7)) * .25, ll1: 10, rl1: 10 }),
    think: (t) => ({ ra1: 25, ra2: -150, h: 14 + 4 * Math.sin(t * 2) }),
    point: () => ({ sv: 1, ra1: 90, ra2: 0, la1: 8, la2: 10, ll1: 6, rl1: -6, h: 4 }),
    shrug: (t) => ({ la1: 40, la2: 95, ra1: 40, ra2: 95, h: 12 * Math.sin(t * 3), y: -.05 }),
    sad: () => ({ h: 28, b: 8, la1: 5, ra1: 5, la2: 0, ra2: 0 }),
    sit: () => ({ sv: 1, y: .8, ll1: 88, rl1: 82, ll2: 88, rl2: 88, la1: 35, la2: 40, ra1: 25, ra2: 45 }),
    fall: (t) => ({ sv: 1, r: 88 * ease(clamp(t / .55)), la1: 120, ra1: 80, ll1: 20, rl1: -15 }),
    hang: (t) => ({ r: 180, la1: 70 + 8 * Math.sin(t * 2.4), ra1: 70 - 8 * Math.sin(t * 2.4), la2: 10, ra2: 10, ll1: 4, rl1: 4, h: 8 * Math.sin(t * 1.7) }),
    dance: (t) => { const s = Math.sin(t * 8); return { la1: s > 0 ? 140 : 40, ra1: s > 0 ? 40 : 140, la2: 50, ra2: 50, ll1: 12 + 10 * s, rl1: 12 - 10 * s, ll2: -15, rl2: -15, y: Math.abs(s) * .15, b: 6 * s }; },
  };
  const LASTING = new Set(["think", "point", "sad", "sit", "fall", "hang"]);
  const DUR = { jump: .95, wave: 1.6, cheer: 1.6, shrug: 1.2, dance: 2.4 };
  const MOVES = ["walk_to", "run_to", "jump", "wave", "cheer", "think", "point", "shrug", "sad", "sit", "stand", "fall", "hang", "dance", "pop", "bounce", "spin", "shake", "fly_to", "grow", "hide"];
  const mixPose = (a, b, w) => { const o = {}; for (const k in P0) o[k] = (a[k] ?? P0[k]) * (1 - w) + (b[k] ?? P0[k]) * w; o.sv = w < .5 ? (a.sv || 0) : (b.sv || 0); return o; };

  /* ---------- стан ---------- */
  let L = null; // проєкт: { aud, words, scenes, style, subs, hist }
  let TOT = 0, ST = [], CH = [];
  const STYLES = { neon: { n: "Неон", bg: "#06070b", ink: "#f2f4ff", glow: true, grid: true, acc: "#ffd60a", font: "Manrope" }, marker: { n: "Маркер", bg: "#fbfaf6", ink: "#151515", glow: false, grid: false, acc: "#d0312d", font: "Caveat" } };
  function prep() {
    const W = L.words; TOT = (L.aud?.length || 0) / E().SR;
    const at = (i) => W[clamp(i | 0, 0, W.length - 1)]?.s ?? 0;
    ST = []; (L.scenes || []).forEach((s) => { const t0 = ST.length ? at(s.a) : 0; if (ST.length && t0 <= ST[ST.length - 1].t0 + .4) return; ST.push({ s, t0 }); });
    ST.forEach((q, k) => { q.t1 = ST[k + 1] ? ST[k + 1].t0 : TOT + 1; q.n = k + 1;
      q.items = (q.s.items || []).map((it, ii) => { const t = Math.max(q.t0, it.at != null ? at(it.at) - .1 : q.t0 + ii * .25);
        const mv = (it.moves || []).map((m) => ({ ...m, t: Math.max(q.t0, at(m.i) - .05) })).sort((a, b) => a.t - b.t); return { ...it, ta: t, mv, seed: k * 31 + ii * 7 + 1 }; }); });
    // субтитри: по 2–4 слова
    CH = []; let c = null;
    W.forEach((w, i) => { if (!c || c.idx.length >= 3 || /[.!?…,:;]$/.test(W[c.idx[c.idx.length - 1]].w) || w.s - c.e > .5) { c && CH.push(c); c = { idx: [i], s: w.s, e: w.e }; } else { c.idx.push(i); c.e = w.e; } });
    c && CH.push(c); CH.forEach((q, k) => { q.until = CH[k + 1] ? Math.min(CH[k + 1].s, q.e + .5) : q.e + .6; });
  }

  /* ---------- малювання ---------- */
  let BOIL = 0;
  function strokes(x, list, prog, sty, k, lw = 5.5) {
    const len = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
    const tot = list.reduce((a, p) => a + len(p), 0); let left = prog >= 1 ? 1e9 : tot * prog;
    x.lineCap = "round"; x.lineJoin = "round"; x.lineWidth = lw * k; x.strokeStyle = sty.ink;
    const pass = () => { let l = left; x.beginPath(); for (const p of list) { if (l <= 0) break; x.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length && l > 0; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (d <= l) { x.lineTo(p[i][0], p[i][1]); l -= d; } else { const f = l / d; x.lineTo(p[i - 1][0] + (p[i][0] - p[i - 1][0]) * f, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * f); l = 0; } } } x.stroke(); };
    if (sty.glow) { x.save(); x.shadowColor = "rgba(190,210,255,.95)"; x.shadowBlur = 22 * k; pass(); x.restore(); x.save(); x.lineWidth = lw * .45 * k; x.strokeStyle = "#ffffff"; pass(); x.restore(); }
    else pass();
  }
  // «живі» лінії: легке тремтіння, нове 8 разів на секунду
  const jit = (pts, seed, k) => pts.map((p, i) => [p[0] + (rnd(seed + i * 1.7, BOIL) - .5) * 2.4 * k, p[1] + (rnd(seed * 3.1 + i, BOIL + 9) - .5) * 2.4 * k]);
  function figure(pose, x0, y0, U, f) {
    const P = { ...P0, ...pose }, sv = P.sv > .5;
    const hip = [0, -1.65 + P.y], tb = P.b * D, neck = [hip[0] + Math.sin(tb) * 1.3, hip[1] - Math.cos(tb) * 1.3], sh = [neck[0] + (hip[0] - neck[0]) * .16, neck[1] + (hip[1] - neck[1]) * .16];
    // напрям кінцівки: збоку — уперед, спереду — у свій бік (s = −1 ліва, +1 права)
    const dir = (a, s) => [(sv ? 1 : s) * Math.sin(a * D), Math.cos(a * D)];
    const limb = (o, a1, a2, l1, l2, s, leg) => { const off = leg ? 0 : (sv ? P.b : 0), d1 = dir(a1 + off, s), e = [o[0] + d1[0] * l1, o[1] + d1[1] * l1], d2 = dir(a1 + off + (leg && sv ? -a2 : a2), s); return [o, e, [e[0] + d2[0] * l2, e[1] + d2[1] * l2]]; };
    const ht = (P.b + P.h) * D, hc = [neck[0] + Math.sin(ht) * .5, neck[1] - Math.cos(ht) * .5];
    let parts = [[hip, neck], arc(hc[0], hc[1], .42, 0, 360, 20), limb(sh, P.la1, P.la2, .72, .66, -1), limb(sh, P.ra1, P.ra2, .72, .66, 1), limb(hip, P.ll1, P.ll2, .85, .82, -1, 1), limb(hip, P.rl1, P.rl2, .85, .82, 1, 1)];
    if (P.r) { const c = P.r > 120 ? [0, -1.65] : [0, 0], a = P.r * D; parts = parts.map((p) => p.map(([x, y]) => [c[0] + (x - c[0]) * Math.cos(a) - (y - c[1]) * Math.sin(a), c[1] + (x - c[0]) * Math.sin(a) + (y - c[1]) * Math.cos(a)])); }
    return parts.map((p) => p.map(([x, y]) => [x0 + x * f * U, y0 + y * U]));
  }
  // стан персонажа в момент t: позиція, напрям, поза
  function manAt(it, t, SW) {
    let x = it.x ?? .5, f = it.f ?? 1, state = "stand", ts = it.ta, prev = "stand", pts = it.ta, from = null;
    for (const m of it.mv) { if (m.t > t) break;
      if (m.m === "walk_to" || m.m === "run_to") { const tx = clamp(m.x ?? x, .08, .92), d = Math.abs(tx - x), dur = Math.max(.4, d / (m.m === "run_to" ? .55 : .22));
        if (t < m.t + dur) { const p = (t - m.t) / dur; f = tx >= x ? 1 : -1; from = { x0: x, x1: tx, p, run: m.m === "run_to", tt: t - m.t }; x = x + (tx - x) * p; prev = state; state = "move"; ts = m.t; break; }
        f = tx >= x ? 1 : -1; x = tx; prev = state; state = "stand"; ts = m.t + dur; continue; }
      if (POSE[m.m] || m.m === "stand") { prev = state; pts = ts; state = m.m; ts = m.t; if (!LASTING.has(m.m) && m.m !== "stand" && t > m.t + (DUR[m.m] || 1.2)) { prev = state; state = "stand"; ts = m.t + (DUR[m.m] || 1.2); } } }
    const poseOf = (s, t0) => s === "move" ? POSE[from.run ? "run" : "walk"](t - t0) : (POSE[s] || POSE.stand)(t - t0, DUR[s] || 1.2);
    const cur = poseOf(state, ts), w = clamp((t - ts) / .25);
    const pose = w < 1 && prev !== state ? mixPose(poseOf(prev === "move" ? "stand" : prev, pts), cur, ease(w)) : cur;
    return { x, f, pose };
  }
  function propAt(it, t) {
    let x = it.x ?? .5, y = it.y ?? .5, s = it.s ?? 1, rot = 0, dy = 0, alpha = 1;
    for (const m of it.mv) { if (m.t > t) break; const d = t - m.t;
      if (m.m === "fly_to") { const p = ease(clamp(d / .8)), tx = m.x ?? x, ty = m.y ?? y; x += (tx - x) * p; y += (ty - y) * p; }
      else if (m.m === "grow") s *= 1 + .6 * back(clamp(d / .5));
      else if (m.m === "spin") rot += clamp(d / 1) * Math.PI * 2;
      else if (m.m === "bounce") dy -= Math.abs(Math.sin(clamp(d / 1.6) * Math.PI * 3)) * .04 * (1 - clamp(d / 1.6));
      else if (m.m === "shake") rot += Math.sin(d * 40) * .18 * (1 - clamp(d / .7));
      else if (m.m === "hide") alpha = 1 - clamp(d / .3);
      else if (m.m === "pop") s *= .6 + .4 * back(clamp(d / .4)); }
    if (it.k === "gear") rot += t * 1.2;
    return { x, y: y + dy, s, rot, alpha };
  }
  function drawScene(x, q, t, W, H, sty, k, fade = 1) {
    const top = 200 * k, stH = 900 * k, stY = 400 * k, U = 118 * k;
    x.save(); x.globalAlpha = fade;
    // заголовок у рамці + «стеля» зі штрихами
    if (q.s.title) { const pr = clamp((t - q.t0) / .5); x.font = `800 ${Math.round(74 * k)}px "${sty.font === "Caveat" ? "Caveat" : "Manrope"}", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
      const tt = String(q.s.title).toUpperCase(), tw = Math.min(W * .86, x.measureText(tt).width + 90 * k), bh = 130 * k, bx = (W - tw) / 2, by = top - bh / 2;
      strokes(x, [jit(rect(bx, by, tw, bh), q.n * 5, k)], pr, sty, k, 4.5);
      x.save(); x.globalAlpha *= clamp((t - q.t0 - .2) / .3); x.fillStyle = sty.ink; if (sty.glow) { x.shadowColor = "rgba(190,210,255,.9)"; x.shadowBlur = 18 * k; } x.fillText(tt, W / 2, top + 4 * k, tw - 50 * k); x.restore();
      const ly = top + bh / 2 + 42 * k, ticks = []; for (let i = 0; i < 10; i++) { const tx = W * .1 + i * W * .088; ticks.push(jit([[tx, ly], [tx + 26 * k, ly + 26 * k]], q.n * 9 + i, k)); }
      strokes(x, [jit([[W * .06, ly], [W * .94, ly]], q.n * 7, k), ...ticks], clamp((t - q.t0 - .15) / .5), sty, k, 3.5); }
    // предмети й люди
    for (const it of q.items) { if (t < it.ta) continue; const ap = clamp((t - it.ta) / (it.k === "man" ? .7 : .55));
      if (it.k === "man") { const m = manAt(it, t, W), gx = m.x * W, gy = stY + (it.y ?? .92) * stH, s = (it.s ?? 1);
        const hang = (it.mv.filter((v) => v.t <= t && (POSE[v.m] || v.m === "stand")).pop() || {}).m === "hang";
        const hy = stY + stH * .62, parts = figure(m.pose, gx, hang ? hy : gy, U * s, m.f).map((p, i) => jit(p, it.seed * 11 + i * 5, k));
        if (hang) strokes(x, [jit([[gx, stY - 90 * k], [gx, hy - 3.3 * U * s]], it.seed, k)], ap, sty, k, 4);
        strokes(x, parts, ap, sty, k, 6); continue; }
      if (it.k === "text") { const p = propAt(it, t); x.save(); x.globalAlpha *= p.alpha * clamp(ap * 1.6); x.translate(p.x * W, stY + p.y * stH); x.rotate(p.rot); x.scale(p.s, p.s);
        x.font = `800 ${Math.round(96 * k)}px "${sty.font}", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; const tw = x.measureText(it.t || "").width;
        x.beginPath(); x.rect(-tw / 2 - 10 * k, -80 * k, (tw + 20 * k) * clamp(ap * 1.3), 160 * k); x.clip(); x.fillStyle = it.acc ? sty.acc : sty.ink; if (sty.glow) { x.shadowColor = it.acc ? sty.acc : "rgba(190,210,255,.9)"; x.shadowBlur = 20 * k; } x.fillText(it.t || "", 0, 0); x.restore(); continue; }
      const fnS = SH[it.k]; if (!fnS) continue; const p = propAt(it, t), sz = 135 * k * p.s, cx = p.x * W, cy = stY + p.y * stH;
      let list = fnS().map((pp) => pp.map(([a, b]) => { const ca = Math.cos(p.rot), sa = Math.sin(p.rot); return [cx + (a * ca - b * sa) * sz, cy + (a * sa + b * ca) * sz]; }));
      if (it.k === "clock") { const a1 = t * 2, a2 = t * .2; list.push([[cx, cy], [cx + Math.sin(a1) * sz * .7, cy - Math.cos(a1) * sz * .7]], [[cx, cy], [cx + Math.sin(a2) * sz * .45, cy - Math.cos(a2) * sz * .45]]); }
      x.save(); x.globalAlpha *= p.alpha; strokes(x, list.map((pp, i) => jit(pp, it.seed * 13 + i * 3, k)), ap, it.acc ? { ...sty, ink: sty.acc } : sty, k, 5); x.restore(); }
    // підпис «ФІГ. N — …»
    const cap = q.s.caption || q.s.title; if (cap) { const cy = stY + stH + 64 * k; x.save(); x.globalAlpha *= clamp((t - q.t0 - .3) / .4); x.font = `700 ${Math.round(34 * k)}px "Manrope", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = sty.ink;
      const ct = `ФІГ. ${q.n} — ${String(cap).toUpperCase()}`; x.globalAlpha *= .75; x.fillText(ct, W / 2, cy, W * .85); const cw = Math.min(W * .85, x.measureText(ct).width); x.fillRect((W - cw) / 2, cy + 28 * k, cw, 2.5 * k); x.restore(); }
    x.restore();
  }
  function drawSubs(x, t, W, H, sty, k) {
    if (L.subs === false) return; const ch = CH.find((c) => t >= c.s - .05 && t < c.until); if (!ch) return;
    const px = Math.round(66 * k), y = 1500 * H / OH; x.font = `800 ${px}px "Manrope", system-ui, sans-serif`; x.textBaseline = "middle"; x.textAlign = "left";
    const ws = ch.idx.map((i) => ({ i, t: L.words[i].w.replace(/[,]+$/, "") })), sp = x.measureText(" ").width; ws.forEach((w) => w.w = x.measureText(w.t).width);
    const tw = ws.reduce((a, w) => a + w.w, 0) + sp * (ws.length - 1); let xx = (W - tw) / 2;
    ws.forEach((w) => { const cur = t >= L.words[w.i].s - .03 && t < L.words[w.i].e + .1; x.fillStyle = cur ? sty.acc : sty.ink;
      if (sty.glow) { x.shadowColor = cur ? sty.acc : "rgba(190,210,255,.8)"; x.shadowBlur = 16 * k; } else { x.lineWidth = 7 * k; x.strokeStyle = sty.bg; x.lineJoin = "round"; x.strokeText(w.t, xx, y); }
      x.fillText(w.t, xx, y); x.shadowBlur = 0; xx += w.w + sp; });
  }
  function drawFrame(x, t, W, H) {
    const sty = STYLES[L.style] || STYLES.neon, k = W / OW; BOIL = Math.floor(t * 8);
    x.fillStyle = sty.bg; x.fillRect(0, 0, W, H);
    if (sty.grid) { x.strokeStyle = "rgba(160,180,255,.06)"; x.lineWidth = 1.5 * k; x.beginPath(); for (let gx = 0; gx <= W; gx += 54 * k) { x.moveTo(gx, 0); x.lineTo(gx, H); } for (let gy = 0; gy <= H; gy += 54 * k) { x.moveTo(0, gy); x.lineTo(W, gy); } x.stroke();
      const g = x.createRadialGradient(W / 2, H * .4, H * .1, W / 2, H * .45, H * .75); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.65)"); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    const i = ST.findIndex((q) => t >= q.t0 && t < q.t1); if (i >= 0) { const q = ST[i], d = t - q.t0;
      if (i > 0 && d < .25) drawScene(x, ST[i - 1], t, W, H, sty, k, 1 - d / .25);
      drawScene(x, q, t, W, H, sty, k, i > 0 ? clamp(d / .2) : 1); }
    drawSubs(x, t, W, H, sty, k);
  }

  /* ---------- AI: сцени з деталей ---------- */
  const numbered = () => L.words.map((w, i) => `${i}:${w.w}`).join(" ");
  const SPEC = `Деталі: "man" — чоловічок-паличка (x — 0…1 по ширині, y — земля 0…1, зазвичай 0.92; f — 1 дивиться вправо, -1 вліво); предмети: ${KINDS.join(", ")} (x, y — центр 0…1; s — розмір 0.6…2; acc:true — акцентний колір); "text" — короткий напис до 3 слів або число («500 грн», «x10»), поле t.
Рухи (moves: [{"i":номер слова, коли почати,"m":рух, ...}]): для man — walk_to (x), run_to (x), jump, wave, cheer, think, point, shrug, sad, sit, stand, fall, hang (висить догори ногами), dance; для предметів і написів — pop, bounce, spin, shake, fly_to (x, y), grow, hide. Поле "at" — номер слова, коли деталь з'являється (інакше — на початку сцени).`;
  async function aiScenes(extra = "") {
    const r = await sample.json(`Ти режисер коротких анімаційних відео в стилі «малюнок лініями» (як інструкція-креслення, але з гумором). Людина говорить за кадром — ось дослівні слова з номерами:
${numbered()}
${extra}
Розбий на сцени: одна сцена — одна думка, 3–8 секунд, по черзі на весь ролик, перша починається зі слова 0. Для кожної сцени: a — номер слова початку; title — заголовок у рамці, 2–4 слова (суть думки); caption — підпис під сценою, 2–5 слів (можна як title); items — 1–4 деталі, які наочно й смішно показують думку: майже завжди чоловічок, що щось робить, і 1–2 предмети або напис. Рухи став точно на ті слова, про які йдеться. Не захаращуй: простота й рух важливіші.
${SPEC}
Відповідай тільки JSON: {"scenes":[{"a":0,"title":"…","caption":"…","items":[{"k":"man","x":0.3,"y":0.92,"moves":[{"i":3,"m":"walk_to","x":0.6}]},{"k":"money","x":0.75,"y":0.5,"at":5,"moves":[{"i":5,"m":"pop"}]}]}]}`, { cache: false, kb: true, max: 4000 });
    const sc = normalize(r?.scenes || []); if (!sc.length) throw new Error("plan"); return sc;
  }
  async function aiEdit(text) {
    const r = await sample.json(`Ти режисер анімації лініями. Слова озвучки з номерами:
${numbered()}
Поточні сцени (JSON): ${JSON.stringify(L.scenes)}
${SPEC}
Людина просить змінити: «${text}». Зміни лише те, про що просять (додай/прибери деталі, рухи, заголовки, перестав сцени). Якщо просить змінити стиль на маркер/неон або субтитри — поле "style":"neon"|"marker", "subs":true|false.
Відповідай тільки JSON: {"scenes":[…повний новий список…],"style":"…","subs":true,"say":"одне коротке речення — що зроблено"}`, { cache: false, kb: true, max: 4000 });
    if (Array.isArray(r?.scenes) && r.scenes.length) { const sc = normalize(r.scenes); if (sc.length) L.scenes = sc; }
    if (r?.style && STYLES[r.style]) L.style = r.style; if (typeof r?.subs === "boolean") L.subs = r.subs;
    return r?.say || "Готово.";
  }
  function normalize(list) { const n = L.words.length, okI = (v) => Number.isInteger(v) && v >= 0 && v < n;
    return (Array.isArray(list) ? list : []).filter((s) => s && okI(s.a)).sort((a, b) => a.a - b.a).slice(0, 40).map((s) => ({ a: s.a, title: String(s.title || "").slice(0, 32), caption: String(s.caption || "").slice(0, 40),
      items: (s.items || []).filter((it) => it && (it.k === "man" || it.k === "text" || SH[it.k])).slice(0, 5).map((it) => ({ k: it.k, x: clamp(+it.x || .5, .05, .95), y: clamp(it.y == null ? (it.k === "man" ? .92 : .5) : +it.y, .05, .98), s: clamp(+it.s || 1, .4, 2.4), f: +it.f === -1 ? -1 : 1, acc: !!it.acc, t: it.k === "text" ? String(it.t || "").slice(0, 18) : undefined, at: okI(it.at) ? it.at : undefined,
        moves: (it.moves || []).filter((m) => m && okI(m.i) && MOVES.includes(m.m)).slice(0, 6).map((m) => ({ i: m.i, m: m.m, x: m.x != null ? clamp(+m.x, .05, .95) : undefined, y: m.y != null ? clamp(+m.y, .05, .95) : undefined })) })) })); }

  /* ---------- програвач ---------- */
  let PL = null;
  function stopPlay() { if (!PL) return; cancelAnimationFrame(PL.raf); try { PL.src.stop(); } catch (e) {} const o = PL.onend; PL = null; o?.(); }
  async function playFrom(t0, cv, opts = {}) {
    stopPlay(); const ac = AC(); try { await ac.resume(); } catch (e) {}
    const x = cv.getContext("2d"), b = ac.createBuffer(1, L.aud.length, E().SR); b.copyToChannel(L.aud, 0); const src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination);
    const st = ac.currentTime + .06; src.start(st, t0); PL = { src, raf: 0, onend: opts.onend };
    const loop = () => { if (!PL) return; const t = t0 + ac.currentTime - st; if (t >= TOT) { drawFrame(x, TOT - .01, cv.width, cv.height); stopPlay(); opts.done?.(); return; }
      drawFrame(x, Math.max(0, t), cv.width, cv.height); opts.tick?.(t); PL.raf = requestAnimationFrame(loop); };
    PL.raf = requestAnimationFrame(loop);
  }

  /* ---------- збереження: покадрово, рівно 30 кадрів/с ---------- */
  async function exportVideo(onProg) {
    try { await document.fonts?.ready; } catch (e) {}
    const cv = document.createElement("canvas"); cv.width = OW; cv.height = OH; const x = cv.getContext("2d", { alpha: false });
    try {
      const M = await import("https://cdn.jsdelivr.net/npm/mediabunny@1.45.0/+esm");
      if (!window.VideoEncoder) throw new Error("noenc");
      const can = (c) => M.canEncodeVideo(c, { width: OW, height: OH, bitrate: 8e6 }).catch(() => false);
      const vc = (await can("avc")) ? "avc" : (await can("vp9")) ? "vp9" : null; if (!vc) throw new Error("noenc");
      const aac = vc === "avc" && await M.canEncodeAudio("aac").catch(() => false), webm = vc !== "avc";
      const out = new M.Output({ format: webm ? new M.WebMOutputFormat() : aac ? new M.Mp4OutputFormat({ fastStart: "in-memory" }) : new M.MovOutputFormat({ fastStart: "in-memory" }), target: new M.BufferTarget() });
      const vs = new M.CanvasSource(cv, { codec: vc, bitrate: 8e6, keyFrameInterval: 2 }), as = new M.AudioBufferSource(webm ? { codec: "opus", bitrate: 160e3 } : aac ? { codec: "aac", bitrate: 192e3 } : { codec: "pcm-s16" });
      out.addVideoTrack(vs, { frameRate: FPS }); out.addAudioTrack(as); await out.start();
      const SR = E().SR, A = L.aud; let aPos = 0;
      const push = async (upto) => { upto = Math.min(A.length, Math.round(upto)); if (upto <= aPos) return; const ab = new AudioBuffer({ length: upto - aPos, numberOfChannels: 2, sampleRate: SR }), part = A.subarray(aPos, upto); ab.copyToChannel(part, 0); ab.copyToChannel(part, 1); aPos = upto; await as.add(ab); };
      const N = Math.max(1, Math.round(TOT * FPS));
      for (let i = 0; i < N; i++) { if (i % FPS === 0) await push((i / FPS + 1) * SR); drawFrame(x, Math.min(i / FPS, TOT - .001), OW, OH); await vs.add(i / FPS, 1 / FPS); onProg?.((i + 1) / N * .98); }
      await push(A.length); vs.close(); as.close(); await out.finalize(); onProg?.(1);
      const [type, ext] = webm ? ["video/webm", "webm"] : aac ? ["video/mp4", "mp4"] : ["video/quicktime", "mov"];
      return { blob: new Blob([out.target.buffer], { type }), ext };
    } catch (e) {
      console.warn("lines export → realtime", e); track("exp_fallback", { v: String(e?.message || e).slice(0, 30) });
      const ac = AC(), dest = ac.createMediaStreamDestination(), stream = cv.captureStream(FPS); dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      const mime = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)); if (!mime) throw new Error("no recorder");
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10e6 }), ch = []; rec.ondataavailable = (ev) => ev.data.size && ch.push(ev.data); const stopped = new Promise((r) => rec.onstop = r);
      const b = ac.createBuffer(1, L.aud.length, E().SR); b.copyToChannel(L.aud, 0); const src = ac.createBufferSource(); src.buffer = b; src.connect(dest);
      rec.start(500); const st = ac.currentTime + .1; src.start(st);
      await new Promise((res) => { const loop = () => { const t = ac.currentTime - st; if (t >= TOT) return res(); drawFrame(x, Math.max(0, t), OW, OH); onProg?.(t / TOT); requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
      await new Promise((r) => setTimeout(r, 250)); rec.stop(); await stopped;
      return { blob: new Blob(ch, { type: mime.split(";")[0] }), ext: mime.includes("mp4") ? "mp4" : "webm" };
    }
  }

  /* ---------- інтерфейс ---------- */
  const IC = {
    play: `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" width="20" height="20"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    pen: `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 20l4-1 11-11-3-3L5 16z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
    undo: `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  };
  const CSS = `
#yvln{position:fixed;inset:0;z-index:9000;background:#0b0b0d;color:#f5f5f7;display:flex;flex-direction:column;font:15px/1.45 var(--pfont,system-ui,-apple-system,sans-serif);padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
#yvln *{box-sizing:border-box}
#yvln .lh{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 4px}#yvln .lh b{font-size:17px}
#yvln .lx{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font-size:20px;cursor:pointer;display:grid;place-items:center}#yvln .lx[hidden]{display:none}
#yvln .ldev{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#ff9f0a;color:#0b0b0d;font-size:10.5px;font-weight:800;vertical-align:2px}
#yvln .lb{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;padding:4px 0 6px;position:relative}
#yvln .lf{padding:8px 14px 12px;display:grid;gap:8px;border-top:1px solid rgba(255,255,255,.08)}
#yvln .btn{width:100%;padding:13px;border-radius:15px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#f5f5f7;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer;display:flex;gap:7px;align-items:center;justify-content:center}
#yvln .btn.main{background:#f5f5f7;color:#0b0b0d;border-color:transparent}#yvln .btn:disabled{opacity:.4}#yvln .btn.rec{background:#ff453a;border-color:transparent}
#yvln .rowf{display:flex;gap:8px}#yvln .rowf .btn:first-child{flex:1}#yvln .btn.sq{width:52px;flex:none;padding:0}
#yvln .chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:center}#yvln .chip{padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e4e4e7;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer}#yvln .chip[aria-pressed=true]{background:#f5f5f7;color:#0b0b0d}
#yvln .stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 6px}
#yvln .cvw{position:relative;flex:none;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 10px 30px rgba(0,0,0,.5)}#yvln .cvw canvas{display:block;width:100%;height:100%}
#yvln .pb{position:absolute;inset:0;display:grid;place-items:center;background:none;border:0;color:#fff;cursor:pointer}#yvln .pb i{width:56px;height:56px;border-radius:50%;background:rgba(0,0,0,.45);display:grid;place-items:center;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
#yvln .bar{display:flex;flex-direction:column;gap:8px;flex:none}#yvln .bar .yvtool{width:58px;font-size:11px;padding:8px 2px 6px}
#yvln .seek{display:flex;align-items:center;gap:10px;padding:6px 16px 0;flex:none}#yvln .seek input{flex:1;accent-color:#f5f5f7}#yvln .seek span{color:#a1a1aa;font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
#yvln .msg{flex:none;margin:6px 14px 0;padding:8px 12px;border-radius:14px;background:rgba(255,214,10,.1);border:1px solid rgba(255,214,10,.3);color:#ffe27a;font-size:13px;text-align:center}#yvln .lb.shon .msg{display:none}
#yvln .hint{text-align:center;color:#a1a1aa;font-size:13px;margin:6px 16px 0}
#yvln textarea{width:100%;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font:15px inherit;font-family:inherit;resize:none}
#yvln .scn{display:grid;gap:6px}#yvln .scn button{display:flex;gap:10px;align-items:center;text-align:left;padding:9px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:inherit;font-family:inherit;font-size:14px;cursor:pointer}#yvln .scn b{flex:none;color:#a1a1aa;font-size:12px;min-width:38px}
${""}`;
  const UI = { root: null };
  const tool = (k, ic, t) => `<button class="yvtool" type="button" data-sh="${k}">${ic}${t}</button>`;
  function shell(title) {
    if (!document.getElementById("yvlncss")) { const st = document.createElement("style"); st.id = "yvlncss"; st.textContent = CSS + E().SHEET_CSS.replace(/^\./gm, "#yvln ."); document.head.appendChild(st); }
    UI.root?.remove(); const d = document.createElement("div"); d.id = "yvln";
    d.innerHTML = `<div class="lh"><b>${title}<span class="ldev">ТЕСТ</span></b><span style="display:flex;gap:8px"><button class="lx" type="button" id="lundo" aria-label="Скасувати" hidden>${IC.undo}</button><button class="lx" type="button" id="lclose" aria-label="Закрити">×</button></span></div><div class="lb"></div><div class="lf"></div>`;
    document.body.appendChild(d); UI.root = d; $(d, "#lclose").onclick = close;
    $(d, "#lundo").onclick = () => { const h = L?.hist?.pop(); if (!h) return; const o = JSON.parse(h); L.scenes = o.scenes; L.style = o.style; L.subs = o.subs; prep(); screenEdit("Скасовано"); };
    return d;
  }
  function close() { stopPlay(); cancelAnimationFrame(DEMO); UI.root?.remove(); UI.root = null; }
  const pushHist = () => { L.hist.push(JSON.stringify({ scenes: L.scenes, style: L.style, subs: L.subs })); if (L.hist.length > 20) L.hist.shift(); };
  const fitCanvas = (stage, cw, extra = 0) => { const f = () => { const h = stage.clientHeight - 8, w = Math.max(90, Math.min(h * 9 / 16, stage.clientWidth - extra - 12)); cw.style.width = w + "px"; cw.style.height = w * 16 / 9 + "px"; }; f(); requestAnimationFrame(f); new ResizeObserver(f).observe(stage); };

  // приклад на старті — показує стиль, поки людина не записала голос
  let DEMO = 0;
  function demo(cv, style) {
    cancelAnimationFrame(DEMO); const keep = L;
    const words = "Більшість чекає тисячі підписників щоб почати заробляти а гроші приходять з одного вдалого відео".split(" ").map((w, i) => ({ w, s: .3 + i * .42, e: .3 + i * .42 + .38 }));
    const DL = { aud: new Float32Array(Math.round(8 * E().SR)), words, style, subs: true,
      scenes: [{ a: 0, title: "Чекати — дивно", caption: "очікування", items: [{ k: "man", x: .3, y: .92, moves: [{ i: 1, m: "think" }, { i: 6, m: "walk_to", x: .62 }] }, { k: "clock", x: .78, y: .45, at: 2, moves: [{ i: 2, m: "pop" }] }, { k: "question", x: .2, y: .35, at: 3, moves: [{ i: 3, m: "bounce" }] }] },
        { a: 9, title: "Одне відео", caption: "результат", items: [{ k: "man", x: .35, y: .92, moves: [{ i: 11, m: "jump" }, { i: 13, m: "cheer" }] }, { k: "money", x: .72, y: .35, at: 11, acc: true, moves: [{ i: 11, m: "pop" }, { i: 12, m: "fly_to", x: .5, y: .25 }] }, { k: "text", t: "+1 відео", x: .5, y: .1, at: 14, moves: [{ i: 14, m: "pop" }] }] }], hist: [] };
    const x = cv.getContext("2d"), t0 = performance.now();
    const loop = () => { if (!cv.isConnected) return; L = DL; prep(); const t = ((performance.now() - t0) / 1000) % 7.5; drawFrame(x, t, cv.width, cv.height); L = keep; DEMO = requestAnimationFrame(loop); };
    loop();
  }
  let STYLE = "neon";
  function screenStart() {
    L = null; const d = shell("Анімація лініями"), B = $(d, ".lb"), F = $(d, ".lf");
    B.innerHTML = `<div class="stage"><div class="cvw"><canvas id="lcv" width="540" height="960"></canvas></div></div><p class="hint">Наговори думку — сцени, рухи й написи складуться самі</p>`;
    F.innerHTML = `<div class="chips">${Object.entries(STYLES).map(([k, v]) => `<button class="chip" type="button" data-st="${k}" aria-pressed="${STYLE === k}">${v.n}</button>`).join("")}</div>
      <button class="btn main" type="button" id="lrec">${IC.mic} Наговорити</button><label class="btn" for="lfile">Завантажити запис</label><input type="file" id="lfile" accept="audio/*,video/*" hidden>`;
    const cv = $(B, "#lcv"); fitCanvas($(B, ".stage"), $(B, ".cvw")); demo(cv, STYLE);
    F.querySelectorAll("[data-st]").forEach((b) => b.onclick = () => { STYLE = b.dataset.st; F.querySelectorAll("[data-st]").forEach((o) => o.setAttribute("aria-pressed", o === b)); demo(cv, STYLE); });
    // запис через «Озвучку»: там чистка, вирізання паразитів, правки голосом — сюди повертається готовий голос
    $(F, "#lrec").onclick = () => { cancelAnimationFrame(DEMO); UI.root.style.display = "none";
      window.YVTalk.open({ target: 0, onDone: async ({ wav }) => { UI.root.style.display = ""; await start(wav); } });
      const iv = setInterval(() => { if (!document.getElementById("yvtalk")) { clearInterval(iv); if (UI.root && UI.root.style.display === "none") { UI.root.style.display = ""; if (!L) demo(cv, STYLE); } } }, 600); };
    $(F, "#lfile").onchange = async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; cancelAnimationFrame(DEMO); await start(await f.arrayBuffer(), true); };
    track("open_start");
  }
  async function start(buf, raw) {
    try {
      const go = async () => { let y = await E().decode(buf); if (raw) y = await E().processTake(y); if (y.length / E().SR > 185) y = y.subarray(0, Math.round(185 * E().SR)).slice();
        const small = await E().resample(y, E().SR, 16000), r = await SRV.stt({ audio: E().b64(E().wav(small, 16000)), mime: "audio/wav", quiet: true });
        const dur = y.length / E().SR, words = (r.words || []).map((w) => ({ w: String(w.w), s: Math.max(0, +w.s || 0), e: Math.min(dur, Math.max((+w.s || 0) + .05, +w.e || 0)) })).filter((w) => w.w.trim());
        if (words.length < 3) throw new Error("nowords");
        L = { aud: y, words, style: STYLE, subs: true, scenes: [], hist: [] }; L.scenes = await aiScenes(); };
      await E().busyRun("montage", go);
      prep(); track("ready", { v: `${L.scenes.length}sc/${Math.round(TOT)}s` }); screenEdit("Тапни ▶, щоб подивитись. Правки — голосом або кнопкою ✎");
    } catch (e) { console.error(e); say(e?.message === "nowords" ? "Не почув слів — спробуй ще раз" : e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло зібрати анімацію. Спробуй ще раз"); if (!L?.scenes?.length) screenStart(); }
  }
  let POS = 0;
  function screenEdit(msg) {
    const d = UI.root?.querySelector(".lb .bar") ? UI.root : shell("Анімація лініями"), B = $(d, ".lb"), F = $(d, ".lf");
    stopPlay(); POS = Math.min(POS, Math.max(0, TOT - .05)); $(d, "#lundo").hidden = !L.hist.length; B.className = "lb";
    B.innerHTML = `<div class="stage"><div class="bar">${tool("style", '<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7v12M15 12h5M17.5 12v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', "Стиль")}${tool("scn", '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M9 4.5v15" stroke="currentColor" stroke-width="2"/></svg>', "Сцени")}</div>
      <div class="cvw"><canvas id="lcv" width="540" height="960"></canvas><button class="pb" type="button" id="lpb"><i>${IC.play}</i></button></div>
      <div class="bar">${tool("neu", '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>', "Нове")}</div></div>
      <div class="seek"><input type="range" id="lseek" min="0" max="1000" value="${Math.round(POS / Math.max(.1, TOT) * 1000)}"><span id="ltm">${fmt(POS)} / ${fmt(TOT)}</span></div>${msg ? `<div class="msg">${escH(msg)}</div>` : ""}`;
    F.innerHTML = `<div class="rowf"><button class="btn" type="button" id="lvoice">${IC.mic} Скажи, що змінити</button><button class="btn sq" type="button" id="lwrite" aria-label="Написати">${IC.pen}</button></div><button class="btn main" type="button" id="lsave">Зберегти відео</button>`;
    const cv = $(B, "#lcv"), pb = $(B, "#lpb"), seek = $(B, "#lseek"), tm = $(B, "#ltm"), stage = $(B, ".stage");
    fitCanvas(stage, $(B, ".cvw"), 140);
    const still = () => drawFrame(cv.getContext("2d"), POS || Math.min(1.6, Math.max(0, TOT - .05)), cv.width, cv.height); still();
    const show = (t) => { POS = t; seek.value = Math.round(t / TOT * 1000); tm.textContent = `${fmt(t)} / ${fmt(TOT)}`; };
    const setPlay = (on) => { pb.innerHTML = on ? "" : `<i>${IC.play}</i>`; };
    pb.onclick = () => { if (PL) { stopPlay(); return; } setPlay(true); playFrom(POS >= TOT - .1 ? 0 : POS, cv, { tick: show, onend: () => setPlay(false), done: () => { POS = 0; } }); };
    seek.oninput = () => { stopPlay(); show(seek.value / 1000 * TOT); still(); };
    const refresh = (m) => { prep(); screenEdit(m); };
    B.querySelectorAll("[data-sh]").forEach((b) => b.onclick = () => { const was = b.classList.contains("on"); B.querySelectorAll(".yvsh").forEach((x) => x._close(true)); B.querySelectorAll("[data-sh]").forEach((o) => o.classList.remove("on")); if (was) return; b.classList.add("on");
      const k = b.dataset.sh;
      if (k === "style") { const S = E().sheet(B, "Стиль", `<div class="chips">${Object.entries(STYLES).map(([s, v]) => `<button class="chip" type="button" data-st="${s}" aria-pressed="${L.style === s}">${v.n}</button>`).join("")}<button class="chip" type="button" id="lsubs" aria-pressed="${L.subs !== false}">Субтитри</button></div>`);
        S.body.querySelectorAll("[data-st]").forEach((x) => x.onclick = () => { pushHist(); L.style = STYLE = x.dataset.st; S.body.querySelectorAll("[data-st]").forEach((o) => o.setAttribute("aria-pressed", o === x)); still(); $(d, "#lundo").hidden = false; });
        $(S.body, "#lsubs").onclick = (e) => { pushHist(); L.subs = L.subs === false; e.currentTarget.setAttribute("aria-pressed", L.subs !== false); still(); }; }
      if (k === "scn") { const S = E().sheet(B, "Сцени", `<div class="scn">${ST.map((q, i) => `<button type="button" data-q="${i}"><b>${fmt(q.t0)}</b>${escH(q.s.title || "Сцена " + (i + 1))}</button>`).join("")}</div><button class="btn" type="button" id="lregen" style="margin-top:10px">↻ Інші сцени для всього відео</button>`);
        S.body.querySelectorAll("[data-q]").forEach((x) => x.onclick = () => { stopPlay(); show(ST[+x.dataset.q].t0 + .9); still(); });
        $(S.body, "#lregen").onclick = async () => { S.close(true); try { pushHist(); L.scenes = await E().busyRun("montage", () => aiScenes("Зроби зовсім інші сцени, ніж були: інші предмети, рухи й жарти.")); track("regen"); refresh("Нові сцени готові"); } catch (e) { say("Не вийшло. Спробуй ще раз"); } }; }
      if (k === "neu") { const S = E().sheet(B, "Почати нову анімацію?", `<p style="margin:0 0 10px;color:#a1a1aa;font-size:13.5px">Поточна не збережеться.</p><button class="btn" type="button" id="lnew">Так, нова</button>`); $(S.body, "#lnew").onclick = () => { stopPlay(); screenStart(); }; } });
    const cmd = async (t, voice) => { try { pushHist(); const m = await E().busyRun("montage", () => aiEdit(t)); track(voice ? "cmd_voice" : "cmd_text"); refresh(voice ? `«${t}» → ${m}` : m); } catch (e) { L.hist.pop(); say("Не вийшло застосувати правку"); } };
    $(F, "#lwrite").onclick = () => { B.querySelectorAll(".yvsh").forEach((x) => x._close(true)); const S = E().sheet(B, "Що змінити?", `<textarea id="lcmd" rows="3" placeholder="Напр.: у другій сцені нехай чоловічок біжить, додай гроші справа"></textarea><button class="btn main" type="button" id="lgo2" style="margin-top:8px">Застосувати</button>`);
      const ta = $(S.body, "#lcmd"); setTimeout(() => ta.focus(), 50); $(S.body, "#lgo2").onclick = () => { const v = ta.value.trim(); if (!v) return; S.close(true); cmd(v, false); }; };
    const vv = $(F, "#lvoice"), vl = vv.innerHTML;
    vv.onclick = () => { stopPlay(); if (!vv._rec) say("Кажи: «у першій сцені нехай стрибає», «стиль маркер»"); E().record(vv, vl, async (buf) => {
      try { const raw = await E().decode(buf), small = await E().resample(raw, E().SR, 16000), r = await E().busyRun("listen", () => SRV.stt({ audio: E().b64(E().wav(small, 16000)), mime: "audio/wav" }));
        const t = (r.words || []).map((w) => w.w).join(" "); if (!t.trim()) { say("Не почув"); return; } cmd(t, true); } catch (e) { say("Не вийшло розпізнати"); } }); };
    $(F, "#lsave").onclick = async () => { stopPlay(); const sv = $(F, "#lsave"); sv.disabled = true; sv.innerHTML = `Зберігаю… <b id="lpp">0%</b>`;
      try { const out = await exportVideo((p) => { const e = $(F, "#lpp"); if (e) e.textContent = Math.round(clamp(p) * 100) + "%"; }); track("save", { v: L.style + "|" + out.ext });
        E().offerSave(F, [new File([out.blob], `yuvi_linii_${new Date().toISOString().slice(0, 10)}.${out.ext}`, { type: out.blob.type })], () => screenEdit(), () => track("saved")); still(); return;
      } catch (e) { console.error(e); say("Не вдалося зберегти відео"); }
      sv.disabled = false; sv.textContent = "Зберегти відео"; still(); };
  }

  window.YVLines = { open() { screenStart(); track("open"); }, _t: { set: (l) => { L = l; prep(); }, drawFrame, prep, exportVideo, figure, POSE, SH, STYLES, tot: () => TOT, screenEdit, aiScenes, L: () => L } };
})();
