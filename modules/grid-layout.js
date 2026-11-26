// Planification motrice : chaque carte garde une place fixe PAR TAILLE de grille (`positions`), pour que
// l'enfant mémorise le geste. Changer de taille ne déplace JAMAIS une carte : la place de la nouvelle
// taille est calculée une seule fois, puis figée. Une carte masquée garde sa place (case vide invisible).
// `gridRow` / `gridCol` restent écrits : ils recopient la place de la taille active, pour le reste du code.

export const GRID_SIZES = [2, 3, 4, 5];

const sizeKey = (cols) => String(Number(cols));
const slotKey = (row, col) => `${row}:${col}`;
const readingOrder = (a, b) => ((Number(a.gridRow) || 1e6) - (Number(b.gridRow) || 1e6))
  || ((Number(a.gridCol) || 1e6) - (Number(b.gridCol) || 1e6))
  || ((Number(a.order) || 0) - (Number(b.order) || 0));

const isPlace = (place, cols) => Boolean(place)
  && Number.isInteger(place.row) && Number.isInteger(place.col)
  && place.row >= 1 && place.col >= 1 && place.col <= cols;

const placeAt = (index, cols) => ({ row: Math.floor(index / cols) + 1, col: (index % cols) + 1 });

function placeIn(card, cols) {
  return isPlace(card.positions && card.positions[sizeKey(cols)], cols) ? card.positions[sizeKey(cols)] : null;
}

// Taille de la grille à laquelle appartiennent `gridRow` / `gridCol` : celle dont la place enregistrée
// leur correspond. À défaut (carte jamais positionnée), 4 colonnes.
function activeCols(card) {
  const positions = card.positions && typeof card.positions === 'object' ? card.positions : {};
  const filled = GRID_SIZES.filter((cols) => isPlace(positions[sizeKey(cols)], cols));
  const matching = filled.find((cols) => positions[sizeKey(cols)].row === card.gridRow && positions[sizeKey(cols)].col === card.gridCol);
  return matching || filled[0] || 4;
}

// Rang de la carte dans l'ordre de lecture de sa taille active (ligne, puis colonne).
function readingIndex(card) {
  const row = Number(card.gridRow);
  const col = Number(card.gridCol);
  if (!(row >= 1) || !(col >= 1)) return 0;
  return (row - 1) * activeCols(card) + (col - 1);
}

// Règle L2-03 : place d'une carte dans une taille jamais utilisée. Ordre de lecture de la taille active,
// rempli de gauche à droite, de haut en bas dans la nouvelle taille. Calculée une fois, puis figée :
// une place déjà enregistrée n'est jamais retouchée (même si `occupied` la signale).
export function ensurePositions(card, cols, occupied = new Set()) {
  const existing = placeIn(card, cols);
  if (existing) return existing;
  let index = readingIndex(card);
  for (;;) {
    const slot = placeAt(index, cols);
    if (!occupied.has(slotKey(slot.row, slot.col))) return slot;
    index += 1;
  }
}

// Toutes les places déjà prises dans une taille : cartes figées, puis cartes encore sans place
// (dans l'ordre de lecture). Sert aussi à prévoir la place d'une carte ajoutée.
function plannedSlots(list, cols) {
  const taken = new Set();
  for (const card of list) {
    const place = placeIn(card, cols);
    if (place) taken.add(slotKey(place.row, place.col));
  }
  const missing = list.filter((card) => !placeIn(card, cols)).sort(readingOrder);
  for (const card of missing) {
    const place = ensurePositions(card, cols, taken);
    taken.add(slotKey(place.row, place.col));
  }
  return taken;
}

// Donne sa place aux cartes qui n'en ont pas encore POUR CETTE TAILLE, sans jamais bouger les autres.
// Le tri se fait par catégorie : chaque tableau a ses propres lignes et colonnes.
export function assignPositions(cards, cols) {
  const source = cards.map((card) => {
    const positions = card.positions && typeof card.positions === 'object' ? card.positions : {};
    const row = Number(card.gridRow);
    const col = Number(card.gridCol);
    if (!Object.keys(positions).length && Number.isInteger(row) && Number.isInteger(col) && row >= 1 && col >= 1 && col <= cols) {
      return { ...card, positions: { ...positions, [sizeKey(cols)]: { row, col } } };
    }
    return card;
  });
  const byCat = new Map();
  source.forEach((c) => { if (!byCat.has(c.cat)) byCat.set(c.cat, []); byCat.get(c.cat).push(c); });
  const updated = new Map();
  for (const list of byCat.values()) {
    const places = new Map();
    for (const card of list) {
      const place = placeIn(card, cols);
      if (place) places.set(card.id, place);
    }
    const missing = list.filter((card) => !places.has(card.id)).sort(readingOrder);
    const taken = new Set([...places.values()].map((place) => slotKey(place.row, place.col)));
    for (const card of missing) {
      const place = ensurePositions(card, cols, taken);
      places.set(card.id, place);
      taken.add(slotKey(place.row, place.col));
    }
    for (const card of list) {
      const place = places.get(card.id);
      const wordId = typeof card.wordId === 'string' && card.wordId ? card.wordId : card.id;
      if (placeIn(card, cols) && card.gridRow === place.row && card.gridCol === place.col && card.wordId === wordId) continue;
      updated.set(card.id, { ...card, wordId, positions: { ...(card.positions || {}), [sizeKey(cols)]: place }, gridRow: place.row, gridCol: place.col });
    }
  }
  return updated.size ? source.map((c) => updated.get(c.id) || c) : source;
}

