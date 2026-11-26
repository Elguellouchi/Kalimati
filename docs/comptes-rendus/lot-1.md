# Compte rendu — Lot 1 : Fiabilité (zéro écran vide, zéro perte de données)

- **Date :** 2026-11-26
- **Branche :** `lot-1-fiabilite`
- **Ancêtre vérifié :** `c3060ab`
- **Périmètre validé :** Tâches 1 à 4 (L1-01 à L1-07) livrées ; L1-08 à L1-10 terminés, avec correction G0 et périmètre de stockage Chromium autorisé (décision D-2).

## Ce qui change pour la famille

1. **Protection des cartes de l’enfant (L1-01, L1-02) :** Au premier déverrouillage parent, Kalimati demande au téléphone de garder les cartes « pour de bon ». Dans « Progrès », une boîte indique « Stockage protégé : oui / non » avec conseil iOS si non protégé.
2. **Rappel de sauvegarde (L1-03) :** Quand le parent ouvre le mode adulte, si aucune sauvegarde n’a été faite ou si la dernière date de plus de 14 jours, un bandeau apparaît au-dessus du bouton « 💾 Sauvegarder » : « ⚠️ Aucune sauvegarde sur ce téléphone » ou « ⚠️ Dernière sauvegarde il y a N jours », avec un bouton « Faire une sauvegarde maintenant » (même logique que le bouton Sauvegarder). En mode enfant, rien n’apparaît. Après sauvegarde, le bandeau disparaît.
3. **Réactivité clinique et pré-chargement des voix (L1-04, L1-05, L1-06) :** L'application surveille en silence ses propres temps d'exécution. Au rendu d'une grille, les voix des cartes visibles (jusqu'à 40) sont pré-chargées en arrière-plan sans bloquer l'enfant. Si le démarrage dépasse 1,5s (hors ligne) ou 4s (en ligne), ou si un son met plus de 300ms à partir après le toucher, l'incident est noté localement dans le journal d'erreurs pour analyse, sans aucune donnée personnelle.
4. **Mode secours anti-écran-vide (L1-07) :** Si IndexedDB ne répond pas en 6 s (Safari iPhone, verrou de fichier), l'application bascule automatiquement : elle affiche la grille de départ avec les mots de base, la synthèse vocale reste disponible pour que l'enfant puisse continuer à parler. En mode parent, un message discret indique : « Mode secours : vos cartes reviendront au prochain démarrage. » Aucune alerte rouge, aucun son d'échec en mode enfant.
5. **Mise à jour seulement en arrière-plan (L1-08) :** Le bouton d'actualisation immédiate et le rechargement de secours sont retirés. Une version en attente est activée quand l'application passe en arrière-plan ; si le changement de contrôle arrive pendant que l'écran est visible, le rechargement est différé au prochain passage en arrière-plan.
6. **Alerte d'espace parent (L1-09) :** Dans « Progrès », si l'estimation brute du stockage dépasse strictement 85 %, un encadré « Espace presque plein » affiche les trois plus gros médias avec uniquement leur catégorie générique (Vidéo, Voix, Photo) et leur taille. Aucun nom, titre de carte, identifiant ou URL de blob n'est affiché ; aucun inventaire n'est lancé au démarrage.
7. **Scénarios de non-régression (L1-10) :** IndexedDB bloqué, CacheStorage absent et synthèse vocale absente sont couverts sur les trois profils Playwright. L’estimation de stockage supérieure à 85 % est validée en Chromium seulement (décision D-2), car WebKit échoue avant l’injection des médias ; la vérification sur un vrai iPhone reste à faire.

Rien ne part sur internet : les données restent strictement sur l’appareil.

## Exigences faites

- **L1-01 — Stockage persistant :** Module `storage-persist.js`, `requestPersistentStorage()`, enregistrement `storagePersisted` (`true`/`false`/`’unsupported’`), déclenchement au déverrouillage parent, log `STORAGE_QUOTA` sans donnée personnelle.
- **L1-02 — Affichage Progrès :** Boîte `storageProtectionBox()` dans `dashboard.js`, état « Stockage protégé : oui / non », aide iOS contextuelle, bouton test manuel.
- **L1-03 — Rappel de sauvegarde si > 14 jours :**
  - Module `modules/backup-reminder.js` (logique pure testable) : `BACKUP_REMIND_DAYS = 14`, `backupAgeDays()`, `backupReminderNeeded()`, `backupReminderElement()` (bandeau `id="backup-reminder"`, `role="alert"`, bouton primaire).
  - Branchement dans `backup-ui.js` : `refreshBackupReminder()` au chargement, sur événement `kalimati-parent` et après sauvegarde réussie. Le bouton appelle `exportBtn.click()` (aucune duplication de logique).
