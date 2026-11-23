// v10.7 : voix amazighes (dossier Drive « kalimati-amazigh-final », relu et corrigé).
// Rien ne part sur internet quand l'enfant touche une carte. Ordre de lecture :
//   1) la voix enregistrée par le parent dans l'éditeur de la carte ;
//   2) un pack vocal installé (téléchargé depuis le site Kalimati, ou importé depuis un fichier « Voix du Douar ») ;
//   3) sinon la carte reste muette : aucune voix du téléphone ne sait lire l'amazigh.
// v10.7.1 : le site publie des packs d'essai (voix de synthèse Meta MMS, licence non commerciale), à faire
// écouter par un locuteur natif. Le pack de la variété choisie se télécharge tout seul une fois (fichiers du
// site seulement : rien ne part du téléphone), sauf si le parent l'a supprimé ou a importé « Voix du Douar ».
// Les voix sont gardées dans le téléphone (CacheStorage), jamais sur les cartes : elles ne partent ni dans la
// sauvegarde ni dans la synchro. Elles sortent seulement par « Exporter Voix du Douar », après la case
// « voix d'adultes seulement », et jamais pour les cartes personnelles (Moi, Sœur / Frère, Thérapeute).
// Les voix sont gardées en mémoire pendant l'usage : sur iPhone, le son doit partir tout de suite après le toucher.

import * as db from '../db.js';
import { isAmazighLang, langInfo } from './languages.js';
import { logDiagnostic, LOG_TYPES } from './error-log.js';

export const VOICE_CACHE_PREFIX = 'kalimati-amazigh-voices-';
const PACK_STATE_KEY = 'amazighVoicePacks';
const PACK_DECLINED_KEY = 'amazighVoicePacksDeclined'; // v10.7.1 : packs supprimés par le parent (pas de retour automatique)
export const DOUAR_FORMAT = 'kalimati-voicepack-v1';
const MAX_IMPORT_BYTES = 40 * 1024 * 1024; // un fichier « Voix du Douar » : 40 Mo au plus
const MAX_VOICE_BYTES = 1536 * 1024; // une voix : 1,5 Mo au plus
const MAX_VOICES = 600;
const CARD_ID_RE = /^[a-z0-9][a-z0-9_-]{0,119}$/i;
// Cartes de départ propres à la famille (prénom de l'enfant, de la sœur, de la thérapeute) : jamais partagées.
const PRIVATE_CARD_RE = /^c-personnes-(?!papa$|maman$|papi$|mamie$|maitresse$)/;
const shareableId = (id) => CARD_ID_RE.test(id) && id.startsWith('c-') && !PRIVATE_CARD_RE.test(id);

export const packCacheName = (lang) => `${VOICE_CACHE_PREFIX}${lang}`;
export const parentCacheName = (lang) => `${VOICE_CACHE_PREFIX}parent-${lang}`;
const packKey = (lang, cardId) => `./voix/${lang}/${encodeURIComponent(cardId)}.mp3`;
const parentKey = (lang, cardId) => `./voix-parent/${lang}/${encodeURIComponent(cardId)}`;
const hasCaches = () => typeof caches !== 'undefined';
// v10.7.3 : Chrome (et les autres navigateurs que Safari) sur iPhone n'ont pas de « caches ».
// Les voix du pack sont alors gardées en mémoire pour cette ouverture seulement (retéléchargées à la suivante,
// fichiers du site seulement, jamais au toucher).
const memoryOnly = new Map(); // variété -> Map(carte -> son)
export const amazighVoicesMemoryOnly = () => !hasCaches();

