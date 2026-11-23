// v10.23 (pépite 1) : le binôme de langues « sans friction ».
// Le parent choisit deux langues (ex. darija à la maison / français à l'école). L'enfant voit les deux
// mots sur la même carte et bascule de l'une à l'autre en un seul toucher.
// Règle clinique : les cartes ne bougent JAMAIS. Le plan moteur (gridRow/gridCol) ne dépend que de l'id
// de la carte, donc changer de langue ne déplace rien — c'est tout l'intérêt du code-switching précoce.
import { langInfo } from './languages.js';
import * as db from '../db.js';

export const TWIN_SETTING_KEY = 'twinLang';

// Une valeur lue du stockage n'est jamais de confiance : on ne garde qu'un vrai binôme de deux langues connues et distinctes.
export function normalizeTwin(saved) {
  const a = langInfo(saved && saved.a).code;
  const b = langInfo(saved && saved.b).code;
  if (!saved || !saved.a || !saved.b || a === b) return null;
  return { a, b };
}

export const twinEnabled = (twin) => Boolean(twin);

// Les deux langues du binôme, dans l'ordre choisi par le parent.
export const twinPair = (twin) => (twin ? [twin.a, twin.b] : []);

// L'autre langue du binôme par rapport à la langue parlée. Si l'enfant est sorti du binôme (troisième langue
// choisie dans le sélecteur), on retombe sur la première langue de la maison : le mot jumeau reste utile.
export const twinOf = (twin, lang) => (twin ? (lang === twin.a ? twin.b : twin.a) : null);

// Langue vers laquelle basculer d'un seul toucher (le bouton de la bande de phrase).
export const twinSwap = (twin, lang) => (twin ? twinOf(twin, lang) : lang);

// La seconde langue la plus probable pour une famille : la langue de l'école si la maison parle darija, sinon la darija.
export const suggestPartner = (lang) => (lang === 'fr' ? 'dr' : 'fr');

export const loadTwin = async () => normalizeTwin(await db.getSetting(TWIN_SETTING_KEY).catch(() => null));
export const saveTwin = (twin) => db.setSetting(TWIN_SETTING_KEY, twin ? { a: twin.a, b: twin.b } : null);
