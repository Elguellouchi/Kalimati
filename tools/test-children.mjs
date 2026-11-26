// v10.36 : plusieurs enfants sur un téléphone (une base par enfant, la première base ne change pas de nom).
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
await import('../modules/storage.js');
const P = await import('../modules/child-profiles.js');
let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail += 1; console.error('✗', msg); } else console.log('✓', msg); };

ok(P.activeChildId() === 'main' && P.activeDbName() === 'kalimati', 'sans réglage : premier enfant, base d’origine « kalimati »');
const id = P.addChild('Enfant test', '👦', 1795440000000);
ok(P.isValidChildId(id) && P.dbNameFor(id) === `kalimati-child-${id}`, 'nouvel enfant = nouvelle base séparée');
ok(P.listChildren().length === 2 && P.listChildren()[0].id === 'main', 'liste : premier enfant puis le nouveau');
const workingStorage = globalThis.KalimatiStorage;
globalThis.KalimatiStorage = { ...workingStorage, setItem: () => false };
ok(P.setActiveChild(id) === false && P.activeChildId() === 'main', 'un changement d’enfant refusé n’annonce pas un succès');
globalThis.KalimatiStorage = workingStorage;
ok(P.setActiveChild(id) && P.activeDbName() === `kalimati-child-${id}`, 'ouvrir le nouvel enfant change de base');
ok(P.perChildKey('kalimati-rewards-v1') === `kalimati-rewards-v1:${id}`, 'étoiles propres à chaque enfant');
ok(await P.removeChild(id) === false, 'impossible d’effacer l’enfant ouvert');
P.setActiveChild('main');
ok(P.perChildKey('kalimati-rewards-v1') === 'kalimati-rewards-v1', 'premier enfant : clé d’origine inchangée');
ok(await P.removeChild('main') === false, 'impossible d’effacer le premier enfant');
ok(!P.setActiveChild('../hack') && P.activeChildId() === 'main', 'identifiant invalide refusé');
mem.set('kalimati-active-child', 'cinconnu1');
ok(P.activeChildId() === 'main', 'enfant inconnu dans le réglage : retour au premier enfant');
ok(P.cleanChildren([{ id: 'cabcde', name: 'x'.repeat(50) }, { id: 'bad id' }, null]).length === 2, 'liste nettoyée (premier enfant toujours présent)');

// Lot 2 (L2-01) : une base v10 remplie passe en v11 en gardant la place actuelle de chaque carte.
const DB = await import('../db.js');
const migrated = DB.upgradeCardToV11({ id: 'c-base-test', cat: 'base', gridRow: 3, gridCol: 2, positions: undefined }, 4);
ok(migrated && migrated.positions['4'].row === 3 && migrated.positions['4'].col === 2, 'migration v11 : chaque carte reçoit sa place pour la taille de grille actuelle');
ok(DB.upgradeCardToV11(migrated, 4) === null, 'migration v11 : une place déjà écrite n’est jamais retouchée');
const sansPlace = DB.upgradeCardToV11({ id: 'c-base-vide', cat: 'base', gridRow: null, gridCol: null }, 4);
ok(sansPlace && !sansPlace.positions && sansPlace.gridRow === null && sansPlace.wordId === 'c-base-vide', 'migration v11 : une carte sans place reste à placer — wordId oui, place jamais inventée');
if (fail) { console.error(`${fail} échec(s)`); process.exit(1); }
console.log('test-children : OK');
