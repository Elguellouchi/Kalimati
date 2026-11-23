// v10.34 : scènes sur vraie photo et grandes scènes à explorer.
import { GRID_SIZES, cleanScenes, cellBox, EXPLORE_SCENES } from '../modules/scenes.js';
import { buildIndex, matchPictos, extraConcepts } from '../modules/text-to-picto.js';
import { defaultCards } from '../data.js';
let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail += 1; console.error('✗', msg); } else console.log('✓', msg); };

ok(Object.keys(GRID_SIZES).join(',') === '4,9,12,15', 'quadrillages 4, 9, 12 et 15 cases');
for (const n of [4, 9, 12, 15]) {
  const last = cellBox(n, n - 1);
  ok(Math.abs(last.left + last.width - 100) < 0.01 && Math.abs(last.top + last.height - 100) < 0.01, `${n} cases : la dernière case touche le coin`);
}
const cleaned = cleanScenes([{ id: 's1', title: ' Cuisine ', size: 9, cells: { 0: 'pain', 4: 'eau', 12: 'trop loin', x: 'non', 2: '  ' } },
  { id: 's2', title: 'x', size: 7, cells: {} }, null, { title: 'sans id', size: 4 }]);
ok(cleaned.length === 1 && cleaned[0].title === 'Cuisine' && Object.keys(cleaned[0].cells).join(',') === '0,4', 'scènes nettoyées (cases hors quadrillage écartées)');
ok(!JSON.stringify(cleaned).includes('blob'), 'la liste des scènes ne contient jamais la photo');

const cards = defaultCards();
const index = buildIndex([...cards, ...extraConcepts()], (c) => (c.extra ? [c.fr, ...(c.alt || [])] : [c.fr, c.dr]));
for (const scene of EXPLORE_SCENES) {
  const missing = scene.items.filter((it) => !matchPictos(it.word, index, { skipSmallWords: false }).some((x) => x.card)).map((it) => it.word);
  const inside = scene.items.every((it) => it.x > 5 && it.x < 95 && it.y > 5 && it.y < 95);
  ok(!missing.length && inside && scene.items.length >= 8, `${scene.title} : ${scene.items.length} objets, tous avec image${missing.length ? ` (manque ${missing.join(', ')})` : ''}`);
}
if (fail) { console.error(`${fail} échec(s)`); process.exit(1); }
console.log('test-scenes : OK');
