// 🌟 Les 7 Amis de Kalimati (1 compagnon par mission) + L'Album des Amis (récompense calme sans points ni chrono).
// Conforme aux règles TSA de « Les amis de Kalimati.html » et « DESIGN.md » :
// - Un seul ami à l'écran à la fois.
// - Mouvements lents (> 1,5 s à 4 s), aucun clignotement ni flash.
// - Pas de bruit surprise : la voix ne sort que si l'enfant touche l'ami ou sa bulle.
// - Le parent peut masquer/afficher les amis à tout moment dans ses réglages.
import * as db from '../db.js';
import { h, btn, dayKey } from './util.js';
import { speak, playVoiceFile } from '../speech.js';
import { tx } from './section-i18n.js';

const HIDE_FRIENDS_KEY = 'hideFriends';
const ALBUM_KEY = 'friendsAlbum';

let hideFriendsCached = false;
let albumCached = { unlocked: ['nour'], history: [] };

export async function loadFriendsState() {
  const [hidden, savedAlbum] = await Promise.all([
    db.getSetting(HIDE_FRIENDS_KEY),
    db.getSetting(ALBUM_KEY),
  ]);
  hideFriendsCached = Boolean(hidden);
  if (savedAlbum && Array.isArray(savedAlbum.unlocked)) {
    albumCached = savedAlbum;
  }
}

export const areFriendsHidden = () => hideFriendsCached;

export async function setFriendsHidden(val) {
  hideFriendsCached = Boolean(val);
  await db.setSetting(HIDE_FRIENDS_KEY, hideFriendsCached);
  document.dispatchEvent(new CustomEvent('kalimati-friends-changed', { detail: { hidden: hideFriendsCached } }));
}

