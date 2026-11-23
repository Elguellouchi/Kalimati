#!/usr/bin/env node
// v10.28 : en anglais, espagnol, allemand, italien, portugais, néerlandais, turc et chinois, les écrans
// Jeux, Ma journée, Émotions et Ateliers ne retombent plus en français. Les tables viennent de
// tools/gen-world-i18n.mjs (OpenAI, lancé sur le PC) : on vérifie qu'elles couvrent tout le français,
// avec les mêmes variables {…} ({s} peut disparaître) et dans la bonne écriture.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

for (const name of ['Element', 'DocumentFragment', 'Document', 'HTMLElement']) if (!globalThis[name]) globalThis[name] = class {};
if (!globalThis.navigator) globalThis.navigator = { userAgent: 'node' };
if (!globalThis.window) globalThis.window = globalThis;
if (!globalThis.localStorage) globalThis.localStorage = { getItem: () => null, setItem: () => {} };

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

let failed = 0;
const check = (ok, message) => { console.log(`${ok ? '✅' : '❌'} ${message}`); if (!ok) failed += 1; };
const ph = (s) => (String(s).match(/\{\w+\}/g) || []).filter((v) => v !== '{s}').sort().join(',');

const { CLINIC_FR, clinicT } = await load('modules/clinic-i18n.js');
const { tx, sectionLabel, goalTitle, TX_FR_KEYS } = await load('modules/section-i18n.js');
const { SECTIONS, GOALS } = await load('modules/goals.js');

const WORLD = ['en', 'es', 'de', 'it', 'pt', 'nl', 'tr', 'zh'];
for (const lang of WORLD) {
  const S = lang.toUpperCase();
  const m = await load(`modules/i18n-${lang}.js`);
  const TXL = m[`TX_${S}`] || {};
  const CL = m[`CLINIC_${S}`] || {};
  const missing = TX_FR_KEYS.filter((k) => !TXL[k]);
  const missingC = Object.keys(CLINIC_FR).filter((k) => !CL[k]);
  const badPh = [...TX_FR_KEYS.filter((k) => TXL[k] && ph(TXL[k]) !== ph(tx(k, 'fr'))), ...Object.keys(CL).filter((k) => CLINIC_FR[k] && ph(CL[k]) !== ph(CLINIC_FR[k]))];
  const all = [...Object.values(TXL), ...Object.values(CL), ...Object.values(m[`GOAL_${S}`] || {})];
  const script = lang === 'zh'
    ? all.filter((s) => /\p{L}{2,}/u.test(s.replace(/\{\w+\}|PEI|ABA|ABLLS-R|PECS|OK Stop|Time Timer|Kalimati|[A-Z]{1,5}\b/g, ''))).filter((s) => !/\p{Script=Han}/u.test(s)).length
    : all.filter((s) => /[؀-ۿ]|\p{Script=Han}/u.test(s)).length;
  check(!missing.length && !missingC.length && SECTIONS.every((s) => m[`SECTION_${S}`]?.[s.id]) && GOALS.every((g) => m[`GOAL_${S}`]?.[g.id]),
    `${lang} : ${TX_FR_KEYS.length - missing.length}/${TX_FR_KEYS.length} textes, ${Object.keys(CLINIC_FR).length - missingC.length}/${Object.keys(CLINIC_FR).length} ateliers, domaines et jeux${missing.length || missingC.length ? ` — manque : ${[...missing, ...missingC].slice(0, 8).join(', ')}` : ''}`);
  check(!badPh.length, `${lang} : mêmes variables {…}${badPh.length ? ` — à revoir : ${badPh.join(', ')}` : ''}`);
  check(!script, `${lang} : bonne écriture${script ? ` (${script} valeur(s) à revoir)` : ''}`);
  check(tx('orthoTitle', lang) !== tx('orthoTitle', 'fr') && clinicT('tClinic', lang) !== CLINIC_FR.tClinic && sectionLabel(SECTIONS[0], lang) !== SECTIONS[0].name && goalTitle(GOALS[0], lang) !== GOALS[0].title,
    `${lang} : l'écran n'affiche plus le français (${tx('orthoTitle', lang)})`);
}

if (failed) { console.error(`\n❌ ${failed} contrôle(s) langues du monde en échec.`); process.exit(1); }
console.log('🎉 Langues du monde des espaces Jeux, Ma journée, Émotions et Ateliers : contrôlées.');
