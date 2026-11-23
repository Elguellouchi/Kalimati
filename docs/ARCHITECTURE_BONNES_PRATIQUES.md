# Architecture d'intégration des bonnes pratiques — Kalimati

Version : v10.15 · 21 novembre 2026
Sources : `bonnes-pratiques/bonnes pratiques à partir de transcripts.docx` (35 pépites, Lots 1 et 2) et le cahier des charges clinique MIND Institute / JASPER / ESDM / UCLA intégré au même document.

---

## 1. Objet

Ce document décrit l'architecture cible qui transforme les 35 pépites cliniques et les principes MIND Institute en fonctionnalités concrètes dans Kalimati, sans jamais sortir du cadre :

1. **Journal d'erreurs d'abord** : `tools/audit-error-log-preflight.mjs` est exécuté avant tout développement ; le journal local (`modules/error-log.js`, anneau de 150 entrées, IndexedDB) reste la première source de diagnostic.
2. **Zéro donnée personnelle d'enfant dans le code** : aucun prénom, âge, phrase, score, photo ou voix dans les sources ni dans un envoi réseau.
3. **Zéro donnée serveur par défaut** : photos, voix, essais et journaux vivent dans IndexedDB sur l'appareil. Une fonction distante n'existe que derrière un consentement explicite (mode équipe, reconnaissance vocale cloud).
4. **Hors ligne d'abord** : toute nouveauté fonctionne sans internet ; les ressources sont précachées par `sw.js`.

---

## 2. Vue en couches

```
┌──────────────────────────────────────────────────────────────────────┐
│ 5. Espaces (ce que l'enfant et l'adulte voient)                      │
│    Accueil · Parler · Jeux · Ma journée · Émotions · Ateliers        │
│    cliniques · Progrès          (app.js + modules/spaces.js)         │
├──────────────────────────────────────────────────────────────────────┤
│ 4. Moteur clinique réutilisable                                      │
│    choiceBoard (sans échec, aide 3/5/8 s, 2–4 choix adaptés),        │
│    sequenceBoard, timer silencieux, tokenBoard, sorter, praise       │
│    modules/widgets.js · modules/timer.js · modules/calm.js           │
├──────────────────────────────────────────────────────────────────────┤
│ 3. Cœur CAA (communication)                                          │
│    bande de phrase, morphologie, suggestions apprises, voix,         │
│    mode écho, pastilles d'interruption, recherche guidée, Explorer   │
│    app.js · modules/morphology.js · speech.js · modules/aac-plus.js  │
├──────────────────────────────────────────────────────────────────────┤
│ 2. Données locales                                                   │
│    IndexedDB `kalimati` (cartes, réglages, essais, journaux,          │
│    photos/voix, planning, cahier de vie) + caches du service worker  │
│    db.js · modules/*.js (aucun accès réseau)                         │
├──────────────────────────────────────────────────────────────────────┤
│ 1. Socle technique                                                   │
│    ES modules sans build · CSP stricte · boot-guard · error-log      │
│    réseau opt-in (modules/network-policy.js) · version unique        │
└──────────────────────────────────────────────────────────────────────┘
```

**Règle de dépendance** : une couche ne remonte jamais. Un espace peut appeler le moteur clinique ; le moteur ne connaît aucun espace. `db.js` ne connaît personne. Aucun module d'exercice n'importe `app.js`.

---

## 3. Invariants cliniques et leur implémentation

