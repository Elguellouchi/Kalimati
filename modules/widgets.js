// Composants réutilisés par les exercices : choix sans erreur, séquences, jetons, tri, vidéo modèle.
import * as db from '../db.js';
import { h, btn, shuffle, uid } from './util.js';
import { speak } from '../speech.js';
import { prepareVideo, setCalmModeAudio, isCalmModeAudio } from '../media.js';
import { draggable, hitTest } from './drag.js';
import { nour } from './nour.js';
import { renderVisual } from './visuals.js';
import { addStar } from './rewards-kids.js';
import { setHiddenConceptSlugs, slug } from './catalog.js';
import { tx, getActiveLang } from './section-i18n.js';

// === v10.9 (lot A) : réglages et moteurs (aide avant l'erreur, cartes masquées, mode calme, 2 à 4 choix, démo muette) ===
export const HINT_DELAY_OPTIONS = [3, 5, 8, 0]; // 0 = « pas d'aide »
export const DEFAULT_HINT_DELAY_SEC = 5;
export const DEMO_DURATION_MS = 2500;
export const MIN_CHOICES = 2;
export const MAX_CHOICES = 4;
export const ADAPT_WINDOW_SIZE = 8;
export const ADAPT_UP_THRESHOLD = 0.80;
export const ADAPT_DOWN_THRESHOLD = 0.65;

let hintDelaySecState = DEFAULT_HINT_DELAY_SEC;
let fixedChoiceCountState = 'auto'; // 'auto' | 2 | 3 | 4
let calmModeState = false;
let activeGameId = 'default';
let catalogCardsState = [];
let hiddenCardIds = new Set();
let hiddenCardWords = new Set();
let demosSeenState = {};
let gameStatsState = {};
let lastChoiceOutcome = null;
let reducedMotionOverride = null;
const activeBoardCleanups = new Set();

function normalizeWord(text) {
  return slug(String(text || ''));
}

export function setActiveGameId(gameId) {
  activeGameId = String(gameId || 'default');
}

export function getActiveGameId() {
  return activeGameId;
}

export function stopAllChoiceTimers() {
  activeBoardCleanups.forEach((fn) => {
    try { fn(); } catch { /* déjà arrêté */ }
  });
  activeBoardCleanups.clear();
}

// ---------- Pépite 3 : Mode calme ----------
export function setCalmMode(active, { persist = false } = {}) {
  calmModeState = Boolean(active);
  setCalmModeAudio(calmModeState);
  if (typeof document !== 'undefined' && document.body) {
    document.body.classList.toggle('calm-mode', calmModeState);
  }
  if (typeof document !== 'undefined' && typeof CustomEvent !== 'undefined') {
    document.dispatchEvent(new CustomEvent('kalimati-calm-mode', { detail: calmModeState }));
  }
  if (persist) {
    db.setSetting('calmMode', calmModeState).catch(() => {});
  }
  return calmModeState;
}

export function isCalmMode() {
  return Boolean(calmModeState || isCalmModeAudio());
}

// ---------- Pépite 1 : Délai d'aide avant l'erreur & estompage progressif ----------
export function setHintDelaySec(sec, { persist = false } = {}) {
  if (sec === 'off' || sec === false || sec === null || sec === '0' || Number(sec) <= 0) {
    hintDelaySecState = 0;
  } else {
    const n = Number(sec);
    hintDelaySecState = [3, 5, 8].includes(n) ? n : DEFAULT_HINT_DELAY_SEC;
  }
  if (persist) {
    db.setSetting('hintDelaySec', hintDelaySecState).catch(() => {});
  }
  return hintDelaySecState;
}

export function getHintDelaySec() {
  return hintDelaySecState;
}

