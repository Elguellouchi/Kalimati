import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  localDay,
  retentionCutoff,
  validateUtteranceLogEntry,
  buildUtteranceEntry,
  createUtteranceLogController,
} from '../modules/utterance-log.js';

let checks = 0;
async function check(name, fn) {
  await fn();
  checks += 1;
  console.log(`OK ${checks} — ${name}`);
}

const settle = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

function harness(overrides = {}) {
  let now = new Date(2026, 10, 28, 12, 0, 0).getTime();
  let timerId = 0;
  const timers = new Map();
  const writes = [];
  const clears = [];
  const purges = [];
  const settings = [];
  const diagnostics = [];
  let failWrite = false;
  const listeners = new Map();
  const target = {
    visibilityState: 'visible',
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatch(type) {
      if (type === 'visibilitychange') target.visibilityState = 'hidden';
      for (const fn of listeners.get(type) || []) fn({ type });
    },
  };
  const storage = {
    async putLogs(entries) {
      if (failWrite) throw new Error('write failed');
      writes.push(entries.map((entry) => ({ ...entry, wordIds: [...entry.wordIds] })));
    },
    async clearLogs() { clears.push(now); },
    async purgeBefore(day) { purges.push(day); },
  };
  let randomStep = 1;
  const controller = createUtteranceLogController({
    storage,
    now: () => now,
    date: () => new Date(now),
    random: () => (randomStep++ % 1000) / 1000,
    setTimer(fn, ms) { const id = ++timerId; timers.set(id, { fn, due: now + ms }); return id; },
    clearTimer(id) { timers.delete(id); },
    saveEnabled: async (enabled) => { settings.push(enabled); },
    visibilityTarget: target,
    onDiagnostic: (...args) => diagnostics.push(args),
    flushMs: 5000,
    ...overrides,
  });
  return {
    controller, storage, writes, clears, purges, settings, diagnostics, target, timers,
    setNow(value) { now = value; },
    setFailWrite(value) { failWrite = value; },
    advance(ms) {
      const end = now + ms;
      while (true) {
        const due = [...timers.entries()].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!due) break;
        const [id, timer] = due;
        timers.delete(id);
        now = timer.due;
        timer.fn();
      }
      now = end;
    },
  };
}

const card = (id = 'w-eau', wordId = id, extra = false) => ({ id, wordId, extra, fr: 'texte-neutre' });

await check('le schéma supprime les champs inconnus et conserve exactement les neuf champs', () => {
  const raw = {
    id: 'u-1764000000000-a1b2c3d4', ts: 1764000000000, day: '2026-11-24',
    wordIds: ['w-vouloir', 'w-eau'], source: 'enfant', mode: 'phrase', lang: 'dr',
    page: 'phrase', session: null, text: 'à supprimer', childName: 'à supprimer', audio: new Blob(['x']),
  };
  assert.deepEqual(validateUtteranceLogEntry(raw), {
    id: raw.id, ts: raw.ts, day: raw.day, wordIds: raw.wordIds,
    source: raw.source, mode: raw.mode, lang: raw.lang, page: raw.page, session: null,
  });
});

