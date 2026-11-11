// Cartes de départ. Le parent remplace l'emoji par une vraie photo et enregistre sa voix.
// Les mots en darija sont écrits en lettres latines : à vérifier et corriger par le parent.

export const CATEGORIES = [
  { id: 'base', fr: 'Essentiel', dr: 'Lmouhim', color: '#F4B400' },
  { id: 'manger', fr: 'Manger', dr: 'Makla', color: '#F57C00' },
  { id: 'boire', fr: 'Boire', dr: 'Chrab', color: '#0288D1' },
  { id: 'jouer', fr: 'Jouer', dr: 'L3ab', color: '#43A047' },
  { id: 'personnes', fr: 'Personnes', dr: 'Nas', color: '#FBC02D' },
  { id: 'besoins', fr: 'Besoins', dr: 'Hajat', color: '#8E24AA' },
  { id: 'emotions', fr: 'Émotions', dr: 'Ihsas', color: '#E91E63' },
  { id: 'lieux', fr: 'Lieux', dr: 'Blayes', color: '#00897B' },
];

const RAW = [
  ['base', 'Je veux', 'Bghit', '🙋'], ['base', 'Oui', 'Ah', '👍'], ['base', 'Non', 'La', '👎'],
  ['base', 'Encore', 'Zid', '➕'], ['base', 'Fini', 'Safi', '✋'], ['base', 'Aide-moi', '3awnni', '🤝'],
  ['base', 'Attends', 'Tsenna', '⏳'], ['base', "J'ai mal", 'Kayderni', '🤕'],
  ['manger', 'Pain', 'Khobz', '🍞'], ['manger', 'Pomme', 'Teffah', '🍎'], ['manger', 'Banane', 'Banan', '🍌'],
  ['manger', 'Gâteau', 'Gato', '🍰'], ['manger', 'Yaourt', 'Danone', '🥛'], ['manger', 'Riz', 'Rouz', '🍚'],
  ['manger', 'Biscuit', 'Biskwi', '🍪'], ['manger', 'Œuf', 'Bida', '🥚'],
  ['boire', 'Eau', 'Lma', '💧'], ['boire', 'Lait', 'Hlib', '🍼'], ['boire', 'Jus', '3assir', '🧃'],
  ['jouer', 'Ballon', 'Kora', '⚽'], ['jouer', 'Tablette', 'Tablette', '📱'], ['jouer', 'Dessin animé', 'Rassoum', '📺'],
  ['jouer', 'Poupée', 'Mouna', '🪆'], ['jouer', 'Musique', 'Mousi9a', '🎵'], ['jouer', 'Balançoire', 'Jelloula', '🛝'],
  ['personnes', 'Maman', 'Mama', '👩'], ['personnes', 'Papa', 'Baba', '👨'], ['personnes', 'Moi', 'Ana', '🧒'],
  ['personnes', 'Mamie', 'Mima', '👵'], ['personnes', 'Papi', 'Jeddi', '👴'],
  ['besoins', 'Toilettes', 'Bit lma', '🚽'], ['besoins', 'Dormir', 'N3es', '😴'], ['besoins', 'Câlin', 'Tbou9a', '🤗'],
  ['besoins', 'Bain', 'Hammam', '🛁'], ['besoins', 'Changer', 'Nbeddel', '👕'], ['besoins', 'Calme', 'Hdou2', '🤫'],
  ['emotions', 'Content', 'Ferhan', '😊'], ['emotions', 'Triste', 'Hzin', '😢'], ['emotions', 'En colère', 'Mqele9', '😠'],
  ['emotions', 'Peur', 'Khayef', '😨'], ['emotions', 'Fatigué', '3iyan', '🥱'],
  ['lieux', 'Dehors', 'Berra', '🌳'], ['lieux', 'Maison', 'Dar', '🏠'], ['lieux', 'Voiture', 'Tomobil', '🚗'],
  ['lieux', 'Parc', 'Jarda', '🎠'], ['lieux', 'École', 'Lmadrasa', '🏫'],
];

function slug(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function defaultCards() {
  return RAW.map(([cat, fr, dr, emoji], index) => ({
    id: `c-${cat}-${slug(fr)}`,
    cat, fr, dr, emoji,
    photo: null, audioFr: null, audioDr: null,
    order: index,
  }));
}