function safeAudioType(type) {
  const value = String(type || '').trim().toLowerCase();
  return /^audio\/[a-z0-9.+-]{1,40}(;[ a-z0-9=.,"+-]{0,60})?$/.test(value) ? value : 'audio/mpeg';
}

function cardIdFromKey(url) {
  const m = /\/voix(?:-parent)?\/(?:shi|tzm|rif|zgh)\/([^/?#]+?)(?:\.mp3)?$/.exec(String(url || ''));
  if (!m) return null;
  try {
    const id = decodeURIComponent(m[1]);
    return CARD_ID_RE.test(id) ? id : null;
  } catch {
    return null;
  }
}

const quotaError = (err) => err && (err.name === 'QuotaExceededError' || /quota/i.test(String(err.message || '')));
const fullMemoryError = () => Object.assign(new Error('Mémoire du téléphone pleine. Supprimez un pack vocal ou des vidéos, puis réessayez.'), { name: 'QuotaExceededError' });

// ---------- Voix en mémoire (variété choisie seulement) ----------
const memory = { lang: null, parent: new Map(), pack: new Map() };
let loadToken = 0;
let loading = null;

// ---------- v10.7.2 : état des voix, montré sur l'Accueil (en cours, prêtes, raté) ----------
const progress = new Map(); // variété -> { done, total } pendant un téléchargement
const failures = new Map(); // variété -> raison du dernier échec (texte court)
const arriving = new Map(); // variété -> Map(carte -> son) : voix arrivées pendant le téléchargement en cours
const stopped = new Set(); // variétés dont le parent a supprimé le pack pendant le téléchargement
const known = { packs: null, declined: null }; // dernier état lu ou écrit (pour l'Accueil, sans attendre la base)
let lastEmit = 0;
function emitProgress(force = false) {
  const now = Date.now();
  if (!force && now - lastEmit < 300) return;
  lastEmit = now;
  try { document.dispatchEvent(new CustomEvent('kalimati-amazigh-voices-progress')); } catch { /* hors navigateur */ }
}

// Un son de pack sans type est marqué « audio/mpeg » (Safari sur iPhone refuse parfois un son sans type).
// Un son d'un autre type (voix « Voix du Douar » enregistrées sur un téléphone) garde le sien.
const asMpeg = (blob) => (blob && !blob.type ? blob.slice(0, blob.size, 'audio/mpeg') : blob);

async function readCache(name, { mpeg = false } = {}) {
  const out = new Map();
  if (!hasCaches()) return out;
  try {
    if (!(await caches.has(name))) return out;
    const cache = await caches.open(name);
    for (const request of await cache.keys()) {
      const id = cardIdFromKey(request.url);
      if (!id) continue;
      const response = await cache.match(request);
      if (!response) continue;
      const blob = await response.blob();
      if (blob && blob.size) out.set(id, mpeg ? asMpeg(blob) : blob);
    }
  } catch { /* cache illisible : la carte reste muette */ }
  return out;
}

// Charge en mémoire les voix de la variété choisie (et oublie les autres). Ne bloque jamais l'écran.
export function loadAmazighVoices(lang) {
  const code = isAmazighLang(lang) ? lang : null;
  const token = ++loadToken;
  loading = (async () => {
    const [parent, pack] = code
      ? await Promise.all([readCache(parentCacheName(code)), readCache(packCacheName(code), { mpeg: true })])
      : [new Map(), new Map()];
    if (code && !hasCaches()) for (const [id, blob] of memoryOnly.get(code) || []) pack.set(id, blob);
    if (token !== loadToken) return;
    // v10.7.2 : pendant un téléchargement, les voix déjà arrivées sont gardées (elles parlent tout de suite).
    const extra = code ? arriving.get(code) : null;
    if (extra) for (const [id, blob] of extra) pack.set(id, blob);
    memory.lang = code;
    memory.parent = parent;
    memory.pack = pack;
  })().catch(() => {}).finally(() => { if (token === loadToken) { loading = null; emitProgress(true); } });
  return loading;
}

// État des voix d'une variété, pour l'Accueil :
// { downloading, done, total, loaded, ready (cartes qui parlent), pack, expected, declined, trial, failed }
export function amazighVoiceStatus(lang) {
  const p = progress.get(lang);
  const loaded = memory.lang === lang && !loading;
  const info = known.packs ? known.packs[lang] : null;
  return {
    downloading: Boolean(p),
    done: p ? p.done : 0,
    total: p ? p.total : 0,
    loaded,
    ready: memory.lang === lang ? new Set([...memory.pack.keys(), ...memory.parent.keys()]).size : 0,
    pack: memory.lang === lang ? memory.pack.size : 0,
    expected: info ? Number(info.expected) || 0 : 0,
    declined: Boolean(known.declined && known.declined[lang]),
    trial: Boolean(info && info.trial),
    memoryOnly: !hasCaches(),
    failed: failures.get(lang) || null,
    // pas encore essayé depuis l'ouverture (l'arrivée automatique part 1,5 s après), ou essai en cours :
    waiting: (!autoState.has(lang) || autoState.get(lang).running) && !(typeof navigator !== 'undefined' && navigator.onLine === false),
  };
}

function ensureLoaded(lang) {
  if (memory.lang !== lang && !loading) loadAmazighVoices(lang);
  return memory.lang === lang;
}

export const parentAmazighVoice = (lang, cardId) => (isAmazighLang(lang) && ensureLoaded(lang) ? memory.parent.get(cardId) || null : null);
export const packAmazighVoice = (lang, cardId) => (isAmazighLang(lang) && ensureLoaded(lang) ? memory.pack.get(cardId) || null : null);
export const amazighVoiceFor = (lang, cardId) => parentAmazighVoice(lang, cardId) || packAmazighVoice(lang, cardId);

function announce() {
  try { document.dispatchEvent(new CustomEvent('kalimati-amazigh-voices-changed')); } catch { /* hors navigateur */ }
}

// ---------- Voix du parent (éditeur de carte) ----------
export async function saveParentAmazighVoice(lang, cardId, blob) {
  if (!isAmazighLang(lang) || !CARD_ID_RE.test(String(cardId || '')) || !(blob instanceof Blob) || !blob.size) return false;
  if (!hasCaches()) throw new Error('Ce navigateur ne peut pas garder la voix amazighe.');
  try {
    const cache = await caches.open(parentCacheName(lang));
    await cache.put(parentKey(lang, cardId), new Response(blob, { headers: { 'Content-Type': safeAudioType(blob.type) } }));
  } catch (err) {
    throw quotaError(err) ? fullMemoryError() : err;
  }
  if (memory.lang === lang) memory.parent.set(cardId, blob);
  return true;
}

export async function removeParentAmazighVoice(lang, cardId) {
  if (!isAmazighLang(lang) || !hasCaches()) return;
  try {
    if (await caches.has(parentCacheName(lang))) await (await caches.open(parentCacheName(lang))).delete(parentKey(lang, cardId));
  } catch { /* rien à effacer */ }
  if (memory.lang === lang) memory.parent.delete(cardId);
}

// Carte supprimée : ses voix amazighes enregistrées par le parent partent aussi.
export async function removeParentAmazighVoicesOfCard(cardId) {
  for (const lang of ['shi', 'tzm', 'rif', 'zgh']) await removeParentAmazighVoice(lang, cardId);
}

// ---------- Packs vocaux à la carte ----------
export async function getInstalledVoicePacks() {
  const saved = await db.getSetting(PACK_STATE_KEY);
  const state = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  known.packs = state;
  return state;
}

async function savePackState(lang, info) {
  const state = await getInstalledVoicePacks();
  if (info) state[lang] = info; else delete state[lang];
  known.packs = state;
  await db.setSetting(PACK_STATE_KEY, state);
}

async function countPackVoices(lang) {
  try {
    if (!hasCaches()) return (memoryOnly.get(lang) || new Map()).size;
    if (!(await caches.has(packCacheName(lang)))) return 0;
    return (await (await caches.open(packCacheName(lang))).keys()).length;
  } catch {
    return 0;
  }
}

async function getDeclinedPacks() {
  const saved = await db.getSetting(PACK_DECLINED_KEY).catch(() => null);
  const state = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  known.declined = state;
  return state;
}

async function setDeclined(lang, declined) {
  const state = await getDeclinedPacks();
  if (declined) state[lang] = true; else delete state[lang];
  known.declined = state;
  await db.setSetting(PACK_DECLINED_KEY, state).catch(() => {});
}

// v10.7.2 : l'Accueil lit l'état des packs une fois au démarrage (sans bloquer l'écran).
export function readAmazighPackState() {
  return Promise.all([getInstalledVoicePacks().catch(() => ({})), getDeclinedPacks()]).then(() => emitProgress(true)).catch(() => {});
}

// Un fichier du site, 20 s au plus (un réseau bloqué ne laisse pas le téléchargement en attente sans fin).
const FETCH_WAIT_MS = 20000;
const PARALLEL_DOWNLOADS = 6;
const PACK_VERSION_HEADER = 'X-Kalimati-Pack-Version'; // v10.7.2 : version du pack de chaque voix gardée
async function fetchWithin(url) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), FETCH_WAIT_MS) : null;
  try {
    return await fetch(url, { cache: 'no-cache', signal: controller ? controller.signal : undefined });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Liste des voix publiée sur le site (voix/amz-<variété>-index.json), ou null.
async function fetchPackIndex(lang) {
  try {
    const response = await fetchWithin(`./voix/amz-${lang}-index.json`);
    if (!response.ok) return null;
    const index = await response.json();
    return index && index.lang === lang && index.entries && typeof index.entries === 'object' && !Array.isArray(index.entries) ? index : null;
  } catch {
    return null;
  }
}

// Voix d'essai fabriquées par une machine (synthèse) : à faire écouter par un locuteur natif.
const isTrialIndex = (index) => Boolean(index && (index.trial === true || /mms|synth/i.test(String(index.source || ''))));
const shortText = (value) => String(value || '').replace(/[<>]/g, '').slice(0, 80);

// Télécharge le pack d'une seule variété (bouton de Progrès, ou une fois tout seul : voir autoInstallAmazighVoicePack).
// v10.7.1 : packs d'essai publiés (voix de synthèse), à faire écouter par un locuteur natif (voix/amz-<variété>-index.json).
export async function downloadAmazighVoicePack(lang, { onProgress, index: knownIndex = null } = {}) {
  if (!isAmazighLang(lang)) throw new Error('Variété amazighe inconnue.');
  const name = langInfo(lang).name;
  const index = knownIndex && knownIndex.lang === lang ? knownIndex : await fetchPackIndex(lang);
  const entries = index ? index.entries : {};
  const ids = Object.keys(entries).filter((id) => CARD_ID_RE.test(id)).slice(0, MAX_VOICES);
  if (!ids.length) {
    throw new Error(`Pas encore de pack vocal ${name} (ou pas d’internet). En attendant : enregistrez votre voix sur les cartes, ou importez un fichier « Voix du Douar ».`);
  }
  // v10.7.2 : un seul téléchargement à la fois par variété (bouton de Progrès et arrivée automatique).
  if (progress.has(lang)) throw new Error(`Les voix ${name} arrivent déjà. Patientez un peu.`);
  const got = new Map();
  failures.delete(lang);
  stopped.delete(lang);
  arriving.set(lang, got);
  progress.set(lang, { done: 0, total: ids.length });
  emitProgress(true);
  try {
    const noCache = { match: async () => undefined, put: async () => {} };
    const cache = hasCaches() ? await caches.open(packCacheName(lang)) : noCache;
    if (!hasCaches()) memoryOnly.set(lang, new Map());
    // v10.7.1 : des voix humaines importées (« Voix du Douar ») ne sont jamais remplacées par des voix d'essai.
    // v10.7.3 : la base du téléphone a 6 s pour répondre (sur iPhone, elle peut rester bloquée).
    const before = (await within(getInstalledVoicePacks(), STEP_WAIT_MS, {}))[lang];
    const keepHuman = Boolean(before && before.source === 'douar');
    const version = String(Number(index.version) || 1);
    const sameVersion = Boolean(before && before.source === 'site' && String(Number(before.version) || 1) === version);
    // v10.7.2 : plusieurs voix à la fois (avant : une par une, 20 s ou plus sur téléphone) ; chaque carte parle
    // dès que sa voix est arrivée ; une voix déjà gardée (même version) n'est pas retéléchargée, donc un
    // téléchargement coupé (appli fermée, réseau perdu) reprend là où il s'était arrêté.
    const keep = (id, blob) => {
      if (stopped.has(lang)) return;
      got.set(id, blob);
      if (!hasCaches()) memoryOnly.get(lang)?.set(id, blob);
      if (memory.lang === lang) memory.pack.set(id, blob);
    };
    let saved = 0;
    let done = 0;
    let next = 0;
    let full = false;
    const fetchOne = async (id) => {
      const key = packKey(lang, id);
      try {
        const old = await cache.match(key);
        const oldVersion = old ? old.headers.get(PACK_VERSION_HEADER) : null;
        if (old && (keepHuman || oldVersion === version || (!oldVersion && sameVersion))) {
          const blob = await old.blob();
          if (blob.size) { saved += 1; keep(id, keepHuman ? blob : asMpeg(blob)); return; }
        }
        const response = await fetchWithin(key);
        if (!response.ok) return;
        const blob = asMpeg(await response.blob());
        if (!blob.size || blob.size > MAX_VOICE_BYTES) return;
        await cache.put(key, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg', [PACK_VERSION_HEADER]: version } }));
        saved += 1;
        keep(id, blob);
      } catch (err) {
        if (quotaError(err)) full = true;
        // une voix manquante n'arrête pas le pack
      }
    };
    const worker = async () => {
      while (!full && !stopped.has(lang) && next < ids.length) {
        const id = ids[next];
        next += 1;
        await fetchOne(id);
        done += 1;
        progress.set(lang, { done, total: ids.length });
        emitProgress();
        if (onProgress) onProgress(done, ids.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_DOWNLOADS, ids.length) }, worker));
    // Pack supprimé par le parent pendant le téléchargement : on s'arrête là, sans rien remettre.
    if (stopped.has(lang)) {
      memoryOnly.delete(lang);
      if (hasCaches()) await caches.delete(packCacheName(lang)).catch(() => {});
      if (memory.lang === lang) memory.pack = new Map();
      throw new Error('Téléchargement arrêté : pack supprimé.');
    }
    if (full) {
      if (hasCaches()) await caches.delete(packCacheName(lang)).catch(() => {});
      await savePackState(lang, null).catch(() => {});
      if (memory.lang === lang) memory.pack = new Map();
      throw fullMemoryError();
    }
    if (!saved) {
      if (hasCaches() && !(await countPackVoices(lang))) await caches.delete(packCacheName(lang)).catch(() => {});
      throw new Error('Le téléchargement n’a pas marché (internet coupé ?). Réessayez plus tard.');
    }
    const info = {
      version: Number(version),
      count: await countPackVoices(lang),
      expected: ids.length,
      source: keepHuman ? 'douar' : 'site',
      trial: isTrialIndex(index),
      model: shortText(index.source),
      licence: shortText(index.licence),
      installedAt: new Date().toISOString(),
    };
    // v10.7.2 : même si la base du téléphone refuse de noter l'état, les voix gardées restent utilisables.
    known.packs = { ...(known.packs || {}), [lang]: info };
    await within((async () => {
      await savePackState(lang, info);
      await setDeclined(lang, false);
    })(), STEP_WAIT_MS, null); // l'état sera refait à la prochaine ouverture
    if (memory.lang === lang) await loadAmazighVoices(lang);
    announce();
    return info;
  } finally {
    progress.delete(lang);
    if (arriving.get(lang) === got) arriving.delete(lang);
    emitProgress(true);
  }
}

// Supprime le pack d'une variété. Les voix enregistrées par le parent restent.
// v10.7.1 : le pack supprimé ne revient pas tout seul (seulement avec le bouton « Télécharger »).
export async function removeAmazighVoicePack(lang) {
  if (!isAmazighLang(lang)) return;
  if (progress.has(lang)) stopped.add(lang); // v10.7.2 : arrête aussi un téléchargement en cours
  memoryOnly.delete(lang);
  if (hasCaches()) await caches.delete(packCacheName(lang)).catch(() => {});
  await savePackState(lang, null);
  await setDeclined(lang, true);
  if (memory.lang === lang) memory.pack = new Map();
  announce();
}

// v10.7.1 : sans pack dans le téléphone, celui de la variété choisie se télécharge tout seul, en arrière-plan.
// Seulement des fichiers du site Kalimati (rien ne part du téléphone). Jamais par-dessus un pack
// « Voix du Douar », ni après une suppression par le parent. Aucun message d'erreur (l'Accueil montre l'état).
// v10.7.2 : un pack incomplet (téléchargement coupé) est complété ; nouvel essai au retour dans l'appli ou
// d'internet (3 essais au plus par ouverture, 15 s d'écart au moins).
const MAX_AUTO_TRIES = 3;
const RETRY_AFTER_MS = 15000;
const STEP_WAIT_MS = 6000; // v10.7.3 : une étape bloquée (base ou mémoire du téléphone) ne bloque plus l'arrivée des voix
const STUCK_AFTER_MS = 45000;
const autoState = new Map(); // variété -> { tries, at, complete, running, step }
let autoQueue = Promise.resolve(null);
// Attend une promesse au plus ms millisecondes, sinon rend la valeur de repli.
const within = (promise, ms, fallback) => Promise.race([
  Promise.resolve(promise).catch(() => fallback),
  new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
]);
export function autoInstallAmazighVoicePack(lang) {
  if (!isAmazighLang(lang)) return Promise.resolve(null);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(null);
  const state = autoState.get(lang) || { tries: 0, at: 0, complete: false, running: false, step: '' };
  // v10.7.3 : un essai resté bloqué plus de 45 s (sans téléchargement en cours) est abandonné.
  const stuck = state.running && !progress.has(lang) && Date.now() - state.at > STUCK_AFTER_MS;
  if (stuck) state.running = false;
  if (state.complete || state.running || state.tries >= MAX_AUTO_TRIES || (!stuck && state.at && Date.now() - state.at < RETRY_AFTER_MS)) return Promise.resolve(null);
  state.tries += 1;
  state.running = true;
  state.at = Date.now();
  state.step = 'départ';
  autoState.set(lang, state);
  const step = (name) => { state.step = name; emitProgress(true); };
  // Une variété après l'autre (si le parent change vite de langue), sans attendre un essai bloqué.
  const previous = within(autoQueue, STEP_WAIT_MS, null);
  const run = previous.then(async () => {
    try {
      step('réglages');
      const [installed, declined] = await Promise.all([
        within(getInstalledVoicePacks(), STEP_WAIT_MS, {}),
        within(getDeclinedPacks(), STEP_WAIT_MS, {}),
      ]);
      const info = installed[lang];
      if (declined[lang] || (info && info.source !== 'site')) { state.complete = true; emitProgress(true); return null; }
      step('liste du site');
      const index = await fetchPackIndex(lang);
      step('voix gardées');
      const stillThere = await within(countPackVoices(lang), STEP_WAIT_MS, 0);
      if (!index) {
        if (!stillThere) {
          failures.set(lang, 'pas d’internet, ou site injoignable');
          logDiagnostic(LOG_TYPES.SYNC_PACK, 'voice_pack_index_unreachable', { packId: `amz-${lang}` }); // v10.8
        }
        emitProgress(true);
        return null;
      }
      const expected = Object.keys(index.entries).filter((id) => CARD_ID_RE.test(id)).slice(0, MAX_VOICES).length;
      const upToDate = info && (Number(info.version) || 1) >= (Number(index.version) || 1);
      if (upToDate && stillThere >= expected) {
        state.complete = true;
        failures.delete(lang);
        // v10.7.1 n'écrivait pas le nombre attendu : on le note pour l'Accueil.
        if (!Number(info.expected)) await within(savePackState(lang, { ...info, expected }), STEP_WAIT_MS, null);
        emitProgress(true);
        return null;
      }
      step('téléchargement');
      const done = await downloadAmazighVoicePack(lang, { index });
      state.complete = Boolean(done && done.count >= expected);
      if (done && done.count < expected) logDiagnostic(LOG_TYPES.SYNC_PACK, `voice_pack_incomplete ${done.count}/${expected}`, { packId: `amz-${lang}`, sev: 'info' }); // v10.8
      if (done && !hasCaches()) logDiagnostic(LOG_TYPES.SYNC_PACK, 'no_cache_storage_memory_only', { packId: `amz-${lang}`, sev: 'info' }); // v10.8
      return done;
    } catch (err) {
      failures.set(lang, String(err?.message || err).slice(0, 120));
      logDiagnostic(LOG_TYPES.SYNC_PACK, `voice_pack_failed ${err?.name || ''} ${String(err?.message || err).slice(0, 80)}`, { packId: `amz-${lang}` }); // v10.8
      emitProgress(true);
      return null;
    } finally {
      state.running = false;
      state.at = Date.now();
      state.step = '';
      emitProgress(true);
    }
  });
  autoQueue = run.catch(() => null);
  return autoQueue;
}

// Étape en cours de l'arrivée automatique (pour l'Accueil, si elle dure).
export const amazighAutoStep = (lang) => {
  const state = autoState.get(lang);
  return state && state.running ? { step: state.step, since: state.at } : null;
};

// v10.7.2 : bouton « Réessayer » de l'Accueil (même règles : jamais après une suppression par le parent).
export function retryAmazighVoicePack(lang) {
  const state = autoState.get(lang);
  if (state && state.running) return autoQueue;
  autoState.delete(lang);
  failures.delete(lang);
  emitProgress(true);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    failures.set(lang, 'pas d’internet');
    emitProgress(true);
    return Promise.resolve(null);
  }
  return autoInstallAmazighVoicePack(lang);
}

// ---------- « Voix du Douar » : partage de voix d'adultes entre familles (fichier .json) ----------
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result || '');
      resolve(s.includes(',') ? s.slice(s.indexOf(',') + 1) : s);
    };
    reader.onerror = () => reject(reader.error || new Error('Lecture du son impossible.'));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(b64, type) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

