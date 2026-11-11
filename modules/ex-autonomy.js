// Sections U à Z : habillage, repas en famille, hygiène, toilettes, motricité globale et fine.
import * as db from '../db.js';
import { h, btn, sleep, formatTime } from './util.js';
import { speak } from '../speech.js';
import { playBeep, playClap } from '../media.js';
import { recordTrial, ratingPanel, firstName, sisterName } from './aba.js';
import { sequenceBoard, bigCard, praise, videoModel } from './widgets.js';
import { sequenceExercise } from './ex-social.js';
import { accidentStats, evaluate } from './progress.js';
import { goalById } from './goals.js';
import { visualTimer } from './timer.js';
import { renderVisual } from './visuals.js';
import { SEQUENCES } from './content.js';

// ---------- V : « À table en famille (avec Papa, Maman et Ghita) » ----------
export const mealTitle = () => `À table en famille (avec Papa, Maman et ${sisterName()})`;
const BITES_PER_TOKEN = 5;

const familyTable = () => h('div', { class: 'family-table' },
  [['person:abir', firstName()], ['person:ghita', sisterName()], ['person:papa', 'Papa'], ['person:maman', 'Maman']].map(([vkey, label]) =>
    h('div', { class: 'family-seat' }, renderVisual({ vkey, label }), h('span', {}, label))));

// Étoiles qui s'allument une à une ; pleines = 1 jeton gagné.
function starRow(total, onFull) {
  let lit = 0;
  let tokens = 0;
  const stars = h('div', { class: 'tokens' });
  const tokenOut = h('p', { class: 'ask' }, '');
  const draw = () => {
    stars.replaceChildren(...Array.from({ length: total }, (_, i) => h('span', { class: `token${i < lit ? ' on' : ''}` }, '⭐')));
    tokenOut.textContent = tokens ? `Jetons gagnés : ${'🏅'.repeat(tokens)}` : '';
  };
  draw();
  return {
    element: h('div', { class: 'token-board' }, stars, tokenOut),
    add() {
      lit += 1;
      if (lit >= total) { lit = 0; tokens += 1; playClap(); speak('Bravo, un jeton !'); if (onFull) onFull(tokens); } else playBeep();
      draw();
    },
    reset() { lit = 0; draw(); },
  };
}

function mealShell(game, goalId, ratingOptions) {
  const timer = visualTimer({ minutes: 15, choices: [5, 10, 15, 20], color: '#FFB74D', onEnd: () => speak('Le repas est fini.') });
  return h('div', { class: 'stack' },
    h('h3', {}, `🍽️ ${mealTitle()}`), familyTable(), game,
    h('details', {}, h('summary', {}, '⏳ Sablier du repas'), timer.element),
    h('details', { open: true }, h('summary', {}, 'Note de l’adulte'), ratingPanel(goalId, ratingOptions)));
}

// V.1 : l'assiette (photo du vrai plat possible) ; chaque bouchée à la cuillère allume une étoile.
function mealSpoon() {
  const stars = starRow(BITES_PER_TOKEN);
  const plate = h('button', { type: 'button', class: 'plate', 'aria-label': 'Une bouchée' },
    renderVisual({ vkey: 'meal:plat', emoji: '🍛', label: 'Mon plat' }), h('span', { class: 'cutlery' }, '🥄'));
  plate.onclick = () => { plate.classList.remove('pressed'); void plate.offsetWidth; plate.classList.add('pressed'); stars.add(); };
  return mealShell(h('div', { class: 'stack' }, h('p', { class: 'ask' }, 'Une bouchée avec ma cuillère : je touche mon assiette !'), plate, stars.element),
    'V.1', { item: 'cuillere', labels: { plus: 'Repas à la cuillère, sans les doigts ✅' } });
}

