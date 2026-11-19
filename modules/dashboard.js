// 📊 Progrès PEI : tableau de bord ABLLS-R des 71 objectifs + Partage Équipe & Console Super-Admin Bêta (protégé par le cadenas parent).
import * as db from '../db.js';
import { h, btn, dayKey, addDays, percent } from './util.js';
import { iconLabel } from './ui-icons.js';
import { visualStyleBox, aboutBox, speechCloudBox } from './about.js';
import { friendsSettingsBox } from './friends.js';
import { cloudSyncAndCohortBox } from './cloud-sync.js';
import { eyeTrackingAndPacksBox } from './eye-and-packs.js';
import { availableVoices, setPreferredVoice, speak } from '../speech.js';
import { profile, saveProfile, firstName } from './aba.js';
import { SECTIONS, GOALS, goalsOf } from './goals.js';
import { reinforcerStats, accidentStats } from './progress.js';
import { evaluateAll, statusChip } from './spaces.js';
import { matrixTable } from './ex-social.js';
import { levelOf } from './levels.js';
import { abcSummaryCard, abcScreen } from './ex-abc.js';
import { orthoSummaryCard, orthoReportScreen } from './ortho-report.js';
import { getAtecHistory, atecSummaryCard, atecScreen } from './atec.js';
import { parentBetaSettingsBox } from './admin-beta.js';

