# Compte rendu — Lot 0 : version d’essai isolée

- **Date :** 2026-11-25
- **Branche :** `lot-0-essai-isole`
- **Base :** `essai`, après fusion de la PR #1 (`43f39e5`)
- **Ancêtre vérifié :** `c3060ab`
- **Périmètre :** L0-05, L0-06 et L0-12

## Ce qui change pour la famille

La branche prépare une adresse d’essai séparée : `https://elguellouchi.github.io/Kalimati/essai/`.

En essai :

- les cartes et réglages sont enregistrés dans de nouvelles bases locales ;
- les clés locales, la session Super-Admin et les caches ont leurs propres noms ;
- le service worker d’essai ne contrôle que `/essai/` ;
- Supabase et la cohorte sont désactivés, même si le Mode équipe est actif ;
- les commandes cloud sont grisées ;
- le mot « Version d’essai » apparaît seulement en mode parent ;
- l’export local du rapport clinique reste disponible.

La version principale conserve ses données. Aucune donnée d’essai n’est copiée depuis la version principale.

**Rien n’est encore publié.** Le réglage GitHub Pages n’a pas été changé. La nouvelle PR n’a pas été fusionnée. Le site principal n’a pas été modifié.

## Exigences faites

- **L0-05 — partie code :** bases `essai-kalimati` et `essai-kalimati-child-<id>`, clés préfixées, caches `kalimati-essai-v10-47`, caches vocaux séparés, worker d’essai limité à `/essai/`, garde `/essai/` dans le nouveau worker principal, artefact Pages combiné et workflow préparé.
- **L0-06 :** bandeau discret « Version d’essai », visible uniquement en mode parent d’essai.
- **L0-12 :** blocage Supabase et cohorte avant configuration, stockage ou transport ; commandes grisées ; aucun départ Supabase observé en essai, même avec Mode équipe.
- **L0-11 :** chaque worker nettoie seulement les anciens caches de son propre espace.
- **Publication :** `docs/PUBLIER.md` impose le lancement manuel immédiat du workflow après le passage de Pages sur GitHub Actions.

## Exigences non faites et pourquoi

- **L0-05 — publication :** `/essai/` n’est pas encore en ligne. Le changement de Pages et le déploiement nécessitent l’accord d’Aziz après ce compte rendu.
- **G0 — worker principal v10.45 déjà installé :** le critère « ouvrir directement `/essai/` sans rien ajouter au cache principal » n’est pas satisfait. Un worker v10.45 déjà actif ne peut pas apprendre après coup la nouvelle garde. Le test E2E reproduit **142 entrées `/essai/` ajoutées au cache `kalimati-v10-45`** avant la prise de main du worker d’essai. Le worker d’essai prend bien la main ensuite.
- **Première publication :** la racine actuelle de `main` est identique au site public, mais elle ne contient pas la garde G0. Une racine corrigée serait donc différente du site public. Le workflow qui exige l’égalité octet par octet et la garde G0 ne peut pas effectuer seul cette première mise à jour corrigée. Une opération d’alignement séparément autorisée, ou une décision explicite, est nécessaire.
- **Vrai iPhone :** pas encore testé. WebKit ne remplace pas un iPhone réel.
- **Promotion vers `main` :** non faite. Elle reste interdite sans validation réelle de 48 heures et autorisation explicite.

## Tests lancés et résultat

### Tests unitaires et contrôles locaux

Commande lancée :

```bash
npm test > test.log 2>&1
```

Résultat : succès, code de sortie 0.

Dernières 20 lignes réelles de `test.log` :

```text
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
✅ Artefact Pages combiné, liste blanche et routage local /essai/ vérifiés.
```

Avertissements Node réels, sans échec :

```text
(node:22784) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(node:416) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(node:36532) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(node:34616) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(node:37304) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(node:31384) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
```

### Tests E2E

Commandes de construction et de lancement :

