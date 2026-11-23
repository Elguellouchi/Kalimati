// Génère modules/clinic-i18n-dr.js : libellés darija des ateliers cliniques (v10.15),
// traduits par OpenAI depuis le français de modules/clinic-i18n.js.
// À lancer sur le PC de la famille, jamais dans l'application : la clé reste locale et
// aucun texte n'est envoyé au serveur au moment de l'usage.
//
// Usage :
//   node tools/gen-clinic-i18n.mjs --env "C:\Users\HP\My AI\crewai\.env"
//   # v10.24 : la darija en lettres arabes — ce que lit l'enfant et ce que dit la voix (CLINIC_DRA)
//   node tools/gen-clinic-i18n.mjs --env "..." --graphie arabe
//   # l'arabe standard des ateliers (CLINIC_AR)
//   node tools/gen-clinic-i18n.mjs --env "..." --langue ar
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLINIC_FR } from '../modules/clinic-i18n.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const envPath = opt('--env', path.join(root, 'scripts', 'voix-openai', '.env'));
const MODEL = opt('--model', 'gpt-5.5');
const LANGUE = opt('--langue', 'dr');
const GRAPHIE = opt('--graphie', LANGUE === 'ar' ? 'arabe' : 'latine');
if (!['dr', 'ar'].includes(LANGUE)) { console.error(`--langue inconnu : ${LANGUE} (dr ou ar)`); process.exit(1); }
if (!['latine', 'arabe'].includes(GRAPHIE)) { console.error(`--graphie inconnue : ${GRAPHIE} (latine ou arabe)`); process.exit(1); }
const SUFFIX = opt('--suffix', LANGUE === 'ar' ? 'AR' : (GRAPHIE === 'arabe' ? 'DRA' : 'DR'));
const OUT = opt('--out', path.join(root, 'modules', LANGUE === 'ar' ? 'clinic-i18n-ar.js'
  : (GRAPHIE === 'arabe' ? 'clinic-i18n-dr-ar.js' : 'clinic-i18n-dr.js')));

function keyFromEnv() {
  const text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const m = text.match(/^\s*OPENAI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m);
  return (process.env.OPENAI_API_KEY || (m ? m[1] : '')).trim();
}
const KEY = keyFromEnv();
if (!KEY) {
  console.error(`Clé OpenAI introuvable (OPENAI_API_KEY dans ${envPath}).`);
  process.exit(1);
}

// Trois écritures possibles pour le même atelier : l'arabizi historique des parents, la graphie
// arabe lue par l'enfant scolarisé, et l'arabe standard. Les règles changent, le ton reste.
const SCRIPT_RULES = {
  latine: [
    '- Écris UNIQUEMENT en lettres latines : 7 = ح, 3 = ع, 9 = ق, 2 = ء/أ, ġ = غ, kh, ch, ou.',
    '- Jamais de caractères arabes, jamais d’explication, jamais de ponctuation superflue.',
  ],
  arabe: [
    '- Écris UNIQUEMENT en graphie arabe, telle qu’elle est écrite au Maroc, sans voyelles courtes (harakat).',
    '- N’utilise JAMAIS les chiffres 3, 7, 9, 2 à la place des lettres, ni une translittération latine.',
    '- Les mots empruntés (carte, photo, planning, urgence) s’écrivent AVEC des lettres arabes.',
    '- Seuls les sigles PEI, ABA et PECS gardent leurs lettres latines : aucun autre mot latin ne doit rester.',
    '- Jamais d’explication, jamais de ponctuation superflue.',
  ],
};

const VOCABULAIRE = {
  latine: [
    'Vocabulaire imposé : atelier = warcha (jamais 3yada, qui veut dire dispensaire) ; séance = séance ; carte = karta ; choix = khtiyar ; aide = 3awn ;',
    'photo = tswira ; voix = sawt ; dessin = rasm ; douleur = 9ri7 ; urgence = mosta3jal ; stop = 7bes ;',
    'calme = hadi ; attendre = tsenn ; bravo = mzyan bezzaf ; encore = 3awd ; fini = safi.',
  ],
  arabe: [
    'Vocabulaire imposé, en lettres arabes : atelier = الورشة (jamais العيادة، التي تعني المستوصف) ; carte = الكارطة ; choix = الخيار ; aide = المساعدة ;',
    'photo = الصورة ; voix = الصوت ; dessin = الرسم ; douleur = الجرح ; urgence = المستعجل ; stop = حبس ;',
    'calme = هادي ; attendre = صبر ; bravo = مزيان بزاف ; encore = عود ; fini = صافي.',
  ],
};

const AR_VOCABULAIRE = [
  'Vocabulaire de référence : ورشة (atelier), صورة (photo), صوت (voix), رسم (dessin), نجمة (étoile), وقت (temps), هدوء (calme).',
  'Arabe standard simple d’enfant, jamais littéraire ni oriental.',
];

