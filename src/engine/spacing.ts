// Répétition espacée (SPEC §7) : chaque erreur crée un item de révision,
// réinjecté après 1, 3 puis 8 quêtes. Environ 25 % des défis d'une quête sont
// des révisions.
//
// ASSUMPTION (à reporter dans ASSUMPTIONS.md par le driver) : le champ
// `ReviewQueueItem.dueAfterQuestCount` (src/types.ts, contrat gelé) est traité
// ici comme une valeur ABSOLUE — le numéro de quête cumulatif
// (`questsPlayed`) à partir duquel l'item redevient dû — et non comme un
// compte à rebours qu'il faudrait décrémenter à chaque quête jouée. Ce choix :
//   - évite de devoir muter systématiquement CHAQUE entrée de la file à
//     chaque quête (source d'oublis/bugs si une leaf oublie l'étape de
//     décrément) ;
//   - compose directement avec la signature imposée
//     `selectReviewItems(queue, questsPlayed, count)` : un item est « dû »
//     exactement quand `questsPlayed >= item.dueAfterQuestCount` (« atteint »).
//   - reste bien défini même si des quêtes sont rejouées hors séquence ou si
//     l'app est fermée/rouverte entre deux quêtes (pas d'état à faire
//     progresser en arrière-plan).
//
// ASSUMPTION : `ReviewQueueItem.stage` est figé à `1 | 2 | 3` dans
// src/types.ts. Le palier 8 quêtes est donc un plafond, pas une étape finale
// distincte : si un item de palier 3 est de nouveau raté, il RESTE au palier 3
// et son échéance est repoussée de 8 quêtes supplémentaires (boucle), plutôt
// que d'inventer un palier 4 hors contrat ou d'abandonner l'item. Un item ne
// quitte la file que par une réponse correcte (résolu → retiré).

import type { ChallengeResult, ReviewQueueItem, SkillId } from '../types'

/** Nombre de quêtes à attendre avant réinjection, par palier (SPEC §7). */
export const STAGE_INTERVAL: Record<1 | 2 | 3, number> = {
  1: 1,
  2: 3,
  3: 8,
}

function nextStage(stage: 1 | 2 | 3): 1 | 2 | 3 {
  if (stage === 1) return 2
  if (stage === 2) return 3
  return 3 // palier 3 boucle sur lui-même — voir ASSUMPTION en tête de fichier
}

function reviewItemId(skillId: SkillId, contentItemId: string): string {
  // Identifiant stable : au plus un item de révision par (compétence, item de
  // contenu) dans la file à un instant donné.
  return `review:${skillId}:${contentItemId}`
}

/** Crée un item de révision au palier 1, dû après une quête. */
export function createReviewItem(
  contentItemId: string,
  skillId: SkillId,
  questsPlayed: number,
  createdAt: string = new Date().toISOString(),
): ReviewQueueItem {
  return {
    id: reviewItemId(skillId, contentItemId),
    contentItemId,
    skillId,
    createdAt,
    stage: 1,
    dueAfterQuestCount: questsPlayed + STAGE_INTERVAL[1],
  }
}

/**
 * Met à jour la file de révision suite au résultat d'un défi portant sur
 * `contentItemId` / `skillId` :
 *   - réponse incorrecte, aucun item existant → crée un item palier 1 ;
 *   - réponse incorrecte, item existant → avance au palier suivant (voir
 *     ASSUMPTION pour le palier 3) et reporte l'échéance ;
 *   - réponse correcte, item existant → résolu, retiré de la file ;
 *   - réponse correcte, aucun item existant → aucun effet.
 *
 * `questsPlayed` est le compteur cumulatif de quêtes jouées au moment de ce
 * défi ; il sert de base pour calculer la prochaine échéance.
 */
export function recordChallengeResult(
  queue: ReviewQueueItem[],
  contentItemId: string,
  skillId: SkillId,
  result: Pick<ChallengeResult, 'correct'>,
  questsPlayed: number,
  now: string = new Date().toISOString(),
): ReviewQueueItem[] {
  const id = reviewItemId(skillId, contentItemId)
  const existingIndex = queue.findIndex((item) => item.id === id)

  if (result.correct) {
    if (existingIndex === -1) return queue // pas un item de révision : rien à faire
    return [...queue.slice(0, existingIndex), ...queue.slice(existingIndex + 1)]
  }

  if (existingIndex === -1) {
    return [...queue, createReviewItem(contentItemId, skillId, questsPlayed, now)]
  }

  const previous = queue[existingIndex]
  const stage = nextStage(previous.stage)
  const updated: ReviewQueueItem = {
    ...previous,
    stage,
    dueAfterQuestCount: questsPlayed + STAGE_INTERVAL[stage],
  }
  return [...queue.slice(0, existingIndex), updated, ...queue.slice(existingIndex + 1)]
}

/**
 * Retourne les items de la file dont l'échéance est atteinte
 * (`dueAfterQuestCount <= questsPlayed`), les plus en retard d'abord, limités
 * à `count`.
 */
export function selectReviewItems(
  queue: ReviewQueueItem[],
  questsPlayed: number,
  count: number,
): ReviewQueueItem[] {
  if (count <= 0) return []
  return queue
    .filter((item) => item.dueAfterQuestCount <= questsPlayed)
    .sort((a, b) => {
      if (a.dueAfterQuestCount !== b.dueAfterQuestCount) {
        return a.dueAfterQuestCount - b.dueAfterQuestCount
      }
      return a.createdAt.localeCompare(b.createdAt)
    })
    .slice(0, count)
}

const REVIEW_RATIO = 0.25

/**
 * Dose le nombre de défis de révision pour une quête de `totalChallenges`
 * défis (8-12 selon SPEC §4) : ~25 % arrondi à l'entier le plus proche, donc
 * 2 ou 3 sur une quête de 10 défis.
 */
export function reviewSlotCount(totalChallenges: number): number {
  if (totalChallenges <= 0) return 0
  return Math.round(totalChallenges * REVIEW_RATIO)
}

/**
 * Fonction d'assemblage : combine le dosage (`reviewSlotCount`) et la
 * sélection (`selectReviewItems`) pour obtenir directement les items de
 * révision à injecter dans une quête de `totalChallenges` défis.
 */
export function selectReviewItemsForQuest(
  queue: ReviewQueueItem[],
  questsPlayed: number,
  totalChallenges: number,
): ReviewQueueItem[] {
  return selectReviewItems(queue, questsPlayed, reviewSlotCount(totalChallenges))
}
