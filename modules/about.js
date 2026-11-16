// v9.1 : choix du style des images (espace adulte) et « À propos » avec les crédits des ressources libres.
import { h } from './util.js';
import { VISUAL_STYLES, getVisualStyle, setVisualStyle } from './visuals.js';
import { ARASAAC_CREDIT } from './arasaac.js';
import { uiIcon } from './ui-icons.js';
import * as db from '../db.js';
import { SPEECH_SETTING_KEY, isCloudSpeechAllowed, setCloudSpeechAllowed, browserCanRecognizeSpeech } from '../speech.js';

// v9.8 : interrupteur parent pour la reconnaissance de la voix par Google. Éteint par défaut.
export function speechCloudBox() {
  const status = h('p', { class: 'note' });
  const show = () => { status.textContent = isCloudSpeechAllowed()
    ? '🟢 Allumée. Les boutons « Parler (auto) » envoient la voix à Google le temps de la comprendre.'
    : '⚪ Éteinte. Aucun son ne part vers Google. L’adulte note lui-même les réponses.'; };
  show();
  const box = h('input', { type: 'checkbox', checked: isCloudSpeechAllowed(), disabled: !browserCanRecognizeSpeech(),
    onchange: async (e) => { setCloudSpeechAllowed(e.target.checked); await db.setSetting(SPEECH_SETTING_KEY, e.target.checked); show(); } });
  return h('details', { class: 'card-box' },
    h('summary', {}, '🎙️ Reconnaissance automatique de la voix (Google)'),
    h('div', { class: 'stack' },
      h('label', { class: 'check' }, box, ' Autoriser la reconnaissance par Google'),
      status,
      browserCanRecognizeSpeech() ? null : h('p', { class: 'note' }, 'Ce navigateur ne propose pas cette fonction.'),
      h('p', { class: 'note' }, 'Les enregistrements faits avec 🎙️ « Enregistrer » restent toujours dans le téléphone.')));
}

export function visualStyleBox() {
  const note = h('p', { class: 'note' }, 'Les vraies photos et les images ARASAAC choisies passent toujours en premier. Les visages des émotions et les portraits restent dessinés.');
  const choices = VISUAL_STYLES.map((style) => h('label', { class: 'check' },
    h('input', { type: 'radio', name: 'visual-style', value: style.id, checked: getVisualStyle() === style.id,
      onchange: async () => { await setVisualStyle(style.id); note.textContent = 'Style changé ✔ Les images des cartes sont mises à jour.'; } }),
    ` ${style.label}`));
  return h('details', { class: 'card-box' },
    h('summary', {}, '🖼️ Style visuel des cartes'),
    h('div', { class: 'stack' }, ...choices, note));
}

const CREDITS = [
  ['Police Atkinson Hyperlegible Next', 'Braille Institute, projet Atkinson Hyperlegible Next', 'SIL Open Font License 1.1', 'https://github.com/googlefonts/atkinson-hyperlegible-next'],
  ['Pictogrammes Mulberry Symbols', 'Steve Lee', 'CC BY-SA 4.0', 'https://mulberrysymbols.org'],
  ['Émojis OpenMoji', 'HfG Schwäbisch Gmünd et contributeurs', 'CC BY-SA 4.0', 'https://openmoji.org'],
  ['Icônes Lucide', 'Lucide Icons et contributeurs', 'ISC', 'https://lucide.dev'],
  ['Lexique darija (DODa)', 'Aissam Outchakoucht et Hamza Es-Samaali', 'CC BY-NC 4.0 (usage non commercial)', 'https://github.com/darija-open-dataset/dataset'],
  ['Pictogrammes ARASAAC (en ligne, au choix)', 'Sergio Palao, Gouvernement d’Aragon', 'CC BY-NC-SA 4.0', 'https://arasaac.org'],
  ['Voix livrées des cartes', 'voix Éloïse et Mouna (Microsoft), fabriquées une fois sur le PC et rangées dans l’app', '', ''],
];

export function aboutBox() {
  return h('details', { class: 'card-box about' },
    h('summary', {}, h('span', { class: 'ui-icon-wrap', html: uiIcon('info') }), ' À propos et crédits'),
    h('div', { class: 'stack' },
      h('p', {}, 'Kalimati est gratuite et sans publicité. Photos, voix enregistrées et essais restent dans ce téléphone.'),
      h('p', { class: 'note' }, '🌐 Deux exceptions, seulement si vous les utilisez : la reconnaissance automatique de la voix (éteinte par défaut, à allumer dans « Progrès ») passe par Google ; la recherche d’images ARASAAC envoie le mot cherché au site ARASAAC.'),
      h('p', { class: 'note' }, 'Les images et la police sont rangées dans l’application : elles marchent sans internet.'),
      h('ul', { class: 'credits' }, CREDITS.map(([what, who, licence, url]) => h('li', {},
        h('strong', {}, what), ` : ${who}.${licence ? ` Licence : ${licence}.` : ''}`, url ? [' ', h('a', { href: url, target: '_blank', rel: 'noopener' }, 'Site')] : null))),
      h('p', { class: 'note' }, 'Modifications : pictogrammes et émojis seulement choisis et affichés dans les cartes. Les images sous CC BY-SA restent partageables aux mêmes conditions.'),
      h('p', { class: 'note' }, 'Le lexique darija vient d’un jeu de données ouvert. Faites-le relire par une personne qui parle darija.'),
      h('p', { class: 'note' }, ARASAAC_CREDIT)));
}
