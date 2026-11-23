// v10.15 : Ateliers cliniques (bonnes pratiques du dossier bonnes-pratiques, pépites 4, 12, 15, 19,
// 25, 27, 33, 35). Une séance guidée, des jeux sans erreur et des supports du quotidien.
// Tout se passe dans le téléphone : aucune photo, aucune voix, aucun mot n'est envoyé sur internet.
import { h, btn, pick, sample, shuffle, dayKey } from './util.js';
import { speak, sayCard, stopSpeaking, playBlob, hasArabicVoice } from '../speech.js';
import { choiceBoard, stopAllChoiceTimers } from './widgets.js';
import { renderVisual } from './visuals.js';
import { startListening, startRecording, canRecord, resizePhoto, playBeep } from '../media.js';
import { setSetting, getSetting, getAllLifeBook, putLifeBook } from '../db.js';
import { tx } from './section-i18n.js';
import { clinicT } from './clinic-i18n.js';
import { cardWord } from './languages.js';
import { visualKeyOf } from '../data.js';

let activeRoot = null;
let activeCtx = null;
let toolCleanups = [];

export function closeClinic() {
  stopAllChoiceTimers();
  clearTool();
  activeRoot = null;
  activeCtx = null;
}

function clearTool() {
  toolCleanups.splice(0).forEach((fn) => { try { fn(); } catch { /* déjà arrêté */ } });
  stopSpeaking();
}

export function clinicHome({ lang = 'fr', cards = [], parent = false } = {}) {
  if (activeRoot && activeRoot.isConnected && activeCtx && activeCtx.lang === lang && activeCtx.parent === parent && activeCtx.cards === cards) {
    return activeRoot;
  }
  closeClinic();
  const root = h('div', { class: 'screen clinic' });
  activeRoot = root;
  const ctx = { lang, cards, parent };
  ctx.T = (key, vars) => clinicT(key, lang, vars);
  activeCtx = ctx;
  ctx.onLeave = (fn) => { toolCleanups.push(fn); };
  ctx.show = (node) => {
    clearTool();
    if (node) root.replaceChildren(node);
  };
  ctx.shell = (title, sub, ...children) => h('section', { class: 'clinic-tool' },
    h('div', { class: 'row spread' },
      h('button', { type: 'button', class: 'btn ghost tiny', onclick: () => ctx.show(clinicHub(ctx)) }, tx('back', lang))),
    h('h2', {}, title),
    sub ? h('p', { class: 'note' }, sub) : null,
    ...children);
  const tools = {
    daily: () => dailyTool(ctx),
    verbs: () => verbsTool(ctx),
    stop: () => stopTool(ctx),
    signs: () => signsTool(ctx),
    life: () => lifeTool(ctx),
    pain: () => painTool(ctx),
    draw: () => drawTool(ctx),
    urgent: () => urgentTool(ctx),
  };
  ctx.open = (id) => { const tool = tools[id]; if (tool) ctx.show(tool()); };
  ctx.show(clinicHub(ctx));
  return root;
}

// ---------- Accueil des ateliers ----------
const TOOL_TILES = [
  ['daily', '⏱️', 'daily', 'dailySub'],
  ['verbs', '🧠', 'verbs', 'verbsSub'],
  ['stop', '📦', 'stop', 'stopSub'],
  ['signs', '🔠', 'signs', 'signsSub'],
  ['life', '📔', 'life', 'lifeSub'],
  ['pain', '🩹', 'pain', 'painSub'],
  ['draw', '🎨', 'draw', 'drawSub'],
  ['urgent', '🆘', 'urgent', 'urgentSub'],
];