// V.2 : piquer chaque morceau avec la fourchette.
const PIECES = [['🥕', 'carotte'], ['🥦', 'brocoli'], ['🍗', 'poulet'], ['🥔', 'pomme de terre'], ['🍅', 'tomate']];
function mealFork() {
  const stars = starRow(PIECES.length);
  const plate = h('div', { class: 'fork-plate' });
  const fill = () => plate.replaceChildren(...PIECES.map(([emoji, fr]) => {
    const piece = h('button', { type: 'button', class: 'piece' }, renderVisual({ emoji, fr }, { button: false }));
    piece.onclick = () => {
      if (piece.classList.contains('eaten')) return;
      piece.classList.add('eaten');
      stars.add();
      if (!plate.querySelector('.piece:not(.eaten)')) setTimeout(fill, 1200);
    };
    return piece;
  }));
  fill();
  return mealShell(h('div', { class: 'stack' }, h('p', { class: 'ask' }, 'Je pique avec ma fourchette 🍴'), plate, stars.element),
    'V.2', { item: 'fourchette', labels: { plus: 'A piqué et porté à la bouche ✅' } });
}

// V.3 : le verre se vide à chaque gorgée bue sans renverser.
const SIPS = 5;
function mealGlass() {
  let level = SIPS;
  const stars = starRow(SIPS);
  const water = h('div', { class: 'water' }, h('i'), h('i'), h('i'));
  const glass = h('button', { type: 'button', class: 'glass', 'aria-label': 'Une gorgée' }, water);
  const draw = () => { water.style.height = `${(level / SIPS) * 100}%`; };
  glass.onclick = () => {
    if (level === 0) { level = SIPS; draw(); return; }
    level -= 1; draw();
    glass.classList.remove('bubbling'); void glass.offsetWidth; glass.classList.add('bubbling');
    stars.add();
  };
  draw();
  return mealShell(h('div', { class: 'stack' }, h('p', { class: 'ask' }, 'Une gorgée : je touche mon verre !'),
    h('div', { class: 'row center' }, glass, btn('💦 Renversé', () => { stars.reset(); speak('Ce n’est pas grave. On essuie.'); }, 'ghost')), stars.element),
  'V.3', { item: 'verre', labels: { plus: 'A bu seule sans renverser ✅' } });
}

// ---------- W.3 : « Je me brosse les dents » — minuteur par quadrants (60 ou 90 s) ----------
const QUADRANTS = ['En haut à droite', 'En haut à gauche', 'En bas à gauche', 'En bas à droite'];

function brushing(ctx) {
  const mouth = h('div', { class: 'mouth' }, QUADRANTS.map((q) => h('div', { class: 'quadrant' }, q)));
  const clock = h('div', { class: 'timer-clock' }, '');
  const select = h('select', {}, h('option', { value: 60 }, '60 s'), h('option', { value: 90, selected: true }, '90 s'));
  let token = 0;
  const run = async () => {
    token += 1;
    const mine = token;
    const total = Number(select.value);
    const each = total / 4;
    for (let i = 0; i < 4; i += 1) {
      if (mine !== token) return;
      [...mouth.children].forEach((c, j) => c.classList.toggle('lit', j === i));
      speak(QUADRANTS[i]);
      for (let s = each; s > 0; s -= 1) {
        if (mine !== token) return;
        clock.textContent = formatTime(total - i * each - (each - s));
        await sleep(1000);
      }
    }
    [...mouth.children].forEach((c) => c.classList.remove('lit'));
    clock.textContent = '0:00';
    playClap();
    speak('Bravo, les dents sont propres !');
  };
  ctx.onCleanup(() => { token += 1; });
  const seq = sequenceBoard(SEQUENCES['W.3']);
  return h('div', { class: 'stack' },
    h('h3', {}, '🪥 Je me brosse les dents'),
    h('div', { class: 'brush-row' }, videoModel('brossage', '🪥', { canEdit: ctx.parent }), mouth), clock,
    h('p', { class: 'note' }, `En mode parent, filmez ${firstName()} ou ${sisterName()} qui se brosse les dents : la vidéo sert de modèle.`),
    h('div', { class: 'row center' }, select, btn('▶ Je me brosse les dents', run, 'primary'), btn('⏹', () => { token += 1; }, 'ghost')),
    seq.element,
    ratingPanel('W.3', { item: 'brossage', onRated: () => seq.reset() }));
}

