// Exercices enrichis du mode connecté : ils puisent dans le catalogue de 300+ mots et suivent le niveau (1 → 1000).
// Hors ligne, spaces.js garde les exercices d'origine (aucune erreur réseau ne coupe un exercice).
import { h, btn } from './util.js';
import { speak } from '../speech.js';
import { recordTrial, ratingPanel, childName } from './aba.js';
import { choiceBoard, sorter, bigCard, praise } from './widgets.js';
import { hourglass } from './timer.js';
import { trialLoop, buildPuzzle } from './ex-visual.js';
import { copyCanvas } from './ex-writing.js';
import { levelOf, levelParams, nextTrialRandom, rPick, rSample, rShuffle, rInt } from './levels.js';
import { CATALOG, FUNCTIONS, GROUPS, conceptsForLevel, slug } from './catalog.js';
import { conceptVisual, fetchOnlineVisuals, prefetch } from './online-bank.js';
import { PAIRS } from './content.js';
import { LETTERS as PEI_LETTERS } from './content.js';

const params = (goalId) => levelParams(levelOf(goalId).currentLevel);
const pool = (goalId, filter) => conceptsForLevel(params(goalId).catalogShare, filter);
const cap = (n, max) => Math.max(2, Math.min(max, n));
const nextBtn = (next) => btn('➜ Essai suivant', next, 'primary');
// Un mot hors catalogue (paires, etc.) devient un « concept » : ses pictogrammes sont cherchés par son nom.
const asConcept = (x) => ({ id: slug(x.fr), fr: x.fr, emoji: x.emoji, wiki: x.fr.charAt(0).toUpperCase() + x.fr.slice(1) });
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ---------- B.1 : même objet, deux représentations différentes (photo ↔ picto, picto ↔ autre picto, dessins variés) ----------
function b1() {
  return trialLoop((next) => {
    const p = params('B.1');
    const rand = nextTrialRandom('B.1');
    const items = pool('B.1');
    const target = rPick(rand, items);
    const modes = p.level <= 50 ? ['dessin'] : (p.level <= 150 ? ['dessin', 'picto'] : ['photo', 'picto', 'dessin']);
    const mode = rPick(rand, modes);
    const [modelStyle, answerStyle] = { photo: ['photo', 'picto'], picto: ['picto', 'picto2'], dessin: ['drawing', 'drawing'] }[mode];
    const answerVariant = mode === 'dessin' ? rInt(rand, 1, 5) : 0;
    const close = items.filter((c) => c.cat === target.cat && c.id !== target.id);
    const far = items.filter((c) => c.cat !== target.cat);
    const others = rSample(rand, p.closeDistractors && close.length >= p.choices - 1 ? close : far, p.choices - 1);
    prefetch([target, ...others]);
    const choice = (c, correct) => ({ correct, render: () => conceptVisual(c, { style: answerStyle, variant: answerVariant }) });
    const after = h('div', { class: 'row center' });
    return h('div', { class: 'stack' },
      h('p', { class: 'ask' }, 'Trouve le même :', btn('🔊', () => speak('Trouve le même'), 'ghost tiny')),
      h('div', { class: 'big-card model-card' }, conceptVisual(target, { style: modelStyle })),
      choiceBoard({ choices: [choice(target, true), ...others.map((o) => choice(o, false))], cols: Math.min(4, p.choices), praise: target.fr, onAnswer: (first) => {
        recordTrial('B.1', first ? 'plus' : 'prompt', { item: target.id, meta: { mode, level: p.level } });
        after.replaceChildren(nextBtn(next));
      } }),
      after);
  });
}

