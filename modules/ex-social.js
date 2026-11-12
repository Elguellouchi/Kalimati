// Sections K, L, M, N, P : jeu, interaction sociale, groupe, routines de classe et généralisation.
import * as db from '../db.js';
import { h, btn, weekKey } from './util.js';
import { speak } from '../speech.js';
import { recordTrial, ratingPanel, firstName, sisterName, people, ENVIRONMENTS } from './aba.js';
import { sequenceBoard, praise, bigCard } from './widgets.js';
import { renderVisual } from './visuals.js';
import { visualTimer, hourglass } from './timer.js';
import { nour } from './nour.js';
import { matrix } from './progress.js';
import { GOALS } from './goals.js';
import { SEQUENCES } from './content.js';

// Séquence cochable par l'enfant + cotation par l'adulte.
export function sequenceExercise(goalId, { fadeOption = false, intro = '' } = {}) {
  return () => {
    const seq = sequenceBoard(SEQUENCES[goalId], { onComplete: () => speak('Bravo, tout est fait !') });
    const fade = h('input', { type: 'checkbox', onchange: (e) => seq.setFade(e.target.checked) });
    return h('div', { class: 'stack' },
      intro ? h('p', { class: 'note' }, intro) : null,
      fadeOption ? h('label', { class: 'check' }, fade, ' Estomper les images (tester l’enchaînement spontané)') : null,
      seq.element,
      ratingPanel(goalId, { item: () => (fade.checked ? 'sans-image' : 'avec-image'), onRated: () => seq.reset() }));
  };
}

// L.1 : une vraie personne de la vie d'Abir dit bonjour ; elle répond avec la carte 👋 dans les 5 secondes.
function l1() {
  const stage = h('div', { class: 'stack' });
  let who = people()[0];
  const picker = h('div', { class: 'people-row' });
  const drawPicker = () => picker.replaceChildren(...people().map((p) => h('button', {
    type: 'button', class: `person-chip${p.id === who.id ? ' on' : ''}`, onclick: () => { who = p; drawPicker(); },
  }, renderVisual({ vkey: p.vkey, label: p.name }), h('span', {}, p.name))));
  const start = () => {
    let answered = false;
    const glass = hourglass(5, () => {
      if (answered) return;
      answered = true;
      recordTrial('L.1', 'minus', { item: who.id, meta: { mode: 'simulateur' } });
      stage.append(h('p', { class: 'note' }, 'Pas de réponse cette fois. On réessaie ?'));
    });
    const hello = h('button', { type: 'button', class: 'big-card social-card', onclick: () => {
      if (answered) return;
      answered = true; glass.stop();
      speak('Bonjour !');
      recordTrial('L.1', 'plus', { item: who.id, meta: { mode: 'simulateur' } });
      stage.append(praise('Bonjour !'));
    } }, h('span', { class: 'emoji' }, '👋'), h('span', { class: 'label' }, 'Bonjour / Salam'));
    stage.replaceChildren(bigCard('🙂', `${who.name} dit : « Bonjour ${firstName()} ! »`, '', who.vkey), glass.element, hello);
    speak(`Bonjour ${firstName()} !`).then(() => glass.run());
  };
  drawPicker();
  return h('div', { class: 'stack' },
    h('p', { class: 'note' }, 'Qui dit bonjour ?'), picker,
    btn('▶ Dire bonjour', start, 'primary'), stage,
    h('h3', {}, 'Dans la vraie vie (quelqu’un dit bonjour)'),
    ratingPanel('L.1', { item: () => who.id, meta: { mode: 'reel' }, labels: { plus: 'A répondu ✅' } }));
}

// L.2 : carte « Viens jouer » + pointage des initiations spontanées (but : 3 par semaine).
function l2() {
  const week = h('p', { class: 'note' });
  const draw = async () => {
    const n = (await db.getTrialsOf('L.2')).filter((t) => t.week === weekKey() && t.result === 'plus').length;
    week.textContent = `Cette semaine : ${n}/3 initiations spontanées.`;
  };
  draw();
  return h('div', { class: 'stack' },
    h('button', { type: 'button', class: 'big-card social-card', onclick: () => speak('Viens jouer !') }, h('span', { class: 'emoji' }, '🧑‍🤝‍🧑'), h('span', { class: 'label' }, 'Viens jouer / Aji nl3bou')),
    h('p', { class: 'note' }, `Par exemple : inviter ${sisterName()} ou un camarade à jouer.`),
    btn('🌟 Initiation spontanée observée', async () => { await recordTrial('L.2', 'plus', { item: weekKey() }); draw(); }, 'primary wide'),
    week);
}

// L.3 : « À qui le tour ? »
function l3() {
  const partners = people().map((p) => p.name);
  let partner = partners[0];
  let abirTurn = true;
  let exchanges = 0;
  const board = h('div', { class: 'turn-board' });
  const draw = () => {
    board.replaceChildren(
      h('div', { class: `turn${abirTurn ? ' on' : ''}` }, '🟢', h('span', {}, `Tour de ${firstName()}`)),
      h('div', { class: `turn${abirTurn ? '' : ' on'}` }, '🔵', h('span', {}, `Tour de ${partner}`)),
      h('div', { class: 'exchanges' }, [1, 2, 3].map((n) => h('span', { class: `dot${n <= exchanges ? ' on' : ''}` }, String(n))), exchanges >= 3 ? h('strong', {}, ' Gagné !') : null));
  };
  const nextTurn = () => {
    if (!abirTurn) exchanges = Math.min(3, exchanges + 1);
    abirTurn = !abirTurn;
    speak(exchanges >= 3 && abirTurn ? 'Gagné !' : (abirTurn ? 'À toi !' : `À ${partner} !`));
    draw();
  };
  draw();
  return h('div', { class: 'stack' },
    h('select', { onchange: (e) => { partner = e.target.value; draw(); } }, partners.map((p) => h('option', { value: p }, p))),
    board,
    h('div', { class: 'row center' }, btn('🔄 Tour suivant', nextTurn, 'primary'), btn('↺ Recommencer', () => { exchanges = 0; abirTurn = true; draw(); }, 'ghost')),
    ratingPanel('L.3', { item: () => partner, meta: () => ({ exchanges }), labels: { plus: 'Tour de rôle tenu ✅' }, onRated: () => { exchanges = 0; abirTurn = true; draw(); } }));
}

