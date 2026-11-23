// v10.7 : liste des cartes à dire en amazigh, pour l'outil PC tools/generate-amazigh-voices.py.
// Écrit tools/amazigh-cards.json : le VRAI identifiant de chaque carte (nom du fichier son), le mot français,
// et le mot dans chaque variété (lexique modules/amazigh-lexicon.js).
// Cartes de départ + cartes des packs thématiques. Jamais les cartes personnelles (Moi, Sœur / Frère, Thérapeute).
// À relancer après chaque correction du lexique :  node tools/export-amazigh-cards.mjs

import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Les modules de l'appli attendent un navigateur : petits remplaçants, seulement pour les lire ici.
for (const name of ['Element', 'DocumentFragment', 'Document', 'HTMLElement']) if (!globalThis[name]) globalThis[name] = class {};
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VARIETIES = ['shi', 'tzm', 'rif', 'zgh'];
const PRIVATE_CARD_RE = /^c-personnes-(?!papa$|maman$|papi$|mamie$|maitresse$)/;

export async function amazighCards(root = ROOT) {
  const load = (rel) => import(pathToFileURL(join(root, rel)).href);
  const { defaultCards } = await load('data.js');
  const { THEMATIC_PACKS } = await load('modules/eye-and-packs.js');
  const { amazighEntry } = await load('modules/amazigh-lexicon.js');
  const all = [...defaultCards(), ...THEMATIC_PACKS.flatMap((pack) => pack.cards)];
  const seen = new Set();
  const out = [];
  for (const card of all) {
    if (seen.has(card.id) || PRIVATE_CARD_RE.test(card.id)) continue;
    seen.add(card.id);
    const words = Object.fromEntries(VARIETIES.map((code) => [code, amazighEntry(card.fr, code)]));
    if (VARIETIES.some((code) => !words[code])) continue; // pas de mot amazigh : pas de voix
    out.push({ id: card.id, fr: card.fr, ...words });
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cards = await amazighCards();
  await writeFile(join(ROOT, 'tools/amazigh-cards.json'), `${JSON.stringify({ note: 'Fichier fabriqué par tools/export-amazigh-cards.mjs. Ne pas modifier à la main.', count: cards.length, cards }, null, 1)}\n`);
  console.log(`tools/amazigh-cards.json : ${cards.length} cartes.`);
}
