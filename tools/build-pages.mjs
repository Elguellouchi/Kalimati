import { access, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, extname, isAbsolute, relative, resolve, sep } from 'node:path';

const FILES = ['index.html', 'boot-guard.js', 'theme-boot.js', 'style.css', 'app.js', 'db.js', 'data.js', 'speech.js', 'media.js', 'editor.js', 'backup.js', 'manifest.webmanifest', 'sw.js'];
const DIRS = ['assets', 'icons', 'locales', 'modules', 'voix'];
const REQUIRED = ['index.html', 'app.js', 'sw.js'];
const TEXT_FILE = /\.(?:html?|js|mjs|css|json|webmanifest|svg|xml|txt|csv)$/i;

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  const value = process.argv[index + 1];
  if (index < 0 || !value || value.startsWith('--')) throw new Error(`--${name} manquant`);
  return value;
}

const inside = (parent, child) => {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel));
};
const exists = async (target) => access(target).then(() => true).catch(() => false);

async function normalizeText(target) {
  if (!TEXT_FILE.test(target)) return;
  const content = await readFile(target, 'utf8');
  if (content.includes('\r\n')) await writeFile(target, content.replace(/\r\n/g, '\n'));
}

async function normalizeTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = resolve(directory, entry.name);
    if (entry.isDirectory()) await normalizeTree(target);
    else await normalizeText(target);
  }
}

async function copyAllowed(from, to, recursive = false) {
  await cp(from, to, {
    recursive,
    filter: async (source) => {
      if ((await lstat(source)).isSymbolicLink()) throw new Error(`lien refusé : ${source}`);
      return true;
    },
  });
  if (recursive) await normalizeTree(to);
  else await normalizeText(to);
}

async function requireFile(source, name) {
  const target = resolve(source, name);
  const info = await stat(target).catch(() => null);
  if (!info || !info.isFile()) throw new Error(`${name} absent de ${source}`);
}

const cwd = await realpath(process.cwd());
const main = await realpath(resolve(option('main')));
const essai = await realpath(resolve(option('essai')));
const out = resolve(cwd, option('out'));
if (!['_site', '_pages-site'].includes(basename(out))) throw new Error('la sortie doit se terminer par _site ou _pages-site');
if ((await lstat(out).catch(() => null))?.isSymbolicLink()) throw new Error('la sortie ne peut pas être un lien');
for (const source of [main, essai]) {
  if (inside(source, out) || inside(out, source)) throw new Error('la sortie et les sources doivent être des dossiers séparés');
  for (const name of REQUIRED) await requireFile(source, name);
}

const staging = await mkdtemp(resolve(cwd, `${basename(out)}.tmp-`));
const backup = `${staging}.old`;
let backedUp = false;
try {
  for (const [source, destination] of [[main, staging], [essai, resolve(staging, 'essai')]]) {
    for (const name of FILES) {
      const from = resolve(source, name);
      if (await exists(from)) {
        await mkdir(destination, { recursive: true });
        await copyAllowed(from, resolve(destination, name));
      }
    }
    for (const name of DIRS) {
      const from = resolve(source, name);
      if (await exists(from)) await copyAllowed(from, resolve(destination, name), true);
    }
  }
  await writeFile(resolve(staging, '.nojekyll'), '');
  if (await exists(out)) {
    await rename(out, backup);
    backedUp = true;
  }
  await rename(staging, out);
} catch (error) {
  let restoreError = null;
  if (backedUp) {
    try { await rename(backup, out); } catch (caught) { restoreError = caught; }
  }
  await rm(staging, { recursive: true, force: true });
  if (restoreError) throw new AggregateError([error, restoreError], 'échec du remplacement et de la restauration de l’artefact');
  throw error;
}
if (backedUp) await rm(backup, { recursive: true, force: true });
console.log(`Artefact Pages combiné : ${out}`);
