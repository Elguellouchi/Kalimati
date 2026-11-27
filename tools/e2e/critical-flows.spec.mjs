// Lot 0, exigence L0-03 : les chemins critiques de l'enfant, ouverts dans un vrai navigateur.
// (a) ouverture à froid, (b) trois cartes touchées, (c) rechargement, (d) les mêmes sans window.caches.
// (e) géométrie de la grille sur iPhone WebKit ; (f) « réseau coupé » dans offline.spec.mjs (Chromium seulement).
import { test, expect } from '@playwright/test';
import {
  SANS_CACHES, disableOfflineCache, HOME_TILE_TALK,
  openTalkGrid, visibleCards, stripCards, gridCardIds, tapThreeCards,
} from './support.mjs';

// Le profil « chromium-sans-caches » joue les mêmes scénarios que les autres, sans cache ni service worker.
test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === SANS_CACHES) await page.addInitScript(disableOfflineCache);
});

async function unlockParent(page) {
  await page.locator('#lock').focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(3100);
  await page.keyboard.up('Space');
  await expect(page.locator('body')).toHaveClass(/\bparent\b/);
}

test('a — ouverture à froid : la grille « Parler » s’affiche en moins de 3 s', async ({ page }) => {
  const ms = await openTalkGrid(page);
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

test('e — grille Parler/Manger : colonnes exactes et cartes sans chevauchement', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-13-webkit', 'géométrie iPhone : WebKit seulement');

  await openTalkGrid(page);
  await page.locator('.talk-cat[data-cat="manger"]').click();
  await expect(page.locator('.talk-cat[data-cat="manger"]')).toHaveClass(/\bactive\b/);
  await unlockParent(page);
  await expect(page.locator('.talk-cat[data-cat="manger"]')).toHaveClass(/\bactive\b/);

  const toggle = page.locator('#pb-toggle');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(page.locator('#cols')).toBeVisible();

  for (const cols of [2, 3, 4, 5]) {
    await page.locator('#cols').selectOption(String(cols));
    await expect(page.locator('#cols')).toHaveValue(String(cols));
    await expect.poll(async () => page.locator('main .grid').evaluate((grid) => (
      getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length
    ))).toBe(cols);

    const cards = page.locator('main .grid button.card[data-card-id]');
    expect(await cards.count()).toBeGreaterThan(cols);
    const overlaps = await cards.evaluateAll((elements) => {
      const boxes = elements.map((card) => {
        const rect = card.getBoundingClientRect();
        return {
          id: card.dataset.cardId,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      });
      const hits = [];
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i];
          const b = boxes[j];
          const horizontal = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const vertical = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (horizontal > 0.5 && vertical > 0.5) {
            hits.push({ a: a.id, b: b.id, horizontal, vertical });
          }
        }
      }
      return hits;
    });
    expect(overlaps, `taille ${cols} : aucune carte ne doit chevaucher une autre`).toEqual([]);
  }
});

test('f — remise en ordre automatique : retour visible même si les cartes sont déjà ordonnées', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  await page.evaluate(async () => {
    const db = await import('/db.js');
    const layout = await import('/modules/grid-layout.js');
    const cols = Number(await db.getSetting('cols')) || 4;
    await db.putCards(layout.relayout(await db.getAllCards(), cols));
  });
  await openTalkGrid(page);
  await unlockParent(page);

  const toggle = page.locator('#pb-toggle');
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  const button = page.locator('#relayout');
  await expect(button).toBeVisible();
  await expect(button).toHaveText('Remettre en ordre automatique');

  const positionsBefore = await page.evaluate(async () => {
    const db = await import('/db.js');
    const cols = String(await db.getSetting('cols') || 4);
    return (await db.getAllCards())
      .map((card) => ({ id: card.id, position: card.positions?.[cols] || null }))
      .sort((a, b) => a.id.localeCompare(b.id));
  });

  await button.click();
  await expect(button).toHaveText('Toucher encore pour confirmer');
  await button.click();
  await expect(button).toHaveText('Cartes remises en ordre ✔');

  const positionsAfter = await page.evaluate(async () => {
    const db = await import('/db.js');
    const cols = String(await db.getSetting('cols') || 4);
    return (await db.getAllCards())
      .map((card) => ({ id: card.id, position: card.positions?.[cols] || null }))
      .sort((a, b) => a.id.localeCompare(b.id));
  });
  expect(positionsAfter).toEqual(positionsBefore);

  await page.waitForTimeout(2500);
  await expect(button).toHaveText('Cartes remises en ordre ✔');
  await expect(button).toHaveText('Remettre en ordre automatique', { timeout: 1000 });
});
