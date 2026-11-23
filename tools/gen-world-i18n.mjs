// v10.28 : génère modules/i18n-<langue>.js pour les langues du monde (en, es, de, it, pt, nl, tr, zh).
// Même méthode que tools/gen-darija-i18n.mjs et tools/gen-clinic-i18n.mjs (OpenAI, traduction puis
// relecture, contrôle des variables {…} et des emojis), avec, pour chaque langue, le vocabulaire des
// outils de communication alternative de référence du pays (cahier « Souveraineté multilingue »).
// À lancer sur le PC de la famille, jamais dans l'application : la clé reste locale et aucun texte
// n'est envoyé au serveur au moment de l'usage.
//
// Usage :
//   node tools/gen-world-i18n.mjs --env "C:\Users\HP\My AI\crewai\.env"                 # les 8 langues
//   node tools/gen-world-i18n.mjs --env "..." --langue es,en                             # quelques langues
//   node tools/gen-world-i18n.mjs --env "..." --langue de --seulement ui,clinic          # une partie
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { GOALS, SECTIONS } from '../modules/goals.js';
import { CLINIC_FR } from '../modules/clinic-i18n.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const envPath = opt('--env', path.join(root, 'scripts', 'voix-openai', '.env'));
const MODEL = opt('--model', 'gpt-5.5');
const ONLY = opt('--seulement', '');

// Langue cible, outils de référence du pays (pour le vocabulaire et le ton) et écriture attendue.
const WORLD = {
  en: { nom: 'anglais (britannique, compréhensible partout)', outils: 'Proloquo2Go, TD Snap, Widgit Symbols, Makaton', ecriture: 'latin' },
  es: { nom: 'espagnol (Espagne, compréhensible en Amérique latine)', outils: 'ARASAAC, PictoTEA, AraWord, José Aragonés', ecriture: 'latin' },
  de: { nom: 'allemand', outils: 'METACOM (Annette Kitzinger), GoTalk Now DE, Tobii Dynavox DE', ecriture: 'latin' },
  it: { nom: 'italien', outils: 'SymboTalk, ARASAAC IT, Simcaa, Centro Sovrazonale di Comunicazione Aumentativa', ecriture: 'latin' },
  pt: { nom: 'portugais (Portugal, compréhensible au Brésil)', outils: 'Livox, ARASAAC PT, Matraquinha, Comunicar com Símbolos', ecriture: 'latin' },
  nl: { nom: 'néerlandais', outils: 'Sclera, Mind Express, Beta, Picto Selector', ecriture: 'latin' },
  tr: { nom: 'turc', outils: 'Otsimo, Tohum Otizm Vakfı, Konuşan Kartlar', ecriture: 'latin' },
  zh: { nom: 'chinois mandarin simplifié', outils: 'Cboard 中文, 小雨滴 (Xiaoyudi), 语言训练 ABA 中文', ecriture: 'han' },
};
const LANGUES = (opt('--langue', 'toutes') === 'toutes' ? Object.keys(WORLD) : opt('--langue', '').split(',').map((s) => s.trim()).filter(Boolean));
for (const l of LANGUES) if (!WORLD[l]) { console.error(`--langue inconnue : ${l} (${Object.keys(WORLD).join(', ')})`); process.exit(1); }

function keyFromEnv() {
  const text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const m = text.match(/^\s*OPENAI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m);
  return (process.env.OPENAI_API_KEY || (m ? m[1] : '')).trim();
}
const KEY = keyFromEnv();
if (!KEY) { console.error(`Clé OpenAI introuvable (OPENAI_API_KEY dans ${envPath}).`); process.exit(1); }

// --- Extraction des textes français (identique à gen-darija-i18n.mjs) ----------
function literalBlock(src, startMarker, open = '{', close = '}') {
  const at = src.indexOf(startMarker);
  if (at < 0) throw new Error(`Marqueur absent : ${startMarker}`);
  const from = src.indexOf(open, at);
  let depth = 0;
  let quote = null;
  for (let i = from; i < src.length; i += 1) {
    const c = src[i];
    if (quote) {
      if (c === '\\') { i += 1; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === open) depth += 1;
    if (c === close) {
      depth -= 1;
      if (depth === 0) return src.slice(from, i + 1);
    }
  }
  throw new Error(`Bloc non fermé : ${startMarker}`);
}
const evalObject = (literal) => vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 });

