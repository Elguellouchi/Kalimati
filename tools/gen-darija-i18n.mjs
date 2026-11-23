// Génère modules/section-i18n-dr.js : toutes les chaînes darija des espaces Jeux,
// Ma journée et Émotions, traduites par OpenAI à partir du français de l'application.
// À lancer sur le PC de la famille, jamais dans l'application : la clé reste locale et
// aucun texte n'est envoyé au serveur au moment de l'usage.
//
// Usage :
//   node tools/gen-darija-i18n.mjs --env "C:\Users\HP\My AI\crewai\.env"
//   node tools/gen-darija-i18n.mjs --env "..." --model gpt-5.5 --seulement ui
//   # v10.24 : darija en graphie arabe (modules/section-i18n-dr-ar.js, tables *_DRA)
//   node tools/gen-darija-i18n.mjs --env "..." --graphie arabe
//   # arabe standard pour les titres des domaines ABA et des jeux (modules/section-i18n-ar.js, tables *_AR)
//   node tools/gen-darija-i18n.mjs --env "..." --langue ar
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { GOALS, SECTIONS } from '../modules/goals.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const envPath = opt('--env', path.join(root, 'scripts', 'voix-openai', '.env'));
const MODEL = opt('--model', 'gpt-5.5');
const ONLY = opt('--seulement', '');
// v10.24 : la même chaîne fabrique la darija en lettres latines (historique), la darija en graphie
// arabe (ce que lit l'enfant marocain scolarisé, et ce que dit la voix arabe) et l'arabe standard.
const LANGUE = opt('--langue', 'dr');
const GRAPHIE = opt('--graphie', LANGUE === 'dr' ? 'latine' : 'arabe');
if (!['dr', 'ar'].includes(LANGUE)) { console.error(`--langue inconnu : ${LANGUE} (dr ou ar)`); process.exit(1); }
if (!['latine', 'arabe'].includes(GRAPHIE)) { console.error(`--graphie inconnue : ${GRAPHIE} (latine ou arabe)`); process.exit(1); }
// Suffixe des tables exportées, pour que les trois fichiers coexistent sans se marcher dessus.
const SUFFIX = opt('--suffix', LANGUE === 'ar' ? 'AR' : (GRAPHIE === 'arabe' ? 'DRA' : 'DR'));
const OUT = opt('--out', path.join(root, 'modules', LANGUE === 'ar' ? 'section-i18n-ar.js'
  : (GRAPHIE === 'arabe' ? 'section-i18n-dr-ar.js' : 'section-i18n-dr.js')));

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

// --- Extraction des textes français depuis les sources -----------------------
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

function evalObject(literal) {
  return vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 });
}

const i18nSrc = read('modules/section-i18n.js');
const TX_FR = evalObject(literalBlock(i18nSrc, 'const TX = {' , '{', '}')).fr;
if (!TX_FR || typeof TX_FR !== 'object') throw new Error('TX.fr introuvable');

