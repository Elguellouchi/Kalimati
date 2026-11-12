// Composants réutilisés par les exercices : choix sans erreur, séquences, jetons, tri, vidéo modèle.
import * as db from '../db.js';
import { h, btn, shuffle, uid } from './util.js';
import { speak } from '../speech.js';
import { prepareVideo } from '../media.js';
import { draggable, hitTest } from './drag.js';
import { nour } from './nour.js';
import { renderVisual } from './visuals.js';

// Grande carte : vraie photo si le parent en a mis une, sinon illustration, sinon emoji.
export const bigCard = (emoji, label, cls = '', vkey = null) => h('div', { class: `big-card ${cls}`.trim() },
  renderVisual({ emoji, label, vkey }), label ? h('span', { class: 'label' }, label) : null);

// Choix avec apprentissage sans erreur : position mélangée, et si erreur les distracteurs s'estompent (opacité 0,25).
// onAnswer(firstTry, choice) est appelé une fois la bonne réponse touchée.
export function choiceBoard({ choices, cols = 2, onAnswer, praise = 'Bravo' }) {
  let erred = false;
  let finished = false;
  const buttons = shuffle(choices).map((choice) => {
    const el = h('button', { type: 'button', class: 'choice' },
      (choice.render ? choice.render() : renderVisual(choice)), choice.label ? h('span', { class: 'label' }, choice.label) : null);
    el.onclick = () => {
      if (finished) return;
      if (choice.correct) {
        finished = true;
        el.classList.add('right');
        speak(praise);
        if (onAnswer) onAnswer(!erred, choice);
        return;
      }
      erred = true;
      buttons.forEach((b) => { if (!b.choice.correct) b.el.classList.add('faded'); });
    };
    return { el, choice };
  });
  return h('div', { class: 'choices', style: { '--cols': cols } }, buttons.map((b) => b.el));
}

// Séquence d'étapes (analyse de tâche) cochées une à une par Abir. fade : masque les images (estompage).
export function sequenceBoard(steps, { fade = false, onComplete, onStep } = {}) {
  let index = 0;
  const cards = steps.map(([emoji, label], i) => h('button', { type: 'button', class: `step${i === 0 ? ' current' : ''}${fade ? ' faded-img' : ''}` },
    h('span', { class: 'step-num' }, String(i + 1)), renderVisual({ emoji, label }), h('span', { class: 'label' }, label)));
  cards.forEach((card, i) => {
    card.onclick = () => {
      if (i !== index) return;
      card.classList.remove('current');
      card.classList.add('done');
      speak(steps[i][1]);
      index += 1;
      if (onStep) onStep(i);
      if (index < cards.length) cards[index].classList.add('current');
      else if (onComplete) onComplete();
    };
  });
  const element = h('div', { class: 'sequence' }, cards);
  return {
    element,
    reset() {
      index = 0;
      cards.forEach((c, i) => { c.classList.remove('done', 'current'); if (i === 0) c.classList.add('current'); });
    },
    setFade(value) { cards.forEach((c) => c.classList.toggle('faded-img', value)); },
  };
}

// Économie de jetons : l'adulte donne une étoile à chaque effort.
export function tokenBoard({ count = 5, onFull } = {}) {
  let filled = 0;
  const stars = h('div', { class: 'tokens' });
  const select = h('select', { 'aria-label': 'Nombre de jetons' },
    [3, 4, 5, 6, 7, 8, 9, 10].map((n) => h('option', { value: n, selected: n === count }, `${n} ⭐`)));
  const draw = () => {
    const total = Number(select.value);
    stars.replaceChildren(...Array.from({ length: total }, (_, i) => h('span', { class: `token${i < filled ? ' on' : ''}` }, '⭐')));
  };
  select.onchange = () => { filled = 0; draw(); };
  const give = () => {
    const total = Number(select.value);
    if (filled >= total) return;
    filled += 1; draw();
    if (filled === total) { speak('Bravo, tu as gagné !'); if (onFull) onFull(); }
  };
  draw();
  return {
    element: h('div', { class: 'token-board' }, stars, h('div', { class: 'row center' }, btn('⭐ Donner une étoile', give, 'primary'), btn('↺', () => { filled = 0; draw(); }, 'ghost'), select)),
    reset: () => { filled = 0; draw(); },
  };
}

