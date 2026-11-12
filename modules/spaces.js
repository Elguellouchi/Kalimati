// Espaces « Séance ABA », « Routines & autonomie » et « Émotions & famille ».
// Machine à états de navigation : home → section → exercise (retour = état précédent).
import * as db from '../db.js';
import { h, btn } from './util.js';
import { stopSpeaking } from '../speech.js';
import { clinicBar, firstName, sisterName } from './aba.js';
import { SECTIONS, GOALS, goalById, goalsOf } from './goals.js';
import { evaluate } from './progress.js';
import { nour } from './nour.js';
import { renderVisual } from './visuals.js';
import { emotionStudio, photoGallery } from './ex-emotions.js';
import { EXERCISES as A } from './ex-coop.js';
import { EXERCISES as B } from './ex-visual.js';
import { EXERCISES as C } from './ex-receptive.js';
import { EXERCISES as DE } from './ex-imitation.js';
import { EXERCISES as FGH } from './ex-verbal.js';
import { EXERCISES as KP } from './ex-social.js';
import { EXERCISES as QRT } from './ex-academic.js';
import { EXERCISES as S } from './ex-writing.js';
import { EXERCISES as UZ, mealTitle } from './ex-autonomy.js';
import { ONLINE_EXERCISES } from './ex-online.js';
import { levelHeader, onLevelChange } from './levels.js';

export const REGISTRY = { ...A, ...B, ...C, ...DE, ...FGH, ...KP, ...QRT, ...S, ...UZ };
export const missingExercises = () => GOALS.filter((g) => !REGISTRY[g.id]).map((g) => g.id);

// Les routines sont ancrées dans la vraie vie d'Abir (sa famille, sa maison, sa classe).
export const routines = () => [
  { title: '⏳ Temps et transitions', items: [['A.1', '⏳', 'Mon sablier visuel (Time Timer)'], ['A.3', '➡️', 'D’abord / Ensuite'], ['A.2', '🎁', 'Ce qui me fait plaisir']] },
  { title: '🏫 Classe', items: [['M.2', '👧', 'Regroupement 5 min'], ['N.1', '🎒', 'Arrivée en classe'], ['N.2', '✋', 'Je lève la main'], ['N.3', '🖍️', 'Changer d’activité']] },
  { title: `🍽️ ${mealTitle()}`, items: [['V.1', '🥄', 'Je mange à la cuillère'], ['V.2', '🍴', 'Je pique à la fourchette'], ['V.3', '🥛', 'Je bois au verre']] },
  { title: '🏠 Maison', items: [['U.1', '👕', 'Je m’habille'], ['U.2', '🧥', 'Je ferme mon vêtement'], ['U.3', '👟', 'Mes chaussures'], ['W.1', '🧼', 'Je me lave les mains'], ['W.2', '😊', 'Je me lave le visage'], ['W.3', '🪥', 'Je me brosse les dents']] },
  { title: '🚽 Toilettes', items: [['X.3', '⏰', 'Rappel et journal'], ['X.2', '🧻', 'Après les toilettes'], ['X.1', '🌟', 'Mes demandes']] },
  { title: '✂️ Ateliers', items: [['Z.2', '✂️', `Atelier découpage d'${firstName()}`], ['Z.3', '📿', 'J’enfile des perles']] },
];

const STATUS = { done: '✅ Atteint', progress: '🔄 En cours', todo: '○ À commencer' };

export function statusChip(result) {
  return h('span', { class: `chip ${result.status}` }, result.status === 'progress' ? `${STATUS.progress} ${result.pct} %` : STATUS[result.status]);
}

export async function evaluateAll() {
  const all = await db.getAllTrials();
  const byGoal = new Map(GOALS.map((g) => [g.id, []]));
  all.forEach((t) => { if (byGoal.has(t.goalId)) byGoal.get(t.goalId).push(t); });
  return { all, results: new Map(GOALS.map((g) => [g.id, evaluate(g, byGoal.get(g.id), all)])) };
}