const visualSrc = read('modules/visuals.js');
const emotionBlock = literalBlock(visualSrc, 'export const EMOTIONS = [', '[', ']');
const emotions = [...emotionBlock.matchAll(/\{ id: '([a-z]+)', fr: (?:'([^']*)'|"([^"]*)")/g)]
  .map((m) => ({ id: m[1], fr: m[2] ?? m[3] }));

const contentSrc = read('modules/content.js');
const situationBlock = literalBlock(contentSrc, 'export const SITUATIONS = [', '[', ']');
const situations = [...situationBlock.matchAll(/id: '([a-z]+)',\s*label: '[^']*',\s*scene: '[^']*',\s*text: (?:'([^']*)'|"([^"]*)")/g)]
  .map((m) => ({ id: m[1], text: m[2] ?? m[3] }));

const storySrc = read('modules/stories.js');
const STORY_IDS = ['docteur', 'coiffeur', 'courses', 'bruit', 'ecole_inclusion', 'fratrie_jeu'];
const stories = [...storySrc.matchAll(/id: '([a-z_]+)',\s*emoji: '[^']*',\s*title: '([^']*)'/g)]
  .filter((m) => STORY_IDS.includes(m[1]))
  .map((m) => ({ id: m[1], title: m[2] }));

const spacesSrc = read('modules/spaces.js');
const routines = [];
for (const m of spacesSrc.matchAll(/L\('([^']*)',\s*'[^']*'\)/g)) {
  if (m[1].includes('${') || routines.includes(m[1])) continue;
  routines.push(m[1]);
}

const rewardsSrc = read('modules/rewards-kids.js');
const themes = [...literalBlock(rewardsSrc, 'export const THEMES = [', '[', ']').matchAll(/label: '([^']*)'/g)]
  .map((m) => m[1]);

const groups = {
  ui: Object.fromEntries(Object.entries(TX_FR)),
  goals: Object.fromEntries(GOALS.map((g) => [g.id, g.title])),
  sections: Object.fromEntries(SECTIONS.map((s) => [s.id, s.name])),
  other: {
    emotions: Object.fromEntries(emotions.map((e) => [e.id, e.fr])),
    situations: Object.fromEntries(situations.map((s) => [s.id, s.text])),
    stories: Object.fromEntries(stories.map((s) => [s.id, s.title])),
    routines: Object.fromEntries(routines.map((r) => [r, r])),
    themes: Object.fromEntries(themes.map((t) => [t, t])),
  },
};

// --- Appel OpenAI ------------------------------------------------------------
const SCRIPT_RULES = {
  latine: [
    '- Écris UNIQUEMENT en lettres latines, avec les chiffres conventionnels : 7 = ح, 3 = ع, 9 = ق, 2 = ء/أ, ġ = غ, kh, ch, ou.',
    '- Jamais de caractères arabes, jamais d’explication, jamais de ponctuation superflue.',
  ],
  arabe: [
    '- Écris UNIQUEMENT en graphie arabe, telle qu’elle est écrite au Maroc, sans voyelles courtes (harakat).',
    '- N’utilise JAMAIS les chiffres 3, 7, 9, 2 à la place des lettres, ni une translittération latine.',
    '- Jamais d’explication, jamais de ponctuation superflue.',
  ],
};

// Vocabulaire imposé et style de référence, dans l'écriture demandée.
const DR_VOCABULAIRE = {
  latine: [
    '',
    'Vocabulaire imposé (garde ces mots darija partout) :',
    'accueil = Dar ; jeu/jeux/jouer = l3ba/l3ab/tl3ab ; exercice = tamrin ; activité = nachat ; niveau = mostawa ;',
    'critère = chort ; adulte/parent = kbir/l kbar ; photo/image = tswira/tswrat ; histoire = 7kaya/7kayat ;',
    'émotion = i7sas/i7sasat ; miroir = mraya ; texte = ktba ; tableau = planning ; sans = bla ; rupture = t9ta3 ;',
    'étoile = njma/njoum ; jardin = jnanti ; câlin = 7dana ; une seule fois = marra wa7da ; attendre = tsenn.',
    'Emprunts admis car utilisés par les familles : planning, séance, autocollant, sablier, téléphone, week-end, mission, routine, album, camera, réglages.',
    '',
    'Style de référence déjà utilisé dans l’application :',
    '« Sba7 », « L3chiya », « Khatwa b khatwa », « Sbert mzyan b hdou2 », « Nbdaw », « Chwiya b chwiya. »,',
    '« Mzyan bezzaf, gelti jemla dyalek! », « Nemchi l tbib », « Nfter », « Nrettab n-namousiya », « Nqra qissa ».',
  ],
  arabe: [
    '',
    'Vocabulaire imposé (en graphie arabe, garde ces mots darija partout) :',
    'accueil = الدار ; jeu/jeux/jouer = اللعبة / نلعب ; exercice = تمرين ; activité = نشاط ; niveau = المستوى ;',
    'critère = الشرط ; adulte/parent = الكبير / الكبار ; photo/image = الصورة ; histoire = قصة / قصص ;',
    'émotion = الإحساس / الأحاسيس ; miroir = المرآة ; texte = الكتابة ; planning = البلانينغ ; sans = بلا ;',
    'rupture = الانقطاع ; étoile = نجمة / نجوم ; câlin = الحضنة ; une seule fois = مرة وحدة ; attendre = صبر / تسنى.',
    'Les mots techniques empruntés (routine, sablier, téléphone, week-end, mission, album, réglages, planning) ',
    's’écrivent AVEC des lettres arabes, comme les familles les prononcent (روتين، التليفون، الويكاند).',
    'Seuls les sigles PEI, ABA, ABLLS-R, PECS et Time Timer gardent leurs lettres latines : aucun autre mot latin ne doit rester.',
    '',
    'Style de référence déjà utilisé dans l’application, à retrouver en arabe :',
    '« الصباح », « العشيا », « خطوة ب خطوة », « شوية بشوية », « صبرتي مزيان », « نمشي للحمام »,',
    '« مزيان بزاف، قلتي جملة ديالك! », « نرتب النومية », « نقرا قصة ».',
  ],
};

const AR_VOCABULAIRE = [
  '',
  'Arabe standard (fousha) simple, celui des manuels scolaires marocains pour les 8-10 ans.',
  'Vocabulaire de référence : الدار (accueil), اللعبة / اللعب (jeu), تمرين (exercice), نشاط (activité),',
  'المستوى (niveau), الشرط (critère), الصورة (photo), قصة (histoire), الإحساس / المشاعر (émotion),',
  'المرآة (miroir), نجمة / نجوم (étoile), الحضنة (câlin), الانتظار (attendre), الهدوء (calme).',
  'Les sigles PEI, ABA, ABLLS-R, PECS et « Time Timer » restent en lettres latines.',
];

function systemPrompt() {
  const common = [
    '- Phrases très courtes, concrètes, positives, faciles à lire pour un enfant.',
    '- Garde exactement les mêmes clés JSON, les emojis et les variables entre accolades : {name} {n} {s} {min} {ruptures} {total} {word} {text} {msg} {sister}.',
    '- Ne traduis pas les sigles ni les noms propres : PEI, ABA, ABLLS-R, PECS, PECS phase 1, Time Timer.',
    '',
    `Réponds STRICTEMENT par un objet JSON valide ayant exactement les mêmes clés que l’objet fourni.`,
  ];
  if (LANGUE === 'ar') {
    return [
      'Tu es traducteur arabe natif (Maroc) et rédacteur pour une application de communication alternative (CAA)',
      'utilisée par une petite fille de 8 ans avec autisme. Tu traduis du français vers l’arabe standard pour enfant.',
      '',
      'Règles absolues :',
      '- Arabe standard clair et très simple, jamais d’arabe oriental ni de tournure littéraire compliquée.',
      '- Quand tu parles à l’enfant, utilise le féminin singulier.',
      ...SCRIPT_RULES[GRAPHIE],
      ...AR_VOCABULAIRE,
      ...common,
    ].join('\n');
  }
  return [
    'Tu es traducteur natif marocain (darija de Rabat-Salé) et rédacteur pour une application de communication alternative (CAA)',
    'utilisée par une petite fille de 8 ans avec autisme et sa famille. Tu traduis du français vers la darija marocaine.',
    '',
    'Règles absolues :',
    '- Darija marocaine naturelle, comme une maman qui parle à sa fille. Jamais d’arabe classique ni d’arabe oriental.',
    ...SCRIPT_RULES[GRAPHIE],
    '- Traduis vraiment en darija : ne garde pas un mot français quand une maman marocaine dirait le mot darija. Pas de français décalqué, pas de mot à mot.',
    '- Quand tu parles à l’enfant, utilise le féminin singulier.',
    ...DR_VOCABULAIRE[GRAPHIE],
    ...common,
  ].join('\n');
}

// Deuxième passe : le modèle relit ses propres traductions et supprime les calques français.
function reviewPrompt() {
  const orthographe = GRAPHIE === 'latine'
    ? 'Orthographe imposée : 9 pour ق, 7 pour ح, 3 pour ع, 2 pour ء, ġ pour غ ; jamais la lettre q seule ; jamais de caractères arabes.'
    : 'Orthographe imposée : graphie arabe uniquement, sans harakat ; jamais les chiffres 3/7/9/2 à la place des lettres.';
  const style = LANGUE === 'ar'
    ? 'Arabe standard simple d’enfant, féminin singulier quand on s’adresse à elle.'
    : 'Quand on parle à l’enfant (une fille), féminin singulier. Si la phrase parle de l’enfant à la troisième personne, accorde au féminin.';
  return [
    LANGUE === 'ar'
      ? 'Tu es relecteur arabe natif (Maroc). Voici des traductions français → arabe standard d’une application pour enfants.'
      : 'Tu es relecteur natif marocain (darija de Rabat-Salé). Voici des traductions français → darija d’une application pour enfants.',
    LANGUE === 'ar'
      ? 'Réécris les valeurs qui sonnent littéraires, orientales, ou trop longues pour un enfant de 8 ans.'
      : 'Réécris les valeurs qui sonnent comme du français décalqué, gardent un mot français alors qu’un mot darija courant existe,',
    LANGUE === 'ar' ? '' : 'ou utilisent une tournure qu’une maman marocaine ne dirait pas à sa fille.',
    '',
    'Termes déjà validés par l’équipe, à ne PAS remplacer : routine, sablier, autocollant, album, week-end, planning,',
    'Orthophonie, PEI, ABA, ABLLS-R, PECS, téléphone, camera, mission.',
    orthographe,
    style,
    GRAPHIE === 'latine' ? 'Chargement = « Kanchargi... » ; critère = « Chort » ; jeux = « l3ab » ; exercice = « tamrin » ; texte = « ktba » ;' : '',
    GRAPHIE === 'latine' ? 'photo = « tswira » ; étoile = « njma » ; encore = « 3awd » ; calme = « hadi/hdoud » ; attendre = « tsenn » ;' : '',
    GRAPHIE === 'latine' ? 'sans = « bla » ; rupture = « t9ta3 ».' : '',
    '',
    `Mêmes règles que la première traduction : ${GRAPHIE === 'latine' ? 'latin uniquement' : 'graphie arabe uniquement'}, mêmes clés, mêmes emojis, mêmes variables {…},`,
    'sigles PEI/ABA/ABLLS-R/PECS inchangés.',
    'Réponds STRICTEMENT par l’objet JSON complet, avec toutes les clés.',
  ].filter((line) => line !== '').join('\n');
}

const SYSTEM = systemPrompt();
const REVIEW = reviewPrompt();

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

// --- Validation --------------------------------------------------------------
const placeholders = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const emojis = (s) => (String(s).match(/\p{Extended_Pictographic}/gu) || []).sort().join('');
const latinOnly = (s) => !/[\u0600-\u06FF\u0750-\u077F]/.test(String(s));

// « mar7ala », « l3ab » : une lettre collée à un chiffre = de l'arabizi, pas de la graphie arabe.
const ARABIC_ONLY = /[؀-ۿݐ-ݿ]/;
// Un jeton « {name} », « {n} », « {text} » reste tel quel dans la traduction : ce n'est pas un mot
// latin. Sans ce masque, toute phrase comportant un jeton serait rejetée comme « écriture mixte ».
const sansJetons = (s) => String(s).replace(/\{\w+\}/g, ' ');
const arabizi = (s) => /[A-Za-z]\d|\d[A-Za-z]/.test(sansJetons(s));
const SIGLES = /PEI|ABA|ABLLS-R|PECS|Time Timer/g;
// Une valeur sans rien à traduire (sigle, emoji, chiffres seuls) a droit de rester latine.
const translatable = (fr) => String(fr).replace(SIGLES, '').replace(/[\p{Extended_Pictographic}\p{N}\p{P}\s{}]/gu, '').length > 0;
// En graphie arabe, un mot latin resté dans la valeur (hors sigles et jetons) est une erreur : la carte doit se lire d'une traite.
const latinRestant = (s) => /[A-Za-zÀ-ÿ]{2,}/.test(sansJetons(String(s).replace(SIGLES, '')));
const scriptOk = (s) => (GRAPHIE === 'latine' ? latinOnly(s) : ARABIC_ONLY.test(s) && !latinRestant(s)) && !arabizi(s);

function validate(source, out) {
  const errors = [];
  for (const [key, fr] of Object.entries(source)) {
    const value = out[key];
    if (typeof value !== 'string' || !value.trim()) { errors.push(`${key} : traduction vide`); continue; }
    if (GRAPHIE === 'latine' && !latinOnly(value)) { errors.push(`${key} : caractères arabes interdits en écriture latine`); continue; }
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

// Même majuscule initiale que le français quand la valeur commence par une lettre.
const sameCase = (fr, value) => {
  if (!/^\p{Lu}/u.test(fr) || !/^\p{Ll}/u.test(value)) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};

async function translate(name, source) {
  console.log(`→ ${name} : ${Object.keys(source).length} textes`);
  let result = await callOpenAI(source);
  result = await callOpenAI(result, REVIEW, 'Relis et améliore ces traductions darija. Garde les clés.');
  let errors = validate(source, result);
  if (errors.length) {
    console.log(`  reprise de ${errors.length} entrée(s)…`);
    const retrySource = Object.fromEntries(Object.keys(source).filter((k) => !result[k] || !scriptOk(result[k]) || placeholders(result[k]) !== placeholders(source[k]) || errors.some((e) => e.startsWith(k + ' '))).map((k) => [k, source[k]]));
    const fixed = await callOpenAI(retrySource);
    Object.assign(result, fixed);
    errors = validate(source, result);
  }
  if (errors.length) {
    console.error(`Échec de validation pour ${name} :\n- ${errors.join('\n- ')}`);
    process.exit(3);
  }
  return Object.fromEntries(Object.keys(source).map((k) => [k, sameCase(source[k], result[k].trim())]));
}

// --- Écriture ----------------------------------------------------------------
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
function table(name, obj, indent = '  ') {
  const lines = Object.entries(obj).map(([k, v]) => `${indent}${q(k)}: ${q(v)},`);
  return `export const ${name} = {\n${lines.join('\n')}\n};\n`;
}

async function main() {
  const out = {};
  const wanted = (g) => !ONLY || ONLY.split(',').includes(g);
  const name = (base) => `${base}_${SUFFIX}`;
  if (wanted('ui')) out[name('TX')] = await translate('ui', groups.ui);
  if (wanted('goals')) out[name('GOAL')] = await translate('goals', groups.goals);
  if (wanted('sections')) out[name('SECTION')] = await translate('sections', groups.sections);
  if (wanted('other')) {
    out[name('EMOTION')] = await translate('émotions', groups.other.emotions);
    out[name('SITUATION')] = await translate('situations', groups.other.situations);
    out[name('STORY')] = await translate('histoires', groups.other.stories);
    out[name('ROUTINE_TEXT')] = await translate('routines (accueil)', groups.other.routines);
    out[name('THEME')] = await translate('thèmes autocollants', groups.other.themes);
  }

  // Une génération partielle réutilise les tables déjà présentes.
  let text = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  for (const [name, value] of Object.entries(out)) {
    const block = table(name, value);
    const re = new RegExp(`export const ${name} = \\{[\\s\\S]*?\\n\\};\\n`);
    text = re.test(text) ? text.replace(re, block) : `${text}${text.endsWith('\n') || !text ? '' : '\n\n'}${block}`;
  }
  if (!text.startsWith('//')) {
    text = `// Généré par tools/gen-darija-i18n.mjs — ne pas modifier à la main.\n// Traductions ${LANGUE === 'ar' ? 'arabe standard' : 'darija'} (${GRAPHIE}) demandées à OpenAI ${MODEL}, générées le ${new Date().toISOString().slice(0, 10)}.\n// Aucun texte n'est envoyé au serveur lors de l'utilisation de l'application.\n\n${text}`;
  }
  fs.writeFileSync(OUT, text, 'utf8');
  console.log(`✅ ${path.relative(root, OUT)} écrit (${Object.keys(out).join(', ')}).`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
