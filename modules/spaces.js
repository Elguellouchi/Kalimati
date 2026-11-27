// Espaces « Séance ABA », « Routines & autonomie » et « Émotions & famille ».
// Machine à états de navigation : home → section → exercise (retour = état précédent).
import * as db from '../db.js';
import { h, btn } from './util.js';
import { stopSpeaking } from '../speech.js';
import { clinicBar, firstName, sisterName, onTrial } from './aba.js';
import { friendCompanionBanner, friendCalmRewardCard, unlockFriendSticker } from './friends.js';
import { SECTIONS, GOALS, goalById, goalsOf } from './goals.js';
import { evaluate } from './progress.js';
import { nour } from './nour.js';
import { starBar } from './rewards-kids.js';
import { renderVisual } from './visuals.js';
// v10.9 (lot A) : jeux = cartes non masquées seulement ; minuteurs d'aide coupés en quittant l'écran.
import { setPlayableCards, playableCards, setActiveGameId, stopAllChoiceTimers } from './widgets.js';
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
import { ONLINE_EXERCISES as ONLINE_BASE } from './ex-online.js';
import { NEXT_EXERCISES } from './ex-next.js';
import { levelHeader, onLevelChange, levelOf } from './levels.js';
import { scheduleView } from './ex-schedule.js';
import { storiesView } from './stories.js';
import { orthoScreen } from './ex-ortho.js';
import { hygieneHubScreen } from './ex-hygiene.js';
import { tx, sectionLabel, goalTitle, routineText } from './section-i18n.js';
import { cardWord } from './languages.js';

// Prochains niveaux ABLLS-R : le même jeu sert en ligne (pictos et photos du catalogue) et hors ligne (dessins).
export const REGISTRY = { ...A, ...B, ...C, ...DE, ...FGH, ...KP, ...QRT, ...S, ...UZ, ...NEXT_EXERCISES };
const ONLINE_EXERCISES = { ...ONLINE_BASE, ...NEXT_EXERCISES };
export const missingExercises = () => GOALS.filter((g) => !REGISTRY[g.id]).map((g) => g.id);

// Les routines sont ancrées dans la vraie vie de l'enfant (sa famille, sa maison, sa classe).
export const routines = (lang = 'fr') => {
  const L = (fr, dr) => routineText(lang, fr, dr);
  return [
    { title: L('⏳ Temps et transitions', '⏳ Lw9t w t-taghyir'), items: [['A.1', '⏳', L('Mon sablier visuel (Time Timer)', 'S-sablier dyali')], ['A.3', '➡️', L('D’abord / Ensuite', 'Lwel / Men be3d')], ['A.2', '🎁', L('Ce qui me fait plaisir', 'Li kayferre7ni')]] },
    { title: L('🏫 Classe', '🏫 L9ism'), items: [['M.2', '👧', L('Regroupement 5 min', 'Tjam3o 5 dqiq')], ['N.1', '🎒', L('Arrivée en classe', 'Dkhol l l9ism')], ['N.2', '✋', L('Je lève la main', 'Kanrfe3 yddi')], ['N.3', '🖍️', L('Changer d’activité', 'Nbeddel l3ba')]] },
    { title: `🍽️ ${mealTitle()}`, items: [['V.1', '🥄', L('Je mange à la cuillère', 'Kanakol b lm3el9a')], ['V.2', '🍴', L('Je pique à la fourchette', 'Kanachk b lfourchita')], ['V.3', '🥛', L('Je bois au verre', 'Kanchreb f kass')]] },
    { title: L('🏠 Maison & Habillage', '🏠 Dar w lbas'), items: [['U.1', '👕', L('Je m’habille', 'Kanlbess')], ['U.2', '🧥', L('Je ferme mon vêtement', 'Kansedd lbasi')], ['U.3', '👟', L('Mes chaussures', 'Sbbati')], ['U.4', '🌦️', L('Habits selon la météo', 'Lbas 3la 7sab t-t9s')]] },
    { title: L('🫧 Hygiène & Soins du corps (10 routines)', '🫧 Nadafa w soins (10 routines)'), items: [['W.4', '🫧', L('Toutes mes routines hygiène (Douche, Ongles, Shampoing…)', 'Routines d nadafa (douche, dfar, shampoing…)')], ['W.1', '🧼', L('Je me lave les mains (7 étapes)', 'Kanġsel yeddiya (7 khatwat)')], ['W.2', '😊', L('Je me lave le visage (6 étapes)', 'Kanġsel wejhi (6 khatwat)')], ['W.3', '🪥', L('Je me brosse les dents (8 étapes)', 'Kann99i snani (8 khatwat)')]] },
    { title: L('🚽 Toilettes', '🚽 Bit l ma'), items: [['X.3', '⏰', L('Rappel et journal', 'T-tnimma w l journal')], ['X.2', '🧻', L('Après les toilettes', 'Men be3d bit l ma')], ['X.1', '🌟', L('Mes demandes', 'Talabat dyali')]] },
    { title: L('✂️ Ateliers', '✂️ Ateliers'), items: [['Z.2', '✂️', L(`Atelier découpage d'${firstName()}`, `Atelier d 9ta3 d ${firstName('dr')}`)], ['Z.3', '📿', L('J’enfile des perles', 'Kandkhel l7beb')]] },
  ];
};

