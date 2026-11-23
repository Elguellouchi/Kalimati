// Les espaces Jeux, Ma journée et Émotions doivent rester traduits en darija comme en français.
// Trois écritures coexistent : l'arabizi (option parent), la darija en lettres arabes (défaut)
// et l'arabe standard. Vérifie la parité des clés, les variables {…}, les emojis et l'écriture.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GOALS, SECTIONS } from '../modules/goals.js';
import { TX_DR, GOAL_DR, SECTION_DR, EMOTION_DR, SITUATION_DR, STORY_DR, ROUTINE_TEXT_DR, THEME_DR } from '../modules/section-i18n-dr.js';
import { TX_DRA, GOAL_DRA, SECTION_DRA, EMOTION_DRA, SITUATION_DRA, STORY_DRA, ROUTINE_TEXT_DRA, THEME_DRA } from '../modules/section-i18n-dr-ar.js';
import { TX_AR, GOAL_AR, SECTION_AR, EMOTION_AR, SITUATION_AR, STORY_AR, ROUTINE_TEXT_AR, THEME_AR } from '../modules/section-i18n-ar.js';

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
check(!arabic.length, `Jeu latin (option parent) sans caractères arabes${arabic.length ? ` — ${arabic.join(', ')}` : ''}`);

// --- v10.24 : la graphie arabe est le défaut de l'enfant, elle doit être complète --------------
const SIGLES = /PEI|ABA|ABLLS-R|PECS|Time Timer/g;
const sansJetons = (s) => String(s).replace(/\{\w+\}/g, ' ');
const latinRestant = (s) => (sansJetons(String(s).replace(SIGLES, '').replace(/[0-9]/g, ' ')).match(/[A-Za-zÀ-ÿ]{2,}/g) || []);
const ecritureOk = (table, nom) => {
  const mauvais = Object.entries(table).filter(([, v]) => !/[\u0600-\u06FF]/.test(String(v)) && /[A-Za-zÀ-ÿ]{2,}/.test(sansJetons(String(v))));
  check(!mauvais.length, `${nom} : chaque texte s'écrit en lettres arabes${mauvais.length ? ` — ${mauvais.map(([k]) => k).join(', ')}` : ''}`);
  const melange = Object.entries(table).filter(([, v]) => latinRestant(v).length);
  check(!melange.length, `${nom} : aucun mot latin resté (sigles admis)${melange.length ? ` — ${melange.map(([k, v]) => `${k}: ${latinRestant(v).join('/')}`).slice(0, 6).join(' | ')}` : ''}`);
};
for (const [tag, tables] of Object.entries({ DRA: { TX: TX_DRA, GOAL: GOAL_DRA, SECTION: SECTION_DRA, EMOTION: EMOTION_DRA, SITUATION: SITUATION_DRA, STORY: STORY_DRA, ROUTINE_TEXT: ROUTINE_TEXT_DRA, THEME: THEME_DRA },
  AR: { TX: TX_AR, GOAL: GOAL_AR, SECTION: SECTION_AR, EMOTION: EMOTION_AR, SITUATION: SITUATION_AR, STORY: STORY_AR, ROUTINE_TEXT: ROUTINE_TEXT_AR, THEME: THEME_AR } })) {
  const cle = (o) => Object.keys(o).sort().join(',');
  check(cle(tables.TX) === cle(FR), `${tag} : mêmes clés que l'interface française (${Object.keys(tables.TX).length})`);
  check(GOALS.every((g) => tables.GOAL[g.id]), `${tag} : tous les objectifs PEI traduits (${Object.keys(tables.GOAL).length}/${GOALS.length})`);
  check(SECTIONS.every((s) => tables.SECTION[s.id]), `${tag} : les ${Object.keys(tables.SECTION).length} domaines ABA ont un nom${tag === 'AR' ? ' en arabe' : ' en lettres arabes'}`);
  const mauvaisesVars = Object.keys(FR).filter((k) => tables.TX[k] && placeholders(tables.TX[k]) !== placeholders(FR[k]));
  check(!mauvaisesVars.length, `${tag} : variables {…} préservées${mauvaisesVars.length ? ` — ${mauvaisesVars.join(', ')}` : ''}`);
  const mauvaisEmoji = Object.keys(FR).filter((k) => tables.TX[k] && emojis(tables.TX[k]) !== emojis(FR[k]));
  check(!mauvaisEmoji.length, `${tag} : emojis préservés${mauvaisEmoji.length ? ` — ${mauvaisEmoji.join(', ')}` : ''}`);
  ecritureOk(tables.TX, `${tag} interface`);
  ecritureOk(tables.SECTION, `${tag} domaines`);
  ecritureOk(tables.GOAL, `${tag} objectifs`);
}
const arabizi = Object.entries(TX_DRA).filter(([, v]) => /[A-Za-z]\d|\d[A-Za-z]/.test(v)).map(([k]) => k);
check(!arabizi.length, `Darija en lettres arabes sans chiffres arabizi${arabizi.length ? ` — ${arabizi.join(', ')}` : ''}`);
check(Object.keys(TX_AR).length === Object.keys(TX_DRA).length, 'Arabe standard et darija arabe couvrent les mêmes textes');

