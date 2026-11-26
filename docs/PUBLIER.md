# Publier Kalimati

## État actuel — 25/11/2026

La version d’essai n’est pas encore publiée. L’adresse `https://elguellouchi.github.io/Kalimati/essai/` ne doit donc pas être utilisée pour tester.

L0-05, L0-06 et L0-12 sont implémentés et vérifiés dans la branche de travail, mais ils ne sont pas publiés. Le contrôle de publication confirme que `sw.js` et `index.html` de la racine publiable sont identiques octet par octet au site public. Pour la première publication, Aziz accepte le risque G0 lié au worker principal v10.45 déjà installé : seule l’égalité octet par octet est exigée. Le compte rendu du lot contient les mesures exactes.

Ne copiez pas manuellement des fichiers dans le site pour créer une version d’essai.

## Règles à respecter

1. Tester d’abord sur la version d’essai.
2. Attendre 48 heures de tests réels.
3. Publier le site principal une fois par semaine au maximum.
4. Ne jamais forcer une publication sur `main`.
5. Ne publier aucune photo, voix, phrase, prénom d’enfant ou secret.
6. Garder les tests verts avant toute publication.

## Quand la version d’essai sera prête

### 1. Première publication : risque G0 accepté

Un navigateur qui possède encore le service worker principal v10.45 peut ajouter des fichiers `/essai/` au cache `kalimati-v10-45`. Ce worker ancien ne peut pas apprendre après coup la nouvelle garde. Le test E2E conserve ce worker historique au commit `c3060ab` et reproduit la contamination.

Aziz accepte ce risque pour la première publication. Le contrôle `check-pages-root.mjs` exige alors seulement l’égalité octet par octet de `sw.js` et `index.html` avec le site public. La garde G0 reste dans le code et dans les tests ; elle sera exigée à partir de la prochaine version de `main` avec l’option `--require-main-guard`.

La racine de `main` reste inchangée pendant cette première publication. Aucune opération d’alignement séparée n’est nécessaire. Pour un ancien navigateur déjà contrôlé par v10.45, ouvrir d’abord le site principal reste recommandé avant d’ouvrir `/essai/`.

### 2. Autoriser la publication automatique

Dans les réglages GitHub du dépôt :

- ouvrir **Settings** ;
- ouvrir **Pages** ;
- choisir **GitHub Actions** comme source.

Ce réglage doit être fait par Aziz. Il peut provoquer une courte interruption du site.

### 3. Lancer le workflow immédiatement

Juste après le passage de Pages sur **GitHub Actions** :

- ouvrir **Actions** ;
- sélectionner **Pages — Kalimati principal et essai** ;
- cliquer **Run workflow** ;
- lancer l’exécution sur la branche contenant le workflow validé ;
- attendre le résultat sans modifier `main`.

Si **Run workflow** n’est pas proposé, le workflow doit encore être présent sur la branche par défaut. Ne pas contourner cette règle : demander l’autorisation nécessaire pour le rendre disponible avant le lancement manuel.

Le workflow construit deux artefacts séparés. L’artefact de test place le code courant à la racine et dans `essai/` pour exécuter tous les E2E. L’artefact publiable place `main` à la racine et `essai` dans `essai/` ; c’est lui qui est comparé octet par octet au site public puis déployé. Ne jamais publier uniquement `essai/` : cela supprimerait le site principal.

### 4. Vérifier l’essai publié

Après une exécution réussie, ouvrir `https://elguellouchi.github.io/Kalimati/essai/` et vérifier que la page affiche « Version d’essai » en mode parent.

### 5. Tester pendant 48 heures

Faire les parcours habituels sur les appareils de la famille :

- parler avec les cartes ;
- couper le réseau et rouvrir l’application ;
- vérifier les photos et les voix ;
- vérifier que les données de la version principale n’ont pas changé.

Noter tout problème. Ne pas publier sur `main` tant qu’un problème reste ouvert.

### 6. Publier le site principal

Après 48 heures sans problème, et seulement avec une autorisation explicite :

- fusionner `essai` dans `main` ;
- exécuter le workflow et vérifier qu’il termine ;
- ouvrir `https://elguellouchi.github.io/Kalimati/` ;
- vérifier que la nouvelle version s’ouvre.

Ne pas utiliser `git push --force`.

## Commandes de contrôle avant publication

```bash
npm test
node tools/build-pages.mjs --main . --essai . --out ../kalimati-pages-check/_site
node tools/build-pages.mjs --main ../kalimati-main-check --essai . --out ../kalimati-pages-check/_pages-site
node tools/check-pages-root.mjs --site ../kalimati-pages-check/_pages-site --live https://elguellouchi.github.io/Kalimati/
npm run test:e2e -- --trace off
```

Les commandes de test et de construction doivent réussir. `_site` est l’artefact de test du code courant ; `_pages-site` est l’artefact publiable `main` + `essai/`. Le contrôle de publication reste bloqué tant qu’une différence octet par octet subsiste. Le worktree `../kalimati-main-check` doit être intact et les dossiers de sortie séparés des sources.

`npm run test:e2e` construit et sert désormais l’artefact combiné sans variable à préparer. La commande nue utilise le dossier frère `kalimati-qoder-e2e/_site` et refuse de réutiliser un serveur déjà présent. Pour vérifier un artefact déjà construit, `SERVE_ROOT=../kalimati-pages-check/_site npm run test:e2e -- --trace off` reste possible.

Le compte rendu du lot doit contenir la vraie sortie des tests, les tailles et empreintes SHA-256 de `sw.js` et `index.html`, ainsi que l’état de G0.
