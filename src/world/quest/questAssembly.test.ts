import { describe, expect, it } from 'vitest'
import type { MasteryState, ReviewQueueItem, Skill, SkillMastery } from '../../types'
import { curriculum, graphemesKnownAtLevel } from '../../content/curriculum'
import { assembleQuest, BOSS_QUEST_SIZE, REGULAR_QUEST_SIZE } from './questAssembly'
import { reviewSlotCount, selectReviewItemsForQuest } from '../../engine/spacing'
import { questContentPool, resolveQuestItem } from './content'

function emptyMastery(): MasteryState {
  return { skills: {}, reviewQueue: [] }
}

function skillsFor(levelNumber: number): Skill[] {
  const level = curriculum.levels.find((l) => l.level === levelNumber)
  if (!level) throw new Error(`niveau ${levelNumber} introuvable dans le curriculum de test`)
  return level.skillIds.map((id) => curriculum.skills[id])
}

function levelFor(levelNumber: number) {
  const level = curriculum.levels.find((l) => l.level === levelNumber)
  if (!level) throw new Error(`niveau ${levelNumber} introuvable dans le curriculum de test`)
  return level
}

/** Vrai si aucune position de bonne réponse ne se répète d'un défi au
 * suivant, en ignorant les défis à une seule option (cas structurellement
 * insatisfiable, documenté et accepté par D3/shuffle.ts lui-même). */
function hasNoConsecutiveRepeatedPosition(challenges: ReturnType<typeof assembleQuest>): boolean {
  let previous: number | null = null
  for (const challenge of challenges) {
    const position = challenge.options.findIndex((o) => !o.isDistractor)
    if (challenge.options.length > 1) {
      if (previous !== null && position === previous) return false
    }
    previous = position
  }
  return true
}

