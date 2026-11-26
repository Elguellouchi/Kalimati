// Garde l'application disponible sans internet.
const CACHE_VERSION = 'v10-47';
const TRIAL = /(^|\/)essai(?:\/|$)/.test(self.location.pathname);
const CACHE = TRIAL ? `kalimati-essai-${CACHE_VERSION}` : `kalimati-${CACHE_VERSION}`;
const FILES = [
  './', './index.html', './boot-guard.js', './modules/storage.js', './modules/voice-cache.js', './theme-boot.js', './style.css', './app.js', './db.js', './data.js', './speech.js',
  './media.js', './editor.js', './backup.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png',
  './modules/util.js', './modules/drag.js', './modules/goals.js', './modules/content.js', './modules/aba.js',
  './modules/progress.js', './modules/nour.js', './modules/timer.js', './modules/widgets.js',
  './modules/grid-layout.js', './modules/arasaac.js', './modules/spaces.js', './modules/dashboard.js',
  './modules/profil.js', './modules/visuals.js', './modules/ex-emotions.js',
  './modules/levels.js', './modules/catalog.js', './modules/content-plus.js', './modules/online-bank.js', './modules/ex-online.js', './modules/ex-next.js', './modules/ex-schedule.js', './modules/aac-plus.js', './modules/stories.js', './modules/calm.js', './modules/languages.js', './modules/locales.js', './modules/locales-data.js', './modules/amazigh-lexicon.js', './modules/voice-packs.js', './modules/error-log.js', './modules/db-fallback.js', './modules/storage-persist.js',
  './modules/ex-coop.js', './modules/ex-visual.js', './modules/ex-receptive.js', './modules/ex-imitation.js',
  './modules/ex-verbal.js', './modules/ex-social.js', './modules/ex-academic.js', './modules/ex-writing.js',
  './modules/ex-autonomy.js', './modules/ex-hygiene.js', './modules/ex-abc.js', './modules/ex-ortho.js', './modules/ortho-report.js', './modules/atec.js', './modules/admin-beta.js', './modules/core-vocabulary-plan.js',
  './modules/ui-icons.js', './modules/about.js', './modules/rewards-kids.js', './modules/darija-lexicon.js', './modules/friends.js', './modules/morphology.js', './modules/cloud-sync.js', './modules/eye-and-packs.js', './modules/version.js', './modules/network-policy.js', './modules/team-mode.js',
  './modules/section-i18n.js', './modules/section-i18n-dr.js',
  // v10.24 : darija en lettres arabes et arabe standard, hors ligne eux aussi
  './modules/section-i18n-dr-ar.js', './modules/section-i18n-ar.js', './modules/clinic-i18n-dr-ar.js', './modules/clinic-i18n-ar.js',
  './modules/i18n-en.js', './modules/i18n-es.js', './modules/i18n-de.js', './modules/i18n-it.js', './modules/i18n-pt.js', './modules/i18n-nl.js', './modules/i18n-tr.js', './modules/i18n-zh.js',
  // v10.15 : ateliers cliniques et leurs libellés darija (générée hors ligne par OpenAI)
  './modules/clinique.js', './modules/clinic-i18n.js', './modules/clinic-i18n-dr.js',
  // v10.16 : espace thérapeute et fiches de suivi pseudonymisées (100 % locales)
  './modules/cabinet.js', './modules/followup.js', './modules/followup-schema.js',
  // v10.17 : mise à jour sans rechargement automatique
  './modules/app-update.js',
  // v10.18 : migration des cartes sans identifiant historique en dur
  './modules/card-migration.js',
  // v10.23 : moteur tactile central, langue jumelle, quadrillage des émotions
  './modules/tap-engine.js', './modules/twin-language.js', './modules/mood-meter.js', './modules/text-to-picto.js', './modules/place-boards.js', './modules/scenes.js', './modules/caregiver-tips.js', './modules/child-profiles.js', './modules/children-box.js', './modules/talk-modes.js', './modules/ortho-path.js', './modules/ortho-path-data.js', './modules/trace-sound.js', './modules/model-videos.js', './modules/wardrobe-data.js', './modules/voice-mask.js', './modules/voice-mask-data.js', './modules/strip-controller.js', './modules/views.js', './modules/talk-tools.js', './modules/backup-ui.js', './modules/backup-reminder.js', './modules/startup-timing.js', './modules/voice-preload.js',
  // v9.14 : voix des 7 Amis (Shimmer)
  './voix/dr/ami-nour-1.mp3', './voix/dr/ami-nour-2.mp3', './voix/dr/ami-fennou-1.mp3', './voix/dr/ami-fennou-2.mp3', './voix/dr/ami-fakroun-1.mp3', './voix/dr/ami-fakroun-2.mp3', './voix/dr/ami-hmama-1.mp3', './voix/dr/ami-hmama-2.mp3', './voix/dr/ami-jmimla-1.mp3', './voix/dr/ami-jmimla-2.mp3', './voix/dr/ami-mchicha-1.mp3', './voix/dr/ami-mchicha-2.mp3', './voix/dr/ami-bouma-1.mp3', './voix/dr/ami-bouma-2.mp3', './voix/fr/ami-nour-1.mp3', './voix/fr/ami-nour-2.mp3', './voix/fr/ami-fennou-1.mp3', './voix/fr/ami-fennou-2.mp3', './voix/fr/ami-fakroun-1.mp3', './voix/fr/ami-fakroun-2.mp3', './voix/fr/ami-hmama-1.mp3', './voix/fr/ami-hmama-2.mp3', './voix/fr/ami-jmimla-1.mp3', './voix/fr/ami-jmimla-2.mp3', './voix/fr/ami-mchicha-1.mp3', './voix/fr/ami-mchicha-2.mp3', './voix/fr/ami-bouma-1.mp3', './voix/fr/ami-bouma-2.mp3',
  './assets/manifest.json', './assets/mulberry/index.json', './assets/emoji/index.json', './assets/darija-lexicon.json',
  './assets/fonts/AtkinsonHyperlegibleNext-Regular.woff2', './assets/fonts/AtkinsonHyperlegibleNext-Bold.woff2',
  './assets/fonts/NunitoSans-400.woff2', './assets/fonts/NunitoSans-700.woff2', './assets/fonts/NunitoSans-800.woff2',
  './assets/amis/nour.svg', './assets/amis/mchicha.svg', './assets/amis/bouma.svg',
];

