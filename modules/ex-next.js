// Prochains niveaux ABLLS-R (62 objectifs, A.4 → Z.4) : un jeu par objectif, même moteur et même notation que le PEI.
// Trois types de jeu : choisir (choiceGame), mettre dans l'ordre (orderGame), activité guidée notée par l'adulte (coachGame).
// Les images viennent du catalogue (pictogrammes / photos en ligne, dessins hors ligne) : aucun appel réseau n'est obligatoire.
import { h, btn } from './util.js';
import { speak } from '../speech.js';
import { playClap } from '../media.js';
import { recordTrial, ratingPanel, firstName, sisterName, people } from './aba.js';
import { choiceBoard, sequenceBoard, tokenBoard, praise, bigCard } from './widgets.js';
import { visualTimer, hourglass } from './timer.js';
import { trialLoop, buildPuzzle } from './ex-visual.js';
import { workshop, SHAPES } from './ex-writing.js';
import { levelOf, levelParams, nextTrialRandom, rPick, rSample, rShuffle, rInt } from './levels.js';
import { CATALOG, GROUPS, conceptsForLevel, slug } from './catalog.js';
import { conceptVisual, emojiSvg, prefetch } from './online-bank.js';
import { EMOTIONS, renderVisual } from './visuals.js';
import { VERBS, SITUATIONS, SEQUENCES, GESTURE_SEQUENCE } from './content.js';

// ---------- Outils communs ----------
const P = (goalId) => levelParams(levelOf(goalId).currentLevel);
const pool = (goalId, filter) => conceptsForLevel(P(goalId).catalogShare, filter);
const choicesN = (goalId, min = 2, max = 6) => Math.max(min, Math.min(max, P(goalId).choices));
const emojiTile = (emoji, variant = 0) => { const s = h('span', { class: 'visual concept-visual' }); s.innerHTML = emojiSvg(emoji, variant); return s; };
const pic = (c, style = 'picto') => conceptVisual(c, { style });
const say = (text) => setTimeout(() => speak(text), 300);
const askLine = (text) => h('p', { class: 'ask' }, text, btn('🔊', () => speak(text), 'ghost tiny'));
const nextBtn = (next) => btn('➜ Essai suivant', next, 'primary');
const items = (n, emoji) => h('div', { class: 'object-group' }, Array.from({ length: n }, () => h('span', {}, emoji)));

// Choisir la bonne image. make(rand, p) → { ask, top?, choices: [{ correct, render | emoji | label }], item, cols? }
function choiceGame(goalId, make) {
  return () => trialLoop((next) => {
    const p = P(goalId);
    const t = make(nextTrialRandom(goalId), p);
    if (t.ask) say(t.ask);
    const after = h('div', { class: 'row center' });
    return h('div', { class: 'stack' }, t.ask ? askLine(t.ask) : null, t.top || null,
      h('div', { class: t.wrap || '' }, choiceBoard({ choices: t.choices, cols: t.cols || Math.min(3, t.choices.length), praise: t.praise, onAnswer: (first) => {
        recordTrial(goalId, first ? 'plus' : 'prompt', { item: t.item, meta: { level: p.level } });
        after.replaceChildren(nextBtn(next));
      } })), after);
  });
}

// Toucher les images dans le bon ordre. make → { ask, steps: [{ render | emoji, label }], item }
function orderGame(goalId, make) {
  return () => trialLoop((next) => {
    const p = P(goalId);
    const rand = nextTrialRandom(goalId);
    const t = make(rand, p);
    let index = 0;
    let errors = 0;
    const after = h('div', { class: 'row center' });
    const slots = h('div', { class: 'order-slots' }, t.steps.map((_, i) => h('span', { class: 'order-slot' }, String(i + 1))));
    if (t.ask) say(t.ask);
    const buttons = rShuffle(rand, t.steps.map((s, i) => ({ s, i }))).map(({ s, i }) => {
      const el = h('button', { type: 'button', class: 'choice' }, s.render ? s.render() : emojiTile(s.emoji, s.variant || 0), s.label ? h('span', { class: 'label' }, s.label) : null);
      el.onclick = () => {
        if (el.classList.contains('right')) return;
        if (i !== index) { errors += 1; el.classList.add('wiggle-soft'); setTimeout(() => el.classList.remove('wiggle-soft'), 400); return; }
        el.classList.add('right');
        slots.children[index].classList.add('on');
        index += 1;
        if (s.label) speak(s.label);
        if (index === t.steps.length) {
          playClap();
          recordTrial(goalId, errors ? 'prompt' : 'plus', { item: t.item, meta: { errors, level: p.level } });
          after.replaceChildren(praise('Bravo !'), nextBtn(next));
        }
      };
      return el;
    });
    return h('div', { class: 'stack' }, t.ask ? askLine(t.ask) : null, slots,
      h('div', { class: 'choices', style: { '--cols': Math.min(4, t.steps.length) } }, buttons), after);
  });
}

// Activité réelle guidée : un support visuel varié selon le niveau, et l'adulte note.
function coachGame(goalId, make) {
  return () => {
    const stage = h('div', { class: 'stack' });
    const draw = () => {
      const p = P(goalId);
      const t = make(nextTrialRandom(goalId), p);
      if (t.ask) say(t.ask);
      stage.replaceChildren(t.ask ? askLine(t.ask) : null, ...[].concat(t.body || []),
        t.expected ? h('details', {}, h('summary', {}, 'Réponse attendue (pour l’adulte)'), h('p', { class: 'adult-text' }, t.expected)) : null,
        ratingPanel(goalId, { item: t.item, meta: { level: p.level }, labels: t.labels || {}, onRated: () => setTimeout(draw, 400) }),
        btn('🔀 Autre exemple', draw, 'ghost tiny'));
    };
    draw();
    return stage;
  };
}

// Montrer une séquence de cartes qui s'éclairent l'une après l'autre (gestes, mots).
function showSequence(cards, rate = 0.85) {
  const row = h('div', { class: 'gesture-strip' }, cards.map(([emoji, text], i) => h('div', { class: 'gesture' }, h('span', { class: 'step-num' }, String(i + 1)), emojiTile(emoji), h('span', { class: 'label' }, text))));
  const play = async () => {
    const cells = [...row.children];
    for (let i = 0; i < cells.length; i += 1) {
      cells.forEach((c) => c.classList.remove('lit'));
      cells[i].classList.add('lit');
      await speak(cards[i][1], { rate });
    }
    cells.forEach((c) => c.classList.remove('lit'));
  };
  return [row, btn('▶ Montrer', play, 'primary')];
}

// ---------- A : coopération ----------
const a4 = () => {
  let saved = false;
  const out = h('p', { class: 'note' });
  const finish = (ok) => {
    if (saved) return 'Déjà enregistré.';
    saved = true;
    timer.stop();
    recordTrial('A.4', ok ? 'plus' : 'minus', { meta: { minutes: Math.round(timer.elapsed() / 6) / 10, valid: ok } });
    return ok ? 'Séance valide enregistrée ✅' : 'Séance enregistrée.';
  };
  const timer = visualTimer({ minutes: 3, choices: [3, 4, 5], onEnd: () => { out.textContent = finish(true); } });
  return h('div', { class: 'stack' }, h('p', { class: 'note' }, 'L’adulte s’éloigne. L’enfant travaille seule jusqu’à la fin du sablier.'), timer.element,
    h('div', { class: 'row center' }, btn('✅ Restée autonome', () => { out.textContent = finish(true); }, 'rate-plus'), btn('❌ A eu besoin de l’adulte', () => { out.textContent = finish(false); }, 'rate-minus')), out);
};

