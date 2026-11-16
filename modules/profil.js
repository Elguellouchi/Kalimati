
// v9.8 : version neutre. Un nouveau téléphone ne reçoit plus aucun prénom ni lieu.
// L'Assistant de bienvenue ou « Progrès ➜ Profil » remplissent le profil, qui reste dans le téléphone.
export const PROFIL = {
  name: '', age: '', father: '', mother: 'Maman', sister: '', city: '', psy: '', period: '',
};

// Profil de la famille d'Aziz (son choix du 11/11/2026). Il sert UNIQUEMENT aux téléphones déjà installés
// avant la v9.8 qui n'avaient pas encore enregistré leur profil : ils le gardent tel quel, sans rien perdre.
export const LEGACY_PROFIL = {
  name: 'Abir', age: '8 ans', father: 'Aziz', mother: 'Maman', sister: 'Ghita', city: 'Salé', psy: 'Hosna',
};

// Libellés neutres quand le profil est vide.
export const NEUTRAL = { name: 'Mon enfant', sister: 'Sœur / Frère', psy: 'Thérapeute' };
