// Aides communes des tests E2E (Lot 0, L0-03). Elles ouvrent la vraie application sur le serveur
// local tools/serve.mjs et touchent les vraies cartes : aucun bouchon, aucun code d'exemple.
import { devices, expect } from '@playwright/test';

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

// Réchauffe le moteur WebKit du runner sans charger Kalimati ni partager son stockage.
export async function warmWebKitRenderer(browser) {
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  try {
    const page = await context.newPage();
    await page.setContent('<button style="width:120px;height:80px">Prêt</button>');
    await page.getByRole('button', { name: 'Prêt' }).click();
  } finally {
    await context.close();
  }
}

export const gridCardIds = (page) => page.$$eval('main .grid button.card', (els) => els.map((el) => el.dataset.cardId));

// Ouvrir l'application puis entrer dans l'espace Parler : renvoie le temps mesuré, en millisecondes.
export async function openTalkGrid(page) {
  const start = Date.now();
  await page.goto('/');
  const loaded = Date.now();
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  const homeVisible = Date.now();
  await page.locator(HOME_TILE_TALK).click();
  const clicked = Date.now();
  await expect(visibleCards(page).first()).toBeVisible({ timeout: 3000 });
  const elapsed = Date.now() - start;
  console.log(`ouverture : navigation ${loaded - start} ms, accueil ${homeVisible - loaded} ms, toucher ${clicked - homeVisible} ms, grille ${Date.now() - clicked} ms`);
  return elapsed;
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
    const main = (await caches.keys()).find((key) => /^kalimati-v\d/.test(key));
    if (!main) return 'pas de cache principal';
    const cache = await caches.open(main);
    const [html, js] = await Promise.all([cache.match('./index.html'), cache.match('./app.js')]);
    return html && js ? `cache ${main} prêt` : 'cache incomplet';
  }), { timeout: 20_000 }).toMatch(/prêt/);
}
