// Lot 1 / Tâche 3 (L1-04, L1-05) : budgets cliniques de démarrage et du son.
// L'enfant ne doit jamais attendre la voix d'une carte. On mesure localement, en silence,
// puis on écrit seulement des millisecondes dans le journal (aucune donnée d'enfant).
import { logDiagnostic, LOG_TYPES } from './error-log.js';

// Budgets du cahier des charges : grille visible et son qui part.
export const STARTUP_BUDGET_OFFLINE_MS = 1500;
export const STARTUP_BUDGET_ONLINE_MS = 4000;
export const AUDIO_BUDGET_MS = 300;
export const AUDIO_SILENT_MS = 800;

const now = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? performance.now()
  : Date.now());

// Sans indication réseau (navigator absent), on applique le budget le plus strict.
function isOnline() {
  try {
    return typeof navigator !== 'undefined' && navigator.onLine === true;
  } catch {
    return false;
  }
}

let startupStartAt = now();
let firstRenderDone = false;
// Début du son par carte : le toucher peut enchaîner deux cartes, on garde une mesure par carte.
const audioStarts = new Map();

// Appelé au tout début de app.js : départ du chronomètre de démarrage.
export function markStartupStart() {
  startupStartAt = now();
  firstRenderDone = false;
}

// Appelé au premier rendu de la grille Parler. Une seule mesure par démarrage.
// Renvoie le délai en millisecondes (utile aux tests), ou null si déjà mesuré.
export function recordFirstRender() {
  if (firstRenderDone) return null;
  firstRenderDone = true;
  const delayMs = Math.max(0, Math.round(now() - startupStartAt));
  const budget = isOnline() ? STARTUP_BUDGET_ONLINE_MS : STARTUP_BUDGET_OFFLINE_MS;
  if (delayMs > budget) {
    logDiagnostic(LOG_TYPES.UX_FRICTION, `startup_slow:${delayMs}ms`, {
      module: 'startup-timing',
      sev: 'info',
    });
  }
  return delayMs;
}

// Juste avant audio.play() : on note l'instant du toucher pour cette carte.
export function markAudioStart(cardId) {
  if (!cardId) return;
  audioStarts.set(cardId, now());
}

// Dans l'événement « playing » de l'élément <audio> : le son est vraiment parti.
// 300 ms dépassées = friction ; 800 ms dépassées = carte considérée muette (comme demandé au cahier).
export function recordAudioPlaying(cardId) {
  if (!cardId || !audioStarts.has(cardId)) return null;
  const delayMs = Math.max(0, Math.round(now() - audioStarts.get(cardId)));
  audioStarts.delete(cardId);
  if (delayMs > AUDIO_SILENT_MS) {
    logDiagnostic(LOG_TYPES.AUDIO_SILENT, `audio_slow:${delayMs}ms`, { cardId, sev: 'warn' });
  } else if (delayMs > AUDIO_BUDGET_MS) {
    logDiagnostic(LOG_TYPES.UX_FRICTION, `audio_slow:${delayMs}ms`, { cardId, sev: 'info' });
  }
  return delayMs;
}
