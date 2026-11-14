// v9.0 : Atelier Orthophonie (4 protocoles). Tout reste dans le téléphone : journal « ortho_logs », voix dans « recordings ».
// 1) DTTC : articulation en 4 paliers, latence de réponse, enregistrement local.
// 2) Expansion syntaxique : construire des phrases de plus en plus longues (MLU).
// 3) Pragmatique : 5 fonctions de communication (demander, commenter, refuser, questionner, réparer).
// 4) Phonologie : paires minimales et intonation.
// La cotation est faite par l'adulte. Le micro ne sert qu'à enregistrer et à repérer le début de la voix, sans rien envoyer.
import * as db from '../db.js';
import { h, btn, uid, dayKey, shuffle, pick } from './util.js';
import { speak, stopSpeaking, hasArabicVoice } from '../speech.js';
import { playClap, playBeep, startListening, canRecord } from '../media.js';
import { clinic, firstName, sisterName } from './aba.js';
import { choiceBoard, modeTabs } from './widgets.js';

// ---------- Journal ----------
export function logOrtho(fields) {
  return db.addOrthoLog({
    id: uid('ortho'), ts: Date.now(), day: dayKey(), protocol: '', target: '', phoneme: '', step: null, result: null, latencyMs: null,
    mlu: null, fn: '', spontaneous: false, recordingId: null, intervenant: clinic.intervenant, place: clinic.environment, ...fields,
  });
}

const useArabic = (lang) => lang === 'dr' && hasArabicVoice();
const sayWord = (item, lang, rate = 0.85) => (useArabic(lang) && item.ar ? speak(item.ar, { lang: 'ar', rate }) : speak(item.fr, { rate }));
function shake(el) { el.classList.remove('shake-soft'); void el.offsetWidth; el.classList.add('shake-soft'); }