// ---------- B.2 : puzzle d'une vraie photo ou d'un pictogramme, de 4 à 12 pièces ----------
function b2() {
  const area = h('div', { class: 'puzzle-area' });
  const result = h('div', { class: 'stack' });
  const title = h('p', { class: 'ask' });
  const start = async () => {
    result.replaceChildren();
    const p = params('B.2');
    const rand = nextTrialRandom('B.2');
    const concept = rPick(rand, pool('B.2', (c) => ['ferme', 'sauvages', 'vehicules', 'fruits', 'jouets', 'lieux', 'nature'].includes(c.cat)));
    title.textContent = `Puzzle : ${concept.fr}`;
    let source = concept.emoji;
    const visuals = await Promise.race([fetchOnlineVisuals(concept), new Promise((r) => setTimeout(() => r(null), 2500))]);
    const url = visuals && (visuals.photo || visuals.pictos[0]);
    if (url) { try { source = await createImageBitmap(await (await fetch(url)).blob()); } catch { /* image illisible : dessin */ } }
    buildPuzzle(area, source, p.pieces, () => {
      speak(`Bravo, le puzzle est fini ! ${concept.fr}`);
      const alone = h('input', { type: 'checkbox', checked: true });
      result.replaceChildren(praise('Puzzle terminé !'),
        h('label', { class: 'check' }, alone, ' Réalisé seule, sans aide physique'),
        btn('Enregistrer et puzzle suivant', async () => {
          await recordTrial('B.2', alone.checked ? 'plus' : 'prompt', { item: concept.id, meta: { pieces: p.pieces, level: p.level } });
          start();
        }, 'primary'));
    });
  };
  requestAnimationFrame(start);
  return h('div', { class: 'stack' }, title, area, result, btn('🔀 Autre puzzle', start, 'ghost'));
}

// ---------- B.3 : 1 000 modèles procéduraux (tours, alignements, alternances, pyramides) ----------
const CUBE_COLORS = [['#E57373', 'rouge'], ['#64B5F6', 'bleu'], ['#FFD54F', 'jaune'], ['#81C784', 'vert'], ['#BA68C8', 'violet'], ['#FFB74D', 'orange']];
function b3() {
  const stage = h('div', { class: 'model-stage' });
  let current = '';
  const draw = () => {
    const p = params('B.3');
    const rand = nextTrialRandom('B.3');
    const count = Math.min(6, 2 + Math.floor(p.level / 200) + rInt(rand, 0, 1));
    const palette = CUBE_COLORS.slice(0, Math.min(6, 2 + Math.floor(p.level / 150)));
    const shapes = p.level <= 50 ? ['tour'] : (p.level <= 300 ? ['tour', 'ligne'] : ['tour', 'ligne', 'alternance', 'pyramide']);
    const shape = rPick(rand, shapes);
    const a = rPick(rand, palette); const b = rPick(rand, palette.filter((c) => c !== a));
    const cubes = Array.from({ length: shape === 'pyramide' ? 6 : count }, (_, i) => (shape === 'alternance' ? (i % 2 ? b : a) : rPick(rand, palette)));
    current = `${shape}:${cubes.map((c) => c[1]).join('-')}`;
    const cube = ([color]) => h('div', { class: 'cube', style: { background: color } });
    let model;
    if (shape === 'tour') model = h('div', { class: 'tower' }, [...cubes].reverse().map(cube));
    else if (shape === 'pyramide') model = h('div', { class: 'pyramid' }, [cubes.slice(5, 6), cubes.slice(3, 5), cubes.slice(0, 3)].map((row) => h('div', { class: 'cube-row' }, row.map(cube))));
    else model = h('div', { class: 'cube-row' }, cubes.map(cube));
    stage.replaceChildren(model);
  };
  draw();
  return h('div', { class: 'stack' },
    h('p', { class: 'ask' }, 'Fais pareil avec tes vrais cubes sur la table.'), stage,
    btn('🔀 Nouveau modèle', draw, 'ghost'),
    ratingPanel('B.3', { item: () => current, labels: { plus: 'Fidèle ✅', minus: 'Non fidèle ❌' }, onRated: draw }));
}

