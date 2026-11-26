#!/usr/bin/env node
/**
 * Lot 1 / Tâche 2 (L1-03) : rappel de sauvegarde si 14 jours ou plus (jamais en mode enfant).
 * Vérifie :
 *  1. aucun rappel n'est construit sans le mode parent (mode enfant) ;
 *  2. rappel présent quand aucune sauvegarde n'existe (lastBackupAt null) ;
 *  3. rappel présent quand la dernière sauvegarde a 14 jours ou plus (bord 14 inclus) ;
 *  4. rappel absent quand la dernière sauvegarde a moins de 14 jours ;
 *  5. le bouton « Faire une sauvegarde maintenant » déclenche bien l'export ;
 *  6. le panneau parent branche le rappel sur #export et le service worker garde le module hors ligne.
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
    this.style = {};
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

// modules/util.js protège Element / DocumentFragment / Document.prototype au chargement.
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

const { backupAgeDays, backupReminderNeeded, backupReminderElement, BACKUP_REMIND_DAYS } =
  await import(pathToFileURL(path.join(ROOT, 'modules/backup-reminder.js')).href);

const DAY = 86400000;
const NOW = Date.UTC(2026, 10, 26, 12, 0, 0); // date fixe : résultats stables

function textOf(node) {
  if (!node) return '';
  if (node.tagName === '#TEXT') return node.textContent;
  return node.children.map(textOf).join('');
}
function findButton(node) {
  return node.children.find((child) => child.tagName === 'BUTTON') || null;
}

let passed = 0;
function check(name, fn) {
  fn();
  passed += 1;
  console.log(`✅ ${name}`);
}

check('Constante : rappel à partir de 14 jours', () => {
  assert.equal(BACKUP_REMIND_DAYS, 14);
  assert.equal(backupReminderNeeded(null), true);
  assert.equal(backupReminderNeeded(13), false);
  assert.equal(backupReminderNeeded(14), true);
  assert.equal(backupReminderNeeded(15), true);
});

check('Age : null quand jamais sauvegardé, jours entiers sinon', () => {
  assert.equal(backupAgeDays(null, NOW), null);
  assert.equal(backupAgeDays(NOW - 15 * DAY, NOW), 15);
  assert.equal(backupAgeDays(NOW - 14 * DAY, NOW), 14);
  assert.equal(backupAgeDays(NOW - 13 * DAY, NOW), 13);
});

check('Mode enfant : aucun rappel, même sans sauvegarde', () => {
  assert.equal(backupReminderElement({ days: null, parent: false, onBackup: () => {} }), null);
  assert.equal(backupReminderElement({ days: 30, parent: false, onBackup: () => {} }), null);
});

check('Jamais sauvegardé (mode parent) : rappel visible avec bouton', () => {
  let calls = 0;
  const el = backupReminderElement({ days: null, parent: true, onBackup: () => { calls += 1; } });
  assert.ok(el, 'Le rappel doit apparaître');
  assert.equal(el.getAttribute('id'), 'backup-reminder', 'élément distinct de #backup-age');
  assert.equal(el.getAttribute('role'), 'alert');
  assert.match(el.className, /backup-reminder/);
  assert.match(textOf(el), /Aucune sauvegarde sur ce téléphone/);
  const button = findButton(el);
  assert.ok(button, 'Le bouton de sauvegarde doit être présent');
  assert.match(textOf(button), /Faire une sauvegarde maintenant/);
  assert.equal(calls, 0, 'Aucun export avant le toucher');
  button.onclick();
  assert.equal(calls, 1, 'Le bouton déclenche l’export une fois');
});

check('Sauvegarde de 15 jours (mode parent) : rappel visible', () => {
  const days = backupAgeDays(NOW - 15 * DAY, NOW);
  const el = backupReminderElement({ days, parent: true, onBackup: () => {} });
  assert.ok(el, 'Le rappel doit apparaître après 14 jours');
  assert.match(textOf(el), /Dernière sauvegarde il y a 15 jours/);
});

check('Bord exact de 14 jours : rappel visible', () => {
  const days = backupAgeDays(NOW - 14 * DAY, NOW);
  const el = backupReminderElement({ days, parent: true, onBackup: () => {} });
  assert.ok(el, 'À 14 jours, le rappel doit apparaître');
  assert.match(textOf(el), /14 jours/);
});

check('Sauvegarde de moins de 14 jours : aucun rappel', () => {
  const days = backupAgeDays(NOW - 13 * DAY, NOW);
  assert.equal(backupReminderElement({ days, parent: true, onBackup: () => {} }), null);
  assert.equal(backupReminderElement({ days: 0, parent: true, onBackup: () => {} }), null);
});

check('Le bouton déclenche la logique d’export (équivalent à un clic sur #export)', () => {
  let calls = 0;
  const el = backupReminderElement({ days: 20, parent: true, onBackup: () => { calls += 1; } });
  const button = findButton(el);
  assert.ok(button);
  button.onclick();
  button.onclick();
  assert.equal(calls, 2, 'Chaque toucher appelle l’export');
});

check('Branchement : panneau parent -> #export, et module gardé hors ligne', () => {
  const panel = fs.readFileSync(path.join(ROOT, 'modules/backup-ui.js'), 'utf8');
  assert.match(panel, /refreshBackupReminder/, 'backup-ui.js doit rafraîchir le rappel');
  assert.match(panel, /backupReminderElement/, 'backup-ui.js doit construire le rappel');
  assert.match(panel, /onBackup: \(\) => exportBtn\.click\(\)/, 'Le bouton doit équivaloir à #export');
  assert.match(panel, /state\.parent/, 'Le rappel ne doit apparaître qu’en mode parent');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.match(sw, /'\.\/modules\/backup-reminder\.js'/, 'sw.js doit mettre backup-reminder.js en cache');
});

console.log(`\n🎉 test-backup-remind : OK (${passed} vérifications).`);