export function normalizeTrialScore(entry) {
  if (typeof entry === 'number') {
    if (entry >= 1) return 1;
    if (entry > 0) return 0.5;
    return 0;
  }
  if (typeof entry === 'boolean') return entry ? 1 : 0;
  if (typeof entry === 'string') {
    if (entry === 'plus' || entry === 'premier_coup' || entry === 'autonomous') return 1;
    if (entry === 'avec_aide' || entry === 'helped' || entry === 'prompt') return 0.5;
    return 0;
  }
  if (entry && typeof entry === 'object') {
    if (typeof entry.score === 'number') return normalizeTrialScore(entry.score);
    if (entry.erred) return 0;
    if (entry.helped || entry.status === 'avec_aide' || entry.result === 'prompt') return 0.5;
    if (entry.firstTry || entry.result === 'plus') return 1;
  }
  return 0;
}

// Calcule le délai d'aide en millisecondes (0 si « pas d'aide »).
// Estompage progressif : chaque paire de réussites autonomes récentes ajoute +1 s (jusqu'à +4 s).
export function computeHintDelayMs({ baseSec = hintDelaySecState, recentScores = [], streak = 0 } = {}) {
  if (baseSec === 'off' || baseSec === false || baseSec === null || Number(baseSec) <= 0) {
    return 0;
  }
  const base = [3, 5, 8].includes(Number(baseSec)) ? Number(baseSec) : DEFAULT_HINT_DELAY_SEC;
  const windowScores = Array.isArray(recentScores) ? recentScores.slice(-ADAPT_WINDOW_SIZE).map(normalizeTrialScore) : [];
  const autonomousCount = windowScores.filter((s) => s === 1).length;
  let trailingStreak = Number(streak) || 0;
  if (!trailingStreak && windowScores.length) {
    for (let i = windowScores.length - 1; i >= 0; i -= 1) {
      if (windowScores[i] === 1) trailingStreak += 1;
      else break;
    }
  }
  const effectiveGood = Math.max(autonomousCount, trailingStreak);
  const bonusSec = Math.min(4, Math.floor(effectiveGood / 2));
  return (base + bonusSec) * 1000;
}

// ---------- Pépite 2 : Cartes jouables non masquées ----------
export function setPlayableCards(cards = []) {
  catalogCardsState = Array.isArray(cards) ? cards : [];
  hiddenCardIds = new Set();
  hiddenCardWords = new Set();
  for (const c of catalogCardsState) {
    if (c && c.hidden === true) {
      if (c.id) hiddenCardIds.add(String(c.id));
      if (c.vkey) hiddenCardIds.add(String(c.vkey));
      if (c.fr) hiddenCardWords.add(normalizeWord(c.fr));
    }
  }
  setHiddenConceptSlugs(hiddenCardWords);
  return playableCards(catalogCardsState);
}

export function playableCards(cards = catalogCardsState, { category = null } = {}) {
  const list = Array.isArray(cards) ? cards : [];
  return list.filter((c) => {
    if (!c || c.hidden === true) return false;
    if (category && c.cat !== category) return false;
    return true;
  });
}

export function isChoiceHidden(choice) {
  if (!choice) return true;
  if (choice.hidden === true || (choice.card && choice.card.hidden === true)) return true;
  const id = choice.id || (choice.card && choice.card.id) || choice.vkey || '';
  if (id && hiddenCardIds.has(String(id))) return true;
  const word = normalizeWord(choice.fr || choice.label || (choice.card && choice.card.fr) || '');
  if (word && hiddenCardWords.has(word)) return true;
  return false;
}

export function filterPlayableChoices(choices = []) {
  const list = Array.isArray(choices) ? choices.filter(Boolean) : [];
  return list.filter((c) => !isChoiceHidden(c));
}

// ---------- Pépite 27 : Adaptation 2..4 choix sur les 8 derniers essais ----------
export function setFixedChoiceCount(mode, { persist = false } = {}) {
  if (mode === 'auto' || mode === null || mode === undefined || mode === '' || mode === 0 || mode === '0') {
    fixedChoiceCountState = 'auto';
  } else {
    const n = Number(mode);
    fixedChoiceCountState = [2, 3, 4].includes(n) ? n : 'auto';
  }
  if (persist) {
    db.setSetting('fixedChoiceCount', fixedChoiceCountState).catch(() => {});
  }
  return fixedChoiceCountState;
}

