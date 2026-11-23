# Espace thérapeute — architecture Kalimati v10.16

Date : 22 novembre 2026 · Fonctionnalité v10.16, publiée depuis la v10.17 (cache actuel `kalimati-v10-19`)

Le cabinet du psychologue / orthophoniste, c'est un **écran ludique** qui rassemble plusieurs enfants suivis, leurs progrès et le travail des auxiliaires de vie scolaire (AVS) — **sans aucun serveur**. Les fiches circulent de téléphone à téléphone comme un fichier, jamais en ligne.

---

## 1. Principe : fiche pseudonymisée, zéro donnée serveur

```
Téléphone famille                     Téléphone thérapeute
┌──────────────────────────┐          ┌──────────────────────────┐
│ Progrès › Partage        │  fichier │ Espace thérapeute        │
│ thérapeute               │ ───────▶ │ (parents déverrouillés)  │
│ • code KALI-XXXX         │  .json   │ • roster local IndexedDB │
│ • fiche agrégée          │          │ • hub multi-patients     │
│   (aucun prénom/photo)   │          │ • avs / bilan collectif  │
└──────────────────────────┘          └──────────────────────────┘
```

- **Aucune connexion temps réel** : pas de WebSocket, pas de Supabase, pas de QR (un QR identifie un enfant sur un écran public).
- **Aucun appel `fetch`** dans `followup-schema.js`, `followup.js` et `cabinet.js` (vérifié par `tools/audit-global.mjs` et `tools/test-cabinet.mjs`).
- Le partage se fait **sur toucher explicite d'un adulte** : `navigator.share` (feuille de partage du téléphone) ou téléchargement du fichier.
- Le thérapeute importe le fichier (ou colle son JSON, pour tester sur un seul téléphone). Les fiches sont stockées dans IndexedDB, store `followups` (clé `code`).

## 2. Identité : code aléatoire, surnom local

| Donnée | Où elle vit | Visible dans la fiche |
|---|---|---|
| Code `KALI-XXXX` (alphabet A–HJK–NP–Z2–9, sans I/O/0/1) | téléphone famille + fiche | ✅ |
| Surnom donné par le thérapeute (« Patient 3 », « Enfant A »…) | **téléphone thérapeute uniquement** | ❌ jamais |
| Prénom, âge exact, date de naissance, photos, voix | téléphone famille uniquement | ❌ jamais |
| Tranche d'âge (`moins de 4 ans` … `13 ans et plus`) | fiche | ✅ |
| Score d'autonomie, essais, objectifs, routines, ABC, ortho, ATEC | fiche (agrégés) | ✅ |

La famille peut **remplacer le code par celui du cabinet** (`Progrès › Partage › Code du thérapeute`) : la fiche suivante arrive directement sous ce code, si bien que le thérapeute n'a rien à fusionner. Sinon, il renomme le patient dans son cabinet (`renameBox`) et la fiche suivante garde son code — la fusion se fait sur `code`.

## 3. Contenu de la fiche (`followup-schema.js`, version 1)

`normalizeFollowup()` reconstruit chaque champ et **jette tout ce qui n'est pas attendu** (prénom, texte libre, `label`, `name`, clés inconnues). Clés exactes :

```
kind, v, code, day, ageBand, autonomy,
totals {trials, scored, plus, prompt, minus, activeDays, lastDay},
goals [{id, status, pct, count}],
days [{day, trials, autonomy}] ≤ 120 jours,
intervenants [{id, trials, autonomy, days}],
environments [{id, trials, autonomy, days}],
prompts {id: nombre},
routines {logs, autonomous, reminded, days},
abc {total, last30}, ortho {total, last30, mlu}, atec {day, total, baseline}
```

Garde-fous : `CODE_RE`, `DAY_RE`, `GOAL_ID_RE`, doubles jours fusionnés (dernière valeur gagne), valeurs bornées 0–100 %, ≤ 120 jours, ≤ 12 instantanés par patient, routines `autonomous` / `reminded` plafonnées au nombre de `logs` (jamais plus de 100 %).

## 4. Écrans du cabinet (`modules/cabinet.js`)

1. **Hub** — héros « 👩‍⚕️ Cabinet », 4 actions (➕ Nouveau patient, 📥 Importer une fiche, 🤝 Accompagnement AVS, 🖨️ Bilan collectif), 4 KPI collectifs (patients suivis, actifs 7 jours, autonomie moyenne, objectifs atteints), grille de cartes patients.
2. **Carte patient** — avatar emoji stable (hash du code), météo, anneau d'autonomie, sparkline 14 jours, pied « essais · jours ».
3. **Fiche patient** — KPI individuels, sparkline 28 jours avec trous (aucun remplissage à zéro), historique des 8 derniers envois avec deltas, objectifs par section (details auto-ouverts sur les sections travaillées), travail AVS (barres par rôle et par environnement, routines seule/rappel/guidée), langue (ortho, ABC, ATEC vs baseline), renommage, suppression à double confirmation.
4. **Accompagnement AVS** — tableau défilant : Patient / Fiche / École-AVS / Maison / Routines seule / Aides / Météo, imprimable.
5. **Bilan collectif** — impression A4 du tableau collectif, ou fiche d'un seul patient si `onlyCode`.

**Météo** (non punitive) : 🌱 nouveau · 🌧️ en attente (> 7 jours) · ⛅ à surveiller (−10 pts d'autonomie) · ☀️ rayonne (≥ 75 %) · 🌤️ ça avance. Jamais de rouge, jamais de son d'échec.

## 5. Version et garde-fous

- `modules/version.js` → `v10.19`, cache `kalimati-v10-19` ; `sw.js` précache `cabinet.js`, `followup.js`, `followup-schema.js`.
- `db.js` → `DB_VERSION = 10`, store `followups` (clé `code`, index `updatedDay`).
- `tools/test-cabinet.mjs` : codes, normalisation (rejet du nom libre), agrégats, météo, absence de réseau et de lecture des carnets/voix enregistrées côté cabinet.
- `tools/audit-global.mjs` : imports, précache, CSP, secrets, profil neutre, réseau limité, route `cabinet` dans `app.js`.

Le cabinet **ne lit jamais** `getAllTrials`, `getAllAbcLogs`, `getAllOrthoLogs`, `getAllScheduleLogs`, `getLifeBook` ni les enregistrements : il ne voit que les fiches reçues. Même sur le téléphone d'un thérapeute qui est aussi parent, l'espace enfant et l'espace cabinet restent étanches.
