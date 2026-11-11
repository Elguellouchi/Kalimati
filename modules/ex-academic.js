// Sections Q, R, T : lettres, sons, syllabes aimantées, dénombrement, chiffres, prénom et épellation.
import { h, btn, pick, sample, shuffle, sleep } from './util.js';
import { speak } from '../speech.js';
import { recordTrial, ratingPanel, childName } from './aba.js';
import { choiceBoard, praise, modeTabs } from './widgets.js';
import { draggable, hitTest } from './drag.js';
import { trialLoop } from './ex-visual.js';
import { copyCanvas } from './ex-writing.js';
import { LETTERS, SOUNDS, CONSONANTS, VOWELS } from './content.js';

const letterChoices = (answer, pool, n = 4) => [
  { emoji: answer, correct: true },
  ...sample(pool.filter((l) => l !== answer), n - 1).map((l) => ({ emoji: l, correct: false })),
];
const nextBtn = (next) => btn('➜ Essai suivant', next, 'primary');

// Q.1 : réceptif (montre le M) et expressif (comment s'appelle cette lettre ?).
const q1receptive = () => trialLoop((next) => {
  const letter = pick(LETTERS);
  const after = h('div', { class: 'row center' });
  const ask = `Montre le ${letter}`;
  setTimeout(() => speak(ask), 300);
  return h('div', { class: 'stack' }, h('p', { class: 'ask' }, ask, btn('🔊', () => speak(ask), 'ghost tiny')),
    h('div', { class: 'letters' }, choiceBoard({ choices: letterChoices(letter, LETTERS), cols: 4, onAnswer: (first) => {
      recordTrial('Q.1', first ? 'plus' : 'prompt', { item: letter, meta: { mode: 'receptif' } });
      after.replaceChildren(nextBtn(next));
    } })), after);
});

function q1expressive() {
  let letter = pick(LETTERS);
  const card = h('div', { class: 'letter-card' }, letter);
  return h('div', { class: 'stack' }, card, h('p', { class: 'note' }, 'Demandez : « Quelle est cette lettre ? »'),
    ratingPanel('Q.1', { item: () => letter, meta: { mode: 'expressif' }, labels: { plus: 'Lettre nommée ✅' }, onRated: () => { letter = pick(LETTERS); card.textContent = letter; } }));
}

const q1 = () => modeTabs([['👉 Montre-moi', q1receptive], ['🗣️ Nomme', q1expressive]]);

// Q.2 : son pur → lettre.
const q2 = () => trialLoop((next) => {
  const sound = pick(SOUNDS);
  const after = h('div', { class: 'row center' });
  const play = () => speak(sound.say, { rate: 0.6 });
  setTimeout(play, 300);
  return h('div', { class: 'stack' }, h('p', { class: 'ask' }, 'Quelle lettre fait ce son ?', btn('🔊', play, 'ghost')),
    h('div', { class: 'letters' }, choiceBoard({ choices: letterChoices(sound.letter, LETTERS), cols: 4, onAnswer: (first) => {
      recordTrial('Q.2', first ? 'plus' : 'prompt', { item: sound.id });
      after.replaceChildren(nextBtn(next));
    } })), after);
});

// Q.3 : aimants syllabiques — glisser la consonne sur la voyelle.
function q3() {
  let syllable = '';
  const result = h('div', { class: 'stack' });
  const board = h('div', { class: 'magnets' });
  const draw = () => {
    result.replaceChildren();
    const vowels = VOWELS.map((v) => h('div', { class: 'magnet vowel', dataset: { v } }, v));
    const consonants = CONSONANTS.map((c) => {
      const tile = h('div', { class: 'magnet consonant' }, c);
      draggable(tile, { onDrop: ({ x, y }) => {
        const target = hitTest(x, y, vowels);
        if (!target) return false;
        syllable = `${c}${target.dataset.v}`;
        target.classList.add('merged');
        target.textContent = syllable;
        tile.style.visibility = 'hidden';
        speak(syllable.toLowerCase(), { rate: 0.7 });
        result.replaceChildren(h('p', { class: 'ask big' }, syllable),
          ratingPanel('Q.3', { item: syllable, labels: { plus: 'Syllabe lue ✅' }, onRated: draw }));
        return true;
      } });
      return tile;
    });
    board.replaceChildren(h('div', { class: 'magnet-row' }, consonants), h('div', { class: 'magnet-row' }, vowels));
  };
  draw();
  return h('div', { class: 'stack' }, h('p', { class: 'note' }, 'Glisse une consonne sur une voyelle : elles se collent et se lisent.'), board, result, btn('↺ Remettre les aimants', draw, 'ghost'));
}