const a5 = coachGame('A.5', (rand, p) => {
  const count = Math.min(10, 5 + Math.floor(p.level / 150));
  return { item: `${count}-jetons`, ask: `On gagne ${count} étoiles, puis la récompense !`, body: [tokenBoard({ count }).element], labels: { plus: 'A attendu sa récompense ✅' } };
});

const ACTIVITY_CARDS = [['🧸', 'Jeu'], ['🪑', 'Table'], ['🧩', 'Puzzle'], ['🖍️', 'Dessin'], ['📖', 'Livre'], ['🍽️', 'Repas'], ['🛁', 'Bain'], ['🌳', 'Dehors']];
const a6 = coachGame('A.6', (rand) => {
  const [first, then, other] = rSample(rand, ACTIVITY_CARDS, 3);
  const board = h('div', { class: 'first-then' });
  const draw = (a, b) => board.replaceChildren(h('div', { class: 'ft-cell' }, h('span', { class: 'ft-title' }, 'D’abord'), bigCard(a[0], a[1])), h('div', { class: 'ft-arrow' }, '➜'), h('div', { class: 'ft-cell' }, h('span', { class: 'ft-title' }, 'Ensuite'), bigCard(b[0], b[1])));
  draw(first, then);
  const change = btn('🔄 Changement !', () => { draw(first, other); speak(`Changement : ensuite, ${other[1]}`); }, 'ghost');
  return { item: `${first[1]}>${other[1]}`, body: [board, change], labels: { plus: 'A accepté le changement ✅', minus: 'Opposition ❌' } };
});

const a7 = coachGame('A.7', () => ({ item: 'apres-erreur', body: [bigCard('🙂', 'On se trompe, ce n’est pas grave. On recommence !')],
  expected: 'Après une erreur, l’enfant continue la tâche sans cri ni refus.', labels: { plus: 'A continué calmement ✅' } }));

// ---------- B : performance visuelle ----------
const sizedEmoji = (emoji, scale) => { const s = h('span', { class: 'visual concept-visual' }); s.innerHTML = `<svg viewBox="0 0 200 200"><text x="100" y="108" font-size="${Math.round(160 * scale)}" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`; return s; };
const b7 = orderGame('B.7', (rand, p) => {
  const n = Math.min(5, 3 + Math.floor(p.level / 300));
  const c = rPick(rand, pool('B.7'));
  return { ask: 'Du plus petit au plus grand', item: c.id, steps: Array.from({ length: n }, (_, i) => ({ render: () => sizedEmoji(c.emoji, 0.3 + (0.7 * i) / (n - 1)) })) };
});

const b8 = choiceGame('B.8', (rand, p) => {
  const patterns = p.level <= 150 ? ['ABAB'] : (p.level <= 500 ? ['ABAB', 'AABB'] : ['ABAB', 'AABB', 'ABC', 'ABBA']);
  const pattern = rPick(rand, patterns);
  const symbols = rSample(rand, pool('B.8'), 3);
  const unit = [...pattern].map((ch) => symbols[ch.charCodeAt(0) - 65]);
  const line = [...unit, ...unit, ...unit].slice(0, pattern === 'ABC' ? 8 : 7);
  const missing = line[line.length - 1];
  const others = symbols.filter((s) => s !== missing).concat(rSample(rand, pool('B.8').filter((c) => !symbols.includes(c)), 2)).slice(0, choicesN('B.8') - 1);
  return { ask: 'Qu’est-ce qui vient après ?', item: pattern,
    top: h('div', { class: 'pattern-row' }, line.slice(0, -1).map((c) => emojiTile(c.emoji)), h('span', { class: 'mystery' }, '❓')),
    choices: [missing, ...others].map((c) => ({ correct: c === missing, render: () => emojiTile(c.emoji) })) };
});

const b9 = () => trialLoop((next) => {
  const p = P('B.9');
  const rand = nextTrialRandom('B.9');
  const k = Math.min(3, 1 + Math.floor(p.level / 250));
  const all = rSample(rand, pool('B.9'), k + Math.max(2, choicesN('B.9') - 1));
  const shown = all.slice(0, k);
  const stage = h('div', { class: 'stack' });
  const glass = hourglass(3, () => {
    let found = 0; let errors = 0;
    const after = h('div', { class: 'row center' });
    stage.replaceChildren(askLine(k > 1 ? `Retrouve les ${k} images` : 'Retrouve l’image'),
      h('div', { class: 'choices', style: { '--cols': 3 } }, rShuffle(rand, all).map((c) => h('button', { type: 'button', class: 'choice', onclick: (e) => {
        if (e.currentTarget.classList.contains('right') || found === k) return;
        if (!shown.includes(c)) { errors += 1; e.currentTarget.classList.add('faded'); return; }
        e.currentTarget.classList.add('right'); found += 1;
        if (found === k) { playClap(); recordTrial('B.9', errors ? 'prompt' : 'plus', { item: `${k}`, meta: { level: p.level } }); after.replaceChildren(nextBtn(next)); }
      } }, emojiTile(c.emoji)))), after);
  });
  stage.append(askLine('Regarde bien…'), h('div', { class: 'pattern-row' }, shown.map((c) => emojiTile(c.emoji))), glass.element);
  setTimeout(() => glass.run(), 50);
  return stage;
});

const b10 = choiceGame('B.10', (rand) => {
  const groups = GROUPS.filter((g) => g.items.length >= 5);
  const [g1, g2] = rSample(rand, groups, 2);
  const same = rSample(rand, g1.items, Math.min(5, Math.max(3, choicesN('B.10', 4) - 1)));
  const odd = rPick(rand, g2.items.filter((c) => !g1.items.includes(c)));
  return { ask: 'Trouve l’intrus', item: `${g1.id}/${odd.id}`, cols: 3,
    choices: [odd, ...same].map((c) => ({ correct: c === odd, render: () => pic(c) })) };
});

const NATURAL = [[['🥚', 'œuf'], ['🐣', 'poussin'], ['🐔', 'poule']], [['🌱', 'graine'], ['🌿', 'pousse'], ['🌻', 'fleur']], [['🥣', 'préparer'], ['🍰', 'gâteau'], ['😋', 'manger']], [['😴', 'dormir'], ['⏰', 'réveil'], ['🥐', 'petit-déjeuner']], [['🍎', 'pomme entière'], ['🔪', 'couper'], ['🍽️', 'manger']]];
const b11 = orderGame('B.11', (rand, p) => {
  const routines = Object.values(SEQUENCES).filter((s) => s.length >= 3);
  const steps = p.level <= 150 || rand() < 0.4 ? rPick(rand, NATURAL) : rPick(rand, routines).slice(0, Math.min(4, 3 + Math.floor(p.level / 400)));
  return { ask: 'Remets dans l’ordre : avant, pendant, après', item: steps.map((s) => s[1]).join('>'), steps: steps.map(([emoji, label]) => ({ emoji, label })) };
});

