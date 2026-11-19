// ☁️ Synchronisation Cloud Zero-Knowledge (AES-256-GCM) entre Papa, Maman, AVS et Orthophoniste / Psy (Hosna Mehri)
// + 📊 Cohorte Clinique Longitudinale Anonymisée (T0, T+90, T+180 — ATEC, LME/MLU, autonomie ABA & réduction des crises ABC).
//
// Version v10.2 Finale (pré-configurée avec le projet Supabase public de Kalimati) :
// 1. URL Supabase et clé publique `sb_publishable_...` pré-remplies par défaut : aucun réglage technique à taper sur les téléphones
//    de Papa, Maman, l'AVS ou Hosna Mehri (seule la clé secrète familiale AES-256 `KALI-SYNC-...` ou le lien `#key=` est nécessaire).
// 2. Support natif des nouvelles clés Supabase `sb_publishable_...` (en-tête `apikey` sans erreur JWT) et des clés JWT `eyJ...`.
// 3. Synchronisation automatique en arrière-plan (Wi-Fi / réseau) + fusion CRDT sans perte.
// 4. Collecte longitudinale automatisée T0 / T+90 / T+180 vers `kalimati_clinical_cohort` (avec opt-in Loi 09-08 CNDP).
import * as db from '../db.js';
import { h, btn, dayKey, percent } from './util.js';
import { profile, clinic } from './aba.js';
import { blobToDataUrl, dataUrlToBlob } from '../media.js';

export const DEFAULT_SUPABASE_URL = 'https://ytemnsbigymgvogarzzp.supabase.co';
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8jLXfni_FP6x_NAqGKiRMQ_E3aOkKSV';

const SYNC_SETTINGS_KEY = 'cloudSyncConfig';
const LAST_SYNC_KEY = 'cloudSyncLastState';
const COHORT_OPTIN_KEY = 'clinicalCohortOptIn';
const COHORT_RANDOM_ID_KEY = 'clinicalCohortRandomId'; // v10.5 : identifiant tiré au hasard (plus dérivé du prénom)
const COHORT_OLD_ID_KEY = 'clinicalCohortOldIdCleaned';
const SHARED_SETTING_KEYS = [
  'cols', 'toiletReminder', 'levels', 'stories',
  'atec_history', 'atecHistory', 'aacHistory', 'touch',
  'visualStyle', 'hideFriends', 'friendsAlbum', 'morphAuto', 'childGender',
];

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text || '').trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveAesKey(passphrase, saltBytes, iterations = 100000) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase.trim()), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptSyncBundle(payloadObj, familyKey) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(familyKey, salt);
  const plainBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plainBytes);
  return {
    kalimatiEncryptedSync: true,
    cipher: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256-100K',
    updatedAt: new Date().toISOString(),
    salt: bufToB64(salt.buffer),
    iv: bufToB64(iv.buffer),
    ciphertext: bufToB64(cipherBuf),
  };
}

export async function decryptSyncBundle(bundleObj, familyKey) {
  const parsed = typeof bundleObj === 'string' ? JSON.parse(bundleObj) : bundleObj;
  if (!parsed || !parsed.ciphertext || !parsed.salt || !parsed.iv) {
    throw new Error('Format de paquet chiffré invalide.');
  }
  const salt = new Uint8Array(b64ToBuf(parsed.salt));
  const iv = new Uint8Array(b64ToBuf(parsed.iv));
  // v10.5 : lit aussi les paquets d'une future version plus forte (champ « iterations »), sans rien changer à l'envoi.
  const declared = Number(parsed.iterations);
  const tries = Number.isInteger(declared) && declared >= 100000 && declared <= 2000000 && declared !== 100000 ? [declared, 100000] : [100000];
  for (const iterations of tries) {
    try {
      const key = await deriveAesKey(familyKey, salt, iterations);
      const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64ToBuf(parsed.ciphertext));
      return JSON.parse(new TextDecoder().decode(plainBuf));
    } catch { /* essai suivant */ }
  }
  throw new Error('Clé familiale AES-256 incorrecte : déchiffrement refusé.');
}

export function generateSyncPassphrase() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = new Uint8Array(12);
  crypto.getRandomValues(rand);
  const seg = (s, l) => Array.from(rand.slice(s, s + l), (b) => chars[b % chars.length]).join('');
  return `KALI-SYNC-${seg(0, 4)}-${seg(4, 4)}-${seg(8, 4)}`;
}

// Construit les en-têtes REST Supabase compatibles avec `sb_publishable_...` et les clés JWT `eyJ...`
function buildSupabaseHeaders(apiKey, extra = {}) {
  const cleanKey = String(apiKey || '').trim();
  const headers = {
    apikey: cleanKey,
    'Content-Type': 'application/json',
    ...extra,
  };
  if (cleanKey.startsWith('eyJ')) {
    headers.Authorization = `Bearer ${cleanKey}`;
  }
  return headers;
}