| Invariant MIND Institute | Implémentation | Contrôle |
|---|---|---|
| Aucun son punitif (buzzer, croix rouge) | `choiceBoard` : `nudge` doux, distracteurs estompés, jamais d'échec bloquant | `tools/test-lot-a.mjs` |
| Aide avant l'erreur | Main 👆 après 3/5/8 s (réglable), démo muette 2,5 s au premier lancement | `widgets.js`, lot A |
| Estompage progressif | Délai d'aide +1 s tous les 2 succès autonomes ; 2–4 choix sur 8 essais (≈75 %) | `computeHintDelayMs`, `computeAdaptiveChoiceCount` |
| Aucun minuteur anxiogène | Sablier silencieux en camembert ; chiffres réservés au parent ; aucune relance vocale automatique | `modules/timer.js` |
| Grandes cibles | 44 px minimum, cartes pleine largeur, cibles de choix ≥ 96 px | `style.css`, v10.13 |
| Respect du silence et de l'apraxie | Pas de timeout bloquant ; anti-tremblement au relâchement ; `pointerup` tolérant | `app.js`, pépite 21 |
| Pas de contacts visuels forcés | Aucun exercice n'exige le regard ; l'avatar est optionnel | revue de code |
| Pauses accessibles partout | Bouton 🌈 Calme sur chaque écran, sans condition | `modules/calm.js` |
| Récompenses personnalisées | Étoiles, autocollants des Amis, bulles, ballons — jamais uniquement sociaux | `rewards-kids.js`, `friends.js` |
| Hors ligne et privé | Aucun `fetch` d'exercice ; micro analysé localement, jamais enregistré sans action explicite | `tools/test-privacy-network.mjs` |

---

## 4. Cartographie des 35 pépites

Statut au 21/11/2026 : **Livré v10.15** = nouveau dans cette version · **Présent** = déjà en place · **Partiel** = brique existante à compléter · **Feuille de route** = spécifié ici, non codé dans cette version.

### Axe 1 — Ergonomie ABA et zéro frustration