// ---------- B.4 / C.4 : 80 paires logiques, de 2 à 6 choix ----------
function pairsGame(goalId, spoken) {
  return () => trialLoop((next) => {
    const p = params(goalId);
    const rand = nextTrialRandom(goalId);
    const reachable = PAIRS.slice(0, Math.max(12, Math.round(PAIRS.length * p.catalogShare)));
    const pair = rPick(rand, reachable);
    const others = rSample(rand, PAIRS.filter((x) => x.id !== pair.id && x.b.fr !== pair.b.fr), cap(p.choices, 6) - 1);
    const visual = (x) => () => conceptVisual(asConcept(x), { style: 'picto' });
    const ask = spoken ? `Montre-moi ce qui va avec : ${pair.a.fr}` : 'Qu’est-ce qui va avec ?';
    if (spoken) setTimeout(() => speak(ask), 300);
    const after = h('div', { class: 'row center' });
    return h('div', { class: 'stack' },
      h('p', { class: 'ask' }, ask, btn('🔊', () => speak(ask), 'ghost tiny')),
      h('div', { class: 'big-card model-card' }, conceptVisual(asConcept(pair.a), { style: 'best' }), h('span', { class: 'label' }, pair.a.fr)),
      choiceBoard({ choices: [{ correct: true, label: pair.b.fr, render: visual(pair.b) }, ...others.map((o) => ({ correct: false, label: o.b.fr, render: visual(o.b) }))],
        cols: Math.min(3, cap(p.choices, 6)), praise: pair.b.fr, onAnswer: (first) => {
          recordTrial(goalId, first ? 'plus' : 'prompt', { item: pair.id, meta: { level: p.level } });
          after.replaceChildren(nextBtn(next));
        } }),
      after);
  });
}

// ---------- B.5 / B.6 : tri en 2 à 4 boîtes (19 fonctions, 23 catégories) ----------
function sortGame(goalId, groups) {
  return () => trialLoop((next) => {
    const p = params(goalId);
    const rand = nextTrialRandom(goalId);
    const chosen = rSample(rand, groups.filter((g) => g.items.length >= Math.min(p.perBox, 2)), p.boxes);
    const tries = new Map();
    const items = chosen.flatMap((g) => rSample(rand, g.items, p.perBox).map((c) => ({ emoji: c.emoji, fr: c.fr, bin: g.id, render: () => conceptVisual(c, { style: 'picto' }) })));
    prefetch(chosen.flatMap((g) => g.items));
    const after = h('div', { class: 'row center' });
    return h('div', { class: 'stack' },
      h('p', { class: 'ask' }, 'Range chaque image dans la bonne boîte.'),
      sorter({
        bins: chosen.map((g) => ({ id: g.id, emoji: g.items[0].emoji, fr: g.label })), items,
        onPlace: (correct, item) => {
          if (!correct) { tries.set(item.fr, true); return; }
          recordTrial(goalId, tries.get(item.fr) ? 'prompt' : 'plus', { item: item.bin, meta: { object: item.fr, level: p.level } });
        },
        onDone: () => { speak('Bravo, tout est rangé !'); after.replaceChildren(praise('Tout est rangé !'), btn('➜ Tri suivant', next, 'primary')); },
      }),
      after);
  });
}

// ---------- C.2 : désigner par catégorie, fonction, couleur, puis 2 critères ----------
const FN_LABEL = Object.fromEntries(FUNCTIONS.map((f) => [f.id, f.label.toLowerCase()]));
function c2() {
  return trialLoop((next) => {
    const p = params('C.2');
    const rand = nextTrialRandom('C.2');
    const items = pool('C.2');
    const kinds = p.criteria > 1 ? ['catColor', 'fn', 'cat'] : (p.level > 150 ? ['cat', 'fn', 'color'] : ['cat', 'fn']);
    let target; let test; let ask;
    for (let i = 0; i < 20 && !test; i += 1) {
      const t = rPick(rand, items);
      const kind = rPick(rand, kinds);
      if (kind === 'cat') { target = t; test = (c) => c.cat === t.cat; ask = `Montre-moi ${t.catLabel}`; }
      if (kind === 'fn' && FN_LABEL[t.fn]) { target = t; test = (c) => c.fn === t.fn; ask = `Montre-moi ce qui ${FN_LABEL[t.fn]}`; }
      if (kind === 'color' && t.color) { target = t; test = (c) => c.color === t.color; ask = `Montre-moi quelque chose de couleur ${t.color}`; }
      if (kind === 'catColor' && t.color) { target = t; test = (c) => c.cat === t.cat && c.color === t.color; ask = `Montre-moi ${t.catLabel} de couleur ${t.color}`; }
    }
    // Distracteurs : aux niveaux avancés, certains partagent un des deux critères (plus difficile).
    const wrong = items.filter((c) => !test(c));
    const near = wrong.filter((c) => c.cat === target.cat || c.color === target.color);
    const others = rShuffle(rand, [...rSample(rand, near, p.criteria > 1 ? 2 : 0), ...rSample(rand, wrong, 8)])
      .filter((c, i, a) => a.indexOf(c) === i).slice(0, cap(p.choices, 6) - 1);
    setTimeout(() => speak(ask), 300);
    const after = h('div', { class: 'row center' });
    return h('div', { class: 'stack' },
      h('p', { class: 'ask' }, ask, btn('🔊', () => speak(ask), 'ghost tiny')),
      choiceBoard({ choices: [target, ...others].map((c) => ({ correct: c === target, render: () => conceptVisual(c, { style: 'picto' }) })),
        cols: Math.min(3, others.length + 1), praise: target.fr, onAnswer: (first) => {
          recordTrial('C.2', first ? 'plus' : 'prompt', { item: target.id, meta: { ask, level: p.level } });
          after.replaceChildren(nextBtn(next));
        } }),
      after);
  });
}

