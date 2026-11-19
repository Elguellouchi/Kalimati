// 🛠️ Journal d'erreurs & de diagnostic local-first (v10.8)
// Règle obligatoire d'ingénierie : ce journal DOIT être consulté et traité en amont
// de toute amélioration ou nouvelle fonctionnalité de Kalimati.
// - 100 % local-first : tampon circulaire de 150 entrées max (~40 Ko) dans IndexedDB (settings.diagnosticLog)
//   avec repli automatique en mémoire RAM si le stockage du téléphone est saturé.
// - Zéro donnée personnelle d'enfant : aucun prénom, aucun âge, aucune phrase (strip),
//   aucun score ABA/ATEC, aucune voix ou photo, aucune clé (#key=...), aucune URL blob:/data:.
// - Zéro alerte ni rouge en mode enfant : interception silencieuse.

import * as db from '../db.js';
import { h, btn } from './util.js';

export const ERROR_LOG_KEY = 'diagnosticLog';
export const ERROR_LOG_FORMAT = 'kalimati-diagnostic-log-v1';
export const MAX_LOG_ENTRIES = 150;

export const LOG_TYPES = {
  AUDIO_SILENT: 'AUDIO_SILENT',   // Carte muette, fichier voix absent, échec audio.play() iOS
  STORAGE_QUOTA: 'STORAGE_QUOTA', // QuotaExceededError IndexedDB / CacheStorage
  UX_FRICTION: 'UX_FRICTION',     // Rafale de touchers rejetés (anti-rebond 450 ms), cadenas
  JS_RUNTIME: 'JS_RUNTIME',       // window.onerror, unhandledrejection, erreur DOM
  SYNC_PACK: 'SYNC_PACK',         // Délai ARASAAC 6 s, pack vocal incomplet, fichier Douar refusé
};

// Identifiants de cartes personnelles (Moi, Sœur, Thérapeute ou carte créée par la famille)
const PERSONAL_CARD_IDS = new Set([
  'c-personnes-moi',
  'c-personnes-ghita',
  'c-personnes-hosna',
]);

let memoryRing = [];
let loadedFromDb = false;
let flushTimer = 0;
let listenersInstalled = false;
let contextProvider = () => ({ v: '10.8', lang: 'fr', space: 'home' });
// v10.8 (fusion Claude) : prénoms de la famille (profil) à effacer aussi des entrées.
let familyNames = [];
export function setDiagnosticForbiddenNames(names) {
  familyNames = (Array.isArray(names) ? names : []).map((n) => String(n || '').trim()).filter((n) => n.length >= 2).slice(0, 10);
}

// Suivi des rafales de touchers rejetés par l'anti-rebond (UX_FRICTION)
let rejectedTapWindowStart = 0;
let rejectedTapCount = 0;

export function setDiagnosticContextProvider(fn) {
  if (typeof fn === 'function') contextProvider = fn;
}

// ---------- 1. Filtre d'anonymisation strict (zéro donnée d'enfant) ----------
export function sanitizeCardId(cardId) {
  if (!cardId || typeof cardId !== 'string') return '';
  const clean = cardId.trim();
  if (!clean) return '';
  // v10.8 (fusion Claude) : même règle que les packs de voix : toute carte « personnes » propre à la famille
  // (prénom de l'enfant, de la sœur, de la thérapeute…) est masquée ; Papa, Maman, Papi, Mamie, Maîtresse restent.
  if (PERSONAL_CARD_IDS.has(clean) || /^c-personnes-(?!papa$|maman$|papi$|mamie$|maitresse$)/.test(clean)) return 'card:personal';
  // Seules les cartes du catalogue standard (c-<cat>-<slug> ou c-rural-<slug> ou c-pack-<slug>) sont gardées telles quelles
  if (/^c-(base|manger|boire|jouer|actions|personnes|besoins|emotions|decrire|lieux|rural|pack)-[a-z0-9-]+$/.test(clean)) {
    return clean;
  }
  return 'card:custom';
}