// ---------- Atelier 1 : DTTC ----------
export const PHONEMES = ['/p/', '/b/', '/m/', '/t/', '/k/', '/ʃ/', '/s/', '/r/', '/l/'];
const T = (phoneme, level, fr, emoji) => ({ phoneme, level, fr, emoji, lang: 'fr' });
const D = (phoneme, level, dr, ar, emoji, fr) => ({ phoneme, level, fr, dr, ar, emoji, lang: 'dr' });
// Niveau 1 : syllabe CV ; 2 : mot court ; 3 : mot plus complexe.
const TARGETS_FR = [
  T('/p/', 1, 'pa', '👄'), T('/p/', 2, 'papa', '👨'), T('/p/', 2, 'pomme', '🍎'), T('/p/', 3, 'pantalon', '👖'),
  T('/b/', 1, 'ba', '👄'), T('/b/', 2, 'bébé', '👶'), T('/b/', 2, 'ballon', '⚽'), T('/b/', 3, 'banane', '🍌'),
  T('/m/', 1, 'ma', '👄'), T('/m/', 2, 'maman', '👩'), T('/m/', 2, 'maison', '🏠'), T('/m/', 3, 'musique', '🎵'),
  T('/t/', 1, 'ta', '👄'), T('/t/', 2, 'tasse', '☕'), T('/t/', 2, 'tortue', '🐢'), T('/t/', 3, 'tomate', '🍅'),
  T('/k/', 1, 'ka', '👄'), T('/k/', 2, 'café', '☕'), T('/k/', 2, 'canard', '🦆'), T('/k/', 3, 'camion', '🚚'),
  T('/ʃ/', 1, 'cha', '👄'), T('/ʃ/', 2, 'chat', '🐱'), T('/ʃ/', 2, 'chaussure', '👟'), T('/ʃ/', 3, 'chocolat', '🍫'),
  T('/s/', 1, 'sa', '👄'), T('/s/', 2, 'sac', '🎒'), T('/s/', 2, 'soleil', '☀️'), T('/s/', 3, 'salade', '🥗'),
  T('/r/', 1, 'ra', '👄'), T('/r/', 2, 'riz', '🍚'), T('/r/', 2, 'robot', '🤖'), T('/r/', 3, 'radio', '📻'),
  T('/l/', 1, 'la', '👄'), T('/l/', 2, 'lit', '🛏️'), T('/l/', 2, 'lapin', '🐰'), T('/l/', 3, 'lunettes', '👓'),
];
// Darija : mêmes mots que les cartes de Kalimati quand ils existent (Baba, Mama, Khobz, Teffah, Salam, Safi, La…).
const TARGETS_DR = [
  D('/b/', 1, 'ba', 'با', '👄', 'ba'), D('/b/', 2, 'Baba', 'بابا', '👨', 'papa'), D('/b/', 2, 'Bit', 'بيت', '🚪', 'chambre'), D('/b/', 3, 'Bslama', 'بسلامة', '🖐️', 'au revoir'),
  D('/m/', 1, 'ma', 'ما', '👄', 'ma'), D('/m/', 2, 'Mama', 'ماما', '👩', 'maman'), D('/m/', 3, 'Makla', 'ماكلة', '🍽️', 'manger'),
  D('/t/', 1, 'ta', 'تا', '👄', 'ta'), D('/t/', 2, 'Teffah', 'تفاح', '🍎', 'pomme'), D('/t/', 3, 'Tomobil', 'طوموبيل', '🚗', 'voiture'),
  D('/k/', 1, 'ka', 'كا', '👄', 'ka'), D('/k/', 2, 'Kas', 'كاس', '🥛', 'verre'), D('/k/', 2, 'Kora', 'كرة', '⚽', 'ballon'), D('/k/', 3, 'Khobz', 'خبز', '🍞', 'pain'),
  D('/ʃ/', 1, 'cha', 'شا', '👄', 'cha'), D('/ʃ/', 2, 'Chems', 'شمس', '☀️', 'soleil'), D('/ʃ/', 3, 'Choukran', 'شكرا', '💛', 'merci'),
  D('/s/', 1, 'sa', 'سا', '👄', 'sa'), D('/s/', 2, 'Safi', 'صافي', '✋', 'fini'), D('/s/', 2, 'Salam', 'سلام', '👋', 'bonjour'),
  D('/r/', 1, 'ra', 'را', '👄', 'ra'), D('/r/', 2, 'Rjel', 'رجل', '🦶', 'pied'), D('/r/', 3, 'Rmmana', 'رمانة', '🍎', 'grenade'),
  D('/l/', 1, 'la', 'لا', '👄', 'la'), D('/l/', 2, 'Lma', 'الما', '💧', 'eau'), D('/l/', 3, 'Limouna', 'ليمونة', '🍊', 'orange'),
];
const STEPS = [[1, '① Ensemble, lentement'], [2, '② Je répète tout de suite'], [3, '③ Je répète après 3 s'], [4, '④ Je dis toute seule']];
const LEVELS = [[1, 'Syllabe'], [2, 'Mot court'], [3, 'Mot long']];
const RATINGS = [['exact', '✅ Exact', 'rate-plus'], ['approx', '〰️ Approximatif', 'rate-prompt'], ['prompt', '👉 Guidé', 'rate-prompt'], ['fail', '❌ Non produit', 'rate-minus']];
const SLOW_RATE = 0.65;
const DELAY_MS = 3000;
const LATENCY_MAX_MS = 6000;
const VOICE_ONSET = 0.12;
const pause = (ms, keep) => new Promise((resolve) => { keep(setTimeout(resolve, ms)); });

