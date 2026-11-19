// v10.6 (P3.f) : plan de vocabulaire de base bilingue FR / Darija, places fixes, dévoilement par paliers.
// Ce module documente et expose la grille de vocabulaire central (Core Vocabulary) bilingue Français / Darija
// avec planification motrice stable (chaque mot garde toujours la même ligne gridRow et la même colonne gridCol,
// inspiré de la clé de Fitzgerald : Jaune = personnes/pronoms, Vert = verbes, Orange = noms, Bleu = adjectifs/descripteurs, Rose = mots sociaux).
//
// Règle clinique :
// 1. Aucun déplacement automatique : ce module ne déplace JAMAIS les cartes existantes sans action explicite du parent ou de l'orthophoniste.
// 2. Dévoilement progressif (Progressive Vocabulary Masking) : pour simplifier l'écran d'un enfant débutant,
//    on masque les cartes non encore travaillées avec `hidden: true` (qui garde leur case vide à sa place fixe),
//    puis on les révèle une par une sans jamais décaler les cartes déjà apprises.

export const CORE_MOTOR_PLAN_V1 = [
  // Bandeau permanent des mots essentiels (catégorie 'base', ordre invariant gauche -> droite)
  { id: 'c-base-je-veux', cat: 'base', order: 1, gridRow: 1, gridCol: 1, gram: 'person', fr: 'Je veux', dr: 'Bghit', ar: 'بغيت', stage: 1 },
  { id: 'c-base-oui', cat: 'base', order: 2, gridRow: 1, gridCol: 2, gram: 'social', fr: 'Oui', dr: 'Ah', ar: 'اه', stage: 1 },
  { id: 'c-base-non', cat: 'base', order: 3, gridRow: 1, gridCol: 3, gram: 'social', fr: 'Non', dr: 'La', ar: 'لا', stage: 1 },
  { id: 'c-base-encore', cat: 'base', order: 4, gridRow: 1, gridCol: 4, gram: 'adj', fr: 'Encore', dr: 'Zid', ar: 'زيد', stage: 1 },
  { id: 'c-base-fini', cat: 'base', order: 5, gridRow: 2, gridCol: 1, gram: 'social', fr: 'Fini', dr: 'Safi', ar: 'صافي', stage: 1 },
  { id: 'c-base-aide-moi', cat: 'base', order: 6, gridRow: 2, gridCol: 2, gram: 'social', fr: 'Aide-moi', dr: '3awnni', ar: 'عاوني', stage: 1 },
  { id: 'c-base-attends', cat: 'base', order: 7, gridRow: 2, gridCol: 3, gram: 'social', fr: 'Attends', dr: 'Tsenna', ar: 'تسنى', stage: 2 },
  { id: 'c-base-j-ai-mal', cat: 'base', order: 8, gridRow: 2, gridCol: 4, gram: 'social', fr: "J'ai mal", dr: 'Kayderni', ar: 'كيضرني', stage: 1 },
  { id: 'c-base-bonjour', cat: 'base', order: 9, gridRow: 3, gridCol: 1, gram: 'social', fr: 'Bonjour', dr: 'Salam', ar: 'سلام', stage: 2 },
  { id: 'c-base-au-revoir', cat: 'base', order: 10, gridRow: 3, gridCol: 2, gram: 'social', fr: 'Au revoir', dr: 'Bslama', ar: 'بسلامة', stage: 2 },
  { id: 'c-base-viens-jouer', cat: 'base', order: 11, gridRow: 3, gridCol: 3, gram: 'social', fr: 'Viens jouer', dr: 'Aji nl3bou', ar: 'أجي نلعبو', stage: 3 },

  // Verbes centraux à haute fréquence (catégorie 'actions', colonnes 1..4 stables)
  { id: 'c-actions-manger', cat: 'actions', order: 1, gridRow: 1, gridCol: 1, gram: 'verb', fr: 'Manger', dr: 'Nakoul', ar: 'ناكل', stage: 1 },
  { id: 'c-actions-boire', cat: 'actions', order: 2, gridRow: 1, gridCol: 2, gram: 'verb', fr: 'Boire', dr: 'Nchreb', ar: 'نشرب', stage: 1 },
  { id: 'c-actions-jouer', cat: 'actions', order: 3, gridRow: 1, gridCol: 3, gram: 'verb', fr: 'Jouer', dr: 'Nl3eb', ar: 'نلعب', stage: 1 },
  { id: 'c-actions-donner', cat: 'actions', order: 4, gridRow: 1, gridCol: 4, gram: 'verb', fr: 'Donner', dr: '3tini', ar: 'عطيني', stage: 1 },
  { id: 'c-actions-ouvrir', cat: 'actions', order: 5, gridRow: 2, gridCol: 1, gram: 'verb', fr: 'Ouvrir', dr: 'Nhel', ar: 'نحل', stage: 2 },
  { id: 'c-actions-laver', cat: 'actions', order: 6, gridRow: 2, gridCol: 2, gram: 'verb', fr: 'Laver', dr: 'Nghsel', ar: 'نغسل', stage: 2 },
  { id: 'c-actions-courir', cat: 'actions', order: 7, gridRow: 2, gridCol: 3, gram: 'verb', fr: 'Courir', dr: 'Njri', ar: 'نجري', stage: 3 },
  { id: 'c-actions-sauter', cat: 'actions', order: 8, gridRow: 2, gridCol: 4, gram: 'verb', fr: 'Sauter', dr: 'N9fez', ar: 'نقفز', stage: 3 },
  { id: 'c-actions-couper', cat: 'actions', order: 9, gridRow: 3, gridCol: 1, gram: 'verb', fr: 'Couper', dr: 'N9te3', ar: 'نقطع', stage: 3 },
  { id: 'c-actions-dessiner', cat: 'actions', order: 10, gridRow: 3, gridCol: 2, gram: 'verb', fr: 'Dessiner', dr: 'Nrsem', ar: 'نرسم', stage: 3 },
];

export const MOTOR_STAGES = [
  { stage: 1, label: 'Palier 1 — Premiers besoins (11 mots)', description: 'Idéal pour débuter : Je veux, Oui, Non, Encore, Fini, Aide-moi, J’ai mal, Manger, Boire, Jouer, Donner. Les 10 autres mots du plan sont masqués à leur place.' },
  { stage: 2, label: 'Palier 2 — Échanges et routines (16 mots)', description: 'Dévoile Attends, Bonjour, Au revoir, Ouvrir, Laver aux emplacements déjà réservés, sans bouger les cartes du Palier 1.' },
  { stage: 3, label: 'Palier 3 — Les 21 mots visibles', description: 'Les 21 mots du plan redeviennent visibles. Les autres cartes ne changent pas.' },
];

// Applique un palier de dévoilement progressif (1, 2 ou 3) uniquement sur demande explicite de l'adulte,
// sans jamais supprimer de carte ni modifier les photos/voix enregistrées.
export function applyProgressiveStage(cards, targetStage = 3) {
  const planById = new Map(CORE_MOTOR_PLAN_V1.map((item) => [item.id, item]));
  return cards.map((card) => {
    const planned = planById.get(card.id);
    if (!planned) return card;
    return {
      ...card,
      gridRow: card.gridRow || planned.gridRow,
      gridCol: card.gridCol || planned.gridCol,
      hidden: targetStage >= 3 ? false : planned.stage > targetStage,
    };
  });
}
