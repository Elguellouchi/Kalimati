# Cahier des charges développeur — Kalimati v11 « Socle clinique »

| Élément | Valeur |
|---|---|
| Date | 24 novembre 2026 |
| Base de départ | Dépôt `Elguellouchi/kalimati`, branche `main`, commit `c3060ab` (v10.45) |
| Version cible | v11.0 (fin du Lot 8) |
| Propriétaire produit | Aziz (non technique : toute question se pose en français simple) |
| Documents liés | « Audit stratégique Kalimati » et « Feuille de route technique Kalimati » (24/11/2026) |
| Langue du code | Commentaires et textes d'interface en français. Noms de variables en anglais, comme l'existant |

**Comment lire ce document.**
- « DOIT » = obligatoire. « NE DOIT PAS » = interdit. « PEUT » = au choix du développeur.
- Chaque exigence a un numéro (ex. `L2-04`). Chaque commit cite les numéros traités.
- Une exigence non testée n'est pas terminée.
- En cas de doute : **ne pas deviner**. Appliquer la « décision par défaut » de la section 14, puis la signaler dans le compte rendu.

---

## 0. Le développeur est un agent IA (Qoder)

Ce cahier est exécuté par **Qoder** (mode Quest, « Spec First », exécution locale), sous le contrôle d'Aziz, avec une relecture de Claude avant chaque acceptation.
- Les règles permanentes sont dans `AGENTS.md` à la racine du dépôt. Qoder le lit automatiquement.
- Ce cahier est copié dans le dépôt sous `docs/cahier-des-charges-v11.md`.
- **Un lot = une demande Quest.** Jamais deux lots ensemble.
- Les consignes exactes à coller pour chaque lot sont dans « Consignes a coller dans Qoder - lots 0 a 8.md ».
- Les durées en jours sont des repères pour un développeur humain. Avec Qoder, le vrai délai dépend surtout des relectures.
- Toute affirmation « tests passés » DOIT être accompagnée de la vraie sortie de la commande.

---

## 1. Contexte en 6 lignes

Kalimati est une application web installable (PWA) de communication par images (CAA) pour enfants autistes non verbaux.
Elle fonctionne hors ligne. Les données restent dans le téléphone (IndexedDB).
Langues : français, darija (lettres latines et arabes), arabe, 4 variétés amazighes, 8 langues du monde.
Elle est publiée sur GitHub Pages : `https://elguellouchi.github.io/Kalimati/`.
Un seul vrai utilisateur aujourd'hui. Objectif : 5 familles test, puis 50, avec une mesure clinique.
Ce lot de travaux corrige les faiblesses techniques. **Il n'ajoute aucun jeu.**

---

## 2. Pile technique existante (à respecter)

| Sujet | Existant | Règle |
|---|---|---|
| Langage | JavaScript ES modules, sans framework, sans étape de compilation | NE DOIT PAS ajouter React, Vue, TypeScript, bundler |
| Point d'entrée | `index.html` → `theme-boot.js`, `boot-guard.js`, `app.js` (569 lignes) + `modules/*.js` | Nouveau code dans de nouveaux fichiers `modules/*.js` |
| Base locale | `db.js`, IndexedDB, `DB_VERSION = 10`, une base par enfant (`activeDbName()` dans `modules/child-profiles.js`) | Toute nouvelle table = montée de version, sans perte de données |
| Hors ligne | `sw.js`, cache `kalimati-v10-45` | Mettre à jour la liste des fichiers mis en cache pour chaque nouveau fichier |
| Version | `modules/version.js` (`APP_VERSION`, `CACHE_VERSION`), `sw.js` (`CACHE`), `package.json` | Les 3 changent ensemble. Vérifié par `tools/test-version.mjs` |
| Tests | `npm test` = 32 scripts Node dans `tools/` | Tous doivent passer avant chaque commit |
| Sécurité | CSP dans `index.html` (`script-src 'self'`) | NE DOIT PAS ajouter de script externe ni de `unsafe-eval` |
| Voix | `speech.js` : mp3 pré-enregistrés (`voix/`), voix du parent (IndexedDB), synthèse du téléphone en secours | Ne pas changer l'ordre de priorité des voix |
| Erreurs | `modules/error-log.js`, 150 entrées, sans donnée personnelle | Toute nouvelle erreur attrapée DOIT y être écrite |
| Dépendances | Aucune à l'exécution | Une dépendance de développement (Playwright) est autorisée, Lot 0 |

---

## 3. Règles non négociables (s'appliquent à tous les lots)

