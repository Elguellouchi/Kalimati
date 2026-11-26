# Version d’essai isolée — plan d’implémentation

> **Pour les agents implémenteurs :** utiliser `superpowers:executing-plans` pour exécuter les tâches dans l’ordre. Chaque case cochée correspond à une action vérifiée. Les tests sont écrits avant le code de production.

**Objectif :** livrer L0-05, L0-06 et L0-12 : une version d’essai sous `/Kalimati/essai/`, avec stockage et caches isolés, Supabase et cohorte indisponibles, badge parent discret et artefact Pages combiné préservant la racine principale.

**Architecture :** un seul code source détermine l’espace courant avec `KalimatiStorage.isTrial()`. Les noms IndexedDB, clés, caches vocaux et permissions cloud sont dérivés de ce prédicat. Le service worker déduit son espace de son propre chemin ; la racine reste servie depuis `main` et l’essai depuis `essai`.

**Pile technique :** JavaScript natif, modules ES, IndexedDB, CacheStorage, service workers, Node sans dépendance runtime, Playwright déjà installé, GitHub Actions.

**Spec :** `docs/plans/lot-0-essai-spec.md`.

## Contraintes globales

- Clone autoritatif : `C:\Users\HP\Projets\kalimati-qoder`.
- Branche de travail : `lot-0-essai-isole`, créée depuis `origin/essai` à `43f39e5`.
- `c3060ab` reste un ancêtre ; vérification : `git merge-base --is-ancestor c3060ab HEAD`.
- Version cible : `v10.47`, package `10.47`, caches `kalimati-v10-47` et `kalimati-essai-v10-47`.
- Bases cibles : `kalimati`, `kalimati-child-<id>`, `essai-kalimati`, `essai-kalimati-child-<id>`.
- Caches vocaux : `kalimati-amazigh-voices-…` et `kalimati-essai-amazigh-voices-…`.
- Aucun vrai prénom d’enfant, photo, voix, phrase, secret ou identifiant Supabase dans les ajouts.
- Aucune dépendance runtime, aucun bundler, aucune modification de CSP, aucune nouvelle requête externe.
- Aucun `skipWaiting()` automatique, aucun rechargement spontané.
- Toute nouvelle prise d’erreur est journalisée localement avec `logDiagnostic()`, sans URL, secret ou donnée d’enfant.
- Toutes les clés localStorage passent par `KalimatiStorage.storageKey()`.
- Un segment de chemin exact `essai` active l’essai ; `/essai-copie/` reste principal.
- Le Mode équipe ne réautorise jamais Supabase ni la cohorte en essai.
- L’export clinique JSON local reste actif en essai.
- Pas de push vers `main`, pas de force-push, pas de réécriture d’historique.
- Ajouter uniquement des chemins nommés ; ne jamais ajouter `Agent.md`, les transcriptions ou un dossier de test.
- Le changement du réglage Pages et la fusion de la PR d’essai restent interdits avant l’accord explicite de l’utilisateur.

## Porte de publication G0 — contradiction à traiter avant tout déploiement

Les trois exigences suivantes ne peuvent pas être vraies simultanément avec l’état actuel de `origin/main` :

1. la racine de l’artefact vient de `main` ;
2. `sw.js` et `index.html` de cette racine sont identiques octet par octet au site actuel ;
3. un navigateur ayant le worker principal `v10.45` encore actif ouvre `/essai/` sans ajouter quoi que ce soit au cache principal.

Le worker `v10.45` publié n’a pas la garde `/essai/` et met en cache les navigations réussies. Un worker déjà actif ne peut pas apprendre rétroactivement la nouvelle garde. Mettre à jour le worker avant la première navigation résout le risque, mais change les octets de `sw.js` par rapport au site actuel.

**Décision d’exécution :**

- Le code, les tests locaux, la construction de l’artefact et la PR vers `essai` peuvent avancer.
- Le workflow de déploiement reste une porte manuelle : il ne publie pas si la comparaison avec le site échoue ou si le worker principal servi n’a pas la garde `/essai/`.
- Le test de migration couvre le cas réaliste suivant : le navigateur a d’abord installé `v10.45`, puis le worker principal gardé est activé, puis `/essai/` est ouvert. Il vérifie que l’ancien cache principal reste inchangé et que le worker d’essai prend le contrôle.
- Un test distinct prouve que le worker `v10.45` non gardé, encore actif, mettrait la navigation d’essai dans son cache. Ce test documente le risque ; il ne doit jamais servir à déclarer la publication sûre.
- Tant que `main` n’a pas été préparé avec un worker principal gardé et que la comparaison octet par octet n’est pas verte, le compte rendu final indique « publication bloquée par G0 ». Aucun réglage Pages ni workflow de publication n’est déclenché.

Mesures de référence du site actuel, à refaire avant publication :

| Fichier | Octets | SHA-256 | Constat |
|---|---:|---|---|
| `sw.js` | 12 552 | `b01489aa7dfcdb8325a3d30ebea48971d5b35a6d6ab7b6ea3e6e7923891dd197` | `kalimati-v10-45`, aucune garde `/essai/` |
| `index.html` | 4 713 | `3b72f539e969a61b1d08ab698feacecd3e64d18a9930d21de597ba79ae7f1c6c` | racine principale actuelle |

## Structure des fichiers

### Application

- `modules/storage.js` : prédicat d’essai et clés localStorage.
- `theme-boot.js`, `index.html`, `style.css` : classe précoce et badge parent.
- `modules/child-profiles.js` : noms IndexedDB, récupération et suppression limitées à l’espace.
- `modules/voice-cache.js` : préfixe vocal partagé, sans dépendance circulaire.
- `modules/voice-packs.js` : noms des caches de packs et de voix parentales.
- `modules/admin-beta.js` : session Super-Admin isolée et liens d’essai.
- `modules/version.js`, `sw.js`, `modules/app-update.js` : versions, caches, portée et garde principale.
- `modules/cloud-sync.js` : refus cloud avant configuration, stockage ou transport.
- `modules/team-mode.js` : explication du blocage cloud en essai.
- `package.json` : version et nouvelle porte de test.

### Tests et publication

- `tools/test-storage.mjs`, `tools/test-theme.mjs` : détection et badge.
- `tools/test-children-trial.mjs` : bases d’essai et opérations limitées.
- `tools/test-voice-cache.mjs` : caches vocaux et suppression de profil.
- `tools/test-version.mjs`, `tools/test-cache-scope.mjs` : versions, workers et nettoyage.
- `tools/test-trial-cloud.mjs` : refus cloud, clé magique et configuration inerte.
- `tools/test-pages-build.mjs` : artefact combiné et exclusions.
- `tools/build-pages.mjs` : construction de `_site`.
- `tools/serve.mjs` : `/essai/` local et artefact combiné.
- `tools/e2e/trial-isolation.spec.mjs`, `tools/e2e/trial-offline.spec.mjs` : parcours navigateur.
- `.github/workflows/pages.yml` : construction, contrôle et déploiement manuel.
- `docs/PUBLIER.md`, `docs/comptes-rendus/lot-0-essai.md` : procédure et preuves.