// Requête fetch résiliente (teste d'abord sans Bearer pour sb_publishable_, puis avec Bearer en secours si 401)
// v10.3.1 : chaque appel Supabase s'arrête au bout de 10 s (avant, un réseau lent pouvait bloquer sans fin).
const SUPABASE_TIMEOUT_MS = 10000;
async function fetchWithTimeout(url, options) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctrl?.abort(), SUPABASE_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, ...(ctrl ? { signal: ctrl.signal } : {}) });
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error('Le serveur Supabase ne répond pas (délai dépassé). Réessayez plus tard.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function supabaseFetch(url, apiKey, options = {}) {
  const headers1 = buildSupabaseHeaders(apiKey, options.headers || {});
  const res1 = await fetchWithTimeout(url, { ...options, headers: headers1 });
  if (res1.status === 401 && !headers1.Authorization) {
    const headers2 = { ...headers1, Authorization: `Bearer ${String(apiKey || '').trim()}` };
    return fetchWithTimeout(url, { ...options, headers: headers2 });
  }
  return res1;
}

// Lecture et fusion unifiée des bilans ATEC (`atec_history` et `atecHistory`)
export async function getUnifiedAtecList() {
  const [a, b] = await Promise.all([
    db.getSetting('atec_history'),
    db.getSetting('atecHistory'),
  ]);
  const listA = Array.isArray(a) ? a : [];
  const listB = Array.isArray(b) ? b : [];
  const map = new Map();
  for (const item of [...listA, ...listB]) {
    if (!item) continue;
    const key = item.id || `${item.day || ''}-${item.ts || item.total || ''}`;
    map.set(key, item);
  }
  return Array.from(map.values()).sort((x, y) => (x.ts || 0) - (y.ts || 0));
}

async function saveUnifiedAtecList(list) {
  await Promise.all([
    db.setSetting('atec_history', list),
    db.setSetting('atecHistory', list),
  ]);
}

// ---------- Astuce cryptographique du fragment d'URL (#key=KALI-SYNC-...) ----------
// v10.5 : la clé du lien magique est retirée de l'adresse tout de suite, avant toute autre action (lecture synchrone).
// Elle n'est jamais envoyée au serveur web (le morceau après # reste dans le téléphone), et ne reste pas dans l'historique.
let pendingMagicKey = null;
export function captureMagicKeyFromUrl() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash || '';
  const match = hash.match(/[#&]key=(KALI-[A-Z0-9-]{8,40})/i);
  if (!match || !match[1]) return pendingMagicKey;
  pendingMagicKey = match[1].toUpperCase();
  const cleanHash = hash.replace(/([#&])key=KALI-[A-Z0-9-]{8,40}/i, '').replace(/^#&/, '#');
  try {
    window.history.replaceState(null, '', window.location.pathname + window.location.search + (cleanHash === '#' ? '' : cleanHash));
  } catch { /* très ancien navigateur */ }
  return pendingMagicKey;
}

function showMagicKeyWarning() {
  if (typeof document === 'undefined') return;
  const note = h('div', { class: 'magic-key-toast', role: 'status' },
    '🔒 Clé de synchro enregistrée dans ce téléphone. Ne transférez pas ce lien : il contient la clé secrète de la famille.');
  Object.assign(note.style, {
    position: 'fixed', left: '12px', right: '12px', bottom: '96px', zIndex: '9999', padding: '12px 14px',
    background: '#FFF6E5', color: '#5A3A00', border: '2px solid #E0A63B', borderRadius: '14px',
    fontWeight: '700', boxShadow: '0 4px 14px rgba(0,0,0,.15)',
  });
  note.onclick = () => note.remove();
  document.body.append(note);
  setTimeout(() => note.remove(), 10000);
}

export async function initCloudSyncFromUrlAndAuto() {
  if (typeof window === 'undefined') return;
  const importedKey = captureMagicKeyFromUrl();
  if (importedKey) {
    pendingMagicKey = null;
    await saveCloudSyncConfig({ familyKey: importedKey, autoSyncWifi: true });
    showMagicKeyWarning();
  }

  const cfg = await getCloudSyncConfig();
  if (cfg.autoSyncWifi && cfg.supabaseUrl && cfg.supabaseAnonKey && navigator.onLine) {
    syncNowWithTeam({ includeMedia: false }).catch(() => {});
  }
}

export async function buildLocalSyncPayload({ includeMedia = false } = {}) {
  const [cards, trials, abcLogs, orthoLogs, scheduleLogs, visuals, atecUnified] = await Promise.all([
    db.getAllCards(),
    db.getAllTrials(),
    db.getAllAbcLogs(),
    db.getAllOrthoLogs(),
    db.getAllScheduleLogs(),
    includeMedia ? db.getAllVisualOverrides() : Promise.resolve([]),
    getUnifiedAtecList(),
  ]);

  const settings = {};
  for (const k of SHARED_SETTING_KEYS) {
    const val = await db.getSetting(k);
    if (val !== undefined && val !== null) settings[k] = val;
  }
  settings.atec_history = atecUnified;
  settings.atecHistory = atecUnified;

  const localProfile = await db.getSetting('profile');
  if (localProfile && localProfile.name) {
    settings.profile = localProfile;
  }

  const [matinCfg, soirCfg, routinesCfg] = await Promise.all([
    db.getScheduleConfig('matin').catch(() => null),
    db.getScheduleConfig('soir').catch(() => null),
    db.getScheduleConfig('routines').catch(() => null),
  ]);

  const serializedCards = [];
  for (const c of cards) {
    const copy = { ...c };
    if (includeMedia) {
      for (const f of ['photo', 'video', 'audioFr', 'audioDr']) {
        copy[f] = c[f] instanceof Blob ? await blobToDataUrl(c[f]) : null;
      }
    } else {
      delete copy.photo;
      delete copy.video;
      delete copy.audioFr;
      delete copy.audioDr;
    }
    serializedCards.push(copy);
  }

  const serializedVisuals = [];
  if (includeMedia) {
    for (const v of visuals) {
      if (v && v.key && v.blob instanceof Blob) {
        serializedVisuals.push({
          key: v.key,
          meta: v.meta || {},
          ts: v.ts || Date.now(),
          data: await blobToDataUrl(v.blob),
        });
      }
    }
  }

  return {
    schema: 'kalimati-sync-v1',
    exportedAt: Date.now(),
    authorRole: clinic?.intervenant || 'Parent',
    includeMedia,
    cards: serializedCards,
    trials,
    abcLogs,
    orthoLogs,
    scheduleLogs,
    scheduleConfig: { matin: matinCfg, soir: soirCfg, routines: routinesCfg },
    settings,
    visuals: serializedVisuals,
  };
}

// v10.5 (S17) : ce qui arrive de la synchro est vérifié avant d'entrer dans le téléphone.
const SAFE_KEY = (k) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
const MEDIA_FIELDS = ['photo', 'video', 'audioFr', 'audioDr'];
function cleanRecord(raw, { maxStr = 2000, media = false } = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.id !== 'string' || !raw.id || raw.id.length > 120) return null;
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!SAFE_KEY(k)) continue;
    if (media && MEDIA_FIELDS.includes(k)) { out[k] = typeof v === 'string' && v.startsWith('data:') ? v : null; continue; }
    if (typeof v === 'string') out[k] = v.slice(0, maxStr);
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null) out[k] = v;
    else if (typeof v === 'object') { try { out[k] = JSON.parse(JSON.stringify(v)); } catch { /* ignoré */ } }
  }
  return out;
}
const cleanList = (list, opts) => (Array.isArray(list) ? list.slice(0, 50000).map((x) => cleanRecord(x, opts)).filter(Boolean) : []);

