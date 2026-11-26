import { test, expect } from '@playwright/test';
import {
  HOME_TILE_TALK, disableOfflineCache, openTalkGrid, tapThreeCards, stripCards,
} from './support.mjs';

async function unlockParent(page) {
  await page.locator('#lock').focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(3100);
  await page.keyboard.up('Space');
  await expect(page.locator('body')).toHaveClass(/\bparent\b/);
}

test('L1-10 — IndexedDB bloqué : les cartes de secours restent utilisables', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: { open() { return {}; } },
    });
  });
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible({ timeout: 12000 });
  await page.locator(HOME_TILE_TALK).click();
  await expect(page.locator('main .grid button.card').first()).toBeVisible();
  await tapThreeCards(page);
  await expect(stripCards(page)).toHaveCount(3);
  await expect(page.locator('.fatal')).toHaveCount(0);
});

test('L1-10 — sans window.caches : ouverture et trois cartes restent possibles', async ({ page }) => {
  await page.addInitScript(disableOfflineCache);
  await openTalkGrid(page);
  await tapThreeCards(page);
  await expect(stripCards(page)).toHaveCount(3);
  await expect(page.locator('.fatal')).toHaveCount(0);
});

test('L1-10 — synthèse vocale absente : les cartes restent utilisables en silence', async ({ page }) => {
  await page.addInitScript(() => {
    for (const key of ['speechSynthesis', 'SpeechSynthesisUtterance']) {
      let target = window;
      while (target) {
        const descriptor = Object.getOwnPropertyDescriptor(target, key);
        if (descriptor?.configurable) {
          delete target[key];
          break;
        }
        target = Object.getPrototypeOf(target);
      }
    }
  });
  await openTalkGrid(page);
  expect(await page.evaluate(() => 'speechSynthesis' in window)).toBe(false);
  await tapThreeCards(page);
  await expect(stripCards(page)).toHaveCount(3);
  await expect(page.locator('.fatal')).toHaveCount(0);
});

// D-2 : WebKit échoue avant l’injection des médias ; ce scénario reste donc en Chromium seulement.
// L’alerte devra être vérifiée séparément sur un vrai iPhone.
test('L1-10 — stockage simulé à plus de 85 % : alerte parent et trois plus gros médias', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'iphone-13-webkit',
    'scénario de stockage : Chromium seulement (décision D-2), vrai iPhone à vérifier');
  await page.addInitScript(() => {
    const estimate = async () => ({ usage: 86, quota: 100 });
    if (navigator.storage) Object.defineProperty(navigator.storage, 'estimate', { configurable: true, value: estimate });
    else Object.defineProperty(navigator, 'storage', { configurable: true, value: { estimate } });
  });
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  await expect(page.locator('#storage-warning')).toHaveCount(0);
  await page.evaluate(async () => {
    const db = await import('/db.js');
    const blob = (size) => new Blob([new Uint8Array(size)]);
    await db.putRecording({ id: 'e2e-media-video', key: 'model:e2e', ts: 1, kind: 'model', blob: blob(3 * 1024 * 1024) });
    await db.putRecording({ id: 'e2e-media-voice', key: 'voice:e2e', ts: 2, kind: 'voice', blob: blob(2 * 1024 * 1024) });
    await db.putVisualOverride('e2e-media-photo', blob(1024 * 1024));
    await db.putRecording({ id: 'e2e-media-small', key: 'voice:e2e-small', ts: 3, kind: 'voice', blob: blob(512 * 1024) });
  });
  await unlockParent(page);
  await page.locator('#spaces .space-btn').filter({ hasText: 'Progrès' }).click();
  const warning = page.locator('#storage-warning');
  await expect(warning).toBeVisible();
  await expect(warning.getByRole('heading', { name: 'Espace presque plein' })).toBeVisible();
  const items = warning.locator('#storage-largest-media li');
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toHaveText('Vidéo — 3 Mo');
  await expect(items.nth(1)).toHaveText('Voix — 2 Mo');
  await expect(items.nth(2)).toHaveText('Photo — 1 Mo');
});
