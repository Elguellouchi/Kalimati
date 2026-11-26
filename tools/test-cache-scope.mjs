// Lot 0, L0-11 : installation sans attendre le réseau, activation sans vider les autres versions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { mainWorkerIgnoresTrial } from './check-pages-root.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VOICE = './voix/fr/carte-test.mp3';
const SECOND_VOICE = './voix/fr/carte-test-2.mp3';
const VOICE_INDEX = './voix/index.json';
const IMAGE = './assets/mulberry/carte-test.svg';
const SECOND_IMAGE = './assets/mulberry/carte-test-2.svg';
const MISSING_IMAGE = './assets/emoji/image-manquante.svg';
const TIFINAGH_FONT = './assets/fonts/NotoSansTifinagh-Regular.woff2';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

function runInstall({ pathname = '/Kalimati/sw.js', old = {}, put, add } = {}) {
  const listeners = new Map();
  const copies = [];
  const downloads = [];
  const opened = [];
  const cache = {
    addAll: async () => {},
    put(file, response) {
      copies.push({ file, response });
      return put ? put(file, response) : Promise.resolve();
    },
    add(file) {
      downloads.push(file);
      return add ? add(file) : Promise.resolve();
    },
  };
  const context = {
    self: {
      location: { origin: 'http://127.0.0.1:4173', pathname },
      addEventListener: (name, handler) => listeners.set(name, handler),
    },
    caches: {
      open: async (name) => { opened.push(name); return cache; },
      match: async (file) => old[file] || null,
    },
    fetch: async (file) => ({
      ok: true,
      json: async () => file === VOICE_INDEX
        ? { fr: { 'carte-test': {}, 'carte-test-2': {} } }
        : { mulberry: ['mulberry/carte-test.svg', 'mulberry/carte-test-2.svg'], emoji: ['emoji/image-manquante.svg'] },
    }),
    Request: class {
      constructor(file, options) {
        this.file = file;
        this.options = options;
      }
    },
  };
  vm.runInNewContext(sw, context, { filename: 'sw.js' });
  assert.equal(typeof listeners.get('install'), 'function', 'le gestionnaire install doit être enregistré');
  let install;
  listeners.get('install')({ waitUntil: (promise) => { install = promise; } });
  return { install, copies, downloads, opened };
}

const cachedVoice = { source: 'ancienne voix' };
const cachedSecondVoice = { source: 'ancienne seconde voix' };
const cachedImage = { source: 'ancienne image' };
const cachedSecondImage = { source: 'ancienne seconde image' };
const oldAssets = {
  [VOICE_INDEX]: { source: 'ancien index vocal' },
  [VOICE]: cachedVoice,
  [SECOND_VOICE]: cachedSecondVoice,
  [IMAGE]: cachedImage,
  [SECOND_IMAGE]: cachedSecondImage,
  [TIFINAGH_FONT]: { source: 'ancienne police' },
};
const voiceCopyStarted = deferred();
const secondVoiceCopyStarted = deferred();
const imageCopyStarted = deferred();
const secondImageCopyStarted = deferred();
const voiceCopy = deferred();
const secondVoiceCopy = deferred();
const imageCopy = deferred();
const secondImageCopy = deferred();
const copying = runInstall({
  old: oldAssets,
  put(file) {
    if (file === VOICE) {
      voiceCopyStarted.resolve();
      return voiceCopy.promise;
    }
    if (file === SECOND_VOICE) {
      secondVoiceCopyStarted.resolve();
      return secondVoiceCopy.promise;
    }
    if (file === IMAGE) {
      imageCopyStarted.resolve();
      return imageCopy.promise;
    }
    if (file === SECOND_IMAGE) {
      secondImageCopyStarted.resolve();
      return secondImageCopy.promise;
    }
    return Promise.resolve();
  },
});
let copyInstallFinished = false;
copying.install.then(() => { copyInstallFinished = true; });
await voiceCopyStarted.promise;
assert.equal(copyInstallFinished, false, 'l’installation attend la recopie des voix depuis l’ancien cache');
voiceCopy.resolve();
await secondVoiceCopyStarted.promise;
await new Promise((resolve) => setImmediate(resolve));
assert.equal(copyInstallFinished, false, 'l’installation attend la dernière recopie de voix');
secondVoiceCopy.resolve();
await imageCopyStarted.promise;
assert.equal(copyInstallFinished, false, 'l’installation attend la recopie des images depuis l’ancien cache');
imageCopy.resolve();
await secondImageCopyStarted.promise;
await new Promise((resolve) => setImmediate(resolve));
assert.equal(copyInstallFinished, false, 'l’installation attend la dernière recopie d’image');
secondImageCopy.resolve();
await copying.install;
assert.equal(copying.copies.find((copy) => copy.file === VOICE).response, cachedVoice, 'la voix vient de l’ancien cache sans nouveau téléchargement');
assert.equal(copying.copies.find((copy) => copy.file === SECOND_VOICE).response, cachedSecondVoice, 'la seconde voix vient aussi de l’ancien cache');
assert.equal(copying.copies.find((copy) => copy.file === IMAGE).response, cachedImage, 'l’image vient de l’ancien cache sans nouveau téléchargement');
assert.equal(copying.copies.find((copy) => copy.file === SECOND_IMAGE).response, cachedSecondImage, 'la seconde image vient aussi de l’ancien cache');
assert.deepEqual(copying.opened, ['kalimati-v10-48'], 'le worker principal installe son cache v10.48');

