// 🔄 Mise à jour de l'application : jamais automatique.
// Sur iPhone, un rechargement forcé au changement de version pouvait laisser IndexedDB
// endormie (écran vide) et se répéter. Désormais la nouvelle version s'installe en
// attente ; elle s'active au prochain lancement, ou quand le parent touche « Actualiser ».
import { APP_VERSION } from './version.js';
import { h } from './util.js';

let registration = null;
let applying = false;

export function startAppUpdateWatch() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!applying) return;
    applying = false;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js', {
    updateViaCache: 'none',
    scope: './',
  }).then((reg) => {
    registration = reg;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => { /* hors ligne ou service worker indisponible : l'appli marche quand même */ });
}

export function updateBox() {
  const status = h('p', { class: 'note' }, `Version ${APP_VERSION} · une nouvelle version s'installe toute seule et s'active à la prochaine ouverture.`);
  const apply = h('button', { type: 'button', class: 'btn primary', onclick: () => {
    if (!registration?.waiting) return;
    applying = true;
    status.textContent = 'Actualisation…';
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    // Relance de secours après un toucher explicite, si le navigateur ne signale pas la prise de main.
    setTimeout(() => { if (applying) { applying = false; location.reload(); } }, 4000);
  } }, '🔄 Actualiser maintenant');
  apply.hidden = true;
  const check = h('button', { type: 'button', class: 'btn ghost', onclick: async () => {
    status.textContent = 'Recherche de mise à jour…';
    if (!registration) {
      try { registration = await navigator.serviceWorker.ready; } catch {
        status.textContent = 'Mise à jour indisponible : ouvrez Kalimati depuis le site ou l’icône installée.';
        return;
      }
    }
    try { await registration.update(); } catch { /* réseau absent : on garde la version actuelle */ }
    if (registration.waiting) {
      status.textContent = 'Une nouvelle version est prête.';
      apply.hidden = false;
      return;
    }
    status.textContent = `Vous êtes à jour (version ${APP_VERSION}).`;
    apply.hidden = true;
  } }, '🔎 Vérifier une mise à jour');
  return h('section', { class: 'card-box' }, h('h3', {}, '🔄 Mise à jour de l’application'), status, h('div', { class: 'row' }, check, apply));
}
