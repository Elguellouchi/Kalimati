import { test, expect } from '@playwright/test';
import { disableOfflineCache, HOME_TILE_TALK, SANS_CACHES, gridCardIds, stripCards, waitCachedApp } from './support.mjs';

const LEXIQUE_MODULES = [
  'modules/lexique-core.js',
  'modules/lexique-rules.js',
  'modules/lexique-init.js',
  'modules/lexique-view.js',
  'modules/lexique-data.js',
];

// D-2 : Playwright WebKit ne persiste pas les Blob ; Chromium vérifie les médias, WebKit les autres protections.
const CATEGORY = {
  id: 'test-zone', fr: 'Zone test', dr: 'Zone test', ar: 'منطقة اختبار', emoji: '🧪', color: '#336699',
};

function sourceWord(wordId, index, overrides = {}) {
  const positions = {};
  for (const cols of [2, 3, 4, 5]) {
    const slot = index - 1;
    positions[String(cols)] = { row: Math.floor(slot / cols) + 1, col: slot % cols + 1 };
  }
  return {
    wordId, niveau: 'noyau', palier: ((index - 1) % 4) + 1, categorie: CATEGORY.id,
    role: 'noun', emoji: '🙂', fr: `Marqueur ${index}`, drLat: `Marqueur ${index}`,
    drAr: `فيxtures ${index}`, arStandard: '', positions,
    relecteurFr: '', relecteurDr: '', dateRevision: '', secondVoice: '', fonction: '', legacyId: '',
    status: 'brouillon', ...overrides,
  };
}

function fixture(words = null, category = CATEGORY) {
  return {
    schema: 1,
    revision: words?.[0]?.revision || 'revision-test',
    categories: category ? [category] : [],
    words: words || [
      sourceWord('w-test-brouillon', 1),
      sourceWord('w-test-langue', 2, { relecteurDr: 'DD', status: 'relu-langue' }),
      sourceWord('w-test-clinique', 3, {
        relecteurFr: 'RF', relecteurDr: 'DD', dateRevision: '2026-11-20', secondVoice: 'ZZ', status: 'relu-clinique',
      }),
      sourceWord('w-test-personnalise', 4),
      sourceWord('w-test-collision', 5, {
        positions: { 2: { row: 1, col: 1 }, 3: { row: 1, col: 1 }, 4: { row: 1, col: 1 }, 5: { row: 1, col: 1 } },
      }),
    ],
  };
}

async function routeLexique(page, getFixture) {
  await page.route('**/modules/lexique-data.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: `export const LEXIQUE = ${JSON.stringify(getFixture())};\n`,
    });
  });
}

async function unlockParent(page) {
  await page.locator('#lock').focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(3100);
  await page.keyboard.up('Space');
  await expect(page.locator('body')).toHaveClass(/\bparent\b/);
}

async function openParentLexique(page) {
  await unlockParent(page);
  await page.locator('.space-btn').filter({ hasText: 'Progrès' }).click();
  await expect(page.locator('#lexique')).toBeVisible();
}

async function openTalkCategory(page, category = CATEGORY.id) {
  const talkTile = page.locator(HOME_TILE_TALK);
  if (!(await talkTile.isVisible())) await page.locator('.space-btn').filter({ hasText: 'Accueil' }).click();
  await talkTile.click();
  await page.locator(`.talk-cat[data-cat="${category}"]`).click();
}

async function seedBeforeApp(page, seed, argument) {
  let seeded = false;
  let seedResult = null;
  await page.route('**/app.js', async (route) => {
    if (!seeded) {
      seedResult = await page.evaluate(seed, argument);
      seeded = true;
    }
    await route.continue();
  });
  return () => seedResult;
}

