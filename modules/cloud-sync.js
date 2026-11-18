// ☁️ Synchronisation Cloud Zero-Knowledge (AES-256-GCM) entre Papa, Maman, AVS et Orthophoniste / Psy (Hosna Mehri)
// + 📊 Cohorte Clinique Longitudinale Anonymisée (Évolution ATEC, LME/MLU, autonomie ABA & réduction des crises ABC sur 3 à 6 mois).
//
// Version v10.0 (intègre les 5 correctifs de l'audit v9.15 de Claude) :
// 1. Unification complète des clés ATEC (`atec_history` et `atecHistory`) en lecture, fusion et sauvegarde.
// 2. Protection du profil local (`profile`), de la langue (`lang`) et du rôle (`clinic`) : une synchronisation avec l'AVS ou Hosna
//    ne remplace jamais la langue ou le profil déjà configuré sur le téléphone local.
// 3. Partage WhatsApp sécurisé (séparation de l'invitation et de la clé secrète AES-256 copiée à part).
// 4. Synchronisation texte uniquement par défaut (`includeMedia: false`) : les photos et voix restent dans le téléphone sauf accord explicite.
import * as db from '../db.js';
import { h, btn, dayKey, percent } from './util.js';
import { profile, clinic } from './aba.js';
import { blobToDataUrl, dataUrlToBlob } from '../media.js';

const SYNC_SETTINGS_KEY = 'cloudSyncConfig';
const LAST_SYNC_KEY = 'cloudSyncLastState';
const COHORT_OPTIN_KEY = 'clinicalCohortOptIn';
// Réglages partagés sans écraser `lang`, `clinic` ni `profile` existant sur le téléphone récepteur
const SHARED_SETTING_KEYS = [
  'cols', 'toiletReminder', 'levels', 'stories',
  'atec_history', 'atecHistory', 'aacHistory', 'touch',
  'visualStyle', 'hideFriends', 'friendsAlbum', 'morphAuto', 'childGender',
];

// ---------- Utilitaires cryptographiques Web Crypto API (AES-256-GCM + SHA-256) ----------
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

async function deriveAesKey(passphrase, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase.trim()), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
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
  const key = await deriveAesKey(familyKey, salt);
  try {
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64ToBuf(parsed.ciphertext));
    return JSON.parse(new TextDecoder().decode(plainBuf));
  } catch {
    throw new Error('Clé familiale AES-256 incorrecte : déchiffrement refusé.');
  }
}

export function generateSyncPassphrase() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = new Uint8Array(12);
  crypto.getRandomValues(rand);
  const seg = (s, l) => Array.from(rand.slice(s, s + l), (b) => chars[b % chars.length]).join('');
  return `KALI-SYNC-${seg(0, 4)}-${seg(4, 4)}-${seg(8, 4)}`;
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

// ---------- Collecte et fusion sans perte (CRDT par ID) du dossier complet de l'enfant ----------
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