---

### Tâche 1 : détection d’essai et badge parent

**Fichiers :**

- Modifier : `modules/storage.js`
- Modifier : `theme-boot.js`
- Modifier : `index.html`
- Modifier : `style.css`
- Tester : `tools/test-storage.mjs`
- Tester : `tools/test-theme.mjs`

**Interfaces :**

- Consomme : chemin de `globalThis.location.pathname`.
- Produit : `KalimatiStorage.isTrial(): boolean`, classe `trial` sur `<html>`, sélecteur `html.trial body.parent .trial-badge`.

- [ ] **Étape 1 : écrire les tests rouges**

Ajouter dans `tools/test-storage.mjs`, après `loadStorage()` :

```js
for (const pathname of ['/essai/', '/Kalimati/essai/', '/foo/essai/']) {
  assert.equal(loadStorage(pathname, memoryStore()).isTrial(), true, `${pathname} active l’essai`);
}
for (const pathname of ['/essai-copie/', '/autre/', '/Kalimati/', '/']) {
  assert.equal(loadStorage(pathname, memoryStore()).isTrial(), false, `${pathname} reste principal`);
}
```

Ajouter dans `tools/test-theme.mjs` :

```js
check(/KalimatiStorage\.isTrial\(\)/.test(boot) && /classList\.add\(['"]trial['"]\)/.test(boot), 'theme-boot ajoute la classe trial dès le chargement');
check(/id="trial-badge"/.test(html), 'le badge statique Version d’essai existe');
check(/html\.trial body\.parent \.trial-badge\s*\{\s*display:\s*inline-flex/.test(css), 'le badge n’est visible qu’en mode parent d’essai');
```

- [ ] **Étape 2 : vérifier l’échec attendu**

```bash
node tools/test-storage.mjs
node tools/test-theme.mjs
```

Attendu : `isTrial is not a function`, puis absence de classe et de badge.

- [ ] **Étape 3 : implémenter le minimum**

Dans `modules/storage.js`, ajouter à l’objet gelé :

```js
isTrial() { return essai; },
```

Dans `theme-boot.js`, après la lecture centrale du thème :

```js
if (globalThis.KalimatiStorage && KalimatiStorage.isTrial()) {
  document.documentElement.classList.add('trial');
}
```

Dans `index.html`, juste après l’ouverture de la barre parent :

```html
<span id="trial-badge" class="trial-badge">Version d’essai</span>
```

Dans `style.css` :

```css
.trial-badge { display: none; align-items: center; min-height: 28px; padding: 3px 10px; border: 1px solid currentColor; border-radius: 999px; font-size: 13px; font-weight: 700; opacity: .78; }
html.trial body.parent .trial-badge { display: inline-flex; }
```

- [ ] **Étape 4 : vérifier le vert**

```bash
node tools/test-storage.mjs
node tools/test-theme.mjs
```

Attendu : les deux scripts sortent avec le code 0.

- [ ] **Étape 5 : committer**

```bash
git add modules/storage.js theme-boot.js index.html style.css tools/test-storage.mjs tools/test-theme.mjs
git commit -m "Isole la détection et le badge de la version d’essai"
```

### Tâche 2 : bases IndexedDB d’essai et récupération limitée

**Fichiers :**

- Modifier : `modules/child-profiles.js`
- Créer : `tools/test-children-trial.mjs`
- Modifier : `package.json`

**Interfaces :**

- Consomme : `KalimatiStorage.isTrial()`, identifiants enfant existants.
- Produit : `dbNameFor(id)`, `activeDbName()`, `recoverChildren()`, `removeChild(id)` limités à l’espace courant.

- [ ] **Étape 1 : écrire le test rouge**

Créer `tools/test-children-trial.mjs` :

```js
import assert from 'node:assert/strict';

globalThis.location = { pathname: '/Kalimati/essai/' };
const mem = new Map();
globalThis.localStorage = {
  getItem: (key) => mem.get(key) ?? null,
  setItem: (key, value) => mem.set(key, String(value)),
  removeItem: (key) => mem.delete(key),
};
await import('../modules/storage.js');
const profiles = await import('../modules/child-profiles.js');

assert.equal(profiles.activeDbName(), 'essai-kalimati');
const id = profiles.addChild('Profil test', '○', 1800000000000);
assert.equal(profiles.dbNameFor(id), `essai-kalimati-child-${id}`);

globalThis.indexedDB = {
  databases: async () => [
    { name: 'kalimati-child-c1111' },
    { name: `essai-kalimati-child-${id}` },
    { name: 'essai-kalimati-child-c2222' },
    { name: 'autre-kalimati-child-c3333' },
  ],
};
const recovered = await profiles.recoverChildren();
assert.deepEqual(recovered.map((child) => child.id).sort(), ['c2222', id, 'main'].sort());

const deleted = [];
const deletedCaches = [];
globalThis.caches = {
  keys: async () => [
    `kalimati-essai-amazigh-voices-parent-fr:${id}`,
    `kalimati-amazigh-voices-parent-fr:${id}`,
    'autre-cache',
  ],
  delete: async (name) => { deletedCaches.push(name); return true; },
};
globalThis.indexedDB.deleteDatabase = (name) => {
  deleted.push(name);
  return { set onsuccess(fn) { fn(); }, set onerror(fn) { fn(); }, set onblocked(fn) { fn(); } };
};
profiles.setActiveChild('main');
assert.equal(await profiles.removeChild(id), true);
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(deleted, [`essai-kalimati-child-${id}`]);
assert.deepEqual(deletedCaches, [`kalimati-essai-amazigh-voices-parent-fr:${id}`]);
console.log('test-children-trial : OK');
```

Ajouter `node tools/test-children-trial.mjs` à la chaîne `npm test`, juste après `test-children.mjs`.

- [ ] **Étape 2 : vérifier l’échec attendu**

```bash
node tools/test-children-trial.mjs
```

Attendu : la première base attendue est `essai-kalimati`, mais le code retourne `kalimati`.

- [ ] **Étape 3 : implémenter le minimum**

Dans `modules/child-profiles.js` :

```js
const trial = () => Boolean(globalThis.KalimatiStorage && KalimatiStorage.isTrial());
const CHILD_PREFIX = () => trial() ? 'essai-kalimati-child-' : 'kalimati-child-';
const VOICE_PREFIX = () => trial() ? 'kalimati-essai-amazigh-voices-' : 'kalimati-amazigh-voices-';

export const dbNameFor = (id) =>
  (!id || id === MAIN_ID
    ? (trial() ? 'essai-kalimati' : 'kalimati')
    : `${CHILD_PREFIX()}${id}`);
```

Remplacer le filtre de suppression vocale par :

```js
names.filter((name) => name.startsWith(VOICE_PREFIX()) && name.endsWith(`:${id}`))
```

Remplacer la récupération par un préfixe calculé une fois :

```js
const prefix = CHILD_PREFIX();
const names = (await indexedDB.databases())
  .map((database) => database.name)
  .filter((name) => name && name.startsWith(prefix));
const id = name.slice(prefix.length);
```

