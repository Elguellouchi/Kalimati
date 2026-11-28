import { test, expect } from '@playwright/test';
import { TOILET_CARD_ID } from '../../data.js';
import { disableOfflineCache, HOME_TILE_TALK, SANS_CACHES, visibleCards } from './support.mjs';

const CARD_ONE = 'w-journal-neutre-a';
const CARD_TWO = 'w-journal-neutre-b';

const journalCard = (page, id) => page.locator(`main .grid button.card[data-card-id="${id}"]`).filter({ visible: true });

async function seedNeutralCards(page, { blobs = false } = {}) {
  return page.evaluate(async ({ one, two, blobs }) => {
    try {
      const db = await import(new URL('db.js', location.href).href);
      const { defaultCards } = await import(new URL('data.js', location.href).href);
      const template = defaultCards().find((card) => card.fr === 'Pain');
      let voice = null;
      if (blobs) {
        const response = await fetch('/voix/fr/c-manger-pain.mp3');
        if (!response.ok) throw new Error(`voix locale indisponible : ${response.status}`);
        voice = new Blob([await response.arrayBuffer()], { type: 'audio/mpeg' });
      }
      for (const [id, wordId] of [[one, 'w-journal-neutre-a'], [two, 'w-journal-neutre-b']]) {
        await db.putCard({
          ...template,
          id,
          wordId,
          lexicon: { owned: true, wordId, relecteurDr: 'TST' },
          fr: 'Carte journal A',
          dr: 'Carte journal A',
          ar: '',
          photo: blobs ? new Blob(['photo-neutre'], { type: 'image/png' }) : null,
          audios: blobs ? { fr: voice } : {},
          audioFr: null,
          audioDr: null,
          extra: false,
          order: -1,
          gridRow: 0,
          gridCol: 0,
          hidden: false,
        });
      }
      if (blobs) {
        const saved = (await db.getAllCards()).find((card) => card.id === one);
        return { audio: saved?.audios?.fr ? { type: saved.audios.fr.type, size: saved.audios.fr.size } : null };
      }
      return { audio: null };
    } catch (error) {
      return { audio: null, error: `${error?.name || 'Error'}: ${error?.message || String(error)}` };
    }
  }, { one: CARD_ONE, two: CARD_TWO, blobs });
}

async function startTalk(page) {
  await page.goto('/');
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  await page.locator(HOME_TILE_TALK).click();
  await page.getByRole('button', { name: 'Manger', exact: true }).click();
  await expect(page.locator('.talk-cat[data-cat="manger"]')).toHaveAttribute('aria-current', 'true');
  await expect(visibleCards(page).first()).toBeVisible();
  await expect(journalCard(page, CARD_ONE)).toBeVisible();
  await page.evaluate(async () => {
    const journal = await import('/modules/utterance-log.js');
    await journal.clearUtteranceLogs();
    await journal.setUtteranceJournalEnabled(true);
  });
}

async function readLogs(page) {
  return page.evaluate(async () => {
    const request = indexedDB.open('kalimati', 12);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const logs = await new Promise((resolve, reject) => {
      const transaction = db.transaction('utterance_log', 'readonly');
      const query = transaction.objectStore('utterance_log').getAll();
      query.onsuccess = () => resolve(query.result);
      query.onerror = () => reject(query.error);
    });
    db.close();
    return logs;
  });
}

async function flush(page) {
  await page.evaluate(async () => {
    const journal = await import('/modules/utterance-log.js');
    await journal.flushUtteranceLogs();
  });
}

async function unlockParent(page) {
  await page.locator('#lock').focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(3100);
  await page.keyboard.up('Space');
  await expect(page.locator('body')).toHaveClass(/\bparent\b/);
}

