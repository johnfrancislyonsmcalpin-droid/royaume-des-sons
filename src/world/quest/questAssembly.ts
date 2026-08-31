// Assemblage de quête (SPEC §4, tâche E3 point 1) : 8 à 12 Challenge
// enchaînés, mélange de nouveaux défis tirés des compétences de la région et
// de défis de révision (~25 %, D2/spacing.ts), distracteurs jamais
// aléatoires (D2/distractors.ts) et anti-position enchaîné sur toute la
// quête (D3/shuffle.ts).
import type {
  Challenge,
  ChallengeOption,
  ContentItem,
  CurriculumLevel,
  MasteryState,
  ReviewQueueItem,
  Skill,
  SkillId,
} from '../../types'
import { isMastered } from '../../engine/mastery'
import { pickDistractors, type ConfusionTable } from '../../engine/distractors'
import { shuffleOptions } from '../../engine/shuffle'
import { selectReviewItemsForQuest } from '../../engine/spacing'
import { getConfusionsFor } from '../../content/tables'
import { curriculum } from '../../content/curriculum'
import { questContentPool, resolveQuestItem } from './content'
import { pickChallengeKind } from './challengeKind'

/** Nombre total de défis d'une quête (SPEC §4 : 8 à 12). Décision libre
 * (ASSUMPTIONS.md) : 10 pour une quête régulière, 12 pour un boss (un peu
 * plus long pour marquer le jalon de fin de région) — les deux valeurs
 * restent dans la fourchette imposée. */
export const REGULAR_QUEST_SIZE = 10
export const BOSS_QUEST_SIZE = 12

/** Nombre de distracteurs demandés par défi (SPEC §6.1 : « 3 ou 4 cartes »
 * -> 1 cible + jusqu'à 2 distracteurs = 3 cartes). `pickDistractors` (D2)
 * peut légitimement en renvoyer moins si le pool ne fournit pas assez de
 * candidats : jamais de distracteur fabriqué hors de la table de confusion
 * ou des items déjà rencontrés. */
export const DISTRACTOR_COUNT = 2

// Table de confusion complète du curriculum (interface ConfusionTable de
// D2/distractors.ts), construite une seule fois depuis B3 (getConfusionsFor,
// déjà symétrisée par tables.ts) pour tous les graphèmes connus.
const CONFUSION_TABLE: ConfusionTable = Object.fromEntries(
  Object.keys(curriculum.graphemes).map((graphemeId) => [graphemeId, getConfusionsFor(graphemeId)]),
)

interface PlannedChallenge {
  item: ContentItem
  skillId: SkillId
  isReview: boolean
}

/**
 * Répartit `reviews` dans `base` à intervalles aussi réguliers que possible
 * (jamais tous regroupés à la fin) — pas une exigence explicite de SPEC.md,
 * mais une quête où toutes les révisions arrivent d'un coup à la fin serait
 * un défaut d'expérience évident. `reviews` en excédent (si jamais plus
 * nombreux que `base`) sont ajoutés à la fin plutôt que perdus.
 */
function interleaveReviews<T>(base: readonly T[], reviews: readonly T[]): T[] {
  if (reviews.length === 0) return base.slice()
  if (base.length === 0) return reviews.slice()

  const result: T[] = []
  const step = base.length / reviews.length
  let insertedCount = 0
  for (let i = 0; i < base.length; i += 1) {
    result.push(base[i])
    while (insertedCount < reviews.length && Math.floor((i + 1) / step) > insertedCount) {
      result.push(reviews[insertedCount])
      insertedCount += 1
    }
  }
  while (insertedCount < reviews.length) {
    result.push(reviews[insertedCount])
    insertedCount += 1
  }
  return result
}

/**
 * Ordonne les compétences de la région pour le tirage round-robin des
 * nouveaux défis : les compétences NON encore maîtrisées (D1/isMastered)
 * passent en premier, pour recevoir davantage de créneaux dans la quête
 * (pratique renforcée sur ce qui n'est pas encore acquis) — usage
 * intentionnel du paramètre `mastery`, sinon totalement ignoré par cette
 * fonction. Tri stable : à maîtrise égale, l'ordre d'origine est conservé.
 */
function orderSkillsByMasteryNeed(skills: readonly Skill[], mastery: MasteryState): Skill[] {
  return [...skills].sort((a, b) => {
    const aMastered = mastery.skills[a.id] ? Number(isMastered(mastery.skills[a.id])) : 0
    const bMastered = mastery.skills[b.id] ? Number(isMastered(mastery.skills[b.id])) : 0
    return aMastered - bMastered
  })
}

function candidatesForSkill(
  pool: readonly ContentItem[],
  level: number,
  skillId: SkillId,
  usedIds: ReadonlySet<string>,
): ContentItem[] {
  return pool.filter((item) => item.level === level && item.skillIds.includes(skillId) && !usedIds.has(item.id))
}

function candidatesForLevel(pool: readonly ContentItem[], level: number, usedIds: ReadonlySet<string>): ContentItem[] {
  return pool.filter((item) => item.level === level && !usedIds.has(item.id))
}

