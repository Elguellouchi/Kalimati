// Stockage local sur le téléphone (IndexedDB). Rien ne quitte l'appareil.
// v2 : objectifs du PEI, essais ABA notés, enregistrements. v3 : photos personnalisées (visual_overrides).
// Les montées de version gardent toutes les cartes et tous les essais existants.
import { GOALS } from './modules/goals.js';

const DB_NAME = 'kalimati';
const DB_VERSION = 7;

let dbPromise = null;

function upgrade(db, transaction, oldVersion) {
  if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'id' });
  if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
  if (oldVersion < 2) {
    if (!db.objectStoreNames.contains('pei_goals')) db.createObjectStore('pei_goals', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('trials')) {
      const trials = db.createObjectStore('trials', { keyPath: 'id' });
      trials.createIndex('goalId', 'goalId');
      trials.createIndex('day', 'day');
    }
    if (!db.objectStoreNames.contains('recordings')) {
      const recordings = db.createObjectStore('recordings', { keyPath: 'id' });
      recordings.createIndex('key', 'key');
    }
    const goals = transaction.objectStore('pei_goals');
    GOALS.forEach((goal) => goals.put({ ...goal, status: 'todo', updatedAt: null }));
  }
  if (oldVersion < 3 && !db.objectStoreNames.contains('visual_overrides')) {
    db.createObjectStore('visual_overrides', { keyPath: 'key' });
  }
  // v4 : images téléchargées en ligne (pictogrammes ARASAAC, photos Wikipédia), gardées pour le mode hors ligne.
  if (oldVersion < 4 && !db.objectStoreNames.contains('online_cache')) {
    db.createObjectStore('online_cache', { keyPath: 'key' });
  }
  // v5 : ajoute les prochains niveaux ABLLS-R aux objectifs, sans toucher aux objectifs ni aux essais déjà là.
  if (oldVersion >= 2 && oldVersion < 5) {
    const goals = transaction.objectStore('pei_goals');
    GOALS.forEach((goal) => {
      const existing = goals.get(goal.id);
      existing.onsuccess = () => { if (!existing.result) goals.put({ ...goal, status: 'todo', updatedAt: null }); };
    });
  }
  // v6 : planning visuel « Ma routine quotidienne » (coches du jour et routines réglées par le parent). Rien d'autre n'est touché.
  if (oldVersion < 6) {
    if (!db.objectStoreNames.contains('schedule_logs')) {
      const logs = db.createObjectStore('schedule_logs', { keyPath: 'id' });
      ['day', 'routineId', 'stepId', 'autonomy'].forEach((index) => logs.createIndex(index, index));
    }
    if (!db.objectStoreNames.contains('schedule_config')) db.createObjectStore('schedule_config', { keyPath: 'id' });
  }
  // v7 : journal scientifique des comportements à problème (méthode ABA / FBA : ABC + SEAT + Scatterplot).
  if (oldVersion < 7 && !db.objectStoreNames.contains('abc_logs')) {
    const abc = db.createObjectStore('abc_logs', { keyPath: 'id' });
    ['day', 'behavior', 'fn', 'place'].forEach((index) => abc.createIndex(index, index));
  }
}

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => upgrade(request.result, request.transaction, event.oldVersion);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Fermez les autres onglets de Kalimati puis rouvrez l\'application.'));
    });
  }
  return dbPromise;
}

function run(storeName, mode, action) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    transaction.oncomplete = () => resolve(request instanceof IDBRequest ? request.result : undefined);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

// Cartes
export const getAllCards = () => run('cards', 'readonly', (s) => s.getAll());
export const getCard = (id) => run('cards', 'readonly', (s) => s.get(id));
export const putCard = (card) => run('cards', 'readwrite', (s) => s.put(card));
export const deleteCard = (id) => run('cards', 'readwrite', (s) => s.delete(id));
export const clearCards = () => run('cards', 'readwrite', (s) => s.clear());
export const clearAllCards = clearCards;
export function putCards(cards) {
  return run('cards', 'readwrite', (s) => { cards.forEach((c) => s.put(c)); return null; });
}

// Réglages
export const getSetting = (key) => run('settings', 'readonly', (s) => s.get(key));
export const setSetting = (key, value) => run('settings', 'readwrite', (s) => s.put(value, key));

