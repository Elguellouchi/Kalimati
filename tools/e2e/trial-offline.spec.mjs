import { test, expect } from '@playwright/test';
import { HOME_TILE_TALK, openTrialTalkGrid, gridCardIds, waitCachedApp } from './support.mjs';

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-5-chromium',
    'hors ligne d’essai : Chromium seulement (décision D-2)');
});

test('hors ligne d’essai — l’application et une carte neutre persistent dans le cache isolé', async ({ page, context }) => {
  test.setTimeout(90_000);
  const id = 'e2e-carte-hors-ligne-essai';
  await openTrialTalkGrid(page);
  const sourceId = await page.locator('main .grid button.card').first().getAttribute('data-card-id');
  await page.evaluate(async ({ cardId, sourceId }) => {
    const db = await import(new URL('db.js', location.href).href);
    const source = (await db.getAllCards()).find((card) => card.id === sourceId);
    if (!source) throw new Error('Aucune carte source pour le scénario hors ligne neutre.');
    await db.putCard({
      ...source,
      id: cardId,
      fr: 'Carte neutre hors ligne',
      dr: 'Carte neutre hors ligne',
      ar: 'بطاقة اختبار',
      sayFr: 'Carte neutre hors ligne',
      sayAr: 'بطاقة اختبار',
      photo: null,
      video: null,
      audios: {},
      audioFr: null,
      audioDr: null,
      order: -1,
      gridRow: 0,
      gridCol: 0,
      hidden: false,
    });
  }, { cardId: id, sourceId });
  await waitCachedApp(page);

  try {
    await context.setOffline(true);
    const start = Date.now();
    await page.reload();
    await expect(page.locator(HOME_TILE_TALK)).toBeVisible({ timeout: 20_000 });
    await page.locator(HOME_TILE_TALK).click();
    await expect(page.locator('main .grid button.card').filter({ visible: true }).first()).toBeVisible({ timeout: 20_000 });
    expect(await gridCardIds(page)).toContain(id);
    const elapsed = Date.now() - start;
    console.log(`essai hors ligne : application et carte rouvertes en ${elapsed} ms`);
    expect(elapsed).toBeLessThan(20_000);
  } finally {
    await context.setOffline(false);
  }
});
