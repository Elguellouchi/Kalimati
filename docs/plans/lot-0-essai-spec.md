# Spec — Lot 0 : version d’essai isolée (L0-05, L0-06, L0-12)

- **Date :** 2026-11-25
- **Dépôt de travail :** `C:\Users\HP\Projets\kalimati-qoder`
- **Branche publiée :** `essai`
- **Adresse cible :** `https://elguellouchi.github.io/Kalimati/essai/`
- **Version applicative proposée :** `v10.47`
- **État :** validée le 2026-11-25, avec les trois conditions additionnelles consignées ci-dessous

## 1. Objectif

Publier la branche `essai` dans `/Kalimati/essai/`, avec des données locales neuves et isolées, sans synchronisation Supabase ni participation à la cohorte. La version principale reste disponible à `/Kalimati/` et conserve ses données de famille.

Cette Spec couvre uniquement :

- **L0-05 :** publication de l’essai, service worker distinct et limité à `/essai/` ;
- **L0-06 :** bandeau discret « Version d’essai » en mode parent ;
- **L0-12 :** synchronisation et cohorte coupées et grisées en essai.

Elle ne traite ni les sprints 1 à 8, ni une nouvelle fonctionnalité, ni la promotion de l’essai vers `main`.

## 2. Contraintes et invariants

1. Le clone autoritatif est uniquement `C:\Users\HP\Projets\kalimati-qoder`.
2. Le commit `c3060ab` doit rester un ancêtre du travail.
3. Aucune donnée personnelle d’enfant, secret, identifiant Supabase ou clé privée ne peut entrer dans le code, les tests, la Spec ou les artefacts publics.
4. Aucune nouvelle dépendance runtime, compilation, bundler ou modification de la CSP.
5. Aucun rechargement automatique de l’application et aucun `skipWaiting()` à l’installation.
6. Aucune nouvelle requête externe. Les appels ARASAAC, Wikimedia ou voix Google existants restent soumis au Mode équipe et au choix du parent.
7. L’essai ne doit jamais contacter Supabase, même si le Mode équipe est activé ou si une configuration cloud est restaurée depuis une sauvegarde.
8. L’essai ne doit jamais lire, écrire, récupérer ou supprimer une base ou un cache de la version principale.
9. Les transcriptions et fichiers de travail privés restent hors du dépôt et de l’artefact Pages.
10. Toute erreur attrapée ajoutée ou modifiée doit être journalisée localement, sans donnée personnelle.
11. Le travail suit la règle Git du projet : branche depuis `origin/essai`, PR vers `essai`, jamais de push direct vers `main`, jamais de force-push ou de réécriture d’historique.
12. Un commit, un push, une fusion ou un changement de réglage GitHub reste soumis à une autorisation explicite.

## 3. Arbitrages proposés

| Sujet | Décision proposée |
|---|---|
| Structure du code | Un seul code source, sensible au chemin `/essai/`. Aucun dossier applicatif dupliqué. |
| Données d’essai | Bases neuves `essai-kalimati` et `essai-kalimati-child-<id>`. Aucune copie des données principales. |
| Mode équipe | Il reste disponible pour les fonctions réseau déjà opt-in, mais ne réautorise jamais Supabase ni la cohorte en essai. |
| Rapport clinique local | L’export JSON local reste disponible dans Progrès. Il ne fait aucun réseau et ne contient que les données de l’espace ouvert. |
| Bandeau | Texte fixe « Version d’essai », affiché uniquement avec `html.trial` et `body.parent`. |
| Publication | Un seul artefact Pages : racine depuis `main`, sous-dossier `essai/` depuis `essai`. |
| Prérequis Git | PR #1 fusionnée dans `essai` le 2026-11-25 (`43f39e5`), afin de conserver `storageKey()`, les tests E2E et l’isolation déjà écrite. |
| Réglage Pages | Basculer **Settings → Pages → Source → GitHub Actions** seulement après accord explicite, puis lancer immédiatement le workflow manuellement. |

## 4. Approches comparées

### A. Code unique et espaces de stockage préfixés — recommandée

Le même code fonctionne à la racine et sous `/essai/`. Le chemin sélectionne les noms de bases, les clés, les caches et les permissions réseau.

- **Avantages :** pas de divergence, une seule version à tester, correction commune aux deux espaces.
- **Coût :** chaque point de stockage et de transport doit être vérifié.

### B. Application dupliquée dans `essai/`

Une seconde copie physique du code serait publiée dans le sous-dossier.

