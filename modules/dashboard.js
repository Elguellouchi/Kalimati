// 📊 Progrès PEI : tableau de bord ABLLS-R des 71 objectifs (protégé par le cadenas parent).
import * as db from '../db.js';
import { h, btn, dayKey, addDays, percent } from './util.js';
import { availableVoices, setPreferredVoice, speak } from '../speech.js';
import { profile, saveProfile } from './aba.js';
import { SECTIONS, GOALS, goalsOf } from './goals.js';
import { reinforcerStats, accidentStats } from './progress.js';
import { evaluateAll, statusChip } from './spaces.js';
import { matrixTable } from './ex-social.js';
import { levelOf } from './levels.js';

function profileForm() {
  const fields = [['name', 'Prénom de l’enfant'], ['age', 'Âge (ex. 8 ans)'], ['father', 'Prénom du papa'], ['mother', 'Comment elle appelle sa maman'], ['sister', 'Prénom de la sœur'], ['city', 'Ville']];
  const inputs = Object.fromEntries(fields.map(([key]) => [key, h('input', { value: profile[key] || '', maxlength: 30 })]));
  const saved = h('span', { class: 'note' });
  return h('details', { class: 'card-box' },
    h('summary', {}, '👧 Profil de l’enfant (reste dans ce téléphone)'),
    h('div', { class: 'stack' }, fields.map(([key, label]) => h('label', { class: 'field' }, label, inputs[key])),
      h('div', { class: 'row' }, btn('Enregistrer le profil', async () => {
        await saveProfile(Object.fromEntries(fields.map(([key]) => [key, inputs[key].value.trim()])));
        saved.textContent = 'Enregistré ✅';
      }, 'primary'), saved)));
}

const PHASE = new Map(GOALS.map((g) => [g.id, g.phase === 'next' ? 'prochains niveaux' : 'PEI']));
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

