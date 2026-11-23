// Cartes de départ. Le parent remplace l'image par une vraie photo et enregistre sa voix.
// Darija en lettres latines (dr) et en graphie arabe (ar) : à vérifier et corriger par le parent.
import { PROFIL } from './modules/profil.js';

// Clé de Fitzgerald modifiée : couleur constante selon le rôle du mot dans la phrase.
export const GRAMMAR = {
  person: { label: 'Personnes / pronoms', color: '#FBC02D' },
  verb: { label: 'Verbes d’action', color: '#43A047' },
  noun: { label: 'Noms / objets / aliments', color: '#F57C00' },
  adj: { label: 'Adjectifs / couleurs / émotions', color: '#0288D1' },
  social: { label: 'Mots sociaux / urgences', color: '#E91E63' },
};

// v10.24 : « ar » = la même darija en lettres arabes (celle que lit la voix arabe), « dr » = lettres
// latines. Le réglage parent « Écriture darija » choisit celle qui s'affiche.
export const CATEGORIES = [
  { id: 'base', fr: 'Essentiel', dr: 'Lmouhim', ar: 'الأساسيات', color: '#F4B400' },
  { id: 'manger', fr: 'Manger', dr: 'Makla', ar: 'الماكلة', color: '#F57C00' },
  { id: 'boire', fr: 'Boire', dr: 'Chrab', ar: 'الشرب', color: '#0288D1' },
  { id: 'jouer', fr: 'Jouer', dr: 'L3ab', ar: 'اللعب', color: '#43A047' },
  { id: 'actions', fr: 'Actions', dr: 'Af3al', ar: 'الأفعال', color: '#2E7D32' },
  { id: 'personnes', fr: 'Personnes', dr: 'Nas', ar: 'الناس', color: '#FBC02D' },
  { id: 'besoins', fr: 'Besoins', dr: 'Hajat', ar: 'الحاجات', color: '#8E24AA' },
  { id: 'emotions', fr: 'Émotions', dr: 'Ihsas', ar: 'الإحساسات', color: '#E91E63' },
  { id: 'decrire', fr: 'Décrire', dr: 'Wsef', ar: 'التوصيف', color: '#1565C0' },
  { id: 'lieux', fr: 'Lieux', dr: 'Blayes', ar: 'البلايص', color: '#00897B' },
];

// v9.8 : cartes de départ neutres pour un nouveau téléphone (les téléphones déjà installés gardent leurs cartes).
const NAME = PROFIL.name;
const SISTER = PROFIL.sister;
const PSY = PROFIL.psy;

