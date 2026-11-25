import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const LIVE_ORIGIN = 'https://elguellouchi.github.io';
const LIVE_PATH = '/Kalimati/';

export async function mainWorkerIgnoresTrial(source) {
  const fetchListeners = [];
  const sideEffects = [];
  const cache = {
    put: async () => { sideEffects.push('cache.put'); },
    add: async () => { sideEffects.push('cache.add'); },
    addAll: async () => { sideEffects.push('cache.addAll'); },
  };
  const context = vm.createContext({
    URL,
    URLSearchParams,
    Request,
    Response,
    Headers,
    AbortController,
    AbortSignal,
    TextEncoder,
    TextDecoder,
    atob,
    btoa,
    crypto,
    performance,
    queueMicrotask,
    console,
    location: new URL(`${LIVE_ORIGIN}${LIVE_PATH}sw.js`),
    navigator: {
      userAgent: 'Kalimati-G0-check',
      serviceWorker: {
        controller: null,
        ready: Promise.resolve(null),
        register: async () => null,
        addEventListener() {},
        removeEventListener() {},
      },
    },
    clients: {
      claim: async () => {},
      get: async () => null,
      matchAll: async () => [],
      openWindow: async () => null,
    },
    registration: {
      scope: `${LIVE_ORIGIN}${LIVE_PATH}`,
      update: async () => {},
      unregister: async () => true,
    },
    skipWaiting: async () => {},
    onfetch: null,
    addEventListener(type, listener) {
      if (type === 'fetch' && typeof listener === 'function') fetchListeners.push(listener);
    },
    removeEventListener(type, listener) {
      if (type !== 'fetch') return;
      const index = fetchListeners.indexOf(listener);
      if (index >= 0) fetchListeners.splice(index, 1);
    },
    setTimeout: (callback, delay = 0, ...args) => setTimeout(callback, Math.min(delay, 10), ...args),
    clearTimeout,
    fetch: async (input) => {
      sideEffects.push(`fetch:${input.url || input}`);
      return new Response('ok', { status: 200, headers: { 'Content-Type': 'application/javascript' } });
    },
    caches: {
      match: async () => { sideEffects.push('caches.match'); return null; },
      open: async () => { sideEffects.push('caches.open'); return cache; },
      keys: async () => { sideEffects.push('caches.keys'); return []; },
      has: async () => { sideEffects.push('caches.has'); return false; },
      delete: async () => { sideEffects.push('caches.delete'); return false; },
    },
  });
  vm.runInContext('globalThis.self = globalThis;', context);

  const settle = async (promises) => {
    let timer;
    try {
      return await Promise.race([
        Promise.allSettled(promises),
        new Promise((resolve) => { timer = setTimeout(() => resolve(null), 2000); }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };

  const dispatch = async (pathname, init = {}) => {
    sideEffects.length = 0;
    let intercepted = false;
    let respondWithCalls = 0;
    let waitUntilCalls = 0;
    let invalid = false;
    const pending = [];
    const { mode, ...requestInit } = init;
    const request = new Request(`${LIVE_ORIGIN}${pathname}`, requestInit);
    if (mode) Object.defineProperty(request, 'mode', { value: mode });
    const event = {
      request,
      respondWith(value) {
        respondWithCalls += 1;
        if (respondWithCalls > 1) invalid = true;
        intercepted = true;
        pending.push(Promise.resolve(value));
      },
      waitUntil(value) {
        waitUntilCalls += 1;
        pending.push(Promise.resolve(value));
      },
    };
    for (const listener of [...fetchListeners]) {
      try {
        pending.push(Promise.resolve(listener(event)));
      } catch {
        invalid = true;
      }
    }
    await Promise.resolve();
    const settled = await settle(pending);
    return {
      intercepted,
      respondWithCalls,
      waitUntilCalls,
      invalid: invalid || settled === null,
      sideEffects: [...sideEffects],
    };
  };

  try {
    vm.runInContext(String(source), context, { filename: 'sw.js', timeout: 1000 });
    if (context.onfetch !== null && context.onfetch !== undefined) return false;
    if (vm.runInContext('TRIAL', context) !== false) return false;
    if (fetchListeners.length === 0) return false;

    const trialProbes = [
      ['/Kalimati/essai/', {}],
      ['/Kalimati/essai', {}],
      ['/Kalimati/essai/index.html', {}],
      ['/Kalimati/essai/app.js', {}],
      ['/Kalimati/enfants/essai/cartes', {}],
      ['/Kalimati/essai/g0-sonde-non-liste.js', {}],
      ['/Kalimati/essai/?g0=sonde', { cache: 'no-store' }],
      ['/Kalimati/essai/', { mode: 'navigate' }],
      ['/Kalimati/essai/voix/fr/g0-sonde.mp3', { headers: { Range: 'bytes=0-1' } }],
    ];
    for (let repetition = 0; repetition < 2; repetition += 1) {
      for (const [pathname, init] of trialProbes) {
        const result = await dispatch(pathname, init);
        if (result.invalid || result.intercepted || result.respondWithCalls || result.waitUntilCalls || result.sideEffects.length) return false;
      }
    }

    for (const [pathname, init] of [
      ['/Kalimati/', {}],
      ['/Kalimati/', { mode: 'navigate' }],
      ['/Kalimati/app.js', {}],
      ['/Kalimati/essai-copie/', {}],
    ]) {
      const result = await dispatch(pathname, init);
      if (result.invalid || !result.intercepted || result.respondWithCalls !== 1) return false;
    }
    return context.onfetch === null && vm.runInContext('TRIAL', context) === false;
  } catch {
    return false;
  }
}

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  const value = process.argv[index + 1];
  if (index < 0 || !value || value.startsWith('--')) throw new Error(`--${name} manquant`);
  return value;
}

async function main() {
  const site = resolve(option('site'));
  const live = new URL(option('live'));
  if (live.origin !== LIVE_ORIGIN || live.pathname !== LIVE_PATH || live.search || live.hash) {
    throw new Error(`--live doit être ${LIVE_ORIGIN}${LIVE_PATH}`);
  }
  const requireMainGuard = process.argv.includes('--require-main-guard');
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  let different = false;
  let mainWorker = null;

  for (const name of ['sw.js', 'index.html']) {
    const [local, response] = await Promise.all([
      readFile(join(site, name)),
      fetch(new URL(name, live), { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30_000) }),
    ]);
    if (!response.ok) throw new Error(`site public indisponible : ${name}`);
    const remote = Buffer.from(await response.arrayBuffer());
    if (name === 'sw.js') mainWorker = local.toString('utf8');
    const same = local.equals(remote);
    different ||= !same;
    console.log(`${same ? 'OK' : 'DIFFÉRENT'} ${name} local=${local.length}/${hash(local)} public=${remote.length}/${hash(remote)}`);
  }

  if (requireMainGuard) {
    const guarded = await mainWorkerIgnoresTrial(mainWorker);
    different ||= !guarded;
    console.log(`${guarded ? 'OK' : 'BLOQUÉ'} G0 — comportement fetch du worker principal sur /essai/`);
  }

  if (different) {
    console.error(requireMainGuard
      ? 'Publication bloquée : différence octet par octet ou G0 non résolu.'
      : 'Publication bloquée : différence octet par octet.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