// ---------- SVG vectoriels purs des 7 Amis (nettoyés des métadonnées C2PA, < 12 Ko au total) ----------
const SVG_PATHS = {
  nour: `<ellipse cx="60" cy="132" rx="40" ry="5" fill="#4A3426" opacity=".07"/>
    <path d="M86 116 q26 -2 28 -24 q-12 12 -30 12z" fill="#C08850"/>
    <ellipse cx="48" cy="126" rx="11" ry="6" fill="#C08850"/><ellipse cx="72" cy="126" rx="11" ry="6" fill="#C08850"/>
    <path d="M30 122 q-4 -42 30 -50 q34 8 30 50 q-30 6 -60 0z" fill="#4FC3B8"/>
    <rect x="86" y="84" width="16" height="24" rx="7" fill="#F2C94C"/>
    <path d="M44 80 l5 30 M76 80 l-5 30" stroke="#F2C94C" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="30" cy="98" rx="7" ry="12" fill="#D9A066" transform="rotate(25 30 98)"/>
    <ellipse cx="94" cy="70" rx="7" ry="13" fill="#D9A066" transform="rotate(-150 94 82)" class="friend-wave-paw"/>
    <path d="M38 75 q22 14 44 0" stroke="#5B8DEF" stroke-width="6" fill="none" stroke-linecap="round"/>
    <circle cx="36" cy="75" r="8" fill="#5B8DEF"/><circle cx="84" cy="75" r="8" fill="#5B8DEF"/>
    <circle cx="34" cy="28" r="7" fill="#C08850"/><circle cx="86" cy="28" r="7" fill="#C08850"/>
    <ellipse cx="60" cy="48" rx="30" ry="27" fill="#D9A066"/>
    <ellipse cx="60" cy="58" rx="17" ry="12" fill="#F6E6CC"/>
    <g class="friend-eyes"><circle cx="49" cy="44" r="3.6" fill="#4A3426"/><circle cx="71" cy="44" r="3.6" fill="#4A3426"/><circle cx="50.2" cy="42.8" r="1.1" fill="#fff"/><circle cx="72.2" cy="42.8" r="1.1" fill="#fff"/></g>
    <circle cx="41" cy="56" r="4" fill="#F4A9A0" opacity=".55"/><circle cx="79" cy="56" r="4" fill="#F4A9A0" opacity=".55"/>
    <ellipse cx="60" cy="53" rx="5" ry="3.5" fill="#4A3426"/>
    <path class="friend-mouth" d="M54 60 q6 5 12 0" stroke="#4A3426" stroke-width="2" fill="none" stroke-linecap="round"/>
    <g class="friend-bubbles" fill="none" stroke="#7FC8E8" stroke-width="2"><circle cx="14" cy="34" r="4"/><circle cx="8" cy="20" r="6"/></g>`,

  fennou: `<ellipse cx="60" cy="132" rx="40" ry="5" fill="#4A3426" opacity=".07"/>
    <path d="M88 112 q26 0 24 -26 q-6 16 -26 16z" fill="#E9C38F"/><path d="M106 92 q6 -4 6 -8 q-2 10 -10 12z" fill="#FFF6E8"/>
    <path d="M32 128 q-4 -44 28 -52 q32 8 28 52 q-28 5 -56 0z" fill="#E9C38F"/>
    <ellipse cx="60" cy="108" rx="17" ry="18" fill="#FFF6E8"/>
    <ellipse cx="46" cy="128" rx="10" ry="5" fill="#D9AE78"/><ellipse cx="74" cy="128" rx="10" ry="5" fill="#D9AE78"/>
    <path d="M50 92 h8 a4 4 0 1 1 4 0 h8 v8 a4 4 0 1 1 0 6 v8 h-20z" fill="#B7A6E0"/>
    <ellipse cx="44" cy="100" rx="6" ry="10" fill="#E9C38F" transform="rotate(30 44 100)"/><ellipse cx="76" cy="100" rx="6" ry="10" fill="#E9C38F" transform="rotate(-30 76 100)"/>
    <path d="M34 52 L16 6 L58 36 Z" fill="#E9C38F"/><path d="M86 52 L104 6 L62 36 Z" fill="#E9C38F"/>
    <path d="M36 44 L24 16 L50 36 Z" fill="#F7C9C1"/><path d="M84 44 L96 16 L70 36 Z" fill="#F7C9C1"/>
    <ellipse cx="60" cy="56" rx="30" ry="25" fill="#E9C38F"/>
    <ellipse cx="60" cy="66" rx="16" ry="10" fill="#FFF6E8"/>
    <g class="friend-eyes"><circle cx="49" cy="52" r="3.6" fill="#4A3426"/><circle cx="71" cy="52" r="3.6" fill="#4A3426"/><circle cx="50.2" cy="50.8" r="1.1" fill="#fff"/><circle cx="72.2" cy="50.8" r="1.1" fill="#fff"/></g>
    <circle cx="40" cy="63" r="4" fill="#F4A9A0" opacity=".55"/><circle cx="80" cy="63" r="4" fill="#F4A9A0" opacity=".55"/>
    <ellipse cx="60" cy="61" rx="4.5" ry="3.2" fill="#4A3426"/>
    <path class="friend-mouth" d="M54 68 q6 5 12 0" stroke="#4A3426" stroke-width="2" fill="none" stroke-linecap="round"/>`,

  fakroun: `<ellipse cx="60" cy="132" rx="40" ry="5" fill="#4A3426" opacity=".07"/>
    <ellipse cx="36" cy="124" rx="12" ry="8" fill="#B9D3A0"/><ellipse cx="84" cy="124" rx="12" ry="8" fill="#B9D3A0"/>
    <ellipse cx="60" cy="86" rx="50" ry="40" fill="#7FA88A"/>
    <ellipse cx="60" cy="90" rx="50" ry="34" fill="none" stroke="#E8D8B0" stroke-width="5"/>
    <g fill="#9CC0A0"><path d="M60 52 l12 7 v13 l-12 7 l-12 -7 v-13z"/><path d="M34 66 l10 6 v11 l-10 6 l-10 -6 v-11z"/><path d="M86 66 l10 6 v11 l-10 6 l-10 -6 v-11z"/></g>
    <g transform="translate(52 30)" class="friend-hourglass"><rect x="0" y="0" width="16" height="3" rx="1.5" fill="#C08850"/><rect x="0" y="19" width="16" height="3" rx="1.5" fill="#C08850"/><path d="M2 3 h12 l-5 8 l5 8 h-12 l5 -8z" fill="#EAF4F8" stroke="#C08850" stroke-width="1.2"/><path d="M5 17 h6 l-3 -4z" fill="#F2C94C"/></g>
    <circle cx="60" cy="100" r="24" fill="#C8DEB0"/>
    <g class="friend-eyes"><circle cx="51" cy="96" r="3.6" fill="#4A3426"/><circle cx="69" cy="96" r="3.6" fill="#4A3426"/><circle cx="52.2" cy="94.8" r="1.1" fill="#fff"/><circle cx="70.2" cy="94.8" r="1.1" fill="#fff"/></g>
    <circle cx="44" cy="106" r="4" fill="#F4A9A0" opacity=".55"/><circle cx="76" cy="106" r="4" fill="#F4A9A0" opacity=".55"/>
    <path class="friend-mouth" d="M54 108 q6 4 12 0" stroke="#4A3426" stroke-width="2" fill="none" stroke-linecap="round"/>
    <ellipse cx="38" cy="116" rx="8" ry="6" fill="#C8DEB0"/><ellipse cx="82" cy="116" rx="8" ry="6" fill="#C8DEB0"/>`,

  hmama: `<ellipse cx="60" cy="132" rx="40" ry="5" fill="#4A3426" opacity=".07"/>
    <path d="M50 128 v-8 M70 128 v-8" stroke="#E8A27A" stroke-width="4" stroke-linecap="round"/>
    <path d="M88 96 l22 10 l-20 6z" fill="#A9A5D3"/>
    <ellipse cx="60" cy="92" rx="36" ry="32" fill="#C9C6E6"/>
    <ellipse cx="60" cy="100" rx="22" ry="20" fill="#E4E2F4"/>
    <ellipse cx="88" cy="92" rx="11" ry="20" fill="#B5B1DA" transform="rotate(-18 88 92)"/>
    <ellipse cx="32" cy="92" rx="11" ry="20" fill="#B5B1DA" transform="rotate(18 32 92)"/>
    <path class="friend-heart" d="M60 96 c-7 -9 -19 -1 0 14 c19 -15 7 -23 0 -14z" fill="#F4A9A0"/>
    <circle cx="60" cy="50" r="26" fill="#D8D5EF"/>
    <path d="M50 26 q10 -12 20 0" fill="#C9C6E6"/>
    <g class="friend-eyes"><circle cx="50" cy="47" r="3.6" fill="#4A3426"/><circle cx="70" cy="47" r="3.6" fill="#4A3426"/><circle cx="51.2" cy="45.8" r="1.1" fill="#fff"/><circle cx="71.2" cy="45.8" r="1.1" fill="#fff"/></g>
    <circle cx="42" cy="57" r="4" fill="#F4A9A0" opacity=".55"/><circle cx="78" cy="57" r="4" fill="#F4A9A0" opacity=".55"/>
    <path d="M55 55 L65 55 L60 63 Z" fill="#F2B58C"/>`,

  jmimla: `<ellipse cx="60" cy="132" rx="40" ry="5" fill="#4A3426" opacity=".07"/>
    <ellipse cx="38" cy="126" rx="13" ry="6" fill="#D49C70"/><ellipse cx="88" cy="126" rx="13" ry="6" fill="#D49C70"/>
    <ellipse cx="66" cy="106" rx="44" ry="22" fill="#E8B48A"/>
    <g class="friend-camel-hump">
      <ellipse cx="72" cy="84" rx="24" ry="20" fill="#E8B48A"/>
      <path d="M52 80 q20 -14 42 0 v14 q-21 6 -42 0z" fill="#4FC3B8"/>
      <path d="M52 86 q21 6 42 0 M52 91 q21 6 42 0" stroke="#F2C94C" stroke-width="2" fill="none"/>
    </g>
    <path d="M28 104 q-6 -26 4 -40 l16 4 q-4 18 4 36z" fill="#E8B48A"/>
    <ellipse cx="36" cy="54" rx="22" ry="19" fill="#E8B48A"/>
    <ellipse cx="22" cy="40" rx="5" ry="7" fill="#D49C70" transform="rotate(-30 22 40)"/><ellipse cx="50" cy="38" rx="5" ry="7" fill="#D49C70" transform="rotate(30 50 38)"/>
    <ellipse cx="34" cy="64" rx="15" ry="10" fill="#F3CDA8"/>
    <path d="M24 50 q4 3 8 0 M40 50 q4 3 8 0" stroke="#4A3426" stroke-width="2" fill="none" stroke-linecap="round"/>
    <circle cx="22" cy="58" r="4" fill="#F4A9A0" opacity=".55"/><circle cx="50" cy="58" r="4" fill="#F4A9A0" opacity=".55"/>
    <path d="M29 66 q5 3 10 0" stroke="#4A3426" stroke-width="2" fill="none" stroke-linecap="round"/>
    <g class="friend-breath" fill="none" stroke="#9BD0E6" stroke-width="2" stroke-linecap="round" opacity=".8"><path d="M14 72 q-6 4 -10 0"/><path d="M14 80 q-6 4 -10 0"/></g>`,

  mchicha: `<ellipse cx="60" cy="132" rx="40" ry="5" fill="#4A3426" opacity=".07"/>
    <path d="M88 118 q24 -4 20 -30 q-4 12 -20 18z" fill="#AEBECB"/>
    <ellipse cx="48" cy="126" rx="11" ry="6" fill="#AEBECB"/><ellipse cx="72" cy="126" rx="11" ry="6" fill="#AEBECB"/>
    <path d="M32 124 q-4 -42 28 -50 q32 8 28 50 q-28 6 -56 0z" fill="#C7D3DD"/>
    <ellipse cx="60" cy="106" rx="16" ry="17" fill="#F7F3EC"/>
    <path d="M34 84 q14 10 30 -2 l4 10 q-18 14 -36 2z" fill="#F4B9B0"/>
    <ellipse cx="30" cy="98" rx="7" ry="12" fill="#C7D3DD" transform="rotate(25 30 98)"/><ellipse cx="90" cy="98" rx="7" ry="12" fill="#C7D3DD" transform="rotate(-25 90 98)"/>
    <path d="M36 40 L32 10 L56 28 Z" fill="#C7D3DD"/><path d="M84 40 L88 10 L64 28 Z" fill="#C7D3DD"/>
    <path d="M39 34 L37 17 L51 28 Z" fill="#F7C9C1"/><path d="M81 34 L83 17 L69 28 Z" fill="#F7C9C1"/>
    <circle cx="60" cy="50" r="28" fill="#C7D3DD"/>
    <ellipse cx="60" cy="60" rx="15" ry="10" fill="#F7F3EC"/>
    <g class="friend-eyes"><circle cx="49" cy="46" r="3.6" fill="#4A3426"/><circle cx="71" cy="46" r="3.6" fill="#4A3426"/><circle cx="50.2" cy="44.8" r="1.1" fill="#fff"/><circle cx="72.2" cy="44.8" r="1.1" fill="#fff"/></g>
    <circle cx="40" cy="57" r="4" fill="#F4A9A0" opacity=".55"/><circle cx="80" cy="57" r="4" fill="#F4A9A0" opacity=".55"/>
    <path d="M57 55 h6 l-3 3z" fill="#E59A93"/><path class="friend-mouth" d="M54 61 q6 5 12 0" stroke="#4A3426" stroke-width="2" fill="none" stroke-linecap="round"/>
    <g stroke="#AEBECB" stroke-width="1.4" stroke-linecap="round"><path d="M38 58 h-12 M38 62 l-11 3 M82 58 h12 M82 62 l11 3"/></g>
    <g class="friend-bubbles" fill="none" stroke="#9BD0E6" stroke-width="2"><circle cx="100" cy="40" r="6"/><circle cx="110" cy="24" r="4"/><circle cx="96" cy="16" r="3"/></g>`,

  bouma: `<ellipse cx="60" cy="132" rx="40" ry="5" fill="#4A3426" opacity=".07"/>
    <path d="M50 130 v-6 M70 130 v-6" stroke="#E8A27A" stroke-width="4" stroke-linecap="round"/>
    <path d="M36 42 L28 12 L54 34 Z" fill="#A87C55"/><path d="M84 42 L92 12 L66 34 Z" fill="#A87C55"/>
    <ellipse cx="60" cy="78" rx="38" ry="48" fill="#C49A6C"/>
    <ellipse cx="60" cy="94" rx="24" ry="28" fill="#EBD8BF"/>
    <circle cx="46" cy="56" r="14" fill="#F7F0E4"/><circle cx="74" cy="56" r="14" fill="#F7F0E4"/>
    <g class="friend-eyes"><circle cx="46" cy="57" r="5" fill="#4A3426"/><circle cx="74" cy="57" r="5" fill="#4A3426"/><circle cx="47.5" cy="55.5" r="1.5" fill="#fff"/><circle cx="75.5" cy="55.5" r="1.5" fill="#fff"/></g>
    <path d="M56 66 L64 66 L60 73 Z" fill="#F2B58C"/>
    <circle cx="36" cy="72" r="4" fill="#F4A9A0" opacity=".55"/><circle cx="84" cy="72" r="4" fill="#F4A9A0" opacity=".55"/>
    <path d="M60 104 l-24 -8 v22 l24 8z" fill="#4FA3A0"/><path d="M60 104 l24 -8 v22 l-24 8z" fill="#5DB6B2"/>
    <path d="M60 104 v22" stroke="#F7F0E4" stroke-width="2"/>
    <ellipse cx="30" cy="100" rx="8" ry="18" fill="#A87C55" transform="rotate(20 30 100)"/><ellipse cx="90" cy="100" rx="8" ry="18" fill="#A87C55" transform="rotate(-20 90 100)"/>`,
};

