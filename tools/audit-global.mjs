// Audit statique global de Kalimati (v10.15) : versions, syntaxe, imports, précache,
// CSP, secrets, données personnelles, réseau et modules cliniques.
// Usage : node tools/audit-global.mjs            (rapport + code 1 si erreur bloquante)
//         node tools/audit-global.mjs --verbose  (détail fichier par fichier)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERBOSE = process.argv.includes('--verbose');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  .flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) return [];
    return entry.isDirectory() ? walk(rel) : [rel];
  });

const errors = [];
const warnings = [];
const ok = [];
const pass = (message) => { ok.push(message); if (VERBOSE) console.log(`✅ ${message}`); };
const fail = (message) => { errors.push(message); console.log(`❌ ${message}`); };
const warn = (message) => { warnings.push(message); console.log(`⚠️  ${message}`); };

// ---------- 1. Version unique -------------------------------------------------------
const { APP_VERSION, CACHE_VERSION, TRIAL_CACHE_VERSION } = await import(pathToFileURL(path.join(ROOT, 'modules/version.js')).href);
const expectedCache = `kalimati-${APP_VERSION.replace(/\./g, '-')}`;
const expectedTrialCache = `kalimati-essai-${APP_VERSION.replace(/\./g, '-')}`;
const expectedWorkerVersion = `v${APP_VERSION.slice(1).replace(/\./g, '-')}`;
const swSource = read('sw.js');
const pkg = JSON.parse(read('package.json'));
const meta = /<meta name="kalimati-version" content="([^"]+)">/.exec(read('index.html'));
if (CACHE_VERSION !== expectedCache) fail(`CACHE_VERSION ${CACHE_VERSION} ≠ ${expectedCache}`);
else if (TRIAL_CACHE_VERSION !== expectedTrialCache) fail(`TRIAL_CACHE_VERSION ${TRIAL_CACHE_VERSION} ≠ ${expectedTrialCache}`);
else if (!swSource.includes(`const CACHE_VERSION = '${expectedWorkerVersion}'`)
  || !swSource.includes('const CACHE = TRIAL ? `kalimati-essai-${CACHE_VERSION}` : `kalimati-${CACHE_VERSION}`;')) fail('sw.js n’utilise pas les CACHE de modules/version.js');
else if (!meta || meta[1] !== APP_VERSION) fail('meta kalimati-version désalignée de index.html');
else if (!pkg.version.startsWith(APP_VERSION.replace(/^v/, ''))) fail(`package.json ${pkg.version} ≠ ${APP_VERSION}`);
else pass(`Version unique ${APP_VERSION} (cache ${CACHE_VERSION}, cache d’essai ${TRIAL_CACHE_VERSION}, index.html, package.json)`);

// ---------- 2. Syntaxe de tous les fichiers JavaScript ------------------------------
const jsFiles = [...walk('.').filter((f) => f.endsWith('.js') || f.endsWith('.mjs'))];
let badSyntax = 0;
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', path.join(ROOT, file)], { stdio: 'pipe' });
  } catch (e) {
    badSyntax += 1;
    fail(`Syntaxe invalide : ${file}\n${String(e.stderr || e.message).split('\n').slice(0, 3).join('\n')}`);
  }
}
if (!badSyntax) pass(`Syntaxe vérifiée sur ${jsFiles.length} fichiers JavaScript (node --check)`);