describe('assembleQuest — G1', () => {
  it('produit entre 8 et 12 Challenge pour une quête régulière (SPEC §4)', () => {
    const level = levelFor(3) // Le Pont des Syllabes : corpus riche (syllabes + mots)
    const challenges = assembleQuest(level, skillsFor(3), emptyMastery(), [], new Set(), 0, false)
    expect(challenges.length).toBeGreaterThanOrEqual(8)
    expect(challenges.length).toBeLessThanOrEqual(12)
    expect(challenges).toHaveLength(REGULAR_QUEST_SIZE)
  })

  it('produit entre 8 et 12 Challenge pour une quête boss', () => {
    const level = levelFor(3)
    const challenges = assembleQuest(level, skillsFor(3), emptyMastery(), [], new Set(), 0, true)
    expect(challenges.length).toBeGreaterThanOrEqual(8)
    expect(challenges.length).toBeLessThanOrEqual(12)
    expect(challenges).toHaveLength(BOSS_QUEST_SIZE)
  })

  it('chaque Challenge cible une compétence de la région et un item du bon niveau, décodable (graphèmes déjà enseignés)', () => {
    const level = levelFor(4) // Le Village des Mots
    const challenges = assembleQuest(level, skillsFor(4), emptyMastery(), [], new Set(), 0, false)
    const known = graphemesKnownAtLevel(level.level)

    for (const challenge of challenges) {
      expect(level.skillIds).toContain(challenge.skillId)
      const item = resolveQuestItem(challenge.targetItemId)
      expect(item.level).toBeLessThanOrEqual(level.level)
      for (const graphemeId of item.graphemeIds) {
        expect(known.has(graphemeId)).toBe(true)
      }
    }
  })

  it('chaque Challenge a exactement une option correcte parmi ses options', () => {
    const level = levelFor(5)
    const challenges = assembleQuest(level, skillsFor(5), emptyMastery(), [], new Set(), 0, false)
    for (const challenge of challenges) {
      const correctCount = challenge.options.filter((o) => !o.isDistractor).length
      expect(correctCount).toBe(1)
      const correctOption = challenge.options.find((o) => !o.isDistractor)
      expect(correctOption?.contentItemId).toBe(challenge.targetItemId)
    }
  })

  it("aucune position de bonne réponse ne se répète deux fois de suite sur la quête entière (D3, anti-position)", () => {
    const level = levelFor(6) // pool riche (96 mots niveaux 6-7)
    const challenges = assembleQuest(level, skillsFor(6), emptyMastery(), [], new Set(), 0, false)
    expect(hasNoConsecutiveRepeatedPosition(challenges)).toBe(true)
  })

  it('la proportion de révisions correspond exactement à ce que produit D2 (selectReviewItemsForQuest)', () => {
    const level = levelFor(4)
    const skills = skillsFor(4)
    const skillId = skills[0].id
    // Items de révision réellement présents dans le pool niveau 4, tous dus
    // dès la quête 0 : plus que le quota (~25%) pour vérifier le plafonnage.
    const level4ItemsForSkill = questContentPool.filter((item) => item.level === 4 && item.skillIds.includes(skillId))
    expect(level4ItemsForSkill.length).toBeGreaterThanOrEqual(5)
    const reviewQueue: ReviewQueueItem[] = level4ItemsForSkill.slice(0, 5).map((item, index) => ({
      id: `review-test-${index}`,
      contentItemId: item.id,
      skillId,
      createdAt: '2026-01-01T00:00:00.000Z',
      stage: 1 as const,
      dueAfterQuestCount: 0,
    }))

    const expectedReviewCount = selectReviewItemsForQuest(reviewQueue, 0, REGULAR_QUEST_SIZE).length
    expect(expectedReviewCount).toBe(reviewSlotCount(REGULAR_QUEST_SIZE))

    const challenges = assembleQuest(level, skills, emptyMastery(), reviewQueue, new Set(), 0, false)
    const actualReviewCount = challenges.filter((c) => c.isReview).length
    expect(actualReviewCount).toBe(expectedReviewCount)
    expect(challenges).toHaveLength(REGULAR_QUEST_SIZE)
  })

  it('sans aucune révision due, tous les défis sont neufs (isReview: false)', () => {
    const level = levelFor(3)
    const challenges = assembleQuest(level, skillsFor(3), emptyMastery(), [], new Set(), 0, false)
    expect(challenges.every((c) => !c.isReview)).toBe(true)
  })

  it('DÉFAUT CORRIGÉ : les niveaux 1 et 2 (aucun mot dans le corpus, seulement des graphèmes isolés) produisent quand même une quête complète', () => {
    for (const levelNumber of [1, 2]) {
      const level = levelFor(levelNumber)
      const challenges = assembleQuest(level, skillsFor(levelNumber), emptyMastery(), [], new Set(), 0, false)
      expect(challenges).toHaveLength(REGULAR_QUEST_SIZE)
      for (const challenge of challenges) {
        expect(challenge.kind).toBe('listen-touch') // seule mécanique jouable sur un graphème isolé
        const item = resolveQuestItem(challenge.targetItemId)
        expect(item.kind).toBe('grapheme')
        expect(item.level).toBe(levelNumber)
      }
    }
  })

  it('DÉFAUT CHASSÉ : une région sans compétence déclarée ne plante jamais (dégrade au lieu de crasher)', () => {
    const level = levelFor(3)
    expect(() => assembleQuest(level, [], emptyMastery(), [], new Set(), 0, false)).not.toThrow()
    const challenges = assembleQuest(level, [], emptyMastery(), [], new Set(), 0, false)
    expect(challenges).toHaveLength(0) // aucune compétence -> aucun nouveau défi, aucune révision due
  })

  it('priorise les compétences non maîtrisées (mastery) dans le round-robin des nouveaux défis', () => {
    const level = levelFor(4)
    const skills = skillsFor(4)
    expect(skills.length).toBeGreaterThanOrEqual(2)
    const masteredSkillId = skills[0].id

    const masteredWindow: boolean[] = Array.from({ length: 10 }, () => true)
    const mastery: MasteryState = {
      skills: {
        [masteredSkillId]: { skillId: masteredSkillId, last10: masteredWindow, masteredAt: '2026-01-01T00:00:00.000Z', decayedAt: null } as SkillMastery,
      },
      reviewQueue: [],
    }

    const challenges = assembleQuest(level, skills, mastery, [], new Set(), 0, false)
    const firstChallengeSkill = challenges[0]?.skillId
    // La première compétence utilisée ne doit pas être la compétence déjà
    // maîtrisée, tant qu'une autre compétence non maîtrisée existe.
    expect(firstChallengeSkill).not.toBe(masteredSkillId)
  })

  it('est déterministe pour un rng injecté fixe (même séquence -> même résultat structurel)', () => {
    const level = levelFor(3)
    const fixedRng = () => 0.5
    const a = assembleQuest(level, skillsFor(3), emptyMastery(), [], new Set(), 0, false, fixedRng)
    const b = assembleQuest(level, skillsFor(3), emptyMastery(), [], new Set(), 0, false, fixedRng)
    expect(a).toEqual(b)
  })
})