```bash
node tools/build-pages.mjs --main . --essai . --out ../kalimati-pages-check/_site
CI=1 PORT=4187 SERVE_ROOT=../kalimati-pages-check/_site npm run test:e2e -- --trace off > e2e.log 2>&1
```

Résultat réel :

```text
Running 42 tests using 1 worker

  8 skipped
  34 passed (2.9m)
```

Preuves notables :

```text
grille « Parler » affichée en 1252 ms
grille « Parler » affichée en 2339 ms
grille « Parler » affichée en 2426 ms
réseau coupé : application rouverte en 547 ms
essai hors ligne : application et carte rouvertes en 502 ms
G0 reproduit : 142 entrées /essai/ ajoutées au cache v10.45 avant la prise de main du worker d’essai.
```

Les huit tests sautés sont les scénarios hors ligne ou service worker non pris en charge par WebKit, et les trois scénarios réservés à Chromium dans le profil sans caches. Aucun test n’a échoué.

### Comparaison octet par octet avec le site actuel

Commande lancée :

```bash
node tools/build-pages.mjs --main ../kalimati-main-check --essai . --out ../kalimati-pages-check/_pages-site
node tools/check-pages-root.mjs --site ../kalimati-pages-check/_pages-site --live https://elguellouchi.github.io/Kalimati/ --require-main-guard
```

Résultat réel :

```text
OK sw.js local=12552/b01489aa7dfcdb8325a3d30ebea48971d5b35a6d6ab7b6ea3e6e7923891dd197 public=12552/b01489aa7dfcdb8325a3d30ebea48971d5b35a6d6ab7b6ea3e6e7923891dd197
OK index.html local=4713/3b72f539e969a61b1d08ab698feacecd3e64d18a9930d21de597ba79ae7f1c6c public=4713/3b72f539e969a61b1d08ab698feacecd3e64d18a9930d21de597ba79ae7f1c6c
BLOQUÉ G0 — comportement fetch du worker principal sur /essai/
Publication bloquée : différence octet par octet ou G0 non résolu.
```

Les deux fichiers de la racine publiable sont donc identiques au site actuel, octet par octet. Le contrôle échoue uniquement parce que le worker principal public intercepte encore `/essai/`. Le contrôle G0 exécute maintenant le gestionnaire `fetch` du worker publié ; un commentaire ou une branche inatteignable ne peut plus le satisfaire.

Contrôle des artefacts :

- `_site` : 2 787 fichiers, 0 lien, 0 chemin interdit ;
- `_pages-site` : 2 785 fichiers, 0 lien, 0 chemin interdit ;
- aucun outil, document privé, transcription, fichier temporaire ou marqueur de test trouvé dans les artefacts.

Audit des ajouts de la branche et du diff local : aucun secret potentiel, prénom interdit, hôte Supabase explicite ou hôte externe non autorisé détecté. La CSP et les dépendances déclarées sont inchangées par rapport à `essai`.

## Vérifié sur quels appareils

Vérifications automatiques lancées sur Windows avec Node `v26.13.0` et Playwright :

- profil `iphone-13-webkit` : parcours principaux, isolation, bandeau et blocage cloud ;
- profil `pixel-5-chromium` : mêmes parcours, service workers et hors ligne ;
- profil `chromium-sans-caches` : parcours sans CacheStorage.

Il s’agit de profils navigateur émulés, pas d’appareils réels. Aucun vrai iPhone ou téléphone Android physique n’a été utilisé. La CI GitHub Node 22 doit encore confirmer la livraison après création de la PR.

## Questions pour Aziz

1. **G0 :** autoriser une opération distincte pour aligner le worker principal public, ou choisir explicitement une autre solution avant la publication. Le workflow actuel reste bloqué volontairement.
2. **Publication :** après lecture de ce compte rendu, décider de la fusion de la PR vers `essai`, puis du passage de Pages sur GitHub Actions et du lancement manuel immédiat.
3. **Validation réelle :** prévoir le test sur un vrai iPhone après la mise en essai, puis attendre 48 heures avant toute promotion vers `main`.