async function protectedSnapshot(page) {
  return page.evaluate(async () => {
    const db = await import('/db.js');
    const descriptor = async (blob) => {
      if (!blob) return null;
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return {
        type: blob.type,
        size: blob.size,
        sha256: Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(''),
      };
    };
    const cards = await db.getAllCards();
    cards.sort((a, b) => a.id.localeCompare(b.id));
    return Promise.all(cards.map(async (card) => ({
      id: card.id,
      wordId: card.wordId,
      photo: await descriptor(card.photo),
      video: await descriptor(card.video),
      audios: Object.fromEntries(await Promise.all(Object.entries(card.audios || {}).map(async ([lang, blob]) => [lang, await descriptor(blob)]))),
      hidden: card.hidden,
      positions: card.positions,
      gridRow: card.gridRow,
      gridCol: card.gridCol,
      order: card.order,
      visualKey: card.visualKey,
      cat: card.cat,
      gram: card.gram,
      emoji: card.emoji,
      sub: card.sub,
      sayFr: card.sayFr,
      sayAr: card.sayAr,
    })));
  });
}

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === SANS_CACHES) await page.addInitScript(disableOfflineCache);
});

test('1 — famille neuve : filtre actif, comptes exacts et badges parent seulement', async ({ page }) => {
  await routeLexique(page, () => fixture());
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  expect(await page.evaluate(async () => (await (await import('/db.js')).getSetting('onlyReviewed')))).toBe(true);

  await openParentLexique(page);
  await expect(page.locator('[data-stat="total"]')).toHaveText('5');
  await expect(page.locator('[data-stat="status-brouillon"]')).toHaveText('3');
  await expect(page.locator('[data-stat="status-relu-langue"]')).toHaveText('1');
  await expect(page.locator('[data-stat="status-relu-clinique"]')).toHaveText('1');
  for (const [palier, count] of [['1', '2'], ['2', '1'], ['3', '1'], ['4', '1']]) {
    await expect(page.locator(`[data-stat="palier-${palier}"]`)).toHaveText(count);
  }
  await expect(page.locator(`[data-stat="category-${CATEGORY.id}"]`)).toHaveText('5');
  await expect(page.locator('#only-reviewed')).toBeChecked();
  await page.locator('#lexique-apply').click();
  await expect(page.locator('[data-stat="applied"]')).toHaveText('5');
  await expect(page.locator('[data-stat="additions"]')).toHaveText('5');

  await openTalkCategory(page);
  await expect(page.locator('main .grid button.card[data-card-id]')).toHaveCount(5);
  await expect(page.locator('main .grid .lexicon-badge')).toHaveCount(5);
  await expect(page.locator('main .grid .lexicon-badge[data-status="brouillon"]')).toHaveCount(3);
  await expect(page.locator('main .grid .lexicon-badge[data-status="relu-langue"]')).toHaveCount(1);
  await expect(page.locator('main .grid .lexicon-badge[data-status="relu-clinique"]')).toHaveCount(1);
  await expect(page.locator('main .grid .lexicon-badge[data-status="brouillon"]').first()).toHaveAttribute('aria-label', 'Brouillon');

  await page.waitForTimeout(1600);
  await page.locator('#lock').click();
  await expect(page.locator('body')).not.toHaveClass(/\bparent\b/);
  await expect(page.locator('main .grid button.card[data-card-id]')).toHaveCount(5);
  await expect(page.locator('main .grid .lexicon-badge')).toHaveCount(0);
  await expect(page.locator('main .grid button.card[data-card-id]').filter({ visible: true })).toHaveCount(2);
  await expect(page.locator('main .grid button.card[data-card-id="w-test-brouillon"]')).toBeHidden();
  await expect(page.locator('main .grid button.card[data-card-id="w-test-langue"]')).toBeVisible();
  await expect(page.locator('main .grid button.card[data-card-id="w-test-clinique"]')).toBeVisible();
  await expect(page.locator('main .grid button.card[data-card-id="w-test-personnalise"]')).toBeHidden();
});