function clinicHub(ctx) {
  const { T } = ctx;
  const done = h('p', { class: 'note' }, '');
  getSetting('clinicSeance').then((s) => {
    if (s && s.day === dayKey() && done.isConnected) done.textContent = T('sessionDoneToday');
  }).catch(() => {});
  const tiles = TOOL_TILES.map(([id, emoji, titleKey, subKey]) => h('button', {
    type: 'button', class: 'clinic-tile', onclick: () => ctx.open(id),
  },
  h('span', { class: 'clinic-tile-emoji', 'aria-hidden': 'true' }, emoji),
  h('strong', {}, T(titleKey).replace(/^[^\p{L}\p{N}]+/u, '')),
  h('small', {}, T(subKey))));
  return h('div', { class: 'clinic-hub' },
    h('h1', { class: 'clinic-title' }, T('clinicTitle')),
    h('p', { class: 'note' }, T('clinicSub')),
    done,
    h('div', { class: 'clinic-tiles' }, tiles),
    h('p', { class: 'note clinic-local' }, T('localNote')));
}

// ---------- Outils partagés ----------
function visualOf(card) {
  return renderVisual({ visualKey: visualKeyOf(card), emoji: card.emoji || '❔', label: card.fr }, { button: false });
}

const sayBravo = () => speak('Bravo !');

// ---------- Pépite 4 : matrices verbe + 3 compléments ----------
const MATRICES = [
  {
    id: 'eat', emoji: '🍽️', verbFr: 'Manger', sayKey: 'sayEat', sayAr: 'كاناكل {x}',
    items: [
      { emoji: '🍞', fr: 'Pain', frSay: 'du pain', dr: 'Lkhobz', ar: 'الخبز' },
      { emoji: '🍎', fr: 'Pomme', frSay: 'une pomme', dr: 'Ttfa7a', ar: 'التفاحة' },
      { emoji: '🍌', fr: 'Banane', frSay: 'une banane', dr: 'Lbanan', ar: 'الموزة' },
    ],
  },
  {
    id: 'drink', emoji: '🥤', verbFr: 'Boire', sayKey: 'sayDrink', sayAr: 'كانشرب {x}',
    items: [
      { emoji: '💧', fr: 'Eau', frSay: 'de l’eau', dr: 'Lma', ar: 'الماء' },
      { emoji: '🥛', fr: 'Lait', frSay: 'du lait', dr: 'L7lib', ar: 'الحليب' },
      { emoji: '🧃', fr: 'Jus', frSay: 'du jus', dr: 'L3sir', ar: 'العصير' },
    ],
  },
  {
    id: 'play', emoji: '🧸', verbFr: 'Jouer', sayKey: 'sayPlay', sayAr: 'كانلعب ب {x}',
    items: [
      { emoji: '⚽', fr: 'Ballon', frSay: 'avec le ballon', dr: 'Lkora', ar: 'الكرة' },
      { emoji: '🪆', fr: 'Poupée', frSay: 'avec la poupée', dr: 'L3roussa', ar: 'الدمية' },
      { emoji: '🎵', fr: 'Musique', frSay: 'avec la musique', dr: 'Lmousi9a', ar: 'الموسيقى' },
    ],
  },
  {
    id: 'put', emoji: '🧺', verbFr: 'Mettre', sayKey: 'sayPut', sayAr: 'كانحط {x}',
    items: [
      { emoji: '👟', fr: 'Chaussures', frSay: 'les chaussures', dr: 'Sbbat', ar: 'الصباط' },
      { emoji: '🧥', fr: 'Manteau', frSay: 'le manteau', dr: 'Jakita', ar: 'الجاكيط' },
      { emoji: '🎩', fr: 'Chapeau', frSay: 'le chapeau', dr: 'Bonia', ar: 'القبعة' },
    ],
  },
  {
    id: 'takeoff', emoji: '🧦', verbFr: 'Enlever', sayKey: 'sayTakeOff', sayAr: 'كانحيد {x}',
    items: [
      { emoji: '🧦', fr: 'Chaussettes', frSay: 'les chaussettes', dr: 'Tqachr', ar: 'التقاشر' },
      { emoji: '🧢', fr: 'Bonnet', frSay: 'le bonnet', dr: 'Bonia', ar: 'البونية' },
      { emoji: '🧥', fr: 'Manteau', frSay: 'le manteau', dr: 'Jakita', ar: 'الجاكيط' },
    ],
  },
  {
    id: 'touch', emoji: '👆', verbFr: 'Toucher', sayKey: 'sayTouch', sayAr: 'كانمس {x}',
    items: [
      { emoji: '👃', fr: 'Nez', frSay: 'le nez', dr: 'Nnif', ar: 'النيف' },
      { emoji: '👂', fr: 'Oreille', frSay: 'l’oreille', dr: 'Lwden', ar: 'الودن' },
      { emoji: '🦶', fr: 'Pied', frSay: 'le pied', dr: 'Rjel', ar: 'الرجل' },
    ],
  },
];

