import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const cloudSource = readFileSync(new URL('../modules/cloud-sync.js', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const magicMarker = 'KALI-NEUTRAL-TEST-MARKER';
const refusalMessage = 'Version d’essai : synchronisation et cohorte désactivées. Les données restent sur cet appareil.';
const isRefusal = (error) => error?.message === refusalMessage;
const writes = [];
const diagnostics = [];
let reads = 0;
let fetchCalls = 0;

const context = {
  location: { pathname: '/Kalimati/essai/', search: '', hash: `#key=${magicMarker}`, origin: 'http://127.0.0.1:4173' },
  history: {
    replaceState: (_state, _title, url) => {
      const next = new URL(url, context.location.origin);
      context.location.pathname = next.pathname;
      context.location.search = next.search;
      context.location.hash = next.hash;
    },
  },
  KalimatiStorage: { isTrial: () => true },
  isTeamMode: () => true,
  requireTeamMode: () => true,
  logDiagnostic: (type, detail, meta) => diagnostics.push({ type, detail, meta }),
  db: {
    getSetting: async () => { reads += 1; return null; },
    setSetting: async (key, value) => { writes.push({ key, value }); },
  },
  fetch: async () => { fetchCalls += 1; throw new Error('réseau interdit en essai'); },
  profile: {},
  clinic: {},
  navigator: { onLine: true },
  crypto: globalThis.crypto,
  TextEncoder,
  TextDecoder,
  Uint8Array,
  Blob,
  URL,
  btoa,
  atob,
  setTimeout,
  clearTimeout,
};
context.window = context;
vm.createContext(context);
vm.runInContext(cloudSource.replace(/^import .*;$/gm, '').replace(/^export /gm, ''), context);

assert.equal(context.captureMagicKeyFromUrl(), null, 'La clé magique ne doit jamais être retournée en essai');
assert.equal(context.location.hash, '', 'Le fragment #key= doit quitter l’adresse');
assert.equal(context.captureMagicKeyFromUrl(), null, 'La clé magique ne doit pas rester en attente');
assert.equal(context.location.pathname, '/Kalimati/essai/', 'La purge ne doit pas réécrire le chemin');

context.location.hash = '#key=neutral%20custom%20key&keep=neutral';
assert.equal(context.captureMagicKeyFromUrl(), null, 'Une clé personnalisée ne doit pas être retournée en essai');
assert.equal(context.location.hash, '#keep=neutral', 'Une clé personnalisée encodée doit être retirée de l’adresse');
assert.equal(context.location.pathname, '/Kalimati/essai/', 'La clé personnalisée ne doit pas passer dans le chemin');

context.location.hash = '#key=KALI-NEUTRAL-FIRST&key=KALI-NEUTRAL-SECOND&keep=neutral';
assert.equal(context.captureMagicKeyFromUrl(), null, 'Plusieurs clés magiques ne doivent pas être retournées en essai');
assert.equal(context.location.hash, '#keep=neutral', 'Tous les paramètres key doivent être retirés de l’adresse');
assert.equal(context.location.pathname, '/Kalimati/essai/', 'Les clés multiples ne doivent pas passer dans le chemin');

assert.equal(writes.length, 0, 'La capture de la clé ne doit rien écrire');
assert.equal(reads, 0, 'La capture de la clé ne doit rien lire');

await assert.rejects(context.syncNowWithTeam({ includeMedia: false }), isRefusal);
await assert.rejects(context.rpcDelete('neutral_test'), isRefusal);
await assert.rejects(context.withdrawClinicalCohortData(), isRefusal);
await assert.rejects(context.deleteEncryptedRelayBundle(), isRefusal);
await assert.rejects(context.fetchWithTimeout('https://neutral.invalid/test'), isRefusal);
await assert.rejects(context.supabaseFetch('https://neutral.invalid/test', 'neutral'), isRefusal);
await assert.rejects(context.saveCloudSyncConfig({ familyKey: 'neutral' }), isRefusal);

assert.deepEqual({ ...(await context.getCloudSyncConfig()) }, {
  supabaseUrl: '',
  supabaseAnonKey: '',
  familyKey: '',
  autoSyncWifi: false,
  includeMedia: false,
});
assert.equal(await context.initCloudSyncFromUrlAndAuto(), null, 'Le démarrage cloud doit sortir immédiatement en essai');
assert.equal(fetchCalls, 0, 'Aucune requête réseau ne doit partir de l’essai');
assert.equal(writes.length, 0, 'Aucune configuration cloud ne doit être écrite en essai');
assert.equal(reads, 0, 'Aucune configuration cloud ne doit être lue en essai');
assert.ok(diagnostics.length >= 7, 'Chaque refus cloud doit être journalisé localement');
assert.ok(diagnostics.every((entry) => entry.detail === refusalMessage), 'Le journal doit recevoir uniquement le message de refus fixe');
assert.ok(!JSON.stringify(diagnostics).includes(magicMarker), 'La clé magique ne doit jamais entrer dans le journal');
assert.match(appSource, /if \(!KalimatiStorage\.isTrial\(\)\) initCloudSyncFromUrlAndAuto\(\)\.catch\(\(\) => \{\}\);/,
  'Le démarrage automatique doit être neutralisé en essai');

console.log('✅ Version d’essai : Supabase et la cohorte sont refusés avant lecture, écriture et transport.');
