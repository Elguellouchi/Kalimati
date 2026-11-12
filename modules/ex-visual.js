// Section B : performance visuelle (matching, puzzle, modèle 3D, associations, tri) + C.4 qui partage les paires.
import { h, btn, pick, sample, shuffle } from './util.js';
import { speak } from '../speech.js';
import { recordTrial, ratingPanel } from './aba.js';
import { choiceBoard, sorter, bigCard, praise } from './widgets.js';
import { PAIRS, FUNCTION_BASKETS, CATEGORY_BOXES } from './content.js';
import { B1_OBJECTS } from './visuals.js';

// Boucle d'essais : render(next) construit un essai ; next() passe au suivant.
export function trialLoop(render) {
  const root = h('div', { class: 'trial' });
  const next = () => root.replaceChildren(render(next));
  next();
  return root;
}

const nextButton = (next) => btn('➜ Essai suivant', next, 'primary');

// B.1 : associer deux représentations différentes du MÊME objet (illustration réaliste ou photo ↔ pictogramme).
function b1() {
  return trialLoop((next) => {
    const object = pick(B1_OBJECTS);
    const realisticModel = Math.random() < 0.5;
    const style = (o, isModel) => (isModel === realisticModel ? o.a : o.b);
    const others = sample(B1_OBJECTS.filter((o) => o.id !== object.id), 3).map((o) => ({ vkey: style(o, false), correct: false }));
    const after = h('div', { class: 'row center' });
    return h('div', { class: 'stack' },
      h('p', { class: 'ask' }, 'Trouve le même :', btn('🔊', () => speak('Trouve le même'), 'ghost tiny')),
      bigCard('', '', 'model-card', style(object, true)),
      choiceBoard({ choices: [{ vkey: style(object, false), correct: true }, ...others], cols: 4, praise: object.fr, onAnswer: (first) => {
        recordTrial('B.1', first ? 'plus' : 'prompt', { item: object.id, meta: { model: realisticModel ? 'realiste' : 'pictogramme' } });
        after.replaceChildren(nextButton(next));
      } }),
      after);
  });
}

// B.2 : puzzle découpé sur <canvas> en 6 (2×3) ou 8 (2×4) pièces, aimantation à 24 px.
const SNAP = 24;
const SCENES = ['🐱', '🐶', '🐢', '🏠', '🚗', '🦁', '🌷', '🐘'];