function mergeById(localList = [], remoteList = []) {
  const map = new Map();
  for (const item of localList) {
    if (item && item.id) map.set(item.id, item);
  }
  let added = 0;
  for (const item of remoteList) {
    if (!item || !item.id) continue;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      added += 1;
    } else if ((item.ts || item.updatedAt || 0) > (existing.ts || existing.updatedAt || 0)) {
      map.set(item.id, { ...existing, ...item });
    }
  }
  return { merged: Array.from(map.values()), added };
}

export async function mergeRemoteSyncPayload(remote) {
  if (!remote || remote.schema !== 'kalimati-sync-v1') {
    throw new Error('Format de synchronisation incompatible.');
  }

  const [localCards, localTrials, localAbc, localOrtho, localSched, localAtec] = await Promise.all([
    db.getAllCards(),
    db.getAllTrials(),
    db.getAllAbcLogs(),
    db.getAllOrthoLogs(),
    db.getAllScheduleLogs(),
    getUnifiedAtecList(),
  ]);

  const localCardMap = new Map(localCards.map((c) => [c.id, c]));
  let newOrUpdatedCards = 0;
  for (const rc of cleanList(remote.cards, { maxStr: 400, media: true })) {
    const lc = localCardMap.get(rc.id);
    const hydrated = { ...rc };
    for (const f of ['photo', 'video', 'audioFr', 'audioDr']) {
      if (typeof rc[f] === 'string' && rc[f].startsWith('data:')) {
        hydrated[f] = await dataUrlToBlob(rc[f]);
      } else if (lc && lc[f]) {
        hydrated[f] = lc[f];
      } else {
        hydrated[f] = null;
      }
    }
    if (!lc || lc.fr !== hydrated.fr || lc.dr !== hydrated.dr || lc.ar !== hydrated.ar || lc.hidden !== hydrated.hidden) {
      newOrUpdatedCards += 1;
    }
    localCardMap.set(rc.id, { ...(lc || {}), ...hydrated });
  }
  await db.putCards(Array.from(localCardMap.values()));

  const trialsRes = mergeById(localTrials, cleanList(remote.trials));
  const abcRes = mergeById(localAbc, cleanList(remote.abcLogs));
  const orthoRes = mergeById(localOrtho, cleanList(remote.orthoLogs));
  const schedRes = mergeById(localSched, cleanList(remote.scheduleLogs));

  await Promise.all([
    db.putTrials(trialsRes.merged),
    db.putAbcLogs(abcRes.merged),
    db.putOrthoLogs(orthoRes.merged),
    ...schedRes.merged.map((log) => db.addScheduleLog(log)),
  ]);

  if (remote.scheduleConfig?.matin) await db.putScheduleConfig(remote.scheduleConfig.matin);
  if (remote.scheduleConfig?.soir) await db.putScheduleConfig(remote.scheduleConfig.soir);
  if (remote.scheduleConfig?.routines) await db.putScheduleConfig(remote.scheduleConfig.routines);

  if (remote.settings && typeof remote.settings === 'object') {
    const remoteAtec = [
      ...(Array.isArray(remote.settings.atec_history) ? remote.settings.atec_history : []),
      ...(Array.isArray(remote.settings.atecHistory) ? remote.settings.atecHistory : []),
    ];
    if (remoteAtec.length || localAtec.length) {
      const atecMap = new Map();
      for (const item of [...localAtec, ...remoteAtec]) {
        if (!item) continue;
        const key = item.id || `${item.day || ''}-${item.ts || item.total || ''}`;
        atecMap.set(key, item);
      }
      await saveUnifiedAtecList(Array.from(atecMap.values()).sort((x, y) => (x.ts || 0) - (y.ts || 0)));
    }

    for (const [k, val] of Object.entries(remote.settings)) {
      if (val === undefined || val === null) continue;
      // v10.5 (S17) : seuls les réglages partagés connus sont acceptés (jamais la clé, l'adresse du serveur, etc.).
      if (k !== 'profile' && !SHARED_SETTING_KEYS.includes(k)) continue;
      if (k === 'atec_history' || k === 'atecHistory' || k === 'lang' || k === 'clinic') {
        continue;
      }
      if (k === 'profile') {
        const currentProf = await db.getSetting('profile');
        if (!currentProf || !currentProf.name) {
          await db.setSetting('profile', val);
        }
      } else if (k === 'friendsAlbum') {
        const localAlbum = (await db.getSetting('friendsAlbum')) || { unlocked: ['nour'], history: [] };
        const unlocked = Array.from(new Set([...(localAlbum.unlocked || []), ...(val.unlocked || [])]));
        await db.setSetting('friendsAlbum', { unlocked, history: val.history || localAlbum.history || [] });
      } else {
        await db.setSetting(k, val);
      }
    }
  }

  if (Array.isArray(remote.visuals) && remote.visuals.length) {
    for (const v of remote.visuals) {
      if (v && typeof v.key === 'string' && v.key.length <= 120 && typeof v.data === 'string' && v.data.startsWith('data:image/')) {
        const blob = await dataUrlToBlob(v.data);
        await db.putVisualOverride(v.key, blob, v.meta || {});
      }
    }
  }

  return {
    cardsChanged: newOrUpdatedCards,
    trialsAdded: trialsRes.added,
    abcAdded: abcRes.added,
    orthoAdded: orthoRes.added,
    scheduleAdded: schedRes.added,
    remoteAuthor: remote.authorRole || 'Équipe',
    remoteTs: remote.exportedAt || Date.now(),
  };
}

