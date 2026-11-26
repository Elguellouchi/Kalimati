#!/usr/bin/env node
/**
 * Lot 1 / Tâche 3 (L1-04, L1-05) : budgets cliniques de démarrage et du son.
 * Vérifie :
 *  1. les budgets du cahier des charges (1500 ms hors ligne, 4000 ms en ligne, 300 / 800 ms pour le son) ;
 *  2. hors ligne, un démarrage au-delà de 1,5 s écrit UX_FRICTION « startup_slow:Xms » ;
 *  3. hors ligne, un démarrage sous 1,5 s n'écrit rien ;
 *  4. une seule mesure de démarrage par lancement ;
 *  5. en ligne, le budget passe à 4 s ;
 *  6. un son qui part sous 300 ms n'écrit rien ;
 *  7. entre 300 et 800 ms, UX_FRICTION « audio_slow:Xms » avec l'identifiant de carte ;
 *  8. au-delà de 800 ms, AUDIO_SILENT ;
 *  9. un « playing » sans toucher mesuré n'écrit rien ;
 * 10. app.js, speech.js et sw.js sont bien branchés.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Node n'a pas de page : minimum attendu par modules/util.js (garde-fou des éléments).
for (const name of ['Element', 'DocumentFragment', 'Document']) if (!globalThis[name]) globalThis[name] = class {};

// ---------- Horloge et réseau simulés ----------
let clock = 5000;
const clockProvider = { now: () => clock };
function installClock(value) {
  try { globalThis.performance = value; } catch { /* propriété en lecture seule */ }
  if (!globalThis.performance || globalThis.performance.now !== value.now) {
    Object.defineProperty(globalThis, 'performance', { value, configurable: true, writable: true });
  }
}
installClock(clockProvider);
assert.equal(globalThis.performance.now(), clock, 'horloge de test installée');

function setOnline(value) {
  const nav = { onLine: value };
  try { globalThis.navigator = nav; } catch { /* lecture seule */ }
  if (!globalThis.navigator || globalThis.navigator.onLine !== value) {
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
  }
  assert.equal(globalThis.navigator.onLine, value, 'état réseau de test installé');
}
setOnline(false);

const {
  STARTUP_BUDGET_OFFLINE_MS,
  STARTUP_BUDGET_ONLINE_MS,
  AUDIO_BUDGET_MS,
  AUDIO_SILENT_MS,
  markStartupStart,
  recordFirstRender,
  markAudioStart,
  recordAudioPlaying,
} = await import(pathToFileURL(path.join(ROOT, 'modules/startup-timing.js')).href);

const { LOG_TYPES, clearErrorLog, getErrorLogSnapshot } =
  await import(pathToFileURL(path.join(ROOT, 'modules/error-log.js')).href);

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`✅ ${name}`);
}

await check('Budgets du cahier des charges', () => {
  assert.equal(STARTUP_BUDGET_OFFLINE_MS, 1500);
  assert.equal(STARTUP_BUDGET_ONLINE_MS, 4000);
  assert.equal(AUDIO_BUDGET_MS, 300);
  assert.equal(AUDIO_SILENT_MS, 800);
});

await check('Hors ligne : démarrage à 1600 ms -> UX_FRICTION startup_slow:1600ms', async () => {
  setOnline(false);
  await clearErrorLog();
  clock = 10000;
  markStartupStart();
  clock += 1600;
  assert.equal(recordFirstRender(), 1600);
  const snap = getErrorLogSnapshot();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].type, LOG_TYPES.UX_FRICTION);
  assert.match(snap[0].detail, /startup_slow:1600ms/);
});

await check('Hors ligne : démarrage à 1400 ms -> aucune entrée', async () => {
  setOnline(false);
  await clearErrorLog();
  clock = 20000;
  markStartupStart();
  clock += 1400;
  assert.equal(recordFirstRender(), 1400);
  assert.equal(getErrorLogSnapshot().length, 0);
});