function itemLabel(item, lang) {
  return lang === 'dr' ? item.dr : item.fr;
}

function speakPhrase(ctx, matrix, item) {
  if (ctx.lang === 'dr' && hasArabicVoice()) {
    speak(matrix.sayAr.replace('{x}', item.ar), { lang: 'ar' });
    return;
  }
  speak(`${matrix.verbFr} ${item.frSay}.`, { lang: 'fr' });
}

function matrixRound(stage, ctx, onNext) {
  const { T } = ctx;
  const matrix = pick(MATRICES);
  const target = pick(matrix.items);
  const others = [...new Map(MATRICES.filter((m) => m !== matrix).flatMap((m) => m.items).map((item) => [item.fr, item])).values()];
  const choices = shuffle([
    { ...target, id: `${matrix.id}-${target.fr}`, correct: true },
    ...sample(others, 2).map((item) => ({ ...item, id: `d-${item.fr}`, correct: false })),
  ]).map((item) => ({ ...item, label: itemLabel(item, ctx.lang) }));
  const nextRow = h('div', { class: 'row center' });
  nextRow.hidden = true;
  const board = choiceBoard({
    choices,
    cols: 3,
    gameId: `clinic-${matrix.id}`,
    onAnswer: () => {
      speakPhrase(ctx, matrix, target);
      nextRow.hidden = false;
      nextRow.replaceChildren(btn(T('next'), onNext, 'primary'));
    },
  });
  stage.replaceChildren(
    h('h3', {}, T('matrixTitle')),
    h('p', { class: 'clinic-question' }, `${matrix.emoji} ${T(matrix.sayKey, { x: '…' })}`),
    board,
    nextRow);
}

function verbsTool(ctx) {
  const stage = h('div', { class: 'clinic-stage' });
  const root = ctx.shell(ctx.T('verbs'), ctx.T('verbsSub'), stage);
  matrixRound(stage, ctx, () => ctx.open('verbs'));
  return root;
}

// ---------- Pépite 15 : séance du jour (5 cartes, matrice, voix, ballons) ----------
const DAILY_STEPS = 4;

