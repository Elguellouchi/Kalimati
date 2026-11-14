// v7.1 : histoires sociales (inspirées de la méthode de Carol Gray) : une page à la fois, une image, une phrase simple et positive.
// Le parent remplace les images par ses vraies photos (visual_overrides « story:<id>:<page> ») et enregistre sa voix.
// Tout reste dans le téléphone (réglage « stories »).
import * as db from '../db.js';
import { h, btn, uid } from './util.js';
import { speak, playBlob, stopSpeaking } from '../speech.js';
import { playClap, canRecord, startRecording } from '../media.js';
import { renderVisual } from './visuals.js';
import { firstName } from './aba.js';

const STORIES_KEY = 'stories';
const P = (emoji, text, dr = '') => ({ emoji, text, dr, audio: null });

export const DEFAULT_STORIES = () => [
  { id: 'docteur', emoji: '🩺', title: 'Je vais chez le docteur', pages: [
    P('🚗', 'Aujourd’hui, je vais chez le docteur avec Papa ou Maman.', 'Lyoum ghadi nemchi l tbib.'),
    P('🪑', 'Dans la salle d’attente, j’attends sur une chaise. Je peux regarder un livre.', 'Ntsenna f l kursi.'),
    P('🩺', 'Le docteur écoute mon cœur. C’est froid, mais ça ne fait pas mal.', 'Tbib kaysme3 l9elbi.'),
    P('👄', 'Il regarde dans ma bouche et dans mes oreilles. J’ouvre grand la bouche.', 'N7el fommi.'),
    P('🙂', 'Le docteur m’aide à rester en bonne santé.', 'Tbib kay3awenni.'),
    P('🌟', 'C’est fini ! Je suis fière de moi.', 'Salina! Ana fer7ana.'),
  ] },
  { id: 'coiffeur', emoji: '💇‍♀️', title: 'Je vais chez le coiffeur', pages: [
    P('🏪', 'Je vais chez le coiffeur pour couper mes cheveux.', 'Ghadi n9ess cha3ri.'),
    P('🪑', 'Je m’assois sur le grand fauteuil.', 'Ngles f l kursi.'),
    P('✂️', 'Les ciseaux font un petit bruit. Ça ne fait pas mal.', 'L m9ess kaydir sout sghir.'),
    P('💨', 'Le séchoir souffle de l’air chaud. Je peux fermer les yeux.', 'Nsedd 3ayniya.'),
    P('🪞', 'Je regarde dans le miroir. Mes cheveux sont jolis !', 'Cha3ri zwin!'),
  ] },
  { id: 'courses', emoji: '🛒', title: 'On fait les courses', pages: [
    P('🛒', 'Nous allons au supermarché avec la liste.', 'Ghadi ntqdaw.'),
    P('🧍', 'Je reste à côté de Maman ou Papa et je tiens le chariot.', 'Nb9a 7da Mama.'),
    P('🔊', 'Il peut y avoir du bruit et du monde. Je peux mettre mon casque.', 'Ila kan sda3, nlbes l casque.'),
    P('🍎', 'Je peux choisir un fruit et le mettre dans le chariot.', 'Nkhtar fakya.'),
    P('💳', 'On attend à la caisse. Ensuite on rentre à la maison.', 'Ntsennaw w nrj3ou l dar.'),
  ] },
  { id: 'bruit', emoji: '🔊', title: 'Quand il y a un gros bruit', pages: [
    P('🔊', 'Parfois, il y a un gros bruit. Ça peut me faire peur.', 'Mrat kayn sda3 kbir.'),
    P('🎧', 'Je peux mettre mes mains sur mes oreilles ou mon casque.', 'N7et ydiya 3la wdniya.'),
    P('🫁', 'Je respire doucement : j’inspire, je souffle.', 'Ntnffes b chwiya.'),
    P('🤝', 'Je peux dire « Aide-moi » ou « J’ai peur ».', 'Ngoul 3awnni.'),
    P('🙂', 'Le bruit s’arrête. Je suis en sécurité.', 'Sda3 sala. Ana mzyana.'),
  ] },
];

async function loadStories() {
  const saved = await db.getSetting(STORIES_KEY);
  return Array.isArray(saved) && saved.length ? saved : DEFAULT_STORIES();
}
const saveStories = (stories) => db.setSetting(STORIES_KEY, stories);
const pageVisual = (story, i, page, button = true) => renderVisual({ vkey: `story:${story.id}:${i}`, emoji: page.emoji, label: page.text }, { button });

function readPage(page, lang) {
  stopSpeaking();
  if (page.audio) return playBlob(page.audio);
  return speak(lang === 'dr' && page.dr ? page.dr : page.text);
}