// ---------- X : toilettes ----------
// X.3 : rappel planifié (90 / 120 min) — partagé avec app.js pour afficher le rappel partout.
export const toiletReminder = {
  async get() { return (await db.getSetting('toiletReminder')) || { interval: 0, next: 0 }; },
  async start(minutes) { const value = { interval: minutes, next: Date.now() + minutes * 60000 }; await db.setSetting('toiletReminder', value); return value; },
  async stop() { await db.setSetting('toiletReminder', { interval: 0, next: 0 }); },
  async restart() { const r = await this.get(); return r.interval ? this.start(r.interval) : r; },
};

// Journal du passage : sec / demande spontanée / accident (une demande spontanée compte aussi pour X.1).
export async function logToilet(kind) {
  await recordTrial('X.3', 'log', { item: kind, meta: { kind } });
  if (kind === 'request') await recordTrial('X.1', 'plus', { item: 'spontanee', meta: { source: 'journal' } });
  await toiletReminder.restart();
}

function toiletPlan(ctx) {
  const countdown = h('div', { class: 'timer-clock' }, '—');
  const stats = h('p', { class: 'note' });
  const intervalSelect = h('select', {}, h('option', { value: 90 }, 'Toutes les 1 h 30'), h('option', { value: 120 }, 'Toutes les 2 h'));
  const tick = async () => {
    const r = await toiletReminder.get();
    countdown.textContent = r.next ? (r.next > Date.now() ? `Prochain passage dans ${formatTime((r.next - Date.now()) / 1000)}` : '🚽 C’est l’heure des toilettes') : 'Rappel arrêté';
  };
  const drawStats = async () => {
    const s = accidentStats(await db.getTrialsOf('X.3'));
    stats.textContent = s.weeks
      ? `Semaine 1 : ${s.baseline.toFixed(1)} accident/jour · cette semaine : ${s.current.toFixed(1)} · baisse : ${Math.round(s.reduction)} % (but : 50 %)`
      : 'Notez chaque passage : la semaine 1 sert de point de départ.';
  };
  const timer = setInterval(tick, 1000);
  ctx.onCleanup(() => clearInterval(timer));
  tick(); drawStats();
  const log = (kind, label, cls) => btn(label, async () => { await logToilet(kind); drawStats(); tick(); speak(kind === 'accident' ? 'Ce n’est pas grave.' : 'Bravo !'); }, cls);
  return h('div', { class: 'stack' },
    h('div', { class: 'row center' }, intervalSelect, btn('▶ Démarrer le rappel', async () => { await toiletReminder.start(Number(intervalSelect.value)); tick(); }, 'primary'), btn('⏹ Arrêter', async () => { await toiletReminder.stop(); tick(); }, 'ghost')),
    countdown,
    h('div', { class: 'row center' }, log('dry', 'Passage sec ✅', 'rate-plus'), log('request', 'Demande spontanée 🌟', 'rate-prompt'), log('accident', 'Accident ⚠️', 'rate-minus')),
    stats);
}

// X.1 : compteur du jour (le bouton 🚽 en haut de l'écran compte aussi).
function x1() {
  const status = h('p', { class: 'ask' });
  const draw = async () => {
    const result = evaluate(goalById('X.1'), await db.getTrialsOf('X.1'), []);
    status.textContent = result.detail;
  };
  draw();
  return h('div', { class: 'stack' },
    h('p', { class: 'note' }, 'Chaque appui sur le bouton 🚽 en haut de l’écran compte une demande spontanée.'),
    status,
    btn('🌟 Demande spontanée observée (sans le téléphone)', async () => { await recordTrial('X.1', 'plus', { item: 'spontanee', meta: { source: 'observee' } }); draw(); }, 'primary wide'),
    btn('Demande après rappel de l’adulte', async () => { await recordTrial('X.1', 'prompt', { item: 'rappel' }); draw(); }, 'ghost'));
}

