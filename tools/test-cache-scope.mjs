// Lot 0, L0-11 : installation sans attendre le réseau, activation sans vider les autres versions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

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

function runInstall({ old = {}, put, add } = {}) {
  const listeners = new Map();
  const copies = [];
  const downloads = [];
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
    self: { addEventListener: (name, handler) => listeners.set(name, handler) },
    caches: {
      open: async () => cache,
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
  return { install, copies, downloads };
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

async function activate(cacheName, keys) {
  const source = sw.replace(/const CACHE = '[^']+'/, `const CACHE = '${cacheName}'`);
  const listeners = new Map();
  const deleted = [];
  let claimed = false;
  const context = {
    self: {
      addEventListener: (name, handler) => listeners.set(name, handler),
      clients: { claim: async () => { claimed = true; } },
    },
    caches: {
      keys: async () => keys,
      delete: async (name) => { deleted.push(name); return true; },
    },
  };
  vm.runInNewContext(source, context, { filename: 'sw.js' });
  assert.equal(typeof listeners.get('activate'), 'function', 'le gestionnaire activate doit être enregistré');
  let activation;
  listeners.get('activate')({ waitUntil: (promise) => { activation = promise; } });
  await activation;
  assert.equal(claimed, true, 'le service worker prend le contrôle après nettoyage');
  return deleted;
}

const mainKeys = [
  'kalimati-v10-46',
  'kalimati-v10-45',
  'kalimati-essai-v10-46',
  'kalimati-essai-v10-45',
  'kalimati-amazigh-voices-fr',
  'autre-cache',
];
assert.deepEqual(await activate('kalimati-v10-46', mainKeys), ['kalimati-v10-45'], 'la version principale conserve le cache d’essai, les voix amazighes et les caches étrangers');

const trialKeys = [
  'kalimati-essai-v10-46',
  'kalimati-essai-v10-45',
  'kalimati-v10-46',
  'kalimati-v10-45',
  'kalimati-amazigh-voices-fr',
  'autre-cache',
];
assert.deepEqual(await activate('kalimati-essai-v10-46', trialKeys), ['kalimati-essai-v10-45'], 'la version d’essai ne supprime que son ancien cache');

console.log('test-cache-scope : OK');
