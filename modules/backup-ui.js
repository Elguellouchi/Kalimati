// Panneau adulte : sauvegarde et restauration par fusion, mot de passe, choix de la langue
// Code déplacé tel quel depuis app.js (v10.42, Lot 4.1) : aucun comportement ne change.
// Les fonctions encore dans app.js sont lues au moment de l’appel (app.<nom>).
import * as db from '../db.js';
import { BACKUP_PASSWORD_MIN, buildBackupFile, deliverBackup, encryptBackupFile, readBackup } from '../backup.js';
import { foldLegacyAudio } from '../data.js';
import { SPEECH_SETTING_KEY, setCloudSpeechAllowed, speak, unlockAudio } from '../speech.js';
import { loadContext } from './aba.js';
import { UPPERCASE_SETTING_KEY, applyUppercase } from './about.js';
import { openSetupWizard, superAdminScreen } from './admin-beta.js';
import { dashboardScreen } from './dashboard.js';
import { loadFriendsState } from './friends.js';
import { assignPositions, relayout } from './grid-layout.js';
import { LANGS, isAmazighLang, langInfo, spokenUi } from './languages.js';
import { loadLevels } from './levels.js';
import { loadMorphologyState } from './morphology.js';
import { backupAgeDays, backupReminderElement } from './backup-reminder.js';
import { fallbackBannerElement } from './db-fallback.js';
import { setActiveLang } from './section-i18n.js';
import { TIMER_SETTING_KEY, setTimerShowNumbers } from './timer.js';
import { h } from './util.js';
import { loadVisuals } from './visuals.js';
import { autoInstallAmazighVoicePack, loadAmazighVoices } from './voice-packs.js';