// ---------- C.3 : consignes à 2 éléments (3 au-delà du niveau 500) sur 4, 6 ou 8 images ----------
function c3() {
  return trialLoop((next) => {
    const p = params('C.3');
    const rand = nextTrialRandom('C.3');
    const objects = rSample(rand, pool('C.3', (c) => c.cat !== 'lieux' && c.cat !== 'formes'), p.gridSize);
    const targets = rSample(rand, objects, p.commandSteps);
    const ask = `Touche d'abord l'image « ${targets[0].fr} », ${targets.slice(1).map((t) => `puis « ${t.fr} »`).join(', ')}`;
    const order = [];
    const after = h('div', { class: 'stack' });
    setTimeout(() => speak(ask), 300);
    const grid = h('div', { class: 'choices', style: { '--cols': p.gridSize > 4 ? 4 : 2 } }, objects.map((o) => h('button', { type: 'button', class: 'choice', onclick: (e) => {
      if (order.length >= targets.length) return;
      order.push(o.id);
      e.currentTarget.classList.add('picked');
      e.currentTarget.dataset.order = String(order.length);
      if (order.length < targets.length) return;
      const ok = targets.every((t, i) => order[i] === t.id);
      recordTrial('C.3', ok ? 'plus' : 'minus', { item: targets.map((t) => t.id).join('>'), meta: { mode: 'ecran', steps: targets.length, level: p.level } });
      if (ok) speak('Bravo !');
      after.replaceChildren(ok ? praise('Dans le bon ordre !') : h('p', { class: 'note' }, 'On réessaie ensemble.'), nextBtn(next));
    } }, conceptVisual(o, { style: 'picto' }))));
    return h('div', { class: 'stack' }, h('p', { class: 'ask' }, ask, btn('🔊', () => speak(ask), 'ghost tiny')), grid, after);
  });
}

// ---------- G.1 : 10 à 15 nouvelles images à dénommer, sans question ----------
function g1() {
  const stage = h('div', { class: 'stack' });
  const progress = h('p', { class: 'note' });
  let order = [];
  let index = 0;
  const newRound = () => {
    const p = params('G.1');
    const rand = nextTrialRandom('G.1');
    order = rSample(rand, pool('G.1', (c) => c.cat !== 'formes'), p.level <= 150 ? 10 : 15);
    prefetch(order);
    index = 0;
    draw();
  };
  const draw = () => {
    if (index >= order.length) { progress.textContent = ''; stage.replaceChildren(praise('Toutes les images sont passées !'), btn('🔀 Nouvelles images', newRound, 'primary')); return; }
    const item = order[index];
    const glass = hourglass(5);
    progress.textContent = `Image ${index + 1}/${order.length}`;
    stage.replaceChildren(h('div', { class: 'big-card' }, conceptVisual(item, { style: 'best' })), glass.element,
      h('details', {}, h('summary', {}, 'Mot attendu (pour l’adulte)'), h('p', { class: 'adult-text' }, item.fr)),
      ratingPanel('G.1', { item: item.id, labels: { plus: '✅ Dénommé spontanément', prompt: '👉 Après aide', minus: '❌ Pas de mot' }, onRated: () => { index += 1; draw(); } }));
    glass.run();
  };
  newRound();
  return h('div', { class: 'stack' }, h('p', { class: 'note' }, 'Ne posez pas de question : attendez que l’enfant nomme l’image.'), progress, stage);
}