// ---------- Y : motricité globale ----------
// Y.2 : 10 passes de ballon comptées à voix haute.
function passes() {
  let n = 0;
  const dots = h('div', { class: 'exchanges' });
  const draw = () => dots.replaceChildren(...Array.from({ length: 10 }, (_, i) => h('span', { class: `dot${i < n ? ' on' : ''}` }, String(i + 1))));
  const pass = async (ok) => {
    if (n >= 10) { n = 0; }
    n += 1; draw();
    speak(String(n));
    await recordTrial('Y.2', ok ? 'plus' : 'minus', { item: 'passe-2m', meta: { pass: n } });
    if (n === 10) { playClap(); speak('Dix passes, bravo !'); }
  };
  draw();
  return h('div', { class: 'stack' }, bigCard('⚽', `Lancer et attraper à 2 mètres (avec Papa ou ${sisterName()})`), dots,
    h('div', { class: 'row center' }, btn('Attrapé à deux mains ✅', () => pass(true), 'rate-plus'), btn('Raté ❌', () => pass(false), 'rate-minus'), btn('↺', () => { n = 0; draw(); }, 'ghost')));
}

// Y.3 : « Flamant rose 1 - 2 - 3 ! »
function flamingo() {
  const count = h('div', { class: 'flamingo-count' }, '');
  const go = async () => {
    for (const n of ['1', '2', '3']) { count.textContent = n; speak(n); await sleep(1000); }
    count.textContent = '🎉'; playClap(); speak('Bravo !');
  };
  return h('div', { class: 'stack' }, bigCard('🦩', 'Flamant rose : sur un pied !'), count, btn('▶ 1 - 2 - 3 !', go, 'primary'),
    ratingPanel('Y.3', { item: 'equilibre-3s', labels: { plus: 'Tenu 3 secondes ✅' } }));
}

// ---------- Z : motricité fine ----------
// Z.2 : « Atelier découpage d'Abir » — bandes à imprimer.
function printStrips() {
  const area = document.getElementById('print-area');
  area.innerHTML = `<div class="print-sheet"><h1>Atelier découpage d'${firstName()}</h1>
    ${Array.from({ length: 5 }, () => '<div class="cut-strip"><span class="cut-start">✂️</span><div class="cut-line"></div><span class="cut-end">⭐</span></div>').join('')}</div>`;
  window.print();
}

// Z.3 : pince digitale multi-touch — rapprocher pouce et index pour saisir une perle et la glisser sur le fil.
const PEARL_COLORS = ['#E57373', '#64B5F6', '#FFD54F', '#81C784', '#BA68C8'];

