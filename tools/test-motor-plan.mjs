// Lot 2, tâche 1 (L2-01 à L2-03) : plan moteur inviolable.
// Chaque carte garde une place par taille de grille (2, 3, 4, 5 colonnes). Changer de taille ne déplace
// jamais une carte : la place d'une taille jamais utilisée est calculée une seule fois, puis figée.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// db.js lit le localStorage au chargement (liste des enfants). On le simule, comme test-children.
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };

const layout = await import('../modules/grid-layout.js');
const db = await import('../db.js');
const { buildBackupFile, readBackup } = await import('../backup.js');

const snapshot = (value) => JSON.parse(JSON.stringify(value));
const flush = () => new Promise((resolve) => setImmediate(resolve));

// ---------- Fausse base v10 : deux magasins en mémoire, réponses différées comme IndexedDB ----------
function fakeV10Database(cards, settings) {
  const stores = {
    cards: new Map(cards.map((card) => [card.id, snapshot(card)])),
    settings: new Map(Object.entries(settings)),
  };
  const makeRequest = (run) => {
    const req = { onsuccess: null, onerror: null, result: undefined };
    queueMicrotask(() => {
      try { req.result = run(); if (req.onsuccess) req.onsuccess(); }
      catch (e) { if (req.onerror) req.onerror(e); }
    });
    return req;
  };
  const objectStore = (name) => ({
    get: (key) => makeRequest(() => stores[name].get(key)),
    getAll: () => makeRequest(() => [...stores[name].values()]),
    put: (value, key) => makeRequest(() => { stores[name].set(name === 'cards' ? value.id : key, snapshot(value)); }),
  });
  return { transaction: { objectStore }, stores };
}

function baseCards() {
  return [
    { id: 'c-base-a', cat: 'base', fr: 'Je veux', order: 1, gridRow: 1, gridCol: 1, hidden: false },
    { id: 'c-base-b', cat: 'base', fr: 'Oui', order: 2, gridRow: 1, gridCol: 2, hidden: false },
    { id: 'c-base-c', cat: 'base', fr: 'Non', order: 3, gridRow: 2, gridCol: 1, hidden: false },
    { id: 'c-base-d', cat: 'base', fr: 'Encore', order: 4, gridRow: 2, gridCol: 2, hidden: true },
    { id: 'c-base-nouvelle', cat: 'base', fr: '', order: 5, gridRow: null, gridCol: null, hidden: false },
  ];
}

// ---------- 1. Migration v10 → v11 ----------
{
  const fake = fakeV10Database(baseCards(), { cols: 4 });
  db.upgradeToV11(fake.transaction);
  await flush();
  await flush();
  const cards = [...fake.stores.cards.values()];
  const placed = cards.filter((card) => card.positions && card.positions['4']);
  assert.equal(placed.length, 4, 'migration v11 : les quatre cartes placées reçoivent leur place en 4 colonnes');
  for (const card of placed) {
    assert.deepEqual(card.positions['4'], { row: card.gridRow, col: card.gridCol }, `migration v11 : ${card.id} garde sa place actuelle`);
    assert.equal(card.gridRow, snapshot(baseCards().find((c) => c.id === card.id)).gridRow, `migration v11 : ${card.id} garde sa ligne d’origine`);
    assert.equal(card.gridCol, snapshot(baseCards().find((c) => c.id === card.id)).gridCol, `migration v11 : ${card.id} garde sa colonne d’origine`);
    assert.deepEqual(Object.keys(card.positions), ['4'], `migration v11 : seule la taille actuelle est écrite pour ${card.id}`);
    assert.equal(card.wordId, card.id, `migration v11 : ${card.id} reçoit son identifiant stable`);
  }
  const blank = cards.find((card) => card.id === 'c-base-nouvelle');
  assert.ok(!blank.positions || !blank.positions['4'], 'migration v11 : une carte sans place n’est pas inventée');
  assert.equal(blank.wordId, blank.id, 'migration v11 : une carte sans place reçoit aussi son identifiant stable');
}
{
  const fake = fakeV10Database(baseCards().slice(0, 3), { cols: 5 });
  db.upgradeToV11(fake.transaction);
  await flush();
  await flush();
  const card = fake.stores.cards.get('c-base-a');
  assert.deepEqual(card.positions['5'], { row: 1, col: 1 }, 'migration v11 : la taille actuelle vient du réglage « cols »');
}
{
  const fake = fakeV10Database(baseCards().slice(0, 3), {});
  db.upgradeToV11(fake.transaction);
  await flush();
  await flush();
  const card = fake.stores.cards.get('c-base-a');
  assert.deepEqual(card.positions['4'], { row: 1, col: 1 }, 'migration v11 : sans réglage, la grille de départ est 4 colonnes');
}