- **Avantages :** séparation visuelle simple.
- **Coût :** duplication, deux versions à maintenir, risque de publier un fichier privé et d’oublier une correction.
- **Décision :** écartée.

### C. Origine ou dépôt séparé

L’essai serait hébergé sur une autre adresse.

- **Avantages :** isolation native des bases et des caches.
- **Coût :** nouvelle adresse, hébergement et procédure de publication hors périmètre.
- **Décision :** écartée.

## 5. Détection de la version d’essai

`modules/storage.js` reste le point unique de détection :

- `KalimatiStorage.isTrial()` renvoie `true` lorsque le chemin contient le segment exact `essai`, y compris `/essai/`, `/Kalimati/essai/` et `/foo/essai/` ;
- `/essai-copie/`, `/autre/`, `/Kalimati/` et `/` sans ce segment restent en mode principal ;
- la détection dépend du chemin, pas d’un réglage modifiable par l’utilisateur ;
- `storageKey()` conserve son comportement actuel et ajoute `essai-` une seule fois ;
- `theme-boot.js` ajoute la classe `trial` sur `<html>` dès le chargement, avant l’affichage de l’application.

Le serveur de test accepte `/essai` avec une redirection vers `/essai/`, puis résout `/essai/...` vers les fichiers de la racine du dépôt. La protection contre la traversée de chemin reste inchangée.

## 6. Isolation des données locales

### 6.1 IndexedDB

`modules/child-profiles.js` calcule les noms selon l’espace courant :

| Espace | Profil principal | Autres profils |
|---|---|---|
| Principal | `kalimati` | `kalimati-child-<id>` |
| Essai | `essai-kalimati` | `essai-kalimati-child-<id>` |

Règles :

- le schéma interne reste en version 10 ;
- une base d’essai est créée à neuf, sans migration ni copie depuis la principale ;
- `recoverChildren()` ne recherche que le préfixe de l’espace courant ;
- `removeChild()` ne supprime que la base de l’espace courant ;
- le journal `diagnosticLog` passe par la même base active et devient donc `essai-kalimati` en essai ;
- les réglages cloud présents dans une sauvegarde restaurée en essai restent locaux et inertes.

### 6.2 localStorage et sessionStorage

- Toutes les clés localStorage continuent de passer par `storageKey()`.
- En essai, les clés deviennent `essai-<clé>`.
- La clé de déverrouillage Super-Admin gardée dans `sessionStorage` reçoit aussi le préfixe `essai-`, sans partager l’état entre les deux versions.
- Aucun accès direct supplémentaire à localStorage n’est introduit.

### 6.3 CacheStorage

| Ressource | Principal | Essai |
|---|---|---|
| Application | `kalimati-v10-47` | `kalimati-essai-v10-47` |
| Packs amazighes | `kalimati-amazigh-voices-…` | `kalimati-essai-amazigh-voices-…` |
| Voix parentales | `kalimati-amazigh-voices-parent-…[:enfant]` | `kalimati-essai-amazigh-voices-parent-…[:enfant]` |

Règles :

- `modules/version.js` exporte la version principale et expose aussi le nom du cache d’essai ;
- `sw.js`, qui ne peut pas importer de module ES, calcule son nom de cache depuis son propre chemin et une version vérifiée par `tools/test-version.mjs` ;
- l’activation d’un service worker ne supprime que les anciens caches applicatifs de son propre espace ;
- les caches de voix, les caches de l’autre espace et les caches étrangers sont conservés ;
- la suppression d’un profil ne supprime que ses caches vocaux dans l’espace courant ;
- les URLs relatives `/essai/voix/...` et `/essai/assets/...` empêchent une lecture croisée avec les URL principales.

## 7. Service worker et mise à jour

- L’essai sert son propre `sw.js` depuis `/essai/sw.js`.
- `modules/app-update.js` enregistre `./sw.js` avec `scope: './'` explicite.
- La portée du worker d’essai est donc `/Kalimati/essai/`.
- Le worker principal conserve la portée `/Kalimati/`.
- Dans `sw.js`, le worker principal ignore toutes les requêtes sous `/essai/`, y compris après installation préalable de la version principale `v10.45`.
- Le worker le plus spécifique contrôle une page d’essai et prend la main sans modifier le cache principal.
- L’installation attend toujours la recopie des voix et images depuis l’ancien cache ; seuls les téléchargements réseau peuvent suivre.
- Aucun `skipWaiting()` automatique ni rechargement spontané n’est ajouté.
- L’actualisation manuelle existante reste inchangée.

