// v10.23 (Sprint 1) : le moteur tactile central. Un seul endroit décide si un toucher est un vrai choix,
// pour que le tableau CAA, la barre des mots rapides, le quadrillage des émotions et les jeux appliquent
// exactement les mêmes règles (appui suffisant, doigt qui ne glisse pas, pas de double toucher).
// Les règles viennent des réglages du parent (modules/aac-plus.js) : rien n'est imposé à l'enfant.
import { trackPress, touchAllowed, steadyHandEnabled, TREMOR_PX } from './aac-plus.js';

// Deux touchers collés sur la même chose = un seul choix.
export const TAP_COOLDOWN_MS = 400;

let lastTap = { key: null, at: 0 };

export const resetTapMemory = () => { lastTap = { key: null, at: 0 }; };

// pressMs : durée de l'appui (Number.MAX_SAFE_INTEGER si on ne l'a pas mesuré, ex. balayage à la souris).
// movedPx : distance parcourue par le doigt entre l'appui et le relâchement.
export function acceptTap({ key, pressMs = Number.MAX_SAFE_INTEGER, movedPx = 0, debounceMs = TAP_COOLDOWN_MS } = {}) {
  if (!touchAllowed(pressMs)) return false;
  if (steadyHandEnabled() && movedPx > TREMOR_PX) return false;
  const now = performance.now();
  const tapKey = key === undefined || key === null ? 'default' : key;
  if (tapKey === lastTap.key && now - lastTap.at < debounceMs) return false;
  lastTap = { key: tapKey, at: now };
  return true;
}

// Le retour visuel du toucher : la carte palpite, l'enfant voit que c'est bien lui qui a agi.
export function tapFeedback(el, ms = TAP_COOLDOWN_MS) {
  if (!el) return;
  el.classList.remove('pressed');
  void el.offsetWidth;
  el.classList.add('pressed', 'card-just-tapped');
  clearTimeout(el._tapFeedbackTimer);
  el._tapFeedbackTimer = setTimeout(() => el.classList.remove('card-just-tapped'), ms);
}

// Le même garde-fou branché sur n'importe quel élément : une carte, une vignette, un bouton de jeu.
// skip : fonction qui, quand elle répond vrai, laisse passer le toucher sans filtre (mode adulte).
export function bindTap(el, onPick, { key = null, debounceMs = TAP_COOLDOWN_MS, onRejected = null, skip = null } = {}) {
  const press = trackPress(el);
  el.addEventListener('click', () => {
    const pressMs = press();
    if (typeof skip === 'function' && skip()) return onPick(pressMs);
    if (acceptTap({ key: key ?? el.dataset.cardId ?? el, pressMs, movedPx: el._movedPx || 0, debounceMs })) return onPick(pressMs);
    if (typeof onRejected === 'function') onRejected();
  });
  return el;
}