export async function getCloudSyncConfig() {
  const saved = await db.getSetting(SYNC_SETTINGS_KEY);
  const supa = await db.getSetting('supabaseConfig');
  let familyKey = await db.getSetting('familyAesKey');
  if (!familyKey) {
    familyKey = generateSyncPassphrase();
    await db.setSetting('familyAesKey', familyKey);
  }
  return {
    supabaseUrl: saved?.supabaseUrl || supa?.url || DEFAULT_SUPABASE_URL,
    supabaseAnonKey: saved?.supabaseAnonKey || supa?.anonKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
    familyKey: saved?.familyKey || familyKey,
    autoSyncWifi: Boolean(saved?.autoSyncWifi),
    includeMedia: false,
  };
}

export async function saveCloudSyncConfig(nextCfg) {
  const current = await getCloudSyncConfig();
  const merged = { ...current, ...nextCfg };
  await db.setSetting(SYNC_SETTINGS_KEY, merged);
  if (merged.familyKey) await db.setSetting('familyAesKey', merged.familyKey);
  if (merged.supabaseUrl && merged.supabaseAnonKey) {
    await db.setSetting('supabaseConfig', { url: merged.supabaseUrl, anonKey: merged.supabaseAnonKey });
  }
  return merged;
}

export async function syncNowWithTeam({ includeMedia = false } = {}) {
  const cfg = await getCloudSyncConfig();
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error('Configurez d’abord l’URL et la clé publique Supabase.');
  }
  if (!cfg.familyKey || cfg.familyKey.length < 8) {
    throw new Error('Clé familiale AES-256 manquante.');
  }

  const roomHash = await sha256Hex(`kalimati-room-v1:${cfg.familyKey.trim()}`);
  const baseUrl = cfg.supabaseUrl.replace(/\/$/, '');

  let mergeReport = { cardsChanged: 0, trialsAdded: 0, abcAdded: 0, orthoAdded: 0, scheduleAdded: 0 };

  // v10.3 : passage par les « portes » sécurisées (fonctions RPC) ; ancien accès direct seulement si le SQL v10.3 n'est pas encore installé.
  const writeToken = await sha256Hex(`kalimati-relay-write-v1:${cfg.familyKey.trim()}`);
  let rpcReady = true;
  let getRes = await supabaseFetch(`${baseUrl}/rest/v1/rpc/kalimati_relay_get`, cfg.supabaseAnonKey, {
    method: 'POST',
    body: JSON.stringify({ p_room_hash: roomHash }),
  });
  if (getRes.status === 404) {
    rpcReady = false;
    getRes = await supabaseFetch(
      `${baseUrl}/rest/v1/kalimati_encrypted_relay?room_hash=eq.${encodeURIComponent(roomHash)}&select=*`,
      cfg.supabaseAnonKey,
      { method: 'GET' },
    );
  }
  if (getRes.ok) {
    const rows = await getRes.json();
    if (Array.isArray(rows) && rows[0]?.cipher_bundle) {
      const remotePlain = await decryptSyncBundle(rows[0].cipher_bundle, cfg.familyKey);
      mergeReport = await mergeRemoteSyncPayload(remotePlain);
    }
  }

  const mergedLocalPayload = await buildLocalSyncPayload({ includeMedia });
  const encryptedBundle = await encryptSyncBundle(mergedLocalPayload, cfg.familyKey);

  const postRes = rpcReady
    ? await supabaseFetch(`${baseUrl}/rest/v1/rpc/kalimati_relay_put`, cfg.supabaseAnonKey, {
      method: 'POST',
      body: JSON.stringify({
        p_room_hash: roomHash,
        p_bundle: encryptedBundle,
        p_write_token: writeToken,
        p_role: clinic?.intervenant || 'Parent',
      }),
    })
    : await supabaseFetch(
      `${baseUrl}/rest/v1/kalimati_encrypted_relay`,
      cfg.supabaseAnonKey,
      {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          room_hash: roomHash,
          cipher_bundle: encryptedBundle,
          author_role: clinic?.intervenant || 'Parent',
          updated_at: new Date().toISOString(),
        }),
      },
    );

  if (!postRes.ok) {
    const errText = (await postRes.text()).slice(0, 160);
    throw new Error(`Erreur serveur relai Supabase (${postRes.status}) : ${errText}`);
  }

  const cohortOptIn = await db.getSetting(COHORT_OPTIN_KEY);
  if (cohortOptIn) {
    const metrics = await computeClinicalCohortMetrics();
    const cohortToken = await sha256Hex(`kalimati-cohort-write-v1:${cfg.familyKey.trim()}`);
    await (rpcReady
      ? supabaseFetch(`${baseUrl}/rest/v1/rpc/kalimati_cohort_put`, cfg.supabaseAnonKey, {
        method: 'POST',
        body: JSON.stringify({ p_cohort_id: metrics.cohortId, p_metrics: metrics, p_write_token: cohortToken }),
      })
      : supabaseFetch(
        `${baseUrl}/rest/v1/kalimati_clinical_cohort`,
        cfg.supabaseAnonKey,
        {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({
            cohort_id: metrics.cohortId,
            metrics,
            updated_at: new Date().toISOString(),
          }),
        },
      )
    ).catch(() => {});
    // v10.5 : la ligne de l'ancien identifiant (tiré du prénom) est effacée une fois.
    if (rpcReady && !(await db.getSetting(COHORT_OLD_ID_KEY))) {
      const done = await supabaseFetch(`${baseUrl}/rest/v1/rpc/kalimati_cohort_delete`, cfg.supabaseAnonKey, {
        method: 'POST',
        body: JSON.stringify({ p_cohort_id: await legacyCohortId(), p_write_token: cohortToken }),
      }).then((r) => r.ok).catch(() => false);
      if (done) await db.setSetting(COHORT_OLD_ID_KEY, true);
    }
  }

  const syncMeta = {
    lastSyncAt: Date.now(),
    roomHash: roomHash.slice(0, 12),
    authorRole: clinic?.intervenant || 'Parent',
    ...mergeReport,
  };
  await db.setSetting(LAST_SYNC_KEY, syncMeta);
  return syncMeta;
}

