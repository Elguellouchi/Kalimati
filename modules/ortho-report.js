// v9.0 : Dossier orthophonique (espace adulte, cadenas ouvert). Lit « ortho_logs » et les voix de « recordings ».
// Tout est calculé et généré dans le téléphone : indicateurs, profil pragmatique, matrice des sons, écoute, CSV, bilan à imprimer.
import * as db from '../db.js';
import { h, btn, dayKey, addDays, percent } from './util.js';
import { iconLabel } from './ui-icons.js';
import { playBlob } from '../speech.js';
import { firstName, INTERVENANTS, ENVIRONMENTS } from './aba.js';
import { PHONEMES, FUNCTIONS } from './ex-ortho.js';

const WEEK = 7;
const MASTERED = 80;
const EMERGING = 50;
const MIN_TRIALS = 5;
const MAX_AUDIO = 12;
const PROTOCOLS = { dttc: 'Articulation (DTTC)', mlu: 'Construction de phrases', pragmatic: 'Pragmatique', phono: 'Sons et intonation', aac_mlu: 'Phrases dans Parler' };
const RESULTS = { exact: '✅ Exact', approx: '〰️ Approximatif', prompt: '👉 Guidé', fail: '❌ Non produit' };

const daysBack = (from, count) => new Set(Array.from({ length: count }, (_, i) => addDays(dayKey(), -(from + i))));
const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const fmt = (value, digits = 1) => (value === null ? '—' : value.toFixed(digits));

// Indicateurs d'une période (liste de jours).
function indicators(logs, days) {
  const period = logs.filter((l) => days.has(l.day));
  const latencies = period.filter((l) => l.protocol === 'dttc' && typeof l.latencyMs === 'number').map((l) => l.latencyMs / 1000);
  const mlus = period.filter((l) => typeof l.mlu === 'number' && l.mlu > 0 && (l.protocol === 'aac_mlu' || l.spontaneous)).map((l) => l.mlu);
  const social = period.filter((l) => ['pragmatic', 'aac_mlu', 'mlu'].includes(l.protocol));
  return {
    count: period.length,
    latency: mean(latencies),
    mlu: mean(mlus),
    spontaneity: social.length ? percent(social.filter((l) => l.spontaneous).length, social.length) : null,
    recordings: period.filter((l) => l.recordingId).length,
  };
}

function trend(now, before, lowerIsBetter = false) {
  if (now === null || before === null) return '';
  const diff = now - before;
  if (Math.abs(diff) < 0.05) return ' ➡️';
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  return `${diff > 0 ? ' ↗️' : ' ↘️'}${better ? ' (mieux)' : ''}`;
}

function kpiRow(logs) {
  const week = indicators(logs, daysBack(0, WEEK));
  const previous = indicators(logs, daysBack(WEEK, WEEK));
  const kpi = (value, label) => h('div', { class: 'kpi' }, h('strong', {}, value), h('span', {}, label));
  return h('div', { class: 'kpis ortho-kpis' },
    kpi(`${fmt(week.latency)} s${trend(week.latency, previous.latency, true)}`, 'latence moyenne (7 j)'),
    kpi(`${fmt(week.mlu)}${trend(week.mlu, previous.mlu)}`, 'mots par phrase'),
    kpi(week.spontaneity === null ? '—' : `${week.spontaneity} %`, 'spontané'),
    kpi(String(logs.filter((l) => l.recordingId).length), 'voix enregistrées'));
}

// Aperçu dans Progrès.
export function orthoSummaryCard(logs, onOpen) {
  const today = logs.filter((l) => l.day === dayKey()).length;
  return h('section', { class: 'card-box ortho-summary' },
    h('div', { class: 'row between' }, h('h3', {}, '🗣️ Dossier orthophonique'), btn('Ouvrir le dossier', onOpen, 'primary')),
    kpiRow(logs),
    h('p', { class: 'note' }, `${today} essai(s) aujourd’hui · ${logs.length} au total. Articulation, phrases, situations sociales, sons.`));
}