// ---------- 2. Changer de taille ne déplace jamais une carte (L2-02, L2-03) ----------
const identified = layout.assignPositions([{ ...baseCards()[0] }], 4);
assert.equal(identified[0].wordId, identified[0].id, 'chargement : une carte existante reçoit wordId = id');
const migrated = layout.assignPositions(baseCards(), 4)
  .map((card) => ({ ...card, positions: { '4': { row: card.gridRow, col: card.gridCol } } }));
// Les cartes non placées reçoivent aussi une place en 4 colonnes par assignPositions : on ne garde que les quatre du plan.
const plan = migrated.filter((card) => card.id !== 'c-base-nouvelle' && card.fr !== '');
const before4 = snapshot(plan.map((card) => card.positions['4']));

const three = layout.assignPositions(plan, 3);
assert.deepEqual(three.map((card) => card.positions['4']), before4, 'taille 4 → 3 : les places en 4 colonnes ne bougent pas');
for (const card of three) {
  assert.ok(card.positions['3'], `taille 3 : ${card.id} reçoit une place une seule fois`);
  assert.deepEqual({ row: card.gridRow, col: card.gridCol }, card.positions['3'], `taille 3 : ${card.id} s’affiche à sa place de la taille active`);
  assert.ok(card.positions['3'].col <= 3, `taille 3 : ${card.id} tient dans trois colonnes`);
}
const frozen3 = snapshot(three.map((card) => card.positions['3']));
const again3 = layout.assignPositions(three, 3);
assert.deepEqual(again3.map((card) => card.positions['3']), frozen3, 'taille 3 : la place calculée est figée, jamais recalculée');

let current = three;
for (const size of [2, 5, 3, 2]) current = layout.assignPositions(current, size);
assert.deepEqual(current.map((card) => card.positions['4']), before4, 'tailles 4 → 3 → 2 → 5 → 3 → 2 : les places en 4 colonnes ne bougent toujours pas');
assert.deepEqual(current.map((card) => card.positions['3']), frozen3, 'tailles 4 → 3 → 2 → 5 → 3 → 2 : les places en 3 colonnes ne bougent pas non plus');

// ---------- 3. Ajouter une carte : première case libre dans chaque taille (L2-04) ----------
const allSizes = layout.assignPositions(layout.assignPositions(layout.assignPositions(plan, 2), 3), 5);
const withAll = layout.assignPositions(allSizes, 4);
const slot = layout.nextFreeSlot(withAll, 'base', 4);
assert.deepEqual(Object.keys(slot.positions).sort(), ['2', '3', '4', '5'], 'ajout : la carte reçoit une place pour les quatre tailles');
for (const size of [2, 3, 4, 5]) {
  const taken = withAll
    .filter((card) => card.cat === 'base')
    .map((card) => card.positions[String(size)]);
  const place = slot.positions[String(size)];
  assert.ok(!taken.some((p) => p && p.row === place.row && p.col === place.col), `ajout : la place en ${size} colonnes est libre`);
  assert.ok(place.col <= size, `ajout : la place en ${size} colonnes tient dans la grille`);
}
assert.deepEqual(slot.positions['4'], { row: 1, col: 3 }, 'ajout : première case libre de la grille à 4 colonnes');
assert.deepEqual(slot.positions['2'], { row: 2, col: 1 }, 'ajout : première case libre de la grille à 2 colonnes (trous compris)');

