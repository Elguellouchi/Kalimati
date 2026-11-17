// Sauvegarde (cartes, photos, vidéos, voix du parent, photos personnalisées, essais notés, réglages) et restauration.
// Les enregistrements de la voix d'Abir ne sont jamais mis dans la sauvegarde : ils restent dans le téléphone.
// v9.8 : la sauvegarde garde aussi le journal des comportements (ABC) et le journal d'orthophonie (texte seulement).
import { blobToDataUrl, dataUrlToBlob } from './media.js';

const BLOB_FIELDS = ['photo', 'video', 'audioFr', 'audioDr'];
const FORMATS = ['kalimati-backup-v1', 'kalimati-backup-v2', 'kalimati-backup-v3', 'kalimati-backup-v4'];
const FORMAT = 'kalimati-backup-v4';
const GRAMS = ['person', 'verb', 'noun', 'adj', 'social'];

// v9.10 : la sauvegarde se fait en 2 temps, sans bloquer l'écran.
// 1) buildBackupFile prépare le fichier morceau par morceau (l'écran respire entre chaque carte et indique l'avancement).
// 2) deliverBackup le donne au parent : feuille de partage du téléphone (« Enregistrer dans Fichiers », Drive…)
//    ou, à défaut, téléchargement classique. Sur iPhone, le partage exige un nouveau toucher : d'où le 2e bouton.
const pause = () => new Promise((resolve) => setTimeout(resolve, 0));

export async function buildBackupFile({ cards, trials = [], settings = {}, visuals = [], abcLogs = [], orthoLogs = [] }, onProgress = () => {}) {
  const total = cards.length + visuals.length || 1;
  let done = 0;
  const step = async () => { done += 1; onProgress(Math.min(99, Math.round((done / total) * 100))); await pause(); };
  const head = { format: FORMAT, exportedAt: new Date().toISOString(), trials, settings, abcLogs, orthoLogs };
  const parts = [JSON.stringify(head).slice(0, -1), ',"cards":['];
  for (let i = 0; i < cards.length; i += 1) {
    const copy = { ...cards[i] };
    for (const field of BLOB_FIELDS) copy[field] = cards[i][field] ? await blobToDataUrl(cards[i][field]) : null;
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
export async function readBackup(file) {
  const parsed = JSON.parse(await file.text());
  if (!parsed || !FORMATS.includes(parsed.format) || !Array.isArray(parsed.cards)) {
    throw new Error('Ce fichier n\'est pas une sauvegarde Kalimati.');
  }
  const cards = [];
  for (const raw of parsed.cards.filter(isValidCard)) {
    const card = {
      id: raw.id, cat: raw.cat, fr: raw.fr.slice(0, 40), sub: cleanText(raw.sub, 30), dr: cleanText(raw.dr, 40), ar: cleanText(raw.ar, 40),
      emoji: cleanText(raw.emoji, 8), order: Number(raw.order) || 0,
      gram: GRAMS.includes(raw.gram) ? raw.gram : 'noun', hidden: raw.hidden === true,
      gridRow: cleanPos(raw.gridRow), gridCol: cleanPos(raw.gridCol),
      visualKey: cleanKey(raw.visualKey), sayFr: cleanText(raw.sayFr, 60), sayAr: cleanText(raw.sayAr, 60),
    };
    for (const field of BLOB_FIELDS) card[field] = isDataUrl(raw[field]) ? await dataUrlToBlob(raw[field]) : null;
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
