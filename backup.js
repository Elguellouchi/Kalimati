// Sauvegarde (cartes, photos, vidéos, voix du parent, photos personnalisées, essais notés, réglages) et restauration.
// Les enregistrements de la voix de l'enfant ne sont jamais mis dans la sauvegarde : ils restent dans le téléphone.
// v9.8 : la sauvegarde garde aussi le journal des comportements (ABC) et le journal d'orthophonie (texte seulement).
import { blobToDataUrl, dataUrlToBlob } from './media.js';
import { mergeLexicalCard, sanitizeLexiconMetadata } from './modules/lexique-core.js';

// v10.21 (Lot 1) : les voix se gardent par langue dans card.audios[code] ; photo et vidéo gardent leur champ.
const BLOB_FIELDS = ['photo', 'video'];
const FORMATS = ['kalimati-backup-v1', 'kalimati-backup-v2', 'kalimati-backup-v3', 'kalimati-backup-v4'];
const FORMAT = 'kalimati-backup-v4';
const GRAMS = ['person', 'verb', 'noun', 'adj', 'social'];

// v10.11 : sauvegarde facultativement chiffrée par un mot de passe du parent.
// Le fichier reste un simple .json : sur un autre téléphone, Kalimati demande le mot de passe.
const ENCRYPTED_FORMAT = 'kalimati-backup-encrypted-v1';
const BACKUP_KDF = 'PBKDF2-SHA256-310K';
const BACKUP_ITERATIONS = 310000;
export const BACKUP_PASSWORD_MIN = 10;

