// Les 23 sections et 71 objectifs du PEI de 3 mois (approche ABA, grille ABLLS-R).
// Aucun nom ni donnée personnelle ici : le profil de l'enfant reste dans le téléphone.
// Chaque objectif porte une règle chiffrée (rule) que progress.js sait évaluer à partir des essais notés.

export const SECTIONS = [
  { id: 'A', name: 'Coopération et renforçateurs', emoji: '🤝' },
  { id: 'B', name: 'Performance visuelle', emoji: '🧩' },
  { id: 'C', name: 'Langage réceptif', emoji: '👂' },
  { id: 'D', name: 'Imitation motrice', emoji: '🙌' },
  { id: 'E', name: 'Imitation vocale', emoji: '🗣️' },
  { id: 'F', name: 'Demandes (PECS)', emoji: '🤲' },
  { id: 'G', name: 'Dénomination', emoji: '🏷️' },
  { id: 'H', name: 'Intraverbal', emoji: '💬' },
  { id: 'K', name: 'Jeu et loisirs', emoji: '🪆' },
  { id: 'L', name: 'Interaction sociale', emoji: '👋' },
  { id: 'M', name: 'Suivi en groupe', emoji: '👧' },
  { id: 'N', name: 'Routines de classe', emoji: '🏫' },
  { id: 'P', name: 'Généralisation', emoji: '🌍' },
  { id: 'Q', name: 'Lecture', emoji: '🔤' },
  { id: 'R', name: 'Mathématiques', emoji: '🔢' },
  { id: 'S', name: 'Écriture', emoji: '✏️' },
  { id: 'T', name: 'Orthographe', emoji: '📝' },
  { id: 'U', name: 'Habillage', emoji: '👕' },
  { id: 'V', name: 'Alimentation', emoji: '🥄' },
  { id: 'W', name: 'Hygiène', emoji: '🧼' },
  { id: 'X', name: 'Propreté / toilettes', emoji: '🚽' },
  { id: 'Y', name: 'Motricité globale', emoji: '🤸' },
  { id: 'Z', name: 'Motricité fine', emoji: '✂️' },
];

const S3 = (ratio, minTrials = 10, extra = {}) => ({ type: 'sessions', ratio, sessions: 3, minTrials, ...extra });

