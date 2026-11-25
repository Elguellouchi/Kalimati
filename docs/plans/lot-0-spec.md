# Spec Lot 0 — Socle de tests et de publication (v10.46)

Spec validée par Aziz le 24/11/2026, avec les ajouts L0-09, L0-10, L0-11 et L0-12 relus le 25/11/2026.

Base vérifiée : `C:\Users\HP\Projets\kalimati-qoder`, branche `lot-0-socle`, commit `c3060ab` (v10.45) présent dans l’historique. La branche locale `essai` a été créée depuis `origin/main`, sans publication.

## 1. Périmètre livré

- L0-01 : workflow GitHub Actions pour `npm ci` puis `npm test`, sur Node 22, à chaque push et pull request.
- L0-02 : `@playwright/test` uniquement en dépendance de développement, avec `package-lock.json`.
- L0-03 et L0-03b : cinq scénarios E2E et serveur local `node:http` sur le port 4173. Les fichiers JavaScript sont servis avec `application/javascript; charset=utf-8`, conformément à l’en-tête mesuré.
- L0-04 : job E2E du workflow, avec Chromium et WebKit installés.
- L0-07 : guide de publication en français simple.
- L0-08 : deux options de licence présentées dans le compte rendu, sans choix ni fichier `LICENSE`.
- L0-09 : `.gitattributes` (`* text=auto eol=lf`) et lecture normalisée des fins de ligne dans `test-auto-next.mjs`.
- L0-10 : fonction centrale `storageKey(nom)` et test interdisant les appels directs à `localStorage` hors du module central.
- L0-11 : nettoyage du service worker limité à son propre espace de caches, dès maintenant.

L0-05, L0-06 et L0-12 sont différés ensemble. Il n’y a donc ni publication `/essai/`, ni bandeau, ni préfixe IndexedDB, ni désactivation Supabase dans cette livraison. La détection du chemin et le préfixe localStorage sont préparés par L0-10 ; la désactivation Supabase et cohorte sera codée avec L0-05, conformément à la décision d’Aziz.

## 2. Réparations de la porte de tests

La porte de départ était rouge à cause des fins de ligne Windows : les tests découpaient le code sur `\n}\n` alors que les fichiers étaient lus avec `\r\n`.

- `tools/app-source.mjs`, `tools/test-auto-next.mjs` et `tools/test-pluriel.mjs` normalisent maintenant `\r\n` en `\n` à la lecture.
- Aucune assertion n’a été retirée ou affaiblie.
- `npm test` est repassé en vert avant l’ajout des nouveaux tests.

## 3. Tests E2E

Trois profils Playwright :

- `iphone-13-webkit` : appareil iPhone 13 avec WebKit ;
- `pixel-5-chromium` : appareil Pixel 5 avec Chromium ;
- `chromium-sans-caches` : Chromium sans `window.caches` ni service worker, pour simuler Chrome sur iPhone.

Scénarios :

1. ouverture à froid et grille « Parler » visible en moins de 3 s ;
2. trois cartes touchées et présentes dans l’ordre dans la bande de phrase ;
3. rechargement et cartes toujours présentes ;
4. mêmes parcours sans caches ;
5. réseau coupé et application rouverte.

Le scénario hors ligne tourne seulement sur `pixel-5-chromium`. Playwright ne pilote pas les service workers sous WebKit. Le profil sans caches doit aussi le sauter : il simule justement leur absence. Les tests sont sérialisés pour ne pas fausser la mesure d’ouverture à froid.

## 4. Stockage local centralisé (L0-10)

Nouveau fichier `modules/storage.js`, chargé comme script classique avant `theme-boot.js` pour conserver l’application synchrone du thème avant le premier affichage.

