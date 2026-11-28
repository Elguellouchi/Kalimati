import { test, expect } from '@playwright/test';
import { disableOfflineCache, HOME_TILE_TALK } from './support.mjs';

const FIXTURE_PATH = '/__lot4_v11_fixture.html';

const fixtureHtml = `<!doctype html>
<meta charset="utf-8">
<title>Fixture IndexedDB v11</title>
<body data-ready="no">Amorçage natif v11…
<script>
const stores = {
  cards: { keyPath: 'id', indexes: [] },
  settings: { keyPath: null, indexes: [] },
  pei_goals: { keyPath: 'id', indexes: [] },
  trials: { keyPath: 'id', indexes: ['goalId', 'day'] },
  recordings: { keyPath: 'id', indexes: ['key'] },
  visual_overrides: { keyPath: 'key', indexes: [] },
  online_cache: { keyPath: 'key', indexes: [] },
  schedule_logs: { keyPath: 'id', indexes: ['day', 'routineId', 'stepId', 'autonomy'] },
  schedule_config: { keyPath: 'id', indexes: [] },
  abc_logs: { keyPath: 'id', indexes: ['day', 'behavior', 'fn', 'place'] },
  ortho_logs: { keyPath: 'id', indexes: ['day', 'protocol', 'fn', 'phoneme'] },
  life_book: { keyPath: 'slot', indexes: [] },
  followups: { keyPath: 'code', indexes: ['updatedDay'] },
};
window.__lot4Trace = [];
const trace = (step, detail = {}) => {
  const event = { step, ...detail };
  window.__lot4Trace.push(event);
  console.log('[lot4-fixture]', JSON.stringify(event));
};
const requestResult = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const transactionDone = (transaction) => new Promise((resolve, reject) => {
  transaction.oncomplete = () => { trace('transaction-complete'); resolve(); };
  transaction.onerror = () => { trace('transaction-error', { message: String(transaction.error?.message || transaction.error) }); reject(transaction.error); };
  transaction.onabort = () => { trace('transaction-abort', { message: String(transaction.error?.message || transaction.error) }); reject(transaction.error); };
});
const openV11 = () => new Promise((resolve, reject) => {
  trace('open-v11-request');
  const request = indexedDB.open('kalimati', 11);
  request.onupgradeneeded = () => {
    trace('open-v11-upgrade', { oldVersion: request.transaction.oldVersion });
    const db = request.result;
    for (const [name, schema] of Object.entries(stores)) {
      const store = db.createObjectStore(name, schema.keyPath ? { keyPath: schema.keyPath } : undefined);
      for (const index of schema.indexes) store.createIndex(index, index);
    }
  };
  request.onblocked = () => trace('open-v11-blocked');
  request.onsuccess = () => { trace('open-v11-success', { version: request.result.version }); resolve(request.result); };
  request.onerror = () => { trace('open-v11-error', { message: String(request.error?.message || request.error) }); reject(request.error); };
});
const descriptor = async (blob) => {
  if (!blob) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return {
    type: blob.type,
    size: blob.size,
    sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
  };
};
const clean = async (value) => {
  if (value instanceof Blob) return descriptor(value);
  if (Array.isArray(value)) return Promise.all(value.map(clean));
  if (value && typeof value === 'object') {
    return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await clean(item)])));
  }
  return value ?? null;
};
window.__lot4Snapshot = async () => {
  trace('snapshot-start');
  const db = await openV11();
  const names = Object.keys(stores);
  const transaction = db.transaction(names, 'readonly');
  const reads = names.map((name) => requestResult(transaction.objectStore(name).getAll()));
  const rows = await Promise.all(reads);
  const values = Object.fromEntries(names.map((name, index) => [name, rows[index]]));
  await transactionDone(transaction);
  const settings = Object.fromEntries(values.settings.map(({ key, value }) => [key, value]));
  const snapshot = {
    version: db.version,
    stores: Array.from(db.objectStoreNames).sort(),
    cards: (await Promise.all(values.cards.map(clean))).sort((a, b) => a.id.localeCompare(b.id)),
    settings: await clean(settings),
    sentinels: await clean(Object.fromEntries(names.filter((name) => name !== 'cards' && name !== 'settings').map((name) => [name, values[name]]))),
  };
  db.close();
  trace('snapshot-complete', { cards: snapshot.cards.length });
  return snapshot;
};
(async () => {
  trace('bootstrap-start');
  try {
    const db = await openV11();
    trace('seed-open-ready', { version: db.version });
    const positionsFor = (index) => Object.fromEntries([2, 3, 4, 5].map((cols) => [String(cols), {
      row: Math.floor(index / cols) + 1,
      col: (index % cols) + 1,
    }]));
    const cards = Array.from({ length: 92 }, (_, index) => {
      const positions = positionsFor(index);
      return {
        id: 'c-migration-' + String(index).padStart(3, '0'),
        wordId: 'w-migration-' + String(index).padStart(3, '0'),
        cat: 'manger',
        fr: 'Carte neutre ' + index,
        dr: 'Carte neutre ' + index,
        ar: '',
        emoji: '🙂',
        gram: 'noun',
        sub: '',
        sayFr: '',
        sayAr: '',
        hidden: index % 17 === 0,
        order: index,
        positions,
        gridRow: positions['4'].row,
        gridCol: positions['4'].col,
        visualKey: null,
        photo: new Blob(['photo-fixture-' + index], { type: 'image/png' }),
        audios: { fr: new Blob(['voix-fixture-' + index], { type: 'audio/webm' }) },
        audioFr: null,
        audioDr: null,
      };
    });
    const familyPositions = positionsFor(92);
    cards.push({
      id: 'u-migration-famille',
      wordId: 'u-migration-famille',
      cat: 'personnes',
      fr: 'Carte familiale neutre',
      dr: 'Carte familiale neutre',
      ar: '',
      emoji: '🙂',
      gram: 'noun',
      sub: '',
      sayFr: '',
      sayAr: '',
      hidden: false,
      order: 92,
      positions: familyPositions,
      gridRow: familyPositions['4'].row,
      gridCol: familyPositions['4'].col,
      visualKey: null,
      photo: new Blob(['photo-famille-fixture'], { type: 'image/png' }),
      audios: {},
      audioFr: new Blob(['voix-fr-famille-fixture'], { type: 'audio/webm' }),
      audioDr: new Blob(['voix-dr-famille-fixture'], { type: 'audio/webm' }),
    });
    const settings = {
      cols: 4,
      lang: 'fr',
      seeded: true,
      v2migrated: true,
      v3migrated: true,
      v7migrated: true,
      v92migrated: true,
      'v10.20migrated': true,
      onlyReviewed: false,
      migrationSentinel: 'v11-conserve',
    };
    const sentinels = {
      pei_goals: { id: 'migration-sentinel', label: 'Sentinelle neutre', status: 'todo', updatedAt: null },
      trials: { id: 'migration-sentinel', goalId: 'migration-sentinel', day: '2026-11-28', result: 'exact' },
      recordings: { id: 'migration-sentinel', key: 'migration-sentinel', blob: new Blob(['audio-sentinelle'], { type: 'audio/webm' }) },
      visual_overrides: { key: 'migration-sentinel', blob: new Blob(['image-sentinelle'], { type: 'image/png' }), meta: {}, ts: 1 },
      online_cache: { key: 'migration-sentinel', pictos: [], photo: null, ts: 1 },
      schedule_logs: { id: 'migration-sentinel', day: '2026-11-28', routineId: 'migration', stepId: 'migration', autonomy: 'seule' },
      schedule_config: { id: 'migration-sentinel', label: 'Sentinelle neutre' },
      abc_logs: { id: 'migration-sentinel', day: '2026-11-28', behavior: 'migration', fn: 'migration', place: 'migration' },
      ortho_logs: { id: 'migration-sentinel', day: '2026-11-28', protocol: 'migration', fn: 'migration', phoneme: '' },
      life_book: { slot: 'migration-sentinel', day: '2026-11-28', updatedAt: 1, text: 'Sentinelle neutre' },
      followups: { code: 'migration-sentinel', label: 'Sentinelle neutre', emoji: '🙂', createdDay: '2026-11-28', updatedDay: '2026-11-28', snapshots: [] },
    };
    const transaction = db.transaction(Object.keys(stores), 'readwrite');
    trace('seed-transaction-ready');
    for (const card of cards) transaction.objectStore('cards').put(card);
    for (const [key, value] of Object.entries(settings)) transaction.objectStore('settings').put(value, key);
    for (const [name, value] of Object.entries(sentinels)) transaction.objectStore(name).put(value);
    trace('seed-puts-issued', { cards: cards.length, settings: Object.keys(settings).length, sentinels: Object.keys(sentinels).length });
    await transactionDone(transaction);
    trace('seed-puts-committed');
    db.close();
    trace('seed-connection-closed');
    window.__lot4Before = await window.__lot4Snapshot();
    document.body.dataset.ready = 'yes';
  } catch (error) {
    trace('bootstrap-error', { message: String(error && error.message || error) });
    document.body.dataset.error = String(error && error.message || error);
    document.body.dataset.ready = 'error';
  }
})();
</script>
</body>`;