function profileForm() {
  const fields = [['name', 'Prénom de l’enfant'], ['age', 'Âge (ex. 8 ans)'], ['father', 'Prénom du papa'], ['mother', 'Comment elle appelle sa maman'], ['sister', 'Prénom de la sœur ou du frère'], ['psy', 'Prénom de la psychologue / thérapeute'], ['city', 'Ville']];
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
  const blob = new Blob([`\uFEFF${header.join(';')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const link = h('a', { href: URL.createObjectURL(blob), download: `kalimati-essais-${dayKey()}.csv` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

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
    const sel = h('select', { onchange: (e) => { setPreferredVoice(lang, e.target.value); speak(lang === 'ar' ? 'سلام' : `Bonjour ${firstName()}`, { lang }); } },
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

// v10.6 (F18) : bilan PEI & ATEC imprimable pour l'orthophoniste. Tout reste sur le téléphone (impression locale).
function printPeiReport(results, atecHistory, orthoLogs, abcLogs) {
  const peiGoals = GOALS.filter((g) => g.phase !== 'next');
  const worked = peiGoals.filter((g) => { const r = results.get(g.id); return r && (r.count > 0 || r.status !== 'todo'); });
  const doneCount = peiGoals.filter((g) => results.get(g.id)?.status === 'done').length;
  const progressCount = peiGoals.filter((g) => results.get(g.id)?.status === 'progress').length;
  const latestAtec = atecHistory.length ? atecHistory[atecHistory.length - 1] : null;
  document.querySelectorAll('.print-area.pei-print').forEach((n) => n.remove());
  const area = h('div', { class: 'print-area pei-print' },
    h('div', { class: 'print-sheet ortho-print' },
      h('h1', {}, `Bilan de suivi PEI & ATEC · ${firstName()} (${dayKey()})`),
      h('p', {}, `Objectifs PEI atteints : ${doneCount} / ${peiGoals.length} · En cours : ${progressCount} · Notes orthophonie : ${orthoLogs.length} · Journal ABC : ${abcLogs.length}`),
      latestAtec ? h('p', {}, `Dernier bilan ATEC (${latestAtec.day || ''}) : score total ${latestAtec.total ?? '?'} / 179.`) : null,
      h('h2', {}, 'Objectifs travaillés'),
      worked.length ? h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'Code'), h('th', {}, 'Objectif'), h('th', {}, 'Statut'), h('th', {}, 'Détail'))),
        h('tbody', {}, worked.map((g) => {
          const r = results.get(g.id);
          return h('tr', {}, h('td', {}, g.id), h('td', {}, g.title),
            h('td', {}, r.status === 'done' ? 'Atteint' : r.status === 'progress' ? `${r.pct} %` : 'À commencer'),
            h('td', {}, `${r.detail} (${r.count} essais, niv. ${levelOf(g.id).currentLevel})`));
        }))) : h('p', {}, 'Aucun essai noté pour le moment.'),
      h('p', { class: 'print-note' }, 'Rapport créé sur le téléphone avec Kalimati. Rien n’a été envoyé sur internet.')));
  document.body.append(area);
  const cleanup = () => { area.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  setTimeout(() => window.print(), 250);
}

// v10.3.1 : la page Progrès s'affiche toujours. Une partie en panne affiche un petit message au lieu de tout bloquer.
const safePart = (label, build) => {
  try { return build(); } catch (err) {
    console.error(`[Progrès] ${label}`, err);
    return h('p', { class: 'note' }, `⚠️ ${label} : indisponible pour le moment (${String(err?.message || err).slice(0, 80)}).`);
  }
};
const safeAsync = async (promise, fallback, ms = 8000) => {
  try {
    return await Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('trop long')), ms))]);
  } catch (err) { console.error('[Progrès]', err); return fallback; }
};

export function dashboardScreen(nav) {
  const body = h('div', { class: 'stack' }, h('p', { class: 'note' }, 'Calcul en cours…'));
  const self = () => dashboardScreen(nav);
  (async () => {
    const evaluated = await safeAsync(evaluateAll(), null);
    const all = evaluated?.all || [];
    const results = evaluated?.results || new Map();
    const today = all.filter((t) => t.day === dayKey() && t.result !== 'log').length;
    if (evaluated) {
      safeAsync(Promise.all(GOALS.filter((g) => results.get(g.id)).map((g) => db.putGoal({ ...g, status: results.get(g.id).status, pct: results.get(g.id).pct, updatedAt: Date.now() }))), null);
    }
    const [abcLogs, orthoLogs, atecHistory] = await Promise.all([
      safeAsync(db.getAllAbcLogs(), []),
      safeAsync(db.getAllOrthoLogs(), []),
      safeAsync(getAtecHistory(), []),
    ]);
    const parts = [
      evaluated ? null : h('p', { class: 'note' }, '⚠️ Le calcul des objectifs n’a pas abouti. Les réglages restent disponibles ci-dessous.'),
      evaluated && safePart('Objectifs PEI', () => kpiBlock('🎯 PEI 3 mois (objectifs prioritaires)', GOALS.filter((g) => g.phase !== 'next'), results, today)),
      evaluated && safePart('Parcours ABLLS-R', () => kpiBlock('🚀 Parcours ABLLS-R complet (PEI + prochains niveaux)', GOALS, results)),
      safePart('Réglages parent', () => parentBetaSettingsBox({ onRefresh: () => nav.openScreen(self) })),
      safePart('Journal ABC', () => abcSummaryCard(abcLogs, () => nav.openScreen(() => abcScreen(nav), self))),
      safePart('Orthophonie', () => orthoSummaryCard(orthoLogs, () => nav.openScreen(() => orthoReportScreen(nav), self))),
      safePart('Bilan ATEC', () => atecSummaryCard(atecHistory, () => nav.openScreen(() => atecScreen(nav), self))),
      safePart('Courbe de la semaine', () => weeklyTrendChart(all)),
      // v10.6 (F18) : impression locale du bilan pour l'orthophoniste.
      evaluated && h('div', { class: 'row' }, btn(iconLabel('printer', 'Imprimer le bilan PEI & ATEC (orthophoniste)'), () => printPeiReport(results, atecHistory, orthoLogs, abcLogs), 'ghost')),
      // v10.6 (F14) : les 23 sections sont repliées ; on ouvre seulement celle qu'on veut.
      ...(evaluated ? SECTIONS.map((s) => safePart(`Section ${s.id}`, () => h('details', { class: 'card-box dash-section' },
        h('summary', {}, `${s.emoji} ${s.id}. ${s.name}`),
        goalsOf(s.id).map((g, i, list) => {
          const r = results.get(g.id);
          if (!r) return null;
          const divider = g.phase === 'next' && (i === 0 || list[i - 1].phase !== 'next') ? h('p', { class: 'phase-title small' }, '🚀 Prochains niveaux') : null;
          return [divider, h('button', { type: 'button', class: 'dash-row', onclick: () => nav.openGoal(g.id, self) },
            h('strong', {}, g.id), h('span', { class: 'goal-title' }, g.title, h('small', {}, `${r.detail} · ${r.count} essai(s) · 🌟 niveau ${levelOf(g.id).currentLevel}`)),
            statusChip(r), h('div', { class: 'progress-bar' }, h('span', { style: { width: `${r.pct}%` } })))];
        })))) : []),
      safePart('Lieu × intervenant', () => h('section', { class: 'card-box' }, h('h3', {}, '🌍 P.3 Lieu × intervenant (taux de réussite)'), matrixTable(all))),
      safePart('Accidents', () => {
        const accidents = accidentStats(all.filter((t) => t.goalId === 'X.3'));
        return h('section', { class: 'card-box' }, h('h3', {}, '🚽 X.3 Accidents'),
          h('p', {}, accidents.weeks ? `Semaine 1 : ${accidents.baseline.toFixed(1)}/jour · cette semaine : ${accidents.current.toFixed(1)}/jour · baisse ${Math.round(accidents.reduction)} %` : 'Pas encore de journal.'));
      }),
      safePart('Renforçateurs', () => {
        const reinforcers = reinforcerStats(all).filter((r) => r.trials);
        return h('section', { class: 'card-box' }, h('h3', {}, '🎁 A.2 Renforçateurs'),
          reinforcers.length ? reinforcers.map((r) => h('div', { class: `eff-row${r.effective ? ' ok' : ''}` }, h('span', {}, `${r.emoji} ${r.fr}`), h('span', {}, `${Math.round(r.rate * 100)} % · ${r.trials} essais`))) : h('p', { class: 'note' }, 'Choisissez un renforçateur en A.2 pendant les séances.'));
      }),
      h('div', { class: 'row' }, btn(iconLabel('download', 'Exporter les essais (CSV pour la psychologue)'), exportCsv, 'ghost')),
      safePart('Voix', () => voiceSettingsBox()),
      safePart('Voix en ligne', () => speechCloudBox()),
      safePart('Images', () => visualStyleBox()),
      safePart('Amis', () => friendsSettingsBox()),
      // v10.1 : mode regard (dwell), suivi de tête par caméra locale, packs de cartes ARASAAC.
      safePart('Mode Regard', () => eyeTrackingAndPacksBox({ onCardsAdded: () => document.dispatchEvent(new CustomEvent('kalimati-data-updated')) })),
      // v9.15 : synchro équipe chiffrée (Supabase) + suivi clinique. Rien ne part sans le bouton « Synchroniser ».
      safePart('Synchronisation', () => cloudSyncAndCohortBox({ onMerged: () => document.dispatchEvent(new CustomEvent('kalimati-data-updated')) })),
      safePart('Profil', () => profileForm()),
      safePart('À propos', () => aboutBox()),
    ];
    body.replaceChildren(...parts.filter(Boolean));
  })().catch((err) => {
    body.replaceChildren(h('p', { class: 'note' }, `⚠️ La page Progrès n’a pas pu s’afficher (${String(err?.message || err).slice(0, 80)}). Rouvrez Kalimati.`));
  });
  return h('div', { class: 'screen' }, h('h2', {}, '📊 Progrès PEI & Réglages Adultes'), body);
}
