// Vues : espace Parler, les 5 espaces et l’écran d’accueil
// Code déplacé tel quel depuis app.js (v10.42, Lot 4.1) : aucun comportement ne change.
// Les fonctions encore dans app.js sont lues au moment de l’appel (app.<nom>).
import * as db from '../db.js';
import { GRAMMAR, visualKeyOf } from '../data.js';
import { openEditor } from '../editor.js';
import { lastAmazighPlay, speak, stopSpeaking, unlockAudio, defaultVoiceUrl } from '../speech.js';
import { scanSpeed, touchSettingsBox } from './aac-plus.js';
import { firstName } from './aba.js';
import { tipOfDay } from './caregiver-tips.js';
import { clinicT } from './clinic-i18n.js';
import { friendCompanionBanner } from './friends.js';
import { moveCard, nextFreeSlot } from './grid-layout.js';
import { LANGS, categoryName, isAmazighLang, langInfo, ui } from './languages.js';
import { allCategories, cardPassesReviewFilter } from './lexique-rules.js';
import { nour } from './nour.js';
import { tx } from './section-i18n.js';
import { cardsForIntent } from './talk-modes.js';
import { btn, h } from './util.js';
import { APP_VERSION } from './version.js';
import { clearVisual, setVisual } from './visuals.js';
import { amazighAutoStep, amazighVoiceStatus, autoInstallAmazighVoicePack, retryAmazighVoicePack } from './voice-packs.js';
import { preloadVisibleVoices } from './voice-preload.js';

