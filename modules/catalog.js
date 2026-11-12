// Méga-catalogue de mots illustrés (300+) pour le mode connecté.
// Chaque mot : catégorie, lieu, fonction (« sert à… »), couleur, sous-groupe, première lettre, syllabes.
// L'emoji sert d'image de secours ; en ligne, les pictogrammes ARASAAC et les photos Wikipédia le remplacent.

// [mot, emoji, couleur?, fonction?, sous-groupe?, titre Wikipédia?]
const CATS = [
  { id: 'fruits', label: 'un fruit', plural: 'Fruits', place: 'cuisine', fn: 'manger', items: [
    ['pomme', '🍎', 'rouge'], ['banane', '🍌', 'jaune'], ['orange', '🍊', 'orange', '', '', 'Orange (fruit)'], ['fraise', '🍓', 'rouge'], ['raisin', '🍇', 'violet'],
    ['poire', '🍐', 'vert'], ['pastèque', '🍉', 'vert'], ['melon', '🍈', 'jaune'], ['pêche', '🍑', 'orange', '', '', 'Pêche (fruit)'], ['abricot', '🍑', 'orange'],
    ['cerise', '🍒', 'rouge'], ['citron', '🍋', 'jaune'], ['ananas', '🍍', 'jaune'], ['kiwi', '🥝', 'vert', '', '', 'Kiwi (fruit)'], ['mangue', '🥭', 'orange'],
    ['datte', '🌴', 'marron'], ['figue', '🟣', 'violet'], ['grenade', '🔴', 'rouge', '', '', 'Grenade (fruit)'], ['clémentine', '🍊', 'orange'], ['framboise', '🍓', 'rouge'],
  ] },
  { id: 'legumes', label: 'un légume', plural: 'Légumes', place: 'cuisine', fn: 'manger', items: [
    ['carotte', '🥕', 'orange'], ['tomate', '🍅', 'rouge'], ['pomme de terre', '🥔', 'marron'], ['brocoli', '🥦', 'vert'], ['concombre', '🥒', 'vert'],
    ['salade', '🥬', 'vert', '', '', 'Laitue'], ['oignon', '🧅', 'blanc'], ['courgette', '🥒', 'vert'], ['aubergine', '🍆', 'violet'], ['poivron', '🫑', 'vert'],
    ['petits pois', '🫛', 'vert', '', '', 'Petit pois'], ['haricot', '🫘', 'vert'], ['maïs', '🌽', 'jaune'], ['citrouille', '🎃', 'orange'], ['radis', '🔴', 'rouge'],
    ['chou-fleur', '🥦', 'blanc'], ['navet', '🥔', 'blanc'], ['olive', '🫒', 'vert'],
  ] },
  { id: 'repas', label: 'quelque chose à manger', plural: 'Repas et boissons', place: 'cuisine', fn: 'manger', items: [
    ['pain', '🍞', 'marron'], ['lait', '🥛', 'blanc', 'boire', 'boisson'], ['eau', '💧', 'bleu', 'boire', 'boisson'], ['jus', '🧃', 'orange', 'boire', 'boisson', 'Jus de fruits'],
    ['yaourt', '🥣', 'blanc'], ['fromage', '🧀', 'jaune'], ['œuf', '🥚', 'blanc', '', '', 'Œuf (cuisine)'], ['poulet', '🍗', 'marron', '', '', 'Poulet (viande)'],
    ['poisson', '🐟', 'gris', '', '', 'Poisson (aliment)'], ['viande', '🥩', 'rouge'], ['riz', '🍚', 'blanc'], ['pâtes', '🍝', 'jaune', '', '', 'Pâtes alimentaires'],
    ['couscous', '🍲', 'jaune'], ['soupe', '🥣', 'orange'], ['gâteau', '🍰', 'rose'], ['biscuit', '🍪', 'marron'], ['chocolat', '🍫', 'marron'],
    ['miel', '🍯', 'jaune'], ['beurre', '🧈', 'jaune'], ['crêpe', '🥞', 'jaune'], ['glace', '🍦', 'blanc', '', '', 'Crème glacée'], ['confiture', '🍓', 'rouge'],
  ] },
  { id: 'ferme', label: 'un animal de la ferme', plural: 'Animaux de la ferme', place: 'ferme', fn: '', items: [
    ['chat', '🐱', 'gris'], ['chien', '🐶', 'marron'], ['lapin', '🐰', 'blanc'], ['cheval', '🐴', 'marron'], ['vache', '🐮', 'blanc'],
    ['mouton', '🐑', 'blanc'], ['chèvre', '🐐', 'blanc'], ['poule', '🐔', 'blanc'], ['coq', '🐓', 'rouge'], ['poussin', '🐤', 'jaune'],
    ['canard', '🦆', 'jaune'], ['âne', '🫏', 'gris'], ['dinde', '🦃', 'marron'], ['oie', '🪿', 'blanc'], ['cochon', '🐷', 'rose'],
    ['tortue', '🐢', 'vert'], ['oiseau', '🐦', 'bleu'], ['poisson rouge', '🐠', 'orange'], ['hamster', '🐹', 'marron'], ['perroquet', '🦜', 'vert'],
  ] },
  { id: 'sauvages', label: 'un animal sauvage', plural: 'Animaux sauvages', place: 'savane', fn: '', items: [
    ['lion', '🦁', 'jaune'], ['éléphant', '🐘', 'gris'], ['girafe', '🦒', 'jaune'], ['singe', '🐒', 'marron'], ['zèbre', '🦓', 'blanc'],
    ['tigre', '🐯', 'orange'], ['ours', '🐻', 'marron'], ['loup', '🐺', 'gris'], ['renard', '🦊', 'orange'], ['crocodile', '🐊', 'vert'],
    ['hippopotame', '🦛', 'gris'], ['rhinocéros', '🦏', 'gris'], ['kangourou', '🦘', 'marron'], ['panda', '🐼', 'blanc', '', '', 'Panda géant'], ['chameau', '🐫', 'marron'],
    ['dauphin', '🐬', 'bleu', 'nager', 'marin'], ['baleine', '🐋', 'bleu', 'nager', 'marin'], ['requin', '🦈', 'gris', 'nager', 'marin'],
    ['pieuvre', '🐙', 'rose', 'nager', 'marin'], ['crabe', '🦀', 'rouge', 'nager', 'marin'], ['étoile de mer', '⭐', 'orange', 'nager', 'marin'], ['grenouille', '🐸', 'vert', 'nager'],
  ] },
  { id: 'nature', label: 'quelque chose de la nature', plural: 'Insectes et nature', place: 'dehors', fn: '', items: [
    ['papillon', '🦋', 'bleu', 'voler', 'insecte'], ['abeille', '🐝', 'jaune', 'voler', 'insecte'], ['coccinelle', '🐞', 'rouge', 'voler', 'insecte'],
    ['fourmi', '🐜', 'noir', '', 'insecte'], ['escargot', '🐌', 'marron'], ['araignée', '🕷️', 'noir'], ['arbre', '🌳', 'vert'], ['fleur', '🌷', 'rose'],
    ['feuille', '🍃', 'vert', '', '', 'Feuille (botanique)'], ['herbe', '🌱', 'vert'], ['soleil', '☀️', 'jaune', '', 'ciel'], ['lune', '🌙', 'jaune', '', 'ciel'],
    ['étoile', '⭐', 'jaune', '', 'ciel'], ['nuage', '☁️', 'blanc', '', 'ciel'], ['pluie', '🌧️', 'bleu', '', 'ciel'],
  ] },
  { id: 'vetements', label: 'un vêtement', plural: 'Vêtements', place: 'chambre', fn: 'habiller', items: [
    ['tee-shirt', '👕', 'bleu'], ['pantalon', '👖', 'bleu'], ['robe', '👗', 'rose'], ['jupe', '👗', 'rose'], ['pull', '🧥', 'rouge'],
    ['manteau', '🧥', 'marron'], ['veste', '🧥', 'bleu'], ['pyjama', '👚', 'bleu'], ['chaussettes', '🧦', 'rouge'], ['chaussures', '👟', 'blanc', '', 'pieds'],
    ['bottes', '👢', 'marron', '', 'pieds'], ['sandales', '🩴', 'marron', '', 'pieds'], ['chaussons', '🥿', 'rose', '', 'pieds'], ['casquette', '🧢', 'bleu', '', 'tete'],
    ['bonnet', '🧶', 'rouge', '', 'tete'], ['écharpe', '🧣', 'rouge'], ['gants', '🧤', 'vert'], ['lunettes', '👓', 'noir'], ['sac à dos', '🎒', 'rouge'], ['parapluie', '☂️', 'violet'],
  ] },
  { id: 'corps', label: 'une partie du corps', plural: 'Corps', place: '', fn: '', items: [
    ['tête', '🙆', ''], ['cheveux', '💇', 'noir'], ['yeux', '👀', ''], ['nez', '👃', ''], ['bouche', '👄', 'rouge'], ['dents', '🦷', 'blanc'],
    ['langue', '👅', 'rose'], ['oreilles', '👂', ''], ['joues', '😊', 'rose'], ['cou', '🧣', ''], ['épaules', '🤷', ''], ['bras', '💪', ''],
    ['coude', '💪', ''], ['main', '✋', ''], ['doigts', '🖐️', ''], ['ventre', '🫃', ''], ['genou', '🦵', ''], ['pied', '🦶', ''],
  ] },
  { id: 'maison', label: 'un objet de la maison', plural: 'Maison', place: 'maison', fn: '', items: [
    ['lit', '🛏️', 'blanc', 'dormir', 'meuble'], ['oreiller', '🛌', 'blanc', 'dormir'], ['couverture', '🛌', 'bleu', 'dormir'], ['armoire', '🚪', 'marron', 'ranger', 'meuble'],
    ['lampe', '💡', 'jaune', 'éclairer'], ['table', '🍽️', 'marron', '', 'meuble'], ['chaise', '🪑', 'marron', 's’asseoir', 'meuble'], ['fauteuil', '🛋️', 'rouge', 's’asseoir', 'meuble'],
    ['canapé', '🛋️', 'gris', 's’asseoir', 'meuble'], ['tapis', '🟥', 'rouge'], ['télévision', '📺', 'noir', 'regarder'], ['téléphone', '📱', 'noir', 'appeler'],
    ['porte', '🚪', 'marron', 'ouvrir'], ['fenêtre', '🪟', 'bleu', 'ouvrir'], ['clé', '🔑', 'jaune', 'ouvrir'], ['escalier', '🪜', 'marron'],
    ['horloge', '🕰️', 'marron'], ['miroir', '🪞', 'gris', 'regarder'], ['rideau', '🪟', 'rouge'], ['coussin', '🛋️', 'jaune'], ['réfrigérateur', '🧊', 'blanc', '', 'cuisine'], ['four', '🔥', 'gris', 'cuire', 'cuisine'],
  ] },
  { id: 'cuisine', label: 'un objet de la cuisine', plural: 'Cuisine et vaisselle', place: 'cuisine', fn: '', items: [
    ['assiette', '🍽️', 'blanc', 'manger'], ['bol', '🥣', 'blanc', 'manger'], ['verre', '🥛', 'blanc', 'boire'], ['tasse', '☕', 'blanc', 'boire'],
    ['gourde', '🧋', 'bleu', 'boire'], ['bouteille', '🍾', 'vert', 'boire'], ['cuillère', '🥄', 'gris', 'manger'], ['fourchette', '🍴', 'gris', 'manger'],
    ['couteau', '🔪', 'gris', 'couper'], ['casserole', '🍲', 'gris', 'cuire'], ['poêle', '🍳', 'noir', 'cuire', '', 'Poêle (cuisine)'], ['plateau', '🟫', 'marron', 'porter'],
    ['serviette', '🧻', 'blanc', 'essuyer'], ['éponge', '🧽', 'jaune', 'laver'], ['poubelle', '🗑️', 'gris', 'jeter'], ['balai', '🧹', 'marron', 'nettoyer'],
  ] },
  { id: 'hygiene', label: 'un objet de la salle de bain', plural: 'Salle de bain', place: 'salle de bain', fn: 'laver', items: [
    ['savon', '🧼', 'blanc', 'laver'], ['shampoing', '🧴', 'bleu', 'laver'], ['brosse à dents', '🪥', 'bleu', 'brosser'], ['dentifrice', '🧴', 'blanc', 'brosser'],
    ['serviette de bain', '🧺', 'blanc', 'essuyer'], ['gant de toilette', '🧽', 'bleu', 'laver'], ['peigne', '🪮', 'noir', 'coiffer'], ['brosse à cheveux', '🪮', 'rose', 'coiffer'],
    ['mouchoir', '🤧', 'blanc', 'moucher'], ['papier toilette', '🧻', 'blanc', 'essuyer'], ['baignoire', '🛁', 'blanc', 'laver'], ['douche', '🚿', 'gris', 'laver'],
    ['lavabo', '🚰', 'blanc', 'laver'], ['robinet', '🚰', 'gris', 'laver'], ['couches', '🧷', 'blanc'],
  ] },
  { id: 'ecole', label: 'un objet de l’école', plural: 'École', place: 'école', fn: 'écrire', items: [
    ['crayon', '✏️', 'jaune', 'écrire'], ['stylo', '🖊️', 'bleu', 'écrire'], ['feutre', '🖍️', 'rouge', 'dessiner'], ['gomme', '🧽', 'rose', 'effacer'],
    ['taille-crayon', '✏️', 'gris', 'tailler'], ['règle', '📏', 'jaune', 'mesurer'], ['ciseaux', '✂️', 'rouge', 'couper'], ['colle', '🧴', 'blanc', 'coller'],
    ['pinceau', '🖌️', 'marron', 'peindre'], ['peinture', '🎨', 'bleu', 'peindre'], ['cahier', '📓', 'bleu', 'écrire'], ['livre', '📘', 'bleu', 'lire'],
    ['feuille de papier', '📄', 'blanc', 'écrire'], ['cartable', '🎒', 'rouge', 'ranger'], ['trousse', '👝', 'bleu', 'ranger'], ['tableau', '🟩', 'vert', 'écrire'],
    ['craie', '🖍️', 'blanc', 'écrire'], ['bureau', '🪑', 'marron', '', 'meuble'],
  ] },
  { id: 'vehicules', label: 'un véhicule', plural: 'Véhicules', place: 'dehors', fn: 'rouler', items: [
    ['voiture', '🚗', 'rouge', 'rouler'], ['bus', '🚌', 'jaune', 'rouler'], ['camion', '🚚', 'rouge', 'rouler'], ['vélo', '🚲', 'bleu', 'rouler'],
    ['trottinette', '🛴', 'rouge', 'rouler'], ['moto', '🏍️', 'noir', 'rouler'], ['train', '🚆', 'rouge', 'rouler'], ['tramway', '🚊', 'blanc', 'rouler'],
    ['avion', '✈️', 'blanc', 'voler', 'ciel'], ['hélicoptère', '🚁', 'rouge', 'voler', 'ciel'], ['bateau', '🚢', 'blanc', 'naviguer', 'mer'], ['voilier', '⛵', 'blanc', 'naviguer', 'mer'],
    ['ambulance', '🚑', 'blanc', 'rouler', 'secours'], ['camion de pompiers', '🚒', 'rouge', 'rouler', 'secours'], ['tracteur', '🚜', 'vert', 'rouler'], ['fusée', '🚀', 'blanc', 'voler', 'ciel'],
  ] },
  { id: 'jouets', label: 'un jouet', plural: 'Jouets et musique', place: 'chambre', fn: 'jouer', items: [
    ['ballon', '⚽', 'blanc'], ['balle', '🎾', 'jaune'], ['poupée', '🪆', 'rose'], ['peluche', '🧸', 'marron'], ['puzzle', '🧩', 'bleu'],
    ['cubes', '🧱', 'rouge'], ['petites voitures', '🏎️', 'rouge'], ['train électrique', '🚂', 'vert'], ['toboggan', '🛝', 'rouge'], ['balançoire', '🛝', 'bleu'],
    ['cerceau', '⭕', 'rouge'], ['corde à sauter', '🪢', 'rouge'], ['bulles de savon', '🫧', 'bleu'], ['pâte à modeler', '🟢', 'vert'],
    ['tambour', '🥁', 'rouge', 'jouer', 'musique'], ['piano', '🎹', 'noir', 'jouer', 'musique'], ['guitare', '🎸', 'marron', 'jouer', 'musique'], ['flûte', '🪈', 'marron', 'jouer', 'musique'],
  ] },
  { id: 'formes', label: 'une couleur ou une forme', plural: 'Couleurs et formes', place: '', fn: '', items: [
    ['rond', '⚪', 'blanc', '', 'forme', 'Cercle'], ['carré', '🟥', 'rouge', '', 'forme', 'Carré'], ['triangle', '🔺', 'rouge', '', 'forme'], ['étoile', '⭐', 'jaune', '', 'forme', 'Étoile (figure)'],
    ['cœur', '❤️', 'rouge', '', 'forme', 'Cœur (symbole)'], ['losange', '🔷', 'bleu', '', 'forme'], ['rouge', '🔴', 'rouge', '', 'couleur', 'Rouge'], ['bleu', '🔵', 'bleu', '', 'couleur', 'Bleu'],
    ['jaune', '🟡', 'jaune', '', 'couleur', 'Jaune'], ['vert', '🟢', 'vert', '', 'couleur', 'Vert'], ['orange', '🟠', 'orange', '', 'couleur', 'Orange (couleur)'], ['violet', '🟣', 'violet', '', 'couleur', 'Violet'],
    ['noir', '⚫', 'noir', '', 'couleur', 'Noir'], ['blanc', '⚪', 'blanc', '', 'couleur', 'Blanc'], ['marron', '🟤', 'marron', '', 'couleur', 'Marron (couleur)'], ['rose', '🌸', 'rose', '', 'couleur', 'Rose (couleur)'],
  ] },
  { id: 'metiers', label: 'un métier', plural: 'Métiers', place: '', fn: '', items: [
    ['docteur', '🧑‍⚕️', 'blanc', '', '', 'Médecin'], ['pompier', '🧑‍🚒', 'rouge', '', '', 'Sapeur-pompier'], ['policier', '👮', 'bleu'], ['cuisinier', '🧑‍🍳', 'blanc'],
    ['boulanger', '🥖', 'blanc'], ['maîtresse', '👩‍🏫', '', '', '', 'Enseignant'], ['pilote', '🧑‍✈️', 'bleu', '', '', 'Pilote d’aéronef'], ['facteur', '📬', 'jaune'],
    ['jardinier', '🧑‍🌾', 'vert'], ['coiffeur', '💇', ''], ['dentiste', '🦷', 'blanc'], ['peintre', '🧑‍🎨', '', '', '', 'Artiste peintre'],
    ['mécanicien', '🧑‍🔧', 'bleu'], ['astronaute', '🧑‍🚀', 'blanc'],
  ] },
  { id: 'lieux', label: 'un lieu', plural: 'Lieux', place: '', fn: '', items: [
    ['maison', '🏠', ''], ['école', '🏫', ''], ['classe', '🧑‍🏫', ''], ['cour de récréation', '🛝', ''], ['parc', '🌳', ''], ['plage', '🏖️', ''], ['mer', '🌊', 'bleu'],
    ['forêt', '🌲', 'vert'], ['supermarché', '🛒', ''], ['boulangerie', '🥖', ''], ['pharmacie', '💊', 'vert'], ['hôpital', '🏥', ''], ['mosquée', '🕌', ''], ['gare', '🚉', ''],
  ] },
];