await check('le jour et la rétention utilisent le calendrier local', () => {
  assert.equal(localDay(new Date(2026, 0, 2, 0, 30)), '2026-01-02');
  assert.equal(localDay(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
  assert.equal(retentionCutoff(new Date(2026, 10, 28, 23, 59)), '2025-10-25');
});

await check('la validation refuse les types, énumérations, jours, pages et sessions invalides', () => {
  const valid = {
    id: 'u-1764000000000-a1b2c3d4', ts: 1764000000000, day: '2026-11-24',
    wordIds: ['w-eau'], source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger', session: null,
  };
  for (const patch of [
    { id: 'x-1' }, { ts: 1.5 }, { day: '2026-02-30' }, { wordIds: [] },
    { source: 'parent' }, { mode: 'jeu' }, { lang: 'français' },
    { page: 'texte libre' }, { session: 'session-1' },
  ]) assert.equal(validateUtteranceLogEntry({ ...valid, ...patch }), null);
  assert.equal(validateUtteranceLogEntry({ ...valid, wordIds: Array(65).fill('w-eau') }), null);
  assert.equal(validateUtteranceLogEntry({ ...valid, wordIds: ['mot avec texte'] }), null);
});

await check('la construction résout wordId, exclut extra et ne conserve aucun texte de mot', () => {
  const entry = buildUtteranceEntry({
    cards: [card('c-local', 'w-vouloir'), card('mot:libre', null, true)],
    source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger',
  }, { now: () => 1764000000000, date: () => new Date(2026, 10, 24, 12), random: () => 0.5 });
  assert.deepEqual(entry.wordIds, ['w-vouloir']);
  assert.equal(entry.day, '2026-11-24');
  assert.match(entry.id, /^u-1764000000000-[a-f0-9]{8}$/);
  assert.equal(JSON.stringify(entry).includes('texte-neutre'), false);
  assert.equal(buildUtteranceEntry({ cards: [card('x', 'x', true)], source: 'enfant', mode: 'carte', lang: 'fr', page: 'toilet' }), null);
});

await check('une phrase conserve les doublons et est limitée à 64 identifiants', () => {
  const cards = Array.from({ length: 65 }, (_, i) => card(`w-mot-${i}`));
  const entry = buildUtteranceEntry({ cards, source: 'modele', mode: 'phrase', lang: 'dr', page: 'phrase' });
  assert.equal(entry.wordIds.length, 64);
  const repeated = buildUtteranceEntry({ cards: [card(), card()], source: 'enfant', mode: 'phrase', lang: 'fr', page: 'phrase' });
  assert.deepEqual(repeated.wordIds, ['w-eau', 'w-eau']);
});

await check('50 appels synchrones produisent 50 entrées sans écriture préalable ni déduplication', () => {
  const h = harness();
  for (let i = 0; i < 50; i += 1) h.controller.record({ cards: [card(`w-mot-${i}`)], source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger' });
  assert.equal(h.controller.queueSize(), 50);
  assert.equal(new Set(h.controller.queueEntries().map((entry) => entry.id)).size, 50);
  assert.equal(h.writes.length, 0);
});

await check('le flush est groupé après 5 secondes puis au passage en arrière-plan', async () => {
  const h = harness();
  h.controller.record({ cards: [card()], source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger' });
  h.advance(4999);
  await settle();
  assert.equal(h.writes.length, 0);
  h.advance(1);
  await settle();
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].length, 1);
  h.controller.record({ cards: [card('w-pain')], source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger' });
  h.target.dispatch('visibilitychange');
  await settle();
  assert.equal(h.writes.length, 2);
  assert.equal(h.writes[1][0].wordIds[0], 'w-pain');
});

await check('les écritures qui se chevauchent ne créent pas deux transactions', async () => {
  let release;
  let calls = 0;
  const h = harness({ storage: {
    putLogs: () => { calls += 1; return new Promise((resolve) => { release = resolve; }); },
    clearLogs: async () => {}, purgeBefore: async () => {},
  } });
  h.controller.record({ cards: [card()], source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger' });
  const first = h.controller.flush();
  await settle();
  const second = h.controller.flush();
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);
  assert.equal(h.controller.queueSize(), 0);
});

await check('un échec conserve la file, permet une reprise et produit un diagnostic anonyme', async () => {
  const h = harness();
  h.controller.record({ cards: [card('w-vouloir')], source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger' });
  h.setFailWrite(true);
  await h.controller.flush();
  assert.equal(h.controller.queueSize(), 1);
  assert.equal(h.diagnostics.length, 1);
  assert.equal(JSON.stringify(h.diagnostics).includes('w-vouloir'), false);
  assert.equal(JSON.stringify(h.diagnostics).includes('u-'), false);
  h.setFailWrite(false);
  await h.controller.flush();
  assert.equal(h.controller.queueSize(), 0);
});

await check('désactiver écrit la file acceptée sans effacer l’historique, réactiver reprend', async () => {
  const h = harness();
  h.controller.record({ cards: [card()], source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger' });
  await h.controller.setEnabled(false);
  assert.equal(h.settings.at(-1), false);
  assert.equal(h.writes.length, 1);
  assert.equal(h.controller.queueSize(), 0);
  h.controller.record({ cards: [card('w-pain')], source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger' });
  assert.equal(h.controller.queueSize(), 0);
  assert.equal(h.clears.length, 0);
  await h.controller.setEnabled(true);
  h.controller.record({ cards: [card('w-pain')], source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger' });
  assert.equal(h.controller.queueSize(), 1);
});

await check('la purge conserve J−399 et supprime strictement avant J−399', async () => {
  const h = harness();
  await h.controller.purge();
  assert.deepEqual(h.purges, ['2025-10-25']);
});

await check('l’effacement coordonne l’écriture en cours et conserve les entrées post-effacement', async () => {
  let releaseWrite;
  let calls = 0;
  const h = harness({ storage: {
    putLogs: (entries) => {
      calls += 1;
      if (calls === 1) return new Promise((resolve) => { releaseWrite = () => resolve(entries); });
      return Promise.resolve(entries);
    },
    clearLogs: async () => { h.clears.push(1); },
    purgeBefore: async () => {},
  } });
  h.controller.record({ cards: [card('w-avant')], source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger' });
  const writing = h.controller.flush();
  await settle();
  const clearing = h.controller.clear();
  h.controller.record({ cards: [card('w-apres')], source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger' });
  assert.equal(h.controller.queueSize(), 1);
  releaseWrite();
  await writing;
  await clearing;
  assert.equal(h.clears.length, 1);
  await h.controller.flush();
  assert.equal(h.controller.queueSize(), 0);
  assert.equal(calls, 2);
});

await check('recordUtterance ne dépend jamais de la résolution du stockage', async () => {
  const h = harness({ storage: {
    putLogs: () => new Promise(() => {}), clearLogs: async () => {}, purgeBefore: async () => {},
  } });
  const started = performance.now();
  const returned = h.controller.record({ cards: [card()], source: 'enfant', mode: 'carte', lang: 'fr', page: 'base:manger' });
  assert.ok(returned);
  assert.ok(performance.now() - started < 20);
  const pending = h.controller.flush();
  await settle();
  assert.equal(h.controller.flushing(), true);
  assert.ok(pending instanceof Promise);
});

await check('les frontières de parole gardent la parole avant le journal et excluent le parent', async () => {
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  const strip = await readFile(new URL('../modules/strip-controller.js', import.meta.url), 'utf8');
  const speech = await readFile(new URL('../speech.js', import.meta.url), 'utf8');
  assert.ok(app.includes("from './modules/utterance-log.js'"));
  assert.ok(app.indexOf('sayCard(card, state.lang);') < app.indexOf('recordUtterance({ cards: [journalCard]'));
  assert.ok(strip.includes('const speaking = sayCards(state.strip'));
  const phraseSetup = strip.slice(strip.indexOf('function setupStrip'));
  assert.ok(phraseSetup.indexOf('const speaking = sayCards(state.strip') < phraseSetup.indexOf('recordUtterance({ cards: state.strip'));
  assert.equal(speech.includes('recordUtterance'), false);
  const cardTap = app.slice(app.indexOf('function onCardTap'), app.indexOf('const tappableCard'));
  const parentReturn = cardTap.indexOf('if (state.parent)');
  const journal = cardTap.indexOf('recordUtterance(');
  assert.ok(parentReturn >= 0 && journal > parentReturn);
  assert.ok(cardTap.includes('const journalCard = isFallbackMode() ? null : stableJournalCard(card);'));
  assert.ok(cardTap.includes("if (journalCard) recordUtterance({ cards: [journalCard], source: state.modeling ? 'modele' : 'enfant'"));
  assert.ok(strip.includes('if (!state.parent && !isFallbackMode()) recordUtterance({ cards: state.strip'));
});

await check('Supabase et la sauvegarde par défaut excluent le journal et son réglage', async () => {
  const cloud = await readFile(new URL('../modules/cloud-sync.js', import.meta.url), 'utf8');
  const backup = await readFile(new URL('../backup.js', import.meta.url), 'utf8');
  const backupUi = await readFile(new URL('../modules/backup-ui.js', import.meta.url), 'utf8');
  const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
  assert.equal(/utterance[_A-Z]|utteranceLog/i.test(cloud), false);
  assert.equal(/utteranceLogs/i.test(backup), false);
  assert.equal(cloud.includes('utteranceJournalEnabled'), false);
  assert.equal(app.includes('utteranceJournalEnabled'), false);
  assert.equal(backupUi.includes('utteranceJournalEnabled'), false);
});

await check('la base cible est v12 avec store utterance_log et index day/ts', async () => {
  const db = await readFile(new URL('../db.js', import.meta.url), 'utf8');
  assert.match(db, /const DB_VERSION = 12;/);
  assert.match(db, /createObjectStore\('utterance_log', \{ keyPath: 'id' \}\)/);
  assert.match(db, /createIndex\('day', 'day'\)/);
  assert.match(db, /createIndex\('ts', 'ts'\)/);
  assert.ok(db.indexOf('if (oldVersion < 11 && transaction)') < db.indexOf("createObjectStore('utterance_log'"));
});

console.log(`\n${checks} vérifications du journal : OK`);
