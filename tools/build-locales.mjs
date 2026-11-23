#!/usr/bin/env node
/**
 * v10.21 — Lot 1 (souveraineté multilingue) : une langue = un fichier locales/<lang>.json.
 *
 * Le fichier JSON est la source de vérité (relisable par un orthophoniste natif). Ce script
 * fabrique, à partir de ces fichiers, le paquet modules/locales-data.js chargé par l'appli :
 * 100 % hors-ligne, aucun fetch, aucun JSON à analyser au démarrage.
 *
 * Usage :
 *   node tools/build-locales.mjs --migrate   # UNE FOIS : extrait les tables de modules/languages.js
 *   node tools/build-locales.mjs             # JSON -> modules/locales-data.js (à relancer après édition)
 *
 * Le lexique est identifié par cardId technique (« c-base-je-veux »), jamais par le texte français :
 * renommer un mot sur le téléphone ne casse plus sa traduction. Les mots français et darija restent
 * sur la carte (le parent les modifie) : leur lexique local est donc vide.
 * L'amazigh garde son lexique relu à la main dans modules/amazigh-lexicon.js (tifinagh + latin).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Les modules de l'appli attendent un navigateur : petits remplaçants, seulement pour les lire ici.
for (const name of ['Element', 'DocumentFragment', 'Document', 'HTMLElement']) if (!globalThis[name]) globalThis[name] = class {};
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' };

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES_DIR = path.join(ROOT, 'locales');
const BUNDLE = path.join(ROOT, 'modules', 'locales-data.js');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// Colonnes de la table WORDS historique (le français est la 1ʳᵉ colonne).
const EXTRA = ['ar', 'en', 'es', 'de', 'it', 'pt', 'nl', 'tr', 'zh'];
const CATEGORY_ORDER = ['base', 'manger', 'boire', 'jouer', 'actions', 'personnes', 'besoins', 'emotions', 'decrire', 'lieux'];
const norm = (text) => String(text || '').replace(/[’]/g, "'").trim().toLowerCase();

// ---------- Migration : extraction unique depuis modules/languages.js ----------
async function migrate() {
  const { LANGS, AMAZIGH_LANGS } = await import(pathToFileURL(path.join(ROOT, 'modules', 'languages.js')).href);
  const { defaultCards, CATEGORIES } = await import(pathToFileURL(path.join(ROOT, 'data.js')).href);
  const src = read('modules/languages.js').replace(/\r\n/g, '\n');

  const wordsBlock = /const WORDS = `\n([\s\S]*?)\n`;/.exec(src);
  if (!wordsBlock) throw new Error('table WORDS introuvable : migration impossible');
  const rows = wordsBlock[1].split('\n').map((line) => line.split('|'));

  const catNames = {};
  for (const m of src.matchAll(/^ {2}([a-z]{2,3}): \[(.+?)\],$/gm)) catNames[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]);

  const uiTables = {};
  for (const m of src.matchAll(/^ {2}([a-z]{2,3}): (\{.*\}),?$/gm)) {
    uiTables[m[1]] = Object.fromEntries([...m[2].matchAll(/([A-Za-z][\w]*): '([^']*)'/g)].map((x) => [x[1], x[2]]));
  }

  // cardId de chaque carte de départ : on relie le mot français à ses identifiants techniques.
  // Un même mot peut exister dans deux catégories (« Dormir » en besoins ET en actions) : on garde
  // donc une liste par mot, sinon le second cardId resterait sans traduction.
  const frToIds = new Map();
  const addFr = (text, id) => {
    const key = norm(text);
    if (!frToIds.has(key)) frToIds.set(key, []);
    if (!frToIds.get(key).includes(id)) frToIds.get(key).push(id);
  };
  for (const card of defaultCards()) addFr(card.fr, card.id);
  addFr('moi', 'c-personnes-moi');
  addFr('sœur / frère', 'c-personnes-sibling');
  addFr('thérapeute', 'c-personnes-therapist');

  const lexiconByLang = {};
  for (const code of EXTRA) {
    const dict = {};
    for (const row of rows) {
      const ids = frToIds.get(norm(row[0])) || [];
      const word = row[1 + EXTRA.indexOf(code)];
      if (word) for (const id of ids) dict[id] = word;
    }
    lexiconByLang[code] = dict;
  }

  fs.mkdirSync(LOCALES_DIR, { recursive: true });
  for (const lang of LANGS) {
    const code = lang.code;
    const isAmazigh = AMAZIGH_LANGS.includes(code);
    const categories = CATEGORY_ORDER.map((id, i) => {
      const base = CATEGORIES.find((c) => c.id === id) || { fr: id };
      if (code === 'fr') return base.fr;
      const table = catNames[code];
      return (table && table[i]) || (code === 'dr' ? (base.dr || base.fr) : base.fr);
    });
    const locale = {
      code,
      name: lang.name,
      short: lang.short,
      tts: lang.tts,
      rtl: Boolean(lang.rtl),
      ...(lang.amazigh ? { amazigh: true } : {}),
      ui: uiTables[code] || {},
      categories,
      lexicon: isAmazigh ? {} : (lexiconByLang[code] || {}),
      ...(isAmazigh ? { lexiconSource: 'modules/amazigh-lexicon.js' } : {}),
    };
    // v10.24 : les écritures de secours de la darija sont relues à la main, pas extraites de
    // modules/languages.js : une migration ne doit pas les effacer.
    const previous = fs.existsSync(path.join(LOCALES_DIR, `${code}.json`))
      ? JSON.parse(read(path.join('locales', `${code}.json`))) : {};
    if (previous.uiLatin) locale.uiLatin = previous.uiLatin;
    if (previous.categoriesLatin) locale.categoriesLatin = previous.categoriesLatin;
    fs.writeFileSync(path.join(LOCALES_DIR, `${code}.json`), `${JSON.stringify(locale, null, 2)}\n`, 'utf8');
    console.log(`✍️  locales/${code}.json (${Object.keys(locale.lexicon).length} mot(s), ${Object.keys(locale.ui).length} menu(s))`);
  }
}

// ---------- Fabrication du paquet hors-ligne ----------
function buildBundle() {
  const files = fs.readdirSync(LOCALES_DIR).filter((f) => f.endsWith('.json')).sort();
  if (!files.length) throw new Error('aucun locales/*.json : lancez d’abord « node tools/build-locales.mjs --migrate »');
  const locales = {};
  const meta = {};
  for (const file of files) {
    const locale = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8'));
    locales[locale.code] = {
      ui: locale.ui || {},
      categories: locale.categories || [],
      lexicon: locale.lexicon || {},
      ...(locale.lexiconSource ? { lexiconSource: locale.lexiconSource } : {}),
      // v10.24 : la darija s'affiche en lettres arabes ; les lettres latines restent disponibles si le
      // parent les préfère (Réglages parent → Écriture darija). Ces deux tables ne concernent qu'elle.
      ...(locale.uiLatin ? { uiLatin: locale.uiLatin } : {}),
      ...(locale.categoriesLatin ? { categoriesLatin: locale.categoriesLatin } : {}),
    };
    meta[locale.code] = {
      code: locale.code, name: locale.name, short: locale.short, tts: locale.tts,
      rtl: Boolean(locale.rtl), ...(locale.amazigh ? { amazigh: true } : {}),
    };
  }
  const out = `// v10.21 — Généré par tools/build-locales.mjs. Ne pas modifier à la main.
// Source de vérité : locales/<lang>.json (une langue = un fichier). Chargé hors-ligne, sans fetch.
export const LOCALE_META = ${JSON.stringify(meta, null, 2)};

export const LOCALES = ${JSON.stringify(locales, null, 2)};
`;
  fs.writeFileSync(BUNDLE, out, 'utf8');
  console.log(`✅ modules/locales-data.js (${Object.keys(locales).length} langues, ${(out.length / 1024).toFixed(0)} Ko)`);
}

const main = async () => {
  if (process.argv.includes('--migrate')) await migrate();
  buildBundle();
};
main().catch((err) => { console.error('❌', err.message || err); process.exit(1); });