async function exportCsv() {
  const trials = (await db.getAllTrials()).sort((a, b) => a.ts - b.ts);
  const header = ['date', 'heure', 'objectif', 'parcours', 'resultat', 'guidance', 'item', 'intervenant', 'lieu', 'renforcateur', 'details'];
  const rows = trials.map((t) => {
    const d = new Date(t.ts);
    return [t.day, d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), t.goalId, PHASE.get(t.goalId) || '', t.result, t.prompt, t.item, t.intervenant, t.environment, t.reinforcer, JSON.stringify(t.meta || {})].map(csvCell).join(';');
  });
  const blob = new Blob([`﻿${header.join(';')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const link = h('a', { href: URL.createObjectURL(blob), download: `kalimati-essais-${dayKey()}.csv` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

// Indicateurs d'un ensemble d'objectifs : atteints, en cours, niveau moyen (et essais du jour pour le PEI).

// v7 (Aegon) : Graphique SVG d'évolution sur 7 jours (essais autonomes ✅ vs guidés 👉) + Sélecteur de voix naturelles
function weeklyTrendChart(all) {
  const today = dayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const byDay = days.map((d) => {
    const list = all.filter((t) => t.day === d && (t.result === 'plus' || t.result === 'prompt' || t.result === 'minus'));
    const plus = list.filter((t) => t.result === 'plus').length;
    const prompt = list.filter((t) => t.result === 'prompt').length;
    const rate = list.length ? Math.round((100 * plus) / list.length) : 0;
    return { day: d, label: d.slice(8) + '/' + d.slice(5, 7), total: list.length, plus, prompt, rate };
  });
  const maxTotal = Math.max(5, ...byDay.map((x) => x.total));
  const w = 520; const hgt = 170; const padL = 32; const padB = 28; const padT = 18;
  const chartH = hgt - padB - padT;
  const colW = (w - padL - 16) / 7;
  const bars = byDay.map((d, i) => {
    const x = padL + i * colW + 10;
    const bw = Math.max(18, colW - 20);
    const hPlus = Math.round((d.plus / maxTotal) * chartH);
    const hPrompt = Math.round((d.prompt / maxTotal) * chartH);
    const yPlus = padT + chartH - hPlus;
    const yPrompt = yPlus - hPrompt;
    return `<g>
      <rect x="${x}" y="${yPrompt}" width="${bw}" height="${hPrompt}" rx="4" fill="#FFB74D"/>
      <rect x="${x}" y="${yPlus}" width="${bw}" height="${hPlus}" rx="4" fill="#2E7D32"/>
      ${d.total ? `<text x="${x + bw / 2}" y="${Math.max(12, yPrompt - 4)}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${d.rate}%</text>` : ''}
      <text x="${x + bw / 2}" y="${hgt - 8}" text-anchor="middle" font-size="11" fill="currentColor">${d.label}</text>
    </g>`;
  }).join('');
  const svg = h('div', {
    class: 'trend-chart',
    html: `<svg viewBox="0 0 ${w} ${hgt}" role="img" aria-label="Évolution sur 7 jours">
      <line x1="${padL}" y1="${padT + chartH}" x2="${w - 10}" y2="${padT + chartH}" stroke="currentColor" stroke-opacity=".2"/>
      ${bars}
    </svg>`,
  });
  return h('section', { class: 'card-box' },
    h('h3', {}, '📈 Évolution sur 7 jours (essais & autonomie)'),
    svg,
    h('p', { class: 'note' }, '🟩 Essais réussis seule (✅) · 🟧 Essais avec guidance (👉) · Pourcentage = taux d’autonomie du jour.'));
}

function voiceSettingsBox() {
  const frVoices = availableVoices('fr');
  const arVoices = availableVoices('ar');
  const makeSelect = (lang, list) => {
    const sel = h('select', { onchange: (e) => { setPreferredVoice(lang, e.target.value); speak(lang === 'ar' ? 'سلام عبير' : 'Bonjour Abir', { lang }); } },
      h('option', { value: '' }, '🌟 Automatique (meilleure voix naturelle)'),
      ...list.map((v) => h('option', { value: v.name }, `${v.name} (${v.lang})`)));
    return sel;
  };
  return h('details', { class: 'card-box' },
    h('summary', {}, '🔊 Réglage des voix (Français & Darija / Arabe)'),
    h('div', { class: 'stack' },
      h('label', { class: 'field' }, 'Voix française du téléphone', makeSelect('fr', frVoices)),
      h('label', { class: 'field' }, 'Voix arabe / darija du téléphone', makeSelect('ar', arVoices)),
      h('p', { class: 'note' }, 'Astuce iPhone / iPad : dans Réglages ➔ Accessibilité ➔ Contenu énoncé ➔ Voix, téléchargez une voix « Améliorée » ou « Premium » (ex. Audrey / Thomas en Français, Majed / Laila en Arabe) pour une voix très humaine hors ligne.')));
}

function kpiBlock(title, goals, results, today = null) {
  const done = goals.filter((g) => results.get(g.id).status === 'done').length;
  const started = goals.filter((g) => results.get(g.id).status === 'progress').length;
  const meanLevel = Math.round(goals.reduce((sum, g) => sum + levelOf(g.id).currentLevel, 0) / goals.length);
  return h('section', { class: 'card-box kpi-block' }, h('h3', {}, title),
    h('div', { class: 'kpis' },
      h('div', { class: 'kpi' }, h('strong', {}, `${done}/${goals.length}`), h('span', {}, 'objectifs atteints')),
      h('div', { class: 'kpi' }, h('strong', {}, String(started)), h('span', {}, 'en cours')),
      today === null
        ? h('div', { class: 'kpi' }, h('strong', {}, `${meanLevel}`), h('span', {}, 'niveau moyen / 1000'))
        : h('div', { class: 'kpi' }, h('strong', {}, String(today)), h('span', {}, 'essais aujourd’hui'))),
    h('div', { class: 'progress-bar big' }, h('span', { style: { width: `${percent(done, goals.length)}%` } })));
}

export function dashboardScreen(nav) {
  const body = h('div', { class: 'stack' }, h('p', { class: 'note' }, 'Calcul en cours…'));
  const self = () => dashboardScreen(nav);
  evaluateAll().then(async ({ all, results }) => {
    const today = all.filter((t) => t.day === dayKey() && t.result !== 'log').length;
    await Promise.all(GOALS.map((g) => db.putGoal({ ...g, status: results.get(g.id).status, pct: results.get(g.id).pct, updatedAt: Date.now() })));
    const reinforcers = reinforcerStats(all).filter((r) => r.trials);
    const accidents = accidentStats(all.filter((t) => t.goalId === 'X.3'));
    body.replaceChildren(
      kpiBlock('🎯 PEI 3 mois (objectifs prioritaires)', GOALS.filter((g) => g.phase !== 'next'), results, today),
      kpiBlock('🚀 Parcours ABLLS-R complet (PEI + prochains niveaux)', GOALS, results),
      weeklyTrendChart(all),
      ...SECTIONS.map((s) => h('section', { class: 'card-box' },
        h('h3', {}, `${s.emoji} ${s.id}. ${s.name}`),
        goalsOf(s.id).map((g, i, list) => {
          const r = results.get(g.id);
          const divider = g.phase === 'next' && (i === 0 || list[i - 1].phase !== 'next') ? h('p', { class: 'phase-title small' }, '🚀 Prochains niveaux') : null;
          return [divider, h('button', { type: 'button', class: 'dash-row', onclick: () => nav.openGoal(g.id, self) },
            h('strong', {}, g.id), h('span', { class: 'goal-title' }, g.title, h('small', {}, `${r.detail} · ${r.count} essai(s) · 🌟 niveau ${levelOf(g.id).currentLevel}`)),
            statusChip(r), h('div', { class: 'progress-bar' }, h('span', { style: { width: `${r.pct}%` } })))];
        }))),
      h('section', { class: 'card-box' }, h('h3', {}, '🌍 P.3 Lieu × intervenant (taux de réussite)'), matrixTable(all)),
      h('section', { class: 'card-box' }, h('h3', {}, '🚽 X.3 Accidents'),
        h('p', {}, accidents.weeks ? `Semaine 1 : ${accidents.baseline.toFixed(1)}/jour · cette semaine : ${accidents.current.toFixed(1)}/jour · baisse ${Math.round(accidents.reduction)} %` : 'Pas encore de journal.')),
      h('section', { class: 'card-box' }, h('h3', {}, '🎁 A.2 Renforçateurs'),
        reinforcers.length ? reinforcers.map((r) => h('div', { class: `eff-row${r.effective ? ' ok' : ''}` }, h('span', {}, `${r.emoji} ${r.fr}`), h('span', {}, `${Math.round(r.rate * 100)} % · ${r.trials} essais`))) : h('p', { class: 'note' }, 'Choisissez un renforçateur en A.2 pendant les séances.')),
      h('div', { class: 'row' }, btn('📤 Exporter les essais (CSV pour la psychologue)', exportCsv, 'ghost')),
      voiceSettingsBox(),
      profileForm());
  });
  return h('div', { class: 'screen' }, h('h2', {}, '📊 Progrès PEI'), body);
}