| N° | Règle |
|---|---|
| G-01 | **Aucune donnée d'enfant dans le code ni dans le dépôt** : pas de prénom réel, photo, voix, phrase. Aucun prénom interdit ne doit apparaître dans un fichier ajouté ou modifié. |
| G-02 | **Rien ne sort du téléphone** sans action explicite de l'adulte. Aucune nouvelle requête réseau, sauf celles listées ici. Le test `tools/test-privacy-network.mjs` DOIT rester vert. |
| G-03 | **Aucune copie** de code, mot, image, voix ou disposition d'une application payante (Proloquo2Go, TD Snap, LAMP, TouchChat, Grid). Pas de code GPL/AGPL (Cboard, AsTeRICS Grid). |
| G-04 | **Les cartes ne bougent jamais** sans action explicite de l'adulte (voir Lot 2). |
| G-05 | **Aucune mention « validé médicalement », « soigne », « diagnostic », « thérapie »** dans l'interface ou le site. |
| G-06 | **Pas de rouge, pas de son d'échec, pas d'alerte** en mode enfant. |
| G-07 | **Rétrocompatibilité** : un téléphone en v10.45 qui passe en v11 garde toutes ses cartes, photos, voix, réglages, essais, journaux. |
| G-08 | **Avant chaque push** : `git fetch origin main` et comparer. Une autre source (équipe IA automatique, Aziz) peut avoir publié. Ne jamais forcer (`--force`) sur `main`. |
| G-09 | **Une publication sur `main` par semaine au maximum**, après 48 h sur la version d'essai (Lot 0). |
| G-10 | **Mode « mouvement réduit »** (réglage existant et `prefers-reduced-motion`) respecté par toute nouvelle animation. |

---

## 4. Appareils de test obligatoires

Chaque lot DOIT être vérifié sur ces 4 configurations avant publication.

| Code | Appareil | Navigateur | Particularité connue |
|---|---|---|---|
| D1 | iPhone (iOS 17 ou plus) | Safari, appli installée sur l'écran d'accueil | IndexedDB peut se bloquer en arrière-plan ; mode silencieux coupe la synthèse vocale |
| D2 | iPhone | **Chrome iOS** | **Pas de `caches` ni de service worker** : tout doit marcher sans |
| D3 | Android bon marché (2 Go de RAM, Android 11+) | Chrome | Lenteur, peu d'espace libre |
| D4 | Tablette (iPad ou Android 10 pouces) | Navigateur par défaut | Grande grille |

En automatique : Playwright avec les profils `iPhone 13` (WebKit) et `Pixel 5` (Chromium), plus un profil Chromium où `window.caches` est supprimé (simule D2).

---

## 5. Lot 0 — Socle de tests et de publication

**But :** aucune régression n'arrive chez les familles. Durée estimée : 3 à 4 jours.

### Exigences

| N° | Exigence |
|---|---|
| L0-01 | Créer `.github/workflows/tests.yml`. Il DOIT lancer `npm ci` puis `npm test` à chaque push et chaque pull request, sur Node 22. |
| L0-02 | Ajouter `@playwright/test` en dépendance de développement **uniquement** (`devDependencies`). Ajouter `package-lock.json`. |
| L0-03 | Créer `tools/e2e/` avec au moins ces scénarios, lancés par `npm run test:e2e` : (a) ouverture à froid → la grille « Parler » s'affiche en moins de 3 s ; (b) toucher 3 cartes → la phrase contient les 3 cartes ; (c) rechargement → les cartes sont toujours là ; (d) même chose sans `window.caches` ; (e) passage en hors ligne → l'appli s'ouvre encore (sauf profil sans caches). |
| L0-03b | Les tests E2E servent le site avec un petit serveur `tools/serve.mjs` écrit avec `node:http` (aucune dépendance), port 4173, en-têtes identiques à GitHub Pages pour les fichiers `.js` (`application/javascript`, mesuré le 24/11). |
| L0-04 | Le workflow DOIT lancer `npm run test:e2e` sur les profils WebKit et Chromium. Option `--trace off`. |
| L0-05 | Créer une **version d'essai** : la branche `essai` est publiée dans le sous-dossier `/essai/` du site (GitHub Pages via Actions). Le service worker de `/essai/` DOIT avoir un nom de cache différent (`kalimati-essai-…`) et une portée limitée à `/essai/`. |
| L0-06 | La version d'essai DOIT afficher un bandeau discret « Version d'essai » en mode parent seulement. |
| L0-07 | Ajouter `docs/PUBLIER.md` : étapes exactes pour publier (essai → 48 h → `main`), en français simple. |
| L0-09 | (ajout 24/11, relevé par Qoder) Ajouter `.gitattributes` (`* text=auto eol=lf`) ET rendre `tools/test-auto-next.mjs` insensible aux fins de ligne Windows (`\r\n`). |
| L0-10 | (ajout 24/11) Toutes les clés `localStorage` passent par une seule fonction `storageKey(nom)` qui ajoute le préfixe `essai-` dans la version d'essai. Un test vérifie qu'aucun fichier n'appelle `localStorage` directement. |
| L0-11 | (ajout 24/11) `sw.js` : à l'activation, ne supprimer que les caches de son propre espace (`kalimati-v…` pour la version principale, `kalimati-essai-…` pour l'essai). |
| L0-12 | (ajout 24/11) Dans la version d'essai, la synchronisation Supabase et la cohorte sont coupées et grisées. L'essai ne parle jamais au serveur de la vraie étude. |
| L0-08 | Ajouter un fichier `LICENSE` : **ne pas choisir seul**. Créer une pull request séparée avec 2 options (tous droits réservés / licence ouverte) et attendre le choix d'Aziz. |