// Objectifs du PEI
export const getGoals = () => run('pei_goals', 'readonly', (s) => s.getAll());
export const putGoal = (goal) => run('pei_goals', 'readwrite', (s) => s.put(goal));

// Essais ABA
export const addTrial = (trial) => run('trials', 'readwrite', (s) => s.put(trial));
export const deleteTrial = (id) => run('trials', 'readwrite', (s) => s.delete(id));
export const getAllTrials = () => run('trials', 'readonly', (s) => s.getAll());
export const getTrialsOf = (goalId) => run('trials', 'readonly', (s) => s.index('goalId').getAll(goalId));
export const getTrialsOfDay = (day) => run('trials', 'readonly', (s) => s.index('day').getAll(day));
export const clearTrials = () => run('trials', 'readwrite', (s) => s.clear());
export function putTrials(trials) {
  return run('trials', 'readwrite', (s) => { trials.forEach((t) => s.put(t)); return null; });
}

// Enregistrements : voix d'Abir (jamais exportées) et vidéos modèles filmées par le parent
export const putRecording = (rec) => run('recordings', 'readwrite', (s) => s.put(rec));
export const addRecording = putRecording;
export const deleteRecording = (id) => run('recordings', 'readwrite', (s) => s.delete(id));
export const getRecordingsOf = (key) => run('recordings', 'readonly', (s) => s.index('key').getAll(key));

// Photos personnalisées : une vraie photo par « visualKey » (émotion, personne, objet, étape de routine)
export const getVisualOverride = (key) => run('visual_overrides', 'readonly', (s) => s.get(key));
export const getAllVisualOverrides = () => run('visual_overrides', 'readonly', (s) => s.getAll());
export const putVisualOverride = (key, blob, meta = {}) => run('visual_overrides', 'readwrite', (s) => s.put({ key, blob, meta, ts: Date.now() }));
export const deleteVisualOverride = (key) => run('visual_overrides', 'readwrite', (s) => s.delete(key));
export function putVisualOverrides(items) {
  return run('visual_overrides', 'readwrite', (s) => { items.forEach((i) => s.put(i)); return null; });
}

// Images en ligne mises en cache : { key: <id du mot>, pictos: [Blob], photo: Blob | null, ts }
export const getOnlineCache = (key) => run('online_cache', 'readonly', (s) => s.get(key));
export const putOnlineCache = (rec) => run('online_cache', 'readwrite', (s) => s.put(rec));
export const getAllOnlineKeys = () => run('online_cache', 'readonly', (s) => s.getAllKeys());

// Planning visuel : une coche = { id, day, ts, routineId, stepId, autonomy: 'seule' | 'rappel' } ; réglages = { id, ... }
export const addScheduleLog = (log) => run('schedule_logs', 'readwrite', (s) => s.put(log));
export const deleteScheduleLog = (id) => run('schedule_logs', 'readwrite', (s) => s.delete(id));
export const getScheduleLogsOfDay = (day) => run('schedule_logs', 'readonly', (s) => s.index('day').getAll(day));
export const getAllScheduleLogs = () => run('schedule_logs', 'readonly', (s) => s.getAll());
export const getScheduleConfig = (id) => run('schedule_config', 'readonly', (s) => s.get(id));
export const putScheduleConfig = (record) => run('schedule_config', 'readwrite', (s) => s.put(record));
export const deleteScheduleConfig = (id) => run('schedule_config', 'readwrite', (s) => s.delete(id));

// Journal scientifique ABC / FBA : { id, ts, day, place, intervenant, setting, antecedents, behavior, intensity, durationSec, consequences, fn, replacement, note }
export const addAbcLog = (log) => run('abc_logs', 'readwrite', (s) => s.put(log));
export const deleteAbcLog = (id) => run('abc_logs', 'readwrite', (s) => s.delete(id));
export const getAllAbcLogs = () => run('abc_logs', 'readonly', (s) => s.getAll());
export const getAbcLogsOfDay = (day) => run('abc_logs', 'readonly', (s) => s.index('day').getAll(day));
export function putAbcLogs(logs) {
  return run('abc_logs', 'readwrite', (s) => { logs.forEach((l) => s.put(l)); return null; });
}
