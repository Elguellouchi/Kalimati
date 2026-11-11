// Calcule l'état de chaque objectif du PEI à partir des essais notés (critères de réussite du PEI).
import { REINFORCERS } from './content.js';
import { INTERVENANTS, ENVIRONMENTS } from './aba.js';
import { addDays, dayKey, percent } from './util.js';

const isScored = (t) => t.result === 'plus' || t.result === 'prompt' || t.result === 'minus';
const isPlus = (t) => t.result === 'plus';
const byTime = (a, b) => a.ts - b.ts;
const clamp = (x) => Math.max(0, Math.min(100, Math.round(x)));

function groupBy(trials, key) {
  const map = new Map();
  for (const t of trials) {
    const k = typeof key === 'function' ? key(t) : t[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(t);
  }
  return map;
}

function trailingRun(flags) {
  let run = 0;
  for (let i = flags.length - 1; i >= 0 && flags[i]; i -= 1) run += 1;
  return run;
}

function distinctPlus(trials) {
  return new Set(trials.filter((t) => isPlus(t) && t.item !== null && t.item !== undefined).map((t) => String(t.item))).size;
}

const RULES = {
  sessions(rule, trials) {
    const days = [...groupBy(trials, 'day').entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([, list]) => list).filter((list) => list.length >= rule.minTrials);
    const run = trailingRun(days.map((list) => list.filter(isPlus).length / list.length >= rule.ratio));
    const distinct = distinctPlus(trials);
    const distinctOk = !rule.minDistinct || distinct >= rule.minDistinct;
    const parts = [run / rule.sessions];
    if (rule.minDistinct) parts.push(distinct / rule.minDistinct);
    const detail = `${Math.min(run, rule.sessions)}/${rule.sessions} séances à ≥ ${Math.round(rule.ratio * 100)} %`
      + (rule.minDistinct ? ` · ${distinct}/${rule.minDistinct} différents` : '');
    return { done: run >= rule.sessions && distinctOk, pct: clamp(100 * Math.min(...parts.map((p) => Math.min(1, p)))), detail };
  },
  ratio(rule, trials) {
    const last = trials.slice(-rule.of);
    const plus = last.filter(isPlus).length;
    return { done: last.length >= rule.of && plus >= rule.need, pct: clamp((100 * plus) / rule.need), detail: `${plus}/${last.length} sur les ${rule.of} derniers essais (but ${rule.need}/${rule.of})` };
  },
  consecutive(rule, trials) {
    let run = 0;
    const runDays = new Set();
    for (let i = trials.length - 1; i >= 0 && isPlus(trials[i]); i -= 1) { run += 1; runDays.add(trials[i].day); }
    const daysOk = !rule.minDays || runDays.size >= rule.minDays;
    return { done: run >= rule.n && daysOk, pct: clamp((100 * run) / rule.n), detail: `${Math.min(run, rule.n)}/${rule.n} réussites de suite` };
  },
  perItem(rule, trials) {
    const groups = groupBy(trials, (t) => String(t.item));
    let mastered = 0;
    for (const list of groups.values()) {
      const last = list.slice(-rule.of);
      if (last.length >= rule.of && last.filter(isPlus).length >= rule.need) mastered += 1;
    }
    const goal = rule.minItems || rule.items;
    return { done: mastered >= goal, pct: clamp((100 * mastered) / goal), detail: `${mastered}/${goal} acquis (${rule.need}/${rule.of} chacun)` };
  },
  sessionsDistinct(rule, trials) {
    const days = [...groupBy(trials, 'day').entries()].sort(([a], [b]) => a.localeCompare(b));
    const run = trailingRun(days.map(([, list]) => distinctPlus(list) >= rule.perSession));
    const best = days.length ? distinctPlus(days[days.length - 1][1]) : 0;
    return { done: run >= rule.sessions, pct: clamp(100 * Math.min(run / rule.sessions + best / rule.perSession / rule.sessions, 1)), detail: `Dernière séance : ${best}/${rule.perSession} · ${Math.min(run, rule.sessions)}/${rule.sessions} séances réussies` };
  },
  repertoire(rule, trials) {
    const latest = new Map();
    trials.forEach((t) => latest.set(String(t.item), t));
    const plus = [...latest.values()].filter(isPlus).length;
    const ratio = plus / rule.items;
    return { done: latest.size >= rule.items && ratio >= rule.ratio, pct: clamp((100 * ratio) / rule.ratio), detail: `${plus}/${rule.items} réussis au dernier essai` };
  },
  distinct(rule, trials) {
    const n = distinctPlus(trials);
    return { done: n >= rule.min, pct: clamp((100 * n) / rule.min), detail: `${n}/${rule.min}` };
  },
  validSessions(rule, trials) {
    const run = trailingRun(trials.map((t) => isPlus(t)));
    return { done: run >= rule.n, pct: clamp((100 * run) / rule.n), detail: `${Math.min(run, rule.n)}/${rule.n} séances valides de suite` };
  },
  weekly(rule, trials) {
    const weeks = [...groupBy(trials.filter(isPlus), 'week').entries()].sort(([a], [b]) => a.localeCompare(b));
    const index = (key) => { const [y, w] = key.split('-W').map(Number); return y * 53 + w; };
    let best = 0; let run = 0; let prev = null;
    for (const [key, list] of weeks) {
      const ok = list.length >= rule.perWeek;
      run = ok && prev !== null && index(key) === prev + 1 ? run + 1 : (ok ? 1 : 0);
      prev = index(key);
      best = Math.max(best, run);
    }
    const current = weeks.length ? weeks[weeks.length - 1][1].length : 0;
    return { done: best >= rule.weeks, pct: clamp(100 * Math.min(1, best / rule.weeks + current / rule.perWeek / rule.weeks)), detail: `Cette semaine : ${current}/${rule.perWeek} · ${best}/${rule.weeks} semaines réussies de suite` };
  },
  daily(rule, trials) {
    const counts = groupBy(trials.filter(isPlus), 'day');
    const ok = (day) => (counts.get(day) || []).length >= rule.perDay;
    let run = 0;
    let day = ok(dayKey()) ? dayKey() : addDays(dayKey(), -1);
    while (ok(day)) { run += 1; day = addDays(day, -1); }
    const today = (counts.get(dayKey()) || []).length;
    return { done: run >= rule.days, pct: clamp((100 * run) / rule.days), detail: `Aujourd'hui : ${today}/${rule.perDay} · ${run}/${rule.days} jours de suite` };
  },
  reduction(rule, trials) {
    const stats = accidentStats(trials);
    if (!stats.baseline) return { done: false, pct: 0, detail: 'Notez chaque passage pour établir la semaine 1.' };
    const done = stats.weeks >= 4 && stats.reduction >= rule.pct;
    return { done, pct: clamp((100 * Math.max(0, stats.reduction)) / rule.pct), detail: `Semaine 1 : ${stats.baseline.toFixed(1)} accident/jour · cette semaine : ${stats.current.toFixed(1)} · baisse ${Math.round(stats.reduction)} %` };
  },
  manual(rule, trials) {
    const validated = trials.some((t) => t.meta && t.meta.validated);
    const last = trials.filter(isScored).slice(-10);
    const share = percent(last.filter(isPlus).length, last.length);
    return { done: validated, pct: validated ? 100 : share, detail: validated ? 'Validé avec l’orthophoniste' : `${share} % « net » sur les 10 derniers essais` };
  },
};

// X.3 : accidents par jour noté, semaine 1 comparée à la semaine en cours.
export function accidentStats(trials) {
  const logs = trials.filter((t) => t.meta && t.meta.kind);
  const weeks = [...groupBy(logs, 'week').entries()].sort(([a], [b]) => a.localeCompare(b));
  if (!weeks.length) return { baseline: 0, current: 0, reduction: 0, weeks: 0 };
  const rate = (list) => list.filter((t) => t.meta.kind === 'accident').length / new Set(list.map((t) => t.day)).size;
  const baseline = rate(weeks[0][1]);
  const current = rate(weeks[weeks.length - 1][1]);
  const reduction = baseline > 0 ? (100 * (baseline - current)) / baseline : 0;
  return { baseline, current, reduction, weeks: weeks.length };
}

// A.2 : efficacité de chaque renforçateur = taux de réussite des essais faits pendant qu'il était actif.
export function reinforcerStats(allTrials) {
  return REINFORCERS.map((r) => {
    const list = allTrials.filter((t) => t.reinforcer === r.id && isScored(t));
    const rate = list.length ? list.filter(isPlus).length / list.length : 0;
    return { ...r, trials: list.length, rate, effective: list.length >= 5 && rate >= 0.7 };
  });
}

// P.3 : tableau croisé lieu × intervenant.
export function matrix(allTrials) {
  const scored = allTrials.filter((t) => isScored(t) && !t.goalId.startsWith('P.'));
  return ENVIRONMENTS.map((env) => ({
    env,
    cells: INTERVENANTS.map((who) => {
      const list = scored.filter((t) => t.environment === env.id && t.intervenant === who.id);
      return { who, n: list.length, pct: percent(list.filter(isPlus).length, list.length) };
    }),
  }));
}

export function evaluate(goal, goalTrials, allTrials) {
  const trials = [...goalTrials].sort(byTime);
  let result;
  if (goal.rule.type === 'reinforcers') {
    const stats = reinforcerStats(allTrials);
    const social = stats.filter((s) => s.kind === 'social' && s.effective).length;
    const tangible = stats.filter((s) => s.kind === 'tangible' && s.effective).length;
    result = { done: social >= goal.rule.social && tangible >= goal.rule.tangible, pct: clamp(((Math.min(social, 3) + Math.min(tangible, 3)) / 6) * 100), detail: `${social}/3 sociaux · ${tangible}/3 tangibles efficaces` };
  } else if (goal.rule.type === 'envSkills') {
    const skills = new Set(allTrials.filter((t) => isPlus(t) && t.environment === goal.rule.env && !t.goalId.startsWith('P.')).map((t) => t.goalId));
    trials.filter(isPlus).forEach((t) => skills.add(String(t.item)));
    result = { done: skills.size >= goal.rule.min, pct: clamp((100 * skills.size) / goal.rule.min), detail: `${skills.size}/${goal.rule.min} compétences réussies ici` };
  } else if (goal.rule.type === 'interveners') {
    const scored = allTrials.filter((t) => isScored(t) && !t.goalId.startsWith('P.'));
    const rows = INTERVENANTS.map((who) => {
      const list = scored.filter((t) => t.intervenant === who.id);
      return { n: list.length, ratio: list.length ? list.filter(isPlus).length / list.length : 0 };
    });
    const ok = rows.filter((r) => r.n >= goal.rule.minTrials && r.ratio >= goal.rule.ratio).length;
    result = { done: ok === rows.length, pct: clamp((100 * ok) / rows.length), detail: rows.map((r, i) => `${INTERVENANTS[i].label.split(' ')[0]} ${Math.round(r.ratio * 100)} %`).join(' · ') };
  } else {
    const scored = goal.rule.type === 'reduction' ? trials : trials.filter(isScored);
    result = RULES[goal.rule.type](goal.rule, scored);
  }
  const status = result.done ? 'done' : (goalTrials.length ? 'progress' : 'todo');
  return { ...result, status, count: goalTrials.length };
}
