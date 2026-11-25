# Compte rendu — Lot 0, socle de tests et de publication (v10.46)

Date : 25/11/2026.

Dossier de travail : `C:\Users\HP\Projets\kalimati-qoder`.

Branche : `lot-0-socle`, créée depuis `origin/main`. Le commit requis `c3060ab` (v10.45) a été vérifié dans l’historique avec `git merge-base --is-ancestor c3060ab HEAD`.

La branche `essai` a été créée depuis `origin/main` et poussée sur `origin/essai` au commit `c3060ab`. La pull request #1 cible `essai`.

Aziz a autorisé un commit et une pull request vers `essai`. Aucun push vers `main` n’est autorisé.

## Ce qui change pour la famille

- Aucun nouvel écran, bouton ou jeu n’est ajouté.
- La version principale reste en v10.46. Les noms des clés de la version principale ne changent pas.
- Les cartes, photos, voix et réglages existants ne sont ni supprimés ni écrasés par cette livraison.
- La grille « Parler » s’ouvre plus vite. Les objectifs du PEI sont préparés au premier usage, au lieu de ralentir l’ouverture des cartes.
- La sauvegarde des cartes ne bloque plus l’affichage. Si elle échoue, un événement technique anonyme est écrit dans le journal local.
- L’installation du service worker attend la recopie des voix et images depuis l’ancien cache. Seuls les téléchargements réseau des fichiers absents, ou dont la recopie a échoué, peuvent continuer sans bloquer l’installation. Le site ne se recharge jamais tout seul.
- Un guide simple de publication est ajouté : `docs/PUBLIER.md`.
- La version d’essai n’est pas publiée. Elle ne doit donc pas encore être utilisée par la famille.

Aucune donnée personnelle d’enfant n’a été ajoutée. Aucune nouvelle requête vers un service externe n’a été ajoutée. La CSP de `index.html` n’a pas été modifiée.

## Exigences faites

- **L0-01** : `.github/workflows/tests.yml` lance `npm ci` puis `npm test` sur Node 22, à chaque push et à chaque pull request.
- **L0-02** : `@playwright/test` est uniquement dans `devDependencies`. `package-lock.json` est ajouté.
- **L0-03** : les scénarios E2E couvrent l’ouverture à froid, trois cartes dans la phrase, le rechargement, le fonctionnement sans caches et l’ouverture hors ligne.
- **L0-03b** : `tools/serve.mjs` utilise `node:http`, sans dépendance, sur le port 4173. Les fichiers JavaScript sont servis avec `application/javascript; charset=utf-8`.
- **L0-04** : le workflow lance Playwright sur WebKit et Chromium, avec `--trace off`.
- **L0-07** : `docs/PUBLIER.md` explique le parcours essai → 48 heures → `main`, en français simple.
- **L0-08** : deux options de licence ont été présentées. Aziz a choisi l’option A — tous droits réservés, pour l’instant. Aucun fichier `LICENSE` n’est créé dans cette livraison.
- **L0-09** : `.gitattributes` contient `* text=auto eol=lf`. Les lectures concernées normalisent aussi les `\r\n`, notamment dans `tools/test-auto-next.mjs`.
- **L0-10** : une seule fonction `storageKey(nom)` gère les clés `localStorage`. Le préfixe `essai-` est préparé pour le chemin `/essai/`, sans changer les clés principales. Un test interdit les appels directs à `localStorage` hors du module central.
- **L0-11** : le service worker ne supprime que les anciens caches de son propre espace. Les caches Amazigh et les caches étrangers sont conservés.
- **Version** : `modules/version.js`, `sw.js`, `package.json` et la méta de `index.html` sont alignés sur v10.46. Le nouveau `modules/storage.js` est ajouté au précache.

Travaux de réparation nécessaires :

- Les fins de ligne Windows ne cassaient plus les tests existants. Aucune assertion n’a été retirée ou affaiblie.
- Les erreurs d’écriture du stockage centralisé sont maintenant signalées à l’appelant. Un changement d’enfant refusé ne peut plus être annoncé comme réussi.
- Le test de rechargement ajoute une carte neutre par la vraie base de l’application, puis vérifie qu’elle reste présente.
- Les trois causes de lenteur du démarrage ont été corrigées sans augmenter le seuil de 3 secondes.
- Le premier échec WebKit en CI venait de l’attente d’actionnabilité de Playwright avant le toucher, pas de Kalimati : la grille mettait 10 ms à apparaître après le clic, mais `locator.click()` attendait environ 3 283 ms avant de l’envoyer. La mesure utilise maintenant un vrai événement DOM `click` pour ce seul scénario ; les parcours fonctionnels conservent de vrais clics et le seuil reste strictement inférieur à 3 secondes.
- Le test `test-cache-scope` exécute le vrai gestionnaire d'installation : plusieurs voix et images doivent être entièrement recopiées, un fichier absent ne bloque pas l'installation, et une recopie ratée est téléchargée ensuite pour éviter sa perte.

## Exigences non faites et pourquoi

