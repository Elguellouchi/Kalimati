// Fenêtre du parent pour créer ou modifier une carte : photo, pictogramme ARASAAC, vidéo, mots, rôle, place, voix.
import { GRAMMAR, cardAudio, foldLegacyAudio } from './data.js';
import { allCategories } from './modules/lexique-rules.js';
import { preparePhoto, prepareVideo, startRecording, canRecord } from './media.js';
import { searchPictograms, downloadPictogram, ARASAAC_CREDIT } from './modules/arasaac.js';
import { escapeHtml } from './modules/util.js';
import { sayDefault, stopSpeaking } from './speech.js';
import { isAmazighLang, isExtraLang, langInfo } from './modules/languages.js';
import { moveNeedsConfirmation } from './modules/grid-layout.js';
import { parentAmazighVoice, packAmazighVoice, saveParentAmazighVoice, removeParentAmazighVoice, removeParentAmazighVoicesOfCard } from './modules/voice-packs.js';

// v10.7 : en amazigh, une ligne « Votre voix » enregistre le mot dans la variété choisie.
// Cette voix est gardée à part (jamais sur la carte : ni sauvegarde, ni synchro). Champ temporaire : draft.amzVoice.
// v10.21 (Lot 1) : les autres voix vont dans draft.audios[code], une par langue (fin des champs figés audioFr/audioDr).
let amzLang = null;
let activeLang = 'fr';
const draftVoice = (draft, lang) => (isAmazighLang(lang) ? draft.amzVoice || null : cardAudio(draft, lang));
function setDraftVoice(draft, lang, blob) {
  if (isAmazighLang(lang)) { draft.amzVoice = blob; return; }
  const audios = { ...(draft.audios || {}) };
  if (blob) audios[lang] = blob; else delete audios[lang];
  draft.audios = audios;
}
// Langues proposées à l'enregistrement : français, darija, la variété amazighe active, et la langue
// d'affichage si elle se dit avec la voix du parent (sinon la voix du téléphone la lit déjà).
const voiceLangs = () => {
  const list = ['fr', 'dr'];
  for (const code of [amzLang, activeLang]) {
    if (code && !isExtraLang(code) && !list.includes(code)) list.push(code);
  }
  return list;
};
import { suggestDarija } from './modules/darija-lexicon.js';

const dialog = document.getElementById('editor');