test('2 — installation v10.45 : 93 cartes neutres et une carte familiale strictement préservées', async ({ page }, testInfo) => {
  const migration = fixture([
    sourceWord('w-test-migration', 1, { categorie: 'test-migration' }),
  ], { ...CATEGORY, id: 'test-migration', fr: 'Migration test' });
  await routeLexique(page, () => migration);
  const installed = await seedBeforeApp(page, async ({ withMedia }) => {
    const db = await import('/db.js');
    const { CATEGORIES } = await import('/data.js');
    const { layoutFingerprint } = await import('/modules/grid-layout.js');
    const categoryIds = CATEGORIES.map((category) => category.id);
    const cards = Array.from({ length: 93 }, (_, index) => {
      const cat = categoryIds[index % categoryIds.length];
      const sequence = Math.floor(index / categoryIds.length);
      const positions = {};
      for (const cols of [2, 3, 4, 5]) positions[String(cols)] = { row: Math.floor(sequence / cols) + 1, col: sequence % cols + 1 };
      const place = positions['4'];
      return {
        id: `test-installed-${index}`, wordId: `test-installed-${index}`, cat,
        fr: `Carte neutre ${index}`, dr: `Carte neutre ${index}`, ar: '', emoji: '🙂', gram: 'noun',
        sub: '', sayFr: '', sayAr: '', hidden: index % 13 === 0, order: index,
        positions, gridRow: place.row, gridCol: place.col, visualKey: null,
        photo: withMedia ? new Blob([`photo-${index}`], { type: 'image/png' }) : null,
        audios: withMedia ? { fr: new Blob([`voix-${index}`], { type: 'audio/webm' }) } : {},
      };
    });
    const positions = { 2: { row: 20, col: 1 }, 3: { row: 20, col: 1 }, 4: { row: 20, col: 1 }, 5: { row: 20, col: 1 } };
    cards.push({
      id: 'u-test-family', wordId: 'u-test-family', cat: categoryIds[0], fr: 'Carte familiale test',
      dr: '', ar: '', emoji: '🙂', gram: 'noun', sub: '', sayFr: '', sayAr: '', hidden: false, order: 93,
      positions, gridRow: 20, gridCol: 1, visualKey: 'person:child',
      photo: withMedia ? new Blob(['photo-famille'], { type: 'image/png' }) : null,
      audios: withMedia ? { fr: new Blob(['voix-famille'], { type: 'audio/webm' }) } : {},
    });
    await db.putCards(cards);
    await db.setSetting('cols', 4);
    await db.setSetting('lang', 'fr');
    await db.setSetting('seeded', true);
    await db.setSetting('v2migrated', true);
    await db.setSetting('v3migrated', true);
    await db.setSetting('v7migrated', true);
    await db.setSetting('v92migrated', true);
    await db.setSetting('v10.20migrated', true);
    await db.setSetting('layoutFingerprint', await layoutFingerprint(cards));
    return cards.length;
  }, { withMedia: testInfo.project.name !== 'iphone-13-webkit' });
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  expect(await installed()).toBe(94);
  expect(await page.evaluate(async () => (await (await import('/db.js')).getSetting('onlyReviewed')))).toBe(false);
  const before = await protectedSnapshot(page);
  expect(before).toHaveLength(94);

  await openParentLexique(page);
  await page.locator('#lexique-apply').click();
  await expect(page.locator('[data-stat="applied"]')).toHaveText('1');
  const after = await protectedSnapshot(page);
  expect(after).toHaveLength(95);
  expect(after.slice(0, 94)).toEqual(before);
  expect(after.find((card) => card.id === 'u-test-family')).toEqual(before.find((card) => card.id === 'u-test-family'));
});

