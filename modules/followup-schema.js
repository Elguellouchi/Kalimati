// Fiche de suivi pseudonymisée : schéma pur, sans DOM ni réseau.
// Le téléphone de la famille construit la fiche ; l'espace thérapeute la valide avant de la garder.
// Rien d'identifiant ici : ni prénom, ni photo, ni voix, ni date de naissance, ni texte libre.

export const FOLLOWUP_KIND = 'kalimati-followup';
export const FOLLOWUP_VERSION = 1;
// Alphabet sans I, O, 0 ni 1 : un code se lit et se recopie sans confusion.
export const CODE_RE = /^KALI-[A-HJ-NP-Z2-9]{4}$/;
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const GOAL_ID_RE = /^[A-Z]\.[0-9]{1,2}$/;
const SAFE_ID_RE = /^[a-z][a-z0-9_-]{0,19}$/;
const AGE_BANDS = ['moins de 4 ans', '4 à 6 ans', '7 à 9 ans', '10 à 12 ans', '13 ans et plus'];
const STATUSES = new Set(['todo', 'progress', 'done']);
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_SNAPSHOT_GOALS = 200;
const MAX_SNAPSHOT_DAYS = 120;

export function newFollowupCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `KALI-${[...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('')}`;
}

export function ageBandOf(age) {
  const years = Number.parseInt(String(age ?? ''), 10);
  if (!Number.isFinite(years) || years <= 0) return null;
  if (years < 4) return AGE_BANDS[0];
  if (years < 7) return AGE_BANDS[1];
  if (years < 10) return AGE_BANDS[2];
  if (years < 13) return AGE_BANDS[3];
  return AGE_BANDS[4];
}

const int = (value, max = 1e6) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(max, Math.round(n))) : 0;
};
const pct = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
};
const dayOrNull = (value) => (typeof value === 'string' && DAY_RE.test(value) && !Number.isNaN(Date.parse(value)) ? value : null);
const safeId = (value) => (typeof value === 'string' && SAFE_ID_RE.test(value) ? value : null);

// Reconstruit la fiche champ par champ : tout ce qui n'est pas prévu ici est écarté.
export function normalizeFollowup(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Fiche illisible.');
  if (raw.kind !== FOLLOWUP_KIND) throw new Error('Ce fichier n’est pas une fiche Kalimati.');
  if (Number(raw.v) !== FOLLOWUP_VERSION) throw new Error(`Version de fiche non prise en charge (${raw.v ?? '?'}).`);
  const code = typeof raw.code === 'string' ? raw.code.trim().toUpperCase() : '';
  if (!CODE_RE.test(code)) throw new Error('Code de fiche invalide (attendu : KALI-XXXX).');
  const day = dayOrNull(raw.day);
  if (!day) throw new Error('Date de fiche invalide.');

  const totals = raw.totals && typeof raw.totals === 'object' ? raw.totals : {};
  const goals = Array.isArray(raw.goals) ? raw.goals.slice(0, MAX_SNAPSHOT_GOALS).flatMap((g) => {
    if (!g || typeof g !== 'object' || typeof g.id !== 'string' || !GOAL_ID_RE.test(g.id)) return [];
    return [{ id: g.id, status: STATUSES.has(g.status) ? g.status : 'todo', pct: pct(g.pct) ?? 0, count: int(g.count) }];
  }) : [];
  const daysByDay = new Map();
  if (Array.isArray(raw.days)) {
    raw.days.slice(-MAX_SNAPSHOT_DAYS * 2).forEach((d) => {
      const dk = d && dayOrNull(d.day);
      if (dk) daysByDay.set(dk, { day: dk, trials: int(d.trials), autonomy: pct(d.autonomy) });
    });
  }
  const days = [...daysByDay.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-MAX_SNAPSHOT_DAYS);
  const rows = (list, max = 12) => (Array.isArray(list) ? list.slice(0, max).flatMap((row) => {
    const id = safeId(row && row.id);
    return id ? [{ id, trials: int(row.trials), autonomy: pct(row.autonomy), days: int(row.days, 400) }] : [];
  }) : []);
  const prompts = {};
  if (raw.prompts && typeof raw.prompts === 'object') {
    for (const [key, value] of Object.entries(raw.prompts).slice(0, 12)) {
      const id = safeId(key);
      if (id) prompts[id] = int(value);
    }
  }
  const group = (value) => (value && typeof value === 'object' ? value : {});
  const routines = group(raw.routines);
  const routineLogs = int(routines.logs);
  const abc = group(raw.abc);
  const ortho = group(raw.ortho);
  const mlu = Number(ortho.mlu);
  let atec = null;
  if (raw.atec && typeof raw.atec === 'object' && dayOrNull(raw.atec.day)) {
    atec = {
      day: raw.atec.day,
      total: int(raw.atec.total, 179),
      baseline: raw.atec.baseline === null || raw.atec.baseline === undefined ? null : int(raw.atec.baseline, 179),
    };
  }

  return {
    kind: FOLLOWUP_KIND,
    v: FOLLOWUP_VERSION,
    code,
    day,
    ageBand: AGE_BANDS.includes(raw.ageBand) ? raw.ageBand : null,
    totals: {
      trials: int(totals.trials),
      scored: int(totals.scored),
      plus: int(totals.plus),
      prompt: int(totals.prompt),
      minus: int(totals.minus),
      activeDays: int(totals.activeDays, 4000),
      lastDay: dayOrNull(totals.lastDay),
    },
    autonomy: pct(raw.autonomy),
    goals,
    days,
    intervenants: rows(raw.intervenants),
    environments: rows(raw.environments),
    prompts,
    routines: { logs: routineLogs, autonomous: Math.min(int(routines.autonomous), routineLogs), reminded: Math.min(int(routines.reminded), routineLogs), days: int(routines.days, 4000) },
    abc: { total: int(abc.total), last30: int(abc.last30) },
    ortho: { total: int(ortho.total), last30: int(ortho.last30), mlu: Number.isFinite(mlu) && mlu > 0 ? Math.round(mlu * 10) / 10 : null },
    atec,
  };
}