function pinchGame() {
  const area = h('div', { class: 'pinch-area' });
  const oneFinger = h('input', { type: 'checkbox' });
  const result = h('div');
  const start = () => {
    result.replaceChildren();
    const width = area.clientWidth || 320;
    const slots = PEARL_COLORS.map((_, i) => ({ x: width / 2 - 100 + i * 50, y: 60 }));
    let threaded = 0;
    area.replaceChildren(h('div', { class: 'thread', style: { top: '58px' } }), ...slots.map((s) => h('div', { class: 'slot-mark', style: { left: `${s.x - 4}px`, top: `${s.y - 4}px` } })));
    const pearls = PEARL_COLORS.map((color, i) => {
      const home = { x: 40 + i * ((width - 80) / 4), y: 240 };
      const el = h('div', { class: 'pearl', style: { background: color, left: `${home.x - 18}px`, top: `${home.y - 18}px` } });
      area.append(el);
      return { el, home, pos: { ...home }, done: false };
    });
    const pointers = new Map();
    let held = null;
    const local = (e) => { const r = area.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const place = (pearl, p) => { pearl.pos = p; pearl.el.style.left = `${p.x - 18}px`; pearl.el.style.top = `${p.y - 18}px`; };
    const grip = () => {
      const pts = [...pointers.values()];
      if (oneFinger.checked) return pts.length ? { mid: pts[0], ok: true } : null;
      if (pts.length < 2) return null;
      const [a, b] = pts;
      return { mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, ok: Math.hypot(a.x - b.x, a.y - b.y) <= 120 };
    };
    const release = () => {
      if (!held) return;
      const slot = slots[threaded];
      if (Math.hypot(held.pos.x - slot.x, held.pos.y - slot.y) <= 45) {
        place(held, slot); held.done = true; held.el.classList.add('done'); threaded += 1;
        playBeep(); speak(String(threaded));
        if (threaded === 5) { playClap(); speak('Bravo, le collier est fini !'); result.replaceChildren(praise('5 perles enfilées !')); }
      } else place(held, held.home);
      held.el.classList.remove('held');
      held = null;
    };
    area.onpointerdown = (e) => { area.setPointerCapture(e.pointerId); pointers.set(e.pointerId, local(e)); };
    area.onpointermove = (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, local(e));
      const g = grip();
      if (!g) return;
      if (!held && g.ok) {
        held = pearls.find((p) => !p.done && Math.hypot(p.pos.x - g.mid.x, p.pos.y - g.mid.y) <= 50) || null;
        if (held) held.el.classList.add('held');
      }
      if (held) { if (!g.ok) release(); else place(held, g.mid); }
    };
    const up = (e) => { pointers.delete(e.pointerId); if (held && (oneFinger.checked || pointers.size < 2)) release(); };
    area.onpointerup = up;
    area.onpointercancel = up;
  };
  requestAnimationFrame(start);
  return h('div', { class: 'stack' },
    h('p', { class: 'note' }, 'Pince la perle avec le pouce et l’index, puis glisse-la sur le fil.'),
    area, result,
    h('div', { class: 'row center' }, btn('↺ Recommencer', start, 'ghost'), h('label', { class: 'check' }, oneFinger, ' Mode un doigt')),
    h('h3', {}, 'Avec de vraies perles'),
    ratingPanel('Z.3', { item: '5-perles', labels: { plus: '5 perles seule ✅' } }));
}

export const EXERCISES = {
  'U.1': sequenceExercise('U.1'), 'U.2': sequenceExercise('U.2'), 'U.3': sequenceExercise('U.3'),
  'V.1': mealSpoon, 'V.2': mealFork, 'V.3': mealGlass,
  'W.1': sequenceExercise('W.1'), 'W.2': sequenceExercise('W.2'), 'W.3': brushing,
  'X.1': x1, 'X.2': sequenceExercise('X.2'), 'X.3': toiletPlan,
  'Y.1': sequenceExercise('Y.1', { intro: 'Parcours réel : cerceaux, tunnel, panier.' }), 'Y.2': passes, 'Y.3': flamingo,
  'Z.1': () => h('div', { class: 'stack' }, bigCard('✏️', 'Prise tripode : pouce, index, majeur', '', 'obj:prise-tripode'),
    h('p', { class: 'note' }, 'Vérifiez la prise pendant toute l’activité de graphisme.'), ratingPanel('Z.1', { item: 'seance', labels: { plus: 'Prise tenue toute l’activité ✅' } })),
  'Z.2': () => h('div', { class: 'stack' }, bigCard('✂️', 'Découper le long de la ligne'), btn(`🖨️ Imprimer : Atelier découpage d'${firstName()}`, printStrips, 'primary'),
    ratingPanel('Z.2', { item: 'ligne-droite', labels: { plus: 'Ligne suivie à 80 % ✅' } })),
  'Z.3': pinchGame,
};
