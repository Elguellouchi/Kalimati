// v10.21 — Lot 1 : plus de tableau français « pivot ». Chaque langue a son fichier locales/<lang>.json
// (menus « ui », « categories », « lexicon »), chargé hors-ligne par modules/locales.js.
// Le lexique est repéré par l'identifiant technique de la carte (cardId) : « c-base-je-veux ».
// Le français et la darija restent portés par la carte (le parent les modifie) ; l'amazigh garde son
// lexique relu à la main dans modules/amazigh-lexicon.js (tifinagh + latin, 4 variétés séparées).
// Un mot amazigh sans voix sur le téléphone reste muet : jamais de lecture française approximative.

import { amazighEntry, hasAmazighWord } from './amazigh-lexicon.js';
import { localeCategories, localeHasWord, localeTtsText, localeUi, localeWord } from './locales.js';

export const AMAZIGH_LANGS = ['shi', 'tzm', 'rif', 'zgh'];
export const isAmazighLang = (code) => AMAZIGH_LANGS.includes(code);
export const AMAZIGH_SCRIPTS = [
  { id: 'both', label: 'Tifinagh + Latin (ⵜⴰⵎⴰⵣⵉⵖⵜ · Tamazight)' },
  { id: 'latin', label: 'Latin seul (Tamazight)' },
  { id: 'tifinagh', label: 'Tifinagh seul (ⵜⴰⵎⴰⵣⵉⵖⵜ)' },
];
export const isAmazighScript = (mode) => AMAZIGH_SCRIPTS.some((opt) => opt.id === mode);

// Affiche un mot amazigh selon l'écriture choisie : « Aɣrum · ⴰⵖⵔⵓⵎ », « Aɣrum » ou « ⴰⵖⵔⵓⵎ ».
export function formatAmazighText({ tif = '', lat = '' } = {}, scriptMode = 'both') {
  const t = String(tif || '').trim();
  const l = String(lat || '').trim();
  if (scriptMode === 'tifinagh') return t || l;
  if (scriptMode === 'latin') return l || t;
  if (t && l && t !== l) return `${l} · ${t}`;
  return l || t;
}

// Liste d'affichage : drapeaux et sous-titres (les noms et codes TTS viennent des locales, vérifiés par les tests).
export const LANGS = [
  { code: 'fr', short: 'FR', name: 'Français', flag: '🇫🇷', tts: 'fr-FR' },
  { code: 'dr', short: 'DR', name: 'Darija', flag: '🇲🇦', tts: 'ar-MA' },
  { code: 'ar', short: 'ع', name: 'العربية', flag: '🌙', tts: 'ar-SA', rtl: true },
  { code: 'en', short: 'EN', name: 'English', flag: '🇬🇧', tts: 'en-GB' },
  { code: 'es', short: 'ES', name: 'Español', flag: '🇪🇸', tts: 'es-ES' },
  { code: 'de', short: 'DE', name: 'Deutsch', flag: '🇩🇪', tts: 'de-DE' },
  { code: 'it', short: 'IT', name: 'Italiano', flag: '🇮🇹', tts: 'it-IT' },
  { code: 'pt', short: 'PT', name: 'Português', flag: '🇵🇹', tts: 'pt-PT' },
  { code: 'nl', short: 'NL', name: 'Nederlands', flag: '🇳🇱', tts: 'nl-NL' },
  { code: 'tr', short: 'TR', name: 'Türkçe', flag: '🇹🇷', tts: 'tr-TR' },
  { code: 'zh', short: '中', name: '中文', flag: '🇨🇳', tts: 'zh-CN' },
  { code: 'shi', short: 'SHI', name: 'Tachelhit', sub: 'Souss & Anti-Atlas · ⵜⴰⵛⵍⵃⵉⵜ', flag: 'ⵣ', tts: 'shi', amazigh: true },
  { code: 'tzm', short: 'TZM', name: 'Tamazight', sub: 'Moyen & Haut Atlas · ⵜⴰⵎⴰⵣⵉⵖⵜ', flag: 'ⵣ', tts: 'tzm', amazigh: true },
  { code: 'rif', short: 'RIF', name: 'Tarifit', sub: 'Rif & Oriental · ⵜⴰⵔⵉⴼⵉⵜ', flag: 'ⵣ', tts: 'rif', amazigh: true },
  { code: 'zgh', short: 'ZGH', name: 'Tamazight IRCAM', sub: 'Standard scolaire · ⵜⴰⵎⴰⵣⵉⵖⵜ', flag: 'ⵣ', tts: 'zgh', amazigh: true },
];

