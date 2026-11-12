// Contenus des exercices du PEI (images = emojis par défaut ; le parent peut filmer des modèles).

export const REINFORCERS = [
  { id: 'chatouilles', kind: 'social', emoji: '🤭', fr: 'Chatouilles' },
  { id: 'highfive', kind: 'social', emoji: '🙌', fr: 'High-five' },
  { id: 'chanson', kind: 'social', emoji: '🎶', fr: 'Chanson' },
  { id: 'calin', kind: 'social', emoji: '🤗', fr: 'Câlin' },
  { id: 'danse', kind: 'social', emoji: '💃', fr: 'Danse en famille' },
  { id: 'figurine', kind: 'tangible', emoji: '🦖', fr: 'Figurine' },
  { id: 'bulles', kind: 'tangible', emoji: '🫧', fr: 'Bulles de savon' },
  { id: 'ballon', kind: 'tangible', emoji: '🎈', fr: 'Ballon' },
  { id: 'tablette', kind: 'tangible', emoji: '📱', fr: 'Tablette' },
  { id: 'gommettes', kind: 'tangible', emoji: '⭐', fr: 'Gommettes' },
];

export const ACTIVITIES = [
  { id: 'jeu', emoji: '🧸', fr: 'Jeu libre' }, { id: 'table', emoji: '🪑', fr: 'Travail à table' },
  { id: 'puzzle', emoji: '🧩', fr: 'Puzzle' }, { id: 'dessin', emoji: '🖍️', fr: 'Dessin' },
  { id: 'livre', emoji: '📖', fr: 'Livre' }, { id: 'repas', emoji: '🍽️', fr: 'Repas' },
  { id: 'bain', emoji: '🛁', fr: 'Bain' }, { id: 'dehors', emoji: '🌳', fr: 'Dehors' },
  { id: 'tablette', emoji: '📱', fr: 'Tablette' }, { id: 'dodo', emoji: '😴', fr: 'Dodo' },
];

// B.1 : non identiques (même catégorie, couleur ou fonction)
export const NON_IDENTICAL = [
  { id: 'pomme', model: '🍎', answer: '🍏', label: 'pomme', why: 'même catégorie' },
  { id: 'bleu', model: '🔵', answer: '🧢', label: 'bleu', why: 'même couleur' },
  { id: 'voiture', model: '🚗', answer: '🚙', label: 'voiture', why: 'même catégorie' },
  { id: 'chien', model: '🐕', answer: '🐩', label: 'chien', why: 'même catégorie' },
  { id: 'chaussure', model: '👟', answer: '👞', label: 'chaussure', why: 'même fonction' },
  { id: 'vert', model: '🟢', answer: '🥦', label: 'vert', why: 'même couleur' },
  { id: 'fleur', model: '🌷', answer: '🌻', label: 'fleur', why: 'même catégorie' },
  { id: 'jaune', model: '🟡', answer: '🍋', label: 'jaune', why: 'même couleur' },
  { id: 'chat', model: '🐈', answer: '🐱', label: 'chat', why: 'même catégorie' },
  { id: 'tasse', model: '☕', answer: '🍵', label: 'tasse', why: 'même fonction' },
];
export const DISTRACTORS = ['🚲', '🧦', '📘', '🔑', '🪑', '🍌', '⚽', '🛏️', '✂️', '🐟', '🎈', '🚪'];

// B.4 et C.4 : paires logiques
export const PAIRS = [
  { id: 'dents', a: { emoji: '🪥', fr: 'brosse à dents' }, b: { emoji: '🧴', fr: 'dentifrice' } },
  { id: 'pied', a: { emoji: '🧦', fr: 'chaussette' }, b: { emoji: '👟', fr: 'chaussure' } },
  { id: 'bol', a: { emoji: '🥄', fr: 'cuillère' }, b: { emoji: '🥣', fr: 'bol' } },
  { id: 'ecrire', a: { emoji: '✏️', fr: 'crayon' }, b: { emoji: '📓', fr: 'cahier' } },
  { id: 'mains', a: { emoji: '🧼', fr: 'savon' }, b: { emoji: '🙌', fr: 'mains' } },
  { id: 'porte', a: { emoji: '🔑', fr: 'clé' }, b: { emoji: '🚪', fr: 'porte' } },
  { id: 'lit', a: { emoji: '🛏️', fr: 'lit' }, b: { emoji: '🛌', fr: 'oreiller' } },
  { id: 'eau', a: { emoji: '🥛', fr: 'verre' }, b: { emoji: '💧', fr: 'eau' } },
  { id: 'poupee', a: { emoji: '🍼', fr: 'biberon' }, b: { emoji: '🪆', fr: 'poupée' } },
  { id: 'foot', a: { emoji: '⚽', fr: 'ballon' }, b: { emoji: '🦶', fr: 'pied' } },
  { id: 'froid', a: { emoji: '🧥', fr: 'manteau' }, b: { emoji: '🧢', fr: 'bonnet' } },
  { id: 'menage', a: { emoji: '🧹', fr: 'balai' }, b: { emoji: '🗑️', fr: 'pelle' } },
];

