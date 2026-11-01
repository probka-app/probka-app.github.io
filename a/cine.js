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
    hero: { s: 1 }, man: { s: 1 }, woman: { s: .96, hair: 1 }, kid: { s: .66, hs: 1.18 }, doctor: { s: 1, coat: 1, glasses: 1 },
    boss: { s: 1.03, suit: 1 }, old: { s: .95, grey: 1, lean: 6 }, girl: { s: .7, hs: 1.16, hair: 1 },
  };
  const ACC = ["none", "beanie", "glasses", "cap", "headphones"];

  // позиція кінця відрізка
  const seg = (x, y, ang, len, f) => [x + Math.sin(ang * D) * len * f, y + Math.cos(ang * D) * len];
  function limb(x, pts, w, col) { x.strokeStyle = col; x.lineWidth = w; x.lineCap = "round"; x.lineJoin = "round"; x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.stroke(); }

  // c: {who, col, acc, face, look, f(+1/-1), h(px), rim}
  function figure(x, X, Y, P, c, t) {
    const sp = WHO[c.who] || WHO.man, h = (c.h || 560) * sp.s, f = c.f || 1, hs = sp.hs || 1;
    const col = c.who === "doctor" ? "#eceff2" : c.who === "boss" ? "#3d4256" : sp.grey ? "#a7a2a0" : (HOOD[c.col] || c.col || HOOD.yellow);
    const dk = shade(col, -.22), uL = .25 * h, lL = .23 * h, uA = .17 * h, fA = .16 * h, lw = .062 * h, aw = .058 * h;
    const sit = P.sit || 0, lie = P.lie || 0, lean = (P.lean || 0) + (sp.lean || 0), breath = Math.sin(t * 2.1 + (c.seed || 0)) * .006 * h;
    x.save(); x.translate(X, Y);
    if (lie) { x.rotate(-90 * D * f); x.translate(0, .47 * h); }
    // тінь
    if (!lie) { x.save(); x.globalAlpha = .22; x.fillStyle = "#000"; x.beginPath(); x.ellipse(sit ? .06 * h * f : 0, 0, .2 * h, .028 * h, 0, 0, 7); x.fill(); x.restore(); }
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
    limb(x, arms[0], aw, dk); x.fillStyle = INK; x.beginPath(); x.arc(arms[0][2][0], arms[0][2][1], .036 * h, 0, 7); x.fill();
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
    x.fillStyle = INK; x.fillRect(-.016 * h, sh[1] - .06 * h, .032 * h, .07 * h);
    x.fillStyle = INK; x.beginPath(); x.arc(hc[0], hc[1], r, 0, 7); x.fill();
    if (c.rim) { x.save(); x.beginPath(); x.arc(hc[0], hc[1], r, 0, 7); x.clip(); x.strokeStyle = c.rim; x.globalAlpha = .55; x.lineWidth = r * .14; x.beginPath(); x.arc(hc[0] - r * .1 * f, hc[1] + r * .06, r * 1.02, -Math.PI * .95, -Math.PI * .35); x.stroke(); x.restore(); }
    if (sp.hair) { x.fillStyle = "#3a2c2a"; x.beginPath(); x.ellipse(hc[0] - r * .85 * f, hc[1] + r * .05, r * .32, r * .55, -.3 * f, 0, 7); x.fill(); x.beginPath(); x.arc(hc[0] - r * .15 * f, hc[1] - r * .55, r * .62, Math.PI * 1.05, Math.PI * 1.95); x.fill(); }
    if (sp.grey) { x.fillStyle = "#d8d6d2"; x.beginPath(); x.arc(hc[0] - r * .2 * f, hc[1] - r * .62, r * .5, Math.PI, 0); x.fill(); }
    face(x, hc, r, f, c, t);
    acc(x, hc, r, f, sp.glasses ? "glasses" : c.acc, c.accC);
    x.restore();
    // передня рука
    limb(x, arms[1], aw, col); x.fillStyle = INK; x.beginPath(); x.arc(arms[1][2][0], arms[1][2][1], .037 * h, 0, 7); x.fill();
    x.restore(); x.restore();
    // кисть передньої руки у світових координатах — щоб тримати предмет
    const wr = arms[1][2]; let hx = wr[0], hy = wr[1];
    if (lean) { const a = lean * D * f, dx = hx, dy = hy - hipY; hx = dx * Math.cos(a) - dy * Math.sin(a); hy = dx * Math.sin(a) + dy * Math.cos(a) + hipY; }
    return { hand: [X + hx, Y + hy], head: [X + hc[0], Y + hc[1]], r, h };
  }
  function face(x, hc, r, f, c, t) {
    const em = c.face || "calm", look = c.look ?? 0, bl = (t + (c.seed || 0) * 1.7) % 3.6 < .12 || em === "sleep";
    const ex = hc[0] + r * .22 * f, ey = hc[1] - r * .02, sep = r * .34, ew = r * .15, eh = r * (em === "shock" ? .3 : .25);
    x.fillStyle = "#f4f1ea";
    [-1, 1].forEach((s) => { const cx = ex + s * sep / 2; x.beginPath(); if (bl) { x.ellipse(cx, ey + eh * .3, ew, r * .03, 0, 0, 7); } else x.ellipse(cx, ey, ew, eh, 0, 0, 7); x.fill(); });
    if (!bl) { x.fillStyle = INK; [-1, 1].forEach((s) => { const cx = ex + s * sep / 2 + (look * .5 + .35 * f) * ew * .6; x.beginPath(); x.ellipse(cx, ey + eh * .12, ew * .45, eh * .42, 0, 0, 7); x.fill(); }); }
    x.strokeStyle = "#f4f1ea"; x.lineWidth = r * .07; x.lineCap = "round";
    const brow = { angry: [.35, -.35], worried: [-.3, .3], sad: [-.28, .28], shock: [0, 0], smirk: [.1, -.25] }[em];
    if (brow) [-1, 1].forEach((s, i) => { const cx = ex + s * sep / 2, by = ey - eh - r * (em === "shock" ? .22 : .12); x.beginPath(); x.moveTo(cx - ew * 1.1, by + brow[i] * r * .25 * (s < 0 ? 1 : -1) * -1); x.lineTo(cx + ew * 1.1, by - brow[i] * r * .25 * (s < 0 ? 1 : -1) * -1); x.stroke(); });
    const my = hc[1] + r * .45, mx = ex;
    x.beginPath();
    if (em === "happy") x.arc(mx, my - r * .12, r * .2, .2 * Math.PI, .8 * Math.PI);
    else if (em === "sad" || em === "worried") x.arc(mx, my + r * .12, r * .15, 1.2 * Math.PI, 1.8 * Math.PI);
    else if (em === "shock") { x.fillStyle = "#f4f1ea"; x.ellipse(mx, my, r * .08, r * .11, 0, 0, 7); x.fill(); x.beginPath(); }
    else if (em === "smirk") { x.moveTo(mx - r * .12, my); x.quadraticCurveTo(mx + r * .05, my + r * .04, mx + r * .16, my - r * .08); }
    else if (em === "angry") { x.moveTo(mx - r * .12, my + r * .02); x.lineTo(mx + r * .12, my - r * .02); }
    else if (c.talk) { const o = Math.abs(Math.sin(t * 13)) * r * .1; x.fillStyle = "#f4f1ea"; x.ellipse(mx, my, r * .1, o + r * .02, 0, 0, 7); x.fill(); x.beginPath(); }
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
    void: { n: "Порожній фон", light: null, draw(x, tm, s) { const T = TIME[tm] || TIME.day, g = x.createRadialGradient(W / 2, H * .45, 100, W / 2, H * .45, H * .8); g.addColorStop(0, shade("#a99fb2", T.amb + .1)); g.addColorStop(1, shade("#5d566a", T.amb)); x.fillStyle = g; x.fillRect(0, 0, W, H); x.fillStyle = "rgba(0,0,0,.12)"; x.fillRect(0, FLOOR, W, H - FLOOR); } },
  };
  const BGC = new Map();
  function bgOf(place, tm, seed, blur) { const key = place + tm + seed + (blur ? "b" : ""); if (BGC.has(key)) return BGC.get(key);
    const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    if (blur) { x.filter = "blur(10px)"; x.drawImage(bgOf(place, tm, seed, false), -20, -20, W + 40, H + 40); x.filter = "none"; }
    else (PLACES[place] || PLACES.room).draw(x, tm, seed);
    if (BGC.size > 40) BGC.delete(BGC.keys().next().value); BGC.set(key, c); return c; }

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
    x.restore();
  }
  // «ЯКЩО ТВІЙ *IQ* …» — виділене слово в зірочках
  function capText(x, cap, lt, cy, style) {
    const parts = String(cap.t || "").toUpperCase().split(/(\*[^*]+\*)/).filter(Boolean).flatMap((s) => { const hl = s.startsWith("*"); return s.replace(/\*/g, "").trim().split(/\s+/).filter(Boolean).map((w) => ({ w, hl })); });
    if (!parts.length) return; const big = style === "title", size0 = big ? 118 : 96;
    x.save(); x.font = `900 ${size0}px "${FONT}", system-ui, sans-serif`; const sp = size0 * .28, maxW = SAFEW - 40, lines = [[]]; let lw = 0;
    parts.forEach((p) => { const w = x.measureText(p.w).width; if (lw + w > maxW && lines[lines.length - 1].length) { lines.push([]); lw = 0; } lines[lines.length - 1].push({ ...p, wd: w }); lw += w + sp; });
    const scale = Math.min(1, ...lines.map((l) => maxW / (l.reduce((a, p) => a + p.wd + sp, -sp))));
    const size = size0 * scale, lh = size * 1.08, outA = cap.out ? clamp((cap.out - lt) / .25) : 1; let idx = 0;
    lines.forEach((l, li) => { const tw = l.reduce((a, p) => a + p.wd * scale + sp * scale, -sp * scale); let X = SCX - tw / 2; const Y = cy + (li - (lines.length - 1) / 2) * lh;
      l.forEach((p) => { const a = clamp((lt - idx * .07) / .16) * outA, s = 1 + (1 - eout((lt - idx * .07) / .22)) * .35; idx++; if (a <= 0) { X += (p.wd + sp) * scale; return; }
        x.save(); x.globalAlpha = a; x.translate(X + p.wd * scale / 2, Y); x.scale(s, s); x.font = `900 ${size}px "${FONT}", system-ui, sans-serif`; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round";
        x.shadowColor = "rgba(0,0,0,.45)"; x.shadowBlur = 18; x.shadowOffsetY = 6; x.strokeStyle = "rgba(20,18,30,.85)"; x.lineWidth = size * .14; x.strokeText(p.w, 0, 0); x.shadowBlur = 0; x.shadowOffsetY = 0;
        x.fillStyle = p.hl ? (cap.c || "#dbe86b") : "#ffffff"; x.fillText(p.w, 0, 0); x.restore(); X += (p.wd + sp) * scale; }); });
    x.restore();
  }
  function subs(x, t, L) {
    const ws = L.words; let i = ws.findIndex((w) => w.e > t - .05); if (i < 0) return; if (ws[i].s > t + .05 && (i === 0 || t - ws[i - 1].e > .5)) return;
    const g0 = Math.floor(i / 4) * 4, grp = ws.slice(g0, g0 + 4); if (!grp.length) return;
    x.save(); const size = 54; x.font = `800 ${size}px "${FONT}", system-ui, sans-serif`; const sp = 14, tw = grp.reduce((a, w) => a + x.measureText(w.w).width + sp, -sp); const sc = Math.min(1, (SAFEW - 40) / tw), Y = 1370;
    x.translate(SCX, Y); x.scale(sc, sc); x.translate(-SCX, -Y); let X = SCX - tw / 2; x.textAlign = "left"; x.textBaseline = "middle"; x.lineJoin = "round";
    grp.forEach((w, k) => { const on = g0 + k === i && t >= w.s - .05; x.strokeStyle = "rgba(15,14,22,.9)"; x.lineWidth = 12; x.strokeText(w.w, X, Y); x.fillStyle = on ? "#dbe86b" : "#fff"; x.fillText(w.w, X, Y); X += x.measureText(w.w).width + sp; }); x.restore(); }

  /* ---------- кадр ---------- */
  let GRAIN = null;
  function grain() { if (GRAIN) return GRAIN; const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"), d = x.createImageData(256, 256); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 22; } x.putImageData(d, 0, 0); return GRAIN = c; }
  const SHOT = { wide: 1, medium: 1.38, close: 1.9, face: 2.7 };
  function camOf(sc, lt, d, hero) {
    const z0 = SHOT[sc.shot] || 1, p = clamp(lt / Math.max(.5, d)), m = sc.cam || "push";
    let z = z0 * (m === "push" ? 1 + .09 * ease(p) : m === "pull" ? 1.12 - .1 * ease(p) : 1 + .02 * p), fx = W / 2, fy = H / 2;
    if (hero && z0 > 1) { fx = hero.head[0]; fy = sc.shot === "medium" ? hero.head[1] + hero.h * .32 : hero.head[1] + hero.r * (sc.shot === "face" ? .2 : 1.2); }
    if (m === "pan_l") fx += lerp(120, -120, ease(p)); if (m === "pan_r") fx += lerp(-120, 120, ease(p));
    (sc.hitT || []).forEach((ht) => { const q = lt - ht; if (q > 0 && q < .5) z *= 1 + .05 * (1 - q / .5) * (q < .06 ? q / .06 : 1); });
    let sx = 0, sy = 0; if (m === "shake") { sx = (rnd(Math.floor(lt * 24), 1) - .5) * 14; sy = (rnd(Math.floor(lt * 24), 2) - .5) * 14; }
    sx += Math.sin(lt * .8 + sc.a) * 5; sy += Math.cos(lt * .6 + sc.a) * 4;
    const vw = W / z, vh = H / z; fx = clamp(fx, vw / 2, W - vw / 2); fy = clamp(fy, vh / 2, H - vh / 2);
    return { z, fx: fx + sx / z, fy: fy + sy / z };
  }
  function castState(sc, c, lt, d, i) {
    let X = (c.x ?? .5) * W, pose = POSE[c.pose] || POSE.stand, P;
    if (c.to != null) { const tw = Math.min(d * .65, Math.abs(c.to - (c.x ?? .5)) * 4.5 + .6), p = clamp(lt / tw); X = lerp((c.x ?? .5), c.to, ease(p)) * W;
      if (p < 1) P = walkPose(lt * (c.pose === "run" ? 13 : 8), c.pose === "run"); else P = blendPose(walkPose(0), pose.walk ? POSE.stand : pose, clamp((lt - tw) / .3)); }
    else if (pose.walk) P = walkPose(lt * (pose.walk === 2 ? 13 : 8), pose.walk === 2);
    else { const enter = POSE[c.from] || POSE.stand; P = blendPose(enter, pose, clamp(lt / .45)); }
    if (c.pose === "wave") P = { ...P, a: [P.a[0], [150, 30 + Math.sin(lt * 9) * 25]] };
    if (c.pose === "talk") P = { ...P, a: [P.a[0], [38 + Math.sin(lt * 3.1 + i) * 12, 62 + Math.sin(lt * 4.3 + i) * 15]] };
    const f = c.look === "l" ? -1 : c.look === "r" ? 1 : (c.to != null ? Math.sign(c.to - (c.x ?? .5)) || 1 : (c.x ?? .5) > .55 ? -1 : 1);
    const Y = c.y != null ? c.y * H : (POSE[c.pose]?.lie ? 1215 : POSE[c.pose]?.sit ? FLOOR - 20 : FLOOR + 40);
    return { X, Y, P, f };
  }
  function drawScene(x, L, si, t) {
    const sc = L.scenes[si], lt = t - sc.t0, d = sc.t1 - sc.t0, tm = sc.time || "day", place = PLACES[sc.place] ? sc.place : "room";
    const hero = sc.cast?.find((c) => c.who === "hero") || sc.cast?.[0];
    // перший прохід — знайти голову героя для камери
    let H0 = null; if (hero) { const s = castState(sc, hero, lt, d, 0); H0 = { head: [s.X, s.Y - (WHO[hero.who]?.s || 1) * 720 * .94], r: 85, h: 720 * (WHO[hero.who]?.s || 1) }; }
    const cam = camOf(sc, lt, d, H0);
    x.save(); x.translate(W / 2, H / 2); x.scale(cam.z, cam.z); x.translate(-cam.fx, -cam.fy);
    x.drawImage(bgOf(place, tm, sc.seed || 1, cam.z > 1.6), 0, 0);
    const T = TIME[tm] || TIME.day, Lp = PLACES[place].light;
    // промені світла
    if (Lp && tm !== "night") { x.save(); x.globalCompositeOperation = "screen"; for (let i = 0; i < 4; i++) { const a = .1 + .05 * Math.sin(t * .7 + i * 2), X0 = Lp[0] - 160 + i * 120, g = x.createLinearGradient(X0, Lp[1], X0 + 700, Lp[1] + 1300); g.addColorStop(0, T.ray + a + ")"); g.addColorStop(1, T.ray + "0)"); x.fillStyle = g; x.beginPath(); x.moveTo(X0, Lp[1]); x.lineTo(X0 + 90, Lp[1]); x.lineTo(X0 + 760, Lp[1] + 1400); x.lineTo(X0 + 540, Lp[1] + 1400); x.fill(); } x.restore(); }
    // люди
    const heads = {}; (sc.cast || []).forEach((c, i) => { const s = castState(sc, c, lt, d, i); const h = 720 * (c.scale || 1); const talk = c.who === "hero" && !L.silent && (L.words.some((w) => w.s <= t && w.e >= t));
      heads[i] = figure(x, s.X, s.Y, s.P, { who: c.who || "man", col: c.who === "hero" ? L.hero.col : c.col || ["teal", "coral", "purple", "blue", "green"][i % 5], acc: c.who === "hero" ? L.hero.acc : c.acc, face: c.face || "calm", f: s.f, h, rim: tm === "night" ? "#8fa0ff" : T.tint, seed: i * 3 + si, talk: talk && c.face !== "shock" }, lt); });
    // предмети в руці — у світі; решта — поверх кадру, щоб не губились на крупних планах
    const hi = (sc.cast || []).findIndex((c) => c.who === "hero"), drawProp = (p, i, X, Y, k) => { const pl = lt - (p.at ?? 0); if (pl < 0) return; const s = (p.s || 1) * back(pl / .4);
      x.save(); x.translate(X, Y + (k ? 0 : Math.sin(t * 1.6 + i) * 8)); x.scale(k || 1, k || 1); if (PROPS[p.k]) PROPS[p.k](x, s, { ...p, lt: pl }, t); else drawIcon(x, p.q || p.k, s, p.c); x.restore(); };
    (sc.props || []).forEach((p, i) => { if (!p.hold) return; const hand = heads[hi >= 0 ? hi : 0]?.hand; if (hand) drawProp(p, i, hand[0], hand[1] - 26, .62); });
    // пил у світлі
    x.save(); for (let i = 0; i < 46; i++) { const X = (rnd(i, 31) * W + t * (8 + rnd(i, 32) * 14)) % W, Y = (rnd(i, 33) * H * .8 + Math.sin(t * .5 + i) * 40 + t * 6) % (H * .85); x.fillStyle = `rgba(255,250,235,${(.15 + rnd(i, 34) * .35) * (place === "space" ? .5 : 1)})`; x.beginPath(); x.arc(X, Y, 1.6 + rnd(i, 35) * 2.8, 0, 7); x.fill(); } x.restore();
    x.restore();
    const hh = heads[hi >= 0 ? hi : 0], tight = cam.z > 1.5 && hh, hsx = hh ? (hh.head[0] - cam.fx) * cam.z + W / 2 : W / 2;
    (sc.props || []).forEach((p, i) => { if (p.hold && hh) return; if (tight) drawProp(p, i, hsx > W / 2 ? W * .24 : W * .76, H * .64, .8); else drawProp(p, i, (p.x ?? .72) * W, (p.y ?? .4) * H, 0); });
    // HUD поверх (без зуму камери, з легким паралаксом)
    if (sc.hud && sc.hud.k && sc.hud.k !== "none") { const hl = lt - (sc.hud.at ?? 0); if (hl >= 0) { x.save(); x.translate((cam.fx - W / 2) * -.05, 0); hud(x, { ...sc.hud, out: d - (sc.hud.at ?? 0) }, hl, t); x.restore(); } }
    // кольорокорекція, віньєтка
    x.save(); x.globalCompositeOperation = "soft-light"; x.globalAlpha = .28; x.fillStyle = T.grade; x.fillRect(0, 0, W, H); x.restore();
    if (sc.cap?.t) { const cl = lt - (sc.cap.at ?? 0); if (cl >= 0) capText(x, { ...sc.cap, out: d - (sc.cap.at ?? 0) - .05 }, cl, sc.cap.y || (sc.cap.k === "title" ? H * .42 : 470), sc.cap.k); }
  }
  function post(x, t) { const g = x.createRadialGradient(W / 2, H * .48, H * .28, W / 2, H * .5, H * .78); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(8,6,20,.55)"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    const gr = grain(), ox = Math.floor(rnd(Math.floor(t * 24), 4) * 256), oy = Math.floor(rnd(Math.floor(t * 24), 5) * 256); x.save(); x.globalCompositeOperation = "overlay"; x.fillStyle = x.createPattern(gr, "repeat"); x.translate(-ox, -oy); x.fillRect(ox, oy, W, H); x.restore(); }
  const OFF = {};
  const off = (k) => { if (!OFF[k]) { OFF[k] = document.createElement("canvas"); OFF[k].width = W; OFF[k].height = H; } return OFF[k]; };
  function sceneAt(L, t) { let i = 0; while (i + 1 < L.scenes.length && L.scenes[i + 1].t0 <= t) i++; return i; }
  function drawFrame(x, L, t, OWd = W, OHd = H) {
    x.save(); if (OWd !== W) x.scale(OWd / W, OHd / H);
    if (!L?.scenes?.length) { x.fillStyle = "#1a1830"; x.fillRect(0, 0, W, H); x.restore(); return; }
    const si = sceneAt(L, t), sc = L.scenes[si], lt = t - sc.t0, TR = sc.tr === "whip" ? .32 : sc.tr === "fade" ? .45 : 0;
    if (si > 0 && TR && lt < TR) { const p = lt / TR;
      if (sc.tr === "fade") { if (p < .5) { drawScene(x, L, si - 1, t); x.fillStyle = `rgba(6,5,14,${p * 2})`; x.fillRect(0, 0, W, H); } else { drawScene(x, L, si, t); x.fillStyle = `rgba(6,5,14,${(1 - p) * 2})`; x.fillRect(0, 0, W, H); } }
      else { const a = off("a"), b = off("b"), ax = a.getContext("2d"), bx = b.getContext("2d"); drawScene(ax, L, si - 1, t); drawScene(bx, L, si, t); const e = ease(p), dir = sc.dir || 1;
        x.fillStyle = "#000"; x.fillRect(0, 0, W, H); x.filter = `blur(${Math.round(Math.sin(p * Math.PI) * 26)}px)`; x.drawImage(a, -e * W * dir, 0); x.drawImage(b, (1 - e) * W * dir, 0); x.filter = "none"; } }
    else drawScene(x, L, si, t);
    if (L.subs) subs(x, t, L);
    post(x, t);
    const fo = Math.min(clamp(t / .35), clamp((L.dur - t) / .5)); if (fo < 1) { x.fillStyle = `rgba(6,5,14,${1 - fo})`; x.fillRect(0, 0, W, H); }
    x.restore();
  }
  // таймінг сцен зі слів
  function timeline(L) { const ws = L.words, n = ws.length; L.scenes.sort((a, b) => a.a - b.a); if (L.scenes[0]) L.scenes[0].a = 0;
    L.scenes.forEach((s, i) => { s.t0 = i === 0 ? 0 : Math.max(0, ws[Math.min(n - 1, s.a)].s - .12); s.seed = s.seed || (i * 7 + 3); });
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
    const mus = ac.createGain(); mus.gain.value = 1; const sfx = ac.createGain(); sfx.gain.value = 1; mus.connect(ac.destination); sfx.connect(ac.destination);
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
План (shot): wide — загальний (герой на весь зріст), medium — по пояс, close — плечі й голова, face — лише обличчя (емоція). Камера (cam): push — повільний наїзд, pull — від'їзд, pan_l / pan_r — проїзд, still, shake — тряска (шок).
Перехід (tr) до сцени: cut — різка склейка, whip — швидкий змах (зміна думки), fade — через темряву (зміна часу, «пізніше», сон).
Персонажі (cast, до 3): who — hero (головний герой, завжди той самий) | man | woman | kid | girl | doctor | boss | old; x — 0…1 по ширині; to — куди йде (0…1, тоді він іде/біжить); pose — ${Object.keys(POSE).join(" | ")}; face — ${FACE.join(" | ")}; look — l | r; acc (для не-героя) — ${ACC.join(" | ")}.
Предмети (props, до 2): k — ${Object.keys(PROPS).join(" | ")} | або будь-яка іконка англійською в полі q (k:"icon", q:"rocket"); t — короткий текст/число на предметі; t2 — підпис (для card/calendar); hold:1 — герой тримає в руці (pose hold або phone); x,y — 0…1 (якщо не в руці); i — номер слова, коли з'являється.
HUD (hud) — пояснення поверх кадру: k — none | panel (вікно-«оновлення» з % і двома кнопками items) | chart (графік: v 1 росте, -1 падає) | bars | counter (велике число v, підпис t) | brain (світний мозок-мережа) | check (чекліст items) | compare (до/після, items:[2]) | rings | network; t — заголовок; i — номер слова; y — висота центру 0…1 (не накривай голову героя: герой стоїть унизу, HUD став у верхню половину y 0.25–0.4).
Напис (cap): t — ДО 5 слів ВЕЛИКИМИ, ключове слово в *зірочках* (воно жовте), i — номер слова; k:"title" — титр часу/місця на весь кадр («*3 ДНІ* ТОМУ»).
hit — номери 1–2 найважливіших слів сцени (легкий удар камери).`;
  const RULES = `Стиль — кінематографічний мультик із пласким героєм-чоловічком (темна кругла голова, світлі очі, худі), як популярні YouTube-канали «що, якби…», але ВЕРТИКАЛЬНО 9:16 для Reels:
— сцена = одна думка, 1,5–4 с; часті зміни плану (wide → medium → close/face) тримають увагу; перші 2 секунди — найсильніший кадр + cap з гачком;
— абстрактні ідеї показуй через локацію space + HUD (brain, panel, chart, counter), конкретні — через героя в побутовій локації з предметом у руці;
— емоцію героя показуй тілом і обличчям (pose + face), на поворотах — close/face і shake;
— cap не в кожній сцені: лише гачок, числа, повороти й висновок (≈ кожна друга-третя сцена);
— зміна часу/місця → tr:fade і cap k:"title"; зміна думки → whip; продовження дії → cut;
— один герой через усе відео; другорядні — для діалогу/контрасту;
— кожна сцена має щось, що рухається (наїзд, хода, жест, поява предмета/HUD точно на слові);
— зони соцмереж: верхні 12% висоти, праву смугу (останні 15% ширини) і низ (нижні 25% висоти) закривають кнопки й підпис Reels/TikTok/Shorts — предмети (x ≤ 0.76, y 0.15–0.7), HUD і написи став у центрі, не в цих зонах.`;
  const numbered = (L) => L.words.map((w, i) => `${i}:${w.w}`).join(" ");
  function normPlan(r, L) { const n = L.words.length, okI = (v) => Number.isInteger(v) && v >= 0 && v < n ? v : null, num = (v, a, b, d) => { v = +v; return isFinite(v) ? clamp(v, a, b) : d; }, str = (v, m) => typeof v === "string" ? v.slice(0, m) : "";
    const sc = (Array.isArray(r?.scenes) ? r.scenes : []).filter((s) => s && okI(s.a) != null).sort((a, b) => a.a - b.a).filter((s, i, A) => !i || s.a > A[i - 1].a).slice(0, 60).map((s) => ({
      a: s.a, place: PLACES[s.place] ? s.place : "room", time: TIME[s.time] ? s.time : "day", shot: SHOT[s.shot] ? s.shot : "wide", cam: ["push", "pull", "pan_l", "pan_r", "still", "shake"].includes(s.cam) ? s.cam : "push", tr: ["cut", "whip", "fade"].includes(s.tr) ? s.tr : "cut",
      cast: (Array.isArray(s.cast) ? s.cast : []).slice(0, 3).filter((c) => c && WHO[c.who]).map((c) => ({ who: c.who, x: num(c.x, .08, .92, .5), to: c.to != null ? num(c.to, .08, .92, null) : undefined, pose: POSE[c.pose] ? c.pose : "stand", face: FACE.includes(c.face) ? c.face : "calm", look: c.look === "l" || c.look === "r" ? c.look : undefined, acc: ACC.includes(c.acc) ? c.acc : undefined, col: HOOD[c.col] ? c.col : undefined })),
      props: (Array.isArray(s.props) ? s.props : []).slice(0, 2).filter((p) => p && (PROPS[p.k] || p.q || p.k === "icon")).map((p) => ({ k: PROPS[p.k] ? p.k : "icon", q: str(p.q, 30) || undefined, t: str(String(p.t ?? ""), 16) || undefined, t2: str(p.t2, 16) || undefined, hold: p.hold ? 1 : undefined, x: num(p.x, .12, .76, .7), y: num(p.y, .15, .7, .4), i: okI(p.i), v: p.v != null ? num(p.v, -1, 1, 1) : undefined })),
      hud: s.hud && s.hud.k && s.hud.k !== "none" ? { k: ["panel", "chart", "bars", "counter", "brain", "check", "compare", "rings", "network"].includes(s.hud.k) ? s.hud.k : "panel", t: str(s.hud.t, 30), v: s.hud.v, items: Array.isArray(s.hud.items) ? s.hud.items.slice(0, 5).map((q) => str(String(q), 34)) : undefined, i: okI(s.hud.i), y: num(s.hud.y, .2, .6, .33) * H } : null,
      cap: s.cap && s.cap.t ? { t: str(s.cap.t, 60), i: okI(s.cap.i), k: s.cap.k === "title" ? "title" : undefined } : null,
      hit: (Array.isArray(s.hit) ? s.hit : []).map(okI).filter((v) => v != null).slice(0, 3),
    }));
    sc.forEach((s) => { if (!s.cast.some((c) => c.who === "hero") && s.place !== "space" && s.cast.length < 3 && !s.hud) s.cast.unshift({ who: "hero", x: .5, pose: "talk", face: "calm" });
      if (s.cast.some((c) => c.who === "hero")) { const h = s.cast.find((c) => c.who === "hero"); s.props.forEach((p) => { if (p.hold && !["hold", "phone"].includes(h.pose)) h.pose = p.k === "phone" ? "phone" : "hold"; }); }
      else s.props.forEach((p) => p.hold = undefined);
      if (s.hud && s.cast.length) { s.cast.forEach((c) => { if (c.pose !== "lie") c.y = undefined; }); if (["panel", "chart", "bars", "check", "compare", "counter"].includes(s.hud.k)) s.hud.y = Math.min(s.hud.y, (s.hud.k === "counter" ? .24 : .27) * H); }
      s.props.forEach((p) => { if (!p.hold) { p.y = Math.min(p.y, s.cast.length ? .42 : .7); if (s.cap && p.y < .32) p.y = .36; } }); });
    if (!sc.length) throw new Error("plan"); if (sc[0].a !== 0) sc[0].a = 0; return sc; }
  // план сцен: частинами по ~70 слів (короткий JSON — не обрізається), з повтором; якщо AI не впорався — автоплан
  const PLAN_JSON = `{"mood":"curious","scenes":[{"a":0,"place":"space","time":"night","shot":"wide","cam":"push","tr":"cut","cast":[{"who":"hero","x":0.5,"pose":"shock","face":"shock"}],"props":[],"hud":{"k":"rings","i":0},"cap":{"t":"ЩО ЯКБИ *ТИ* …","i":1},"hit":[3]}]}`;
  async function planPart(L, a0, a1, extra, prev) {
    const words = L.words.slice(a0, a1).map((w, k) => `${a0 + k}:${w.w}`).join(" ");
    const ask = `Ти режисер вертикальних анімаційних Reels. Людина говорить за кадром. ${a0 > 0 ? `Це продовження ролика (слова ${a0}–${a1 - 1}); попередня сцена: ${prev || "—"}.` : `Це ${a1 < L.words.length ? "початок" : "весь"} ролик${a1 < L.words.length ? "у" : ""}.`} Дослівні слова з номерами:
${words}
${extra}
${RULES}
${SPEC}
${a0 === 0 ? `Визнач mood музики: ${Object.entries(MOODS).map(([k, v]) => `${k} (${v.n})`).join(", ")}.\n` : ""}Розбий ці слова на сцени по черзі (перша сцена — зі слова ${a0}; a — номер слова початку; нова сцена ≈ кожні 4–9 слів). Пиши JSON компактно, без зайвих полів (порожні props/hud/cap/hit не пиши).
Відповідай тільки JSON: ${PLAN_JSON}`;
    let err; for (let k = 0; k < 2; k++) { try { const r = await sample.json(ask, { cache: false, kb: ["style", "edit", "story", "hook", "camera", "sound", "general"], max: 4000 }); if (Array.isArray(r?.scenes) && r.scenes.length) return r; err = new Error("plan_empty"); } catch (e) { err = e; if (/limit|login|no_key/.test(e?.message || "")) throw e; } }
    throw err; }
  async function aiPlan(L, extra = "") {
    const n = L.words.length, STEP = 70, parts = []; for (let a = 0; a < n; a += STEP) parts.push([a, Math.min(n, a + STEP)]);
    if (parts.length > 1 && parts[parts.length - 1][1] - parts[parts.length - 1][0] < 20) { const last = parts.pop(); parts[parts.length - 1][1] = last[1]; }
    let scenes = [], mood = null, fails = 0;
    const res = await Promise.all(parts.map(([a0, a1], i) => planPart(L, a0, a1, extra, i ? "продовжуй той самий стиль і героя" : "").then((r) => r, (e) => { if (/limit|login|no_key/.test(e?.message || "")) throw e; fails++; L._planErr = String(e?.message || e?.code || e).slice(0, 60); return null; })));
    res.forEach((r, i) => { const [a0, a1] = parts[i]; if (!i && MOODS[r?.mood]) mood = r.mood;
      const ok = (r?.scenes || []).filter((s) => Number.isInteger(s?.a) && s.a >= a0 && s.a < a1);
      if (ok.length) { if (ok[0].a !== a0) ok[0].a = a0; scenes.push(...ok); } else scenes.push(...autoPlan(L, a0, a1)); });
    L.scenes = normPlan({ scenes }, L); if (mood) L.mood = mood; L._auto = fails === parts.length; return L; }
  // автоплан без AI: сцени кожні ~6 слів, різні локації й плани, написи на ключових місцях
  function autoPlan(L, a0, a1) { const P = ["space", "room", "office", "street", "class", "cafe", "road", "park", "night", "lab"], SH = ["wide", "medium", "close", "wide", "face", "medium"], PO = ["talk", "think", "point", "shrug", "cheer", "walk", "phone", "sad"], FA = ["calm", "worried", "smirk", "shock", "happy", "sad"], out = [];
    for (let a = a0, i = Math.floor(a0 / 6); a < a1; a += 6, i++) { const sp = P[i % P.length] === "space", s = { a, place: P[i % P.length], time: ["day", "sunset", "night"][i % 3], shot: SH[i % SH.length], cam: i % 3 === 2 ? "pull" : "push", tr: i ? (i % 2 ? "whip" : "cut") : "cut",
      cast: [{ who: "hero", x: .5, pose: PO[i % PO.length], face: FA[i % FA.length], to: PO[i % PO.length] === "walk" ? .7 : undefined }] };
      if (sp) s.hud = { k: ["brain", "chart", "rings", "counter"][i % 4], i: a, v: 1 };
      if (i % 3 === 0) { const ws = L.words.slice(a, Math.min(a1, a + 4)).map((w) => w.w.replace(/[.,!?…:;«»"]/g, "")); if (ws.length) { ws[ws.length - 1] = "*" + ws[ws.length - 1] + "*"; s.cap = { t: ws.join(" ").toUpperCase(), i: a }; } }
      out.push(s); }
    return out; }
  async function aiEdit(L, text) {
    const strip = L.scenes.map(({ t0, t1, hitT, seed, dir, ...s }) => ({ ...s, props: (s.props || []).map(({ at, ...p }) => p), hud: s.hud ? (({ at, ...h }) => ({ ...h, y: +(h.y / H).toFixed(2) }))(s.hud) : null, cap: s.cap ? (({ at, ...c }) => c)(s.cap) : null }));
    const r = await sample.json(`Ти режисер вертикальної кіно-анімації. Слова озвучки з номерами:
${numbered(L)}
${SPEC}
Поточний план (JSON): ${JSON.stringify({ mood: L.mood, scenes: strip })}
Людина просить змінити: «${text}». Зміни лише те, про що просять. Музика — поле mood (${Object.keys(MOODS).join(", ")}).
Відповідай тільки JSON: {"mood":"…","scenes":[…повний новий список…],"say":"одне коротке речення — що зроблено"}`, { cache: false, kb: ["style", "edit", "general"], max: 8000 });
    if (Array.isArray(r?.scenes) && r.scenes.length) L.scenes = normPlan(r, L); if (MOODS[r?.mood]) L.mood = r.mood; return r?.say || "Готово."; }
  async function aiText(topic, sec, silent) { const want = Math.round(sec * (silent ? 1.6 : 2.4));
    const r = await sample.json(`Напиши ${silent ? "текст для анімаційного Reels БЕЗ голосу — він іде на екрані субтитрами, короткі речення по 4–9 слів" : "текст для озвучки за кадром — жива розмовна українська, як людина говорить другу"} на тему: «${topic}».
Формат: вертикальне кіно-анімаційне відео (герой-чоловічок, сцени змінюються кожні 2–4 с) ≈ ${sec} с. Перше речення — сильний гачок-питання або несподіваний факт; далі історія героя з поворотом (але/тому), конкретні числа й образи, які легко показати; фінал замикає петлю з початком.
Обсяг ≈ ${want} слів. Без хештегів, емодзі, ремарок і заголовків. Відповідай тільки JSON {"text":"…"}`, { cache: false, kbFmt: "tall", kb: ["hook", "script", "story", "general"], max: 3000 });
    return String(r?.text || "").trim(); }

  /* ---------- голос і слова ---------- */
  function wordsFromText(text) { const ws = []; let t = .7; String(text).split(/\s+/).filter(Boolean).forEach((w) => { const d = .22 + Math.min(.5, w.length * .05); ws.push({ w, s: t, e: t + d }); t += d + .08; if (/[.!?…]$/.test(w)) t += .55; else if (/[,:;—–]$/.test(w)) t += .22; }); return { ws, dur: t + 1.2 }; }
  const b64Buf = (b) => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  async function ttsAudio(text, voice) { const r = await SRV.tts({ text: String(text).trim().slice(0, 2400), voice, quiet: true }); return E().decode(b64Buf(r.audio)); }
  const TTS_ERR = { no_quota: "Хвилини AI-озвучки закінчились", no_key: "AI-озвучка тимчасово недоступна", no_clone: "Спершу створи свій голос", bad_voice: "Цей голос недоступний — вибери інший", busy: "Сервіс озвучки перевантажений, спробуй за хвилину", empty_text: "Немає тексту для озвучки" };
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
#yvcn .row{display:flex;gap:8px}#yvcn .row .btn:first-child{flex:1}#yvcn .btn.sq{width:52px;flex:none;padding:0;font-size:20px}
#yvcn .sec{margin-top:16px}#yvcn .sec h4{margin:0 0 8px;font-size:13.5px;color:#d4d4d8;font-weight:800}
#yvcn .chips{display:flex;flex-wrap:wrap;gap:6px}#yvcn .chip{padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e4e4e7;font-weight:600;font-size:13px;font-family:inherit;cursor:pointer}#yvcn .chip[aria-pressed=true]{background:#f5f5f7;color:#0b0b0d}
#yvcn .dot{width:34px;height:34px;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0}#yvcn .dot[aria-pressed=true]{border-color:#fff;box-shadow:0 0 0 2px #0b0b0d inset}
#yvcn .styl{display:flex;gap:10px;align-items:center;padding:8px;border-radius:16px;border:1.5px solid #f5f5f7;background:rgba(255,255,255,.06)}#yvcn .styl canvas{width:96px;height:171px;border-radius:12px;flex:none;background:#222}#yvcn .styl b{display:block;font-size:15px}#yvcn .styl span{display:block;font-size:12.5px;color:#a1a1aa;margin-top:3px}
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
  const OPT = { col: "yellow", acc: "none", voice: "ai", subs: true, music: true, mood: "auto", sec: 45 };
  try { Object.assign(OPT, JSON.parse(localStorage.getItem("yvCineOpt") || "{}")); } catch (e) {}
  const saveOpt = () => { try { localStorage.setItem("yvCineOpt", JSON.stringify(OPT)); } catch (e) {} };
  const DRAFT = { topic: "", text: "", vid: "" }; try { Object.assign(DRAFT, JSON.parse(sessionStorage.getItem("yvCine") || "{}")); } catch (e) {}
  const saveDraft = () => { try { sessionStorage.setItem("yvCine", JSON.stringify(DRAFT)); } catch (e) {} };
  const UI = { root: null }; let DEMO = 0;
  function shell() { if (!document.getElementById("yvcncss")) { const st = document.createElement("style"); st.id = "yvcncss"; st.textContent = CSS; document.head.appendChild(st); }
    UI.root?.remove(); const d = document.createElement("div"); d.id = "yvcn"; d.innerHTML = `<div class="ch"><b>Кіно-анімація<span class="tag">ТЕСТ</span></b><button class="cx" type="button" id="cclose" aria-label="Закрити">×</button></div><div class="cb"></div><div class="cf"></div>`;
    document.body.appendChild(d); UI.root = d; $(d, "#cclose").onclick = close; return d; }
  function close() { stopPlay(); cancelAnimationFrame(DEMO); UI.root?.remove(); UI.root = null; }
  const DEMOPLAN = () => ({ dur: 9, mood: "curious", subs: false, silent: true, hero: { col: OPT.col, acc: OPT.acc }, words: Array.from({ length: 30 }, (_, i) => ({ w: "", s: .3 + i * .3, e: .55 + i * .3 })), scenes: [
    { a: 0, place: "space", time: "night", shot: "wide", cam: "push", cast: [{ who: "hero", x: .5, pose: "shock", face: "shock" }], hud: { k: "brain", i: 1, y: 620 }, cap: { t: "ЩО ЯКБИ *ТИ*…", i: 0 } },
    { a: 10, place: "class", time: "sunset", shot: "medium", cam: "push", tr: "whip", cast: [{ who: "hero", x: .42, pose: "hold", face: "worried" }], props: [{ k: "card", t: "80", t2: "тест", hold: 1, i: 11 }] },
    { a: 20, place: "road", time: "sunset", shot: "wide", cam: "pan_r", tr: "whip", cast: [{ who: "hero", x: .3, to: .62, pose: "walk", face: "happy" }], cap: { t: "*3 ДНІ* ПОТОМУ", k: "title", i: 21 } }] });
  function demo(cv) { cancelAnimationFrame(DEMO); const P = DEMOPLAN(); timeline(P); const x = cv.getContext("2d"), t0 = performance.now(); const loop = () => { if (!cv.isConnected) return; const t = ((performance.now() - t0) / 1000) % P.dur; drawFrame(x, P, t, cv.width, cv.height); DEMO = requestAnimationFrame(loop); }; loop(); }
  const VOICES = [["ai", "AI-голос", "Вибираєш голос — AI озвучує текст"], ["clone", "Мій голос (клон)", "AI говорить твоїм голосом"], ["rec", "Запишу сам", "Наговориш у мікрофон"], ["file", "Готовий запис", "Завантажиш аудіо чи відео"], ["none", "Без голосу", "Лише музика й субтитри"]];
  function screenSetup(msg) { stopPlay(); const d = shell(), B = $(d, ".cb"), F = $(d, ".cf");
    B.innerHTML = `${msg ? `<div class="msg">${escH(msg)}</div>` : ""}<div class="scr">
      <div class="sec"><h4>Стиль</h4><div class="styl"><canvas width="270" height="480" id="cdemo"></canvas><div><b>Кіно-чоловічок</b><span>Плаский герой у намальованих локаціях, світло й пил, наїзди камери, великі написи з виділеним словом, HUD-вікна, музика та звуки на діях. Стиль узято з YouTube-прикладів, переведено у вертикаль.</span></div></div></div>
      <div class="sec"><h4>Герой: колір худі</h4><div class="chips" id="ccol">${Object.entries(HOOD).filter(([k]) => k !== "grey").map(([k, v]) => `<button class="dot" type="button" data-col="${k}" style="background:${v}" aria-pressed="${OPT.col === k}" aria-label="${k}"></button>`).join("")}</div>
        <div class="chips" style="margin-top:8px">${[["none", "Без нічого"], ["beanie", "Шапка"], ["cap", "Кепка"], ["glasses", "Окуляри"], ["headphones", "Навушники"]].map(([k, n]) => `<button class="chip" type="button" data-acc="${k}" aria-pressed="${OPT.acc === k}">${n}</button>`).join("")}</div></div>
      <div class="sec"><h4>Тривалість</h4><div class="chips">${[20, 30, 45, 60, 90].map((s) => `<button class="chip" type="button" data-sec="${s}" aria-pressed="${OPT.sec === s}">${s} с</button>`).join("")}</div></div>
      <div class="sec"><h4>Голос</h4><div class="vopt">${VOICES.map(([k, n, s]) => `<button type="button" data-v="${k}" aria-pressed="${OPT.voice === k}"><b>${n}</b><span>${s}</span></button>`).join("")}</div></div>
      <div class="sec"><h4>Музика</h4><div id="csmus"></div></div>
      <div class="sec"><div class="tg"><div><b>Субтитри</b><span>Слова внизу, поточне — жовтим</span></div><button class="sw" type="button" id="csubs" role="switch" aria-checked="${OPT.subs}"></button></div></div></div>`;
    F.innerHTML = `<button class="btn main" type="button" id="cnext">Далі</button>`;
    const cv = $(B, "#cdemo"); loadFont().then(() => demo(cv)); loadIcons();
    const pick = (sel, key, cb) => B.querySelectorAll(sel).forEach((b) => b.onclick = () => { B.querySelectorAll(sel).forEach((o) => o.setAttribute("aria-pressed", o === b)); cb(b.dataset[key]); saveOpt(); });
    pick("[data-col]", "col", (v) => { OPT.col = v; demo(cv); }); pick("[data-acc]", "acc", (v) => { OPT.acc = v; demo(cv); }); pick("[data-sec]", "sec", (v) => OPT.sec = +v); pick("[data-v]", "v", (v) => OPT.voice = v);
    musicList($(B, "#csmus"), OPT.music ? OPT.mood : "off", (v) => { OPT.music = v !== "off"; if (v !== "off") OPT.mood = v; saveOpt(); });
    if (!OPT.music || OPT.mood !== "auto") { const fx = $(B, "#csmus"); if (!fx.querySelector('[data-mk="auto"]')) { fx.querySelector(".vopt")?.insertAdjacentHTML("afterbegin", `<button type="button" data-mk="auto" aria-pressed="false"><b>AI вибере</b><span>Під настрій тексту</span></button>`); const ab = fx.querySelector('[data-mk="auto"]'); ab.onclick = () => { fx.querySelectorAll("[data-mk]").forEach((o) => o.setAttribute("aria-pressed", o === ab)); OPT.music = true; OPT.mood = "auto"; saveOpt(); }; } }
    $(B, "#csubs").onclick = (e) => { OPT.subs = !OPT.subs; e.currentTarget.setAttribute("aria-checked", OPT.subs); saveOpt(); };
    $(F, "#cnext").onclick = () => { cancelAnimationFrame(DEMO); stopPrev(); screenContent(); }; track("open"); }
  const VPA = { a: null };
  async function voicePick(box) { let V = [], cl = null, err = "";
    try { V = (await SRV.voices()) || []; } catch (e) { err = e?.message || "err"; }
    if (OPT.voice === "clone") { try { cl = await SRV.myClone(); } catch (e) {} }
    if (!box.isConnected) return;
    if (OPT.voice === "clone") { box.innerHTML = cl?.has ? `<p class="cnt" style="margin:0">✓ Озвучимо твоїм голосом</p>` : `<p class="cnt" style="margin:0">Ще немає зразка твого голосу — створи його в «Озвучці» або вибери AI-голос.</p>`; DRAFT.vid = cl?.has ? "clone" : ""; return; }
    if (!V.length) { box.innerHTML = `<p class="cnt" style="margin:0">Голоси не завантажились${err ? ` (${escH(err)})` : ""}. <button class="chip" type="button" id="cvr">Ще раз</button></p>`; $(box, "#cvr").onclick = () => { box.innerHTML = `<p class="cnt" style="margin:0">Завантажую голоси…</p>`; voicePick(box); }; return; }
    if (!V.some((v) => v.id === DRAFT.vid)) DRAFT.vid = V[0].id;
    box.innerHTML = `<div class="vopt">${V.map((v) => `<button type="button" data-vid="${escH(v.id)}" aria-pressed="${DRAFT.vid === v.id}" style="display:flex;align-items:center;gap:10px"><span style="flex:1"><b>${escH(v.name)}</b>${v.descr ? `<span>${escH(v.descr)}</span>` : ""}</span><i data-pv="${escH(v.id)}" role="button" aria-label="Прослухати" style="font-style:normal;flex:none;width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.12);display:grid;place-items:center">▶</i></button>`).join("")}</div>`;
    box.querySelectorAll("[data-vid]").forEach((b) => b.onclick = async (e) => { DRAFT.vid = b.dataset.vid; saveDraft(); box.querySelectorAll("[data-vid]").forEach((o) => o.setAttribute("aria-pressed", o === b));
      const pv = e.target.closest("[data-pv]"); if (!pv) return; try { VPA.a?.pause(); } catch (x) {} if (pv.textContent === "■") { pv.textContent = "▶"; return; }
      const v = V.find((q) => q.id === b.dataset.vid); let u = v.preview || v._u;
      if (!u) { pv.textContent = "…"; try { const r = await SRV.tts({ text: "Привіт! Ось так звучатиме твоє відео.", voice: { kind: "preset", id: v.id }, quiet: true }); u = v._u = URL.createObjectURL(new Blob([b64Buf(r.audio)], { type: r.mime || "audio/mpeg" })); } catch (x) { pv.textContent = "▶"; say(TTS_ERR[x.message] || "Не вдалося прослухати"); return; } }
      box.querySelectorAll("[data-pv]").forEach((o) => o.textContent = "▶"); VPA.a = new Audio(u); pv.textContent = "■"; VPA.a.onended = () => pv.textContent = "▶"; VPA.a.play().catch(() => pv.textContent = "▶"); }); }
  function screenContent(msg) { stopPlay(); const d = shell(), B = $(d, ".cb"), F = $(d, ".cf"), v = OPT.voice, rec = v === "rec" || v === "file";
    B.innerHTML = `${msg ? `<div class="msg">${escH(msg)}</div>` : ""}<div class="scr">
      <div class="sec"><h4>Про що відео?</h4><input class="tx" id="ctopic" placeholder="Напр.: що буде, якщо щодня знімати по одному відео" value="${escH(DRAFT.topic)}"></div>
      <div class="sec"><h4>${rec ? "Текст, який прочитаєш (можна без нього)" : v === "none" ? "Текст на екрані" : "Текст для озвучки"}</h4><button class="btn" type="button" id="cwr" style="margin-bottom:8px">✨ ${DRAFT.text ? "Написати інакше" : "Написати текст з AI"}</button>
        <textarea id="ctext" rows="8" placeholder="Встав свій текст або натисни «Написати з AI»">${escH(DRAFT.text)}</textarea><p class="cnt" id="ccnt"></p></div>
      ${v === "ai" || v === "clone" ? `<div class="sec"><h4>Голос</h4><div id="cvl"><p class="cnt" style="margin:0">Завантажую голоси…</p></div></div>` : ""}</div>`;
    F.innerHTML = v === "rec" ? `<div class="row"><button class="btn main" type="button" id="crec">🎙 Записати</button><button class="btn sq" type="button" id="cprev" aria-label="Назад">‹</button></div>`
      : v === "file" ? `<div class="row"><label class="btn main" for="cfile">Завантажити запис</label><button class="btn sq" type="button" id="cprev" aria-label="Назад">‹</button></div><input type="file" id="cfile" accept="audio/*,video/*" hidden>`
      : `<div class="row"><button class="btn main" type="button" id="cgo">Створити анімацію</button><button class="btn sq" type="button" id="cprev" aria-label="Назад">‹</button></div>`;
    const ta = $(B, "#ctext"), tp = $(B, "#ctopic"), cnt = $(B, "#ccnt");
    const est = () => { DRAFT.text = ta.value; saveDraft(); const n = (ta.value.match(/\S+/g) || []).length; cnt.textContent = n ? `${n} слів · ≈ ${fmt(v === "none" ? wordsFromText(ta.value).dur : n / 2.4)}` : `Ціль ≈ ${OPT.sec} с`; };
    ta.oninput = est; est(); tp.oninput = () => { DRAFT.topic = tp.value; saveDraft(); };
    $(B, "#cwr").onclick = async () => { const topic = tp.value.trim() || ta.value.trim().slice(0, 300); if (!topic) { say("Напиши, про що відео"); tp.focus(); return; }
      try { const t = await E().busyRun("text", () => aiText(topic, OPT.sec, v === "none")); if (!t) throw new Error("empty"); ta.value = t; est(); $(B, "#cwr").textContent = "✨ Написати інакше"; track("ai_text"); } catch (e) { console.warn("cine text", e); say(e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло написати текст"); } };
    if (v === "ai" || v === "clone") voicePick($(B, "#cvl"));
    $(F, "#cprev").onclick = () => { try { VPA.a?.pause(); } catch (e) {} screenSetup(); };
    if (v === "rec") { const rb = $(F, "#crec"), rl = rb.innerHTML; rb.onclick = () => E().record(rb, rl, (buf) => build({ buf })); }
    else if (v === "file") $(F, "#cfile").onchange = async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) build({ buf: await f.arrayBuffer() }); };
    else $(F, "#cgo").onclick = () => { try { VPA.a?.pause(); } catch (e) {} const t = ta.value.trim(); if ((t.match(/\S+/g) || []).length < 4) { say("Додай текст — хоча б одне речення"); ta.focus(); return; }
      if (v === "none") return build({ silent: true, text: t }); if (!DRAFT.vid) { say(v === "clone" ? "Спершу створи свій голос" : "Вибери голос"); return; }
      build({ tts: { text: t, voice: DRAFT.vid === "clone" ? { kind: "clone" } : { kind: "preset", id: DRAFT.vid } } }); }; }
  let STAGE = "";
  async function build(src) { const MAX = 95;
    STAGE = "старт"; try { await E().busyRun("montage", async () => { const stage = (t) => { STAGE = t.replace(/…$/, "").toLowerCase(); try { yvBusy?.stage?.(t); } catch (e) {} };
        await Promise.all([loadFont(), loadIcons()]); let y, words = null;
        if (src.silent) { const r = wordsFromText(src.text); words = r.ws.filter((w) => w.e < MAX - 1); y = new Float32Array(Math.round(Math.min(MAX, r.dur) * E().SR)); }
        else { stage(src.tts ? "Озвучую текст…" : "Готую запис…"); y = src.tts ? await ttsAudio(src.tts.text, src.tts.voice) : await E().decode(src.buf); if (y.length / E().SR > MAX) { y = y.subarray(0, Math.round(MAX * E().SR)).slice(); say("Для Reels — до 1,5 хв. Беру початок"); } }
        if (!words) { stage("Розпізнаю слова…"); words = await sttWords(y); }
        if (words.length < 3) throw new Error("nowords");
        L = { voice: y, words, dur: Math.max(y.length / E().SR, words[words.length - 1].e + 1.2), silent: !!src.silent, subs: OPT.subs, music: OPT.music, mood: OPT.mood === "auto" ? "curious" : OPT.mood, hero: { col: OPT.col, acc: OPT.acc }, hist: [], src };
        stage("Режисую сцени…"); await aiPlan(L); if (OPT.mood !== "auto" && OPT.music) L.mood = OPT.mood; timeline(L);
        stage("Пишу музику й звуки…"); L.aud = await soundtrack(L); });
      track("ready", { v: `${L.scenes.length}sc/${Math.round(L.dur)}s/${L.mood}${L._auto ? "/auto" : ""}` }); screenEdit(L._auto ? `AI-режисер не відповів (${L._planErr || "помилка"}) — сцени розставлено автоматично. Можна натиснути «Інший варіант»` : "Тапни ▶, щоб подивитись. Правки — кнопкою ✎");
    } catch (e) { console.error(e); const m = e?.message || e?.code || String(e); track("fail", { v: `${STAGE}|${String(m).slice(0, 40)}` });
      const msg = TTS_ERR[m] || (m === "nowords" ? "Не почув слів — спробуй ще раз" : m === "limit" ? "Ліміт на сьогодні вичерпано" : m === "login" ? "Увійди в акаунт" : `Не вийшло зібрати анімацію (етап: ${STAGE}; ${String(m).slice(0, 60)}). Спробуй ще раз або скинь цей текст Claude`);
      say(msg); L = null; screenContent(msg); } }
  async function remix(fn, label) { stopPlay(); try { await E().busyRun("montage", async () => { const keep = JSON.stringify({ scenes: L.scenes, mood: L.mood, music: L.music }); L.hist.push(keep); if (L.hist.length > 15) L.hist.shift(); const r = await fn(); timeline(L); L.aud = await soundtrack(L); L._say = r; }); screenEdit(L._say || label); } catch (e) { console.error(e); say(e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло. Спробуй ще раз"); } }
  /* ---------- імітація інтерфейсу соцмереж (лише в перегляді, у збережене відео не йде) ---------- */
  const OVL = { none: "Без інтерфейсу", ig: "Instagram", tt: "TikTok", yt: "Shorts" };
  let OV = "ig"; try { OV = localStorage.getItem("yvCineOvl") || "ig"; } catch (e) {}
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
      x.fillStyle = "#8b79bb"; x.beginPath(); x.arc(90, 1640, 34, 0, 7); x.fill(); T("yuvi.studio", 140, 1640, 36, 700); sh(() => { x.strokeStyle = "#fff"; x.lineWidth = 3; x.beginPath(); x.roundRect ? x.roundRect(370, 1615, 190, 52, 12) : x.rect(370, 1615, 190, 52); x.stroke(); }); T("Стежити", 465, 1641, 30, 700, "center");
      T("Опис твого відео, який бачать люди… ще", 56, 1730, 32, 500); T("♫ Оригінальний звук · yuvi.studio", 56, 1800, 28, 500); }
    if (k === "tt") { T("Підписки   |   Для вас", W / 2, 120, 38, 700, "center"); [["ava", ""], ["heart", "48 тис."], ["com", "1 120"], ["save", "3 210"], ["send", "Поділ."], ["disc", ""]].forEach(([q, n], i) => icon(900 + i * 150, q, n));
      T("@yuvi.studio", 50, 1600, 38, 800); T("Опис твого відео, який бачать люди…", 50, 1665, 32, 500); T("#контент #заробіток", 50, 1720, 32, 700); T("♫ оригінальний звук — yuvi.studio", 50, 1790, 28, 500); }
    if (k === "yt") { T("Shorts", 50, 110, 48, 800); [["heart", "8,1 тис."], ["down", "Не подоб."], ["com", "256"], ["send", "Поділитися"], ["disc", ""]].forEach(([q, n], i) => icon(1000 + i * 155, q, n));
      x.fillStyle = "#8b79bb"; x.beginPath(); x.arc(84, 1660, 32, 0, 7); x.fill(); T("@yuvi.studio", 130, 1660, 34, 700); x.fillStyle = "#fff"; x.beginPath(); x.roundRect ? x.roundRect(400, 1634, 230, 54, 27) : x.rect(400, 1634, 230, 54); x.fill(); T("Підписатися", 515, 1661, 28, 700, "center", "#111"); T("Опис твого відео, який бачать люди…", 56, 1750, 32, 500); }
    x.setLineDash([14, 12]); x.strokeStyle = "rgba(255,214,10,.45)"; x.lineWidth = 3; x.strokeRect(SAFE.left, SAFE.top, SAFE.right - SAFE.left, SAFE.bottom - SAFE.top); x.setLineDash([]);
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
  const SHOT_N = { wide: "Загальний", medium: "По пояс", close: "Крупно", face: "Обличчя" }, CAM_N = { push: "Наїзд", pull: "Від'їзд", pan_l: "Вліво", pan_r: "Вправо", still: "Стоїть", shake: "Тряска" }, TR_N = { cut: "Склейка", whip: "Змах", fade: "Темрява" }, TIME_N = { day: "День", sunset: "Захід", night: "Ніч" };
  const HUD_N = { none: "Немає", panel: "Вікно з %", chart: "Графік", bars: "Стовпці", counter: "Число", brain: "Мозок", check: "Чекліст", compare: "До/після", rings: "Кільця", network: "Мережа" };
  async function aiScene(L, i, wish) { const sc = L.scenes[i], a1 = L.scenes[i + 1]?.a ?? L.words.length, words = L.words.slice(sc.a, a1).map((w, k) => `${sc.a + k}:${w.w}`).join(" ");
    const strip = (o) => o ? (({ t0, t1, hitT, seed, dir, ...r }) => ({ ...r, hud: r.hud ? { ...r.hud, y: +(r.hud.y / H).toFixed(2), at: undefined } : null }))(o) : null;
    const r = await sample.json(`Ти режисер вертикальної кіно-анімації. Переробляєш ОДНУ сцену. Її слова з номерами: ${words}
Попередня сцена: ${JSON.stringify(strip(L.scenes[i - 1]))}. Наступна: ${JSON.stringify(strip(L.scenes[i + 1]))}. Поточна: ${JSON.stringify(strip(sc))}.
${wish ? `Людина просить: «${wish}». Зроби саме це, решту залиш.` : "Зроби інший, сильніший варіант цієї сцени (інша локація або план, інша дія героя)."}
${RULES}
${SPEC}
Відповідай тільки JSON: {"scene":{"a":${sc.a},…}}`, { cache: false, kb: ["style", "edit", "story", "camera", "general"], max: 2500 });
    const sc2 = r?.scene || r?.scenes?.[0]; if (!sc2) throw new Error("plan_empty"); sc2.a = sc.a; const n = normPlan({ scenes: [{ ...sc2, a: 0 }] }, L)[0]; n.a = sc.a; L.scenes[i] = n; }
  let AUD_DIRTY = false;
  async function freshAudio() { if (!AUD_DIRTY) return; AUD_DIRTY = false; L.aud = await soundtrack(L); }
  function sceneSheet(i, refresh) { const sc = L.scenes[i], hero = sc.cast.find((c) => c.who === "hero") || sc.cast[0], a1 = L.scenes[i + 1]?.a ?? L.words.length;
    const chips = (key, map, cur) => `<div class="chips">${Object.entries(map).map(([k, n]) => `<button class="chip" type="button" data-sk="${key}" data-sv="${k}" aria-pressed="${cur === k}">${n}</button>`).join("")}</div>`;
    const P = panel(`Сцена ${i + 1} · ${fmt(sc.t0)}–${fmt(sc.t1)}`, `<p class="cnt" style="margin:0 0 8px;color:#e4e4e7">«${escH(L.words.slice(sc.a, a1).map((w) => w.w).join(" "))}»</p>
      <div class="row"><button class="btn" type="button" data-sp>▶ Переглянути сцену</button></div>
      <div class="sec"><h4>Змінити словами</h4><div class="ask"><input class="tx" id="cscask" placeholder="Напр.: герой у кав'ярні, радіє, в руках телефон"><button class="btn sq" type="button" id="cscgo">✎</button></div><button class="btn" type="button" id="cscre" style="margin-top:8px">↻ Інший варіант цієї сцени</button></div>
      <div class="sec"><h4>Напис</h4><input class="tx" id="csccap" placeholder="До 5 слів, *слово* — жовтим" value="${escH(sc.cap?.t || "")}"></div>
      <div class="sec"><h4>Локація</h4>${chips("place", Object.fromEntries(Object.entries(PLACES).map(([k, v]) => [k, v.n])), sc.place)}</div>
      <div class="sec"><h4>Час доби</h4>${chips("time", TIME_N, sc.time)}</div>
      <div class="sec"><h4>План</h4>${chips("shot", SHOT_N, sc.shot)}</div>
      <div class="sec"><h4>Камера</h4>${chips("cam", CAM_N, sc.cam)}</div>
      ${i ? `<div class="sec"><h4>Перехід у сцену</h4>${chips("tr", TR_N, sc.tr)}</div>` : ""}
      ${hero ? `<div class="sec"><h4>Поза героя</h4>${chips("pose", POSE_N, hero.pose)}</div><div class="sec"><h4>Емоція</h4>${chips("face", FACE_N, hero.face)}</div>` : ""}
      <div class="sec"><h4>Вікно поверх кадру</h4>${chips("hud", HUD_N, sc.hud?.k || "none")}<input class="tx" id="cschud" style="margin-top:8px" placeholder="Заголовок вікна / число" value="${escH(sc.hud?.k === "counter" ? String(sc.hud?.v ?? "") : sc.hud?.t || "")}"></div>`);
    const apply = () => { timeline(L); AUD_DIRTY = true; refresh(i); };
    P.querySelector("[data-pclose]").onclick = async () => { P.remove(); await freshAudio(); };
    P.querySelectorAll("[data-sk]").forEach((b) => b.onclick = () => { const k = b.dataset.sk, v = b.dataset.sv; P.querySelectorAll(`[data-sk="${k}"]`).forEach((o) => o.setAttribute("aria-pressed", o === b)); pushH();
      if (k === "pose" || k === "face") { if (hero) { hero[k] = v; if (k === "pose") { hero.to = undefined; hero.y = undefined; } } }
      else if (k === "hud") { if (v === "none") sc.hud = null; else { sc.hud = { ...(sc.hud || {}), k: v, i: sc.a, y: (sc.cast.length ? (v === "counter" ? .24 : v === "brain" ? .32 : .27) : .4) * H, t: sc.hud?.t || "", v: sc.hud?.v ?? (v === "counter" ? "100" : 1), items: sc.hud?.items || (v === "check" ? ["Крок 1", "Крок 2", "Крок 3"] : v === "compare" ? ["Було", "Стало"] : undefined) }; } }
      else sc[k] = v; apply(); });
    P.querySelector("#csccap").onchange = (e) => { pushH(); const t = e.target.value.trim(); sc.cap = t ? { ...(sc.cap || {}), t: t.slice(0, 60), i: sc.cap?.i ?? sc.a } : null; apply(); };
    P.querySelector("#cschud").onchange = (e) => { if (!sc.hud) return; pushH(); const t = e.target.value.trim(); if (sc.hud.k === "counter") sc.hud.v = t; else sc.hud.t = t.slice(0, 30); apply(); };
    P.querySelector("[data-sp]").onclick = async () => { await freshAudio(); refresh(i, true); };
    const ai = async (wish) => { stopPlay(); pushH(); try { await E().busyRun("montage", async () => { try { yvBusy?.stage?.("Режисую сцену…"); } catch (e) {} await aiScene(L, i, wish); timeline(L); L.aud = await soundtrack(L); AUD_DIRTY = false; }); refresh(i); sceneSheet(i, refresh); } catch (e) { console.error(e); L.hist.pop(); say(e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло змінити сцену. Спробуй ще раз"); } };
    P.querySelector("#cscgo").onclick = () => { const t = P.querySelector("#cscask").value.trim(); if (!t) return P.querySelector("#cscask").focus(); ai(t); };
    P.querySelector("#cscre").onclick = () => ai(""); }
  const pushH = () => { L.hist.push(JSON.stringify({ scenes: L.scenes, mood: L.mood, music: L.music })); if (L.hist.length > 25) L.hist.shift(); };

  function screenEdit(msg) { stopPlay(); stopPrev(); const d = shell(), B = $(d, ".cb"), F = $(d, ".cf");
    B.innerHTML = `${msg ? `<div class="msg">${escH(msg)}</div>` : ""}<div class="stage"><div class="cvw"><canvas width="540" height="960" id="ccv"></canvas><button class="pb" type="button" id="cpb" aria-label="Відтворити"><i>▶</i></button></div></div>
      <div class="seek"><input type="range" id="cseek" min="0" max="${L.dur.toFixed(2)}" step="0.01" value="0"><span id="ctime">0:00 / ${fmt(L.dur)}</span><button class="chip" type="button" id="covl" title="Як виглядатиме в соцмережі">📱 ${OVL[OV]}</button></div>
      <div class="scs" id="cscs">${L.scenes.map((sc, i) => `<button type="button" data-si="${i}"><canvas width="72" height="128"></canvas><span>${i + 1} · ${fmt(sc.t0)}</span></button>`).join("")}</div>`;
    F.innerHTML = `<div class="ask"><input class="tx" id="cask" placeholder="Правка всього відео. Напр.: більше нічних сцен"><button class="btn sq" type="button" id="caskgo" aria-label="Змінити">✎</button></div>
      <div class="tools"><button type="button" id="cre"><i>↻</i>Інший варіант</button><button type="button" id="cmus"><i>♫</i>${escH(L.music === false ? "Без музики" : MOODS[L.mood]?.n || "Музика")}</button><button type="button" id="csub"><i>Aa</i>Субтитри ${L.subs ? "вкл" : "викл"}</button><button type="button" id="cundo" ${L.hist.length ? "" : "disabled"}><i>↶</i>Назад</button></div>
      <div class="row"><button class="btn main" type="button" id="csave">Зберегти відео</button><button class="btn sq" type="button" id="cback" aria-label="До тексту">‹</button></div>`;
    const cv = $(B, "#ccv"), cw = $(B, ".cvw"), stg = $(B, ".stage"), sk = $(B, "#cseek"), tl = $(B, "#ctime"), pb = $(B, "#cpb"), strip = $(B, "#cscs");
    const fit = () => { const h = stg.clientHeight - 8, w = Math.min(h * 9 / 16, stg.clientWidth - 12); cw.style.width = w + "px"; cw.style.height = w * 16 / 9 + "px"; }; fit(); new ResizeObserver(fit).observe(stg);
    const x = cv.getContext("2d"), after = (c) => overlay(c, OV, cv.width, cv.height);
    const mark = (t) => { const i = L.scenes.length ? sceneAt(L, t) : -1; strip.querySelectorAll("[data-si]").forEach((b) => b.classList.toggle("on", +b.dataset.si === i)); };
    const show = (t) => { drawFrame(x, L, t, cv.width, cv.height); after(x); tl.textContent = `${fmt(t)} / ${fmt(L.dur)}`; mark(t); };
    const big = document.createElement("canvas"); big.width = 270; big.height = 480;
    const thumbs = (only) => strip.querySelectorAll("[data-si]").forEach((b) => { const i = +b.dataset.si; if (only != null && i !== only) return; const sc = L.scenes[i]; b.lastElementChild.textContent = `${i + 1} · ${fmt(sc.t0)}`; drawFrame(big.getContext("2d"), L, Math.min(sc.t1 - .05, sc.t0 + Math.min(1.2, (sc.t1 - sc.t0) * .6)), 270, 480); b.firstElementChild.getContext("2d").drawImage(big, 0, 0, 72, 128); });
    show(Math.min(1.5, L.dur / 2)); requestAnimationFrame(() => thumbs());
    const play = (from, until) => { stopPrev(); pb.firstChild.style.opacity = 0; playFrom(from, cv, { after, until, tick: (t) => { sk.value = t; tl.textContent = `${fmt(t)} / ${fmt(L.dur)}`; mark(t); }, onend: () => { pb.firstChild.style.opacity = 1; } }); };
    pb.onclick = async () => { if (PL) { stopPlay(); return; } await freshAudio(); play(+sk.value >= L.dur - .1 ? 0 : +sk.value); };
    sk.oninput = () => { stopPlay(); show(+sk.value); };
    $(B, "#covl").onclick = (e) => { const ks = Object.keys(OVL); OV = ks[(ks.indexOf(OV) + 1) % ks.length]; try { localStorage.setItem("yvCineOvl", OV); } catch (x) {} e.currentTarget.textContent = "📱 " + OVL[OV]; if (!PL) show(+sk.value); };
    const refresh = (i, playIt) => { thumbs(i); const sc = L.scenes[i]; sk.value = sc.t0 + .05; if (playIt) play(sc.t0, sc.t1); else { stopPlay(); show(Math.min(sc.t1 - .05, sc.t0 + .9)); } $(F, "#cundo").disabled = !L.hist.length; };
    strip.querySelectorAll("[data-si]").forEach((b) => b.onclick = () => { const i = +b.dataset.si; refresh(i); sceneSheet(i, refresh); });
    const ask = $(F, "#cask"); $(F, "#caskgo").onclick = () => { const t = ask.value.trim(); if (!t) { ask.focus(); return; } remix(() => aiEdit(L, t)); track("edit"); }; ask.onkeydown = (e) => { if (e.key === "Enter") $(F, "#caskgo").click(); };
    $(F, "#cre").onclick = () => remix(async () => { await aiPlan(L, "Зроби ІНШИЙ варіант режисури: інші локації, плани й HUD, ніж зазвичай."); return "Новий варіант"; });
    $(F, "#cmus").onclick = () => { stopPlay(); const P = panel("Музика", `<p class="cnt" style="margin:0 0 8px">Натисни ▶, щоб послухати, і вибери рядок.</p><div id="cml"></div>`);
      P.querySelector("[data-pclose]").onclick = () => { stopPrev(); P.remove(); };
      musicList(P.querySelector("#cml"), L.music === false ? "off" : L.mood, (k) => { stopPrev(); P.remove(); if (k === "off") L.music = false; else { L.music = true; L.mood = k; } remix(async () => `Музика: ${L.music === false ? "вимкнено" : MOODS[L.mood].n}`); }); };
    $(F, "#csub").onclick = () => { L.subs = !L.subs; screenEdit(L.subs ? "Субтитри увімкнено" : "Субтитри вимкнено"); };
    $(F, "#cundo").onclick = async () => { const h = L.hist.pop(); if (!h) return; const o = JSON.parse(h); L.scenes = o.scenes; L.mood = o.mood; if (o.music !== undefined) L.music = o.music; await remix(async () => "Скасовано"); L.hist.pop(); };
    $(F, "#cback").onclick = () => { stopPlay(); screenContent(); };
    $(F, "#csave").onclick = async (e) => { const b = e.currentTarget, lbl = b.textContent; b.disabled = true; stopPlay(); await freshAudio();
      try { const r = await exportVideo((p) => b.textContent = `Зберігаю… ${Math.round(p * 100)}%`); const name = `yuvi-kino-${Date.now()}.${r.ext}`, f = new File([r.blob], name, { type: r.blob.type });
        if (navigator.canShare?.({ files: [f] })) { try { await navigator.share({ files: [f] }); } catch (x) {} } else { const a = document.createElement("a"); a.href = URL.createObjectURL(r.blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 6e4); }
        track("export", { v: `${Math.round(L.dur)}s` }); } catch (x) { console.error(x); say(x?.message === "noenc" ? "Цей браузер не вміє зберігати відео — спробуй Chrome або Safari 17+" : "Не вдалося зберегти"); }
      b.disabled = false; b.textContent = lbl; }; }
  window.YVCine = { open(o = {}) { if (o.text) { DRAFT.text = String(o.text); DRAFT.topic = String(o.topic || ""); saveDraft(); } screenSetup(); }, close, _t: { soundtrack, normPlan, aiPlan, set: (l) => { L = l; }, L: () => L, screenEdit, exportVideo, loadFont, drawFrame, timeline, PLACES, POSE, HOOD, figure, loadIcons, sceneAt } };
})();
