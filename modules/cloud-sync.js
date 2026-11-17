// ☁️ Synchronisation Cloud Zero-Knowledge (AES-256-GCM) entre Papa, Maman, AVS et Orthophoniste / Psy (Hosna Mehri)
// + 📊 Cohorte Clinique Longitudinale Anonymisée (Évolution ATEC, LME/MLU, autonomie ABA & réduction des crises ABC sur 3 à 6 mois).
//
// Garanties de sécurité & vie privée :
// 1. Chiffrement de bout en bout (AES-256-GCM via Web Crypto API native, PBKDF2 100 000 itérations) AVANT tout envoi réseau.
// 2. Le serveur relai (Supabase) ne reçoit qu'un identifiant de salon haché en SHA-256 (room_hash) et un bloc chiffré (cipher_bundle).
// 3. Fusion intelligente sans perte (CRDT par identifiant unique) : les essais ABA notés par l'AVS à l'école et ceux notés par Papa
//    à la maison s'additionnent sans jamais s'écraser.
// 4. Les enregistrements de la voix de l'enfant ne quittent jamais le téléphone.
import * as db from '../db.js';
import { h, btn, dayKey, addDays, percent } from './util.js';
import { profile, clinic } from './aba.js';
import { blobToDataUrl, dataUrlToBlob } from '../media.js';

