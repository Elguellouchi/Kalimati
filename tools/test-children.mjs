// v10.36 : plusieurs enfants sur un téléphone (une base par enfant, la première base ne change pas de nom).
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const P = await import('../modules/child-profiles.js');
let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail += 1; console.error('✗', msg); } else console.log('✓', msg); };

ok(P.activeChildId() === 'main' && P.activeDbName() === 'kalimati', 'sans réglage : premier enfant, base d’origine « kalimati »');
const id = P.addChild('Sami', '👦', 1795440000000);
ok(P.isValidChildId(id) && P.dbNameFor(id) === `kalimati-child-${id}`, 'nouvel enfant = nouvelle base séparée');
ok(P.listChildren().length === 2 && P.listChildren()[0].id === 'main', 'liste : premier enfant puis le nouveau');
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
if (fail) { console.error(`${fail} échec(s)`); process.exit(1); }
console.log('test-children : OK');
