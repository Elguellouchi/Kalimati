// Kalimati v3 : 5 espaces (Parler, Séance ABA, Routines, Émotions & famille, Progrès PEI). Tout reste dans le téléphone.
import { CATEGORIES, GRAMMAR, defaultCards, visualKeyOf, TOILET_CARD_ID, SELF_CARD_ID } from './data.js';
import * as db from './db.js';
import { sayCard, sayCards, stopSpeaking, speak, unlockAudio, loadDefaultVoices, defaultVoiceUrl } from './speech.js';
import { openEditor } from './editor.js';
import { exportBackup, readBackup } from './backup.js';
import { h } from './modules/util.js';
import { loadContext, recordTrial, todayTrials, firstName } from './modules/aba.js';
import { assignPositions, relayout, nextFreeSlot, moveCard } from './modules/grid-layout.js';
import { createNavigator } from './modules/spaces.js';
import { dashboardScreen } from './modules/dashboard.js';
import { toiletReminder, logToilet } from './modules/ex-autonomy.js';
import { loadVisuals, renderVisual } from './modules/visuals.js';

const HOLD_TO_UNLOCK_MS = 3000;
const MAX_STRIP = 8;
const CORE_CAT = 'base';
const REMINDER_CHECK_MS = 30000;
const SNOOZE_MS = 10 * 60000;
const EXPORTED_SETTINGS = ['lang', 'cols', 'clinic', 'profile', 'toiletReminder'];

const state = { cards: [], cat: 'manger', lang: 'fr', cols: 4, parent: false, strip: [], space: 'talk', playing: -1 };
const photoUrls = new Map();
const $ = (selector) => document.querySelector(selector);
const nav = createNavigator({ container: null, state });

// ---------- Cartes ----------
const label = (card, lang = state.lang) => (lang === 'dr' ? (card.dr || card.fr) : card.fr);

function photoUrl(card) {
  const cached = photoUrls.get(card.id);
  if (cached && cached.blob === card.photo) return cached.url;
  if (cached) URL.revokeObjectURL(cached.url);
  if (!card.photo) { photoUrls.delete(card.id); return null; }
  const url = URL.createObjectURL(card.photo);
  photoUrls.set(card.id, { blob: card.photo, url });
  return url;
}

// Image d'une carte : photo mise dans la carte, sinon photo / illustration partagée (visualKey), sinon emoji.
function cardVisual(card) {
  const url = photoUrl(card);
  if (url) return h('img', { src: url, alt: '' });
  return renderVisual({ visualKey: visualKeyOf(card), emoji: card.emoji || '❔' }, { button: false });
}

function cardElement(card, { small = false, lang = state.lang } = {}) {
  const category = CATEGORIES.find((c) => c.id === card.cat);
  const gram = GRAMMAR[card.gram] || GRAMMAR.noun;
  const button = h('button', { type: 'button', class: `card${small ? ' small' : ''}${card.hidden ? ' is-hidden' : ''}`, 'aria-label': label(card, lang) },
    cardVisual(card), h('span', { class: 'label' }, label(card, lang)),
    card.sub && !small ? h('span', { class: 'sub' }, card.sub) : null,
    card.video ? h('span', { class: 'badge video' }, '▶') : null);
  button.style.setProperty('--gram', gram.color);
  button.style.setProperty('--cat', category ? category.color : '#999');
  if (state.parent && !small) {
    if (state.lang === 'dr' && !card.audioDr && !defaultVoiceUrl(card, 'dr')) button.append(h('span', { class: 'badge dr' }, '🎙️ Voix Darija à enregistrer'));
    if (card.hidden) button.append(h('span', { class: 'badge hidden-badge' }, '🙈 masquée'));
    if (card.cat === 'personnes' && !card.photo && !button.querySelector('.has-photo')) button.append(h('span', { class: 'badge add-photo' }, `📷 Ajouter la photo`));
  }
  return button;
}

function playCardVideo(card) {
  const url = URL.createObjectURL(card.video);
  const video = h('video', { src: url, autoplay: true, muted: true, playsinline: true });
  const overlay = h('div', { class: 'video-overlay', onclick: () => close() }, video);
  const close = () => { overlay.remove(); URL.revokeObjectURL(url); };
  video.onended = close;
  video.onerror = close;
  document.body.append(overlay);
}

function onCardTap(card, element) {
  if (state.parent) { editCard(card); return; }
  element.classList.remove('pressed');
  void element.offsetWidth;
  element.classList.add('pressed');
  stopSpeaking();
  sayCard(card, state.lang);
  if (card.video) playCardVideo(card);
  if (state.strip.length < MAX_STRIP) state.strip = [...state.strip, { card, lang: state.lang }];
  renderStrip();
}