// ---------- Q.1 : 10 lettres du PEI, puis les 26 ; aux hauts niveaux, l'initiale d'un mot illustré ----------
function q1() {
  return trialLoop((next) => {
    const p = params('Q.1');
    const rand = nextTrialRandom('Q.1');
    const letters = p.level <= 100 ? PEI_LETTERS : ALPHABET;
    const initial = p.level > 300 && rand() < 0.5;
    const concept = initial ? rPick(rand, pool('Q.1', (c) => ALPHABET.includes(c.letter) && !c.fr.includes(' '))) : null;
    const letter = concept ? concept.letter : rPick(rand, letters);
    const others = rSample(rand, (letters.includes(letter) ? letters : ALPHABET).filter((l) => l !== letter), cap(p.choices, 6) - 1);
    const ask = concept ? `Par quelle lettre commence « ${concept.fr} » ?` : `Montre le ${letter}`;
    setTimeout(() => speak(ask), 300);
    const after = h('div', { class: 'row center' });
    return h('div', { class: 'stack' },
      h('p', { class: 'ask' }, ask, btn('🔊', () => speak(ask), 'ghost tiny')),
      concept ? h('div', { class: 'big-card' }, conceptVisual(concept, { style: 'best' })) : null,
      h('div', { class: 'letters' }, choiceBoard({ choices: [letter, ...others].map((l) => ({ emoji: l, correct: l === letter })), cols: Math.min(4, others.length + 1), onAnswer: (first) => {
        recordTrial('Q.1', first ? 'plus' : 'prompt', { item: letter, meta: { mode: concept ? 'initiale' : 'receptif', level: p.level } });
        after.replaceChildren(nextBtn(next));
      } })),
      after);
  });
}

// ---------- R.1 : dénombrer de 1 à 20 objets variés, pointage un à un ----------
function r1() {
  return trialLoop((next) => {
    const p = params('R.1');
    const rand = nextTrialRandom('R.1');
    const n = rInt(rand, 1, Math.min(20, p.maxCount));
    const thing = rPick(rand, pool('R.1', (c) => ['fruits', 'jouets', 'ferme', 'vehicules', 'legumes'].includes(c.cat)));
    let counted = 0;
    const after = h('div', { class: 'stack' });
    const tokens = Array.from({ length: n }, () => {
      const el = h('button', { type: 'button', class: 'count-token' }, thing.emoji);
      el.onclick = () => {
        if (el.classList.contains('counted')) return;
        counted += 1;
        el.classList.add('counted');
        el.append(h('span', { class: 'count-badge' }, String(counted)));
        speak(String(counted));
        if (counted === n) {
          setTimeout(() => speak(`Il y en a ${n}`), 700);
          after.replaceChildren(ratingPanel('R.1', { item: String(n), meta: { level: p.level, objet: thing.fr }, labels: { plus: 'Compté juste à voix haute ✅' }, onRated: next }));
        }
      };
      return el;
    });
    return h('div', { class: 'stack' }, h('p', { class: 'ask' }, `Compte les ${thing.fr}`), h('div', { class: 'count-mat' }, tokens), after);
  });
}

// ---------- R.2 : chiffre ↔ quantité jusqu'à 20, petites additions au-delà du niveau 500 ----------
function r2() {
  return trialLoop((next) => {
    const p = params('R.2');
    const rand = nextTrialRandom('R.2');
    const max = Math.min(20, p.maxCount);
    const thing = rPick(rand, pool('R.2', (c) => ['fruits', 'jouets', 'ferme', 'legumes'].includes(c.cat)));
    const addition = p.level > 500 && rand() < 0.5;
    const a = rInt(rand, 1, addition ? Math.max(1, Math.floor(max / 2)) : max);
    const b = addition ? rInt(rand, 1, Math.max(1, max - a)) : 0;
    const total = a + b;
    const group = (k) => h('div', { class: 'object-group' }, Array.from({ length: k }, () => h('span', {}, thing.emoji)));
    const near = [total - 2, total - 1, total + 1, total + 2, total + 3].filter((x) => x >= 1 && x <= 20);
    const others = rSample(rand, near, cap(p.choices, 6) - 1);
    const after = h('div', { class: 'row center' });
    return h('div', { class: 'stack' },
      h('p', { class: 'ask' }, addition ? 'Combien en tout ?' : 'Combien ?'),
      addition ? h('div', { class: 'addition' }, group(a), h('span', { class: 'op' }, '+'), group(b)) : group(a),
      h('div', { class: 'letters' }, choiceBoard({ choices: [total, ...others].map((x) => ({ emoji: String(x), correct: x === total })), cols: Math.min(4, others.length + 1), praise: String(total), onAnswer: (first) => {
        recordTrial('R.2', first ? 'plus' : 'prompt', { item: String(total), meta: { addition, level: p.level } });
        after.replaceChildren(nextBtn(next));
      } })),
      after);
  });
}