const bytesToB64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const b64ToBytes = (value) => {
  const bin = atob(String(value || ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

async function deriveBackupKey(passphrase, salt, iterations) {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(passphrase).trim()), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBackupFile(file, passphrase) {
  const clean = String(passphrase || '').trim();
  if (clean.length < BACKUP_PASSWORD_MIN) {
    throw new Error(`Le mot de passe de la sauvegarde doit faire au moins ${BACKUP_PASSWORD_MIN} caractères.`);
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(clean, salt, BACKUP_ITERATIONS);
  const plain = new Uint8Array(await file.arrayBuffer());
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain);
  const container = {
    format: ENCRYPTED_FORMAT,
    cipher: 'AES-256-GCM',
    kdf: BACKUP_KDF,
    iterations: BACKUP_ITERATIONS,
    exportedAt: new Date().toISOString(),
    originalName: file.name,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(cipher),
  };
  const name = file.name.replace(/\.json$/i, '') + '-chiffree.json';
  return new File([JSON.stringify(container)], name, { type: 'application/json' });
}

// v9.10 : la sauvegarde se fait en 2 temps, sans bloquer l'écran.
// 1) buildBackupFile prépare le fichier morceau par morceau (l'écran respire entre chaque carte et indique l'avancement).
// 2) deliverBackup le donne au parent : feuille de partage du téléphone (« Enregistrer dans Fichiers », Drive…)
//    ou, à défaut, téléchargement classique. Sur iPhone, le partage exige un nouveau toucher : d'où le 2e bouton.
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

// v10.5 : includeMedia = false par défaut : aucune photo, vidéo ni voix dans le fichier (elles restent dans le téléphone).
export async function buildBackupFile({ cards, trials = [], settings = {}, visuals = [], abcLogs = [], orthoLogs = [], includeMedia = false }, onProgress = () => {}) {
  if (!includeMedia) visuals = [];
  const total = cards.length + visuals.length || 1;
  let done = 0;
  const step = async () => { done += 1; onProgress(Math.min(99, Math.round((done / total) * 100))); await pause(); };
  const head = { format: FORMAT, exportedAt: new Date().toISOString(), includesMedia: Boolean(includeMedia), trials, settings, abcLogs, orthoLogs };
  const parts = [JSON.stringify(head).slice(0, -1), ',"cards":['];
  for (let i = 0; i < cards.length; i += 1) {
    const copy = { ...cards[i] };
    if (copy.lexicon) {
      const lexicon = sanitizeLexiconMetadata(copy.lexicon);
      if (lexicon) copy.lexicon = lexicon;
      else delete copy.lexicon;
    }
    for (const field of BLOB_FIELDS) copy[field] = includeMedia && cards[i][field] ? await blobToDataUrl(cards[i][field]) : null;
    // v10.21 (Lot 1) : voix par langue. Les anciens champs audioFr/audioDr restent lus pour les cartes non migrées.
    const voiceSource = { ...{ fr: cards[i].audioFr, dr: cards[i].audioDr }, ...(cards[i].audios || {}) };
    const audios = {};
    for (const [code, blob] of Object.entries(voiceSource)) if (includeMedia && blob) audios[code] = await blobToDataUrl(blob);
    copy.audios = audios;
    delete copy.audioFr;
    delete copy.audioDr;
    parts.push((i ? ',' : '') + JSON.stringify(copy));
    await step();
  }
  parts.push('],"visuals":[');
  for (let i = 0; i < visuals.length; i += 1) {
    const v = visuals[i];
    parts.push((i ? ',' : '') + JSON.stringify({ key: v.key, meta: v.meta || {}, ts: v.ts || 0, data: await blobToDataUrl(v.blob) }));
    await step();
  }
  parts.push(']}');
  onProgress(100);
  const name = `kalimati-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  return new File(parts, name, { type: 'application/json' });
}

// Renvoie 'shared', 'downloaded' ou 'cancelled'. Doit être appelée juste après un toucher du parent.
export async function deliverBackup(file) {
  if (navigator.canShare && navigator.share) {
    let shareable = false;
    try { shareable = navigator.canShare({ files: [file] }); } catch { shareable = false; }
    if (shareable) {
      try {
        await navigator.share({ files: [file], title: 'Sauvegarde Kalimati' });
        return 'shared';
      } catch (error) {
        if (error && error.name === 'AbortError') return 'cancelled';
        // Partage refusé par le navigateur : on passe au téléchargement classique.
      }
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  // On laisse le temps au téléphone de demander « Télécharger ? » avant de libérer le fichier.
  setTimeout(() => URL.revokeObjectURL(url), 120000);
  return 'downloaded';
}

// Ancien nom gardé pour compatibilité (prépare puis télécharge d'un coup).
export async function exportBackup(data) {
  return deliverBackup(await buildBackupFile(data));
}

function isValidCard(card) {
  return card && typeof card.id === 'string' && typeof card.fr === 'string' && typeof card.cat === 'string';
}

function isDataUrl(value, kinds = 'image|audio|video') {
  return typeof value === 'string' && new RegExp(`^data:(${kinds})/[\\w.+-]+(;[\\w=.+-]+)*;base64,`).test(value);
}

const cleanText = (value, max) => String(value ?? '').slice(0, max);
const cleanPos = (value) => (Number.isInteger(value) && value >= 1 && value <= 100 ? value : null);
const cleanKey = (value) => (typeof value === 'string' && /^[\w:.-]{1,80}$/.test(value) ? value : null);
// Lot 2 : places par taille de grille (2, 3, 4, 5 colonnes). Une sauvegarde v10 sans `positions`
// reste lisible : la migration v11 la complétera au chargement.
function cleanPositions(value) {
  const out = {};
  if (!value || typeof value !== 'object') return out;
  for (const size of [2, 3, 4, 5]) {
    const place = value[String(size)];
    if (!place || typeof place !== 'object') continue;
    const row = cleanPos(place.row);
    const col = cleanPos(place.col);
    if (row && col && col <= size) out[String(size)] = { row, col };
  }
  return out;
}

export function mergeBackupCards(localCards, backupCards) {
  const byId = new Map(localCards.map((card) => [card.id, card]));
  for (const incoming of backupCards) {
    const local = byId.get(incoming.id);
    if (!local) {
      byId.set(incoming.id, incoming);
      continue;
    }
    if (incoming.lexicon?.owned) {
      const merged = mergeLexicalCard(local, incoming);
      if (merged) byId.set(incoming.id, merged);
      continue;
    }
    byId.set(incoming.id, { ...local });
  }
  return [...byId.values()];
}

export function mergeBackupSetting(key, local, incoming) {
  if (local === undefined || local === null) return incoming;
  if (key === 'onlyReviewed' || key === 'emojiSkinTone') return local;

  const listSettings = ['stories', 'atecHistory', 'atec_history'];
  if (listSettings.includes(key) && Array.isArray(local) && Array.isArray(incoming)) {
    const itemKey = (item) => (item && typeof item === 'object' ? (item.id || `${item.day || ''}-${item.ts || ''}`) : JSON.stringify(item));
    const map = new Map(incoming.filter(Boolean).map((item) => [itemKey(item), item]));
    for (const item of local.filter(Boolean)) map.set(itemKey(item), item);
    return [...map.values()];
  }

  if (key === 'aacHistory' && typeof local === 'object' && typeof incoming === 'object') {
    const out = { uni: { ...(incoming.uni || {}) }, bi: { ...(incoming.bi || {}) } };
    for (const part of ['uni', 'bi']) {
      for (const [key, value] of Object.entries(local[part] || {})) {
        out[part][key] = Math.max(Number(value) || 0, Number(out[part][key]) || 0);
      }
    }
    return out;
  }

  if (['customSchedules', 'scheduleTempOverrides', 'levels'].includes(key)
      && typeof local === 'object' && typeof incoming === 'object'
      && !Array.isArray(local)) {
    return { ...incoming, ...local };
  }

  return incoming;
}

function cleanTrial(raw) {
  if (!raw || typeof raw.id !== 'string' || typeof raw.goalId !== 'string' || !Number.isFinite(raw.ts)) return null;
  if (!['plus', 'prompt', 'minus', 'log'].includes(raw.result)) return null;
  return {
    id: raw.id, goalId: cleanText(raw.goalId, 8), ts: raw.ts, day: cleanText(raw.day, 10), week: cleanText(raw.week, 8),
    result: raw.result, prompt: raw.prompt ? cleanText(raw.prompt, 20) : null,
    item: raw.item === null || raw.item === undefined ? null : cleanText(raw.item, 80),
    meta: raw.meta && typeof raw.meta === 'object' ? JSON.parse(JSON.stringify(raw.meta)) : {},
    intervenant: cleanText(raw.intervenant, 20), environment: cleanText(raw.environment, 20),
    reinforcer: raw.reinforcer ? cleanText(raw.reinforcer, 20) : null,
  };
}

// Une ligne de journal (ABC ou orthophonie) : un identifiant, une date, et seulement des données simples (pas de fichier).
function cleanLog(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || raw.id.length > 80 || !Number.isFinite(raw.ts)) return null;
  const copy = JSON.parse(JSON.stringify(raw));
  return typeof copy.day === 'string' ? copy : { ...copy, day: dayOf(copy.ts) };
}
const dayOf = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const cleanLogs = (list) => (Array.isArray(list) ? list.map(cleanLog).filter(Boolean) : []);

// Renvoie { cards, trials, settings, visuals, abcLogs, orthoLogs } ; accepte les sauvegardes v1 (cartes seules), v2, v3 et v4.
export async function readBackup(file, passphrase = '') {
  const text = await file.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Ce fichier n\'est pas une sauvegarde Kalimati.'); }
  if (parsed && parsed.format === ENCRYPTED_FORMAT) {
    if (!String(passphrase || '').trim()) {
      const error = new Error('Cette sauvegarde est chiffrée par un mot de passe. Saisissez-le pour la restaurer.');
      error.needsPassphrase = true;
      throw error;
    }
    const declared = Number(parsed.iterations);
    const iterations = Number.isInteger(declared) && declared >= 100000 && declared <= 2000000 ? declared : BACKUP_ITERATIONS;
    try {
      const salt = b64ToBytes(parsed.salt);
      const iv = b64ToBytes(parsed.iv);
      const key = await deriveBackupKey(passphrase, salt, iterations);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, b64ToBytes(parsed.ciphertext));
      parsed = JSON.parse(new TextDecoder().decode(plain));
    } catch {
      throw new Error('Mot de passe incorrect ou sauvegarde chiffrée abîmée. Vérifiez le mot de passe et le fichier.');
    }
  }
  if (!parsed || !FORMATS.includes(parsed.format) || !Array.isArray(parsed.cards)) {
    throw new Error('Ce fichier n\'est pas une sauvegarde Kalimati.');
  }
  const cards = [];
  for (const raw of parsed.cards.filter(isValidCard)) {
    const card = {
      id: raw.id, wordId: typeof raw.wordId === 'string' && raw.wordId ? raw.wordId.slice(0, 120) : raw.id,
      cat: raw.cat, fr: raw.fr.slice(0, 40), sub: cleanText(raw.sub, 30), dr: cleanText(raw.dr, 40), ar: cleanText(raw.ar, 40),
      emoji: cleanText(raw.emoji, 32), order: Number(raw.order) || 0,
      gram: GRAMS.includes(raw.gram) ? raw.gram : 'noun', hidden: raw.hidden === true,
      gridRow: cleanPos(raw.gridRow), gridCol: cleanPos(raw.gridCol), positions: cleanPositions(raw.positions),
      visualKey: cleanKey(raw.visualKey), sayFr: cleanText(raw.sayFr, 60), sayAr: cleanText(raw.sayAr, 60),
    };
    for (const field of BLOB_FIELDS) card[field] = isDataUrl(raw[field]) ? await dataUrlToBlob(raw[field]) : null;
    // v10.21 (Lot 1) : voix par langue ; on relit aussi les anciennes sauvegardes (audioFr/audioDr).
    const audios = {};
    const rawAudios = (raw.audios && typeof raw.audios === 'object') ? raw.audios : {};
    for (const [code, data] of Object.entries(rawAudios)) if (isDataUrl(data, 'audio')) audios[code] = await dataUrlToBlob(data);
    if (isDataUrl(raw.audioFr, 'audio') && !audios.fr) audios.fr = await dataUrlToBlob(raw.audioFr);
    if (isDataUrl(raw.audioDr, 'audio') && !audios.dr) audios.dr = await dataUrlToBlob(raw.audioDr);
    card.audios = audios;
    const lexicon = sanitizeLexiconMetadata(raw.lexicon);
    if (lexicon) card.lexicon = lexicon;
    cards.push(card);
  }
  const trials = Array.isArray(parsed.trials) ? parsed.trials.map(cleanTrial).filter(Boolean) : [];
  const settings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {};
  const visuals = [];
  for (const raw of Array.isArray(parsed.visuals) ? parsed.visuals : []) {
    const key = cleanKey(raw && raw.key);
    if (key && isDataUrl(raw.data, 'image')) visuals.push({ key, blob: await dataUrlToBlob(raw.data), meta: {}, ts: Number(raw.ts) || Date.now() });
  }
  return { cards, trials, settings, visuals, abcLogs: cleanLogs(parsed.abcLogs), orthoLogs: cleanLogs(parsed.orthoLogs) };
}
