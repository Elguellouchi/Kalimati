import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import {
  SANS_CACHES, disableOfflineCache, HOME_TILE_TALK,
  openTalkGrid, openTrialTalkGrid, gridCardIds, waitCachedApp,
  installMainWorkerFixture, trialCacheName,
} from './support.mjs';

const MAIN_CACHE = 'kalimati-v10-54';
const TRIAL_CACHE = 'kalimati-essai-v10-54';
const HISTORICAL_CACHE = 'kalimati-v10-45';
const HISTORICAL_REVISION = 'c3060ab';
const CLOUD_MARKER = 'KALI-NEUTRAL-TEST-MARKER';

async function putNeutralCard(page, id, label) {
  const sourceId = await page.locator('main .grid button.card').first().getAttribute('data-card-id');
  await page.evaluate(async ({ id, label, sourceId }) => {
    const db = await import(new URL('db.js', location.href).href);
    const source = (await db.getAllCards()).find((card) => card.id === sourceId);
    if (!source) throw new Error('Aucune carte source pour le scénario neutre.');
    await db.putCard({
      ...source,
      id,
      fr: label,
      dr: label,
      ar: 'بطاقة اختبار',
      sayFr: label,
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
  }, { id, label, sourceId });
}

async function unlockParent(page) {
  await page.locator('#lock').focus();
  await page.keyboard.down('Space');
  await page.waitForTimeout(3100);
  await page.keyboard.up('Space');
  await expect(page.locator('body')).toHaveClass(/\bparent\b/);
  await expect(page.locator('#lock')).toHaveAttribute('aria-pressed', 'true');
}

async function openProgress(page) {
  await page.locator('#spaces .space-btn').filter({ hasText: 'Progrès' }).click();
  await expect(page.locator('summary').filter({ hasText: 'Réseau : Socle Clinique strict' })).toBeVisible();
}

async function openDetails(page, text) {
  const summary = page.locator('summary').filter({ hasText: text });
  await expect(summary).toBeVisible();
  const details = summary.locator('..');
  if (await details.getAttribute('open') === null) await summary.click();
  await expect(details).toHaveAttribute('open', '');
}

async function cacheEntries(page, name) {
  return page.evaluate(async (cacheName) => {
    if (!(await caches.has(cacheName))) return [];
    const cache = await caches.open(cacheName);
    return (await cache.keys()).map((request) => request.url).sort();
  }, name);
}

async function stableCacheEntries(page, name) {
  let previous = null;
  let stable = 0;
  let entries = [];
  await expect.poll(async () => {
    entries = await cacheEntries(page, name);
    const signature = JSON.stringify(entries);
    stable = signature === previous ? stable + 1 : 0;
    previous = signature;
    return stable >= 3;
  }, { timeout: 20_000 }).toBe(true);
  return entries;
}

async function trialController(page) {
  return page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '');
}

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === SANS_CACHES) await page.addInitScript(disableOfflineCache);
});

test('isolation des cartes — une carte principale neutre reste absente de l’essai', async ({ page }) => {
  const id = 'e2e-carte-principale-neutre';
  await openTalkGrid(page);
  await putNeutralCard(page, id, 'Carte neutre principale');
  await openTalkGrid(page);
  expect(await gridCardIds(page)).toContain(id);

  await openTrialTalkGrid(page);
  expect(await gridCardIds(page)).not.toContain(id);
});

test('isolation des cartes — une carte d’essai neutre reste absente du site principal', async ({ page }) => {
  const id = 'e2e-carte-essai-neutre';
  await openTrialTalkGrid(page);
  await putNeutralCard(page, id, 'Carte neutre d’essai');
  await openTrialTalkGrid(page);
  expect(await gridCardIds(page)).toContain(id);

  await openTalkGrid(page);
  expect(await gridCardIds(page)).not.toContain(id);
});