// v9.1 : pictogrammes Mulberry et émojis OpenMoji (liste dans assets/manifest.json), réutilisés depuis l'ancien cache.
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

async function warmOptionalAssets(cache) {
  const missing = [];
  const reuse = async (file) => {
    const old = await caches.match(file).catch(() => null);
    if (old) {
      try {
        await cache.put(file, old);
        return;
      } catch { /* repli réseau après l'installation */ }
    }
    missing.push(file);
  };
  await Promise.all((await voiceFiles()).map(reuse));
  await Promise.all((await assetFiles()).map(reuse));
  await reuse('./assets/fonts/NotoSansTifinagh-Regular.woff2');
  return missing;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // v10.7.2 : fichiers de l'appli redemandés au site (pas la copie du navigateur, qui pouvait être
    // l'ancienne version et mélanger deux versions du code).
    await cache.addAll(FILES.map((file) => new Request(file, { cache: 'no-cache' })));
    const missing = await warmOptionalAssets(cache);
    missing.forEach((file) => cache.add(file).catch(() => {}));
    // v10.17 : pas de skipWaiting. La nouvelle version attend que l'appli soit fermée
    // (ou que le parent touche « Actualiser ») : aucun rechargement pendant l'utilisation.
  })());
});

// v10.17 : actualisation manuelle, uniquement sur toucher explicite du parent.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// v10.7 : les voix amazighes (packs et voix des parents) sont gardées d'une version à l'autre.
const AMAZIGH_VOICES = TRIAL ? 'kalimati-essai-amazigh-voices-' : 'kalimati-amazigh-voices-';
// Lot 0, L0-11 : une version ne supprime jamais les caches de l'autre.
const CACHE_SPACE = TRIAL ? /^kalimati-essai-v\d/ : /^kalimati-v\d/;

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && CACHE_SPACE.test(k) && !k.startsWith(AMAZIGH_VOICES)).map((k) => caches.delete(k))))
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