- **L1-04 & L1-05 — Budgets de démarrage et du son :**
  - Module `modules/startup-timing.js` : `markStartupStart()` au démarrage précoce de `app.js`, `recordFirstRender()` au premier rendu de la grille Parler (seuil 1,5s hors ligne, 4s en ligne, journalisé en `UX_FRICTION`).
  - Mesure du son dans `speech.js` : `markAudioStart(cardId)` avant `audio.play()`, `recordAudioPlaying(cardId)` à l'événement `playing` (seuil 300ms en `UX_FRICTION`, > 800ms en `AUDIO_SILENT`).
- **L1-06 — Pré-chargement des voix :**
  - Module `modules/voice-preload.js` : `preloadVisibleVoices()` déclenche le fetch discret des voix (max 40) en `cache: 'force-cache'` via `requestIdleCallback` ou `setTimeout(0)`, sans bloquer le rendu.
  - Intégré dans `modules/views.js` à chaque rendu de grille.
- **L1-07 — Mode secours IndexedDB 6s :**
  - Module `modules/db-fallback.js` : `enableFallbackMode(reason)` active le mode secours, consigne l'incident (`idb_fallback_mode`) dans `error-log.js` (`STORAGE_QUOTA` ou `JS_RUNTIME`), prépare les cartes de départ (`defaultCards()` avec places fixes via `assignPositions`).
  - Dans `app.js` : le chargement initial est borné à 6 s via `Promise.race` ; en cas d'échec, `enableFallbackMode(err)`, `state.cards = getFallbackCards()`, puis l'interface continue (`setupLock`, `setupParentBar`, `renderAll`).
  - Dans `backup-ui.js` (panneau parent) : le bandeau `fallbackBannerElement()` s'affiche en mode parent (« Mode secours : vos cartes reviendront au prochain démarrage. », `role="status"`, jamais `alert`).
- **Mise en cache hors ligne :**
  - `storage-persist.js`, `backup-reminder.js`, `startup-timing.js`, `voice-preload.js` et `db-fallback.js` ajoutés à `FILES` dans `sw.js`.
  - `modules/storage-warning.js` ajouté à `FILES` pour L1-09.
- **L1-08 — Mise à jour en arrière-plan :**
  - `modules/app-update.js` n'active le worker en attente que sur `visibilitychange` vers l'arrière-plan.
  - Un `controllerchange` visible place le rechargement en attente ; il n'a lieu qu'au prochain passage en arrière-plan.
  - Suppression de « Actualiser maintenant » et du `setTimeout` de relance de secours.
  - `tools/test-update.mjs` vérifie maintenant les transitions visible → arrière-plan et le rechargement différé.
- **L1-09 — Alerte de stockage :**
  - `db.storageEstimate()` conserve `usage` et `quota` en octets bruts en plus des valeurs arrondies.
  - `modules/storage-warning.js` déclenche l'alerte seulement si `quota > 0` et `usage / quota > 0.85`.
  - L'inventaire parent agrège cartes, enregistrements, remplacements visuels, cahier de vie, images en cache, vidéos de lieux, scènes, histoires et voix en CacheStorage.
  - `biggestMedia()` ne retourne que `{ kind, size }` ; l'affichage utilise uniquement Vidéo / Voix / Photo et une taille lisible.
  - `tools/test-storage-warning.mjs` (8 vérifications) est intégré à `npm test`.
- **L1-10 — Parcours E2E ajoutés :**
  - `tools/e2e/lot1.spec.mjs` ajoute les quatre scénarios demandés, avec marqueurs neutres `e2e-media-*`.
  - Les trois scénarios de dégradation passent sur les trois profils Playwright lors de la suite complète.
  - Le scénario de stockage passe sur Chromium et Chromium sans caches. Il est explicitement ignoré sous WebKit (décision D-2), car l’injection des médias échoue avant le scénario ; la vérification sur un vrai iPhone est conservée dans les points restants.
- **Tests unitaires :**
  - `test-storage-persist.mjs` (8 vérifications).
  - `test-backup-remind.mjs` (9 vérifications).
  - `test-startup-timing.mjs` (12 vérifications).
  - `test-voice-preload.mjs` (10 vérifications).
  - `test-db-fallback.mjs` (7 vérifications).
  - `test-storage-warning.mjs` (8 vérifications).
  - Tous intégrés dans `package.json` et exécutés dans la suite complète `npm test`.

## Exigences non faites et pourquoi