// ---------- Bande de phrase (chaque mot garde sa langue : code-switching) ----------
function renderStrip() {
  const items = state.strip.map((item, i) => {
    const el = cardElement(item.card, { small: true, lang: item.lang });
    if (i === state.playing) el.classList.add('lit');
    return el;
  });
  $('#strip-cards').replaceChildren(...items);
  $('#strip').classList.toggle('empty', state.strip.length === 0);
  $('#btn-lang').textContent = state.lang === 'dr' ? 'DR' : 'FR';
}

function setupStrip() {
  $('#btn-play').onclick = () => sayCards(state.strip, { onStep: (i) => { state.playing = i; renderStrip(); } });
  $('#btn-back').onclick = () => { state.strip = state.strip.slice(0, -1); renderStrip(); };
  $('#btn-clear').onclick = () => { stopSpeaking(); state.strip = []; state.playing = -1; renderStrip(); };
  $('#btn-lang').onclick = async () => { state.lang = state.lang === 'dr' ? 'fr' : 'dr'; await db.setSetting('lang', state.lang); renderAll(); };
}

// ---------- Espace Parler ----------
const sortedCards = (cat) => state.cards.filter((c) => c.cat === cat).sort((a, b) => (a.gridRow - b.gridRow) || (a.gridCol - b.gridCol) || (a.order - b.order));
const visibleFor = (card) => state.parent || !card.hidden;

function renderTalk() {
  const core = h('nav', { class: 'core', 'aria-label': 'Mots essentiels' }, sortedCards(CORE_CAT).filter(visibleFor).map((card) => {
    const el = cardElement(card, { small: true });
    el.onclick = () => onCardTap(card, el);
    return el;
  }));
  const tabs = h('nav', { class: 'tabs', 'aria-label': 'Catégories' }, CATEGORIES.filter((c) => c.id !== CORE_CAT).map((category) => {
    const tab = h('button', { type: 'button', class: `tab${category.id === state.cat ? ' active' : ''}`, onclick: () => { state.cat = category.id; renderView(); } },
      state.lang === 'dr' ? category.dr : category.fr);
    tab.style.setProperty('--cat', category.color);
    return tab;
  }));
  const grid = h('div', { class: 'grid', style: { '--cols': state.cols } });
  for (const card of sortedCards(state.cat)) {
    const el = cardElement(card);
    el.style.gridRow = String(card.gridRow);
    el.style.gridColumn = String(card.gridCol);
    if (card.hidden && !state.parent) el.style.visibility = 'hidden';
    el.onclick = () => onCardTap(card, el);
    grid.append(el);
  }
  if (state.parent) {
    const slot = nextFreeSlot(state.cards, state.cat, state.cols);
    const add = h('button', { type: 'button', class: 'card add', onclick: () => editCard(null) }, h('span', { class: 'emoji' }, '＋'), h('span', { class: 'label' }, 'Ajouter'));
    add.style.gridRow = String(slot.gridRow);
    add.style.gridColumn = String(slot.gridCol);
    grid.append(add);
  }
  const personalise = state.parent && ['emotions', 'personnes'].includes(state.cat)
    ? h('button', { type: 'button', class: 'btn primary wide photo-cta', onclick: () => { state.space = 'emotions'; renderSpaces(); nav.openGallery(); } },
      state.cat === 'emotions' ? `📸 Personnaliser les émotions avec les vraies photos d’${firstName()}, de sa sœur, de Papa et Maman` : '📸 Mettre les vraies photos de la famille')
    : null;
  return h('div', { class: 'talk' }, core, tabs, personalise, grid, state.parent ? legend() : null);
}

const legend = () => h('div', { class: 'legend' }, Object.values(GRAMMAR).map((g) => h('span', {}, h('i', { style: { background: g.color } }), g.label)));

async function saveCards(changed) {
  await db.putCards(changed);
  const ids = new Set(changed.map((c) => c.id));
  state.cards = [...state.cards.filter((c) => !ids.has(c.id)), ...changed];
}

function editCard(card) {
  openEditor(card, {
    defaultCat: state.cat,
    onSave: async (saved, { slot, catChanged }) => {
      let cards = state.cards.filter((c) => c.id !== saved.id);
      let placed = saved;
      if (!saved.gridRow || catChanged) placed = { ...saved, ...nextFreeSlot(cards, saved.cat, state.cols) };
      cards = [...cards, placed];
      if (slot && slot.col <= state.cols) cards = moveCard(cards, placed.id, slot.row, slot.col);
      const changed = cards.filter((c) => c !== state.cards.find((old) => old.id === c.id));
      await saveCards(changed);
      state.strip = state.strip.map((item) => (item.card.id === saved.id ? { ...item, card: state.cards.find((c) => c.id === saved.id) } : item));
      renderAll();
    },
    onDelete: async (id) => {
      await db.deleteCard(id);
      state.cards = state.cards.filter((c) => c.id !== id);
      state.strip = state.strip.filter((item) => item.card.id !== id);
      renderAll();
    },
  });
}

