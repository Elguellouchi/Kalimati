// Kalimati v10.27 (darija en lettres arabes par défaut ; arabe standard sur les écrans enfant ; thèmes cahier d’école, simple, noir et blanc).
import './modules/util.js'; // en premier : garde-fou contre les textes « null »
import { CATEGORIES, GRAMMAR, defaultCards, visualKeyOf, TOILET_CARD_ID, SELF_CARD_ID, cardAudio, foldLegacyAudio } from './data.js';
import * as db from './db.js';
import { sayCard, sayCards, sayNaturalSentence, setCardCatalog, stopSpeaking, speak, unlockAudio, loadDefaultVoices, defaultVoiceUrl, setCloudSpeechAllowed, SPEECH_SETTING_KEY, lastAmazighPlay } from './speech.js';
import { openEditor } from './editor.js';
import { unlockSounds, resizePhoto } from './media.js';
import { buildBackupFile, deliverBackup, readBackup, encryptBackupFile, BACKUP_PASSWORD_MIN } from './backup.js';
import { h, btn } from './modules/util.js';
import { loadContext, recordTrial, todayTrials, firstName, profile, saveProfile } from './modules/aba.js';
import { listChildren, activeChildId, MAIN_ID } from './modules/child-profiles.js';
import { nour } from './modules/nour.js';
import { assignPositions, relayout, nextFreeSlot, moveCard } from './modules/grid-layout.js';
import { createNavigator } from './modules/spaces.js';
import { dashboardScreen } from './modules/dashboard.js';
import { applyUppercase, UPPERCASE_SETTING_KEY } from './modules/about.js';
import { toiletReminder, logToilet } from './modules/ex-autonomy.js';
import { loadLevels } from './modules/levels.js';
import { openCalm } from './modules/calm.js';
import { logOrtho } from './modules/ex-ortho.js';
import { LANGS, langInfo, isAmazighLang, isAmazighScript, isDarijaScript, setDarijaScript, isExtraLang, cardWord, cardSpeechText, categoryName, ui, spokenUi } from './modules/languages.js';
import { loadAmazighVoices, amazighVoiceFor, autoInstallAmazighVoicePack, amazighVoiceStatus, readAmazighPackState, retryAmazighVoicePack, amazighAutoStep } from './modules/voice-packs.js';
import { MOTOR_STAGES, applyProgressiveStage } from './modules/core-vocabulary-plan.js';
import { loadAacPlus, learnTap, suggestionsFor, touchSettingsBox, scanSpeed, clearConfirmNeeded, echoPracticeEnabled } from './modules/aac-plus.js';
// v10.23 (Sprint 1) : un seul moteur tactile pour toute l'application (Sprint 1).
import { bindTap, tapFeedback, resetTapMemory } from './modules/tap-engine.js';
// v10.23 (pépite 1) : deux langues simultanées sur la même grille, sans déplacer une seule carte.
import { twinOf, twinSwap, saveTwin, loadTwin, suggestPartner } from './modules/twin-language.js';
import { buildIndex, matchPictos, extraConcepts } from './modules/text-to-picto.js';
import { PLACES, PLACE_SETTING_KEY, cleanCustomBoards, newBoardId, boardItems, passingCard } from './modules/place-boards.js';
import { tipOfDay } from './modules/caregiver-tips.js';
import { TALK_MODES, TALK_MODE_KEY, normalizeTalkMode, showsHints, showsCoach, cardsForIntent } from './modules/talk-modes.js';
import { GRID_SIZES, SCENE_SETTING_KEY, sceneImageKey, newSceneId, cleanScenes, EXPLORE_SCENES, cellBox } from './modules/scenes.js';
import { loadVisuals, renderVisual, hasPhoto, setVisual, clearVisual } from './modules/visuals.js';
import { uiIcon } from './modules/ui-icons.js';
import { loadFriendsState, friendCompanionBanner, unlockFriendSticker } from './modules/friends.js';
import { loadMorphologyState, inflectStrip, getTense, setTense } from './modules/morphology.js';
import { loadEyeTracking } from './modules/eye-and-packs.js';
import { initCloudSyncFromUrlAndAuto, captureMagicKeyFromUrl } from './modules/cloud-sync.js';
import { checkUrlInvite, openSetupWizard, superAdminScreen } from './modules/admin-beta.js';
import { APP_VERSION } from './modules/version.js';
import { initGlobalErrorLogger, logDiagnostic, recordRejectedTap, setDiagnosticForbiddenNames } from './modules/error-log.js';
import { loadOnlineLookupSetting } from './modules/online-bank.js';
import { loadNetworkMode } from './modules/network-policy.js';
import { setTimerShowNumbers, TIMER_SETTING_KEY } from './modules/timer.js';
import { setActiveLang, tx } from './modules/section-i18n.js';
import { clinicHome, closeClinic } from './modules/clinique.js';
import { clinicT } from './modules/clinic-i18n.js';
import { cabinetScreen } from './modules/cabinet.js';
import { startAppUpdateWatch } from './modules/app-update.js';
import { migrateCards, stripNew, planPersonRename } from './modules/card-migration.js';

const HOLD_TO_UNLOCK_MS = 3000;
const MAX_STRIP = 8;
const CORE_CAT = 'base';
const REMINDER_CHECK_MS = 30000;
const SNOOZE_MS = 10 * 60000;
// v9.7 : la sauvegarde simple garde aussi le planning, les histoires, le bilan ATEC, les mots proposés et le toucher adapté.
const EXPORTED_SETTINGS = ['lang', 'twinLang', 'cols', 'darijaScript', 'clinic', 'profile', 'toiletReminder', 'levels',
  'customSchedules', 'scheduleTempOverrides', 'stories', 'atecHistory', 'atec_history', 'aacHistory', 'touch', 'visualStyle', 'childGender', 'therapistName', 'speechCloudAllowed', 'friendsAlbum', 'hideFriends', 'timerShowNumbers', 'uppercaseText', 'placeBoards', 'visualScenes', 'talkMode'];

const state = { cards: [], cat: 'manger', lang: 'fr', twin: null, amazighScript: 'both', cols: 4, parent: false, strip: [], space: 'home', playing: -1, modeling: false, model: [], place: null, placeBoards: [], scenes: [], talkMode: 'coach', intent: null };
const photoUrls = new Map();
const $ = (selector) => document.querySelector(selector);
const nav = createNavigator({ container: null, state, goHome: () => openSpace('home') });

// ---------- Cartes ----------
// v10.7 : en amazigh, le mot s'affiche en tifinagh et/ou en lettres latines (réglage « Écriture amazighe » dans Progrès).
const label = (card, lang = state.lang) => cardWord(card, lang, { scriptMode: state.amazighScript });
// Voix du téléphone pour un texte de menu : la langue choisie (darija en lettres latines : voix française ;
// amazigh : le menu en français, car aucune voix du téléphone ne lit l'amazigh).
const sayMenu = (key, suffix = '') => { const said = spokenUi(key, state.lang); return speak(`${said.text}${suffix}`, { lang: said.lang }); };

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

// v10.7 : en amazigh « tifinagh + latin », le mot en lettres latines, puis le tifinagh en dessous (plus lisible sur petit écran).
function labelElement(text, lang) {
  const el = h('span', { class: `label${isAmazighLang(lang) ? ' amz' : ''}` });
  fillLabel(el, text, lang);
  return el;
}
function fillLabel(el, text, lang) {
  const parts = isAmazighLang(lang) && state.amazighScript === 'both' ? String(text || '').split(' · ') : [];
  if (parts.length === 2) el.replaceChildren(parts[0], h('span', { class: 'label-tif' }, parts[1]));
  else el.textContent = text;
}

