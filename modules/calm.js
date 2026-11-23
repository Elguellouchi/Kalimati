// v7.1 : coin calme, toujours accessible (bouton 🌈 en haut). Inspiré des meilleurs outils d'autorégulation :
// respiration guidée lente, compter, éclater des bulles (sans limite depuis la v9.5), dire ce que je ressens, demander une pause.
import { h, btn } from './util.js';
import { speak, stopSpeaking, hasArabicVoice } from '../speech.js';
import { renderVisual, EMOTIONS } from './visuals.js';
import { playBeep, playClap } from '../media.js';
import { friendCompanionBanner, unlockFriendSticker } from './friends.js';

const BREATH_SECONDS = 4;
const FEELINGS = ['content', 'triste', 'colere', 'peur', 'fatigue', 'mal'];
const FEELING_SAY = { content: ['Je suis contente', 'أنا فرحانة'], triste: ['Je suis triste', 'أنا حزينة'], colere: ['Je suis en colère', 'أنا معصبة'], peur: ['J’ai peur', 'خايفة'], fatigue: ['Je suis fatiguée', 'أنا عيانة'], mal: ['J’ai mal', 'كيضرني'] };
const NEEDS = [['⏸️', 'Je veux une pause', 'بغيت نرتاح'], ['🤗', 'Je veux un câlin', 'بغيت عنقة'], ['🎧', 'Je veux mon casque', 'بغيت الكاسك'], ['💧', 'Je veux de l’eau', 'بغيت الما']];

// v9.5 : plus de limite. Respirer, compter et éclater des bulles continuent tant qu'il faut, avec des images qui changent.
// L'adulte (ou l'enfant) arrête avec « 😌 Je suis calme ». Sons très doux, mouvements lents.
const BREATH_THEMES = [
  ['🌸', 'Je sens la fleur', 'Je souffle doucement'],
  ['🫧', 'J’inspire', 'Je souffle la bulle'],
  ['🎈', 'J’inspire', 'Je gonfle le ballon'],
  ['🕯️', 'J’inspire', 'Je souffle la bougie'],
  ['🌬️', 'J’inspire', 'Je souffle comme le vent'],
];
const COUNT_THEMES = [['⭐', 'étoiles'], ['🫧', 'bulles'], ['🐟', 'poissons'], ['🌸', 'fleurs'], ['💖', 'cœurs'], ['🎈', 'ballons'], ['🐞', 'coccinelles'], ['🦋', 'papillons'], ['🍓', 'fraises'], ['🌙', 'lunes']];
const ROUND = 10;
const BUBBLES = ['🫧', '🫧', '🫧', '🐠', '⭐', '🌸', '💜', '🦋'];
const MAX_BUBBLES = 7;

let overlay = null;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const say = (fr, ar, lang) => (lang === 'dr' && ar && hasArabicVoice() ? speak(ar, { lang: 'ar', rate: 0.75 }) : speak(fr, { rate: 0.75 }));

function calmDone(text, lang) {
  text.textContent = 'Bravo, je suis calme 🌈';
  playClap();
  say('Bravo, je suis calme', 'برافو، أنا هادئة', lang);
}

function breathing(lang) {
  const circle = h('div', { class: 'calm-circle' }, '🌸');
  const text = h('p', { class: 'calm-text' }, 'Touche pour respirer avec moi');
  const count = h('p', { class: 'note' }, '');
  let token = 0;
  const run = async () => {
    const me = ++token;
    for (let i = 0; overlay && me === token; i += 1) {
      const [emoji, inhale, exhale] = BREATH_THEMES[Math.floor(i / 3) % BREATH_THEMES.length];
      circle.textContent = emoji;
      circle.classList.add('in'); text.textContent = `${inhale}…`; say(inhale, 'نتنفس', lang);
      await wait(BREATH_SECONDS * 1000);
      if (!overlay || me !== token) break;
      circle.classList.remove('in'); text.textContent = `${exhale}…`; say(exhale, 'نخرج النفس', lang);
      await wait(BREATH_SECONDS * 1000);
      count.textContent = `${i + 1} respiration${i ? 's' : ''} 🌿`;
    }
    circle.classList.remove('in');
  };
  const stop = () => { token += 1; calmDone(text, lang); };
  circle.onclick = () => { if (!circle.classList.contains('in')) run(); };
  return h('section', { class: 'calm-block' }, h('h3', {}, '🫁 Respirer (autant qu’il faut)'), circle, text, count,
    h('div', { class: 'row center' }, btn('▶ Commencer', run, 'primary'), btn('😌 Je suis calme', stop, 'ghost')));
}

