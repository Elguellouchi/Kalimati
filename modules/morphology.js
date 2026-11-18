// 🧠 Moteur morphologique et syntaxique bilingue (Français + Darija marocaine + Code-Switching) — 100 % hors-ligne.
// Version v10.0 :
// 1. Conjugaison automatique des verbes (Présent, Passé, Futur) selon le sujet (Je/Moi, Papa/Il, Maman/Ghita/Elle) et après « Je veux / Bghit ».
// 2. Insertion automatique du verbe sous-entendu après « Je veux » quand l'enfant pose un nom sans verbe :
//    - Aliment : « Je veux » + « Pain » -> « Je veux manger du pain » (bghit nakoul l-khobz, verbCardId: 'c-actions-manger')
//    - Boisson : « Je veux » + « Eau » -> « Je veux boire de l'eau » (bghit nchreb l-ma, verbCardId: 'c-actions-boire')
//    - Jeu : « Je veux » + « Ballon » -> « Je veux jouer au ballon » (bghit nl3eb b l-kora, verbCardId: 'c-actions-jouer')
//    - Dessin animé : « Je veux » + « Dessin animé » -> « Je veux regarder le dessin animé » (bghit nchouf r-rassoum, verbCardId: 'c-actions-regarder')
//    - Musique : « Je veux » + « Musique » -> « Je veux écouter de la musique » (bghit nsme3 l-mousi9a, verbCardId: 'c-actions-ecouter')
//    - Lieu : « Je veux » + « Parc » -> « Je veux aller au parc » (bghit nmchi l-jarda)
// 3. Accord en genre ET en temps (Hier / Maintenant / Après) sur les émotions, adjectifs et « Bghit » :
//    - « Moi + Content » : Présent « Je suis contente / Ana fer7ana », Passé « J'étais contente / Kount fer7ana », Futur « Je serai contente / Ghadi nkoun fer7ana ».
//    - « Je veux » : Présent « bghit », Passé « kount bghit », Futur « ghadi nbghi ».

import * as db from '../db.js';
import { h } from './util.js';

let currentTense = 'present'; // 'past' | 'present' | 'future'
let childGenderCached = 'girl'; // 'girl' | 'boy' (par défaut 'girl' pour Abir, configurable dans le profil)

export async function loadMorphologyState() {
  const savedGender = await db.getSetting('childGender');
  if (savedGender === 'boy' || savedGender === 'girl') childGenderCached = savedGender;
}

export const getTense = () => currentTense;
export function setTense(tense) {
  if (['past', 'present', 'future'].includes(tense)) currentTense = tense;
}

export const getChildGender = () => childGenderCached;
export async function setChildGender(gender) {
  childGenderCached = gender === 'boy' ? 'boy' : 'girl';
  await db.setSetting('childGender', childGenderCached);
}

// ---------- 1. Base morphologique des personnes / sujets ----------
const SUBJECTS = {
  'c-personnes-moi': { person: '1s', gender: () => (childGenderCached === 'boy' ? 'm' : 'f'), fr: 'Je', dr: 'Ana', ar: 'أنا' },
  'c-personnes-papa': { person: '3ms', gender: () => 'm', fr: 'Papa', dr: 'Baba', ar: 'بابا' },
  'c-personnes-papi': { person: '3ms', gender: () => 'm', fr: 'Papi', dr: 'Jeddi', ar: 'جدي' },
  'c-personnes-maman': { person: '3fs', gender: () => 'f', fr: 'Maman', dr: 'Mama', ar: 'ماما' },
  'c-personnes-ghita': { person: '3fs', gender: () => 'f', fr: 'Ghita', dr: 'Ghita', ar: 'غيتة' },
  'c-personnes-hosna': { person: '3fs', gender: () => 'f', fr: 'Hosna', dr: 'Hosna', ar: 'حسناء' },
  'c-personnes-maitresse': { person: '3fs', gender: () => 'f', fr: 'La maîtresse', dr: 'Lmo3allima', ar: 'المعلمة' },
  'c-personnes-mamie': { person: '3fs', gender: () => 'f', fr: 'Mamie', dr: 'Mima', ar: 'ميمة' },
};

