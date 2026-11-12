// Garde l'application disponible sans internet.
const CACHE = 'kalimati-v3-2';
const FILES = [
  './', './index.html', './style.css', './app.js', './db.js', './data.js', './speech.js',
  './media.js', './editor.js', './backup.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './modules/util.js', './modules/drag.js', './modules/goals.js', './modules/content.js', './modules/aba.js',
  './modules/progress.js', './modules/nour.js', './modules/timer.js', './modules/widgets.js',
  './modules/grid-layout.js', './modules/arasaac.js', './modules/spaces.js', './modules/dashboard.js',
  './modules/profil.js', './modules/visuals.js', './modules/ex-emotions.js',
  './modules/ex-coop.js', './modules/ex-visual.js', './modules/ex-receptive.js', './modules/ex-imitation.js',
  './modules/ex-verbal.js', './modules/ex-social.js', './modules/ex-academic.js', './modules/ex-writing.js',
  './modules/ex-autonomy.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Réseau d'abord (pour recevoir les mises à jour), cache si pas de réseau.
// Seuls les fichiers de l'application sont mis en cache (pas les recherches ARASAAC).
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
  );
});
