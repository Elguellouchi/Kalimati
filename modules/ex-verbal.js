// Sections F, G, H : demandes avec le PECS (phases 1-2, délai vocal), dénomination et intraverbal.
import * as db from '../db.js';
import { h, btn, shuffle, pick, sample, sleep } from './util.js';
import { speak, sayCard, sayCards } from '../speech.js';
import { startListening, canRecord, playClap } from '../media.js';
import { recordTrial, ratingPanel, profile } from './aba.js';
import { bigCard, videoModel, praise, choiceBoard } from './widgets.js';
import { draggable, hitTest } from './drag.js';
import { hourglass } from './timer.js';
import { nour, setBubbleLevel } from './nour.js';
import { renderVisual, slugKey } from './visuals.js';
import { visualKeyOf } from '../data.js';
import { TACT_ITEMS, VERBS, PERSONAL_QUESTIONS, RHYMES, ASSOCIATIONS } from './content.js';

const VOCAL_DELAY_MS = 2500;
const PECS_CATS = ['manger', 'boire', 'jouer', 'besoins', 'lieux'];

function cardVisual(card) {
  if (card.photo) {
    const img = h('img', { alt: '', src: URL.createObjectURL(card.photo) });
    img.onload = () => URL.revokeObjectURL(img.src);
    return h('div', { class: 'big-card' }, img, h('span', { class: 'label' }, card.fr));
  }
  return bigCard(card.emoji || '❔', card.fr);
}

const pecsCards = (ctx) => ctx.cards.filter((c) => PECS_CATS.includes(c.cat) && !c.hidden);
const iWant = (ctx) => ctx.cards.find((c) => c.fr === 'Je veux') || { fr: 'Je veux', audioFr: null, audioDr: null, ar: 'بغيت' };

// F.3 : délai constant de 2,5 s — « Je veux… », micro ouvert, puis le nom de l'objet.
async function vocalDelay(card, ctx, box) {
  await sayCard(iWant(ctx), ctx.lang);
  const otter = nour({ pose: 'bubbles', size: 90, says: 'À toi…' });
  setBubbleLevel(otter, 0);
  box.replaceChildren(otter);
  let vocalized = false;
  if (canRecord()) {
    try {
      const stop = await startListening({ onLevel: (l) => setBubbleLevel(otter, l) });
      await sleep(VOCAL_DELAY_MS);
      vocalized = (await stop()).voiced;
    } catch { await sleep(VOCAL_DELAY_MS); }
  } else await sleep(VOCAL_DELAY_MS);
  await sayCard(card, ctx.lang);
  let trial = await recordTrial('F.3', vocalized ? 'plus' : 'minus', { item: card.id, meta: { vocalized } });
  const status = h('p', { class: 'note' });
  const draw = () => { status.textContent = trial.meta.vocalized ? 'Vocalisation entendue ✅' : 'Pas de vocalisation entendue'; };
  const fix = btn('Corriger', async () => {
    await db.deleteTrial(trial.id);
    const v = !trial.meta.vocalized;
    trial = await recordTrial('F.3', v ? 'plus' : 'minus', { item: card.id, meta: { vocalized: v, corrected: true } });
    draw();
  }, 'ghost tiny');
  draw();
  box.replaceChildren(h('div', { class: 'row center' }, status, fix));
}

function pecsSettings(ctx, onChange) {
  const cards = pecsCards(ctx);
  const select = h('select', { 'aria-label': 'Objet désiré' }, cards.map((c) => h('option', { value: c.id }, `${c.emoji || '📷'} ${c.fr}`)));
  const delay = h('input', { type: 'checkbox' });
  select.onchange = () => onChange(cards.find((c) => c.id === select.value), delay.checked);
  delay.onchange = select.onchange;
  return { element: h('div', { class: 'row center' }, select, h('label', { class: 'check' }, delay, ' Délai vocal 2,5 s (F.3)')), current: () => [cards.find((c) => c.id === select.value), delay.checked] };
}