// ---------- 2. Table de conjugaison bilingue (Français + Darija latine + Darija arabe) ----------
const VERBS = {
  manger: {
    cardId: 'c-actions-manger',
    infFr: 'manger', ppFr: 'mangé', auxFr: 'avoir',
    presFr: { '1s': 'mange', '3ms': 'mange', '3fs': 'mange' },
    subDr: { '1s': 'nakoul', '3ms': 'yakoul', '3fs': 'takoul' },
    subAr: { '1s': 'ناكل', '3ms': 'ياكل', '3fs': 'تاكل' },
    presDr: { '1s': 'kanakoul', '3ms': 'kayakoul', '3fs': 'katakoul' },
    presAr: { '1s': 'كناكل', '3ms': 'كياكل', '3fs': 'كتاكل' },
    pastDr: { '1s': 'klit', '3ms': 'kla', '3fs': 'klat' },
    pastAr: { '1s': 'كليت', '3ms': 'كلا', '3fs': 'كلات' },
  },
  boire: {
    cardId: 'c-actions-boire',
    infFr: 'boire', ppFr: 'bu', auxFr: 'avoir',
    presFr: { '1s': 'bois', '3ms': 'boit', '3fs': 'boit' },
    subDr: { '1s': 'nchreb', '3ms': 'ychreb', '3fs': 'tchreb' },
    subAr: { '1s': 'نشرب', '3ms': 'يشرب', '3fs': 'تشرب' },
    presDr: { '1s': 'kanchreb', '3ms': 'kaychreb', '3fs': 'katchreb' },
    presAr: { '1s': 'كنشرب', '3ms': 'كيشرب', '3fs': 'كتشرب' },
    pastDr: { '1s': 'chrebt', '3ms': 'chreb', '3fs': 'cherbat' },
    pastAr: { '1s': 'شربت', '3ms': 'شرب', '3fs': 'شربات' },
  },
  jouer: {
    cardId: 'c-actions-jouer',
    infFr: 'jouer', ppFr: 'joué', auxFr: 'avoir',
    presFr: { '1s': 'joue', '3ms': 'joue', '3fs': 'joue' },
    subDr: { '1s': 'nl3eb', '3ms': 'yl3eb', '3fs': 'tl3eb' },
    subAr: { '1s': 'نلعب', '3ms': 'يلعب', '3fs': 'تلعب' },
    presDr: { '1s': 'kanl3eb', '3ms': 'kayl3eb', '3fs': 'katl3eb' },
    presAr: { '1s': 'كنلعب', '3ms': 'كيلعب', '3fs': 'كتلعب' },
    pastDr: { '1s': 'l3ebt', '3ms': 'l3eb', '3fs': 'le3bat' },
    pastAr: { '1s': 'لعبت', '3ms': 'لعب', '3fs': 'لعبات' },
  },
  courir: {
    cardId: 'c-actions-courir',
    infFr: 'courir', ppFr: 'couru', auxFr: 'avoir',
    presFr: { '1s': 'cours', '3ms': 'court', '3fs': 'court' },
    subDr: { '1s': 'njri', '3ms': 'yjri', '3fs': 'tjri' },
    subAr: { '1s': 'نجري', '3ms': 'يجري', '3fs': 'تجري' },
    presDr: { '1s': 'kanjri', '3ms': 'kayjri', '3fs': 'katjri' },
    presAr: { '1s': 'كنجري', '3ms': 'كيجري', '3fs': 'كتجري' },
    pastDr: { '1s': 'jrit', '3ms': 'jra', '3fs': 'jrat' },
    pastAr: { '1s': 'جريت', '3ms': 'جرى', '3fs': 'جرات' },
  },
  donner: {
    cardId: 'c-actions-donner',
    infFr: 'donner', ppFr: 'donné', auxFr: 'avoir',
    presFr: { '1s': 'donne', '3ms': 'donne', '3fs': 'donne' },
    subDr: { '1s': 'n3ti', '3ms': 'y3ti', '3fs': 't3ti' },
    subAr: { '1s': 'نعطي', '3ms': 'يعطي', '3fs': 'تعطي' },
    presDr: { '1s': '3tini', '3ms': 'kay3ti', '3fs': 'kat3ti' },
    presAr: { '1s': 'عطيني', '3ms': 'كيعطي', '3fs': 'كتعطي' },
    pastDr: { '1s': '3tit', '3ms': '3ta', '3fs': '3tat' },
    pastAr: { '1s': 'عطيت', '3ms': 'عطى', '3fs': 'عطات' },
  },
  couper: {
    cardId: 'c-actions-couper',
    infFr: 'couper', ppFr: 'coupé', auxFr: 'avoir',
    presFr: { '1s': 'coupe', '3ms': 'coupe', '3fs': 'coupe' },
    subDr: { '1s': 'n9te3', '3ms': 'y9te3', '3fs': 't9te3' },
    subAr: { '1s': 'نقطع', '3ms': 'يقطع', '3fs': 'تقطع' },
    presDr: { '1s': 'kan9te3', '3ms': 'kay9te3', '3fs': 'kat9te3' },
    presAr: { '1s': 'كنقطع', '3ms': 'كيقطع', '3fs': 'كتقطع' },
    pastDr: { '1s': '9tte3t', '3ms': '9tte3', '3fs': '9ett3at' },
    pastAr: { '1s': 'قطعت', '3ms': 'قطع', '3fs': 'قطعات' },
  },
  sauter: {
    cardId: 'c-actions-sauter',
    infFr: 'sauter', ppFr: 'sauté', auxFr: 'avoir',
    presFr: { '1s': 'saute', '3ms': 'saute', '3fs': 'saute' },
    subDr: { '1s': 'n9fez', '3ms': 'y9fez', '3fs': 't9fez' },
    subAr: { '1s': 'نقفز', '3ms': 'يقفز', '3fs': 'تقفز' },
    presDr: { '1s': 'kan9fez', '3ms': 'kay9fez', '3fs': 'kat9fez' },
    presAr: { '1s': 'كنقفز', '3ms': 'كيقفز', '3fs': 'كتقفز' },
    pastDr: { '1s': '9fezt', '3ms': '9fez', '3fs': '9efzat' },
    pastAr: { '1s': 'قفزت', '3ms': 'قفز', '3fs': 'قفزات' },
  },
  laver: {
    cardId: 'c-actions-laver',
    infFr: 'laver', ppFr: 'lavé', auxFr: 'avoir',
    presFr: { '1s': 'lave', '3ms': 'lave', '3fs': 'lave' },
    subDr: { '1s': 'nghsel', '3ms': 'yghsel', '3fs': 'tghsel' },
    subAr: { '1s': 'نغسل', '3ms': 'يغسل', '3fs': 'تغسل' },
    presDr: { '1s': 'kanghsel', '3ms': 'kayghsel', '3fs': 'katghsel' },
    presAr: { '1s': 'كنغسل', '3ms': 'كيغسل', '3fs': 'كتغسل' },
    pastDr: { '1s': 'ghselt', '3ms': 'ghsel', '3fs': 'gheslat' },
    pastAr: { '1s': 'غسلت', '3ms': 'غسل', '3fs': 'غسلات' },
  },
  dessiner: {
    cardId: 'c-actions-dessiner',
    infFr: 'dessiner', ppFr: 'dessiné', auxFr: 'avoir',
    presFr: { '1s': 'dessine', '3ms': 'dessine', '3fs': 'dessine' },
    subDr: { '1s': 'nrsem', '3ms': 'yrsem', '3fs': 'trsem' },
    subAr: { '1s': 'نرسم', '3ms': 'يرسم', '3fs': 'ترسم' },
    presDr: { '1s': 'kanrsem', '3ms': 'kayrsem', '3fs': 'katrsem' },
    presAr: { '1s': 'كنرسم', '3ms': 'كيرسم', '3fs': 'كترسم' },
    pastDr: { '1s': 'rsemt', '3ms': 'rsem', '3fs': 'resmat' },
    pastAr: { '1s': 'رسمت', '3ms': 'رسم', '3fs': 'رسمات' },
  },
  ouvrir: {
    cardId: 'c-actions-ouvrir',
    infFr: 'ouvrir', ppFr: 'ouvert', auxFr: 'avoir',
    presFr: { '1s': 'ouvre', '3ms': 'ouvre', '3fs': 'ouvre' },
    subDr: { '1s': 'n7el', '3ms': 'y7el', '3fs': 't7el' },
    subAr: { '1s': 'نحل', '3ms': 'يحل', '3fs': 'تحل' },
    presDr: { '1s': 'kan7el', '3ms': 'kay7el', '3fs': 'kat7el' },
    presAr: { '1s': 'كنحل', '3ms': 'كيحل', '3fs': 'كتحل' },
    pastDr: { '1s': '7ellit', '3ms': '7el', '3fs': '7ellat' },
    pastAr: { '1s': 'حليت', '3ms': 'حل', '3fs': 'حلات' },
  },
  dormir: {
    cardId: 'c-actions-dormir',
    infFr: 'dormir', ppFr: 'dormi', auxFr: 'avoir',
    presFr: { '1s': 'dors', '3ms': 'dort', '3fs': 'dort' },
    subDr: { '1s': 'n3es', '3ms': 'yn3es', '3fs': 'tn3es' },
    subAr: { '1s': 'نعس', '3ms': 'ينعس', '3fs': 'تنعس' },
    presDr: { '1s': 'kan3es', '3ms': 'kayn3es', '3fs': 'katn3es' },
    presAr: { '1s': 'كنعس', '3ms': 'كينعس', '3fs': 'كتنعس' },
    pastDr: { '1s': 'n3est', '3ms': 'n3es', '3fs': 'ne3sat' },
    pastAr: { '1s': 'نعست', '3ms': 'نعس', '3fs': 'نعسات' },
  },
  changer: {
    cardId: 'c-besoins-changer',
    infFr: 'me changer', ppFr: 'changé', auxFr: 'avoir',
    presFr: { '1s': 'me change', '3ms': 'se change', '3fs': 'se change' },
    subDr: { '1s': 'nbeddel', '3ms': 'ybeddel', '3fs': 'tbeddel' },
    subAr: { '1s': 'نبدل', '3ms': 'يبدل', '3fs': 'تبدل' },
    presDr: { '1s': 'kanbeddel', '3ms': 'kaybeddel', '3fs': 'katbeddel' },
    presAr: { '1s': 'كنبدل', '3ms': 'كيبدل', '3fs': 'كتبدل' },
    pastDr: { '1s': 'beddelt', '3ms': 'beddel', '3fs': 'beddlat' },
    pastAr: { '1s': 'بدلت', '3ms': 'بدل', '3fs': 'بدلات' },
  },
  lire: {
    cardId: 'c-actions-lire',
    infFr: 'lire', ppFr: 'lu', auxFr: 'avoir',
    presFr: { '1s': 'lis', '3ms': 'lit', '3fs': 'lit' },
    subDr: { '1s': 'n9ra', '3ms': 'y9ra', '3fs': 't9ra' },
    subAr: { '1s': 'نقرا', '3ms': 'يقرا', '3fs': 'تقرا' },
    presDr: { '1s': 'kan9ra', '3ms': 'kay9ra', '3fs': 'kat9ra' },
    presAr: { '1s': 'كنقرا', '3ms': 'كيقرا', '3fs': 'كتقرا' },
    pastDr: { '1s': '9rit', '3ms': '9ra', '3fs': '9rat' },
    pastAr: { '1s': 'قريت', '3ms': 'قرا', '3fs': 'قرات' },
  },
  ecrire: {
    cardId: 'c-actions-ecrire',
    infFr: 'écrire', ppFr: 'écrit', auxFr: 'avoir',
    presFr: { '1s': 'écris', '3ms': 'écrit', '3fs': 'écrit' },
    subDr: { '1s': 'nkteb', '3ms': 'ykteb', '3fs': 'tkteb' },
    subAr: { '1s': 'نكتب', '3ms': 'يكتب', '3fs': 'تكتب' },
    presDr: { '1s': 'kankteb', '3ms': 'kaykteb', '3fs': 'katkteb' },
    presAr: { '1s': 'كنكتب', '3ms': 'كيكتب', '3fs': 'كتكتب' },
    pastDr: { '1s': 'ktebt', '3ms': 'kteb', '3fs': 'ketbat' },
    pastAr: { '1s': 'كتبت', '3ms': 'كتب', '3fs': 'كتبات' },
  },
  regarder: {
    cardId: 'c-actions-regarder',
    infFr: 'regarder', ppFr: 'regardé', auxFr: 'avoir',
    presFr: { '1s': 'regarde', '3ms': 'regarde', '3fs': 'regarde' },
    subDr: { '1s': 'nchouf', '3ms': 'ychouf', '3fs': 'tchouf' },
    subAr: { '1s': 'نشوف', '3ms': 'يشوف', '3fs': 'تشوف' },
    presDr: { '1s': 'kanchouf', '3ms': 'kaychouf', '3fs': 'katchouf' },
    presAr: { '1s': 'كنشوف', '3ms': 'كيشوف', '3fs': 'كتشوف' },
    pastDr: { '1s': 'cheft', '3ms': 'chaf', '3fs': 'chaft' },
    pastAr: { '1s': 'شفت', '3ms': 'شاف', '3fs': 'شافت' },
  },
  ecouter: {
    cardId: 'c-actions-ecouter',
    infFr: 'écouter', ppFr: 'écouté', auxFr: 'avoir',
    presFr: { '1s': 'écoute', '3ms': 'écoute', '3fs': 'écoute' },
    subDr: { '1s': 'nsme3', '3ms': 'ysme3', '3fs': 'tsme3' },
    subAr: { '1s': 'نسمع', '3ms': 'يسمع', '3fs': 'تسمع' },
    presDr: { '1s': 'kansme3', '3ms': 'kaysme3', '3fs': 'katsme3' },
    presAr: { '1s': 'كنسمع', '3ms': 'كيسمع', '3fs': 'كتسمع' },
    pastDr: { '1s': 'sme3t', '3ms': 'sme3', '3fs': 'sem3at' },
    pastAr: { '1s': 'سمعت', '3ms': 'سمع', '3fs': 'سمعات' },
  },
  aller: {
    cardId: null,
    infFr: 'aller', ppFr: 'allé', auxFr: 'être',
    presFr: { '1s': 'vais', '3ms': 'va', '3fs': 'va' },
    subDr: { '1s': 'nmchi', '3ms': 'ymchi', '3fs': 'tmchi' },
    subAr: { '1s': 'نمشي', '3ms': 'يمشي', '3fs': 'تمشي' },
    presDr: { '1s': 'kanmchi', '3ms': 'kaymchi', '3fs': 'katmchi' },
    presAr: { '1s': 'كنمشي', '3ms': 'كيمشي', '3fs': 'كتمشي' },
    pastDr: { '1s': 'mchit', '3ms': 'mcha', '3fs': 'mchat' },
    pastAr: { '1s': 'مشيت', '3ms': 'مشى', '3fs': 'مشات' },
  },
};