| # | Pépite | Statut | Emplacement / technique |
|---|---|---|---|
| 1 | Apprentissage sans échec + main après 3 s | Présent | `modules/widgets.js` `choiceBoard` |
| 2 | Filtrage carte par carte Actif/Masqué | Présent | `editor.js` (`hidden`), `app.js` grille, places fixes |
| 3 | Mode sensoriel calme | Présent | `widgets.setCalmMode`, `style.css`, `media.setCalmModeAudio` |
| 16 | Places fixes + bouton Explorer | **Livré v10.15** | `grid-layout.js` (déjà) + bouton `👁️ Explorer 30 s` dans Parler (mode parent, parle au lieu d'éditer) |
| 17 | Recherche avec chemin lumineux | **Livré v10.15** | Champ de recherche parent : bascule l'onglet, fait clignoter l'onglet puis la carte |
| 21 | Ligne figée + anti-tremblement | **Livré v10.15** (anti-tremblement) | Seuil de mouvement 14 px au relâchement, réglable en mode parent ; ligne contextuelle en feuille de route |
| 22 | 5 étapes PictoTEA + majuscules | Partiel | Majuscules livrées v10.13 ; paliers de vocabulaire (`core-vocabulary-plan.js`) à étendre en 5 étapes PictoTEA |

### Axe 2 — Orthophonie et passage à la phrase

| # | Pépite | Statut | Emplacement / technique |
|---|---|---|---|
| 4 | Verbe + 3 compléments | **Livré v10.15** | `modules/clinique.js` : 6 matrices (manger, boire, jouer, mettre, enlever, toucher) × 3 compléments, phrases FR/darija |
| 5 | Éveil vocal au souffle et à la voix | Partiel | Micro local dans `ex-imitation`/`ex-verbal` ; jeu du ballon intégré à la séance du jour (v10.15) |
| 6 | Miroir d'articulation + jauge verte | Partiel | Miroir caméra `ex-imitation` D.1 ; vidéo modèle `widgets.videoModel` ; jauge à unifier |
| 7 | Progression phonétique anatomique | Partiel | `ex-ortho.js` (phonèmes par niveaux) ; ordre bilabial → alvéolaire → vélaire + schéma de bouche en feuille de route |
| 8 | Séquences d'autonomie pas à pas | Partiel | `sequenceBoard`, `ex-hygiene`, `ex-autonomy` ; plein écran une étape par écran en feuille de route |
| 11 | Cartes pragmatiques + Mode Écho | **Livré v10.15** | Pastille « C’est une blague ! » + mode écho 2,5 s avec oreille animée après la phrase |
| 14 | Tracé tri-script Tifinagh/Arabe/Latin | Partiel | `ex-writing.js` (latin) ; tracé arabe/tifinagh en feuille de route |
| 18 | Popups grammaticaux + prononciation phonétique | Partiel | Barre de temps `morphology.js` ; champ phonétique en feuille de route |
| 27 | Parseval 75 % + Attrape-Signes | **Livré v10.15** (jeu) | `clinique.js` : suites de 2–4 signes, adaptation 2–4 choix via `widgets` ; cible 75 % déjà au moteur |

### Axe 3 — Autonomie, repères temporels, famille

| # | Pépite | Statut | Emplacement / technique |
|---|---|---|---|
| 8 | Séquences « faire seul » | Partiel | `sequenceBoard`, hygiène, autonomie |
| 9 | Planning visuel barré + sablier | **Livré v10.15** (barré) | Trait vert sur l'étape terminée (`style.css`) ; sablier silencieux déjà présent |
| 10 | Créateur de scénarios sociaux | Partiel | Scénarios fixes `ex-ortho.js` ; éditeur 2/3/4 choix en feuille de route |
| 12 | Cahier de vie 3 photos + voix | **Livré v10.15** | `clinique.js` + store `life_book` (photo, voix, texte) 100 % local |
| 23 | Bandeau questions/réponses | **Livré v10.15** | Pastilles de questions dans Parler : filtre la catégorie de réponses |
| 24 | D’abord/Ensuite + choix A/B | Partiel | Exercice A.3, mode « Maintenant/Ensuite » du planning ; écran de choix binaire en feuille de route |
| 26 | Mission réelle + auto-évaluation | Partiel | Missions « En vrai » existantes ; auto-évaluation enfant 😊/🤔 en feuille de route |
| 29 | Pastilles d'interruption | **Livré v10.15** | Oui, Non, « Attends, je prépare ma phrase ! », Aide-moi : parlent sans vider la phrase |
| 31 | Annulé ❌ + double minuteur | **Livré v10.15** (annulé) | Étape annulée gardée avec croix rouge rassurante + « Rétablir » ; double minuteur existant |

### Axe 4 — Cognition MITA, multisensoriel, parcours guidé

| # | Pépite | Statut | Emplacement / technique |
|---|---|---|---|
| 13 | Matrices MITA 2–3 critères | Présent | `ex-next.js` B.12/B.15, `ex-visual.js`, prépositions C.6 |
| 15 | Onboarding 10 questions + séance 15 min | **Livré v10.15** (séance) | `clinique.js` : 4 temps (5 cartes, matrice, voix, ballons), sans chronomètre ; questionnaire enrichi en feuille de route |
| 19 | Échelle de douleur + ardoise | **Livré v10.15** | `clinique.js` : 6 zones du corps + 5 visages, énoncé FR/darija ; ardoise tactile avec 6 couleurs |
| 25 | Bulle de calme + OK Stop | **Livré v10.15** (Go/No-Go) | `clinique.js` OK Stop : coffre ouvert/fermé, aucune sanction ; bulle 🌈 existante |
| 28 | Tutoriels muets + géoplan | Partiel | Démo muette présente ; géoplan à points en feuille de route |
| 33 | Écran compact 25 cartes d'urgence | **Livré v10.15** | `clinique.js` : 24 cartes vitales en 6 colonnes, un seul geste |

### Lot 2 — CAA avancée

| # | Pépite | Statut | Emplacement / technique |
|---|---|---|---|
| 20 | Intonation émotionnelle + GIF limités | Partiel | Atelier ortho (pitch local) ; réglage de ton sur la voix de synthèse en feuille de route |
| 30 | Livret papier PDF | Présent | `printAacBoard()` (A4 par catégories, cartes actives) ; onglets à découper en feuille de route |
| 32 | FALC + bande de pictogrammes | Feuille de route | La phrase est déjà une bande de pictogrammes ; mode FALC à spécifier avec un orthophoniste |
| 34 | Compteur des 4 fonctions | Feuille de route | Taxonomie déjà journalisée (`ex-ortho.js` `fn`) ; compteur CAA local à ajouter au tableau de bord |
| 35 | Verrouillage granulaire PIN | Feuille de route | Mode parent au cadenas 3 s ; PIN et permissions par action à concevoir |

---

## 5. Flux de données

```
Toucher une carte
  └─ onCardTap ──► sayCard (voix enregistrée / TTS local)
                 ├─► learnTap (suggestions apprises, settings.aacHistory)
                 ├─► strip (8 mots max, langue par mot)
                 └─► [si exercice] recordTrial ──► db.addTrial
                                                  ├─► modules/levels.js (5 succès = niveau +1)
                                                  ├─► modules/progress.js (statut PEI)
                                                  └─► modules/dashboard.js (KPI, CSV, rapport)

Atelier clinique
  ├─ Séance du jour : succès locaux + date de dernière séance (settings), aucune donnée identifiante
  ├─ Attrape-Signes : recordGameTrialScore (adaptation 2–4 choix), rien d'autre
  ├─ Cahier de vie : db life_book { slot, photo Blob, voice Blob, updatedAt } — jamais sauvegardé par défaut
  └─ Douleur / ardoise / urgence : éphémère, rien n'est écrit
```

**Schéma IndexedDB** (v9) : `cards`, `settings`, `pei_goals`, `trials`, `recordings`, `visual_overrides`, `online_cache`, `schedule_logs`, `schedule_config`, `abc_logs`, `ortho_logs`, **`life_book`** (nouveau, keyPath `slot`, 3 entrées maximum).

**Sauvegarde** : les réglages listés dans `EXPORTED_SETTINGS` sont inclus. Les médias (photos, voix, cahier de vie) ne le sont que si le parent coche « Inclure exceptionnellement les photos et les voix » ; `life_book` reste local, comme les autres médias.

---

## 6. Découpage des modules

```
app.js                    shell : barre, bande, espaces, verrou parent, sauvegarde
modules/spaces.js         navigation Jeux / Ma journée / Émotions + contexte ctx
modules/clinique.js       NEW : hub Ateliers + 8 ateliers + routage interne
modules/clinic-i18n.js    NEW : libellés FR des ateliers + accès darija
modules/clinic-i18n-dr.js NEW : darija générée par OpenAI (hors ligne)
modules/widgets.js        moteur sans échec partagé (déjà)
modules/ex-schedule.js    planning visuel (barré + annulé)
db.js                     IndexedDB, version 9
tools/audit-global.mjs    NEW : audit statique de l'application entière
tools/test-clinique.mjs   NEW : contrôles de l'espace clinique et des invariants
docs/                     ce document + rapport d'audit
```

Ajouter un atelier = une fonction `(ctx) => HTMLElement` dans `clinique.js` + une tuile dans le hub. Aucun autre fichier à modifier, aucun objectif PEI à créer.

---

## 7. Livraison v10.15 et suite

**Livré dans cette version** : Ateliers cliniques (pépites 4, 12, 15 séance, 19, 25 Go/No-Go, 27, 33), cœur CAA (11, 16, 17, 21, 23, 29), planning (9 barré, 31 annulé), Darija OpenAI pour les nouveaux écrans, audit global et tests.

**Prochaine version proposée (v10.16)** : ligne figée contextuelle, intonation de la voix, champ de prononciation phonétique, tracé arabe/tifinagh, géoplan, éditeur de scénarios sociaux 2/3/4 choix, compteur des 4 fonctions, PIN granulaire, onglets à découper du livret papier, mode FALC validé par un orthophoniste.

**Critères d'acceptation** : `npm test` vert ; `tools/audit-global.mjs` sans erreur bloquante ; vérification visuelle FR et darija de chaque écran ; aucune requête réseau déclenchée par un atelier ; aucune donnée d'enfant dans les sources.
