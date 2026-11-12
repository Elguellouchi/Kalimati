// Banque d'images en ligne : pictogrammes ARASAAC (jusqu'à 4 par mot) et photo réelle Wikipédia.
// Seul le mot cherché part sur internet. Tout est gardé dans IndexedDB (online_cache) pour le mode hors ligne.
// Si rien n'arrive en 1,5 s, on affiche aussitôt une image de secours (emoji dessiné), sans bloquer l'exercice.
import * as db from '../db.js';
import { h } from './util.js';
import { hasPhoto, renderVisual } from './visuals.js';

const ARASAAC_SEARCH = 'https://api.arasaac.org/v1/pictograms/fr/search/';
const ARASAAC_IMAGE = (id) => `https://static.arasaac.org/pictograms/${id}/${id}_300.png`;
const WIKI_SUMMARY = 'https://fr.wikipedia.org/api/rest_v1/page/summary/';
const MAX_PICTOS = 4;
const QUICK_MS = 1500;

export const isOnline = () => navigator.onLine;

const memory = new Map(); // id → { pictos: [url], photo: url | null }
const pending = new Map();

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function fetchBlob(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  return response.blob();
}

async function downloadPictos(concept) {
  try {
    const response = await fetch(`${ARASAAC_SEARCH}${encodeURIComponent(concept.fr)}`);
    if (!response.ok) return [];
    const ids = (await response.json()).slice(0, MAX_PICTOS).map((p) => p._id);
    const blobs = await Promise.all(ids.map((id) => fetchBlob(ARASAAC_IMAGE(id)).catch(() => null)));
    return blobs.filter(Boolean);
  } catch { return []; }
}

async function downloadPhoto(concept) {
  try {
    const response = await fetch(`${WIKI_SUMMARY}${encodeURIComponent(concept.wiki)}`);
    if (!response.ok) return null;
    const data = await response.json();
    const source = data.thumbnail && data.thumbnail.source;
    return source ? await fetchBlob(source) : null;
  } catch { return null; }
}

function remember(id, record) {
  const urls = { pictos: (record.pictos || []).map((b) => URL.createObjectURL(b)), photo: record.photo ? URL.createObjectURL(record.photo) : null };
  memory.set(id, urls);
  return urls;
}

// Images déjà connues (mémoire puis IndexedDB), sans réseau.
export async function cachedVisuals(concept) {
  if (memory.has(concept.id)) return memory.get(concept.id);
  const record = await db.getOnlineCache(concept.id).catch(() => null);
  return record ? remember(concept.id, record) : null;
}

// Images d'un mot : cache, sinon téléchargement (en ligne seulement), mis en cache pour toujours.
export async function fetchOnlineVisuals(concept) {
  const cached = await cachedVisuals(concept);
  if (cached && (cached.pictos.length || cached.photo)) return cached;
  if (!isOnline()) return cached || { pictos: [], photo: null };
  if (!pending.has(concept.id)) {
    pending.set(concept.id, (async () => {
      const [pictos, photo] = await Promise.all([downloadPictos(concept), downloadPhoto(concept)]);
      const record = { key: concept.id, pictos, photo, ts: Date.now() };
      if (pictos.length || photo) await db.putOnlineCache(record).catch(() => {});
      pending.delete(concept.id);
      return remember(concept.id, record);
    })());
  }
  return pending.get(concept.id);
}

// Prépare les images des mots d'un essai pendant que l'enfant regarde (sans attendre).
export function prefetch(concepts) { if (isOnline()) concepts.forEach((c) => { fetchOnlineVisuals(c).catch(() => {}); }); }

// ---------- Images de secours dessinées (variantes : couleur de fond, taille, angle, miroir) ----------
const BACKGROUNDS = ['#FDE7EF', '#E3F4EF', '#FFF3D6', '#E3ECFB', '#F1E6FA', '#E8F5E9'];
export function emojiSvg(emoji, variant = 0) {
  const bg = BACKGROUNDS[variant % BACKGROUNDS.length];
  const angle = [0, -14, 12, 0, -8, 18][variant % 6];
  const scale = [1, 0.8, 1.1, 0.9, 1, 0.75][variant % 6];
  const flip = variant % 2 ? -1 : 1;
  return `<svg viewBox="0 0 200 200" aria-hidden="true"><rect width="200" height="200" rx="34" fill="${bg}"/>
    <g transform="translate(100 104) rotate(${angle}) scale(${flip * scale} ${scale})"><text x="0" y="0" font-size="120" text-anchor="middle" dominant-baseline="middle">${emoji}</text></g></svg>`;
}

// Élément image d'un mot. style : 'best' (photo du parent > photo réelle > picto > dessin), 'photo', 'picto', 'picto2', 'drawing'.
export function conceptVisual(concept, { style = 'best', variant = 0, size = '' } = {}) {
  const box = h('span', { class: `visual concept-visual ${size}`.trim(), dataset: { concept: concept.id } });
  const parentKey = `obj:${concept.id}`;
  const showDrawing = () => { box.innerHTML = emojiSvg(concept.emoji || '❔', variant); };
  const show = (url) => { box.replaceChildren(h('img', { src: url, alt: '', class: 'visual-photo', loading: 'lazy' })); };
  if (style === 'best' && hasPhoto(parentKey)) return renderVisual({ vkey: parentKey, emoji: concept.emoji, label: concept.fr }, { button: false });
  showDrawing();
  if (style === 'drawing') return box;
  withTimeout(fetchOnlineVisuals(concept), QUICK_MS).then((v) => {
    if (!v) { fetchOnlineVisuals(concept).then((late) => late && apply(late)); return; }
    apply(v);
  });
  function apply(v) {
    const pick = {
      photo: v.photo || v.pictos[0],
      picto: v.pictos[0] || v.photo,
      picto2: v.pictos[1] || v.photo || v.pictos[0],
      best: v.photo || v.pictos[0],
    }[style];
    if (pick) show(pick);
  }
  return box;
}

export async function cacheSize() { return (await db.getAllOnlineKeys().catch(() => [])).length; }
