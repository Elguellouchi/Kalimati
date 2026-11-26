// Lot 1 / Tâche 2 (L1-03) : rappel de sauvegarde, uniquement en mode parent.
// Logique pure et sans dépendance lourde : testable sous Node avec un faux DOM.
import { h, btn } from './util.js';

export const BACKUP_REMIND_DAYS = 14;

// Nombre de jours depuis la dernière sauvegarde ; null = jamais sauvegardé sur ce téléphone.
export function backupAgeDays(lastBackupAt, now = Date.now()) {
  return lastBackupAt ? Math.floor((now - lastBackupAt) / 86400000) : null;
}

// Le rappel est nécessaire si l'on n'a jamais sauvegardé ou si la dernière sauvegarde a 14 jours ou plus.
export function backupReminderNeeded(days) {
  return days === null || days >= BACKUP_REMIND_DAYS;
}

// Bandeau de rappel, mode parent seulement. Renvoie null quand rien ne doit s'afficher.
// onBackup = action du bouton (équivalent à un clic sur #export).
export function backupReminderElement({ days, parent, onBackup } = {}) {
  if (!parent || !backupReminderNeeded(days)) return null;
  const message = days === null
    ? '⚠️ Aucune sauvegarde sur ce téléphone. '
    : `⚠️ Dernière sauvegarde il y a ${days} jour${days > 1 ? 's' : ''}. `;
  return h('p', { class: 'backup-reminder note', id: 'backup-reminder', role: 'alert' },
    message,
    btn('Faire une sauvegarde maintenant', () => { if (typeof onBackup === 'function') onBackup(); }, 'primary'));
}
