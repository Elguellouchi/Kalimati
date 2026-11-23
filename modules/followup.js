// Fiche de suivi pour le thérapeute : construite uniquement sur ce téléphone, sur toucher explicite.
// La fiche ne contient que des scores, des codes de rôle (psy, parents, teacher, avs) et des dates de jour.
// Aucun prénom, aucune photo, aucune voix, aucun texte libre, aucune date de naissance.
import * as db from '../db.js';
import { h, btn, dayKey, addDays } from './util.js';
import { profile } from './aba.js';
import { evaluateAll } from './spaces.js';
import { getAtecHistory } from './atec.js';
import { deliverBackup } from '../backup.js';
import {
  FOLLOWUP_KIND, FOLLOWUP_VERSION, CODE_RE, ageBandOf, normalizeFollowup, newFollowupCode, parseFollowupText, percentOf,
} from './followup-schema.js';

const CODE_KEY = 'followupCode';
const THERAPIST_CODE_KEY = 'followupTherapistCode';
const STATUSES = ['plus', 'prompt', 'minus'];

export async function getFollowupCode() {
  const saved = await db.getSetting(CODE_KEY);
  if (CODE_RE.test(saved || '')) return saved;
  const code = newFollowupCode();
  await db.setSetting(CODE_KEY, code);
  return code;
}

export async function getTherapistCode() {
  const saved = await db.getSetting(THERAPIST_CODE_KEY);
  return CODE_RE.test(saved || '') ? saved : '';
}

export async function setTherapistCode(value) {
  const code = String(value || '').trim().toUpperCase();
  if (!code) {
    await db.deleteSetting(THERAPIST_CODE_KEY);
    return '';
  }
  if (!CODE_RE.test(code)) throw new Error('Code invalide (exemple : KALI-7Q4M).');
  await db.setSetting(THERAPIST_CODE_KEY, code);
  return code;
}

const groupByRole = (trials, key) => {
  const map = new Map();
  trials.forEach((t) => {
    const id = typeof t[key] === 'string' ? t[key] : null;
    if (!id || !/^[a-z][a-z0-9_-]{0,19}$/.test(id)) return;
    if (!map.has(id)) map.set(id, { id, trials: 0, plus: 0, days: new Set() });
    const row = map.get(id);
    row.trials += 1;
    if (t.result === 'plus') row.plus += 1;
    if (t.day) row.days.add(t.day);
  });
  return [...map.values()].map((row) => ({
    id: row.id, trials: row.trials, autonomy: percentOf(row.plus, row.trials), days: row.days.size,
  })).sort((a, b) => b.trials - a.trials);
};