// ---------- 3. Accord en genre ET en temps des émotions & adjectifs (Français + Darija) ----------
const COPULA_ETRE_FR = {
  present: { '1s': 'suis', '3ms': 'est', '3fs': 'est' },
  past: { '1s': 'étais', '3ms': 'était', '3fs': 'était' },
  future: { '1s': 'serai', '3ms': 'sera', '3fs': 'sera' },
};

const COPULA_AVOIR_FR = {
  present: { '1s': 'ai', '3ms': 'a', '3fs': 'a' },
  past: { '1s': 'avais', '3ms': 'avait', '3fs': 'avait' },
  future: { '1s': 'aurai', '3ms': 'aura', '3fs': 'aura' },
};

// Auxiliaires de temps pour les adjectifs / états en Darija (« Kount fer7ana » / « Ghadi nkoun fer7ana »)
function copulaDrForState(person, gender, tense, isAr = false) {
  if (tense === 'past') {
    if (isAr) return person === '1s' ? 'كنت' : person === '3ms' ? 'كان' : 'كانت';
    return person === '1s' ? 'kount' : person === '3ms' ? 'kan' : 'kanet';
  }
  if (tense === 'future') {
    if (isAr) {
      return person === '1s' ? 'غادي نكون' : person === '3ms' ? 'غادي يكون' : 'غادة تكون';
    }
    return person === '1s' ? 'ghadi nkoun' : person === '3ms' ? 'ghadi ykoun' : 'ghada tkoun';
  }
  return '';
}

