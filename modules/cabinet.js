// v10.16 : Espace thérapeute (psychologue / orthophoniste). Un cabinet local, plusieurs patients.
// Chaque patient arrive avec une fiche de suivi pseudonymisée (aucun prénom, photo ni voix).
// Le tableau de bord est collectif (météo, autonomie, chaleur des sections) et individuel (objectifs, AVS, langage).
// Tout reste dans cet appareil : aucun appel réseau, aucune donnée d'enfant dans le code.
import * as db from '../db.js';
import { h, btn, dayKey } from './util.js';
import { GOALS, SECTIONS } from './goals.js';
import {
  summaryOf, weatherOf, sectionAverages, collectiveKpis, avsRows, sparklinePaths, seriesOf, shortDay, promptTotal, newFollowupCode, parseFollowupText,
} from './followup-schema.js';
import { readFollowupFile } from './followup.js';

const AVATARS = ['🦊', '🐨', '🦉', '🐬', '🦋', '🐢', '🐝', '🦄', '🐙', '🐳', '🦜', '🐼', '🦁', '🐰', '🐸', '🦕'];
const TONES = ['#E4F3EE', '#FFF1D8', '#EAE8FA', '#FBE7E1', '#E2EFF9', '#EDF5DE', '#F7E7F0', '#E8F1E1'];
const ROLE_NAMES = {
  psy: 'Psychologue / thérapeute',
  parents: 'Famille',
  teacher: 'École / AVS',
  avs: 'Auxiliaire de vie (AVS)',
};
const ENV_NAMES = { clinic: '🧩 Cabinet', home: '🏠 Maison', school: '🏫 École' };
const MAX_SNAPSHOTS = 12;

const hashText = (text) => [...String(text || '')].reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 9973, 7);
const avatarFor = (code) => AVATARS[hashText(code) % AVATARS.length];
const toneFor = (code) => TONES[hashText(code) % TONES.length];
const latestOf = (record) => (record?.snapshots?.length ? record.snapshots[record.snapshots.length - 1] : null);
const previousOf = (record) => (record?.snapshots?.length > 1 ? record.snapshots[record.snapshots.length - 2] : null);
const roleName = (id) => ROLE_NAMES[id] || id;
const envName = (id) => ENV_NAMES[id] || id;
const cleanLabel = (value) => String(value || '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);

function mergeCard(record, card) {
  const kept = record.snapshots.filter((snap) => snap.day !== card.day);
  const snapshots = [...kept, card].sort((a, b) => a.day.localeCompare(b.day)).slice(-MAX_SNAPSHOTS);
  return { ...record, snapshots, updatedDay: [record.updatedDay, card.day].filter(Boolean).sort().pop() || card.day };
}

function sparkline(values, { width = 150, height = 42 } = {}) {
  const paths = sparklinePaths(values, width, height);
  if (!paths.dots.length) return h('div', { class: 'cab-spark empty' }, h('span', {}, '—'));
  const lines = paths.segments.map((segment) => `<path d="${segment}" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  const dot = paths.last ? `<circle cx="${paths.last.x.toFixed(1)}" cy="${paths.last.y.toFixed(1)}" r="3.6" fill="currentColor"/>` : '';
  return h('div', { class: 'cab-spark' }, h('div', { html: `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Courbe d’autonomie">${lines}${dot}</svg>` }));
}

function ring(value) {
  const pct = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, value));
  return h('div', {
    class: 'cab-ring',
    style: { background: `conic-gradient(var(--brand) ${pct * 3.6}deg, var(--soft) 0deg)` },
    role: 'img',
    'aria-label': value === null || value === undefined ? 'Autonomie inconnue' : `Autonomie ${value} pour cent`,
  }, h('div', { class: 'cab-ring-in' }, h('strong', {}, value === null || value === undefined ? '—' : `${value}%`), h('small', {}, 'autonomie')));
}