async function backToTalk(page) {
  const back = page.getByRole('button', { name: 'Revenir à mes mots', exact: true });
  if (await back.isVisible()) await back.click();
  await page.locator('#spaces .space-btn').filter({ hasText: 'Parler' }).click();
  await expect(visibleCards(page).first()).toBeVisible();
}

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name !== SANS_CACHES) await page.addInitScript(disableOfflineCache);
  await page.goto('/');
  await page.locator(HOME_TILE_TALK).click();
  await expect(page.locator('main .grid button.card[data-card-id="c-manger-pain"]').filter({ visible: true })).toBeVisible();
  const seeded = await seedNeutralCards(page, { blobs: testInfo.title.includes('latence') });
  expect(seeded.error).toBeUndefined();
  await startTalk(page);
});

test('50 touches acceptées, rejet rapide et frontière de phrase', async ({ page }) => {
  for (let i = 0; i < 50; i += 1) {
    const id = i % 2 ? CARD_TWO : CARD_ONE;
    await journalCard(page, id).click();
  }
  await flush(page);
  let logs = await readLogs(page);
  expect(logs).toHaveLength(50);
  expect(logs.every((entry) => entry.mode === 'carte' && entry.source === 'enfant')).toBe(true);

  await journalCard(page, CARD_ONE).dblclick();
  await flush(page);
  logs = await readLogs(page);
  expect(logs).toHaveLength(51);

  await page.waitForTimeout(450);
  await page.locator('#btn-clear').click();
  await expect(page.locator('#strip')).toHaveClass(/empty/);
  await expect(page.locator('#strip-cards button.card')).toHaveCount(0);
  await journalCard(page, CARD_ONE).click();
  await journalCard(page, CARD_TWO).click();
  await page.locator('#btn-play').click();
  await flush(page);
  logs = await readLogs(page);
  expect(logs).toHaveLength(54);
  const phrase = logs.filter((entry) => entry.mode === 'phrase');
  expect(phrase).toHaveLength(1);
  expect(phrase[0].wordIds).toEqual([CARD_ONE, CARD_TWO]);
});

test('coach et modèle sont journalisés une fois', async ({ page }) => {
  await journalCard(page, CARD_ONE).click();
  await journalCard(page, CARD_TWO).click();
  await page.locator('.coach-sentence').click();
  await flush(page);
  let logs = await readLogs(page);
  expect(logs.filter((entry) => entry.mode === 'phrase')).toHaveLength(1);

  await page.locator('.talk-adult > summary').click({ timeout: 5000 });
  await page.locator('.model-toggle').click({ timeout: 5000 });
  await expect(page.locator('.talk')).toHaveClass(/modeling/);
  await journalCard(page, CARD_ONE).click();
  await page.locator('#model-line button[aria-label="Redire"]').click({ timeout: 5000 });
  await flush(page);
  logs = await readLogs(page);
  const model = logs.filter((entry) => entry.source === 'modele');
  expect(model).toHaveLength(2);
  expect(model.every((entry) => entry.mode === 'carte' || entry.mode === 'phrase')).toBe(true);
});

test('parent, Explorer, secours, texte en images et jeu sont exclus', async ({ page }) => {
  await unlockParent(page);
  await page.locator('.explore-toggle').click();
  await journalCard(page, CARD_ONE).click();
  await page.locator('#lock').click();
  await page.waitForTimeout(1600);
  await page.locator('#lock').click();
  await expect(page.locator('body')).not.toHaveClass(/\bparent\b/);

  await page.evaluate(async () => {
    const fallback = await import('/modules/db-fallback.js');
    fallback.enableFallbackMode(new Error('scénario E2E neutre'));
  });
  await journalCard(page, CARD_TWO).click();
  await page.reload();
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  await page.locator('.home-grid .tile-talk').click();
  await page.locator('.talk-adult > summary').click({ timeout: 5000 });
  const picto = page.locator('.picto-box');
  await picto.locator(':scope > summary').click({ timeout: 5000 });
  await picto.locator('textarea').fill('Pain');
  await picto.locator('.picto-card').first().click();
  await page.locator('#spaces .space-btn').filter({ hasText: 'Jeux' }).click();
  await page.locator('.section-grid .section-tile').first().click();
  await page.locator('.goal-row').first().click();
  await expect(page.locator('.exercise-body')).toBeVisible();
  await page.locator('.exercise-body button').first().click();
  await flush(page);
  expect(await readLogs(page)).toEqual([]);
});