// Applique et fusionne un paquet distant déchiffré dans IndexedDB sans écraser le profil ni la langue locale
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

  // 1. Fusion des cartes (préserve toujours les photos/voix locales si le paquet distant est sans média)
  const localCardMap = new Map(localCards.map((c) => [c.id, c]));
  let newOrUpdatedCards = 0;
  for (const rc of (remote.cards || [])) {
    if (!rc || !rc.id) continue;
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

  // 2. Fusion CRDT des essais ABA, journaux ABC, journaux orthophoniques et coches du planning
  const trialsRes = mergeById(localTrials, remote.trials || []);
  const abcRes = mergeById(localAbc, remote.abcLogs || []);
  const orthoRes = mergeById(localOrtho, remote.orthoLogs || []);
  const schedRes = mergeById(localSched, remote.scheduleLogs || []);

  await Promise.all([
    db.putTrials(trialsRes.merged),
    db.putAbcLogs(abcRes.merged),
    db.putOrthoLogs(orthoRes.merged),
    ...schedRes.merged.map((log) => db.addScheduleLog(log)),
  ]);

  // 3. Fusion du planning
  if (remote.scheduleConfig?.matin) await db.putScheduleConfig(remote.scheduleConfig.matin);
  if (remote.scheduleConfig?.soir) await db.putScheduleConfig(remote.scheduleConfig.soir);
  if (remote.scheduleConfig?.routines) await db.putScheduleConfig(remote.scheduleConfig.routines);

  // 4. Fusion sécurisée des réglages (unifie atec_history + atecHistory et protège lang/clinic/profile locaux)
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
      if (k === 'atec_history' || k === 'atecHistory' || k === 'lang' || k === 'clinic') {
        continue; // Géré séparément ou protégé localement
      }
      if (k === 'profile') {
        const currentProf = await db.getSetting('profile');
        // Ne remplace le profil que si le téléphone récepteur n'a pas encore de prénom d'enfant configuré
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

  // 5. Fusion des photos personnalisées uniquement si envoyées explicitement
  if (Array.isArray(remote.visuals) && remote.visuals.length) {
    for (const v of remote.visuals) {
      if (v && v.key && typeof v.data === 'string' && v.data.startsWith('data:image/')) {
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

// ---------- Configuration et Synchronisation Cloud Zero-Knowledge via Supabase ----------
export async function getCloudSyncConfig() {
  const saved = await db.getSetting(SYNC_SETTINGS_KEY);
  const supa = await db.getSetting('supabaseConfig');
  let familyKey = await db.getSetting('familyAesKey');
  if (!familyKey) {
    familyKey = generateSyncPassphrase();
    await db.setSetting('familyAesKey', familyKey);
  }
  return {
    supabaseUrl: saved?.supabaseUrl || supa?.url || '',
    supabaseAnonKey: saved?.supabaseAnonKey || supa?.anonKey || '',
    familyKey: saved?.familyKey || familyKey,
    autoSyncWifi: Boolean(saved?.autoSyncWifi),
    includeMedia: false, // Toujours désactivé par défaut pour que photos/voix ne quittent pas le téléphone par erreur
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
    throw new Error('Configurez d’abord l’URL et la clé publique (anon key) Supabase dans l’encadré ci-dessous.');
  }
  if (!cfg.familyKey || cfg.familyKey.length < 8) {
    throw new Error('Clé familiale AES-256 manquante.');
  }

  const roomHash = await sha256Hex(`kalimati-room-v1:${cfg.familyKey.trim()}`);
  const baseUrl = cfg.supabaseUrl.replace(/\/$/, '');
  const headers = {
    apikey: cfg.supabaseAnonKey,
    Authorization: `Bearer ${cfg.supabaseAnonKey}`,
    'Content-Type': 'application/json',
  };

  let mergeReport = { cardsChanged: 0, trialsAdded: 0, abcAdded: 0, orthoAdded: 0, scheduleAdded: 0 };

  // Étape 1 : Récupérer et fusionner le paquet distant s'il existe
  const getRes = await fetch(
    `${baseUrl}/rest/v1/kalimati_encrypted_relay?room_hash=eq.${encodeURIComponent(roomHash)}&select=*`,
    { method: 'GET', headers },
  );
  if (getRes.ok) {
    const rows = await getRes.json();
    if (Array.isArray(rows) && rows[0]?.cipher_bundle) {
      const remotePlain = await decryptSyncBundle(rows[0].cipher_bundle, cfg.familyKey);
      mergeReport = await mergeRemoteSyncPayload(remotePlain);
    }
  }

  // Étape 2 : Construire le paquet local fusionné, le chiffrer en AES-256-GCM et l'envoyer
  const mergedLocalPayload = await buildLocalSyncPayload({ includeMedia });
  const encryptedBundle = await encryptSyncBundle(mergedLocalPayload, cfg.familyKey);

  const postRes = await fetch(`${baseUrl}/rest/v1/kalimati_encrypted_relay`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      room_hash: roomHash,
      cipher_bundle: encryptedBundle,
      author_role: clinic?.intervenant || 'Parent',
      updated_at: new Date().toISOString(),
    }),
  });

  if (!postRes.ok) {
    const errText = (await postRes.text()).slice(0, 160);
    throw new Error(`Erreur serveur relai Supabase (${postRes.status}) : ${errText}`);
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

// ---------- Protocole d'Étude Clinique Longitudinale Anonymisée (Cohorte Bêta 100 familles) ----------
export async function computeClinicalCohortMetrics() {
  const [trials, orthoLogs, abcLogs, atecList, activeInvite] = await Promise.all([
    db.getAllTrials(),
    db.getAllOrthoLogs(),
    db.getAllAbcLogs(),
    getUnifiedAtecList(),
    db.getSetting('activeInviteCode'),
  ]);

  const cohortHash = (await sha256Hex(`kalimati-cohort:${activeInvite || profile?.name || 'anon'}`)).slice(0, 10).toUpperCase();
  const firstAtec = atecList[0] || null;
  const latestAtec = atecList.length ? atecList[atecList.length - 1] : null;
  const atecDelta = (firstAtec && latestAtec && firstAtec !== latestAtec)
    ? (latestAtec.total - firstAtec.total)
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
    cohortId: `KALI-STUDY-${cohortHash}`,
    generatedAt: new Date().toISOString(),
    ageGroup: profile?.age || '8 ans',
    activeDays,
    totalAbaTrials: scoredTrials.length,
    autonomyRatePct: autonomyRate,
    mluBaseline: earlyMlu,
    mluCurrent: recentMlu,
    mluGain: (earlyMlu !== null && recentMlu !== null) ? Number((recentMlu - earlyMlu).toFixed(2)) : null,
    atecBaseline: firstAtec ? { date: firstAtec.day, total: firstAtec.total, scores: firstAtec.scores } : null,
    atecLatest: latestAtec ? { date: latestAtec.day, total: latestAtec.total, scores: latestAtec.scores } : null,
    atecDeltaPoints: atecDelta,
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

// ---------- Interface Parent & Orthophoniste : Boîte de Synchronisation Cloud & Cohorte Clinique ----------
export function cloudSyncAndCohortBox({ onMerged } = {}) {
  const wrap = h('details', { class: 'card-box' },
    h('summary', {}, '☁️ Synchronisation Équipe Zero-Knowledge (Papa · Maman · AVS · Hosna) & Étude Clinique'));

  const body = h('div', { class: 'stack' });
  wrap.append(body);

  async function render() {
    const [cfg, lastSync, metrics, cohortOptIn] = await Promise.all([
      getCloudSyncConfig(),
      db.getSetting(LAST_SYNC_KEY),
      computeClinicalCohortMetrics(),
      db.getSetting(COHORT_OPTIN_KEY),
    ]);

    const statusMsg = h('p', { class: 'note' },
      lastSync?.lastSyncAt
        ? `✅ Dernière synchro chiffrée : ${new Date(lastSync.lastSyncAt).toLocaleString('fr-FR')} par ${lastSync.authorRole || 'Parent'} (Salon #${lastSync.roomHash})`
        : '🔒 Chiffrement AES-256 de bout en bout actif. Vos essais ABA, bilans ATEC et journaux ortho sont chiffrés sur votre téléphone avant d’être partagés avec l’équipe (sans toucher à la langue ni au profil local).');

    const keyInput = h('input', {
      value: cfg.familyKey,
      placeholder: 'Clé familiale secrète (ex. KALI-SYNC-XXXX-XXXX)',
      style: { fontFamily: 'monospace', fontWeight: '700' },
    });
    const urlInput = h('input', {
      value: cfg.supabaseUrl,
      placeholder: 'https://votre-projet.supabase.co',
    });
    const anonInput = h('input', {
      type: 'password',
      value: cfg.supabaseAnonKey,
      placeholder: 'Clé publique Supabase (anon public key)',
    });
    const mediaChk = h('input', {
      type: 'checkbox',
    });

    const doSync = async () => {
      try {
        statusMsg.textContent = '🔄 Chiffrement AES-256 et synchronisation avec l’équipe en cours…';
        await saveCloudSyncConfig({
          familyKey: keyInput.value.trim(),
          supabaseUrl: urlInput.value.trim(),
          supabaseAnonKey: anonInput.value.trim(),
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
        statusMsg.textContent = '📋 Clé AES-256 copiée dans le presse-papiers (transmettez-la séparément du lien).';
      } catch {
        statusMsg.textContent = `🔑 Clé à copier : ${k}`;
      }
    };

    const shareTeamInstructionsWhatsApp = () => {
      const text = [
        `Bonjour 👋,`,
        `Pour synchroniser les progrès ABA, le planning et le cahier de liaison d'*${profile?.name || 'Abir'}* dans *Kalimati* :`,
        `1. Ouvrez Kalimati -> Mode Parent -> Progrès -> ☁️ Synchronisation Équipe.`,
        `2. Collez la clé secrète AES-256 (envoyée dans un second message séparé ou dictée de vive voix) puis touchez « 🔄 Synchroniser maintenant ».`,
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

    body.replaceChildren(
      statusMsg,
      h('div', { class: 'row wrap' },
        btn('🔄 Synchroniser maintenant avec l’équipe', doSync, 'primary'),
        btn('📋 Copier la clé secrète seule', copyKeyOnly, 'ghost tiny'),
        btn('💬 Envoyer la consigne (sans la clé) sur WhatsApp', shareTeamInstructionsWhatsApp, 'ghost tiny')),
      h('label', { class: 'check' }, mediaChk, ' Inclure exceptionnellement les photos et voix parentales chiffrées dans cet envoi (par défaut : textes et journaux uniquement, les photos restent sur ce téléphone)'),
      h('details', {},
        h('summary', {}, '⚙️ Paramètres de connexion Cloud Zero-Knowledge ( Clé AES-256 & Supabase )'),
        h('div', { class: 'stack' },
          h('label', { class: 'field' }, '🔑 Clé secrète familiale AES-256 (identique sur le téléphone de Papa, Maman, l’AVS et Hosna)', keyInput),
          h('label', { class: 'field' }, '🌐 URL du projet Supabase', urlInput),
          h('label', { class: 'field' }, '🛡️ Clé publique Supabase (anon key)', anonInput),
          h('div', { class: 'row' },
            btn('Enregistrer la configuration Cloud', async () => {
              await saveCloudSyncConfig({
                familyKey: keyInput.value.trim(),
                supabaseUrl: urlInput.value.trim(),
                supabaseAnonKey: anonInput.value.trim(),
              });
              statusMsg.textContent = 'Configuration Cloud enregistrée ✅';
            }, 'ghost tiny')))),
      h('div', { class: 'card-box', style: { background: 'var(--soft, #E3F4EF)' } },
        h('h3', {}, `📊 Suivi Clinique Longitudinal Anonymisé (${metrics.cohortId})`),
        h('p', { class: 'note' },
          `Jours actifs : ${metrics.activeDays} j · Essais ABA : ${metrics.totalAbaTrials} (${metrics.autonomyRatePct ?? '—'} % en autonomie) · `,
          `LME / MLU : ${metrics.mluBaseline ?? '—'} → ${metrics.mluCurrent ?? '—'} mots/phrase · `,
          `ATEC : ${metrics.atecBaseline?.total ?? '—'} → ${metrics.atecLatest?.total ?? '—'}${metrics.atecDeltaPoints !== null ? ` (${metrics.atecDeltaPoints > 0 ? '+' : ''}${metrics.atecDeltaPoints} pts)` : ''}`),
        h('label', { class: 'check' }, cohortChk, ' Participer de façon 100 % anonyme à l’étude clinique longitudinale Kalimati (aucun prénom, aucune photo, aucune voix)'),
        h('div', { class: 'row wrap' },
          btn('📥 Exporter le rapport clinique anonymisé (JSON)', () => exportClinicalCohortReportJson(), 'ghost tiny'))),
    );
  }

  wrap.addEventListener('toggle', () => {
    if (wrap.open) render();
  });
  render();
  return wrap;
}
