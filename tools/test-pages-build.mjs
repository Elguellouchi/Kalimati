import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, 'tools', 'build-pages.mjs');
const SERVE = path.join(ROOT, 'tools', 'serve.mjs');
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'kalimati-pages-'));

async function write(relative, content) {
  const target = path.join(temp, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}

async function exists(relative) {
  return fs.access(path.join(temp, relative)).then(() => true).catch(() => false);
}

async function read(relative) {
  return fs.readFile(path.join(temp, relative), 'utf8');
}

function runBuild(cwd, main = 'main', essai = 'essai', out = '_site', nodeArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...nodeArgs, BUILD, '--main', main, '--essai', essai, '--out', out], { cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

async function freePort() {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startServer(env = {}) {
  const port = await freePort();
  const childEnv = { ...process.env, PORT: String(port), HOST: '127.0.0.1' };
  delete childEnv.SERVE_ROOT;
  Object.assign(childEnv, env);
  const child = spawn(process.execPath, [SERVE], { cwd: ROOT, env: childEnv });
  let output = '';
  child.stderr.on('data', (chunk) => { output += chunk; });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`serveur non prêt : ${output}`)), 10000);
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.includes('serveur de test :')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`serveur arrêté (${code}) : ${output}`));
    });
  });
  return { child, base: `http://127.0.0.1:${port}` };
}

async function stopServer(server) {
  if (server.child.exitCode === null) {
    server.child.kill();
    await once(server.child, 'exit');
  }
}

