// Section S (+ copie de T.2) : atelier d'écriture sur <canvas> à 3 niveaux et calcul de précision du tracé.
// Niveau 1 : rail guidé avec flèches · Niveau 2 : pointillés · Niveau 3 : points repères seuls.
import { h, btn } from './util.js';
import { speak } from '../speech.js';
import { recordTrial, childName } from './aba.js';
import { praise } from './widgets.js';

const TOLERANCE = 20;
const WIDE_TOLERANCE = 30; // couloir large pour les courbes (tolérance à la dyspraxie fine)
const PASS_SCORE = 70;

function arc(cx, cy, rx, ry, from, to, n = 24) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)];
  });
}

// Lettres capitales en traits (coordonnées 0..1 dans la case).
const LETTERS = {
  A: [[[0.1, 1], [0.5, 0], [0.9, 1]], [[0.28, 0.6], [0.72, 0.6]]],
  B: [[[0.15, 1], [0.15, 0], [0.6, 0], [0.8, 0.12], [0.8, 0.36], [0.6, 0.48], [0.15, 0.48]], [[0.6, 0.48], [0.85, 0.62], [0.85, 0.86], [0.65, 1], [0.15, 1]]],
  C: [arc(0.55, 0.5, 0.4, 0.5, -45, -315)],
  D: [[[0.15, 0], [0.15, 1]], arc(0.15, 0.5, 0.7, 0.5, -90, 90)],
  E: [[[0.85, 0], [0.15, 0], [0.15, 1], [0.85, 1]], [[0.15, 0.5], [0.7, 0.5]]],
  F: [[[0.85, 0], [0.15, 0], [0.15, 1]], [[0.15, 0.5], [0.7, 0.5]]],
  G: [arc(0.55, 0.5, 0.4, 0.5, -45, -360), [[0.55, 0.55], [0.92, 0.55], [0.92, 0.85]]],
  H: [[[0.15, 0], [0.15, 1]], [[0.85, 0], [0.85, 1]], [[0.15, 0.5], [0.85, 0.5]]],
  I: [[[0.5, 0], [0.5, 1]]],
  J: [[[0.75, 0], [0.75, 0.7], ...arc(0.5, 0.7, 0.25, 0.3, 0, 180).slice(1)]],
  K: [[[0.15, 0], [0.15, 1]], [[0.85, 0], [0.15, 0.55]], [[0.35, 0.42], [0.85, 1]]],
  L: [[[0.15, 0], [0.15, 1], [0.85, 1]]],
  M: [[[0.1, 1], [0.1, 0], [0.5, 0.6], [0.9, 0], [0.9, 1]]],
  N: [[[0.15, 1], [0.15, 0], [0.85, 1], [0.85, 0]]],
  O: [arc(0.5, 0.5, 0.38, 0.5, -90, -450, 32)],
  P: [[[0.15, 1], [0.15, 0], [0.6, 0], [0.8, 0.13], [0.8, 0.37], [0.6, 0.5], [0.15, 0.5]]],
  Q: [arc(0.5, 0.5, 0.38, 0.5, -90, -450, 32), [[0.6, 0.7], [0.9, 1]]],
  R: [[[0.15, 1], [0.15, 0], [0.6, 0], [0.8, 0.13], [0.8, 0.37], [0.6, 0.5], [0.15, 0.5]], [[0.45, 0.5], [0.85, 1]]],
  S: [[[0.82, 0.12], [0.6, 0], [0.35, 0], [0.15, 0.15], [0.2, 0.38], [0.5, 0.5], [0.8, 0.62], [0.85, 0.85], [0.65, 1], [0.35, 1], [0.15, 0.88]]],
  T: [[[0.1, 0], [0.9, 0]], [[0.5, 0], [0.5, 1]]],
  U: [[[0.15, 0], [0.15, 0.65], ...arc(0.5, 0.65, 0.35, 0.35, 180, 0).slice(1), [0.85, 0]]],
  V: [[[0.1, 0], [0.5, 1], [0.9, 0]]],
  W: [[[0.05, 0], [0.28, 1], [0.5, 0.4], [0.72, 1], [0.95, 0]]],
  X: [[[0.15, 0], [0.85, 1]], [[0.85, 0], [0.15, 1]]],
  Y: [[[0.1, 0], [0.5, 0.5], [0.9, 0]], [[0.5, 0.5], [0.5, 1]]],
  Z: [[[0.15, 0], [0.85, 0], [0.15, 1], [0.85, 1]]],
};