- [ ] **Étape 4 : vérifier le vert**

```bash
node tools/test-children-trial.mjs
node tools/test-children.mjs
```

Attendu : les deux scripts sortent avec le code 0.

- [ ] **Étape 5 : committer**

```bash
git add modules/child-profiles.js tools/test-children-trial.mjs package.json
git commit -m "Préfixe les bases IndexedDB de la version d’essai"
```

### Tâche 3 : caches vocaux et session Super-Admin isolés

**Fichiers :**

- Créer : `modules/voice-cache.js`
- Modifier : `modules/voice-packs.js`
- Modifier : `modules/child-profiles.js`
- Modifier : `modules/admin-beta.js`
- Modifier : `sw.js`
- Créer : `tools/test-voice-cache.mjs`

**Interfaces :**

- Produit : `voiceCachePrefix(): string`.
- Produit : `packCacheName(lang)`, `parentCacheName(lang)` avec le préfixe de l’espace.
- Produit : clé session `KalimatiStorage.storageKey('kalimati_super_admin_unlocked')`.
- Produit : `buildInviteUrl(code)` et `buildTeamUrl(teamCode)` sous `/Kalimati/essai/` en essai.

- [ ] **Étape 1 : écrire le test rouge**

Créer `tools/test-voice-cache.mjs` avec ce harnais VM, puis les assertions :

```js
const storageSource = fs.readFileSync('modules/storage.js', 'utf8');
const voiceSource = fs.readFileSync('modules/voice-cache.js', 'utf8')
  .replace(/^import .*$/m, '')
  .replace('export const voiceCachePrefix', 'const voiceCachePrefix');

function load(pathname) {
  const context = { location: { pathname } };
  context.globalThis = context;
  vm.runInNewContext(storageSource, context);
  vm.runInNewContext(`${voiceSource}\nglobalThis.voiceCachePrefix = voiceCachePrefix;`, context);
  return context;
}

assert.equal(load('/Kalimati/').voiceCachePrefix(), 'kalimati-amazigh-voices-');
assert.equal(load('/Kalimati/essai/').voiceCachePrefix(), 'kalimati-essai-amazigh-voices-');
```

Ajouter les assertions de source suivantes :

```js
assert.match(voicePacks, /import \{ voiceCachePrefix \} from '\.\/voice-cache\.js'/);
assert.match(voicePacks, /export const VOICE_CACHE_PREFIX = voiceCachePrefix\(\)/);
assert.match(admin, /storageKey\('kalimati_super_admin_unlocked'\)/);
assert.match(admin, /isTrial\(\) \? 'https:\/\/elguellouchi\.github\.io\/Kalimati\/essai\/'/);
assert.match(sw, /'\.\/modules\/voice-cache\.js'/);
```

- [ ] **Étape 2 : vérifier l’échec attendu**

```bash
node tools/test-voice-cache.mjs
```

Attendu : `modules/voice-cache.js` est absent ; les préfixes et liens ne sont pas isolés.

- [ ] **Étape 3 : implémenter le minimum**

Créer `modules/voice-cache.js` :

```js
import './storage.js';

export const voiceCachePrefix = () =>
  globalThis.KalimatiStorage.isTrial()
    ? 'kalimati-essai-amazigh-voices-'
    : 'kalimati-amazigh-voices-';
```

Dans `modules/voice-packs.js` :

```js
import { voiceCachePrefix } from './voice-cache.js';
export const VOICE_CACHE_PREFIX = voiceCachePrefix();
```

Dans `modules/child-profiles.js`, importer `voiceCachePrefix` depuis `voice-cache.js` et supprimer le préfixe vocal local dupliqué :

```js
const VOICE_PREFIX = () => voiceCachePrefix();
```

Dans `modules/admin-beta.js` :

```js
const isTrial = () => KalimatiStorage.isTrial();
const storageKey = (key) => KalimatiStorage.storageKey(key);

export const BASE_APP_URL = isTrial()
  ? 'https://elguellouchi.github.io/Kalimati/essai/'
  : 'https://elguellouchi.github.io/Kalimati/';
const SESSION_KEY = storageKey('kalimati_super_admin_unlocked');
```

Remplacer les quatre accès à la clé session par `sessionStorage.getItem(SESSION_KEY)`, `sessionStorage.setItem(SESSION_KEY, '1')` et `sessionStorage.removeItem(SESSION_KEY)`.

Ajouter `./modules/voice-cache.js` à la liste `FILES` de `sw.js`.

- [ ] **Étape 4 : vérifier le vert**

```bash
node tools/test-voice-cache.mjs
node tools/test-children-trial.mjs
node tools/test-version.mjs
```

Attendu : les trois scripts sortent avec le code 0.

- [ ] **Étape 5 : committer**

```bash
git add modules/voice-cache.js modules/voice-packs.js modules/child-profiles.js modules/admin-beta.js sw.js tools/test-voice-cache.mjs
git commit -m "Isole les caches vocaux et la session administrateur d’essai"
```

### Tâche 4 : service workers distincts, portée explicite et version v10.47

**Fichiers :**

- Modifier : `modules/version.js`
- Modifier : `modules/app-update.js`
- Modifier : `sw.js`
- Modifier : `index.html`
- Modifier : `package.json`
- Modifier : `package-lock.json`
- Tester : `tools/test-version.mjs`
- Tester : `tools/test-cache-scope.mjs`
- Tester : `tools/test-update.mjs`
- Tester : `tools/test-amazigh-qa.mjs`
- Auditer : `tools/audit-global.mjs`

**Interfaces :**

- Produit : `APP_VERSION='v10.47'`, `CACHE_VERSION='kalimati-v10-47'`, `TRIAL_CACHE_VERSION='kalimati-essai-v10-47'`.
- Produit : worker principal `/Kalimati/sw.js`, worker d’essai `/Kalimati/essai/sw.js`, portée explicite `./`.
- Produit : garde principale sur le segment `/essai/`.

- [ ] **Étape 1 : écrire les tests rouges**

Dans `tools/test-version.mjs` :

```js
const { APP_VERSION, CACHE_VERSION, TRIAL_CACHE_VERSION } = await import(pathToFileURL(path.join(ROOT, 'modules/version.js')).href);
assert.equal(APP_VERSION, 'v10.47');
assert.equal(CACHE_VERSION, 'kalimati-v10-47');
assert.equal(TRIAL_CACHE_VERSION, 'kalimati-essai-v10-47');
assert.match(sw, /const CACHE_VERSION = 'v10-47'/);
assert.match(sw, /const TRIAL = .*essai/);
assert.match(sw, /!TRIAL && .*essai/);
```

Adapter l’assertion existante sur `const CACHE` au nouveau calcul path-dépendant. Dans `tools/test-update.mjs` :

```js
has('modules/app-update.js', /register\(['"]\.\/sw\.js['"]\s*,\s*\{\s*updateViaCache:\s*['"]none['"]\s*,\s*scope:\s*['"]\.\/['"]\s*,?\s*\}/, 'portée explicite du service worker');
```

