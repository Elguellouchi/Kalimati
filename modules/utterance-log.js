import * as db from '../db.js';

const SETTING_KEY = 'utteranceJournalEnabled';
const FLUSH_MS = 5000;
const MAX_WORD_IDS = 64;
const WORD_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ENTRY_ID = /^u-\d{10,16}-[a-f0-9]{8}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const LANG = /^[a-z]{2,3}$/;
const PAGE = /^(?:base:[a-z0-9_-]{1,64}|place:[A-Za-z0-9_.:-]{1,96}|scene:[A-Za-z0-9_.:-]{1,96}|toilet|phrase)$/;

const pad = (value) => String(value).padStart(2, '0');

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function retentionCutoff(date = new Date()) {
  const cutoff = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  cutoff.setDate(cutoff.getDate() - 399);
  return localDay(cutoff);
}

function validDay(day) {
  if (typeof day !== 'string' || !DAY.test(day)) return false;
  const [year, month, date] = day.split('-').map(Number);
  if (year < 1000 || month < 1 || month > 12 || date < 1 || date > 31) return false;
  const parsed = new Date(year, month - 1, date);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === date;
}

export function validateUtteranceLogEntry(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { id, ts, day, wordIds, source, mode, lang, page, session } = raw;
  if (typeof id !== 'string' || !ENTRY_ID.test(id)) return null;
  if (!Number.isSafeInteger(ts) || ts <= 0 || !id.startsWith(`u-${ts}-`)) return null;
  if (!validDay(day)) return null;
  if (!Array.isArray(wordIds) || wordIds.length < 1 || wordIds.length > MAX_WORD_IDS) return null;
  if (!wordIds.every((wordId) => typeof wordId === 'string' && WORD_ID.test(wordId))) return null;
  if (!['enfant', 'modele'].includes(source)) return null;
  if (!['carte', 'phrase'].includes(mode)) return null;
  if (mode === 'carte' && wordIds.length !== 1) return null;
  if (typeof lang !== 'string' || !LANG.test(lang)) return null;
  if (typeof page !== 'string' || !PAGE.test(page)) return null;
  if (session !== null) return null;
  return { id, ts, day, wordIds: [...wordIds], source, mode, lang, page, session: null };
}

function randomHex(random) {
  const part = () => Math.min(0xffff, Math.floor(random() * 0x10000)).toString(16).padStart(4, '0');
  return `${part()}${part()}`;
}

export function buildUtteranceEntry(context = {}, options = {}) {
  const now = options.now || Date.now;
  const date = options.date || (() => new Date(now()));
  const random = options.random || Math.random;
  const ts = now();
  if (!Number.isSafeInteger(ts) || ts <= 0) return null;
  const cards = Array.isArray(context.cards) ? context.cards : [];
  const wordIds = cards.map((card) => {
    if (!card || typeof card !== 'object' || card.extra) return null;
    const wordId = typeof card.wordId === 'string' && card.wordId ? card.wordId : card.id;
    return typeof wordId === 'string' && WORD_ID.test(wordId) ? wordId : null;
  }).filter(Boolean).slice(0, MAX_WORD_IDS);
  if (!wordIds.length) return null;
  return validateUtteranceLogEntry({
    id: `u-${ts}-${randomHex(random)}`,
    ts,
    day: localDay(date()),
    wordIds,
    source: context.source,
    mode: context.mode,
    lang: context.lang,
    page: context.page,
    session: null,
  });
}

