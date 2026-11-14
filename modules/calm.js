// v7.1 : coin calme, toujours accessible (bouton 🌈 en haut). Inspiré des meilleurs outils d'autorégulation :
// respiration guidée lente, compter jusqu'à 10, dire ce que je ressens, demander une pause. Couleurs douces, aucun son fort.
import { h, btn } from './util.js';
import { speak, stopSpeaking, hasArabicVoice } from '../speech.js';
import { renderVisual, EMOTIONS } from './visuals.js';

const BREATH_SECONDS = 4;
const BREATHS = 5;
const COUNT_TO = 10;
const FEELINGS = ['content', 'triste', 'colere', 'peur', 'fatigue', 'mal'];
const FEELING_SAY = { content: ['Je suis contente', 'أنا فرحانة'], triste: ['Je suis triste', 'أنا حزينة'], colere: ['Je suis en colère', 'أنا معصبة'], peur: ['J’ai peur', 'خايفة'], fatigue: ['Je suis fatiguée', 'أنا عيانة'], mal: ['J’ai mal', 'كيضرني'] };
const NEEDS = [['⏸️', 'Je veux une pause', 'بغيت نرتاح'], ['🤗', 'Je veux un câlin', 'بغيت عنقة'], ['🎧', 'Je veux mon casque', 'بغيت الكاسك'], ['💧', 'Je veux de l’eau', 'بغيت الما']];

let overlay = null;

const say = (fr, ar, lang) => (lang === 'dr' && ar && hasArabicVoice() ? speak(ar, { lang: 'ar', rate: 0.75 }) : speak(fr, { rate: 0.75 }));

function breathing(lang) {
  const circle = h('div', { class: 'calm-circle' }, '🫁');
  const text = h('p', { class: 'calm-text' }, 'Touche pour respirer avec moi');
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    for (let i = 0; i < BREATHS && overlay; i += 1) {
      circle.classList.add('in'); text.textContent = `J’inspire… (${i + 1}/${BREATHS})`; say('J’inspire', 'نتنفس', lang);
      await new Promise((r) => setTimeout(r, BREATH_SECONDS * 1000));
      circle.classList.remove('in'); text.textContent = 'Je souffle…'; say('Je souffle', 'نخرج النفس', lang);
      await new Promise((r) => setTimeout(r, BREATH_SECONDS * 1000));
    }
    text.textContent = 'Bravo, je suis plus calme 🌈';
    running = false;
  };
  circle.onclick = run;
  return h('section', { class: 'calm-block' }, h('h3', {}, '🫁 Respirer'), circle, text, btn('▶ Commencer', run, 'primary'));
}

function counting(lang) {
  let n = 0;
  const stars = h('div', { class: 'calm-stars' }, Array.from({ length: COUNT_TO }, (_, i) => h('button', { type: 'button', class: 'calm-star', onclick: (e) => {
    if (i !== n) return;
    n += 1;
    e.currentTarget.classList.add('on');
    speak(String(n), { rate: 0.7 });
    if (n === COUNT_TO) setTimeout(() => say('Bravo, je suis calme', 'برافو، أنا هادئة', lang), 900);
  } }, String(i + 1))));
  return h('section', { class: 'calm-block' }, h('h3', {}, '🔢 Compter jusqu’à 10'), h('p', { class: 'note' }, 'Touche les étoiles une par une, doucement.'), stars);
}

function feelings(lang) {
  const list = EMOTIONS.filter((e) => FEELINGS.includes(e.id));
  return h('section', { class: 'calm-block' }, h('h3', {}, '💬 Je me sens…'),
    h('div', { class: 'choices', style: { '--cols': 3 } }, list.map((e) => h('button', { type: 'button', class: 'choice', onclick: () => say(FEELING_SAY[e.id][0], FEELING_SAY[e.id][1], lang) },
      renderVisual({ vkey: e.vkey }, { button: false }), h('span', { class: 'label' }, e.fr)))),
    h('div', { class: 'choices', style: { '--cols': 2 } }, NEEDS.map(([emoji, fr, ar]) => h('button', { type: 'button', class: 'choice', onclick: () => say(fr, ar, lang) },
      h('span', { class: 'emoji' }, emoji), h('span', { class: 'label' }, fr)))));
}

export function closeCalm() {
  if (!overlay) return;
  stopSpeaking();
  overlay.remove();
  overlay = null;
}

export function openCalm(lang = 'fr') {
  closeCalm();
  overlay = h('div', { class: 'calm-overlay', role: 'dialog', 'aria-label': 'Coin calme' },
    h('div', { class: 'calm-panel' },
      h('div', { class: 'row calm-head' }, h('h2', {}, '🌈 Mon coin calme'), btn('✖ Fermer', closeCalm, 'ghost')),
      breathing(lang), counting(lang), feelings(lang)));
  document.body.append(overlay);
  say('Je me calme. On respire ensemble.', 'نهدن. نتنفسو جميع.', lang);
}