const COMMON_RULES = [
  '- Phrases très courtes, concrètes, positives, faciles à lire pour un enfant de 8 ans.',
  '- Quand tu parles à l’enfant (une fille), utilise le féminin singulier.',
  '- Garde exactement les mêmes clés JSON, les emojis et les variables entre accolades ({word}, {step}, {total}…).',
  '- Ne traduis pas : OK Stop, PEI, ABA, PECS.',
  '',
  'Réponds STRICTEMENT par un objet JSON valide ayant exactement les mêmes clés que l’objet fourni.',
];

const SYSTEM = [
  LANGUE === 'ar'
    ? 'Tu es traducteur arabe natif (Maroc) et rédacteur pour une application de communication alternative (CAA) utilisée par'
    : 'Tu es traducteur natif marocain (darija de Rabat-Salé) et rédacteur pour une application de communication alternative (CAA)',
  'utilisée par une petite fille de 8 ans avec autisme et sa famille. Tu traduis du français vers '
    + (LANGUE === 'ar' ? 'l’arabe standard pour enfant.' : 'la darija marocaine.'),
  '',
  'Règles absolues :',
  LANGUE === 'ar'
    ? '- Arabe standard clair et très simple, celui des manuels scolaires marocains pour les 8-10 ans.'
    : '- Darija marocaine naturelle, comme une maman qui parle à sa fille. Jamais d’arabe classique ni d’arabe oriental.',
  ...SCRIPT_RULES[GRAPHIE],
  ...(LANGUE === 'dr'
    ? ['- Traduis vraiment en darija : ne garde pas un mot français quand une maman marocaine dirait le mot darija.']
    : []),
  '',
  ...(LANGUE === 'ar' ? AR_VOCABULAIRE : VOCABULAIRE[GRAPHIE]),
  '',
  ...COMMON_RULES,
].join('\n');

const REVIEW = [
  LANGUE === 'ar'
    ? 'Tu es relecteur arabe natif (Maroc). Voici des traductions français → arabe standard d’ateliers d’une application pour enfants.'
    : 'Tu es relecteur natif marocain (darija de Rabat-Salé). Voici des traductions français → darija d’une application pour enfants.',
  LANGUE === 'ar'
    ? 'Réécris les valeurs qui sonnent littéraires, orientales ou trop longues pour un enfant de 8 ans.'
    : 'Réécris les valeurs qui sonnent comme du français décalqué, gardent un mot français alors qu’un mot darija courant existe,',
  LANGUE === 'ar' ? '' : 'ou utilisent une tournure qu’une maman marocaine ne dirait pas à sa fille.',
  GRAPHIE === 'latine'
    ? 'Orthographe imposée : 9 pour ق, 7 pour ح, 3 pour ع, 2 pour ء, ġ pour غ ; jamais de caractères arabes.'
    : 'Orthographe imposée : graphie arabe uniquement, sans harakat ; jamais les chiffres 3/7/9/2 à la place des lettres.',
  `Mêmes règles que la première traduction : ${GRAPHIE === 'latine' ? 'latin uniquement' : 'graphie arabe uniquement'}, mêmes clés, mêmes emojis, mêmes variables {…}.`,
  ...(LANGUE === 'dr' && GRAPHIE === 'latine'
    ? ['Pour « atelier » / « ateliers cliniques », garde toujours « warcha » / « warchat » : jamais « 3yada ».']
    : []),
  ...(LANGUE === 'dr' && GRAPHIE === 'arabe'
    ? ['Pour « atelier », garde toujours الورشة : jamais العيادة.']
    : []),
  'Réponds STRICTEMENT par l’objet JSON complet, avec toutes les clés.',
].filter((line) => line !== '').join('\n');

const TARGET = LANGUE === 'ar' ? 'l’arabe standard pour enfant' : 'la darija marocaine';

async function callOpenAI(payload, system = SYSTEM, instruction = `Traduis les valeurs de cet objet JSON en ${TARGET}. Garde les clés telles quelles.`) {
  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `${instruction}\n${JSON.stringify(payload)}` },
    ],
    response_format: { type: 'json_object' },
  };
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const json = await res.json();
      return JSON.parse(json.choices[0].message.content);
    }
    const text = (await res.text()).slice(0, 300).replaceAll(KEY, '***');
    console.error(`  HTTP ${res.status} (essai ${attempt}) : ${text}`);
    if (res.status === 401 || res.status === 403) process.exit(2);
    if (res.status === 400 && body.response_format) { delete body.response_format; continue; }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error('OpenAI indisponible après plusieurs essais.');
}

