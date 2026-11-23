// v10.33 (pépites « Pages environnementales » TD Snap et « Tableau express » Cboard) :
// un tableau par lieu (dentiste, médecin, école…) qui remplace la grille le temps de la sortie.
// Les cartes de base ne bougent pas : la ligne « Je veux, Aide-moi, Encore… » reste en haut,
// et un toucher sur « ↩ » rend la grille habituelle. Les tableaux express du parent restent
// dans le téléphone (réglage « placeBoards »), sans prénom ni photo dans le code.
import { buildIndex, matchPictos, extraConcepts } from './text-to-picto.js';

// Chaque mot est retrouvé comme dans « Écrire une phrase en images » : d'abord une carte de Kalimati,
// sinon un mot dessiné du catalogue. Les mots sont écrits en français : ce sont les noms des cartes.
export const PLACES = [
  { id: 'dentiste', emoji: '🦷', title: 'Chez le dentiste', words: ['Bonjour', 'Attends', "J'ai mal", 'Peur', 'Calme', 'Ouvrir', 'bouche', 'dents', 'Eau', 'Fini', 'Encore', 'Câlin', 'Bravo', 'Merci', 'Au revoir'] },
  { id: 'medecin', emoji: '🧑‍⚕️', title: 'Chez le médecin', words: ['Bonjour', "J'ai mal", 'tête', 'ventre', 'main', 'Peur', 'Attends', 'Calme', 'Fatigué', 'pharmacie', 'Eau', 'Câlin', 'Fini', 'Merci', 'Au revoir'] },
  { id: 'ecole', emoji: '🏫', title: 'À l’école', words: ['Bonjour', 'Maîtresse', 'Aide-moi', 'Toilettes', 'Boire', 'Manger', 'Dessiner', 'crayon', 'cahier', 'livre', 'ciseaux', 'Jouer', 'Fatigué', 'Fini', 'Au revoir'] },
  { id: 'magasin', emoji: '🛒', title: 'Au magasin', words: ['Je veux', 'Biscuit', 'Chips', 'Jus', 'Banane', 'Pomme', 'Yaourt', 'Fromage', 'Gâteau', 'Lait', 'Attends', 'Encore', 'Non', 'Fini', 'Merci'] },
  { id: 'mosquee', emoji: '🕌', title: 'À la mosquée', words: ['Bonjour', 'Laver', 'mains', 'tapis', 'Calme', 'Attends', 'Papa', 'Toilettes', 'Boire', 'Fatigué', 'Fini', 'Au revoir'] },
  { id: 'parc', emoji: '🎠', title: 'Au parc', words: ['Jouer', 'Balançoire', 'toboggan', 'Ballon', 'Courir', 'Sauter', 'Encore', 'Attends', 'Boire', 'Toilettes', 'Fatigué', 'Maison', 'Fini'] },
  { id: 'restaurant', emoji: '🍔', title: 'Au restaurant', words: ['Je veux', 'Mcdo', 'frites', 'Coca-cola', 'Eau', 'Pain', 'Manger', 'Boire', 'Encore', 'Chaud', 'Froid', 'Toilettes', 'Fini', 'Merci'] },
  { id: 'coiffeur', emoji: '💇', title: 'Chez le coiffeur', words: ['Bonjour', 'cheveux', 'ciseaux', 'peigne', 'Peur', 'Calme', 'Attends', 'Froid', 'Chaud', 'Fini', 'Bravo', 'Au revoir'] },
  { id: 'voiture', emoji: '🚗', title: 'En voiture', words: ['Voiture', 'Attends', 'Musique', 'Tablette', 'Boire', 'Manger', 'Toilettes', 'Fatigué', 'Dormir', 'Maison', 'Fini'] },
];

export const PLACE_SETTING_KEY = 'placeBoards';

// Liste propre des tableaux express (ce que le parent a écrit, nettoyé et borné).
export function cleanCustomBoards(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((b) => b && typeof b === 'object')
    .map((b) => ({ id: String(b.id || '').slice(0, 40), title: String(b.title || '').trim().slice(0, 40), emoji: String(b.emoji || '📌').slice(0, 8), text: String(b.text || '').slice(0, 600) }))
    .filter((b) => b.id && b.title && b.text.trim())
    .slice(0, 20);
}

export const newBoardId = () => `express-${Date.now().toString(36)}`;

// Un mot (ou une ligne) par case. Pour un lieu fourni, chaque mot de la liste est cherché seul ;
// pour un tableau express, le parent peut séparer par des virgules ou des retours à la ligne.
export function boardItems(board, cards, wordsOf) {
  const index = buildIndex([...cards, ...extraConcepts()], (c) => (c.extra ? [c.fr, ...(c.alt || [])] : wordsOf(c)));
  const pieces = board.words ? board.words : String(board.text || '').split(/[\n,;]+/);
  const seen = new Set();
  const out = [];
  for (const piece of pieces) {
    for (const item of matchPictos(piece.trim(), index)) {
      const key = item.card ? item.card.id : `mot:${item.text.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out.slice(0, 30);
}

// Une case « mot dessiné » devient une carte de passage : elle peut entrer dans la phrase de l'enfant,
// elle parle avec la voix du téléphone, et n'est jamais enregistrée dans les cartes de base.
export function passingCard(item) {
  const c = item.card;
  return { id: c.id, fr: c.fr.charAt(0).toUpperCase() + c.fr.slice(1), emoji: c.emoji, cat: 'lieux', gram: 'noun', extra: true, gridRow: 0, gridCol: 0 };
}