Dans `tools/test-cache-scope.mjs`, fournir `self.location.pathname` aux contextes VM et remplacer la réécriture de `CACHE` par deux exécutions. Les listes de test contiennent le cache courant v10-47 et l’ancien v10-46 :

```js
const mainKeys = [
  'kalimati-v10-47', 'kalimati-v10-46', 'kalimati-essai-v10-47',
  'kalimati-essai-v10-46', 'kalimati-amazigh-voices-fr', 'autre-cache',
];
const trialKeys = [
  'kalimati-essai-v10-47', 'kalimati-essai-v10-46', 'kalimati-v10-47',
  'kalimati-v10-46', 'kalimati-essai-amazigh-voices-fr', 'autre-cache',
];
const main = await activateWorker('/Kalimati/sw.js', mainKeys);
assert.deepEqual(main.deleted, ['kalimati-v10-46']);
const trial = await activateWorker('/Kalimati/essai/sw.js', trialKeys);
assert.deepEqual(trial.deleted, ['kalimati-essai-v10-46']);
```

Ajouter les helpers VM suivants, puis le test fetch :

```js
function activateWorker(pathname, keys) {
  const listeners = new Map();
  const deleted = [];
  let claimed = false;
  const context = {
    self: {
      location: { pathname },
      addEventListener: (name, handler) => listeners.set(name, handler),
      clients: { claim: async () => { claimed = true; } },
    },
    caches: {
      keys: async () => keys,
      delete: async (name) => { deleted.push(name); return true; },
    },
  };
  vm.runInNewContext(sw, context, { filename: 'sw.js' });
  let activation;
  listeners.get('activate')({ waitUntil: (promise) => { activation = promise; } });
  return activation.then(() => {
    assert.equal(claimed, true);
    return { deleted };
  });
}

function runFetch(pathname) {
  const listeners = new Map();
  const context = {
    self: {
      location: { origin: 'http://127.0.0.1:4173', pathname },
      addEventListener: (name, handler) => listeners.set(name, handler),
    },
    URL,
    Request: class {
      constructor(url) { this.url = url; this.method = 'GET'; this.headers = new Headers(); }
    },
  };
  vm.runInNewContext(sw, context, { filename: 'sw.js' });
  return listeners.get('fetch');
}

let intercepted = false;
runFetch('/Kalimati/sw.js')({
  request: new Request('http://127.0.0.1:4173/Kalimati/essai/'),
  respondWith: () => { intercepted = true; },
});
assert.equal(intercepted, false, 'le worker principal ignore /essai/');
```

- [ ] **Étape 2 : vérifier l’échec attendu**

```bash
node tools/test-version.mjs
node tools/test-cache-scope.mjs
node tools/test-update.mjs
```

Attendu : version v10.46, cache unique, absence de `scope` explicite et interception principale de `/essai/`.

- [ ] **Étape 3 : implémenter le minimum**

Dans `modules/version.js` :

```js
export const APP_VERSION = 'v10.47';
export const CACHE_VERSION = 'kalimati-v10-47';
export const TRIAL_CACHE_VERSION = 'kalimati-essai-v10-47';
```

Dans `modules/app-update.js` :

```js
navigator.serviceWorker.register('./sw.js', {
  updateViaCache: 'none',
  scope: './',
})
```

Dans `sw.js`, remplacer la constante statique par :

```js
const CACHE_VERSION = 'v10-47';
const TRIAL = /(^|\/)essai(?:\/|$)/.test(self.location.pathname);
const CACHE = TRIAL ? `kalimati-essai-${CACHE_VERSION}` : `kalimati-${CACHE_VERSION}`;
const AMAZIGH_VOICES = TRIAL ? 'kalimati-essai-amazigh-voices-' : 'kalimati-amazigh-voices-';
const CACHE_SPACE = TRIAL ? /^kalimati-essai-v\d/ : /^kalimati-v\d/;
```

Au début du gestionnaire `fetch`, après le contrôle de méthode et d’origine :

```js
if (!TRIAL && /(^|\/)essai(?:\/|$)/.test(url.pathname)) return;
```

Conserver `message SKIP_WAITING`, l’attente des recopies locales et `clients.claim()`. Mettre `index.html` à `v10.47` et `package.json` à `10.47`.

- [ ] **Étape 4 : vérifier le vert**

```bash
node tools/test-version.mjs
node tools/test-cache-scope.mjs
node tools/test-update.mjs
```

Attendu : les trois scripts sortent avec le code 0.

- [ ] **Étape 5 : committer**

```bash
git add modules/version.js modules/app-update.js sw.js index.html package.json tools/test-version.mjs tools/test-cache-scope.mjs tools/test-update.mjs
git commit -m "Sépare les service workers principal et d’essai"
```

### Tâche 5 : blocage Supabase avant configuration et transport

**Fichiers :**

- Modifier : `modules/cloud-sync.js`
- Modifier : `app.js`
- Créer : `tools/test-trial-cloud.mjs`
- Modifier : `package.json`

**Interfaces :**

- Produit : message fixe `Version d’essai : synchronisation et cohorte désactivées. Les données restent sur cet appareil.`.
- Produit : refus avant `fetch`, avant génération de clé et avant écriture de configuration cloud.
- Produit : retrait de `#key=` sans retour ni stockage de la clé en essai.

- [ ] **Étape 1 : écrire le test rouge**

Créer `tools/test-trial-cloud.mjs` avec ce harnais et ces assertions :

```js
const writes = [];
let fetchCalls = 0;
const context = {
  location: { pathname: '/Kalimati/essai/', hash: '#key=NEUTRAL-TEST-MARKER', origin: 'http://127.0.0.1:4173' },
  history: { replaceState: () => { context.location.hash = ''; } },
  KalimatiStorage: { isTrial: () => true },
  isTeamMode: () => true,
  logDiagnostic: () => {},
  db: {
    getSetting: () => null,
    setSetting: (key, value) => writes.push({ key, value }),
  },
  fetch: async () => { fetchCalls += 1; throw new Error('réseau interdit en essai'); },
  setTimeout,
  clearTimeout,
  URL,
};
context.window = context;
vm.createContext(context);
vm.runInContext(cloudSource.replace(/^import .*;$/gm, '').replace(/^export /gm, ''), context);

assert.equal(context.captureMagicKeyFromUrl(), null);
assert.equal(context.location.hash, '');
assert.equal(writes.length, 0);
await assert.rejects(context.syncNowWithTeam({ includeMedia: false }), /Version d’essai/);
await assert.rejects(context.rpcDelete('test'), /Version d’essai/);
await assert.rejects(context.withdrawClinicalCohortData(), /Version d’essai/);
await assert.rejects(context.deleteEncryptedRelayBundle(), /Version d’essai/);
await assert.rejects(context.fetchWithTimeout('https://neutral.invalid/test'), /Version d’essai/);
await assert.rejects(context.supabaseFetch('https://neutral.invalid/test'), /Version d’essai/);
await assert.rejects(context.saveCloudSyncConfig({ familyKey: 'neutral' }), /Version d’essai/);
assert.deepEqual(await context.getCloudSyncConfig(), {
  supabaseUrl: '', supabaseAnonKey: '', familyKey: '', autoSyncWifi: false, includeMedia: false,
});
assert.equal(await context.initCloudSyncFromUrlAndAuto(), null);
assert.equal(fetchCalls, 0);
assert.equal(writes.length, 0);
```

