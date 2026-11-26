// Kalimati v10.27 (darija en lettres arabes par défaut ; arabe standard sur les écrans enfant ; thèmes cahier d’école, simple, noir et blanc).
import { markStartupStart, recordFirstRender } from './modules/startup-timing.js'; // Lot 1, L1-04 : chronomètre de démarrage, le plus tôt possible
import './modules/util.js'; // en premier : garde-fou contre les textes « null »
import './modules/storage.js';
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
import { LANGS, langInfo, isAmazighLang, isAmazighScript, isDarijaScript, setDarijaScript, isExtraLang, cardWord, cardSpeechText, categoryName, ui, spokenUi, zhClassifierAt } from './modules/languages.js';
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
import { VIDEO_SETTING_KEY, VIDEO_WHO, videoBlobKey, newVideoId, cleanVideos, videoProblem } from './modules/model-videos.js';
import { GRID_SIZES, SCENE_SETTING_KEY, sceneImageKey, newSceneId, cleanScenes, EXPLORE_SCENES, cellBox } from './modules/scenes.js';
import { loadVisuals, renderVisual, hasPhoto, setVisual, clearVisual } from './modules/visuals.js';
import { uiIcon } from './modules/ui-icons.js';
import { loadFriendsState, friendCompanionBanner, unlockFriendSticker } from './modules/friends.js';
import { loadMorphologyState, inflectStrip, getTense, setTense } from './modules/morphology.js';
import { loadEyeTracking } from './modules/eye-and-packs.js';
import { initCloudSyncFromUrlAndAuto, captureMagicKeyFromUrl } from './modules/cloud-sync.js';
import { checkUrlInvite, openSetupWizard, superAdminScreen } from './modules/admin-beta.js';
import { APP_VERSION } from './modules/version.js';
import { initGlobalErrorLogger, LOG_TYPES, logDiagnostic, recordRejectedTap, setDiagnosticForbiddenNames } from './modules/error-log.js';
import { isFallbackMode, enableFallbackMode, getFallbackCards } from './modules/db-fallback.js';
import { requestPersistentStorage } from './modules/storage-persist.js';
import { loadOnlineLookupSetting } from './modules/online-bank.js';
import { loadNetworkMode } from './modules/network-policy.js';
import { setTimerShowNumbers, TIMER_SETTING_KEY } from './modules/timer.js';
import { setActiveLang, tx } from './modules/section-i18n.js';
import { clinicHome, closeClinic } from './modules/clinique.js';
import { clinicT } from './modules/clinic-i18n.js';
import { cabinetScreen } from './modules/cabinet.js';
import { startAppUpdateWatch } from './modules/app-update.js';
import { migrateCards, stripNew, planPersonRename } from './modules/card-migration.js';
import { createTalkTools } from './modules/talk-tools.js';
import { createStripController } from './modules/strip-controller.js';
import { createViews } from './modules/views.js';
import { createBackupUi } from './modules/backup-ui.js';

// Lot 1, L1-04 : départ du chronomètre au tout début du script (les imports ES sont déjà chargés ici).
markStartupStart();

const HOLD_TO_UNLOCK_MS = 3000;
const MAX_STRIP = 8;
const CORE_CAT = 'base';
const REMINDER_CHECK_MS = 30000;
const SNOOZE_MS = 10 * 60000;
// v9.7 : la sauvegarde simple garde aussi le planning, les histoires, le bilan ATEC, les mots proposés et le toucher adapté.
const EXPORTED_SETTINGS = ['lang', 'twinLang', 'cols', 'darijaScript', 'clinic', 'profile', 'toiletReminder', 'levels',
  'customSchedules', 'scheduleTempOverrides', 'stories', 'atecHistory', 'atec_history', 'aacHistory', 'touch', 'visualStyle', 'childGender', 'therapistName', 'speechCloudAllowed', 'friendsAlbum', 'hideFriends', 'timerShowNumbers', 'uppercaseText', 'placeBoards', 'visualScenes', 'talkMode'];

const state = { cards: [], cat: 'manger', lang: 'fr', twin: null, amazighScript: 'both', cols: 4, parent: false, strip: [], space: 'home', playing: -1, modeling: false, model: [], place: null, placeBoards: [], scenes: [], videos: [], talkMode: 'coach', intent: null };
const photoUrls = new Map();
const $ = (selector) => document.querySelector(selector);
const nav = createNavigator({ container: null, state, goHome: () => openSpace('home') });
// v10.42 (Lot 4.1) : le chef d'orchestre partage l'état et ses fonctions avec les modules découpés.
const app = { state, nav, photoUrls, CORE_CAT, EXPORTED_SETTINGS };

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
  // L1-07 : en mode secours, la base ne répond pas : on parle la carte sans ouvrir l'éditeur (lecture seule).
  if (state.parent) { if (exploreActive() || isFallbackMode()) { stopSpeaking(); sayCard(card, state.lang); return; } editCard(card); return; }
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