test('lieu et scène stables inclus, extra et repli toilette exclus', async ({ page }) => {
  await page.evaluate(async () => {
    const db = await import(new URL('db.js', location.href).href);
    await db.setSetting('placeBoards', [{ id: 'express-journal-neutre', title: 'Lieu journal neutre', emoji: '📌', text: 'dents' }]);
  });
  await startTalk(page);

  await page.locator('.place-tab').click();
  await page.getByRole('button', { name: 'Chez le dentiste', exact: true }).click();
  const placeCard = page.locator('.place-grid button.card[data-card-id]').filter({ visible: true }).first();
  await expect(placeCard).toHaveAttribute('data-card-id', /^(?!extra:)/);
  await placeCard.click();
  await flush(page);
  let logs = await readLogs(page);
  expect(logs).toHaveLength(1);
  expect(logs[0].page.startsWith('place:') && logs[0].mode === 'carte').toBe(true);

  await page.getByRole('button', { name: 'Revenir à mes mots', exact: true }).click();
  await page.locator('.place-tab').click();
  await page.getByRole('button', { name: 'Lieu journal neutre', exact: true }).click();
  const extraCard = page.locator('.place-grid button.card[data-card-id^="extra:"]');
  await expect(extraCard).toBeVisible();
  await extraCard.click();
  await flush(page);
  expect(await readLogs(page)).toHaveLength(1);

  await page.getByRole('button', { name: 'Revenir à mes mots', exact: true }).click();
  await page.locator('.place-tab').click();
  await page.getByRole('button', { name: 'La cuisine', exact: true }).click();
  const pain = page.locator('.scene-target[aria-label="Pain"]');
  await expect(pain).toBeVisible();
  await pain.click();
  await flush(page);
  logs = await readLogs(page);
  expect(logs).toHaveLength(2);
  expect(logs.some((entry) => entry.page === 'scene:cuisine' && entry.wordIds.includes('c-manger-pain'))).toBe(true);

  await backToTalk(page);
  await page.locator('#toilet').click();
  await flush(page);
  expect((await readLogs(page)).some((entry) => entry.page === 'toilet')).toBe(true);

  await page.evaluate(async (id) => {
    const db = await import(new URL('db.js', location.href).href);
    await db.deleteCard(id);
  }, TOILET_CARD_ID);
  await page.reload();
  await page.locator(HOME_TILE_TALK).click();
  expect((await page.evaluate(async (id) => {
    const db = await import(new URL('db.js', location.href).href);
    return (await db.getAllCards()).some((card) => card.id === id);
  }, TOILET_CARD_ID))).toBe(false);
  const before = (await readLogs(page)).length;
  await page.locator('#toilet').click();
  await flush(page);
  expect(await readLogs(page)).toHaveLength(before);
});

test('désactivation, réactivation, effacement et exclusions synchro/sauvegarde', async ({ page }) => {
  await journalCard(page, CARD_ONE).click();
  await page.evaluate(async () => {
    const journal = await import('/modules/utterance-log.js');
    await journal.setUtteranceJournalEnabled(false);
  });
  await journalCard(page, CARD_TWO).click();
  await flush(page);
  expect(await readLogs(page)).toHaveLength(1);

  await page.evaluate(async () => {
    const journal = await import('/modules/utterance-log.js');
    await journal.setUtteranceJournalEnabled(true);
  });
  await journalCard(page, CARD_ONE).click();
  await flush(page);
  expect(await readLogs(page)).toHaveLength(2);

  const privacy = await page.evaluate(async () => {
    const journal = await import('/modules/utterance-log.js');
    const db = await import(new URL('db.js', location.href).href);
    const cloud = await import('/modules/cloud-sync.js');
    const backup = await import('/backup.js');
    const payload = await cloud.buildLocalSyncPayload({ includeMedia: true });
    const cards = await db.getAllCards();
    const file = await backup.buildBackupFile({ cards, includeMedia: false });
    const raw = JSON.stringify({ payload, backup: JSON.parse(await file.text()), setting: await db.getSetting('utteranceJournalEnabled') });
    await journal.clearUtteranceLogs();
    return raw;
  });
  expect(privacy).not.toContain('utterance_log');
  expect(privacy).not.toContain('utteranceLogs');
  expect(privacy).not.toContain('utteranceJournalEnabled');
  expect(await readLogs(page)).toEqual([]);
});