Ajouter le script à `npm test` après `test-sync-merge.mjs`.

- [ ] **Étape 2 : vérifier l’échec attendu**

```bash
node tools/test-trial-cloud.mjs
```

Attendu : la clé magique est retournée, une configuration est écrite et/ou `fetch` est appelé.

- [ ] **Étape 3 : implémenter le minimum**

Importer `logDiagnostic` depuis `error-log.js` et utiliser directement le prédicat central :

```js
const TRIAL_CLOUD_MESSAGE = 'Version d’essai : synchronisation et cohorte désactivées. Les données restent sur cet appareil.';
const isTrial = () => KalimatiStorage.isTrial();

function cloudRefusal() {
  logDiagnostic('cloud_blocked_trial', TRIAL_CLOUD_MESSAGE);
  return new Error(TRIAL_CLOUD_MESSAGE);
}

const cloudAllowed = () => isTeamMode() && !isTrial();
```

Dans `captureMagicKeyFromUrl()`, nettoyer toujours l’URL, mais en essai remettre `pendingMagicKey` à `null` et retourner `null`.

Dans `initCloudSyncFromUrlAndAuto()`, si `isTrial()` :

```js
captureMagicKeyFromUrl();
logDiagnostic('cloud_init_blocked_trial', TRIAL_CLOUD_MESSAGE);
return;
```

Dans `getCloudSyncConfig()`, retourner une configuration locale inerte avant toute lecture ou génération de clé :

```js
return { supabaseUrl: '', supabaseAnonKey: '', familyKey: '', autoSyncWifi: false, includeMedia: false };
```

Dans `saveCloudSyncConfig()`, appeler `cloudRefusal()` avant toute écriture.

Dans `syncNowWithTeam()`, `rpcDelete()`, `withdrawClinicalCohortData()` et `deleteEncryptedRelayBundle()`, appeler `cloudRefusal()` si `isTrial()`, avant le contrôle Mode équipe.

Dans `supabaseFetch()` et `fetchWithTimeout()` :

```js
if (isTrial()) throw cloudRefusal();
```

Dans `app.js`, avant l’appel automatique :

```js
if (!KalimatiStorage.isTrial()) initCloudSyncFromUrlAndAuto().catch(() => {});
```

- [ ] **Étape 4 : vérifier le vert**

```bash
node tools/test-trial-cloud.mjs
node tools/test-clinical-mode.mjs
node tools/test-privacy-network.mjs
```

Attendu : zéro appel `fetch` en essai, aucune écriture cloud, contrôles existants verts.

- [ ] **Étape 5 : committer**

```bash
git add modules/cloud-sync.js app.js tools/test-trial-cloud.mjs package.json
git commit -m "Bloque le cloud avant tout effet en version d’essai"
```

### Tâche 6 : commandes cloud et cohorte grisées, export local conservé

**Fichiers :**

- Modifier : `modules/cloud-sync.js`
- Modifier : `modules/team-mode.js`
- Tester : `tools/test-trial-cloud.mjs`
- Tester : `tools/test-clinical-mode.mjs`

**Interfaces :**

- Produit : `cloudAllowed()` utilisé par les commandes parent.
- Produit : message fixe d’essai dans le bloc Synchronisation.
- Produit : export JSON local non désactivé par le blocage cloud.

- [ ] **Étape 1 : écrire le test rouge**

Ajouter dans `tools/test-trial-cloud.mjs` des assertions de source sur le rendu réel :

```js
assert.match(cloudSource, /const cloudAllowed = isTeamMode\(\) && !isTrial\(\)/);
for (const control of ['syncBtn', 'withdrawBtn', 'deleteRelayBtn', 'copyMagicBtn', 'copyKeyBtn', 'whatsappBtn', 'saveCloudBtn', 'keyInput', 'urlInput', 'anonInput', 'mediaChk', 'autoWifiChk', 'cohortChk']) {
  assert.match(cloudSource, new RegExp(`${control}\\.disabled = !cloudAllowed`), `${control} est désactivé en essai`);
}
assert.match(cloudSource, /Version d’essai : synchronisation et cohorte désactivées\. Les données restent sur cet appareil\./);
const exportButton = /btn\('📥 Exporter le rapport clinique pseudonymisé \(JSON\)'[\s\S]{0,180}/.exec(cloudSource);
assert.ok(exportButton && !exportButton[0].includes('disabled'), 'l’export local reste actif');
```

Ajouter une assertion de source dans `test-clinical-mode.mjs` :

```js
assert.match(teamMode, /fonctions cloud[\s\S]{0,160}indisponibles[\s\S]{0,80}essai/i);
```

- [ ] **Étape 2 : vérifier l’échec attendu**

```bash
node tools/test-trial-cloud.mjs
node tools/test-clinical-mode.mjs
```

Attendu : les commandes restent activées avec Mode équipe et le texte d’essai manque.

- [ ] **Étape 3 : implémenter le minimum**

Remplacer les conditions d’interface :

```js
const cloudAllowed = isTeamMode() && !isTrial();
```

Créer les variables `copyMagicBtn`, `copyKeyBtn`, `whatsappBtn` et `saveCloudBtn` autour des boutons existants. Affecter `disabled = !cloudAllowed` à ces quatre boutons, aux trois boutons d’action, aux entrées de configuration, aux cases automatique/médias et au consentement. Ajouter le message fixe dans le bloc Synchronisation. Ne pas associer ce message au bouton d’export JSON local.

Dans `modules/team-mode.js`, ajouter au texte explicatif :

```js
' Dans la version d’essai, les fonctions cloud restent indisponibles.'
```

- [ ] **Étape 4 : vérifier le vert**

```bash
node tools/test-trial-cloud.mjs
node tools/test-clinical-mode.mjs
```

Attendu : les deux scripts sortent avec le code 0.

- [ ] **Étape 5 : committer**

```bash
git add modules/cloud-sync.js modules/team-mode.js tools/test-trial-cloud.mjs tools/test-clinical-mode.mjs
git commit -m "Grise les commandes cloud d’essai sans bloquer l’export local"
```

### Tâche 7 : serveur local `/essai/` et construction de l’artefact combiné

**Fichiers :**

- Modifier : `tools/serve.mjs`
- Créer : `tools/build-pages.mjs`
- Créer : `tools/test-pages-build.mjs`
- Modifier : `package.json`
- Modifier : `.gitignore`

**Interfaces :**

- Consomme : deux arbres source, `main` et `essai`, fournis par des dossiers locaux ou des worktrees GitHub.
- Produit : `_site/index.html` et `_site/essai/index.html` depuis le code courant, `_site/.nojekyll` ; `_pages-site/index.html` depuis `main`, `_pages-site/essai/index.html` depuis `essai`, `_pages-site/.nojekyll`.
- Produit : `ROOT` du serveur sélectionné par `SERVE_ROOT`, avec résolution spéciale `/essai/` uniquement pour le dépôt local.

