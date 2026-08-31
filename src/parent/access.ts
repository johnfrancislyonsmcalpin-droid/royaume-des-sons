// Logique pure de l'accès caché à l'écran parent (SPEC §9, leaf F1).
//
// Deux mécanismes indépendants et testables sans DOM :
//  - un appui long de HIDDEN_ACCESS_HOLD_MS sur la zone invisible du coin
//    supérieur gauche (le minutage réel vit dans HiddenAccessGate.tsx, un
//    setTimeout piloté par le composant) ;
//  - une addition à deux chiffres générée aléatoirement, dont seule la bonne
//    réponse ouvre l'écran parent.
//
// Aucune fonction ici ne touche le DOM ni un minuteur : c'est la même
// discipline "moteur pur" que src/engine/** (fonctions testables isolément).

/** Durée d'appui (ms) sur la zone cachée avant que le pavé numérique apparaisse. */
export const HIDDEN_ACCESS_HOLD_MS = 3000

/** Bornes des deux opérandes de l'addition proposée : deux chiffres (10-99). */
const OPERAND_MIN = 10
const OPERAND_MAX = 99

export interface AdditionChallenge {
  a: number
  b: number
  answer: number
}

/**
 * Génère une addition à deux chiffres (deux opérandes entre 10 et 99).
 * `random` est injectable (par défaut `Math.random`) pour rester déterministe
 * en test, comme le reste des générateurs du projet.
 */
export function generateAdditionChallenge(random: () => number = Math.random): AdditionChallenge {
  const a = OPERAND_MIN + Math.floor(random() * (OPERAND_MAX - OPERAND_MIN + 1))
  const b = OPERAND_MIN + Math.floor(random() * (OPERAND_MAX - OPERAND_MIN + 1))
  return { a, b, answer: a + b }
}

/** Vrai seulement si `input` représente exactement la bonne réponse (pas de troncature, pas d'espace). */
export function isCorrectAnswer(challenge: AdditionChallenge, input: string): boolean {
  if (input.trim().length === 0) return false
  if (!/^\d+$/.test(input.trim())) return false
  return Number(input.trim()) === challenge.answer
}
