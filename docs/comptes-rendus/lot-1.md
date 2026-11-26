# Compte rendu — Lot 1 : Fiabilité (zéro écran vide, zéro perte de données)

- **Date :** 2026-11-26
- **Branche :** `lot-1-fiabilite`
- **Ancêtre vérifié :** `c3060ab`
- **Périmètre validé :** Tâche 1 (L1-01, L1-02) et Tâche 2 (L1-03).

## Ce qui change pour la famille

1. **Protection des cartes de l’enfant (L1-01, L1-02) :** Au premier déverrouillage parent, Kalimati demande au téléphone de garder les cartes « pour de bon ». Dans « Progrès », une boîte indique « Stockage protégé : oui / non » avec conseil iOS si non protégé.
2. **Rappel de sauvegarde (L1-03) :** Quand le parent ouvre le mode adulte, si aucune sauvegarde n’a été faite ou si la dernière date de plus de 14 jours, un bandeau apparaît au-dessus du bouton « 💾 Sauvegarder » : « ⚠️ Aucune sauvegarde sur ce téléphone » ou « ⚠️ Dernière sauvegarde il y a N jours », avec un bouton « Faire une sauvegarde maintenant » (même logique que le bouton Sauvegarder). En mode enfant, rien n’apparaît. Après sauvegarde, le bandeau disparaît.

Rien ne part sur internet : les données restent strictement sur l’appareil.

## Exigences faites

- **L1-01 — Stockage persistant :** Module `storage-persist.js`, `requestPersistentStorage()`, enregistrement `storagePersisted` (`true`/`false`/`’unsupported’`), déclenchement au déverrouillage parent, log `STORAGE_QUOTA` sans donnée personnelle.
- **L1-02 — Affichage Progrès :** Boîte `storageProtectionBox()` dans `dashboard.js`, état « Stockage protégé : oui / non », aide iOS contextuelle, bouton test manuel.
- **L1-03 — Rappel de sauvegarde si > 14 jours :**
  - Module `modules/backup-reminder.js` (logique pure testable) : `BACKUP_REMIND_DAYS = 14`, `backupAgeDays()`, `backupReminderNeeded()`, `backupReminderElement()` (bandeau `id="backup-reminder"`, `role="alert"`, bouton primaire).
  - Branchement dans `backup-ui.js` : `refreshBackupReminder()` au chargement, sur événement `kalimati-parent` et après sauvegarde réussie. Le bouton appelle `exportBtn.click()` (aucune duplication de logique).
- **Mise en cache hors ligne :** `storage-persist.js` et `backup-reminder.js` ajoutés à `FILES` dans `sw.js`.
- **Tests unitaires :**
  - `test-storage-persist.mjs` : 8 vérifications.
  - `test-backup-remind.mjs` : 9 vérifications (mode enfant, jamais sauvegardé, 14/15 jours, 13 jours, bouton export, branchement, cache SW).
  - Intégrés dans `package.json` (ordre : `test-storage-persist.mjs` puis `test-backup-remind.mjs`).

## Exigences non faites et pourquoi

Les exigences restantes du Lot 1 feront l’objet des tâches 3 à 6 :
- **L1-04 & L1-05** (Budgets de démarrage < 1,5s et du son < 300ms) & **L1-06** (Pré-chargement des voix) : Tâche 3.
- **L1-07** (Mode secours IndexedDB 6s) : Tâche 4.
- **L1-08** (Mise à jour sans coupure en arrière-plan) : vérifié lors de l’intégration globale.
- **L1-09** (Détection d’espace plein > 85%) : Tâche 5.
- **L1-10** (Tests E2E de non-régression sur cas limites) : Tâche 6.

## Tests lancés et résultat

Commande lancée :
```bash
npm test > test.log 2>&1
```

Résultat : **Succès (code de sortie 0)**.

Extrait réel des 20 dernières lignes de `test.log` :
```text
🎉 test-storage-persist : OK (8 vérifications).
✅ Constante : rappel à partir de 14 jours
✅ Age : null quand jamais sauvegardé, jours entiers sinon
✅ Mode enfant : aucun rappel, même sans sauvegarde
✅ Jamais sauvegardé (mode parent) : rappel visible avec bouton
✅ Sauvegarde de 15 jours (mode parent) : rappel visible
✅ Bord exact de 14 jours : rappel visible
✅ Sauvegarde de moins de 14 jours : aucun rappel
✅ Le bouton déclenche la logique d’export (équivalent à un clic sur #export)
✅ Branchement : panneau parent -> #export, et module gardé hors ligne

🎉 test-backup-remind : OK (9 vérifications).
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
- Tests de simulation du navigateur (faux IndexedDB, faux DOM, pilotage de `navigator.storage`).

## Questions pour Aziz

1. Validez-vous le commit des Tâches 1 et 2 (L1-01, L1-02, L1-03) sur la branche `lot-1-fiabilite` ?
2. Souhaitez-vous enchaîner sur la Tâche 3 (L1-04, L1-05, L1-06 : budgets de démarrage, du son et pré-chargement des voix) ?