// Prépare le fichier (voix du parent d'abord, puis voix du pack). Aucune donnée d'enfant :
// ni prénom, ni âge, ni score, ni photo, ni carte personnelle.
export async function exportDouarVoicePack(lang) {
  if (!isAmazighLang(lang)) throw new Error('Choisissez une variété amazighe.');
  const [parent, pack] = await Promise.all([readCache(parentCacheName(lang)), readCache(packCacheName(lang))]);
  const voices = {};
  for (const source of [parent, pack]) {
    for (const [cardId, blob] of source) {
      if (voices[cardId] || !shareableId(cardId) || blob.size > MAX_VOICE_BYTES) continue;
      voices[cardId] = { mime: safeAudioType(blob.type), dataBase64: await blobToBase64(blob) };
    }
  }
  const count = Object.keys(voices).length;
  if (!count) throw new Error(`Aucune voix ${langInfo(lang).name} à partager. Enregistrez d’abord votre voix sur des cartes (mode parent).`);
  const payload = { format: DOUAR_FORMAT, lang, createdAt: new Date().toISOString().slice(0, 10), count, voices };
  const fileName = `voix-du-douar-${lang}-${payload.createdAt}.kalimati-voicepack.json`;
  return { fileName, count, file: new File([JSON.stringify(payload)], fileName, { type: 'application/json' }) };
}

