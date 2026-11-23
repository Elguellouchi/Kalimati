// Génère modules/clinic-i18n-dr.js : libellés darija des ateliers cliniques (v10.15),
// traduits par OpenAI depuis le français de modules/clinic-i18n.js.
// À lancer sur le PC de la famille, jamais dans l'application : la clé reste locale et
// aucun texte n'est envoyé au serveur au moment de l'usage.
//
// Usage :
//   node tools/gen-clinic-i18n.mjs --env "C:\Users\HP\My AI\crewai\.env"
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
const OUT = opt('--out', path.join(root, 'modules', 'clinic-i18n-dr.js'));

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

const SYSTEM = [
  'Tu es traducteur natif marocain (darija de Rabat-Salé) et rédacteur pour une application de communication alternative (CAA)',
  'utilisée par une petite fille de 8 ans avec autisme et sa famille. Tu traduis du français vers la darija marocaine.',
  '',
  'Règles absolues :',
  '- Darija marocaine naturelle, comme une maman qui parle à sa fille. Jamais d’arabe classique ni d’arabe oriental.',
  '- Écris UNIQUEMENT en lettres latines : 7 = ح, 3 = ع, 9 = ق, 2 = ء/أ, ġ = غ, kh, ch, ou.',
  '- Jamais de caractères arabes, jamais d’explication, jamais de ponctuation superflue.',
  '- Phrases très courtes, concrètes, positives, faciles à lire pour un enfant de 8 ans.',
  '- Traduis vraiment en darija : ne garde pas un mot français quand une maman marocaine dirait le mot darija.',
  '- Quand tu parles à l’enfant (une fille), utilise le féminin singulier.',
  '- Garde exactement les mêmes clés JSON, les emojis et les variables entre accolades ({word}, {step}, {total}…).',
  '- Ne traduis pas : OK Stop, PEI, ABA, PECS.',
  '',
  'Vocabulaire imposé : atelier = warcha (jamais 3yada, qui veut dire dispensaire) ; séance = séance ; carte = karta ; choix = khtiyar ; aide = 3awn ;',
  'photo = tswira ; voix = sawt ; dessin = rasm ; douleur = 9ri7 ; urgence = mosta3jal ; stop = 7bes ;',
  'calme = hadi ; attendre = tsenn ; bravo = mzyan bezzaf ; encore = 3awd ; fini = safi.',
  '',
  'Réponds STRICTEMENT par un objet JSON valide ayant exactement les mêmes clés que l’objet fourni.',
].join('\n');

const REVIEW = [
  'Tu es relecteur natif marocain (darija de Rabat-Salé). Voici des traductions français → darija d’une application pour enfants.',
  'Réécris les valeurs qui sonnent comme du français décalqué, gardent un mot français alors qu’un mot darija courant existe,',
  'ou utilisent une tournure qu’une maman marocaine ne dirait pas à sa fille.',
  'Orthographe imposée : 9 pour ق, 7 pour ح, 3 pour ع, 2 pour ء, ġ pour غ ; jamais de caractères arabes.',
  'Mêmes règles que la première traduction : latin uniquement, mêmes clés, mêmes emojis, mêmes variables {…}.',
  'Pour « atelier » / « ateliers cliniques », garde toujours « warcha » / « warchat » : jamais « 3yada ».',
  'Réponds STRICTEMENT par l’objet JSON complet, avec toutes les clés.',
].join('\n');

async function callOpenAI(payload, system = SYSTEM, instruction = 'Traduis les valeurs de cet objet JSON en darija marocaine. Garde les clés telles quelles.') {
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

function validate(source, out) {
  const errors = [];
  for (const [key, fr] of Object.entries(source)) {
    const value = out[key];
    if (typeof value !== 'string' || !value.trim()) { errors.push(`${key} : traduction vide`); continue; }
    if (!latinOnly(value)) { errors.push(`${key} : caractères arabes interdits`); continue; }
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
  console.log(`→ clinique : ${Object.keys(CLINIC_FR).length} textes`);
  let result = await callOpenAI(CLINIC_FR);
  result = await callOpenAI(result, REVIEW, 'Relis et améliore ces traductions darija. Garde les clés.');
  let errors = validate(CLINIC_FR, result);
  if (errors.length) {
    console.log(`  reprise de ${errors.length} entrée(s)…`);
    const retrySource = Object.fromEntries(Object.keys(CLINIC_FR).filter((k) => !result[k] || !latinOnly(result[k]) || placeholders(result[k]) !== placeholders(CLINIC_FR[k]) || errors.some((e) => e.startsWith(k + ' '))).map((k) => [k, CLINIC_FR[k]]));
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
    `// Traductions darija (latin) demandées à OpenAI ${MODEL}, générées le ${new Date().toISOString().slice(0, 10)}.`,
    '// Aucun texte n\'est envoyé au serveur lors de l\'utilisation de l\'application.',
    '',
  ].join('\n');
  fs.writeFileSync(OUT, header + table('CLINIC_DR', clean), 'utf8');
  console.log(`✅ ${path.relative(root, OUT)} écrit (${Object.keys(clean).length} clés).`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
