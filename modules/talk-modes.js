// v10.37 (pépites OpenSpeak) :
// 1) Trois façons de parler : Simple (rien d'autre que les cartes), Aide (les cartes probables brillent),
//    Coach (Aide + barre « Hier / Maintenant / Après » et phrase entière). Coach = comportement d'avant.
// 2) Recherche par intention : l'adulte écrit « il a soif », « j'ai faim », « il est fatigué »…
//    et Kalimati montre les cartes qui répondent à ce besoin, pas seulement le mot écrit.
// Tout se calcule dans le téléphone.

export const TALK_MODE_KEY = 'talkMode';
export const TALK_MODES = [
  { id: 'simple', emoji: '🟢', title: 'Simple', desc: 'Seulement les cartes. Pour débuter ou les jours difficiles.' },
  { id: 'aide', emoji: '💡', title: 'Aide', desc: 'Les cartes qui vont souvent après le dernier mot brillent doucement.' },
  { id: 'coach', emoji: '🧑‍🏫', title: 'Coach', desc: 'Aide + « Hier / Maintenant / Après » et la phrase entière sous la bande.' },
];
export const normalizeTalkMode = (value) => (TALK_MODES.some((m) => m.id === value) ? value : 'coach');
export const showsHints = (mode) => mode === 'aide' || mode === 'coach';
export const showsCoach = (mode) => mode === 'coach';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[’']/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

// [mots-clés de l'intention, mots des cartes qui répondent]
export const INTENTS = [
  [['soif', 'boire', 'assoiffe'], ['Eau', 'Lait', 'Jus', 'Boire']],
  [['faim', 'manger', 'gouter', 'repas', 'dejeuner', 'diner'], ['Manger', 'Pain', 'Pomme', 'Banane', 'Biscuit', 'Gâteau']],
  [['mal', 'douleur', 'blesse', 'bobo', 'souffre', 'pleure'], ["J'ai mal", 'Aide-moi', 'Câlin', 'Triste']],
  [['fatigue', 'sommeil', 'dodo', 'dormir', 'baille'], ['Dormir', 'Fatigué', 'Calme', 'Câlin']],
  [['pipi', 'caca', 'toilette', 'toilettes', 'wc', 'aller aux toilettes'], ['Toilettes']],
  [['peur', 'angoisse', 'stress', 'inquiet'], ['Peur', 'Câlin', 'Calme', 'Aide-moi']],
  [['colere', 'enerve', 'fache', 'crise'], ['En colère', 'Calme', 'Attends', 'Fini']],
  [['triste', 'chagrin'], ['Triste', 'Câlin', 'Maman', 'Papa']],
  [['content', 'heureux', 'joyeux', 'rit'], ['Content', 'Encore', 'Jouer']],
  [['jouer', 'jeu', 'ennuie', 'ennui', 's ennuie'], ['Jouer', 'Ballon', 'Tablette', 'Dessin animé', 'Balançoire']],
  [['dehors', 'sortir', 'promenade', 'balade', 'parc'], ['Dehors', 'Parc', 'Voiture', 'Courir']],
  [['aide', 'bloque', 'n arrive pas', 'difficile'], ['Aide-moi', 'Attends', 'Encore']],
  [['froid', 'gele'], ['Froid', 'Changer']],
  [['chaud', 'transpire'], ['Chaud', 'Eau', 'Changer']],
  [['bain', 'laver', 'sale', 'douche'], ['Bain', 'Laver', 'Changer']],
  [['fini', 'termine', 'arrete', 'stop', 'veut plus'], ['Fini', 'Non', 'Attends']],
  [['encore', 'plus', 'reprendre', 'continuer'], ['Encore', 'Oui', 'Je veux']],
  [['bonjour', 'salut', 'saluer', 'au revoir'], ['Bonjour', 'Au revoir', 'Merci']],
];

// Rend les cartes de l'intention trouvée (dans l'ordre), ou [] si rien ne correspond.
export function cardsForIntent(query, cards, wordsOf = (c) => [c.fr]) {
  const q = ` ${norm(query)} `;
  if (!q.trim()) return [];
  const intent = INTENTS.find(([keys]) => keys.some((k) => ['', 's', 'e', 'es'].some((end) => q.includes(` ${k}${end} `))));
  if (!intent) return [];
  const byWord = new Map();
  for (const c of cards) for (const w of wordsOf(c)) { const k = norm(w); if (k && !byWord.has(k)) byWord.set(k, c); }
  return intent[1].map((w) => byWord.get(norm(w))).filter(Boolean);
}