function dttcWorkshop(ctx) {
  const root = h('div', { class: 'stack' });
  const s = { phoneme: '/p/', level: 2, step: 1, index: 0, record: false };
  let t0 = 0; let latency = null; let tick = 0; let stopMic = null; let wait = 0;
  const bank = () => (ctx.lang === 'dr' ? TARGETS_DR : TARGETS_FR);
  const list = () => {
    const exact = bank().filter((t) => t.phoneme === s.phoneme && t.level === s.level);
    return exact.length ? exact : bank().filter((t) => t.phoneme === s.phoneme);
  };
  const cleanup = async () => {
    clearInterval(tick); clearTimeout(wait); stopSpeaking();
    if (stopMic) { const stop = stopMic; stopMic = null; await stop(); }
  };
  ctx.onCleanup(cleanup);

  function pickers() {
    const chip = (value, text, key) => h('button', { type: 'button', class: `pill-btn${s[key] === value ? ' on' : ''}`, onclick: () => { s[key] = value; s.index = 0; draw(); } }, text);
    return h('div', { class: 'stack dttc-pickers' },
      h('div', { class: 'row wrap' }, PHONEMES.map((p) => chip(p, p, 'phoneme'))),
      h('div', { class: 'row wrap' }, LEVELS.map(([v, text]) => chip(v, text, 'level'))),
      h('div', { class: 'row wrap' }, STEPS.map(([v, text]) => chip(v, text, 'step'))));
  }

  function draw() {
    cleanup();
    latency = null; t0 = 0;
    const items = list();
    if (!items.length) { root.replaceChildren(pickers(), h('p', { class: 'note' }, 'Ce son n’est pas dans la liste en darija. Choisissez un autre son.')); return; }
    const target = items[s.index % items.length];
    const word = target.lang === 'dr' ? target.dr : target.fr;
    const bar = h('span', {});
    const latencyText = h('strong', {}, '—');
    const cue = h('p', { class: 'dttc-cue' }, s.step === 4 ? 'Je montre l’image. Elle dit le mot toute seule.' : 'Touchez « Modèle » pour commencer.');
    const delayBar = h('div', { class: 'bubble-bar dttc-delay', hidden: s.step !== 3 }, h('span', { class: 'bubble-fill' }));
    const stopLatency = () => { if (!t0 || latency !== null) return; latency = Date.now() - t0; clearInterval(tick); latencyText.textContent = `${(latency / 1000).toFixed(1)} s`; };
    const startLatency = async () => {
      t0 = Date.now();
      cue.textContent = '🗣️ À toi !';
      tick = setInterval(() => {
        const ms = Date.now() - t0;
        bar.style.width = `${Math.min(100, (100 * ms) / LATENCY_MAX_MS)}%`;
        latencyText.textContent = `${(ms / 1000).toFixed(1)} s`;
        if (ms > LATENCY_MAX_MS * 2) clearInterval(tick);
      }, 100);
      if (!s.record || !canRecord()) return;
      try { stopMic = await startListening({ record: true, onLevel: (level) => { if (level > VOICE_ONSET) stopLatency(); } }); } catch { cue.textContent = '🗣️ À toi ! (micro refusé)'; }
    };
    const model = async () => {
      await cleanup();
      latency = null; bar.style.width = '0%'; latencyText.textContent = '—';
      if (s.step === 4) { await speak(useArabic(ctx.lang) ? 'شنو هادا؟' : 'C’est quoi ?', { lang: useArabic(ctx.lang) ? 'ar' : 'fr' }); startLatency(); return; }
      if (s.step === 1) {
        for (const n of ['3', '2', '1']) { cue.textContent = `👄 ${n}…`; playBeep(); await pause(700, (id) => { wait = id; }); }
        cue.textContent = '👄 Ensemble !';
        await sayWord(target, ctx.lang, SLOW_RATE);
        startLatency();
        return;
      }
      await sayWord(target, ctx.lang);
      if (s.step === 3) {
        cue.textContent = '⏳ J’attends 3 secondes…';
        delayBar.firstChild.style.animation = 'none'; void delayBar.offsetWidth;
        delayBar.firstChild.style.animation = `bubble-drain ${DELAY_MS}ms linear forwards`;
        await pause(DELAY_MS, (id) => { wait = id; });
      }
      startLatency();
    };
    const rate = async (result) => {
      stopLatency();
      let recordingId = null;
      if (stopMic) {
        const stop = stopMic; stopMic = null;
        const { blob } = await stop();
        if (blob) { recordingId = uid('rec'); await db.putRecording({ id: recordingId, key: `ortho:${word}`, ts: Date.now(), kind: 'child-voice', blob }); }
      }
      await logOrtho({ protocol: 'dttc', target: word, phoneme: target.phoneme, step: s.step, result, latencyMs: latency, recordingId, spontaneous: s.step === 4 });
      if (result === 'exact') playClap();
      s.index += 1;
      draw();
    };
    const recordToggle = canRecord() ? h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: s.record, onchange: (e) => { s.record = e.target.checked; } }),
      ' 🎙️ Enregistrer sa voix (reste dans le téléphone)') : null;
    root.replaceChildren(pickers(),
      h('div', { class: 'big-card dttc-card' }, h('span', { class: 'dttc-phoneme' }, target.phoneme), h('span', { class: 'emoji dttc-emoji' }, target.emoji),
        s.step === 4 ? null : h('span', { class: 'label dttc-word' }, word), target.lang === 'dr' && s.step !== 4 ? h('small', { dir: 'rtl' }, target.ar) : null),
      cue, delayBar,
      h('div', { class: 'row center' }, btn(s.step === 4 ? '🖼️ C’est quoi ?' : '▶ Modèle', model, 'primary'), btn('⏭ Autre mot', () => { s.index += 1; draw(); }, 'ghost')),
      h('div', { class: 'latency' }, h('span', { class: 'latency-label' }, '⏱️ Latence : ', latencyText), h('div', { class: 'latency-bar' }, bar)),
      recordToggle,
      h('div', { class: 'row rating-row' }, RATINGS.map(([id, text, cls]) => btn(text, () => rate(id), cls))));
  }

  draw();
  return root;
}