Object.assign(app, { $, label, sayMenu, cardElement, cardVisual, fillLabel, onCardTap, tappableCard, renderAll, renderView, loadCards, showBackupAge });
// v10.42 (Lot 4.1) : Bande de phrase : cartes touchées, accords, temps, suggestions, lecture → modules/strip-controller.js
Object.assign(app, createStripController(app));
const { renderStrip, tenseHintFor, refreshTenseHints, renderMorphSlot, renderSuggestions, renderModel, setupStrip } = app;
// v10.42 (Lot 4.1) : Vues : espace Parler, les 5 espaces et l’écran d’accueil → modules/views.js
Object.assign(app, createViews(app));
const { exploreActive, renderTalk, editCard, renderSpaces, openSpace, homeScreen, fillAmazighVoiceLine } = app;
function renderView() {
  const view = $('#view');
  nav.leave();
  renderMorphSlot();
  if (state.space !== 'clinique') closeClinic();
  if (state.space === 'home') { view.replaceChildren(homeScreen()); return; }
  if (state.space === 'clinique') { view.replaceChildren(clinicHome({ lang: state.lang, cards: state.cards, parent: state.parent })); return; }
  if (state.space === 'cabinet') { view.replaceChildren(cabinetScreen({ parent: state.parent })); return; }
  if (state.space === 'talk') { view.replaceChildren(renderTalk()); recordFirstRender(); return; }
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

// v10.42 (Lot 4.1) : Outils adulte de Parler : lieux, scènes, vidéos modèles, porte-clés, texte en images, modes → modules/talk-tools.js
Object.assign(app, createTalkTools(app));
const { keyringBox, placeBoardView, placeEditorBox, sceneEditorBox, videoEditorBox, talkModeBox, textToPictoBox, motorPlanBox, twinBox } = app;
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
  // L1-07 : en mode secours, on n'interroge pas une base qui ne répond pas.
  const count = isFallbackMode() ? 0 : (await todayTrials('X.1')).filter((t) => t.result === 'plus').length;
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
    // v10.42 (Lot 4.2) : sans carte Toilettes, le mot est dit dans la langue choisie (plus jamais la darija pour l'espagnol).
    if (card) sayCard(card, state.lang);
    else if (isExtraLang(state.lang)) speak(cardSpeechText({ id: 'c-besoins-toilettes', fr: 'Toilettes', gram: 'social' }, state.lang), { lang: state.lang });
    else speak(state.lang === 'dr' ? 'بيت الما' : 'Toilettes', { lang: state.lang === 'dr' ? 'ar' : 'fr' });
    await recordTrial('X.1', 'plus', { item: 'spontanee', meta: { source: 'bouton' } });
    $('#toilet').classList.add('pressed');
    setTimeout(() => $('#toilet').classList.remove('pressed'), 600);
    renderToiletCount();
  };
}

// Rappel planifié X.3 : bandeau doux, sans son agressif.
let reminderShown = false;
async function checkReminder() {
  if (isFallbackMode()) return; // L1-07 : base indisponible, on n'essaie pas de lire le rappel
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
  try { open = globalThis.KalimatiStorage.getItem('kalimati-pb-open') === '1'; } catch { open = false; }
  const apply = () => { bar.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); };
  toggle.onclick = () => { open = !open; apply(); try { globalThis.KalimatiStorage.setItem('kalimati-pb-open', open ? '1' : '0'); } catch { /* rien */ } };
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
  // Lot 1 (L1-01) : au premier déverrouillage, demander au téléphone de garder les cartes pour de bon.
  const unlockParent = () => {
    state.parent = true;
    renderAll();
    db.getSetting('storagePersisted')
      .then((saved) => { if (saved === null || saved === undefined) return requestPersistentStorage(); })
      .catch(() => {});
  };
  lock.addEventListener('pointerdown', (e) => {
    if (state.parent) return;
    try { lock.setPointerCapture(e.pointerId); } catch { /* ancien navigateur */ }
    lock.classList.add('holding');
    timer = setTimeout(() => { cancel(); unlockedAt = Date.now(); unlockParent(); }, HOLD_TO_UNLOCK_MS);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) => lock.addEventListener(type, cancel));
  // v10.5 (A05) : au clavier, garder Entrée ou Espace enfoncé 3 secondes.
  lock.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !state.parent && !timer) {
      e.preventDefault();
      lock.classList.add('holding');
      timer = setTimeout(() => { cancel(); unlockedAt = Date.now(); unlockParent(); }, HOLD_TO_UNLOCK_MS);
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

// v10.42 (Lot 4.1) : Panneau adulte : sauvegarde et restauration par fusion, mot de passe, choix de la langue → modules/backup-ui.js
Object.assign(app, createBackupUi(app));
const { applyLangDir, setupParentBar } = app;
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
  db.putCards(placed).catch(() => logDiagnostic(LOG_TYPES.JS_RUNTIME, 'cards_save_failed', {
    module: 'app.js:loadCards',
    sev: 'error',
  }));
  return placed;
}

