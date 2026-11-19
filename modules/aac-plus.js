// v7.1 / v10.5 : Mots suivants proposés (appris localement sur les phrases de l'enfant) & Toucher adapté.
// - 4.62 · F11 : Option parentale « Demander 2 touchers sur ✕ pour tout effacer » (désactivée par défaut pour garder la croix ✕ en 1 toucher + ↩ 4 s).
// - 4.76 · C12 : Plafonnement de la taille de l'historique bigrammes (MAX_HISTORY_KEYS = 250) pour éviter toute croissance infinie.
import * as db from '../db.js';
import { h } from './util.js';

const HISTORY_KEY = 'aacHistory';
const TOUCH_KEY = 'touch';
const SAVE_DELAY_MS = 800;
const BIGRAM_WEIGHT = 10;
const MAX_HISTORY_KEYS = 250;

let history = { uni: {}, bi: {} };
let touch = { repeatMs: 0, holdMs: 0, scanMs: 0, confirmClear: false };
let saveTimer = 0;
let lastTapAt = 0;

export async function loadAacPlus() {
  const [savedHistory, savedTouch] = await Promise.all([db.getSetting(HISTORY_KEY), db.getSetting(TOUCH_KEY)]);
  history = { uni: {}, bi: {}, ...(savedHistory || {}) };
  touch = { ...touch, ...(savedTouch || {}) };
}

// === [DEBUT MODIF v10.5 : 4.76 · C12 — Plafonnement de l'historique unigrammes/bigrammes] ===
function pruneHistoryMap(obj, maxKeys = MAX_HISTORY_KEYS) {
  const entries = Object.entries(obj || {});
  if (entries.length <= maxKeys) return obj;
  entries.sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
  return Object.fromEntries(entries.slice(0, maxKeys));
}
// === [FIN MODIF v10.5 : 4.76 · C12] ===

const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => db.setSetting(HISTORY_KEY, history), SAVE_DELAY_MS);
};

// Une carte touchée par l'enfant (pas en mode « Je montre ») : on retient le mot et ce qui le précédait.
export function learnTap(previousId, card) {
  if (!card || !card.id) return;
  const followers = previousId ? (history.bi[previousId] || {}) : null;
  const nextUni = pruneHistoryMap({ ...history.uni, [card.id]: (history.uni[card.id] || 0) + 1 });
  const nextBi = previousId
    ? { ...history.bi, [previousId]: pruneHistoryMap({ ...followers, [card.id]: (followers[card.id] || 0) + 1 }, 40) }
    : history.bi;
  history = { uni: nextUni, bi: nextBi };
  persist();
}

// Jusqu'à n mots proposés après le dernier mot de la phrase.
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
const SCAN_CHOICES = [[0, 'Désactivé'], [1500, 'Rapide (1,5 s)'], [2500, 'Confort (2,5 s)'], [3500, 'Lent (3,5 s)']];
export const scanSpeed = () => Number(touch.scanMs) || 0;

// === [DEBUT MODIF v10.5 : 4.62 · F11 — Option de confirmation en 2 touchers sur la croix ✕] ===
export const clearConfirmNeeded = () => Boolean(touch.confirmClear);
// === [FIN MODIF v10.5 : 4.62 · F11] ===

export function touchSettingsBox() {
  const select = (key, choices) => h('select', {
    onchange: (e) => { touch = { ...touch, [key]: Number(e.target.value) }; db.setSetting(TOUCH_KEY, touch); },
  }, choices.map(([value, text]) => h('option', { value, selected: touch[key] === value }, text)));
  const confirmClearChk = h('input', {
    type: 'checkbox',
    checked: touch.confirmClear ? 'checked' : null,
    onchange: (e) => {
      touch = { ...touch, confirmClear: Boolean(e.target.checked) };
      db.setSetting(TOUCH_KEY, touch);
    },
  });
  return h('details', { class: 'card-box touch-box' }, h('summary', {}, '✋ Toucher adapté et mots proposés'),
    h('label', { class: 'check' }, 'Ignorer les touches répétées : ', select('repeatMs', REPEAT_CHOICES)),
    h('label', { class: 'check' }, 'Pour choisir un mot : ', select('holdMs', HOLD_CHOICES)),
    h('label', { class: 'check' }, '♿ Balayage visuel (Switch Scanning) : ', select('scanMs', SCAN_CHOICES)),
    h('label', { class: 'check' }, confirmClearChk, ' Demander 2 touchers sur ✕ pour vider la phrase (en plus du bouton ↩ d’annulation de 4 s)'),
    h('p', { class: 'note' }, 'Les mots proposés sous la phrase sont appris localement sur cet appareil et ne quittent jamais le téléphone.'),
    h('button', { type: 'button', class: 'btn ghost tiny', onclick: async (e) => { await resetSuggestions(); e.target.textContent = 'Mots proposés remis à zéro ✔'; } }, 'Remettre les mots proposés à zéro'));
}
