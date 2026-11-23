// Outils adulte de Parler : lieux, scènes, vidéos modèles, porte-clés, texte en images, modes
// Code déplacé tel quel depuis app.js (v10.42, Lot 4.1) : aucun comportement ne change.
// Les fonctions encore dans app.js sont lues au moment de l’appel (app.<nom>).
import * as db from '../db.js';
import { CATEGORIES } from '../data.js';
import { resizePhoto } from '../media.js';
import { sayCard, speak, stopSpeaking, unlockAudio } from '../speech.js';
import { firstName } from './aba.js';
import { MOTOR_STAGES, applyProgressiveStage } from './core-vocabulary-plan.js';
import { LANGS, categoryName, isAmazighLang } from './languages.js';
import { VIDEO_SETTING_KEY, VIDEO_WHO, cleanVideos, newVideoId, videoBlobKey, videoProblem } from './model-videos.js';
import { PLACES, PLACE_SETTING_KEY, boardItems, cleanCustomBoards, newBoardId, passingCard } from './place-boards.js';
import { EXPLORE_SCENES, GRID_SIZES, SCENE_SETTING_KEY, cellBox, cleanScenes, newSceneId, sceneImageKey } from './scenes.js';
import { TALK_MODES, TALK_MODE_KEY } from './talk-modes.js';
import { bindTap } from './tap-engine.js';
import { buildIndex, extraConcepts, matchPictos } from './text-to-picto.js';
import { saveTwin, suggestPartner } from './twin-language.js';
import { btn, h } from './util.js';

