// v10.33 : pages par lieu et tableau express.
import { PLACES, boardItems, cleanCustomBoards, passingCard } from '../modules/place-boards.js';
import { defaultCards } from '../data.js';
let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail += 1; console.error('✗', msg); } else console.log('✓', msg); };
const cards = defaultCards();
ok(cards.length > 50, `cartes de départ chargées (${cards.length})`);
for (const place of PLACES) {
  const items = boardItems(place, cards, (c) => [c.fr, c.dr]);
  const missing = items.filter((i) => !i.card).map((i) => i.text);
  ok(missing.length === 0 && items.length >= 10, `${place.title} : ${items.length} cases, toutes avec image${missing.length ? ` (manque ${missing.join(', ')})` : ''}`);
}
const express = boardItems({ text: 'Bonjour, gâteau\njouer, câlin, au revoir, xyzzy' }, cards, (c) => [c.fr, c.dr]);
ok(express.length === 6 && express.filter((i) => i.card).length === 5, 'tableau express : 5 images + 1 mot écrit');
ok(cleanCustomBoards([{ id: 'a', title: ' Chez X ', emoji: '🏠', text: 'pain' }, { id: '', title: 'y', text: 'z' }, 'bad', null]).length === 1, 'tableaux express nettoyés');
ok(cleanCustomBoards('nope').length === 0, 'réglage abîmé ignoré');
const dentiste = boardItems(PLACES[0], cards, (c) => [c.fr]);
const extra = dentiste.find((i) => i.card && i.card.extra);
ok(extra && passingCard(extra).fr === 'Bouche' && passingCard(extra).extra === true, 'mot dessiné → carte de passage (jamais enregistrée)');
const filtered = boardItems({ text: 'pomme, docteur, mer, banane' }, cards.filter((card) => card.fr !== 'Pomme'), (c) => [c.fr, c.dr], { excludedWords: ['Pomme', 'docteur', 'mer'] });
ok(filtered.length === 4 && filtered.slice(0, 3).every((item) => !item.card) && Boolean(filtered[3].card), 'tableau express : les exclusions sont transmises aux mots dessinés');
if (fail) { console.error(`${fail} échec(s)`); process.exit(1); }
console.log('test-places : OK');
