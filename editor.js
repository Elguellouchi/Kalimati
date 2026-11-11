// Fenêtre du parent pour créer ou modifier une carte : photo, pictogramme ARASAAC, vidéo, mots, rôle, place, voix.
import { CATEGORIES, GRAMMAR } from './data.js';
import { preparePhoto, prepareVideo, startRecording, canRecord } from './media.js';
import { searchPictograms, downloadPictogram, ARASAAC_CREDIT } from './modules/arasaac.js';
import { escapeHtml } from './modules/util.js';

const dialog = document.getElementById('editor');

function template(draft) {
  const options = CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === draft.cat ? 'selected' : ''}>${escapeHtml(c.fr)}</option>`).join('');
  const grams = Object.entries(GRAMMAR).map(([id, g]) => `<option value="${id}" ${id === draft.gram ? 'selected' : ''}>${escapeHtml(g.label)}</option>`).join('');
  const recordHint = canRecord() ? '' : '<p class="hint">Ce navigateur ne permet pas d\'enregistrer la voix.</p>';
  return `
    <form method="dialog" class="editor">
      <h2>${draft.isNew ? 'Nouvelle carte' : 'Modifier la carte'}</h2>
      <div class="ed-photo" id="ed-photo"></div>
      <div class="ed-row">
        <label class="btn primary">📷 Prendre une photo<input type="file" accept="image/*" capture="environment" id="ed-camera" hidden></label>
        <label class="btn">🤳 Visage<input type="file" accept="image/*" capture="user" id="ed-selfie" hidden></label>
        <label class="btn">🖼️ Galerie<input type="file" accept="image/*" id="ed-gallery" hidden></label>
        <button type="button" class="btn" id="ed-arasaac-open">🔍 Pictogramme (ARASAAC)</button>
        <button type="button" class="btn ghost" id="ed-nophoto">Retirer l'image</button>
      </div>
      <div class="ed-arasaac" id="ed-arasaac" hidden>
        <div class="ed-row"><input id="ed-arasaac-q" placeholder="Mot à chercher"><button type="button" class="btn primary" id="ed-arasaac-go">Chercher</button></div>
        <p class="hint-muted">Seul le mot est envoyé à ARASAAC. ${ARASAAC_CREDIT}</p>
        <div class="ed-picto-grid" id="ed-arasaac-results"></div>
      </div>
      <fieldset><legend>Vidéo courte (3 à 5 s, pour un verbe ou un geste)</legend>
        <div class="ed-row">
          <label class="btn">🎬 Filmer<input type="file" accept="video/*" capture="environment" id="ed-video-cam" hidden></label>
          <label class="btn">📁 Importer<input type="file" accept="video/mp4,video/webm,video/*" id="ed-video-file" hidden></label>
          <button type="button" class="btn ghost" id="ed-novideo">Retirer</button>
          <span id="ed-video-state"></span>
        </div>
      </fieldset>
      <label>Mot en français<input id="ed-fr" required maxlength="40" value="${escapeHtml(draft.fr)}"></label>
      <label>Petit texte sous le mot (ex. « Ma sœur »)<input id="ed-sub" maxlength="30" value="${escapeHtml(draft.sub)}"></label>
      <label>Mot en darija (lettres latines)<input id="ed-dr" maxlength="40" value="${escapeHtml(draft.dr)}"></label>
      <label>Mot en darija (lettres arabes, pour la voix arabe)<input id="ed-ar" dir="rtl" maxlength="40" value="${escapeHtml(draft.ar)}"></label>
      <label>Emoji (si pas d'image)<input id="ed-emoji" maxlength="8" value="${escapeHtml(draft.emoji)}"></label>
      <div class="ed-row">
        <label>Catégorie<select id="ed-cat">${options}</select></label>
        <label>Couleur (rôle dans la phrase)<select id="ed-gram">${grams}</select></label>
      </div>
      <div class="ed-row">
        <label>Ligne<input id="ed-row" type="number" min="1" max="30" value="${draft.gridRow || ''}"></label>
        <label>Colonne<input id="ed-col" type="number" min="1" max="5" value="${draft.gridCol || ''}"></label>
        <label class="check"><input type="checkbox" id="ed-hidden" ${draft.hidden ? 'checked' : ''}> Masquer (la place reste vide)</label>
      </div>
      <fieldset><legend>Votre voix</legend>${recordHint}
        <div class="ed-voice" data-lang="fr"></div>
        <div class="ed-voice" data-lang="dr"></div>
      </fieldset>
      <p class="hint" id="ed-error" role="alert"></p>
      <div class="ed-row end">
        ${draft.isNew ? '' : '<button type="button" class="btn danger" id="ed-delete">Supprimer</button>'}
        <button type="button" class="btn ghost" id="ed-cancel">Annuler</button>
        <button type="button" class="btn primary" id="ed-save">Enregistrer</button>
      </div>
    </form>`;
}

const $ = (selector) => dialog.querySelector(selector);
const showError = (text) => { $('#ed-error').textContent = text; };

function renderPhoto(draft) {
  const box = $('#ed-photo');
  if (draft.photo) {
    const url = URL.createObjectURL(draft.photo);
    box.innerHTML = `<img alt="" src="${url}">`;
    box.querySelector('img').onload = () => URL.revokeObjectURL(url);
  } else {
    box.innerHTML = `<span class="emoji">${escapeHtml(draft.emoji || '🖼️')}</span>`;
  }
  $('#ed-video-state').textContent = draft.video ? '✅ vidéo enregistrée' : '';
}

function renderVoice(draft, lang, state) {
  const box = dialog.querySelector(`.ed-voice[data-lang="${lang}"]`);
  const key = lang === 'dr' ? 'audioDr' : 'audioFr';
  const name = lang === 'dr' ? 'Darija' : 'Français';
  const has = Boolean(draft[key]);
  const recording = state.recordingLang === lang;
  const badge = lang === 'dr' && !has ? '<span class="badge-dr">🎙️ Voix Darija à enregistrer</span>' : '';
  box.innerHTML = `
    <span class="voice-name">${name} ${has ? '✅' : '—'}</span>
    <button type="button" class="btn ${recording ? 'danger' : ''}" data-act="rec" ${canRecord() ? '' : 'disabled'}>${recording ? '⏹ Arrêter' : '🎙️ Enregistrer'}</button>
    <button type="button" class="btn ghost" data-act="play" ${has ? '' : 'disabled'}>▶</button>
    <button type="button" class="btn ghost" data-act="clear" ${has ? '' : 'disabled'}>✕</button>${badge}`;
  box.querySelector('[data-act="rec"]').onclick = () => toggleRecording(draft, lang, state);
  box.querySelector('[data-act="play"]').onclick = () => {
    const url = URL.createObjectURL(draft[key]);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.play();
  };
  box.querySelector('[data-act="clear"]').onclick = () => { draft[key] = null; renderVoice(draft, lang, state); };
}

async function toggleRecording(draft, lang, state) {
  if (state.stop) {
    const finishedLang = state.recordingLang;
    const blob = await state.stop();
    state.stop = null;
    state.recordingLang = null;
    draft[finishedLang === 'dr' ? 'audioDr' : 'audioFr'] = blob;
    ['fr', 'dr'].forEach((l) => renderVoice(draft, l, state));
    if (finishedLang === lang) return;
  }
  try {
    state.stop = await startRecording();
    state.recordingLang = lang;
    showError('');
  } catch {
    showError('Le micro est refusé. Autorisez-le dans les réglages du téléphone.');
  }
  ['fr', 'dr'].forEach((l) => renderVoice(draft, l, state));
}

async function onPhotoChosen(input, draft) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  try {
    draft.photo = await preparePhoto(file);
    renderPhoto(draft);
  } catch {
    showError('Cette photo ne peut pas être lue. Essayez-en une autre.');
  }
}

async function onVideoChosen(input, draft) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  try {
    draft.video = await prepareVideo(file);
    renderPhoto(draft);
  } catch (error) {
    showError(error.message);
  }
}

function setupArasaac(draft) {
  $('#ed-arasaac-open').onclick = () => {
    const panel = $('#ed-arasaac');
    panel.hidden = !panel.hidden;
    if (!$('#ed-arasaac-q').value) $('#ed-arasaac-q').value = $('#ed-fr').value;
  };
  $('#ed-arasaac-go').onclick = async () => {
    const results = $('#ed-arasaac-results');
    results.textContent = 'Recherche…';
    try {
      const pictos = await searchPictograms($('#ed-arasaac-q').value);
      results.innerHTML = pictos.length ? '' : 'Aucun pictogramme trouvé.';
      pictos.forEach((p) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ed-picto';
        button.innerHTML = `<img alt="" src="${p.url}" loading="lazy">`;
        button.onclick = async () => {
          try {
            draft.photo = await downloadPictogram(p.id);
            renderPhoto(draft);
            $('#ed-arasaac').hidden = true;
          } catch (error) { showError(error.message); }
        };
        results.append(button);
      });
    } catch (error) {
      results.textContent = error.message;
    }
  };
}

export function openEditor(card, { defaultCat, onSave, onDelete }) {
  const blank = { id: `u-${Date.now()}`, cat: defaultCat, fr: '', sub: '', dr: '', ar: '', emoji: '', gram: 'noun', visualKey: null, sayFr: '', sayAr: '', photo: null, video: null, audioFr: null, audioDr: null, order: Date.now(), gridRow: null, gridCol: null, hidden: false };
  const draft = card ? { sub: '', ...card, isNew: false } : { ...blank, isNew: true };
  const state = { stop: null, recordingLang: null };
  dialog.innerHTML = template(draft);
  renderPhoto(draft);
  ['fr', 'dr'].forEach((l) => renderVoice(draft, l, state));
  setupArasaac(draft);

  const close = async () => {
    if (state.stop) {
      const blob = await state.stop();
      draft[state.recordingLang === 'dr' ? 'audioDr' : 'audioFr'] = blob;
      state.stop = null;
    }
    dialog.close();
  };
  let mediaJob = Promise.resolve();
  ['#ed-camera', '#ed-selfie', '#ed-gallery'].forEach((id) => { $(id).onchange = (e) => { mediaJob = onPhotoChosen(e.target, draft); }; });
  ['#ed-video-cam', '#ed-video-file'].forEach((id) => { $(id).onchange = (e) => { mediaJob = onVideoChosen(e.target, draft); }; });
  $('#ed-nophoto').onclick = () => { draft.photo = null; renderPhoto(draft); };
  $('#ed-novideo').onclick = () => { draft.video = null; renderPhoto(draft); };
  $('#ed-emoji').oninput = (e) => { draft.emoji = e.target.value; if (!draft.photo) renderPhoto(draft); };
  $('#ed-cancel').onclick = close;
  const deleteButton = $('#ed-delete');
  if (deleteButton) {
    deleteButton.onclick = async () => {
      if (!window.confirm('Supprimer cette carte ?')) return;
      await close();
      onDelete(draft.id);
    };
  }
  $('#ed-save').onclick = async () => {
    const fr = $('#ed-fr').value.trim();
    if (!fr) { showError('Écrivez au moins le mot en français.'); return; }
    await mediaJob;
    await close();
    const { isNew, ...rest } = draft;
    const row = Number($('#ed-row').value);
    const col = Number($('#ed-col').value);
    const cat = $('#ed-cat').value;
    // Si le parent change le mot, la phrase dite d'origine (ex. « Ghita, ma sœur ») ne s'applique plus.
    const renamed = !isNew && fr !== card.fr;
    onSave({
      ...rest,
      fr,
      sub: $('#ed-sub').value.trim(),
      dr: $('#ed-dr').value.trim(),
      ar: $('#ed-ar').value.trim(),
      emoji: $('#ed-emoji').value.trim(),
      cat,
      gram: $('#ed-gram').value,
      hidden: $('#ed-hidden').checked,
      sayFr: renamed ? '' : (rest.sayFr || ''),
      sayAr: renamed ? '' : (rest.sayAr || ''),
    }, { slot: row >= 1 && col >= 1 ? { row, col } : null, catChanged: !isNew && card.cat !== cat });
  };
  dialog.showModal();
}
