// Ateliers cliniques et aides CAA : la darija doit couvrir le français, avec les mêmes
// variables {…}, les mêmes emojis, et sans caractère arabe (affichage latin).
// Une clé française peut manquer en darija : clinicT retombe alors sur le français.
import { CLINIC_FR } from '../modules/clinic-i18n.js';
import { CLINIC_DR } from '../modules/clinic-i18n-dr.js';

let failed = 0;
const check = (ok, message) => { console.log(`${ok ? '✅' : '❌'} ${message}`); if (!ok) failed += 1; };

const placeholders = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join(',');
const emojis = (s) => (String(s).match(/\p{Extended_Pictographic}/gu) || []).sort().join('');
const arabic = (s) => /[\u0600-\u06FF\u0750-\u077F]/.test(String(s));

const FR = Object.keys(CLINIC_FR);
check(FR.length >= 90, `Textes français des ateliers (${FR.length})`);

const extra = Object.keys(CLINIC_DR).filter((k) => !CLINIC_FR[k]);
check(!extra.length, `Aucune clé darija inventée${extra.length ? ` — ${extra.join(', ')}` : ''}`);

const covered = FR.filter((k) => CLINIC_DR[k]).length;
check(covered === FR.length, `Tous les textes ont leur version darija (${covered}/${FR.length})`);

const badVars = FR.filter((k) => CLINIC_DR[k] && placeholders(CLINIC_DR[k]) !== placeholders(CLINIC_FR[k]));
check(!badVars.length, `Variables {…} préservées${badVars.length ? ` — ${badVars.join(', ')}` : ''}`);

const badEmoji = FR.filter((k) => CLINIC_DR[k] && emojis(CLINIC_DR[k]) !== emojis(CLINIC_FR[k]));
check(!badEmoji.length, `Emojis préservés${badEmoji.length ? ` — ${badEmoji.join(', ')}` : ''}`);

const badArabic = FR.filter((k) => CLINIC_DR[k] && arabic(CLINIC_DR[k]));
check(!badArabic.length, `Darija des ateliers en lettres latines${badArabic.length ? ` — ${badArabic.join(', ')}` : ''}`);

const empty = FR.filter((k) => CLINIC_DR[k] !== undefined && !String(CLINIC_DR[k]).trim());
check(!empty.length, `Aucune traduction vide${empty.length ? ` — ${empty.join(', ')}` : ''}`);

// Les clés du cœur CAA ajoutées en v10.15 doivent exister côté français et darija.
const CAA_KEYS = ['echoOn', 'echoCue', 'explore', 'exploreOn', 'search', 'searchPlaceholder', 'searchNotFound', 'searchFound',
  'quickOui', 'quickNon', 'quickWait', 'quickHelp', 'quickJoke', 'askFeel', 'askWant', 'askWhere', 'askWhat', 'annulled', 'restoreStep', 'tremor'];
const missingCaa = CAA_KEYS.filter((k) => !CLINIC_FR[k] || !CLINIC_DR[k]);
check(!missingCaa.length, `Clés CAA v10.15 présentes dans les deux langues${missingCaa.length ? ` — ${missingCaa.join(', ')}` : ''}`);

if (failed) { console.error(`\n${failed} contrôle(s) darija des ateliers en échec.`); process.exit(1); }
console.log('\n🎉 Ateliers cliniques et cœur CAA : parité français / darija vérifiée.');