// B.5 : paniers fonctionnels
export const FUNCTION_BASKETS = [
  { id: 'couper', fr: 'Sert à couper', emoji: '✂️', items: [{ emoji: '✂️', fr: 'ciseaux' }, { emoji: '🔪', fr: 'couteau' }] },
  { id: 'ecrire', fr: 'Sert à écrire', emoji: '✏️', items: [{ emoji: '✏️', fr: 'crayon' }, { emoji: '🖊️', fr: 'stylo' }, { emoji: '🖍️', fr: 'feutre' }] },
  { id: 'manger', fr: 'Sert à manger', emoji: '🍽️', items: [{ emoji: '🥄', fr: 'cuillère' }, { emoji: '🍴', fr: 'fourchette' }, { emoji: '🍽️', fr: 'assiette' }] },
  { id: 'boire', fr: 'Sert à boire', emoji: '🥤', items: [{ emoji: '🥛', fr: 'verre' }, { emoji: '🧋', fr: 'gourde' }, { emoji: '☕', fr: 'tasse' }] },
  { id: 'laver', fr: 'Sert à laver', emoji: '🫧', items: [{ emoji: '🧼', fr: 'savon' }, { emoji: '🧴', fr: 'shampoing' }, { emoji: '🧽', fr: 'gant' }] },
];

// B.6 : boîtes de catégories
export const CATEGORY_BOXES = [
  { id: 'fruits', fr: 'Fruits', emoji: '🍎', items: [{ emoji: '🍌', fr: 'banane' }, { emoji: '🍇', fr: 'raisin' }, { emoji: '🍐', fr: 'poire' }, { emoji: '🍊', fr: 'orange' }] },
  { id: 'animaux', fr: 'Animaux', emoji: '🐱', items: [{ emoji: '🐶', fr: 'chien' }, { emoji: '🐮', fr: 'vache' }, { emoji: '🐔', fr: 'poule' }, { emoji: '🐟', fr: 'poisson' }] },
  { id: 'vetements', fr: 'Vêtements', emoji: '👕', items: [{ emoji: '👖', fr: 'pantalon' }, { emoji: '🧦', fr: 'chaussettes' }, { emoji: '👗', fr: 'robe' }, { emoji: '🧢', fr: 'casquette' }] },
  { id: 'vehicules', fr: 'Véhicules', emoji: '🚗', items: [{ emoji: '🚌', fr: 'bus' }, { emoji: '🚲', fr: 'vélo' }, { emoji: '✈️', fr: 'avion' }, { emoji: '🚂', fr: 'train' }] },
];

// C.1 : 10 consignes en audio pur
export const COMMANDS = [
  'Tape des mains', 'Touche ta tête', 'Donne-moi le crayon', 'Assieds-toi', 'Lève-toi',
  'Viens ici', 'Ouvre la porte', 'Range le jouet', 'Montre ton nez', 'Fais coucou',
].map((fr, i) => ({ id: `cmd${i + 1}`, fr }));