// ---------- Définition officielle des 7 Amis (extrait de « Les amis de Kalimati.html ») ----------
export const FRIENDS = [
  {
    id: 'nour',
    name: 'Nour',
    species: 'la petite loutre',
    missionId: 'talk',
    missionLabel: '🗣️ Parler & Atelier ortho',
    objectLabel: 'Casque anti-bruit bleu et petit sac jaune',
    roleDesc: 'Elle accueille l’enfant et l’aide à faire sa phrase. Elle fait des bulles quand l’enfant parle.',
    colors: ['#D9A066', '#4FC3B8', '#F2C94C', '#5B8DEF'],
    phrases: [
      { fr: 'Bonjour ! Montre-moi ce que tu veux.', dr: 'Salam ! Werrini chnou bghiti.', ar: 'سلام! وريني شنو بغيتي' },
      { fr: 'Bravo, tu as dit ta phrase !', dr: 'Mzyan bezzaf, gelti jemla dyalek!', ar: 'مزيان بزاف، گلتي الجملة ديالك!' },
    ],
  },
  {
    id: 'fennou',
    name: 'Fennou',
    species: 'le petit fennec',
    missionId: 'session',
    missionLabel: '🎮 Jouer (Séance ABA)',
    objectLabel: 'Pièce de puzzle lavande',
    roleDesc: 'Il ouvre les jeux et les exercices. Il montre le geste à imiter et attend sans presser.',
    colors: ['#E9C38F', '#FFF6E8', '#B7A6E0', '#F7C9C1'],
    phrases: [
      { fr: 'Écoute bien.', dr: 'Sme3 mzyan.', ar: 'سمع مزيان' },
      { fr: 'On joue ensemble ?', dr: 'Yallah nl3bou?', ar: 'يالله نلعبو؟' },
    ],
  },
  {
    id: 'fakroun',
    name: 'Fakroun',
    species: 'la tortue',
    missionId: 'routines',
    missionLabel: '📅 Ma journée (Planning)',
    objectLabel: 'Sablier en bois sur sa carapace',
    roleDesc: 'Il montre le planning, « D’abord / Ensuite » et le temps qui reste avant chaque changement.',
    colors: ['#7FA88A', '#C8DEB0', '#E8D8B0', '#C08850'],
    phrases: [
      { fr: 'Doucement, doucement.', dr: 'Chwiya b chwiya.', ar: 'شوية بشوية' },
      { fr: 'D’abord ceci, ensuite cela.', dr: 'Daba hadi, men b3d hadik.', ar: 'دابا هادي، من بعد هاديك' },
    ],
  },
  {
    id: 'hmama',
    name: 'Hmama',
    species: 'la colombe',
    missionId: 'emotions',
    missionLabel: '😊 Émotions & famille',
    objectLabel: 'Petit cœur rose',
    roleDesc: 'Elle aide à nommer ce qu’on ressent. Elle montre une seule émotion à la fois.',
    colors: ['#C9C6E6', '#E4E2F4', '#F4A9A0', '#F2B58C'],
    phrases: [
      { fr: 'Comment tu te sens ?', dr: 'Kifach kat7ess?', ar: 'كيفاش كتحس؟' },
      { fr: 'C’est normal d’être triste.', dr: '3adi tkoun 7zin.', ar: 'عادي تكون حزين' },
    ],
  },
  {
    id: 'jmimla',
    name: 'Jmimla',
    species: 'la petite chamelle',
    missionId: 'calm',
    missionLabel: '🌙 Coin calme',
    objectLabel: 'Couverture tissée à rayures',
    roleDesc: 'Sa bosse monte et descend lentement au rythme de la respiration.',
    colors: ['#E8B48A', '#F3CDA8', '#4FC3B8', '#F2C94C'],
    phrases: [
      { fr: 'Respire avec moi.', dr: 'Tneffes m3aya.', ar: 'تنفس معايا' },
      { fr: 'Je suis là, avec toi.', dr: 'Ana hna, m3ak.', ar: 'أنا هنا، معاك' },
    ],
  },
  {
    id: 'mchicha',
    name: 'Mchicha',
    species: 'la petite chatte',
    missionId: 'hygiene',
    missionLabel: '🫧 Soins du corps',
    objectLabel: 'Serviette rose et bulles de savon',
    roleDesc: 'Elle guide les routines d’hygiène : mains, dents, visage, douche, ongles, toilettes. Une étape à la fois.',
    colors: ['#C7D3DD', '#F7F3EC', '#F4B9B0', '#9BD0E6'],
    phrases: [
      { fr: 'On se lave les mains.', dr: 'Yallah nghslou yeddina.', ar: 'يالله نغسلو يدينا' },
      { fr: 'Tout propre !', dr: 'Nqi w zwin!', ar: 'نقي وزوين!' },
    ],
  },
  {
    id: 'bouma',
    name: 'Bouma',
    species: 'le petit hibou',
    missionId: 'stories',
    missionLabel: '📚 Histoires & école',
    objectLabel: 'Livre vert ouvert',
    roleDesc: 'Il tourne les pages des histoires sociales et compte jusqu’à dix avec l’enfant.',
    colors: ['#C49A6C', '#EBD8BF', '#4FA3A0', '#F2B58C'],
    phrases: [
      { fr: 'Viens, on lit une histoire.', dr: 'Aji nqraw qissa.', ar: 'أجي نقراو قصة' },
      { fr: 'Un, deux, trois !', dr: 'Wa7ed, jouj, tlata!', ar: 'واحد، جوج، تلاتة!' },
    ],
  },
];