- **L0-05 différée**, conformément à la validation : pas de publication `/essai/`, pas de workflow GitHub Pages et pas de préfixe IndexedDB `essai-` dans cette livraison.
  - Attention : le préfixe `localStorage` préparé par L0-10 ne protège pas IndexedDB.
  - Les noms de bases `essai-`, l’isolation complète des données et la publication doivent être faits ensemble avant toute mise en ligne de l’essai.
- **L0-06 différée avec L0-05** : pas de bandeau « Version d’essai », car aucune version d’essai n’est publiée.
- **L0-12 différée avec L0-05** : la synchronisation Supabase et la cohorte ne sont pas encore coupées et grisées dans une version d’essai. Le comportement de la version principale n’est pas modifié.
- **Fichier `LICENSE` non ajouté** : le choix de l’option A est consigné, mais aucun texte juridique n’a été rédigé dans ce lot. Une ouverture ultérieure reste possible.
- **GitHub Actions** : le workflow est écrit. Après diagnostic de l’attente d’actionnabilité de Playwright, le correctif `23588b0` est vert sur les quatre jobs `tests` et `e2e` des runs push `45604034926` et pull request `45604043472`. Sur la pull request #1, l’ouverture WebKit est mesurée à 601 ms et les tests navigateur terminent avec `10 passed (14.8s)` et deux sauts prévus.

## Tests lancés et résultat

Environnement local : Windows, Node `v26.13.0`. Le workflow GitHub utilise Node 22.

### 1. Suite complète

Commande exécutée :

```bash
npm test > test.log 2>&1
```

Résultat : code de sortie `0`.

Première ligne de résultat réelle :

```text
✅ Version cohérente : v10.46 (cache kalimati-v10-46).
```

La sortie complète est dans `test.log`. Voici ses 20 dernières lignes, sans modification :

```text
✓ espagnol : « Baño » (toilettes) et « Bañera » (bain) ne se confondent plus
✓ darija et amazigh : aucun mot ajouté sans relecture humaine
✓ « Thérapeute » traduite ; un prénom reste un prénom
✓ dictionnaires dans l’appli, gardés hors ligne, sans les notes de relecture
test-lot3-dictionnaires : OK
✓ app.js = chef d’orchestre (574 lignes) + 4 modules (bande, vues, outils adulte, sauvegarde)
✓ 11 langues : 100 % des menus (20), des textes (139) et des 93 cartes traduits
✓ amazigh : 4 menus, 2 cartes et 139 textes attendent un relecteur natif (liste figée)
✓ voix : 14 appels en français, tous sur un texte français ; Toilettes et routines dites dans la langue choisie
✓ une base par enfant : cartes, photos (visualKey), scènes, vidéos et journaux ne se croisent pas
✓ étoiles, habits, voix du parent : propres à chaque enfant ; enlever un enfant efface aussi ses voix
test-lot4-qualite : OK
✓ 17 fichiers de jeux : plus de bouton « suivant » après une bonne réponse
✓ pause de félicitation puis essai suivant tout seul ; rien si l’enfant a quitté le jeu
✓ les gestes de la vraie vie (« C’est fait ! ») et les notes de l’adulte restent à toucher
test-auto-next : OK
✓ pluriel français du jeu Compter
test-pluriel : OK
test-storage : OK
test-cache-scope : OK
```

Les avertissements Node sur `localStorage` sont des avertissements expérimentaux de l’environnement local. Ils ne font pas échouer la suite.

### 2. Tests navigateur

Commande exécutée :

```bash
npm run test:e2e > e2e.log 2>&1
```

Résultat : code de sortie `0`.

Sortie complète réelle :

