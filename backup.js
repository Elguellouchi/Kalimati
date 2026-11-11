// Sauvegarde (cartes, photos, vidéos, voix du parent, photos personnalisées, essais notés, réglages) et restauration.
// Les enregistrements de la voix d'Abir ne sont jamais mis dans la sauvegarde : ils restent dans le téléphone.
import { blobToDataUrl, dataUrlToBlob } from './media.js';

const BLOB_FIELDS = ['photo', 'video', 'audioFr', 'audioDr'];
const FORMATS = ['kalimati-backup-v1', 'kalimati-backup-v2', 'kalimati-backup-v3'];
const FORMAT = 'kalimati-backup-v3';
const GRAMS = ['person', 'verb', 'noun', 'adj', 'social'];

export async function exportBackup({ cards, trials = [], settings = {}, visuals = [] }) {
  const serialised = [];
  for (const card of cards) {
    const copy = { ...card };
    for (const field of BLOB_FIELDS) copy[field] = card[field] ? await blobToDataUrl(card[field]) : null;
    serialised.push(copy);
  }
  const photos = [];
  for (const visual of visuals) photos.push({ key: visual.key, meta: visual.meta || {}, ts: visual.ts || 0, data: await blobToDataUrl(visual.blob) });
  const payload = { format: FORMAT, exportedAt: new Date().toISOString(), cards: serialised, trials, settings, visuals: photos };
  const file = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = `kalimati-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
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

// Renvoie { cards, trials, settings, visuals } ; accepte les sauvegardes v1 (cartes seules), v2 et v3.
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
  return { cards, trials, settings, visuals };
}