const ADJECTIVES = {
  content: {
    fr: { m: 'content', f: 'contente' },
    auxType: 'etre',
    dr: { m: 'fer7an', f: 'fer7ana' },
    ar: { m: 'فرحان', f: 'فرحانة' },
  },
  triste: {
    fr: { m: 'triste', f: 'triste' },
    auxType: 'etre',
    dr: { m: '7zin', f: '7zina' },
    ar: { m: 'حزين', f: 'حزينة' },
  },
  'en-colere': {
    fr: { m: 'en colère', f: 'en colère' },
    auxType: 'etre',
    dr: { m: 'mqelle9', f: 'mqell9a' },
    ar: { m: 'مقلق', f: 'مقلقة' },
  },
  peur: {
    fr: { m: 'peur', f: 'peur' },
    auxType: 'avoir',
    dr: { m: 'khayef', f: 'khayfa' },
    ar: { m: 'خايف', f: 'خايفة' },
  },
  fatigue: {
    fr: { m: 'fatigué', f: 'fatiguée' },
    auxType: 'etre',
    dr: { m: '3eyyan', f: '3eyyana' },
    ar: { m: 'عيان', f: 'عيانة' },
  },
  fier: {
    fr: { m: 'fier', f: 'fière' },
    auxType: 'etre',
    dr: { m: 'fkhour', f: 'fkhoura' },
    ar: { m: 'فخور', f: 'فخورة' },
  },
  grand: { fr: { m: 'grand', f: 'grande' }, dr: { m: 'kbir', f: 'kbira' }, ar: { m: 'كبير', f: 'كبيرة' } },
  petit: { fr: { m: 'petit', f: 'petite' }, dr: { m: 'sghir', f: 'sghira' }, ar: { m: 'صغير', f: 'صغيرة' } },
  rouge: { fr: { m: 'rouge', f: 'rouge' }, dr: { m: '7mer', f: '7emra' }, ar: { m: 'حمر', f: 'حمرا' } },
  bleu: { fr: { m: 'bleu', f: 'bleue' }, dr: { m: 'zre9', f: 'zer9a' }, ar: { m: 'زرق', f: 'زرقا' } },
  jaune: { fr: { m: 'jaune', f: 'jaune' }, dr: { m: 'sfer', f: 'sefra' }, ar: { m: 'صفر', f: 'صفرا' } },
  vert: { fr: { m: 'vert', f: 'verte' }, dr: { m: 'khder', f: 'khedra' }, ar: { m: 'خضر', f: 'خضرا' } },
  chaud: { fr: { m: 'chaud', f: 'chaude' }, dr: { m: 'skhoun', f: 'skhouna' }, ar: { m: 'سخون', f: 'سخونة' } },
  froid: { fr: { m: 'froid', f: 'froide' }, dr: { m: 'bared', f: 'barda' }, ar: { m: 'بارد', f: 'باردة' } },
  rond: { fr: { m: 'rond', f: 'ronde' }, dr: { m: 'mdewwer', f: 'mdewwra' }, ar: { m: 'مدور', f: 'مدورة' } },
};

