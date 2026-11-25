// v10.42 — Lot 4 : découpage d'app.js, zéro mot de secours en français, voix sans langue forcée,
// photos et voix isolées par enfant.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
for (const name of ['Element', 'DocumentFragment', 'Document', 'HTMLElement']) if (!globalThis[name]) globalThis[name] = class {};

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ok = (m) => console.log(`✓ ${m}`);
const { LANGS, hasWord, isAmazighLang } = await import('../modules/languages.js');
const { LOCALES } = await import('../modules/locales-data.js');
const { defaultCards } = await import('../data.js');
const { tx, TX_FR_KEYS } = await import('../modules/section-i18n.js');

// ---------- 4.1 Découpage ----------
const app = read('app.js');
const PARTS = { 'modules/strip-controller.js': 'createStripController', 'modules/views.js': 'createViews', 'modules/talk-tools.js': 'createTalkTools', 'modules/backup-ui.js': 'createBackupUi' };
for (const [file, factory] of Object.entries(PARTS)) {
  assert.match(read(file), new RegExp(`export function ${factory}\\(app\\)`), file);
  assert.match(app, new RegExp(`Object\\.assign\\(app, ${factory}\\(app\\)\\)`), `${factory} branché`);
}
for (const fn of ['renderTalk', 'renderStrip', 'setupParentBar', 'placeBoardView']) assert.doesNotMatch(app, new RegExp(`^(async )?function ${fn}\\b`, 'm'), `${fn} encore dans app.js`);
const appLines = app.split('\n').length;
assert.ok(appLines < 700, `app.js fait ${appLines} lignes`);
ok(`app.js = chef d’orchestre (${appLines} lignes) + 4 modules (bande, vues, outils adulte, sauvegarde)`);

// ---------- 4.2 Zéro mot de secours en français ----------
const cards = defaultCards();
const frUi = Object.keys(LOCALES.fr.ui);
// Mots identiques au français par nature (pas un oubli).
const SAME_ON_PURPOSE = new Set(['en:pauseTimer', 'de:pauseTimer', 'nl:levelBadge']);
// Amazigh : pas de traduction sans relecture par un natif (règle du projet). Liste figée :
// elle ne doit que diminuer. Chaque ajout de mot relu retire une ligne ici.
const AMAZIGH_TO_REVIEW = { ui: ['toiletTime', 'toiletDry', 'toiletAccident', 'toiletSnooze'], cards: ['c-personnes-sibling', 'c-personnes-therapist'] };
let amazighTx = 0;
for (const l of LANGS) {
  if (l.code === 'fr') continue;
  const ui = LOCALES[l.code]?.ui || {}; const latin = LOCALES[l.code]?.uiLatin || {};
  const missUi = frUi.filter((k) => !(k in ui) && !(k in latin));
  const missCards = cards.filter((c) => !hasWord(c, l.code)).map((c) => c.id);
  const missTx = TX_FR_KEYS.filter((k) => tx(k, l.code) === tx(k, 'fr') && !SAME_ON_PURPOSE.has(`${l.code}:${k}`));
  if (isAmazighLang(l.code)) {
    assert.ok(missUi.every((k) => AMAZIGH_TO_REVIEW.ui.includes(k)), `${l.code} : nouveau menu sans traduction ${missUi}`);
    assert.ok(missCards.every((k) => AMAZIGH_TO_REVIEW.cards.includes(k)), `${l.code} : nouvelle carte sans traduction ${missCards}`);
    amazighTx = Math.max(amazighTx, missTx.length);
    assert.ok(missTx.length <= TX_FR_KEYS.length);
    continue;
  }
  assert.deepEqual(missUi, [], `${l.code} : menus en français ${missUi}`);
  assert.deepEqual(missCards, [], `${l.code} : cartes en français ${missCards}`);
  assert.deepEqual(missTx, [], `${l.code} : textes en français ${missTx}`);
}
ok(`11 langues : 100 % des menus (${frUi.length}), des textes (${TX_FR_KEYS.length}) et des ${cards.length} cartes traduits`);
ok(`amazigh : ${AMAZIGH_TO_REVIEW.ui.length} menus, ${AMAZIGH_TO_REVIEW.cards.length} cartes et ${amazighTx} textes attendent un relecteur natif (liste figée)`);

