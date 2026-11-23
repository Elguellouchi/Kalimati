// Libellés des ateliers cliniques et des ajouts au cœur de communication (v10.15).
// Le français est la source ; la darija est demandée à OpenAI hors ligne par
// tools/gen-clinic-i18n.mjs et rangée dans clinic-i18n-dr.js. Rien ne part au serveur à l'usage.
import { CLINIC_DR } from './clinic-i18n-dr.js';
// v10.26 : l'arabe standard des ateliers (déjà préparé dans le Drive par tools/gen-clinic-i18n.mjs --langue ar).
import { CLINIC_AR } from './clinic-i18n-ar.js';
const TABLES = { dr: CLINIC_DR, ar: CLINIC_AR };

export const CLINIC_FR = {
  clinic: 'Ateliers',
  clinicTitle: '🧩 Ateliers cliniques',
  clinicSub: 'Une séance guidée, des jeux doux et mes supports du quotidien.',
  tClinic: 'Mes ateliers',
  sClinic: 'Ma séance de 15 minutes et des jeux calmes',

  daily: 'Ma séance du jour (15 min)',
  dailySub: '5 cartes, un jeu de logique, ma voix, puis des ballons.',
  verbs: 'Verbe + 3 compléments',
  verbsSub: 'Manger, boire, jouer… et choisir quoi.',
  stop: 'OK Stop ! (attendre)',
  stopSub: 'Je touche quand le coffre est ouvert, je m’arrête quand il se ferme.',
  signs: 'L’Attrape-Signes',
  signsSub: 'Je repère vite la même suite de lettres.',
  life: 'Mon cahier de vie',
  lifeSub: 'Ce que j’ai mangé, où je suis allé, ce que j’ai aimé.',
  pain: 'Où j’ai mal ?',
  painSub: 'Je montre l’endroit et la force de la douleur.',
  draw: '🎨 Ardoise magique',
  drawSub: 'Je dessine avec mon doigt.',
  urgent: '🆘 Cartes d’urgence',
  urgentSub: 'Mes 24 mots vitaux, en un seul écran.',

  start: '▶ Commencer',
  next: '➡️ Suivant',
  again: '🔄 Recommencer',
  bravo: 'Bravo !',
  stepOf: 'Étape {n} sur {total}',
  sessionDoneToday: '✅ Séance déjà faite aujourd’hui. Tu peux la refaire.',

  cardsTitle: 'Mes 5 mots du jour',
  cardsHint: 'Touche chaque carte pour l’écouter.',
  cardsSeen: 'Vu !',
  matrixTitle: 'Trouve la bonne image',
  voiceTitle: 'Ma voix fait monter le ballon',
  voiceHint: 'Parle ou souffle dans le téléphone : le ballon monte.',
  voiceMicOff: 'Le micro n’est pas disponible. On continue sans lui.',
  balloons: '🎈 Éclate les ballons !',
  balloonsHint: 'Touche les ballons pour les faire éclater.',

  verbEat: 'Manger',
  verbDrink: 'Boire',
  verbPlay: 'Jouer',
  verbPut: 'Mettre',
  verbTakeOff: 'Enlever',
  verbTouch: 'Toucher',
  sayEat: 'Je mange {x}',
  sayDrink: 'Je bois {x}',
  sayPlay: 'Je joue avec {x}',
  sayPut: 'Je mets {x}',
  sayTakeOff: 'J’enlève {x}',
  sayTouch: 'Je touche {x}',

  stopOpen: '🟢 Coffre ouvert : touche !',
  stopClosed: '🔴 Coffre fermé : on s’arrête.',
  stopPoints: '{n} points',
  stopEnd: 'Bravo ! Tu as su t’arrêter.',

  signsFind: 'Trouve la même suite : {letters}',
  signsRound: 'Suite {n} sur {total}',

  lifeSlot1: 'Ce que j’ai mangé',
  lifeSlot2: 'Où je suis allé',
  lifeSlot3: 'Ce que j’ai aimé',
  lifeAddPhoto: '📷 Photo',
  lifeAddVoice: '🎙️ Ma voix',
  lifePlay: '▶ Écouter',
  lifeNoVoice: 'Pas encore de voix.',
  lifeParentOnly: '🔒 Un adulte ajoute la photo ou la voix.',
  lifeRecording: '⏺ Enregistrement… touche pour arrêter.',
  lifeSaved: '✅ Gardé dans ce téléphone.',

  painWhere: 'Où as-tu mal ?',
  painHow: 'C’est fort comment ?',
  painSaid: 'J’ai mal ici.',
  painHead: 'Tête',
  painBelly: 'Ventre',
  painTeeth: 'Dents',
  painThroat: 'Gorge',
  painEars: 'Oreilles',
  painLeg: 'Jambe',
  pain1: 'un peu',
  pain2: 'moyen',
  pain3: 'fort',
  pain4: 'très fort',
  pain5: 'très très fort',

  drawHint: 'Dessine avec ton doigt.',
  drawClear: '🧽 Effacer',
  drawSave: '💾 Garder l’image',

  urgentHint: 'Touche un mot pour le dire.',
  urgentEmpty: 'Aucune carte vitale. L’adulte peut en ajouter dans Parler.',
  localNote: 'Tout reste dans ce téléphone : rien ne part sur internet.',

  echoOn: '🎧 Mode écho',
  echoCue: '🎧 À toi !',
  explore: '👁️ Explorer 30 s',
  exploreOn: '👁️ Explorer : toutes les cartes sont visibles.',
  search: '🔎 Chercher un mot',
  searchPlaceholder: 'Écrire un mot…',
  searchNotFound: 'Mot introuvable.',
  searchFound: 'Voici « {word} ».',
  quickWait: 'Attends, je prépare ma phrase !',
  quickOui: 'Oui',
  quickNon: 'Non',
  quickHelp: 'Aide-moi',
  quickJoke: 'C’est une blague ! 😄',
  // v10.23 (pépite 2) : le mot qui répare sans rien effacer.
  quickOups: 'Oups, je me suis trompé ! 🙈',
  askFeel: 'Comment te sens-tu ?',
  askWant: 'Que veux-tu ?',
  askWhere: 'Où veux-tu aller ?',
  askWhat: 'Qu’est-ce qui se passe ?',

  annulled: 'Annulé ❌',
  restoreStep: '↩ Rétablir',
  tremor: '🖐️ Anti-tremblement (toucher au relâchement)',
  tremorOn: 'Anti-tremblement activé.',
  tremorOff: 'Anti-tremblement désactivé.',
};

export function clinicT(key, lang = 'fr', vars) {
  const table = TABLES[lang] || CLINIC_FR;
  const raw = table[key] ?? CLINIC_FR[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, name) => (vars[name] === undefined ? m : String(vars[name]))) : raw;
}
