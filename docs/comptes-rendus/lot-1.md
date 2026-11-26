# Compte rendu — Lot 1 : Fiabilité (zéro écran vide, zéro perte de données)

- **Date :** 2026-11-26
- **Branche :** `lot-1-fiabilite`
- **Ancêtre vérifié :** `c3060ab`
- **Périmètre validé :** Tâches 1, 2 et 3 (L1-01, L1-02, L1-03, L1-04, L1-05, L1-06).

## Ce qui change pour la famille

1. **Protection des cartes de l’enfant (L1-01, L1-02) :** Au premier déverrouillage parent, Kalimati demande au téléphone de garder les cartes « pour de bon ». Dans « Progrès », une boîte indique « Stockage protégé : oui / non » avec conseil iOS si non protégé.
2. **Rappel de sauvegarde (L1-03) :** Quand le parent ouvre le mode adulte, si aucune sauvegarde n’a été faite ou si la dernière date de plus de 14 jours, un bandeau apparaît au-dessus du bouton « 💾 Sauvegarder » : « ⚠️ Aucune sauvegarde sur ce téléphone » ou « ⚠️ Dernière sauvegarde il y a N jours », avec un bouton « Faire une sauvegarde maintenant » (même logique que le bouton Sauvegarder). En mode enfant, rien n’apparaît. Après sauvegarde, le bandeau disparaît.
3. **Réactivité clinique et pré-chargement des voix (L1-04, L1-05, L1-06) :** L'application surveille en silence ses propres temps d'exécution. Au rendu d'une grille, les voix des cartes visibles (jusqu'à 40) sont pré-chargées en arrière-plan sans bloquer l'enfant. Si le démarrage dépasse 1,5s (hors ligne) ou 4s (en ligne), ou si un son met plus de 300ms à partir après le toucher, l'incident est noté localement dans le journal d'erreurs pour analyse, sans aucune donnée personnelle.

Rien ne part sur internet : les données restent strictement sur l’appareil.

## Exigences faites

- **L1-01 — Stockage persistant :** Module `storage-persist.js`, `requestPersistentStorage()`, enregistrement `storagePersisted` (`true`/`false`/`’unsupported’`), déclenchement au déverrouillage parent, log `STORAGE_QUOTA` sans donnée personnelle.
- **L1-02 — Affichage Progrès :** Boîte `storageProtectionBox()` dans `dashboard.js`, état « Stockage protégé : oui / non », aide iOS contextuelle, bouton test manuel.
- **L1-03 — Rappel de sauvegarde si > 14 jours :**
  - Module `modules/backup-reminder.js` (logique pure testable) : `BACKUP_REMIND_DAYS = 14`, `backupAgeDays()`, `backupReminderNeeded()`, `backupReminderElement()` (bandeau `id="backup-reminder"`, `role="alert"`, bouton primaire).
  - Branchement dans `backup-ui.js` : `refreshBackupReminder()` au chargement, sur événement `kalimati-parent` et après sauvegarde réussie. Le bouton appelle `exportBtn.click()` (aucune duplication de logique).
- **L1-04 & L1-05 — Budgets de démarrage et du son :**
  - Module `modules/startup-timing.js` : `markStartupStart()` au démarrage précoce de `app.js`, `recordFirstRender()` au premier rendu de la grille Parler (seuil 1,5s hors ligne, 4s en ligne, journalisé en `UX_FRICTION`).
  - Mesure du son dans `speech.js` : `markAudioStart(cardId)` avant `audio.play()`, `recordAudioPlaying(cardId)` à l'événement `playing` (seuil 300ms en `UX_FRICTION`, > 800ms en `AUDIO_SILENT`).
- **L1-06 — Pré-chargement des voix :**
  - Module `modules/voice-preload.js` : `preloadVisibleVoices()` déclenche le fetch discret des voix (max 40) en `cache: 'force-cache'` via `requestIdleCallback` ou `setTimeout(0)`, sans bloquer le rendu.
  - Intégré dans `modules/views.js` à chaque rendu de grille.
- **Mise en cache hors ligne :**
  - `storage-persist.js`, `backup-reminder.js`, `startup-timing.js` et `voice-preload.js` ajoutés à `FILES` dans `sw.js`.
- **Tests unitaires :**
  - `test-storage-persist.mjs` (8 vérifications).
  - `test-backup-remind.mjs` (9 vérifications).
  - `test-startup-timing.mjs` (12 vérifications).
  - `test-voice-preload.mjs` (9 vérifications).
  - Tous intégrés dans `package.json` et exécutés dans la suite complète `npm test`.

## Exigences non faites et pourquoi

Les exigences restantes du Lot 1 feront l’objet des tâches 4 à 6 :
- **L1-07** (Mode secours IndexedDB 6s) : Tâche 4.
- **L1-08** (Mise à jour sans coupure en arrière-plan) : vérifié lors de l’intégration globale.
- **L1-09** (Détection d’espace plein > 85%) : Tâche 5.
- **L1-10** (Tests E2E de non-régression sur cas limites) : Tâche 6.

## Tests lancés et résultat

Commande lancée :
```bash
npm test > test.log 2>&1
```

Résultat : **Succès (code de sortie 0, 42 tests unitaires verts)**.

Extrait réel des 25 dernières lignes de `test.log` :
```text
🎉 test-startup-timing : OK (12 vérifications).
(node:25952) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided.
(Use `node --trace-warnings ...` to show where the warning was created)
✅ Plafond annoncé : 40 cartes au plus
✅ Le rendu n’attend pas : fetch part après le rendu
✅ Carte avec voix : fetch avec cache force-cache
✅ Carte sans voix : aucune requête
✅ Anciens champs audioFr / audioDr encore lus
✅ Mp3 livré retrouvé par getDefaultUrl
✅ Voix du parent (Blob) : rien à télécharger
✅ Erreur réseau ignorée, puis retentée au rendu suivant
✅ 40 cartes au plus, une même adresse une seule fois

🎉 test-voice-preload : OK (9 vérifications).
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
- Tests de simulation du navigateur (faux DOM, faux timers/horloges, pilotage `performance.now()`, interception audio).

## Questions pour Aziz

1. Validez-vous le commit de la Tâche 3 (L1-04, L1-05, L1-06) sur la branche `lot-1-fiabilite` ?
2. Souhaitez-vous enchaîner sur la Tâche 4 (L1-07 : mode secours IndexedDB si délai > 6s) ?
