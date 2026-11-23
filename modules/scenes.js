// v10.34 (pépites « Scènes visuelles » TouchChat et « Scènes d'exploration » Sago Mini).
// 1) Scène sur vraie photo : le parent prend une photo (la cuisine, la chambre…), choisit un quadrillage
//    de 4, 9, 12 ou 15 cases et met un mot sur les cases utiles. L'enfant touche l'objet dans la photo.
//    La photo reste dans le téléphone (réglage « sceneImage:<id> »), jamais dans la sauvegarde ni la synchro.
// 2) Grande scène à explorer : une grande image dessinée (cuisine, chambre, salle de bain, parc) où chaque
//    objet parle et entre dans la phrase. Rien à préparer, rien n'est envoyé.

export const GRID_SIZES = { 4: [2, 2], 9: [3, 3], 12: [3, 4], 15: [3, 5] }; // nombre de cases : [colonnes, lignes]
export const SCENE_SETTING_KEY = 'visualScenes';
export const sceneImageKey = (id) => `sceneImage:${id}`;
export const newSceneId = () => `scene-${Date.now().toString(36)}`;

export function cleanScenes(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((s) => s && typeof s === 'object' && GRID_SIZES[s.size])
    .map((s) => {
      const size = Number(s.size);
      const cells = {};
      for (const [k, v] of Object.entries(s.cells && typeof s.cells === 'object' ? s.cells : {})) {
        const i = Number(k);
        if (Number.isInteger(i) && i >= 0 && i < size && String(v || '').trim()) cells[i] = String(v).trim().slice(0, 40);
      }
      return { id: String(s.id || '').slice(0, 40), title: String(s.title || '').trim().slice(0, 40), size, cells };
    })
    .filter((s) => s.id && s.title)
    .slice(0, 12);
}

// Les scènes dessinées : x et y en pourcentage de la scène (centre de l'objet). Les mots sont ceux des cartes
// (ou du catalogue illustré), retrouvés comme dans « Écrire une phrase en images ».
export const EXPLORE_SCENES = [
  { id: 'cuisine', emoji: '🍳', title: 'La cuisine', bg: 'kitchen', items: [
    { word: 'Pain', x: 16, y: 52 }, { word: 'Pomme', x: 34, y: 50 }, { word: 'Banane', x: 50, y: 52 }, { word: 'Lait', x: 68, y: 48 },
    { word: 'Eau', x: 84, y: 50 }, { word: 'Gâteau', x: 24, y: 80 }, { word: 'Yaourt', x: 48, y: 80 }, { word: 'Œuf', x: 72, y: 80 },
    { word: 'Manger', x: 18, y: 18 }, { word: 'Boire', x: 82, y: 18 }, { word: 'Chaud', x: 50, y: 18 } ] },
  { id: 'chambre', emoji: '🛏️', title: 'La chambre', bg: 'bedroom', items: [
    { word: 'lit', x: 24, y: 70 }, { word: 'Dormir', x: 24, y: 40 }, { word: 'Poupée', x: 52, y: 72 }, { word: 'Ballon', x: 72, y: 82 },
    { word: 'Tablette', x: 82, y: 56 }, { word: 'livre', x: 54, y: 44 }, { word: 'Musique', x: 80, y: 22 }, { word: 'Câlin', x: 50, y: 18 },
    { word: 'Fatigué', x: 18, y: 16 } ] },
  { id: 'bain', emoji: '🛁', title: 'La salle de bain', bg: 'bathroom', items: [
    { word: 'Bain', x: 26, y: 72 }, { word: 'douche', x: 22, y: 30 }, { word: 'savon', x: 50, y: 56 }, { word: 'dents', x: 66, y: 40 },
    { word: 'serviette', x: 84, y: 54 }, { word: 'Laver', x: 50, y: 22 }, { word: 'Toilettes', x: 80, y: 80 }, { word: 'Froid', x: 52, y: 84 },
    { word: 'Chaud', x: 36, y: 46 } ] },
  { id: 'parc', emoji: '🌳', title: 'Le parc', bg: 'park', items: [
    { word: 'Balançoire', x: 20, y: 56 }, { word: 'toboggan', x: 46, y: 60 }, { word: 'Ballon', x: 70, y: 80 }, { word: 'Courir', x: 84, y: 54 },
    { word: 'Sauter', x: 30, y: 84 }, { word: 'chien', x: 58, y: 84 }, { word: 'oiseau', x: 70, y: 22 }, { word: 'Jouer', x: 40, y: 26 },
    { word: 'Boire', x: 88, y: 30 }, { word: 'Dehors', x: 14, y: 18 } ] },
];

// Position d'une case dans la photo (en %), pour dessiner le quadrillage par-dessus.
export function cellBox(size, index) {
  const [cols, rows] = GRID_SIZES[size];
  const col = index % cols;
  const row = Math.floor(index / cols);
  return { left: (100 * col) / cols, top: (100 * row) / rows, width: 100 / cols, height: 100 / rows };
}