export function createTalkTools(app) {
  const cardElement = (...args) => app.cardElement(...args);
  const cardVisual = (...args) => app.cardVisual(...args);
  const label = (...args) => app.label(...args);
  const onCardTap = (...args) => app.onCardTap(...args);
  const renderAll = (...args) => app.renderAll(...args);
  const renderMorphSlot = (...args) => app.renderMorphSlot(...args);
  const renderView = (...args) => app.renderView(...args);
  const saveCards = (...args) => app.saveCards(...args);
  const state = app.state;
  // v10.6 (P3.f) : vocabulaire de base dévoilé par paliers. Seulement sur demande de l'adulte.
  // Les cartes gardent leur place ; on masque ou montre seulement les 21 mots du plan.
  let motorPlanNote = '';
  // v10.32 (pépite DictaPicto) : l'adulte écrit une phrase, l'enfant la voit en images et l'entend
  // avec les voix des cartes (fichiers sons : marche aussi quand l'iPhone est en mode silencieux).
  // Rien n'est envoyé ni gardé : la phrase reste seulement à l'écran.
  let pictoDraft = '';
  // v10.35 (pépite « Porte-clés », Tawasol) : mini-cartes de 4 cm à imprimer, plastifier et accrocher
  // à un anneau (cartable, sac, ceinture). Le rond en haut à gauche indique où percer.
  const KEYRING_CORE = ['Je veux', 'Aide-moi', 'Encore', 'Fini', 'Oui', 'Non', 'Attends', "J'ai mal", 'Toilettes', 'Eau', 'Manger', 'Calme'];
  function keyringItems(setId) {
    const usable = state.cards.filter((c) => !c.hidden);
    const toCards = (items) => items.filter((i) => i.card).map((i) => (i.card.extra ? passingCard(i) : i.card));
    if (setId === 'core') return toCards(boardItems({ words: KEYRING_CORE }, usable, (c) => [label(c), c.fr]));
    if (setId.startsWith('cat:')) return usable.filter((c) => c.cat === setId.slice(4));
    const board = allPlaceBoards().find((b) => b.id === setId);
    return board ? toCards(boardItems(board, usable, (c) => [label(c), c.fr, c.dr])) : [];
  }
  function printKeyring(setId, title) {
    const cards = keyringItems(setId).slice(0, 24);
    if (!cards.length) return;
    const name = /^(mon enfant|l’enfant|l'enfant)$/i.test(String(firstName() || '').trim()) ? '' : firstName();
    const badge = h('div', { class: 'keyring-card keyring-badge' }, h('span', { class: 'keyring-hole', 'aria-hidden': 'true' }),
      h('strong', {}, name ? `Je m’appelle ${name}` : 'Bonjour'), h('small', {}, 'Je parle avec des images. Montrez-moi les cartes, attendez ma réponse.'));
    const area = h('div', { class: 'print-area' },
      h('div', { class: 'print-sheet keyring-sheet' },
        h('h1', {}, `Porte-clés de communication · ${title}`),
        h('p', { class: 'note' }, 'Découpez, plastifiez, percez le rond et accrochez à un anneau.'),
        h('div', { class: 'keyring-grid' }, badge, ...cards.map((c) => h('div', { class: 'keyring-card' }, h('span', { class: 'keyring-hole', 'aria-hidden': 'true' }),
          c.extra ? h('span', { class: 'keyring-emoji' }, c.emoji) : cardVisual(c),
          h('strong', {}, label(c, 'fr')), c.dr && !c.extra ? h('small', {}, c.dr) : null)))));
    document.body.append(area);
    const cleanup = () => { area.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 300);
  }
  function keyringBox() {
    const options = [['core', 'Mots essentiels (12)'], ...CATEGORIES.map((c) => [`cat:${c.id}`, `Dossier : ${categoryName(c, 'fr')}`]),
      ...allPlaceBoards().map((b) => [b.id, `Lieu : ${b.title}`])];
    const pick = h('select', { 'aria-label': 'Cartes du porte-clés' }, options.map(([v, t]) => h('option', { value: v }, t)));
    return h('details', { class: 'card-box keyring-box' }, h('summary', {}, '🔑 Porte-clés à imprimer'),
      h('p', { class: 'note' }, 'Des cartes de 4 cm avec un rond à percer, pour sortir sans téléphone. Choisissez puis « Imprimer » (ou « Enregistrer en PDF »).'),
      h('div', { class: 'row wrap' }, pick, btn('🖨️ Imprimer', () => printKeyring(pick.value, pick.selectedOptions[0].textContent), 'primary tiny')));
  }

  // v10.33 (pépites « Pages par lieu » et « Tableau express ») : le choix d'un lieu remplit la grille avec
  // les mots de ce lieu. La ligne de mots de base reste en haut ; « ↩ » rend la grille habituelle.
  const placeBtn = (icon, name, onclick) => h('button', { type: 'button', class: 'btn ghost place-btn', 'aria-label': name, title: name, onclick }, icon);
  const allPlaceBoards = () => [...PLACES, ...state.placeBoards];
  function placeBoardView(grid, tappable) {
    grid.classList.add('place-grid');
    if (state.place === 'pick') {
      grid.style.setProperty('--cat-board', '#5E60CE');
      for (const board of allPlaceBoards()) {
        grid.append(h('button', { type: 'button', class: 'card place-tile', 'aria-label': board.title,
          onclick: () => { state.place = board.id; stopSpeaking(); speak(board.title, { lang: 'fr' }); renderView(); } },
        h('span', { class: 'place-emoji', 'aria-hidden': 'true' }, board.emoji), h('span', { class: 'label' }, board.title)));
      }
      // v10.34 : les scènes (photo du parent, puis grandes scènes dessinées) se choisissent au même endroit.
      for (const scene of state.scenes) {
        const tile = h('button', { type: 'button', class: 'card place-tile scene-tile', 'aria-label': scene.title,
          onclick: () => { state.place = `scene:${scene.id}`; renderView(); } },
        h('span', { class: 'place-emoji', 'aria-hidden': 'true' }, '🖼️'), h('span', { class: 'label' }, scene.title));
        sceneImageUrl(scene.id).then((url) => { if (url) tile.querySelector('.place-emoji').replaceWith(h('img', { class: 'scene-thumb', src: url, alt: '' })); });
        grid.append(tile);
      }
      // v10.39 : vidéos modèles filmées par la famille.
      for (const v of state.videos) {
        grid.append(h('button', { type: 'button', class: 'card place-tile video-tile', 'aria-label': `Vidéo : ${v.title}`,
          onclick: () => { state.place = `video:${v.id}`; renderView(); } },
        h('span', { class: 'place-emoji', 'aria-hidden': 'true' }, '🎬'), h('span', { class: 'label' }, v.title)));
      }
      for (const scene of EXPLORE_SCENES) {
        grid.append(h('button', { type: 'button', class: 'card place-tile explore-tile', 'aria-label': scene.title,
          onclick: () => { state.place = `explore:${scene.id}`; renderView(); } },
        h('span', { class: 'place-emoji', 'aria-hidden': 'true' }, scene.emoji), h('span', { class: 'label' }, scene.title)));
      }
      return h('div', { class: 'place-head' }, h('strong', {}, '📍 Où allons-nous ?'),
        placeBtn('↩', 'Revenir à mes mots', () => { state.place = null; renderView(); }));
    }
    if (String(state.place).startsWith('explore:') || String(state.place).startsWith('scene:')) return sceneView(grid);
    if (String(state.place).startsWith('video:')) return videoView(grid, tappable);
    if (state.place === 'intent' && state.intent) {
      state.intent.cards.forEach((card) => grid.append(tappable(card)));
      return h('div', { class: 'place-head' }, h('strong', {}, `💡 ${state.intent.title}`),
        placeBtn('↩', 'Revenir à mes mots', () => { state.place = null; state.intent = null; renderView(); }));
    }
    const board = allPlaceBoards().find((b) => b.id === state.place);
    if (!board) { state.place = null; return null; }
    const items = boardItems(board, state.cards.filter((c) => !c.hidden), (c) => [label(c), c.fr, c.dr, c.ar]);
    for (const item of items) {
      if (!item.card) { grid.append(h('span', { class: 'card place-word', role: 'note' }, h('span', { class: 'label' }, item.text))); continue; }
      grid.append(tappable(item.card.extra ? passingCard(item) : item.card));
    }
    return h('div', { class: 'place-head' }, h('strong', {}, `${board.emoji} ${board.title}`),
      placeBtn('📍', 'Choisir un autre lieu', () => { state.place = 'pick'; renderView(); }),
      placeBtn('↩', 'Revenir à mes mots', () => { state.place = null; renderView(); }));
  }

  // Le parent écrit un tableau express : un nom et des mots (virgules ou retours à la ligne).
  let placeEditorMsg = '';
  function placeEditorBox() {
    const title = h('input', { type: 'text', maxlength: 40, placeholder: 'Ex. : Chez Mamie', 'aria-label': 'Nom du tableau' });
    const emoji = h('select', { 'aria-label': 'Dessin du tableau' }, ['📌', '🏠', '👵', '🏥', '🏖️', '✈️', '🎂', '🛁', '🚌', '🍽️'].map((e) => h('option', { value: e }, e)));
    const words = h('textarea', { rows: 3, class: 'picto-input', placeholder: 'Ex. : Bonjour, Mamie, gâteau, jouer, câlin, au revoir', 'aria-label': 'Mots du tableau' });
    const preview = h('p', { class: 'note', 'aria-live': 'polite' }, placeEditorMsg);
    placeEditorMsg = '';
    const count = () => {
      const items = boardItems({ text: words.value }, state.cards, (c) => [label(c), c.fr, c.dr, c.ar]);
      const ok = items.filter((i) => i.card).length;
      preview.textContent = words.value.trim() ? `${ok} image${ok > 1 ? 's' : ''} trouvée${ok > 1 ? 's' : ''}${items.length > ok ? ` · sans image : ${items.filter((i) => !i.card).map((i) => i.text).join(', ')}` : ''}.` : '';
    };
    words.addEventListener('input', count);
    const save = async (list, msg) => {
      state.placeBoards = cleanCustomBoards(list);
      try { await db.setSetting(PLACE_SETTING_KEY, state.placeBoards); } catch (err) { console.error('[Kalimati] tableau express non enregistré', err); }
      placeEditorMsg = msg;
      renderView();
    };
    const add = () => {
      if (!title.value.trim() || !words.value.trim()) { preview.textContent = 'Écrivez un nom et au moins un mot.'; return; }
      save([...state.placeBoards, { id: newBoardId(), title: title.value, emoji: emoji.value, text: words.value }], 'Tableau enregistré ✔ (onglet 📍 Lieux)');
    };
    const list = state.placeBoards.map((b) => {
      let armed = false;
      const del = btn('🗑️', () => {
        if (!armed) { armed = true; del.textContent = 'Supprimer ?'; setTimeout(() => { armed = false; del.textContent = '🗑️'; }, 3000); return; }
        save(state.placeBoards.filter((x) => x.id !== b.id), 'Tableau supprimé');
      }, 'ghost tiny');
      del.setAttribute('aria-label', `Supprimer ${b.title}`);
      return h('li', { class: 'row' }, h('span', {}, `${b.emoji} ${b.title}`), del);
    });
    return h('details', { class: 'card-box place-editor', open: preview.textContent ? true : null }, h('summary', {}, '📍 Tableau express (un lieu, une sortie)'),
      h('p', { class: 'note' }, `Il s’ajoute à l’onglet 📍 Lieux de l’enfant, à côté des ${PLACES.length} lieux prêts (dentiste, médecin, école…). Les cartes de base ne bougent pas.`),
      h('div', { class: 'row wrap' }, emoji, title), words, preview, btn('Enregistrer le tableau', add, 'primary tiny'),
      list.length ? h('ul', { class: 'place-list' }, list) : null);
  }

  // ---------- v10.34 : scènes (photo du parent et grandes scènes dessinées) ----------
  const sceneUrls = new Map();
  async function sceneImageUrl(id) {
    if (sceneUrls.has(id)) return sceneUrls.get(id);
    const blob = await db.getSetting(sceneImageKey(id)).catch(() => null);
    if (!(blob instanceof Blob)) return null;
    const url = URL.createObjectURL(blob);
    sceneUrls.set(id, url);
    return url;
  }
  let sceneIndexCache = null;
  function sceneWordCard(word) {
    if (!sceneIndexCache || sceneIndexCache.cards !== state.cards || sceneIndexCache.lang !== state.lang) {
      sceneIndexCache = { cards: state.cards, lang: state.lang,
        index: buildIndex([...state.cards.filter((c) => !c.hidden), ...extraConcepts()], (c) => (c.extra ? [c.fr, ...c.alt] : [label(c), c.fr, c.dr, c.ar])) };
    }
    const item = matchPictos(word, sceneIndexCache.index, { skipSmallWords: false }).find((it) => it.card);
    if (!item) return null;
    return item.card.extra ? passingCard(item) : item.card;
  }
  // Un objet de scène : le dessin de la carte (ou son petit dessin) et son mot. Toucher = parler + phrase.
  function sceneTarget(card, cls, style) {
    const visual = card.extra ? h('span', { class: 'scene-emoji', 'aria-hidden': 'true' }, card.emoji) : cardVisual(card);
    const el = h('button', { type: 'button', class: `scene-target ${cls}`, style, 'aria-label': label(card) }, visual, h('span', { class: 'scene-label' }, label(card)));
    return bindTap(el, () => onCardTap(card, el), { key: `scene:${card.id}`, skip: () => state.parent });
  }
  function sceneView(grid) {
    grid.classList.add('scene-host');
    const [kind, id] = String(state.place).split(':');
    const back = h('div', { class: 'place-head' }, h('strong', {}, ''),
      placeBtn('📍', 'Choisir un autre lieu', () => { state.place = 'pick'; renderView(); }),
      placeBtn('↩', 'Revenir à mes mots', () => { state.place = null; renderView(); }));
    if (kind === 'explore') {
      const scene = EXPLORE_SCENES.find((s) => s.id === id);
      if (!scene) { state.place = 'pick'; return null; }
      back.firstChild.replaceWith(h('strong', {}, `${scene.emoji} ${scene.title}`));
      const stage = h('div', { class: `explore-stage bg-${scene.bg}`, role: 'group', 'aria-label': scene.title });
      for (const item of scene.items) {
        const card = sceneWordCard(item.word);
        if (card) stage.append(sceneTarget(card, 'explore-item', { left: `${item.x}%`, top: `${item.y}%` }));
      }
      grid.append(stage);
      return back;
    }
    const scene = state.scenes.find((s) => s.id === id);
    if (!scene) { state.place = 'pick'; return null; }
    back.firstChild.replaceWith(h('strong', {}, `🖼️ ${scene.title}`));
    const photo = h('div', { class: 'scene-photo', role: 'group', 'aria-label': scene.title });
    grid.append(photo);
    sceneImageUrl(scene.id).then((url) => {
      if (!url) { photo.append(h('p', { class: 'note' }, 'La photo de cette scène n’est pas dans ce téléphone.')); return; }
      const img = h('img', { src: url, alt: '' });
      img.onload = () => {
        // La photo garde ses proportions : le quadrillage est posé exactement dessus.
        const host = grid.getBoundingClientRect();
        const maxW = Math.max(120, host.width - 16); const maxH = Math.max(120, host.height - 16);
        const k = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
        photo.style.width = `${Math.round(img.naturalWidth * k)}px`;
        photo.style.height = `${Math.round(img.naturalHeight * k)}px`;
      };
      photo.append(img);
      for (const [i, word] of Object.entries(scene.cells)) {
        const card = sceneWordCard(word);
        if (!card) continue;
        const b = cellBox(scene.size, Number(i));
        photo.append(sceneTarget(card, 'photo-cell', { left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` }));
      }
    });
    return back;
  }

  // Le parent prépare une scène : une photo, un quadrillage, un mot par case utile.
  let sceneEditorMsg = '';
  function sceneEditorBox() {
    let photoBlob = null; let photoUrl = null; let selected = -1;
    const cells = {};
    const title = h('input', { type: 'text', maxlength: 40, placeholder: 'Ex. : Notre cuisine', 'aria-label': 'Nom de la scène' });
    const size = h('select', { 'aria-label': 'Nombre de cases' }, Object.keys(GRID_SIZES).map((n) => h('option', { value: n, selected: n === '9' ? 'selected' : null }, `${n} cases`)));
    const file = h('input', { type: 'file', accept: 'image/*', 'aria-label': 'Choisir ou prendre la photo' });
    const word = h('input', { type: 'text', maxlength: 40, placeholder: 'Mot de la case', 'aria-label': 'Mot de la case choisie', disabled: true });
    const msg = h('p', { class: 'note', 'aria-live': 'polite' }, sceneEditorMsg || 'Choisissez une photo, puis touchez une case et écrivez son mot.');
    sceneEditorMsg = '';
    const stage = h('div', { class: 'scene-photo editor', hidden: true });
    const draw = () => {
      stage.replaceChildren(...(photoUrl ? [h('img', { src: photoUrl, alt: '' })] : []));
      const n = Number(size.value);
      for (let i = 0; i < n; i += 1) {
        const b = cellBox(n, i);
        stage.append(h('button', { type: 'button', class: `scene-edit-cell${i === selected ? ' selected' : ''}${cells[i] ? ' filled' : ''}`,
          style: { left: `${b.left}%`, top: `${b.top}%`, width: `${b.width}%`, height: `${b.height}%` }, 'aria-label': `Case ${i + 1}${cells[i] ? ` : ${cells[i]}` : ''}`,
          onclick: () => { selected = i; word.disabled = false; word.value = cells[i] || ''; draw(); word.focus(); } }, cells[i] || String(i + 1)));
      }
    };
    file.onchange = async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      try { photoBlob = await resizePhoto(f, 1280); } catch { msg.textContent = 'Photo illisible. Essayez une autre photo.'; return; }
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      photoUrl = URL.createObjectURL(photoBlob);
      stage.hidden = false; draw();
    };
    size.onchange = () => { for (const k of Object.keys(cells)) if (Number(k) >= Number(size.value)) delete cells[k]; selected = -1; draw(); };
    const putWord = () => {
      if (selected < 0) return;
      const w = word.value.trim();
      if (w) {
        const card = sceneWordCard(w);
        msg.textContent = card ? `Case ${selected + 1} : « ${w} » ✔` : `« ${w} » n’a pas encore d’image : la case reste vide.`;
        if (card) cells[selected] = w; else delete cells[selected];
      } else delete cells[selected];
      draw();
    };
    word.addEventListener('keydown', (e) => { if (e.key === 'Enter') putWord(); });
    const save = async () => {
      if (!photoBlob || !title.value.trim() || !Object.keys(cells).length) { msg.textContent = 'Il faut une photo, un nom et au moins une case avec un mot.'; return; }
      const id = newSceneId();
      try {
        await db.setSetting(sceneImageKey(id), photoBlob);
        state.scenes = cleanScenes([...state.scenes, { id, title: title.value, size: Number(size.value), cells }]);
        await db.setSetting(SCENE_SETTING_KEY, state.scenes);
        sceneEditorMsg = 'Scène enregistrée ✔ (onglet 📍 Lieux)';
      } catch (err) { console.error('[Kalimati] scène non enregistrée', err); sceneEditorMsg = 'La scène n’a pas pu être enregistrée.'; }
      renderView();
    };
    const list = state.scenes.map((sc) => {
      let armed = false;
      const del = btn('🗑️', async () => {
        if (!armed) { armed = true; del.textContent = 'Supprimer ?'; setTimeout(() => { armed = false; del.textContent = '🗑️'; }, 3000); return; }
        state.scenes = state.scenes.filter((x) => x.id !== sc.id);
        try { await db.setSetting(SCENE_SETTING_KEY, state.scenes); await db.setSetting(sceneImageKey(sc.id), null); } catch (err) { console.error('[Kalimati] scène non supprimée', err); }
        sceneEditorMsg = 'Scène supprimée'; renderView();
      }, 'ghost tiny');
      del.setAttribute('aria-label', `Supprimer ${sc.title}`);
      return h('li', { class: 'row' }, h('span', {}, `🖼️ ${sc.title} (${sc.size} cases)`), del);
    });
    return h('details', { class: 'card-box scene-editor', open: sceneEditorMsg || msg.textContent.includes('✔') ? true : null }, h('summary', {}, '🖼️ Scène sur une vraie photo'),
      h('p', { class: 'note' }, 'La photo reste dans ce téléphone : elle ne part ni dans la sauvegarde ni dans la synchro.'),
      h('div', { class: 'row wrap' }, title, size), file, stage,
      h('div', { class: 'row wrap' }, word, btn('Mettre ce mot', putWord, 'ghost tiny')), msg,
      btn('Enregistrer la scène', save, 'primary tiny'),
      list.length ? h('ul', { class: 'place-list' }, list) : null);
  }

  // v10.39 (pépite « Vidéos d'autres enfants », version vie privée) : la famille filme le modèle.
  // La vidéo reste dans ce téléphone (base locale) : jamais dans la sauvegarde, la synchro ou le code.
  const videoUrls = new Map();
  async function videoUrl(id) {
    if (videoUrls.has(id)) return videoUrls.get(id);
    const blob = await db.getSetting(videoBlobKey(id)).catch(() => null);
    if (!(blob instanceof Blob)) return null;
    const url = URL.createObjectURL(blob);
    videoUrls.set(id, url);
    return url;
  }
  function videoView(grid, tappable) {
    const id = String(state.place).slice(6);
    const v = state.videos.find((x) => x.id === id);
    if (!v) { state.place = 'pick'; return null; }
    grid.classList.add('video-host');
    const player = h('video', { class: 'model-video', controls: 'controls', playsinline: 'playsinline', preload: 'metadata', 'aria-label': v.title });
    const box = h('div', { class: 'model-video-box' }, player);
    grid.append(box);
    videoUrl(v.id).then((url) => {
      if (!url) { box.replaceChildren(h('p', { class: 'note' }, 'Cette vidéo n’est pas dans ce téléphone.')); return; }
      player.src = url;
      player.play().catch(() => {});
    });
    // La carte liée et « Revoir » passent au-dessus de la vidéo : visibles même sur un petit écran.
    const card = v.word ? sceneWordCard(v.word) : null;
    box.prepend(h('div', { class: 'model-video-card' }, card ? h('span', { class: 'note' }, 'À toi :') : null, card ? tappable(card) : null,
      btn('🔁 Revoir', () => { player.currentTime = 0; player.play().catch(() => {}); }, 'ghost')));
    return h('div', { class: 'place-head' }, h('strong', {}, `🎬 ${v.title}`),
      placeBtn('📍', 'Choisir un autre lieu', () => { player.pause(); state.place = 'pick'; renderView(); }),
      placeBtn('↩', 'Revenir à mes mots', () => { player.pause(); state.place = null; renderView(); }));
  }
  let videoEditorMsg = '';
  function videoEditorBox() {
    const title = h('input', { type: 'text', maxlength: 40, placeholder: 'Ex. : Se laver les mains', 'aria-label': 'Nom de la vidéo' });
    const word = h('input', { type: 'text', maxlength: 30, placeholder: 'Carte liée (facultatif), ex. : Laver', 'aria-label': 'Carte liée à la vidéo' });
    const who = h('select', { 'aria-label': 'Qui est filmé' }, VIDEO_WHO.map(([k, t]) => h('option', { value: k }, t)));
    const file = h('input', { type: 'file', accept: 'video/*', 'aria-label': 'Filmer ou choisir une vidéo' });
    const msg = h('p', { class: 'note', 'aria-live': 'polite' }, videoEditorMsg);
    videoEditorMsg = '';
    const save = async () => {
      const f = file.files && file.files[0];
      const problem = !title.value.trim() ? 'Écrivez un nom.' : videoProblem(f);
      if (problem) { msg.textContent = problem; return; }
      if (state.videos.length >= 20) { msg.textContent = 'Déjà 20 vidéos : supprimez-en une d’abord.'; return; }
      if (word.value.trim() && !sceneWordCard(word.value.trim())) { msg.textContent = `« ${word.value.trim()} » n’a pas d’image : la vidéo sera enregistrée sans carte.`; word.value = ''; }
      const id = newVideoId();
      msg.textContent = 'Enregistrement…';
      try {
        await db.setSetting(videoBlobKey(id), f);
        state.videos = cleanVideos([...state.videos, { id, title: title.value, word: word.value, who: who.value }]);
        await db.setSetting(VIDEO_SETTING_KEY, state.videos);
        videoEditorMsg = 'Vidéo enregistrée ✔ (onglet 📍 Lieux)';
      } catch (err) { console.error('[Kalimati] vidéo non enregistrée', err); videoEditorMsg = 'La vidéo n’a pas pu être enregistrée (place du téléphone ?).'; }
      renderView();
    };
    const list = state.videos.map((v) => {
      let armed = false;
      const del = btn('🗑️', async () => {
        if (!armed) { armed = true; del.textContent = 'Supprimer ?'; setTimeout(() => { armed = false; del.textContent = '🗑️'; }, 3000); return; }
        state.videos = state.videos.filter((x) => x.id !== v.id);
        try { await db.setSetting(VIDEO_SETTING_KEY, state.videos); await db.setSetting(videoBlobKey(v.id), null); } catch (err) { console.error('[Kalimati] vidéo non supprimée', err); }
        if (videoUrls.has(v.id)) { URL.revokeObjectURL(videoUrls.get(v.id)); videoUrls.delete(v.id); }
        videoEditorMsg = 'Vidéo supprimée'; renderView();
      }, 'ghost tiny');
      del.setAttribute('aria-label', `Supprimer ${v.title}`);
      return h('li', { class: 'row' }, h('span', {}, `🎬 ${v.title}${v.word ? ` → ${v.word}` : ''}`), del);
    });
    return h('details', { class: 'card-box video-editor', open: msg.textContent ? true : null }, h('summary', {}, '🎬 Vidéo modèle (un proche montre l’action)'),
      h('p', { class: 'note' }, 'Filmez un frère, une sœur, un cousin ou vous-même qui fait l’action. La vidéo reste dans ce téléphone : ni sauvegarde, ni synchro, ni envoi.'),
      h('div', { class: 'row wrap' }, title, who), word, file, msg,
      btn('Enregistrer la vidéo', save, 'primary tiny'),
      list.length ? h('ul', { class: 'place-list' }, list) : null);
  }

  // v10.37 : choix Simple / Aide / Coach (gardé dans le téléphone, et dans la sauvegarde).
  function talkModeBox() {
    return h('div', { class: 'talk-mode-box', role: 'radiogroup', 'aria-label': 'Façon de parler' },
      h('strong', {}, 'Façon de parler : '),
      TALK_MODES.map((m) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(state.talkMode === m.id), class: `talk-mode-btn${state.talkMode === m.id ? ' on' : ''}`, title: m.desc,
        onclick: async () => {
          state.talkMode = m.id;
          try { await db.setSetting(TALK_MODE_KEY, m.id); } catch (err) { console.error('[Kalimati] mode non enregistré', err); }
          renderMorphSlot(); renderView();
        } }, `${m.emoji} ${m.title}`)),
      h('p', { class: 'note' }, (TALK_MODES.find((m) => m.id === state.talkMode) || TALK_MODES[2]).desc));
  }

  function textToPictoBox() {
    const input = h('textarea', { rows: 2, class: 'picto-input', placeholder: 'Ex. : On va à l’école en voiture', 'aria-label': 'Phrase à montrer en images', value: pictoDraft });
    input.value = pictoDraft;
    const line = h('div', { class: 'picto-line', 'aria-live': 'polite' });
    let items = [];
    let playing = 0;
    // Carte de Kalimati : sa voix (parent, livrée ou téléphone). Mot de secours : le mot écrit, dit par la voix du téléphone.
    const sayPicto = (item) => (item.card.extra ? speak(item.text, { lang: state.lang === 'dr' || isAmazighLang(state.lang) ? 'fr' : state.lang }) : sayCard(item.card, state.lang));
    const pictoEl = (item, big) => {
      if (!item.card) return h('span', { class: `picto-word${big ? ' big' : ''}` }, item.text);
      if (item.card.extra) {
        return h('button', { type: 'button', class: `card small picto-card picto-extra${big ? ' big' : ''}`, 'aria-label': item.text, onclick: () => { unlockAudio(); stopSpeaking(); sayPicto(item); } },
          h('span', { class: 'picto-emoji', 'aria-hidden': 'true' }, item.card.emoji), h('span', { class: 'label' }, item.text));
      }
      const el = cardElement(item.card, { small: !big, className: `picto-card${big ? ' big' : ''}` });
      el.onclick = () => { unlockAudio(); stopSpeaking(); sayCard(item.card, state.lang); };
      return el;
    };
    const playAll = async (holder) => {
      unlockAudio(); stopSpeaking();
      const token = ++playing;
      const els = [...holder.children];
      for (let i = 0; i < items.length; i += 1) {
        if (token !== playing || !holder.isConnected) break;
        if (!items[i].card) continue;
        els.forEach((e, j) => e.classList.toggle('speaking', j === i));
        try { await sayPicto(items[i]); } catch (err) { console.error('[Kalimati] image parlée', err); }
      }
      els.forEach((e) => e.classList.remove('speaking'));
    };
    const playBtn = btn('▶ Écouter', () => playAll(line), 'primary tiny');
    const bigBtn = btn('🔍 Montrer en grand', () => {
      const big = h('div', { class: 'picto-big-line' }, items.map((it) => pictoEl(it, true)));
      const close = () => { playing += 1; stopSpeaking(); overlay.remove(); document.removeEventListener('keydown', onKey); };
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      const overlay = h('div', { class: 'picto-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Phrase en images' },
        big, h('div', { class: 'row center' }, btn('▶ Écouter', () => playAll(big), 'primary'), btn('✕ Fermer', close, 'ghost')));
      document.addEventListener('keydown', onKey);
      document.body.append(overlay);
      playAll(big);
    }, 'ghost tiny');
    const note = h('p', { class: 'note' }, '');
    const draw = () => {
      pictoDraft = input.value;
      const index = buildIndex([...state.cards.filter((c) => !c.hidden), ...extraConcepts()], (c) => (c.extra ? [c.fr, ...c.alt] : [label(c), c.fr, c.dr, c.ar]));
      items = matchPictos(input.value, index);
      line.replaceChildren(...items.map((it) => pictoEl(it, false)));
      const found = items.filter((it) => it.card).length;
      playBtn.disabled = !found; bigBtn.disabled = !found;
      const missing = items.filter((it) => !it.card).map((it) => it.text);
      note.textContent = !input.value.trim() ? 'Écrivez une phrase : chaque mot connu devient une image.'
        : (missing.length ? `Sans image : ${missing.join(', ')}. Vous pouvez créer ces cartes en mode parent (＋ Ajouter).` : 'Tous les mots ont une image ✔');
    };
    let timer = 0;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(draw, 150); });
    draw();
    return h('details', { class: 'card-box picto-box', open: pictoDraft ? true : null }, h('summary', {}, '🔤 Écrire une phrase en images'),
      input, line, h('div', { class: 'row wrap' }, playBtn, bigBtn, btn('Effacer', () => { input.value = ''; draw(); input.focus(); }, 'ghost tiny')), note);
  }

  function motorPlanBox() {
    const status = h('p', { class: 'note', role: 'status' }, motorPlanNote);
    return h('details', { class: 'card-box touch-box', open: motorPlanNote ? true : null },
      h('summary', {}, '🧭 Mots de base par paliers (places fixes)'),
      h('p', { class: 'note' }, 'Chaque mot garde sa place. Un palier masque les mots pas encore travaillés, sans bouger les autres.'),
      ...MOTOR_STAGES.map((st) => h('div', { class: 'row spread wrap' },
        h('div', {}, h('strong', {}, st.label), h('br'), h('small', { class: 'note' }, st.description)),
        btn(`Palier ${st.stage}`, async () => {
          const before = new Map(state.cards.map((c) => [c.id, c]));
          const changed = applyProgressiveStage(state.cards, st.stage).filter((c) => before.get(c.id) !== c && Boolean(before.get(c.id).hidden) !== Boolean(c.hidden));
          if (changed.length) await saveCards(changed);
          motorPlanNote = changed.length ? `✅ Palier ${st.stage} appliqué (${changed.length} carte(s) changée(s)).` : `Palier ${st.stage} déjà en place.`;
          renderView();
        }, 'ghost tiny'))),
      status);
  }

  // v10.23 (pépite 1) : le parent choisit les deux langues de l'enfant (maison + école). Le choix ne déplace
  // aucune carte — le plan moteur reste le seul repère de l'enfant.
  function twinBox() {
    const home = state.twin ? state.twin.a : state.lang;
    const school = state.twin ? state.twin.b : suggestPartner(state.lang);
    const pickA = h('select', { 'aria-label': 'Première langue' },
      LANGS.map((l) => h('option', { value: l.code, selected: l.code === home }, `${l.flag} ${l.name}`)));
    const pickB = h('select', { 'aria-label': 'Deuxième langue' },
      LANGS.map((l) => h('option', { value: l.code, selected: l.code === school }, `${l.flag} ${l.name}`)));
    const apply = async (on) => {
      const a = pickA.value;
      const b = on && a === pickB.value ? LANGS.find((l) => l.code !== a).code : pickB.value;
      state.twin = on ? { a, b } : null;
      try { await saveTwin(state.twin); } catch (err) { console.error('[Kalimati] langue jumelle non enregistrée', err); }
      renderAll();
    };
    return h('details', { class: 'card-box twin-box' }, h('summary', {}, '🗣️ Deux langues sur la même grille'),
      h('p', { class: 'note' }, 'L’enfant voit les deux mots sur chaque carte et change de langue d’un seul toucher (bouton à côté de celle qu’il parle). Les cartes ne bougent pas : c’est toujours la même place pour le même mot.'),
      h('label', { class: 'check' }, 'Parler dans deux langues : ',
        h('input', { type: 'checkbox', checked: state.twin ? 'checked' : null, onchange: (e) => apply(e.target.checked) })),
      h('div', { class: 'row wrap' },
        h('label', { class: 'check' }, 'Langue 1 : ', pickA),
        h('label', { class: 'check' }, 'Langue 2 : ', pickB),
        btn('Changer les deux langues', () => apply(Boolean(state.twin)), 'ghost tiny')),
      h('p', { class: 'note' }, 'Dans une même phrase, chaque mot garde la langue avec laquelle il a été touché.'));
  }

  return { keyringBox, placeBoardView, placeEditorBox, sceneEditorBox, videoEditorBox, talkModeBox, textToPictoBox, motorPlanBox, twinBox };
}