### Critères d'acceptation
- Un commit qui casse un test affiche une croix rouge sur GitHub.
- Les 5 scénarios E2E passent sur Chromium ; sur WebKit, tous sauf (e) hors ligne, que Playwright ne sait pas piloter (service worker). Le cas (e) est vérifié à la main sur iPhone.
- L0-05 (publication de `/essai/`) peut être fait dans une 2e demande, après le réglage GitHub Pages « Source : GitHub Actions » fait par Aziz.
- `https://elguellouchi.github.io/Kalimati/essai/` s'ouvre et n'écrase pas les données de la version principale. **Attention :** même domaine, donc même IndexedDB. La version d'essai DOIT utiliser des noms de base préfixés `essai-` (paramètre lu depuis le chemin) pour ne jamais toucher aux vraies données.

---

## 6. Lot 1 — Fiabilité (zéro écran vide, zéro perte de données)

**But :** la voix de l'enfant ne tombe jamais en panne. Durée estimée : 5 à 6 jours.

### Exigences

| N° | Exigence |
|---|---|
| L1-01 | **Stockage durable.** Au premier toucher de l'adulte après installation, appeler `navigator.storage.persist()` si disponible. Aujourd'hui, seul `modules/admin-beta.js` (ligne 256) le fait. Enregistrer le résultat dans le réglage `storagePersisted` (`true`/`false`/`'unsupported'`). |
| L1-02 | Dans « Progrès » (mode parent), afficher une ligne : « Stockage protégé : oui / non ». Si « non » sur iPhone : texte d'aide « Ajoutez Kalimati à l'écran d'accueil pour protéger vos données. » |
| L1-03 | **Rappel de sauvegarde.** Si aucune sauvegarde depuis 14 jours, afficher en mode parent (jamais en mode enfant) : « Dernière sauvegarde il y a N jours. » avec un bouton vers la sauvegarde existante. Réglage `lastBackupAt` écrit par la sauvegarde existante. |
| L1-04 | **Budget de démarrage.** Deuxième ouverture (hors ligne, données en place) : grille visible en moins de **1,5 s** sur D3. Première ouverture en 4G : moins de **4 s**. Mesure : `performance.now()` entre le début de `app.js` et le premier rendu de la grille, écrite dans le journal d'erreurs si dépassement (type `UX_FRICTION`, sans donnée personnelle). |
| L1-05 | **Budget du son.** Du toucher au début du son : moins de **300 ms** pour une carte avec mp3 en cache ou voix du parent. Mesure par l'événement `playing` de l'élément audio. Dépassement > 800 ms → entrée `AUDIO_SILENT` ou `UX_FRICTION` dans le journal. |
| L1-06 | **Pré-chargement des voix** de la page visible : au rendu d'une page, charger en mémoire les fichiers voix des cartes visibles (au plus 40). |
| L1-07 | **Échec de la base.** Si IndexedDB ne s'ouvre pas en 6 s (déjà géré par `db.js`), l'appli DOIT afficher la grille de départ (`defaultCards()`) en lecture seule, avec la voix, et le message parent « Mode secours : vos cartes reviendront au prochain démarrage. » L'enfant DOIT pouvoir parler même dans ce cas. |
| L1-08 | **Mise à jour sans coupure.** Conserver la règle actuelle : nouvelle version appliquée seulement quand l'appli passe en arrière-plan. NE DOIT JAMAIS recharger la page pendant que l'enfant touche des cartes. |
| L1-09 | **Espace plein.** Si `navigator.storage.estimate()` indique plus de 85 % utilisé : message parent « Espace presque plein » + liste des 3 plus gros éléments (vidéos modèles, voix, photos) avec leur taille. |
| L1-10 | **Test de non-régression** pour chaque cas : base bloquée, sans `caches`, mode silencieux simulé (synthèse indisponible), espace plein simulé. |

### Critères d'acceptation
- Sur D1 et D2 : 30 ouvertures successives sans écran vide (test manuel, noté dans le compte rendu).
- Scénarios E2E L1-07 et L1-10 verts.
- Mesures L1-04 et L1-05 relevées sur D1, D2, D3 et notées dans le compte rendu.

---

## 7. Lot 2 — Places fixes des cartes (plan moteur inviolable)

**But :** une carte garde sa place pour toujours. La main de l'enfant apprend le chemin. Durée estimée : 4 à 5 jours.

### Problème actuel (vérifié)
`index.html` propose 4 tailles (`#cols` : 2, 3, 4 ou 5 colonnes). Changer de taille appelle `relayout()` (`modules/grid-layout.js`, ligne 40, appelé dans `modules/backup-ui.js`, ligne 138). Toutes les cartes reçoivent une nouvelle place. Les anciennes places sont perdues.

### Nouveau modèle de données
Chaque carte garde **une place par taille de grille** :