// Première case libre, dans chaque taille (2, 3, 4 et 5 colonnes), pour une carte qui arrive.
export function nextFreeSlot(cards, cat, cols) {
  const same = cards.filter((c) => c.cat === cat);
  const positions = {};
  for (const size of GRID_SIZES) {
    const taken = plannedSlots(same, size);
    let index = 0;
    let slot = placeAt(index, size);
    while (taken.has(slotKey(slot.row, slot.col))) { index += 1; slot = placeAt(index, size); }
    positions[sizeKey(size)] = slot;
  }
  const place = positions[sizeKey(cols)];
  return { gridRow: place.row, gridCol: place.col, positions };
}

// Déplacement par le parent : seulement la place de la taille active (`cols`). Les autres tailles
// gardent leur place. Si la case est prise, les deux cartes échangent leur place.
export function moveCard(cards, cardId, row, col, cols) {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return cards;
  const other = cards.find((c) => c.id !== cardId && c.cat === card.cat && c.gridRow === row && c.gridCol === col);
  const key = sizeKey(cols);
  const before = Number.isInteger(card.gridRow) && Number.isInteger(card.gridCol) ? { row: card.gridRow, col: card.gridCol } : null;
  return cards.map((c) => {
    if (c.id === cardId) return { ...c, positions: { ...(c.positions || {}), [key]: { row, col } }, gridRow: row, gridCol: col };
    if (before && other && c.id === other.id) return { ...c, positions: { ...(c.positions || {}), [key]: before }, gridRow: before.row, gridCol: before.col };
    return c;
  });
}

// L2-07 : un déplacement par le parent change le geste appris par l'enfant. L'éditeur demande
// confirmation (2 touchers) seulement pour un vrai déplacement : une carte jamais placée, la même
// case, ou une colonne hors de la taille active ne demandent rien.
export function moveNeedsConfirmation(card, row, col, cols) {
  if (!card || !Number.isInteger(row) || !Number.isInteger(col) || row < 1 || col < 1 || col > cols) return false;
  if (!Number.isInteger(card.gridRow) || !Number.isInteger(card.gridCol)) return false;
  return !(card.gridRow === row && card.gridCol === col);
}

// L2-08 : remise en ordre automatique, appelée UNIQUEMENT par le bouton « Remettre en ordre automatique »
// du panneau parent (2 touchers). Redistribue la taille active (`cols`) par catégorie, dans l'ordre de
// lecture actuel (ligne, colonne, ordre) ; les autres tailles gardent leur place.
export function relayout(cards, cols) {
  const key = sizeKey(cols);
  const byCat = new Map();
  cards.forEach((c) => { if (!byCat.has(c.cat)) byCat.set(c.cat, []); byCat.get(c.cat).push(c); });
  const updated = new Map();
  for (const list of byCat.values()) {
    const sorted = [...list].sort(readingOrder);
    sorted.forEach((c, i) => updated.set(c.id, {
      ...c,
      positions: { ...(c.positions || {}), [key]: placeAt(i, cols) },
      gridRow: Math.floor(i / cols) + 1,
      gridCol: (i % cols) + 1,
    }));
  }
  return cards.map((c) => updated.get(c.id) || c);
}

export async function layoutFingerprint(cards) {
  const lines = [];
  for (const card of cards) {
    const wordId = typeof card.wordId === 'string' && card.wordId ? card.wordId : card.id;
    for (const size of GRID_SIZES) {
      const place = card.positions && card.positions[String(size)];
      if (isPlace(place, size)) lines.push(`${wordId}:${size}:${place.row}:${place.col}`);
    }
  }
  const bytes = new TextEncoder().encode(lines.sort().join('\n'));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function layoutFingerprintMismatch(cards, stored) {
  if (typeof stored !== 'string' || !stored) return false;
  return (await layoutFingerprint(cards)) !== stored;
}

export function mergeCardLayout(local = {}, remote = {}) {
  const merged = { ...local, ...remote };
  merged.positions = { ...(local.positions || {}), ...(remote.positions || {}) };
  merged.wordId = remote.wordId || local.wordId || merged.id;
  return merged;
}
