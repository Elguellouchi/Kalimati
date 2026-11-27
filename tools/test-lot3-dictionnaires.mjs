// v10.41 — Lot 3 : dictionnaires cliniques par langue (locales/<lang>.json), hors ligne.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
for (const name of ['Element', 'DocumentFragment', 'Document', 'HTMLElement']) if (!globalThis[name]) globalThis[name] = class {};

const { defaultCards } = await import('../data.js');
const { cardWord } = await import('../modules/languages.js');
const { SENSES } = await import('./locale-senses.mjs');
const ok = (m) => console.log(`✓ ${m}`);
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const cards = defaultCards();
const EXTRA = ['ar', 'en', 'es', 'de', 'it', 'pt', 'nl', 'tr', 'zh'];

// 3.1 Format clinique : chaque carte de départ a son entrée complète dans chaque langue.
for (const code of EXTRA) {
  const { lexicon } = JSON.parse(read(`locales/${code}.json`));
  for (const c of cards) {
    const e = lexicon[c.id];
    assert.ok(e && typeof e === 'object', `${code} : ${c.id} absent`);
    assert.ok(e.label && e.label.trim(), `${code} : ${c.id} sans mot`);
    assert.ok(e.grammar, `${code} : ${c.id} sans rôle`);
    assert.equal(e.disambiguation, SENSES[c.id], `${code} : ${c.id} sans sens`);
  }
  // Deux sens différents ne partagent pas le même mot (sauf « dormir », besoin et action = même sens).
  const seen = new Map();
  for (const [id, e] of Object.entries(lexicon)) {
    const w = e.label.toLowerCase();
    if (seen.has(w)) assert.ok([seen.get(w), id].every((x) => /dormir$/.test(x)), `${code} : « ${e.label} » sert pour ${seen.get(w)} et ${id}`);
    seen.set(w, id);
  }
}
ok(`${EXTRA.length} langues × ${cards.length} cartes : mot, rôle et sens présents`);
assert.equal(JSON.parse(read('locales/es.json')).lexicon['c-besoins-bain'].label, 'Bañera');
ok('espagnol : « Baño » (toilettes) et « Bañera » (bain) ne se confondent plus');

// La darija et l'amazigh ne sont pas traduits par la machine : lexiques vides ici, relecture humaine ailleurs.
for (const code of ['dr', 'shi', 'tzm', 'rif', 'zgh']) assert.deepEqual(JSON.parse(read(`locales/${code}.json`)).lexicon, {}, code);
ok('darija et amazigh : aucun mot ajouté sans relecture humaine');

// Carte « Thérapeute » : traduite, sauf si le parent y a écrit un prénom.
const therapist = cards.find((c) => c.id === 'c-personnes-therapist');
assert.equal(cardWord({ ...therapist, fr: 'Thérapeute' }, 'es'), 'Terapeuta');
assert.equal(cardWord({ ...therapist, fr: 'Thérapeute' }, 'zh'), '治疗师');
assert.equal(cardWord({ ...therapist, fr: 'Hosna' }, 'es'), 'Hosna');
ok('« Thérapeute » traduite ; un prénom reste un prénom');

// 3.1 Hors ligne : les dictionnaires sont dans l'appli, gardée par le service worker.
const sw = read('sw.js');
assert.ok(sw.includes("'./modules/locales-data.js'") && sw.includes("'./modules/locales.js'"));
const bundle = read('modules/locales-data.js');
assert.ok(!bundle.includes('disambiguation') && !bundle.includes('"grammar"'), 'les notes de relecture ne partent pas dans l’appli');
assert.ok(!/fetch\(/.test(read('modules/locales.js')), 'aucun téléchargement de dictionnaire');
for (const code of EXTRA) assert.ok(bundle.includes(`"${code}": {`), `${code} absent du paquet`);
ok('dictionnaires dans l’appli, gardés hors ligne, sans les notes de relecture');

const runtimeFiles = ['index.html', 'manifest.webmanifest', 'style.css',
  ...readdirSync(new URL('../', import.meta.url)).filter((name) => name.endsWith('.js')).map((name) => name),
  ...readdirSync(new URL('../modules/', import.meta.url)).filter((name) => name.endsWith('.js')).map((name) => `modules/${name}`),
  ...readdirSync(new URL('../locales/', import.meta.url)).filter((name) => name.endsWith('.json')).map((name) => `locales/${name}`)];
const refusedWording = runtimeFiles.filter((file) => /\bvalidé(?:e|s|es)?\b|(?<![\p{L}\p{N}_])validé(?![\p{L}\p{N}_])/iu.test(read(file)));
assert.deepEqual(refusedWording, [], 'aucune forme de « validé » dans les sources runtime');
ok('vocabulaire runtime : aucune promesse de relecture clinique');
console.log('test-lot3-dictionnaires : OK');
