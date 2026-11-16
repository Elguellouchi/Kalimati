// Collecte de données ABA : intervenant, lieu, renforçateur actif, cotation rapide de chaque essai.
// Machine à états de la cotation : idle → (👉) choix de la guidance → idle. Chaque essai est daté et rangé par jour.
import * as db from '../db.js';
import { h, btn, uid, dayKey, weekKey, percent } from './util.js';
import { PROFIL, LEGACY_PROFIL, NEUTRAL } from './profil.js';

export const INTERVENANTS = [
  { id: 'psy', get label() { return profile.psy ? `👩‍⚕️ ${profile.psy} (Psychologue)` : '👩‍⚕️ Psychologue / Thérapeute'; } },
  { id: 'parents', label: '👨‍👧 Papa / Maman' },
  { id: 'teacher', label: '👩‍🏫 Enseignant(e)' },
];
export const ENVIRONMENTS = [
  { id: 'clinic', label: '🧩 Cabinet' },
  { id: 'home', label: '🏠 Maison' },
  { id: 'school', label: '🏫 École' },
];
export const PROMPTS = [
  { id: 'gestuel', label: 'Gestuel' }, { id: 'verbal', label: 'Verbal' },
  { id: 'partiel', label: 'Partiel' }, { id: 'physique', label: 'Physique' },
];

// Contexte clinique courant (gardé dans le téléphone).
export const clinic = { intervenant: 'parents', environment: 'home', reinforcer: null };

// Profil de l'enfant : pré-rempli depuis profil.js, modifiable dans Progrès ➜ Profil.
export const profile = { name: PROFIL.name, age: PROFIL.age, father: PROFIL.father, mother: PROFIL.mother, sister: PROFIL.sister, city: PROFIL.city, psy: PROFIL.psy };
export const childName = () => (profile.name || NEUTRAL.name).toUpperCase();
export const firstName = () => profile.name || NEUTRAL.name;
export const sisterName = () => profile.sister || NEUTRAL.sister;
export const psyName = () => profile.psy || NEUTRAL.psy;

// Les vraies personnes de la vie d'Abir (partenaires des jeux sociaux, salutations, repas).
export const people = () => [
  { id: 'ghita', name: sisterName(), vkey: 'person:ghita' },
  { id: 'papa', name: 'Papa', vkey: 'person:papa' },
  { id: 'maman', name: 'Maman', vkey: 'person:maman' },
  { id: 'hosna', name: psyName(), vkey: 'person:hosna' },
  { id: 'maitresse', name: 'La maîtresse', vkey: 'person:maitresse' },
  { id: 'camarade', name: 'Un camarade', vkey: 'person:camarade' },
];

export async function loadContext() {
  Object.assign(clinic, (await db.getSetting('clinic')) || {});
  let saved = await db.getSetting('profile');
  // v9.8 : un téléphone installé AVANT la v9.8 garde le profil de la famille (rien n'est écrasé) ;
  // seules les cases jamais remplies reçoivent l'ancienne valeur. Un nouveau téléphone reste neutre.
  let origin = await db.getSetting('profileOrigin');
  if (!origin) {
    const installed = Boolean(saved) || Boolean(await db.getSetting('seeded')) || (await db.getAllCards()).length > 0;
    origin = installed ? 'legacy' : 'neutral';
    if (origin === 'legacy') {
      const filled = { ...LEGACY_PROFIL };
      for (const [key, value] of Object.entries(saved || {})) if (value !== undefined && value !== null) filled[key] = value;
      // Correction du 12/11 (ancienne ville) : seulement pour ces téléphones-là.
      if (['', 'Témara', 'Temara'].includes(String(filled.city ?? '').trim())) filled.city = LEGACY_PROFIL.city;
      saved = filled;
      await db.setSetting('profile', saved);
    }
    await db.setSetting('profileOrigin', origin);
  }
  Object.assign(profile, saved || {});
}
export const saveClinic = () => db.setSetting('clinic', { ...clinic });
export const saveProfile = (values) => { Object.assign(profile, values); return db.setSetting('profile', { ...profile }); };