export function getFixedChoiceCount() {
  return fixedChoiceCountState;
}

export function computeAdaptiveChoiceCount({
  recentScores = [],
  currentChoices = 2,
  fixedChoices = fixedChoiceCountState,
  availableCount = MAX_CHOICES,
} = {}) {
  const clampCount = (n) => Math.max(MIN_CHOICES, Math.min(MAX_CHOICES, Math.round(Number(n) || MIN_CHOICES)));
  const capByAvailable = (n) => {
    if (Number.isFinite(availableCount) && availableCount >= 0) {
      return Math.min(n, Math.max(1, availableCount));
    }
    return n;
  };

  if (fixedChoices !== 'auto' && fixedChoices !== null && fixedChoices !== undefined && [2, 3, 4].includes(Number(fixedChoices))) {
    return capByAvailable(clampCount(fixedChoices));
  }

  let next = clampCount(currentChoices);
  const windowScores = Array.isArray(recentScores)
    ? recentScores.slice(-ADAPT_WINDOW_SIZE).map(normalizeTrialScore)
    : [];

  if (windowScores.length >= ADAPT_WINDOW_SIZE) {
    const avg = windowScores.reduce((sum, s) => sum + s, 0) / windowScores.length;
    if (avg > ADAPT_UP_THRESHOLD) {
      next = clampCount(next + 1);
    } else if (avg < ADAPT_DOWN_THRESHOLD) {
      next = clampCount(next - 1);
    }
  }

  return capByAvailable(next);
}

function ensureGameStat(gameId, initialChoices = 2) {
  const key = String(gameId || activeGameId || 'default');
  if (!gameStatsState[key]) {
    const start = Math.max(MIN_CHOICES, Math.min(MAX_CHOICES, Math.round(Number(initialChoices) || 2)));
    gameStatsState[key] = {
      currentChoices: start,
      scores: [],
      windowScores: [],
      streak: 0,
    };
  }
  return gameStatsState[key];
}

export function setGameChoiceCount(gameId, count) {
  const stat = ensureGameStat(gameId, count);
  stat.currentChoices = Math.max(MIN_CHOICES, Math.min(MAX_CHOICES, Math.round(Number(count) || 2)));
  stat.windowScores = [];
  return stat.currentChoices;
}

export function recordGameTrialScore(gameId, outcome, { initialChoices = 2, persist = true } = {}) {
  const key = String(gameId || activeGameId || 'default');
  const stat = ensureGameStat(key, initialChoices);
  const score = normalizeTrialScore(outcome);
  stat.scores.push(score);
  if (stat.scores.length > 24) stat.scores = stat.scores.slice(-24);
  stat.windowScores.push(score);
  stat.streak = score === 1 ? (stat.streak || 0) + 1 : 0;

  if (stat.windowScores.length >= ADAPT_WINDOW_SIZE) {
    stat.currentChoices = computeAdaptiveChoiceCount({
      recentScores: stat.windowScores.slice(-ADAPT_WINDOW_SIZE),
      currentChoices: stat.currentChoices,
      fixedChoices: 'auto',
      availableCount: MAX_CHOICES,
    });
    stat.windowScores = [];
  }

  if (persist) {
    db.setSetting('lotAGameStats', gameStatsState).catch(() => {});
  }
  return {
    gameId: key,
    score,
    currentChoices: stat.currentChoices,
    recentScores: [...stat.scores.slice(-ADAPT_WINDOW_SIZE)],
    streak: stat.streak,
  };
}

export function getGameChoiceCount(gameId, { availableCount = MAX_CHOICES, fallbackChoices = 2 } = {}) {
  const key = String(gameId || activeGameId || 'default');
  const stat = ensureGameStat(key, fallbackChoices);
  return computeAdaptiveChoiceCount({
    recentScores: stat.windowScores,
    currentChoices: stat.currentChoices,
    fixedChoices: fixedChoiceCountState,
    availableCount,
  });
}

export function getGameStats(gameId) {
  const key = String(gameId || activeGameId || 'default');
  return ensureGameStat(key);
}

