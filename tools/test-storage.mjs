// Lot 0, L0-10 : une seule porte pour les clés localStorage, avec isolement de la version d'essai.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const STORAGE_FILE = path.join(ROOT, 'modules/storage.js');
assert.ok(fs.existsSync(STORAGE_FILE), 'modules/storage.js doit fournir la fonction centrale storageKey');
const source = fs.readFileSync(STORAGE_FILE, 'utf8');

function loadStorage(pathname, store) {
  const context = { location: { pathname }, localStorage: store };
  context.globalThis = context;
  vm.runInNewContext(source, context, { filename: STORAGE_FILE });
  assert.equal(typeof context.KalimatiStorage?.storageKey, 'function', 'KalimatiStorage.storageKey doit être disponible');
  return context.KalimatiStorage;
}

function memoryStore() {
  const values = new Map();
  return {
    values,
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

const names = [
  'kalimati-theme',
  'kalimati-pb-open',
  'kalimati_voices',
  'kalimati-active-child',
  'kalimati-children',
  'kalimati-rewards-v1:cabcde',
];
const mainStore = memoryStore();
const main = loadStorage('/Kalimati/', mainStore);
for (const name of names) assert.equal(main.storageKey(name), name, `la version principale garde la clé ${name}`);

const trialStore = memoryStore();
const trial = loadStorage('/Kalimati/essai/', trialStore);
for (const name of names) assert.equal(trial.storageKey(name), `essai-${name}`, `la version d'essai isole la clé ${name}`);
assert.equal(trial.storageKey('essai-deja-prefixe'), 'essai-deja-prefixe', 'le préfixe d’essai n’est pas ajouté deux fois');
assert.equal(loadStorage('/Kalimati/essai-copie/', memoryStore()).storageKey(names[0]), names[0], 'un dossier simplement nommé « essai-copie » n’est pas la version d’essai');

trial.setItem('kalimati-theme', 'contraste');
assert.equal(trialStore.values.get('essai-kalimati-theme'), 'contraste', 'setItem écrit dans la clé d’essai');
assert.equal(trialStore.values.has('kalimati-theme'), false, 'setItem ne touche pas la clé principale');
assert.equal(trial.getItem('kalimati-theme'), 'contraste', 'getItem relit la clé d’essai');
main.setItem('kalimati-pb-open', 1);
assert.equal(mainStore.values.get('kalimati-pb-open'), '1', 'setItem conserve la conversion native en texte');

const refusingStore = { getItem: () => null, setItem: () => { throw new Error('écriture refusée'); } };
const refusing = loadStorage('/Kalimati/', refusingStore);
assert.equal(refusing.setItem('kalimati-theme', 'simple'), false, 'un échec d’écriture est signalé à l’appelant');

const blockedContext = { location: { pathname: '/Kalimati/' } };
Object.defineProperty(blockedContext, 'localStorage', { get() { throw new Error('stockage bloqué'); } });
blockedContext.globalThis = blockedContext;
vm.runInNewContext(source, blockedContext, { filename: STORAGE_FILE });
assert.equal(blockedContext.KalimatiStorage.getItem('kalimati-theme'), null, 'navigation privée : lecture sans erreur');
assert.doesNotThrow(() => blockedContext.KalimatiStorage.setItem('kalimati-theme', 'simple'), 'navigation privée : écriture sans erreur');

const directCall = /(?:^|[^\w$.])(?:(?:globalThis|window|self)\s*(?:\?\.\s*|\.\s*)localStorage|(?:globalThis|window|self)\s*(?:\?\.\s*)?\[\s*['"]localStorage['"]\s*\]|localStorage)\s*(?:\?\.\s*|\.\s*)(?:(?:getItem|setItem|removeItem|clear|key)\s*\(|\[)/m;
const forbiddenSamples = [
  "localStorage.getItem('x')",
  "globalThis.localStorage.setItem('x', '1')",
  "window.localStorage.removeItem('x')",
  "self.localStorage.clear()",
  "window['localStorage'].getItem('x')",
  'globalThis["localStorage"].setItem(\'x\', \'1\')',
  "localStorage?.getItem('x')",
  "window.localStorage?.key(0)",
];
for (const sample of forbiddenSamples) assert.match(sample, directCall, `le garde-fou détecte ${sample}`);
const browserFiles = [
  ...fs.readdirSync(ROOT).filter((name) => name.endsWith('.js')).map((name) => path.join(ROOT, name)),
  ...fs.readdirSync(path.join(ROOT, 'modules')).filter((name) => name.endsWith('.js')).map((name) => path.join(ROOT, 'modules', name)),
];
for (const file of browserFiles) {
  if (file === STORAGE_FILE) continue;
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), directCall, `${path.relative(ROOT, file)} ne doit pas appeler localStorage directement`);
}
assert.equal((source.match(/\bfunction\s+storageKey\s*\(/g) || []).length, 1, 'une seule fonction storageKey dans le code navigateur');

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const storageScript = html.indexOf('src="modules/storage.js"');
const themeScript = html.indexOf('src="theme-boot.js"');
assert.ok(storageScript >= 0 && storageScript < themeScript, 'storage.js est chargé avant theme-boot.js pour éviter un éclair de thème');
assert.match(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8'), /'\.\/modules\/storage\.js'/, 'storage.js est gardé hors ligne');

console.log('test-storage : OK');
