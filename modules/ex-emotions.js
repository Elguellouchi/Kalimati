// 😊 Émotions & famille : studio des émotions en 3 modes et écran « nos vraies photos ».
// Ce studio complète le PEI (qui n'a pas d'objectif « émotions ») : il ne note aucun essai.
import { h, btn, pick, sample } from './util.js';
import { speak } from '../speech.js';
import { captureVideoFrame, playClap } from '../media.js';
import { firstName, sisterName, people } from './aba.js';
import { choiceBoard, bigCard, praise, modeTabs } from './widgets.js';
import { trialLoop } from './ex-visual.js';
import { EMOTIONS, B1_OBJECTS, renderVisual, setVisual, clearVisual, hasPhoto, openPhotoPickerModal, fillWithArasaac, keyFor } from './visuals.js';
import { SITUATIONS, SEQUENCES, TACT_ITEMS, VERBS, PAIRS, FUNCTION_BASKETS, CATEGORY_BOXES, ECHO_WORDS, RHYMES, ASSOCIATIONS, REINFORCERS, GESTURE_SEQUENCE, TWO_STEP_OBJECTS } from './content.js';
import { answerKey } from './ex-verbal.js';

const emotionChoices = (target) => [
  { vkey: target.vkey, label: target.fr, correct: true },
  ...sample(EMOTIONS.filter((e) => e.id !== target.id), 2).map((e) => ({ vkey: e.vkey, label: e.fr, correct: false })),
];
const nextBtn = (next) => btn('➜ Encore', next, 'primary');

// Mode 1 : « Montre qui est contente / triste / en colère… »
const receptive = () => trialLoop((next) => {
  const target = pick(EMOTIONS);
  const ask = `Montre-moi : ${target.fr}`;
  const after = h('div', { class: 'row center' });
  setTimeout(() => speak(ask), 300);
  return h('div', { class: 'stack' }, h('p', { class: 'ask' }, btn('🔊', () => speak(ask), 'ghost'), target.fr),
    h('div', { class: 'emotion-choices' }, choiceBoard({ choices: emotionChoices(target), cols: 3, praise: target.fr, onAnswer: () => { playClap(); after.replaceChildren(nextBtn(next)); } })),
    after);
});

// Mode 2 : situations de la vie d'Abir et de Ghita.
const situations = () => trialLoop((next) => {
  const situation = pick(SITUATIONS);
  const text = situation.text.replace('{sister}', sisterName()).replace('{name}', firstName());
  const target = EMOTIONS.find((e) => e.id === situation.emotion);
  const ask = `${text}. Comment se sent-elle ?`;
  const after = h('div', { class: 'row center' });
  setTimeout(() => speak(ask), 300);
  return h('div', { class: 'stack' },
    bigCard(situation.scene, '', 'scene-card', `situation:${situation.id}`),
    h('p', { class: 'ask' }, btn('🔊', () => speak(ask), 'ghost'), 'Comment se sent-elle ?'),
    h('details', {}, h('summary', {}, 'Texte pour l’adulte'), h('p', { class: 'adult-text' }, text)),
    h('div', { class: 'emotion-choices' }, choiceBoard({ choices: emotionChoices(target), cols: 3, praise: target.fr, onAnswer: () => { playClap(); after.replaceChildren(nextBtn(next)); } })),
    after);
});