function kpi(emoji, value, label) {
  return h('div', { class: 'cab-kpi' }, h('span', { class: 'cab-kpi-emoji', 'aria-hidden': 'true' }, emoji), h('strong', {}, String(value)), h('small', {}, label));
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function cabinetScreen({ parent = false } = {}) {
  const root = h('div', { class: 'screen cabinet' });
  if (!parent) {
    root.append(h('div', { class: 'screen locked' },
      h('p', { class: 'ask' }, '🔒 L’espace thérapeute est réservé aux adultes.'),
      h('p', { class: 'note' }, 'Restez appuyé 3 secondes sur le cadenas en haut à droite, puis rouvrez l’espace thérapeute depuis l’accueil.')));
    return root;
  }

  let patients = [];
  let view = { name: 'hub' };
  let loaded = false;
  let loadError = '';
  let newFormOpen = false;
  let showAllGoals = false;
  let sharedStatus = '';

  const go = (next) => {
    view = next;
    showAllGoals = false;
    draw();
    root.scrollTop = 0;
  };

  async function reload() {
    patients = (await db.getAllFollowups()).sort((a, b) => a.label.localeCompare(b.label));
    loaded = true;
    draw();
  }

  function recordOf(code) {
    return patients.find((record) => record.code === code) || null;
  }

  function draw() {
    if (!loaded) {
      root.replaceChildren(h('p', { class: 'note' }, loadError || 'Chargement du cabinet…'));
      return;
    }
    if (view.name === 'patient') {
      const record = recordOf(view.code);
      if (!record) { view = { name: 'hub' }; draw(); return; }
      root.replaceChildren(...patientView(record));
      return;
    }
    if (view.name === 'avs') { root.replaceChildren(...avsView()); return; }
    if (view.name === 'import') { root.replaceChildren(...importView()); return; }
    root.replaceChildren(...hubView());
  }

  // ---------- Accueil du cabinet ----------
  function hubView() {
    const values = collectiveKpis(patients);
    const sorted = [...patients].sort((a, b) => {
      const dayA = latestOf(a)?.day || '';
      const dayB = latestOf(b)?.day || '';
      return dayB.localeCompare(dayA) || a.label.localeCompare(b.label);
    });
    return [
      h('div', { class: 'cab-hero' },
        h('h1', {}, '🩺 Cabinet du thérapeute'),
        h('p', {}, 'Le suivi collectif et individuel des enfants, et du travail de l’équipe qui les accompagne.'),
        h('p', { class: 'cab-hero-tag' }, '✨ Simple · ludique · 100 % sur cet appareil')),
      h('div', { class: 'cab-actions' },
        btn('➕ Nouveau patient', () => { newFormOpen = !newFormOpen; draw(); }, 'primary'),
        btn('📥 Importer une fiche', () => go({ name: 'import' })),
        patients.length ? btn('🤝 Accompagnement AVS', () => go({ name: 'avs' }), 'ghost') : null,
        patients.length ? btn('🖨️ Bilan collectif', () => printReport(patients), 'ghost') : null),
      newFormOpen ? newPatientForm() : null,
      h('div', { class: 'cab-kpis' },
        kpi('👧', values.patients, 'patients au cabinet'),
        kpi('🔥', values.active7, 'actifs cette semaine'),
        kpi('🌟', values.autonomy === null ? '—' : `${values.autonomy}%`, 'autonomie moyenne'),
        kpi('🎯', values.goalsDone, 'objectifs atteints')),
      sharedStatus ? h('p', { class: 'note', role: 'status' }, sharedStatus) : null,
      patients.length ? h('div', { class: 'cab-grid' }, sorted.map(patientCard)) : emptyStart(),
      patients.length ? h('details', { class: 'card-box cab-heat-box' },
        h('summary', {}, '🌡️ Chaleur des sections (moyenne du cabinet)'),
        h('p', { class: 'note' }, 'Chaque ligne regroupe les objectifs ABLLS-R de la section. Les fiches les plus récentes de chaque enfant sont utilisées.'),
        heatmap(patients)) : null,
      h('p', { class: 'note cab-privacy-note' }, '🔒 Aucun envoi sur internet. Les fiches restent dans cet appareil ; le prénom ou le surnom que vous notez ici n’est jamais transmis.'),
    ];
  }

  function patientCard(record) {
    const latest = latestOf(record);
    const previous = previousOf(record);
    const summary = summaryOf(latest);
    const weather = weatherOf(summary, previous?.autonomy ?? null);
    const values = latest ? seriesOf(latest, 14).map((entry) => entry.autonomy) : [];
    return h('button', { type: 'button', class: 'cab-patient', onclick: () => go({ name: 'patient', code: record.code }) },
      h('div', { class: 'cab-patient-top' },
        h('span', { class: 'cab-avatar', style: { background: toneFor(record.code) }, 'aria-hidden': 'true' }, record.emoji),
        h('div', { class: 'grow' }, h('strong', {}, record.label), h('small', {}, record.code))),
      h('span', { class: `cab-weather ${weather.tone}` }, `${weather.emoji} ${weather.label}`),
      h('div', { class: 'cab-patient-mid' },
        latest ? ring(summary.autonomy) : h('div', { class: 'cab-await' }, h('span', { 'aria-hidden': 'true' }, '🕊️'), h('small', {}, 'En attente de fiche')),
        sparkline(values, { width: 132, height: 42 })),
      h('div', { class: 'cab-patient-foot' },
        h('span', {}, latest ? `${summary.trials} essais` : 'Aucune fiche'),
        h('span', {}, latest ? `MAJ ${shortDay(summary.lastDay)}` : '—')));
  }

  function newPatientForm() {
    const input = h('input', { maxlength: 40, placeholder: 'Surnom local (facultatif)', 'aria-label': 'Surnom local du patient' });
    const note = h('p', { class: 'note' });
    const create = async () => {
      createBtn.disabled = true;
      try {
        let code = newFollowupCode();
        while (patients.some((record) => record.code === code)) code = newFollowupCode();
        const today = dayKey();
        const record = {
          code,
          label: cleanLabel(input.value) || `Patient ${patients.length + 1}`,
          emoji: avatarFor(code),
          createdDay: today,
          updatedDay: null,
          snapshots: [],
        };
        await db.putFollowup(record);
        newFormOpen = false;
        sharedStatus = `✅ Patient créé. Donnez le code ${code} à la famille : Progrès › Partage avec le thérapeute.`;
        await reload();
        go({ name: 'patient', code });
      } catch (err) {
        note.textContent = `⚠️ ${err?.message || err}`;
      } finally {
        createBtn.disabled = false;
      }
    };
    const createBtn = btn('Créer le patient', create, 'primary');
    return h('section', { class: 'card-box cab-new' },
      h('h3', {}, '➕ Nouveau patient'),
      h('p', { class: 'note' }, 'Un code KALI-XXXX est créé pour relier la fiche de la famille à ce cabinet. Le surnom reste uniquement ici.'),
      h('div', { class: 'row wrap' }, input, createBtn),
      note);
  }

  function emptyStart() {
    return h('section', { class: 'card-box cab-empty' },
      h('div', { class: 'cab-empty-emoji', 'aria-hidden': 'true' }, '🌱'),
      h('h3', {}, 'Le cabinet est prêt à accueillir ses premiers patients'),
      h('ol', {},
        h('li', {}, '➕ Créez un patient : Kalimati fabrique un code KALI-XXXX.'),
        h('li', {}, '👨‍👧 Sur le téléphone de la famille : Progrès › Partage avec le thérapeute, puis saisir ce code.'),
        h('li', {}, '📥 Importez la fiche reçue : le tableau de bord se remplit tout seul.')),
      h('div', { class: 'row wrap' }, btn('➕ Nouveau patient', () => { newFormOpen = true; draw(); }, 'primary'), btn('📥 Importer une fiche', () => go({ name: 'import' }), 'ghost')),
      h('p', { class: 'note' }, 'Aucun nom d’enfant n’est nécessaire : le code relie la fiche, le surnom reste local.'));
  }

  function heatmap(list) {
    const rows = SECTIONS.map((section) => {
      const values = list.map((record) => {
        const latest = latestOf(record);
        return latest ? sectionAverages(latest).get(section.id) : null;
      }).filter((entry) => entry && entry.scored > 0);
      if (!values.length) return null;
      const pct = Math.round(values.reduce((sum, entry) => sum + entry.pct, 0) / values.length);
      return h('div', { class: 'cab-heat-row' },
        h('span', { class: 'cab-heat-name' }, `${section.emoji} ${section.name}`),
        h('div', { class: 'cab-heat-bar', style: { background: `color-mix(in srgb, var(--brand) ${Math.max(10, pct)}%, var(--surface))` } }, h('span', {}, `${pct}%`)),
        h('small', {}, `${values.length} enfant${values.length > 1 ? 's' : ''}`));
    }).filter(Boolean);
    return rows.length ? h('div', { class: 'cab-heat' }, rows) : h('p', { class: 'note' }, 'Pas encore assez de fiches pour dessiner la chaleur des sections.');
  }

  // ---------- Fiche individuelle ----------
  function patientView(record) {
    const latest = latestOf(record);
    const previous = previousOf(record);
    if (!latest) {
      return [
        head(record.label, `Code ${record.code} · aucune fiche reçue`),
        h('section', { class: 'card-box cab-empty' },
          h('span', { class: 'cab-avatar big', style: { background: toneFor(record.code) }, 'aria-hidden': 'true' }, record.emoji),
          h('h3', {}, 'En attente de la première fiche'),
          h('p', {}, 'Sur le téléphone de la famille : Progrès › Partage avec le thérapeute. Il suffit de saisir ce code, puis d’envoyer la fiche.'),
          h('div', { class: 'cab-code-big' }, record.code),
          h('div', { class: 'row wrap' },
            btn('📋 Copier le code', async () => { sharedStatus = (await copyText(record.code)) ? '✅ Code copié.' : 'Copiez le code affiché ci-dessus.'; draw(); }, 'primary'),
            btn('📥 J’ai reçu la fiche', () => go({ name: 'import', code: record.code }), 'ghost'))),
        renameBox(record),
        removeBox(record),
      ];
    }
    const summary = summaryOf(latest);
    const weather = weatherOf(summary, previous?.autonomy ?? null);
    const series = seriesOf(latest, 28);
    const daysText = summary.daysSince === null ? '' : `Dernière activité il y a ${summary.daysSince} jour${summary.daysSince > 1 ? 's' : ''}.`;
    return [
      h('div', { class: 'cab-head' },
        h('div', { class: 'row spread' },
          h('button', { type: 'button', class: 'btn ghost tiny', onclick: () => go({ name: 'hub' }) }, '← Cabinet'),
          h('div', { class: 'row' },
            btn('🖨️ Fiche patient', () => printReport([record], record.code), 'ghost tiny'))),
        h('div', { class: 'cab-id' },
          h('span', { class: 'cab-avatar big', style: { background: toneFor(record.code) }, 'aria-hidden': 'true' }, record.emoji),
          h('div', {}, h('h2', {}, record.label), h('small', {}, `Code ${record.code} · fiche du ${shortDay(latest.day)} · tranche d’âge ${latest.ageBand || 'non renseignée'}`)))),
      sharedStatus ? h('p', { class: 'note', role: 'status' }, sharedStatus) : null,
      h('div', { class: 'cab-kpis' },
        kpi('🌟', summary.autonomy === null ? '—' : `${summary.autonomy}%`, 'autonomie'),
        kpi('🧪', summary.trials, 'essais notés'),
        kpi('🎯', `${summary.goalsDone}/${summary.goalsWorked || 0}`, 'objectifs atteints'),
        kpi(weather.emoji, weather.label, 'météo de suivi')),
      h('section', { class: 'card-box' },
        h('div', { class: 'row spread' }, h('h3', {}, '📈 Autonomie sur 28 jours'), h('span', { class: `cab-weather ${weather.tone}` }, `${weather.emoji} ${weather.label}`)),
        sparkline(series.map((entry) => entry.autonomy), { width: 520, height: 120 }),
        daysText ? h('p', { class: 'note' }, daysText) : null),
      historyBox(record),
      goalsBox(latest),
      avsPatientBox(latest),
      languageBox(latest),
      renameBox(record),
      removeBox(record),
      h('p', { class: 'note cab-privacy-note' }, '🔒 Fiche pseudonymisée : aucun prénom, photo, voix ni date de naissance.'),
    ];
  }

  function head(title, sub) {
    return h('div', { class: 'cab-head' },
      h('button', { type: 'button', class: 'btn ghost tiny', onclick: () => go({ name: 'hub' }) }, '← Cabinet'),
      h('h2', {}, title),
      sub ? h('p', { class: 'note' }, sub) : null);
  }

  function renameBox(record) {
    const input = h('input', { value: record.label, maxlength: 40, 'aria-label': 'Surnom local du patient' });
    const save = async () => {
      const label = cleanLabel(input.value) || record.label;
      record.label = label;
      await db.putFollowup(record);
      await reload();
    };
    return h('details', { class: 'card-box' },
      h('summary', {}, '✏️ Surnom local'),
      h('p', { class: 'note' }, 'Le surnom vous aide à reconnaître le patient. Il n’est jamais inclus dans une fiche et ne quitte pas cet appareil.'),
      h('div', { class: 'row wrap' }, input, btn('Enregistrer', save)));
  }

  function removeBox(record) {
    let armed = false;
    const removeBtn = h('button', { type: 'button', class: 'btn ghost tiny' }, '🗑️ Retirer du cabinet');
    removeBtn.onclick = async () => {
      if (!armed) {
        armed = true;
        removeBtn.textContent = 'Confirmer le retrait ?';
        removeBtn.classList.add('cab-danger-soft');
        setTimeout(() => { armed = false; removeBtn.textContent = '🗑️ Retirer du cabinet'; removeBtn.classList.remove('cab-danger-soft'); }, 5000);
        return;
      }
      await db.deleteFollowup(record.code);
      sharedStatus = 'Patient retiré du cabinet. La famille garde ses données sur son téléphone.';
      view = { name: 'hub' };
      await reload();
    };
    return h('div', { class: 'row cab-remove' }, removeBtn);
  }

  function historyBox(record) {
    const snaps = [...record.snapshots].slice(-8).reverse();
    return h('details', { class: 'card-box' },
      h('summary', {}, `📬 Fiches reçues (${record.snapshots.length})`),
      h('div', { class: 'cab-history' }, snaps.map((snap, index) => {
        const summary = summaryOf(snap);
        const before = snaps[index + 1] ? summaryOf(snaps[index + 1]).autonomy : null;
        const delta = summary.autonomy !== null && before !== null ? summary.autonomy - before : null;
        return h('div', { class: 'cab-history-row' },
          h('strong', {}, shortDay(snap.day)),
          h('span', {}, `${summary.trials} essais`),
          h('span', {}, summary.autonomy === null ? '—' : `${summary.autonomy}%`),
          delta === null ? h('span', { class: 'note' }, '') : h('span', { class: `cab-delta ${delta >= 0 ? 'up' : 'down'}` }, delta >= 0 ? `+${delta}` : String(delta)));
      })),
      h('p', { class: 'note' }, 'Un envoi le même jour remplace la fiche du jour ; les 12 dernières fiches sont gardées.'));
  }

  function goalsBox(card) {
    const workedOf = (sectionId) => card.goals.filter((goal) => goal.id.startsWith(`${sectionId}.`));
    const sectionList = SECTIONS.map((section) => {
      const all = GOALS.filter((goal) => goal.section === section.id);
      const cardsById = new Map(workedOf(section.id).map((goal) => [goal.id, goal]));
      const shown = all.filter((goal) => cardsById.has(goal.id) || showAllGoals);
      if (!shown.length) return null;
      const done = [...cardsById.values()].filter((goal) => goal.status === 'done').length;
      return h('details', { class: 'card-box cab-section', open: Boolean(cardsById.size) },
        h('summary', {}, `${section.emoji} ${section.id}. ${section.name}`, h('small', {}, ` · ${cardsById.size} travaillé${cardsById.size > 1 ? 's' : ''}, ${done} atteint${done > 1 ? 's' : ''}`)),
        shown.map((goal) => {
          const result = cardsById.get(goal.id) || { status: 'todo', pct: 0, count: 0 };
          const label = result.status === 'done' ? 'Atteint' : result.status === 'progress' ? `${result.pct} %` : 'À commencer';
          return h('div', { class: 'cab-goal-row' },
            h('strong', {}, goal.id),
            h('span', { class: 'cab-goal-title' }, goal.title),
            h('span', { class: `chip ${result.status}` }, label),
            h('div', { class: 'progress-bar' }, h('span', { style: { width: `${result.pct}%` } })));
        }));
    }).filter(Boolean);
    const toggle = btn(showAllGoals ? 'Voir seulement les objectifs travaillés' : 'Voir aussi les objectifs non commencés', () => {
      showAllGoals = !showAllGoals;
      draw();
    }, 'ghost tiny');
    return h('section', {}, h('div', { class: 'row spread' }, h('h3', {}, '🎯 Objectifs ABLLS-R'), toggle),
      sectionList.length ? sectionList : h('p', { class: 'note' }, 'Aucun objectif travaillé dans les fiches reçues.'));
  }

  function avsPatientBox(card) {
    const roles = card.intervenants;
    const envs = card.environments;
    const routines = card.routines;
    const routineAutonomy = routines.logs ? Math.round((100 * routines.autonomous) / routines.logs) : null;
    const roleRows = roles.map((row) => h('div', { class: 'cab-bar-row' },
      h('span', {}, roleName(row.id)),
      h('div', { class: 'progress-bar' }, h('span', { style: { width: `${row.autonomy ?? 0}%` } })),
      h('strong', {}, row.autonomy === null ? '—' : `${row.autonomy}%`),
      h('small', {}, `${row.trials} essais · ${row.days} j`)));
    const envRows = envs.map((row) => h('div', { class: 'cab-bar-row' },
      h('span', {}, envName(row.id)),
      h('div', { class: 'progress-bar' }, h('span', { style: { width: `${row.autonomy ?? 0}%` } })),
      h('strong', {}, row.autonomy === null ? '—' : `${row.autonomy}%`),
      h('small', {}, `${row.trials} essais`)));
    return h('details', { class: 'card-box', open: true },
      h('summary', {}, '🤝 Accompagnement & AVS'),
      h('p', { class: 'note' }, 'Essais notés selon le rôle présent (école / AVS, famille, psychologue) et routines réussies seule ou avec rappel. Ces chiffres décrivent le travail de l’équipe ; ils ne remplacent pas votre observation clinique.'),
      h('div', { class: 'cab-cols' },
        h('div', {}, h('h4', {}, 'Rôles'), roleRows.length ? roleRows : h('p', { class: 'note' }, 'Aucun essai par rôle.')),
        h('div', {}, h('h4', {}, 'Lieux'), envRows.length ? envRows : h('p', { class: 'note' }, 'Aucun essai par lieu.'))),
      h('div', { class: 'cab-kpis small' },
        kpi('📅', routines.logs, 'routines notées'),
        kpi('✨', routineAutonomy === null ? '—' : `${routineAutonomy}%`, 'routines seule'),
        kpi('🧭', promptTotal(card), 'aides guidées'),
        kpi('🏫', routines.reminded, 'routines avec rappel')));
  }

  function languageBox(card) {
    const ortho = card.ortho;
    const abc = card.abc;
    const atec = card.atec;
    if (!ortho.total && !abc.total && !atec) {
      return h('details', { class: 'card-box' }, h('summary', {}, '🗣️ Langage & comportements'), h('p', { class: 'note' }, 'Pas encore de notes orthophonie, de journal ABC ni de bilan ATEC dans les fiches reçues.'));
    }
    const atecDelta = atec && atec.baseline !== null ? atec.total - atec.baseline : null;
    return h('details', { class: 'card-box' },
      h('summary', {}, '🗣️ Langage & comportements'),
      h('div', { class: 'cab-kpis small' },
        kpi('🗣️', ortho.total, 'notes orthophonie'),
        kpi('📏', ortho.mlu === null ? '—' : ortho.mlu, 'MLU récent'),
        kpi('🧩', abc.total, 'épisodes ABC'),
        kpi('📋', atec ? `${atec.total}/179` : '—', 'dernier ATEC')),
      atecDelta !== null ? h('p', { class: 'note' }, `ATEC : ${atecDelta === 0 ? 'stable' : atecDelta < 0 ? `baisse de ${Math.abs(atecDelta)} points (progrès)` : `hausse de ${atecDelta} points`} depuis le premier bilan.`) : null,
      h('p', { class: 'note' }, `Sur les 30 derniers jours : ${ortho.last30} note(s) orthophonie, ${abc.last30} épisode(s) ABC.`));
  }

  // ---------- Suivi collectif AVS ----------
  function avsView() {
    const rows = avsRows(patients);
    const table = h('table', { class: 'cab-table' },
      h('thead', {}, h('tr', {},
        h('th', {}, 'Patient'), h('th', {}, 'Fiche'), h('th', {}, '🏫 École / AVS'), h('th', {}, '🏠 Maison'), h('th', {}, '📅 Routines seule'), h('th', {}, '🧭 Aides'), h('th', {}, 'Météo'))),
      h('tbody', {}, rows.map((row) => h('tr', {},
        h('td', {}, h('strong', {}, `${row.emoji} ${row.label}`), h('small', { class: 'cab-code' }, row.code)),
        h('td', {}, row.summary.lastDay ? shortDay(row.summary.lastDay) : '—'),
        h('td', {}, row.school ? `${row.school.autonomy ?? '—'}% · ${row.school.trials} essais` : '—'),
        h('td', {}, row.home ? `${row.home.autonomy ?? '—'}% · ${row.home.trials} essais` : '—'),
        h('td', {}, row.routines.logs ? `${row.routines.autonomous}/${row.routines.logs}` : '—'),
        h('td', {}, String(row.prompts)),
        h('td', {}, `${row.weather.emoji}`)))));
    return [
      head('🤝 Accompagnement AVS', 'Le travail de l’équipe, enfant par enfant.'),
      h('p', { class: 'note' }, '« École / AVS » regroupe les essais notés quand l’accompagnant était présent. « Routines seule » compare les étapes réussies seule aux étapes avec rappel.'),
      patients.length ? h('div', { class: 'cab-table-scroll' }, table) : h('p', { class: 'note' }, 'Aucun patient dans le cabinet pour le moment.'),
      patients.length ? h('div', { class: 'row' }, btn('🖨️ Imprimer ce tableau', () => printReport(patients), 'ghost')) : null,
      h('p', { class: 'note cab-privacy-note' }, '🔒 Ces chiffres restent sur cet appareil.'),
    ];
  }

  // ---------- Import d'une fiche ----------
  function importView() {
    const status = h('p', { class: 'note', role: 'status' });
    const input = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    const textarea = h('textarea', { rows: 6, placeholder: 'Coller ici le contenu JSON d’une fiche Kalimati…', 'aria-label': 'Contenu JSON de la fiche' });
    const importCard = async (card) => {
      const existing = recordOf(card.code);
      const today = dayKey();
      const record = existing
        ? mergeCard(existing, card)
        : { code: card.code, label: `Patient ${patients.length + 1}`, emoji: avatarFor(card.code), createdDay: today, updatedDay: card.day, snapshots: [card] };
      await db.putFollowup(record);
      sharedStatus = `✅ Fiche du ${shortDay(card.day)} importée pour ${record.label} (${card.code}).`;
      await reload();
      go({ name: 'patient', code: card.code });
    };
    const handle = async (file) => {
      status.textContent = 'Lecture de la fiche…';
      try {
        const card = await readFollowupFile(file);
        await importCard(card);
      } catch (err) {
        status.textContent = `⚠️ ${err?.message || err}`;
      }
    };
    input.onchange = () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (file) handle(file);
    };
    return [
      head('📥 Importer une fiche', 'La fiche arrive du téléphone de la famille.'),
      h('section', { class: 'card-box stack' },
        h('p', {}, 'Choisissez le fichier reçu (nom commençant par kalimati-fiche-), ou collez son contenu si vous l’avez reçu par message.'),
        h('div', { class: 'row wrap' }, btn('📂 Choisir un fichier', () => input.click(), 'primary'), input),
        textarea,
        h('div', { class: 'row' }, btn('Importer le contenu collé', async () => {
          try {
            await importCard(parseFollowupText(textarea.value));
          } catch (err) {
            status.textContent = `⚠️ ${err?.message || err}`;
          }
        }, 'ghost')),
        status,
        h('details', { class: 'cab-privacy' },
          h('summary', {}, '🔒 Ce que vérifie l’import'),
          h('p', { class: 'note' }, 'Le fichier doit être une fiche Kalimati version 1 avec un code KALI-XXXX. Tout champ inconnu est écarté ; aucun texte libre, prénom, photo ni voix n’est accepté.'))),
    ];
  }

  // ---------- Bilan imprimé ----------
  function printReport(list, onlyCode = null) {
    const records = onlyCode ? list.filter((record) => record.code === onlyCode) : list;
    const single = onlyCode && records.length === 1 ? records[0] : null;
    document.querySelectorAll('.print-area.cabinet-print').forEach((node) => node.remove());

    const collectiveTable = h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Patient'), h('th', {}, 'Code'), h('th', {}, 'Fiche'), h('th', {}, 'Autonomie'), h('th', {}, 'Objectifs atteints'), h('th', {}, 'École / AVS'), h('th', {}, 'Routines seule'))),
      h('tbody', {}, avsRows(records).map((row) => h('tr', {},
        h('td', {}, row.label),
        h('td', {}, row.code),
        h('td', {}, row.summary.lastDay || '—'),
        h('td', {}, row.summary.autonomy === null ? '—' : `${row.summary.autonomy} %`),
        h('td', {}, `${row.summary.goalsDone}/${row.summary.goalsWorked || 0}`),
        h('td', {}, row.school ? `${row.school.autonomy ?? '—'} % (${row.school.trials} essais)` : '—'),
        h('td', {}, row.routines.logs ? `${row.routines.autonomous}/${row.routines.logs}` : '—')))));

    const patientSheet = single ? (() => {
      const latest = latestOf(single);
      const summary = summaryOf(latest);
      const goals = latest ? latest.goals.slice().sort((a, b) => a.id.localeCompare(b.id)) : [];
      return [
        h('p', {}, `Fiche de suivi · code ${single.code} · tranche d’âge ${latest?.ageBand || 'non renseignée'} · fiche du ${latest?.day || '—'}`),
        h('p', {}, `Autonomie : ${summary.autonomy === null ? '—' : `${summary.autonomy} %`} · Essais notés : ${summary.trials} · Objectifs atteints : ${summary.goalsDone}/${summary.goalsWorked || 0}`),
        h('h2', {}, 'Objectifs travaillés'),
        goals.length ? h('table', {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Code'), h('th', {}, 'Statut'), h('th', {}, 'Progression'), h('th', {}, 'Essais'))),
          h('tbody', {}, goals.map((goal) => {
            const title = GOALS.find((entry) => entry.id === goal.id)?.title || '';
            return h('tr', {}, h('td', {}, goal.id), h('td', {}, `${title} — ${goal.status === 'done' ? 'Atteint' : goal.status === 'progress' ? 'En cours' : 'À commencer'}`), h('td', {}, `${goal.pct} %`), h('td', {}, String(goal.count)));
          }))) : h('p', {}, 'Aucun objectif travaillé.'),
        latest ? h('p', { class: 'print-note' }, `Accompagnement : ${latest.intervenants.map((row) => `${roleName(row.id)} ${row.autonomy ?? '—'} %`).join(' · ') || '—'}. Routines : ${latest.routines.autonomous}/${latest.routines.logs} réussies seule.`) : null,
      ];
    })() : null;

    const area = h('div', { class: 'print-area cabinet-print' },
      h('div', { class: 'print-sheet' },
        h('h1', {}, single ? `Fiche de suivi · ${single.label}` : `Bilan collectif du cabinet · ${dayKey()}`),
        single ? null : h('p', {}, `${records.length} patient(s) · moyenne d’autonomie ${collectiveKpis(records).autonomy ?? '—'} % · objectifs atteints ${collectiveKpis(records).goalsDone}`),
        single ? patientSheet : collectiveTable,
        h('p', { class: 'print-note' }, 'Rapport créé sur l’appareil avec Kalimati. Données pseudonymisées, rien n’a été envoyé sur internet.')));
    document.body.append(area);
    const cleanup = () => { area.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 250);
  }

  reload().catch((err) => { loadError = `⚠️ Le cabinet n’a pas pu s’ouvrir (${String(err?.message || err).slice(0, 80)}).`; draw(); });
  root.append(h('p', { class: 'note' }, 'Chargement du cabinet…'));
  return root;
}
