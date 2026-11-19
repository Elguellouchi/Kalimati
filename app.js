// Kalimati v10.5 (accessibilité, sons hors ligne sur iPhone, synchro plus sûre, effacement du serveur possible). Avant, v10.4 (plus de rechargement après un pack ou une synchro, balayage et cadenas plus sûrs).
import './modules/util.js'; // en premier : garde-fou contre les textes « null »
import { CATEGORIES, GRAMMAR, defaultCards, visualKeyOf, TOILET_CARD_ID, SELF_CARD_ID } from './data.js';
import * as db from './db.js';
import { sayCard, sayCards, sayNaturalSentence, setCardCatalog, stopSpeaking, speak, unlockAudio, loadDefaultVoices, defaultVoiceUrl, setCloudSpeechAllowed, SPEECH_SETTING_KEY } from './speech.js';
import { openEditor } from './editor.js';
import { unlockSounds } from './media.js';
import { buildBackupFile, deliverBackup, readBackup } from './backup.js';
import { h, btn } from './modules/util.js';
import { loadContext, recordTrial, todayTrials, firstName } from './modules/aba.js';
import { nour } from './modules/nour.js';
import { assignPositions, relayout, nextFreeSlot, moveCard } from './modules/grid-layout.js';
import { createNavigator } from './modules/spaces.js';
import { dashboardScreen } from './modules/dashboard.js';
import { toiletReminder, logToilet } from './modules/ex-autonomy.js';
import { loadLevels } from './modules/levels.js';
import { openCalm } from './modules/calm.js';
import { logOrtho } from './modules/ex-ortho.js';
import { LANGS, langInfo, isExtraLang, cardWord, categoryName, ui } from './modules/languages.js';
import { loadAacPlus, learnTap, suggestionsFor, trackPress, touchAllowed, touchSettingsBox, scanSpeed, clearConfirmNeeded } from './modules/aac-plus.js';
import { loadVisuals, renderVisual, hasPhoto, setVisual, clearVisual } from './modules/visuals.js';
import { uiIcon } from './modules/ui-icons.js';
import { loadFriendsState, friendCompanionBanner, unlockFriendSticker } from './modules/friends.js';
import { loadMorphologyState, inflectStrip, renderMorphologyBar } from './modules/morphology.js';
import { loadEyeTracking } from './modules/eye-and-packs.js';
import { initCloudSyncFromUrlAndAuto, captureMagicKeyFromUrl } from './modules/cloud-sync.js';
import { APP_VERSION, checkUrlInvite, openSetupWizard, superAdminScreen } from './modules/admin-beta.js';

const HOLD_TO_UNLOCK_MS = 3000;
const MAX_STRIP = 8;
const CORE_CAT = 'base';
const REMINDER_CHECK_MS = 30000;
const SNOOZE_MS = 10 * 60000;
// v9.7 : la sauvegarde simple garde aussi le planning, les histoires, le bilan ATEC, les mots proposés et le toucher adapté.
const EXPORTED_SETTINGS = ['lang', 'cols', 'clinic', 'profile', 'toiletReminder', 'levels',
  'customSchedules', 'scheduleTempOverrides', 'stories', 'atecHistory', 'atec_history', 'aacHistory', 'touch', 'visualStyle', 'childGender', 'therapistName', 'speechCloudAllowed', 'friendsAlbum', 'hideFriends'];

const state = { cards: [], cat: 'manger', lang: 'fr', cols: 4, parent: false, strip: [], space: 'home', playing: -1, modeling: false, model: [] };
const photoUrls = new Map();
const $ = (selector) => document.querySelector(selector);
const nav = createNavigator({ container: null, state, goHome: () => openSpace('home') });

// ---------- Cartes ----------
const label = (card, lang = state.lang) => cardWord(card, lang);
// Voix du téléphone pour un texte de menu : la langue choisie (darija en lettres latines : voix française).
const menuVoice = () => (isExtraLang(state.lang) ? state.lang : 'fr');

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
  const key = visualKeyOf(card);
  // Une photo partagée (éditeur, « Nos vraies photos », miroir magique) passe toujours en premier.
  const url = hasPhoto(key) ? null : photoUrl(card);
  if (url) return h('img', { src: url, alt: '' });
  return renderVisual({ visualKey: visualKeyOf(card), emoji: card.emoji || '❔', label: card.fr }, { button: false });
}