- [ ] **Étape 1 : écrire le test rouge**

Créer `tools/test-pages-build.mjs` avec deux arbres temporaires neutres. Chaque arbre contient les trois fichiers obligatoires et un fichier privé distinct. Le test appelle le script et vérifie :

```js
assert.equal(read('_site/index.html'), 'main-index');
assert.equal(read('_site/essai/index.html'), 'trial-index');
assert.equal(read('_site/app.js'), 'main-app');
assert.equal(read('_site/essai/app.js'), 'trial-app');
assert.equal(exists('_site/.nojekyll'), true);
assert.equal(exists('_site/docs'), false);
assert.equal(exists('_site/essai/Agent.md'), false);
assert.equal(read('_pages-site/index.html'), 'main-index');
assert.equal(read('_pages-site/essai/index.html'), 'trial-index');
assert.equal(read('_pages-site/sw.js'), 'main-worker\nsecond-line\n');
```

Ajouter les cas d’échec : `index.html` principal absent, `sw.js` d’essai absent, sortie située dans un dossier source. Vérifier aussi que `_pages-site` reste séparé de `_site`, que les fichiers texte sont normalisés en LF comme sur GitHub et que les binaires restent intacts.

Ajouter au même script un test HTTP du serveur :

```js
const response = await fetch(`${BASE}/essai`);
assert.equal(response.status, 302);
assert.equal(new URL(response.headers.get('location')).pathname, '/essai/');
assert.equal((await fetch(`${BASE}/essai/modules/storage.js`)).headers.get('content-type'), 'application/javascript');
```

- [ ] **Étape 2 : vérifier l’échec attendu**

```bash
node tools/test-pages-build.mjs
```

Attendu : `tools/build-pages.mjs` est absent ; `/essai/` n’est pas résolu.

- [ ] **Étape 3 : implémenter le minimum**

Créer `tools/build-pages.mjs` avec l’interface CLI :

```bash
node tools/build-pages.mjs --main <dossier-main> --essai <dossier-essai> --out _site
```

Liste blanche exacte :

```js
const FILES = ['index.html', 'boot-guard.js', 'theme-boot.js', 'style.css', 'app.js', 'db.js', 'data.js', 'speech.js', 'media.js', 'editor.js', 'backup.js', 'manifest.webmanifest', 'sw.js'];
const DIRS = ['assets', 'icons', 'locales', 'modules', 'voix'];
```

Pour chaque source, exiger `index.html`, `app.js`, `sw.js`. Copier seulement les éléments de la liste blanche présents. Écrire `.nojekyll` à la racine. La sortie doit se terminer par `_site` ou `_pages-site` ; refuser une source égale à la sortie ou une sortie imbriquée dans une source. Normaliser les fichiers texte en LF pour reproduire les octets du checkout GitHub, sans toucher aux binaires.

```js
import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, resolve, sep } from 'node:path';

const option = (name) => process.argv[process.argv.indexOf(`--${name}`) + 1];
const main = resolve(option('main'));
const essai = resolve(option('essai'));
const out = resolve(process.cwd(), option('out'));
if (!['_site', '_pages-site'].includes(basename(out))) throw new Error('la sortie doit se terminer par _site ou _pages-site');
const exists = async (path) => access(path).then(() => true).catch(() => false);
for (const source of [main, essai]) {
  if (out === source || out.startsWith(source + sep)) throw new Error('la sortie et les sources doivent être des dossiers séparés');
  for (const required of ['index.html', 'app.js', 'sw.js']) {
    if (!(await exists(resolve(source, required)))) throw new Error(`${required} absent de ${source}`);
  }
}
await rm(out, { recursive: true, force: true });
for (const [source, destination] of [[main, out], [essai, resolve(out, 'essai')]]) {
  for (const name of FILES) {
    const from = resolve(source, name);
    if (await exists(from)) {
      await mkdir(destination, { recursive: true });
      await cp(from, resolve(destination, name));
    }
  }
  for (const name of DIRS) {
    const from = resolve(source, name);
    if (await exists(from)) await cp(from, resolve(destination, name), { recursive: true });
  }
}
await writeFile(resolve(out, '.nojekyll'), '');
```

Ajouter à `.gitignore` :

```gitignore
_site/
_pages-site/
.pages-build/
.pages-main/
.pages-essai/
```

Dans `tools/serve.mjs` :

```js
const ROOT = process.env.SERVE_ROOT
  ? path.resolve(process.env.SERVE_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
```

Si `SERVE_ROOT` est absent, retirer le premier segment `/essai` avant la résolution et rediriger `/essai` vers `/essai/`. Si `SERVE_ROOT` est présent, résoudre l’artefact tel quel. Conserver le contrôle `file.startsWith(ROOT + path.sep)`.

- [ ] **Étape 4 : vérifier le vert**

```bash
node tools/test-pages-build.mjs
npm run serve:test
```

Attendu : artefact correct, redirection 302, MIME JavaScript et code 0.

- [ ] **Étape 5 : committer**

```bash
git add tools/serve.mjs tools/build-pages.mjs tools/test-pages-build.mjs package.json .gitignore
git commit -m "Construit un artefact Pages combiné sans exposer les outils"
```

### Tâche 8 : parcours E2E d’isolation, badge, cloud et hors ligne

**Fichiers :**

- Modifier : `tools/e2e/support.mjs`
- Créer : `tools/e2e/trial-isolation.spec.mjs`
- Créer : `tools/e2e/trial-offline.spec.mjs`
- Modifier : `playwright.config.js` si nécessaire pour l’artefact combiné

**Interfaces :**

- Consomme : `openTalkGrid()`, `visibleCards()`, `gridCardIds()`, `tapThreeCards()`, `waitCachedApp()`.
- Produit : helpers `openTrialTalkGrid()`, `trialCacheName()`, `installMainWorkerFixture()`.

- [ ] **Étape 1 : écrire les tests rouges**

Créer `tools/e2e/trial-isolation.spec.mjs` avec les scénarios suivants :

1. Créer une carte neutre en principal, recharger, ouvrir `/essai/`, vérifier qu’elle n’apparaît pas.
2. Créer une carte neutre en essai, recharger, revenir en principal, vérifier qu’elle n’apparaît pas.
3. Vérifier les noms de bases et les clés avec des marqueurs neutres.
4. Vérifier badge absent en principal, invisible en mode enfant d’essai, visible en mode parent d’essai.
5. Activer le Mode équipe en essai et vérifier qu’aucune requête cloud n’est observée et que les commandes restent désactivées.
6. Ouvrir `/essai/#key=KALI-TEST-TEST-TEST`, vérifier que le fragment disparaît et qu’aucune clé cloud n’est stockée.
7. Installer le worker principal gardé, ouvrir `/essai/`, vérifier la portée `/essai/`, le cache `kalimati-essai-v10-47` et l’absence d’ajout dans l’ancien cache principal.