const MATRIX_SHAPES = [['●', 'rond'], ['▲', 'triangle'], ['■', 'carré'], ['★', 'étoile']];
const MATRIX_COLORS = [['#E57373', 'rouge'], ['#64B5F6', 'bleu'], ['#FFD54F', 'jaune'], ['#81C784', 'vert']];
const shapeTile = ([glyph], [color]) => h('span', { class: 'shape-tile', style: { color } }, glyph);
const b12 = choiceGame('B.12', (rand, p) => {
  const n = p.level <= 300 ? 2 : 3;
  const shapes = rSample(rand, MATRIX_SHAPES, n);
  const colors = rSample(rand, MATRIX_COLORS, n);
  const r = rInt(rand, 0, n - 1); const c = rInt(rand, 0, n - 1);
  const grid = h('div', { class: 'matrix-grid', style: { '--n': n } }, shapes.flatMap((s, i) => colors.map((col, j) => (i === r && j === c ? h('span', { class: 'mystery' }, '❓') : shapeTile(s, col)))));
  const answer = [shapes[r], colors[c]];
  const wrong = rShuffle(rand, MATRIX_SHAPES.flatMap((s) => MATRIX_COLORS.map((col) => [s, col])).filter(([s, col]) => !(s === answer[0] && col === answer[1]))).slice(0, choicesN('B.12', 3) - 1);
  return { ask: 'Qu’est-ce qui manque ?', item: `${answer[0][1]}-${answer[1][1]}`, top: grid,
    choices: [answer, ...wrong].map(([s, col]) => ({ correct: s === answer[0] && col === answer[1], render: () => shapeTile(s, col) })) };
});

const b13 = choiceGame('B.13', (rand) => {
  const set = rSample(rand, pool('B.13', (c) => !['formes', 'lieux', 'corps'].includes(c.cat)), choicesN('B.13', 3));
  const target = set[0];
  const shadow = h('div', { class: 'big-card model-card silhouette' }, emojiTile(target.emoji));
  return { ask: 'À qui est cette ombre ?', item: target.id, top: shadow, choices: set.map((c) => ({ correct: c === target, render: () => emojiTile(c.emoji) })) };
});

const b14 = () => {
  const area = h('div', { class: 'puzzle-area no-guide' });
  const result = h('div', { class: 'stack' });
  const start = () => {
    result.replaceChildren();
    const p = P('B.14');
    const c = rPick(nextTrialRandom('B.14'), pool('B.14', (x) => ['ferme', 'sauvages', 'vehicules', 'fruits'].includes(x.cat)));
    buildPuzzle(area, c.emoji, p.level <= 300 ? 9 : 12, () => {
      const alone = h('input', { type: 'checkbox', checked: true });
      result.replaceChildren(praise('Puzzle terminé !'), h('label', { class: 'check' }, alone, ' Réalisé seule, sans aide'),
        btn('Enregistrer et puzzle suivant', async () => { await recordTrial('B.14', alone.checked ? 'plus' : 'prompt', { item: c.id }); start(); }, 'primary'));
    });
  };
  requestAnimationFrame(start);
  return h('div', { class: 'stack' }, area, result);
};

// ---------- C : langage réceptif ----------
const TINTS = [['rose', 0], ['vert', 1]];
const tintedEmoji = (emoji, scale, variant) => { const s = h('span', { class: 'visual concept-visual' }); const bg = ['#FDE7EF', '#E3F4EF'][variant]; s.innerHTML = `<svg viewBox="0 0 200 200"><rect width="200" height="200" rx="34" fill="${bg}"/><text x="100" y="108" font-size="${Math.round(130 * scale)}" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`; return s; };
const c5 = choiceGame('C.5', (rand, p) => {
  const c = rPick(rand, pool('C.5', (x) => !['formes', 'lieux'].includes(x.cat)));
  const two = p.level > 300;
  const sizes = [['grand', 1], ['petit', 0.45]];
  const options = two ? sizes.flatMap(([s, k]) => TINTS.map(([t, v]) => ({ s, k, t, v }))) : sizes.map(([s, k]) => ({ s, k, t: '', v: 0 }));
  const target = rPick(rand, options);
  const ask = `Montre le ${target.s} ${c.fr}${two ? ` sur fond ${target.t}` : ''}`;
  return { ask, item: `${target.s}${target.t}`, choices: rShuffle(rand, options).map((o) => ({ correct: o === target, render: () => tintedEmoji(c.emoji, o.k, o.v) })) };
});

const PREPS = ['sur', 'sous', 'dans', 'devant', 'derrière'];
function prepScene(emoji, prep) {
  const box = '<rect x="50" y="95" width="100" height="70" rx="10" fill="#C8A26B" stroke="#8D6E63" stroke-width="4"/>';
  const obj = (x, y, s = 60) => `<text x="${x}" y="${y}" font-size="${s}" text-anchor="middle" dominant-baseline="middle">${emoji}</text>`;
  const svg = {
    sur: box + obj(100, 65),
    sous: '<rect x="40" y="40" width="120" height="16" rx="6" fill="#C8A26B"/><rect x="48" y="56" width="10" height="110" fill="#A1887F"/><rect x="142" y="56" width="10" height="110" fill="#A1887F"/>' + obj(100, 130, 54),
    dans: '<rect x="50" y="95" width="100" height="70" rx="10" fill="#E6CFA8" stroke="#8D6E63" stroke-width="4"/>' + obj(100, 118, 46) + '<rect x="50" y="135" width="100" height="30" rx="6" fill="#C8A26B"/>',
    devant: box + obj(100, 160, 64),
    derrière: obj(150, 85, 56) + box,
  }[prep];
  const el = h('span', { class: 'visual concept-visual' });
  el.innerHTML = `<svg viewBox="0 0 200 200"><rect width="200" height="200" rx="30" fill="#F3F7F6"/>${svg}</svg>`;
  return el;
}
const c6 = choiceGame('C.6', (rand, p) => {
  const c = rPick(rand, pool('C.6', (x) => ['ferme', 'jouets', 'fruits'].includes(x.cat)));
  const preps = PREPS.slice(0, p.level <= 150 ? 3 : 5);
  const target = rPick(rand, preps);
  const shown = [target, ...rSample(rand, preps.filter((x) => x !== target), choicesN('C.6', 2, 4) - 1)];
  return { ask: `Montre : ${c.fr} ${target} la boîte`, item: target, choices: shown.map((x) => ({ correct: x === target, render: () => prepScene(c.emoji, x) })) };
});

const c7 = choiceGame('C.7', (rand) => {
  const g = rPick(rand, GROUPS.filter((x) => x.items.length >= 5));
  const odd = rPick(rand, CATALOG.filter((c) => !g.items.includes(c) && c.cat !== 'formes'));
  const same = rSample(rand, g.items, choicesN('C.7', 3) - 1);
  return { ask: `Montre celui qui n’est PAS : ${g.label.toLowerCase()}`, item: g.id, choices: [odd, ...same].map((c) => ({ correct: c === odd, render: () => pic(c) })) };
});