await check('Une seule mesure par lancement (le deuxième rendu est ignoré)', async () => {
  setOnline(false);
  await clearErrorLog();
  clock = 30000;
  markStartupStart();
  clock += 5000;
  assert.equal(recordFirstRender(), 5000);
  clock += 1000;
  assert.equal(recordFirstRender(), null);
  assert.equal(getErrorLogSnapshot().length, 1);
});

await check('En ligne : budget 4 s (3500 ms silencieux, 4100 ms signalé)', async () => {
  setOnline(true);
  await clearErrorLog();
  clock = 40000;
  markStartupStart();
  clock += 3500;
  assert.equal(recordFirstRender(), 3500);
  assert.equal(getErrorLogSnapshot().length, 0);
  clock = 50000;
  markStartupStart();
  clock += 4100;
  assert.equal(recordFirstRender(), 4100);
  const snap = getErrorLogSnapshot();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].type, LOG_TYPES.UX_FRICTION);
  assert.match(snap[0].detail, /startup_slow:4100ms/);
});

await check('Son sous 300 ms : aucune entrée', async () => {
  await clearErrorLog();
  clock = 60000;
  markAudioStart('c-manger-pain');
  clock += 250;
  assert.equal(recordAudioPlaying('c-manger-pain'), 250);
  assert.equal(getErrorLogSnapshot().length, 0);
});

await check('Son entre 300 et 800 ms : UX_FRICTION audio_slow avec la carte', async () => {
  await clearErrorLog();
  clock = 70000;
  markAudioStart('c-manger-pain');
  clock += 400;
  assert.equal(recordAudioPlaying('c-manger-pain'), 400);
  const snap = getErrorLogSnapshot();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].type, LOG_TYPES.UX_FRICTION);
  assert.equal(snap[0].cardId, 'c-manger-pain');
  assert.match(snap[0].detail, /audio_slow:400ms/);
});

await check('Son au-delà de 800 ms : AUDIO_SILENT', async () => {
  await clearErrorLog();
  clock = 80000;
  markAudioStart('c-actions-boire');
  clock += 900;
  assert.equal(recordAudioPlaying('c-actions-boire'), 900);
  const snap = getErrorLogSnapshot();
  assert.equal(snap.length, 1);
  assert.equal(snap[0].type, LOG_TYPES.AUDIO_SILENT);
  assert.equal(snap[0].cardId, 'c-actions-boire');
  assert.match(snap[0].detail, /audio_slow:900ms/);
});

await check('« playing » sans toucher mesuré : aucune entrée', async () => {
  await clearErrorLog();
  assert.equal(recordAudioPlaying('c-base-oui'), null);
  assert.equal(getErrorLogSnapshot().length, 0);
});

await check('app.js : chronomètre au début et mesure au premier rendu de Parler', () => {
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  const startupImport = app.indexOf("from './modules/startup-timing.js'");
  const utilImport = app.indexOf("import './modules/util.js'");
  assert.ok(startupImport >= 0, 'app.js doit importer startup-timing.js');
  assert.ok(startupImport < utilImport, 'startup-timing.js doit être importé avant les autres modules');
  assert.match(app, /^markStartupStart\(\);\r?$/m, 'markStartupStart() doit être appelé au début de app.js');
  assert.match(app, /state\.space === 'talk'\) \{ view\.replaceChildren\(renderTalk\(\)\); recordFirstRender\(\);/,
    'recordFirstRender() doit suivre le premier rendu de la grille Parler');
});

await check('speech.js : toucher et « playing » mesurés, carte transmise', () => {
  const speech = fs.readFileSync(path.join(ROOT, 'speech.js'), 'utf8');
  assert.match(speech, /from '\.\/modules\/startup-timing\.js'/);
  assert.match(speech, /markAudioStart\(cardId\)/);
  assert.match(speech, /recordAudioPlaying\(cardId\)/);
  assert.match(speech, /playBlob\(recording, \{ cardId: card\.id \}\)/);
  assert.match(speech, /playUrl\(url, card\.id\)/);
});

await check('sw.js : les deux modules sont gardés hors ligne', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/modules\/startup-timing\.js'/);
  assert.match(sw, /'\.\/modules\/voice-preload\.js'/);
});

console.log(`\n🎉 test-startup-timing : OK (${passed} vérifications).`);
