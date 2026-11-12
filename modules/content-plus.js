// Banques étendues pour la v4 (servent aussi hors ligne : emoji en image de secours).
// Comptines : extraits traditionnels du domaine public.
import { CATALOG } from './catalog.js';

// C.1 : 40 consignes de plus (50 au total)
export const MORE_COMMANDS = [
  'Lève les bras', 'Touche tes pieds', 'Tape sur la table', 'Ferme les yeux', 'Ouvre la bouche', 'Montre tes mains', 'Touche ton ventre',
  'Saute', 'Tourne-toi', 'Assieds-toi par terre', 'Donne-moi la balle', 'Donne-moi le livre', 'Prends le verre', 'Ferme la porte', 'Allume la lumière',
  'Éteins la lumière', 'Mets ton manteau', 'Enlève ta chaussure', 'Range le crayon', 'Jette dans la poubelle', 'Va chercher ton sac', 'Donne la main',
  'Fais un bisou', 'Fais un câlin', 'Dis au revoir', 'Montre tes yeux', 'Montre ta bouche', 'Touche tes oreilles', 'Croise les bras', 'Lève un pied',
  'Tape des pieds', 'Frotte tes mains', 'Souffle', 'Chut, doigt sur la bouche', 'Pointe la fenêtre', 'Mets la main sur la tête', 'Couche-toi', 'Arrête-toi',
  'Marche doucement', 'Viens t’asseoir à côté de moi',
];

// D.1 / D.2 : gestes (20 globaux + 10 fins = 30)
export const MORE_GESTURES = [
  ['nez', '👃', 'Toucher son nez'], ['oreilles', '👂', 'Toucher ses oreilles'], ['epaules', '🤷', 'Toucher ses épaules'], ['genoux', '🦵', 'Toucher ses genoux'],
  ['sauter', '🦘', 'Sauter sur place'], ['tourner', '🔄', 'Tourner sur soi'], ['assis', '🪑', 'S’asseoir'], ['debout', '🧍', 'Se lever'],
  ['bisou', '😘', 'Envoyer un bisou'], ['chut', '🤫', 'Faire chut'], ['bras-croises', '🙅', 'Croiser les bras'], ['tapis-cuisses', '🦵', 'Taper sur ses cuisses'],
  ['yeux', '🙈', 'Cacher ses yeux'], ['coucou-deux', '🙌', 'Faire coucou à deux mains'],
].map(([id, emoji, fr]) => ({ id, emoji, fr }));
export const MORE_FINE_GESTURES = [
  ['v', '✌️', 'Faire le V avec deux doigts'], ['ok', '👌', 'Faire « OK »'], ['agiter', '👋', 'Agiter les doigts'], ['pianoter', '🎹', 'Pianoter sur la table'],
  ['applaudir', '👏', 'Applaudir doucement'],
].map(([id, emoji, fr]) => ({ id, emoji, fr }));

// G.2 : 35 verbes de plus (45 au total)
export const MORE_VERBS = [
  ['lit', '📖'], ['écrit', '✍️'], ['chante', '🎤'], ['danse', '💃'], ['marche', '🚶'], ['tombe', '🤕'], ['rit', '😂'], ['crie', '😱'],
  ['pousse', '🛒'], ['tire', '🪢'], ['lance', '🤾'], ['attrape', '🧤'], ['coupe', '✂️'], ['colle', '🧴'], ['peint', '🎨'], ['cuisine', '🧑‍🍳'],
  ['balaie', '🧹'], ['s’habille', '👕'], ['se brosse les dents', '🪥'], ['se coiffe', '🪮'], ['fait du vélo', '🚴'], ['grimpe', '🧗'], ['glisse', '🛝'],
  ['se balance', '🎠'], ['ouvre', '🚪'], ['ferme', '🔒'], ['porte', '🧺'], ['donne', '🫴'], ['embrasse', '😘'], ['applaudit', '👏'],
  ['téléphone', '📱'], ['regarde', '👀'], ['écoute', '👂'], ['souffle', '🌬️'], ['arrose', '🪴'],
].map(([fr, emoji]) => ({ id: fr, fr, emoji }));