test('latence : 40 paires, médiane des écarts <= 20 ms', async ({ page }) => {
  test.setTimeout(60_000);
  await page.evaluate(async () => {
    const journal = await import('/modules/utterance-log.js');
    await journal.setUtteranceJournalEnabled(false);
    const originalPlay = HTMLMediaElement.prototype.play;
    const originalSpeak = speechSynthesis.speak.bind(speechSynthesis);
    const events = [];
    document.addEventListener('click', () => events.push({ kind: 'click', at: performance.now() }), { capture: true });
    HTMLMediaElement.prototype.play = function (...args) {
      events.push({ kind: 'media', at: performance.now() });
      return originalPlay.apply(this, args);
    };
    speechSynthesis.speak = (...args) => {
      events.push({ kind: 'speak', at: performance.now() });
      return originalSpeak(...args);
    };
    window.__journalTiming = events;
  });
  await journalCard(page, CARD_ONE).click();
  await page.waitForTimeout(100);
  const timingState = await page.evaluate(async () => {
    const db = await import(new URL('db.js', location.href).href);
    const cards = await db.getAllCards();
    const card = cards.find((entry) => entry.id === 'w-journal-neutre-a');
    return {
      events: window.__journalTiming,
      audio: card?.audios?.fr ? { type: card.audios.fr.type, size: card.audios.fr.size } : null,
      legacy: Boolean(card?.audioFr),
      hidden: card?.hidden,
      extra: card?.extra,
      lang: await db.getSetting('lang'),
      onlyReviewed: await db.getSetting('onlyReviewed'),
    };
  });
  expect(timingState.audio?.type).toBe('audio/mpeg');
  expect(timingState.audio?.size).toBeGreaterThan(0);
  expect(timingState.legacy).toBe(false);
  expect(timingState.hidden).toBe(false);
  expect(timingState.extra).toBe(false);
  expect(await page.evaluate(() => window.__journalTiming.some((event) => event.kind === 'media'))).toBe(true);
  const deltas = [];
  for (let i = 0; i < 40; i += 1) {
    await page.evaluate(async () => {
      const journal = await import('/modules/utterance-log.js');
      await journal.setUtteranceJournalEnabled(false);
      window.__journalTiming.length = 0;
    });
    const id = i % 2 ? CARD_ONE : CARD_TWO;
    await journalCard(page, id).click();
    const inactive = await page.evaluate(() => {
      const events = window.__journalTiming;
      const click = events.find((event) => event.kind === 'click');
      const media = events.find((event) => event.kind === 'media');
      return click && media ? media.at - click.at : Number.NaN;
    });
    await page.waitForTimeout(450);
    await page.evaluate(async () => {
      const journal = await import('/modules/utterance-log.js');
      await journal.setUtteranceJournalEnabled(true);
      window.__journalTiming.length = 0;
    });
    await journalCard(page, id).click();
    const active = await page.evaluate(() => {
      const events = window.__journalTiming;
      const click = events.find((event) => event.kind === 'click');
      const media = events.find((event) => event.kind === 'media');
      return click && media ? media.at - click.at : Number.NaN;
    });
    expect(Number.isFinite(inactive) && Number.isFinite(active)).toBe(true);
    deltas.push(active - inactive);
  }
  const sorted = [...deltas].sort((a, b) => a - b);
  const median = (sorted[19] + sorted[20]) / 2;
  const maximum = Math.max(...deltas);
  console.log(JSON.stringify({ paires: deltas.length, median, maximum }));
  expect(median).toBeLessThanOrEqual(20);
});
