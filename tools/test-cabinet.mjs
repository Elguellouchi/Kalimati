// Contrôles de l'espace thérapeute (v10.16) : schéma de fiche pseudonymisée, agrégats du tableau
// de bord, et invariants statiques (aucun réseau, aucun nom d'enfant, stockage local, verrou adulte).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FOLLOWUP_KIND, CODE_RE, newFollowupCode, normalizeFollowup, ageBandOf, summaryOf, weatherOf,
  sectionAverages, collectiveKpis, avsRows, sparklinePaths, seriesOf,
} from '../modules/followup-schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const has = (rel, pattern, message) => assert.match(read(rel), pattern, message);
const lacks = (rel, pattern, message) => assert.doesNotMatch(read(rel), pattern, message);

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return keyOf(d); };
const TODAY = shift(0);

const baseCard = {
  kind: FOLLOWUP_KIND,
  v: 1,
  code: 'KALI-7Q4M',
  day: TODAY,
  ageBand: '7 à 9 ans',
  totals: { trials: 120, scored: 100, plus: 60, prompt: 30, minus: 10, activeDays: 12, lastDay: TODAY },
  autonomy: 60,
  goals: [
    { id: 'A.1', status: 'progress', pct: 50, count: 20 },
    { id: 'B.1', status: 'done', pct: 100, count: 15 },
  ],
  days: [
    { day: shift(-1), trials: 10, autonomy: 50 },
    { day: TODAY, trials: 12, autonomy: 66 },
  ],
  intervenants: [
    { id: 'teacher', trials: 30, autonomy: 40, days: 5 },
    { id: 'parents', trials: 50, autonomy: 70, days: 6 },
  ],
  environments: [
    { id: 'school', trials: 30, autonomy: 40, days: 5 },
    { id: 'home', trials: 50, autonomy: 70, days: 6 },
  ],
  prompts: { verbal: 12, gestuel: 3 },
  routines: { logs: 10, autonomous: 6, reminded: 4, days: 5 },
  abc: { total: 3, last30: 1 },
  ortho: { total: 8, last30: 2, mlu: 2.4 },
  atec: { day: shift(-30), total: 80, baseline: 100 },
};

// --- 1. Le code de fiche se lit sans confusion --------------------------------------
for (let i = 0; i < 25; i += 1) {
  const code = newFollowupCode();
  assert.match(code, CODE_RE, 'code KALI-XXXX attendu');
  assert.doesNotMatch(code.slice(5), /[IO01]/, 'les 4 caractères du code ne doivent contenir ni I, O, 0 ni 1');
}
assert.equal(ageBandOf('8 ans'), '7 à 9 ans');
assert.equal(ageBandOf(4), '4 à 6 ans');
assert.equal(ageBandOf(''), null);

// --- 2. La fiche est reconstruite champ par champ : rien d'inconnu ne passe ----------
const cleaned = normalizeFollowup({ ...baseCard, label: 'Surnom local', name: 'Prénom', freeText: 'photo' });
assert.equal(cleaned.label, undefined, 'le surnom local ne doit jamais entrer dans une fiche');
assert.equal(cleaned.name, undefined, 'aucun prénom accepté');
assert.equal(cleaned.freeText, undefined, 'aucun texte libre accepté');
assert.deepEqual(Object.keys(cleaned).sort(), [
  'abc', 'ageBand', 'atec', 'autonomy', 'code', 'day', 'days', 'environments', 'goals',
  'intervenants', 'kind', 'ortho', 'prompts', 'routines', 'totals', 'v',
]);
assert.throws(() => normalizeFollowup({ ...baseCard, kind: 'autre' }), /fiche Kalimati/);
assert.throws(() => normalizeFollowup({ ...baseCard, code: 'KALI-0000' }), /Code de fiche invalide/);
assert.throws(() => normalizeFollowup({ ...baseCard, day: '2026-13-40' }), /Date de fiche invalide/);
assert.throws(() => normalizeFollowup({ ...baseCard, v: 99 }), /Version de fiche/);

// Doublons de jour : la dernière valeur gagne, les jours sont triés.
const dedup = normalizeFollowup({ ...baseCard, days: [
  { day: TODAY, trials: 3, autonomy: 10 },
  { day: shift(-1), trials: 9, autonomy: 30 },
  { day: TODAY, trials: 12, autonomy: 66 },
] });
assert.deepEqual(dedup.days.map((d) => d.day), [shift(-1), TODAY]);
assert.equal(dedup.days[1].autonomy, 66);

// Valeurs hors bornes : ramenées sans casser le schéma.
const clamped = normalizeFollowup({ ...baseCard, autonomy: 999, totals: { ...baseCard.totals, scored: -4 }, routines: { logs: 5, autonomous: 8, reminded: 7, days: 3 }, atec: { day: TODAY, total: 999, baseline: null } });
assert.equal(clamped.autonomy, 100);
assert.equal(clamped.totals.scored, 0);
assert.equal(clamped.routines.autonomous, 5);
assert.equal(clamped.routines.reminded, 5);
assert.equal(clamped.atec.total, 179);

