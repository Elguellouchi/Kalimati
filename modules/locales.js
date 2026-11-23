// v10.21 — Lot 1 : accès aux fichiers locales/<lang>.json (une langue = un fichier, source de vérité).
// Le paquet modules/locales-data.js est fabriqué par tools/build-locales.mjs : rien à télécharger,
// tout est dans l'appli (100 % hors-ligne). Le lexique est repéré par l'identifiant technique
// de la carte (cardId), jamais par le texte français : renommer un mot ne casse plus sa traduction.
import { LOCALES, LOCALE_META } from './locales-data.js';

export const LOCALE_CODES = Object.keys(LOCALES);
export const localeMeta = (code) => LOCALE_META[code] || LOCALE_META.fr;
export const localeUiTable = (code) => (LOCALES[code] && LOCALES[code].ui) || {};
export const localeUi = (key, code) => localeUiTable(code)[key] ?? LOCALES.fr.ui[key];
export const localeCategories = (code) => (LOCALES[code] && LOCALES[code].categories) || [];
export const localeLexicon = (code) => (LOCALES[code] && LOCALES[code].lexicon) || {};

// v10.22 (Lot 2) : une entrée de lexique peut être une simple chaîne (compat) ou un objet
// { label, tts, gender, classifier }. « label » = mot affiché ; « tts » = forme prononcée par
// la voix du téléphone (ex. arabe vocalisé avec les harakat, que la voix lit sans se tromper).
export const localeWord = (code, cardId) => {
  const entry = localeLexicon(code)[cardId];
  if (entry == null) return undefined;
  return typeof entry === 'string' ? entry : (entry.label ?? entry.tts ?? undefined);
};
export const localeTtsText = (code, cardId) => {
  const entry = localeLexicon(code)[cardId];
  if (entry == null) return undefined;
  return typeof entry === 'string' ? entry : (entry.tts ?? entry.label ?? undefined);
};
export const localeHasWord = (code, cardId) => Object.prototype.hasOwnProperty.call(localeLexicon(code), cardId);
