// v6 : Planning visuel d'Abir, « Ma routine quotidienne » (fidèle à son tableau plastifié MATIN / SOIR).
// Modes enfant : « Pas à pas » (ronds à cocher) et « Maintenant / Ensuite » (une étape à la fois + sablier).
// Mode parent : éditeur des étapes (ordre, durée, masquer, supprimer, photo, voix FR / Darija), changement surprise,
// estompage des images (« Je sais déjà lire »), fiche à imprimer. Chaque coche alimente les essais ABA liés.
// Tout reste dans le téléphone (IndexedDB : schedule_logs, schedule_config, visual_overrides).
import * as db from '../db.js';
import { h, btn, uid, dayKey } from './util.js';
import { speak, sayCard, playBlob, hasArabicVoice } from '../speech.js';
import { playClap, playBeep, canRecord, startRecording } from '../media.js';
import { recordTrial, firstName, sisterName } from './aba.js';
import { renderVisual } from './visuals.js';
import { sequenceBoard, praise, bigCard } from './widgets.js';
import { SEQUENCES } from './content.js';

// ---------- Étapes et routines par défaut ----------
const S = (id, fr, dr, ar, emoji, minutes, extra = {}) => ({ id, fr, dr, ar, emoji, minutes, hidden: false, ...extra });

// Micro-étapes (analyse de tâche) ouvertes en touchant une étape.
const WUDU = [['🙌', 'Se laver les mains'], ['👄', 'Se rincer la bouche'], ['👃', 'Se rincer le nez'], ['😊', 'Se laver le visage'],
  ['💪', 'Se laver les bras'], ['🙆', 'Passer l’eau sur la tête'], ['👂', 'Les oreilles'], ['🦶', 'Se laver les pieds'], ['🧎', 'Prier sur le tapis']];
const TOILET = SEQUENCES['X.2']; // les 9 étapes détaillées (photos « toilet:<id> »)
const TEETH = SEQUENCES['W.3'];
const DRESS = SEQUENCES['U.1'];
const HAIR = [['🪮', 'Prendre la brosse'], ['💇‍♀️', 'Brosser doucement'], ['🎀', 'Mettre l’élastique'], ['🪞', 'Se regarder dans le miroir']];
const BED = [['🛏️', 'Tirer la couverture'], ['🧸', 'Poser le coussin'], ['🙌', 'Lisser avec les mains']];
const BAG = [['📓', 'Mettre le cahier'], ['🖍️', 'Mettre la trousse'], ['🥪', 'Mettre le goûter'], ['🎒', 'Fermer le cartable']];

const toilets = (id) => S(id, 'Aller aux toilettes', 'Nemchi l bit l ma', 'نمشي لبيت الما', '🚽', 5, { goalId: 'X.2', sub: TOILET });
const prayer = (id) => S(id, 'Faire les ablutions et la prière', 'Ndir l wudu w nsalli', 'ندير الوضوء ونصلي', '🤲', 10, { sub: WUDU });
const breakfast = (id) => S(id, 'Prendre le petit-déjeuner', 'Nfter', 'نفطر', '🥣', 15, { goalId: 'V.4' });
const dress = (id) => S(id, 'S’habiller', 'Nlbes hwayji', 'نلبس حوايجي', '👕', 10, { goalId: 'U.4', sub: DRESS });
const teeth = (id) => S(id, 'Se brosser les dents', 'Nghsel snani', 'نغسل سناني', '🪥', 3, { goalId: 'W.3', sub: TEETH });
const homework = (id) => S(id, 'Faire ses devoirs', 'Ndir l wajibat', 'ندير الواجبات', '📚', 30);
const story = (id) => S(id, 'Lire une histoire', 'Nqra qissa', 'نقرا قصة', '📖', 10);