function dailyTool(ctx) {
  const { T } = ctx;
  const step = h('p', { class: 'note' });
  const stage = h('div', { class: 'clinic-stage' });
  const root = ctx.shell(T('daily'), T('dailySub'), step, stage);
  let phase = 0;

  const go = (n) => {
    if (!root.isConnected) return;
    phase = Math.min(n, DAILY_STEPS - 1);
    step.textContent = T('stepOf', { n: phase + 1, total: DAILY_STEPS });
    if (phase === 0) cardsPhase();
    else if (phase === 1) matrixRound(stage, ctx, () => go(2));
    else if (phase === 2) voicePhase();
    else balloonsPhase();
  };

  function cardsPhase() {
    const teach = sample(ctx.cards.filter((c) => !c.hidden), 5);
    const seen = new Set();
    const nextBtn = btn(T('next'), () => go(1), 'primary');
    nextBtn.hidden = teach.length > 0;
    const grid = h('div', { class: 'clinic-grid' });
    teach.forEach((card) => {
      const el = h('button', { type: 'button', class: 'clinic-card' }, visualOf(card), h('span', { class: 'label' }, cardWord(card, ctx.lang)));
      el.onclick = () => {
        sayCard(card, ctx.lang);
        el.classList.add('seen');
        seen.add(card.id);
        if (seen.size >= teach.length) nextBtn.hidden = false;
      };
      grid.append(el);
    });
    stage.replaceChildren(
      h('h3', {}, T('cardsTitle')),
      h('p', { class: 'note' }, T('cardsHint')),
      grid,
      h('div', { class: 'row center' }, nextBtn));
  }

  function voicePhase() {
    const balloon = h('div', { class: 'clinic-balloon' }, '🎈');
    const hint = h('p', { class: 'note' }, T('voiceHint'));
    const nextBtn = btn(T('next'), () => go(3), 'primary');
    nextBtn.hidden = true;
    let stopListen = null;
    let finished = false;
    let voicedMs = 0;
    let lastFrame = 0;
    let token = 0;
    const finish = async (why) => {
      if (finished) return;
      finished = true;
      token += 1;
      if (stopListen) { try { await stopListen(); } catch { /* micro déjà coupé */ } stopListen = null; }
      nextBtn.hidden = false;
      if (why === 'mic') { hint.textContent = T('voiceMicOff'); return; }
      balloon.classList.add('full');
      sayBravo();
    };
    ctx.onLeave(() => { token += 1; finished = true; if (stopListen) { try { stopListen(); } catch { /* rien */ } } });
    const begin = async () => {
      startBtn.hidden = true;
      hint.textContent = T('voiceHint');
      try {
        const mine = ++token;
        stopListen = await startListening({
          onLevel: (level) => {
            if (finished || mine !== token) return;
            balloon.style.transform = `scale(${0.7 + Math.min(1, level) * 1.1})`;
            const now = performance.now();
            if (lastFrame && level > 0.25) voicedMs += now - lastFrame;
            lastFrame = now;
            if (voicedMs > 1400) finish('voiced');
          },
        });
      } catch {
        finish('mic');
      }
    };
    const startBtn = btn(T('start'), begin, 'primary');
    stage.replaceChildren(
      h('h3', {}, T('voiceTitle')),
      h('p', { class: 'note' }, T('voiceHint')),
      h('div', { class: 'clinic-balloon-row' }, balloon),
      hint,
      h('div', { class: 'row center' }, startBtn, nextBtn));
  }

  function balloonsPhase() {
    let popped = 0;
    const row = h('div', { class: 'clinic-balloons' });
    const done = h('p', { class: 'clinic-question' }, '');
    const again = btn(T('again'), () => ctx.open('daily'), 'primary');
    again.hidden = true;
    for (let i = 0; i < 3; i += 1) {
      const b = h('button', { type: 'button', class: 'clinic-balloon small' }, '🎈');
      b.onclick = () => {
        if (b.classList.contains('pop')) return;
        b.classList.add('pop');
        playBeep();
        popped += 1;
        if (popped >= 3) {
          done.textContent = T('bravo');
          again.hidden = false;
          setSetting('clinicSeance', { day: dayKey(), at: Date.now() }).catch(() => {});
          sayBravo();
        }
      };
      row.append(b);
    }
    stage.replaceChildren(
      h('h3', {}, T('balloons')),
      h('p', { class: 'note' }, T('balloonsHint')),
      row,
      done,
      h('div', { class: 'row center' }, again));
  }

  go(0);
  return root;
}

// ---------- Pépite 25 : OK Stop (le coffre qui s'ouvre et se ferme) ----------
function stopTool(ctx) {
  const { T } = ctx;
  const chest = h('button', { type: 'button', class: 'clinic-chest' }, '📦');
  const label = h('p', { class: 'clinic-question' }, '');
  const pointsEl = h('p', { class: 'note' }, T('stopPoints', { n: 0 }));
  const againRow = h('div', { class: 'row center' });
  let points = 0;
  let phase = 'idle';
  let closedTaps = 0;
  let cycles = 0;
  let timer = 0;
  let token = 0;

  const setOpen = (open) => {
    phase = open ? 'open' : 'closed';
    chest.classList.toggle('open', open);
    chest.classList.toggle('closed', !open);
    label.textContent = open ? T('stopOpen') : T('stopClosed');
  };

  const cycle = () => {
    if (!chest.isConnected) return;
    const mine = ++token;
    closedTaps = 0;
    setOpen(true);
    timer = setTimeout(() => {
      if (mine !== token || !chest.isConnected) return;
      setOpen(false);
      timer = setTimeout(() => {
        if (mine !== token || !chest.isConnected) return;
        cycles += 1;
        if (cycles >= 3) {
          phase = 'done';
          label.textContent = T('stopEnd');
          againRow.replaceChildren(btn(T('again'), () => ctx.open('stop'), 'primary'));
          sayBravo();
        } else {
          cycle();
        }
      }, 4000);
    }, 4000 + Math.random() * 6000);
  };

  chest.onclick = () => {
    if (phase === 'open') {
      points += 1;
      pointsEl.textContent = T('stopPoints', { n: points });
      playBeep();
      chest.classList.remove('bump');
      void chest.offsetWidth;
      chest.classList.add('bump');
    } else if (phase === 'closed' && closedTaps === 0) {
      closedTaps += 1;
      speak(T('stopClosed'));
    }
  };
  ctx.onLeave(() => { token += 1; clearTimeout(timer); });

  const root = ctx.shell(T('stop'), T('stopSub'), chest, label, pointsEl, againRow,
    h('p', { class: 'note' }, T('localNote')));
  cycle();
  return root;
}