// ---------- Les 5 espaces ----------
const SPACES = [
  ['talk', '🗣️', 'Parler'], ['session', '🧩', 'Séance ABA'], ['routines', '⏳', 'Routines'], ['emotions', '😊', 'Émotions'], ['progress', '📊', 'Progrès'],
];

function renderSpaces() {
  $('#spaces').replaceChildren(...SPACES.map(([id, emoji, text]) => h('button', {
    type: 'button', class: `space-btn${state.space === id ? ' active' : ''}`, onclick: () => openSpace(id),
  }, h('span', { class: 'emoji' }, emoji), h('span', {}, text), id === 'progress' && !state.parent ? h('span', { class: 'mini-lock' }, '🔒') : null)));
}

function openSpace(id) {
  state.space = id;
  renderSpaces();
  renderView();
}

function renderView() {
  const view = $('#view');
  nav.leave();
  if (state.space === 'talk') { view.replaceChildren(renderTalk()); return; }
  if (state.space === 'session') { nav.openSession(); return; }
  if (state.space === 'routines') { nav.openRoutines(); return; }
  if (state.space === 'emotions') { nav.openEmotions(); return; }
  view.replaceChildren(state.parent ? dashboardScreen(nav) : h('div', { class: 'screen locked' },
    h('p', { class: 'ask' }, '🔒 Le suivi du PEI est réservé aux adultes.'), h('p', { class: 'note' }, 'Restez appuyé 3 secondes sur le cadenas en haut à droite.')));
}

function renderAll() {
  document.body.classList.toggle('parent', state.parent);
  document.querySelectorAll('[data-lang-choice]').forEach((b) => b.classList.toggle('active', b.dataset.langChoice === state.lang));
  $('#cols').value = String(state.cols);
  renderStrip();
  renderSpaces();
  // On ne coupe pas un exercice en cours quand le parent verrouille ou déverrouille.
  if (state.space === 'talk' || state.space === 'progress' || !$('#view').firstChild) renderView();
  renderToiletCount();
}

// ---------- Bouton permanent 🚽 Toilettes (X.1) ----------
async function renderToiletCount() {
  const count = (await todayTrials('X.1')).filter((t) => t.result === 'plus').length;
  $('#toilet-count').textContent = state.parent ? `${count}/4` : '';
}

function setupToilet() {
  $('#toilet').onclick = async () => {
    stopSpeaking();
    const card = state.cards.find((c) => c.id === TOILET_CARD_ID);
    if (card) sayCard(card, state.lang); else speak(state.lang === 'dr' ? 'بيت الما' : 'Toilettes', { lang: state.lang === 'dr' ? 'ar' : 'fr' });
    await recordTrial('X.1', 'plus', { item: 'spontanee', meta: { source: 'bouton' } });
    $('#toilet').classList.add('pressed');
    setTimeout(() => $('#toilet').classList.remove('pressed'), 600);
    renderToiletCount();
  };
}

// Rappel planifié X.3 : bandeau doux, sans son agressif.
let reminderShown = false;
async function checkReminder() {
  const reminder = await toiletReminder.get();
  const banner = $('#reminder');
  if (!reminder.next || Date.now() < reminder.next) { banner.hidden = true; reminderShown = false; return; }
  if (!reminderShown) { reminderShown = true; speak('C’est l’heure des toilettes.'); }
  const done = async (kind) => { await logToilet(kind); banner.hidden = true; reminderShown = false; renderToiletCount(); };
  banner.replaceChildren(h('strong', {}, '🚽 C’est l’heure des toilettes'),
    h('button', { type: 'button', class: 'btn rate-plus', onclick: () => done('dry') }, 'Passage sec ✅'),
    h('button', { type: 'button', class: 'btn rate-minus', onclick: () => done('accident') }, 'Accident ⚠️'),
    h('button', { type: 'button', class: 'btn ghost', onclick: async () => { await db.setSetting('toiletReminder', { ...reminder, next: Date.now() + SNOOZE_MS }); banner.hidden = true; reminderShown = false; } }, 'Dans 10 min'));
  banner.hidden = false;
}

// ---------- Mode parent (appui long de 3 secondes sur le cadenas) ----------
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

