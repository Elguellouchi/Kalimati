// Section A : coopération et renforçateurs (sablier visuel, préférences, D'abord / Ensuite).
import * as db from '../db.js';
import { h, btn } from './util.js';
import { speak } from '../speech.js';
import { clinic, saveClinic, recordTrial, ratingPanel } from './aba.js';
import { visualTimer } from './timer.js';
import { tokenBoard, bigCard } from './widgets.js';
import { reinforcerStats } from './progress.js';
import { REINFORCERS, ACTIVITIES } from './content.js';
import { nour } from './nour.js';
import { renderVisual } from './visuals.js';

const VALID_MINUTES = 10;

// A.1 : séance de 10-15 min sans rupture = séance valide.
function a1() {
  let ruptures = 0;
  let saved = false;
  const ruptureOut = h('span', { class: 'counter-value' }, '0');
  const result = h('p', { class: 'note' });
  const timer = visualTimer({ minutes: VALID_MINUTES, choices: [3, 5, 8, 10, 12, 15], onEnd: () => finish() });
  const tokens = tokenBoard({ count: 5 });

  async function finish() {
    if (saved) return;
    const minutes = Math.round(timer.elapsed() / 6) / 10;
    if (minutes < 1) { result.textContent = 'Lancez le timer avant de terminer la séance.'; return; }
    saved = true;
    timer.stop();
    const valid = minutes >= VALID_MINUTES && ruptures === 0;
    await recordTrial('A.1', valid ? 'plus' : 'minus', { meta: { minutes, ruptures, valid } });
    speak(valid ? 'Bravo, belle séance !' : 'Merci, la séance est finie.');
    result.textContent = valid
      ? `Séance valide enregistrée : ${minutes} min sans rupture. ✅`
      : `Séance enregistrée : ${minutes} min, ${ruptures} rupture(s). Il faut 10 min sans rupture pour la valider.`;
  }

  return h('div', { class: 'stack' },
    timer.element,
    tokens.element,
    h('div', { class: 'row center' },
      btn('⚠️ Rupture / opposition', () => { ruptures += 1; ruptureOut.textContent = String(ruptures); }, 'ghost'),
      h('span', {}, 'Ruptures : '), ruptureOut),
    btn('✔ Terminer et enregistrer la séance', finish, 'primary wide'),
    result);
}

// A.2 : « Qu'est-ce qui te fait plaisir aujourd'hui ? » + efficacité et alerte de satiété.
function a2() {
  const alert = h('p', { class: 'note' });
  const table = h('div', { class: 'eff-table' });
  const active = h('div', { class: 'active-reinforcer' });

  const drawTable = async () => {
    const stats = reinforcerStats(await db.getAllTrials());
    table.replaceChildren(h('h3', {}, 'Efficacité (réussite des essais faits avec ce renforçateur)'),
      ...stats.map((s) => h('div', { class: `eff-row${s.effective ? ' ok' : ''}` },
        h('span', {}, `${s.emoji} ${s.fr}`), h('span', {}, s.trials ? `${Math.round(s.rate * 100)} % · ${s.trials} essais` : '—'),
        h('span', {}, s.effective ? '✅ efficace' : ''))));
  };
  const drawActive = () => {
    const r = REINFORCERS.find((x) => x.id === clinic.reinforcer);
    active.replaceChildren(r ? bigCard(r.emoji, `Renforçateur actif : ${r.fr}`) : h('p', {}, 'Aucun renforçateur actif.'));
  };
  const choose = async (r) => {
    clinic.reinforcer = r.id;
    saveClinic();
    speak(r.fr);
    await recordTrial('A.2', 'log', { item: r.id, meta: { choice: true } });
    const recent = (await db.getTrialsOf('A.2')).sort((a, b) => a.ts - b.ts).slice(-4);
    const satiety = recent.length === 4 && recent.every((t) => t.item === r.id);
    alert.textContent = satiety ? `⚠️ Satiété possible : ${r.fr} choisi plus de 3 fois de suite. Proposez autre chose.` : '';
    drawActive();
    drawTable();
  };
  const group = (kind, title) => h('div', {},
    h('h3', {}, title),
    h('div', { class: 'choices', style: { '--cols': 5 } }, REINFORCERS.filter((r) => r.kind === kind).map((r) =>
      h('button', { type: 'button', class: 'choice', onclick: () => choose(r) }, renderVisual({ emoji: r.emoji, fr: r.fr }), h('span', { class: 'label' }, r.fr)))));

  drawActive();
  drawTable();
  return h('div', { class: 'stack' },
    nour({ pose: 'wave', size: 80, says: "Qu'est-ce qui te fait plaisir aujourd'hui ?" }),
    group('social', '🤗 Sociaux'), group('tangible', '🎁 Tangibles'),
    active, alert,
    btn('Retirer le renforçateur actif', () => { clinic.reinforcer = null; saveClinic(); drawActive(); }, 'ghost'),
    table);
}

// A.3 : tableau « D'abord / Ensuite ».
function a3() {
  let first = ACTIVITIES[1];
  let then = ACTIVITIES[0];
  const board = h('div', { class: 'first-then' });
  const pick = (current, onPick) => h('select', { onchange: (e) => onPick(ACTIVITIES.find((a) => a.id === e.target.value)) },
    ACTIVITIES.map((a) => h('option', { value: a.id, selected: a.id === current.id }, `${a.emoji} ${a.fr}`)));
  const draw = () => {
    const left = h('button', { type: 'button', class: 'ft-cell' }, h('span', { class: 'ft-title' }, "D'abord"), bigCard(first.emoji, first.fr), h('span', { class: 'ft-check' }, '✅'));
    left.onclick = () => { left.classList.add('finished'); speak(`Fini ! Maintenant, ${then.fr}`); };
    board.replaceChildren(left, h('div', { class: 'ft-arrow' }, '➜'),
      h('div', { class: 'ft-cell' }, h('span', { class: 'ft-title' }, 'Ensuite'), bigCard(then.emoji, then.fr)));
  };
  draw();
  return h('div', { class: 'stack' },
    h('div', { class: 'row center' }, h('span', {}, "D'abord"), pick(first, (a) => { first = a; draw(); }), h('span', {}, 'Ensuite'), pick(then, (a) => { then = a; draw(); })),
    board,
    ratingPanel('A.3', { item: () => `${first.id}>${then.id}`, labels: { plus: 'Transition calme ✅', prompt: 'Avec aide 👉', minus: 'Opposition ❌' }, onRated: () => draw() }));
}

export const EXERCISES = { 'A.1': a1, 'A.2': a2, 'A.3': a3 };