export function resetGameStats(gameId = null) {
  if (gameId) {
    delete gameStatsState[String(gameId)];
  } else {
    gameStatsState = {};
  }
}

export function preparePlayableChoices(choices = [], { targetCount = null, gameId = null, fallbackChoices = 2 } = {}) {
  const rawList = Array.isArray(choices) ? choices.filter(Boolean) : [];
  let playable = filterPlayableChoices(rawList);

  // Cas limite obligatoire : si toutes les cartes sont masquées, repli sur la bonne carte ou une carte de secours (jamais d'écran vide).
  if (playable.length === 0) {
    const rawCorrect = rawList.find((c) => c && c.correct) || rawList[0];
    playable = [rawCorrect ? { ...rawCorrect, hidden: false, correct: true } : { emoji: '🌟', label: 'Continuer', correct: true }];
  }

  let correctChoice = playable.find((c) => c.correct);
  if (!correctChoice) {
    const rawCorrect = rawList.find((c) => c && c.correct);
    if (rawCorrect) {
      correctChoice = { ...rawCorrect, hidden: false, correct: true };
      playable = [correctChoice, ...playable];
    } else {
      playable[0] = { ...playable[0], correct: true };
      correctChoice = playable[0];
    }
  }

  const distractors = playable.filter((c) => c !== correctChoice && !c.correct);
  const maxPossible = 1 + distractors.length;
  const desired = targetCount !== null && targetCount !== undefined
    ? Math.max(1, Math.min(MAX_CHOICES, Number(targetCount) || MIN_CHOICES))
    : getGameChoiceCount(gameId, { availableCount: maxPossible, fallbackChoices });
  const finalCount = Math.max(1, Math.min(desired, maxPossible));
  return [correctChoice, ...distractors.slice(0, Math.max(0, finalCount - 1))];
}

// ---------- Pépite 28 : Démonstration muette de 2,5 s au 1er lancement + prefers-reduced-motion ----------
export function setReducedMotionForTest(val) {
  reducedMotionOverride = val === null || val === undefined ? null : Boolean(val);
}

export function isReducedMotion() {
  if (reducedMotionOverride !== null) return reducedMotionOverride;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch {
      return false;
    }
  }
  return false;
}

export function hasSeenGameDemo(gameId) {
  const key = String(gameId || activeGameId || 'default');
  return Boolean(demosSeenState[key]);
}

export function markGameDemoSeen(gameId, { persist = true } = {}) {
  const key = String(gameId || activeGameId || 'default');
  demosSeenState[key] = true;
  if (persist) {
    db.setSetting('lotADemosSeen', demosSeenState).catch(() => {});
  }
  return true;
}

export function resetGameDemos(gameId = null) {
  if (gameId) {
    delete demosSeenState[String(gameId)];
  } else {
    demosSeenState = {};
  }
}

export function consumeLastChoiceOutcome(goalId = null) {
  if (!lastChoiceOutcome) return null;
  if (Date.now() - lastChoiceOutcome.ts > 5000) {
    lastChoiceOutcome = null;
    return null;
  }
  if (goalId && lastChoiceOutcome.gameId && lastChoiceOutcome.gameId !== 'default' && lastChoiceOutcome.gameId !== String(goalId)) {
    return null;
  }
  const outcome = lastChoiceOutcome;
  lastChoiceOutcome = null;
  return outcome;
}