// v10.7 : les packs vocaux amazighs ont leur propre cache (choisi par le parent) : pas de deuxième copie ici.
const isAmazighVoice = (url) => /\/voix\/(shi|tzm|rif|zgh)\/|\/voix\/amz-/.test(new URL(url).pathname);

function saveCopy(request, response) {
  if (response && response.ok && !isAmazighVoice(request.url)) {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
  }
  return response;
}

// v10.5 : l'iPhone demande les sons « par morceaux » (en-tête Range). On répond avec le morceau
// pris dans la copie gardée : les voix marchent aussi sans internet. Sans copie, le réseau répond.
async function rangeFromCache(request) {
  const hit = await caches.match(request.url, { ignoreSearch: true }).catch(() => null);
  if (!hit || hit.status !== 200) return fetch(request);
  try {
    const buf = await hit.clone().arrayBuffer();
    const total = buf.byteLength;
    const m = /^bytes=(\d*)-(\d*)$/.exec((request.headers.get('range') || '').trim());
    if (!m) return hit;
    let start; let end;
    if (m[1] === '') { start = Math.max(0, total - Number(m[2] || 0)); end = total - 1; } // « les N derniers octets »
    else { start = Number(m[1]); end = m[2] === '' ? total - 1 : Math.min(total - 1, Number(m[2])); }
    if (start >= total || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } });
    const headers = new Headers(hit.headers);
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Content-Length', String(end - start + 1));
    if (!headers.get('Content-Type') && /\.mp3$/.test(new URL(request.url).pathname)) headers.set('Content-Type', 'audio/mpeg');
    return new Response(buf.slice(start, end + 1), { status: 206, statusText: 'Partial Content', headers });
  } catch {
    return hit;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!TRIAL && /(^|\/)essai(?:\/|$)/.test(url.pathname)) return;
  if (request.headers.has('range')) {
    if (isStatic(url)) event.respondWith(rangeFromCache(request));
    return;
  }
  // v10.7.1 : les fichiers des packs amazighs viennent toujours du site (sinon « Mettre à jour » reprenait
  // l'ancienne voix gardée dans le pack). Les cartes, elles, jouent la voix gardée en mémoire : rien ne part au toucher.
  if (isAmazighVoice(request.url)) {
    event.respondWith(fetch(request, { cache: 'no-cache' }).catch(() => new Response('', { status: 503, statusText: 'Offline' })));
    return;
  }
  if (isStatic(url)) {
    event.respondWith((async () => {
      const hit = await caches.match(request);
      const fresh = fetch(request, { cache: 'no-cache' }).then((r) => saveCopy(request, r));
      if (hit) { event.waitUntil(fresh.catch(() => {})); return hit; }
      // v10.5 : un son ou une image manquante hors ligne renvoie une vraie erreur (plus la page d'accueil à la place).
      return fresh.catch(() => new Response('', { status: 503, statusText: 'Offline' }));
    })());
    return;
  }
  event.respondWith((async () => {
    const network = fetch(request, { cache: 'no-cache' }).then((r) => saveCopy(request, r));
    const wait = (ms) => new Promise((resolve) => setTimeout(() => resolve(null), ms));
    const first = await Promise.race([network.catch(() => null), wait(NETWORK_WAIT_MS)]);
    if (first) return first;
    const hit = await caches.match(request);
    if (hit) { event.waitUntil(network.catch(() => {})); return hit; }
    // v10.17 : sans copie gardée, le réseau ne peut plus bloquer indéfiniment l'ouverture
    // (c'était un écran vide sans fin sur iPhone quand une requête restait en attente).
    const late = await Promise.race([network.catch(() => null), wait(NETWORK_WAIT_MS)]);
    if (late) return late;
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) return fallback;
    }
    return new Response('', { status: 504, statusText: 'Gateway Timeout' });
  })());
});
