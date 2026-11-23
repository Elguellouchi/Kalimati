#!/usr/bin/env node
// v10.40+ (Lot 3.1) : met chaque dictionnaire locales/<lang>.json au format clinique :
//   "c-emotions-content": { "label": …, "tts": …, "gender": …, "grammar": "adjectif", "disambiguation": "…" }
// Sans effacer ce qui existe (forme vocale arabe, accords, classificateurs). Relançable sans risque.
// Puis : node tools/build-locales.mjs (le paquet de l'appli n'emporte pas ces notes de relecture).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SENSES, GRAMMAR_NAMES } from './locale-senses.mjs';

for (const name of ['Element', 'DocumentFragment', 'Document', 'HTMLElement']) if (!globalThis[name]) globalThis[name] = class {};
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { defaultCards } = await import(pathToFileURL(path.join(ROOT, 'data.js')).href);
const gramOf = new Map(defaultCards().map((c) => [c.id, c.gram]));
const EXTRA = ['ar', 'en', 'es', 'de', 'it', 'pt', 'nl', 'tr', 'zh'];

for (const code of EXTRA) {
  const file = path.join(ROOT, 'locales', `${code}.json`);
  const locale = JSON.parse(fs.readFileSync(file, 'utf8'));
  const out = {};
  for (const [id, value] of Object.entries(locale.lexicon)) {
    const entry = typeof value === 'string' ? { label: value } : { ...value };
    const gram = gramOf.get(id);
    if (gram) entry.grammar = GRAMMAR_NAMES[gram] || gram;
    if (SENSES[id]) entry.disambiguation = SENSES[id];
    out[id] = entry;
  }
  locale.lexicon = out;
  fs.writeFileSync(file, `${JSON.stringify(locale, null, 2)}\n`, 'utf8');
  console.log(`✍️  locales/${code}.json : ${Object.keys(out).length} mots au format clinique`);
}