export const SHAPES = {
  h: { label: '➖ Trait horizontal', strokes: [[[0.1, 0.5], [0.9, 0.5]]] },
  v: { label: '│ Trait vertical', strokes: [[[0.5, 0.1], [0.5, 0.9]]] },
  rond: { label: '⭕ Rond', strokes: [arc(0.5, 0.5, 0.38, 0.38, -90, -450, 40)] },
  zigzag: { label: '⚡ Zigzag', strokes: [[[0.05, 0.7], [0.2, 0.3], [0.35, 0.7], [0.5, 0.3], [0.65, 0.7], [0.8, 0.3], [0.95, 0.7]]] },
  creneaux: { label: '🏰 Créneaux', strokes: [[[0.05, 0.7], [0.05, 0.35], [0.25, 0.35], [0.25, 0.7], [0.45, 0.7], [0.45, 0.35], [0.65, 0.35], [0.65, 0.7], [0.85, 0.7], [0.85, 0.35], [0.95, 0.35]]] },
  boucles: { label: '➰ Boucles', strokes: [Array.from({ length: 97 }, (_, i) => { const t = (i / 96) * 4 * 2 * Math.PI; return [0.1 + (0.8 * i) / 96 + 0.07 * Math.cos(t + Math.PI), 0.55 - 0.18 * Math.abs(Math.sin(t / 2)) + 0.05 * Math.sin(t)]; })] },
  demi: { label: '🌈 Pont (demi-cercle)', strokes: [arc(0.5, 0.65, 0.38, 0.38, 180, 360, 24)] },
  vague: { label: '🌊 Vagues', strokes: [Array.from({ length: 49 }, (_, i) => [0.06 + (0.88 * i) / 48, 0.5 + 0.2 * Math.sin((i / 48) * 4 * Math.PI)])] },
  spirale: { label: '🐌 Spirale', strokes: [Array.from({ length: 73 }, (_, i) => { const t = i / 72; const r = 0.05 + 0.36 * t; const a = t * 5 * Math.PI; return [0.5 + r * Math.cos(a), 0.5 + r * Math.sin(a)]; })] },
};