// ---------- Pépite 27 : l'Attrape-Signes ----------
const SIGN_LETTERS = ['A', 'B', 'D', 'M', 'N', 'T', 'S', 'K', 'Z', 'R'];
const SIGN_ROUNDS = 5;

function signVariants(target) {
  const variants = [];
  const seen = new Set([target.join('')]);
  while (variants.length < 3) {
    const copy = [...target];
    const at = Math.floor(Math.random() * copy.length);
    const next = pick(SIGN_LETTERS.filter((l) => l !== copy[at]));
    copy[at] = next;
    const key = copy.join('');
    if (!seen.has(key)) { seen.add(key); variants.push(copy); }
  }
  return variants;
}

function signsTool(ctx) {
  const { T } = ctx;
  const stage = h('div', { class: 'clinic-stage' });
  const root = ctx.shell(T('signs'), T('signsSub'), stage);
  let round = 0;

  const drawRound = () => {
    if (!root.isConnected) return;
    if (round >= SIGN_ROUNDS) {
      stage.replaceChildren(
        h('h3', {}, T('bravo')),
        h('div', { class: 'row center' }, btn(T('again'), () => ctx.open('signs'), 'primary')));
      sayBravo();
      return;
    }
    const length = 2 + Math.floor(Math.random() * 3);
    const target = Array.from({ length }, () => pick(SIGN_LETTERS));
    const board = choiceBoard({
      choices: [{ letters: target, id: `s-${round}`, correct: true }, ...signVariants(target).map((letters, i) => ({ letters, id: `v-${round}-${i}`, correct: false }))]
        .map((c) => ({ ...c, render: () => h('span', { class: 'clinic-signs' }, c.letters.join(' ')) })),
      cols: 2,
      gameId: 'clinic-signs',
      onAnswer: () => {
        round += 1;
        nextRow.hidden = false;
        nextRow.replaceChildren(btn(T('next'), drawRound, 'primary'));
      },
    });
    const nextRow = h('div', { class: 'row center' });
    nextRow.hidden = true;
    stage.replaceChildren(
      h('p', { class: 'note' }, T('signsRound', { n: round + 1, total: SIGN_ROUNDS })),
      h('h3', {}, T('signsFind', { letters: target.join(' ') })),
      board,
      nextRow);
    speak(target.join(' '), { lang: 'fr', rate: 0.8 });
  };

  drawRound();
  return root;
}

// ---------- Pépite 12 : mon cahier de vie ----------
const LIFE_SLOTS = [
  { id: 'repas', emoji: '🍽️', key: 'lifeSlot1', sayFr: 'Ce que j’ai mangé :' },
  { id: 'sortie', emoji: '🌳', key: 'lifeSlot2', sayFr: 'Où je suis allé :' },
  { id: 'aime', emoji: '💛', key: 'lifeSlot3', sayFr: 'Ce que j’ai aimé :' },
];