test('3 — filtre enfant : cartes masquées sans mutation du DOM, des places ou de hidden', async ({ page }) => {
  test.setTimeout(90_000);
  await routeLexique(page, () => fixture());
  const seeded = await seedBeforeApp(page, async ({ category }) => {
    const db = await import('/db.js');
    const { defaultCards } = await import('/data.js');
    const base = defaultCards().find((card) => card.id === 'c-base-oui');
    const make = (id, status, customized, hidden, index) => {
      const positions = {};
      for (const cols of [2, 3, 4, 5]) positions[String(cols)] = { row: Math.floor((index - 1) / cols) + 1, col: (index - 1) % cols + 1 };
      const place = positions['4'];
      return {
        id, wordId: id, cat: category.id, fr: `Carte ${index}`, dr: '', ar: '', emoji: '🙂', gram: 'noun',
        sub: '', sayFr: '', sayAr: '', hidden, order: index, positions, gridRow: place.row, gridCol: place.col,
        lexicon: {
          owned: true, customized, wordId: id, revision: 'revision-test', status, sourceCategory: category.id,
          relecteurFr: status === 'relu-clinique' ? 'RF' : '', relecteurDr: status === 'brouillon' ? '' : 'DD',
          dateRevision: status === 'relu-clinique' ? '2026-11-20' : '', secondVoice: status === 'relu-clinique' ? 'ZZ' : '',
        },
      };
    };
    const cards = [
      make('w-test-brouillon', 'brouillon', false, false, 1),
      make('w-test-langue', 'relu-langue', false, false, 2),
      make('w-test-clinique', 'relu-clinique', false, false, 3),
      make('w-test-personnalise', 'brouillon', true, false, 4),
      make('u-test-family', 'brouillon', false, false, 5),
      make('w-test-hidden', 'relu-clinique', false, true, 6),
      { ...base, order: 7, positions: { 2: { row: 1, col: 1 }, 3: { row: 1, col: 1 }, 4: { row: 1, col: 1 }, 5: { row: 1, col: 1 } }, gridRow: 1, gridCol: 1 },
    ];
    cards[0].fr = 'Pain';
    await db.putCards(cards);
    await db.setSetting('cols', 4);
    await db.setSetting('onlyReviewed', true);
    await db.setSetting('lang', 'fr');
    await db.setSetting('aacHistory', {
      uni: { 'w-test-brouillon': 4 },
      bi: { 'w-test-langue': { 'w-test-brouillon': 4 } },
    });
    await db.setSetting('placeBoards', [{
      id: 'express-test', title: 'Lieu test', emoji: '📍', text: 'Pain',
    }]);
    return cards.length;
  }, { category: CATEGORY });
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  expect(await seeded()).toBe(7);
  await openTalkCategory(page);
  const cards = page.locator('main .grid button.card[data-card-id]');
  await expect(cards).toHaveCount(6);
  expect(await gridCardIds(page)).toEqual(expect.arrayContaining([
    'w-test-brouillon', 'w-test-langue', 'w-test-clinique', 'w-test-personnalise', 'u-test-family', 'w-test-hidden',
  ]));
  await expect(cards.filter({ visible: true })).toHaveCount(4);
  for (const id of ['w-test-langue', 'w-test-clinique', 'w-test-personnalise', 'u-test-family']) {
    await expect(page.locator(`main .grid button.card[data-card-id="${id}"]`)).toBeVisible();
  }
  for (const id of ['w-test-brouillon', 'w-test-hidden']) {
    const card = page.locator(`main .grid button.card[data-card-id="${id}"]`);
    await expect(card).toBeHidden();
    await expect(card).toHaveAttribute('aria-hidden', 'true');
    await expect(card).toHaveAttribute('tabindex', '-1');
  }
  const places = await cards.evaluateAll((elements) => elements.map((element) => ({
    id: element.dataset.cardId, row: element.style.gridRow, col: element.style.gridColumn,
  })));
  const storedBefore = await page.evaluate(async () => (await (await import('/db.js')).getAllCards()).map(({ id, hidden, positions, gridRow, gridCol }) => ({ id, hidden, positions, gridRow, gridCol })));
  await page.locator('.talk-cat[data-cat="base"]').click();
  await expect(page.locator('main .grid button.card[data-card-id="c-base-oui"]')).toBeVisible();
  await page.locator(`.talk-cat[data-cat="${CATEGORY.id}"]`).click();
  await expect(cards).toHaveCount(6);
  expect(await cards.evaluateAll((elements) => elements.map((element) => ({
    id: element.dataset.cardId, row: element.style.gridRow, col: element.style.gridColumn,
  })))).toEqual(places);
  const storedAfter = await page.evaluate(async () => (await (await import('/db.js')).getAllCards()).map(({ id, hidden, positions, gridRow, gridCol }) => ({ id, hidden, positions, gridRow, gridCol })));
  expect(storedAfter).toEqual(storedBefore);

  await openParentLexique(page);
  await page.locator('#only-reviewed').uncheck();
  await expect(page.locator('#only-reviewed')).not.toBeChecked();
  await page.waitForTimeout(1600);
  await openTalkCategory(page);
  await page.locator('#lock').click();
  await expect(page.locator('body')).not.toHaveClass(/\bparent\b/);
  await page.locator(`main .grid button.card[data-card-id="w-test-langue"]`).click();
  await page.locator(`main .grid button.card[data-card-id="w-test-brouillon"]`).click();
  await expect(stripCards(page)).toHaveCount(2);
  await page.locator('.talk-adult > summary').click();
  await page.locator('.model-toggle').click();
  await page.locator(`main .grid button.card[data-card-id="w-test-langue"]`).click();
  await page.locator(`main .grid button.card[data-card-id="w-test-brouillon"]`).click();
  await expect(page.locator('#model-line button.card[data-card-id]')).toHaveCount(2);

  await openParentLexique(page);
  await page.locator('#only-reviewed').check();
  await expect(page.locator('#only-reviewed')).toBeChecked();
  await expect(page.locator('#only-reviewed')).toBeEnabled();
  await openTalkCategory(page);
  await page.evaluate(() => { window.print = () => {}; });
  await page.locator('.keyring-box summary').click();
  await page.locator('.keyring-box select').selectOption(`cat:${CATEGORY.id}`);
  await page.locator('.keyring-box').getByRole('button', { name: 'Imprimer' }).click();
  await expect(page.locator('.keyring-grid')).not.toContainText('Pain');

  await page.waitForTimeout(1600);
  await page.locator('#lock').click();
  await expect(page.locator('body')).not.toHaveClass(/\bparent\b/);
  await expect(stripCards(page)).toHaveCount(1);
  await expect(page.locator('#strip-cards button.card[data-card-id="w-test-langue"]')).toHaveCount(1);
  await expect(page.locator('#model-line button.card[data-card-id]')).toHaveCount(1);
  await expect(page.locator('#model-line [data-card-id="w-test-langue"]')).toHaveCount(1);
  await expect(page.locator('#suggest-row [data-card-id="w-test-brouillon"]')).toHaveCount(0);
  await page.locator(`main .grid button.card[data-card-id="w-test-brouillon"]`).evaluate((element) => element.click());
  await expect(stripCards(page)).toHaveCount(1);

  await page.locator('.place-tab').click();
  await page.getByRole('button', { name: 'Lieu test', exact: true }).click();
  await expect(page.locator('.place-grid [data-card-id="w-test-brouillon"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Revenir à mes mots', exact: true }).click();
  await page.locator('.place-tab').click();
  await page.getByRole('button', { name: 'La cuisine', exact: true }).click();
  await expect(page.locator('.scene-target[aria-label="Pain"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Revenir à mes mots', exact: true }).click();
  await page.locator('.picto-box summary').click();
  await page.getByRole('textbox', { name: 'Phrase à montrer en images' }).fill('Pain');
  await expect(page.locator('.picto-line')).toContainText('Pain');
  await expect(page.locator('.picto-line .picto-card[data-card-id="w-test-brouillon"]')).toHaveCount(0);
});