export function createViews(app) {
  const $ = (...args) => app.$(...args);
  const CORE_CAT = app.CORE_CAT;
  const cardVisual = (...args) => app.cardVisual(...args);
  const keyringBox = (...args) => app.keyringBox(...args);
  const label = (...args) => app.label(...args);
  const motorPlanBox = (...args) => app.motorPlanBox(...args);
  const nav = app.nav;
  const openLangPicker = (...args) => app.openLangPicker(...args);
  const photoUrls = app.photoUrls;
  const placeBoardView = (...args) => app.placeBoardView(...args);
  const placeEditorBox = (...args) => app.placeEditorBox(...args);
  const refreshTenseHints = (...args) => app.refreshTenseHints(...args);
  const renderAll = (...args) => app.renderAll(...args);
  const renderModel = (...args) => app.renderModel(...args);
  const renderSuggestions = (...args) => app.renderSuggestions(...args);
  const renderView = (...args) => app.renderView(...args);
  const sayMenu = (...args) => app.sayMenu(...args);
  const saveLayoutFingerprint = (...args) => app.saveLayoutFingerprint(...args);
  const sceneEditorBox = (...args) => app.sceneEditorBox(...args);
  const state = app.state;
  const talkModeBox = (...args) => app.talkModeBox(...args);
  const tappableCard = (...args) => app.tappableCard(...args);
  const tenseHintFor = (...args) => app.tenseHintFor(...args);
  const textToPictoBox = (...args) => app.textToPictoBox(...args);
  const twinBox = (...args) => app.twinBox(...args);
  const videoEditorBox = (...args) => app.videoEditorBox(...args);
  // ---------- Espace Parler ----------
  const sortedCards = (cat) => state.cards.filter((c) => c.cat === cat).sort((a, b) => (a.gridRow - b.gridRow) || (a.gridCol - b.gridCol) || (a.order - b.order));
  const visibleFor = (card) => state.parent
    || cardPassesReviewFilter(card, { parent: false, onlyReviewed: state.onlyReviewed });

  // Apport PictoTEA : impression / export PDF du tableau CAA personnalisé (avec vraies photos / pictos)
  function printAacBoard() {
    const active = state.cards.filter((card) => cardPassesReviewFilter(card, { parent: false, onlyReviewed: state.onlyReviewed }));
    const cols = allCategories.map((cat) => {
      const items = active.filter((c) => c.cat === cat.id);
      if (!items.length) return null;
      return h('div', { class: 'aac-print-cat' },
        h('h3', { style: { color: cat.color } }, `${cat.emoji || ''} ${categoryName(cat, 'fr')}`.trim()),
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

  // ---------- v10.15 : aides du cœur CAA (pépites 11, 16, 17, 23, 29) ----------
  // Mode écho : après la phrase, « À toi ! » pendant 2,5 s ; l'enfant imite, rien n'est enregistré.
  let echoTimer = 0;
  // v10.18 : la pastille « À toi ! » ne doit jamais rester ou apparaître sur un autre espace.
  function hideEchoCue() {
    clearTimeout(echoTimer);
    echoTimer = 0;
    document.getElementById('echo-cue')?.classList.remove('show');
  }
  function showEchoCue() {
    if (state.space !== 'talk') return;
    let el = document.getElementById('echo-cue');
    if (!el) {
      el = h('div', { class: 'echo-cue', id: 'echo-cue', 'aria-live': 'polite' }, h('span', { class: 'ear' }, '🎧'), h('span', {}));
      document.body.append(el);
    }
    el.lastElementChild.textContent = clinicT('echoCue', state.lang);
    el.classList.add('show');
    clearTimeout(echoTimer);
    echoTimer = setTimeout(() => el.classList.remove('show'), 2500);
  }

  // Explorer 30 s : l'enfant voit toutes les catégories ; le parent touche une carte pour la faire parler (sans ouvrir l'éditeur).
  const EXPLORE_MS = 30000;
  let exploreUntil = 0;
  let exploreTimer = 0;
  function exploreActive() { return exploreUntil > Date.now(); }
  function toggleExplore() {
    clearTimeout(exploreTimer); exploreTimer = 0;
    if (exploreActive()) exploreUntil = 0;
    else {
      exploreUntil = Date.now() + EXPLORE_MS;
      exploreTimer = setTimeout(() => { exploreUntil = 0; if (state.space === 'talk') renderView(); }, EXPLORE_MS);
    }
    renderView();
  }

  // Chemin lumineux de la recherche : l'onglet clignote, puis la carte.
  function flashSearch(card) {
    requestAnimationFrame(() => {
      const tab = document.querySelector(`.tab[data-cat="${card.cat}"]`);
      if (tab) { tab.classList.add('search-flash'); tab.scrollIntoView({ block: 'nearest', inline: 'center' }); }
      setTimeout(() => {
        const el = document.querySelector(`.card[data-card-id="${CSS.escape(card.id)}"]`);
        if (el) { el.classList.add('search-flash'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        setTimeout(() => document.querySelectorAll('.search-flash').forEach((node) => node.classList.remove('search-flash')), 3200);
      }, 400);
    });
  }
  function runSearch(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return '';
    // v10.37 (recherche par intention) : « il a soif » montre Eau, Lait, Jus… d'un coup.
    const intentCards = cardsForIntent(q, state.cards.filter(visibleFor), (c) => [label(c, state.lang), c.fr, c.dr]);
    if (intentCards.length) {
      if (!state.parent) { state.intent = { title: String(query).trim().slice(0, 40), cards: intentCards }; state.place = 'intent'; renderView(); }
      else { state.cat = intentCards[0].cat; renderView(); flashSearch(intentCards[0]); }
      return `💡 ${intentCards.map((c) => label(c, state.lang)).join(', ')}`;
    }
    const found = state.cards.filter(visibleFor).find((c) => [label(c, state.lang), c.fr, c.dr].filter(Boolean).some((text) => String(text).toLowerCase().includes(q)));
    if (!found) return clinicT('searchNotFound', state.lang);
    state.cat = found.cat;
    renderView();
    flashSearch(found);
    return clinicT('searchFound', state.lang, { word: label(found, state.lang) });
  }

  // v10.15 (pépite 23) : questions de l'adulte. v10.19 : elles vivent dans les outils adulte.
  const ASK_PILLS = [
    ['🤗', 'askFeel', 'Comment tu te sens ?', 'emotions'],
    ['🙋', 'askWant', 'Qu’est-ce que tu veux ?', 'manger'],
    ['📍', 'askWhere', 'Où est-ce que tu vas ?', 'lieux'],
    ['❓', 'askWhat', 'Qu’est-ce que c’est ?', 'decrire'],
  ];

  let scanTimer = 0;
  function stopScan() { if (scanTimer) { clearInterval(scanTimer); scanTimer = 0; } }

  function renderTalk() {
    stopScan();
    const tappable = tappableCard;
    const pickCard = (id) => state.cards.find((c) => c.id === id && visibleFor(c));
    // v10.19 : six grands mots pour commencer, puis une rangée rapide pour continuer.
    const STARTER_IDS = ['c-base-je-veux', 'c-base-aide-moi', 'c-base-encore', 'c-base-fini', 'c-base-oui', 'c-base-non'];
    const QUICK_IDS = ['c-base-oui', 'c-base-non', 'c-base-aide-moi', 'c-base-attends', 'c-base-encore', 'c-base-fini'];
    const fallback = sortedCards(CORE_CAT).filter(visibleFor);
    const starters = STARTER_IDS.map(pickCard).filter(Boolean);
    const starterCards = starters.length ? starters : fallback.slice(0, 6);
    const quickCards = QUICK_IDS.map(pickCard).filter(Boolean);
    const noPhrase = state.strip.length === 0;
    const starterRow = state.parent ? null : h('div', { class: 'quick-pills talk-start', 'aria-label': 'Pour commencer' },
      starterCards.map((card) => tappable(card, { className: 'starter' })));
    // L'adulte peut ouvrir les outils sans quitter la page ; rien n'est imposé à l'enfant.
    const modelToggle = state.parent ? null : h('button', { type: 'button', class: `btn ghost tiny model-toggle${state.modeling ? ' on' : ''}`,
      onclick: () => { state.modeling = !state.modeling; state.model = []; renderView(); renderSuggestions(); } },
    state.modeling ? '✋ Arrêter « Je montre »' : '🧑‍🏫 Je montre (adulte)');
    const modelLine = state.modeling ? h('div', { class: 'model-line', id: 'model-line' }) : null;
    const suggest = h('div', { class: 'suggest-row', id: 'suggest-row', hidden: true });
    // v10.15 (pépite 29) : deux aides qui parlent sans vider la phrase.
    const sayPill = (key, fr) => {
      unlockAudio(); stopSpeaking();
      const words = state.lang === 'fr' ? fr : clinicT(key, state.lang);
      speak(String(words).replace(/^[^\p{L}\p{N}]+/u, ''), { lang: state.lang });
    };
    // v10.23 (pépite 2) : la barre des mots essentiels reste à l'écran en permanence — elle ne vide jamais
    // la phrase en cours. L'enfant peut dire « Non », « Attends » ou « Oups » au milieu d'une phrase.
    // Sur petit écran, les trois aides passent seules sur une deuxième ligne : elles ne doivent jamais
    // se retrouver hors écran, sinon le mot qui répare redevient introuvable.
    const railChip = (emoji, key, fr) => h('button', { type: 'button', class: 'rail-chip', onclick: () => sayPill(key, fr) },
      `${emoji} ${clinicT(key, state.lang)}`);
    const rail = state.parent ? null : h('div', { class: 'talk-rail', 'aria-label': 'Mots rapides, toujours visibles' },
      h('div', { class: 'rail-help' },
        railChip('⏳', 'quickWait', 'Attends, je prépare ma phrase !'),
        railChip('😄', 'quickJoke', 'C’est une blague !'),
        railChip('🙈', 'quickOups', 'Oups, je me suis trompé !')),
      h('div', { class: 'rail-cards' }, quickCards.map((card) => tappable(card, { small: true, className: 'quick-card' }))));
    // v10.15 (pépite 23) : questions de l'adulte — un toucher filtre la catégorie des réponses.
    const askRow = h('div', { class: 'ask-pills', 'aria-label': 'Questions' },
      ASK_PILLS.map(([emoji, key, fr, cat]) => h('button', { type: 'button', class: `ask-pill${state.cat === cat ? ' active' : ''}`, onclick: () => { sayPill(key, fr); state.cat = cat; renderView(); } },
        `${emoji} ${clinicT(key, state.lang)}`)));
    // v10.15 (pépite 17) : recherche parent — l'onglet puis la carte clignotent (chemin lumineux).
    const searchNote = h('p', { class: 'note search-note', hidden: true });
    const searchInput = h('input', { type: 'search', class: 'clinic-search-input', placeholder: clinicT('searchPlaceholder', state.lang), 'aria-label': clinicT('search', state.lang) });
    const doSearch = () => {
      const msg = runSearch(searchInput.value);
      if (msg) { searchNote.hidden = false; searchNote.textContent = msg; }
    };
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    const searchBox = !state.modeling ? h('div', { class: 'clinic-search' }, h('div', { class: 'row' }, searchInput, btn(clinicT('search', state.lang), doSearch, 'ghost tiny')), searchNote) : null;
    const exploring = exploreActive();
    const exploreBtn = state.parent ? h('button', { type: 'button', class: `btn ghost tiny explore-toggle${exploring ? ' on' : ''}`, onclick: toggleExplore },
      exploring ? `⏹ ${clinicT('exploreOn', state.lang)}` : `👁️ ${clinicT('explore', state.lang)}`) : null;
    const exploreNote = exploring ? h('p', { class: 'note explore-note' }, clinicT('exploreOn', state.lang)) : null;
    // v9.12 : Nour accompagne l'espace Parler (masquable par le parent). v10.19 : il laisse la place dès que la phrase commence.
    const friend = state.parent ? null : friendCompanionBanner('talk', { lang: state.lang });
    // Grandes tuiles de catégories : emoji + mot, jamais une petite pastille illisible.
    const tabs = h('nav', { class: 'tabs talk-cats', 'aria-label': 'Catégories' }, allCategories.map((category) => {
      const tab = h('button', {
        type: 'button',
        class: `tab talk-cat${category.id === state.cat ? ' active' : ''}`,
        'aria-current': category.id === state.cat ? 'true' : null,
        onclick: () => { state.cat = category.id; renderView(); requestAnimationFrame(() => document.querySelector('.talk-board-head')?.scrollIntoView({ block: 'nearest' })); },
      },
      h('span', { class: 'talk-cat-emoji', 'aria-hidden': 'true' }, category.emoji || CATEGORY_EMOJI[category.id] || '💬'),
      h('span', { class: 'talk-cat-name' }, categoryName(category, state.lang)));
      tab.dataset.cat = category.id;
      tab.style.setProperty('--cat', category.color);
      return tab;
    }));
    // v10.33 (pages par lieu) : un onglet de plus, à la fin des dossiers. Il ne change pas les cartes de base.
    if (!state.parent) {
      const placeTab = h('button', { type: 'button', class: `tab talk-cat place-tab${state.place ? ' active' : ''}`, 'aria-current': state.place ? 'true' : null,
        onclick: () => { state.place = state.place ? null : 'pick'; renderView(); } },
      h('span', { class: 'talk-cat-emoji', 'aria-hidden': 'true' }, '📍'), h('span', { class: 'talk-cat-name' }, 'Lieux'));
      placeTab.style.setProperty('--cat', '#5E60CE');
      tabs.append(placeTab);
    }
    const activeCategory = allCategories.find((c) => c.id === state.cat) || allCategories[0];
    const boardCards = sortedCards(state.cat);
    const boardHead = h('div', { class: 'talk-board-head' },
      h('span', { class: 'talk-board-emoji', 'aria-hidden': 'true' }, activeCategory.emoji || CATEGORY_EMOJI[state.cat] || '💬'),
      h('h2', { class: 'talk-board-title' }, categoryName(activeCategory, state.lang)),
      h('span', { class: 'talk-board-count' }, `${boardCards.filter(visibleFor).length}`));
    const grid = h('div', { class: `grid${exploring ? ' exploring' : ''}`, style: { '--cols': state.cols, '--cat-board': activeCategory.color } });
    const placeView = !state.parent && state.place ? placeBoardView(grid, tappable) : null;
    for (const card of placeView ? [] : boardCards) {
      const el = tappable(card);
      el.style.gridRow = String(card.gridRow);
      el.style.gridColumn = String(card.gridCol);
      const revealHidden = exploring
        && card.hidden
        && cardPassesReviewFilter(card, { onlyReviewed: state.onlyReviewed });
      if (!visibleFor(card) && !revealHidden) {
        el.style.visibility = 'hidden';
        el.setAttribute('aria-hidden', 'true');
        el.tabIndex = -1;
      }
      const hint = !state.parent && visibleFor(card) ? tenseHintFor(card) : '';
      if (hint) el.append(h('span', { class: 'card-tense', 'aria-hidden': 'true' }, hint));
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
    // Tous les réglages adultes sont repliés derrière un seul bouton, pour laisser la place aux mots.
    const adultTools = h('details', { class: 'talk-adult', open: state.parent || state.modeling ? true : null },
      h('summary', {}, '🧑‍🏫 Outils adulte'),
      // v10.35 (pépite « Boussole pour l'aidant ») : un conseil par jour, sans lire les phrases de l'enfant.
      h('p', { class: 'caregiver-tip' }, h('strong', {}, '💡 Conseil du jour : '), tipOfDay(new Date(), { hasPlaceBoards: state.placeBoards.length > 0, hasScenes: state.scenes.length > 0 })),
      modelToggle, modelLine,
      askRow,
      searchBox, exploreBtn, exploreNote,
      personalise,
      talkModeBox(),
      textToPictoBox(),
      state.parent ? placeEditorBox() : null,
      state.parent ? sceneEditorBox() : null,
      state.parent ? videoEditorBox() : null,
      state.parent ? btn('🖨️ Imprimer / PDF le tableau CAA', printAacBoard, 'ghost') : null,
      state.parent ? keyringBox() : null,
      state.parent ? twinBox() : null,
      state.parent ? touchSettingsBox() : null, state.parent ? motorPlanBox() : null, state.parent ? legend() : null);
    const view = h('div', { class: `talk${state.modeling ? ' modeling' : ''}${noPhrase ? '' : ' has-phrase'}${rail ? ' has-rail' : ''}` },
      friend, starterRow, placeView || tabs, boardHead, suggest, grid, adultTools, rail);
    // Lot 1, L1-06 : les voix des cartes visibles partent en pré-chargement, jamais pendant le rendu.
    // Les mp3 livrés n'existent qu'en français et en darija ; les autres langues passent par la voix du téléphone.
    const visibleCards = [...starterCards, ...quickCards, ...(placeView ? [] : boardCards.filter(visibleFor))];
    const useDefaultMp3 = state.lang === 'fr' || state.lang === 'dr';
    preloadVisibleVoices(visibleCards, state.lang, { getDefaultUrl: useDefaultMp3 ? defaultVoiceUrl : null });
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
          // v10.4 : un onglet, un mot rapide ou une suggestion se touchent normalement pendant le balayage.
          if (e.target.closest('.model-toggle, .tab, .tabs, .suggest-row, .friend-banner, .quick-pills, .ask-pills, .talk-rail, .talk-adult, .clinic-search, .explore-toggle')) return;
          const activeEl = targets[idx];
          if (activeEl && e.target.closest('.card') !== activeEl) {
            e.preventDefault();
            e.stopPropagation();
            activeEl.click();
          }
        }, { capture: true });
      }
    }
    queueMicrotask(() => {
      renderSuggestions();
      renderModel();
      refreshTenseHints();
      document.querySelector('.talk-cat.active')?.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
    return view;
  }

  const CATEGORY_EMOJI = {
    base: '⭐', manger: '🍽️', boire: '🥤', jouer: '🧸', actions: '🏃',
    personnes: '👨‍👩‍👧', besoins: '🆘', emotions: '😊', decrire: '🎨', lieux: '📍',
  };

  const legend = () => h('div', { class: 'legend' }, Object.values(GRAMMAR).map((g) => h('span', {}, h('i', { style: { background: g.color } }), g.label)));

  async function saveCards(changed) {
    // v10.10 : chaque carte modifiée porte sa date. La synchro ne remplace plus une
    // modification locale par un paquet distant plus ancien.
    const now = Date.now();
    const stamped = changed.map((c) => ({ ...c, updatedAt: now }));
    await db.putCards(stamped);
    const ids = new Set(stamped.map((c) => c.id));
    state.cards = [...state.cards.filter((c) => !ids.has(c.id)), ...stamped];
    await saveLayoutFingerprint(state.cards); // Lot 2 (L2-10) : action adulte → nouvelle empreinte
  }

  async function editCard(card) {
    // L'éditeur montre la photo partagée de la carte (visual_overrides) si elle existe.
    const key = card ? visualKeyOf(card) : null;
    const shared = key ? await db.getVisualOverride(key) : null;
    const before = card ? ((shared && shared.blob) || card.photo || null) : null;
    openEditor(card ? { ...card, photo: before } : null, {
      defaultCat: state.cat,
      amazighLang: isAmazighLang(state.lang) ? state.lang : null, // v10.7 : ligne « voix amazighe » dans l'éditeur
      lang: state.lang, // v10.21 (Lot 1) : l'éditeur propose la voix dans la langue active, sans repasser par le français
      cols: state.cols, // Lot 2 (L2-07) : confirmation 2 touchers seulement pour un vrai déplacement de la taille active
      onSave: async (saved, { slot, catChanged }) => {
        let cards = state.cards.filter((c) => c.id !== saved.id);
        let placed = saved;
        if (!saved.gridRow || catChanged) placed = { ...saved, ...nextFreeSlot(cards, saved.cat, state.cols) };
        cards = [...cards, placed];
        if (slot && slot.col <= state.cols) cards = moveCard(cards, placed.id, slot.row, slot.col, state.cols);
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
        await saveLayoutFingerprint(state.cards); // Lot 2 (L2-10) : action adulte → nouvelle empreinte
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
    hideEchoCue();
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
    const kidName = firstName(state.lang);
    const hello = `${ui('hello', state.lang)} ${kidName} !`;
    return h('div', { class: 'screen home' },
      h('button', { type: 'button', class: 'home-hello', onclick: () => sayMenu('hello', ` ${kidName} !`) },
        h('span', { class: 'home-nour' }, nour({ pose: 'wave', size: 96 })),
        h('span', { class: 'home-hello-text' }, h('strong', {}, `👋 ${hello}`), h('span', {}, ui('ask', state.lang)))),
      h('button', { type: 'button', class: 'home-lang', onclick: openLangPicker }, `${langInfo(state.lang).flag} ${langInfo(state.lang).name} · 🌍 ${tx('languagesCount', state.lang, { n: LANGS.length })}`),
      h('div', { class: 'home-grid' }, HOME_TILES.map(([id, emoji, titleKey, subKey, cls]) => h('button', {
        type: 'button', class: `home-tile ${cls}`, onclick: () => { sayMenu(titleKey); openSpace(id); },
      }, h('span', { class: 'home-emoji' }, emoji), h('strong', {}, ui(titleKey, state.lang)), h('small', {}, ui(subKey, state.lang)))),
      // v10.15 : les ateliers cliniques ont une grande tuile à part (séance guidée, matrices, cahier de vie…).
      h('button', {
        type: 'button', class: 'home-tile tile-clinic',
        onclick: () => { speak(clinicT('clinic', 'fr'), { lang: 'fr' }); openSpace('clinique'); },
      }, h('span', { class: 'home-emoji' }, '🧩'), h('strong', {}, clinicT('tClinic', state.lang)), h('small', {}, clinicT('sClinic', state.lang)))),
      h('button', { type: 'button', class: 'home-adult', onclick: () => openSpace('progress') }, state.parent ? '📊 Progrès & Console Bêta (adultes)' : '🔒 Progrès (adultes)'),
      // v10.16 : cabinet multi-patients du psychologue / orthophoniste (fiches pseudonymisées).
      h('button', { type: 'button', class: 'home-adult home-therapist', onclick: () => openSpace('cabinet') }, state.parent ? '🩺 Espace thérapeute · cabinet multi-patients' : '🔒 Espace thérapeute (adultes)'),
      amazighVoiceLine(),
      // v9.16.2 : numéro de version visible, pour vérifier que le téléphone a bien la dernière mise à jour.
      h('p', { class: 'app-version' }, `Kalimati ${APP_VERSION}`));
  }

  // ---------- v10.7.2 : état des voix amazighes, en petit sur l'Accueil ----------
  // Dit au parent si les voix sont en train d'arriver, prêtes, ou pas arrivées (et pourquoi),
  // et ce qui s'est passé au dernier toucher d'une carte. Rien n'est envoyé : tout est lu dans le téléphone.
  function amazighVoiceLine() {
    if (!isAmazighLang(state.lang)) return null;
    const line = h('div', { class: 'amz-status', id: 'amz-status', role: 'status' });
    autoInstallAmazighVoicePack(state.lang); // v10.7.3 : aussi à chaque Accueil (sans effet si déjà fait ou en cours)
    fillAmazighVoiceLine(line);
    return line;
  }

  function amazighPlayNote() {
    const last = lastAmazighPlay;
    if (!last.at || last.lang !== state.lang) return null;
    if (last.ok) return '🔈 Dernier toucher : le son est parti.';
    if (last.why === 'sans voix') return '🔈 Dernier toucher : cette carte n’a pas encore de voix.';
    if (last.why === 'NotAllowedError') return '🔈 Dernier toucher : le téléphone a bloqué le son (NotAllowedError).';
    return `🔈 Dernier toucher : le son n’est pas parti (${last.why || 'raison inconnue'}).`;
  }

  let amazighLineTimer = null;
  function fillAmazighVoiceLine(line) {
    if (!line || !isAmazighLang(state.lang)) return;
    const s = amazighVoiceStatus(state.lang);
    const name = langInfo(state.lang).name;
    const kind = `${s.trial ? ' (voix d’essai)' : ''}${s.memoryOnly ? ', gardées pour cette ouverture (ce navigateur ne peut pas les garder : Safari le peut)' : ''}`;
    let text;
    let retry = false;
    if (s.downloading) text = `⏳ Voix ${name} : ${s.done} sur ${s.total} arrivées…`;
    else if (!s.loaded) text = `⏳ Voix ${name} : lecture dans le téléphone…`;
    else if (s.expected && s.pack && s.pack < s.expected) { text = `🔊 Voix ${name} : ${s.pack} cartes sur ${s.expected}${kind}.`; retry = !s.declined; }
    else if (s.ready) text = `🔊 Voix ${name} prêtes : ${s.ready} cartes${kind}.`;
    else if (s.declined) text = `🔇 Voix ${name} : pack supprimé. Pour le remettre : Progrès › Voix amazighes.`;
    else if (s.waiting) {
      // v10.7.3 : si l'attente dure, on dit à quelle étape (pour comprendre un blocage) et on propose Réessayer.
      const auto = amazighAutoStep(state.lang);
      const waited = auto ? Math.round((Date.now() - auto.since) / 1000) : 0;
      text = waited >= 10 ? `⏳ Voix ${name} : en attente depuis ${waited} s (étape : ${auto.step || '?'}).` : `⏳ Voix ${name} : elles arrivent dans un instant…`;
      retry = waited >= 20;
      if (!amazighLineTimer) amazighLineTimer = setTimeout(() => { amazighLineTimer = null; fillAmazighVoiceLine(document.getElementById('amz-status')); }, 3000);
    }
    else if (s.failed) { text = `⚠️ Voix ${name} pas encore arrivées : ${s.failed}.`; retry = true; }
    else { text = `🔇 Voix ${name} pas encore dans le téléphone.`; retry = true; }
    const note = amazighPlayNote();
    line.replaceChildren(
      h('p', {}, text, retry ? h('button', {
        type: 'button', class: 'btn ghost amz-retry',
        onclick: () => { retryAmazighVoicePack(state.lang); fillAmazighVoiceLine(line); },
      }, '🔄 Réessayer') : null),
      note ? h('p', {}, note) : null);
  }

  return { exploreActive, renderTalk, editCard, renderSpaces, openSpace, homeScreen, fillAmazighVoiceLine, showEchoCue, saveCards };
}