// ---------- Protocole d'Étude Clinique Longitudinale Anonymisée (T0, T+90, T+180) ----------
// v10.5 (S10) : identifiant tiré au hasard une fois, gardé dans le téléphone. Avant, il venait du prénom (devinable).
async function getOrCreateRandomCohortId() {
  let id = await db.getSetting(COHORT_RANDOM_ID_KEY);
  if (typeof id === 'string' && /^KALI-C-[A-Z0-9-]{10,30}$/.test(id)) return id;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = crypto.getRandomValues(new Uint8Array(12));
  const seg = (s) => Array.from(rand.slice(s, s + 4), (b) => chars[b % chars.length]).join('');
  id = `KALI-C-${seg(0)}-${seg(4)}-${seg(8)}`;
  await db.setSetting(COHORT_RANDOM_ID_KEY, id);
  return id;
}

// Ancien identifiant (v10.0 à v10.4), seulement pour effacer l'ancienne ligne du serveur.
async function legacyCohortId() {
  const activeInvite = await db.getSetting('activeInviteCode');
  return `KALI-STUDY-${(await sha256Hex(`kalimati-cohort:${activeInvite || profile?.name || 'anon'}`)).slice(0, 10).toUpperCase()}`;
}

function toAgeBracket(rawAge) {
  const n = Number((String(rawAge || '').match(/(\d+)/) || [])[1]);
  if (!Number.isFinite(n) || n <= 0) return 'Non renseigné';
  if (n < 4) return '< 4 ans';
  if (n <= 6) return '4-6 ans';
  if (n <= 9) return '7-9 ans';
  if (n <= 12) return '10-12 ans';
  return '13 ans et +';
}