export async function loadLotASettings(profileObj = null) {
  try {
    const [savedCalm, savedDelay, savedFixed, savedDemos, savedStats] = await Promise.all([
      db.getSetting('calmMode'),
      db.getSetting('hintDelaySec'),
      db.getSetting('fixedChoiceCount'),
      db.getSetting('lotADemosSeen'),
      db.getSetting('lotAGameStats'),
    ]);
    if (savedDemos && typeof savedDemos === 'object') demosSeenState = { ...savedDemos };
    if (savedStats && typeof savedStats === 'object') gameStatsState = { ...savedStats };
    const calm = (profileObj && typeof profileObj.calmMode === 'boolean')
      ? profileObj.calmMode
      : Boolean(savedCalm);
    const delay = (profileObj && profileObj.hintDelaySec !== undefined)
      ? profileObj.hintDelaySec
      : (savedDelay !== undefined && savedDelay !== null ? savedDelay : DEFAULT_HINT_DELAY_SEC);
    const fixed = (profileObj && profileObj.fixedChoiceCount !== undefined)
      ? profileObj.fixedChoiceCount
      : (savedFixed || 'auto');
    setCalmMode(calm, { persist: false });
    setHintDelaySec(delay, { persist: false });
    setFixedChoiceCount(fixed, { persist: false });
  } catch {
    if (profileObj) syncLotAFromProfile(profileObj);
  }
}

export function syncLotAFromProfile(profileObj = {}) {
  if (!profileObj || typeof profileObj !== 'object') return;
  if (profileObj.calmMode !== undefined) setCalmMode(Boolean(profileObj.calmMode), { persist: true });
  if (profileObj.hintDelaySec !== undefined) setHintDelaySec(profileObj.hintDelaySec, { persist: true });
  if (profileObj.fixedChoiceCount !== undefined) setFixedChoiceCount(profileObj.fixedChoiceCount, { persist: true });
}
// === [FIN MODIF v10.9-lot-A : Fonctions d'état et moteurs Lot A] ===

// Grande carte : vraie photo si le parent en a mis une, sinon illustration, sinon emoji.
export const bigCard = (emoji, label, cls = '', vkey = null) => h('div', { class: `big-card ${cls}`.trim() },
  renderVisual({ emoji, label, vkey }), label ? h('span', { class: 'label' }, label) : null);