function lifeTool(ctx) {
  const { T } = ctx;
  const body = h('div', { class: 'clinic-life-body' });
  const root = ctx.shell(T('life'), T('lifeSub'), body);
  const records = new Map();
  const urls = new Set();
  ctx.onLeave(() => { urls.forEach((url) => { try { URL.revokeObjectURL(url); } catch { /* rien */ } }); urls.clear(); });

  const save = async (rec) => {
    const next = { ...rec, updatedAt: Date.now(), day: rec.day || dayKey() };
    records.set(next.slot, next);
    try {
      await putLifeBook(next);
      flash.textContent = T('lifeSaved');
      setTimeout(() => { if (flash.isConnected) flash.textContent = ''; }, 2500);
    } catch (err) {
      flash.textContent = err && err.message ? err.message : '';
    }
  };

  const flash = h('p', { class: 'note', role: 'status' }, '');

  const makeSlot = (def) => {
    const rec = records.get(def.id) || { slot: def.id, day: dayKey() };
    const card = h('section', { class: 'clinic-life' });
    const title = h('h3', {}, `${def.emoji} ${T(def.key)}`);
    const media = h('div', { class: 'clinic-life-media' });
    if (rec.photoBlob) {
      const url = URL.createObjectURL(rec.photoBlob);
      urls.add(url);
      media.append(h('img', { src: url, alt: T(def.key) }));
    }
    const actions = h('div', { class: 'row wrap' });

    const hear = btn(`🔊 ${T(def.key)}`, () => speak(`${def.sayFr} ${rec.text || ''}`.trim()), 'ghost tiny');
    actions.append(hear);

    if (rec.audioBlob) {
      actions.append(btn(T('lifePlay'), async () => { await playBlob(rec.audioBlob); }, 'ghost tiny'));
    } else {
      actions.append(h('span', { class: 'note' }, T('lifeNoVoice')));
    }

    if (ctx.parent) {
      const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'hidden-file' });
      fileInput.onchange = async () => {
        const file = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        try {
          const blob = await resizePhoto(file);
          await save({ ...rec, photoBlob: blob });
          render();
        } catch { flash.textContent = ''; }
      };
      const photoBtn = btn(T('lifeAddPhoto'), () => fileInput.click(), 'ghost tiny');
      const voiceBtn = btn(T('lifeAddVoice'), null, 'ghost tiny');
      let stopRec = null;
      let recTimer = 0;
      ctx.onLeave(() => { clearTimeout(recTimer); if (stopRec) { try { stopRec(); } catch { /* rien */ } } });
      voiceBtn.onclick = async () => {
        if (stopRec) return;
        try {
          stopRec = await startRecording();
          voiceBtn.textContent = T('lifeRecording');
          const finish = async () => {
            if (!stopRec) return;
            const stop = stopRec;
            stopRec = null;
            clearTimeout(recTimer);
            voiceBtn.textContent = T('lifeAddVoice');
            try {
              const blob = await stop();
              if (blob && blob.size) { await save({ ...rec, audioBlob: blob }); render(); }
            } catch { /* micro coupé */ }
          };
          recTimer = setTimeout(finish, 8000);
          voiceBtn.onclick = finish;
        } catch { flash.textContent = T('voiceMicOff'); }
      };
      actions.append(photoBtn, voiceBtn, fileInput);
    } else {
      actions.append(h('span', { class: 'note' }, T('lifeParentOnly')));
    }

    let input = null;
    if (ctx.parent) {
      input = h('textarea', { class: 'clinic-life-text', rows: 2, placeholder: T(def.key) });
      input.value = rec.text || '';
      input.onchange = () => { rec.text = input.value; save(rec); };
    } else if (rec.text) {
      card.append(h('p', {}, rec.text));
    }

    card.append(title, media, actions, input);
    return card;
  };

  const render = () => {
    body.replaceChildren(...LIFE_SLOTS.map(makeSlot), flash);
  };

  getAllLifeBook().then((all) => {
    (all || []).forEach((rec) => { if (rec && rec.slot) records.set(rec.slot, rec); });
    if (root.isConnected) render();
  }).catch(() => { if (root.isConnected) render(); });
  return root;
}