// ---------- 4. Genre et déterminants des noms (Aliments, Boissons, Jouets, Lieux) ----------
const NOUNS = {
  pain: { gender: 'm', partFr: 'du pain', defFr: 'le pain', dr: 'l-khobz', ar: 'الخبز', impliedVerb: 'manger' },
  pomme: { gender: 'f', partFr: 'une pomme', defFr: 'la pomme', dr: 'teffa7a', ar: 'تفاحة', impliedVerb: 'manger' },
  banane: { gender: 'f', partFr: 'une banane', defFr: 'la banane', dr: 'banana', ar: 'بنانة', impliedVerb: 'manger' },
  gateau: { gender: 'm', partFr: 'du gâteau', defFr: 'le gâteau', dr: 'l-gato', ar: 'الگاطو', impliedVerb: 'manger' },
  yaourt: { gender: 'm', partFr: 'un yaourt', defFr: 'le yaourt', dr: 'danone', ar: 'دانون', impliedVerb: 'manger' },
  riz: { gender: 'm', partFr: 'du riz', defFr: 'le riz', dr: 'r-rouz', ar: 'الروز', impliedVerb: 'manger' },
  biscuit: { gender: 'm', partFr: 'un biscuit', defFr: 'le biscuit', dr: 'biskwi', ar: 'بيسكوي', impliedVerb: 'manger' },
  '-uf': { gender: 'm', partFr: 'un œuf', defFr: "l'œuf", dr: 'bida', ar: 'بيضة', impliedVerb: 'manger' },
  oeuf: { gender: 'm', partFr: 'un œuf', defFr: "l'œuf", dr: 'bida', ar: 'بيضة', impliedVerb: 'manger' },
  chips: { gender: 'f', partFr: 'des chips', defFr: 'les chips', dr: 'chips', ar: 'شيبس', impliedVerb: 'manger' },
  fromage: { gender: 'm', partFr: 'du fromage', defFr: 'le fromage', dr: 'l-frmaj', ar: 'الفرماج', impliedVerb: 'manger' },
  pancake: { gender: 'm', partFr: 'un pancake', defFr: 'le pancake', dr: 'pancake', ar: 'بانكيك', impliedVerb: 'manger' },
  mcdo: { gender: 'm', partFr: 'McDo', defFr: 'McDo', dr: 'makdo', ar: 'ماكدو', impliedVerb: 'manger' },
  eau: { gender: 'f', partFr: "de l'eau", defFr: "l'eau", dr: 'l-ma', ar: 'الما', impliedVerb: 'boire' },
  lait: { gender: 'm', partFr: 'du lait', defFr: 'le lait', dr: 'l-7lib', ar: 'الحليب', impliedVerb: 'boire' },
  jus: { gender: 'm', partFr: 'du jus', defFr: 'le jus', dr: 'l-3assir', ar: 'العصير', impliedVerb: 'boire' },
  'coca-cola': { gender: 'm', partFr: 'du Coca', defFr: 'le Coca', dr: 'koka', ar: 'كوكا', impliedVerb: 'boire' },
  trampoline: { gender: 'm', partFr: 'du trampoline', locFr: 'au trampoline', dr: 'f trampoline', ar: 'ف الترامبولين', impliedVerb: 'jouer' },
  ballon: { gender: 'm', partFr: 'le ballon', locFr: 'au ballon', dr: 'b l-kora', ar: 'بالكورة', impliedVerb: 'jouer' },
  tablette: { gender: 'f', partFr: 'la tablette', locFr: 'à la tablette', dr: 'f t-tablette', ar: 'ف الطابليط', impliedVerb: 'jouer' },
  'dessin-anime': { gender: 'm', partFr: 'le dessin animé', defFr: 'le dessin animé', dr: 'r-rassoum', ar: 'الرسوم', impliedVerb: 'regarder' },
  poupee: { gender: 'f', partFr: 'la poupée', locFr: 'à la poupée', dr: 'b l-mouna', ar: 'بالمونة', impliedVerb: 'jouer' },
  musique: { gender: 'f', partFr: 'de la musique', defFr: 'la musique', dr: 'l-mousi9a', ar: 'الموسيقى', impliedVerb: 'ecouter' },
  balancoire: { gender: 'f', partFr: 'de la balançoire', locFr: 'à la balançoire', dr: 'f j-jelloula', ar: 'ف الجلولة', impliedVerb: 'jouer' },
  dehors: { gender: 'm', partFr: 'dehors', locFr: 'dehors', dr: 'berra', ar: 'برا', impliedVerb: 'aller' },
  maison: { gender: 'f', partFr: 'la maison', locFr: 'à la maison', dr: 'l-dar', ar: 'لدار', impliedVerb: 'aller' },
  voiture: { gender: 'f', partFr: 'la voiture', locFr: 'en voiture', dr: 'f t-tomobil', ar: 'ف الطوموبيل', impliedVerb: 'aller' },
  parc: { gender: 'm', partFr: 'le parc', locFr: 'au parc', dr: 'l-jarda', ar: 'للجردة', impliedVerb: 'aller' },
  ecole: { gender: 'f', partFr: "l'école", locFr: "à l'école", dr: 'l-madrasa', ar: 'للمدرسة', impliedVerb: 'aller' },
  bain: { gender: 'm', partFr: 'un bain', locFr: 'au bain', dr: 'l-7ammam', ar: 'للحمام', impliedVerb: 'aller' },
};

