// Contrôles du lot v10.23 : moteur tactile central (Sprint 1), barre de mots rapides toujours visible
// (pépite 2), deux langues sur la même grille (pépite 1), quadrillage des émotions + coping (pépites 6 et 4).
// Les modules de l'écran touchent le DOM : comme dans test-clinique.mjs, la vérification est statique,
// sauf pour les données pures (quadrants, stratégies) extraites des fichiers et recoupées ici.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const has = (rel, pattern, message) => assert.match(read(rel), pattern, message);
const lacks = (rel, pattern, message) => assert.doesNotMatch(read(rel), pattern, message);

// --- 1. Sprint 1 : un seul moteur tactile, utilisé partout où l'enfant pose un mot -----------------
const engine = read('modules/tap-engine.js');
has('modules/tap-engine.js', /export const TAP_COOLDOWN_MS = 400/, 'le filtre anti-rebond central est de 400 ms');
has('modules/tap-engine.js', /export function acceptTap/, 'acceptTap doit être exposé');
has('modules/tap-engine.js', /export function bindTap/, 'bindTap doit être exposé');
has('modules/tap-engine.js', /export function tapFeedback/, 'tapFeedback doit être exposé');
has('modules/tap-engine.js', /touchAllowed\(pressMs\)/, 'le moteur applique le toucher adapté du parent');
has('modules/tap-engine.js', /movedPx > TREMOR_PX/, 'le moteur applique l’anti-tremblement du parent');
has('modules/tap-engine.js', /import \{ trackPress, touchAllowed, steadyHandEnabled, TREMOR_PX \} from '\.\/aac-plus\.js'/, 'le moteur réutilise les réglages d’aac-plus.js');
// Le moteur est précaché, sinon la barre tactile manque hors-ligne.
has('sw.js', /\.\/modules\/tap-engine\.js/, 'sw.js doit précacher le moteur tactile');
// Une seule implémentation : l'ancien filtre copié-collé dans app.js a disparu.
const appSrc = read('app.js');
lacks('app.js', /SAME_CARD_COOLDOWN_MS/, 'app.js ne doit plus avoir son propre filtre anti-rebond');
has('app.js', /const tappableCard = \(card, options = \{\}\) =>/, 'app.js doit avoir une seule fabrique de cartes touchables');
assert.ok((appSrc.match(/tappable(?:Card\(|\()/g) || []).length >= 4, 'grille, suggestions, départs et barre rapide partagent la même fabrique');

// --- 2. Pépite 2 : les mots essentiels restent à l'écran, et ne vident jamais la phrase ------------
has('app.js', /class: 'talk-rail'/, 'la barre des mots rapides doit exister');
has('app.js', /rail = state\.parent \? null : h\('div'/, 'la barre est pour l’enfant, pas pour le mode parent');
lacks('app.js', /class: 'talk-quick'/, 'l’ancienne rangée cachée tant que la phrase est vide doit avoir disparu');
has('app.js', /railChip\('⏳', 'quickWait'/, 'la barre doit laisser dire « Attends » sans toucher à la phrase');
has('app.js', /railChip\('🙈', 'quickOups'/, 'la barre doit laisser dire « Oups » sans toucher à la phrase');
has('style.css', /\.talk-rail \{[^}]*position: sticky/, 'la barre doit rester visible pendant le défilement');
// Vérifié dans un navigateur à 390 px : si tout défile sur une ligne, « Oups » sort de l'écran.
const railSrc = appSrc.slice(appSrc.indexOf("class: 'talk-rail'"));
assert.ok(railSrc.indexOf('rail-help') < railSrc.indexOf('rail-cards'), 'les trois aides sont posées avant les cartes qui peuvent défiler');
has('style.css', /\.rail-cards \{[^}]*overflow-x: auto/, 'les cartes rapides seules peuvent défiler');
lacks('style.css', /\.rail-help \{[^}]*overflow/, 'les mots qui réparent ne défilent jamais hors écran');
has('modules/clinic-i18n.js', /quickOups: 'Oups, je me suis trompé ! 🙈'/, 'le mot qui répare doit être en français');
has('modules/clinic-i18n-dr.js', /'quickOups': '.*🙈'/, 'le mot qui répare doit être en darija');
// Un toucher d’aide ne doit jamais effacer ce que l’enfant a déjà posé.
has('app.js', /const sayPill = \(key, fr\) => \{\s*unlockAudio\(\); stopSpeaking\(\);/, 'les pastilles d’aide parlent sans vider la phrase');

// --- 3. Pépite 1 : deux langues affichées, une bascule, et surtout aucune carte qui bouge ---------
has('modules/twin-language.js', /export const TWIN_SETTING_KEY = 'twinLang'/, 'le binôme de langues a sa clé de réglage');
has('modules/twin-language.js', /if \(!saved \|\| !saved\.a \|\| !saved\.b \|\| a === b\) return null/, 'un binôme invalide ou identique est rejeté');
has('modules/twin-language.js', /export const twinOf = \(twin, lang\) =>/, 'l’autre langue du binôme doit être résolue');
has('modules/twin-language.js', /export const suggestPartner = \(lang\) =>/, 'la seconde langue doit être proposée d’office');
has('modules/twin-language.js', /gridRow|gridCol/, 'le module doit rappeler que les places sont fixes');
has('app.js', /'lang', 'twinLang', 'cols'/, 'le binôme part dans la sauvegarde simple');
has('app.js', /state\.twin = await loadTwin\(\)/, 'l’ouverture relit le binôme choisi');
has('index.html', /id="btn-twin"/, 'la bascule de langue doit être dans la bande de phrase');
has('app.js', /twinBtn\.onclick = \(\) => \{ const next = twinSwap/, 'un seul toucher doit basculer de langue');
has('app.js', /class: 'twin-label'/, 'les cartes doivent montrer les deux mots');
has('style.css', /\.card \.twin-label/, 'les deux mots doivent être lisibles sur la carte');
// Le plan moteur ne dépend que de l'id de la carte : changer de langue ne réécrit aucune position.
has('app.js', /el\.style\.gridRow = String\(card\.gridRow\);\s*el\.style\.gridColumn = String\(card\.gridCol\);/, 'la grille pose les cases depuis la carte elle-même');
lacks('modules/twin-language.js', /grid-layout\.js|assignPositions|relayout/, 'la langue jumelle ne doit jamais relancer une disposition');
lacks('app.js', /state\.twin[^;]*=>[^;]*relayout/, 'changer de binôme ne doit pas redistribuer les cartes');

// --- 4. Pépites 6 et 4 : quadrillage 2×2 + stratégies liées à ce que l'enfant ressent -------------
const mood = read('modules/mood-meter.js');
const emotionIds = [...read('modules/visuals.js').matchAll(/^  \{ id: '(\w+)', fr: (?:'[^']*'|"[^"]*"), ask:/gm)].map((m) => m[1]);
assert.equal(emotionIds.length, 8, `8 émotions attendues dans visuals.js (${emotionIds.length})`);
const quadrants = [...mood.matchAll(/key: '(\w+)', emotions: \[([^\]]*)\]/g)]
  .map((m) => ({ key: m[1], emotions: m[2].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean) }));
assert.equal(quadrants.length, 4, 'le quadrillage doit avoir ses 4 cases (jaune, rouge, vert, bleu)');
const placed = quadrants.flatMap((q) => q.emotions);
assert.deepEqual([...placed].sort(), [...emotionIds].sort(), 'chaque émotion a une seule case dans le quadrillage');
const schedule = read('modules/ex-schedule.js');
has('modules/ex-schedule.js', /export const COPING_CHOICES/, 'les stratégies de calme doivent être partagées');
const copingZones = [...schedule.matchAll(/^\s*\['.*', '.*', '.*', '.*', '\w+', \[([^\]]*)\]\]/gm)].map((m) => m[1]);
assert.equal(copingZones.length, 6, `chaque stratégie doit dire où elle aide (${copingZones.length}/6)`);
for (const quadrant of ['yellow', 'red', 'green', 'blue']) {
  const helped = copingZones.filter((zones) => zones.includes(`'${quadrant}'`)).length;
  assert.ok(helped >= 2, `la case ${quadrant} doit proposer au moins 2 stratégies (${helped})`);
}
has('modules/ex-schedule.js', /export const COPING_CHOICES \[?/, 'le tableau d’attente garde ses stratégies');
has('modules/ex-emotions.js', /moodMeterView\(ctx/, 'le studio des émotions doit ouvrir le quadrillage');
has('sw.js', /\.\/modules\/mood-meter\.js/, 'sw.js doit précacher le quadrillage des émotions');
// Le studio ne note rien : pas d'essai ABA, pas d'étoile dans ce parcours.
lacks('modules/mood-meter.js', /recordTrial|addStar|recordGoal/, 'le quadrillage des émotions ne doit rien noter ni rien récompenser');
lacks('modules/mood-meter.js', /fetch\(|supabase|api\./, 'le quadrillage des émotions ne doit rien envoyer sur internet');

// --- 5. Les nouveaux textes enfant sont traduits dans les deux langues de l'enfant ----------------
const MOOD_KEYS = ['moodTitle', 'moodAsk', 'moodAxes', 'moodYellow', 'moodRed', 'moodGreen', 'moodBlue', 'moodCoping', 'moodChosen', 'moodBack', 'moodNote'];
for (const key of MOOD_KEYS) {
  has('modules/section-i18n.js', new RegExp(`^\\s+${key}: `, 'm'), `le texte « ${key} » doit exister en français`);
  has('modules/section-i18n-dr.js', new RegExp(`^\\s+'${key}': `, 'm'), `le texte « ${key} » doit exister en darija`);
}
const usedTx = new Set([...mood.matchAll(/tx\('(\w+)', lang/g)].map((m) => m[1]));
assert.equal(usedTx.size, 7, `les phrases du quadrillage passent par les textes traduits (${[...usedTx].join(', ')})`);
has('modules/mood-meter.js', /tx\(quadrant\.key, lang\)/, 'le nom de chaque case est traduit');
for (const key of [...usedTx, 'moodYellow', 'moodRed', 'moodGreen', 'moodBlue']) {
  assert.ok(MOOD_KEYS.includes(key), `« ${key} » est un texte de l’enfant, il doit être dans la liste du lot`);
}

console.log('🎉 Lot v10.23 : moteur tactile central, barre de mots rapides, deux langues sur la même grille, quadrillage des émotions — contrôlé.');