// v7 (Aegon) : 26 lettres minuscules (a–z) en tracés normalisés (zone médiane 0.35..0.82, hampes 0.05, jambages 0.98).
export const LOWER_LETTERS = {
  a: [arc(0.46, 0.58, 0.28, 0.22, 0, 360, 28), [[0.74, 0.36], [0.74, 0.82]]],
  b: [[[0.24, 0.06], [0.24, 0.82]], arc(0.5, 0.58, 0.26, 0.22, -90, 90, 24)],
  c: [arc(0.56, 0.58, 0.3, 0.22, -45, -315, 24)],
  d: [arc(0.48, 0.58, 0.26, 0.22, 90, 270, 24), [[0.74, 0.06], [0.74, 0.82]]],
  e: [[[0.22, 0.56], [0.78, 0.56]], arc(0.5, 0.58, 0.28, 0.22, 0, -310, 28)],
  f: [...[arc(0.58, 0.22, 0.18, 0.16, 0, -180, 16)], [[0.4, 0.22], [0.4, 0.82]], [[0.22, 0.44], [0.64, 0.44]]],
  g: [arc(0.48, 0.56, 0.26, 0.2, 0, 360, 26), [[0.74, 0.36], [0.74, 0.82], ...arc(0.48, 0.82, 0.26, 0.16, 0, 160, 16).slice(1)]],
  h: [[[0.24, 0.06], [0.24, 0.82]], [[0.24, 0.52], ...arc(0.5, 0.52, 0.26, 0.16, 180, 360, 16).slice(1), [0.76, 0.82]]],
  i: [[[0.5, 0.36], [0.5, 0.82]], arc(0.5, 0.2, 0.04, 0.04, 0, 360, 10)],
  j: [[[0.56, 0.36], [0.56, 0.82], ...arc(0.38, 0.82, 0.18, 0.15, 0, 160, 14).slice(1)], arc(0.56, 0.2, 0.04, 0.04, 0, 360, 10)],
  k: [[[0.26, 0.06], [0.26, 0.82]], [[0.72, 0.38], [0.26, 0.6]], [[0.42, 0.52], [0.76, 0.82]]],
  l: [[[0.48, 0.06], [0.48, 0.74], [0.62, 0.82]]],
  m: [[[0.14, 0.36], [0.14, 0.82]], [[0.14, 0.5], ...arc(0.32, 0.5, 0.18, 0.14, 180, 360, 14).slice(1), [0.5, 0.82]], [[0.5, 0.5], ...arc(0.68, 0.5, 0.18, 0.14, 180, 360, 14).slice(1), [0.86, 0.82]]],
  n: [[[0.24, 0.36], [0.24, 0.82]], [[0.24, 0.52], ...arc(0.5, 0.52, 0.26, 0.16, 180, 360, 16).slice(1), [0.76, 0.82]]],
  o: [arc(0.5, 0.58, 0.28, 0.22, -90, -450, 28)],
  p: [[[0.24, 0.36], [0.24, 0.96]], arc(0.5, 0.58, 0.26, 0.22, -90, 90, 24)],
  q: [arc(0.48, 0.58, 0.26, 0.22, 90, 270, 24), [[0.74, 0.36], [0.74, 0.96]]],
  r: [[[0.28, 0.36], [0.28, 0.82]], [[0.28, 0.52], ...arc(0.52, 0.52, 0.24, 0.16, 180, 320, 14).slice(1)]],
  s: [[[0.72, 0.42], [0.52, 0.36], [0.3, 0.42], [0.32, 0.54], [0.68, 0.62], [0.7, 0.76], [0.48, 0.82], [0.26, 0.76]]],
  t: [[[0.48, 0.14], [0.48, 0.78], [0.66, 0.82]], [[0.26, 0.38], [0.7, 0.38]]],
  u: [[[0.24, 0.36], [0.24, 0.66], ...arc(0.5, 0.66, 0.26, 0.16, 180, 0, 16).slice(1), [0.76, 0.36], [0.76, 0.82]]],
  v: [[[0.2, 0.36], [0.5, 0.82], [0.8, 0.36]]],
  w: [[[0.1, 0.36], [0.3, 0.82], [0.5, 0.5], [0.7, 0.82], [0.9, 0.36]]],
  x: [[[0.22, 0.36], [0.78, 0.82]], [[0.78, 0.36], [0.22, 0.82]]],
  y: [[[0.22, 0.36], [0.5, 0.76]], [[0.78, 0.36], [0.32, 0.96]]],
  z: [[[0.22, 0.38], [0.78, 0.38], [0.22, 0.82], [0.78, 0.82]]],
};

const cleanWord = (word, preserveCase = false) => {
  const norm = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return preserveCase ? norm.replace(/[^A-Za-z]/g, '') : norm.toUpperCase().replace(/[^A-Z]/g, '');
};

function densify(polyline, step = 4) {
  const out = [];
  for (let i = 0; i < polyline.length - 1; i += 1) {
    const [x1, y1] = polyline[i]; const [x2, y2] = polyline[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step));
    for (let k = 0; k < n; k += 1) out.push([x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n]);
  }
  out.push(polyline[polyline.length - 1]);
  return out;
}