Exemple de migration :

```js
await page.goto('/');
await page.evaluate(async () => {
  await navigator.serviceWorker.register('./sw.js', { scope: './' });
});
await page.reload();
await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
const before = await page.evaluate(async () => {
  const names = await caches.keys();
  return names.sort();
});
await page.goto('/essai/');
await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toContain('/essai/sw.js');
const after = await page.evaluate(async () => (await caches.keys()).sort());
expect(after.filter((name) => /^kalimati-v\d/.test(name))).toEqual(before.filter((name) => /^kalimati-v\d/.test(name)));
```

Créer `tools/e2e/trial-offline.spec.mjs` sur le modèle de `offline.spec.mjs`, avec `test.skip(testInfo.project.name !== 'pixel-5-chromium')`.

- [ ] **Étape 2 : vérifier l’échec attendu**

```bash
npm run test:e2e -- --project=pixel-5-chromium tools/e2e/trial-isolation.spec.mjs tools/e2e/trial-offline.spec.mjs
```

Attendu : `/essai/` n’est pas servi ou les données/caches se croisent.

- [ ] **Étape 3 : implémenter le minimum**

Dans `support.mjs`, faire reconnaître les deux caches :

```js
const main = (await caches.keys()).find((key) => /^kalimati(?:-essai)?-v\d/.test(key));
```

Rendre le chemin d’ouverture paramétrable et ajouter les helpers exacts :

```js
export async function openTalkGrid(page, path = '/') {
  const start = Date.now();
  await page.goto(path);
  const loaded = Date.now();
  await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
  const homeVisible = Date.now();
  await page.locator(HOME_TILE_TALK).dispatchEvent('click');
  const clicked = Date.now();
  await expect(visibleCards(page).first()).toBeVisible({ timeout: 3000 });
  console.log(`ouverture : navigation ${loaded - start} ms, accueil ${homeVisible - loaded} ms, toucher ${clicked - homeVisible} ms, grille ${Date.now() - clicked} ms`);
  return Date.now() - start;
}

export const openTrialTalkGrid = (page) => openTalkGrid(page, '/essai/');

export async function trialCacheName(page) {
  return page.evaluate(async () => (await caches.keys()).find((name) => name === 'kalimati-essai-v10-47') || null);
}

export async function installMainWorkerFixture(page, source) {
  await page.route('**/__main-worker-fixture.js', (route) => route.fulfill({ contentType: 'application/javascript', body: source }));
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/__main-worker-fixture.js', { scope: '/' });
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
}
```

Le test G0 charge le source historique avec `execFileSync('git', ['show', 'origin/main:sw.js'])` et marque l’échec de cache comme attendu tant que la porte G0 reste ouverte. Le test du worker gardé utilise le `/sw.js` réel, sans fixture. Ne pas ajouter de données personnelles ni de clé réaliste. Conserver les vrais clics pour les parcours fonctionnels.

- [ ] **Étape 4 : vérifier le vert**

```bash
npm run test:e2e -- --project=pixel-5-chromium tools/e2e/trial-isolation.spec.mjs tools/e2e/trial-offline.spec.mjs
npm run test:e2e -- --project=iphone-13-webkit tools/e2e/critical-flows.spec.mjs tools/e2e/trial-isolation.spec.mjs
```

Attendu : scénarios d’essai verts, hors ligne Chromium vert, parcours principaux WebKit verts.

- [ ] **Étape 5 : committer**

```bash
git add tools/e2e/support.mjs tools/e2e/trial-isolation.spec.mjs tools/e2e/trial-offline.spec.mjs playwright.config.js
git commit -m "Vérifie l’isolation de l’essai dans les navigateurs"
```

### Tâche 9 : workflow Pages, comparaison octet par octet et documentation

**Fichiers :**

- Créer : `.github/workflows/pages.yml`
- Créer : `tools/check-pages-root.mjs`
- Modifier : `tools/test-cache-scope.mjs`
- Modifier : `docs/PUBLIER.md`
- Créer : `docs/comptes-rendus/lot-0-essai.md`

**Interfaces :**

- Produit : workflow manuel `pages.yml`, concurrent groupe unique.
- Produit : contrôle local `node tools/check-pages-root.mjs --site _pages-site --live https://elguellouchi.github.io/Kalimati/ --require-main-guard`.
- Produit : rapport avec SHA-256, sortie réelle de `npm test` et `npm run test:e2e`.

- [ ] **Étape 1 : écrire le contrôle rouge**

Créer `tools/check-pages-root.mjs` qui télécharge uniquement les deux URL publiques déjà autorisées, lit `_pages-site/sw.js` et `_pages-site/index.html`, calcule SHA-256 et octets, compare les tampons avec `Buffer.equals`, puis exécute le vrai gestionnaire `fetch` du worker avec `--require-main-guard`. Ajouter dans `tools/test-cache-scope.mjs` une régression contre une garde seulement commentée et contre un worker forcé en mode essai.

```bash
node tools/check-pages-root.mjs --site _pages-site --live https://elguellouchi.github.io/Kalimati/ --require-main-guard
```

Comportement attendu : code 1 si un fichier diffère, avec les deux empreintes et tailles, sans secret ni contenu de fichier ; code 1 si le worker intercepte un chemin `/essai/` ou laisse passer la racine et `/essai-copie/`.

```js
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const option = (name) => process.argv[process.argv.indexOf(`--${name}`) + 1];
const site = option('site');
const live = option('live').replace(/\/?$/, '/');
let different = false;
for (const name of ['sw.js', 'index.html']) {
  const [local, response] = await Promise.all([readFile(join(site, name)), fetch(`${live}${name}`)]);
  if (!response.ok) throw new Error(`site public indisponible : ${name}`);
  const remote = Buffer.from(await response.arrayBuffer());
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const same = local.equals(remote);
  different ||= !same;
  console.log(`${same ? 'OK' : 'DIFFÉRENT'} ${name} local=${local.length}/${hash(local)} public=${remote.length}/${hash(remote)}`);
}
if (different) process.exitCode = 1;
```

- [ ] **Étape 2 : vérifier l’échec attendu**

Après la tâche 7, construire un artefact avec `origin/main` en racine et la branche en essai :

```bash
git worktree add ../kalimati-main-check origin/main
node tools/build-pages.mjs --main ../kalimati-main-check --essai . --out ../kalimati-pages-check/_pages-site
node tools/check-pages-root.mjs --site ../kalimati-pages-check/_pages-site --live https://elguellouchi.github.io/Kalimati/ --require-main-guard
```

Attendu : `sw.js` et `index.html` sont identiques octet par octet au site public après normalisation LF, puis code 1 uniquement sur G0, car le worker public `v10.45` intercepte réellement `/essai/`. C’est la preuve de G0, pas une erreur à contourner.

- [ ] **Étape 3 : implémenter le workflow et la procédure**

Créer `.github/workflows/pages.yml` avec :