// M : regroupement & classe — timer de 5 min avec la loutre assise + compteurs M.1, M.2, M.3.
function groupMode() {
  const m2 = h('div');
  const timer = visualTimer({ minutes: 5, choices: [3, 5, 8, 10], pose: 'sit', onEnd: () => {
    speak('Le regroupement est fini.');
    m2.replaceChildren(h('p', { class: 'ask' }, 'Est-elle restée assise et attentive 5 minutes ?'), ratingPanel('M.2', { item: 'regroupement', labels: { plus: 'Assise et attentive ✅', minus: 'S’est levée ❌' } }));
  } });
  return h('div', { class: 'stack' }, timer.element, m2,
    h('h3', {}, 'M.1 Consigne collective (sans dire son prénom)'), ratingPanel('M.1', { item: 'collectif', labels: { plus: 'A suivi avec le groupe ✅' } }),
    h('h3', {}, 'M.3 Imiter un pair modèle'), ratingPanel('M.3', { item: 'pair', labels: { plus: 'A imité le pair ✅' } }),
    h('details', {}, h('summary', {}, 'Noter M.2 sans le timer'), ratingPanel('M.2', { item: 'regroupement' })));
}

// N.2 : carte plein écran « Je lève la main et j'attends » + sablier de 4 s.
function n2() {
  const glass = hourglass(4, () => speak('Tu peux parler.'));
  const card = h('button', { type: 'button', class: 'big-card fullish', onclick: () => glass.run() },
    h('span', { class: 'emoji' }, '✋'), h('span', { class: 'label' }, 'Je lève la main et j’attends'));
  return h('div', { class: 'stack' }, card, glass.element, btn('⏳ Lancer le sablier (4 s)', () => glass.run(), 'ghost'),
    ratingPanel('N.2', { item: 'main', labels: { plus: 'A levé la main et attendu ✅' } }));
}

// P.1 / P.2 : compétences réussies dans un lieu + confirmation par les parents ou l'enseignant.
function generalisation(goalId, env) {
  return () => {
    const list = h('div', { class: 'stack' });
    const select = h('select', {}, GOALS.filter((g) => !g.id.startsWith('P.')).map((g) => h('option', { value: g.id }, `${g.id} ${g.title}`)));
    const draw = async () => {
      const all = await db.getAllTrials();
      const auto = new Set(all.filter((t) => t.result === 'plus' && t.environment === env && !t.goalId.startsWith('P.')).map((t) => t.goalId));
      const confirmed = new Set(all.filter((t) => t.goalId === goalId && t.result === 'plus').map((t) => String(t.item)));
      const skills = new Set([...auto, ...confirmed]);
      const label = ENVIRONMENTS.find((e) => e.id === env).label;
      list.replaceChildren(h('p', { class: 'ask' }, `${skills.size}/5 compétences généralisées — ${label}`),
        ...[...skills].map((id) => h('div', { class: 'eff-row ok' }, h('span', {}, id), h('span', {}, (GOALS.find((g) => g.id === id) || {}).title || ''))));
    };
    draw();
    return h('div', { class: 'stack' },
      h('p', { class: 'note' }, 'Les essais réussis notés avec ce lieu comptent tout seuls. Vous pouvez aussi confirmer une compétence observée.'),
      h('div', { class: 'row center' }, select, btn('✅ Confirmer cette compétence', async () => { await recordTrial(goalId, 'plus', { item: select.value }); draw(); }, 'primary')),
      list);
  };
}

// P.3 : tableau lieu × intervenant.
export function matrixTable(allTrials) {
  const rows = matrix(allTrials);
  return h('table', { class: 'matrix' },
    h('thead', {}, h('tr', {}, h('th', {}, ''), rows[0].cells.map((c) => h('th', {}, c.who.label)))),
    h('tbody', {}, rows.map((row) => h('tr', {}, h('th', {}, row.env.label), row.cells.map((c) => h('td', { class: c.n && c.pct >= 80 ? 'ok' : '' }, c.n ? `${c.pct} % (${c.n})` : '—'))))));
}

function p3() {
  const box = h('div');
  db.getAllTrials().then((all) => box.replaceChildren(matrixTable(all)));
  return h('div', { class: 'stack' }, h('p', { class: 'note' }, 'Choisissez l’intervenant et le lieu en haut avant de noter. Le but : 80 % avec chacun des 3 intervenants.'), box);
}

export const EXERCISES = {
  'K.1': sequenceExercise('K.1', { fadeOption: true, intro: `Jeu réel avec la poupée, avec ${sisterName()} ou un adulte : suivez les étapes.` }),
  'L.1': l1, 'L.2': l2, 'L.3': l3,
  'M.1': groupMode, 'M.2': groupMode, 'M.3': groupMode,
  'N.1': sequenceExercise('N.1'), 'N.2': n2, 'N.3': sequenceExercise('N.3'),
  'P.1': generalisation('P.1', 'home'), 'P.2': generalisation('P.2', 'school'), 'P.3': p3,
};