export function parseFollowupText(text) {
  let data;
  try { data = JSON.parse(String(text || '')); } catch { throw new Error('Le fichier n’est pas un JSON valide.'); }
  return normalizeFollowup(data);
}

const pad = (n) => String(n).padStart(2, '0');
const shiftDay = (day, delta) => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + delta);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const todayKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};
export const dayGap = (from, to = todayKey()) => (from && DAY_RE.test(from) && DAY_RE.test(to) ? Math.round((Date.parse(to) - Date.parse(from)) / 86400000) : null);
export const shortDay = (day) => (DAY_RE.test(day || '') ? `${day.slice(8)}/${day.slice(5, 7)}` : '');

// Série jour par jour (les trous restent vides : on ne comble jamais avec 0).
export function seriesOf(card, days = 28, endDay = todayKey()) {
  const byDay = new Map((card?.days || []).map((d) => [d.day, d]));
  const start = shiftDay(endDay, -(days - 1));
  return Array.from({ length: days }, (_, i) => {
    const day = shiftDay(start, i);
    const entry = byDay.get(day);
    return { day, trials: entry?.trials || 0, autonomy: entry?.autonomy ?? null };
  });
}

export function percentOf(plus, total) {
  return total > 0 ? Math.round((100 * plus) / total) : null;
}

