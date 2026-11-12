// Moteur de progression à 1 000 niveaux, un parcours par objectif du PEI.
// Chaque niveau = 5 essais réussis (✅ autonome). Le niveau suivant se débloque tout seul ; l'adulte peut sauter à n'importe quel niveau.
// Les paramètres (nombre de choix, boîtes, pièces, quantités…) suivent une courbe de difficulté en 6 étapes.
import * as db from '../db.js';
import { h, btn } from './util.js';
import { onTrial } from './aba.js';
import { speak } from '../speech.js';
import { playClap } from '../media.js';

export const MAX_LEVEL = 1000;
export const TRIALS_PER_LEVEL = 5;
const JUMPS = [1, 25, 50, 100, 250, 500, 750, 1000];

let levels = {};
const attempts = new Map(); // essais lancés dans le niveau en cours (pour varier sans répéter)
const listeners = new Set();

export async function loadLevels() { levels = (await db.getSetting('levels')) || {}; }
const save = () => db.setSetting('levels', JSON.parse(JSON.stringify(levels)));
const clamp = (n) => Math.max(1, Math.min(MAX_LEVEL, Math.round(Number(n) || 1)));

export function levelOf(goalId) {
  return levels[goalId] || { currentLevel: 1, maxUnlocked: 1, starsInLevel: 0, totalCompleted: 0 };
}

export function onLevelChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
const notify = (goalId, reason) => listeners.forEach((fn) => fn(goalId, levelOf(goalId), reason));

export function setLevel(goalId, level) {
  const current = levelOf(goalId);
  const next = clamp(level);
  levels = { ...levels, [goalId]: { ...current, currentLevel: next, maxUnlocked: Math.max(current.maxUnlocked, next), starsInLevel: 0 } };
  attempts.set(goalId, 0);
  save();
  notify(goalId, 'jump');
}

// Douce célébration, sans flash ni bruit fort.
function celebrate(level) {
  const toast = h('div', { class: 'level-toast', role: 'status' }, `🌟 Niveau ${level} terminé ! Passage au niveau ${level + 1}`);
  document.body.append(toast);
  playClap();
  speak(`Bravo ! Niveau ${level} terminé.`);
  setTimeout(() => toast.classList.add('out'), 2600);
  setTimeout(() => toast.remove(), 3400);
}

// Chaque essai réussi seule fait avancer le niveau de l'objectif.
onTrial((trial) => {
  if (trial.result !== 'plus' || !trial.goalId) return;
  const current = levelOf(trial.goalId);
  const stars = current.starsInLevel + 1;
  if (stars < TRIALS_PER_LEVEL || current.currentLevel >= MAX_LEVEL) {
    levels = { ...levels, [trial.goalId]: { ...current, starsInLevel: Math.min(stars, TRIALS_PER_LEVEL) } };
    save();
    notify(trial.goalId, 'star');
    return;
  }
  const next = current.currentLevel + 1;
  levels = { ...levels, [trial.goalId]: { currentLevel: next, maxUnlocked: Math.max(current.maxUnlocked, next), starsInLevel: 0, totalCompleted: current.totalCompleted + 1 } };
  attempts.set(trial.goalId, 0);
  save();
  celebrate(current.currentLevel);
  notify(trial.goalId, 'levelup');
});

// ---------- Hasard déterministe : (objectif, niveau, essai) donne toujours la même combinaison ----------
function hash(text) {
  let x = 2166136261;
  for (let i = 0; i < text.length; i += 1) { x ^= text.charCodeAt(i); x = Math.imul(x, 16777619); }
  return x >>> 0;
}

