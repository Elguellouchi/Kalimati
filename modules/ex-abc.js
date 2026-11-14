// Journal scientifique des comportements à problème (méthode ABA / FBA : ABC + SEAT + Scatterplot).
// Conçu pour les parents et la psychologue (Hosna Mehri) dans l'espace adulte, 100 % hors ligne.
import * as db from '../db.js';
import { h, btn, uid, dayKey, addDays, percent } from './util.js';
import { clinic, INTERVENANTS, ENVIRONMENTS } from './aba.js';

export const SETTING_EVENTS = [
  { id: 'fatigue', label: '😴 Fatigue / mauvais sommeil' },
  { id: 'hunger', label: '🍽️ Faim / soif' },
  { id: 'pain', label: '🤕 Douleur / inconfort' },
  { id: 'noise', label: '🔊 Bruit / surcharge' },
  { id: 'change', label: '🔄 Changement imprévu' },
  { id: 'illness', label: '🤒 Maladie / fièvre' },
];

export const ANTECEDENTS = [
  { id: 'demand', label: '📚 Consigne / tâche difficile', fn: 'E' },
  { id: 'transition', label: '⏹️ Transition / arrêt d’activité', fn: 'E' },
  { id: 'denied', label: '🚫 Refus d’objet / aliment / écran', fn: 'T' },
  { id: 'waiting', label: '⏳ Attente / adulte occupé', fn: 'A' },
  { id: 'sensory', label: '🎆 Surcharge sensorielle', fn: 'S' },
  { id: 'alone', label: '😶 Ennui / sans sollicitation', fn: 'S' },
];

export const BEHAVIORS = [
  { id: 'scream', label: '🗣️ Cris / pleurs intenses' },
  { id: 'sib', label: '🤕 Auto-agression (taper tête/corps)' },
  { id: 'aggression', label: '✋ Hétéro-agression (pousser/mordre)' },
  { id: 'throw', label: '💥 Jeter / casser des objets' },
  { id: 'elope', label: '🏃 Fuite / quitter la table' },
  { id: 'stereo', label: '🌀 Stéréotypie envahissante' },
  { id: 'refusal', label: '🛑 Blocage / refus complet' },
];

export const CONSEQUENCES = [
  { id: 'escape_given', label: '🛑 Tâche arrêtée / allégée', fn: 'E' },
  { id: 'tangible_given', label: '🎁 Objet / activité donné(e)', fn: 'T' },
  { id: 'attention_given', label: '💬 Réconfort / réprimande / attention', fn: 'A' },
  { id: 'redirect', label: '🧘 Redirection / espace calme 🌈', fn: null },
  { id: 'extinction', label: '🙈 Comportement ignoré (sécurité OK)', fn: null },
  { id: 'prompt_aac', label: '🗣️ Incitation à utiliser CAA / mot', fn: null },
];

export const FUNCTIONS_SEAT = [
  { id: 'S', code: 'S', label: 'Sensoriel / Automatique', color: '#7E57C2', tip: 'Régulation interne, stimulation ou fuite d’un inconfort sensoriel' },
  { id: 'E', code: 'E', label: 'Échappement / Évitement', color: '#E65100', tip: 'Éviter ou arrêter une tâche, consigne ou transition difficile' },
  { id: 'A', code: 'A', label: 'Attention', color: '#1565C0', tip: 'Obtenir une réaction, du réconfort ou de l’attention sociale' },
  { id: 'T', code: 'T', label: 'Tangible / Accès', color: '#2E7D32', tip: 'Obtenir un objet, aliment, jeu ou activité souhaitée' },
];

export const REPLACEMENTS = [
  { id: 'none', label: '— Aucun utilisé' },
  { id: 'help', label: '🆘 « Aide-moi »' },
  { id: 'break', label: '⏸️ « Pause »' },
  { id: 'wait', label: '⏳ « Attends »' },
  { id: 'done', label: '✅ « Fini »' },
  { id: 'calm', label: '🎧 « Calme / Casque »' },
  { id: 'aac', label: '🗣️ Demande CAA / verbale' },
];