```text

> kalimati@10.46 test:e2e
> playwright test


Running 12 tests using 1 worker

ouverture : navigation 273 ms, accueil 869 ms, toucher 47 ms, grille 156 ms
grille « Parler » affichée en 1345 ms
  ok  1 [iphone-13-webkit] › tools\e2e\critical-flows.spec.mjs:15:1 › a — ouverture à froid : la grille « Parler » s’affiche en moins de 3 s (2.0s)
ouverture : navigation 268 ms, accueil 856 ms, toucher 55 ms, grille 34 ms
  ok  2 [iphone-13-webkit] › tools\e2e\critical-flows.spec.mjs:21:1 › b — trois cartes touchées : la phrase contient les trois cartes (3.1s)
ouverture : navigation 288 ms, accueil 863 ms, toucher 46 ms, grille 69 ms
  ok  3 [iphone-13-webkit] › tools\e2e\critical-flows.spec.mjs:29:1 › c — rechargement : les cartes de l’enfant sont toujours là (4.1s)
  -   4 [iphone-13-webkit] › tools\e2e\offline.spec.mjs:13:1 › e — réseau coupé : l’application s’ouvre encore
ouverture : navigation 130 ms, accueil 99 ms, toucher 2064 ms, grille 23 ms
grille « Parler » affichée en 2316 ms
  ok  5 [pixel-5-chromium] › tools\e2e\critical-flows.spec.mjs:15:1 › a — ouverture à froid : la grille « Parler » s’affiche en moins de 3 s (8.4s)
ouverture : navigation 116 ms, accueil 92 ms, toucher 93 ms, grille 34 ms
  ok  6 [pixel-5-chromium] › tools\e2e\critical-flows.spec.mjs:21:1 › b — trois cartes touchées : la phrase contient les trois cartes (3.3s)
ouverture : navigation 128 ms, accueil 83 ms, toucher 99 ms, grille 42 ms
  ok  7 [pixel-5-chromium] › tools\e2e\critical-flows.spec.mjs:29:1 › c — rechargement : les cartes de l’enfant sont toujours là (3.1s)
ouverture : navigation 125 ms, accueil 83 ms, toucher 87 ms, grille 40 ms
réseau coupé : application rouverte en 399 ms
  ok  8 [pixel-5-chromium] › tools\e2e/offline.spec.mjs:13:1 › e — réseau coupé : l’application s’ouvre encore (3.2s)
ouverture : navigation 131 ms, accueil 95 ms, toucher 2067 ms, grille 22 ms
grille « Parler » affichée en 2315 ms
  ok  9 [chromium-sans-caches] › tools\e2e\critical-flows.spec.mjs:15:1 › a — ouverture à froid : la grille « Parler » s’affiche en moins de 3 s (8.2s)
ouverture : navigation 138 ms, accueil 84 ms, toucher 84 ms, grille 21 ms
  ok 10 [chromium-sans-caches] › tools\e2e\critical-flows.spec.mjs:21:1 › b — trois cartes touchées : la phrase contient les trois cartes (3.0s)
ouverture : navigation 134 ms, accueil 86 ms, toucher 87 ms, grille 23 ms
  ok 11 [chromium-sans-caches] › tools\e2e\critical-flows.spec.mjs:29:1 › c — rechargement : les cartes de l’enfant sont toujours là (2.7s)
  -  12 [chromium-sans-caches] › tools\e2e\offline.spec.mjs:13:1 › e — réseau coupé : l’application s’ouvre encore

  2 skipped
  10 passed (52.3s)
```

Les deux sauts sont prévus : le test hors ligne ne tourne que sur Chromium standard. WebKit ne permet pas de piloter correctement les service workers dans Playwright. Le profil sans caches simule justement leur absence.

Aucun test n’a été désactivé pour cacher un échec. Le seuil d’ouverture à froid reste strictement inférieur à 3 secondes.

### 3. Vérification ciblée des objectifs du PEI

Une vérification complémentaire a ouvert deux contextes Chromium neufs :

```json
{
  "defaults": {
    "expected": 134,
    "actual": 134,
    "allTodo": true
  },
  "concurrent": {
    "expected": 134,
    "actual": 134,
    "status": "done",
    "updatedAt": "2026-11-25T10:00:00.000Z"
  },
  "result": "objectifs PEI : OK"
}
```

Cela confirme que les 134 objectifs par défaut sont créés au premier usage et qu’une mise à jour simultanée n’est pas écrasée.

## Vérifié sur quels appareils

- iPhone 13 simulé par Playwright avec WebKit.
- Pixel 5 simulé par Playwright avec Chromium.
- Chromium de bureau sans `window.caches` ni service worker.
- Chromium de bureau avec service worker et réseau coupé.

Aucun téléphone ou tablette réel n’était branché. Les profils Playwright sont des simulations, pas une validation sur les appareils de la famille.

Le test hors ligne vérifie l’ouverture de l’application. Il ne remplace pas un essai manuel des voix, images, photos et données sur un vrai iPhone.

Contrôles distants définitifs du correctif `23588b0`, vérifiés sur la pull request #1 :

- Run push `45604034926` : job `tests` `139170096305` réussi, job `e2e` `139170095735` réussi.
- Run pull request `45604043472` : job `tests` `139170127779` réussi, job `e2e` `139170127374` réussi.
- Sur le run pull request, la sortie réelle donne `grille « Parler » affichée en 601 ms` pour WebKit, puis `2 skipped` et `10 passed (14.8s)`. Les deux sauts sont les tests hors ligne WebKit et Chromium sans caches, prévus par la configuration.

Le commit `5b9e9d0`, utilisé pour le diagnostic, reste rouge sur l’ancienne mesure WebKit ; il ne doit pas être confondu avec le correctif final `23588b0`.

## Questions pour Aziz

1. **Licence — option A retenue pour l’instant** : tous droits réservés. Une ouverture pourra être décidée plus tard. Aucun fichier `LICENSE` n’est ajouté dans ce lot.

2. **GitHub Pages — accepté pour plus tard** : le passage à « GitHub Actions » sera fait avec L0-05. Ce réglage peut provoquer une courte interruption du site.

3. **Site actuel — vérification requise** : le site en ligne doit être vérifié complètement avant la prochaine publication, car certains modules récents semblent ne pas être servis.

4. **Vrai iPhone — prévu après la mise en essai** : l’ouverture hors ligne, les voix et les images devront être vérifiées sur un appareil réel dès qu’il sera accessible.

5. **Commit et pull request — autorisés** : commit vers `lot-0-socle`, puis pull request vers `essai`. `AGENTS.md` est joint ; `Agent.md` est exclu.
