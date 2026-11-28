import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { disableOfflineCache, HOME_TILE_TALK, SANS_CACHES, gridCardIds, stripCards, waitCachedApp } from './support.mjs';

const LEXIQUE_MODULES = [
  'modules/lexique-core.js',
  'modules/lexique-rules.js',
  'modules/lexique-init.js',
  'modules/lexique-view.js',
  'modules/lexique-data.js',
  'modules/emoji-skin-tone.js',
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

const BACKUP_PROTECTED_FIELDS = [
  'id', 'wordId', 'positions', 'gridRow', 'gridCol', 'order', 'visualKey', 'emoji', 'gram', 'cat', 'sub',
  'sayFr', 'sayAr', 'hidden', 'photo', 'video', 'audios', 'audioFr', 'audioDr',
];

async function backupCardSnapshot(page) {
  return page.evaluate(async (fields) => {
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
      fields: Object.fromEntries(await Promise.all(fields.map(async (field) => {
        const value = card[field];
        const clean = field === 'audios' && value && typeof value === 'object'
          ? Object.fromEntries(await Promise.all(Object.entries(value).map(async ([code, blob]) => [code, await descriptor(blob)])))
          : value instanceof Blob ? await descriptor(value) : value ?? null;
        return [field, { present: Object.hasOwn(card, field), value: clean }];
      }))),
      text: { fr: card.fr, dr: card.dr, ar: card.ar },
      lexicon: card.lexicon ?? null,
      updatedAt: card.updatedAt,
    })));
  }, BACKUP_PROTECTED_FIELDS);
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