// ---------- 4. Cacher une carte : la case reste réservée dans toutes les tailles (L2-05) ----------
const hiddenPlan = withAll.map((card) => (card.id === 'c-base-b' ? { ...card, hidden: true } : card));
const afterHide = layout.assignPositions(hiddenPlan, 4);
const hiddenBefore = snapshot(withAll.map((card) => card.positions));
assert.deepEqual(afterHide.map((card) => card.positions), hiddenBefore, 'cacher : aucune place ne change');
const slotAfterHide = layout.nextFreeSlot(afterHide, 'base', 4);
for (const size of [2, 3, 4, 5]) {
  const reserved = afterHide.find((card) => card.id === 'c-base-b').positions[String(size)];
  assert.notDeepEqual(slotAfterHide.positions[String(size)], reserved, `cacher : la case de la carte cachée reste prise en ${size} colonnes`);
}

// ---------- 5. Supprimer une carte : sa case se libère pour l'ajout suivant (L2-06) ----------
const deleted = afterHide.filter((card) => card.id !== 'c-base-b');
const slotAfterDelete = layout.nextFreeSlot(deleted, 'base', 4);
assert.deepEqual(slotAfterDelete.positions['4'], { row: 1, col: 2 }, 'supprimer : la case libérée est reprise à l’ajout suivant');
const afterDelete = layout.assignPositions(deleted, 4);
assert.deepEqual(afterDelete.map((card) => card.positions['4']), deleted.map((card) => card.positions['4']), 'supprimer : aucune autre carte ne bouge');

// ---------- 6. Déplacer une carte : seulement la taille active (L2-07, préparation) ----------
const moved = layout.moveCard(afterDelete, 'c-base-a', 2, 2, 4);
const movedCard = moved.find((card) => card.id === 'c-base-a');
assert.deepEqual(movedCard.positions['4'], { row: 2, col: 2 }, 'déplacer : la place de la taille active change');
assert.deepEqual(movedCard.positions['3'], afterDelete.find((card) => card.id === 'c-base-a').positions['3'], 'déplacer : la place en 3 colonnes ne change pas');
assert.deepEqual(movedCard.positions['2'], afterDelete.find((card) => card.id === 'c-base-a').positions['2'], 'déplacer : la place en 2 colonnes ne change pas');
assert.deepEqual(movedCard.positions['5'], afterDelete.find((card) => card.id === 'c-base-a').positions['5'], 'déplacer : la place en 5 colonnes ne change pas');
assert.equal(movedCard.gridRow, 2, 'déplacer : la ligne affichée suit la taille active');
assert.equal(movedCard.gridCol, 2, 'déplacer : la colonne affichée suit la taille active');
const swapped = moved.find((card) => card.id === 'c-base-d');
assert.deepEqual(swapped.positions['4'], { row: 1, col: 1 }, 'déplacer sur une case prise : les deux cartes échangent leur place');
assert.deepEqual(swapped.positions['3'], afterDelete.find((card) => card.id === 'c-base-d').positions['3'], 'échange : la place en 3 colonnes de l’autre carte ne change pas');

// ---------- 7. Empreinte stable du plan moteur (L2-10) ----------
{
  const fingerprintCards = [
    { id: 'c-base-b', wordId: 'mot-b', positions: { '2': { row: 2, col: 1 }, '4': { row: 1, col: 2 } } },
    { id: 'c-base-a', wordId: 'mot-a', positions: { '2': { row: 1, col: 1 }, '4': { row: 1, col: 1 } } },
  ];
  const canonical = ['mot-a:2:1:1', 'mot-a:4:1:1', 'mot-b:2:2:1', 'mot-b:4:1:2'].join('\n');
  const expected = createHash('sha256').update(canonical, 'utf8').digest('hex');
  assert.equal(await layout.layoutFingerprint(fingerprintCards), expected, 'empreinte : SHA-256 des places triées, indépendamment de l’ordre des cartes');
  assert.equal(await layout.layoutFingerprint([...fingerprintCards].reverse()), expected, 'empreinte : l’ordre du tableau ne change pas l’empreinte');
  assert.notEqual(await layout.layoutFingerprint([{ ...fingerprintCards[0], positions: { '4': { row: 3, col: 1 } } }, fingerprintCards[1]]), expected, 'empreinte : une place modifiée change l’empreinte');
}