function cardElement(card, { small = false, lang = state.lang, className = '' } = {}) {
  const category = CATEGORIES.find((c) => c.id === card.cat);
  const gram = GRAMMAR[card.gram] || GRAMMAR.noun;
  // v10.23 (pépite 1) : le mot de l'autre langue du binôme, sous le mot parlé. Rien ne se déplace :
  // la position vient de l'id de la carte, donc les deux langues partagent le même plan moteur.
  const other = small ? null : twinOf(state.twin, lang);
  const twinText = other ? cardWord(card, other, { scriptMode: state.amazighScript }) : '';
  const main = label(card, lang);
  const showTwin = twinText && twinText !== main;
  const ariaLabel = `${main}${showTwin ? ` · ${twinText}` : ''}${card.hidden && state.parent ? ' (carte masquée)' : ''}`;
  const button = h('button', { type: 'button', class: `card${small ? ' small' : ''}${className ? ` ${className}` : ''}${card.hidden ? ' is-hidden' : ''}`, 'aria-label': ariaLabel },
    cardVisual(card), labelElement(main, lang),
    showTwin ? h('span', { class: 'twin-label', dir: langInfo(other).rtl ? 'rtl' : 'ltr' }, twinText) : null,
    card.sub && !small ? h('span', { class: 'sub' }, card.sub) : null,
    card.video ? h('span', { class: 'badge video' }, '▶') : null);
  button.dataset.cardId = card.id;
  button.style.setProperty('--gram', gram.color);
  button.style.setProperty('--cat', category ? category.color : '#999');
  if (state.parent && !small) {
    const needsPhoto = card.cat === 'personnes' && !card.photo && !button.querySelector('.has-photo');
    if (state.lang === 'dr' && !cardAudio(card, 'dr') && !defaultVoiceUrl(card, 'dr')) button.append(h('span', { class: 'badge dr' }, '🎙️ Voix Darija à enregistrer'));
    // v10.7 : en amazigh, une carte sans voix du parent ni voix du pack reste muette : on le montre au parent
    // (sauf si la carte attend d'abord sa photo : les deux pastilles se cacheraient).
    if (isAmazighLang(state.lang) && !needsPhoto && !amazighVoiceFor(state.lang, card.id)) button.append(h('span', { class: 'badge amz-voice', title: `Voix ${langInfo(state.lang).name} à enregistrer` }, `🎙️ ${langInfo(state.lang).short}`));
    if (card.hidden) button.append(h('span', { class: 'badge hidden-badge' }, '🙈 masquée'));
    if (needsPhoto) button.append(h('span', { class: 'badge add-photo' }, `📷 Ajouter la photo`));
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

// v10.23 (Sprint 1) : appui trop court, doigt qui glisse, double toucher — tout est décidé une seule fois,
// dans modules/tap-engine.js, pour la grille, la barre de mots rapides et les suggestions.
// Mode « Je montre » : l'adulte montre les mots sans remplir la phrase de l'enfant.
function onCardTap(card, element) {
  // v10.15 : pendant « Explorer 30 s », le parent touche une carte pour la faire parler (pas d'éditeur).
  if (state.parent) { if (exploreActive()) { stopSpeaking(); sayCard(card, state.lang); return; } editCard(card); return; }
  tapFeedback(element);
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

// v10.23 (Sprint 1) : une seule fabrique de cartes touchables — la grille, les suggestions et la barre
// de mots rapides appliquent donc exactement le même toucher, au même endroit.
const tappableCard = (card, options = {}) => {
  const el = cardElement(card, options);
  return bindTap(el, () => onCardTap(card, el), {
    key: card && card.id != null ? card.id : el,
    skip: () => state.parent,
    onRejected: () => recordRejectedTap({ cardId: card?.id, space: state.space }),
  });
};

// ---------- Bande de phrase (chaque mot garde sa langue : code-switching) ----------
// v9.13 : le moteur hors-ligne (modules/morphology.js) conjugue et accorde la phrase. En français, en darija
// et (v10.7) dans les 4 variétés amazighes (phrase affichée seulement : pas de voix du téléphone en amazigh).
// v10.22 (Lot 2) : les 10 langues « extra » (en, es…) entrent aussi dans la barre — phrase assemblée
// dans la langue de l'enfant, sans repli français.
const morphLangOk = (strip) => strip.length > 0 && strip.every((item) => item.lang === 'fr' || item.lang === 'dr' || isAmazighLang(item.lang) || isExtraLang(item.lang));
const stripAmazighLang = () => state.strip.find((item) => isAmazighLang(item.lang))?.lang || (isAmazighLang(state.lang) ? state.lang : null);
function stripInflection() {
  if (!morphLangOk(state.strip)) return null;
  try { return inflectStrip(state.strip, { lang: stripAmazighLang(), scriptMode: state.amazighScript }); } catch { return null; }
}

function renderStrip() {
  setCardCatalog(state.cards);
  const inflected = stripInflection();
  const items = state.strip.map((item, i) => {
    const el = cardElement(item.card, { small: true, lang: item.lang });
    if (i === state.playing) el.classList.add('lit');
    // Étiquette conjuguée / accordée sous la carte (« Manger » devient « mange », « Content » devient « contente »).
    // v10.22 (Lot 2) : seulement pour le français, la darija et l'amazigh, dont le moteur connaît les formes
    // conjuguées. Une langue « extra » garde son mot traduit (sinon l'inflexion française écraserait la traduction).
    const inflectable = item.lang === 'fr' || item.lang === 'dr' || isAmazighLang(item.lang);
    const shown = inflectable && inflected && inflected.tokens[i] && inflected.tokens[i].displayLabel;
    const lab = el.querySelector('.label');
    if (shown && lab && shown.trim().toLowerCase() !== label(item.card, item.lang).trim().toLowerCase()) {
      fillLabel(lab, shown, item.lang);
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
  // v10.23 (pépite 1) : un seul bouton pour passer de la langue de la maison à celle de l'école.
  const twinBtn = $('#btn-twin');
  if (twinBtn) {
    const other = twinOf(state.twin, state.lang);
    twinBtn.hidden = !other;
    twinBtn.textContent = other ? langInfo(other).short : '';
    twinBtn.setAttribute('aria-label', other ? `Passer à la langue jumelle : ${langInfo(other).name}. Les cartes ne bougent pas.` : 'Langue jumelle');
  }
  const talk = document.querySelector('.talk');
  if (talk) talk.classList.toggle('has-phrase', state.strip.length > 0);
  renderSuggestions();
  refreshTenseHints();
}

// v10.19 : conjugaison visible là où l'enfant parle. Un verbe de la grille montre
// sa forme au temps choisi (« Manger » → « a mangé »), sans quitter le tableau.
function tenseHintFor(card) {
  if (card.gram !== 'verb' || getTense() === 'present') return '';
  // v10.22 (Lot 2) : le moteur ne conjugue pas encore les langues « extra » : pas d'indice français
  // sur une carte anglaise/espagnole (on n'affiche jamais une forme française à la place).
  if (isExtraLang(state.lang)) return '';
  const lang = state.lang === 'dr' || isAmazighLang(state.lang) ? state.lang : 'fr';
  try {
    const inflected = inflectStrip([{ card, lang }], { tense: getTense(), lang, scriptMode: state.amazighScript });
    const raw = String(inflected?.tokens?.[0]?.displayLabel || '').trim();
    // Le libellé d'un verbe seul commence par « Je » : on applique l'élision du français
    // (« Je ai mangé » → « J'ai mangé ») comme le fait déjà la phrase complète.
    const shown = lang === 'fr' ? raw.replace(/^Je\s+([aàâeéèêëiîïoôuùûh])/i, "J'$1") : raw;
    const base = label(card, lang).trim();
    return shown && shown.toLowerCase() !== base.toLowerCase() ? shown : '';
  } catch { return ''; }
}
function refreshTenseHints() {
  if (state.parent) return;
  for (const el of document.querySelectorAll('.talk .grid .card[data-card-id]')) {
    const card = state.cards.find((c) => c.id === el.dataset.cardId);
    if (!card) continue;
    let hint = el.querySelector('.card-tense');
    const text = card.hidden ? '' : tenseHintFor(card);
    if (!text) { hint?.remove(); continue; }
    if (!hint) { hint = h('span', { class: 'card-tense', 'aria-hidden': 'true' }); el.append(hint); }
    hint.textContent = text;
  }
}

const COACH_TENSES = {
  fr: [['past', '⏪ Hier'], ['present', '⏺ Maintenant'], ['future', '⏩ Après']],
  dr: [['past', '⏪ Lbarah'], ['present', '⏺ Daba'], ['future', '⏩ Men b3d']],
  shi: [['past', '⏪ Iḍelli'], ['present', '⏺ Dɣi'], ['future', '⏩ Deffir']],
  rif: [['past', '⏪ Iḍennaḍ'], ['present', '⏺ Luxa'], ['future', '⏩ Deffir']],
  tzm: [['past', '⏪ Iḍelli'], ['present', '⏺ Dɣi'], ['future', '⏩ Deffir']],
  zgh: [['past', '⏪ Iḍelli'], ['present', '⏺ Dɣi'], ['future', '⏩ Deffir']],
};

// v10.19 : barre « Quand ? » repensée : trois grands moments et la phrase naturelle
// qu'on peut écouter d'un toucher. Elle reste figée sous la bande de phrase.
function coachBar() {
  const inflected = stripInflection();
  if (!inflected) return null;
  const amzLang = stripAmazighLang();
  let lang = 'fr';
  if (state.strip.every((item) => item.lang === 'dr')) lang = 'dr';
  else if (amzLang && (state.strip.every((item) => isAmazighLang(item.lang)) || isAmazighLang(state.lang))) lang = amzLang;
  const amzActive = isAmazighLang(lang);
  const sentences = {
    sentenceFr: inflected.sentenceFr, sentenceDr: inflected.sentenceDr, sentenceAr: inflected.sentenceAr,
    sentenceExtra: inflected.sentenceExtra, extraLang: inflected.extraLang, lang,
    sentenceAmazigh: inflected.sentenceAmazigh, sentenceAmazighLat: inflected.sentenceAmazighLat,
    sentenceAmazighTif: inflected.sentenceAmazighTif,
  };
  // v10.22 (Lot 2) : la phrase s'affiche dans la langue de l'enfant. Le français n'est qu'un écho,
  // jamais la ligne principale quand l'enfant parle une autre langue.
  const main = inflected.extraLang
    ? (inflected.sentenceExtra || inflected.sentenceFr)
    : (amzActive
      ? (inflected.sentenceAmazigh || inflected.sentenceFr)
      : (lang === 'dr' ? [inflected.sentenceDr, inflected.sentenceAr].filter(Boolean).join('  ·  ') : inflected.sentenceFr));
  const sub = inflected.extraLang
    ? (inflected.sentenceFr && inflected.sentenceFr !== inflected.sentenceExtra ? `FR · ${inflected.sentenceFr}` : '')
    : (amzActive || lang === 'dr' ? `FR · ${inflected.sentenceFr}` : '');
  const speakCoach = async () => {
    unlockAudio();
    const said = await sayNaturalSentence(sentences);
    if (!said) sayCards(state.strip, { onStep: (i) => { state.playing = i; renderStrip(); } });
  };
  const tenses = COACH_TENSES[lang] || COACH_TENSES.fr;
  return h('div', { class: 'coach' },
    h('div', { class: 'coach-row' },
      h('span', { class: 'coach-icon', 'aria-hidden': 'true', title: 'Quand ?' }, '⏰'),
      h('div', { class: 'coach-tenses', role: 'group', 'aria-label': 'Choisir le moment' },
        tenses.map(([code, text]) => h('button', {
          type: 'button',
          class: `coach-tense${getTense() === code ? ' active' : ''}`,
          'aria-pressed': String(getTense() === code),
          onclick: () => { setTense(code); refreshTenseHints(); renderStrip(); },
        }, text)))),
    h('button', { type: 'button', class: 'coach-sentence', title: 'Écouter la phrase', onclick: speakCoach },
      h('strong', {}, `🔊 ${main}`),
      sub && sub !== `FR · ${main}` ? h('small', {}, sub) : null));
}

// v9.13 : barre « ⏪ Hier / ⏺ Maintenant / ⏩ Après » + aperçu de la phrase complète,
// sous la bande. v10.19 : elle devient le coach de conjugaison de la page Parler.
function renderMorphSlot() {
  const slot = document.getElementById('morph-slot');
  if (!slot) return;
  const show = morphLangOk(state.strip) && ['talk', 'home'].includes(state.space) && !state.modeling && showsCoach(state.talkMode);
  const bar = show ? coachBar() : null;
  slot.replaceChildren(...(bar ? [bar] : []));
  slot.hidden = !bar;
}

// Mots proposés après le dernier mot de la phrase (appris sur les phrases de l'enfant).
function renderSuggestions() {
  const row = document.getElementById('suggest-row');
  if (!row) return;
  const next = state.modeling || !showsHints(state.talkMode) ? [] : suggestionsFor(state.strip, state.cards);
  row.replaceChildren(...(next.length ? [h('span', { class: 'suggest-label' }, '💡'), ...next.map((card) => tappableCard(card, { small: true }))] : []));
  row.hidden = !next.length;
  // v10.37 (mode Aide / Coach) : les cartes probables brillent dans la grille, sans prendre de place.
  document.querySelectorAll('.talk > .grid .card.hint-glow').forEach((el) => el.classList.remove('hint-glow', 'hint-first'));
  if (state.strip.length) {
    next.forEach((card, i) => document.querySelectorAll(`.talk > .grid .card[data-card-id="${CSS.escape(card.id)}"]`).forEach((el) => {
      el.classList.add('hint-glow');
      if (i === 0 && showsCoach(state.talkMode)) el.classList.add('hint-first');
    }));
  }
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
  $('#btn-play').onclick = async () => {
    // v9.12 : une phrase d'au moins 2 mots dite par l'enfant réveille Nour dans l'Album (sans bruit ni écran en plus).
    if (state.strip.length >= 2 && !state.parent) unlockFriendSticker('nour').catch(() => {});
    noteUtterance();
    await sayCards(state.strip, { onStep: (i) => { state.playing = i; renderStrip(); } });
    // v10.15 (pépite 11) : mode écho — « À toi ! » 2,5 s après la phrase, l'enfant imite.
    if (echoPracticeEnabled() && state.strip.length && !state.modeling) showEchoCue();
  };
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
  // v10.23 (pépite 1) : basculer ne touche ni les positions ni la phrase — chaque mot déjà posé garde sa langue,
  // donc l'enfant peut mélanger les deux langues dans une même phrase (code-switching).
  const twinBtn = $('#btn-twin');
  if (twinBtn) twinBtn.onclick = () => { const next = twinSwap(state.twin, state.lang); if (next && next !== state.lang) setLang(next); };
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
  const found = state.cards.find((c) => [label(c, state.lang), c.fr, c.dr].filter(Boolean).some((text) => String(text).toLowerCase().includes(q)));
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
  const tabs = h('nav', { class: 'tabs talk-cats', 'aria-label': 'Catégories' }, CATEGORIES.map((category) => {
    const tab = h('button', {
      type: 'button',
      class: `tab talk-cat${category.id === state.cat ? ' active' : ''}`,
      'aria-current': category.id === state.cat ? 'true' : null,
      onclick: () => { state.cat = category.id; renderView(); requestAnimationFrame(() => document.querySelector('.talk-board-head')?.scrollIntoView({ block: 'nearest' })); },
    },
    h('span', { class: 'talk-cat-emoji', 'aria-hidden': 'true' }, CATEGORY_EMOJI[category.id] || '💬'),
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
  const activeCategory = CATEGORIES.find((c) => c.id === state.cat) || CATEGORIES[0];
  const boardCards = sortedCards(state.cat);
  const boardHead = h('div', { class: 'talk-board-head' },
    h('span', { class: 'talk-board-emoji', 'aria-hidden': 'true' }, CATEGORY_EMOJI[state.cat] || '💬'),
    h('h2', { class: 'talk-board-title' }, categoryName(activeCategory, state.lang)),
    h('span', { class: 'talk-board-count' }, `${boardCards.filter(visibleFor).length}`));
  const grid = h('div', { class: `grid${exploring ? ' exploring' : ''}`, style: { '--cols': state.cols, '--cat-board': activeCategory.color } });
  const placeView = !state.parent && state.place ? placeBoardView(grid, tappable) : null;
  for (const card of placeView ? [] : boardCards) {
    const el = tappable(card);
    el.style.gridRow = String(card.gridRow);
    el.style.gridColumn = String(card.gridCol);
    if (card.hidden && !state.parent && !exploring) { el.style.visibility = 'hidden'; el.setAttribute('aria-hidden', 'true'); el.tabIndex = -1; }
    const hint = !state.parent && !card.hidden ? tenseHintFor(card) : '';
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
    state.parent ? btn('🖨️ Imprimer / PDF le tableau CAA', printAacBoard, 'ghost') : null,
    state.parent ? keyringBox() : null,
    state.parent ? twinBox() : null,
    state.parent ? touchSettingsBox() : null, state.parent ? motorPlanBox() : null, state.parent ? legend() : null);
  const view = h('div', { class: `talk${state.modeling ? ' modeling' : ''}${noPhrase ? '' : ' has-phrase'}${rail ? ' has-rail' : ''}` },
    friend, starterRow, placeView || tabs, boardHead, suggest, grid, adultTools, rail);
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

function renderView() {
  const view = $('#view');
  nav.leave();
  renderMorphSlot();
  if (state.space !== 'clinique') closeClinic();
  if (state.space === 'home') { view.replaceChildren(homeScreen()); return; }
  if (state.space === 'clinique') { view.replaceChildren(clinicHome({ lang: state.lang, cards: state.cards, parent: state.parent })); return; }
  if (state.space === 'cabinet') { view.replaceChildren(cabinetScreen({ parent: state.parent })); return; }
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

// v10.6 (P3.f) : vocabulaire de base dévoilé par paliers. Seulement sur demande de l'adulte.
// Les cartes gardent leur place ; on masque ou montre seulement les 21 mots du plan.
let motorPlanNote = '';
// v10.32 (pépite DictaPicto) : l'adulte écrit une phrase, l'enfant la voit en images et l'entend
// avec les voix des cartes (fichiers sons : marche aussi quand l'iPhone est en mode silencieux).
// Rien n'est envoyé ni gardé : la phrase reste seulement à l'écran.
let pictoDraft = '';
// v10.35 (pépite « Porte-clés », Tawasol) : mini-cartes de 4 cm à imprimer, plastifier et accrocher
// à un anneau (cartable, sac, ceinture). Le rond en haut à gauche indique où percer.
const KEYRING_CORE = ['Je veux', 'Aide-moi', 'Encore', 'Fini', 'Oui', 'Non', 'Attends', "J'ai mal", 'Toilettes', 'Eau', 'Manger', 'Calme'];
function keyringItems(setId) {
  const usable = state.cards.filter((c) => !c.hidden);
  const toCards = (items) => items.filter((i) => i.card).map((i) => (i.card.extra ? passingCard(i) : i.card));
  if (setId === 'core') return toCards(boardItems({ words: KEYRING_CORE }, usable, (c) => [label(c), c.fr]));
  if (setId.startsWith('cat:')) return usable.filter((c) => c.cat === setId.slice(4));
  const board = allPlaceBoards().find((b) => b.id === setId);
  return board ? toCards(boardItems(board, usable, (c) => [label(c), c.fr, c.dr])) : [];
}
function printKeyring(setId, title) {
  const cards = keyringItems(setId).slice(0, 24);
  if (!cards.length) return;
  const name = /^(mon enfant|l’enfant|l'enfant)$/i.test(String(firstName() || '').trim()) ? '' : firstName();
  const badge = h('div', { class: 'keyring-card keyring-badge' }, h('span', { class: 'keyring-hole', 'aria-hidden': 'true' }),
    h('strong', {}, name ? `Je m’appelle ${name}` : 'Bonjour'), h('small', {}, 'Je parle avec des images. Montrez-moi les cartes, attendez ma réponse.'));
  const area = h('div', { class: 'print-area' },
    h('div', { class: 'print-sheet keyring-sheet' },
      h('h1', {}, `Porte-clés de communication · ${title}`),
      h('p', { class: 'note' }, 'Découpez, plastifiez, percez le rond et accrochez à un anneau.'),
      h('div', { class: 'keyring-grid' }, badge, ...cards.map((c) => h('div', { class: 'keyring-card' }, h('span', { class: 'keyring-hole', 'aria-hidden': 'true' }),
        c.extra ? h('span', { class: 'keyring-emoji' }, c.emoji) : cardVisual(c),
        h('strong', {}, label(c, 'fr')), c.dr && !c.extra ? h('small', {}, c.dr) : null)))));
  document.body.append(area);
  const cleanup = () => { area.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 300);
}
function keyringBox() {
  const options = [['core', 'Mots essentiels (12)'], ...CATEGORIES.map((c) => [`cat:${c.id}`, `Dossier : ${categoryName(c, 'fr')}`]),
    ...allPlaceBoards().map((b) => [b.id, `Lieu : ${b.title}`])];
  const pick = h('select', { 'aria-label': 'Cartes du porte-clés' }, options.map(([v, t]) => h('option', { value: v }, t)));
  return h('details', { class: 'card-box keyring-box' }, h('summary', {}, '🔑 Porte-clés à imprimer'),
    h('p', { class: 'note' }, 'Des cartes de 4 cm avec un rond à percer, pour sortir sans téléphone. Choisissez puis « Imprimer » (ou « Enregistrer en PDF »).'),
    h('div', { class: 'row wrap' }, pick, btn('🖨️ Imprimer', () => printKeyring(pick.value, pick.selectedOptions[0].textContent), 'primary tiny')));
}

// v10.33 (pépites « Pages par lieu » et « Tableau express ») : le choix d'un lieu remplit la grille avec
// les mots de ce lieu. La ligne de mots de base reste en haut ; « ↩ » rend la grille habituelle.
const placeBtn = (icon, name, onclick) => h('button', { type: 'button', class: 'btn ghost place-btn', 'aria-label': name, title: name, onclick }, icon);
const allPlaceBoards = () => [...PLACES, ...state.placeBoards];
function placeBoardView(grid, tappable) {
  grid.classList.add('place-grid');
  if (state.place === 'pick') {
    grid.style.setProperty('--cat-board', '#5E60CE');
    for (const board of allPlaceBoards()) {
      grid.append(h('button', { type: 'button', class: 'card place-tile', 'aria-label': board.title,
        onclick: () => { state.place = board.id; stopSpeaking(); speak(board.title, { lang: 'fr' }); renderView(); } },
      h('span', { class: 'place-emoji', 'aria-hidden': 'true' }, board.emoji), h('span', { class: 'label' }, board.title)));
    }
    // v10.34 : les scènes (photo du parent, puis grandes scènes dessinées) se choisissent au même endroit.
    for (const scene of state.scenes) {
      const tile = h('button', { type: 'button', class: 'card place-tile scene-tile', 'aria-label': scene.title,
        onclick: () => { state.place = `scene:${scene.id}`; renderView(); } },
      h('span', { class: 'place-emoji', 'aria-hidden': 'true' }, '🖼️'), h('span', { class: 'label' }, scene.title));
      sceneImageUrl(scene.id).then((url) => { if (url) tile.querySelector('.place-emoji').replaceWith(h('img', { class: 'scene-thumb', src: url, alt: '' })); });
      grid.append(tile);
    }
    for (const scene of EXPLORE_SCENES) {
      grid.append(h('button', { type: 'button', class: 'card place-tile explore-tile', 'aria-label': scene.title,
        onclick: () => { state.place = `explore:${scene.id}`; renderView(); } },
      h('span', { class: 'place-emoji', 'aria-hidden': 'true' }, scene.emoji), h('span', { class: 'label' }, scene.title)));
    }
    return h('div', { class: 'place-head' }, h('strong', {}, '📍 Où allons-nous ?'),
      placeBtn('↩', 'Revenir à mes mots', () => { state.place = null; renderView(); }));
  }
  if (String(state.place).startsWith('explore:') || String(state.place).startsWith('scene:')) return sceneView(grid);
  if (state.place === 'intent' && state.intent) {
    state.intent.cards.forEach((card) => grid.append(tappable(card)));
    return h('div', { class: 'place-head' }, h('strong', {}, `💡 ${state.intent.title}`),
      placeBtn('↩', 'Revenir à mes mots', () => { state.place = null; state.intent = null; renderView(); }));
  }
  const board = allPlaceBoards().find((b) => b.id === state.place);
  if (!board) { state.place = null; return null; }
  const items = boardItems(board, state.cards.filter((c) => !c.hidden), (c) => [label(c), c.fr, c.dr, c.ar]);
  for (const item of items) {
    if (!item.card) { grid.append(h('span', { class: 'card place-word', role: 'note' }, h('span', { class: 'label' }, item.text))); continue; }
    grid.append(tappable(item.card.extra ? passingCard(item) : item.card));
  }
  return h('div', { class: 'place-head' }, h('strong', {}, `${board.emoji} ${board.title}`),
    placeBtn('📍', 'Choisir un autre lieu', () => { state.place = 'pick'; renderView(); }),
    placeBtn('↩', 'Revenir à mes mots', () => { state.place = null; renderView(); }));
}

// Le parent écrit un tableau express : un nom et des mots (virgules ou retours à la ligne).
let placeEditorMsg = '';
function placeEditorBox() {
  const title = h('input', { type: 'text', maxlength: 40, placeholder: 'Ex. : Chez Mamie', 'aria-label': 'Nom du tableau' });
  const emoji = h('select', { 'aria-label': 'Dessin du tableau' }, ['📌', '🏠', '👵', '🏥', '🏖️', '✈️', '🎂', '🛁', '🚌', '🍽️'].map((e) => h('option', { value: e }, e)));
  const words = h('textarea', { rows: 3, class: 'picto-input', placeholder: 'Ex. : Bonjour, Mamie, gâteau, jouer, câlin, au revoir', 'aria-label': 'Mots du tableau' });
  const preview = h('p', { class: 'note', 'aria-live': 'polite' }, placeEditorMsg);
  placeEditorMsg = '';
  const count = () => {
    const items = boardItems({ text: words.value }, state.cards, (c) => [label(c), c.fr, c.dr, c.ar]);
    const ok = items.filter((i) => i.card).length;
    preview.textContent = words.value.trim() ? `${ok} image${ok > 1 ? 's' : ''} trouvée${ok > 1 ? 's' : ''}${items.length > ok ? ` · sans image : ${items.filter((i) => !i.card).map((i) => i.text).join(', ')}` : ''}.` : '';
  };
  words.addEventListener('input', count);
  const save = async (list, msg) => {
    state.placeBoards = cleanCustomBoards(list);
    try { await db.setSetting(PLACE_SETTING_KEY, state.placeBoards); } catch (err) { console.error('[Kalimati] tableau express non enregistré', err); }
    placeEditorMsg = msg;
    renderView();
  };
  const add = () => {
    if (!title.value.trim() || !words.value.trim()) { preview.textContent = 'Écrivez un nom et au moins un mot.'; return; }
    save([...state.placeBoards, { id: newBoardId(), title: title.value, emoji: emoji.value, text: words.value }], 'Tableau enregistré ✔ (onglet 📍 Lieux)');
  };
  const list = state.placeBoards.map((b) => {
    let armed = false;
    const del = btn('🗑️', () => {
      if (!armed) { armed = true; del.textContent = 'Supprimer ?'; setTimeout(() => { armed = false; del.textContent = '🗑️'; }, 3000); return; }
      save(state.placeBoards.filter((x) => x.id !== b.id), 'Tableau supprimé');
    }, 'ghost tiny');
    del.setAttribute('aria-label', `Supprimer ${b.title}`);
    return h('li', { class: 'row' }, h('span', {}, `${b.emoji} ${b.title}`), del);
  });
  return h('details', { class: 'card-box place-editor', open: preview.textContent ? true : null }, h('summary', {}, '📍 Tableau express (un lieu, une sortie)'),
    h('p', { class: 'note' }, `Il s’ajoute à l’onglet 📍 Lieux de l’enfant, à côté des ${PLACES.length} lieux prêts (dentiste, médecin, école…). Les cartes de base ne bougent pas.`),
    h('div', { class: 'row wrap' }, emoji, title), words, preview, btn('Enregistrer le tableau', add, 'primary tiny'),
    list.length ? h('ul', { class: 'place-list' }, list) : null);
}

// ---------- v10.34 : scènes (photo du parent et grandes scènes dessinées) ----------
const sceneUrls = new Map();
async function sceneImageUrl(id) {
  if (sceneUrls.has(id)) return sceneUrls.get(id);
  const blob = await db.getSetting(sceneImageKey(id)).catch(() => null);
  if (!(blob instanceof Blob)) return null;
  const url = URL.createObjectURL(blob);
  sceneUrls.set(id, url);
  return url;
}
let sceneIndexCache = null;
function sceneWordCard(word) {
  if (!sceneIndexCache || sceneIndexCache.cards !== state.cards || sceneIndexCache.lang !== state.lang) {
    sceneIndexCache = { cards: state.cards, lang: state.lang,
      index: buildIndex([...state.cards.filter((c) => !c.hidden), ...extraConcepts()], (c) => (c.extra ? [c.fr, ...c.alt] : [label(c), c.fr, c.dr, c.ar])) };
  }
  const item = matchPictos(word, sceneIndexCache.index, { skipSmallWords: false }).find((it) => it.card);
  if (!item) return null;
  return item.card.extra ? passingCard(item) : item.card;
}
// Un objet de scène : le dessin de la carte (ou son petit dessin) et son mot. Toucher = parler + phrase.
function sceneTarget(card, cls, style) {
  const visual = card.extra ? h('span', { class: 'scene-emoji', 'aria-hidden': 'true' }, card.emoji) : cardVisual(card);
  const el = h('button', { type: 'button', class: `scene-target ${cls}`, style, 'aria-label': label(card) }, visual, h('span', { class: 'scene-label' }, label(card)));
  return bindTap(el, () => onCardTap(card, el), { key: `scene:${card.id}`, skip: () => state.parent });
}
function sceneView(grid) {
  grid.classList.add('scene-host');
  const [kind, id] = String(state.place).split(':');
  const back = h('div', { class: 'place-head' }, h('strong', {}, ''),
    placeBtn('📍', 'Choisir un autre lieu', () => { state.place = 'pick'; renderView(); }),
    placeBtn('↩', 'Revenir à mes mots', () => { state.place = null; renderView(); }));
  if (kind === 'explore') {
    const scene = EXPLORE_SCENES.find((s) => s.id === id);
    if (!scene) { state.place = 'pick'; return null; }
    back.firstChild.replaceWith(h('strong', {}, `${scene.emoji} ${scene.title}`));
    const stage = h('div', { class: `explore-stage bg-${scene.bg}`, role: 'group', 'aria-label': scene.title });
    for (const item of scene.items) {
      const card = sceneWordCard(item.word);
      if (card) stage.append(sceneTarget(card, 'explore-item', { left: `${item.x}%`, top: `${item.y}%` }));
    }
    grid.append(stage);
    return back;
  }
  const scene = state.scenes.find((s) => s.id === id);
  if (!scene) { state.place = 'pick'; return null; }
  back.firstChild.replaceWith(h('strong', {}, `🖼️ ${scene.title}`));
  const photo = h('div', { class: 'scene-photo', role: 'group', 'aria-label': scene.title });
  grid.append(photo);
  sceneImageUrl(scene.id).then((url) => {
    if (!url) { photo.append(h('p', { class: 'note' }, 'La photo de cette scène n’est pas dans ce téléphone.')); return; }
    const img = h('img', { src: url, alt: '' });
    img.onload = () => {
      // La photo garde ses proportions : le quadrillage est posé exactement dessus.
      const host = grid.getBoundingClientRect();
      const maxW = Math.max(120, host.width - 16); const maxH = Math.max(120, host.height - 16);
      const k = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
      photo.style.width = `${Math.round(img.naturalWidth * k)}px`;
      photo.style.height = `${Math.round(img.naturalHeight * k)}px`;
    };
    photo.append(img);
    for (const [i, word] of Object.entries(scene.cells)) {
      const card = sceneWordCard(word);
      if (!card) continue;
      const b = cellBox(scene.size, Number(i));
      photo.append(sceneTarget(card, 'photo-cell', { left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` }));
    }
  });
  return back;
}

// Le parent prépare une scène : une photo, un quadrillage, un mot par case utile.
let sceneEditorMsg = '';
function sceneEditorBox() {
  let photoBlob = null; let photoUrl = null; let selected = -1;
  const cells = {};
  const title = h('input', { type: 'text', maxlength: 40, placeholder: 'Ex. : Notre cuisine', 'aria-label': 'Nom de la scène' });
  const size = h('select', { 'aria-label': 'Nombre de cases' }, Object.keys(GRID_SIZES).map((n) => h('option', { value: n, selected: n === '9' ? 'selected' : null }, `${n} cases`)));
  const file = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Choisir ou prendre la photo' });
  const word = h('input', { type: 'text', maxlength: 40, placeholder: 'Mot de la case', 'aria-label': 'Mot de la case choisie', disabled: true });
  const msg = h('p', { class: 'note', 'aria-live': 'polite' }, sceneEditorMsg || 'Choisissez une photo, puis touchez une case et écrivez son mot.');
  sceneEditorMsg = '';
  const stage = h('div', { class: 'scene-photo editor', hidden: true });
  const draw = () => {
    stage.replaceChildren(...(photoUrl ? [h('img', { src: photoUrl, alt: '' })] : []));
    const n = Number(size.value);
    for (let i = 0; i < n; i += 1) {
      const b = cellBox(n, i);
      stage.append(h('button', { type: 'button', class: `scene-edit-cell${i === selected ? ' selected' : ''}${cells[i] ? ' filled' : ''}`,
        style: { left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` }, 'aria-label': `Case ${i + 1}${cells[i] ? ` : ${cells[i]}` : ''}`,
        onclick: () => { selected = i; word.disabled = false; word.value = cells[i] || ''; draw(); word.focus(); } }, cells[i] || String(i + 1)));
    }
  };
  file.onchange = async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    try { photoBlob = await resizePhoto(f, 1280); } catch { msg.textContent = 'Photo illisible. Essayez une autre photo.'; return; }
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = URL.createObjectURL(photoBlob);
    stage.hidden = false; draw();
  };
  size.onchange = () => { for (const k of Object.keys(cells)) if (Number(k) >= Number(size.value)) delete cells[k]; selected = -1; draw(); };
  const putWord = () => {
    if (selected < 0) return;
    const w = word.value.trim();
    if (w) {
      const card = sceneWordCard(w);
      msg.textContent = card ? `Case ${selected + 1} : « ${w} » ✔` : `« ${w} » n’a pas encore d’image : la case reste vide.`;
      if (card) cells[selected] = w; else delete cells[selected];
    } else delete cells[selected];
    draw();
  };
  word.addEventListener('keydown', (e) => { if (e.key === 'Enter') putWord(); });
  const save = async () => {
    if (!photoBlob || !title.value.trim() || !Object.keys(cells).length) { msg.textContent = 'Il faut une photo, un nom et au moins une case avec un mot.'; return; }
    const id = newSceneId();
    try {
      await db.setSetting(sceneImageKey(id), photoBlob);
      state.scenes = cleanScenes([...state.scenes, { id, title: title.value, size: Number(size.value), cells }]);
      await db.setSetting(SCENE_SETTING_KEY, state.scenes);
      sceneEditorMsg = 'Scène enregistrée ✔ (onglet 📍 Lieux)';
    } catch (err) { console.error('[Kalimati] scène non enregistrée', err); sceneEditorMsg = 'La scène n’a pas pu être enregistrée.'; }
    renderView();
  };
  const list = state.scenes.map((sc) => {
    let armed = false;
    const del = btn('🗑️', async () => {
      if (!armed) { armed = true; del.textContent = 'Supprimer ?'; setTimeout(() => { armed = false; del.textContent = '🗑️'; }, 3000); return; }
      state.scenes = state.scenes.filter((x) => x.id !== sc.id);
      try { await db.setSetting(SCENE_SETTING_KEY, state.scenes); await db.setSetting(sceneImageKey(sc.id), null); } catch (err) { console.error('[Kalimati] scène non supprimée', err); }
      sceneEditorMsg = 'Scène supprimée'; renderView();
    }, 'ghost tiny');
    del.setAttribute('aria-label', `Supprimer ${sc.title}`);
    return h('li', { class: 'row' }, h('span', {}, `🖼️ ${sc.title} (${sc.size} cases)`), del);
  });
  return h('details', { class: 'card-box scene-editor', open: sceneEditorMsg || msg.textContent.includes('✔') ? true : null }, h('summary', {}, '🖼️ Scène sur une vraie photo'),
    h('p', { class: 'note' }, 'La photo reste dans ce téléphone : elle ne part ni dans la sauvegarde ni dans la synchro.'),
    h('div', { class: 'row wrap' }, title, size), file, stage,
    h('div', { class: 'row wrap' }, word, btn('Mettre ce mot', putWord, 'ghost tiny')), msg,
    btn('Enregistrer la scène', save, 'primary tiny'),
    list.length ? h('ul', { class: 'place-list' }, list) : null);
}

// v10.37 : choix Simple / Aide / Coach (gardé dans le téléphone, et dans la sauvegarde).
function talkModeBox() {
  return h('div', { class: 'talk-mode-box', role: 'radiogroup', 'aria-label': 'Façon de parler' },
    h('strong', {}, 'Façon de parler : '),
    TALK_MODES.map((m) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(state.talkMode === m.id), class: `talk-mode-btn${state.talkMode === m.id ? ' on' : ''}`, title: m.desc,
      onclick: async () => {
        state.talkMode = m.id;
        try { await db.setSetting(TALK_MODE_KEY, m.id); } catch (err) { console.error('[Kalimati] mode non enregistré', err); }
        renderMorphSlot(); renderView();
      } }, `${m.emoji} ${m.title}`)),
    h('p', { class: 'note' }, (TALK_MODES.find((m) => m.id === state.talkMode) || TALK_MODES[2]).desc));
}

function textToPictoBox() {
  const input = h('textarea', { rows: 2, class: 'picto-input', placeholder: 'Ex. : On va à l’école en voiture', 'aria-label': 'Phrase à montrer en images', value: pictoDraft });
  input.value = pictoDraft;
  const line = h('div', { class: 'picto-line', 'aria-live': 'polite' });
  let items = [];
  let playing = 0;
  // Carte de Kalimati : sa voix (parent, livrée ou téléphone). Mot de secours : le mot écrit, dit par la voix du téléphone.
  const sayPicto = (item) => (item.card.extra ? speak(item.text, { lang: state.lang === 'dr' || isAmazighLang(state.lang) ? 'fr' : state.lang }) : sayCard(item.card, state.lang));
  const pictoEl = (item, big) => {
    if (!item.card) return h('span', { class: `picto-word${big ? ' big' : ''}` }, item.text);
    if (item.card.extra) {
      return h('button', { type: 'button', class: `card small picto-card picto-extra${big ? ' big' : ''}`, 'aria-label': item.text, onclick: () => { unlockAudio(); stopSpeaking(); sayPicto(item); } },
        h('span', { class: 'picto-emoji', 'aria-hidden': 'true' }, item.card.emoji), h('span', { class: 'label' }, item.text));
    }
    const el = cardElement(item.card, { small: !big, className: `picto-card${big ? ' big' : ''}` });
    el.onclick = () => { unlockAudio(); stopSpeaking(); sayCard(item.card, state.lang); };
    return el;
  };
  const playAll = async (holder) => {
    unlockAudio(); stopSpeaking();
    const token = ++playing;
    const els = [...holder.children];
    for (let i = 0; i < items.length; i += 1) {
      if (token !== playing || !holder.isConnected) break;
      if (!items[i].card) continue;
      els.forEach((e, j) => e.classList.toggle('speaking', j === i));
      try { await sayPicto(items[i]); } catch (err) { console.error('[Kalimati] image parlée', err); }
    }
    els.forEach((e) => e.classList.remove('speaking'));
  };
  const playBtn = btn('▶ Écouter', () => playAll(line), 'primary tiny');
  const bigBtn = btn('🔍 Montrer en grand', () => {
    const big = h('div', { class: 'picto-big-line' }, items.map((it) => pictoEl(it, true)));
    const close = () => { playing += 1; stopSpeaking(); overlay.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const overlay = h('div', { class: 'picto-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Phrase en images' },
      big, h('div', { class: 'row center' }, btn('▶ Écouter', () => playAll(big), 'primary'), btn('✕ Fermer', close, 'ghost')));
    document.addEventListener('keydown', onKey);
    document.body.append(overlay);
    playAll(big);
  }, 'ghost tiny');
  const note = h('p', { class: 'note' }, '');
  const draw = () => {
    pictoDraft = input.value;
    const index = buildIndex([...state.cards.filter((c) => !c.hidden), ...extraConcepts()], (c) => (c.extra ? [c.fr, ...c.alt] : [label(c), c.fr, c.dr, c.ar]));
    items = matchPictos(input.value, index);
    line.replaceChildren(...items.map((it) => pictoEl(it, false)));
    const found = items.filter((it) => it.card).length;
    playBtn.disabled = !found; bigBtn.disabled = !found;
    const missing = items.filter((it) => !it.card).map((it) => it.text);
    note.textContent = !input.value.trim() ? 'Écrivez une phrase : chaque mot connu devient une image.'
      : (missing.length ? `Sans image : ${missing.join(', ')}. Vous pouvez créer ces cartes en mode parent (＋ Ajouter).` : 'Tous les mots ont une image ✔');
  };
  let timer = 0;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(draw, 150); });
  draw();
  return h('details', { class: 'card-box picto-box', open: pictoDraft ? true : null }, h('summary', {}, '🔤 Écrire une phrase en images'),
    input, line, h('div', { class: 'row wrap' }, playBtn, bigBtn, btn('Effacer', () => { input.value = ''; draw(); input.focus(); }, 'ghost tiny')), note);
}

function motorPlanBox() {
  const status = h('p', { class: 'note', role: 'status' }, motorPlanNote);
  return h('details', { class: 'card-box touch-box', open: motorPlanNote ? true : null },
    h('summary', {}, '🧭 Mots de base par paliers (places fixes)'),
    h('p', { class: 'note' }, 'Chaque mot garde sa place. Un palier masque les mots pas encore travaillés, sans bouger les autres.'),
    ...MOTOR_STAGES.map((st) => h('div', { class: 'row spread wrap' },
      h('div', {}, h('strong', {}, st.label), h('br'), h('small', { class: 'note' }, st.description)),
      btn(`Palier ${st.stage}`, async () => {
        const before = new Map(state.cards.map((c) => [c.id, c]));
        const changed = applyProgressiveStage(state.cards, st.stage).filter((c) => before.get(c.id) !== c && Boolean(before.get(c.id).hidden) !== Boolean(c.hidden));
        if (changed.length) await saveCards(changed);
        motorPlanNote = changed.length ? `✅ Palier ${st.stage} appliqué (${changed.length} carte(s) changée(s)).` : `Palier ${st.stage} déjà en place.`;
        renderView();
      }, 'ghost tiny'))),
    status);
}

// v10.23 (pépite 1) : le parent choisit les deux langues de l'enfant (maison + école). Le choix ne déplace
// aucune carte — le plan moteur reste le seul repère de l'enfant.
function twinBox() {
  const home = state.twin ? state.twin.a : state.lang;
  const school = state.twin ? state.twin.b : suggestPartner(state.lang);
  const pickA = h('select', { 'aria-label': 'Première langue' },
    LANGS.map((l) => h('option', { value: l.code, selected: l.code === home }, `${l.flag} ${l.name}`)));
  const pickB = h('select', { 'aria-label': 'Deuxième langue' },
    LANGS.map((l) => h('option', { value: l.code, selected: l.code === school }, `${l.flag} ${l.name}`)));
  const apply = async (on) => {
    const a = pickA.value;
    const b = on && a === pickB.value ? LANGS.find((l) => l.code !== a).code : pickB.value;
    state.twin = on ? { a, b } : null;
    try { await saveTwin(state.twin); } catch (err) { console.error('[Kalimati] langue jumelle non enregistrée', err); }
    renderAll();
  };
  return h('details', { class: 'card-box twin-box' }, h('summary', {}, '🗣️ Deux langues sur la même grille'),
    h('p', { class: 'note' }, 'L’enfant voit les deux mots sur chaque carte et change de langue d’un seul toucher (bouton à côté de celle qu’il parle). Les cartes ne bougent pas : c’est toujours la même place pour le même mot.'),
    h('label', { class: 'check' }, 'Parler dans deux langues : ',
      h('input', { type: 'checkbox', checked: state.twin ? 'checked' : null, onchange: (e) => apply(e.target.checked) })),
    h('div', { class: 'row wrap' },
      h('label', { class: 'check' }, 'Langue 1 : ', pickA),
      h('label', { class: 'check' }, 'Langue 2 : ', pickB),
      btn('Changer les deux langues', () => apply(Boolean(state.twin)), 'ghost tiny')),
    h('p', { class: 'note' }, 'Dans une même phrase, chaque mot garde la langue avec laquelle il a été touché.'));
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
  // v10.6 : chaque zone est protégée ; une erreur dans l'une ne bloque plus les autres (bouton de langue, onglets, écran).
  const langBtn = $('#btn-lang');
  if (langBtn) langBtn.textContent = langInfo(state.lang).short;
  const colsEl = $('#cols');
  if (colsEl) colsEl.value = String(state.cols);
  try { renderStrip(); } catch (err) { console.error('renderStrip', err); }
  try { renderSpaces(); } catch (err) { console.error('renderSpaces', err); }
  document.dispatchEvent(new CustomEvent('kalimati-parent', { detail: { parent: state.parent, lang: state.lang } }));
  // On ne coupe pas un exercice en cours quand le parent verrouille ou déverrouille.
  try {
    if (['home', 'talk', 'progress', 'cabinet'].includes(state.space) || !$('#view').firstChild) renderView();
  } catch (err) { console.error('renderView', err); }
  renderToiletCount();
}

// ---------- Bouton permanent 🚽 Toilettes (X.1) ----------
async function renderToiletCount() {
  const count = (await todayTrials('X.1')).filter((t) => t.result === 'plus').length;
  $('#toilet-count').textContent = state.parent ? `${count}/4` : '';
  // v10.24 : l'étiquette était écrite en dur « Toilettes / Bit lma » : elle ne suivait jamais la langue.
  // Elle prend maintenant le mot de la carte dans la langue choisie — en darija, en lettres arabes.
  const card = state.cards.find((c) => c.id === TOILET_CARD_ID);
  const word = card ? label(card) : ui('toiletTime', state.lang);
  const span = $('#toilet span');
  if (span && card) {
    // En français, le mot darija reste en dessous : c'est ce que l'adulte apprend avec l'enfant.
    const lines = [card.fr, label(card, 'dr')].filter((t) => t && String(t).trim());
    const shown = state.lang === 'fr' ? lines : [word];
    span.replaceChildren(...shown.flatMap((t, i) => (i ? [document.createElement('br'), document.createTextNode(t)] : [document.createTextNode(t)])));
  } else if (span) {
    span.textContent = word;
  }
  $('#toilet').setAttribute('aria-label', word);
}

function setupToilet() {
  $('#toilet').onclick = async () => {
    stopSpeaking();
    const card = state.cards.find((c) => c.id === TOILET_CARD_ID);
    if (card) sayCard(card, state.lang); else speak(state.lang === 'fr' ? 'Toilettes' : state.lang === 'ar' ? 'الحمام' : 'بيت الما', { lang: state.lang === 'fr' ? 'fr' : 'ar' });
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
  if (!reminderShown) {
    reminderShown = true;
    const said = spokenUi('toiletTime', state.lang);
    speak(said.text, { lang: said.lang });
  }
  const done = async (kind) => { await logToilet(kind); banner.hidden = true; reminderShown = false; renderToiletCount(); };
  banner.replaceChildren(h('strong', {}, `🚽 ${ui('toiletTime', state.lang)}`),
    h('button', { type: 'button', class: 'btn rate-plus', onclick: () => done('dry') }, `${ui('toiletDry', state.lang)} ✅`),
    h('button', { type: 'button', class: 'btn rate-minus', onclick: () => done('accident') }, `${ui('toiletAccident', state.lang)} ⚠️`),
    h('button', { type: 'button', class: 'btn ghost', onclick: async () => { await db.setSetting('toiletReminder', { ...reminder, next: Date.now() + SNOOZE_MS }); banner.hidden = true; reminderShown = false; } }, ui('toiletSnooze', state.lang)));
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

// v10.11 : mot de passe de la sauvegarde chiffrée. Le dialogue rend la main (null) si le parent annule.
function askBackupPassword({ confirm = false } = {}) {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'lang-dialog', 'aria-label': confirm ? 'Chiffrer la sauvegarde' : 'Mot de passe de la sauvegarde' });
    const first = h('input', { type: 'password', autocomplete: 'new-password', placeholder: `Mot de passe (${BACKUP_PASSWORD_MIN} caractères minimum)`, 'aria-label': 'Mot de passe' });
    const second = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Recopier le mot de passe', 'aria-label': 'Recopier le mot de passe' });
    const err = h('p', { class: 'note err-text', role: 'alert' });
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      if (dialog.open) dialog.close();
      dialog.remove();
      resolve(value);
    };
    const submit = () => {
      const value = first.value.trim();
      if (value.length < BACKUP_PASSWORD_MIN) { err.textContent = `Au moins ${BACKUP_PASSWORD_MIN} caractères.`; first.focus(); return; }
      if (confirm && value !== second.value.trim()) { err.textContent = 'Les deux mots de passe ne sont pas identiques.'; second.focus(); return; }
      finish(value);
    };
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
    dialog.append(h('form', { class: 'stack pad', onsubmit: (e) => { e.preventDefault(); submit(); } },
      h('h3', {}, confirm ? '🔒 Chiffrer la sauvegarde' : '🔑 Sauvegarde chiffrée'),
      h('p', { class: 'note' }, confirm
        ? 'Sans ce mot de passe, le fichier reste illisible, même si quelqu’un le trouve. Kalimati ne peut pas le retrouver : notez-le en lieu sûr, séparément du fichier.'
        : 'Saisissez le mot de passe choisi au moment de la sauvegarde.'),
      first,
      confirm ? second : null,
      err,
      h('div', { class: 'row wrap' },
        h('button', { type: 'submit', class: 'btn primary' }, confirm ? '🔒 Chiffrer' : '🔓 Déverrouiller'),
        h('button', { type: 'button', class: 'btn ghost', onclick: () => finish(null) }, 'Annuler'))));
    document.body.appendChild(dialog);
    dialog.showModal();
    first.focus();
  });
}

// ---------- Choix de la langue ----------
// v10.22 (Lot 2) : langue ET sens de lecture. L'arabe (et toute langue rtl des locales) bascule
// la page entière en « de droite à gauche » : menus, grilles, bande de phrase. Aucun texte n'est
// pivoté à la main, le navigateur s'en charge dès que <html dir="rtl"> est posé.
function applyLangDir() {
  const code = (langInfo(state.lang).tts || 'fr').split('-')[0];
  document.documentElement.lang = code; // v10.5 (A21)
  document.documentElement.dir = langInfo(state.lang).rtl ? 'rtl' : 'ltr'; // v10.22 (Lot 2)
}

async function setLang(code) {
  state.lang = langInfo(code).code;
  setActiveLang(state.lang);
  applyLangDir();
  // v10.7 : voix amazighes de la variété choisie, gardées en mémoire (le son part tout de suite au toucher).
  loadAmazighVoices(state.lang).then(() => { if (isAmazighLang(state.lang) && state.parent) renderView(); }).catch(() => {});
  // v10.7.1 : le pack de voix d'essai de cette variété arrive tout seul, en arrière-plan (fichiers du site seulement).
  if (isAmazighLang(state.lang)) autoInstallAmazighVoicePack(state.lang);
  // v10.5.2 : l'écran change tout de suite ; l'enregistrement suit (avant, une écriture bloquée sur iPhone empêchait le changement).
  renderAll();
  await db.setSetting('lang', state.lang).catch((err) => console.error('[Kalimati] langue non enregistrée', err));
}

function openLangPicker() {
  const opener = document.activeElement;
  const dialog = h('dialog', { class: 'lang-dialog', 'aria-label': 'Choisir la langue' });
  const close = () => { if (dialog.open) dialog.close(); dialog.remove(); try { opener?.focus?.(); } catch { /* rien */ } };
  // v10.7 : bouton 🔊 pour les parents qui ne lisent pas : il dit l'aide, et le nom de chaque langue.
  const sayHello = (code, prefix = '') => { const said = spokenUi('hello', code); return speak(`${prefix}${said.text}`, { lang: said.lang }); };
  const helpBtn = h('button', {
    type: 'button', class: 'audio-help-btn', 'aria-label': 'Écouter l’aide pour choisir la langue',
    onclick: () => { unlockAudio(); speak('Touchez votre langue. Le petit haut-parleur dit le nom de chaque langue.', { lang: 'fr' }); },
  }, '🔊 Aide');
  dialog.append(h('div', { class: 'stack pad' },
    h('div', { class: 'row spread wrap' }, h('h3', {}, '🌍 Langue / اللغة / Language'), helpBtn),
    h('div', { class: 'lang-grid' }, LANGS.map((l) => h('div', { class: 'lang-choice-row' },
      h('button', {
        type: 'button', class: `lang-choice${l.code === state.lang ? ' active' : ''}`, lang: l.tts, dir: l.rtl ? 'rtl' : 'auto',
        onclick: () => { close(); setLang(l.code); sayHello(l.code); },
      }, h('span', { class: 'emoji' }, l.flag), h('span', { class: 'lang-names' }, h('span', {}, l.name), l.sub ? h('small', { class: 'lang-sub' }, l.sub) : null)),
      h('button', {
        type: 'button', class: 'audio-help-btn tiny', 'aria-label': `Écouter : ${l.name}`,
        onclick: (e) => { e.stopPropagation(); unlockAudio(); sayHello(l.code, `${l.name}. `); },
      }, '🔊')))),
    h('p', { class: 'note' }, 'Français et darija : vos voix enregistrées. Autres langues : la voix du téléphone dit les mots traduits.'),
    h('p', { class: 'note' }, 'Amazigh (ⵣ) : la carte dit votre voix, enregistrée en mode parent. Sans voix enregistrée, elle reste muette. Mots amazighs à faire relire par un locuteur natif.'),
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
    const now = Date.now();
    const cards = relayout(state.cards, state.cols).map((c) => ({ ...c, updatedAt: now }));
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
        setActiveLang(state.lang);
        state.cols = (await db.getSetting('cols')) || 4;
        state.cards = await loadCards();
        renderAll();
      },
    });
  }
  // v9.10 : sauvegarde en 2 temps. L'écran reste libre, le bouton montre où on en est, et un message dit clairement le résultat.
  let backupFile = null;
  let backupEncrypted = false;
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
          const kept = backupEncrypted ? ' ⚠️ Fichier chiffré : gardez le mot de passe séparément, sinon il est illisible.' : '';
          showPanel((result === 'shared'
            ? '✅ Sauvegarde envoyée. Gardez ce fichier en lieu sûr (Fichiers, Drive ou e-mail).'
            : '✅ Sauvegarde téléchargée. Vous la trouverez dans « Téléchargements » ou « Fichiers ».') + kept, false);
          showBackupAge();
        } catch (error) {
          save.disabled = false;
          showPanel(`⚠️ L’enregistrement n’a pas marché. Réessayez. (${error.message || 'erreur inconnue'})`, true);
        }
      };
      close.onclick = () => { backupFile = null; backupEncrypted = false; panel.replaceChildren(); panel.hidden = true; };
      panel.append(h('div', { class: 'backup-actions' }, save, close));
    }
    panel.hidden = false;
  };
  exportBtn.onclick = async () => {
    if (exportBtn.disabled) return;
    exportBtn.disabled = true;
    exportBtn.setAttribute('aria-busy', 'true');
    exportBtn.textContent = '⏳ Préparation… 0 %';
    backupFile = null;
    backupEncrypted = false;
    panel.hidden = true;
    try {
      // v10.5 : par défaut, la sauvegarde ne contient ni photo ni voix (textes, cartes, journaux, bilans seulement).
      const includeMedia = Boolean($('#backup-media')?.checked);
      const encrypt = Boolean($('#backup-encrypt')?.checked);
      backupEncrypted = false;
      let passphrase = null;
      if (encrypt) {
        exportBtn.textContent = '🔑 Mot de passe…';
        passphrase = await askBackupPassword({ confirm: true });
        if (!passphrase) return;
      }
      backupFile = await buildBackupFile({ cards: state.cards, trials: await db.getAllTrials(), settings: await collectSettings(),
        visuals: includeMedia ? await db.getAllVisualOverrides() : [], abcLogs: await db.getAllAbcLogs(), orthoLogs: await db.getAllOrthoLogs(), includeMedia },
      (pct) => { exportBtn.textContent = `⏳ Préparation… ${pct} %`; });
      if (passphrase) {
        exportBtn.textContent = '🔒 Chiffrement…';
        backupFile = await encryptBackupFile(backupFile, passphrase);
        backupEncrypted = true;
      }
      const size = backupFile.size >= 1048576 ? `${(backupFile.size / 1048576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(backupFile.size / 1024))} Ko`;
      showPanel(`✅ Sauvegarde prête (${size}, ${includeMedia ? 'AVEC photos et voix' : 'sans photo ni voix'}${backupEncrypted ? ', chiffrée par mot de passe' : ''}). Touchez « Enregistrer le fichier » pour la garder.`, true);
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
      let backup;
      try {
        backup = await readBackup(file);
      } catch (error) {
        if (!error.needsPassphrase) throw error;
        const passphrase = await askBackupPassword({ confirm: false });
        if (!passphrase) return;
        backup = await readBackup(file, passphrase);
      }
      const parts = [backup.trials.length && `${backup.trials.length} essais notés`, backup.abcLogs.length && `${backup.abcLogs.length} notes du journal des comportements`,
        backup.orthoLogs.length && `${backup.orthoLogs.length} notes d’orthophonie`].filter(Boolean);
      const extra = parts.length ? ` et ${parts.join(', ')}` : '';
      // v10.3.2 : la restauration AJOUTE la sauvegarde sans rien effacer. Rien n'est écrit avant le « OK » du parent.
      if (!window.confirm(`Ajouter ${backup.cards.length} cartes${extra} de la sauvegarde ?\n\nRien n’est effacé : les cartes, bilans, histoires et notes plus récents du téléphone sont gardés.`)) return;
      const localCards = await db.getAllCards();
      // v10.10 : les cartes restaurées sont marquées comme modifiées maintenant, sinon
      // une synchro suivante pourrait les remplacer par un paquet plus ancien.
      const now = Date.now();
      const incoming = backup.cards.map((c) => ({ ...c, updatedAt: now }));
      const cards = assignPositions(mergeBackupCards(localCards, incoming), state.cols);
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
      setTimerShowNumbers((await db.getSetting(TIMER_SETTING_KEY)) === true);
      applyUppercase((await db.getSetting(UPPERCASE_SETTING_KEY)) === true);
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
    const fromBackup = foldLegacyAudio(card);
    const keptLocal = foldLegacyAudio(local);
    for (const field of ['photo', 'video']) merged[field] = card[field] || local[field] || null;
    // v10.21 (Lot 1) : les voix se gardent par langue dans audios[code] ; la sauvegarde fait foi, le téléphone complète.
    const audios = { ...(keptLocal.audios || {}) };
    for (const [code, blob] of Object.entries(fromBackup.audios || {})) if (blob) audios[code] = blob;
    merged.audios = audios;
    delete merged.audioFr;
    delete merged.audioDr;
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

async function loadCards() {
  let cards = await db.getAllCards();
  if (cards.length === 0 && !(await db.getSetting('seeded'))) {
    cards = defaultCards().map(stripNew);
    await db.setSetting('seeded', true);
  } else if (!(await db.getSetting('v3migrated'))) {
    cards = migrateCards(cards, (await db.getSetting('v2migrated')) ? 2 : 1, { defaults: defaultCards(), selfId: SELF_CARD_ID, firstName: profile.name });
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
  // v10.20 : les tout premiers identifiants (cartes de famille et étape « Jouer avec … ») contenaient des
  // fragments de prénoms. On les renomme en identifiants techniques, une seule fois, sans écrire aucun prénom
  // ici : les cartes, leurs photos partagées (visual_overrides) et les coches du planning suivent le renommage.
  if (!(await db.getSetting('v10.20migrated'))) {
    const { renameCardId, renameVkey } = planPersonRename(cards);
    if (renameCardId.size || renameVkey.size) {
      cards = cards.map((card) => {
        const next = { ...card };
        if (renameCardId.has(next.id)) next.id = renameCardId.get(next.id);
        if (typeof next.visualKey === 'string' && renameVkey.has(next.visualKey)) next.visualKey = renameVkey.get(next.visualKey);
        return next;
      });
      const moved = [];
      const staleKeys = [];
      for (const override of await db.getAllVisualOverrides()) {
        const nextKey = renameVkey.get(override.key);
        if (!nextKey) continue;
        moved.push({ ...override, key: nextKey });
        staleKeys.push(override.key);
      }
      if (moved.length) {
        await db.putVisualOverrides(moved);
        await Promise.all(staleKeys.map((key) => db.deleteVisualOverride(key)));
      }
      await Promise.all([...renameCardId.keys()].map((oldId) => db.deleteCard(oldId)));
    }
    await db.setSetting('v10.20migrated', true);
  }
  await db.setSetting('v2migrated', true);
  await db.setSetting('v3migrated', true);
  const placed = assignPositions(cards, state.cols);
  await db.putCards(placed);
  return placed;
}

async function init() {
  captureMagicKeyFromUrl(); // v10.5 : la clé du lien #key= quitte l'adresse avant toute autre chose
  // v10.8 : journal d'erreurs local (dans le téléphone, anonyme : ni prénom, ni voix, ni photo, ni phrase, ni clé).
  initGlobalErrorLogger({
    getContext: () => ({ v: APP_VERSION, lang: state.lang || 'fr', space: state.space || 'home', online: typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true }),
  });
  window.addEventListener('kalimati-diagnostic', (e) => { if (e?.detail?.type) logDiagnostic(e.detail.type, e.detail.detail, e.detail); });
  nav.attach($('#view'));
  state.lang = langInfo((await db.getSetting('lang')) || 'fr').code;
  setActiveLang(state.lang);
  state.twin = await loadTwin(); // v10.23 (pépite 1) : deux langues simultanées, si le parent les a choisies
  state.placeBoards = cleanCustomBoards(await db.getSetting(PLACE_SETTING_KEY).catch(() => null)); // v10.33 : tableaux express
  state.scenes = cleanScenes(await db.getSetting(SCENE_SETTING_KEY).catch(() => null)); // v10.34 : scènes sur photo
  state.talkMode = normalizeTalkMode(await db.getSetting(TALK_MODE_KEY).catch(() => null)); // v10.37 : Simple / Aide / Coach
  applyLangDir(); // v10.22 (Lot 2) : langue + sens de lecture (arabe = rtl)
  // v10.24 : écriture de la darija choisie par le parent (lettres arabes par défaut). Elle doit être
  // connue avant le premier écran : sinon les mots s'affichent en arabizi une seconde puis sautent.
  const savedDarijaScript = await db.getSetting('darijaScript').catch(() => null);
  setDarijaScript(isDarijaScript(savedDarijaScript) ? savedDarijaScript : 'arabe');
  document.addEventListener('kalimati-darija-script', (e) => {
    setDarijaScript(isDarijaScript(e?.detail) ? e.detail : 'arabe');
    renderAll();
  });
  // v10.7 : écriture amazighe choisie (tifinagh + latin par défaut) et voix amazighes en mémoire (sans bloquer l'ouverture).
  const savedScript = await db.getSetting('amazighScript').catch(() => null);
  state.amazighScript = isAmazighScript(savedScript) ? savedScript : 'both';
  loadAmazighVoices(state.lang).catch(() => {});
  readAmazighPackState(); // v10.7.2 : pour la ligne « voix » de l'Accueil (ne bloque pas l'ouverture)
  document.addEventListener('kalimati-amazigh-voices-progress', () => fillAmazighVoiceLine(document.getElementById('amz-status')));
  document.addEventListener('kalimati-amazigh-script', (e) => {
    state.amazighScript = isAmazighScript(e?.detail) ? e.detail : 'both';
    if (!isAmazighLang(state.lang)) return;
    // Choisi dans Progrès : la page reste ouverte (seule la phrase change) ; Parler suivra à l'ouverture.
    if (state.space === 'progress') { try { renderStrip(); } catch (err) { console.error('renderStrip', err); } } else renderAll();
  });
  document.addEventListener('kalimati-amazigh-voices-changed', () => {
    loadAmazighVoices(state.lang).then(() => { if (isAmazighLang(state.lang) && ['talk', 'home'].includes(state.space)) renderView(); }).catch(() => {});
  });
  await loadAacPlus();
  $('#calm').onclick = () => openCalm(state.lang);
  state.cols = (await db.getSetting('cols')) || 4;
  await loadContext();
  // v10.36 : un nouvel enfant ouvert pour la première fois reçoit le prénom écrit dans « Enfants sur ce téléphone ».
  try {
    const child = listChildren().find((c) => c.id === activeChildId());
    if (child && child.id !== MAIN_ID && child.name && !profile.name) await saveProfile({ name: child.name });
  } catch (err) { console.error('[Kalimati] prénom du nouvel enfant', err); }
  try { setDiagnosticForbiddenNames([firstName()]); } catch { /* pas de prénom */ } // v10.8
  await loadFriendsState().catch(() => {});
  await loadMorphologyState().catch(() => {});
  await loadEyeTracking().catch(() => {}); // v10.1 : mode regard (désactivé par défaut)
  document.addEventListener('kalimati-friends-changed', () => { if (state.space === 'talk') renderView(); });
  // v10.1.2 : les listes d'images et de voix ne bloquent plus l'ouverture plus de 2,5 s (réseau lent = écran vide avant).
  const visualsReady = loadVisuals().catch(() => {});
  const visualsInTime = await Promise.race([visualsReady.then(() => true), new Promise((r) => setTimeout(() => r(false), 2500))]);
  if (!visualsInTime) visualsReady.then(() => { try { if (['home', 'talk'].includes(state.space)) renderView(); renderStrip(); } catch { /* écran déjà affiché */ } });
  loadDefaultVoices().catch(() => {});
  await loadNetworkMode().catch(() => {});
  setCloudSpeechAllowed((await db.getSetting(SPEECH_SETTING_KEY)) === true);
  await loadOnlineLookupSetting().catch(() => {});
  setTimerShowNumbers((await db.getSetting(TIMER_SETTING_KEY)) === true);
  applyUppercase((await db.getSetting(UPPERCASE_SETTING_KEY)) === true);
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
      setActiveLang(state.lang);
      state.twin = await loadTwin(); // v10.23 (pépite 1) : le binôme de langues vient de la sauvegarde
      loadAmazighVoices(state.lang).catch(() => {});
      if (isAmazighLang(state.lang)) autoInstallAmazighVoicePack(state.lang);
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
  // v10.7.3 : l'arrivée des voix amazighes part dès que l'écran est affiché (avant, elle attendait la fin
  // du démarrage, qui pouvait rester bloquée sur iPhone : « elles arrivent dans un instant » sans fin).
  setTimeout(() => { if (isAmazighLang(state.lang)) autoInstallAmazighVoicePack(state.lang); }, 800);
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
        setActiveLang(state.lang);
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
  // v10.7.1 : en amazigh, le pack de voix d'essai de la variété choisie arrive tout seul, après l'ouverture
  // (une fois par ouverture ; seulement des fichiers du site Kalimati, rien ne part du téléphone).
  const amazighPackSoon = () => { if (isAmazighLang(state.lang)) autoInstallAmazighVoicePack(state.lang); };
  setTimeout(amazighPackSoon, 1500);
  window.addEventListener('online', amazighPackSoon);
  // v10.7.2 : un téléchargement coupé (appli mise en arrière-plan) reprend au retour dans l'appli.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') amazighPackSoon(); });
  // v10.17 : la mise à jour ne recharge plus jamais la page toute seule (sur iPhone, cela
  // pouvait laisser l'écran vide et se répéter). Elle s'active à la prochaine ouverture,
  // ou sur toucher du parent depuis Progrès → Mise à jour de l'application.
  startAppUpdateWatch();
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