const TX_FR = evalObject(literalBlock(read('modules/section-i18n.js'), 'const TX = {')).fr;
const emotionBlock = literalBlock(read('modules/visuals.js'), 'export const EMOTIONS = [', '[', ']');
const emotions = [...emotionBlock.matchAll(/\{ id: '([a-z]+)', fr: (?:'([^']*)'|"([^"]*)")/g)].map((m) => ({ id: m[1], fr: m[2] ?? m[3] }));
const situationBlock = literalBlock(read('modules/content.js'), 'export const SITUATIONS = [', '[', ']');
const situations = [...situationBlock.matchAll(/id: '([a-z]+)',\s*label: '[^']*',\s*scene: '[^']*',\s*text: (?:'([^']*)'|"([^"]*)")/g)].map((m) => ({ id: m[1], text: m[2] ?? m[3] }));
const STORY_IDS = ['docteur', 'coiffeur', 'courses', 'bruit', 'ecole_inclusion', 'fratrie_jeu'];
const stories = [...read('modules/stories.js').matchAll(/id: '([a-z_]+)',\s*emoji: '[^']*',\s*title: '([^']*)'/g)]
  .filter((m) => STORY_IDS.includes(m[1])).map((m) => ({ id: m[1], title: m[2] }));
const routines = [];
for (const m of read('modules/spaces.js').matchAll(/L\('([^']*)',\s*'[^']*'\)/g)) {
  if (m[1].includes('${') || routines.includes(m[1])) continue;
  routines.push(m[1]);
}
const themes = [...literalBlock(read('modules/rewards-kids.js'), 'export const THEMES = [', '[', ']').matchAll(/label: '([^']*)'/g)].map((m) => m[1]);

const GROUPS = [
  ['ui', 'TX', TX_FR],
  ['goals', 'GOAL', Object.fromEntries(GOALS.map((g) => [g.id, g.title]))],
  ['sections', 'SECTION', Object.fromEntries(SECTIONS.map((s) => [s.id, s.name]))],
  ['emotions', 'EMOTION', Object.fromEntries(emotions.map((e) => [e.id, e.fr]))],
  ['situations', 'SITUATION', Object.fromEntries(situations.map((s) => [s.id, s.text]))],
  ['stories', 'STORY', Object.fromEntries(stories.map((s) => [s.id, s.title]))],
  ['routines', 'ROUTINE_TEXT', Object.fromEntries(routines.map((r) => [r, r]))],
  ['themes', 'THEME', Object.fromEntries(themes.map((t) => [t, t]))],
  ['clinic', 'CLINIC', CLINIC_FR],
];

// --- Consignes ---------------------------------------------------------------
function systemPrompt(lang) {
  const w = WORLD[lang];
  return [
    `Tu es traducteur natif (${w.nom}) et orthophoniste spécialisé en communication alternative et augmentée (CAA).`,
    'Tu traduis du français l’interface d’une application de CAA utilisée par une petite fille de 8 ans avec autisme et sa famille.',
    '',
    'Règles absolues :',
    `- Utilise le vocabulaire et le ton des outils de CAA de référence pour cette langue : ${w.outils}.`,
    '  Un parent ou un thérapeute de ce pays doit retrouver les mots qu’il connaît déjà (noms des jeux, des émotions, des routines).',
    '- Phrases très courtes, concrètes, positives, faciles à lire pour un enfant. Pas de mot à mot, pas de calque du français.',
    '- Quand on parle à l’enfant (une fille), accorde au féminin si la langue le demande ; tutoiement / forme familière.',
    '- Les textes destinés à l’adulte (consignes, réglages, bilans) restent simples, sans jargon.',
    w.ecriture === 'han'
      ? '- Écris en caractères chinois simplifiés, sans pinyin. Seuls les sigles PEI, ABA, ABLLS-R, PECS, OK Stop, Time Timer restent en lettres latines.'
      : '- Écris uniquement en alphabet latin (avec les accents et lettres propres à la langue).',
    '- Garde exactement les mêmes clés JSON, les mêmes emojis et les mêmes variables entre accolades ({name} {n} {min} {total} {word} {text} {msg} {sister} {step}…).',
    '- La variable {s} vaut « s » quand le nombre dépasse 1. Garde-la seulement si le pluriel de ta langue se forme en ajoutant exactement « s ».',
    '  Sinon supprime {s} et choisis une tournure qui marche au singulier comme au pluriel (par exemple « ⭐ {n}/5 »).',
    '- Ne traduis pas les sigles et noms propres : PEI, ABA, ABLLS-R, PECS, OK Stop, Time Timer, Kalimati.',
    '- Une clé qui n’est qu’un emoji, un sigle ou un nombre reste identique.',
    '',
    'Réponds STRICTEMENT par un objet JSON valide ayant exactement les mêmes clés que l’objet fourni.',
  ].join('\n');
}

function reviewPrompt(lang) {
  const w = WORLD[lang];
  return [
    `Tu es relecteur natif (${w.nom}), orthophoniste en CAA, habitué à ${w.outils}.`,
    'Voici des traductions françaises d’une application pour une fille de 8 ans avec autisme.',
    'Réécris les valeurs qui sonnent comme du français traduit, qui sont trop longues pour un enfant,',
    'ou qui n’utilisent pas le mot qu’un parent ou un thérapeute de ce pays emploierait.',
    'Mêmes règles : mêmes clés, mêmes emojis, mêmes variables {…} (seule {s} peut être supprimée), sigles inchangés.',
    w.ecriture === 'han' ? 'Caractères chinois simplifiés uniquement, sans pinyin.' : 'Alphabet latin uniquement.',
    'Réponds STRICTEMENT par l’objet JSON complet, avec toutes les clés.',
  ].join('\n');
}

async function callOpenAI(payload, system, instruction) {
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

// --- Validation --------------------------------------------------------------
// {s} peut disparaître (pluriel sans « s ») ; toutes les autres variables doivent rester.
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((v) => v !== 's').sort().join(',');
const emojis = (s) => (String(s).match(/\p{Extended_Pictographic}/gu) || []).sort().join('');
const ARABIC = /[\u0600-\u06FF\u0750-\u077F]/;
const HAN = /\p{Script=Han}/u;
const SIGLES = /PEI|ABA|ABLLS-R|PECS|OK Stop|Time Timer|Kalimati/g;
const translatable = (fr) => String(fr).replace(SIGLES, '').replace(/\{\w+\}/g, '').replace(/[\p{Extended_Pictographic}\p{N}\p{P}\p{S}\s]/gu, '').length > 1;

function validate(lang, source, out) {
  const errors = [];
  const han = WORLD[lang].ecriture === 'han';
  for (const [key, fr] of Object.entries(source)) {
    const value = out[key];
    if (typeof value !== 'string' || !value.trim()) { errors.push(`${key} : traduction vide`); continue; }
    if (ARABIC.test(value)) { errors.push(`${key} : lettres arabes`); continue; }
    if (han && translatable(fr) && !HAN.test(value)) { errors.push(`${key} : pas de caractères chinois`); continue; }
    if (!han && HAN.test(value)) { errors.push(`${key} : caractères chinois`); continue; }
    if (placeholders(value) !== placeholders(fr)) errors.push(`${key} : variables {…} modifiées`);
    if (/\{s\}/.test(value) && !/\{s\}/.test(fr)) errors.push(`${key} : {s} inventé`);
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

async function translate(lang, name, source) {
  console.log(`  → ${name} : ${Object.keys(source).length} textes`);
  const target = WORLD[lang].nom;
  let result = await callOpenAI(source, systemPrompt(lang), `Traduis les valeurs de cet objet JSON en ${target}. Garde les clés telles quelles.`);
  result = await callOpenAI(result, reviewPrompt(lang), 'Relis et améliore ces traductions. Garde les clés.');
  let errors = validate(lang, source, result);
  for (let tour = 1; errors.length && tour <= 2; tour += 1) {
    console.log(`    reprise de ${errors.length} entrée(s)…`);
    const keys = [...new Set(errors.map((e) => e.split(' : ')[0]))].filter((k) => k in source);
    for (const k of Object.keys(result)) if (!(k in source)) delete result[k];
    const fixed = await callOpenAI(Object.fromEntries(keys.map((k) => [k, source[k]])), systemPrompt(lang), `Traduis les valeurs de cet objet JSON en ${target}. Garde les clés telles quelles.`);
    for (const k of keys) result[k] = fixed[k];
    errors = validate(lang, source, result);
  }
  if (errors.length) { console.error(`Échec de validation (${lang} / ${name}) :\n- ${errors.join('\n- ')}`); process.exit(3); }
  return Object.fromEntries(Object.keys(source).map((k) => [k, sameCase(source[k], result[k].trim())]));
}

// --- Écriture ----------------------------------------------------------------
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const table = (name, obj) => `export const ${name} = {\n${Object.entries(obj).map(([k, v]) => `  ${q(k)}: ${q(v)},`).join('\n')}\n};\n`;

async function main() {
  const wanted = (g) => !ONLY || ONLY.split(',').includes(g);
  for (const lang of LANGUES) {
    const SUF = lang.toUpperCase();
    const OUT = path.join(root, 'modules', `i18n-${lang}.js`);
    console.log(`🌍 ${lang} (${WORLD[lang].nom})`);
    let text = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    for (const [group, base, source] of GROUPS) {
      if (!wanted(group)) continue;
      const name = `${base}_${SUF}`;
      const block = table(name, await translate(lang, group, source));
      const re = new RegExp(`export const ${name} = \\{[\\s\\S]*?\\n\\};\\n`);
      text = re.test(text) ? text.replace(re, block) : `${text}${!text || text.endsWith('\n') ? '' : '\n'}${block}`;
      fs.writeFileSync(OUT, text, 'utf8'); // écrit au fur et à mesure : une coupure ne perd pas le travail fait
    }
    if (!text.startsWith('//')) {
      text = `// Généré par tools/gen-world-i18n.mjs — ne pas modifier à la main.\n// Traductions ${WORLD[lang].nom} demandées à OpenAI ${MODEL} (vocabulaire : ${WORLD[lang].outils}), générées le ${new Date().toISOString().slice(0, 10)}.\n// Aucun texte n'est envoyé au serveur lors de l'utilisation de l'application.\n\n${text}`;
      fs.writeFileSync(OUT, text, 'utf8');
    }
    console.log(`✅ ${path.relative(root, OUT)} écrit.`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