// H.2 : 20 comptines de plus (25 au total). [début, mot final, image du mot, image de la comptine, mot de la comptine]
export const MORE_RHYMES = [
  ['Une souris verte qui courait dans l’…', 'herbe', '🌿', '🐭', 'souris'],
  ['Il était un petit…', 'navire', '🚢', '🌊', 'mer'],
  ['Au clair de la lune, mon ami…', 'Pierrot', '🤡', '🌙', 'lune'],
  ['Pomme de reinette et pomme d’…', 'api', '🍎', '🍏', 'pommes'],
  ['Meunier, tu dors, ton moulin va trop…', 'vite', '💨', '🌾', 'moulin'],
  ['Petit escargot porte sur son dos sa…', 'maisonnette', '🏠', '🐌', 'escargot'],
  ['Dans la forêt lointaine, on entend le…', 'coucou', '🐦', '🌲', 'forêt'],
  ['Une poule sur un mur qui picore du pain…', 'dur', '🍞', '🐔', 'poule'],
  ['Sur le pont d’Avignon, on y danse, on y…', 'danse', '💃', '🌉', 'pont'],
  ['Brille, brille, petite…', 'étoile', '⭐', '🌙', 'nuit'],
  ['Ainsi font, font, font les petites…', 'marionnettes', '🎎', '🖐️', 'mains'],
  ['Tourne, tourne, petit…', 'moulin', '🌀', '👐', 'mains'],
  ['Nage, nage, petit…', 'poisson', '🐟', '🌊', 'eau'],
  ['Vole, vole, petit…', 'oiseau', '🐦', '☁️', 'ciel'],
  ['Tête, épaules, genoux et…', 'pieds', '🦶', '🙆', 'tête'],
  ['Il pleut, il mouille, c’est la fête à la…', 'grenouille', '🐸', '🌧️', 'pluie'],
  ['Savez-vous planter les…', 'choux', '🥬', '🧑‍🌾', 'jardin'],
  ['Dans sa maison un grand…', 'cerf', '🦌', '🏠', 'maison'],
  ['Un éléphant qui se balançait sur une toile d’…', 'araignée', '🕷️', '🐘', 'éléphant'],
  ['Fais dodo, Colas mon p’tit…', 'frère', '👶', '😴', 'dodo'],
].map(([start, end, emoji, scene, sceneLabel], i) => ({ id: `r${i + 6}`, start, end, emoji, scene, sceneLabel }));