// ---------- 3. Imports relatifs résolus --------------------------------------------
const importRe = /(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g;
let unresolved = 0;
for (const file of ['app.js', ...walk('modules').filter((f) => f.endsWith('.js'))]) {
  const src = read(file);
  for (const m of src.matchAll(importRe)) {
    const target = path.normalize(path.join(path.dirname(path.join(ROOT, file)), m[1]));
    if (!fs.existsSync(target)) { unresolved += 1; fail(`Import introuvable : ${file} → ${m[1]}`); }
  }
}
if (!unresolved) pass('Tous les imports relatifs de app.js et modules/ résolvent vers un fichier existant');

// ---------- 4. Précache du service worker -------------------------------------------
const sw = read('sw.js');
const precache = [...sw.matchAll(/'(\.\/[^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
const missing = precache.filter((f) => !exists(f.replace(/^\.\//, '')));
if (missing.length) fail(`Fichiers précachés absents : ${missing.join(', ')}`);
else pass(`${precache.length} fichiers précachés présents sur le disque`);
for (const required of ['./modules/clinique.js', './modules/clinic-i18n.js', './modules/clinic-i18n-dr.js',
  './modules/cabinet.js', './modules/followup.js', './modules/followup-schema.js', './modules/card-migration.js']) {
  if (!sw.includes(required)) fail(`Précache incomplet : ${required}`);
}

// ---------- 5. CSP stricte ----------------------------------------------------------
const csp = (/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(read('index.html')) || [])[1] || '';
const requireCsp = (fragment, message) => { if (!csp.includes(fragment)) fail(message); };
requireCsp("script-src 'self'", 'CSP : script-src doit rester ’self’');
requireCsp("object-src 'none'", 'CSP : object-src none attendu');
requireCsp("base-uri 'self'", 'CSP : base-uri self attendu');
if (/unsafe-eval/.test(csp)) fail('CSP : unsafe-eval interdit');
if (!csp) fail('CSP absente de index.html');
if (!errors.some((e) => e.startsWith('CSP'))) pass('CSP stricte (script-src self, pas d’eval, object-src none)');

// ---------- 6. Secrets --------------------------------------------------------------
const SECRETS = [
  [/sk-(?:proj-|live-)?[A-Za-z0-9_-]{24,}/, 'clé OpenAI (sk-…)'],
  [/service_role\s*[:=]\s*['"][A-Za-z0-9._-]{20,}/i, 'clé service_role'],
  [/SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/, 'SUPABASE_SERVICE_ROLE_KEY'],
  [/eyJhbGciOi[A-Za-z0-9_-]{20,}/, 'JWT (eyJ…)'],
];
const scanned = [...jsFiles, 'index.html', 'sw.js', 'package.json'].filter((f, i, all) => all.indexOf(f) === i);
let secretHits = 0;
for (const file of scanned) {
  const src = read(file);
  for (const [re, label] of SECRETS) {
    if (re.test(src)) { secretHits += 1; fail(`Secret potentiel (${label}) dans ${file}`); }
  }
}
if (!secretHits) pass(`Aucun secret dans ${scanned.length} fichiers (OpenAI, service_role, JWT)`);

// ---------- 7. Données personnelles -------------------------------------------------
const profil = read('modules/profil.js');
if (!/name: '', age: '', father: '', mother: 'Maman', sister: '', city: '', psy: ''/.test(profil)) {
  fail('modules/profil.js doit rester neutre (aucun prénom, âge, ville dans le code)');
} else pass('Profil neutre : prénoms et âge remplis sur le téléphone, jamais dans le code');

const appFiles = jsFiles.filter((f) => !f.startsWith('./tools/') && !f.startsWith('./scripts/'));

// Une carte « c-personnes-* » est nominative dès que son identifiant n’est pas un rôle neutre connu.
const NEUTRAL_PERSON_ROLES = new Set(['moi', 'sibling', 'therapist', 'papa', 'maman', 'papi', 'mamie', 'maitresse', 'camarade']);
const nominativeIds = (dict) => Object.keys(dict || {}).filter((id) => /^c-personnes-/.test(id) && !NEUTRAL_PERSON_ROLES.has(id.slice('c-personnes-'.length)));

// v10.20 : on contrôle TOUTES les langues de voix/index.json. Le bug historique ne scannait que la section
// « fr » alors que des prénoms se cachaient dans la section « dr » (l’audit passait à vide, 12/12 trompeur).
const voiceIndex = JSON.parse(read('voix/index.json'));
const voiceHits = Object.entries(voiceIndex).flatMap(([code, dict]) => nominativeIds(dict).map((id) => `${code}:${id}`));
const amzIndexes = walk('voix').filter((f) => /-index\.json$/.test(f));
for (const file of amzIndexes) for (const id of nominativeIds(JSON.parse(read(file)))) voiceHits.push(`${file}:${id}`);
if (voiceHits.length) fail(`Fichiers de voix contenant des cartes nominatives : ${voiceHits.join(', ')}`);
else pass(`Aucune carte nominative dans voix/index.json (${Object.keys(voiceIndex).length} langues) ni dans ${amzIndexes.length} packs amazighs`);

// Aucun « visualKey person:<prénom> » dans le code : seuls les rôles neutres connus sont tolérés.
const NEUTRAL_PERSON_KEYS = new Set(['child', 'sibling', 'therapist', 'papa', 'maman', 'papi', 'mamie', 'maitresse', 'camarade', 'profil', 'compagnon']);
const badPersonKeys = appFiles.filter((f) => [...read(f).matchAll(/person:([A-Za-z0-9_-]+)/g)].some((m) => !NEUTRAL_PERSON_KEYS.has(m[1])));
if (badPersonKeys.length) fail(`visualKey « person:<prénom> » non neutre dans : ${badPersonKeys.join(', ')}`);
else pass('Aucun visualKey « person:<prénom> » : les rôles de famille restent neutres');

const namedLabel = appFiles.filter((f) => /\b[A-ZÀ-Ý][a-zà-ÿ]{2,} \(Moi\)/.test(read(f)));
if (namedLabel.length) fail(`Prénom en dur dans un libellé « Prénom (Moi) » : ${namedLabel.join(', ')}`);
else pass('Aucun libellé « Prénom (Moi) » en dur');

// Dossiers et brouillons locaux (transcripts, notes) : jamais suivis ni publiés.
const GITIGNORED = ['transcripts_autisme/', 'transcripts_autisme_chaines/', 'Transcript Vidéos/', '.mimocode/'];
const gitignore = read('.gitignore');
const notIgnored = GITIGNORED.filter((pattern) => !gitignore.includes(pattern));
if (notIgnored.length) fail(`.gitignore doit exclure du dépôt : ${notIgnored.join(', ')}`);
else pass('Journaux, transcripts et brouillons locaux exclus du dépôt (.gitignore)');

// ---------- 8. Réseau : liste blanche -------------------------------------------------
const NETWORK_ALLOWED = new Set([
  'media.js', 'modules/arasaac.js', 'modules/cloud-sync.js', 'modules/darija-lexicon.js',
  'modules/ex-next.js', 'modules/ex-online.js', 'modules/online-bank.js', 'modules/visuals.js',
  'modules/voice-packs.js', 'speech.js', 'sw.js',
]);
const network = appFiles.filter((f) => /\bfetch\s*\(/.test(read(f)));
const unexpected = network.filter((f) => !NETWORK_ALLOWED.has(f.replace(/^\.\//, '')));
if (unexpected.length) fail(`Appels réseau dans des modules non prévus : ${unexpected.join(', ')}`);
else pass(`Réseau limité à ${network.length} modules connus (banques d’images, voix, synchro opt-in, service worker)`);
for (const file of ['modules/clinique.js', 'modules/clinic-i18n.js', 'modules/clinic-i18n-dr.js',
  'modules/cabinet.js', 'modules/followup.js', 'modules/followup-schema.js']) {
  if (/\bfetch\s*\(/.test(read(file))) fail(`Module clinique avec réseau : ${file}`);
}

// ---------- 9. Modules cliniques et données locales ---------------------------------
if (!/DB_VERSION = 11/.test(read('db.js'))) fail('db.js doit être en version 11 (plan moteur inviolable)');
else pass('IndexedDB v11 avec plan moteur par taille de grille');
if (!/createObjectStore\('life_book'/.test(read('db.js'))) fail('store life_book absent');
if (!/createObjectStore\('followups'/.test(read('db.js'))) fail('store followups absent');
if (!/export function clinicHome/.test(read('modules/clinique.js'))) fail('clinique.js sans clinicHome');
if (!/state\.space === 'clinique'/.test(read('app.js'))) fail('Espace clinique non routé dans app.js');
if (!/export function cabinetScreen/.test(read('modules/cabinet.js'))) fail('cabinet.js sans cabinetScreen');
if (!/state\.space === 'cabinet'/.test(read('app.js'))) fail('Espace thérapeute non routé dans app.js');
if (!errors.length) pass('Ateliers cliniques et espace thérapeute branchés, 100 % locaux');

// ---------- Rapport ----------------------------------------------------------------
console.log(`\nAudit Kalimati ${APP_VERSION} : ${ok.length} contrôle(s) passés, ${warnings.length} avertissement(s), ${errors.length} erreur(s).`);
if (errors.length) {
  console.error('\nErreurs bloquantes :');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}
console.log('🎉 Aucune erreur bloquante.');
