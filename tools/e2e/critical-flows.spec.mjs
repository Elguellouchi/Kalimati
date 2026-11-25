// Lot 0, exigence L0-03 : les quatre chemins critiques de l'enfant, ouverts dans un vrai navigateur.
// (a) ouverture à froid, (b) trois cartes touchées, (c) rechargement, (d) les mêmes sans window.caches.
// Le scénario (e) « réseau coupé » est dans offline.spec.mjs (Chromium seulement, décision D-2).
import { test, expect } from '@playwright/test';
import {
  SANS_CACHES, disableOfflineCache, HOME_TILE_TALK,
  openTalkGrid, visibleCards, stripCards, gridCardIds, tapThreeCards, warmWebKitRenderer,
} from './support.mjs';

// Le profil « chromium-sans-caches » joue les mêmes scénarios que les autres, sans cache ni service worker.
test.beforeEach(async ({ browser, page }, testInfo) => {
  if (testInfo.project.name === SANS_CACHES) await page.addInitScript(disableOfflineCache);
  if (testInfo.project.name === 'iphone-13-webkit' && testInfo.title.startsWith('a —')) {
    await warmWebKitRenderer(browser);
  }
});

test('a — ouverture à froid : la grille « Parler » s’affiche en moins de 3 s', async ({ page }) => {
  page.on('console', (message) => {
    if (/^\[(audio|click)-timing\]/.test(message.text())) console.log(message.text());
  });
  const ms = await openTalkGrid(page, { traceAudio: true });
  console.log(`grille « Parler » affichée en ${ms} ms`);
  expect(ms).toBeLessThan(3000);
});

test('b — trois cartes touchées : la phrase contient les trois cartes', async ({ page }) => {
  await openTalkGrid(page);
  const picked = await tapThreeCards(page);
  await expect(stripCards(page)).toHaveCount(3);
  const inStrip = await page.$$eval('#strip-cards button.card', (els) => els.map((el) => el.dataset.cardId));
  expect(inStrip).toEqual(picked);
});

test('c — rechargement : les cartes de l’enfant sont toujours là', async ({ page }) => {
  await openTalkGrid(page);
  const before = await gridCardIds(page);
  expect(before.length).toBeGreaterThan(0);
  const sourceId = before[0];
  const persistedId = 'e2e-carte-persistante';
  await page.evaluate(async ({ sourceId, persistedId }) => {
    const db = await import('/db.js');
    const source = (await db.getAllCards()).find((card) => card.id === sourceId);
    await db.putCard({
      ...source,
      id: persistedId,
      fr: 'Carte test',
      dr: 'Carte test',
      ar: 'بطاقة اختبار',
      sayFr: 'Carte test',
      sayAr: 'بطاقة اختبار',
      order: -1,
      gridRow: 0,
      gridCol: 0,
      hidden: false,
    });
  }, { sourceId, persistedId });
  await page.reload();
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  await page.locator(HOME_TILE_TALK).click();
  await expect(visibleCards(page).first()).toBeVisible();
  expect(await gridCardIds(page)).toEqual(expect.arrayContaining([...before, persistedId]));
});
