// v10.21 — Lot 1 : accès aux fichiers locales/<lang>.json (une langue = un fichier, source de vérité).
// Le paquet modules/locales-data.js est fabriqué par tools/build-locales.mjs : rien à télécharger,
// tout est dans l'appli (100 % hors-ligne). Le lexique est repéré par l'identifiant technique
// de la carte (cardId), jamais par le texte français : renommer un mot ne casse plus sa traduction.
import { LOCALES, LOCALE_META } from './locales-data.js';

export const LOCALE_CODES = Object.keys(LOCALES);
export const localeMeta = (code) => LOCALE_META[code] || LOCALE_META.fr;
export const localeUiTable = (code) => (LOCALES[code] && LOCALES[code].ui) || {};
// v10.24 : la darija tient dans deux écritures (« ui » en lettres arabes, « uiLatin » en lettres
// latines). C'est languages.js, qui connaît le réglage parent, qui passe « script » ; les autres
// langues n'ont qu'une écriture et gardent donc le même résultat qu'avant.
export const localeUi = (key, code, script) => {
  const arab = localeUiTable(code);
  const latin = (LOCALES[code] && LOCALES[code].uiLatin) || {};
  const chosen = script === 'latin' ? (latin[key] ?? arab[key]) : (arab[key] ?? latin[key]);
  return chosen ?? LOCALES.fr.ui[key];
};
export const localeCategories = (code, script) => {
  const arab = (LOCALES[code] && LOCALES[code].categories) || [];
  const latin = (LOCALES[code] && LOCALES[code].categoriesLatin) || [];
  return script === 'latin' ? (latin.length ? latin : arab) : (arab.length ? arab : latin);
};
export const localeLexicon = (code) => (LOCALES[code] && LOCALES[code].lexicon) || {};

// v10.22 (Lot 2) : une entrée de lexique peut être une simple chaîne (compat) ou un objet
// { label, tts, gender, classifier }. « label » = mot affiché ; « tts » = forme prononcée par
// la voix du téléphone (ex. arabe vocalisé avec les harakat, que la voix lit sans se tromper).
// v10.40 (Lot 2.2) : accord avec l'enfant. « gender » peut valoir :
//   - 'm' / 'f' : genre du mot lui-même (un nom) ;
//   - { m, f } : deux formes selon l'enfant qui parle (« Cansado » / « Cansada »).
//     Chaque forme est une chaîne, ou { label, tts } (arabe : mot affiché + forme vocalisée).
let childGender = 'girl';
export const setLocaleChildGender = (g) => { childGender = g === 'boy' ? 'boy' : 'girl'; };
export const localeChildGender = () => childGender;
const pickForm = (entry) => {
  if (!entry || typeof entry !== 'object' || !entry.gender || typeof entry.gender !== 'object') return entry;
  const form = entry.gender[childGender === 'boy' ? 'm' : 'f'];
  if (form == null) return entry;
  return typeof form === 'string' ? { ...entry, label: form, tts: form } : { ...entry, ...form };
};
export const localeWord = (code, cardId) => {
  const entry = pickForm(localeLexicon(code)[cardId]);
  if (entry == null) return undefined;
  return typeof entry === 'string' ? entry : (entry.label ?? entry.tts ?? undefined);
};
export const localeTtsText = (code, cardId) => {
  const entry = pickForm(localeLexicon(code)[cardId]);
  if (entry == null) return undefined;
  return typeof entry === 'string' ? entry : (entry.tts ?? entry.label ?? undefined);
};
export const localeEntry = (code, cardId) => pickForm(localeLexicon(code)[cardId]);
export const localeHasWord = (code, cardId) => Object.prototype.hasOwnProperty.call(localeLexicon(code), cardId);