const c8 = () => trialLoop((next) => {
  const p = P('C.8');
  const rand = nextTrialRandom('C.8');
  const objects = rSample(rand, pool('C.8', (c) => !['lieux', 'formes'].includes(c.cat)), p.level <= 300 ? 4 : 6);
  const targets = rSample(rand, objects, 3);
  const ask = `Touche « ${targets[0].fr} », puis « ${targets[1].fr} », puis « ${targets[2].fr} »`;
  const order = [];
  const after = h('div', { class: 'stack' });
  say(ask);
  return h('div', { class: 'stack' }, askLine(ask), h('div', { class: 'choices', style: { '--cols': 3 } }, objects.map((o) => h('button', { type: 'button', class: 'choice', onclick: (e) => {
    if (order.length >= 3) return;
    order.push(o); e.currentTarget.classList.add('picked'); e.currentTarget.dataset.order = String(order.length);
    if (order.length < 3) return;
    const ok = targets.every((t, i) => order[i] === t);
    recordTrial('C.8', ok ? 'plus' : 'minus', { item: targets.map((t) => t.id).join('>'), meta: { level: p.level } });
    if (ok) playClap();
    after.replaceChildren(ok ? praise('Bravo !') : h('p', { class: 'note' }, 'On réessaie ensemble.'), nextBtn(next));
  } }, pic(o)))), after);
});

const c9 = choiceGame('C.9', (rand) => {
  const set = rSample(rand, VERBS, choicesN('C.9', 3, 4));
  return { ask: `Qui ${set[0].fr} ?`, item: set[0].id, choices: set.map((v) => ({ correct: v === set[0], render: () => emojiTile(v.emoji) })) };
});

const PRONOUNS = [['il', '👦'], ['elle', '👧'], ['ils', '👦👦'], ['elles', '👧👧']];
const c10 = choiceGame('C.10', (rand, p) => {
  const verb = rPick(rand, VERBS.slice(0, 20));
  const set = PRONOUNS.slice(0, p.level <= 150 ? 2 : 4);
  const target = rPick(rand, set);
  const tile = ([, who]) => h('span', { class: 'pronoun-tile' }, who, h('small', {}, verb.emoji));
  return { ask: `Montre : ${target[0]} ${verb.fr}`, item: target[0], choices: set.map((x) => ({ correct: x === target, render: () => tile(x) })) };
});

// ---------- D, E : imitation ----------
const d4 = coachGame('D.4', (rand) => {
  const seq = rSample(rand, GESTURE_SEQUENCE, 4);
  return { item: seq.map((g) => g.id).join('>'), ask: 'Regarde, puis fais pareil', body: showSequence(seq.map((g) => [g.emoji, g.fr])), labels: { plus: 'Les 4 gestes dans l’ordre ✅' } };
});
const FACES = ['content', 'triste', 'colere', 'peur'];
const d5 = coachGame('D.5', (rand) => {
  const e = EMOTIONS.find((x) => x.id === rPick(rand, FACES));
  return { item: e.id, ask: `Fais comme moi : ${e.fr}`, body: [h('div', { class: 'big-card' }, renderVisual({ vkey: e.vkey, label: e.fr }))], labels: { plus: 'Expression imitée ✅' } };
});
const OBJECT_ACTIONS = [['🥄', 'Tourner la cuillère dans le bol'], ['🥁', 'Taper sur le tambour'], ['🧸', 'Faire un câlin à la peluche'], ['🚗', 'Faire rouler la voiture'], ['🧱', 'Poser un cube sur un autre'], ['📖', 'Ouvrir le livre'], ['🎩', 'Mettre le chapeau'], ['🔔', 'Secouer la clochette']];
const d6 = coachGame('D.6', (rand) => {
  const pair = rSample(rand, OBJECT_ACTIONS, 2);
  const [row, show] = showSequence(pair);
  const hide = btn('⏳ Cacher et attendre 5 s', () => { row.style.visibility = 'hidden'; setTimeout(() => speak('À toi !'), 5000); }, 'ghost');
  return { item: pair.map((a) => a[1]).join('>'), ask: 'Regarde ce que je fais avec les objets', body: [row, show, hide], labels: { plus: 'Les 2 actions, plus tard ✅' } };
});
const longWords = () => CATALOG.filter((c) => !c.fr.includes(' ') && c.syllables.length >= 3 && c.syllables.length <= 4);
const e4 = coachGame('E.4', (rand) => {
  const w = rPick(rand, longWords());
  const pills = h('div', { class: 'syllables' }, emojiTile(w.emoji), w.syllables.map((s) => h('span', { class: 'pill' }, s)));
  const model = btn('🔊 Écouter', async () => { for (const s of w.syllables) await speak(s, { rate: 0.7 }); speak(w.fr); }, 'primary');
  return { item: w.id, body: [pills, model], labels: { plus: 'Répété clairement ✅', prompt: 'Approximatif 👉' } };
});
const LONG_PHRASES = () => CATALOG.filter((c) => ['fruits', 'repas', 'jouets'].includes(c.cat)).slice(0, 30).flatMap((c) => [
  { id: `veux-${c.id}`, words: ['Je', 'veux', 'manger', 'une', c.fr], emoji: c.emoji },
  { id: `joue-${c.id}`, words: ['Je', 'joue', 'avec', 'le', c.fr], emoji: c.emoji },
]);
const e5 = coachGame('E.5', (rand, p) => {
  const ph = rPick(rand, LONG_PHRASES());
  const words = p.level <= 300 ? ph.words.slice(1) : ph.words;
  return { item: ph.id, body: [emojiTile(ph.emoji), ...showSequence(words.map((w) => ['💬', w]))], labels: { plus: 'Phrase répétée ✅' } };
});
const VOICES = [['🤫', 'Voix douce', { rate: 0.8 }], ['📢', 'Voix forte', { rate: 0.85 }], ['🐢', 'Voix lente', { rate: 0.5 }], ['🐇', 'Voix rapide', { rate: 1.3 }]];
const e6 = coachGame('E.6', (rand) => {
  const [emoji, text, opts] = rPick(rand, VOICES);
  return { item: text, body: [bigCard(emoji, text), btn('🔊 Exemple', () => speak(`${text}. Bonjour !`, opts), 'primary')], ask: `Dis « Bonjour » avec une ${text.toLowerCase()}`, labels: { plus: 'Voix adaptée ✅' } };
});