test('isolation du stockage — IndexedDB, localStorage et sessionStorage ont leurs propres espaces', async ({ page }) => {
  await openTalkGrid(page);
  const main = await page.evaluate(async () => {
    KalimatiStorage.setItem('e2e-marqueur', 'principal');
    const sessionKey = KalimatiStorage.storageKey('kalimati_super_admin_unlocked');
    sessionStorage.setItem(sessionKey, 'principal');
    const { activeDbName, dbNameFor } = await import(new URL('modules/child-profiles.js', location.href).href);
    return {
      activeDb: activeDbName(),
      childDb: dbNameFor('neutral-enfant'),
      localKey: KalimatiStorage.storageKey('e2e-marqueur'),
      sessionKey,
    };
  });
  expect(main).toEqual({
    activeDb: 'kalimati',
    childDb: 'kalimati-child-neutral-enfant',
    localKey: 'e2e-marqueur',
    sessionKey: 'kalimati_super_admin_unlocked',
  });

  await openTrialTalkGrid(page);
  const trial = await page.evaluate(async () => {
    KalimatiStorage.setItem('e2e-marqueur', 'essai');
    const sessionKey = KalimatiStorage.storageKey('kalimati_super_admin_unlocked');
    sessionStorage.setItem(sessionKey, 'essai');
    const { activeDbName, dbNameFor } = await import(new URL('modules/child-profiles.js', location.href).href);
    return {
      activeDb: activeDbName(),
      childDb: dbNameFor('neutral-enfant'),
      localKey: KalimatiStorage.storageKey('e2e-marqueur'),
      sessionKey,
      rawLocal: {
        main: localStorage.getItem('e2e-marqueur'),
        trial: localStorage.getItem('essai-e2e-marqueur'),
      },
      rawSession: {
        main: sessionStorage.getItem('kalimati_super_admin_unlocked'),
        trial: sessionStorage.getItem('essai-kalimati_super_admin_unlocked'),
      },
      databases: (await indexedDB.databases()).map((entry) => entry.name).sort(),
    };
  });
  expect(trial.activeDb).toBe('essai-kalimati');
  expect(trial.childDb).toBe('essai-kalimati-child-neutral-enfant');
  expect(trial.localKey).toBe('essai-e2e-marqueur');
  expect(trial.sessionKey).toBe('essai-kalimati_super_admin_unlocked');
  expect(trial.rawLocal).toEqual({ main: 'principal', trial: 'essai' });
  expect(trial.rawSession).toEqual({ main: 'principal', trial: 'essai' });
  expect(trial.databases).toEqual(expect.arrayContaining(['kalimati', 'essai-kalimati']));

  await page.goto('/');
  const backToMain = await page.evaluate(() => ({
    local: localStorage.getItem('e2e-marqueur'),
    trialLocal: localStorage.getItem('essai-e2e-marqueur'),
    session: sessionStorage.getItem('kalimati_super_admin_unlocked'),
    trialSession: sessionStorage.getItem('essai-kalimati_super_admin_unlocked'),
  }));
  expect(backToMain).toEqual({
    local: 'principal',
    trialLocal: 'essai',
    session: 'principal',
    trialSession: 'essai',
  });
});

test('badge d’essai — absent du site principal et visible seulement en mode parent d’essai', async ({ page }) => {
  await openTalkGrid(page);
  await expect(page.locator('#trial-badge')).toBeHidden();

  await openTrialTalkGrid(page);
  await expect(page.locator('#trial-badge')).toBeHidden();
  await unlockParent(page);
  await expect(page.locator('#trial-badge')).toBeVisible();
  await expect(page.locator('#trial-badge')).toHaveText('Version d’essai');

  await page.waitForTimeout(1600);
  await page.locator('#lock').click();
  await expect(page.locator('body')).not.toHaveClass(/\bparent\b/);
  await expect(page.locator('#trial-badge')).toBeHidden();
});