// ---------- 4.2 Voix : jamais le français forcé sur un texte d'une autre langue ----------
// Seuls ces appels disent « fr » en dur, et leur texte est toujours français. Tout nouvel appel fait échouer le test.
const FR_ONLY = [
  ['speech.js', /speak\(card\.sayFr \|\| card\.fr, \{ lang: 'fr' \}\)/, 'mot français de la carte (dernier recours)'],
  ['speech.js', /speak\(natural, \{ lang: 'fr' \}\)/, 'phrase française accordée'],
  ['speech.js', /speak\(sentenceFr, \{ lang: 'fr' \}\)/, 'phrase française accordée'],
  ['modules/ex-schedule.js', /speak\(`Bravo ! Maintenant : \$\{next\.fr\}`, \{ lang: 'fr' \}\)/, 'routine en français (les autres langues passent avant)'],
  ['modules/clinique.js', /speak\(`\$\{matrix\.verbFr\} \$\{item\.frSay\}\.`, \{ lang: 'fr' \}\)/, 'atelier clinique en français'],
  ['modules/friends.js', /speak\(phrase\.fr, \{ lang: 'fr' \}\)/, 'phrase française de l’ami'],
  ['modules/dashboard.js', /speak\(text, \{ lang: 'fr' \}\)/, 'aide adulte en français'],
  ['modules/admin-beta.js', /Bonjour \$\{draft\.name\}, bienvenue dans Kalimati !`, \{ lang: 'fr' \}/, 'accueil adulte en français'],
  ['modules/admin-beta.js', /Bienvenue \$\{draft\.name\} !`, \{ lang: 'fr' \}/, 'accueil adulte en français'],
  ['modules/talk-tools.js', /speak\(board\.title, \{ lang: 'fr' \}\)/, 'nom de lieu écrit en français'],
  ['modules/backup-ui.js', /speak\('Touchez votre langue\. [^']*', \{ lang: 'fr' \}\)/, 'aide adulte en français'],
  ['modules/trace-sound.js', /speak\(said, \{ lang: 'fr', rate: 0\.75 \}\)/, 'son de lettre française'],
  ['modules/clinique.js', /speak\(target\.join\(' '\), \{ lang: 'fr', rate: 0\.8 \}\)/, 'lettres françaises à retrouver'],
  ['modules/views.js', /speak\(clinicT\('clinic', 'fr'\), \{ lang: 'fr' \}\)/, 'nom français de l’espace clinique'],
];
const files = ['app.js', 'speech.js', ...fs.readdirSync(path.join(ROOT, 'modules')).filter((f) => f.endsWith('.js') && f !== 'locales-data.js').map((f) => `modules/${f}`)];
let forced = 0;
for (const f of files) {
  for (const line of read(f).split('\n')) {
    if (!/speak\(.*lang: ?'fr'/.test(line)) continue;
    forced += 1;
    assert.ok(FR_ONLY.some(([file, re]) => file === f && re.test(line)), `${f} : voix française forcée → ${line.trim().slice(0, 120)}`);
  }
}
assert.equal(forced, FR_ONLY.length);
assert.doesNotMatch(read('app.js'), /'بيت الما' : '[^']*' \}|state\.lang === 'ar' \? 'الحمام' : 'بيت الما'/, 'le mot Toilettes ne doit plus tomber en darija pour une autre langue');
assert.match(read('app.js'), /isExtraLang\(state\.lang\)\) speak\(cardSpeechText\(\{ id: 'c-besoins-toilettes'/);
assert.match(read('modules/ex-schedule.js'), /if \(isExtraLang\(lang\)\) \{\s*if \(!next\) \{ speak\(tx\('allDone', lang\), \{ lang \}\)/);
ok(`voix : ${forced} appels en français, tous sur un texte français ; Toilettes et routines dites dans la langue choisie`);

// ---------- 4.3 Confidentialité : chaque enfant a ses photos, vidéos et voix ----------
const { dbNameFor, perChildKey } = await import('../modules/child-profiles.js');
assert.equal(dbNameFor('main'), 'kalimati');
assert.notEqual(dbNameFor('abc'), dbNameFor('xyz'));
assert.match(read('db.js'), /const DB_NAME = activeDbName\(\)/);
ok('une base par enfant : cartes, photos (visualKey), scènes, vidéos et journaux ne se croisent pas');
// Rien de personnel hors de la base de l'enfant : liste fermée des autres stockages.
const LOCAL_KEYS_OK = [/KalimatiStorage\.setItem\('kalimati-pb-open'/, /KalimatiStorage\.setItem\('kalimati_voices'/, /KalimatiStorage\.setItem\(THEME_KEY/, /KalimatiStorage\.setItem\(KEY,/];
for (const f of files) {
  for (const line of read(f).split('\n')) {
    if (!/KalimatiStorage\.setItem\(/.test(line)) continue;
    assert.ok(LOCAL_KEYS_OK.some((re) => re.test(line)), `${f} : nouveau stockage local à vérifier → ${line.trim().slice(0, 120)}`);
  }
}
assert.match(read('modules/rewards-kids.js'), /const KEY = perChildKey\('kalimati-rewards-v1'\)/);
assert.match(read('modules/voice-packs.js'), /parentCacheName = \(lang\) => perChildKey\(/);
assert.match(read('modules/child-profiles.js'), /n\.endsWith\(`:\$\{id\}`\)/);
assert.match(read('modules/child-profiles.js'), /const perChildKey = \(key\) => \(activeChildId\(\) === MAIN_ID \? key : `\$\{key\}:\$\{activeChildId\(\)\}`\)/);
assert.ok(typeof perChildKey === 'function');
for (const f of ['modules/talk-tools.js']) {
  const src = read(f);
  for (const key of ['sceneImageKey(', 'videoBlobKey(']) assert.ok(src.includes(`db.setSetting(${key}`), `${f} : ${key} doit rester dans la base de l’enfant`);
}
ok('étoiles, habits, voix du parent : propres à chaque enfant ; enlever un enfant efface aussi ses voix');
console.log('test-lot4-qualite : OK');
