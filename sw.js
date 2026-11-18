// Garde l'application disponible sans internet.
const CACHE = 'kalimati-v10-1-3';
const FILES = [
  './', './index.html', './style.css', './app.js', './db.js', './data.js', './speech.js',
  './media.js', './editor.js', './backup.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './modules/util.js', './modules/drag.js', './modules/goals.js', './modules/content.js', './modules/aba.js',
  './modules/progress.js', './modules/nour.js', './modules/timer.js', './modules/widgets.js',
  './modules/grid-layout.js', './modules/arasaac.js', './modules/spaces.js', './modules/dashboard.js',
  './modules/profil.js', './modules/visuals.js', './modules/ex-emotions.js',
  './modules/levels.js', './modules/catalog.js', './modules/content-plus.js', './modules/online-bank.js', './modules/ex-online.js', './modules/ex-next.js', './modules/ex-schedule.js', './modules/aac-plus.js', './modules/stories.js', './modules/calm.js', './modules/languages.js',
  './modules/ex-coop.js', './modules/ex-visual.js', './modules/ex-receptive.js', './modules/ex-imitation.js',
  './modules/ex-verbal.js', './modules/ex-social.js', './modules/ex-academic.js', './modules/ex-writing.js',
  './modules/ex-autonomy.js', './modules/ex-hygiene.js', './modules/ex-abc.js', './modules/ex-ortho.js', './modules/ortho-report.js', './modules/atec.js', './modules/admin-beta.js',
  './modules/ui-icons.js', './modules/about.js', './modules/rewards-kids.js', './modules/darija-lexicon.js', './modules/friends.js', './modules/morphology.js', './modules/cloud-sync.js', './modules/eye-and-packs.js',
  // v9.14 : voix des 7 Amis (Shimmer)
  './voix/dr/ami-nour-1.mp3', './voix/dr/ami-nour-2.mp3', './voix/dr/ami-fennou-1.mp3', './voix/dr/ami-fennou-2.mp3', './voix/dr/ami-fakroun-1.mp3', './voix/dr/ami-fakroun-2.mp3', './voix/dr/ami-hmama-1.mp3', './voix/dr/ami-hmama-2.mp3', './voix/dr/ami-jmimla-1.mp3', './voix/dr/ami-jmimla-2.mp3', './voix/dr/ami-mchicha-1.mp3', './voix/dr/ami-mchicha-2.mp3', './voix/dr/ami-bouma-1.mp3', './voix/dr/ami-bouma-2.mp3', './voix/fr/ami-nour-1.mp3', './voix/fr/ami-nour-2.mp3', './voix/fr/ami-fennou-1.mp3', './voix/fr/ami-fennou-2.mp3', './voix/fr/ami-fakroun-1.mp3', './voix/fr/ami-fakroun-2.mp3', './voix/fr/ami-hmama-1.mp3', './voix/fr/ami-hmama-2.mp3', './voix/fr/ami-jmimla-1.mp3', './voix/fr/ami-jmimla-2.mp3', './voix/fr/ami-mchicha-1.mp3', './voix/fr/ami-mchicha-2.mp3', './voix/fr/ami-bouma-1.mp3', './voix/fr/ami-bouma-2.mp3',
  './assets/manifest.json', './assets/mulberry/index.json', './assets/emoji/index.json', './assets/darija-lexicon.json',
  './assets/fonts/AtkinsonHyperlegibleNext-Regular.woff2', './assets/fonts/AtkinsonHyperlegibleNext-Bold.woff2',
  './assets/fonts/NunitoSans-400.woff2', './assets/fonts/NunitoSans-700.woff2', './assets/fonts/NunitoSans-800.woff2',
  './assets/amis/nour.svg', './assets/amis/mchicha.svg', './assets/amis/bouma.svg',
];

// v9.1 : pictogrammes Mulberry et émojis OpenMoji (liste dans assets/manifest.json), mis en cache sans bloquer l'installation.
async function assetFiles() {
  try {
    const response = await fetch('./assets/manifest.json', { cache: 'no-cache' });
    if (!response.ok) return [];
    const list = await response.json();
    return [...(list.mulberry || []), ...(list.emoji || [])].map((file) => `./assets/${file}`);
  } catch {
    return [];
  }
}

// Voix par défaut des cartes (voix/index.json) : mises en cache aussi, pour parler sans internet.
async function voiceFiles() {
  try {
    const response = await fetch('./voix/index.json', { cache: 'no-cache' });
    if (!response.ok) return [];
    const index = await response.json();
    return ['./voix/index.json', ...Object.entries(index).flatMap(([lang, ids]) => Object.keys(ids).map((id) => `./voix/${lang}/${encodeURIComponent(id)}.mp3`))];
  } catch {
    return [];
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES);
    // Une voix manquante ne doit pas empêcher l'installation.
    // v10.1.2 : les voix et images déjà gardées sont recopiées de l'ancienne version
    // (avant, ~780 fichiers étaient retéléchargés à chaque mise à jour, ce qui saturait le téléphone).
    const reuse = async (file) => {
      const old = await caches.match(file).catch(() => null);
      if (old) return cache.put(file, old).catch(() => {});
      return cache.add(file).catch(() => {});
    };
    await Promise.all((await voiceFiles()).map(reuse));
    await Promise.all((await assetFiles()).map(reuse));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// v10.1.2 :
// - code de l'appli (html, js, css) : réseau d'abord, mais 3 s maximum, sinon la copie gardée ;
// - voix, images, polices, listes : la copie gardée tout de suite, mise à jour en arrière-plan.
// Avant, un réseau lent pouvait laisser l'écran vide sans limite de temps.
// Seuls les fichiers de l'application sont mis en cache (pas les recherches ARASAAC).
const NETWORK_WAIT_MS = 3000;
const isStatic = (url) => /\/(voix|assets|icons)\//.test(url.pathname) || /\.(mp3|png|jpe?g|svg|webp|woff2?|json)$/.test(url.pathname);

function saveCopy(request, response) {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.headers.has('range')) return; // lecture audio partielle : on laisse le navigateur faire
  if (isStatic(url)) {
    event.respondWith((async () => {
      const hit = await caches.match(request);
      const fresh = fetch(request, { cache: 'no-cache' }).then((r) => saveCopy(request, r));
      if (hit) { event.waitUntil(fresh.catch(() => {})); return hit; }
      return fresh.catch(() => caches.match('./index.html'));
    })());
    return;
  }
  event.respondWith((async () => {
    const network = fetch(request, { cache: 'no-cache' }).then((r) => saveCopy(request, r));
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_WAIT_MS));
    const first = await Promise.race([network.catch(() => null), timeout]);
    if (first) return first;
    const hit = await caches.match(request);
    if (hit) { event.waitUntil(network.catch(() => {})); return hit; }
    return network.catch(() => caches.match('./index.html'));
  })());
});
