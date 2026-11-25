import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

assert.ok(fs.existsSync(path.join(ROOT, 'modules/voice-cache.js')), 'modules/voice-cache.js doit exister');

const storageSource = read('modules/storage.js');
const voiceSource = read('modules/voice-cache.js');
const profilesSource = read('modules/child-profiles.js');
const voicePacks = read('modules/voice-packs.js');
const admin = read('modules/admin-beta.js');
const sw = read('sw.js');

function load(pathname) {
  const memory = new Map();
  const context = {
    location: { pathname },
    localStorage: {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, String(value)),
      removeItem: (key) => memory.delete(key),
    },
  };
  context.globalThis = context;
  vm.runInNewContext(storageSource, context);
  vm.runInNewContext(`${voiceSource.replace(/^import .*$/gm, '').replace(/^export /gm, '')}\nglobalThis.voiceCachePrefix = voiceCachePrefix;`, context);
  vm.runInNewContext(`${profilesSource.replace(/^import .*$/gm, '').replace(/^export /gm, '')}\nglobalThis.testProfiles = { perChildKey };`, context);
  vm.runInNewContext(`${voicePacks.replace(/^import .*$/gm, '').replace(/^export /gm, '')}\nglobalThis.testVoices = { VOICE_CACHE_PREFIX, packCacheName, parentCacheName };`, context);
  vm.runInNewContext(`${admin.replace(/^import .*$/gm, '').replace(/^export \{.*\};\s*$/gm, '').replace(/^export /gm, '')}\nglobalThis.testAdmin = { BASE_APP_URL, SESSION_KEY, buildInviteUrl, buildTeamUrl };`, context);
  return context;
}

const main = load('/Kalimati/');
const trial = load('/Kalimati/essai/');
const similarPath = load('/Kalimati/essai-copie/');

assert.equal(main.voiceCachePrefix(), 'kalimati-amazigh-voices-');
assert.equal(trial.voiceCachePrefix(), 'kalimati-essai-amazigh-voices-');
assert.equal(similarPath.voiceCachePrefix(), 'kalimati-amazigh-voices-');
assert.equal(main.testVoices.VOICE_CACHE_PREFIX, 'kalimati-amazigh-voices-');
assert.equal(trial.testVoices.VOICE_CACHE_PREFIX, 'kalimati-essai-amazigh-voices-');
assert.equal(main.testVoices.packCacheName('shi'), 'kalimati-amazigh-voices-shi');
assert.equal(trial.testVoices.packCacheName('shi'), 'kalimati-essai-amazigh-voices-shi');
assert.equal(main.testVoices.parentCacheName('shi'), 'kalimati-amazigh-voices-parent-shi');
assert.equal(trial.testVoices.parentCacheName('shi'), 'kalimati-essai-amazigh-voices-parent-shi');

trial.KalimatiStorage.setItem('kalimati-children', JSON.stringify([
  { id: 'main', name: '', emoji: '🙂' },
  { id: 'c12345', name: 'Profil test', emoji: '○' },
]));
trial.KalimatiStorage.setItem('kalimati-active-child', 'c12345');
assert.equal(trial.testVoices.parentCacheName('shi'), 'kalimati-essai-amazigh-voices-parent-shi:c12345');

assert.equal(main.testAdmin.BASE_APP_URL, 'https://elguellouchi.github.io/Kalimati/');
assert.equal(trial.testAdmin.BASE_APP_URL, 'https://elguellouchi.github.io/Kalimati/essai/');
assert.equal(main.testAdmin.buildInviteUrl('KALI-TEST'), 'https://elguellouchi.github.io/Kalimati/?invite=KALI-TEST');
assert.equal(trial.testAdmin.buildInviteUrl('KALI-TEST'), 'https://elguellouchi.github.io/Kalimati/essai/?invite=KALI-TEST');
assert.equal(trial.testAdmin.buildTeamUrl('KALI-TEST-AVS'), 'https://elguellouchi.github.io/Kalimati/essai/?team=KALI-TEST-AVS');
assert.equal(main.testAdmin.SESSION_KEY, 'kalimati_super_admin_unlocked');
assert.equal(trial.testAdmin.SESSION_KEY, 'essai-kalimati_super_admin_unlocked');

assert.match(voicePacks, /import \{ voiceCachePrefix \} from '\.\/voice-cache\.js'/);
assert.match(voicePacks, /export const VOICE_CACHE_PREFIX = voiceCachePrefix\(\)/);
assert.match(profilesSource, /const VOICE_PREFIX = \(\) => voiceCachePrefix\(\)/);
assert.match(admin, /const SESSION_KEY = storageKey\('kalimati_super_admin_unlocked'\)/);
assert.equal((admin.match(/sessionStorage\.(?:getItem|setItem|removeItem)\(SESSION_KEY/g) || []).length, 4);
assert.doesNotMatch(admin, /sessionStorage\.(?:getItem|setItem|removeItem)\('kalimati_super_admin_unlocked'\)/);
assert.match(admin, /isTrial\(\)\s*\?\s*'https:\/\/elguellouchi\.github\.io\/Kalimati\/essai\/'/);
assert.match(sw, /'\.\/modules\/voice-cache\.js'/);

console.log('test-voice-cache : OK');