// ---------- F : demandes ----------
const f4 = coachGame('F.4', (rand) => {
  const c = rPick(rand, pool('F.4', (x) => ['repas', 'fruits', 'jouets'].includes(x.cat)));
  return { item: c.id, body: showSequence([['🙋', 'Je veux'], [c.emoji, c.fr], ['🙏', 's’il te plaît']]), expected: `« Je veux ${c.fr}, s’il te plaît »`, labels: { plus: 'Demande complète ✅' } };
});
const OBSTACLES = [['🍾', 'La bouteille est fermée'], ['📦', 'La boîte ne s’ouvre pas'], ['🧸', 'La peluche est trop haute'], ['👟', 'Le lacet est défait'], ['🧥', 'La fermeture est coincée'], ['🧃', 'La paille ne rentre pas']];
const f5 = coachGame('F.5', (rand) => {
  const [emoji, text] = rPick(rand, OBSTACLES);
  return { item: text, body: [bigCard(emoji, text), h('button', { type: 'button', class: 'big-card social-card', onclick: () => speak('Aide-moi, s’il te plaît') }, h('span', { class: 'emoji' }, '🤝'), h('span', { class: 'label' }, 'Aide-moi'))], labels: { plus: 'A demandé de l’aide ✅' } };
});
const f6 = coachGame('F.6', (rand) => {
  const c = rPick(rand, pool('F.6', (x) => ['legumes', 'repas'].includes(x.cat)));
  return { item: c.id, ask: `Tu veux ${c.fr} ?`, body: [bigCard(c.emoji, c.fr), h('div', { class: 'row center' },
    btn('🙅 Non merci', () => speak('Non merci'), 'rate-minus'), btn('⏳ Attends', () => speak('Attends'), 'rate-prompt'))], labels: { plus: 'Refus poli ou « Attends » ✅' } };
});
const f7 = coachGame('F.7', (rand) => {
  const c = rPick(rand, pool('F.7'));
  const box = h('button', { type: 'button', class: 'big-card mystery-box' }, h('span', { class: 'emoji' }, '🎁'));
  box.onclick = () => { box.replaceChildren(pic(c, 'best'), h('span', { class: 'label' }, c.fr)); speak(`C’est ${c.fr}`); };
  return { item: c.id, body: [box, btn('❓ C’est quoi ?', () => speak('C’est quoi ?'), 'primary')], expected: 'L’enfant demande « C’est quoi ? » avant qu’on ouvre le cadeau.', labels: { plus: 'A posé la question ✅' } };
});

// ---------- G, H : dénomination et intraverbal ----------
const g4 = coachGame('G.4', (rand) => {
  const c = rPick(rand, pool('G.4', (x) => x.color && !['formes', 'corps'].includes(x.cat)));
  return { item: c.id, body: [h('div', { class: 'big-card' }, pic(c, 'best'))], expected: `« ${c.fr} ${c.color} »`, labels: { plus: 'Nom + couleur ✅' } };
});
const PARTS = [['🐶', 'chien', 'la tête, la queue, les pattes, les oreilles'], ['🐱', 'chat', 'les moustaches, la queue, les pattes'], ['🚗', 'voiture', 'les roues, les portes, le volant'], ['🐟', 'poisson', 'les nageoires, la queue'], ['🌳', 'arbre', 'le tronc, les branches, les feuilles'], ['🪑', 'chaise', 'le dossier, les pieds'], ['🐘', 'éléphant', 'la trompe, les oreilles'], ['🐦', 'oiseau', 'le bec, les ailes, les plumes'], ['🏠', 'maison', 'le toit, la porte, les fenêtres'], ['🧒', 'enfant', 'la tête, les bras, les jambes']];
const g5 = coachGame('G.5', (rand) => { const [emoji, name, parts] = rPick(rand, PARTS); return { item: name, body: [bigCard(emoji, name)], ask: `Montre et dis les parties : ${name}`, expected: parts, labels: { plus: 'Parties nommées ✅' } }; });
const g6 = coachGame('G.6', (rand) => {
  const g = rPick(rand, GROUPS.filter((x) => x.items.length >= 4));
  return { item: g.id, ask: 'Comment on appelle tout ça ?', body: [h('div', { class: 'choices', style: { '--cols': 4 } }, rSample(rand, g.items, 4).map((c) => h('div', { class: 'choice' }, pic(c))))], expected: g.label, labels: { plus: 'Catégorie dite ✅' } };
});
const G7_ACTIONS = [['mange', '🍎', 'une pomme'], ['boit', '🥛', 'du lait'], ['lit', '📖', 'un livre'], ['lance', '⚽', 'le ballon'], ['coupe', '✂️', 'le papier'], ['lave', '🧼', 'ses mains'], ['dessine', '🖍️', 'une fleur'], ['porte', '🎒', 'le sac']];
const g7 = coachGame('G.7', (rand) => {
  const who = rPick(rand, [['👨', 'Papa'], ['👩', 'Maman'], ['👧', sisterName()], ['🧒', firstName()]]);
  const [verb, emoji, obj] = rPick(rand, G7_ACTIONS);
  return { item: `${who[1]}-${verb}`, body: [h('div', { class: 'pattern-row big' }, h('span', {}, who[0]), h('span', {}, emoji))], ask: 'Qu’est-ce qui se passe ?', expected: `« ${who[1]} ${verb} ${obj} »`, labels: { plus: 'Qui + fait + quoi ✅' } };
});
const WH_WHERE = [['Où on dort ?', '🛏️', 'lit'], ['Où on se lave ?', '🛁', 'baignoire'], ['Où on fait les courses ?', '🛒', 'supermarché'], ['Où vivent les poissons ?', '🌊', 'mer'], ['Où on met les habits ?', '🚪', 'armoire'], ['Qui conduit le bus ?', '🧑‍✈️', 'chauffeur'], ['Qui soigne les malades ?', '🧑‍⚕️', 'docteur'], ['Qui éteint le feu ?', '🧑‍🚒', 'pompier'], ['Qui fait le pain ?', '🥖', 'boulanger'], ['Qui travaille à l’école ?', '👩‍🏫', 'maîtresse']];
const WH_WHEN = [['Quand est-ce qu’on dort ?', '🌙', 'la nuit'], ['Quand prend-on le petit-déjeuner ?', '🌅', 'le matin'], ['Quand met-on un manteau ?', '❄️', 'quand il fait froid'], ['Pourquoi prend-on un parapluie ?', '🌧️', 'parce qu’il pleut'], ['Pourquoi on mange ?', '😋', 'parce qu’on a faim'], ['Pourquoi on boit ?', '🥵', 'parce qu’on a soif'], ['Pourquoi va-t-on au lit ?', '🥱', 'parce qu’on est fatigué'], ['Pourquoi se lave-t-on les mains ?', '🦠', 'parce qu’elles sont sales']];
const whGame = (goalId, list) => choiceGame(goalId, (rand) => {
  const set = rSample(rand, list, choicesN(goalId, 2, 4));
  return { ask: set[0][0], item: set[0][2], choices: set.map(([, emoji, label]) => ({ correct: label === set[0][2], label, render: () => emojiTile(emoji) })) };
});
const h6 = coachGame('H.6', (rand) => {
  const g = rPick(rand, GROUPS.filter((x) => x.items.length >= 6 && !x.id.startsWith('tag')));
  const slots = h('div', { class: 'pattern-row' }, [0, 1, 2].map(() => {
    const b = h('button', { type: 'button', class: 'choice slot-btn' }, h('span', { class: 'mystery' }, '❓'));
    b.onclick = () => { b.replaceChildren(h('span', { class: 'emoji' }, '⭐')); playClap(); };
    return b;
  }));
  return { item: g.id, ask: `Dis-moi 3 mots : ${g.label.toLowerCase()}`, body: [slots, h('p', { class: 'note' }, 'Touchez une case à chaque mot dit.')], expected: rSample(rand, g.items, 6).map((c) => c.fr).join(', '), labels: { plus: '3 mots cités ✅' } };
});
const OPPOSITES = [['🔥', 'chaud', '🧊', 'froid'], ['🐘', 'grand', '🐭', 'petit'], ['🚪', 'ouvert', '🔒', 'fermé'], ['☀️', 'jour', '🌙', 'nuit'], ['😊', 'content', '😢', 'triste'], ['⬆️', 'haut', '⬇️', 'bas'], ['🐇', 'rapide', '🐢', 'lent'], ['💡', 'allumé', '🌑', 'éteint'], ['🧼', 'propre', '🟫', 'sale'], ['🍽️', 'plein', '🥣', 'vide']];
const h7 = choiceGame('H.7', (rand) => {
  const set = rSample(rand, OPPOSITES, choicesN('H.7', 2, 4));
  const [e, w, oe, ow] = set[0];
  return { ask: `Le contraire de « ${w} », c’est…`, item: w, top: bigCard(e, w), choices: [{ correct: true, label: ow, render: () => emojiTile(oe) }, ...set.slice(1).map(([, , xe, xw]) => ({ correct: false, label: xw, render: () => emojiTile(xe) }))] };
});

