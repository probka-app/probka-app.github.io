/* YuVi · «Анімація лініями» (тест, лише власник).
   Людина наговорює голос (або завантажує запис) → розпізнаємо слова → AI складає сцени з «деталей»
   (чоловічок-паличка з рухами, предмети, написи) → сайт сам малює лінії: промальовування, «живі» лінії, рух на словах.
   Без генерації картинок і відео: усе — лінії в коді, тому майже безкоштовно і завжди чисто. */
(() => {
  "use strict";
  const E = () => window.YVTalk._t;
  const OW = 1080, OH = 1920, FPS = 30;
  const DIMS = () => L?.wide ? [1920, 1080] : [1080, 1920];
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
    money: () => [rect(-1, -.55, 2, 1.1), rect(-.88, -.43, 1.76, .86), arc(0, 0, .3), [...arc(.02, -.08, .1, 200, 390, 8), [-.08, .14], [.1, .14]], [[-.12, -.02], [.12, -.02]], [[-.7, -.25], [-.7, .25]], [[.7, -.25], [.7, .25]]],
    coin: () => [arc(0, 0, .8), arc(0, 0, .55, 0, 360, 22)],
    coins: () => [arc(-.35, .25, .5), arc(.4, .1, .5), arc(0, -.35, .5)],
    bag: () => [[[-.3, -.75], [-.55, -1], [.55, -1], [.3, -.75]], [[-.3, -.75], [-.85, -.1], [-.9, .45], [-.6, .85], [.6, .85], [.9, .45], [.85, -.1], [.3, -.75], [-.3, -.75]], arc(0, .15, .28)],
    phone: () => [[...arc(-.38, -.88, .12, 180, 270, 4), ...arc(.38, -.88, .12, 270, 360, 4), ...arc(.38, .88, .12, 0, 90, 4), ...arc(-.38, .88, .12, 90, 180, 4), [-.5, -.88]], rect(-.4, -.72, .8, 1.36), [[-.1, .82], [.1, .82]], rect(-.3, -.6, .6, .35), [[-.3, -.1], [.3, -.1]], [[-.3, .08], [.15, .08]], [[-.3, .26], [.25, .26]]],
    laptop: () => [rect(-.85, -.8, 1.7, 1.15), rect(-.72, -.68, 1.44, .9), [[-.5, -.4], [.3, -.4]], [[-.5, -.2], [.45, -.2]], [[-1.15, .45], [1.15, .45], [1, .62], [-1, .62], [-1.15, .45]], [[-.2, .53], [.2, .53]]],
    camera: () => [rect(-.9, -.5, 1.8, 1.2), arc(0, .1, .4), [[-.35, -.5], [-.2, -.75], [.2, -.75], [.35, -.5]]],
    arrow: () => [[[-1, 0], [1, 0]], [[.55, -.4], [1, 0], [.55, .4]]],
    up: () => [[[-1, .8], [-.35, .05], [.05, .4], [1, -.7]], [[.5, -.72], [1, -.7], [.97, -.2]]],
    down: () => [[[-1, -.8], [-.35, -.05], [.05, -.4], [1, .7]], [[.5, .72], [1, .7], [.97, .2]]],
    chart: () => [[[-1, -1], [-1, 1], [1, 1]], rect(-.75, .35, .35, .65), rect(-.25, -.05, .35, 1.05), rect(.25, -.6, .35, 1.6)],
    question: () => [[...arc(0, -.4, .42, 190, 380, 18), [.12, -.05], [0, .2], [0, .4]], arc(0, .8, .09, 0, 360, 10)],
    exclaim: () => [[[0, -1], [0, .45]], arc(0, .82, .09, 0, 360, 10)],
    heart: () => [[[0, .9], [-.85, 0], ...arc(-.45, -.35, .45, 140, 340, 10).slice(1), ...arc(.45, -.35, .45, 200, 400, 10).slice(1), [.85, 0], [0, .9]]],
    star: () => { const p = []; for (let i = 0; i <= 10; i++) { const a = (-90 + i * 36) * D, r = i % 2 ? .42 : 1; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return [p]; },
    house: () => [[[-.9, -.05], [0, -.9], [.9, -.05]], [[-.7, -.2], [-.7, .9], [.7, .9], [.7, -.2]], rect(-.2, .35, .4, .55), rect(-.55, .0, .25, .25), rect(.3, .0, .25, .25), [[-.425, 0], [-.425, .25]], [[.425, 0], [.425, .25]], [[.4, -.5], [.4, -.82], [.6, -.82], [.6, -.33]]],
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
    // вікно-вкладка браузера (значок — лінії / графік / плей / перемикач; або «?»/«!» у полі t)
    tab: (it) => { const b = [rect(-1, -.62, 2, 1.24), [[-1, -.3], [1, -.3]], arc(-.8, -.46, .05, 0, 360, 6)], v = it?.t ? -1 : (it?.v ?? (it?.seed || 0)) % 4;
      if (v === 0) b.push([[-.6, .02], [.6, .02]], [[-.6, .3], [.25, .3]]); else if (v === 1) b.push([[-.6, .38], [-.2, 0], [.1, .2], [.6, -.12]]); else if (v === 2) b.push([[-.2, -.12], [.28, .12], [-.2, .36], [-.2, -.12]]); else if (v === 3) b.push(arc(-.35, .12, .17, 0, 360, 12), [[-.05, .12], [.6, .12]]);
      return b; },
    wall: () => { const p = [rect(-.75, -1.6, 1.5, 3.2)]; for (let r = 1; r < 8; r++) p.push([[-.75, -1.6 + r * .4], [.75, -1.6 + r * .4]]); for (let r = 0; r < 8; r++) { const o = r % 2 ? 0 : -.375; for (let c = 0; c < 3; c++) { const xx = o + c * .75 - .375; if (xx > -.74 && xx < .74) p.push([[xx, -1.6 + r * .4], [xx, -1.2 + r * .4]]); } } return p; },
    card: () => [rect(-1.05, -.62, 2.1, 1.24), rect(-.85, .12, .25, .25), [[-.45, .25], [.8, .25]]],
    desk: () => [[[-1.3, -.35], [1.3, -.35]], [[-1.1, -.35], [-1.1, .9]], [[1.1, -.35], [1.1, .9]]],
    ball: () => [arc(0, 0, .32, 0, 360, 18)],
    spiral: () => { const p = []; for (let i = 0; i <= 50; i++) { const a = i / 50 * Math.PI * 6, r = .05 + i / 50 * .9; p.push([Math.cos(a) * r, Math.sin(a) * r]); } return [p]; },
    lamp: () => [],
    car: () => [[[-1.1, .3], [-1.1, -.05], [-.75, -.12], [-.45, -.5], [.4, -.5], [.7, -.12], [1.1, -.05], [1.1, .3], [-1.1, .3]], [[-.38, -.44], [-.38, -.12], [.05, -.12], [.05, -.44]], [[.12, -.44], [.12, -.12], [.6, -.12], [.38, -.44], [.12, -.44]], arc(-.6, .32, .2, 0, 360, 14), arc(.6, .32, .2, 0, 360, 14)],
    cup: () => [[[-.5, -.3], [-.42, .55], [.42, .55], [.5, -.3], [-.5, -.3]], arc(.62, .1, .2, 270, 450, 10), [[-.65, .6], [.65, .6]]],
    calendar: () => [rect(-.75, -.7, 1.5, 1.45), [[-.75, -.35], [.75, -.35]], [[-.4, -.85], [-.4, -.55]], [[.4, -.85], [.4, -.55]]],
    piggy: () => [arc(0, .05, .62, 0, 360, 24), arc(.68, .02, .14, 0, 360, 10), [[-.3, -.5], [-.18, -.78], [-.05, -.55]], [[-.35, .6], [-.35, .82]], [[.3, .6], [.3, .82]], [[-.12, -.62], [.12, -.62]], [[-.62, .0], [-.85, -.12], [-.8, -.3]]],
    trophy: () => [[[-.5, -.8], [.5, -.8], [.42, -.15], [.15, .1], [-.15, .1], [-.42, -.15], [-.5, -.8]], arc(-.55, -.55, .2, 90, 270, 8), arc(.55, -.55, .2, -90, 90, 8), [[0, .1], [0, .5]], rect(-.35, .5, .7, .25)],
    mail: () => [rect(-.95, -.6, 1.9, 1.2), [[-.95, -.6], [0, .1], [.95, -.6]]],
    mic: () => [rect(-.25, -.95, .5, .85), arc(0, -.35, .45, 0, 180, 12), [[0, .1], [0, .55]], [[-.3, .55], [.3, .55]]],
    plant: () => [[[-.4, .2], [-.3, .9], [.3, .9], [.4, .2], [-.4, .2]], [[0, .2], [0, -.6]], [[0, -.2], ...arc(-.3, -.35, .3, 0, 180, 8)], [[0, -.4], ...arc(.3, -.55, .3, 180, 360, 8)], arc(0, -.75, .2, 0, 360, 10)],
    chair: () => [[[-.4, -.9], [-.4, .9]], [[-.4, .1], [.45, .1], [.45, .9]], [[-.4, -.9], [-.2, -.9]]],
    door: () => [rect(-.5, -1.2, 1, 2.2), arc(.3, .05, .06, 0, 360, 8)],
    globe: () => [arc(0, 0, .85, 0, 360, 28), [[-.85, 0], [.85, 0]], arc(0, 0, .85, 0, 360, 28).map(([a, b]) => [a * .45, b]), [[-.75, -.4], [.75, -.4]], [[-.75, .4], [.75, .4]]],
    shopbag: () => [[[-.6, -.4], [-.7, .85], [.7, .85], [.6, -.4], [-.6, -.4]], arc(0, -.4, .3, 180, 360, 10)],
    raincloud: () => [[...arc(-.4, 0, .35, 90, 270, 10), ...arc(0, -.25, .42, 200, 340, 10), ...arc(.45, 0, .33, 260, 450, 10), [-.4, .35]], [[-.4, .5], [-.5, .8]], [[0, .5], [-.1, .8]], [[.4, .5], [.3, .8]]],
    pencil: () => [[[-.9, .3], [.6, -.6], [.85, -.35], [-.65, .55], [-.9, .3]], [[-.9, .3], [-1, .65], [-.65, .55]]],
    hryvnia: () => [[...arc(.05, -.45, .38, 200, 400, 12), [-.3, .55], [.4, .55]], [[-.45, -.12], [.45, -.12]], [[-.45, .15], [.45, .15]]],
  };
  const KINDS = Object.keys(SH);
  const CORE = new Set(["man", "text", "say", "thinkb", "count", "icon"]);
  function fixK(it) { if (!it || typeof it.k !== "string") return null; const k = it.k.toLowerCase().trim();
    if (CAST[k] && k !== "man") return { ...it, k: "man", who: k }; if (CORE.has(k) || SH[k] || ANIM[k]) return { ...it, k };
    if (/^[a-z][a-z0-9 _-]{1,30}$/.test(k)) return { ...it, k: "icon", q: it.q || k }; return null; }
  const KOK = (it) => it && (CORE.has(it.k) || SH[it.k] || ANIM[it.k]);
  const WHO = (it) => ({ who: CAST[it.who] ? it.who : undefined, q: it.k === "icon" ? String(it.q || "").slice(0, 40) : undefined });

  /* ---------- чоловічок: скелет і рухи ---------- */
  // пози в градусах: b — нахил тулуба, h — нахил голови; руки/ноги: 1 — від плеча/стегна (від вертикалі вниз), 2 — згин ліктя/коліна; y — присід; r — поворот усього тіла
  // sv: 1 — вигляд збоку («+» — уперед), інакше спереду («+» — назовні, в свій бік)
  const P0 = { b: 0, h: 0, la1: 14, la2: 6, ra1: 14, ra2: 6, ll1: 7, ll2: 0, rl1: 7, rl2: 0, y: 0, r: 0, sv: 0 };
  const POSE = {
    stand: () => ({}),
    talk: (t) => ({ ra1: 30 + 12 * Math.sin(t * 2.6), ra2: 55 + 15 * Math.sin(t * 3.1), h: 4 * Math.sin(t * 2.1) }),
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
  POSE.push = (t) => ({ sv: 1, b: 26, la1: 82 + 3 * Math.sin(t * 9), ra1: 92 - 3 * Math.sin(t * 9), la2: 12, ra2: 12, ll1: 22, ll2: 35, rl1: -34, rl2: 0, y: .12, h: -6 });
  POSE.work = (t) => ({ sv: 1, y: .8, ll1: 88, rl1: 82, ll2: 88, rl2: 88, b: 14, h: 14, la1: 62 + 5 * Math.sin(t * 13), ra1: 70 - 5 * Math.sin(t * 13), la2: 35, ra2: 30 });
  POSE.shock = (t) => ({ la1: 62, ra1: 62, la2: 70, ra2: 70, y: -.06 + .03 * Math.sin(t * 30) * clamp(1 - t), h: -4 });
  const FACE = { sad: "sad", cheer: "happy", dance: "happy", jump: "happy", fall: "shock", shock: "shock", push: "strain", work: "strain", hang: "neutral", think: "neutral", wave: "happy" };
  const LASTING = new Set(["talk", "think", "point", "sad", "sit", "fall", "hang", "push", "work", "shock"]);
  const DUR = { jump: .95, wave: 1.6, cheer: 1.6, shrug: 1.2, dance: 2.4 };
  const MOVES = ["talk", "walk_to", "run_to", "jump", "wave", "cheer", "think", "point", "shrug", "sad", "sit", "stand", "fall", "hang", "dance", "push", "work", "shock", "happy_face", "sad_face", "pop", "bounce", "spin", "shake", "fly_to", "grow", "hide"];
  const mixPose = (a, b, w) => { const o = {}; for (const k in P0) o[k] = (a[k] ?? P0[k]) * (1 - w) + (b[k] ?? P0[k]) * w; o.sv = w < .5 ? (a.sv || 0) : (b.sv || 0); return o; };

  /* ---------- стан ---------- */
  let L = null; // проєкт: { aud, words, scenes, style, subs, hist }
  let TOT = 0, ST = [], CH = [];
  // теми фону: лінії й рухи ті самі, змінюється все навколо
  const THEMES = {
    neon: { n: "Неон", body: "#4f66d1", bg: "#06070b", ink: "#f2f4ff", acc: "#ffd60a", glow: "rgba(190,210,255,.95)", grid: "lines", gc: "rgba(160,180,255,.06)", vig: 1 },
    blueprint: { n: "Креслення", body: "#6aa6e8", bg: "#0e3a6c", ink: "#eaf3ff", acc: "#ffd60a", glow: "rgba(200,230,255,.45)", grid: "lines", gc: "rgba(255,255,255,.1)", vig: 1 },
    night: { n: "Нічний неон", body: "#b23aa6", bg: "#0b0613", ink: "#ffffff", acc: "#2ef2ff", glow: "rgba(255,70,200,.95)", grid: "dots", gc: "rgba(255,120,220,.16)", vig: 1 },
    gold: { n: "Золото", body: "#b08a3a", bg: "#0c0b09", ink: "#f3d27a", acc: "#ffffff", glow: "rgba(243,200,110,.7)", vig: 1 },
    chalk: { n: "Крейда", body: "#7fae95", bg: "#203b2f", ink: "#f3f1e7", acc: "#ffe27a", tex: "chalk", vig: 1 },
    marker: { n: "Маркер", body: "#ffd8a8", bg: "#fbfaf6", ink: "#151515", acc: "#d0312d" },
    notebook: { n: "Зошит", body: "#cfe3ff", bg: "#fdfdfb", ink: "#1b2a59", acc: "#d0312d", grid: "notebook", gc: "rgba(60,120,200,.2)" },
    cream: { n: "Крем", body: "#f6c79a", bg: "#f4ead7", ink: "#2a2118", acc: "#c2410c", tex: "noise" },
    kraft: { n: "Крафт", body: "#e8cfa6", bg: "#c9a57a", ink: "#2b1d10", acc: "#fff8e7", tex: "noise" },
    mint: { n: "М'ята", body: "#a8e6c4", bg: "#e4f5ec", ink: "#10352a", acc: "#e8590c" },
    navy: { n: "Синя ніч", body: "#5d77c9", bg: "#16213e", ink: "#ffffff", acc: "#ffd60a", glow: "rgba(170,190,255,.5)", vig: 1 },
    plum: { n: "Слива", body: "#a159c4", bg: "#2a1335", ink: "#ffffff", acc: "#ffd60a", glow: "rgba(220,170,255,.5)", vig: 1 },
    comic: { n: "Комікс", body: "#ffffff", bg: "#ffd60a", ink: "#111111", acc: "#e5383b", grid: "dots", gc: "rgba(0,0,0,.09)" },
    terminal: { n: "Хакер", body: "#21803f", bg: "#020a04", ink: "#8dffab", acc: "#ffffff", glow: "rgba(80,255,140,.8)", grid: "lines", gc: "rgba(80,255,140,.07)", vig: 1 },
    sunset: { n: "Захід сонця", body: "#ffc49a", bg: "#b5566f", grad: ["#ff8a5c", "#5b2a86"], ink: "#ffffff", acc: "#ffe66d", glow: "rgba(255,225,205,.55)", vig: 1 },
    pastel: { n: "Пастель", body: "#ffffff", bg: "#ffe4ec", ink: "#3b1f2b", acc: "#ff4d8d" },
    ice: { n: "Лід", body: "#bcdcff", bg: "#e8f4ff", ink: "#0d2b4a", acc: "#3a86ff", grid: "dots", gc: "rgba(13,43,74,.12)" },
    sepia: { n: "Старий папір", body: "#e2c79a", bg: "#efe2c4", ink: "#3d2b1f", acc: "#9c2a1a", tex: "noise" },
    red: { n: "Червоний", body: "#ff8a8a", bg: "#c1121f", ink: "#ffffff", acc: "#ffd60a", vig: 1 },
  };
  // готові стилі: фон + шрифт + заголовок + товщина ліній (людина обирає один — і все разом змінюється)
  const PRESETS = [
    { id: "neon", n: "Неон", th: "neon", font: "Manrope", frame: "box", pq: "neon", sb: "classic", pal: ["#ffd60a", "#2ef2ff", "#ff4d8d"] },
    { id: "marker", n: "Маркер", th: "marker", font: "Manrope", frame: "box", pq: "marker", sb: "classic", pal: ["#e5383b", "#2fb36d", "#3a86ff"] },
    { id: "comic", n: "Комікс", th: "comic", font: "Unbounded", frame: "pill", lw: 1.35, pq: "punch", sb: "box", pal: ["#e5383b", "#3a86ff", "#111111"] },
    { id: "youtube", n: "Як у YouTube", th: "marker", font: "Unbounded", frame: "pill", pq: "punch", sb: "yellow", pal: ["#ffd60a", "#2fb36d", "#e5383b"] },
    { id: "club", n: "Нічний клуб", th: "night", font: "Unbounded", frame: "pill", pq: "neon", sb: "classic", pal: ["#ff4d8d", "#2ef2ff", "#ffd60a"] },
    { id: "blueprint", n: "Креслення", th: "blueprint", font: "Manrope", frame: "under", pq: "pill", sb: "minimal", pal: ["#ffd60a", "#2fb36d", "#e5383b"] },
    { id: "chalk", n: "Шкільна дошка", th: "chalk", font: "Neucha", frame: "under", lw: 1.2, pq: "sticker", sb: "hand", pal: ["#ffe27a", "#9be7a5", "#ff9e9e"] },
    { id: "notebook", n: "Зошит", th: "notebook", font: "Caveat", frame: "under", pq: "sticker", sb: "hand", pal: ["#ffe27a", "#9be7a5", "#ff9e9e"] },
    { id: "sunset", n: "Захід сонця", th: "sunset", font: "Unbounded", frame: "under", pq: "punch", sb: "yellow", pal: ["#ffe66d", "#5b2a86", "#ff3d68"] },
    { id: "gold", n: "Золото", th: "gold", font: "Unbounded", frame: "box", pq: "neon", sb: "classic", pal: ["#f3d27a", "#ffffff", "#e8a33d"] },
    { id: "terminal", n: "Хакер", th: "terminal", font: "JetBrains Mono", frame: "box", pq: "neon", sb: "minimal", pal: ["#39ff14", "#2ef2ff", "#ff3b3b"] },
    { id: "cream", n: "Затишок", th: "cream", font: "Comfortaa", frame: "pill", pq: "marker", sb: "classic", pal: ["#c2410c", "#2f7d4f", "#9c2a1a"] },
    { id: "pastel", n: "Пастель", th: "pastel", font: "Comfortaa", frame: "pill", pq: "pill", sb: "classic", pal: ["#ff4d8d", "#8e5cf7", "#3a86ff"] },
    { id: "kraft", n: "Крафт", th: "kraft", font: "Kurale", frame: "box", lw: 1.25, pq: "sticker", sb: "hand", pal: ["#fff3a3", "#c8f7c5", "#ffd2cf"] },
    { id: "sepia", n: "Старий папір", th: "sepia", font: "Bad Script", frame: "under", pq: "marker", sb: "hand", pal: ["#9c2a1a", "#3d5a2a", "#3d2b1f"] },
    { id: "mint", n: "М'ята", th: "mint", font: "Rubik", frame: "pill", pq: "marker", sb: "classic", pal: ["#e8590c", "#10352a", "#3a86ff"] },
    { id: "ice", n: "Лід", th: "ice", font: "Manrope", frame: "under", pq: "pill", sb: "minimal", pal: ["#3a86ff", "#2fb36d", "#e5383b"] },
    { id: "navy", n: "Синя ніч", th: "navy", font: "Unbounded", frame: "box", pq: "punch", sb: "yellow", pal: ["#ffd60a", "#2fb36d", "#e5383b"] },
    { id: "plum", n: "Слива", th: "plum", font: "Comfortaa", frame: "pill", pq: "marker", sb: "classic", pal: ["#ffd60a", "#2ef2ff", "#ff4d8d"] },
    { id: "red", n: "Червоний", th: "red", font: "Unbounded", frame: "pill", lw: 1.2, pq: "punch", sb: "yellow", pal: ["#111111", "#ffd60a", "#ffffff"] },
    { id: "thin", n: "Мінімал", th: "marker", font: "Manrope", frame: "none", lw: .75, boil: false, pq: "pill", sb: "minimal", pal: ["#111111", "#2fb36d", "#e5383b"] },
  ];
  const SUBS_OPTS = [["classic", "Класика"], ["yellow", "Жовте слово"], ["box", "На плашці"], ["minimal", "Мінімал"], ["hand", "Від руки"], ["off", "Без субтитрів"]];
  // кольори плашок: AI каже «yellow — головне, green — плюс, red — мінус», шаблон підставляє свої відтінки
  const PNAMES = ["yellow", "green", "red", "blue", "purple", "orange", "pink", "gray"];
  const colOf = (col, lk) => /^#/.test(col || "") ? col : lk?.pal?.length ? lk.pal[Math.max(0, PNAMES.indexOf(col)) % lk.pal.length] : (PLC[col] || PLC.red);
  const rgbOf = (h) => { const v = parseInt(String(h).slice(1, 7), 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
  const lumOf = (h) => { const [r, g, b] = rgbOf(h); return (r * .299 + g * .587 + b * .114) / 255; };
  const mixW = (h, f) => { const [r, g, b] = rgbOf(h); return `rgb(${Math.round(r + (255 - r) * f)},${Math.round(g + (255 - g) * f)},${Math.round(b + (255 - b) * f)})`; };
  const VOICE_OPTS = [["none", "Без озвучки", "Лише анімація, написи й субтитри — без голосу"], ["ai", "AI-голос", "Пишеш текст — його озвучує голос студії"], ["clone", "Мій AI-голос", "Текст звучить твоїм голосом (потрібен зразок 1 хв)"], ["rec", "Свій голос", "Записуєш або завантажуєш — як є, без обробки"], ["recplus", "Свій голос + покращення", "Чистий звук, вирізані паузи й «е-е»", "найкраще"]];
  const BODIES = [["line", "Лінії", "Класичний чоловічок-паличка"], ["outline", "Контур", "Тіло обведене, всередині — фон"], ["volume", "Об'ємне", "Тіло з кольором і світлом"]];
  const THICK = [[.75, "Тонкі"], [1, "Звичайні"], [1.35, "Товсті"]];
  const OPT0 = { preset: "neon", body: "outline", lw: 1, voice: "none", subs: true, pops: true, ins: false };
  let OPT = (() => { try { const o = { ...OPT0, ...JSON.parse(localStorage.getItem("yv_ln_opt") || "{}") }; if (typeof o.subs === "string") o.subs = o.subs !== "off"; if (typeof o.pops === "string") o.pops = o.pops !== "off"; return o; } catch (e) { return { ...OPT0 }; } })();
  const saveOpt = () => { try { localStorage.setItem("yv_ln_opt", JSON.stringify(OPT)); } catch (e) {} };
  const presetOf = (id) => PRESETS.find((p) => p.id === id) || PRESETS[0];
  // що вибрано на старті → вигляд проєкту
  function optLook(o = OPT, base = {}) { const p = presetOf(o.preset);
    return { style: p.th, look: { ...LOOK0, ...base, font: p.font, frame: p.frame, lw: (p.lw || 1) * (+o.lw || 1), boil: p.boil !== false, glow: true, subs: p.sb, plaque: o.pops ? p.pq : "none", pal: p.pal, body: o.body || "outline" }, subs: !!o.subs }; }
  function applyOpt() { const r = optLook(OPT); L.style = r.style; L.look = r.look; L.subs = r.subs; L.opt = { ...OPT }; }
  const STYLES = THEMES;
  const LOOK0 = { lw: 1, boil: true, glow: true, frame: "box", plaque: "marker", subs: "classic", font: "Manrope", fig: true };
  const PLC = { red: "#e5383b", green: "#2fb36d", yellow: "#ffd60a", blue: "#3a86ff", purple: "#8e5cf7", orange: "#fb8500", pink: "#ff4d8d", gray: "#8d99ae" };
  const lookOf = () => ({ ...LOOK0, ...(L?.look || {}) });
  function styOf() { const th = THEMES[L.style] || THEMES.neon, lk = lookOf(); return { ...th, glow: lk.glow ? th.glow : null, font: lk.font, lk }; }
  function prep() {
    ENV = null; if (L.aud?.length) { const SR = E().SR, hop = Math.round(SR / 50), n = Math.ceil(L.aud.length / hop), ev = new Float32Array(n); let mx = 1e-4;
      for (let i = 0; i < n; i++) { let a = 0; for (let j = i * hop, e = Math.min(L.aud.length, j + hop); j < e; j += 4) a = Math.max(a, Math.abs(L.aud[j])); ev[i] = a; mx = Math.max(mx, a); }
      ENV = (t) => clamp((ev[Math.min(n - 1, Math.max(0, Math.round(t * 50)))] || 0) / mx * 1.4); }
    const W = L.words; TOT = (L.aud?.length || 0) / E().SR;
    const at = (i) => W[clamp(i | 0, 0, W.length - 1)]?.s ?? 0;
    ST = []; (L.scenes || []).forEach((s) => { const t0 = ST.length ? at(s.a) : 0; if (ST.length && t0 <= ST[ST.length - 1].t0 + .4) return; ST.push({ s, t0 }); });
    ST.forEach((q, k) => { q.t1 = ST[k + 1] ? ST[k + 1].t0 : TOT + 1; q.n = k + 1;
      q.items = (q.s.items || []).map((it, ii) => { const t = Math.max(q.t0, it.at != null ? at(it.at) - .1 : q.t0 + ii * .25);
        const mv = (it.moves || []).map((m) => ({ ...m, t: Math.max(q.t0, at(m.i) - .05) })).sort((a, b) => a.t - b.t); return { ...it, ta: t, mv, seed: k * 31 + ii * 7 + 1 }; }); });
    // субтитри: по 2–4 слова
    CH = []; let c = null;
    W.forEach((w, i) => { if (!c || c.idx.length >= 7 || /[.!?…]$/.test(W[c.idx[c.idx.length - 1]].w) || (c.idx.length >= 4 && /[,:;—]$/.test(W[c.idx[c.idx.length - 1]].w)) || w.s - c.e > .6) { c && CH.push(c); c = { idx: [i], s: w.s, e: w.e }; } else { c.idx.push(i); c.e = w.e; } });
    c && CH.push(c); CH.forEach((q, k) => { q.until = CH[k + 1] ? Math.min(CH[k + 1].s, q.e + .5) : q.e + .6; });
  }

  /* ---------- малювання ---------- */
  let BOIL = 0;
  function strokes(x, list, prog, sty, k, lw = 5.5) {
    const len = (p) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
    const tot = list.reduce((a, p) => a + len(p), 0); let left = prog >= 1 ? 1e9 : tot * prog;
    lw *= sty.lk?.lw || 1; x.lineCap = "round"; x.lineJoin = "round"; x.lineWidth = lw * k; x.strokeStyle = sty.ink;
    const pass = () => { let l = left; x.beginPath(); for (const p of list) { if (l <= 0) break; x.moveTo(p[0][0], p[0][1]);
      for (let i = 1; i < p.length && l > 0; i++) { const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); if (d <= l) { x.lineTo(p[i][0], p[i][1]); l -= d; } else { const f = l / d; x.lineTo(p[i - 1][0] + (p[i][0] - p[i - 1][0]) * f, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * f); l = 0; } } } x.stroke(); };
    if (sty.glow) { x.save(); x.shadowColor = sty.glow; x.shadowBlur = 22 * k; pass(); x.restore(); x.save(); x.lineWidth = lw * .45 * k; x.strokeStyle = /^#f|#fff/i.test(sty.ink) ? "#ffffff" : sty.ink; pass(); x.restore(); }
    else pass();
  }
  // «живі» лінії: легке тремтіння, нове 8 разів на секунду
  let NOBOIL = false;
  const jit = (pts, seed, k) => NOBOIL ? pts : pts.map((p, i) => [p[0] + (rnd(seed + i * 1.7, BOIL) - .5) * 2.4 * k, p[1] + (rnd(seed * 3.1 + i, BOIL + 9) - .5) * 2.4 * k]);
  function figure(pose, x0, y0, U, f, face = "", wear = null, fo = {}) {
    const P = { ...P0, ...pose }, sv = P.sv > .5, hs = fo.hs || 1, HP = [];
    const hip = [0, -1.65 + P.y], tb = P.b * D, neck = [hip[0] + Math.sin(tb) * 1.3, hip[1] - Math.cos(tb) * 1.3], sh = [neck[0] + (hip[0] - neck[0]) * .16, neck[1] + (hip[1] - neck[1]) * .16];
    // напрям кінцівки: збоку — уперед, спереду — у свій бік (s = −1 ліва, +1 права)
    const dir = (a, s) => [(sv ? 1 : s) * Math.sin(a * D), Math.cos(a * D)];
    const limb = (o, a1, a2, l1, l2, s, leg) => { const off = leg ? 0 : (sv ? P.b : 0), d1 = dir(a1 + off, s), e = [o[0] + d1[0] * l1, o[1] + d1[1] * l1], d2 = dir(a1 + off + (leg && sv ? -a2 : a2), s); return [o, e, [e[0] + d2[0] * l2, e[1] + d2[1] * l2]]; };
    const ht = (P.b + P.h) * D, hc = [neck[0] + Math.sin(ht) * (.42 * hs + .08), neck[1] - Math.cos(ht) * (.42 * hs + .08)];
    let parts = [[hip, neck], arc(hc[0], hc[1], .42, 0, 360, 20), limb(sh, P.la1, P.la2, .72, .66, -1), limb(sh, P.ra1, P.ra2, .72, .66, 1), limb(hip, P.ll1, P.ll2, .85, .82, -1, 1), limb(hip, P.rl1, P.rl2, .85, .82, 1, 1)];
    // долоні й черевики
    const end = (l) => l[2], la = parts[2], ra = parts[3], ll = parts[4], rl = parts[5];
    parts.push(arc(end(la)[0], end(la)[1], .1, 0, 360, 10), arc(end(ra)[0], end(ra)[1], .1, 0, 360, 10));
    [[ll, -1], [rl, 1]].forEach(([l, s]) => { const e = end(l), fx = sv ? .24 : s * .17; parts.push([[e[0] - (sv ? .04 : s * .02), e[1]], [e[0] + fx, e[1] + .02]]); });
    // обличчя: очі-зіниці (кліпають, дивляться вперед), брови за емоцією, рот (говорить — рухається)
    if (face) { const ex = sv ? [.17] : [-.15, .15], o = sv ? .1 : 0, fc = [hc[0] + o, hc[1]], lk = sv ? .04 : 0;
      ex.forEach((e) => HP.push(fo.blink ? [[fc[0] + e - .06, fc[1] - .07], [fc[0] + e + .06, fc[1] - .07]] : face === "shock" ? arc(fc[0] + e, fc[1] - .07, .075, 0, 360, 10) : arc(fc[0] + e + lk, fc[1] - .07, .045, 0, 360, 8)));
      if (face === "shock") ex.forEach((e) => HP.push(arc(fc[0] + e + lk, fc[1] - .07, .02, 0, 360, 6)));
      const br = { happy: [-.2, -.24, .02], sad: [-.18, -.2, -.06], shock: [-.27, -.27, 0], strain: [-.2, -.16, .06] }[face];
      if (br) ex.forEach((e) => { const sg = e < 0 ? -1 : 1; HP.push([[fc[0] + e - .08, fc[1] + br[0] + (sg < 0 ? 0 : br[2])], [fc[0] + e + .08, fc[1] + br[1] + (sg < 0 ? br[2] : 0)]]); });
      const mo = fo.mouth || 0;
      if (mo > .06) HP.push(arc(fc[0] + o * .4, fc[1] + .19, .1, 0, 360, 12).map(([a, b]) => [a, fc[1] + .19 + (b - fc[1] - .19) * (.25 + mo)]));
      else if (face === "happy") HP.push(arc(fc[0], fc[1] + .04, .19, 25, 155, 10)); else if (face === "sad") HP.push(arc(fc[0], fc[1] + .32, .17, 215, 325, 10));
      else if (face === "shock") HP.push(arc(fc[0], fc[1] + .2, .08, 0, 360, 10)); else if (face === "strain") HP.push([[fc[0] - .13, fc[1] + .2], [fc[0] - .04, fc[1] + .15], [fc[0] + .04, fc[1] + .2], [fc[0] + .13, fc[1] + .15]]);
      else HP.push([[fc[0] - .09, fc[1] + .18], [fc[0] + .09, fc[1] + .18]]); }
    // зовнішність: щоб персонажів можна було розрізнити без звуку (мама/дитина/начальник/мавпа…)
    if (wear?.length) { const Wr = new Set(wear), hr = .42, H0 = hc[0], H1 = hc[1];
      if (Wr.has("hair")) for (let i = -2; i <= 2; i++) { const a = (-90 + i * 24) * D; HP.push([[H0 + Math.cos(a) * hr, H1 + Math.sin(a) * hr], [H0 + Math.cos(a) * (hr + .17), H1 + Math.sin(a) * (hr + .17)]]); }
      if (Wr.has("longhair")) HP.push(arc(H0, H1, hr + .07, 175, 365, 14), [[H0 - hr - .06, H1 + .02], [H0 - hr - .12, H1 + .6]], [[H0 + hr + .06, H1 + .02], [H0 + hr + .12, H1 + .6]]);
      if (Wr.has("bun")) HP.push(arc(H0, H1 - hr - .14, .15, 0, 360, 10));
      if (Wr.has("bow")) HP.push([[H0 + .12, H1 - hr + .02], [H0 + .38, H1 - hr - .14], [H0 + .38, H1 - hr + .14], [H0 + .12, H1 - hr + .02], [H0 - .14, H1 - hr - .14], [H0 - .14, H1 - hr + .14], [H0 + .12, H1 - hr + .02]]);
      if (Wr.has("hat")) HP.push([[H0 - .62, H1 - hr + .06], [H0 + .62, H1 - hr + .06]], rect(H0 - .34, H1 - hr - .42, .68, .48));
      if (Wr.has("cap")) HP.push(arc(H0, H1 - .04, hr + .03, 180, 360, 12), [[H0 + hr + .02, H1 - .07], [H0 + hr + .38, H1 - .03]]);
      if (Wr.has("crown")) HP.push([[H0 - .34, H1 - hr + .02], [H0 - .34, H1 - hr - .3], [H0 - .17, H1 - hr - .12], [H0, H1 - hr - .34], [H0 + .17, H1 - hr - .12], [H0 + .34, H1 - hr - .3], [H0 + .34, H1 - hr + .02], [H0 - .34, H1 - hr + .02]]);
      if (Wr.has("glasses")) HP.push(arc(H0 - .15, H1 - .06, .11, 0, 360, 10), arc(H0 + .15, H1 - .06, .11, 0, 360, 10), [[H0 - .04, H1 - .06], [H0 + .04, H1 - .06]]);
      if (Wr.has("beard")) HP.push(arc(H0, H1 + .1, .32, 15, 165, 12));
      if (Wr.has("ears")) HP.push(arc(H0 - hr - .1, H1 - .02, .16, 0, 360, 10), arc(H0 + hr + .1, H1 - .02, .16, 0, 360, 10));
      if (Wr.has("cat")) HP.push([[H0 - .38, H1 - .2], [H0 - .3, H1 - .62], [H0 - .1, H1 - .4]], [[H0 + .38, H1 - .2], [H0 + .3, H1 - .62], [H0 + .1, H1 - .4]]);
      if (Wr.has("tail")) parts.push([[hip[0], hip[1]], [hip[0] - .45, hip[1] + .12], [hip[0] - .78, hip[1] - .18], [hip[0] - .7, hip[1] - .55], [hip[0] - .42, hip[1] - .5]]);
      if (Wr.has("skirt")) parts.push([[hip[0] - .12, hip[1] - .22], [hip[0] - .58, hip[1] + .6], [hip[0] + .58, hip[1] + .6], [hip[0] + .12, hip[1] - .22]]);
      if (Wr.has("tie")) parts.push([[neck[0], neck[1] + .14], [neck[0] - .09, neck[1] + .36], [neck[0], neck[1] + .78], [neck[0] + .09, neck[1] + .36], [neck[0], neck[1] + .14]]);
      if (Wr.has("cape")) parts.push([[sh[0] - .1, sh[1]], [sh[0] - .75, hip[1] + .5], [sh[0] - .2, hip[1] + .35]]); }
    { const sc = (p) => p.map(([a, b]) => [hc[0] + (a - hc[0]) * hs, hc[1] + (b - hc[1]) * hs]); parts[1] = sc(parts[1]); parts.push(...HP.map(sc)); }
    if (P.r) { const c = P.r > 120 ? [0, -1.65] : [0, 0], a = P.r * D; parts = parts.map((p) => p.map(([x, y]) => [c[0] + (x - c[0]) * Math.cos(a) - (y - c[1]) * Math.sin(a), c[1] + (x - c[0]) * Math.sin(a) + (y - c[1]) * Math.cos(a)])); }
    return parts.map((p) => p.map(([x, y]) => [x0 + x * f * U, y0 + y * U]));
  }
  /* ---------- кастинг: люди різного віку й тварини ---------- */
  const CAST = { man: { n: "чоловік", wear: ["hair"] }, woman: { n: "жінка", wear: ["longhair", "skirt"], s: .95 }, girl: { n: "дівчинка", wear: ["bow", "longhair", "skirt"], s: .62, hs: 1.32 }, boy: { n: "хлопчик", wear: ["hair"], s: .62, hs: 1.32 },
    baby: { n: "малюк", wear: [], s: .42, hs: 1.5 }, grandma: { n: "бабуся", wear: ["bun", "glasses", "skirt"], s: .9, stoop: 10 }, grandpa: { n: "дідусь", wear: ["beard", "glasses", "hat"], s: .93, stoop: 10 }, boss: { n: "начальник", wear: ["tie", "glasses"] } };
  // чотирилапі на одному «скелеті»: L — довжина тулуба, H — висота лап, hd — голова, bod — товщина тулуба, sn — морда
  const ANIM = {
    dog: { n: "собака", L: 1.05, H: .55, hd: .4, ear: "flop", tail: "wag", sn: .24, bod: .32 }, cat: { n: "кіт", L: .9, H: .45, hd: .37, ear: "point", tail: "curl", sn: 0, bod: .27, wh: 1 },
    fox: { n: "лис", L: 1.05, H: .48, hd: .35, ear: "point", tail: "bush", sn: .3, bod: .27 }, rabbit: { n: "кролик", L: .62, H: .26, hd: .32, ear: "long", tail: "puff", sn: 0, bod: .3, wh: 1 },
    mouse: { n: "миша", L: .5, H: .14, hd: .25, ear: "round", tail: "long", sn: .12, bod: .19, wh: 1 }, bear: { n: "ведмідь", L: 1.35, H: .55, hd: .47, ear: "round", tail: "stub", sn: .2, bod: .45 },
    horse: { n: "кінь", L: 1.5, H: 1.1, hd: .34, ear: "point", tail: "hang", sn: .3, bod: .36, neck: .65 }, pig: { n: "свиня", L: 1.1, H: .36, hd: .4, ear: "point", tail: "curl", sn: .1, bod: .4, pig: 1 },
    cow: { n: "корова", L: 1.55, H: .9, hd: .37, ear: "side", tail: "hang", sn: .25, bod: .47, horn: 1, spots: 1, neck: .2 }, sheep: { n: "вівця", L: 1.05, H: .5, hd: .31, ear: "side", tail: "stub", sn: .12, bod: .42, wool: 1 },
    bird: { n: "пташка", bird: 1 } };
  function drawAnimal(x, it, m, t, gx, gy, U, sty, k, ap, bm, vb) {
    const A = ANIM[it.k], f = m.f, st = m.state, d = t - (m.ts || 0), LY = [], sd = it.seed || 1;
    const X = (a) => gx + a * f * U, Y = (b) => gy + b * U, pt = (a, b) => [X(a), Y(b)], ar = (cx, cy, r, a0, a1, n, ry) => { const o = []; for (let i = 0; i <= n; i++) { const q = (a0 + (a1 - a0) * i / n) * D; o.push([cx + Math.cos(q) * r, cy + Math.sin(q) * (ry ?? r)]); } return o; };
    const add = (p, o = {}) => LY.push({ p, ...o });
    const talk = st === "talk" ? (ENV ? ENV(t) : (.5 + .5 * Math.sin(t * 17))) : 0, happy = ["cheer", "dance", "jump"].includes(st) || m.face === "happy", sad = st === "sad" || m.face === "sad", blink = ((t + sd * .77) % 3.4) < .13;
    let hc, hr;
    const eye = (ex, ey, r) => add(blink ? [[ex - r, ey], [ex + r, ey]] : happy ? ar(ex, ey + r * .5, r * 1.2, 200, 340, 6) : st === "shock" ? ar(ex, ey, r * 1.8, 0, 360, 10) : ar(ex, ey, r, 0, 360, 8), { dot: !blink && !happy });
    if (A.bird) { const fly = m.moving || st === "jump" || st === "cheer", up = fly ? 1.5 + .12 * Math.sin(t * 4 + sd) : 0, cy = -.5 - up, flap = fly ? Math.sin(t * 22) : Math.sin(t * 2 + sd) * .15;
      if (!fly) { add([[-.04, cy + .2], [-.07, 0], [.03, 0]]); add([[.1, cy + .2], [.08, 0], [.18, 0]]); }
      add([[-.28, cy - .06], [-.6, cy - .2], [-.58, cy - .02], [-.62, cy + .1], [-.28, cy + .08]], { f: 1 });
      add(ar(0, cy, .36, 0, 360, 22, .27), { f: 1 }); hc = [.3, cy - .27]; hr = .19; add(ar(hc[0], hc[1], hr, 0, 360, 16), { f: 1 });
      add([[hc[0] + .15, hc[1] - .05], [hc[0] + .38, hc[1] + .02], [hc[0] + .15, hc[1] + .08]], { f: 1 });
      add([[-.16, cy - .02], [-.02, cy - .36 * flap - .04], [.12, cy - .3 * flap], [.2, cy + .02]], { f: 1 });
      eye(hc[0] + .07, hc[1] - .04, .03); if (talk > .08) add([[hc[0] + .17, hc[1] + .09], [hc[0] + .33, hc[1] + .1 + talk * .1]]); }
    else {
      const ph = t * (m.run ? 13 : 7.5) + sd, amp = m.moving ? (m.run ? 40 : 22) : 0, sit = st === "sit" || st === "work" || st === "think", lie = st === "fall" || st === "hang";
      let lift = 0; if (st === "jump") lift = Math.max(0, Math.sin(clamp(d / .9) * Math.PI)) * 1.1; else if (happy && !m.moving) lift = Math.abs(Math.sin(t * 7)) * .16; else if (A.ear === "long" && m.moving) lift = Math.abs(Math.sin(ph * .5)) * .35;
      const H = lie ? .04 : A.H, cy0 = -(H + A.bod) - lift + (st === "move" ? Math.abs(Math.sin(ph)) * .03 : Math.sin(t * 1.8 + sd) * .012), rot = sit ? -26 * D : 0, hipB = [-A.L / 2 + .16, cy0 + A.bod * .4];
      const R = ([a, b]) => { if (!rot) return [a, b]; const ca = Math.cos(rot), sa = Math.sin(rot), dx = a - hipB[0], dy = b - hipB[1]; return [hipB[0] + dx * ca - dy * sa, hipB[1] + dx * sa + dy * ca]; };
      const legLen = H + A.bod * .6 - lift, LW = Math.max(.1, Math.min(.2, A.bod * .42));
      const leg = (lx, ly, ang, len, bend) => { const a2 = ang * D, foot = [lx + Math.sin(a2) * len, ly + Math.cos(a2) * len], mid = [(lx + foot[0]) / 2 + bend * .06, (ly + foot[1]) / 2]; return [[lx, ly], mid, foot, [foot[0] + LW * .55, foot[1]]]; };
      const legs = [];
      [[0, 0], [Math.PI, 1]].forEach(([o, near]) => { const back = R(hipB), front = R([A.L / 2 - .16, cy0 + A.bod * .4]);
        if (lie) { legs.push({ near, p: [back, [back[0] + .3, -.06], [back[0] + .5, -.05]] }, { near, p: [front, [front[0] + .3, -.06], [front[0] + .5, -.05]] }); return; }
        legs.push({ near, p: sit ? [back, [back[0] + .3, -.1 - A.H * .3], [back[0] + .34, -.02], [back[0] + .5, -.02]] : leg(back[0], back[1], Math.sin(ph + o) * amp + (st === "jump" ? -25 : 0), legLen, -1) });
        legs.push({ near, p: leg(front[0], front[1], Math.sin(ph + o + Math.PI) * amp + (st === "jump" ? 25 : 0), sit ? Math.max(.1, -front[1]) : legLen, 1) }); });
      const tb = R([-A.L / 2 + .04, cy0 - A.bod * .25]), wag = (st === "move" || happy ? Math.sin(t * (happy ? 18 : 9)) : Math.sin(t * 2 + sd) * .3) * (sad ? .2 : 1), dn = sad ? .35 : 0;
      const TAIL = { wag: [tb, [tb[0] - .25, tb[1] - .22 + dn + wag * .06], [tb[0] - .36 + wag * .1, tb[1] - .48 + dn * 1.6]], curl: [tb, [tb[0] - .28, tb[1] - .05 + dn], [tb[0] - .42, tb[1] - .38 + dn], [tb[0] - .3 + wag * .05, tb[1] - .6 + dn], [tb[0] - .14, tb[1] - .52 + dn]],
        bush: [tb, [tb[0] - .32, tb[1] + .08], [tb[0] - .62, tb[1] - .08 + wag * .04], [tb[0] - .74, tb[1] - .32], [tb[0] - .52, tb[1] - .34], [tb[0] - .3, tb[1] - .16], tb], puff: ar(tb[0] - .06, tb[1], .1, 0, 360, 10),
        long: [tb, [tb[0] - .3, tb[1] + .15], [tb[0] - .55, tb[1] + .05 + wag * .05], [tb[0] - .8, tb[1] - .12]], hang: [tb, [tb[0] - .12, tb[1] + .3 + wag * .03], [tb[0] - .14, tb[1] + .62], [tb[0] - .2, tb[1] + .72], [tb[0] - .08, tb[1] + .72], [tb[0] - .14, tb[1] + .62]], stub: [tb, [tb[0] - .14, tb[1] - .1]] }[A.tail];
      let body = ar(0, cy0, A.L / 2 + .08, 0, 360, 34, A.bod); if (A.wool) body = body.map(([a, b], i) => { const r = 1 + (i % 2 ? .08 : -.02); return [a * r, cy0 + (b - cy0) * r]; }); body = body.map(R);
      const nk = A.neck || 0, hx = A.L / 2 + A.hd * .35 + nk * .4, hy = cy0 - A.bod * .55 - A.hd * .3 - nk + (sad ? .2 : 0) + (st === "talk" ? Math.sin(t * 9) * .02 : 0);
      hc = R([hx, hy]); hr = A.hd;
      const far = legs.filter((o) => !o.near), near = legs.filter((o) => o.near);
      far.forEach((o) => add(o.p, { tube: LW * .92, dim: 1 }));
      if (TAIL) add(TAIL, A.tail === "bush" || A.tail === "puff" ? { f: 1 } : { tube: A.tail === "wag" || A.tail === "curl" ? LW * .55 : 0 });
      if (nk) { const n1 = R([A.L / 2 - .14, cy0 - A.bod * .6]), n2 = R([A.L / 2 + .14, cy0 + .02]); add([n1, [hc[0] - hr * .55, hc[1] + hr * .2], [hc[0] + hr * .25, hc[1] + hr * .8], n2], { f: 1 }); }
      add(body, { f: 1 }); if (A.spots) [[-.3, -.08], [.18, .1], [-.05, -.2]].forEach(([a, b2]) => add(ar(a, cy0 + b2, .13, 0, 360, 10, .08).map(R), { f: 2 }));
      near.forEach((o) => add(o.p, { tube: LW }));
      const [H0, H1] = hc, eT = sad ? .25 : 0;
      const EARS = { flop: [[[H0 - hr * .25, H1 - hr * .85], [H0 - hr * .85, H1 - hr * .35 + eT * .2], [H0 - hr * .78, H1 + hr * .5 + eT * .2], [H0 - hr * .45, H1 + hr * .45], [H0 - hr * .35, H1 - hr * .4]]],
        point: [[[H0 - hr * .7, H1 - hr * .5], [H0 - hr * .62 - eT * .3, H1 - hr * 1.45 + eT], [H0 - hr * .18, H1 - hr * .92]], [[H0 + hr * .02, H1 - hr * .98], [H0 + hr * .25, H1 - hr * 1.55 + eT], [H0 + hr * .5, H1 - hr * .78]]],
        long: [ar(H0 - hr * .38, H1 - hr * 1.6 + eT, hr * .22, 0, 360, 12, hr * .78), ar(H0 + hr * .08, H1 - hr * 1.72 + eT, hr * .22, 0, 360, 12, hr * .8)],
        round: [ar(H0 - hr * .6, H1 - hr * .75, hr * .32, 0, 360, 12), ar(H0 + hr * .15, H1 - hr * .92, hr * .28, 0, 360, 12)], side: [[[H0 - hr * .55, H1 - hr * .45], [H0 - hr * 1.15, H1 - hr * .55 + eT * .3], [H0 - hr * .95, H1 - hr * .25], [H0 - hr * .6, H1 - hr * .15]]] }[A.ear] || [];
      if (A.horn) add([[H0 - hr * .3, H1 - hr * .88], [H0 - hr * .42, H1 - hr * 1.35], [H0 - hr * .18, H1 - hr * 1.45]]);
      EARS.forEach((e) => add(e, { f: 1 }));
      add(ar(H0, H1, hr, 0, 360, 24), { f: 1 });
      const mo = talk > .08 ? .05 + talk * .14 : 0;
      if (A.pig) { add(ar(H0 + hr * .98, H1 + hr * .18, hr * .25, 0, 360, 12, hr * .3), { f: 1 }); add(ar(H0 + hr * 1.03, H1 + hr * .08, .028, 0, 360, 5), { dot: 1 }); add(ar(H0 + hr * 1.03, H1 + hr * .28, .028, 0, 360, 5), { dot: 1 });
        add(mo ? ar(H0 + hr * .6, H1 + hr * .62, .05, 0, 360, 8, mo) : [[H0 + hr * .45, H1 + hr * .58], [H0 + hr * .7, H1 + hr * .62]]); }
      else if (A.sn) { const tip = H0 + hr * .72 + A.sn; add([[H0 + hr * .55, H1 - hr * .05], [tip - .04, H1 + hr * .02], [tip, H1 + hr * .12], [tip, H1 + hr * .38], [tip - .05, H1 + hr * .48 + mo], [H0 + hr * .5, H1 + hr * .62 + mo * .6]], { f: 1 });
        add(ar(tip - .02, H1 + hr * .1, .055, 0, 360, 8, .045), { dot: 1 }); add([[tip - .02, H1 + hr * .3], [H0 + hr * .62, H1 + hr * .38]]); }
      else { add([[H0 + hr * .82, H1 + hr * .08], [H0 + hr * .98, H1 + hr * .14], [H0 + hr * .84, H1 + hr * .22]], { dot: 1 }); add(mo ? ar(H0 + hr * .7, H1 + hr * .45, .05, 0, 360, 8, mo) : [[H0 + hr * .55, H1 + hr * .38], [H0 + hr * .72, H1 + hr * .46], [H0 + hr * .88, H1 + hr * .36]]); }
      if (A.wh) add([[H0 + hr * .75, H1 + hr * .26], [H0 + hr * 1.45, H1 + hr * .14]], { thin: 1 }), add([[H0 + hr * .75, H1 + hr * .34], [H0 + hr * 1.42, H1 + hr * .44]], { thin: 1 });
      eye(H0 + hr * .35, H1 - hr * .18, hr * .1); if (sad) add([[H0 + hr * .2, H1 - hr * .45], [H0 + hr * .5, H1 - hr * .36]]);
      if (A.ear === "point" || A.ear === "round") { const e2 = A.ear === "point" ? [[H0 - hr * .6, H1 - hr * .62], [H0 - hr * .55, H1 - hr * 1.15], [H0 - hr * .32, H1 - hr * .86]] : null; if (e2) add(e2, { thin: 1 }); } }
    // малюємо шарами: заливка (контур/об'єм), «трубки» лап, лінії
    const mp = (arr) => arr.map(([a, b]) => pt(a, b)), fillC = bm === "line" ? (sty.paper || sty.bg) : vb, acc2 = { ...sty, ink: sty.ink };
    LY.forEach((o, i) => { const q = jit(mp(o.p), sd * 11 + i * 5, k);
      if (o.f && ap > .25) { x.save(); x.globalAlpha *= clamp((ap - .25) * 2) * (o.f === 2 ? .35 : 1); x.fillStyle = o.f === 2 ? sty.ink : fillC; x.beginPath(); q.forEach(([a, b], j) => j ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); x.restore(); }
      if (o.dot && ap > .6) { x.save(); x.fillStyle = sty.ink; x.beginPath(); q.forEach(([a, b], j) => j ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath(); x.fill(); x.restore(); }
      if (o.tube && bm !== "line") { const w = o.tube * U / k; strokes(x, [q], ap, acc2, k, w + 4.5); strokes(x, [q], ap, { ...sty, ink: fillC, glow: null }, k, Math.max(1, w - 4.5)); }
      else strokes(x, [q], ap, sty, k, o.thin ? 3 : o.tube ? 6 : bm === "volume" ? 6 : 5.5); });
    return { hc: pt(hc[0], hc[1]), hr: hr * U, top: Y(hc[1] - hr * 2.2) };
  }
  /* ---------- бібліотека ліній: Tabler Icons (MIT) + Lucide (ISC), ~5300 предметів ---------- */
  let ICO = null, ICOP = null; const ICOC = new Map(), ICOS = new Map(), ICOMISS = new Set();
  function loadIcons() { if (window.YVIcons) { ICO = window.YVIcons; return Promise.resolve(); } if (ICOP) return ICOP;
    ICOP = new Promise((ok) => { const sc = document.createElement("script"); sc.src = "a/icons.js?v=" + (window.YV_BUILD || "1"); sc.onload = () => { ICO = window.YVIcons || null; ok(); }; sc.onerror = () => { ICOP = null; ok(); }; document.head.appendChild(sc); }); return ICOP; }
  const SYN = { money: "cash", dollar: "currency-dollar", euro: "currency-euro", hryvnia: "currency-hryvnia", phone: "device-mobile", smartphone: "device-mobile", computer: "device-desktop", tv: "device-tv", television: "device-tv", watch: "device-watch", tablet: "device-tablet", headphones: "headphones", car: "car", auto: "car", bike: "bike", bicycle: "bike", plane: "plane", airplane: "plane", ship: "ship", boat: "sailboat", train: "train", shop: "building-store", store: "building-store", school: "school", hospital: "building-hospital", bank: "building-bank", church: "building-church", castle: "building-castle", factory: "building-factory", tree: "tree", forest: "trees", flower: "flower", sun: "sun", moon: "moon", rain: "cloud-rain", snow: "snowflake", fire: "flame", water: "droplet", food: "tools-kitchen-2", pizza: "pizza", burger: "burger", coffee: "coffee", tea: "cup", beer: "beer", wine: "glass-full", cake: "cake", apple: "apple", bread: "bread", egg: "egg", fish: "fish", candy: "candy", ice_cream: "ice-cream", gift: "gift", present: "gift", key: "key", door: "door", window: "window", bed: "bed", sofa: "sofa", couch: "sofa", lamp: "bulb", fridge: "fridge", microwave: "microwave", toilet: "toilet-paper", bath: "bath", shower: "bath", chair: "armchair", table: "table", book: "book", notebook: "notebook", pen: "pencil", guitar: "guitar-pick", music: "music", camera: "camera", video: "video", photo: "photo", instagram: "camera", like: "thumb-up", dislike: "thumb-down", comment: "message-circle", chat: "messages", message: "message", email: "mail", letter: "mail", bell: "bell", notification: "bell", calendar: "calendar", clock: "clock", alarm: "alarm", hourglass: "hourglass", wallet: "wallet", card: "credit-card", creditcard: "credit-card", bag: "shopping-bag", cart: "shopping-cart", basket: "basket", box: "box", package: "package", ball: "ball-football", football: "ball-football", basketball: "ball-basketball", trophy: "trophy", medal: "medal", crown: "crown", diamond: "diamond", rocket: "rocket", target: "target", idea: "bulb", brain: "brain", heart: "heart", star: "star", fireworks: "confetti", party: "confetti", graph: "chart-line", growth: "trending-up", chart: "chart-bar", map: "map", world: "world", globe: "world", house: "home", home: "home", tent: "tent", mountain: "mountain", sea: "ripple", wave: "ripple", umbrella: "umbrella", glasses: "eyeglass", shirt: "shirt", shoe: "shoe", tooth: "dental", pill: "pill", medicine: "pill", doctor: "stethoscope", syringe: "vaccine", lock: "lock", shield: "shield", warning: "alert-triangle", question: "help-circle", search: "search", magnifier: "search", tool: "tool", hammer: "hammer", scissors: "scissors", paint: "brush", brush: "brush", palette: "palette", microphone: "microphone", mic: "microphone", speaker: "speakerphone", wifi: "wifi", battery: "battery", plug: "plug", robot: "robot", ai: "robot", ghost: "ghost", skull: "skull", bug: "bug", butterfly: "butterfly", spider: "spider", dog: "dog", cat: "cat", horse: "horse", pig: "pig", fish2: "fish", bird: "feather", turtle: "turtle", deer: "deer", baby: "baby-carriage", stroller: "baby-carriage", money_bag: "moneybag", moneybag: "moneybag", piggy_bank: "pig-money", coin: "coin", coins: "coins", receipt: "receipt", tag: "tag", price: "tag", discount: "discount", percent: "percentage", sale: "discount" };
  function iconIdx(q) { if (!ICO) return -1; q = String(q || "").toLowerCase().trim().replace(/[\s_]+/g, "-"); if (!q) return -1; if (ICOS.has(q)) return ICOS.get(q);
    if (!ICO._m) { ICO._m = new Map(); ICO.n.forEach((n, i) => ICO._m.set(n, i)); }
    const M = ICO._m, sy = SYN[q] || SYN[q.replace(/-/g, "_")]; let r = M.get(q) ?? (sy && M.get(sy)) ?? M.get(q.replace(/s$/, "")) ?? M.get(q.replace(/es$/, ""));
    if (r == null) { const tk = q.split("-").filter((w) => w.length > 1); let best = -1, bs = 0;
      ICO.n.forEach((n, i) => { const nt = n.split("-"), tg = " " + ICO.t[i] + " "; let sc2 = 0; for (const w of tk) { if (nt.includes(w)) sc2 += 4; else if (nt.includes(w.replace(/s$/, ""))) sc2 += 3.5; else if (tg.includes(" " + w + " ")) sc2 += 2; else if (w.length > 3 && tg.includes(" " + w)) sc2 += 1; } sc2 -= nt.length * .15; if (sc2 > bs) { bs = sc2; best = i; } });
      r = bs >= 1.8 ? best : -1; }
    ICOS.set(q, r); if (r < 0 && !ICOMISS.has(q)) { ICOMISS.add(q); track("icon_miss", { v: q.slice(0, 40) }); } return r; }
  function iconShape(it) { const q = it.q || it.k, i = iconIdx(q); if (i < 0) return null; if (ICOC.has(i)) return ICOC.get(i);
    const pl = ICO.p[i].map((str) => { const o = []; for (let j = 0; j + 1 < str.length; j += 2) o.push([((str.charCodeAt(j) - 40) / 4 - 12) / 10.5, ((str.charCodeAt(j + 1) - 40) / 4 - 12) / 10.5]); return o; }), fn = () => pl; ICOC.set(i, fn); return fn; }
  // готові місця: декорації, що стоять позаду (бліді), — щоб кадр не був порожнім
  const PLACESETS = {
    kitchen: [["fridge", .1, .74, 1.45], ["window", .5, .3, 1.2], ["microwave", .82, .55, .8], ["tools-kitchen-2", .9, .3, .6]], room: [["window", .25, .32, 1.2], ["sofa", .78, .8, 1.3], ["lamp", .93, .45, .9], ["photo", .6, .2, .6]],
    bedroom: [["bed", .78, .8, 1.5], ["window", .25, .3, 1.1], ["moon", .25, .3, .4], ["lamp", .08, .7, .8]], office: [["device-desktop", .82, .62, .95], ["chart-bar", .2, .25, .8], ["plant", .08, .78, .9], ["clock", .55, .15, .55]],
    classroom: [["school", .5, .17, .7], ["notebook", .12, .72, .6], ["clock", .88, .2, .55], ["world", .86, .7, .7]], shop: [["building-store", .5, .22, 1.1], ["shopping-cart", .85, .8, .9], ["tag", .12, .55, .6], ["basket", .15, .82, .7]],
    cafe: [["coffee", .15, .7, .8], ["cup", .88, .72, .6], ["armchair", .85, .82, 1], ["window", .5, .25, 1.1]], street: [["building", .1, .5, 1.6], ["building-skyscraper", .88, .45, 1.7], ["traffic-lights", .65, .62, 1.1], ["car", .3, .86, .9]],
    park: [["tree", .1, .65, 1.6], ["trees", .88, .65, 1.4], ["sun", .8, .14, .7], ["bike", .5, .84, .9]], forest: [["trees", .1, .62, 1.7], ["tree", .9, .6, 1.8], ["mushroom", .7, .86, .5], ["leaf", .35, .2, .4]],
    beach: [["sun", .82, .14, .8], ["sailboat", .2, .55, .9], ["beach", .6, .82, 1], ["ripple", .4, .7, .9]], village: [["home", .15, .7, 1.4], ["fence", .6, .84, 1], ["tree", .9, .62, 1.5], ["sun", .55, .14, .6]],
    city: [["building-skyscraper", .1, .5, 1.8], ["buildings", .5, .55, 1.4], ["building", .9, .55, 1.6], ["moon", .7, .12, .4]] };
  function drawPlace(x, place, t, sty, k, G, ap) { const set = PLACESETS[place]; if (!set || !ICO) return; x.save(); x.globalAlpha *= .3 * ap;
    set.forEach(([q, px, py, ps], i) => { const fn = iconShape({ q }); if (!fn) return; const sz = 135 * k * ps, cx = G.X0 + px * G.SW, cy = G.stY + py * G.stH;
      strokes(x, fn().map((pp) => jit(pp.map(([a, b]) => [cx + a * sz, cy + b * sz]), i * 17 + 3, k)), 1, { ...sty, glow: null }, k, 4); }); x.restore(); }
  // стан персонажа в момент t: позиція, напрям, поза
  function manAt(it, t, SW) {
    let x = it.x ?? .5, f = it.f ?? 1, state = "stand", ts = it.ta, prev = "stand", pts = it.ta, from = null;
    for (const m of it.mv) { if (m.t > t) break;
      if (m.m === "walk_to" || m.m === "run_to") { const tx = clamp(m.x ?? x, .08, (it._W || 1) - .08), d = Math.abs(tx - x), dur = Math.max(.4, d / (m.m === "run_to" ? .55 : .22));
        if (t < m.t + dur) { const p = (t - m.t) / dur; f = tx >= x ? 1 : -1; from = { x0: x, x1: tx, p, run: m.m === "run_to", tt: t - m.t }; x = x + (tx - x) * p; prev = state; state = "move"; ts = m.t; break; }
        f = tx >= x ? 1 : -1; x = tx; prev = state; state = "stand"; ts = m.t + dur; continue; }
      if (POSE[m.m] || m.m === "stand") { prev = state; pts = ts; state = m.m; ts = m.t; if (!LASTING.has(m.m) && m.m !== "stand" && t > m.t + (DUR[m.m] || 1.2)) { prev = state; state = "stand"; ts = m.t + (DUR[m.m] || 1.2); } } }
    const poseOf = (s, t0) => s === "move" ? POSE[from.run ? "run" : "walk"](t - t0) : (POSE[s] || POSE.stand)(t - t0, DUR[s] || 1.2);
    const cur = poseOf(state, ts), w = clamp((t - ts) / .25);
    const pose = w < 1 && prev !== state ? mixPose(poseOf(prev === "move" ? "stand" : prev, pts), cur, ease(w)) : { ...cur };
    // живий у спокої: дихає, ледь погойдує руками
    if (state !== "move" && !["fall", "hang", "jump", "sit", "work"].includes(state)) { const sd = (it.seed || 1) * 1.7; pose.y = (pose.y || 0) + Math.sin(t * 1.9 + sd) * .025; pose.la1 = (pose.la1 ?? P0.la1) + Math.sin(t * 1.3 + sd) * 2.5; pose.ra1 = (pose.ra1 ?? P0.ra1) + Math.sin(t * 1.1 + sd + 1) * 2.5; pose.h = (pose.h || 0) + Math.sin(t * .9 + sd) * 2; }
    let face = it.face || "neutral"; for (const m of it.mv) { if (m.t > t) break; if (m.m === "happy_face") face = "happy"; else if (m.m === "sad_face") face = "sad"; }
    const fs = state === "move" ? "" : FACE[state]; if (fs && state !== "stand") face = fs;
    if (state === "talk") face = face === "neutral" ? "happy" : face;
    return { x, f, pose, face, state, ts, run: !!from?.run, moving: state === "move" };
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
    if (it.k === "gear") rot += t * 1.2; rot += (+it.r || 0) * D;
    return { x, y: y + dy, s, rot, alpha };
  }
  let ENV = null, TUBE = true;
  // мультяшні ефекти: лінії швидкості, «!», «…», крапля поту, іскорки, зірочки, хмарка з дощем
  const star4 = (cx, cy, r) => [[cx, cy - r], [cx + r * .25, cy - r * .25], [cx + r, cy], [cx + r * .25, cy + r * .25], [cx, cy + r], [cx - r * .25, cy + r * .25], [cx - r, cy], [cx - r * .25, cy - r * .25], [cx, cy - r]];
  function fx(x, m, t, it, hc, hr, gx, gy, U, sty, k) {
    const d = t - (m.ts || 0), st = m.state, acc = { ...sty, ink: sty.acc }, pulse = .5 + .5 * Math.sin(t * 9 + it.seed);
    x.save();
    if (m.moving && m.run) { const b = -m.f; x.globalAlpha *= .6; strokes(x, [0, 1, 2].map((i) => { const y = gy - U * (1.4 + i * .55), x0 = gx + b * U * (.8 + i * .15), L2 = U * (.6 + .25 * Math.sin(t * 20 + i)); return [[x0, y], [x0 + b * L2, y]]; }), 1, sty, k, 3.5);
      if (Math.sin(t * 11) > 0) strokes(x, [arc(gx + b * U * .9, gy - U * .1, U * .14, 0, 360, 10), arc(gx + b * U * 1.25, gy - U * .2, U * .09, 0, 360, 8)], 1, sty, k, 3); }
    else if (st === "jump" && d > .75 && d < 1.15) { strokes(x, [-50, -20, 20, 50].map((a) => { const r1 = U * .45, r2 = U * .75, aa = (a - 90) * D; return [[gx + Math.cos(aa) * r1, gy + 4 * k + Math.sin(aa) * r1 * .3], [gx + Math.cos(aa) * r2, gy + 4 * k + Math.sin(aa) * r2 * .3]]; }), 1, sty, k, 4); }
    else if (st === "shock" || (st === "fall" && d < 1)) { const sc = clamp(d / .25); x.font = `900 ${Math.round(U * 1.1 * (.6 + .4 * back(sc)))}px "Manrope", sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = sty.acc; x.fillText("!", hc[0], hc[1] - hr * 2.6);
      if (d < 1.2) strokes(x, [-60, -30, 30, 60].map((a) => { const aa = (a - 90) * D; return [[hc[0] + Math.cos(aa) * hr * 1.4, hc[1] + Math.sin(aa) * hr * 1.4], [hc[0] + Math.cos(aa) * hr * 2, hc[1] + Math.sin(aa) * hr * 2]]; }), 1, sty, k, 4); }
    if (st === "think") { [0, 1, 2].forEach((i) => { if (((d * 2.2) % 4) > i) { x.fillStyle = sty.ink; x.beginPath(); x.arc(hc[0] + m.f * hr * (.6 + i * .5), hc[1] - hr * (1.5 + i * .35), (4 + i * 1.5) * k, 0, 7); x.fill(); } }); }
    if (st === "work" || st === "push" || m.face === "strain") { const yy = hc[1] - hr * .3 + (d * 40 * k) % (hr * 1.2), xx = hc[0] - m.f * hr * 1.15; strokes(x, [[[xx, yy - hr * .35], ...arc(xx, yy, hr * .17, -30, 210, 10), [xx, yy - hr * .35]]], 1, sty, k, 3.5); }
    if (st === "cheer" || st === "dance" || (m.face === "happy" && st === "jump")) { x.globalAlpha *= pulse; strokes(x, [star4(hc[0] - hr * 2, hc[1] - hr * .6, hr * .45), star4(hc[0] + hr * 2.1, hc[1] - hr * 1.1, hr * .35), star4(hc[0] + hr * 1.2, hc[1] - hr * 2.1, hr * .28)], 1, acc, k, 3.5); }
    if (st === "fall" && d > .6) { [0, 1, 2].forEach((i) => { const a = t * 3 + i * 2.1, sx = hc[0] + Math.cos(a) * hr * 1.6, sy = hc[1] - hr * .8 + Math.sin(a) * hr * .4; strokes(x, [star4(sx, sy, hr * .25)], 1, acc, k, 3); }); }
    if (st === "sad") { const cx = hc[0], cy = hc[1] - hr * 2.4, cl = [...arc(cx - hr * .5, cy, hr * .4, 90, 270, 8), ...arc(cx, cy - hr * .25, hr * .5, 200, 340, 8), ...arc(cx + hr * .5, cy, hr * .4, 270, 450, 8), [cx - hr * .5, cy + hr * .4]];
      strokes(x, [cl, ...[-.4, 0, .4].map((o, i) => { const yy = cy + hr * .5 + ((t * 2 + i * .3) % 1) * hr * .7; return [[cx + o * hr, yy], [cx + o * hr - hr * .08, yy + hr * .25]]; })], 1, sty, k, 3.5); }
    x.restore();
  }
  function label(x, txt, cx, y, ap, sty, k) { x.save(); x.globalAlpha *= clamp((ap - .4) * 2.5); x.font = `700 ${Math.round(34 * k)}px "${sty.font}", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = sty.ink; if (sty.glow) { x.shadowColor = sty.glow; x.shadowBlur = 10 * k; } x.fillText(String(txt), cx, y); x.restore(); }
  // деталі сцени в заданій області (і для формату «Анімація лініями», і для «Рілс маркером»)
  function drawItems(x, items, t, sty, k, G) {
    const { X0, SW, stY, stH, U } = G, W = SW;
    for (const it of items) { if (t < it.ta) continue; const ap = clamp((t - it.ta) / (it.k === "man" ? .7 : .55));
      if (ANIM[it.k]) { const m = manAt(it, t, SW), gx = X0 + m.x * SW, gy = stY + (it.y ?? .92) * stH, s = (it.s ?? 1) * (it.k === "horse" || it.k === "cow" ? 1.05 : 1);
        const hid = it.mv.find((v) => v.m === "hide" && v.t <= t), al = hid ? 1 - clamp((t - hid.t) / .35) : 1; if (al <= 0) continue; x.save(); x.globalAlpha *= al;
        const bm = sty.lk?.body || (TUBE ? "outline" : "line"), vb = bm === "volume" ? (sty.body || sty.acc) : (sty.paper || sty.bg);
        if (it.floor !== false) { const xs = [it.x ?? .5, ...it.mv.filter((v) => v.x != null && /_to$/.test(v.m)).map((v) => v.x)]; strokes(x, [jit([[X0 + Math.min(...xs) * SW - U * s, gy + 4 * k], [X0 + Math.max(...xs) * SW + U * s, gy + 4 * k]], it.seed * 3, k)], ap, sty, k, 4); }
        x.save(); x.globalAlpha *= .13 * ap; x.fillStyle = sty.ink; x.beginPath(); x.ellipse(gx, gy + 2 * k, U * s * .9, U * s * .12, 0, 0, 7); x.fill(); x.restore();
        const r = drawAnimal(x, it, m, t, gx, gy, U * s, sty, k, ap, bm, vb); if (ap >= 1) fx(x, m, t, it, r.hc, r.hr, gx, gy, U * s * .6, sty, k);
        if (it.label) label(x, it.label, gx, r.top, ap, sty, k); x.restore(); continue; }
      if (it.k === "man") { const m = manAt(it, t, SW), gx = X0 + m.x * SW, gy = stY + (it.y ?? .92) * stH, CS = CAST[it.who] || null, s = (it.s ?? 1) * (CS?.s || 1);
        if (CS?.stoop && !m.moving) m.pose.b = (m.pose.b || 0) + CS.stoop;
        const hang = (it.mv.filter((v) => v.t <= t && (POSE[v.m] || v.m === "stand")).pop() || {}).m === "hang";
        const hid = it.mv.find((v) => v.m === "hide" && v.t <= t), al = hid ? 1 - clamp((t - hid.t) / .35) : 1; if (al <= 0) continue; x.save(); x.globalAlpha *= al;
        const blink = ((t + it.seed * .77) % (3.1 + (it.seed % 5) * .37)) < .13, mouth = m.state === "talk" ? (ENV ? ENV(t) : (.5 + .5 * Math.sin(t * 17)) * (.5 + .5 * Math.sin(t * 5.3))) : 0;
        const hy = stY + stH * .62, parts = figure(m.pose, gx, hang ? hy : gy, U * s, m.f, m.face, it.wear?.length ? it.wear : CS?.wear, { blink, mouth, hs: CS?.hs }).map((p, i) => jit(p, it.seed * 11 + i * 5, k));
        if (hang) strokes(x, [jit([[gx, stY - 90 * k], [gx, hy - 3.3 * U * s]], it.seed, k)], ap, sty, k, 4);
        if (!hang && it.floor !== false) { const xs = [it.x ?? .5, ...it.mv.filter((v) => v.x != null && /_to$/.test(v.m)).map((v) => v.x)], a = X0 + Math.min(...xs) * SW - 1.25 * U * s, b2 = X0 + Math.max(...xs) * SW + 1.25 * U * s;
          strokes(x, [jit([[a, gy + 4 * k], [b2, gy + 4 * k]], it.seed * 3, k)], ap, sty, k, 4); }
        if (!hang) { x.save(); x.globalAlpha *= .13 * ap; x.fillStyle = sty.ink; x.beginPath(); x.ellipse(gx, gy + 2 * k, U * s * .8, U * s * .12, 0, 0, 7); x.fill(); x.restore(); }
        const bm = sty.lk?.body || (TUBE ? "outline" : "line"), vb = bm === "volume" ? (sty.body || sty.acc) : (sty.paper || sty.bg);
        if (bm !== "line") { const bw = (bm === "volume" ? 18 : 15) * s, inner = { ...sty, ink: vb, glow: null }, tube = (L2, w) => { strokes(x, L2, ap, sty, k, w); strokes(x, L2, ap, inner, k, w - 9); };
          tube([parts[4], parts[5]], bw); tube([parts[0]], bw * 1.9); tube([parts[2], parts[3]], bw * .9);
          // світло з лівого верху — об'єм
          if (bm === "volume" && ap > .5) { const hl = { ...sty, ink: lumOf(vb) > .75 ? "rgba(0,0,0,.12)" : "rgba(255,255,255,.4)", glow: null, lk: { ...sty.lk, lw: 1 } }, ofs = (L2, f) => L2.map((p) => p.map(([a, b]) => [a - bw * f * k, b - bw * f * .6 * k]));
            x.save(); x.globalAlpha *= clamp((ap - .5) * 2); if (lumOf(vb) > .75) { strokes(x, ofs([parts[0]], -.3), 1, hl, k, bw * .5); strokes(x, ofs([parts[4], parts[5], parts[2], parts[3]], -.14), 1, hl, k, bw * .22); }
            else { strokes(x, ofs([parts[0]], .3), 1, hl, k, bw * .45); strokes(x, ofs([parts[4], parts[5], parts[2], parts[3]], .14), 1, hl, k, bw * .2); } x.restore(); } }
        else strokes(x, [parts[0], parts[2], parts[3], parts[4], parts[5]], ap, sty, k, 6);
        { const hp = parts[1], hc2 = hp.reduce((a, q) => [a[0] + q[0] / hp.length, a[1] + q[1] / hp.length], [0, 0]), hr = Math.hypot(hp[0][0] - hc2[0], hp[0][1] - hc2[1]);
          if (ap > .3) { x.save(); x.fillStyle = vb; x.beginPath(); x.arc(hc2[0], hc2[1], hr, 0, 7); x.fill();
            if (bm === "volume") { x.globalAlpha *= .9; const g = x.createRadialGradient(hc2[0] - hr * .4, hc2[1] - hr * .45, hr * .1, hc2[0], hc2[1], hr * 1.05); g.addColorStop(0, lumOf(vb) > .75 ? "rgba(255,255,255,0)" : "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(0,0,0,.18)"); x.fillStyle = g; x.beginPath(); x.arc(hc2[0], hc2[1], hr, 0, 7); x.fill(); }
            x.restore(); }
          strokes(x, [hp], ap, sty, k, bm === "line" ? 6 : 6.5); strokes(x, parts.slice(6), ap, sty, k, 5);
          if (ap >= 1) fx(x, m, t, it, hc2, hr, gx, gy, U * s, sty, k); }
        if (it.label && !hang) label(x, it.label, gx, gy - (4.15 + ((CS?.hs || 1) - 1) * .9) * U * s, ap, sty, k);
        x.restore(); continue; }
      // репліка / думка в бульбашці
      if (it.k === "say" || it.k === "thinkb") { const p = propAt(it, t); if (p.alpha <= 0) continue; const cx = X0 + p.x * SW, cy = stY + p.y * stH; x.save(); x.globalAlpha *= p.alpha;
        x.font = `800 ${Math.round(46 * k * p.s)}px "${sty.font}", system-ui, sans-serif`; const tx = String(it.t || ""), tw = Math.min(SW * .8, x.measureText(tx).width), w = tw + 60 * k, h = 96 * k * p.s, r = h * .45;
        const sp = clamp(ap * 1.2), bx = cx - w / 2, by = cy - h / 2, path = [...arc(bx + r, by + r, r, 180, 270, 6), ...arc(bx + w - r, by + r, r, 270, 360, 6), ...arc(bx + w - r, by + h - r, r, 0, 90, 6), ...(it.k === "say" ? [[cx + 18 * k, by + h], [cx - 26 * k, by + h + 46 * k], [cx - 18 * k, by + h]] : []), ...arc(bx + r, by + h - r, r, 90, 180, 6)]; path.push(path[0]);
        if (it.k === "thinkb") { strokes(x, [jit(arc(cx - 30 * k, by + h + 30 * k, 12 * k, 0, 360, 10), it.seed, k), jit(arc(cx - 50 * k, by + h + 62 * k, 7 * k, 0, 360, 8), it.seed + 1, k)], sp, sty, k, 4); }
        strokes(x, [jit(path, it.seed * 7, k)], sp, sty, k, 4.5); x.globalAlpha *= clamp((ap - .4) * 2.5); x.fillStyle = it.acc ? sty.acc : sty.ink; x.textAlign = "center"; x.textBaseline = "middle"; if (sty.glow) { x.shadowColor = sty.glow; x.shadowBlur = 12 * k; } x.fillText(tx, cx, cy + 3 * k, SW * .8); x.restore(); continue; }
      // лічильник: число росте (0 → 8 років)
      if (it.k === "count") { const p = propAt(it, t); if (p.alpha <= 0) continue; const v = (+it.from || 0) + ((+it.to || 0) - (+it.from || 0)) * ease(clamp((t - it.ta) / 1.3)), txt = `${Math.round(v)}${it.t ? " " + it.t : ""}`;
        x.save(); x.globalAlpha *= p.alpha * clamp(ap * 2); x.translate(X0 + p.x * SW, stY + p.y * stH); x.scale(p.s, p.s); x.font = `900 ${Math.round(110 * k)}px "${sty.font}", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
        x.fillStyle = it.acc === false ? sty.ink : sty.acc; if (sty.glow) { x.shadowColor = sty.acc; x.shadowBlur = 20 * k; } x.fillText(txt, 0, 0); x.restore(); continue; }
      if (it.k === "text") { const p = propAt(it, t); x.save(); x.globalAlpha *= p.alpha * clamp(ap * 1.6); x.translate(X0 + p.x * SW, stY + p.y * stH); x.rotate(p.rot); x.scale(p.s, p.s);
        x.font = `800 ${Math.round(96 * k)}px "${sty.font}", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; const tw = x.measureText(it.t || "").width;
        x.beginPath(); x.rect(-tw / 2 - 10 * k, -80 * k, (tw + 20 * k) * clamp(ap * 1.3), 160 * k); x.clip(); x.fillStyle = it.acc ? sty.acc : sty.ink; if (sty.glow) { x.shadowColor = it.acc ? sty.acc : sty.glow; x.shadowBlur = 20 * k; } x.fillText(it.t || "", 0, 0); x.restore(); continue; }
      const fnS = SH[it.k] || (it.k === "icon" ? iconShape(it) : null); if (!fnS) continue; const p = propAt(it, t), sz = 135 * k * p.s, cx = X0 + p.x * SW, gY = stY + .92 * stH;
      const cy = it.k === "wall" ? gY - 1.6 * sz : it.k === "desk" ? gY - .9 * sz : stY + p.y * stH;
      if (it.k === "lamp") { const ty = stY - 60 * k, w = 70 * k * p.s; const on = clamp((t - it.ta - .3) / .4);
        strokes(x, [jit([[cx, ty - 60 * k], [cx, ty]], it.seed, k), jit([[cx - w * .45, ty], [cx + w * .45, ty], [cx + w * .7, ty + 50 * k], [cx - w * .7, ty + 50 * k], [cx - w * .45, ty]], it.seed + 1, k)], ap, sty, k, 5);
        if (on > 0) { x.save(); x.globalAlpha *= on; strokes(x, [jit([[cx - w * .7, ty + 50 * k], [cx - 1.7 * w * p.s * 1.6, gY]], it.seed + 2, k), jit([[cx + w * .7, ty + 50 * k], [cx + 1.7 * w * p.s * 1.6, gY]], it.seed + 3, k)], 1, sty, k, 3.5); x.restore(); }
        continue; }
      const FL = new Set(["money", "coins", "coin", "heart", "star", "question", "exclaim", "bulb", "cloud", "tab", "card", "hryvnia", "mail", "globe", "trophy"]), app = ap < 1 ? .82 + .18 * back(ap) : 1, fy = FL.has(it.k) ? Math.sin(t * 1.7 + it.seed) * 6 * k : 0;
      const sz2 = sz * app; void sz2;
      let list = fnS(it).map((pp) => pp.map(([a, b]) => { const ca = Math.cos(p.rot), sa = Math.sin(p.rot); return [cx + (a * ca - b * sa) * sz * app, cy + fy + (a * sa + b * ca) * sz * app]; }));
      if (it.k === "cup" || it.k === "house") { const bx = it.k === "cup" ? cx : cx + .5 * sz, by = it.k === "cup" ? cy - .4 * sz : cy - .9 * sz; [0, 1].forEach((i) => { const ph = (t * .7 + i * .5) % 1; list.push(Array.from({ length: 8 }, (_, j) => [bx + (i ? .18 : -.12) * sz + Math.sin(j * .9 + t * 3 + i) * .08 * sz, by - (ph * .5 + j * .08) * sz])); }); }
      if (["money", "coins", "coin", "bag", "trophy", "star", "hryvnia"].includes(it.k) && t - it.ta > .2 && t - it.ta < 1.6) { const q = (t - it.ta - .2) / 1.4; list.push(...[0, 1, 2].map((i) => star4(cx + Math.cos(i * 2.1 + 1) * sz * 1.1, cy + Math.sin(i * 2.1 + 1) * sz * .8, sz * .22 * Math.sin(q * Math.PI)))); }
      if (it.k === "clock") { const a1 = t * 2, a2 = t * .2; list.push([[cx, cy], [cx + Math.sin(a1) * sz * .7, cy - Math.cos(a1) * sz * .7]], [[cx, cy], [cx + Math.sin(a2) * sz * .45, cy - Math.cos(a2) * sz * .45]]); }
      x.save(); x.globalAlpha *= p.alpha; strokes(x, list.map((pp, i) => jit(pp, it.seed * 13 + i * 3, k)), ap, it.acc ? { ...sty, ink: sty.acc } : sty, k, 5);
      // напис на предметі (картка «ЗАДАЧА», «?» у вкладці) і підпис під/над ним (поле sub: «5 хвилин», «+6 год»)
      if ((it.t && (it.k === "card" || it.k === "tab")) || it.sub) { x.globalAlpha *= clamp((ap - .5) * 2); x.fillStyle = it.acc ? sty.acc : sty.ink; x.textAlign = "center"; x.textBaseline = "middle"; if (sty.glow) { x.shadowColor = sty.glow; x.shadowBlur = 12 * k; }
        if (it.t && (it.k === "card" || it.k === "tab")) { x.font = `800 ${Math.round((it.k === "tab" ? 60 : 40) * k * p.s)}px "Manrope", system-ui, sans-serif`; x.fillText(String(it.t).toUpperCase(), cx, cy + (it.k === "tab" ? .16 : -.24) * sz, 1.8 * sz); }
        if (it.sub) { x.font = `700 ${Math.round(32 * k)}px "Manrope", system-ui, sans-serif`; x.fillText(String(it.sub), cx, it.k === "clock" ? cy + 1.25 * sz : cy - (it.k === "wall" ? 1.85 : .85) * sz, 2.4 * sz); } }
      if (it.label) label(x, it.label, cx, cy + (it.k === "wall" ? 1.85 : it.k === "desk" ? 1.15 : 1.2) * sz, ap, sty, k);
      x.restore(); }
  }
  function drawScene(x, q, t, W, H, sty, k, fade = 1) {
    const top = 200 * k, stH = 900 * k, stY = 400 * k, U = 118 * k;
    x.save(); x.globalAlpha = fade;
    // заголовок у рамці + «стеля» зі штрихами
    if (q.s.title && !L.title) { const pr = clamp((t - q.t0) / .5); x.font = `800 ${Math.round(74 * k)}px "${sty.font}", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
      const tt = String(q.s.title).toUpperCase(), tw = Math.min(W * .86, x.measureText(tt).width + 90 * k), bh = 130 * k, bx = (W - tw) / 2, by = top - bh / 2;
      strokes(x, [jit(rect(bx, by, tw, bh), q.n * 5, k)], pr, sty, k, 4.5);
      x.save(); x.globalAlpha *= clamp((t - q.t0 - .2) / .3); x.fillStyle = sty.ink; if (sty.glow) { x.shadowColor = sty.glow; x.shadowBlur = 18 * k; } x.fillText(tt, W / 2, top + 4 * k, tw - 50 * k); x.restore();
      const ly = top + bh / 2 + 42 * k, ticks = []; for (let i = 0; i < 10; i++) { const tx = W * .1 + i * W * .088; ticks.push(jit([[tx, ly], [tx + 26 * k, ly + 26 * k]], q.n * 9 + i, k)); }
      strokes(x, [jit([[W * .06, ly], [W * .94, ly]], q.n * 7, k), ...ticks], clamp((t - q.t0 - .15) / .5), sty, k, 3.5); }
    { const zz = 1 + .045 * clamp((t - q.t0) / Math.max(1, q.t1 - q.t0)), cY = stY + stH * .6; x.save(); x.translate(W / 2, cY); x.scale(zz, zz); x.translate(-W / 2, -cY);
      if (q.s.place) drawPlace(x, q.s.place, t, sty, k, { X0: 0, SW: W, stY, stH }, clamp((t - q.t0) / .6));
      drawItems(x, q.items, t, { ...sty, paper: sty.bg }, k, { X0: 0, SW: W, stY, stH, U }); x.restore(); }
    // плашка сцени (з розкадровки): з'являється з пружинкою
    if (q.s.plaque && sty.lk.plaque !== "none") drawPlaque(x, q.s.plaque, q.s.color, t - q.t0 - .15, W, k, sty);
    const cap = sty.lk.fig === false ? "" : L.title ? (q.s.title || q.s.caption) : (q.s.caption || q.s.title); if (cap) { const cy = stY + stH + 64 * k; x.save(); x.globalAlpha *= clamp((t - q.t0 - .3) / .4); x.font = `700 ${Math.round(34 * k)}px "Manrope", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = sty.ink;
      const ct = `ФІГ. ${q.n} — ${String(cap).toUpperCase()}`; x.globalAlpha *= .75; x.fillText(ct, W / 2, cy, W * .85); const cw = Math.min(W * .85, x.measureText(ct).width); x.fillRect((W - cw) / 2, cy + 28 * k, cw, 2.5 * k); x.restore(); }
    x.restore();
  }
  const rrp = (x, a, b, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(a, b, w, h, r) : x.rect(a, b, w, h); };
  function drawPlaque(x, txt, col, lt, W, k, sty, cy0) {
    if (lt <= 0) return; const v = sty.lk.plaque, c = colOf(col, sty.lk), p = clamp(lt / .35), sc = .55 + .45 * back(p), cy = cy0 ?? 335 * k;
    if (v === "punch") return drawPunch(x, txt, col, lt, W, k, sty, cy);
    const font = v === "sticker" ? "Caveat" : v === "marker" ? "Pangolin" : sty.font, px = Math.round((v === "sticker" ? 70 : 54) * k);
    x.save(); x.font = `${v === "marker" || v === "sticker" ? 400 : 800} ${px}px "${font}", system-ui, sans-serif`; const tx = v === "pill" || v === "neon" ? String(txt).toUpperCase() : String(txt);
    const tw = Math.min(W * .8, x.measureText(tx).width), w = tw + 64 * k, h = px * 1.55; x.translate(W / 2, cy); x.rotate(v === "sticker" ? -.035 : v === "marker" ? -.02 : 0); x.scale(sc, sc); x.globalAlpha *= clamp(p * 2);
    x.textAlign = "center"; x.textBaseline = "middle";
    if (v === "marker") { x.fillStyle = c; rrp(x, -w / 2, -h / 2, w, h, h * .32); x.fill(); x.lineWidth = 4 * k; x.strokeStyle = "rgba(0,0,0,.55)"; x.stroke(); x.fillStyle = lumOf(c) > .6 ? "#141414" : "#ffffff"; }
    else if (v === "pill") { x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 24 * k; x.shadowOffsetY = 8 * k; x.fillStyle = "#ffffff"; rrp(x, -w / 2, -h / 2, w, h, h / 2); x.fill(); x.shadowColor = "transparent"; x.fillStyle = c; rrp(x, -w / 2 + 14 * k, -10 * k, 14 * k, 20 * k, 7 * k); x.fill(); x.fillStyle = "#111111"; }
    else if (v === "neon") { x.shadowColor = c; x.shadowBlur = 26 * k; x.lineWidth = 5 * k; x.strokeStyle = c; rrp(x, -w / 2, -h / 2, w, h, 14 * k); x.stroke(); x.fillStyle = "#ffffff"; }
    else if (v === "sticker") { x.shadowColor = "rgba(0,0,0,.3)"; x.shadowBlur = 18 * k; x.shadowOffsetY = 10 * k; x.fillStyle = lumOf(c) > .8 ? c : mixW(c, .62); x.fillRect(-w / 2, -h / 2, w, h); x.shadowColor = "transparent"; x.fillStyle = "rgba(255,255,255,.55)"; x.fillRect(-40 * k, -h / 2 - 14 * k, 80 * k, 26 * k); x.fillStyle = "#1d1d1f"; }
    x.fillText(tx, 0, 3 * k, W * .8); x.restore();
  }
  // «Великий текст» — як на прев'ю YouTube: жирно, з обводкою, «вбивається» в кадр
  function drawPunch(x, txt, col, lt, W, k, sty, cy) {
    const c = colOf(col, sty.lk), p = clamp(lt / .28), sc = p < 1 ? 1.45 - .45 * ease(p) : 1, sh = lt < .45 ? Math.sin(lt * 70) * 5 * k * (1 - lt / .45) : 0;
    let px = Math.round(104 * k); const tx = String(txt).toUpperCase(), fnt = (n) => `900 ${n}px "Unbounded", "Manrope", system-ui, sans-serif`;
    x.save(); x.font = fnt(px); const maxW = W * .86, ws = tx.split(/\s+/); let lines = [tx];
    if (x.measureText(tx).width > maxW && ws.length > 1) { let best = null; for (let i = 1; i < ws.length; i++) { const a = ws.slice(0, i).join(" "), b = ws.slice(i).join(" "), m = Math.max(x.measureText(a).width, x.measureText(b).width); if (!best || m < best.m) best = { m, l: [a, b] }; } lines = best.l; }
    const mw = Math.max(...lines.map((l) => x.measureText(l).width)); if (mw > maxW) { px = Math.floor(px * maxW / mw); x.font = fnt(px); }
    x.translate(W / 2 + sh, cy); x.rotate(-.045); x.scale(sc, sc); x.globalAlpha *= clamp(p * 3); x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
    const lh = px * 1.08, y0 = -(lines.length - 1) * lh / 2;
    // підкладка-мазок кольором під останнім рядком
    const lw2 = x.measureText(lines[lines.length - 1]).width; x.fillStyle = c; x.globalAlpha *= .95; x.beginPath(); x.moveTo(-lw2 / 2 - 22 * k, y0 + (lines.length - 1) * lh + px * .22); x.lineTo(lw2 / 2 + 26 * k, y0 + (lines.length - 1) * lh + px * .12); x.lineTo(lw2 / 2 + 18 * k, y0 + (lines.length - 1) * lh + px * .5); x.lineTo(-lw2 / 2 - 14 * k, y0 + (lines.length - 1) * lh + px * .58); x.closePath(); x.fill();
    lines.forEach((l, i) => { const y = y0 + i * lh; x.shadowColor = "rgba(0,0,0,.45)"; x.shadowOffsetY = 9 * k; x.shadowBlur = 0; x.lineWidth = 17 * k; x.strokeStyle = "#0b0b0d"; x.strokeText(l, 0, y); x.shadowColor = "transparent";
      x.fillStyle = "#ffffff"; x.fillText(l, 0, y); });
    x.restore();
  }
  // фрази, що вистрибують (L.pops): з'являються на своєму слові й зникають
  function drawPops(x, t, W, k, sty) {
    if (!L.pops?.length || sty.lk.plaque === "none") return; const q = L.pops.find((o) => t >= o.at && t < o.at + o.d); if (!q) return;
    x.save(); x.globalAlpha *= clamp((q.at + q.d - t) / .25); drawPlaque(x, q.t, q.c, t - q.at, W, k, sty, L.wide ? 300 * k : L.title && sty.lk.frame !== "hide" && sty.lk.plaque === "punch" ? 420 * k : 335 * k); x.restore();
  }
  // вставки фото (L.ins): «фото-картка» вилітає, тримається і зникає; лінії — рамка в тому ж стилі
  const INSIMG = new Map();
  function drawIns(x, t, W, H, k, sty) {
    if (!L.ins?.length || L.opt?.ins === false) return; const q = L.ins.find((o) => t >= o.at && t < o.at + o.d); if (!q) return; const im = INSIMG.get(q.src); if (!im) return;
    const wide = !!L.wide, cw = (wide ? 640 : 700) * k, ch = (wide ? 430 : 520) * k, cx = wide ? W * .73 : W / 2, cy = wide ? 430 * k : 800 * k;
    const p = clamp((t - q.at) / .4), o = clamp((q.at + q.d - t) / .3), sc = (.55 + .45 * back(p)) * (.85 + .15 * o), rot = (rnd(q.at * 7, 3) - .5) * .09;
    x.save(); x.globalAlpha *= clamp(p * 3) * o; x.translate(cx, cy); x.rotate(rot); x.scale(sc, sc);
    const b = 16 * k, iw = cw - b * 2, ih = ch - b * 2 - 30 * k; x.shadowColor = "rgba(0,0,0,.4)"; x.shadowBlur = 30 * k; x.shadowOffsetY = 12 * k; x.fillStyle = "#ffffff"; x.fillRect(-cw / 2, -ch / 2, cw, ch); x.shadowColor = "transparent";
    const sw = im.naturalWidth || im.width, shh = im.naturalHeight || im.height, r = Math.max(iw / sw, ih / shh), dw = iw / r, dh = ih / r, zz = 1 + .06 * clamp((t - q.at) / q.d);
    try { x.drawImage(im, (sw - dw / zz) / 2, (shh - dh / zz) / 2, dw / zz, dh / zz, -cw / 2 + b, -ch / 2 + b, iw, ih); } catch (e) {}
    x.restore();
    x.save(); x.globalAlpha *= clamp(p * 3) * o; x.translate(cx, cy); x.rotate(rot); x.scale(sc, sc); strokes(x, [jit(rect(-cw / 2 - 10 * k, -ch / 2 - 10 * k, cw + 20 * k, ch + 20 * k), 41, k)], clamp(p * 1.4), { ...sty, glow: null }, k, 3); x.restore();
  }
  function drawTitle(x, t, W, k, sty) {
    const top = 200 * k, v = sty.lk.frame, pr = clamp(t / .6); x.font = `800 ${Math.round(74 * k)}px "${sty.font}", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
    const tt = String(L.title).toUpperCase(), tw = Math.min(W * .88, x.measureText(tt).width + 90 * k), bh = 130 * k, bx = (W - tw) / 2;
    if (v === "box") strokes(x, [jit(rect(bx, top - bh / 2, tw, bh), 5, k)], pr, sty, k, 4.5);
    else if (v === "under") strokes(x, [jit([[bx + 30 * k, top + 52 * k], [bx + tw - 30 * k, top + 52 * k]], 5, k)], pr, sty, k, 5);
    else if (v === "pill") { x.save(); x.globalAlpha = clamp(t / .35); x.fillStyle = sty.ink; rrp(x, bx, top - bh / 2, tw, bh, bh / 2); x.fill(); x.restore(); }
    x.save(); x.globalAlpha = clamp((t - .25) / .3); x.fillStyle = v === "pill" ? sty.bg : sty.ink; if (sty.glow && v !== "pill") { x.shadowColor = sty.glow; x.shadowBlur = 18 * k; } x.fillText(tt, W / 2, top + 4 * k, tw - 50 * k); x.restore();
  }
  function drawSubs(x, t, W, H, sty, k) {
    if (L.cta && t > TOT - 3) { x.save(); x.globalAlpha = clamp((t - (TOT - 3)) / .4) * .8; x.font = `700 ${Math.round(38 * k)}px "Manrope", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = sty.ink; x.fillText(L.cta, W / 2, 1640 * k, W * .86); x.restore(); }
    const sv = sty.lk.subs; if (L.subs === false || sv === "off") return; const ch = CH.find((c) => t >= c.s - .05 && t < c.until); if (!ch) return;
    const hand = sv === "hand", up = sv === "yellow", px = Math.round((hand ? 74 : sv === "minimal" ? 46 : 58) * k), lh = px * 1.22; x.font = `${hand ? 600 : sv === "minimal" ? 600 : 800} ${px}px "${hand ? "Caveat" : "Manrope"}", system-ui, sans-serif`; x.textBaseline = "middle"; x.textAlign = "left";
    const ws = ch.idx.map((i) => ({ i, t: up ? L.words[i].w.toUpperCase() : L.words[i].w })), sp = x.measureText(" ").width, maxW = W * .84; ws.forEach((w) => w.w = x.measureText(w.t).width);
    const lines = [[]]; let lw = 0; ws.forEach((w) => { if (lines[lines.length - 1].length && lw + sp + w.w > maxW) { lines.push([]); lw = 0; } lines[lines.length - 1].push(w); lw += (lw ? sp : 0) + w.w; });
    x.save(); x.globalAlpha = clamp((t - ch.s + .05) / .15);
    lines.forEach((Ln, li) => { const tw = Ln.reduce((a, w) => a + w.w, 0) + sp * (Ln.length - 1), y = 1478 * k + li * lh; let xx = (W - tw) / 2;
      if (sv === "box") { x.save(); x.fillStyle = "rgba(0,0,0,.72)"; rrp(x, (W - tw) / 2 - 22 * k, y - lh / 2, tw + 44 * k, lh, 14 * k); x.fill(); x.restore(); }
      Ln.forEach((w) => { const cur = sv !== "minimal" && t >= L.words[w.i].s - .03 && t < L.words[w.i].e + .1; x.fillStyle = sv === "box" ? (cur ? "#ffd60a" : "#ffffff") : up ? (cur ? "#ffd60a" : "#ffffff") : cur ? sty.acc : sty.ink;
        if (up) { x.lineWidth = 9 * k; x.strokeStyle = "#000000"; x.lineJoin = "round"; x.strokeText(w.t, xx, y); }
        else if (sv === "box") {}
        else if (sty.glow) { x.shadowColor = cur ? sty.acc : sty.glow; x.shadowBlur = 14 * k; } else { x.lineWidth = 7 * k; x.strokeStyle = sty.bg; x.lineJoin = "round"; x.strokeText(w.t, xx, y); }
        x.fillText(w.t, xx, y); x.shadowBlur = 0; xx += w.w + sp; }); });
    x.restore();
  }
  function paintBg(x, W, H, k, sty) {
    if (sty.grad) { const g = x.createLinearGradient(0, 0, W * .3, H); g.addColorStop(0, sty.grad[0]); g.addColorStop(1, sty.grad[1]); x.fillStyle = g; } else x.fillStyle = sty.bg; x.fillRect(0, 0, W, H);
    if (sty.grid === "lines") { x.strokeStyle = sty.gc; x.lineWidth = 1.5 * k; x.beginPath(); for (let gx = 0; gx <= W; gx += 54 * k) { x.moveTo(gx, 0); x.lineTo(gx, H); } for (let gy = 0; gy <= H; gy += 54 * k) { x.moveTo(0, gy); x.lineTo(W, gy); } x.stroke(); }
    else if (sty.grid === "dots") { x.fillStyle = sty.gc; for (let gx = 27 * k; gx <= W; gx += 54 * k) for (let gy = 27 * k; gy <= H; gy += 54 * k) x.fillRect(gx - 2 * k, gy - 2 * k, 4 * k, 4 * k); }
    else if (sty.grid === "notebook") { x.strokeStyle = sty.gc; x.lineWidth = 2 * k; x.beginPath(); for (let gy = 90 * k; gy <= H; gy += 60 * k) { x.moveTo(0, gy); x.lineTo(W, gy); } x.stroke(); x.strokeStyle = "rgba(220,60,60,.35)"; x.beginPath(); x.moveTo(110 * k, 0); x.lineTo(110 * k, H); x.stroke(); }
    if (sty.tex) { for (let i = 0; i < 260; i++) { const a = rnd(i, 3) * W, b = rnd(i, 7) * H, r = (sty.tex === "chalk" ? 30 + rnd(i, 9) * 120 : 1 + rnd(i, 9) * 2.5) * k;
      x.fillStyle = sty.tex === "chalk" ? `rgba(255,255,255,${.012 + rnd(i, 11) * .02})` : `rgba(0,0,0,${.04 + rnd(i, 11) * .06})`; x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); } }
  }
  function drawFrame(x, t, W, H) {
    if (L.world) return drawWide(x, t, W, H);
    const sty = styOf(), k = W / OW; BOIL = Math.floor(t * 8); NOBOIL = sty.lk.boil === false;
    paintBg(x, W, H, k, sty);
    if (sty.vig) { const g = x.createRadialGradient(W / 2, H * .4, H * .1, W / 2, H * .45, H * .75); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.6)"); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    // один заголовок на весь ролик + лінія-розділювач над підписом
    if (L.title && sty.lk.frame !== "hide") drawTitle(x, t, W, k, sty);
    strokes(x, [jit([[0, 1310 * k], [W, 1310 * k]], 77, k)], clamp(t / .8), sty, k, 3);
    const i = ST.findIndex((q) => t >= q.t0 && t < q.t1); if (i >= 0) { const q = ST[i], d = t - q.t0;
      if (i > 0 && d < .25) drawScene(x, ST[i - 1], t, W, H, sty, k, 1 - d / .25);
      drawScene(x, q, t, W, H, sty, k, i > 0 ? clamp(d / .2) : 1); }
    drawIns(x, t, W, H, k, sty); drawPops(x, t, W, k, sty);
    drawSubs(x, t, W, H, sty, k);
  }

  /* ---------- AI: сцени з деталей ---------- */
  const numbered = () => L.words.map((w, i) => `${i}:${w.w}`).join(" ");
  const CASTSPEC = `Люди: "man" з полем who — man, woman, girl, boy, baby, grandma, grandpa, boss (вік і стать видно одразу; може бути кілька людей у сцені). Тварини — окремі деталі, рухаються тими самими рухами, що й людина (walk_to, run_to, jump, sit, sad, cheer, talk — гавкає/нявкає, fall — лягає): dog, cat, fox, rabbit, mouse, bear, horse, pig, cow, sheep, bird (bird при walk_to/jump летить). БУДЬ-ЯКИЙ інший предмет пиши в k англійським словом (pizza, guitar, tractor, umbrella, laptop, bus, tree, cake…) — він є серед 5000 малюнків-ліній; не вигадуй дивних назв, бери прості іменники.`;
  const SPEC = `${CASTSPEC}
Місце сцени — поле place у сцені (бліді декорації позаду): ${Object.keys(PLACESETS).join(", ")} або без place.
Деталі: "man" — чоловічок-паличка (x — 0…1 по ширині, y — земля 0…1, зазвичай 0.92; f — 1 дивиться вправо, -1 вліво); face — "neutral"|"happy"|"sad" (обличчя за замовчуванням); предмети: ${KINDS.join(", ")} (x, y — центр 0…1; s — розмір 0.6…2; acc:true — акцентний колір; t — слово на картці card («ЗАДАЧА») або «?»/«!» у вкладці tab; sub — маленький підпис біля предмета, напр. «5 хвилин», «+6 год»; wall і desk стоять на землі; lamp — лампа зверху зі світлом на людину, став по x людини); "text" — короткий напис до 3 слів або число («500 грн», «x10»), поле t. Кілька tab навколо людини — «багато вкладок у голові».
Рухи (moves: [{"i":номер слова, коли почати,"m":рух, ...}]): для man — talk (говорить; став разом із say), walk_to (x), run_to (x), jump, wave, cheer, think, point, shrug, sad, sit, stand, fall, hang (висить догори ногами), dance, push (штовхає стіну — став wall впритул спереду), work (сидить і працює за desk), shock, happy_face, sad_face; для предметів і написів — pop, bounce, spin, shake, fly_to (x, y), grow, hide. Поле "at" — номер слова, коли деталь з'являється (інакше — на початку сцени).`;
  async function aiScenes(extra = "") {
    const r = await sample.json(`Ти режисер коротких анімаційних відео в стилі «малюнок лініями» (як інструкція-креслення, але з гумором). Людина говорить за кадром — ось дослівні слова з номерами:
${numbered()}
${extra}
Придумай title — заголовок усього ролика в рамці зверху, 2–4 слова (суть, як «СДВГ — це дивно»), і cta — заклик у кінці до 5 слів («Збережи, якщо впізнав себе»).
Розбий на сцени: одна сцена — одна думка, 3–8 секунд, по черзі на весь ролик, перша починається зі слова 0. Для кожної сцени: a — номер слова початку; title — назва цієї «фігури» 2–4 слова (буде «ФІГ. N — назва»), конкретна й з гумором («47 відкритих вкладок», «Невидима стіна»); items — 1–4 деталі, які наочно й смішно показують думку: майже завжди чоловічок, що щось робить, і 1–2 предмети або напис. Рухи став точно на ті слова, про які йдеться. Не захаращуй: простота й рух важливіші.
${SPEC}
Відповідай тільки JSON: {"title":"…","cta":"…","scenes":[{"a":0,"title":"…","items":[{"k":"man","x":0.3,"y":0.92,"moves":[{"i":3,"m":"walk_to","x":0.6}]},{"k":"money","x":0.75,"y":0.5,"at":5,"moves":[{"i":5,"m":"pop"}]}]}]}`, { cache: false, kb: true, max: 4000 });
    const sc = normalize(r?.scenes || []); if (!sc.length) throw new Error("plan");
    if (typeof r?.title === "string") L.title = r.title.slice(0, 32); if (typeof r?.cta === "string") L.cta = r.cta.slice(0, 48); return sc;
  }
  async function aiEdit(text) {
    const r = await sample.json(`Ти режисер анімації лініями. Слова озвучки з номерами:
${numbered()}
Заголовок ролика: «${L.title || ""}», заклик у кінці: «${L.cta || ""}». Поточні сцени (JSON): ${JSON.stringify(L.scenes)}
${SPEC}
Людина просить змінити: «${text}». Зміни лише те, про що просять (додай/прибери деталі, рухи, заголовки, перестав сцени). Якщо просить змінити фон/стиль — поле "style": один з ${Object.entries(THEMES).map(([k, v]) => `${k} (${v.n})`).join(", ")}; субтитри — "subs":true|false.
Відповідай тільки JSON: {"title":"…","cta":"…","scenes":[…повний новий список…],"style":"…","subs":true,"say":"одне коротке речення — що зроблено"}`, { cache: false, kb: true, max: 4000 });
    if (Array.isArray(r?.scenes) && r.scenes.length) { const sc = normalize(r.scenes); if (sc.length) L.scenes = sc; }
    if (typeof r?.title === "string") L.title = r.title.slice(0, 32); if (typeof r?.cta === "string") L.cta = r.cta.slice(0, 48);
    if (r?.style && STYLES[r.style]) L.style = r.style; if (typeof r?.subs === "boolean") L.subs = r.subs;
    return r?.say || "Готово.";
  }
  function normalize(list) { const n = L.words.length, okI = (v) => Number.isInteger(v) && v >= 0 && v < n;
    return (Array.isArray(list) ? list : []).filter((s) => s && okI(s.a)).sort((a, b) => a.a - b.a).slice(0, 40).map((s) => ({ a: s.a, title: String(s.title || "").slice(0, 32), caption: String(s.caption || "").slice(0, 40), plaque: s.plaque ? String(s.plaque).slice(0, 40) : "", color: PLC[s.color] ? s.color : "red",
      place: PLACESETS[s.place] ? s.place : undefined, items: (s.items || []).map(fixK).filter((it) => it && (it.k === "man" || it.k === "text" || it.k === "icon" || SH[it.k] || ANIM[it.k])).slice(0, 6).map((it) => ({ k: it.k, ...WHO(it), x: clamp(+it.x || .5, .05, .95), y: clamp(it.y == null ? (it.k === "man" || ANIM[it.k] ? (ANIM[it.k]?.bird ? .92 : .92) : .5) : +it.y, .05, .98), s: clamp(+it.s || 1, .4, 2.4), f: +it.f === -1 ? -1 : 1, acc: !!it.acc, t: ["text", "card", "tab"].includes(it.k) && it.t ? String(it.t).slice(0, 18) : undefined, sub: it.sub ? String(it.sub).slice(0, 18) : undefined, face: ["neutral", "happy", "sad"].includes(it.face) ? it.face : undefined, at: okI(it.at) ? it.at : undefined,
        moves: (it.moves || []).filter((m) => m && okI(m.i) && MOVES.includes(m.m)).slice(0, 6).map((m) => ({ i: m.i, m: m.m, x: m.x != null ? clamp(+m.x, .05, .95) : undefined, y: m.y != null ? clamp(+m.y, .05, .95) : undefined })) })) })); }

  /* ---------- AI: фрази, що вистрибують, і фото-вставки ---------- */
  const phrasesIdx = () => { const P = []; let c = null; L.words.forEach((w, i) => { if (!c) c = { i, t: w.w }; else c.t += " " + w.w; if (/[.!?…]$/.test(w.w) || c.t.split(" ").length > 18) { P.push(c); c = null; } }); c && P.push(c); return P; };
  async function aiExtras(want) {
    if (!want.pops && !want.ins) return; const n = L.words.length, wide = !!L.wide;
    const nP = wide ? clamp(Math.round(TOT / 25), 3, 24) : clamp(Math.round(TOT / 11), 3, 8), nI = wide ? clamp(Math.round(TOT / 45), 2, 12) : clamp(Math.round(TOT / 18), 2, 5);
    const txt = phrasesIdx().map((p) => `[${p.i}] ${p.t}`).join("\n").slice(0, 9500);
    const r = await sample.json(`Ти монтажер коротких відео. Текст озвучки по фразах, у дужках — номер першого слова фрази:
${txt}
${want.pops ? `pops — ${nP} фраз, що ВИСТРИБУЮТЬ великим текстом на екрані на ключових моментах: 1–4 слова, суть або число («500 ГРН ЗА ВІДЕО», «НЕ ЧЕКАЙ»), гачок на початку, не дублюй дослівно субтитри. i — номер слова, на якому фраза з'являється (можна з дужок або трохи далі, але < ${n}). c — колір: yellow (головне), green (результат, плюс), red (помилка, мінус), blue, purple, orange.` : ""}
${want.ins ? `ins — ${nI} вставок-ФОТО до наочних слів (предмет, місце, людина, дія): i — номер слова; q — 2–4 англійські слова для пошуку стокового фото (наприклад «woman laptop cafe», «money cash hands»). Не став вставки на перші 3 секунди.` : ""}
Відповідай тільки JSON: {"pops":[{"i":0,"t":"…","c":"yellow"}],"ins":[{"i":10,"q":"…"}]}`, { cache: false, kb: true, max: 2500 });
    const okI = (v) => Number.isInteger(+v) && +v >= 0 && +v < n, at = (i) => L.words[+i].s;
    if (want.pops) { const P = (r?.pops || []).filter((o) => o && okI(o.i) && o.t).map((o) => ({ at: at(o.i), t: String(o.t).slice(0, 34), c: PLC[o.c] ? o.c : "yellow" })).sort((a, b) => a.at - b.at);
      P.forEach((o, k) => { o.d = clamp((P[k + 1]?.at ?? o.at + 9) - o.at - .15, .8, 2.4); }); L.pops = P; }
    if (want.ins) { const I = (r?.ins || []).filter((o) => o && okI(o.i) && o.q && at(o.i) > 2).map((o) => ({ at: at(o.i), q: String(o.q).slice(0, 60) })).sort((a, b) => a.at - b.at);
      I.forEach((o, k) => { o.d = clamp((I[k + 1]?.at ?? o.at + 9) - o.at - .2, 1, 2.8); }); L.ins = I; }
  }
  let LIBE = "";
  async function insImg(src) { if (INSIMG.has(src)) return INSIMG.get(src); const u = /^(blob:|data:)/.test(src) ? src : await SRV.mediaFile(src); const im = new Image(); im.src = u; await im.decode(); INSIMG.set(src, im); return im; }
  async function loadIns() { LIBE = "";
    for (const it of L.ins || []) { if (it.src && INSIMG.has(it.src)) continue;
      try { if (!it.alts) { const r = await SRV.media("photo", it.q, 6); it.alts = r.map((o) => o.src).filter(Boolean); it.ai = 0; }
        for (let k = it.ai || 0; k < it.alts.length; k++) { try { await insImg(it.alts[k]); it.src = it.alts[k]; it.ai = k; break; } catch (e) {} }
      } catch (e) { LIBE = e?.message === "login" ? "Увійди в акаунт, щоб брати фото з бібліотеки" : "Бібліотека фото зараз недоступна"; } }
    L.ins = (L.ins || []).filter((it) => it.src && INSIMG.has(it.src)); }
  // без озвучки: час кожного слова — за швидкістю читання з екрана
  function wordsFromText(text) { const ws = []; let t = .6;
    String(text).split(/\s+/).filter(Boolean).forEach((w) => { const d = .2 + Math.min(.5, w.length * .05); ws.push({ w, s: t, e: t + d }); t += d + .08; if (/[.!?…]$/.test(w)) t += .6; else if (/[,:;—–]$/.test(w)) t += .25; });
    return { ws, dur: t + 1.4 }; }
  // AI-голос: довгий текст — частинами по ~2400 знаків, склеюємо з паузою
  const b64Buf = (b) => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  async function ttsAudio(text, voice, onStage) { const parts = []; let cur = "";
    for (const sn of String(text).match(/[^.!?…]+[.!?…]*\s*/g) || [text]) { if ((cur + sn).length > 2400 && cur) { parts.push(cur); cur = ""; } cur += sn; } cur.trim() && parts.push(cur);
    const out = []; for (let i = 0; i < parts.length; i++) { onStage?.(i, parts.length); const r = await SRV.tts({ text: parts[i].trim(), voice, quiet: true }); out.push(await E().decode(b64Buf(r.audio))); }
    const gap = Math.round(.3 * E().SR), y = new Float32Array(out.reduce((a, p) => a + p.length, 0) + gap * Math.max(0, out.length - 1)); let o = 0; out.forEach((p) => { y.set(p, o); o += p.length + gap; }); return y; }
  const TTS_ERR = { no_quota: "Хвилини AI-озвучки закінчились", no_key: "AI-озвучка тимчасово недоступна", no_clone: "Спершу створи свій голос", bad_voice: "Цей голос недоступний — вибери інший", busy: "Сервіс озвучки перевантажений, спробуй за хвилину", empty_text: "Немає тексту для озвучки" };

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
    const [OW, OH] = DIMS(); const cv = document.createElement("canvas"); cv.width = OW; cv.height = OH; const x = cv.getContext("2d", { alpha: false });
    try {
      const M = await import("https://cdn.jsdelivr.net/npm/mediabunny@1.45.0/+esm");
      if (!window.VideoEncoder) throw new Error("noenc");
      const BR = L.wide ? (TOT > 120 ? 3e6 : 5e6) : 6e6, can = (c) => M.canEncodeVideo(c, { width: OW, height: OH, bitrate: BR }).catch(() => false);
      const vc = (await can("avc")) ? "avc" : (await can("vp9")) ? "vp9" : null; if (!vc) throw new Error("noenc");
      const aac = vc === "avc" && await M.canEncodeAudio("aac").catch(() => false), webm = vc !== "avc";
      const out = new M.Output({ format: webm ? new M.WebMOutputFormat() : aac ? new M.Mp4OutputFormat({ fastStart: "in-memory" }) : new M.MovOutputFormat({ fastStart: "in-memory" }), target: new M.BufferTarget() });
      const vs = new M.CanvasSource(cv, { codec: vc, bitrate: BR, keyFrameInterval: 2 }), as = new M.AudioBufferSource(webm ? { codec: "opus", bitrate: 160e3 } : aac ? { codec: "aac", bitrate: 192e3 } : { codec: "pcm-s16" });
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
#yvln .lbl2{font-size:12.5px;color:#a1a1aa;font-weight:700;margin:12px 0 6px}#yvln .chips.l{justify-content:flex-start}
#yvln .sws{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}#yvln .sw2{display:grid;justify-items:center;gap:4px;padding:6px 2px;border-radius:14px;border:1.5px solid transparent;background:none;color:#e4e4e7;font-family:inherit;font-size:11.5px;cursor:pointer}#yvln .sw2[aria-pressed=true]{border-color:#f5f5f7}
#yvln .sw2 i{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;font-style:normal;font-weight:900;font-size:22px;border:1px solid rgba(255,255,255,.15)}
#yvln .modes3{flex:none;display:flex;gap:4px;margin:2px 14px 6px;padding:4px;border-radius:14px;background:rgba(255,255,255,.06)}#yvln .modes3 button{flex:1;padding:9px 6px;border-radius:11px;border:0;background:none;color:#a1a1aa;font-weight:700;font-size:13.5px;font-family:inherit;cursor:pointer}#yvln .modes3 button[aria-pressed=true]{background:#f5f5f7;color:#0b0b0d}
#yvln .scn{display:grid;gap:6px}#yvln .scn button{display:flex;gap:10px;align-items:center;text-align:left;padding:9px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:inherit;font-family:inherit;font-size:14px;cursor:pointer}#yvln .scn b{flex:none;color:#a1a1aa;font-size:12px;min-width:38px}
#yvln .setup{flex:1;min-height:0;display:flex;flex-direction:column}
#yvln .steps{display:flex;gap:5px;justify-content:center;margin:0 0 6px;flex:none}#yvln .steps i{width:26px;height:4px;border-radius:2px;background:rgba(255,255,255,.18)}#yvln .steps i.on{background:#f5f5f7}
#yvln .pv{flex:none;height:30vh;display:flex;justify-content:center;align-items:center;padding:0 14px 6px}
#yvln .scr{flex:1;min-height:0;overflow-y:auto;padding:0 14px 12px;-webkit-overflow-scrolling:touch}
#yvln .sec{margin-top:16px}#yvln .sec h4{margin:0 0 8px;font-size:13.5px;color:#d4d4d8;font-weight:800;display:flex;gap:7px;align-items:center}#yvln .sec h4 i{font-style:normal;width:20px;height:20px;border-radius:50%;background:#f5f5f7;color:#0b0b0d;display:grid;place-items:center;font-size:11.5px;font-weight:800;flex:none}
#yvln .pst{display:flex;gap:8px;overflow-x:auto;padding:2px 0 6px;scroll-snap-type:x proximity;scrollbar-width:none}#yvln .pst::-webkit-scrollbar{display:none}
#yvln .pst button{flex:none;scroll-snap-align:start;padding:3px 3px 6px;border:2px solid transparent;border-radius:15px;background:none;color:#e4e4e7;font-weight:700;font-size:11.5px;line-height:1.2;font-family:inherit;cursor:pointer;display:grid;gap:5px;justify-items:center}#yvln .pst button[aria-pressed=true]{border-color:#f5f5f7;background:rgba(255,255,255,.06)}
#yvln .pst canvas{width:84px;height:149px;border-radius:11px;display:block;background:#222}#yvln .pst.w canvas{width:150px;height:84px}#yvln .pst.bd{overflow:visible}#yvln .pst.bd button{flex:1}#yvln .pst.bd canvas{width:96px;height:128px}
#yvln .vopt{display:grid;gap:6px}#yvln .vopt>button{display:flex;align-items:center;gap:10px;text-align:left;padding:10px 12px;border-radius:14px;border:1.5px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:inherit;font-family:inherit;cursor:pointer}
#yvln .vopt>button[aria-pressed=true]{border-color:#f5f5f7;background:rgba(255,255,255,.1)}#yvln .vopt b{display:block;font-size:14.5px}#yvln .vopt span{display:block;font-size:12.5px;color:#a1a1aa;margin-top:1px}
#yvln .vopt em{margin-left:auto;flex:none;font-style:normal;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:999px;background:rgba(48,209,88,.16);color:#30d158;white-space:nowrap}#yvln .vopt em.pl{background:rgba(255,255,255,.1);color:#f5f5f7;font-size:13px;padding:6px 11px}
#yvln .tg{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)}#yvln .tg b{font-size:14.5px}#yvln .tg span{display:block;font-size:12.5px;color:#a1a1aa}
#yvln .sw{flex:none;width:48px;height:29px;border-radius:999px;background:rgba(255,255,255,.2);border:0;position:relative;cursor:pointer}#yvln .sw::after{content:"";position:absolute;top:3px;left:3px;width:23px;height:23px;border-radius:50%;background:#fff;transition:transform .18s}#yvln .sw[aria-checked=true]{background:#30d158}#yvln .sw[aria-checked=true]::after{transform:translateX(19px)}
#yvln input.tx{width:100%;padding:11px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font-size:15px;font-family:inherit}
#yvln .cnt{font-size:12.5px;color:#a1a1aa;margin:6px 2px 0}#yvln .cnt.bad{color:#ff9f0a}
#yvln .rowf .btn.bk{flex:none;width:52px;padding:0;font-size:22px}
#yvln .prow{display:flex;gap:6px;align-items:center}#yvln .prow b{min-width:40px;color:#a1a1aa;font-size:12px;cursor:pointer}#yvln .prow input{flex:1;min-width:0;padding:8px 10px;font-size:14px}#yvln .prow img{width:64px;height:40px;object-fit:cover;border-radius:8px;flex:none}#yvln .prow .chip{flex:1}
#yvln .pc,#yvln .pdel{width:32px;height:32px;border-radius:50%;flex:none;cursor:pointer}#yvln .pc{border:2px solid rgba(255,255,255,.45)}#yvln .pdel{border:1px solid rgba(255,255,255,.16);background:none;color:#f5f5f7;font-size:18px}
#yvln .psw{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}#yvln .psw button{display:grid;justify-items:center;gap:4px;padding:5px 2px;border-radius:14px;border:1.5px solid transparent;background:none;color:#e4e4e7;font-family:inherit;font-size:11px;cursor:pointer}#yvln .psw button[aria-pressed=true]{border-color:#f5f5f7}
#yvln .psw i{display:grid;place-items:center;width:48px;height:48px;border-radius:12px;font-style:normal;font-size:19px;border:1px solid rgba(255,255,255,.15)}
${""}`;
  const UI = { root: null };
  const tool = (k, ic, t) => `<button class="yvtool" type="button" data-sh="${k}">${ic}${t}</button>`;
  function shell(title) {
    if (!document.getElementById("yvlncss")) { const st = document.createElement("style"); st.id = "yvlncss"; st.textContent = CSS + E().SHEET_CSS.replace(/^\./gm, "#yvln ."); document.head.appendChild(st); }
    UI.root?.remove(); const d = document.createElement("div"); d.id = "yvln";
    d.innerHTML = `<div class="lh"><b>${title}<span class="ldev">ТЕСТ</span></b><span style="display:flex;gap:8px"><button class="lx" type="button" id="lundo" aria-label="Скасувати" hidden>${IC.undo}</button><button class="lx" type="button" id="lclose" aria-label="Закрити">×</button></span></div><div class="lb"></div><div class="lf"></div>`;
    document.body.appendChild(d); UI.root = d; $(d, "#lclose").onclick = close;
    $(d, "#lundo").onclick = () => { const h = L?.hist?.pop(); if (!h) return; const o = JSON.parse(h); L.scenes = o.scenes; L.style = o.style; L.subs = o.subs; L.title = o.title; L.cta = o.cta; L.look = o.look; L.pops = o.pops; L.ins = o.ins; L.opt = o.opt; if (o.world) L.world = o.world; prep(); screenEdit("Скасовано"); };
    return d;
  }
  function close() { stopPlay(); cancelAnimationFrame(DEMO); UI.root?.remove(); UI.root = null; }
  const pushHist = () => { L.hist.push(JSON.stringify({ scenes: L.scenes, style: L.style, subs: L.subs, title: L.title, cta: L.cta, look: L.look, world: L.world, pops: L.pops, ins: L.ins, opt: L.opt })); if (L.hist.length > 20) L.hist.shift(); };
  const fitCanvas = (stage, cw, extra = 0, wide = false) => { const r = wide ? 16 / 9 : 9 / 16; const f = () => { const h = stage.clientHeight - 8, w = Math.max(90, Math.min(h * r, stage.clientWidth - extra - 12)); cw.style.width = w + "px"; cw.style.height = w / r + "px"; }; f(); requestAnimationFrame(f); new ResizeObserver(f).observe(stage); };
  let FMT = "tall";
  const TITLE = () => FMT === "wide" ? "YouTube-анімація" : "Анімація лініями";
  const DEMOW = () => ({ wide: true, title: "Шлях до першого заробітку", cta: "Підпишись, щоб не пропустити", subs: true, hist: [],
    world: { end: 3, cam: [{ t: 6.5, z: 1.25 }, { t: 8.5, z: 1 }], places: [{ x0: 0, kind: "field" }, { x0: 1.4, kind: "road" }, { x0: 2.2, kind: "city" }],
      items: [{ k: "man", id: "Олег", hero: true, x: .4, y: .92, wear: ["cap"], label: "Олег", at: 0, moves: [{ t: .8, m: "walk_to", x: 1.6 }, { t: 6.2, m: "think" }, { t: 7.6, m: "run_to", x: 2.6 }, { t: 12, m: "cheer" }] },
        { k: "thinkb", x: 1.6, y: .3, t: "А якщо почати?", at: 6.3, moves: [{ t: 8, m: "hide" }] }, { k: "money", x: 2.85, y: .3, at: 11.6, acc: true, moves: [{ t: 11.6, m: "pop" }, { t: 12.4, m: "bounce" }] }, { k: "count", x: 2.4, y: .2, from: 0, to: 500, t: "грн", at: 11.8 }] } });

  // приклад на старті — показує вибраний стиль, субтитри, плашки й фото
  let DEMO = 0;
  function demoImg() { if (INSIMG.has("demo")) return; const c = document.createElement("canvas"); c.width = 480; c.height = 320; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, 0, 320); g.addColorStop(0, "#7ec8ff"); g.addColorStop(.6, "#ffd9a0"); g.addColorStop(1, "#f4a261"); x.fillStyle = g; x.fillRect(0, 0, 480, 320);
    x.fillStyle = "#fff3c4"; x.beginPath(); x.arc(340, 115, 44, 0, 7); x.fill(); x.fillStyle = "#2a9d8f"; x.beginPath(); x.moveTo(0, 320); x.lineTo(0, 215); x.quadraticCurveTo(120, 145, 240, 228); x.quadraticCurveTo(360, 168, 480, 212); x.lineTo(480, 320); x.fill();
    x.fillStyle = "#264653"; x.beginPath(); x.moveTo(0, 320); x.lineTo(0, 268); x.quadraticCurveTo(200, 218, 480, 278); x.lineTo(480, 320); x.fill(); INSIMG.set("demo", c); }
  function demoL(o = OPT) { const r = optLook(o); demoImg();
    if (FMT === "wide") { const words = "Олег іде полем і думає а якщо почати сьогодні і вже за тиждень перший заробіток".split(" ").map((w, i) => ({ w, s: .4 + i * .8, e: .4 + i * .8 + .6 }));
      return { ...DEMOW(), aud: new Float32Array(Math.round(14 * E().SR)), words, style: r.style, look: r.look, subs: r.subs, opt: o, _len: 14,
        pops: o.pops ? [{ at: 5.2, d: 2, t: "Перший крок", c: "yellow" }, { at: 12, d: 1.9, t: "+500 грн", c: "green" }] : [], ins: o.ins ? [{ at: 8.3, d: 2.4, src: "demo" }] : [] }; }
    const words = "Більшість чекає тисячі підписників щоб почати заробляти а гроші приходять з одного вдалого відео".split(" ").map((w, i) => ({ w, s: .3 + i * .42, e: .3 + i * .42 + .38 }));
    return { aud: new Float32Array(Math.round(8 * E().SR)), words, style: r.style, look: r.look, subs: r.subs, opt: o, _len: 7.5, title: "Чекати — дивно", cta: "Збережи, якщо впізнав себе",
      pops: o.pops ? [{ at: 2.3, d: 1.9, t: "1000 вкладок", c: "red" }, { at: 5.3, d: 1.9, t: "Одне відео = гроші", c: "yellow" }] : [], ins: o.ins ? [{ at: 3.1, d: 1.9, src: "demo" }] : [],
      scenes: [{ a: 0, title: "Тисяча вкладок", items: [{ k: "man", x: .5, y: .92, face: "sad", moves: [{ i: 6, m: "shock" }] }, { k: "tab", x: .2, y: .25, at: 1 }, { k: "tab", x: .8, y: .22, at: 2 }, { k: "tab", x: .17, y: .55, at: 3 }, { k: "tab", x: .83, y: .52, at: 4, t: "?" }, { k: "tab", x: .5, y: .1, at: 5, t: "!" }] },
        { a: 9, title: "Одне відео", items: [{ k: "man", x: .35, y: .92, moves: [{ i: 11, m: "jump" }, { i: 13, m: "cheer" }] }, { k: "money", x: .72, y: .35, at: 11, acc: true, moves: [{ i: 11, m: "pop" }, { i: 12, m: "fly_to", x: .5, y: .25 }] }, { k: "text", t: "+1 відео", x: .5, y: .1, at: 14, moves: [{ i: 14, m: "pop" }] }] }], hist: [] }; }
  function demo(cv) {
    cancelAnimationFrame(DEMO); const keep = L, DL = demoL(), x = cv.getContext("2d"), t0 = performance.now();
    const loop = () => { if (!cv.isConnected) return; L = DL; prep(); WKEY = ""; const t = ((performance.now() - t0) / 1000) % DL._len; drawFrame(x, t, cv.width, cv.height); L = keep; DEMO = requestAnimationFrame(loop); }; loop();
  }
  function thumb(cv, id) { const keep = L; try { L = demoL({ ...OPT, preset: id, subs: true, pops: true, ins: false }); prep(); WKEY = ""; drawFrame(cv.getContext("2d"), FMT === "wide" ? 7 : 3.3, cv.width, cv.height); } catch (e) { console.warn(e); } L = keep; if (keep) prep(); WKEY = ""; }
  const OFF = { c: null };
  function bodyThumb(cv, body) { const keep = L; try { const off = OFF.c ||= Object.assign(document.createElement("canvas"), { width: 540, height: 960 }), r = optLook({ ...OPT, body });
      L = { aud: new Float32Array(Math.round(3 * E().SR)), words: [{ w: "а", s: 0, e: .3 }, { w: "б", s: .4, e: .7 }, { w: "в", s: .8, e: 1 }], style: r.style, look: { ...r.look, frame: "hide", fig: false }, subs: false, hist: [],
        scenes: [{ a: 0, title: "", items: [{ k: "man", x: .5, y: .92, face: "happy", moves: [{ i: 0, m: "wave" }] }] }] }; prep();
      drawFrame(off.getContext("2d"), 1.35, 540, 960); cv.getContext("2d").drawImage(off, 150, 318, 240, 320, 0, 0, cv.width, cv.height); } catch (e) { console.warn(e); } L = keep; if (keep) prep(); }
  let STYLE = "neon";
  const DRAFT = { topic: "", text: "", len: 3, vid: "" };
  /* ---------- крок 1: як виглядатиме ---------- */
  function screenSetup(fromEdit) {
    stopPlay(); if (!fromEdit) L = null; const d = shell(TITLE()), B = $(d, ".lb"), F = $(d, ".lf"), wide = FMT === "wide"; $(d, "#lundo").hidden = true;
    const keepOpt = { ...OPT };
    B.innerHTML = `<div class="setup"><div class="steps"><i class="on"></i><i></i><i></i></div><div class="pv"><div class="cvw"><canvas id="lcv" width="${wide ? 960 : 540}" height="${wide ? 540 : 960}"></canvas></div></div><div class="scr">
      <div class="sec" style="margin-top:6px"><h4><i>1</i>Шаблон</h4><p class="cnt" style="margin:-4px 0 8px">Фон, шрифт, плашки, їхні кольори й субтитри вже підібрані одне до одного</p><div class="pst${wide ? " w" : ""}">${PRESETS.map((p) => `<button type="button" data-ps="${p.id}" aria-pressed="${OPT.preset === p.id}"><canvas width="${wide ? 300 : 168}" height="${wide ? 168 : 298}"></canvas>${p.n}</button>`).join("")}</div></div>
      <div class="sec"><h4><i>2</i>Персонаж</h4><div class="pst bd">${BODIES.map(([v, n]) => `<button type="button" data-bo="${v}" aria-pressed="${OPT.body === v}"><canvas width="240" height="320"></canvas>${n}</button>`).join("")}</div>
        <div class="chips l" style="margin-top:4px">${THICK.map(([v, n]) => `<button class="chip" type="button" data-lw="${v}" aria-pressed="${+OPT.lw === v}">${n} лінії</button>`).join("")}</div></div>
      <div class="sec"><h4><i>3</i>Озвучка</h4><div class="vopt">${VOICE_OPTS.map(([k, n, dd, tag]) => `<button type="button" data-vo="${k}" aria-pressed="${OPT.voice === k}"><div><b>${n}</b><span>${dd}</span></div>${tag ? `<em>${tag}</em>` : ""}</button>`).join("")}</div></div>
      <div class="sec"><h4><i>4</i>Що додати</h4><div style="display:grid;gap:6px">
        <div class="tg"><div><b>Субтитри</b><span>У стилі шаблону, слово, яке звучить, підсвічується</span></div><button class="sw" type="button" role="switch" data-sw="subs" aria-checked="${!!OPT.subs}" aria-label="Субтитри"></button></div>
        <div class="tg"><div><b>Фрази, що вистрибують</b><span>Головні думки великим текстом — плашки в стилі шаблону</span></div><button class="sw" type="button" role="switch" data-sw="pops" aria-checked="${!!OPT.pops}" aria-label="Фрази, що вистрибують"></button></div>
        <div class="tg"><div><b>Вставки фото</b><span>AI підбере фото з бібліотеки до важливих слів</span></div><button class="sw" type="button" role="switch" data-sw="ins" aria-checked="${!!OPT.ins}" aria-label="Вставки фото"></button></div></div></div>
      <p class="hint" style="margin:16px 0 4px">Потім у редакторі будуть лише ті налаштування, які ти тут увімкнув. Повернутися сюди можна будь-коли.</p></div></div>`;
    F.innerHTML = fromEdit ? `<div class="rowf"><button class="btn main" type="button" id="lnext">Застосувати</button><button class="btn bk" type="button" id="lprev" aria-label="Назад">‹</button></div>` : `<button class="btn main" type="button" id="lnext">Далі →</button>`;
    const pv = $(B, ".pv"), cv = $(B, "#lcv"); fitCanvas(pv, $(B, ".cvw"), 0, wide); demo(cv);
    const bodies = () => B.querySelectorAll("[data-bo]").forEach((b) => bodyThumb($(b, "canvas"), b.dataset.bo));
    const thumbs = () => { B.querySelectorAll("[data-ps]").forEach((b) => thumb($(b, "canvas"), b.dataset.ps)); bodies(); }; thumbs();
    try { Promise.all([...new Set(PRESETS.map((p) => p.font)), "Unbounded"].map((f) => document.fonts.load(`800 40px "${f}"`))).then(() => { if (cv.isConnected) thumbs(); }).catch(() => {}); } catch (e) {}
    const pick = (sel, key, val) => { OPT[key] = val; saveOpt(); B.querySelectorAll(sel).forEach((o) => o.setAttribute("aria-pressed", o.matches(`[${sel.slice(1, -1)}="${val}"]`))); demo(cv); };
    B.querySelectorAll("[data-ps]").forEach((b) => b.onclick = () => { pick("[data-ps]", "preset", b.dataset.ps); bodies(); });
    B.querySelectorAll("[data-bo]").forEach((b) => b.onclick = () => pick("[data-bo]", "body", b.dataset.bo));
    B.querySelectorAll("[data-lw]").forEach((b) => b.onclick = () => { OPT.lw = +b.dataset.lw; saveOpt(); B.querySelectorAll("[data-lw]").forEach((o) => o.setAttribute("aria-pressed", o === b)); demo(cv); thumbs(); });
    B.querySelectorAll("[data-vo]").forEach((b) => b.onclick = () => pick("[data-vo]", "voice", b.dataset.vo));
    B.querySelectorAll("[data-sw]").forEach((b) => b.onclick = () => { const k2 = b.dataset.sw; OPT[k2] = !OPT[k2]; saveOpt(); b.setAttribute("aria-checked", OPT[k2]); demo(cv); });
    if (fromEdit) { $(F, "#lprev").onclick = () => { OPT = keepOpt; saveOpt(); cancelAnimationFrame(DEMO); screenEdit(); };
      $(F, "#lnext").onclick = async () => { cancelAnimationFrame(DEMO); const prev = L.opt || {};
        if (OPT.voice !== (L.voice || prev.voice)) { DRAFT.text = L.text || L.words.map((w) => w.w).join(" "); L = null; screenContent("Озвучку змінено — перевір текст і створи анімацію заново"); return; }
        pushHist(); const r = optLook(OPT); L.style = r.style; L.look = { ...r.look }; L.subs = r.subs; L.opt = { ...OPT };
        const want = { pops: OPT.pops && !L.pops?.length, ins: OPT.ins && !L.ins?.length }; let m = "Налаштування застосовано";
        if (want.pops || want.ins) { try { await E().busyRun("montage", async () => { await aiExtras(want); if (want.ins) await loadIns(); }); if (want.ins && !L.ins?.length) m = LIBE || "Фото не знайшлись"; } catch (e) { m = "Не вийшло додати — спробуй ще раз"; } }
        prep(); screenEdit(m); };
    } else $(F, "#lnext").onclick = () => { cancelAnimationFrame(DEMO); track("setup", { v: `${OPT.preset}|${OPT.body}|${OPT.lw}|${OPT.voice}|${OPT.subs ? 1 : 0}${OPT.pops ? 1 : 0}${OPT.ins ? 1 : 0}` }); screenContent(); };
    track("open_setup");
  }
  /* ---------- крок 2: про що відео + текст/голос ---------- */
  const VPA = { a: null };
  async function voiceList(box) {
    let V = [], cl = null; try { [V, cl] = await Promise.all([SRV.voices(), SRV.myClone()]); } catch (e) {}
    if (!box.isConnected) return;
    if (OPT.voice === "clone") { if (cl?.has) { DRAFT.vid = "clone"; box.innerHTML = `<p class="cnt" style="margin:0">✓ Озвучимо твоїм голосом</p>`; }
      else { box.innerHTML = `<p class="cnt" style="margin:0 0 8px">Ще немає зразка твого голосу. Запиши 1 хвилину — і AI говоритиме твоїм голосом.</p>${typeof window.openClone === "function" ? `<button class="btn" type="button" id="lcl">Створити свій голос</button>` : ""}`;
        $(box, "#lcl")?.addEventListener("click", () => { UI.root.style.display = "none"; window.openClone(() => { UI.root.style.display = ""; voiceList(box); }); const iv = setInterval(() => { if (!document.querySelector(".sheet.open,#clonesheet") && UI.root?.style.display === "none") { UI.root.style.display = ""; clearInterval(iv); } }, 1500); }); }
      return; }
    if (!V.length) { box.innerHTML = `<p class="cnt" style="margin:0">Голоси зараз недоступні. Спробуй пізніше або вибери «Свій голос».</p>`; return; }
    if (!V.some((v) => v.id === DRAFT.vid)) DRAFT.vid = V[0].id;
    box.innerHTML = V.map((v) => `<button type="button" data-vid="${escH(v.id)}" aria-pressed="${DRAFT.vid === v.id}"><div><b>${escH(v.name)}</b><span>${escH(v.descr || "")}</span></div><em class="pl" data-pv="${escH(v.id)}" role="button" aria-label="Прослухати">▶</em></button>`).join("");
    box.querySelectorAll("[data-vid]").forEach((b) => b.onclick = async (e) => { const pv = e.target.closest("[data-pv]"); DRAFT.vid = b.dataset.vid; box.querySelectorAll("[data-vid]").forEach((o) => o.setAttribute("aria-pressed", o === b));
      if (!pv) return; try { VPA.a?.pause(); } catch (x) {} if (pv.textContent === "■") { pv.textContent = "▶"; return; } const v = V.find((q) => q.id === b.dataset.vid); let u = v.preview;
      if (!u) { pv.textContent = "…"; try { const r = await SRV.tts({ text: "Привіт! Ось так звучатиме твоє відео.", voice: { kind: "preset", id: v.id }, quiet: true }); u = v.preview = URL.createObjectURL(new Blob([b64Buf(r.audio)], { type: r.mime || "audio/mpeg" })); } catch (x) { pv.textContent = "▶"; say(TTS_ERR[x.message] || "Не вдалося прослухати"); return; } }
      box.querySelectorAll("[data-pv]").forEach((o) => o.textContent = "▶"); VPA.a = new Audio(u); pv.textContent = "■"; VPA.a.onended = () => pv.textContent = "▶"; VPA.a.play().catch(() => pv.textContent = "▶"); });
  }
  async function aiText(topic) { const wide = FMT === "wide", v = OPT.voice, want = wide ? DRAFT.len * 130 : v === "none" ? 70 : 150, wc = (t) => (t.match(/\S+/g) || []).length;
    const r = await sample.json(`Напиши ${v === "none" ? "текст для анімаційного відео БЕЗ голосу — він іде на екрані субтитрами, тож короткі прості речення по 4–9 слів" : "текст для озвучки за кадром — жива розмовна українська, як людина говорить другу"} на тему: «${topic}».
Формат: ${wide ? `горизонтальне відео YouTube на ~${DRAFT.len} хв — одна історія з героєм, яку легко намалювати: герой, ситуація, проблема, поворот, результат, висновок` : "Reels до 1 хв: перше речення — сильний гачок, далі одна думка з наочним прикладом, у кінці — висновок і заклик"}.
Обсяг ≈ ${want} слів. Без хештегів, емодзі, ремарок і заголовків. Відповідай тільки JSON {"text":"…"}`, { cache: false, kb: true, max: 4000 });
    let t = String(r?.text || "").trim();
    for (let k = 0; wide && t && k < 3 && wc(t) < want * .8; k++) { const r2 = await sample.json(`Продовж текст для озвучки — та сама історія, той самий стиль. Додай ще ≈ ${Math.min(450, want - wc(t))} слів; якщо історія добігає кінця — заверши висновком. Кінець попереднього тексту: «${t.slice(-1500)}». Відповідай тільки JSON {"text":"…лише продовження…"}`, { cache: false, kb: true, max: 4000 });
      const add = String(r2?.text || "").trim(); if (!add) break; t += " " + add; }
    return t; }
  function screenContent(msg) {
    stopPlay(); const d = shell(TITLE()), B = $(d, ".lb"), F = $(d, ".lf"), wide = FMT === "wide", v = OPT.voice, rec = v === "rec" || v === "recplus", MAX = wide ? 600 : 90;
    B.innerHTML = `<div class="setup"><div class="steps"><i class="on"></i><i class="on"></i><i></i></div><div class="scr">${msg ? `<div class="msg" style="margin:0 0 6px">${escH(msg)}</div>` : ""}
      <div class="sec" style="margin-top:4px"><h4>Про що відео?</h4><input class="tx" id="ltopic" placeholder="Напр.: як заробити на першому відео без підписників" value="${escH(DRAFT.topic)}"></div>
      ${wide ? `<div class="sec"><h4>Тривалість</h4><div class="chips l">${[1, 3, 5, 8, 10].map((m) => `<button class="chip" type="button" data-len="${m}" aria-pressed="${DRAFT.len === m}">${m} хв</button>`).join("")}</div></div>` : ""}
      <div class="sec"><h4>${rec ? "Текст, який прочитаєш (можна без нього)" : v === "none" ? "Текст на екрані" : "Текст для озвучки"}</h4><button class="btn" type="button" id="lwr" style="margin-bottom:8px">✨ ${DRAFT.text ? "Написати інакше" : "Написати текст з AI"}</button>
        <textarea id="ltext" rows="${rec ? 6 : 8}" placeholder="${rec ? "Напиши або згенеруй — текст буде перед очима, поки записуєш" : "Встав свій текст або натисни «Написати з AI»"}">${escH(DRAFT.text)}</textarea><p class="cnt" id="lcnt"></p></div>
      ${v === "ai" || v === "clone" ? `<div class="sec"><h4>Голос</h4><div class="vopt" id="lvl"><p class="cnt" style="margin:0">Завантажую голоси…</p></div></div>` : ""}
      <p class="hint" style="margin:14px 0 2px">Шаблон: ${escH(presetOf(OPT.preset).n)} · ${escH(BODIES.find((o) => o[0] === OPT.body)?.[1] || "")} · ${escH(VOICE_OPTS.find((o) => o[0] === v)?.[1] || "")} · субтитри ${OPT.subs ? "увімк." : "вимк."} · фрази ${OPT.pops ? "увімк." : "вимк."}${OPT.ins ? " · фото" : ""}</p></div></div>`;
    F.innerHTML = rec ? `<div class="rowf"><button class="btn main" type="button" id="lrec">${IC.mic} ${v === "recplus" ? "Записати голос" : "Записати"}</button><button class="btn bk" type="button" id="lprev" aria-label="Назад">‹</button></div><label class="btn" for="lfile">Завантажити готовий запис</label><input type="file" id="lfile" accept="audio/*,video/*" hidden>`
      : `<div class="rowf"><button class="btn main" type="button" id="lgo">Створити анімацію</button><button class="btn bk" type="button" id="lprev" aria-label="Назад">‹</button></div>`;
    const ta = $(B, "#ltext"), tp = $(B, "#ltopic"), cnt = $(B, "#lcnt");
    const est = () => { const t = ta.value.trim(); DRAFT.text = ta.value; if (!t) { cnt.textContent = rec ? "" : `До ${wide ? "10 хв" : "1,5 хв"}`; cnt.className = "cnt"; return; }
      const n = (t.match(/\S+/g) || []).length, sec = v === "none" ? wordsFromText(t).dur : n / 2.4; cnt.textContent = `${n} слів · ≈ ${fmt(sec)}${sec > MAX ? ` — задовго, візьму перші ${wide ? "10 хв" : "90 с"}` : ""}`; cnt.className = "cnt" + (sec > MAX ? " bad" : ""); };
    ta.oninput = est; est(); tp.oninput = () => { DRAFT.topic = tp.value; };
    B.querySelectorAll("[data-len]").forEach((b) => b.onclick = () => { DRAFT.len = +b.dataset.len; B.querySelectorAll("[data-len]").forEach((o) => o.setAttribute("aria-pressed", o === b)); });
    $(B, "#lwr").onclick = async () => { const topic = tp.value.trim() || ta.value.trim().slice(0, 300); if (!topic) { say("Напиши, про що відео"); tp.focus(); return; }
      try { const t = await E().busyRun("text", () => aiText(topic)); if (!t) throw new Error("empty"); ta.value = t; est(); $(B, "#lwr").textContent = "✨ Написати інакше"; track("ai_text"); } catch (e) { say(e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло написати текст"); } };
    if (v === "ai" || v === "clone") voiceList($(B, "#lvl"));
    $(F, "#lprev").onclick = () => { try { VPA.a?.pause(); } catch (e) {} screenSetup(); };
    if (!rec) $(F, "#lgo").onclick = () => { const t = ta.value.trim(); if ((t.match(/\S+/g) || []).length < 3) { say("Додай текст — хоча б одне речення"); ta.focus(); return; } try { VPA.a?.pause(); } catch (e) {}
      if (v === "none") return build({ silent: true, text: t });
      if (!DRAFT.vid) { say(v === "clone" ? "Спершу створи свій голос" : "Вибери голос"); return; }
      build({ tts: { text: t, voice: DRAFT.vid === "clone" ? { kind: "clone" } : { kind: "preset", id: DRAFT.vid } } }); };
    else {
      const rb = $(F, "#lrec"), rl = rb.innerHTML;
      if (v === "rec") rb.onclick = () => E().record(rb, rl, (buf) => build({ buf, proc: false }));
      // з покращенням — через «Озвучку»: чистка, вирізання пауз і паразитів, правки голосом — сюди повертається готовий голос
      else rb.onclick = () => { UI.root.style.display = "none";
        window.YVTalk.open({ target: 0, onDone: async ({ wav }) => { UI.root.style.display = ""; await build({ buf: wav }); } });
        const iv = setInterval(() => { if (!document.getElementById("yvtalk")) { clearInterval(iv); if (UI.root && UI.root.style.display === "none") UI.root.style.display = ""; } }, 600); };
      $(F, "#lfile").onchange = async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; await build({ buf: await f.arrayBuffer(), proc: v === "recplus" }); };
    }
  }
  // src: {buf, proc} — запис/файл; {tts:{text, voice}} — AI-голос; {silent:true, text} — без озвучки
  async function build(src) {
    const wide = FMT === "wide", MAX = wide ? 600 : 90;
    try {
      await E().busyRun("montage", async () => { const stage = (t) => { try { yvBusy?.stage?.(t); } catch (e) {} };
        let y, words = null;
        if (src.silent) { const r = wordsFromText(src.text); words = r.ws; let dur = r.dur; if (dur > MAX) { words = words.filter((w) => w.e < MAX - 1.2); dur = MAX; say(wide ? "Текст довший за 10 хв — беру початок" : "Текст довший за 1,5 хв — беру початок"); } y = new Float32Array(Math.round(dur * E().SR)); }
        else { y = src.tts ? await ttsAudio(src.tts.text, src.tts.voice, (i, n) => stage(n > 1 ? `Озвучую ${i + 1} з ${n}…` : "Озвучую текст…")) : await E().decode(src.buf); if (src.proc) y = await E().processTake(y);
          if (y.length / E().SR > MAX) { y = y.subarray(0, Math.round(MAX * E().SR)).slice(); say(wide ? "Беру перші 10 хв" : "Для Reels — до 1,5 хв. Беру перші 90 с"); } }
        if (!words) { stage("Розпізнаю слова…"); const small = await E().resample(y, E().SR, 16000), dur = y.length / E().SR, WIN = 200 * 16000; words = [];
          for (let o = 0; o < small.length; o += WIN) { const r = await SRV.stt({ audio: E().b64(E().wav(small.subarray(o, Math.min(small.length, o + WIN)), 16000)), mime: "audio/wav", quiet: true }), off = o / 16000;
            (r.words || []).forEach((w) => { if (String(w.w).trim()) words.push({ w: String(w.w), s: off + Math.max(0, +w.s || 0), e: Math.min(dur, off + Math.max((+w.s || 0) + .05, +w.e || 0)) }); }); } }
        if (words.length < 3) throw new Error("nowords");
        L = { aud: y, words, scenes: [], hist: [], wide, silent: !!src.silent, text: src.text || src.tts?.text || "", voice: OPT.voice }; applyOpt(); prep();
        stage("Малюю анімацію…");
        await Promise.all([wide ? aiWorld((i, n) => stage(`Малюю частину ${i + 1} з ${n}…`)) : aiScenes().then((sc) => { L.scenes = sc; }),
          aiExtras({ pops: !!OPT.pops, ins: OPT.ins }).catch((e) => console.warn("extras", e))]);
        if (OPT.ins && L.ins?.length) { stage("Підбираю фото…"); await loadIns(); } });
      prep(); track("ready", { v: `${OPT.voice}|${L.wide ? "wide:" + L.world.items.length : L.scenes.length}sc/${Math.round(TOT)}s` });
      screenEdit(LIBE || "Тапни ▶, щоб подивитись. Правки — голосом або кнопкою ✎");
    } catch (e) { console.error(e); const m = e?.message; say(TTS_ERR[m] || (m === "nowords" ? "Не почув слів — спробуй ще раз" : m === "limit" ? "Ліміт на сьогодні вичерпано" : m === "login" ? "Увійди в акаунт" : "Не вийшло зібрати анімацію. Спробуй ще раз")); L = null; screenContent(); }
  }
  // шторка «Стиль»: фон, лінії, заголовок, плашки, субтитри, шрифт — лінії й рухи не змінюються
  function styleSheet(B, still, dirty) {
    const S = E().sheet(B, L.opt ? "Шаблон" : "Стиль", ""), b = S.body;
    const row = (t, key, opts, cur) => `<div class="lbl2">${t}</div><div class="chips l">${opts.map(([v, n]) => `<button class="chip" type="button" data-lk="${key}" data-v="${v}" aria-pressed="${String(cur) === String(v)}">${n}</button>`).join("")}</div>`;
    const draw = () => { const lk = lookOf();
      const curP = (PRESETS.find((p) => p.th === L.style) || {}).id, showSubs = true, showPl = true;
      if (L.opt) { const setO = (k2, v) => { pushHist(); OPT[k2] = v; saveOpt(); const r = optLook(OPT); L.style = STYLE = r.style; L.look = r.look; L.opt = { ...OPT }; track("look", { v: k2 + ":" + v }); dirty(); still(); draw(); };
        b.innerHTML = `<div class="psw">${PRESETS.map((p) => { const v = THEMES[p.th]; return `<button type="button" data-pr="${p.id}" aria-pressed="${OPT.preset === p.id}"><i style="background:${v.grad ? `linear-gradient(160deg,${v.grad[0]},${v.grad[1]})` : v.bg};color:${v.ink};font-family:'${p.font}',sans-serif;box-shadow:${v.glow ? `0 0 10px ${v.glow}` : "none"}">Аа</i><span>${p.n}</span></button>`; }).join("")}</div>
          ${row("Персонаж", "body", BODIES.map(([v, n]) => [v, n]), OPT.body)}${row("Лінії", "lw", THICK, +OPT.lw)}`;
        b.querySelectorAll("[data-pr]").forEach((x) => x.onclick = () => setO("preset", x.dataset.pr));
        b.querySelectorAll("[data-lk]").forEach((x) => x.onclick = () => setO(x.dataset.lk, x.dataset.lk === "lw" ? +x.dataset.v : x.dataset.v)); return; }
      b.innerHTML = `<div class="lbl2" style="margin-top:0">Стиль</div><div class="psw">${PRESETS.map((p) => { const v = THEMES[p.th]; return `<button type="button" data-pr="${p.id}" aria-pressed="${curP === p.id}"><i style="background:${v.grad ? `linear-gradient(160deg,${v.grad[0]},${v.grad[1]})` : v.bg};color:${v.ink};font-family:'${p.font}',sans-serif;box-shadow:${v.glow ? `0 0 10px ${v.glow}` : "none"}">Аа</i><span>${p.n}</span></button>`; }).join("")}</div>
        ${row("Лінії", "lw", [[.7, "Тонкі"], [1, "Звичайні"], [1.45, "Товсті"]], lk.lw)}
        <div class="chips l" style="margin-top:6px"><button class="chip" type="button" data-tg="boil" aria-pressed="${lk.boil !== false}">Живі лінії</button>${THEMES[L.style]?.glow ? `<button class="chip" type="button" data-tg="glow" aria-pressed="${lk.glow !== false}">Світіння</button>` : ""}<button class="chip" type="button" data-tg="fig" aria-pressed="${lk.fig !== false}">Підписи «ФІГ.»</button></div>
        ${row("Заголовок", "frame", [["box", "Рамка"], ["pill", "Плашка"], ["under", "Підкреслення"], ["none", "Лише текст"], ["hide", "Без заголовка"]], lk.frame)}
        ${showPl ? row("Плашки сцен", "plaque", [["punch", "Великий текст"], ["marker", "Маркер"], ["pill", "Біла"], ["neon", "Неон"], ["sticker", "Стікер"], ["none", "Без"]], lk.plaque) : ""}
        ${showSubs ? row("Субтитри", "subs", SUBS_OPTS.map(([v2, n]) => [v2, v2 === "off" ? "Без" : n]), L.subs === false ? "off" : lk.subs) : ""}
        ${row("Шрифт", "font", [["Manrope", "Гротеск"], ["Unbounded", "Широкий"], ["Comfortaa", "Округлий"], ["Rubik", "Rubik"], ["Caveat", "Рукописний"]], lk.font)}`;
      const set = (k2, v) => { pushHist(); L.look = { ...(L.look || {}), [k2]: v }; if (k2 === "subs") L.subs = v !== "off"; track("look", { v: k2 + ":" + v }); dirty(); still(); draw(); };
      b.querySelectorAll("[data-pr]").forEach((x) => x.onclick = () => { pushHist(); const p = presetOf(x.dataset.pr); L.style = STYLE = p.th; L.look = { ...(L.look || {}), font: p.font, frame: p.frame, lw: p.lw || 1, boil: p.boil !== false }; if (L.opt) { L.opt.preset = p.id; OPT.preset = p.id; saveOpt(); } track("look", { v: "pr:" + p.id }); dirty(); still(); draw(); });
      b.querySelectorAll("[data-lk]").forEach((x) => x.onclick = () => set(x.dataset.lk, x.dataset.lk === "lw" ? +x.dataset.v : x.dataset.v));
      b.querySelectorAll("[data-tg]").forEach((x) => x.onclick = () => set(x.dataset.tg, lookOf()[x.dataset.tg] === false));
    };
    draw(); return S;
  }
  let POS = 0;
  function screenEdit(msg) {
    const d = UI.root?.querySelector(".lb .bar") ? UI.root : shell(TITLE()), B = $(d, ".lb"), F = $(d, ".lf");
    stopPlay(); POS = Math.min(POS, Math.max(0, TOT - .05)); $(d, "#lundo").hidden = !L.hist.length; B.className = "lb";
    B.innerHTML = `<div class="stage"><div class="bar">${tool("style", '<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7v12M15 12h5M17.5 12v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', L.opt ? "Шаблон" : "Стиль")}${tool("scn", '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M9 4.5v15" stroke="currentColor" stroke-width="2"/></svg>', "Сцени")}${L.opt?.pops ? tool("pops", '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2" transform="rotate(-6 12 12)"/><path d="M8 11.5h8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>', "Плашки") : ""}${L.opt?.ins ? tool("ins", '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 17l5-5 4 4 3-3 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="15.5" cy="9.5" r="1.6" fill="currentColor"/></svg>', "Фото") : ""}</div>
      <div class="cvw"><canvas id="lcv" width="${L.wide ? 960 : 540}" height="${L.wide ? 540 : 960}"></canvas><button class="pb" type="button" id="lpb"><i>${IC.play}</i></button></div>
      <div class="bar">${L.opt ? tool("set", '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="7" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="10" cy="17" r="2.3" fill="none" stroke="currentColor" stroke-width="2"/></svg>', "Налашт.") : ""}${tool("neu", '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>', "Нове")}</div></div>
      <div class="seek"><input type="range" id="lseek" min="0" max="1000" value="${Math.round(POS / Math.max(.1, TOT) * 1000)}"><span id="ltm">${fmt(POS)} / ${fmt(TOT)}</span></div>${msg ? `<div class="msg">${escH(msg)}</div>` : ""}`;
    F.innerHTML = `<div class="rowf"><button class="btn" type="button" id="lvoice">${IC.mic} Скажи, що змінити</button><button class="btn sq" type="button" id="lwrite" aria-label="Написати">${IC.pen}</button></div><button class="btn main" type="button" id="lsave">Зберегти відео</button>`;
    const cv = $(B, "#lcv"), pb = $(B, "#lpb"), seek = $(B, "#lseek"), tm = $(B, "#ltm"), stage = $(B, ".stage");
    fitCanvas(stage, $(B, ".cvw"), 140, !!L.wide);
    const still = () => drawFrame(cv.getContext("2d"), POS || Math.min(1.6, Math.max(0, TOT - .05)), cv.width, cv.height); still();
    const show = (t) => { POS = t; seek.value = Math.round(t / TOT * 1000); tm.textContent = `${fmt(t)} / ${fmt(TOT)}`; };
    const setPlay = (on) => { pb.innerHTML = on ? "" : `<i>${IC.play}</i>`; };
    pb.onclick = () => { if (PL) { stopPlay(); return; } setPlay(true); playFrom(POS >= TOT - .1 ? 0 : POS, cv, { tick: show, onend: () => setPlay(false), done: () => { POS = 0; } }); };
    seek.oninput = () => { stopPlay(); show(seek.value / 1000 * TOT); still(); };
    const refresh = (m) => { prep(); screenEdit(m); };
    B.querySelectorAll("[data-sh]").forEach((b) => b.onclick = () => { const was = b.classList.contains("on"); B.querySelectorAll(".yvsh").forEach((x) => x._close(true)); B.querySelectorAll("[data-sh]").forEach((o) => o.classList.remove("on")); if (was) return; b.classList.add("on");
      const k = b.dataset.sh;
      if (k === "style") styleSheet(B, still, () => { $(d, "#lundo").hidden = false; });
      if (k === "scn" && L.world) { const S = E().sheet(B, "Частини сюжету", `<div class="scn">${L.world.segs.map((g, i) => `<button type="button" data-g="${i}"><b>${fmt(g.t0)}</b>${escH(g.ph[0]?.t.slice(0, 60) || "Частина " + (i + 1))}…</button><button type="button" data-rg="${i}" style="justify-content:center;padding:6px">↻ Інакше намалювати цю частину</button>`).join("")}</div><button class="btn" type="button" id="lregen" style="margin-top:10px">↻ Уся анімація заново</button>`);
        S.body.querySelectorAll("[data-g]").forEach((x) => x.onclick = () => { stopPlay(); show(L.world.segs[+x.dataset.g].t0 + 1); still(); });
        S.body.querySelectorAll("[data-rg]").forEach((x) => x.onclick = async () => { S.close(true); try { pushHist(); await E().busyRun("montage", () => regenSeg(+x.dataset.rg, "Зроби цю частину зовсім інакше, ніж була.")); track("regen_seg"); refresh("Частину перемальовано"); } catch (e) { say("Не вийшло. Спробуй ще раз"); } });
        $(S.body, "#lregen").onclick = async () => { S.close(true); try { pushHist(); await E().busyRun("montage", () => aiWorld()); track("regen"); refresh("Нова анімація готова"); } catch (e) { say("Не вийшло. Спробуй ще раз"); } }; }
      else if (k === "scn") { const S = E().sheet(B, "Сцени", `<div class="scn">${ST.map((q, i) => `<button type="button" data-q="${i}"><b>${fmt(q.t0)}</b>${escH(q.s.title || "Сцена " + (i + 1))}</button>`).join("")}</div><button class="btn" type="button" id="lregen" style="margin-top:10px">↻ Інші сцени для всього відео</button>`);
        S.body.querySelectorAll("[data-q]").forEach((x) => x.onclick = () => { stopPlay(); show(ST[+x.dataset.q].t0 + .9); still(); });
        $(S.body, "#lregen").onclick = async () => { S.close(true); try { pushHist(); L.scenes = await E().busyRun("montage", () => aiScenes("Зроби зовсім інші сцени, ніж були: інші предмети, рухи й жарти.")); track("regen"); refresh("Нові сцени готові"); } catch (e) { say("Не вийшло. Спробуй ще раз"); } }; }
      if (k === "set") { b.classList.remove("on"); screenSetup(true); return; }
      if (k === "pops") { const S = E().sheet(B, "Фрази, що вистрибують", ""), lk0 = lookOf(), CL = lk0.pal?.length ? PNAMES.slice(0, lk0.pal.length) : PNAMES, cc = (c) => colOf(c, lookOf());
        const draw = () => { S.body.innerHTML = `<div class="scn">${(L.pops || []).map((p, i) => `<div class="prow"><b data-ps="${i}">${fmt(p.at)}</b><input class="tx" data-pt="${i}" value="${escH(p.t)}" maxlength="34"><button type="button" class="pc" data-pc="${i}" style="background:${cc(p.c)}" aria-label="Колір"></button><button type="button" class="pdel" data-pd="${i}" aria-label="Прибрати">×</button></div>`).join("") || `<p class="hint">Поки немає жодної фрази</p>`}</div>
            <button class="btn" type="button" id="padd" style="margin-top:10px">+ Фраза на ${fmt(POS)}</button><button class="btn" type="button" id="pai" style="margin-top:8px">↻ Підібрати фрази заново</button>`;
          S.body.querySelectorAll("[data-ps]").forEach((x) => x.onclick = () => { stopPlay(); show(L.pops[+x.dataset.ps].at + .5); still(); });
          S.body.querySelectorAll("[data-pt]").forEach((x) => x.onchange = () => { pushHist(); $(d, "#lundo").hidden = false; L.pops[+x.dataset.pt].t = x.value.trim().slice(0, 34) || "…"; show(L.pops[+x.dataset.pt].at + .5); still(); });
          S.body.querySelectorAll("[data-pc]").forEach((x) => x.onclick = () => { pushHist(); const p = L.pops[+x.dataset.pc]; p.c = CL[(CL.indexOf(p.c) + 1) % CL.length]; x.style.background = cc(p.c); show(p.at + .5); still(); });
          S.body.querySelectorAll("[data-pd]").forEach((x) => x.onclick = () => { pushHist(); $(d, "#lundo").hidden = false; L.pops.splice(+x.dataset.pd, 1); still(); draw(); });
          $(S.body, "#padd").onclick = () => { pushHist(); $(d, "#lundo").hidden = false; L.pops = [...(L.pops || []), { at: POS, d: 2.2, t: "НОВА ФРАЗА", c: "yellow" }].sort((a, c) => a.at - c.at); L.pops.forEach((o, j) => { o.d = clamp((L.pops[j + 1]?.at ?? o.at + 9) - o.at - .15, .8, 2.4); }); show(POS + .5); still(); draw(); setTimeout(() => S.body.querySelector(`[data-pt="${L.pops.findIndex((o) => o.t === "НОВА ФРАЗА")}"]`)?.select(), 50); };
          $(S.body, "#pai").onclick = async () => { try { pushHist(); await E().busyRun("montage", () => aiExtras({ pops: true })); track("pops_regen"); draw(); still(); } catch (e) { say("Не вийшло. Спробуй ще раз"); } }; };
        draw(); }
      if (k === "ins") { const S = E().sheet(B, "Вставки фото", "");
        const draw = () => { S.body.innerHTML = `<div class="scn">${(L.ins || []).map((q, i) => `<div class="prow"><b data-is="${i}">${fmt(q.at)}</b><img alt="" src="${escH(INSIMG.get(q.src)?.src || "")}"><button class="chip" type="button" data-in="${i}" ${(q.alts?.length || 0) > 1 ? "" : "disabled"}>Інше фото</button><button type="button" class="pdel" data-id="${i}" aria-label="Прибрати">×</button></div>`).join("") || `<p class="hint">Поки немає жодного фото</p>`}</div>
            <button class="btn" type="button" id="iadd" style="margin-top:10px">+ Фото з бібліотеки на ${fmt(POS)}</button><label class="btn" for="iown" style="margin-top:8px">+ Своє фото на ${fmt(POS)}</label><input type="file" id="iown" accept="image/*" hidden>`;
          S.body.querySelectorAll("[data-is]").forEach((x) => x.onclick = () => { stopPlay(); show(L.ins[+x.dataset.is].at + .8); still(); });
          S.body.querySelectorAll("[data-in]").forEach((x) => x.onclick = async () => { const q = L.ins[+x.dataset.in]; pushHist(); $(d, "#lundo").hidden = false; x.textContent = "…";
            for (let n = 1; n < q.alts.length; n++) { const ai = ((q.ai || 0) + n) % q.alts.length; try { await insImg(q.alts[ai]); q.ai = ai; q.src = q.alts[ai]; break; } catch (e) {} } show(q.at + .8); still(); draw(); });
          S.body.querySelectorAll("[data-id]").forEach((x) => x.onclick = () => { pushHist(); $(d, "#lundo").hidden = false; L.ins.splice(+x.dataset.id, 1); still(); draw(); });
          const addAt = (q) => { L.ins = [...(L.ins || []), q].sort((a, c) => a.at - c.at); L.ins.forEach((o, j) => { o.d = clamp((L.ins[j + 1]?.at ?? o.at + 9) - o.at - .2, 1, 2.8); }); };
          $(S.body, "#iadd").onclick = async () => { const at = POS, ctx = L.words.filter((w) => w.s > at - 1.5 && w.s < at + 4).map((w) => w.w).join(" ") || L.title || "success";
            try { await E().busyRun("montage", async () => { const r = await sample.json(`Зроби 2–4 англійські слова для пошуку стокового фото (наочний предмет, місце чи дія) до фрази: «${ctx.slice(0, 200)}». Тільки JSON {"q":"..."}`, { cache: true }); pushHist(); addAt({ at, d: 2.6, q: String(r?.q || "lifestyle").slice(0, 60) }); await loadIns(); });
              if (LIBE) say(LIBE); show(at + .8); still(); draw(); } catch (e) { say("Не вийшло знайти фото"); } };
          $(S.body, "#iown").onchange = async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const u = URL.createObjectURL(f); try { await insImg(u); pushHist(); $(d, "#lundo").hidden = false; addAt({ at: POS, d: 2.6, q: "своє фото", src: u, alts: [u] }); show(POS + .8); still(); draw(); } catch (x) { say("Не вдалося відкрити фото"); } }; };
        draw(); }
      if (k === "neu") { const S = E().sheet(B, "Почати нову анімацію?", `<p style="margin:0 0 10px;color:#a1a1aa;font-size:13.5px">Поточна не збережеться.</p><button class="btn" type="button" id="lnew">Так, нова</button>`); $(S.body, "#lnew").onclick = () => { stopPlay(); screenSetup(); }; } });
    const cmd = async (t, voice) => { try { pushHist(); const m = await E().busyRun("montage", () => L.world ? editWide(t) : aiEdit(t)); track(voice ? "cmd_voice" : "cmd_text"); refresh(voice ? `«${t}» → ${m}` : m); } catch (e) { L.hist.pop(); say("Не вийшло застосувати правку"); } };
    $(F, "#lwrite").onclick = () => { B.querySelectorAll(".yvsh").forEach((x) => x._close(true)); const S = E().sheet(B, "Що змінити?", `<textarea id="lcmd" rows="3" placeholder="Напр.: у другій сцені нехай чоловічок біжить, додай гроші справа"></textarea><button class="btn main" type="button" id="lgo2" style="margin-top:8px">Застосувати</button>`);
      const ta = $(S.body, "#lcmd"); setTimeout(() => ta.focus(), 50); $(S.body, "#lgo2").onclick = () => { const v = ta.value.trim(); if (!v) return; S.close(true); cmd(v, false); }; };
    const vv = $(F, "#lvoice"), vl = vv.innerHTML;
    vv.onclick = () => { stopPlay(); if (!vv._rec) say("Кажи: «у першій сцені нехай стрибає», «стиль маркер»"); E().record(vv, vl, async (buf) => {
      try { const raw = await E().decode(buf), small = await E().resample(raw, E().SR, 16000), r = await E().busyRun("listen", () => SRV.stt({ audio: E().b64(E().wav(small, 16000)), mime: "audio/wav" }));
        const t = (r.words || []).map((w) => w.w).join(" "); if (!t.trim()) { say("Не почув"); return; } cmd(t, true); } catch (e) { say("Не вийшло розпізнати"); } }); };
    $(F, "#lsave").onclick = async () => { stopPlay(); const sv = $(F, "#lsave"); sv.disabled = true; sv.innerHTML = `Зберігаю… <b id="lpp">0%</b>`;
      try { const out = await exportVideo((p) => { const e = $(F, "#lpp"); if (e) e.textContent = Math.round(clamp(p) * 100) + "%"; }); track("save", { v: L.style + "|" + out.ext });
        E().offerSave(F, [new File([out.blob], `yuvi_linii${L.wide ? "_youtube" : ""}_${new Date().toISOString().slice(0, 10)}.${out.ext}`, { type: out.blob.type })], () => screenEdit(), () => track("saved")); still(); return;
      } catch (e) { console.error(e); say("Не вдалося зберегти відео"); }
      sv.disabled = false; sv.textContent = "Зберегти відео"; still(); };
  }

  // з «Рілс маркером»: готовий голос + розкадровка (фрази, що малювати, плашки) → відео лініями, без генерації картинок
  async function aiFromBoard(board, topic) {
    const r = await sample.json(`Ти режисер анімації «малюнок лініями». Ось слова озвучки з номерами:
${numbered()}
Автор уже зробив розкадровку — сцени по черзі (фраза, що намалювати, плашка):
${board.map((b, i) => `${i + 1}. фраза: «${b.phrase}»; малюнок: ${b.draw || "—"}; плашка: ${b.plaque ? `«${b.plaque}» (${b.color || "red"})` : "немає"}`).join("\n")}
Тема: ${topic || "—"}.
Зроби РІВНО ${board.length} сцен — по одній на кожну сцену розкадровки, у тому ж порядку. a — номер першого слова цієї фрази в озвучці. plaque і color — точно з розкадровки (або "" якщо немає). title — назва «фігури» 2–4 слова з гумором. items — намалюй задум сцени «малюнок» з деталей: чоловічок із рухами на потрібних словах + 1–3 предмети або напис.
Також title ролика (2–4 слова) і cta (заклик у кінці до 5 слів).
${SPEC}
Відповідай тільки JSON: {"title":"…","cta":"…","scenes":[{"a":0,"title":"…","plaque":"…","color":"red","items":[…]}]}`, { cache: false, kb: true, max: 4000 });
    let sc = normalize(r?.scenes || []);
    // якщо AI не попав у кількість — розставляємо сцени за фразами пропорційно
    if (sc.length < Math.max(1, board.length - 1)) { const tot = board.reduce((a, b) => a + (String(b.phrase).match(/\S+/g) || []).length, 0) || 1, n = L.words.length; let acc = 0;
      sc = board.map((b, i) => { const a = Math.min(n - 1, Math.round(acc / tot * n)); acc += (String(b.phrase).match(/\S+/g) || []).length; const prev = sc[i];
        return { a, title: prev?.title || String(b.plaque || "").slice(0, 32), plaque: String(b.plaque || ""), color: PLC[b.color] ? b.color : "red", items: prev?.items || [{ k: "man", x: .5, y: .92, moves: [] }] }; });
      sc = normalize(sc); }
    if (typeof r?.title === "string") L.title = r.title.slice(0, 32); if (typeof r?.cta === "string") L.cta = r.cta.slice(0, 48);
    return sc;
  }
  async function fromMarker({ data, sr, board, topic, style }) {
    shell("Рілс лініями"); const B = $(UI.root, ".lb"); B.innerHTML = `<div class="stage"><p class="hint">Збираю відео з твоєї розкадровки…</p></div>`;
    try {
      await E().busyRun("montage", async () => {
        let y = sr === E().SR ? Float32Array.from(data) : await E().resample(Float32Array.from(data), sr, E().SR); if (y.length / E().SR > 185) y = y.subarray(0, Math.round(185 * E().SR)).slice();
        const small = await E().resample(y, E().SR, 16000), r = await SRV.stt({ audio: E().b64(E().wav(small, 16000)), mime: "audio/wav", quiet: true });
        const dur = y.length / E().SR, words = (r.words || []).map((w) => ({ w: String(w.w), s: Math.max(0, +w.s || 0), e: Math.min(dur, Math.max((+w.s || 0) + .05, +w.e || 0)) })).filter((w) => w.w.trim());
        if (words.length < 3) throw new Error("nowords");
        L = { aud: y, words, style: style && THEMES[style] ? style : STYLE, subs: true, scenes: [], hist: [], look: { plaque: "marker" } };
        L.scenes = await aiFromBoard(board, topic); });
      prep(); track("from_marker", { v: `${L.scenes.length}sc/${Math.round(TOT)}s` }); screenEdit("Готово! «Стиль» — фон, плашки, субтитри. Лінії й рухи — голосом або ✎");
    } catch (e) { console.error(e); say(e?.message === "nowords" ? "Не почув слів в озвучці" : e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло зібрати відео. Спробуй ще раз"); close(); }
  }
  /* ---------- «Рілс маркером»: малюнок лініями замість згенерованої картинки ---------- */
  const BOXC = new Map();
  function boxItems(spec, d, seed) { const key = JSON.stringify(spec) + "|" + d.toFixed(2); if (BOXC.has(key)) return BOXC.get(key);
    const it = (spec.items || []).map((o, ii) => ({ ...o, ta: clamp(+o.at || 0, 0, .95) * d + (o.at == null ? ii * .2 : 0), mv: (o.moves || []).map((m) => ({ ...m, t: clamp(+m.p || 0, 0, .98) * d })).sort((a, b) => a.t - b.t), seed: seed * 31 + ii * 7 + 1 }));
    if (BOXC.size > 200) BOXC.clear(); BOXC.set(key, it); return it; }
  function drawBox(x, spec, lt, d, o) {
    if (!spec?.items?.length || lt < 0) return; ENV = null; BOIL = Math.floor(o.t * 8); NOBOIL = o.boil === false;
    const sty = { ink: o.ink, acc: o.acc || "#d0312d", bg: o.paper || (o.dark ? "#000" : "#fff"), paper: o.paper, glow: null, font: o.font || "Pangolin", lk: { lw: o.lw || 1 } };
    const U = 138 * o.boxH / 900; x.save(); x.globalAlpha *= o.alpha ?? 1;
    drawItems(x, boxItems(spec, d, o.seed || 1), lt, sty, 1, { X0: o.cx - o.boxW / 2, SW: o.boxW, stY: o.cy - o.boxH / 2, stH: o.boxH, U });
    x.restore();
  }
  async function boardLines(board, topic) {
    const r = await sample.json(`Ти режисер анімації «малюнок лініями» для короткого відео. Ось розкадровка — сцени по черзі (фраза, що намалювати):
${board.map((b, i) => `${i + 1}. фраза: «${b.phrase}»; малюнок: ${b.draw || b.phrase}`).join("\n")}
Тема: ${topic || "—"}.
Для КОЖНОЇ сцени (рівно ${board.length}, у тому ж порядку) намалюй задум «малюнок» з деталей: майже завжди чоловічок, що щось робить, + 1–3 предмети або напис. Час — частка тривалості сцени від 0 до 1: "at" — коли деталь з'являється, "p" у русі — коли почати рух (рухи на тих моментах фрази, про які йдеться).
${CASTSPEC}
Деталі: "man" — людина (x 0…1, y — земля, зазвичай 0.92; f — 1 вправо / -1 вліво; face "neutral"|"happy"|"sad"; who); предмети: ${KINDS.join(", ")} (x, y — центр 0…1; s — розмір 0.6…2; acc:true — червоний акцент; t — слово на card або «?»/«!» у tab; sub — маленький підпис «5 хвилин», «+6 год»); "text" — напис до 3 слів чи число, поле t.
Рухи man: talk (говорить — рот рухається; став, коли персонаж каже say), walk_to (x), run_to (x), jump, wave, cheer, think, point, shrug, sad, sit, stand, fall, hang, dance, push, work, shock, happy_face, sad_face; рухи предметів: pop, bounce, spin, shake, fly_to (x, y), grow, hide.
Простота й рух важливіші за кількість. Не дублюй текст плашки написом.
Відповідай тільки JSON: {"scenes":[{"items":[{"k":"man","x":0.4,"y":0.92,"moves":[{"p":0.3,"m":"walk_to","x":0.6}]},{"k":"money","x":0.75,"y":0.4,"at":0.4,"moves":[{"p":0.4,"m":"pop"}]}]}]}`, { cache: false, kb: true, max: 4000 });
    const cl = (v, a = 0, b = 1) => clamp(+v || 0, a, b);
    return (r?.scenes || []).slice(0, board.length).map((s) => ({ items: (s?.items || []).map(fixK).filter((it) => it && (it.k === "man" || it.k === "text" || it.k === "icon" || SH[it.k] || ANIM[it.k])).slice(0, 6).map((it) => ({ k: it.k, ...WHO(it), x: cl(it.x ?? .5, .05, .95), y: cl(it.y == null ? (it.k === "man" || ANIM[it.k] ? (ANIM[it.k]?.bird ? .92 : .92) : .5) : it.y, .05, .98), s: clamp(+it.s || 1, .4, 2.4), f: +it.f === -1 ? -1 : 1, acc: !!it.acc, t: it.t ? String(it.t).slice(0, 18) : undefined, sub: it.sub ? String(it.sub).slice(0, 18) : undefined, face: ["neutral", "happy", "sad"].includes(it.face) ? it.face : undefined, at: it.at != null ? cl(it.at, 0, .95) : undefined,
      moves: (it.moves || []).filter((m) => m && MOVES.includes(m.m)).slice(0, 6).map((m) => ({ p: cl(m.p, 0, .98), m: m.m, x: m.x != null ? cl(m.x, .05, .95) : undefined, y: m.y != null ? cl(m.y, .05, .95) : undefined })) })) }));
  }
  /* ---------- «Рілс маркером»: один безперервний світ на весь ролик, камера переїжджає ---------- */
  const toIP = (sec, T) => { let i = T.findIndex((o) => sec < o.e); if (i < 0) i = T.length - 1; const d = Math.max(.01, T[i].e - T[i].s); return { i, p: clamp((sec - T[i].s) / d, 0, 1) }; };
  const fromIP = (ip, T) => { const o = T[clamp(ip?.i | 0, 0, T.length - 1)]; return o ? o.s + clamp(+ip.p || 0) * (o.e - o.s) : 0; };
  const WC = new Map();
  function worldItems(w, T) { const key = JSON.stringify(T) + "|" + (w._v || 0); let c = WC.get(w); if (c?.key === key) return c.items;
    const items = (w.items || []).map((o, ii) => ({ ...o, _W: w.areas || 1, ta: fromIP(o.at, T), mv: (o.moves || []).map((m) => ({ ...m, t: fromIP(m.at, T) })).sort((a, b) => a.t - b.t), seed: ii * 7 + 1 })).sort((a, b) => (a.k === "man") - (b.k === "man"));
    WC.set(w, { key, items }); return items; }
  function camAt(w, t, T) { const K = (w.cam || []).map((c) => ({ t: fromIP(c.at, T), x: +c.x || .5, z: clamp(+c.z || 1, .8, 1.7) })).sort((a, b) => a.t - b.t); let cur = { x: .5, z: 1 };
    for (const c of K) { if (c.t > t) break; const p = ease(clamp((t - c.t) / 1.3)); cur = { x: cur.x + (c.x - cur.x) * p, z: cur.z + (c.z - cur.z) * p }; } return cur; }
  function drawWorld(x, w, t, o) {
    if (!w?.items?.length) return; ENV = null; BOIL = Math.floor(t * 8); NOBOIL = o.boil === false;
    const sty = { ink: o.ink, acc: o.acc || "#d0312d", bg: o.paper || (o.dark ? "#000" : "#fff"), paper: o.paper, glow: null, font: o.font || "Manrope", lk: { lw: o.lw || 1 } }, cam = camAt(w, t, o.T), U = 138 * o.boxH / 900;
    x.save(); x.translate(o.cx, o.cy); x.scale(cam.z, cam.z); x.translate(-o.cx, -o.cy);
    drawItems(x, worldItems(w, o.T), t, sty, 1, { X0: o.cx - cam.x * o.boxW, SW: o.boxW, stY: o.cy - o.boxH / 2, stH: o.boxH, U }); x.restore();
  }
  async function boardWorld(board, T, topic) {
    const tot = T[T.length - 1]?.e || 10, areas = clamp(Math.round(tot / 14) + 1, 1, 3);
    const r = await sample.json(`Ти режисер короткої анімації «малюнок лініями» (чорний маркер на аркуші). Ось сценарій по фразах із часом звучання:
${board.map((b, i) => `${i + 1}. [${T[i].s.toFixed(1)}–${T[i].e.toFixed(1)} с] «${b.phrase}» — задум: ${b.draw || "—"}`).join("\n")}
Тема: ${topic || "—"}. Тривалість ${tot.toFixed(1)} с.
Зроби ОДНУ БЕЗПЕРЕРВНУ анімацію на весь ролик — живий світ, а не слайди. Ті самі персонажі живуть від початку до кінця: рухаються, реагують, взаємодіють; нові деталі з'являються, коли про них кажуть; зайве прибирай рухом hide. Світ має ширину ${areas} екран(и) (x від 0 до ${areas}); якщо історія переходить в інше місце — камера плавно переїжджає (cam).
Відео має бути ЗРОЗУМІЛЕ БЕЗ ЗВУКУ: кожну думку показуй дією і підписами — label на персонажах і предметах («мама», «дитинча»), репліки say і думки thinkb (1–4 слова), лічильники count (from → to, t — одиниця: «років»), стрілки (arrow з r — кут), написи text, числа. Не повторюй дослівно субтитри — доповнюй картинкою.
${CASTSPEC}
Додатково можна дати wear, щоб розрізняти однакових: hair, longhair, bun, bow, hat, cap, crown, glasses, beard, tie, cape, skirt; тварина — ears+tail (мавпа), cat (кіт); малюк — s 0.5–0.6.
Деталі: "man" (x — 0…${areas}, y — земля 0.92; f 1/-1; face neutral|happy|sad; wear; label; s); предмети ${KINDS.join(", ")} (x, y 0…1 — висота на аркуші; s 0.5–2; r — кут; acc:true — червоний; t — слово на card/«?» у tab; sub; label); "text" (t); "say"/"thinkb" (t, x, y — над головою персонажа ≈0.25–0.4); "count" (from, to, t).
Рухи man: talk (говорить — рот рухається; став, коли персонаж каже say), walk_to (x), run_to (x), jump, wave, cheer, think, point, shrug, sad, sit, stand, fall, hang, dance, push, work, shock, happy_face, sad_face, hide. Рухи предметів: pop, bounce, spin, shake, fly_to (x, y), grow, hide.
Час: "at" — секунда появи деталі, у рухах "t" — секунда початку (точно на словах, про які йдеться). cam: [{"t":сек,"x":центр кадру 0.5…${areas - .5},"z":1–1.5 (наближення на важливому)}].
8–20 деталей на весь ролик, постійний рух, але без хаосу.
Відповідай тільки JSON: {"cam":[{"t":0,"x":0.5,"z":1}],"items":[{"k":"man","x":0.35,"y":0.92,"wear":["longhair","skirt"],"label":"мама","at":0.3,"moves":[{"t":1.5,"m":"wave"}]},{"k":"say","x":0.4,"y":0.3,"t":"Нарешті!","at":2,"moves":[{"t":4,"m":"hide"}]}]}`, { cache: false, kb: true, max: 4000 });
    const cl = (v, a, b) => clamp(+v || 0, a, b), WEAR = ["hair", "longhair", "bun", "bow", "hat", "cap", "crown", "glasses", "beard", "ears", "cat", "tail", "skirt", "tie", "cape"];
    const KS = new Set(["man", "text", "say", "thinkb", "count", ...KINDS]);
    const items = (r?.items || []).map(fixK).filter((it) => it && (KS.has(it.k) || KOK(it))).slice(0, 24).map((it) => ({ k: it.k, ...WHO(it), x: cl(it.x ?? .5, .05, areas - .05), y: cl(it.y == null ? (it.k === "man" || ANIM[it.k] ? (ANIM[it.k]?.bird ? .92 : .92) : .5) : it.y, .05, .98), s: cl(it.s || 1, .35, 2.4), r: it.r ? cl(it.r, -360, 360) : undefined, f: +it.f === -1 ? -1 : 1, acc: it.acc === true ? true : undefined,
      t: it.t != null ? String(it.t).slice(0, 24) : undefined, sub: it.sub ? String(it.sub).slice(0, 18) : undefined, label: it.label ? String(it.label).slice(0, 18) : undefined, face: ["neutral", "happy", "sad"].includes(it.face) ? it.face : undefined,
      wear: Array.isArray(it.wear) ? it.wear.filter((w) => WEAR.includes(w)).slice(0, 4) : undefined, from: it.from != null ? +it.from || 0 : undefined, to: it.to != null ? +it.to || 0 : undefined,
      at: toIP(cl(it.at ?? 0, 0, tot), T), moves: (it.moves || []).filter((m) => m && MOVES.includes(m.m)).slice(0, 8).map((m) => ({ at: toIP(cl(m.t ?? 0, 0, tot), T), m: m.m, x: m.x != null ? cl(m.x, .05, areas - .05) : undefined, y: m.y != null ? cl(m.y, .05, .95) : undefined })) }));
    if (!items.length) throw new Error("plan");
    const cam = (r?.cam || []).slice(0, 16).map((c) => ({ at: toIP(cl(c.t ?? 0, 0, tot), T), x: cl(c.x ?? .5, .5, areas - .5), z: cl(c.z ?? 1, .8, 1.7) }));
    return { areas, items, cam, _v: Date.now() };
  }
  /* ================= ГОРИЗОНТАЛЬНЕ ВІДЕО (YouTube 16:9): один світ, камера за героєм, фон на кількох глибинах ================= */
  const PLACES = { field: "поле", forest: "ліс", city: "місто", road: "дорога", sea: "море", mountains: "гори", room: "кімната", office: "офіс", space: "космос", none: "порожній аркуш" };
  const placeAt = (wx) => { const P = L.world?.places || []; for (let i = P.length - 1; i >= 0; i--) if (wx >= P[i].x0 - 1e-6) return P[i].kind; return P[0]?.kind || "field"; };
  const OUT = new Set(["field", "forest", "city", "road", "sea", "mountains"]);
  // декорації: детерміновані «слоти» вздовж світу — однакові в кожному кадрі, рухаються з різною швидкістю (паралакс)
  function scenery(x, t, cam, W, H, k, sty, gY, z) {
    const SW = W, vis = .62 / z, inkA = (a) => { x.globalAlpha = a; };
    const layer = (f, sp, from, draw) => { const cx = cam.x * f, a0 = Math.floor((cx - vis - .3) / sp), a1 = Math.ceil((cx + vis + .3) / sp);
      for (let i = a0; i <= a1; i++) { const lx = i * sp + (rnd(i, from) - .5) * sp * .5, sx = W / 2 + (lx - cx) * SW; draw(i, sx, lx / f); } };
    x.save();
    // небо: хмари (повільно) і зірки в космосі
    if (placeAt(cam.x) === "space") { inkA(.6); layer(.05, .05, 31, (i, sx) => { const sy = rnd(i, 32) * gY * .9; x.fillStyle = sty.ink; x.fillRect(sx, sy, 3 * k, 3 * k); });
      inkA(.5); layer(.1, 1.3, 33, (i, sx) => { const r = (60 + rnd(i, 34) * 80) * k, sy = (120 + rnd(i, 35) * 200) * k; strokes(x, [jit(arc(sx, sy, r, 0, 360, 30), i * 3, k), jit(arc(sx, sy, r * 1.7, 200, 340, 18).map(([a, b]) => [a, b + r * .15]), i * 5, k)], 1, sty, k, 3); }); }
    else if (OUT.has(placeAt(cam.x))) { inkA(.42); layer(.12, .42, 11, (i, sx, wx) => { if (!OUT.has(placeAt(wx))) return; const sy = (90 + rnd(i, 12) * 170) * k, w = (110 + rnd(i, 13) * 120) * k, dx = -((t * 6 * k) % (W * 2));
        const c = [...arc(sx + dx - w * .35, sy, w * .28, 180, 300, 8), ...arc(sx + dx, sy - w * .12, w * .34, 210, 340, 8), ...arc(sx + dx + w * .38, sy, w * .26, 240, 360, 8), [sx + dx + w * .64, sy + w * .16], [sx + dx - w * .63, sy + w * .16]]; c.push(c[0]);
        strokes(x, [jit(c, i * 7, k)], 1, sty, k, 3.2); }); }
    // далекий план: гори
    inkA(.32); layer(.25, .32, 21, (i, sx, wx) => { const pl = placeAt(wx); if (!["mountains", "field", "road", "forest"].includes(pl)) return; const h = (pl === "mountains" ? 380 : 190) * k * (.6 + rnd(i, 22) * .6), w = (pl === "mountains" ? 330 : 380) * k;
      strokes(x, [jit([[sx - w, gY - 40 * k], [sx - w * .25, gY - h * .7], [sx, gY - h], [sx + w * .3, gY - h * .6], [sx + w, gY - 40 * k]], i * 9, k)], 1, sty, k, 3.5); });
    // середній план: дерева / будинки / стовпи / хвилі / вікна
    inkA(.6); layer(.55, .13, 41, (i, sx, wx) => { const pl = placeAt(wx), r = rnd(i, 42);
      if (pl === "forest" || (pl === "field" && r < .3) || (pl === "road" && r < .2)) { const h = (150 + r * 140) * k, tw = 5;
        strokes(x, r < .5 ? [jit([[sx, gY - 40 * k], [sx, gY - 40 * k - h * .45]], i, k), jit(arc(sx, gY - 40 * k - h * .45 - h * .3, h * .3, 0, 360, 18), i + 1, k)] : [jit([[sx, gY - 40 * k], [sx, gY - 40 * k - h * .3]], i, k), jit([[sx - h * .3, gY - 40 * k - h * .3], [sx, gY - 40 * k - h * 1.05], [sx + h * .3, gY - 40 * k - h * .3], [sx - h * .3, gY - 40 * k - h * .3]], i + 1, k)], 1, sty, k, tw); }
      else if (pl === "city" && r < .85) { const w = (90 + r * 80) * k, h = (230 + rnd(i, 43) * 330) * k, b = gY - 40 * k, L2 = [jit(rect(sx - w / 2, b - h, w, h), i, k)];
        for (let wy = b - h + 28 * k; wy < b - 50 * k; wy += 56 * k) for (let wx2 = sx - w / 2 + 18 * k; wx2 < sx + w / 2 - 26 * k; wx2 += 36 * k) if (rnd(i * 31 + wx2, wy) < .7) L2.push(rect(wx2, wy, 16 * k, 24 * k));
        strokes(x, L2, 1, sty, k, 3.2); }
      else if (pl === "road" && i % 3 === 0) { strokes(x, [jit([[sx, gY - 40 * k], [sx, gY - 330 * k]], i, k), jit([[sx - 40 * k, gY - 310 * k], [sx + 40 * k, gY - 310 * k]], i + 1, k)], 1, sty, k, 3.5); }
      else if (pl === "sea" && i % 2 === 0) { const sy = gY - (40 + r * 120) * k; strokes(x, [jit([...arc(sx - 30 * k, sy, 30 * k, 200, 340, 8), ...arc(sx + 30 * k, sy, 30 * k, 200, 340, 8)], i, k)], 1, sty, k, 3); if (r < .15) strokes(x, [jit([[sx - 90 * k, sy - 30 * k], [sx + 90 * k, sy - 30 * k], [sx + 60 * k, sy], [sx - 60 * k, sy], [sx - 90 * k, sy - 30 * k]], i + 2, k), jit([[sx, sy - 30 * k], [sx, sy - 180 * k], [sx + 70 * k, sy - 50 * k], [sx, sy - 50 * k]], i + 3, k)], 1, sty, k, 3.5); }
      else if ((pl === "room" || pl === "office") && i % 4 === 0) { const wy = gY - 560 * k; strokes(x, r < .5 ? [jit(rect(sx - 110 * k, wy, 220 * k, 200 * k), i, k), jit([[sx, wy], [sx, wy + 200 * k]], i + 1, k), jit([[sx - 110 * k, wy + 100 * k], [sx + 110 * k, wy + 100 * k]], i + 2, k)] : pl === "office" ? [jit(rect(sx - 140 * k, gY - 360 * k, 280 * k, 320 * k), i, k), jit([[sx - 140 * k, gY - 200 * k], [sx + 140 * k, gY - 200 * k]], i + 1, k)] : [jit(rect(sx - 70 * k, wy + 40 * k, 140 * k, 100 * k), i, k)], 1, sty, k, 3.2); } });
    // передній план: земля, трава, розмітка дороги, підлога
    inkA(1); const pl0 = placeAt(cam.x); strokes(x, [jit([[0, gY], [W, gY]], 99, k)], 1, sty, k, 4.5);
    inkA(.55); layer(1, .035, 51, (i, sx, wx) => { const pl = placeAt(wx), r = rnd(i, 52);
      if (pl === "field" || pl === "forest" || pl === "mountains") { if (r < .55) strokes(x, [[[sx, gY], [sx - 8 * k, gY - (10 + r * 22) * k]], [[sx + 6 * k, gY], [sx + 12 * k, gY - (8 + r * 18) * k]]], 1, sty, k, 2.5); }
      else if (pl === "road") { if (i % 3 === 0) strokes(x, [[[sx, gY + 45 * k], [sx + 40 * k, gY + 45 * k]]], 1, sty, k, 4); }
      else if (pl === "city") { if (i % 6 === 0) strokes(x, [[[sx, gY + 18 * k], [sx, gY + 70 * k]]], 1, sty, k, 2.5); }
      else if (pl === "sea") { if (r < .4) strokes(x, [arc(sx, gY + 28 * k, 16 * k, 200, 340, 6)], 1, sty, k, 2.5); }
      else if (pl === "room" || pl === "office") { if (i % 8 === 0) strokes(x, [[[sx, gY], [sx, gY + 60 * k]]], 1, sty, k, 2); } });
    x.restore(); void pl0;
  }
  function heroAt(t) { const it = WITEMS.find((o) => o.k === "man" && o.hero) || WITEMS.find((o) => o.k === "man"); if (!it || t < it.ta - .5) return null; return manAt(it, t).x; }
  let WITEMS = [], WKEY = "";
  function wprep() { const key = JSON.stringify(L.world.items) + (L.world._v || 0); if (key === WKEY) return; WKEY = key;
    WITEMS = L.world.items.map((o, ii) => ({ ...o, _W: L.world.end || 1, floor: false, ta: +o.at || 0, mv: (o.moves || []).map((m) => ({ ...m, t: +m.t || 0 })).sort((a, b) => a.t - b.t), seed: ii * 7 + 1 })).sort((a, b) => (a.k === "man") - (b.k === "man")); }
  function camWide(t) { let z = 1, cx = null; const K = (L.world.cam || []).slice().sort((a, b) => a.t - b.t);
    for (const c of K) { if (c.t > t) break; const p = ease(clamp((t - c.t) / 1.4)); z = z + ((+c.z || 1) - z) * p; if (c.x != null) cx = cx == null ? +c.x : cx + (+c.x - cx) * p; }
    const h = heroAt(t), end = L.world.end || 1; let x0 = h != null ? h : cx != null ? cx : .5; if (cx != null && h != null) x0 = h * .7 + cx * .3;
    return { x: clamp(x0, .5 / z, end - .5 / z), z }; }
  function drawWide(x, t, W, H) {
    const sty = styOf(), k = W / 1920; BOIL = Math.floor(t * 8); NOBOIL = sty.lk.boil === false; wprep();
    paintBg(x, W, H, k, sty);
    const stY = 130 * k, stH = 860 * k, gY = stY + .92 * stH, cam = camWide(t);
    x.save(); x.translate(W / 2, gY); x.scale(cam.z, cam.z); x.translate(-W / 2, -gY);
    scenery(x, t, cam, W, H, k, sty, gY, cam.z);
    drawItems(x, WITEMS, t, sty, k, { X0: W / 2 - cam.x * W, SW: W, stY, stH, U: 120 * k });
    x.restore();
    if (sty.vig) { const g = x.createRadialGradient(W / 2, H * .45, H * .2, W / 2, H * .5, W * .6); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)"); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    drawIns(x, t, W, H, k, sty); if (!(L.title && sty.lk.frame !== "hide" && t < 4.5)) drawPops(x, t, W, k, sty);
    // назва на початку (4 с), субтитри внизу, заклик у кінці
    if (L.title && sty.lk.frame !== "hide" && t < 4.5) { x.save(); x.globalAlpha = clamp((4.5 - t) / .5); drawTitle(x, t, W, k * 1.0, sty); x.restore(); }
    if (L.cta && t > TOT - 3.5) { x.save(); x.globalAlpha = clamp((t - (TOT - 3.5)) / .4); x.font = `800 ${Math.round(56 * k)}px "${sty.font}", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = sty.ink; if (sty.glow) { x.shadowColor = sty.glow; x.shadowBlur = 16 * k; } x.fillText(L.cta, W / 2, 140 * k, W * .8); x.restore(); }
    const sv = sty.lk.subs; if (L.subs === false || sv === "off") return; const ch = CH.find((c) => t >= c.s - .05 && t < c.until); if (!ch) return;
    const px = Math.round((sv === "hand" ? 64 : 48) * k); x.save(); x.font = `${sv === "hand" ? 600 : 800} ${px}px "${sv === "hand" ? "Caveat" : "Manrope"}", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle";
    const txt = ch.idx.map((i) => sv === "yellow" ? L.words[i].w.toUpperCase() : L.words[i].w).join(" "), y = 1010 * k, tw = Math.min(W * .8, x.measureText(txt).width); x.globalAlpha = clamp((t - ch.s + .05) / .15);
    if (sv === "box") { x.fillStyle = "rgba(0,0,0,.72)"; rrp(x, (W - tw) / 2 - 24 * k, y - px * .75, tw + 48 * k, px * 1.5, 14 * k); x.fill(); x.fillStyle = "#fff"; }
    else if (sv === "yellow") { x.lineWidth = 8 * k; x.strokeStyle = "#000"; x.lineJoin = "round"; x.strokeText(txt, W / 2, y, W * .8); x.fillStyle = "#ffd60a"; }
    else { x.fillStyle = sty.ink; if (sty.glow) { x.shadowColor = sty.glow; x.shadowBlur = 12 * k; } else { x.lineWidth = 7 * k; x.strokeStyle = sty.bg; x.lineJoin = "round"; x.strokeText(txt, W / 2, y, W * .8); } }
    x.fillText(txt, W / 2, y, W * .8); x.restore();
  }
  // сюжет частинами по ~40 с: ті самі персонажі, світ продовжується вправо, місця змінюються
  const SEGLEN = 40;
  function phrasesOf() { const P = []; let c = null; L.words.forEach((w) => { if (!c) c = { s: w.s, e: w.e, t: w.w }; else { c.t += " " + w.w; c.e = w.e; } if (/[.!?…]$/.test(w.w) || c.t.split(" ").length > 22) { P.push(c); c = null; } }); c && P.push(c); return P; }
  async function aiSegment(seg, i, n, cast, extra = "") {
    const areas = clamp(Math.round((seg.t1 - seg.t0) / 13) + 1, 1, 4), x0 = seg.x0, x1 = x0 + areas;
    const r = await sample.json(`Ти режисер горизонтального анімаційного відео для YouTube у стилі «малюнок лініями» (як мультик маркером). Це частина ${i + 1} з ${n} одного безперервного сюжету.
Текст озвучки цієї частини з часом (секунди):
${seg.ph.map((p) => `[${p.s.toFixed(1)}–${p.e.toFixed(1)}] ${p.t}`).join("\n")}
${cast.length ? `Персонажі, які вже є в історії (продовжуй їх, не створюй заново): ${cast.map((c) => `«${c.id}» (${c.desc}, зараз x=${c.x.toFixed(2)})`).join("; ")}.` : "Це початок — представ героя."}
Світ — довга стрічка вліво-вправо; ця частина займає x від ${x0} до ${x1} (1 = ширина екрана). Камера сама їде за головним героєм, тож щоб показати нове місце — веди героя туди walk_to/run_to. Історія має йти без розривів: персонажі ходять між місцями, нові деталі з'являються саме тоді, коли про них кажуть, зайве прибирай hide.
Місця (places) — фон, що пролітає позаду: ${Object.entries(PLACES).map(([k, v]) => `${k} (${v})`).join(", ")}; поділи [${x0}, ${x1}] на 1–3 місця під сюжет.
Відео має бути ЗРОЗУМІЛЕ БЕЗ ЗВУКУ: дії, підписи label, репліки say і думки thinkb (1–4 слова), лічильники count (from → to, t — одиниця), стрілки arrow (r — кут), написи text, предмети, що вилітають (fly_to за межі кадру).
${CASTSPEC}
Нові деталі: "man" (who; id — коротке ім'я; x; y 0.92; f; face; wear: hair, longhair, bun, bow, hat, cap, crown, glasses, beard, tie, cape, skirt, ears+tail — мавпа, cat — кіт; s — розмір, малюк 0.55; hero:true — головний, лише один на весь ролик), предмети ${KINDS.join(", ")} (x, y 0…1 — висота; s; r; acc; t; sub; label), "text", "say"/"thinkb" (t; x, y ≈ 0.3 над головою), "count" (from, to, t).
Рухи man: talk (говорить — рот рухається; став, коли персонаж каже say), walk_to (x), run_to (x), jump, wave, cheer, think, point, shrug, sad, sit, stand, fall, hang, dance, push, work, shock, happy_face, sad_face, hide. Предмети: pop, bounce, spin, shake, fly_to (x, y), grow, hide.
Час — секунди з тексту вище: "at" — поява, "t" у рухах — початок руху точно на потрібних словах. Наближення камери: cam [{"t":сек,"z":1–1.6}] на важливих моментах.
${extra}
Відповідай тільки JSON: {"places":[{"x0":${x0},"x1":${x1},"kind":"field"}],"items":[{"k":"man","id":"Олег","hero":true,"x":${(x0 + .4).toFixed(2)},"y":0.92,"wear":["cap"],"label":"Олег","at":${seg.t0.toFixed(1)},"moves":[{"t":${(seg.t0 + 1).toFixed(1)},"m":"walk_to","x":${(x0 + 1).toFixed(2)}}]}],"moves":[{"id":"ім'я наявного персонажа","t":0,"m":"walk_to","x":0}],"cam":[{"t":0,"z":1.2}]}`, { cache: false, kb: true, max: 4000 });
    const cl = (v, a, b) => clamp(+v || 0, a, b), T0 = seg.t0, T1 = seg.t1, WEAR = ["hair", "longhair", "bun", "bow", "hat", "cap", "crown", "glasses", "beard", "ears", "cat", "tail", "skirt", "tie", "cape"], KS = new Set(["man", "text", "say", "thinkb", "count", ...KINDS]);
    const mv = (m) => ({ t: cl(m.t, T0, T1), m: m.m, x: m.x != null ? cl(m.x, .05, x1 + 1) : undefined, y: m.y != null ? cl(m.y, .02, .98) : undefined, seg: i });
    const items = (r?.items || []).map(fixK).filter((it) => it && (KS.has(it.k) || KOK(it))).slice(0, 22).map((it) => ({ k: it.k, ...WHO(it), id: it.id ? String(it.id).slice(0, 16) : undefined, hero: !!it.hero, seg: i, x: cl(it.x ?? x0 + .5, .05, x1 + 1), y: cl(it.y == null ? (it.k === "man" || ANIM[it.k] ? (ANIM[it.k]?.bird ? .92 : .92) : .5) : it.y, .02, .98), s: cl(it.s || 1, .35, 2.4), r: it.r ? cl(it.r, -360, 360) : undefined, f: +it.f === -1 ? -1 : 1, acc: it.acc === true ? true : undefined,
      t: it.t != null ? String(it.t).slice(0, 26) : undefined, sub: it.sub ? String(it.sub).slice(0, 18) : undefined, label: it.label ? String(it.label).slice(0, 18) : undefined, face: ["neutral", "happy", "sad"].includes(it.face) ? it.face : undefined,
      wear: Array.isArray(it.wear) ? it.wear.filter((w) => WEAR.includes(w)).slice(0, 4) : undefined, from: it.from != null ? +it.from || 0 : undefined, to: it.to != null ? +it.to || 0 : undefined,
      at: cl(it.at ?? T0, T0, T1), moves: (it.moves || []).filter((m) => m && MOVES.includes(m.m)).slice(0, 10).map(mv) }));
    const extraMoves = (r?.moves || []).filter((m) => m && m.id && MOVES.includes(m.m)).slice(0, 20).map((m) => ({ id: String(m.id), ...mv(m) }));
    const places = (r?.places || []).filter((p) => p && PLACES[p.kind]).slice(0, 4).map((p) => ({ x0: cl(p.x0 ?? x0, x0, x1), kind: p.kind, seg: i })).sort((a, b) => a.x0 - b.x0);
    if (!places.length) places.push({ x0, kind: "field", seg: i });
    const cam = (r?.cam || []).slice(0, 8).map((c) => ({ t: cl(c.t, T0, T1), z: cl(c.z || 1, .8, 1.7), seg: i }));
    return { items, extraMoves, places, cam, end: x1 };
  }
  function castOf(upTo) { return (L.world?.items || []).filter((o) => o.k === "man" && o.id && !(o.moves || []).some((m) => m.m === "hide" && m.t < upTo)).map((o) => {
    const it = { ...o, ta: o.at, mv: (o.moves || []).map((m) => ({ ...m })).sort((a, b) => a.t - b.t), _W: L.world.end }; return { id: o.id, desc: [o.label, ...(o.wear || []), o.s < .8 ? "малий" : ""].filter(Boolean).join(", "), x: manAt(it, upTo).x }; }); }
  function mergeSeg(i, res) { const W2 = L.world;
    W2.items = W2.items.filter((o) => o.seg !== i).map((o) => ({ ...o, moves: (o.moves || []).filter((m) => m.seg !== i) }));
    W2.places = W2.places.filter((p) => p.seg !== i).concat(res.places).sort((a, b) => a.x0 - b.x0); W2.cam = W2.cam.filter((c) => c.seg !== i).concat(res.cam);
    for (const m of res.extraMoves) { const o = W2.items.find((q) => q.k === "man" && q.id === m.id); if (o) o.moves.push(m); }
    if (W2.items.some((o) => o.hero)) res.items.forEach((o) => { o.hero = false; });
    W2.items.push(...res.items); W2.end = Math.max(W2.end || 1, res.end); W2._v = Date.now(); }
  async function aiWorld(onStage) {
    const P = phrasesOf(), segs = []; let cur = null;
    for (const p of P) { if (!cur || (p.e - cur.t0 > SEGLEN && cur.ph.length)) { cur && segs.push(cur); cur = { t0: cur ? cur.t1 : 0, ph: [] }; } cur.ph.push(p); cur.t1 = p.e; }
    cur && segs.push(cur); if (segs.length) segs[segs.length - 1].t1 = TOT;
    const r0 = await sample.json(`Придумай для горизонтального YouTube-відео за цим текстом: title — назва 2–5 слів; cta — заклик у кінці до 6 слів. Текст: ${P.map((p) => p.t).join(" ").slice(0, 3000)}. Відповідай тільки JSON {"title":"…","cta":"…"}`, { cache: false }).catch(() => null);
    if (r0?.title) L.title = String(r0.title).slice(0, 40); if (r0?.cta) L.cta = String(r0.cta).slice(0, 60);
    L.world = { items: [], places: [], cam: [], end: 1, segs: [], _v: Date.now() };
    let x0 = 0;
    for (let i = 0; i < segs.length; i++) { onStage?.(i, segs.length); const sg = segs[i]; sg.x0 = x0; const res = await aiSegment(sg, i, segs.length, castOf(sg.t0)); mergeSeg(i, res); x0 = res.end; L.world.segs.push({ t0: sg.t0, t1: sg.t1, x0: sg.x0, ph: sg.ph }); }
    if (!L.world.items.length) throw new Error("plan");
  }
  async function editWide(text) {
    const th = Object.entries(THEMES).find(([k, v]) => new RegExp(v.n, "i").test(text)); if (th && /фон|стиль|тем/i.test(text)) { L.style = th[0]; return `Фон: ${th[1].n}`; }
    const t = POS || 0, i = Math.max(0, L.world.segs.findIndex((g) => t >= g.t0 && t < g.t1)); await regenSeg(i, `Людина просить змінити цю частину: «${text}». Збережи все інше, зміни саме це.`); return `Змінено частину ${i + 1}`; }
  async function regenSeg(i, extra) { const sg = L.world.segs[i]; const res = await aiSegment(sg, i, L.world.segs.length, castOf(sg.t0), extra); mergeSeg(i, res); }
  loadIcons();
  window.YVLines = { open(o = {}) { FMT = o.wide ? "wide" : "tall"; screenSetup(); track(o.wide ? "open_yt" : "open"); }, fromMarker, drawBox, boardLines, drawWorld, boardWorld, _t: { set: (l) => { L = l; prep(); }, drawFrame, prep, exportVideo, figure, POSE, SH, STYLES, tot: () => TOT, screenEdit, aiScenes, L: () => L } };
})();
