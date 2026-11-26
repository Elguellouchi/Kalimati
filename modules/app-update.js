// L1-08 : activation et rechargement uniquement quand l'application passe en arrière-plan.
import { APP_VERSION } from './version.js';
import { h } from './util.js';

let registration = null;
let applying = false;
let reloadPending = false;

function activateWaiting() {
  if (!registration?.waiting || applying) return;
  // Ne pas remplacer un worker tiers qui contrôlerait déjà cette portée.
  if (registration.active && !registration.active.scriptURL.endsWith('/sw.js')) return;
  applying = true;
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function startAppUpdateWatch() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!applying) return;
    applying = false;
    if (document.visibilityState === 'hidden') location.reload();
    else reloadPending = true;
  });
  navigator.serviceWorker.register('./sw.js', {
    updateViaCache: 'none',
    scope: './',
  }).then((reg) => {
    registration = reg;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        reg.update().catch(() => {});
        return;
      }
      if (reloadPending) {
        reloadPending = false;
        location.reload();
        return;
      }
      activateWaiting();
    });
  }).catch(() => { /* hors ligne ou service worker indisponible : l'appli marche quand même */ });
}

export function updateBox() {
  const status = h('p', { class: 'note' }, `Version ${APP_VERSION} · une nouvelle version s'applique quand l'application passe en arrière-plan.`);
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
      status.textContent = 'Une nouvelle version est prête. Elle s’appliquera quand l’application passera en arrière-plan.';
      return;
    }
    status.textContent = `Vous êtes à jour (version ${APP_VERSION}).`;
  },
  }, '🔎 Vérifier une mise à jour');
  return h('section', { class: 'card-box' }, h('h3', {}, '🔄 Mise à jour de l’application'), status, h('div', { class: 'row' }, check));
}
