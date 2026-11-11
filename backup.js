// Sauvegarde complète (cartes, photos, voix) dans un fichier, et restauration.
import { blobToDataUrl, dataUrlToBlob } from './media.js';

const BLOB_FIELDS = ['photo', 'audioFr', 'audioDr'];
const FORMAT = 'kalimati-backup-v1';

export async function exportBackup(cards) {
  const serialised = [];
  for (const card of cards) {
    const copy = { ...card };
    for (const field of BLOB_FIELDS) copy[field] = card[field] ? await blobToDataUrl(card[field]) : null;
    serialised.push(copy);
  }
  const file = new Blob([JSON.stringify({ format: FORMAT, cards: serialised })], { type: 'application/json' });
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

function isDataUrl(value) {
  return typeof value === 'string' && /^data:(image|audio)\/[\w.+-]+(;[\w=.+-]+)*;base64,/.test(value);
}

export async function readBackup(file) {
  const parsed = JSON.parse(await file.text());
  if (!parsed || parsed.format !== FORMAT || !Array.isArray(parsed.cards)) {
    throw new Error('Ce fichier n\'est pas une sauvegarde Kalimati.');
  }
  const cards = [];
  for (const raw of parsed.cards.filter(isValidCard)) {
    const card = {
      id: raw.id, cat: raw.cat, fr: raw.fr.slice(0, 40), dr: String(raw.dr ?? '').slice(0, 40),
      emoji: String(raw.emoji ?? '').slice(0, 4), order: Number(raw.order) || 0,
    };
    for (const field of BLOB_FIELDS) card[field] = isDataUrl(raw[field]) ? await dataUrlToBlob(raw[field]) : null;
    cards.push(card);
  }
  return cards;
}