// ---------- 8. Sauvegarde et restauration du plan moteur (L2-13) ----------
{
  const original = [{
    ...plan[0], wordId: 'mot-stable', positions: { ...plan[0].positions },
  }];
  const file = await buildBackupFile({ cards: original });
  const restored = await readBackup(file);
  assert.equal(restored.cards[0].wordId, 'mot-stable', 'restauration : wordId est conservé');
  assert.deepEqual(restored.cards[0].positions, original[0].positions, 'restauration : toutes les tailles de place sont conservées');
}
{
  const legacyCard = { id: 'c-base-a', cat: 'base', fr: 'Je veux', gridRow: 2, gridCol: 1, hidden: false };
  const file = new File([JSON.stringify({ format: 'kalimati-backup-v4', cards: [legacyCard] })], 'v10.json', { type: 'application/json' });
  const restored = await readBackup(file);
  const placed = layout.assignPositions(restored.cards, 5);
  assert.deepEqual(placed[0].positions['5'], { row: 2, col: 1 }, 'restauration v10 : la taille active reçoit la place historique gridRow/gridCol');
  assert.equal(placed[0].gridRow, 2, 'restauration v10 : la ligne active reste historique');
  assert.equal(placed[0].gridCol, 1, 'restauration v10 : la colonne active reste historique');
}

// ---------- 9. Paliers sans déplacement (L2-05, L2-12c) ----------
{
  const { applyProgressiveStage } = await import('../modules/core-vocabulary-plan.js');
  const realPlanCards = ['c-base-je-veux', 'c-base-oui', 'c-base-attends', 'c-actions-manger', 'c-actions-ouvrir', 'c-actions-courir']
    .map((id, index) => ({ id, cat: id.startsWith('c-actions') ? 'actions' : 'base', fr: id, order: index + 1, gridRow: null, gridCol: null, hidden: false,
      positions: { '2': { row: 1, col: 1 }, '3': { row: 2, col: 2 }, '4': { row: 3, col: 3 }, '5': { row: 4, col: 4 } } }));
  const before = snapshot(realPlanCards);
  const changed = applyProgressiveStage(realPlanCards, 1);
  for (let i = 0; i < realPlanCards.length; i += 1) {
    assert.deepEqual(changed[i].positions, before[i].positions, `palier : ${changed[i].id} garde toutes ses tailles de place`);
    assert.equal(changed[i].gridRow, null, `palier : ${changed[i].id} garde gridRow null (pas de déplacement)`);
    assert.equal(changed[i].gridCol, null, `palier : ${changed[i].id} garde gridCol null (pas de déplacement)`);
  }
  assert.equal(changed.find((c) => c.id === 'c-base-je-veux').hidden, false, 'palier 1 : Je veux (palier 1) reste visible');
  assert.equal(changed.find((c) => c.id === 'c-actions-manger').hidden, false, 'palier 1 : Manger (palier 1) reste visible');
  assert.equal(changed.find((c) => c.id === 'c-base-attends').hidden, true, 'palier 1 : Attends (palier 2) est masqué');
  assert.equal(changed.find((c) => c.id === 'c-actions-ouvrir').hidden, true, 'palier 1 : Ouvrir (palier 2) est masqué');
  assert.equal(changed.find((c) => c.id === 'c-actions-courir').hidden, true, 'palier 1 : Courir (palier 3) est masqué');
  const stage2 = applyProgressiveStage(before, 2);
  assert.equal(stage2.find((c) => c.id === 'c-base-attends').hidden, false, 'palier 2 : Attends est dévoilé');
  assert.equal(stage2.find((c) => c.id === 'c-actions-courir').hidden, true, 'palier 2 : Courir (palier 3) reste masqué');
  const stage3 = applyProgressiveStage(before, 3);
  assert.equal(stage3.every((c) => !c.hidden), true, 'palier 3 : tout est visible');
}