export function createBackupUi(app) {
  const $ = (...args) => app.$(...args);
  const EXPORTED_SETTINGS = app.EXPORTED_SETTINGS;
  const loadCards = (...args) => app.loadCards(...args);
  const saveLayoutFingerprint = (...args) => app.saveLayoutFingerprint(...args);
  const nav = app.nav;
  const renderAll = (...args) => app.renderAll(...args);
  const renderSpaces = (...args) => app.renderSpaces(...args);
  const renderView = (...args) => app.renderView(...args);
  const showBackupAge = (...args) => app.showBackupAge(...args);
  const state = app.state;
  // L1-03 : rappel de sauvegarde en mode parent (jamais en mode enfant).
  // Le bandeau est distinct de #backup-age et précède le bouton #export existant.
  async function refreshBackupReminder() {
    const exportBtn = $('#export');
    if (!exportBtn) return;
    document.getElementById('backup-reminder')?.remove();
    if (!state.parent) return;
    const at = await db.getSetting('lastBackupAt').catch(() => null);
    if (!state.parent) return;
    const reminder = backupReminderElement({
      days: backupAgeDays(at),
      parent: true,
      onBackup: () => exportBtn.click(),
    });
    if (reminder) exportBtn.before(reminder);
  }

  // L1-07 : en mode secours, un message discret dit au parent que les cartes reviendront
  // au prochain démarrage. Jamais en mode enfant, jamais d'alerte rouge.
  function refreshFallbackBanner() {
    document.getElementById('fallback-banner')?.remove();
    if (!state.parent) return;
    const banner = fallbackBannerElement({ parent: true });
    const bar = document.getElementById('parent-bar');
    if (!banner || !bar) return;
    bar.after(banner);
  }

  // renderAll() prévient les modules du changement de mode parent (verrouillage/déverrouillage).
  let lastParentMode = null;
  document.addEventListener('kalimati-parent', (event) => {
    const parent = Boolean(event?.detail?.parent);
    if (parent === lastParentMode) return;
    lastParentMode = parent;
    if (parent) refreshBackupReminder().catch(() => {});
    else document.getElementById('backup-reminder')?.remove();
    refreshFallbackBanner();
  });
  async function collectSettings() {
    const entries = await Promise.all(EXPORTED_SETTINGS.map(async (key) => [key, await db.getSetting(key)]));
    return Object.fromEntries(entries.filter(([, value]) => value !== undefined));
  }

  // v10.11 : mot de passe de la sauvegarde chiffrée. Le dialogue rend la main (null) si le parent annule.
  function askBackupPassword({ confirm = false } = {}) {
    return new Promise((resolve) => {
      const dialog = h('dialog', { class: 'lang-dialog', 'aria-label': confirm ? 'Chiffrer la sauvegarde' : 'Mot de passe de la sauvegarde' });
      const first = h('input', { type: 'password', autocomplete: 'new-password', placeholder: `Mot de passe (${BACKUP_PASSWORD_MIN} caractères minimum)`, 'aria-label': 'Mot de passe' });
      const second = h('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Recopier le mot de passe', 'aria-label': 'Recopier le mot de passe' });
      const err = h('p', { class: 'note err-text', role: 'alert' });
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        if (dialog.open) dialog.close();
        dialog.remove();
        resolve(value);
      };
      const submit = () => {
        const value = first.value.trim();
        if (value.length < BACKUP_PASSWORD_MIN) { err.textContent = `Au moins ${BACKUP_PASSWORD_MIN} caractères.`; first.focus(); return; }
        if (confirm && value !== second.value.trim()) { err.textContent = 'Les deux mots de passe ne sont pas identiques.'; second.focus(); return; }
        finish(value);
      };
      dialog.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
      dialog.append(h('form', { class: 'stack pad', onsubmit: (e) => { e.preventDefault(); submit(); } },
        h('h3', {}, confirm ? '🔒 Chiffrer la sauvegarde' : '🔑 Sauvegarde chiffrée'),
        h('p', { class: 'note' }, confirm
          ? 'Sans ce mot de passe, le fichier reste illisible, même si quelqu’un le trouve. Kalimati ne peut pas le retrouver : notez-le en lieu sûr, séparément du fichier.'
          : 'Saisissez le mot de passe choisi au moment de la sauvegarde.'),
        first,
        confirm ? second : null,
        err,
        h('div', { class: 'row wrap' },
          h('button', { type: 'submit', class: 'btn primary' }, confirm ? '🔒 Chiffrer' : '🔓 Déverrouiller'),
          h('button', { type: 'button', class: 'btn ghost', onclick: () => finish(null) }, 'Annuler'))));
      document.body.appendChild(dialog);
      dialog.showModal();
      first.focus();
    });
  }

  // ---------- Choix de la langue ----------
  // v10.22 (Lot 2) : langue ET sens de lecture. L'arabe (et toute langue rtl des locales) bascule
  // la page entière en « de droite à gauche » : menus, grilles, bande de phrase. Aucun texte n'est
  // pivoté à la main, le navigateur s'en charge dès que <html dir="rtl"> est posé.
  function applyLangDir() {
    const code = (langInfo(state.lang).tts || 'fr').split('-')[0];
    document.documentElement.lang = code; // v10.5 (A21)
    document.documentElement.dir = langInfo(state.lang).rtl ? 'rtl' : 'ltr'; // v10.22 (Lot 2)
  }

  async function setLang(code) {
    state.lang = langInfo(code).code;
    setActiveLang(state.lang);
    applyLangDir();
    // v10.7 : voix amazighes de la variété choisie, gardées en mémoire (le son part tout de suite au toucher).
    loadAmazighVoices(state.lang).then(() => { if (isAmazighLang(state.lang) && state.parent) renderView(); }).catch(() => {});
    // v10.7.1 : le pack de voix d'essai de cette variété arrive tout seul, en arrière-plan (fichiers du site seulement).
    if (isAmazighLang(state.lang)) autoInstallAmazighVoicePack(state.lang);
    // v10.5.2 : l'écran change tout de suite ; l'enregistrement suit (avant, une écriture bloquée sur iPhone empêchait le changement).
    renderAll();
    await db.setSetting('lang', state.lang).catch((err) => console.error('[Kalimati] langue non enregistrée', err));
  }

  function openLangPicker() {
    const opener = document.activeElement;
    const dialog = h('dialog', { class: 'lang-dialog', 'aria-label': 'Choisir la langue' });
    const close = () => { if (dialog.open) dialog.close(); dialog.remove(); try { opener?.focus?.(); } catch { /* rien */ } };
    // v10.7 : bouton 🔊 pour les parents qui ne lisent pas : il dit l'aide, et le nom de chaque langue.
    const sayHello = (code, prefix = '') => { const said = spokenUi('hello', code); return speak(`${prefix}${said.text}`, { lang: said.lang }); };
    const helpBtn = h('button', {
      type: 'button', class: 'audio-help-btn', 'aria-label': 'Écouter l’aide pour choisir la langue',
      onclick: () => { unlockAudio(); speak('Touchez votre langue. Le petit haut-parleur dit le nom de chaque langue.', { lang: 'fr' }); },
    }, '🔊 Aide');
    dialog.append(h('div', { class: 'stack pad' },
      h('div', { class: 'row spread wrap' }, h('h3', {}, '🌍 Langue / اللغة / Language'), helpBtn),
      h('div', { class: 'lang-grid' }, LANGS.map((l) => h('div', { class: 'lang-choice-row' },
        h('button', {
          type: 'button', class: `lang-choice${l.code === state.lang ? ' active' : ''}`, lang: l.tts, dir: l.rtl ? 'rtl' : 'auto',
          onclick: () => { close(); setLang(l.code); sayHello(l.code); },
        }, h('span', { class: 'emoji' }, l.flag), h('span', { class: 'lang-names' }, h('span', {}, l.name), l.sub ? h('small', { class: 'lang-sub' }, l.sub) : null)),
        h('button', {
          type: 'button', class: 'audio-help-btn tiny', 'aria-label': `Écouter : ${l.name}`,
          onclick: (e) => { e.stopPropagation(); unlockAudio(); sayHello(l.code, `${l.name}. `); },
        }, '🔊')))),
      h('p', { class: 'note' }, 'Français et darija : vos voix enregistrées. Autres langues : la voix du téléphone dit les mots traduits.'),
      h('p', { class: 'note' }, 'Amazigh (ⵣ) : la carte dit votre voix, enregistrée en mode parent. Sans voix enregistrée, elle reste muette. Mots amazighs à faire relire par un locuteur natif.'),
      h('button', { type: 'button', class: 'btn ghost', onclick: close }, 'Fermer')));
    document.body.append(dialog);
    dialog.showModal();
  }

  function setupParentBar() {
    const langSeg = document.querySelector('[data-lang-choice]')?.parentElement;
    if (langSeg) langSeg.replaceChildren(...LANGS.map((l) => h('button', { type: 'button', dataset: { langChoice: l.code }, title: l.name }, `${l.flag} ${l.short}`)));
    document.querySelectorAll('[data-lang-choice]').forEach((button) => {
      button.onclick = () => setLang(button.dataset.langChoice);
    });
    $('#cols').onchange = async (e) => {
      state.cols = Number(e.target.value);
      await db.setSetting('cols', state.cols);
      // Lot 2 (L2-02) : changer de taille NE DÉPLACE AUCUNE CARTE. Seule la place de la taille
      // nouvellement affichée est calculée (une fois), si elle n'existe pas encore.
      state.cards = assignPositions(state.cards, state.cols);
      renderView();
      await db.putCards(state.cards);
      await saveLayoutFingerprint(state.cards); // Lot 2 (L2-10) : action adulte → nouvelle empreinte
    };
    // Lot 2 (L2-08) : remise en ordre automatique, uniquement ici et seulement après 2 touchers.
    // Sans 2e toucher en 4 secondes, le bouton revient comme avant (mécanisme de stories.js).
    let confirmRelayout = false;
    $('#relayout').onclick = async () => {
      const b = $('#relayout');
      if (!confirmRelayout) {
        confirmRelayout = true;
        b.textContent = 'Toucher encore pour confirmer';
        setTimeout(() => { if (confirmRelayout) { confirmRelayout = false; b.textContent = 'Remettre en ordre automatique'; } }, 4000);
        return;
      }
      confirmRelayout = false;
      b.textContent = 'Remettre en ordre automatique';
      state.cards = relayout(state.cards, state.cols);
      await db.putCards(state.cards);
      await saveLayoutFingerprint(state.cards); // Lot 2 (L2-10) : action adulte → nouvelle empreinte
      renderView();
    };
    $('#photos').onclick = () => { state.space = 'emotions'; renderSpaces(); nav.openGallery(); };
    const adminBtn = document.getElementById('admin-console-btn');
    if (adminBtn) {
      adminBtn.onclick = () => {
        state.space = 'progress';
        renderSpaces();
        nav.openScreen(() => superAdminScreen(nav), () => dashboardScreen(nav));
      };
    }
    const wizardBtn = document.getElementById('wizard-btn');
    if (wizardBtn) {
      wizardBtn.onclick = () => openSetupWizard({
        onDone: async () => {
          await loadContext();
          state.lang = langInfo((await db.getSetting('lang')) || 'fr').code;
          setActiveLang(state.lang);
          state.cols = (await db.getSetting('cols')) || 4;
          state.cards = await loadCards();
          renderAll();
        },
      });
    }
    // v9.10 : sauvegarde en 2 temps. L'écran reste libre, le bouton montre où on en est, et un message dit clairement le résultat.
    let backupFile = null;
    let backupEncrypted = false;
    const exportBtn = $('#export');
    const panel = $('#backup-panel');
    const showPanel = (text, withSave) => {
      panel.replaceChildren(h('span', { class: 'backup-msg' }, text));
      if (withSave) {
        const save = h('button', { type: 'button', class: 'btn primary', id: 'backup-save' }, '📤 Enregistrer le fichier');
        const close = h('button', { type: 'button', class: 'btn ghost tiny' }, 'Fermer');
        save.onclick = async () => {
          save.disabled = true;
          try {
            const result = await deliverBackup(backupFile);
            if (result === 'cancelled') { save.disabled = false; return; }
            await db.setSetting('lastBackupAt', Date.now());
            backupFile = null;
            const kept = backupEncrypted ? ' ⚠️ Fichier chiffré : gardez le mot de passe séparément, sinon il est illisible.' : '';
            showPanel((result === 'shared'
              ? '✅ Sauvegarde envoyée. Gardez ce fichier en lieu sûr (Fichiers, Drive ou e-mail).'
              : '✅ Sauvegarde téléchargée. Vous la trouverez dans « Téléchargements » ou « Fichiers ».') + kept, false);
            showBackupAge();
            refreshBackupReminder().catch(() => {});
          } catch (error) {
            save.disabled = false;
            showPanel(`⚠️ L’enregistrement n’a pas marché. Réessayez. (${error.message || 'erreur inconnue'})`, true);
          }
        };
        close.onclick = () => { backupFile = null; backupEncrypted = false; panel.replaceChildren(); panel.hidden = true; };
        panel.append(h('div', { class: 'backup-actions' }, save, close));
      }
      panel.hidden = false;
    };
    exportBtn.onclick = async () => {
      if (exportBtn.disabled) return;
      exportBtn.disabled = true;
      exportBtn.setAttribute('aria-busy', 'true');
      exportBtn.textContent = '⏳ Préparation… 0 %';
      backupFile = null;
      backupEncrypted = false;
      panel.hidden = true;
      try {
        // v10.5 : par défaut, la sauvegarde ne contient ni photo ni voix (textes, cartes, journaux, bilans seulement).
        const includeMedia = Boolean($('#backup-media')?.checked);
        const encrypt = Boolean($('#backup-encrypt')?.checked);
        backupEncrypted = false;
        let passphrase = null;
        if (encrypt) {
          exportBtn.textContent = '🔑 Mot de passe…';
          passphrase = await askBackupPassword({ confirm: true });
          if (!passphrase) return;
        }
        backupFile = await buildBackupFile({ cards: state.cards, trials: await db.getAllTrials(), settings: await collectSettings(),
          visuals: includeMedia ? await db.getAllVisualOverrides() : [], abcLogs: await db.getAllAbcLogs(), orthoLogs: await db.getAllOrthoLogs(), includeMedia },
        (pct) => { exportBtn.textContent = `⏳ Préparation… ${pct} %`; });
        if (passphrase) {
          exportBtn.textContent = '🔒 Chiffrement…';
          backupFile = await encryptBackupFile(backupFile, passphrase);
          backupEncrypted = true;
        }
        const size = backupFile.size >= 1048576 ? `${(backupFile.size / 1048576).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(backupFile.size / 1024))} Ko`;
        showPanel(`✅ Sauvegarde prête (${size}, ${includeMedia ? 'AVEC photos et voix' : 'sans photo ni voix'}${backupEncrypted ? ', chiffrée par mot de passe' : ''}). Touchez « Enregistrer le fichier » pour la garder.`, true);
      } catch (error) {
        showPanel(`⚠️ La sauvegarde n’a pas pu être préparée. Réessayez. (${error.message || 'erreur inconnue'})`, false);
      } finally {
        exportBtn.disabled = false;
        exportBtn.removeAttribute('aria-busy');
        exportBtn.textContent = '💾 Sauvegarder';
      }
    };
    $('#import').onchange = async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try {
        let backup;
        try {
          backup = await readBackup(file);
        } catch (error) {
          if (!error.needsPassphrase) throw error;
          const passphrase = await askBackupPassword({ confirm: false });
          if (!passphrase) return;
          backup = await readBackup(file, passphrase);
        }
        const parts = [backup.trials.length && `${backup.trials.length} essais notés`, backup.abcLogs.length && `${backup.abcLogs.length} notes du journal des comportements`,
          backup.orthoLogs.length && `${backup.orthoLogs.length} notes d’orthophonie`].filter(Boolean);
        const extra = parts.length ? ` et ${parts.join(', ')}` : '';
        // v10.3.2 : la restauration AJOUTE la sauvegarde sans rien effacer. Rien n'est écrit avant le « OK » du parent.
        if (!window.confirm(`Ajouter ${backup.cards.length} cartes${extra} de la sauvegarde ?\n\nRien n’est effacé : les cartes, bilans, histoires et notes plus récents du téléphone sont gardés.`)) return;
        const localCards = await db.getAllCards();
        // v10.10 : les cartes restaurées sont marquées comme modifiées maintenant, sinon
        // une synchro suivante pourrait les remplacer par un paquet plus ancien.
        const now = Date.now();
        const incoming = backup.cards.map((c) => ({ ...c, updatedAt: now }));
        const cards = assignPositions(mergeBackupCards(localCards, incoming), state.cols);
        await db.putCards(cards);
        if (backup.trials.length) await db.putTrials(backup.trials);
        if (backup.visuals.length) {
          // Une photo personnalisée déjà sur le téléphone n'est pas remplacée.
          const localKeys = new Set((await db.getAllVisualOverrides()).map((v) => v.key));
          const newVisuals = backup.visuals.filter((v) => !localKeys.has(v.key));
          if (newVisuals.length) await db.putVisualOverrides(newVisuals);
        }
        if (backup.abcLogs.length) await db.putAbcLogs(backup.abcLogs);
        if (backup.orthoLogs.length) await db.putOrthoLogs(backup.orthoLogs);
        for (const key of EXPORTED_SETTINGS) {
          if (backup.settings[key] === undefined) continue;
          await db.setSetting(key, mergeBackupSetting(key, await db.getSetting(key), backup.settings[key]));
        }
        setCloudSpeechAllowed((await db.getSetting(SPEECH_SETTING_KEY)) === true);
        setTimerShowNumbers((await db.getSetting(TIMER_SETTING_KEY)) === true);
        applyUppercase((await db.getSetting(UPPERCASE_SETTING_KEY)) === true);
        await loadFriendsState().catch(() => {});
        await loadMorphologyState().catch(() => {});
        await loadContext();
        await loadVisuals();
        await loadLevels();
        state.cards = cards; state.strip = [];
        await saveLayoutFingerprint(state.cards); // Lot 2 (L2-10) : restauration = action adulte → nouvelle empreinte
        renderAll();
      } catch (error) {
        window.alert(error.message || 'Sauvegarde illisible.');
      }
    };
    // Au chargement du panneau adulte : vérifie la date de la dernière sauvegarde.
    refreshBackupReminder().catch(() => {});
    refreshFallbackBanner();
  }

  // ---------- v10.3.2 : restauration par fusion (rien n'est effacé, le plus récent du téléphone est gardé) ----------
  // Cartes : celles de la sauvegarde sont ajoutées ou mises à jour ; les cartes créées depuis restent.
  // Une photo, une vidéo ou une voix déjà sur le téléphone n'est pas perdue si la sauvegarde n'en a pas.
  function mergeBackupCards(localCards, backupCards) {
    const byId = new Map(localCards.map((c) => [c.id, c]));
    for (const card of backupCards) {
      const local = byId.get(card.id);
      if (!local) { byId.set(card.id, card); continue; }
      const merged = { ...local, ...card };
      // Lot 2 : les places déjà fixées dans le téléphone ne sont jamais écrasées par la sauvegarde.
      // La sauvegarde complète seulement les tailles encore absentes sur cet appareil.
      merged.positions = { ...(card.positions || {}), ...(local.positions || {}) };
      // L2-09 : l'identifiant stable ne manque jamais, même pour une carte d'une sauvegarde plus ancienne.
      merged.wordId = typeof local.wordId === 'string' && local.wordId ? local.wordId : (typeof card.wordId === 'string' && card.wordId ? card.wordId : merged.id);
      const fromBackup = foldLegacyAudio(card);
      const keptLocal = foldLegacyAudio(local);
      for (const field of ['photo', 'video']) merged[field] = card[field] || local[field] || null;
      // v10.21 (Lot 1) : les voix se gardent par langue dans audios[code] ; la sauvegarde fait foi, le téléphone complète.
      const audios = { ...(keptLocal.audios || {}) };
      for (const [code, blob] of Object.entries(fromBackup.audios || {})) if (blob) audios[code] = blob;
      merged.audios = audios;
      delete merged.audioFr;
      delete merged.audioDr;
      byId.set(card.id, merged);
    }
    return [...byId.values()];
  }

  const LIST_SETTINGS = ['stories', 'atecHistory', 'atec_history'];
  const itemKey = (item) => (item && typeof item === 'object' ? (item.id || `${item.day || ''}-${item.ts || ''}`) : JSON.stringify(item));
  function mergeBackupSetting(key, local, incoming) {
    if (local === undefined || local === null) return incoming;
    // Listes (histoires, bilans ATEC) : on additionne ; en cas de doublon, la version du téléphone gagne.
    if (LIST_SETTINGS.includes(key) && Array.isArray(local) && Array.isArray(incoming)) {
      const map = new Map(incoming.filter(Boolean).map((item) => [itemKey(item), item]));
      for (const item of local.filter(Boolean)) map.set(itemKey(item), item);
      return [...map.values()];
    }
    // Suggestions de mots : on garde le plus grand compteur de chaque mot.
    if (key === 'aacHistory' && typeof local === 'object' && typeof incoming === 'object') {
      const out = { uni: { ...(incoming.uni || {}) }, bi: { ...(incoming.bi || {}) } };
      for (const part of ['uni', 'bi']) for (const [k, v] of Object.entries(local[part] || {})) out[part][k] = Math.max(Number(v) || 0, Number(out[part][k]) || 0);
      return out;
    }
    // Plannings et réglages en objet : on ajoute ce qui manque, le téléphone garde ses valeurs.
    if (['customSchedules', 'scheduleTempOverrides', 'levels'].includes(key) && typeof local === 'object' && typeof incoming === 'object' && !Array.isArray(local)) {
      return { ...incoming, ...local };
    }
    return incoming;
  }

  return { applyLangDir, setupParentBar, setLang, openLangPicker };
}