// C.2 : désigner par fonction ou catégorie (4 choix)
export const FUNCTION_QUESTIONS = [
  { id: 'manger', ask: "Montre-moi ce qu'on utilise pour manger", answer: '🥄', others: ['🚗', '👟', '⚽'] },
  { id: 'animal', ask: 'Montre-moi un animal', answer: '🐶', others: ['🍌', '🚲', '🪑'] },
  { id: 'boire', ask: "Montre-moi ce qu'on utilise pour boire", answer: '🥛', others: ['✂️', '🧸', '🔑'] },
  { id: 'fruit', ask: 'Montre-moi un fruit', answer: '🍎', others: ['🚌', '🧦', '📘'] },
  { id: 'dormir', ask: "Montre-moi où l'on dort", answer: '🛏️', others: ['🍽️', '🚗', '🎈'] },
  { id: 'ecrire', ask: "Montre-moi ce qu'on utilise pour écrire", answer: '✏️', others: ['🍌', '👕', '🐟'] },
  { id: 'vetement', ask: 'Montre-moi un vêtement', answer: '👕', others: ['🍪', '🚲', '🔑'] },
  { id: 'vehicule', ask: 'Montre-moi un véhicule', answer: '🚌', others: ['🐱', '🥛', '🧼'] },
];

// C.3 : objets de l'écran et consignes réelles à deux éléments
export const TWO_STEP_OBJECTS = [
  { id: 'balle', emoji: '⚽', fr: 'la balle' }, { id: 'chaise', emoji: '🪑', fr: 'la chaise' },
  { id: 'livre', emoji: '📘', fr: 'le livre' }, { id: 'chat', emoji: '🐱', fr: 'le chat' },
  { id: 'pomme', emoji: '🍎', fr: 'la pomme' }, { id: 'voiture', emoji: '🚗', fr: 'la voiture' },
];
export const TWO_STEP_REAL = [
  'Donne-moi la balle et assieds-toi', 'Prends le crayon et viens ici', 'Touche ta tête et tape des mains',
  'Ferme la porte et assieds-toi', 'Range le jouet et lève les bras',
];

// D : gestes
export const GESTURE_SEQUENCE = [
  { id: 'taper', emoji: '👏', fr: 'Taper des mains' }, { id: 'tete', emoji: '🙆', fr: 'Toucher sa tête' },
  { id: 'bras', emoji: '🙌', fr: 'Lever les bras' }, { id: 'ventre', emoji: '🫃', fr: 'Toucher son ventre' },
  { id: 'pieds', emoji: '🦶', fr: 'Taper des pieds' }, { id: 'coucou', emoji: '👋', fr: 'Faire coucou' },
];
export const FINE_GESTURES = [
  { id: 'pince', emoji: '🤏', fr: 'Pince pouce-index' }, { id: 'croiser', emoji: '🤞', fr: 'Croiser les doigts' },
  { id: 'pouce', emoji: '👍', fr: 'Lever le pouce' }, { id: 'index', emoji: '☝️', fr: "Pointer l'index" },
  { id: 'poing', emoji: '✊', fr: 'Fermer le poing', alt: '🖐️' },
];
export const SONGS = [
  { id: 'tete', fr: 'Tête, épaules, genoux, pieds', lines: [
    ['🙆', 'Tête'], ['🤷', 'Épaules'], ['🦵', 'Genoux'], ['🦶', 'Pieds'], ['👂', 'Les oreilles'], ['👀', 'Les yeux'], ['👃', 'Le nez'], ['👄', 'La bouche'],
  ] },
  { id: 'marionnettes', fr: 'Ainsi font, font, font', lines: [
    ['🖐️', 'Ainsi font, font, font'], ['🔄', 'Les petites marionnettes'], ['🖐️', 'Ainsi font, font, font'], ['🙈', 'Trois p’tits tours et puis s’en vont'],
  ] },
  { id: 'tape', fr: 'Tape, tape, petites mains', lines: [
    ['👏', 'Tape, tape, petites mains'], ['🔄', 'Tourne, tourne, petits moulins'], ['🐟', 'Nage, nage, petit poisson'], ['🕊️', 'Vole, vole, petit oiseau'],
  ] },
];

// E
export const ECHO_WORDS = [
  ['vélo', 'Vé', 'lo', '🚲'], ['gâteau', 'Gâ', 'teau', '🍰'], ['chapeau', 'Cha', 'peau', '👒'], ['ballon', 'Ba', 'llon', '⚽'],
  ['mouton', 'Mou', 'ton', '🐑'], ['pomme', 'Po', 'mme', '🍎'], ['banane', 'Ba', 'nane', '🍌'], ['poupée', 'Pou', 'pée', '🪆'],
  ['camion', 'Ca', 'mion', '🚚'], ['lapin', 'La', 'pin', '🐰'],
].map(([fr, s1, s2, emoji]) => ({ id: fr, fr, syllables: [s1, s2], emoji }));

