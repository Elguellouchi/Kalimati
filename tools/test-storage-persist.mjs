#!/usr/bin/env node
/**
 * Lot 1 / Tâche 1 (L1-01) : stockage persistant.
 * Vérifie :
 *  1. API absente -> 'unsupported' enregistré dans les réglages ;
 *  2. persist() accordé -> true enregistré ;
 *  3. persist() refusé -> false enregistré ;
 *  4. erreur de persist() -> false enregistré + entrée dans le journal d'erreurs ;
 *  5. relecture du statut sans écraser un réglage déjà connu (non-régression) ;
 *  6. vérification de l'état réel quand aucun réglage n'existe encore ;
 *  7. le module est gardé hors ligne (sw.js) et affiché dans Progrès (dashboard.js).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Node n'a pas de page : modules/util.js (importé par error-log.js) attend ces classes.
for (const name of ['Element', 'DocumentFragment', 'Document']) if (!globalThis[name]) globalThis[name] = class {};

// ---- Faux IndexedDB minimal : suffit à db.getSetting / db.setSetting ----
const settings = new Map();

class FakeRequest {
  constructor() {
    this.result = undefined;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }
}
globalThis.IDBRequest = FakeRequest;

function makeFakeIndexedDB() {
  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => ({}),
    close: () => {},
    onclose: null,
    onversionchange: null,
    transaction: () => {
      const transaction = { oncomplete: null, onerror: null, onabort: null, error: null };
      transaction.objectStore = () => ({
        get(key) {
          const request = new FakeRequest();
          request.result = settings.has(key) ? settings.get(key) : undefined;
          setTimeout(() => { if (transaction.oncomplete) transaction.oncomplete(); }, 0);
          return request;
        },
        put(value, key) {
          settings.set(key, value);
          const request = new FakeRequest();
          request.result = key;
          setTimeout(() => { if (transaction.oncomplete) transaction.oncomplete(); }, 0);
          return request;
        },
      });
      return transaction;
    },
  };
  return {
    open() {
      const request = { result: database, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null, transaction: null };
      setTimeout(() => {
        if (request.onupgradeneeded) request.onupgradeneeded({ oldVersion: 0, transaction: null });
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    },
  };
}
globalThis.indexedDB = makeFakeIndexedDB();

// ---- Pilotage de navigator.storage selon le cas testé ----
const realNavigator = globalThis.navigator;
function replaceNavigator(value) {
  try {
    Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true });
    return true;
  } catch {
    return false;
  }
}
function installStorage(storage) {
  if (!replaceNavigator({ userAgent: 'test-storage-persist', storage })) {
    Object.defineProperty(realNavigator, 'storage', { value: storage, configurable: true, writable: true });
  }
}
function removeStorage() {
  if (!replaceNavigator({ userAgent: 'test-storage-persist' })) {
    try { delete realNavigator.storage; } catch { /* rien */ }
  }
}

const { requestPersistentStorage, getStoragePersistedStatus, STORAGE_PERSISTED_KEY } = await import(pathToFileURL(path.join(ROOT, 'modules/storage-persist.js')).href);
const db = await import(pathToFileURL(path.join(ROOT, 'db.js')).href);
const { getErrorLogSnapshot } = await import(pathToFileURL(path.join(ROOT, 'modules/error-log.js')).href);

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`✅ ${name}`);
}

const reset = () => settings.clear();

if (!STORAGE_PERSISTED_KEY || STORAGE_PERSISTED_KEY !== 'storagePersisted') throw new Error('Clé de réglage attendue : storagePersisted');

await check('API absente -> « unsupported » enregistré', async () => {
  removeStorage();
  reset();
  assert.equal(await requestPersistentStorage(), 'unsupported');
  assert.equal(await db.getSetting('storagePersisted'), 'unsupported');
});

await check('persist() accordé -> true enregistré', async () => {
  installStorage({ persist: async () => true });
  reset();
  assert.equal(await requestPersistentStorage(), true);
  assert.equal(await db.getSetting('storagePersisted'), true);
});

await check('persist() refusé -> false enregistré', async () => {
  installStorage({ persist: async () => false });
  reset();
  assert.equal(await requestPersistentStorage(), false);
  assert.equal(await db.getSetting('storagePersisted'), false);
});

await check('persist() en erreur -> false enregistré et signalé au journal', async () => {
  installStorage({ persist: async () => { throw new Error('refus navigateur'); } });
  reset();
  assert.equal(await requestPersistentStorage(), false);
  assert.equal(await db.getSetting('storagePersisted'), false);
  const entry = getErrorLogSnapshot().find((item) => String(item.detail).includes('persist_request_failed'));
  assert.ok(entry, 'Une entrée persist_request_failed est attendue dans le journal');
});

await check('Statut déjà connu : relecture sans écraser le réglage (non-régression)', async () => {
  reset();
  settings.set('storagePersisted', true);
  installStorage({ persisted: async () => false });
  assert.equal(await getStoragePersistedStatus(), true);
  assert.equal(await db.getSetting('storagePersisted'), true, 'le réglage existant ne doit pas être écrasé');
});

await check('Aucun réglage : vérifie l’état réel du navigateur et l’enregistre', async () => {
  reset();
  installStorage({ persisted: async () => true });
  assert.equal(await getStoragePersistedStatus(), true);
  assert.equal(await db.getSetting('storagePersisted'), true);
});

await check('Aucun réglage et aucune API : "pas encore déterminé" (null)', async () => {
  reset();
  removeStorage();
  assert.equal(await getStoragePersistedStatus(), null);
});

await check('Le module est gardé hors ligne et affiché dans Progrès', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/modules\/storage-persist\.js'/, 'sw.js doit mettre storage-persist.js en cache');
  const dashboard = fs.readFileSync(path.join(ROOT, 'modules/dashboard.js'), 'utf8');
  assert.match(dashboard, /Stockage protégé/, 'dashboard.js doit afficher le statut du stockage');
  assert.match(dashboard, /Vérifier la protection du stockage/, 'dashboard.js doit proposer la vérification');
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.match(app, /requestPersistentStorage/, 'app.js doit demander la protection au déverrouillage parent');
});

console.log(`\n🎉 test-storage-persist : OK (${passed} vérifications).`);
