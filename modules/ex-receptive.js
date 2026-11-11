// Section C : langage réceptif (consignes en audio pur, choix par fonction, consignes à deux éléments).
import { h, btn, pick, sample, shuffle } from './util.js';
import { speak } from '../speech.js';
import { recordTrial, ratingPanel } from './aba.js';
import { choiceBoard, praise, modeTabs } from './widgets.js';
import { trialLoop } from './ex-visual.js';
import { COMMANDS, FUNCTION_QUESTIONS, TWO_STEP_OBJECTS, TWO_STEP_REAL } from './content.js';

// C.1 : aucune image-indice ; seule la voix donne la consigne.
function c1() {
  let current = pick(COMMANDS);
  const text = h('p', { class: 'adult-text', hidden: true });
  const select = h('select', { 'aria-label': 'Consigne' }, COMMANDS.map((c, i) => h('option', { value: c.id }, `${i + 1}. ${c.fr}`)));
  const show = () => { select.value = current.id; text.textContent = current.fr; };
  const say = () => speak(current.fr);
  select.onchange = () => { current = COMMANDS.find((c) => c.id === select.value); show(); say(); };
  show();
  return h('div', { class: 'stack' },
    h('button', { type: 'button', class: 'audio-only', onclick: say, 'aria-label': 'Écouter la consigne' }, '🔊'),
    h('div', { class: 'row center' }, select, btn('👁 Texte pour l’adulte', () => { text.hidden = !text.hidden; }, 'ghost tiny')),
    text,
    ratingPanel('C.1', {
      item: () => current.id, withPrompts: false,
      labels: { plus: 'Sans geste ✅ (valide)', prompt: 'Avec geste 👉', minus: 'Non réussi ❌' },
      onRated: () => { current = pick(COMMANDS); show(); setTimeout(say, 600); },
    }));
}

function c2() {
  return trialLoop((next) => {
    const q = pick(FUNCTION_QUESTIONS);
    const after = h('div', { class: 'row center' });
    setTimeout(() => speak(q.ask), 300);
    return h('div', { class: 'stack' },
      h('p', { class: 'ask' }, q.ask, btn('🔊', () => speak(q.ask), 'ghost tiny')),
      choiceBoard({ choices: [{ emoji: q.answer, correct: true }, ...q.others.map((emoji) => ({ emoji, correct: false }))], cols: 2, onAnswer: (first) => {
        recordTrial('C.2', first ? 'plus' : 'prompt', { item: q.id });
        after.replaceChildren(btn('➜ Essai suivant', next, 'primary'));
      } }),
      after);
  });
}

// C.3 : mode écran (ordre des touches vérifié) et mode réel (l'adulte note).
function c3screen() {
  return trialLoop((next) => {
    const objects = sample(TWO_STEP_OBJECTS, 4);
    const [target1, target2] = sample(objects, 2);
    const ask = `Touche d'abord ${target1.fr}, puis touche ${target2.fr}`;
    const clickOrder = [];
    const after = h('div', { class: 'stack' });
    setTimeout(() => speak(ask), 300);
    const buttons = shuffle(objects).map((o) => h('button', { type: 'button', class: 'choice', onclick: (e) => {
      if (clickOrder.length >= 2) return;
      clickOrder.push(o.id);
      e.currentTarget.classList.add('picked');
      e.currentTarget.dataset.order = String(clickOrder.length);
      if (clickOrder.length < 2) return;
      const ok = clickOrder[0] === target1.id && clickOrder[1] === target2.id;
      recordTrial('C.3', ok ? 'plus' : 'minus', { item: `${target1.id}>${target2.id}`, meta: { mode: 'ecran', clickOrder: [...clickOrder] } });
      if (ok) speak('Bravo !');
      after.replaceChildren(ok ? praise('Dans le bon ordre !') : h('p', { class: 'note' }, 'On réessaie ensemble.'), btn('➜ Essai suivant', next, 'primary'));
    } }, h('span', { class: 'emoji' }, o.emoji)));
    return h('div', { class: 'stack' }, h('p', { class: 'ask' }, ask, btn('🔊', () => speak(ask), 'ghost tiny')),
      h('div', { class: 'choices', style: { '--cols': 2 } }, buttons), after);
  });
}

function c3real() {
  let current = TWO_STEP_REAL[0];
  const select = h('select', { onchange: (e) => { current = e.target.value; } }, TWO_STEP_REAL.map((t) => h('option', { value: t }, t)));
  return h('div', { class: 'stack' },
    h('div', { class: 'row center' }, select, btn('🔊 Dire la consigne', () => speak(current), 'primary')),
    ratingPanel('C.3', { item: () => current, meta: { mode: 'reel' }, labels: { plus: 'Deux éléments, bon ordre ✅', minus: 'Ordre faux / incomplet ❌' } }));
}

const c3 = () => modeTabs([['📱 Sur l’écran', c3screen], ['🧍 En vrai', c3real]]);

export const EXERCISES = { 'C.1': c1, 'C.2': c2, 'C.3': c3 };