/**
 * Choisit le prochain item « nouveau » pour `skillId` au niveau
 * `regionLevel`. Ordre de repli (défense contre le défaut « compétence sans
 * contenu », identifié en 4e passe) :
 *   1. un item du niveau exact, taggé pour cette compétence, pas encore
 *      utilisé dans CETTE quête ;
 *   2. à défaut, n'importe quel item du niveau exact, pas encore utilisé ;
 *   3. à défaut (pool épuisé, ex. niveau 10 avec seulement 4 textes), un
 *      item déjà utilisé dans cette quête est réemployé plutôt que de
 *      produire un défi en moins que le compte visé.
 * Ne lève une erreur QUE si le niveau n'a strictement AUCUN item, même déjà
 * utilisé (région sans contenu du tout — ne devrait jamais se produire avec
 * le pool réel, voir content.ts, mais ce module ne fabrique jamais un
 * ContentItem hors du pool vérifié plutôt que de produire un Challenge
 * invalide silencieux).
 */
function pickNewItem(
  pool: readonly ContentItem[],
  level: number,
  skillId: SkillId,
  usedIds: Set<string>,
  rng: () => number,
): ContentItem {
  const bySkill = candidatesForSkill(pool, level, skillId, usedIds)
  if (bySkill.length > 0) return bySkill[Math.floor(rng() * bySkill.length)]

  const byLevel = candidatesForLevel(pool, level, usedIds)
  if (byLevel.length > 0) return byLevel[Math.floor(rng() * byLevel.length)]

  const anyAtLevel = pool.filter((item) => item.level === level)
  if (anyAtLevel.length > 0) return anyAtLevel[Math.floor(rng() * anyAtLevel.length)]

  throw new Error(`[world/quest] aucun contenu disponible au niveau ${level} pour assembler une quête`)
}

function buildOptions(
  target: ContentItem,
  pool: readonly ContentItem[],
  encounteredItemIds: Set<string>,
  previousCorrectPosition: number | null,
  rng: () => number,
  idPrefix: string,
): { options: ChallengeOption[]; correctPosition: number } {
  const distractors = pickDistractors(target, pool as ContentItem[], CONFUSION_TABLE, encounteredItemIds, DISTRACTOR_COUNT, rng)

  const unshuffled: ChallengeOption[] = [
    { id: `${idPrefix}-opt-target`, contentItemId: target.id, isDistractor: false },
    ...distractors.map((distractor, index) => ({
      id: `${idPrefix}-opt-d${index}`,
      contentItemId: distractor.id,
      isDistractor: true,
    })),
  ]

  const shuffled = shuffleOptions(unshuffled, previousCorrectPosition, rng)
  const correctPosition = shuffled.findIndex((option) => !option.isDistractor)
  return { options: shuffled, correctPosition }
}

/**
 * Assemble 8 à 12 Challenge pour une quête (SPEC §4).
 *
 * `skills` doit correspondre aux compétences de `regionLevel.skillIds`
 * (mêmes ids, n'importe quel ordre), résolues par l'appelant depuis
 * `curriculum.skills` — ce module ne connaît que `regionLevel.skillIds`
 * sinon et ne recharge jamais lui-même le curriculum pour ça.
 *
 * `rng` est injectable (par défaut `Math.random`) pour des tests
 * déterministes, même convention que D2/D3 (pickDistractors, shuffleOptions).
 */
export function assembleQuest(
  regionLevel: CurriculumLevel,
  skills: Skill[],
  mastery: MasteryState,
  reviewQueue: ReviewQueueItem[],
  encounteredItemIds: Set<string>,
  questsPlayed: number,
  isBossQuest: boolean,
  rng: () => number = Math.random,
): Challenge[] {
  const totalSize = isBossQuest ? BOSS_QUEST_SIZE : REGULAR_QUEST_SIZE
  const reviewItems = selectReviewItemsForQuest(reviewQueue, questsPlayed, totalSize)
  const newCount = Math.max(0, totalSize - reviewItems.length)

  const orderedSkills = orderSkillsByMasteryNeed(skills, mastery)
  const usedIds = new Set<string>()

  const newPlanned: PlannedChallenge[] = []
  if (orderedSkills.length > 0) {
    for (let i = 0; i < newCount; i += 1) {
      const skill = orderedSkills[i % orderedSkills.length]
      const item = pickNewItem(questContentPool, regionLevel.level, skill.id, usedIds, rng)
      usedIds.add(item.id)
      newPlanned.push({ item, skillId: skill.id, isReview: false })
    }
  }
  // orderedSkills.length === 0 : région sans compétence déclarée (ne devrait
  // jamais se produire, B1 exige skillIds non vide) — dégrade en produisant
  // une quête plus courte plutôt que de planter (défaut documenté, jamais
  // silencieusement « réparé » en fabriquant une compétence).

  const reviewPlanned: PlannedChallenge[] = reviewItems.map((reviewItem) => ({
    item: resolveQuestItem(reviewItem.contentItemId),
    skillId: reviewItem.skillId,
    isReview: true,
  }))

  const planned = interleaveReviews(newPlanned, reviewPlanned)

  let previousCorrectPosition: number | null = null
  let kindRotation = 0

  return planned.map((plan, index) => {
    const challengeId = `${regionLevel.regionId}-quest-c${index}`
    const kind = pickChallengeKind(plan.item.kind, kindRotation)
    kindRotation += 1

    const { options, correctPosition } = buildOptions(
      plan.item,
      questContentPool,
      encounteredItemIds,
      previousCorrectPosition,
      rng,
      challengeId,
    )
    previousCorrectPosition = correctPosition

    const challenge: Challenge = {
      id: challengeId,
      kind,
      skillId: plan.skillId,
      targetItemId: plan.item.id,
      options,
      isReview: plan.isReview,
    }
    return challenge
  })
}