// --- 3. Agrégats du tableau de bord -------------------------------------------------
const card = cleaned;
const summary = summaryOf(card);
assert.equal(summary.autonomy, 60);
assert.equal(summary.goalsDone, 1);
assert.equal(summary.goalsWorked, 2);
assert.equal(summary.lastDay, TODAY);
assert.equal(summary.daysSince, 0);
assert.equal(weatherOf(summary).id, 'ok', '60 % reste « en progression », pas « belle dynamique »');
assert.equal(weatherOf(summary, 75).id, 'watch');
assert.equal(weatherOf({ hasData: true, autonomy: 80, daysSince: 0 }).id, 'great');
assert.equal(weatherOf({ hasData: true, autonomy: 50, daysSince: 12 }).id, 'wait');
assert.equal(weatherOf(summaryOf(null)).id, 'new');

const averages = sectionAverages(card);
assert.equal(averages.get('A').pct, 50);
assert.equal(averages.get('B').done, 1);
assert.equal(averages.get('Z'), undefined, 'une section sans objectif travaillé reste absente');

const series = seriesOf(card, 28);
assert.equal(series.length, 28);
assert.equal(series[series.length - 1].autonomy, 66);
assert.ok(series.some((entry) => entry.autonomy === null), 'les jours sans essai restent vides');

const patients = [
  { code: 'KALI-7Q4M', label: 'Patient 1', emoji: '🦊', snapshots: [card] },
  { code: 'KALI-9X2B', label: 'Patient 2', emoji: '🐨', snapshots: [] },
];
const kpis = collectiveKpis(patients);
assert.equal(kpis.patients, 2);
assert.equal(kpis.active7, 1);
assert.equal(kpis.goalsDone, 1);
assert.equal(kpis.autonomy, 60);
assert.ok(kpis.trialsWeek >= 22);

const rows = avsRows(patients);
assert.equal(rows[0].school.autonomy, 40);
assert.equal(rows[0].teacher.trials, 30);
assert.equal(rows[0].routines.autonomous, 6);
assert.equal(rows[0].prompts, 15);
assert.equal(rows[1].card, null);

const spark = sparklinePaths([null, 50, null, 80, 90], 120, 36);
assert.equal(spark.segments.length, 1, 'un trou coupe la courbe');
assert.equal(spark.dots.length, 3);
assert.ok(spark.last.x > spark.dots[0].x);
assert.equal(sparklinePaths([null, null]).dots.length, 0);

// --- 4. Invariants statiques : local, verrouillé, branché --------------------------
has('db.js', /DB_VERSION = 10/, 'db.js doit passer en version 10');
has('db.js', /createObjectStore\('followups'/, 'le store followups doit exister');
has('db.js', /export const getAllFollowups/, 'les accès au cabinet doivent exister');
has('modules/cabinet.js', /export function cabinetScreen/, 'cabinet.js doit exporter cabinetScreen');
has('modules/cabinet.js', /role: 'img'/, 'le tableau de bord doit rester lisible par les lecteurs d’écran');
has('modules/followup.js', /export function followupShareBox/, 'la boîte de partage famille doit exister');
has('modules/followup.js', /export async function buildFollowupCard/, 'la construction de fiche doit exister');
has('modules/followup.js', /CODE_RE/, 'la fiche doit valider le code du cabinet');
has('modules/followup.js', /deliverBackup/, 'l’envoi doit passer par le partage du téléphone');
has('app.js', /import \{ cabinetScreen \}/, 'app.js doit importer l’espace thérapeute');
has('app.js', /state\.space === 'cabinet'/, 'app.js doit router l’espace thérapeute');
has('app.js', /Espace thérapeute/, 'l’accueil doit proposer la tuile thérapeute');
has('modules/dashboard.js', /followupShareBox/, 'Progrès doit proposer le partage de fiche');
has('sw.js', /\.\/modules\/cabinet\.js/, 'sw.js doit précacher cabinet.js');
has('sw.js', /\.\/modules\/followup-schema\.js/, 'sw.js doit précacher le schéma de fiche');
has('style.css', /\.cab-patient/, 'le style du cabinet doit exister');
has('style.css', /\.cabinet-print/, 'le style du bilan imprimé doit exister');

for (const file of ['modules/cabinet.js', 'modules/followup.js', 'modules/followup-schema.js']) {
  lacks(file, /\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|\.supabase\.co/, `${file} ne doit jamais appeler le réseau`);
}
lacks('modules/followup.js', /profile\.(name|father|mother|sister|psy|city)/, 'aucun prénom ni ville du profil ne doit entrer dans la fiche');
lacks('modules/followup.js', /getAllCards|getAllLifeBook|life_book|recordings|getRecordingsOf/, 'la fiche ne doit lire ni cartes, ni cahier de vie, ni voix');
lacks('modules/cabinet.js', /getAllTrials|getAllAbcLogs|getAllOrthoLogs|getAllScheduleLogs|getLifeBook|recordings/, 'le cabinet ne lit que les fiches reçues, jamais les données de l’enfant');
lacks('modules/cabinet.js', /buzzer|fail-|wrong-|punish/, 'aucun style punitif dans le cabinet');
has('modules/cabinet.js', /l’espace thérapeute est réservé aux adultes/i, 'le cabinet doit être verrouillé hors mode parent');

console.log('✅ Espace thérapeute v10.16 : schéma pseudonymisé, agrégats et invariants locaux vérifiés.');