// ---------- K, L, M, N, P ----------
const PLAYS = { 'Le docteur': [['🩺', 'Écouter le cœur'], ['🌡️', 'Prendre la température'], ['🩹', 'Mettre un pansement'], ['💊', 'Donner le médicament']], 'La cuisine': [['🥕', 'Couper les légumes'], ['🍲', 'Mettre dans la casserole'], ['🥄', 'Tourner'], ['🍽️', 'Servir la poupée']], 'L’école': [['🎒', 'Poser le cartable'], ['✏️', 'Écrire'], ['📖', 'Lire une histoire'], ['👏', 'Dire bravo']] };
const k2 = coachGame('K.2', (rand) => { const name = rPick(rand, Object.keys(PLAYS)); return { item: name, ask: `On joue : ${name}`, body: [sequenceBoard(PLAYS[name]).element], labels: { plus: 'Toutes les étapes, seule ✅' } }; });
function memoryGame(rand, pairs) {
  const deck = rShuffle(rand, pairs.flatMap((c) => [c, c]));
  let open = [];
  let found = 0;
  const out = h('div');
  const grid = h('div', { class: 'choices memory', style: { '--cols': 4 } }, deck.map((c) => {
    const card = h('button', { type: 'button', class: 'choice memory-card', dataset: { id: c.id } }, h('span', { class: 'emoji' }, '❔'));
    card.onclick = () => {
      if (open.length === 2 || card.classList.contains('right') || open.includes(card)) return;
      card.replaceChildren(h('span', { class: 'emoji' }, c.emoji));
      open.push(card);
      if (open.length < 2) return;
      const [a, b] = open;
      if (a.dataset.id === b.dataset.id) {
        a.classList.add('right'); b.classList.add('right'); open = []; found += 1;
        if (found === pairs.length) { playClap(); out.replaceChildren(praise('Bravo, tout est trouvé !')); }
        return;
      }
      setTimeout(() => { [a, b].forEach((x) => x.replaceChildren(h('span', { class: 'emoji' }, '❔'))); open = []; }, 1100);
    };
    return card;
  }));
  return [grid, out];
}
const k3 = coachGame('K.3', (rand, p) => ({ item: 'memory', ask: 'Memory : chacun son tour !', body: memoryGame(rand, rSample(rand, pool('K.3', (c) => c.emoji), Math.min(8, 3 + Math.floor(p.level / 150)))), labels: { plus: 'A respecté les règles et les tours ✅' } }));
const l4 = choiceGame('L.4', (rand) => {
  const s = rPick(rand, SITUATIONS);
  const who = rPick(rand, [sisterName(), 'Papa', 'Maman']);
  const target = EMOTIONS.find((e) => e.id === s.emotion);
  const others = rSample(rand, EMOTIONS.filter((e) => e !== target), choicesN('L.4', 2, 3) - 1);
  const text = s.text.replace('{sister}', sisterName()).replace('{name}', who);
  return { ask: `${text}. Comment se sent ${who} ?`, item: s.id, top: bigCard(s.scene, ''), choices: [target, ...others].map((e) => ({ correct: e === target, label: e.fr, render: () => renderVisual({ vkey: e.vkey }, { button: false }) })) };
});
const l5 = coachGame('L.5', (rand) => {
  const partner = rPick(rand, people()).name;
  let n = 0;
  const dots = h('div', { class: 'exchanges' });
  const draw = () => dots.replaceChildren(...[1, 2, 3, 4, 5].map((i) => h('span', { class: `dot${i <= n ? ' on' : ''}` }, String(i))));
  draw();
  return { item: partner, ask: `On partage avec ${partner}, chacun son tour`, body: [dots, btn('🔄 Un échange de plus', () => { n = Math.min(5, n + 1); draw(); speak(n === 5 ? 'Bravo, cinq échanges !' : String(n)); }, 'primary')], labels: { plus: '5 échanges réussis ✅' } };
});
const l6 = coachGame('L.6', (rand) => {
  const q = rPick(rand, [`${sisterName()} demande : « Tu veux jouer ? »`, 'Papa demande : « Tu as faim ? »', 'Maman demande : « Tu veux de l’eau ? »', `${sisterName()} demande : « C’est quoi ton jouet ? »`, 'Papa demande : « Tu es fatiguée ? »', 'Maman demande : « On va dehors ? »']);
  return { item: q, ask: q, body: [h('div', { class: 'row center' }, btn('👍 Oui', () => speak('Oui'), 'rate-plus'), btn('👎 Non', () => speak('Non'), 'rate-minus'))], labels: { plus: 'A répondu ✅' } };
});
const m4 = () => {
  const out = h('div');
  const timer = visualTimer({ minutes: 10, choices: [5, 8, 10], onEnd: () => out.replaceChildren(ratingPanel('M.4', { item: 'groupe-10min', labels: { plus: 'Attentive 10 minutes ✅' } })) });
  return h('div', { class: 'stack' }, timer.element, out, h('details', {}, h('summary', {}, 'Noter sans le sablier'), ratingPanel('M.4', { item: 'groupe-10min' })));
};
const n4 = coachGame('N.4', () => ({ item: 'ranger', body: [sequenceBoard([['🖍️', 'Ranger les crayons'], ['👝', 'Fermer la trousse'], ['📓', 'Ranger le cahier'], ['🎒', 'Tout mettre dans le sac']]).element], labels: { plus: 'A tout rangé seule ✅' } }));
const p4 = choiceGame('P.4', (rand) => {
  const set = rSample(rand, pool('P.4', (c) => c.cat !== 'formes'), choicesN('P.4', 2, 4));
  prefetch(set);
  return { ask: 'Trouve le même en dessin', item: set[0].id, top: h('div', { class: 'big-card model-card' }, pic(set[0], 'photo')), choices: set.map((c) => ({ correct: c === set[0], render: () => conceptVisual(c, { style: 'drawing', variant: 2 }) })) };
});