export const GOALS = [
  { id: 'A.1', title: 'Attention et coopération 10-15 min sans rupture', criterion: '4 séances consécutives', rule: { type: 'validSessions', n: 4 } },
  { id: 'A.2', title: 'Diversifier les renforçateurs (3 sociaux + 3 tangibles)', criterion: '6 renforçateurs efficaces sur 2 semaines', rule: { type: 'reinforcers', social: 3, tangible: 3 } },
  { id: 'A.3', title: 'Accepter la transition entre deux activités', criterion: '8/10 essais sur 3 séances consécutives', rule: S3(0.8) },

  { id: 'B.1', title: "Matching d'images non identiques", criterion: '80 % sur 3 séances consécutives', rule: S3(0.8, 5) },
  { id: 'B.2', title: 'Puzzle de 6 à 8 pièces en autonomie', criterion: '3 essais consécutifs sans aide physique', rule: { type: 'consecutive', n: 3 } },
  { id: 'B.3', title: 'Reproduire un modèle 2D en 3D (cubes)', criterion: '4 essais sur 5', rule: { type: 'ratio', need: 4, of: 5 } },
  { id: 'B.4', title: 'Matching par association logique', criterion: '8/10, au moins 8 paires, 3 séances', rule: S3(0.8, 10, { minDistinct: 8 }) },
  { id: 'B.5', title: 'Matching par fonction', criterion: '80 %, 5 catégories, 3 séances', rule: S3(0.8, 5, { minDistinct: 5 }) },
  { id: 'B.6', title: 'Matching par catégorie', criterion: '80 %, 4 catégories, 3 séances', rule: S3(0.8, 5, { minDistinct: 4 }) },

  { id: 'C.1', title: '10 consignes simples sans geste', criterion: '8/10 pour chacune des 10 consignes', rule: { type: 'perItem', need: 8, of: 10, items: 10 } },
  { id: 'C.2', title: 'Choisir parmi 4 par fonction ou catégorie', criterion: '80 % sur 3 séances consécutives', rule: S3(0.8, 5) },
  { id: 'C.3', title: 'Consigne à deux éléments, dans l’ordre', criterion: '8 essais sur 10', rule: { type: 'ratio', need: 8, of: 10 } },
  { id: 'C.4', title: 'Association logique réceptive', criterion: '8/10, au moins 10 paires, 3 séances', rule: S3(0.8, 10, { minDistinct: 10 }) },

  { id: 'D.1', title: 'Imiter une séquence de 2-3 gestes', criterion: '4 essais sur 5', rule: { type: 'ratio', need: 4, of: 5 } },
  { id: 'D.2', title: 'Imiter des gestes fins des mains', criterion: '8/10 sur 3 séances consécutives', rule: S3(0.8) },
  { id: 'D.3', title: 'Imitation dans les chansons et jeux', criterion: 'Au moins 3 chansons ou jeux', rule: { type: 'distinct', min: 3 } },

  { id: 'E.1', title: 'Répéter 10 mots de 2 syllabes', criterion: '8/10 pour chacun des 10 mots', rule: { type: 'perItem', need: 8, of: 10, items: 10 } },
  { id: 'E.2', title: 'Imiter une phrase de 2-3 mots', criterion: '4/5 pour 5 phrases', rule: { type: 'perItem', need: 4, of: 5, items: 5 } },
  { id: 'E.3', title: 'Clarté de /t/, /d/, /k/', criterion: 'Validé avec l’orthophoniste', rule: { type: 'manual' } },

  { id: 'F.1', title: 'PECS phase 1 : échanger une image', criterion: '8/10, 5 images, 3 séances', rule: S3(0.8, 10, { minDistinct: 5 }) },
  { id: 'F.2', title: 'PECS phase 2 : se déplacer vers l’adulte (≥ 2 m)', criterion: '8/10 à 2 m, 3 séances', rule: S3(0.8) },
  { id: 'F.3', title: 'Vocaliser pendant l’échange PECS', criterion: 'Au moins 5 essais sur 10', rule: { type: 'ratio', need: 5, of: 10 } },

  { id: 'G.1', title: 'Dénommer 15 images sans question', criterion: '12/15 sur 3 séances consécutives', rule: { type: 'sessionsDistinct', perSession: 12, sessions: 3 } },
  { id: 'G.2', title: 'Dénommer 10 verbes d’action', criterion: '80 % sur 10 verbes', rule: { type: 'repertoire', items: 10, ratio: 0.8 } },
  { id: 'G.3', title: 'Dénommer à la maison et en classe', criterion: 'Au moins 8 items sur 15', rule: { type: 'distinct', min: 8 } },

  { id: 'H.1', title: 'Répondre à 5 questions personnelles', criterion: '8/10 pour chacune des 5 questions', rule: { type: 'perItem', need: 8, of: 10, items: 5 } },
  { id: 'H.2', title: 'Compléter 5 comptines', criterion: '4/5 pour chaque comptine', rule: { type: 'perItem', need: 4, of: 5, items: 5 } },
  { id: 'H.3', title: '10 associations logiques', criterion: '80 % sur 10 associations, 3 séances', rule: S3(0.8, 10, { minDistinct: 10 }) },

  { id: 'K.1', title: 'Nouvelle séquence de jeu en autonomie', criterion: '3 essais consécutifs, 2 séances', rule: { type: 'consecutive', n: 3, minDays: 2 } },

  { id: 'L.1', title: 'Répondre à une salutation', criterion: '8/10 sur 3 séances consécutives', rule: S3(0.8) },
  { id: 'L.2', title: 'Initier une interaction avec un pair', criterion: '3 par semaine, 2 semaines de suite', rule: { type: 'weekly', perWeek: 3, weeks: 2 } },
  { id: 'L.3', title: 'Tour de rôle sur 2-3 échanges', criterion: '4 essais sur 5', rule: { type: 'ratio', need: 4, of: 5 } },

  { id: 'M.1', title: 'Suivre une consigne collective', criterion: '7/10 sur 3 séances de groupe', rule: S3(0.7) },
  { id: 'M.2', title: 'Rester assis et attentif 5 min en groupe', criterion: '4 séances sur 5', rule: { type: 'ratio', need: 4, of: 5 } },
  { id: 'M.3', title: 'Imiter un pair modèle', criterion: '7 essais sur 10', rule: { type: 'ratio', need: 7, of: 10 } },

  { id: 'N.1', title: 'Routine d’arrivée en classe', criterion: '4 matins sur 5', rule: { type: 'ratio', need: 4, of: 5 } },
  { id: 'N.2', title: 'Lever la main avant de parler', criterion: '7/10 sur 2 semaines', rule: { type: 'ratio', need: 7, of: 10 } },
  { id: 'N.3', title: 'Transition entre deux activités scolaires', criterion: '8 essais sur 10', rule: { type: 'ratio', need: 8, of: 10 } },

  { id: 'P.1', title: 'Généraliser 5 compétences à la maison', criterion: '5 compétences sur 4 semaines', rule: { type: 'envSkills', env: 'home', min: 5 } },
  { id: 'P.2', title: 'Généraliser 5 compétences à l’école', criterion: '5 compétences sur 4 semaines', rule: { type: 'envSkills', env: 'school', min: 5 } },
  { id: 'P.3', title: 'Mêmes réponses avec 3 intervenants', criterion: '80 % avec chacun des 3', rule: { type: 'interveners', ratio: 0.8, minTrials: 5 } },

  { id: 'Q.1', title: 'Reconnaître et nommer 10 lettres', criterion: '8/10 sur 3 séances consécutives', rule: { type: 'sessionsDistinct', perSession: 8, sessions: 3 } },
  { id: 'Q.2', title: 'Associer 5 sons à leur lettre', criterion: '80 % pour les 5 sons', rule: { type: 'perItem', need: 4, of: 5, items: 5 } },
  { id: 'Q.3', title: 'Lire une syllabe CV par assemblage', criterion: '5 syllabes sur 3 séances', rule: { type: 'sessionsDistinct', perSession: 5, sessions: 3 } },

  { id: 'R.1', title: 'Dénombrer 1 à 5 objets en pointant', criterion: '8 essais sur 10', rule: { type: 'ratio', need: 8, of: 10 } },
  { id: 'R.2', title: 'Associer chiffre et quantité (1 à 5)', criterion: '80 % sur 3 séances consécutives', rule: S3(0.8, 5) },
  { id: 'R.3', title: 'Réciter la comptine jusqu’à 10', criterion: '4 essais sur 5', rule: { type: 'ratio', need: 4, of: 5 } },

  { id: 'S.1', title: 'Tracer des traits horizontaux et verticaux', criterion: '4 essais sur 5', rule: { type: 'ratio', need: 4, of: 5 } },
  { id: 'S.2', title: 'Tracer un rond et un demi-cercle', criterion: '4 essais sur 5', rule: { type: 'ratio', need: 4, of: 5 } },
  { id: 'S.3', title: 'Copier son prénom en capitales', criterion: '3 essais consécutifs', rule: { type: 'consecutive', n: 3 } },

  { id: 'T.1', title: 'Reconnaître son prénom écrit', criterion: '8 essais sur 10', rule: { type: 'ratio', need: 8, of: 10 } },
  { id: 'T.2', title: 'Copier PAPA, MAMA et son prénom', criterion: '3 essais consécutifs par mot', rule: { type: 'perItem', need: 3, of: 3, items: 3 } },
  { id: 'T.3', title: 'Épeler un mot en pointant les lettres', criterion: '2 mots, 3 essais chacun', rule: { type: 'perItem', need: 3, of: 3, items: 2 } },

  { id: 'U.1', title: 'Enfiler seul un vêtement simple', criterion: '4/5 sur 2 semaines', rule: { type: 'ratio', need: 4, of: 5 } },
  { id: 'U.2', title: 'Fermer un scratch ou un gros bouton', criterion: '8 essais sur 10', rule: { type: 'ratio', need: 8, of: 10 } },
  { id: 'U.3', title: 'Mettre et retirer ses chaussures', criterion: '4/5 sur 2 semaines', rule: { type: 'ratio', need: 4, of: 5 } },

  { id: 'V.1', title: 'Repas complet à la cuillère', criterion: '8/10 sur 2 semaines', rule: { type: 'ratio', need: 8, of: 10 } },
  { id: 'V.2', title: 'Piquer avec une fourchette', criterion: '7 essais sur 10', rule: { type: 'ratio', need: 7, of: 10 } },
  { id: 'V.3', title: 'Boire au verre sans renverser', criterion: '4 essais sur 5', rule: { type: 'ratio', need: 4, of: 5 } },

  { id: 'W.1', title: 'Lavage des mains complet', criterion: '4/5 sans guidance sur 2 semaines', rule: { type: 'ratio', need: 4, of: 5 } },
  { id: 'W.2', title: 'Se laver le visage', criterion: '4 essais sur 5', rule: { type: 'ratio', need: 4, of: 5 } },
  { id: 'W.3', title: 'Se brosser les dents', criterion: '8 essais sur 10', rule: { type: 'ratio', need: 8, of: 10 } },

  { id: 'X.1', title: 'Demander les toilettes spontanément', criterion: '4 fois par jour, 2 semaines', rule: { type: 'daily', perDay: 4, days: 14 } },
  { id: 'X.2', title: 'Essuyage, rhabillage et chasse d’eau', criterion: '7 essais sur 10', rule: { type: 'ratio', need: 7, of: 10 } },
  { id: 'X.3', title: 'Réduire les accidents de 50 %', criterion: '-50 % sur 4 semaines vs semaine 1', rule: { type: 'reduction', pct: 50 } },

  { id: 'Y.1', title: 'Parcours moteur de 3 habiletés', criterion: '3 essais consécutifs', rule: { type: 'consecutive', n: 3 } },
  { id: 'Y.2', title: 'Attraper et lancer à 2 mètres', criterion: '7 échanges sur 10', rule: { type: 'ratio', need: 7, of: 10 } },
  { id: 'Y.3', title: 'Équilibre sur un pied 3 secondes', criterion: '4 essais sur 5', rule: { type: 'ratio', need: 4, of: 5 } },

  { id: 'Z.1', title: 'Prise tripode du crayon', criterion: '4 séances sur 5', rule: { type: 'ratio', need: 4, of: 5 } },
  { id: 'Z.2', title: 'Découper le long d’une ligne', criterion: '3 essais consécutifs à 80 %', rule: { type: 'consecutive', n: 3 } },
  { id: 'Z.3', title: 'Enfiler 5 petites perles', criterion: '4 essais sur 5', rule: { type: 'ratio', need: 4, of: 5 } },
].map((goal) => ({ ...goal, phase: 'pei', section: goal.id.split('.')[0] }));