export function sanitizeText(raw, extraForbidden = []) {
  if (raw === null || raw === undefined) return '';
  let s = String(raw).trim();
  if (!s) return '';

  // Purge des fragments secrets (#key=..., ?key=..., token=..., bearer)
  s = s.replace(/#[a-z0-9_-]*key=[^\s&"']+/gi, '#key=[REDACTED]');
  s = s.replace(/([?&](?:key|token|secret|password|passphrase|auth)=)[^\s&"']+/gi, '$1[REDACTED]');
  // Purge des URLs blob: et data:
  s = s.replace(/\bblob:[^\s)"']+/gi, 'blob:[REDACTED]');
  s = s.replace(/\bdata:[^\s)"']+/gi, 'data:[REDACTED]');
  // Purge des chemins complets pour ne garder que le nom de fichier (ex: modules/dashboard.js:142)
  s = s.replace(/https?:\/\/[^\s/]+\/(?:Kalimati\/)?/gi, '');
  s = s.replace(/file:\/\/\/[^\s]+?\/([^/\s]+)$/gi, '$1');

  // Purge des prénoms connus par défaut + liste dynamique éventuelle
  const defaultNames = ['abir', 'ghita', 'hosna'];
  const allForbidden = [...defaultNames, ...familyNames, ...extraForbidden]
    .map((n) => String(n || '').trim())
    .filter((n) => n.length >= 2);

  for (const name of allForbidden) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '[ENFANT]');
  }

  return s.slice(0, 180);
}

export function sanitizeLogEntry(raw = {}, extraForbidden = []) {
  const type = LOG_TYPES[raw.type] || LOG_TYPES.JS_RUNTIME;
  const sev = ['error', 'warn', 'info'].includes(raw.sev)
    ? raw.sev
    : (type === LOG_TYPES.JS_RUNTIME || type === LOG_TYPES.STORAGE_QUOTA ? 'error' : 'warn');

  const detail = sanitizeText(raw.detail || 'unknown', extraForbidden);
  const cardId = raw.cardId ? sanitizeCardId(raw.cardId) : undefined;
  const moduleName = raw.module ? sanitizeText(raw.module, extraForbidden).slice(0, 64) : undefined;
  const packId = raw.packId ? sanitizeText(raw.packId, extraForbidden).slice(0, 48) : undefined;

  let rawCtx = {};
  try {
    rawCtx = { ...(contextProvider() || {}), ...(raw.ctx || {}) };
  } catch {
    rawCtx = raw.ctx || {};
  }

  const ctx = {
    v: sanitizeText(rawCtx.v || '10.8').slice(0, 16),
    lang: sanitizeText(rawCtx.lang || 'fr').slice(0, 8),
    space: sanitizeText(rawCtx.space || 'home').slice(0, 24),
    online: typeof rawCtx.online === 'boolean'
      ? rawCtx.online
      : (typeof navigator !== 'undefined' ? Boolean(navigator.onLine) : true),
  };

  // Horodatage arrondi à la minute (YYYY-MM-DDTHH:MMZ)
  const nowIso = (raw.at ? new Date(raw.at) : new Date()).toISOString().slice(0, 16) + 'Z';
  const fpParts = [type, ctx.lang, cardId || moduleName || packId || '', detail.slice(0, 60)];
  const fp = fpParts.filter(Boolean).join(':');

  const clean = {
    fp,
    type,
    sev,
    count: Math.max(1, Number(raw.count) || 1),
    firstAt: raw.firstAt || nowIso,
    lastAt: raw.lastAt || nowIso,
    ctx,
    detail,
  };
  if (cardId) clean.cardId = cardId;
  if (moduleName) clean.module = moduleName;
  if (packId) clean.packId = packId;
  if (typeof raw.usageMb === 'number') clean.usageMb = Math.round(raw.usageMb * 10) / 10;
  if (typeof raw.quotaMb === 'number') clean.quotaMb = Math.round(raw.quotaMb * 10) / 10;
  return clean;
}

// ---------- 2. Tampon circulaire local (150 entrées max, dédupliqué par empreinte) ----------
export async function loadErrorLog() {
  if (loadedFromDb) return memoryRing;
  try {
    const saved = await db.getSetting(ERROR_LOG_KEY);
    if (Array.isArray(saved)) {
      const merged = [...saved, ...memoryRing];
      memoryRing = [];
      for (const item of merged) {
        upsertIntoRing(sanitizeLogEntry(item));
      }
    }
  } catch {
    // Garde le tampon RAM si IndexedDB est indisponible
  }
  loadedFromDb = true;
  return memoryRing;
}

function upsertIntoRing(entry) {
  const existingIdx = memoryRing.findIndex((x) => x.fp === entry.fp);
  if (existingIdx >= 0) {
    const prev = memoryRing[existingIdx];
    prev.count = (Number(prev.count) || 1) + (Number(entry.count) || 1);
    prev.lastAt = entry.lastAt;
    prev.ctx = entry.ctx;
    // Remonte l'entrée récente en fin de tampon
    memoryRing.splice(existingIdx, 1);
    memoryRing.push(prev);
  } else {
    memoryRing.push(entry);
    if (memoryRing.length > MAX_LOG_ENTRIES) {
      memoryRing.splice(0, memoryRing.length - MAX_LOG_ENTRIES);
    }
  }
}

// v10.8 (fusion Claude) : mémoire pleine = pas d'écriture du journal pendant 60 s (sinon chaque échec
// d'écriture créerait une nouvelle entrée, puis un nouvel échec, sans fin).
let quotaPauseUntil = 0;
function scheduleFlush() {
  if (flushTimer || Date.now() < quotaPauseUntil) return;
  flushTimer = setTimeout(async () => {
    flushTimer = 0;
    try {
      await db.setSetting(ERROR_LOG_KEY, memoryRing.slice(-MAX_LOG_ENTRIES));
    } catch {
      // Ne jamais boucler si IndexedDB est saturé (QuotaExceededError)
    }
  }, 350);
}

export function logDiagnostic(type, detail, meta = {}) {
  try {
    const entry = sanitizeLogEntry({
      type,
      detail,
      ...meta,
    });
    upsertIntoRing(entry);
    if (entry.type === LOG_TYPES.STORAGE_QUOTA) quotaPauseUntil = Date.now() + 60000;
    else scheduleFlush();
    return entry;
  } catch {
    return null;
  }
}

export async function flushErrorLogNow() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = 0;
  }
  try {
    await db.setSetting(ERROR_LOG_KEY, memoryRing.slice(-MAX_LOG_ENTRIES));
  } catch {}
}

export async function clearErrorLog() {
  memoryRing = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = 0;
  }
  try {
    await db.setSetting(ERROR_LOG_KEY, []);
  } catch {}
}