test('6 — teintes : six choix, personnes et ZWJ rendus sans mutation ni asset non teinté', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const withMedia = testInfo.project.name !== 'iphone-13-webkit';
  await routeLexique(page, () => fixture([], CATEGORY));
  const seeded = await seedBeforeApp(page, async ({ category, withMedia }) => {
    const db = await import('/db.js');
    const { layoutFingerprint } = await import('/modules/grid-layout.js');
    const positionsFor = (index) => {
      const positions = {};
      for (const cols of [2, 3, 4, 5]) positions[String(cols)] = { row: Math.floor((index - 1) / cols) + 1, col: (index - 1) % cols + 1 };
      return positions;
    };
    const make = (id, index, overrides = {}) => {
      const positions = positionsFor(index);
      return {
        id, wordId: id, cat: category.id, fr: `Carte ${index}`, dr: '', ar: '', emoji: '🙂', gram: 'noun',
        sub: '', sayFr: '', sayAr: '', hidden: false, order: index, positions,
        gridRow: positions['4'].row, gridCol: positions['4'].col, visualKey: null,
        photo: null, audios: {}, ...overrides,
      };
    };
    const cards = [
      make('u-test-person', 1, { fr: 'Dormir', emoji: '👩🏽‍⚕️', gram: 'person' }),
      make('u-test-zwj', 2, { fr: 'Groupe test', emoji: '👩🏽‍🤝‍👨🏻', gram: 'person' }),
      make('u-test-non-compatible', 3, { fr: 'Sourire test', emoji: '🙂', gram: 'person' }),
      make('u-test-hors-personne', 4, { fr: 'Rôle test', emoji: '👩🏽‍⚕️', gram: 'noun', lexicon: { role: 'noun' } }),
      make('u-test-role-personne', 5, { fr: 'Rôle personne test', emoji: '👩🏻‍⚕️', gram: 'noun', lexicon: { role: 'person' } }),
      make('u-test-photo', 6, {
        fr: 'Personne photo test', emoji: '👩🏽‍⚕️', gram: 'person', visualKey: 'obj:personne-photo-test',
        photo: withMedia ? new Blob(['photo-personne'], { type: 'image/png' }) : null,
      }),
      make('u-test-illustration', 7, { fr: 'Illustration test', emoji: '👩🏽‍⚕️', gram: 'person', visualKey: 'person:therapist' }),
    ];
    if (withMedia) await db.putVisualOverride('obj:personne-photo-test', new Blob(['photo-partagee'], { type: 'image/png' }));
    await db.putCards(cards);
    await db.setSetting('cols', 4);
    await db.setSetting('lang', 'fr');
    await db.setSetting('onlyReviewed', false);
    await db.setSetting('emojiSkinTone', '3');
    await db.setSetting('visualStyle', 'system');
    await db.setSetting('seeded', true);
    await db.setSetting('v2migrated', true);
    await db.setSetting('v3migrated', true);
    await db.setSetting('v7migrated', true);
    await db.setSetting('v92migrated', true);
    await db.setSetting('v10.20migrated', true);
    await db.setSetting('layoutFingerprint', await layoutFingerprint(cards));
    return cards.length;
  }, { category: CATEGORY, withMedia });
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  expect(await seeded()).toBe(7);
  const before = await protectedSnapshot(page);

  await openParentLexique(page);
  const choices = [
    ['default', 'Jaune par défaut', '👩‍⚕️'],
    ['1', 'Claire', '👩🏻‍⚕️'],
    ['2', 'Moyennement claire', '👩🏼‍⚕️'],
    ['3', 'Moyenne', '👩🏽‍⚕️'],
    ['4', 'Moyennement foncée', '👩🏾‍⚕️'],
    ['5', 'Foncée', '👩🏿‍⚕️'],
  ];
  const toneChoices = page.locator('input[name="emoji-skin-tone"]');
  await expect(toneChoices).toHaveCount(6);
  for (const [value, label] of choices) await expect(page.getByRole('radio', { name: label, exact: true })).toHaveValue(value);
  await expect(page.getByRole('radio', { name: 'Moyenne', exact: true })).toBeChecked();

  const card = (id) => page.locator(`main .grid button.card[data-card-id="${id}"]`);
  const modifiers = { default: '', 1: '🏻', 2: '🏼', 3: '🏽', 4: '🏾', 5: '🏿' };
  const expectRenderedTone = async (tone, system = true) => {
    await expect(card('u-test-person').locator('.visual > .emoji')).toHaveText(choices.find(([value]) => value === tone)[2]);
    await expect(card('u-test-zwj').locator('.visual > .emoji')).toHaveText(`👩${modifiers[tone]}‍🤝‍👨${modifiers[tone]}`);
    await expect(card('u-test-role-personne').locator('.visual > .emoji')).toHaveText(choices.find(([value]) => value === tone)[2]);
    if (system) {
      await expect(card('u-test-non-compatible').locator('.visual > .emoji')).toHaveText('🙂');
      await expect(card('u-test-hors-personne').locator('.visual > .emoji')).toHaveText('👩🏽‍⚕️');
    }
  };

  await openTalkCategory(page);
  await expectRenderedTone('3');
  const illustration = card('u-test-illustration').locator('.visual-art');
  const illustrationBefore = await illustration.innerHTML();
  const photo = card('u-test-photo').locator('img.visual-photo');
  if (withMedia) {
    await expect(photo).toBeVisible();
    await expect(card('u-test-photo').locator('.visual > .emoji')).toHaveCount(0);
  }
  const photoBefore = withMedia ? await photo.getAttribute('src') : null;

  for (const [tone, label] of choices) {
    await page.locator('.space-btn').filter({ hasText: 'Progrès' }).click();
    await expect(page.locator('#lexique')).toBeVisible();
    await page.getByRole('radio', { name: label, exact: true }).check();
    await expect.poll(() => page.evaluate(async () => (await (await import('/db.js')).getSetting('emojiSkinTone')))).toBe(tone);
    await openTalkCategory(page);
    await expectRenderedTone(tone);
    await expect(card('u-test-person').locator('.visual > img')).toHaveCount(0);
    expect(await illustration.innerHTML()).toBe(illustrationBefore);
    if (withMedia) {
      await expect(photo).toBeVisible();
      expect(await photo.getAttribute('src')).toBe(photoBefore);
    }
  }
  expect(await protectedSnapshot(page)).toEqual(before);

  await page.evaluate(async () => {
    await (await import('/db.js')).setSetting('visualStyle', 'mulberry');
    for (const registration of await navigator.serviceWorker.getRegistrations()) await registration.unregister();
    if (window.caches) for (const key of await caches.keys()) await caches.delete(key);
  });
  await page.reload();
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  await openTalkCategory(page);
  await expectRenderedTone('5', false);
  await expect(card('u-test-person').locator('.visual > img')).toHaveCount(0);
  await expect(card('u-test-non-compatible').locator('.visual')).toHaveAttribute('data-rendered-emoji', '🙂');
  if (withMedia) await expect(photo).toBeVisible();
  expect(await protectedSnapshot(page)).toEqual(before);
});