// Lot 1, L1-07 : la voix de l'enfant ne doit jamais tomber en panne. Si la base du téléphone ne répond pas
// en 6 s (Safari iPhone qui endort IndexedDB, verrou de fichier), on bascule en mode secours : cartes de
// départ et voix intactes, jamais un écran vide.
const DB_STARTUP_TIMEOUT_MS = 6000;

function withinStartupBudget(promise, ms) {
  let timer = 0;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('idb_startup_timeout')), ms);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

async function loadInitialState() {
  state.lang = langInfo((await db.getSetting('lang')) || 'fr').code;
  setActiveLang(state.lang);
  state.twin = await loadTwin(); // v10.23 (pépite 1) : deux langues simultanées, si le parent les a choisies
  state.placeBoards = cleanCustomBoards(await db.getSetting(PLACE_SETTING_KEY).catch(() => null)); // v10.33 : tableaux express
  state.scenes = cleanScenes(await db.getSetting(SCENE_SETTING_KEY).catch(() => null)); // v10.34 : scènes sur photo
  state.videos = cleanVideos(await db.getSetting(VIDEO_SETTING_KEY).catch(() => null)); // v10.39 : vidéos modèles (jamais sauvegardées)
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
  const cards = await loadCards();
  // Le délai de 6 s a pu déjà basculer en mode secours : les cartes du téléphone ne remplacent
  // alors plus les cartes de secours (elles reviendront au prochain démarrage, comme annoncé).
  if (!isFallbackMode()) state.cards = cards;
}

async function init() {
  captureMagicKeyFromUrl(); // v10.5 : la clé du lien #key= quitte l'adresse avant toute autre chose
  // v10.8 : journal d'erreurs local (dans le téléphone, anonyme : ni prénom, ni voix, ni photo, ni phrase, ni clé).
  initGlobalErrorLogger({
    getContext: () => ({ v: APP_VERSION, lang: state.lang || 'fr', space: state.space || 'home', online: typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true }),
  });
  window.addEventListener('kalimati-diagnostic', (e) => { if (e?.detail?.type) logDiagnostic(e.detail.type, e.detail.detail, e.detail); });
  nav.attach($('#view'));
  try {
    await withinStartupBudget(loadInitialState(), DB_STARTUP_TIMEOUT_MS);
  } catch (err) {
    enableFallbackMode(err);
    state.cards = getFallbackCards();
  }
  // L1-07 : le mode secours n'interrompt jamais l'interface : l'enfant garde ses cartes et sa voix.
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
  } else if (!isFallbackMode()) {
    // L1-07 : en mode secours, la base ne répond pas : on n'ouvre pas l'assistant d'invitation
    // (il lirait la base) et l'écran de secours reste affiché.
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
  if (!KalimatiStorage.isTrial()) initCloudSyncFromUrlAndAuto().catch(() => {});
  // v10.7.1 : en amazigh, le pack de voix d'essai de la variété choisie arrive tout seul, après l'ouverture
  // (une fois par ouverture ; seulement des fichiers du site Kalimati, rien ne part du téléphone).
  const amazighPackSoon = () => { if (isAmazighLang(state.lang)) autoInstallAmazighVoicePack(state.lang); };
  setTimeout(amazighPackSoon, 1500);
  window.addEventListener('online', amazighPackSoon);
  // v10.7.2 : un téléchargement coupé (appli mise en arrière-plan) reprend au retour dans l'appli.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') amazighPackSoon(); });
  // L1-08 : la nouvelle version s'applique seulement quand l'application passe en arrière-plan.
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
