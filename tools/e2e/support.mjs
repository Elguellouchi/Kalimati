// Aides communes des tests E2E (Lot 0, L0-03). Elles ouvrent la vraie application sur le serveur
// local tools/serve.mjs et touchent les vraies cartes : aucun bouchon, aucun code d'exemple.
import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';

// Le nom du troisième profil de playwright.config.js : un Chromium où le cache hors ligne n'existe pas.
export const SANS_CACHES = 'chromium-sans-caches';

// Appareil D2 du cahier (Chrome sur iPhone) : ni window.caches, ni service worker qui s'installe.
// L'application doit quand même fonctionner : modules/app-update.js attrape déjà l'échec de register().
export function disableOfflineCache() {
  Object.defineProperty(window, 'caches', { configurable: true, get: () => undefined });
  if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new TypeError('service worker indisponible'));
}

export const HOME_TILE_TALK = '.home-grid .tile-talk';
export const visibleCards = (page) => page.locator('main .grid button.card').filter({ visible: true });
export const stripCards = (page) => page.locator('#strip-cards button.card');

export const gridCardIds = (page) => page.$$eval('main .grid button.card', (els) => els.map((el) => el.dataset.cardId));

// Ouvrir l'application puis entrer dans l'espace Parler : renvoie le temps mesuré, en millisecondes.
export async function openTalkGrid(page, path = '/') {
  const start = Date.now();
  await page.goto(path);
  const loaded = Date.now();
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  const homeVisible = Date.now();
  await page.locator(HOME_TILE_TALK).dispatchEvent('click');
  const clicked = Date.now();
  await expect(visibleCards(page).first()).toBeVisible({ timeout: 3000 });
  const elapsed = Date.now() - start;
  console.log(`ouverture : navigation ${loaded - start} ms, accueil ${homeVisible - loaded} ms, toucher ${clicked - homeVisible} ms, grille ${Date.now() - clicked} ms`);
  return elapsed;
}

export const openTrialTalkGrid = (page) => openTalkGrid(page, '/essai/');

export async function trialCacheName(page) {
  return page.evaluate(async () =>
    (await caches.keys()).find((name) => name === 'kalimati-essai-v10-54') || null);
}

export async function installMainWorkerFixture(page, source, label = 'main') {
  const localRoot = fileURLToPath(new URL('../../', import.meta.url));
  const root = process.env.SERVE_ROOT
    ? path.resolve(process.env.SERVE_ROOT)
    : path.resolve(localRoot, '..', `${path.basename(localRoot)}-e2e`, '_site');
  const filename = `g0.main-worker-fixture-${process.pid}-${label}.js`;
  const fixturePath = path.join(root, filename);
  const fixtureUrl = `/${filename}`;
  const cleanup = () => rmSync(fixturePath, { force: true });
  writeFileSync(fixturePath, source);
  try {
    await page.goto('/');
    await page.evaluate(async (url) => {
      await navigator.serviceWorker.register(url, { scope: '/' });
    }, fixtureUrl);
    await expect.poll(() => page.evaluate(async (url) => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      return Boolean(
        registration?.waiting?.scriptURL.endsWith(url)
        || registration?.active?.scriptURL.endsWith(url),
      );
    }, fixtureUrl), { timeout: 30_000 }).toBe(true);
    await page.evaluate(async (url) => {
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration?.waiting?.scriptURL.endsWith(url)) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }, fixtureUrl);
    await expect.poll(() => page.evaluate(async (url) =>
      (await navigator.serviceWorker.getRegistration('/'))?.active?.scriptURL.endsWith(url) || false,
    fixtureUrl), { timeout: 30_000 }).toBe(true);
    await page.reload();
    await expect.poll(() => page.evaluate((url) =>
      navigator.serviceWorker.controller?.scriptURL.endsWith(url) || false,
    fixtureUrl), { timeout: 20_000 }).toBe(true);
    return cleanup;
  } catch (error) {
    cleanup();
    throw error;
  }
}

// Toucher trois cartes du tableau et rendre leurs identifiants, dans l'ordre.
export async function tapThreeCards(page) {
  const cards = visibleCards(page);
  await expect(cards.nth(2)).toBeVisible(); // trois cartes au moins dans le tableau
  const picked = [];
  for (let i = 0; i < 3; i += 1) {
    const card = cards.nth(i);
    picked.push(await card.getAttribute('data-card-id'));
    await card.click();
    await page.waitForTimeout(150); // la bande de phrase s'affiche après le toucher
  }
  return picked;
}

// Le service worker a-t-il gardé l'application dans son cache ? (scénario « réseau coupé »)
export async function waitCachedApp(page) {
  await expect.poll(async () => page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.active) return 'pas de service worker actif';
    const main = (await caches.keys()).find((key) => /^kalimati(?:-essai)?-v\d/.test(key));
    if (!main) return 'pas de cache principal';
    const cache = await caches.open(main);
    const [html, js] = await Promise.all([cache.match('./index.html'), cache.match('./app.js')]);
    return html && js ? `cache ${main} prêt` : 'cache incomplet';
  }), { timeout: 20_000 }).toMatch(/prêt/);
}