// ---------- Q, R, S, T : académique ----------
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const q4 = choiceGame('Q.4', (rand, p) => {
  const letters = p.level <= 150 ? 'ABIRMPSLOU'.split('') : ABC;
  const set = rSample(rand, letters, choicesN('Q.4', 2, 6));
  return { ask: `Trouve la petite lettre de ${set[0]}`, item: set[0], wrap: 'letters', top: h('div', { class: 'letter-card' }, set[0]), choices: set.map((l) => ({ correct: l === set[0], emoji: l.toLowerCase() })) };
});
const SYLLABLES = ['AR', 'AL', 'OR', 'IL', 'UR', 'AS', 'OS', 'MAR', 'SOL', 'PAR', 'LIR', 'MOR', 'SAL', 'POL', 'RAS', 'MUR', 'BOL', 'SAC', 'LAC', 'PIC'];
const q5 = choiceGame('Q.5', (rand, p) => {
  const list = p.level <= 300 ? SYLLABLES.slice(0, 7) : SYLLABLES;
  const set = rSample(rand, list, choicesN('Q.5', 2, 5));
  return { ask: `Montre « ${set[0].toLowerCase()} »`, item: set[0], wrap: 'words', choices: set.map((s) => ({ correct: s === set[0], emoji: s })) };
});
const q6 = choiceGame('Q.6', (rand, p) => {
  const maxLen = p.level <= 150 ? 4 : 7;
  const set = rSample(rand, pool('Q.6', (c) => /^[a-zà-ÿœ]+$/i.test(c.fr) && c.fr.length <= maxLen), choicesN('Q.6', 2, 4));
  return { item: set[0].id, top: h('div', { class: 'model-word' }, set[0].fr.toUpperCase()), ask: 'Quelle image va avec ce mot ?', choices: set.map((c) => ({ correct: c === set[0], render: () => pic(c) })) };
});
const SENTENCES = [['Le chat dort', '🐱', '😴'], ['Le chien mange', '🐶', '🍖'], ['Papa lit', '👨', '📖'], ['Maman boit', '👩', '🥛'], ['La fille court', '👧', '🏃'], ['Le bébé pleure', '👶', '😭'], ['Le poisson nage', '🐟', '🌊'], ['L’oiseau vole', '🐦', '☁️']];
const q7 = choiceGame('Q.7', (rand) => {
  const set = rSample(rand, SENTENCES, choicesN('Q.7', 2, 4));
  return { item: set[0][0], top: h('div', { class: 'model-word small' }, set[0][0].toUpperCase()), ask: 'Lis la phrase et montre l’image', choices: set.map(([text, a, b]) => ({ correct: text === set[0][0], render: () => h('span', { class: 'pronoun-tile' }, a, h('small', {}, b)) })) };
});
const thingFor = (goalId, rand) => rPick(rand, pool(goalId, (c) => ['fruits', 'jouets', 'ferme', 'legumes'].includes(c.cat))).emoji;
const r4 = coachGame('R.4', (rand, p) => {
  const n = rInt(rand, 6, Math.min(20, Math.max(8, p.maxCount)));
  const emoji = thingFor('R.4', rand);
  let counted = 0;
  const mat = h('div', { class: 'count-mat' }, Array.from({ length: n }, () => {
    const el = h('button', { type: 'button', class: 'count-token' }, emoji);
    el.onclick = () => { if (el.classList.contains('counted')) return; counted += 1; el.classList.add('counted'); el.append(h('span', { class: 'count-badge' }, String(counted))); speak(String(counted)); };
    return el;
  }));
  return { item: String(n), ask: 'Compte en touchant chaque objet', body: [mat], expected: String(n), labels: { plus: 'Compté juste ✅' } };
});
const r5 = choiceGame('R.5', (rand, p) => {
  const max = Math.min(10, Math.max(5, p.maxCount));
  const mode = rPick(rand, p.level <= 150 ? ['plus', 'moins'] : ['plus', 'moins', 'autant']);
  const emoji = thingFor('R.5', rand);
  const a = rInt(rand, 1, max);
  if (mode === 'autant') {
    const other = a === max ? a - 1 : a + 1;
    return { ask: 'Montre le groupe qui en a autant', item: 'autant', top: items(a, emoji), choices: [[a, true], [other, false]].map(([n, ok]) => ({ correct: ok, render: () => items(n, emoji) })) };
  }
  let b = rInt(rand, 1, max);
  while (b === a) b = rInt(rand, 1, max);
  const ok = (x, y) => (mode === 'plus' ? x > y : x < y);
  return { ask: `Où y en a-t-il le ${mode} ?`, item: mode, choices: [[a, ok(a, b)], [b, ok(b, a)]].map(([n, good]) => ({ correct: good, render: () => items(n, emoji) })) };
});
const mathGame = (goalId, minus) => choiceGame(goalId, (rand, p) => {
  const max = Math.min(10, Math.max(4, p.maxCount));
  const emoji = thingFor(goalId, rand);
  const a = rInt(rand, 2, minus ? max : max - 1);
  const b = minus ? rInt(rand, 1, a - 1) : rInt(rand, 1, max - a);
  const total = minus ? a - b : a + b;
  const top = minus
    ? h('div', { class: 'object-group' }, Array.from({ length: a }, (_, i) => h('span', { class: i >= a - b ? 'crossed' : '' }, emoji)))
    : h('div', { class: 'addition' }, items(a, emoji), h('span', { class: 'op' }, '+'), items(b, emoji));
  const others = rSample(rand, [total - 2, total - 1, total + 1, total + 2].filter((x) => x >= 0 && x <= 20), choicesN(goalId, 2, 4) - 1);
  return { ask: minus ? `${a} moins ${b}, combien il en reste ?` : `${a} plus ${b}, combien en tout ?`, item: `${a}${minus ? '-' : '+'}${b}`, top, wrap: 'letters', choices: [total, ...others].map((x) => ({ correct: x === total, emoji: String(x) })) };
});
const r8 = choiceGame('R.8', (rand, p) => {
  const max = Math.min(20, Math.max(10, p.maxCount));
  const start = rInt(rand, 1, max - 4);
  const seq = [start, start + 1, start + 2, start + 3, start + 4];
  const hole = rInt(rand, 1, 3);
  const others = rSample(rand, [seq[hole] - 2, seq[hole] + 2, seq[hole] + 3, seq[hole] - 3].filter((x) => x > 0), choicesN('R.8', 2, 4) - 1);
  return { ask: 'Quel nombre manque ?', item: String(seq[hole]), wrap: 'letters', top: h('div', { class: 'pattern-row number-line' }, seq.map((n, i) => h('span', { class: 'num' }, i === hole ? '❓' : String(n)))), choices: [seq[hole], ...others].map((x) => ({ correct: x === seq[hole], emoji: String(x) })) };
});
const shapeOptions = (ids) => ids.map((id) => ({ id, label: SHAPES[id].label, spec: () => ({ strokes: SHAPES[id].strokes }) }));
const s4 = () => workshop({ goalId: 'S.4', options: shapeOptions(['zigzag', 'creneaux', 'boucles']), plusFromLevel: 2 });
const s5 = () => {
  const words = [sisterName().toUpperCase(), 'PAPA', 'MAMAN', ...CATALOG.filter((c) => /^[a-z]{4,6}$/.test(c.fr)).slice(0, 20).map((c) => c.fr.toUpperCase())];
  return workshop({ goalId: 'S.5', options: words.map((w) => ({ id: slug(w), label: w, spec: () => ({ word: w }) })), plusFromLevel: 2 });
};
const t4 = coachGame('T.4', (rand, p) => {
  const maxLen = p.level <= 150 ? 4 : 6;
  const c = rPick(rand, pool('T.4', (x) => /^[a-z]+$/.test(x.fr) && x.fr.length >= 3 && x.fr.length <= maxLen));
  const word = c.fr.toUpperCase();
  let filled = 0;
  const slots = [...word].map(() => h('span', { class: 'slot' }, ''));
  const tiles = rShuffle(rand, [...word]).map((letter) => {
    const t = h('button', { type: 'button', class: 'magnet' }, letter);
    t.onclick = () => {
      if (letter !== word[filled]) { t.classList.add('wiggle-soft'); setTimeout(() => t.classList.remove('wiggle-soft'), 400); return; }
      slots[filled].textContent = letter; slots[filled].classList.add('on'); t.style.visibility = 'hidden'; filled += 1;
      if (filled === word.length) { playClap(); speak(c.fr); }
    };
    return t;
  });
  return { item: c.id, ask: `Écris le mot : ${c.fr}`, body: [h('div', { class: 'big-card' }, pic(c, 'best')), h('div', { class: 'slots' }, slots), h('div', { class: 'magnet-row' }, tiles)], labels: { plus: 'Mot reconstitué seule ✅' } };
});