test('cloud d’essai — Mode équipe actif, commandes grisées et aucun départ Supabase', async ({ page }) => {
  const observedRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).hostname.endsWith('.supabase.co')) observedRequests.push(request.url());
  });
  await page.addInitScript(() => {
    window.__e2eCloudRequests = [];
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (url.hostname.endsWith('.supabase.co')) {
        window.__e2eCloudRequests.push(url.href);
        return Promise.reject(new TypeError('Cloud bloqué par le scénario E2E.'));
      }
      return nativeFetch(input, init);
    };
  });

  await openTrialTalkGrid(page);
  await page.evaluate(async (marker) => {
    const db = await import(new URL('db.js', location.href).href);
    await db.setSetting('cloudSyncConfig', {
      supabaseUrl: 'https://neutral.invalid',
      supabaseAnonKey: 'neutral',
      familyKey: marker,
      autoSyncWifi: true,
      includeMedia: true,
    });
    await db.setSetting('clinicalCohortOptIn', true);
  }, CLOUD_MARKER);
  await openTrialTalkGrid(page);
  await unlockParent(page);
  await openProgress(page);
  await openDetails(page, 'Réseau : Socle Clinique strict');

  const team = page.getByRole('checkbox', { name: /J’active le « Mode équipe »/ });
  await team.check();
  await expect(team).toBeChecked();
  await expect(page.getByText(/Mode équipe activé/)).toBeVisible();

  await openDetails(page, 'Synchronisation Équipe Zero-Knowledge');
  await openDetails(page, 'Paramètres de connexion Cloud Zero-Knowledge');
  await expect(page.locator('.sync-status')).toContainText('Version d’essai');
  for (const name of [
    /Synchroniser maintenant avec l’équipe/,
    /Retirer mes scores de l’étude/,
    /Effacer notre paquet chiffré du serveur/,
    /Copier le lien magique/,
    /Copier la clé seule/,
    /Consigne WhatsApp/,
    /Enregistrer la configuration Cloud/,
  ]) {
    await expect(page.getByRole('button', { name })).toBeDisabled();
  }
  for (const name of [
    /Synchroniser automatiquement en arrière-plan/,
    /Inclure exceptionnellement les photos et voix/,
    /Je consens à participer à l’étude clinique/,
  ]) {
    await expect(page.getByRole('checkbox', { name })).toBeDisabled();
  }
  await expect(page.getByLabel(/Clé secrète familiale AES-256/)).toBeDisabled();
  await expect(page.getByLabel(/URL du projet Supabase/)).toBeDisabled();
  await expect(page.getByLabel(/Clé publique Supabase/)).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: /Je consens à participer à l’étude clinique/ })).not.toBeChecked();
  await expect(page.getByRole('button', { name: /Exporter le rapport clinique pseudonymisé/ })).toBeEnabled();

  const refusals = await page.evaluate(async (marker) => {
    const cloud = await import(new URL('modules/cloud-sync.js', location.href).href);
    const actions = [
      () => cloud.syncNowWithTeam({ includeMedia: true }),
      () => cloud.withdrawClinicalCohortData(),
      () => cloud.deleteEncryptedRelayBundle(),
      () => cloud.saveCloudSyncConfig({ familyKey: marker }),
    ];
    const messages = [];
    for (const action of actions) {
      try {
        await action();
        messages.push('ACTION_ACCEPTED');
      } catch (error) {
        messages.push(error.message);
      }
    }
    return { messages, config: await cloud.getCloudSyncConfig() };
  }, CLOUD_MARKER);
  expect(refusals.messages).toEqual(Array(4).fill(
    'Version d’essai : synchronisation et cohorte désactivées. Les données restent sur cet appareil.',
  ));
  expect(refusals.config).toEqual({
    supabaseUrl: '',
    supabaseAnonKey: '',
    familyKey: '',
    autoSyncWifi: false,
    includeMedia: false,
  });
  expect(await page.evaluate(() => window.__e2eCloudRequests)).toEqual([]);
  expect(observedRequests).toEqual([]);
});

test('clé magique d’essai — le fragment est purgé sans stockage ni transport', async ({ page }) => {
  const marker = 'KALI-TEST-TEST-TEST';
  const requestUrls = [];
  page.on('request', (request) => requestUrls.push(request.url()));
  await page.goto(`/essai/#key=${marker}&keep=neutral`);
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#keep=neutral');

  const stored = await page.evaluate(async (magicMarker) => {
    const cloud = await import(new URL('modules/cloud-sync.js', location.href).href);
    const db = await import(new URL('db.js', location.href).href);
    const local = Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)]));
    const session = Object.fromEntries(Object.keys(sessionStorage).map((key) => [key, sessionStorage.getItem(key)]));
    const settings = await Promise.all([
      db.getSetting('cloudSyncConfig'),
      db.getSetting('clinicalCohortOptIn'),
    ]);
    return JSON.stringify({ local, session, settings, config: await cloud.getCloudSyncConfig() });
  }, marker);
  expect(stored).not.toContain(marker);
  expect(requestUrls.every((url) => !url.includes(marker))).toBe(true);
  expect(await page.evaluate(async () => {
    const cloud = await import(new URL('modules/cloud-sync.js', location.href).href);
    return cloud.captureMagicKeyFromUrl();
  })).toBeNull();
});

test('/essai redirige vers /essai/', async ({ page, baseURL }) => {
  const response = await page.request.get('/essai', { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe('/essai/');
  await page.goto('/essai');
  expect(page.url()).toBe(new URL('/essai/', baseURL).href);
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
});

test('service workers — le worker principal réel ignore /essai/ et les deux caches coexistent', async ({ page, baseURL }, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-5-chromium',
    'service workers : Chromium seulement (décision D-2)');
  test.setTimeout(90_000);
  await openTalkGrid(page);
  await waitCachedApp(page);
  await expect.poll(() => page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration('/'))?.active?.scriptURL || '')).toMatch(/\/sw\.js$/);
  await page.reload();
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL || '')).toMatch(/\/sw\.js$/);
  const before = await stableCacheEntries(page, MAIN_CACHE);
  expect(before.length).toBeGreaterThan(0);

  await openTrialTalkGrid(page);
  await expect.poll(() => trialCacheName(page)).toBe(TRIAL_CACHE);
  await expect.poll(() => trialController(page)).toMatch(/\/essai\/sw\.js$/);
  expect(await page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration('/essai/'))?.scope)).toBe(new URL('/essai/', baseURL).href);
  await expect.poll(() => cacheEntries(page, MAIN_CACHE)).toEqual(before);
  expect((await cacheEntries(page, MAIN_CACHE)).some((url) => new URL(url).pathname.startsWith('/essai/'))).toBe(false);
  expect(await cacheEntries(page, TRIAL_CACHE)).toEqual(expect.arrayContaining([
    new URL('/essai/index.html', baseURL).href,
    new URL('/essai/app.js', baseURL).href,
  ]));

  await openTalkGrid(page);
  expect(await page.evaluate(async (names) => {
    const present = await Promise.all(names.map((name) => caches.has(name)));
    return present.every(Boolean);
  }, [MAIN_CACHE, TRIAL_CACHE])).toBe(true);
});