check(GOALS.every((g) => GOAL_DR[g.id]), `Tous les objectifs PEI ont un titre darija (${Object.keys(GOAL_DR).length})`);
check(SECTIONS.every((s) => SECTION_DR[s.id]), `Tous les domaines ABA ont un nom darija (${Object.keys(SECTION_DR).length})`);
check(Object.keys(EMOTION_DR).length === 8, `8 émotions traduites (${Object.keys(EMOTION_DR).length})`);
check(Object.keys(SITUATION_DR).length === 8, `8 situations traduites (${Object.keys(SITUATION_DR).length})`);
check(Object.keys(STORY_DR).length === 6, `6 histoires traduites (${Object.keys(STORY_DR).length})`);
check(Object.keys(ROUTINE_TEXT_DR).length >= 20, `Routines d'accueil traduites (${Object.keys(ROUTINE_TEXT_DR).length})`);
check(Object.keys(THEME_DR).length === 4, `4 thèmes d'autocollants traduits (${Object.keys(THEME_DR).length})`);

// v10.24 : les colonnes darija écrites à la main (« dr » en lettres latines, « ar » en lettres arabes)
// ne doivent jamais mélanger les deux écritures dans une seule valeur — sinon l'option parent
// « lettres latines » affiche des caractères arabes, le défaut signalé sur téléphone (« Bit lma »).
const DATA_FILES = ['modules/ex-hygiene.js', 'modules/ex-schedule.js', 'modules/ex-autonomy.js',
  'modules/stories.js', 'modules/clinique.js', 'modules/friends.js', 'data.js'];
// Deux libellés d'interface assument le mélange : le bouton de langue et le nom du réglage d'écriture.
const PERMIS = [/Langue \/ اللغة \/ Language/, /Lettres arabes \(دارجة\)/];
const melanges = [];
for (const rel of DATA_FILES) {
  const lines = fs.readFileSync(path.join(root, rel), 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/(['"])((?:(?!\1)[^\\]|\\.)*?)\1/g)) {
      if (PERMIS.some((re) => re.test(m[2]))) continue;
      const valeur = m[2].replace(/\{\w+\}/g, ' '); // un jeton {x} n'est pas une lettre latine
      if (/[A-Za-zÀ-ÿ]/.test(valeur) && /[\u0600-\u06FF\u0750-\u077F]/.test(valeur)) melanges.push(`${rel}:${i + 1}`);
    }
  });
}
check(!melanges.length, `Une seule écriture par valeur des données darija${melanges.length ? ` — ${melanges.slice(0, 8).join(', ')}` : ''}`);

// v10.24 : trois affichages de l'écran enfant écrivaient le français en dur, quel que soit le réglage —
// le prénom de démonstration, les sièges de la famille (« Papa Maman ») et le bandeau des Amis
// (« Fennou le petit fennec … Écoute bien. »). Chacun doit suivre la langue et l'écriture choisies.
const lecture = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const ABA = lecture('modules/aba.js');
check(FR.childPlaceholder && /firstName = \(lang = 'fr'\)/.test(ABA) && /childPlaceholder', lang/.test(ABA),
  'Le prénom de démonstration se traduit dans la langue de l’enfant');
const SPACES = lecture('modules/spaces.js');
check(/cardWord\(card, L\)/.test(SPACES) && !/const family = \[.*'Papa'/.test(SPACES),
  'Les prénoms de la famille viennent des cartes traduites');
const FRIENDS = lecture('modules/friends.js');
check(/langEnfant \? f\.name/.test(FRIENDS) && !/textSub = \(lang === 'dr' \|\| lang === 'ar'\) \? p\.fr/.test(FRIENDS),
  'Le bandeau des Amis garde la langue de l’enfant');

if (failed) { console.error(`\n${failed} contrôle(s) darija en échec.`); process.exit(1); }
console.log('\n🎉 Espaces Jeux, Ma journée et Émotions : parité français / darija vérifiée.');