- **L1-08 : correction autorisée après isolation.** Le contrôle G0 passe sur le commit `12d5718` (`1 passed (20.1s)`). La régression vient donc de L1-08 : l’activation en arrière-plan remplaçait le worker fixture par `sw.js`. `modules/app-update.js` refuse désormais d’activer un worker en attente si le worker actif de cette portée n’est pas un `sw.js`.
- **L1-10 : périmètre Chromium autorisé (décision D-2).** Le scénario de stockage est ignoré sous WebKit, comme le scénario hors ligne, car il échoue avant l’injection des médias. La raison est inscrite dans le test et la vérification sur un vrai iPhone reste obligatoire.
- **Livraison Git : autorisée après suites finales vertes.** `npm test` et `npm run test:e2e` ont été relancés une seule fois chacun avec succès. Le commit, le push de `lot-1-fiabilite` et la PR vers `essai` sont donc autorisés. Aucune fusion, aucun déploiement et aucun changement du réglage Pages ne sont demandés. Le stash `lot-2-plan-moteur-avant-lot-1-2026-11-26` reste préservé.

## Tests lancés et résultat

### Vérifications ciblées avant les suites complètes

```bash
node tools/test-update.mjs && node tools/test-storage-warning.mjs
```

Résultat : **succès, code 0**. Extrait réel :

```text
Mise à jour en arrière-plan uniquement (L1-08) : contrôles passés.
OK Le seuil est strictement supérieur à 85 %
OK Quota absent, nul ou estimation invalide : aucune alerte
OK Les tailles sont lisibles en français
OK Le top 3 est trié, limité et ne conserve aucun libellé personnel
OK storageEstimate conserve les octets bruts
OK Les inventaires de médias sont disponibles dans db.js
OK L’alerte est réservée à Progrès et gardée hors ligne
OK La suite npm test inclut la régression

test-storage-warning : OK (8 vérifications).
```

```bash
npx playwright test tools/e2e/lot1.spec.mjs --project=pixel-5-chromium
```

Résultat réel :

```text
Running 4 tests using 1 worker
ok 1 [pixel-5-chromium] › L1-10 — IndexedDB bloqué : les cartes de secours restent utilisables
ok 2 [pixel-5-chromium] › L1-10 — sans window.caches : ouverture et trois cartes restent possibles
ok 3 [pixel-5-chromium] › L1-10 — synthèse vocale absente : les cartes restent utilisables en silence
ok 4 [pixel-5-chromium] › L1-10 — stockage simulé à plus de 85 % : alerte parent et trois plus gros médias
4 passed (41.3s)
```

### Première suite unitaire complète — avant la reprise

```bash
npm test
```

Résultat : **succès, code 0**. La sortie complète a été renvoyée par l’outil (77,9 Ko). Extrait réel de fin :

```text
🎉 test-db-fallback : OK (7 vérifications).
(node:33936) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
REFUSÉ G0 — commentaire seul
REFUSÉ G0 — premier écouteur fetch non gardé
REFUSÉ G0 — gestionnaire onfetch non gardé
REFUSÉ G0 — transport différé dans waitUntil
REFUSÉ G0 — branche gardée seulement hors navigateur
REFUSÉ G0 — chemin essai non listé
REFUSÉ G0 — interception des navigations essai
REFUSÉ G0 — interception à la deuxième requête
REFUSÉ G0 — TRIAL forcé à true
test-cache-scope : OK
✅ Artefact Pages combiné, liste blanche et routage local /essai/ vérifiés.
```

### Première suite E2E complète — avant la reprise

```bash
npm run test:e2e
```

Résultat : **échec, code 1**.

```text
Running 57 tests using 1 worker
...
2 failed
10 skipped
45 passed (4.5m)
```

Échec 1 — scénario L1-10 de stockage sous `iphone-13-webkit` :

```text
1) [iphone-13-webkit] › tools\e2e\lot1.spec.mjs:59:1 › L1-10 — stockage simulé à plus de 85 % : alerte parent et trois plus gros médias

   Error: page.evaluate: null

     66 |   await expect(page.locator(HOME_TILE_TALK)).toBeVisible();
     67 |   await expect(page.locator('#storage-warning')).toHaveCount(0);
   > 68 |   await page.evaluate(async () => {
       |      const db = await import('/db.js');
       |      const blob = (size) => new Blob([new Uint8Array(size)]);
       |      await db.putRecording({ id: 'e2e-media-video', key: 'model:e2e', ts: 1, kind: 'model', blob: blob(3 * 1024 * 1024) });
       at C:\Users\HP\Projets\kalimati-qoder\tools\e2e\lot1.spec.mjs:68:14
```

Échec 2 — contrôle G0 navigateur sous `pixel-5-chromium` :