export const FRIEND_BY_ID = new Map(FRIENDS.map((f) => [f.id, f]));
export const FRIEND_BY_MISSION = new Map(FRIENDS.map((f) => [f.missionId, f]));

// ---------- Rendu SVG d'un ami (avec pose douce : neutral, happy, sad, sleep) ----------
export function renderFriendSvg(friendId = 'nour', { pose = 'neutral', size = 88 } = {}) {
  const f = FRIEND_BY_ID.get(friendId) || FRIENDS[0];
  const inner = SVG_PATHS[f.id] || SVG_PATHS.nour;
  return h('span', {
    class: `friend-avatar friend-${f.id} pose-${pose}`,
    style: { width: `${size}px`, height: `${Math.round(size * 1.15)}px`, display: 'inline-flex' },
    html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140" width="100%" height="100%" role="img" aria-label="${f.name} ${f.species}">${inner}</svg>`,
  });
}

// Prononce la phrase d'un ami uniquement lorsque l'enfant touche l'ami (jamais de son surprise).
// Joue en priorité le fichier MP3 pré-généré par OpenAI (./voix/fr/ami-<id>-<1|2>.mp3 ou ./voix/dr/ami-<id>-<1|2>.mp3),
// et bascule automatiquement sur la synthèse vocale du téléphone si le fichier MP3 n'est pas encore présent.
export function sayFriendPhrase(friendId, { index = 0, lang = 'fr' } = {}) {
  const f = FRIEND_BY_ID.get(friendId) || FRIENDS[0];
  const phraseIdx = f.phrases[index] ? index : 0;
  const phrase = f.phrases[phraseIdx];
  if (!phrase) return;
  const darija = lang === 'dr' || lang === 'ar';
  const phoneVoice = () => (darija ? speak(phrase.ar || phrase.dr, { lang: 'ar' }) : speak(phrase.fr, { lang: 'fr' }));
  // v9.14 : voix Shimmer préparée à l'avance (2 phrases par ami), sinon voix du téléphone.
  const n = f.phrases[index] ? index + 1 : 1;
  if (n > 2) { phoneVoice(); return; }
  playVoiceFile(`./voix/${darija ? 'dr' : 'fr'}/ami-${f.id}-${n}.mp3`).then((ok) => { if (!ok) phoneVoice(); });
}

