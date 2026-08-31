// Anti-position (SPEC §7) : la bonne réponse d'un défi ne doit jamais occuper
// deux fois de suite la même position que le défi précédent. Le mélange est
// retiré à chaque défi (pas de position fixe par type d'item).
//
// Ce module est pur : aucune dépendance à React, à la voix ou à la sauvegarde.

import type { ChallengeOption } from '../types'

/** Générateur pseudo-aléatoire retournant un nombre dans [0, 1). Injectable pour les tests. */
export type RandomFn = () => number

// Filet de sécurité contre une boucle infinie si un rng injecté par un test
// est pathologique (ex. constant). Avec un vrai Math.random et n >= 2 options,
// la convergence attendue est quasi immédiate (probabilité >= 1/n à chaque essai).
const MAX_REJECTION_ATTEMPTS = 1000

function fisherYatesShuffle<T>(items: T[], rng: RandomFn): T[] {
  const result = items.slice()
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}

/**
 * Position de l'option correcte (isDistractor === false) dans le tableau, ou
 * -1 si aucune option correcte n'est présente (données malformées en amont —
 * ce module ne devine jamais, il se contente de ne rien casser).
 */
function correctPositionOf(options: ChallengeOption[]): number {
  return options.findIndex((o) => !o.isDistractor)
}

/**
 * Mélange les options d'un défi en garantissant que la position de la bonne
 * réponse n'est jamais identique à `previousCorrectPosition` (la position de
 * la bonne réponse au défi précédent, ou `null` s'il n'y a pas de défi
 * précédent, par exemple en tout début de quête).
 *
 * Implémentation : tirage par mélange de Fisher-Yates, avec re-tirage
 * (rejection sampling) tant que la contrainte n'est pas respectée. Un
 * `rng` injectable permet des tests déterministes ; par défaut `Math.random`.
 *
 * Cas limites documentés (ce ne sont pas des bugs) :
 * - 0 ou 1 option : un seul agencement possible, la contrainte anti-position
 *   est structurellement insatisfaisable si elle coïncide avec l'unique
 *   position disponible. On renvoie une copie du tableau tel quel plutôt que
 *   de boucler indéfiniment ou de lancer une erreur.
 * - 2 options avec `previousCorrectPosition` non nul : éviter la position
 *   précédente force l'autre position à 100 % (il n'y a que deux positions
 *   possibles). Ce n'est pas un biais du générateur, c'est la seule sortie
 *   qui respecte la contrainte : le rejection sampling la trouve après en
 *   moyenne 2 essais.
 * - Aucune option correcte trouvée (`isDistractor` toutes `true`, données
 *   malformées en amont) : la contrainte ne peut pas être évaluée, on
 *   retourne un mélange simple sans contrainte de position.
 */
export function shuffleOptions(
  options: ChallengeOption[],
  previousCorrectPosition: number | null,
  rng: RandomFn = Math.random
): ChallengeOption[] {
  if (options.length <= 1) {
    return options.slice()
  }

  let attempt = fisherYatesShuffle(options, rng)
  let attempts = 1
  let currentPos = correctPositionOf(attempt)

  while (
    previousCorrectPosition !== null &&
    currentPos !== -1 &&
    currentPos === previousCorrectPosition &&
    attempts < MAX_REJECTION_ATTEMPTS
  ) {
    attempt = fisherYatesShuffle(options, rng)
    currentPos = correctPositionOf(attempt)
    attempts++
  }

  // Filet de sécurité déterministe : si le rejet n'a exceptionnellement pas
  // convergé (rng injecté pathologique), on force la contrainte par un
  // échange plutôt que de renvoyer un résultat invalide.
  if (
    previousCorrectPosition !== null &&
    currentPos !== -1 &&
    currentPos === previousCorrectPosition
  ) {
    const swapWith = (currentPos + 1) % attempt.length
    const tmp = attempt[currentPos]
    attempt[currentPos] = attempt[swapWith]
    attempt[swapWith] = tmp
  }

  return attempt
}

/**
 * Étant donné une séquence de jeux d'options (un jeu d'options par défi, dans
 * l'ordre où les défis sont joués), applique `shuffleOptions` à chaque étape
 * en chaînant la position choisie comme `previousCorrectPosition` de l'étape
 * suivante, et retourne la liste des positions de bonne réponse obtenues.
 *
 * Sert de base au test statistique sur 1000 tirages consécutifs (G-D3) :
 * `computeShuffledPositions` appelé sur 1000 défis doit retourner une suite
 * où deux valeurs consécutives ne sont jamais égales.
 */
export function computeShuffledPositions(
  optionsSequence: ChallengeOption[][],
  rng: RandomFn = Math.random
): number[] {
  const positions: number[] = []
  let previous: number | null = null

  for (const options of optionsSequence) {
    const shuffled = shuffleOptions(options, previous, rng)
    const pos = correctPositionOf(shuffled)
    positions.push(pos)
    // Si aucune option correcte n'existe pour ce défi, il n'y a rien à
    // éviter au défi suivant : on ne propage pas de contrainte invalide.
    previous = pos === -1 ? null : pos
  }

  return positions
}