// Mode 3 : miroir magique. L'enfant imite le visage puis prend la photo, qui devient l'image de l'émotion.
function mirror(ctx) {
  let emotion = EMOTIONS[0];
  let stream = null;
  const video = h('video', { class: 'mirror', autoplay: true, playsinline: true, muted: true });
  const camBox = h('div', { class: 'mirror-box' }, h('p', { class: 'note' }, 'Les photos restent dans ce téléphone.'));
  const model = h('div', { class: 'mirror-model' });
  const message = h('div');
  const chips = h('div', { class: 'people-row' });
  const draw = () => {
    chips.replaceChildren(...EMOTIONS.map((e) => h('button', { type: 'button', class: `person-chip${e.id === emotion.id ? ' on' : ''}`, onclick: () => { emotion = e; draw(); speak(e.fr); } },
      renderVisual({ vkey: e.vkey, label: e.fr }, { button: false }), h('span', {}, e.fr))));
    model.replaceChildren(bigCard('', emotion.fr, '', emotion.vkey));
    message.replaceChildren();
  };
  const startCam = async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = stream;
      camBox.replaceChildren(video);
    } catch { camBox.replaceChildren(h('p', { class: 'note' }, 'Caméra refusée ou absente. Autorisez-la dans les réglages du téléphone.')); }
  };
  const shoot = async () => {
    try {
      await setVisual(emotion.vkey, await captureVideoFrame(video), { source: 'miroir', label: emotion.fr });
      playClap(); speak(`Bravo ! ${emotion.fr}`);
      message.replaceChildren(praise(`C’est la photo de « ${emotion.fr} » !`));
    } catch (e) { message.replaceChildren(h('p', { class: 'note' }, `${e.message} Touchez d’abord « Ouvrir le miroir ».`)); }
  };
  ctx.onCleanup(() => { if (stream) stream.getTracks().forEach((t) => t.stop()); });
  draw();
  return h('div', { class: 'stack' }, chips,
    h('div', { class: 'mirror-studio' }, model, camBox),
    h('div', { class: 'row center' }, btn('🪞 Ouvrir le miroir', startCam, 'ghost'), btn('📸 Prendre la photo', shoot, 'primary'),
      btn('↺ Revenir au dessin', async () => { if (hasPhoto(emotion.vkey)) await clearVisual(emotion.vkey); draw(); }, 'ghost')),
    message);
}

export function emotionStudio(ctx) {
  return h('div', { class: 'stack emotion-studio' },
    modeTabs([['👉 Montre l’émotion', receptive], ['🏠 Dans la vie', situations], ['🪞 Miroir magique', () => mirror(ctx)]]));
}

// ---------- 📸 Personnaliser avec nos vraies photos ----------
const uniqueByKey = (items) => [...new Map(items.map((i) => [keyFor(i), i])).values()];

function groups() {
  const family = [{ vkey: 'person:abir', label: firstName() }, ...people().map((p) => ({ vkey: p.vkey, label: p.name })),
    { vkey: 'person:mamie', label: 'Mamie' }, { vkey: 'person:papi', label: 'Papi' }];
  const routines = uniqueByKey(Object.values(SEQUENCES).flat().map(([emoji, label]) => ({ emoji, label })));
  return [
    { title: '😊 Les émotions', hint: `Mettez les vraies photos d’${firstName()}, de ${sisterName()}, de Papa ou de Maman.`, items: EMOTIONS.map((e) => ({ vkey: e.vkey, label: e.fr })) },
    { title: '👨‍👩‍👧‍👧 La famille et les proches', items: family },
    { title: '🍽️ Le repas', items: [{ vkey: 'meal:plat', emoji: '🍛', label: 'Mon plat' }, { vkey: 'obj:prise-tripode', emoji: '✏️', label: 'Prise du crayon' }] },
    { title: '🧼 Les étapes des routines', items: routines, arasaac: true },
    { title: '🏷️ Les objets à nommer', items: TACT_ITEMS.map((t) => ({ emoji: t.emoji, label: t.fr })), arasaac: true },
    { title: '🏃 Les verbes', items: VERBS.map((v) => ({ emoji: v.emoji, label: v.fr })), arasaac: true },
    { title: '🔗 Ce qui va ensemble (B.4, C.4)', items: uniqueByKey(PAIRS.flatMap((p) => [p.a, p.b]).map((x) => ({ emoji: x.emoji, label: x.fr }))), arasaac: true },
    { title: '🧺 Tri par fonction et par catégorie (B.5, B.6)', items: uniqueByKey([...FUNCTION_BASKETS, ...CATEGORY_BOXES].flatMap((g) => g.items).map((x) => ({ emoji: x.emoji, label: x.fr }))), arasaac: true },
    { title: '👉 Consignes et gestes (C.3, D.1)', items: uniqueByKey([...TWO_STEP_OBJECTS.map((o) => ({ emoji: o.emoji, label: o.fr.replace(/^(la|le) /, '') })), ...GESTURE_SEQUENCE.map((g) => ({ emoji: g.emoji, label: g.fr }))]), arasaac: true },
    { title: '🗣️ Mots à répéter (E.1)', items: ECHO_WORDS.map((w) => ({ emoji: w.emoji, label: w.fr })), arasaac: true },
    { title: '🎵 Comptines (H.2)', items: uniqueByKey(RHYMES.flatMap((r) => [{ vkey: `scene:${r.id}`, emoji: r.scene, label: r.sceneLabel }, { vkey: answerKey(r), emoji: r.emoji, label: r.end }])), arasaac: true },
    { title: '💬 Associations (H.3)', items: uniqueByKey(ASSOCIATIONS.flatMap((a) => [{ vkey: `scene:${a.id}`, emoji: a.scene, label: a.sceneLabel }, { vkey: answerKey(a), emoji: a.emoji, label: a.end }])), arasaac: true },
    { title: '🏠 Situations de vie (émotions)', items: SITUATIONS.map((s) => ({ vkey: `situation:${s.id}`, emoji: s.scene, label: s.label })), arasaac: true },
    { title: '🎁 Renforçateurs (A.2)', items: REINFORCERS.map((r) => ({ emoji: r.emoji, label: r.fr })), arasaac: true },
    { title: '🧩 Les objets de « Trouve le même »', hint: 'Photo du vrai objet de la maison (sa tasse, sa chaussure…).', items: B1_OBJECTS.map((o) => ({ vkey: o.a, label: o.fr })) },
  ];
}

