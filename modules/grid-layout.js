// Planification motrice : chaque carte garde une place fixe (gridRow, gridCol) dans sa catégorie,
// pour qu'Abir mémorise le geste. Une carte masquée garde sa place (case vide invisible).

const slotKey = (row, col) => `${row}:${col}`;
const readingOrder = (a, b) => (a.gridRow - b.gridRow) || (a.gridCol - b.gridCol) || (a.order - b.order);

function freeSlots(taken, cols) {
  let index = 0;
  return () => {
    for (;;) {
      const row = Math.floor(index / cols) + 1;
      const col = (index % cols) + 1;
      index += 1;
      if (!taken.has(slotKey(row, col))) { taken.add(slotKey(row, col)); return { gridRow: row, gridCol: col }; }
    }
  };
}

// Donne une place aux cartes qui n'en ont pas (ou plus, si la grille est devenue plus étroite), sans bouger les autres.
export function assignPositions(cards, cols) {
  const byCat = new Map();
  cards.forEach((c) => { if (!byCat.has(c.cat)) byCat.set(c.cat, []); byCat.get(c.cat).push(c); });
  const updated = new Map();
  for (const list of byCat.values()) {
    const placed = list.filter((c) => c.gridRow >= 1 && c.gridCol >= 1 && c.gridCol <= cols);
    const taken = new Set();
    const keep = [];
    const loose = list.filter((c) => !placed.includes(c));
    for (const c of placed.sort(readingOrder)) {
      const key = slotKey(c.gridRow, c.gridCol);
      if (taken.has(key)) loose.push(c); else { taken.add(key); keep.push(c); }
    }
    const next = freeSlots(taken, cols);
    loose.sort((a, b) => a.order - b.order).forEach((c) => updated.set(c.id, { ...c, ...next() }));
  }
  return cards.map((c) => updated.get(c.id) || c);
}

// Le parent change la taille des cartes : on garde l'ordre de lecture et on recompose la grille.
export function relayout(cards, cols) {
  const byCat = new Map();
  cards.forEach((c) => { if (!byCat.has(c.cat)) byCat.set(c.cat, []); byCat.get(c.cat).push(c); });
  const updated = new Map();
  for (const list of byCat.values()) {
    const rank = (c) => [c.gridRow || 1e6, c.gridCol || 1e6, c.order];
    const sorted = [...list].sort((a, b) => {
      const [ra, rb] = [rank(a), rank(b)];
      return (ra[0] - rb[0]) || (ra[1] - rb[1]) || (ra[2] - rb[2]);
    });
    sorted.forEach((c, i) => updated.set(c.id, { ...c, gridRow: Math.floor(i / cols) + 1, gridCol: (i % cols) + 1 }));
  }
  return cards.map((c) => updated.get(c.id) || c);
}

export function nextFreeSlot(cards, cat, cols) {
  const taken = new Set(cards.filter((c) => c.cat === cat && c.gridRow).map((c) => slotKey(c.gridRow, c.gridCol)));
  return freeSlots(taken, cols)();
}

// Place une carte à (row, col) ; si la case est prise, les deux cartes échangent leur place.
export function moveCard(cards, cardId, row, col) {
  const card = cards.find((c) => c.id === cardId);
  if (!card) return cards;
  const other = cards.find((c) => c.id !== cardId && c.cat === card.cat && c.gridRow === row && c.gridCol === col);
  return cards.map((c) => {
    if (c.id === cardId) return { ...c, gridRow: row, gridCol: col };
    if (other && c.id === other.id) return { ...c, gridRow: card.gridRow, gridCol: card.gridCol };
    return c;
  });
}