// H.3 : 70 associations de plus (80 au total). [début, mot final, image du mot, image de départ, mot de départ]
export const MORE_ASSOCIATIONS = [
  ['On boit dans un…', 'verre', '🥛', '💧', 'eau'], ['On mange la soupe avec une…', 'cuillère', '🥄', '🥣', 'soupe'],
  ['On coupe la viande avec un…', 'couteau', '🔪', '🥩', 'viande'], ['On se brosse les dents avec une…', 'brosse à dents', '🪥', '🦷', 'dents'],
  ['On se coiffe avec un…', 'peigne', '🪮', '💇', 'cheveux'], ['Quand il pleut, on prend un…', 'parapluie', '☂️', '🌧️', 'pluie'],
  ['Quand il fait froid, on met un…', 'manteau', '🧥', '❄️', 'froid'], ['On met les chaussettes aux…', 'pieds', '🦶', '🧦', 'chaussettes'],
  ['On met les gants sur les…', 'mains', '✋', '🧤', 'gants'], ['On lit un…', 'livre', '📘', '👀', 'yeux'],
  ['On écoute avec les…', 'oreilles', '👂', '🎵', 'musique'], ['On regarde avec les…', 'yeux', '👀', '📺', 'télévision'],
  ['On sent les fleurs avec le…', 'nez', '👃', '🌷', 'fleur'], ['La vache donne du…', 'lait', '🥛', '🐮', 'vache'],
  ['La poule pond des…', 'œufs', '🥚', '🐔', 'poule'], ['L’abeille fait du…', 'miel', '🍯', '🐝', 'abeille'],
  ['Le poisson vit dans l’…', 'eau', '💧', '🐟', 'poisson'], ['L’oiseau vole dans le…', 'ciel', '☁️', '🐦', 'oiseau'],
  ['Le lapin mange une…', 'carotte', '🥕', '🐰', 'lapin'], ['Le singe mange une…', 'banane', '🍌', '🐒', 'singe'],
  ['Le chien mange un…', 'os', '🦴', '🐶', 'chien'], ['La souris mange du…', 'fromage', '🧀', '🐭', 'souris'],
  ['La nuit, on…', 'dort', '😴', '🌙', 'nuit'], ['Le matin, le soleil se…', 'lève', '☀️', '🌅', 'matin'],
  ['On ouvre la porte avec une…', 'clé', '🔑', '🚪', 'porte'], ['Quand il fait noir, on allume la…', 'lumière', '💡', '🌑', 'noir'],
  ['On parle à Mamie avec le…', 'téléphone', '📱', '👵', 'Mamie'], ['On prend son bain dans la…', 'baignoire', '🛁', '🧼', 'bain'],
  ['On s’essuie avec une…', 'serviette', '🧻', '🚿', 'douche'], ['On jette les déchets dans la…', 'poubelle', '🗑️', '🧃', 'déchets'],
  ['On balaie avec un…', 'balai', '🧹', '🏠', 'maison'], ['On colle avec de la…', 'colle', '🧴', '📄', 'papier'],
  ['On peint avec un…', 'pinceau', '🖌️', '🎨', 'peinture'], ['On efface avec une…', 'gomme', '🧽', '✏️', 'crayon'],
  ['On trace un trait droit avec une…', 'règle', '📏', '📄', 'feuille'], ['On range les crayons dans la…', 'trousse', '👝', '🖍️', 'crayons'],
  ['On met le cahier dans le…', 'cartable', '🎒', '📓', 'cahier'], ['Le bébé boit son…', 'biberon', '🍼', '👶', 'bébé'],
  ['À vélo, on roule sur la…', 'route', '🛣️', '🚲', 'vélo'], ['Le bateau navigue sur la…', 'mer', '🌊', '⛵', 'bateau'],
  ['Le train roule sur les…', 'rails', '🛤️', '🚆', 'train'], ['Le pompier éteint le…', 'feu', '🔥', '🚒', 'pompier'],
  ['Le docteur soigne les…', 'malades', '🤒', '🩺', 'docteur'], ['Le boulanger fait le…', 'pain', '🍞', '🧑‍🍳', 'boulanger'],
  ['La maîtresse travaille à l’…', 'école', '🏫', '👩‍🏫', 'maîtresse'], ['On achète les médicaments à la…', 'pharmacie', '💊', '🤧', 'rhume'],
  ['On fait les courses au…', 'supermarché', '🛒', '🧺', 'courses'], ['On joue au toboggan au…', 'parc', '🌳', '🛝', 'toboggan'],
  ['On fait des châteaux de sable à la…', 'plage', '🏖️', '🪣', 'seau'], ['Le soir, on met son…', 'pyjama', '👚', '🌙', 'soir'],
  ['On souffle les bougies du…', 'gâteau', '🍰', '🕯️', 'bougies'], ['On fait des bulles avec du…', 'savon', '🧼', '🫧', 'bulles'],
  ['La glace est très…', 'froide', '🧊', '🍦', 'glace'], ['Le soleil est très…', 'chaud', '🔥', '☀️', 'soleil'],
  ['La neige est…', 'blanche', '⚪', '❄️', 'neige'], ['Le citron est…', 'jaune', '🟡', '🍋', 'citron'],
  ['La fraise est…', 'rouge', '🔴', '🍓', 'fraise'], ['L’herbe est…', 'verte', '🟢', '🌱', 'herbe'],
  ['Le ciel est…', 'bleu', '🔵', '☁️', 'ciel'], ['L’éléphant est très…', 'grand', '⬆️', '🐘', 'éléphant'],
  ['La fourmi est toute…', 'petite', '🤏', '🐜', 'fourmi'], ['On se mouche avec un…', 'mouchoir', '🤧', '👃', 'nez'],
  ['On garde le lait au frais dans le…', 'réfrigérateur', '🧊', '🥛', 'lait'], ['On fait cuire le gâteau dans le…', 'four', '🔥', '🍰', 'gâteau'],
  ['On s’assoit sur une…', 'chaise', '🪑', '🧍', 'assis'], ['On mange à…', 'table', '🍽️', '🥄', 'repas'],
  ['Le robinet donne de l’…', 'eau', '💧', '🚰', 'robinet'], ['On met les vêtements dans l’…', 'armoire', '🚪', '👕', 'vêtements'],
  ['Quand on a soif, on…', 'boit', '🥤', '🥵', 'soif'], ['Quand on a faim, on…', 'mange', '🍽️', '😋', 'faim'],
].map(([start, end, emoji, scene, sceneLabel], i) => ({ id: `a${i + 11}`, start, end, emoji, scene, sceneLabel }));

