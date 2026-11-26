# Compte rendu — Lot 0 : version d’essai isolée

- **Date de mise à jour :** 2026-11-26
- **Branche locale :** `lot-0-essai-isole`
- **Base :** `essai`, après fusion de la PR #1 (`43f39e5`)
- **Ancêtre vérifié localement :** `c3060ab`
- **Périmètre :** L0-05, L0-06 et L0-12
- **PR existante :** https://github.com/Elguellouchi/Kalimati/pull/2
- **Commit de code poussé :** `5b450a8`
- **Push :** `2ff8b6e..5b450a8 lot-0-essai-isole -> lot-0-essai-isole`
- **Décision finale :** les deux suites locales demandées sont vertes ; le commit a été poussé et la PR #2 mise à jour. La CI Node 22 est rouge sur un seul scénario historique G0 car son checkout ne contient pas `c3060ab`. Arrêt sans nouvelle correction, conformément à la règle d’arrêt.

## Ce qui change pour la famille

La branche prépare une adresse d’essai séparée : `https://elguellouchi.github.io/Kalimati/essai/`.

En essai, le code prévu :

- enregistre les cartes et réglages dans de nouvelles bases locales ;
- préfixe les clés locales, la session Super-Admin et les caches ;
- limite le service worker d’essai à `/essai/` ;
- désactive Supabase et la cohorte, même si le Mode équipe est actif ;
- grise les commandes cloud ;
- affiche « Version d’essai » seulement en mode parent ;
- conserve l’export local du rapport clinique.

La version principale conserve ses données. Aucune donnée d’essai n’est copiée depuis la version principale.

**Rien n’est publié par cette exécution.** Le réglage GitHub Pages n’a pas été changé. La PR #2 n’a pas été fusionnée. Le site principal n’a pas été modifié.

## Exigences faites

- **L0-05 — code local :** bases `essai-kalimati` et `essai-kalimati-child-<id>`, clés préfixées, caches `kalimati-essai-v10-47`, caches vocaux séparés, worker d’essai limité à `/essai/`, garde `/essai/` dans le nouveau worker principal, artefact Pages combiné et workflow préparé.
- **L0-06 :** bandeau discret « Version d’essai », visible uniquement en mode parent d’essai.
- **L0-12 :** blocage Supabase et cohorte avant configuration, stockage ou transport ; commandes grisées ; export local conservé.
- **L0-11 :** chaque worker nettoie seulement les anciens caches de son propre espace.
- **Contrôle G0 durci :** le contrôle exécute le vrai worker dans un environnement de service worker réaliste, conserve tous les écouteurs `fetch`, attend leurs promesses et leurs effets, refuse `onfetch` et `TRIAL=true`, puis sonde des chemins non listés, navigations, paramètres, plages et répétitions.
- **Régression G0 :** huit contournements reproduits en rouge sont refusés : commentaire seul, premier écouteur non gardé, `onfetch` non gardé, transport différé dans `waitUntil`, branche gardée seulement hors navigateur, chemin non listé, navigation interceptée et interception à la deuxième requête. Le forçage `TRIAL=true` est également refusé.
- **Lancement E2E autonome :** `playwright.config.js` démarre `tools/serve.mjs --artifact` ; sans `SERVE_ROOT`, ce mode construit `_site` dans un dossier frère puis le sert. Un serveur existant n’est plus réutilisé.
- **Fixtures G0 :** les fichiers temporaires sont écrits dans le dossier réellement servi, avec le nom `g0.main-worker-fixture-<pid>.js`, sans point au début. Aucune vérification métier n’a été modifiée.
- **Décision G0 :** Aziz accepte, pour la première publication, le risque lié à un worker principal `v10.45` déjà installé. `check-pages-root.mjs` exige alors seulement l’égalité octet par octet de `sw.js` et `index.html` avec le site public. La garde G0 reste dans le code et les tests et sera exigée à partir de la prochaine version de `main` avec `--require-main-guard`. Cette décision est consignée dans `docs/PUBLIER.md` et dans la Spec.
- **Publication documentée :** `docs/PUBLIER.md` impose le lancement manuel immédiat du workflow après le passage autorisé de Pages sur GitHub Actions.

## Exigences non faites et pourquoi

### Points restants

1. **CI Node 22 rouge :** les jobs `tests` passent, mais les jobs `e2e` échouent sur le scénario historique `G0 — un worker principal v10.45 déjà actif met encore /essai/ dans son cache`. Le test exécute `git show c3060ab:sw.js`. Le checkout GitHub Actions ne contient pas ce commit et renvoie `fatal: invalid object name 'c3060ab'.` Les 34 autres scénarios navigateur passent ; 10 sont ignorés. Aucune nouvelle correction ni nouvelle relance n’a été lancée après ce constat.
2. **G0 — worker principal v10.45 déjà installé :** le critère historique « ouvrir directement `/essai/` sans rien ajouter au cache principal » reste non satisfait. Un worker v10.45 déjà actif ne peut pas apprendre après coup la nouvelle garde. Le test historique local a reproduit **142 entrées `/essai/` ajoutées au cache `kalimati-v10-45`** avant la prise de main du worker d’essai. Ce risque est accepté par Aziz pour la première publication ; la garde sera exigée à partir de la prochaine version de `main`.
3. **L0-05 — publication :** `/essai/` n’est pas en ligne. Le changement de Pages et le déploiement nécessitent un accord séparé.
4. **Vrai iPhone :** pas encore testé. WebKit ne remplace pas un iPhone réel.
5. **Promotion vers `main` :** non faite. Elle reste interdite sans validation réelle de 48 heures et autorisation explicite.

