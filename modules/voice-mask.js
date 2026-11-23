// v10.39 (pépite « Masques animés par la voix ») : l'enfant parle, le masque ouvre la bouche et grandit.
// La caméra est éteinte au départ. Si l'adulte l'allume, l'image reste sur l'écran : rien n'est filmé,
// rien n'est enregistré, rien n'est envoyé. Le micro mesure seulement le volume.
import { h, btn } from './util.js';
import { startListening } from '../media.js';
import { MASKS, smoothMouth, maskPose } from './voice-mask-data.js';

export function voiceMaskWorkshop(ctx) {
  let mask = MASKS[0];
  let mouth = 0; let level = 0; let bursts = 0; let talking = false;
  let stopMic = null; let camStream = null; let raf = 0; let timer = 0;

  const video = h('video', { class: 'mask-cam', muted: 'muted', playsinline: 'playsinline', autoplay: 'autoplay', 'aria-hidden': 'true' });
  video.muted = true; video.hidden = true;
  const face = h('span', { class: 'mask-face', 'aria-hidden': 'true' }, mask.emoji);
  const mouthEl = h('span', { class: 'mask-mouth', 'aria-hidden': 'true' });
  const holder = h('div', { class: 'mask-holder' }, face, mouthEl);
  const stage = h('div', { class: 'mask-stage', role: 'img', 'aria-label': `Masque ${mask.name}` }, video, holder);
  const status = h('p', { class: 'note', 'aria-live': 'polite' }, 'Choisis un masque, puis touche « 🎤 Parler au masque ».');
  const count = h('strong', { class: 'mask-count' }, '');

  const paint = () => {
    const pose = maskPose(mouth);
    holder.style.transform = `scale(${pose.scale.toFixed(3)}) rotate(${pose.tilt}deg)`;
    mouthEl.style.height = `${pose.mouthHeight}px`;
  };
  const stopMicNow = async () => {
    cancelAnimationFrame(raf); clearTimeout(timer);
    if (stopMic) { const s = stopMic; stopMic = null; try { await s(); } catch { /* micro déjà fermé */ } }
    mouth = 0; paint();
    micBtn.textContent = '🎤 Parler au masque';
  };
  const stopCam = () => {
    if (camStream) { camStream.getTracks().forEach((t) => t.stop()); camStream = null; }
    video.srcObject = null; video.hidden = true; stage.classList.remove('with-cam');
    camBtn.textContent = '📷 Allumer la caméra';
  };
  ctx.onCleanup(() => { stopMicNow(); stopCam(); });

  const micBtn = btn('🎤 Parler au masque', async () => {
    if (stopMic) { await stopMicNow(); status.textContent = `Fini ! ${bursts} parole${bursts > 1 ? 's' : ''}. Bravo !`; return; }
    bursts = 0; talking = false; count.textContent = '';
    try {
      stopMic = await startListening({ onLevel: (l) => { level = l; } });
    } catch { status.textContent = 'Micro non disponible. Autorisez le micro dans les réglages du téléphone.'; return; }
    micBtn.textContent = '⏹️ Arrêter';
    status.textContent = `Parle, chante ou fais « aaa » : le ${mask.name.toLowerCase()} t’écoute !`;
    const tick = () => {
      mouth = smoothMouth(mouth, level);
      if (!talking && level >= 0.25) { talking = true; bursts += 1; count.textContent = `🗣️ ${bursts}`; } else if (talking && level <= 0.08) talking = false;
      paint();
      if (stopMic) raf = requestAnimationFrame(tick);
    };
    tick();
    timer = setTimeout(() => { if (stopMic) { stopMicNow(); status.textContent = `Le masque se repose. ${bursts} parole${bursts > 1 ? 's' : ''} !`; } }, 60000);
  }, 'primary');

  const camBtn = btn('📷 Allumer la caméra', async () => {
    if (camStream) { stopCam(); return; }
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false });
      video.srcObject = camStream; video.hidden = false; stage.classList.add('with-cam');
      await video.play().catch(() => {});
      camBtn.textContent = '📷 Éteindre la caméra';
      status.textContent = 'Mets ton visage derrière le masque. L’image n’est pas enregistrée.';
    } catch { status.textContent = 'Caméra non disponible : le masque marche aussi sans caméra.'; }
  }, 'ghost');

  const picker = h('div', { class: 'mask-picker', role: 'radiogroup', 'aria-label': 'Choisir un masque' }, MASKS.map((m) => {
    const b = h('button', { type: 'button', role: 'radio', class: `mask-pick${m === mask ? ' on' : ''}`, 'aria-checked': String(m === mask), 'aria-label': m.name,
      onclick: () => {
        mask = m; face.textContent = m.emoji; stage.setAttribute('aria-label', `Masque ${m.name}`);
        picker.querySelectorAll('.mask-pick').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', String(on)); });
      } }, m.emoji);
    return b;
  }));
  paint();
  // Changer d'onglet retire l'atelier de l'écran : on éteint alors micro et caméra.
  const watch = setInterval(() => { if (!root.isConnected) { clearInterval(watch); stopMicNow(); stopCam(); } }, 1000);
  const root = h('div', { class: 'stack voice-mask' }, picker, stage, h('div', { class: 'row wrap center' }, micBtn, count), status,
    h('div', { class: 'row wrap center' }, camBtn),
    h('p', { class: 'note' }, 'La caméra est éteinte au départ. Allumée, l’image reste sur l’écran : rien n’est filmé ni envoyé.'));
  return root;
}