export const INTENSITIES = [
  { id: 1, label: '1 · Léger', color: '#8BC34A' },
  { id: 2, label: '2 · Modéré', color: '#FFB300' },
  { id: 3, label: '3 · Élevé', color: '#F4511E' },
  { id: 4, label: '4 · Danger', color: '#B71C1C' },
];

const SLOTS = [
  { id: 'morning', label: 'Matin (7h-12h)', check: (hr) => hr >= 7 && hr < 12 },
  { id: 'noon', label: 'Midi (12h-14h)', check: (hr) => hr >= 12 && hr < 14 },
  { id: 'afternoon', label: 'Après-midi (14h-18h)', check: (hr) => hr >= 14 && hr < 18 },
  { id: 'evening', label: 'Soir / Nuit (18h-7h)', check: (hr) => hr >= 18 || hr < 7 },
];

const labelOf = (list, id) => list.find((x) => x.id === id)?.label || id || '';
const fmtDur = (sec) => {
  const s = Math.max(0, Math.round(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m} min ${r ? `${r} s` : ''}`.trim() : `${r} s`;
};
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export function suggestFunction(antecedents, consequences) {
  const scores = { S: 0, E: 0, A: 0, T: 0 };
  antecedents.forEach((id) => {
    const fn = ANTECEDENTS.find((a) => a.id === id)?.fn;
    if (fn) scores[fn] += 1;
  });
  consequences.forEach((id) => {
    const fn = CONSEQUENCES.find((c) => c.id === id)?.fn;
    if (fn) scores[fn] += 2; // La conséquence maintient le comportement (poids x2 en FBA)
  });
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'E';
}

export async function exportAbcCsv() {
  const logs = (await db.getAllAbcLogs()).sort((a, b) => a.ts - b.ts);
  const header = [
    'date', 'heure', 'lieu', 'intervenant', 'facteurs_contextuels',
    'antecedents_A', 'comportement_B', 'intensite_1_4', 'duree_sec',
    'consequences_C', 'fonction_SEAT', 'comportement_remplacement', 'notes',
  ];
  const rows = logs.map((l) => {
    const d = new Date(l.ts);
    return [
      l.day,
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      labelOf(ENVIRONMENTS, l.place),
      labelOf(INTERVENANTS, l.intervenant),
      (l.setting || []).map((id) => labelOf(SETTING_EVENTS, id)).join(' | '),
      (l.antecedents || []).map((id) => labelOf(ANTECEDENTS, id)).join(' | '),
      labelOf(BEHAVIORS, l.behavior),
      l.intensity,
      l.durationSec || 0,
      (l.consequences || []).map((id) => labelOf(CONSEQUENCES, id)).join(' | '),
      labelOf(FUNCTIONS_SEAT, l.fn),
      labelOf(REPLACEMENTS, l.replacement),
      l.note || '',
    ].map(csvCell).join(';');
  });
  const blob = new Blob([`\uFEFF${header.join(';')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const link = h('a', { href: URL.createObjectURL(blob), download: `kalimati-abc-${dayKey()}.csv` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

// Aperçu compact affiché directement dans le tableau de bord Progrès PEI
export function abcSummaryCard(logs, onOpen) {
  const today = dayKey();
  const weekDays = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, -i)));
  const weekLogs = logs.filter((l) => weekDays.has(l.day));
  const todayCount = logs.filter((l) => l.day === today).length;
  const avgInt = weekLogs.length
    ? (weekLogs.reduce((s, l) => s + (l.intensity || 1), 0) / weekLogs.length).toFixed(1)
    : '—';
  const fnCounts = { S: 0, E: 0, A: 0, T: 0 };
  weekLogs.forEach((l) => { if (fnCounts[l.fn] !== undefined) fnCounts[l.fn] += 1; });
  const topFn = weekLogs.length
    ? FUNCTIONS_SEAT.find((f) => f.id === Object.entries(fnCounts).sort((a, b) => b[1] - a[1])[0][0])
    : null;

  return h('section', { class: 'card-box abc-summary' },
    h('div', { class: 'row between' },
      h('h3', {}, '📝 Comportements à problème (ABC / FBA)'),
      btn('Ouvrir le journal ABC', onOpen, 'primary')),
    h('div', { class: 'kpis' },
      h('div', { class: 'kpi' }, h('strong', {}, String(todayCount)), h('span', {}, 'aujourd’hui')),
      h('div', { class: 'kpi' }, h('strong', {}, String(weekLogs.length)), h('span', {}, 'sur 7 jours')),
      h('div', { class: 'kpi' }, h('strong', {}, `${avgInt}/4`), h('span', {}, 'intensité moy.')),
      h('div', { class: 'kpi' }, h('strong', {}, topFn ? topFn.code : '—'), h('span', {}, topFn ? topFn.label.split(' ')[0] : 'fonction dom.'))),
    h('p', { class: 'note' }, 'Méthode scientifique ABA (Antécédent – Comportement – Conséquence, 4 fonctions SEAT et Scatterplot horaire).'));
}

function seatDistributionChart(logs) {
  if (!logs.length) return h('p', { class: 'note' }, 'Aucune observation enregistrée sur la période.');
  const total = logs.length;
  return h('div', { class: 'stack' }, FUNCTIONS_SEAT.map((f) => {
    const count = logs.filter((l) => l.fn === f.id).length;
    const pct = percent(count, total);
    return h('div', { class: 'seat-row' },
      h('div', { class: 'row between' },
        h('strong', {}, `${f.code} · ${f.label}`),
        h('span', { class: 'note' }, `${count} (${pct} %)`)),
      h('div', { class: 'progress-bar' }, h('span', { style: { width: `${pct}%`, background: f.color } })));
  }));
}

function scatterplotMatrix(logs) {
  const today = dayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const table = h('table', { class: 'scatter-table' },
    h('thead', {}, h('tr', {},
      h('th', {}, 'Créneau'),
      ...days.map((d) => h('th', {}, `${d.slice(8)}/${d.slice(5, 7)}`)))),
    h('tbody', {}, ...SLOTS.map((slot) => h('tr', {},
      h('th', {}, slot.label),
      ...days.map((d) => {
        const hits = logs.filter((l) => l.day === d && slot.check(new Date(l.ts).getHours()));
        if (!hits.length) return h('td', { class: 'scatter-cell empty' }, '·');
        const maxInt = Math.max(...hits.map((x) => x.intensity || 1));
        const color = INTENSITIES.find((i) => i.id === maxInt)?.color || '#FFB300';
        return h('td', { class: 'scatter-cell hit' },
          h('span', { class: 'scatter-dot', style: { background: color }, title: `${hits.length} épisode(s), intensité max ${maxInt}/4` }, String(hits.length)));
      })))));
  return h('div', { class: 'scatter-wrap' }, table);
}

function abcTrendSvg(logs) {
  const today = dayKey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const counts = days.map((d) => ({ day: d, label: d.slice(8), n: logs.filter((l) => l.day === d).length }));
  const maxN = Math.max(4, ...counts.map((c) => c.n));
  const w = 520; const hgt = 130; const padL = 24; const padB = 24; const padT = 16;
  const chartH = hgt - padB - padT;
  const colW = (w - padL - 12) / 14;
  const bars = counts.map((c, i) => {
    const x = padL + i * colW + 4;
    const bw = Math.max(12, colW - 8);
    const bh = Math.round((c.n / maxN) * chartH);
    const y = padT + chartH - bh;
    return `<g>
      <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="3" fill="#E65100" fill-opacity="0.85"/>
      ${c.n ? `<text x="${x + bw / 2}" y="${Math.max(11, y - 3)}" text-anchor="middle" font-size="10" font-weight="700" fill="currentColor">${c.n}</text>` : ''}
      <text x="${x + bw / 2}" y="${hgt - 6}" text-anchor="middle" font-size="10" fill="currentColor">${c.label}</text>
    </g>`;
  }).join('');
  return h('div', {
    class: 'trend-chart',
    html: `<svg viewBox="0 0 ${w} ${hgt}" role="img" aria-label="Fréquence sur 14 jours">
      <line x1="${padL}" y1="${padT + chartH}" x2="${w - 8}" y2="${padT + chartH}" stroke="currentColor" stroke-opacity=".2"/>
      ${bars}
    </svg>`,
  });
}

export function abcScreen(nav) {
  const state = {
    setting: new Set(),
    antecedents: new Set(),
    behavior: BEHAVIORS[0].id,
    intensity: 2,
    consequences: new Set(),
    fn: 'E',
    fnManual: false,
    replacement: 'none',
    durationSec: 0,
    timerStart: null,
    timerTick: null,
    place: clinic.environment || 'home',
    intervenant: clinic.intervenant || 'parents',
    filterFn: 'ALL',
  };

  const formStatus = h('span', { class: 'note' });
  const noteInput = h('input', { placeholder: 'Précision optionnelle (ex. refus de ranger la tablette)…', maxlength: 140 });
  const durInput = h('input', { type: 'number', min: 0, max: 180, value: '0', style: { width: '72px' } });
  const chronoLabel = h('strong', {}, '00:00');
  const fnButtonsBox = h('div', { class: 'chip-grid' });
  const analysisBox = h('div', { class: 'stack' });

  const stopChrono = () => {
    if (state.timerTick) { clearInterval(state.timerTick); state.timerTick = null; }
    state.timerStart = null;
  };

  const renderFnChips = () => {
    fnButtonsBox.replaceChildren(...FUNCTIONS_SEAT.map((f) => h('button', {
      type: 'button',
      class: `abc-chip${state.fn === f.id ? ' on' : ''}`,
      style: state.fn === f.id ? { borderColor: f.color, background: `${f.color}18` } : {},
      onclick: () => { state.fn = f.id; state.fnManual = true; renderFnChips(); },
      title: f.tip,
    }, `${f.code} · ${f.label}`)));
  };

  const updateSuggestedFn = () => {
    if (!state.fnManual) {
      state.fn = suggestFunction([...state.antecedents], [...state.consequences]);
      renderFnChips();
    }
  };

  const multiChipGroup = (items, set, onChange) => {
    const wrap = h('div', { class: 'chip-grid' });
    items.forEach((item) => {
      const b = h('button', {
        type: 'button',
        class: `abc-chip${set.has(item.id) ? ' on' : ''}`,
        onclick: () => {
          if (set.has(item.id)) set.delete(item.id);
          else set.add(item.id);
          b.classList.toggle('on', set.has(item.id));
          if (onChange) onChange();
        },
      }, item.label);
      wrap.append(b);
    });
    return wrap;
  };

  const singleChipGroup = (items, current, onPick) => {
    const wrap = h('div', { class: 'chip-grid' });
    const draw = (val) => wrap.replaceChildren(...items.map((item) => h('button', {
      type: 'button',
      class: `abc-chip${val === item.id ? ' on' : ''}`,
      style: item.color && val === item.id ? { borderColor: item.color, background: `${item.color}22` } : {},
      onclick: () => { draw(item.id); onPick(item.id); },
    }, item.label)));
    draw(current);
    return wrap;
  };

  const chronoBtn = btn('⏱️ Démarrer chrono', () => {
    if (state.timerStart) {
      state.durationSec = Math.round((Date.now() - state.timerStart) / 1000);
      durInput.value = String(Math.max(1, Math.round(state.durationSec / 60)));
      stopChrono();
      chronoBtn.textContent = '⏱️ Relancer chrono';
    } else {
      state.timerStart = Date.now();
      chronoBtn.textContent = '⏹️ Arrêter chrono';
      state.timerTick = setInterval(() => {
        const s = Math.round((Date.now() - state.timerStart) / 1000);
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        chronoLabel.textContent = `${mm}:${ss}`;
        state.durationSec = s;
      }, 500);
    }
  }, 'ghost');

  async function refreshAnalysis() {
    const all = (await db.getAllAbcLogs()).sort((a, b) => b.ts - a.ts);
    const today = dayKey();
    const last30 = new Set(Array.from({ length: 30 }, (_, i) => addDays(today, -i)));
    const logs30 = all.filter((l) => last30.has(l.day));
    const filtered = state.filterFn === 'ALL' ? all : all.filter((l) => l.fn === state.filterFn);
    const fctUsed = logs30.filter((l) => l.replacement && l.replacement !== 'none').length;

    const filterBar = h('div', { class: 'row' },
      ...[{ id: 'ALL', label: 'Tous' }, ...FUNCTIONS_SEAT.map((f) => ({ id: f.id, label: `${f.code} · ${f.label.split(' ')[0]}` }))].map((opt) =>
        btn(opt.label, () => { state.filterFn = opt.id; refreshAnalysis(); }, state.filterFn === opt.id ? 'primary' : 'ghost')));

    const historyRows = filtered.slice(0, 25).map((l) => {
      const d = new Date(l.ts);
      const fnObj = FUNCTIONS_SEAT.find((f) => f.id === l.fn);
      const intObj = INTENSITIES.find((i) => i.id === l.intensity);
      return h('div', { class: 'abc-history-row' },
        h('div', { class: 'row between' },
          h('strong', {}, `${l.day.slice(5)} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · ${labelOf(BEHAVIORS, l.behavior)}`),
          h('span', { class: 'chip', style: { background: `${fnObj?.color || '#555'}20`, color: fnObj?.color || '#333' } }, fnObj ? `${fnObj.code} · ${fnObj.label.split(' ')[0]}` : l.fn)),
        h('p', { class: 'note' },
          `Intensité : ${intObj?.label || l.intensity} · Durée : ${fmtDur(l.durationSec)} · ${labelOf(ENVIRONMENTS, l.place)}`
          + (l.antecedents?.length ? ` · A : ${l.antecedents.map((x) => labelOf(ANTECEDENTS, x)).join(', ')}` : '')
          + (l.consequences?.length ? ` · C : ${l.consequences.map((x) => labelOf(CONSEQUENCES, x)).join(', ')}` : '')
          + (l.replacement && l.replacement !== 'none' ? ` · Remplacement : ${labelOf(REPLACEMENTS, l.replacement)}` : '')
          + (l.note ? ` · « ${l.note} »` : '')),
        h('div', { class: 'row' }, btn('🗑️ Supprimer', async () => { await db.deleteAbcLog(l.id); refreshAnalysis(); }, 'ghost tiny')));
    });

    analysisBox.replaceChildren(
      h('section', { class: 'card-box' },
        h('h3', {}, '📊 Analyse fonctionnelle (30 derniers jours)'),
        h('div', { class: 'kpis' },
          h('div', { class: 'kpi' }, h('strong', {}, String(logs30.length)), h('span', {}, 'épisodes (30j)')),
          h('div', { class: 'kpi' }, h('strong', {}, logs30.length ? fmtDur(logs30.reduce((s, l) => s + (l.durationSec || 0), 0) / logs30.length) : '—'), h('span', {}, 'durée moyenne')),
          h('div', { class: 'kpi' }, h('strong', {}, `${percent(fctUsed, logs30.length)} %`), h('span', {}, 'remplacement CAA'))),
        seatDistributionChart(logs30)),
      h('section', { class: 'card-box' },
        h('h3', {}, '🕒 Scatterplot (7 jours × créneaux horaires)'),
        scatterplotMatrix(all),
        h('p', { class: 'note' }, 'Permet de repérer les moments critiques de la journée (transitions, fatigue, faim).')),
      h('section', { class: 'card-box' },
        h('h3', {}, '📈 Évolution sur 14 jours'),
        abcTrendSvg(all)),
      h('section', { class: 'card-box' },
        h('div', { class: 'row between' },
          h('h3', {}, `📋 Historique (${filtered.length})`),
          btn('📤 Exporter CSV (Hosna)', exportAbcCsv, 'ghost')),
        filterBar,
        filtered.length ? h('div', { class: 'stack' }, historyRows) : h('p', { class: 'note' }, 'Aucune entrée pour ce filtre.')));
  }

  renderFnChips();
  refreshAnalysis();

  const saveBtn = btn('💾 Enregistrer l’observation ABC', async () => {
    if (state.timerStart) stopChrono();
    const minVal = parseFloat(durInput.value || '0') || 0;
    const durSec = state.durationSec > 0 ? state.durationSec : Math.round(minVal * 60);
    const now = new Date();
    const entry = {
      id: uid('abc'),
      ts: now.getTime(),
      day: dayKey(now),
      place: state.place,
      intervenant: state.intervenant,
      setting: [...state.setting],
      antecedents: [...state.antecedents],
      behavior: state.behavior,
      intensity: state.intensity,
      durationSec: durSec,
      consequences: [...state.consequences],
      fn: state.fn,
      replacement: state.replacement,
      note: noteInput.value.trim(),
    };
    await db.addAbcLog(entry);
    formStatus.textContent = 'Observation ABC enregistrée ✅';
    state.durationSec = 0;
    chronoLabel.textContent = '00:00';
    chronoBtn.textContent = '⏱️ Démarrer chrono';
    durInput.value = '0';
    noteInput.value = '';
    state.fnManual = false;
    await refreshAnalysis();
  }, 'primary');

  return h('div', { class: 'screen' },
    h('div', { class: 'nav-btns' }, btn('← Retour aux Progrès', () => { stopChrono(); nav.back(); }, 'back-btn')),
    h('h2', {}, '📝 Suivi scientifique ABC (FBA)'),
    h('p', { class: 'note' }, 'Saisie rapide en 4 étapes selon le protocole ABA d’évaluation fonctionnelle (Antécédent · Comportement · Conséquence · Fonction SEAT).'),
    h('section', { class: 'card-box stack' },
      h('h3', {}, '1. Contexte & Facteurs déclenchants (Setting Events)'),
      h('div', { class: 'row' },
        h('div', {}, h('small', { class: 'note' }, 'Lieu'), singleChipGroup(ENVIRONMENTS, state.place, (v) => { state.place = v; })),
        h('div', {}, h('small', { class: 'note' }, 'Intervenant'), singleChipGroup(INTERVENANTS, state.intervenant, (v) => { state.intervenant = v; }))),
      multiChipGroup(SETTING_EVENTS, state.setting),
      h('h3', {}, '2. A — Antécédent (juste avant)'),
      multiChipGroup(ANTECEDENTS, state.antecedents, updateSuggestedFn),
      h('h3', {}, '3. B — Comportement observable, Intensité & Durée'),
      singleChipGroup(BEHAVIORS, state.behavior, (v) => { state.behavior = v; }),
      h('small', { class: 'note' }, 'Intensité (1 = léger à 4 = danger)'),
      singleChipGroup(INTENSITIES, state.intensity, (v) => { state.intensity = v; }),
      h('div', { class: 'row' }, chronoBtn, chronoLabel, h('span', { class: 'note' }, 'ou durée (min) :'), durInput),
      h('h3', {}, '4. C — Conséquence (juste après) & Fonction SEAT'),
      multiChipGroup(CONSEQUENCES, state.consequences, updateSuggestedFn),
      h('small', { class: 'note' }, 'Fonction supposée (suggérée automatiquement d’après A + C, modifiable) :'),
      fnButtonsBox,
      h('small', { class: 'note' }, 'Comportement de remplacement enseigné / utilisé :'),
      singleChipGroup(REPLACEMENTS, state.replacement, (v) => { state.replacement = v; }),
      noteInput,
      h('div', { class: 'row' }, saveBtn, formStatus)),
    analysisBox);
}
