// v10.38 : données et calculs du parcours souffle → mots (sans écran : testés par tools/test-ortho-path.mjs).
export const PATH_SETTING_KEY = 'orthoPath';
export const WINS_TO_OPEN = 3;

// [id, titre, consigne, cibles : [texte affiché, texte dit par le modèle, emoji]]
export const PATH_STEPS = [
  { id: 'souffle', emoji: '🌬️', title: 'Souffle', hint: 'Souffle fort sur le téléphone pour gonfler le ballon.', mode: 'breath',
    targets: [['Souffle !', 'Souffle', '🌬️'], ['Bougie', 'Souffle la bougie', '🕯️'], ['Plume', 'Souffle la plume', '🪶']] },
  { id: 'voix', emoji: '🎵', title: 'Voix longue', hint: 'Fais un long son « aaaa » : le ballon grandit tant que la voix dure.', mode: 'voice',
    targets: [['aaaa', 'aaaaa', '😮'], ['mmmm', 'mmmmm', '😌'], ['oooo', 'ooooo', '😯']] },
  { id: 'voyelles', emoji: '🅰️', title: 'Voyelles', hint: 'Écoute, puis dis la voyelle.', mode: 'voice',
    targets: [['a', 'a', '😮'], ['i', 'i', '😁'], ['ou', 'ou', '😗'], ['o', 'o', '😯'], ['é', 'é', '🙂']] },
  { id: 'syllabes', emoji: '🔤', title: 'Syllabes', hint: 'Écoute, puis répète la syllabe.', mode: 'voice',
    targets: [['ba', 'ba', '👄'], ['ma', 'ma', '👄'], ['pa', 'pa', '👄'], ['ta', 'ta', '👅'], ['mo', 'mo', '👄'], ['pi', 'pi', '👄']] },
  { id: 'mots', emoji: '🗣️', title: 'Petits mots', hint: 'Écoute, puis dis le mot.', mode: 'voice',
    targets: [['maman', 'maman', '👩'], ['papa', 'papa', '👨'], ['bébé', 'bébé', '👶'], ['eau', 'de l’eau', '💧'], ['pain', 'du pain', '🍞'], ['ballon', 'ballon', '⚽']] },
];

export function cleanPath(value) {
  const v = value && typeof value === 'object' ? value : {};
  const wins = {};
  for (const s of PATH_STEPS) wins[s.id] = Math.max(0, Math.min(99, Number(v.wins && v.wins[s.id]) || 0));
  return { wins };
}
// Une étape est ouverte si l'étape d'avant a assez de réussites (la première est toujours ouverte).
export const isOpen = (path, index) => index === 0 || (path.wins[PATH_STEPS[index - 1].id] || 0) >= WINS_TO_OPEN;

// Le ballon : chaque instant de voix au-dessus du seuil l'aide à grandir ; il redescend doucement sinon.
export function nextBalloon(size, level, threshold = 0.1) {
  const grown = level > threshold ? size + 0.002 + level * 0.009 : size - 0.003;
  return Math.max(0, Math.min(1, grown));
}
