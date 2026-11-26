import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULE = path.join(ROOT, 'modules/storage-warning.js');
assert.ok(fs.existsSync(MODULE), 'modules/storage-warning.js doit exister');

for (const name of ['Element', 'DocumentFragment', 'Document']) globalThis[name] = class {};
globalThis.Node = class {};
globalThis.location = { pathname: '/' };

const { isStorageNearlyFull, formatBytes, biggestMedia } = await import(pathToFileURL(MODULE).href);
const db = await import(pathToFileURL(path.join(ROOT, 'db.js')).href);

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`OK ${name}`);
}

await check('Le seuil est strictement supérieur à 85 %', () => {
  assert.equal(isStorageNearlyFull({ usage: 850000, quota: 1000000 }), false);
  assert.equal(isStorageNearlyFull({ usage: 850001, quota: 1000000 }), true);
  assert.equal(isStorageNearlyFull({ usage: 86, quota: 100 }), true);
});

await check('Quota absent, nul ou estimation invalide : aucune alerte', () => {
  assert.equal(isStorageNearlyFull(null), false);
  assert.equal(isStorageNearlyFull({ usage: 100, quota: 0 }), false);
  assert.equal(isStorageNearlyFull({ usage: Number.NaN, quota: 100 }), false);
});

await check('Les tailles sont lisibles en français', () => {
  assert.equal(formatBytes(0), '0 Ko');
  assert.equal(formatBytes(1024), '1 Ko');
  assert.equal(formatBytes(1048576), '1 Mo');
  assert.equal(formatBytes(1572864), '1,5 Mo');
});

await check('Le top 3 est trié, limité et ne conserve aucun libellé personnel', () => {
  const items = [
    { kind: 'photo', size: 1024, title: 'private-marker' },
    { kind: 'video', size: 4096, title: 'private-marker' },
    { kind: 'voice', size: 2048, title: 'private-marker' },
    { kind: 'photo', size: 512, title: 'private-marker' },
    { kind: 'voice', size: 0, title: 'private-marker' },
  ];
  assert.deepEqual(biggestMedia(items), [
    { kind: 'video', size: 4096 },
    { kind: 'voice', size: 2048 },
    { kind: 'photo', size: 1024 },
  ]);
});

await check('storageEstimate conserve les octets bruts', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { storage: { estimate: async () => ({ usage: 850001, quota: 1000000 }) } },
  });
  const estimate = await db.storageEstimate();
  assert.equal(estimate.usage, 850001);
  assert.equal(estimate.quota, 1000000);
  assert.equal(typeof estimate.usageMb, 'number');
  assert.equal(typeof estimate.quotaMb, 'number');
});

await check('Les inventaires de médias sont disponibles dans db.js', () => {
  assert.equal(typeof db.getAllRecordings, 'function');
  assert.equal(typeof db.getAllOnlineCache, 'function');
});

await check('L’alerte est réservée à Progrès et gardée hors ligne', () => {
  const dashboard = fs.readFileSync(path.join(ROOT, 'modules/dashboard.js'), 'utf8');
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(dashboard, /from '\.\/storage-warning\.js'/);
  assert.match(dashboard, /storageWarningBox\(\)/);
  assert.doesNotMatch(app, /storage-warning/, 'aucun inventaire au démarrage de l’application');
  assert.match(sw, /'\.\/modules\/storage-warning\.js'/);
});

await check('La suite npm test inclut la régression', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.test, /node tools\/test-storage-warning\.mjs/);
});

console.log(`\ntest-storage-warning : OK (${passed} vérifications).`);
