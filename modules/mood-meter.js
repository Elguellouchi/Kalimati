// v10.23 (pépites 6 et 4) : le quadrillage des émotions et le tableau de coping qui va avec.
// Deux axes simples, dessinés avec les couleurs déjà utilisées pour les visages (Zones of Regulation) :
//   en haut  = mon corps est réveillé   /  en bas = mon corps est posé
//   à gauche = c'est difficile          /  à droite = c'est agréable
// L'enfant touche une case, puis choisit une stratégie : « Quand je suis [En colère], je peux [Boire de l’eau] ».
// Règle clinique : ce studio ne note aucun essai, ne donne ni point ni chrono. Sentir n'est pas un exercice.
import { h } from './util.js';
import { speak } from '../speech.js';
import { EMOTIONS, ZONE, renderVisual } from './visuals.js';
import { COPING_CHOICES } from './ex-schedule.js';
import { praise } from './widgets.js';
import { tx } from './section-i18n.js';

// id = la couleur de la zone ; key = le libellé traduit ; emotions = les visages rangés dans la case.
export const MOOD_QUADRANTS = [
  { id: 'yellow', key: 'moodYellow', emotions: ['content', 'fier'] },
  { id: 'red', key: 'moodRed', emotions: ['colere', 'peur'] },
  { id: 'green', key: 'moodGreen', emotions: ['calme'] },
  { id: 'blue', key: 'moodBlue', emotions: ['triste', 'fatigue', 'mal'] },
];

export const emotionsOf = (quadrant) => quadrant.emotions
  .map((id) => EMOTIONS.find((e) => e.id === id)).filter(Boolean);

// Chaque case doit avoir au moins un visage et au moins une stratégie : vérifié par tools/test-pepites.mjs.
export const copingFor = (quadrant) => COPING_CHOICES.filter((c) => (c[5] || []).includes(quadrant.id));

export function moodMeterView(ctx, { wordOf }) {
  const lang = ctx.lang;
  let picked = null;
  const after = h('div', { class: 'stack' });
  const cells = MOOD_QUADRANTS.map((quadrant) => {
    const cell = h('button', {
      type: 'button',
      class: `mood-cell mood-${quadrant.id}`,
      style: { background: ZONE[quadrant.id] },
      'aria-label': tx(quadrant.key, lang),
      onclick: () => {
        picked = quadrant;
        cells.forEach((c) => c.classList.toggle('on', c === cell));
        speak(tx(quadrant.key, lang));
        drawCoping();
      },
    },
    h('span', { class: 'mood-name' }, tx(quadrant.key, lang)),
    h('span', { class: 'faces' }, emotionsOf(quadrant).map((e) => renderVisual({ vkey: e.vkey, label: wordOf(e) }, { button: false }))));
    return cell;
  });
  const drawCoping = () => {
    if (!picked) return;
    const words = emotionsOf(picked).map((e) => wordOf(e)).join(' / ');
    const choices = copingFor(picked);
    after.replaceChildren(
      h('div', { class: 'card-box' },
        h('h3', {}, tx('moodCoping', lang, { word: words })),
        h('div', { class: 'mood-coping' }, choices.map((c) => h('button', {
          type: 'button',
          class: 'choice',
          onclick: (e) => {
            const text = lang === 'dr' ? c[2] : c[1];
            speak(text);
            after.replaceChildren(praise(tx('moodChosen', lang)),
              h('div', { class: 'row center' }, btnBack()));
          },
        }, h('span', { class: 'emoji' }, c[0]), h('span', { class: 'label' }, lang === 'dr' ? c[2] : c[1]))))),
      h('div', { class: 'row center' }, btnBack()));
  };
  const btnBack = () => h('button', { type: 'button', class: 'btn ghost tiny', onclick: () => { picked = null; cells.forEach((c) => c.classList.remove('on')); after.replaceChildren(); } }, tx('moodBack', lang));
  return h('div', { class: 'stack mood-box' },
    h('h2', {}, tx('moodTitle', lang)),
    h('p', { class: 'ask' }, tx('moodAsk', lang)),
    h('div', { class: 'mood-meter' }, cells),
    h('p', { class: 'note' }, tx('moodAxes', lang)),
    after,
    h('p', { class: 'note' }, tx('moodNote', lang)));
}