export const ECHO_PHRASES = [
  { id: 'jeveux', words: [['🙋', 'Je veux'], ['👉', 'ça']] },
  { id: 'eau', words: [['🫴', 'Donne'], ['💧', "l'eau"]] },
  { id: 'gateau', words: [['➕', 'Encore'], ['🍰', 'gâteau']] },
  { id: 'fini', words: [['👉', "C'est"], ['✋', 'fini']] },
  { id: 'jouer', words: [['🧑‍🤝‍🧑', 'Viens'], ['🧸', 'jouer']] },
];

export const PHONEMES = [
  { id: 't', label: '/t/', cue: 'Le bout de la langue tape derrière les dents du haut.', emoji: '👅', words: ['tasse', 'tapis', 'tomate', 'tortue', 'bateau'] },
  { id: 'd', label: '/d/', cue: 'Langue derrière les dents du haut, et la gorge vibre.', emoji: '🦷', words: ['dos', 'dodo', 'doudou', 'dent', 'radis'] },
  { id: 'k', label: '/k/', cue: 'Le fond de la langue monte au fond de la bouche.', emoji: '😮', words: ['cadeau', 'cube', 'coq', 'canard', 'sac'] },
];

// G
export const TACT_ITEMS = [
  ['ballon', '⚽'], ['chaise', '🪑'], ['porte', '🚪'], ['chat', '🐱'], ['chien', '🐶'], ['voiture', '🚗'], ['pomme', '🍎'], ['lit', '🛏️'],
  ['livre', '📘'], ['verre', '🥛'], ['chaussure', '👟'], ['fleur', '🌷'], ['arbre', '🌳'], ['clé', '🔑'], ['téléphone', '📱'],
].map(([fr, emoji]) => ({ id: fr, fr, emoji }));

export const VERBS = [
  ['court', '🏃'], ['mange', '😋'], ['boit', '🥤'], ['dort', '😴'], ['saute', '🦘'],
  ['pleure', '😭'], ['nage', '🏊'], ['dessine', '🖍️'], ['se lave', '🧼'], ['joue', '🧸'],
].map(([fr, emoji]) => ({ id: fr, fr, emoji }));

// H
// Les réponses viennent du profil rempli par le parent (gardé dans le téléphone, jamais dans le code).
export const PERSONAL_QUESTIONS = [
  { id: 'nom', ask: "Comment tu t'appelles ?", field: 'name', emoji: '👧', vkey: 'person:abir' },
  { id: 'age', ask: 'Quel âge as-tu ?', field: 'age', emoji: '🎂' },
  { id: 'papa', ask: "Comment s'appelle ton papa ?", field: 'father', emoji: '👨', vkey: 'person:papa' },
  { id: 'soeur', ask: "Comment s'appelle ta sœur ?", field: 'sister', emoji: '👩‍🦰', vkey: 'person:ghita' },
  { id: 'ville', ask: 'Où habites-tu ?', field: 'city', emoji: '🏠' },
];

// scene = grande image de la comptine ; emoji = image du mot à trouver (remplaçables par des photos).
export const RHYMES = [
  { id: 'tours', start: 'Trois petits tours et puis s’en…', end: 'vont', scene: '🎭', emoji: '👋', sceneLabel: 'marionnettes' },
  { id: 'bois', start: 'Un, deux, trois, nous irons au…', end: 'bois', scene: '🧺', emoji: '🌳', sceneLabel: 'panier' },
  { id: 'bateau', start: 'Bateau sur…', end: "l'eau", scene: '⛵', emoji: '🌊', sceneLabel: 'bateau' },
  { id: 'jacques', start: 'Frère Jacques, dormez-…', end: 'vous', scene: '🔔', emoji: '🛌', sceneLabel: 'cloche' },
  { id: 'fontaine', start: 'À la claire…', end: 'fontaine', scene: '🌙', emoji: '⛲', sceneLabel: 'lune' },
];

