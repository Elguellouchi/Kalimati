// 🔒 Réglage parent « Socle Clinique / Mode équipe » et retour au silence réseau.
import * as db from '../db.js';
import { h } from './util.js';
import { isTeamMode, setTeamMode } from './network-policy.js';
import { setOnlineLookupAllowed } from './online-bank.js';
import { setCloudSpeechAllowed, SPEECH_SETTING_KEY } from '../speech.js';
import { saveCloudSyncConfig, COHORT_OPTIN_KEY } from './cloud-sync.js';

// Repasse toutes les fonctions réseau à l'arrêt. Le mode clinique reste le défaut.
export async function applyStrictClinicalMode() {
  await setTeamMode(false);
  await setOnlineLookupAllowed(false);
  setCloudSpeechAllowed(false);
  try {
    await db.setSetting(SPEECH_SETTING_KEY, false);
    await db.setSetting(COHORT_OPTIN_KEY, false);
  } catch {}
  try {
    await saveCloudSyncConfig({ autoSyncWifi: false });
  } catch {}
}

export function networkModeBox() {
  const status = h('p', { class: 'note' });
  const teamChk = h('input', {
    type: 'checkbox',
    checked: isTeamMode() ? 'checked' : null,
    onchange: async (e) => {
      if (e.target.checked) await setTeamMode(true);
      else await applyStrictClinicalMode();
      render();
    },
  });

  function render() {
    const on = isTeamMode();
    teamChk.checked = on;
    status.textContent = on
      ? '🟠 Mode équipe activé. Les fonctions réseau restent ensuite allumées une par une : synchro Supabase, cohorte d’étude, images ARASAAC/Wikipédia et reconnaissance vocale Google. Rien ne part tant que la fonction concernée n’est pas aussi cochée.'
      : '🟢 Mode Socle Clinique strict (par défaut) : Kalimati fonctionne entièrement hors ligne. Aucune synchro, aucun envoi à Supabase, ARASAAC, Wikipédia ou Google. Les images et voix déjà gardées dans le téléphone restent disponibles.';
  }
  render();

  return h('details', { class: 'card-box' },
    h('summary', {}, '🔒 Réseau : Socle Clinique strict / Mode équipe'),
    h('div', { class: 'stack' },
      status,
      h('label', { class: 'check' }, teamChk, ' J’active le « Mode équipe » (facultatif, réversible à tout moment)'),
      h('p', { class: 'note' },
        'Le Mode équipe autorise seulement l’accès aux fonctions réseau ci-dessous, chacune restant éteinte par défaut. En revenant au mode strict, la synchro automatique, la cohorte, les images en ligne et la voix Google sont éteintes. Les fonctions cloud restent indisponibles dans la version d’essai. Une copie déjà envoyée au serveur doit être supprimée avant de quitter le Mode équipe (boutons dans « Synchronisation »).')));
}