export function photoGallery() {
  const allStatus = h('span', { class: 'note' });
  const fillAll = async (e) => {
    e.target.disabled = true;
    const items = uniqueByKey(groups().filter((g) => g.arasaac).flatMap((g) => g.items));
    allStatus.textContent = `Téléchargement… (${items.length} images à vérifier)`;
    const done = await fillWithArasaac(items, (n) => { allStatus.textContent = `${n} pictogramme(s) ajouté(s)…`; });
    allStatus.textContent = done ? `${done} pictogramme(s) ajouté(s). Ils marchent aussi sans internet.` : 'Aucune image ajoutée (déjà faites, ou pas d’internet).';
    e.target.disabled = false;
  };
  return h('div', { class: 'stack' },
    h('p', { class: 'note' }, 'Touchez une image pour la remplacer par une vraie photo (caméra ou galerie). Elle change partout : cartes, routines et exercices.'),
    h('div', { class: 'row' }, btn('🎨 Télécharger tous les pictogrammes ARASAAC manquants en 1 clic', fillAll, 'primary'), allStatus),
    groups().map((group) => {
      const status = h('span', { class: 'note' });
      return h('section', { class: 'card-box' }, h('h3', {}, group.title), group.hint ? h('p', { class: 'note' }, group.hint) : null,
        h('div', { class: 'gallery' }, group.items.map((item) => h('button', { type: 'button', class: 'gallery-tile', onclick: () => openPhotoPickerModal(keyFor(item), item.label) },
          renderVisual(item, { button: false }), h('span', {}, item.label)))),
        group.arasaac ? h('div', { class: 'row' }, btn('🎨 Mettre des pictogrammes ARASAAC ici', async (e) => {
          e.target.disabled = true;
          status.textContent = 'Téléchargement…';
          const done = await fillWithArasaac(group.items, (n) => { status.textContent = `${n} image(s) ajoutée(s)…`; });
          status.textContent = done ? `${done} pictogramme(s) ajouté(s). Ils marchent aussi sans internet.` : 'Aucune image ajoutée (pas d’internet ?).';
          e.target.disabled = false;
        }, 'ghost'), status) : null);
    }));
}