test('7 — voix : parent prioritaire, MP3 exacts, texte modifié et repli local', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const withMedia = testInfo.project.name !== 'iphone-13-webkit';
  const requests = [];
  page.on('request', (request) => {
    if (/^https?:/.test(request.url())) requests.push(request.url());
  });
  await page.route('**/voix/index.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        fr: {
          'w-voix-lexique': 'Texte indexé de fixture',
          'w-voix-historique': 'Ancien texte indexé de fixture',
        },
        dr: {},
      }),
    });
  });
  await page.route('**/voix/**/*.mp3', async (route) => {
    await route.fulfill({ status: 200, contentType: 'audio/mpeg', body: '' });
  });
  await page.addInitScript(() => {
    const observed = window.__voiceFixture = { media: [], speech: [], indexFetches: 0 };
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const value = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
      if (new URL(value, location.href).pathname.endsWith('/voix/index.json')) observed.indexFetches += 1;
      return nativeFetch(input, init);
    };
    HTMLMediaElement.prototype.play = function play() {
      observed.media.push(this.getAttribute('src') || this.src);
      queueMicrotask(() => {
        if (this.onplaying) this.onplaying(new Event('playing'));
        if (this.onended) this.onended(new Event('ended'));
      });
      return Promise.resolve();
    };
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        speaking: false,
        pending: false,
        getVoices: () => [],
        addEventListener: () => {},
        removeEventListener: () => {},
        resume: () => {},
        cancel: () => {},
        speak: (utterance) => {
          if (utterance.text !== ' ') observed.speech.push(utterance.text);
          queueMicrotask(() => {
            if (utterance.onend) utterance.onend(new Event('end'));
          });
        },
      },
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class SpeechSynthesisUtterance {
        constructor(text) {
          this.text = String(text || '');
          this.lang = '';
          this.voice = null;
          this.rate = 1;
          this.volume = 1;
          this.onend = null;
          this.onerror = null;
        }
      },
    });
  });
  await routeLexique(page, () => fixture([], CATEGORY));
  const seeded = await seedBeforeApp(page, async ({ category, withMedia }) => {
    const db = await import('/db.js');
    const { layoutFingerprint } = await import('/modules/grid-layout.js');
    const positionsFor = (index) => {
      const positions = {};
      for (const cols of [2, 3, 4, 5]) positions[String(cols)] = { row: Math.floor((index - 1) / cols) + 1, col: (index - 1) % cols + 1 };
      return positions;
    };
    const make = (id, index, overrides = {}) => {
      const positions = positionsFor(index);
      return {
        id, wordId: '', cat: category.id, fr: `Carte vocale ${index}`, dr: '', ar: '', emoji: '🙂', gram: 'noun',
        sub: '', sayFr: '', sayAr: '', hidden: false, order: index, positions,
        gridRow: positions['4'].row, gridCol: positions['4'].col, visualKey: null,
        photo: null, audios: {}, ...overrides,
      };
    };
    const cards = [
      make('u-voix-parent', 1, {
        lexicon: { wordId: 'w-voix-lexique' }, wordId: 'w-voix-historique', sayFr: 'Texte indexé de fixture',
        audios: withMedia ? { fr: new Blob(['voix-parent-fixture'], { type: 'audio/webm' }) } : {},
      }),
      make('u-voix-mp3', 2, { lexicon: { wordId: 'w-voix-lexique' }, wordId: 'w-voix-historique', sayFr: 'Texte indexé de fixture' }),
      make('u-voix-historique', 3, { wordId: 'w-voix-historique', sayFr: 'Ancien texte indexé de fixture' }),
      make('u-voix-modifie', 4, { lexicon: { wordId: 'w-voix-lexique' }, wordId: 'w-voix-historique', sayFr: 'Texte personnalisé de fixture' }),
      make('u-voix-local', 5, { sayFr: 'Texte local de fixture' }),
    ];
    await db.putCards(cards);
    await db.setSetting('cols', 4);
    await db.setSetting('lang', 'fr');
    await db.setSetting('onlyReviewed', false);
    await db.setSetting('emojiSkinTone', 'default');
    await db.setSetting('visualStyle', 'system');
    await db.setSetting('seeded', true);
    await db.setSetting('v2migrated', true);
    await db.setSetting('v3migrated', true);
    await db.setSetting('v7migrated', true);
    await db.setSetting('v92migrated', true);
    await db.setSetting('v10.20migrated', true);
    await db.setSetting('layoutFingerprint', await layoutFingerprint(cards));
    return cards.length;
  }, { category: CATEGORY, withMedia });
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  expect(await seeded()).toBe(5);
  await expect.poll(() => page.evaluate(() => window.__voiceFixture?.indexFetches)).toBe(1);
  const before = await protectedSnapshot(page);
  await openTalkCategory(page);
  const card = (id) => page.locator(`main .grid button.card[data-card-id="${id}"]`);
  const reset = () => page.evaluate(() => {
    window.__voiceFixture.media = [];
    window.__voiceFixture.speech = [];
  });
  const observed = () => page.evaluate(() => ({
    media: window.__voiceFixture.media,
    speech: window.__voiceFixture.speech,
  }));

  for (const [id, src] of [
    ['u-voix-mp3', './voix/fr/w-voix-lexique.mp3'],
    ['u-voix-historique', './voix/fr/w-voix-historique.mp3'],
  ]) {
    await reset();
    await card(id).click();
    await expect.poll(observed).toEqual({ media: [src], speech: [] });
  }
  for (const [id, text] of [
    ['u-voix-modifie', 'Texte personnalisé de fixture'],
    ['u-voix-local', 'Texte local de fixture'],
  ]) {
    await reset();
    await card(id).click();
    await expect.poll(observed).toEqual({ media: [], speech: [text] });
  }

  await reset();
  await page.evaluate(async () => {
    const db = await import('/db.js');
    const { sayCard } = await import('/speech.js');
    const card = (await db.getAllCards()).find((entry) => entry.id === 'u-voix-parent');
    if (!card.audios?.fr) card.audios = { fr: new Blob(['voix-parent-fixture'], { type: 'audio/webm' }) };
    await sayCard(card, 'fr');
  });
  await expect.poll(observed).toEqual({ media: [expect.stringMatching(/^blob:/)], speech: [] });
  expect(await page.evaluate(() => window.__voiceFixture.indexFetches)).toBe(1);
  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => new URL(url).origin !== origin), 'aucune nouvelle requête externe').toEqual([]);
  expect(await protectedSnapshot(page)).toEqual(before);
});