function inferImpliedVerbKey(card, key) {
  if (NOUNS[key]?.impliedVerb) return NOUNS[key].impliedVerb;
  if (!card) return null;
  if (card.cat === 'manger') return 'manger';
  if (card.cat === 'boire') return 'boire';
  if (card.cat === 'jouer') return 'jouer';
  if (card.cat === 'lieux') return 'aller';
  return null;
}

const normSlug = (str) => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function cardSlugKey(card) {
  if (!card) return '';
  if (card.id) {
    const parts = card.id.split('-');
    if (parts.length >= 3) return parts.slice(2).join('-');
  }
  return normSlug(card.fr);
}

function fallbackConjugateFr(infinitive, person, tense) {
  const inf = String(infinitive || '').trim().toLowerCase();
  if (tense === 'future') {
    const aller = person === '1s' ? 'vais' : 'va';
    return `${aller} ${inf}`;
  }
  if (inf.endsWith('er') && inf !== 'aller') {
    const stem = inf.slice(0, -2);
    if (tense === 'past') {
      const avoir = person === '1s' ? 'ai' : 'a';
      return `${avoir} ${stem}é`;
    }
    return `${stem}e`;
  }
  return inf;
}

function conjugateVerbFr(vEntry, infFallback, person, tense, afterModal) {
  if (afterModal) return vEntry ? vEntry.infFr : String(infFallback || '').toLowerCase();
  if (!vEntry) return fallbackConjugateFr(infFallback, person, tense);
  if (tense === 'past') {
    const aux = person === '1s' ? 'ai' : 'a';
    return `${aux} ${vEntry.ppFr}`;
  }
  if (tense === 'future') {
    const aller = person === '1s' ? 'vais' : 'va';
    return `${aller} ${vEntry.infFr}`;
  }
  return vEntry.presFr[person] || vEntry.presFr['1s'];
}

function conjugateVerbDr(vEntry, drFallback, person, tense, afterModal, subjectGender = 'f', langMode = 'dr') {
  const isAr = langMode === 'ar';
  if (!vEntry) return drFallback;
  if (afterModal) {
    return isAr ? (vEntry.subAr[person] || vEntry.subAr['1s']) : (vEntry.subDr[person] || vEntry.subDr['1s']);
  }
  if (tense === 'past') {
    return isAr ? (vEntry.pastAr[person] || vEntry.pastAr['1s']) : (vEntry.pastDr[person] || vEntry.pastDr['1s']);
  }
  if (tense === 'future') {
    const futParticle = isAr
      ? (subjectGender === 'f' && person !== '1s' ? 'غادة' : 'غادي')
      : (subjectGender === 'f' && person !== '1s' ? 'ghada' : 'ghadi');
    const sub = isAr ? (vEntry.subAr[person] || vEntry.subAr['1s']) : (vEntry.subDr[person] || vEntry.subDr['1s']);
    return `${futParticle} ${sub}`;
  }
  return isAr ? (vEntry.presAr[person] || vEntry.presAr['1s']) : (vEntry.presDr[person] || vEntry.presDr['1s']);
}

