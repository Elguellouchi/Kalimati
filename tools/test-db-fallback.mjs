#!/usr/bin/env node
/**
 * Lot 1 / Tâche 4 (L1-07) : mode secours si IndexedDB se bloque.
 * Vérifie :
 *  1. avant tout incident, le mode secours est inactif et aucun bandeau n'existe ;
 *  2. enableFallbackMode() active le mode secours et prépare les cartes de départ ;
 *  3. getFallbackCards() renvoie des cartes complètes (id, libellé, catégorie, emoji, voix) placées dans la grille ;
 *  4. l'incident est consigné dans le journal (détail idb_fallback_mode, aucune donnée d'enfant) ;
 *  5. le bandeau est absent en mode enfant et présent en mode parent, sans alerte rouge ;
 *  6. app.js borne le chargement à 6 s, bascule en mode secours et continue l'interface (cadenas, barre parent, rendu) ;
 *  7. le panneau parent branche le bandeau, sw.js garde le module hors ligne et package.json lance ce test.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- Environnement DOM minimal (sans navigateur) ----------
class FakeNode {
  constructor(tag = 'div') {
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.style = { setProperty(key, value) { this[key] = String(value); } };
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.textContent = '';
    this.innerHTML = '';
    this.onclick = null;
    const self = this;
    this.classList = {
      _set() { return new Set(String(self.className || '').split(/\s+/).filter(Boolean)); },
      _sync(s) { self.className = Array.from(s).join(' '); },
      add(...cls) { const s = this._set(); cls.filter(Boolean).forEach((c) => s.add(c)); this._sync(s); },
      remove(...cls) { const s = this._set(); cls.forEach((c) => s.delete(c)); this._sync(s); },
      toggle(c, force) { const s = this._set(); const has = force !== undefined ? Boolean(force) : !s.has(c); if (has) s.add(c); else s.delete(c); this._sync(s); return has; },
      contains(c) { return this._set().has(c); },
    };
  }
  setAttribute(k, v) {
    this.attributes.set(k, String(v));
    if (k === 'class') this.className = String(v);
  }
  getAttribute(k) { return this.attributes.get(k) ?? null; }
  append(...nodes) {
    for (const n of nodes) {
      if (n === null || n === undefined || n === false) continue;
      const child = n instanceof FakeNode ? n : new FakeNode('#text');
      if (!(n instanceof FakeNode)) child.textContent = String(n);
      child.parentElement = this;
      this.children.push(child);
    }
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
    this.parentElement = null;
  }
}

// modules/util.js protège Element / DocumentFragment / Document au chargement.
globalThis.Node = FakeNode;
globalThis.Element = FakeNode;
globalThis.DocumentFragment = class DocumentFragment {};
globalThis.Document = class Document {};
globalThis.document = {
  documentElement: { dir: 'ltr' },
  body: new FakeNode('body'),
  createElement: (tag) => new FakeNode(tag),
  createTextNode: (txt) => {
    const n = new FakeNode('#text');
    n.textContent = String(txt);
    return n;
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
  getElementById: () => null,
};

const { isFallbackMode, enableFallbackMode, getFallbackCards, fallbackBannerElement } =
  await import(pathToFileURL(path.join(ROOT, 'modules/db-fallback.js')).href);
const { LOG_TYPES, clearErrorLog, getErrorLogSnapshot } =
  await import(pathToFileURL(path.join(ROOT, 'modules/error-log.js')).href);

function textOf(node) {
  if (!node) return '';
  if (node.tagName === '#TEXT') return node.textContent;
  return node.children.map(textOf).join('');
}

let passed = 0;
async function check(name, fn) {
  await fn();
  passed += 1;
  console.log(`✅ ${name}`);
}

await clearErrorLog();

await check('Avant incident : mode secours inactif, aucun bandeau', () => {
  assert.equal(isFallbackMode(), false);
  assert.equal(fallbackBannerElement(), null);
  assert.equal(fallbackBannerElement({ parent: true }), null, 'Pas de bandeau sans incident');
});

await check('enableFallbackMode() active le mode et prépare les cartes de départ', () => {
  const err = new Error('La mémoire du téléphone ne répond pas.');
  err.name = 'TimeoutError';
  enableFallbackMode(err);
  assert.equal(isFallbackMode(), true);
  const cards = getFallbackCards();
  assert.ok(Array.isArray(cards) && cards.length >= 20, 'La grille de départ doit être complète');
  assert.ok(cards.some((c) => c.id === 'c-base-je-veux'), 'Les mots essentiels sont là');
  const ids = new Set(cards.map((c) => c.id));
  assert.equal(ids.size, cards.length, 'Aucun doublon d’identifiant');
});

await check('Cartes de secours prêtes pour l’affichage et la parole', () => {
  const cards = getFallbackCards();
  for (const card of cards) {
    assert.equal(typeof card.id, 'string');
    assert.ok(card.id.startsWith('c-'));
    assert.equal(typeof card.fr, 'string', 'libellé français (label)');
    assert.ok(card.fr.length > 0);
    assert.equal(typeof card.cat, 'string');
    assert.ok(card.cat.length > 0);
    assert.equal(typeof card.emoji, 'string');
    assert.ok(card.emoji.length > 0);
    assert.equal(typeof card.dr, 'string', 'darija lisible par la voix du téléphone');
    assert.ok(card.audios && typeof card.audios === 'object', 'les voix du parent restent possibles');
    assert.ok(Number.isInteger(card.gridRow) && card.gridRow >= 1, 'place fixe en ligne');
    assert.ok(Number.isInteger(card.gridCol) && card.gridCol >= 1, 'place fixe en colonne');
  }
});

await check('Incident consigné : idb_fallback_mode, sans donnée d’enfant', () => {
  const snap = getErrorLogSnapshot();
  const entry = snap.find((e) => e.detail === 'idb_fallback_mode');
  assert.ok(entry, 'L’incident doit être dans le journal');
  assert.ok([LOG_TYPES.STORAGE_QUOTA, LOG_TYPES.JS_RUNTIME].includes(entry.type));
  assert.equal(entry.cardId, undefined, 'Aucune carte personnelle dans le journal');
  assert.doesNotMatch(JSON.stringify(entry), /c-personnes-/, 'Aucun identifiant de famille');
});

await check('Bandeau : absent en mode enfant, présent en mode parent', () => {
  assert.equal(fallbackBannerElement({ parent: false }), null);
  const el = fallbackBannerElement({ parent: true });
  assert.ok(el, 'Le bandeau doit apparaître en mode parent');
  assert.equal(el.getAttribute('id'), 'fallback-banner');
  assert.equal(el.getAttribute('role'), 'status', 'Information douce, jamais une alerte');
  assert.notEqual(el.getAttribute('role'), 'alert');
  assert.match(el.className, /fallback-banner/);
  assert.match(el.className, /note/);
  assert.match(textOf(el), /Mode secours : vos cartes reviendront au prochain démarrage\./);
});

await check('app.js : chargement borné à 6 s, mode secours puis interface complète', () => {
  const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
  assert.match(app, /from '\.\/modules\/db-fallback\.js'/);
  assert.match(app, /DB_STARTUP_TIMEOUT_MS\s*=\s*6000/);
  assert.match(app, /Promise\.race/);
  const start = app.indexOf('async function loadInitialState');
  assert.ok(start >= 0, 'Le chargement initial doit vivre dans loadInitialState()');
  const end = app.indexOf('async function init', start);
  const block = app.slice(start, end);
  assert.match(block, /await loadLevels\(\)/);
  assert.match(block, /await loadCards\(\)/);
  assert.match(app, /enableFallbackMode\(err\)/);
  assert.match(app, /state\.cards = getFallbackCards\(\)/);
  const catchAt = app.indexOf('enableFallbackMode(err)');
  const lockAt = app.indexOf('setupLock(); setupParentBar();', catchAt);
  assert.ok(lockAt > catchAt, 'L’interface continue après le mode secours');
  assert.ok(app.indexOf('renderAll();', lockAt) > lockAt, 'La grille doit être rendue');
});

await check('Panneau parent : le bandeau est branché ; sw.js et package.json suivent', () => {
  const panel = fs.readFileSync(path.join(ROOT, 'modules/backup-ui.js'), 'utf8');
  assert.match(panel, /from '\.\/db-fallback\.js'/);
  assert.match(panel, /fallbackBannerElement/);
  assert.match(panel, /state\.parent/);

  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/modules\/db-fallback\.js'/, 'sw.js doit garder db-fallback.js hors ligne');

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.match(pkg.scripts.test, /node tools\/test-db-fallback\.mjs/);
});

console.log(`\n🎉 test-db-fallback : OK (${passed} vérifications).`);
