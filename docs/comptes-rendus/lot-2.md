# Compte rendu — Lot 2 : Plan moteur inviolable (v10.48)

Branche `lot-2-plan-moteur`, issue d'`origin/essai` à jour, stash `lot-2-plan-moteur-avant-lot-1-2026-11-26` réappliqué. Version v10.48 appliquée partout (modules/version.js, sw.js, index.html, test-version.mjs, test-cache-scope.mjs, specs e2e).

## Ce qui change pour la famille

- **Le réglage des colonnes ne déplace plus aucune carte.** Avant, changer le nombre de colonnes réorganisait les places ; désormais il change seulement la taille affichée. Les places de chaque carte restent exactement où l'enfant les a apprises, dans chaque taille.
- **Nouveau bouton « Remettre en ordre automatique »** dans le panneau parent, à côté du réglage des colonnes. Il demande deux touchers (le texte « Toucher encore pour confirmer » revient tout seul après 4 secondes) et ne réorganise que la taille affichée. C'est le seul endroit de l'application qui remet des cartes en ordre.
- **Déplacer une carte demande confirmation** (L2-07) : quand le parent change la Ligne/Colonne d'une carte dans l'éditeur, « Enregistrer » devient « Déplacer change le geste appris par l'enfant. Continuer ? » (retour tout seul après 4 secondes). Le déplacement ne change que la place de la taille affichée ; les places des autres tailles ne bougent pas.
- **Identifiant stable par carte (`wordId`)** : chaque carte garde un identifiant qui ne change jamais, indépendant des langues, transporté par les sauvegardes et la synchro.
- **Empreinte du plan moteur** : après chaque action d'adulte, l'application mémorise une empreinte des places (SHA-256). Au démarrage, si des places ont changé sans action d'adulte, une note discrète est écrite au journal d'erreurs — sans jamais corriger automatiquement, sans jamais alarmer l'enfant. L'empreinte ne quitte jamais l'appareil (absente des sauvegardes et de la synchro).
- **Paliers de dévoilement** : appliquer un palier ne touche que la visibilité (`hidden`) des cartes ; aucune place ne bouge.

## Exigences faites