// ---------- Atelier 2 : expansion syntaxique (MLU) ----------
const W = (emoji, fr, dr = '', ar = '') => ({ emoji, fr, dr, ar });
const SENTENCES = () => [
  [W('🧒', firstName(), firstName(), firstName()), W('😋', 'mange', 'katakoul', 'كتاكل'), W('🍎', 'la pomme', 'teffaha', 'التفاحة'), W('🔴', 'rouge', '7emra', 'الحمرا'), W('🏠', 'à la maison', 'f dar', 'فالدار')],
  [W('👨', 'Papa', 'Baba', 'بابا'), W('🥛', 'boit', 'kaychrab', 'كيشرب'), W('🥛', 'le lait', 'l 7lib', 'الحليب'), W('♨️', 'chaud', 'skhoun', 'السخون'), W('🍽️', 'dans la cuisine', 'f l kouzina', 'فالكوزينة')],
  [W('👩', 'Maman', 'Mama', 'ماما'), W('📖', 'lit', 'katqra', 'كتقرا'), W('📕', 'le livre', 'l ktab', 'الكتاب'), W('🔵', 'bleu', 'zreq', 'الزرق'), W('🛋️', 'dans le salon', 'f salon', 'فالصالون')],
  [W('👧', sisterName(), sisterName(), sisterName()), W('🤾', 'lance', 'katlou7', 'كتلوح'), W('⚽', 'le ballon', 'l kora', 'الكرة'), W('🟡', 'jaune', 'sefra', 'الصفرا'), W('🌳', 'au parc', 'f jerda', 'فالجردة')],
  [W('🐱', 'Le chat', 'L mech', 'المش'), W('👅', 'boit', 'kaychrab', 'كيشرب'), W('🥛', 'le lait', 'l 7lib', 'الحليب'), W('❄️', 'froid', 'bared', 'البارد'), W('🌿', 'dans le jardin', 'f jerda', 'فالجردة')],
];
const LEVEL_PARTS = { 1: [2], 2: [0, 1], 3: [0, 1, 2], 4: [0, 1, 2, 3, 4] };
const LEVEL_NAMES = [[1, '① Un mot'], [2, '② Qui + fait'], [3, '③ Qui + fait + quoi'], [4, '④ Phrase longue']];

