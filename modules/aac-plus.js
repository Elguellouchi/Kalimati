// v7.1 : ce que font les meilleures applis de CAA, adapté à Kalimati (tout reste dans le téléphone).
// - Mots suivants proposés : appris sur les phrases d'Abir (quels mots elle met après quels mots).
// - Toucher adapté : ignorer les touches répétées trop rapides, demander un appui un peu plus long.
import * as db from '../db.js';
import { h } from './util.js';

const HISTORY_KEY = 'aacHistory';
const TOUCH_KEY = 'touch';
const SAVE_DELAY_MS = 800;
const BIGRAM_WEIGHT = 10;

let history = { uni: {}, bi: {} };
let touch = { repeatMs: 0, holdMs: 0 };
let saveTimer = 0;
let lastTapAt = 0;

export async function loadAacPlus() {
  const [savedHistory, savedTouch] = await Promise.all([db.getSetting(HISTORY_KEY), db.getSetting(TOUCH_KEY)]);
  history = { uni: {}, bi: {}, ...(savedHistory || {}) };
  touch = { ...touch, ...(savedTouch || {}) };
}

const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => db.setSetting(HISTORY_KEY, history), SAVE_DELAY_MS);
};

// Une carte touchée par Abir (pas en mode « Je montre ») : on retient le mot et ce qui le précédait.
export function learnTap(previousId, card) {
  const followers = previousId ? (history.bi[previousId] || {}) : null;
  history = {
    uni: { ...history.uni, [card.id]: (history.uni[card.id] || 0) + 1 },
    bi: previousId ? { ...history.bi, [previousId]: { ...followers, [card.id]: (followers[card.id] || 0) + 1 } } : history.bi,
  };
  persist();
}

// Jusqu'à n mots proposés après le dernier mot de la phrase : ce qu'Abir met souvent après ce mot.
export function suggestionsFor(strip, cards, n = 4) {
  if (!strip.length) return [];
  const byId = new Map(cards.filter((c) => !c.hidden).map((c) => [c.id, c]));
  const last = strip[strip.length - 1].card;
  const used = new Set(strip.map((item) => item.card.id));
  const score = new Map();
  Object.entries(history.bi[last.id] || {}).forEach(([id, count]) => score.set(id, count * BIGRAM_WEIGHT + (history.uni[id] || 0)));
  return [...score.entries()]
    .filter(([id]) => byId.has(id) && !used.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([id]) => byId.get(id));
}

export const resetSuggestions = () => { history = { uni: {}, bi: {} }; return db.setSetting(HISTORY_KEY, history); };

// ---------- Toucher adapté ----------
// Mesure la durée d'appui d'une carte (pour l'option « appui un peu plus long »).
export function trackPress(el) {
  let downAt = 0;
  el.addEventListener('pointerdown', () => { downAt = Date.now(); });
  return () => (downAt ? Date.now() - downAt : Number.MAX_SAFE_INTEGER);
}

export function touchAllowed(pressMs) {
  const now = Date.now();
  if (touch.repeatMs && now - lastTapAt < touch.repeatMs) return false;
  if (touch.holdMs && pressMs < touch.holdMs) return false;
  lastTapAt = now;
  return true;
}

const REPEAT_CHOICES = [[0, 'Non'], [600, '0,6 s'], [1200, '1,2 s']];
const HOLD_CHOICES = [[0, 'Toucher simple'], [300, 'Appui 0,3 s'], [600, 'Appui 0,6 s']];

export function touchSettingsBox() {
  const select = (key, choices) => h('select', {
    onchange: (e) => { touch = { ...touch, [key]: Number(e.target.value) }; db.setSetting(TOUCH_KEY, touch); },
  }, choices.map(([value, text]) => h('option', { value, selected: touch[key] === value }, text)));
  return h('details', { class: 'card-box touch-box' }, h('summary', {}, '✋ Toucher adapté et mots proposés'),
    h('label', { class: 'check' }, 'Ignorer les touches répétées : ', select('repeatMs', REPEAT_CHOICES)),
    h('label', { class: 'check' }, 'Pour choisir un mot : ', select('holdMs', HOLD_CHOICES)),
    h('p', { class: 'note' }, 'Les mots proposés sous la phrase viennent des phrases d’Abir. Ils restent dans le téléphone.'),
    h('button', { type: 'button', class: 'btn ghost tiny', onclick: async (e) => { await resetSuggestions(); e.target.textContent = 'Mots proposés remis à zéro ✔'; } }, 'Remettre les mots proposés à zéro'));
}