// R.1 : tapis de pointage un à un, chaque jeton se verrouille une fois compté.
function r1() {
  const mat = h('div', { class: 'count-mat' });
  const after = h('div', { class: 'stack' });
  let quantity = 3;
  const draw = () => {
    after.replaceChildren();
    let counted = 0;
    const tokens = Array.from({ length: quantity }, () => {
      const token = { counted: false };
      const el = h('button', { type: 'button', class: 'count-token' }, '🍎');
      el.onclick = () => {
        if (token.counted) return;
        token.counted = true;
        counted += 1;
        el.classList.add('counted');
        el.append(h('span', { class: 'count-badge' }, String(counted)));
        speak(String(counted));
        if (counted === quantity) {
          setTimeout(() => speak(`Il y en a ${quantity}`), 700);
          after.replaceChildren(ratingPanel('R.1', { item: String(quantity), labels: { plus: 'Compté juste à voix haute ✅' }, onRated: () => { quantity = 1 + Math.floor(Math.random() * 5); draw(); } }));
        }
      };
      return el;
    });
    mat.replaceChildren(...tokens);
  };
  const select = h('select', { onchange: (e) => { quantity = Number(e.target.value); draw(); } }, [1, 2, 3, 4, 5].map((n) => h('option', { value: n, selected: n === quantity }, `${n}`)));
  draw();
  return h('div', { class: 'stack' }, h('div', { class: 'row center' }, h('span', {}, 'Quantité :'), select), mat, after);
}

// R.2 : constellation → chiffre.
const r2 = () => trialLoop((next) => {
  const n = 1 + Math.floor(Math.random() * 5);
  const after = h('div', { class: 'row center' });
  const dots = h('div', { class: `dots dots-${n}` }, Array.from({ length: n }, () => h('span', { class: 'dot on' })));
  return h('div', { class: 'stack' }, h('p', { class: 'ask' }, 'Combien ?'), dots,
    h('div', { class: 'letters' }, choiceBoard({ choices: letterChoices(String(n), ['1', '2', '3', '4', '5']), cols: 4, onAnswer: (first) => {
      recordTrial('R.2', first ? 'plus' : 'prompt', { item: String(n) });
      after.replaceChildren(nextBtn(next));
    } })), after);
});

// R.3 : comptine jusqu'à 10, chiffres cachés sous des nuages, dévoilés après validation de l'adulte.
function r3() {
  let revealed = 0;
  const clouds = h('div', { class: 'clouds' });
  const after = h('div');
  const draw = () => {
    clouds.replaceChildren(...Array.from({ length: 10 }, (_, i) => h('button', {
      type: 'button', class: `cloud${i < revealed ? ' open' : ''}${i === revealed ? ' next' : ''}`,
      onclick: () => { if (i !== revealed) return; revealed += 1; draw(); if (revealed === 10) { speak('Bravo, jusqu’à 10 !'); after.replaceChildren(praise('Jusqu’à 10 !')); } },
    }, i < revealed ? String(i + 1) : '☁️')));
  };
  draw();
  return h('div', { class: 'stack' }, h('p', { class: 'note' }, 'Touchez le nuage suivant à chaque nombre dit par l’enfant.'), clouds, after,
    ratingPanel('R.3', { item: 'comptine', meta: () => ({ reached: revealed }), labels: { plus: 'Récitation complète ✅', minus: 'Incomplète ❌' }, onRated: () => { revealed = 0; after.replaceChildren(); draw(); } }));
}