export const langInfo = (code) => LANGS.find((l) => l.code === code) || LANGS[0];
// Langues traduites par un fichier locales/<lang>.json dédié (le français et la darija utilisent les champs des cartes).
const COLUMNS = ['ar', 'en', 'es', 'de', 'it', 'pt', 'nl', 'tr', 'zh'];
export const isExtraLang = (code) => COLUMNS.includes(code);
// Ordre des catégories, identique à celui des tableaux « categories » de locales/<lang>.json.
const CATEGORY_ORDER = ['base', 'manger', 'boire', 'jouer', 'actions', 'personnes', 'besoins', 'emotions', 'decrire', 'lieux'];

// Mot d'une carte dans une langue. Carte « Moi » du profil : le prénom reste, « Moi » est traduit.
export function cardWord(card, code, { scriptMode = 'both' } = {}) {
  if (code === 'dr') return card.dr || card.fr;
  if (isAmazighLang(code)) {
    const own = card[code];
    if (own && typeof own === 'object') return formatAmazighText(own, scriptMode) || card.fr;
    const lex = amazighEntry(card.fr, code);
    return (lex && formatAmazighText(lex, scriptMode)) || card.fr;
  }
  if (code === 'fr') return card.fr;
  const found = localeWord(code, card.id);
  if (found) return found;
  const self = /^(.*)\(Moi\)\s*$/.exec(card.fr || '');
  if (self) {
    const moi = localeWord(code, 'c-personnes-moi');
    if (moi) return `${self[1].trim()} (${moi})`;
  }
  return card.fr;
}
// Vrai si la carte a une traduction (sinon elle est dite en français).
export const hasWord = (card, code) => {
  if (isAmazighLang(code)) return Boolean((card[code] && typeof card[code] === 'object') || hasAmazighWord(card.fr, code));
  return !isExtraLang(code) || localeHasWord(code, card.id) || /\(Moi\)\s*$/.test(card.fr || '');
};

// v10.22 (Lot 2) : forme prononcée par la voix du téléphone. Le mot affiché peut différer de la forme
// dite : l'arabe s'affiche sans les harakat (« خبز ») mais se dit vocalisé (« خُبْز »), ce que la voix du
// téléphone lit sans se tromper. Repli sur le mot affiché si la locale ne donne pas de forme vocale.
export function cardSpeechText(card, code) {
  if (isExtraLang(code)) return localeTtsText(code, card.id) || cardWord(card, code);
  return cardWord(card, code);
}

// ---------- Catégories et menus ----------
export function categoryName(category, code) {
  if (code === 'dr') return category.dr || category.fr;
  const i = CATEGORY_ORDER.indexOf(category.id);
  const names = localeCategories(code);
  return (i >= 0 && names[i]) || category.fr;
}

export const ui = (key, code) => localeUi(key, code);
// Texte à dire avec la voix du téléphone pour un menu. Pas de voix amazighe sur les téléphones :
// l'amazigh garde « Azul » (lu correctement en français) et dit le reste en français plutôt que de
// prononcer du tifinagh avec un accent faux.
export function spokenUi(key, code) {
  if (isAmazighLang(code)) return { text: key === 'hello' ? 'Azul' : localeUi(key, 'fr'), lang: 'fr' };
  return { text: ui(key, code), lang: isExtraLang(code) ? code : 'fr' };
}