// F.1 : une seule grande carte à glisser dans la main de l'adulte.
function f1(ctx) {
  const stage = h('div', { class: 'stack' });
  const settings = pecsSettings(ctx, () => draw());
  function draw() {
    const [card, withDelay] = settings.current();
    if (!card) { stage.replaceChildren(h('p', {}, 'Ajoutez des cartes dans Parler.')); return; }
    const hand = h('div', { class: 'pecs-hand' }, '🤲', h('span', {}, 'Main de l’adulte'));
    const visual = cardVisual(card);
    visual.classList.add('pecs-card');
    const after = h('div', { class: 'stack' });
    draggable(visual, { onDrop: ({ x, y }) => {
      if (!hitTest(x, y, [hand])) return false;
      visual.style.visibility = 'hidden';
      hand.classList.add('received');
      (async () => {
        if (withDelay) await vocalDelay(card, ctx, after);
        else await sayCards([{ card: iWant(ctx), lang: ctx.lang }, { card, lang: ctx.lang }]);
        after.append(ratingPanel('F.1', { item: card.id, labels: { plus: 'Échange spontané ✅' }, onRated: () => setTimeout(draw, 600) }));
      })();
      return true;
    } });
    stage.replaceChildren(hand, h('div', { class: 'pecs-center' }, visual), after);
  }
  draw();
  return h('div', { class: 'stack' }, settings.element, stage);
}

// F.2 : prendre la carte dans le classeur puis l'apporter à l'adulte (≥ 2 m).
function f2(ctx) {
  const stage = h('div', { class: 'stack' });
  const delay = h('input', { type: 'checkbox' });
  const book = () => {
    const cards = shuffle(pecsCards(ctx)).slice(0, 6);
    stage.replaceChildren(h('p', { class: 'ask' }, 'Classeur de communication'),
      h('div', { class: 'choices', style: { '--cols': 3 } }, cards.map((card) => h('button', { type: 'button', class: 'choice', onclick: () => walk(card) },
        renderVisual({ vkey: visualKeyOf(card), emoji: card.emoji || '📷', label: card.fr }), h('span', { class: 'label' }, card.fr)))));
  };
  const walk = (card) => {
    const after = h('div', { class: 'stack' });
    const arrive = async (result, distance) => {
      if (result === 'plus') {
        if (delay.checked) await vocalDelay(card, ctx, after);
        else await sayCards([{ card: iWant(ctx), lang: ctx.lang }, { card, lang: ctx.lang }]);
      }
      await recordTrial('F.2', result, { item: card.id, meta: { distance } });
      after.append(praise(result === 'plus' ? 'Bravo !' : 'On réessaie.'), btn('📖 Retour au classeur', book, 'primary'));
    };
    stage.replaceChildren(cardVisual(card), h('p', { class: 'ask big' }, '🚶‍♀️ Apporte la carte à l’adulte (≥ 2 m)'),
      h('div', { class: 'row center' },
        btn('Arrivée à ≥ 2 m ✅', () => arrive('plus', '>=2m'), 'rate-plus'),
        btn('Avec aide 👉', () => arrive('prompt', '>=2m'), 'rate-prompt'),
        btn('Moins de 2 m / abandon ❌', () => arrive('minus', '<2m'), 'rate-minus')),
      after);
  };
  book();
  return h('div', { class: 'stack' }, h('label', { class: 'check' }, delay, ' Délai vocal 2,5 s (F.3)'), stage);
}

// F.3 vu seul : la mesure se fait pendant les échanges PECS.
function f3(ctx) {
  return h('div', { class: 'stack' },
    h('p', { class: 'note' }, 'Cochez « Délai vocal 2,5 s » pendant un échange PECS. Le téléphone dit « Je veux… », écoute 2,5 s, puis dit le mot.'),
    f1(ctx));
}

// G.1 : chaque image en grand, sans son ni question, fenêtre de 5 s.
function g1() {
  let order = shuffle(TACT_ITEMS);
  let index = 0;
  const stage = h('div', { class: 'stack' });
  const progress = h('p', { class: 'note' });
  const draw = () => {
    if (index >= order.length) { stage.replaceChildren(praise('Les 15 images sont passées !'), btn('🔀 Recommencer', () => { order = shuffle(TACT_ITEMS); index = 0; draw(); }, 'primary')); progress.textContent = ''; return; }
    const item = order[index];
    const glass = hourglass(5);
    progress.textContent = `Image ${index + 1}/${order.length}`;
    stage.replaceChildren(bigCard(item.emoji, ''), glass.element,
      ratingPanel('G.1', { item: item.id, labels: { plus: '✅ Dénommé spontanément', prompt: '👉 Après aide', minus: '❌ Pas de mot' }, onRated: () => { index += 1; draw(); } }));
    glass.run();
  };
  draw();
  return h('div', { class: 'stack' }, h('p', { class: 'note' }, 'Ne posez pas de question : attendez que l’enfant nomme l’image.'), progress, stage);
}