```text
2) [pixel-5-chromium] › tools\e2e\trial-isolation.spec.mjs:368:1 › G0 navigateur — le worker principal v10.47 ignore /essai/ sans worker d’essai

   Error: expect(received).toMatch(expected)

   Expected pattern: /\.main-worker-fixture-\d+-current\.js$/
   Received string:  "http://127.0.0.1:4173/sw.js"

     395 |     396 |   await openTrialTalkGrid(page);
   > 397 |      expect(await trialController(page)).toMatch(/\.main-worker-fixture-\d+-current\.js$/);
       |  398 |      await expect(page.evaluate(async () =>
       |  399 |        (await navigator.serviceWorker.getRegistration('/essai/'))?.scope || '')).not.toMatch(/\/essai\/$/);
       |  400 |      await expect(await trialCacheName(page)).toBeNull();
       at C:\Users\HP\Projets\kalimati-qoder\tools\e2e\trial-isolation.spec.mjs:397:41
```

### Suites finales après correction — une seule exécution chacune

```bash
npm test
```

Résultat : **succès, code 0**. Sortie complète sauvegardée dans `test.log` (929 lignes). Extrait réel de fin :

```text
test-storage-warning : OK (8 vérifications).
(node:42392) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
🎉 test-backup-remind : OK (9 vérifications).
🎉 test-startup-timing : OK (12 vérifications).
🎉 test-voice-preload : OK (10 vérifications).
🎉 test-db-fallback : OK (7 vérifications).
REFUSÉ G0 — commentaire seul
REFUSÉ G0 — premier écouteur fetch non gardé
REFUSÉ G0 — gestionnaire onfetch non gardé
REFUSÉ G0 — transport différé dans waitUntil
REFUSÉ G0 — branche gardée seulement hors navigateur
REFUSÉ G0 — chemin essai non listé
REFUSÉ G0 — interception des navigations essai
REFUSÉ G0 — interception à la deuxième requête
REFUSÉ G0 — TRIAL forcé à true
test-cache-scope : OK
✅ Artefact Pages combiné, liste blanche et routage local /essai/ vérifiés.
```

```bash
npm run test:e2e
```

Résultat : **succès, code 0**. Sortie complète sauvegardée dans `e2e.log` (134 lignes). Extrait réel de fin :

```text
G0 Chromium : 935 entrées principales inchangées, aucun worker ni cache d’essai.
  ok 36 [pixel-5-chromium] › tools\e2e\trial-isolation.spec.mjs:368:1 › G0 navigateur — le worker principal v10.47 ignore /essai/ sans worker d’essai (5.7s)
G0 reproduit : 167 entrées /essai/ ajoutées au cache v10.45 avant la prise de main du worker d’essai.
  ok 37 [pixel-5-chromium] › tools\e2e\trial-isolation.spec.mjs:427:1 › G0 — un worker principal v10.45 déjà actif met encore /essai/ dans son cache (7.2s)
  ok 45 [chromium-sans-caches] › tools\e2e\lot1.spec.mjs:61:1 › L1-10 — stockage simulé à plus de 85 % : alerte parent et trois plus gros médias (6.3s)

  11 skipped
  46 passed (4.4m)
```

## Reprise autorisée après blocage

- Le contrôle G0 a été relancé seul sur le commit `12d5718` : **1 passed (20.1s)**. Il n’était donc pas préexistant.
- Cause identifiée : L1-08 activait un worker en attente au passage en arrière-plan, y compris pendant la navigation du scénario G0, et remplaçait ainsi le worker fixture par `sw.js`.
- Correction appliquée uniquement dans `modules/app-update.js` : l’activation est ignorée si le worker actif de la portée n’est pas un `sw.js`. Le test G0 n’a pas été modifié.
- Décision D-2 appliquée au scénario de stockage : Chromium uniquement, avec la raison inscrite dans `tools/e2e/lot1.spec.mjs` et la vérification sur vrai iPhone ajoutée aux points restants.

## Vérifié sur quels appareils

- Tests unitaires automatisés sous Windows avec Node `v26.13.0` : suite finale verte.
- Playwright `iphone-13-webkit` : trois scénarios L1-10 de dégradation verts ; scénario de stockage ignoré explicitement (décision D-2).
- Playwright `pixel-5-chromium` : les quatre scénarios L1-10 verts ; contrôle G0 navigateur vert.
- Playwright `chromium-sans-caches` : les quatre scénarios L1-10 verts.
- Suite E2E finale : **46 passed / 11 skipped (4.4m)**.
- Aucun vrai iPhone physique testé dans cette reprise.

## Points restants

- Vérifier l’alerte « Espace presque plein » sur un vrai iPhone.
