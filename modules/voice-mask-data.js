// v10.39 (pépite « Masques animés par la voix ») : logique sans écran, testable.
// Le masque ouvre la bouche et grandit quand l'enfant fait du bruit avec sa voix.

export const MASKS = [
  { id: 'lion', emoji: '🦁', name: 'Lion' },
  { id: 'chat', emoji: '🐱', name: 'Chat' },
  { id: 'panda', emoji: '🐼', name: 'Panda' },
  { id: 'grenouille', emoji: '🐸', name: 'Grenouille' },
  { id: 'robot', emoji: '🤖', name: 'Robot' },
  { id: 'licorne', emoji: '🦄', name: 'Licorne' },
];

// Lissage doux : la bouche s'ouvre vite et se ferme lentement (pas de clignotement).
export function smoothMouth(previous, level, { gate = 0.06 } = {}) {
  const target = level > gate ? Math.min(1, (level - gate) / 0.5) : 0;
  const speed = target > previous ? 0.35 : 0.08;
  const next = previous + (target - previous) * speed;
  return next < 0.01 ? 0 : Math.min(1, next);
}

// Taille et ouverture de bouche pour un niveau lissé (0 à 1).
export const maskPose = (mouth) => ({ scale: 1 + mouth * 0.25, mouthHeight: Math.round(6 + mouth * 46), tilt: mouth > 0 ? Math.round((mouth - 0.5) * 6) : 0 });

// Compte les « paroles » : une montée au-dessus du seuil après un silence.
export function countBursts(levels, { on = 0.25, off = 0.08 } = {}) {
  let n = 0; let talking = false;
  for (const l of levels) {
    if (!talking && l >= on) { talking = true; n += 1; } else if (talking && l <= off) talking = false;
  }
  return n;
}
