// v10.38 : parcours souffle → voyelles → syllabes → mots, et ballon à la voix.
import { PATH_STEPS, cleanPath, isOpen, nextBalloon, WINS_TO_OPEN } from '../modules/ortho-path-data.js';
let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail += 1; console.error('✗', msg); } else console.log('✓', msg); };
ok(PATH_STEPS.map((s) => s.id).join() === 'souffle,voix,voyelles,syllabes,mots', '5 étapes, du souffle aux mots');
ok(PATH_STEPS.every((s) => s.targets.length >= 3), 'au moins 3 cibles par étape');
const empty = cleanPath(null);
ok(isOpen(empty, 0) && !isOpen(empty, 1), 'au début : seule l’étape Souffle est ouverte');
const two = cleanPath({ wins: { souffle: WINS_TO_OPEN } });
ok(isOpen(two, 1) && !isOpen(two, 2), `${WINS_TO_OPEN} réussites au souffle ouvrent la voix longue`);
ok(cleanPath({ wins: { souffle: -4, mots: 'x', autre: 5 } }).wins.souffle === 0 && !('autre' in cleanPath({ wins: { autre: 5 } }).wins), 'réglage abîmé nettoyé');
let size = 0; for (let i = 0; i < 200; i += 1) size = nextBalloon(size, 0.5);
ok(size === 1, 'une voix qui dure remplit le ballon');
let quiet = 0.5; for (let i = 0; i < 400; i += 1) quiet = nextBalloon(quiet, 0.02);
ok(quiet === 0, 'en silence, le ballon redescend doucement');
let frames = 0; let s = 0; while (s < 1 && frames < 1000) { s = nextBalloon(s, 0.4); frames += 1; }
ok(frames > 120 && frames < 260, `ballon plein en ${frames} images (~${Math.round(frames / 60 * 10) / 10} s de voix)`);
if (fail) { console.error(`${fail} échec(s)`); process.exit(1); }
console.log('test-ortho-path : OK');