// ---------- U à Z : autonomie et motricité ----------
const WEATHER = [['☀️', 'Il fait chaud', ['👕', '🩳', '🧢'], ['🧥', '🧤']], ['❄️', 'Il fait froid', ['🧥', '🧤', '🧣'], ['🩳', '🩴']], ['🌧️', 'Il pleut', ['☂️', '👢', '🧥'], ['🩴', '🕶️']]];
const u4 = choiceGame('U.4', (rand) => {
  const [emoji, text, good, bad] = rPick(rand, WEATHER);
  const right = rPick(rand, good);
  return { ask: `${text}. Qu’est-ce qu’on met ?`, item: text, top: bigCard(emoji, text), choices: [{ correct: true, render: () => emojiTile(right) }, ...rSample(rand, bad, 2).map((b) => ({ correct: false, render: () => emojiTile(b) }))] };
});
const v4 = () => {
  const order = ['🍽️', '🥛', '🥄', '🍴'];
  const seats = [['👨', 'Papa'], ['👩', 'Maman'], ['👧', sisterName()], ['🧒', firstName()]];
  const out = h('div');
  const plates = [];
  const table = h('div', { class: 'family-table' }, seats.map(([face, name]) => {
    const plate = h('div', { class: 'object-group' });
    plates.push(plate);
    return h('button', { type: 'button', class: 'family-seat seat-btn', onclick: () => {
      if (plate.children.length >= order.length) return;
      plate.append(h('span', {}, order[plate.children.length]));
      if (plate.children.length === order.length) speak(`La place de ${name} est prête`);
      if (plates.every((g) => g.children.length === order.length)) { playClap(); out.replaceChildren(praise('La table est mise !')); }
    } }, h('span', { class: 'emoji' }, face), h('span', {}, name), plate);
  }));
  return h('div', { class: 'stack' }, h('p', { class: 'ask' }, 'On met la table : assiette, verre, cuillère, fourchette'), table, out, ratingPanel('V.4', { item: 'table', labels: { plus: 'Table mise seule ✅' } }));
};
const W4 = { Matin: [['⏰', 'Se lever'], ['🚽', 'Toilettes'], ['🧼', 'Se laver'], ['👕', 'S’habiller'], ['🥣', 'Petit-déjeuner'], ['🪥', 'Brosser les dents']], Soir: [['🛁', 'Bain'], ['👚', 'Pyjama'], ['🪥', 'Brosser les dents'], ['📖', 'Histoire'], ['😴', 'Dormir']] };
const w4 = coachGame('W.4', (rand) => { const name = rPick(rand, Object.keys(W4)); return { item: name, ask: `La routine du ${name.toLowerCase()}`, body: [sequenceBoard(W4[name]).element], labels: { plus: 'Toute la routine, seule ✅' } }; });
const x4 = () => {
  const status = h('p', { class: 'note' }, 'Touchez à chaque fois qu’elle va seule aux toilettes, sans qu’on le lui rappelle.');
  return h('div', { class: 'stack' }, bigCard('🚽', 'Toute seule, sans rappel'), status,
    btn('🌟 Y est allée seule, sans rappel', async () => { await recordTrial('X.4', 'plus', { item: 'seule' }); status.textContent = 'Noté ✅'; playClap(); }, 'primary wide'),
    btn('Avec un rappel de l’adulte', async () => { await recordTrial('X.4', 'prompt', { item: 'rappel' }); status.textContent = 'Noté.'; }, 'ghost'));
};
const y4 = coachGame('Y.4', () => ({ item: 'parcours-5', body: [sequenceBoard([['🦩', 'Cloche-pied'], ['⭕', 'Sauter dans les cerceaux'], ['🤸', 'Rouler'], ['🪵', 'Marcher en équilibre'], ['🏀', 'Lancer dans le panier']]).element], labels: { plus: 'Parcours complet seule ✅' } }));
const z4 = () => workshop({ goalId: 'Z.4', options: shapeOptions(['vague', 'rond', 'boucles']), plusFromLevel: 3, tolerance: 13 });

export const NEXT_EXERCISES = {
  'A.4': a4, 'A.5': a5, 'A.6': a6, 'A.7': a7,
  'B.7': b7, 'B.8': b8, 'B.9': b9, 'B.10': b10, 'B.11': b11, 'B.12': b12, 'B.13': b13, 'B.14': b14,
  'C.5': c5, 'C.6': c6, 'C.7': c7, 'C.8': c8, 'C.9': c9, 'C.10': c10,
  'D.4': d4, 'D.5': d5, 'D.6': d6, 'E.4': e4, 'E.5': e5, 'E.6': e6,
  'F.4': f4, 'F.5': f5, 'F.6': f6, 'F.7': f7,
  'G.4': g4, 'G.5': g5, 'G.6': g6, 'G.7': g7, 'H.4': whGame('H.4', WH_WHERE), 'H.5': whGame('H.5', WH_WHEN), 'H.6': h6, 'H.7': h7,
  'K.2': k2, 'K.3': k3, 'L.4': l4, 'L.5': l5, 'L.6': l6, 'M.4': m4, 'N.4': n4, 'P.4': p4,
  'Q.4': q4, 'Q.5': q5, 'Q.6': q6, 'Q.7': q7, 'R.4': r4, 'R.5': r5, 'R.6': mathGame('R.6', false), 'R.7': mathGame('R.7', true), 'R.8': r8,
  'S.4': s4, 'S.5': s5, 'T.4': t4,
  'U.4': u4, 'V.4': v4, 'W.4': w4, 'X.4': x4, 'Y.4': y4, 'Z.4': z4,
};