// ---------- Bandeau compagnon en haut d'une mission (un seul ami à l'écran à la fois) ----------
export function friendCompanionBanner(missionOrFriendId, { lang = 'fr', pose = 'neutral', phraseIndex = 0 } = {}) {
  if (hideFriendsCached) return null;
  const f = FRIEND_BY_MISSION.get(missionOrFriendId) || FRIEND_BY_ID.get(missionOrFriendId) || FRIENDS[0];
  const p = f.phrases[phraseIndex] || f.phrases[0];
  const textPrimary = (lang === 'dr') ? p.dr : (lang === 'ar') ? p.ar : p.fr;
  const textSub = (lang === 'dr' || lang === 'ar') ? p.fr : p.dr;

  const banner = h('button', {
    type: 'button',
    class: `friend-banner friend-theme-${f.id}`,
    onclick: () => {
      banner.classList.remove('friend-nod');
      void banner.offsetWidth;
      banner.classList.add('friend-nod');
      sayFriendPhrase(f.id, { index: phraseIndex, lang });
    },
  },
  renderFriendSvg(f.id, { pose, size: 74 }),
  h('span', { class: 'friend-banner-text' },
    h('strong', {}, `${f.name} ${f.species}`),
    h('span', { class: 'friend-speech' }, `« ${textPrimary} »`),
    h('small', { class: 'friend-sub' }, `${textSub} · ${tx('friendListen', lang, { name: f.name })}`)));
  return banner;
}