test('migration native v11 → v12 : 93 cartes, photos, voix, positions et sentinelles intactes', async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(disableOfflineCache);
  await page.route(`**${FIXTURE_PATH}`, (route) => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: fixtureHtml,
  }));
  const fixtureErrors = [];
  const fixtureConsole = [];
  page.on('pageerror', (error) => fixtureErrors.push({ message: error.message, stack: error.stack }));
  page.on('console', (message) => fixtureConsole.push({ type: message.type(), text: message.text() }));
  await page.goto(FIXTURE_PATH);
  await page.waitForFunction(() => document.body.dataset.ready !== 'no', null, { timeout: 10_000 }).catch(() => {});
  const fixtureState = await page.evaluate(() => ({
    ready: document.body.dataset.ready,
    error: document.body.dataset.error || null,
    trace: window.__lot4Trace,
  }));
  expect(fixtureErrors).toEqual([]);
  expect(fixtureConsole.filter((message) => message.type === 'error')).toEqual([]);
  expect(fixtureState.ready, JSON.stringify({ fixtureState, fixtureErrors, fixtureConsole })).toBe('yes');
  expect(fixtureState.error).toBeNull();
  const before = await page.evaluate(() => window.__lot4Before);
  expect(before.version).toBe(11);
  expect(before.cards).toHaveLength(93);
  const baseCards = before.cards.filter((card) => card.id.startsWith('c-'));
  const familyCard = before.cards.find((card) => card.id === 'u-migration-famille');
  expect(baseCards).toHaveLength(92);
  expect(baseCards.every((card) => card.photo?.sha256 && card.audios.fr?.sha256)).toBe(true);
  expect(familyCard?.photo?.sha256).toBeTruthy();
  expect(familyCard?.audioFr?.sha256).toBeTruthy();
  expect(familyCard?.audioDr?.sha256).toBeTruthy();
  expect(before.cards.every((card) => Object.keys(card.positions).sort().join(',') === '2,3,4,5')).toBe(true);
  expect(before.stores).not.toContain('utterance_log');

  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  const after = await page.evaluate(async () => {
    const db = await import('/db.js');
    const request = indexedDB.open('kalimati', 12);
    const opened = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = opened.transaction(['cards', 'settings', 'pei_goals', 'trials', 'recordings', 'visual_overrides', 'online_cache', 'schedule_logs', 'schedule_config', 'abc_logs', 'ortho_logs', 'life_book', 'followups'], 'readonly');
    const all = (name) => new Promise((resolve, reject) => {
      const read = transaction.objectStore(name).getAll();
      read.onsuccess = () => resolve(read.result);
      read.onerror = () => reject(read.error);
    });
    const names = Array.from(transaction.objectStoreNames);
    const values = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await all(name)])));
    const done = new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
    const descriptor = async (blob) => {
      if (!blob) return null;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return { type: blob.type, size: blob.size, sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('') };
    };
    const clean = async (value) => {
      if (value instanceof Blob) return descriptor(value);
      if (Array.isArray(value)) return Promise.all(value.map(clean));
      if (value && typeof value === 'object') return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key, item]) => [key, await clean(item)])));
      return value ?? null;
    };
    await done;
    const settings = Object.fromEntries(values.settings.map(({ key, value }) => [key, value]));
    const snapshot = {
      version: opened.version,
      stores: Array.from(opened.objectStoreNames).sort(),
      cards: (await Promise.all(values.cards.map(clean))).sort((a, b) => a.id.localeCompare(b.id)),
      settings: await clean(settings),
      sentinels: await clean(Object.fromEntries(names.filter((name) => name !== 'cards' && name !== 'settings').map((name) => [name, values[name]]))),
    };
    const utteranceSchema = opened.transaction('utterance_log', 'readonly').objectStore('utterance_log');
    snapshot.utteranceIndexes = Array.from(utteranceSchema.indexNames).sort();
    snapshot.utteranceCount = await db.getAllUtteranceLogs().then((entries) => entries.length);
    opened.close();
    return snapshot;
  });

  expect(after.version).toBe(12);
  expect(after.stores).toEqual(expect.arrayContaining([...before.stores, 'utterance_log']));
  expect(after.utteranceIndexes).toEqual(['day', 'ts']);
  expect(after.utteranceCount).toBe(0);
  expect(after.cards).toEqual(before.cards);
  expect(after.cards.find((card) => card.id === 'u-migration-famille')).toEqual(familyCard);
  for (const key of ['cols', 'lang', 'seeded', 'v2migrated', 'v3migrated', 'v7migrated', 'v92migrated', 'v10.20migrated', 'onlyReviewed', 'migrationSentinel']) {
    expect(after.settings[key], `réglage ${key}`).toEqual(before.settings[key]);
  }
  expect(after.sentinels).toEqual(before.sentinels);
});