```js
// Champ ajouté à chaque carte (store « cards »)
card.positions = {
  '2': { row: 3, col: 1 },
  '3': { row: 2, col: 2 },
  '4': { row: 1, col: 4 },
  '5': { row: 1, col: 4 },
};
// gridRow / gridCol restent écrits = position de la taille active, pour compatibilité.
```

### Exigences

| N° | Exigence |
|---|---|
| L2-01 | Migration (montée `DB_VERSION` 10 → 11) : pour chaque carte, créer `positions[colsActuel] = { row: gridRow, col: gridCol }`. Les autres tailles sont calculées **une seule fois** par la règle L2-03, puis figées. |
| L2-02 | Changer la taille (`#cols`) NE DOIT modifier **aucune** valeur de `positions`. Il change seulement la taille lue. `relayout()` NE DOIT plus être appelé par ce réglage. |
| L2-03 | Règle de calcul pour une taille jamais utilisée : ordre de lecture (ligne puis colonne) de la taille active, rempli de gauche à droite dans la nouvelle taille. Calculé une fois, enregistré, jamais recalculé. |
| L2-04 | Ajouter une carte : elle prend la **première case libre** dans chaque taille, sans déplacer les autres. |
| L2-05 | Cacher une carte (`hidden: true`) : sa case reste vide et réservée, dans toutes les tailles. |
| L2-06 | Supprimer une carte : sa case reste vide. Elle n'est réattribuée que si l'adulte ajoute une carte ensuite (L2-04). |
| L2-07 | Déplacer une carte : seulement par glisser-déposer en mode parent (`modules/drag.js` existant), seulement dans la taille active. Afficher avant : « Déplacer change le geste appris par l'enfant. Continuer ? » (2 touchers). |
| L2-08 | Ajouter un bouton parent « Remettre en ordre automatique » (l'ancien comportement de `relayout`) avec la même confirmation en 2 touchers. C'est le **seul** chemin vers `relayout()`. |
| L2-09 | **Identifiant stable.** Ajouter `card.wordId` (voir Lot 3). Pour les cartes existantes : `wordId = id` actuel. Ne jamais régénérer `id` depuis le texte d'une langue. |
| L2-10 | **Empreinte des places.** Fonction `layoutFingerprint(cards)` = liste triée `wordId:taille:row:col`, puis empreinte SHA-256 (Web Crypto). Stockée dans le réglage `layoutFingerprint` après chaque action adulte. |
| L2-11 | Au démarrage, si l'empreinte calculée ≠ l'empreinte stockée **sans action adulte** : entrée dans le journal d'erreurs (`UX_FRICTION`, texte « places modifiées sans action adulte »), sans rien corriger automatiquement. |
| L2-12 | Test `tools/test-motor-plan.mjs` : (a) changer de taille 2→5→3→2 ne change aucune place ; (b) ajouter, cacher, supprimer ne déplace aucune autre carte ; (c) les paliers (`applyProgressiveStage`) ne déplacent rien ; (d) restauration d'une sauvegarde garde les places ; (e) synchro (`cloud-sync.js`) garde les places. À ajouter à `npm test`. |
| L2-13 | Sauvegarde (`backup.js`) et synchro DOIVENT transporter `positions` et `wordId`. Une sauvegarde v10 sans `positions` DOIT se restaurer avec la règle L2-01. |

### Critères d'acceptation
- Test L2-12 vert.
- Test manuel D1 : noter les places de 10 cartes, passer par les 4 tailles, revenir : places identiques.

---

## 8. Lot 3 — Lexique relu (vocabulaire de 250 à 400 mots)

**But :** construire l'outil qui reçoit les mots choisis par les orthophonistes, avec le nom du relecteur. **Le développeur ne choisit pas les mots.** Durée estimée : 6 à 7 jours.

### Fichier source rempli par les orthophonistes
Un tableau CSV (UTF-8, séparateur `;`), une ligne par mot, nommé `lexique/lexique-v1.csv`.

| Colonne | Obligatoire | Exemple | Règle |
|---|---|---|---|
| `wordId` | oui | `w-vouloir` | `w-` + minuscules, chiffres, tirets. Unique. Ne change jamais. |
| `niveau` | oui | `noyau` | `noyau` (mots de base) ou `frange` (mots de thème) |
| `palier` | oui | `1` | 1, 2, 3 ou 4 (ordre de dévoilement) |
| `categorie` | oui | `base` | Une des catégories de `data.js` (`base`, `manger`, …) ou une nouvelle, déclarée dans `lexique/categories.csv` |
| `role` | oui | `verb` | `person`, `verb`, `noun`, `adj`, `social` (couleurs de `GRAMMAR`) |
| `emoji` | oui | `🙋` | Image par défaut |
| `fr` | oui | `Je veux` | Texte affiché |
| `dr_lat` | oui | `Bghit` | Darija lettres latines |
| `dr_ar` | oui | `بغيت` | Darija lettres arabes |
| `ar` | non | `أُرِيدُ` | Arabe standard, avec voyelles si possible |
| `pos_2`, `pos_3`, `pos_4`, `pos_5` | oui | `1:1` | Place `ligne:colonne` pour chaque taille. Choisie par l'orthophoniste. |
| `relecteur_fr` | oui pour publier | `Orthophoniste A` | Nom ou initiales, accord de la personne |
| `relecteur_dr` | oui pour publier | `Orthophoniste B` | Locuteur natif darija |
| `date_relecture` | oui pour publier | `2026-12-15` | Format AAAA-MM-JJ |
| `note` | non | — | Texte libre |

### Exigences

| N° | Exigence |
|---|---|
| L3-01 | Script `tools/import-lexique.mjs` : lit le CSV, vérifie chaque ligne, écrit `modules/lexique-data.js` (export `LEXIQUE`). Refuse tout le fichier si une erreur existe et liste les erreurs (numéro de ligne, colonne, raison). |
| L3-02 | Vérifications : `wordId` unique ; deux mots NE PEUVENT PAS avoir la même place dans la même catégorie et la même taille ; `col` ≤ taille ; champs obligatoires présents ; aucun prénom réel ni prénom de la liste `tools/prenoms-interdits.txt`. |
| L3-03 | Chaque mot reçoit un **statut de relecture** calculé : `brouillon` (aucun relecteur), `relu-langue` (relecteur_dr seul), `relu-clinique` (relecteur_fr et relecteur_dr et date). |
| L3-04 | En mode parent, chaque carte affiche une petite pastille : ⚪ brouillon, 🟡 relu langue, 🟢 relu clinique. En mode enfant : rien. |
| L3-05 | Réglage parent « Afficher seulement les mots relus » (par défaut : **activé** pour les nouvelles familles, **désactivé** pour les téléphones déjà installés, pour ne rien retirer à l'enfant). |
| L3-06 | Fusion avec les cartes existantes : un mot du lexique dont le `wordId` correspond à une carte existante met à jour textes et statut, **jamais** la photo, la voix du parent, `hidden`, ni `positions` déjà fixées par l'adulte. |
| L3-07 | Les cartes créées par la famille (photos de la maison, personnes) ne sont jamais supprimées par l'import. |
| L3-08 | Page parent « Lexique » : nombre de mots par statut, par palier, par catégorie. Exemple : « 312 mots : 280 relus clinique, 20 relus langue, 12 brouillons. » |
| L3-09 | Mettre à jour `tools/test-lot3-dictionnaires.mjs` : aucun texte d'interface ne contient « validé » sauf « relu par ». |
| L3-10 | Fournir `lexique/lexique-exemple.csv` avec les **21 mots** de `CORE_MOTOR_PLAN_V1` (`modules/core-vocabulary-plan.js`), statut `brouillon`, pour tester sans attendre les orthophonistes. |
| L3-11 | Voix : un mot sans mp3 utilise la chaîne actuelle de `speech.js`. Le script DOIT produire `lexique/voix-manquantes.csv` (wordId, langue) pour la fabrication des voix. Le développeur NE DOIT PAS générer de voix par un service en ligne sans accord écrit d'Aziz. |
| L3-12 | (ajout 25/11, source : vidéos MIND Institute) Colonne CSV facultative `fonction` : `demande`, `commentaire`, `refus`, `social`, `question`. Remplie par l'orthophoniste. Valeur vide acceptée. Sert au Lot 4 (L4-12). |
| L3-13 | (ajout 25/11) Réglage parent « Teinte de peau des personnages » (5 teintes + jaune par défaut), appliqué aux emojis de personnes qui l'acceptent (modificateurs Unicode). Aucun changement sur les photos. |
| L3-14 | (ajout 25/11) Chaque mot affiché en darija ou en amazigh exige 2 relectures indépendantes (`relecteur_dr` + un 2e locuteur dans `note`) avant le statut `relu-clinique`. Une traduction mot à mot ne suffit pas : le sens culturel compte. |

### Critères d'acceptation
- Import de `lexique-exemple.csv` : 21 mots, aucune erreur.
- Import d'un CSV avec 2 mots à la même place : refus, message clair.
- Téléphone v10.45 mis à jour : les 93 cartes, photos et voix sont intactes.

---

## 9. Lot 4 — Journal des mots dits (dans le téléphone)

**But :** savoir quels mots l'enfant utilise, quand, et seul ou avec modèle. Base de toute mesure. Durée estimée : 4 à 5 jours.

### Nouvelle table IndexedDB `utterance_log` (montée de version)

```js
{
  id: 'u-<horodatage>-<aléa>',   // clé
  ts: 1764000000000,             // ms depuis 1970
  day: '2026-11-24',             // jour local AAAA-MM-JJ (index)
  wordIds: ['w-vouloir', 'w-eau'],
  source: 'enfant' | 'modele',   // 'modele' si le mode « Je montre (adulte) » est actif (state.modeling)
  mode: 'carte' | 'phrase',      // 'carte' = un toucher qui parle ; 'phrase' = ▶ de la bande de phrase
  lang: 'dr',                    // langue active
  page: 'base',                  // catégorie ou page affichée
  session: 's-…' | null          // séance de mesure (Lot 5), sinon null
}
```

### Exigences

| N° | Exigence |
|---|---|
| L4-01 | Écrire une entrée à chaque carte qui parle (`mode: 'carte'`) et à chaque lecture de phrase (`mode: 'phrase'`). Point d'accroche existant : `learnTap()` dans `modules/aac-plus.js` et la lecture dans `modules/strip-controller.js` (lignes 152 et 224). |
| L4-02 | Ne pas écrire : les touchers en mode parent (édition), les jeux, les cartes rejetées par l'anti-tremblement. |
| L4-03 | Écriture groupée : file en mémoire, écrite toutes les 5 s ou au passage en arrière-plan (`visibilitychange`). Jamais d'attente de l'écriture avant de parler. |
| L4-04 | Conservation : 400 jours. Purge au démarrage des entrées plus anciennes. |
| L4-05 | **Confidentialité** : le journal NE DOIT PAS être dans la synchro Supabase. Il NE DOIT PAS être dans la sauvegarde par défaut. Une case « Inclure le journal des mots » (décochée par défaut) l'ajoute à la sauvegarde. |
| L4-06 | Réglage parent « Journal des mots » : activé par défaut, avec explication « Gardé seulement dans ce téléphone. » Bouton « Effacer le journal » (2 touchers). |
| L4-07 | Page parent « Mots dits » avec, pour une période choisie (7 jours, 30 jours, tout) : nombre de messages seul / avec modèle ; nombre de mots différents ; mots nouveaux (jamais dits avant la période) ; les 20 mots les plus dits ; mots jamais dits depuis 30 jours. Comptes séparés **enfant** et **modèle**. |
| L4-08 | Graphique simple par semaine (barres en SVG fait main, pas de librairie) : messages « enfant » par semaine. Couleurs non rouges. |
| L4-09 | Export **CSV** (une ligne par entrée, colonnes = champs ci-dessus, `wordIds` séparés par `|`, avec le texte français et darija de chaque mot) et export **PDF** par la fonction d'impression du navigateur (feuille de style `@media print`). Nom de fichier : `kalimati-mots-AAAA-MM-JJ.csv`. Aucun prénom dans le nom du fichier. |
| L4-10 | Les exports ne s'ouvrent qu'en mode parent, derrière le cadenas existant. |
| L4-11 | Test `tools/test-utterance-log.mjs` : écriture, source `modele`, exclusion du mode parent et des jeux, purge 400 jours, absence dans la synchro et dans la sauvegarde par défaut, calculs de L4-07 sur un jeu de données fixe. |
| L4-12 | (ajout 25/11) La page « Mots dits » affiche la répartition par fonction (demande, commentaire, refus, social, question, non classé), à partir de la colonne `fonction` du lexique. But : voir si l'enfant ne fait que demander, ou s'il commente aussi. |

### Critères d'acceptation
- 50 touchers simulés → 50 entrées, calculs exacts.
- `tools/test-privacy-network.mjs` toujours vert.
- Le délai du son (L1-05) ne bouge pas de plus de 20 ms avec le journal actif.

---

## 10. Lot 5 — Séance de mesure (pour l'étude avec les familles)

**But :** permettre à un observateur (orthophoniste, psychologue) de mesurer une séance selon un protocole écrit. Durée estimée : 3 jours.

| N° | Exigence |
|---|---|
| L5-01 | Bouton parent « Démarrer une séance de mesure ». Champs : type (`ligne de base` / `intervention` / `suivi`), durée prévue (5, 10, 15 min), initiales de l'observateur (2 à 4 lettres, pas de nom complet). |
| L5-02 | Pendant la séance : l'appli fonctionne normalement pour l'enfant. Un minuteur discret en haut, visible seulement par l'adulte (petit point qui se remplit). |
| L5-03 | Toutes les entrées du journal pendant la séance portent le même `session`. |
| L5-04 | Table `measure_sessions` : `{ id, type, startTs, endTs, plannedMin, observer, notes }`. |
| L5-05 | Fin de séance : résumé (messages enfant, messages modèle, mots différents, durée réelle) + champ « notes » (texte libre, 500 caractères). |
| L5-06 | Page « Séances » : liste chronologique, graphique « messages enfant par séance » avec une ligne verticale entre ligne de base et intervention. Export CSV. |
| L5-07 | Aucune donnée de séance ne quitte le téléphone (même règles que L4-05). |
| L5-09 | (ajout 25/11) Chaque séance enregistre aussi : activité (liste fixe : repas, jeu libre, livre, bain, autre) et lieu (maison, école, cabinet). Les comparaisons de séances ne mélangent que des séances de même activité. |
| L5-08 | Texte d'aide : « Cet outil sert à compter. Il ne fait pas de diagnostic. » |

---

## 11. Lot 6 — Grille à imprimer

**But :** parler sans téléphone (bain, école, batterie vide). Durée estimée : 2 jours.

| N° | Exigence |
|---|---|
| L6-01 | Bouton parent « Imprimer la grille » sur chaque page de catégorie. |
| L6-02 | Mise en page A4 portrait par `@media print`, mêmes places que la taille active (`positions`). Cases vides gardées vides. |
| L6-03 | Chaque case : image (photo ou emoji), mot dans la langue active, option « 2e langue en petit dessous ». Bordure de la couleur du rôle (`GRAMMAR`). |
| L6-04 | Taille minimale d'une case imprimée : 3 cm × 3 cm. Si la page ne tient pas, découpage en plusieurs feuilles, avec « page 1/2 » en bas. |
| L6-05 | Pied de page : « Kalimati – grille [catégorie] – [date] ». Pas de prénom. |
| L6-06 | Les photos de la famille sont imprimées depuis le téléphone, jamais envoyées. |
| L6-07 | Test E2E : rendu d'impression (Playwright `page.pdf`) pour 2, 4 et 5 colonnes, en français et en arabe (droite à gauche). |

---

## 12. Lot 7 — Mot de la semaine (pour les parents)

**But :** aider le parent à montrer un mot, 10 minutes par jour. C'est le geste le mieux prouvé par la recherche. Durée estimée : 3 jours.

| N° | Exigence |
|---|---|
| L7-01 | Fichier `contenu/mot-semaine.json` : liste de fiches `{ wordId, titre, pourquoi, jeux: [3 textes courts], phrasesModele: [3 phrases], relecteur, date }`. Le contenu est fourni par un orthophoniste. Le développeur fournit **1 fiche d'exemple** marquée `relecteur: ""`. |
| L7-02 | Une fiche sans `relecteur` n'est visible qu'avec le réglage « Afficher les contenus non relus » (désactivé par défaut). |
| L7-03 | Accueil, mode parent : encart « Mot de la semaine » avec le mot, les 3 jeux, et un bouton « Je montre ce mot ». |
| L7-04 | « Je montre ce mot » active le mode `modeling` existant et **éclaire** la case du mot sur la grille (contour doux 3 px, couleur du rôle, sans clignoter). |
| L7-05 | Compteur de la semaine tiré du journal (Lot 4) : « Montré 12 fois, dit seul 3 fois. » |
| L7-06 | Choix du mot : le parent le choisit dans la liste, ou « suivant » dans l'ordre du fichier. Changement libre. |
| L7-07 | Pas de notification envoyée par un serveur. Aucun rappel hors de l'appli. |
| L7-08 | (ajout 25/11) Page parent « Vos questions » avec 4 réponses courtes, chacune avec sa source : « Est-ce que l'appli empêche de parler ? » (non, Schlosser et Wendt 2008) ; « Parler darija et français, c'est trop ? » (non, Drysdale 2015) ; « Combien de temps par jour ? » (repère pratique, pas une preuve : 10 minutes par jour pour commencer, avec l'orthophoniste) ; « Et si mon enfant ne fait que demander ? » (c'est normal au début, montrez aussi des mots pour commenter). Texte fourni par Claude, relu par un orthophoniste avant affichage (même règle que L7-02). |
| L7-09 | (ajout 25/11, facultatif, PEUT) Bouton « Filmer 5 minutes de jeu » : vidéo gardée dans le téléphone (même stockage que les vidéos modèles), à montrer à l'orthophoniste pendant la séance. Jamais envoyée, jamais dans la sauvegarde. |

---

## 13. Lot 8 — Mode étude (séparer parler et jouer)

**But :** une version calme pour les familles test. La communication n'est jamais un jeu. Durée estimée : 2 à 3 jours.

| N° | Exigence |
|---|---|
| L8-01 | Réglage parent « Mode étude » (désactivé par défaut ; activé à l'installation si l'adresse contient `?etude=1`). |
| L8-02 | En mode étude : espaces visibles pour l'enfant = Parler, Ma journée, Émotions. Cachés : Jeux, jardin, boutique d'habits, étoiles, masque, ballon. Rien n'est supprimé, tout revient en sortant du mode. |
| L8-03 | **Dans tous les modes** (pas seulement étude) : l'espace Parler NE DOIT donner ni étoile, ni confetti, ni bravo. Vérifier `modules/views.js`, `modules/talk-tools.js`, `modules/strip-controller.js`. |
| L8-04 | En mode étude, les 4 options en ligne (synchro, banque d'images ARASAAC/Wikipédia, reconnaissance vocale Google, packs de voix) sont forcées sur « éteint » et grisées. |
| L8-05 | Test `tools/test-mode-etude.mjs` : espaces cachés, aucune récompense dans Parler, options en ligne éteintes, retour complet à la sortie. |

---

## 14. Décisions par défaut (si personne ne répond)

| Question | Décision par défaut |
|---|---|
| Taille de grille par défaut pour un nouveau téléphone | 4 colonnes |
| Langue par défaut d'un nouveau téléphone | Celle du téléphone si fr/ar ; sinon français |
| Darija affichée | Lettres latines (réglage existant inchangé) |
| Le lexique remplace-t-il les 93 cartes ? | Non. Il complète. Les cartes existantes restent. |
| Le journal des mots est-il actif sur le téléphone de la famille ? | Oui, avec un message parent au premier lancement |
| Format d'export | CSV + impression PDF. Pas de format propriétaire |
| Nom de l'observateur | Initiales seulement |
| Une exigence semble contredire une autre | S'arrêter, l'écrire dans le compte rendu, appliquer la plus protectrice pour l'enfant |

---

## 15. Hors périmètre (NE PAS faire dans ce cahier)

- Nouveaux jeux, décors, habits, personnages, récompenses.
- Diagnostic, score de gravité, « biomarqueur », prédiction.
- Envoi automatique de données à un serveur, compte utilisateur, connexion.
- Application native (Swift, Kotlin, Flutter).
- Nouvelles langues ou traductions automatiques.
- Paiement, publicité, statistiques d'audience (Google Analytics ou autre).
- Modification du SQL Supabase.
- Tout conseil médical, nutritionnel, de complément alimentaire ou de « détox » (ajout 25/11).
- Tout questionnaire de dépistage de l'autisme (M-CHAT ou autre) : c'est un acte médical.
- Toute méthode où un adulte tient la tablette ou le clavier pendant que l'enfant pointe (« communication facilitée », tableau de lettres tenu par un partenaire). Kalimati reste utilisable par l'enfant seul.

---

## 16. Livraison attendue pour chaque lot

1. Une pull request par lot vers la branche `essai`. Titre : « Lot N — [nom] ».
2. Description : exigences traitées (numéros), exigences non traitées et pourquoi, captures d'écran D1 et D3.
3. `npm test` et `npm run test:e2e` verts dans GitHub Actions.
4. Version augmentée : v10.46, v10.47… puis v11.0 à la fin du Lot 8. Les 3 endroits de la version mis à jour.
5. Un compte rendu en français simple, 1 page maximum, déposé dans `docs/comptes-rendus/lot-N.md` : ce qui change pour la famille, ce qui a été testé, ce qui reste.
6. Aucune publication sur `main` sans l'accord écrit d'Aziz après 48 h sur `/essai/`.

---

## 17. Définition de « terminé » (pour chaque lot)

- [ ] Toutes les exigences du lot sont faites ou expliquées.
- [ ] Les tests nouveaux sont dans `npm test` et passent.
- [ ] Les 4 appareils de la section 4 ont été vérifiés.
- [ ] Un téléphone en v10.45 mis à jour garde toutes ses données.
- [ ] Aucun texte interdit (G-05) ; aucun prénom réel (G-01).
- [ ] Aucune requête réseau nouvelle (G-02).
- [ ] Le journal d'erreurs ne montre aucune nouvelle erreur après 30 minutes d'usage.
- [ ] Le compte rendu est déposé.

---

## Annexe A — Fichiers concernés par lot

| Lot | Fichiers existants à modifier | Fichiers à créer |
|---|---|---|
| 0 | `package.json` | `.github/workflows/tests.yml`, `tools/e2e/*.spec.mjs`, `docs/PUBLIER.md`, `package-lock.json` |
| 1 | `app.js`, `db.js`, `speech.js`, `modules/dashboard.js`, `modules/error-log.js`, `boot-guard.js` | `modules/storage-health.js`, `tools/test-storage-health.mjs` |
| 2 | `db.js`, `modules/grid-layout.js`, `modules/backup-ui.js`, `modules/drag.js`, `backup.js`, `modules/cloud-sync.js`, `modules/core-vocabulary-plan.js` | `modules/motor-plan.js`, `tools/test-motor-plan.mjs` |
| 3 | `data.js`, `modules/card-migration.js`, `modules/views.js` | `lexique/lexique-exemple.csv`, `lexique/categories.csv`, `tools/import-lexique.mjs`, `modules/lexique-data.js`, `modules/lexique-view.js`, `tools/test-lexique.mjs`, `tools/prenoms-interdits.txt` |
| 4 | `db.js`, `modules/aac-plus.js`, `modules/strip-controller.js`, `backup.js` | `modules/utterance-log.js`, `modules/words-report.js`, `tools/test-utterance-log.mjs` |
| 5 | `db.js` | `modules/measure-session.js`, `tools/test-measure-session.mjs` |
| 6 | `style.css` | `modules/print-grid.js`, `tools/e2e/print.spec.mjs` |
| 7 | `modules/views.js` | `contenu/mot-semaine.json`, `modules/word-of-week.js`, `tools/test-word-of-week.mjs` |
| 8 | `modules/spaces.js`, `modules/views.js`, `modules/network-policy.js` | `modules/study-mode.js`, `tools/test-mode-etude.mjs` |

Chaque nouveau fichier servi au navigateur DOIT être ajouté à la liste de mise en cache de `sw.js`.

## Annexe B — Montées de version de la base

| `DB_VERSION` | Lot | Changement |
|---|---|---|
| 11 | 2 | Champ `positions` et `wordId` sur chaque carte (migration dans `upgrade`) |
| 12 | 4 | Table `utterance_log` (index `day`, `session`) |
| 13 | 5 | Table `measure_sessions` |

Chaque montée DOIT avoir un test qui part d'une base v10 remplie (93 cartes, 1 photo, 1 voix, 5 essais) et vérifie que tout est encore là.