function layout(spec, width) {
  if (spec.word) {
    const preserve = Boolean(spec.preserveCase || /^[a-z]+$/.test(spec.word));
    const letters = [...cleanWord(spec.word, preserve)];
    const bw = Math.min(110, (width - 20) / Math.max(1, letters.length));
    const bh = bw * 1.25;
    const left = (width - letters.length * bw) / 2;
    const boxes = letters.map((letter, i) => ({
      x: left + i * bw, y: 14, w: bw, h: bh,
      strokes: LOWER_LETTERS[letter] || LETTERS[letter.toUpperCase()] || [],
    }));
    return { height: bh + 28, boxes };
  }
  const size = Math.min(width - 20, 300);
  return { height: size + 20, boxes: [{ x: (width - size) / 2, y: 10, w: size, h: size, strokes: spec.strokes }] };
}

// Convertit les traits unitaires de chaque case en pixels (marge de 15 %).
function targetStrokes(boxes) {
  return boxes.flatMap((b) => b.strokes.map((stroke) => stroke.map(([u, v]) => [b.x + b.w * (0.15 + 0.7 * u), b.y + b.h * (0.1 + 0.8 * v)])));
}

function drawArrow(g, [x1, y1], [x2, y2]) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.save(); g.translate(x1, y1); g.rotate(a);
  g.fillStyle = '#1F6F5C';
  g.beginPath(); g.moveTo(14, 0); g.lineTo(2, -7); g.lineTo(2, 7); g.closePath(); g.fill();
  g.restore();
}

function drawGuides(g, strokes, level, tolerance) {
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const stroke of strokes) {
    if (level === 1) {
      g.strokeStyle = 'rgba(79,195,184,.35)'; g.lineWidth = tolerance * 2 - 6; g.setLineDash([]);
      g.beginPath(); stroke.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      drawArrow(g, stroke[0], stroke[Math.min(3, stroke.length - 1)]);
    }
    if (level === 2) {
      g.strokeStyle = 'rgba(94,107,102,.7)'; g.lineWidth = 4; g.setLineDash([2, 10]);
      g.beginPath(); stroke.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      g.setLineDash([]);
    }
    g.fillStyle = 'rgba(67,160,71,.25)';
    g.beginPath(); g.arc(stroke[0][0], stroke[0][1], 15, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#43A047';
    g.beginPath(); g.arc(stroke[0][0], stroke[0][1], 8, 0, Math.PI * 2); g.fill();
    const end = stroke[stroke.length - 1];
    g.font = '22px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('⭐', end[0], end[1]);
  }
}

const nearest = (point, points) => points.reduce((best, p) => Math.min(best, Math.hypot(p[0] - point[0], p[1] - point[1])), Infinity);

// Précision = part du tracé proche du modèle ; couverture = part du modèle parcourue. Score = le plus faible des deux.
export function traceScore(target, user, tolerance = TOLERANCE) {
  if (!user.length) return 0;
  const precision = user.filter((p) => nearest(p, target) <= tolerance).length / user.length;
  const coverage = target.filter((p) => nearest(p, user) <= tolerance).length / target.length;
  return Math.round(100 * Math.min(precision, coverage));
}