export const DEFAULT_ROUTINES = () => [
  { id: 'matin', title: 'Matin', emoji: '🌅', steps: [
    toilets('m-toilettes'), prayer('m-priere'),
    S('m-lit', 'Faire le lit', 'Nrettab n-namousiya', 'نرتب النموسية', '🛏️', 5, { sub: BED }),
    breakfast('m-petitdej'), dress('m-habiller'), teeth('m-dents'),
    S('m-coiffer', 'Se coiffer', 'Nmchet cha3ri', 'نمشط شعري', '💇‍♀️', 3, { sub: HAIR }),
  ] },
  { id: 'soir', title: 'Soir', emoji: '🌙', steps: [
    homework('s-devoirs'),
    S('s-jouer', 'Jouer / Ranger sa chambre', 'Nl3eb w nrettab bit', 'نلعب ونرتب بيتي', '🧸', 30),
    S('s-diner', 'Dîner', 'Nt3echa', 'نتعشى', '🍽️', 20, { goalId: 'V.4' }),
    S('s-dents', 'Se brosser les dents / Aller aux toilettes', 'Nghsel snani w nemchi l bit l ma', 'نغسل سناني ونمشي لبيت الما', '🪥', 5, { goalId: 'W.3', sub: [...TEETH, ...TOILET] }),
    prayer('s-priere'), story('s-histoire'),
    S('s-coucher', 'Se coucher', 'N3es', 'نعس', '😴', 5),
  ] },
  { id: 'ecole', title: 'Journée d’école', emoji: '🏫', steps: [
    S('e-lever', 'Se lever', 'Nfiq', 'نفيق', '⏰', 5), toilets('e-toilettes'), dress('e-habiller'), breakfast('e-petitdej'), teeth('e-dents'),
    S('e-cartable', 'Préparer le cartable', 'Nwejjed l mehfda', 'نوجد المحفظة', '🎒', 5, { sub: BAG }),
    S('e-ecole', 'Aller à l’école', 'Nemchi l medrasa', 'نمشي للمدرسة', '🏫', 240),
    S('e-retour', 'Rentrer à la maison', 'Nrje3 l dar', 'نرجع للدار', '🏠', 15),
    S('e-gouter', 'Prendre le goûter', 'Nakoul chi haja', 'ناكل شي حاجة', '🍪', 15), homework('e-devoirs'),
  ] },
  { id: 'weekend', title: 'Week-end à Salé', emoji: '🏡', steps: [
    S('w-petitdej', 'Petit-déjeuner en famille', 'Nfter m3a l3a2ila', 'نفطر مع العائلة', '🥣', 20, { goalId: 'V.4' }), dress('w-habiller'),
    S('w-ranger', 'Ranger sa chambre', 'Nrettab bit', 'نرتب بيتي', '🧸', 15),
    S('w-mer', 'Promenade au bord de la mer', 'Ntsara 7da l b7er', 'نتسارا حدا البحر', '🌊', 60),
    S('w-ghita', `Jouer avec ${sisterName()}`, 'Nl3eb m3a khti', 'نلعب مع ختي', '👧', 30),
    S('w-dejeuner', 'Déjeuner en famille', 'Ntghedda', 'نتغدى', '🍲', 30, { goalId: 'V.4' }),
    S('w-calme', 'Temps calme', 'Nrta7', 'نرتاح', '🛋️', 30), story('w-histoire'),
  ] },
];

// Imprévus proposés par le bouton « 🔀 Changement / Surprise » (A.6 : flexibilité).
const SURPRISES = [
  ['🚗', 'Sortie en voiture', 'Nkhrjou f tomobil', 'نخرجو فالطوموبيل', 20], ['🧕', 'Visite à la famille', 'Nzouro l3a2ila', 'نزورو العائلة', 60],
  ['🩺', 'Rendez-vous chez le docteur', 'Nemchi l tbib', 'نمشي للطبيب', 45], ['🛒', 'Faire les courses', 'Ntqdaw', 'نتقداو', 30],
  ['🎉', 'Une fête', 'L 7efla', 'الحفلة', 60], ['📞', 'Appel vidéo', 'N3ayto f telephone', 'نعيطو فالتيليفون', 10],
];

const ALERTS = [[300, 'Encore 5 minutes', 'باقي خمس دقايق'], [120, 'Encore 2 minutes', 'باقي جوج دقايق'], [60, 'Encore 1 minute', 'باقي دقيقة']];
const CONFIG_ID = 'routines';
const PREFS_ID = 'prefs';
const SURPRISE_ID = 'surprise';

// v7 (Aegon) : Tableau « J'attends / Je me calme » (inspiré de Choiceworks Waiting & Coping Board)
const COPING_CHOICES = [
  ['🫁', 'Respirer doucement (3 fois)', 'Ntnffes b chwiya', 'نتنفس بشوية', 'breath'],
  ['🎧', 'Mettre mon casque anti-bruit', 'Ndir l casque', 'ندير الكاسك', 'action'],
  ['🧸', 'Serrer ma peluche / un câlin', 'N3enneq l mouna', 'نعنق المونة', 'action'],
  ['🔢', 'Compter jusqu’à 10', 'N7seb 7ta l 3achra', 'نحسب حتى لعشرة', 'count'],
  ['💧', 'Boire une gorgée d’eau', 'Nchreb chwiya d l ma', 'نشرب شوية د الما', 'action'],
  ['🎵', 'Écouter une chanson douce', 'Nsme3 mousi9a', 'نسمع موسيقى', 'action'],
];