test('8 — Lexique iPhone : largeur 390 px, révision courte et six teintes contenues', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'iphone-13-webkit', 'rendu mobile : WebKit iPhone 13 seulement');
  test.setTimeout(90_000);
  const revision = '0123456789abcdef'.repeat(4);
  const words = fixture().words;
  words[0] = { ...words[0], revision };
  await routeLexique(page, () => fixture(words));
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  await openParentLexique(page);
  await expect(page.locator('[data-stat="category-base"]')).toBeVisible();
  for (const label of ['Relu en langue', 'Relu cliniquement', 'Palier 4', 'Essentiel']) {
    await expect(page.locator('.lexique-stat span').filter({ hasText: label })).toHaveCount(1);
  }
  const tones = page.locator('.lexique-tone-choices input[type="radio"]');
  await expect(tones).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) await expect(tones.nth(index)).toBeVisible();

  const geometry = await page.evaluate(() => {
    const fits = (element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= window.innerWidth;
    };
    const view = document.querySelector('#view');
    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      viewClientWidth: view.clientWidth,
      viewScrollWidth: view.scrollWidth,
      grids: [...document.querySelectorAll('#lexique .lexique-stats')].map((grid) => ({
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length,
        outside: [...grid.querySelectorAll('.lexique-stat')].filter((item) => !fits(item)).map((item) => item.textContent.trim()),
      })),
      tonesOutside: [...document.querySelectorAll('.lexique-tone-choices label.check')]
        .filter((choice) => !fits(choice)).map((choice) => choice.textContent.trim()),
    };
  });
  expect.soft(geometry.innerWidth).toBe(390);
  expect.soft(geometry.scrollWidth).toBeLessThanOrEqual(geometry.innerWidth);
  expect.soft(geometry.viewScrollWidth).toBeLessThanOrEqual(geometry.viewClientWidth);
  for (const grid of geometry.grids) {
    expect.soft(grid.columns).toBeLessThanOrEqual(2);
    expect.soft(grid.outside).toEqual([]);
  }
  expect.soft(geometry.tonesOutside).toEqual([]);

  const revisionLine = page.locator('#lexique > p.note').first();
  const revisionText = await revisionLine.textContent();
  expect.soft(revisionText).toContain(`Révision ${revision.slice(0, 8)} ·`);
  expect.soft(revisionText).not.toContain(revision);
  expect.soft(await revisionLine.evaluate((element) => getComputedStyle(element).overflowWrap)).toBe('anywhere');
});