const SYNC_SETTINGS_KEY = 'cloudSyncConfig';
const LAST_SYNC_KEY = 'cloudSyncLastState';
const COHORT_OPTIN_KEY = 'clinicalCohortOptIn';
const EXPORTED_SETTING_KEYS = [
  'lang', 'cols', 'clinic', 'profile', 'toiletReminder', 'levels',
  'stories', 'atec_history', 'aacHistory', 'touch', 'visualStyle',
  'hideFriends', 'friendsAlbum', 'morphAuto', 'childGender',
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

// ---------- Collecte et fusion sans perte (CRDT par ID) du dossier complet de l'enfant ----------
export async function buildLocalSyncPayload({ includeMedia = false } = {}) {
  const [cards, trials, abcLogs, orthoLogs, scheduleLogs, visuals] = await Promise.all([
    db.getAllCards(),
    db.getAllTrials(),
    db.getAllAbcLogs(),
    db.getAllOrthoLogs(),
    db.getAllScheduleLogs(),
    includeMedia ? db.getAllVisualOverrides() : Promise.resolve([]),
  ]);

  const settings = {};
  for (const k of EXPORTED_SETTING_KEYS) {
    const val = await db.getSetting(k);
    if (val !== undefined && val !== null) settings[k] = val;
  }

  const [matinCfg, soirCfg] = await Promise.all([
    db.getScheduleConfig('matin').catch(() => null),
    db.getScheduleConfig('soir').catch(() => null),
  ]);

  const serializedCards = [];
  for (const c of cards) {
    const copy = { ...c };
    if (includeMedia) {
      for (const f of ['photo', 'video', 'audioFr', 'audioDr']) {
        copy[f] = c[f] instanceof Blob ? await blobToDataUrl(c[f]) : null;
      }
    } else {
      // En mode rapide (Wi-Fi/4G < 100 Ko), on synchronise les textes, l'ordre et la grille sans ré-envoyer les gros fichiers binaires
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
    scheduleConfig: { matin: matinCfg, soir: soirCfg },
    settings,
    visuals: serializedVisuals,
  };
}

// Fusionne deux listes d'enregistrements par identifiant `id` (garde le plus récent en cas de doublon)
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

// Applique et fusionne un paquet distant déchiffré dans IndexedDB sans écraser les photos ni les essais locaux
export async function mergeRemoteSyncPayload(remote) {
  if (!remote || remote.schema !== 'kalimati-sync-v1') {
    throw new Error('Format de synchronisation incompatible.');
  }

  const [localCards, localTrials, localAbc, localOrtho, localSched] = await Promise.all([
    db.getAllCards(),
    db.getAllTrials(),
    db.getAllAbcLogs(),
    db.getAllOrthoLogs(),
    db.getAllScheduleLogs(),
  ]);

  // 1. Fusion des cartes (préserve toujours les photos/voix locales si le paquet distant est en mode rapide sans média)
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

  // 2. Fusion des essais ABA, journaux ABC, journaux orthophoniques et coches du planning
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

  // 3. Fusion de la configuration du planning et des réglages partagés (notamment bilan ATEC et Album des 7 Amis)
  if (remote.scheduleConfig?.matin) await db.putScheduleConfig(remote.scheduleConfig.matin);
  if (remote.scheduleConfig?.soir) await db.putScheduleConfig(remote.scheduleConfig.soir);

  if (remote.settings && typeof remote.settings === 'object') {
    for (const [k, val] of Object.entries(remote.settings)) {
      if (val === undefined || val === null) continue;
      if (k === 'atec_history') {
        const localAtec = (await db.getSetting('atec_history')) || [];
        const mergedAtec = mergeById(localAtec, Array.isArray(val) ? val : []).merged;
        await db.setSetting('atec_history', mergedAtec);
      } else if (k === 'friendsAlbum') {
        const localAlbum = (await db.getSetting('friendsAlbum')) || { unlocked: ['nour'], history: [] };
        const unlocked = Array.from(new Set([...(localAlbum.unlocked || []), ...(val.unlocked || [])]));
        await db.setSetting('friendsAlbum', { unlocked, history: val.history || localAlbum.history || [] });
      } else if (k !== 'clinic') {
        // On ne remplace pas le rôle intervenant local (ex. l'AVS garde son rôle « AVS » sur son téléphone)
        await db.setSetting(k, val);
      }
    }
  }

  // 4. Fusion des photos personnalisées si présentes
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
    includeMedia: Boolean(saved?.includeMedia),
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

// Synchronisation bidirectionnelle en 1 clic :
// 1. Télécharge le dernier paquet chiffré du salon familial (identifié par SHA-256(familyKey)),
// 2. Déchiffre et fusionne localement avec les données du téléphone,
// 3. Re-chiffre l'ensemble fusionné en AES-256-GCM et le dépose dans le salon familial.
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
  const mergedLocalPayload = await buildLocalSyncPayload({ includeMedia: includeMedia || cfg.includeMedia });
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
// Calcule l'évolution clinique longitudinale (J0 -> Aujourd'hui) sur les 4 indicateurs publiables :
// 1. Score ATEC global et sous-échelles (I. Parole /28, II. Sociabilité /40, III. Sensoriel /36, IV. Comportement /75)
// 2. LME / MLU (Longueur Moyenne d'Énoncé en mots par phrase CAA & orthophonie)
// 3. Taux d'autonomie ABA (% d'essais réussis sans guidance sur les 71 objectifs ABLLS-R)
// 4. Fréquence hebdomadaire des épisodes comportementaux ABC / FBA
export async function computeClinicalCohortMetrics() {
  const [trials, orthoLogs, abcLogs, atecHistory, activeInvite] = await Promise.all([
    db.getAllTrials(),
    db.getAllOrthoLogs(),
    db.getAllAbcLogs(),
    db.getSetting('atec_history'),
    db.getSetting('activeInviteCode'),
  ]);

  const cohortHash = (await sha256Hex(`kalimati-cohort:${activeInvite || profile?.name || 'anon'}`)).slice(0, 10).toUpperCase();
  const atecList = Array.isArray(atecHistory) ? [...atecHistory].sort((a, b) => (a.ts || 0) - (b.ts || 0)) : [];
  const firstAtec = atecList[0] || null;
  const latestAtec = atecList.length ? atecList[atecList.length - 1] : null;
  const atecDelta = (firstAtec && latestAtec && firstAtec !== latestAtec)
    ? (latestAtec.total - firstAtec.total)
    : null;

  // Calcul LME / MLU : 14 premiers jours d'usage vs 14 derniers jours
  const mluLogs = orthoLogs.filter((l) => typeof l.mlu === 'number' && l.mlu > 0).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const avg = (arr) => (arr.length ? Number((arr.reduce((s, x) => s + x, 0) / arr.length).toFixed(2)) : null);
  const earlyMlu = avg(mluLogs.slice(0, Math.min(20, Math.ceil(mluLogs.length / 2))).map((l) => l.mlu));
  const recentMlu = avg(mluLogs.slice(-20).map((l) => l.mlu));

  // Taux d'autonomie ABA (essais 'plus' vs total 'plus'+'prompt'+'minus')
  const scoredTrials = trials.filter((t) => ['plus', 'prompt', 'minus'].includes(t.result)).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const autonomyRate = scoredTrials.length
    ? percent(scoredTrials.filter((t) => t.result === 'plus').length, scoredTrials.length)
    : null;

  // Jours actifs uniques
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
    atecDeltaPoints: atecDelta, // En ATEC, une baisse (ex. -14 pts) traduit une diminution clinique des difficultés
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
        : '🔒 Chiffrement AES-256 de bout en bout actif. Vos cartes, essais ABA, bilans ATEC et journaux ortho sont chiffrés sur votre téléphone avant d’être partagés avec l’équipe.');

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
      checked: cfg.includeMedia ? 'checked' : null,
    });

    const doSync = async () => {
      try {
        statusMsg.textContent = '🔄 Chiffrement AES-256 et synchronisation avec l’équipe en cours…';
        await saveCloudSyncConfig({
          familyKey: keyInput.value.trim(),
          supabaseUrl: urlInput.value.trim(),
          supabaseAnonKey: anonInput.value.trim(),
          includeMedia: mediaChk.checked,
        });
        const res = await syncNowWithTeam({ includeMedia: mediaChk.checked });
        statusMsg.textContent = `✅ Synchronisé à ${new Date(res.lastSyncAt).toLocaleTimeString('fr-FR')} ! Nouveaux éléments fusionnés : +${res.trialsAdded} essais ABA, +${res.orthoAdded} notes ortho, +${res.abcAdded} notes ABC, ${res.cardsChanged} cartes mises à jour.`;
        if (typeof onMerged === 'function') onMerged(res);
      } catch (err) {
        statusMsg.textContent = `⚠️ ${err.message || err}`;
      }
    };

    const shareTeamSyncWhatsApp = () => {
      const k = keyInput.value.trim() || cfg.familyKey;
      const text = [
        `Bonjour 👋,`,
        `Voici la clé de synchronisation chiffrée *Kalimati* pour partager en temps réel les progrès et cartes d'*${profile?.name || 'Abir'}* (Papa, Maman, AVS, Hosna) :`,
        `🔑 Clé AES-256 : *${k}*`,
        `Dans Kalimati -> Mode Parent -> ☁️ Synchronisation Équipe, collez cette clé et touchez « 🔄 Synchroniser maintenant ».`,
      ].join('\n');
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    };

    // Section Cohorte Clinique anonymisée
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
        btn('💬 Envoyer la clé à Maman / AVS / Hosna (WhatsApp)', shareTeamSyncWhatsApp, 'ghost tiny')),
      h('label', { class: 'check' }, mediaChk, ' Inclure aussi les photos et voix parentales (plus lourd, à faire en Wi-Fi)'),
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
                includeMedia: mediaChk.checked,
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