const READING = [['0', '🖼️ Image + texte'], ['1', '🌫️ Image estompée'], ['2', '🔤 Texte seul']];

// ---------- Lecture / écriture ----------
// Les routines gardées par le parent reprennent les micro-étapes à jour (ex. toilettes en 9 étapes depuis la v6.1).
function withDefaultSubSteps(routines) {
  const defaults = new Map(DEFAULT_ROUTINES().flatMap((r) => r.steps).map((s) => [s.id, s.sub]));
  return routines.map((r) => ({ ...r, steps: r.steps.map((s) => (defaults.get(s.id) ? { ...s, sub: defaults.get(s.id) } : s)) }));
}
async function loadState() {
  const [config, prefs, surprise, logs] = await Promise.all([db.getScheduleConfig(CONFIG_ID), db.getScheduleConfig(PREFS_ID),
    db.getScheduleConfig(SURPRISE_ID), db.getScheduleLogsOfDay(dayKey())]);
  return {
    routines: config ? withDefaultSubSteps(config.routines) : DEFAULT_ROUTINES(),
    prefs: { routineId: 'matin', mode: 'steps', reading: '0', ...(prefs || {}) },
    surprise: surprise && surprise.day === dayKey() ? surprise : null,
    logs,
  };
}
const saveRoutines = (routines) => db.putScheduleConfig({ id: CONFIG_ID, routines, updatedAt: Date.now() });
const savePrefs = (prefs) => db.putScheduleConfig({ ...prefs, id: PREFS_ID });

const stepCard = (step) => ({ id: `step-${step.id}`, fr: step.fr, dr: step.dr, ar: step.ar, audioFr: step.audioFr || null, audioDr: step.audioDr || null });
const sayStep = (step, lang) => (step ? sayCard(stepCard(step), lang) : Promise.resolve());
const stepVisual = (step, button = true) => renderVisual({ vkey: `step:${step.id}`, emoji: step.emoji, label: step.fr }, { button });
const stepLabel = (step, lang) => (lang === 'dr'
  ? h('span', { class: 'sched-label' }, step.dr || step.fr, step.ar ? h('small', { class: 'ar', dir: 'rtl' }, step.ar) : null)
  : h('span', { class: 'sched-label' }, step.fr));

// Étapes visibles aujourd'hui : routine du parent (sans les masquées) + l'imprévu du jour, inséré là où il a été annoncé.
function todaySteps(state) {
  const routine = state.routines.find((r) => r.id === state.prefs.routineId) || state.routines[0];
  const steps = routine.steps.filter((s) => !s.hidden);
  const extra = state.surprise && state.surprise.routineId === routine.id ? state.surprise : null;
  if (!extra) return { routine, steps };
  const at = Math.min(extra.at, steps.length);
  return { routine, steps: [...steps.slice(0, at), extra.step, ...steps.slice(at)] };
}

function openDialog(title, ...content) {
  const dialog = h('dialog', { class: 'sched-dialog' });
  const close = () => { if (dialog.open) dialog.close(); dialog.remove(); };
  dialog.append(h('div', { class: 'stack pad' }, h('h3', {}, title), ...content, btn('Fermer', close, 'ghost')));
  document.body.append(dialog);
  dialog.showModal();
  return close;
}