function mluWorkshop(ctx) {
  const root = h('div', { class: 'stack' });
  let level = 2;
  let current = pick(SENTENCES());
  const text = (w) => (ctx.lang === 'dr' && w.dr ? w.dr : w.fr);
  const sentenceOf = (words) => words.map(text).join(' ');
  const saySentence = (words) => (useArabic(ctx.lang) ? speak(words.map((w) => w.ar || w.fr).join(' '), { lang: 'ar', rate: 0.8 }) : speak(words.map((w) => w.fr).join(' '), { rate: 0.8 }));
  ctx.onCleanup(stopSpeaking);

  function start() {
    const words = LEVEL_PARTS[level].map((i) => current[i]);
    let next = 0; let errors = 0;
    const slots = words.map((_, i) => h('div', { class: 'puzzle-slot' }, h('span', { class: 'slot-num' }, String(i + 1))));
    const after = h('div', { class: 'stack' });
    const done = (spontaneous) => async () => {
      await logOrtho({ protocol: 'mlu', target: sentenceOf(words), step: level, mlu: words.length, result: errors ? 'prompt' : 'exact', spontaneous });
      current = pick(SENTENCES());
      start();
    };
    const cards = shuffle(words.map((w, i) => ({ w, i }))).map(({ w, i }) => {
      const card = h('button', { type: 'button', class: 'choice toilet-card' }, h('span', { class: 'emoji' }, w.emoji), h('span', { class: 'label' }, text(w)));
      card.onclick = () => {
        if (i !== next) { errors += 1; shake(card); return; }
        slots[i].replaceChildren(h('span', { class: 'emoji' }, w.emoji), h('span', { class: 'label' }, text(w)));
        slots[i].classList.add('filled'); card.remove(); next += 1;
        if (next < words.length) { sayWord(w, ctx.lang); return; }
        saySentence(words); playClap();
        after.replaceChildren(h('p', { class: 'model-word small' }, sentenceOf(words)), btn('🔊 Réécouter la phrase', () => saySentence(words), 'ghost'),
          h('div', { class: 'row center' }, btn('🗣️ Elle a dit la phrase seule', done(true), 'rate-plus'), btn('👂 Elle a répété ou écouté', done(false), 'rate-prompt')));
      };
      return card;
    });
    root.replaceChildren(
      h('div', { class: 'row wrap' }, LEVEL_NAMES.map(([v, name]) => h('button', { type: 'button', class: `pill-btn${level === v ? ' on' : ''}`, onclick: () => { level = v; start(); } }, name))),
      h('p', { class: 'ask' }, 'Construis la phrase dans l’ordre', btn('🔊', () => saySentence(words), 'ghost tiny')),
      h('div', { class: 'puzzle-slots', style: { '--cols': Math.min(words.length, 3) } }, slots), h('div', { class: 'puzzle-tray' }, cards), after);
  }
  start();
  return root;
}

// ---------- Atelier 3 : pragmatique sociale ----------
export const FUNCTIONS = [
  { id: 'mand', emoji: '🤝', label: 'Demander de l’aide' }, { id: 'tact', emoji: '👉', label: 'Commenter / partager' },
  { id: 'refusal', emoji: '🙅', label: 'Refuser calmement' }, { id: 'question', emoji: '❓', label: 'Poser une question' },
  { id: 'repair', emoji: '🔁', label: 'Réparer un malentendu' },
];
const C = (emoji, fr, ar = '') => ({ emoji, fr, ar });
const SCENARIOS = () => [
  { id: 'bulles', fn: 'mand', scene: '🫧', text: 'Le pot de bulles est fermé. Je n’arrive pas à l’ouvrir.', ok: C('🤝', 'Aide-moi, s’il te plaît', 'عاوني عافاك'), no: [C('😭', 'Je crie'), C('🚶', 'Je pars')] },
  { id: 'doudou', fn: 'mand', scene: '🧸', text: 'Mon doudou est trop haut sur l’étagère.', ok: C('🤝', 'Aide-moi', 'عاوني'), no: [C('🧗', 'Je grimpe toute seule'), C('😭', 'Je pleure')] },
  { id: 'avion', fn: 'tact', scene: '✈️', text: 'Un avion passe dans le ciel !', ok: C('👉', 'Regarde, un avion !', 'شوف، طيارة'), no: [C('🙈', 'Je ne dis rien'), C('🖐️', 'Au revoir')] },
  { id: 'chat', fn: 'tact', scene: '🐱', text: 'Un petit chat entre dans le jardin.', ok: C('👉', 'Regarde, un chat !', 'شوف، مش'), no: [C('🙈', 'Je ne dis rien'), C('🙏', 'Merci')] },
  { id: 'brocoli', fn: 'refusal', scene: '🥦', text: 'On me donne des brocolis. Je n’en veux pas.', ok: C('🙅', 'Non merci', 'لا شكرا'), no: [C('🤬', 'Je jette l’assiette'), C('😭', 'Je crie')] },
  { id: 'tablette', fn: 'refusal', scene: '📱', text: `${sisterName()} veut ma tablette. Je n’ai pas fini.`, ok: C('⏳', 'Attends, s’il te plaît', 'تسنى عافاك'), no: [C('👊', 'Je tape'), C('😭', 'Je crie')] },
  { id: 'cadeau', fn: 'question', scene: '🎁', text: 'Papa cache quelque chose dans son dos.', ok: C('❓', 'C’est quoi ?', 'شنو هادا؟'), no: [C('🙏', 'Merci'), C('🖐️', 'Au revoir')] },
  { id: 'chaussures', fn: 'question', scene: '👟', text: 'Je ne trouve pas mes chaussures.', ok: C('🔍', 'Où sont mes chaussures ?', 'فين صباطي؟'), no: [C('😭', 'Je pleure'), C('🙈', 'Je ne dis rien')] },
  { id: 'eau', fn: 'repair', scene: '🤷', text: 'Je demande de l’eau. Maman ne comprend pas et me donne du pain.', ok: C('🔁', 'Non, je veux de l’eau', 'لا، بغيت الما'), no: [C('😡', 'Je me fâche'), C('🤐', 'J’abandonne')] },
  { id: 'quoi', fn: 'repair', scene: '🙉', text: 'Je dis « ballon ». Papa dit : « Quoi ? Je n’ai pas entendu. »', ok: C('🔁', 'Je redis plus fort : ballon !', 'كرة'), no: [C('🤐', 'Je me tais'), C('😡', 'Je me fâche')] },
];