// ---------- 5. Moteur principal d'inflexion contextuelle de la bande de phrase ----------
export function inflectStrip(stripItems = [], { tense = currentTense } = {}) {
  if (!Array.isArray(stripItems) || !stripItems.length) {
    return { tokens: [], sentenceFr: '', sentenceDr: '', sentenceAr: '', displayText: '', speechText: '' };
  }

  let activePerson = '1s';
  let activeGender = childGenderCached === 'boy' ? 'm' : 'f';
  let hasExplicitSubject = false;
  let afterModalWant = false;
  let lastActionVerb = null;
  let lastNounGender = null;

  const tokens = [];
  const frParts = [];
  const drParts = [];
  const arParts = [];

  for (let i = 0; i < stripItems.length; i += 1) {
    const item = stripItems[i];
    const card = item?.card || item;
    const lang = item?.lang || 'fr';
    const key = cardSlugKey(card);
    const nextItem = stripItems[i + 1];
    const nextCard = nextItem?.card || nextItem || null;

    // Cas 1 : Carte Sujet / Personne (Abir/Moi, Papa, Maman, Ghita...)
    if (SUBJECTS[card.id]) {
      const subj = SUBJECTS[card.id];
      const nextIsJeVeux = nextCard && (nextCard.id === 'c-base-je-veux' || cardSlugKey(nextCard) === 'je-veux');
      activePerson = subj.person;
      activeGender = subj.gender();
      hasExplicitSubject = true;
      afterModalWant = false;
      lastNounGender = null;

      // Conserve le sujet tiers (« Maman » + « Je veux » -> « Maman veut... ») ; évite seulement le doublon « Je Je veux »
      const frWord = (nextIsJeVeux && activePerson === '1s') ? '' : subj.fr;
      const drWord = subj.dr;
      const arWord = subj.ar;

      if (frWord) frParts.push(frWord);
      drParts.push(drWord);
      arParts.push(arWord);

      tokens.push({
        card,
        lang,
        displayLabel: lang === 'dr' ? drWord : (frWord || 'Je'),
      });
      continue;
    }

    // Cas 2 : Carte modale « Je veux / Bghit » (avec support complet Hier / Maintenant / Après en FR et Darija)
    if (card.id === 'c-base-je-veux' || key === 'je-veux') {
      afterModalWant = true;
      lastActionVerb = 'want';
      const isThird = hasExplicitSubject && activePerson !== '1s';

      let frModal = isThird ? 'veut' : 'Je veux';
      let drModal = activePerson === '3ms' ? 'bgha' : activePerson === '3fs' ? 'bghat' : 'bghit';
      let arModal = activePerson === '3ms' ? 'بغى' : activePerson === '3fs' ? 'بغات' : 'بغيت';

      if (tense === 'past') {
        frModal = isThird ? 'voulait' : 'Je voulais';
        drModal = activePerson === '3ms' ? 'kan bgha' : activePerson === '3fs' ? 'kanet bghat' : 'kount bghit';
        arModal = activePerson === '3ms' ? 'كان بغى' : activePerson === '3fs' ? 'كانت بغات' : 'كنت بغيت';
      } else if (tense === 'future') {
        frModal = isThird ? 'voudra' : 'Je voudrais';
        drModal = activePerson === '3ms' ? 'ghadi ybghi' : activePerson === '3fs' ? 'ghada tbghi' : 'ghadi nbghi';
        arModal = activePerson === '3ms' ? 'غادي يبغي' : activePerson === '3fs' ? 'غادة تبغي' : 'غادي نبغي';
      }

      hasExplicitSubject = true;
      frParts.push(frModal);
      drParts.push(drModal);
      arParts.push(arModal);

      tokens.push({
        card,
        lang,
        displayLabel: lang === 'dr' ? drModal : frModal,
      });
      continue;
    }

    // Cas 3 : Verbe d'action (Manger, Boire, Jouer, Dormir, Laver...)
    if (card.gram === 'verb' || VERBS[key]) {
      const vEntry = VERBS[key] || null;
      const vFr = conjugateVerbFr(vEntry, card.fr, activePerson, tense, afterModalWant);
      const vDr = conjugateVerbDr(vEntry, card.dr, activePerson, tense, afterModalWant, activeGender, 'dr');
      const vAr = conjugateVerbDr(vEntry, card.ar || card.dr, activePerson, tense, afterModalWant, activeGender, 'ar');

      let fullFrVerb = vFr;
      if (!hasExplicitSubject && !afterModalWant) {
        fullFrVerb = `Je ${vFr}`;
        hasExplicitSubject = true;
      }

      afterModalWant = true;
      lastActionVerb = key;
      lastNounGender = null;

      frParts.push(fullFrVerb);
      drParts.push(vDr);
      arParts.push(vAr);

      tokens.push({
        card,
        lang,
        displayLabel: lang === 'dr' ? vDr : fullFrVerb,
      });
      continue;
    }

    // Cas 4 : Émotion ou Adjectif (avec support complet Hier « J'étais contente / Kount fer7ana » et Après « Je serai contente / Ghadi nkoun fer7ana »)
    if (card.cat === 'emotions' || ADJECTIVES[key]) {
      const adj = ADJECTIVES[key];
      const targetGender = lastNounGender || activeGender;
      if (adj) {
        const adjFr = adj.fr[targetGender] || adj.fr.m;
        const adjDrBase = adj.dr[targetGender] || adj.dr.m;
        const adjArBase = adj.ar[targetGender] || adj.ar.m;

        let phraseFr = adjFr;
        let phraseDr = adjDrBase;
        let phraseAr = adjArBase;

        if (adj.auxType && !lastNounGender && !afterModalWant) {
          const tableFr = adj.auxType === 'avoir' ? COPULA_AVOIR_FR : COPULA_ETRE_FR;
          const copFr = (tableFr[tense] || tableFr.present)[activePerson] || 'suis';
          phraseFr = hasExplicitSubject ? `${copFr} ${adjFr}` : `Je ${copFr} ${adjFr}`;

          const copDr = copulaDrForState(activePerson, targetGender, tense, false);
          const copAr = copulaDrForState(activePerson, targetGender, tense, true);
          const needSubjDr = !hasExplicitSubject && activePerson === '1s' && tense === 'present';
          phraseDr = [needSubjDr ? 'Ana' : '', copDr, adjDrBase].filter(Boolean).join(' ');
          phraseAr = [needSubjDr ? 'أنا' : '', copAr, adjArBase].filter(Boolean).join(' ');
          hasExplicitSubject = true;
        }

        frParts.push(phraseFr);
        drParts.push(phraseDr);
        arParts.push(phraseAr);

        tokens.push({
          card,
          lang,
          displayLabel: lang === 'dr' ? phraseDr : phraseFr,
        });
        continue;
      }
    }

    // Cas 5 : Nom (Aliment, Boisson, Jouet, Lieu) + Insertion automatique du verbe sous-entendu après « Je veux »
    if (card.gram === 'noun' || NOUNS[key]) {
      const nEntry = NOUNS[key] || {};
      lastNounGender = nEntry.gender || 'm';

      let impliedVerbCardId = null;
      let impLabelFr = '';
      let impLabelDr = '';
      if (lastActionVerb === 'want') {
        const impliedKey = inferImpliedVerbKey(card, key);
        const impliedVerb = impliedKey ? VERBS[impliedKey] : null;
        if (impliedVerb) {
          const impFr = impliedVerb.infFr;
          const impDr = impliedVerb.subDr[activePerson] || impliedVerb.subDr['1s'];
          const impAr = impliedVerb.subAr[activePerson] || impliedVerb.subAr['1s'];
          frParts.push(impFr);
          drParts.push(impDr);
          arParts.push(impAr);
          lastActionVerb = impliedKey;
          impliedVerbCardId = impliedVerb.cardId || null;
          impLabelFr = `${impFr} `; // v10.0 : l'étiquette sous la carte montre aussi le verbe ajouté (« manger du pain »)
          impLabelDr = `${impDr} `;
        }
      }

      const isLocativeContext = ['jouer', 'courir', 'sauter', 'dormir', 'aller'].includes(lastActionVerb) && nEntry.locFr;
      const isPartitiveContext = ['want', 'manger', 'boire', 'donner', 'couper', 'ecouter'].includes(lastActionVerb);

      const frNoun = isLocativeContext
        ? nEntry.locFr
        : isPartitiveContext
          ? (nEntry.partFr || nEntry.defFr || card.fr.toLowerCase())
          : (nEntry.defFr || card.fr.toLowerCase());
      const drNoun = nEntry.dr || card.dr;
      const arNoun = nEntry.ar || card.ar || card.dr;

      frParts.push(frNoun);
      drParts.push(drNoun);
      arParts.push(arNoun);

      tokens.push({
        card,
        lang,
        impliedVerbCardId,
        displayLabel: lang === 'dr' ? `${impLabelDr}${drNoun}` : `${impLabelFr}${frNoun}`,
      });
      continue;
    }

    // Cas 6 : Mots sociaux / outils
    const fallbackFr = (card.sayFr || card.fr || '').trim();
    const fallbackDr = (card.dr || card.fr || '').trim();
    const fallbackAr = (card.sayAr || card.ar || card.dr || card.fr || '').trim();
    frParts.push(fallbackFr);
    drParts.push(fallbackDr);
    arParts.push(fallbackAr);
    tokens.push({
      card,
      lang,
      displayLabel: lang === 'dr' ? fallbackDr : fallbackFr,
    });
  }

  const sentenceFr = frParts
    .join(' ')
    .replace(/\bJe\s+([aàeéèêiîoôuùûh])/gi, "J'$1")
    .replace(/\s+/g, ' ')
    .trim();

  const sentenceDr = drParts.join(' ').replace(/\s+/g, ' ').trim();
  const sentenceAr = arParts.join(' ').replace(/\s+/g, ' ').trim();

  return {
    tokens,
    sentenceFr,
    sentenceDr,
    sentenceAr,
    displayText: sentenceFr,
    speechText: sentenceFr,
  };
}