// ---------- Récompense calme : L'Album des Amis (autocollant gagné après une mission, sans points ni chrono) ----------
export async function unlockFriendSticker(friendId, missionNote = '') {
  await loadFriendsState();
  const f = FRIEND_BY_ID.get(friendId) || FRIEND_BY_MISSION.get(friendId) || FRIENDS[0];
  const isNew = !albumCached.unlocked.includes(f.id);
  if (isNew) albumCached.unlocked.push(f.id);
  albumCached.history = [
    { friendId: f.id, day: dayKey(), note: missionNote || f.missionLabel, ts: Date.now() },
    ...(albumCached.history || []).slice(0, 49),
  ];
  await db.setSetting(ALBUM_KEY, albumCached);
  return { friend: f, isNew, totalUnlocked: albumCached.unlocked.length };
}

// Bannière de félicitations calme avec l'ami de la mission + bouton vers l'Album des Amis
export function friendCalmRewardCard(friendId, { lang = 'fr' } = {}) {
  if (hideFriendsCached) return null;
  const f = FRIEND_BY_ID.get(friendId) || FRIEND_BY_MISSION.get(friendId) || FRIENDS[0];
  const p = f.phrases[1] || f.phrases[0];
  return h('div', { class: `friend-reward-card friend-theme-${f.id}` },
    renderFriendSvg(f.id, { pose: 'happy', size: 88 }),
    h('div', { class: 'stack' },
      h('strong', {}, tx('friendWon', lang, { name: f.name, species: f.species })),
      h('p', { class: 'note' }, lang === 'dr' ? p.dr : p.fr),
      h('div', { class: 'row wrap' },
        btn(tx('listenName', lang, { name: f.name }), () => sayFriendPhrase(f.id, { index: 1, lang }), 'ghost tiny'),
        btn(tx('openAlbum', lang), () => openFriendsAlbumModal(lang), 'primary tiny'))));
}