test('4 — collision : première place libre, existantes immobiles et seconde application sans écriture', async ({ page }) => {
  await routeLexique(page, () => fixture([
    sourceWord('w-test-langue', 2, { relecteurDr: 'DD', status: 'relu-langue' }),
    sourceWord('w-test-collision', 5, {
      positions: { 2: { row: 1, col: 1 }, 3: { row: 1, col: 1 }, 4: { row: 1, col: 1 }, 5: { row: 1, col: 1 } },
    }),
  ]));
  const seeded = await seedBeforeApp(page, async ({ category }) => {
    const db = await import('/db.js');
    const positions = { 2: { row: 1, col: 1 }, 3: { row: 1, col: 1 }, 4: { row: 1, col: 1 }, 5: { row: 1, col: 1 } };
    const card = {
      id: 'test-existing', wordId: 'test-existing', cat: category.id, fr: 'Carte existante test', dr: '', ar: '',
      emoji: '🙂', gram: 'noun', sub: '', sayFr: '', sayAr: '', hidden: false, order: 1,
      positions, gridRow: 1, gridCol: 1, visualKey: null,
    };
    await db.putCards([card]);
    await db.setSetting('cols', 4);
    await db.setSetting('onlyReviewed', false);
    return card;
  }, { category: CATEGORY });
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  const existing = await seeded();
  await openParentLexique(page);
  await page.evaluate(() => {
    window.__lexiqueCardWrites = 0;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'cards') window.__lexiqueCardWrites += 1;
      return original.apply(this, args);
    };
  });
  await page.locator('#lexique-apply').click();
  await expect(page.locator('#lexique-report')).toContainText('Ajouts : 2');
  await expect(page.locator('#lexique-report')).toContainText('Déplacements : 1');
  const result = await page.evaluate(async () => {
    const cards = await (await import('/db.js')).getAllCards();
    return {
      writes: window.__lexiqueCardWrites,
      existing: cards.find((card) => card.id === 'test-existing'),
      collision: cards.find((card) => card.id === 'w-test-collision'),
    };
  });
  expect(result.writes).toBe(2);
  expect(result.existing.positions).toEqual(existing.positions);
  expect(result.existing.gridRow).toBe(1);
  expect(result.existing.gridCol).toBe(1);
  expect(result.collision.positions['4']).toEqual({ row: 1, col: 3 });
  expect(result.collision.gridRow).toBe(1);
  expect(result.collision.gridCol).toBe(3);

  await page.evaluate(() => { window.__lexiqueCardWrites = 0; });
  await page.locator('#lexique-apply').click();
  await expect(page.locator('#lexique-report')).toContainText('Aucune modification');
  expect(await page.evaluate(() => window.__lexiqueCardWrites)).toBe(0);
});

