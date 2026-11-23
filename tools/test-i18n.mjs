// Les espaces Jeux, Ma journée et Émotions doivent rester traduits en darija comme en français.
// Vérifie la parité des clés, les variables {…}, les emojis et l'absence de texte arabe dans l'interface darija.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOALS, SECTIONS } from '../modules/goals.js';
import { TX_DR, GOAL_DR, SECTION_DR, EMOTION_DR, SITUATION_DR, STORY_DR, ROUTINE_TEXT_DR, THEME_DR } from '../modules/section-i18n-dr.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'modules', 'section-i18n.js'), 'utf8');
const frBlock = src.slice(src.indexOf('fr: {'), src.indexOf('\n  },\n};'));
const FR = Object.fromEntries([...frBlock.matchAll(/^    (\w+): (?:'([^']*)'|"([^"]*)"),$/gm)]
  .map((m) => [m[1], m[2] ?? m[3]]));

let failed = 0;
const check = (ok, message) => { console.log(`${ok ? '✅' : '❌'} ${message}`); if (!ok) failed += 1; };

const placeholders = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
const emojis = (s) => (String(s).match(/\p{Extended_Pictographic}/gu) || []).sort().join('');

check(Object.keys(FR).length > 100, `Textes français extraits (${Object.keys(FR).length})`);
const missing = Object.keys(FR).filter((k) => !TX_DR[k]);
check(!missing.length, `Chaque texte a sa version darija${missing.length ? ` — manque : ${missing.join(', ')}` : ''}`);
const extra = Object.keys(TX_DR).filter((k) => !FR[k]);
check(!extra.length, `Aucune clé darija inventée${extra.length ? ` — ${extra.join(', ')}` : ''}`);

const badVars = Object.keys(FR).filter((k) => TX_DR[k] && placeholders(TX_DR[k]) !== placeholders(FR[k]));
check(!badVars.length, `Variables {…} préservées${badVars.length ? ` — ${badVars.join(', ')}` : ''}`);
const badEmoji = Object.keys(FR).filter((k) => TX_DR[k] && emojis(TX_DR[k]) !== emojis(FR[k]));
check(!badEmoji.length, `Emojis préservés${badEmoji.length ? ` — ${badEmoji.join(', ')}` : ''}`);
const arabic = [...Object.entries(TX_DR), ...Object.entries(GOAL_DR), ...Object.entries(SITUATION_DR)]
  .filter(([, v]) => /[\u0600-\u06FF]/.test(v)).map(([k]) => k);
check(!arabic.length, `Interface darija en lettres latines${arabic.length ? ` — ${arabic.join(', ')}` : ''}`);

check(GOALS.every((g) => GOAL_DR[g.id]), `Tous les objectifs PEI ont un titre darija (${Object.keys(GOAL_DR).length})`);
check(SECTIONS.every((s) => SECTION_DR[s.id]), `Tous les domaines ABA ont un nom darija (${Object.keys(SECTION_DR).length})`);
check(Object.keys(EMOTION_DR).length === 8, `8 émotions traduites (${Object.keys(EMOTION_DR).length})`);
check(Object.keys(SITUATION_DR).length === 8, `8 situations traduites (${Object.keys(SITUATION_DR).length})`);
check(Object.keys(STORY_DR).length === 6, `6 histoires traduites (${Object.keys(STORY_DR).length})`);
check(Object.keys(ROUTINE_TEXT_DR).length >= 20, `Routines d'accueil traduites (${Object.keys(ROUTINE_TEXT_DR).length})`);
check(Object.keys(THEME_DR).length === 4, `4 thèmes d'autocollants traduits (${Object.keys(THEME_DR).length})`);

if (failed) { console.error(`\n${failed} contrôle(s) darija en échec.`); process.exit(1); }
console.log('\n🎉 Espaces Jeux, Ma journée et Émotions : parité français / darija vérifiée.');