// ---------- Pépite 19 : où j'ai mal ? ----------
const PAIN_ZONES = [
  { id: 'head', emoji: '🧑', key: 'painHead', ar: 'راسي كيضرني' },
  { id: 'belly', emoji: '🫀', key: 'painBelly', ar: 'كرشي كيضرني' },
  { id: 'teeth', emoji: '🦷', key: 'painTeeth', ar: 'سناني كيضروني' },
  { id: 'throat', emoji: '🗣️', key: 'painThroat', ar: 'حلقي كيضرني' },
  { id: 'ears', emoji: '👂', key: 'painEars', ar: 'ودنيا كيضروني' },
  { id: 'leg', emoji: '🦵', key: 'painLeg', ar: 'رجلي كيضرني' },
];
const PAIN_FACES = [
  { emoji: '🙂', key: 'pain1', ar: 'شوية' },
  { emoji: '😕', key: 'pain2', ar: 'نص نص' },
  { emoji: '😣', key: 'pain3', ar: 'بزاف' },
  { emoji: '😖', key: 'pain4', ar: 'بزاف بزاف' },
  { emoji: '😭', key: 'pain5', ar: 'بزاف بزاف بزاف' },
];

function painTool(ctx) {
  const { T } = ctx;
  const stage = h('div', { class: 'clinic-stage' });
  const root = ctx.shell(T('pain'), T('painSub'), stage);

  const drawZones = () => {
    const grid = h('div', { class: 'clinic-grid' });
    PAIN_ZONES.forEach((zone) => {
      const b = h('button', { type: 'button', class: 'clinic-card' },
        h('span', { class: 'clinic-big-emoji', 'aria-hidden': 'true' }, zone.emoji),
        h('span', { class: 'label' }, T(zone.key)));
      b.onclick = () => {
        if (ctx.lang === 'dr' && hasArabicVoice()) speak(zone.ar, { lang: 'ar' });
        else speak(`J’ai mal : ${T(zone.key)}.`);
        drawFaces(zone);
      };
      grid.append(b);
    });
    stage.replaceChildren(h('h3', {}, T('painWhere')), grid);
  };

  const drawFaces = (zone) => {
    const row = h('div', { class: 'clinic-faces' });
    PAIN_FACES.forEach((face) => {
      const b = h('button', { type: 'button', class: 'clinic-face' },
        h('span', { class: 'clinic-big-emoji', 'aria-hidden': 'true' }, face.emoji),
        h('small', {}, T(face.key)));
      b.onclick = () => {
        const sentenceFr = `J’ai mal : ${T(zone.key)}. C’est ${T(face.key)}.`;
        if (ctx.lang === 'dr' && hasArabicVoice()) speak(`${zone.ar}. ${face.ar}.`, { lang: 'ar' });
        else speak(sentenceFr);
        stage.replaceChildren(
          h('h3', {}, T('painSaid')),
          h('p', { class: 'clinic-question' }, `${zone.emoji} ${T(zone.key)} · ${face.emoji} ${T(face.key)}`),
          h('div', { class: 'row center' }, btn(T('again'), drawZones, 'primary')));
      };
      row.append(b);
    });
    stage.replaceChildren(h('h3', {}, T('painHow')), row);
  };

  drawZones();
  return root;
}

