# Publier Kalimati

## État actuel — 25/11/2026

La version d’essai n’est pas encore publiée. L’adresse `https://elguellouchi.github.io/Kalimati/essai/` ne doit donc pas être utilisée pour tester.

Le Lot 0 prépare les tests et les règles de publication. La publication de `/essai/` (L0-05), son bandeau (L0-06) et la coupure Supabase de l’essai (L0-12) restent à faire ensemble.

Ne copiez pas manuellement des fichiers dans le site pour créer une version d’essai.

## Règles à respecter

1. Tester d’abord sur la version d’essai.
2. Attendre 48 heures de tests réels.
3. Publier le site principal une fois par semaine au maximum.
4. Ne jamais forcer une publication sur `main`.
5. Ne publier aucune photo, voix, phrase, prénom d’enfant ou secret.
6. Garder les tests verts avant toute publication.

## Quand la version d’essai sera prête

### 1. Autoriser la publication automatique

Dans les réglages GitHub du dépôt :

- ouvrir **Settings** ;
- ouvrir **Pages** ;
- choisir **GitHub Actions** comme source.

Ce réglage doit être fait par Aziz. Il peut provoquer une courte interruption du site.

### 2. Publier l’essai

Après la réalisation de L0-05 :

- fusionner le travail validé dans la branche `essai` ;
- laisser le workflow publier ;
- ouvrir `https://elguellouchi.github.io/Kalimati/essai/`.

Vérifier que la page affiche « Version d’essai » en mode parent.

### 3. Tester pendant 48 heures

Faire les parcours habituels sur les appareils de la famille :

- parler avec les cartes ;
- couper le réseau et rouvrir l’application ;
- vérifier les photos et les voix ;
- vérifier que les données de la version principale n’ont pas changé.

Noter tout problème. Ne pas publier sur `main` tant qu’un problème reste ouvert.

### 4. Publier le site principal

Après 48 heures sans problème :

- fusionner `essai` dans `main` ;
- laisser la publication automatique terminer ;
- ouvrir `https://elguellouchi.github.io/Kalimati/` ;
- vérifier que la nouvelle version s’ouvre.

Ne pas utiliser `git push --force`.

## Commandes de contrôle avant publication

```bash
npm test
npm run test:e2e
```

Les deux commandes doivent réussir. Le compte rendu du lot doit contenir leur vraie sortie.