// v10.5 (S12) : effacer du serveur. Seul un téléphone qui a la clé familiale peut le faire.
async function rpcDelete(fnName, params) {
  const cfg = await getCloudSyncConfig();
  const baseUrl = cfg.supabaseUrl.replace(/\/$/, '');
  const res = await supabaseFetch(`${baseUrl}/rest/v1/rpc/${fnName}`, cfg.supabaseAnonKey, { method: 'POST', body: JSON.stringify(params) });
  if (res.status === 404) throw new Error('Le serveur n’a pas encore la mise à jour v10.5 (action d’Aziz dans Supabase).');
  if (!res.ok) throw new Error(`Erreur serveur (${res.status})`);
  return (await res.json().catch(() => false)) === true;
}

async function cohortToken(familyKey) {
  return sha256Hex(`kalimati-cohort-write-v1:${String(familyKey || '').trim()}`);
}

export async function withdrawClinicalCohortData() {
  const cfg = await getCloudSyncConfig();
  await db.setSetting(COHORT_OPTIN_KEY, false);
  const token = await cohortToken(cfg.familyKey);
  const ids = [await db.getSetting(COHORT_RANDOM_ID_KEY), await legacyCohortId()].filter(Boolean);
  let removed = false;
  for (const id of ids) removed = (await rpcDelete('kalimati_cohort_delete', { p_cohort_id: id, p_write_token: token })) || removed;
  return removed;
}

