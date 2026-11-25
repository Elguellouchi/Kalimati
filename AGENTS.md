# AGENTS.md — Règles permanentes pour l'agent de code (Qoder)

Ce fichier se place à la racine du dépôt `Elguellouchi/kalimati`. Qoder le lit automatiquement.
Le cahier des charges complet est dans `docs/cahier-des-charges-v11.md`. En cas de conflit, ce fichier-ci gagne sur tout le reste, sauf une consigne écrite d'Aziz.

## 1. Le projet en bref
- Kalimati : application web installable (PWA) de communication par images pour enfants autistes non verbaux.
- JavaScript ES modules, sans framework, sans compilation. Base locale IndexedDB (`db.js`). Hors ligne par `sw.js`.
- Le propriétaire (Aziz) n'est pas développeur. Tout compte rendu s'écrit en français simple, phrases courtes, sans jargon.

## 2. Avant de commencer une tâche (obligatoire)
1. `git fetch origin` puis `git status`. Travailler sur une branche `lot-N-<nom>` créée depuis `origin/essai` (ou `origin/main` pour le Lot 0).
2. Vérifier que l'historique contient le commit `c3060ab` (v10.45) : `git merge-base --is-ancestor c3060ab HEAD`. Si non : **STOP**, le signaler. Ne jamais partir d'une copie ancienne, d'un zip ou d'un dossier Drive.
3. Lancer `npm test` et noter le résultat de départ.
4. Lire `modules/error-log.js` et le cahier des charges du lot.

## 3. Interdits absolus
- Aucun prénom réel d'enfant, photo, voix ou phrase d'enfant dans le code.
- Aucune nouvelle requête réseau. Aucun script externe. Ne pas toucher à la CSP de `index.html` sauf demande écrite.
- Aucune copie de code, mot, image ou disposition de Proloquo2Go, TD Snap, LAMP, TouchChat, Grid. Aucun code GPL ou AGPL (Cboard, AsTeRICS Grid).
- Aucune nouvelle fonction de jeu, récompense, décor, personnage.
- Aucun texte « validé médicalement », « soigne », « diagnostic », « thérapie ».
- Pas de rouge, pas de son d'échec, pas d'alerte en mode enfant.
- Ne jamais déplacer les cartes (`gridRow`, `gridCol`, `positions`) sans action explicite de l'adulte.
- Ne jamais supprimer ni écraser des données existantes d'un téléphone (cartes, photos, voix, essais, journaux) lors d'une mise à jour.
- Ne jamais ajouter de framework, TypeScript, bundler ou dépendance d'exécution. Seule dépendance de développement autorisée : `@playwright/test`.
- Ne jamais pousser sur `main`. Ne jamais utiliser `git push --force`. Ne jamais réécrire l'historique.
- Ne jamais désactiver, sauter ou affaiblir un test pour le faire passer.
- Ne jamais inventer un résultat de test. Coller la vraie sortie de la commande.

## 4. Règles techniques
- Nouveau code dans de nouveaux fichiers `modules/*.js`. Commentaires en français.
- Toute nouvelle table IndexedDB = montée de `DB_VERSION` dans `db.js`, avec test de migration depuis une base v10 remplie.
- Tout nouveau fichier servi au navigateur = ajouté à la liste de mise en cache de `sw.js`.
- Version : changer ensemble `modules/version.js` (`APP_VERSION`, `CACHE_VERSION`), `sw.js` (`CACHE`) et `package.json`. Vérifié par `tools/test-version.mjs`.
- Toute erreur attrapée est écrite dans le journal (`modules/error-log.js`), sans donnée personnelle.
- Tout doit marcher sans `window.caches` (Chrome sur iPhone) et sans synthèse vocale (iPhone en mode silencieux).
- Respecter `prefers-reduced-motion` et le réglage « mouvement réduit ».
- Arabe et darija en lettres arabes : affichage de droite à gauche (propriétés CSS logiques).

## 5. Fin de tâche (obligatoire)
1. `npm test > test.log 2>&1` doit réussir. Joindre les 20 dernières lignes de `test.log` au rapport.
2. Commit seulement si les tests passent : `npm test && git commit ...`. Message : `Lot N — <résumé> (exigences L N-01, L N-02…)`.
3. Rapport de tâche en français simple, dans `docs/comptes-rendus/lot-N.md`, avec ces titres exactement :
   - « Ce qui change pour la famille »
   - « Exigences faites » (numéros)
   - « Exigences non faites et pourquoi »
   - « Tests lancés et résultat » (vraie sortie)
   - « Vérifié sur quels appareils »
   - « Questions pour Aziz »
4. Créer une pull request vers la branche `essai`, jamais vers `main`.

## 6. Si une consigne est floue ou contradictoire
Ne pas deviner. Appliquer la « décision par défaut » (section 14 du cahier). Sinon, choisir l'option la plus protectrice pour l'enfant et ses données, puis l'écrire dans « Questions pour Aziz ».

## 7. Si tu bloques (règle d'arrêt)
1. Si le même blocage revient 2 fois, ou si une même difficulté dure plus d'une heure : **STOP**.
2. Ne lance pas de nouvelle revue, de nouvelle correction ni de nouvel essai.
3. Écris le compte rendu avec : le problème exact, la vraie sortie de l'erreur, et 2 ou 3 choix possibles avec leur risque.
4. Attends la réponse d'Aziz avant de continuer.
5. Si une exigence du cahier semble impossible à tenir, dis-le tout de suite, au lieu de chercher pendant des heures.
