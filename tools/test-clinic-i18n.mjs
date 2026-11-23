// Ateliers cliniques et aides CAA : la darija et l'arabe doivent couvrir le français, avec les
// mêmes variables {…} et les mêmes emojis. Trois écritures : arabizi (option parent), lettres
// arabes (défaut v10.24) et arabe standard.
// Une clé française peut manquer en darija : clinicT retombe alors sur le français.
import { CLINIC_FR } from '../modules/clinic-i18n.js';
import { CLINIC_DR } from '../modules/clinic-i18n-dr.js';
import { CLINIC_DRA } from '../modules/clinic-i18n-dr-ar.js';
import { CLINIC_AR } from '../modules/clinic-i18n-ar.js';

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
check(!badArabic.length, `Jeu latin des ateliers (option parent)${badArabic.length ? ` — ${badArabic.join(', ')}` : ''}`);

// --- v10.24 : les ateliers se lisent aussi en lettres arabes et en arabe standard --------------
const SIGLES = /PEI|ABA|PECS|OK Stop/g;
const sansJetons = (s) => String(s).replace(/\{\w+\}/g, ' ');
const motsLatins = (v) => (sansJetons(String(v).replace(SIGLES, '')).match(/[A-Za-zÀ-ÿ]{2,}/g) || []);
for (const [tag, table] of [['lettres arabes', CLINIC_DRA], ['arabe standard', CLINIC_AR]]) {
  const inventees = Object.keys(table).filter((k) => !CLINIC_FR[k]);
  check(!inventees.length, `${tag} : aucune clé inventée${inventees.length ? ` — ${inventees.join(', ')}` : ''}`);
  const couvertes = FR.filter((k) => table[k]).length;
  check(couvertes === FR.length, `${tag} : tous les ateliers traduits (${couvertes}/${FR.length})`);
  const sansArabe = FR.filter((k) => table[k] && !arabic(table[k]) && sansJetons(String(table[k]).replace(SIGLES, '').replace(/[\p{Extended_Pictographic}\p{N}\p{P}\s]/gu, '')).length > 0);
  check(!sansArabe.length, `${tag} : chaque libellé s'écrit en lettres arabes${sansArabe.length ? ` — ${sansArabe.join(', ')}` : ''}`);
  const mixtes = FR.filter((k) => table[k] && motsLatins(table[k]).length);
  check(!mixtes.length, `${tag} : aucun mot latin resté (sigles admis)${mixtes.length ? ` — ${mixtes.map((k) => `${k}: ${motsLatins(table[k]).join('/')}`).slice(0, 6).join(' | ')}` : ''}`);
  const arabizi = FR.filter((k) => table[k] && /[A-Za-z]\d|\d[A-Za-z]/.test(sansJetons(table[k])));
  check(!arabizi.length, `${tag} : pas de chiffres arabizi${arabizi.length ? ` — ${arabizi.join(', ')}` : ''}`);
  const vars = FR.filter((k) => table[k] && placeholders(table[k]) !== placeholders(CLINIC_FR[k]));
  check(!vars.length, `${tag} : variables {…} préservées${vars.length ? ` — ${vars.join(', ')}` : ''}`);
  const emj = FR.filter((k) => table[k] && emojis(table[k]) !== emojis(CLINIC_FR[k]));
  check(!emj.length, `${tag} : emojis préservés${emj.length ? ` — ${emj.join(', ')}` : ''}`);
}

const empty = FR.filter((k) => CLINIC_DR[k] !== undefined && !String(CLINIC_DR[k]).trim());
check(!empty.length, `Aucune traduction vide${empty.length ? ` — ${empty.join(', ')}` : ''}`);

// Les clés du cœur CAA ajoutées en v10.15 doivent exister côté français et darija.
const CAA_KEYS = ['echoOn', 'echoCue', 'explore', 'exploreOn', 'search', 'searchPlaceholder', 'searchNotFound', 'searchFound',
  'quickOui', 'quickNon', 'quickWait', 'quickHelp', 'quickJoke', 'askFeel', 'askWant', 'askWhere', 'askWhat', 'annulled', 'restoreStep', 'tremor'];
const missingCaa = CAA_KEYS.filter((k) => !CLINIC_FR[k] || !CLINIC_DR[k]);
check(!missingCaa.length, `Clés CAA v10.15 présentes dans les deux langues${missingCaa.length ? ` — ${missingCaa.join(', ')}` : ''}`);

if (failed) { console.error(`\n${failed} contrôle(s) darija des ateliers en échec.`); process.exit(1); }
console.log('\n🎉 Ateliers cliniques et cœur CAA : parité français / darija vérifiée.');
