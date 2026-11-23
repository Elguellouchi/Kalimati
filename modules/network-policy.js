// 🔒 Politique réseau du Socle Clinique : hors ligne strict par défaut.
// Aucune fonction réseau (Supabase, cohorte, ARASAAC/Wikipédia, voix Google) ne part
// tant que le parent n'a pas activé explicitement le « Mode équipe » dans Progrès.
import * as db from '../db.js';

export const NETWORK_MODE_KEY = 'networkMode';
export const NETWORK_MODE_CLINIC = 'clinic';
export const NETWORK_MODE_TEAM = 'team';

let teamMode = false;

export async function loadNetworkMode() {
  try {
    teamMode = (await db.getSetting(NETWORK_MODE_KEY)) === NETWORK_MODE_TEAM;
  } catch {
    teamMode = false;
  }
  return teamMode;
}

export const isTeamMode = () => teamMode;

export async function setTeamMode(enabled) {
  teamMode = enabled === true;
  try {
    await db.setSetting(NETWORK_MODE_KEY, teamMode ? NETWORK_MODE_TEAM : NETWORK_MODE_CLINIC);
  } catch {
    // Le mode reste appliqué en mémoire même si le stockage est momentanément indisponible.
  }
  return teamMode;
}

export function requireTeamMode(feature = 'cette fonction') {
  if (teamMode) return true;
  throw new Error(`Mode Socle Clinique (hors ligne strict) : ${feature} est désactivée. Ouvrez Progrès → Réseau et activez le « Mode équipe » pour l’autoriser explicitement.`);
}