## Tests lancés et résultat

### Commande unitaire demandée — une seule exécution

```bash
npm test
```

Résultat : succès, code de sortie 0.

Dernières lignes réelles de la sortie :

```text
test-lot4-qualite : OK
✓ 17 fichiers de jeux : plus de bouton « suivant » après une bonne réponse
✓ pause de félicitation puis essai suivant tout seul ; rien si l’enfant a quitté le jeu
✓ les gestes de la vraie vie (« C’est fait ! ») et les notes de l’adulte restent à toucher
test-auto-next : OK
✓ pluriel français du jeu Compter
test-pluriel : OK
test-storage : OK
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

### Commande E2E demandée — une seule exécution après correction des fixtures

```bash
npm run test:e2e
```

Résultat réel : succès, code de sortie 0. La commande a construit puis servi seule l’artefact combiné.

Fin réelle de la sortie :

```text
G0 Chromium : 929 entrées principales inchangées, aucun worker ni cache d’essai.
G0 reproduit : 142 entrées /essai/ ajoutées au cache v10.45 avant la prise de main du worker d’essai.
10 skipped
35 passed (3.3m)
```

Tous les parcours demandés passent localement : ouverture, trois cartes, persistance, isolation des cartes et du stockage, badge, cloud bloqué, fragment de clé magique purgé, redirection `/essai` → `/essai/`, coexistence des workers et caches, scénarios G0 et hors ligne d’essai.

### CI GitHub Actions Node 22 du commit `5b450a8`

Workflow `push` : https://github.com/Elguellouchi/Kalimati/actions/runs/45724744519

Workflow `pull_request` : https://github.com/Elguellouchi/Kalimati/actions/runs/45724751234

Résultat réel des deux workflows : échec.

```text
tests : completed successfully, 24s
e2e : failed
  1 failed
  10 skipped
  34 passed
    Error: Command failed: git show c3060ab:sw.js
    fatal: invalid object name 'c3060ab'.
Error: Process completed with exit code 1.
```

Le job `e2e` du workflow `push` a duré 1 min 59 s et affiche `34 passed (1.3m)`. Le job `e2e` du workflow `pull_request` a duré 2 min 12 s et affiche `34 passed (1.6m)`. Les deux échouent avant les assertions du scénario historique, au chargement de sa source Git.

### Comparaison octet par octet avec le site actuel

```bash
node ../kalimati-qoder/tools/build-pages.mjs --main ../kalimati-main-check --essai ../kalimati-qoder --out _pages-site
node ../kalimati-qoder/tools/check-pages-root.mjs --site _pages-site --live https://elguellouchi.github.io/Kalimati/
```

Résultat réel, code de sortie 0 :

```text
Artefact Pages combiné : C:\Users\HP\Projets\kalimati-pages-check\_pages-site
OK sw.js local=12552/b01489aa7dfcdb8325a3d30ebea48971d5b35a6d6ab7b6ea3e6e7923891dd197 public=12552/b01489aa7dfcdb8325a3d30ebea48971d5b35a6d6ab7b6ea3e6e7923891dd197
OK index.html local=4713/3b72f539e969a61b1d08ab698feacecd3e64d18a9930d21de597ba79ae7f1c6c public=4713/3b72f539e969a61b1d08ab698feacecd3e64d18a9930d21de597ba79ae7f1c6c
```

Les deux fichiers de la racine publiable sont identiques au site actuel, octet par octet. La garde G0 n’est pas exigée pour cette première publication, conformément à la décision d’Aziz.

## Vérifié sur quels appareils

Vérifications automatiques lancées sur Windows :

- suite unitaire complète, y compris construction Pages, liste blanche, routage local `/essai/` et régressions G0 ;
- comparaison de l’artefact publiable avec le site public ;
- E2E local : 35 réussites, 10 ignorés, aucun échec.

Profils Playwright exécutés localement sur Windows contre l’artefact combiné :

- `iphone-13-webkit` : parcours principaux et essai verts ;
- `pixel-5-chromium` : parcours principaux, isolation, G0 et hors ligne verts ;
- `chromium-sans-caches` : parcours principaux et essai verts.

CI GitHub Node 22 :

- job `tests` : vert ;
- job `e2e` : rouge uniquement parce que le commit historique `c3060ab` est absent du checkout.

Il s’agit de profils navigateur émulés, pas d’appareils réels. Aucun vrai iPhone ou téléphone Android physique n’a été utilisé.

## Questions pour Aziz

La règle d’arrêt est appliquée. Aucune nouvelle correction ni nouvelle relance n’est engagée. Deux choix possibles pour la prochaine consigne :

1. **Récupérer tout l’historique dans le checkout du job E2E (`fetch-depth: 0`) :** le scénario historique retrouve exactement `c3060ab:sw.js` et toutes les vérifications restent inchangées. Risque faible ; le checkout CI sera plus long et plus lourd.
2. **Conserver une fixture historique exacte de `sw.js` au commit `c3060ab` :** le test utilise cette fixture au lieu de l’historique Git. Toutes les vérifications restent inchangées. Risque moyen : il faudra documenter et maintenir cette copie historique avec son SHA.

Le changement Pages, le déploiement, le vrai iPhone et les 48 heures avant promotion restent des décisions séparées.
