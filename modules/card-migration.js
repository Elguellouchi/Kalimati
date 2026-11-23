// v10.18 : migrations des cartes v1 → v3, sorties de app.js pour être testables hors navigateur.
// Aucun prénom ni identifiant historique n'est écrit ici : l'ancienne carte « Moi » est
// reconnue par sa catégorie, son absence de personnalisation et le prénom du profil local.

export const stripNew = ({ newIn, ...card }) => card;
export const untouched = (card) => !card.photo && !card.video
  && !(card.audios && Object.keys(card.audios).length) && !card.audioFr && !card.audioDr;

export const isLegacySelfDuplicate = (card, selfId, name) => {
  const profileName = String(name || '').trim().toLocaleLowerCase('fr');
  return Boolean(profileName)
    && card.id !== selfId
    && card.cat === 'personnes'
    && untouched(card)
    && String(card.fr || '').trim().toLocaleLowerCase('fr') === profileName;
};

export function migrateCards(cards, fromVersion, { defaults, selfId, firstName }) {
  const byId = new Map(defaults.map((c) => [c.id, c]));
  const present = new Set(cards.map((c) => c.id));
  const upgraded = cards
    .filter((card) => !isLegacySelfDuplicate(card, selfId, firstName))
    .map((card) => {
      const base = byId.get(card.id);
      const next = {
        ...card,
        gram: card.gram || (base ? base.gram : 'noun'),
        ar: card.ar ?? (base ? base.ar : ''),
        video: card.video || null,
        hidden: Boolean(card.hidden),
        gridRow: card.gridRow || null,
        gridCol: card.gridCol || null,
        visualKey: card.visualKey || (base ? base.visualKey : null),
        sub: card.sub ?? (base ? base.sub : ''),
        sayFr: card.sayFr ?? (base ? base.sayFr : ''),
        sayAr: card.sayAr ?? (base ? base.sayAr : ''),
      };
      if (card.id === selfId && card.fr === 'Moi' && base) next.fr = base.fr;
      return next;
    });
  const added = defaults.filter((c) => c.newIn > fromVersion && !present.has(c.id)).map(stripNew);
  return [...upgraded, ...added];
}

// ---------- v10.20 : identifiants neutres pour les cartes de famille ----------
// Les tout premiers identifiants de cartes (« child », sœur, thérapeute) contenaient des fragments
// de prénoms. On les remplace par des identifiants techniques, sans jamais réécrire de prénom ici :
// les cartes de famille sont reconnues par leur forme (visualKey « person:* » hors rôles neutres).
export const NEUTRAL_PERSON_KEYS = new Set([
  'person:child', 'person:sibling', 'person:therapist',
  'person:papa', 'person:maman', 'person:papi', 'person:mamie', 'person:maitresse', 'person:camarade',
]);

// Une carte de famille historique = carte « personnes » dont le visualKey est « person:* » mais
// qui n'est pas un rôle neutre. La sœur se reconnaît à son libellé (« Sœur / Frère » ou sous-titre
// « Ma sœur ») ; l'autre carte restante est le thérapeute.
export function planPersonRename(cards = []) {
  const renameCardId = new Map();
  const renameVkey = new Map();
  const child = cards.find((c) => c.id === 'c-personnes-moi');
  if (child && typeof child.visualKey === 'string' && /^person:/.test(child.visualKey) && child.visualKey !== 'person:child') {
    renameVkey.set(child.visualKey, 'person:child');
  }
  for (const card of cards) {
    if (card.cat !== 'personnes' || card.id === 'c-personnes-moi') continue;
    const vkey = card.visualKey;
    if (typeof vkey !== 'string' || !/^person:/.test(vkey) || NEUTRAL_PERSON_KEYS.has(vkey)) continue;
    const isSibling = /œur|frère/i.test(`${card.sub || ''} ${card.fr || ''}`);
    const newVkey = isSibling ? 'person:sibling' : 'person:therapist';
    const newId = isSibling ? 'c-personnes-sibling' : 'c-personnes-therapist';
    renameVkey.set(vkey, newVkey);
    if (card.id !== newId) renameCardId.set(card.id, newId);
  }
  return { renameCardId, renameVkey };
}
