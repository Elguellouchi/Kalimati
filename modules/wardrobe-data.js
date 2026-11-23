// v10.39 (pépite « Étoiles pour habiller le compagnon ») : chaque étoile gagnée devient une pièce.
// Avec ses pièces, l'enfant achète des habits pour Nour, puis les met ou les enlève.
// Une pièce dépensée ne fait jamais perdre d'étoile ni d'autocollant. Tout reste dans le téléphone.

// [id, emoji, nom, place, prix en étoiles]
export const WARDROBE = [
  ['noeud', '🎀', 'Nœud', 'tete', 3],
  ['casquette', '🧢', 'Casquette', 'tete', 5],
  ['fleur', '🌸', 'Fleur', 'tete', 4],
  ['couronne', '👑', 'Couronne', 'tete', 12],
  ['chapeau', '🎩', 'Chapeau', 'tete', 8],
  ['lunettes', '👓', 'Lunettes', 'yeux', 4],
  ['soleil', '🕶️', 'Lunettes de soleil', 'yeux', 6],
  ['echarpe', '🧣', 'Écharpe', 'cou', 5],
  ['medaille', '🏅', 'Médaille', 'cou', 10],
  ['ballon', '🎈', 'Ballon', 'main', 3],
  ['sac', '🎒', 'Sac à dos', 'main', 7],
  ['etoile', '🌟', 'Baguette étoile', 'main', 9],
].map(([id, emoji, name, slot, price]) => ({ id, emoji, name, slot, price }));

export const SLOTS = ['tete', 'yeux', 'cou', 'main'];
export const ITEM_BY_ID = new Map(WARDROBE.map((i) => [i.id, i]));

export function cleanWardrobe(value) {
  const v = value && typeof value === 'object' ? value : {};
  const owned = [...new Set((Array.isArray(v.owned) ? v.owned : []).filter((id) => ITEM_BY_ID.has(id)))];
  const spent = owned.reduce((sum, id) => sum + ITEM_BY_ID.get(id).price, 0);
  const worn = {};
  for (const slot of SLOTS) {
    const id = v.worn && v.worn[slot];
    if (owned.includes(id) && ITEM_BY_ID.get(id).slot === slot) worn[slot] = id;
  }
  return { owned, worn, spent };
}

// Pièces disponibles = toutes les étoiles gagnées depuis le début − habits achetés.
export const coinsLeft = (totalStars, wardrobe) => Math.max(0, (totalStars | 0) - cleanWardrobe(wardrobe).spent);

export function buyItem(wardrobe, id, totalStars) {
  const w = cleanWardrobe(wardrobe);
  const item = ITEM_BY_ID.get(id);
  if (!item) return { ok: false, reason: 'inconnu', wardrobe: w };
  if (w.owned.includes(id)) return { ok: false, reason: 'deja', wardrobe: w };
  if (coinsLeft(totalStars, w) < item.price) return { ok: false, reason: 'pieces', wardrobe: w };
  const next = cleanWardrobe({ owned: [...w.owned, id], worn: { ...w.worn, [item.slot]: id } });
  return { ok: true, wardrobe: next };
}

// Met l'habit (il remplace celui de la même place) ou l'enlève s'il est déjà mis.
export function toggleWear(wardrobe, id) {
  const w = cleanWardrobe(wardrobe);
  const item = ITEM_BY_ID.get(id);
  if (!item || !w.owned.includes(id)) return w;
  const worn = { ...w.worn };
  if (worn[item.slot] === id) delete worn[item.slot]; else worn[item.slot] = id;
  return cleanWardrobe({ owned: w.owned, worn });
}