// Choix avec apprentissage sans erreur : position mélangée, et si erreur les distracteurs s'estompent (opacité 0,25).
// onAnswer(firstTry, choice, outcome) est appelé une fois la bonne réponse touchée.
// v10.9 (lot A) : aide douce AVANT l'erreur (3/5/8 s), démo muette 2,5 s au 1er lancement d'un jeu,
// cartes masquées exclues, nombre de choix adapté (2 à 4) sur les 8 derniers essais.
// assessment : true pour les cotations d'adulte (atelier ortho) : ni aide automatique, ni démo, ni adaptation.
export function choiceBoard({
  choices,
  cols = 2,
  onAnswer,
  praise = 'Bravo',
  gameId = null,
  hintDelaySec = undefined,
  demoDurationMs = DEMO_DURATION_MS,
  assessment = false,
} = {}) {
  let erred = false;
  let helped = false;
  let finished = false;
  let hintTimer = 0;
  let demoTimer = 0;

  const raw = Array.isArray(choices) ? choices.filter(Boolean) : [];
  const gId = String(gameId || activeGameId || 'default');
  // Point de départ = le nombre d'images que le jeu propose (2 à 4) ; ensuite la règle des 8 essais ajuste de ±1.
  const fallbackN = Math.max(MIN_CHOICES, Math.min(MAX_CHOICES, raw.length || MIN_CHOICES));
  const stat = ensureGameStat(gId, fallbackN);
  // Plus de 4 choix = c'est le palier du jeu qui le demande : on le respecte (on retire seulement les cartes masquées).
  const keepAll = assessment || raw.length > MAX_CHOICES;
  const selectedChoices = preparePlayableChoices(raw, {
    targetCount: keepAll ? Math.max(1, raw.length) : null,
    gameId: gId,
    fallbackChoices: fallbackN,
  });
  const effectiveCols = Math.max(1, Math.min(Number(cols) || 2, selectedChoices.length));

  const clearTimers = () => {
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0; }
    if (demoTimer) { clearTimeout(demoTimer); demoTimer = 0; }
  };

  const attachHand = (btnEl, isDemo) => {
    const existing = btnEl.querySelector('.choice-hand-hint');
    if (existing) existing.remove();
    const staticMode = isReducedMotion() || isCalmMode();
    btnEl.append(h('span', {
      class: `choice-hand-hint ${isDemo ? 'demo-hand' : 'help-hand'} ${staticMode ? 'choice-hand-static' : 'choice-hand-moving'}`,
      'aria-hidden': 'true',
    }, '👆'));
  };
  const removeHands = (btnEl) => {
    if (!btnEl) return;
    btnEl.classList.remove('choice-demo');
    btnEl.querySelectorAll('.choice-hand-hint').forEach((n) => n.remove());
  };

  const buttons = shuffle(selectedChoices).map((choice) => {
    const el = h('button', { type: 'button', class: 'choice' },
      (choice.render ? choice.render() : renderVisual(choice)), choice.label ? h('span', { class: 'label' }, choice.label) : null);
    el.onclick = () => {
      if (finished) return;
      if (choice.correct) {
        finished = true;
        clearTimers();
        activeBoardCleanups.delete(clearTimers);
        removeHands(el);
        el.classList.remove('hint', 'choice-hint');
        el.classList.add('right');
        speak(praise);
        const firstTry = !erred && !helped;
        const outcome = {
          gameId: gId, ts: Date.now(), firstTry, helped: helped && !erred, erred,
          score: erred ? 0 : (helped ? 0.5 : 1),
          status: erred ? 'apres_erreur' : (helped ? 'avec_aide' : 'premier_coup'),
        };
        lastChoiceOutcome = outcome;
        if (!assessment) recordGameTrialScore(gId, outcome, { initialChoices: fallbackN });
        // v9.9 : une étoile seulement pour la réussite du premier coup, SANS aide (v10.9).
        if (firstTry) addStar();
        if (onAnswer) onAnswer(firstTry, choice, outcome);
        return;
      }
      erred = true;
      // v9.9 : jamais de croix ni de son négatif. Petit mouvement doux, puis un halo d'indice sur la bonne réponse.
      el.classList.remove('nudge'); void el.offsetWidth; el.classList.add('nudge');
      buttons.forEach((b) => { if (b.choice.correct) b.el.classList.add('hint'); else b.el.classList.add('faded'); });
    };
    return { el, choice };
  });

  const correctEntry = buttons.find((b) => b.choice.correct) || null;

  const showHelp = () => {
    hintTimer = 0;
    if (finished || !correctEntry) return;
    helped = true;
    correctEntry.el.classList.add('hint', 'choice-hint');
    attachHand(correctEntry.el, false);
  };
  const scheduleHelp = () => {
    if (finished || assessment) return;
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0; }
    const delayMs = computeHintDelayMs({
      baseSec: hintDelaySec !== undefined ? hintDelaySec : hintDelaySecState,
      recentScores: stat.scores,
      streak: stat.streak,
    });
    if (delayMs > 0) hintTimer = setTimeout(showHelp, delayMs);
  };
  const playSilentDemo = () => {
    if (finished || !correctEntry) return false;
    clearTimers();
    activeBoardCleanups.add(clearTimers);
    helped = true; // toucher pendant la démo = réussite « avec aide »
    correctEntry.el.classList.add('choice-demo');
    attachHand(correctEntry.el, true);
    demoTimer = setTimeout(() => {
      demoTimer = 0;
      removeHands(correctEntry.el);
      helped = correctEntry.el.classList.contains('choice-hint');
      scheduleHelp();
    }, Math.max(50, Number(demoDurationMs) || DEMO_DURATION_MS));
    return true;
  };

  // Bouton « ? » (visible en mode parent seulement) pour rejouer la démo muette.
  const parentTools = assessment ? null : h('div', { class: 'choice-parent-tools' },
    h('button', {
      type: 'button', class: 'choice-demo-btn', 'aria-label': 'Rejouer la démonstration muette',
      title: 'Rejouer la démonstration muette (2,5 s)',
      onclick: (e) => { if (e) e.stopPropagation(); playSilentDemo(); },
    }, '?'));

  const boardEl = h('div', { class: 'choices', style: { '--cols': effectiveCols } }, parentTools, buttons.map((b) => b.el));
  boardEl.cleanup = clearTimers;
  boardEl.replayDemo = playSilentDemo;
  boardEl.triggerHintNow = showHelp;
  if (!assessment) {
    activeBoardCleanups.add(clearTimers);
    if (!hasSeenGameDemo(gId)) { markGameDemoSeen(gId); playSilentDemo(); } else scheduleHelp();
  }
  return boardEl;
}