// T.1 : reconnaître son prénom parmi 3 mots.
const t1 = () => trialLoop((next) => {
  const name = childName();
  const distractors = ['OMAR', 'SARA', 'LINA', 'ADAM'].filter((w) => w !== name).slice(0, 2);
  const after = h('div', { class: 'row center' });
  setTimeout(() => speak('Montre ton prénom'), 300);
  return h('div', { class: 'stack' }, h('p', { class: 'ask' }, 'Montre ton prénom'),
    h('div', { class: 'words' }, choiceBoard({ choices: [{ emoji: name, correct: true }, ...distractors.map((w) => ({ emoji: w, correct: false }))], cols: 3, praise: 'Oui, c’est ton prénom !', onAnswer: (first) => {
      recordTrial('T.1', first ? 'plus' : 'prompt', { item: 'prenom' });
      after.replaceChildren(nextBtn(next));
    } })), after);
});

const familiarWords = () => [{ id: 'papa', word: 'PAPA' }, { id: 'mama', word: 'MAMA' }, { id: 'prenom', word: childName() }];
const wordSelect = (onPick) => h('select', { onchange: (e) => onPick(familiarWords().find((w) => w.id === e.target.value)) },
  familiarWords().map((w) => h('option', { value: w.id }, w.word)));

// T.2 : reconstituer le mot avec des lettres mobiles, puis le copier sous le modèle.
function t2() {
  let current = familiarWords()[0];
  const stage = h('div', { class: 'stack' });
  const draw = () => {
    let filled = 0;
    const slots = [...current.word].map(() => h('span', { class: 'slot' }, ''));
    const tiles = shuffle([...current.word].map((letter, i) => ({ letter, i }))).map(({ letter }) => {
      const tile = h('button', { type: 'button', class: 'magnet' }, letter);
      tile.onclick = () => {
        if (letter !== current.word[filled]) { tile.classList.add('wiggle-soft'); setTimeout(() => tile.classList.remove('wiggle-soft'), 400); return; }
        slots[filled].textContent = letter; slots[filled].classList.add('on');
        tile.style.visibility = 'hidden';
        filled += 1;
        speak(letter);
        if (filled === current.word.length) setTimeout(() => speak(current.word.toLowerCase()), 600);
      };
      return tile;
    });
    stage.replaceChildren(h('div', { class: 'model-word' }, current.word), h('div', { class: 'slots' }, slots), h('div', { class: 'magnet-row' }, tiles),
      h('h3', {}, 'Copie sous le modèle'), copyCanvas(current.word, { goalId: null }),
      ratingPanel('T.2', { item: () => current.id, labels: { plus: 'Copie correcte ✅' } }));
  };
  draw();
  return h('div', { class: 'stack' }, wordSelect((w) => { current = w; draw(); }), stage);
}

// T.3 : épeler en pointant chaque lettre.
function t3() {
  let current = familiarWords()[0];
  const row = h('div', { class: 'spell-row' });
  const draw = () => {
    let index = 0;
    row.replaceChildren(...[...current.word].map((letter, i) => h('button', { type: 'button', class: 'letter-card small', onclick: async (e) => {
      if (i !== index) return;
      index += 1;
      e.currentTarget.classList.add('lit');
      await speak(letter);
      if (index === current.word.length) { await sleep(300); speak(current.word.toLowerCase()); }
    } }, letter)));
  };
  draw();
  return h('div', { class: 'stack' }, wordSelect((w) => { current = w; draw(); }), h('p', { class: 'note' }, 'L’enfant pointe chaque lettre en la disant.'), row,
    ratingPanel('T.3', { item: () => current.id, labels: { plus: 'Épelé correctement ✅' }, onRated: draw }));
}

export const EXERCISES = { 'Q.1': q1, 'Q.2': q2, 'Q.3': q3, 'R.1': r1, 'R.2': r2, 'R.3': r3, 'T.1': t1, 'T.2': t2, 'T.3': t3 };