const trialInstalling = runInstall({ pathname: '/Kalimati/essai/sw.js' });
await trialInstalling.install;
assert.deepEqual(trialInstalling.opened, ['kalimati-essai-v10-48'], 'le worker d’essai installe son cache séparé v10.48');

const fallbackDownloads = [];
const fallback = runInstall({
  old: oldAssets,
  put(file) {
    return file === VOICE ? Promise.reject(new Error('copie impossible')) : Promise.resolve();
  },
  add(file) {
    fallbackDownloads.push(file);
    return Promise.resolve();
  },
});
await fallback.install;
assert.deepEqual(fallbackDownloads, [VOICE, MISSING_IMAGE], 'une recopie locale ratée rejoint les téléchargements réseau pour ne pas perdre la voix');

const networkStarted = deferred();
const networkDownload = deferred();
const downloading = runInstall({
  old: oldAssets,
  add(file) {
    assert.equal(file, MISSING_IMAGE, 'seule l’image absente de l’ancien cache est téléchargée');
    networkStarted.resolve();
    return networkDownload.promise;
  },
});
await networkStarted.promise;
await downloading.install;
assert.deepEqual(downloading.downloads, [MISSING_IMAGE], 'les ressources déjà copiées ne sont pas retéléchargées');
networkDownload.resolve();
await networkDownload.promise;

function activateWorker(pathname, keys) {
  const listeners = new Map();
  const deleted = [];
  let claimed = false;
  const context = {
    self: {
      location: { origin: 'http://127.0.0.1:4173', pathname },
      addEventListener: (name, handler) => listeners.set(name, handler),
      clients: { claim: async () => { claimed = true; } },
    },
    caches: {
      keys: async () => keys,
      delete: async (name) => { deleted.push(name); return true; },
    },
  };
  vm.runInNewContext(sw, context, { filename: 'sw.js' });
  assert.equal(typeof listeners.get('activate'), 'function', 'le gestionnaire activate doit être enregistré');
  let activation;
  listeners.get('activate')({ waitUntil: (promise) => { activation = promise; } });
  return activation.then(() => {
    assert.equal(claimed, true, 'le service worker prend le contrôle après nettoyage');
    return { deleted };
  });
}

const mainKeys = [
  'kalimati-v10-48',
  'kalimati-v10-46',
  'kalimati-essai-v10-48',
  'kalimati-essai-v10-46',
  'kalimati-amazigh-voices-fr',
  'autre-cache',
];
const main = await activateWorker('/Kalimati/sw.js', mainKeys);
assert.deepEqual(main.deleted, ['kalimati-v10-46'], 'la version principale conserve le cache d’essai, les voix amazighes et les caches étrangers');

const trialKeys = [
  'kalimati-essai-v10-48',
  'kalimati-essai-v10-46',
  'kalimati-v10-48',
  'kalimati-v10-46',
  'kalimati-essai-amazigh-voices-fr',
  'autre-cache',
];
const trial = await activateWorker('/Kalimati/essai/sw.js', trialKeys);
assert.deepEqual(trial.deleted, ['kalimati-essai-v10-46'], 'la version d’essai ne supprime que son ancien cache');

function fetchWorker(pathname) {
  const listeners = [];
  const context = {
    self: {
      location: { origin: 'http://127.0.0.1:4173', pathname },
      onfetch: null,
      addEventListener(name, handler) {
        if (name === 'fetch' && typeof handler === 'function') listeners.push(handler);
      },
      removeEventListener(name, handler) {
        if (name !== 'fetch') return;
        const index = listeners.indexOf(handler);
        if (index >= 0) listeners.splice(index, 1);
      },
    },
    URL,
    Request: class {
      constructor(url) { this.url = url; this.method = 'GET'; this.headers = new Headers(); }
    },
  };
  vm.runInNewContext(sw, context, { filename: 'sw.js' });
  if (context.self.onfetch !== null) throw new Error('onfetch n’est pas pris en charge par ce test');
  return async (event) => {
    let intercepted = false;
    const pending = [];
    const observed = {
      ...event,
      respondWith(value) {
        intercepted = true;
        pending.push(Promise.resolve(value));
        event.respondWith?.(value);
      },
      waitUntil(value) {
        pending.push(Promise.resolve(value));
        event.waitUntil?.(value);
      },
    };
    for (const listener of [...listeners]) pending.push(Promise.resolve(listener(observed)));
    await Promise.allSettled(pending);
    return intercepted;
  };
}