// ctx : { isParent(), lang(), onCleanup(fn) }
export function storiesView(ctx) {
  const root = h('div', { class: 'stories' }, h('p', { class: 'note' }, 'Chargement…'));
  let stories = [];
  const persist = async (next) => { stories = next; await saveStories(stories); };
  ctx.onCleanup(stopSpeaking);

  const list = () => root.replaceChildren(
    h('p', { class: 'note' }, `Des petites histoires pour préparer ${firstName()} à ce qui va se passer.`),
    h('div', { class: 'section-grid' }, stories.map((story) => h('button', { type: 'button', class: 'section-tile big', onclick: () => reader(story, 0) },
      h('span', { class: 'emoji' }, story.emoji), h('span', {}, story.title)))),
    ctx.isParent() ? h('div', { class: 'row' },
      btn('➕ Nouvelle histoire', async () => {
        const story = { id: uid('story'), emoji: '📖', title: 'Mon histoire', pages: [P('⭐', 'Écrivez ici la première phrase.')] };
        await persist([...stories, story]);
        editor(story);
      }, 'primary'),
      btn('↺ Remettre les histoires d’origine', async () => { if (window.confirm('Remettre les 4 histoires d’origine ? Vos photos restent.')) { await persist(DEFAULT_STORIES()); list(); } }, 'ghost tiny')) : null);

  function reader(story, index) {
    const page = story.pages[index];
    const last = index === story.pages.length - 1;
    const go = (i) => { reader(story, i); readPage(story.pages[i], ctx.lang()); };
    root.replaceChildren(
      h('div', { class: 'row' }, btn('← Toutes les histoires', list, 'ghost'), ctx.isParent() ? btn('✏️ Modifier', () => editor(story), 'ghost') : null),
      h('h3', {}, `${story.emoji} ${story.title}`),
      h('button', { type: 'button', class: 'big-card story-page', onclick: () => readPage(page, ctx.lang()) }, pageVisual(story, index, page),
        h('span', { class: 'label' }, page.text), ctx.lang() === 'dr' && page.dr ? h('small', {}, page.dr) : null),
      h('div', { class: 'order-slots' }, story.pages.map((_, j) => h('span', { class: `order-slot${j <= index ? ' on' : ''}` }, String(j + 1)))),
      h('div', { class: 'row center' },
        index > 0 ? btn('◀', () => go(index - 1), 'ghost big-arrow') : null,
        last ? btn('🌟 Fini !', () => { playClap(); speak('Bravo ! Tu as lu toute l’histoire.'); list(); }, 'primary') : btn('▶ Page suivante', () => go(index + 1), 'primary')));
  }

  function editor(story) {
    if (!ctx.isParent()) { reader(story, 0); return; }
    const update = async (patch) => {
      const next = { ...story, ...patch };
      await persist(stories.map((s) => (s.id === story.id ? next : s)));
      editor(next);
    };
    const setPage = (i, patch) => update({ pages: story.pages.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
    const input = (value, onchange, attrs = {}) => h('input', { value: value || '', ...attrs, onchange: (e) => onchange(e.target.value) });
    root.replaceChildren(
      h('div', { class: 'row' }, btn('✔ Terminé', () => reader(story, 0), 'primary'),
        btn('🗑 Supprimer l’histoire', async () => { if (window.confirm(`Supprimer « ${story.title} » ?`)) { await persist(stories.filter((s) => s.id !== story.id)); list(); } }, 'ghost tiny')),
      h('div', { class: 'ed-grid' }, h('label', { class: 'ed-field' }, h('span', {}, 'Titre'), input(story.title, (v) => update({ title: v }))),
        h('label', { class: 'ed-field' }, h('span', {}, 'Image du titre'), input(story.emoji, (v) => update({ emoji: v }), { maxlength: 8 }))),
      h('p', { class: 'note' }, '📷 sur l’image : mettre une vraie photo (le cabinet du docteur, le coiffeur du quartier…). Phrases courtes, positives, au « je ».'),
      h('div', { class: 'ed-steps' }, story.pages.map((page, i) => h('div', { class: 'ed-step' },
        h('div', { class: 'ed-step-head' }, h('span', { class: 'ed-num' }, String(i + 1)), pageVisual(story, i, page),
          h('div', { class: 'row' },
            btn('↑', () => { if (i) { const p = [...story.pages]; [p[i - 1], p[i]] = [p[i], p[i - 1]]; update({ pages: p }); } }, 'ghost tiny'),
            btn('🗑', () => { if (story.pages.length > 1) update({ pages: story.pages.filter((_, j) => j !== i) }); }, 'ghost tiny'))),
        h('div', { class: 'ed-grid' },
          h('label', { class: 'ed-field' }, h('span', {}, 'Image'), input(page.emoji, (v) => setPage(i, { emoji: v }), { maxlength: 8 })),
          h('label', { class: 'ed-field' }, h('span', {}, 'Phrase (français)'), input(page.text, (v) => setPage(i, { text: v }))),
          h('label', { class: 'ed-field' }, h('span', {}, 'Darija'), input(page.dr, (v) => setPage(i, { dr: v })))),
        voiceButton(page, (audio) => setPage(i, { audio }))))),
      btn('➕ Ajouter une page', () => update({ pages: [...story.pages, P('⭐', 'Nouvelle phrase.')] }), 'primary'));
  }

  function voiceButton(page, save) {
    if (!canRecord()) return h('span', { class: 'note' }, 'Micro indisponible');
    let stop = null;
    const rec = btn(page.audio ? '🎙️ Réenregistrer ma voix' : '🎙️ Enregistrer ma voix', async () => {
      if (stop) { const blob = await stop(); stop = null; save(blob); return; }
      try { stop = await startRecording(); rec.textContent = '⏹ Arrêter'; rec.classList.add('recording'); } catch { rec.textContent = 'Micro refusé'; }
    }, 'ghost tiny');
    return h('div', { class: 'row' }, rec, page.audio ? btn('▶', () => playBlob(page.audio), 'ghost tiny') : null, page.audio ? btn('✖', () => save(null), 'ghost tiny') : null);
  }

  loadStories().then((s) => { stories = s; list(); }).catch((e) => root.replaceChildren(h('p', { class: 'note' }, `Histoires indisponibles : ${e.message}`)));
  return root;
}