test('9 — hors ligne : six modules précachés, Lexique chargé, aucun rechargement automatique', async ({ page, context }, testInfo) => {
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
  expect(cachedModules, 'les six modules du Lexique doivent être précachés').toEqual(Array(6).fill(true));

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

test('10 — sauvegarde/restauration (Spec E2E 8) : lexique protégé, carte familiale restaurée, positions locales', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const withMedia = testInfo.project.name !== 'iphone-13-webkit';
  await routeLexique(page, () => fixture([], CATEGORY));
  const seeded = await seedBeforeApp(page, async ({ category, withMedia }) => {
    const db = await import('/db.js');
    const { layoutFingerprint } = await import('/modules/grid-layout.js');
    const lexicon = (wordId, overrides = {}) => ({
      owned: true, legacy: false, customized: false, wordId, revision: 'revision-locale', niveau: 'noyau', palier: 1,
      fonction: '', sourceCategory: category.id, role: 'noun', arStandard: 'نص محايد', legacyFr: 'Texte source local',
      relecteurFr: '', relecteurDr: '', dateRevision: '', secondVoice: '', status: 'brouillon', ...overrides,
    });
    const local = {
      id: 'w-test-backup-local', wordId: 'w-test-backup-local', updatedAt: 500, cat: category.id,
      fr: 'Texte parent local', dr: 'Texte local', ar: 'نص محلي', emoji: '👨🏽‍👩🏽‍👧🏽‍👦🏽', gram: 'person',
      sub: 'local', sayFr: 'voix fr locale', sayAr: 'voix ar locale', hidden: true, order: 7,
      positions: { 2: { row: 4, col: 1 }, 4: { row: 2, col: 1 } }, gridRow: 2, gridCol: 1, visualKey: 'visuel-local',
      photo: withMedia ? new Blob(['photo-parent-fixture'], { type: 'image/png' }) : null,
      video: withMedia ? new Blob(['video-parent-fixture'], { type: 'video/webm' }) : null,
      audios: withMedia ? { fr: new Blob(['voix-parent-fixture'], { type: 'audio/webm' }) } : {},
      audioFr: withMedia ? new Blob(['voix-fr-legacy-fixture'], { type: 'audio/webm' }) : null,
      audioDr: withMedia ? new Blob(['voix-dr-legacy-fixture'], { type: 'audio/webm' }) : null,
      lexicon: lexicon('w-test-backup-local', {
        customized: true, role: 'person', relecteurDr: 'RD', status: 'relu-langue',
        note: 'note exclue', url: 'https://neutral.invalid/', email: 'neutre@example.invalid',
        phone: '0000000000', path: 'C:\\neutre\\fixture', unknown: 'inconnu',
      }),
    };
    const sparse = {
      id: 'w-test-backup-absent', wordId: 'w-test-backup-absent', updatedAt: 500, cat: category.id,
      fr: 'Texte absent local', dr: '', ar: '', emoji: '🙂', gram: 'noun', order: 8,
      positions: { 2: { row: 6, col: 2 }, 4: { row: 3, col: 2 } }, gridRow: 3, gridCol: 2,
      lexicon: lexicon('w-test-backup-absent'),
    };
    const family = {
      id: 'u-test-backup-family', wordId: 'u-test-backup-family', updatedAt: 300, cat: category.id,
      fr: 'Carte familiale test', dr: '', ar: '', emoji: '🧪', gram: 'noun', sub: '', sayFr: '', sayAr: '',
      hidden: false, order: 9, positions: { 2: { row: 20, col: 1 }, 4: { row: 8, col: 1 } }, gridRow: 8, gridCol: 1,
      visualKey: null, photo: null, video: null, audios: {},
    };
    const cards = [local, sparse, family];
    await db.putCards(cards);
    await db.setSetting('cols', 4);
    await db.setSetting('lang', 'fr');
    await db.setSetting('onlyReviewed', false);
    await db.setSetting('emojiSkinTone', '3');
    await db.setSetting('seeded', true);
    await db.setSetting('v2migrated', true);
    await db.setSetting('v3migrated', true);
    await db.setSetting('v7migrated', true);
    await db.setSetting('v92migrated', true);
    await db.setSetting('v10.20migrated', true);
    await db.setSetting('layoutFingerprint', await layoutFingerprint(cards));
    return cards.length;
  }, { category: CATEGORY, withMedia });
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  expect(await seeded()).toBe(3);
  const before = await backupCardSnapshot(page);
  const beforeById = new Map(before.map((card) => [card.id, card]));

  await openParentLexique(page);
  const parentToggle = page.locator('#pb-toggle');
  if (await parentToggle.getAttribute('aria-expanded') !== 'true') await parentToggle.click();
  if (withMedia) await page.locator('#backup-media').check();
  await page.locator('#export').click();
  await expect(page.locator('#backup-save')).toBeVisible();
  const downloadPending = page.waitForEvent('download');
  await page.locator('#backup-save').click();
  const download = await downloadPending;
  const payload = JSON.parse(readFileSync(await download.path(), 'utf8'));
  expect(payload.settings.onlyReviewed).toBe(false);
  expect(payload.settings.emojiSkinTone).toBe('3');
  expect(payload.includesMedia).toBe(withMedia);
  const exportedLocal = payload.cards.find((card) => card.id === 'w-test-backup-local');
  expect(exportedLocal.emoji).toBe('👨🏽‍👩🏽‍👧🏽‍👦🏽');
  expect(exportedLocal.lexicon.status).toBe('relu-langue');
  for (const field of ['note', 'url', 'email', 'phone', 'path', 'unknown']) expect(exportedLocal.lexicon[field]).toBeUndefined();

  const remotePhoto = withMedia ? 'data:image/png;base64,cGhvdG8gZGlzdGFudGU=' : null;
  const remoteVideo = withMedia ? 'data:video/webm;base64,dmlkZW8gZGlzdGFudGU=' : null;
  const remoteAudio = withMedia ? 'data:audio/webm;base64,dm9peCBkaXN0YW50ZQ==' : null;
  const remoteAudios = withMedia ? { fr: remoteAudio } : {};
  const remotePositions = { 2: { row: 9, col: 2 }, 3: { row: 7, col: 3 }, 4: { row: 6, col: 4 }, 5: { row: 5, col: 5 } };
  const incomingLocal = payload.cards.find((card) => card.id === 'w-test-backup-local');
  Object.assign(incomingLocal, {
    wordId: 'w-test-backup-distant', positions: remotePositions, gridRow: 6, gridCol: 4, order: 99,
    visualKey: 'visuel-distant', emoji: '🙂', gram: 'verb', sub: 'distant', sayFr: 'voix fr distante', sayAr: 'voix ar distante',
    hidden: false, photo: remotePhoto, video: remoteVideo, audios: remoteAudios, audioFr: remoteAudio, audioDr: remoteAudio,
    lexicon: {
      ...incomingLocal.lexicon, customized: false, revision: 'revision-distante', niveau: 'frange', palier: 4,
      fonction: 'question', role: 'person', arStandard: 'نص بعيد محايد', legacyFr: 'Texte source distant',
      relecteurFr: 'RF', relecteurDr: 'RD', dateRevision: '2026-11-21', secondVoice: 'ZZ', status: 'relu-clinique',
      note: 'note exclue', url: 'https://neutral.invalid/', email: 'neutre@example.invalid',
      phone: '0000000000', path: 'C:\\neutre\\fixture', unknown: 'inconnu',
    },
  });
  const incomingSparse = payload.cards.find((card) => card.id === 'w-test-backup-absent');
  Object.assign(incomingSparse, {
    positions: remotePositions, gridRow: 6, gridCol: 4, order: 99, visualKey: 'visuel-distant', hidden: true,
    photo: remotePhoto, video: remoteVideo, audios: remoteAudios, audioFr: remoteAudio, audioDr: remoteAudio,
    lexicon: {
      ...incomingSparse.lexicon, revision: 'revision-distante', niveau: 'frange', palier: 4, fonction: 'question',
      relecteurFr: 'RF', relecteurDr: 'RD', dateRevision: '2026-11-21', secondVoice: 'ZZ', status: 'relu-clinique',
    },
  });
  const incomingFamily = payload.cards.find((card) => card.id === 'u-test-backup-family');
  Object.assign(incomingFamily, {
    cat: 'base', fr: 'Texte distant', dr: 'Darija familiale distante', ar: 'نص عائلي بعيد',
    positions: remotePositions, gridRow: 6, gridCol: 4, order: 99,
    visualKey: 'visuel-distant', emoji: '🙂', hidden: true,
    photo: remotePhoto, video: remoteVideo, audios: remoteAudios,
  });
  payload.cards.push({
    id: 'w-test-backup-neuf', wordId: 'w-test-backup-neuf', updatedAt: 400, cat: CATEGORY.id,
    fr: 'Carte neuve', dr: '', ar: '', emoji: '🧪', gram: 'noun', sub: '', sayFr: '', sayAr: '', hidden: false, order: 10,
    positions: remotePositions, gridRow: 6, gridCol: 4, visualKey: 'visuel-neuf', photo: remotePhoto, video: remoteVideo,
    audios: remoteAudios, lexicon: {
      owned: true, legacy: false, customized: false, wordId: 'w-test-backup-neuf', revision: 'revision-neuve',
      niveau: 'noyau', palier: 1, fonction: '', sourceCategory: CATEGORY.id, role: 'noun', arStandard: '', legacyFr: '',
      relecteurFr: '', relecteurDr: '', dateRevision: '', secondVoice: '', status: 'brouillon', note: 'note exclue',
    },
  });
  payload.settings.onlyReviewed = true;
  payload.settings.emojiSkinTone = '5';

  const dialogs = [];
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  });
  await page.locator('#import').setInputFiles({
    name: 'sauvegarde-neutre.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)),
  });
  await expect.poll(() => dialogs.length).toBeGreaterThan(0);
  expect(dialogs[0]).toEqual({ type: 'confirm', message: expect.stringContaining('Ajouter 4 cartes') });
  await expect.poll(async () => {
    try {
      return await page.evaluate(async () => {
        const db = await import('/db.js');
        const cards = await db.getAllCards();
        return {
          count: cards.length,
          localStatus: cards.find((card) => card.id === 'w-test-backup-local')?.lexicon?.status,
          onlyReviewed: await db.getSetting('onlyReviewed'),
          emojiSkinTone: await db.getSetting('emojiSkinTone'),
        };
      });
    } catch (error) {
      return { error: error?.message || String(error), dialogs };
    }
  }).toEqual({ count: 4, localStatus: 'relu-clinique', onlyReviewed: false, emojiSkinTone: '3' });
  expect(dialogs).toHaveLength(1);
  expect(dialogs[0].type).toBe('confirm');

  const after = await backupCardSnapshot(page);
  const afterById = new Map(after.map((card) => [card.id, card]));
  for (const id of ['w-test-backup-local', 'w-test-backup-absent']) {
    expect(afterById.get(id).fields, `${id} : champs locaux protégés`).toEqual(beforeById.get(id).fields);
    expect(afterById.get(id).updatedAt).toBeGreaterThanOrEqual(beforeById.get(id).updatedAt);
  }
  const beforeFamily = beforeById.get('u-test-backup-family');
  const afterFamily = afterById.get('u-test-backup-family');
  for (const field of ['order', 'visualKey', 'emoji', 'gram', 'cat', 'sub', 'sayFr', 'sayAr', 'hidden']) {
    expect(afterFamily.fields[field].value, `carte familiale : ${field} restauré`).toBe(incomingFamily[field]);
  }
  expect(afterFamily.fields.positions.value).toEqual({
    2: beforeFamily.fields.positions.value[2], 3: remotePositions[3],
    4: beforeFamily.fields.positions.value[4], 5: remotePositions[5],
  });
  expect(afterFamily.fields.gridRow.value).toBe(beforeFamily.fields.gridRow.value);
  expect(afterFamily.fields.gridCol.value).toBe(beforeFamily.fields.gridCol.value);
  expect(afterFamily.wordId).toBe(beforeFamily.wordId);
  expect(afterFamily.text).toEqual({ fr: 'Texte distant', dr: 'Darija familiale distante', ar: 'نص عائلي بعيد' });
  expect(afterFamily.updatedAt).toBeGreaterThanOrEqual(beforeFamily.updatedAt);
  expect(afterById.get('w-test-backup-local').text).toEqual(beforeById.get('w-test-backup-local').text);
  expect(afterById.get('w-test-backup-local').lexicon).toMatchObject({
    customized: true, revision: 'revision-distante', niveau: 'frange', palier: 4, fonction: 'question', role: 'person',
    arStandard: 'نص بعيد محايد', legacyFr: 'Texte source distant', relecteurFr: 'RF', relecteurDr: 'RD',
    dateRevision: '2026-11-21', secondVoice: 'ZZ', status: 'relu-clinique',
  });
  expect(afterById.get('w-test-backup-absent').lexicon.status).toBe('relu-clinique');
  for (const id of ['w-test-backup-local', 'w-test-backup-absent', 'w-test-backup-neuf']) {
    for (const field of ['note', 'url', 'email', 'phone', 'path', 'unknown']) expect(afterById.get(id).lexicon[field]).toBeUndefined();
  }
  expect(afterById.get('w-test-backup-neuf').fields.positions.value).toEqual(remotePositions);
  expect(afterById.get('w-test-backup-neuf').fields.gridRow.value).toBe(6);
  expect(afterById.get('w-test-backup-neuf').fields.gridCol.value).toBe(4);
  if (withMedia) {
    const media = await page.evaluate(async () => {
      const db = await import('/db.js');
      const cards = await db.getAllCards();
      const readMedia = async (id) => {
        const card = cards.find((entry) => entry.id === id);
        return {
          photo: card.photo instanceof Blob ? await card.photo.text() : null,
          video: card.video instanceof Blob ? await card.video.text() : null,
          audio: card.audios?.fr instanceof Blob ? await card.audios.fr.text() : null,
        };
      };
      return {
        newCard: await readMedia('w-test-backup-neuf'),
        family: await readMedia('u-test-backup-family'),
      };
    });
    expect(media).toEqual({
      newCard: { photo: 'photo distante', video: 'video distante', audio: 'voix distante' },
      family: { photo: 'photo distante', video: 'video distante', audio: 'voix distante' },
    });
  }
});

