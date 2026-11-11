// « Le Temps avec Nour » : disque coloré qui diminue doucement, sans tic-tac ni clignotement.
import { h, btn, formatTime } from './util.js';
import { nour } from './nour.js';

function sectorPath(fraction) {
  const f = Math.max(0, Math.min(0.9999, fraction));
  if (f <= 0) return '';
  const angle = f * 2 * Math.PI;
  const x = 50 + 45 * Math.sin(angle);
  const y = 50 - 45 * Math.cos(angle);
  return `M50 50 L50 5 A45 45 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

// options : minutes, choices (liste de minutes proposées), pose de Nour, onEnd(elapsedSeconds), onTick(remaining)
export function visualTimer({ minutes = 10, choices = [3, 5, 10, 12, 15], pose = 'stand', color = '#4FC3B8', onEnd, onStart } = {}) {
  let total = minutes * 60;
  let remaining = total;
  let running = false;
  let lastTs = 0;
  let frame = 0;
  let startedAt = null;

  const disc = h('div', { class: 'timer-disc' });
  disc.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="47" fill="var(--bg)" stroke="var(--line)" stroke-width="2"/>
    <path class="timer-sector" fill="${color}"/></svg>`;
  const sector = disc.querySelector('.timer-sector');
  const clock = h('div', { class: 'timer-clock' }, formatTime(remaining));
  const select = h('select', { 'aria-label': 'Durée' }, choices.map((m) => h('option', { value: m, selected: m === minutes }, `${m} min`)));
  const startBtn = btn('▶ Commencer', () => (running ? pause() : start()), 'primary');
  const resetBtn = btn('↺', () => reset(), 'ghost');

  const draw = () => {
    sector.setAttribute('d', sectorPath(remaining / total));
    clock.textContent = formatTime(remaining);
  };
  const loop = (ts) => {
    if (!running) return;
    if (lastTs) remaining -= (ts - lastTs) / 1000;
    lastTs = ts;
    if (remaining <= 0) { remaining = 0; running = false; draw(); startBtn.textContent = '▶ Commencer'; if (onEnd) onEnd(total); return; }
    draw();
    frame = requestAnimationFrame(loop);
  };
  function start() {
    if (remaining <= 0) reset();
    running = true; lastTs = 0; startBtn.textContent = '⏸ Pause';
    if (!startedAt) { startedAt = Date.now(); if (onStart) onStart(); }
    frame = requestAnimationFrame(loop);
  }
  function pause() { running = false; cancelAnimationFrame(frame); startBtn.textContent = '▶ Reprendre'; }
  function reset() { pause(); total = Number(select.value) * 60; remaining = total; startedAt = null; startBtn.textContent = '▶ Commencer'; draw(); }
  select.onchange = reset;
  draw();

  const element = h('div', { class: 'timer' },
    h('div', { class: 'timer-visual' }, disc, nour({ pose, size: 90 })),
    clock,
    h('div', { class: 'row center' }, select, startBtn, resetBtn));

  return {
    element,
    elapsed: () => total - remaining,
    isRunning: () => running,
    stop: () => { running = false; cancelAnimationFrame(frame); },
  };
}

// Petit sablier visuel (N.2 : 4 secondes, Y.3 : 3 secondes) : une barre qui se vide doucement.
export function hourglass(seconds, onEnd) {
  const fill = h('div', { class: 'hourglass-fill' });
  const element = h('div', { class: 'hourglass' }, fill);
  let timeout = 0;
  const run = () => {
    clearTimeout(timeout);
    fill.style.transition = 'none';
    fill.style.transform = 'scaleX(1)';
    void fill.offsetWidth;
    fill.style.transition = `transform ${seconds}s linear`;
    fill.style.transform = 'scaleX(0)';
    timeout = setTimeout(() => { if (onEnd) onEnd(); }, seconds * 1000);
  };
  return { element, run, stop: () => clearTimeout(timeout) };
}