async function collectSettings() {
  const entries = await Promise.all(EXPORTED_SETTINGS.map(async (key) => [key, await db.getSetting(key)]));
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

function setupParentBar() {
  document.querySelectorAll('[data-lang-choice]').forEach((button) => {
    button.onclick = async () => { state.lang = button.dataset.langChoice; await db.setSetting('lang', state.lang); renderAll(); };
  });
  $('#cols').onchange = async (e) => {
    state.cols = Number(e.target.value);
    await db.setSetting('cols', state.cols);
    const cards = relayout(state.cards, state.cols);
    await db.putCards(cards);
    state.cards = cards;
    renderView();
  };
  $('#photos').onclick = () => { state.space = 'emotions'; renderSpaces(); nav.openGallery(); };
  $('#export').onclick = async () => exportBackup({ cards: state.cards, trials: await db.getAllTrials(), settings: await collectSettings(), visuals: await db.getAllVisualOverrides() });
  $('#import').onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = await readBackup(file);
      const extra = backup.trials.length ? ` et ${backup.trials.length} essais notés` : '';
      if (!window.confirm(`Remplacer les cartes actuelles par ${backup.cards.length} cartes${extra} de la sauvegarde ?`)) return;
      const cards = assignPositions(backup.cards, state.cols);
      await db.clearCards();
      await db.putCards(cards);
      if (backup.trials.length) await db.putTrials(backup.trials);
      if (backup.visuals.length) await db.putVisualOverrides(backup.visuals);
      for (const key of EXPORTED_SETTINGS) if (backup.settings[key] !== undefined) await db.setSetting(key, backup.settings[key]);
      await loadContext();
      await loadVisuals();
      state.cards = cards; state.strip = [];
      renderAll();
    } catch (error) {
      window.alert(error.message || 'Sauvegarde illisible.');
    }
  };
}

// ---------- Démarrage et passages v1 → v2 → v3 (aucune carte ni photo existante n'est perdue) ----------
const stripNew = ({ newIn, ...card }) => card;
const untouched = (card) => !card.photo && !card.video && !card.audioFr && !card.audioDr;

function migrateCards(cards, fromVersion) {
  const defaults = defaultCards();
  const byId = new Map(defaults.map((c) => [c.id, c]));
  const present = new Set(cards.map((c) => c.id));
  const upgraded = cards
    // Doublon « Abir » de la version de 21h : la carte « Abir (Moi) » la remplace si elle n'a pas été personnalisée.
    .filter((card) => !(card.id === 'c-personnes-abir' && untouched(card)))
    .map((card) => {
      const base = byId.get(card.id);
      const next = {
        ...card,
        gram: card.gram || (base ? base.gram : 'noun'),
        ar: card.ar ?? (base ? base.ar : ''),
        video: card.video || null,
        hidden: Boolean(card.hidden),
        gridRow: card.gridRow || null,
        gridCol: card.gridCol || null,
        visualKey: card.visualKey || (base ? base.visualKey : null),
        sub: card.sub ?? (base ? base.sub : ''),
        sayFr: card.sayFr ?? (base ? base.sayFr : ''),
        sayAr: card.sayAr ?? (base ? base.sayAr : ''),
      };
      if (card.id === SELF_CARD_ID && card.fr === 'Moi' && base) next.fr = base.fr;
      return next;
    });
  const added = defaults.filter((c) => c.newIn > fromVersion && !present.has(c.id)).map(stripNew);
  return [...upgraded, ...added];
}

async function loadCards() {
  let cards = await db.getAllCards();
  if (cards.length === 0 && !(await db.getSetting('seeded'))) {
    cards = defaultCards().map(stripNew);
    await db.setSetting('seeded', true);
  } else if (!(await db.getSetting('v3migrated'))) {
    cards = migrateCards(cards, (await db.getSetting('v2migrated')) ? 2 : 1);
    const kept = new Set(cards.map((c) => c.id));
    await Promise.all((await db.getAllCards()).filter((c) => !kept.has(c.id)).map((c) => db.deleteCard(c.id)));
  }
  await db.setSetting('v2migrated', true);
  await db.setSetting('v3migrated', true);
  const placed = assignPositions(cards, state.cols);
  await db.putCards(placed);
  return placed;
}

async function init() {
  nav.attach($('#view'));
  state.lang = (await db.getSetting('lang')) || 'fr';
  state.cols = (await db.getSetting('cols')) || 4;
  await loadContext();
  await loadVisuals();
  await loadDefaultVoices();
  state.cards = await loadCards();
  setupLock(); setupParentBar(); setupStrip(); setupToilet();
  // Safari (iPhone) ne compte comme « geste » que la fin du toucher ou le clic, pas le début.
  ['touchend', 'click'].forEach((type) => document.addEventListener(type, unlockAudio));
  // Une photo changée dans un exercice se met aussi à jour sur les cartes de l'espace Parler.
  document.addEventListener('visual-changed', () => { if (state.space === 'talk') renderView(); renderStrip(); });
  renderAll();
  checkReminder();
  setInterval(checkReminder, REMINDER_CHECK_MS);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init().catch((error) => {
  const message = document.createElement('p');
  message.className = 'fatal';
  message.textContent = `L'application n'a pas pu démarrer : ${String(error.message || error)}`;
  document.body.replaceChildren(message);
});
