#!/usr/bin/env node
/**
 * Non-régression de la synchro (v10.10) : une carte modifiée localement après
 * le paquet distant ne doit jamais être remplacée par ce paquet plus ancien.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

for (const name of ['Element', 'DocumentFragment', 'Document']) if (!globalThis[name]) globalThis[name] = class {};

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { isNewer } = await import(pathToFileURL(path.join(ROOT, 'modules/util.js')).href);
const { mergeCardLayout } = await import(pathToFileURL(path.join(ROOT, 'modules/grid-layout.js')).href);

assert.equal(isNewer({ updatedAt: 200 }, { updatedAt: 100 }), true, 'local plus récent = conservé');
assert.equal(isNewer({ updatedAt: 100 }, { updatedAt: 200 }), false, 'distant plus récent = appliqué');
assert.equal(isNewer({ updatedAt: 100 }, { updatedAt: 100 }), false, 'égalité : le distant gagne (comme avant)');
assert.equal(isNewer({}, { updatedAt: 100 }), false, 'carte locale sans date : le distant gagne');
assert.equal(isNewer({ updatedAt: 200 }, {}), true, 'distant sans date : le local daté gagne');

const local = {
  id: 'w-layout-local', wordId: 'w-layout-local', fr: 'Texte local',
  positions: { 2: { row: 3, col: 1 } }, gridRow: 3, gridCol: 1, order: 7,
};
const remote = {
  id: 'w-layout-local', wordId: 'w-layout-distant', fr: 'Texte distant',
  positions: { 2: { row: 9, col: 2 }, 4: { row: 8, col: 3 } },
  gridRow: 9, gridCol: 2, order: 99,
};
const merged = mergeCardLayout(local, remote);
assert.deepEqual(merged.positions, local.positions, 'aucune position distante ne remplace ni ne complète le layout local');
assert.equal(merged.wordId, local.wordId, 'le wordId local reste autoritatif');
assert.equal(merged.gridRow, local.gridRow, 'la coordonnée active locale reste exacte');
assert.equal(merged.gridCol, local.gridCol, 'la colonne active locale reste exacte');
assert.equal(merged.order, local.order, 'l’ordre local reste exact');
assert.equal(merged.fr, remote.fr, 'les autres données non protégées peuvent venir du paquet distant');

const sparseLocal = { id: 'c-layout-local', fr: 'Texte local', positions: {} };
const sparseMerged = mergeCardLayout(sparseLocal, remote);
assert.deepEqual(sparseMerged.positions, {}, 'une grille locale vide reste vide');
for (const field of ['wordId', 'gridRow', 'gridCol', 'order']) {
  assert.equal(Object.hasOwn(sparseMerged, field), false, `${field} absent localement ne doit pas être rempli`);
}

const added = mergeCardLayout({}, remote);
assert.deepEqual(added.positions, remote.positions, 'une carte entièrement nouvelle utilise son layout distant');
assert.equal(added.wordId, remote.wordId);
assert.equal(added.gridRow, remote.gridRow);
assert.equal(added.gridCol, remote.gridCol);
assert.equal(added.order, remote.order);

console.log('✅ Fusion de synchro : timestamp et layout local protégés, carte nouvelle conservée.');
