# Lot 3 — livraison 3a (v10.51)

Branche : `lot-3-lexique`. Périmètre : importateur, règles pures, filtrage, badges parent, page Lexique, garde des langues et précache hors ligne.

## Ce qui change pour la famille

- Sur un téléphone neuf, seuls les mots relus en langue ou cliniquement sont proposés à l’enfant.
- Sur une installation existante, ce filtre commence désactivé : aucune carte ne disparaît au changement de version.
- Le parent conserve toutes les cartes et peut consulter les statuts de relecture dans Progrès.
- Le lexique de production est encore vide : cette livraison ne choisit aucun mot et ne modifie pas le vocabulaire affiché.

## Exigences faites

- Import CSV intégralement contrôlé avant écriture, génération déterministe et remplacement atomique des fichiers produits.
- Identités stables, correspondance historique stricte et aucune suppression de carte familiale.
- Conservation des photos, voix, réglages `hidden`, positions et textes personnalisés.
- Filtrage enfant sans retrait du DOM, badges réservés au parent et page Lexique avec statistiques réelles.
- Repli des traductions périmées vers le français et précache des cinq modules Lexique.
- Version v10.51, absence de rechargement automatique et fichiers hors périmètre 3a inchangés.

## Exigences non faites et pourquoi

- Voix et teintes : reportées en 3b, après fusion de 3a.
- Sauvegarde, cloud et correction de `mergeCardLayout()` : reportés en 3c, après fusion de 3b.
- Aucun mot de production ni aucune voix générée en ligne : le CSV de production reste volontairement vide.
- Vérification des médias sur WebKit : Playwright WebKit ne persiste pas les `Blob` (`UnknownError: Error preparing Blob/File data…`, limite D-2 déjà utilisée dans la suite). Les scénarios 2 et 5 restent exécutés sur WebKit sans médias ; Chromium vérifie les vrais `Blob`.

## Tests lancés et résultat

- `npm test` : réussi, une seule exécution finale.
- `npm run test:e2e` : réussi, une seule exécution finale — 66 réussis, 15 ignorés, 0 échec sur 81 tests.
- E2E Lot 3 : scénarios 1 à 5 et 9 verts sur les profils applicables.

## Vérifié sur quels appareils

- iPhone 13 émulé sous WebKit.
- Pixel 5 émulé sous Chromium.
- Chromium de bureau sans Cache Storage ni service worker.
- Aucun appareil physique pendant cette livraison.

journal appareil non fourni

## Questions pour Aziz

Aucune question bloquante pour 3a. La fusion de 3a et ton accord sont nécessaires avant de commencer 3b.