- `on: push: branches: [main, essai]` et `workflow_dispatch` ;
- `concurrency: group: pages-kalimati`, `cancel-in-progress: false` ;
- checkout de `main` dans `.pages-main` et de `essai` dans `.pages-essai` ;
- `npm ci` et `npm test` dans `.pages-essai` ;
- construction de `_site` (code courant aux deux emplacements) et `_pages-site` (`main` + `essai/`) avec le script sans dépendance ;
- contrôle `check-pages-root.mjs --require-main-guard` contre `_pages-site` et le site public ;
- E2E contre `_site` avec `SERVE_ROOT` et `npm run test:e2e -- --trace off` ;
- `actions/configure-pages`, `actions/upload-pages-artifact@v3` avec `path: .pages-build/_pages-site`, puis `actions/deploy-pages@v4` ;
- permissions minimales `contents: read`, `pages: write`, `id-token: write` ;
- environnement GitHub `github-pages` pour la protection de déploiement.

Le contrôle de publication doit empêcher le déploiement tant que G0 n’est pas résolu. Ne pas ajouter de secrets applicatifs.

Mettre à jour `docs/PUBLIER.md` :

- l’état « non publié » reste exact tant que la publication réelle n’a pas eu lieu ;
- Settings → Pages → Source → GitHub Actions ;
- dès la bascule autorisée, ouvrir Actions → `pages.yml` → **Run workflow** immédiatement ;
- ne jamais déployer uniquement `essai/` : l’artefact combiné conserve la racine ;
- toute différence de `sw.js` ou `index.html` bloque la publication ;
- attendre 48 heures de tests réels avant promotion vers `main`.

- [ ] **Étape 4 : vérifier le workflow et la documentation**

```bash
node tools/check-pages-root.mjs --site _pages-site --live https://elguellouchi.github.io/Kalimati/ --require-main-guard
```

Attendu : le script fonctionne et bloque tant que G0 est ouvert. La régression doit refuser un commentaire contenant la garde et un worker avec `TRIAL = true`. Relire le YAML et laisser la CI valider sa syntaxe ; ne pas installer de dépendance nouvelle pour cette vérification.

- [ ] **Étape 5 : committer**

```bash
git add .github/workflows/pages.yml tools/check-pages-root.mjs tools/test-cache-scope.mjs docs/PUBLIER.md
git commit -m "Ajoute la publication Pages combinée et sa porte de contrôle"
```

### Tâche 10 : vérification finale, compte rendu et PR vers `essai`

**Fichiers :**

- Modifier : `docs/comptes-rendus/lot-0-essai.md`
- Modifier : `docs/plans/lot-0-essai-plan.md` pour cocher les étapes réalisées

- [ ] **Étape 1 : lancer les portes complètes**

```bash
npm test > test.log 2>&1
CI=1 PORT=4187 SERVE_ROOT=../kalimati-pages-check/_site npm run test:e2e -- --trace off > e2e.log 2>&1
```

Les deux commandes doivent réussir. Conserver les vraies sorties, y compris les avertissements Node, sans les remplacer par un résumé inventé.

- [ ] **Étape 2 : construire et comparer l’artefact**

```bash
node tools/build-pages.mjs --main . --essai . --out ../kalimati-pages-check/_site
node tools/build-pages.mjs --main ../kalimati-main-check --essai . --out ../kalimati-pages-check/_pages-site
node tools/check-pages-root.mjs --site ../kalimati-pages-check/_pages-site --live https://elguellouchi.github.io/Kalimati/ --require-main-guard
```

Consigner les tailles, SHA-256 et résultat pour `sw.js` et `index.html`. Si G0 reste ouvert, écrire clairement que la publication est bloquée.

- [ ] **Étape 3 : vérifier navigateur et artefact**

Sur Chromium et WebKit :

- parcours principal et essai ;
- badge parent/enfant ;
- Mode équipe sans cloud ;
- hors ligne Chromium ;
- noms de bases, clés et caches séparés ;
- portée du worker d’essai ;
- absence de `docs/`, `tools/`, `Agent.md` et transcriptions dans `_site` et `_pages-site`.

Le vrai iPhone reste à tester après mise en essai ; WebKit ne le remplace pas.

- [ ] **Étape 4 : écrire le compte rendu**

Créer `docs/comptes-rendus/lot-0-essai.md` avec les titres imposés :

- `Ce qui change pour la famille`
- `Exigences faites`
- `Exigences non faites et pourquoi`
- `Tests lancés et résultat`
- `Vérifié sur quels appareils`
- `Questions pour Aziz`

Inclure les 20 dernières lignes réelles de `test.log`, le résumé exact de Playwright, les mesures de comparaison et l’état de G0.

- [ ] **Étape 5 : contrôler le diff et les secrets**

```bash
git status --short
git diff --check
git diff --stat
git diff
```

Vérifier qu’aucun fichier privé, secret, identifiant Supabase ajouté ou vrai prénom d’enfant n’est présent. Ne pas ajouter `Agent.md` ni les dossiers de transcription.

- [ ] **Étape 6 : committer puis pousser la branche**

```bash
git add .gitignore .github/workflows/pages.yml docs/PUBLIER.md docs/comptes-rendus/lot-0-essai.md docs/plans/lot-0-essai-plan.md docs/plans/lot-0-essai-spec.md tools/build-pages.mjs tools/check-pages-root.mjs tools/e2e/support.mjs tools/e2e/trial-isolation.spec.mjs tools/e2e/trial-offline.spec.mjs tools/test-cache-scope.mjs tools/test-pages-build.mjs
git commit -m "Lot 0 — verrouille la publication combinée et le contrôle G0 (exigences L0-05, L0-06, L0-12)"
git push -u origin lot-0-essai-isole
```

- [ ] **Étape 7 : créer la PR vers `essai`**

Créer une PR depuis `lot-0-essai-isole` vers `essai`. Vérifier que la CI `tests` et `e2e` est verte. Ne pas fusionner la PR et ne pas toucher à `main`.

- [ ] **Étape 8 : envoyer le compte rendu et s’arrêter**

Envoyer à l’utilisateur le résultat, les tests, la comparaison octet par octet, la PR et l’état de G0. Attendre son accord avant :

- fusionner la PR dans `essai` ;
- préparer le worker principal gardé si nécessaire ;
- changer Settings → Pages → Source → GitHub Actions ;
- lancer immédiatement `pages.yml` manuellement ;
- promouvoir l’essai vers `main`.

---

## Revue finale du plan

- L0-05 : tâches 2, 3, 4, 7, 8 et 9.
- L0-06 : tâche 1 et tâche 8.
- L0-12 : tâches 5, 6 et tâche 8.
- Worker principal v10.45 : porte G0, tâches 4, 8 et 9.
- Artefact combiné : tâches 7 et 9.
- Comparaison octet par octet : tâches 9 et 10.
- Lancement manuel immédiat après bascule Pages : tâche 9 et `docs/PUBLIER.md`.
- Aucune étape ne modifie le réglage Pages ni ne pousse vers `main`.
- Toute différence de comportement ou de test est enregistrée dans le compte rendu, sans masquer les limites.
