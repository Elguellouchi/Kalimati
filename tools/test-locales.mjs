// v10.21 — Lot 1 : contrôle des fichiers locales/<lang>.json et du paquet modules/locales-data.js.
// Usage : node tools/test-locales.mjs
// Vérifie : le paquet correspond aux fichiers ; chaque carte de départ (hors cartes personnelles) a
// un mot dans chacune des 10 langues traduites ; les menus ont les mêmes clés ; aucune trace de la
// table française « pivot » ne subsiste dans modules/languages.js.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

for (const name of ['Element', 'DocumentFragment', 'Document', 'HTMLElement']) if (!globalThis[name]) globalThis[name] = class {};
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' };

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

let failed = 0;
const check = (ok, message) => { console.log(`${ok ? '✅' : '❌'} ${message}`); if (!ok) failed += 1; };

const EXTRA = ['ar', 'en', 'es', 'de', 'it', 'pt', 'nl', 'tr', 'zh'];
const PERSONAL = new Set(['c-personnes-sibling', 'c-personnes-therapist']);

const files = fs.readdirSync(path.join(ROOT, 'locales')).filter((f) => f.endsWith('.json')).sort();
const disk = Object.fromEntries(files.map((f) => {
  const locale = JSON.parse(read(`locales/${f}`));
  return [locale.code, locale];
}));

const { LOCALES, LOCALE_META } = await load('modules/locales-data.js');
const { LANGS, isExtraLang, cardWord, cardSpeechText, categoryName, ui } = await load('modules/languages.js');
const { defaultCards } = await load('data.js');
const cards = defaultCards();

check(Object.keys(disk).length === 15, `15 fichiers locales/<lang>.json (${Object.keys(disk).length})`);
check(Object.keys(LOCALES).length === Object.keys(disk).length,
  `Le paquet charge autant de langues que de fichiers (${Object.keys(LOCALES).length})`);

const drift = Object.keys(disk).filter((code) => JSON.stringify({
  ui: disk[code].ui || {}, categories: disk[code].categories || [], lexicon: disk[code].lexicon || {},
}) !== JSON.stringify({
  ui: LOCALES[code].ui, categories: LOCALES[code].categories, lexicon: LOCALES[code].lexicon,
}));
check(!drift.length, `Paquet à jour (node tools/build-locales.mjs)${drift.length ? ` — à régénérer : ${drift.join(', ')}` : ''}`);

const sameLangs = [...LANGS.map((l) => l.code)].sort().join() === [...Object.keys(LOCALE_META)].sort().join();
check(sameLangs, 'La liste des langues correspond aux locales');
const metaDrift = LANGS.filter((l) => {
  const m = LOCALE_META[l.code];
  return !m || m.name !== l.name || m.tts !== l.tts || Boolean(m.rtl) !== Boolean(l.rtl);
});
check(!metaDrift.length, `Nom et code TTS identiques (locales ↔ affichage)${metaDrift.length ? ` — ${metaDrift.map((l) => l.code).join(', ')}` : ''}`);

// Couverture : chaque carte de départ (hors cartes personnelles) a son mot dans chaque langue traduite.
const missing = [];
for (const code of EXTRA) {
  for (const card of cards) {
    if (PERSONAL.has(card.id)) continue;
    if (!LOCALES[code].lexicon[card.id]) missing.push(`${code}:${card.id}`);
  }
}
check(!missing.length, `Lexique complet dans les 10 langues${missing.length ? ` — manque : ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}` : ''}`);

// Le mot est bien rendu par l'API de l'appli.
const pain = cards.find((c) => c.id === 'c-manger-pain');
check(cardWord(pain, 'en') === 'Bread' && cardWord(pain, 'zh') === '面包' && cardWord(pain, 'ar') === 'خبز',
  'cardWord retrouve le mot par l’identifiant technique');
check(cardWord({ id: 'c-manger-pain2', fr: 'Mot du parent' }, 'en') === 'Mot du parent',
  'Un mot sans traduction reste tel quel (jamais un faux repli)');

// Une carte renommée sur le téléphone garde sa traduction (le lien n’est plus le texte français).
check(cardWord({ id: 'c-manger-pain', fr: 'Khobz (renommé)' }, 'en') === 'Bread',
  'Renommer un mot ne casse pas sa traduction');

// v10.22 (Lot 2) : le lexique arabe porte le mot affiché (sans harakat) ET la forme vocale (Tashkeel).
const arEntries = Object.entries(LOCALES.ar.lexicon);
const shapesOk = arEntries.every(([, e]) => typeof e === 'string'
  || (e && typeof e.label === 'string' && typeof e.tts === 'string'));
check(shapesOk, 'Lexique arabe : entrées { label, tts } (ou chaîne)');
const harakat = /[\u064B-\u0652\u0670]/;
const missingTashkeel = arEntries.filter(([, e]) => !(e && typeof e === 'object' && harakat.test(e.tts))).map(([id]) => id);
check(!missingTashkeel.length,
  `Tashkeel présent sur tout le lexique arabe${missingTashkeel.length ? ` — manque : ${missingTashkeel.slice(0, 8).join(', ')}` : ''}`);
check(cardWord(pain, 'ar') === 'خبز' && cardSpeechText(pain, 'ar') === 'خُبْز',
  'Arabe : mot affiché sans harakat, prononciation vocalisée');

const categories = (await load('data.js')).CATEGORIES;
check(categories.every((c, i) => categoryName(c, 'en') === LOCALES.en.categories[i]),
  'categoryName suit l’ordre des locales');

check(ui('home', 'de') === 'Start' && ui('hello', 'zh') === '你好',
  'Les menus viennent des locales');

const frKeys = Object.keys(LOCALES.fr.ui).sort().join();
const badKeys = [...EXTRA, 'dr'].filter((code) => Object.keys(LOCALES[code].ui).sort().join() !== frKeys);
check(!badKeys.length, `Mêmes clés de menus qu’en français${badKeys.length ? ` — ${badKeys.join(', ')}` : ''}`);

const langSrc = read('modules/languages.js');
check(!/const WORDS\s*=/.test(langSrc) && !/CATEGORY_NAMES/.test(langSrc) && !/const DICT\s*=/.test(langSrc),
  'Plus de table française « pivot » dans modules/languages.js');
check(EXTRA.every((code) => isExtraLang(code)) && !isExtraLang('fr') && !isExtraLang('dr'), 'isExtraLang inchangé');

if (failed) { console.error(`\n${failed} contrôle(s) locales en échec.`); process.exit(1); }
console.log('\n🎉 Souveraineté multilingue : locales/<lang>.json et lexique par cardId vérifiés.');