const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const emojis = (s) => (String(s).match(/\p{Extended_Pictographic}/gu) || []).sort().join('');
const latinOnly = (s) => !/[\u0600-\u06FF\u0750-\u077F]/.test(String(s));
const ARABIC_ONLY = /[؀-ۿݐ-ݿ]/;
// Un jeton {word} ou {total} reste tel quel : sans ce masque, la phrase serait jugée « mixte ».
const sansJetons = (s) => String(s).replace(/\{\w+\}/g, ' ');
const arabizi = (s) => /[A-Za-z]\d|\d[A-Za-z]/.test(sansJetons(s));
const SIGLES = /PEI|ABA|PECS|OK Stop/g;
const latinRestant = (s) => /[A-Za-zÀ-ÿ]{2,}/.test(sansJetons(String(s).replace(SIGLES, '')));
const translatable = (fr) => String(fr).replace(SIGLES, '').replace(/[\p{Extended_Pictographic}\p{N}\p{P}\s{}]/gu, '').length > 0;
const scriptOk = (s) => (GRAPHIE === 'latine' ? latinOnly(s) : ARABIC_ONLY.test(s) && !latinRestant(s)) && !arabizi(s);

function validate(source, out) {
  const errors = [];
  for (const [key, fr] of Object.entries(source)) {
    const value = out[key];
    if (typeof value !== 'string' || !value.trim()) { errors.push(`${key} : traduction vide`); continue; }
    if (GRAPHIE === 'latine' && !latinOnly(value)) { errors.push(`${key} : caractères arabes interdits`); continue; }
    if (GRAPHIE === 'arabe' && arabizi(value)) { errors.push(`${key} : arabizi interdit en graphie arabe`); continue; }
    if (GRAPHIE === 'arabe' && latinRestant(value)) { errors.push(`${key} : mot latin resté dans une valeur en graphie arabe`); continue; }
    if (GRAPHIE === 'arabe' && !ARABIC_ONLY.test(value) && translatable(fr)) { errors.push(`${key} : aucun caractère arabe`); continue; }
    if (placeholders(value) !== placeholders(fr)) errors.push(`${key} : variables {…} modifiées`);
    if (emojis(value) !== emojis(fr)) errors.push(`${key} : emojis modifiés`);
    if (value.includes('\n')) errors.push(`${key} : saut de ligne`);
  }
  for (const key of Object.keys(out)) if (!(key in source)) errors.push(`${key} : clé inventée`);
  return errors;
}

const sameCase = (fr, value) => {
  if (!/^\p{Lu}/u.test(fr) || !/^\p{Ll}/u.test(value)) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
function table(name, obj) {
  const lines = Object.entries(obj).map(([k, v]) => `  ${q(k)}: ${q(v)},`);
  return `export const ${name} = {\n${lines.join('\n')}\n};\n`;
}

async function main() {
  console.log(`→ clinique (${LANGUE} / ${GRAPHIE}) : ${Object.keys(CLINIC_FR).length} textes`);
  let result = await callOpenAI(CLINIC_FR);
  result = await callOpenAI(result, REVIEW, 'Relis et améliore ces traductions. Garde les clés.');
  let errors = validate(CLINIC_FR, result);
  if (errors.length) {
    console.log(`  reprise de ${errors.length} entrée(s)…`);
    const retrySource = Object.fromEntries(Object.keys(CLINIC_FR).filter((k) => !result[k] || !scriptOk(result[k]) || placeholders(result[k]) !== placeholders(CLINIC_FR[k]) || errors.some((e) => e.startsWith(k + ' '))).map((k) => [k, CLINIC_FR[k]]));
    const fixed = await callOpenAI(retrySource);
    Object.assign(result, fixed);
    errors = validate(CLINIC_FR, result);
  }
  if (errors.length) {
    console.error(`Échec de validation :\n- ${errors.join('\n- ')}`);
    process.exit(3);
  }
  const clean = Object.fromEntries(Object.keys(CLINIC_FR).map((k) => [k, sameCase(CLINIC_FR[k], result[k].trim())]));
  const header = [
    '// Généré par tools/gen-clinic-i18n.mjs — ne pas modifier à la main.',
    `// Traductions ${LANGUE === 'ar' ? 'arabe standard' : 'darija'} (${GRAPHIE}) demandées à OpenAI ${MODEL}, générées le ${new Date().toISOString().slice(0, 10)}.`,
    '// Aucun texte n\'est envoyé au serveur lors de l\'utilisation de l\'application.',
    '',
  ].join('\n');
  fs.writeFileSync(OUT, header + table(`CLINIC_${SUFFIX}`, clean), 'utf8');
  console.log(`✅ ${path.relative(root, OUT)} écrit (CLINIC_${SUFFIX}, ${Object.keys(clean).length} clés).`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
