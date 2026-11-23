// v10.35 : conseil du jour de l'aidant (et porte-clés : vérifié dans le navigateur).
import { tipOfDay, TIP_COUNT } from '../modules/caregiver-tips.js';
let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail += 1; console.error('✗', msg); } else console.log('✓', msg); };
const d1 = new Date(2026, 10, 23, 8); const d1b = new Date(2026, 10, 23, 22); const d2 = new Date(2026, 10, 24, 8);
ok(TIP_COUNT >= 20, `${TIP_COUNT} conseils`);
ok(tipOfDay(d1) === tipOfDay(d1b), 'même conseil toute la journée');
ok(tipOfDay(d1) !== tipOfDay(d2), 'un autre conseil le lendemain');
const seen = new Set(); for (let i = 0; i < 40; i += 1) seen.add(tipOfDay(new Date(2026, 0, 1 + i), { hasPlaceBoards: true, hasScenes: true }));
ok(![...seen].some((t) => t.includes('photo de votre cuisine')), 'pas de conseil « scène » quand une scène existe déjà');
ok([...seen].every((t) => t.length < 200), 'conseils courts');
if (fail) { console.error(`${fail} échec(s)`); process.exit(1); }
console.log('test-keyring-tips : OK');