// Séquence d'étapes (analyse de tâche) cochées une à une par l'enfant. fade : masque les images (estompage).
export function sequenceBoard(steps, { fade = false, onComplete, onStep } = {}) {
  let index = 0;
  // Une étape peut porter un 3e élément { vkey } : sa photo personnalisée (ex. « toilet:essuyer »).
  const cards = steps.map(([emoji, label, extra], i) => h('button', { type: 'button', class: `step${i === 0 ? ' current' : ''}${fade ? ' faded-img' : ''}` },
    h('span', { class: 'step-num' }, String(i + 1)), renderVisual({ emoji, label, vkey: extra && extra.vkey }), h('span', { class: 'label' }, label)));
  cards.forEach((card, i) => {
    card.onclick = () => {
      if (i !== index) return;
      card.classList.remove('current');
      card.classList.add('done');
      speak(steps[i][1]);
      index += 1;
      if (onStep) onStep(i);
      if (index < cards.length) cards[index].classList.add('current');
      else { addStar(); if (onComplete) onComplete(); }
    };
  });
  const element = h('div', { class: 'sequence' }, cards);
  return {
    element,
    reset() {
      index = 0;
      cards.forEach((c, i) => { c.classList.remove('done', 'current'); if (i === 0) c.classList.add('current'); });
    },
    setFade(value) { cards.forEach((c) => c.classList.toggle('faded-img', value)); },
  };
}

// Économie de jetons : l'adulte donne une étoile à chaque effort.
export function tokenBoard({ count = 5, onFull } = {}) {
  let filled = 0;
  const stars = h('div', { class: 'tokens' });
  const select = h('select', { 'aria-label': 'Nombre de jetons' },
    [3, 4, 5, 6, 7, 8, 9, 10].map((n) => h('option', { value: n, selected: n === count }, `${n} ⭐`)));
  const draw = () => {
    const total = Number(select.value);
    stars.replaceChildren(...Array.from({ length: total }, (_, i) => h('span', { class: `token${i < filled ? ' on' : ''}` }, '⭐')));
  };
  select.onchange = () => { filled = 0; draw(); };
  const give = () => {
    const total = Number(select.value);
    if (filled >= total) return;
    filled += 1; draw();
    if (filled === total) { speak(tx('won', getActiveLang())); if (onFull) onFull(); }
  };
  draw();
  return {
    element: h('div', { class: 'token-board' }, stars, h('div', { class: 'row center' }, btn(tx('giveStar', getActiveLang()), give, 'primary'), btn('↺', () => { filled = 0; draw(); }, 'ghost'), select)),
    reset: () => { filled = 0; draw(); },
  };
}