// Prochains niveaux ABA (référentiel ABLLS-R) : la suite du parcours après le PEI de 3 mois (demande d'Aziz, 13/11).
const r45 = { type: 'ratio', need: 4, of: 5 };
const NEXT = [
  ['A.4', 'Travailler seule 3 à 5 min', '4 séances consécutives', { type: 'validSessions', n: 4 }],
  ['A.5', 'Attendre un renforçateur différé (5 à 10 jetons)', '8/10 sur 3 séances consécutives', S3(0.8)],
  ['A.6', 'Accepter un changement d’ordre (D’abord / Ensuite)', '8/10 sur 3 séances consécutives', S3(0.8)],
  ['A.7', 'Continuer après une erreur, sans opposition', '4 essais sur 5', r45],
  ['B.7', 'Ranger 3 à 5 images du plus petit au plus grand', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['B.8', 'Compléter une suite logique (ABAB, AABB, ABC)', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['B.9', 'Mémoire : retrouver 1 à 3 images après 3 secondes', '8/10 sur 3 séances consécutives', S3(0.8)],
  ['B.10', 'Trouver l’intrus parmi 4 à 6 images', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['B.11', 'Ordonner 3 à 4 images (avant → pendant → après)', '4 essais sur 5', r45],
  ['B.12', 'Compléter une matrice forme × couleur', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['B.13', 'Associer un objet à son ombre', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['B.14', 'Puzzle de 9 à 12 pièces sans aide', '3 essais consécutifs', { type: 'consecutive', n: 3 }],
  ['C.5', 'Désigner par attributs (taille, couleur)', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['C.6', 'Comprendre sur, sous, dans, devant, derrière', '8/10 sur 3 séances consécutives', S3(0.8)],
  ['C.7', 'Comprendre la négation (« celui qui n’est pas… »)', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['C.8', 'Consigne à 3 éléments dans l’ordre', '8 essais sur 10', { type: 'ratio', need: 8, of: 10 }],
  ['C.9', 'Trouver qui fait l’action (« qui dort ? »)', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['C.10', 'Comprendre il, elle, ils, elles', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['D.4', 'Imiter une séquence de 4 gestes', '4 essais sur 5', r45],
  ['D.5', 'Imiter des expressions du visage', '8/10 sur 3 séances consécutives', S3(0.8)],
  ['D.6', 'Imiter 2 actions sur des objets, en différé', '4 essais sur 5', r45],
  ['E.4', 'Répéter 10 mots de 3 à 4 syllabes', '8/10 pour chacun des 10 mots', { type: 'perItem', need: 8, of: 10, items: 10 }],
  ['E.5', 'Imiter une phrase de 4 à 5 mots', '4/5 pour 5 phrases', { type: 'perItem', need: 4, of: 5, items: 5 }],
  ['E.6', 'Moduler sa voix (douce / forte, lente / rapide)', '4 essais sur 5', r45],
  ['F.4', 'Demande complète (« Je veux … s’il te plaît »)', '8/10 sur 3 séances consécutives', S3(0.8)],
  ['F.5', 'Demander de l’aide devant un obstacle', '4 essais sur 5', r45],
  ['F.6', 'Refuser poliment ou dire « Attends »', '4 essais sur 5', r45],
  ['F.7', 'Poser une question (« C’est quoi ? », « Où est… ? »)', '4 essais sur 5', r45],
  ['G.4', 'Dénommer un objet avec sa couleur ou sa taille', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['G.5', 'Dénommer les parties d’un objet ou d’un animal', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['G.6', 'Dénommer la catégorie d’un groupe d’images', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['G.7', 'Décrire une image d’action (qui + fait + quoi)', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['H.4', 'Répondre à « Où ? » et « Qui ? »', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['H.5', 'Répondre à « Quand ? » et « Pourquoi ? »', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['H.6', 'Citer 3 éléments d’une catégorie', '4 essais sur 5', r45],
  ['H.7', 'Trouver les contraires (chaud / froid…)', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['K.2', 'Jeu symbolique à plusieurs étapes', '3 essais consécutifs', { type: 'consecutive', n: 3 }],
  ['K.3', 'Jouer à un jeu à règles (memory, loto)', '4 essais sur 5', r45],
  ['L.4', 'Reconnaître les émotions en famille', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['L.5', 'Partager ou attendre son tour sur 5 échanges', '4 essais sur 5', r45],
  ['L.6', 'Répondre à la question d’un proche', '8/10 sur 3 séances consécutives', S3(0.8)],
  ['M.4', 'Rester attentive en groupe 10 minutes', '4 essais sur 5', r45],
  ['N.4', 'Ranger son matériel seule', '4 essais sur 5', r45],
  ['P.4', 'Généraliser : photo ↔ dessin', '8 compétences réussies à la maison', { type: 'envSkills', env: 'home', min: 8 }],
  ['Q.4', 'Associer capitales et minuscules', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['Q.5', 'Lire des syllabes AR, AL, MAR, SOL…', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['Q.6', 'Lire un mot et trouver son image', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['Q.7', 'Lire une courte phrase illustrée', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['R.4', 'Dénombrer de 6 à 20 objets', '8 essais sur 10', { type: 'ratio', need: 8, of: 10 }],
  ['R.5', 'Comparer : plus, moins, autant', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['R.6', 'Additions avec images (jusqu’à 10)', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['R.7', 'Soustractions avec images (jusqu’à 10)', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['R.8', 'Trouver le nombre qui manque (jusqu’à 20)', '4 essais sur 5', r45],
  ['S.4', 'Tracés complexes (zigzags, créneaux, boucles)', '4 essais sur 5', r45],
  ['S.5', 'Copier le prénom de sa sœur et des mots courts', '3 essais consécutifs', { type: 'consecutive', n: 3 }],
  ['T.4', 'Reconstituer un mot entendu, avec l’image', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['U.4', 'Choisir ses habits selon la météo', '80 % sur 3 séances consécutives', S3(0.8, 5)],
  ['V.4', 'Mettre la table pour la famille', '4 essais sur 5', r45],
  ['W.4', 'Routine du matin ou du soir, seule', '4 essais sur 5', r45],
  ['X.4', 'Toilettes en autonomie, sans rappel', '4 fois par jour, 2 semaines', { type: 'daily', perDay: 4, days: 14 }],
  ['Y.4', 'Parcours moteur de 5 habiletés', '3 essais consécutifs', { type: 'consecutive', n: 3 }],
  ['Z.4', 'Découper des courbes, tracer dans un couloir étroit', '3 essais consécutifs', { type: 'consecutive', n: 3 }],
].map(([id, title, criterion, rule]) => ({ id, title, criterion, rule, phase: 'next', section: id.split('.')[0] }));

// Dans chaque section : le PEI d'abord, puis les prochains niveaux (goalsOf garde cet ordre).
GOALS.push(...NEXT);

export const goalById = (id) => GOALS.find((g) => g.id === id) || null;
export const goalsOf = (sectionId) => GOALS.filter((g) => g.section === sectionId);
