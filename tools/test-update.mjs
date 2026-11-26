// Contrôles v10.17 : la mise à jour du service worker ne recharge plus la page.
// Sur iPhone, un rechargement automatique pendant l'utilisation laissait IndexedDB
// endormie (écran vide) et pouvait se répéter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSource } from './app-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readSource(rel); // v10.42 : « app.js » = app.js + ses modules découpés
const has = (rel, pattern, message) => assert.match(read(rel), pattern, message);
const lacks = (rel, pattern, message) => assert.doesNotMatch(read(rel), pattern, message);

// 1. Le service worker attend son tour : aucun skipWaiting à l'installation.
lacks('sw.js', /await self\.skipWaiting\(\)/, 'sw.js ne doit plus prendre la main pendant l’utilisation');
has('sw.js', /SKIP_WAITING/, 'sw.js doit accepter l’actualisation manuelle (SKIP_WAITING)');
has('sw.js', /'\.\/modules\/app-update\.js'/, 'app-update.js doit être précaché');

// 2. Aucune activation ni aucun rechargement pendant que l'enfant utilise l'appli.
lacks('app.js', /pending && !reloaded[\s\S]{0,120}location\.reload\(\)/, 'app.js ne doit plus se recharger au changement de visibilité');
has('app.js', /startAppUpdateWatch\(\)/, 'app.js doit démarrer la surveillance de mise à jour');
has('modules/app-update.js', /export function startAppUpdateWatch/, 'app-update.js doit exporter startAppUpdateWatch');
has('modules/app-update.js', /export function updateBox/, 'app-update.js doit exporter updateBox');
has('modules/app-update.js', /register\(['"]\.\/sw\.js['"]\s*,\s*\{\s*updateViaCache:\s*['"]none['"]\s*,\s*scope:\s*['"]\.\/['"]\s*,?\s*\}/, 'portée explicite du service worker');
has('modules/dashboard.js', /updateBox\(\)/, 'Progrès doit proposer le bloc de mise à jour');
has('modules/app-update.js', /Mise à jour de l’application/, 'le titre du bloc de mise à jour doit exister');
lacks('modules/app-update.js', /Actualiser maintenant|setTimeout\s*\(/, 'aucune activation immédiate ni relance de secours');

for (const name of ['Element', 'DocumentFragment', 'Document']) globalThis[name] = class {};
globalThis.Node = class {};

function updateHarness() {
  let visibility = 'visible';
  let reloads = 0;
  const messages = [];
  const documentListeners = new Map();
  const workerListeners = new Map();
  const waiting = { postMessage: (message) => messages.push(message) };
  const registration = { waiting, update: async () => {} };
  globalThis.document = {
    get visibilityState() { return visibility; },
    addEventListener: (type, listener) => documentListeners.set(type, listener),
  };
  globalThis.location = { reload: () => { reloads += 1; } };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      serviceWorker: {
        register: async () => registration,
        addEventListener: (type, listener) => workerListeners.set(type, listener),
      },
    },
  });
  return {
    registration,
    messages,
    reloads: () => reloads,
    setVisibility: (value) => { visibility = value; },
    fireDocument: () => documentListeners.get('visibilitychange')?.(),
    fireController: () => workerListeners.get('controllerchange')?.(),
  };
}

async function startHarness() {
  const harness = updateHarness();
  const { startAppUpdateWatch } = await import(`${pathToFileURL(path.join(ROOT, 'modules/app-update.js')).href}?test=${Date.now()}-${Math.random()}`);
  startAppUpdateWatch();
  await Promise.resolve();
  await Promise.resolve();
  return harness;
}

{
  const app = await startHarness();
  app.fireDocument();
  assert.equal(app.messages.length, 0, 'visible : aucune activation du worker en attente');
  assert.equal(app.reloads(), 0, 'visible : aucun rechargement');
  app.setVisibility('hidden');
  app.fireDocument();
  assert.deepEqual(app.messages, [{ type: 'SKIP_WAITING' }], 'arrière-plan : le worker en attente est activé');
  app.fireController();
  assert.equal(app.reloads(), 1, 'arrière-plan : la nouvelle version est appliquée');
}

{
  const app = await startHarness();
  app.setVisibility('hidden');
  app.fireDocument();
  app.setVisibility('visible');
  app.fireController();
  assert.equal(app.reloads(), 0, 'un controllerchange visible doit différer le rechargement');
  app.setVisibility('hidden');
  app.fireDocument();
  assert.equal(app.reloads(), 1, 'le rechargement différé a lieu au prochain passage en arrière-plan');
}

// 3. Le réseau ne peut plus bloquer indéfiniment une ouverture.
has('sw.js', /Gateway Timeout/, 'le service worker doit couper une requête qui ne répond jamais');

console.log('Mise à jour en arrière-plan uniquement (L1-08) : contrôles passés.');
