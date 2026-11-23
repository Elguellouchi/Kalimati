#!/usr/bin/env node
/**
 * Garde-fous v10.12 : Socle Clinique strict, sablier silencieux, aide à 5 s sans relance vocale.
 * 1. Mode clinique par défaut et verrou réseau (Supabase, cohorte, ARASAAC/Wikipédia, voix Google).
 * 2. Sablier silencieux par défaut (remplissage) et compte à rebours chiffré en option.
 * 3. Aide avant l'erreur par défaut à 5 s, options 3 / 5 / 8 / pas d'aide, aucune relance vocale automatique.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

// util.js protège les prototypes DOM au chargement : on fournit les bases minimales sous Node.
if (typeof globalThis.Element === 'undefined') {
  globalThis.Element = class {};
  globalThis.DocumentFragment = class {};
  globalThis.Document = class {};
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
  };
}

async function main() {
  const policy = await load('modules/network-policy.js');
  const timer = await load('modules/timer.js');

  assert.equal(policy.isTeamMode(), false, 'Le mode Socle Clinique (hors ligne strict) doit être le défaut');
  assert.throws(() => policy.requireTeamMode('la synchronisation'), /Mode Socle Clinique/,
    'La synchro doit être refusée tant que le Mode équipe est éteint');
  await policy.setTeamMode(true);
  assert.equal(policy.isTeamMode(), true, 'Le Mode équipe doit pouvoir être activé explicitement');
  assert.equal(policy.requireTeamMode('la synchronisation'), true);
  await policy.setTeamMode(false);
  assert.throws(() => policy.requireTeamMode('la synchronisation'), /Mode Socle Clinique/,
    'Revenir au mode strict doit refermer le réseau');

  const cloudSync = read('modules/cloud-sync.js');
  assert.match(cloudSync, /export async function syncNowWithTeam[\s\S]{0,200}requireTeamMode\('la synchronisation avec l’équipe'\)/,
    'syncNowWithTeam doit exiger le Mode équipe');
  assert.match(cloudSync, /if \(isTeamMode\(\) && cfg\.autoSyncWifi/, 'La synchro automatique doit exiger le Mode équipe');
  assert.match(cloudSync, /async function rpcDelete[\s\S]{0,120}requireTeamMode\('la suppression de données sur le serveur'\)/,
    'Les suppressions serveur doivent exiger le Mode équipe');

  const speech = read('speech.js');
  assert.match(speech, /setCloudSpeechAllowed\(value\) \{ cloudSpeechAllowed = value === true && isTeamMode\(\); \}/,
    'La voix Google ne peut s’allumer qu’en Mode équipe');
  assert.match(speech, /!cloudSpeechAllowed \|\| !isTeamMode\(\)/, 'recognizeSpeech doit vérifier le Mode équipe');

  assert.match(read('modules/online-bank.js'), /!lookupAllowed \|\| !isTeamMode\(\) \|\| !isOnline\(\)/,
    'Les images automatiques ARASAAC/Wikipédia doivent exiger le Mode équipe');
  assert.match(read('modules/arasaac.js'), /requireTeamMode\('la recherche de pictogrammes ARASAAC'\)/,
    'La recherche ARASAAC manuelle doit exiger le Mode équipe');
  assert.match(read('modules/arasaac.js'), /requireTeamMode\('le téléchargement de pictogrammes ARASAAC'\)/,
    'Le téléchargement ARASAAC manuel doit exiger le Mode équipe');

  const app = read('app.js');
  assert.match(app, /await loadNetworkMode\(\)\.catch\(\(\) => \{\}\);\s+setCloudSpeechAllowed\(\(await db\.getSetting\(SPEECH_SETTING_KEY\)\) === true\);/,
    'Le mode réseau doit être chargé avant la voix Google');

  assert.match(read('modules/timer.js'), /let timerShowNumbers = false;/, 'Le sablier doit être silencieux par défaut');
  assert.match(read('modules/timer.js'), /clock\.hidden = !view\.showClock;/, 'Le sablier silencieux ne doit pas afficher de chiffres');
  assert.match(read('modules/timer.js'), /timer-silent/, 'Le sablier silencieux doit être identifiable dans l’interface');
  const schedule = read('modules/ex-schedule.js');
  assert.match(schedule, /getTimerShowNumbers\(\)/, 'Le sablier des routines doit suivre l’option parentale');
  assert.match(schedule, /clock\.hidden = !view\.showClock;/, 'Le sablier des routines doit masquer les chiffres par défaut');
  assert.doesNotMatch(schedule, /ALERTS|playBeep\(\)/, 'Plus d’alertes sonores ou vocales automatiques dans les routines');

  const silentAtStart = timer.timerVisualState(600, 600, false);
  const silentAtHalf = timer.timerVisualState(300, 600, false);
  const silentAtEnd = timer.timerVisualState(0, 600, false);
  assert.equal(silentAtStart.fraction, 0, 'Silencieux : le disque démarre vide');
  assert.equal(silentAtHalf.fraction, 0.5, 'Silencieux : le disque se remplit à mi-parcours');
  assert.equal(silentAtEnd.fraction, 1, 'Silencieux : le disque est plein à la fin');
  assert.equal(silentAtHalf.showClock, false, 'Silencieux : aucun chiffre');
  const numbered = timer.timerVisualState(300, 600, true);
  assert.equal(numbered.fraction, 0.5, 'Option chiffrée : le disque suit le temps restant');
  assert.equal(numbered.showClock, true, 'Option chiffrée : les chiffres sont visibles');

  const widgets = read('modules/widgets.js');
  assert.match(widgets, /export const DEFAULT_HINT_DELAY_SEC = 5;/, 'L’aide avant l’erreur doit être de 5 s par défaut');
  assert.match(widgets, /export const HINT_DELAY_OPTIONS = \[3, 5, 8, 0\];/, 'Les options d’aide restent 3 / 5 / 8 s / pas d’aide');
  const showHelp = /const showHelp = \(\) => \{([\s\S]*?)\n  \};/.exec(widgets);
  assert.ok(showHelp && !/speak\(/.test(showHelp[1]), 'L’aide visuelle ne doit déclencher aucune relance vocale');
  const scheduleHelp = /const scheduleHelp = \(\) => \{([\s\S]*?)\n  \};/.exec(widgets);
  assert.ok(scheduleHelp && !/speak\(/.test(scheduleHelp[1]), 'La programmation de l’aide ne doit déclencher aucune voix');
  assert.match(read('modules/dashboard.js'), /profile\.hintDelaySec \?\? 5/, 'Le réglage parent doit proposer 5 s par défaut');

  console.log('✅ v10.12 : Socle Clinique strict, sablier silencieux et aide à 5 s sans relance vocale vérifiés.');
}

main().catch((err) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});