export function createUtteranceLogController(options = {}) {
  const storage = options.storage;
  if (!storage || typeof storage.putLogs !== 'function') throw new TypeError('Stockage du journal manquant');
  const now = options.now || Date.now;
  const flushMs = options.flushMs ?? FLUSH_MS;
  const setTimer = options.setTimer || setTimeout;
  const clearTimer = options.clearTimer || clearTimeout;
  const visibilityTarget = options.visibilityTarget ?? globalThis.document;
  const onDiagnostic = options.onDiagnostic || (() => {});
  const saveEnabled = options.saveEnabled || (async () => {});
  let enabled = options.enabled !== false;
  let queue = [];
  let timer = null;
  let flushing = false;
  let clearing = false;
  let flushPromise = null;
  let clearPromise = null;

  const diagnostic = (type) => {
    try { onDiagnostic(type); } catch { /* le diagnostic local ne doit pas casser la parole */ }
  };
  const clearFlushTimer = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const armFlushTimer = () => {
    if (timer !== null || !queue.length || !enabled || clearing || flushing) return;
    timer = setTimer(() => { timer = null; void flush(); }, flushMs);
  };
  const flush = () => {
    if (flushing) return flushPromise || Promise.resolve(false);
    if (clearing || !queue.length) return Promise.resolve(false);
    const snapshot = queue.slice();
    flushing = true;
    const operation = Promise.resolve().then(() => storage.putLogs(snapshot)).then(() => {
      const written = new Set(snapshot.map((entry) => entry.id));
      queue = queue.filter((entry) => !written.has(entry.id));
      return true;
    }).catch(() => {
      diagnostic('utterance_log_flush_failed');
      return false;
    }).finally(() => {
      flushing = false;
      flushPromise = null;
      armFlushTimer();
    });
    flushPromise = operation;
    return operation;
  };
  const onVisibility = () => {
    if (visibilityTarget?.visibilityState === 'hidden') void flush();
  };
  visibilityTarget?.addEventListener?.('visibilitychange', onVisibility);

  const record = (context) => {
    if (!enabled) return null;
    let entry;
    try { entry = buildUtteranceEntry(context, { now, date: options.date, random: options.random }); } catch { return null; }
    if (!entry) return null;
    queue.push(entry);
    armFlushTimer();
    return entry;
  };
  const setEnabled = async (value) => {
    enabled = Boolean(value);
    if (!enabled) clearFlushTimer();
    try { await saveEnabled(enabled); } catch { diagnostic('utterance_log_setting_failed'); }
    if (!enabled) await flush();
    armFlushTimer();
    return enabled;
  };
  const clear = () => {
    if (clearPromise) return clearPromise;
    clearing = true;
    clearFlushTimer();
    queue = [];
    const pendingWrite = flushPromise || Promise.resolve(false);
    clearPromise = (async () => {
      let ok = false;
      try {
        await pendingWrite;
        ok = await storage.clearLogs();
        if (!ok) diagnostic('utterance_log_clear_failed');
      } catch {
        diagnostic('utterance_log_clear_failed');
      } finally {
        clearing = false;
        clearPromise = null;
        armFlushTimer();
      }
      return ok;
    })();
    return clearPromise;
  };
  const purge = async () => {
    try {
      return Boolean(await storage.purgeBefore(retentionCutoff(new Date(now()))));
    } catch {
      diagnostic('utterance_log_purge_failed');
      return false;
    }
  };

  return {
    record,
    flush,
    setEnabled,
    clear,
    purge,
    queueSize: () => queue.length,
    queueEntries: () => queue.map((entry) => ({ ...entry, wordIds: [...entry.wordIds] })),
    flushing: () => flushing,
  };
}

let controller = null;
let controllerPromise = null;

async function reportDiagnostic(type) {
  try {
    const { logDiagnostic } = await import('./error-log.js');
    logDiagnostic(type, 'journal_local');
  } catch { /* le diagnostic local ne doit pas casser la parole */ }
}

export async function initUtteranceLog() {
  if (!controllerPromise) {
    controllerPromise = (async () => {
      let enabled = true;
      try {
        const saved = await db.getSetting(SETTING_KEY);
        if (typeof saved === 'boolean') enabled = saved;
      } catch {
        void reportDiagnostic('utterance_log_setting_failed');
      }
      controller = createUtteranceLogController({
        enabled,
        storage: {
          putLogs: db.putUtteranceLogs,
          clearLogs: db.clearUtteranceLogs,
          purgeBefore: db.purgeUtteranceLogsBefore,
        },
        saveEnabled: (value) => db.setSetting(SETTING_KEY, value),
        onDiagnostic: (type) => { void reportDiagnostic(type); },
      });
      return controller;
    })();
  }
  return controllerPromise;
}

export function recordUtterance(context) {
  return controller ? controller.record(context) : null;
}

export async function flushUtteranceLogs() {
  if (!controller) await initUtteranceLog();
  return controller.flush();
}

export async function setUtteranceJournalEnabled(enabled) {
  if (!controller) await initUtteranceLog();
  return controller.setEnabled(enabled);
}

export async function clearUtteranceLogs() {
  if (!controller) await initUtteranceLog();
  return controller.clear();
}

export async function purgeExpiredUtteranceLogs() {
  if (!controller) await initUtteranceLog();
  return controller.purge();
}