// ---------- Pépite 23 : l'ardoise magique ----------
function drawTool(ctx) {
  const { T } = ctx;
  const canvas = h('canvas', { class: 'clinic-canvas', width: 900, height: 620 });
  const colors = ['#222222', '#E53935', '#1E88E5', '#43A047', '#FDD835', '#D81B60'];
  let color = colors[0];
  let drawing = false;
  let last = null;
  const g = canvas.getContext('2d');
  g.fillStyle = '#FFFFFF';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.lineWidth = 10;
  g.lineCap = 'round';
  g.lineJoin = 'round';

  const pos = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    };
  };
  canvas.onpointerdown = (event) => {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    last = pos(event);
    g.fillStyle = color;
    g.beginPath();
    g.arc(last.x, last.y, g.lineWidth / 2, 0, Math.PI * 2);
    g.fill();
  };
  canvas.onpointermove = (event) => {
    if (!drawing) return;
    const p = pos(event);
    g.strokeStyle = color;
    g.beginPath();
    g.moveTo(last.x, last.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    last = p;
  };
  canvas.onpointerup = () => { drawing = false; last = null; };
  canvas.onpointercancel = () => { drawing = false; last = null; };
  canvas.onpointerleave = () => { if (!drawing) last = null; };

  const swatches = h('div', { class: 'clinic-colors' }, colors.map((c) => {
    const b = h('button', { type: 'button', class: `clinic-swatch${c === color ? ' active' : ''}`, 'aria-label': c });
    b.style.background = c;
    b.onclick = () => {
      color = c;
      swatches.querySelectorAll('.clinic-swatch').forEach((s) => s.classList.toggle('active', s === b));
    };
    return b;
  }));
  const flash = h('p', { class: 'note', role: 'status' }, '');
  const clear = () => {
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, canvas.width, canvas.height);
  };
  const keep = () => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      putLifeBook({ slot: 'dessin', day: dayKey(), updatedAt: Date.now(), photoBlob: blob, text: T('draw') })
        .then(() => { flash.textContent = T('lifeSaved'); })
        .catch((err) => { flash.textContent = err && err.message ? err.message : ''; });
    }, 'image/jpeg', 0.9);
  };

  return ctx.shell(T('draw'), T('drawSub'),
    h('p', { class: 'note' }, T('drawHint')),
    swatches,
    h('div', { class: 'clinic-canvas-wrap' }, canvas),
    h('div', { class: 'row center' }, btn(T('drawClear'), clear, 'ghost'), btn(T('drawSave'), keep, 'primary')),
    flash);
}

// ---------- Pépite 33 : cartes d'urgence ----------
const URGENT_CARDS = [
  ['🆘', 'Aide-moi', '3awnouni', 'ساعدوني'],
  ['😣', 'J’ai mal', 'Kaydarni', 'كيضرني'],
  ['😨', 'J’ai peur', 'Khayef', 'خايف'],
  ['💧', 'Eau', 'Lma', 'الماء'],
  ['🚽', 'Toilettes', 'Bit lma', 'الحمام'],
  ['👩', 'Maman', 'Mama', 'ماما'],
  ['👨', 'Papa', 'Baba', 'بابا'],
  ['🤗', 'Câlin', '3enqa', 'عناق'],
  ['🍞', 'Manger', 'Makla', 'ماكلة'],
  ['🥤', 'Boire', 'Chorb', 'شرب'],
  ['😴', 'Dormir', 'N3es', 'نعس'],
  ['🌿', 'Calme', 'Hadi', 'هادي'],
  ['✅', 'Oui', 'Iyeh', 'إيه'],
  ['❌', 'Non', 'La', 'لا'],
  ['✋', 'Stop', 'W9ef', 'وقف'],
  ['⏸️', 'Pause', 'Rta7', 'رتاح'],
  ['🎧', 'Casque', 'Kask', 'الكاسك'],
  ['🥵', 'Chaud', 'Skhoun', 'سخون'],
  ['🥶', 'Froid', 'Bared', 'بارد'],
  ['🤒', 'Malade', 'Mrid', 'مريض'],
  ['🩺', 'Docteur', 'Tbib', 'الطبيب'],
  ['⏳', 'Attends', 'Tsenn', 'تسنى'],
  ['🔁', 'Encore', 'Zid', 'زيد'],
  ['✔️', 'Fini', 'Sala', 'سالا'],
];

function urgentTool(ctx) {
  const { T } = ctx;
  const grid = h('div', { class: 'clinic-urgent' }, URGENT_CARDS.map(([emoji, fr, dr, ar]) => {
    const b = h('button', { type: 'button', class: 'clinic-urgent-card' },
      h('span', { class: 'clinic-big-emoji', 'aria-hidden': 'true' }, emoji),
      h('span', { class: 'label' }, ctx.lang === 'dr' ? dr : fr));
    b.onclick = () => {
      if (ctx.lang === 'dr' && hasArabicVoice()) speak(ar, { lang: 'ar' });
      else speak(fr);
    };
    return b;
  }));
  return ctx.shell(T('urgent'), T('urgentSub'), h('p', { class: 'note' }, T('urgentHint')), grid);
}