// B.4 / C.4 : 68 paires logiques de plus (80 au total) — quotidien, animaux, métiers.
export const MORE_PAIRS = [
  ['assiette', '🍽️', 'fourchette', '🍴'], ['pain', '🍞', 'beurre', '🧈'], ['lit', '🛏️', 'pyjama', '👚'], ['savon', '🧼', 'serviette', '🧻'],
  ['peigne', '🪮', 'cheveux', '💇'], ['lunettes', '👓', 'yeux', '👀'], ['chapeau', '👒', 'tête', '🙆'], ['gants', '🧤', 'mains', '✋'],
  ['bague', '💍', 'doigt', '☝️'], ['parapluie', '☂️', 'pluie', '🌧️'], ['soleil', '☀️', 'lunettes de soleil', '🕶️'], ['neige', '❄️', 'bonhomme de neige', '⛄'],
  ['ballon', '⚽', 'but', '🥅'], ['raquette', '🏸', 'balle', '🎾'], ['seau', '🪣', 'sable', '🏖️'], ['cartable', '🎒', 'école', '🏫'],
  ['enveloppe', '✉️', 'boîte aux lettres', '📮'], ['bougie', '🕯️', 'gâteau', '🎂'], ['cadeau', '🎁', 'anniversaire', '🎉'], ['théière', '🫖', 'tasse', '🍵'],
  ['brosse', '🪮', 'miroir', '🪞'], ['voiture', '🚗', 'route', '🛣️'], ['train', '🚆', 'rails', '🛤️'], ['avion', '✈️', 'nuage', '☁️'],
  ['vélo', '🚲', 'casque', '⛑️'], ['téléphone', '📱', 'oreille', '👂'], ['télécommande', '🎛️', 'télévision', '📺'], ['marteau', '🔨', 'clou', '📌'],
  ['cadenas', '🔒', 'clé', '🗝️'], ['stylo', '🖊️', 'feuille', '📄'], ['pinceau', '🖌️', 'peinture', '🎨'], ['fil', '🧵', 'aiguille', '🪡'],
  ['lapin', '🐰', 'carotte', '🥕'], ['singe', '🐒', 'banane', '🍌'], ['chien', '🐶', 'os', '🦴'], ['chat', '🐱', 'souris', '🐭'],
  ['souris', '🐭', 'fromage', '🧀'], ['abeille', '🐝', 'fleur', '🌷'], ['vache', '🐮', 'lait', '🥛'], ['panda', '🐼', 'bambou', '🎋'],
  ['oiseau', '🐦', 'nid', '🪺'], ['écureuil', '🐿️', 'noisette', '🌰'], ['ours', '🐻', 'miel', '🍯'], ['poule', '🐔', 'œuf', '🥚'],
  ['araignée', '🕷️', 'toile', '🕸️'], ['chameau', '🐫', 'désert', '🏜️'], ['pingouin', '🐧', 'glace', '🧊'], ['dauphin', '🐬', 'mer', '🌊'],
  ['escargot', '🐌', 'salade', '🥬'], ['grenouille', '🐸', 'nénuphar', '🪷'], ['pompier', '🧑‍🚒', 'camion de pompiers', '🚒'], ['docteur', '🧑‍⚕️', 'stéthoscope', '🩺'],
  ['cuisinier', '🧑‍🍳', 'casserole', '🍲'], ['boulanger', '🥖', 'pain', '🍞'], ['peintre', '🧑‍🎨', 'tableau', '🖼️'], ['jardinier', '🧑‍🌾', 'fleurs', '💐'],
  ['pilote', '🧑‍✈️', 'avion', '🛩️'], ['policier', '👮', 'voiture de police', '🚓'], ['facteur', '📬', 'lettre', '✉️'], ['maîtresse', '👩‍🏫', 'tableau noir', '🟩'],
  ['astronaute', '🧑‍🚀', 'fusée', '🚀'], ['mécanicien', '🧑‍🔧', 'clé à molette', '🔧'], ['musicien', '🧑‍🎤', 'guitare', '🎸'], ['coiffeur', '💈', 'ciseaux', '✂️'],
  ['dentiste', '🦷', 'brosse à dents', '🪥'], ['pêcheur', '🎣', 'poisson', '🐟'], ['agriculteur', '👨‍🌾', 'tracteur', '🚜'], ['chauffeur', '🧑‍✈️', 'bus', '🚌'],
].map(([af, ae, bf, be], i) => ({ id: `p${i + 13}`, a: { emoji: ae, fr: af }, b: { emoji: be, fr: bf } }));