## 8. Coupure Supabase et cohorte

### 8.1 Défense en profondeur

`modules/cloud-sync.js` utilise le prédicat d’essai pour interdire le cloud avant tout effet :

1. `initCloudSyncFromUrlAndAuto()` ne lance aucune synchro automatique en essai.
2. `captureMagicKeyFromUrl()` retire `#key=` de l’adresse, mais ne retourne et n’enregistre aucune clé en essai.
3. `saveCloudSyncConfig()` n’enregistre pas de configuration cloud en essai.
4. Les opérations d’envoi, de retrait de scores et de suppression distante s’arrêtent avant leur transport.
5. `supabaseFetch()` et `fetchWithTimeout()` refusent aussi toute URL Supabase en essai, même si une fonction de haut niveau est appelée par erreur.
6. Le refus est un message local clair, sans URL, clé ou donnée de famille, et l’erreur est journalisée sans PII.

Le Mode équipe ne modifie pas ce blocage.

### 8.2 Interface parent

Dans Progrès → Synchronisation, l’état disponible vaut :

`cloudAutorise = isTeamMode() && !isTrial()`.

En essai, les éléments suivants sont désactivés et grisés, même si le Mode équipe est actif :

- synchronisation manuelle et automatique ;
- inclusion des photos et voix parentales ;
- clé familiale, URL Supabase et clé publique ;
- enregistrement de la configuration Cloud ;
- copie de la clé ou du lien magique ;
- consigne WhatsApp de synchronisation ;
- consentement à la cohorte ;
- retrait des scores du serveur ;
- suppression du paquet chiffré distant.

Un message indique : « Version d’essai : synchronisation et cohorte désactivées. Les données restent sur cet appareil. »

Les métriques locales et le bouton d’export JSON local restent lisibles et actifs. Aucun serveur d’étude n’est appelé.

Le texte du Mode équipe précise que, dans l’essai, les fonctions cloud restent indisponibles.

### 8.3 Liens et invitations

- `checkUrlInvite()` peut rester local : il travaille dans la base d’essai et ne fait pas de réseau.
- Les liens d’invitation et d’équipe générés depuis l’essai pointent vers `/Kalimati/essai/`, jamais vers la racine principale.
- Le lien magique de synchronisation n’est ni affiché ni copiable en essai.

## 9. Bandeau « Version d’essai »

- Un élément statique discret est ajouté près de la barre parent.
- Il est masqué par défaut.
- Il devient visible uniquement avec `html.trial body.parent`.
- Il disparaît dès le retour en mode enfant.
- Il n’apparaît jamais dans la version principale.
- Aucun texte supplémentaire, animation ou action n’est ajouté.

## 10. Publication GitHub Pages

### 10.1 Artefact combiné

Un script Node sans dépendance construit `_site` :

- racine de `_site` : fichiers runtime de `main` ;
- `_site/essai/` : fichiers runtime de `essai` ;
- `.nojekyll` est ajouté à la racine.

Liste blanche de fichiers runtime :

- `index.html`, `boot-guard.js`, `theme-boot.js`, `style.css`, `app.js`, `db.js`, `data.js`, `speech.js`, `media.js`, `editor.js`, `backup.js`, `manifest.webmanifest`, `sw.js` ;
- dossiers `assets/`, `icons/`, `locales/`, `modules/`, `voix/`.

Seuls les éléments présents dans la branche source sont copiés. `index.html`, `app.js` et `sw.js` sont obligatoires dans chaque source. Une sortie manquante ou un chemin dangereux fait échouer la construction.

Sont exclus : `.git`, `.github`, `docs`, `tools`, `scripts`, `supabase`, `node_modules`, `test-results`, `playwright-report`, `test.log`, `Agent.md`, `AGENTS.md`, transcriptions et fichiers de travail privés.

### 10.2 Workflow

`.github/workflows/pages.yml` :

- se déclenche sur `push` de `main` et `essai`, et manuellement ;
- utilise un seul déploiement Pages à la fois pour éviter les courses ;
- récupère les deux branches dans des dossiers séparés ;
- installe les dépendances de développement de `essai` avec `npm ci` ;
- lance `npm test` sur `essai` ;
- construit l’artefact combiné ;
- lance les E2E contre l’artefact combiné, avec la racine principale réelle et `/essai/` réel ;
- publie avec `upload-pages-artifact` puis `deploy-pages` ;
- n’exige aucun secret GitHub applicatif.

Le workflow de tests existant continue de valider chaque push et chaque PR sur Node 22.

