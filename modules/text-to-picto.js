// v10.32 (pépite « Convertisseur texte → pictogrammes », DictaPicto) : l'adulte écrit une phrase
// (« On va chez le médecin »), l'enfant la voit en images et l'entend avec les voix des cartes.
// Tout se fait dans le téléphone : aucun mot ne part sur internet, rien n'est enregistré.
// Ce fichier ne fait que la correspondance mot → carte (fonction pure, testée par tools/test-picto.mjs).

import { CATALOG } from './catalog.js';

export const normWord = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  .replace(/[’'`]/g, ' ').replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/-/g, ' ').replace(/\s+/g, ' ').trim();

// Petits mots français qu'on ne dessine pas (articles, pronoms sujets) : ils restent lisibles dans la phrase écrite.
const SKIP = new Set(['le', 'la', 'les', 'l', 'un', 'une', 'des', 'du', 'de', 'd', 'au', 'aux', 'et', 'on', 'nous', 'vous',
  'il', 'elle', 'ils', 'elles', 'je', 'j', 'tu', 'ce', 'c', 'ca', 'cela', 'se', 's', 'y', 'en', 'ne', 'n', 'pas', 'a', 'que', 'qu']);
const ARTICLES = /^(le|la|les|l|un|une|du|des|de la|ma|mon|mes|ta|ton|tes)\s+/;

// Formes courantes des verbes irréguliers → infinitif de la carte.
const IRREGULAR = {
  va: 'aller', vas: 'aller', vais: 'aller', allons: 'aller', allez: 'aller', vont: 'aller',
  bois: 'boire', boit: 'boire', buvons: 'boire', buvez: 'boire', boivent: 'boire',
  dors: 'dormir', dort: 'dormir', dormons: 'dormir', dorment: 'dormir',
  cours: 'courir', court: 'courir', courons: 'courir', courent: 'courir',
  ouvre: 'ouvrir', ouvres: 'ouvrir', ouvrons: 'ouvrir', ouvrent: 'ouvrir',
  fais: 'faire', fait: 'faire', faisons: 'faire', font: 'faire',
  prends: 'prendre', prend: 'prendre', prenons: 'prendre', prennent: 'prendre',
  veux: 'je veux', veut: 'je veux', voulons: 'je veux', voulez: 'je veux', veulent: 'je veux',
  mal: "j ai mal", fatiguee: 'fatigue', contente: 'content', fiere: 'fier', petite: 'petit', grande: 'grand',
};

// Variantes d'un mot pour retrouver la carte : pluriel, féminin, verbe conjugué du 1er groupe.
function variants(w) {
  const out = [w];
  if (IRREGULAR[w]) out.push(IRREGULAR[w]);
  if (w.length > 3 && /[sx]$/.test(w)) out.push(w.slice(0, -1));
  if (w.length > 3 && /e$/.test(w)) out.push(`${w}r`, w.slice(0, -1));
  if (w.length > 4 && /es$/.test(w)) out.push(`${w.slice(0, -2)}er`, w.slice(0, -2));
  if (w.length > 4 && /ez$/.test(w)) out.push(`${w.slice(0, -2)}er`);
  if (w.length > 5 && /ons$/.test(w)) out.push(`${w.slice(0, -3)}er`);
  if (w.length > 5 && /ent$/.test(w)) out.push(`${w.slice(0, -3)}er`);
  return out;
}

// cards : liste des cartes ; wordsOf(card) : les mots de la carte (langue choisie + français).
export function buildIndex(cards, wordsOf) {
  const index = new Map();
  const put = (key, card) => { if (key && !index.has(key)) index.set(key, card); };
  for (const card of cards || []) {
    for (const raw of wordsOf(card)) {
      for (const part of String(raw || '').split(/\s*[·,/]\s*/)) {
        const key = normWord(part.replace(/\(.*?\)/g, ''));
        put(key, card);
        put(key.replace(ARTICLES, ''), card);
      }
    }
  }
  return index;
}

// Découpe le texte et cherche d'abord les groupes de 3, puis 2, puis 1 mot (« je veux », « dessin animé »).
// Résultat : [{ card, text }] pour un mot trouvé, [{ text }] pour un mot sans image.
export function matchPictos(text, index, { skipSmallWords = true } = {}) {
  const shown = String(text || '').replace(/[’']/g, "' ").replace(/(\p{L})-(\p{L})/gu, '$1 $2').split(/\s+/).filter(Boolean);
  const words = shown.map((w) => normWord(w)).map((w) => w.split(' ')[0] || '');
  const out = [];
  for (let i = 0; i < words.length;) {
    let hit = null;
    for (let n = Math.min(3, words.length - i); n >= 1 && !hit; n -= 1) {
      const group = words.slice(i, i + n).join(' ');
      const keys = n === 1 ? variants(group) : [group];
      for (const k of keys) { if (index.has(k)) { hit = { card: index.get(k), n }; break; } }
    }
    if (hit) {
      out.push({ card: hit.card, text: shown.slice(i, i + hit.n).join(' ') });
      i += hit.n;
    } else {
      if (words[i] && !(skipSmallWords && SKIP.has(words[i]))) out.push({ text: shown[i].replace(/[.,!?;:]+$/, '') });
      i += 1;
    }
  }
  return out;
}

// Mots de secours quand aucune carte ne correspond : petits dessins (emoji) dits par la voix du téléphone.
// D'abord les mots utiles pour annoncer une sortie ou un changement, puis le catalogue illustré (300+ mots).
const EXTRA = [
  ['aller', '🚶', ['partir']], ['médecin', '🧑‍⚕️', ['docteur', 'medecin']], ['dentiste', '🦷'], ['hôpital', '🏥', ['hopital', 'clinique']],
  ['pharmacie', '💊', ['médicament', 'medicament']], ['magasin', '🛒', ['supermarché', 'supermarche', 'courses']], ['bus', '🚌'], ['frites', '🍟', ['frite']], ['train', '🚆'], ['avion', '✈️'],
  ['mosquée', '🕌', ['mosquee']], ['piscine', '🏊'], ['plage', '🏖️', ['mer']], ['coiffeur', '💇'], ['anniversaire', '🎂'], ['fête', '🎉', ['fete']],
  ['maintenant', '👉'], ['après', '⏭️', ['apres', 'ensuite', 'puis']], ['d’abord', '1️⃣', ['abord']], ['demain', '🌅'], ['aujourd’hui', '📅', ['aujourd hui']],
  ['matin', '🌞'], ['soir', '🌙'], ['nuit', '🌙'], ['attendre', '⏳', ['attend', 'attends']], ['habiller', '👕', ['habille', 'habiller']],
  ['chaussures', '👟', ['chaussure']], ['manteau', '🧥'], ['dents', '🪥', ['dent', 'brosser']], ['douche', '🚿'], ['lit', '🛏️'],
  ['grand-mère', '👵', ['grand mere']], ['grand-père', '👴', ['grand pere']], ['sœur', '👧', ['soeur']], ['frère', '👦', ['frere']],
  ['ami', '🧒', ['amie', 'copain', 'copine']], ['télé', '📺', ['tele', 'television']], ['téléphone', '📱', ['telephone']],
  ['calme', '🤫'], ['bravo', '👏'], ['gentil', '💛', ['gentille']], ['doucement', '🐢'], ['vite', '⚡'], ['ici', '📍'], ['avec', '🤝'],
];
export const extraConcepts = () => [
  ...EXTRA.map(([fr, emoji, alt = []]) => ({ id: `extra:${fr}`, fr, emoji, alt, extra: true })),
  ...CATALOG.map((c) => ({ id: `extra:${c.id}`, fr: c.fr, emoji: c.emoji, alt: [], extra: true })),
];