test('5 — personnalisation parent : texte local conservé après une révision plus récente', async ({ page }, testInfo) => {
  let current = fixture([sourceWord('w-test-personnalise', 1)]);
  await routeLexique(page, () => current);
  const seeded = await seedBeforeApp(page, async ({ category, withMedia }) => {
    const db = await import('/db.js');
    const positions = { 2: { row: 2, col: 2 }, 3: { row: 2, col: 2 }, 4: { row: 2, col: 2 }, 5: { row: 2, col: 2 } };
    const card = {
      id: 'w-test-personnalise', wordId: 'w-test-personnalise', cat: category.id,
      fr: 'Marqueur 1', dr: 'Marqueur 1', ar: 'فيxtures 1', emoji: '🙂', gram: 'noun', sub: '', sayFr: '', sayAr: '',
      hidden: true, order: 4, positions, gridRow: 2, gridCol: 2, visualKey: null,
      photo: withMedia ? new Blob(['photo-parent'], { type: 'image/png' }) : null,
      audios: withMedia ? { fr: new Blob(['voix-parent'], { type: 'audio/webm' }) } : {},
      lexicon: {
        owned: true, customized: false, legacy: false, wordId: 'w-test-personnalise', revision: 'revision-test',
        niveau: 'noyau', palier: 1, fonction: '', sourceCategory: category.id, role: 'noun', arStandard: '', legacyFr: '',
        relecteurFr: '', relecteurDr: '', dateRevision: '', secondVoice: '', status: 'brouillon',
      },
    };
    await db.putCards([card]);
    await db.setSetting('cols', 4);
    await db.setSetting('onlyReviewed', false);
    return card.id;
  }, { category: CATEGORY, withMedia: testInfo.project.name !== 'iphone-13-webkit' });
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  expect(await seeded()).toBe('w-test-personnalise');
  const before = (await protectedSnapshot(page)).find((card) => card.id === 'w-test-personnalise');
  await unlockParent(page);
  await openTalkCategory(page);
  await page.locator('main .grid button.card[data-card-id="w-test-personnalise"]').click();
  await expect(page.locator('#editor')).toBeVisible();
  await page.locator('#ed-fr').fill('Texte parent test');
  await page.locator('#ed-save').click();
  await expect(page.locator('#editor')).not.toBeVisible();
  expect(await page.evaluate(async () => (await (await import('/db.js')).getCard('w-test-personnalise')).lexicon.customized)).toBe(true);

  current = fixture([sourceWord('w-test-personnalise', 1, {
    revision: 'revision-plus-recente', fr: 'Texte source révisé', drLat: 'Source révisée', drAr: 'مصدر مراجَع',
    relecteurFr: 'RF', relecteurDr: 'DD', dateRevision: '2026-11-21', secondVoice: 'ZZ', status: 'relu-clinique',
  })]);
  current.revision = 'revision-plus-recente';
  await page.evaluate(async () => {
    for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
    if (window.caches) for (const key of await caches.keys()) await caches.delete(key);
  });
  await page.reload();
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  await openParentLexique(page);
  await page.locator('#lexique-apply').click();
  await expect(page.locator('#lexique-report')).toContainText('Textes personnalisés conservés : 1');
  const after = (await protectedSnapshot(page)).find((card) => card.id === 'w-test-personnalise');
  expect(after).toEqual(before);
  const card = await page.evaluate(async () => (await (await import('/db.js')).getCard('w-test-personnalise')));
  expect(card.fr).toBe('Texte parent test');
  expect(card.lexicon.revision).toBe('revision-plus-recente');
  expect(card.lexicon.status).toBe('relu-clinique');
  expect(card.lexicon.customized).toBe(true);
});