test('11 — restauration sans lexique : 93 cartes, photo et voix restaurées, positions locales inchangées', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'iphone-13-webkit', 'La persistance exacte des Blobs est vérifiée sur Chromium.');
  test.setTimeout(120_000);
  const targetId = 'c-test-restauration-01';
  const seeded = await seedBeforeApp(page, async () => {
    const db = await import('/db.js');
    const { layoutFingerprint } = await import('/modules/grid-layout.js');
    const cards = Array.from({ length: 93 }, (_, index) => {
      const number = index + 1;
      const id = `c-test-restauration-${String(number).padStart(2, '0')}`;
      const positions = {};
      for (const size of [2, 3, 4, 5]) {
        positions[String(size)] = { row: Math.floor(index / size) + 1, col: (index % size) + 1 };
      }
      return {
        id, wordId: id, updatedAt: 100, cat: 'base', fr: `Marqueur ${number}`, dr: '', ar: '',
        emoji: '🧪', gram: 'noun', hidden: false, order: number,
        gridRow: positions['4'].row, gridCol: positions['4'].col, positions,
      };
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
  });
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  expect(await seeded()).toBe(93);
  const before = await backupCardSnapshot(page);
  const beforeById = new Map(before.map((card) => [card.id, card]));
  expect(beforeById.get(targetId).fields.photo.value).toBeNull();
  expect(beforeById.get(targetId).fields.audios.value).toBeNull();

  const dataUrl = (type, text) => `data:${type};base64,${Buffer.from(text, 'utf8').toString('base64')}`;
  const photoBytes = 'photo-restauration-fixture';
  const audioFrBytes = 'voix-fr-restauration-fixture';
  const audioDrBytes = 'voix-dr-restauration-fixture';
  const payload = {
    format: 'kalimati-backup-v4',
    cards: [{
      id: targetId, wordId: 'w-test-restauration-distant', cat: 'base', fr: 'Texte restauré', dr: 'Darija restaurée', ar: 'نص محايد',
      emoji: '🙂', gram: 'noun', sub: 'sous-titre restauré', sayFr: 'voix fr distante', sayAr: 'صوت بعيد',
      hidden: true, order: 99, gridRow: 20, gridCol: 4, visualKey: 'visuel-restaure',
      positions: { 2: { row: 20, col: 2 }, 3: { row: 20, col: 3 }, 4: { row: 20, col: 4 }, 5: { row: 20, col: 5 } },
      photo: dataUrl('image/png', photoBytes),
      audios: { fr: dataUrl('audio/webm', audioFrBytes), dr: dataUrl('audio/webm', audioDrBytes) },
    }],
    settings: {},
  };

  await openParentLexique(page);
  const dialogs = [];
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  });
  await page.locator('#import').setInputFiles({
    name: 'sauvegarde-sans-lexique.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)),
  });
  await expect.poll(() => dialogs.length).toBeGreaterThan(0);
  expect(dialogs[0].type).toBe('confirm');
  await expect.poll(async () => page.evaluate(async (id) => {
    const db = await import('/db.js');
    const cards = await db.getAllCards();
    const card = cards.find((entry) => entry.id === id);
    return {
      count: cards.length,
      photo: card?.photo instanceof Blob ? await card.photo.text() : null,
      audioFr: card?.audios?.fr instanceof Blob ? await card.audios.fr.text() : null,
      audioDr: card?.audios?.dr instanceof Blob ? await card.audios.dr.text() : null,
    };
  }, targetId)).toEqual({ count: 93, photo: photoBytes, audioFr: audioFrBytes, audioDr: audioDrBytes });

  const restoredBytes = await page.evaluate(async (id) => {
    const db = await import('/db.js');
    const card = (await db.getAllCards()).find((entry) => entry.id === id);
    const bytes = async (blob) => (blob instanceof Blob ? Array.from(new Uint8Array(await blob.arrayBuffer())) : null);
    return { photo: await bytes(card.photo), audioFr: await bytes(card.audios?.fr), audioDr: await bytes(card.audios?.dr) };
  }, targetId);
  expect(restoredBytes).toEqual({
    photo: [...Buffer.from(photoBytes, 'utf8')],
    audioFr: [...Buffer.from(audioFrBytes, 'utf8')],
    audioDr: [...Buffer.from(audioDrBytes, 'utf8')],
  });

  const after = await backupCardSnapshot(page);
  const afterById = new Map(after.map((card) => [card.id, card]));
  expect(after).toHaveLength(93);
  expect([...afterById.keys()].sort()).toEqual([...beforeById.keys()].sort());
  for (const card of before) {
    if (card.id !== targetId) {
      expect(afterById.get(card.id).fields.positions.value, `${card.id} : place inchangée`).toEqual(card.fields.positions.value);
    }
  }
  const restored = afterById.get(targetId);
  expect(restored.fields.positions.value).toEqual(beforeById.get(targetId).fields.positions.value);
  expect(restored.fields.gridRow.value).toBe(beforeById.get(targetId).fields.gridRow.value);
  expect(restored.fields.gridCol.value).toBe(beforeById.get(targetId).fields.gridCol.value);
  expect(restored.fields.wordId.value).toBe(targetId);
  expect(restored.fields.hidden.value).toBe(true);
  expect(restored.fields.order.value).toBe(99);
  expect(restored.text).toEqual({ fr: 'Texte restauré', dr: 'Darija restaurée', ar: 'نص محايد' });
  expect(restored.updatedAt).toBeGreaterThanOrEqual(beforeById.get(targetId).updatedAt);
});