// ---------- Modale « 📒 Mon Album des 7 Amis » ----------
export async function openFriendsAlbumModal(lang = 'fr') {
  await loadFriendsState();
  const dialog = h('dialog', { class: 'wizard-dialog album-dialog' });
  const close = () => { if (dialog.open) dialog.close(); dialog.remove(); };

  const cards = FRIENDS.map((f) => {
    const unlocked = albumCached.unlocked.includes(f.id);
    const p = f.phrases[0];
    return h('button', {
      type: 'button',
      class: `album-friend-card${unlocked ? ' is-unlocked' : ' is-locked'}`,
      onclick: () => {
        if (unlocked) sayFriendPhrase(f.id, { index: 0, lang });
      },
    },
    renderFriendSvg(f.id, { pose: unlocked ? 'happy' : 'sleep', size: 96 }),
    h('strong', {}, `${unlocked ? '🌟 ' : '🔒 '}${f.name}`),
    h('small', {}, f.species),
    h('span', { class: 'album-mission-tag' }, f.missionLabel),
    h('p', { class: 'album-phrase' }, unlocked ? (lang === 'dr' ? p.dr : p.fr) : tx('albumLocked', lang)));
  });

  dialog.append(
    h('div', { class: 'stack wizard-box' },
      h('div', { class: 'row spread' },
        h('h2', {}, tx('albumTitle', lang, { n: albumCached.unlocked.length, total: FRIENDS.length })),
        btn(`✕ ${tx('close', lang)}`, close, 'ghost tiny')),
      h('p', { class: 'note' }, tx('albumNote', lang)),
      h('div', { class: 'album-grid' }, ...cards)),
  );
  document.body.append(dialog);
  dialog.showModal();
}

// ---------- Réglage Parent : Afficher / Masquer les 7 Amis ----------
export function friendsSettingsBox() {
  const chk = h('input', {
    type: 'checkbox',
    checked: !hideFriendsCached ? 'checked' : null,
    onchange: async (e) => {
      await setFriendsHidden(!e.target.checked);
    },
  });
  return h('details', { class: 'card-box' },
    h('summary', {}, '🦦 Les 7 Amis de Kalimati (Nour, Fennou, Fakroun, Hmama, Jmimla, Mchicha, Bouma)'),
    h('div', { class: 'stack' },
      h('label', { class: 'check' }, chk, ' Afficher l’ami compagnon dans chaque espace enfant (un seul ami à la fois, mouvements lents)'),
      h('p', { class: 'note' }, 'Chaque espace a son ami dédié : Nour (Parler), Fennou (Jouer), Fakroun (Ma journée), Hmama (Émotions), Jmimla (Coin calme), Mchicha (Soins du corps), Bouma (Histoires & école).'),
      h('div', { class: 'row' },
        btn('📒 Voir l’Album des 7 Amis', () => openFriendsAlbumModal('fr'), 'ghost tiny'))));
}