// Tri vers des boîtes (glisser ou toucher l'image puis la boîte). onPlace(correct, item, bin).
export function sorter({ bins, items, onPlace, onDone }) {
  let selected = null;
  let remaining = items.length;
  const binEls = bins.map((bin) => h('div', { class: 'bin', dataset: { id: bin.id } },
    renderVisual({ emoji: bin.emoji, vkey: `bin:${bin.id}`, label: bin.fr }), h('span', { class: 'label' }, bin.fr), h('div', { class: 'bin-content' })));
  const pile = h('div', { class: 'pile' });

  const place = (itemEl, item, binEl) => {
    const correct = binEl.dataset.id === item.bin;
    if (onPlace) onPlace(correct, item, binEl.dataset.id);
    if (!correct) { itemEl.classList.add('wiggle-soft'); setTimeout(() => itemEl.classList.remove('wiggle-soft'), 400); return false; }
    itemEl.style.transform = '';
    itemEl.classList.remove('selected');
    itemEl.onclick = null;
    binEl.querySelector('.bin-content').append(itemEl);
    speak(item.fr);
    remaining -= 1;
    if (remaining === 0 && onDone) onDone();
    return true;
  };

  shuffle(items).forEach((item) => {
    const el = h('button', { type: 'button', class: 'sort-item' }, (item.render ? item.render() : renderVisual({ emoji: item.emoji, fr: item.fr }, { button: false })));
    el.onclick = () => { pile.querySelectorAll('.selected').forEach((s) => s.classList.remove('selected')); selected = { el, item }; el.classList.add('selected'); };
    draggable(el, { onDrop: ({ x, y }) => { const target = hitTest(x, y, binEls); return target ? place(el, item, target) : false; } });
    pile.append(el);
  });
  binEls.forEach((binEl) => { binEl.onclick = () => { if (selected && selected.el.parentElement === pile) { place(selected.el, selected.item, binEl); selected = null; } }; });
  return h('div', { class: 'sorter' }, h('div', { class: 'bins', style: { '--cols': Math.min(bins.length, 5) } }, binEls), pile);
}

// Compteur simple (passes de ballon, initiations…).
export function counter(label, { start = 0, onChange } = {}) {
  let value = start;
  const out = h('span', { class: 'counter-value' }, String(value));
  return h('div', { class: 'counter' }, h('span', {}, label), out,
    btn('＋', () => { value += 1; out.textContent = String(value); if (onChange) onChange(value); }, 'primary'));
}

// Vidéo modèle filmée par le parent (gestes, verbes), avec ralenti 0,5x. Sinon l'emoji.
export function videoModel(key, emoji, { canEdit = false } = {}) {
  const stage = h('div', { class: 'video-model' }, h('span', { class: 'emoji' }, emoji));
  let current = null;
  let rate = 1;
  const show = async () => {
    const [rec] = (await db.getRecordingsOf(`model:${key}`)).sort((a, b) => b.ts - a.ts);
    current = rec || null;
    if (!current) { stage.replaceChildren(h('span', { class: 'emoji' }, emoji)); return; }
    const url = URL.createObjectURL(current.blob);
    const video = h('video', { src: url, playsinline: true, muted: true, loop: true });
    video.playbackRate = rate;
    stage.replaceChildren(video);
  };
  const play = () => { const v = stage.querySelector('video'); if (v) { v.playbackRate = rate; v.currentTime = 0; v.play().catch(() => {}); } };
  const slow = btn('🐢 Ralenti 0,5x', () => { rate = rate === 1 ? 0.5 : 1; slow.classList.toggle('active', rate !== 1); play(); }, 'ghost');
  const controls = h('div', { class: 'row center' }, btn('▶ Voir le modèle', play, 'ghost'), slow);
  if (canEdit) {
    const input = h('input', { type: 'file', accept: 'video/*', capture: 'user', hidden: true });
    input.onchange = async () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      try {
        const blob = await prepareVideo(file);
        (await db.getRecordingsOf(`model:${key}`)).forEach((r) => db.deleteRecording(r.id));
        await db.putRecording({ id: uid('rec'), key: `model:${key}`, ts: Date.now(), kind: 'model', blob });
        show();
      } catch (error) { window.alert(error.message); }
    };
    controls.append(h('label', { class: 'btn ghost' }, '📹 Filmer le modèle', input));
  }
  show();
  return h('div', { class: 'video-model-box' }, stage, controls);
}

// Onglets simples : modes = [[libellé, () => élément], ...]
export function modeTabs(modes, start = 0) {
  const body = h('div');
  const tabs = h('div', { class: 'seg' });
  const show = (i) => {
    tabs.replaceChildren(...modes.map(([label], j) => h('button', { type: 'button', class: j === i ? 'active' : '', onclick: () => show(j) }, label)));
    body.replaceChildren(modes[i][1]());
  };
  show(start);
  return h('div', { class: 'stack' }, tabs, body);
}

export const praise =(text = 'Bravo !') => h('div', { class: 'praise' }, nour({ pose: 'wave', size: 70, says: text }));
