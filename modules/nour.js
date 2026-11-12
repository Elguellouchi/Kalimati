import { renderVisual } from './visuals.js';
import { firstName } from './aba.js';

// Ancienne mascotte (loutre dessinée), gardée en secours ; l'app affiche désormais Abir elle-même (nour()).
// La petite loutre de mer (sans nom) qui encourage Abir : SVG plat, formes rondes, aucun clignotement.
// Pelage caramel clair, museau crème, robe turquoise, petit sac à dos jaune, casque anti-bruit bleu autour du cou.

const C = {
  fur: '#D9A066', furDark: '#C08850', muzzle: '#F6E6CC', dress: '#4FC3B8',
  bag: '#F2C94C', phones: '#5B8DEF', ink: '#4A3426', cheek: '#F4A9A0',
};

function arms(pose) {
  if (pose === 'wave') {
    return `<ellipse cx="30" cy="98" rx="7" ry="12" fill="${C.fur}" transform="rotate(25 30 98)"/>
      <ellipse cx="94" cy="70" rx="7" ry="13" fill="${C.fur}" transform="rotate(-150 94 82)"/>`;
  }
  if (pose === 'brush') {
    return `<ellipse cx="30" cy="98" rx="7" ry="12" fill="${C.fur}" transform="rotate(25 30 98)"/>
      <ellipse cx="80" cy="74" rx="7" ry="12" fill="${C.fur}" transform="rotate(-60 80 74)"/>
      <rect x="62" y="58" width="22" height="5" rx="2.5" fill="#7FB3E6"/><rect x="60" y="55" width="6" height="8" rx="2" fill="#fff"/>`;
  }
  return `<ellipse cx="30" cy="98" rx="7" ry="12" fill="${C.fur}" transform="rotate(25 30 98)"/>
    <ellipse cx="90" cy="98" rx="7" ry="12" fill="${C.fur}" transform="rotate(-25 90 98)"/>`;
}

function legs(pose) {
  if (pose === 'sit') {
    return `<ellipse cx="60" cy="124" rx="34" ry="9" fill="${C.furDark}"/>
      <ellipse cx="44" cy="124" rx="9" ry="5" fill="${C.muzzle}"/><ellipse cx="76" cy="124" rx="9" ry="5" fill="${C.muzzle}"/>`;
  }
  return `<ellipse cx="48" cy="126" rx="11" ry="6" fill="${C.furDark}"/><ellipse cx="72" cy="126" rx="11" ry="6" fill="${C.furDark}"/>`;
}

const bubbles = `<g class="nour-bubbles">
  <circle cx="86" cy="50" r="5" fill="none" stroke="#7FC8E8" stroke-width="2"/>
  <circle cx="98" cy="38" r="7" fill="none" stroke="#7FC8E8" stroke-width="2"/>
  <circle cx="108" cy="22" r="9" fill="none" stroke="#7FC8E8" stroke-width="2"/>
</g>`;

// pose : 'stand' | 'sit' | 'wave' | 'brush' | 'bubbles'
export function nourSvg({ pose = 'stand', size = 120, label = 'La petite loutre' } = {}) {
  const mouth = pose === 'bubbles'
    ? `<ellipse cx="60" cy="61" rx="3.5" ry="3" fill="${C.ink}"/>`
    : `<path d="M54 60 q6 5 12 0" stroke="${C.ink}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  return `<svg class="nour nour-${pose}" viewBox="0 0 120 140" width="${size}" height="${Math.round(size * 7 / 6)}" role="img" aria-label="${label}">
  <path d="M86 116 q26 -2 28 -24 q-12 12 -30 12z" fill="${C.furDark}"/>
  ${legs(pose)}
  <path d="M30 122 q-4 -42 30 -50 q34 8 30 50 q-30 6 -60 0z" fill="${C.dress}"/>
  <rect x="86" y="84" width="16" height="24" rx="7" fill="${C.bag}"/>
  <path d="M44 80 l5 30 M76 80 l-5 30" stroke="${C.bag}" stroke-width="5" stroke-linecap="round"/>
  ${arms(pose)}
  <path d="M38 75 q22 14 44 0" stroke="${C.phones}" stroke-width="6" fill="none" stroke-linecap="round"/>
  <circle cx="36" cy="75" r="8" fill="${C.phones}"/><circle cx="84" cy="75" r="8" fill="${C.phones}"/>
  <circle cx="34" cy="28" r="7" fill="${C.furDark}"/><circle cx="86" cy="28" r="7" fill="${C.furDark}"/>
  <ellipse cx="60" cy="48" rx="30" ry="27" fill="${C.fur}"/>
  <ellipse cx="60" cy="58" rx="17" ry="12" fill="${C.muzzle}"/>
  <circle cx="49" cy="44" r="3.6" fill="${C.ink}"/><circle cx="71" cy="44" r="3.6" fill="${C.ink}"/>
  <circle cx="50.2" cy="42.8" r="1.1" fill="#fff"/><circle cx="72.2" cy="42.8" r="1.1" fill="#fff"/>
  <circle cx="41" cy="56" r="4" fill="${C.cheek}" opacity=".55"/><circle cx="79" cy="56" r="4" fill="${C.cheek}" opacity=".55"/>
  <ellipse cx="60" cy="53" rx="5" ry="3.5" fill="${C.ink}"/>
  ${mouth}
  ${pose === 'bubbles' ? bubbles : ''}
</svg>`;
}

// Bulles seules (écho vocal) : posées à côté de la photo d'Abir.
const bubblesOnly = `<svg class="bubbles-overlay" viewBox="76 10 44 50" aria-hidden="true">${bubbles}</svg>`;

// Le compagnon de l'app = Abir elle-même (demande d'Aziz, 12/11) : sa vraie photo si le parent l'a mise
// (carte « Abir », 📷 ou « Nos vraies photos »), sinon son portrait dessiné. La photo reste dans le téléphone.
export function nour({ pose = 'stand', size = 120, says = '' } = {}) {
  const box = document.createElement('div');
  box.className = 'nour-box';
  const picture = renderVisual({ vkey: 'person:abir', label: firstName() }, { cls: 'buddy' });
  picture.style.setProperty('--vs', `${size}px`);
  box.append(picture);
  if (pose === 'bubbles') picture.insertAdjacentHTML('beforeend', bubblesOnly);
  if (says) {
    const bubble = document.createElement('p');
    bubble.className = 'nour-says';
    bubble.textContent = says;
    box.append(bubble);
  }
  return box;
}

// Pour l'écho vocal : la taille des bulles suit le volume de la voix d'Abir (0..1).
export function setBubbleLevel(box, level) {
  const group = box.querySelector('.nour-bubbles');
  if (!group) return;
  const value = Math.max(0.15, Math.min(1, level * 1.6));
  group.style.opacity = String(value);
  group.style.transform = `scale(${0.7 + value * 0.5})`;
}
