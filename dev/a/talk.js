/* YuVi · «Розкажи своїми словами» — монтаж живого голосу.
   Людина говорить як є → чистимо й вирівнюємо звук → розпізнаємо слова з часом → AI вирізає зайве →
   правки голосом або тапом по слову → «Влаштовує» → текст і аудіо йдуть у розкадровку.
   Нічого не генерується: у фіналі тільки справжній голос людини. */
(() => {
  "use strict";
  const SR = 44100;
  const $ = (r, s) => r.querySelector(s);
  const escH = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const db = (v) => 20 * Math.log10(Math.max(1e-9, v));
  const fromDb = (d) => Math.pow(10, d / 20);
  const say = (t) => { try { toast(t); } catch (e) {} };

  /* ================= ЗВУК ================= */
  const AC = () => (window.__yvTalkAC ||= new (window.AudioContext || window.webkitAudioContext)());
  async function decode(buf) {
    const b = await new Promise((ok, no) => { try { const p = AC().decodeAudioData(buf.slice(0), ok, no); if (p && p.then) p.then(ok, no); } catch (e) { no(e); } });
    const n = b.numberOfChannels, L = b.length, m = new Float32Array(L);
    for (let c = 0; c < n; c++) { const d = b.getChannelData(c); for (let i = 0; i < L; i++) m[i] += d[i] / n; }
    return b.sampleRate === SR ? m : resample(m, b.sampleRate, SR);
  }
  async function resample(x, from, to) {
    const len = Math.max(1, Math.round(x.length * to / from));
    const oc = new OfflineAudioContext(1, len, to), src = oc.createBufferSource(), b = oc.createBuffer(1, x.length, from);
    b.copyToChannel(x, 0); src.buffer = b; src.connect(oc.destination); src.start(); return (await oc.startRendering()).getChannelData(0).slice();
  }

  // --- FFT (radix-2, на місці) ---
  function fft(re, im, inv) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const a = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) { const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
          re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti; const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr; } }
    }
    if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }

  // --- шумозаглушення: спектральне віднімання з профілем шуму з найтихіших моментів ---
  function denoise(x, strength = 1) {
    const N = 2048, H = 512, win = new Float32Array(N);
    for (let i = 0; i < N; i++) win[i] = Math.sin(Math.PI * (i + .5) / N);   // sqrt-Hann для аналізу й синтезу
    const frames = Math.max(1, Math.ceil((x.length - N) / H) + 1), bins = N / 2 + 1;
    const re = new Float32Array(N), im = new Float32Array(N);
    // 1) енергія кадрів → 12% найтихіших = профіль шуму
    const en = new Float32Array(frames);
    for (let f = 0; f < frames; f++) { let s = 0; const o = f * H; for (let i = 0; i < N; i += 4) { const v = x[o + i] || 0; s += v * v; } en[f] = s; }
    const order = [...en.keys()].sort((a, b) => en[a] - en[b]), quiet = order.slice(0, Math.max(3, Math.floor(frames * .12)));
    const noise = new Float32Array(bins);
    for (const f of quiet) { const o = f * H; for (let i = 0; i < N; i++) { re[i] = (x[o + i] || 0) * win[i]; im[i] = 0; } fft(re, im);
      for (let k = 0; k < bins; k++) noise[k] += (re[k] * re[k] + im[k] * im[k]) / quiet.length; }
    // 2) маска з плавністю в часі (без «булькання»)
    const out = new Float32Array(x.length + N), prev = new Float32Array(bins).fill(1), over = 1.6 * strength, floor = .08;
    for (let f = 0; f < frames; f++) {
      const o = f * H; for (let i = 0; i < N; i++) { re[i] = (x[o + i] || 0) * win[i]; im[i] = 0; } fft(re, im);
      for (let k = 0; k < bins; k++) {
        const p = re[k] * re[k] + im[k] * im[k]; let g = Math.max(floor, 1 - over * noise[k] / (p + 1e-12)); g = Math.sqrt(g);
        g = g > prev[k] ? g * .6 + prev[k] * .4 : g * .3 + prev[k] * .7; prev[k] = g;
        re[k] *= g; im[k] *= g; if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
      }
      fft(re, im, true); for (let i = 0; i < N; i++) out[o + i] += re[i] * win[i] * (H * 2 / N);
    }
    return out.subarray(0, x.length).slice();
  }

  // --- огинаюча гучності (RMS) кадрами по 10 мс ---
  function envelope(x, hop = Math.round(SR * .01)) { const n = Math.ceil(x.length / hop), e = new Float32Array(n);
    for (let f = 0; f < n; f++) { let s = 0; const o = f * hop, end = Math.min(x.length, o + hop); for (let i = o; i < end; i++) s += x[i] * x[i]; e[f] = Math.sqrt(s / Math.max(1, end - o)); } return e; }

  // --- вирівнювання по фразах: близько/далеко/тихо/голосно → одна гучність ---
  function levelPhrases(x, target = -20) {
    const hop = Math.round(SR * .01), e = envelope(x, hop), n = e.length;
    const sorted = [...e].sort((a, b) => a - b), floorDb = db(sorted[Math.floor(n * .15)] || 1e-5), gate = Math.max(-55, floorDb + 10);
    // гучність мовлення у вікні ±250 мс (тільки кадри з голосом)
    const W = 25, gainDb = new Float32Array(n); let last = 0;
    for (let f = 0; f < n; f++) {
      let s = 0, c = 0; for (let k = Math.max(0, f - W); k <= Math.min(n - 1, f + W); k++) if (db(e[k]) > gate) { s += e[k] * e[k]; c++; }
      if (c >= 6) last = Math.max(-6, Math.min(14, target - db(Math.sqrt(s / c)))); gainDb[f] = last;
    }
    // плавність: атака 60 мс, спад 300 мс
    const A = 1 - Math.exp(-1 / 6), R = 1 - Math.exp(-1 / 30); let g = gainDb[0];
    for (let f = 0; f < n; f++) { const t = gainDb[f]; g += (t < g ? A : R) * (t - g); gainDb[f] = g; }
    const y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) { const f = i / hop, a = Math.min(n - 1, Math.floor(f)), b = Math.min(n - 1, a + 1), t = f - a; y[i] = x[i] * fromDb(gainDb[a] * (1 - t) + gainDb[b] * t); }
    return y;
  }

  // --- тихі місця між словами (вдихи, шурхіт) м'яко притискаємо ---
  function expander(x) {
    const hop = Math.round(SR * .01), e = envelope(x, hop), n = e.length, sorted = [...e].sort((a, b) => a - b);
    const speech = db(sorted[Math.floor(n * .7)] || 1e-4), thr = speech - 26, g = new Float32Array(n); let cur = 1;
    for (let f = 0; f < n; f++) { const d = db(e[f]), t = d >= thr ? 1 : Math.max(.18, fromDb((d - thr) * 1.2)); cur += (t > cur ? .5 : .08) * (t - cur); g[f] = cur; }
    const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) { const f = Math.min(n - 1, Math.floor(i / hop)); y[i] = x[i] * g[f]; } return y;
  }

  // --- тембр «як у петличку»: зріз низу, менше бубніння, більше розбірливості, м'якші «с/ш», компресор ---
  async function voiceChain(x, eqFix) {
    const oc = new OfflineAudioContext(1, x.length, SR), b = oc.createBuffer(1, x.length, SR); b.copyToChannel(x, 0);
    const src = oc.createBufferSource(); src.buffer = b; let node = src;
    const bq = (type, f, gain = 0, Q = .7) => { const q = oc.createBiquadFilter(); q.type = type; q.frequency.value = f; q.gain.value = gain; q.Q.value = Q; node.connect(q); node = q; };
    bq("highpass", 85, 0, .7); bq("peaking", 250, -2.5, 1); bq("peaking", 3200, 3, .9); bq("peaking", 7000, -2.5, 2.5); bq("highshelf", 10500, 1.5);
    (eqFix || []).forEach(([f, g]) => bq("peaking", f, g, 1.1));
    const c = oc.createDynamicsCompressor(); c.threshold.value = -26; c.knee.value = 8; c.ratio.value = 3.2; c.attack.value = .006; c.release.value = .16; node.connect(c); node = c;
    const mk = oc.createGain(); mk.gain.value = fromDb(5); node.connect(mk); mk.connect(oc.destination); src.start();
    return (await oc.startRendering()).getChannelData(0).slice();
  }

  // --- середній спектр мовлення по смугах (для підгонки тембру вставок) ---
  const BANDS = [150, 300, 600, 1200, 2400, 4800, 9000];
  function bandProfile(x) {
    const N = 2048, re = new Float32Array(N), im = new Float32Array(N), acc = new Float64Array(BANDS.length); let cnt = 0;
    const e = envelope(x, N), s = [...e].sort((a, b) => a - b), thr = s[Math.floor(s.length * .5)] || 0;
    for (let f = 0; f < e.length - 1; f++) { if (e[f] < thr) continue; const o = f * N; for (let i = 0; i < N; i++) { re[i] = (x[o + i] || 0) * (.5 - .5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; } fft(re, im);
      BANDS.forEach((fc, bi) => { const k0 = Math.round(fc / Math.SQRT2 * N / SR), k1 = Math.round(fc * Math.SQRT2 * N / SR); let p = 0; for (let k = k0; k <= k1; k++) p += re[k] * re[k] + im[k] * im[k]; acc[bi] += p / (k1 - k0 + 1); }); cnt++; }
    const tot = acc.reduce((a, b) => a + b, 0) || 1; return [...acc].map((v) => 10 * Math.log10(v / tot + 1e-12));
  }

  // --- повна обробка одного запису ---
  async function processTake(raw, ref) {
    let y = denoise(raw);
    y = levelPhrases(y);
    let fix = null;
    if (ref) { const a = bandProfile(y), b = ref; fix = BANDS.map((f, i) => [f, Math.max(-6, Math.min(6, (b[i] - a[i]) * .8))]).filter(([, g]) => Math.abs(g) > .8); }
    y = await voiceChain(y, fix);
    y = expander(y);
    return y;
  }

  // --- фінал: гучність як у Reels (≈ -14 LUFS) + лімітер, щоб нічого не хрипіло ---
  function master(x) {
    const e = envelope(x), sp = [...e].filter((v) => db(v) > -50).sort((a, b) => a - b);
    const speech = sp.length ? Math.sqrt(sp.slice(Math.floor(sp.length * .2)).reduce((a, v) => a + v * v, 0) / Math.max(1, sp.length - Math.floor(sp.length * .2))) : .1;
    const k = fromDb(-16 - db(speech)), y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] * k;
    // лімітер з передбаченням 3 мс, стеля -1 дБ
    const ceil = fromDb(-1), look = Math.round(SR * .003), rel = 1 - Math.exp(-1 / (SR * .08)); let g = 1;
    const peak = new Float32Array(y.length); for (let i = y.length - 1, m = 0, j = 0; i >= 0; i--) { peak[i] = Math.abs(y[i]); }
    const out = new Float32Array(y.length);
    for (let i = 0; i < y.length; i++) { let p = 0; for (let j = i; j < Math.min(y.length, i + look); j += 8) if (peak[j] > p) p = peak[j];
      const t = p > ceil ? ceil / p : 1; g = t < g ? t : g + rel * (t - g); out[i] = Math.max(-ceil, Math.min(ceil, y[i] * g)); }
    return out;
  }

  function wav(x, rate = SR) {
    const n = x.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b), w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true); return b;
  }
  /* ---------- «Звучання»: легке підлаштування голосу (живий голос, без AI) ---------- */
  const FXP = {
    orig: { n: "Оригінал", p: 0, eq: [] },
    deep: { n: "Глибше", p: -1, eq: [["lowshelf", 160, 3], ["peaking", 3000, -1]] },
    warm: { n: "Тепліше", p: 0, eq: [["lowshelf", 220, 2.5], ["highshelf", 7500, -2.5], ["peaking", 2500, -1]] },
    clear: { n: "Чіткіше", p: 0, eq: [["highpass", 120], ["peaking", 300, -2.5], ["peaking", 3600, 3.5]] },
    bright: { n: "Дзвінкіше", p: 1, eq: [["highshelf", 6500, 3], ["peaking", 250, -1.5]] },
    radio: { n: "Радіо", p: -.5, eq: [["lowshelf", 130, 3.5], ["peaking", 420, -2], ["peaking", 4200, 2.5], ["highshelf", 11000, 1.5]], comp: true },
  };
  let FX = { k: "orig", pitch: 0, tone: 0 }, FXOUT = null, FXSIG = "";
  try { const f = JSON.parse(localStorage.getItem("yvTalkFx")); if (f && FXP[f.k]) FX = f; } catch (e) {}
  const saveFx = () => { try { localStorage.setItem("yvTalkFx", JSON.stringify(FX)); } catch (e) {} };
  function pitchShift(x, semi) {
    if (!semi || typeof wsola !== "function") return x;
    const r = Math.pow(2, semi / 12), y = wsola(x, SR, 1 / r), out = new Float32Array(x.length);
    for (let i = 0; i < out.length; i++) { const f = i * r, a = Math.floor(f), t = f - a; out[i] = (y[a] || 0) * (1 - t) + (y[a + 1] || 0) * t; }
    return out;
  }
  async function applyFx(x) {
    const P = FXP[FX.k] || FXP.orig, semi = Math.max(-3, Math.min(3, (P.p || 0) + (+FX.pitch || 0))), tone = +FX.tone || 0;
    if (!semi && !tone && !P.eq.length) return x;
    const y = pitchShift(x, semi);
    const oc = new OfflineAudioContext(1, y.length, SR), b = oc.createBuffer(1, y.length, SR); b.copyToChannel(y, 0);
    const src = oc.createBufferSource(); src.buffer = b; let node = src;
    const bq = (type, f, g = 0, Q = .8) => { const q = oc.createBiquadFilter(); q.type = type; q.frequency.value = f; q.gain.value = g; q.Q.value = Q; node.connect(q); node = q; };
    P.eq.forEach(([t, f, g]) => bq(t, f, g || 0)); if (tone) { bq("lowshelf", 320, -tone / 2); bq("highshelf", 2800, tone / 2); }
    if (P.comp) { const c = oc.createDynamicsCompressor(); c.threshold.value = -22; c.ratio.value = 4; c.attack.value = .004; c.release.value = .12; node.connect(c); node = c; }
    node.connect(oc.destination); src.start();
    return master((await oc.startRendering()).getChannelData(0).slice());
  }
  async function fxOut() { const sig = JSON.stringify(FX); if (FXOUT && FXSIG === sig) return FXOUT; FXOUT = await applyFx(OUT); FXSIG = sig; return FXOUT; }

  const b64 = (ab) => { const u = new Uint8Array(ab); let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };

  // точка різу — у найтихішому місці поруч (щоб не обрізати слово й не клацало)
  function snap(src, t, dir) {
    const hop = Math.round(SR * .005), e = src.env5 ||= envelope(src.x, hop), c = Math.round(t * SR / hop), R = 14;
    let best = c, bv = Infinity; for (let k = c - (dir < 0 ? R : 4); k <= c + (dir > 0 ? R : 4); k++) { if (k < 0 || k >= e.length) continue; const v = e[k] + Math.abs(k - c) * 1e-5; if (v < bv) { bv = v; best = k; } }
    return Math.max(0, Math.min(src.x.length, best * hop));
  }

  /* ================= СТАН ================= */
  let SRC = [], TOK = [], HIST = [], ORIG = null, OUT = null, MAP = [], TARGET = 0, REFPROF = null;
  const FILLERS = /^(е+|е-е|ее+|м+|мм+|а+|ну|типу|типа|коротше|короче|значить|як би|якби|от|вот|ось|блін|ээ+|э+)$/i;
  const norm = (w) => String(w).toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, "");


  function render() {
    const keep = TOK.filter((t) => !t.cut); MAP = [];
    if (!keep.length) { OUT = new Float32Array(SR * .2); return; }
    const pieces = []; let run = null;
    const flush = () => { if (run) pieces.push(run); run = null; };
    keep.forEach((t, k) => { const src = SRC[t.src], w = src.words[t.i];
      if (run && run.src === t.src && t.i === run.lastI + 1 && w.s - src.words[run.lastI].e < .45) { run.e = w.e; run.lastI = t.i; run.toks.push(t); }
      else { flush(); run = { src: t.src, s: w.s, e: w.e, lastI: t.i, toks: [t] }; } });
    flush();
    const segs = pieces.map((p) => { const src = SRC[p.src], a = snap(src, Math.max(0, p.s - .03), -1), b = snap(src, p.e + .07, 1); return { p, a, b: Math.max(a + 200, b) }; });
    const gapAfter = (p) => /[.!?…]$/.test(SRC[p.src].words[p.lastI].w) ? .34 : /[,:;—-]$/.test(SRC[p.src].words[p.lastI].w) ? .2 : .14;
    let len = 0; segs.forEach((s, i) => { len += s.b - s.a + (i < segs.length - 1 ? Math.round(gapAfter(s.p) * SR) : 0); });
    const y = new Float32Array(len + SR * .3), F = Math.round(SR * .012); let o = Math.round(SR * .1);
    segs.forEach((s, i) => { const src = SRC[s.p.src], L = s.b - s.a;
      s.p.toks.forEach((t) => { const w = src.words[t.i]; MAP.push({ tok: t, s: (o + Math.max(0, w.s * SR - s.a)) / SR, e: (o + Math.min(L, w.e * SR - s.a)) / SR }); });
      for (let j = 0; j < L; j++) { const f = Math.min(1, j / F, (L - j) / F); y[o + j] += src.x[s.a + j] * f; }
      o += L + (i < segs.length - 1 ? Math.round(gapAfter(s.p) * SR) : 0); });
    OUT = master(y.subarray(0, o + Math.round(SR * .2))); FXOUT = null;
  }

  const snapTok = () => JSON.stringify(TOK);
  const pushHist = () => { HIST.push(snapTok()); if (HIST.length > 30) HIST.shift(); };

  /* ================= AI ================= */
  const numbered = (list) => list.map((t, k) => `${k}:${t}`).join(" ");
  async function aiClean() {
    const src = SRC[0], ws = src.words.map((w) => w.w), n = ws.length;
    const goal = TARGET ? `Ціль — приблизно ${TARGET} секунд (≈${Math.round(TARGET * 2.5)} слів). Якщо матеріалу більше, лиши найсильніше.` : "Довжину не обмежуй: лиши все, що по суті.";
    let keep = null;
    try {
      const r = await sample.json(`Ти монтажер коротких відео. Нижче дослівна розшифровка живого запису людини; кожне слово має номер.
${numbered(ws)}

Зроби з цього чітку, зв'язну розповідь для Reels, яка звучить так, ніби людина з першого разу все чітко сказала. Ти можеш ТІЛЬКИ вирізати й переставляти шматки — додавати слова не можна.
Виріж: слова-паразити (ну, типу, коротше, е-е, як би, значить, от), повтори й фальстарти (коли людина почала фразу і перезапустила — лиши останній, вдалий варіант), обірвані слова, відступи не по темі, «зараз скажу», «як я вже казав».
Кожен шматок, що лишається, має бути граматично цілим. Найсильнішу думку, якщо вона звучить як хук, можна поставити на початок — лише якщо це природно звучить.
${goal}
Відповідай тільки JSON: {"keep":[[від,до],...]} — діапазони номерів слів (включно) у тому порядку, в якому вони мають звучати.`, { cache: false, quiet: false });
      keep = Array.isArray(r?.keep) ? r.keep : null;
    } catch (e) { keep = null; }
    const used = new Set(), order = [];
    if (keep) for (const [a, b] of keep) for (let i = Math.max(0, a | 0); i <= Math.min(n - 1, b | 0); i++) if (!used.has(i)) { used.add(i); order.push(i); }
    if (!order.length) for (let i = 0; i < n; i++) if (!FILLERS.test(norm(ws[i]))) { used.add(i); order.push(i); }
    // показуємо все: вибране — у новому порядку, вирізане — закреслене поруч зі своїм місцем
    TOK = []; const placed = new Set();
    const pos = new Map(order.map((i, k) => [i, k]));
    order.forEach((i) => { // перед словом — вирізані слова, що стояли безпосередньо перед ним в оригіналі
      let j = i - 1; const pre = []; while (j >= 0 && !used.has(j) && !placed.has(j)) { pre.unshift(j); j--; }
      pre.forEach((q) => { TOK.push({ src: 0, i: q, cut: true }); placed.add(q); }); TOK.push({ src: 0, i, cut: false }); placed.add(i); });
    for (let i = 0; i < n; i++) if (!placed.has(i)) TOK.push({ src: 0, i, cut: true });
    void pos;
  }

  async function aiEdit(cmdText, cmdSrc) {
    const vis = TOK.map((t, k) => ({ t, k })).filter((o) => !o.t.cut);
    const cur = vis.map((o) => `${o.k}:${SRC[o.t.src].words[o.t.i].w}`).join(" ");
    const cw = cmdSrc ? cmdSrc.words.map((w) => w.w) : null;
    const r = await sample.json(`Ти монтажер. Є поточний змонтований текст (живий голос людини), кожне слово з номером:
${cur}

Людина ${cmdSrc ? "записала голосову правку" : "написала правку"}${cmdSrc ? ` (кожне слово з номером):\n${numbered(cw)}` : `:\n«${cmdText}»`}

Зрозумій, що треба змінити. Операції:
- {"op":"delete","start":N,"end":M} — вирізати слова поточного тексту з N по M включно;
${cmdSrc ? `- {"op":"insert","after":N,"from":A,"to":B} — вставити після слова N (або -1 — на самий початок) шматок ГОЛОСОВОЇ ПРАВКИ зі словами A..B (тільки сам новий зміст, без службових слів на кшталт «додай після фрази…», «заміни на»);
- {"op":"replace","start":N,"end":M,"from":A,"to":B} — замінити слова N..M шматком голосової правки A..B;` : `- вставляти нове не можна (немає запису голосу) — якщо людина просить додати текст, поверни порожні ops і попроси записати голосом;`}
- {"op":"move","start":N,"end":M,"after":K} — перенести слова N..M після слова K (-1 — на початок).
Місце шукай за змістом, навіть якщо людина процитувала фразу неточно. Якщо просить «коротше» — виріж найслабше.
Відповідай тільки JSON: {"ops":[...],"say":"одне коротке речення українською — що зроблено або що незрозуміло"}`, { cache: false });
    const ops = Array.isArray(r?.ops) ? r.ops : [];
    if (!ops.length) return r?.say || "Не зрозумів правку. Спробуй сказати інакше: «після фрази … додай …».";
    pushHist();
    const N = TOK.length, cut = new Set(), insAfter = new Map(), moves = [];
    const okI = (v) => Number.isInteger(v) && v >= -1 && v < N;
    const piece = (a, b) => { if (!cmdSrc) return []; const out = []; for (let i = Math.max(0, a | 0); i <= Math.min(cmdSrc.words.length - 1, b | 0); i++) out.push({ src: cmdSrc.id, i, cut: false, ins: true }); return out; };
    const addIns = (k, arr) => { if (!arr.length) return; insAfter.set(k, [...(insAfter.get(k) || []), ...arr]); };
    for (const o of ops) {
      if (o.op === "delete" && okI(o.start) && okI(o.end)) for (let k = o.start; k <= o.end; k++) cut.add(k);
      else if (o.op === "insert" && okI(o.after)) addIns(o.after, piece(o.from, o.to));
      else if (o.op === "replace" && okI(o.start) && okI(o.end)) { for (let k = o.start; k <= o.end; k++) cut.add(k); addIns(o.end, piece(o.from, o.to)); }
      else if (o.op === "move" && okI(o.start) && okI(o.end) && okI(o.after)) moves.push(o);
    }
    let out = []; const startIns = insAfter.get(-1) || []; out.push(...startIns);
    TOK.forEach((t, k) => { out.push(cut.has(k) ? { ...t, cut: true } : t); out.push(...(insAfter.get(k) || [])); });
    for (const m of moves) { const seg = TOK.slice(m.start, m.end + 1); out = out.filter((t) => !seg.includes(t)); const anchor = m.after >= 0 ? TOK[m.after] : null; const at = anchor ? out.indexOf(anchor) + 1 : 0; out.splice(at, 0, ...seg); }
    TOK = out; return r?.say || "Готово.";
  }

  /* ================= ЗАПИС ================= */
  async function record(btn, label, onBuf) {
    if (btn._rec) { btn._rec.stop(); return; }
    let stream = null;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); } catch (e) {}
    if (!stream) { say("Немає доступу до мікрофона — дозволь його в налаштуваннях браузера"); return; }
    const mime = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : {}), ch = []; btn._rec = rec;
    rec.ondataavailable = (e) => e.data.size && ch.push(e.data);
    const t0 = Date.now(), tick = () => { const s = Math.floor((Date.now() - t0) / 1000); btn.innerHTML = `<i class="tkdot"></i> Зупинити · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; if (s >= 240) rec.stop(); };
    const tm = setInterval(tick, 400); tick(); btn.classList.add("rec");
    rec.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); clearInterval(tm); btn._rec = null; btn.classList.remove("rec"); btn.innerHTML = label;
      onBuf(await new Blob(ch, { type: rec.mimeType || mime }).arrayBuffer()); };
    rec.start();
  }

  /* ================= ПЛЕЄР ================= */
  let PL = null;
  function stop() { if (PL) { try { PL.src.stop(); } catch (e) {} cancelAnimationFrame(PL.raf); PL = null; } UI.root?.querySelectorAll(".tkw.now").forEach((w) => w.classList.remove("now")); const b = UI.root && $(UI.root, "#tkplay"); if (b) b.innerHTML = ICON.play; }
  function play(data, from = 0, hl = true) {
    stop(); const ac = AC(); ac.resume?.(); const b = ac.createBuffer(1, data.length, SR); b.copyToChannel(data, 0);
    const src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); const t0 = ac.currentTime - from; src.start(0, from);
    PL = { src, t0, len: data.length / SR, hl }; src.onended = () => { if (PL?.src === src) stop(); };
    $(UI.root, "#tkplay").innerHTML = ICON.pause;
    const loop = () => { if (!PL) return; const t = ac.currentTime - PL.t0, bar = $(UI.root, "#tkbar i"); if (bar) bar.style.width = Math.min(100, t / PL.len * 100) + "%";
      const tt = $(UI.root, "#tktime"); if (tt) tt.textContent = `${fmt(t)} / ${fmt(PL.len)}`;
      if (PL.hl) { const m = MAP.find((o) => t >= o.s - .02 && t < o.e + .05); UI.root.querySelectorAll(".tkw.now").forEach((w) => w.classList.remove("now")); if (m) UI.root.querySelector(`.tkw[data-k="${TOK.indexOf(m.tok)}"]`)?.classList.add("now"); }
      PL.raf = requestAnimationFrame(loop); }; loop();
  }
  const fmtS = (v, u = "") => (+v > 0 ? "+" : "") + (+v || 0) + u + (u ? "" : " тону");
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

  /* ================= ІНТЕРФЕЙС ================= */
  const ICON = {
    play: `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M7 4.5v15l13-7.5z" fill="currentColor"/></svg>`,
    pause: `<svg viewBox="0 0 24 24" width="22" height="22"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor"/></svg>`,
    mic: `<svg viewBox="0 0 24 24" width="22" height="22"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  };
  const UI = { root: null };
  const CSS = `
#yvtalk{position:fixed;inset:0;z-index:9000;background:#0b0b0d;color:#f5f5f7;display:flex;flex-direction:column;font:15px/1.45 var(--pfont,system-ui,-apple-system,sans-serif);padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
#yvtalk .tkh{display:flex;align-items:center;justify-content:space-between;padding:12px 16px 6px}#yvtalk .tkh b{font-size:17px}
#yvtalk .tkx{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font-size:20px;cursor:pointer}
#yvtalk .tkb{flex:1;overflow-y:auto;padding:6px 16px 16px;-webkit-overflow-scrolling:touch}
#yvtalk .tkf{padding:10px 16px 14px;display:grid;gap:8px;border-top:1px solid rgba(255,255,255,.08);background:#0b0b0d}
#yvtalk .tkhint{color:#a1a1aa;font-size:13.5px;margin:4px 0 14px}
#yvtalk .tkbig{width:132px;height:132px;border-radius:50%;margin:26px auto 14px;display:grid;place-items:center;border:0;cursor:pointer;color:#0b0b0d;background:radial-gradient(circle at 35% 30%,#fff,#e8e8ea);box-shadow:0 0 0 10px rgba(255,255,255,.06),0 20px 50px -10px rgba(0,0,0,.8)}
#yvtalk .tkbig svg{width:48px;height:48px}#yvtalk .tkbig.rec{background:#ff453a;color:#fff;animation:tkp 1.4s infinite}
@keyframes tkp{50%{box-shadow:0 0 0 22px rgba(255,69,58,.12),0 20px 50px -10px rgba(0,0,0,.8)}}
#yvtalk .tkst{text-align:center;font-weight:600;min-height:22px}
#yvtalk .tkrow{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:12px 0}
#yvtalk .tkc{padding:7px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#e4e4e7;font:600 13px inherit;cursor:pointer}
#yvtalk .tkc[aria-pressed=true]{background:#f5f5f7;color:#0b0b0d}
#yvtalk .tkbtn{width:100%;padding:13px;border-radius:16px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#f5f5f7;font:700 15px inherit;cursor:pointer;display:flex;gap:8px;align-items:center;justify-content:center}
#yvtalk .tkbtn.main{background:#f5f5f7;color:#0b0b0d;border-color:transparent}
#yvtalk .tkbtn.rec{background:#ff453a;border-color:transparent}#yvtalk .tkdot{width:9px;height:9px;border-radius:50%;background:#fff;display:inline-block}
#yvtalk .tk2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#yvtalk .tkpl{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);position:sticky;top:0;z-index:2;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
#yvtalk #tkplay{width:46px;height:46px;border-radius:50%;border:0;background:#f5f5f7;color:#0b0b0d;display:grid;place-items:center;cursor:pointer;flex:none}
#yvtalk #tkbar{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}#yvtalk #tkbar i{display:block;height:100%;width:0;background:#f5f5f7}
#yvtalk .tkmeta{display:flex;justify-content:space-between;color:#a1a1aa;font-size:12.5px;margin:8px 2px 12px;gap:8px}
#yvtalk .tktxt{font-size:19px;line-height:1.75;user-select:none;-webkit-user-select:none}
#yvtalk .tkw{padding:2px 1px;border-radius:6px;cursor:pointer;transition:background .15s}
#yvtalk .tkw.cut{color:#5b5b63;text-decoration:line-through;font-size:15px}
#yvtalk .tkw.ins{background:rgba(52,208,122,.18);color:#bdf5cf}
#yvtalk .tkw.now{background:#ffd60a;color:#0b0b0d}
#yvtalk .tkw.sel{outline:2px solid #ffd60a}
#yvtalk .tkleg{display:flex;gap:12px;flex-wrap:wrap;color:#a1a1aa;font-size:12px;margin-top:14px}#yvtalk .tkleg s{color:#5b5b63}#yvtalk .tkleg em{font-style:normal;color:#bdf5cf;background:rgba(52,208,122,.18);border-radius:4px;padding:0 4px}
#yvtalk .tkpop{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 150px);z-index:9001;background:rgba(28,28,32,.97);border:1px solid rgba(255,255,255,.14);border-radius:18px;padding:10px;display:grid;gap:6px;box-shadow:0 20px 50px rgba(0,0,0,.6)}
#yvtalk .tkpop .tkq{color:#a1a1aa;font-size:12.5px;padding:2px 4px}
#yvtalk .tkmsg{margin:10px 0 0;padding:10px 12px;border-radius:14px;background:rgba(255,214,10,.1);border:1px solid rgba(255,214,10,.3);color:#ffe27a;font-size:13.5px}
#yvtalk textarea{width:100%;min-height:60px;padding:10px 12px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#f5f5f7;font:15px inherit;resize:none}
#yvtalk .tkfx{margin:12px 0 4px;padding:10px 12px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}
#yvtalk .tkfxh{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}#yvtalk .tkfxh b{font-size:13.5px}
#yvtalk .tkfxr{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}#yvtalk .tkfxr::-webkit-scrollbar{display:none}#yvtalk .tkfxr .tkc{flex:none}
#yvtalk .tkfxs{display:grid;gap:2px;margin-top:10px}#yvtalk .tkfxs label{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:13px;font-weight:600}#yvtalk .tkfxs label span{text-align:right;color:#a1a1aa;font-weight:500}
#yvtalk .tkfxs input{grid-column:1/-1;width:100%;accent-color:#f5f5f7}#yvtalk .tkfxs small{display:flex;justify-content:space-between;color:#71717a;font-size:11px;margin:-2px 0 6px}
#yvtalk .tkdev{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:999px;background:#ff9f0a;color:#0b0b0d;font-size:10.5px;font-weight:800;vertical-align:2px}`;

  function shell(title) {
    if (!document.getElementById("yvtalkcss")) { const st = document.createElement("style"); st.id = "yvtalkcss"; st.textContent = CSS; document.head.appendChild(st); }
    UI.root?.remove(); const d = document.createElement("div"); d.id = "yvtalk";
    d.innerHTML = `<div class="tkh"><b>${title}<span class="tkdev">ТЕСТ</span></b><button class="tkx" type="button" aria-label="Закрити">×</button></div><div class="tkb"></div><div class="tkf"></div>`;
    document.body.appendChild(d); UI.root = d; $(d, ".tkx").onclick = close; return d;
  }
  function close() { stop(); UI.root?.remove(); UI.root = null; }
  async function busyRun(kind, fn) { if (window.yvBusy) yvBusy.start(kind); let ok = false; try { const v = await fn(); ok = true; return v; } finally { if (window.yvBusy) yvBusy.end(ok); } }

  function screenRecord() {
    const d = shell("Розкажи своїми словами"), B = $(d, ".tkb"), F = $(d, ".tkf");
    B.innerHTML = `<p class="tkhint">Говори як зручно — з паузами, «ну», повторами, збився і почав знову. Усе зайве приберемо, звук вирівняємо. Голос лишиться твій, живий.</p>
      <button class="tkbig" type="button" id="tkrec" aria-label="Записати">${ICON.mic}</button><div class="tkst" id="tkst">Натисни і говори</div>
      <div class="tkrow" role="group" aria-label="Довжина">${[["Як вийде", 0], ["≈30 с", 30], ["≈45 с", 45], ["≈60 с", 60], ["≈90 с", 90]].map(([l, v]) => `<button class="tkc" type="button" data-tg="${v}" aria-pressed="${v === TARGET}">${l}</button>`).join("")}</div>
      <p class="tkhint" style="text-align:center">До 4 хвилин. Краще в тихому місці, телефон на звичайній відстані.</p>`;
    F.innerHTML = `<label class="tkbtn" for="tkfile">Або завантажити аудіо чи відео</label><input type="file" id="tkfile" accept="audio/*,video/*" hidden>`;
    B.querySelectorAll("[data-tg]").forEach((b) => b.onclick = () => { TARGET = +b.dataset.tg; B.querySelectorAll("[data-tg]").forEach((o) => o.setAttribute("aria-pressed", o === b)); });
    const rb = $(B, "#tkrec");
    rb.onclick = () => { if (!rb._rec) $(B, "#tkst").textContent = "Говори… натисни ще раз, щоб завершити"; record(rb, ICON.mic, start); };
    $(F, "#tkfile").onchange = async (e) => { const f = e.target.files?.[0]; if (f) start(await f.arrayBuffer()); };
  }

  async function start(buf) {
    SRC = []; TOK = []; HIST = []; REFPROF = null;
    try {
      const raw = await busyRun("voice", () => decode(buf));
      if (raw.length < SR * 1.5) { say("Запис закороткий"); return; }
      if (raw.length > SR * 245) { say("Запис задовгий — до 4 хвилин"); return; }
      ORIG = raw;
      await busyRun("voice", async () => { await new Promise((r) => setTimeout(r, 30)); return addSourceProcessOnly(raw); });
      await busyRun("listen", () => transcribe(SRC[0]));
      if (!SRC[0].words.length) { say("Не почув слів — спробуй ще раз"); return; }
      await aiClean(); render(); screenEdit();
    } catch (e) { console.error(e); say(e?.message === "login" ? "Спочатку увійди" : e?.message === "limit" ? "Ліміт на сьогодні вичерпано" : "Не вийшло обробити запис. Спробуй ще раз."); }
  }
  async function addSourceProcessOnly(raw, isInsert) {
    const x = await processTake(raw, isInsert ? REFPROF : null); if (!isInsert) REFPROF = bandProfile(x);
    const src = { id: SRC.length, x, words: [] }; SRC.push(src); return src;
  }
  async function transcribe(src) {
    const small = await resample(src.x, SR, 16000);
    const r = await SRV.stt({ audio: b64(wav(small, 16000)), mime: "audio/wav", quiet: true });
    const dur = src.x.length / SR;
    src.words = (r.words || []).map((w) => ({ w: String(w.w), s: Math.max(0, +w.s || 0), e: Math.min(dur, Math.max((+w.s || 0) + .05, +w.e || 0)) })).filter((w) => w.w.trim());
  }

  function screenEdit(msg) {
    const d = UI.root && UI.root.querySelector(".tktxt") ? UI.root : shell("Твій голос, змонтований"), B = $(d, ".tkb"), F = $(d, ".tkf");
    const was = ORIG ? ORIG.length / SR : 0, now = OUT.length / SR, cutN = TOK.filter((t) => t.cut).length;
    B.innerHTML = `<div class="tkpl"><button id="tkplay" type="button" aria-label="Слухати">${ICON.play}</button><div style="flex:1"><div id="tkbar"><i></i></div><div class="tkmeta" style="margin:6px 0 0"><span id="tktime">0:00 / ${fmt(now)}</span><button class="tkc" type="button" id="tkorig" style="padding:3px 9px;font-size:11.5px">Як було</button></div></div></div>
      <div class="tkmeta"><span>Було ${fmt(was)} → стало <b style="color:#f5f5f7">${fmt(now)}</b></span><span>вирізано слів: ${cutN}</span></div>
      <div class="tkfx"><div class="tkfxh"><b>Звучання голосу</b><button type="button" class="tkc" id="tkfxm" style="padding:3px 9px;font-size:11.5px">Тонко ▾</button></div>
        <div class="tkfxr">${Object.entries(FXP).map(([k, P]) => `<button type="button" class="tkc" data-fx="${k}" aria-pressed="${FX.k === k}">${P.n}</button>`).join("")}</div>
        <div class="tkfxs" hidden><label>Висота <span id="tkpv">${fmtS(FX.pitch)}</span><input type="range" id="tkpitch" min="-2" max="2" step=".5" value="${FX.pitch}"></label><small><span>грубше</span><span>дзвінкіше</span></small>
          <label>Тембр <span id="tktv">${fmtS(FX.tone, " дБ")}</span><input type="range" id="tktone" min="-6" max="6" step="1" value="${FX.tone}"></label><small><span>м'якше</span><span>яскравіше</span></small></div></div>
      ${msg ? `<div class="tkmsg">${escH(msg)}</div>` : ""}
      <div class="tktxt" style="margin-top:12px">${TOK.map((t, k) => `<span class="tkw${t.cut ? " cut" : ""}${t.ins ? " ins" : ""}" data-k="${k}">${escH(SRC[t.src].words[t.i].w)}</span>`).join(" ")}</div>
      <div class="tkleg"><span>Тапни слово — щоб вирізати, повернути або вставити після нього</span><s>вирізано</s><em>додано правкою</em></div>`;
    F.innerHTML = `<div class="tk2"><button class="tkbtn" type="button" id="tkvoice">${ICON.mic} Сказати правку</button><button class="tkbtn" type="button" id="tkwrite">✍ Написати</button></div>
      <div class="tk2"><button class="tkbtn" type="button" id="tkundo"${HIST.length ? "" : " disabled style=\"opacity:.4\""}>↶ Скасувати</button><button class="tkbtn" type="button" id="tkagain">Записати заново</button></div>
      <button class="tkbtn main" type="button" id="tkdone">Влаштовує → до розкадровки</button>`;
    $(B, "#tkplay").onclick = async () => { if (PL) stop(); else play(await fxOut(), 0, true); };
    $(B, "#tkorig").onclick = () => { if (PL) stop(); else play(ORIG, 0, false); };
    B.querySelectorAll(".tkw").forEach((w) => w.onclick = () => wordMenu(+w.dataset.k, w));
    // звучання: змінюєш — одразу чуєш (з того ж місця)
    const reFx = async () => { saveFx(); const was = PL ? AC().currentTime - PL.t0 : null; stop(); const d = await fxOut(); play(d, was != null ? Math.min(was, d.length / SR - .1) : 0, true); };
    B.querySelectorAll("[data-fx]").forEach((b) => b.onclick = () => { FX.k = b.dataset.fx; B.querySelectorAll("[data-fx]").forEach((o) => o.setAttribute("aria-pressed", o === b)); reFx(); });
    $(B, "#tkfxm").onclick = () => { const s = $(B, ".tkfxs"); s.hidden = !s.hidden; $(B, "#tkfxm").textContent = s.hidden ? "Тонко ▾" : "Сховати ▴"; };
    const sl = (id, key, lab, u) => { const r = $(B, id); r.oninput = () => { FX[key] = +r.value; $(B, lab).textContent = fmtS(FX[key], u); }; r.onchange = reFx; };
    sl("#tkpitch", "pitch", "#tkpv", ""); sl("#tktone", "tone", "#tktv", " дБ");
    $(F, "#tkundo").onclick = () => { if (!HIST.length) return; stop(); TOK = JSON.parse(HIST.pop()); render(); screenEdit("Скасовано."); };
    $(F, "#tkagain").onclick = () => { stop(); screenRecord(); };
    $(F, "#tkwrite").onclick = writeEdit;
    const vb = $(F, "#tkvoice"), lbl = vb.innerHTML;
    vb.onclick = () => { stop(); if (!vb._rec) say("Кажи правку, напр.: «після фрази … додай …»"); record(vb, lbl, voiceEdit); };
    $(F, "#tkdone").onclick = done;
  }

  function wordMenu(k, el) {
    stop(); UI.root.querySelectorAll(".tkpop").forEach((p) => p.remove()); UI.root.querySelectorAll(".tkw.sel").forEach((w) => w.classList.remove("sel")); el.classList.add("sel");
    const t = TOK[k], p = document.createElement("div"); p.className = "tkpop";
    p.innerHTML = `<div class="tkq">«${escH(SRC[t.src].words[t.i].w)}»</div><div class="tk2"><button class="tkbtn" type="button" data-a="cut">${t.cut ? "Повернути" : "Вирізати"}</button><button class="tkbtn" type="button" data-a="sent">${t.cut ? "Повернути до крапки" : "Вирізати до крапки"}</button></div>
      <div class="tk2"><button class="tkbtn" type="button" data-a="ins">${ICON.mic} Вставити після</button><button class="tkbtn" type="button" data-a="from">▶ Слухати звідси</button></div><button class="tkbtn" type="button" data-a="x">Закрити</button>`;
    UI.root.appendChild(p);
    const closeP = () => { p.remove(); el.classList.remove("sel"); };
    p.querySelector('[data-a="x"]').onclick = closeP;
    p.querySelector('[data-a="cut"]').onclick = () => { pushHist(); t.cut = !t.cut; closeP(); render(); screenEdit(); };
    p.querySelector('[data-a="sent"]').onclick = () => { pushHist(); const to = !t.cut; for (let j = k; j < TOK.length; j++) { TOK[j].cut = to; if (/[.!?…]$/.test(SRC[TOK[j].src].words[TOK[j].i].w)) break; } closeP(); render(); screenEdit(); };
    p.querySelector('[data-a="from"]').onclick = () => { closeP(); let m = MAP.find((o) => o.tok === t); if (!m) { for (let j = k; j < TOK.length && !m; j++) m = MAP.find((o) => o.tok === TOK[j]); } fxOut().then((d) => play(d, m ? Math.max(0, m.s - .05) : 0, true)); };
    const ib = p.querySelector('[data-a="ins"]'), il = ib.innerHTML;
    ib.onclick = () => { if (!ib._rec) p.querySelector(".tkq").textContent = "Говори тільки те, що вставити. Натисни ще раз, щоб завершити."; record(ib, il, async (buf) => {
      closeP();
      try { const raw = await busyRun("voice", () => decode(buf)); const src = await busyRun("voice", () => addSourceProcessOnly(raw, true)); await busyRun("listen", () => transcribe(src));
        const ws = src.words.map((w, i) => i).filter((i) => !FILLERS.test(norm(src.words[i].w)));
        if (!ws.length) { say("Не почув слів"); return; }
        pushHist(); TOK.splice(k + 1, 0, ...ws.map((i) => ({ src: src.id, i, cut: false, ins: true }))); render(); screenEdit("Вставлено. Послухай, як звучить.");
      } catch (e) { say("Не вийшло — спробуй ще раз"); } }); };
  }

  async function voiceEdit(buf) {
    try {
      const raw = await busyRun("voice", () => decode(buf)); const src = await busyRun("voice", () => addSourceProcessOnly(raw, true)); await busyRun("listen", () => transcribe(src));
      if (!src.words.length) { say("Не почув правку"); return; }
      const m = await aiEdit("", src); render(); screenEdit(m);
    } catch (e) { console.error(e); say("Не вийшло застосувати правку"); }
  }
  function writeEdit() {
    UI.root.querySelectorAll(".tkpop").forEach((p) => p.remove());
    const p = document.createElement("div"); p.className = "tkpop";
    p.innerHTML = `<div class="tkq">Що змінити? Напр.: «прибери частину про ТікТок», «зроби коротше до 30 секунд», «почни з фрази про підписників»</div><textarea id="tkcmd" rows="3"></textarea><div class="tk2"><button class="tkbtn" type="button" data-a="x">Скасувати</button><button class="tkbtn main" type="button" data-a="go">Застосувати</button></div>`;
    UI.root.appendChild(p); const ta = $(p, "#tkcmd"); setTimeout(() => ta.focus(), 50);
    p.querySelector('[data-a="x"]').onclick = () => p.remove();
    p.querySelector('[data-a="go"]').onclick = async () => { const v = ta.value.trim(); if (!v) return; p.remove();
      try { const m = await aiEdit(v, null); render(); screenEdit(m); } catch (e) { say("Не вийшло застосувати правку"); } };
  }

  let ONDONE = null;
  async function done() {
    stop(); const FINAL = await fxOut(); const text = TOK.filter((t) => !t.cut).map((t) => SRC[t.src].words[t.i].w).join(" ").replace(/\s+([,.!?…:;])/g, "$1");
    const sentences = text.replace(/([.!?…])\s+/g, "$1\n").split("\n").map((l) => l.charAt(0).toUpperCase() + l.slice(1)).join("\n");
    const cb = ONDONE; close(); cb?.({ text: sentences, wav: wav(FINAL), seconds: FINAL.length / SR });
  }

  window.YVTalk = { open(opts = {}) { ONDONE = opts.onDone || null; TARGET = opts.target ?? TARGET; screenRecord(); },
    _t: { SR, decode, resample, wav, b64, snap, envelope, record, busyRun, FILLERS, norm, bandProfile, applyFxTo: async (x, fx) => { const keep = FX; FX = fx; try { return await applyFx(x); } finally { FX = keep; } }, FXP, getFx: () => FX, denoise, levelPhrases, voiceChain, master, processTake, render: () => render(), set: (s, t) => { SRC = s; TOK = t; }, out: () => OUT, map: () => MAP, aiClean, aiEdit, voiceEdit: (b) => voiceEdit(b), tok: () => TOK, screenEdit: (m) => screenEdit(m), setOrig: (o) => ORIG = o } };
})();
