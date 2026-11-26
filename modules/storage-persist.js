// Lot 1 (L1-01) : demander au téléphone de ne pas effacer tout seul les cartes de l'enfant.
// Certains systèmes (iPhone, Android) vident la mémoire d'un site peu utilisé quand le téléphone manque de place.
// La fonction persist() du navigateur demande à garder ce stockage. Rien ne part sur internet.
import * as db from '../db.js';
import { logDiagnostic, LOG_TYPES } from './error-log.js';

export const STORAGE_PERSISTED_KEY = 'storagePersisted';

// Les 3 états possibles du réglage : true (protégé), false (refusé ou non accordé), 'unsupported' (API absente).
const storageApi = () => (typeof navigator !== 'undefined' && navigator.storage ? navigator.storage : null);

async function remember(value) {
  try {
    await db.setSetting(STORAGE_PERSISTED_KEY, value);
  } catch {
    // Le réglage n'a pas pu être écrit (mémoire bloquée) : l'affichage reste possible avec la valeur en main.
  }
}

export async function requestPersistentStorage() {
  const storage = storageApi();
  if (!storage || typeof storage.persist !== 'function') {
    await remember('unsupported');
    return 'unsupported';
  }
  try {
    const granted = await storage.persist();
    const status = granted === true;
    await remember(status);
    return status;
  } catch {
    logDiagnostic(LOG_TYPES.STORAGE_QUOTA, 'persist_request_failed', { module: 'storage-persist.js', sev: 'warn' });
    await remember(false);
    return false;
  }
}

export async function getStoragePersistedStatus() {
  let saved;
  try {
    saved = await db.getSetting(STORAGE_PERSISTED_KEY);
  } catch {
    saved = undefined;
  }
  if (saved !== null && saved !== undefined) return saved;
  const storage = storageApi();
  if (storage && typeof storage.persisted === 'function') {
    try {
      const status = (await storage.persisted()) === true;
      await remember(status);
      return status;
    } catch {
      logDiagnostic(LOG_TYPES.STORAGE_QUOTA, 'persisted_check_failed', { module: 'storage-persist.js', sev: 'warn' });
    }
  }
  return null; // pas encore déterminé : l'écran Progrès proposera de vérifier.
}