// Tri vers des boîtes (glisser ou toucher l'image puis la boîte). onPlace(correct, item, bin).
export function sorter({ bins, items, onPlace, onDone }) {
  let selected = null;
  let remaining = items.length;
  const binEls = bins.map((bin) => h('div', { class: 'bin', dataset: { id: bin.id } },
    renderVisual({ emoji: bin.emoji, vkey: `bin:${bin.id}`, label: bin.fr }), h('span', { class: 'label' }, bin.fr), h('div', { class: 'bin-content' })));
  const pile = h('div', { class: 'pile' });

  const place = (itemEl, item, binEl) => {
    const correct = binEl.dataset.id === item.bin;
    if (onPlace) onPlace(correct, item, binEl.dataset.id);
    if (!correct) { itemEl.classList.add('wiggle-soft'); setTimeout(() => itemEl.classList.remove('wiggle-soft'), 400); return false; }
    itemEl.style.transform = '';
    itemEl.classList.remove('selected');
    itemEl.onclick = null;
    binEl.querySelector('.bin-content').append(itemEl);
    speak(item.fr);
    remaining -= 1;
    if (remaining === 0 && onDone) onDone();
    return true;
  };

  shuffle(items).forEach((item) => {
    const el = h('button', { type: 'button', class: 'sort-item' }, (item.render ? item.render() : renderVisual({ emoji: item.emoji, fr: item.fr }, { button: false })));
    el.onclick = () => { pile.querySelectorAll('.selected').forEach((s) => s.classList.remove('selected')); selected = { el, item }; el.classList.add('selected'); };
    draggable(el, { onDrop: ({ x, y }) => { const target = hitTest(x, y, binEls); return target ? place(el, item, target) : false; } });
    pile.append(el);
  });
  binEls.forEach((binEl) => { binEl.onclick = () => { if (selected && selected.el.parentElement === pile) { place(selected.el, selected.item, binEl); selected = null; } }; });
  return h('div', { class: 'sorter' }, h('div', { class: 'bins', style: { '--cols': Math.min(bins.length, 5) } }, binEls), pile);
}

// Compteur simple (passes de ballon, initiations…).
export function counter(label, { start = 0, onChange } = {}) {
  let value = start;
  const out = h('span', { class: 'counter-value' }, String(value));
  return h('div', { class: 'counter' }, h('span', {}, label), out,
    btn('＋', () => { value += 1; out.textContent = String(value); if (onChange) onChange(value); }, 'primary'));
}

// Vidéo modèle filmée par le parent (gestes, verbes), avec ralenti 0,5x. Sinon l'emoji.
export function videoModel(key, emoji, { canEdit = false } = {}) {
  const stage = h('div', { class: 'video-model' }, h('span', { class: 'emoji' }, emoji));
  let current = null;
  let rate = 1;
  const show = async () => {
    const [rec] = (await db.getRecordingsOf(`model:${key}`)).sort((a, b) => b.ts - a.ts);
    current = rec || null;
    if (!current) { stage.replaceChildren(h('span', { class: 'emoji' }, emoji)); return; }
    const url = URL.createObjectURL(current.blob);
    const video = h('video', { src: url, playsinline: true, muted: true, loop: true });
    video.playbackRate = rate;
    stage.replaceChildren(video);
  };
  const play = () => { const v = stage.querySelector('video'); if (v) { v.playbackRate = rate; v.currentTime = 0; v.play().catch(() => {}); } };
  const slow = btn('🐢 Ralenti 0,5x', () => { rate = rate === 1 ? 0.5 : 1; slow.classList.toggle('active', rate !== 1); play(); }, 'ghost');
  const controls = h('div', { class: 'row center' }, btn('▶ Voir le modèle', play, 'ghost'), slow);
  if (canEdit) {
    const input = h('input', { type: 'file', accept: 'video/*', capture: 'user', hidden: true });
    input.onchange = async () => {
      const file = input.files && input.files[0];
      input.value = '';
      if (!file) return;
      try {
        const blob = await prepareVideo(file);
        (await db.getRecordingsOf(`model:${key}`)).forEach((r) => db.deleteRecording(r.id));
        await db.putRecording({ id: uid('rec'), key: `model:${key}`, ts: Date.now(), kind: 'model', blob });
        show();
      } catch (error) { window.alert(error.message); }
    };
    controls.append(h('label', { class: 'btn ghost' }, '📹 Filmer le modèle', input));
  }
  show();
  return h('div', { class: 'video-model-box' }, stage, controls);
}

// Onglets simples : modes = [[libellé, () => élément], ...]
export function modeTabs(modes, start = 0) {
  const body = h('div');
  const tabs = h('div', { class: 'seg' });
  const show = (i) => {
    tabs.replaceChildren(...modes.map(([label], j) => h('button', { type: 'button', class: j === i ? 'active' : '', onclick: () => show(j) }, label)));
    body.replaceChildren(modes[i][1]());
  };
  show(start);
  return h('div', { class: 'stack' }, tabs, body);
}

export const praise =(text = 'Bravo !') => h('div', { class: 'praise' }, nour({ pose: 'wave', size: 70, says: text }));