### 10.3 Comparaison avec le site actuel

Avant toute publication, comparer octet par octet les fichiers `sw.js` et `index.html` de la racine de l’artefact combiné avec les fichiers actuellement servis par le site principal. Consigner les deux empreintes SHA-256 et le résultat dans le compte rendu. Toute différence bloque la publication jusqu’à explication et correction.

### 10.4 Séquence de publication

1. Spec validée et PR #1 fusionnée dans `essai` (`43f39e5`).
2. Créer `lot-0-essai-isole` depuis `origin/essai` à jour.
3. Écrire le plan d’implémentation, puis développer en TDD.
4. Obtenir les autorisations de commit, push et PR vers `essai`.
5. Vérifier la CI verte, construire l’artefact combiné et effectuer la comparaison octet par octet avec le site actuel.
6. Envoyer le compte rendu final avant tout changement du réglage Pages.
7. Obtenir l’autorisation de fusionner l’essai validé et de basculer Pages vers **GitHub Actions**.
8. Immédiatement après la bascule, lancer le workflow `pages.yml` manuellement depuis l’onglet Actions ; cette étape est aussi écrite dans `docs/PUBLIER.md`.
9. Laisser le workflow publier, puis vérifier la racine et `/essai/`.
10. Attendre 48 heures de tests réels avant toute promotion vers `main`. Ce lot ne pousse jamais vers `main`.

## 11. Fichiers concernés

### Application

- `modules/storage.js`
- `modules/child-profiles.js`
- `modules/voice-packs.js`
- `modules/version.js`
- `modules/cloud-sync.js`
- `modules/team-mode.js`
- `modules/admin-beta.js`
- `modules/app-update.js`
- `theme-boot.js`
- `index.html`
- `style.css`
- `sw.js`
- `package.json`

### Tests, serveur et publication

- `tools/test-storage.mjs`
- `tools/test-children.mjs`
- `tools/test-cache-scope.mjs`
- `tools/test-version.mjs`
- `tools/test-privacy-network.mjs`
- nouveaux tests ciblés pour l’isolation, le blocage cloud et la construction Pages ;
- `tools/serve.mjs`
- `tools/e2e/support.mjs`
- nouveaux scénarios dans `tools/e2e/`
- `.github/workflows/pages.yml`
- `tools/build-pages.mjs`
- `docs/PUBLIER.md`, après publication effective ;
- `docs/comptes-rendus/lot-0-essai.md`, avec les vraies sorties de tests.

## 12. Plan de tests

### 12.1 Tests unitaires

1. **Détection :** `/essai/`, `/Kalimati/essai/` et `/foo/essai/` activent l’essai ; `/essai-copie/`, `/autre/`, `/Kalimati/` et `/` restent principaux.
2. **Stockage local :** préfixe simple, absence de double préfixe, lecture/écriture isolées.
3. **IndexedDB :** noms principal/enfants, récupération limitée à l’espace, suppression limitée à l’espace.
4. **Caches vocaux :** préfixes distincts, y compris les voix parentales par enfant.
5. **Service worker :** cache principal et cache d’essai, portée explicite, nettoyage sans toucher l’autre espace, absence de `skipWaiting()` automatique.
6. **Version :** `v10.47` cohérente entre module, HTML, package et deux noms de cache.
7. **Réseau :** blocage Supabase aux fonctions de haut niveau et au transport, retrait de `#key=` sans enregistrement, Mode équipe insuffisant.
8. **Construction Pages :** racine depuis `main`, essai depuis `essai`, exclusions respectées, fichiers obligatoires contrôlés.
9. **Garde-fou existant :** aucun appel direct à localStorage hors `modules/storage.js`.

### 12.2 Tests E2E

Sur l’artefact combiné :

1. Les parcours principaux existants passent sur WebKit et Chromium.
2. Le scénario sans `window.caches` passe toujours.
3. Un même contexte navigateur ouvre la racine puis `/essai/` : les clés et bases ne se croisent pas et les données principales restent intactes.
4. Une carte ou un réglage neutre créé en essai persiste après rechargement, sans apparaître en principal, et inversement.
5. Le bandeau est absent en principal, invisible en mode enfant d’essai et visible en mode parent d’essai.
6. Après activation locale du Mode équipe dans l’essai, les commandes Supabase/cohorte restent désactivées.
7. Aucune requête vers Supabase n’est observée pendant l’ouverture, le Mode équipe, l’URL `#key=` et les actions cloud tentées.
8. En Chromium, le service worker d’essai a la portée `/essai/` et un cache `kalimati-essai-v10-47`.
9. Les caches principal et essai coexistent sans suppression croisée.
10. Un navigateur neuf installe d’abord le service worker principal `v10.45`, puis ouvre `/essai/` : le cache principal reste inchangé, le worker d’essai prend la main et le worker principal ignore les requêtes sous `/essai/`.
11. `/essai` redirige vers `/essai/`.
12. Hors ligne : l’essai s’ouvre et conserve ses données sur Chromium. WebKit reste exclu de ce scénario, comme pour le Lot 0.