export async function buildFollowupCard() {
  const [evaluated, abcLogs, orthoLogs, scheduleLogs, atecHistory, familyCode, therapistCode] = await Promise.all([
    evaluateAll(),
    db.getAllAbcLogs(),
    db.getAllOrthoLogs(),
    db.getAllScheduleLogs(),
    getAtecHistory(),
    getFollowupCode(),
    getTherapistCode(),
  ]);
  const day = dayKey();
  const cutoff30 = addDays(day, -30);
  const cutoff28 = addDays(day, -27);
  const all = evaluated?.all || [];
  const scored = all.filter((t) => STATUSES.includes(t.result)).sort((a, b) => (a.ts || 0) - (b.ts || 0));

  const byDay = new Map();
  scored.forEach((t) => {
    if (!t.day || t.day < cutoff28) return;
    if (!byDay.has(t.day)) byDay.set(t.day, { day: t.day, trials: 0, plus: 0 });
    const entry = byDay.get(t.day);
    entry.trials += 1;
    if (t.result === 'plus') entry.plus += 1;
  });
  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
    .map((entry) => ({ day: entry.day, trials: entry.trials, autonomy: percentOf(entry.plus, entry.trials) }));

  const activityDays = new Set([
    ...all.map((t) => t.day),
    ...orthoLogs.map((l) => l.day),
    ...abcLogs.map((l) => l.day),
    ...scheduleLogs.map((l) => l.day),
  ].filter(Boolean));
  const lastDay = [...activityDays].sort().pop() || null;

  const prompts = {};
  scored.forEach((t) => { if (t.prompt) prompts[t.prompt] = (prompts[t.prompt] || 0) + 1; });

  const routines = scheduleLogs.filter((l) => l.day >= cutoff28 && (l.autonomy === 'seule' || l.autonomy === 'rappel'));
  const mluLogs = orthoLogs.filter((l) => Number.isFinite(Number(l.mlu)) && Number(l.mlu) > 0).slice(-10);
  const atecLatest = atecHistory.length ? atecHistory[atecHistory.length - 1] : null;
  const atecFirst = atecHistory.length > 1 ? atecHistory[0] : null;

  const goals = [];
  for (const goal of evaluated?.results ? [...evaluated.results.entries()] : []) {
    const [id, result] = goal;
    if (!result || (result.count === 0 && result.status === 'todo')) continue;
    goals.push({ id, status: result.status, pct: result.pct, count: result.count });
  }

  const card = {
    kind: FOLLOWUP_KIND,
    v: FOLLOWUP_VERSION,
    code: therapistCode || familyCode,
    day,
    ageBand: ageBandOf(profile.age),
    totals: {
      trials: all.length,
      scored: scored.length,
      plus: scored.filter((t) => t.result === 'plus').length,
      prompt: scored.filter((t) => t.result === 'prompt').length,
      minus: scored.filter((t) => t.result === 'minus').length,
      activeDays: activityDays.size,
      lastDay,
    },
    autonomy: percentOf(scored.filter((t) => t.result === 'plus').length, scored.length),
    goals,
    days,
    intervenants: groupByRole(scored, 'intervenant'),
    environments: groupByRole(scored, 'environment'),
    prompts,
    routines: {
      logs: routines.length,
      autonomous: routines.filter((l) => l.autonomy === 'seule').length,
      reminded: routines.filter((l) => l.autonomy === 'rappel').length,
      days: new Set(routines.map((l) => l.day)).size,
    },
    abc: { total: abcLogs.length, last30: abcLogs.filter((l) => l.day >= cutoff30).length },
    ortho: {
      total: orthoLogs.length,
      last30: orthoLogs.filter((l) => l.day >= cutoff30).length,
      mlu: mluLogs.length ? mluLogs.reduce((sum, l) => sum + Number(l.mlu), 0) / mluLogs.length : null,
    },
    atec: atecLatest && atecLatest.day ? {
      day: atecLatest.day,
      total: atecLatest.total,
      baseline: atecFirst ? atecFirst.total : null,
    } : null,
  };
  // La fiche est relue par le même validateur que celui du thérapeute.
  return normalizeFollowup(card);
}

export function followupFileName(card) {
  return `kalimati-fiche-${card.code}-${card.day}.json`;
}

export async function followupFile() {
  const card = await buildFollowupCard();
  return { card, file: new File([JSON.stringify(card, null, 2)], followupFileName(card), { type: 'application/json;charset=utf-8' }) };
}

export async function readFollowupFile(file) {
  if (!file) throw new Error('Aucun fichier choisi.');
  return parseFollowupText(await file.text());
}

const CODE_STYLE = { fontFamily: 'ui-monospace, monospace', letterSpacing: '.12em', fontWeight: '800' };

