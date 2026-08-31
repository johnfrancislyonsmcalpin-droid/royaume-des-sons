// Construction des pièces de la Forge (C3, SPEC §6.2) : les graphèmes du
// mot/syllabe cible, mélangés, plus au moins un graphème distracteur tiré
// de `challenge.options` — jamais une valeur fabriquée hors de cette
// source (SPEC §7 : "Distracteurs jamais aléatoires"). Séparé de Forge.tsx
// pour rester testable comme pure logique, indépendamment du rendu React
// (même convention que src/challenges/reorder/words.ts, C4).
import type { ChallengeOption, ContentItem, GraphemeId } from '../../types'

export interface ForgePiece {
  /** Identité stable de l'INSTANCE de pièce, distincte de sa valeur : un mot
   * comme "papa" a deux pièces de valeur "p" avec des id différents (sinon
   * la primitive `useLiftAndPlace`, indexée par id, ne pourrait pas les
   * distinguer — voir liftAndPlace.ts). */
  id: string
  graphemeId: GraphemeId
  /** Vrai pour une pièce qui ne correspond à AUCUNE position de la cible :
   * elle ne peut donc jamais être posée correctement nulle part. */
  isDistractor: boolean
}

export type RandomFn = () => number

function fisherYatesShuffle<T>(items: readonly T[], rng: RandomFn): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Choisit, pour un `ContentItem` distracteur donné, le premier de ses
 * graphèmes qui n'est ni déjà dans la cible ni déjà retenu comme
 * distracteur — ou `null` si aucun n'est éligible.
 *
 * Restriction délibérée à UN SEUL graphème par option distractrice (décision
 * consignée pour ASSUMPTIONS.md, comportement non fixé mot pour mot par
 * SPEC.md) : une option distractrice peut être un item multi-graphèmes
 * (syllabe, mot). Ajouter chacun de ses graphèmes noierait la réserve d'un
 * enfant de 5 ans sous des pièces sans rapport avec la cible ; "au moins un
 * graphème distracteur tiré de challenge.options" (tâche C3) est satisfait
 * en ajoutant une pièce par option distractrice, pas une par graphème.
 *
 * Un graphème du distracteur déjà présent dans la cible est explicitement
 * exclu : sinon la pièce "distractrice" formerait accidentellement une
 * séquence correcte si posée à la position portant cette même valeur,
 * cessant d'être un distracteur (défaut identifié en relecture experte,
 * voir rapport de leaf C3).
 */
function pickDistractorGrapheme(
  item: ContentItem,
  excluded: ReadonlySet<GraphemeId>,
): GraphemeId | null {
  for (const graphemeId of item.graphemeIds) {
    if (!excluded.has(graphemeId)) return graphemeId
  }
  return null
}

/**
 * Construit les pièces d'un défi Forge : une pièce par position de
 * `target.graphemeIds` (dans l'ordre cible, avant mélange), plus une pièce
 * par option distractrice de `challenge.options` (`isDistractor: true`)
 * pour laquelle un graphème éligible a été trouvé. Jamais de distracteur
 * fabriqué en dehors de `challenge.options` (SPEC §7).
 *
 * Résultat mélangé (Fisher-Yates, `rng` injectable pour des tests
 * déterministes ; `Math.random` par défaut) : l'ordre de réserve n'est
 * jamais celui de la cible.
 */
export function buildForgePieces(
  target: ContentItem,
  options: readonly ChallengeOption[],
  resolveItem: (contentItemId: string) => ContentItem,
  rng: RandomFn = Math.random,
): ForgePiece[] {
  const targetPieces: ForgePiece[] = target.graphemeIds.map((graphemeId, index) => ({
    id: `target-${index}`,
    graphemeId,
    isDistractor: false,
  }))

  const excluded = new Set<GraphemeId>(target.graphemeIds)
  const distractorPieces: ForgePiece[] = []

  for (const option of options) {
    if (!option.isDistractor) continue
    const item = resolveItem(option.contentItemId)
    const graphemeId = pickDistractorGrapheme(item, excluded)
    if (graphemeId === null) continue // aucun graphème éligible dans cette option : on ne fabrique rien
    excluded.add(graphemeId) // pas deux pièces distractrices de même valeur
    distractorPieces.push({
      id: `distractor-${distractorPieces.length}`,
      graphemeId,
      isDistractor: true,
    })
  }

  return fisherYatesShuffle([...targetPieces, ...distractorPieces], rng)
}
