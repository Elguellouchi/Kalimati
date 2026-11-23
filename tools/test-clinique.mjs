// Contrôles de l'espace Ateliers cliniques (v10.15) et des invariants MIND Institute :
// aucun réseau dans les ateliers, aucune donnée d'enfant, planning annulé/rétabli,
// cœur CAA renforcé (anti-tremblement, Explorer, recherche, questions, écho).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const has = (rel, pattern, message) => assert.match(read(rel), pattern, message);
const lacks = (rel, pattern, message) => assert.doesNotMatch(read(rel), pattern, message);

// --- 1. L'espace clinique est un vrai module, branché dans app.js et précaché --------
// (analyse statique : clinique.js utilise le DOM, il ne s'importe pas sous Node.)
has('modules/clinique.js', /export function clinicHome/, 'clinique.js doit exporter clinicHome');
has('modules/clinique.js', /export function closeClinic/, 'clinique.js doit exporter closeClinic');
has('app.js', /import \{ clinicHome, closeClinic \} from '\.\/modules\/clinique\.js'/, 'app.js doit brancher les Ateliers cliniques');
has('app.js', /state\.space === 'clinique'/, 'app.js doit router l’espace clinique');
has('sw.js', /\.\/modules\/clinique\.js/, 'sw.js doit précacher clinique.js');
has('sw.js', /\.\/modules\/clinic-i18n-dr\.js/, 'sw.js doit précacher la darija des ateliers');

// --- 2. Aucun réseau et aucun texte personnel dans les ateliers --------------------
const CLINIC_FILES = ['modules/clinique.js', 'modules/clinic-i18n.js', 'modules/clinic-i18n-dr.js'];
for (const file of CLINIC_FILES) {
  lacks(file, /\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|\.supabase\.co/, `${file} ne doit jamais appeler le réseau`);
}

// --- 3. Les 8 ateliers et le cahier de vie local ------------------------------------
for (const key of ['daily', 'verbs', 'stop', 'signs', 'life', 'pain', 'draw', 'urgent']) {
  has('modules/clinique.js', new RegExp(`${key}: \\(\\) =>`), `atelier manquant : ${key}`);
}
has('modules/clinique.js', /MATRICES/, 'les matrices Verbe + 3 compléments doivent exister');
has('modules/clinique.js', /startListening/, 'la séance du jour doit écouter la voix localement');
has('db.js', /DB_VERSION = 10/, 'db.js doit être en version 10 (life_book + followups)');
has('db.js', /createObjectStore\('life_book'/, 'le store life_book doit être créé');
has('db.js', /putLifeBook|getAllLifeBook/, 'les accès au cahier de vie doivent exister');
lacks('db.js', /life_book[\s\S]{0,200}?sync/i, 'le cahier de vie ne doit jamais être synchronisé');

// --- 4. Planning : étape annulée gardée, rétablie par le parent (pépite 31) ---------
has('modules/ex-schedule.js', /annulled: true/, 'ex-schedule doit marquer les étapes annulées');
has('modules/ex-schedule.js', /function restoreStep|const restoreStep/, 'ex-schedule doit pouvoir rétablir une étape');
has('modules/ex-schedule.js', /const active = steps\.filter\(\(s\) => !s\.annulled\)/, 'la progression doit ignorer les étapes annulées');
has('modules/section-i18n.js', /annulled:/, 'le libellé « Annulé » doit être traduit');
has('modules/section-i18n.js', /restoreStep:/, 'le libellé « Rétablir » doit être traduit');
has('style.css', /\.sched-row\.annulled/, 'le style de l’étape annulée doit exister');

// --- 5. Cœur CAA : pépite 21 (anti-tremblement) -------------------------------------
has('modules/aac-plus.js', /export const TREMOR_PX = 14/, 'seuil anti-tremblement de 14 px attendu');
has('modules/aac-plus.js', /_movedPx/, 'trackPress doit mesurer le glissement du doigt');
has('modules/aac-plus.js', /steadyHandEnabled/, 'le réglage anti-tremblement doit être exposé');
has('app.js', /_movedPx > TREMOR_PX/, 'app.js doit ignorer une carte touchée après un glissement');
has('modules/aac-plus.js', /echoPracticeEnabled/, 'le mode écho doit être exposé');

// --- 6. Cœur CAA : pépites 11, 16, 17, 23, 29 --------------------------------------
has('app.js', /quick-pills/, 'les pastilles d’interruption doivent exister');
has('app.js', /ask-pills/, 'les questions de l’adulte doivent exister');
has('app.js', /clinic-search-input/, 'la recherche parent doit exister');
has('app.js', /flashSearch/, 'le chemin lumineux onglet → carte doit exister');
has('app.js', /toggleExplore/, 'l’Explorer 30 s doit exister');
has('app.js', /showEchoCue/, 'le mode écho « À toi ! » doit exister');
has('app.js', /data-card-id|dataset\.cardId/, 'les cartes doivent porter leur identifiant pour la recherche');
has('style.css', /\.echo-cue/, 'le style du mode écho doit exister');
has('style.css', /\.search-flash/, 'le style du chemin lumineux doit exister');

// --- 6 bis. Page Parler v10.19 : départs, catégories illustrées et conjugaison visible ----
has('app.js', /talk-start/, 'les grands mots de départ doivent exister');
has('app.js', /talk-cats/, 'les grandes tuiles de catégories doivent exister');
has('app.js', /coach-tense/, 'le coach de conjugaison (Hier / Maintenant / Après) doit exister');
has('app.js', /card-tense/, 'la forme conjuguée doit apparaître sur les verbes');
has('app.js', /talk-adult/, 'les outils adulte doivent être repliés dans un seul panneau');
has('app.js', /J'\$1/, "la forme conjuguée doit lier « Je ai » en « J'ai »");
has('style.css', /\.talk-start/, 'le style des grands départs doit exister');
has('style.css', /\.talk-cats/, 'le style des tuiles de catégories doit exister');
has('style.css', /\.coach-tense/, 'le style du coach de conjugaison doit exister');
has('style.css', /\.card-tense/, 'le style de la forme conjuguée doit exister');

// --- 7. Invariants cliniques : pas de punition, aide avant l'erreur -----------------
lacks('modules/clinique.js', /buzzer|fail-|wrong-/, 'aucun son ni style punitif dans les ateliers');
has('modules/widgets.js', /choiceBoard/, 'le moteur sans échec reste la base des jeux');

console.log('✅ Ateliers cliniques, planning annulé, cœur CAA v10.15 et page Parler v10.19 : contrôles passés.');