export const ASSOCIATIONS = [
  ['Le dodo, c’est dans le…', 'lit', '🛏️', '😴', 'dodo'], ['Le jus, ça se…', 'boit', '🧃', '👄', 'bouche'], ['Le pain, ça se…', 'mange', '🍞', '🍽️', 'assiette'],
  ['Les chaussures, on les met aux…', 'pieds', '🦶', '👟', 'chaussures'], ['Le bonnet, on le met sur la…', 'tête', '🧒', '🧢', 'bonnet'],
  ['On se lave les mains avec du…', 'savon', '🧼', '👐', 'mains'], ['On coupe avec des…', 'ciseaux', '✂️', '📄', 'papier'],
  ['On dessine avec un…', 'crayon', '✏️', '🎨', 'dessin'], ['On roule dans une…', 'voiture', '🚗', '🛣️', 'route'], ['On joue avec un…', 'ballon', '⚽', '🥅', 'but'],
].map(([start, end, emoji, scene, sceneLabel]) => ({ id: end, start, end, emoji, scene, sceneLabel }));

// Situations de vie pour le studio des émotions ({sister} = prénom de la sœur, {name} = prénom de l'enfant).
export const SITUATIONS = [
  { id: 'partage', label: 'jouet', scene: '🧸', text: '{sister} partage son jouet avec {name}', emotion: 'content' },
  { id: 'glace', label: 'glace', scene: '🍦', text: 'La glace est tombée par terre', emotion: 'triste' },
  { id: 'bruit', label: 'bruit', scene: '📢', text: 'Il y a un très gros bruit', emotion: 'peur' },
  { id: 'dodo', label: 'dormir', scene: '🌙', text: "C'est l'heure de dormir", emotion: 'fatigue' },
  { id: 'casse', label: 'puzzle', scene: '🧩', text: 'Quelqu’un a cassé mon puzzle', emotion: 'colere' },
  { id: 'genou', label: 'genou', scene: '🩹', text: '{name} est tombée sur le genou', emotion: 'mal' },
  { id: 'bravo', label: 'médaille', scene: '🏅', text: '{name} a fini son travail toute seule', emotion: 'fier' },
  { id: 'calin', label: 'câlin', scene: '🤗', text: 'Un câlin avec Maman sur le canapé', emotion: 'calme' },
];

// Q
export const LETTERS = ['A', 'B', 'I', 'R', 'M', 'P', 'S', 'L', 'O', 'U'];
export const SOUNDS = [
  { id: 'a', letter: 'A', say: 'aaa' }, { id: 'm', letter: 'M', say: 'mmmm' }, { id: 's', letter: 'S', say: 'ssss' },
  { id: 'i', letter: 'I', say: 'iii' }, { id: 'r', letter: 'R', say: 'rrrr' },
];
export const CONSONANTS = ['M', 'P', 'S', 'L', 'R'];
export const VOWELS = ['A', 'I', 'O', 'U'];

// Séquences (analyse de tâche) : [emoji, étape]
export const SEQUENCES = {
  'K.1': [['🥄', 'Prendre la cuillère'], ['🪆', 'Nourrir la poupée'], ['🛏️', 'La coucher avec sa couverture']],
  'N.1': [['🎒', 'Ranger son sac au porte-manteau'], ['🪑', "S'asseoir à sa place"]],
  'N.3': [['🖍️', 'Ranger le dessin'], ['📓', 'Sortir le cahier']],
  'U.1': [['👕', 'Prendre le tee-shirt'], ['🙆', 'Passer la tête'], ['💪', 'Passer un bras'], ['💪', "Passer l'autre bras"], ['⬇️', 'Tirer en bas']],
  'U.2': [['👟', 'Prendre la languette'], ['➡️', 'Tirer le scratch'], ['👇', 'Appuyer pour fermer']],
  'U.3': [['🪑', "S'asseoir"], ['👟', 'Ouvrir la chaussure'], ['🦶', 'Mettre le pied'], ['👇', 'Fermer le scratch']],
  'W.1': [['💧', 'Mouiller'], ['🧼', 'Savonner'], ['🙌', 'Frotter'], ['🚿', 'Rincer'], ['🧻', 'Essuyer']],
  'W.2': [['🧽', 'Mouiller le gant'], ['😊', 'Passer sur le visage'], ['🧻', "S'essuyer"]],
  'W.3': [['🧴', 'Mettre le dentifrice'], ['🪥', 'Brosser'], ['🥛', 'Rincer']],
  'X.2': [['🧻', "S'essuyer"], ['👖', 'Remonter le pantalon'], ['🚽', "Tirer la chasse d'eau"], ['🧼', 'Se laver les mains']],
  'Y.1': [['⭕', 'Sauter dans les cerceaux'], ['🐛', 'Ramper sous le tunnel'], ['🏀', 'Lancer la balle dans le panier']],
};