export async function importDouarVoicePack(file) {
  if (!file) throw new Error('Aucun fichier choisi.');
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Fichier trop gros pour « Voix du Douar » (40 Mo au plus).');
  if (!hasCaches()) throw new Error('Ce navigateur ne peut pas garder de voix hors ligne.');
  let raw = null;
  try { raw = JSON.parse(await file.text()); } catch { raw = null; }
  if (!raw || raw.format !== DOUAR_FORMAT || !isAmazighLang(raw.lang) || !raw.voices || typeof raw.voices !== 'object' || Array.isArray(raw.voices)) {
    throw new Error('Ce fichier n’est pas un fichier « Voix du Douar ».');
  }
  const { lang } = raw;
  const cache = await caches.open(packCacheName(lang));
  let imported = 0;
  let skipped = 0;
  for (const [cardId, item] of Object.entries(raw.voices).slice(0, MAX_VOICES)) {
    const data = item && typeof item.dataBase64 === 'string' ? item.dataBase64 : '';
    if (!shareableId(cardId) || !data || data.length > Math.ceil(MAX_VOICE_BYTES / 3) * 4 + 8) { skipped += 1; continue; }
    const type = safeAudioType(item.mime);
    let blob = null;
    try { blob = base64ToBlob(data, type); } catch { blob = null; }
    if (!blob || !blob.size) { skipped += 1; continue; }
    try {
      await cache.put(packKey(lang, cardId), new Response(blob, { headers: { 'Content-Type': type } }));
      imported += 1;
    } catch (err) {
      if (quotaError(err)) throw fullMemoryError();
      skipped += 1;
    }
  }
  if (!imported) {
    if (!(await countPackVoices(lang))) await caches.delete(packCacheName(lang)).catch(() => {});
    throw new Error('Aucune voix utilisable dans ce fichier.');
  }
  // v10.7.1 : si des voix d'essai (robot) étaient déjà là, on le garde en mémoire (Progrès le dit).
  const before = (await getInstalledVoicePacks().catch(() => ({})))[lang];
  const trial = Boolean(before && before.trial);
  await savePackState(lang, { version: Number(before?.version) || 1, count: await countPackVoices(lang), source: 'douar', trial, model: trial ? shortText(before.model) : '', installedAt: new Date().toISOString() });
  if (memory.lang === lang) await loadAmazighVoices(lang);
  announce();
  return { lang, importedCount: imported, skipped };
}
