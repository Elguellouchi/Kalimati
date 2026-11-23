// Contrôles v10.18 : migration des cartes sans identifiant historique en dur,
// et absence du moindre prénom dans le code de migration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrateCards, isLegacySelfDuplicate, planPersonRename } from '../modules/card-migration.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const SELF = 'c-personnes-moi';
const NAME = 'Enfant A';
const blank = { photo: null, video: null, audios: {} };
const defaults = [
  { id: SELF, cat: 'personnes', fr: `${NAME} (Moi)`, gram: 'person', ar: 'أنا', visualKey: 'person:profil', sub: '', sayFr: '', sayAr: '', newIn: 0 },
  { id: 'c-base-nouveau', cat: 'base', fr: 'Nouveau', gram: 'social', ar: '', visualKey: null, sub: '', sayFr: '', sayAr: '', newIn: 2 },
];
const options = { defaults, selfId: SELF, firstName: NAME };

// 1. Ancien doublon « Moi » non personnalisé : retiré.
const legacy = { id: 'c-personnes-ancien', cat: 'personnes', fr: NAME, gram: 'person', ...blank };
const migrated = migrateCards([legacy], 1, options);
assert.ok(!migrated.some((card) => card.id === legacy.id), 'le doublon ancien non personnalisé doit être retiré');

// 2. Doublon personnalisé (photo) : conservé.
const personalized = { ...legacy, id: 'c-personnes-ancien-photo', photo: { blob: true } };
const kept = migrateCards([personalized], 1, options);
assert.ok(kept.some((card) => card.id === personalized.id), 'une carte personnalisée ne doit jamais être supprimée');

// 3. Carte « Moi » actuelle : conservée, libellé remplacé par celui des réglages.
const currentSelf = { id: SELF, cat: 'personnes', fr: 'Moi', gram: 'person', ...blank };
const [selfOut] = migrateCards([currentSelf], 1, options);
assert.equal(selfOut.id, SELF);
assert.equal(selfOut.fr, `${NAME} (Moi)`, 'la carte Moi actuelle garde le libellé du profil');

// 4. Autre personne non personnalisée : conservée.
const other = { id: 'c-personnes-tonton', cat: 'personnes', fr: 'Tonton', gram: 'person', ...blank };
assert.ok(migrateCards([other], 1, options).some((card) => card.id === other.id), 'une autre personne ne doit pas être confondue avec le doublon');

// 5. Profil vide : aucune suppression hasardeuse.
assert.ok(migrateCards([legacy], 1, { ...options, firstName: '' }).some((card) => card.id === legacy.id), 'sans prénom de profil, aucune carte n’est retirée');
assert.equal(isLegacySelfDuplicate(legacy, SELF, '   '), false);
assert.equal(isLegacySelfDuplicate({ ...legacy, fr: NAME.toUpperCase() }, SELF, ` ${NAME.toLowerCase()} `), true, 'la comparaison ignore casse et espaces');

// 6. Les nouvelles cartes de départ restent ajoutées.
const added = migrateCards([currentSelf], 1, options);
assert.ok(added.some((card) => card.id === 'c-base-nouveau'), 'les cartes newIn restent ajoutées');

// 7. Aucun identifiant historique de prénom dans le code client.
assert.doesNotMatch(read('app.js'), /c-personnes-(?!moi\b|sibling\b|therapist\b)[a-z0-9-]+/i, 'app.js ne doit plus contenir d’identifiant de carte avec un prénom');
assert.doesNotMatch(read('modules/card-migration.js'), /c-personnes-(?!moi\b|sibling\b|therapist\b)[a-z0-9-]+/i, 'card-migration.js doit rester neutre');

// 8. v10.20 : les cartes de famille historiques (identifiants issus de prénoms) sont reconnues par leur forme.
const legacyFamily = [
  { id: 'c-personnes-moi', cat: 'personnes', fr: 'Prénom (Moi)', visualKey: 'person:prénom' },
  { id: 'c-personnes-a', cat: 'personnes', fr: 'Prénom', sub: 'Ma sœur', visualKey: 'person:prénom-sœur' },
  { id: 'c-personnes-b', cat: 'personnes', fr: 'Autre', visualKey: 'person:autre' },
  { id: 'c-personnes-papa', cat: 'personnes', fr: 'Papa', visualKey: 'person:papa' },
];
const plan = planPersonRename(legacyFamily);
assert.equal(plan.renameVkey.get('person:prénom'), 'person:child');
assert.equal(plan.renameVkey.get('person:prénom-sœur'), 'person:sibling');
assert.equal(plan.renameVkey.get('person:autre'), 'person:therapist');
assert.equal(plan.renameCardId.get('c-personnes-a'), 'c-personnes-sibling');
assert.equal(plan.renameCardId.get('c-personnes-b'), 'c-personnes-therapist');
assert.equal(plan.renameVkey.has('person:papa'), false, 'un rôle neutre (papa) ne doit jamais être renommé');
assert.equal(plan.renameCardId.has('c-personnes-papa'), false);

// 9. Une installation déjà neutre n’est pas touchée (plan vide).
const neutralPlan = planPersonRename([
  { id: 'c-personnes-moi', cat: 'personnes', fr: 'Moi', visualKey: 'person:child' },
  { id: 'c-personnes-sibling', cat: 'personnes', fr: 'Sœur / Frère', visualKey: 'person:sibling' },
]);
assert.equal(neutralPlan.renameCardId.size, 0);
assert.equal(neutralPlan.renameVkey.size, 0);

// 10. Le code de migration et le démarrage ne contiennent aucun prénom connu (garde-fou minimal).
for (const rel of ['app.js', 'modules/card-migration.js', 'data.js', 'modules/visuals.js']) {
  assert.doesNotMatch(read(rel), /abir|ghita|hosna/i, `${rel} ne doit contenir aucun prénom de la famille`);
}

console.log('✅ Migration des cartes (v10.18 → v10.20) : identifiants neutres, sans aucun prénom dans le code.');
