// Stockage local sur le téléphone (IndexedDB). Rien ne quitte l'appareil.
const DB_NAME = 'kalimati';
const DB_VERSION = 1;

let dbPromise = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
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

export const getAllCards = () => run('cards', 'readonly', (s) => s.getAll());
export const putCard = (card) => run('cards', 'readwrite', (s) => s.put(card));
export const deleteCard = (id) => run('cards', 'readwrite', (s) => s.delete(id));
export const clearCards = () => run('cards', 'readwrite', (s) => s.clear());

export function putCards(cards) {
  return run('cards', 'readwrite', (s) => { cards.forEach((c) => s.put(c)); return null; });
}

export const getSetting = (key) => run('settings', 'readonly', (s) => s.get(key));
export const setSetting = (key, value) => run('settings', 'readwrite', (s) => s.put(value, key));
