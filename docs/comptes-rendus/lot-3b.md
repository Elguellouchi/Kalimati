# Lot 3 — livraison 3b (v10.52)

Branche : `lot-3b-voix-teintes`. Périmètre : voix indexées, inventaire des MP3 manquants et teinte des emojis de personnes, sans modifier les cartes existantes.

## Exigences couvertes

- Recherche vocale dans l’ordre `lexicon.wordId`, `wordId`, `id`, sans doublon et seulement si le texte indexé correspond exactement au texte parlé.
- Ordre de lecture conservé : voix du parent, MP3 livré, puis voix locale du téléphone.
- Inventaire CSV déterministe à partir des langues de `voix/index.json`, avec contrôle du texte et de l’existence réelle du fichier MP3.
- Six teintes persistées dans le réglage parent, transformation Unicode limitée aux rôles `person`, séquences ZWJ préservées et aucune écriture sur la carte.
- Photo du parent et illustration partagée prioritaires ; en ton non défaut, seul un asset exact teinté est accepté avant le repli vers l’emoji natif.
- Version v10.52, six modules Lexique précachés, caches principal et essai isolés, aucun rechargement automatique.
- `backup.js`, `modules/backup-ui.js`, `cloud-sync.js`, `modules/grid-layout.js` et `grid-layout.js` inchangés. `emojiSkinTone` n’est pas encore ajouté à `EXPORTED_SETTINGS`.

## Tests lancés et résultat

- `npm test` : réussi, une seule exécution finale.
- `npm run test:e2e` : réussi, une seule exécution finale — 72 réussis, 15 ignorés, 0 échec sur 87 tests.
- Scénarios 6 Teintes et 7 Voix verts sur WebKit, Chromium et Chromium sans caches.
- Scénario 9 hors ligne vert sur Chromium : six modules disponibles, aucune requête de module échouée, aucun rechargement automatique.
- Limite D-2 conservée : Playwright WebKit ne persiste pas les `Blob` dans IndexedDB ; la priorité de la voix du parent y est vérifiée par la vraie fonction de lecture, sans persistance préalable du média.

## Appareils

- iPhone 13 émulé sous WebKit.
- Pixel 5 émulé sous Chromium.
- Chromium de bureau sans Cache Storage ni service worker.

journal appareil non fourni

Arrêt après 3b : aucune PR, aucune fusion, aucun déploiement et aucune publication.