- Une seule fonction `storageKey(nom)`.
- Hors du segment de chemin `/essai/`, le nom de clé reste strictement inchangé.
- Sous `/essai/`, le préfixe `essai-` est ajouté une seule fois.
- La façade `KalimatiStorage` expose `getItem` et `setItem` ; seul ce module accède à `localStorage`.
- Les six clés concernées sont : thème, ouverture des réglages parent, voix préférées, enfant actif, liste des enfants et étoiles par enfant.
- `perChildKey` continue à servir aux noms de caches vocaux ; il ne devient pas une deuxième fonction de préfixe localStorage.
- `sessionStorage` n’est pas modifié.
- Le stockage indisponible reste silencieux, comme aujourd’hui.

Le test `tools/test-storage.mjs` exécute le vrai module avec un chemin principal, un chemin d’essai et un stockage bloqué. Il vérifie aussi les écritures réelles dans une mémoire contrôlée, l’ordre des scripts, le précache et l’absence d’appel direct ailleurs.

## 5. Nettoyage des caches (L0-11)

Dans `sw.js`, le filtre d’activation devient :

- version principale : seuls les caches `kalimati-v…` peuvent être supprimés ;
- future version d’essai : seuls les caches `kalimati-essai-v…` peuvent être supprimés ;
- les caches `kalimati-amazigh-voices-…` et les caches étrangers sont toujours conservés.

Le test `tools/test-cache-scope.mjs` exécute le vrai gestionnaire `activate` avec les deux espaces de noms. Aucun `/essai/` n’est publié pour autant.

## 6. Version et fichiers de service

Passage en v10.46 :

- `modules/version.js` : `APP_VERSION` et `CACHE_VERSION` ;
- `sw.js` : `CACHE` ;
- `package.json` : `version` ;
- `index.html` : méta de version.

`./modules/storage.js` est ajouté à la liste de précache de `sw.js`. La nouvelle version déclenchera le téléchargement normal du cache hors ligne, sans rechargement automatique.

## 7. Fichiers prévus

Nouveaux : `.github/workflows/tests.yml`, `.gitattributes`, `playwright.config.js`, `tools/e2e/*.spec.mjs`, `tools/serve.mjs`, `tools/test-storage.mjs`, `tools/test-cache-scope.mjs`, `modules/storage.js`, `docs/PUBLIER.md`, `docs/comptes-rendus/lot-0.md`, `package-lock.json`.

Modifiés : `package.json`, `modules/version.js`, `sw.js`, `index.html`, `theme-boot.js`, `app.js`, `speech.js`, `modules/about.js`, `modules/child-profiles.js`, `modules/rewards-kids.js`, `.gitignore`, `tools/app-source.mjs`, `tools/test-auto-next.mjs`, `tools/test-pluriel.mjs`, `tools/test-theme.mjs`, `tools/test-lot4-qualite.mjs`, `tools/test-children.mjs`.

Aucun workflow de publication Pages n’est créé tant que L0-05 est différé.

## 8. Ordre d’exécution et vérification

1. Ajouter les tests L0-10 et L0-11 et vérifier qu’ils échouent sur le code actuel.
2. Ajouter le module de stockage, migrer les six clés et faire passer le test de stockage.
3. Borner le nettoyage du service worker et faire passer le test de caches.
4. Terminer le workflow, le guide, la version et les audits.
5. Lancer `npm test > test.log 2>&1` et `npm run test:e2e`, sans masquer leur code de sortie.
6. Écrire le compte rendu avec les vraies sorties et les limites d’appareils.

Aucun commit, push ou pull request sans autorisation écrite d’Aziz.

## 9. Limites constatées

- Aucun téléphone ou tablette réel n’est branché : seuls les profils Playwright peuvent être exécutés ici.
- La publication actuelle semble partiellement ancienne : la page répond, mais certains modules récents ne sont pas servis. Ce point sera signalé à Aziz, sans correction hors Lot 0.
- Le choix de licence reste ouvert et la compatibilité exacte avec les ressources tierces devra être vérifiée avant toute licence ouverte.