function pragmaticProfile(logs) {
  const list = logs.filter((l) => l.protocol === 'pragmatic');
  if (!list.length) return h('p', { class: 'note' }, 'Pas encore d’essai dans l’atelier « Situations ».');
  return h('div', { class: 'fn-bars' }, FUNCTIONS.map((fn) => {
    const mine = list.filter((l) => l.fn === fn.id);
    const alone = percent(mine.filter((l) => l.spontaneous).length, mine.length);
    return h('div', { class: 'fn-row' }, h('span', { class: 'fn-name' }, `${fn.emoji} ${fn.label}`),
      h('div', { class: 'progress-bar' }, h('span', { style: { width: `${alone}%` } })),
      h('span', { class: 'fn-value' }, mine.length ? `${alone} % seule · ${mine.length} essai(s)` : 'à travailler'));
  }));
}

function phonemeStats(logs) {
  return PHONEMES.map((phoneme) => {
    const mine = logs.filter((l) => l.protocol === 'dttc' && l.phoneme === phoneme);
    const exact = percent(mine.filter((l) => l.result === 'exact').length, mine.length);
    const approx = percent(mine.filter((l) => l.result === 'approx').length, mine.length);
    // « Acquis » demande au moins MIN_TRIALS essais : un seul essai réussi ne suffit pas.
    const status = !mine.length ? 'none' : (exact >= MASTERED && mine.length >= MIN_TRIALS ? 'ok' : (exact + approx >= EMERGING ? 'mid' : 'low'));
    return { phoneme, n: mine.length, exact, approx, status };
  });
}
const STATUS_TEXT = { none: 'pas encore testé', ok: '✅ acquis', mid: '〰️ en cours', low: '🎯 à travailler' };

function phonemeMatrix(logs) {
  return h('div', { class: 'phoneme-grid' }, phonemeStats(logs).map((p) => h('div', { class: `phoneme-cell ${p.status}` },
    h('strong', {}, p.phoneme), h('span', {}, p.n ? `${p.exact} % exact` : '—'), h('small', {}, p.n ? `${p.approx} % approx · ${p.n} essai(s)` : STATUS_TEXT.none),
    p.n ? h('small', { class: 'phoneme-status' }, STATUS_TEXT[p.status]) : null)));
}

function audioList(logs) {
  const recorded = logs.filter((l) => l.recordingId).sort((a, b) => b.ts - a.ts).slice(0, MAX_AUDIO);
  if (!recorded.length) return h('p', { class: 'note' }, 'Aucune voix enregistrée. Cochez « Enregistrer sa voix » dans l’atelier Articulation.');
  return h('div', { class: 'audio-list' }, recorded.map((log) => {
    const play = btn(iconLabel('play', 'Écouter'), async () => {
      const rec = await db.getRecording(log.recordingId);
      if (rec && rec.blob) playBlob(rec.blob); else play.textContent = 'Introuvable';
    }, 'ghost tiny');
    return h('div', { class: 'audio-row' }, h('span', {}, `${log.day} · ${log.target} ${log.phoneme || ''}`), h('span', { class: 'note' }, RESULTS[log.result] || ''), play);
  }));
}

// ---------- Exports ----------
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const nameOf = (list, id) => { const found = list.find((x) => x.id === id); return found ? found.label : (id || ''); };

