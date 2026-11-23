// Contrôles v10.17 : la mise à jour du service worker ne recharge plus la page.
// Sur iPhone, un rechargement automatique pendant l'utilisation laissait IndexedDB
// endormie (écran vide) et pouvait se répéter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSource } from './app-source.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readSource(rel); // v10.42 : « app.js » = app.js + ses modules découpés
const has = (rel, pattern, message) => assert.match(read(rel), pattern, message);
const lacks = (rel, pattern, message) => assert.doesNotMatch(read(rel), pattern, message);

// 1. Le service worker attend son tour : aucun skipWaiting à l'installation.
lacks('sw.js', /await self\.skipWaiting\(\)/, 'sw.js ne doit plus prendre la main pendant l’utilisation');
has('sw.js', /SKIP_WAITING/, 'sw.js doit accepter l’actualisation manuelle (SKIP_WAITING)');
has('sw.js', /'\.\/modules\/app-update\.js'/, 'app-update.js doit être précaché');

// 2. Aucun rechargement automatique dans l'appli.
lacks('app.js', /pending && !reloaded[\s\S]{0,120}location\.reload\(\)/, 'app.js ne doit plus se recharger au changement de visibilité');
has('app.js', /startAppUpdateWatch\(\)/, 'app.js doit démarrer la surveillance de mise à jour');
has('modules/app-update.js', /export function startAppUpdateWatch/, 'app-update.js doit exporter startAppUpdateWatch');
has('modules/app-update.js', /export function updateBox/, 'app-update.js doit exporter updateBox');
has('modules/dashboard.js', /updateBox\(\)/, 'Progrès doit proposer le bloc de mise à jour');
has('modules/app-update.js', /Mise à jour de l’application/, 'le titre du bloc de mise à jour doit exister');

// 3. Le réseau ne peut plus bloquer indéfiniment une ouverture.
has('sw.js', /Gateway Timeout/, 'le service worker doit couper une requête qui ne répond jamais');

console.log('✅ Mise à jour sans rechargement automatique (v10.17) : contrôles passés.');
