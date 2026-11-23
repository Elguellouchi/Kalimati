// v10.39 (pépite « Vidéos d'autres enfants », version vie privée) :
// la famille filme un frère, une sœur, un cousin ou un parent qui fait l'action (se laver les mains, dire bonjour…).
// L'enfant regarde le modèle dans 📍 Lieux. La vidéo reste dans ce téléphone : jamais dans la sauvegarde,
// jamais dans la synchro, jamais envoyée. Aucune vidéo d'enfant n'est livrée avec l'application.

export const VIDEO_SETTING_KEY = 'modelVideos';
export const MAX_VIDEOS = 20;
export const MAX_VIDEO_BYTES = 120 * 1024 * 1024; // ~2 minutes filmées sur iPhone
export const videoBlobKey = (id) => `modelVideo:${id}`;
export const newVideoId = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const VIDEO_WHO = [
  ['frere', 'Un frère'], ['soeur', 'Une sœur'], ['cousin', 'Un cousin / une cousine'], ['parent', 'Un parent'], ['autre', 'Un autre modèle'],
];

const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

// Garde seulement des entrées propres : { id, title, word, who }.
export function cleanVideos(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  for (const v of value) {
    if (!v || typeof v !== 'object') continue;
    const id = clip(v.id, 40);
    const title = clip(v.title, 40);
    if (!/^v[a-z0-9]+$/.test(id) || !title || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title, word: clip(v.word, 30), who: VIDEO_WHO.some(([k]) => k === v.who) ? v.who : 'autre' });
    if (out.length >= MAX_VIDEOS) break;
  }
  return out;
}

// Vérifie le fichier choisi avant de l'enregistrer. Rend un message, ou '' si tout va bien.
export function videoProblem(file) {
  if (!file) return 'Choisissez ou filmez une vidéo.';
  if (file.type && !file.type.startsWith('video/')) return 'Ce fichier n’est pas une vidéo.';
  if (file.size > MAX_VIDEO_BYTES) return 'Vidéo trop longue : gardez moins de 2 minutes.';
  if (!file.size) return 'Vidéo vide.';
  return '';
}