function template(draft) {
  const options = allCategories.map((c) => `<option value="${c.id}" ${c.id === draft.cat ? 'selected' : ''}>${escapeHtml(c.fr)}</option>`).join('');
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
        <button type="button" class="btn ghost" id="ed-nophoto" aria-label="Retirer l'image de la carte">Retirer l'image</button>
      </div>
      <div class="ed-arasaac" id="ed-arasaac" hidden>
        <div class="ed-row"><input id="ed-arasaac-q" aria-label="Mot à chercher dans ARASAAC" placeholder="Mot à chercher"><button type="button" class="btn primary" id="ed-arasaac-go">Chercher</button></div>
        <p class="hint-muted">Seul le mot est envoyé à ARASAAC. ${ARASAAC_CREDIT}</p>
        <div class="ed-picto-grid" id="ed-arasaac-results"></div>
      </div>
      <fieldset><legend>Vidéo courte (3 à 5 s, pour un verbe ou un geste)</legend>
        <div class="ed-row">
          <label class="btn">🎬 Filmer<input type="file" accept="video/*" capture="environment" id="ed-video-cam" hidden></label>
          <label class="btn">📁 Importer<input type="file" accept="video/mp4,video/webm,video/*" id="ed-video-file" hidden></label>
          <button type="button" class="btn ghost" id="ed-novideo" aria-label="Retirer la vidéo de la carte">Retirer</button>
          <span id="ed-video-state"></span>
        </div>
      </fieldset>
      <label>Mot en français<input id="ed-fr" required maxlength="40" value="${escapeHtml(draft.fr)}"></label>
      <label>Petit texte sous le mot (ex. « Ma sœur »)<input id="ed-sub" maxlength="30" value="${escapeHtml(draft.sub)}"></label>
      <label>Mot en darija (lettres latines)<input id="ed-dr" maxlength="40" value="${escapeHtml(draft.dr)}"></label>
      <label>Mot en darija (lettres arabes, pour la voix arabe)<input id="ed-ar" dir="rtl" maxlength="40" value="${escapeHtml(draft.ar)}"></label>
      <p class="hint-muted" id="ed-lexicon"></p>
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
        ${voiceLangs().map((code) => `<div class="ed-voice" data-lang="${code}"></div>`).join('')}
        ${amzLang ? `<p class="hint-muted">Voix ${escapeHtml(langInfo(amzLang).name)} : gardée dans ce téléphone seulement (pas dans la sauvegarde). Sans elle, la carte reste muette en amazigh.</p>` : ''}
      </fieldset>
      <p class="hint" id="ed-error" role="alert"></p>
      <div class="ed-row end">
        ${draft.isNew ? '' : '<button type="button" class="btn danger" id="ed-delete">Supprimer</button>'}
        <button type="button" class="btn ghost" id="ed-cancel" aria-label="Annuler les modifications">Annuler</button>
        <button type="button" class="btn primary" id="ed-save" aria-label="Enregistrer la carte">Enregistrer</button>
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
  if (!box) return;
  const amz = isAmazighLang(lang);
  const name = escapeHtml(langInfo(lang).name);
  const voice = draftVoice(draft, lang);
  const has = Boolean(voice);
  const recording = state.recordingLang === lang;
  // Sans enregistrement, la carte parle avec la voix par défaut ; le parent choisit de la remplacer par sa voix.
  // v10.7 : en amazigh, la voix par défaut est celle du pack vocal installé ; sans pack, la carte reste muette.
  const packVoice = amz ? Boolean(packAmazighVoice(lang, draft.id)) : true;
  const status = has ? 'ma voix ✅' : (amz ? (packVoice ? 'voix du pack' : 'pas encore de voix') : 'voix par défaut');
  box.innerHTML = `
    <span class="voice-name">${name} : ${status}</span>
    <button type="button" class="btn ghost" data-act="default" ${packVoice ? '' : 'disabled'}>${amz ? '▶ Voix du pack' : '▶ Voix par défaut'}</button>
    <button type="button" class="btn ${recording ? 'danger' : ''}" data-act="rec" ${canRecord() ? '' : 'disabled'}>${recording ? '⏹ Arrêter' : (has ? '🎙️ Réenregistrer' : '🎙️ Remplacer par ma voix')}</button>
    <button type="button" class="btn ghost" data-act="play" ${has ? '' : 'disabled'}>▶ Ma voix</button>
    <button type="button" class="btn ghost" data-act="clear" ${has ? '' : 'disabled'} title="Revenir à la voix par défaut">✕</button>`;
  box.querySelector('[data-act="default"]').onclick = () => {
    stopSpeaking();
    sayDefault({ ...draft, fr: $('#ed-fr').value.trim() || draft.fr, ar: $('#ed-ar').value.trim() }, lang);
  };
  // === [DEBUT MODIF v10.5 : 4.64 · F13 — Confirmation en 2 touchers avant de remplacer ou supprimer une voix enregistrée] ===
  const recBtn = box.querySelector('[data-act="rec"]');
  let confirmRec = false;
  recBtn.onclick = () => {
    if (has && !recording && !confirmRec) {
      confirmRec = true;
      recBtn.textContent = "🎙️ Remplacer la voix actuelle ?";
      setTimeout(() => { if (confirmRec) { confirmRec = false; recBtn.textContent = "🎙️ Réenregistrer"; } }, 4000);
      return;
    }
    confirmRec = false;
    toggleRecording(draft, lang, state);
  };
  box.querySelector('[data-act="play"]').onclick = () => {
    const url = URL.createObjectURL(voice);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    audio.onerror = () => URL.revokeObjectURL(url);
    audio.play().catch(() => URL.revokeObjectURL(url));
  };
  const clearVoiceBtn = box.querySelector('[data-act="clear"]');
  let confirmClearVoice = false;
  clearVoiceBtn.onclick = () => {
    if (!confirmClearVoice) {
      confirmClearVoice = true;
      clearVoiceBtn.textContent = "Confirmer ✕ ?";
      setTimeout(() => { if (confirmClearVoice) { confirmClearVoice = false; clearVoiceBtn.textContent = "✕"; } }, 4000);
      return;
    }
    confirmClearVoice = false;
    setDraftVoice(draft, lang, null);
    renderVoice(draft, lang, state);
  };
  // === [FIN MODIF v10.5 : 4.64 · F13] ===
}

