// v10.38 (pépite « Tracé multisensoriel », Starfall) : pendant le tracé au doigt, un son doux et continu
// suit le doigt (plus aigu en haut, plus grave en bas), et le son de la lettre est dit quand le doigt
// entre dans une lettre. Volume faible, coupé en mode calme. Aucun enregistrement, rien n'est envoyé.
import { isCalmModeAudio } from '../media.js';
import { speak } from '../speech.js';

// Sons à dire pour chaque lettre (le son de la lettre, pas son nom : « mmm », pas « èm »).
export const LETTER_SOUNDS = {
  a: 'a', b: 'beu', c: 'keu', d: 'deu', e: 'eu', f: 'ffff', g: 'gueu', h: 'hache', i: 'i', j: 'jeu', k: 'keu', l: 'llll',
  m: 'mmmm', n: 'nnnn', o: 'o', p: 'peu', q: 'keu', r: 'rrrr', s: 'ssss', t: 'teu', u: 'u', v: 'vvvv', w: 'oua', x: 'ks', y: 'i', z: 'zzzz',
};
export const letterSound = (letter) => LETTER_SOUNDS[String(letter || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')] || '';
// Hauteur du son : 220 Hz en bas de la case, 440 Hz en haut.
export const pitchFor = (yRatio) => Math.round(440 - 220 * Math.max(0, Math.min(1, yRatio)));

let ctx = null; let osc = null; let gain = null;
export function humStart() {
  if (isCalmModeAudio()) return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = ctx || new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    humStop();
    osc = ctx.createOscillator(); gain = ctx.createGain();
    osc.type = 'sine'; osc.frequency.value = 330;
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
  } catch { osc = null; }
}
export function humMove(yRatio) {
  if (!osc || !ctx) return;
  try { osc.frequency.setTargetAtTime(pitchFor(yRatio), ctx.currentTime, 0.05); } catch { /* rien */ }
}
export function humStop() {
  if (!osc || !ctx) return;
  const o = osc; const g = gain; osc = null; gain = null;
  try { g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); o.stop(ctx.currentTime + 0.25); } catch { /* rien */ }
}
export function sayLetter(letter) {
  const said = letterSound(letter);
  if (said && !isCalmModeAudio()) speak(said, { lang: 'fr', rate: 0.75 });
}