try {
  for (const [tree, label] of [['main', 'main'], ['essai', 'trial']]) {
    await write(`${tree}/index.html`, `${label}-index`);
    await write(`${tree}/app.js`, `${label}-app`);
    await write(`${tree}/sw.js`, `${label}-worker`);
    await write(`${tree}/modules/storage.js`, `${label}-storage`);
    await write(`${tree}/assets/neutral.txt`, `${label}-asset`);
    await write(`${tree}/private.txt`, `${label}-private`);
    await write(`${tree}/docs/neutral.md`, `${label}-docs`);
  }
  await write('essai/Agent.md', 'private-notes');
  await write('main/theme-boot.js', 'main-theme');

  let result = await runBuild(temp);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await read('_site/index.html'), 'main-index');
  assert.equal(await read('_site/essai/index.html'), 'trial-index');
  assert.equal(await read('_site/app.js'), 'main-app');
  assert.equal(await read('_site/essai/app.js'), 'trial-app');
  assert.equal(await read('_site/modules/storage.js'), 'main-storage');
  assert.equal(await read('_site/essai/modules/storage.js'), 'trial-storage');
  assert.equal(await read('_site/assets/neutral.txt'), 'main-asset');
  assert.equal(await read('_site/essai/assets/neutral.txt'), 'trial-asset');
  assert.equal(await read('_site/theme-boot.js'), 'main-theme');
  assert.equal(await exists('_site/.nojekyll'), true);
  for (const excluded of ['private.txt', 'docs', 'essai/private.txt', 'essai/docs', 'essai/Agent.md']) {
    assert.equal(await exists(`_site/${excluded}`), false, `${excluded} ne doit pas être publié`);
  }

  await write('_site/stale.txt', 'stale');
  result = await runBuild(temp);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await exists('_site/stale.txt'), false, 'une reconstruction doit retirer les anciens fichiers');

  await write('fail-rename.cjs', `
const fs = require('node:fs/promises');
const path = require('node:path');
const original = fs.rename;
fs.rename = async (from, to) => {
  if (path.basename(from).startsWith('_site.tmp-') && !from.endsWith('.old') && path.basename(to) === '_site') {
    throw new Error('neutral rename failure');
  }
  return original(from, to);
};
require('node:module').syncBuiltinESMExports();
`);
  result = await runBuild(temp, 'main', 'essai', '_site', ['--require', path.join(temp, 'fail-rename.cjs')]);
  assert.notEqual(result.code, 0, 'un échec de remplacement doit être signalé');
  assert.match(result.stderr, /neutral rename failure/);
  assert.equal(await read('_site/index.html'), 'main-index', 'un échec de remplacement doit restaurer l’ancien artefact');
  assert.equal(await read('_site/app.js'), 'main-app');
  assert.equal(await read('_site/essai/index.html'), 'trial-index');
  assert.equal((await fs.readdir(temp)).some((name) => name.startsWith('_site.tmp-')), false, 'les dossiers temporaires doivent être nettoyés');

  await fs.rm(path.join(temp, 'main', 'index.html'));
  result = await runBuild(temp);
  assert.notEqual(result.code, 0, 'un index principal absent doit refuser la construction');
  assert.match(result.stderr, /index\.html absent de/);
  assert.equal(await read('_site/index.html'), 'main-index', 'un refus ne doit pas détruire le dernier artefact valide');
  await write('main/index.html', 'main-index');

  await fs.rm(path.join(temp, 'essai', 'sw.js'));
  result = await runBuild(temp);
  assert.notEqual(result.code, 0, 'un service worker d’essai absent doit refuser la construction');
  assert.match(result.stderr, /sw\.js absent de/);
  await write('essai/sw.js', 'trial-worker');

  await fs.mkdir(path.join(temp, 'main', 'style.css'));
  await write('main/style.css/neutral.txt', 'not-a-stylesheet');
  result = await runBuild(temp);
  assert.notEqual(result.code, 0, 'un fichier optionnel invalide doit refuser la construction');
  assert.equal(await read('_site/index.html'), 'main-index', 'une copie échouée doit conserver le dernier artefact valide');
  assert.equal(await read('_site/app.js'), 'main-app');
  assert.equal(await read('_site/essai/index.html'), 'trial-index');
  assert.equal((await fs.readdir(temp)).some((name) => name.startsWith('_site.tmp-')), false, 'le dossier temporaire doit être nettoyé');
  await fs.rm(path.join(temp, 'main', 'style.css'), { recursive: true });

  await write('outside/secret.txt', 'secret-outside');
  const assetLink = path.join(temp, 'main', 'assets', 'leak');
  await fs.symlink(path.join(temp, 'outside'), assetLink, process.platform === 'win32' ? 'junction' : 'dir');
  result = await runBuild(temp);
  assert.notEqual(result.code, 0, 'un lien dans un dossier autorisé doit être refusé');
  assert.match(result.stderr, /lien/i);
  assert.equal(await exists('_site/assets/leak/secret.txt'), false, 'un lien ne doit pas exposer de fichier extérieur');
  assert.equal(await read('_site/index.html'), 'main-index');
  await fs.rm(assetLink, { recursive: true, force: true });

  const sourceLink = path.join(temp, 'alias');
  await fs.symlink(path.join(temp, '_site'), sourceLink, process.platform === 'win32' ? 'junction' : 'dir');
  result = await runBuild(temp, 'alias', 'essai');
  assert.notEqual(result.code, 0, 'une source liée à la sortie doit être refusée');
  assert.match(result.stderr, /sortie.*source|source.*sortie/i);
  assert.equal(await read('_site/index.html'), 'main-index', 'une source liée ne doit pas provoquer la suppression de la sortie');
  await fs.rm(sourceLink, { recursive: true, force: true });

  await write('main/_site/keep.txt', 'keep');
  result = await runBuild(path.join(temp, 'main'), '.', '../essai');
  assert.notEqual(result.code, 0, 'une sortie dans une source doit être refusée');
  assert.match(result.stderr, /sortie.*source|source.*sortie/i);
  assert.equal(await read('main/_site/keep.txt'), 'keep', 'le refus ne doit rien supprimer dans la source');

  let server;
  try {
    server = await startServer();
    const redirect = await fetch(`${server.base}/essai?theme=neutral`, { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(new URL(redirect.headers.get('location'), server.base).pathname, '/essai/');
    assert.equal(new URL(redirect.headers.get('location'), server.base).search, '?theme=neutral');
    const script = await fetch(`${server.base}/essai/modules/storage.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /^application\/javascript(?:;|$)/);
    assert.equal(await script.text(), await (await fetch(`${server.base}/modules/storage.js`)).text());
    assert.equal(await (await fetch(`${server.base}/essai/`)).text(), await (await fetch(`${server.base}/`)).text());
    const nearMatch = await fetch(`${server.base}/essai-copie/`, { redirect: 'manual' });
    assert.equal(nearMatch.status, 404, '/essai-copie/ ne doit pas être traité comme l’essai');
  } finally {
    if (server) await stopServer(server);
  }

  const artifactLink = path.join(temp, '_site', 'assets', 'leak');
  await fs.symlink(path.join(temp, 'outside'), artifactLink, process.platform === 'win32' ? 'junction' : 'dir');
  server = await startServer({ SERVE_ROOT: path.join(temp, '_site') });
  try {
    const redirect = await fetch(`${server.base}/essai`, { redirect: 'manual' });
    assert.equal(redirect.status, 302);
    assert.equal(new URL(redirect.headers.get('location'), server.base).pathname, '/essai/');
    const trial = await fetch(`${server.base}/essai/`);
    assert.equal(trial.status, 200);
    assert.equal(await trial.text(), 'trial-index');
    const script = await fetch(`${server.base}/essai/modules/storage.js`);
    assert.match(script.headers.get('content-type'), /^application\/javascript(?:;|$)/);
    assert.equal(await script.text(), 'trial-storage');
    assert.equal((await fetch(`${server.base}/Agent.md`)).status, 404);
    assert.equal((await fetch(`${server.base}/assets/leak/secret.txt`)).status, 404, 'le serveur ne doit pas suivre un lien hors de sa racine');
  } finally {
    await stopServer(server);
  }

  console.log('✅ Artefact Pages combiné, liste blanche et routage local /essai/ vérifiés.');
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