function counting(lang) {
  let total = 0;
  let round = 0;
  const grid = h('div', { class: 'calm-stars' });
  const title = h('p', { class: 'note' });
  const total$ = h('p', { class: 'calm-text' }, 'Touche, je compte avec toi');
  const draw = () => {
    const [emoji, name] = COUNT_THEMES[round % COUNT_THEMES.length];
    title.textContent = `Touche les ${name}, une par une, doucement.`;
    let left = ROUND;
    grid.replaceChildren(...Array.from({ length: ROUND }, () => {
      const item = h('button', { type: 'button', class: 'calm-star', onclick: () => {
        if (item.classList.contains('on')) return;
        total += 1; left -= 1;
        item.classList.add('on'); item.textContent = String(total);
        speak(String(total), { rate: 0.7 });
        total$.textContent = `J’ai compté jusqu’à ${total}`;
        if (left === 0) { round += 1; setTimeout(() => { if (overlay) { playBeep(); draw(); } }, 1300); }
      } }, emoji);
      return item;
    }));
  };
  draw();
  const done = () => { calmDone(total$, lang); total = 0; round = 0; setTimeout(() => { if (overlay) { draw(); total$.textContent = 'Touche, je compte avec toi'; } }, 2500); };
  return h('section', { class: 'calm-block' }, h('h3', {}, '🔢 Compter avec moi (sans fin)'), title, grid, total$, btn('😌 Je suis calme', done, 'ghost'));
}

function bubbles(lang) {
  const field = h('div', { class: 'calm-field', 'aria-label': 'Bulles à éclater' });
  const score = h('p', { class: 'calm-text' }, 'Éclate les bulles doucement');
  let popped = 0;
  let timer = null;
  const add = () => {
    if (!overlay || !field.isConnected) { clearInterval(timer); timer = null; return; }
    if (field.childElementCount >= MAX_BUBBLES) return;
    const size = 54 + Math.round(Math.random() * 30);
    const bubble = h('button', { type: 'button', class: 'calm-bubble', style: { left: `${5 + Math.random() * 75}%`, width: `${size}px`, height: `${size}px`, animationDuration: `${9 + Math.random() * 5}s` },
      onclick: () => {
        popped += 1; playBeep(); bubble.classList.add('pop');
        score.textContent = `${popped} bulle${popped > 1 ? 's' : ''} éclatée${popped > 1 ? 's' : ''} 🫧`;
        if (popped % 20 === 0) say('Bravo, continue doucement', 'برافو، بشوية', lang);
        setTimeout(() => bubble.remove(), 250);
      } }, BUBBLES[Math.floor(Math.random() * BUBBLES.length)]);
    bubble.addEventListener('animationend', (e) => { if (e.animationName === 'calm-float') bubble.remove(); });
    field.append(bubble);
  };
  const start = () => { if (!timer) { add(); timer = setInterval(add, 1100); } };
  const done = () => { clearInterval(timer); timer = null; field.replaceChildren(); calmDone(score, lang); popped = 0; };
  setTimeout(start, 400);
  return h('section', { class: 'calm-block' }, h('h3', {}, '🫧 Bulles à éclater'), field, score,
    h('div', { class: 'row center' }, btn('▶ Encore des bulles', start, 'primary'), btn('😌 Je suis calme', done, 'ghost')));
}

function feelings(lang) {
  const list = EMOTIONS.filter((e) => FEELINGS.includes(e.id));
  return h('section', { class: 'calm-block' }, h('h3', {}, '💬 Je me sens…'),
    h('div', { class: 'choices', style: { '--cols': 3 } }, list.map((e) => h('button', { type: 'button', class: 'choice', onclick: () => say(FEELING_SAY[e.id][0], FEELING_SAY[e.id][1], lang) },
      renderVisual({ vkey: e.vkey }, { button: false }), h('span', { class: 'label' }, e.fr)))),
    h('div', { class: 'choices', style: { '--cols': 2 } }, NEEDS.map(([emoji, fr, ar]) => h('button', { type: 'button', class: 'choice', onclick: () => say(fr, ar, lang) },
      h('span', { class: 'emoji' }, emoji), h('span', { class: 'label' }, fr)))));
}

// === [DEBUT MODIF v10.5 : 4.22 · F08 & 4.42 · A12 — Jmimla la chamelle après 30 s, aria-modal, touche Échap et restauration du focus] ===
let jmimlaTimer = 0;
let calmTriggerEl = null;

function onCalmKeyDown(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeCalm();
  }
}

export function closeCalm() {
  stopSpeaking();
  if (jmimlaTimer) { clearTimeout(jmimlaTimer); jmimlaTimer = 0; }
  document.removeEventListener('keydown', onCalmKeyDown);
  if (overlay) { overlay.remove(); overlay = null; }
  if (calmTriggerEl && typeof calmTriggerEl.focus === 'function') {
    try { calmTriggerEl.focus(); } catch {}
  }
  calmTriggerEl = null;
}

export function openCalm(lang = 'fr') {
  closeCalm();
  calmTriggerEl = document.activeElement;
  jmimlaTimer = setTimeout(() => {
    jmimlaTimer = 0;
    if (overlay) unlockFriendSticker('jmimla').catch(() => {});
  }, 30000);
  const closeBtn = btn('✖ Fermer', closeCalm, 'ghost');
  overlay = h('div', { class: 'calm-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Coin calme' },
    h('div', { class: 'calm-panel' },
      h('div', { class: 'row calm-head' }, h('h2', {}, '🌈 Mon coin calme'), closeBtn),
      friendCompanionBanner('calm', { lang }),
      breathing(lang), bubbles(lang), counting(lang), feelings(lang)));
  document.addEventListener('keydown', onCalmKeyDown);
  document.body.append(overlay);
  closeBtn.focus();
  say('Je me calme. On respire ensemble.', 'نهدن. نتنفسو جميع.', lang);
}
// === [FIN MODIF v10.5 : 4.22 · F08 & 4.42 · A12] ===