function sceneCanvas(source, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  if (source instanceof ImageBitmap) {
    const scale = Math.max(width / source.width, height / source.height);
    const w = source.width * scale; const hgt = source.height * scale;
    g.drawImage(source, (width - w) / 2, (height - hgt) / 2, w, hgt);
  } else {
    const grad = g.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#CDEFEA'); grad.addColorStop(1, '#FFF3D6');
    g.fillStyle = grad; g.fillRect(0, 0, width, height);
    g.font = `${Math.round(height * 0.7)}px system-ui, "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(source, width / 2, height / 2 + height * 0.04);
  }
  return canvas;
}

// Grilles possibles : 4 (2×2), 6 (2×3), 8 (2×4), 9 (3×3), 12 (3×4) pièces.
const GRIDS = { 4: [2, 2], 6: [2, 3], 8: [2, 4], 9: [3, 3], 12: [3, 4] };

export function buildPuzzle(area, source, pieces, onDone) {
  const [rows, cols] = GRIDS[pieces] || GRIDS[6];
  const width = Math.min(area.clientWidth || 360, 480) - 8;
  const height = Math.round(width * (rows === 3 ? 0.8 : 0.62));
  const pw = width / cols; const ph = height / rows;
  const image = sceneCanvas(source, width, height);
  const frame = h('div', { class: 'puzzle-frame', style: { width: `${width}px`, height: `${height}px`, left: '4px', top: '4px' } });
  area.style.height = `${height + rows * (ph + 6) + 40}px`;
  area.replaceChildren(frame);
  let placed = 0;
  const slots = shuffle(Array.from({ length: pieces }, (_, i) => i));
  for (let i = 0; i < pieces; i += 1) {
    const r = Math.floor(i / cols); const c = i % cols;
    const piece = document.createElement('canvas');
    piece.width = Math.round(pw); piece.height = Math.round(ph);
    piece.getContext('2d').drawImage(image, c * pw, r * ph, pw, ph, 0, 0, pw, ph);
    piece.className = 'puzzle-piece';
    const target = { x: 4 + c * pw, y: 4 + r * ph };
    const slot = slots[i];
    const trayCols = cols;
    let x = 4 + (slot % trayCols) * ((width - pw) / Math.max(1, trayCols - 1));
    let y = height + 20 + Math.floor(slot / trayCols) * (ph + 6);
    piece.style.left = `${x}px`; piece.style.top = `${y}px`;
    piece.style.width = `${pw}px`; piece.style.height = `${ph}px`;
    let grab = null;
    piece.onpointerdown = (e) => {
      if (piece.classList.contains('locked')) return;
      grab = { id: e.pointerId, dx: e.clientX - x, dy: e.clientY - y };
      piece.setPointerCapture(e.pointerId); piece.classList.add('dragging');
    };
    piece.onpointermove = (e) => {
      if (!grab || e.pointerId !== grab.id) return;
      x = e.clientX - grab.dx; y = e.clientY - grab.dy;
      piece.style.left = `${x}px`; piece.style.top = `${y}px`;
    };
    piece.onpointerup = (e) => {
      if (!grab || e.pointerId !== grab.id) return;
      grab = null; piece.classList.remove('dragging');
      if (Math.hypot(x - target.x, y - target.y) <= SNAP) {
        x = target.x; y = target.y;
        piece.style.left = `${x}px`; piece.style.top = `${y}px`;
        piece.classList.add('locked');
        placed += 1;
        if (placed === pieces) onDone();
      }
    };
    piece.style.touchAction = 'none';
    area.append(piece);
  }
}

function b2(ctx) {
  const area = h('div', { class: 'puzzle-area' });
  const result = h('div', { class: 'stack' });
  const photos = ctx.cards.filter((c) => c.photo && !String(c.photo.type).includes('gif'));
  const sourceSelect = h('select', {}, SCENES.map((s) => h('option', { value: `e:${s}` }, `${s} Image`)),
    photos.map((c) => h('option', { value: `p:${c.id}` }, `📷 ${c.fr}`)));
  const countSelect = h('select', {}, h('option', { value: 6 }, '6 pièces (2×3)'), h('option', { value: 8 }, '8 pièces (2×4)'));
  const start = async () => {
    result.replaceChildren();
    const value = sourceSelect.value;
    let source = value.slice(2);
    if (value.startsWith('p:')) {
      const card = photos.find((c) => c.id === source);
      source = await createImageBitmap(card.photo);
    }
    buildPuzzle(area, source, Number(countSelect.value), () => {
      speak('Bravo, le puzzle est fini !');
      const alone = h('input', { type: 'checkbox', checked: true });
      result.replaceChildren(praise('Puzzle terminé !'),
        h('label', { class: 'check' }, alone, ' Réalisé seul, sans aide physique'),
        btn('Enregistrer cet essai', async (e) => {
          e.target.disabled = true;
          await recordTrial('B.2', alone.checked ? 'plus' : 'prompt', { item: `${countSelect.value}p`, meta: { pieces: Number(countSelect.value) } });
          e.target.textContent = 'Enregistré ✅';
        }, 'primary'));
    });
  };
  requestAnimationFrame(start);
  return h('div', { class: 'stack' }, h('div', { class: 'row center' }, sourceSelect, countSelect, btn('🔀 Nouveau puzzle', start, 'primary')), area, result);
}

// B.3 : modèle 2D à reproduire avec de vrais cubes.
const CUBE_COLORS = [['#E57373', 'rouge'], ['#64B5F6', 'bleu'], ['#FFD54F', 'jaune'], ['#81C784', 'vert']];
const SHAPES = [['●', 'rond'], ['▲', 'triangle'], ['■', 'carré']];

function b3() {
  const stage = h('div', { class: 'model-stage' });
  let current = '';
  const tower = () => {
    const n = 3 + Math.floor(Math.random() * 2);
    const cubes = Array.from({ length: n }, () => pick(CUBE_COLORS));
    current = `tour:${cubes.map((c) => c[1]).join('-')}`;
    stage.replaceChildren(h('div', { class: 'tower' }, [...cubes].reverse().map(([color]) => h('div', { class: 'cube', style: { background: color } }))));
  };
  const shapes = () => {
    const seq = Array.from({ length: 4 }, () => [pick(SHAPES), pick(CUBE_COLORS)]);
    current = `formes:${seq.map(([s, c]) => `${s[1]}-${c[1]}`).join('/')}`;
    stage.replaceChildren(h('div', { class: 'shape-seq' }, seq.map(([[glyph], [color]]) => h('span', { style: { color } }, glyph))));
  };
  tower();
  return h('div', { class: 'stack' },
    h('p', { class: 'ask' }, 'Fais pareil avec tes vrais cubes sur la table.'),
    stage,
    h('div', { class: 'row center' }, btn('🧱 Nouvelle tour', tower, 'ghost'), btn('🔺 Suite de formes', shapes, 'ghost')),
    ratingPanel('B.3', { item: () => current, labels: { plus: 'Fidèle ✅', minus: 'Non fidèle ❌' } }));
}

// B.4 (visuel) et C.4 (réceptif, avec consigne vocale) : « ce qui va avec ».
function pairsExercise(goalId, spoken) {
  return () => trialLoop((next) => {
    const pair = pick(PAIRS);
    const others = sample(PAIRS.filter((p) => p.id !== pair.id), 2).map((p) => ({ emoji: p.b.emoji, label: p.b.fr, correct: false }));
    const after = h('div', { class: 'row center' });
    const ask = spoken ? `Montre-moi ce qui va avec ${pair.a.fr}` : 'Qu’est-ce qui va avec ?';
    if (spoken) setTimeout(() => speak(ask), 300);
    return h('div', { class: 'stack' },
      h('p', { class: 'ask' }, ask, spoken ? btn('🔊', () => speak(ask), 'ghost tiny') : null),
      bigCard(pair.a.emoji, pair.a.fr),
      choiceBoard({ choices: [{ emoji: pair.b.emoji, label: pair.b.fr, correct: true }, ...others], cols: 3, onAnswer: (first) => {
        recordTrial(goalId, first ? 'plus' : 'prompt', { item: pair.id });
        after.replaceChildren(nextButton(next));
      } }),
      after);
  });
}

// B.5 et B.6 : tri. Un objet bien rangé du premier coup = réussite autonome.
function sortExercise(goalId, groups, perGroup) {
  return () => trialLoop((next) => {
    const tries = new Map();
    const items = groups.flatMap((g) => sample(g.items, perGroup).map((it) => ({ ...it, bin: g.id })));
    const after = h('div', { class: 'row center' });
    return h('div', { class: 'stack' },
      h('p', { class: 'ask' }, 'Range chaque image dans la bonne boîte.'),
      sorter({
        bins: groups.map((g) => ({ id: g.id, emoji: g.emoji, fr: g.fr })), items,
        onPlace: (correct, item) => {
          const key = item.emoji;
          if (!correct) { tries.set(key, true); return; }
          recordTrial(goalId, tries.get(key) ? 'prompt' : 'plus', { item: item.bin, meta: { object: item.fr } });
        },
        onDone: () => { speak('Bravo, tout est rangé !'); after.replaceChildren(praise('Tout est rangé !'), btn('🔀 Recommencer', next, 'primary')); },
      }),
      after);
  });
}

export const EXERCISES = {
  'B.1': b1, 'B.2': b2, 'B.3': b3,
  'B.4': pairsExercise('B.4', false),
  'B.5': sortExercise('B.5', FUNCTION_BASKETS, 2),
  'B.6': sortExercise('B.6', CATEGORY_BOXES, 2),
  'C.4': pairsExercise('C.4', true),
};