export async function deleteEncryptedRelayBundle() {
  const cfg = await getCloudSyncConfig();
  const key = String(cfg.familyKey || '').trim();
  const removed = await rpcDelete('kalimati_relay_delete', {
    p_room_hash: await sha256Hex(`kalimati-room-v1:${key}`),
    p_write_token: await sha256Hex(`kalimati-relay-write-v1:${key}`),
  });
  return removed;
}
export async function computeClinicalCohortMetrics() {
  const [trials, orthoLogs, abcLogs, atecList, cohortId] = await Promise.all([
    db.getAllTrials(),
    db.getAllOrthoLogs(),
    db.getAllAbcLogs(),
    getUnifiedAtecList(),
    getOrCreateRandomCohortId(),
  ]);

  const firstAtec = atecList[0] || null;
  const latestAtec = atecList.length ? atecList[atecList.length - 1] : null;
  const atecDelta = (firstAtec && latestAtec && firstAtec !== latestAtec)
    ? (latestAtec.total - firstAtec.total)
    : null;

  const daysSinceLastAtec = latestAtec?.ts
    ? Math.floor((Date.now() - latestAtec.ts) / 86400000)
    : null;

  const mluLogs = orthoLogs.filter((l) => typeof l.mlu === 'number' && l.mlu > 0).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const avg = (arr) => (arr.length ? Number((arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(2)) : null);
  const earlyMlu = avg(mluLogs.slice(0, Math.min(20, Math.ceil(mluLogs.length / 2))).map((l) => l.mlu));
  const recentMlu = avg(mluLogs.slice(-20).map((l) => l.mlu));

  const scoredTrials = trials.filter((t) => ['plus', 'prompt', 'minus'].includes(t.result)).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const autonomyRate = scoredTrials.length
    ? percent(scoredTrials.filter((t) => t.result === 'plus').length, scoredTrials.length)
    : null;

  const activeDays = new Set([
    ...trials.map((t) => t.day),
    ...orthoLogs.map((l) => l.day),
    ...abcLogs.map((a) => a.day),
  ].filter(Boolean)).size;

  return {
    cohortId,
    generatedAt: new Date().toISOString().slice(0, 10), // v10.5 : le jour seulement
    ageGroup: toAgeBracket(profile?.age), // v10.5 : tranche d'âge (plus l'âge exact)
    activeDays,
    totalAbaTrials: scoredTrials.length,
    autonomyRatePct: autonomyRate,
    mluBaseline: earlyMlu,
    mluCurrent: recentMlu,
    mluGain: (earlyMlu !== null && recentMlu !== null) ? Number((recentMlu - earlyMlu).toFixed(2)) : null,
    atecBaseline: firstAtec ? { date: firstAtec.day, total: firstAtec.total, scores: firstAtec.scores } : null,
    atecLatest: latestAtec ? { date: latestAtec.day, total: latestAtec.total, scores: latestAtec.scores } : null,
    atecDeltaPoints: atecDelta,
    daysSinceLastAtec,
    atecDue90Days: daysSinceLastAtec === null || daysSinceLastAtec >= 90,
    abcTotalEpisodes: abcLogs.length,
  };
}

export async function exportClinicalCohortReportJson() {
  const report = await computeClinicalCohortMetrics();
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: `kalimati-etude-clinique-${report.cohortId}-${dayKey()}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return report;
}

export function cloudSyncAndCohortBox({ onMerged } = {}) {
  const wrap = h('details', { class: 'card-box' },
    h('summary', {}, '☁️ Synchronisation Équipe Zero-Knowledge (Papa · Maman · AVS · Hosna) & Étude Clinique'));

  const body = h('div', { class: 'stack' });
  wrap.append(body);

  async function render() {
    try { await renderInner(); } catch (err) {
      body.replaceChildren(h('p', { class: 'note' }, `⚠️ Réglages de synchro indisponibles : ${String(err?.message || err).slice(0, 100)}`));
    }
  }

  // Bouton en 2 touchers (pas de fenêtre du téléphone) : le 1er demande confirmation pendant 4 s.
  const confirmBtn = (label, action) => {
    let armed = null;
    const b = btn(label, async () => {
      if (!armed) {
        b.textContent = 'Toucher encore pour confirmer';
        armed = setTimeout(() => { armed = null; b.textContent = label; }, 4000);
        return;
      }
      clearTimeout(armed); armed = null; b.textContent = label;
      try { await action(); } catch (err) { body.querySelector('.sync-status')?.replaceChildren(`⚠️ ${err.message || err}`); }
    }, 'ghost tiny');
    return b;
  };

  async function renderInner() {
    const [cfg, lastSync, metrics, cohortOptIn] = await Promise.all([
      getCloudSyncConfig(),
      db.getSetting(LAST_SYNC_KEY),
      computeClinicalCohortMetrics(),
      db.getSetting(COHORT_OPTIN_KEY),
    ]);

    const statusMsg = h('p', { class: 'note sync-status', role: 'status', 'aria-live': 'polite' },
      lastSync?.lastSyncAt
        ? `✅ Dernière synchro chiffrée : ${new Date(lastSync.lastSyncAt).toLocaleString('fr-FR')} par ${lastSync.authorRole || 'Parent'} (Salon #${lastSync.roomHash})`
        : '🔒 Serveur relai Supabase Kalimati pré-configuré et chiffrement AES-256 actif. Touchez simplement « Synchroniser maintenant » !');

    const keyInput = h('input', {
      value: cfg.familyKey,
      placeholder: 'Clé familiale secrète (ex. KALI-SYNC-XXXX-XXXX)',
      style: { fontFamily: 'monospace', fontWeight: '700' },
    });
    const urlInput = h('input', {
      value: cfg.supabaseUrl,
      placeholder: DEFAULT_SUPABASE_URL,
    });
    const anonInput = h('input', {
      type: 'password',
      value: cfg.supabaseAnonKey,
      placeholder: 'Clé publique Supabase (sb_publishable_...)',
    });
    const mediaChk = h('input', { type: 'checkbox' });
    const autoWifiChk = h('input', {
      type: 'checkbox',
      checked: cfg.autoSyncWifi ? 'checked' : null,
      onchange: async (e) => {
        await saveCloudSyncConfig({ autoSyncWifi: e.target.checked });
      },
    });

    const doSync = async () => {
      try {
        statusMsg.textContent = '🔄 Chiffrement AES-256 et synchronisation avec l’équipe en cours…';
        await saveCloudSyncConfig({
          familyKey: keyInput.value.trim(),
          supabaseUrl: urlInput.value.trim() || DEFAULT_SUPABASE_URL,
          supabaseAnonKey: anonInput.value.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
          autoSyncWifi: autoWifiChk.checked,
        });
        const res = await syncNowWithTeam({ includeMedia: mediaChk.checked });
        statusMsg.textContent = `✅ Synchronisé à ${new Date(res.lastSyncAt).toLocaleTimeString('fr-FR')} ! Nouveaux éléments fusionnés : +${res.trialsAdded} essais ABA, +${res.orthoAdded} notes ortho, +${res.abcAdded} notes ABC, ${res.cardsChanged} cartes mises à jour.`;
        if (typeof onMerged === 'function') onMerged(res);
      } catch (err) {
        statusMsg.textContent = `⚠️ ${err.message || err}`;
      }
    };

    const copyKeyOnly = async () => {
      const k = keyInput.value.trim() || cfg.familyKey;
      try {
        await navigator.clipboard.writeText(k);
        statusMsg.textContent = '📋 Clé AES-256 copiée dans le presse-papiers.';
      } catch {
        statusMsg.textContent = `🔑 Clé à copier : ${k}`;
      }
    };

    const copyMagicHashLink = async () => {
      const k = keyInput.value.trim() || cfg.familyKey;
      const magicUrl = `https://elguellouchi.github.io/Kalimati/#key=${encodeURIComponent(k)}`;
      try {
        await navigator.clipboard.writeText(magicUrl);
        statusMsg.textContent = '🔗 Lien magique copié. ⚠️ Il contient la clé secrète : envoyez-le en privé seulement, jamais dans un groupe.';
      } catch {
        statusMsg.textContent = `🔗 Lien magique : ${magicUrl}`;
      }
    };

    const shareTeamInstructionsWhatsApp = () => {
      const text = [
        // v10.5 (S7) : message neutre, sans prénom ni mot médical.
        'Bonjour,',
        'Pour partager notre espace dans l’application Kalimati :',
        '1. Ouvrez Kalimati -> Mode Parent -> Progrès -> Synchronisation Équipe.',
        '2. Saisissez la clé familiale (envoyée à part, en privé) puis touchez « Synchroniser maintenant ».',
      ].join('\n');
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    };

    const cohortChk = h('input', {
      type: 'checkbox',
      checked: cohortOptIn ? 'checked' : null,
      onchange: async (e) => {
        await db.setSetting(COHORT_OPTIN_KEY, e.target.checked);
      },
    });

    const atecReminderBanner = metrics.atecDue90Days
      ? h('p', { class: 'note', style: { color: '#783006', fontWeight: '700' } },
        metrics.daysSinceLastAtec === null
          ? '⏰ Protocole clinique J0 : pensez à remplir le 1er bilan ATEC initial dans Progrès pour établir le point de départ T0.'
          : `⏰ Protocole clinique J+90 (${metrics.daysSinceLastAtec} jours depuis le dernier bilan) : il est temps de remplir le nouveau bilan ATEC trimestriel !`)
      : null;

    body.replaceChildren(
      statusMsg,
      h('div', { class: 'row wrap' },
        btn('🔄 Synchroniser maintenant avec l’équipe', doSync, 'primary'),
        btn('🔗 Copier le lien magique #key=', copyMagicHashLink, 'ghost tiny'),
        btn('📋 Copier la clé seule', copyKeyOnly, 'ghost tiny'),
        btn('💬 Consigne WhatsApp (sans clé)', shareTeamInstructionsWhatsApp, 'ghost tiny')),
      h('p', { class: 'note', style: { color: '#5A3A00', fontWeight: '700' } },
        '⚠️ Le lien magique contient la clé secrète de la famille. Envoyez-le seulement en privé, à une personne de confiance. Jamais dans un groupe ni sur un réseau social.'),
      h('label', { class: 'check' }, autoWifiChk, ' Synchroniser automatiquement en arrière-plan à l’ouverture quand le Wi-Fi est actif'),
      h('label', { class: 'check' }, mediaChk, ' Inclure exceptionnellement les photos et voix parentales chiffrées dans cet envoi (par défaut : textes et journaux uniquement)'),
      h('details', {},
        h('summary', {}, '⚙️ Paramètres de connexion Cloud Zero-Knowledge ( Clé AES-256 & Supabase pré-rempli )'),
        h('div', { class: 'stack' },
          h('label', { class: 'field' }, '🔑 Clé secrète familiale AES-256 (identique sur le téléphone de Papa, Maman, l’AVS et Hosna)', keyInput),
          h('label', { class: 'field' }, '🌐 URL du projet Supabase (pré-configurée)', urlInput),
          h('label', { class: 'field' }, '🛡️ Clé publique Supabase (publishable key pré-configurée)', anonInput),
          h('div', { class: 'row' },
            btn('Enregistrer la configuration Cloud', async () => {
              await saveCloudSyncConfig({
                familyKey: keyInput.value.trim(),
                supabaseUrl: urlInput.value.trim() || DEFAULT_SUPABASE_URL,
                supabaseAnonKey: anonInput.value.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
                autoSyncWifi: autoWifiChk.checked,
              });
              statusMsg.textContent = 'Configuration Cloud enregistrée ✅';
            }, 'ghost tiny')))),
      h('div', { class: 'card-box', style: { background: 'var(--soft, #E3F4EF)' } },
        h('h3', {}, `📊 Suivi Clinique Longitudinal Anonymisé T0 → T+90 → T+180 (${metrics.cohortId})`),
        atecReminderBanner,
        h('p', { class: 'note' },
          `Jours actifs : ${metrics.activeDays} j · Essais ABA : ${metrics.totalAbaTrials} (${metrics.autonomyRatePct ?? '—'} % en autonomie) · `,
          `LME / MLU : ${metrics.mluBaseline ?? '—'} → ${metrics.mluCurrent ?? '—'} mots/phrase · `,
          `ATEC : ${metrics.atecBaseline?.total ?? '—'} → ${metrics.atecLatest?.total ?? '—'}${metrics.atecDeltaPoints !== null ? ` (${metrics.atecDeltaPoints > 0 ? '+' : ''}${metrics.atecDeltaPoints} pts)` : ''}`),
        h('label', { class: 'check' }, cohortChk, ' Participer à l’étude clinique Kalimati (facultatif). Envoyé : un numéro tiré au hasard, une tranche d’âge et des scores. Jamais de prénom, de photo ni de voix.'),
        h('div', { class: 'row wrap' },
          btn('📥 Exporter le rapport clinique anonymisé (JSON)', () => exportClinicalCohortReportJson(), 'ghost tiny'),
          confirmBtn('🗑 Retirer mes scores de l’étude', async () => {
            const ok = await withdrawClinicalCohortData();
            cohortChk.checked = false;
            statusMsg.textContent = ok ? '✅ Scores retirés du serveur. La participation est arrêtée.' : '✅ Participation arrêtée. Rien à effacer sur le serveur.';
          }))),
      h('div', { class: 'row wrap' },
        confirmBtn('🗑 Effacer notre paquet chiffré du serveur', async () => {
          const ok = await deleteEncryptedRelayBundle();
          statusMsg.textContent = ok ? '✅ Paquet chiffré effacé du serveur. Les données du téléphone restent.' : 'Rien à effacer sur le serveur.';
        })),
    );
  }

  wrap.addEventListener('toggle', () => {
    if (wrap.open) render();
  });
  render();
  return wrap;
}
