// Lot 1 / Tâche 4 (L1-07) : mode secours si IndexedDB se bloque.
// La voix de l'enfant ne doit jamais tomber en panne : si la base du téléphone ne répond pas
// (Safari iPhone, verrou de fichier), l'application affiche les cartes de départ et la synthèse
// vocale reste disponible. Aucun écran vide, aucune alerte rouge, aucun son d'échec.
import { defaultCards } from '../data.js';
import { LOG_TYPES, logDiagnostic } from './error-log.js';
import { assignPositions } from './grid-layout.js';
import { h } from './util.js';

export const FALLBACK_BANNER_TEXT = 'Mode secours : vos cartes reviendront au prochain démarrage.';

// Colonnes par défaut quand la base ne peut pas dire la taille choisie par le parent.
const FALLBACK_COLS = 4;

let fallbackActive = false;
let fallbackCards = [];
let incidentLogged = false;

// Cartes de départ, sans photo ni voix propre : la parole passe par les mp3 livrés ou la voix du téléphone.
// assignPositions donne une place fixe (gridRow / gridCol) pour que la grille s'affiche tout de suite.
function buildFallbackCards() {
  return assignPositions(defaultCards().map((card) => ({ ...card, audios: { ...(card.audios || {}) } })), FALLBACK_COLS);
}

export function isFallbackMode() {
  return fallbackActive;
}

export function enableFallbackMode(reason) {
  fallbackActive = true;
  if (!fallbackCards.length) fallbackCards = buildFallbackCards();
  if (!incidentLogged) {
    incidentLogged = true;
    const type = reason && reason.name === 'QuotaExceededError' ? LOG_TYPES.STORAGE_QUOTA : LOG_TYPES.JS_RUNTIME;
    // Détail technique fixe : ni prénom, ni phrase, ni identifiant de carte de la famille.
    logDiagnostic(type, 'idb_fallback_mode', { module: 'modules/db-fallback.js' });
  }
  return getFallbackCards();
}

export function getFallbackCards() {
  if (!fallbackCards.length) fallbackCards = buildFallbackCards();
  return fallbackCards.map((card) => ({ ...card, audios: { ...(card.audios || {}) } }));
}

// Bandeau discret du mode parent. Renvoie null en mode enfant ou hors mode secours.
export function fallbackBannerElement({ parent = false } = {}) {
  if (!fallbackActive || !parent) return null;
  return h('p', { class: 'note fallback-banner', id: 'fallback-banner', role: 'status' }, FALLBACK_BANNER_TEXT);
}
