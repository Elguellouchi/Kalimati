// « Mon sablier visuel » : un disque qui se remplit doucement, sans tic-tac ni clignotement.
// Silencieux et sans chiffres par défaut ; le compte à rebours chiffré est une option parentale.
import { h, btn, formatTime } from './util.js';
import { nour } from './nour.js';
import { tx, getActiveLang } from './section-i18n.js';

function sectorPath(fraction) {
  const f = Math.max(0, Math.min(0.9999, fraction));
  if (f <= 0) return '';
  const angle = f * 2 * Math.PI;
  const x = 50 + 45 * Math.sin(angle);
  const y = 50 - 45 * Math.cos(angle);
  return `M50 50 L50 5 A45 45 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z`;
}

// 🕰️ Option parentale : par défaut le sablier est silencieux et se remplit doucement, sans chiffres.
// Le compte à rebours chiffré (et ses alertes) reste une option explicite.
export const TIMER_SETTING_KEY = 'timerShowNumbers';
let timerShowNumbers = false;
export function setTimerShowNumbers(value) { timerShowNumbers = value === true; }
export const getTimerShowNumbers = () => timerShowNumbers;

export function timerVisualState(remaining, total, showNumbers = timerShowNumbers) {
  const safeTotal = Math.max(1, Number(total) || 0);
  const left = Math.max(0, Math.min(safeTotal, Number(remaining) || 0));
  return showNumbers
    ? { fraction: left / safeTotal, showClock: true }
    : { fraction: 1 - left / safeTotal, showClock: false };
}

// options : minutes, choices (liste de minutes proposées), pose de la loutre, onEnd(elapsedSeconds), onTick(remaining)
export function visualTimer({ minutes = 10, choices = [3, 5, 10, 12, 15], pose = 'stand', color = '#4FC3B8', showNumbers = timerShowNumbers, onEnd, onStart } = {}) {
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
  clock.hidden = !showNumbers;
  const select = h('select', { 'aria-label': 'Durée' }, choices.map((m) => h('option', { value: m, selected: m === minutes }, `${m} min`)));
  const timerText = (key) => tx(key, getActiveLang());
  const startBtn = btn(timerText('startTimer'), () => (running ? pause() : start()), 'primary');
  const resetBtn = btn('↺', () => reset(), 'ghost');

  const draw = () => {
    const view = timerVisualState(remaining, total, showNumbers);
    sector.setAttribute('d', sectorPath(view.fraction));
    clock.hidden = !view.showClock;
    if (view.showClock) clock.textContent = formatTime(Math.ceil(remaining));
  };
  const loop = (ts) => {
    if (!running) return;
    if (lastTs) remaining -= (ts - lastTs) / 1000;
    lastTs = ts;
    if (remaining <= 0) { remaining = 0; running = false; draw(); startBtn.textContent = timerText('startTimer'); if (onEnd) onEnd(total); return; }
    draw();
    frame = requestAnimationFrame(loop);
  };
  function start() {
    if (remaining <= 0) reset();
    running = true; lastTs = 0; startBtn.textContent = timerText('pauseTimer');
    if (!startedAt) { startedAt = Date.now(); if (onStart) onStart(); }
    frame = requestAnimationFrame(loop);
  }
  function pause() { running = false; cancelAnimationFrame(frame); startBtn.textContent = timerText('resumeTimer'); }
  function reset() { pause(); total = Number(select.value) * 60; remaining = total; startedAt = null; startBtn.textContent = timerText('startTimer'); draw(); }
  select.onchange = reset;
  draw();

  const element = h('div', { class: `timer${showNumbers ? '' : ' timer-silent'}` },
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