// Alias de compatibilité
export const inflectSentenceStrip = inflectStrip;

// ---------- 6. Barre de temps & Aperçu de phrase conjuguée sous la bande de phrase ----------
export function renderMorphologyBar(stripItems, { lang = 'fr', onTenseChange, onSpeakNatural } = {}) {
  if (!stripItems || !stripItems.length) return null;
  const { sentenceFr, sentenceDr, sentenceAr } = inflectStrip(stripItems, { tense: currentTense });
  const textMain = lang === 'dr' ? `${sentenceDr}  ·  ${sentenceAr}` : sentenceFr;
  const textSub = lang === 'dr' ? `🇫🇷 ${sentenceFr}` : `🇲🇦 ${sentenceDr}`;

  const tenses = [
    ['past', '⏪ Hier'],
    ['present', '⏺️ Maintenant'],
    ['future', '⏩ Après'],
  ];

  return h('div', { class: 'morph-bar' },
    h('div', { class: 'morph-tenses' }, tenses.map(([code, label]) => h('button', {
      type: 'button',
      class: `morph-tense-btn${currentTense === code ? ' active' : ''}`,
      onclick: () => {
        setTense(code);
        if (onTenseChange) onTenseChange(code);
      },
    }, label))),
    h('button', {
      type: 'button',
      class: 'morph-sentence-preview',
      onclick: () => {
        if (onSpeakNatural) onSpeakNatural({ sentenceFr, sentenceDr, sentenceAr, lang });
      },
    },
    h('strong', {}, `✨ ${textMain}`),
    h('small', {}, textSub)));
}