Les mesures E2E utilisent uniquement des marqueurs neutres. Aucun vrai prénom d’enfant n’est utilisé.

### 12.3 Vérifications après publication

- `/Kalimati/` sert toujours la version principale ;
- `/Kalimati/essai/` affiche `v10.47` en mode parent ;
- les modules, le manifest et le service worker d’essai répondent en HTTP 200 ;
- le scope enregistré est `/Kalimati/essai/` ;
- les noms de bases et de caches sont séparés ;
- aucune requête Supabase n’est observée en essai ;
- les fichiers privés et outils ne sont pas accessibles dans l’artefact ;
- les données principales ne changent pas après ouverture et utilisation de l’essai.

## 13. Erreurs et limites

- Si le stockage est bloqué, l’application conserve son comportement existant : lecture sûre, écriture signalée, repli mémoire pour le journal.
- Si CacheStorage ou le service worker est indisponible, l’essai fonctionne sans cache, comme la version principale.
- Si une opération cloud est appelée par erreur en essai, elle est refusée avant `fetch`.
- Si un fichier runtime obligatoire manque, la construction Pages échoue et aucun nouvel artefact n’est publié.
- Si un déploiement échoue, le dernier déploiement Pages valide reste servi.
- Les données navigateur ne sont jamais supprimées pour corriger un déploiement.
- Le test iPhone réel reste à effectuer après mise en essai ; il ne peut pas être remplacé par WebKit.

## 14. Rollback

1. Corriger par un nouveau commit sur `essai`, sans réécrire l’historique, puis redéployer l’artefact combiné.
2. Si Pages lui-même est défaillant, revenir temporairement à la publication par branche `main` : la racine est restaurée, mais `/essai/` peut disparaître.
3. Ne jamais supprimer les bases ou caches navigateur pour effectuer un rollback.
4. Ne jamais pousser de force et ne jamais promouvoir un essai défaillant vers `main`.

## 15. Critères d’acceptation

- [ ] `https://elguellouchi.github.io/Kalimati/` reste disponible après publication.
- [ ] `https://elguellouchi.github.io/Kalimati/essai/` s’ouvre en `v10.47`.
- [ ] Les bases IndexedDB d’essai sont préfixées `essai-`.
- [ ] Les clés localStorage et la clé session Super-Admin d’essai sont isolées.
- [ ] Les caches applicatifs et vocaux d’essai sont préfixés et ne suppriment rien en principal.
- [ ] Le service worker d’essai est limité à `/essai/`.
- [ ] Avec un worker principal `v10.45` préinstallé, `/essai/` n’ajoute rien au cache principal et le worker d’essai prend la main.
- [ ] Le worker principal ignore les requêtes sous `/essai/`.
- [ ] Le bandeau « Version d’essai » n’apparaît qu’en mode parent d’essai.
- [ ] Supabase et la cohorte sont coupées et grisées, même avec Mode équipe.
- [ ] Aucune requête Supabase n’est observée en essai.
- [ ] L’export local du rapport clinique reste disponible sans réseau.
- [ ] L’artefact Pages contient la racine et l’essai, sans outil ni fichier privé.
- [ ] Les `sw.js` et `index.html` de la racine de l’artefact sont identiques octet par octet au site actuel, avec empreintes consignées.
- [ ] `docs/PUBLIER.md` impose le lancement manuel immédiat du workflow après la bascule Pages vers GitHub Actions.
- [ ] `npm test` et `npm run test:e2e` sont verts avec leurs vraies sorties consignées.
- [ ] Aucun push vers `main`, aucune réécriture d’historique et aucune suppression de données famille.

## 16. Hors périmètre

- migration ou copie de données principales vers l’essai ;
- fusion automatique entre essai et principal ;
- nouvelle interface de synchronisation ;
- modification de la CSP ;
- nouvelle dépendance runtime ;
- rechargement automatique ;
- promotion vers `main` ;
- sprints 1 à 8 et autres pépites.