// ---------- 10. Fusion cloud sans perte de places (L2-13) ----------
{
  const local = { id: 'c-base-a', wordId: 'mot-a', positions: { '2': { row: 1, col: 1 }, '3': { row: 2, col: 2 } } };
  const remote = { id: 'c-base-a', positions: { '3': { row: 3, col: 1 }, '5': { row: 1, col: 1 } } };
  const merged = layout.mergeCardLayout(local, remote);
  assert.deepEqual(merged.positions, { '2': { row: 1, col: 1 }, '3': { row: 3, col: 1 }, '5': { row: 1, col: 1 } }, 'synchro : les tailles absentes du paquet distant restent locales');
  assert.equal(merged.wordId, 'mot-a', 'synchro : wordId local est conservé si le paquet ne le transporte pas');
}

// ---------- 11. Remise en ordre automatique explicite (L2-08) ----------
{
  const reordered = layout.relayout(moved, 4);
  assert.notDeepEqual(reordered.find((card) => card.id === 'c-base-a').positions['4'], moved.find((card) => card.id === 'c-base-a').positions['4'], 'remise en ordre : le bouton adulte peut redistribuer la taille active');
  assert.deepEqual(reordered.find((card) => card.id === 'c-base-a').positions['3'], moved.find((card) => card.id === 'c-base-a').positions['3'], 'remise en ordre : les autres tailles restent figées');
  const again = layout.assignPositions(reordered, 5);
  assert.deepEqual(again.find((card) => card.id === 'c-base-a').positions['4'], reordered.find((card) => card.id === 'c-base-a').positions['4'], 'remise en ordre : le nouveau plan est ensuite figé');
}

// ---------- 12. Le sélecteur de taille (#cols) ne modifie aucune place (L2-08) ----------
{
  const beforeCols = snapshot(withAll.map((card) => card.positions));
  let seq = withAll;
  for (const size of [2, 5, 3, 2]) seq = layout.assignPositions(seq, size);
  assert.deepEqual(seq.map((card) => card.positions), beforeCols, '#cols 2 → 5 → 3 → 2 : aucune place ne change dans aucune taille');
  for (const card of seq) {
    assert.deepEqual({ row: card.gridRow, col: card.gridCol }, card.positions['2'], `#cols : ${card.id} s’affiche à sa place de la taille active (2)`);
  }
}

// ---------- 13. Détection d'empreinte divergente (L2-11) ----------
{
  const cards = [{ id: 'c-a', wordId: 'mot-a', positions: { '4': { row: 1, col: 1 } } }];
  const stored = await layout.layoutFingerprint(cards);
  assert.equal(await layout.layoutFingerprintMismatch(cards, stored), false, 'empreinte identique : aucune alerte');
  assert.equal(await layout.layoutFingerprintMismatch(cards, null), false, 'empreinte absente : aucune alerte (première ouverture)');
  assert.equal(await layout.layoutFingerprintMismatch(cards, ''), false, 'empreinte vide : aucune alerte');
  const moved = [{ ...cards[0], positions: { '4': { row: 2, col: 1 } } }];
  assert.equal(await layout.layoutFingerprintMismatch(moved, stored), true, 'place modifiée : alerte');
}

// ---------- 14. Confirmation avant un déplacement adulte (L2-07) ----------
{
  const placed = moved.find((card) => card.id === 'c-base-a');
  assert.equal(layout.moveNeedsConfirmation(placed, 1, 3, 4), true, 'confirmation : une autre case de la taille active demande confirmation');
  assert.equal(layout.moveNeedsConfirmation(placed, placed.gridRow, placed.gridCol, 4), false, 'confirmation : la même case ne demande rien');
  assert.equal(layout.moveNeedsConfirmation(placed, 2, 2, 2), false, 'confirmation : une colonne hors de la taille active ne demande rien');
  assert.equal(layout.moveNeedsConfirmation(placed, 0, 1, 4), false, 'confirmation : une ligne absente ne demande rien');
  assert.equal(layout.moveNeedsConfirmation({ ...placed, gridRow: null, gridCol: null }, 1, 1, 4), false, 'confirmation : une carte jamais placée ne demande rien (première place)');
  assert.equal(layout.moveNeedsConfirmation(null, 1, 1, 4), false, 'confirmation : sans carte, rien à confirmer');
}

console.log('test-motor-plan : OK');
