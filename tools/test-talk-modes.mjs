// v10.37 : modes Simple / Aide / Coach et recherche par intention.
import { TALK_MODES, normalizeTalkMode, showsHints, showsCoach, cardsForIntent } from '../modules/talk-modes.js';
import { defaultCards } from '../data.js';
let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail += 1; console.error('✗', msg); } else console.log('✓', msg); };
ok(TALK_MODES.map((m) => m.id).join() === 'simple,aide,coach', '3 modes');
ok(normalizeTalkMode(undefined) === 'coach' && normalizeTalkMode('x') === 'coach', 'par défaut : Coach (comme avant)');
ok(!showsHints('simple') && !showsCoach('simple'), 'Simple : ni aide ni coach');
ok(showsHints('aide') && !showsCoach('aide'), 'Aide : cartes qui brillent, pas de barre coach');
ok(showsHints('coach') && showsCoach('coach'), 'Coach : tout');
const cards = defaultCards();
const words = (q) => cardsForIntent(q, cards).map((c) => c.fr).join(',');
ok(words('il a soif') === 'Eau,Lait,Jus,Boire', 'il a soif → Eau, Lait, Jus, Boire');
ok(words("J'ai FAIM !").startsWith('Manger,Pain'), 'j’ai faim → Manger, Pain…');
ok(words('elle est fatiguée').includes('Dormir'), 'fatiguée → Dormir');
ok(words('il veut faire pipi') === 'Toilettes', 'pipi → Toilettes');
ok(words('il s ennuie') .includes('Jouer'), 's’ennuie → Jouer');
ok(words('pomme') === '', 'un simple mot n’est pas une intention (recherche par mot)');
for (const q of ['soif', 'faim', 'mal', 'dodo', 'pipi', 'peur', 'colère', 'triste', 'content', 'jouer', 'dehors', 'aide', 'froid', 'chaud', 'bain', 'fini', 'encore', 'bonjour']) {
  ok(cardsForIntent(q, cards).length >= 1, `intention « ${q} » : au moins une carte`);
}
if (fail) { console.error(`${fail} échec(s)`); process.exit(1); }
console.log('test-talk-modes : OK');
