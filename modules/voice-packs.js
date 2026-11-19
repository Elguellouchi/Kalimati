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

async function readCache(name) {
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
      if (blob && blob.size) out.set(id, blob);
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
      ? await Promise.all([readCache(parentCacheName(code)), readCache(packCacheName(code))])
      : [new Map(), new Map()];
    if (token !== loadToken) return;
    memory.lang = code;
    memory.parent = parent;
    memory.pack = pack;
  })().catch(() => {}).finally(() => { if (token === loadToken) loading = null; });
  return loading;
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
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
}

async function savePackState(lang, info) {
  const state = await getInstalledVoicePacks();
  if (info) state[lang] = info; else delete state[lang];
  await db.setSetting(PACK_STATE_KEY, state);
}

async function countPackVoices(lang) {
  try {
    if (!hasCaches() || !(await caches.has(packCacheName(lang)))) return 0;
    return (await (await caches.open(packCacheName(lang))).keys()).length;
  } catch {
    return 0;
  }
}

async function getDeclinedPacks() {
  const saved = await db.getSetting(PACK_DECLINED_KEY).catch(() => null);
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
}

async function setDeclined(lang, declined) {
  const state = await getDeclinedPacks();
  if (declined) state[lang] = true; else delete state[lang];
  await db.setSetting(PACK_DECLINED_KEY, state).catch(() => {});
}

// Un fichier du site, 20 s au plus (un réseau bloqué ne laisse pas le téléchargement en attente sans fin).
const FETCH_WAIT_MS = 20000;
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
  if (!hasCaches()) throw new Error('Ce navigateur ne peut pas garder de voix hors ligne.');
  const name = langInfo(lang).name;
  const index = knownIndex && knownIndex.lang === lang ? knownIndex : await fetchPackIndex(lang);
  const entries = index ? index.entries : {};
  const ids = Object.keys(entries).filter((id) => CARD_ID_RE.test(id)).slice(0, MAX_VOICES);
  if (!ids.length) {
    throw new Error(`Pas encore de pack vocal ${name} (ou pas d’internet). En attendant : enregistrez votre voix sur les cartes, ou importez un fichier « Voix du Douar ».`);
  }
  const cache = await caches.open(packCacheName(lang));
  // v10.7.1 : des voix humaines importées (« Voix du Douar ») ne sont jamais remplacées par des voix d'essai.
  const before = (await getInstalledVoicePacks().catch(() => ({})))[lang];
  const keepHuman = Boolean(before && before.source === 'douar');
  let saved = 0;
  for (let i = 0; i < ids.length; i += 1) {
    const key = packKey(lang, ids[i]);
    try {
      if (keepHuman && await cache.match(key)) { saved += 1; if (onProgress) onProgress(i + 1, ids.length); continue; }
      const response = await fetchWithin(key);
      if (response.ok) {
        const blob = await response.blob();
        if (blob.size && blob.size <= MAX_VOICE_BYTES) {
          await cache.put(key, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
          saved += 1;
        }
      }
    } catch (err) {
      if (quotaError(err)) {
        await caches.delete(packCacheName(lang)).catch(() => {});
        await savePackState(lang, null).catch(() => {});
        if (memory.lang === lang) memory.pack = new Map();
        throw fullMemoryError();
      }
      // une voix manquante n'arrête pas le pack
    }
    if (onProgress) onProgress(i + 1, ids.length);
  }
  if (!saved) {
    if (!(await countPackVoices(lang))) await caches.delete(packCacheName(lang)).catch(() => {});
    throw new Error('Le téléchargement n’a pas marché (internet coupé ?). Réessayez plus tard.');
  }
  const info = {
    version: Number(index.version) || 1,
    count: await countPackVoices(lang),
    source: keepHuman ? 'douar' : 'site',
    trial: isTrialIndex(index),
    model: shortText(index.source),
    licence: shortText(index.licence),
    installedAt: new Date().toISOString(),
  };
  await savePackState(lang, info);
  await setDeclined(lang, false);
  if (memory.lang === lang) await loadAmazighVoices(lang);
  announce();
  return info;
}

// Supprime le pack d'une variété. Les voix enregistrées par le parent restent.
// v10.7.1 : le pack supprimé ne revient pas tout seul (seulement avec le bouton « Télécharger »).
export async function removeAmazighVoicePack(lang) {
  if (!isAmazighLang(lang)) return;
  if (hasCaches()) await caches.delete(packCacheName(lang)).catch(() => {});
  await savePackState(lang, null);
  await setDeclined(lang, true);
  if (memory.lang === lang) memory.pack = new Map();
  announce();
}

// v10.7.1 : sans pack dans le téléphone, celui de la variété choisie se télécharge tout seul, une fois par
// ouverture de l'appli, en arrière-plan. Seulement des fichiers du site Kalimati (rien ne part du téléphone).
// Jamais par-dessus un pack « Voix du Douar », ni après une suppression par le parent. Aucun message d'erreur.
const autoTried = new Set();
let autoQueue = Promise.resolve(null);
export function autoInstallAmazighVoicePack(lang) {
  if (!isAmazighLang(lang) || !hasCaches() || autoTried.has(lang)) return Promise.resolve(null);
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve(null);
  autoTried.add(lang);
  // Une variété après l'autre (si le parent change vite de langue).
  autoQueue = autoQueue.then(async () => {
    const [installed, declined] = await Promise.all([getInstalledVoicePacks().catch(() => ({})), getDeclinedPacks()]);
    const info = installed[lang];
    if (declined[lang] || (info && info.source !== 'site')) return null;
    const index = await fetchPackIndex(lang);
    if (!index) return null;
    const stillThere = info ? await countPackVoices(lang) : 0;
    if (info && stillThere && (Number(info.version) || 1) >= (Number(index.version) || 1)) return null;
    return downloadAmazighVoicePack(lang, { index });
  }).catch(() => null);
  return autoQueue;
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