async function toggleRecording(draft, lang, state) {
  if (state.stop) {
    const finishedLang = state.recordingLang;
    const blob = await state.stop();
    state.stop = null;
    state.recordingLang = null;
    setDraftVoice(draft, finishedLang, blob);
    voiceLangs().forEach((l) => renderVoice(draft, l, state));
    if (finishedLang === lang) return;
  }
  try {
    state.stop = await startRecording();
    state.recordingLang = lang;
    showError('');
  } catch {
    showError('Le micro est refusé. Autorisez-le dans les réglages du téléphone.');
  }
  voiceLangs().forEach((l) => renderVoice(draft, l, state));
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

// Darija proposée par le lexique ouvert, seulement dans les cases vides : le parent vérifie et corrige.
function setupLexicon() {
  $('#ed-fr').addEventListener('change', async () => {
    const found = await suggestDarija($('#ed-fr').value);
    if (!found) return;
    const dr = $('#ed-dr');
    const ar = $('#ed-ar');
    const filled = [];
    if (!dr.value.trim() && found.lat) { dr.value = found.lat; filled.push('lettres latines'); }
    if (!ar.value.trim() && found.ar) { ar.value = found.ar; filled.push('lettres arabes'); }
    if (filled.length) $('#ed-lexicon').textContent = `Darija proposée (${filled.join(' et ')}) par un lexique ouvert : vérifiez et corrigez si besoin.`;
  });
}

export function openEditor(card, { defaultCat, onSave, onDelete, amazighLang = null, lang = 'fr', cols = 4 }) {
  amzLang = isAmazighLang(amazighLang) ? amazighLang : null;
  activeLang = lang || 'fr';
  const newId = `u-${Date.now()}`;
  // Lot 2 (L2-09) : wordId = identifiant stable de la carte, indépendant des langues. Il ne change jamais.
  const blank = { id: newId, wordId: newId, cat: defaultCat, fr: '', sub: '', dr: '', ar: '', emoji: '', gram: 'noun', visualKey: null, sayFr: '', sayAr: '', photo: null, video: null, audios: {}, order: Date.now(), gridRow: null, gridCol: null, hidden: false };
  const draft = card ? { sub: '', ...foldLegacyAudio(card), isNew: false } : { ...blank, isNew: true };
  const amzBefore = amzLang ? parentAmazighVoice(amzLang, draft.id) : null;
  draft.amzVoice = amzBefore;
  const state = { stop: null, recordingLang: null };
  dialog.innerHTML = template(draft);
  renderPhoto(draft);
  voiceLangs().forEach((l) => renderVoice(draft, l, state));
  setupArasaac(draft);
  setupLexicon();

  // === [DEBUT MODIF v10.5 : 4.40 · A10 — Restauration du focus clavier à la fermeture de la modale] ===
  const triggerEl = document.activeElement;
  const close = async () => {
    if (state.stop) {
      const blob = await state.stop();
      setDraftVoice(draft, state.recordingLang, blob);
      state.stop = null;
    }
    stopSpeaking();
    dialog.close();
    if (triggerEl && typeof triggerEl.focus === "function") {
      try { triggerEl.focus(); } catch {}
    }
  };
  // === [FIN MODIF v10.5 : 4.40 · A10] ===
  let mediaJob = Promise.resolve();
  ['#ed-camera', '#ed-selfie', '#ed-gallery'].forEach((id) => { $(id).onchange = (e) => { mediaJob = onPhotoChosen(e.target, draft); }; });
  ['#ed-video-cam', '#ed-video-file'].forEach((id) => { $(id).onchange = (e) => { mediaJob = onVideoChosen(e.target, draft); }; });
  $('#ed-nophoto').onclick = () => { draft.photo = null; renderPhoto(draft); };
  $('#ed-novideo').onclick = () => { draft.video = null; renderPhoto(draft); };
  $('#ed-emoji').oninput = (e) => { draft.emoji = e.target.value; if (!draft.photo) renderPhoto(draft); };
  $('#ed-cancel').onclick = close;
  const deleteButton = $('#ed-delete');
  if (deleteButton) {
    let confirmPending = false;
    let confirmTimer = 0;
    deleteButton.setAttribute('aria-label', 'Supprimer cette carte');
    deleteButton.onclick = async () => {
      if (!confirmPending) {
        confirmPending = true;
        deleteButton.textContent = 'Confirmer la suppression ?';
        deleteButton.classList.add('danger');
        clearTimeout(confirmTimer);
        confirmTimer = setTimeout(() => {
          confirmPending = false;
          deleteButton.textContent = 'Supprimer';
          deleteButton.classList.remove('danger');
        }, 4000);
        return;
      }
      clearTimeout(confirmTimer);
      await close();
      removeParentAmazighVoicesOfCard(draft.id).catch(() => {});
      onDelete(draft.id);
    };
  }
  // Lot 2 (L2-07) : déplacer une carte change le geste appris par l'enfant. Avant d'enregistrer une
  // nouvelle Ligne/Colonne, le parent confirme en 2 touchers (mécanisme de « Remettre en ordre automatique »).
  let confirmMove = false;
  let confirmMoveTimer = 0;
  $('#ed-save').onclick = async () => {
    const fr = $('#ed-fr').value.trim();
    if (!fr) { showError('Écrivez au moins le mot en français.'); return; }
    const row = Number($('#ed-row').value);
    const col = Number($('#ed-col').value);
    if (!confirmMove && moveNeedsConfirmation(draft, row, col, cols)) {
      confirmMove = true;
      const saveBtn = $('#ed-save');
      saveBtn.textContent = 'Déplacer change le geste appris par l’enfant. Continuer ?';
      clearTimeout(confirmMoveTimer);
      confirmMoveTimer = setTimeout(() => {
        confirmMove = false;
        saveBtn.textContent = 'Enregistrer';
      }, 4000);
      return;
    }
    confirmMove = false;
    clearTimeout(confirmMoveTimer);
    await mediaJob;
    await close();
    // v10.7 : la voix amazighe ne va jamais sur la carte ; elle est gardée à part, dans ce téléphone.
    const { isNew, amzVoice, ...rest } = draft;
    if (amzLang && amzVoice !== amzBefore) {
      try {
        if (amzVoice) await saveParentAmazighVoice(amzLang, draft.id, amzVoice);
        else await removeParentAmazighVoice(amzLang, draft.id);
      } catch (err) {
        window.alert(`La voix ${langInfo(amzLang).name} n’a pas pu être gardée. ${err?.message || ''}`.trim());
      }
    }
    const cat = $('#ed-cat').value;
    // Si le parent change le mot, la phrase dite d'origine (ex. « Ma sœur ») ne s'applique plus.
    const renamed = !isNew && fr !== card.fr;
    const saved = {
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
    };
    if (!isNew && saved.lexicon?.owned && ['fr', 'dr', 'ar', 'emoji', 'gram', 'cat', 'sub', 'sayFr', 'sayAr']
      .some((field) => String(saved[field] ?? '') !== String(card[field] ?? ''))) {
      saved.lexicon = { ...saved.lexicon, customized: true };
    }
    onSave(saved, { slot: row >= 1 && col >= 1 ? { row, col } : null, catChanged: !isNew && card.cat !== cat });
  };
  dialog.showModal();
}