// ---------- Vue principale ----------
// ctx : { isParent(), lang(), onCleanup(fn) }
export function scheduleView(ctx) {
  const root = h('div', { class: 'schedule' }, h('p', { class: 'note' }, 'Chargement du planning…'));
  let state = null;
  let view = 'child';
  let nextAutonomy = 'seule';
  let stopTimer = () => {};
  const rerender = () => { stopTimer(); stopTimer = () => {}; root.replaceChildren(view === 'editor' ? editorView() : childView()); };
  const onParent = () => { if (!ctx.isParent()) view = 'child'; if (state) rerender(); };
  document.addEventListener('kalimati-parent', onParent);
  ctx.onCleanup(() => { stopTimer(); document.removeEventListener('kalimati-parent', onParent); });
  loadState().then((s) => { state = s; rerender(); }).catch((error) => root.replaceChildren(h('p', { class: 'note' }, `Planning indisponible : ${error.message}`)));

  const setPrefs = (patch) => { state = { ...state, prefs: { ...state.prefs, ...patch } }; savePrefs(state.prefs); rerender(); };
  const doneIds = (routineId) => new Map(state.logs.filter((l) => l.routineId === routineId).map((l) => [l.stepId, l]));
  const voiceLang = () => (ctx.lang() === 'dr' ? 'ar' : 'fr');

  // ----- Coche d'une étape : journal + essais ABA liés + renforcement -----
  // Sur téléphone, le son et la voix ne partent que s'ils sont lancés pendant le toucher :
  // on félicite et on annonce l'étape suivante tout de suite, puis on enregistre.
  function cheer(next) {
    const dr = ctx.lang() === 'dr';
    const arabic = dr && hasArabicVoice();
    if (!next) {
      speak(arabic ? 'برافو، ساليتي كلشي' : `Bravo ${firstName()}, tout est fini !`, { lang: arabic ? 'ar' : 'fr' });
      return;
    }
    const recording = dr ? next.audioDr : next.audioFr;
    if (recording) { speak(arabic ? 'برافو' : 'Bravo !', { lang: arabic ? 'ar' : 'fr' }).then(() => playBlob(recording)); return; }
    if (arabic && next.ar) speak(`برافو! دابا: ${next.ar}`, { lang: 'ar' });
    else speak(`Bravo ! Maintenant : ${next.fr}`, { lang: 'fr' });
  }

  async function check(step, { fromTimer = false } = {}) {
    const { routine, steps } = todaySteps(state);
    const before = doneIds(routine.id);
    if (before.has(step.id)) return;
    playClap();
    cheer(steps.find((s) => s.id !== step.id && !before.has(s.id)));
    const autonomy = nextAutonomy;
    nextAutonomy = 'seule';
    const result = autonomy === 'seule' ? 'plus' : 'prompt';
    const meta = { source: 'planning', routine: routine.id, step: step.id };
    const goals = [step.goalId, step.surprise ? 'A.6' : null, fromTimer ? 'A.3' : null].filter(Boolean);
    const trials = await Promise.all(goals.map((goalId) => recordTrial(goalId, result, { item: step.fr, meta })));
    const log = { id: uid('slog'), day: dayKey(), ts: Date.now(), routineId: routine.id, stepId: step.id, autonomy, goals, trials: trials.map((t) => t && t.id).filter(Boolean) };
    await db.addScheduleLog(log);
    state = { ...state, logs: [...state.logs, log] };
    const done = doneIds(routine.id);
    if (!steps.some((s) => !done.has(s.id))) await finishRoutine(routine, steps, done);
    rerender();
    const row = root.querySelector(`[data-step="${CSS.escape(step.id)}"]`);
    if (row) row.classList.add('just-done');
  }

  async function finishRoutine(routine, steps, done) {
    const allAlone = steps.every((s) => done.get(s.id).autonomy === 'seule');
    const trial = await recordTrial('W.4', allAlone ? 'plus' : 'prompt', { item: routine.title, meta: { source: 'planning', routine: routine.id } });
    const last = state.logs[state.logs.length - 1];
    if (trial && last) {
      const updated = { ...last, trials: [...last.trials, trial.id] };
      await db.addScheduleLog(updated);
      state = { ...state, logs: [...state.logs.slice(0, -1), updated] };
    }
  }

  async function uncheck(step) {
    const log = doneIds(todaySteps(state).routine.id).get(step.id);
    if (!log) return;
    await Promise.all((log.trials || []).map((id) => db.deleteTrial(id)));
    await db.deleteScheduleLog(log.id);
    state = { ...state, logs: state.logs.filter((l) => l.id !== log.id) };
    rerender();
  }

  function childView() {
    const { routine, steps } = todaySteps(state);
    const done = doneIds(routine.id);
    const mode = state.prefs.mode || 'steps';
    return h('div', { class: `sched-wrap read-${state.prefs.reading}` },
      routineTabs(routine),
      h('div', { class: 'sched-top' },
        h('div', { class: 'seg' },
          btn('📋 Pas à pas', () => setPrefs({ mode: 'steps' }), mode === 'steps' ? 'active' : ''),
          btn('➡️ Maintenant / Ensuite', () => setPrefs({ mode: 'firstThen' }), mode === 'firstThen' ? 'active' : ''),
          btn('⏳ J’attends / Calme', () => setPrefs({ mode: 'wait' }), mode === 'wait' ? 'active' : '')),
        h('div', { class: 'sched-stars', title: 'Étoiles gagnées aujourd’hui' }, `⭐ ${state.logs.length}`, h('small', {}, ` · ${done.size}/${steps.length}`))),
      mode === 'firstThen' ? firstThenView(steps, done) : (mode === 'wait' ? waitingBoardView() : stepsView(steps, done)),
      autonomyBar(),
      ctx.isParent() ? parentTools(routine) : null);
  }

  // v7 (Aegon) : Tableau d'attente et d'auto-régulation (« J'attends X minutes · Pendant que j'attends, je peux… »)
  function waitingBoardView() {
    let waitMin = 2;
    const stage = h('div', { class: 'stack' });
    const activityBox = h('div', { class: 'wait-activity' });
    const renderTimer = () => {
      stopTimer();
      const t = stepTimer({ minutes: waitMin, fr: 'J’attends calmement' });
      stopTimer = t.stop;
      stage.replaceChildren(
        h('div', { class: 'row center' },
          h('strong', {}, '⏳ J’attends :'),
          ...[1, 2, 3, 5, 10].map((m) => btn(`${m} min`, () => { waitMin = m; renderTimer(); }, waitMin === m ? 'primary tiny' : 'ghost tiny'))),
        t.element,
        btn('🌟 J’ai bien attendu calme !', async () => {
          playClap();
          speak(ctx.lang() === 'dr' ? 'برافو، تسنيتي مزيان' : `Bravo ${firstName()}, tu as très bien attendu !`, { lang: voiceLang() });
          await recordTrial('A.5', nextAutonomy === 'seule' ? 'plus' : 'prompt', { item: `attente-${waitMin}min`, meta: { source: 'waiting-board' } });
          stage.append(praise('Attente réussie ! +1 ⭐'));
        }, 'primary wide'));
    };
    const openCoping = ([emoji, fr, dr, ar, kind]) => {
      speak(ctx.lang() === 'dr' ? ar : fr, { lang: voiceLang() });
      if (kind === 'breath') {
        activityBox.replaceChildren(h('div', { class: 'card-box breath-box' },
          h('div', { class: 'breath-circle' }, '🫁'),
          h('p', { class: 'ask' }, ctx.lang() === 'dr' ? 'طلع النفس… هبط النفس…' : 'J’inspire doucement… je souffle doucement…')));
      } else if (kind === 'count') {
        const nums = h('div', { class: 'order-slots' }, Array.from({ length: 10 }, (_, i) => {
          const b = h('button', { type: 'button', class: 'order-slot', onclick: () => { b.classList.add('on'); speak(String(i + 1), { lang: voiceLang() }); } }, String(i + 1));
          return b;
        }));
        activityBox.replaceChildren(h('div', { class: 'card-box stack center' }, h('p', { class: 'ask' }, 'Touche chaque chiffre en comptant calme :'), nums));
      } else {
        activityBox.replaceChildren(bigCard(emoji, ctx.lang() === 'dr' ? dr : fr));
      }
    };
    renderTimer();
    return h('div', { class: 'stack wait-board' },
      stage,
      h('section', { class: 'card-box' },
        h('h3', {}, ctx.lang() === 'dr' ? '🧘 فاش كنتسنى، نقدر ندير :' : '🧘 Pendant que j’attends, je peux choisir :'),
        h('div', { class: 'choices', style: { '--cols': 3 } }, COPING_CHOICES.map((c) => h('button', {
          type: 'button', class: 'choice', onclick: () => openCoping(c),
        }, h('span', { class: 'emoji' }, c[0]), h('span', { class: 'label' }, ctx.lang() === 'dr' ? c[2] : c[1]))))),
      activityBox);
  }


  const routineTabs = (current) => h('div', { class: 'sched-tabs' }, state.routines.map((r) => h('button', {
    type: 'button', class: `sched-tab${r.id === current.id ? ' on' : ''}`, onclick: () => setPrefs({ routineId: r.id }),
  }, h('span', { class: 'emoji' }, r.emoji), h('span', {}, r.title))));

  function stepRow(step, log, isCurrent) {
    const isDone = Boolean(log);
    const toggle = () => { if (!isDone) check(step); else if (ctx.isParent()) uncheck(step); };
    return h('div', { class: `sched-row${isDone ? ' done' : ''}${isCurrent ? ' current' : ''}${step.surprise ? ' surprise' : ''}`, dataset: { step: step.id } },
      h('button', { type: 'button', class: 'sched-step', onclick: () => openStep(step) }, stepVisual(step), stepLabel(step, ctx.lang()),
        step.surprise ? h('span', { class: 'chip-surprise' }, '🔀 Changement') : null,
        step.sub ? h('span', { class: 'sub-hint' }, '👆 petites étapes') : null),
      isDone && ctx.isParent() ? h('span', { class: 'sched-auto' }, log.autonomy === 'seule' ? '✅ seule' : '👉 rappel') : null,
      h('button', { type: 'button', class: 'sched-check', 'aria-label': isDone ? 'Fait' : 'Cocher', onclick: toggle }, isDone ? '✔' : ''));
  }

  function stepsView(steps, done) {
    if (!steps.length) return h('p', { class: 'note' }, 'Aucune étape : ajoutez-en dans « ✏️ Modifier les routines ».');
    const firstOpen = steps.find((s) => !done.has(s.id));
    return [h('div', { class: 'sched-list' }, steps.map((step) => stepRow(step, done.get(step.id), step === firstOpen))),
      firstOpen ? null : praise('Bravo, tout est fini !')];
  }

  function firstThenView(steps, done) {
    const open = steps.filter((s) => !done.has(s.id));
    if (!open.length) return praise('Bravo, tout est fini !');
    const [now, then] = open;
    const timer = stepTimer(now);
    stopTimer = timer.stop;
    return h('div', { class: 'ft-view' },
      h('div', { class: 'ft-now' }, h('span', { class: 'ft-title' }, 'Maintenant'),
        h('button', { type: 'button', class: 'big-card sched-big', onclick: () => openStep(now) }, stepVisual(now), stepLabel(now, ctx.lang()))),
      then ? h('div', { class: 'ft-next' }, h('span', { class: 'ft-title' }, 'Ensuite'), h('div', { class: 'big-card small-card' }, stepVisual(then, false), stepLabel(then, ctx.lang()))) : null,
      timer.element,
      btn('✅ J’ai fini !', () => check(now, { fromTimer: true }), 'primary wide sched-finish'));
  }

  // Sablier : disque qui se vide + alertes douces à 5, 2 et 1 minute (petite note douce, jamais de son strident).
  function stepTimer(step) {
    const total = Math.max(1, Number(step.minutes) || 5) * 60;
    let remaining = total;
    let interval = 0;
    const fired = new Set();
    const disc = h('div', { class: 'tt-disc' });
    const clock = h('span', { class: 'tt-clock' });
    const alert = h('p', { class: 'tt-alert', 'aria-live': 'polite' });
    const draw = () => {
      disc.style.setProperty('--p', String(remaining / total));
      clock.textContent = `${Math.floor(remaining / 60)}:${String(Math.floor(remaining % 60)).padStart(2, '0')}`;
    };
    const warn = ([at, fr, ar]) => {
      if (remaining > at || total <= at || fired.has(at)) return;
      fired.add(at);
      alert.textContent = `⏳ ${fr}`;
      playBeep();
      speak(ctx.lang() === 'dr' ? ar : fr, { lang: voiceLang(), rate: 0.8 });
    };
    const tick = () => {
      remaining = Math.max(0, remaining - 1);
      ALERTS.forEach(warn);
      if (!remaining) { clearInterval(interval); alert.textContent = '🌟 C’est l’heure de passer à la suite'; }
      draw();
    };
    const start = btn('▶ Lancer le sablier', () => { if (interval) return; interval = setInterval(tick, 1000); start.disabled = true; }, 'ghost');
    draw();
    return { element: h('div', { class: 'tt' }, h('div', { class: 'tt-row' }, disc, clock), alert, start), stop: () => clearInterval(interval) };
  }

  // Toucher une étape : on l'entend ; si elle a des micro-étapes, elles s'ouvrent à cocher.
  function openStep(step) {
    sayStep(step, ctx.lang());
    if (!step.sub || !step.sub.length) return;
    let close = () => {};
    const board = sequenceBoard(step.sub, { onComplete: () => { close(); check(step); } });
    close = openDialog(`${step.emoji} ${step.fr}`, h('p', { class: 'note' }, 'Touche chaque petite étape quand elle est faite.'), board.element);
  }

  // Note discrète de l'adulte : la prochaine coche compte « seule » ou « avec rappel ».
  function autonomyBar() {
    const choice = (value, text) => h('button', { type: 'button', class: `pill-btn${nextAutonomy === value ? ' on' : ''}`, dataset: { v: value }, onclick: () => set(value) }, text);
    const bar = h('div', { class: 'auto-bar' }, h('span', {}, 'Prochaine coche :'), choice('seule', '✅ Seule'), choice('rappel', '👉 Avec rappel'));
    function set(value) { nextAutonomy = value; bar.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === value)); }
    return bar;
  }

  function parentTools(routine) {
    const reading = h('select', { 'aria-label': 'Je sais déjà lire', onchange: (e) => setPrefs({ reading: e.target.value }) },
      READING.map(([v, label]) => h('option', { value: v, selected: v === state.prefs.reading }, label)));
    return h('section', { class: 'card-box sched-parent' }, h('h3', {}, '🔓 Pour l’adulte'),
      h('div', { class: 'row' },
        btn('🔀 Changement / Surprise', () => surpriseDialog(routine), 'ghost'),
        btn('✏️ Modifier les routines', () => { view = 'editor'; rerender(); }, 'ghost'),
        btn('🖨️ Imprimer le tableau MATIN / SOIR', printSheet, 'ghost')),
      h('label', { class: 'check' }, '📖 Je sais déjà lire : ', reading),
      h('p', { class: 'note' }, 'Chaque coche est notée dans les objectifs liés (W.4 routine complète, U.4, V.4, X.2, W.3, A.3 en mode Maintenant / Ensuite, A.6 pour un changement). Touchez une coche ✔ pour l’annuler.'));
  }

  function surpriseDialog(routine) {
    let close = () => {};
    const choose = async ([emoji, fr, dr, ar, minutes]) => {
      const { steps } = todaySteps({ ...state, surprise: null });
      const done = doneIds(routine.id);
      const open = steps.findIndex((s) => !done.has(s.id));
      const surprise = { id: SURPRISE_ID, day: dayKey(), routineId: routine.id, at: open < 0 ? steps.length : open, step: S(uid('surprise'), fr, dr, ar, emoji, minutes, { surprise: true }) };
      await db.putScheduleConfig(surprise);
      state = { ...state, surprise };
      close();
      rerender();
      speak(ctx.lang() === 'dr' ? `تبديل! دابا ${ar}` : `Changement ! Maintenant : ${fr}`, { lang: voiceLang() });
    };
    const clear = async () => { await db.deleteScheduleConfig(SURPRISE_ID); state = { ...state, surprise: null }; close(); rerender(); };
    close = openDialog('🔀 Un changement aujourd’hui',
      h('p', { class: 'note' }, 'L’imprévu s’ajoute avant la prochaine étape. Montrez-le à l’enfant pour la préparer.'),
      h('div', { class: 'choices', style: { '--cols': 2 } }, SURPRISES.map((s) => h('button', { type: 'button', class: 'choice', onclick: () => choose(s) },
        h('span', { class: 'emoji' }, s[0]), h('span', { class: 'label' }, s[1])))),
      state.surprise ? btn('Retirer le changement du jour', clear, 'ghost') : null);
  }

  // Fiche imprimable fidèle au tableau plastifié : deux colonnes, ronds vides à cocher au feutre.
  function printSheet() {
    const column = (id) => {
      const routine = state.routines.find((r) => r.id === id);
      if (!routine) return null;
      return h('div', { class: 'ps-col' }, h('h2', {}, `${routine.emoji} ${routine.title.toUpperCase()}`),
        routine.steps.filter((s) => !s.hidden).map((s, i) => h('div', { class: 'ps-row' }, h('span', { class: 'ps-num' }, String(i + 1)),
          stepVisual(s, false), h('span', { class: 'ps-label' }, s.fr, h('small', {}, s.dr)), h('span', { class: 'ps-circle' }))));
    };
    const area = h('div', { class: 'print-area' }, h('div', { class: 'print-sheet routine-sheet' },
      h('h1', {}, `Ma routine quotidienne · ${firstName()}`), h('div', { class: 'ps-cols' }, column('matin'), column('soir'))));
    document.body.append(area);
    const cleanup = () => { area.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 300);
  }

  // ---------- Éditeur parent ----------
  function editorView() {
    if (!ctx.isParent()) { view = 'child'; return childView(); }
    const routine = state.routines.find((r) => r.id === state.prefs.routineId) || state.routines[0];
    const update = async (steps) => {
      const routines = state.routines.map((r) => (r.id === routine.id ? { ...r, steps } : r));
      state = { ...state, routines };
      await saveRoutines(routines);
      rerender();
    };
    const actions = {
      patch: (i, values) => update(routine.steps.map((s, j) => (j === i ? { ...s, ...values } : s))),
      move: (i, d) => {
        const j = i + d;
        if (j < 0 || j >= routine.steps.length) return;
        const steps = [...routine.steps];
        [steps[i], steps[j]] = [steps[j], steps[i]];
        update(steps);
      },
      remove: (i) => { if (window.confirm(`Supprimer « ${routine.steps[i].fr} » ?`)) update(routine.steps.filter((_, j) => j !== i)); },
    };
    const add = () => update([...routine.steps, S(uid('step'), 'Nouvelle étape', '', '', '⭐', 5)]);
    const reset = async () => {
      if (!window.confirm('Remettre toutes les routines comme au départ ? Les photos restent.')) return;
      state = { ...state, routines: DEFAULT_ROUTINES() };
      await saveRoutines(state.routines);
      rerender();
    };
    return h('div', { class: 'sched-wrap editor' },
      h('div', { class: 'row' }, btn('✔ Terminé', () => { view = 'child'; rerender(); }, 'primary'), btn('↺ Remettre le tableau d’origine', reset, 'ghost tiny')),
      routineTabs(routine),
      h('p', { class: 'note' }, '📷 sur l’image : mettre une vraie photo (son lit, son tapis de prière, sa brosse à dents). 🎙️ : enregistrer votre voix.'),
      h('div', { class: 'ed-steps' }, routine.steps.map((step, i) => stepEditor(step, i, actions))),
      btn('➕ Ajouter une étape', add, 'primary'));
  }

  function stepEditor(step, i, { patch, move, remove }) {
    const field = (key, label, attrs = {}) => h('label', { class: 'ed-field' }, h('span', {}, label),
      h('input', { value: step[key] ?? '', ...attrs, onchange: (e) => patch(i, { [key]: attrs.type === 'number' ? Math.max(1, Number(e.target.value) || 1) : e.target.value }) }));
    return h('div', { class: `ed-step${step.hidden ? ' is-hidden' : ''}` },
      h('div', { class: 'ed-step-head' }, h('span', { class: 'ed-num' }, String(i + 1)), stepVisual(step),
        h('div', { class: 'row' }, btn('↑', () => move(i, -1), 'ghost tiny'), btn('↓', () => move(i, 1), 'ghost tiny'),
          btn(step.hidden ? '🙈 Masquée' : '👁 Visible', () => patch(i, { hidden: !step.hidden }), 'ghost tiny'), btn('🗑', () => remove(i), 'ghost tiny'))),
      h('div', { class: 'ed-grid' }, field('emoji', 'Image', { maxlength: 8 }), field('fr', 'Français'), field('dr', 'Darija (lettres latines)'),
        field('ar', 'Darija (lettres arabes)', { dir: 'rtl' }), field('minutes', 'Durée (min)', { type: 'number', min: 1, max: 600 })),
      h('div', { class: 'row' }, voiceButtons(step, 'fr', (v) => patch(i, v)), voiceButtons(step, 'dr', (v) => patch(i, v))));
  }

  function voiceButtons(step, lang, save) {
    const key = lang === 'dr' ? 'audioDr' : 'audioFr';
    const name = lang === 'dr' ? 'Darija' : 'FR';
    if (!canRecord()) return h('span', { class: 'note' }, 'Micro indisponible');
    let stop = null;
    const rec = btn(`🎙️ Voix ${name}`, async () => {
      if (stop) { const blob = await stop(); stop = null; save({ [key]: blob }); return; }
      try { stop = await startRecording(); rec.textContent = '⏹ Arrêter'; rec.classList.add('recording'); } catch { rec.textContent = 'Micro refusé'; }
    }, 'ghost tiny');
    return h('span', { class: 'voice-btns' }, rec,
      step[key] ? btn('▶', () => playBlob(step[key]), 'ghost tiny') : null,
      step[key] ? btn('✖', () => save({ [key]: null }), 'ghost tiny') : null);
  }

  return root;
}