// ---------- T.2 / T.3 : mots illustrés de plus en plus longs (PAPA, MAMA et le prénom d'abord) ----------
const plain = (word) => word.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
function wordFor(goalId, rand) {
  const p = params(goalId);
  if (p.level <= 25) return rPick(rand, [{ fr: 'papa', emoji: '👨' }, { fr: 'mama', emoji: '👩' }, { fr: childName().toLowerCase(), emoji: '👧' }]);
  const maxLen = p.level <= 150 ? 4 : (p.level <= 500 ? 6 : 10);
  return rPick(rand, pool(goalId, (c) => /^[a-zà-ÿœ]+$/i.test(c.fr) && plain(c.fr).length <= maxLen && plain(c.fr).length >= 3));
}

function t2() {
  const stage = h('div', { class: 'stack' });
  const draw = () => {
    const rand = nextTrialRandom('T.2');
    const concept = wordFor('T.2', rand);
    const word = plain(concept.fr);
    let filled = 0;
    const slots = [...word].map(() => h('span', { class: 'slot' }, ''));
    const tiles = rShuffle(rand, [...word]).map((letter) => {
      const tile = h('button', { type: 'button', class: 'magnet' }, letter);
      tile.onclick = () => {
        if (letter !== word[filled]) { tile.classList.add('wiggle-soft'); setTimeout(() => tile.classList.remove('wiggle-soft'), 400); return; }
        slots[filled].textContent = letter; slots[filled].classList.add('on');
        tile.style.visibility = 'hidden';
        filled += 1;
        speak(letter);
        if (filled === word.length) setTimeout(() => speak(concept.fr), 600);
      };
      return tile;
    });
    stage.replaceChildren(h('div', { class: 'big-card' }, concept.id ? conceptVisual(concept, { style: 'best' }) : h('span', { class: 'emoji' }, concept.emoji)),
      h('div', { class: 'model-word' }, word), h('div', { class: 'slots' }, slots), h('div', { class: 'magnet-row' }, tiles),
      h('details', {}, h('summary', {}, 'Copie sous le modèle'), copyCanvas(word)),
      ratingPanel('T.2', { item: concept.fr, labels: { plus: 'Mot reconstitué ✅' }, onRated: draw }));
  };
  draw();
  return stage;
}

function t3() {
  const stage = h('div', { class: 'stack' });
  const draw = () => {
    const rand = nextTrialRandom('T.3');
    const concept = wordFor('T.3', rand);
    const word = plain(concept.fr);
    let index = 0;
    const row = h('div', { class: 'spell-row' }, [...word].map((letter, i) => h('button', { type: 'button', class: 'letter-card small', onclick: async (e) => {
      if (i !== index) return;
      index += 1;
      e.currentTarget.classList.add('lit');
      await speak(letter);
      if (index === word.length) speak(concept.fr);
    } }, letter)));
    stage.replaceChildren(h('div', { class: 'big-card' }, concept.id ? conceptVisual(concept, { style: 'best' }) : h('span', { class: 'emoji' }, concept.emoji)),
      h('p', { class: 'note' }, 'L’enfant pointe chaque lettre en la disant.'), row,
      ratingPanel('T.3', { item: concept.fr, labels: { plus: 'Épelé correctement ✅' }, onRated: draw }));
  };
  draw();
  return stage;
}

export const ONLINE_EXERCISES = {
  'B.1': b1, 'B.2': b2, 'B.3': b3, 'B.4': pairsGame('B.4', false), 'C.4': pairsGame('C.4', true),
  'B.5': sortGame('B.5', FUNCTIONS), 'B.6': sortGame('B.6', GROUPS),
  'C.2': c2, 'C.3': c3, 'G.1': g1, 'Q.1': q1, 'R.1': r1, 'R.2': r2, 'T.2': t2, 'T.3': t3,
};
export const catalogSize = () => CATALOG.length;
