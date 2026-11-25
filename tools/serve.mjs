// L0-03b : tout petit serveur statique pour les tests, écrit avec node:http seul (aucune dépendance).
// Il imite GitHub Pages : mêmes types de contenu, pas de listing de dossier, introuvable hors du projet.
// Usage : node tools/serve.mjs   (port 4173, ou PORT=5199 pour tools/test-privacy-network.mjs)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '127.0.0.1';

// Le type des .js est relevé sur le site publié (application/javascript; charset=utf-8).
// Un module refusé comme « texte » ne se charge pas : le test serait rouge pour une raison de serveur.
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/vnd.microsoft.icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
};

// no-store : un test ne doit jamais relire un fichier oublié en cache par le navigateur.
const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  let file = path.normalize(path.join(ROOT, clean));
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return null; // hors du projet : refusé
  if (clean.endsWith('/')) file = path.join(file, 'index.html');
  if (!path.extname(file) && !fs.existsSync(file)) file += '.html';
  return file;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...HEADERS, Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  const file = resolve(req.url || '/');
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { ...HEADERS, 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><meta charset="utf-8"><title>404</title><p>Introuvable.</p>');
    return;
  }
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const body = fs.readFileSync(file);
  res.writeHead(200, { ...HEADERS, 'Content-Type': type, 'Content-Length': body.length });
  res.end(req.method === 'HEAD' ? undefined : body);
});

server.listen(PORT, HOST, () => {
  console.log(`serveur de test : http://${HOST}:${PORT} (racine ${ROOT})`);
});
