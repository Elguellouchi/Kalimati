# Rapport d'audit global — Kalimati v10.15

Date : 22 novembre 2026 · Version auditée : v10.15 (cache `kalimati-v10-15`) · Auditeur : `tools/audit-global.mjs`

---

## 1. Résultat

| Contrôle | Résultat |
|---|---|
| Version unique (version.js ↔ sw.js ↔ index.html ↔ package.json) | ✅ v10.15 |
| Syntaxe (`node --check`) de tous les fichiers JS/MJS | ✅ 0 erreur |
| Imports relatifs de `app.js` et `modules/` | ✅ tous résolus |
| Précache `sw.js` (fichiers présents + nouveaux modules cliniques) | ✅ complet |
| CSP (`script-src 'self'`, pas d'eval, `object-src none`) | ✅ stricte |
| Secrets (OpenAI, service_role, JWT) | ✅ aucun |
| Profil neutre (aucun prénom/âge/ville dans le code) | ✅ |
| `voix/index.json` sans cartes nominatives | ✅ |
| Réseau limité aux modules connus | ✅ (11 modules, ateliers hors réseau) |
| IndexedDB v9 + store `life_book` | ✅ |
| Espace Ateliers cliniques branché | ✅ |

`npm test` : **11 suites vertes** (version, i18n, darija clinique, clinique, journal d'erreurs, fusion de synchro, sauvegarde chiffrée, lot A, amazigh, mode clinique strict, confidentialité réseau).

---

## 2. Ce qui a été livré

### Architecture
`docs/ARCHITECTURE_BONNES_PRATIQUES.md` : vue en 5 couches, invariants MIND Institute et cartographie des 35 pépites (statuts Livré / Présent / Partiel / Feuille de route).

### Ateliers cliniques (nouvel espace, 9ᵉ tuile d'accueil)
- **Ma séance du jour** (pépite 15) : 5 cartes, matrice, voix locale, ballons ; une séance par jour mémorisée localement.
- **Verbe + 3 compléments** (pépite 4) : 6 verbes × 3 compléments, FR/darija.
- **OK Stop** (pépite 25) : coffre ouvert/fermé, aucun échec punitif.
- **Attrape-Signes** (pépite 27) : suites de lettres, adaptation 2–4 choix.
- **Cahier de vie** (pépite 12) : 3 moments photo/voix, 100 % IndexedDB (`life_book`), jamais exporté ni synchronisé.
- **Échelle de douleur + ardoise** (pépite 19), **Dessin** (ardoise locale), **25 cartes d'urgence** (pépite 33).
- Libellés FR + darija générée hors ligne par OpenAI (`tools/gen-clinic-i18n.mjs`, `modules/clinic-i18n-dr.js`).

### Cœur CAA
- **Anti-tremblement 14 px** (pépite 21), réglage parent.
- **Mode écho « À toi ! »** 2,5 s (pépite 11).
- **Explorer 30 s** (pépite 16) : toutes les cartes visibles ; le parent touche pour faire parler.
- **Recherche parent avec chemin lumineux** (pépite 17) : l'onglet puis la carte clignotent.
- **Pastilles d'interruption** Oui / Non / Attends / Aide / Blague (pépite 29).
- **Pastilles de questions** de l'adulte qui filtrent la catégorie des réponses (pépite 23).

### Planning
- **Étape terminée barrée** (pépite 9) et **étape annulée conservée avec croix rouge + « ↩ Rétablir »** (pépite 31) ; progression et félicitations ignorent les étapes annulées.

### Confidentialité
- Retrait des prénoms de famille du code (commentaires, journal d'erreurs, libellés), de `voix/index.json`, des cartes morphologiques et des données de prononciation.
- Suppression des six fichiers audio de cartes nominatives (jamais plus référencés).
- Le journal d'erreurs ne dépend plus d'une liste de prénoms en dur : il purge les prénoms du profil local + liste fournie à l'appel.

---

## 3. Points d'attention (non bloquants)

1. **Corrigé en v10.20** : les identifiants historiques de cartes de famille ne contiennent plus aucun fragment de prénom. Ils sont désormais techniques (`person:child`, `person:sibling`, `person:therapist` ; cartes `c-personnes-sibling` et `c-personnes-therapist`). Une migration au démarrage (`modules/card-migration.js`) renomme les anciennes cartes et leurs photos déjà enregistrées dans IndexedDB, sans écrire de prénom dans le code. **Purge d'historique Git toujours en attente de décision** (voir mémoire projet) : les anciennes versions publiées contiennent ces prénoms.
2. Deux entrées Darija régénérées peuvent différer légèrement des versions précédentes (`annulled`, `restoreStep` inclus) : relire si un orthophoniste valide la terminologie.
3. La vérification visuelle automatique FR/darija n'est pas instrumentée dans `npm test` ; faire un passage manuel des nouveaux écrans après déploiement (séance du jour, Stop, cahier de vie, recherche parent, mode écho).

---

## 4. Rejouer l'audit

```bash
node tools/audit-global.mjs --verbose
npm test
```