export function followupShareBox() {
  const body = h('div', { class: 'stack' });
  const status = h('p', { class: 'note', role: 'status' });
  const summary = h('p', { class: 'note' });
  const codeInput = h('input', { readonly: true, 'aria-label': 'Code de la fiche', style: CODE_STYLE });
  const copyBtn = h('button', { type: 'button', class: 'btn ghost tiny' }, '📋 Copier');
  const therapistInput = h('input', {
    placeholder: 'KALI-XXXX', maxlength: 9, autocomplete: 'off', spellcheck: 'false',
    'aria-label': 'Code du cabinet du thérapeute (facultatif)', style: CODE_STYLE,
  });
  const therapistNote = h('p', { class: 'note' });
  const prepareBtn = btn('📦 Préparer la fiche', async () => prepare(), 'primary');
  const sendBtn = btn('📤 Envoyer au thérapeute', async () => send(), 'primary');
  const saveBtn = btn('💾 Enregistrer le fichier', async () => save());
  sendBtn.hidden = true;
  saveBtn.hidden = true;
  let prepared = null;
  let busy = false;

  const invalidate = () => {
    prepared = null;
    sendBtn.hidden = true;
    saveBtn.hidden = true;
    summary.textContent = '';
  };

  copyBtn.onclick = async () => {
    const code = codeInput.value;
    try {
      await navigator.clipboard.writeText(code);
      status.textContent = '✅ Code copié.';
    } catch {
      codeInput.select();
      status.textContent = 'Sélectionnez le code ci-dessus, puis Copier.';
    }
  };

  therapistInput.addEventListener('input', () => {
    therapistInput.value = therapistInput.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    invalidate();
    if (!therapistInput.value) {
      therapistNote.textContent = 'Sans code de cabinet, la fiche utilise le code de cette famille.';
      setTherapistCode('').catch(() => {});
      return;
    }
    if (CODE_RE.test(therapistInput.value)) {
      therapistNote.textContent = '✅ La fiche utilisera le code du cabinet.';
      setTherapistCode(therapistInput.value).catch(() => {});
    } else {
      therapistNote.textContent = '⏳ Code incomplet : KALI- suivi de 4 lettres ou chiffres.';
    }
  });

  async function prepare() {
    if (busy) return;
    busy = true;
    prepareBtn.disabled = true;
    status.textContent = 'Préparation…';
    try {
      prepared = await followupFile();
      const { card } = prepared;
      summary.textContent = `✅ Fiche prête : ${card.goals.length} objectif(s), ${card.totals.scored} essai(s) noté(s), tranche d’âge ${card.ageBand || 'non renseignée'}.`;
      codeInput.value = card.code;
      sendBtn.hidden = false;
      saveBtn.hidden = false;
      status.textContent = 'Touchez « Envoyer au thérapeute » (ou enregistrez le fichier).';
    } catch (err) {
      status.textContent = `⚠️ ${err?.message || err}`;
      prepared = null;
    } finally {
      busy = false;
      prepareBtn.disabled = false;
    }
  }

  async function send() {
    if (!prepared) return;
    sendBtn.disabled = true;
    try {
      const result = await deliverBackup(prepared.file);
      status.textContent = result === 'cancelled' ? 'Envoi annulé. La fiche reste prête.' : '✅ Fiche envoyée. Le thérapeute peut l’importer dans son cabinet.';
    } catch (err) {
      status.textContent = `⚠️ ${err?.message || err}`;
    } finally {
      sendBtn.disabled = false;
    }
  }

  async function save() {
    if (!prepared) return;
    saveBtn.disabled = true;
    try {
      const result = await deliverBackup(prepared.file);
      status.textContent = result === 'cancelled' ? 'Enregistrement annulé.' : '✅ Fichier prêt (dossier Téléchargements).';
    } finally {
      saveBtn.disabled = false;
    }
  }

  body.append(
    h('p', { class: 'note' }, 'Une fiche de suivi pseudonymisée, préparée sur ce téléphone. Le thérapeute la reçoit par fichier ou par le partage du téléphone.'),
    h('div', { class: 'cab-code-row' }, h('div', { class: 'grow' }, h('small', {}, 'Code de la fiche'), codeInput), copyBtn),
    h('label', { class: 'field' }, 'Code du cabinet (si le thérapeute vous en a donné un)', therapistInput),
    therapistNote,
    h('details', { class: 'cab-privacy' }, h('summary', {}, '🔒 Ce que contient la fiche — et ce qui ne part jamais'),
      h('div', { class: 'stack' },
        h('p', {}, '✅ Contient : tranche d’âge, scores d’autonomie, objectifs travaillés, essais par rôle (psychologue, famille, école/AVS), routines seules ou avec rappel, activité orthophonie, journal ABC, dernier score ATEC.'),
        h('p', {}, '🚫 Ne contient jamais : prénom, nom, ville, photo, voix, date de naissance, texte libre, cahier de vie.'),
        h('p', { class: 'note' }, 'La fiche reste un fichier : elle ne part sur internet que si vous choisissez vous-même de l’envoyer. Le code du cabinet ne révèle aucune identité.'))),
    h('div', { class: 'row wrap' }, prepareBtn, sendBtn, saveBtn),
    summary,
    status);

  getFollowupCode().then((code) => { codeInput.value = code; }).catch(() => {});
  getTherapistCode().then((code) => {
    if (!code) return;
    therapistInput.value = code;
    therapistNote.textContent = '✅ La fiche utilisera le code du cabinet.';
  }).catch(() => {});

  return h('section', { class: 'card-box' },
    h('h3', {}, '🩺 Partage avec le thérapeute (fiche pseudonymisée)'),
    body);
}