export function promptTotal(card) {
  return Object.values(card?.prompts || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

export function summaryOf(card) {
  if (!card) return { hasData: false, autonomy: null, trials: 0, goalsDone: 0, goalsProgress: 0, goalsWorked: 0, lastDay: null, daysSince: null };
  const done = card.goals.filter((g) => g.status === 'done').length;
  const progress = card.goals.filter((g) => g.status === 'progress').length;
  const lastDay = card.totals.lastDay || [...card.days].reverse().find((d) => d.trials)?.day || card.day;
  return {
    hasData: card.totals.scored > 0 || card.days.length > 0,
    autonomy: card.autonomy,
    trials: card.totals.scored,
    goalsDone: done,
    goalsProgress: progress,
    goalsWorked: card.goals.length,
    lastDay,
    daysSince: dayGap(lastDay),
  };
}

// Météo douce : jamais de rouge ni de note punitive, seulement un repère de suivi.
export function weatherOf(summary, previousAutonomy = null) {
  if (!summary?.hasData) return { id: 'new', emoji: '🌱', label: 'En attente de fiche', tone: 'neutral' };
  if (summary.daysSince !== null && summary.daysSince > 7) return { id: 'wait', emoji: '🌧️', label: 'À relancer', tone: 'wait' };
  if (previousAutonomy !== null && previousAutonomy !== undefined && summary.autonomy !== null && summary.autonomy - previousAutonomy <= -10) {
    return { id: 'watch', emoji: '⛅', label: 'Léger recul', tone: 'watch' };
  }
  if ((summary.autonomy ?? 0) >= 75) return { id: 'great', emoji: '☀️', label: 'Belle dynamique', tone: 'good' };
  return { id: 'ok', emoji: '🌤️', label: 'En progression', tone: 'good' };
}

// Moyenne par section ABLLS-R (graphique collectif), calculée sur les objectifs travaillés.
export function sectionAverages(card) {
  const map = new Map();
  for (const goal of card?.goals || []) {
    const section = goal.id.split('.')[0];
    if (!map.has(section)) map.set(section, { worked: 0, scored: 0, done: 0 });
    const entry = map.get(section);
    entry.worked += 1;
    entry.scored += goal.count > 0 || goal.pct > 0 ? 1 : 0;
    entry.done += goal.status === 'done' ? 1 : 0;
    entry.pct = (entry.pct || 0) + (goal.count > 0 || goal.pct > 0 ? goal.pct : 0);
  }
  for (const entry of map.values()) entry.pct = entry.scored ? Math.round(entry.pct / entry.scored) : 0;
  return map;
}

export function collectiveKpis(patients, endDay = todayKey()) {
  const latest = patients.map((p) => p.snapshots[p.snapshots.length - 1]).filter(Boolean);
  let autonomySum = 0;
  let autonomyCount = 0;
  let goalsDone = 0;
  let trialsWeek = 0;
  let active7 = 0;
  latest.forEach((card) => {
    const summary = summaryOf(card);
    if (summary.autonomy !== null) { autonomySum += summary.autonomy; autonomyCount += 1; }
    goalsDone += summary.goalsDone;
    if (summary.daysSince !== null && summary.daysSince <= 7) active7 += 1;
    trialsWeek += seriesOf(card, 7, endDay).reduce((sum, d) => sum + d.trials, 0);
  });
  return {
    patients: patients.length,
    withData: latest.length,
    active7,
    autonomy: autonomyCount ? Math.round(autonomySum / autonomyCount) : null,
    goalsDone,
    trialsWeek,
  };
}

// Lignes du suivi de l'accompagnement (école / AVS / maison / routines).
export function avsRows(patients) {
  return patients.map((patient) => {
    const card = patient.snapshots[patient.snapshots.length - 1] || null;
    const summary = summaryOf(card);
    const env = (id) => card?.environments.find((e) => e.id === id) || null;
    const teacher = card?.intervenants.find((e) => e.id === 'teacher') || null;
    return {
      code: patient.code,
      label: patient.label,
      emoji: patient.emoji,
      card,
      summary,
      school: env('school'),
      home: env('home'),
      clinic: env('clinic'),
      teacher,
      prompts: promptTotal(card),
      routines: card?.routines || { logs: 0, autonomous: 0, reminded: 0, days: 0 },
      weather: weatherOf(summary),
    };
  });
}

// Points de la courbe d'autonomie : segments séparés pour ne pas relier des jours sans données.
export function sparklinePaths(values, width = 120, height = 36) {
  const pad = 3;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const yOf = (value) => height - pad - (Math.max(0, Math.min(100, value)) / 100) * (height - pad * 2);
  const points = values.map((value, i) => (value === null || value === undefined ? null : { x: pad + i * step, y: yOf(value) }));
  const segments = [];
  let current = [];
  points.forEach((point) => {
    if (!point) { if (current.length > 1) segments.push(current); current = []; return; }
    current.push(point);
  });
  if (current.length > 1) segments.push(current);
  const dots = points.filter((point) => point);
  const last = [...points].reverse().find((point) => point) || null;
  return {
    segments: segments.map((list) => list.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')),
    dots,
    last,
    width,
    height,
  };
}