async function intercepts(pathname, requestUrl) {
  return fetchWorker(pathname)({
    request: new Request(requestUrl),
    respondWith() {},
    waitUntil() {},
  });
}

const origin = 'http://127.0.0.1:4173';
assert.equal(await intercepts('/Kalimati/sw.js', `${origin}/Kalimati/essai/`), false, 'le worker principal ignore /essai/');
assert.equal(await intercepts('/Kalimati/sw.js', `${origin}/Kalimati/enfants/essai/cartes`), false, 'le worker principal ignore tout segment /essai/');
assert.equal(await intercepts('/Kalimati/sw.js', `${origin}/Kalimati/essai-copie/`), true, 'le worker principal conserve les chemins similaires');
assert.equal(await intercepts('/Kalimati/sw.js', `${origin}/Kalimati/`), true, 'le worker principal intercepte toujours la racine');
assert.equal(await intercepts('/Kalimati/essai/sw.js', `${origin}/Kalimati/essai/`), true, 'le worker d’essai intercepte son propre chemin');

assert.equal(await mainWorkerIgnoresTrial(sw), true,
  'le contrôle de publication exécute le vrai worker principal et vérifie son comportement fetch');

const guardedListener = `self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (!/(^|\\/)essai(?:\\/|$)/.test(url.pathname)) event.respondWith(fetch(event.request));
});`;
const gateRegressions = [
  {
    name: 'commentaire seul',
    source: `const TRIAL = false;\n// if (!TRIAL && /(^|\\/)essai(?:\\/|$)/.test(url.pathname)) return;\nself.addEventListener('fetch', (event) => event.respondWith(fetch(event.request)));`,
  },
  {
    name: 'premier écouteur fetch non gardé',
    source: `const TRIAL = false;\nself.addEventListener('fetch', (event) => event.respondWith(fetch(event.request)));\n${guardedListener}`,
  },
  {
    name: 'gestionnaire onfetch non gardé',
    source: `const TRIAL = false;\n${guardedListener}\nself.onfetch = (event) => event.respondWith(fetch(event.request));`,
  },
  {
    name: 'transport différé dans waitUntil',
    source: `const TRIAL = false;\nself.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (/(^|\\/)essai(?:\\/|$)/.test(url.pathname)) {
    event.waitUntil(Promise.resolve().then(() => fetch(event.request)));
    return;
  }
  event.respondWith(fetch(event.request));
});`,
  },
  {
    name: 'branche gardée seulement hors navigateur',
    source: `const TRIAL = false;\nself.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (typeof navigator === 'undefined' && typeof clients === 'undefined' && /(^|\\/)essai(?:\\/|$)/.test(url.pathname)) return;
  event.respondWith(fetch(event.request));
});`,
  },
  {
    name: 'chemin essai non listé',
    source: `const TRIAL = false;
const ignored = new Set(['/Kalimati/essai/', '/Kalimati/essai', '/Kalimati/essai/app.js', '/Kalimati/enfants/essai/cartes']);
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (ignored.has(url.pathname)) return;
  event.respondWith(fetch(event.request));
});`,
  },
  {
    name: 'interception des navigations essai',
    source: `const TRIAL = false;\nself.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (/(^|\\/)essai(?:\\/|$)/.test(url.pathname) && event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request));
});`,
  },
  {
    name: 'interception à la deuxième requête',
    source: `const TRIAL = false;
const seen = new Set();
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (/(^|\\/)essai(?:\\/|$)/.test(url.pathname) && !seen.has(url.pathname)) {
    seen.add(url.pathname);
    return;
  }
  event.respondWith(fetch(event.request));
});`,
  },
  {
    name: 'TRIAL forcé à true',
    source: `const TRIAL = true;\n${guardedListener}`,
  },
];
const acceptedRegressions = [];
for (const regression of gateRegressions) {
  const accepted = await mainWorkerIgnoresTrial(regression.source);
  console.log(`${accepted ? 'ACCEPTÉ À TORT' : 'REFUSÉ'} G0 — ${regression.name}`);
  if (accepted) acceptedRegressions.push(regression.name);
}
assert.deepEqual(acceptedRegressions, [], `le contrôle G0 accepte encore : ${acceptedRegressions.join(', ')}`);

console.log('test-cache-scope : OK');