export const slug = (text) => String(text).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Découpage en syllabes écrites (approximatif, suffisant pour des mots courts) :
// coupe avant une consonne seule entre deux voyelles (ba-nane), et entre deux consonnes (pas-tèque)
// sauf les groupes qui restent ensemble (fr, bl, ch, gn…). Un « e » final muet reste avec la syllabe d'avant.
const VOWELS = 'aeiouyàâäéèêëîïôöùûüœ';
const KEEP = ['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'tr', 'vr', 'ch', 'ph', 'gn', 'th', 'qu', 'gu'];
const isV = (c) => VOWELS.includes(c);

export function syllables(word) {
  const w = word.toLowerCase();
  if (w.includes(' ') || w.includes('-')) return w.split(/[ -]+/);
  const cuts = [];
  for (let i = 1; i < w.length - 1; i += 1) {
    if (isV(w[i]) || !isV(w[i - 1])) continue;
    // w[i] est une consonne qui suit une voyelle : on regarde le groupe de consonnes
    let j = i;
    while (j < w.length && !isV(w[j])) j += 1;
    if (j >= w.length) break; // consonnes finales : pas de coupe
    const group = w.slice(i, j);
    let cut = i;
    if (group.length === 2 && !KEEP.includes(group)) cut = i + 1;
    if (group.length >= 3) cut = KEEP.includes(group.slice(-2)) ? j - 2 : j - 1;
    cuts.push(cut);
    i = j - 1;
  }
  const parts = [];
  let start = 0;
  for (const cut of cuts) { parts.push(w.slice(start, cut)); start = cut; }
  parts.push(w.slice(start));
  // « e » final muet (po-mme → pomme) : on le rattache à la syllabe d'avant
  if (parts.length > 1 && /^[^aeiouyàâäéèêëîïôöùûüœ]*e[s]?$/.test(parts[parts.length - 1]) && !w.endsWith('é')) {
    const last = parts.pop();
    parts[parts.length - 1] += last;
  }
  return parts;
}

export const CATEGORIES = CATS.map(({ items, ...c }) => c);

// Un même mot dans deux catégories (« orange » fruit et couleur) reçoit un identifiant distinct.
const usedIds = new Set();
const uniqueId = (fr, cat) => {
  const base = slug(fr);
  const id = usedIds.has(base) ? `${cat}-${base}` : base;
  usedIds.add(id);
  return id;
};

export const CATALOG = CATS.flatMap((c) => c.items.map(([fr, emoji, color = '', fn = '', tag = '', wiki = '']) => ({
  id: uniqueId(fr, c.id), fr, emoji, cat: c.id, catLabel: c.label, catPlural: c.plural, place: c.place,
  fn: fn || c.fn, color, tag, wiki: wiki || fr.charAt(0).toUpperCase() + fr.slice(1),
  letter: fr.normalize('NFD').charAt(0).toUpperCase(), syllables: syllables(fr),
})));

export const conceptById = (id) => CATALOG.find((c) => c.id === id) || null;

// Les mots les plus quotidiens d'abord : les petits niveaux tirent dans le début de chaque catégorie.
export function conceptsForLevel(share, filter = () => true) {
  return CATS.flatMap((c) => {
    const n = Math.max(3, Math.ceil(c.items.length * share));
    return CATALOG.filter((x) => x.cat === c.id).slice(0, n);
  }).filter(filter);
}

// Fonctions (« sert à… ») et sous-groupes utilisés par le tri et les consignes.
export const FUNCTIONS = [
  ['manger', 'Sert à manger'], ['boire', 'Sert à boire'], ['couper', 'Sert à couper'], ['écrire', 'Sert à écrire'], ['dessiner', 'Sert à dessiner'],
  ['laver', 'Sert à laver'], ['brosser', 'Sert à brosser les dents'], ['coiffer', 'Sert à se coiffer'], ['essuyer', 'Sert à essuyer'], ['dormir', 'Sert à dormir'],
  ['s’asseoir', 'Sert à s’asseoir'], ['ouvrir', 'Sert à ouvrir'], ['rouler', 'Sert à rouler'], ['voler', 'Vole dans le ciel'], ['naviguer', 'Va sur l’eau'],
  ['cuire', 'Sert à cuire'], ['peindre', 'Sert à peindre'], ['ranger', 'Sert à ranger'], ['jouer', 'Sert à jouer'], ['nager', 'Nage dans l’eau'],
].map(([id, label]) => ({ id, label, items: CATALOG.filter((c) => c.fn === id) })).filter((f) => f.items.length >= 2);

export const GROUPS = [
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.plural, items: CATALOG.filter((x) => x.cat === c.id) })),
  ...[['boisson', 'Boissons'], ['marin', 'Animaux de la mer'], ['insecte', 'Insectes'], ['ciel', 'Dans le ciel'], ['meuble', 'Meubles'],
    ['musique', 'Instruments de musique'], ['pieds', 'Pour les pieds'], ['secours', 'Véhicules de secours']]
    .map(([tag, label]) => ({ id: `tag-${tag}`, label, items: CATALOG.filter((x) => x.tag === tag) })),
].filter((g) => g.items.length >= 2);

export const COLORS = ['rouge', 'jaune', 'vert', 'bleu', 'orange', 'blanc', 'marron', 'rose', 'violet', 'noir', 'gris'];