- **L2-01 à L2-06 (plan moteur)** : migration v10 → v11 (`positions[cols]` depuis la place actuelle, jamais réécrite), changement de taille sans déplacement, places figées une seule fois, catégories et quadrillage stables — vérifiés par `tools/test-motor-plan.mjs` (OK).
- **L2-07** (fait sur la réponse d'Aziz) : confirmation 2 touchers avant tout déplacement parent. Le seul chemin de déplacement de l'application est l'éditeur (Ligne/Colonne → `moveCard` dans modules/views.js:357) — le glisser-déposer de modules/drag.js ne sert qu'aux exercices. La porte est donc dans `openEditor` : nouvelle fonction pure `moveNeedsConfirmation(card, row, col, cols)` (modules/grid-layout.js) — pas de confirmation pour une première place, la même case, une ligne absente ou une colonne hors de la taille active ; le texte de confirmation revient à « Enregistrer » après 4 s (même mécanisme que le bouton « Remettre en ordre automatique »). `moveCard` ne touche que `positions[taille active]` (déjà le cas, testé). Cas ajoutés à `tools/test-motor-plan.mjs` (section 14) et **vérifié dans un vrai navigateur** (Chromium Playwright, serveur tools/serve.mjs, 9 contrôles verts) : 1er toucher → texte affiché + modale ouverte ; 4 s → retour à « Enregistrer » ; réarmement ; 2e toucher → modale fermée, carte à la nouvelle ligne ; même place → enregistrement direct sans confirmation.
- **L2-08** : le sélecteur `#cols` ne change plus aucune valeur de `card.positions` ; nouveau bouton « Remettre en ordre automatique » à deux touchers (mécanisme copié de modules/stories.js:100-105) ; `git grep -n "relayout(" -- '*.js'` → exactement 2 occurrences : la définition (modules/grid-layout.js:142) et l'appel unique du bouton (modules/backup-ui.js:198). Test ajouté : changer #cols 2 → 5 → 3 → 2 ne modifie aucune place.
- **L2-09** : `wordId` stable — migration (`db.js`), cartes créées (`editor.js`), fusion de sauvegarde (`backup-ui.js`), normalisation au chargement (`grid-layout.js`).
- **L2-10** : `layoutFingerprint` (SHA-256 via Web Crypto des lignes `wordId:taille:ligne:colonne` triées) enregistrée après chaque action adulte (éditeur, suppression, #cols, bouton d'ordre, restauration chiffrée, paliers) ; absente d'`EXPORTED_SETTINGS` (app.js:71-72) et des clés partagées — elle ne voyage jamais.
- **L2-11** : audit au démarrage dans `loadCards`, une seule fois par chargement, AVANT toute écriture ; en cas d'écart → `UX_FRICTION` « places modifiées sans action adulte » au journal, sans correction automatique et sans réécriture de l'empreinte.
- **L2-12 (c)** : `applyProgressiveStage` ne pose que `hidden` — plus aucune écriture de gridRow/gridCol/positions.
- **L2-13** : la sauvegarde transporte `positions` et `wordId` (backup.js) ; la synchro fusionne par taille avec `mergeCardLayout` (modules/cloud-sync.js:438) — la modification la plus récente gagne par taille, les tailles locales absentes du nuage sont conservées.

Corrections faites pendant la porte de tests (chacune une seule fois) :
1. `db.js` `upgradeCardToV11` : une carte sans place reçoit bien son `wordId` (L2-09) mais jamais de place inventée (L2-01) ; `tools/test-children.mjs` aligné sur ce contrat du cahier des charges (les deux tests se contredisaient). Diff exact demandé ci-dessous.
2. `db.js` : la migration v11 est ignorée quand la transaction est absente (seul le faux IndexedDB de test-storage-persist.mjs le fait ; un vrai navigateur en fournit toujours une).
3. Références de cache v10-47 → v10-48 dans `tools/test-cache-scope.mjs` et `tools/e2e/` (le bump v10.48 était déjà appliqué au code mais pas à ces tests).

### Diff exact de `tools/test-children.mjs` et ligne du cahier qui le justifie

Avant cette porte, le test disait : `upgradeCardToV11({ ... gridRow: null, gridCol: null }) === null`, « rien n'est inventé ». Or la même carte sans place doit quand même recevoir son identifiant stable : L2-09 (cahier des charges v11, ligne 181) — « **Identifiant stable.** Ajouter `card.wordId` (voir Lot 3). Pour les cartes existantes : `wordId = id` actuel. » — vaut pour **toutes** les cartes existantes, placées ou non ; seule la place est interdite d'invention (L2-01, ligne 173 : « créer `positions[colsActuel] = { row: gridRow, col: gridCol }` », donc rien quand `gridRow`/`gridCol` sont absents).

```diff
-ok(DB.upgradeCardToV11({ id: 'c-base-vide', cat: 'base', gridRow: null, gridCol: null }, 4) === null, 'migration v11 : une carte sans place reste à placer, rien n’est inventé');
+const sansPlace = DB.upgradeCardToV11({ id: 'c-base-vide', cat: 'base', gridRow: null, gridCol: null }, 4);
+ok(sansPlace && !sansPlace.positions && sansPlace.gridRow === null && sansPlace.wordId === 'c-base-vide', 'migration v11 : une carte sans place reste à placer — wordId oui, place jamais inventée');
```

L'assertion n'exige plus `null` (l'ancien contrat) mais vérifie les trois faits du cahier : `wordId` reçu (L2-09), aucune `positions` inventée et aucune ligne/colonne inventée (L2-01). Le code de `db.js` satisfaisait déjà ce contrat ; le test seul était en retard et est maintenant aligné.

## Exigences non faites

Aucune. L2-07, seule exigence en attente, a été faite sur la réponse d'Aziz (voir « Exigences faites »).

## Correction de la porte E2E (choix 1 d'Aziz)

`loadCards` attendait `saveLayoutFingerprint` (un `getSetting` + SHA-256 + `setSetting`) avant de rendre la grille — c'est ce qui faisait dépasser les 3 s (~3185 ms mesurés sur chromium-sans-caches). Correction appliquée dans `app.js`, exactement le choix 1 :

- **La lecture de l'empreinte (audit L2-11) reste AVANT toute écriture**, inchangée.
- **La réécriture ne retarde plus l'affichage** : `saveLayoutFingerprint(placed)` n'est plus attendue ; elle part après l'affichage de la grille (`setTimeout(..., 0)`) avec un `.catch` qui écrit `layout_fingerprint_save_failed` au journal d'erreurs (et `saveLayoutFingerprint` journalise aussi son propre échec en interne).
- **Le seuil de 3 secondes du test n'a pas été touché.**

## Tests lancés et résultat

Vérifications ciblées (toutes vertes) : test-motor-plan (avec la nouvelle section 14 de confirmation L2-07), test-children, test-card-migration, test-pepites, test-sync-merge, test-backup-crypto, test-storage-persist, test-cache-scope, test-version, `node --check` des fichiers modifiés, `git grep relayout(` (2 occurrences attendues), et vérification navigateur ponctuelle de la porte L2-07 (9 contrôles verts).

Résultat de la relance unique (après correction choix 1 + L2-07) :

- **`npm test` : VERT** — EXIT=0, tous les fichiers de test passent.
- **`npm run test:e2e` : 45 passés, 11 sautés, 1 échoué.** L'échec est le même test qu'avant (« ouverture à froid : la grille "Parler" s'affiche en moins de 3 s », seuil 3000 ms inchangé), mais sur **un seul** des trois navigateurs.

Mesures en millisecondes sur les 3 navigateurs (décomposition navigation / accueil / toucher / grille) :

| Projet | Total | Verdict | navigation | accueil | toucher | grille |
|---|---|---|---|---|---|---|
| iphone-13-webkit | **1464 ms** | vert | 395 | 929 | 69 | 71 |
| pixel-5-chromium | **3209 ms** | rouge | 370 | 138 | 2572 | 129 |
| chromium-sans-caches | **2917 ms** | vert | 286 | 135 | 2461 | 35 |

Lecture : après le toucher, la grille s'affiche en **35 à 129 ms sur les trois navigateurs** — la correction (empreinte non bloquante) a supprimé le coût applicatif d'avant (le même projet était à 3185 ms avant la correction et passe maintenant à 2917 ms). Le dépassement de pixel-5 vient entièrement de la phase « toucher » : un arrêt de ~2,5 s entre l'accueil visible et le clic, qui touche les premiers appels d'`openTalkGrid` de chaque projet Chromium fraîchement démarré puis disparaît (sans-caches : 2461 → 161 ms ; pixel-5 : 2572 → 2386 → 128 ms), signature d'une montée en charge du navigateur au démarrage du projet plutôt que d'un coût de l'application.

## Règle d'arrêt appliquée

La consigne était : si l'E2E reste rouge sur le même test, s'arrêter et donner la mesure sur les 3 navigateurs sans rien changer d'autre. C'est le cas (rouge sur pixel-5-chromium uniquement). **Aucun commit, aucun push, aucune PR.** Les mesures sont ci-dessus ; le choix suivant appartient à Aziz.

## Comparaison Lot 1 / Lot 2 sur le test « ouverture à froid » (même machine)

Demande d'Aziz : 5 répétitions sur pixel-5-chromium, d'abord sur origin/essai (Lot 1, worktree séparé `C:\Users\HP\Projets\kalimati-qoder-bench-lot1`, commit e278c2b), puis sur `lot-2-plan-moteur`. Tableau : phase « toucher » et total de chaque version.

**Lot 1 (origin/essai, sans aucun code du Lot 2)** — 3 verts, 2 rouges :

| Répétition | toucher | total | verdict |
|---|---|---|---|
| 1 | 2422 ms | 2906 ms | vert |
| 2 | 2367 ms | 2842 ms | vert |
| 3 | 2527 ms | 2994 ms | vert |
| 4 | 2669 ms | 3203 ms | rouge |
| 5 | 2496 ms | 3139 ms | rouge |

**Lot 2 (lot-2-plan-moteur)** — 4 verts, 1 rouge :

| Répétition | toucher | total | verdict |
|---|---|---|---|
| 1 | 2247 ms | 2781 ms | vert |
| 2 | 2409 ms | 2895 ms | vert |
| 3 | 2597 ms | 3210 ms | rouge |
| 4 | 2362 ms | 2824 ms | vert |
| 5 | 2436 ms | 2957 ms | vert |

Lecture : les deux versions présentent le même arrêt d'environ 2,2 à 2,7 s dans la phase « toucher » à chaque répétition, et la phase « grille » reste à 35-133 ms. Le Lot 1 échoue même 2 fois sur 5 au seuil de 3 s — sans aucun code du Lot 2. Le Lot 2 n'est pas plus lent que le Lot 1 (médianes : Lot 1 2906 ms, Lot 2 2895 ms).

**Décision d'Aziz appliquée** : les deux versions ayant le même arrêt d'environ 2,5 s, c'est la machine. → commit (chemins nommés uniquement, mêmes exclusions), push de `lot-2-plan-moteur`, PR vers essai, sans fusion, sans toucher aux Pages. La CI GitHub fera foi.

## Vérifié sur quels appareils

- Windows 11 local, Chromium via Playwright (suites unitaires + E2E).
- **Pas d'appareil réel.** Le test manuel D1 du Lot 2 (10 cartes, 4 tailles de grille, retour à la taille initiale sans déplacement, puis bouton « Remettre en ordre automatique ») reste à faire par Aziz sur un vrai téléphone/tablette.

## Réponses d'Aziz appliquées

1. **Porte E2E → choix 1**, fait (voir « Correction de la porte E2E »). Le seuil de 3 s du test est inchangé.
2. **L2-07 → à faire dans ce lot**, fait (voir « Exigences faites »), avec le cas ajouté à `tools/test-motor-plan.mjs` (section 14) et la vérification navigateur.
3. Après une porte verte : commit (chemins nommés uniquement, jamais Agent.md/CLAUDE.md/.claude/*.log/docs/specs/docs/comptes-rendus/last_run.md/SYNTHESE), push de `lot-2-plan-moteur`, PR vers essai — sans fusion, sans toucher aux Pages.
4. **Comparaison Lot 1 / Lot 2 avant la PR** : faite (voir « Comparaison Lot 1 / Lot 2 »). Les deux versions ont le même arrêt d'environ 2,5 s dans la phase « toucher » → c'est la machine → branche « commit, push, PR » appliquée. Le seuil de 3 s n'a pas été touché.