// [catégorie, français, darija latine, emoji, rôle, darija arabe, version d'arrivée (0 = v1), options]
// options : slug (identifiant stable), vkey (image partagée avec les exercices), sub (sous-titre), sayFr / sayAr (phrase dite).
const RAW = [
  ['base', 'Je veux', 'Bghit', '🙋', 'person', 'بغيت'], ['base', 'Oui', 'Ah', '👍', 'social', 'اه'],
  ['base', 'Non', 'La', '👎', 'social', 'لا'], ['base', 'Encore', 'Zid', '➕', 'adj', 'زيد'],
  ['base', 'Fini', 'Safi', '✋', 'social', 'صافي'], ['base', 'Aide-moi', '3awnni', '🤝', 'social', 'عاوني'],
  ['base', 'Attends', 'Tsenna', '⏳', 'social', 'تسنى'], ['base', "J'ai mal", 'Kayderni', '🤕', 'social', 'كيضرني', 0, { vkey: 'emotion:mal' }],
  ['base', 'Bonjour', 'Salam', '👋', 'social', 'سلام', 2], ['base', 'Au revoir', 'Bslama', '🖐️', 'social', 'بسلامة', 2],
  ['base', 'Viens jouer', 'Aji nl3bou', '🧑‍🤝‍🧑', 'social', 'أجي نلعبو', 2],
  ['manger', 'Pain', 'Khobz', '🍞', 'noun', 'خبز'], ['manger', 'Pomme', 'Teffah', '🍎', 'noun', 'تفاح'],
  ['manger', 'Banane', 'Banan', '🍌', 'noun', 'بنان'], ['manger', 'Gâteau', 'Gato', '🍰', 'noun', 'گاطو'],
  ['manger', 'Yaourt', 'Danone', '🥛', 'noun', 'دانون'], ['manger', 'Riz', 'Rouz', '🍚', 'noun', 'روز'],
  ['manger', 'Biscuit', 'Biskwi', '🍪', 'noun', 'بيسكوي'], ['manger', 'Œuf', 'Bida', '🥚', 'noun', 'بيضة'],
  ['boire', 'Eau', 'Lma', '💧', 'noun', 'الما'], ['boire', 'Lait', 'Hlib', '🍼', 'noun', 'حليب'],
  ['boire', 'Jus', '3assir', '🧃', 'noun', 'عصير'],
  // v9.2 : demandés par le parent (darija à vérifier). Les vraies photos se mettent avec 📷 en mode parent.
  ['manger', 'Chips', 'Chips', '🥔', 'noun', 'شيبس', 9, { sub: 'Pringles barbecue' }],
  ['manger', 'Fromage', 'Frmaj', '🧀', 'noun', 'فرماج', 9, { sub: 'Kiri' }],
  ['manger', 'Pancake', 'Pancake', '🥞', 'noun', 'بانكيك', 9],
  ['manger', 'Mcdo', 'Makdo', '🍔', 'noun', 'ماكدو', 9, { sub: 'Happy Meal' }],
  ['boire', 'Coca-cola', 'Koka', '🥤', 'noun', 'كوكا', 9],
  ['jouer', 'Trampoline', 'Trampoline', '🤸', 'noun', 'ترامبولين', 9],
  ['jouer', 'Ballon', 'Kora', '⚽', 'noun', 'كورة'], ['jouer', 'Tablette', 'Tablette', '📱', 'noun', 'طابليط'],
  ['jouer', 'Dessin animé', 'Rassoum', '📺', 'noun', 'رسوم'], ['jouer', 'Poupée', 'Mouna', '🪆', 'noun', 'مونة'],
  ['jouer', 'Musique', 'Mousi9a', '🎵', 'noun', 'موسيقى'], ['jouer', 'Balançoire', 'Jelloula', '🛝', 'noun', 'جلولة'],
  ['actions', 'Manger', 'Nakoul', '🍽️', 'verb', 'ناكل', 2], ['actions', 'Boire', 'Nchreb', '🥤', 'verb', 'نشرب', 2],
  ['actions', 'Jouer', 'Nl3eb', '🧸', 'verb', 'نلعب', 2], ['actions', 'Courir', 'Njri', '🏃', 'verb', 'نجري', 2],
  ['actions', 'Donner', '3tini', '🫴', 'verb', 'عطيني', 2], ['actions', 'Couper', 'N9te3', '✂️', 'verb', 'نقطع', 2],
  ['actions', 'Sauter', 'N9fez', '🦘', 'verb', 'نقفز', 2], ['actions', 'Laver', 'Nghsel', '🧼', 'verb', 'نغسل', 2],
  ['actions', 'Dessiner', 'Nrsem', '🖍️', 'verb', 'نرسم', 2], ['actions', 'Ouvrir', 'Nhel', '🚪', 'verb', 'نحل', 2],
  // La famille et les proches (prénoms remplis par le parent, jamais écrits dans le code)
  // v10.20 : identifiants techniques neutres (child / sibling / therapist). Aucun fragment de prénom
  // n'est écrit ici : le prénom vient du profil rempli sur le téléphone.
  ['personnes', NAME ? `${NAME} (Moi)` : 'Moi', 'Ana', '🧒', 'person', 'أنا', 0, { slug: 'moi', vkey: 'person:child' }],
  SISTER ? ['personnes', SISTER, SISTER, '👧', 'person', SISTER, 2, { slug: 'sibling', vkey: 'person:sibling', sub: 'Ma sœur', sayFr: `${SISTER}, ma sœur` }]
    : ['personnes', 'Sœur / Frère', 'Khti / Khoya', '👧', 'person', 'ختي / خويا', 2, { slug: 'sibling', vkey: 'person:sibling' }],
  ['personnes', 'Papa', 'Baba', '👨', 'person', 'بابا', 0, { vkey: 'person:papa' }],
  ['personnes', 'Maman', 'Mama', '👩', 'person', 'ماما', 0, { vkey: 'person:maman' }],
  PSY ? ['personnes', PSY, PSY, '👩‍⚕️', 'person', PSY, 3, { slug: 'therapist', vkey: 'person:therapist' }]
    : ['personnes', 'Thérapeute', 'Tbiba', '👩‍⚕️', 'person', 'الطبيبة', 3, { slug: 'therapist', vkey: 'person:therapist' }],
  ['personnes', 'Maîtresse', 'Lmo3allima', '👩‍🏫', 'person', 'المعلمة', 3, { vkey: 'person:maitresse' }],
  ['personnes', 'Mamie', 'Mima', '👵', 'person', 'ميمة', 0, { vkey: 'person:mamie' }],
  ['personnes', 'Papi', 'Jeddi', '👴', 'person', 'جدي', 0, { vkey: 'person:papi' }],
  ['besoins', 'Toilettes', 'Bit lma', '🚽', 'social', 'بيت الما'], ['besoins', 'Dormir', 'N3es', '😴', 'verb', 'نعس'],
  ['besoins', 'Câlin', 'Tbou9a', '🤗', 'social', 'تبوقة'], ['besoins', 'Bain', 'Hammam', '🛁', 'noun', 'حمام'],
  ['besoins', 'Changer', 'Nbeddel', '👕', 'verb', 'نبدل'], ['besoins', 'Calme', 'Hdou2', '🤫', 'adj', 'هدوء', 0, { vkey: 'emotion:calme' }],
  // Émotions : de vrais visages expressifs (ou les photos de la famille), jamais un petit emoji
  ['emotions', 'Content', 'Ferhan', '😊', 'adj', 'فرحان', 0, { vkey: 'emotion:content' }],
  ['emotions', 'Triste', 'Hzin', '😢', 'adj', 'حزين', 0, { vkey: 'emotion:triste' }],
  ['emotions', 'En colère', 'Mqele9', '😠', 'adj', 'مقلق', 0, { vkey: 'emotion:colere' }],
  ['emotions', 'Peur', 'Khayef', '😨', 'adj', 'خايف', 0, { vkey: 'emotion:peur' }],
  ['emotions', 'Fatigué', '3iyan', '🥱', 'adj', 'عيان', 0, { vkey: 'emotion:fatigue' }],
  ['emotions', 'Fier', 'Fekhour', '🏅', 'adj', 'فخور', 3, { vkey: 'emotion:fier' }],
  ['decrire', 'Grand', 'Kbir', '🐘', 'adj', 'كبير', 2], ['decrire', 'Petit', 'Sghir', '🐭', 'adj', 'صغير', 2],
  ['decrire', 'Rouge', 'Hmer', '🔴', 'adj', 'حمر', 2], ['decrire', 'Bleu', 'Zre9', '🔵', 'adj', 'زرق', 2],
  ['decrire', 'Jaune', 'Sfer', '🟡', 'adj', 'صفر', 2], ['decrire', 'Vert', 'Khder', '🟢', 'adj', 'خضر', 2],
  ['decrire', 'Chaud', 'Skhoun', '🔥', 'adj', 'سخون', 2], ['decrire', 'Froid', 'Bared', '🧊', 'adj', 'بارد', 2],
  ['decrire', 'Rond', 'Mdewer', '⚪', 'adj', 'مدور', 2],
  ['lieux', 'Dehors', 'Berra', '🌳', 'noun', 'برا'], ['lieux', 'Maison', 'Dar', '🏠', 'noun', 'دار'],
  ['lieux', 'Voiture', 'Tomobil', '🚗', 'noun', 'طوموبيل'], ['lieux', 'Parc', 'Jarda', '🎠', 'noun', 'جردة'],
  ['lieux', 'École', 'Lmadrasa', '🏫', 'noun', 'المدرسة'],
  // v7 (Aegon) : mots-outils, pronoms, prépositions, politesse et questions (enrichissement CAA inspiré de Crescendo)
  ['base', "S'il te plaît", '3afak', '🙏', 'social', 'عافاك', 7],
  ['base', 'Merci', 'Choukran', '💛', 'social', 'شكرا', 7],
  ['base', "C'est quoi ?", 'Chnou hada ?', '❓', 'social', 'شنو هادا؟', 7],
  ['base', 'Où est ?', 'Fin ?', '🔍', 'social', 'فين؟', 7],
  ['base', 'Avec', 'M3a', '🤝', 'social', 'مع', 7],
  ['actions', 'Lire', 'Nqra', '📖', 'verb', 'نقرا', 7],
  ['actions', 'Écrire', 'Nkteb', '✏️', 'verb', 'نكتب', 7],
  ['actions', 'Regarder', 'Nchouf', '👀', 'verb', 'نشوف', 7],
  ['actions', 'Écouter', 'Nsme3', '👂', 'verb', 'نسمع', 7],
  ['actions', 'Dormir', 'N3es', '😴', 'verb', 'نعس', 7],
  ['decrire', 'Dans', 'F', '📥', 'adj', 'ف', 7],
  ['decrire', 'Sur', 'Fouq', '⬆️', 'adj', 'فوق', 7],
  ['decrire', 'Sous', 'Te7t', '⬇️', 'adj', 'تحت', 7],
  ['decrire', 'Beaucoup', 'Bezzaf', '✨', 'adj', 'بزاف', 7],
  ['decrire', 'Un peu', 'Chwiya', '🤏', 'adj', 'شوية', 7],
];

