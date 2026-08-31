// Anti-devinette (SPEC §7) : si l'enfant répond de façon INCORRECTE en moins
// de 700 ms deux fois de suite, le compagnon doit dire « Écoute bien » et
// rejouer la consigne avant d'accepter la réponse suivante. Ce module expose
// uniquement le signal (`triggered`) ; la voix et l'UI qui réagissent à ce
// signal sont hors de sa responsabilité.
//
// Règle critique : une réponse CORRECTE rapide n'est jamais pénalisée. C'est
// de la fluidité — exactement l'objectif du jeu — pas une devinette.

/** Seuil en dessous duquel une réponse est considérée « rapide ». */
export const ANTI_GUESS_FAST_THRESHOLD_MS = 700

/** Nombre de réponses fausses rapides consécutives qui déclenche l'anti-devinette. */
export const ANTI_GUESS_TRIGGER_COUNT = 2

export type AntiGuessState = {
  consecutiveFastWrong: number
}

export const initialAntiGuessState: AntiGuessState = { consecutiveFastWrong: 0 }

export interface AnswerOutcome {
  correct: boolean
  responseMs: number
}

export interface AntiGuessUpdate {
  state: AntiGuessState
  triggered: boolean
}

/**
 * Fait avancer la state machine anti-devinette d'une réponse.
 *
 * - Réponse correcte (quelle que soit sa vitesse, y compris < 700 ms) :
 *   compteur remis à zéro, jamais de déclenchement, jamais de pénalité.
 * - Réponse incorrecte mais en >= 700 ms (pas assez rapide pour être une
 *   devinette) : compteur remis à zéro. La contrainte du §7 porte sur des
 *   fautes rapides CONSÉCUTIVES ; une faute lente casse la chaîne au même
 *   titre qu'une bonne réponse.
 * - Réponse incorrecte en < 700 ms : compteur incrémenté. S'il atteint 2, le
 *   déclenchement a lieu et le compteur repart à zéro (un nouveau cycle de
 *   détection recommence pour la suite de la séquence, plutôt que de
 *   redéclencher immédiatement à la réponse fausse-rapide suivante).
 */
export function updateAntiGuess(
  state: AntiGuessState,
  result: AnswerOutcome
): AntiGuessUpdate {
  if (result.correct) {
    return { state: { consecutiveFastWrong: 0 }, triggered: false }
  }

  const isFast = result.responseMs < ANTI_GUESS_FAST_THRESHOLD_MS

  if (!isFast) {
    return { state: { consecutiveFastWrong: 0 }, triggered: false }
  }

  const consecutiveFastWrong = state.consecutiveFastWrong + 1

  if (consecutiveFastWrong >= ANTI_GUESS_TRIGGER_COUNT) {
    return { state: { consecutiveFastWrong: 0 }, triggered: true }
  }

  return { state: { consecutiveFastWrong }, triggered: false }
}
