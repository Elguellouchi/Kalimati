// Écran principal : l'enfant touche une image, le téléphone parle.
import { CATEGORIES, defaultCards } from './data.js';
import * as db from './db.js';
import { sayCard, sayCards, stopSpeaking } from './speech.js';
import { openEditor } from './editor.js';
import { exportBackup, readBackup } from './backup.js';

const HOLD_TO_UNLOCK_MS = 1500;
const MAX_STRIP = 8;
const CORE_CAT = 'base';

const state = { cards: [], cat: 'manger', lang: 'fr', cols: 4, parent: false, strip: [] };
const photoUrls = new Map();
const $ = (selector) => document.querySelector(selector);

function label(card) {
  return state.lang === 'dr' ? (card.dr || card.fr) : card.fr;
}

function photoUrl(card) {
  const cached = photoUrls.get(card.id);
  if (cached && cached.blob === card.photo) return cached.url;
  if (cached) URL.revokeObjectURL(cached.url);
  if (!card.photo) { photoUrls.delete(card.id); return null; }
  const url = URL.createObjectURL(card.photo);
  photoUrls.set(card.id, { blob: card.photo, url });
  return url;
}

function cardElement(card, { small = false } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = small ? 'card small' : 'card';
  const category = CATEGORIES.find((c) => c.id === card.cat);
  button.style.setProperty('--cat', category ? category.color : '#999');
  const url = photoUrl(card);
  const visual = document.createElement(url ? 'img' : 'span');
  if (url) { visual.src = url; visual.alt = ''; } else { visual.className = 'emoji'; visual.textContent = card.emoji || '❔'; }
  const text = document.createElement('span');
  text.className = 'label';
  text.textContent = label(card);
  button.append(visual, text);
  button.setAttribute('aria-label', label(card));
  return button;
}

function onCardTap(card, element) {
  if (state.parent) { editCard(card); return; }
  element.classList.remove('pressed');
  void element.offsetWidth;
  element.classList.add('pressed');
  stopSpeaking();
  sayCard(card, state.lang);
  if (state.strip.length < MAX_STRIP) state.strip = [...state.strip, card];
  renderStrip();
}

function renderStrip() {
  const box = $('#strip-cards');
  box.replaceChildren(...state.strip.map((card) => cardElement(card, { small: true })));
  $('#strip').classList.toggle('empty', state.strip.length === 0);
}

function renderCore() {
  const core = sortedCards(CORE_CAT);
  $('#core').replaceChildren(...core.map((card) => {
    const el = cardElement(card, { small: true });
    el.onclick = () => onCardTap(card, el);
    return el;
  }));
}

function renderTabs() {
  const tabs = CATEGORIES.filter((c) => c.id !== CORE_CAT).map((category) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `tab${category.id === state.cat ? ' active' : ''}`;
    tab.style.setProperty('--cat', category.color);
    tab.textContent = state.lang === 'dr' ? category.dr : category.fr;
    tab.onclick = () => { state.cat = category.id; renderTabs(); renderGrid(); };
    return tab;
  });
  $('#tabs').replaceChildren(...tabs);
}

function sortedCards(cat) {
  return state.cards.filter((c) => c.cat === cat).sort((a, b) => a.order - b.order);
}

function renderGrid() {
  const grid = $('#grid');
  grid.style.setProperty('--cols', state.cols);
  const items = sortedCards(state.cat).map((card) => {
    const el = cardElement(card);
    el.onclick = () => onCardTap(card, el);
    return el;
  });
  if (state.parent) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'card add';
    add.innerHTML = '<span class="emoji">＋</span><span class="label">Ajouter</span>';
    add.onclick = () => editCard(null);
    items.push(add);
  }
  grid.replaceChildren(...items);
}

function renderAll() {
  document.body.classList.toggle('parent', state.parent);
  document.querySelectorAll('[data-lang-choice]').forEach((b) => b.classList.toggle('active', b.dataset.langChoice === state.lang));
  $('#cols').value = String(state.cols);
  renderStrip(); renderCore(); renderTabs(); renderGrid();
}

function editCard(card) {
  openEditor(card, {
    defaultCat: state.cat,
    onSave: async (saved) => {
      await db.putCard(saved);
      state.cards = [...state.cards.filter((c) => c.id !== saved.id), saved];
      state.strip = state.strip.map((c) => (c.id === saved.id ? saved : c));
      renderAll();
    },
    onDelete: async (id) => {
      await db.deleteCard(id);
      state.cards = state.cards.filter((c) => c.id !== id);
      state.strip = state.strip.filter((c) => c.id !== id);
      renderAll();
    },
  });
}

function setupLock() {
  const lock = $('#lock');
  let timer = null;
  let justUnlocked = false;
  const cancel = () => { clearTimeout(timer); timer = null; lock.classList.remove('holding'); };
  lock.addEventListener('pointerdown', () => {
    if (state.parent) return;
    lock.classList.add('holding');
    timer = setTimeout(() => { cancel(); justUnlocked = true; state.parent = true; renderAll(); }, HOLD_TO_UNLOCK_MS);
  });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((type) => lock.addEventListener(type, cancel));
  lock.addEventListener('click', () => {
    if (justUnlocked) { justUnlocked = false; return; }
    if (state.parent) { state.parent = false; renderAll(); }
  });
  lock.addEventListener('contextmenu', (e) => e.preventDefault());
}

function setupParentBar() {
  document.querySelectorAll('[data-lang-choice]').forEach((button) => {
    button.onclick = async () => { state.lang = button.dataset.langChoice; await db.setSetting('lang', state.lang); renderAll(); };
  });
  $('#cols').onchange = async (e) => { state.cols = Number(e.target.value); await db.setSetting('cols', state.cols); renderGrid(); };
  $('#export').onclick = () => exportBackup(state.cards);
  $('#import').onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const cards = await readBackup(file);
      if (!window.confirm(`Remplacer les cartes actuelles par ${cards.length} cartes de la sauvegarde ?`)) return;
      await db.clearCards();
      await db.putCards(cards);
      state.cards = cards; state.strip = [];
      renderAll();
    } catch (error) {
      window.alert(error.message || 'Sauvegarde illisible.');
    }
  };
}

function setupStrip() {
  $('#btn-play').onclick = () => sayCards(state.strip, state.lang);
  $('#btn-back').onclick = () => { state.strip = state.strip.slice(0, -1); renderStrip(); };
  $('#btn-clear').onclick = () => { stopSpeaking(); state.strip = []; renderStrip(); };
}

async function init() {
  state.lang = (await db.getSetting('lang')) || 'fr';
  state.cols = (await db.getSetting('cols')) || 4;
  let cards = await db.getAllCards();
  if (cards.length === 0 && !(await db.getSetting('seeded'))) {
    cards = defaultCards();
    await db.putCards(cards);
    await db.setSetting('seeded', true);
  }
  state.cards = cards;
  setupLock(); setupParentBar(); setupStrip();
  renderAll();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
}

init().catch((error) => {
  const message = document.createElement('p');
  message.className = 'fatal';
  message.textContent = `L'application n'a pas pu démarrer : ${String(error.message || error)}`;
  document.body.replaceChildren(message);
});