function g2(ctx) {
  let verb = VERBS[0];
  const stage = h('div');
  const draw = () => stage.replaceChildren(videoModel(`verb:${verb.id}`, verb.emoji, { canEdit: ctx.parent }), h('p', { class: 'adult-text' }, `Réponse attendue : « ${verb.fr} »`));
  draw();
  return h('div', { class: 'stack' },
    h('select', { onchange: (e) => { verb = VERBS.find((v) => v.id === e.target.value); draw(); } }, VERBS.map((v, i) => h('option', { value: v.id }, `${i + 1}. ${v.fr}`))),
    stage,
    ratingPanel('G.2', { item: () => verb.id, onRated: () => { verb = VERBS[(VERBS.indexOf(verb) + 1) % VERBS.length]; stage.parentElement.querySelector('select').value = verb.id; draw(); } }));
}

// G.3 : pointage maison / classe par les parents et l'enseignant.
function g3() {
  const list = h('div', { class: 'stack' });
  const total = h('p', { class: 'note' });
  const draw = async () => {
    const trials = await db.getTrialsOf('G.3');
    const seen = (id, place) => trials.some((t) => t.item === id && t.meta && t.meta.place === place);
    const done = new Set(trials.map((t) => t.item)).size;
    total.textContent = `${done}/15 images dénommées hors séance (but : 8).`;
    list.replaceChildren(...TACT_ITEMS.map((item) => h('div', { class: 'g3-row' },
      renderVisual({ emoji: item.emoji, fr: item.fr }), h('span', {}, item.fr),
      ...[['home', '🏠 Maison'], ['school', '🏫 Classe']].map(([place, label]) => h('button', {
        type: 'button', class: `pill-btn${seen(item.id, place) ? ' on' : ''}`,
        onclick: async () => { await recordTrial('G.3', 'plus', { item: item.id, meta: { place } }); draw(); },
      }, label)))));
  };
  draw();
  return h('div', { class: 'stack' }, h('p', { class: 'note' }, 'Touchez quand l’enfant nomme spontanément l’objet à la maison ou en classe.'), total, list);
}

// H.1 : questions personnelles, indice visuel estompé progressivement.
function h1() {
  let index = 0;
  let level = 'full';
  const stage = h('div', { class: 'stack' });
  const draw = () => {
    const q = PERSONAL_QUESTIONS[index];
    const answer = profile[q.field];
    let hint = null;
    if (!answer) hint = h('p', { class: 'note' }, 'Remplissez le profil (📊 Progrès ➜ 👧 Profil, en mode parent) pour cette réponse.');
    else if (level === 'full') hint = bigCard(q.emoji, answer, '', q.vkey || `question:${q.id}`);
    else if (level === 'partial') hint = bigCard(q.emoji, `${answer.slice(0, 1)}…`, '', q.vkey || `question:${q.id}`);
    stage.replaceChildren(h('p', { class: 'ask' }, q.ask, btn('🔊', () => speak(q.ask), 'ghost tiny')), hint,
      ratingPanel('H.1', { item: q.id, meta: { hint: level }, onRated: () => { index = (index + 1) % PERSONAL_QUESTIONS.length; draw(); setTimeout(() => speak(PERSONAL_QUESTIONS[index].ask), 500); } }));
  };
  const levels = h('select', { onchange: (e) => { level = e.target.value; draw(); } },
    h('option', { value: 'full' }, 'Indice complet'), h('option', { value: 'partial' }, 'Indice partiel'), h('option', { value: 'none' }, 'Sans indice'));
  draw();
  return h('div', { class: 'stack' }, h('div', { class: 'row center' }, h('span', {}, 'Estompage :'), levels), stage);
}