export function getErrorLogSnapshot() {
  return memoryRing.map((e) => ({ ...e, ctx: { ...e.ctx } }));
}

// ---------- 3. Capteurs globaux & capteurs de friction ----------
export function initGlobalErrorLogger({ getContext } = {}) {
  if (typeof getContext === 'function') setDiagnosticContextProvider(getContext);
  loadErrorLog().catch(() => {});

  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;

  window.addEventListener('error', (event) => {
    const file = event?.filename ? event.filename.split('/').slice(-2).join('/') : 'window';
    const loc = event?.lineno ? `${file}:${event.lineno}` : file;
    const msg = event?.error?.name
      ? `${event.error.name}: ${event.message || ''}`
      : (event?.message || 'runtime_error');
    logDiagnostic(LOG_TYPES.JS_RUNTIME, msg, { module: loc, sev: 'error' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    const name = reason?.name || 'UnhandledRejection';
    const msg = reason?.message || String(reason || 'promise_rejected');
    const type = name === 'QuotaExceededError' ? LOG_TYPES.STORAGE_QUOTA : LOG_TYPES.JS_RUNTIME;
    logDiagnostic(type, `${name}: ${msg}`, { sev: 'error' });
  });
}

// Capteur anti-rebond : enregistre une friction UX uniquement si l'enfant fait une rafale (>= 4 rejets en 2 s)
export function recordRejectedTap({ cardId, space } = {}) {
  const now = Date.now();
  if (now - rejectedTapWindowStart > 2000) {
    rejectedTapWindowStart = now;
    rejectedTapCount = 1;
    return;
  }
  rejectedTapCount += 1;
  if (rejectedTapCount === 4) {
    logDiagnostic(LOG_TYPES.UX_FRICTION, 'rapid_tap_burst_450ms', {
      cardId,
      sev: 'info',
      ctx: space ? { space } : undefined,
    });
  }
}

// ---------- 4. Pré-vol obligatoire avant toute amélioration (Pre-Improvement Audit) ----------
// Classe les incidents par priorité produit pour traitement obligatoire en amont des améliorations.
export function buildPreImprovementReport(entries = memoryRing) {
  const list = Array.isArray(entries) ? entries : [];
  const byType = {
    [LOG_TYPES.JS_RUNTIME]: [],
    [LOG_TYPES.STORAGE_QUOTA]: [],
    [LOG_TYPES.AUDIO_SILENT]: [],
    [LOG_TYPES.SYNC_PACK]: [],
    [LOG_TYPES.UX_FRICTION]: [],
  };

  for (const item of list) {
    const bucket = byType[item.type] || byType[LOG_TYPES.JS_RUNTIME];
    bucket.push(item);
  }

  for (const k of Object.keys(byType)) {
    byType[k].sort((a, b) => (Number(b.count) || 1) - (Number(a.count) || 1));
  }

  // Action items obligatoires à traiter en amont de la prochaine version
  const blockersToFixFirst = [];

  for (const e of byType[LOG_TYPES.JS_RUNTIME].slice(0, 5)) {
    blockersToFixFirst.push({
      priority: 'P0-CRASH',
      fp: e.fp,
      count: e.count,
      summary: `Corriger l’exception JS dans ${e.module || e.ctx?.space || 'app'} (${e.detail}) — vue ${e.count} fois.`,
    });
  }
  for (const e of byType[LOG_TYPES.STORAGE_QUOTA].slice(0, 3)) {
    blockersToFixFirst.push({
      priority: 'P0-QUOTA',
      fp: e.fp,
      count: e.count,
      summary: `Résoudre la saturation mémoire (${e.detail}) — vue ${e.count} fois.`,
    });
  }
  for (const e of byType[LOG_TYPES.AUDIO_SILENT].slice(0, 10)) {
    blockersToFixFirst.push({
      priority: 'P1-AUDIO',
      fp: e.fp,
      count: e.count,
      summary: `Ajouter ou réparer la voix manquante pour ${e.cardId || 'carte'} en « ${e.ctx?.lang || '?'} » (${e.detail}) — touchée ${e.count} fois.`,
    });
  }
  for (const e of byType[LOG_TYPES.SYNC_PACK].slice(0, 5)) {
    blockersToFixFirst.push({
      priority: 'P1-PACK',
      fp: e.fp,
      count: e.count,
      summary: `Fiabiliser le chargement du pack ${e.packId || ''} (${e.detail}) — ${e.count} occurrences.`,
    });
  }
  for (const e of byType[LOG_TYPES.UX_FRICTION].slice(0, 5)) {
    blockersToFixFirst.push({
      priority: 'P2-UX',
      fp: e.fp,
      count: e.count,
      summary: `Ajuster l’ergonomie tactile sur ${e.ctx?.space || 'grille'} (${e.detail}) — ${e.count} rafales.`,
    });
  }

  return {
    format: ERROR_LOG_FORMAT,
    generatedAt: new Date().toISOString().slice(0, 16) + 'Z',
    mandatoryRule: 'À consulter et traiter obligatoirement en amont de toute nouvelle amélioration Kalimati.',
    totals: {
      uniqueIssues: list.length,
      totalOccurrences: list.reduce((s, x) => s + (Number(x.count) || 1), 0),
      jsErrors: byType[LOG_TYPES.JS_RUNTIME].length,
      quotaErrors: byType[LOG_TYPES.STORAGE_QUOTA].length,
      silentCards: byType[LOG_TYPES.AUDIO_SILENT].length,
      packIssues: byType[LOG_TYPES.SYNC_PACK].length,
      uxFrictions: byType[LOG_TYPES.UX_FRICTION].length,
    },
    blockersToFixFirst,
    entries: list,
  };
}

export function exportDiagnosticFile() {
  const report = buildPreImprovementReport();
  const json = JSON.stringify(report, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `kalimati-journal-erreurs-${dateStr}.json`;
  return {
    fileName,
    report,
    json,
    blob: new Blob([json], { type: 'application/json' }),
  };
}

// ---------- 5. Panneau Parent dans Progrès (consultation & export en 1 toucher) ----------
export function errorLogSettingsBox({ onDeliverFile } = {}) {
  const wrap = h('details', { class: 'card-box' },
    h('summary', {}, '🛠️ Journal d’erreurs & Diagnostic (Amélioration continue)'));
  const body = h('div', { class: 'stack' });
  wrap.append(body);

  async function render() {
    await loadErrorLog();
    const report = buildPreImprovementReport();
    const t = report.totals;

    const statusNote = h('p', { class: 'note' },
      'Ce journal 100 % local et anonyme (zéro prénom, zéro voix, zéro phrase) recense les blocages techniques et les cartes restées muettes. Il est obligatoirement traité en amont de chaque mise à jour.');

    const kpiLine = h('p', {},
      h('strong', {}, t.uniqueIssues === 0
        ? '✅ Aucun incident enregistré sur ce téléphone.'
        : `📊 ${t.uniqueIssues} sujet(s) détecté(s) (${t.totalOccurrences} occurrences) : `),
      t.uniqueIssues > 0
        ? `${t.silentCards} carte(s) muette(s) · ${t.jsErrors} erreur(s) JS · ${t.quotaErrors} alerte(s) mémoire · ${t.packIssues} délai(s) réseau/pack · ${t.uxFrictions} friction(s) tactile(s)`
        : '');

    const topList = report.blockersToFixFirst.length
      ? h('div', { class: 'stack' },
        h('h4', { style: { margin: '6px 0 2px' } }, '🎯 Priorités à traiter en amont de la prochaine version :'),
        ...report.blockersToFixFirst.slice(0, 8).map((b) => h('div', {
          class: 'note',
          style: { padding: '6px 8px', borderBottom: '1px solid var(--line)' },
        }, h('strong', {}, `[${b.priority}] `), b.summary)))
      : null;

    const copyBtn = btn('📋 Copier le diagnostic anonyme', async () => {
      try {
        const { json } = exportDiagnosticFile();
        await navigator.clipboard.writeText(json);
        statusNote.textContent = '✅ Diagnostic anonyme copié dans le presse-papiers (prêt à coller pour l’audit en amont).';
      } catch {
        statusNote.textContent = '⚠️ Copie directe non disponible sur ce navigateur : utilisez Exporter (.json).';
      }
    }, 'primary tiny');

    const exportBtn = btn('📤 Exporter le journal (.json)', async () => {
      try {
        const { fileName, blob } = exportDiagnosticFile();
        const file = new File([blob], fileName, { type: 'application/json' });
        if (typeof onDeliverFile === 'function') {
          await onDeliverFile(file);
        } else {
          const url = URL.createObjectURL(file);
          const a = h('a', { href: url, download: file.name });
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1500);
        }
        statusNote.textContent = `✅ Fichier « ${fileName} » généré (0 donnée d’enfant).`;
      } catch (err) {
        statusNote.textContent = `⚠️ ${err.message || err}`;
      }
    }, 'ghost tiny');

    const clearBtn = t.uniqueIssues > 0 ? btn('🗑️ Vider le journal', async () => {
      await clearErrorLog();
      statusNote.textContent = '🗑️ Journal d’erreurs vidé.';
      render();
    }, 'ghost tiny') : null;

    body.replaceChildren(
      statusNote,
      kpiLine,
      topList,
      h('div', { class: 'row wrap' }, copyBtn, exportBtn, clearBtn),
    );
  }

  wrap.addEventListener('toggle', () => {
    if (wrap.open) render();
  });
  render();
  return wrap;
}
