// v10.38 (pépites « Parcours gamifié » Maharat Tifl et « Feedback gamifié » Stug) :
// un chemin en 5 étapes, du souffle aux mots : 1 souffle, 2 voix longue, 3 voyelles, 4 syllabes, 5 petits mots.
// La voix (ou le souffle) de l'enfant gonfle un ballon à l'écran. Le micro sert seulement à mesurer le volume
// pendant l'exercice : rien n'est enregistré, rien n'est envoyé. Sans micro, l'adulte gonfle le ballon d'un toucher.
// L'étape suivante s'ouvre quand l'adulte note « Réussi » 3 fois (rien n'est jamais bloqué pour l'adulte).
import * as db from '../db.js';
import { h, btn } from './util.js';
import { speak, stopSpeaking } from '../speech.js';
import { playClap, startListening } from '../media.js';

import { PATH_SETTING_KEY, WINS_TO_OPEN, PATH_STEPS, cleanPath, isOpen, nextBalloon } from './ortho-path-data.js';

export { PATH_STEPS, cleanPath, isOpen, nextBalloon };

export function orthoPathWorkshop(ctx) {
  const lang = ctx.lang || 'fr';
  let path = cleanPath(null);
  let stepIndex = 0; let targetIndex = 0; let size = 0; let stopMic = null; let raf = 0;
  const root = h('div', { class: 'stack ortho-path' });
  const stopListeningNow = async () => {
    cancelAnimationFrame(raf);
    if (stopMic) { const s = stopMic; stopMic = null; try { await s(); } catch { /* micro déjà fermé */ } }
  };
  ctx.onCleanup(() => { stopListeningNow(); stopSpeaking(); });

  const save = () => db.setSetting(PATH_SETTING_KEY, path).catch((err) => console.error('[Kalimati] parcours non enregistré', err));

  function draw() {
    const step = PATH_STEPS[stepIndex];
    const target = step.targets[targetIndex % step.targets.length];
    const map = h('div', { class: 'path-map', role: 'list', 'aria-label': 'Les 5 étapes' }, PATH_STEPS.map((s, i) => {
      const open = isOpen(path, i);
      const wins = path.wins[s.id] || 0;
      return h('button', { type: 'button', role: 'listitem', class: `path-stop${i === stepIndex ? ' here' : ''}${open ? '' : ' locked'}`, 'aria-label': `${s.title}${open ? '' : ' (pas encore ouverte)'} : ${Math.min(wins, WINS_TO_OPEN)} sur ${WINS_TO_OPEN}`,
        onclick: () => { stepIndex = i; targetIndex = 0; size = 0; stopListeningNow(); draw(); } },
      h('span', { class: 'path-emoji', 'aria-hidden': 'true' }, open ? s.emoji : '🔒'), h('span', { class: 'path-name' }, s.title),
      h('span', { class: 'path-stars', 'aria-hidden': 'true' }, '⭐'.repeat(Math.min(wins, WINS_TO_OPEN)) || '·'));
    }));
    const balloon = h('div', { class: 'balloon-wrap', 'aria-hidden': 'true' },
      h('div', { class: 'balloon', style: { transform: `scale(${0.35 + size * 0.85})` } }, h('span', {}, target[2])), h('div', { class: 'balloon-string' }));
    const gauge = h('div', { class: 'balloon-gauge', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(size * 100)), 'aria-label': 'Ballon' },
      h('div', { style: { width: `${Math.round(size * 100)}%` } }));
    const status = h('p', { class: 'note', 'aria-live': 'polite' }, isOpen(path, stepIndex) ? step.hint : 'Cette étape s’ouvrira après 3 réussites à l’étape d’avant. L’adulte peut quand même l’essayer.');
    const setSize = (v) => {
      size = v;
      balloon.firstChild.style.transform = `scale(${0.35 + size * 0.85})`;
      gauge.firstChild.style.width = `${Math.round(size * 100)}%`;
      gauge.setAttribute('aria-valuenow', String(Math.round(size * 100)));
      if (size >= 1 && !balloon.classList.contains('full')) { balloon.classList.add('full'); status.textContent = '🎉 Le ballon est plein, bravo !'; playClap(); stopListeningNow(); }
    };
    const listen = async () => {
      await stopListeningNow();
      balloon.classList.remove('full');
      setSize(0);
      let level = 0;
      try {
        stopMic = await startListening({ onLevel: (l) => { level = l; } });
        status.textContent = step.mode === 'breath' ? '🌬️ Souffle !' : '🗣️ À toi !';
        const tick = () => { setSize(nextBalloon(size, level, step.mode === 'breath' ? 0.08 : 0.12)); if (stopMic && size < 1) raf = requestAnimationFrame(tick); };
        tick();
        setTimeout(() => { if (stopMic) { stopListeningNow(); if (size < 1) status.textContent = 'Le micro s’est arrêté. On réessaie ?'; } }, 15000);
      } catch {
        status.textContent = 'Micro non disponible : l’adulte touche « Gonfler » quand l’enfant souffle ou parle.';
      }
    };
    const model = () => { stopSpeaking(); speak(target[1], { lang: lang === 'fr' ? 'fr' : 'fr', rate: 0.7 }); };
    const rate = async (ok) => {
      await stopListeningNow();
      if (ok) {
        path = cleanPath({ wins: { ...path.wins, [step.id]: (path.wins[step.id] || 0) + 1 } });
        await save();
        playClap();
      }
      try {
        const { logOrtho } = await import('./ex-ortho.js');
        await logOrtho({ protocol: 'path', target: `${step.id}:${target[0]}`, result: ok ? 'exact' : 'fail', step: stepIndex + 1 });
      } catch { /* journal facultatif */ }
      targetIndex += 1; size = 0;
      const opened = ok && stepIndex + 1 < PATH_STEPS.length && (path.wins[step.id] === WINS_TO_OPEN);
      draw();
      if (opened) root.querySelector('.note[aria-live]').textContent = `🔓 L’étape « ${PATH_STEPS[stepIndex + 1].title} » est ouverte !`;
    };
    root.replaceChildren(map,
      h('div', { class: 'path-target' }, h('span', { class: 'path-target-emoji', 'aria-hidden': 'true' }, target[2]), h('strong', {}, target[0])),
      balloon, gauge, status,
      h('div', { class: 'row wrap center' },
        step.mode === 'voice' ? btn('👂 Écouter le modèle', model, 'ghost') : null,
        btn(step.mode === 'breath' ? '🌬️ Souffler' : '🎤 À toi', listen, 'primary'),
        btn('🎈 Gonfler', () => setSize(Math.min(1, size + 0.25)), 'ghost')),
      h('div', { class: 'row wrap center' }, h('span', { class: 'note' }, 'L’adulte note :'),
        btn('✅ Réussi', () => rate(true), 'ghost'), btn('🌱 Pas encore', () => rate(false), 'ghost')));
  }

  db.getSetting(PATH_SETTING_KEY).then((v) => { path = cleanPath(v); }).catch(() => {}).finally(draw);
  draw();
  return root;
}
