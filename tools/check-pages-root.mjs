import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const LIVE_ORIGIN = 'https://elguellouchi.github.io';
const LIVE_PATH = '/Kalimati/';

export function mainWorkerIgnoresTrial(source) {
  const listeners = new Map();
  let transportCalls = 0;
  const networkResponse = { ok: true, clone() { return this; } };
  const cache = { put: async () => { transportCalls += 1; } };
  const context = {
    self: {
      location: { origin: LIVE_ORIGIN, pathname: '/Kalimati/sw.js' },
      addEventListener: (name, handler) => listeners.set(name, handler),
    },
    URL,
    Request,
    Headers,
    Response,
    setTimeout,
    clearTimeout,
    fetch: async () => { transportCalls += 1; return networkResponse; },
    caches: {
      match: async () => { transportCalls += 1; return null; },
      open: async () => { transportCalls += 1; return cache; },
    },
  };

  try {
    vm.runInNewContext(String(source), context, { filename: 'sw.js', timeout: 1000 });
    const handler = listeners.get('fetch');
    if (typeof handler !== 'function') return false;
    const dispatch = (pathname) => {
      let intercepted = false;
      let pending;
      handler({
        request: new Request(`${LIVE_ORIGIN}${pathname}`),
        respondWith(value) {
          intercepted = true;
          pending = Promise.resolve(value);
        },
        waitUntil() {},
      });
      return { intercepted, pending };
    };

    for (const pathname of [
      '/Kalimati/essai/',
      '/Kalimati/essai',
      '/Kalimati/essai/app.js',
      '/Kalimati/enfants/essai/cartes',
    ]) {
      const result = dispatch(pathname);
      if (result.intercepted) {
        result.pending?.catch(() => {});
        return false;
      }
    }
    if (transportCalls !== 0) return false;

    for (const pathname of ['/Kalimati/', '/Kalimati/essai-copie/']) {
      const result = dispatch(pathname);
      if (!result.intercepted) return false;
      result.pending?.catch(() => {});
    }
    return true;
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
    const guarded = mainWorkerIgnoresTrial(mainWorker);
    different ||= !guarded;
    console.log(`${guarded ? 'OK' : 'BLOQUÉ'} G0 — comportement fetch du worker principal sur /essai/`);
  }

  if (different) {
    console.error('Publication bloquée : différence octet par octet ou G0 non résolu.');
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