function cardElement(card, { small = false, lang = state.lang } = {}) {
  const category = CATEGORIES.find((c) => c.id === card.cat);
  const gram = GRAMMAR[card.gram] || GRAMMAR.noun;
  const ariaLabel = card.hidden && state.parent ? `${label(card, lang)} (carte masquée)` : label(card, lang);
  const button = h('button', { type: 'button', class: `card${small ? ' small' : ''}${card.hidden ? ' is-hidden' : ''}`, 'aria-label': ariaLabel },
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
  // v10.5 (A11) : bouton « Fermer » visible, touche Échap, et retour à la carte touchée.
  const opener = document.activeElement;
  let closed = false;
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
  const closeBtn = h('button', { type: 'button', class: 'btn primary video-close-btn', 'aria-label': 'Fermer la vidéo', onclick: (e) => { e.stopPropagation(); close(); } }, '✕ Fermer');
  const overlay = h('div', { class: 'video-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Vidéo : ${card.fr || ''}`, onclick: () => close() }, video, closeBtn);
  function close() {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    overlay.remove(); URL.revokeObjectURL(url);
    try { opener?.focus?.(); } catch { /* rien */ }
  }
  document.addEventListener('keydown', onKey);
  video.onended = close;
  video.onerror = close;
  document.body.append(overlay);
  closeBtn.focus();
}

// Filtre anti-rebond : ignore un second toucher involontaire (< 450 ms) sur la même carte, tout en laissant enchaîner deux cartes différentes sans délai.
const SAME_CARD_COOLDOWN_MS = 450;
let lastCardTap = { key: null, at: 0 };

// pressMs : durée d'appui (option « toucher adapté »). Mode « Je montre » : l'adulte montre les mots sans remplir la phrase d'Abir.
function onCardTap(card, element, pressMs = Number.MAX_SAFE_INTEGER) {
  if (state.parent) { editCard(card); return; }
  if (!touchAllowed(pressMs)) return;
  const now = performance.now();
  // Identité de la carte : son id, sinon l'élément affiché (évite de bloquer deux cartes différentes sans id).
  const tapKey = (card && card.id != null) ? card.id : element;
  if (tapKey === lastCardTap.key && now - lastCardTap.at < SAME_CARD_COOLDOWN_MS) return;
  lastCardTap = { key: tapKey, at: now };
  element.classList.remove('pressed');
  void element.offsetWidth;
  element.classList.add('pressed', 'card-just-tapped');
  clearTimeout(element._tapFeedbackTimer);
  element._tapFeedbackTimer = setTimeout(() => element.classList.remove('card-just-tapped'), SAME_CARD_COOLDOWN_MS);
  stopSpeaking();
  sayCard(card, state.lang);
  if (state.modeling) {
    state.model = [...state.model, { card, lang: state.lang }].slice(-MAX_STRIP);
    element.classList.add('modeled');
    setTimeout(() => element.classList.remove('modeled'), 1200);
    renderModel();
    return;
  }
  if (card.video) playCardVideo(card);
  learnTap(state.strip.length ? state.strip[state.strip.length - 1].card.id : null, card);
  if (state.strip.length < MAX_STRIP) state.strip = [...state.strip, { card, lang: state.lang }];
  renderStrip();
}

// ---------- Bande de phrase (chaque mot garde sa langue : code-switching) ----------
// v9.13 : le moteur hors-ligne (modules/morphology.js) conjugue et accorde la phrase. Seulement en français et en darija.
const morphLangOk = (strip) => strip.length > 0 && strip.every((item) => item.lang === 'fr' || item.lang === 'dr');
function stripInflection() {
  if (!morphLangOk(state.strip)) return null;
  try { return inflectStrip(state.strip); } catch { return null; }
}

function renderStrip() {
  setCardCatalog(state.cards);
  const inflected = stripInflection();
  const items = state.strip.map((item, i) => {
    const el = cardElement(item.card, { small: true, lang: item.lang });
    if (i === state.playing) el.classList.add('lit');
    // Étiquette conjuguée / accordée sous la carte (« Manger » devient « mange », « Content » devient « contente »).
    const shown = inflected && inflected.tokens[i] && inflected.tokens[i].displayLabel;
    const lab = el.querySelector('.label');
    if (shown && lab && shown.trim().toLowerCase() !== lab.textContent.trim().toLowerCase()) {
      lab.textContent = shown;
      lab.classList.add('inflected');
      el.title = shown;
    }
    return el;
  });
  renderMorphSlot();
  const row = $('#strip-cards');
  row.replaceChildren(...items);
  // v9.7 : on montre toujours le dernier mot ajouté (ou le mot dit), même sur petit téléphone.
  const focus = items[state.playing] || items[items.length - 1];
  if (focus) row.scrollLeft = focus.offsetLeft + focus.offsetWidth - row.clientWidth + 6;
  $('#strip').classList.toggle('empty', state.strip.length === 0);
  $('#btn-lang').textContent = langInfo(state.lang).short;
  $('#btn-lang').setAttribute('aria-label', `Langue : ${langInfo(state.lang).name}. Changer de langue`);
  renderSuggestions();
}

// v9.13 : barre « ⏪ Hier / ⏺ Maintenant / ⏩ Après » + aperçu de la phrase complète (français et darija), sous la bande.
function renderMorphSlot() {
  const slot = document.getElementById('morph-slot');
  if (!slot) return;
  const show = morphLangOk(state.strip) && ['talk', 'home'].includes(state.space) && !state.modeling;
  const lang = state.strip.every((item) => item.lang === 'dr') ? 'dr' : 'fr';
  const bar = show ? renderMorphologyBar(state.strip, {
    lang,
    onTenseChange: () => renderStrip(),
    onSpeakNatural: async (sentences) => {
      unlockAudio();
      // Darija sans voix arabe sur le téléphone : on rejoue les mots un par un (sons enregistrés).
      const said = await sayNaturalSentence(sentences);
      if (!said) sayCards(state.strip, { onStep: (i) => { state.playing = i; renderStrip(); } });
    },
  }) : null;
  slot.replaceChildren(...(bar ? [bar] : []));
  slot.hidden = !bar;
}

// Mots proposés après le dernier mot de la phrase (appris sur les phrases d'Abir).
function renderSuggestions() {
  const row = document.getElementById('suggest-row');
  if (!row) return;
  const next = state.modeling ? [] : suggestionsFor(state.strip, state.cards);
  row.replaceChildren(...(next.length ? [h('span', { class: 'suggest-label' }, '💡'), ...next.map((card) => {
    const el = cardElement(card, { small: true });
    const press = trackPress(el);
    el.onclick = () => onCardTap(card, el, press());
    return el;
  })] : []));
  row.hidden = !next.length;
}

// Ligne « Je montre » : les mots montrés par l'adulte, à réécouter.
function renderModel() {
  const line = document.getElementById('model-line');
  if (!line) return;
  line.replaceChildren(h('span', { class: 'suggest-label' }, '🧑‍🏫 Je montre :'),
    ...state.model.map((item) => cardElement(item.card, { small: true, lang: item.lang })),
    state.model.length ? h('button', { type: 'button', class: 'strip-btn play', 'aria-label': 'Redire', onclick: () => sayCards(state.model) }, '▶') : null);
}

// Mesure discrète pour le dossier orthophonique : longueur de chaque phrase dite dans Parler (une même phrase redite tout de suite ne compte qu'une fois).
const SAME_UTTERANCE_MS = 10000;
let lastUtterance = { text: '', at: 0 };
function noteUtterance() {
  if (!state.strip.length) return;
  const text = state.strip.map((item) => label(item.card, item.lang)).join(' ');
  const now = Date.now();
  if (text === lastUtterance.text && now - lastUtterance.at < SAME_UTTERANCE_MS) return;
  lastUtterance = { text, at: now };
  logOrtho({ protocol: 'aac_mlu', mlu: state.strip.length, target: text, spontaneous: !state.modeling }).catch(() => {});
}

function setupStrip() {
  $('#btn-play').onclick = () => {
    // v9.12 : une phrase d'au moins 2 mots dite par l'enfant réveille Nour dans l'Album (sans bruit ni écran en plus).
    if (state.strip.length >= 2 && !state.parent) unlockFriendSticker('nour').catch(() => {});
    noteUtterance(); sayCards(state.strip, { onStep: (i) => { state.playing = i; renderStrip(); } }); };
  $('#btn-back').onclick = () => { state.strip = state.strip.slice(0, -1); renderStrip(); };
  // v10.1.3 : « Tout effacer » marche d'un simple toucher (l'appui long de la v9.9 ne marchait pas bien sur iPhone).
  // Pour une erreur, le bouton devient « ↩ » pendant 4 s : le toucher remet la phrase.
  const clearBtn = $('#btn-clear');
  let undoStrip = null;
  let undoTimer = null;
  const endUndo = () => {
    clearTimeout(undoTimer); undoTimer = null; undoStrip = null;
    clearBtn.textContent = '✕'; clearBtn.classList.remove('undo');
    clearBtn.setAttribute('aria-label', 'Tout effacer');
  };
  clearBtn.setAttribute('aria-label', 'Tout effacer'); clearBtn.removeAttribute('title');
  // v10.5 (F11) : option du parent « 2 touchers sur ✕ » (éteinte par défaut). 1er toucher = « ✕ ? » pendant 3 s.
  let confirmTimer = null;
  const endConfirm = () => { clearTimeout(confirmTimer); confirmTimer = null; };
  clearBtn.onclick = () => {
    if (undoStrip) { state.strip = undoStrip; endUndo(); renderStrip(); return; }
    if (!state.strip.length) return;
    if (clearConfirmNeeded() && !confirmTimer) {
      clearBtn.textContent = '✕ ?';
      clearBtn.setAttribute('aria-label', 'Toucher encore pour tout effacer');
      confirmTimer = setTimeout(() => { confirmTimer = null; clearBtn.textContent = '✕'; clearBtn.setAttribute('aria-label', 'Tout effacer'); }, 3000);
      return;
    }
    endConfirm();
    stopSpeaking();
    undoStrip = state.strip; state.strip = []; state.playing = -1; renderStrip();
    clearBtn.textContent = '↩'; clearBtn.classList.add('undo');
    clearBtn.setAttribute('aria-label', 'Remettre la phrase');
    undoTimer = setTimeout(endUndo, 4000);
  };
  $('#btn-lang').onclick = openLangPicker;
}

// ---------- Espace Parler ----------
const sortedCards = (cat) => state.cards.filter((c) => c.cat === cat).sort((a, b) => (a.gridRow - b.gridRow) || (a.gridCol - b.gridCol) || (a.order - b.order));
const visibleFor = (card) => state.parent || !card.hidden;

// Apport PictoTEA : impression / export PDF du tableau CAA personnalisé (avec vraies photos / pictos)
function printAacBoard() {
  const active = state.cards.filter((c) => !c.hidden);
  const cols = CATEGORIES.map((cat) => {
    const items = active.filter((c) => c.cat === cat.id);
    if (!items.length) return null;
    return h('div', { class: 'aac-print-cat' },
      h('h3', { style: { color: cat.color } }, `${cat.emoji} ${cat.name}`),
      h('div', { class: 'aac-print-grid' }, items.map((c) => {
        const gram = GRAMMAR[c.gram] || GRAMMAR.noun;
        return h('div', { class: 'aac-print-card', style: { borderColor: gram.color } },
          cardVisual(c),
          h('strong', {}, label(c, 'fr')),
          c.dr ? h('small', {}, c.dr) : null);
      })));
  }).filter(Boolean);
  const area = h('div', { class: 'print-area' },
    h('div', { class: 'print-sheet aac-print-sheet' },
      h('h1', {}, `Tableau de communication CAA · ${firstName()}`),
      h('p', { class: 'note' }, 'Support papier / plastifié pour la maison, le cartable et la classe.'),
      ...cols));
  document.body.append(area);
  const cleanup = () => { area.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 300);
}

let scanTimer = 0;
function stopScan() { if (scanTimer) { clearInterval(scanTimer); scanTimer = 0; } }

function renderTalk() {
  stopScan();
  const core = h('nav', { class: 'core', 'aria-label': 'Mots essentiels' }, sortedCards(CORE_CAT).filter(visibleFor).map((card) => {
    const el = cardElement(card, { small: true });
    const press = trackPress(el);
    el.onclick = () => onCardTap(card, el, press());
    return el;
  }));
  const tabs = h('nav', { class: 'tabs', 'aria-label': 'Catégories' }, CATEGORIES.filter((c) => c.id !== CORE_CAT).map((category) => {
    const tab = h('button', { type: 'button', class: `tab${category.id === state.cat ? ' active' : ''}`, 'aria-current': category.id === state.cat ? 'true' : null, onclick: () => { state.cat = category.id; renderView(); } },
      categoryName(category, state.lang));
    tab.style.setProperty('--cat', category.color);
    return tab;
  }));
  const grid = h('div', { class: 'grid', style: { '--cols': state.cols } });
  for (const card of sortedCards(state.cat)) {
    const el = cardElement(card);
    el.style.gridRow = String(card.gridRow);
    el.style.gridColumn = String(card.gridCol);
    if (card.hidden && !state.parent) { el.style.visibility = 'hidden'; el.setAttribute('aria-hidden', 'true'); el.tabIndex = -1; }
    const press = trackPress(el);
    el.onclick = () => onCardTap(card, el, press());
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
  const modelToggle = state.parent ? null : h('button', { type: 'button', class: `btn ghost tiny model-toggle${state.modeling ? ' on' : ''}`,
    onclick: () => { state.modeling = !state.modeling; state.model = []; renderView(); renderSuggestions(); } },
  state.modeling ? '✋ Arrêter « Je montre »' : '🧑‍🏫 Je montre (adulte)');
  const modelLine = state.modeling ? h('div', { class: 'model-line', id: 'model-line' }) : null;
  const suggest = h('div', { class: 'suggest-row', id: 'suggest-row', hidden: true });
  // v9.12 : Nour accompagne l'espace Parler (masquable par le parent).
  const friend = state.parent ? null : friendCompanionBanner('talk', { lang: state.lang });
  const view = h('div', { class: `talk${state.modeling ? ' modeling' : ''}` }, friend, suggest, modelToggle, modelLine, core, tabs, personalise, grid,
    state.parent ? btn('🖨️ Imprimer / PDF le tableau CAA', printAacBoard, 'ghost') : null,
    state.parent ? touchSettingsBox() : null, state.parent ? legend() : null);
  const ms = scanSpeed();
  if (!state.parent && ms > 0) {
    const targets = [...grid.querySelectorAll('.card')].filter((el) => el.style.visibility !== 'hidden');
    if (targets.length) {
      let idx = 0;
      targets[0].classList.add('scan-active');
      scanTimer = setInterval(() => {
        if (!grid.isConnected) { stopScan(); return; }
        targets[idx].classList.remove('scan-active');
        idx = (idx + 1) % targets.length;
        targets[idx].classList.add('scan-active');
      }, ms);
      view.addEventListener('click', (e) => {
        // v10.4 : un onglet, un mot essentiel ou une suggestion se touchent normalement pendant le balayage.
        if (e.target.closest('.model-toggle, .tab, .tabs, .core, .suggest-row, .friend-banner')) return;
        const activeEl = targets[idx];
        if (activeEl && e.target.closest('.card') !== activeEl) {
          e.preventDefault();
          e.stopPropagation();
          activeEl.click();
        }
      }, { capture: true });
    }
  }
  queueMicrotask(() => { renderSuggestions(); renderModel(); });
  return view;
}

const legend = () => h('div', { class: 'legend' }, Object.values(GRAMMAR).map((g) => h('span', {}, h('i', { style: { background: g.color } }), g.label)));

async function saveCards(changed) {
  await db.putCards(changed);
  const ids = new Set(changed.map((c) => c.id));
  state.cards = [...state.cards.filter((c) => !ids.has(c.id)), ...changed];
}

async function editCard(card) {
  // L'éditeur montre la photo partagée de la carte (visual_overrides) si elle existe.
  const key = card ? visualKeyOf(card) : null;
  const shared = key ? await db.getVisualOverride(key) : null;
  const before = card ? ((shared && shared.blob) || card.photo || null) : null;
  openEditor(card ? { ...card, photo: before } : null, {
    defaultCat: state.cat,
    onSave: async (saved, { slot, catChanged }) => {
      let cards = state.cards.filter((c) => c.id !== saved.id);
      let placed = saved;
      if (!saved.gridRow || catChanged) placed = { ...saved, ...nextFreeSlot(cards, saved.cat, state.cols) };
      cards = [...cards, placed];
      if (slot && slot.col <= state.cols) cards = moveCard(cards, placed.id, slot.row, slot.col);
      const changed = cards.filter((c) => c !== state.cards.find((old) => old.id === c.id));
      await saveCards(changed);
      // La photo de la carte vaut partout : repas en famille, studio des émotions, exercices.
      if (saved.photo && saved.photo !== before) await setVisual(visualKeyOf(saved), saved.photo, { source: 'editor', label: saved.fr });
      if (!saved.photo && before) await clearVisual(visualKeyOf(saved));
      state.strip = state.strip.map((item) => (item.card.id === saved.id ? { ...item, card: state.cards.find((c) => c.id === saved.id) } : item));
      renderAll();
    },
    onDelete: async (id) => {
      await db.deleteCard(id);
      const cached = photoUrls.get(id); // v10.5 (C10) : libère l'image gardée en mémoire
      if (cached) { URL.revokeObjectURL(cached.url); photoUrls.delete(id); }
      state.cards = state.cards.filter((c) => c.id !== id);
      state.strip = state.strip.filter((item) => item.card.id !== id);
      renderAll();
    },
  });
}

// ---------- Les 5 espaces ----------
const SPACES = [
  ['home', '🏠', 'Accueil'], ['talk', '🗣️', 'Parler'], ['session', '🎮', 'Jeux'], ['routines', '📅', 'Ma journée'], ['emotions', '😊', 'Émotions'], ['progress', '📊', 'Progrès'],
];

function renderSpaces() {
  $('#spaces').replaceChildren(...SPACES.map(([id, emoji, text]) => h('button', {
    type: 'button', class: `space-btn${state.space === id ? ' active' : ''}`, 'aria-current': state.space === id ? 'page' : null, onclick: () => openSpace(id),
  }, h('span', { class: 'emoji' }, emoji), h('span', {}, ui(id, state.lang) || text), id === 'progress' && !state.parent ? h('span', { class: 'mini-lock' }, '🔒') : null)));
}

function openSpace(id) {
  stopScan();
  state.space = id;
  renderSpaces();
  renderView();
}

// ---------- Écran d'accueil : grandes tuiles colorées, une par espace ----------
const HOME_TILES = [
  ['talk', '🗣️', 'tTalk', 'sTalk', 'tile-talk'],
  ['session', '🎮', 'tPlay', 'sPlay', 'tile-play'],
  ['routines', '📅', 'tDay', 'sDay', 'tile-day'],
  ['emotions', '😊', 'tFeel', 'sFeel', 'tile-feel'],
];

function homeScreen() {
  const hello = `${ui('hello', state.lang)} ${firstName()} !`;
  return h('div', { class: 'screen home' },
    h('button', { type: 'button', class: 'home-hello', onclick: () => speak(hello, { lang: menuVoice() }) },
      h('span', { class: 'home-nour' }, nour({ pose: 'wave', size: 96 })),
      h('span', { class: 'home-hello-text' }, h('strong', {}, `👋 ${hello}`), h('span', {}, ui('ask', state.lang)))),
    h('button', { type: 'button', class: 'home-lang', onclick: openLangPicker }, `${langInfo(state.lang).flag} ${langInfo(state.lang).name} · 🌍 ${LANGS.length} langues`),
    h('div', { class: 'home-grid' }, HOME_TILES.map(([id, emoji, titleKey, subKey, cls]) => h('button', {
      type: 'button', class: `home-tile ${cls}`, onclick: () => { speak(ui(titleKey, state.lang), { lang: menuVoice() }); openSpace(id); },
    }, h('span', { class: 'home-emoji' }, emoji), h('strong', {}, ui(titleKey, state.lang)), h('small', {}, ui(subKey, state.lang))))),
    h('button', { type: 'button', class: 'home-adult', onclick: () => openSpace('progress') }, state.parent ? '📊 Progrès & Console Bêta (adultes)' : '🔒 Progrès (adultes)'),
    // v9.16.2 : numéro de version visible, pour vérifier que le téléphone a bien la dernière mise à jour.
    h('p', { class: 'app-version' }, `Kalimati ${APP_VERSION}`));
}

function renderView() {
  const view = $('#view');
  nav.leave();
  renderMorphSlot();
  if (state.space === 'home') { view.replaceChildren(homeScreen()); return; }
  if (state.space === 'talk') { view.replaceChildren(renderTalk()); return; }
  if (state.space === 'session') { nav.openSession(); return; }
  if (state.space === 'routines') { nav.openRoutines(); return; }
  if (state.space === 'emotions') { nav.openEmotions(); return; }
  view.replaceChildren(state.parent ? dashboardScreen(nav) : h('div', { class: 'screen locked' },
    h('p', { class: 'ask' }, '🔒 Le suivi du PEI, le partage équipe et la Console Bêta sont réservés aux adultes.'),
    h('p', { class: 'note' }, 'Restez appuyé 3 secondes sur le cadenas en haut à droite.')));
}

// v9.7 : rappel discret dans le mode parent. Photos et voix ne vivent que dans ce téléphone :
// si le téléphone est perdu ou le navigateur vidé, seule une sauvegarde les garde.
const BACKUP_REMIND_DAYS = 14;
async function showBackupAge() {
  const span = document.getElementById('backup-age');
  if (!span) return;
  const at = await db.getSetting('lastBackupAt').catch(() => null);
  const days = at ? Math.floor((Date.now() - at) / 86400000) : null;
  span.textContent = days === null ? '⚠️ Jamais sauvegardé sur ce téléphone.'
    : days === 0 ? '✅ Sauvegardé aujourd’hui.'
      : `${days >= BACKUP_REMIND_DAYS ? '⚠️' : '✅'} Dernière sauvegarde : il y a ${days} jour${days > 1 ? 's' : ''}.`;
  span.classList.toggle('late', days === null || days >= BACKUP_REMIND_DAYS);
}

function renderAll() {
  document.body.classList.toggle('parent', state.parent);
  // v10.5 (A06) : le cadenas dit son état aux lecteurs d'écran.
  const lockEl = $('#lock');
  if (lockEl) {
    lockEl.setAttribute('aria-pressed', String(state.parent));
    lockEl.setAttribute('aria-label', state.parent ? 'Mode parent ouvert : toucher pour verrouiller' : 'Mode parent verrouillé : rester appuyé 3 secondes pour ouvrir');
  }
  if (state.parent) showBackupAge();
  document.querySelectorAll('[data-lang-choice]').forEach((b) => b.classList.toggle('active', b.dataset.langChoice === state.lang));
  $('#cols').value = String(state.cols);
  renderStrip();
  renderSpaces();
  document.dispatchEvent(new CustomEvent('kalimati-parent', { detail: { parent: state.parent, lang: state.lang } }));
  // On ne coupe pas un exercice en cours quand le parent verrouille ou déverrouille.
  if (['home', 'talk', 'progress'].includes(state.space) || !$('#view').firstChild) renderView();
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
// v9.10 : panneau « Réglages parent » repliable (fermé par défaut, choix gardé sur ce téléphone).
function setupParentPanel() {
  const bar = $('#parent-bar');
  const toggle = $('#pb-toggle');
  if (!bar || !toggle) return;
  let open = false;
  try { open = localStorage.getItem('kalimati-pb-open') === '1'; } catch { open = false; }
  const apply = () => { bar.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.onclick = () => { open = !open; apply(); try { localStorage.setItem('kalimati-pb-open', open ? '1' : '0'); } catch { /* rien */ } };
  apply();
}

function setupLock() {
  const lock = $('#lock');
  lock.innerHTML = `<span class="lock-off">${uiIcon('lock', 26)}</span><span class="lock-on">${uiIcon('unlock', 26)}</span>`;
  lock.style.touchAction = 'none'; // v10.4 : un léger glissement du doigt n'annule plus l'appui sur iPhone
  let timer = null;
  let unlockedAt = 0;
  const RELOCK_GUARD_MS = 1500; // v10.4 : pas de reverrouillage accidentel juste après l'ouverture
  const cancel = () => { clearTimeout(timer); timer = null; lock.classList.remove('holding'); };
  lock.addEventListener('pointerdown', (e) => {
    if (state.parent) return;
    try { lock.setPointerCapture(e.pointerId); } catch { /* ancien navigateur */ }
    lock.classList.add('holding');
    timer = setTimeout(() => { cancel(); unlockedAt = Date.now(); state.parent = true; renderAll(); }, HOLD_TO_UNLOCK_MS);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => lock.addEventListener(type, cancel));
  // v10.5 (A05) : au clavier, garder Entrée ou Espace enfoncé 3 secondes.
  lock.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !state.parent && !timer) {
      e.preventDefault();
      lock.classList.add('holding');
      timer = setTimeout(() => { cancel(); unlockedAt = Date.now(); state.parent = true; renderAll(); }, HOLD_TO_UNLOCK_MS);
    }
  });
  lock.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') cancel(); });
  lock.addEventListener('blur', cancel);
  lock.addEventListener('click', () => {
    if (Date.now() - unlockedAt < RELOCK_GUARD_MS) return;
    if (state.parent) { state.parent = false; renderAll(); }
  });
  lock.addEventListener('contextmenu', (e) => e.preventDefault());
}

async function collectSettings() {
  const entries = await Promise.all(EXPORTED_SETTINGS.map(async (key) => [key, await db.getSetting(key)]));
  return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
}

// ---------- Choix de la langue (11 langues) ----------
async function setLang(code) {
  state.lang = langInfo(code).code;
  document.documentElement.lang = (langInfo(state.lang).tts || 'fr').split('-')[0]; // v10.5 (A21)
  // v10.5.2 : l'écran change tout de suite ; l'enregistrement suit (avant, une écriture bloquée sur iPhone empêchait le changement).
  renderAll();
  await db.setSetting('lang', state.lang).catch((err) => console.error('[Kalimati] langue non enregistrée', err));
}

function openLangPicker() {
  const opener = document.activeElement;
  const dialog = h('dialog', { class: 'lang-dialog', 'aria-label': 'Choisir la langue' });
  const close = () => { if (dialog.open) dialog.close(); dialog.remove(); try { opener?.focus?.(); } catch { /* rien */ } };
  dialog.append(h('div', { class: 'stack pad' }, h('h3', {}, '🌍 Langue / اللغة / Language'),
    h('div', { class: 'lang-grid' }, LANGS.map((l) => h('button', {
      type: 'button', class: `lang-choice${l.code === state.lang ? ' active' : ''}`, lang: l.tts, dir: l.rtl ? 'rtl' : 'auto',
      onclick: () => { close(); setLang(l.code); speak(ui('hello', l.code), { lang: isExtraLang(l.code) ? l.code : 'fr' }); },
    }, h('span', { class: 'emoji' }, l.flag), h('span', {}, l.name)))),
    h('p', { class: 'note' }, 'Français et darija : vos voix enregistrées. Autres langues : la voix du téléphone dit les mots traduits.'),
    h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Fermer')));
  document.body.append(dialog);
  dialog.showModal();
}

function setupParentBar() {
  const langSeg = document.querySelector('[data-lang-choice]')?.parentElement;
  if (langSeg) langSeg.replaceChildren(...LANGS.map((l) => h('button', { type: 'button', dataset: { langChoice: l.code }, title: l.name }, `${l.flag} ${l.short}`)));
  document.querySelectorAll('[data-lang-choice]').forEach((button) => {
    button.onclick = () => setLang(button.dataset.langChoice);
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
  const adminBtn = document.getElementById('admin-console-btn');
  if (adminBtn) {
    adminBtn.onclick = () => {
      state.space = 'progress';
      renderSpaces();
      nav.openScreen(() => superAdminScreen(nav), () => dashboardScreen(nav));
    };
  }
  const wizardBtn = document.getElementById('wizard-btn');
  if (wizardBtn) {
    wizardBtn.onclick = () => openSetupWizard({
      onDone: async () => {
        await loadContext();
        state.lang = langInfo((await db.getSetting('lang')) || 'fr').code;
        state.cols = (await db.getSetting('cols')) || 4;
        state.cards = await loadCards();
        renderAll();
      },
    });
  }
  // v9.10 : sauvegarde en 2 temps. L'écran reste libre, le bouton montre où on en est, et un message dit clairement le résultat.
  let backupFile = null;
  const exportBtn = $('#export');
  const panel = $('#backup-panel');
  const showPanel = (text, withSave) => {
    panel.replaceChildren(h('span', { class: 'backup-msg' }, text));
    if (withSave) {
      const save = h('button', { type: 'button', class: 'btn primary', id: 'backup-save' }, '📤 Enregistrer le fichier');
      const close = h('button', { type: 'button', class: 'btn ghost tiny' }, 'Fermer');
      save.onclick = async () => {
        save.disabled = true;
        try {
          const result = await deliverBackup(backupFile);
          if (result === 'cancelled') { save.disabled = false; return; }
          await db.setSetting('lastBackupAt', Date.now());
          backupFile = null;
          showPanel(result === 'shared'
            ? '✅ Sauvegarde envoyée. Gardez ce fichier en lieu sûr (Fichiers, Drive ou e-mail).'
            : '✅ Sauvegarde téléchargée. Vous la trouverez dans « Téléchargements » ou « Fichiers ».', false);
          showBackupAge();
        } catch (error) {
          save.disabled = false;
          showPanel(`⚠️ L’enregistrement n’a pas marché. Réessayez. (${error.message || 'erreur inconnue'})`, true);
        }
      };
      close.onclick = () => { backupFile = null; panel.replaceChildren(); panel.hidden = true; };
      panel.append(h('div', { class: 'backup-actions' }, save, close));
    }
    panel.hidden = false;
  };
  exportBtn.onclick = async () => {
    if (exportBtn.disabled) return;
    exportBtn.disabled = true;
    exportBtn.setAttribute('aria-busy', 'true');
    exportBtn.textContent = '⏳ Préparation… 0 %';
    panel.hidden = true;
    try {
      // v10.5 : par défaut, la sauvegarde ne contient ni photo ni voix (textes, cartes, journaux, bilans seulement).
      const includeMedia = Boolean($('#backup-media')?.checked);
      backupFile = await buildBackupFile({ cards: state.cards, trials: await db.getAllTrials(), settings: await collectSettings(),
        visuals: includeMedia ? await db.getAllVisualOverrides() : [], abcLogs: await db.getAllAbcLogs(), orthoLogs: await db.getAllOrthoLogs(), includeMedia },
      (pct) => { exportBtn.textContent = `⏳ Préparation… ${pct} %`; });
      const size = backupFile.size >= 1048576 ? `${(backupFile.size / 1048576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(backupFile.size / 1024))} Ko`;
      showPanel(`✅ Sauvegarde prête (${size}, ${includeMedia ? 'AVEC photos et voix' : 'sans photo ni voix'}). Touchez « Enregistrer le fichier » pour la garder.`, true);
    } catch (error) {
      showPanel(`⚠️ La sauvegarde n’a pas pu être préparée. Réessayez. (${error.message || 'erreur inconnue'})`, false);
    } finally {
      exportBtn.disabled = false;
      exportBtn.removeAttribute('aria-busy');
      exportBtn.textContent = '💾 Sauvegarder';
    }
  };
  $('#import').onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = await readBackup(file);
      const parts = [backup.trials.length && `${backup.trials.length} essais notés`, backup.abcLogs.length && `${backup.abcLogs.length} notes du journal des comportements`,
        backup.orthoLogs.length && `${backup.orthoLogs.length} notes d’orthophonie`].filter(Boolean);
      const extra = parts.length ? ` et ${parts.join(', ')}` : '';
      // v10.3.2 : la restauration AJOUTE la sauvegarde sans rien effacer. Rien n'est écrit avant le « OK » du parent.
      if (!window.confirm(`Ajouter ${backup.cards.length} cartes${extra} de la sauvegarde ?\n\nRien n’est effacé : les cartes, bilans, histoires et notes plus récents du téléphone sont gardés.`)) return;
      const localCards = await db.getAllCards();
      const cards = assignPositions(mergeBackupCards(localCards, backup.cards), state.cols);
      await db.putCards(cards);
      if (backup.trials.length) await db.putTrials(backup.trials);
      if (backup.visuals.length) {
        // Une photo personnalisée déjà sur le téléphone n'est pas remplacée.
        const localKeys = new Set((await db.getAllVisualOverrides()).map((v) => v.key));
        const newVisuals = backup.visuals.filter((v) => !localKeys.has(v.key));
        if (newVisuals.length) await db.putVisualOverrides(newVisuals);
      }
      if (backup.abcLogs.length) await db.putAbcLogs(backup.abcLogs);
      if (backup.orthoLogs.length) await db.putOrthoLogs(backup.orthoLogs);
      for (const key of EXPORTED_SETTINGS) {
        if (backup.settings[key] === undefined) continue;
        await db.setSetting(key, mergeBackupSetting(key, await db.getSetting(key), backup.settings[key]));
      }
      setCloudSpeechAllowed((await db.getSetting(SPEECH_SETTING_KEY)) === true);
      await loadFriendsState().catch(() => {});
      await loadMorphologyState().catch(() => {});
      await loadContext();
      await loadVisuals();
      await loadLevels();
      state.cards = cards; state.strip = [];
      renderAll();
    } catch (error) {
      window.alert(error.message || 'Sauvegarde illisible.');
    }
  };
}

// ---------- v10.3.2 : restauration par fusion (rien n'est effacé, le plus récent du téléphone est gardé) ----------
// Cartes : celles de la sauvegarde sont ajoutées ou mises à jour ; les cartes créées depuis restent.
// Une photo, une vidéo ou une voix déjà sur le téléphone n'est pas perdue si la sauvegarde n'en a pas.
function mergeBackupCards(localCards, backupCards) {
  const byId = new Map(localCards.map((c) => [c.id, c]));
  for (const card of backupCards) {
    const local = byId.get(card.id);
    if (!local) { byId.set(card.id, card); continue; }
    const merged = { ...local, ...card };
    for (const field of ['photo', 'video', 'audioFr', 'audioDr']) merged[field] = card[field] || local[field] || null;
    byId.set(card.id, merged);
  }
  return [...byId.values()];
}

const LIST_SETTINGS = ['stories', 'atecHistory', 'atec_history'];
const itemKey = (item) => (item && typeof item === 'object' ? (item.id || `${item.day || ''}-${item.ts || ''}`) : JSON.stringify(item));
function mergeBackupSetting(key, local, incoming) {
  if (local === undefined || local === null) return incoming;
  // Listes (histoires, bilans ATEC) : on additionne ; en cas de doublon, la version du téléphone gagne.
  if (LIST_SETTINGS.includes(key) && Array.isArray(local) && Array.isArray(incoming)) {
    const map = new Map(incoming.filter(Boolean).map((item) => [itemKey(item), item]));
    for (const item of local.filter(Boolean)) map.set(itemKey(item), item);
    return [...map.values()];
  }
  // Suggestions de mots : on garde le plus grand compteur de chaque mot.
  if (key === 'aacHistory' && typeof local === 'object' && typeof incoming === 'object') {
    const out = { uni: { ...(incoming.uni || {}) }, bi: { ...(incoming.bi || {}) } };
    for (const part of ['uni', 'bi']) for (const [k, v] of Object.entries(local[part] || {})) out[part][k] = Math.max(Number(v) || 0, Number(out[part][k]) || 0);
    return out;
  }
  // Plannings et réglages en objet : on ajoute ce qui manque, le téléphone garde ses valeurs.
  if (['customSchedules', 'scheduleTempOverrides', 'levels'].includes(key) && typeof local === 'object' && typeof incoming === 'object' && !Array.isArray(local)) {
    return { ...incoming, ...local };
  }
  return incoming;
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
  if (!(await db.getSetting('v7migrated'))) {
    const present = new Set(cards.map((c) => c.id));
    const addedV7 = defaultCards().filter((c) => (c.newIn || 0) > 3 && !present.has(c.id)).map(stripNew);
    if (addedV7.length) cards = [...cards, ...addedV7];
    await db.setSetting('v7migrated', true);
  }
  // v9.2 : nouvelles cartes de départ (chips, fromage, pancake, mcdo, coca-cola, trampoline), ajoutées une seule fois.
  if (!(await db.getSetting('v92migrated'))) {
    const present = new Set(cards.map((c) => c.id));
    const added = defaultCards().filter((c) => (c.newIn || 0) >= 9 && !present.has(c.id)).map(stripNew);
    if (added.length) cards = [...cards, ...added];
    await db.setSetting('v92migrated', true);
  }
  await db.setSetting('v2migrated', true);
  await db.setSetting('v3migrated', true);
  const placed = assignPositions(cards, state.cols);
  await db.putCards(placed);
  return placed;
}

async function init() {
  captureMagicKeyFromUrl(); // v10.5 : la clé du lien #key= quitte l'adresse avant toute autre chose
  nav.attach($('#view'));
  state.lang = langInfo((await db.getSetting('lang')) || 'fr').code;
  document.documentElement.lang = (langInfo(state.lang).tts || 'fr').split('-')[0]; // v10.5 (A21)
  await loadAacPlus();
  $('#calm').onclick = () => openCalm(state.lang);
  state.cols = (await db.getSetting('cols')) || 4;
  await loadContext();
  await loadFriendsState().catch(() => {});
  await loadMorphologyState().catch(() => {});
  await loadEyeTracking().catch(() => {}); // v10.1 : mode regard (désactivé par défaut)
  document.addEventListener('kalimati-friends-changed', () => { if (state.space === 'talk') renderView(); });
  // v10.1.2 : les listes d'images et de voix ne bloquent plus l'ouverture plus de 2,5 s (réseau lent = écran vide avant).
  const visualsReady = loadVisuals().catch(() => {});
  const visualsInTime = await Promise.race([visualsReady.then(() => true), new Promise((r) => setTimeout(() => r(false), 2500))]);
  if (!visualsInTime) visualsReady.then(() => { try { if (['home', 'talk'].includes(state.space)) renderView(); renderStrip(); } catch { /* écran déjà affiché */ } });
  loadDefaultVoices().catch(() => {});
  setCloudSpeechAllowed((await db.getSetting(SPEECH_SETTING_KEY)) === true);
  await loadLevels();
  state.cards = await loadCards();
  setupLock(); setupParentBar(); setupParentPanel(); setupStrip(); setupToilet();
  // Safari (iPhone) ne compte comme « geste » que la fin du toucher ou le clic, pas le début.
  ['touchend', 'click'].forEach((type) => { document.addEventListener(type, unlockAudio); document.addEventListener(type, unlockSounds); });
  // Une photo changée dans un exercice se met aussi à jour sur les cartes de l'espace Parler.
  // v10.4 : après un pack de cartes ou une synchro, on relit les données sans recharger la page
  // (la phrase en cours et le son ne sont pas coupés).
  document.addEventListener('kalimati-data-updated', async () => {
    try {
      await loadContext();
      await loadFriendsState().catch(() => {});
      await loadMorphologyState().catch(() => {});
      await loadVisuals().catch(() => {});
      await loadLevels();
      state.lang = langInfo((await db.getSetting('lang')) || state.lang).code;
      state.cards = await loadCards();
      const ids = new Set(state.cards.map((c) => c.id));
      state.strip = state.strip.filter((item) => ids.has(item.card.id));
      renderAll();
    } catch (err) {
      console.error('[Kalimati] mise à jour des données', err);
    }
  });
  document.addEventListener('visual-changed', () => { if (['talk', 'home'].includes(state.space)) renderView(); renderStrip(); });
  renderAll();
  // Détection automatique de ?invite=KALI-XXX, ?team=KALI-XXX ou ?admin=1
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') === '1') {
    // v9.8 : ?admin=1 n'ouvre plus le mode parent. Il montre seulement la demande de clé maître (ou sa création).
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
    state.space = 'progress';
    renderSpaces();
    nav.openScreen(() => superAdminScreen(nav));
  } else {
    await checkUrlInvite({
      onConfigured: async () => {
        await loadContext();
        state.lang = langInfo((await db.getSetting('lang')) || 'fr').code;
        state.cols = (await db.getSetting('cols')) || 4;
        state.cards = await loadCards();
        renderAll();
      },
    });
  }
  checkReminder();
  setInterval(checkReminder, REMINDER_CHECK_MS);
  // v10.1 : lien #key=KALI-SYNC-… (clé gardée dans le téléphone) + synchro auto si le parent l'a activée. Ne bloque jamais l'ouverture.
  initCloudSyncFromUrlAndAuto().catch(() => {});
  // v9.16.1 : on vérifie toujours le service worker sur le serveur, et on recharge une fois quand une nouvelle version prend la main.
  if ('serviceWorker' in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    // v10.1.2 : plus de rechargement brutal pendant que l'enfant utilise l'appli.
    // La nouvelle version s'installe quand l'appli passe en arrière-plan (ou au prochain lancement).
    let pending = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      pending = true;
    });
    document.addEventListener('visibilitychange', () => {
      if (pending && !reloaded && document.visibilityState === 'hidden') { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => {});
  }
}

init().then(() => { window.__kalimatiStarted = true; document.getElementById('boot-help')?.remove(); }).catch((error) => {
  window.__kalimatiStarted = true; // le message d'erreur ci-dessous remplace le filet de démarrage
  const message = document.createElement('p');
  message.className = 'fatal';
  message.textContent = `L'application n'a pas pu démarrer : ${String(error.message || error)}`;
  // v10.5.3 : un bouton pour réessayer, au lieu d'un écran sans issue.
  const retry = document.createElement('button');
  retry.type = 'button'; retry.className = 'btn primary'; retry.textContent = '🔄 Réessayer';
  retry.onclick = () => window.location.reload();
  document.body.replaceChildren(message, retry);
});