const listeners = new Set();
export function onTrial(listener) { listeners.add(listener); return () => listeners.delete(listener); }

// result : 'plus' (autonome) | 'prompt' (guidé) | 'minus' (non réussi) | 'log' (simple pointage)
export async function recordTrial(goalId, result, { item = null, prompt = null, meta = {} } = {}) {
  const now = new Date();
  const trial = {
    id: uid('t'), goalId, ts: now.getTime(), day: dayKey(now), week: weekKey(now),
    result, prompt, item, meta: { ...meta },
    intervenant: clinic.intervenant, environment: clinic.environment, reinforcer: clinic.reinforcer,
  };
  await db.addTrial(trial);
  listeners.forEach((listener) => listener(trial));
  return trial;
}

export async function todayTrials(goalId) {
  const today = dayKey();
  return (await db.getTrialsOf(goalId)).filter((t) => t.day === today);
}

function segmented(options, current, onPick) {
  const box = h('div', { class: 'seg small' });
  const draw = (active) => box.replaceChildren(...options.map((o) => h('button', {
    type: 'button', class: o.id === active ? 'active' : '', onclick: () => { draw(o.id); onPick(o.id); },
  }, o.label)));
  draw(current);
  return box;
}

// Barre clinique discrète en haut des espaces Séance et Routines.
export function clinicBar() {
  return h('div', { class: 'clinic-bar' },
    segmented(INTERVENANTS, clinic.intervenant, (id) => { clinic.intervenant = id; saveClinic(); }),
    segmented(ENVIRONMENTS, clinic.environment, (id) => { clinic.environment = id; saveClinic(); }));
}

const DEFAULT_LABELS = { plus: '✅ Autonome', prompt: '👉 Guidé', minus: '❌ Non réussi' };

// Panneau de cotation d'un essai. item : valeur ou fonction (ex. image affichée).
export function ratingPanel(goalId, { item = null, labels = {}, onRated, withPrompts = true, meta = null } = {}) {
  const names = { ...DEFAULT_LABELS, ...labels };
  const tally = h('p', { class: 'tally' }, '…');
  const promptRow = h('div', { class: 'row prompt-row', hidden: true });
  let lastTrial = null;

  const refresh = async () => {
    const trials = (await todayTrials(goalId)).filter((t) => t.result !== 'log');
    const plus = trials.filter((t) => t.result === 'plus').length;
    tally.textContent = trials.length
      ? `Aujourd'hui : ${trials.length} essai${trials.length > 1 ? 's' : ''} · ${plus} ✅ (${percent(plus, trials.length)} %)`
      : "Aujourd'hui : aucun essai noté";
  };
  const rate = async (result, prompt = null) => {
    promptRow.hidden = true;
    const currentItem = typeof item === 'function' ? item() : item;
    const extra = typeof meta === 'function' ? meta() : (meta || {});
    lastTrial = await recordTrial(goalId, result, { item: currentItem, prompt, meta: extra });
    undo.disabled = false;
    await refresh();
    if (onRated) onRated(result, lastTrial);
  };
  promptRow.append(...PROMPTS.map((p) => btn(p.label, () => rate('prompt', p.id), 'ghost')));
  const undo = btn('↩︎ Annuler la dernière note', async () => {
    if (!lastTrial) return;
    await db.deleteTrial(lastTrial.id);
    lastTrial = null; undo.disabled = true; refresh();
  }, 'ghost tiny');
  undo.disabled = true;

  refresh();
  return h('div', { class: 'rating' },
    h('div', { class: 'row rating-row' },
      btn(names.plus, () => rate('plus'), 'rate-plus'),
      btn(names.prompt, () => (withPrompts ? (promptRow.hidden = !promptRow.hidden) : rate('prompt')), 'rate-prompt'),
      btn(names.minus, () => rate('minus'), 'rate-minus')),
    promptRow,
    h('div', { class: 'row between' }, tally, undo));
}
