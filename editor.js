// Fenêtre du parent pour créer ou modifier une carte : photo, mots, voix.
import { CATEGORIES } from './data.js';
import { resizePhoto, startRecording, canRecord } from './media.js';

const dialog = document.getElementById('editor');

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function template(draft) {
  const options = CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === draft.cat ? 'selected' : ''}>${escapeHtml(c.fr)}</option>`).join('');
  const recordHint = canRecord() ? '' : '<p class="hint">Ce navigateur ne permet pas d\'enregistrer la voix.</p>';
  return `
    <form method="dialog" class="editor">
      <h2>${draft.isNew ? 'Nouvelle carte' : 'Modifier la carte'}</h2>
      <div class="ed-photo" id="ed-photo"></div>
      <div class="ed-row">
        <label class="btn">📷 Prendre une photo<input type="file" accept="image/*" capture="environment" id="ed-camera" hidden></label>
        <label class="btn">🖼️ Galerie<input type="file" accept="image/*" id="ed-gallery" hidden></label>
        <button type="button" class="btn ghost" id="ed-nophoto">Retirer la photo</button>
      </div>
      <label>Mot en français<input id="ed-fr" required maxlength="40" value="${escapeHtml(draft.fr)}"></label>
      <label>Mot en darija<input id="ed-dr" maxlength="40" value="${escapeHtml(draft.dr)}"></label>
      <label>Emoji (si pas de photo)<input id="ed-emoji" maxlength="4" value="${escapeHtml(draft.emoji)}"></label>
      <label>Catégorie<select id="ed-cat">${options}</select></label>
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

function renderPhoto(draft) {
  const box = dialog.querySelector('#ed-photo');
  if (draft.photo) {
    const url = URL.createObjectURL(draft.photo);
    box.innerHTML = `<img alt="" src="${url}">`;
    box.querySelector('img').onload = () => URL.revokeObjectURL(url);
  } else {
    box.innerHTML = `<span class="emoji">${escapeHtml(draft.emoji || '🖼️')}</span>`;
  }
}

function renderVoice(draft, lang, state) {
  const box = dialog.querySelector(`.ed-voice[data-lang="${lang}"]`);
  const key = lang === 'dr' ? 'audioDr' : 'audioFr';
  const name = lang === 'dr' ? 'Darija' : 'Français';
  const has = Boolean(draft[key]);
  const recording = state.recordingLang === lang;
  box.innerHTML = `
    <span class="voice-name">${name} ${has ? '✅' : '—'}</span>
    <button type="button" class="btn ${recording ? 'danger' : ''}" data-act="rec" ${canRecord() ? '' : 'disabled'}>${recording ? '⏹ Arrêter' : '🎙️ Enregistrer'}</button>
    <button type="button" class="btn ghost" data-act="play" ${has ? '' : 'disabled'}>▶</button>
    <button type="button" class="btn ghost" data-act="clear" ${has ? '' : 'disabled'}>✕</button>`;
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
  const error = dialog.querySelector('#ed-error');
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
    error.textContent = '';
  } catch {
    error.textContent = 'Le micro est refusé. Autorisez-le dans les réglages du téléphone.';
  }
  ['fr', 'dr'].forEach((l) => renderVoice(draft, l, state));
}

async function onPhotoChosen(input, draft) {
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  try {
    draft.photo = await resizePhoto(file);
    renderPhoto(draft);
  } catch {
    dialog.querySelector('#ed-error').textContent = 'Cette photo ne peut pas être lue. Essayez-en une autre.';
  }
}

export function openEditor(card, { defaultCat, onSave, onDelete }) {
  const draft = card
    ? { ...card, isNew: false }
    : { id: `u-${Date.now()}`, cat: defaultCat, fr: '', dr: '', emoji: '', photo: null, audioFr: null, audioDr: null, order: Date.now(), isNew: true };
  const state = { stop: null, recordingLang: null };
  dialog.innerHTML = template(draft);
  renderPhoto(draft);
  ['fr', 'dr'].forEach((l) => renderVoice(draft, l, state));

  const close = async () => {
    if (state.stop) {
      const blob = await state.stop();
      draft[state.recordingLang === 'dr' ? 'audioDr' : 'audioFr'] = blob;
      state.stop = null;
    }
    dialog.close();
  };
  let photoJob = Promise.resolve();
  dialog.querySelector('#ed-camera').onchange = (e) => { photoJob = onPhotoChosen(e.target, draft); };
  dialog.querySelector('#ed-gallery').onchange = (e) => { photoJob = onPhotoChosen(e.target, draft); };
  dialog.querySelector('#ed-nophoto').onclick = () => { draft.photo = null; renderPhoto(draft); };
  dialog.querySelector('#ed-emoji').oninput = (e) => { draft.emoji = e.target.value; if (!draft.photo) renderPhoto(draft); };
  dialog.querySelector('#ed-cancel').onclick = close;
  const deleteButton = dialog.querySelector('#ed-delete');
  if (deleteButton) {
    deleteButton.onclick = async () => {
      if (!window.confirm('Supprimer cette carte ?')) return;
      await close();
      onDelete(draft.id);
    };
  }
  dialog.querySelector('#ed-save').onclick = async () => {
    const fr = dialog.querySelector('#ed-fr').value.trim();
    if (!fr) { dialog.querySelector('#ed-error').textContent = 'Écrivez au moins le mot en français.'; return; }
    await photoJob;
    await close();
    const { isNew, ...rest } = draft;
    onSave({
      ...rest,
      fr,
      dr: dialog.querySelector('#ed-dr').value.trim(),
      emoji: dialog.querySelector('#ed-emoji').value.trim(),
      cat: dialog.querySelector('#ed-cat').value,
    });
  };
  dialog.showModal();
}
