import assert from 'node:assert/strict';

globalThis.location = { pathname: '/Kalimati/essai/' };
const mem = new Map();
globalThis.localStorage = {
  getItem: (key) => mem.get(key) ?? null,
  setItem: (key, value) => mem.set(key, String(value)),
  removeItem: (key) => mem.delete(key),
};
await import('../modules/storage.js');
const profiles = await import('../modules/child-profiles.js');

assert.equal(profiles.activeDbName(), 'essai-kalimati');
const id = profiles.addChild('Profil test', '○', 1800000000000);
assert.equal(profiles.dbNameFor(id), `essai-kalimati-child-${id}`);

globalThis.indexedDB = {
  databases: async () => [
    { name: 'kalimati-child-c1111' },
    { name: `essai-kalimati-child-${id}` },
    { name: 'essai-kalimati-child-c2222' },
    { name: 'autre-kalimati-child-c3333' },
  ],
};
const recovered = await profiles.recoverChildren();
assert.deepEqual(recovered.map((child) => child.id).sort(), ['c2222', id, 'main'].sort());

const deleted = [];
const deletedCaches = [];
globalThis.caches = {
  keys: async () => [
    `kalimati-essai-amazigh-voices-parent-fr:${id}`,
    `kalimati-amazigh-voices-parent-fr:${id}`,
    'autre-cache',
  ],
  delete: async (name) => { deletedCaches.push(name); return true; },
};
globalThis.indexedDB.deleteDatabase = (name) => {
  deleted.push(name);
  return { set onsuccess(fn) { fn(); }, set onerror(fn) { fn(); }, set onblocked(fn) { fn(); } };
};
profiles.setActiveChild('main');
assert.equal(await profiles.removeChild(id), true);
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(deleted, [`essai-kalimati-child-${id}`]);
assert.deepEqual(deletedCaches, [`kalimati-essai-amazigh-voices-parent-fr:${id}`]);
console.log('test-children-trial : OK');