function exportCsv(logs) {
  const header = ['date', 'heure', 'atelier', 'cible', 'son', 'palier', 'resultat', 'latence_s', 'mots_par_phrase', 'fonction', 'spontane', 'voix_enregistree', 'intervenant', 'lieu'];
  const rows = [...logs].sort((a, b) => a.ts - b.ts).map((l) => [
    l.day, new Date(l.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), PROTOCOLS[l.protocol] || l.protocol, l.target, l.phoneme, l.step,
    l.result, typeof l.latencyMs === 'number' ? (l.latencyMs / 1000).toFixed(2).replace('.', ',') : '', l.mlu, l.fn, l.spontaneous ? 'oui' : 'non',
    l.recordingId ? 'oui' : 'non', nameOf(INTERVENANTS, l.intervenant), nameOf(ENVIRONMENTS, l.place),
  ].map(csvCell).join(';'));
  const blob = new Blob([`﻿${header.join(';')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const link = h('a', { href: URL.createObjectURL(blob), download: `kalimati-ortho-${dayKey()}.csv` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

function printReport(logs) {
  const week = indicators(logs, daysBack(0, WEEK));
  const month = indicators(logs, daysBack(0, 30));
  const line = (label, a, b) => h('tr', {}, h('th', {}, label), h('td', {}, a), h('td', {}, b));
  const counts = Object.entries(PROTOCOLS).map(([id, label]) => [label, logs.filter((l) => l.protocol === id).length]);
  const area = h('div', { class: 'print-area' }, h('div', { class: 'print-sheet ortho-print' },
    h('h1', {}, `Bilan orthophonique · ${firstName()}`),
    h('p', {}, `Édité le ${new Date().toLocaleDateString('fr-FR')} avec Kalimati. Données notées par les adultes pendant les ateliers et relevées dans l’espace Parler.`),
    h('h2', {}, 'Indicateurs'),
    h('table', {}, h('tr', {}, h('th', {}, ''), h('th', {}, '7 derniers jours'), h('th', {}, '30 derniers jours')),
      line('Essais notés', String(week.count), String(month.count)),
      line('Latence moyenne de réponse', `${fmt(week.latency)} s`, `${fmt(month.latency)} s`),
      line('Longueur moyenne des phrases (mots)', fmt(week.mlu), fmt(month.mlu)),
      line('Productions spontanées', week.spontaneity === null ? '—' : `${week.spontaneity} %`, month.spontaneity === null ? '—' : `${month.spontaneity} %`)),
    h('h2', {}, 'Sons travaillés (articulation)'),
    h('table', {}, h('tr', {}, h('th', {}, 'Son'), h('th', {}, 'Essais'), h('th', {}, 'Exact'), h('th', {}, 'Approximatif'), h('th', {}, 'État')),
      phonemeStats(logs).map((p) => h('tr', {}, h('td', {}, p.phoneme), h('td', {}, String(p.n)), h('td', {}, p.n ? `${p.exact} %` : '—'), h('td', {}, p.n ? `${p.approx} %` : '—'), h('td', {}, STATUS_TEXT[p.status])))),
    h('h2', {}, 'Fonctions de communication'),
    h('table', {}, h('tr', {}, h('th', {}, 'Fonction'), h('th', {}, 'Essais'), h('th', {}, 'Seule')),
      FUNCTIONS.map((fn) => {
        const mine = logs.filter((l) => l.protocol === 'pragmatic' && l.fn === fn.id);
        return h('tr', {}, h('td', {}, fn.label), h('td', {}, String(mine.length)), h('td', {}, mine.length ? `${percent(mine.filter((l) => l.spontaneous).length, mine.length)} %` : '—'));
      })),
    h('h2', {}, 'Volume par atelier'),
    h('table', {}, counts.map(([label, n]) => h('tr', {}, h('th', {}, label), h('td', {}, String(n))))),
    h('p', { class: 'print-note' }, 'Ce relevé aide le suivi. Il ne remplace pas le bilan d’un orthophoniste.')));
  document.body.append(area);
  const cleanup = () => { area.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 300);
}

// ---------- Écran ----------
export function orthoReportScreen(nav) {
  const body = h('div', { class: 'stack' }, h('p', { class: 'note' }, 'Calcul en cours…'));
  db.getAllOrthoLogs().then((logs) => {
    body.replaceChildren(
      kpiRow(logs),
      h('section', { class: 'card-box' }, h('h3', {}, '🤝 Profil pragmatique'), pragmaticProfile(logs)),
      h('section', { class: 'card-box' }, h('h3', {}, '🔤 Matrice des sons'), phonemeMatrix(logs)),
      h('section', { class: 'card-box' }, h('h3', {}, '🎧 Dernières voix enregistrées'), audioList(logs)),
      h('div', { class: 'row wrap' }, btn(iconLabel('download', 'Exporter en CSV'), () => exportCsv(logs), 'ghost'),
        btn(iconLabel('printer', 'Générer Bilan Orthophonique (PDF / Impression)'), () => printReport(logs), 'primary')),
      h('p', { class: 'note' }, 'Le CSV et le bilan sont créés dans le téléphone. Ils contiennent des données de santé : partagez-les seulement avec les soignants.'));
  }).catch((error) => body.replaceChildren(h('p', { class: 'note' }, `Dossier indisponible : ${error.message}`)));
  return h('div', { class: 'screen' },
    h('div', { class: 'screen-head' }, btn('← Retour aux Progrès', () => nav.back(), 'back-btn'), h('div', {}, h('h2', {}, '🗣️ Dossier orthophonique'))),
    body);
}