// spec : { strokes } pour une forme, ou { word } pour copier un mot.
export function writingPad(spec, level, tolerance = TOLERANCE) {
  const canvas = h('canvas', { class: 'write-pad' });
  const user = [];
  let strokes = [];
  let target = [];
  let current = null;
  let ready = false;
  const setup = () => {
    const width = Math.min(canvas.parentElement ? canvas.parentElement.clientWidth : 340, 560) || 340;
    const { height, boxes } = layout(spec, width);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr; canvas.height = height * dpr;
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    strokes = targetStrokes(boxes);
    target = strokes.flatMap((s) => densify(s));
    ready = true;
    redraw();
  };
  const redraw = () => {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, canvas.width, canvas.height);
    drawGuides(g, strokes, level, tolerance);
    g.strokeStyle = '#1F6F5C'; g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round'; g.setLineDash([]);
    for (const line of [...user, current].filter(Boolean)) {
      g.beginPath(); line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    }
  };
  const point = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.style.touchAction = 'none';
  canvas.onpointerdown = (e) => { if (!ready) setup(); canvas.setPointerCapture(e.pointerId); current = [point(e)]; };
  canvas.onpointermove = (e) => { if (!current) return; current.push(point(e)); redraw(); };
  canvas.onpointerup = () => { if (current) user.push(current); current = null; redraw(); };
  requestAnimationFrame(setup);
  return {
    element: canvas,
    clear: () => { user.length = 0; redraw(); },
    score: () => traceScore(target, user.flatMap((s) => densify(s.length > 1 ? s : [s[0], s[0]])), tolerance),
    hasInk: () => user.length > 0,
  };
}

// Écran d'écriture : choix du modèle, du niveau, puis vérification.
export function workshop({ goalId, options, plusFromLevel, tolerance = TOLERANCE }) {
  let option = options[0];
  let level = 1;
  const holder = h('div', { class: 'pad-holder' });
  const result = h('div');
  let pad = null;
  const build = () => {
    pad = writingPad(option.spec(), level, tolerance);
    holder.replaceChildren(pad.element);
    result.replaceChildren();
  };
  const check = async () => {
    if (!pad.hasInk()) { result.replaceChildren(h('p', { class: 'note' }, 'Trace d’abord avec le doigt.')); return; }
    const score = pad.score();
    const ok = score >= PASS_SCORE;
    if (goalId) {
      const resultType = ok ? (level >= plusFromLevel ? 'plus' : 'prompt') : 'minus';
      await recordTrial(goalId, resultType, { item: option.id, meta: { level, score } });
    }
    if (ok) speak('Bravo, beau tracé !');
    result.replaceChildren(ok ? praise(`Précision ${score} %`) : h('p', { class: 'note' }, `Précision ${score} %. On recommence doucement.`), btn('✏️ Nouveau tracé', build, 'primary'));
  };
  const optionSelect = h('select', { onchange: (e) => { option = options.find((o) => o.id === e.target.value); build(); } }, options.map((o) => h('option', { value: o.id }, o.label)));
  const levelSelect = h('select', { onchange: (e) => { level = Number(e.target.value); build(); } },
    h('option', { value: 1 }, '1. Rail guidé avec flèches'), h('option', { value: 2 }, '2. Pointillés'), h('option', { value: 3 }, '3. Points repères seuls'));
  requestAnimationFrame(build);
  return h('div', { class: 'stack' },
    h('div', { class: 'row center' }, optionSelect, levelSelect),
    option.spec().word ? h('div', { class: 'model-word' }, option.spec().word) : null,
    holder,
    h('div', { class: 'row center' }, btn('🧽 Effacer', () => pad.clear(), 'ghost'), btn('✔ Vérifier', check, 'primary')),
    result);
}

const shapeOption = (id) => ({ id, label: SHAPES[id].label, spec: () => ({ strokes: SHAPES[id].strokes }) });

// Utilisé aussi par T.2 (copie sous modèle, sans cotation automatique).
export function copyCanvas(word) {
  return workshop({ goalId: null, options: [{ id: 'mot', label: word, spec: () => ({ word }) }], plusFromLevel: 2 });
}

export const EXERCISES = {
  'S.1': () => workshop({ goalId: 'S.1', options: [shapeOption('h'), shapeOption('v')], plusFromLevel: 3 }),
  'S.2': () => workshop({ goalId: 'S.2', options: [shapeOption('rond'), shapeOption('demi'), shapeOption('vague'), shapeOption('spirale')], plusFromLevel: 2, tolerance: WIDE_TOLERANCE }),
  'S.3': () => workshop({ goalId: 'S.3', options: [{ id: 'prenom', label: 'Prénom', spec: () => ({ word: childName() }) }], plusFromLevel: 2 }),
};