// H.2 / H.3 : aucune lecture demandée. Une grande image, la voix dit le début, puis :
//  - 🎙️ mode vocal : l'enfant dit le mot (jauge du micro), l'image du mot apparaît ;
//  - 🖼️ mode choix visuel (aide) : 3 grandes images, noté « guidé » car l'image aide.
export const answerKey = (item) => `obj:${slugKey(item.end)}`;

function completion(goalId, items) {
  return (ctx) => {
    let current = items[0];
    let mode = 'vocal';
    let stopMic = null;
    const stage = h('div', { class: 'stack' });
    ctx.onCleanup(() => { if (stopMic) stopMic(); });
    const reveal = (box) => { playClap(); speak(current.end); box.replaceChildren(bigCard(current.emoji, current.end, 'reveal-card', answerKey(current))); };
    const next = () => { current = pick(items.filter((i) => i !== current)); draw(); };
    function draw() {
      const answer = h('div', { class: 'answer-slot' }, h('span', { class: 'mystery' }, '❓'));
      const gauge = h('div', { class: 'gauge' }, h('span'));
      const body = h('div', { class: 'stack' });
      if (mode === 'vocal') {
        const mic = btn('🎙️ À toi !', async () => {
          if (stopMic || !canRecord()) return;
          try {
            stopMic = await startListening({ onLevel: (l) => { gauge.firstChild.style.width = `${Math.round(l * 100)}%`; } });
            setTimeout(async () => {
              if (!stopMic) return;
              const result = await stopMic();
              stopMic = null;
              gauge.firstChild.style.width = '0%';
              if (result.voiced) reveal(answer);
            }, 4000);
          } catch { window.alert('Le micro est refusé. Autorisez-le dans les réglages du téléphone.'); }
        }, 'primary');
        body.append(h('div', { class: 'row center' }, mic, btn('✨ Montrer l’image', () => reveal(answer), 'ghost')), gauge,
          ratingPanel(goalId, { item: () => current.id, labels: { plus: 'Mot dit seule ✅' }, onRated: next }));
      } else {
        const others = sample(items.filter((i) => i !== current), 2).map((i) => ({ emoji: i.emoji, vkey: answerKey(i), fr: i.end, correct: false }));
        body.append(choiceBoard({ choices: [{ emoji: current.emoji, vkey: answerKey(current), fr: current.end, correct: true }, ...others], cols: 3, praise: current.end, onAnswer: (first) => {
          playClap();
          answer.replaceChildren(bigCard(current.emoji, current.end, 'reveal-card', answerKey(current)));
          recordTrial(goalId, 'prompt', { item: current.id, prompt: 'visuel', meta: { aide: 'choix-visuel', first } });
          body.append(btn('➜ Suivant', next, 'primary'));
        } }));
      }
      const say = () => speak(current.start);
      stage.replaceChildren(
        h('div', { class: 'scene' }, bigCard(current.scene, current.sceneLabel || '', 'scene-card', `scene:${current.id}`), h('span', { class: 'scene-plus' }, '➜'), answer),
        h('div', { class: 'row center' }, btn('🔊 Écouter', say, 'primary')),
        body,
        h('details', {}, h('summary', {}, 'Texte pour l’adulte'), h('p', { class: 'adult-text' }, `${current.start} ${current.end}`)));
      setTimeout(say, 400);
    }
    const tabs = h('div', { class: 'seg' });
    const drawTabs = () => tabs.replaceChildren(...[['vocal', '🎙️ Je dis le mot'], ['choix', '🖼️ Je choisis l’image']].map(([id, label]) =>
      h('button', { type: 'button', class: id === mode ? 'active' : '', onclick: () => { mode = id; drawTabs(); draw(); } }, label)));
    drawTabs();
    draw();
    return h('div', { class: 'stack' }, tabs, stage);
  };
}

export const EXERCISES = {
  'F.1': f1, 'F.2': f2, 'F.3': f3, 'G.1': g1, 'G.2': g2, 'G.3': g3,
  'H.1': h1, 'H.2': completion('H.2', RHYMES), 'H.3': completion('H.3', ASSOCIATIONS),
};
