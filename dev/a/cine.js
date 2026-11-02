/* YuVi · «Кіно-анімація» (тест, лише власник) — вертикальні Reels у стилі кіно-мультиків з YouTube:
   плаский герой-чоловічок (темна кругла голова, світлі очі, худі), намальовані локації зі світлом і пилом,
   повільні наїзди камери, великі написи з виділеним словом, HUD-панелі, музика й звуки на діях.
   Усе малюється кодом на полотні — без генерації картинок, тому майже безкоштовно. План сцен складає AI з бази знань. */
(() => {
  "use strict";
  const E = () => window.YVTalk._t;
  const W = 1080, H = 1920, FPS = 30;
  const $ = (r, s) => r.querySelector(s);
  const escH = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const say = (t) => { try { toast(t); } catch (e) {} };
  const track = (st, m) => { try { window.yvTrack?.("cine", st, m); } catch (e) {} };
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  const AC = () => (window.__yvTalkAC ||= new (window.AudioContext || window.webkitAudioContext)());
  const rnd = (a, b = 0) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
  const ease = (v) => v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
  const eout = (v) => 1 - Math.pow(1 - clamp(v), 3);
  const eio = (v) => { v = clamp(v); return v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
  const back = (v) => { v = clamp(v); const c = 1.7; return 1 + (c + 1) * Math.pow(v - 1, 3) + c * Math.pow(v - 1, 2); };
  const D = Math.PI / 180;
  const FONT = "Rubik";
  // безпечна зона соцмереж (Reels/TikTok/Shorts): зверху ~230 px, праворуч від 920 px — кнопки, знизу від 1460 px — підпис
  const SAFE = { top: 230, right: 920, bottom: 1460, left: 60 }, SCX = (SAFE.left + SAFE.right) / 2, SAFEW = SAFE.right - SAFE.left;
  let FONTP = null;
  const loadFont = () => FONTP ||= (async () => { try { if (!window.FontFace) return; const f = new FontFace(FONT, "url(a/Rubik.woff)", { weight: "300 900" }); await f.load(); document.fonts.add(f); } catch (e) { console.warn("font", e); } })();
  const hex = (h) => { h = h.replace("#", ""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const rgb = (a) => `rgb(${a.map((v) => Math.round(clamp(v, 0, 255))).join(",")})`;
  const mix = (a, b, p) => rgb(hex(a).map((v, i) => lerp(v, hex(b)[i], p)));
  const shade = (c, p) => p < 0 ? mix(c, "#000000", -p) : mix(c, "#ffffff", p);
  const rr = (x, X, Y, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); };

  /* ---------- палітри ---------- */
  const INK = "#232129", LEG = "#2b2932";
  const HOOD = { yellow: "#d8c25c", teal: "#79a7a6", coral: "#cf8b6d", purple: "#8b79bb", green: "#8bab67", blue: "#6c8fc6", orange: "#e19349", white: "#e7e3d9", red: "#c65a50", pink: "#d98fa6", grey: "#9a98a3" };
  const TIME = {
    day: { sky: ["#cfe3ee", "#f3efe2"], tint: "#fff3d8", ray: "rgba(255,244,214,", grade: "#f6e7c8", amb: 0, win: "#e9f1ee" },
    sunset: { sky: ["#8f7fae", "#f4c08a"], tint: "#ffd2a0", ray: "rgba(255,206,150,", grade: "#f2b27a", amb: -.06, win: "#f6cf9c" },
    night: { sky: ["#1b1d3a", "#3b3a6a"], tint: "#8f9ad8", ray: "rgba(170,190,255,", grade: "#3a3f7a", amb: -.32, win: "#2c2f58" },
  };

  /* ---------- кістяк героя: кути в градусах, 0 = вниз, + = у бік погляду ---------- */
  const POSE = {
    stand: { a: [[-8, 12], [6, 14]], l: [[-3, 0], [4, 0]] },
    talk: { a: [[-6, 10], [38, 62]], l: [[-3, 0], [4, 0]] },
    think: { a: [[18, 120], [34, 138]], l: [[-2, 0], [6, 0]], ht: 8 },
    point: { a: [[-6, 12], [96, 4]], l: [[-4, 0], [6, 0]] },
    shrug: { a: [[-38, -78], [38, 78]], l: [[-4, 0], [4, 0]], ht: -6 },
    cheer: { a: [[-158, -12], [160, 10]], l: [[-8, 0], [8, 0]], ht: -8 },
    sad: { a: [[-2, 4], [3, 6]], l: [[-2, 0], [2, 0]], lean: 8, ht: 16 },
    phone: { a: [[-6, 12], [32, 128]], l: [[-3, 0], [4, 0]], ht: 6 },
    shock: { a: [[-60, -70], [62, 70]], l: [[-9, 0], [9, 0]], ht: -10, lean: -6 },
    wave: { a: [[-6, 12], [150, 30]], l: [[-3, 0], [4, 0]] },
    hold: { a: [[-6, 12], [62, 52]], l: [[-3, 0], [4, 0]] },
    sit: { a: [[30, 50], [52, 38]], l: [[88, -88], [92, -90]], sit: 1 },
    sitsad: { a: [[8, 30], [14, 34]], l: [[86, -86], [90, -88]], sit: 1, lean: 14, ht: 18 },
    lie: { a: [[4, 6], [8, 10]], l: [[0, 0], [3, 0]], lie: 1 },
    walk: { walk: 1 }, run: { walk: 2 },
  };
  const FACE = ["calm", "happy", "sad", "angry", "shock", "smirk", "worried", "sleep"];
  const WHO = {
    dog: { s: 1, pet: 1 }, cat: { s: 1, pet: 1 },
    hero: { s: 1 }, man: { s: 1 }, woman: { s: .96, hair: 1 }, kid: { s: .66, hs: 1.18 }, doctor: { s: 1, coat: 1, glasses: 1 },
    boss: { s: 1.03, suit: 1 }, old: { s: .95, grey: 1, lean: 6 }, girl: { s: .7, hs: 1.16, hair: 1 },
    shadow: { s: 1 }, // тінь-демон: чорний силует із червоним світінням (лінь, страх, залежність, внутрішній голос)
  };
  const ACC = ["none", "beanie", "glasses", "cap", "headphones"];

  /* ---------- тварини: собаки (мальтипу, вівчарка, лабрадор, хаскі) і коти — пласкі, у стилі героя ---------- */
  const BREED = {
    maltipoo: { n: "Мальтипу", dog: 1, S: 150, c: "#ead2ad", d: "#d4b48a", fluffy: 1, ear: "fluff", tail: "pom" },
    shepherd: { n: "Вівчарка", dog: 1, S: 285, c: "#c88d4f", d: "#2a2520", saddle: 1, mask: "#2f2924", ear: "up", tail: "bush" },
    labrador: { n: "Лабрадор", dog: 1, S: 265, c: "#e3b96b", d: "#c99a4e", ear: "flop", tail: "otter" },
    husky: { n: "Хаскі", dog: 1, S: 265, c: "#8a909b", d: "#5f6570", white: 1, ear: "up", tail: "curl", eye: "#7fc4f0" },
    ginger: { n: "Руда кішка", cat: 1, S: 170, c: "#e0904a", d: "#b86a2c", stripes: 1, eye: "#9cc35a" },
    black: { n: "Чорна кішка", cat: 1, S: 170, c: "#2e2b33", d: "#1d1b22", eye: "#e8c84a" },
    grey: { n: "Сіра кішка", cat: 1, S: 170, c: "#9a97a0", d: "#6f6c76", stripes: 1, eye: "#9cc35a" },
    white: { n: "Біла кішка", cat: 1, S: 170, c: "#eeeae2", d: "#cfcac0", eye: "#7fc4f0" },
    siamese: { n: "Сіамська кішка", cat: 1, S: 170, c: "#efe3cc", d: "#5a4234", points: 1, eye: "#7fc4f0" },
  };
  const PETPOSE = ["stand", "walk", "run", "sit", "lie", "talk"];
  function animal(x, X, Y, c, t) {
    const B = c._B || BREED[c.breed] || BREED.labrador, S = B.S * (c.scale || 1), f = c.f || 1, pose = PETPOSE.includes(c.pose) ? c.pose : "stand", sd = (c.seed || 0);
    const walk = pose === "walk" || pose === "run" ? Math.sin(t * (pose === "run" ? 16 : 9) + sd) : 0, sit = pose === "sit", lie = pose === "lie";
    const fill = (col, f2) => { x.fillStyle = col; x.beginPath(); f2(); x.fill(); };
    const blob = (cx, cy, rx, ry, col, rot = 0) => fill(col, () => x.ellipse(cx, cy, rx, ry, rot, 0, 7));
    x.save(); x.translate(X, Y); x.scale(f, 1);
    if (c._gs) { const gs = c._gs; gs.save(); gs.setTransform(x.getTransform()); gs.globalAlpha = .22; gs.fillStyle = "#000"; gs.beginPath(); gs.ellipse(0, 0, S * .85, S * .07, 0, 0, 7); gs.fill(); gs.restore(); }
    else { x.save(); x.globalAlpha = .22; blob(0, 0, S * .85, S * .07, "#000"); x.restore(); }
    const bodyY = lie ? -S * .3 : -S * .72 + Math.abs(walk) * S * .03, bodyTilt = sit ? -.55 : 0, rx = B.cat ? S * .62 : S * .7, ry = B.cat ? S * .25 : S * .3;
    const legW = B.cat ? S * .1 : S * .14, legC = B.points ? B.d : B.c, legD = shade(legC, -.18);
    // хвіст
    const wag = Math.sin(t * (B.dog ? 9 : 2.2) + sd) * (B.dog ? .35 : .25);
    x.save(); x.translate(-rx * .9, bodyY - ry * .3 + (sit ? S * .25 : 0)); x.rotate(wag);
    x.strokeStyle = B.points ? B.d : B.tail === "bush" ? shade(B.c, -.1) : B.c; x.lineCap = "round";
    if (B.cat) { x.lineWidth = S * .09; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-S * .35, -S * .05, -S * .45, -S * .45, -S * .25, -S * .6); x.stroke(); if (B.stripes) { x.strokeStyle = B.d; x.lineWidth = S * .1; [.3, .55, .8].forEach((p) => { x.beginPath(); x.moveTo(-S * .45 * p, -S * .55 * p * p); x.lineTo(-S * .45 * p - S * .02, -S * .55 * p * p - S * .05); x.stroke(); }); } }
    else if (B.tail === "curl") { x.lineWidth = S * .13; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-S * .2, -S * .35, S * .15, -S * .5, S * .2, -S * .2); x.stroke(); x.strokeStyle = "#f1efea"; x.lineWidth = S * .06; x.beginPath(); x.moveTo(-S * .05, -S * .25); x.bezierCurveTo(0, -S * .4, S * .15, -S * .42, S * .18, -S * .25); x.stroke(); }
    else if (B.tail === "pom") { blob(-S * .1, -S * .12, S * .17, S * .15, B.c); blob(-S * .2, -S * .05, S * .12, S * .1, B.d); }
    else if (B.tail === "bush") { x.lineWidth = S * .16; x.strokeStyle = shade(B.c, -.12); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(-S * .28, S * .12, -S * .3, S * .45); x.stroke(); x.lineWidth = S * .1; x.strokeStyle = B.d; x.beginPath(); x.moveTo(-S * .29, S * .3); x.lineTo(-S * .3, S * .47); x.stroke(); }
    else { x.lineWidth = S * .14; x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(-S * .35, S * .05, -S * .48, S * .3); x.stroke(); }
    x.restore();
    // дальні лапи
    const leg = (lx, ph, col, back) => { const sw = walk * (ph ? 1 : -1) * .35, top = bodyY + ry * .3, len = -top;
      if (lie) { blob(lx + S * .25, -S * .07, S * .22, S * .07, col); return; }
      if (sit && back) { blob(lx + S * .1, -S * .2, S * .26, S * .2, col); blob(lx + S * .28, -S * .05, S * .14, S * .06, col); return; }
      x.save(); x.translate(lx, top); x.rotate(sw); x.fillStyle = col; x.beginPath(); x.moveTo(-legW * .62, 0); x.lineTo(legW * .62, 0); x.lineTo(legW * .42, len - S * .04); x.lineTo(-legW * .42, len - S * .04); x.closePath(); x.fill(); blob(legW * .2, len - S * .035, legW * .62, legW * .36, col); x.restore(); };
    const fx = sit ? rx * .35 : rx * .62, bx = sit ? -rx * .45 : -rx * .62;
    leg(bx + S * .08, 0, legD, 1); leg(fx + S * .08, 1, legD, 0);
    // тіло
    x.save(); x.translate(0, bodyY + (sit ? -S * .05 : 0)); x.rotate(bodyTilt);
    if (B.fluffy) { for (let i = 0; i < 9; i++) blob(-rx * .7 + i * rx * .18, (i % 2 ? -ry * .2 : ry * .1) + Math.sin(i * 2.1) * ry * .15, ry * .62, ry * .62, i % 3 ? B.c : B.d); }
    else blob(0, 0, rx, ry, B.c);
    if (B.saddle) blob(-rx * .15, -ry * .45, rx * .62, ry * .55, B.d, -.05);
    if (B.white) blob(rx * .1, ry * .45, rx * .7, ry * .45, "#f1efea");
    if (B.stripes) { x.strokeStyle = B.d; x.lineWidth = S * .05; x.lineCap = "round"; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-rx * .5 + i * rx * .3, -ry * .95); x.lineTo(-rx * .45 + i * rx * .3, -ry * .35); x.stroke(); } }
    x.restore();
    // ближні лапи
    leg(bx - S * .05, 1, legC, 1); leg(fx - S * .05, 0, legC, 0);
    // голова
    const bob = Math.sin(t * 2 + sd) * S * .015 + (pose === "talk" ? Math.sin(t * 14) * S * .02 : 0);
    const hx = sit ? rx * .55 : rx * .95, hy = (sit ? bodyY - S * .55 : lie ? bodyY - S * .22 : bodyY - S * .38) + bob, hr = B.cat ? S * .27 : S * (B.fluffy ? .3 : .26);
    if (!lie && !sit) blob(hx - S * .15, hy + S * .2, S * .16, S * .22, B.white ? "#f1efea" : B.c, -.6);
    const earC = B.points ? B.d : B.ear === "up" ? (B.mask || B.c) : B.d;
    const tri = (ex, ey, w, h, col, rot) => { x.save(); x.translate(ex, ey); x.rotate(rot); fill(col, () => { x.moveTo(-w / 2, 0); x.lineTo(0, -h); x.lineTo(w / 2, 0); }); x.restore(); };
    if (B.cat) { tri(hx - hr * .55, hy - hr * .6, hr * .7, hr * .75, earC, -.25); tri(hx + hr * .25, hy - hr * .7, hr * .7, hr * .8, earC, .2); tri(hx + hr * .25, hy - hr * .78, hr * .35, hr * .45, "#e9a3a3", .2); }
    else if (B.ear === "up") { tri(hx - hr * .5, hy - hr * .55, hr * .62, hr * 1.05, shade(earC, -.1), -.2); tri(hx + hr * .1, hy - hr * .7, hr * .62, hr * 1.1, earC, .1); if (B.white) tri(hx + hr * .1, hy - hr * .8, hr * .3, hr * .6, "#e9a3a3", .1); }
    if (B.fluffy) { for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; blob(hx + Math.cos(a) * hr * .55, hy + Math.sin(a) * hr * .55, hr * .5, hr * .5, i % 2 ? B.c : B.d); } }
    blob(hx, hy, hr, hr * .95, B.c);
    if (B.white) { blob(hx + hr * .25, hy + hr * .35, hr * .75, hr * .55, "#f1efea"); blob(hx + hr * .05, hy - hr * .2, hr * .18, hr * .12, "#f1efea"); }
    if (B.points) blob(hx + hr * .35, hy + hr * .15, hr * .6, hr * .55, B.d);
    // морда
    const sx = hx + hr * (B.cat ? .62 : .78), sy = hy + hr * .28, open = pose === "talk" ? Math.abs(Math.sin(t * 12)) : 0;
    if (!B.cat) { blob(sx, sy, hr * (B.fluffy ? .45 : .62), hr * .38, B.white ? "#f1efea" : shade(B.c, .08)); if (B.mask) blob(sx + hr * .25, sy - hr * .02, hr * .4, hr * .3, B.mask); if (open > .2) blob(sx + hr * .15, sy + hr * .32, hr * .3, hr * .15 * open + hr * .03, "#7a2f35"); blob(sx + hr * (B.fluffy ? .38 : .58), sy - hr * .12, hr * .16, hr * .13, "#1f1c22"); }
    else { blob(sx, sy + hr * .05, hr * .38, hr * .26, B.points ? B.d : shade(B.c, .15)); blob(sx + hr * .26, sy - hr * .05, hr * .08, hr * .06, "#d07b80"); x.strokeStyle = "rgba(255,255,255,.8)"; x.lineWidth = S * .008; [-1, 0, 1].forEach((k) => { x.beginPath(); x.moveTo(sx + hr * .2, sy + hr * .05); x.lineTo(sx + hr * .85, sy + k * hr * .14); x.stroke(); }); if (open > .2) blob(sx + hr * .15, sy + hr * .25, hr * .14, hr * .1 * open + hr * .02, "#7a2f35"); }
    // очі
    const blink = (t + sd * 1.3) % 4.1 < .13 || (lie && c.face === "sleep");
    const ex = hx + hr * .25, ey = hy - hr * .12;
    if (blink) { x.strokeStyle = "#1f1c22"; x.lineWidth = S * .018; x.beginPath(); x.moveTo(ex - hr * .12, ey); x.lineTo(ex + hr * .12, ey); x.stroke(); }
    else if (B.cat) { blob(ex, ey, hr * .17, hr * .14, B.eye); blob(ex + hr * .03, ey, hr * .04, hr * .12, "#1f1c22"); }
    else { blob(ex, ey, hr * .14, hr * .15, B.eye || "#2a2227"); if (B.eye) blob(ex + hr * .03, ey, hr * .06, hr * .07, "#1f1c22"); blob(ex + hr * .05, ey - hr * .05, hr * .04, hr * .04, "rgba(255,255,255,.9)"); }
    if (B.ear === "flop") blob(hx - hr * .3, hy + hr * .1, hr * .28, hr * .55, B.d, .35);
    if (B.ear === "fluff") for (let i = 0; i < 3; i++) blob(hx - hr * .5, hy + hr * (.05 + i * .28), hr * .3, hr * .26, i % 2 ? B.d : shade(B.d, -.08));
    x.restore();
    return { head: [X + hx * f, Y + hy], r: hr, h: S };
  }
  // позиція кінця відрізка
  const seg = (x, y, ang, len, f) => [x + Math.sin(ang * D) * len * f, y + Math.cos(ang * D) * len];
  function limb(x, pts, w, col) { x.strokeStyle = col; x.lineWidth = w; x.lineCap = "round"; x.lineJoin = "round"; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.stroke(); }

  // c: {who, col, acc, face, look, f(+1/-1), h(px), rim}
  function figure(x, X, Y, P, c, t) { if ((STYL[FMT]?.fill || STYL[FMT]?.fig) && !c._sil) return silFig(x, X, Y, P, c, t); if (STYL[FMT]?.mono && c.who !== "hero" && c.who !== "shadow") c = { ...c, col: ["#8d8f96", "#6f7178", "#a9abb1"][Math.floor(hsh(String(c.key ?? c.who)) * 3)] }; if (!KN() && !c._sil) return figureC(x, X, Y, P, c, t);
    const lk0 = c.who === "hero" ? looks(c) : null, headC = lk0 && lk0.skin !== "ink" ? SKIN[lk0.skin] : INK; if (headC !== INK) c = { ...c, light: 1 };
    const sp = WHO[c.who] || WHO.man, h = (c.h || 560) * sp.s, f = c.f || 1, hs = sp.hs || 1;
    const col = c.who === "doctor" ? "#eceff2" : c.who === "boss" ? "#3d4256" : sp.grey ? "#a7a2a0" : (HOOD[c.col] || c.col || HOOD.yellow);
    const dk = shade(col, -.22), uL = .25 * h, lL = .23 * h, uA = .17 * h, fA = .16 * h, lw = .062 * h, aw = .058 * h;
    const sit = P.sit || 0, lie = P.lie || 0, lean = (P.lean || 0) + (sp.lean || 0), breath = Math.sin(t * 2.1 + (c.seed || 0)) * .006 * h;
    x.save(); x.translate(X, Y);
    if (lie) { x.rotate(-90 * D * f); x.translate(0, .47 * h); }
    // тінь
    if (!lie) { const gx = c._sil && c._gs ? c._gs : x; gx.save(); if (gx !== x) gx.setTransform(x.getTransform()); gx.globalAlpha = .22; gx.fillStyle = "#000"; gx.beginPath(); gx.ellipse(sit ? .06 * h * f : 0, 0, .2 * h, .028 * h, 0, 0, 7); gx.fill(); gx.restore(); }
    const hipY = -(sit ? .3 : .47) * h + (sit ? 0 : 0), hip = [0, hipY];
    // ноги
    const legs = P.l.map((l) => { const k = seg(hip[0], hip[1], l[0], uL, f), a = seg(k[0], k[1], l[0] + l[1], lL, f); return [hip, k, a]; });
    const shoeC = c.who === "hero" ? "#ece2c4" : "#d9d4cc";
    const shoe = (p) => { const a = p[2]; x.fillStyle = shoeC; x.beginPath(); x.ellipse(a[0] + .035 * h * f, a[1] + .004 * h, .05 * h, .024 * h, 0, 0, 7); x.fill(); };
    limb(x, legs[0], lw, shade(LEG, -.1)); shoe(legs[0]);
    // тулуб
    x.save(); x.translate(0, hipY); x.rotate(lean * D * f); x.translate(0, -hipY);
    const sh = [0, -.78 * h + breath], bw = .19 * h;
    const arms = P.a.map((a) => { const e = seg(sh[0], sh[1] + .03 * h, a[0], uA, f), w = seg(e[0], e[1], a[0] + a[1], fA, f); return [[sh[0], sh[1] + .03 * h], e, w]; });
    // задня рука
    limb(x, arms[0], aw, dk); x.fillStyle = headC; x.beginPath(); x.arc(arms[0][2][0], arms[0][2][1], .036 * h, 0, 7); x.fill();
    limb(x, legs[1], lw, LEG); shoe(legs[1]);
    // худі
    x.fillStyle = col; x.beginPath();
    x.moveTo(-bw * .48, sh[1] + .02 * h); x.quadraticCurveTo(-bw * .62, sh[1] + .08 * h, -bw * .56, hipY + .05 * h);
    x.quadraticCurveTo(0, hipY + .085 * h, bw * .56, hipY + .05 * h); x.quadraticCurveTo(bw * .62, sh[1] + .08 * h, bw * .48, sh[1] + .02 * h);
    x.quadraticCurveTo(0, sh[1] - .045 * h, -bw * .48, sh[1] + .02 * h); x.fill();
    if (sp.coat) { x.strokeStyle = "#c9ced6"; x.lineWidth = .008 * h; x.beginPath(); x.moveTo(.02 * h * f, sh[1] + .03 * h); x.lineTo(.03 * h * f, hipY + .07 * h); x.stroke(); }
    else if (sp.suit) { x.fillStyle = "#e9e6df"; x.beginPath(); x.moveTo(-.035 * h, sh[1] + .01 * h); x.lineTo(.035 * h, sh[1] + .01 * h); x.lineTo(0, sh[1] + .1 * h); x.fill(); x.fillStyle = "#b5473f"; x.beginPath(); x.moveTo(-.012 * h, sh[1] + .03 * h); x.lineTo(.012 * h, sh[1] + .03 * h); x.lineTo(.018 * h, sh[1] + .17 * h); x.lineTo(0, sh[1] + .19 * h); x.lineTo(-.018 * h, sh[1] + .17 * h); x.fill(); }
    else { // кишеня й шнурки худі
      x.strokeStyle = dk; x.lineWidth = .007 * h; x.lineJoin = "round"; x.beginPath(); x.moveTo(-.06 * h, hipY - .045 * h); x.lineTo(.06 * h, hipY - .045 * h); x.lineTo(.075 * h, hipY + .03 * h); x.lineTo(-.075 * h, hipY + .03 * h); x.closePath(); x.stroke();
      x.beginPath(); x.moveTo(-.02 * h, sh[1] + .03 * h); x.lineTo(-.022 * h, sh[1] + .1 * h); x.moveTo(.02 * h, sh[1] + .03 * h); x.lineTo(.022 * h, sh[1] + .09 * h); x.stroke(); }
    // капюшон за шиєю
    if (!sp.suit && !sp.coat) { x.fillStyle = dk; x.beginPath(); x.ellipse(-.02 * h * f, sh[1] - .005 * h, .075 * h, .035 * h, 0, Math.PI, 0); x.fill(); }
    // голова
    const r = .118 * h * hs, ht = (P.ht || 0) + Math.sin(t * 1.3 + (c.seed || 0)) * 1.5, hc = [.012 * h * f, sh[1] - .045 * h - r];
    x.save(); x.translate(hc[0], hc[1] + r * .9); x.rotate(ht * D * f); x.translate(-hc[0], -hc[1] - r * .9);
    x.fillStyle = headC; x.fillRect(-.016 * h, sh[1] - .06 * h, .032 * h, .07 * h);
    if (lk0) hairBack(x, hc, r, f, lk0);
    x.fillStyle = headC; x.beginPath(); x.arc(hc[0], hc[1], r, 0, 7); x.fill(); if (c.light) { x.strokeStyle = INK; x.lineWidth = r * .06; x.stroke(); if (lk0.beard) { x.save(); x.beginPath(); x.arc(hc[0], hc[1], r, 0, 7); x.clip(); x.fillStyle = lk0.hairC; x.beginPath(); x.ellipse(hc[0], hc[1] + r * 1.0, r * 1.1, r * .62, 0, 0, 7); x.fill(); x.restore(); } }
    if (c.rim) { x.save(); x.beginPath(); x.arc(hc[0], hc[1], r, 0, 7); x.clip(); x.strokeStyle = c.rim; x.globalAlpha = .55; x.lineWidth = r * .14; x.beginPath(); x.arc(hc[0] - r * .1 * f, hc[1] + r * .06, r * 1.02, -Math.PI * .95, -Math.PI * .35); x.stroke(); x.restore(); }
    if (sp.hair) { x.fillStyle = "#3a2c2a"; x.beginPath(); x.ellipse(hc[0] - r * .85 * f, hc[1] + r * .05, r * .32, r * .55, -.3 * f, 0, 7); x.fill(); x.beginPath(); x.arc(hc[0] - r * .15 * f, hc[1] - r * .55, r * .62, Math.PI * 1.05, Math.PI * 1.95); x.fill(); }
    if (sp.grey) { x.fillStyle = "#d8d6d2"; x.beginPath(); x.arc(hc[0] - r * .2 * f, hc[1] - r * .62, r * .5, Math.PI, 0); x.fill(); }
    face(x, hc, r, f, c, t); if (lk0) hairFront(x, hc, r, f, lk0);
    acc(x, hc, r, f, sp.glasses ? "glasses" : c.acc, c.accC);
    x.restore();
    // передня рука
    limb(x, arms[1], aw, col); x.fillStyle = headC; x.beginPath(); x.arc(arms[1][2][0], arms[1][2][1], .037 * h, 0, 7); x.fill();
    x.restore(); x.restore();
    // кисть передньої руки у світових координатах — щоб тримати предмет
    const wr = arms[1][2]; let hx = wr[0], hy = wr[1];
    if (lean) { const a = lean * D * f, dx = hx, dy = hy - hipY; hx = dx * Math.cos(a) - dy * Math.sin(a); hy = dx * Math.sin(a) + dy * Math.cos(a) + hipY; }
    return { hand: [X + hx, Y + hy], head: [X + hc[0], Y + hc[1]], r, h };
  }
  function face(x, hc, r, f, c, t) {
    const em = c.face || "calm", look = c.look ?? 0, bl = (t + (c.seed || 0) * 1.7) % 3.6 < .12 || em === "sleep";
    const ex = hc[0] + r * .22 * f, ey = hc[1] - r * .02, sep = r * .34, ew = r * .15, eh = r * (em === "shock" ? .3 : .25);
    x.fillStyle = "#f4f1ea"; const LC = c.light ? INK : "#f4f1ea";
    [-1, 1].forEach((s) => { const cx = ex + s * sep / 2; x.beginPath(); if (c.light && !bl) { x.save(); x.strokeStyle = INK; x.lineWidth = r * .04; x.ellipse(cx, ey, ew, eh, 0, 0, 7); x.stroke(); x.restore(); x.beginPath(); } if (bl) { x.ellipse(cx, ey + eh * .3, ew, r * .03, 0, 0, 7); } else x.ellipse(cx, ey, ew, eh, 0, 0, 7); x.fill(); });
    if (!bl) { x.fillStyle = INK; [-1, 1].forEach((s) => { const cx = ex + s * sep / 2 + (look * .5 + .35 * f) * ew * .6; x.beginPath(); x.ellipse(cx, ey + eh * .12, ew * .45, eh * .42, 0, 0, 7); x.fill(); }); }
    x.strokeStyle = LC; x.lineWidth = r * .07; x.lineCap = "round";
    const brow = { angry: [.35, -.35], worried: [-.3, .3], sad: [-.28, .28], shock: [0, 0], smirk: [.1, -.25] }[em];
    if (brow) [-1, 1].forEach((s, i) => { const cx = ex + s * sep / 2, by = ey - eh - r * (em === "shock" ? .22 : .12); x.beginPath(); x.moveTo(cx - ew * 1.1, by + brow[i] * r * .25 * (s < 0 ? 1 : -1) * -1); x.lineTo(cx + ew * 1.1, by - brow[i] * r * .25 * (s < 0 ? 1 : -1) * -1); x.stroke(); });
    const my = hc[1] + r * .45, mx = ex;
    x.beginPath();
    if (em === "happy") x.arc(mx, my - r * .12, r * .2, .2 * Math.PI, .8 * Math.PI);
    else if (em === "sad" || em === "worried") x.arc(mx, my + r * .12, r * .15, 1.2 * Math.PI, 1.8 * Math.PI);
    else if (em === "shock") { x.fillStyle = c.light ? "#8a2c24" : "#f4f1ea"; x.ellipse(mx, my, r * .08, r * .11, 0, 0, 7); x.fill(); x.beginPath(); }
    else if (em === "smirk") { x.moveTo(mx - r * .12, my); x.quadraticCurveTo(mx + r * .05, my + r * .04, mx + r * .16, my - r * .08); }
    else if (em === "angry") { x.moveTo(mx - r * .12, my + r * .02); x.lineTo(mx + r * .12, my - r * .02); }
    else if (c.talk) { const o = Math.abs(Math.sin(t * 13)) * r * .1; x.fillStyle = c.light ? "#8a2c24" : "#f4f1ea"; x.ellipse(mx, my, r * .1, o + r * .02, 0, 0, 7); x.fill(); x.beginPath(); }
    else { x.moveTo(mx - r * .08, my); x.lineTo(mx + r * .08, my); }
    x.stroke();
  }
  function acc(x, hc, r, f, a, colr) {
    if (!a || a === "none") return;
    if (a === "beanie") { const c = colr || "#3f4d7a"; x.fillStyle = c; x.beginPath(); x.arc(hc[0], hc[1] - r * .12, r * 1.04, Math.PI * 1.02, Math.PI * 1.98); x.fill(); rr(x, hc[0] - r * 1.08, hc[1] - r * .32, r * 2.16, r * .34, r * .14); x.fillStyle = shade(c, -.2); x.fill(); x.fillStyle = "#ece8de"; x.beginPath(); x.arc(hc[0], hc[1] - r * 1.18, r * .2, 0, 7); x.fill(); }
    if (a === "cap") { const c = colr || "#b8574d"; x.fillStyle = c; x.beginPath(); x.arc(hc[0], hc[1] - r * .2, r * 1.0, Math.PI, 0); x.fill(); x.beginPath(); x.ellipse(hc[0] + r * .9 * f, hc[1] - r * .22, r * .62, r * .12, 0, 0, 7); x.fill(); }
    if (a === "glasses") { x.strokeStyle = "#cfd3da"; x.lineWidth = r * .07; const ex = hc[0] + r * .22 * f, ey = hc[1] - r * .02; [-1, 1].forEach((s) => { x.beginPath(); x.arc(ex + s * r * .17, ey, r * .2, 0, 7); x.stroke(); }); }
    if (a === "headphones") { x.strokeStyle = "#3b3f4e"; x.lineWidth = r * .16; x.beginPath(); x.arc(hc[0], hc[1], r * 1.08, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); x.fillStyle = "#e0915a"; x.beginPath(); x.ellipse(hc[0] - r * .55 * f, hc[1] + r * .1, r * .22, r * .32, 0, 0, 7); x.fill(); }
  }
  // плавний перехід поз
  function blendPose(a, b, p) {
    if (!a || p >= 1) return b; if (p <= 0) return a;
    const m = (u, v) => u.map((q, i) => [lerp(q[0], v[i][0], p), lerp(q[1], v[i][1], p)]);
    return { a: m(a.a, b.a), l: m(a.l, b.l), lean: lerp(a.lean || 0, b.lean || 0, p), ht: lerp(a.ht || 0, b.ht || 0, p), sit: p < .5 ? a.sit : b.sit, lie: p < .5 ? a.lie : b.lie };
  }
  function walkPose(ph, run) { const s = Math.sin(ph), k = run ? 1.5 : 1;
    return { a: [[-s * 26 * k, 18 + (run ? 70 : 0)], [s * 26 * k, 18 + (run ? 70 : 0)]], l: [[s * 24 * k, Math.max(0, -Math.sin(ph + 1.2)) * 40 * k * -1], [-s * 24 * k, Math.max(0, Math.sin(ph + 1.2)) * 40 * k * -1]], lean: run ? 10 : 2 }; }

  /* ---------- предмети (пласкі) ---------- */
  function txt(x, s, X, Y, size, col, w = 800, al = "center") { x.font = `${w} ${Math.round(size)}px "${FONT}", system-ui, sans-serif`; x.fillStyle = col; x.textAlign = al; x.textBaseline = "middle"; x.fillText(String(s), X, Y); }
  function fitTxt(x, s, maxW, size, w = 800) { x.font = `${w} ${Math.round(size)}px "${FONT}", system-ui, sans-serif`; const m = x.measureText(String(s)).width; return m > maxW ? size * maxW / m : size; }
  const PROPS = {
    qmark(x, s, p, t) { x.save(); x.scale(s, s); x.rotate(Math.sin(t * 3) * .08); x.font = `900 150px "${FONT}", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round"; x.strokeStyle = "#141414"; x.lineWidth = 16; const q = String(p.t || "??").slice(0, 3); x.strokeText(q, 0, 0); x.fillStyle = "#e0443a"; x.fillText(q, 0, 0); x.restore(); },
    card(x, s, p, t) { const w = 230 * s, h = 290 * s; x.save(); x.rotate(-.06); x.fillStyle = "rgba(0,0,0,.18)"; rr(x, -w / 2 + 8, -h / 2 + 10, w, h, 10 * s); x.fill(); x.fillStyle = "#f3f1ec"; rr(x, -w / 2, -h / 2, w, h, 10 * s); x.fill(); x.fillStyle = "#5c5a86"; rr(x, -w / 2, -h / 2, w, 48 * s, [10 * s, 10 * s, 0, 0]); x.fill();
      const tt = String(p.t2 || "РЕЗУЛЬТАТ").toUpperCase(); txt(x, tt, 0, -h / 2 + 24 * s, fitTxt(x, tt, w * .86, 22 * s, 700), "#eef", 700); const n = String(p.t ?? "").slice(0, 8); txt(x, n, 0, 6 * s, fitTxt(x, n, w * .86, 110 * s, 800), p.c || "#d0673d"); x.fillStyle = "#c9c6bf"; [70, 95].forEach((o) => x.fillRect(-w * .36, o * s, w * .72, 6 * s)); x.restore(); },
    phone(x, s, p, t) { const w = 150 * s, h = 290 * s; x.fillStyle = "#26252c"; rr(x, -w / 2, -h / 2, w, h, 24 * s); x.fill(); const g = x.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, p.c || "#7b8fe0"); g.addColorStop(1, shade(p.c || "#7b8fe0", -.35)); x.fillStyle = g; rr(x, -w / 2 + 9 * s, -h / 2 + 12 * s, w - 18 * s, h - 24 * s, 16 * s); x.fill();
      if (p.t) { const n = String(p.t).slice(0, 14); txt(x, n, 0, -10 * s, fitTxt(x, n, w * .8, 46 * s), "#fff"); } [30, 52, 74].forEach((o, i) => { x.fillStyle = "rgba(255,255,255,.35)"; rr(x, -w * .34, o * s, w * (.68 - i * .12), 12 * s, 6 * s); x.fill(); }); },
    laptop(x, s, p, t) { const w = 330 * s, h = 210 * s; x.fillStyle = "#3a3944"; rr(x, -w / 2, -h, w, h, 12 * s); x.fill(); const g = x.createLinearGradient(0, -h, 0, 0); g.addColorStop(0, "#dfe8f2"); g.addColorStop(1, "#b9c7d9"); x.fillStyle = g; rr(x, -w / 2 + 12 * s, -h + 12 * s, w - 24 * s, h - 24 * s, 6 * s); x.fill();
      if (p.t) { const n = String(p.t).slice(0, 16); txt(x, n, 0, -h / 2, fitTxt(x, n, w * .8, 48 * s), "#5c6fd0"); } x.fillStyle = "#56555f"; rr(x, -w * .6, 0, w * 1.2, 16 * s, 6 * s); x.fill(); },
    clock(x, s, p, t) { const r = 105 * s; x.fillStyle = "#3c3a44"; x.beginPath(); x.arc(0, 0, r + 9 * s, 0, 7); x.fill(); x.fillStyle = "#f1eee6"; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); x.strokeStyle = "#3c3a44"; x.lineCap = "round";
      for (let i = 0; i < 12; i++) { const a = i * 30 * D; x.lineWidth = 5 * s; x.beginPath(); x.moveTo(Math.sin(a) * r * .8, -Math.cos(a) * r * .8); x.lineTo(Math.sin(a) * r * .9, -Math.cos(a) * r * .9); x.stroke(); }
      const sp = p.fast ? 6 : 1, a1 = t * .5 * sp, a2 = t * 6 * sp; x.lineWidth = 9 * s; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.sin(a1) * r * .5, -Math.cos(a1) * r * .5); x.stroke(); x.lineWidth = 5 * s; x.strokeStyle = "#c65a50"; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.sin(a2) * r * .78, -Math.cos(a2) * r * .78); x.stroke(); },
    calendar(x, s, p, t) { const w = 230 * s, h = 250 * s; x.fillStyle = "rgba(0,0,0,.18)"; rr(x, -w / 2 + 8, -h / 2 + 10, w, h, 12 * s); x.fill(); x.fillStyle = "#f3f1ec"; rr(x, -w / 2, -h / 2, w, h, 12 * s); x.fill(); x.fillStyle = "#3f3d48"; rr(x, -w / 2, -h / 2, w, 22 * s, [12 * s, 12 * s, 0, 0]); x.fill();
      const n = String(p.t ?? "1").slice(0, 4); txt(x, n, 0, 6 * s, fitTxt(x, n, w * .8, 130 * s), "#2d2b33"); if (p.t2) txt(x, String(p.t2).toUpperCase().slice(0, 10), 0, h / 2 - 34 * s, 30 * s, "#2d2b33", 700); },
    money(x, s, p, t) { for (let i = 0; i < 4; i++) { x.save(); x.translate(i * 6 * s, -i * 16 * s); x.rotate((i % 2 ? .05 : -.04)); x.fillStyle = i === 3 ? "#8fbf7a" : "#77a865"; rr(x, -120 * s, -55 * s, 240 * s, 110 * s, 8 * s); x.fill(); x.strokeStyle = "#5e8c50"; x.lineWidth = 5 * s; rr(x, -105 * s, -42 * s, 210 * s, 84 * s, 6 * s); x.stroke(); if (i === 3) txt(x, p.t || "₴", 0, 2 * s, 52 * s, "#4c7a40"); x.restore(); } },
    coin(x, s, p, t) { const sx = Math.cos(t * 3); x.save(); x.scale(Math.max(.15, Math.abs(sx)), 1); x.fillStyle = "#c79a2e"; x.beginPath(); x.arc(0, 6 * s, 80 * s, 0, 7); x.fill(); x.fillStyle = "#efc54e"; x.beginPath(); x.arc(0, 0, 80 * s, 0, 7); x.fill(); txt(x, p.t || "₴", 0, 2 * s, 80 * s, "#b9861d"); x.restore(); },
    chart(x, s, p, t) { const w = 380 * s, h = 260 * s, up = (p.v ?? 1) >= 0; x.fillStyle = "#f3f1ec"; rr(x, -w / 2, -h / 2, w, h, 14 * s); x.fill(); x.strokeStyle = "#d6d2c8"; x.lineWidth = 3 * s; for (let i = 1; i < 4; i++) { x.beginPath(); x.moveTo(-w / 2 + 20 * s, -h / 2 + i * h / 4); x.lineTo(w / 2 - 20 * s, -h / 2 + i * h / 4); x.stroke(); }
      const pr = clamp(p.lt / 1.2), n = 7; x.strokeStyle = up ? "#4f9a62" : "#c65a50"; x.lineWidth = 10 * s; x.lineJoin = "round"; x.lineCap = "round"; x.beginPath();
      for (let i = 0; i <= n * pr; i++) { const u = i / n, v = (up ? u : 1 - u) * .75 + rnd(i, 3) * .18, X = -w / 2 + 34 * s + u * (w - 68 * s), Y = h / 2 - 30 * s - v * (h - 70 * s); i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); if (p.t) txt(x, String(p.t).slice(0, 14), 0, -h / 2 - 34 * s, 40 * s, "#f3f1ec"); },
    cup(x, s, p, t) { x.fillStyle = "#e8e4da"; x.beginPath(); x.moveTo(-60 * s, -70 * s); x.lineTo(60 * s, -70 * s); x.lineTo(48 * s, 60 * s); x.lineTo(-48 * s, 60 * s); x.fill(); x.strokeStyle = "#e8e4da"; x.lineWidth = 14 * s; x.beginPath(); x.arc(62 * s, -10 * s, 28 * s, -1.2, 1.2); x.stroke();
      x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = 6 * s; for (let i = -1; i <= 1; i++) { x.beginPath(); for (let k = 0; k < 8; k++) { const Y = -90 * s - k * 14 * s, X = i * 26 * s + Math.sin(k * .9 + t * 3 + i) * 9 * s; k ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); } },
    book(x, s, p, t) { x.fillStyle = p.c || "#b8574d"; rr(x, -110 * s, -140 * s, 220 * s, 280 * s, 10 * s); x.fill(); x.fillStyle = "#ece8de"; x.fillRect(90 * s, -130 * s, 14 * s, 260 * s); if (p.t) { const n = String(p.t).slice(0, 12); txt(x, n, -6 * s, -30 * s, fitTxt(x, n, 180 * s, 40 * s), "#f6efe2"); } },
    gift(x, s, p, t) { x.fillStyle = "#c65a50"; rr(x, -100 * s, -60 * s, 200 * s, 150 * s, 10 * s); x.fill(); x.fillStyle = "#d96a5f"; rr(x, -112 * s, -100 * s, 224 * s, 50 * s, 10 * s); x.fill(); x.fillStyle = "#efc54e"; x.fillRect(-14 * s, -100 * s, 28 * s, 190 * s); x.beginPath(); x.ellipse(-36 * s, -112 * s, 36 * s, 18 * s, .4, 0, 7); x.ellipse(36 * s, -112 * s, 36 * s, 18 * s, -.4, 0, 7); x.fill(); },
    trophy(x, s, p, t) { x.fillStyle = "#efc54e"; x.beginPath(); x.moveTo(-90 * s, -130 * s); x.lineTo(90 * s, -130 * s); x.quadraticCurveTo(90 * s, 10 * s, 0, 20 * s); x.quadraticCurveTo(-90 * s, 10 * s, -90 * s, -130 * s); x.fill(); x.strokeStyle = "#efc54e"; x.lineWidth = 14 * s; [-1, 1].forEach((d) => { x.beginPath(); x.arc(d * 90 * s, -80 * s, 36 * s, d > 0 ? -1.6 : 1.6 - Math.PI * 2, d > 0 ? 1.6 : 4.7); x.stroke(); }); x.fillStyle = "#c79a2e"; x.fillRect(-16 * s, 18 * s, 32 * s, 60 * s); rr(x, -70 * s, 74 * s, 140 * s, 36 * s, 6 * s); x.fill(); },
    bulb(x, s, p, t) { const g = x.createRadialGradient(0, -40 * s, 10 * s, 0, -40 * s, 200 * s); g.addColorStop(0, "rgba(255,230,140,.6)"); g.addColorStop(1, "rgba(255,230,140,0)"); x.fillStyle = g; x.beginPath(); x.arc(0, -40 * s, 200 * s, 0, 7); x.fill(); x.fillStyle = "#ffe08a"; x.beginPath(); x.arc(0, -50 * s, 80 * s, 0, 7); x.fill(); x.fillStyle = "#8d8a94"; rr(x, -40 * s, 20 * s, 80 * s, 56 * s, 10 * s); x.fill(); },
    sign(x, s, p, t) { const n = String(p.t || "!").toUpperCase().slice(0, 18), w = Math.max(240 * s, n.length * 30 * s + 60 * s), h = 130 * s; x.fillStyle = "#e3c44a"; rr(x, -w / 2, -h / 2, w, h, 10 * s); x.fill(); x.strokeStyle = "#2b2932"; x.lineWidth = 6 * s; rr(x, -w / 2 + 12 * s, -h / 2 + 12 * s, w - 24 * s, h - 24 * s, 6 * s); x.stroke(); txt(x, n, 0, 2 * s, fitTxt(x, n, w - 70 * s, 50 * s), "#2b2932"); },
  };
  // будь-яка іконка з бібліотеки — пласка «наліпка»
  let ICO = null, ICOP = null; const ICOC = new Map();
  function loadIcons() { if (window.YVIcons) { ICO = window.YVIcons; return Promise.resolve(); } if (ICOP) return ICOP;
    return ICOP = new Promise((ok) => { const sc = document.createElement("script"); sc.src = "a/icons.js?v=" + (window.YV_BUILD || 1); sc.onload = () => { ICO = window.YVIcons || null; ok(); }; sc.onerror = () => ok(); document.head.appendChild(sc); }); }
  function iconPaths(q) { if (!ICO) return null; q = String(q || "").toLowerCase().trim().replace(/[\s_]+/g, "-"); let i = ICO.n.indexOf(q);
    if (i < 0) { let best = -1, bs = 0; for (let k = 0; k < ICO.n.length; k++) { const n = ICO.n[k], tg = ICO.t[k] || ""; const sc = n === q ? 9 : n.startsWith(q) ? 5 : n.includes(q) ? 3 : (" " + tg + " ").includes(" " + q + " ") ? 2 : 0; if (sc > bs) { bs = sc; best = k; if (sc >= 5) break; } } i = best; }
    if (i < 0) return null; if (ICOC.has(i)) return ICOC.get(i);
    const out = String(ICO.p[i]).split("|").map((s) => { const pts = []; for (let k = 0; k + 1 < s.length; k += 2) pts.push([(s.charCodeAt(k) - 40) / 4, (s.charCodeAt(k + 1) - 40) / 4]); return pts; }); ICOC.set(i, out); return out; }
  function drawIcon(x, q, s, col) { const P = iconPaths(q); if (!P) return false; x.save(); x.fillStyle = "rgba(0,0,0,.18)"; x.beginPath(); x.arc(6, 10, 120 * s, 0, 7); x.fill(); x.fillStyle = "#f3f1ec"; x.beginPath(); x.arc(0, 0, 120 * s, 0, 7); x.fill();
    x.translate(-12 * 7 * s, -12 * 7 * s); x.scale(7 * s, 7 * s); x.strokeStyle = col || "#3f3d48"; x.lineWidth = 1.9; x.lineCap = "round"; x.lineJoin = "round"; P.forEach((pts) => { x.beginPath(); pts.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.stroke(); }); x.restore(); return true; }

  /* ---------- локації: статичний фон кешується, живе — світло, пил, екрани ---------- */
  const FLOOR = 1500;
  function sky(x, X, Y, w, h, tm, seed, kind = "city") { const T = TIME[tm] || TIME.day, g = x.createLinearGradient(0, Y, 0, Y + h); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]); x.fillStyle = g; x.fillRect(X, Y, w, h);
    if (tm === "night") for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(255,255,255,${.3 + rnd(i, seed) * .5})`; x.fillRect(X + rnd(i, seed + 1) * w, Y + rnd(i, seed + 2) * h * .6, 3, 3); }
    if (kind === "city") { const base = Y + h; for (let i = 0; i < 9; i++) { const bw = w * (.08 + rnd(i, seed) * .1), bx = X + i * w / 8 - 20, bh = h * (.25 + rnd(i, seed + 3) * .45); x.fillStyle = tm === "night" ? "#2a2b4d" : mix(T.sky[1], "#7d7a92", .55); x.fillRect(bx, base - bh, bw, bh);
      if (tm !== "day") for (let k = 0; k < 14; k++) if (rnd(i * 20 + k, seed) > .55) { x.fillStyle = tm === "night" ? "rgba(255,214,140,.85)" : "rgba(255,230,190,.5)"; x.fillRect(bx + 6 + (k % 3) * bw / 3.2, base - bh + 10 + Math.floor(k / 3) * 22, bw / 6, 9); } } }
    if (kind === "trees") { x.fillStyle = tm === "night" ? "#2f3b44" : "#7fa06a"; for (let i = 0; i < 5; i++) { x.beginPath(); x.arc(X + rnd(i, seed) * w, Y + h * (.65 + rnd(i, seed + 1) * .3), h * (.25 + rnd(i, seed + 2) * .2), 0, 7); x.fill(); } } }
  function win(x, X, Y, w, h, tm, seed, kind) { x.fillStyle = "#e6e0d8"; x.fillRect(X - 14, Y - 14, w + 28, h + 28); sky(x, X, Y, w, h, tm, seed, kind); x.fillStyle = "#e6e0d8"; x.fillRect(X + w / 2 - 6, Y, 12, h); x.fillRect(X, Y + h * .45, w, 12); x.fillStyle = "rgba(0,0,0,.08)"; x.fillRect(X - 14, Y + h + 14, w + 28, 14); }
  function plant(x, X, Y, s) { x.fillStyle = "#c0a58a"; x.beginPath(); x.moveTo(X - 40 * s, Y - 90 * s); x.lineTo(X + 40 * s, Y - 90 * s); x.lineTo(X + 30 * s, Y); x.lineTo(X - 30 * s, Y); x.fill(); x.fillStyle = "#6f9460"; for (let i = 0; i < 7; i++) { x.save(); x.translate(X, Y - 90 * s); x.rotate((-60 + i * 20) * D); x.beginPath(); x.ellipse(0, -70 * s, 22 * s, 70 * s, 0, 0, 7); x.fill(); x.restore(); } }
  function frame(x, X, Y, w, h, c) { x.fillStyle = "#3f3a40"; x.fillRect(X - 8, Y - 8, w + 16, h + 16); x.fillStyle = c; x.fillRect(X, Y, w, h); x.fillStyle = "rgba(255,255,255,.35)"; x.beginPath(); x.moveTo(X, Y + h); x.lineTo(X + w * .45, Y + h * .4); x.lineTo(X + w * .7, Y + h * .7); x.lineTo(X + w, Y + h * .3); x.lineTo(X + w, Y + h); x.fill(); }
  function desk(x, X, Y, w, c = "#a88c6c") { x.fillStyle = shade(c, -.15); x.fillRect(X + 20, Y + 30, 16, FLOOR - Y - 30); x.fillRect(X + w - 36, Y + 30, 16, FLOOR - Y - 30); x.fillStyle = c; rr(x, X, Y, w, 34, 6); x.fill(); x.fillStyle = shade(c, -.25); x.fillRect(X, Y + 30, w, 8); }
  function floor(x, c, tm, wood = true) { const T = TIME[tm] || TIME.day; x.fillStyle = shade(c, T.amb); x.fillRect(0, FLOOR, W, H - FLOOR); if (wood) { x.strokeStyle = "rgba(0,0,0,.08)"; x.lineWidth = 3; for (let i = -6; i <= 6; i++) { x.beginPath(); x.moveTo(W / 2 + i * 60, FLOOR); x.lineTo(W / 2 + i * 260, H); x.stroke(); } for (let k = 1; k < 5; k++) { const y = FLOOR + (H - FLOOR) * Math.pow(k / 5, 1.6); x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } }
    x.fillStyle = "rgba(0,0,0,.14)"; x.fillRect(0, FLOOR - 26, W, 26); }
  function wall(x, c, tm) { const T = TIME[tm] || TIME.day, g = x.createLinearGradient(0, 0, 0, FLOOR); g.addColorStop(0, shade(c, T.amb - .06)); g.addColorStop(1, shade(c, T.amb + .04)); x.fillStyle = g; x.fillRect(0, 0, W, FLOOR); }
  /* ---------- формати «Комікс» і «Паперовий скетч»: персонажі з кольором шкіри й контуром, пласкі фони, рукописні написи ---------- */
  let FMT = "kino";
  const HANDF = "YVHand";
  let HANDP = null; const loadHand = () => HANDP ||= (async () => { try { if (!window.FontFace) return; const f = new FontFace(HANDF, "url(a/Caveat.woff)", { weight: "400 700" }); await f.load(); document.fonts.add(f); } catch (e) { console.warn("hand font", e); } })();
  const FMTS = { kino: { n: "Кіно-чоловічок", d: "Плаский герой у намальованих локаціях, наїзди камери, великі написи, вікна-підказки, музика й звуки." },
    comic: { n: "Комікс", d: "Персонажі з товстим контуром і кольором шкіри, пласкі кімнати, рукописні написи й підписи зі стрілкою — як у біографіях на YouTube." },
    paper: { n: "Паперовий скетч", d: "Олівцевий малюнок на старому папері з рамкою: штриховка, м'які кольори, рукописні субтитри." },
    whatif: { n: "What If", d: "Чорні чоловічки з білими очима в кольорових худі на світлих пласких фонах — як у роликах «що, якби…». Мітки й числа над головами." },
    dark: { n: "Темний мінімалізм", d: "Майже чорні кімнати, світлий герой, червоні й рожеві неонові акценти — драма, лінь, залежність, дисципліна." },
    neon: { n: "Неоновий контур", d: "Чорні силуети з кольоровим світним обведенням на темних фонах — напруга, таймери, ніч." },
    sil: { n: "Силует", d: "Суцільні чорні силуети з білими очима на сірих пласких фонах — тихі історії про звички й маленькі кроки." },
    pastel: { n: "Пастель", d: "М'які світлі кольори, повітряні фони, затишно й дорого — для легких і теплих історій." },
    golden: { n: "Золота година", d: "Силуети з теплим контровим світлом на тлі заходу сонця — кінематографічно, мрійливо, натхненно." },
    chalk: { n: "Крейда на дошці", d: "Білі крейдяні контури на зеленій шкільній дошці — пояснення, поради, «як це працює»." },
    blueprint: { n: "Креслення", d: "Білі лінії на синьому кресленні з сіткою — бізнес, гроші, плани й стратегії." },
    retro: { n: "Ретро-плівка", d: "Тепла сепія, зерно й віньєтка старої плівки — спогади, «як було раніше», ностальгія." },
    mono: { n: "Монохром з акцентом", d: "Увесь світ чорно-білий, лише герой у кольорі — стильно, чисто, фокус на головному." },
    clay: { n: "М'яке 3D", d: "Об'ємні м'які персонажі з тінню й світлом, як пластилін чи іграшки, на теплих розмитих фонах — дорого й дуже приємно." },
    noir: { n: "Чорне золото", d: "Глибокий чорний, золоті контури й золотий пил у світлі — як реклама преміальних брендів. Гроші, статус, амбіції." },
    aurora: { n: "Аврора і скло", d: "М'які градієнти бузкового, рожевого й персикового, персонажі з матового скла — сучасно й технологічно, як презентації Apple." },
    cut: { n: "Паперовий колаж", d: "Сцени з шарів вирізаного кольорового паперу з тінями між ними — ручна дорога робота, тепло й стильно." },
    cine: { n: "Блокбастер", d: "Кінокольорокорекція «бірюза + помаранч», сяйво, відблиски об'єктива й плівкове зерно — як трейлер фільму." },
    toon30: { n: "Старий мультик", d: "Чорно-білий мультфільм на кремовій плівці: мерехтіння, пилинки, заокруглена рамка кадру — казково й ностальгійно." },
    toon50: { n: "Мультик 50-х", d: "Обмежена тепла палітра середини століття: гірчиця, бірюза, корал і кремовий папір — стильно й затишно." },
    toon80: { n: "Мультик з касети", d: "Соковиті кольори суботніх мультиків 80–90-х, м'які рядки кінескопа й легкий шум касети." },
    book: { n: "Казкова книжка", d: "Акварельні м'які кольори на фактурному папері й теплий коричневий контур — як ілюстрації дитячої книжки." } };
  // ретро-мультики: рушій «Комікс» + своя палітра (pf), колір контуру й накладка плівки/паперу/кінескопа
  const toHex = (a) => "#" + a.map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, "0")).join("");
  const PAL50 = ["#f1e4c6", "#e6c88f", "#dda33a", "#d9733f", "#d65a4a", "#e7a59a", "#2e8b85", "#8fc4bd", "#8c9a4c", "#6b4a32", "#2d4a63", "#3a2a20"].map(hex);
  const sat = (c, k, add = 0) => { const L = .3 * c[0] + .59 * c[1] + .11 * c[2]; return c.map((v) => L + (v - L) * k + add); };
  const RTOON = {
    toon30: { ol: "#16130f", pf: (c) => { const L = .3 * c[0] + .59 * c[1] + .11 * c[2]; return gmap([[0, [24, 21, 18]], [110, [92, 86, 76]], [190, [196, 186, 164]], [255, [246, 238, 216]]], L); } },
    toon50: { ol: "#2b2019", pf: (c) => { if (SKINH.has(toHex(c))) return sat(c, .85).map((v, i) => lerp(v, [236, 200, 160][i], .25)); const L0 = .3 * c[0] + .59 * c[1] + .11 * c[2], sc = Math.max(...c) - Math.min(...c); if (sc < 70 && L0 < 110) return c.map((v, i) => lerp(v, [74, 50, 36][i], .55)); let b = PAL50[0], d = 1e9; for (const q of PAL50) { const e = (q[0] - c[0]) ** 2 * .3 + (q[1] - c[1]) ** 2 * .59 + (q[2] - c[2]) ** 2 * .11 + Math.abs((.3 * q[0] + .59 * q[1] + .11 * q[2]) - (.3 * c[0] + .59 * c[1] + .11 * c[2])) * 40; if (e < d) { d = e; b = q; } } return b.map((v, i) => lerp(c[i], v, .72)); } },
    toon80: { ol: "#1b1222", pf: (c) => SKINH.has(toHex(c)) ? sat(c, 1.15, 4) : sat(c, 1.6, 8) },
    book: { ol: "#5b4636", pf: (c) => sat(c, .78).map((v, i) => lerp(v, [246, 236, 216][i], .24)) } };
  const PFC = new Map(); let SKINH = new Set();
  // нові стилі будуються на «кіно»-рушії: фон перефарбовується, фігури — силуети з власним кольором, світінням і очима
  const STYL = { whatif: { bg: "bright" }, dark: { bg: "dark", fill: "#e9e9ec", eye: "#111114", edge: "rgba(0,0,0,.85)" }, neon: { bg: "navy", fill: "#0c0d12", eye: "#ffffff", neon: 1 }, sil: { bg: "grey", fill: "#141416", eye: "#ffffff" },
    pastel: { bg: "pastel" }, golden: { bg: "golden", fill: "#1d1218", eye: "#ffe2b8", rim: "#ffb35c" }, chalk: { bg: "chalk", fill: "#2a4337", eye: "#f3f1e6", line: "#f3f1e6" },
    blueprint: { bg: "blue", fill: "#1f4f8f", eye: "#eaf3ff", line: "#eaf3ff" }, retro: { bg: "sepia" }, mono: { bg: "gray", mono: 1 },
    clay: { bg: "clay", fig: "clay" }, noir: { bg: "noir", fill: "#0b0a0a", eye: "#f3c969", line: "gold" }, aurora: { bg: "aurora", fill: "glass", eye: "#2b2552", edge: "rgba(255,255,255,.95)" }, cut: { bg: "cut", fig: "paper" }, cine: { bg: "cine" } };
  const KN = () => FMT === "kino" || !!STYL[FMT];
  const NEONC = { hero: "#4dd0e1", man: "#ffd166", woman: "#f72585", kid: "#7be38f", girl: "#ff9ecb", doctor: "#a5f3fc", boss: "#ff7b54", old: "#f4a261", shadow: "#ff2a2a" };
  const SKIN = { ink: "#232129", white: "#f7f6f2", porcelain: "#f7ddca", light: "#eccdb2", medium: "#d7ae8c", tan: "#b98a66", brown: "#8a5b3e", dark: "#5e3c2b" };
  SKINH = new Set(Object.values(SKIN).map((h) => h.toLowerCase()));
  const SKIN_N = { auto: "Під формат", ink: "Чорний", white: "Білий", porcelain: "Світла", light: "Тепла", medium: "Смаглява", tan: "Засмагла", brown: "Темна", dark: "Дуже темна" };
  const HAIR_N = { none: "Без волосся", short: "Коротке", messy: "Скуйовджене", long: "Довге", bob: "Каре", curly: "Кучері", bun: "Пучок" };
  const HAIRC = { black: "#2b2a30", dbrown: "#4b3a32", brown: "#7a5a45", blond: "#d6b86c", red: "#a5512f", grey: "#b8b5ae" };
  const hsh = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };
  const OLC = () => RTOON[FMT]?.ol || (FMT === "paper" ? "#3a3027" : "#141414");
  const pf = (c) => { if (FMT === "paper") return mix(c, "#f0e3c8", .5); const R = RTOON[FMT]; if (!R || typeof c !== "string" || !/^#[0-9a-f]{6}$/i.test(c)) return c; const k = FMT + c; if (!PFC.has(k)) { if (PFC.size > 600) PFC.clear(); PFC.set(k, toHex(R.pf(hex(c)))); } return PFC.get(k); };
  // накладки ретро-мультиків (по кадру; шум — з кількох закешованих плиток)
  const NZ = [];
  function noiseTile(i) { if (NZ[i]) return NZ[i]; const c = document.createElement("canvas"); c.width = 270; c.height = 480; const o = c.getContext("2d"), d = o.createImageData(270, 480);
    for (let k = 0; k < d.data.length; k += 4) { const v = rnd(k + i * 7919, 3) * 255; d.data[k] = d.data[k + 1] = d.data[k + 2] = v; d.data[k + 3] = 255; } o.putImageData(d, 0, 0); return NZ[i] = c; }
  const PAPT = {};
  function paperTex(kind) { if (PAPT[kind]) return PAPT[kind]; const c = document.createElement("canvas"); c.width = W / 2; c.height = H / 2; const o = c.getContext("2d"); o.fillStyle = "#fff"; o.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < (kind === "book" ? 140 : 60); i++) { const X = rnd(i, 21) * c.width, Y = rnd(i, 22) * c.height, R = 30 + rnd(i, 23) * (kind === "book" ? 170 : 90), g = o.createRadialGradient(X, Y, 0, X, Y, R); const a = kind === "book" ? .025 + rnd(i, 24) * .035 : .03 + rnd(i, 24) * .04, tc = kind === "book" ? [[214, 170, 130], [160, 180, 210], [200, 160, 190], [170, 200, 160]][i % 4].join(",") : "150,120,85"; g.addColorStop(0, `rgba(${tc},${a})`); g.addColorStop(.7, `rgba(${tc},${a * .6})`); g.addColorStop(1, `rgba(${tc},0)`); o.fillStyle = g; o.fillRect(X - R, Y - R, R * 2, R * 2); }
    o.strokeStyle = "rgba(120,95,70,.07)"; o.lineWidth = 1; for (let i = 0; i < 900; i++) { const X = rnd(i, 31) * c.width, Y = rnd(i, 32) * c.height, a = rnd(i, 33) * 6.28, l = 4 + rnd(i, 34) * 14; o.beginPath(); o.moveTo(X, Y); o.lineTo(X + Math.cos(a) * l, Y + Math.sin(a) * l); o.stroke(); }
    return PAPT[kind] = c; }
  function retroPost(x, t) { const F = Math.floor(t * 24), R = FMT; x.save();
    if (R === "toon30") { x.globalCompositeOperation = "saturation"; x.fillStyle = "#808080"; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "multiply"; x.fillStyle = "#f3e7cb"; x.fillRect(0, 0, W, H);
      const fl = (rnd(F, 41) - .5) * .09; x.globalCompositeOperation = "source-over"; x.fillStyle = fl > 0 ? `rgba(255,248,230,${fl})` : `rgba(20,16,10,${-fl})`; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = "overlay"; x.globalAlpha = .22; x.drawImage(noiseTile(F % 4), 0, 0, W, H); x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
      for (let i = 0; i < 7; i++) if (rnd(F * 13 + i, 42) > .55) { x.fillStyle = rnd(i, F) > .5 ? "rgba(12,10,8,.55)" : "rgba(255,250,235,.5)"; x.beginPath(); x.arc(rnd(F + i, 43) * W, rnd(F + i, 44) * H, 2 + rnd(F + i, 45) * 4, 0, 7); x.fill(); }
      if (rnd(Math.floor(t * 3), 46) > .7) { x.strokeStyle = "rgba(15,12,8,.4)"; x.lineWidth = 2; const hx = rnd(Math.floor(t * 3), 47) * W, hy = rnd(Math.floor(t * 3), 48) * H; x.beginPath(); x.moveTo(hx, hy); x.bezierCurveTo(hx + 30, hy + 40, hx - 20, hy + 70, hx + 15, hy + 110); x.stroke(); }
      if (rnd(F, 49) > .9) { x.fillStyle = "rgba(250,244,226,.35)"; x.fillRect(rnd(F, 50) * W, 0, 2, H); }
      const v = x.createRadialGradient(W / 2, H / 2, H * .32, W / 2, H / 2, H * .72); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(20,15,8,.6)"); x.fillStyle = v; x.fillRect(0, 0, W, H);
      x.fillStyle = "#0e0c0a"; x.beginPath(); x.rect(0, 0, W, H); x.roundRect ? x.roundRect(14, 14, W - 28, H - 28, 70) : x.rect(14, 14, W - 28, H - 28); x.fill("evenodd"); }
    else if (R === "toon50") { x.globalCompositeOperation = "multiply"; x.drawImage(paperTex("p50"), 0, 0, W, H); x.fillStyle = "#fbf1dc"; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = "soft-light"; x.globalAlpha = .18; x.drawImage(noiseTile(0), 0, 0, W, H); x.globalAlpha = 1;
      x.globalCompositeOperation = "multiply"; const v = x.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .78); v.addColorStop(0, "rgba(255,255,255,0)"); v.addColorStop(1, "rgba(190,150,100,.35)"); x.fillStyle = v; x.fillRect(0, 0, W, H); }
    else if (R === "toon80") { x.globalCompositeOperation = "soft-light"; x.fillStyle = "rgba(255,170,120,.18)"; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over";
      x.fillStyle = "rgba(0,0,0,.11)"; for (let y = (F % 2) * 2; y < H; y += 5) x.fillRect(0, y, W, 2);
      x.globalCompositeOperation = "overlay"; x.globalAlpha = .1; x.drawImage(noiseTile(F % 4), 0, 0, W, H); x.globalAlpha = 1; x.globalCompositeOperation = "source-over";
      const ph = (t % 7) / 7; if (ph > .86) { const by = (ph - .86) / .14 * H; x.globalAlpha = .35; x.drawImage(noiseTile((F + 1) % 4), 0, 0, 270, 12, 0, by, W, 26); x.globalAlpha = 1; }
      const v = x.createRadialGradient(W / 2, H / 2, H * .38, W / 2, H / 2, H * .8); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(20,8,30,.45)"); x.fillStyle = v; x.fillRect(0, 0, W, H); }
    else if (R === "book") { x.globalCompositeOperation = "multiply"; x.drawImage(paperTex("book"), 0, 0, W, H); x.fillStyle = "#fbf3e2"; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = "soft-light"; x.globalAlpha = .14; x.drawImage(noiseTile(1), 0, 0, W, H); x.globalAlpha = 1; x.globalCompositeOperation = "multiply";
      const v = x.createRadialGradient(W / 2, H * .46, H * .3, W / 2, H / 2, H * .74); v.addColorStop(0, "rgba(255,255,255,0)"); v.addColorStop(1, "rgba(190,160,120,.26)"); x.fillStyle = v; x.fillRect(0, 0, W, H); }
    x.restore(); }
  // зовнішність: герой — з налаштувань; інші — стабільно від ролі й позиції в кадрі
  function looks(c) { const who = c.who || "man", key = who + ":" + (c.key ?? ""), k = hsh(key), k2 = hsh("b" + key);
    if (who === "hero") { const sk = c.skin && c.skin !== "auto" ? c.skin : KN() ? "ink" : "light"; return { skin: sk, hair: c.hair || (KN() ? "none" : "messy"), hairC: HAIRC[c.hairC] || HAIRC.dbrown, beard: !!c.beard }; }
    if (KN()) return { skin: "ink", hair: "none", hairC: HAIRC.dbrown, beard: false };
    const fem = who === "woman" || who === "girl", skins = ["porcelain", "light", "light", "medium", "tan", "brown", "dark", "white"];
    return { skin: skins[Math.floor(k2 * skins.length)], hair: who === "old" ? "short" : fem ? ["long", "bob", "bun", "curly"][Math.floor(k * 4)] : ["short", "messy", "curly", "short", "none"][Math.floor(k * 5)],
      hairC: who === "old" ? HAIRC.grey : [HAIRC.black, HAIRC.dbrown, HAIRC.brown, HAIRC.blond, HAIRC.red][Math.floor(k2 * 5)], beard: !fem && who !== "kid" && k > .72 }; }
  function hairBack(x, hc, r, f, lk) { const [cx, cy] = hc, h = lk.hair; if (!h || h === "none") return; x.save(); x.fillStyle = pf(lk.hairC); x.strokeStyle = OLC(); x.lineWidth = r * .07; x.lineJoin = "round";
    if (h === "long") { x.beginPath(); x.moveTo(cx - r * 1.02, cy - r * .2); x.quadraticCurveTo(cx - r * 1.3, cy + r * 1.2, cx - r * .75, cy + r * 1.5); x.lineTo(cx + r * .75, cy + r * 1.5); x.quadraticCurveTo(cx + r * 1.3, cy + r * 1.2, cx + r * 1.02, cy - r * .2); x.closePath(); x.fill(); x.stroke(); }
    if (h === "bob") { x.beginPath(); x.moveTo(cx - r * 1.06, cy - r * .1); x.lineTo(cx - r * 1.1, cy + r * .8); x.quadraticCurveTo(cx, cy + r * .98, cx + r * 1.1, cy + r * .8); x.lineTo(cx + r * 1.06, cy - r * .1); x.closePath(); x.fill(); x.stroke(); }
    if (h === "bun") { x.beginPath(); x.arc(cx - r * .12 * f, cy - r * 1.08, r * .34, 0, 7); x.fill(); x.stroke(); }
    x.restore(); }
  function hairFront(x, hc, r, f, lk) { const [cx, cy] = hc, h = lk.hair; if (!h || h === "none") return; x.save(); x.fillStyle = pf(lk.hairC); x.strokeStyle = OLC(); x.lineWidth = r * .07; x.lineJoin = "round"; x.lineCap = "round";
    if (h === "curly") { x.beginPath(); for (let i = 0; i < 9; i++) { const a = Math.PI * (1.02 + i * .12), px = cx + Math.cos(a) * r * .95, py = cy + Math.sin(a) * r * .95; x.moveTo(px + r * .27, py); x.arc(px, py, r * .27, 0, 7); } x.fill(); x.stroke(); x.restore(); return; }
    const fr = h === "messy" ? 6 : h === "short" ? 4 : 5, low = h === "bob" || h === "long" ? -.3 : h === "messy" ? -.36 : -.46, y0 = cy + r * low;
    x.beginPath(); x.arc(cx, cy, r * 1.04, Math.PI * 1.0, Math.PI * 2.0); x.lineTo(cx + r * 1.03, y0);
    for (let i = fr; i >= 0; i--) { const px = cx - r * 1.03 + 2.06 * r * i / fr, py = y0 + (i % 2 ? r * .2 : -r * .02) - (h === "messy" ? Math.abs(i - fr / 2) * r * .02 : 0); x.lineTo(px, py); }
    x.closePath(); x.fill(); x.stroke();
    if (h === "messy") { x.beginPath(); x.moveTo(cx - r * .15, cy - r * 1.02); x.quadraticCurveTo(cx - r * .05, cy - r * 1.32, cx + r * .14, cy - r * 1.18); x.moveTo(cx + r * .1, cy - r * 1.02); x.quadraticCurveTo(cx + r * .25, cy - r * 1.3, cx + r * .4, cy - r * 1.12); x.stroke(); }
    x.restore(); }
  function hatch(x, X0, Y0, w, h, gap = 12) { x.save(); x.strokeStyle = "rgba(58,48,39,.35)"; x.lineWidth = 2.2; x.beginPath(); for (let i = -h; i < w; i += gap) { x.moveTo(X0 + i, Y0 + h); x.lineTo(X0 + i + h, Y0); } x.stroke(); x.restore(); }
  function faceC(x, hc, r, f, c, t, lk) { const em = c.face || "calm", ol = OLC(), bl = (t + (c.seed || 0) * 1.7) % 3.6 < .12 || em === "sleep";
    const ink = lk.skin === "ink", big = FMT === "paper" || ink || lk.skin === "white", ex = hc[0] + r * .18 * f, ey = hc[1] - r * .02, sep = r * (big ? .56 : .5), lc = ink ? "#f4f1ea" : ol;
    [-1, 1].forEach((s) => { const cx = ex + s * sep / 2; x.beginPath();
      if (bl) { x.strokeStyle = lc; x.lineWidth = r * .06; x.lineCap = "round"; x.moveTo(cx - r * .1, ey + r * .03); x.lineTo(cx + r * .1, ey + r * .03); x.stroke(); return; }
      if (big) { x.fillStyle = "#fbfaf6"; x.ellipse(cx, ey, r * .17, r * (em === "shock" ? .24 : .2), 0, 0, 7); x.fill(); if (!ink) { x.strokeStyle = ol; x.lineWidth = r * .045; x.stroke(); } x.fillStyle = ink ? "#232129" : ol; x.beginPath(); x.arc(cx + f * r * .05 + (c.look || 0) * r * .04, ey + r * .03, r * (em === "shock" ? .06 : .08), 0, 7); x.fill(); }
      else { x.fillStyle = ol; x.ellipse(cx + f * r * .02, ey, r * .055, r * (em === "shock" ? .11 : .085), 0, 0, 7); x.fill(); } });
    x.strokeStyle = lc; x.lineWidth = r * .055; x.lineCap = "round";
    const brow = { angry: .4, worried: -.35, sad: -.3, smirk: .18, shock: -.12, calm: 0 }[em];
    if (brow != null && (em !== "calm" || big)) [-1, 1].forEach((s) => { const cx = ex + s * sep / 2, by = ey - r * (big ? .32 : .22), d = brow * r * .13 * s; x.beginPath(); x.moveTo(cx - r * .12, by - d); x.lineTo(cx + r * .12, by + d); x.stroke(); });
    const mx = ex - f * r * .02, my = hc[1] + r * .44; x.lineWidth = r * .05; x.beginPath();
    const open = em === "shock" || (c.talk && Math.sin(t * 13) > -.3);
    if (open) { const o = em === "shock" ? r * .13 : Math.abs(Math.sin(t * 13)) * r * .08 + r * .035; x.fillStyle = "#8a2c24"; x.ellipse(mx, my, r * .1, o, 0, 0, 7); x.fill(); x.strokeStyle = lc; x.stroke(); }
    else if (em === "happy") { x.arc(mx, my - r * .12, r * .18, .15 * Math.PI, .85 * Math.PI); x.stroke(); }
    else if (em === "angry") { x.fillStyle = "#fbfaf6"; rr(x, mx - r * .19, my - r * .07, r * .38, r * .15, r * .06); x.fill(); x.strokeStyle = lc; x.lineWidth = r * .04; x.stroke(); x.beginPath(); x.moveTo(mx - r * .19, my); x.lineTo(mx + r * .19, my); x.stroke(); }
    else if (em === "sad" || em === "worried") { x.arc(mx, my + r * .1, r * .14, 1.2 * Math.PI, 1.8 * Math.PI); x.stroke(); }
    else if (em === "smirk") { x.moveTo(mx - r * .12, my); x.quadraticCurveTo(mx + r * .04, my + r * .05, mx + r * .17, my - r * .08); x.stroke(); }
    else { x.moveTo(mx - r * .08, my); x.lineTo(mx + r * .08, my); x.stroke(); } }
  function figureC(x, X, Y, P, c, t) {
    const sp = WHO[c.who] || WHO.man, h = (c.h || 560) * sp.s, f = c.f || 1, hs = sp.hs || 1, lk = looks(c), sk = pf(SKIN[lk.skin] || SKIN.light), ol = OLC(), lw = Math.max(3, .012 * h), sw = Math.max(3, .014 * h);
    const col = pf(c.who === "doctor" ? "#eef0f2" : c.who === "boss" ? "#2f3546" : (HOOD[c.col] || c.col || HOOD.yellow));
    const sit = P.sit || 0, lie = P.lie || 0, lean = (P.lean || 0) + (sp.lean || 0), br = Math.sin(t * 2.1 + (c.seed || 0)) * .005 * h;
    x.save(); x.translate(X, Y); if (lie) { x.rotate(-90 * D * f); x.translate(0, .36 * h); }
    if (!lie) { x.save(); x.globalAlpha = FMT === "paper" ? .14 : .2; x.fillStyle = "#000"; x.beginPath(); x.ellipse(0, 0, .2 * h, .03 * h, 0, 0, 7); x.fill(); x.restore(); }
    const hipY = -(sit ? .2 : .3) * h, uL = .16 * h, lL = .15 * h, uA = .13 * h, fA = .12 * h;
    const legs = P.l.map((l) => { const k = seg(0, hipY, l[0], uL, f), a = seg(k[0], k[1], l[0] + l[1], lL, f); return [[0, hipY], k, a]; });
    const stick = (pts) => { x.strokeStyle = ol; x.lineWidth = sw; x.lineCap = "round"; x.lineJoin = "round"; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.stroke(); };
    legs.forEach(stick);
    x.save(); x.translate(0, hipY); x.rotate(lean * D * f); x.translate(0, -hipY);
    const bt = -.64 * h + br, bb = hipY + .03 * h, bw = .27 * h, so = [0, bt + .09 * h];
    const arms = P.a.map((a) => { const e = seg(so[0], so[1], a[0], uA, f), w = seg(e[0], e[1], a[0] + a[1], fA, f); return [so, e, w]; });
    const hand = (p) => { x.fillStyle = FMT === "paper" ? sk : ol; x.strokeStyle = ol; x.lineWidth = lw * .7; x.beginPath(); x.arc(p[0], p[1], .022 * h, 0, 7); x.fill(); if (FMT === "paper") x.stroke(); };
    stick(arms[0]); hand(arms[0][2]);
    // тулуб — округла «квасолина» в кольорі одягу
    const body = () => { x.beginPath(); x.moveTo(0, bt); x.bezierCurveTo(bw * .56, bt, bw * .6, bb - .03 * h, bw * .44, bb); x.quadraticCurveTo(0, bb + .045 * h, -bw * .44, bb); x.bezierCurveTo(-bw * .6, bb - .03 * h, -bw * .56, bt, 0, bt); x.closePath(); };
    body(); x.fillStyle = col; x.fill(); x.save(); body(); x.clip(); if (FMT === "paper") hatch(x, bw * .05, bt, bw * .6, bb - bt + .05 * h); else { x.fillStyle = "rgba(0,0,0,.13)"; x.fillRect(bw * .08, bt - 10, bw, bb - bt + .08 * h); }
    if (sp.suit) { x.fillStyle = "#f3f1ec"; x.beginPath(); x.moveTo(-.05 * h, bt); x.lineTo(.05 * h, bt); x.lineTo(0, bt + .14 * h); x.fill(); x.fillStyle = "#b5473f"; x.beginPath(); x.moveTo(-.012 * h, bt + .03 * h); x.lineTo(.012 * h, bt + .03 * h); x.lineTo(.018 * h, bt + .16 * h); x.lineTo(0, bt + .18 * h); x.lineTo(-.018 * h, bt + .16 * h); x.fill(); }
    else if (sp.coat) { x.strokeStyle = "#c9ced6"; x.lineWidth = lw * .8; x.beginPath(); x.moveTo(.02 * h * f, bt + .04 * h); x.lineTo(.03 * h * f, bb); x.stroke(); }
    else if (c.who !== "hero") { x.strokeStyle = ol; x.lineWidth = lw * .7; x.beginPath(); x.moveTo(-.045 * h, bt + .01 * h); x.lineTo(0, bt + .05 * h); x.lineTo(.045 * h, bt + .01 * h); x.stroke(); }
    x.restore(); body(); x.strokeStyle = ol; x.lineWidth = lw; x.stroke();
    // голова
    const r = .17 * h * hs, ht = (P.ht || 0) + Math.sin(t * 1.3 + (c.seed || 0)) * 1.5, hc = [.012 * h * f, bt - r * .78];
    x.save(); x.translate(hc[0], hc[1] + r); x.rotate(ht * D * f); x.translate(-hc[0], -hc[1] - r);
    hairBack(x, hc, r, f, lk);
    x.beginPath(); x.arc(hc[0], hc[1], r, 0, 7); x.fillStyle = sk; x.fill();
    x.save(); x.beginPath(); x.arc(hc[0], hc[1], r, 0, 7); x.clip();
    if (FMT === "paper") hatch(x, hc[0] + r * .2, hc[1] - r, r * .9, r * 2, 11); else { x.fillStyle = "rgba(90,50,30,.13)"; x.beginPath(); x.rect(hc[0] - r * 2, hc[1] - r * 2, r * 4, r * 4); x.arc(hc[0] - r * .28 * f, hc[1] - r * .12, r * 1.02, 0, 7, true); x.fill("evenodd"); }
    if (lk.beard) { x.fillStyle = pf(lk.hairC); x.beginPath(); x.ellipse(hc[0], hc[1] + r * 1.0, r * 1.1, r * .62, 0, 0, 7); x.fill(); }
    x.restore();
    x.beginPath(); x.arc(hc[0], hc[1], r, 0, 7); x.strokeStyle = ol; x.lineWidth = lw; x.stroke();
    faceC(x, hc, r, f, c, t, lk);
    hairFront(x, hc, r, f, lk);
    if (sp.glasses || c.acc === "glasses") { x.strokeStyle = ol; x.lineWidth = r * .05; const ex = hc[0] + r * .18 * f, sep = r * .5; [-1, 1].forEach((s) => { x.beginPath(); x.arc(ex + s * sep / 2, hc[1] - r * .02, r * .2, 0, 7); x.stroke(); }); x.beginPath(); x.moveTo(ex - sep / 2 + r * .2, hc[1] - r * .04); x.lineTo(ex + sep / 2 - r * .2, hc[1] - r * .04); x.stroke(); }
    else if (c.acc && c.acc !== "none") acc(x, hc, r, f, c.acc, c.accC);
    x.restore();
    stick(arms[1]); hand(arms[1][2]);
    x.restore(); x.restore();
    const wr = arms[1][2]; let hx = wr[0], hy = wr[1];
    if (lean) { const a = lean * D * f, dx = hx, dy = hy - hipY; hx = dx * Math.cos(a) - dy * Math.sin(a); hy = dx * Math.sin(a) + dy * Math.cos(a) + hipY; }
    return { hand: [X + hx, Y + hy], head: [X + hc[0], Y + hc[1]], r, h }; }
  /* ----- пласкі фони з контуром ----- */
  const HZ = 1230;
  function bgC(x, place, tm, seed) { const ol = OLC(), paper = FMT === "paper", LW = paper ? 5 : 6;
    const S = (fill, path) => { if (fill) { x.fillStyle = pf(fill); x.fill(path); } x.strokeStyle = ol; x.lineWidth = LW; x.lineJoin = "round"; x.lineCap = "round"; x.stroke(path); };
    const R = (X, Y, w, h, fill, r = 8) => { const p = new Path2D(); p.roundRect ? p.roundRect(X, Y, w, h, r) : p.rect(X, Y, w, h); S(fill, p); return p; };
    const C = (X, Y, rad, fill) => { const p = new Path2D(); p.arc(X, Y, rad, 0, 7); S(fill, p); };
    const L2 = (pts, w = LW) => { x.strokeStyle = ol; x.lineWidth = w; x.lineCap = "round"; x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.stroke(); };
    const blob = (X, Y, rad, fill, n = 7, k = .28) => { const p = new Path2D(); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, rr2 = rad * (1 + k * Math.sin(i * 2.3 + seed)), px = X + Math.cos(a) * rr2, py = Y + Math.sin(a) * rr2 * .85; if (!i) p.moveTo(px, py); else { const a0 = (i - .5) / n * Math.PI * 2; p.quadraticCurveTo(X + Math.cos(a0) * rad * 1.35, Y + Math.sin(a0) * rad * 1.15, px, py); } } p.closePath(); S(fill, p); };
    const wall = (c) => { x.fillStyle = pf(c); x.fillRect(0, 0, W, H); };
    const floorC = (c, y = HZ) => { x.fillStyle = pf(c); x.fillRect(0, y, W, H - y); L2([[0, y], [W, y]]); };
    const winB = (X, Y, w, h, out = "#bcd3e0") => { R(X, Y, w, h, "#f3f1ec", 4); R(X + 14, Y + 14, w - 28, h - 28, out, 2); blob(X + w * .55, Y + h * .62, w * .2, "#a7c4a4", 6, .2); x.strokeStyle = pf("#8a7a6a"); x.lineWidth = 7; x.beginPath(); x.moveTo(X + w * .55, Y + h - 14); x.lineTo(X + w * .55, Y + h * .7); x.stroke();
      for (let i = 0; i < 4; i++) R(X + 14, Y + 14 + i * h * .085, w - 28, h * .085, "#d9dde1", 0); L2([[X + w / 2, Y + 14], [X + w / 2, Y + h - 14]]); };
    const clock = (X, Y, rad) => { C(X, Y, rad, "#8d939b"); C(X, Y, rad * .8, "#eef1f3"); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; L2([[X + Math.cos(a) * rad * .66, Y + Math.sin(a) * rad * .66], [X + Math.cos(a) * rad * .74, Y + Math.sin(a) * rad * .74]], 3); } L2([[X, Y], [X + rad * .4, Y - rad * .45]]); L2([[X, Y], [X - rad * .05, Y - rad * .6]], 4); };
    const door = (X, Y, w, h, c = "#9a7b5e") => { R(X - 14, Y - 14, w + 28, h + 14, "#c8bcae", 6); R(X, Y, w, h, c, 4); C(X + w * .82, Y + h * .52, 16, "#d9d2c4"); };
    const desk = (X, Y, w, c = "#8d8a86") => { R(X, Y, w, 30, c, 4); L2([[X + 30, Y + 30], [X + 30, HZ + 60]]); L2([[X + w - 30, Y + 30], [X + w - 30, HZ + 60]]); };
    const monitor = (X, Y, w) => { R(X, Y, w, w * .62, "#6f7378", 8); R(X + 16, Y + 16, w - 32, w * .62 - 32, "#3f4347", 4); R(X + w / 2 - 12, Y + w * .62, 24, 40, "#6f7378", 2); R(X + w / 2 - 60, Y + w * .62 + 40, 120, 14, "#6f7378", 4); };
    const dresser = (X, Y, w, h, c = "#626b74") => { R(X, Y, w, h, c, 6); for (let i = 0; i < 3; i++) { L2([[X, Y + h * (i + 1) / 3.2], [X + w, Y + h * (i + 1) / 3.2]]); L2([[X + w / 2 - 20, Y + h * (i + .5) / 3.2], [X + w / 2 + 20, Y + h * (i + .5) / 3.2]], 4); } L2([[X + 16, Y + h], [X + 16, Y + h + 22]]); L2([[X + w - 16, Y + h], [X + w - 16, Y + h + 22]]); };
    const bed = (X, Y, w, c = "#d3d8dc") => { R(X + w * .18, Y - 230, w * .64, 260, c, 60); const p = new Path2D(); p.moveTo(X + w * .14, Y); p.lineTo(X + w * .86, Y); p.lineTo(X + w * 1.02, Y + 420); p.lineTo(X - w * .02, Y + 420); p.closePath(); S(c, p); L2([[X + w * .22, Y + 30], [X + w * .78, Y + 30]], 4); };
    const iv = (X, Y) => { L2([[X, Y], [X, HZ + 70]], 9); L2([[X - 60, Y], [X + 60, Y]], 9); R(X + 10, Y + 30, 70, 140, "#aab7c2", 16); L2([[X + 45, Y + 170], [X + 45, Y + 230], [X + 60, HZ - 80]], 3); };
    const shelf = (X, Y, w, n = 3) => { for (let i = 0; i < n; i++) { const yy = Y + i * 150; R(X, yy, w, 18, "#9b8570", 3); let bx = X + 14; for (let k = 0; k < 6; k++) { const bw2 = 26 + hsh(seed + ":" + i + k) * 26, bh = 70 + hsh(k + ":" + seed + i) * 50; R(bx, yy - bh, bw2, bh, ["#c96a5b", "#6d8fb3", "#d6b56a", "#7aa37d", "#8b6fa8"][(k + i) % 5], 3); bx += bw2 + 6; if (bx > X + w - 40) break; } } };
    const plant = (X, Y) => { blob(X, Y - 120, 70, "#7da674", 6, .3); blob(X + 40, Y - 170, 55, "#8fb886", 6, .3); R(X - 50, Y - 70, 100, 90, "#b9785a", 10); };
    const tree = (X, Y, s = 1, c = "#7fa877") => { R(X - 16 * s, Y - 190 * s, 32 * s, 200 * s, "#8a6a52", 6); blob(X, Y - 280 * s, 130 * s, c, 8, .22); };
    const bldg = (X, Y, w, h, c) => { R(X, Y - h, w, h, c, 4); for (let i = 0; i < Math.floor(h / 90); i++) for (let k = 0; k < Math.floor(w / 70); k++) R(X + 22 + k * 70, Y - h + 26 + i * 90, 34, 46, tm === "night" ? (hsh(i + ":" + k + seed) > .5 ? "#f2d27a" : "#3d4560") : "#dfe7ee", 3); };
    const sky = (top, bot) => { const g = x.createLinearGradient(0, 0, 0, HZ); g.addColorStop(0, pf(top)); g.addColorStop(1, pf(bot)); x.fillStyle = g; x.fillRect(0, 0, W, HZ); };
    const SKY = tm === "night" ? ["#1f2747", "#3a4470"] : tm === "sunset" ? ["#f0b27a", "#f6dcb0"] : ["#8ec3ea", "#cfe6f5"];
    switch (place) {
      case "bedroom": wall("#cfd5de"); winB(560, 360, 380, 520); floorC("#8f939c"); dresser(70, 930, 300, 300); bed(300, 1110, 520); break;
      case "class": wall("#d9c7ae"); clock(230, 380, 95); winB(500, 320, 500, 620); R(70, 560, 360, 300, "#4f6b5a", 6); for (let i = 0; i < 4; i++) L2([[110, 620 + i * 55], [110 + 160 + hsh(i + "c") * 110, 620 + i * 55]], 4); floorC("#a08a70"); desk(-40, 1360, 300, "#9a7b5e"); desk(820, 1360, 300, "#9a7b5e"); break;
      case "office": wall("#d5dae1"); winB(120, 330, 380, 560); shelf(620, 520, 380); floorC("#8b939d"); plant(560, HZ); desk(640, 1050, 400); monitor(740, 830, 220); break;
      case "hospital": wall("#cdd4da"); floorC("#8d969e"); dresser(50, 880, 320, 340); bed(300, 1100, 520); iv(920, 640); break;
      case "lab": wall("#d6e0e3"); shelf(80, 560, 420); winB(600, 340, 380, 480); floorC("#8e9ba1"); desk(80, 1040, 920, "#aeb8bd"); [0, 1, 2].forEach((i) => { R(200 + i * 230, 920, 60, 120, ["#9fd3c7", "#f2c46d", "#c99ad6"][i], 18); }); break;
      case "cafe": wall("#d9c4ab"); R(120, 330, 840, 320, "#3d3a36", 8); for (let i = 0; i < 4; i++) L2([[180, 410 + i * 60], [180 + 200 + hsh(i + "m") * 300, 410 + i * 60]], 4); [260, 540, 820].forEach((X) => { L2([[X, 0], [X, 180]], 4); const p = new Path2D(); p.moveTo(X - 60, 250); p.lineTo(X + 60, 250); p.lineTo(X + 30, 180); p.lineTo(X - 30, 180); p.closePath(); S("#e0b25c", p); });
        floorC("#8f6f58"); R(40, 960, 1000, 270, "#9a7b5e", 6); [180, 380, 760].forEach((X) => R(X, 900, 70, 60, "#eeeae2", 10)); break;
      case "kitchen": wall("#dfe3d6"); R(60, 380, 420, 260, "#c9b79c", 6); L2([[270, 380], [270, 640]]); R(760, 520, 260, 720, "#e7ebee", 14); L2([[760, 800], [1020, 800]]); floorC("#a39886"); R(60, 980, 640, 250, "#c9b79c", 6); R(60, 960, 640, 30, "#eeeae2", 4); break;
      case "gym": wall("#d0d4d9"); R(80, 320, 920, 560, "#e9eef2", 6); floorC("#7e858c"); for (let i = 0; i < 4; i++) { R(140 + i * 220, 1080, 140, 40, "#55595e", 18); } L2([[100, 1120], [980, 1120]], 8); break;
      case "shop": wall("#e0d8c8"); shelf(60, 520, 440, 4); shelf(580, 520, 440, 4); floorC("#9e9284"); break;
      case "blog": wall("#d3cfe0"); C(780, 700, 170, "#f7f4ec"); C(780, 700, 120, "#d3cfe0"); L2([[780, 870], [780, HZ + 40]], 8); floorC("#8e8aa0"); desk(60, 1060, 520); monitor(150, 840, 240); break;
      case "stage": wall("#3b3550"); [0, 1].forEach((s) => { const p = new Path2D(), X = s ? W : 0, k = s ? -1 : 1; p.moveTo(X, 0); p.lineTo(X + k * 260, 0); p.quadraticCurveTo(X + k * 160, 700, X + k * 230, HZ); p.lineTo(X, HZ); p.closePath(); S("#a3433d", p); });
        x.fillStyle = "rgba(255,240,200,.18)"; x.beginPath(); x.moveTo(470, 0); x.lineTo(610, 0); x.lineTo(900, HZ + 260); x.lineTo(180, HZ + 260); x.closePath(); x.fill(); floorC("#6b5b4b"); break;
      case "street": case "night": sky(...(place === "night" ? ["#1f2747", "#3a4470"] : SKY)); bldg(-20, HZ, 300, 620, "#a9b4c0"); bldg(300, HZ, 260, 820, "#c4b5a3"); bldg(580, HZ, 280, 560, "#9fa9b5"); bldg(870, HZ, 260, 760, "#b8a998"); floorC("#9aa0a6"); x.fillStyle = pf("#5b6168"); x.fillRect(0, HZ + 260, W, H); L2([[0, HZ + 260], [W, HZ + 260]]); break;
      case "road": sky(...SKY); { const p = new Path2D(); p.moveTo(0, HZ - 80); p.quadraticCurveTo(300, HZ - 260, 620, HZ - 120); p.quadraticCurveTo(860, HZ - 260, W, HZ - 140); p.lineTo(W, HZ); p.lineTo(0, HZ); p.closePath(); S("#8e9cc0", p); }
        floorC("#c9b58e"); { const p = new Path2D(); p.moveTo(500, HZ); p.lineTo(580, HZ); p.lineTo(900, H); p.lineTo(180, H); p.closePath(); S("#6b6f74", p); } for (let i = 0; i < 5; i++) { const y = HZ + 40 + i * 140; x.fillStyle = pf("#efe9dc"); x.fillRect(536 - i * 6, y, 8 + i * 4, 60 + i * 10); } break;
      case "park": sky(...SKY); tree(140, HZ, 1.1); tree(900, HZ, 1.2, "#8bb27f"); blob(520, HZ - 60, 110, "#94b98a", 7, .2); floorC("#9cc08a"); { const p = new Path2D(); p.moveTo(470, HZ); p.lineTo(610, HZ); p.quadraticCurveTo(700, 1600, 880, H); p.lineTo(260, H); p.quadraticCurveTo(420, 1600, 470, HZ); p.closePath(); S("#d8c49c", p); } break;
      case "space": x.fillStyle = pf("#1b1f3a"); x.fillRect(0, 0, W, H); for (let i = 0; i < 70; i++) { x.fillStyle = "rgba(255,255,255,.8)"; x.beginPath(); x.arc(hsh(i + "x" + seed) * W, hsh(i + "y" + seed) * H, 2 + hsh(i + "s") * 3, 0, 7); x.fill(); } C(820, 420, 150, "#d98b6a"); L2([[640, 470], [1010, 360]], 7); break;
      case "board": { x.fillStyle = "#1d2140"; x.fillRect(0, 0, W, H); } break;
      case "stop": sky("#c9ced4", "#e3e5e7"); bldg(-20, HZ, 280, 760, "#b9bec5"); bldg(280, HZ, 240, 900, "#c4c8cd"); bldg(540, HZ, 260, 700, "#b3b8bf"); bldg(820, HZ, 280, 840, "#bfc3c9"); x.fillStyle = "rgba(235,236,238,.5)"; x.fillRect(0, 0, W, HZ); floorC("#9aa0a6");
        { const p = new Path2D(); p.rect(560, HZ - 330, 440, 330); S("rgba(205,220,230,.5)", p); R(540, HZ - 360, 480, 34, "#6b7078", 4); } R(150, HZ - 500, 18, 500, "#555a62", 2); R(118, HZ - 640, 82, 200, "#555a62", 14); C(159, HZ - 600, 24, "#e0443a"); C(159, HZ - 540, 24, "#3a3c44"); C(159, HZ - 480, 24, "#3a3c44");
        for (let i = 0; i < 7; i++) { x.fillStyle = pf("#f2f2f2"); x.fillRect(40 + i * 150, HZ + 300, 90, 120); } break;
      case "void": { const g = x.createRadialGradient(W / 2, H * .45, 100, W / 2, H * .5, H * .7); g.addColorStop(0, pf("#e3e7ec")); g.addColorStop(1, pf("#c3c9d2")); x.fillStyle = g; x.fillRect(0, 0, W, H); } break;
      default: wall("#d8cfc2"); clock(170, 360, 80); winB(330, 330, 440, 540); door(60, 760, 220, HZ - 760); floorC("#9a8068"); desk(640, 1050, 440); monitor(760, 830, 220); }
    if (tm === "night" && place !== "space" && place !== "night") { x.save(); x.globalCompositeOperation = "multiply"; x.fillStyle = "rgba(70,80,140,.55)"; x.fillRect(0, 0, W, H); x.restore(); }
    if (tm === "sunset" && place !== "space") { x.save(); x.globalCompositeOperation = "multiply"; x.fillStyle = "rgba(255,200,150,.35)"; x.fillRect(0, 0, W, H); x.restore(); }
    if (paper) { x.save(); x.globalCompositeOperation = "multiply"; for (let i = 0; i < 26; i++) { const X = hsh(i + "px" + seed) * W, Y = hsh(i + "py" + seed) * H, R2 = 140 + hsh(i + "pr") * 260, g = x.createRadialGradient(X, Y, 0, X, Y, R2); g.addColorStop(0, "rgba(200,170,120,.1)"); g.addColorStop(1, "rgba(200,170,120,0)"); x.fillStyle = g; x.fillRect(X - R2, Y - R2, R2 * 2, R2 * 2); } x.restore();
      for (let i = 0; i < 9; i++) { const X = 40 + hsh(i + "g" + seed) * (W - 80); L2([[X, FLOOR + 30], [X - 8, FLOOR + 8]], 3); L2([[X + 6, FLOOR + 30], [X + 6, FLOOR + 4]], 3); L2([[X + 12, FLOOR + 30], [X + 20, FLOOR + 10]], 3); } }
  }
  // рамка старого паперу (поверх кадру, не рухається з камерою)
  function paperFrame(x) { x.save();
    x.globalCompositeOperation = "multiply"; const g = x.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .75); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(170,135,90,.22)"); x.fillStyle = g; x.fillRect(0, 0, W, H); x.restore(); }
  // підпис зі стрілкою до героя («Олег, 2015»)
  function noteText(x, t, hd, lt, out) { const a = clamp(lt / .3) * (out ? clamp((out - lt) / .25) : 1); if (a <= 0 || !hd) return; const side = hd[0] > W / 2 ? -1 : 1, tx = clamp(hd[0] + side * -1 * 0 + (side > 0 ? 250 : -250), 220, W - 220), ty = Math.max(300, hd[1] - 220);
    x.save(); x.globalAlpha = a; x.font = `700 70px "${HANDF}", "${FONT}", cursive`; x.textAlign = "center"; x.textBaseline = "middle"; const tw = Math.min(x.measureText(t).width, W - 120);
    const dark = !KN(); x.lineJoin = "round"; if (!dark) { x.strokeStyle = "rgba(15,14,22,.9)"; x.lineWidth = 12; x.strokeText(t, tx, ty, W - 120); } x.fillStyle = dark ? OLC() : "#fff"; x.fillText(t, tx, ty, W - 120);
    const sx = tx - side * tw * .35, sy = ty + 46, ex = hd[0] + side * 70, ey = hd[1] - 30, p = eout(clamp((lt - .15) / .4));
    x.strokeStyle = dark ? OLC() : "#fff"; x.lineWidth = 6; x.lineCap = "round"; x.beginPath(); x.moveTo(sx, sy); const mx = lerp(sx, ex, .2), my = lerp(sy, ey, .9); const qx = lerp(sx, mx, p), qy = lerp(sy, my, p); x.quadraticCurveTo(qx, qy, lerp(sx, ex, p), lerp(sy, ey, p)); x.stroke();
    if (p > .95) { const ang = Math.atan2(ey - my, ex - mx); x.beginPath(); x.moveTo(ex, ey); x.lineTo(ex - Math.cos(ang - .5) * 26, ey - Math.sin(ang - .5) * 26); x.moveTo(ex, ey); x.lineTo(ex - Math.cos(ang + .5) * 26, ey - Math.sin(ang + .5) * 26); x.stroke(); }
    x.restore(); }
  const PLACES = {
    room: { n: "Кімната", light: [140, 360], draw(x, tm, s) { wall(x, "#8f8296", tm); win(x, 110, 330, 380, 560, tm, s, "city"); plant(x, 420, 1010, .9); frame(x, 640, 420, 190, 140, "#d9b48a"); frame(x, 870, 470, 110, 150, "#8fa7c9");
      x.fillStyle = "#6f6474"; rr(x, 560, 1180, 470, 200, 26); x.fill(); x.fillStyle = "#7d7183"; rr(x, 540, 1260, 510, 170, 24); x.fill(); x.fillStyle = "#e3d4b8"; rr(x, 610, 1210, 120, 70, 18); x.fill(); floor(x, "#6d5a4e", tm); } },
    bedroom: { n: "Спальня", light: [760, 380], draw(x, tm, s) { wall(x, "#7f7896", tm); win(x, 640, 330, 340, 520, tm, s, "city"); frame(x, 140, 470, 220, 160, "#cfa47b");
      x.fillStyle = "#e3d8c6"; x.fillRect(100, 960, 120, 160); x.fillStyle = "#f2d38f"; x.beginPath(); x.moveTo(120, 960); x.lineTo(200, 960); x.lineTo(180, 900); x.lineTo(140, 900); x.fill();
      x.fillStyle = "#5c5470"; rr(x, 240, 1060, 760, 120, 18); x.fill(); x.fillStyle = "#d9d0e2"; rr(x, 250, 1130, 740, 230, 16); x.fill(); x.fillStyle = "#6c6694"; rr(x, 420, 1150, 590, 230, 20); x.fill(); x.fillStyle = "#f0ebe3"; rr(x, 270, 1100, 170, 80, 26); x.fill(); floor(x, "#5f5262", tm); } },
    class: { n: "Клас", light: [230, 330], draw(x, tm, s) { wall(x, "#8b8090", tm); win(x, 60, 300, 300, 520, tm, s, "trees"); x.fillStyle = "#3c4a3f"; x.fillRect(470, 360, 600, 560); x.strokeStyle = "#8a6e52"; x.lineWidth = 18; x.strokeRect(470, 360, 600, 560);
      x.strokeStyle = "rgba(240,240,230,.7)"; x.lineWidth = 6; x.lineCap = "round"; for (let i = 0; i < 5; i++) { x.beginPath(); let X = 520; x.moveTo(X, 440 + i * 95); while (X < 980 - rnd(i, s) * 200) { X += 18 + rnd(X, i) * 22; x.lineTo(X, 440 + i * 95 + (rnd(X, i + 1) - .5) * 26); } x.stroke(); }
      PROPS.clock(x, .5, {}, 3); desk(x, 120, 1230, 330); desk(x, 640, 1260, 360); floor(x, "#6e5a4c", tm); } },
    office: { n: "Офіс", light: [520, 300], draw(x, tm, s) { wall(x, "#848a98", tm); win(x, 70, 260, 940, 520, tm, s, "city"); x.fillStyle = "#e6e0d8"; x.fillRect(370, 260, 12, 520); x.fillRect(690, 260, 12, 520);
      plant(x, 120, 1300, 1); x.fillStyle = "#5b5f6e"; x.fillRect(880, 900, 150, 600); x.fillStyle = "#6a6f80"; for (let i = 0; i < 4; i++) x.fillRect(890, 920 + i * 140, 130, 110); desk(x, 300, 1200, 520, "#9a8a78"); x.fillStyle = "#33323b"; rr(x, 470, 1010, 190, 130, 8); x.fill(); x.fillStyle = "#9fb4d6"; rr(x, 480, 1020, 170, 110, 5); x.fill(); x.fillStyle = "#33323b"; x.fillRect(555, 1140, 20, 60); floor(x, "#5c5a63", tm, false); } },
    street: { n: "Вулиця", light: [900, 200], draw(x, tm, s) { sky(x, 0, 0, W, FLOOR, tm, s, "none"); const T = TIME[tm] || TIME.day;
      [[-40, 300, 300, 1180, "#c7a690"], [230, 520, 200, 960, "#9a8fa8"], [780, 420, 340, 1060, "#b09583"], [620, 640, 190, 840, "#8a8da3"]].forEach(([X, Y, w, h, c]) => { x.fillStyle = shade(c, T.amb); x.fillRect(X, Y, w, h + 40); for (let i = 0; i < 18; i++) { x.fillStyle = tm === "night" ? (rnd(i, X) > .5 ? "#f4cf88" : "#3b3d5c") : "rgba(255,255,255,.45)"; x.fillRect(X + 22 + (i % 3) * w / 3.3, Y + 30 + Math.floor(i / 3) * 120, w / 6, 70); } });
      x.fillStyle = shade("#6c6a72", T.amb); x.fillRect(0, FLOOR - 40, W, H); x.fillStyle = shade("#8d8a8e", T.amb); x.fillRect(0, FLOOR - 60, W, 40); x.fillStyle = "rgba(255,255,255,.7)"; for (let i = 0; i < 6; i++) x.fillRect(80 + i * 180, FLOOR + 160, 110, 14);
      x.fillStyle = "#6f9460"; [[140, 1340], [960, 1330]].forEach(([X, Y]) => { x.fillStyle = "#5b4a40"; x.fillRect(X - 10, Y - 160, 20, 200); x.fillStyle = "#6f9460"; x.beginPath(); x.arc(X, Y - 220, 110, 0, 7); x.fill(); }); } },
    stop: { n: "Зупинка в тумані", light: [700, 260], draw(x, tm, s) { const T = TIME[tm] || TIME.day; const g = x.createLinearGradient(0, 0, 0, FLOOR); g.addColorStop(0, shade("#aeb4bd", T.amb)); g.addColorStop(1, shade("#d4d6d8", T.amb)); x.fillStyle = g; x.fillRect(0, 0, W, FLOOR);
      [[-30, 380, 260, "#9aa1aa"], [200, 300, 220, "#a7adb5"], [430, 420, 260, "#9ca2ab"], [700, 260, 240, "#a3a9b1"], [900, 400, 220, "#99a0a9"]].forEach(([X, Y, w, c]) => { x.fillStyle = shade(c, T.amb); x.fillRect(X, Y, w, FLOOR - Y); x.fillStyle = tm === "night" ? "rgba(244,207,136,.5)" : "rgba(255,255,255,.22)"; for (let i = 0; i < 24; i++) x.fillRect(X + 20 + (i % 4) * (w / 4.4), Y + 30 + Math.floor(i / 4) * 110, w / 7, 60); });
      x.fillStyle = "rgba(230,232,234,.55)"; x.fillRect(0, 0, W, FLOOR); // туман
      x.fillStyle = shade("#7d8087", T.amb); x.fillRect(0, FLOOR - 60, W, H); x.fillStyle = shade("#9c9ea3", T.amb); x.fillRect(0, FLOOR - 80, W, 40);
      x.fillStyle = "rgba(255,255,255,.75)"; for (let i = 0; i < 7; i++) x.fillRect(40 + i * 150, FLOOR + 210, 90, 120);
      // зупинка
      x.strokeStyle = "#5a5e66"; x.lineWidth = 12; x.strokeRect(560, 1040, 440, 400); x.fillStyle = "rgba(200,215,225,.35)"; x.fillRect(566, 1046, 428, 388); x.fillStyle = "#5a5e66"; x.fillRect(540, 1010, 480, 34); x.fillRect(600, 1300, 360, 20);
      // світлофор
      x.fillStyle = "#4a4d55"; x.fillRect(150, 760, 18, 700); rr(x, 118, 640, 82, 200, 16); x.fill(); [["#e0443a", 680], ["#3a3c44", 740], ["#3a3c44", 800]].forEach(([c, Y]) => { x.fillStyle = c; x.beginPath(); x.arc(159, Y, 24, 0, 7); x.fill(); }); } },
    board: { n: "Інфографіка", light: null, draw(x, tm, s) { const g = x.createRadialGradient(W / 2, H * .45, 100, W / 2, H * .5, H * .8); g.addColorStop(0, "#2b3160"); g.addColorStop(1, "#171a35"); x.fillStyle = g; x.fillRect(0, 0, W, H); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(255,255,255,${.02 + rnd(i, 71) * .04})`; x.fillRect(rnd(i, 72) * W, rnd(i, 73) * H, 2, 2); } } },
    night: { n: "Нічне місто", light: [800, 200], draw(x, tm, s) { sky(x, 0, 0, W, FLOOR - 100, "night", s, "city"); x.fillStyle = "#f1ead6"; x.beginPath(); x.arc(820, 260, 70, 0, 7); x.fill(); x.fillStyle = "#24253f"; x.fillRect(0, FLOOR - 100, W, H); x.fillStyle = "#30324f"; x.fillRect(0, FLOOR - 60, W, 30); } },
    road: { n: "Дорога", light: [540, 700], draw(x, tm, s) { const T = TIME[tm] || TIME.sunset, hz = 1050; sky(x, 0, 0, W, hz, tm, s, "none"); const g = x.createRadialGradient(540, hz, 20, 540, hz, 520); g.addColorStop(0, "rgba(255,240,210,.8)"); g.addColorStop(1, "rgba(255,240,210,0)"); x.fillStyle = g; x.fillRect(0, 0, W, hz);
      x.fillStyle = mix(T.sky[1], "#8f8578", .5); x.beginPath(); x.moveTo(0, hz); for (let i = 0; i <= 10; i++) x.lineTo(i * W / 10, hz - 30 - rnd(i, s) * 60); x.lineTo(W, hz); x.fill(); x.fillStyle = shade("#b9a585", T.amb); x.fillRect(0, hz, W, H - hz);
      x.fillStyle = shade("#6b6670", T.amb); x.beginPath(); x.moveTo(520, hz); x.lineTo(560, hz); x.lineTo(1000, H); x.lineTo(80, H); x.fill(); x.fillStyle = "rgba(255,255,255,.8)"; for (let i = 0; i < 7; i++) { const a = Math.pow(i / 7, 2), b = Math.pow((i + .5) / 7, 2); x.beginPath(); x.moveTo(538 - a * 6, hz + a * (H - hz)); x.lineTo(542 + a * 6, hz + a * (H - hz)); x.lineTo(542 + b * 12, hz + b * (H - hz)); x.lineTo(538 - b * 12, hz + b * (H - hz)); x.fill(); }
      x.strokeStyle = "#5c5560"; x.lineWidth = 6; for (let i = 0; i < 5; i++) { const X = 160 - i * 30 + i * i * 4, Y = hz + 10 + i * 40, hh = 60 + i * 50; x.beginPath(); x.moveTo(X, Y); x.lineTo(X, Y - hh); x.stroke(); } } },
    lab: { n: "Лабораторія", light: [540, 260], draw(x, tm, s) { wall(x, "#7d838c", "day"); x.strokeStyle = "rgba(0,0,0,.12)"; x.lineWidth = 4; for (let i = 1; i < 6; i++) { x.beginPath(); x.moveTo(i * 180, 0); x.lineTo(i * 180, FLOOR); x.stroke(); }
      x.fillStyle = "#2f3340"; rr(x, 90, 520, 400, 270, 12); x.fill(); x.strokeStyle = "#7fe0b0"; x.lineWidth = 5; x.beginPath(); for (let i = 0; i < 40; i++) { const X = 110 + i * 9.5, Y = 655 + Math.sin(i * .7) * 40 * rnd(i, s); i ? x.lineTo(X, Y) : x.moveTo(X, Y); } x.stroke(); x.fillStyle = "#2f3340"; rr(x, 590, 520, 400, 270, 12); x.fill(); x.fillStyle = "#e6d36a"; [0, 1, 2, 3].forEach((i) => x.fillRect(620 + i * 90, 700 - rnd(i, s) * 130, 56, 60 + rnd(i, s) * 130));
      x.fillStyle = "#e3c44a"; x.fillRect(0, FLOOR - 70, W, 50); x.fillStyle = "#2b2932"; for (let i = -1; i < 14; i++) { x.beginPath(); x.moveTo(i * 90, FLOOR - 20); x.lineTo(i * 90 + 45, FLOOR - 70); x.lineTo(i * 90 + 85, FLOOR - 70); x.lineTo(i * 90 + 40, FLOOR - 20); x.fill(); } floor(x, "#4f525b", tm, false); } },
    hospital: { n: "Лікарня", light: [800, 300], draw(x, tm, s) { wall(x, "#d4d6d8", "day"); x.fillStyle = "#c4c7cc"; x.fillRect(0, 640, W, 26); ["#79b37a", "#6c8fc6", "#e3c44a", "#d97a5a"].forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc(160 + i * 110, 653, 22, 0, 7); x.fill(); }); win(x, 700, 260, 300, 440, tm, s, "trees");
      x.fillStyle = "#33363f"; rr(x, 90, 860, 210, 150, 10); x.fill(); x.strokeStyle = "#7fe0b0"; x.lineWidth = 5; x.beginPath(); x.moveTo(110, 940); [[150, 940], [165, 890], [180, 980], [195, 940], [280, 940]].forEach((p) => x.lineTo(p[0], p[1])); x.stroke();
      x.fillStyle = "#b9bec6"; x.fillRect(360, 1200, 20, 300); x.fillRect(960, 1200, 20, 300); x.fillStyle = "#eef0f2"; rr(x, 340, 1150, 660, 110, 16); x.fill(); x.fillStyle = "#9fb4d6"; rr(x, 520, 1140, 480, 80, 16); x.fill(); floor(x, "#b9bcc2", tm, false); } },
    space: { n: "Космос / HUD", light: null, dark: 1, draw(x, tm, s) { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#1a1736"); g.addColorStop(.6, "#3a2f66"); g.addColorStop(1, "#211c40"); x.fillStyle = g; x.fillRect(0, 0, W, H);
      for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(220,220,255,${.2 + rnd(i, s) * .6})`; const r = rnd(i, s + 4) * 2.6 + .6; x.beginPath(); x.arc(rnd(i, s + 1) * W, rnd(i, s + 2) * H, r, 0, 7); x.fill(); }
      x.strokeStyle = "rgba(150,140,255,.25)"; x.lineWidth = 2; for (let i = 0; i < 16; i++) { x.beginPath(); x.moveTo(W / 2 + (i - 8) * 40, FLOOR - 40); x.lineTo(W / 2 + (i - 8) * 220, H); x.stroke(); } for (let k = 0; k < 6; k++) { const y = FLOOR - 40 + (H - FLOOR + 40) * Math.pow(k / 6, 1.7); x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); } } },
    cafe: { n: "Кав'ярня", light: [300, 300], draw(x, tm, s) { wall(x, "#9a7f6e", tm); win(x, 70, 330, 420, 520, tm, s, "city"); x.fillStyle = "#33312f"; rr(x, 580, 330, 420, 330, 10); x.fill(); x.fillStyle = "rgba(240,235,220,.7)"; for (let i = 0; i < 6; i++) x.fillRect(620, 380 + i * 45, 160 + rnd(i, s) * 150, 14);
      [300, 790].forEach((X) => { x.strokeStyle = "#2b2932"; x.lineWidth = 4; x.beginPath(); x.moveTo(X, 0); x.lineTo(X, 180); x.stroke(); x.fillStyle = "#e3c44a"; x.beginPath(); x.moveTo(X - 60, 230); x.lineTo(X + 60, 230); x.lineTo(X + 30, 180); x.lineTo(X - 30, 180); x.fill(); });
      x.fillStyle = "#6b4e3e"; x.fillRect(0, 1180, W, 330); x.fillStyle = "#8a6650"; x.fillRect(0, 1160, W, 40); PROPS.cup(x, .7, {}, 0); floor(x, "#5a463c", tm); } },
    park: { n: "Парк", light: [850, 250], draw(x, tm, s) { sky(x, 0, 0, W, FLOOR, tm, s, "none"); const T = TIME[tm] || TIME.day; x.fillStyle = shade("#9cbf86", T.amb); x.beginPath(); x.moveTo(0, 1100); x.quadraticCurveTo(400, 980, 1080, 1120); x.lineTo(W, FLOOR); x.lineTo(0, FLOOR); x.fill();
      [[120, 1150, 160], [380, 1080, 120], [930, 1130, 190]].forEach(([X, Y, r]) => { x.fillStyle = "#5b4a40"; x.fillRect(X - 12, Y - r * .4, 24, r * 1.4); x.fillStyle = shade("#6f9460", T.amb); x.beginPath(); x.arc(X, Y - r * .8, r, 0, 7); x.fill(); x.beginPath(); x.arc(X - r * .6, Y - r * .4, r * .7, 0, 7); x.fill(); });
      x.fillStyle = shade("#8bab67", T.amb); x.fillRect(0, FLOOR, W, H - FLOOR); x.fillStyle = "#8a6650"; rr(x, 560, 1360, 360, 30, 8); x.fill(); x.fillRect(580, 1390, 18, 110); x.fillRect(880, 1390, 18, 110); rr(x, 560, 1280, 360, 26, 8); x.fill(); } },
    stage: { n: "Сцена", light: [540, 0], dark: 1, draw(x, tm, s) { x.fillStyle = "#1c1a24"; x.fillRect(0, 0, W, H); x.fillStyle = "#6e2f3a"; for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(i < 3 ? 60 + i * 50 : W - 60 - (i - 3) * 50, 700, 60, 900, 0, 0, 7); x.fill(); } x.fillStyle = "#3a3340"; x.fillRect(0, FLOOR, W, H - FLOOR); } },
    blog: { n: "Студія блогера", light: [700, 300], draw(x, tm, s) { wall(x, "#6f6a86", tm); x.fillStyle = "#5c5873"; for (let i = 0; i < 6; i++) x.fillRect(80 + i * 160, 260, 120, 260);
      x.save(); x.shadowColor = "#ff5fa2"; x.shadowBlur = 30; x.strokeStyle = "#ff8cc0"; x.lineWidth = 10; x.lineCap = "round"; x.beginPath(); x.moveTo(160, 640); x.quadraticCurveTo(230, 560, 300, 640); x.quadraticCurveTo(370, 720, 440, 640); x.stroke(); x.restore();
      x.fillStyle = "#4b4760"; x.fillRect(560, 700, 420, 18); [0, 1, 2, 3, 4].forEach((i) => { x.fillStyle = ["#d8c25c", "#79a7a6", "#cf8b6d", "#8b79bb", "#e7e3d9"][i]; x.fillRect(580 + i * 70, 600 + (i % 2) * 20, 50, 100 - (i % 2) * 20); });
      x.strokeStyle = "#2b2932"; x.lineWidth = 8; x.beginPath(); x.moveTo(880, 1500); x.lineTo(930, 1000); x.lineTo(980, 1500); x.moveTo(930, 1000); x.lineTo(930, 1500); x.stroke(); x.save(); x.shadowColor = "#fff6dc"; x.shadowBlur = 40; x.strokeStyle = "#fff6dc"; x.lineWidth = 22; x.beginPath(); x.arc(930, 900, 95, 0, 7); x.stroke(); x.restore();
      x.strokeStyle = "#2b2932"; x.lineWidth = 7; x.beginPath(); x.moveTo(120, 1500); x.lineTo(170, 1120); x.lineTo(220, 1500); x.stroke(); x.fillStyle = "#26252c"; rr(x, 110, 1050, 130, 80, 12); x.fill(); x.fillStyle = "#3a3944"; x.beginPath(); x.arc(175, 1090, 26, 0, 7); x.fill(); x.fillStyle = "#ff453a"; x.beginPath(); x.arc(225, 1065, 8, 0, 7); x.fill();
      floor(x, "#4f4a5c", tm); } },
    kitchen: { n: "Кухня", light: [300, 300], draw(x, tm, s) { wall(x, "#a3a08f", tm); win(x, 110, 330, 360, 420, tm, s, "trees"); x.fillStyle = "#d8d3c6"; for (let i = 0; i < 4; i++) rr(x, 560 + (i % 2) * 230, 300 + Math.floor(i / 2) * 230, 210, 210, 10), x.fill();
      x.fillStyle = "#6f8f86"; x.fillRect(0, 1130, W, 370); x.fillStyle = "#e6e0d4"; x.fillRect(0, 1100, W, 40); x.fillStyle = "#58756d"; for (let i = 0; i < 5; i++) x.fillRect(30 + i * 210, 1180, 190, 300); x.fillStyle = "#c9c4b8"; for (let i = 0; i < 5; i++) x.fillRect(110 + i * 210, 1300, 40, 10);
      x.save(); x.translate(820, 1040); PROPS.cup(x, .55, {}, 0); x.restore(); x.fillStyle = "#b8574d"; rr(x, 300, 1020, 140, 80, 12); x.fill(); floor(x, "#8a7a68", tm, false); } },
    gym: { n: "Спортзал", light: [540, 250], draw(x, tm, s) { wall(x, "#6c7280", tm); x.fillStyle = "#e3c44a"; x.fillRect(0, 760, W, 26); x.fillStyle = "#55596a"; x.fillRect(0, 300, W, 120);
      for (let i = 0; i < 6; i++) { x.fillStyle = "rgba(255,255,255,.15)"; x.fillRect(60 + i * 170, 320, 120, 80); }
      x.fillStyle = "#2b2932"; x.fillRect(120, 1230, 420, 16); [[120, 70], [540, 70]].forEach(([X]) => { x.fillRect(X - 30, 1170, 26, 130); x.fillRect(X + 4, 1150, 26, 170); }); x.fillStyle = "#3a3944"; rr(x, 640, 1300, 360, 40, 10); x.fill(); x.fillRect(660, 1340, 20, 160); x.fillRect(960, 1340, 20, 160);
      floor(x, "#4a4d58", tm, false); x.fillStyle = "rgba(0,0,0,.18)"; for (let i = 0; i < 8; i++) x.fillRect(i * 140, FLOOR, 4, H - FLOOR); } },
    shop: { n: "Магазин", light: [540, 260], draw(x, tm, s) { wall(x, "#b9aea0", tm); for (let r = 0; r < 4; r++) { x.fillStyle = "#8a6650"; x.fillRect(60, 330 + r * 200, 960, 18); for (let i = 0; i < 12; i++) { x.fillStyle = ["#c65a50", "#e3c44a", "#79a7a6", "#8b79bb", "#8bab67", "#e19349"][(i + r * 3) % 6]; rr(x, 80 + i * 78, 250 + r * 200 - rnd(i, r) * 30, 56, 80 + rnd(i, r) * 30, 6); x.fill(); } }
      x.fillStyle = "#6b4e3e"; x.fillRect(560, 1180, 520, 320); x.fillStyle = "#8a6650"; x.fillRect(540, 1150, 560, 40); x.fillStyle = "#26252c"; rr(x, 820, 1060, 160, 100, 10); x.fill(); x.fillStyle = "#7fe0b0"; x.fillRect(840, 1080, 120, 50); floor(x, "#d4cbbd", tm, false); } },
    void: { n: "Порожній фон", light: null, draw(x, tm, s) { const T = TIME[tm] || TIME.day, g = x.createRadialGradient(W / 2, H * .45, 100, W / 2, H * .45, H * .8); g.addColorStop(0, shade("#a99fb2", T.amb + .1)); g.addColorStop(1, shade("#5d566a", T.amb)); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(0, FLOOR, W, H - FLOOR); } },
  };
  const BGC = new Map();
  function bgOf(place, tm, seed, blur) { const key = FMT + place + tm + seed + (blur ? "b" : ""); if (BGC.has(key)) return BGC.get(key);
    const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    if (blur) { x.filter = "blur(10px)"; x.drawImage(bgOf(place, tm, seed, false), -20, -20, W + 40, H + 40); x.filter = "none"; }
    else if (!KN()) bgC(x, PLACES[place] ? place : "room", tm, seed); else { (PLACES[place] || PLACES.room).draw(x, tm, seed); if (STYL[FMT]) restyleBg(x, STYL[FMT].bg, tm); }
    if (BGC.size > 40) BGC.delete(BGC.keys().next().value); BGC.set(key, c); return c; }

  // перефарбування фону під стиль (один раз на фон, потім із кешу)
  function restyleBg(x, mode, tm) { let d; try { d = x.getImageData(0, 0, W, H); } catch (e) { return; } const a = d.data, night = tm === "night";
    for (let i = 0; i < a.length; i += 4) { const r = a[i], g = a[i + 1], b = a[i + 2], L = .3 * r + .59 * g + .11 * b;
      if (mode === "bright") { const k = .78, m = night ? 20 : 58; a[i] = r * k + m + (L - r) * .12; a[i + 1] = g * k + m + (L - g) * .12; a[i + 2] = b * k + m + (L - b) * .12; }
      else if (mode === "dark") { const v = 9 + L * .2; a[i] = v; a[i + 1] = v; a[i + 2] = v * 1.05; }
      else if (mode === "navy") { a[i] = 8 + L * .14; a[i + 1] = 11 + L * .17; a[i + 2] = 24 + L * .27; }
      else if (mode === "grey") { const v = (night ? 70 : 150) + L * (night ? .22 : .38); a[i] = v; a[i + 1] = v + 2; a[i + 2] = v + 6; }
      else if (mode === "pastel") { const k = night ? .7 : .62, m = night ? 34 : 96; a[i] = r * k + m + (r - L) * .25; a[i + 1] = g * k + m + (g - L) * .25; a[i + 2] = b * k + m + 8 + (b - L) * .25; }
      else if (mode === "clay") { a[i] = lerp(r, L, .12) * .74 + 72; a[i + 1] = lerp(g, L, .12) * .72 + 64; a[i + 2] = lerp(b, L, .12) * .7 + 62; }
      else if (mode === "cine") { const u = L / 255, s2 = u * u * (3 - 2 * u), tr = lerp(16, 255, s2), tg = lerp(58, 176, s2), tb = lerp(70, 112, s2); a[i] = lerp(r, tr, .45) * 1.04 - 6; a[i + 1] = lerp(g, tg, .45) * 1.02 - 6; a[i + 2] = lerp(b, tb, .45) - 4; }
      else if (GMAP[mode]) { const q = gmap(GMAP[mode], night ? L * .7 : L); a[i] = q[0]; a[i + 1] = q[1]; a[i + 2] = q[2]; if (mode === "chalk" || mode === "sepia") { const nz = (rnd(i, 3) - .5) * (mode === "chalk" ? 10 : 14); a[i] += nz; a[i + 1] += nz; a[i + 2] += nz; } } }
    if (mode === "cut") { // паперовий колаж: 6 шарів-кольорів + тінь від вищого шару
      const n = W * H, band = new Uint8Array(n), PALC = [[52, 58, 74], [86, 104, 112], [196, 104, 82], [226, 168, 96], [140, 168, 132], [236, 222, 196]];
      for (let i = 0, j = 0; j < n; i += 4, j++) band[j] = Math.min(5, Math.floor((.3 * a[i] + .59 * a[i + 1] + .11 * a[i + 2]) / 43));
      for (let j = 0; j < n; j++) { const i = j * 4, bnd = band[j], hue = [a[i], a[i + 1], a[i + 2]], L = (bnd + .5) / 6, base = hue.map((v, q) => lerp(v * .5 + 120 * L + 26, PALC[bnd][q], .55)); const px = j % W, py = (j / W) | 0, k2 = (py >= 16 && px >= 12) ? j - 16 * W - 12 : j, k3 = (py >= 6 && px >= 4) ? j - 6 * W - 4 : j, sh = band[k3] > bnd ? .62 : band[k2] > bnd ? .8 : 1;
        a[i] = base[0] * sh; a[i + 1] = base[1] * sh; a[i + 2] = base[2] * sh * .98; } }
    x.putImageData(d, 0, 0);
    if (mode === "clay" || mode === "aurora") { const c2 = document.createElement("canvas"); c2.width = W; c2.height = H; c2.getContext("2d").drawImage(x.canvas, 0, 0); x.save(); x.filter = `blur(${mode === "clay" ? 3 : 16}px)`; x.drawImage(c2, 0, 0); x.filter = "none"; x.restore();
      if (mode === "aurora") { x.save(); x.globalCompositeOperation = "screen"; [[.2, .2, "rgba(255,120,200,.35)"], [.85, .35, "rgba(120,170,255,.35)"], [.5, .75, "rgba(255,190,140,.3)"]].forEach(([u, v, c3]) => { const g = x.createRadialGradient(u * W, v * H, 0, u * W, v * H, 620); g.addColorStop(0, c3); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H); }); x.restore(); }
      else { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(255,236,214,.22)"); g.addColorStop(1, "rgba(120,80,110,.12)"); x.fillStyle = g; x.fillRect(0, 0, W, H); } }
    if (mode === "noir") { const g = x.createRadialGradient(W * .7, H * .25, 20, W * .7, H * .25, 900); g.addColorStop(0, "rgba(255,200,110,.22)"); g.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    if (mode === "blue") { x.save(); x.strokeStyle = "rgba(220,235,255,.12)"; x.lineWidth = 2; for (let gx = 0; gx <= W; gx += 60) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); } for (let gy = 0; gy <= H; gy += 60) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); } x.strokeStyle = "rgba(220,235,255,.22)"; x.lineWidth = 3; for (let gx = 0; gx <= W; gx += 300) { x.beginPath(); x.moveTo(gx, 0); x.lineTo(gx, H); x.stroke(); } for (let gy = 0; gy <= H; gy += 300) { x.beginPath(); x.moveTo(0, gy); x.lineTo(W, gy); x.stroke(); } x.restore(); }
    if (mode === "golden") { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "rgba(255,170,90,0)"); g.addColorStop(.55, "rgba(255,150,80,.16)"); g.addColorStop(1, "rgba(80,20,40,.25)"); x.fillStyle = g; x.fillRect(0, 0, W, H); const s2 = x.createRadialGradient(W * .72, H * .3, 10, W * .72, H * .3, 520); s2.addColorStop(0, "rgba(255,230,170,.55)"); s2.addColorStop(1, "rgba(255,200,120,0)"); x.fillStyle = s2; x.fillRect(0, 0, W, H); } }
  // градієнтні карти: яскравість → колір (тон стилю)
  const GMAP = { golden: [[0, [34, 14, 40]], [90, [120, 38, 64]], [170, [222, 110, 78]], [255, [255, 214, 150]]], chalk: [[0, [26, 46, 38]], [150, [44, 70, 58]], [215, [96, 128, 112]], [255, [196, 214, 200]]],
    blue: [[0, [14, 44, 92]], [140, [30, 74, 140]], [220, [70, 120, 190]], [255, [150, 190, 235]]], noir: [[0, [5, 5, 6]], [120, [18, 16, 14]], [210, [52, 42, 30]], [255, [104, 82, 52]]], aurora: [[0, [34, 26, 74]], [90, [88, 60, 150]], [170, [200, 120, 190]], [230, [255, 186, 170]], [255, [255, 228, 205]]],
    sepia: [[0, [38, 26, 18]], [110, [112, 80, 52]], [200, [196, 160, 112]], [255, [246, 226, 190]]], gray: [[0, [20, 20, 22]], [255, [236, 236, 238]]] };
  function gmap(st, L) { for (let k = 1; k < st.length; k++) if (L <= st[k][0]) { const [l0, c0] = st[k - 1], [l1, c1] = st[k], u = (L - l0) / Math.max(1, l1 - l0); return [c0[0] + (c1[0] - c0[0]) * u, c0[1] + (c1[1] - c0[1]) * u, c0[2] + (c1[2] - c0[2]) * u]; } return st[st.length - 1][1]; }
  // фігура-силует: малюємо звичайну фігуру окремо, заливаємо одним кольором, кладемо зі світінням, зверху — очі за емоцією
  const SILC = {};
  // тварини в стилі ролика: силует/об'єм/скло/золото — як люди; у мальованих стилях — контур і палітра стилю; у монохромі — сірі
  function petDraw(x, X, Y, c, t) { const st = STYL[FMT], w = { _pet: c, who: "pet", f: c.f, face: c.face === "happy" ? "happy" : c.face === "sad" ? "sad" : "calm", seed: c.seed };
    if (st?.fill || st?.fig) return silFig(x, X, Y, null, w, t);
    if (st?.mono) return silFig(x, X, Y, null, w, t, { desat: 1 });
    if (!KN()) { const B = BREED[c.breed] || BREED.labrador, P2 = (q) => q && q[0] === "#" ? (FMT === "toon50" ? mix(q, "#f1e4c6", .12) : pf(q)) : q; return silFig(x, X, Y, null, { ...w, _pet: { ...c, _B: { ...B, c: P2(B.c), d: P2(B.d), mask: P2(B.mask), eye: P2(B.eye) } } }, t, { outline: OLC() }); }
    return animal(x, X, Y, c, t); }
  function silFig(x, X, Y, P, c, t, st0) { const st = st0 || STYL[FMT], cv = x.canvas, off = SILC.c && SILC.c.width === cv.width && SILC.c.height === cv.height ? SILC.c : (SILC.c = Object.assign(document.createElement("canvas"), { width: cv.width, height: cv.height })), o = off.getContext("2d");
    const TM = x.getTransform(), hh = c._pet ? (BREED[c._pet.breed] || BREED.labrador).S * 1.45 * (c._pet.scale || 1) : (c.h || 560) * ((WHO[c.who] || WHO.man).s || 1), mg = 70 * cv.width / W;
    const x0 = Math.max(0, Math.floor(TM.a * (X - hh * .85) + TM.e - mg)), y0 = Math.max(0, Math.floor(TM.d * (Y - hh * 1.2) + TM.f - mg)), x1 = Math.min(cv.width, Math.ceil(TM.a * (X + hh * .85) + TM.e + mg)), y1 = Math.min(cv.height, Math.ceil(TM.d * (Y + hh * .3) + TM.f + mg)), bw = x1 - x0, bh = y1 - y0;
    if (bw <= 0 || bh <= 0) return null;
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.shadowBlur = 0; o.globalCompositeOperation = "source-over"; o.clearRect(x0, y0, bw, bh); o.setTransform(TM);
    const hd = c._pet ? animal(o, X, Y, { ...c._pet, _gs: x }, t) : figure(o, X, Y, P, { ...c, _sil: 1, _gs: c.who === "shadow" ? undefined : x }, t), sk = cv.width / W;
    if (st.desat || st.outline) { o.setTransform(1, 0, 0, 1, 0, 0); x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
      if (st.desat) { try { const d = o.getImageData(x0, y0, bw, bh), a = d.data; for (let i = 0; i < a.length; i += 4) { const v = (.3 * a[i] + .59 * a[i + 1] + .11 * a[i + 2]) * .85 + 18; a[i] = v; a[i + 1] = v; a[i + 2] = v * 1.02; } o.putImageData(d, x0, y0); } catch (e) {} }
      else { const c2 = SILC.c2 && SILC.c2.width === cv.width && SILC.c2.height === cv.height ? SILC.c2 : (SILC.c2 = Object.assign(document.createElement("canvas"), { width: cv.width, height: cv.height })), o2 = c2.getContext("2d"); o2.setTransform(1, 0, 0, 1, 0, 0); o2.clearRect(x0, y0, bw, bh); o2.drawImage(off, x0, y0, bw, bh, x0, y0, bw, bh);
        o.globalCompositeOperation = "source-in"; o.fillStyle = st.outline; o.fillRect(x0, y0, bw, bh); o.globalCompositeOperation = "source-over"; const k = (FMT === "paper" ? 3.5 : 4.5) * sk;
        for (let q = 0; q < 8; q++) { const an = q / 8 * 6.283; x.drawImage(off, x0, y0, bw, bh, x0 + Math.cos(an) * k, y0 + Math.sin(an) * k, bw, bh); } x.drawImage(c2, x0, y0, bw, bh, x0, y0, bw, bh); x.restore(); return hd; }
      x.drawImage(off, x0, y0, bw, bh, x0, y0, bw, bh); x.restore(); return hd; }
    if (st.fig) { // об'ємні стилі: фігура в кольорі + світло/тінь зверху, м'яка тінь на «підлогу»
      o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = "source-atop";
      if (st.fig === "clay") { const vg = o.createLinearGradient(TM.a * (X - hh * .4) + TM.e, y0, TM.a * (X + hh * .4) + TM.e, y1); vg.addColorStop(0, "rgba(255,248,236,.30)"); vg.addColorStop(.45, "rgba(255,248,236,0)"); vg.addColorStop(1, "rgba(30,16,46,.42)"); o.fillStyle = vg; o.fillRect(x0, y0, bw, bh);
        if (hd) { const hx = TM.a * hd.head[0] + TM.e, hy = TM.d * hd.head[1] + TM.f, hr = TM.a * hd.r; const sg = o.createRadialGradient(hx - hr * .38, hy - hr * .42, 0, hx - hr * .38, hy - hr * .42, hr * .75); sg.addColorStop(0, "rgba(255,255,255,.55)"); sg.addColorStop(.35, "rgba(255,255,255,.14)"); sg.addColorStop(1, "rgba(255,255,255,0)"); o.fillStyle = sg; o.fillRect(hx - hr * 1.2, hy - hr * 1.2, hr * 2.4, hr * 2.4);
          const ag = o.createRadialGradient(hx + hr * .3, hy + hr * .35, hr * .4, hx, hy, hr * 1.05); ag.addColorStop(0, "rgba(0,0,0,0)"); ag.addColorStop(1, "rgba(20,10,40,.35)"); o.fillStyle = ag; o.beginPath(); o.arc(hx, hy, hr * 1.05, 0, 7); o.fill(); } }
      else { o.globalAlpha = .1; o.drawImage(noiseTile(2), x0, y0, bw, bh); o.globalAlpha = 1; }
      o.globalCompositeOperation = "source-over"; x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
      if (st.fig === "clay") { x.shadowColor = "rgba(50,30,60,.32)"; x.shadowBlur = 30 * sk; x.shadowOffsetX = 12 * sk; x.shadowOffsetY = 18 * sk; } else { x.shadowColor = "rgba(30,20,10,.42)"; x.shadowBlur = 5 * sk; x.shadowOffsetX = 8 * sk; x.shadowOffsetY = 10 * sk; }
      x.drawImage(off, x0, y0, bw, bh, x0, y0, bw, bh); x.restore(); return hd; }
    const grad = (q) => { if (q === "gold") { const g = o.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, "#fff1b8"); g.addColorStop(.35, "#e2b04a"); g.addColorStop(.6, "#a8741e"); g.addColorStop(.8, "#f5d27a"); g.addColorStop(1, "#8a5a14"); return g; } if (q === "glass") { const g = o.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, "rgba(255,255,255,.62)"); g.addColorStop(.5, "rgba(255,255,255,.34)"); g.addColorStop(1, "rgba(255,255,255,.2)"); return g; } return q; };
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = "source-in"; o.fillStyle = grad(st.fill); o.fillRect(x0, y0, bw, bh); o.globalCompositeOperation = "source-over";
    if (st.line) { // контурний стиль: спершу товстий силует кольору лінії зі зсувами, потім заливка — чіткий «намальований» контур
      o.globalCompositeOperation = "source-in"; o.fillStyle = grad(st.line); o.fillRect(x0, y0, bw, bh); o.globalCompositeOperation = "source-over"; x.save(); x.setTransform(1, 0, 0, 1, 0, 0); const k = (st.line === "gold" ? 4 : 5) * cv.width / W; if (st.line === "gold") { x.shadowColor = "rgba(255,190,80,.55)"; x.shadowBlur = 14 * cv.width / W; }
      for (let q = 0; q < 8; q++) { const an = q / 8 * 6.283, jx = Math.cos(an) * k + (FMT === "chalk" ? (rnd(q + Math.floor(t * 8), 4) - .5) * 1.5 : 0), jy = Math.sin(an) * k; x.drawImage(off, x0, y0, bw, bh, x0 + jx, y0 + jy, bw, bh); } x.restore();
      o.globalCompositeOperation = "source-in"; o.fillStyle = grad(st.fill); o.fillRect(x0, y0, bw, bh); o.globalCompositeOperation = "source-over"; }
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); const gc = st.rim ? st.rim : st.neon ? (c.who === "hero" && HOOD[c.col] ? mix(HOOD[c.col], "#ffffff", .25) : NEONC[c.who] || HOOD[c.col] || "#4dd0e1") : st.edge;
    if (gc) { x.shadowColor = gc; x.shadowBlur = (st.neon ? 22 + 6 * Math.sin(t * 2.4 + (c.seed || 0)) : st.rim ? 16 : 6) * cv.width / W; x.drawImage(off, x0, y0, bw, bh, x0, y0, bw, bh); if (st.neon) { x.shadowBlur = 8 * cv.width / W; x.drawImage(off, x0, y0, bw, bh, x0, y0, bw, bh); } x.shadowBlur = 0; x.shadowColor = "transparent"; }
    x.drawImage(off, x0, y0, bw, bh, x0, y0, bw, bh); x.restore();
    if (hd) silEyes(x, hd, c.face || "calm", c.f || 1, st.eye, t, (c.seed || 0) + X);
    return hd; }
  // очі силуету: форма передає емоцію (спокій, радість, сум, злість, шок, хитрість, сон), моргання
  function silEyes(x, hd, face, f, col, t, sd) { const [hx, hy] = hd.head, r = hd.r, blink = ((t + rnd(Math.floor(sd), 7) * 4) % 4.2) < .12, ex = hx + f * r * .16, ey = hy - r * .04, dx = r * .3;
    x.save(); x.fillStyle = col; x.strokeStyle = col; x.lineWidth = r * .09; x.lineCap = "round";
    [-1, 1].forEach((k) => { const cx = ex + k * dx, ew = r * .12, eh = r * .19;
      if (blink || face === "sleep") { x.beginPath(); x.moveTo(cx - ew, ey); x.lineTo(cx + ew, ey); x.stroke(); return; }
      if (face === "happy") { x.beginPath(); x.arc(cx, ey + eh * .3, ew * 1.1, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); return; }
      if (face === "shock") { x.beginPath(); x.arc(cx, ey, ew * 1.5, 0, 7); x.fill(); x.fillStyle = x.strokeStyle === col ? (col === "#ffffff" ? "#111" : "#eee") : "#111"; x.beginPath(); x.arc(cx, ey, ew * .45, 0, 7); x.fill(); x.fillStyle = col; return; }
      if (face === "smirk" && k === -1 * f) { x.beginPath(); x.moveTo(cx - ew, ey); x.quadraticCurveTo(cx, ey - eh * .5, cx + ew, ey); x.stroke(); return; }
      x.beginPath(); x.ellipse(cx, ey, ew, eh, 0, 0, 7); x.fill();
      if (face === "sad" || face === "worried") { x.save(); x.fillStyle = STYL[FMT]?.fill || "#111"; x.beginPath(); x.moveTo(cx - ew * 1.6, ey - eh * 1.3); x.lineTo(cx + ew * 1.6, ey - eh * 1.3); x.lineTo(cx + ew * 1.6 * -k * -1, ey - eh * (face === "sad" ? .1 : .35)); x.lineTo(cx - ew * 1.6 * k, ey - eh * (face === "sad" ? -.15 : .05)); x.closePath(); x.fill(); x.restore(); }
      if (face === "angry") { x.beginPath(); x.moveTo(cx - k * ew * 1.4, ey - eh * 1.5); x.lineTo(cx + k * ew * 1.2, ey - eh * .9); x.stroke(); } });
    x.restore(); }

  /* ---------- HUD, «великі написи», субтитри ---------- */
  function glass(x, X, Y, w, h, title, ap) { x.save(); x.globalAlpha *= ap; x.fillStyle = "rgba(28,26,58,.78)"; rr(x, X, Y, w, h, 18); x.fill(); x.strokeStyle = "rgba(190,200,255,.55)"; x.lineWidth = 3; rr(x, X, Y, w, h, 18); x.stroke();
    x.fillStyle = "rgba(190,200,255,.18)"; rr(x, X, Y, w, 56, [18, 18, 0, 0]); x.fill(); ["#ff6b6b", "#ffd166", "#6ee7a8"].forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc(X + 32 + i * 28, Y + 28, 8, 0, 7); x.fill(); });
    if (title) { const n = String(title).toLowerCase().slice(0, 28); txt(x, n, X + w / 2, Y + 28, fitTxt(x, n, w - 200, 26, 600), "rgba(220,225,255,.8)", 600); } x.restore(); }
  function brain(x, cx, cy, R, t, ap) { x.save(); x.globalAlpha *= ap; x.translate(cx, cy);
    const lobe = () => { x.beginPath(); x.moveTo(-R * 1.25, R * .1); x.bezierCurveTo(-R * 1.4, -R * .6, -R * .8, -R * 1.05, -R * .2, -R * .95); x.bezierCurveTo(R * .2, -R * 1.15, R * 1.05, -R * 1.0, R * 1.25, -R * .35);
      x.bezierCurveTo(R * 1.45, R * .1, R * 1.2, R * .55, R * .85, R * .6); x.bezierCurveTo(R * .75, R * .95, R * .35, R * 1.0, R * .2, R * .7); x.bezierCurveTo(-R * .2, R * .85, -R * .9, R * .8, -R * 1.25, R * .1); x.closePath(); };
    x.shadowColor = "rgba(150,200,255,.9)"; x.shadowBlur = 30; x.strokeStyle = "rgba(220,235,255,.9)"; x.lineWidth = 6; lobe(); x.stroke(); x.shadowBlur = 0;
    x.beginPath(); x.moveTo(R * .2, R * .7); x.quadraticCurveTo(R * .1, R * 1.1, R * .25, R * 1.25); x.stroke(); x.beginPath(); x.moveTo(-R * .05, -R * .97); x.bezierCurveTo(-R * .2, -R * .5, R * .15, -R * .2, -R * .1, R * .3); x.stroke();
    x.strokeStyle = "rgba(200,220,255,.3)"; x.lineWidth = 3; for (let i = 0; i < 7; i++) { const a = rnd(i, 40) * 6.28, X0 = Math.cos(a) * R * .6, Y0 = Math.sin(a) * R * .45; x.beginPath(); x.moveTo(X0, Y0); x.bezierCurveTo(X0 + R * .25, Y0 - R * .2, X0 + R * .1, Y0 + R * .25, X0 + R * .35, Y0 + R * .1); x.stroke(); }
    const N = 46, pts = []; for (let i = 0; i < N; i++) { const a = rnd(i, 7) * Math.PI * 2, d = Math.sqrt(rnd(i, 8)) * .85; pts.push([Math.cos(a) * d * R * 1.2, Math.sin(a) * d * R * .82]); }
    x.lineWidth = 1.6; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], d = Math.hypot(dx, dy); if (d < R * .32) { x.strokeStyle = `rgba(200,225,255,${.35 * (1 - d / (R * .32))})`; x.beginPath(); x.moveTo(pts[i][0], pts[i][1]); x.lineTo(pts[j][0], pts[j][1]); x.stroke(); } }
    pts.forEach((p, i) => { const tw = .5 + .5 * Math.sin(t * 3 + i * 1.7); x.fillStyle = `rgba(255,255,255,${.5 + tw * .5})`; x.beginPath(); x.arc(p[0], p[1], 4 + tw * 4, 0, 7); x.fill(); }); x.restore(); }
  function hud(x, h, lt, t) {
    const ap = clamp(lt / .35) * (h.out ? clamp((h.out - lt) / .3) : 1), k = h.k; if (ap <= 0) return; const sc = .92 + .08 * eout(lt / .4);
    x.save(); x.translate(SCX - W / 2, 0); x.translate(W / 2, h.y || 700); x.scale(sc, sc); x.translate(-W / 2, -(h.y || 700));
    const Y = h.y || 700;
    if (k === "panel") { const w = 780, hh = 520, X = (W - w) / 2, T = Y - hh / 2; glass(x, X, T, w, hh, h.t2 || "update", ap); x.globalAlpha = ap;
      const ttl = String(h.t || "").toUpperCase().slice(0, 30); txt(x, ttl, X + 50, T + 110, fitTxt(x, ttl, w - 100, 46), "#e9ecff", 800, "left");
      for (let i = 0; i < 4; i++) { x.fillStyle = "rgba(200,205,255,.22)"; rr(x, X + 50, T + 160 + i * 34, (w - 100) * (.95 - rnd(i, 2) * .3), 14, 7); x.fill(); }
      const pv = clamp(+String(h.v ?? 100).replace(/[^\d.]/g, "") / 100 || 1), pr = pv * eout(lt / 1.6); x.fillStyle = "rgba(200,205,255,.15)"; rr(x, X + 50, T + 320, w - 100, 30, 15); x.fill(); x.fillStyle = "#7fe0b0"; rr(x, X + 50, T + 320, (w - 100) * pr, 30, 15); x.fill(); txt(x, Math.round(pr * 100) + "%", X + w - 50, T + 380, 34, "#e9ecff", 700, "right");
      const b = h.items?.length ? h.items.slice(0, 2) : ["ТАК", "НІ"]; b.forEach((s, i) => { const bx = X + 50 + i * ((w - 100) / 2 + 10), bw = (w - 100) / 2 - 10; x.fillStyle = i ? "rgba(0,0,0,0)" : "rgba(127,224,176,.85)"; rr(x, bx, T + 420, bw, 70, 12); x.fill(); x.strokeStyle = "rgba(220,225,255,.6)"; x.lineWidth = 3; if (i) { rr(x, bx, T + 420, bw, 70, 12); x.stroke(); } const n = String(s).toUpperCase().slice(0, 14); txt(x, n, bx + bw / 2, T + 455, fitTxt(x, n, bw - 30, 32), i ? "#e9ecff" : "#1c2a24"); }); }
    else if (k === "chart" || k === "bars") { const w = 820, hh = 560, X = (W - w) / 2, T = Y - hh / 2; glass(x, X, T, w, hh, h.t2 || "stats", ap); x.globalAlpha = ap; const up = (+h.v || 1) >= 0, pr = eout(lt / 1.6), n = 8;
      if (h.t) { const ttl = String(h.t).toUpperCase().slice(0, 28); txt(x, ttl, X + w / 2, T + 105, fitTxt(x, ttl, w - 80, 44), "#e9ecff"); }
      if (k === "bars") for (let i = 0; i < n; i++) { const v = (up ? (i + 1) / n : 1 - i / n) * .8 + rnd(i, 5) * .15, bh = (hh - 220) * v * clamp(pr * 1.4 - i * .06); x.fillStyle = i === n - 1 ? "#ffd166" : "rgba(150,170,255,.8)"; rr(x, X + 60 + i * (w - 120) / n, T + hh - 50 - bh, (w - 120) / n - 18, bh, 6); x.fill(); }
      else { x.strokeStyle = up ? "#7fe0b0" : "#ff7b7b"; x.lineWidth = 9; x.lineJoin = "round"; x.lineCap = "round"; x.shadowColor = x.strokeStyle; x.shadowBlur = 16; x.beginPath(); const m = Math.max(1, Math.floor(n * 3 * pr)); let lx = 0, ly = 0; for (let i = 0; i <= m; i++) { const u = i / (n * 3), v = (up ? Math.pow(u, 1.6) : 1 - Math.pow(u, .7)) * .82 + (rnd(i, 9) - .5) * .08, X2 = X + 60 + u * (w - 120), Y2 = T + hh - 60 - v * (hh - 220); i ? x.lineTo(X2, Y2) : x.moveTo(X2, Y2); lx = X2; ly = Y2; } x.stroke(); x.shadowBlur = 0; x.fillStyle = "#fff"; x.beginPath(); x.arc(lx, ly, 12, 0, 7); x.fill(); } }
    else if (k === "counter") { const v = String(h.v ?? "0"), num = parseFloat(v.replace(",", ".").replace(/[^\d.\-]/g, "")), pr = eout(lt / 1.2); x.globalAlpha = ap;
      let shown = v; if (isFinite(num)) { const dec = (v.split(/[.,]/)[1] || "").replace(/\D/g, "").length, cur = num * pr; shown = v.replace(/-?[\d][\d\s.,]*/, cur.toLocaleString("uk-UA", { minimumFractionDigits: dec, maximumFractionDigits: dec })); }
      if (h.t) txt(x, String(h.t).toUpperCase().slice(0, 30), W / 2, Y - 120, 38, "rgba(230,232,255,.85)", 700); x.shadowColor = "rgba(0,0,0,.4)"; x.shadowBlur = 20; txt(x, shown, W / 2, Y, fitTxt(x, shown, W - 160, 190), "#fff", 900); x.shadowBlur = 0; }
    else if (k === "day") { // «ДЕНЬ 47»: число перебігає з v0 до v; якщо падає (зрив) — червоний спалах і тряска
      const to = Math.round(+String(h.v ?? 1).replace(/[^\d-]/g, "") || 0), from = h.v0 != null ? Math.round(+h.v0 || 0) : to, pr = eio(clamp(lt / Math.max(.3, Math.min(1.6, Math.abs(to - from) * .05 + .3)))), cur = Math.round(from + (to - from) * pr), drop = to < from && pr >= 1;
      x.globalAlpha = ap; const lab = String(h.t || "ДЕНЬ").toUpperCase().slice(0, 26), q = `${lab} ${cur}`, sh = drop ? Math.sin(lt * 60) * 10 * clamp(1 - (lt - 1) * 2) : 0; x.translate(sh, 0);
      x.font = `900 120px "${FONT}", system-ui, sans-serif`; const tw = x.measureText(q).width; x.fillStyle = drop ? "rgba(140,20,20,.75)" : "rgba(12,12,16,.55)"; rr(x, W / 2 - tw / 2 - 50, Y - 95, tw + 100, 190, 30); x.fill();
      txt(x, q, W / 2, Y, fitTxt(x, q, W - 160, 120), drop ? "#ff4d4d" : "#ffffff", 900); if (h.items?.[0]) txt(x, String(h.items[0]).toUpperCase().slice(0, 28), W / 2, Y + 150, 40, "rgba(235,238,255,.8)", 700); }
    else if (k === "calendar") { // сітка 7×5, дні перекреслюються по черзі (дисципліна, «30 днів поспіль»)
      x.globalAlpha = ap; const n = clamp(Math.round(+String(h.v ?? 30).replace(/[^\d]/g, "") || 30), 1, 35), cw = 118, ch = 104, X0 = W / 2 - cw * 3.5, T0 = Y - ch * 2.5 + 30;
      if (h.t) { const ttl = String(h.t).toUpperCase().slice(0, 26); txt(x, ttl, W / 2, T0 - 80, fitTxt(x, ttl, 760, 50), "#ffffff", 900); }
      x.fillStyle = "rgba(12,12,18,.55)"; rr(x, X0 - 24, T0 - 24, cw * 7 + 48, ch * 5 + 48, 26); x.fill(); x.strokeStyle = "rgba(235,238,255,.55)"; x.lineWidth = 3;
      for (let i = 0; i < 35; i++) { const cx = X0 + (i % 7) * cw, cy = T0 + Math.floor(i / 7) * ch; x.strokeRect(cx + 6, cy + 6, cw - 12, ch - 12); txt(x, String(i + 1), cx + 26, cy + 28, 22, "rgba(235,238,255,.5)", 700); }
      const sp = Math.min(.09, 1.8 / n), chk = h.mark === "check", fail = h.v0 != null ? Math.round(+h.v0) : 0; x.strokeStyle = chk ? "#3ee07f" : "#ff3b3b"; x.lineWidth = 9; x.lineCap = "round"; x.lineJoin = "round";
      for (let i = 0; i < n; i++) { const p0 = clamp((lt - .25 - i * sp) / .12); if (p0 <= 0) break; const cx = X0 + (i % 7) * cw + cw / 2, cy = T0 + Math.floor(i / 7) * ch + ch / 2, r = 30, p1 = clamp(p0 * 2), p2 = clamp(p0 * 2 - 1);
        if (fail && i + 1 === fail) { x.save(); x.fillStyle = "#ff2a85"; x.globalAlpha = p0 * .9; x.beginPath(); for (let k = 0; k <= 10; k++) { const a1 = k / 10 * 6.283, rr2 = 38 * (.75 + rnd(k, 77) * .4); k ? x.lineTo(cx + Math.cos(a1) * rr2, cy + Math.sin(a1) * rr2) : x.moveTo(cx + Math.cos(a1) * rr2, cy + Math.sin(a1) * rr2); } x.fill(); x.restore(); continue; }
        if (chk) { x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx - r + 22 * p1, cy + 22 * p1); if (p2 > 0) x.lineTo(cx - r + 22 + 44 * p2, cy + 22 - 52 * p2); x.stroke(); continue; }
        x.beginPath(); x.moveTo(cx - r, cy - r); x.lineTo(cx - r + 2 * r * p1, cy - r + 2 * r * p1); x.stroke(); if (p2 > 0) { x.beginPath(); x.moveTo(cx + r, cy - r); x.lineTo(cx + r - 2 * r * p2, cy - r + 2 * r * p2); x.stroke(); } }
      if (h.items?.[0] && lt > .3 + n * sp) txt(x, String(h.items[0]).toUpperCase().slice(0, 24), W / 2, T0 + ch * 5 + 80, 46, "#ffd166", 900); }
    else if (k === "jar") { // банка, що наповнюється монетами; сума перебігає вгору (заробіток, накопичення)
      x.globalAlpha = ap; const v = String(h.v ?? "1 000 $"), num = parseFloat(v.replace(/\s/g, "").replace(",", ".").replace(/[^\d.\-]/g, "")), pr = eout(clamp(lt / 1.8)), fill = (h.v0 != null ? clamp(+h.v0) : .85) * pr;
      const jw = 380, jh = 470, X = W / 2 - jw / 2, T = Y - jh / 2 + 40, bot = T + jh;
      if (h.t) { const ttl = String(h.t).toUpperCase().slice(0, 26); txt(x, ttl, W / 2, T - 160, fitTxt(x, ttl, 760, 50), "#ffffff", 900); }
      x.save(); x.beginPath(); rr(x, X, T, jw, jh, 60); x.clip(); const lvl = bot - (jh - 30) * fill;
      for (let row = 0; bot - row * 34 > lvl - 10; row++) for (let i = 0; i < 6; i++) { const cx = X + 40 + i * 62 + (row % 2) * 30, cy = bot - 24 - row * 34; x.fillStyle = (row + i) % 3 ? "#e9c46a" : "#f4d58d"; x.beginPath(); x.ellipse(cx, cy, 30, 13, 0, 0, 7); x.fill(); x.strokeStyle = "#b8891f"; x.lineWidth = 3; x.stroke(); }
      x.restore(); for (let i = 0; i < 4; i++) { const ph = ((lt * 1.6 + i * .25) % 1), cy = T - 120 + ph * (lvl - T + 120); if (lt > 1.8 && ph > .9) continue; x.fillStyle = "#f4d58d"; x.beginPath(); x.ellipse(W / 2 - 60 + i * 40, cy, 26, 11, Math.sin(i + lt * 4) * .6, 0, 7); x.fill(); }
      x.strokeStyle = "rgba(235,238,255,.85)"; x.lineWidth = 6; rr(x, X, T, jw, jh, 60); x.stroke(); x.fillStyle = "rgba(235,238,255,.85)"; rr(x, X + 40, T - 34, jw - 80, 34, 10); x.fill();
      let shown = v; if (isFinite(num)) { const cur = Math.round(num * pr); shown = v.replace(/-?\d[\d\s.,]*/, cur.toLocaleString("uk-UA") + " "); }
      x.shadowColor = "rgba(0,0,0,.5)"; x.shadowBlur = 16; txt(x, shown.trim(), W / 2, bot + 110, fitTxt(x, shown.trim(), W - 200, 110), "#7fe0b0", 900); x.shadowBlur = 0; }
    else if (k === "stamp") { // штамп: «НЕМОЖЛИВО», «F», «НЕ ПІДТВЕРДЖЕНО» — влітає з удару під кутом
      const q = String(h.t || h.v || "!").toUpperCase().slice(0, 18), sl = clamp(lt / .14), sc2 = 2.6 - 1.6 * eout(sl), jit = lt > .14 && lt < .4 ? (rnd(Math.floor(lt * 40), 3) - .5) * 14 : 0; x.globalAlpha = ap * sl;
      x.translate(W / 2 + jit, Y); x.rotate(-.21); x.scale(sc2, sc2); x.font = `900 140px "${FONT}", system-ui, sans-serif`; const tw = Math.min(W * .78, x.measureText(q).width), k2 = Math.min(1, W * .74 / x.measureText(q).width); x.scale(k2, k2);
      const bw = x.measureText(q).width + 90, bh = 210; x.strokeStyle = h.items?.[0] === "green" ? "#2fd06f" : "#e3262f"; x.lineWidth = 14; rr(x, -bw / 2, -bh / 2, bw, bh, 24); x.stroke(); x.lineWidth = 5; rr(x, -bw / 2 + 18, -bh / 2 + 18, bw - 36, bh - 36, 16); x.stroke();
      x.fillStyle = x.strokeStyle; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(q, 0, 8); }
    else if (k === "people") { // сітка людей: v — скільки всього (до 100), v0 — скільки виділено червоним («1 з 20», «3 з 10»)
      const n = clamp(Math.round(+h.v || 20), 2, 100), hi = clamp(Math.round(+(h.v0 ?? 1)), 0, n), cols = n <= 10 ? 5 : n <= 20 ? 5 : n <= 50 ? 10 : 10, rows = Math.ceil(n / cols), cell = Math.min(150, 860 / cols), X0 = W / 2 - cell * cols / 2, T0 = Y - cell * 1.35 * rows / 2 + 40; x.globalAlpha = ap;
      if (h.t) { const ttl = String(h.t).toUpperCase().slice(0, 26); txt(x, ttl, W / 2, T0 - 90, fitTxt(x, ttl, 820, 52), "#ffffff", 900); }
      const pick = new Set(Array.from({ length: n }, (_, i) => i).sort((p, q) => rnd(p, 41) - rnd(q, 41)).slice(0, hi));
      for (let i = 0; i < n; i++) { const a2 = clamp((lt - i * Math.min(.03, 1 / n)) / .2); if (a2 <= 0) continue; const cx = X0 + (i % cols + .5) * cell, cy = T0 + Math.floor(i / cols) * cell * 1.35 + cell * .6, on = pick.has(i) && lt > .9, r0 = cell * .2;
        x.globalAlpha = ap * a2 * (pick.size && lt > .9 && !on ? .35 : 1); x.fillStyle = on ? "#ff3b4a" : "#c9cde0"; if (on) { x.shadowColor = "#ff3b4a"; x.shadowBlur = 20 + 10 * Math.sin(t * 6); }
        x.beginPath(); x.arc(cx, cy - r0 * 1.4, r0, 0, 7); x.fill(); rr(x, cx - r0 * 1.15, cy - r0 * .2, r0 * 2.3, r0 * 2.4, r0 * .9); x.fill(); x.shadowBlur = 0; }
      x.globalAlpha = ap; if (h.items?.[0] && lt > 1) txt(x, String(h.items[0]).toUpperCase().slice(0, 24), W / 2, T0 + rows * cell * 1.35 + 60, 48, "#ff6b75", 900); }
    else if (k === "pie") { // кругова діаграма: v — відсоток, items[0] — підпис більшої частини, items[1] — решти
      const v = clamp((+String(h.v ?? 80).replace(/[^\d.]/g, "") || 80) / 100), pr = eout(clamp(lt / .9)), R = 250; x.globalAlpha = ap;
      if (h.t) { const ttl = String(h.t).toUpperCase().slice(0, 26); txt(x, ttl, W / 2, Y - R - 90, fitTxt(x, ttl, 820, 52), "#ffffff", 900); }
      x.fillStyle = "#34405a"; x.beginPath(); x.arc(W / 2, Y, R, 0, 7); x.fill(); x.fillStyle = "#3ee07f"; x.beginPath(); x.moveTo(W / 2, Y); x.arc(W / 2, Y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v * pr); x.closePath(); x.fill();
      x.fillStyle = "#121420"; x.beginPath(); x.arc(W / 2, Y, R * .52, 0, 7); x.fill(); txt(x, Math.round(v * 100 * pr) + "%", W / 2, Y + 4, 96, "#ffffff", 900);
      if (lt > .9) { if (h.items?.[0]) txt(x, String(h.items[0]).toUpperCase().slice(0, 22), W / 2, Y + R + 70, 44, "#3ee07f", 900); if (h.items?.[1]) txt(x, String(h.items[1]).toUpperCase().slice(0, 22), W / 2, Y + R + 130, 36, "rgba(200,206,230,.8)", 800); } }
    else if (k === "gauge") { // спідометр: v 0…100, після 80 — червона зона, стрілка з перельотом і тремтінням на межі
      const v = clamp((+String(h.v ?? 90).replace(/[^\d.]/g, "") || 0) / 100), pr = clamp(lt / .9), e = pr < 1 ? 1 - Math.pow(1 - pr, 3) * Math.cos(pr * 7) : 1, R = 300, a0 = Math.PI, ang = a0 + Math.PI * clamp(v * e, 0, 1.05) + (v > .9 && pr >= 1 ? Math.sin(t * 30) * .02 : 0); x.globalAlpha = ap;
      if (h.t) { const ttl = String(h.t).toUpperCase().slice(0, 26); txt(x, ttl, W / 2, Y - R - 80, fitTxt(x, ttl, 820, 52), "#ffffff", 900); }
      [[0, .55, "#3ee07f"], [.55, .8, "#ffc93c"], [.8, 1, "#ff3b4a"]].forEach(([p0, p1, c2]) => { x.strokeStyle = c2; x.lineWidth = 46; x.beginPath(); x.arc(W / 2, Y, R, a0 + Math.PI * p0, a0 + Math.PI * p1); x.stroke(); });
      x.strokeStyle = "#ffffff"; x.lineWidth = 12; x.lineCap = "round"; x.beginPath(); x.moveTo(W / 2, Y); x.lineTo(W / 2 + Math.cos(ang) * R * .86, Y + Math.sin(ang) * R * .86); x.stroke(); x.fillStyle = "#fff"; x.beginPath(); x.arc(W / 2, Y, 26, 0, 7); x.fill();
      if (h.items?.[0] && lt > .9) txt(x, String(h.items[0]).toUpperCase().slice(0, 24), W / 2, Y + 110, 50, v > .8 ? "#ff3b4a" : "#ffffff", 900); }
    else if (k === "clock") { // електронний годинник: час «пролітає» з v0 до v стрибками (3:17 → 4:40), червоні цифри з відсвітом
      const pm = (q) => { const m = String(q || "").match(/(\d{1,2})[:.](\d{2})/); return m ? +m[1] * 60 + +m[2] : null; }, b = pm(h.v) ?? 280, a0 = pm(h.v0) ?? b, steps = Math.max(1, Math.abs(b - a0)), pr = clamp(lt / Math.min(2.2, .4 + steps * .03)), cur = Math.round(a0 + (b - a0) * Math.floor(pr * 12) / 12), q = `${Math.floor(cur / 60)}:${String(cur % 60).padStart(2, "0")}`, jit = pr < 1 && Math.floor(lt * 30) % 4 === 0 ? 4 : 0;
      x.globalAlpha = ap; if (h.t) { const ttl = String(h.t).toUpperCase().slice(0, 26); txt(x, ttl, W / 2, Y - 230, fitTxt(x, ttl, 760, 48), "rgba(235,238,255,.85)", 800); }
      x.fillStyle = "#0b0b0e"; rr(x, W / 2 - 360, Y - 150, 720, 300, 40); x.fill(); x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = 4; x.stroke();
      x.shadowColor = "#ff2020"; x.shadowBlur = 40; txt(x, q, W / 2 + (jit ? (rnd(Math.floor(lt * 30), 5) - .5) * jit * 2 : 0), Y + 6, 210, "#ff3030", 900); x.shadowBlur = 0; if (h.items?.[0]) txt(x, String(h.items[0]).toUpperCase().slice(0, 26), W / 2, Y + 230, 42, "rgba(235,238,255,.8)", 700); }
    else if (k === "chat") { // телефон із листуванням: повідомлення з'являються по черзі; «я: …» або «> …» — мої (праворуч)
      const pw = 700, ph = 1000, X = W / 2 - pw / 2, T = Y - ph / 2 + 60, msgs = (h.items || []).slice(0, 5).map((q) => { const me = /^\s*(я|me)\s*:|^\s*>/i.test(q); return { me, q: String(q).replace(/^\s*(я|me)\s*:\s*|^\s*>\s*/i, "") }; });
      x.globalAlpha = ap; x.fillStyle = "#121318"; rr(x, X - 18, T - 18, pw + 36, ph + 36, 70); x.fill(); x.fillStyle = "#1e2029"; rr(x, X, T, pw, ph, 54); x.fill();
      x.fillStyle = "#2a2d39"; rr(x, X, T, pw, 150, 54); x.fill(); x.fillRect(X, T + 100, pw, 50); x.fillStyle = "#7e8bff"; x.beginPath(); x.arc(X + 80, T + 90, 34, 0, 7); x.fill(); txt(x, String(h.t || "Друг").slice(0, 18), X + 135, T + 90, 40, "#f2f3f8", 800, "left");
      let yy = T + 200; msgs.forEach((m, i) => { const st = .35 + i * .85, typing = !m.me && lt > st - .45 && lt < st; if (typing) { x.fillStyle = "#353848"; rr(x, X + 40, yy, 150, 80, 36); x.fill(); for (let k2 = 0; k2 < 3; k2++) { x.fillStyle = `rgba(220,222,235,${.4 + .6 * Math.max(0, Math.sin(lt * 9 - k2))})`; x.beginPath(); x.arc(X + 80 + k2 * 36, yy + 40, 10, 0, 7); x.fill(); } }
        const a = clamp((lt - st) / .2); if (a <= 0) return; x.save(); x.globalAlpha = ap * a; x.font = `700 40px "${FONT}", system-ui, sans-serif`; const words = m.q.split(/\s+/), lines = [""]; words.forEach((w) => { const t2 = (lines[lines.length - 1] + " " + w).trim(); if (x.measureText(t2).width > pw - 200 && lines[lines.length - 1]) lines.push(w); else lines[lines.length - 1] = t2; });
        const bw = Math.min(pw - 120, Math.max(...lines.map((l) => x.measureText(l).width)) + 60), bh = 30 + lines.length * 50, bx = m.me ? X + pw - 40 - bw : X + 40, sc2 = .85 + .15 * eout(a); x.translate(bx + (m.me ? bw : 0), yy + bh); x.scale(sc2, sc2); x.translate(-(bx + (m.me ? bw : 0)), -(yy + bh));
        x.fillStyle = m.me ? "#4f7cff" : "#353848"; rr(x, bx, yy, bw, bh, 32); x.fill(); lines.forEach((l, j) => txt(x, l, bx + 30, yy + 40 + j * 50, 40, "#ffffff", 700, "left")); x.restore(); yy += bh + 26; }); }
    else if (k === "brain") { brain(x, W / 2, Y, 300, t, ap * eout(lt / .6)); if (h.t) { x.globalAlpha = ap; glass(x, W / 2 + 40, Y + 250, 420, 190, "brain_os", ap); x.globalAlpha = ap; const n = String(h.t).toUpperCase().slice(0, 18); txt(x, n, W / 2 + 250, Y + 340, fitTxt(x, n, 360, 34), "#e9ecff"); } }
    else if (k === "check") { const it = (h.items || []).slice(0, 5), w = 800, hh = 150 + it.length * 96, X = (W - w) / 2, T = Y - hh / 2; glass(x, X, T, w, hh, h.t2 || "checklist", ap); x.globalAlpha = ap; if (h.t) txt(x, String(h.t).toUpperCase().slice(0, 26), X + w / 2, T + 100, 40, "#e9ecff");
      it.forEach((s, i) => { const a = clamp((lt - .3 - i * .45) / .3); if (a <= 0) return; x.globalAlpha = ap * a; const yy = T + 170 + i * 96; x.fillStyle = "#7fe0b0"; rr(x, X + 50, yy - 26, 52, 52, 12); x.fill(); x.strokeStyle = "#1c2a24"; x.lineWidth = 7; x.beginPath(); x.moveTo(X + 62, yy); x.lineTo(X + 74, yy + 12); x.lineTo(X + 92, yy - 12); x.stroke(); const n = String(s).slice(0, 34); txt(x, n, X + 130, yy, fitTxt(x, n, w - 180, 38, 600), "#e9ecff", 600, "left"); }); }
    else if (k === "compare") { const it = h.items?.length >= 2 ? h.items : ["БУЛО", "СТАЛО"], w = 400, hh = 440, T = Y - hh / 2; [0, 1].forEach((i) => { const X = 120 + i * (w + 40), a = clamp((lt - i * .5) / .35); if (a <= 0) return; glass(x, X, T, w, hh, i ? "після" : "до", ap * a); x.globalAlpha = ap * a;
      x.fillStyle = i ? "#7fe0b0" : "#ff7b7b"; x.beginPath(); x.arc(X + w / 2, T + 180, 70, 0, 7); x.fill(); x.strokeStyle = "#1c1a2e"; x.lineWidth = 14; x.lineCap = "round"; x.beginPath(); if (i) { x.moveTo(X + w / 2 - 30, T + 180); x.lineTo(X + w / 2 - 6, T + 205); x.lineTo(X + w / 2 + 34, T + 155); } else { x.moveTo(X + w / 2 - 26, T + 154); x.lineTo(X + w / 2 + 26, T + 206); x.moveTo(X + w / 2 + 26, T + 154); x.lineTo(X + w / 2 - 26, T + 206); } x.stroke();
      const n = String(it[i]).toUpperCase().slice(0, 16); txt(x, n, X + w / 2, T + 330, fitTxt(x, n, w - 50, 46), "#e9ecff"); }); }
    else if (k === "rings") { x.globalAlpha = ap * .8; x.strokeStyle = "rgba(190,200,255,.5)"; x.lineWidth = 3; [260, 360, 470].forEach((r, i) => { x.setLineDash([30 + i * 10, 18]); x.lineDashOffset = t * (i % 2 ? -40 : 40); x.beginPath(); x.arc(W / 2, Y, r, 0, 7); x.stroke(); }); x.setLineDash([]); }
    else if (k === "network") { x.globalAlpha = ap; const N = 40, pts = []; for (let i = 0; i < N; i++) pts.push([rnd(i, 21) * W + Math.sin(t * .5 + i) * 30, Y - 500 + rnd(i, 22) * 1000 + Math.cos(t * .4 + i) * 30]);
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]); if (d < 260) { x.strokeStyle = `rgba(190,200,255,${.4 * (1 - d / 260)})`; x.lineWidth = 2; x.beginPath(); x.moveTo(pts[i][0], pts[i][1]); x.lineTo(pts[j][0], pts[j][1]); x.stroke(); } }
      pts.forEach((p) => { x.fillStyle = "rgba(230,235,255,.9)"; x.beginPath(); x.arc(p[0], p[1], 5, 0, 7); x.fill(); }); }
    else if (k === "timeline" || k === "timer" || k === "rules" || k === "split") { x.globalAlpha = ap; x.translate(W / 2, Y); x.scale(1.45, 1.45); x.translate(-W / 2, -Y); const G = "#e8c35a", Wt = "rgba(235,238,255,.92)", ttl = String(h.t || "").toUpperCase().slice(0, 28), lab = (q, X, Y2, sz, c = Wt, al = "center") => txt(x, q, X, Y2, sz, c, 800, al);
      if (ttl) lab(ttl, W / 2, Y - 200, fitTxt(x, ttl, 640, 46), Wt);
      if (k === "timeline") { const X0 = W / 2 - 300, X1 = W / 2 + 300, pr = eout(clamp(lt / 1.4)), v = clamp((+h.v || 73) / 100); x.strokeStyle = Wt; x.lineWidth = 4; x.beginPath(); x.moveTo(X0, Y); x.lineTo(X0 + (X1 - X0) * eout(clamp(lt / .5)), Y); x.stroke();
        for (let i = 0; i <= 10; i++) { const X = X0 + (X1 - X0) * i / 10; if (lt < .1 + i * .04) continue; x.beginPath(); x.moveTo(X, Y - 16); x.lineTo(X, Y + 16); x.stroke(); txt(x, String(i * 10), X, Y + 52, 26, "rgba(235,238,255,.6)", 600); }
        const MX = X0 + (X1 - X0) * v * pr; x.strokeStyle = G; x.lineWidth = 6; x.beginPath(); x.moveTo(MX, Y - 70); x.lineTo(MX, Y + 10); x.stroke(); lab(String(h.items?.[0] || `${Math.round(v * 100 * pr)}`).toUpperCase().slice(0, 16), MX, Y - 110, 40, G); }
      if (k === "timer") { const left = Math.max(0, (+String(h.v ?? 100000).replace(/[^\d.]/g, "") || 100000) - lt), dd = Math.floor(left / 86400), hh2 = Math.floor(left / 3600) % 24, mm = Math.floor(left / 60) % 60, ss = Math.floor(left) % 60, p2 = (n) => String(n).padStart(2, "0");
        const tw = 520, X = W / 2 - tw / 2; x.fillStyle = "rgba(10,12,28,.6)"; rr(x, X, Y - 60, tw, 120, 26); x.fill(); x.strokeStyle = G; x.lineWidth = 5; rr(x, X, Y - 60, tw, 120, 26); x.stroke(); lab(`${p2(dd)}:${p2(hh2)}:${p2(mm)}:${p2(ss)}`, X + tw / 2, Y, 66, Wt);
        if (h.items?.length) { const L4 = [[dd, h.items[0] || "ДНІВ"], [hh2, h.items[1] || "ГОДИН"], [mm, h.items[2] || "ХВИЛИН"], [ss, h.items[3] || "СЕКУНД"]]; L4.forEach(([n, q], i) => { if (lt < .4 + i * .35) return; lab(p2(n), W / 2 - 40, Y + 130 + i * 62, 42, G, "right"); lab(String(q).toUpperCase().slice(0, 10), W / 2 - 10, Y + 130 + i * 62, 36, Wt, "left"); }); } }
      if (k === "rules") { const n = clamp(Math.round(+h.v || 3), 1, 5), gap = n > 3 ? 150 : 200, X0 = W / 2 - gap * (n - 1) / 2; for (let i = 0; i < n; i++) { const a = clamp((lt - .2 - i * .35) / .3); if (a <= 0) continue; x.globalAlpha = ap * a; x.strokeStyle = Wt; x.lineWidth = 5; x.beginPath(); x.arc(X0 + i * gap, Y, 56, 0, 7); x.stroke(); lab(String(i + 1), X0 + i * gap, Y, 56, Wt); if (h.items?.[i]) lab(String(h.items[i]).slice(0, 14), X0 + i * gap, Y + 110, fitTxt(x, String(h.items[i]).slice(0, 14), 190, 30), "rgba(235,238,255,.75)"); } x.globalAlpha = ap; }
      if (k === "split") { const it = h.items?.length >= 2 ? h.items : ["ТАК", "НІ"]; x.strokeStyle = "rgba(235,238,255,.55)"; x.lineWidth = 4; x.beginPath(); x.moveTo(W / 2, Y - 200); x.lineTo(W / 2, Y - 200 + 520 * eout(clamp(lt / .5))); x.stroke();
        [0, 1].forEach((i) => { const a = clamp((lt - .2 - i * .4) / .3); if (a <= 0) return; x.globalAlpha = ap * a; const q = String(it[i]).toUpperCase().slice(0, 14); lab(q, W / 2 + (i ? 230 : -230), Y - 150, fitTxt(x, q, 400, 44), i ? G : Wt); }); x.globalAlpha = ap; if (lt > 1.4) lab("?", W / 2 + 230, Y + 80, 140 + Math.sin(t * 4) * 6, G); } }
    x.restore();
  }
  // тінь-демон: силует з пульсуючим червоним світінням, щілини очей і оскал; scale → grow протягом сцени, поява з темряви
  function shadowFig(x, s, c, lt, d, t) { const g = c.grow != null ? c.scale + (c.grow - c.scale) * eio(clamp(lt / Math.max(.6, d * .8))) : (c.scale || 1), h = 720 * g, a = clamp(lt / .5);
    if (a <= 0) return null;
    // малюємо фігуру окремо й перефарбовуємо в суцільний чорний силует (без взуття, кишень і обличчя), потім кладемо з червоним світінням
    const cv = x.canvas, off = SHC.c && SHC.c.width === cv.width && SHC.c.height === cv.height ? SHC.c : (SHC.c = Object.assign(document.createElement("canvas"), { width: cv.width, height: cv.height })), o = off.getContext("2d");
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.shadowBlur = 0; o.shadowColor = "transparent"; o.globalCompositeOperation = "source-over"; o.clearRect(0, 0, off.width, off.height); o.setTransform(x.getTransform());
    const hd = figure(o, s.X, s.Y, s.P, { who: "shadow", key: "sh", col: "#0b0b0d", face: "calm", f: s.f, h, seed: 9, _sil: 1 }, t);
    if (hd) { o.fillStyle = "#000"; o.beginPath(); o.arc(hd.head[0], hd.head[1], hd.r * 1.04, 0, 7); o.fill(); }
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.shadowBlur = 0; o.globalCompositeOperation = "source-in"; o.fillStyle = "#0a0a0c"; o.fillRect(0, 0, off.width, off.height); o.globalCompositeOperation = "source-over";
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = a * .97; const sc0 = Math.hypot(x.getTransform().a, x.getTransform().b) || 1;
    const GL = SHGLOW[c.glow] || SHGLOW.red, dieP = c.die ? clamp((lt - d * .4) / (d * .45)) : 0; x.globalAlpha = a * .97 * (1 - dieP); x.shadowColor = GL[0]; x.shadowBlur = (26 + 10 * Math.sin(t * 3.2)) * Math.min(1.6, .6 + g * .5) * (cv.width / W); x.drawImage(off, 0, 0); x.shadowBlur = 12 * (cv.width / W); x.drawImage(off, 0, 0); x.shadowBlur = 0; x.shadowColor = "transparent"; x.drawImage(off, 0, 0); x.restore();
    // розпад на іскри (перемога над страхом)
    if (hd && dieP > 0) { x.save(); const top = hd.head[1] - hd.r, h2 = s.Y - top; for (let i = 0; i < 90; i++) { const u = rnd(i, 91), X0 = s.X + (rnd(i, 92) - .5) * hd.r * 2.4, Y0 = top + u * h2, lp = clamp(dieP * 1.4 - u * .4); if (lp <= 0) continue; x.globalAlpha = (1 - lp) * .95; x.fillStyle = i % 3 ? GL[1] : "#1a1a1e"; x.beginPath(); x.arc(X0 + Math.sin(i + lt * 3) * 20 * lp, Y0 - lp * (180 + rnd(i, 93) * 260), 4 + rnd(i, 94) * 6, 0, 7); x.fill(); } x.restore(); }
    if (hd && dieP < 1) { x.save(); x.globalAlpha = a * (1 - dieP); const [hx, hy] = hd.head, r = hd.r; x.fillStyle = GL[1]; x.shadowColor = GL[1]; x.shadowBlur = 18; const ey = hy - r * .12, ew = r * .34, eh = r * .09, tilt = .28 * s.f;
      [-1, 1].forEach((k) => { x.save(); x.translate(hx + k * r * .36 + s.f * r * .08, ey); x.rotate(k * tilt * -1); x.beginPath(); x.ellipse(0, 0, ew, eh, 0, 0, 7); x.fill(); x.restore(); });
      if (c.face !== "calm") { x.strokeStyle = GL[1]; x.lineWidth = r * .07; x.beginPath(); x.moveTo(hx - r * .38, hy + r * .34); x.quadraticCurveTo(hx, hy + r * .58, hx + r * .38, hy + r * .34); x.stroke(); } x.restore(); }
    return hd; }
  const SHC = {};
  // люди на фоні (зупинка, вулиця) — менші, з мітками/таймерами над головами
  function drawCrowd(x, sc, L, lt, t, heroX) { const n = clamp(Math.round(sc.crowd), 0, 6), cols = ["teal", "coral", "purple", "blue", "green", "pink"], whos = ["man", "woman", "old", "man", "woman", "kid"];
    for (let i = 0; i < n; i++) { const fx = (i + .5) / n, X = W * (.08 + fx * .84) + (rnd(i, 81) - .5) * 60; if (Math.abs(X - heroX) < 120) continue; const c = { who: whos[i % 6], key: "crowd" + i, col: cols[i % 6], face: ["calm", "worried", "happy", "sad"][i % 4], f: X > W / 2 ? -1 : 1, h: 430, seed: i * 7 };
      const hd = figure(x, X, FLOOR - 70, POSE[["stand", "phone", "think", "stand", "talk", "stand"][i % 6]], c, t), hd2 = hd && { ...hd, head: [hd.head[0], hd.head[1] - (i % 2) * hd.r * 1.1] }; if (sc.crowdTimer) drawTag(x, hd2, { timer: Math.round(1e4 + rnd(i, 82) * 2e9) }, lt - i * .15, t); else if (sc.crowdTag?.[i]) drawTag(x, hd2, { tag: sc.crowdTag[i] }, lt - i * .15, t); } }
  // мітка над головою: напис («41 РІК») або таймер, що біжить назад
  // мітка над головою (як у роликах What If): колір стану, перебіг числа tag0→tag, дельта «+3 / −300», серце, другий рядок, пульс червоного
  const TAGC = { green: ["#1f6e45", "#3ee07f"], red: ["#7a1620", "#ff3b4a"], gold: ["#6b4a0c", "#ffc93c"], blue: ["#1d3f66", "#5bb2e8"], pink: ["#6e1846", "#ff5fa8"], dark: ["#1b1d2b", "#ffffff"] };
  function drawTag(x, hd, c, lt, t) { if (!hd || (!c.tag && c.timer == null)) return; const a = clamp(lt / .25); if (a <= 0) return; let q = String(c.tag || ""), timer = c.timer != null;
    if (timer) { const left = Math.max(0, +c.timer - lt), dd = Math.floor(left / 86400), hh = Math.floor(left / 3600) % 24, mm = Math.floor(left / 60) % 60, ss = Math.floor(left) % 60, p2 = (n) => String(n).padStart(2, "0"); q = `${p2(dd)}:${p2(hh)}:${p2(mm)}:${p2(ss)}`; }
    else if (c.tag0 != null) { const m = q.match(/-?\d[\d\s.,]*/), to = m ? parseFloat(m[0].replace(/[\s,]/g, "")) : NaN, fr = parseFloat(String(c.tag0).replace(/[\s,]/g, "")); if (isFinite(to) && isFinite(fr)) { const pr = clamp((lt - .2) / 1.1), cur = Math.round(fr + (to - fr) * eio(pr)), jit = pr > 0 && pr < 1 ? Math.floor(rnd(Math.floor(lt * 30), 9) * 10) : 0; q = q.replace(m[0], (pr < 1 ? Math.max(0, cur + (Math.abs(to - fr) > 50 ? jit : 0)) : to).toLocaleString("en-US")); } }
    const col = TAGC[c.tagC] || (timer ? (c.timer < 86400 ? TAGC.red : TAGC.dark) : TAGC.green), red = col === TAGC.red, pulse = red ? 1 + .07 * Math.max(0, Math.sin(t * 9)) : 1, pop = 1 + (1 - eout(lt / .3)) * .25 * (lt < .3 ? 1 : 0);
    const sz = Math.max(30, hd.r * .46); x.save(); x.font = `900 ${sz}px "${FONT}", system-ui, sans-serif`; const ic = c.tagIcon === "heart" ? sz * 1.1 : 0, w = Math.max(x.measureText(q.toUpperCase()).width + ic, c.tag2 ? x.measureText(String(c.tag2).toUpperCase()).width * .62 : 0) + sz * 1.1, hgt = sz * (c.tag2 ? 2.35 : 1.6);
    const TM = x.getTransform(), kk = TM.a || 1, cw = x.canvas.width, pad = 24 * cw / W, X = clamp(hd.head[0], (pad + w * kk / 2 - TM.e) / kk, (cw - pad - w * kk / 2 - TM.e) / kk), Y = hd.head[1] - hd.r * 1.8 - (c.tag2 ? sz * .5 : 0) + Math.sin(t * 3 + hd.head[0]) * 3; x.globalAlpha = a; x.translate(X, Y); x.scale(pulse * pop, pulse * pop);
    x.shadowColor = col[1]; x.shadowBlur = red ? 22 : 12; x.fillStyle = col[0]; rr(x, -w / 2, -hgt / 2, w, hgt, sz * .45); x.fill(); x.shadowBlur = 0; x.strokeStyle = col[1]; x.lineWidth = 3; x.stroke();
    x.textAlign = "center"; x.textBaseline = "middle"; const ty = c.tag2 ? -hgt * .2 : 2;
    if (ic) { const hx = -w / 2 + sz * .55 + ic * .4, hy = ty, s2 = sz * .5; x.fillStyle = col[1]; x.beginPath(); x.moveTo(hx, hy + s2 * .9); x.bezierCurveTo(hx - s2 * 1.6, hy - s2 * .2, hx - s2 * .7, hy - s2 * 1.3, hx, hy - s2 * .45); x.bezierCurveTo(hx + s2 * .7, hy - s2 * 1.3, hx + s2 * 1.6, hy - s2 * .2, hx, hy + s2 * .9); x.fill(); }
    x.fillStyle = "#f7f7fa"; x.fillText(q.toUpperCase(), ic / 2, ty); if (c.tag2) { x.font = `800 ${sz * .62}px "${FONT}", system-ui, sans-serif`; x.fillStyle = col[1]; x.fillText(String(c.tag2).toUpperCase(), 0, hgt * .24); }
    x.restore();
    // дельта: вилітає збоку від мітки й тане вгору
    if (c.delta) { const dl = lt - .7; if (dl > 0 && dl < 1.2) { const neg = /^\s*[-−]/.test(c.delta); x.save(); x.globalAlpha = a * (1 - clamp((dl - .6) / .6)); x.font = `900 ${sz * 1.1}px "${FONT}", system-ui, sans-serif`; x.textAlign = "left"; x.textBaseline = "middle"; x.fillStyle = neg ? "#ff3b4a" : "#3ee07f"; x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 8; x.fillText(String(c.delta), X + sz * 2.2, Y - dl * 90); x.restore(); } } }
  // «ЯКЩО ТВІЙ *IQ* …» — виділене слово в зірочках
  function capText(x, cap, lt, cy, style) {
    const hand = !KN(), parts = String(cap.t || "")[hand ? "toString" : "toUpperCase"]().split(/(\*[^*]+\*)/).filter(Boolean).flatMap((s) => { const hl = s.startsWith("*"); return s.replace(/\*/g, "").trim().split(/\s+/).filter(Boolean).map((w) => ({ w, hl })); });
    if (!parts.length) return; const big = style === "title", size0 = (big ? 118 : 96) * (hand ? 1.25 : 1), FF = (z) => hand ? `700 ${z}px "${HANDF}", cursive` : `900 ${z}px "${FONT}", system-ui, sans-serif`;
    x.save(); x.font = FF(size0); const sp = size0 * .28, maxW = SAFEW - 40, lines = [[]]; let lw = 0;
    parts.forEach((p) => { const w = x.measureText(p.w).width; if (lw + w > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push({ ...p, wd: w }); lw += w + sp; });
    const scale = Math.min(1, ...lines.map((l) => maxW / (l.reduce((a, p) => a + p.wd + sp, -sp))));
    const size = size0 * scale, lh = size * 1.08, outA = cap.out ? clamp((cap.out - lt) / .25) : 1; let idx = 0;
    // друк по літері (typewriter): ~20 знаків/с, курсор блимає
    if (cap.tw) { const shown = Math.floor(Math.max(0, lt) * 20); let ci = 0, cur = null; x.font = FF(size); x.textBaseline = "middle"; x.textAlign = "left"; x.lineJoin = "round"; x.globalAlpha = outA;
      lines.forEach((l, li) => { const tw = l.reduce((a, p) => a + p.wd * scale + sp * scale, -sp * scale); let X = SCX - tw / 2; const Y = cy + (li - (lines.length - 1) / 2) * lh;
        l.forEach((p) => { const vis = p.w.slice(0, Math.max(0, shown - ci)); ci += p.w.length + 1; if (vis) { x.strokeStyle = hand ? "#141414" : "rgba(20,18,30,.85)"; x.lineWidth = size * (hand ? .16 : .14); x.strokeText(vis, X, Y); x.fillStyle = p.hl ? (cap.c || "#dbe86b") : "#ffffff"; x.fillText(vis, X, Y); cur = [X + x.measureText(vis).width + 6, Y]; } X += (p.wd + sp) * scale; }); });
      if (cur && Math.floor(lt * 2.5) % 2 === 0) { x.fillStyle = "#ffffff"; x.fillRect(cur[0], cur[1] - size * .4, size * .08, size * .8); } x.restore(); return; }
    lines.forEach((l, li) => { const tw = l.reduce((a, p) => a + p.wd * scale + sp * scale, -sp * scale); let X = SCX - tw / 2; const Y = cy + (li - (lines.length - 1) / 2) * lh;
      l.forEach((p) => { const a = clamp((lt - idx * .07) / .16) * outA, s = 1 + (1 - eout((lt - idx * .07) / .22)) * .35; idx++; if (a <= 0) { X += (p.wd + sp) * scale; return; }
        x.save(); x.globalAlpha = a; x.translate(X + p.wd * scale / 2, Y); x.scale(s, s); x.font = FF(size); x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
        x.shadowColor = hand ? "transparent" : "rgba(0,0,0,.45)"; x.shadowBlur = 18; x.shadowOffsetY = 6; x.strokeStyle = hand ? "#141414" : "rgba(20,18,30,.85)"; x.lineWidth = size * (hand ? .16 : .14); x.strokeText(p.w, 0, 0); x.shadowBlur = 0; x.shadowOffsetY = 0;
        x.fillStyle = p.hl ? (cap.c || "#dbe86b") : "#ffffff"; x.fillText(p.w, 0, 0); x.restore(); X += (p.wd + sp) * scale; }); });
    x.restore();
  }
  const SUBST = { hand: "Рукописні", classic: "Класичні", box: "Плашка", pop: "Караоке", one: "По слову", minimal: "Мінімал", yellow: "Жовті" };
  const SUBS0 = { k: "classic", size: 1, y: 1370 };
  function subs(x, t, L) { const S = { ...SUBS0, ...(L.subS || {}) }, k0 = SUBST[S.k] ? S.k : "classic", k = k0 === "classic" && !KN() ? "hand" : k0;
    const ws = L.words; let i = ws.findIndex((w) => w.e > t - .05); if (i < 0) return; if (ws[i].s > t + .05 && (i === 0 || t - ws[i - 1].e > .5)) return;
    const N = k === "one" ? 1 : k === "box" ? 3 : 4, g0 = Math.floor(i / N) * N, grp = ws.slice(g0, g0 + N); if (!grp.length) return;
    const size = (k === "one" ? 92 : k === "minimal" ? 46 : 54) * clamp(+S.size || 1, .6, 1.8), Y = clamp(+S.y || 1370, 300, 1800);
    x.save(); x.font = k === "hand" ? `700 ${size * 1.3}px "${HANDF}", cursive` : `${k === "minimal" ? 700 : 800} ${size}px "${FONT}", system-ui, sans-serif`; const sp = size * .26, tw = grp.reduce((a, w) => a + x.measureText(w.w).width + sp, -sp), sc = Math.min(1, (SAFEW - 40) / tw);
    x.translate(SCX, Y); x.scale(sc, sc); x.translate(-SCX, -Y); let X = SCX - tw / 2; x.textAlign = "left"; x.textBaseline = "middle"; x.lineJoin = "round";
    if (k === "box") { const pad = size * .35; x.fillStyle = "rgba(12,11,20,.78)"; rr(x, X - pad, Y - size * .78, tw + pad * 2, size * 1.56, size * .35); x.fill(); }
    grp.forEach((w, n) => { const on = g0 + n === i && t >= w.s - .05, ww = x.measureText(w.w).width;
      if (k === "one") { const p = clamp((t - w.s) / .12), s2 = 1 + (1 - eout(p)) * .3; x.save(); x.translate(X + ww / 2, Y); x.scale(s2, s2); x.strokeStyle = "rgba(15,14,22,.92)"; x.lineWidth = size * .2; x.textAlign = "center"; x.strokeText(w.w.toUpperCase(), 0, 0); x.fillStyle = "#fff"; x.fillText(w.w.toUpperCase(), 0, 0); x.restore(); }
      else if (k === "box") { if (on) { x.fillStyle = "#dbe86b"; rr(x, X - size * .14, Y - size * .62, ww + size * .28, size * 1.24, size * .22); x.fill(); } x.fillStyle = on ? "#14121c" : "#fff"; x.fillText(w.w, X, Y); }
      else if (k === "pop") { const s2 = on ? 1.16 : 1; x.save(); x.translate(X + ww / 2, Y); x.scale(s2, s2); x.strokeStyle = "rgba(15,14,22,.9)"; x.lineWidth = size * .22; x.textAlign = "center"; x.strokeText(w.w, 0, 0); x.fillStyle = on ? "#7fe0b0" : t > w.e ? "#fff" : "rgba(255,255,255,.72)"; x.fillText(w.w, 0, 0); x.restore(); }
      else if (k === "hand") { x.strokeStyle = "#141414"; x.lineWidth = size * .24; x.strokeText(w.w, X, Y); x.fillStyle = on ? "#ffe27a" : "#fff"; x.fillText(w.w, X, Y); }
      else if (k === "minimal") { x.shadowColor = "rgba(0,0,0,.7)"; x.shadowBlur = 12; x.fillStyle = on ? "#fff" : "rgba(255,255,255,.75)"; x.fillText(w.w, X, Y); x.shadowBlur = 0; }
      else if (k === "yellow") { x.strokeStyle = "rgba(15,14,22,.9)"; x.lineWidth = size * .22; x.strokeText(w.w, X, Y); x.fillStyle = on ? "#fff" : "#ffd60a"; x.fillText(w.w, X, Y); }
      else { x.strokeStyle = "rgba(15,14,22,.9)"; x.lineWidth = size * .22; x.strokeText(w.w, X, Y); x.fillStyle = on ? "#dbe86b" : "#fff"; x.fillText(w.w, X, Y); }
      X += ww + sp; }); x.restore(); }

  /* ---------- кадр ---------- */
  let GRAIN = null;
  function grain() { if (GRAIN) return GRAIN; const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"), d = x.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 22; } x.putImageData(d, 0, 0); return GRAIN = c; }
  const SHOT = { wide: 1, medium: 1.38, close: 1.9, face: 2.7 };
  function camOf(sc, lt, d, hero) {
    const z0 = SHOT[sc.shot] || 1, p = clamp(lt / Math.max(.5, d)), m = sc.cam || "push";
    let z = z0 * (m === "push" ? 1 + .09 * ease(p) : m === "pull" ? 1.12 - .1 * ease(p) : m === "punch" ? (lt < .1 ? 1 : 1.28 - .05 * ease(p)) : 1 + .02 * p), fx = W / 2, fy = H / 2;
    if (m === "punch" && hero && lt >= .1) { fx = hero.head[0]; fy = hero.head[1] + hero.r * .6; }
    if (hero && z0 > 1) { fx = hero.head[0]; fy = sc.shot === "medium" ? hero.head[1] + hero.h * .32 : hero.head[1] + hero.r * (sc.shot === "face" ? .2 : 1.2); }
    if (m === "pan_l") fx += lerp(120, -120, ease(p)); if (m === "pan_r") fx += lerp(-120, 120, ease(p));
    (sc.hitT || []).forEach((ht) => { const q = lt - ht; if (q > 0 && q < .5) z *= 1 + .05 * (1 - q / .5) * (q < .06 ? q / .06 : 1); });
    let sx = 0, sy = 0; if (m === "shake") { sx = (rnd(Math.floor(lt * 24), 1) - .5) * 14; sy = (rnd(Math.floor(lt * 24), 2) - .5) * 14; }
    sx += Math.sin(lt * .8 + sc.a) * 5; sy += Math.cos(lt * .6 + sc.a) * 4;
    const vw = W / z, vh = H / z; fx = clamp(fx, vw / 2, W - vw / 2); fy = clamp(fy, vh / 2, H - vh / 2);
    return { z, fx: fx + sx / z, fy: fy + sy / z };
  }
  function castState(sc, c, lt, d, i) {
    let X = (c.x ?? .5) * W, pose = POSE[c.pose] || POSE.stand, P, moving = false;
    if (c.to != null) { const tw = Math.min(d * .65, Math.abs(c.to - (c.x ?? .5)) * 4.5 + .6), p = clamp(lt / tw); X = lerp((c.x ?? .5), c.to, ease(p)) * W; moving = p < 1;
      if (p < 1) P = walkPose(lt * (c.pose === "run" ? 13 : 8), c.pose === "run"); else P = blendPose(walkPose(0), pose.walk ? POSE.stand : pose, clamp((lt - tw) / .3)); }
    else if (pose.walk) P = walkPose(lt * (pose.walk === 2 ? 13 : 8), pose.walk === 2);
    else { const enter = POSE[c.from] || POSE.stand; P = blendPose(enter, pose, clamp(lt / .45)); }
    if (c.pose === "wave") P = { ...P, a: [P.a[0], [150, 30 + Math.sin(lt * 9) * 25]] };
    if (c.pose === "talk") P = { ...P, a: [P.a[0], [38 + Math.sin(lt * 3.1 + i) * 12, 62 + Math.sin(lt * 4.3 + i) * 15]] };
    const f = c.look === "l" ? -1 : c.look === "r" ? 1 : (c.to != null ? Math.sign(c.to - (c.x ?? .5)) || 1 : (c.x ?? .5) > .55 ? -1 : 1);
    const Y = c.y != null ? c.y * H : WHO[c.who]?.pet ? FLOOR + 30 : (POSE[c.pose]?.lie ? 1215 : POSE[c.pose]?.sit ? FLOOR - 20 : FLOOR + 40);
    return { X, Y, P, f, moving };
  }
  /* ---------- написи всередині світу: на дошці, екрані, плакаті, вивісці — не поверх кадру ---------- */
  const WALLK = { room: "poster", bedroom: "poster", class: "chalk", office: "board", street: "sign", stop: "sign", board: "board", night: "neon", road: "sign", lab: "screen", hospital: "board", space: "neon", cafe: "chalk", park: "sign", stage: "screen", blog: "screen", kitchen: "paper", gym: "board", shop: "sign", void: "poster" };
  const WALLS = ["board", "chalk", "screen", "poster", "sign", "neon", "paper"];
  const wallKind = (sc) => sc.fx?.includes("black") ? "neon" : WALLS.includes(sc.cap?.on) ? sc.cap.on : sc.time === "night" && ["street", "road", "park", "stop"].includes(sc.place) ? "neon" : WALLK[sc.place] || "poster";
  const WTX = { board: ["#1f3a8a", "#d62828", HANDF], chalk: ["#f2f0e6", "#ffd166", HANDF], screen: ["#f4f6ff", "#7fe0b0", FONT], poster: ["#2b2622", "#d62828", HANDF], sign: ["#1f1d24", "#e63946", FONT], neon: ["#ff4fa3", "#4dd9ff", HANDF], paper: ["#2b2622", "#d62828", HANDF] };
  function wallLines(x, t, fam, maxW) { const ws = String(t).replace(/\s+/g, " ").trim().split(" ").map((w) => ({ k: /\*/.test(w), w: w.replace(/\*/g, "") })).filter((w) => w.w);
    for (let fs = 92; fs >= 46; fs -= 6) { x.font = `${fam === FONT ? 900 : 700} ${fs}px "${fam}", "${FONT}", sans-serif`; const sp = x.measureText(" ").width, lines = [[]]; let cw = 0;
      for (const w of ws) { w.m = x.measureText(w.w).width; if (cw && cw + sp + w.m > maxW) { lines.push([]); cw = 0; } lines[lines.length - 1].push(w); cw += (cw ? sp : 0) + w.m; }
      const lw = Math.max(...lines.map((l) => l.reduce((s2, q, i) => s2 + q.m + (i ? sp : 0), 0))); if ((lines.length <= 3 && lw <= maxW) || fs <= 46) return { fs, sp, lines, w: lw }; } }
  function wallFrame(x, k, w, h, t, ol, wy, z) { x.lineJoin = "round"; const X = -w / 2, Y = -h / 2;
    if (k === "sign") { const fy = (FLOOR - wy) * z; x.fillStyle = "#5b5e66"; [-.3, .3].forEach((u) => x.fillRect(u * w - 9, h / 2 - 4, 18, Math.max(0, fy - h / 2))); x.fillStyle = "#fdfaf0"; rr(x, X, Y, w, h, 10); x.fill(); x.strokeStyle = "#2b2b33"; x.lineWidth = 12; x.stroke(); return; }
    if (k === "board") { x.fillStyle = "rgba(0,0,0,.18)"; rr(x, X + 10, Y + 14, w, h, 12); x.fill(); x.fillStyle = "#f8f8f4"; rr(x, X, Y, w, h, 12); x.fill(); x.strokeStyle = "#a3a9b2"; x.lineWidth = 16; x.stroke(); x.fillStyle = "#8e949d"; x.fillRect(X + w * .2, Y + h + 4, w * .6, 14); x.fillStyle = "#d62828"; x.fillRect(X + w * .62, Y + h - 2, 56, 10); x.fillStyle = "rgba(120,140,170,.08)"; x.fillRect(X + 20, Y + 20, w * .4, h - 40); }
    else if (k === "chalk") { x.fillStyle = "rgba(0,0,0,.22)"; rr(x, X + 10, Y + 14, w, h, 8); x.fill(); x.fillStyle = "#2f4a3c"; rr(x, X, Y, w, h, 8); x.fill(); x.strokeStyle = "#8a5a34"; x.lineWidth = 22; x.stroke(); x.fillStyle = "rgba(255,255,255,.05)"; for (let i = 0; i < 6; i++) { x.beginPath(); x.ellipse(X + rnd(i, 81) * w, Y + rnd(i, 82) * h, 90, 30, rnd(i, 83), 0, 7); x.fill(); } }
    else if (k === "screen") { x.fillStyle = "#16161c"; rr(x, X - 22, Y - 22, w + 44, h + 44, 22); x.fill(); x.fillStyle = "#26262e"; x.fillRect(-40, Y + h + 22, 80, 40); rr(x, -120, Y + h + 58, 240, 16, 8); x.fill(); const g = x.createLinearGradient(0, Y, 0, Y + h); g.addColorStop(0, "#14203d"); g.addColorStop(1, "#0b1122"); x.fillStyle = g; rr(x, X, Y, w, h, 8); x.fill(); x.fillStyle = "rgba(255,255,255,.05)"; x.beginPath(); x.moveTo(X, Y); x.lineTo(X + w * .45, Y); x.lineTo(X + w * .2, Y + h); x.lineTo(X, Y + h); x.fill(); }
    else if (k === "neon") { x.fillStyle = "rgba(12,10,20,.55)"; rr(x, X, Y, w, h, 24); x.fill(); x.strokeStyle = "rgba(255,79,163,.35)"; x.lineWidth = 4; x.stroke(); }
    else { const pr = k === "paper"; x.rotate((pr ? 2.5 : -1.8) * D); x.fillStyle = "rgba(0,0,0,.16)"; x.fillRect(X + 8, Y + 12, w, h); x.fillStyle = pr ? "#fff6b8" : "#fbf6ea"; x.fillRect(X, Y, w, h); x.strokeStyle = "rgba(120,100,70,.25)"; x.lineWidth = 2; x.strokeRect(X, Y, w, h);
      x.fillStyle = "rgba(255,236,170,.75)"; if (pr) x.fillRect(-50, Y - 16, 100, 34); else { x.save(); x.translate(X + 10, Y + 6); x.rotate(-.6); x.fillRect(-45, -14, 90, 30); x.restore(); x.save(); x.translate(X + w - 10, Y + 6); x.rotate(.6); x.fillRect(-45, -14, 90, 30); x.restore(); } }
    if (!KN() && k !== "neon") { x.strokeStyle = ol; x.lineWidth = 5; k === "screen" ? rr(x, X - 22, Y - 22, w + 44, h + 44, 22) : rr(x, X, Y, w, h, k === "chalk" ? 8 : 12); x.stroke(); } }
  function wallText(x, k, info, cl, t) { const [c0, c1, fam] = WTX[k], n = info.lines.flat().length, p = clamp(cl / (.16 * n + .25)); let idx = 0; const lh = info.fs * 1.08, y0 = -(info.lines.length - 1) * lh / 2;
    x.font = `${fam === FONT ? 900 : 700} ${info.fs}px "${fam}", "${FONT}", sans-serif`; x.textBaseline = "middle"; x.textAlign = "left";
    info.lines.forEach((l, li) => { const lw = l.reduce((s2, q, i) => s2 + q.m + (i ? info.sp : 0), 0); let cx = -lw / 2; const cy = y0 + li * lh;
      l.forEach((w) => { const u = clamp(p * n - idx); idx++; if (u > 0) { x.save(); x.globalAlpha = u; x.fillStyle = w.k ? c1 : c0;
          if (k === "neon") { x.shadowColor = x.fillStyle; x.shadowBlur = 26; const fl = rnd(Math.floor(t * 12), 91 + idx) > .97 ? .4 : 1; x.globalAlpha = u * fl; }
          if (k === "chalk") x.globalAlpha = u * .92; x.fillText(w.w, cx, cy + (1 - u) * 10);
          if (w.k && k !== "neon" && u >= 1) { const q = clamp((cl - (.16 * n + .25)) / .3); if (q > 0) { x.strokeStyle = c1; x.lineWidth = Math.max(4, info.fs * .07); x.lineCap = "round"; x.beginPath(); x.moveTo(cx, cy + info.fs * .5); x.quadraticCurveTo(cx + w.m * .5, cy + info.fs * .58, cx + w.m * q, cy + info.fs * .48); x.stroke(); } }
          x.restore(); } cx += w.m + info.sp; }); }); }
  const HUDOFF = {};
  function drawWall(x, sc, lt, d, t, cam0, hsx) { const txt0 = sc.cap?.t || sc.loc || sc.cast?.find((c) => c.tag)?.tag || "", hasH = !!(sc.hud && sc.hud.k && sc.hud.k !== "none"); if (!txt0 && !hasH) return;
    const z = cam0.z, toW = (cx, cy) => [(cx - W / 2) / z + cam0.fx, (cy - H / 2) / z + cam0.fy], ol = OLC(), side = hsx == null ? W / 2 : hsx > W / 2 ? 350 : W - 350;
    const put = (cx, cy, fn) => { const [wx, wy] = toW(cx, cy); x.save(); x.translate(wx, wy); x.scale(1 / z, 1 / z); fn(wy); x.restore(); };
    if (hasH) { const hl = lt - (sc.hud.at ?? 0), sw = hsx == null ? 720 : 540, sh = sw * .75, cy = txt0 ? 700 : 560, hx = hsx == null ? W / 2 : hsx > W / 2 ? 340 : W - 340;
      put(hx, cy, (wy) => { wallFrame(x, "screen", sw, sh, t, ol, wy, z); if (hl < 0) return; const o = HUDOFF.c || (HUDOFF.c = Object.assign(document.createElement("canvas"), { width: 880, height: 660 })), ox = o.getContext("2d");
        ox.setTransform(1, 0, 0, 1, 0, 0); ox.clearRect(0, 0, 880, 660); ox.translate(-(SCX - 440), -(700 - 330)); try { hud(ox, { ...sc.hud, y: 700, out: d - (sc.hud.at ?? 0) }, hl, t); } catch (e) {} x.drawImage(o, -sw / 2, -sh / 2, sw, sh); });
      if (txt0) { const k = wallKind(sc) === "screen" ? "sign" : wallKind(sc); x.save(); x.font = "700 70px sans-serif"; const info = wallLines(x, txt0, WTX[k][2], 600); x.restore(); const bw = Math.min(760, info.w + 90), bh = info.lines.length * info.fs * 1.08 + 70;
        put(clamp(hx, bw / 2 + 90, W - bw / 2 - 90), cy - sh / 2 - 40 - bh / 2, (wy) => { wallFrame(x, k === "sign" ? "poster" : k, bw, bh, t, ol, wy, z); wallText(x, k === "sign" ? "poster" : k, info, lt - (sc.cap?.at ?? 0), t); }); }
      return; }
    const k = wallKind(sc), blk = sc.fx?.includes("black"), maxW = blk ? 780 : k === "sign" || k === "screen" ? 600 : 520; x.save(); const info = wallLines(x, txt0, WTX[k][2], maxW); x.restore();
    const bw = Math.min(maxW + 60, Math.max(360, info.w + 100)), bh = info.lines.length * info.fs * 1.08 + 90, cx = blk ? W / 2 : clamp(side, bw / 2 + 80, W - bw / 2 - 80), cy = blk ? 720 : 300 + bh / 2;
    put(cx, cy, (wy) => { wallFrame(x, k, bw, bh, t, ol, wy, z); wallText(x, k, info, lt - (sc.cap?.at ?? 0), t); }); }
  function drawScene(x, L, si, t) { FMT = FMTS[L.fmt] ? L.fmt : "kino";
    const sc = L.scenes[si], lt = t - sc.t0, d = sc.t1 - sc.t0, tm = sc.time || "day", place = PLACES[sc.place] ? sc.place : "room";
    const hero = sc.cast?.find((c) => c.who === "hero") || sc.cast?.[0];
    // перший прохід — знайти голову героя для камери
    let H0 = null; if (hero && WHO[hero.who]?.pet) { const s = castState(sc, hero, lt, d, 0), S = (BREED[hero.breed] || BREED.labrador).S; H0 = { head: [s.X + S * .7 * s.f, s.Y - S * 1.05], r: S * .27, h: S * 1.4 }; } else if (hero) { const s = castState(sc, hero, lt, d, 0); H0 = { head: [s.X, s.Y - (WHO[hero.who]?.s || 1) * 720 * .94], r: 85, h: 720 * (WHO[hero.who]?.s || 1) }; }
    const cam = camOf(sc, lt, d, H0);
    x.save(); x.translate(W / 2, H / 2); x.scale(cam.z, cam.z); x.translate(-cam.fx, -cam.fy);
    x.drawImage(bgOf(place, tm, sc.seed || 1, cam.z > 1.6), 0, 0);
    const T = TIME[tm] || TIME.day, Lp = PLACES[place].light;
    // промені світла
    if (["kino", "whatif", "pastel", "retro", "mono", "golden", "clay", "cine", "noir"].includes(FMT) && Lp && tm !== "night") { x.save(); x.globalCompositeOperation = "screen"; for (let i = 0; i < 4; i++) { const a = .1 + .05 * Math.sin(t * .7 + i * 2), X0 = Lp[0] - 160 + i * 120, g = x.createLinearGradient(X0, Lp[1], X0 + 700, Lp[1] + 1300); g.addColorStop(0, T.ray + a + ")"); g.addColorStop(1, T.ray + "0)"); x.fillStyle = g; x.beginPath(); x.moveTo(X0, Lp[1]); x.lineTo(X0 + 90, Lp[1]); x.lineTo(X0 + 760, Lp[1] + 1400); x.lineTo(X0 + 540, Lp[1] + 1400); x.fill(); } x.restore(); }
    // fx black — «чорний екран»: хук-текст на порожній темряві (герой, якщо є, лишається видимим)
    if (sc.fx?.includes("black")) { x.fillStyle = "#050507"; x.fillRect(-W, -H, W * 3, H * 3); }
    { const c0 = camOf(sc, 0, d, H0); drawWall(x, sc, lt, d, t, c0, H0 ? (H0.head[0] - c0.fx) * c0.z + W / 2 : null); }
    // люди
    const heads = {}; (sc.cast || []).forEach((c, i) => { const s = castState(sc, c, lt, d, i); const h = 720 * (c.scale || 1); const talk = c.who === "hero" && !L.silent && (L.words.some((w) => w.s <= t && w.e >= t));
      if (WHO[c.who]?.pet) { heads[i] = petDraw(x, s.X, s.Y, { breed: c.breed || (c.who === "cat" ? "ginger" : "labrador"), pose: s.moving ? (c.pose === "run" ? "run" : "walk") : c.pose, face: c.face, f: s.f, seed: i * 5 + si, rim: tm === "night" ? "#8fa0ff" : T.tint }, lt); return; }
      if (i === 0 && sc.crowd > 0) drawCrowd(x, sc, L, lt, t, s.X);
      if (c.who === "shadow") { heads[i] = shadowFig(x, s, c, lt, d, t); return; }
      heads[i] = figure(x, s.X, s.Y, s.P, { who: c.who || "man", key: i, skin: c.who === "hero" ? L.hero.skin : c.skin, hair: c.who === "hero" ? L.hero.hair : undefined, hairC: c.who === "hero" ? L.hero.hairC : undefined, beard: c.who === "hero" ? L.hero.beard : undefined, col: c.who === "hero" ? L.hero.col : c.col || ["teal", "coral", "purple", "blue", "green"][i % 5], acc: c.who === "hero" ? L.hero.acc : c.acc, face: c.face || "calm", f: s.f, h, rim: tm === "night" ? "#8fa0ff" : T.tint, seed: i * 3 + si, talk: talk && c.face !== "shock" }, lt); });
    // мітки над головами вимкнено: числа й слова — лише в самому світі (дошка/екран/вивіска)
    // предмети в руці — у світі; решта — поверх кадру, щоб не губились на крупних планах
    const hi = (sc.cast || []).findIndex((c) => c.who === "hero"), drawProp = (p, i, X, Y, k) => { const pl = lt - (p.at ?? 0); if (pl < 0) return; const s = (p.s || 1) * back(pl / .4);
      x.save(); x.translate(X, Y + (k ? 0 : Math.sin(t * 1.6 + i) * 8)); x.scale(k || 1, k || 1); if (PROPS[p.k]) PROPS[p.k](x, s, { ...p, lt: pl }, t); else drawIcon(x, p.q || p.k, s, p.c); x.restore(); };
    (sc.props || []).forEach((p, i) => { if (!p.hold) return; const hand = heads[hi >= 0 ? hi : 0]?.hand; if (hand) drawProp(p, i, hand[0], hand[1] - 26, .62); });
    // пил у світлі
    x.save(); for (let i = 0; i < (KN() ? (STYL[FMT]?.bg === "grey" ? 0 : 46) : 0); i++) { const X = (rnd(i, 31) * W + t * (8 + rnd(i, 32) * 14)) % W, Y = (rnd(i, 33) * H * .8 + Math.sin(t * .5 + i) * 40 + t * 6) % (H * .85); x.fillStyle = FMT === "noir" ? `rgba(255,${190 + rnd(i, 36) * 50 | 0},110,${.25 + rnd(i, 34) * .5})` : `rgba(255,250,235,${(.15 + rnd(i, 34) * .35) * (place === "space" ? .5 : 1)})`; x.beginPath(); x.arc(X, Y, 1.6 + rnd(i, 35) * 2.8, 0, 7); x.fill(); } x.restore();
    x.restore();
    const hh = heads[hi >= 0 ? hi : 0], tight = cam.z > 1.5 && hh, hsx = hh ? (hh.head[0] - cam.fx) * cam.z + W / 2 : W / 2;
    (sc.props || []).forEach((p, i) => { if (p.hold && hh) return; if (tight) drawProp(p, i, hsx > W / 2 ? W * .24 : W * .76, H * .64, .8); else drawProp(p, i, (p.x ?? .72) * W, (p.y ?? .4) * H, 0); });
    const scr = (q) => [(q[0] - cam.fx) * cam.z + W / 2, (q[1] - cam.fy) * cam.z + H / 2];
    // fx spot — промінь/пляма світла на героя, навколо темрява (самотність, усвідомлення)
    if (sc.fx?.includes("spot") && hh) { const [sx, sy] = scr(hh.head), a = clamp(lt / .6), R = 520 * Math.max(.8, cam.z * .8); x.save(); const g = x.createRadialGradient(sx, sy + 260, R * .25, sx, sy + 260, R * 1.25); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, `rgba(0,0,0,${.88 * a})`); x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = "screen"; const g2 = x.createLinearGradient(sx, 0, sx, sy + 500); g2.addColorStop(0, `rgba(255,244,210,${.16 * a})`); g2.addColorStop(1, "rgba(255,244,210,0)"); x.fillStyle = g2; x.beginPath(); x.moveTo(sx - 70, 0); x.lineTo(sx + 70, 0); x.lineTo(sx + 330, sy + 520); x.lineTo(sx - 330, sy + 520); x.fill(); x.restore(); }
    // репліки персонажів (say): у тіні — рожево-червоний шепіт, що тремтить; у людей — білий бабл
    (sc.cast || []).forEach((c, i) => { if (!(c.say || c.think) || !heads[i] || WHO[c.who]?.pet) return; const sl = lt - .25 - i * .35; if (sl <= 0) return; const [hx, hy] = scr(heads[i].head), r = heads[i].r * cam.z, a = clamp(sl / .2) * clamp((d - lt) / .2), q = c.say || c.think, th = !c.say;
      x.save(); x.globalAlpha = a;
      if (c.who === "shadow") { const col = (SHGLOW[c.glow] || SHGLOW.red)[1], sz = 92, X = clamp(hx + (hx > W / 2 ? -r * .3 : r * .3), 300, W - 300), Y = Math.max(300, hy - r * 1.8); x.font = `italic 700 ${sz}px "${HANDF}", cursive`; x.textAlign = "center"; x.textBaseline = "middle";
        x.shadowColor = col; x.shadowBlur = 22; x.fillStyle = col; const w = x.measureText(q).width, k = Math.min(1, (W - 120) / w); x.translate(X + Math.sin(t * 25) * 2, Y + Math.cos(t * 21) * 2); x.scale(k, k); x.fillText(q, 0, 0); }
      else { const sz = 46; x.font = `800 ${sz}px "${FONT}", system-ui, sans-serif`; const w = Math.min(W - 160, x.measureText(q).width + 56), hb = 92, X = clamp(hx - w / 2, 60, W - 60 - w), Y = Math.max(200, hy - r * 1.4 - hb - 40), pop = 1 + (1 - eout(sl / .25)) * .25;
        x.translate(X + w / 2, Y + hb / 2); x.scale(pop, pop); x.translate(-(X + w / 2), -(Y + hb / 2)); x.fillStyle = "#fff"; rr(x, X, Y, w, hb, th ? 46 : 28); x.fill();
        if (th) { [[.55, 18], [.82, 11]].forEach(([u, rd]) => { x.beginPath(); x.arc(lerp(X + w / 2, hx, u), lerp(Y + hb, hy - r * 1.1, u), rd, 0, 7); x.fill(); }); }
        else { x.beginPath(); x.moveTo(clamp(hx - 20, X + 30, X + w - 60), Y + hb - 2); x.lineTo(clamp(hx + 20, X + 70, X + w - 20), Y + hb - 2); x.lineTo(clamp(hx, X + 40, X + w - 30), Y + hb + 34); x.fill(); }
        x.fillStyle = "#15131f"; x.textAlign = "center"; x.textBaseline = "middle"; const k = Math.min(1, (w - 40) / x.measureText(q).width); x.translate(X + w / 2, Y + hb / 2 + 2); x.scale(k, k); x.fillText(q, 0, 0); }
      x.restore(); });
    // HUD поверх (без зуму камери, з легким паралаксом)
    // HUD тепер показується на екрані всередині сцени (drawWall), не поверх кадру
    // кольорокорекція, віньєтка
    x.save(); x.globalCompositeOperation = "soft-light"; x.globalAlpha = FMT === "kino" ? .28 : FMT === "whatif" ? .12 : 0; x.fillStyle = T.grade; x.fillRect(0, 0, W, H); x.restore();
    // написи (cap) і плашки (loc) малюються в світі — drawWall
    if (sc.fx?.length) fxOver(x, sc, lt, d, t);
    // плашка часу/місця («СУБОТА • 21:14», «6 ГОДИН ТОМУ»)
    if (sc.loc && false) { const a = clamp(lt / .2) * clamp((d - lt) / .25), sl = (1 - eout(lt / .3)) * -60; if (a > 0) { x.save(); x.globalAlpha = a; x.font = `900 40px "${FONT}", system-ui, sans-serif`; const q = sc.loc.toUpperCase(), w = x.measureText(q).width + 56; x.fillStyle = "#d8283a"; rr(x, 60, 270 + sl, w, 72, 16); x.fill(); x.fillStyle = "#fff"; x.textAlign = "left"; x.textBaseline = "middle"; x.fillText(q, 88, 308 + sl); x.restore(); } }
  }
  // ефекти поверх кадру: дощ, тріщини скла, білий спалах
  function fxOver(x, sc, lt, d, t) { const f = sc.fx;
    if (f.includes("rain")) { x.save(); x.strokeStyle = "rgba(170,195,220,.38)"; x.lineWidth = 3; x.lineCap = "round"; x.beginPath(); for (let i = 0; i < 140; i++) { const sp = 1500 + rnd(i, 61) * 700, X0 = rnd(i, 62) * (W + 200) - 100, Y0 = ((rnd(i, 63) * H + t * sp) % (H + 120)) - 60, L2 = 34 + rnd(i, 64) * 30; x.moveTo(X0, Y0); x.lineTo(X0 - L2 * .12, Y0 + L2); } x.stroke(); x.fillStyle = "rgba(8,12,24,.14)"; x.fillRect(0, 0, W, H); x.restore(); }
    if (f.includes("crack")) { const p = clamp((lt - .15) / .25); if (p > 0) { const cx = W * .5, cy = H * .42; x.save(); x.strokeStyle = "rgba(255,255,255,.85)"; x.lineWidth = 3.5; x.shadowColor = "rgba(0,0,0,.6)"; x.shadowBlur = 6;
        for (let b = 0; b < 9; b++) { let a0 = b / 9 * Math.PI * 2 + rnd(b, 71) * .5, X = cx, Y = cy, n = Math.floor(6 * p) + 1; x.beginPath(); x.moveTo(X, Y); for (let k = 0; k < n; k++) { a0 += (rnd(b * 9 + k, 72) - .5) * .7; const st = 70 + rnd(b * 9 + k, 73) * 110; X += Math.cos(a0) * st; Y += Math.sin(a0) * st; x.lineTo(X, Y); } x.stroke(); }
        x.lineWidth = 2; for (let r0 = 1; r0 <= 3; r0++) { x.beginPath(); for (let k = 0; k <= 12; k++) { const a1 = k / 12 * Math.PI * 2, rr2 = (90 + r0 * 110) * p * (.85 + rnd(k + r0 * 13, 74) * .3); k ? x.lineTo(cx + Math.cos(a1) * rr2, cy + Math.sin(a1) * rr2) : x.moveTo(cx + Math.cos(a1) * rr2, cy + Math.sin(a1) * rr2); } x.globalAlpha = .45; x.stroke(); } x.restore(); } }
    if (f.includes("confetti")) { const C = ["#ffc93c", "#ff3b4a", "#5bb2e8", "#3ee07f", "#ff5fa8"]; x.save(); for (let i = 0; i < 90; i++) { const st = rnd(i, 51) * .5, l2 = lt - st; if (l2 < 0) continue; const X = rnd(i, 52) * W + Math.sin(l2 * 3 + i) * 40, Y = -40 + l2 * (380 + rnd(i, 53) * 420) + l2 * l2 * 120; if (Y > H + 40) continue;
        x.save(); x.translate(X, Y); x.rotate(l2 * (3 + rnd(i, 54) * 5) + i); x.scale(1, Math.abs(Math.cos(l2 * 6 + i))); x.fillStyle = C[i % 5]; x.fillRect(-9, -14, 18, 28); x.restore(); } x.restore(); }
    if (f.includes("flash")) { const a = 1 - clamp(lt / .22); if (a > 0) { x.fillStyle = `rgba(255,255,255,${a * .92})`; x.fillRect(0, 0, W, H); } } }
  const SHGLOW = { red: ["rgba(255,30,30,.95)", "#ff2a2a"], pink: ["rgba(255,42,133,.95)", "#ff2a85"], purple: ["rgba(171,71,188,.95)", "#d05ce3"] };
  function premPost(x, t, L) { x.save();
    if (FMT === "cine") { x.globalCompositeOperation = "screen"; const fy = H * .3 + Math.sin(t * .3) * 40, g = x.createLinearGradient(0, fy, 0, fy + 1); const s1 = x.createRadialGradient(W * .74, fy, 0, W * .74, fy, 520); s1.addColorStop(0, "rgba(255,200,140,.32)"); s1.addColorStop(1, "rgba(255,160,90,0)"); x.fillStyle = s1; x.fillRect(0, 0, W, H);
      const st = x.createLinearGradient(0, 0, W, 0); st.addColorStop(0, "rgba(80,170,255,0)"); st.addColorStop(.74, "rgba(120,200,255,.42)"); st.addColorStop(1, "rgba(80,170,255,0)"); x.fillStyle = st; x.fillRect(0, fy - 3, W, 6); x.globalAlpha = .5; x.fillRect(0, fy - 14, W, 28); x.globalAlpha = 1;
      [.55, .4, .25].forEach((u, i) => { x.fillStyle = `rgba(${i ? 255 : 120},${i ? 190 : 200},${i ? 120 : 255},.12)`; x.beginPath(); x.arc(lerp(W * .74, W * .3, u * 1.6), lerp(fy, H * .7, u * 1.6), 30 + i * 22, 0, 7); x.fill(); });
      x.globalCompositeOperation = "multiply"; x.fillStyle = "rgba(255,240,225,1)"; x.fillRect(0, 0, W, H); }
    else if (FMT === "aurora") { x.globalCompositeOperation = "soft-light"; const a = t * .25, g = x.createLinearGradient(W * (.5 + .5 * Math.cos(a)), 0, W * (.5 - .5 * Math.cos(a)), H); g.addColorStop(0, "rgba(255,150,210,.35)"); g.addColorStop(1, "rgba(120,170,255,.35)"); x.fillStyle = g; x.fillRect(0, 0, W, H); }
    else if (FMT === "cut") { x.globalCompositeOperation = "multiply"; x.globalAlpha = .9; x.drawImage(paperTex("p50"), 0, 0, W, H); x.globalAlpha = 1; x.globalCompositeOperation = "soft-light"; x.globalAlpha = .16; x.drawImage(noiseTile(3), 0, 0, W, H); }
    else if (FMT === "noir") { x.globalCompositeOperation = "source-over"; const v = x.createRadialGradient(W / 2, H * .45, H * .25, W / 2, H / 2, H * .72); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,.55)"); x.fillStyle = v; x.fillRect(0, 0, W, H); }
    x.restore(); }
  function post(x, t) { const g = x.createRadialGradient(W / 2, H * .48, H * .28, W / 2, H * .5, H * .78); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(8,6,20,.55)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const gr = grain(), ox = Math.floor(rnd(Math.floor(t * 24), 4) * 256), oy = Math.floor(rnd(Math.floor(t * 24), 5) * 256); x.save(); x.globalCompositeOperation = "overlay"; x.fillStyle = x.createPattern(gr, "repeat"); x.translate(-ox, -oy); x.fillRect(ox, oy, W, H); x.restore(); }
  const OFF = {};
  const off = (k) => { if (!OFF[k]) { OFF[k] = document.createElement("canvas"); OFF[k].width = W; OFF[k].height = H; } return OFF[k]; };
  function sceneAt(L, t) { let i = 0; while (i + 1 < L.scenes.length && L.scenes[i + 1].t0 <= t) i++; return i; }
  /* ---------- рекламна вставка YuVi: герой дістає телефон → наїзд на екран → пришвидшено «як робиться відео» і заробіток → заклик → екран летить на глядача й стає наступною сценою ---------- */
  const AD_DUR = 9.6, AD_KINDS = { none: "Без реклами", bio: "Посилання в шапці", comment: "Слово в коментарях" };
  // текст вставки (власник змінює в «Студії вставки»; лежить у сховищі promo/ad.json разом із кадрами запису екрана)
  const AD0 = { v: 0, pack: null, speed: 1.35, outro: "І так, 2D-анімаційні відео — це зараз нова ніша, на якій автори вже заробляють тисячі доларів.",
    bridge: { in: "І тут я розумію: якщо нічого не зробити зараз — буде пізно. Тож дістаю телефон.", out: "А тепер — що було далі." },
    beats: [
      { id: "topic", n: "Крок 1 · тема", say: "Відкриваю студію, пишу тему —", mock: [0, 2.9] },
      { id: "make", n: "Крок 2 · текст і редактор", say: "нейромережа пише текст, озвучує, ставить сцени й музику. Кілька хвилин — і відео готове.", mock: [2.9, 4.9] },
      { id: "earn", n: "Крок 3 · заробіток", say: "А за кожного, хто прийде за моїм посиланням і оплатить, — я отримую половину його першої оплати.", mock: [4.9, 6.1] },
      { id: "cta", n: "Заклик", say: { bio: "Спробувати можна безкоштовно — посилання в шапці профілю.", comment: "Хочеш спробувати безкоштовно — напиши «{WORD}» в коментарях, і я надішлю посилання." }, mock: [6.1, 7.2] }] };
  let AD = JSON.parse(JSON.stringify(AD0)), ADF = {}, ADB = null, ADL = null;
  function mergeAd(j) { const A = JSON.parse(JSON.stringify(AD0)); if (!j) return A;
    (j.beats || []).forEach((b) => { const t = A.beats.find((z) => z.id === b?.id); if (!t || !b.say) return; if (t.id === "cta") { if (b.say.bio) t.say.bio = String(b.say.bio).trim(); if (b.say.comment) t.say.comment = String(b.say.comment).trim(); } else if (typeof b.say === "string" && b.say.trim()) t.say = b.say.trim(); });
    if (j.bridge?.in) A.bridge.in = String(j.bridge.in).trim(); if (j.bridge?.out) A.bridge.out = String(j.bridge.out).trim(); A.pack = j.pack || null; A.v = j.v || 0; if (+j.speed >= 1 && +j.speed <= 1.7) A.speed = +j.speed; if (j.outro) A.outro = String(j.outro).trim(); return A; }
  const blobImg = (b) => { const im = new Image(); im.src = URL.createObjectURL(b); return im; };
  const promoBase = () => `${window.PROBKA_CONFIG?.url}/storage/v1/object/public/promo/`;
  // спершу — те, що власник зберіг у сховищі promo; кадри справжнього інтерфейсу за замовчуванням лежать на сайті (a/ad/)
  const siteAd = () => { try { return new URL("a/ad/", document.baseURI).href; } catch (e) { return "a/ad/"; } };
  async function getJson(u) { try { const r = await fetch(u); return r.ok ? await r.json() : null; } catch (e) { return null; } }
  function loadAd(force) { if (ADL && !force) return ADL;
    ADL = (async () => { try { const own = await getJson(promoBase() + "ad.json?t=" + Math.floor(Date.now() / 6e4)), def = await getJson(siteAd() + "ad.json?v=" + (window.YV_BUILD || "1"));
        const A = mergeAd(own || def), F2 = {}; let B2 = null, base = own?.pack ? promoBase() : siteAd(); if (!A.pack && def?.pack) A.pack = def.pack;
        if (A.pack?.file) { B2 = await (await fetch(base + A.pack.file)).arrayBuffer(); const jobs = [];
          for (const [id, fr] of Object.entries(A.pack.frames || {})) F2[id] = (fr.r || []).map(([o, l]) => { const im = blobImg(new Blob([B2.slice(o, o + l)], { type: fr.t || "image/jpeg" })); jobs.push(im.decode ? im.decode().catch(() => {}) : 0); return im; });
          await Promise.all(jobs); }
        AD = A; ADF = F2; ADB = B2; } catch (e) { console.warn("ad load", e); ADL = null; } return AD; })();
    return ADL; }
  const adDur = (L) => L.adD || AD_DUR;
  const wordCase = (w) => { w = String(w || "АНІМАЦІЯ").trim(); return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); };
  const adSay = (b, kind, word) => String(typeof b.say === "object" ? (b.say[kind] || b.say.bio) : b.say).replace(/\{WORD\}/g, wordCase(word));
  const adParts = (kind, word, br) => [{ id: "in", t: br.in }, ...AD.beats.map((b) => ({ id: b.id, t: adSay(b, kind, word) })), { id: "out", t: br.out }].filter((p) => p.t);
  // таймінг кроків усередині озвученої вставки: від довжини фраз (голос рівний, тож точності вистачає)
  function adTiming(parts, buf) { const SR = E().SR, LEAD = .15, D = buf.length / SR + LEAD + .25; let s0 = 0, s1 = buf.length - 1; while (s0 < buf.length && Math.abs(buf[s0]) < .02) s0++; while (s1 > s0 && Math.abs(buf[s1]) < .02) s1--;
    const a0 = LEAD + s0 / SR, a1 = LEAD + s1 / SR, wt = parts.map((p) => p.t.replace(/\s+/g, " ").length + 8), tot = wt.reduce((a, b) => a + b, 0), seg = {}, words = []; let c = a0;
    parts.forEach((p, i) => { const d = (a1 - a0) * wt[i] / tot, ws = p.t.split(/\s+/).filter(Boolean), wl = ws.reduce((a, w) => a + w.length + 2, 0) || 1; seg[p.id] = [c, c + d]; let q = c; ws.forEach((w) => { const dd = Math.max(.05, d - .25) * (w.length + 2) / wl; words.push({ w, s: q, e: q + dd * .92 }); q += dd; }); c += d; });
    seg.in = [0, seg.in ? seg.in[1] : 1.2]; seg.out = [seg.out ? seg.out[0] : D - 1, D]; return { D, seg, words }; }
  function adTmDef(D) { const seg = { in: [0, 1.2] }, span = D - 2.2; let c = 1.2; AD.beats.forEach((b) => { const d = span * (b.mock[1] - b.mock[0]) / 7.2; seg[b.id] = [c, c + d]; c += d; }); seg.out = [c, D]; return { seg }; }
  async function adVoice(src) { if (src?.tts?.voice) return src.tts.voice; if (DRAFT.vid) return DRAFT.vid === "clone" ? { kind: "clone" } : { kind: "preset", id: DRAFT.vid };
    try { const V = (await SRV.voices()) || []; if (V[0]?.id) return { kind: "preset", id: V[0].id }; } catch (e) {} return null; }
  // місточок до реклами й фраза повернення — під конкретне відео
  // реклама як частина сюжету: на цікавому моменті в історії виникає задача — оповідач розв'язує її через YuVi; AI пише всі репліки під конкретне відео
  async function adBridge(L, k) { const br = { ...AD.bridge }, before = L.words.slice(Math.max(0, k - 60), k).map((w) => w.w).join(" "), after = L.words.slice(k, k + 30).map((w) => w.w).join(" "), tp = (id) => adSay(AD.beats.find((b) => b.id === id), "bio", "");
    try { const r = await Promise.race([sample.json(`Ти — сценарист коротких відео. У відео органічно вшита вставка про студію, де за кілька хвилин роблять такі анімаційні відео. Вставка — частина сюжету, а не «а зараз реклама».
Текст відео до місця вставки: «…${before}»
Текст відразу після вставки: «${after}…»
${L.topic ? `Тема відео: ${L.topic}\n` : ""}Після місточка звучить (не змінюй): «${L.core || AD.beats.map((b) => adSay(b, "bio", "Анімація")).join(" ")}»
Напиши дві репліки для того самого голосу:
in — місточок перед вставкою, 1–2 речення, до 12 слів. Формула: [проблема чи задача на найцікавішому місці історії] → рішення, яке природно веде до фрази «${String(L.core || "Відкриваю студію").split(/\s+/).slice(0, 5).join(" ")}…» (зазвичай — «тож дістаю телефон» або «тож роблю про це відео»). Якщо в базі знань є папка «adlead» (підводки до реклами) — бери прийоми звідти. Приклади: «Кричати марно. Треба, щоб про нього дізналось усе місто — тож дістаю телефон.» / «На ремонт треба двадцять тисяч, а зарплата через місяць. Тож дістаю телефон.»
out — повернення в історію після вставки, до 6 слів, з інтригою і логічно перед «${after.split(/\s+/).slice(0, 8).join(" ")}…». Приклади: «Але знайшовся він зовсім не завдяки відео.» / «А тепер — що сказав майстер.»
Теперішній час від першої особи («дістаю», «розумію») — щоб не було роду. Заборонено: назви сервісів, «реклама», «до речі», «спершу», «поки», «зараз покажу». Жива розмовна українська, без емодзі. Відповідай тільки JSON {"in":"…","out":"…"}`, { cache: false, max: 400, kb: ["adlead", "story", "hook"] }), new Promise((_, j) => setTimeout(() => j(new Error("timeout")), 18000))]);
      const ok = (v, n) => { v = String(v || "").replace(/\s+/g, " ").trim(); return v && v.split(" ").length <= n && !/реклам|yuvi/i.test(v) ? v : ""; };
      const i = ok(r?.in, 20), o = ok(r?.out, 10); if (i) br.in = L.core || /телефон/i.test(i) ? i : i.replace(/[.!…]*$/, ". Тож дістаю телефон."); if (o) br.out = o; } catch (e) { console.warn("ad bridge", e); }
    return br; }
  // пришвидшення голосу без зміни висоти (WSOLA)
  function tstretch(x, r) { if (!(r > 1.01)) return x; const SR = E().SR, N = Math.round(SR * .04) & ~1, H = N / 2, tol = Math.round(SR * .01), w = new Float32Array(N); for (let i = 0; i < N; i++) w[i] = .5 - .5 * Math.cos(2 * Math.PI * i / N);
    const fr = Math.floor((x.length - N - tol - H) / (H * r)); if (fr < 4) return x; const y = new Float32Array(fr * H + N); let prev = 0;
    for (let k = 0; k < fr; k++) { const ideal = Math.round(k * H * r); let best = ideal; if (k > 0) { const nat = prev + H; let bc = -Infinity; for (let d = -tol; d <= tol; d += 2) { const q = ideal + d; if (q < 0 || q + N > x.length || nat + N > x.length) continue; let c = 0; for (let i = 0; i < N; i += 4) c += x[q + i] * x[nat + i]; if (c > bc) { bc = c; best = q; } } }
      const o = k * H; for (let i = 0; i < N; i++) y[o + i] += x[best + i] * w[i]; prev = best; }
    return y; }
  const PH = { cx: W / 2, cy: 1080, w: 620, h: 1240 }, SCR = { w: 584, h: 1204, r: 66 };
  function phoneShell(x, cx, cy, s) { x.save(); x.translate(cx, cy); x.scale(s, s);
    x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = 60; x.shadowOffsetY = 30; x.fillStyle = "#1b1a20"; rr(x, -PH.w / 2, -PH.h / 2, PH.w, PH.h, 92); x.fill(); x.shadowColor = "transparent";
    x.strokeStyle = "#4a4855"; x.lineWidth = 6; rr(x, -PH.w / 2 + 3, -PH.h / 2 + 3, PH.w - 6, PH.h - 6, 90); x.stroke(); x.restore(); }
  function phoneClip(x, cx, cy, s) { x.translate(cx, cy); x.scale(s, s); rr(x, -SCR.w / 2, -SCR.h / 2, SCR.w, SCR.h, SCR.r); x.clip(); x.translate(-SCR.w / 2, -SCR.h / 2); }
  const uiT = (x, t, X, Y, sz, col = "#f5f5f7", w = 700, al = "left") => { x.font = `${w} ${sz}px "${FONT}", system-ui, sans-serif`; x.fillStyle = col; x.textAlign = al; x.textBaseline = "middle"; x.fillText(t, X, Y); };
  const uiBtn = (x, X, Y, w, h, t, main, hl) => { x.fillStyle = main ? "#f5f5f7" : "rgba(255,255,255,.08)"; rr(x, X, Y, w, h, 26); x.fill(); if (!main) { x.strokeStyle = "rgba(255,255,255,.16)"; x.lineWidth = 2; rr(x, X, Y, w, h, 26); x.stroke(); } uiT(x, t, X + w / 2, Y + h / 2, 30, main ? "#0b0b0d" : "#f5f5f7", 800, "center"); if (hl) { x.strokeStyle = `rgba(219,232,107,${hl})`; x.lineWidth = 6; rr(x, X - 6, Y - 6, w + 12, h + 12, 30); x.stroke(); } };
  const tap = (x, X, Y, p) => { if (p < 0 || p > 1) return; x.save(); x.globalAlpha = (1 - p) * .9; x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.arc(X, Y, 34 + p * 30, 0, 7); x.fill(); x.strokeStyle = "#fff"; x.lineWidth = 4; x.beginPath(); x.arc(X, Y, 50 + p * 60, 0, 7); x.stroke(); x.restore(); };
  // екрани застосунку (пришвидшено); p — 0…1 усередині сегмента
  const AD_SEG = [[0, .9], [.9, 1.7], [1.7, 2.9], [2.9, 3.7], [3.7, 4.9], [4.9, 6.1], [6.1, 7.2]];
  function adApp(x, L, q, kind) { const w = SCR.w, h = SCR.h, seg = AD_SEG.findIndex(([a, b]) => q >= a && q < b), [a0, a1] = AD_SEG[Math.max(0, seg)], p = clamp((q - a0) / (a1 - a0));
    x.fillStyle = "#0b0b0d"; x.fillRect(0, 0, w, h); uiT(x, "22:53", 60, 46, 26, "#f5f5f7", 700); x.fillStyle = "#000"; rr(x, w / 2 - 90, 20, 180, 52, 26); x.fill();
    if (seg === 0) { uiT(x, "Студія", 40, 140, 44, "#f5f5f7", 900); uiT(x, "Інструменти", 40, 210, 30, "#a1a1aa", 700);
      ["Рілс маркером", "Анімація лініями", "Кіно-анімація", "YouTube-анімація"].forEach((n, i) => { const Y = 260 + i * 150, on = i === 2; x.fillStyle = on ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.05)"; rr(x, 30, Y, w - 60, 128, 28); x.fill(); if (on && p > .55) { x.strokeStyle = "#dbe86b"; x.lineWidth = 5; rr(x, 30, Y, w - 60, 128, 28); x.stroke(); }
        x.fillStyle = ["#e3c44a", "#79a7a6", "#8b79bb", "#cf8b6d"][i]; rr(x, 52, Y + 24, 80, 80, 20); x.fill(); uiT(x, n, 156, Y + 64, 32, "#f5f5f7", 800); });
      tap(x, w / 2, 260 + 2 * 150 + 64, (p - .45) / .5); }
    if (seg === 1) { uiT(x, "Кіно-анімація", 40, 130, 38, "#f5f5f7", 900); uiT(x, "Герой", 40, 210, 28, "#a1a1aa", 700);
      Object.values(HOOD).slice(0, 7).forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc(70 + i * 72, 270, 28, 0, 7); x.fill(); if (i === 0) { x.strokeStyle = "#fff"; x.lineWidth = 4; x.stroke(); } });
      x.save(); x.translate(w / 2, 720); figure(x, 0, 0, POSE.cheer, { who: "hero", col: L.hero?.col || "yellow", acc: L.hero?.acc, face: "happy", f: 1, h: 340 }, q * 3); x.restore();
      uiT(x, "Тварина: " + (BREED[L.pet]?.n || "без тварини"), 40, 800, 28, "#a1a1aa", 700); uiBtn(x, 30, h - 170, w - 60, 100, "Далі", true, p > .6 ? 1 - (p - .6) / .4 : 0); tap(x, w / 2, h - 120, (p - .55) / .45); }
    if (seg === 2) { uiT(x, "Про що відео?", 40, 130, 32, "#f5f5f7", 800); x.fillStyle = "rgba(255,255,255,.06)"; rr(x, 30, 170, w - 60, 90, 22); x.fill();
      const topic = String(L.topic || "Як заробляти на відео без підписників").slice(0, 34), n = Math.floor(topic.length * clamp(p / .35)); uiT(x, topic.slice(0, n) + (p < .35 && Math.floor(q * 8) % 2 ? "|" : ""), 56, 215, 26, "#f5f5f7", 500);
      uiBtn(x, 30, 290, w - 60, 90, "✨ Написати текст", false, p > .38 && p < .5 ? 1 : 0); tap(x, w / 2, 335, (p - .38) / .2);
      const lines = (L.words || []).map((q2) => q2.w).join(" ").match(/.{1,30}(\s|$)/g) || [], k = Math.floor(lines.length * clamp((p - .5) / .45));
      lines.slice(0, Math.min(k, 13)).forEach((ln, i) => uiT(x, ln.trim(), 50, 440 + i * 46, 25, "#e4e4e7", 500)); }
    if (seg === 3) { const v = Math.round(eout(p) * 100), R = 130; uiT(x, "Режисую сцени…", w / 2, h / 2 + 220, 32, "#e4e4e7", 700, "center");
      x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = 16; x.beginPath(); x.arc(w / 2, h / 2, R, 0, 7); x.stroke(); const g = x.createLinearGradient(w / 2 - R, 0, w / 2 + R, 0); g.addColorStop(0, "#0a84ff"); g.addColorStop(1, "#bf5af2"); x.strokeStyle = g; x.lineCap = "round"; x.beginPath(); x.arc(w / 2, h / 2, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v / 100); x.stroke();
      uiT(x, v + "%", w / 2, h / 2, 64, "#fff", 900, "center"); }
    if (seg === 4) { uiT(x, "Кіно-анімація", 40, 120, 30, "#f5f5f7", 800); const pw = 330, phh = pw * 16 / 9, px = (w - pw) / 2, py = 160;
      const m = off("m"), mx = m.getContext("2d"); const si = Math.min(L.scenes.length - 1, Math.floor(p * 3) % Math.max(1, L.scenes.filter((z) => !z.ad).length)); const real = L.scenes.filter((z) => !z.ad), sc = real[si] || real[0];
      if (sc) { drawScene(mx, L, L.scenes.indexOf(sc), sc.t0 + .8 + p); x.save(); rr(x, px, py, pw, phh, 24); x.clip(); x.drawImage(m, px, py, pw, phh); x.restore(); }
      for (let i = 0; i < 6; i++) { x.fillStyle = i === si ? "#f5f5f7" : "rgba(255,255,255,.18)"; rr(x, 40 + i * 86, py + phh + 26, 70, 110, 12); x.fill(); }
      const saved = p > .7; uiBtn(x, 30, h - 170, w - 60, 100, saved ? "✓ Збережено" : "Зберегти відео", true, p > .55 && p < .75 ? 1 : 0); tap(x, w / 2, h - 120, (p - .55) / .3); }
    if (seg === 5) { uiT(x, "Заробіток", 40, 140, 36, "#a1a1aa", 800); const sum = Math.round(eout(p) * 1240); uiT(x, sum.toLocaleString("uk-UA") + " грн", 40, 230, 76, "#f5f5f7", 900);
      [["Перша оплата за твоїм посиланням", "+50%"], ["Щомісяця з кожної наступної", "+25%"], ["Друг оплатив план", "+200 грн"], ["Ще один друг", "+350 грн"]].forEach(([a, b], i) => { const ap = clamp((p - i * .18) / .2); if (ap <= 0) return; x.globalAlpha = ap;
        x.fillStyle = "rgba(127,224,176,.1)"; rr(x, 30, 330 + i * 130, w - 60, 110, 22); x.fill(); uiT(x, a, 56, 385 + i * 130, 24, "#e4e4e7", 600); uiT(x, b, w - 56, 385 + i * 130, 30, "#7fe0b0", 900, "right"); x.globalAlpha = 1; });
      uiT(x, "* приклад; дохід залежить від тебе", 40, h - 70, 22, "#71717a", 500); }
    if (seg === 6 || seg < 0) { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#1c1840"); g.addColorStop(1, "#3a2f66"); x.fillStyle = g; x.fillRect(0, 0, w, h);
      uiT(x, "Хочеш так само?", w / 2, h * .3, 46, "#fff", 900, "center");
      if (kind === "comment") { uiT(x, "Напиши в коментарях", w / 2, h * .42, 34, "#e4e4e7", 700, "center"); x.fillStyle = "#dbe86b"; rr(x, 60, h * .47, w - 120, 120, 30); x.fill(); const word = String(L.adWord || "АНІМАЦІЯ").toUpperCase().slice(0, 14); uiT(x, `«${word}»`, w / 2, h * .47 + 60, fitTxt(x, `«${word}»`, w - 170, 56), "#14121c", 900, "center"); uiT(x, "— надішлю посилання, спробуєш безкоштовно", w / 2, h * .62, 24, "#e4e4e7", 700, "center"); }
      else { uiT(x, "Посилання", w / 2, h * .42, 40, "#e4e4e7", 800, "center"); x.fillStyle = "#dbe86b"; rr(x, 60, h * .47, w - 120, 120, 30); x.fill(); uiT(x, "в шапці профілю ↑", w / 2, h * .47 + 60, 44, "#14121c", 900, "center"); uiT(x, "Спробувати — безкоштовно", w / 2, h * .62, 30, "#e4e4e7", 700, "center"); }
      x.save(); x.globalAlpha = .9; x.translate(w / 2, h * .8); figure(x, 0, 120, POSE.wave, { who: "hero", col: L.hero?.col || "yellow", face: "happy", f: 1, h: 300 }, q * 3); x.restore(); } }
  // екран телефона в момент lt: справжній запис екрана (кадри з promo) або намальований застосунок
  function adScreen(x, L, lt, kind, S) { const bs = AD.beats; let b = bs[0]; for (const z of bs) if (lt >= S[z.id][0]) b = z; const [a0, a1] = S[b.id], p = clamp((lt - a0) / Math.max(.1, a1 - a0));
    const fid = b.id === "cta" ? "cta_" + kind : b.id, fr = ADF[fid];
    if (fr?.length) { const im = fr[Math.min(fr.length - 1, Math.floor(p * fr.length))], sb = !!AD.pack?.frames?.[fid]?.sb, top = sb ? 86 : 0; x.fillStyle = "#0b0b0d"; x.fillRect(0, 0, SCR.w, SCR.h);
      if (im.complete && im.naturalWidth) { const hh = SCR.h - top, k = Math.max(SCR.w / im.naturalWidth, hh / im.naturalHeight); x.save(); x.beginPath(); x.rect(0, top, SCR.w, hh); x.clip(); x.drawImage(im, (SCR.w - im.naturalWidth * k) / 2, top + (hh - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k); x.restore(); }
      if (sb) { uiT(x, "22:53", 62, 48, 26, "#f5f5f7", 700); x.fillStyle = "#f5f5f7"; rr(x, SCR.w - 98, 37, 44, 22, 6); x.fill(); x.fillStyle = "#0b0b0d"; rr(x, SCR.w - 95, 40, 30, 16, 4); x.fill(); x.fillStyle = "#f5f5f7"; rr(x, SCR.w - 95, 40, 30, 16, 4); x.fill(); rr(x, SCR.w - 52, 44, 4, 8, 2); x.fill(); [0, 1, 2, 3].forEach((q) => { rr(x, SCR.w - 146 + q * 9, 54 - 5 - q * 4, 6, 7 + q * 4, 2); x.fill(); }); }
      x.fillStyle = "#000"; rr(x, SCR.w / 2 - 90, 20, 180, 52, 26); x.fill();
      if (b.id === "earn") { x.fillStyle = "rgba(0,0,0,.66)"; rr(x, 24, SCR.h - 112, SCR.w - 48, 62, 22); x.fill(); uiT(x, "* приклад; дохід залежить від тебе", SCR.w / 2, SCR.h - 81, 23, "#e4e4e7", 600, "center"); }
      if (b.id === "cta" && kind === "comment") { const word = `«${String(L.adWord || "АНІМАЦІЯ").toUpperCase().slice(0, 14)}»`; x.fillStyle = "#dbe86b"; rr(x, 40, SCR.h - 260, SCR.w - 80, 150, 30); x.fill(); uiT(x, "Напиши в коментарях", SCR.w / 2, SCR.h - 222, 28, "#14121c", 700, "center"); uiT(x, word, SCR.w / 2, SCR.h - 160, fitTxt(x, word, SCR.w - 130, 52), "#14121c", 900, "center"); }
      return; }
    adApp(x, L, b.mock[0] + p * (b.mock[1] - b.mock[0]) * .999, kind); }
  // реалістичний телефон (центр — у поточному початку координат); screen(q) малює вміст у координатах екрана
  function realPhone(x, s, screen, glare = 1) { const w = PH.w, h = PH.h, r = 92; x.save(); x.scale(s, s);
    x.save(); x.shadowColor = "rgba(0,0,0,.5)"; x.shadowBlur = 60; x.shadowOffsetY = 34; x.fillStyle = "#1a1a1e"; rr(x, -w / 2, -h / 2, w, h, r); x.fill(); x.restore();
    x.fillStyle = "#4b4b52"; [[-1, 230, 64], [-1, 330, 104], [-1, 452, 104], [1, 350, 150]].forEach(([sd, y, l]) => { rr(x, sd < 0 ? -w / 2 - 7 : w / 2 - 2, -h / 2 + y, 9, l, 4); x.fill(); });
    const g = x.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, "#9a9aa1"); g.addColorStop(.22, "#3b3b41"); g.addColorStop(.5, "#76767d"); g.addColorStop(.78, "#2d2d32"); g.addColorStop(1, "#85858c"); x.fillStyle = g; rr(x, -w / 2, -h / 2, w, h, r); x.fill();
    x.fillStyle = "#040405"; rr(x, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, r - 8); x.fill();
    x.save(); x.translate(-SCR.w / 2, -SCR.h / 2); rr(x, 0, 0, SCR.w, SCR.h, SCR.r); x.clip(); screen(x);
    if (glare > 0) { const gl = x.createLinearGradient(0, 0, SCR.w, SCR.h * .7); gl.addColorStop(0, "rgba(255,255,255,0)"); gl.addColorStop(.4, "rgba(255,255,255,0)"); gl.addColorStop(.5, `rgba(255,255,255,${.08 * glare})`); gl.addColorStop(.6, "rgba(255,255,255,0)"); x.fillStyle = gl; x.fillRect(0, 0, SCR.w, SCR.h); }
    x.restore(); x.strokeStyle = "rgba(255,255,255,.4)"; x.lineWidth = 2.5; rr(x, -w / 2 + 1.5, -h / 2 + 1.5, w - 3, h - 3, r - 1); x.stroke(); x.restore(); }
  const capL = (x, a, b, c, d, wd, col) => { x.strokeStyle = col; x.lineCap = "round"; x.lineWidth = wd; x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); };
  // рука персонажа (рукав худі + темна долоня), у координатах телефона
  function handBack(x, s, col, a) { if (a <= 0) return; const w = PH.w, h = PH.h, dk = shade(col, -.22); x.save(); x.globalAlpha = a; x.scale(s, s);
    capL(x, w * .3, h * .44, w * 1.25, h * 1.3, 330, dk); capL(x, w * .3, h * .44, w * 1.25, h * 1.3, 250, col); capL(x, w * .33, h * .47, w * .4, h * .55, 340, dk);
    x.fillStyle = INK; x.beginPath(); x.ellipse(w * .16, h * .33, 250, 210, -.55, 0, 7); x.fill(); x.restore(); }
  function handFront(x, s, a) { if (a <= 0) return; const w = PH.w, h = PH.h; x.save(); x.globalAlpha = a; x.scale(s, s);
    capL(x, w / 2 + 70, h * .36, w / 2 - 34, h * .15, 74, INK); [0, 1, 2].forEach((i) => capL(x, -w / 2 - 36, h * (.16 + i * .085), -w / 2 + 14, h * (.15 + i * .085), 64, INK)); x.restore(); }
  // план камери на кожному кроці (свій ракурс, легкий «ручний» рух)
  function adCam(S, lt) { const sw = { x: Math.sin(lt * 1.3) * 8, y: Math.sin(lt * 1.7 + 2) * 7, r: Math.sin(lt * .9 + 1) * .007 }, sg = (id) => clamp((lt - S[id][0]) / Math.max(.1, S[id][1] - S[id][0]));
    let c; if (lt < S.make[0]) { const p = sg("topic"); c = { s: lerp(.9, .96, p), cx: SCX + 12, cy: 1075, rot: lerp(-.055, -.035, p) }; }
    else if (lt < S.earn[0]) { const p = sg("make"); c = { s: lerp(1.0, 1.07, p), cx: SCX - 28, cy: 1050, rot: lerp(.04, .028, p) }; }
    else if (lt < S.cta[0]) { const p = sg("earn"), s = lerp(1.36, 1.46, p); c = { s, cx: SCX + 6, cy: 960 + .2 * SCR.h * s, rot: -.018 }; }
    else { const p = sg("cta"); c = { s: lerp(.9, .95, p), cx: SCX, cy: 1065, rot: lerp(.012, 0, p) }; }
    return { s: c.s, cx: c.cx + sw.x, cy: c.cy + sw.y, rot: c.rot + sw.r }; }
  function drawAd(x, L, si, lt, t) { const sc = L.scenes[si], prev = L.scenes[si - 1] || L.scenes[si + 1], next = L.scenes[si + 1], kind = sc.kind || L.ad || "bio";
    const D = adDur(L), S = (L.adTm || adTmDef(D)).seg, inE = Math.max(.9, S.in[1]), outS = Math.max(inE + .5, Math.min(S.out[0], D - 1.3)), place = prev?.place || "room", tm = prev?.time || "day", col = HOOD[L.hero?.col] || HOOD.yellow;
    const scr = (q2) => (q) => adScreen(q, L, q2, kind, S);
    if (lt < inE) { // 1) персонаж у своїй сцені дістає телефон — камера наїжджає, в кінці різкий наїзд у екран
      const p = ease(clamp(lt / inE)), wh = clamp((lt - (inE - .3)) / .3), z = lerp(1.12, 2.2, p) * (1 + wh * wh * 1.6), hx = W * .5, foc = [hx + 120, 930];
      x.save(); x.translate(W / 2, H / 2); x.scale(z, z); x.translate(-lerp(W / 2, foc[0], p), -lerp(H * .52, foc[1], p));
      x.drawImage(bgOf(place, tm, prev?.seed || 1, z > 1.7), 0, 0); const hd = figure(x, hx, FLOOR + 40, POSE.phone, { who: "hero", col: L.hero?.col || "yellow", acc: L.hero?.acc, face: "smirk", f: 1, h: 720 }, t);
      x.save(); x.translate(hd.hand[0] + 6, hd.hand[1] - 70); x.rotate(-.1); realPhone(x, .19, scr(S.topic[0] + .01)); handFront(x, .19, 1); x.restore(); x.restore();
      if (wh > 0) { x.fillStyle = `rgba(255,255,255,${wh * wh * .5})`; x.fillRect(0, 0, W, H); } return; }
    // 2) великий план: телефон у руці персонажа, плани змінюються на кожному кроці; 3) телефон вилітає на глядача — на екрані вже наступна сцена
    const bz = 1.08 + .03 * Math.sin(lt * .4); x.save(); x.translate(W / 2, H / 2); x.scale(bz, bz); x.translate(-W / 2, -H / 2); x.drawImage(bgOf(place, tm, prev?.seed || 1, true), 0, 0); x.restore(); x.fillStyle = "rgba(10,9,20,.4)"; x.fillRect(0, 0, W, H);
    let c = adCam(S, Math.min(lt, outS)), fly = 0; const sEnd = Math.max(W / SCR.w, H / SCR.h);
    if (lt >= outS) { fly = clamp((lt - outS) / Math.max(.5, D - outS)); const e = fly * fly * fly * (fly * (fly * 6 - 15) + 10); c = { s: lerp(c.s, sEnd, e), cx: lerp(c.cx, W / 2, e), cy: lerp(c.cy, H / 2, e), rot: lerp(c.rot, 0, e) }; }
    const ip = clamp((lt - inE) / .32); if (ip < 1) c.s *= lerp(1.3, 1, eout(ip));
    const nextScr = (q) => { const n = off("n"), nx = n.getContext("2d"); drawScene(nx, L, si + 1, next.t0 + .01); const k = 1 / sEnd, w = W * k, h = H * k; q.drawImage(n, 0, 0, W, H, (SCR.w - SCR.h * W / H) / 2, 0, SCR.h * W / H, SCR.h); q.fillStyle = "rgba(0,0,0,.35)"; q.fillRect(0, 0, SCR.w, SCR.h); q.drawImage(n, (SCR.w - w) / 2, (SCR.h - h) / 2, w, h); };
    const ha = 1 - clamp(fly / .3);
    x.save(); x.translate(c.cx, c.cy); x.rotate(c.rot); handBack(x, c.s, col, ha); realPhone(x, c.s, fly > 0 && next ? nextScr : scr(lt), 1 - fly); handFront(x, c.s, ha); x.restore();
    if (fly < .05 && lt > inE + .3) { x.save(); x.globalAlpha = clamp((lt - inE - .3) / .3) * (1 - fly * 20); x.fillStyle = "rgba(0,0,0,.45)"; rr(x, SCX - 118, 1752, 236, 50, 25); x.fill(); uiT(x, "⏩  пришвидшено", SCX, 1778, 25, "#fff", 800, "center"); x.restore(); }
    if (ip < 1) { x.fillStyle = `rgba(255,255,255,${(1 - ip) * .45})`; x.fillRect(0, 0, W, H); } }
  // місце вставки: межа речення ближче до ~55% ролику (у коротких — до 70%)
  function adPoint(L) { const ws = L.words, n = ws.length; if (n < 12) return null; const ends = []; ws.forEach((w, i) => { if (i > 3 && i < n - 4 && /[.!?…]$/.test(ws[i - 1].w)) ends.push(i); });
    const target = Math.round(n * (L.dur > 20 ? .55 : .7)); return (ends.length ? ends : [Math.round(n * .55)]).reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a); }
  // вставити рекламу: озвучена вставка (buf) або тиша AD_DUR; слова після неї зсуваються
  function insertAd(L, k, buf, tg) { if (!L.ad || L.ad === "none" || L.adK != null || k == null) return; const ws = L.words, n = ws.length, SR = E().SR;
    const D = tg ? tg.D : AD_DUR, T = ws[k - 1].e + .15, v = L.voice, cut = Math.min(Math.round(T * SR), v.length), gap = Math.round(D * SR), y = new Float32Array(v.length + gap);
    y.set(v.subarray(0, cut), 0); if (buf) { const o = Math.round(.15 * SR); y.set(buf.subarray(0, Math.max(0, Math.min(buf.length, gap - o))), cut + o); } if (cut < v.length) y.set(v.subarray(cut), cut + gap);
    L.voice = y; for (let i = k; i < n; i++) { ws[i].s += D; ws[i].e += D; } L.dur += D; L.adK = k; L.adT = T; L.adD = D; L.adTm = tg ? { seg: tg.seg } : null; L.adWords = tg?.words || null; }
  function removeAd(L, keep) { if (L.adK == null) return null; const D = adDur(L), SR = E().SR, cut = Math.min(Math.round(L.adT * SR), L.voice.length), gap = Math.round(D * SR), v = L.voice, y = new Float32Array(Math.max(0, v.length - gap)); y.set(v.subarray(0, cut), 0); y.set(v.subarray(Math.min(v.length, cut + gap)), cut);
    const k = L.adK; L.voice = y; for (let i = k; i < L.words.length; i++) { L.words[i].s -= D; L.words[i].e -= D; } L.dur -= D; L.adK = L.adT = L.adD = L.adTm = L.adWords = null;
    if (!keep) { L.ad = "none"; L.scenes = L.scenes.filter((s) => !s.ad); } return k; }
  // озвучити вставку голосом відео: місточок (AI) + кроки + заклик + повернення
  async function placeAd(L, k) { if (!L.ad || L.ad === "none") return; await Promise.race([loadAd(), new Promise((r) => setTimeout(r, 9000))]); if (k == null) k = adPoint(L); if (k == null) return; let buf = null, tg = null;
    if (!L.silent) { try { const voice = L.adV?.voice || await adVoice(L.src); if (voice) { const br = L.adV?.br || await adBridge(L, k), parts = adParts(L.ad, L.adWord, br); buf = tstretch(await ttsAudio(parts.map((p) => p.t).join(" ").replace(/…\s*…/g, "… "), voice), AD.speed); tg = adTiming(parts, buf); L.adV = { voice, br }; } } catch (e) { console.warn("ad voice", e); buf = null; tg = null; } }
    insertAd(L, k, buf, tg); }
  async function revoiceAd(L, newBridge) { if (L.adK == null) return; if (newBridge && L.adV) delete L.adV.br; const k = removeAd(L, true); await placeAd(L, k); }
  async function inlineAd(L, parts) { const [a0, a1] = L.adRange, ws = L.words; if (a0 < 1 || a1 + 1 >= ws.length) return; await Promise.race([loadAd(), new Promise((r) => setTimeout(r, 8000))]);
    const T0 = Math.max(0, ws[a0].s - .08), D = ws[a1 + 1].s - .12 - T0; if (D < 4) return;
    const cnt = (t) => String(t || "").split(/\s+/).filter(Boolean).length, at = (i) => clamp(ws[Math.min(a1 + 1, Math.max(a0, i))].s - T0, 0, D);
    let seg; if (parts) { const iC = a0 + cnt(parts.in), iT = iC + cnt(parts.core), iO = iT + cnt(parts.cta), c0 = Math.max(1, at(iC)), c1 = Math.max(c0 + 1, at(iT)), earn = /оплат|заробля|отриму/i.test(parts.core || "");
        const k = earn ? 3 : 2, st = (c1 - c0) / k; seg = { in: [0, c0], topic: [c0, c0 + st], make: [c0 + st, c0 + 2 * st], earn: earn ? [c0 + 2 * st, c1] : [c1 - .01, c1], cta: [c1, Math.max(c1 + .8, at(iO))], out: [Math.max(c1 + .8, at(iO)), D] }; }
    else { const q = D / 7; seg = { in: [0, q], topic: [q, 2 * q], make: [2 * q, 3.5 * q], earn: [3.5 * q, 4.8 * q], cta: [4.8 * q, 6 * q], out: [6 * q, D] }; }
    L.adInline = true; L.adK = a0; L.adT = T0; L.adD = D; L.adTm = { seg }; L.adWords = null; }
  function inlineScenes(L) { const [a0, a1] = L.adRange, prev = [...L.scenes].filter((q) => !q.ad && q.a < a0).pop();
    L.scenes = L.scenes.filter((q) => !q.ad && (q.a < a0 || q.a > a1));
    if (!L.scenes.some((q) => q.a === a1 + 1)) { const nx = L.scenes.find((q) => q.a > a1); if (nx) nx.a = a1 + 1; else if (prev) L.scenes.push({ ...JSON.parse(JSON.stringify(prev)), a: a1 + 1, tr: "cut", cap: null, hud: null, shot: prev.shot === "wide" ? "medium" : "wide" }); }
    L.scenes.forEach((q) => { if (q.a === a1 + 1) q.tr = "cut"; }); L.scenes.push({ ad: true, a: a0, kind: L.ad, place: prev?.place || "room", cast: [], props: [] }); }
  function ensureAd(L) { if (L.adInline) { if (!L.ad || L.ad === "none") { L.scenes = L.scenes.filter((q) => !q.ad); return; } return inlineScenes(L); } if (!L.ad || L.ad === "none" || L.adK == null) { L.scenes = L.scenes.filter((s) => !s.ad); return; } L.scenes = L.scenes.filter((s) => !s.ad);
    if (!L.scenes.some((s) => s.a === L.adK)) { const prev = [...L.scenes].reverse().find((s) => s.a < L.adK); if (prev) L.scenes.push({ ...JSON.parse(JSON.stringify(prev)), a: L.adK, tr: "cut", cap: null, hud: null }); }
    L.scenes.forEach((s) => { if (s.a === L.adK) s.tr = "cut"; }); L.scenes.push({ ad: true, a: L.adK, kind: L.ad, place: "room", cast: [], props: [] }); }
  function drawFrame(x, L, t, OWd = W, OHd = H) {
    x.save(); if (OWd !== W) x.scale(OWd / W, OHd / H); FMT = FMTS[L?.fmt] ? L.fmt : "kino";
    if (!L?.scenes?.length) { x.fillStyle = "#1a1830"; x.fillRect(0, 0, W, H); x.restore(); return; }
    const si = sceneAt(L, t), sc = L.scenes[si], lt = t - sc.t0, TR = sc.ad ? 0 : sc.tr === "whip" ? .32 : sc.tr === "fade" ? .45 : 0;
    if (si > 0 && TR && lt < TR) { const p = lt / TR;
      if (sc.tr === "fade") { if (p < .5) { drawScene(x, L, si - 1, t); x.fillStyle = `rgba(6,5,14,${p * 2})`; x.fillRect(0, 0, W, H); } else { drawScene(x, L, si, t); x.fillStyle = `rgba(6,5,14,${(1 - p) * 2})`; x.fillRect(0, 0, W, H); } }
      else { const a = off("a"), b = off("b"), ax = a.getContext("2d"), bx = b.getContext("2d"); drawScene(ax, L, si - 1, t); drawScene(bx, L, si, t); const e = ease(p), dir = sc.dir || 1;
        x.fillStyle = "#000"; x.fillRect(0, 0, W, H); x.filter = `blur(${Math.round(Math.sin(p * Math.PI) * 26)}px)`; x.drawImage(a, -e * W * dir, 0); x.drawImage(b, (1 - e) * W * dir, 0); x.filter = "none"; } }
    else if (sc.ad) drawAd(x, L, si, lt, t); else drawScene(x, L, si, t);
    FMT = FMTS[L.fmt] ? L.fmt : "kino"; if (FMT === "paper") paperFrame(x); if (RTOON[FMT]) retroPost(x, t);
    if (L.subs && !sc.ad) subs(x, t, L);
    else if (L.subs && sc.ad && L.adInline && L.adTm) { const lt = t - sc.t0, S = L.adTm.seg, up = lt >= Math.max(.9, S.in[1]) && lt < S.out[0]; subs(x, t, up ? { ...L, subS: { ...SUBS0, ...(L.subS || {}), y: 330 } } : L); }
    else if (L.subs && sc.ad && L.adWords && L.adTm) { const lt = t - sc.t0, S = L.adTm.seg, inE = Math.max(.9, S.in[1]), up = lt >= inE && lt < S.out[0]; if (lt < inE - .32 || lt >= inE) subs(x, t, { ...L, subS: up ? { ...SUBS0, ...(L.subS || {}), y: 330 } : L.subS, words: L.adWords.map((w) => ({ w: w.w, s: w.s + sc.t0, e: w.e + sc.t0 })) }); }
    if (KN()) post(x, t); if (["cine", "aurora", "cut", "noir"].includes(FMT)) premPost(x, t, L);
    if (FMT === "retro") { x.save(); x.globalCompositeOperation = "color"; x.globalAlpha = .55; x.fillStyle = "#8a5a2b"; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over"; x.globalAlpha = 1; for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${i % 2 ? 255 : 30},${i % 2 ? 240 : 20},${i % 2 ? 210 : 10},${.05 + rnd(i + Math.floor(t * 24) * 7, 5) * .08})`; x.fillRect(rnd(i, Math.floor(t * 24)) * W, rnd(i + 1, Math.floor(t * 24)) * H, 3, 3); }
      const v = x.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .75); v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(30,15,5,.55)"); x.fillStyle = v; x.fillRect(0, 0, W, H); if (rnd(Math.floor(t * 24), 9) > .93) { x.fillStyle = "rgba(255,240,210,.35)"; x.fillRect(rnd(Math.floor(t * 24), 10) * W, 0, 2, H); } x.restore(); }
    const fo = Math.min(clamp(t / .35), clamp((L.dur - t) / .5)); if (fo < 1) { x.fillStyle = `rgba(6,5,14,${1 - fo})`; x.fillRect(0, 0, W, H); }
    x.restore();
  }
  // таймінг сцен зі слів
  // щоб текст не налазив на текст: напис угорі, вікно-підказка нижче, субтитри внизу
  const HUDH = { panel: 270, chart: 250, bars: 240, counter: 130, brain: 230, check: 250, compare: 230, rings: 220, network: 240 };
  function fixLayout(L, sc, force) { if (!sc || sc.ad) return; const subTop = L.subs ? (L.subS?.y || 1370) - 120 : H - 300, hk = sc.hud?.k && sc.hud.k !== "none" ? sc.hud.k : null, hh = hk ? (HUDH[hk] || 240) : 0;
    if (sc.cap?.t) { const big = sc.cap.k === "title", ch = big ? 140 : 115; let cy = sc.cap.y || (big ? H * .42 : 470);
      if (hk) { const hy = sc.hud.y || 700; if (force || (cy + ch + 30 > hy - hh && cy - ch - 30 < hy + hh)) { cy = sc.cap.y = 300; sc.hud.y = Math.max(hy, 300 + ch + 40 + hh); } }
      if (cy + ch > subTop) sc.cap.y = 470; }
    if (hk && (sc.hud.y || 700) + hh > subTop) { sc.hud.y = Math.max(230 + hh, subTop - hh - 20); if (sc.cap?.t && (sc.cap.y || 470) + 130 > sc.hud.y - hh) sc.cap = null; } }
  function timeline(L) { (L.scenes || []).forEach((s) => fixLayout(L, s)); const ws = L.words, n = ws.length; L.scenes.sort((a, b) => a.a - b.a || (b.ad ? 1 : 0) - (a.ad ? 1 : 0)); if (L.scenes[0]) L.scenes[0].a = 0;
    L.scenes.forEach((s, i) => { s.t0 = i === 0 ? 0 : s.ad ? (L.adT ?? Math.max(0, ws[Math.max(0, s.a - 1)].e + .1)) : Math.max(0, ws[Math.min(n - 1, s.a)].s - .12); s.seed = s.seed || (i * 7 + 3); });
    L.scenes.forEach((s, i) => { s.t1 = i + 1 < L.scenes.length ? L.scenes[i + 1].t0 : L.dur; const at = (k) => k != null && ws[k] ? Math.max(0, ws[k].s - s.t0) : null;
      (s.props || []).forEach((p) => { p.at = at(p.i) ?? .15; }); if (s.hud) s.hud.at = at(s.hud.i) ?? .1; if (s.cap) s.cap.at = at(s.cap.i) ?? .05; s.hitT = (s.hit || []).map(at).filter((v) => v != null); s.dir = i % 2 ? -1 : 1; }); }


  /* ---------- звук: музика й ефекти синтезуються в браузері (свої, без чужих треків) ---------- */
  const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const MOODS = {
    curious: { n: "Цікаво", bpm: 96, ch: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 59], [55, 59, 62, 66]], perc: 1 },
    warm: { n: "Тепло", bpm: 84, ch: [[48, 52, 55, 59], [45, 48, 52, 55], [53, 57, 60, 64], [55, 59, 62, 65]], perc: 0 },
    tense: { n: "Напруга", bpm: 104, ch: [[45, 48, 52, 55], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 54]], perc: 2 },
    epic: { n: "Епічно", bpm: 90, ch: [[50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 60], [45, 49, 52, 57]], perc: 2 },
    sad: { n: "Сумно", bpm: 72, ch: [[45, 48, 52, 55], [41, 45, 48, 52], [48, 52, 55, 59], [43, 47, 50, 55]], perc: 0 },
    fun: { n: "Весело", bpm: 112, ch: [[48, 52, 55, 60], [53, 57, 60, 65], [55, 59, 62, 67], [48, 52, 55, 60]], perc: 1 },
    chill: { n: "Лоуфай", bpm: 78, ch: [[50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59], [45, 48, 52, 55]], perc: 1, soft: 1 },
    mystery: { n: "Загадка", bpm: 70, ch: [[45, 48, 52, 56], [44, 48, 51, 55], [41, 45, 48, 52], [40, 44, 47, 52]], perc: 0, soft: 1 },
    drive: { n: "Драйв", bpm: 124, ch: [[52, 55, 59, 62], [48, 52, 55, 59], [55, 59, 62, 66], [50, 54, 57, 62]], perc: 2 },
    inspire: { n: "Натхнення", bpm: 100, ch: [[48, 55, 60, 64], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]], perc: 1 },
  };
  function noiseBuf(ac, sec) { const b = ac.createBuffer(1, Math.round(sec * ac.sampleRate), ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  async function soundtrack(L) {
    const SR = E().SR, dur = L.dur, ac = new OfflineAudioContext(1, Math.ceil(dur * SR), SR), M = MOODS[L.mood] || MOODS.curious, beat = 60 / M.bpm, bar = beat * 4, NB = noiseBuf(ac, 2);
    const mus = ac.createGain(); mus.gain.value = 1; const sfx = ac.createGain(); sfx.gain.value = L.sfx === false ? 0 : 1; mus.connect(ac.destination); sfx.connect(ac.destination);
    const env = (g, t, a, peak, d, end = 0.0001) => { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(end, 0.0001), t + a + d); };
    const osc = (type, f, t, a, peak, d, dest, filt) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; env(g, t, a, peak, d); let n = o; if (filt) { const fl = ac.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = filt; o.connect(fl); n = fl; } n.connect(g); g.connect(dest); o.start(t); o.stop(t + a + d + .05); return o; };
    if (L.music !== false) {
      const padF = ac.createBiquadFilter(); padF.type = "lowpass"; padF.frequency.value = 1100; padF.Q.value = .4; const padG = ac.createGain(); padG.gain.value = .045; padF.connect(padG); padG.connect(mus);
      for (let t = 0, b = 0; t < dur + bar; t += bar, b++) { const ch = M.ch[b % M.ch.length];
        ch.forEach((m) => [-6, 6].forEach((dt) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "sawtooth"; o.frequency.value = NOTE(m); o.detune.value = dt; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + bar * .35); g.gain.linearRampToValueAtTime(.7, t + bar * .9); g.gain.linearRampToValueAtTime(0.0001, t + bar * 1.08); o.connect(g); g.connect(padF); o.start(t); o.stop(t + bar * 1.1); }));
        osc("sine", NOTE(ch[0] - 12), t, .02, .22, bar * .95, mus); osc("sine", NOTE(ch[0] - 12), t + beat * 2, .02, .14, beat * 1.8, mus);
        for (let k = 0; k < 8; k++) { const nt = ch[(k * (k % 2 ? 3 : 1)) % ch.length] + 12 + (k === 6 ? 12 : 0); osc(M.soft ? "sine" : "triangle", NOTE(nt), t + k * beat / 2, .005, M.soft ? .04 : .05, M.soft ? .7 : .45, mus, M.soft ? 1600 : 2600); }
        if (M.perc) for (let k = 0; k < 8; k++) { const ht = t + k * beat / 2, src = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = NB; hp.type = "highpass"; hp.frequency.value = 7000; env(g, ht, .002, k % 2 ? .018 : .03, .05); src.connect(hp); hp.connect(g); g.connect(mus); src.start(ht, rnd(k, b) * 1.5, .1);
          if (M.perc > 1 && k % 4 === 0) { const o = ac.createOscillator(), kg = ac.createGain(); o.frequency.setValueAtTime(110, ht); o.frequency.exponentialRampToValueAtTime(38, ht + .18); env(kg, ht, .003, .22, .3); o.connect(kg); kg.connect(mus); o.start(ht); o.stop(ht + .4); } } }
    }
    // ефекти на діях
    const whoosh = (t, up = 1) => { t = Math.max(.01, t); const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain(); src.buffer = NB; bp.type = "bandpass"; bp.Q.value = 1.2; bp.frequency.setValueAtTime(up ? 300 : 2800, t); bp.frequency.exponentialRampToValueAtTime(up ? 3200 : 300, t + .32); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.32, t + .16); g.gain.exponentialRampToValueAtTime(0.0001, t + .4); src.connect(bp); bp.connect(g); g.connect(sfx); src.start(t, Math.random(), .45); };
    const pop = (t) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(1100, t + .07); env(g, t, .004, .22, .12); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + .2); };
    const ding = (t) => { osc("sine", 1318, t, .003, .12, .7, sfx); osc("sine", 1976, t + .06, .003, .09, .6, sfx); };
    const blip = (t) => { osc("square", 1250, t, .002, .035, .05, sfx, 3000); osc("square", 1660, t + .07, .002, .03, .05, sfx, 3000); };
    const boom = (t, k = 1) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(36, t + .5); env(g, t, .005, .42 * k, .6); o.connect(g); g.connect(sfx); o.start(t); o.stop(t + .7);
      const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g2 = ac.createGain(); src.buffer = NB; lp.type = "lowpass"; lp.frequency.value = 1800; env(g2, t, .002, .12 * k, .14); src.connect(lp); lp.connect(g2); g2.connect(sfx); src.start(t, 0, .2); };
    const shimmer = (t) => { for (let i = 0; i < 9; i++) osc("sine", NOTE(84 + [0, 4, 7, 11, 12, 16, 19, 23, 24][i]), t + i * .05, .01, .025, .9, sfx); };
    const ticks = (t, n = 10) => { for (let i = 0; i < n; i++) osc("square", 2400, t + i * .11, .001, .025, .02, sfx, 5000); };
    L.scenes.forEach((s, i) => {
      if (s.ad) { const t = s.t0, D = adDur(L), S = (L.adTm || adTmDef(D)).seg; whoosh(t + .1, 1); whoosh(t + Math.max(.9, S.in[1]) - .3, 1); AD.beats.forEach((b) => { const a = t + S[b.id][0]; if (b.id === "earn") [0, 1, 2, 3].forEach((j) => ding(a + .25 + j * .22)); else if (b.id === "cta") { boom(a, .5); boom(a + .02, .3); } else pop(a + .05); if (b.id === "make") ticks(a + .3, 10); }); whoosh(t + Math.max(Math.max(.9, S.in[1]) + .5, Math.min(S.out[0], D - 1.3)) + .2, 0); return; }
      if (i > 0) { if (s.tr === "whip") whoosh(s.t0 - .1, i % 2); else if (s.tr === "fade") whoosh(s.t0 - .2, 0); else if (s.shot === "close" || s.shot === "face") boom(s.t0, .35); }
      (s.props || []).forEach((p) => { const t = s.t0 + (p.at || 0); if (p.k === "coin" || p.k === "money" || p.k === "trophy") ding(t); else pop(t); if (p.k === "clock") ticks(t, 14); });
      if (s.hud?.k && s.hud.k !== "none") { const t = s.t0 + (s.hud.at || 0); if (s.hud.k === "brain" || s.hud.k === "network") shimmer(t); else blip(t); if (s.hud.k === "counter") ticks(t, 10); if (s.hud.k === "check") (s.hud.items || []).slice(0, 5).forEach((q, k) => pop(t + .3 + k * .45)); }
      if (s.cap?.t) boom(s.t0 + (s.cap.at || 0), s.cap.k === "title" ? .9 : .55);
    });
    const out = (await ac.startRendering()).getChannelData(0);
    // мікс: голос + приглушена під голос музика, плавний кінець
    const v = L.voice, y = new Float32Array(out.length), win = Math.round(SR * .05); let e = 0;
    const venv = new Float32Array(Math.ceil(out.length / win) + 1); for (let k = 0; k < venv.length; k++) { let m = 0; for (let i = k * win; i < Math.min(v.length, (k + 1) * win); i++) m = Math.max(m, Math.abs(v[i])); venv[k] = m; }
    const mBase = L.silent ? .9 : .55, fadeN = Math.round(SR * 1.2);
    for (let i = 0; i < out.length; i++) { if (i % win === 0) { const tgt = clamp(venv[i / win | 0] * 6); e += (tgt - e) * (tgt > e ? .5 : .08); }
      const fade = Math.min(1, (out.length - i) / fadeN), mus = out[i] * mBase * (1 - .55 * e) * fade; y[i] = (i < v.length ? v[i] : 0) + mus; }
    let pk = 0; for (let i = 0; i < y.length; i++) pk = Math.max(pk, Math.abs(y[i])); if (pk > .97) { const g = .97 / pk; for (let i = 0; i < y.length; i++) y[i] *= g; }
    return y;
  }

  /* ---------- AI: план сцен із бази знань ---------- */
  const SPEC = `Локації (place): ${Object.entries(PLACES).map(([k, v]) => `${k} — ${v.n}`).join("; ")}. Час (time): day | sunset | night.
План (shot): wide — загальний (герой на весь зріст), medium — по пояс, close — плечі й голова, face — лише обличчя (емоція). Камера (cam): push — повільний наїзд, pull — від'їзд, pan_l / pan_r — проїзд, still, shake — тряска (шок), punch — різкий стрибок крупніше на обличчя героя (шок, «що?!», реакція на число).
Перехід (tr) до сцени: cut — різка склейка, whip — швидкий змах (зміна думки), fade — через темряву (зміна часу, «пізніше», сон).
Персонажі (cast, до 3): who — hero (головний герой, завжди той самий) | man | woman | kid | girl | doctor | boss | old | shadow | dog | cat; shadow — тінь-демон (чорний силует зі світінням і очима): лінь, страх, сумнів, залежність, внутрішній голос «у тебе не вийде»; став поруч із героєм або за спиною; scale — розмір 0.3…2.5 (2 — нависає над героєм), grow — до якого розміру росте/меншає за сцену (перемога: grow 0.3), glow — red | pink (спокуса, телефон) | purple (тиск натовпу), die:1 — розсипається на іскри (фінальна перемога); say — коротка репліка персонажа (до 6 слів): у тіні — тремтливий шепіт («ще 5 хвилин», «у тебе не вийде»), у людей — білий бабл; для dog/cat — breed: ${Object.entries(BREED).map(([k, v]) => `${k} (${v.n})`).join(", ")} і pose тільки ${PETPOSE.join(" | ")} (talk — гавкає/нявкає); x — 0…1 по ширині; to — куди йде (0…1, тоді він іде/біжить); pose — ${Object.keys(POSE).join(" | ")}; face — ${FACE.join(" | ")}; look — l | r; acc (для не-героя) — ${ACC.join(" | ")}; tag — мітка над головою («41 РІК», «$8,742,619,300», «999»); tagC — колір стану green | red (небезпека, пульсує) | gold | blue | pink | dark; tag0 — число, з якого tag перебігає (0 → 999, 6 → 5); tag2 — другий рядок дрібніше («ВИГЛЯДАЄ НА 18»); tagIcon:"heart" — серце в мітці; delta — «+3» або «-300», вилітає збоку; timer — секунди, тоді над головою цифровий таймер, що біжить назад; think — думка персонажа в хмарці (до 6 слів, «ПІЦА», «ДЕ МОЇ КЛЮЧІ?»).
Натовп: crowd — 0…6 людей на фоні (зупинка, вулиця, черга); crowdTimer:1 — у кожного над головою свій таймер; crowdTag — масив коротких міток для них.
Предмети (props, до 2): k — ${Object.keys(PROPS).join(" | ")} | або будь-яка іконка англійською в полі q (k:"icon", q:"rocket"); t — короткий текст/число на предметі; t2 — підпис (для card/calendar); hold:1 — герой тримає в руці (pose hold або phone); x,y — 0…1 (якщо не в руці); i — номер слова, коли з'являється.
HUD (hud) — пояснення поверх кадру: k — none | panel (вікно-«оновлення» з % і двома кнопками items) | chart (графік: v 1 росте, -1 падає) | bars | counter (велике число v, підпис t) | brain (світний мозок-мережа) | check (чекліст items) | compare (до/після, items:[2]) | rings | network | timeline (шкала 0–100 з позначкою: v — значення, items[0] — підпис позначки, напр. «73 РОКИ») | timer (цифровий таймер, що біжить назад: v — секунд; items — підписи «ДНІВ, ГОДИН, ХВИЛИН, СЕКУНД», тоді справа розкладка) | rules (пронумеровані кола: v — скільки, items — короткі підписи) | split (два стовпці з заголовками items[0] і items[1] і знаком питання) | day (великий лічильник «ДЕНЬ 47»: t — підпис, напр. «ДЕНЬ» або «ДНІВ БЕЗ…», v — число, v0 — з якого перебігає; якщо v менше за v0 — червоний «зрив»; items[0] — підпис знизу) | calendar (календар, дні перекреслюються по черзі: v — скільки днів, t — заголовок, items[0] — підсумок) | jar (банка наповнюється монетами: v — сума з валютою «12 000 ₴», t — заголовок, v0 — наповненість 0…1) | clock (електронний годинник, час пролітає: v0 «3:17» → v «4:40»; t — підпис зверху, items[0] — знизу) | chat (телефон із листуванням: t — ім'я співрозмовника, items — до 5 повідомлень по черзі, мої починай з «я:») | stamp (штамп під кутом із ударом: t — 1–2 слова «НЕМОЖЛИВО», «F», «ПЕРЕВІРЕНО»; items[0]:"green" — зелений) | people (сітка людей: v — скільки всього до 100, v0 — скільки виділено червоним; t — заголовок; items[0] — підпис «1 З 20») | pie (кругова діаграма: v — відсоток, items[0] — підпис частини, items[1] — решти) | gauge (спідометр: v 0–100, червона зона після 80; items[0] — підпис); calendar: mark:"check" — зелені галочки замість хрестиків, v0 — номер дня зриву (рожева пляма); для timeline/timer/rules/split найкраще місце place:"board" (темна інфографіка) без героя; t — заголовок; i — номер слова; y — висота центру 0…1 (не накривай голову героя: герой стоїть унизу, HUD став у верхню половину y 0.25–0.4).
Напис (cap) — НЕ поверх кадру, а ВСЕРЕДИНІ сцени, на предметі світу: t — ДО 5 слів, ключове слово в *зірочках* (його виділено кольором і підкреслено), i — номер слова, на якому напис з'являється (пишеться на очах); on — на чому написано: board (маркерна дошка на стіні), chalk (крейдяна дошка), screen (екран/телевізор), poster (аркуш на стіні), sign (вивіска/білборд на вулиці), neon (неонова вивіска в темряві), paper (записка-стікер). Якщо on не вказано — підбирається за локацією. Цифри, суми, дати, ключові слова показуй лише так або предметами — жодних плашок і титрів поверх.
hit — номери 1–2 найважливіших слів сцени (легкий удар камери).
loc — час/місце («СУБОТА • 21:14», «ДЕНЬ 1») — теж пишеться на табличці/календарі в сцені, якщо в сцені немає cap.
fx — ефекти сцени (масив, до 3): confetti — конфеті (перемога, гроші прийшли), black — темрява, в якій світиться неонова вивіска з фразою (cap), rain — дощ (смуток, поганий день), crack — скло тріскається (удар правди, «ти залежний»), flash — білий спалах (шок, зрив, удар), spot — промінь світла на героя, навколо темрява (самотність, інсайт).`;
  const RULES = `Стиль — кінематографічний мультик із пласким героєм-чоловічком (темна кругла голова, світлі очі, худі), як популярні YouTube-канали «що, якби…», але ВЕРТИКАЛЬНО 9:16 для Reels:
— ХУК: перша сцена (слова 0–6) — найсильніший кадр усього відео, у ньому вже щось відбувається на ключовому слові; конкретний рецепт хука для ЦЬОГО ролика дано нижче — роби саме за ним, а не за звичкою;
— УТРИМАННЯ: у перші 6 секунд — щонайменше 3 різні сцени; далі сцена 1,5–3 с, не довше 3,5 с; дві сцени поспіль не мають однаковий plan і локацію; кожні 5–7 с — поворот (whip/shake/face/flash);
— абстрактні ідеї показуй через локацію space + HUD (brain, panel, chart, counter), конкретні — через героя в побутовій локації з предметом у руці;
— «що, якби…» і числа: числа на табличках, екранах і вивісках у самій сцені (cap з on, hud на екрані), натовп на вулиці чи зупинці (crowd), а пояснення чисел — окремими сценами place:"board" з timeline / timer / rules / split (чисті лінії, як у роликах What If);
— внутрішній ворог (лінь, страх, сумнів, «у тебе не вийде», залежність) — тінь-демон who:"shadow" поруч із героєм або за спиною; коли герой здається — тінь росте (grow 2), коли перемагає — меншає (grow 0.3);
— прогрес у часі: «День 1 → День 90», серія днів — hud day (зрив — v менше за v0) або calendar (успіх — mark:"check"); накопичені гроші — hud jar; «час пролетів у телефоні» — hud clock; повідомлення, коментарі, підтримка друга — hud chat;
— друга сцена — до 2 с від початку, інший план і бажано інша локація; спокуса/внутрішній голос — say у тіні; удар правди — fx crack або flash; самотність — fx spot; поганий день — fx rain;
— емоцію героя показуй тілом і обличчям (pose + face), на поворотах — close/face і shake;
— cap не в кожній сцені: лише гачок, числа, повороти й висновок (≈ кожна друга-третя сцена);
— зміна часу/місця → tr:fade і табличка/календар у сцені (loc); зміна думки → whip; продовження дії → cut;
— один герой через усе відео; другорядні — для діалогу/контрасту;
— кожна сцена має щось, що рухається (наїзд, хода, жест, поява предмета/HUD точно на слові);
— зони соцмереж: верхні 12% висоти, праву смугу (останні 15% ширини) і низ (нижні 25% висоти) закривають кнопки й підпис Reels/TikTok/Shorts — предмети (x ≤ 0.76, y 0.15–0.7), предмети став у центрі, не в цих зонах.
— ЖОДНОГО ТЕКСТУ ПОВЕРХ КАДРУ (крім субтитрів, які додаються автоматично): HUD (графіки, лічильники, календар, чат) показується на екрані/телевізорі в сцені, написи cap — на дошці, плакаті, вивісці, записці; мітки над головами (tag, timer, crowdTag) не використовуй — число пиши на табличці, екрані чи предметі.`;
  const numbered = (L) => L.words.map((w, i) => `${i}:${w.w}`).join(" ");
  function normPlan(r, L) { const n = L.words.length, okI = (v) => Number.isInteger(v) && v >= 0 && v < n ? v : null, num = (v, a, b, d) => { v = +v; return isFinite(v) ? clamp(v, a, b) : d; }, str = (v, m) => typeof v === "string" ? v.slice(0, m) : "";
    const sc = (Array.isArray(r?.scenes) ? r.scenes : []).filter((s) => s && okI(s.a) != null).sort((a, b) => a.a - b.a).filter((s, i, A) => !i || s.a > A[i - 1].a).slice(0, 60).map((s) => ({
      a: s.a, place: PLACES[s.place] && (!L.places?.length || L.places.includes(s.place) || s.place === "space") ? s.place : (L.places?.length ? L.places[s.a % L.places.length] : "room"), time: TIME[s.time] ? s.time : "day", shot: SHOT[s.shot] ? s.shot : "wide", cam: ["push", "pull", "pan_l", "pan_r", "still", "shake", "punch"].includes(s.cam) ? s.cam : "push", tr: ["cut", "whip", "fade"].includes(s.tr) ? s.tr : "cut",
      cast: (Array.isArray(s.cast) ? s.cast : []).slice(0, 3).filter((c) => c && WHO[c.who]).map((c) => ({ who: c.who, breed: WHO[c.who].pet ? (BREED[c.breed] && !!BREED[c.breed].cat === (c.who === "cat") ? c.breed : (c.who === "cat" ? "ginger" : "labrador")) : undefined, x: num(c.x, .08, .92, .5), to: c.to != null ? num(c.to, .08, .92, null) : undefined, pose: WHO[c.who].pet ? (PETPOSE.includes(c.pose) ? c.pose : "stand") : POSE[c.pose] ? c.pose : "stand", face: FACE.includes(c.face) ? c.face : "calm", look: c.look === "l" || c.look === "r" ? c.look : undefined, acc: ACC.includes(c.acc) ? c.acc : undefined, col: HOOD[c.col] ? c.col : undefined, tag: str(c.tag, 22) || undefined, timer: c.timer != null && isFinite(+c.timer) ? clamp(+c.timer, 0, 3.2e9) : undefined, scale: c.who === "shadow" ? num(c.scale, .3, 2.5, 1) : undefined, grow: c.who === "shadow" && c.grow != null ? num(c.grow, .2, 2.5, 1) : undefined, glow: c.who === "shadow" && SHGLOW[c.glow] ? c.glow : undefined, die: c.who === "shadow" && c.die ? 1 : undefined, say: str(c.say, 44) || undefined, think: !c.say && str(c.think, 44) || undefined,
        tagC: TAGC[c.tagC] ? c.tagC : undefined, tag0: c.tag0 != null && isFinite(parseFloat(String(c.tag0).replace(/[\s,]/g, ""))) ? String(c.tag0).slice(0, 16) : undefined, tag2: str(c.tag2, 18) || undefined, tagIcon: c.tagIcon === "heart" ? "heart" : undefined, delta: str(c.delta == null ? "" : String(c.delta), 8) || undefined })),
      loc: str(s.loc, 26) || undefined, see: str(s.see, 140) || undefined,
      fx: Array.isArray(s.fx) ? [...new Set(s.fx.filter((q) => ["black", "rain", "crack", "flash", "spot", "confetti"].includes(q)))].slice(0, 3) : typeof s.fx === "string" && ["black", "rain", "crack", "flash", "spot", "confetti"].includes(s.fx) ? [s.fx] : undefined,
      crowd: s.crowd ? clamp(Math.round(+s.crowd) || 0, 0, 6) : undefined, crowdTimer: s.crowdTimer ? 1 : undefined, crowdTag: Array.isArray(s.crowdTag) ? s.crowdTag.slice(0, 6).map((q) => str(String(q), 14)) : undefined,
      props: (Array.isArray(s.props) ? s.props : []).slice(0, 2).filter((p) => p && (PROPS[p.k] || p.q || p.k === "icon")).map((p) => ({ k: PROPS[p.k] ? p.k : "icon", q: str(p.q, 30) || undefined, t: str(String(p.t ?? ""), 16) || undefined, t2: str(p.t2, 16) || undefined, hold: p.hold ? 1 : undefined, x: num(p.x, .12, .76, .7), y: num(p.y, .15, .7, .4), i: okI(p.i), v: p.v != null ? num(p.v, -1, 1, 1) : undefined })),
      hud: s.hud && s.hud.k && s.hud.k !== "none" ? { k: ["panel", "chart", "bars", "counter", "brain", "check", "compare", "rings", "network", "timeline", "timer", "rules", "split", "day", "calendar", "jar", "clock", "chat", "stamp", "people", "pie", "gauge"].includes(s.hud.k) ? s.hud.k : "panel", t: str(s.hud.t, 30), v: s.hud.v, v0: s.hud.k === "clock" ? (str(String(s.hud.v0 ?? ""), 6) || undefined) : s.hud.v0 != null && isFinite(+s.hud.v0) ? +s.hud.v0 : undefined, mark: s.hud.mark === "check" ? "check" : undefined, items: Array.isArray(s.hud.items) ? s.hud.items.slice(0, 5).map((q) => str(String(q), s.hud.k === "chat" ? 64 : 34)) : undefined, i: okI(s.hud.i), y: num(s.hud.y, .2, .6, .33) * H } : null,
      cap: s.cap && s.cap.t ? { t: str(s.cap.t, 60), on: WALLS.includes(s.cap.on) ? s.cap.on : undefined, i: okI(s.cap.i), k: s.cap.k === "title" || s.cap.k === "note" ? s.cap.k : undefined, tw: s.cap.tw ? 1 : undefined } : null,
      hit: (Array.isArray(s.hit) ? s.hit : []).map(okI).filter((v) => v != null).slice(0, 3),
    }));
    sc.forEach((s) => { if (!s.cast.some((c) => c.who === "hero") && !s.cast.some((c) => WHO[c.who]?.pet) && s.place !== "space" && s.cast.length < 3 && !s.hud && !s.fx?.includes("black")) s.cast.unshift({ who: "hero", x: .5, pose: "talk", face: "calm" });
      if (s.cast.some((c) => c.who === "hero")) { const h = s.cast.find((c) => c.who === "hero"); s.props.forEach((p) => { if (p.hold && !["hold", "phone"].includes(h.pose)) h.pose = p.k === "phone" ? "phone" : "hold"; }); }
      else s.props.forEach((p) => p.hold = undefined);
      if (s.hud && s.cast.length) { if (s.shot === "face") s.shot = "medium"; const ppl = s.cast.filter((c) => !WHO[c.who]?.pet); if (ppl.length === 1 && Math.abs(ppl[0].x - .5) < .2) ppl[0].x = ppl[0].x >= .5 ? .74 : .26; }
      if (s.hud?.k === "day" && s.cast.length) s.hud.y = .17 * H; // «ДЕНЬ N» над героєм, не на голові
      if (s.hud && s.cast.length) { s.cast.forEach((c) => { if (c.pose !== "lie") c.y = undefined; }); if (["panel", "chart", "bars", "check", "compare", "counter"].includes(s.hud.k)) s.hud.y = Math.min(s.hud.y, (s.hud.k === "counter" ? .24 : .27) * H); }
      s.props.forEach((p) => { if (!p.hold) { p.y = Math.min(p.y, s.cast.length ? .42 : .7); if (s.cap && p.y < .32) p.y = .36; } }); });
    if (!sc.length) throw new Error("plan"); if (sc[0].a !== 0) sc[0].a = 0; return sc; }
  // план сцен: частинами по ~70 слів (короткий JSON — не обрізається), з повтором; якщо AI не впорався — автоплан
  const PLAN_JSON = `{"mood":"<mood>","scenes":[{"say":"<дослівна фраза цієї сцени>","see":"<що буквально бачить глядач: хто, що робить, які предмети/цифри — і як це ілюструє фразу>","a":0,"place":"<place>","time":"<time>","shot":"<shot>","cam":"<cam>","tr":"cut","cast":[{"who":"<who>","x":0.5,"pose":"<pose>","face":"<face>"}],"cap":{"t":"<ДО 5 СЛІВ, *КЛЮЧОВЕ*>","i":1},"hit":[3]},{"say":"<наступна фраза>","see":"<…>","a":"<номер першого слова фрази>","…":"наступні сцени"}]}`;
  // різноманітність: щоразу інший рецепт першої сцени й інший набір акцентних прийомів (без повторів останніх роликів)
  const HOOKS = [
    ["black", "Темрява й неон: fx:[\"black\"], у темряві спалахує неонова вивіска з першою фразою-парадоксом (cap on:\"neon\"); друга сцена — різкий перехід (whip) у яскраву дію."],
    ["tag", "Число в світі: головне число ролика написане на табличці, вивісці чи екрані поруч із героєм (cap з on або hud counter на екрані); на ключовому слові — cam punch."],
    ["action", "У розпал дії: герой уже біжить/падає/хапає щось (pose run або shock, поле to), cam shake, предмет у кадрі; жодного вступу."],
    ["face", "Обличчя впритул: shot face, емоція за змістом першої фрази (не обов'язково shock), за спиною на стіні — дошка чи плакат зі словом-гачком (cap); за 1 с — cam punch або whip на ширший план."],
    ["object", "Предмет-доказ крупно: героя в першій сцені немає або він на краю кадру; у центрі великий предмет (телефон, гроші, годинник, календар, графік) через props або hud, що з'являється на ключовому слові."],
    ["shadow", "Внутрішній голос: герой на середньому плані, поруч або за спиною тінь-демон (who shadow) зі say-шепотом першої думки; fx spot."],
    ["crowd", "Натовп: place street, crowd 4–6, герой виділяється дією чи кольором; поруч вивіска (cap on:\"sign\") з головною думкою; cam pan."],
    ["info", "Інфографіка першою: place board без героя, одразу hud із головним числом або порівнянням (counter, people, pie, gauge, compare, timeline) — і лише в другій сцені герой."],
    ["contrast", "Контраст двох: два персонажі в одному кадрі з протилежними емоціями й позами — «він / ти», «було / стало»; різницю в числах — на дошці між ними (cap) або hud compare на екрані."],
    ["loc", "Точний момент: календар/табличка в сцені з днем і часом (loc або cap «ПОНЕДІЛОК • 7:12»), загальний план локації з дією героя; відчуття «історія вже почалась»."],
    ["question", "Звернення до глядача: герой дивиться в камеру (shot close, look до центру, pose point), think-бабл або питання на дошці позаду (cap); фон — локація теми."],
    ["stamp", "Вирок: hud stamp з одним словом-вироком («НЕМОЖЛИВО», «БРЕХНЯ», «0 ₴») на екрані в сцені, герой у шоці поруч, flash."],
  ];
  const ACCENTS = ["hud day або calendar (прогрес у днях)", "hud jar або counter (гроші)", "hud chat (листування, коментарі)", "hud clock (час летить)", "число на табличці або вивісці в сцені", "тінь-демон зі say", "fx rain / spot для настрою", "hud people або pie (статистика)", "split / compare (до-після)", "think-думки персонажів", "crowd на вулиці", "props у руці героя (hold)", "hud gauge або chart", "fx confetti / flash на перемозі", "loc-плашки зміни часу", "stamp на поворотах"];
  const MEM = { get: () => { try { return JSON.parse(localStorage.getItem("yvHookMem") || "[]"); } catch (e) { return []; } }, put: (q) => { try { const m = MEM.get(); m.push(q); localStorage.setItem("yvHookMem", JSON.stringify(m.slice(-6))); } catch (e) {} } };
  // фрази озвучки: ріжемо по . ! ? … : ; (а довгі — ще по , — ), щоб кожна фраза мала свою сцену
  function phrases(L, a0 = 0, a1 = L.words.length) { const W = L.words, out = []; let st = a0;
    const end = (w) => /[.!?…:;]["»)]*$/.test(w), soft = (w) => /[,—–]["»)]*$/.test(w) || w === "—" || w === "–";
    for (let i = a0; i < a1; i++) { const w = W[i].w, len = i - st + 1, nx = W[i + 1]?.w || "";
      const cut = i === a1 - 1 || end(w) || (soft(w) && len >= 4 && a1 - i > 2) || len >= 11 || (len >= 8 && /^(і|й|а|але|та|бо|що|щоб|коли|тому|якщо|поки|ніж|or|and|but)$/i.test(nx));
      if (cut) { out.push({ a: st, b: i, text: W.slice(st, i + 1).map((q) => q.w).join(" ") }); st = i + 1; } }
    for (let k = out.length - 1; k > 0; k--) if (out[k].b - out[k].a < 1 && !end(out[k].text)) { out[k - 1].b = out[k].b; out[k - 1].text += " " + out[k].text; out.splice(k, 1); }
    return out; }
  function variety(L) { if (L._var) return L._var; const mem = MEM.get(), used = new Set(mem.map((q) => q.h)), pool = HOOKS.filter(([k]) => !used.has(k)), hk = (pool.length ? pool : HOOKS)[Math.floor(Math.random() * (pool.length || HOOKS.length))];
    const acc = [...ACCENTS].sort(() => Math.random() - .5).slice(0, 4), sh = ["wide", "medium", "close", "face"][Math.floor(Math.random() * 4)];
    L._var = { h: hk[0], text: `РЕЦЕПТ ХУКА ДЛЯ ЦЬОГО РОЛИКА: ${hk[1]} (Рецепт — лише ФОРМА подачі; ЗМІСТ першого кадру — те, про що перша фраза. Якщо рецепт не пасує до змісту першої фрази — візьми інший прийом, що пасує, але НЕ шаблон «крупно + шок + напис».)\nАКЦЕНТИ ЦЬОГО РОЛИКА (лише там, де вони ПРЯМО підсилюють зміст фрази; зміст фрази завжди важливіший за акцент): ${acc.join("; ")}.\nПЕРЕВАЖНИЙ ПЛАН ДРУГОЇ СЦЕНИ: ${sh}.${mem.length ? `\nПопередні ролики цього автора починались так: ${[...new Set(mem.map((q) => q.h))].join(", ")} — НЕ повторюй їхні перші кадри й послідовність.` : ""}` };
    MEM.put({ h: hk[0] }); return L._var; }
  async function planPart(L, a0, a1, extra, prev) {
    const words = L.words.slice(a0, a1).map((w, k) => `${a0 + k}:${w.w}`).join(" "), PH = phrases(L, a0, a1);
    const ask = `Ти режисер вертикальних анімаційних Reels. Людина говорить за кадром. ${a0 > 0 ? `Це продовження ролика (слова ${a0}–${a1 - 1}); попередня сцена: ${prev || "—"}.` : `Це ${a1 < L.words.length ? "початок" : "весь"} ролик${a1 < L.words.length ? "у" : ""}.`} Дослівні слова з номерами:
${words}
${extra}
${L.pet && BREED[L.pet] ? `У героя є тварина: ${BREED[L.pet].dog ? "собака" : "кіт"} — ${BREED[L.pet].n} (who:"${BREED[L.pet].dog ? "dog" : "cat"}", breed:"${L.pet}"). Додавай її в сцени, де доречно (вдома, на прогулянці, у смішних і теплих моментах), — завжди цю саму.\n` : ""}${L.places?.length ? `Локації: використовуй ТІЛЬКИ ці — ${L.places.join(", ")} (і space для абстрактних пояснень).\n` : ""}${RULES}
${SPEC}
${a0 === 0 ? variety(L).text + "\n" : variety(L).text.split("\n").slice(1, 2).join("") + "\n"}${a0 === 0 ? `Визнач mood музики: ${Object.entries(MOODS).map(([k, v]) => `${k} (${v.n})`).join(", ")}.\n` : ""}ФРАЗИ ОЗВУЧКИ (номери слів):
${PH.map((f, k) => `Ф${k + 1} [${f.a}–${f.b}]: «${f.text}»`).join("\n")}
ВІЗУАЛЬНИЙ СТОРІТЕЛІНГ — ГОЛОВНЕ ПРАВИЛО: кожна фраза = своя окрема сцена, і картинка ІЛЮСТРУЄ саме те, що звучить у цю мить (глядач без звуку має зрозуміти зміст).
— a сцени = номер першого слова фрази. Фраза довша за 8 слів → 2 сцени (друга — з ключового слова всередині фрази), і друга показує наступну думку фрази.
— Іменники з фрази показуй предметами (props k або k:"icon", q:"англ. назва"), цифри й суми — tag/hud з цією цифрою, дії — позою й рухом героя (walk/run/phone/hold/sit…), місця — place, почуття — face, порівняння «до/після», «я/він» — compare/split або два персонажі, час — clock/calendar/day.
— Метафору фрази показуй буквально (напр. «гроші течуть крізь пальці» → герой з грошима, монети падають; «стіна» → crack/спалах).
— hit і cap.i ставь на слово з цієї ж фрази, яке несе зміст.
— Не вставляй сцен, яких немає у фразах, і не показуй те, про що ще не сказано.
Спершу в полі say напиши дослівну фразу, в see — що буквально в кадрі, і лише потім поля рушія, які це реалізують. Пиши JSON компактно, без зайвих полів (порожні props/hud/cap/hit не пиши).
Відповідай тільки JSON: ${PLAN_JSON}`;
    // якщо модель повертає порожньо — пробуємо з меншою базою знань (коротший контекст)
    const KBS = [["style", "edit", "story", "hook", "camera", "sound", "general"], ["style", "camera", "hook"], []];
    let err; for (let k = 0; k < 3; k++) { try { const r = await sample.json(ask, { cache: false, ...(k < 2 ? { sys: ["director"] } : {}), ...(KBS[k].length ? { kb: KBS[k] } : {}), max: k ? 3200 : 4000 }); if (Array.isArray(r?.scenes) && r.scenes.length) return r; err = new Error("plan_empty"); } catch (e) { err = e; if (/limit|login|no_key/.test(e?.message || "")) throw e; } }
    throw err; }
  async function aiPlan(L, extra = "") {
    const n = L.words.length, STEP = 70, parts = []; for (let a = 0; a < n; a += STEP) parts.push([a, Math.min(n, a + STEP)]);
    if (parts.length > 1 && parts[parts.length - 1][1] - parts[parts.length - 1][0] < 20) { const last = parts.pop(); parts[parts.length - 1][1] = last[1]; }
    { const st = phrases(L).map((f) => f.a); for (let i = 1; i < parts.length; i++) { const b = parts[i][0], near = st.reduce((m, v) => Math.abs(v - b) < Math.abs(m - b) ? v : m, st[0] ?? b); if (near > parts[i - 1][0] + 10 && near < parts[i][1] - 5) { parts[i - 1][1] = near; parts[i][0] = near; } } }
    let scenes = [], mood = null, fails = 0;
    const res = await Promise.all(parts.map(([a0, a1], i) => planPart(L, a0, a1, extra, i ? "продовжуй той самий стиль і героя" : "").then((r) => r, (e) => { if (/limit|login|no_key/.test(e?.message || "")) throw e; fails++; L._planErr = String(e?.message || e?.code || e).slice(0, 60); return null; })));
    res.forEach((r, i) => { const [a0, a1] = parts[i]; if (!i && MOODS[r?.mood]) mood = r.mood;
      const ok = (r?.scenes || []).filter((s) => Number.isInteger(s?.a) && s.a >= a0 && s.a < a1);
      if (ok.length) { if (ok[0].a !== a0) ok[0].a = a0; scenes.push(...ok); } else scenes.push(...autoPlan(L, a0, a1)); });
    L.scenes = normPlan({ scenes }, L); if (mood) L.mood = mood; L._auto = fails === parts.length; return L; }
  // автоплан без AI: сцени кожні ~6 слів, різні локації й плани, написи на ключових місцях
  function autoPlan(L, a0, a1) { const sd = Math.floor(hsh(L.key || Math.random()) * 1e6), rot = (A) => A.map((_, i) => A[(i + sd) % A.length]);
    const P = rot(L.places?.length ? [...L.places, "space"] : ["space", "room", "office", "street", "blog", "cafe", "road", "park", "night", "lab"]), SH = rot(["close", "wide", "face", "medium", "wide", "close", "medium"]), CM = rot(["shake", "pan_r", "push", "pull", "pan_l", "push", "punch"]), PO = rot(["shock", "walk", "think", "point", "run", "shrug", "cheer", "phone", "sad"]), FA = rot(["shock", "worried", "smirk", "happy", "angry", "sad"]), out = [];
    for (let a = a0, i = Math.floor(a0 / 5); a < a1; a += 5, i++) { const sp = P[(i >> 1) % P.length] === "space", s = { a, place: P[(i >> 1) % P.length], time: ["day", "sunset", "night"][(i >> 2) % 3], shot: SH[i % SH.length], cam: CM[i % CM.length], tr: i ? (i % 3 === 0 ? "whip" : "cut") : "cut",
      cast: [{ who: "hero", x: (i % 2 ? .38 : .58), pose: PO[i % PO.length], face: FA[i % FA.length], to: PO[i % PO.length] === "walk" || PO[i % PO.length] === "run" ? (i % 2 ? .7 : .3) : undefined }] };
      if (sp) s.hud = { k: ["brain", "chart", "rings", "counter"][i % 4], i: a, v: 1 };
      else if (L.pet && BREED[L.pet] && i % 2 === 0) s.cast.push({ who: BREED[L.pet].cat ? "cat" : "dog", breed: L.pet, x: .76, pose: ["stand", "sit", "talk"][i % 3] });
      if (i % 3 === 0) { const ws = L.words.slice(a, Math.min(a1, a + 4)).map((w) => w.w.replace(/[.,!?…:;«»"]/g, "")); if (ws.length) { ws[ws.length - 1] = "*" + ws[ws.length - 1] + "*"; s.cap = { t: ws.join(" ").toUpperCase(), i: a }; } }
      out.push(s); }
    return out; }
  async function aiEdit(L, text) {
    const strip = L.scenes.filter((z) => !z.ad).map(({ t0, t1, hitT, seed, dir, ...s }) => ({ ...s, props: (s.props || []).map(({ at, ...p }) => p), hud: s.hud ? (({ at, ...h }) => ({ ...h, y: +(h.y / H).toFixed(2) }))(s.hud) : null, cap: s.cap ? (({ at, ...c }) => c)(s.cap) : null }));
    const r = await sample.json(`Ти режисер вертикальної кіно-анімації. Слова озвучки з номерами:
${numbered(L)}
${SPEC}
Поточний план (JSON): ${JSON.stringify({ mood: L.mood, scenes: strip })}
Людина просить змінити: «${text}». Зміни лише те, про що просять. Музика — поле mood (${Object.keys(MOODS).join(", ")}).
Відповідай тільки JSON: {"mood":"…","scenes":[…повний новий список…],"say":"одне коротке речення — що зроблено"}`, { cache: false, sys: ["director"], kb: ["style", "edit", "general"], max: 8000 });
    if (Array.isArray(r?.scenes) && r.scenes.length) L.scenes = normPlan(r, L); if (MOODS[r?.mood]) L.mood = r.mood; return r?.say || "Готово."; }
  /* ---------- автоперевірка: AI-редактор дивиться кадри першого варіанта й виправляє план (1 прохід) ---------- */
  // контакт-аркуші: по кадру з кожної сцени (до 36), 4×3 на аркуш, з номером сцени й часом
  function contactSheets(L) { const sc = L.scenes.map((z, i) => [z, i]).filter(([z]) => !z.ad), N = sc.length, pick = N <= 36 ? sc : Array.from({ length: 36 }, (_, k) => sc[Math.floor(k * N / 36)]);
    const TW = 240, TH = 427, out = [], big = document.createElement("canvas"); big.width = TW; big.height = TH; const bx = big.getContext("2d");
    for (let p = 0; p < pick.length; p += 12) { const part = pick.slice(p, p + 12), cv = document.createElement("canvas"); cv.width = TW * 4; cv.height = TH * Math.ceil(part.length / 4); const x = cv.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, cv.width, cv.height);
      part.forEach(([z, i], k) => { const t = Math.min(z.t1 - .05, z.t0 + Math.min(1.1, (z.t1 - z.t0) * .6)); try { drawFrame(bx, L, t, TW, TH); } catch (e) {} const X = (k % 4) * TW, Y = Math.floor(k / 4) * TH; x.drawImage(big, X, Y);
        x.fillStyle = "rgba(0,0,0,.7)"; x.fillRect(X, Y, 118, 30); x.fillStyle = "#ffe14d"; x.font = "700 20px system-ui,sans-serif"; x.textBaseline = "middle"; x.fillText(`#${i} ${z.t0.toFixed(1)}с`, X + 6, Y + 15); x.strokeStyle = "#000"; x.lineWidth = 2; x.strokeRect(X, Y, TW, TH); });
      out.push({ mime: "image/jpeg", data: cv.toDataURL("image/jpeg", .72).split(",")[1] }); if (out.length >= 3) break; }
    return out; }
  // зауваження, які видно без AI (тривалість, повтори, хук, написи)
  function autoChecks(L) { const S = L.scenes, out = []; const ns = S.filter((z) => !z.ad);
    if (ns[0] && ns[0].cam === "still" && !ns[0].hud && !ns[0].fx?.length && !ns[0].cap && !ns[0].cast?.some((c) => c.tag || c.say || c.think || c.to != null)) out.push("перша сцена статична й порожня: у ній має щось відбуватися на ключовому слові");
    if (ns[1] && ns[1].t0 > 2.2) out.push(`друга сцена з'являється лише на ${ns[1].t0.toFixed(1)} с`);
    S.forEach((z, i) => { if (z.ad) return; const d = z.t1 - z.t0; if (d > 3.6) out.push(`сцена #${i} триває ${d.toFixed(1)} с — задовго`);
      const q = S[i + 1]; if (q && !q.ad && q.place === z.place && q.shot === z.shot) out.push(`сцени #${i} і #${i + 1}: однакові локація й план`);
      if (q && !q.ad && q.hud && z.hud && q.hud.k === z.hud.k) out.push(`сцени #${i} і #${i + 1}: однаковий HUD ${z.hud.k}`);
      if (z.cam === "still" && d > 1.6) out.push(`сцена #${i}: нерухома камера ${d.toFixed(1)} с`); });
    let last = 0; S.forEach((z, i) => { if (z.ad) return; if (z.tr === "whip" || z.cam === "shake" || z.shot === "face" || (z.cap && z.cap.k !== "note")) { if (z.t0 - last > 8) out.push(`між ${last.toFixed(0)} і ${z.t0.toFixed(0)} с немає жодного «удару» (whip/shake/face/напис)`); last = z.t0; } });
    const caps = ns.filter((z) => z.cap).length; if (ns.length > 4 && caps < ns.length / 5) out.push("замало написів на екрані"); if (caps > ns.length * .75) out.push("написи майже в кожній сцені — перевантаження");
    { const st = ns.map((z) => z.a); const AR = L.adRange || [-1, -1], miss = phrases(L).filter((f) => f.b - f.a >= 3 && !(f.a >= AR[0] && f.b <= AR[1]) && !st.some((v) => v >= f.a && v <= f.b)).map((f) => `«${f.text.slice(0, 40)}»`); if (miss.length) out.push(`фрази без власної сцени (візуал не змінився під них): ${miss.slice(0, 6).join(", ")}`); }
    const lastS = ns[ns.length - 1]; if (lastS && L.dur - lastS.t0 > 4.5) out.push("остання сцена задовга — фінал провисає");
    return out.slice(0, 25); }
  async function aiReview(L, hint = "") { if (!L?.scenes?.length) return null; timeline(L);
    const strip = L.scenes.map((z, i) => [z, i]).filter(([z]) => !z.ad).map(([{ t0, t1, hitT, seed, dir, ...z }, i]) => ({ n: i, d: +(t1 - t0).toFixed(1), ...z, props: (z.props || []).map(({ at, ...p }) => p), hud: z.hud ? (({ at, ...h }) => ({ ...h, y: +(h.y / H).toFixed(2) }))(z.hud) : undefined, cap: z.cap ? (({ at, ...c }) => c)(z.cap) : undefined }));
    let imgs = []; try { imgs = contactSheets(L); } catch (e) {}
    const auto = autoChecks(L);
    const r = await sample.json(`ПЕРЕВІРКА ПЕРШОГО ВАРІАНТА РОЛИКА (${Math.round(L.dur)} с).
Слова озвучки з номерами:
${numbered(L)}
${hint}
Фрази озвучки: ${phrases(L).map((f, k) => `Ф${k + 1}[${f.a}–${f.b}] «${f.text}»`).join(" | ")}
ГОЛОВНА ПЕРЕВІРКА: чи кожна фраза має свою сцену і чи картинка буквально показує те, що звучить у цей момент (поле see — задум, кадри — що вийшло насправді). Сцена, де візуал не про цю фразу (загальний герой «говорить», випадковий предмет, HUD не про те), — виправ через fix, щоб кадр ілюстрував фразу.
${L._var?.text || ""}
${SPEC}
План (n — номер сцени на кадрах, d — тривалість, с):
${JSON.stringify({ mood: L.mood, scenes: strip })}
Автоматичні зауваження: ${auto.length ? auto.map((q) => "— " + q).join("\n") : "немає"}
${imgs.length ? `Контакт-аркуші: ${imgs.length} зображ., на кожному кадрі — номер сцени й час.` : ""}
Знайди проблеми й виправ. Відповідай тільки JSON:
{"issues":["коротко, що було не так"],"mood":"…","fix":[{повна нова сцена у форматі плану, з полем a — сцена з таким самим a замінюється; новий a — додається}],"drop":[a сцен, які прибрати]}
Якщо все добре — {"issues":[],"fix":[],"drop":[]}.`, { cache: false, sys: ["director", "critic"], kb: ["style", "edit", "camera", "hook", "general"], images: imgs, max: 6000 });
    const fix = Array.isArray(r?.fix) ? r.fix.filter((z) => Number.isInteger(z?.a) && z.a >= 0 && z.a < L.words.length) : [], drop = new Set(Array.isArray(r?.drop) ? r.drop.filter(Number.isInteger) : []);
    if (!fix.length && !drop.size) return { issues: r?.issues || [], n: 0 };
    const back = (z) => ({ ...z, hud: z.hud ? { ...z.hud, y: z.hud.y != null ? z.hud.y : undefined } : z.hud });
    const cur = L.scenes.filter((z) => !z.ad).map(({ t0, t1, hitT, seed, dir, ...z }) => ({ ...z, props: (z.props || []).map(({ at, ...p }) => p), hud: z.hud ? (({ at, ...h }) => ({ ...h, y: +(h.y / H).toFixed(2) }))(z.hud) : null, cap: z.cap ? (({ at, ...c }) => c)(z.cap) : null }));
    const by = new Map(cur.map((z) => [z.a, z])); drop.forEach((a) => { if (a !== 0) by.delete(a); }); fix.forEach((z) => by.set(z.a, back(z)));
    const next = [...by.values()].sort((p, q) => p.a - q.a); if (next.length < Math.max(2, cur.length * .5)) return { issues: r?.issues || [], n: 0 };
    const keep = { scenes: L.scenes, mood: L.mood };
    try { L.scenes = normPlan({ scenes: next }, L); if (MOODS[r?.mood]) L.mood = r.mood; } catch (e) { Object.assign(L, keep); return { issues: [], n: 0 }; }
    L._review = { issues: (r?.issues || []).slice(0, 12).map(String), n: fix.length + drop.size }; return L._review; }
  async function aiText(topic, sec, silent, scn) { const S = SCRIPTS[scn], want = Math.round(sec * (silent ? 1.6 : FIT.wps * FIT.base / FIT.sq * 1.04));
    const ask = `Напиши ${silent ? "текст для анімаційного Reels БЕЗ голосу — він іде на екрані субтитрами, короткі речення по 4–9 слів" : "текст для озвучки за кадром — жива розмовна українська, як людина говорить другу"} на тему: «${topic}».
Формат: вертикальне кіно-анімаційне відео (герой-чоловічок, сцени змінюються кожні 2–4 с) ≈ ${sec} с. Мета — вірусність: людина має додивитися до кінця й захотіти переслати. Перше речення — сильний гачок-питання або несподіваний факт (до 10 слів, без розгону); одразу відкрий петлю, яку закриєш лише у фіналі; кожні 5–7 с — нова міні-інтрига чи поворот; далі історія героя з поворотом (але/тому), конкретні числа й образи, які легко показати; фінал — сильне коротке ствердження (НЕ питання і не заклик подумати), яке замикає петлю з початком.
${S ? `СТРУКТУРА СЦЕНАРІЮ «${S.n}» — дотримуйся саме її, по черзі: ${S.p}. Не підписуй частини — текст суцільний, живий.\n` : ""}Обсяг — ${want}–${want + 8} слів (не менше ${want}: озвучку потім пришвидшимо й приберемо паузи). Без хештегів, емодзі, ремарок і заголовків. Відповідай тільки JSON {"text":"…"}`;
    // якщо з базою знань не вийшло (довгий контекст, збій) — ще раз коротше, без неї
    let err; for (const o of [{ kbFmt: "tall", kb: ["hook", "script", "story", "general"], max: 3000 }, { max: 2500 }]) { try { const r = await sample.json(ask, { cache: false, ...o }); const t = String(r?.text || (typeof r === "string" ? r : "")).trim(); if (t.split(/\s+/).length >= 12) return t; err = new Error("empty"); } catch (e) { err = e; if (/limit|login|no_key/.test(e?.code || e?.message || "")) throw e; } }
    throw err; }

  /* ---------- голос і слова ---------- */
  function wordsFromText(text) { const ws = []; let t = .7; String(text).split(/\s+/).filter(Boolean).forEach((w) => { const d = .22 + Math.min(.5, w.length * .05); ws.push({ w, s: t, e: t + d }); t += d + .08; if (/[.!?…]$/.test(w)) t += .55; else if (/[,:;—–]$/.test(w)) t += .22; }); return { ws, dur: t + 1.2 }; }
  const b64Buf = (b) => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  async function ttsAudio(text, voice) { const r = await SRV.tts({ text: String(text).trim().slice(0, 2400), voice, quiet: true }); return E().decode(b64Buf(r.audio)); }
  const TTS_ERR = { free_limit: "Безкоштовна озвучка готовими голосами на сьогодні закінчилась (30 хв на добу)", no_clone_quota: "Озвучка твоїм голосом — окрема функція. Підключи її", no_quota: "Хвилини озвучки закінчились", no_key: "Озвучка тимчасово недоступна", no_clone: "Спершу створи свій голос", bad_voice: "Цей голос недоступний — вибери інший", busy: "Сервіс озвучки перевантажений, спробуй за хвилину", empty_text: "Немає тексту для озвучки" };
  async function sttWords(y) { const small = await E().resample(y, E().SR, 16000), dur = y.length / E().SR, WIN = 200 * 16000, words = [];
    for (let o = 0; o < small.length; o += WIN) { const r = await SRV.stt({ audio: E().b64(E().wav(small.subarray(o, Math.min(small.length, o + WIN)), 16000)), mime: "audio/wav", quiet: true }), off = o / 16000;
      (r.words || []).forEach((w) => { if (String(w.w).trim()) words.push({ w: String(w.w), s: off + Math.max(0, +w.s || 0), e: Math.min(dur, off + Math.max((+w.s || 0) + .05, +w.e || 0)) }); }); }
    return words; }

  /* ---------- програвач і збереження ---------- */
  let L = null, PL = null;
  function stopPlay() { if (!PL) return; cancelAnimationFrame(PL.raf); try { PL.src.stop(); } catch (e) {} const o = PL.onend; PL = null; o?.(); }
  async function playFrom(t0, cv, o = {}) { stopPlay(); const ac = AC(); try { await ac.resume(); } catch (e) {}
    const x = cv.getContext("2d"), b = ac.createBuffer(1, L.aud.length, E().SR); b.copyToChannel(L.aud, 0); const src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination);
    const st = ac.currentTime + .06; src.start(st, t0); PL = { src, raf: 0, onend: o.onend };
    const loop = () => { if (!PL) return; const t = t0 + ac.currentTime - st; if (t >= L.dur) { drawFrame(x, L, L.dur - .01, cv.width, cv.height); o.after?.(x); stopPlay(); return; } drawFrame(x, L, Math.max(0, t), cv.width, cv.height); o.after?.(x); o.tick?.(t); if (o.until && t >= o.until) { stopPlay(); return; } PL.raf = requestAnimationFrame(loop); };
    PL.raf = requestAnimationFrame(loop); }
  async function exportVideo(onProg) {
    await loadFont(); try { await document.fonts?.ready; } catch (e) {}
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const x = cv.getContext("2d", { alpha: false });
    try { return await exportFast(cv, x, onProg); } catch (e) { if (e?.message === "noenc_hard") throw e; console.warn("cine export → realtime", e); track("exp_fallback", { v: String(e?.message || e).slice(0, 30) }); return exportRT(cv, x, onProg); } }
  async function exportFast(cv, x, onProg) {
    const M = await import("https://cdn.jsdelivr.net/npm/mediabunny@1.45.0/+esm"); if (!window.VideoEncoder) throw new Error("noenc");
    const BR = 8e6, can = (c) => M.canEncodeVideo(c, { width: W, height: H, bitrate: BR }).catch(() => false);
    const vc = (await can("avc")) ? "avc" : (await can("vp9")) ? "vp9" : null; if (!vc) throw new Error("noenc");
    const aac = vc === "avc" && await M.canEncodeAudio("aac").catch(() => false), webm = vc !== "avc";
    const out = new M.Output({ format: webm ? new M.WebMOutputFormat() : aac ? new M.Mp4OutputFormat({ fastStart: "in-memory" }) : new M.MovOutputFormat({ fastStart: "in-memory" }), target: new M.BufferTarget() });
    const vs = new M.CanvasSource(cv, { codec: vc, bitrate: BR, keyFrameInterval: 2 }), as = new M.AudioBufferSource(webm ? { codec: "opus", bitrate: 160e3 } : aac ? { codec: "aac", bitrate: 192e3 } : { codec: "pcm-s16" });
    out.addVideoTrack(vs, { frameRate: FPS }); out.addAudioTrack(as); await out.start();
    const SR = E().SR, A = L.aud; let aPos = 0;
    const push = async (upto) => { upto = Math.min(A.length, Math.round(upto)); if (upto <= aPos) return; const ab = new AudioBuffer({ length: upto - aPos, numberOfChannels: 2, sampleRate: SR }), part = A.subarray(aPos, upto); ab.copyToChannel(part, 0); ab.copyToChannel(part, 1); aPos = upto; await as.add(ab); };
    const N = Math.max(1, Math.round(L.dur * FPS));
    for (let i = 0; i < N; i++) { if (i % FPS === 0) await push((i / FPS + 1) * SR); drawFrame(x, L, Math.min(i / FPS, L.dur - .001)); await vs.add(i / FPS, 1 / FPS); onProg?.((i + 1) / N * .98); if (i % 15 === 0) await new Promise((r) => setTimeout(r)); }
    await push(A.length); vs.close(); as.close(); await out.finalize(); onProg?.(1);
    const [type, ext] = webm ? ["video/webm", "webm"] : aac ? ["video/mp4", "mp4"] : ["video/quicktime", "mov"];
    return { blob: new Blob([out.target.buffer], { type }), ext }; }

  async function exportRT(cv, x, onProg) { const ac = AC(); try { await ac.resume(); } catch (e) {} const dest = ac.createMediaStreamDestination(), stream = cv.captureStream(FPS); dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mime = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)); if (!mime) throw new Error("noenc");
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10e6 }), ch = []; rec.ondataavailable = (ev) => ev.data.size && ch.push(ev.data); const stopped = new Promise((r) => rec.onstop = r);
    const b = ac.createBuffer(1, L.aud.length, E().SR); b.copyToChannel(L.aud, 0); const src = ac.createBufferSource(); src.buffer = b; src.connect(dest);
    rec.start(500); const st = ac.currentTime + .1; src.start(st);
    await new Promise((res) => { const loop = () => { const t = ac.currentTime - st; if (t >= L.dur) return res(); drawFrame(x, L, Math.max(0, t)); onProg?.(clamp(t / L.dur)); requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
    await new Promise((r) => setTimeout(r, 250)); rec.stop(); await stopped; return { blob: new Blob(ch, { type: mime.split(";")[0] }), ext: mime.includes("mp4") ? "mp4" : "webm" }; }

  /* ---------- інтерфейс ---------- */
  const CSS = `#yvcn{position:fixed;inset:0;z-index:9000;background:#0b0b0d;color:#f5f5f7;display:flex;flex-direction:column;font:15px/1.45 var(--pfont,system-ui,-apple-system,sans-serif);padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
#yvcn *{box-sizing:border-box}#yvcn .ch{display:flex;align-items:center;justify-content:space-between;padding:10px 14px 4px}#yvcn .ch b{font-size:17px}
#yvcn .cx{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font-size:20px;cursor:pointer;display:grid;place-items:center}
#yvcn .tag{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#ff9f0a;color:#0b0b0d;font-size:10.5px;font-weight:800;vertical-align:2px}
#yvcn .cb{flex:1;min-height:0;display:flex;flex-direction:column;position:relative}#yvcn .scr{flex:1;min-height:0;overflow-y:auto;padding:0 14px 14px;-webkit-overflow-scrolling:touch}
#yvcn .cf{padding:8px 14px 12px;display:grid;gap:8px;border-top:1px solid rgba(255,255,255,.08)}
#yvcn .btn{width:100%;padding:13px;border-radius:15px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#f5f5f7;font-weight:700;font-size:15px;font-family:inherit;cursor:pointer;display:flex;gap:7px;align-items:center;justify-content:center}
#yvcn .btn.main{background:#f5f5f7;color:#0b0b0d;border-color:transparent}#yvcn .btn:disabled{opacity:.45}#yvcn .btn.rec{background:#ff453a;border-color:transparent;color:#fff}
#yvcn .txtp{max-height:30vh;overflow-y:auto;padding:10px 12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);font-size:14px;line-height:1.5;white-space:pre-wrap;color:#e4e4e7}
#yvcn .scst{margin:10px 0 0;padding:10px 12px 10px 30px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);font-size:13.5px;color:#d4d4d8;line-height:1.5}#yvcn .scst li{margin:2px 0}
#yvcn .pjl{display:grid;gap:8px}#yvcn .pj{display:flex;align-items:center;gap:11px;padding:8px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09)}
#yvcn .pj .pth{width:54px;height:96px;flex:none;border-radius:10px;background:#1c1c22 center/cover no-repeat;border:0;padding:0;cursor:pointer;position:relative}#yvcn .pj .pth:after{content:"▶";position:absolute;inset:auto 0 4px;text-align:center;font-size:12px;color:#fff;text-shadow:0 1px 3px #000}
#yvcn .pj .pi{flex:1;min-width:0}#yvcn .pj .pi b{display:block;font-size:14.5px;line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}#yvcn .pj .pi span{display:block;font-size:12px;color:#a1a1aa;margin-top:3px}
#yvcn .pj .pa{display:flex;flex-direction:column;gap:6px}#yvcn .pj .pa button{width:44px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#f5f5f7;font-size:17px;cursor:pointer}#yvcn .pj .pa button.warn{background:#ff453a;border-color:transparent;font-size:11px;font-weight:800}
#yvcn .pjempty{padding:28px 12px;text-align:center;color:#a1a1aa;font-size:14px;border:1.5px dashed rgba(255,255,255,.14);border-radius:16px}#yvcn .pjv{width:100%;max-height:62vh;border-radius:14px;background:#000;display:block;margin:0 auto 10px}
#yvcn .row{display:flex;gap:8px}#yvcn .row .btn:first-child{flex:1}#yvcn .btn.sq{width:52px;flex:none;padding:0;font-size:20px}
#yvcn .sec{margin-top:16px}#yvcn .sec h4{margin:0 0 8px;font-size:13.5px;color:#d4d4d8;font-weight:800}
#yvcn .chips{display:flex;flex-wrap:wrap;gap:6px}#yvcn .chip{padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e4e4e7;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer}#yvcn .chip[aria-pressed=true]{background:#f5f5f7;color:#0b0b0d}
#yvcn .dot{width:34px;height:34px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}#yvcn .dot[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 2px #0b0b0d inset}
#yvcn .styl{display:flex;gap:10px;align-items:center;padding:8px;border-radius:16px;border:1.5px solid #f5f5f7;background:rgba(255,255,255,.06)}#yvcn .styl canvas{width:96px;height:171px;border-radius:12px;flex:none;background:#222}#yvcn .styl b{display:block;font-size:15px}
#yvcn .btn:disabled{opacity:.45}
#yvcn .lk{position:sticky;top:-2px;z-index:3;display:grid;grid-template-columns:44% 1fr;gap:10px;align-items:start;background:#0b0b0d;padding:4px 0 10px}#yvcn .lk canvas{width:100%;aspect-ratio:9/16;border-radius:14px;background:#222;display:block}
#yvcn .lkb{display:flex;flex-direction:column;gap:8px}#yvcn .lkb button{padding:14px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#f5f5f7;font:700 15px/1.2 inherit;font-family:inherit;text-align:left;cursor:pointer}#yvcn .lkb button[aria-pressed="true"]{border-color:#dbe86b;background:rgba(219,232,107,.12)}
#yvcn .lkp{margin-top:4px}
#yvcn .vtop2{display:flex;justify-content:center;gap:8px;margin:0 0 8px}#yvcn .vtop2 button{padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e4e4e7;font:600 13px inherit;font-family:inherit}
#yvcn .etabs2{margin:16px 0 12px;padding-bottom:12px;border-bottom:2px dashed rgba(255,255,255,.14)}
#yvcn .arows{display:flex;flex-direction:column;gap:10px}#yvcn .arow2{display:flex;gap:10px;align-items:flex-start;padding:8px;border-radius:14px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.03)}#yvcn .arow2.on{border-color:#dbe86b}
#yvcn .arow2 canvas{width:54px;height:96px;border-radius:8px;flex:none;background:#222}#yvcn .arow2 .n{font-weight:800;font-size:13px}#yvcn .arow2 .ph{font-size:13px;color:#d4d4d8;line-height:1.35;margin-top:2px}
#yvcn .vtext{white-space:pre-wrap;font-size:15px;line-height:1.6;padding:12px;border-radius:12px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);max-height:40vh;overflow:auto}
#yvcn .fmtv{display:flex;gap:10px;align-items:flex-start}#yvcn .fmtv canvas{width:110px;height:196px;border-radius:12px;flex:none;background:#222}#yvcn .fmtl{display:flex;flex-direction:column;gap:6px;flex:1;min-width:0}
#yvcn .fmtc{text-align:left;padding:9px 11px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:#f5f5f7;font-family:inherit;cursor:pointer}#yvcn .fmtc b{display:block;font-size:14px}#yvcn .fmtc span{display:block;font-size:11.5px;color:#a1a1aa;line-height:1.3;margin-top:2px}
#yvcn .fmtc[aria-pressed="true"]{border-color:#dbe86b;background:rgba(219,232,107,.1)}#yvcn .fmtc.soonf{opacity:.55;border-style:dashed;cursor:default}
#yvcn .chip .skd{display:inline-block!important;position:static!important;width:12px!important;height:12px!important;border-radius:50%;margin:0 6px 0 0;vertical-align:-1px;border:1px solid rgba(255,255,255,.4)}
#yvcn .styl.soonf{margin-top:8px;border:1px dashed rgba(255,255,255,.2);background:transparent;opacity:.7;padding:12px}
#yvcn .steps{display:flex;gap:6px;margin:0 0 12px;font-size:12px;font-weight:700}
#yvcn .steps>*{flex:1;text-align:center;padding:6px 4px;border-radius:999px;background:rgba(255,255,255,.05);color:#71717a}
#yvcn .steps>b{background:#f5f5f7;color:#0b0b0d}
#yvcn .tpl{display:flex;flex-direction:column;gap:8px;margin-top:10px}
#yvcn .tpc{text-align:left;padding:12px 14px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:#f5f5f7;font:600 15px/1.3 inherit;font-family:inherit;cursor:pointer}
#yvcn .tpc[aria-pressed="true"]{border-color:#dbe86b;background:rgba(219,232,107,.1)}
#yvcn .tpcur{display:flex;gap:10px;align-items:center;justify-content:space-between}
#yvcn .tpcur b{font-size:16px;line-height:1.3}
#yvcn details.more>summary{cursor:pointer;font-weight:700;font-size:14px;color:#e4e4e7;padding:12px 14px;border-radius:14px;background:rgba(255,255,255,.05);list-style:none}
#yvcn details.more>summary::after{content:" ▾";color:#71717a}
#yvcn details.more[open]>summary{margin-bottom:10px}
#yvcn .fix{display:flex;flex-wrap:wrap;gap:6px}#yvcn .styl span{display:block;font-size:12.5px;color:#a1a1aa;margin-top:3px}
#yvcn .vopt{display:grid;gap:6px}#yvcn .vopt button{display:block;text-align:left;padding:10px 12px;border-radius:14px;border:1.5px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:inherit;font-family:inherit;cursor:pointer}#yvcn .vopt button[aria-pressed=true]{border-color:#f5f5f7;background:rgba(255,255,255,.1)}#yvcn .vopt b{display:block;font-size:14.5px}#yvcn .vopt span{display:block;font-size:12.5px;color:#a1a1aa}
#yvcn .tg{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1)}#yvcn .tg span{display:block;font-size:12.5px;color:#a1a1aa}
#yvcn .sw{flex:none;width:48px;height:29px;border-radius:999px;background:rgba(255,255,255,.2);border:0;position:relative;cursor:pointer}#yvcn .sw::after{content:"";position:absolute;top:3px;left:3px;width:23px;height:23px;border-radius:50%;background:#fff;transition:transform .18s}#yvcn .sw[aria-checked=true]{background:#30d158}#yvcn .sw[aria-checked=true]::after{transform:translateX(19px)}
#yvcn input.tx,#yvcn textarea{width:100%;padding:11px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font-size:15px;font-family:inherit;resize:none}
#yvcn .cnt{font-size:12.5px;color:#a1a1aa;margin:6px 2px 0}#yvcn .msg{margin:6px 14px 0;padding:8px 12px;border-radius:14px;background:rgba(255,214,10,.1);border:1px solid rgba(255,214,10,.3);color:#ffe27a;font-size:13px;text-align:center}
#yvcn .stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:6px}#yvcn .cvw{position:relative;border-radius:16px;overflow:hidden;background:#000;box-shadow:0 10px 30px rgba(0,0,0,.5)}#yvcn .cvw canvas{display:block;width:100%;height:100%}
#yvcn .pb{position:absolute;inset:0;display:grid;place-items:center;background:none;border:0;color:#fff;cursor:pointer}#yvcn .pb i{width:58px;height:58px;border-radius:50%;background:rgba(0,0,0,.45);display:grid;place-items:center;font-style:normal;font-size:24px}
#yvcn .seek{display:flex;align-items:center;gap:10px;padding:4px 16px 0}#yvcn .seek input{flex:1;accent-color:#f5f5f7}#yvcn .seek span{color:#a1a1aa;font-size:12px;font-variant-numeric:tabular-nums}
#yvcn .tools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}#yvcn .tools button{padding:9px 2px;border-radius:13px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#f5f5f7;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:grid;gap:3px;justify-items:center}#yvcn .tools i{font-style:normal;font-size:18px}
#yvcn .ask{display:flex;gap:6px}#yvcn .ask input{flex:1}
#yvcn .seek .chip{flex:none;padding:5px 10px;font-size:12px}
#yvcn .scs{display:flex;gap:6px;overflow-x:auto;padding:8px 14px 2px;scrollbar-width:none;flex:none}#yvcn .scs::-webkit-scrollbar{display:none}
#yvcn .scs button{flex:none;display:grid;gap:3px;justify-items:center;padding:3px;border-radius:10px;border:2px solid transparent;background:none;color:#a1a1aa;font:600 11px/1 inherit;font-family:inherit;cursor:pointer}#yvcn .scs button.on{border-color:#f5f5f7;color:#fff}#yvcn .scs canvas{width:46px;height:82px;border-radius:7px;display:block;background:#222}
#yvcn .cpanel{position:absolute;left:0;right:0;bottom:0;max-height:78%;z-index:5;background:#151518;border-top:1px solid rgba(255,255,255,.14);border-radius:20px 20px 0 0;display:flex;flex-direction:column;box-shadow:0 -10px 40px rgba(0,0,0,.5);padding-bottom:env(safe-area-inset-bottom)}
#yvcn .cph{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 4px}#yvcn .cph b{font-size:16px}#yvcn .cpb{overflow-y:auto;padding:4px 14px 18px;-webkit-overflow-scrolling:touch}
#yvcn .cpb .sec{margin-top:12px}#yvcn .cpb .chips .chip{padding:6px 10px;font-size:12.5px}`;
  const OPT = { col: "yellow", acc: "none", ad: "bio", adWord: "АНІМАЦІЯ", voice: "ai", subs: true, music: true, mood: "auto", sec: 45, places: [], subS: { k: "classic", size: 1, y: 1370 } };
  try { Object.assign(OPT, JSON.parse(localStorage.getItem("yvCineOpt") || "{}")); } catch (e) {}
  const saveOpt = () => { try { localStorage.setItem("yvCineOpt", JSON.stringify(OPT)); } catch (e) {} };
  const DRAFT = { topic: "", text: "", vid: "" }; try { Object.assign(DRAFT, JSON.parse(sessionStorage.getItem("yvCine") || "{}")); } catch (e) {}
  const saveDraft = () => { try { sessionStorage.setItem("yvCine", JSON.stringify(DRAFT)); } catch (e) {} };
  const UI = { root: null }; let DEMO = 0;
  function shell() { if (!document.getElementById("yvcncss")) { const st = document.createElement("style"); st.id = "yvcncss"; st.textContent = CSS; document.head.appendChild(st); }
    UI.root?.remove(); const d = document.createElement("div"); d.id = "yvcn"; d.innerHTML = `<div class="ch"><b>Анімаційні відео${isOwner() ? `<span class="tag">ТЕСТ</span>` : ""}</b><button class="cx" type="button" id="cclose" aria-label="Закрити">×</button></div><div class="cb"></div><div class="cf"></div>`;
    document.body.appendChild(d); UI.root = d; $(d, "#cclose").onclick = close; return d; }
  function close() { stopPlay(); cancelAnimationFrame(DEMO); UI.root?.remove(); UI.root = null; }
  const DEMOPLAN = () => ({ dur: 9, mood: "curious", subs: false, silent: true, fmt: OPT.fmt, hero: { col: OPT.col, acc: OPT.acc, skin: OPT.skin, hair: OPT.hair, hairC: OPT.hairC, beard: OPT.beard }, words: Array.from({ length: 30 }, (_, i) => ({ w: "", s: .3 + i * .3, e: .55 + i * .3 })), scenes: [
    { a: 0, place: "space", time: "night", shot: "wide", cam: "push", cast: [{ who: "hero", x: .5, pose: "shock", face: "shock" }], hud: { k: "brain", i: 1, y: 620 }, cap: { t: "ЩО ЯКБИ *ТИ*…", i: 0 } },
    { a: 10, place: "class", time: "sunset", shot: "medium", cam: "push", tr: "whip", cast: [{ who: "hero", x: .42, pose: "hold", face: "worried" }], props: [{ k: "card", t: "80", t2: "тест", hold: 1, i: 11 }] },
    { a: 20, place: "road", time: "sunset", shot: "wide", cam: "pan_r", tr: "whip", cast: [{ who: "hero", x: .3, to: .62, pose: "walk", face: "happy" }], cap: { t: "*3 ДНІ* ПОТОМУ", k: "title", i: 21 } }] });
  function demo(cv) { cancelAnimationFrame(DEMO); const P = DEMOPLAN(); timeline(P); const x = cv.getContext("2d"), t0 = performance.now(); const loop = () => { if (!cv.isConnected) return; const t = ((performance.now() - t0) / 1000) % P.dur; drawFrame(x, P, t, cv.width, cv.height); DEMO = requestAnimationFrame(loop); }; loop(); }
  const VOICES = [["ai", "Голос диктора", "Готові голоси студії — безкоштовно"], ["clone", "Мій голос (клон)", "Озвучка твоїм голосом · окрема функція"], ["rec", "Запишу сам", "Наговориш у мікрофон"], ["file", "Готовий запис", "Завантажиш аудіо чи відео"], ["none", "Без голосу", "Лише музика й субтитри"]];
  /* ---------- підпис під відео (копіюється) ---------- */
  const CAPT = { bio: "Це відео зроблене за кілька хвилин — без камери й монтажу. Спробувати безкоштовно — посилання в шапці профілю 👆", comment: "Напиши в коментарях {WORD} — надішлю посилання, щоб безкоштовно зробити своє таке відео." };
  const capPromo = (k, word) => CAPT[k === "comment" ? "comment" : "bio"].replace("{WORD}", String(word || "АНІМАЦІЯ").trim().toUpperCase());
  const DM_HINT = `<p class="cnt" style="margin:8px 0 0">Порада: увімкни автовідповідь у Direct на це слово (ManyChat або автовідповіді Instagram) — тоді посилання піде само, без ручних відповідей.</p>`;
  async function copyText(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const a = document.createElement("textarea"); a.value = t; a.style.cssText = "position:fixed;opacity:0;top:0"; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (x) {} a.remove(); return ok; } }
  async function capLine(L) { if (L.capLine != null) return L.capLine; const text = (L.words || []).map((w) => w.w).join(" ").slice(0, 700); let line = "";
    try { const r = await Promise.race([sample.json(`Напиши перший рядок підпису до Reels — він видно в стрічці й має чіпляти темою відео.
Відео: «${text}»${L.topic ? `\nТема: ${L.topic}` : ""}
До 9 слів, один доречний емодзі в кінці, без хештегів, без назв сервісів і без реклами. Відповідай тільки JSON {"line":"…"}`, { cache: false, max: 200 }), new Promise((_, j) => setTimeout(() => j(new Error("timeout")), 12000))]);
      line = String(r?.line || "").replace(/\s+/g, " ").trim(); if (line.split(" ").length > 14 || /yuvi|реклам/i.test(line)) line = ""; } catch (e) {}
    return (L.capLine = line || String(L.topic || "").trim()); }
  /* ---------- після збереження: на телефон або опублікувати (опис під кожну соцмережу) ---------- */
  const NETS = { ig: "Instagram", tt: "TikTok", yt: "YouTube Shorts" }, NETURL = { ig: "https://www.instagram.com/", tt: "https://www.tiktok.com/upload", yt: "https://studio.youtube.com/" };
  async function saveFile(f) { if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); return true; } catch (x) { if (x?.name === "AbortError") return false; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 6e4); return true; }
  async function netText(net) { L._net = L._net || {}; if (L._net[net]) return L._net[net];
    const kind = L.ad && L.ad !== "none" ? L.ad : (OPT.capK || "bio"), promo = capPromo(kind, L.ad === "comment" ? L.adWord : OPT.adWord), text = (L.words || []).map((w) => w.w).join(" ").slice(0, 800);
    const ask = { ig: `підпис для Instagram Reels: text — перший рядок-гачок до 9 слів з одним емодзі (його видно в стрічці), далі 1–2 короткі рядки, чому варто додивитись; tags — 5 доречних хештегів`, tt: `опис для TikTok: text — до 140 знаків, гачок + інтрига, один емодзі; tags — 4 доречні хештеги`, yt: `для YouTube Shorts: title — назва до 60 знаків з інтригою (чесна, без обману), text — опис 2 речення; tags — 4 доречні хештеги` }[net];
    let o = {}; try { o = await E().busyRun("text", () => Promise.race([sample.json(`Відео (текст озвучки): «${text}»${L.topic ? `\nТема: ${L.topic}` : ""}\nНапиши ${ask}. Українською, живо, без назв сервісів і без реклами (рекламний рядок додамо самі). Відповідай тільки JSON {"title":"…","text":"…","tags":["#…"]}`, { cache: false, sys: ["packaging"], max: 600, kb: ["title", "hook", "general"] }), new Promise((_, j) => setTimeout(() => j(new Error("timeout")), 20000))])) || {}; } catch (e) { console.warn("net text", e); }
    const t = String(o.text || "").trim() || (await capLine(L)) || String(L.topic || ""), tags = (Array.isArray(o.tags) ? o.tags : []).map((q) => "#" + String(q).replace(/^#+/, "").replace(/\s+/g, "")).filter((q) => q.length > 1).slice(0, 5).join(" ");
    const title = net === "yt" ? (String(o.title || "").trim() || String(L.topic || t).slice(0, 60)) : "";
    const body = net === "yt" ? `${t}\n\n${promo}\n\n${tags}${tags.includes("#shorts") ? "" : " #shorts"}`.trim() : net === "tt" ? `${t} ${promo} ${tags}`.trim() : `${t}\n\n${promo}\n\n${tags}`.trim();
    return (L._net[net] = { title, body }); }
  function donePanel(f) { if (!UI.root?.isConnected || !L) return;
    const P = panel("Відео готове ✓", `<div class="row"><button class="btn main" type="button" id="cdsv">⬇ Зберегти на телефон</button></div>
      <div class="sec"><h4>Опублікувати</h4><p class="cnt" style="margin:-4px 0 8px">Вибери соцмережу — напишу назву й опис саме під неї.</p><div class="chips">${Object.entries(NETS).map(([k, n]) => `<button class="chip" type="button" data-net="${k}">${n}</button>`).join("")}</div><div id="cnet" style="margin-top:10px"></div></div>`);
    P.querySelector("[data-pclose]").onclick = () => P.remove();
    P.querySelector("#cdsv").onclick = async (e) => { const b = e.currentTarget; if (await saveFile(f)) { b.textContent = "✓ Збережено"; track("save_phone"); } };
    const box = P.querySelector("#cnet");
    P.querySelectorAll("[data-net]").forEach((b) => b.onclick = async () => { const net = b.dataset.net; P.querySelectorAll("[data-net]").forEach((o) => o.setAttribute("aria-pressed", o === b)); box.innerHTML = `<p class="cnt">Пишу опис для ${NETS[net]}…</p>`;
      const r = await netText(net); if (!box.isConnected) return;
      box.innerHTML = `${net === "yt" ? `<label class="cnt" style="display:block;margin:0 0 4px">Назва</label><input class="tx" id="cnt0" maxlength="100" value="${escH(r.title)}"><div class="row" style="margin:6px 0 10px"><button class="btn" type="button" data-cp="cnt0">Скопіювати назву</button></div><label class="cnt" style="display:block;margin:0 0 4px">Опис</label>` : ""}
        <textarea class="tx" id="cnt1" rows="7" style="width:100%;resize:vertical">${escH(r.body)}</textarea><div class="row" style="margin-top:6px"><button class="btn" type="button" data-cp="cnt1">Скопіювати опис</button></div>
        <div class="row" style="margin-top:10px"><button class="btn main" type="button" id="cpub">📤 Поділитися в ${NETS[net]}</button></div><p class="cnt" style="margin:6px 0 0">Опис скопіюється сам — у застосунку встав його в підпис.${L.ad === "comment" || (L.ad === "none" && OPT.capK === "comment") ? " Порада: увімкни автовідповідь у Direct на слово з коментарів." : ""}</p>`;
      box.querySelectorAll("[data-cp]").forEach((q) => q.onclick = async () => { const ok = await copyText(box.querySelector("#" + q.dataset.cp).value); q.textContent = ok ? "✓ Скопійовано" : "Виділи й скопіюй вручну"; });
      box.querySelector("#cpub").onclick = async () => { const all = (net === "yt" ? box.querySelector("#cnt0").value + "\n\n" : "") + box.querySelector("#cnt1").value; await copyText(net === "yt" ? box.querySelector("#cnt0").value : all); track("publish", { v: net });
        if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (x) { if (x?.name === "AbortError") return; } }
        await saveFile(f); window.open(NETURL[net], "_blank", "noopener"); say("Відео збережено, опис скопійовано — завантаж відео в застосунку й встав опис"); }; }); }
  function capPanel() { if (!UI.root?.isConnected || !L) return; const k0 = L.ad && L.ad !== "none" ? L.ad : (OPT.capK || "bio"); let k = k0;
    const P = panel("Підпис до відео", `<p class="cnt" style="margin:0 0 8px">Відео збережене. Встав цей підпис під ним в Instagram чи TikTok:</p>
      ${L.ad && L.ad !== "none" ? "" : `<div class="chips" style="margin-bottom:8px">${["bio", "comment"].map((q) => `<button class="chip" type="button" data-ck="${q}" aria-pressed="${q === k}">${AD_KINDS[q]}</button>`).join("")}</div>`}
      <textarea class="tx" id="ccap" rows="5" style="width:100%;resize:vertical">Готую підпис…</textarea><div class="row" style="margin-top:8px"><button class="btn main" type="button" id="ccpy">Скопіювати</button></div><div id="cdm"></div>`);
    const ta = P.querySelector("#ccap"), fill = async () => { const ln = await capLine(L); ta.value = (ln ? ln + "\n\n" : "") + capPromo(k, L.ad === "comment" ? L.adWord : OPT.adWord); P.querySelector("#cdm").innerHTML = k === "comment" ? DM_HINT : ""; };
    P.querySelector("[data-pclose]").onclick = () => P.remove();
    P.querySelectorAll("[data-ck]").forEach((b) => b.onclick = () => { k = OPT.capK = b.dataset.ck; saveOpt(); P.querySelectorAll("[data-ck]").forEach((o) => o.setAttribute("aria-pressed", o === b)); fill(); });
    P.querySelector("#ccpy").onclick = async (e) => { const ok = await copyText(ta.value); e.currentTarget.textContent = ok ? "✓ Скопійовано" : "Виділи й скопіюй вручну"; track("caption_copy", { v: k }); };
    fill(); }
  /* ---------- крок 1: тема (можна нічого не писати — вибрати з переліку) ---------- */
  const TOPICS = {
    "Що буде, якщо": ["Що буде, якщо 30 днів не брати телефон у руки", "Що буде, якщо щодня спати по 5 годин", "Що буде, якщо відкладати 100 гривень щодня", "Що буде, якщо щодня знімати по одному відео", "Що буде, якщо тиждень ні на що не скаржитись", "Що буде, якщо загубити собаку в місті"],
    "Психологія": ["Чому ми відкладаємо важливе на потім", "Чому мозок любить погані новини", "Як тобою маніпулюють щодня, а ти не помічаєш", "Чому ми пам'ятаємо сором через десять років", "Ефект, через який ти купуєш непотрібне"],
    "Гроші": ["Як одна звичка з'їдає твою зарплату", "Скільки насправді коштує щоденна кава за 10 років", "Чому навіть із великою зарплатою не вистачає грошей", "Як заробити перші гроші на відео без підписників", "Чому багаті купують дешеве, а бідні — дороге"],
    "Факти": ["Найдорожча помилка в історії", "Що відбувається з тілом у космосі", "Людина, яка врятувала мільйони, а її ніхто не знає", "Чому літаки фарбують у білий"],
    "Тварини": ["Що думає собака, коли ти йдеш з дому", "Чому коти скидають речі зі столу", "Як собака знаходить дорогу додому за 50 кілометрів"],
    "Саморозвиток": ["Що зміниться, якщо вставати о 5 ранку", "Як за рік стати іншою людиною", "Чому дисципліна сильніша за мотивацію", "Що буде з тілом, якщо щодня проходити 10 000 кроків"] };
  let TCAT = "Що буде, якщо";
  // оновлені теми категорій пам'ятаємо (оновлюється лише та категорія, яку людина оновила)
  try { const sv = JSON.parse(localStorage.getItem("yvTopics") || "null"); if (sv && typeof sv === "object") Object.keys(TOPICS).forEach((k) => { if (Array.isArray(sv[k]) && sv[k].length) TOPICS[k] = sv[k].slice(0, 12); }); } catch (e) {}
  const saveTopics = () => { try { localStorage.setItem("yvTopics", JSON.stringify(TOPICS)); } catch (e) {} };
  let TOPEN = false;
  // реклама вибирається щоразу явно (кнопка «Написати текст» активна лише після вибору)
  let AD_PICK = null;
  const STEPS = (n) => `<div class="steps">${["Тема", "Сценарій", "Голос", "Герої", "Відео"].map((q, i) => i + 1 === n ? `<b>${i + 1} ${q}</b>` : `<span>${i + 1} ${q}</span>`).join("")}</div>`;
  /* ---------- «Мої відео»: готові ролики з файлами (сховище media/<uid>/cine) ---------- */
  const fmtDate = (ms) => { try { return new Date(ms).toLocaleDateString("uk-UA", { day: "numeric", month: "short" }) + ", " + new Date(ms).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };
  const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
  const fmtMB = (b) => b ? (b / 1048576).toFixed(b > 1e7 ? 0 : 1) + " МБ" : "";
  async function screenProjects(msg) { stopPlay(); const d = shell(), B = $(d, ".cb"), F = $(d, ".cf"); F.innerHTML = "";
    B.innerHTML = `${msg ? `<div class="msg">${escH(msg)}</div>` : ""}<div class="scr"><button class="btn main" type="button" id="cnew" style="margin:6px 0 14px">＋ Створити відео</button>
      <div class="sec"><h4>Мої відео</h4><div class="pjl" id="cpl"><p class="cnt">Завантажую…</p></div></div></div>`;
    $(B, "#cnew").onclick = () => { track("proj_new"); screenTopic(); };
    let list = []; try { list = await SRV.cineList(); } catch (e) { if (!UI.root?.isConnected) return; $(B, "#cpl").innerHTML = `<p class="cnt">Не вдалося завантажити список. Перевір інтернет і відкрий ще раз.</p>`; return; }
    if (!UI.root?.isConnected || !$(B, "#cpl")) return; const box = $(B, "#cpl");
    if (!list.length) { box.innerHTML = `<div class="pjempty">Тут з'являтимуться твої готові відео — з файлами, які можна скачати будь-коли.<br><br>Натисни «Створити відео», щоб зробити перше.</div>`; return; }
    box.innerHTML = list.map((v, i) => `<div class="pj" data-i="${i}"><button class="pth" type="button" data-play="${i}" aria-label="Переглянути" style="background-image:url('${escH(v.thumb || "")}')"></button>
      <div class="pi"><b>${escH(v.title || "Відео")}</b><span>${escH(fmtDate(v.created))} · ${fmtDur(v.dur || 0)}${v.size ? " · " + fmtMB(v.size) : ""}</span>${v.fmtN ? `<span>${escH(v.fmtN)}</span>` : ""}</div>
      <div class="pa"><button type="button" data-dl="${i}" aria-label="Скачати">⬇</button><button type="button" data-del="${i}" aria-label="Видалити">🗑</button></div></div>`).join("");
    const getFile = async (v, b) => { const old = b?.textContent; if (b) { b.disabled = true; b.textContent = "…"; } try { const bl = await SRV.cineGet(v); return new File([bl], `${(v.title || "video").replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40) || "video"}.${v.ext}`, { type: bl.type || (v.ext === "mp4" ? "video/mp4" : "video/" + v.ext) }); } catch (e) { say("Не вдалося завантажити файл"); return null; } finally { if (b?.isConnected) { b.disabled = false; b.textContent = old; } } };
    box.querySelectorAll("[data-dl]").forEach((b) => b.onclick = async () => { const f = await getFile(list[+b.dataset.dl], b); if (f && await saveFile(f)) { track("proj_dl"); say("✓ Збережено"); } });
    box.querySelectorAll("[data-play]").forEach((b) => b.onclick = async () => { const v = list[+b.dataset.play], f = await getFile(v, null); if (!f || !UI.root?.isConnected) return; const u = URL.createObjectURL(f);
      const P = panel(v.title || "Відео", `<video class="pjv" src="${u}" controls autoplay playsinline></video><button class="btn main" type="button" id="cpsv">⬇ Зберегти на телефон</button>`);
      P.querySelector("[data-pclose]").onclick = () => { URL.revokeObjectURL(u); P.remove(); }; P.querySelector("#cpsv").onclick = async (e) => { if (await saveFile(f)) e.currentTarget.textContent = "✓ Збережено"; }; });
    box.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { if (!b.classList.contains("warn")) { b.classList.add("warn"); b.textContent = "Так?"; setTimeout(() => { if (b.isConnected) { b.classList.remove("warn"); b.textContent = "🗑"; } }, 3000); return; }
      b.disabled = true; try { await SRV.cineDel(list[+b.dataset.del]); track("proj_del"); screenProjects("Відео видалено"); } catch (e) { b.disabled = false; say("Не вдалося видалити"); } }); }
  // після збереження — копія в «Мої відео» (файл + обкладинка + назва)
  async function cloudSave(f) { if (!window.SRV?.cineSave || !SRV.session || !L) return null;
    let thumb = null; try { const c = document.createElement("canvas"); c.width = 360; c.height = 640; const x = c.getContext("2d"), s0 = L.scenes.find((z) => !z.ad) || L.scenes[0], t = Math.min(L.dur - .1, (s0?.t0 || 0) + 1.2); drawFrame(x, L, t, 360, 640); thumb = await new Promise((r) => c.toBlob(r, "image/jpeg", .82)); } catch (e) {}
    const ext = (f.name.split(".").pop() || "mp4").toLowerCase(), title = String(L.topic || (L.words || []).slice(0, 8).map((w) => w.w).join(" ") || "Відео").trim().slice(0, 80);
    try { await SRV.cineSave({ id: String(L.key || "v" + Date.now().toString(36)).replace(/[^a-z0-9_-]/gi, ""), ext, title, dur: Math.round(L.dur), fmt: L.fmt, fmtN: FMTS[L.fmt]?.n || "" }, f, thumb); track("proj_save"); return "ok"; }
    catch (e) { console.warn("cloudSave", e); return e?.message === "too_big" ? "too_big" : "err"; } }
  function screenTopic(msg) { stopPlay(); const d = shell(), B = $(d, ".cb"), F = $(d, ".cf");
    const list = () => (TOPICS[TCAT] || []).map((t) => `<button type="button" class="tpc" data-tp="${escH(t)}" aria-pressed="${DRAFT.topic === t}">${escH(t)}</button>`).join("");
    B.innerHTML = `${msg ? `<div class="msg">${escH(msg)}</div>` : ""}<div class="scr">${window.SRV?.session ? `<button class="btn" type="button" id="cmyv" style="margin:4px 0 10px;padding:9px">📁 Мої відео</button>` : ""}${STEPS(1)}
      <div class="sec"><h4>1 · Тема — це твій хук</h4><input class="tx" id="ctopic" placeholder="Своя тема, напр.: чому ми боїмося починати" value="${escH(DRAFT.topic)}">
        <button class="btn tgl" type="button" id="ctgl" aria-expanded="${TOPEN}" style="margin-top:8px;display:flex;justify-content:space-between;align-items:center"><span>Або обери готову тему</span><span id="ctgla">${TOPEN ? "▴" : "▾"}</span></button>
        <div id="cpick"${TOPEN ? "" : " hidden"} style="margin-top:10px"><div class="chips" id="ccats">${Object.keys(TOPICS).map((k) => `<button class="chip" type="button" data-cat="${escH(k)}" aria-pressed="${k === TCAT}">${escH(k)}</button>`).join("")}</div>
        <div class="tpl" id="ctpl">${list()}</div><button class="btn" type="button" id="cmore" style="margin-top:8px">↻ Інші теми в цій категорії</button></div></div>
</div>`;
    F.innerHTML = `<button class="btn main" type="button" id="cnext">Далі →</button>`; { const mv = $(B, "#cmyv"); if (mv) mv.onclick = () => screenProjects(); }
    const nb = $(F, "#cnext"), upd = () => { const ok = !!DRAFT.topic.trim(); nb.disabled = !ok; nb.textContent = ok ? "Далі →" : "Напиши або обери тему"; };
    const setOpen = (v) => { TOPEN = v; const pk = $(B, "#cpick"), tg = $(B, "#ctgl"); if (pk) pk.hidden = !v; if (tg) tg.setAttribute("aria-expanded", v); const ar = $(B, "#ctgla"); if (ar) ar.textContent = v ? "▴" : "▾"; };
    const bind = () => B.querySelectorAll("[data-tp]").forEach((b) => b.onclick = () => { DRAFT.topic = b.dataset.tp; saveDraft(); $(B, "#ctopic").value = DRAFT.topic; B.querySelectorAll("[data-tp]").forEach((o) => o.setAttribute("aria-pressed", o === b)); track("topic_pick", { v: TCAT }); setOpen(false); upd(); });
    $(B, "#ctgl").onclick = () => setOpen(!TOPEN);
    bind();
    $(B, "#ctopic").oninput = (e) => { const v = e.target.value.trim(); DRAFT.topic = v; B.querySelectorAll("[data-tp]").forEach((o) => o.setAttribute("aria-pressed", o.dataset.tp === v)); saveDraft(); upd(); };
    B.querySelectorAll("[data-cat]").forEach((b) => b.onclick = () => { TCAT = b.dataset.cat; B.querySelectorAll("[data-cat]").forEach((o) => o.setAttribute("aria-pressed", o === b)); $(B, "#ctpl").innerHTML = list(); bind(); });
    $(B, "#cmore").onclick = async (ev) => { const btn = ev.currentTarget, cat = TCAT, old = TOPICS[cat] || [], lbl = btn.textContent; btn.disabled = true; btn.textContent = "…";
      const ask = `Придумай 6 нових тем для коротких вертикальних анімаційних відео (Reels/TikTok), які мають шанс стати вірусними. Категорія: «${cat}». Аудиторія — широка, українською.
Кожна тема — одне конкретне речення до 11 слів із вбудованою інтригою (питання «що буде, якщо…», «чому…», несподіваний факт, конкретні числа). Тема — це хук: перша фраза відео, яка зупиняє скрол. Без кліше і НЕ повторюй ці: ${old.join(" | ")}.
Відповідай тільки JSON: {"topics":["…","…"]}`;
      const pick = (r) => (Array.isArray(r) ? r : r?.topics || r?.items || []).map((q) => String(q?.topic || q?.t || q).replace(/^\s*\d+[.)]\s*/, "").trim()).filter((q) => q && q.length > 8 && q.length < 120 && !old.includes(q));
      let arr = [], err = null;
      for (const o of [{ kbFmt: "tall", kb: ["hook", "niche"] }, {}]) { try { arr = pick(await E().busyRun("text", () => sample.json(ask, { cache: false, max: 900, ...o }))); if (arr.length >= 3) break; } catch (e) { err = e; if (/limit|login/.test(e?.code || e?.message || "")) break; } }
      if (btn.isConnected) { btn.disabled = false; btn.textContent = lbl; }
      if (arr.length >= 3) { TOPICS[cat] = arr.slice(0, 6); saveTopics(); if (TCAT === cat && $(B, "#ctpl")) { $(B, "#ctpl").innerHTML = list(); bind(); } track("topic_more"); }
      else say(/limit/.test(err?.code || err?.message || "") ? "На сьогодні нові теми закінчились — спробуй завтра або напиши свою" : /login/.test(err?.code || "") ? "Увійди, щоб отримати нові теми" : "Не вийшло оновити теми. Спробуй ще раз"); };
    nb.onclick = () => { if (nb.disabled) return; saveDraft(); screenScript(); };
    upd(); track("open"); }
  /* ---------- крок 2: довжина, реклама, сценарій і текст ---------- */
  const SCRIPTS = {
    story: { n: "Історія героя", b: ["Гачок — несподіваний момент з історії", "Хто герой і чого він хоче", "Перешкода або помилка", "Поворот — що він зробив інакше", "Результат з конкретними числами", "Висновок одним сильним реченням"], p: "історія одного героя: гачок з середини історії → хто він і чого хоче → перешкода/помилка → поворот (що зробив інакше) → результат із конкретними числами → висновок одним сильним реченням" },
    whatif: { n: "Що буде, якщо…", b: ["Питання-гачок «що буде, якщо…»", "День 1 — перші відчуття", "Тиждень — перші зміни", "Місяць — несподіваний ефект", "Підсумок — що змінилось назавжди"], p: "експеримент у часі: питання «що буде, якщо…» → день 1 → тиждень → місяць (несподіваний ефект) → підсумок; кожен етап — конкретна зміна, яку легко показати" },
    myth: { n: "Міф і правда", b: ["Поширений міф, у який вірять усі", "Чому люди в нього вірять", "Як насправді (факт або число)", "Що через це втрачають", "Що робити замість цього"], p: "руйнування міфу: поширений міф → чому в нього вірять → як насправді (факт/число) → що через це втрачають → що робити замість цього" },
    list: { n: "3 кроки / поради", b: ["Гачок — обіцянка результату", "Крок 1 — найпростіший", "Крок 2 — найнеочевидніший", "Крок 3 — той, що дає результат", "Підсумок і що буде, якщо почати сьогодні"], p: "три кроки: гачок-обіцянка → крок 1 (найпростіший) → крок 2 (найнеочевидніший) → крок 3 (дає результат) → підсумок; кожен крок — дія, яку можна показати" },
    before: { n: "До і після", b: ["Як було — болюче й знайомо", "Момент, коли все змінилось", "Що саме зробив інакше", "Як стало — конкретно й видимо", "Як повторити глядачу"], p: "до/після: як було (болюче й знайомо) → момент зміни → що саме зробив інакше → як стало (конкретно, з числами) → як повторити" },
    voice: { n: "Внутрішній голос", b: ["Внутрішній голос шепоче відмовку", "Герой вагається", "Ціна, якщо послухатись", "Вибір — діяти попри страх", "Що стало після цього вибору"], p: "діалог із внутрішнім голосом: голос шепоче відмовку → герой вагається → ціна, якщо послухатись → вибір діяти попри страх → що стало після вибору" },
    fact: { n: "Факт, що дивує", b: ["Несподіваний факт або число", "Чому так відбувається", "Як це стосується тебе", "Приклад з життя", "Висновок, який хочеться переслати"], p: "дивний факт: несподіваний факт/число → чому так → як це стосується глядача → приклад із життя → висновок, який хочеться переслати" } };
  const scnOf = () => SCRIPTS[DRAFT.scn] ? DRAFT.scn : /^що буде/i.test(DRAFT.topic || "") ? "whatif" : "story";
  function screenScript(msg) { stopPlay(); stopPrevA(); const d = shell(), B = $(d, ".cb"), F = $(d, ".cf"); if (!AD_PICK) AD_PICK = OPT.ad || "none"; let scn = scnOf();
    const ADS = [["none", "Без реклами"], ["bio", "Посилання в шапці профілю"], ["comment", `Слово «${escH(String(OPT.adWord || "АНІМАЦІЯ").toUpperCase())}» в коментарях`]];
    const struct = () => `<ol class="scst">${SCRIPTS[scn].b.map((q) => `<li>${escH(q)}</li>`).join("")}</ol>`;
    B.innerHTML = `${msg ? `<div class="msg">${escH(msg)}</div>` : ""}<div class="scr">${STEPS(2)}
      <div class="sec"><div class="tpcur"><b>${escH(DRAFT.topic || "Своя тема")}</b><button class="chip" type="button" id="ctpch">Змінити</button></div></div>
      <div class="sec"><h4>Довжина відео</h4><div class="chips">${[20, 30, 45, 60, 90].map((q) => `<button class="chip" type="button" data-sec="${q}" aria-pressed="${OPT.sec === q}">${q} с</button>`).join("")}</div></div>
      <div class="sec"><h4>Реклама</h4><div class="vopt">${ADS.map(([k, n]) => `<button type="button" data-adp="${k}" aria-pressed="${AD_PICK === k}"><b>${n}</b></button>`).join("")}</div>
        <div id="cadhint">${AD_PICK === "comment" ? DM_HINT : ""}</div></div>
      <div class="sec"><h4>Сценарій</h4><div class="chips">${Object.entries(SCRIPTS).map(([k, v]) => `<button class="chip" type="button" data-scn="${k}" aria-pressed="${scn === k}">${escH(v.n)}</button>`).join("")}</div><div id="cscst">${struct()}</div></div>
      <div class="sec"><button class="btn main" type="button" id="cwr">✨ ${DRAFT.text ? "Написати інший варіант" : "Написати текст"}</button>
        <textarea id="ctext" rows="11" style="margin-top:10px" placeholder="Або напиши свій текст тут — його можна редагувати">${escH(DRAFT.text)}</textarea><p class="cnt" id="ccnt"></p></div></div>`;
    F.innerHTML = `<div class="row"><button class="btn main" type="button" id="cgo">Далі — голос</button><button class="btn sq" type="button" id="cprev" aria-label="Назад">‹</button></div>`;
    const ta = $(B, "#ctext"), cnt = $(B, "#ccnt"), keyNow = () => [DRAFT.topic, OPT.sec, AD_PICK, OPT.adWord, scn].join("|");
    const est = () => { DRAFT.text = ta.value; saveDraft(); const n = (ta.value.match(/\S+/g) || []).length, f = fitEst(n, OPT.sec); cnt.textContent = n ? `${n} слів · після озвучки ≈ ${fmt(f.dur)} (ціль ${OPT.sec} с)${f.dur > OPT.sec * 1.08 ? " — задовго, скороти" : f.dur < OPT.sec * .85 ? " — закоротко, можна додати" : ""}${DRAFT.gk && DRAFT.gk !== keyNow() && DRAFT.gk.split("|")[2] !== AD_PICK ? " · реклама змінилась — напиши текст заново" : ""}` : `Ціль ≈ ${OPT.sec} с`; };
    ta.oninput = est; est();
    B.querySelectorAll("[data-sec]").forEach((b) => b.onclick = () => { OPT.sec = +b.dataset.sec; saveOpt(); B.querySelectorAll("[data-sec]").forEach((o) => o.setAttribute("aria-pressed", o === b)); est(); });
    B.querySelectorAll("[data-adp]").forEach((b) => b.onclick = () => { AD_PICK = b.dataset.adp; OPT.ad = AD_PICK; saveOpt(); B.querySelectorAll("[data-adp]").forEach((o) => o.setAttribute("aria-pressed", o === b)); $(B, "#cadhint").innerHTML = AD_PICK === "comment" ? DM_HINT : ""; est(); });
    B.querySelectorAll("[data-scn]").forEach((b) => b.onclick = () => { scn = DRAFT.scn = b.dataset.scn; saveDraft(); B.querySelectorAll("[data-scn]").forEach((o) => o.setAttribute("aria-pressed", o === b)); $(B, "#cscst").innerHTML = struct(); track("scn_pick", { v: scn }); });
    $(B, "#ctpch").onclick = () => screenTopic(); $(F, "#cprev").onclick = () => screenTopic();
    $(B, "#cwr").onclick = async (ev) => { const btn = ev.currentTarget; OPT.ad = AD_PICK; saveOpt(); const topic = DRAFT.topic || ta.value.trim().slice(0, 300); if (!topic) return screenTopic("Напиши або обери тему");
      try { const adOn = AD_PICK && AD_PICK !== "none", adSec = adOn ? (OPT.sec <= 30 ? 11 : 17) + 3 : 0;
        let t = await E().busyRun("text", () => aiText(topic, Math.max(12, OPT.sec - adSec), OPT.voice === "none", scn)); if (!t) throw new Error("empty"); DRAFT.adMid = ""; DRAFT.adParts = null;
        let wv = false; if (adOn) { try { const w = await E().busyRun("text", () => adWeave2(t, AD_PICK, OPT.adWord)); t = w.text; DRAFT.adMid = w.mid; DRAFT.adParts = w.parts; wv = true; } catch (e) { console.warn("ad weave", e); } }
        ta.value = t; DRAFT.gk = keyNow(); est(); btn.textContent = "✨ Написати інший варіант"; track("ai_text", { v: scn }); if (adOn && !wv) say("Текст готовий, але рекламу вплести не вийшло — натисни «Написати інший варіант»"); }
      catch (e) { console.warn("cine text", e); const c = String((e?.code === "server" && e?.message) || e?.code || e?.message || "err"); track("ai_text_err", { v: c.slice(0, 30) }); say(/limit/.test(c) ? "Ліміт на сьогодні вичерпано" : /login/.test(c) ? "Увійди, щоб написати текст" : /network/.test(c) ? "Немає зв'язку — перевір інтернет і натисни ще раз" : /no_credit/.test(c) ? "Текст зараз недоступний: на рахунку Anthropic закінчились кошти (no_credit)" : /bad_model/.test(c) ? `Модель недоступна — перевір секрет AI_MODEL (${c})` : /bad_key/.test(c) ? "Ключ Anthropic не підходить (bad_key)" : `Не вийшло написати текст — натисни ще раз (${c})`); } };
    $(F, "#cgo").onclick = () => { OPT.ad = AD_PICK; saveOpt(); if ((ta.value.match(/\S+/g) || []).length < 4) { say("Спершу потрібен текст — натисни «Написати текст» або напиши свій"); return; } DRAFT.text = ta.value; saveDraft(); screenContent(); }; }
  let PENDING = null;
  /* ---------- шаблони кроку 3 (формат + герой + музика + субтитри) ---------- */
  const TPLK = ["fmt", "col", "acc", "skin", "hair", "hairC", "beard", "pet", "music", "mood", "places", "subs", "subS"];
  const TPLS = () => { try { return JSON.parse(localStorage.getItem("yvCineTpl") || "[]"); } catch (e) { return []; } };
  const TPLSAVE = (a) => { try { localStorage.setItem("yvCineTpl", JSON.stringify(a.slice(0, 8))); } catch (e) {} };
  let TPLSEL = null, TPLAUTO = false;
  const tplPick = () => Object.fromEntries(TPLK.map((k) => [k, JSON.parse(JSON.stringify(OPT[k] ?? null))]));
  const tplApply = (q) => { TPLK.forEach((k) => { if (q.o[k] !== undefined && q.o[k] !== null) OPT[k] = q.o[k]; }); saveOpt(); };
  // крок 3: персонажі — зліва живе прев'ю, справа кнопки; вибір розгортається нижче, не закриваючи прев'ю
  let LKTAB = "hero", LKRAF = 0;
  function lookL() { const pl = (OPT.places || []).find((k) => PLACES[k]) || "room", pet = BREED[OPT.pet] ? OPT.pet : "", cast = [{ who: "hero", x: pet ? .4 : .5, pose: "talk", face: "happy" }];
    if (pet) cast.push({ who: BREED[pet].cat ? "cat" : "dog", breed: pet, x: .8, pose: "sit" });
    const L2 = { dur: 9, fmt: FMTS[OPT.fmt] ? OPT.fmt : "kino", subs: false, silent: true, hero: { col: OPT.col, acc: OPT.acc, skin: OPT.skin, hair: OPT.hair, hairC: OPT.hairC, beard: OPT.beard }, pet,
      words: Array.from({ length: 24 }, (_, i) => ({ w: "", s: .3 + i * .36, e: .55 + i * .36 })), scenes: [{ a: 0, place: pl, time: "day", shot: "wide", cam: "push", cast }] }; timeline(L2); return L2; }
  function lookLoop(cv) { cancelAnimationFrame(LKRAF); const x = cv.getContext("2d"), t0 = performance.now(); let L2 = lookL(), key = JSON.stringify(OPT);
    const loop = () => { if (!cv.isConnected) return; const k2 = JSON.stringify(OPT); if (k2 !== key) { key = k2; L2 = lookL(); } drawFrame(x, L2, 1 + ((performance.now() - t0) / 1000) % 6, cv.width, cv.height); LKRAF = requestAnimationFrame(loop); }; loop(); }
  function screenSetup(msg) { if (!TPLAUTO) { TPLAUTO = true; const L0 = TPLS(), di = L0.findIndex((q) => q.def); if (di >= 0) { tplApply(L0[di]); TPLSEL = di; } } stopPlay(); const d = shell(), B = $(d, ".cb"), F = $(d, ".cf");
    const T = [["hero", "🧍 Персонаж"], ["place", "🏠 Локація"], ["pet", "🐾 Тваринка"], ["style", "🎨 Стиль"]];
    B.innerHTML = `${msg ? `<div class="msg">${escH(msg)}</div>` : ""}<div class="scr">${STEPS(4)}
      <div class="lk"><canvas width="360" height="640" id="clk"></canvas><div class="lkb">${T.map(([k, n]) => `<button type="button" data-lk="${k}" aria-pressed="${LKTAB === k}">${n}</button>`).join("")}</div></div>
      <div class="lkp" id="clkp"></div></div>`;
    F.innerHTML = `<div class="row"><button class="btn main" type="button" id="cnext">🎬 Створити відео</button><button class="btn sq" type="button" id="cprev" aria-label="Назад">‹</button></div>`;
    Promise.all([loadFont(), loadHand(), loadIcons()]).then(() => lookLoop($(B, "#clk")));
    const P = $(B, "#clkp");
    const draw = () => { const ch = (attr, k, n, on, extra = "") => `<button class="chip" type="button" data-${attr}="${k}" aria-pressed="${on}"${extra}>${n}</button>`;
      if (LKTAB === "hero") P.innerHTML = `<div class="sec"><h4>Одяг</h4><div class="chips">${Object.entries(HOOD).filter(([k]) => k !== "grey").map(([k, v]) => `<button class="dot" type="button" data-col="${k}" style="background:${v}" aria-pressed="${OPT.col === k}" aria-label="${k}"></button>`).join("")}</div>
          <div class="chips" style="margin-top:8px">${[["none", "Без нічого"], ["beanie", "Шапка"], ["cap", "Кепка"], ["glasses", "Окуляри"], ["headphones", "Навушники"]].map(([k, n]) => ch("acc", k, n, OPT.acc === k)).join("")}</div></div>
        <div class="sec"><h4>Шкіра</h4><div class="chips">${Object.entries(SKIN_N).map(([k, n]) => ch("skin", k, `${k === "auto" ? "" : `<span class="skd" style="background:${SKIN[k]}"></span>`}${n}`, (OPT.skin || "auto") === k)).join("")}</div></div>
        <div class="sec"><h4>Зачіска</h4><div class="chips">${Object.entries(HAIR_N).map(([k, n]) => ch("hair", k, n, (OPT.hair || "") === k)).join("")}</div>
          <div class="chips" style="margin-top:8px">${Object.entries(HAIRC).map(([k, v]) => `<button class="dot" type="button" data-hc="${k}" style="background:${v}" aria-pressed="${(OPT.hairC || "dbrown") === k}" aria-label="${k}"></button>`).join("")}</div>
          <div class="chips" style="margin-top:8px">${ch("beard", "0", "Без бороди", !OPT.beard)}${ch("beard", "1", "З бородою", !!OPT.beard)}</div></div>`;
      if (LKTAB === "place") P.innerHTML = `<div class="sec"><h4>Де живе історія</h4><p class="cnt" style="margin:-4px 0 8px">Можна кілька — або «AI вибере» під текст. Перша вибрана — у прев'ю.</p><div class="chips">${ch("pl", "", "AI вибере", !OPT.places?.length)}${Object.entries(PLACES).filter(([k]) => k !== "void").map(([k, v]) => ch("pl", k, v.n, (OPT.places || []).includes(k))).join("")}</div></div>`;
      if (LKTAB === "pet") P.innerHTML = `<div class="sec"><h4>Тваринка в історії</h4><div class="chips">${ch("pet", "", "Без тварини", !OPT.pet)}${Object.entries(BREED).map(([k, v]) => ch("pet", k, `${v.dog ? "🐕" : "🐈"} ${v.n}`, OPT.pet === k)).join("")}</div></div>`;
      if (LKTAB === "style") P.innerHTML = `<div class="sec"><h4>Формат</h4><div class="fmtl">${Object.entries(FMTS).map(([k, v]) => `<button type="button" class="fmtc" data-fmt="${k}" aria-pressed="${(OPT.fmt || "kino") === k}"><b>${v.n}</b><span>${v.d}</span></button>`).join("")}<div class="fmtc soonf"><b>Ілюстрована пригода</b><span>Детальні намальовані світи — скоро</span></div></div></div>
        <div class="sec"><h4>Мої шаблони</h4><div class="chips">${TPLS().map((q, i) => `<button class="chip" type="button" data-tpl="${i}" aria-pressed="${TPLSEL === i}">${q.def ? "★ " : ""}${escH(q.n)}</button>`).join("")}<button class="chip" type="button" id="ctpladd">＋ Зберегти поточний</button></div>
          <div id="ctplf" hidden style="margin-top:8px"><div class="ask"><input class="tx" id="ctpln" maxlength="24" placeholder="Назва шаблону"><button class="btn sq" type="button" id="ctplok">✓</button></div></div>
          ${TPLSEL != null && TPLS()[TPLSEL] ? `<div class="chips" style="margin-top:8px"><button class="chip" type="button" id="ctpldef">${TPLS()[TPLSEL].def ? "★ Вибирається автоматично" : "☆ Вибирати автоматично"}</button><button class="chip" type="button" id="ctpldel">Видалити</button></div>` : `<p class="cnt" style="margin:6px 0 0">Шаблон із ★ вибиратиметься сам щоразу — але його завжди можна перемкнути.</p>`}</div>`;
      bindP(); };
    const set = (k, v) => { OPT[k] = v; saveOpt(); draw(); };
    const bindP = () => { const on = (sel, f) => P.querySelectorAll(sel).forEach((b) => b.onclick = () => f(b.dataset));
      on("[data-col]", (q) => set("col", q.col)); on("[data-acc]", (q) => set("acc", q.acc)); on("[data-skin]", (q) => set("skin", q.skin)); on("[data-hair]", (q) => set("hair", q.hair)); on("[data-hc]", (q) => set("hairC", q.hc)); on("[data-beard]", (q) => set("beard", q.beard === "1"));
      on("[data-pet]", (q) => set("pet", q.pet)); on("[data-fmt]", (q) => { set("fmt", q.fmt); track("fmt", { v: q.fmt }); });
      on("[data-pl]", (q) => { let L2 = (OPT.places || []).filter((p) => PLACES[p]); L2 = !q.pl ? [] : L2.includes(q.pl) ? L2.filter((p) => p !== q.pl) : [...L2, q.pl]; set("places", L2); });
      on("[data-tpl]", (q) => { const i = +q.tpl, t = TPLS()[i]; if (!t) return; tplApply(t); TPLSEL = i; draw(); say(`Шаблон «${t.n}» застосовано`); });
      const a = $(P, "#ctpladd"); if (a) a.onclick = () => { $(P, "#ctplf").hidden = false; $(P, "#ctpln").focus(); };
      const ok = $(P, "#ctplok"); if (ok) ok.onclick = () => { const n = $(P, "#ctpln").value.trim() || FMTS[OPT.fmt || "kino"].n, L0 = TPLS(); L0.push({ n, o: tplPick(), def: !L0.length }); TPLSAVE(L0); TPLSEL = L0.length - 1; draw(); say(`Шаблон «${n}» збережено`); };
      const df = $(P, "#ctpldef"); if (df) df.onclick = () => { const L0 = TPLS(), v = !L0[TPLSEL].def; L0.forEach((q, i) => q.def = v && i === TPLSEL); TPLSAVE(L0); draw(); };
      const dl = $(P, "#ctpldel"); if (dl) dl.onclick = () => { const L0 = TPLS(); L0.splice(TPLSEL, 1); TPLSAVE(L0); TPLSEL = null; draw(); }; };
    B.querySelectorAll("[data-lk]").forEach((b) => b.onclick = () => { LKTAB = b.dataset.lk; B.querySelectorAll("[data-lk]").forEach((o) => o.setAttribute("aria-pressed", o === b)); draw(); });
    draw();
    $(F, "#cprev").onclick = () => { cancelAnimationFrame(LKRAF); screenContent(); };
    $(F, "#cnext").onclick = () => { cancelAnimationFrame(LKRAF); if (!PENDING) { screenContent("Спершу підготуй текст і голос"); return; } track("create"); build(PENDING); }; }
  const VPA = { a: null };
  async function voicePick(box) { let V = [], cl = null, err = "";
    try { V = (await SRV.voices()) || []; } catch (e) { err = e?.message || "err"; }
    if (OPT.voice === "clone") { try { cl = await SRV.myClone(); } catch (e) {} }
    if (!box.isConnected) return;
    if (OPT.voice === "clone") { box.innerHTML = cl?.has ? `<p class="cnt" style="margin:0">✓ Озвучимо твоїм голосом</p>` : `<p class="cnt" style="margin:0">Ще немає зразка твого голосу — створи його в «Озвучці» або вибери голос диктора.</p>`; DRAFT.vid = cl?.has ? "clone" : ""; return; }
    if (!V.length) { box.innerHTML = `<p class="cnt" style="margin:0">Голоси не завантажились${err ? ` (${escH(err)})` : ""}. <button class="chip" type="button" id="cvr">Ще раз</button></p>`; $(box, "#cvr").onclick = () => { box.innerHTML = `<p class="cnt" style="margin:0">Завантажую голоси…</p>`; voicePick(box); }; return; }
    if (!V.some((v) => v.id === DRAFT.vid)) DRAFT.vid = V[0].id;
    box.innerHTML = `<div class="vopt">${V.map((v) => `<button type="button" data-vid="${escH(v.id)}" aria-pressed="${DRAFT.vid === v.id}" style="display:flex;align-items:center;gap:10px"><span style="flex:1"><b>${escH(v.name)}</b>${v.descr ? `<span>${escH(v.descr)}</span>` : ""}</span><i data-pv="${escH(v.id)}" role="button" aria-label="Прослухати" style="font-style:normal;flex:none;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.12);display:grid;place-items:center">▶</i></button>`).join("")}</div>`;
    box.querySelectorAll("[data-vid]").forEach((b) => b.onclick = async (e) => { DRAFT.vid = b.dataset.vid; saveDraft(); box.querySelectorAll("[data-vid]").forEach((o) => o.setAttribute("aria-pressed", o === b));
      const pv = e.target.closest("[data-pv]"); if (!pv) return; try { VPA.a?.pause(); } catch (x) {} if (pv.textContent === "■") { pv.textContent = "▶"; return; }
      const v = V.find((q) => q.id === b.dataset.vid); let u = v.preview || v._u;
      if (!u) { pv.textContent = "…"; try { const r = await SRV.tts({ text: "Привіт! Ось так звучатиме твоє відео.", voice: { kind: "preset", id: v.id }, quiet: true }); u = v._u = URL.createObjectURL(new Blob([b64Buf(r.audio)], { type: r.mime || "audio/mpeg" })); } catch (x) { pv.textContent = "▶"; say(TTS_ERR[x.message] || "Не вдалося прослухати"); return; } }
      box.querySelectorAll("[data-pv]").forEach((o) => o.textContent = "▶"); VPA.a = new Audio(u); pv.textContent = "■"; VPA.a.onended = () => pv.textContent = "▶"; VPA.a.play().catch(() => pv.textContent = "▶"); }); }
  /* ---------- блок реклами (крок 2): вибирається до тексту, щоб вставка органічно вплелась ---------- */
  function adBlockHTML() { return `<div class="sec"><h4>Реклама у відео</h4><p class="cnt" style="margin:-4px 0 8px">Вибери до тексту — вставку буде органічно вписано в історію. На цікавому місці історії персонаж дістає телефон — і тим самим голосом видно, як за кілька хвилин робиться таке відео, а за кожного, хто прийде за твоїм посиланням, ти отримуєш половину його першої оплати. Секунди вставки не списуються.</p><div class="chips">${Object.entries(AD_KINDS).map(([k, n]) => `<button class="chip" type="button" data-adk="${k}" aria-pressed="${(OPT.ad || "none") === k}">${n}</button>`).join("")}</div>
        <input class="tx" id="cadw" style="margin-top:8px${OPT.ad === "comment" || ((OPT.ad || "none") === "none" && OPT.capK === "comment") ? "" : ";display:none"}" maxlength="14" placeholder="Слово для коментарів" value="${escH(OPT.adWord || "АНІМАЦІЯ")}"><div id="cadhint">${OPT.ad === "comment" ? DM_HINT : ""}</div>
        <div id="ccapbox" style="margin-top:10px${(OPT.ad || "none") === "none" ? "" : ";display:none"}"><p class="cnt" style="margin:0 0 6px">Без вставки у відео — але можна привести людей підписом під відео. Ось текст, скопіюй його:</p><div class="chips" style="margin-bottom:8px">${["bio", "comment"].map((q) => `<button class="chip" type="button" data-ck="${q}" aria-pressed="${(OPT.capK || "bio") === q}">${AD_KINDS[q]}</button>`).join("")}</div><textarea class="tx" id="ccap0" rows="3" style="width:100%;resize:vertical" readonly></textarea><div class="row" style="margin-top:6px"><button class="btn" type="button" id="ccpy0">Скопіювати</button></div><p class="cnt" style="margin:6px 0 0">Після збереження відео дам підпис ще й з першим рядком про тему.</p></div>${isOwner() ? `<button class="btn" type="button" id="cadst" style="margin-top:10px">🎬 Студія вставки: текст і запис екрана · ТЕСТ</button>` : ""}</div>`; }
  function adBlockBind(B, onKind, onWord) { const pick = (sel, key, cb) => B.querySelectorAll(sel).forEach((b) => b.onclick = () => { B.querySelectorAll(sel).forEach((o) => o.setAttribute("aria-pressed", o === b)); cb(b.dataset[key]); saveOpt(); });
    const capFill = () => { $(B, "#ccap0").value = capPromo(OPT.capK || "bio", OPT.adWord); };
    pick("[data-adk]", "adk", (v) => { OPT.ad = v; onKind?.(v); $(B, "#cadw").style.display = v === "comment" || (v === "none" && OPT.capK === "comment") ? "" : "none"; $(B, "#cadhint").innerHTML = v === "comment" ? DM_HINT : ""; $(B, "#ccapbox").style.display = v === "none" ? "" : "none"; });
    pick("[data-ck]", "ck", (v) => { OPT.capK = v; if (OPT.ad === "none") $(B, "#cadw").style.display = v === "comment" ? "" : "none"; capFill(); });
    $(B, "#ccpy0").onclick = async (e) => { const ok = await copyText($(B, "#ccap0").value); e.currentTarget.textContent = ok ? "✓ Скопійовано" : "Виділи й скопіюй вручну"; };
    capFill();
    $(B, "#cadw").oninput = (e) => { OPT.adWord = e.target.value.trim().toUpperCase(); saveOpt(); capFill(); }; $(B, "#cadw").onchange = () => onWord?.();
    const ast = $(B, "#cadst"); if (ast) ast.onclick = () => adStudio();
    if (OPT.ad && OPT.ad !== "none") loadAd();
  }
  /* ---------- крок 2: тема → реклама → текст → голос → озвучити, прослухати, поправити й переозвучити ---------- */
  const ADM0 = "⸻ реклама ⸻", ADM1 = "⸻ далі відео ⸻";
  const splitAd = (t) => { t = String(t || ""); const i = t.indexOf(ADM0), j = t.indexOf(ADM1); if (i < 0 || j < i) return { a: t.replace(ADM0, "").replace(ADM1, "").trim(), ad: "", b: "" }; return { a: t.slice(0, i).trim(), ad: t.slice(i + ADM0.length, j).trim(), b: t.slice(j + ADM1.length).trim() }; };
  const sentences = (t) => (String(t).match(/[^.!?…]+[.!?…]+["»”]?|\S[^.!?…]*$/g) || []).map((q) => q.trim()).filter(Boolean);
  async function adWeave(story, kind, word) { await Promise.race([loadAd(), new Promise((r) => setTimeout(r, 6000))]); const ss = sentences(story); if (ss.length < 4) return story;
    const k = Math.max(2, Math.min(ss.length - 2, Math.round(ss.length * .55))), before = ss.slice(0, k).join(" "), after = ss.slice(k).join(" ");
    const br = await adBridge({ words: (before + " " + after).split(/\s+/).map((w) => ({ w })), topic: DRAFT.topic }, before.split(/\s+/).length);
    const mid = [br.in, ...AD.beats.map((b) => adSay(b, kind, word)), br.out].join(" ").replace(/…\s*…/g, "… ");
    return `${before}\n\n${ADM0}\n${mid}\n${ADM1}\n\n${after}${AD.outro ? " " + AD.outro : ""}`; }
  // розкласти текст вставки на кроки (для синхрону екрана телефона з голосом)
  function adPartsFrom(adt, kind, word) { const fx = AD.beats.map((b) => ({ id: b.id, t: adSay(b, kind, word) })), idx = []; let pos = 0, ok = true;
    for (const f of fx) { const i = adt.indexOf(f.t, pos); if (i < 0) { ok = false; break; } idx.push(i); pos = i + f.t.length; }
    if (ok) { const parts = [{ id: "in", t: adt.slice(0, idx[0]).trim() }]; fx.forEach((f, n) => parts.push({ id: f.id, t: f.t })); parts.push({ id: "out", t: adt.slice(pos).trim() }); return parts.map((q) => ({ ...q, t: q.t || "…" })); }
    const ss = sentences(adt), mid = ss.slice(1, -1), n = Math.max(1, mid.length); return [{ id: "in", t: ss[0] || "…" }, ...fx.map((f, q) => ({ id: f.id, t: mid.slice(Math.floor(q * n / 4), Math.floor((q + 1) * n / 4)).join(" ") || "…" })), { id: "out", t: ss.length > 1 ? ss[ss.length - 1] : "…" }]; }
  function alignWords(text, buf, off = 0) { const ws = String(text || "").split(/\s+/).filter(Boolean); if (!ws.length || !buf?.length) return []; const SR = E().SR, hop = Math.round(SR * .01), n = Math.floor(buf.length / hop), en = new Float32Array(n); let mx = 0;
    for (let i = 0; i < n; i++) { let q = 0; for (let j = i * hop, e = j + hop; j < e; j++) q += buf[j] * buf[j]; en[i] = Math.sqrt(q / hop); if (en[i] > mx) mx = en[i]; }
    const th = mx * .07, cum = new Float32Array(n + 1); for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + (en[i] > th ? 1 : 0); const tot = cum[n] || 1;
    const wt = ws.map((w) => w.replace(/[^\p{L}\p{N}]/gu, "").length + 1.2), all = wt.reduce((a, b) => a + b, 0) || 1;
    const at = (fr) => { const tg = fr * tot; let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < tg) lo = m + 1; else hi = m; } return lo * .01; };
    let c = 0; return ws.map((w, i) => { const s0 = at((c + .05) / all); c += wt[i]; const e0 = at(c / all); return { w, s: off + s0, e: off + Math.max(s0 + .1, e0) }; }); }
  let VOICED = null, PAC = null;
  const voiceKey = (t, v) => JSON.stringify([String(t).trim(), v, AD.speed]);
  const catBuf = (list, g = .3) => { const SR = E().SR, gap = Math.round(g * SR), xs = list.filter(Boolean), n = xs.reduce((a, q) => a + q.length, 0) + gap * Math.max(0, xs.length - 1), y = new Float32Array(n); let o = 0; xs.forEach((q, i) => { y.set(q, o); o += q.length + (i < xs.length - 1 ? gap : 0); }); return y; };
  const stopPrevA = () => { try { PAC?.close(); } catch (e) {} PAC = null; };
  function playBuf(y, onEnd) { stopPrevA(); const ac = PAC = new (window.AudioContext || window.webkitAudioContext)(), b = ac.createBuffer(1, y.length, E().SR); b.copyToChannel(y, 0); const s2 = ac.createBufferSource(); s2.buffer = b; s2.connect(ac.destination); s2.onended = () => { if (PAC === ac) { stopPrevA(); onEnd?.(); } }; s2.start(); }
  async function voiceText(text, voice) { const p = splitAd(text); const [a, ad, b] = await Promise.all([p.a ? ttsAudio(p.a, voice) : null, p.ad ? ttsAudio(p.ad, voice) : null, p.b ? ttsAudio(p.b, voice) : null]);
    return { key: voiceKey(text, voice), a, ad: ad ? tstretch(ad, AD.speed) : null, b, adText: p.ad, aText: p.a, bText: p.b, voice }; }
  // реклама прямо в тексті історії (без окремих роликів): місточок + згадка студії + заклик + повернення
  async function adWeave2(story, kind, word) { const ss = sentences(story); if (ss.length < 4) return { text: story, mid: "" };
    const k = Math.max(2, Math.min(ss.length - 2, Math.round(ss.length * .55))), before = ss.slice(0, k).join(" "), after = ss.slice(k).join(" ");
    const core0 = OPT.sec <= 30 ? "Таке відео нейромережа робить за кілька хвилин." : "Відкриваю студію — і за кілька хвилин нейромережа робить таке відео.";
    const br = await adBridge({ words: (before + " " + after).split(/\s+/).map((w) => ({ w })), topic: DRAFT.topic, core: core0 }, before.split(/\s+/).length);
    const W = wordCase(word), cta = kind === "comment" ? `Напиши «${W}» в коментарях — надішлю посилання, спробуєш безкоштовно.` : "Спробувати безкоштовно — посилання в шапці профілю.";
    const core = OPT.sec <= 30 ? "Таке відео нейромережа робить за кілька хвилин." : "Відкриваю студію — і за кілька хвилин нейромережа робить таке відео. А за кожного, хто прийде за моїм посиланням, отримую половину його першої оплати.";
    const mid = [br.in, core, cta, br.out].join(" ");
    return { text: `${before}\n\n${mid}\n\n${after}${AD.outro ? " " + AD.outro : ""}`, mid, parts: { in: br.in, core, cta, out: br.out } }; }
  // стиснути довгі паузи (озвучка часто читає повільно й з паузами)
  function squeeze(buf, keep = .1, min = .16) { const SR = E().SR, hop = Math.round(SR * .01), n = Math.floor(buf.length / hop); let mx = 0; const en = new Float32Array(n);
    for (let i = 0; i < n; i++) { let q = 0; for (let j = i * hop, e = j + hop; j < e; j++) q += buf[j] * buf[j]; en[i] = Math.sqrt(q / hop); if (en[i] > mx) mx = en[i]; }
    const th = mx * .05, out = new Float32Array(buf.length); let o = 0, i = 0;
    while (i < n) { if (en[i] > th) { out.set(buf.subarray(i * hop, (i + 1) * hop), o); o += hop; i++; continue; } let j = i; while (j < n && en[j] <= th) j++; const run = (j - i) * .01, kk = run > min ? Math.round(keep * 100) : j - i; out.set(buf.subarray(i * hop, (i + kk) * hop), o); o += kk * hop; i = j; }
    return out.slice(0, o); }
  const FIT = { base: 1.12, max: 1.45, wps: 2.6, sq: .9 }; // слів/с звичайним темпом; частка, що лишається після вирізання пауз
  const fitEst = (words, target) => { const nat = words / FIT.wps * FIT.sq, rate = clamp(Math.max(FIT.base, nat / target), 1, FIT.max); return { nat: words / FIT.wps, dur: nat / rate, rate }; };
  async function voiceFit(text, voice, target) { const SR = E().SR, parts = []; let cur = ""; sentences(text).forEach((q) => { if ((cur + " " + q).length > 2200 && cur) { parts.push(cur); cur = ""; } cur += (cur ? " " : "") + q; }); if (cur) parts.push(cur);
    const bufs = []; for (const q of parts) bufs.push(await ttsAudio(q, voice)); let y = squeeze(catBuf(bufs, .08)); const nat = y.length / SR;
    // жвава подача: мова завжди трохи швидша (×1.12), а довгий текст підтискаємо під ціль (до ×1.45)
    const rate = clamp(Math.max(FIT.base, nat / target), 1, FIT.max); y = tstretch(y, rate);
    return { key: voiceKey(text, voice) + target, buf: y, text, voice, rate, nat, dur: y.length / SR }; }
  function screenContent(msg) { stopPlay(); stopPrevA(); const d = shell(), B = $(d, ".cb"), F = $(d, ".cf"), v = OPT.voice, rec = v === "rec" || v === "file", tts = v === "ai" || v === "clone";
    const adN = { bio: "посилання в шапці", comment: `слово «${String(OPT.adWord || "АНІМАЦІЯ").toUpperCase()}» в коментарях`, none: "без реклами" }[OPT.ad] || "без реклами";
    B.innerHTML = `${msg ? `<div class="msg">${escH(msg)}</div>` : ""}<div class="scr">${STEPS(3)}
      <div class="sec"><div class="tpcur"><b>${escH(DRAFT.topic || "Своя тема")}</b><button class="chip" type="button" id="ctpch">Змінити</button></div><p class="cnt" style="margin:6px 0 0">${OPT.sec} с · реклама: ${escH(adN)}</p></div>
      <div class="sec"><h4>${rec ? "Текст, який прочитаєш" : v === "none" ? "Текст на екрані" : "Текст для озвучки"}</h4>
        <div class="txtp">${escH(DRAFT.text)}</div><textarea id="ctext" hidden>${escH(DRAFT.text)}</textarea><p class="cnt" id="ccnt"></p>
        <button class="chip" type="button" id="ctxch" style="margin-top:6px">✏️ Змінити текст</button></div>
      <div class="sec"><h4>Голос</h4><div class="chips">${VOICES.map(([k, n]) => `<button class="chip" type="button" data-v="${k}" aria-pressed="${v === k}">${n}</button>`).join("")}</div>
        <p class="cnt" style="margin:6px 0 0">${escH((VOICES.find((q) => q[0] === v) || VOICES[0])[2])}</p>${tts ? `<div id="cvl" style="margin-top:8px"><p class="cnt" style="margin:0">Завантажую голоси…</p></div>
        <div class="row" style="margin-top:10px"><button class="btn" type="button" id="cvo">🔊 Озвучити</button><button class="btn" type="button" id="cvp" style="display:none">▶ Прослухати</button></div><p class="cnt" id="cvst" style="margin:6px 0 0">Озвучка сама підженеться під ${OPT.sec} с: без пауз і жвавішим темпом.</p>` : ""}</div></div>`;
    F.innerHTML = v === "rec" ? `<div class="row"><button class="btn main" type="button" id="crec">🎙 Записати</button><button class="btn sq" type="button" id="cprev" aria-label="Назад">‹</button></div>`
      : v === "file" ? `<div class="row"><label class="btn main" for="cfile">Завантажити запис</label><button class="btn sq" type="button" id="cprev" aria-label="Назад">‹</button></div><input type="file" id="cfile" accept="audio/*,video/*" hidden>`
      : `<div class="row"><button class="btn main" type="button" id="cgo">Далі — персонажі</button><button class="btn sq" type="button" id="cprev" aria-label="Назад">‹</button></div>`;
    const ta = $(B, "#ctext"), cnt = $(B, "#ccnt"), voiceOf = () => DRAFT.vid === "clone" ? { kind: "clone" } : { kind: "preset", id: DRAFT.vid };
    const st = (t) => { const e = $(B, "#cvst"); if (e) e.textContent = t; }, kOf = () => voiceKey(ta.value.trim(), voiceOf()) + OPT.sec, fresh = () => VOICED && VOICED.key === kOf();
    const mark = () => { if (!tts) return; const ok = fresh(), bo = $(B, "#cvo"), bp = $(B, "#cvp"); bo.textContent = VOICED ? (ok ? "🔊 Переозвучити" : "🔊 Переозвучити зі змінами") : "🔊 Озвучити"; bp.style.display = ok ? "" : "none"; if (VOICED && !ok) st("Текст або голос змінено — переозвуч, щоб почути новий варіант."); };
    const est = () => { DRAFT.text = ta.value; saveDraft(); const n = (ta.value.match(/\S+/g) || []).length, f = fitEst(n, OPT.sec); cnt.textContent = n ? `${n} слів · після озвучки ≈ ${fmt(f.dur)} (ціль ${OPT.sec} с)${f.dur > OPT.sec * 1.08 ? " — задовго, скороти" : ""}` : `Ціль ≈ ${OPT.sec} с`; mark(); };
    ta.oninput = est;
    const write = async () => { const topic = DRAFT.topic || ta.value.trim().slice(0, 300); if (!topic) { screenTopic("Вибери тему"); return; }
      try { const adOn = OPT.ad && OPT.ad !== "none", adSec = adOn ? (OPT.sec <= 30 ? 11 : 17) + 3 : 0;
        let t = await E().busyRun("text", () => aiText(topic, Math.max(12, OPT.sec - adSec), v === "none")); if (!t) throw new Error("empty"); DRAFT.adMid = "";
        if (OPT.ad && OPT.ad !== "none") { const w = await E().busyRun("text", () => adWeave2(t, OPT.ad, OPT.adWord)); t = w.text; DRAFT.adMid = w.mid; DRAFT.adParts = w.parts; }
        ta.value = t; est(); $(B, "#cwr").textContent = "✨ Інший варіант"; track("ai_text"); }
      catch (e) { console.warn("cine text", e); say(e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло написати текст — натисни ще раз"); } };
    $(B, "#ctxch").onclick = () => { try { VPA.a?.pause(); } catch (e) {} stopPrevA(); screenScript(); }; est();
    const doVoice = async () => { const t = ta.value.trim(); if ((t.match(/\S+/g) || []).length < 4) { say("Спершу потрібен текст"); return false; } if (!DRAFT.vid) { say(v === "clone" ? "Спершу створи свій голос" : "Вибери голос"); return false; }
      try { const r = await E().busyRun("voice", () => voiceFit(t, voiceOf(), OPT.sec)); r.key = kOf(); VOICED = r;
        st(`✓ Озвучено · ${fmt(r.dur)} (ціль ${OPT.sec} с)${r.rate > 1.01 ? ` · пришвидшено ×${r.rate.toFixed(2)}` : ""}${r.nat / FIT.max > OPT.sec * 1.05 ? " · текст задовгий — скороти, щоб не поспішало" : ""}. Послухай — якщо щось не так, зміни текст і переозвуч.`); mark(); track("voice_ok"); return true; }
      catch (e) { console.warn(e); say(TTS_ERR[e?.message] || "Не вийшло озвучити. Спробуй ще раз"); if (e?.message === "no_clone_quota") window.yvFeatureSheet?.("clone"); return false; } };
    if (tts) { $(B, "#cvo").onclick = async () => { if (await doVoice()) $(B, "#cvp").click(); };
      $(B, "#cvp").onclick = (e) => { const b = e.currentTarget; if (PAC) { stopPrevA(); b.textContent = "▶ Прослухати"; return; } if (!fresh()) return; b.textContent = "■ Стоп"; playBuf(VOICED.buf, () => { b.textContent = "▶ Прослухати"; }); }; }
    $(B, "#ctpch").onclick = () => { try { VPA.a?.pause(); } catch (e) {} stopPrevA(); screenTopic(); };
    B.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => { OPT.voice = b.dataset.v; saveOpt(); DRAFT.text = ta.value; saveDraft(); try { VPA.a?.pause(); } catch (e) {} screenContent(); });
    if (tts) voicePick($(B, "#cvl")).then(() => { $(B, "#cvl")?.addEventListener("click", () => setTimeout(mark, 0)); mark(); });
    $(F, "#cprev").onclick = () => { try { VPA.a?.pause(); } catch (e) {} stopPrevA(); screenScript(); };
    const next = (src) => { try { VPA.a?.pause(); } catch (e) {} stopPrevA(); PENDING = { ...src, adMid: DRAFT.adMid || "", adParts: DRAFT.adParts || null }; screenSetup(); };
    if (v === "rec") { const rb = $(F, "#crec"), rl = rb.innerHTML; rb.onclick = () => E().record(rb, rl, (buf) => next({ buf })); }
    else if (v === "file") $(F, "#cfile").onchange = async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) next({ buf: await f.arrayBuffer() }); };
    else $(F, "#cgo").onclick = async () => { const t = ta.value.trim(); if ((t.match(/\S+/g) || []).length < 4) { say("Спершу потрібен текст — натисни «Написати текст»"); return; }
      if (v === "none") return next({ silent: true, text: t });
      if (!fresh() && !(await doVoice())) return; next({ fit: VOICED }); };
    if ((DRAFT.text.match(/\S+/g) || []).length < 4) setTimeout(() => screenScript("Спершу потрібен текст"), 0); }
  let STAGE = "";
  async function build(src) { const MAX = 95;
    STAGE = "старт"; try { await E().busyRun("montage", async () => { const stage = (t) => { STAGE = t.replace(/…$/, "").toLowerCase(); try { yvBusy?.stage?.(t); } catch (e) {} };
        await Promise.all([loadFont(), loadIcons(), loadHand()]); let y, words = null;
        if (src.silent) { const r = wordsFromText(src.text); words = r.ws.filter((w) => w.e < MAX - 1); y = new Float32Array(Math.round(Math.min(MAX, r.dur) * E().SR)); }
        else if (src.fit) { stage("Готую озвучку…"); y = src.fit.buf; words = alignWords(src.fit.text, y, 0).filter((w) => w.e < MAX - .5); if (words.length < 3) words = null; if (y.length / E().SR > MAX) { y = y.subarray(0, Math.round(MAX * E().SR)).slice(); say("Для Reels — до 1,5 хв. Беру початок"); } }
        else if (src.voiced) { stage("Готую озвучку…"); const V = src.voiced, SR = E().SR; y = catBuf([V.a, V.b]); words = [...alignWords(V.aText, V.a, 0), ...alignWords(V.bText, V.b, V.a ? (V.a.length / SR + .3) : 0)].filter((w) => w.e < MAX - .5); if (words.length < 3) words = null; if (y.length / E().SR > MAX) { y = y.subarray(0, Math.round(MAX * E().SR)).slice(); say("Для Reels — до 1,5 хв. Беру початок"); } }
        else { stage(src.tts ? "Озвучую текст…" : "Готую запис…"); y = src.tts ? await ttsAudio(src.tts.text, src.tts.voice) : await E().decode(src.buf); if (y.length / E().SR > MAX) { y = y.subarray(0, Math.round(MAX * E().SR)).slice(); say("Для Reels — до 1,5 хв. Беру початок"); } }
        if (!words) { stage("Розпізнаю слова…"); words = await sttWords(y); }
        if (words.length < 3) throw new Error("nowords");
        L = { voice: y, words, dur: Math.max(y.length / E().SR, words[words.length - 1].e + 1.2), silent: !!src.silent, subs: OPT.subs, key: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), subS: { ...SUBS0, ...(OPT.subS || {}) }, places: (OPT.places || []).filter((k) => PLACES[k]), pet: BREED[OPT.pet] ? OPT.pet : "", regen: 0, music: OPT.music, mood: OPT.mood === "auto" ? "curious" : OPT.mood, fmt: FMTS[OPT.fmt] ? OPT.fmt : "kino", hero: { col: OPT.col, acc: OPT.acc, skin: OPT.skin, hair: OPT.hair, hairC: OPT.hairC, beard: OPT.beard }, hist: [], src };
        L.ad = AD_KINDS[OPT.ad] ? OPT.ad : "none"; L.adWord = (OPT.adWord || "АНІМАЦІЯ").trim().slice(0, 14); L.topic = DRAFT.topic;
        if (src.voiced) { const V = src.voiced; L.ad = V.ad ? V.kind : "none"; L.adWord = (V.word || L.adWord).trim().slice(0, 14);
          if (V.ad && L.words.length >= 6) { await Promise.race([loadAd(), new Promise((r) => setTimeout(r, 9000))]); const SR = E().SR, ta = (V.a?.length || 0) / SR; let k = L.words.findIndex((w) => w.s >= ta + .1); if (k < 1) k = adPoint(L) ?? Math.round(L.words.length * .55);
            const parts = adPartsFrom(V.adText, L.ad, L.adWord); insertAd(L, k, V.ad, adTiming(parts, V.ad)); L.adV = { voice: V.voice, br: { in: parts[0].t, out: parts[parts.length - 1].t } }; } }
        // реклама — вже в тексті історії: підкажемо режисеру, де вона, щоб показав героя з телефоном
        let adHint = ""; if (L.ad !== "none" && src.adMid) { const nz = (q) => String(q).toLowerCase().replace(/[^\p{L}\p{N}]/gu, ""), mw = src.adMid.split(/\s+/).filter(Boolean).map(nz), ws = L.words.map((w) => nz(w.w));
          let a0 = -1; for (let i = 0; i + 2 < ws.length; i++) if (ws[i] === mw[0] && ws[i + 1] === mw[1] && ws[i + 2] === mw[2]) { a0 = i; break; }
          if (a0 >= 0) { const a1 = Math.min(ws.length - 1, a0 + mw.length - 1); L.adRange = [a0, a1]; adHint = `Слова ${a0}–${a1} — рекламна вставка: її покаже окрема анімація телефона, тож сцен із a від ${a0} до ${a1} НЕ став. Сцена зі слова ${a1 + 1} — сильне повернення в історію (інший план, рух камери, емоція). Сцена перед словом ${a0} — герой у кадрі (на ній він дістане телефон).`; } }
        stage("Режисую сцени…"); await aiPlan(L, adHint || ""); if (L.adRange && L.ad !== "none") await inlineAd(L, src.adParts); ensureAd(L); if (OPT.mood !== "auto" && OPT.music) L.mood = OPT.mood; timeline(L);
        // автоперевірка: AI-редактор дивиться кадри першого варіанта і виправляє (один прохід; якщо не вдалося — лишаємо перший варіант)
        if (!L._auto) { stage("Перевіряю й покращую відео…"); try { await aiReview(L, adHint || ""); ensureAd(L); if (OPT.mood !== "auto" && OPT.music) L.mood = OPT.mood; timeline(L); } catch (e) { if (/limit|login/.test(e?.message || e?.code || "")) {} console.warn("review", e); } }
        stage("Пишу музику й звуки…"); L.aud = await soundtrack(L); });
      track("ready", { v: `${L.scenes.length}sc/${Math.round(L.dur)}s/${L.mood}${L._auto ? "/auto" : ""}` }); screenEdit(L._auto ? `Режисер не відповів (${L._planErr || "помилка"}) — сцени розставлено автоматично. Можна натиснути «Інший варіант»` : (L._review?.n ? `✓ Відео перевірено й покращив відео (${L._review.n} правок). ` : "") + "Тапни ▶, щоб подивитись. Правки — у вкладках під кнопкою «Зберегти»");
    } catch (e) { console.error(e); const m = e?.message || e?.code || String(e); track("fail", { v: `${STAGE}|${String(m).slice(0, 40)}` });
      const msg = TTS_ERR[m] || (m === "nowords" ? "Не почув слів — спробуй ще раз" : m === "limit" ? "Ліміт на сьогодні вичерпано" : m === "login" ? "Увійди в акаунт" : `Не вийшло зібрати анімацію (етап: ${STAGE}; ${String(m).slice(0, 60)}). Спробуй ще раз або скинь цей текст Claude`);
      say(msg); L = null; screenContent(msg); if (m === "no_clone_quota") window.yvFeatureSheet?.("clone"); } }
  const REGEN_MAX = 5, isOwner = () => { try { return typeof uiOwner === "function" && !!uiOwner(); } catch (e) { return false; } };
  const regenLeft = () => isOwner() ? Infinity : REGEN_MAX - (L.regen || 0);
  function regenOk() { if (regenLeft() > 0) return true; say(`Ліміт переробок для цього відео — ${REGEN_MAX}. Ручні правки сцен (локація, поза, напис…) — без ліміту`); return false; }
  async function remix(fn, label, ai) { if (ai && !regenOk()) return; stopPlay(); try { await E().busyRun("montage", async () => { const keep = JSON.stringify({ scenes: L.scenes, mood: L.mood, music: L.music }); L.hist.push(keep); if (L.hist.length > 15) L.hist.shift(); const r = await fn(); if (ai) L.regen = (L.regen || 0) + 1; ensureAd(L); timeline(L); L.aud = await soundtrack(L); L._say = r; }); screenEdit(L._say || label); } catch (e) { console.error(e); say(e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло. Спробуй ще раз"); } }
  /* ---------- імітація інтерфейсу соцмереж (лише в перегляді, у збережене відео не йде) ---------- */
  const OVL = { none: "Без інтерфейсу", ig: "Instagram", tt: "TikTok", yt: "Shorts" };
  let OV = "ig"; try { OV = localStorage.getItem("yvCineOvl") || "ig"; } catch (e) {}
  // приклад чужого акаунта в прев'ю (жартівливий, вигаданий) і заклик у підписі
  const OVN = "elon.mack";
  const OVC = () => L?.ad === "comment" ? `Напиши «${String(L.adWord || "АНІМАЦІЯ").toUpperCase()}» — надішлю посилання 👇` : L?.ad === "bio" ? "Створи своє відео — посилання в шапці профілю 👆" : "Таке відео — за кілька хвилин 🤯";
  function overlay(x, k, cw, ch) { if (!OVL[k] || k === "none") return; const s = cw / W; x.save(); x.scale(s, s);
    const sh = (f) => { x.save(); x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = 10; f(); x.restore(); }, T = (t, X, Y, sz, w = 700, al = "left", c = "#fff") => sh(() => { x.font = `${w} ${sz}px system-ui,-apple-system,sans-serif`; x.textAlign = al; x.textBaseline = "middle"; x.fillStyle = c; x.fillText(t, X, Y); });
    const icon = (Y, kind, n) => { const X = 1000; sh(() => { x.strokeStyle = "#fff"; x.fillStyle = "#fff"; x.lineWidth = 7; x.lineJoin = "round"; x.lineCap = "round"; x.beginPath();
      if (kind === "heart") { x.moveTo(X, Y + 26); x.bezierCurveTo(X - 52, Y - 8, X - 30, Y - 44, X, Y - 18); x.bezierCurveTo(X + 30, Y - 44, X + 52, Y - 8, X, Y + 26); x.stroke(); }
      else if (kind === "com") { x.arc(X, Y - 4, 30, .9, Math.PI * 2 + .5); x.lineTo(X + 34, Y + 26); x.closePath(); x.stroke(); }
      else if (kind === "send") { x.moveTo(X - 32, Y - 26); x.lineTo(X + 34, Y - 28); x.lineTo(X + 4, Y + 32); x.lineTo(X - 4, Y + 2); x.closePath(); x.moveTo(X - 4, Y + 2); x.lineTo(X + 34, Y - 28); x.stroke(); }
      else if (kind === "save") { x.moveTo(X - 24, Y - 30); x.lineTo(X + 24, Y - 30); x.lineTo(X + 24, Y + 30); x.lineTo(X, Y + 12); x.lineTo(X - 24, Y + 30); x.closePath(); x.stroke(); }
      else if (kind === "dots") { [-26, 0, 26].forEach((d) => { x.moveTo(X + d + 6, Y); x.arc(X + d, Y, 6, 0, 7); }); x.fill(); }
      else if (kind === "down") { x.moveTo(X - 26, Y - 4); x.lineTo(X - 26, Y + 26); x.lineTo(X + 26, Y + 26); x.lineTo(X + 26, Y - 4); x.moveTo(X, Y - 30); x.lineTo(X, Y + 12); x.moveTo(X - 14, Y - 2); x.lineTo(X, Y + 12); x.lineTo(X + 14, Y - 2); x.stroke(); }
      else if (kind === "disc") { x.fillStyle = "#222"; x.arc(X, Y, 34, 0, 7); x.fill(); x.fillStyle = "#c46cf0"; x.beginPath(); x.arc(X, Y, 14, 0, 7); x.fill(); }
      else if (kind === "ava") { x.fillStyle = "#8b79bb"; x.arc(X, Y, 40, 0, 7); x.fill(); x.fillStyle = "#ff2d55"; x.beginPath(); x.arc(X, Y + 42, 16, 0, 7); x.fill(); } }); if (n) T(n, X, Y + 62, 30, 700, "center"); };
    const g = x.createLinearGradient(0, 1380, 0, H); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)"); x.fillStyle = g; x.fillRect(0, 1380, W, H - 1380);
    if (k === "ig") { T("Reels", 50, 110, 52, 800); [["heart", "12,4 тис."], ["com", "318"], ["send", "1 204"], ["save", ""], ["dots", ""]].forEach(([q, n], i) => icon(1050 + i * 150, q, n));
      x.fillStyle = "#8b79bb"; x.beginPath(); x.arc(90, 1640, 34, 0, 7); x.fill(); T(OVN, 140, 1640, 36, 700); sh(() => { x.strokeStyle = "#fff"; x.lineWidth = 3; x.beginPath(); x.roundRect ? x.roundRect(370, 1615, 190, 52, 12) : x.rect(370, 1615, 190, 52); x.stroke(); }); T("Стежити", 465, 1641, 30, 700, "center");
      T(OVC(), 56, 1730, 32, 500); T("♫ Оригінальний звук · " + OVN, 56, 1800, 28, 500); }
    if (k === "tt") { T("Підписки   |   Для вас", W / 2, 120, 38, 700, "center"); [["ava", ""], ["heart", "48 тис."], ["com", "1 120"], ["save", "3 210"], ["send", "Поділ."], ["disc", ""]].forEach(([q, n], i) => icon(900 + i * 150, q, n));
      T("@" + OVN, 50, 1600, 38, 800); T(OVC(), 50, 1665, 32, 500); T("#анімація #2d #історія", 50, 1720, 32, 700); T("♫ оригінальний звук — " + OVN, 50, 1790, 28, 500); }
    if (k === "yt") { T("Shorts", 50, 110, 48, 800); [["heart", "8,1 тис."], ["down", "Не подоб."], ["com", "256"], ["send", "Поділитися"], ["disc", ""]].forEach(([q, n], i) => icon(1000 + i * 155, q, n));
      x.fillStyle = "#8b79bb"; x.beginPath(); x.arc(84, 1660, 32, 0, 7); x.fill(); T("@" + OVN, 130, 1660, 34, 700); x.fillStyle = "#fff"; x.beginPath(); x.roundRect ? x.roundRect(400, 1634, 230, 54, 27) : x.rect(400, 1634, 230, 54); x.fill(); T("Підписатися", 515, 1661, 28, 700, "center", "#111"); T(OVC(), 56, 1750, 32, 500); }
    x.restore(); }

  /* ---------- вибір музики з прослуховуванням ---------- */
  const MPV = { src: null, k: "" };
  function stopPrev() { try { MPV.src?.stop(); } catch (e) {} MPV.src = null; MPV.k = ""; }
  async function prevMusic(k, btn) { stopPrev(); stopPlay(); const ac = AC(); try { await ac.resume(); } catch (e) {}
    btn.textContent = "…"; const Lf = { dur: 12, mood: k, music: true, scenes: [], voice: new Float32Array(0), silent: true }; const y = await soundtrack(Lf);
    const b = ac.createBuffer(1, y.length, E().SR); b.copyToChannel(y, 0); const src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); src.start(); MPV.src = src; MPV.k = k; btn.textContent = "■";
    src.onended = () => { if (MPV.src === src) { MPV.src = null; MPV.k = ""; } btn.textContent = "▶"; }; }
  function musicList(box, cur, onPick) {
    const list = [...Object.entries(MOODS).map(([k, v]) => [k, v.n, `${v.bpm} уд/хв${v.perc > 1 ? " · з ударними" : v.soft ? " · м'яко" : ""}`]), ["off", "Без музики", "Тільки голос і звуки"]];
    if (cur === "auto") list.unshift(["auto", "AI вибере", "Під настрій тексту"]);
    box.innerHTML = `<div class="vopt">${list.map(([k, n, d]) => `<button type="button" data-mk="${k}" aria-pressed="${cur === k}" style="display:flex;align-items:center;gap:10px"><span style="flex:1"><b>${n}</b><span>${d}</span></span>${MOODS[k] ? `<i data-mp="${k}" role="button" aria-label="Прослухати" style="font-style:normal;flex:none;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.12);display:grid;place-items:center">▶</i>` : ""}</button>`).join("")}</div>`;
    box.querySelectorAll("[data-mk]").forEach((b) => b.onclick = (e) => { const pv = e.target.closest("[data-mp]");
      if (pv) { if (MPV.k === pv.dataset.mp) { stopPrev(); pv.textContent = "▶"; return; } box.querySelectorAll("[data-mp]").forEach((o) => o.textContent = "▶"); prevMusic(pv.dataset.mp, pv).catch(() => { pv.textContent = "▶"; say("Не вдалося відтворити"); }); return; }
      box.querySelectorAll("[data-mk]").forEach((o) => o.setAttribute("aria-pressed", o === b)); onPick(b.dataset.mk); }); }
  function panel(title, html) { const d = UI.root; d.querySelector(".cpanel")?.remove(); const p = document.createElement("div"); p.className = "cpanel";
    p.innerHTML = `<div class="cph"><b>${title}</b><button class="cx" type="button" data-pclose aria-label="Закрити">×</button></div><div class="cpb">${html}</div>`; d.appendChild(p); return p; }

  /* ---------- сцени ---------- */
  const POSE_N = { stand: "Стоїть", talk: "Говорить", think: "Думає", point: "Показує", shrug: "Розводить руками", cheer: "Радіє", sad: "Сумує", phone: "З телефоном", shock: "Шок", wave: "Махає", hold: "Тримає", sit: "Сидить", sitsad: "Сидить сумно", lie: "Лежить", walk: "Іде", run: "Біжить" };
  const FACE_N = { calm: "Спокій", happy: "Радість", sad: "Сум", angry: "Злість", shock: "Шок", smirk: "Хитра усмішка", worried: "Тривога", sleep: "Спить" };
  const SHOT_N = { wide: "Загальний", medium: "По пояс", close: "Крупно", face: "Обличчя" }, CAM_N = { push: "Наїзд", pull: "Від'їзд", pan_l: "Вліво", pan_r: "Вправо", still: "Стоїть", shake: "Тряска", punch: "Ривок" }, TR_N = { cut: "Склейка", whip: "Змах", fade: "Темрява" }, TIME_N = { day: "День", sunset: "Захід", night: "Ніч" };
  const HUD_N = { none: "Немає", panel: "Вікно з %", chart: "Графік", bars: "Стовпці", counter: "Число", day: "День N", calendar: "Календар", jar: "Банка грошей", clock: "Годинник", chat: "Листування", stamp: "Штамп", people: "Люди 1 з N", pie: "Кругова", gauge: "Спідометр", brain: "Мозок", check: "Чекліст", compare: "До/після", rings: "Кільця", network: "Мережа" };
  async function aiScene(L, i, wish) { const sc = L.scenes[i], a1 = L.scenes[i + 1]?.a ?? L.words.length, words = L.words.slice(sc.a, a1).map((w, k) => `${sc.a + k}:${w.w}`).join(" ");
    const strip = (o) => o ? (({ t0, t1, hitT, seed, dir, ...r }) => ({ ...r, hud: r.hud ? { ...r.hud, y: +(r.hud.y / H).toFixed(2), at: undefined } : null }))(o) : null;
    const r = await sample.json(`Ти режисер вертикальної кіно-анімації. Переробляєш ОДНУ сцену. Її слова з номерами: ${words}
Попередня сцена: ${JSON.stringify(strip(L.scenes[i - 1]))}. Наступна: ${JSON.stringify(strip(L.scenes[i + 1]))}. Поточна: ${JSON.stringify(strip(sc))}.
${wish ? `Людина просить: «${wish}». Зроби саме це, решту залиш.` : "Зроби інший, сильніший варіант цієї сцени (інша локація або план, інша дія героя)."}
${RULES}
${SPEC}
Відповідай тільки JSON: {"scene":{"a":${sc.a},…}}`, { cache: false, sys: ["director"], kb: ["style", "edit", "story", "camera", "general"], max: 2500 });
    const sc2 = r?.scene || r?.scenes?.[0]; if (!sc2) throw new Error("plan_empty"); sc2.a = sc.a; const n = normPlan({ scenes: [{ ...sc2, a: 0 }] }, L)[0]; n.a = sc.a; L.scenes[i] = n; }
  let AUD_DIRTY = false;
  async function freshAudio() { if (!AUD_DIRTY) return; AUD_DIRTY = false; L.aud = await soundtrack(L); }
  function adSheet(i, refresh) { if (L.adInline) { const sc = L.scenes[i];
      const P = panel("Рекламна вставка", `<p class="cnt" style="margin:0 0 8px">Тим самим голосом: персонаж дістає телефон → на екрані крок за кроком видно те, що звучить → телефон вилітає на глядача, і історія продовжується. ${fmt(sc.t0)}–${fmt(sc.t1)}.</p>
        <div class="row"><button class="btn" type="button" data-sp>▶ Переглянути вставку</button></div><p class="cnt" style="margin:10px 0 0">Змінити слова чи тип реклами — на кроках 1–2 (текст і озвучка).</p>
        <div class="sec"><button class="btn" type="button" id="cadrm2">Показати замість телефона звичайні сцени</button></div>`);
      P.querySelector("[data-pclose]").onclick = () => P.remove(); P.querySelector("[data-sp]").onclick = () => refresh(i, true);
      P.querySelector("#cadrm2").onclick = () => remix(async () => { L.adInline = false; L.adK = L.adT = L.adD = L.adTm = null; L.scenes = L.scenes.filter((q) => !q.ad); const prev = [...L.scenes].filter((q) => q.a < L.adRange[0]).pop(); if (prev) L.scenes.push({ ...JSON.parse(JSON.stringify(prev)), a: L.adRange[0], tr: "whip", cast: [{ who: "hero", x: .5, pose: "phone", face: "happy" }], props: [], cap: null, hud: null }); P.remove(); return "Вставку з телефоном прибрано"; });
      return; }
    const sc = L.scenes[i], voiced = !!L.adV;
    const P = panel("Рекламна вставка", `<p class="cnt" style="margin:0 0 8px">Герой дістає телефон → пришвидшено видно, як робиться відео в YuVi і скільки можна заробити → заклик → екран летить у наступну сцену. ${voiced ? "Озвучено тим самим голосом, що й відео (×${AD.speed} швидше); рекламу вшито в сюжет твого тексту." : "Без голосу — лише екран і написи."} ${fmt(sc.t0)}–${fmt(sc.t1)}.</p>
      <div class="row"><button class="btn" type="button" data-sp>▶ Переглянути вставку</button>${voiced ? `<button class="btn" type="button" id="cadbr">Інший текст вставки</button>` : ""}</div>
      ${voiced ? `<p class="cnt" style="margin:8px 0 0">«${escH(adParts(L.ad, L.adWord, L.adV.br).map((q) => q.t).join(" "))}»</p>` : ""}
      <div class="sec"><h4>Заклик</h4><div class="chips">${["bio", "comment"].map((k) => `<button class="chip" type="button" data-adv="${k}" aria-pressed="${(sc.kind || L.ad) === k}">${AD_KINDS[k]}</button>`).join("")}</div><input class="tx" id="cadw2" style="margin-top:8px" maxlength="14" placeholder="Слово для коментарів" value="${escH(L.adWord || "АНІМАЦІЯ")}"></div>
      <div class="sec"><button class="btn" type="button" id="cadrm">Прибрати рекламу з цього відео</button></div>`);
    P.querySelector("[data-pclose]").onclick = () => P.remove();
    P.querySelector("[data-sp]").onclick = () => refresh(i, true);
    const redo = async (nb, msg) => { stopPlay(); try { await E().busyRun("montage", async () => { await revoiceAd(L, nb); ensureAd(L); timeline(L); L.aud = await soundtrack(L); }); P.remove(); screenEdit(msg); } catch (e) { console.error(e); say("Не вийшло переозвучити. Спробуй ще раз"); } };
    P.querySelectorAll("[data-adv]").forEach((b) => b.onclick = () => { if (L.ad === b.dataset.adv) return; L.ad = sc.kind = b.dataset.adv; P.querySelectorAll("[data-adv]").forEach((o) => o.setAttribute("aria-pressed", o === b)); if (voiced) redo(false, "Заклик змінено й переозвучено"); else refresh(i); });
    P.querySelector("#cadw2").oninput = (e) => { L.adWord = e.target.value.trim().toUpperCase(); };
    P.querySelector("#cadw2").onchange = () => { if (voiced && L.ad === "comment") redo(false, "Слово змінено й переозвучено"); else refresh(i); };
    const nb = P.querySelector("#cadbr"); if (nb) nb.onclick = () => { if (regenOk()) { L.regen = (L.regen || 0) + 1; redo(true, "Новий текст вставки готовий"); } };
    P.querySelector("#cadrm").onclick = async () => { stopPlay(); removeAd(L); timeline(L); L.aud = await soundtrack(L); P.remove(); screenEdit("Рекламу прибрано"); }; }

  /* ---------- студія рекламної вставки (лише власник): текст + справжній запис екрана → promo/ad.json і кадри ---------- */
  const FW = 420, FH = Math.round(420 * SCR.h / SCR.w);
  const ENC = (() => { try { const c = document.createElement("canvas"); c.width = c.height = 2; return c.toDataURL("image/webp").startsWith("data:image/webp") ? "image/webp" : "image/jpeg"; } catch (e) { return "image/jpeg"; } })();
  const encC = (c) => new Promise((res) => c.toBlob((b) => res(b), ENC, ENC === "image/webp" ? .72 : .76));
  const seekTo = (v, t) => new Promise((res) => { let ok = false; const done = () => { if (ok) return; ok = true; v.removeEventListener("seeked", done); requestAnimationFrame(() => res()); }; v.addEventListener("seeked", done); v.currentTime = Math.max(0, Math.min(t, (v.duration || t) - .04)); setTimeout(done, 2500); });
  let ADPLAY = 0, ADAC = null;
  async function adStudio() { stopPlay(); try { await E().busyRun("text", () => loadAd(true)); } catch (e) {} const d = shell(), B = $(d, ".cb"), F = $(d, ".cf");
    const RECS = [["topic", "Крок 1 · тема і «Написати текст»", 24], ["make", "Крок 2 · текст → редактор → «Зберегти»", 28], ["earn", "Крок 3 · «Заробіток» / партнерка", 20], ["cta_bio", "Заклик «шапка профілю» — можна пропустити, буде картка", 14], ["cta_comment", "Заклик «коментарі» — можна пропустити, буде картка", 14]];
    const SRC = {}, ST = { fr: null, tg: {}, buf: {} }; RECS.forEach(([id]) => { if (ADF[id]?.length) SRC[id] = { k: "keep" }; });
    const cta = AD.beats.find((b) => b.id === "cta"), tA = (k, n, v) => `<label class="cnt" style="display:block;margin:10px 0 4px">${escH(n)}</label><textarea class="tx" rows="2" data-t="${k}" style="width:100%;resize:vertical">${escH(v)}</textarea>`;
    B.innerHTML = `<div class="scr">
      <div class="sec"><h4>Студія рекламної вставки <span class="tag">ТЕСТ</span></h4><p class="cnt">Що збережеш тут — піде в усі нові відео з рекламою. Вставку озвучує той самий голос, що й відео. Реклама вшивається в сюжет кожного відео: на цікавому місці оповідач розв'язує задачу через YuVi, а після реклами історія продовжується.</p></div>
      <div class="sec"><h4>1 · Текст</h4><p class="cnt">Кроки й заклик звучать дослівно в усіх відео. Місточок і повернення пишуться під кожне відео (тут — запасні). У тексті не називаємо сервіс — лише «студія».</p>${tA("in", "Місточок (шаблон)", AD.bridge.in)}${AD.beats.filter((b) => b.id !== "cta").map((b) => tA("b_" + b.id, b.n, b.say)).join("")}${tA("cta_bio", "Заклик · шапка профілю", cta.say.bio)}${tA("cta_comment", "Заклик · коментарі ({WORD} — слово, яке вибрала людина)", cta.say.comment)}${tA("out", "Повернення (шаблон)", AD.bridge.out)}<label class="cnt" style="display:block;margin:12px 0 4px">Швидкість голосу вставки: <b id="aspv">×${AD.speed}</b></label><input type="range" id="aspd" min="1" max="1.6" step="0.05" value="${AD.speed}" style="width:100%">
        <p class="cnt" style="margin:12px 0 6px">Прослухати голосом, вибраним у «Кіно-анімації»:</p><div class="row"><button class="btn" type="button" data-say="bio">▶ Шапка</button><button class="btn" type="button" data-say="comment">▶ Коментарі</button></div><p class="cnt" id="alen" style="margin-top:6px"></p></div>
      <div class="sec"><h4>2 · Запис екрана</h4><p class="cnt">Запиши екран iPhone: як створюєш відео в «Кіно-анімації» і як відкриваєш «Заробіток». Завантаж запис, зупини на потрібному місці й тисни «Початок» / «Кінець» для кожного кроку — у вставці цей шматок пришвидшиться під голос. Замість запису можна дати скріни. Без запису крок буде намальованим.</p>
        <label class="btn" style="display:inline-block;margin-top:6px">📹 Вибрати запис екрана<input type="file" id="avf" accept="video/*" hidden></label>
        <video id="av" playsinline muted controls preload="auto" style="display:none;width:100%;max-height:46vh;margin-top:10px;border-radius:12px;background:#000"></video>
        ${RECS.map(([id, n]) => `<div data-r="${id}" style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-top:1px solid rgba(127,127,127,.2)"><canvas width="60" height="124" data-pv style="border-radius:8px;background:#111;flex:none"></canvas><div style="flex:1;min-width:0"><b style="font-size:14px">${escH(n)}</b><div class="cnt" data-st></div><div class="chips" style="margin-top:6px"><button class="chip" type="button" data-a>Початок</button><button class="chip" type="button" data-b>Кінець</button><label class="chip">Скріни<input type="file" accept="image/*" multiple hidden data-img></label><button class="chip" type="button" data-x>Прибрати</button></div></div></div>`).join("")}</div>
      <div class="sec"><h4>3 · Перевірка</h4><canvas id="apv" width="270" height="480" style="width:100%;max-width:270px;border-radius:14px;background:#000;display:block;margin:0 auto"></canvas><div class="row" style="margin-top:8px;justify-content:center"><button class="btn" type="button" data-pk="bio">▶ Шапка</button><button class="btn" type="button" data-pk="comment">▶ Коментарі</button></div><p class="cnt" style="text-align:center">Із голосом — якщо перед цим натиснув «Прослухати».</p></div></div>`;
    F.innerHTML = `<button class="btn" type="button" id="aback">Назад</button><button class="btn main" type="button" id="asave">Зберегти для всіх відео</button>`;
    const val = (k) => B.querySelector(`[data-t="${k}"]`).value.trim();
    const draft = () => ({ beats: AD.beats.map((b) => b.id === "cta" ? { id: "cta", say: { bio: val("cta_bio"), comment: val("cta_comment") } } : { id: b.id, say: val("b_" + b.id) }), bridge: { in: val("in"), out: val("out") } });
    const useDraft = () => { AD = mergeAd({ ...draft(), pack: AD.pack, v: AD.v, speed: +$(B, "#aspd").value }); };
    $(B, "#aspd").oninput = (e) => { $(B, "#aspv").textContent = "×" + (+e.target.value).toFixed(2).replace(/0$/, ""); ST.tg = {}; ST.buf = {}; };
    B.querySelectorAll("[data-t]").forEach((t) => t.oninput = () => { ST.tg = {}; ST.buf = {}; });
    const v = $(B, "#av");
    $(B, "#avf").onchange = (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; v.src = URL.createObjectURL(f); v.style.display = ""; v.load(); RECS.forEach(([id]) => { if (SRC[id]?.k === "vid") { delete SRC[id]; upd(id); } }); };
    const thumb = (id, src, w, h) => { const c = B.querySelector(`[data-r="${id}"] [data-pv]`), x = c.getContext("2d"); x.fillStyle = "#111"; x.fillRect(0, 0, c.width, c.height); if (!src || !w) return; const k = Math.max(c.width / w, c.height / h); x.drawImage(src, (c.width - w * k) / 2, (c.height - h * k) / 2, w * k, h * k); };
    const upd = (id) => { ST.fr = null; const s = SRC[id], el = B.querySelector(`[data-r="${id}"] [data-st]`);
      el.textContent = !s ? "— намальований екран" : s.k === "keep" ? `✓ збережений запис (${ADF[id].length} кадрів)` : s.k === "img" ? `${s.imgs.length} скрін(и)` : `запис ${s.a.toFixed(1)}–${s.b.toFixed(1)} с (${(s.b - s.a).toFixed(1)} с → стиснеться під голос)`;
      if (!s) thumb(id); else if (s.k === "keep") { const im = ADF[id][0]; thumb(id, im, im.naturalWidth, im.naturalHeight); } else if (s.k === "img") thumb(id, s.imgs[0], s.imgs[0].naturalWidth, s.imgs[0].naturalHeight); };
    RECS.forEach(([id]) => { const r = B.querySelector(`[data-r="${id}"]`), need = () => { if (!v.src) { say("Спершу вибери запис екрана"); return false; } return true; };
      r.querySelector("[data-a]").onclick = () => { if (!need()) return; const s = SRC[id]?.k === "vid" ? SRC[id] : { k: "vid", a: 0, b: 0 }; s.a = v.currentTime; if (s.b <= s.a + .2) s.b = Math.min(v.duration || s.a + 3, s.a + 3); SRC[id] = s; upd(id); thumb(id, v, v.videoWidth, v.videoHeight); };
      r.querySelector("[data-b]").onclick = () => { if (!need()) return; const s = SRC[id]?.k === "vid" ? SRC[id] : { k: "vid", a: Math.max(0, v.currentTime - 3), b: 0 }; s.b = v.currentTime; if (s.a >= s.b - .2) s.a = Math.max(0, s.b - 3); SRC[id] = s; upd(id); };
      r.querySelector("[data-img]").onchange = async (e) => { const fs = [...(e.target.files || [])].sort((a, b) => a.name.localeCompare(b.name)); e.target.value = ""; if (!fs.length) return; const imgs = fs.slice(0, 8).map(blobImg); await Promise.all(imgs.map((im) => im.decode().catch(() => {}))); SRC[id] = { k: "img", imgs }; upd(id); };
      r.querySelector("[data-x]").onclick = () => { delete SRC[id]; upd(id); }; upd(id); });
    async function grab(id, n) { const s = SRC[id]; if (!s) return null; if (s.k === "keep") return "keep"; const c = document.createElement("canvas"); c.width = FW; c.height = FH; const x = c.getContext("2d"), out = [];
      const put = (src, w, h, z = 1) => { x.fillStyle = "#000"; x.fillRect(0, 0, FW, FH); const k = Math.max(FW / w, FH / h) * z; x.drawImage(src, (FW - w * k) / 2, (FH - h * k) / 2, w * k, h * k); };
      if (s.k === "vid") { v.pause(); for (let i = 0; i < n; i++) { await seekTo(v, s.a + (s.b - s.a) * i / (n - 1)); put(v, v.videoWidth, v.videoHeight); out.push(await encC(c)); } }
      else { const m = s.imgs.length; for (let i = 0; i < n; i++) { const f = i * m / n, j = Math.min(m - 1, Math.floor(f)); put(s.imgs[j], s.imgs[j].naturalWidth, s.imgs[j].naturalHeight, 1 + .05 * (f - j)); out.push(await encC(c)); } }
      return out; }
    async function frames() { if (ST.fr) return ST.fr; const res = {}; let i = 0; for (const [id, , n] of RECS) { try { yvBusy?.stage?.(`Кадри: крок ${++i} з ${RECS.length}`); } catch (e) {} const f = await grab(id, n); if (f) res[id] = f; } ST.fr = res; return res; }
    const playY = (y) => { try { ADAC?.close(); } catch (e) {} const ac = ADAC = new (window.AudioContext || window.webkitAudioContext)(), b = ac.createBuffer(1, y.length, E().SR); b.copyToChannel(y, 0); const s = ac.createBufferSource(); s.buffer = b; s.connect(ac.destination); s.start(); };
    B.querySelectorAll("[data-say]").forEach((b) => b.onclick = async () => { const kind = b.dataset.say; useDraft(); const voice = await adVoice(null); if (!voice) { say("Спершу вибери голос у «Кіно-анімації»"); return; }
      const parts = adParts(kind, OPT.adWord || "АНІМАЦІЯ", AD.bridge);
      try { const y = tstretch(await E().busyRun("voice", () => ttsAudio(parts.map((p) => p.t).join(" ").replace(/…\s*…/g, "… "), voice)), +$(B, "#aspd").value || AD.speed); const tg = adTiming(parts, y); ST.tg[kind] = tg; ST.buf[kind] = y; $(B, "#alen").textContent = `≈ ${tg.D.toFixed(1)} с разом із місточком і поверненням (місточок у відео буде свій).`; playY(y); }
      catch (e) { console.warn(e); say(TTS_ERR[e?.message] || "Не вийшло озвучити"); } });
    B.querySelectorAll("[data-pk]").forEach((b) => b.onclick = async () => { const kind = b.dataset.pk; useDraft(); let fr;
      try { fr = await E().busyRun("montage", frames); } catch (e) { console.warn(e); say("Не вийшло взяти кадри з запису"); return; }
      const loc = {}; Object.entries(fr).forEach(([id, f]) => { loc[id] = f === "keep" ? ADF[id] : f.map(blobImg); }); await Promise.all(Object.values(loc).flat().map((im) => im.decode ? im.decode().catch(() => {}) : 0)); ADF = loc;
      const L2 = DEMOPLAN(), tg = ST.tg[kind]; L2.ad = kind; L2.adWord = OPT.adWord || "АНІМАЦІЯ"; L2.voice = new Float32Array(Math.round(L2.dur * E().SR)); insertAd(L2, 15, null, tg ? { ...tg } : null); ensureAd(L2); timeline(L2);
      const cv = $(B, "#apv"), x = cv.getContext("2d"), t0 = L2.adT - .8, t1 = L2.adT + adDur(L2) + 1.2, st = performance.now(), id = ++ADPLAY; let said = false;
      const loop = () => { if (id !== ADPLAY || !cv.isConnected) return; const t = t0 + (performance.now() - st) / 1000; if (t > t1) return; if (!said && tg && t >= L2.adT) { said = true; playY(ST.buf[kind]); } drawFrame(x, L2, t, cv.width, cv.height); requestAnimationFrame(loop); }; loop(); });
    $(F, "#aback").onclick = async () => { ADPLAY++; try { ADAC?.close(); } catch (e) {} await loadAd(true); screenSetup(); };
    $(F, "#asave").onclick = async () => { useDraft(); const j = draft();
      if (!j.beats.every((b) => b.id === "cta" ? b.say.bio && b.say.comment : b.say) || !j.bridge.in || !j.bridge.out) { say("Заповни всі тексти"); return; }
      try { await E().busyRun("montage", async () => { const fr = await frames(), ver = Date.now().toString(36), parts = [], fx = {}; let o = 0;
          for (const [id, f] of Object.entries(fr)) { let list, t = ENC, sb = false; if (f === "keep") { const old = AD.pack?.frames?.[id]; if (!old || !ADB) continue; t = old.t || "image/jpeg"; sb = !!old.sb; list = old.r.map(([a, l]) => new Blob([ADB.slice(a, a + l)])); } else list = f;
            fx[id] = { t, sb, r: list.map((b) => { const r = [o, b.size]; o += b.size; parts.push(b); return r; }) }; }
          let pack = null; if (parts.length) { const file = `ad-${ver}.bin`; try { yvBusy?.stage?.("Завантажую кадри…"); } catch (e) {} await SRV.promoPut(file, new Blob(parts, { type: "application/octet-stream" })); pack = { file, w: FW, h: FH, frames: fx }; }
          await SRV.promoPut("ad.json", new Blob([JSON.stringify({ v: ver, ...j, speed: AD.speed, pack })], { type: "application/json" }), 60);
          if (AD.pack?.file && AD.pack.file !== pack?.file) SRV.promoDel([AD.pack.file]); });
        await loadAd(true); say("Збережено. Нові відео з рекламою вже з цим текстом і записом"); }
      catch (e) { console.error(e); const m = String(e?.message || e); say(/bucket|not found/i.test(m) ? "Немає сховища promo — виконай крок 81 у Supabase" : /row-level|policy|403|unauthor/i.test(m) ? "Немає прав: увійди як власник" : "Не вийшло зберегти: " + m.slice(0, 80)); } }; }
  function sceneSheet(i, refresh) { if (L.scenes[i]?.ad) return adSheet(i, refresh); const sc = L.scenes[i], hero = sc.cast.find((c) => c.who === "hero") || sc.cast[0], a1 = L.scenes[i + 1]?.a ?? L.words.length;
    const chips = (key, map, cur) => `<div class="chips">${Object.entries(map).map(([k, n]) => `<button class="chip" type="button" data-sk="${key}" data-sv="${k}" aria-pressed="${cur === k}">${n}</button>`).join("")}</div>`;
    const P = panel(`Сцена ${i + 1} · ${fmt(sc.t0)}–${fmt(sc.t1)}`, `<p class="cnt" style="margin:0 0 8px;color:#e4e4e7">«${escH(L.words.slice(sc.a, a1).map((w) => w.w).join(" "))}»</p>
      <div class="row"><button class="btn" type="button" data-sp>▶ Переглянути сцену</button></div>
      <div class="sec"><h4>Що не так у сцені?</h4><div class="fix">${[["overlap", "Текст налазить на текст"], ["face", "Напис закриває героя"], ["cut", "Напис не влазить"], ["words", "Картинка не про ці слова"], ["pose", "Герой робить не те"], ["place", "Не та локація"], ["extra", "Зайве в кадрі"]].map(([k, n]) => `<button class="chip" type="button" data-fx="${k}">${n}</button>`).join("")}</div>
        <div class="ask" style="margin-top:8px"><input class="tx" id="cscask" placeholder="Або опиши: що не так і як має бути"><button class="btn sq" type="button" id="cscgo" aria-label="Виправити">✎</button></div><button class="btn" type="button" id="cscre" style="margin-top:8px">↻ Інший варіант цієї сцени</button></div>
      <div class="sec"><h4>Напис</h4><input class="tx" id="csccap" placeholder="До 5 слів, *слово* — жовтим" value="${escH(sc.cap?.t || "")}"></div>
      <div class="sec"><h4>Локація</h4>${chips("place", Object.fromEntries(Object.entries(PLACES).map(([k, v]) => [k, v.n])), sc.place)}</div>
      <div class="sec"><h4>Час доби</h4>${chips("time", TIME_N, sc.time)}</div>
      <div class="sec"><h4>План</h4>${chips("shot", SHOT_N, sc.shot)}</div>
      <div class="sec"><h4>Камера</h4>${chips("cam", CAM_N, sc.cam)}</div>
      ${i ? `<div class="sec"><h4>Перехід у сцену</h4>${chips("tr", TR_N, sc.tr)}</div>` : ""}
      ${hero ? `<div class="sec"><h4>Поза героя</h4>${chips("pose", POSE_N, hero.pose)}</div><div class="sec"><h4>Емоція</h4>${chips("face", FACE_N, hero.face)}</div>` : ""}
      <div class="sec"><h4>Тварина в сцені</h4>${(() => { const pet = sc.cast.find((c) => WHO[c.who]?.pet); return `<div class="chips"><button class="chip" type="button" data-spet="" aria-pressed="${!pet}">Немає</button>${Object.entries(BREED).map(([k, v]) => `<button class="chip" type="button" data-spet="${k}" aria-pressed="${pet?.breed === k}">${v.n}</button>`).join("")}</div>${pet ? `<div class="chips" style="margin-top:6px">${PETPOSE.map((q) => `<button class="chip" type="button" data-spp="${q}" aria-pressed="${pet.pose === q}">${{ stand: "Стоїть", walk: "Іде", run: "Біжить", sit: "Сидить", lie: "Лежить", talk: BREED[pet.breed]?.cat ? "Нявкає" : "Гавкає" }[q]}</button>`).join("")}</div>` : ""}`; })()}</div>
      <div class="sec"><h4>Вікно поверх кадру</h4>${chips("hud", HUD_N, sc.hud?.k || "none")}<input class="tx" id="cschud" style="margin-top:8px" placeholder="Заголовок вікна / число" value="${escH(sc.hud?.k === "counter" ? String(sc.hud?.v ?? "") : sc.hud?.t || "")}"></div>`);
    const apply = () => { timeline(L); AUD_DIRTY = true; refresh(i); };
    P.querySelector("[data-pclose]").onclick = async () => { P.remove(); await freshAudio(); };
    P.querySelectorAll("[data-sk]").forEach((b) => b.onclick = () => { const k = b.dataset.sk, v = b.dataset.sv; P.querySelectorAll(`[data-sk="${k}"]`).forEach((o) => o.setAttribute("aria-pressed", o === b)); pushH();
      if (k === "pose" || k === "face") { if (hero) { hero[k] = v; if (k === "pose") { hero.to = undefined; hero.y = undefined; } } }
      else if (k === "hud") { if (v === "none") sc.hud = null; else { sc.hud = { ...(sc.hud || {}), k: v, i: sc.a, y: (sc.cast.length ? (v === "counter" ? .24 : v === "brain" ? .32 : .27) : .4) * H, t: sc.hud?.t || "", v: sc.hud?.v ?? (v === "counter" ? "100" : 1), items: sc.hud?.items || (v === "check" ? ["Крок 1", "Крок 2", "Крок 3"] : v === "compare" ? ["Було", "Стало"] : undefined) }; } }
      else sc[k] = v; apply(); });
    P.querySelectorAll("[data-spet]").forEach((b) => b.onclick = () => { pushH(); const k = b.dataset.spet; sc.cast = sc.cast.filter((c) => !WHO[c.who]?.pet);
      if (k) { const h = sc.cast.find((c) => c.who === "hero"); sc.cast = sc.cast.slice(0, 2); sc.cast.push({ who: BREED[k].cat ? "cat" : "dog", breed: k, x: h && (h.x ?? .5) > .5 ? .22 : .74, pose: "stand" }); }
      apply(); sceneSheet(i, refresh); });
    P.querySelectorAll("[data-spp]").forEach((b) => b.onclick = () => { const pet = sc.cast.find((c) => WHO[c.who]?.pet); if (!pet) return; pushH(); pet.pose = b.dataset.spp; pet.to = undefined; apply(); P.querySelectorAll("[data-spp]").forEach((o) => o.setAttribute("aria-pressed", o === b)); });
    P.querySelector("#csccap").onchange = (e) => { pushH(); const t = e.target.value.trim(); sc.cap = t ? { ...(sc.cap || {}), t: t.slice(0, 60), i: sc.cap?.i ?? sc.a } : null; apply(); };
    P.querySelector("#cschud").onchange = (e) => { if (!sc.hud) return; pushH(); const t = e.target.value.trim(); if (sc.hud.k === "counter") sc.hud.v = t; else sc.hud.t = t.slice(0, 30); apply(); };
    P.querySelector("[data-sp]").onclick = async () => { await freshAudio(); refresh(i, true); };
    const ai = async (wish) => { if (!regenOk()) return; stopPlay(); pushH(); try { await E().busyRun("montage", async () => { try { yvBusy?.stage?.("Режисую сцену…"); } catch (e) {} await aiScene(L, i, wish); L.regen = (L.regen || 0) + 1; timeline(L); L.aud = await soundtrack(L); AUD_DIRTY = false; }); refresh(i); sceneSheet(i, refresh); } catch (e) { console.error(e); L.hist.pop(); say(e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло змінити сцену. Спробуй ще раз"); } };
    P.querySelector("#cscgo").onclick = () => { const t = P.querySelector("#cscask").value.trim(); if (!t) return P.querySelector("#cscask").focus(); ai(t); };
    P.querySelector("#cscre").onclick = () => ai("");
    const FXW = { cut: "Напис не влазить у кадр — зроби його коротшим (до 3 слів), зміст той самий", words: "Картинка не відповідає словам цієї сцени — покажи буквально те, про що звучать слова", pose: "Герой робить не те — дай дію й емоцію, які точно відповідають словам", place: "Локація не підходить — вибери ту, що логічна для цих слів і для сусідніх сцен", extra: "У кадрі зайве — прибери предмети чи вікна, що не стосуються слів; залиш лише головне" };
    P.querySelectorAll("[data-fx]").forEach((b) => b.onclick = () => { const k = b.dataset.fx, more = P.querySelector("#cscask").value.trim(); track("scene_fix", { v: k });
      if (k === "overlap" || k === "face") { pushH(); if (k === "overlap") fixLayout(L, sc, true); if (k === "face" && sc.cap) sc.cap.y = 300; if (k === "face" && sc.hud?.k && sc.hud.k !== "none") sc.hud.y = Math.max(sc.hud.y || 700, 760); apply(); say(k === "overlap" ? "Розвів текст: напис угорі, вікно нижче, субтитри внизу" : "Напис піднято над героєм"); if (!more) return; }
      ai((FXW[k] || "") + (more ? `. Ще: ${more}` : "")); });
  }
  const pushH = () => { L.hist.push(JSON.stringify({ scenes: L.scenes, mood: L.mood, music: L.music })); if (L.hist.length > 25) L.hist.shift(); };

  /* ---------- плани збережень: 10 / 20 / 50 відео на 30 днів + докупівля ---------- */
  const PLANS = [["cine_10", "Старт"], ["cine_20", "Про"], ["cine_50", "Макс"]], PACKS = [["cine_pack5", "Докупити"], ["cine_pack10", "Докупити"]];
  const DEFSEC = { cine_10: 900, cine_20: 1800, cine_50: 4500, cine_pack5: 450, cine_pack10: 900 };
  const grn = (k) => `${Math.round(k / 100)} грн`, mm = (s) => s >= 60 ? `${Math.floor(s / 60)} хв${s % 60 ? " " + (s % 60) + " с" : ""}` : `${s} с`;
  function payFor(product, price, title, note, done) { const root = UI.root; if (typeof SRV?.pay !== "function") return say("Оплата недоступна");
    root.style.display = "none"; SRV.pay(() => { root.style.display = ""; done?.(); }, { product, price: price / 100, title, note, once: true });
    const open = () => { const ov = document.getElementById("ov"); return ov && !ov.hidden; };
    const iv = setInterval(() => { if (root.style.display !== "none") return clearInterval(iv); if (!open()) setTimeout(() => { if (!open() && root.style.display === "none") { root.style.display = ""; clearInterval(iv); } }, 700); }, 1000); }
  async function buyPanel(retry, need) { let info = null; try { info = await SRV.cineLeft(); } catch (e) {}
    const pr = info?.prices || { cine_10: 39900, cine_20: 69900, cine_50: 129000, cine_pack5: 19900, cine_pack10: 34900 }, sec = info?.secs || DEFSEC, hasPlan = (info?.plan_left || 0) > 0 || !!info?.plan_until, left = info?.left ?? 0;
    const ex = (s) => `≈${Math.floor(s / 45)} відео по 45 с`;
    const P = panel("Секунди відео", `<p class="cnt" style="margin:0 0 10px;color:#e4e4e7">Це відео — <b>${need || Math.ceil(L.dur)} с</b>, залишилось <b>${left} с</b>. ${hasPlan ? "Докупи секунди або візьми більший план." : "Обери план: секунди списуються лише при збереженні готового відео, рівно на його довжину. Чернетки, правки й 5 покращень — безкоштовно."}</p>
      <div class="vopt">${PLANS.map(([k, n]) => `<button type="button" data-buy="${k}"><b>${n}: ${sec[k]} с (${mm(sec[k])}) — ${grn(pr[k])}</b><span>на 30 днів · ${ex(sec[k])}</span></button>`).join("")}</div>
      ${hasPlan ? `<div class="sec"><h4>Докупити понад ліміт</h4><div class="vopt">${PACKS.map(([k]) => `<button type="button" data-buy="${k}"><b>+${sec[k]} с — ${grn(pr[k])}</b><span>${ex(sec[k])} · діють, поки є план</span></button>`).join("")}</div></div>` : ""}
      <p class="cnt" style="margin-top:10px">30 днів від оплати, без автосписань. Повторне збереження того самого відео — безкоштовно. Готові голоси й свій запис — безкоштовно.</p>`);
    P.querySelector("[data-pclose]").onclick = () => P.remove();
    P.querySelectorAll("[data-buy]").forEach((b) => b.onclick = () => { const k = b.dataset.buy, isPlan = !k.includes("pack"), nm = isPlan ? `${PLANS.find((q) => q[0] === k)[1]} — ${sec[k]} с` : `+${sec[k]} с`;
      track("buy_open", { v: k }); payFor(k, pr[k], `Кіно-анімація: ${nm}`, isPlan ? `${sec[k]} секунд відео на 30 днів від оплати. Без автосписань.` : "Докупівля секунд понад ліміт плану.", () => { P.remove(); say("Оплачено ✓ Зберігаю відео"); retry?.(); }); }); }
  // перевірка ліміту перед збереженням: true — можна зберігати
  async function canSave() { if (isOwner()) return true; if (!window.SRV?.session) { try { SRV.login("Щоб зберегти відео, увійди або зареєструйся."); } catch (e) {} return false; }
    try { const r = await SRV.cineTake(L.key, Math.ceil(L.dur - (L.adK != null ? adDur(L) : 0))); if (r?.ok) { if (r.spent) say(`Списано ${r.spent} с · залишилось ${r.left} с`); return true; } L._need = r?.need; return "buy"; }
    catch (e) { if (/cine_take|does not exist|function/.test(e?.message || "")) { console.warn("cine_take not deployed", e); return true; } say("Не вдалося перевірити ліміт. Спробуй ще раз"); return false; } }

  // крок 4: фінальне меню — як у «Рілс маркером»: шаблони над прев'ю, прев'ю з плеєром, «Зберегти відео», вкладки правок
  const ET = { scenes: "Сцени", look: "Вигляд", subs: "Субтитри", voice: "Озвучка", music: "Музика", sfx: "Звуки" };
  let ETAB = "scenes";
  function screenEdit(msg) { stopPlay(); stopPrev(); const d = shell(), B = $(d, ".cb"), F = $(d, ".cf");
    B.innerHTML = `${msg ? `<div class="msg">${escH(msg)}</div>` : ""}<div class="scr">${STEPS(5)}
      <div class="vtop2"><button type="button" id="ctmine">Мої шаблони</button><button type="button" id="ctsave">Зберегти шаблон</button></div>
      <div class="stage" style="height:min(58vh,560px)"><div class="cvw"><canvas width="540" height="960" id="ccv"></canvas><button class="pb" type="button" id="cpb" aria-label="Відтворити"><i>▶</i></button></div></div>
      <div class="seek"><input type="range" id="cseek" min="0" max="${L.dur.toFixed(2)}" step="0.01" value="0"><span id="ctime">0:00 / ${fmt(L.dur)}</span><button class="chip" type="button" id="covl" title="Як виглядатиме в соцмережі">📱 ${OVL[OV]}</button></div>
      <div class="row" style="margin-top:10px"><button class="btn main" type="button" id="csave">Зберегти відео</button></div><p class="cnt" id="cleft" style="margin:6px 2px 0;text-align:center"></p>
      <div class="chips etabs2">${Object.entries(ET).map(([k, n]) => `<button class="chip" type="button" data-et="${k}" aria-pressed="${ETAB === k}">${n}</button>`).join("")}</div>
      <div id="cetp"></div></div>`;
    F.innerHTML = `<div class="row"><button class="btn" type="button" id="cback">‹ До персонажів</button><button class="btn" type="button" id="cundo" ${L.hist.length ? "" : "disabled"}>↶ Скасувати</button></div>`;
    const cv = $(B, "#ccv"), cw = $(B, ".cvw"), stg = $(B, ".stage"), sk = $(B, "#cseek"), tl = $(B, "#ctime"), pb = $(B, "#cpb"), EP = $(B, "#cetp");
    (async () => { const el = $(B, "#cleft"); if (!el) return; if (isOwner()) { el.textContent = `Це відео — ${Math.ceil(L.dur)} с · власник: без ліміту`; return; } if (!window.SRV?.cineLeft || !SRV.session) { el.textContent = `Це відео — ${Math.ceil(L.dur)} с`; return; }
      try { const i = await SRV.cineLeft(); if (el.isConnected) el.textContent = `Це відео — ${Math.ceil(L.dur)} с · залишилось ${i.left ?? 0} с (знімаються лише при збереженні)`; } catch (e) { el.textContent = `Це відео — ${Math.ceil(L.dur)} с`; } })();
    const fit = () => { const h = stg.clientHeight - 8, w = Math.min(h * 9 / 16, stg.clientWidth - 12); cw.style.width = w + "px"; cw.style.height = w * 16 / 9 + "px"; }; fit(); new ResizeObserver(fit).observe(stg);
    const x = cv.getContext("2d"), after = (c) => overlay(c, OV, cv.width, cv.height);
    let mark = () => {};
    const show = (t) => { drawFrame(x, L, t, cv.width, cv.height); after(x); tl.textContent = `${fmt(t)} / ${fmt(L.dur)}`; mark(t); };
    const big = document.createElement("canvas"); big.width = 270; big.height = 480;
    const thumb = (i, c) => { const sc = L.scenes[i]; drawFrame(big.getContext("2d"), L, Math.min(sc.t1 - .05, sc.t0 + Math.min(1.2, (sc.t1 - sc.t0) * .6)), 270, 480); c.getContext("2d").drawImage(big, 0, 0, c.width, c.height); };
    const play = (from, until) => { stopPrev(); pb.firstChild.style.opacity = 0; playFrom(from, cv, { after, until, tick: (t) => { sk.value = t; tl.textContent = `${fmt(t)} / ${fmt(L.dur)}`; mark(t); }, onend: () => { pb.firstChild.style.opacity = 1; } }); };
    pb.onclick = async () => { if (PL) { stopPlay(); return; } await freshAudio(); play(+sk.value >= L.dur - .1 ? 0 : +sk.value); };
    sk.oninput = () => { stopPlay(); show(+sk.value); };
    $(B, "#covl").onclick = (e) => { const ks = Object.keys(OVL); OV = ks[(ks.indexOf(OV) + 1) % ks.length]; try { localStorage.setItem("yvCineOvl", OV); } catch (q) {} e.currentTarget.textContent = "📱 " + OVL[OV]; if (!PL) show(+sk.value); };
    const refresh = (i, playIt) => { const c = EP.querySelector(`[data-th="${i}"]`); if (c) thumb(i, c); const sc = L.scenes[i]; sk.value = sc.t0 + .05; if (playIt) play(sc.t0, sc.t1); else { stopPlay(); show(Math.min(sc.t1 - .05, sc.t0 + .9)); } $(F, "#cundo").disabled = !L.hist.length; };
    const words = (sc, i) => L.words.slice(sc.a, L.scenes[i + 1]?.a ?? L.words.length).map((w) => w.w).join(" ");
    const tab = () => { mark = () => {};
      if (ETAB === "scenes") { EP.innerHTML = `<div class="ask" style="margin-top:4px"><input class="tx" id="cask" placeholder="Правка всього відео. Напр.: більше нічних сцен"><button class="btn sq" type="button" id="caskgo" aria-label="Змінити">✎</button></div>
          <div class="row" style="margin-top:8px"><button class="btn" type="button" id="cre">↻ Інший варіант режисури</button></div><p class="cnt" style="margin:6px 0 10px">Переробки: ${isOwner() ? "без ліміту (власник)" : `${Math.max(0, regenLeft())} з ${REGEN_MAX}`} · ручні правки сцен — без ліміту</p>
          <div class="arows">${L.scenes.map((sc, i) => sc.ad ? "" : `<div class="arow2" data-row="${i}"><canvas width="72" height="128" data-th="${i}"></canvas><div style="min-width:0;flex:1"><div class="n">Сцена ${i + 1} · ${fmt(sc.t0)}</div><div class="ph">${escH(words(sc, i))}</div>
            <div class="chips" style="margin-top:6px"><button class="chip" type="button" data-ed="${i}">✎ Правити</button><button class="chip" type="button" data-pl2="${i}">▶</button></div></div></div>`).join("")}</div>`;
        EP.querySelectorAll("[data-th]").forEach((c) => thumb(+c.dataset.th, c));
        mark = (t) => { const i = sceneAt(L, t); EP.querySelectorAll("[data-row]").forEach((r) => r.classList.toggle("on", +r.dataset.row === i)); };
        EP.querySelectorAll("[data-ed]").forEach((b) => b.onclick = () => { const i = +b.dataset.ed; refresh(i); sceneSheet(i, refresh); });
        EP.querySelectorAll("[data-pl2]").forEach((b) => b.onclick = async () => { const i = +b.dataset.pl2; await freshAudio(); refresh(i, true); });
        const ask = $(EP, "#cask"); $(EP, "#caskgo").onclick = () => { const t = ask.value.trim(); if (!t) { ask.focus(); return; } remix(() => aiEdit(L, t), "", true); track("edit"); }; ask.onkeydown = (e) => { if (e.key === "Enter") $(EP, "#caskgo").click(); };
        $(EP, "#cre").onclick = () => remix(async () => { await aiPlan(L, "Зроби ІНШИЙ варіант режисури: інші локації, плани й HUD, ніж зазвичай."); return "Новий варіант"; }, "", true); }
      if (ETAB === "look") { EP.innerHTML = `<div class="sec"><h4>Формат</h4><div class="chips">${Object.entries(FMTS).map(([k, v]) => `<button class="chip" type="button" data-f2="${k}" aria-pressed="${(L.fmt || "kino") === k}">${v.n}</button>`).join("")}</div></div>
          <div class="sec"><h4>Інтерфейс соцмережі в прев'ю</h4><div class="chips">${Object.entries(OVL).map(([k, n]) => `<button class="chip" type="button" data-ov="${k}" aria-pressed="${OV === k}">${n}</button>`).join("")}</div><p class="cnt" style="margin:6px 0 0">Лише для перевірки безпечних зон — у збережене відео не потрапляє.</p></div>`;
        EP.querySelectorAll("[data-f2]").forEach((b) => b.onclick = () => { L.fmt = b.dataset.f2; OPT.fmt = L.fmt; saveOpt(); EP.querySelectorAll("[data-f2]").forEach((o) => o.setAttribute("aria-pressed", o === b)); loadHand().then(() => show(+sk.value)); });
        EP.querySelectorAll("[data-ov]").forEach((b) => b.onclick = () => { OV = b.dataset.ov; try { localStorage.setItem("yvCineOvl", OV); } catch (q) {} $(B, "#covl").textContent = "📱 " + OVL[OV]; EP.querySelectorAll("[data-ov]").forEach((o) => o.setAttribute("aria-pressed", o === b)); show(+sk.value); }); }
      if (ETAB === "subs") { const S = L.subS = { ...SUBS0, ...(L.subS || {}) };
        EP.innerHTML = `<div class="tg"><div><b>Показувати субтитри</b></div><button class="sw" type="button" id="cps" role="switch" aria-checked="${!!L.subs}"></button></div>
          <div class="sec"><h4>Стиль</h4><div class="chips">${Object.entries(SUBST).map(([k, n]) => `<button class="chip" type="button" data-ps="${k}" aria-pressed="${S.k === k}">${n}</button>`).join("")}</div></div>
          <div class="sec"><h4>Розмір <span id="cpsz">${Math.round(S.size * 100)}%</span></h4><input type="range" id="cpsize" min="0.6" max="1.8" step="0.05" value="${S.size}" style="width:100%;accent-color:#f5f5f7"></div>
          <div class="sec"><h4>Висота: <span id="cpyv"></span></h4><input type="range" id="cpy" min="300" max="1800" step="10" value="${S.y}" style="width:100%;accent-color:#f5f5f7;direction:rtl"><p class="cnt" style="margin:4px 0 0">Ліворуч — нижче, праворуч — вище. Рамка в прев'ю (📱) показує безпечну зону.</p></div>`;
        const tAt = () => { const t = +sk.value, w = L.words.find((q) => q.s >= t) || L.words[0]; return Math.max(t, w.s + .02); };
        const yv = () => { EP.querySelector("#cpyv").textContent = S.y > 1460 ? "низько — може закрити підпис соцмережі" : S.y < 450 ? "дуже високо" : S.y < 750 ? "вгорі" : S.y < 1100 ? "по центру" : "внизу (безпечно)"; }; yv();
        const live = () => { if (!L.subs) { L.subs = true; EP.querySelector("#cps").setAttribute("aria-checked", true); } show(tAt()); OPT.subS = { ...S }; OPT.subs = true; saveOpt(); };
        EP.querySelector("#cps").onclick = (e) => { L.subs = !L.subs; OPT.subs = L.subs; saveOpt(); e.currentTarget.setAttribute("aria-checked", L.subs); show(tAt()); };
        EP.querySelectorAll("[data-ps]").forEach((b) => b.onclick = () => { S.k = b.dataset.ps; EP.querySelectorAll("[data-ps]").forEach((o) => o.setAttribute("aria-pressed", o === b)); live(); });
        EP.querySelector("#cpsize").oninput = (e) => { S.size = +e.target.value; EP.querySelector("#cpsz").textContent = Math.round(S.size * 100) + "%"; live(); };
        EP.querySelector("#cpy").oninput = (e) => { S.y = +e.target.value; yv(); live(); }; }
      if (ETAB === "voice") { const txt = L.words.map((w) => w.w).join(" ");
        EP.innerHTML = `<p class="cnt" style="margin:0 0 8px">${L.silent ? "Без голосу — лише музика й субтитри." : `Голос · ${fmt(L.dur)}${L.src?.fit?.rate > 1.01 ? ` · підігнано ×${L.src.fit.rate.toFixed(2)}` : ""}`}</p>
          <div class="vtext">${escH(txt)}</div><div class="row" style="margin-top:8px"><button class="btn" type="button" id="cvcp">Скопіювати текст</button><button class="btn" type="button" id="cvre">✎ Змінити текст і переозвучити</button></div>`;
        $(EP, "#cvcp").onclick = async (e) => { e.currentTarget.textContent = (await copyText(txt)) ? "✓ Скопійовано" : "Виділи вручну"; };
        $(EP, "#cvre").onclick = () => { stopPlay(); screenContent(); }; }
      if (ETAB === "music") { EP.innerHTML = `<p class="cnt" style="margin:0 0 8px">Натисни ▶, щоб послухати, і вибери рядок. 💡 Трендовий звук краще додати вже в Instagram чи TikTok під час публікації.</p><div id="cml"></div>`;
        musicList($(EP, "#cml"), L.music === false ? "off" : L.mood, (k) => { stopPrev(); if (k === "off") L.music = false; else { L.music = true; L.mood = k; } remix(async () => `Музика: ${L.music === false ? "вимкнено" : MOODS[L.mood].n}`); }); }
      if (ETAB === "sfx") { EP.innerHTML = `<div class="tg"><div><b>Звуки на діях</b><span>Вжух на переходах, дзень на числах, удари на поворотах</span></div><button class="sw" type="button" id="csfx" role="switch" aria-checked="${L.sfx !== false}"></button></div>`;
        $(EP, "#csfx").onclick = async (e) => { L.sfx = L.sfx === false; e.currentTarget.setAttribute("aria-checked", L.sfx !== false); AUD_DIRTY = true; await freshAudio(); }; } };
    B.querySelectorAll("[data-et]").forEach((b) => b.onclick = () => { ETAB = b.dataset.et; B.querySelectorAll("[data-et]").forEach((o) => o.setAttribute("aria-pressed", o === b)); stopPrev(); tab(); });
    tab(); show(Math.min(1.5, L.dur / 2));
    // шаблони над прев'ю
    $(B, "#ctsave").onclick = () => { const P = panel("Зберегти шаблон", `<p class="cnt" style="margin:0 0 8px">Збереже формат, героя, субтитри й музику цього відео.</p><div class="ask"><input class="tx" id="ctn" maxlength="24" placeholder="Назва шаблону"><button class="btn sq" type="button" id="ctok">✓</button></div>`);
      P.querySelector("[data-pclose]").onclick = () => P.remove();
      P.querySelector("#ctok").onclick = () => { Object.assign(OPT, { fmt: L.fmt, subs: L.subs, subS: { ...SUBS0, ...(L.subS || {}) }, music: L.music !== false, mood: L.mood }); saveOpt(); const n = P.querySelector("#ctn").value.trim() || FMTS[L.fmt || "kino"].n, L0 = TPLS(); L0.push({ n, o: tplPick(), def: !L0.length }); TPLSAVE(L0); TPLSEL = L0.length - 1; P.remove(); say(`Шаблон «${n}» збережено`); }; };
    $(B, "#ctmine").onclick = () => { const L0 = TPLS(); const P = panel("Мої шаблони", L0.length ? `<div class="vopt">${L0.map((q, i) => `<button type="button" data-tp2="${i}"><b>${q.def ? "★ " : ""}${escH(q.n)}</b><span>${escH(FMTS[q.o.fmt || "kino"]?.n || "")}</span></button>`).join("")}</div>` : `<p class="cnt">Ще немає шаблонів. Натисни «Зберегти шаблон».</p>`);
      P.querySelector("[data-pclose]").onclick = () => P.remove();
      P.querySelectorAll("[data-tp2]").forEach((b) => b.onclick = () => { const q = TPLS()[+b.dataset.tp2]; tplApply(q); L.fmt = OPT.fmt; L.hero = { ...L.hero, col: OPT.col, acc: OPT.acc, skin: OPT.skin, hair: OPT.hair, hairC: OPT.hairC, beard: OPT.beard }; L.subs = OPT.subs; L.subS = { ...SUBS0, ...(OPT.subS || {}) }; if (OPT.music === false) L.music = false; else { L.music = true; if (MOODS[OPT.mood]) L.mood = OPT.mood; } P.remove(); remix(async () => `Шаблон «${q.n}» застосовано`); }); };
    $(F, "#cundo").onclick = async () => { const h = L.hist.pop(); if (!h) return; const o = JSON.parse(h); L.scenes = o.scenes; L.mood = o.mood; if (o.music !== undefined) L.music = o.music; await remix(async () => "Скасовано"); L.hist.pop(); };
    $(F, "#cback").onclick = () => { stopPlay(); screenSetup(); };
    $(B, "#csave").onclick = async (e) => { const b = e.currentTarget, lbl = b.textContent; b.disabled = true; stopPlay();
      const ok = await canSave(); if (ok !== true) { b.disabled = false; if (ok === "buy") buyPanel(() => $(B, "#csave")?.click(), L._need); return; } await freshAudio();
      try { const t0 = performance.now(); const r = await E().busyRun("save", () => exportVideo((p) => { const el = (performance.now() - t0) / 1000, left = p > .04 ? el * (1 - p) / p : null;
          window.yvBusy?.progress?.(p, p < .97 ? "Збираю кадри й звук" : "Майже готово…"); void el; void left; }));
        const name = `yuvi-kino-${Date.now()}.${r.ext}`, f = new File([r.blob], name, { type: r.blob.type });
        track("export", { v: `${Math.round(L.dur)}s` }); setTimeout(() => donePanel(f), 500);
        cloudSave(f).then((r) => { if (r === "ok") say("✓ Відео також збережено в «Мої відео»"); else if (r === "too_big") say("Файл завеликий для «Моїх відео» — збережи його на телефон"); else if (r) say("Не вдалося додати в «Мої відео» — збережи файл на телефон"); }); } catch (q) { console.error(q); say(q?.message === "noenc" ? "Цей браузер не вміє зберігати відео — спробуй Chrome або Safari 17+" : "Не вдалося зберегти"); }
      b.disabled = false; b.textContent = lbl; }; }
  // короткий опис можливостей рушія — для розбору відео «для коду» (що вже є, щоб AI писав лише про прогалини)
  function caps() { const k = (o) => Object.keys(o).join(", ");
    return [
      "Рушій: canvas 2D, 1080x1920, 30 fps, сцени прив'язані до слів озвучки (a = індекс слова).",
      "Формати: " + Object.entries(FMTS).map(([x, v]) => x + " (" + v.n + ")").join(", ") + ".",
      "Локації: " + k(PLACES) + "; час доби: " + k(TIME) + "; плани: " + k(SHOT) + ".",
      "Камера: push, pull, pan_l, pan_r, still, shake, punch; переходи: cut, whip, fade.",
      "Персонаж: пози " + k(POSE) + "; емоції " + FACE.join(", ") + "; шкіра/зачіски/борода; тваринка; натовп (crowd) з таймерами/тегами.",
      "Пропси: " + k(PROPS) + ".",
      "Інфографіка (hud): panel, chart, bars, counter, brain, check, compare, rings, network, timeline, timer, rules, split, day (лічильник днів із перебігом і «зривом»), calendar (перекреслені дні), jar (банка з монетами й сумою).",
      "Тінь-демон (who: shadow): чорний силует зі світінням (red/pink/purple) і очима, розмір scale, зміна grow за сцену, розпад на іскри die; репліки персонажів say (шепіт тіні / бабл).",
      "Ефекти сцени fx: black (чорний екран), rain (дощ), crack (тріщини скла), flash (білий спалах), spot (промінь світла, темрява навколо), confetti. HUD clock (час пролітає 3:17→4:40), chat (листування в телефоні), stamp (штамп), people (сітка людей 1 з N), pie (кругова), gauge (спідометр).",
      "Мітки над головою: колір стану, перебіг числа tag0→tag, дельта +N/−N, серце, другий рядок; думки в хмарці (think); плашка часу/місця (loc); камера punch (різкий крупний план).",
      "Текст: підписи-тези (cap; tw — друк по літері з курсором), теги над персонажем (tag), таймери (timer), субтитри стилів " + k(SUBST) + ".",
      "Звук: фонова музика за настроєм, sfx на переходах; озвучка TTS з підгонкою під довжину.",
      "Реклама: реальний телефон у руці з кадрами інтерфейсу, виліт телефона до глядача.",
      "НЕМАЄ: імпорту відео/фото у кадр, 3D, ліпсінку, кількох персонажів, що взаємодіють руками, складної анімації тіла (біг, стрибки), частинок окрім простих."
    ].join("\n"); }
  window.YVCine = { adStudio: () => adStudio(), open(o = {}) { if (o.text) { DRAFT.text = String(o.text); DRAFT.topic = String(o.topic || ""); saveDraft(); return screenContent(); } if (window.SRV?.session && SRV.cineList) screenProjects(); else screenTopic(); }, close, _t: { caps, loadHand, DEMOPLAN, placeAd, removeAd, ensureAd, adPoint, loadAd, soundtrack, normPlan, aiPlan, set: (l) => { L = l; }, L: () => L, screenEdit, exportVideo, loadFont, drawFrame, timeline, PLACES, POSE, HOOD, figure, loadIcons, sceneAt } };
})();