export function seeded(seedText) {
  let a = hash(seedText);
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Générateur de l'essai suivant : varie à chaque essai, sans répétition à l'intérieur d'un niveau.
export function nextTrialRandom(goalId) {
  const level = levelOf(goalId).currentLevel;
  const n = attempts.get(goalId) || 0;
  attempts.set(goalId, n + 1);
  return seeded(`${goalId}|${level}|${n}`);
}

export const rPick = (rand, items) => items[Math.floor(rand() * items.length)];
export function rShuffle(rand, items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) { const j = Math.floor(rand() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
export const rSample = (rand, items, n) => rShuffle(rand, items).slice(0, n);
export const rInt = (rand, min, max) => min + Math.floor(rand() * (max - min + 1));

// ---------- Courbe de difficulté sur 1 000 niveaux ----------
const STAGES = [
  { upTo: 50, name: 'Initiation', choices: [2, 2], boxes: 2, perBox: 2, pieces: 4, steps: 2, maxCount: 3, criteria: 1, catalog: 0.15 },
  { upTo: 150, name: 'Exploration', choices: [3, 3], boxes: 2, perBox: 3, pieces: 6, steps: 3, maxCount: 5, criteria: 1, catalog: 0.35 },
  { upTo: 300, name: 'Consolidation', choices: [4, 4], boxes: 2, perBox: 3, pieces: 6, steps: 3, maxCount: 7, criteria: 1, catalog: 0.55 },
  { upTo: 500, name: 'Discrimination fine', choices: [4, 5], boxes: 3, perBox: 3, pieces: 8, steps: 4, maxCount: 10, criteria: 1, catalog: 0.75 },
  { upTo: 750, name: 'Généralisation avancée', choices: [6, 6], boxes: 4, perBox: 3, pieces: 9, steps: 5, maxCount: 15, criteria: 2, catalog: 0.9 },
  { upTo: 1000, name: 'Maîtrise', choices: [6, 8], boxes: 4, perBox: 3, pieces: 12, steps: 5, maxCount: 20, criteria: 2, catalog: 1 },
];

export function levelParams(level) {
  const l = clamp(level);
  const index = STAGES.findIndex((s) => l <= s.upTo);
  const stage = STAGES[index];
  const start = index ? STAGES[index - 1].upTo + 1 : 1;
  const progress = (l - start) / Math.max(1, stage.upTo - start); // 0 → 1 dans l'étape
  const [cMin, cMax] = stage.choices;
  return {
    level: l, stage: index + 1, stageName: stage.name,
    choices: Math.round(cMin + (cMax - cMin) * progress),
    boxes: stage.boxes, perBox: stage.perBox, pieces: stage.pieces, steps: stage.steps,
    maxCount: stage.maxCount, criteria: stage.criteria,
    catalogShare: stage.catalog, // part du catalogue utilisée (0,15 = mots du quotidien immédiat … 1 = tout)
    closeDistractors: l > 150, // distracteurs de la même famille à partir de la consolidation
    gridSize: l <= 150 ? 4 : (l <= 500 ? 6 : 8),
    commandSteps: l > 500 ? 3 : 2,
  };
}

// ---------- Bandeau « 🌟 Niveau X / 1000 » en haut de chaque exercice ----------
export function levelHeader(goalId, onChange) {
  const box = h('div', { class: 'level-bar' });
  const draw = () => {
    const s = levelOf(goalId);
    const p = levelParams(s.currentLevel);
    const online = navigator.onLine;
    const jump = (n) => { setLevel(goalId, n); if (onChange) onChange(); };
    const input = h('input', { type: 'number', min: 1, max: MAX_LEVEL, value: s.currentLevel, 'aria-label': 'Aller au niveau' });
    input.onchange = () => jump(input.value);
    const select = h('select', { 'aria-label': 'Paliers', onchange: (e) => { if (e.target.value) jump(e.target.value); } },
      h('option', { value: '' }, '🎚️ Palier'), JUMPS.map((n) => h('option', { value: n }, `Niv. ${n}`)));
    box.replaceChildren(
      h('div', { class: 'level-main' },
        h('strong', { class: 'level-badge' }, `🌟 Niveau ${s.currentLevel} / ${MAX_LEVEL}`),
        h('span', { class: `net ${online ? 'on' : 'off'}` }, online ? '🌐 Mode connecté enrichi' : '📴 Mode hors ligne'),
        h('span', { class: 'level-stars', 'aria-label': `${s.starsInLevel} réussites sur ${TRIALS_PER_LEVEL}` },
          Array.from({ length: TRIALS_PER_LEVEL }, (_, i) => (i < s.starsInLevel ? '⭐' : '☆')).join(' ')),
        h('small', { class: 'note' }, p.stageName)),
      h('div', { class: 'level-tools' },
        btn('◀ Niv. préc.', () => jump(s.currentLevel - 1), 'ghost tiny'), select, input,
        btn('Niv. suiv. ▶', () => jump(s.currentLevel + 1), 'ghost tiny')));
  };
  draw();
  const off = onLevelChange((id) => { if (id === goalId) draw(); });
  const net = () => draw();
  window.addEventListener('online', net);
  window.addEventListener('offline', net);
  box.cleanup = () => { off(); window.removeEventListener('online', net); window.removeEventListener('offline', net); };
  return box;
}
