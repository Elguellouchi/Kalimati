// v10.32 : la phrase écrite par l'adulte devient des images (pépite DictaPicto).
import { buildIndex, matchPictos, normWord, extraConcepts } from '../modules/text-to-picto.js';
let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail += 1; console.error('✗', msg); } else console.log('✓', msg); };
const C = (id, fr, dr = '') => ({ id, fr, dr });
const cards = [C('veux', 'Je veux'), C('manger', 'Manger', 'Nakoul'), C('pain', 'Pain', 'Khobz'), C('ecole', 'École', 'Lmadrasa'),
  C('voiture', 'Voiture'), C('mal', "J'ai mal"), C('dessin', 'Dessin animé'), C('boire', 'Boire'), C('maman', 'Maman'), C('moi', 'Abir (Moi)'), C('aller', 'Aller')];
const idx = buildIndex(cards, (c) => [c.fr, c.dr]);
const ids = (t) => matchPictos(t, idx).map((x) => x.card ? x.card.id : `«${x.text}»`).join(' ');
ok(normWord("L'École !") === 'l ecole', 'accents et ponctuation retirés');
ok(ids('Je veux manger du pain') === 'veux manger pain', 'Je veux manger du pain → 3 images');
ok(ids("On va à l'école en voiture") === 'aller ecole voiture', "On va à l'école en voiture → aller, école, voiture");
ok(ids("J'ai mal") === 'mal', "J'ai mal → une seule image");
ok(ids('Tu regardes un dessin animé') === '«regardes» dessin', 'groupe de deux mots (dessin animé)');
ok(ids('Maman mange') === 'maman manger', 'verbe conjugué → infinitif');
ok(ids('Tu bois') === 'boire', 'verbe irrégulier → infinitif');
ok(ids('Abir va chez le médecin') === 'moi aller «chez» «médecin»', 'prénom (Moi) reconnu, mots sans image gardés');
ok(ids('bghit nakoul khobz') === '«bghit» manger pain', 'darija en lettres latines reconnue');
ok(ids('') === '', 'phrase vide');
const idx2 = buildIndex([...cards, ...extraConcepts()], (c) => (c.extra ? [c.fr, ...c.alt] : [c.fr, c.dr]));
const ids2 = (t) => matchPictos(t, idx2).map((x) => x.card ? x.card.id : `«${x.text}»`).join(' ');
ok(ids2('On va chez le médecin') === 'aller «chez» extra:médecin', 'mot de secours : médecin a un dessin');
ok(ids2('Demain on va au dentiste en bus') === 'extra:demain aller extra:dentiste extra:bus', 'sortie annoncée en images');
ok(matchPictos('Je veux du pain', idx2)[1].card.id === 'pain', 'une vraie carte passe avant le mot de secours');
const idx3 = buildIndex([...cards.filter((card) => card.id !== 'pain'), ...extraConcepts({ excludedWords: ['pomme', 'docteur', 'mer'] })], (c) => (c.extra ? [c.fr, ...c.alt] : [c.fr, c.dr]));
const ids3 = (t) => matchPictos(t, idx3).map((x) => x.card ? x.card.id : `«${x.text}»`).join(' ');
ok(ids3('pomme docteur mer') === '«pomme» «docteur» «mer»', 'un mot exclu ne réapparaît pas par un dessin ou un alias du catalogue');
ok(extraConcepts().length > 300, 'catalogue illustré disponible hors ligne');
if (fail) { console.error(`${fail} échec(s)`); process.exit(1); }
console.log('test-picto : OK');
