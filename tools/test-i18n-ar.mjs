#!/usr/bin/env node
// v10.26 : en arabe, les écrans Jeux, Ma journée, Émotions et Ateliers ne doivent plus retomber en français.
// Vérifie que les tables arabes (section-i18n-ar.js, clinic-i18n-ar.js) couvrent le français, avec les
// mêmes variables {…}, et qu'elles sont bien écrites en lettres arabes.
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
const ph = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
const arabic = (s) => /[؀-ۿ]/.test(String(s));

const { TX_AR, GOAL_AR, SECTION_AR } = await load('modules/section-i18n-ar.js');
const { CLINIC_AR } = await load('modules/clinic-i18n-ar.js');
const { CLINIC_FR, clinicT } = await load('modules/clinic-i18n.js');
const { tx, sectionLabel, goalTitle, TX_FR_KEYS } = await load('modules/section-i18n.js');
const { SECTIONS, GOALS } = await load('modules/goals.js');

const missingTx = TX_FR_KEYS.filter((k) => !TX_AR[k]);
check(missingTx.length === 0, `Textes des espaces traduits en arabe (${TX_FR_KEYS.length - missingTx.length}/${TX_FR_KEYS.length})${missingTx.length ? ` — manque : ${missingTx.join(', ')}` : ''}`);
const badPh = TX_FR_KEYS.filter((k) => TX_AR[k] && ph(TX_AR[k]) !== ph(tx(k, 'fr')));
check(badPh.length === 0, `Mêmes variables {…} en arabe${badPh.length ? ` — à revoir : ${badPh.join(', ')}` : ''}`);

const missingClinic = Object.keys(CLINIC_FR).filter((k) => !CLINIC_AR[k]);
check(missingClinic.length === 0, `Ateliers traduits en arabe (${Object.keys(CLINIC_FR).length - missingClinic.length}/${Object.keys(CLINIC_FR).length})${missingClinic.length ? ` — manque : ${missingClinic.join(', ')}` : ''}`);
const badClinicPh = Object.keys(CLINIC_AR).filter((k) => CLINIC_FR[k] && ph(CLINIC_AR[k]) !== ph(CLINIC_FR[k]));
check(badClinicPh.length === 0, `Ateliers : mêmes variables {…}${badClinicPh.length ? ` — à revoir : ${badClinicPh.join(', ')}` : ''}`);

check(SECTIONS.every((s) => SECTION_AR[s.id]), `Les ${SECTIONS.length} domaines ont un titre arabe`);
check(GOALS.every((g) => GOAL_AR[g.id]), `Les ${GOALS.length} jeux ont un titre arabe`);
check([...Object.values(TX_AR), ...Object.values(CLINIC_AR)].filter((s) => /\p{L}/u.test(s.replace(/\{\w+\}|PEI|ABA|ABLLS-R|PECS|MITA|Time Timer|CV|AR|AL|MAR|SOL|ABAB|AABB|ABC/g, ''))).every(arabic), 'Les textes arabes sont en lettres arabes');

// Le branchement : en arabe, l'écran ne montre plus le français ; les autres langues gardent le français.
check(tx('orthoTitle', 'ar') !== tx('orthoTitle', 'fr'), `« Atelier Orthophonie » en arabe : ${tx('orthoTitle', 'ar')}`);
check(sectionLabel(SECTIONS[0], 'ar') !== SECTIONS[0].name, `Domaine A en arabe : ${sectionLabel(SECTIONS[0], 'ar')}`);
check(goalTitle(GOALS[0], 'ar') !== GOALS[0].title, 'Titre de jeu en arabe');
check(clinicT('tClinic', 'ar') !== CLINIC_FR.tClinic, `Ateliers en arabe : ${clinicT('tClinic', 'ar')}`);
check(tx('orthoTitle', 'es') === tx('orthoTitle', 'fr'), 'Espagnol : pas de traduction inventée (français en attendant)');
check(tx('orthoTitle', 'dr') !== tx('orthoTitle', 'fr'), 'La darija reste traduite');

if (failed) { console.error(`\n❌ ${failed} contrôle(s) arabe en échec.`); process.exit(1); }
console.log('🎉 Arabe standard des espaces Jeux, Ma journée, Émotions et Ateliers : contrôlé.');