export function statusChip(result, lang = 'fr') {
  const label = tx(result.status === 'progress' ? 'statusProgress' : result.status === 'done' ? 'statusDone' : 'statusTodo', lang);
  return h('span', { class: `chip ${result.status}` }, result.status === 'progress' ? `${label} ${result.pct} %` : label);
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

  const runCleanups = () => {
    // === [DEBUT MODIF v10.9-lot-A : Arrêt immédiat des minuteurs d'aide et de démo en quittant l'écran] ===
    stopAllChoiceTimers();
    // === [FIN MODIF v10.9-lot-A] ===
    cleanups.forEach((fn) => { try { fn(); } catch { /* écran déjà fermé */ } });
    cleanups = [];
    stopSpeaking();
  };
  const show = (screen) => { runCleanups(); app.container.replaceChildren(screen()); app.container.scrollTop = 0; };
  const go = (screen) => { history.push(screen); show(screen); };
  const back = () => { history.pop(); show(history[history.length - 1]); };
  // Partout : 🏠 Accueil (retour direct à l'écran d'accueil) et ← Retour (écran précédent).
  const header = (title, sub) => h('div', { class: 'screen-head' },
    h('div', { class: 'nav-btns' }, app.goHome ? btn(tx('home', app.state.lang), () => { runCleanups(); app.goHome(); }, 'home-btn') : null,
      history.length > 1 ? btn(tx('back', app.state.lang), back, 'back-btn') : null),
    title ? h('div', {}, h('h2', {}, title), sub ? h('p', { class: 'note' }, sub) : null) : null);
  // v10.9 (lot A, pépite 2) : les jeux ne reçoivent que les cartes non masquées dans Parler.
  const context = () => {
    setPlayableCards(app.state.cards, { parent: app.state.parent, onlyReviewed: app.state.onlyReviewed });
    return { lang: app.state.lang, parent: app.state.parent, cards: playableCards(app.state.cards), onCleanup: (fn) => cleanups.push(fn) };
  };
  const photoHint = () => (app.state.parent ? h('p', { class: 'photo-hint' }, tx('photoHint', app.state.lang)) : null);

  // v9.12 : un seul ami par écran. Le bandeau en haut de chaque espace ; l'autocollant de l'ami après 3 essais notés.
  const friendBanner = (mission) => friendCompanionBanner(mission, { lang: app.state.lang });
  const MISSION_TRIALS = 3;
  const missionReward = (friendId) => {
    const holder = h('div', { class: 'friend-reward-slot' });
    let count = 0;
    const off = onTrial((trial) => {
      if (trial.result === 'log' || ++count !== MISSION_TRIALS) return;
      unlockFriendSticker(friendId).then(() => holder.replaceChildren(...[friendCalmRewardCard(friendId, { lang: app.state.lang })].filter(Boolean))).catch(() => {});
    });
    cleanups.push(off);
    return holder;
  };
  // v10.5 (F01) : la barre « intervenant / lieu » n'apparaît qu'en mode parent.
  const adultClinicBar = () => (app.state.parent ? clinicBar() : null);
  const routineIds = () => new Set(routines().flatMap((g) => g.items.map(([id]) => id)));
  const friendOfGoal = (goalId) => (goalId.startsWith('W.') ? 'mchicha' : routineIds().has(goalId) ? 'fakroun' : 'fennou');

  // En ligne : version enrichie (catalogue + images en ligne) quand elle existe ; hors ligne : exercice d'origine.
  const exerciseFor = (goalId) => (navigator.onLine && ONLINE_EXERCISES[goalId]) || REGISTRY[goalId];

  function exerciseScreen(goalId) {
    const goal = goalById(goalId);
    let local = []; // nettoyages propres à l'exercice affiché (micro, caméra, minuteurs)
    const mount = () => {
      setActiveGameId(goalId); // v10.9 : démo muette et règle des 8 essais propres à chaque jeu
      const ctx = { ...context(), goalId, onCleanup: (fn) => local.push(fn) };
      try { return exerciseFor(goalId)(ctx); } catch (error) { return h('p', { class: 'note' }, tx('exerciseUnavailable', app.state.lang, { msg: error.message })); }
    };
    const unmount = () => { stopAllChoiceTimers(); local.forEach((fn) => { try { fn(); } catch { /* déjà fermé */ } }); local = []; stopSpeaking(); };
    const holder = h('div', { class: 'exercise-body' }, mount());
    // Changer de niveau relance l'exercice avec les nouveaux paramètres.
    const remount = () => { unmount(); holder.replaceChildren(mount()); };
    const bar = levelHeader(goalId, remount);
    // Montée de niveau automatique : seuls les exercices qui dépendent du niveau sont relancés (un minuteur en cours n'est jamais coupé).
    const offLevel = onLevelChange((id, state, reason) => { if (id === goalId && reason === 'levelup' && navigator.onLine && ONLINE_EXERCISES[goalId]) remount(); });
    cleanups.push(() => { unmount(); bar.cleanup(); offLevel(); });
    const title = goalTitle(goal, app.state.lang);
    return h('div', { class: 'screen' }, header(app.state.parent ? `${goal.id} · ${title}` : title, app.state.parent ? tx('criterion', app.state.lang, { text: goal.criterion }) : undefined), starBar(app.state.lang), bar, adultClinicBar(), photoHint(), holder, missionReward(friendOfGoal(goalId)));
  }

  function sectionScreen(sectionId) {
    const section = SECTIONS.find((s) => s.id === sectionId);
    const list = h('div', { class: 'goal-list' });
    const row = (g, results) => {
      const result = results.get(g.id);
      const level = levelOf(g.id).currentLevel;
      const started = level > 1 || (result && result.count > 0);
      return h('button', { type: 'button', class: 'goal-row', onclick: () => go(() => exerciseScreen(g.id)) },
        app.state.parent ? h('strong', {}, g.id) : null, h('span', { class: 'goal-title' }, goalTitle(g, app.state.lang)),
        app.state.parent && started ? h('span', { class: 'level-badge' }, tx('levelBadge', app.state.lang, { n: level })) : null, statusChip(result, app.state.lang));
    };
    // v10.6 (F14) : filtre « jeux en cours » pour l'adulte, pour moins défiler sur téléphone.
    let onlyInProgress = false;
    let cached = null;
    const part = (title, goals, results) => {
      const shown = onlyInProgress ? goals.filter((g) => results.get(g.id)?.status === 'progress') : goals;
      return shown.length ? [h('h3', { class: 'phase-title' }, title), ...shown.map((g) => row(g, results))] : [];
    };
    const renderList = () => {
      if (!cached) return;
      const goals = goalsOf(sectionId);
      const children = [
        ...part(tx('peiHeading', app.state.lang), goals.filter((g) => g.phase !== 'next'), cached),
        ...part(tx('nextHeading', app.state.lang), goals.filter((g) => g.phase === 'next'), cached)];
      list.replaceChildren(...(children.length ? children : [h('p', { class: 'note' }, tx('noGames', app.state.lang))]));
    };
    const filterBtn = app.state.parent ? btn(tx('onlyInProgress', app.state.lang), () => {
      onlyInProgress = !onlyInProgress;
      filterBtn.textContent = tx(onlyInProgress ? 'allGames' : 'onlyInProgress', app.state.lang);
      renderList();
    }, 'ghost tiny') : null;
    evaluateAll().then(({ results }) => { cached = results; renderList(); });
    const name = sectionLabel(section, app.state.lang);
    return h('div', { class: 'screen' }, header(app.state.parent ? `${section.emoji} ${section.id}. ${name}` : `${section.emoji} ${name}`),
      filterBtn ? h('div', { class: 'row' }, filterBtn) : null, list);
  }

  function sessionHome() {
    const L = app.state.lang;
    return h('div', { class: 'screen' }, header(''), friendBanner('session'),
      h('div', { class: 'space-intro' }, nour({ pose: 'wave', size: 70 }), h('div', {}, h('h2', {}, tx('gamesTitle', L, { name: firstName(L) })), h('p', { class: 'note' }, tx(app.state.parent ? 'gamesParentHint' : 'gamesKidHint', L)))),
      starBar(L),
      adultClinicBar(),
      h('button', { type: 'button', class: 'section-tile big ortho-tile', onclick: () => go(orthoHome) }, h('span', { class: 'emoji' }, '🗣️'), h('span', {}, tx('orthoTitle', L)),
        h('small', {}, tx(app.state.parent ? 'orthoSub' : 'orthoKid', L))),
      h('button', { type: 'button', class: 'section-tile big', onclick: () => go(() => hygieneHome()) }, h('span', { class: 'emoji' }, '🫧'), h('span', {}, tx('hygieneTitle', L)),
        h('small', {}, tx('hygieneSub', L))),
      h('div', { class: 'section-grid' }, SECTIONS.map((s) => h('button', { type: 'button', class: 'section-tile', onclick: () => go(() => sectionScreen(s.id)) },
        h('span', { class: 'emoji' }, s.emoji), app.state.parent ? h('strong', {}, s.id) : null, h('span', {}, sectionLabel(s, L))))));
  }

  // « 📅 Ma journée » : le planning visuel d'abord (routine MATIN / SOIR), puis les autres activités de la journée.
  function routinesHome() {
    const planning = scheduleView({ isParent: () => app.state.parent, lang: () => app.state.lang, onCleanup: (fn) => cleanups.push(fn) });
    const L = app.state.lang;
    return h('div', { class: 'screen' }, header(''), friendBanner('routines'),
      h('div', { class: 'space-intro' }, h('div', {}, h('h2', {}, tx('dayTitle', L, { name: firstName(L) })), h('p', { class: 'note' }, tx('daySub', L)))),
      planning,
      h('details', { class: 'more-day' }, h('summary', {}, tx('otherActivities', L)),
        adultClinicBar(),
        routines(L).map((group) => h('section', {}, h('h3', {}, group.title),
          h('div', { class: 'section-grid' }, group.items.map(([id, emoji, label]) => h('button', { type: 'button', class: 'section-tile', onclick: () => go(() => exerciseScreen(id)) },
            h('span', { class: 'emoji' }, emoji), h('span', {}, label))))))));
  }

  const storiesScreen = () => {
    // Bouma : l'autocollant arrive quand l'enfant a passé au moins 20 secondes dans ses histoires.
    const start = Date.now();
    cleanups.push(() => { if (Date.now() - start >= 20000) unlockFriendSticker('bouma').catch(() => {}); });
    return storiesScreenBody();
  };
  const storiesScreenBody = () => h('div', { class: 'screen' }, header(`📖 ${tx('storiesTitle', app.state.lang)}`), friendBanner('stories'),
    storiesView({ isParent: () => app.state.parent, lang: () => app.state.lang, onCleanup: (fn) => cleanups.push(fn) }));
  // v10.5 (G-09) : l'atelier orthophonie (notation par l'adulte) s'ouvre en mode parent seulement.
  const orthoTitle = `🗣️ ${tx('orthoTitle', app.state.lang)}`;
  const orthoHome = () => (app.state.parent
    ? h('div', { class: 'screen' }, header(orthoTitle), friendBanner('talk'), clinicBar(), orthoScreen(context()), missionReward('nour'))
    : h('div', { class: 'screen' }, header(orthoTitle), friendBanner('talk'),
      h('div', { class: 'card-box stack' },
        h('p', { class: 'ask' }, '🔒 L’atelier orthophonie se fait avec un adulte.'),
        h('p', { class: 'note' }, 'Adulte : restez appuyé 3 secondes sur le cadenas en haut, puis rouvrez l’atelier.'))));
  const hygieneHome = (initialId = null) => (setActiveGameId('hygiene-hub'), h('div', { class: 'screen' }, header(`🫧 ${tx('hygieneTitle', app.state.lang)}`, tx('hygieneSub', app.state.lang)), friendBanner('hygiene'), adultClinicBar(), photoHint(), hygieneHubScreen(context(), initialId), missionReward('mchicha')));
  const studioScreen = () => (setActiveGameId('emotions-studio'), h('div', { class: 'screen' }, header(`😊 ${tx('studioTitle', app.state.lang)}`), friendBanner('emotions'), photoHint(), emotionStudio(context()), missionReward('hmama')));
  const galleryScreen = () => h('div', { class: 'screen' }, header(`📸 ${tx('photosTitle', app.state.lang)}`),
    app.state.parent ? photoGallery() : h('p', { class: 'ask' }, '🔒 Réservé aux adultes : restez appuyé sur le cadenas en haut à droite.'));

  function emotionsHome() {
    const L = app.state.lang;
    const head = header('');
    const familyWord = (vkey, fallback) => {
      const card = app.state.cards.find((c) => c.visualKey === vkey);
      return card ? cardWord(card, L) : fallback;
    };
    const family = [['person:child', firstName(L)], ['person:sibling', familyWord('person:sibling', sisterName())],
      ['person:papa', familyWord('person:papa', 'Papa')], ['person:maman', familyWord('person:maman', 'Maman')]];
    return h('div', { class: 'screen' },
      head, friendBanner('emotions'), h('h2', {}, tx('emotionsTitle', L)),
      h('div', { class: 'family-table' }, family.map(([vkey, label]) => h('div', { class: 'family-seat' }, renderVisual({ vkey, label }), h('span', {}, label)))),
      h('div', { class: 'section-grid' },
        h('button', { type: 'button', class: 'section-tile big', onclick: () => go(studioScreen) }, h('span', { class: 'emoji' }, '😊'), h('span', {}, tx('studioTitle', L))),
        h('button', { type: 'button', class: 'section-tile big', onclick: () => go(storiesScreen) }, h('span', { class: 'emoji' }, '📖'), h('span', {}, tx('storiesTitle', L))),
        h('button', { type: 'button', class: 'section-tile big', onclick: () => go(galleryScreen) }, h('span', { class: 'emoji' }, '📸'), h('span', {}, tx('photosTitle', L)), app.state.parent ? null : h('small', {}, tx('adultsOnly', L)))));
  }

  return {
    state: app.state,
    renderAll: app.renderAll,
    renderAllTalk: app.renderAllTalk,
    attach(container) { app.container = container; },
    openSession() { history.length = 0; go(sessionHome); },
    openRoutines() { history.length = 0; go(routinesHome); },
    openEmotions() { history.length = 0; go(emotionsHome); },
    openGallery() { history.length = 0; history.push(emotionsHome); go(galleryScreen); },
    openGoal(goalId, home) { history.length = 0; if (home) history.push(home); go(() => exerciseScreen(goalId)); },
    openScreen(screenFn, home) { history.length = 0; if (home) history.push(home); go(screenFn); },
    back,
    leave: runCleanups,
  };
}