test('G0 navigateur — le worker principal v10.54 ignore /essai/ sans worker d’essai', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-5-chromium',
    'service workers : Chromium seulement (décision D-2)');
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = (url, options) => {
      if (new URL(url, location.href).pathname === '/essai/sw.js') {
        return Promise.reject(new TypeError('worker d’essai bloqué par le scénario G0'));
      }
      return register(url, options);
    };
  });
  const source = readFileSync(new URL('../../sw.js', import.meta.url), 'utf8');
  const withoutInstall = source.replace(/self\.addEventListener\('install', \(event\) => \{[\s\S]*?\n\}\);/, `self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map((file) => new Request(file, { cache: 'no-cache' })));
  })());
});`);
  if (withoutInstall === source) throw new Error('Le gestionnaire install du worker courant n’a pas été isolé.');
  const cleanup = await installMainWorkerFixture(page, withoutInstall, 'current');
  try {
    await openTalkGrid(page);
    await waitCachedApp(page);
    const before = await stableCacheEntries(page, MAIN_CACHE);
    expect(before.length).toBeGreaterThan(0);

    await openTrialTalkGrid(page);
    expect(await trialController(page)).toMatch(/\.main-worker-fixture-\d+-current\.js$/);
    expect(await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration('/essai/'))?.scope || '')).not.toMatch(/\/essai\/$/);
    expect(await trialCacheName(page)).toBeNull();

    const statuses = await page.evaluate(async () => {
      const paths = [
        '/essai/?g0=sonde',
        '/essai/index.html?g0=sonde',
        '/essai/app.js?g0=sonde',
      ];
      const observed = [];
      for (let repetition = 0; repetition < 2; repetition += 1) {
        for (const path of paths) {
          const response = await fetch(path, { cache: 'no-store' });
          observed.push(response.status);
          await response.arrayBuffer();
        }
      }
      return observed;
    });
    expect(statuses).toEqual(Array(6).fill(200));
    await expect.poll(() => cacheEntries(page, MAIN_CACHE)).toEqual(before);
    expect((await cacheEntries(page, MAIN_CACHE)).some((url) => new URL(url).pathname.startsWith('/essai/'))).toBe(false);
    console.log(`G0 Chromium : ${before.length} entrées principales inchangées, aucun worker ni cache d’essai.`);
  } finally {
    cleanup();
  }
});

test('G0 — un worker principal v10.45 déjà actif met encore /essai/ dans son cache', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'pixel-5-chromium',
    'service workers : Chromium seulement (décision D-2)');
  test.setTimeout(90_000);
  // Le préchauffage historique de 771 fichiers optionnels peut rester bloqué dans Chromium sans interface ;
  // G0 porte sur son gestionnaire fetch, conservé ici à l'identique.
  const historicalSource = execFileSync('git', ['show', `${HISTORICAL_REVISION}:sw.js`], { encoding: 'utf8' })
    .replace(/self\.addEventListener\('install', \(event\) => \{[\s\S]*?\n\}\);/, `self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map((file) => new Request(file, { cache: 'no-cache' })));
  })());
});`);
  const cleanup = await installMainWorkerFixture(page, historicalSource, 'historical');
  try {
    await openTalkGrid(page);
    await waitCachedApp(page);
    const before = await stableCacheEntries(page, HISTORICAL_CACHE);
    expect(before.length).toBeGreaterThan(0);

    await openTrialTalkGrid(page);
    await expect.poll(() => trialController(page)).toMatch(/\/essai\/sw\.js$/);
    await expect.poll(async () => (await cacheEntries(page, HISTORICAL_CACHE))
      .some((url) => new URL(url).pathname.startsWith('/essai/'))).toBe(true);
    const after = await cacheEntries(page, HISTORICAL_CACHE);
    expect(after.length).toBeGreaterThan(before.length);
    expect(await page.evaluate((name) => caches.has(name), HISTORICAL_CACHE)).toBe(true);
    expect(await trialCacheName(page)).toBe(TRIAL_CACHE);
    console.log(`G0 reproduit : ${after.length - before.length} entrées /essai/ ajoutées au cache v10.45 avant la prise de main du worker d’essai.`);
  } finally {
    cleanup();
  }
});
