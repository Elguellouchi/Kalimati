#!/usr/bin/env node
/**
 * Vérifie que la version affichée, le cache hors-ligne et le journal d'erreurs
 * viennent bien de la même source (modules/version.js).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readSource } from './app-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readSource(rel); // v10.42 : « app.js » = app.js + ses modules découpés
const { APP_VERSION, CACHE_VERSION } = await import(pathToFileURL(path.join(ROOT, 'modules/version.js')).href);

const expectedCache = `kalimati-${APP_VERSION.replace(/\./g, '-')}`;

assert.match(APP_VERSION, /^v\d+\.\d+(\.\d+)?$/, `Version invalide : ${APP_VERSION}`);
assert.equal(CACHE_VERSION, expectedCache, `CACHE_VERSION doit valoir ${expectedCache}`);

const meta = /<meta name="kalimati-version" content="([^"]+)">/.exec(read('index.html'));
assert.ok(meta, 'meta kalimati-version absente de index.html');
assert.equal(meta[1], APP_VERSION, `index.html affiche ${meta[1]}, attendu ${APP_VERSION}`);

const sw = read('sw.js');
assert.match(sw, new RegExp(`const CACHE = '${CACHE_VERSION}'`), `sw.js n'utilise pas ${CACHE_VERSION}`);
assert.match(sw, /\.\/modules\/version\.js/, 'modules/version.js absent de la liste précachée de sw.js');

const admin = read('modules/admin-beta.js');
assert.equal(/export const APP_VERSION = 'v/.test(admin), false, 'admin-beta.js doit importer APP_VERSION, pas le redéfinir');
assert.match(read('app.js'), /import \{ APP_VERSION \} from '\.\/modules\/version\.js'/);

const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.type, 'module', 'package.json doit déclarer "type": "module"');
assert.ok(pkg.version.startsWith(APP_VERSION.replace(/^v/, '')), `package.json doit être en version ${APP_VERSION}`);

console.log(`✅ Version cohérente : ${APP_VERSION} (cache ${CACHE_VERSION}).`);
