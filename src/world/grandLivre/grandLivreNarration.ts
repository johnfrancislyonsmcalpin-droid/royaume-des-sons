// Textes narrés du Grand Livre — Le Royaume des Sons (leaf E4).
//
// Ce ne sont pas des mots/phrases du CORPUS PÉDAGOGIQUE (CLAUDE.md #2 : ce que
// l'enfant apprend à lire, qui vit dans src/content/*.json et n'est JAMAIS en
// dur dans le code) mais des phrases d'interface/narration du jeu — même
// catégorie déjà acceptée hors src/content/ par E1 (regionNarration.ts) et E2
// (avatarData.ts, VERIFIED).

/** Narration jouée à l'apparition de l'écran (une seule fois, écran entier). */
export function screenIntroNarration(itemCount: number): string {
  if (itemCount === 0) {
    return "Ton Grand Livre est encore vide. Il se remplira des mots que tu sauras bien lire."
  }
  return 'Voici ton Grand Livre. Touche un mot, une phrase ou un texte pour le réécouter.'
}

/** Narration jouée quand l'enfant touche un item pour le réécouter. */
export function itemTouchNarration(): string {
  return 'Écoute.'
}