function pragmaticWorkshop(ctx) {
  const root = h('div', { class: 'stack' });
  let queue = [];
  ctx.onCleanup(stopSpeaking);
  function round() {
    if (!queue.length) queue = shuffle(SCENARIOS());
    const sc = queue.shift();
    const fn = FUNCTIONS.find((f) => f.id === sc.fn);
    const after = h('div', { class: 'stack' });
    const question = `${sc.text} Qu’est-ce que je fais ?`;
    const sayOk = () => (useArabic(ctx.lang) && sc.ok.ar ? speak(sc.ok.ar, { lang: 'ar' }) : speak(sc.ok.fr));
    const note = (spontaneous, result) => async () => { await logOrtho({ protocol: 'pragmatic', target: sc.id, fn: sc.fn, spontaneous, result }); round(); };
    const choices = [{ ...sc.ok, correct: true }, ...sc.no.map((c) => ({ ...c, correct: false }))];
    speak(question);
    root.replaceChildren(
      h('p', { class: 'chip-fn' }, `${fn.emoji} ${fn.label}`),
      h('div', { class: 'big-card' }, h('span', { class: 'emoji dttc-emoji' }, sc.scene), h('span', { class: 'label' }, sc.text)),
      h('p', { class: 'ask' }, 'Qu’est-ce que je fais ?', btn('🔊', () => speak(question), 'ghost tiny')),
      choiceBoard({ cols: 3, praise: 'Bravo !',
        choices: choices.map((c) => ({ correct: c.correct, label: c.fr, render: () => h('span', { class: 'emoji' }, c.emoji) })),
        onAnswer: (first) => {
          setTimeout(sayOk, 900);
          after.replaceChildren(h('p', { class: 'note' }, 'Pour l’adulte : et dans la vraie vie, en ce moment ?'),
            h('div', { class: 'row center' }, btn('🗣️ Elle le fait seule', note(true, first ? 'exact' : 'approx'), 'rate-plus'),
              btn('👉 Avec aide', note(false, 'prompt'), 'rate-prompt'), btn('❌ Pas encore', note(false, 'fail'), 'rate-minus')));
        } }),
      after);
  }
  round();
  return root;
}