// E.2 : phrases fonctionnelles de 2 à 4 mots (55 de plus, 60 au total)
const FOODS = CATALOG.filter((c) => ['fruits', 'repas'].includes(c.cat)).slice(0, 20);
const TOYS = CATALOG.filter((c) => c.cat === 'jouets').slice(0, 10);
export const MORE_PHRASES = [
  ...FOODS.map((c) => ({ id: `veux-${c.id}`, words: [['🙋', 'Je veux'], [c.emoji, c.fr]] })),
  ...FOODS.slice(0, 12).map((c) => ({ id: `encore-${c.id}`, words: [['➕', 'Encore'], [c.emoji, c.fr]] })),
  ...TOYS.map((c) => ({ id: `jouer-${c.id}`, words: [['🧸', 'Je joue'], ['➡️', 'avec'], [c.emoji, c.fr]] })),
  ...[['👨', 'Papa'], ['👩', 'Maman'], ['👧', 'Ghita']].flatMap(([emoji, who]) => [
    { id: `bonjour-${who}`, words: [['👋', 'Bonjour'], [emoji, who]] },
    { id: `aide-${who}`, words: [['🤝', 'Aide-moi'], [emoji, who]] },
    { id: `viens-${who}`, words: [['🧑‍🤝‍🧑', 'Viens jouer'], [emoji, who]] },
  ]),
  { id: 'toilettes', words: [['🙋', 'Je veux'], ['➡️', 'aller aux'], ['🚽', 'toilettes']] },
  { id: 'mal', words: [['🤕', 'J’ai mal'], ['➡️', 'au'], ['🦵', 'genou']] },
  { id: 'dormir', words: [['🙋', 'Je veux'], ['😴', 'dormir']] },
  { id: 'dehors', words: [['🙋', 'Je veux'], ['➡️', 'aller'], ['🌳', 'dehors']] },
].slice(0, 55);
