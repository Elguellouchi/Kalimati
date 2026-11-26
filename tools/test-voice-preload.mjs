#!/usr/bin/env node
/**
 * Lot 1 / Tâche 3 (L1-06) : pré-chargement silencieux des voix de la page visible.
 * Vérifie :
 *  1. le rendu n'attend pas le pré-chargement (retour immédiat, fetch plus tard) ;
 *  2. une carte avec voix déclenche fetch(url, { cache: 'force-cache' }) ;
 *  3. aucune requête pour une carte sans voix ;
 *  4. les anciens champs audioFr / audioDr restent lus ;
 *  5. un mp3 livré retrouvé par getDefaultUrl est pré-chargé ;
 *  6. une voix du parent (Blob) n'est jamais rechargée : elle est déjà dans le téléphone ;
 *  7. une erreur réseau est ignorée et retentée au rendu suivant ;
 *  8. 40 cartes au plus sont pré-chargées, et une même adresse une seule fois.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { VOICE_PRELOAD_MAX, preloadVisibleVoices } =
  await import(pathToFileURL(path.join(ROOT, 'modules/voice-preload.js')).href);

const calls = [];
let mode = 'ok';
const fetchStub = (url, options) => {
  calls.push({ url, options });
  if (mode === 'reject') return Promise.reject(new Error('hors ligne'));
  return Promise.resolve({ ok: true, status: 200 });
};
try { globalThis.fetch = fetchStub; } catch { /* lecture seule */ }
if (globalThis.fetch !== fetchStub) {
  Object.defineProperty(globalThis, 'fetch', { value: fetchStub, configurable: true, writable: true });
}
assert.equal(globalThis.fetch, fetchStub, 'fetch de test installé');

const tick = () => new Promise((resolve) => setTimeout(resolve, 25));
const reset = () => { calls.length = 0; mode = 'ok'; };

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`✅ ${name}`);
}

await check('Plafond annoncé : 40 cartes au plus', () => {
  assert.equal(VOICE_PRELOAD_MAX, 40);
});

await check('Le rendu n’attend pas : fetch part après le rendu', async () => {
  reset();
  const cards = [{ id: 'c-test-lent', audios: { fr: './voix/fr/c-test-lent.mp3' } }];
  assert.equal(preloadVisibleVoices(cards, 'fr'), 1);
  assert.equal(calls.length, 0, 'aucune requête pendant le rendu');
  await tick();
  assert.equal(calls.length, 1, 'la requête part une fois le rendu terminé');
});

await check('Carte avec voix : fetch avec cache force-cache', async () => {
  reset();
  const cards = [{ id: 'c-manger-pain', audios: { fr: './voix/fr/c-manger-pain.mp3' } }];
  assert.equal(preloadVisibleVoices(cards, 'fr'), 1);
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, './voix/fr/c-manger-pain.mp3');
  assert.equal(calls[0].options.cache, 'force-cache');
});

await check('Carte sans voix : aucune requête', async () => {
  reset();
  const cards = [{ id: 'c-sans-voix', audios: {} }, { id: 'c-sans-voix-2' }];
  assert.equal(preloadVisibleVoices(cards, 'fr'), 0);
  await tick();
  assert.equal(calls.length, 0);
});

await check('Anciens champs audioFr / audioDr encore lus', async () => {
  reset();
  preloadVisibleVoices([{ id: 'c-ancien-fr', audioFr: './voix/fr/c-ancien-fr.mp3' }], 'fr');
  preloadVisibleVoices([{ id: 'c-ancien-dr', audioDr: './voix/dr/c-ancien-dr.mp3' }], 'dr');
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, './voix/fr/c-ancien-fr.mp3');
  assert.equal(calls[1].url, './voix/dr/c-ancien-dr.mp3');
});

await check('Mp3 livré retrouvé par getDefaultUrl', async () => {
  reset();
  const getDefaultUrl = (card, lang) => (lang === 'fr' ? `./voix/fr/${card.id}.mp3` : null);
  assert.equal(preloadVisibleVoices([{ id: 'c-base-oui' }], 'fr', { getDefaultUrl }), 1);
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, './voix/fr/c-base-oui.mp3');
});

await check('Voix du parent (Blob) : rien à télécharger', async () => {
  reset();
  const cards = [{ id: 'c-voix-parent', audios: { fr: new Blob(['x'], { type: 'audio/mpeg' }) } }];
  assert.equal(preloadVisibleVoices(cards, 'fr'), 0);
  await tick();
  assert.equal(calls.length, 0);
});

await check('Erreur réseau ignorée, puis retentée au rendu suivant', async () => {
  reset();
  mode = 'reject';
  const cards = [{ id: 'c-erreur', audios: { fr: './voix/fr/c-erreur.mp3' } }];
  assert.equal(preloadVisibleVoices(cards, 'fr'), 1);
  await tick();
  assert.equal(calls.length, 1, 'la requête a bien été tentée et son échec avalé');
  mode = 'ok';
  assert.equal(preloadVisibleVoices(cards, 'fr'), 1, 'l’adresse en échec est retentée');
  await tick();
  assert.equal(calls.length, 2);
});

await check('40 cartes au plus, une même adresse une seule fois', async () => {
  reset();
  const many = Array.from({ length: 50 }, (_, i) => ({ id: `c-plafond-${i}`, audios: { fr: `./voix/fr/c-plafond-${i}.mp3` } }));
  assert.equal(preloadVisibleVoices(many, 'fr'), 40);
  await tick();
  assert.equal(calls.length, 40);
  assert.equal(preloadVisibleVoices(many, 'fr'), 0, 'déjà pré-chargées : aucune nouvelle requête');
  const dup = { id: 'c-doublon', audios: { fr: './voix/fr/c-doublon.mp3' } };
  const before = calls.length;
  assert.equal(preloadVisibleVoices([dup, dup], 'fr'), 1, 'une même adresse n’est demandée qu’une fois');
  await tick();
  assert.equal(calls.length, before + 1);
});

await check('Vue Parler : pré-chargement branché juste après le rendu de la grille', () => {
  const views = fs.readFileSync(path.join(ROOT, 'modules/views.js'), 'utf8');
  assert.match(views, /from '\.\/voice-preload\.js'/);
  assert.match(views, /preloadVisibleVoices\(visibleCards, state\.lang, \{ getDefaultUrl:/);
  assert.match(views, /boardCards\.filter\(visibleFor\)/);
});

console.log(`\n🎉 test-voice-preload : OK (${passed} vérifications).`);