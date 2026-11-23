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

assert.equal(isNewer({ updatedAt: 200 }, { updatedAt: 100 }), true, 'local plus récent = conservé');
assert.equal(isNewer({ updatedAt: 100 }, { updatedAt: 200 }), false, 'distant plus récent = appliqué');
assert.equal(isNewer({ updatedAt: 100 }, { updatedAt: 100 }), false, 'égalité : le distant gagne (comme avant)');
assert.equal(isNewer({}, { updatedAt: 100 }), false, 'carte locale sans date : le distant gagne');
assert.equal(isNewer({ updatedAt: 200 }, {}), true, 'distant sans date : le local daté gagne');

console.log('✅ Fusion de synchro : la modification locale la plus récente est conservée.');