// ---------- Atelier 4 : paires minimales et intonation ----------
const PAIRS = [
  ['p/b', ['pain', '🍞'], ['bain', '🛁']], ['ʃ/ʒ', ['chou', '🥬'], ['joue', '😊']], ['p/b', ['pull', '🧥'], ['bulle', '🫧']],
  ['p/b', ['pont', '🌉'], ['bon', '😋']], ['k/g', ['cou', '🦒'], ['goût', '👅']], ['p/b', ['poisson', '🐟'], ['boisson', '🥤']],
  ['t/d', ['thé', '🍵'], ['dé', '🎲']], ['f/v', ['faim', '🍽️'], ['vin', '🍇']], ['s/z', ['coussin', '🛋️'], ['cousin', '👦']],
];
const TONES = [
  { id: 'question', emoji: '❓', label: 'Une question', text: 'Tu viens au parc ?', pitch: 1.15, rate: 0.85 },
  { id: 'affirmation', emoji: '⏺️', label: 'Une phrase calme', text: 'Tu viens au parc.', pitch: 0.85, rate: 0.8 },
  { id: 'joie', emoji: '😄', label: 'La joie', text: 'Youpi ! Tu viens au parc !', pitch: 1.6, rate: 1.05 },
];
const TONE_DELAY_MS = 160;
// speak() ne règle pas la hauteur de la voix : pour l'intonation on parle directement au téléphone.
function sayTone(tone) {
  if (!('speechSynthesis' in window)) return;
  stopSpeaking();
  const utterance = new SpeechSynthesisUtterance(tone.text);
  utterance.lang = 'fr-FR'; utterance.pitch = tone.pitch; utterance.rate = tone.rate;
  setTimeout(() => window.speechSynthesis.speak(utterance), TONE_DELAY_MS);
}

function phonoWorkshop(ctx) {
  const root = h('div', { class: 'stack' });
  let mode = 'pairs';
  ctx.onCleanup(stopSpeaking);
  const tab = (id, text) => h('button', { type: 'button', class: `pill-btn${mode === id ? ' on' : ''}`, onclick: () => { mode = id; round(); } }, text);
  const tabs = () => h('div', { class: 'row wrap' }, tab('pairs', '👂 Deux mots qui se ressemblent'), tab('tone', '🎵 La mélodie de la voix'));
  function toneRound(after, nextBtn) {
    const tone = pick(TONES);
    sayTone(tone);
    root.replaceChildren(tabs(), h('p', { class: 'ask' }, 'Écoute. C’est…', btn('🔊 Réécouter', () => sayTone(tone), 'ghost tiny')),
      choiceBoard({ cols: 3, praise: 'Bravo !', choices: TONES.map((t) => ({ correct: t === tone, label: t.label, render: () => h('span', { class: 'emoji' }, t.emoji) })),
        onAnswer: (first) => { logOrtho({ protocol: 'phono', target: tone.id, phoneme: 'prosodie', result: first ? 'exact' : 'fail' }); nextBtn(); } }), after);
  }
  function round() {
    const after = h('div', { class: 'row center' });
    const nextBtn = () => after.replaceChildren(btn('➜ Suivant', round, 'primary'));
    if (mode === 'tone') { toneRound(after, nextBtn); return; }
    const [contrast, a, b] = pick(PAIRS);
    const [word, other] = Math.random() < 0.5 ? [a, b] : [b, a];
    speak(word[0], { rate: 0.75 });
    root.replaceChildren(tabs(), h('p', { class: 'ask' }, 'Écoute bien. Montre l’image du mot.', btn('🔊 Réécouter', () => speak(word[0], { rate: 0.75 }), 'ghost tiny')),
      choiceBoard({ cols: 2, praise: 'Bravo !', choices: [word, other].map((w) => ({ correct: w === word, label: w[0], render: () => h('span', { class: 'emoji dttc-emoji' }, w[1]) })),
        onAnswer: (first) => { logOrtho({ protocol: 'phono', target: word[0], phoneme: contrast, result: first ? 'exact' : 'fail' }); nextBtn(); } }), after);
  }
  round();
  return root;
}

// ---------- Écran ----------
// ctx : { lang, onCleanup(fn) }
export function orthoScreen(ctx) {
  const c = { lang: 'fr', onCleanup() {}, ...ctx };
  return h('div', { class: 'stack ortho' },
    h('p', { class: 'note' }, 'Quatre ateliers d’orthophonie. L’adulte note chaque essai. Les voix enregistrées restent dans le téléphone.'),
    modeTabs([['🗣️ Articulation', () => dttcWorkshop(c)], ['🧱 Phrases', () => mluWorkshop(c)], ['🤝 Situations', () => pragmaticWorkshop(c)], ['👂 Sons', () => phonoWorkshop(c)]]));
}