// app : { container, state (lang, parent, cards) }
export function createNavigator(app) {
  const history = [];
  let cleanups = [];

  const runCleanups = () => { cleanups.forEach((fn) => { try { fn(); } catch { /* écran déjà fermé */ } }); cleanups = []; stopSpeaking(); };
  const show = (screen) => { runCleanups(); app.container.replaceChildren(screen()); app.container.scrollTop = 0; };
  const go = (screen) => { history.push(screen); show(screen); };
  const back = () => { history.pop(); show(history[history.length - 1]); };
  const header = (title, sub) => h('div', { class: 'screen-head' },
    history.length > 1 ? btn('← Retour', back, 'ghost') : null,
    h('div', {}, h('h2', {}, title), sub ? h('p', { class: 'note' }, sub) : null));
  const context = () => ({ lang: app.state.lang, parent: app.state.parent, cards: app.state.cards, onCleanup: (fn) => cleanups.push(fn) });
  const photoHint = () => (app.state.parent ? h('p', { class: 'photo-hint' }, '📸 Mode parent : touchez le petit 📷 d’une image pour mettre une vraie photo.') : null);

  // En ligne : version enrichie (catalogue + images en ligne) quand elle existe ; hors ligne : exercice d'origine.
  const exerciseFor = (goalId) => (navigator.onLine && ONLINE_EXERCISES[goalId]) || REGISTRY[goalId];

  function exerciseScreen(goalId) {
    const goal = goalById(goalId);
    let local = []; // nettoyages propres à l'exercice affiché (micro, caméra, minuteurs)
    const mount = () => {
      const ctx = { ...context(), goalId, onCleanup: (fn) => local.push(fn) };
      try { return exerciseFor(goalId)(ctx); } catch (error) { return h('p', { class: 'note' }, `Exercice indisponible : ${error.message}`); }
    };
    const unmount = () => { local.forEach((fn) => { try { fn(); } catch { /* déjà fermé */ } }); local = []; stopSpeaking(); };
    const holder = h('div', { class: 'exercise-body' }, mount());
    // Changer de niveau relance l'exercice avec les nouveaux paramètres.
    const remount = () => { unmount(); holder.replaceChildren(mount()); };
    const bar = levelHeader(goalId, remount);
    // Montée de niveau automatique : seuls les exercices qui dépendent du niveau sont relancés (un minuteur en cours n'est jamais coupé).
    const offLevel = onLevelChange((id, state, reason) => { if (id === goalId && reason === 'levelup' && navigator.onLine && ONLINE_EXERCISES[goalId]) remount(); });
    cleanups.push(() => { unmount(); bar.cleanup(); offLevel(); });
    return h('div', { class: 'screen' }, header(`${goal.id} · ${goal.title}`, `Critère : ${goal.criterion}`), bar, clinicBar(), photoHint(), holder);
  }

  function sectionScreen(sectionId) {
    const section = SECTIONS.find((s) => s.id === sectionId);
    const list = h('div', { class: 'goal-list' });
    evaluateAll().then(({ results }) => list.replaceChildren(...goalsOf(sectionId).map((g) => h('button', {
      type: 'button', class: 'goal-row', onclick: () => go(() => exerciseScreen(g.id)),
    }, h('strong', {}, g.id), h('span', { class: 'goal-title' }, g.title), statusChip(results.get(g.id))))));
    return h('div', { class: 'screen' }, header(`${section.emoji} ${section.id}. ${section.name}`), list);
  }

  function sessionHome() {
    return h('div', { class: 'screen' },
      h('div', { class: 'space-intro' }, nour({ pose: 'wave', size: 70 }), h('div', {}, h('h2', {}, `🧩 Séance ABA d'${firstName()}`), h('p', { class: 'note' }, 'Choisissez l’intervenant et le lieu, puis une section du PEI.'))),
      clinicBar(),
      h('div', { class: 'section-grid' }, SECTIONS.map((s) => h('button', { type: 'button', class: 'section-tile', onclick: () => go(() => sectionScreen(s.id)) },
        h('span', { class: 'emoji' }, s.emoji), h('strong', {}, s.id), h('span', {}, s.name)))));
  }

  function routinesHome() {
    return h('div', { class: 'screen' },
      h('div', { class: 'space-intro' }, h('div', {}, h('h2', {}, '⏳ Routines & autonomie'), h('p', { class: 'note' }, `La journée d'${firstName()} : sablier, repas en famille, maison, classe et toilettes.`))),
      clinicBar(),
      routines().map((group) => h('section', {}, h('h3', {}, group.title),
        h('div', { class: 'section-grid' }, group.items.map(([id, emoji, label]) => h('button', { type: 'button', class: 'section-tile', onclick: () => go(() => exerciseScreen(id)) },
          h('span', { class: 'emoji' }, emoji), h('span', {}, label)))))));
  }

  const studioScreen = () => h('div', { class: 'screen' }, header('😊 Studio des émotions'), photoHint(), emotionStudio(context()));
  const galleryScreen = () => h('div', { class: 'screen' }, header('📸 Personnaliser avec nos vraies photos'),
    app.state.parent ? photoGallery() : h('p', { class: 'ask' }, '🔒 Réservé aux adultes : restez appuyé sur le cadenas en haut à droite.'));

  function emotionsHome() {
    const family = [['person:abir', firstName()], ['person:ghita', sisterName()], ['person:papa', 'Papa'], ['person:maman', 'Maman']];
    return h('div', { class: 'screen' },
      h('h2', {}, '😊 Émotions & famille'),
      h('div', { class: 'family-table' }, family.map(([vkey, label]) => h('div', { class: 'family-seat' }, renderVisual({ vkey, label }), h('span', {}, label)))),
      h('div', { class: 'section-grid' },
        h('button', { type: 'button', class: 'section-tile big', onclick: () => go(studioScreen) }, h('span', { class: 'emoji' }, '😊'), h('span', {}, 'Studio des émotions')),
        h('button', { type: 'button', class: 'section-tile big', onclick: () => go(galleryScreen) }, h('span', { class: 'emoji' }, '📸'), h('span', {}, 'Nos vraies photos'), app.state.parent ? null : h('small', {}, '🔒 adultes'))));
  }

  return {
    attach(container) { app.container = container; },
    openSession() { history.length = 0; go(sessionHome); },
    openRoutines() { history.length = 0; go(routinesHome); },
    openEmotions() { history.length = 0; go(emotionsHome); },
    openGallery() { history.length = 0; history.push(emotionsHome); go(galleryScreen); },
    openGoal(goalId, home) { history.length = 0; if (home) history.push(home); go(() => exerciseScreen(goalId)); },
    leave: runCleanups,
  };
}