test('9 — hors ligne : cinq modules précachés, Lexique chargé, aucun rechargement automatique', async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-5-chromium',
    'service workers : Chromium seulement (décision D-2)');
  test.setTimeout(90_000);
  await routeLexique(page, () => fixture());
  const navigations = [];
  const failedModules = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  page.on('requestfailed', (request) => {
    if (/\/modules\/[^/?]+\.js(?:\?|$)/.test(request.url())) failedModules.push(request.url());
  });

  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  await waitCachedApp(page);
  await expect.poll(() => page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration('/'))?.active?.scriptURL || '')).toMatch(/\/sw\.js$/);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '')).toMatch(/\/sw\.js$/);
  expect(navigations).toHaveLength(1);

  const cachedModules = await page.evaluate(async (modules) => {
    const name = (await caches.keys()).find((key) => /^kalimati-v\d/.test(key));
    if (!name) return modules.map(() => false);
    const cache = await caches.open(name);
    return Promise.all(modules.map(async (module) => Boolean(await cache.match(new URL(`./${module}`, location.href).href))));
  }, LEXIQUE_MODULES);
  expect(cachedModules, 'les cinq modules du Lexique doivent être précachés').toEqual(Array(5).fill(true));

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  expect(navigations).toHaveLength(2);
  await openParentLexique(page);
  await expect(page.locator('#lexique')).toBeVisible();
  // Le service worker précache le fichier de production, pas la fixture interceptée par la page.
  await expect(page.locator('[data-stat="total"]')).toHaveText('0');
  await page.waitForTimeout(1200);
  expect(failedModules).toEqual([]);
  expect(navigations).toHaveLength(2);
  await context.setOffline(false);
});
