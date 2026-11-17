// Kalimati : voix darija des cartes avec OpenAI (gpt-4o-mini-tts). À lancer sur le PC d'Aziz, jamais en ligne.
// La clé est lue dans le fichier .env (OPENAI_API_KEY=...). Elle n'est jamais écrite ailleurs ni affichée.
// Seuls les mots des cartes (et prénoms) sont envoyés. Jamais la voix de l'enfant.
// Usage :
//   node gen-openai-darija.mjs --env "C:\Users\HP\Projets\b2b-contact-platform\.env" --essais   -> 8 mots x 3 voix dans essais/
//   node gen-openai-darija.mjs --env "..." --tout --voix coral                                     -> toutes les cartes dans dr/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const envPath = opt('--env', path.join(here, '.env'));
const envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
// Accepte un fichier .env (OPENAI_API_KEY=...) ou un fichier qui contient seulement la clé (ex. hq\\scripts\\.openai-token).
const fromEnv = (envText.match(/^\s*OPENAI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m) || [])[1];
const rawFile = !envText.includes('=') && /^sk-[\w-]+$/.test(envText.trim()) ? envText.trim() : '';
const key = (process.env.OPENAI_API_KEY || fromEnv || rawFile || '').trim();
if (!key) { console.error('Clé OpenAI introuvable (OPENAI_API_KEY dans ' + envPath + ').'); process.exit(1); }

const index = JSON.parse(fs.readFileSync(path.join(here, 'index.json'), 'utf8')).dr;
const pron = JSON.parse(fs.readFileSync(path.join(here, 'prononciation.json'), 'utf8'));
const MODEL = opt('--modele', 'gpt-4o-mini-tts');

const consigne = (latin) => [
  'Tu parles en darija marocaine (arabe dialectal du Maroc, région de Rabat-Salé), pas en arabe classique ni en arabe du Moyen-Orient.',
  'Accent marocain naturel, comme une maman marocaine qui parle doucement à sa petite fille de 8 ans.',
  'Voix chaleureuse, calme, très claire, un peu lente. Pas d\'emphase théâtrale.',
  `Dis seulement le mot ou la courte phrase, une seule fois, sans rien ajouter. Prononciation : « ${latin} ».`,
].join(' ');

async function say(id, voice, target) {
  const text = index[id];
  const body = { model: MODEL, voice, input: text, instructions: consigne(pron[id] || text), response_format: 'mp3', speed: 0.9 };
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.ok) { fs.writeFileSync(target, Buffer.from(await res.arrayBuffer())); return true; }
    const msg = (await res.text()).slice(0, 200).replace(key, '***');
    console.error(`  ${id} (${voice}) essai ${attempt} : ${res.status} ${msg}`);
    if (res.status === 401 || res.status === 403) process.exit(2);
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  return false;
}

if (args.includes('--essais')) {
  const ids = ['c-base-je-veux', 'c-base-encore', 'c-base-aide-moi', 'c-base-j-ai-mal', 'c-besoins-toilettes', 'c-emotions-fatigue', 'c-personnes-ghita', 'c-base-c-est-quoi-'];
  const voices = (opt('--voix', 'coral,sage,shimmer')).split(',');
  const dir = path.join(here, 'essais'); fs.mkdirSync(dir, { recursive: true });
  for (const voice of voices) for (const id of ids) { await say(id, voice, path.join(dir, `${voice}__${id}.mp3`)); console.log('ok', voice, id); }
} else if (args.includes('--tout')) {
  const voice = opt('--voix', 'coral');
  const dir = path.join(here, 'dr'); fs.mkdirSync(dir, { recursive: true });
  let ok = 0; const ko = [];
  for (const id of Object.keys(index)) {
    const target = path.join(dir, `${id}.mp3`);
    if (fs.existsSync(target) && fs.statSync(target).size > 1000 && !args.includes('--refaire')) { ok += 1; continue; }
    if (await say(id, voice, target)) ok += 1; else ko.push(id);
  }
  console.log(`${ok} voix prêtes, ${ko.length} échecs ${ko.join(' ')}`);
} else {
  console.log('Préciser --essais ou --tout');
}
