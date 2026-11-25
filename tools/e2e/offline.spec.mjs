// Lot 0, exigence L0-03 (e) : réseau coupé, l'application doit encore s'ouvrir.
// Décision D-2 (24/11/2026) : ce scénario tourne seulement sur Chromium. Playwright ne pilote pas
// les service workers sous WebKit (le cache hors ligne ne se remplit pas dans le navigateur d'essai),
// et le profil « chromium-sans-caches » n'a volontairement aucun cache : c'est justement le scénario (d).
import { test, expect } from '@playwright/test';
import { HOME_TILE_TALK, openTalkGrid, waitCachedApp } from './support.mjs';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-5-chromium',
    'scénario hors ligne : Chromium seulement (décision D-2)');
});

test('e — réseau coupé : l’application s’ouvre encore', async ({ page, context }) => {
  await openTalkGrid(page);
  await waitCachedApp(page);

  await context.setOffline(true);
  const start = Date.now();
  await page.reload();
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible({ timeout: 20_000 });
  await page.locator(HOME_TILE_TALK).click();
  const cards = page.locator('main .grid button.card').filter({ visible: true });
  await expect(cards.first()).toBeVisible({ timeout: 20_000 });
  const ms = Date.now() - start;
  console.log(`réseau coupé : application rouverte en ${ms} ms`);
  expect(ms).toBeLessThan(20_000);

  await context.setOffline(false);
});
