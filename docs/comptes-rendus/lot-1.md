# Compte rendu — Lot 1 : Fiabilité (zéro écran vide, zéro perte de données)

- **Date :** 2026-11-26
- **Branche :** `lot-1-fiabilite`
- **Ancêtre vérifié :** `c3060ab`
- **Périmètre en cours :** L1-01 et L1-02 (Tâche 1 : stockage persistant et indicateur Progrès)

## Ce qui change pour la famille

Quand le parent ouvre le mode adulte pour la première fois, Kalimati demande au téléphone de garder les cartes « pour de bon », afin que le téléphone ne les efface pas tout seul quand il manque d’espace mémoire.

Dans « Progrès » (accessible par le cadenas parent), une nouvelle boîte claire indique :
- « Stockage protégé : oui » si le téléphone a accepté de verrouiller les données ;
- « Stockage protégé : non » si ce n’est pas garanti. Sur iPhone et iPad, un conseil simple s'affiche alors : « Ajoutez Kalimati à l’écran d’accueil pour protéger vos données. »

Rien ne part sur internet : les données restent strictement sur l’appareil.

## Exigences faites

- **L1-01 — Stockage persistant :**
  - Création du module `modules/storage-persist.js`.
  - Fonction `requestPersistentStorage()` qui appelle `navigator.storage.persist()`.
  - Enregistrement du résultat (`true`, `false` ou `'unsupported'`) dans les réglages IndexedDB (`storagePersisted`).
  - Déclenchement automatique au premier déverrouillage parent dans `app.js`.
  - Prise en charge des erreurs avec journalisation locale anonyme dans `error-log.js` (`STORAGE_QUOTA`).
- **L1-02 — Affichage Progrès :**
  - Ajout de la boîte `storageProtectionBox()` dans `modules/dashboard.js`.
  - Ligne d'état « Stockage protégé : oui / non » avec bouton de test manuel si non déterminé.
  - Détection contextuelle iOS avec conseil d'ajout à l'écran d'accueil.
- **Mise en cache hors ligne :**
  - `./modules/storage-persist.js` ajouté à `FILES` dans `sw.js`.
- **Tests unitaires :**
  - `tools/test-storage-persist.mjs` vérifie les 8 cas (API absente, persist accordé, refusé, erreur, non-régression de relecture, vérification état réel, module en cache, présence dans Progrès et app.js).
  - Intégré dans `package.json` à la suite `npm test`.

## Exigences non faites et pourquoi

Les exigences suivantes du Lot 1 font l'objet des tâches suivantes du lot :
- **L1-03** (Rappel de sauvegarde si > 14 jours) : Tâche 2.
- **L1-04 & L1-05** (Budgets de démarrage et du son) & **L1-06** (Pré-chargement des voix) : Tâche 3.
- **L1-07** (Mode secours IndexedDB 6s) : Tâche 4.
- **L1-08** (Mise à jour sans coupure en arrière-plan) : vérifié lors de l'intégration globale.
- **L1-09** (Détection d'espace plein > 85%) : Tâche 5.
- **L1-10** (Tests E2E de non-régression sur cas limites) : Tâche 6.

## Tests lancés et résultat

Commande lancée :
```bash
npm test > test.log 2>&1
```

Résultat : **Succès (code de sortie 0)**.

Extrait réel des 20 dernières lignes de `test.log` :
```text
test-pluriel : OK
test-storage : OK
✅ API absente -> « unsupported » enregistré
✅ persist() accordé -> true enregistré
✅ persist() refusé -> false enregistré
✅ persist() en erreur -> false enregistré et signalé au journal
✅ Statut déjà connu : relecture sans écraser le réglage (non-régression)
✅ Aucun réglage : vérifie l’état réel du navigateur et l’enregistre
✅ Aucun réglage et aucune API : "pas encore déterminé" (null)
✅ Le module est gardé hors ligne et affiché dans Progrès

🎉 test-storage-persist : OK (8 vérifications).
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

## Vérifié sur quels appareils

- Tests unitaires automatisés Node 22 sous Windows.
- Tests de simulation du navigateur (faux IndexedDB et pilotage de `navigator.storage`).

## Questions pour Aziz

1. Validez-vous le premier commit de la Tâche 1 (L1-01 et L1-02) sur la branche `lot-1-fiabilite` ?
2. Souhaitez-vous enchaîner directement sur la Tâche 2 (L1-03 : rappel de sauvegarde après 14 jours sans sauvegarde) ?