function slug(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export const cardId = (cat, fr) => `c-${cat}-${slug(fr)}`;

export function defaultCards() {
  return RAW.map(([cat, fr, dr, emoji, gram, ar, newIn = 0, options = {}], index) => ({
    id: cardId(cat, options.slug || fr),
    cat, fr, dr, ar, emoji, gram,
    visualKey: options.vkey || null, sub: options.sub || '', sayFr: options.sayFr || '', sayAr: options.sayAr || '',
    photo: null, video: null, audios: {},
    order: index, gridRow: null, gridCol: null, hidden: false,
    newIn,
  }));
}

// Image d'une carte : sa clé propre, sinon celle de la carte de départ, sinon une clé par carte.
const DEFAULT_KEYS = new Map(defaultCards().filter((c) => c.visualKey).map((c) => [c.id, c.visualKey]));
export const visualKeyOf = (card) => card.visualKey || DEFAULT_KEYS.get(card.id) || `card:${card.id}`;

// ---------- v10.21 (Lot 1) : la voix du parent se garde par langue, dans card.audios[code] ----------
// Avant, deux champs figés portaient le français et la darija. Les champs historiques audioFr / audioDr
// restent lus (vieilles sauvegardes, cartes déjà dans le téléphone) : foldLegacyAudio les replie sur audios.
export function cardAudio(card, lang) {
  if (!card) return null;
  const map = card.audios;
  if (map && map[lang]) return map[lang];
  if (lang === 'fr') return card.audioFr || null;
  if (lang === 'dr') return card.audioDr || null;
  return null;
}
export function withCardAudio(card, lang, blob) {
  const audios = { ...(card.audios || {}) };
  if (blob) audios[lang] = blob; else delete audios[lang];
  return { ...card, audios };
}
export const hasCardAudio = (card) => Boolean(card
  && ((card.audios && Object.keys(card.audios).length) || card.audioFr || card.audioDr));
export function foldLegacyAudio(card) {
  const audios = { ...(card.audios || {}) };
  if (card.audioFr && !audios.fr) audios.fr = card.audioFr;
  if (card.audioDr && !audios.dr) audios.dr = card.audioDr;
  const { audioFr, audioDr, ...rest } = card;
  return { ...rest, audios };
}

export const TOILET_CARD_ID = cardId('besoins', 'Toilettes');
export const SELF_CARD_ID = cardId('personnes', 'moi');
