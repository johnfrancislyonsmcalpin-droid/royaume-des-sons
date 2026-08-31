import { describe, expect, it } from 'vitest'
import type { AvatarState, Challenge, ChallengeOption, ChallengeResult, MasteryState, ProgressState, QuestState, SkillMastery } from '../../types'
import { curriculum } from '../../content/curriculum'
import { completeQuest, resumeQuestState, startQuest } from './questLifecycle'
import { QUEST_REWARD_SCALE } from '../rewards/rewardScale'

function option(id: string, contentItemId: string, isDistractor: boolean): ChallengeOption {
  return { id, contentItemId, isDistractor }
}

function makeChallenge(id: string, skillId: string, targetItemId: string): Challenge {
  return {
    id,
    kind: 'listen-touch',
    skillId,
    targetItemId,
    options: [option(`${id}-opt-0`, targetItemId, false), option(`${id}-opt-1`, 'distractor-item', true)],
    isReview: false,
  }
}

function result(challengeId: string, correct: boolean, timestamp = '2026-01-01T00:00:00.000Z'): ChallengeResult {
  return { challengeId, correct, usedHelpLevel: 0, usedListenAgain: false, responseMs: 1200, timestamp }
}

function masteredSkill(skillId: string): SkillMastery {
  return {
    skillId,
    last10: [true, true, true, true, true, true, true, true, true, true],
    masteredAt: '2026-01-01T00:00:00.000Z',
    decayedAt: null,
  }
}

function unmasteredSkill(skillId: string): SkillMastery {
  return { skillId, last10: [], masteredAt: null, decayedAt: null }
}

function emptyAvatar(): AvatarState {
  return { avatarId: 'avatar-comete', companionId: 'companion-luciole', cosmetics: [], xp: 0, coins: 0 }
}

function baseProgress(regionId: string): ProgressState {
  return {
    currentLevel: 1,
    currentRegionId: regionId,
    unlockedRegionIds: [regionId],
    grandLivreItemIds: [],
    helpAdultCount: 0,
    sessionMinutesByDay: {},
  }
}

describe('startQuest', () => {
  it('démarre toujours à currentIndex 0 avec results vide (SPEC §4)', () => {
    const challenges = [makeChallenge('c0', 'L1-voyelles', 'grapheme:a')]
    const quest = startQuest('quest-1', 'clairiere-des-voyelles', challenges, '2026-01-01T00:00:00.000Z')
    expect(quest.currentIndex).toBe(0)
    expect(quest.results).toEqual([])
    expect(quest.challengeQueue).toEqual(challenges)
    expect(quest.questId).toBe('quest-1')
    expect(quest.regionId).toBe('clairiere-des-voyelles')
  })
})

describe('resumeQuestState — reprise après rechargement (G4)', () => {
  it('un aller-retour JSON.stringify/parse restaure exactement le même défi en cours', () => {
    const challenges = [
      makeChallenge('c0', 'L2-consonnes', 'grapheme:l'),
      makeChallenge('c1', 'L2-consonnes', 'grapheme:m'),
      makeChallenge('c2', 'L2-consonnes', 'grapheme:r'),
    ]
    let quest = startQuest('quest-2', 'foret-des-premieres-consonnes', challenges)
    // Simule une progression en plein milieu de la quête : 2 défis résolus.
    quest = { ...quest, currentIndex: 2, results: [result('c0', true), result('c1', true)] }

    const serialized = JSON.stringify(quest)
    const restored: QuestState = JSON.parse(serialized)
    const resumed = resumeQuestState(restored)

    expect(resumed).toEqual(quest)
    expect(resumed.currentIndex).toBe(2)
    expect(resumed.challengeQueue[resumed.currentIndex]).toEqual(challenges[2])
    expect(resumed.challengeQueue[resumed.currentIndex].id).toBe('c2')
  })
})

describe('completeQuest — G4', () => {
  const regionId = curriculum.levels[0].regionId // clairiere-des-voyelles
  const skillId = curriculum.levels[0].skillIds[0]

  it('vide le QuestState (clearedQuestState: null)', () => {
    const quest: QuestState = {
      questId: 'q',
      regionId,
      challengeQueue: [],
      currentIndex: 0,
      results: [],
      startedAt: '2026-01-01T00:00:00.000Z',
    }
    const outcome = completeQuest(quest, { skills: {}, reviewQueue: [] }, emptyAvatar(), baseProgress(regionId), false)
    expect(outcome.clearedQuestState).toBeNull()
  })

  it('applique la récompense (E2 computeQuestReward + applyQuestReward) selon le nombre de défis distincts réussis', () => {
    const challenges = [
      makeChallenge('c0', skillId, 'grapheme:a'),
      makeChallenge('c1', skillId, 'grapheme:i'),
      makeChallenge('c2', skillId, 'grapheme:o'),
    ]
    const quest: QuestState = {
      questId: 'q',
      regionId,
      challengeQueue: challenges,
      currentIndex: 3,
      results: [result('c0', true), result('c1', false), result('c1', true), result('c2', true)],
      startedAt: '2026-01-01T00:00:00.000Z',
    }
    const mastery: MasteryState = { skills: { [skillId]: unmasteredSkill(skillId) }, reviewQueue: [] }
    const outcome = completeQuest(quest, mastery, emptyAvatar(), baseProgress(regionId), false)

    // 3 défis DISTINCTS réussis (c0, c1, c2) — c1 ne compte pas double malgré
    // son essai raté puis réussi.
    expect(outcome.avatar.xp).toBe(3 * QUEST_REWARD_SCALE.perChallengeCorrect.xp)
    expect(outcome.avatar.coins).toBe(3 * QUEST_REWARD_SCALE.perChallengeCorrect.coins)
  })

  it('ajoute le bonus de boss à la récompense quand isBossQuest est vrai', () => {
    const challenges = [makeChallenge('c0', skillId, 'grapheme:a')]
    const quest: QuestState = {
      questId: 'q',
      regionId,
      challengeQueue: challenges,
      currentIndex: 1,
      results: [result('c0', true)],
      startedAt: '2026-01-01T00:00:00.000Z',
    }
    const mastery: MasteryState = { skills: { [skillId]: masteredSkill(skillId) }, reviewQueue: [] }
    const outcome = completeQuest(quest, mastery, emptyAvatar(), baseProgress(regionId), true)
    expect(outcome.avatar.xp).toBe(QUEST_REWARD_SCALE.perChallengeCorrect.xp + QUEST_REWARD_SCALE.bossCompletionBonus.xp)
  })

  it('règle du Grand Livre : ajoute targetItemId seulement si le défi est réussi ET la compétence maîtrisée', () => {
    const otherSkillId = curriculum.levels[0].skillIds[1] ?? skillId
    const challenges = [
      makeChallenge('mastered-correct', skillId, 'grapheme:a'), // réussi + compétence maîtrisée -> AJOUTÉ
      makeChallenge('mastered-incorrect', skillId, 'grapheme:i'), // raté -> PAS ajouté
      makeChallenge('unmastered-correct', otherSkillId, 'grapheme:o'), // réussi mais compétence non maîtrisée -> PAS ajouté
    ]
    const quest: QuestState = {
      questId: 'q',
      regionId,
      challengeQueue: challenges,
      currentIndex: 3,
      results: [result('mastered-correct', true), result('mastered-incorrect', false), result('unmastered-correct', true)],
      startedAt: '2026-01-01T00:00:00.000Z',
    }
    const mastery: MasteryState = {
      skills: { [skillId]: masteredSkill(skillId), [otherSkillId]: unmasteredSkill(otherSkillId) },
      reviewQueue: [],
    }
    const outcome = completeQuest(quest, mastery, emptyAvatar(), baseProgress(regionId), false)
    expect(outcome.progress.grandLivreItemIds).toEqual(['grapheme:a'])
  })

  it('ne duplique jamais un id déjà présent dans grandLivreItemIds', () => {
    const challenges = [makeChallenge('c0', skillId, 'grapheme:a')]
    const quest: QuestState = {
      questId: 'q',
      regionId,
      challengeQueue: challenges,
      currentIndex: 1,
      results: [result('c0', true)],
      startedAt: '2026-01-01T00:00:00.000Z',
    }
    const mastery: MasteryState = { skills: { [skillId]: masteredSkill(skillId) }, reviewQueue: [] }
    const progress = { ...baseProgress(regionId), grandLivreItemIds: ['grapheme:a'] }
    const outcome = completeQuest(quest, mastery, emptyAvatar(), progress, false)
    expect(outcome.progress.grandLivreItemIds).toEqual(['grapheme:a'])
  })

  it('un boss réussi débloque la région suivante et jamais avant (G3/G4)', () => {
    const nextLevel = curriculum.levels[1] // niveau 2
    const quest: QuestState = {
      questId: 'boss-quest',
      regionId,
      challengeQueue: [],
      currentIndex: 0,
      results: [],
      startedAt: '2026-01-01T00:00:00.000Z',
    }
    const progressBefore = baseProgress(regionId)
    expect(progressBefore.unlockedRegionIds).not.toContain(nextLevel.regionId)

    const outcome = completeQuest(quest, { skills: {}, reviewQueue: [] }, emptyAvatar(), progressBefore, true)
    expect(outcome.progress.unlockedRegionIds).toContain(nextLevel.regionId)
    expect(outcome.progress.currentLevel).toBe(nextLevel.level)
    expect(outcome.progress.currentRegionId).toBe(nextLevel.regionId)
  })

  it("une quête RÉGULIÈRE (non-boss) ne débloque jamais de région suivante", () => {
    const nextLevel = curriculum.levels[1]
    const quest: QuestState = {
      questId: 'regular-quest',
      regionId,
      challengeQueue: [],
      currentIndex: 0,
      results: [],
      startedAt: '2026-01-01T00:00:00.000Z',
    }
    const progressBefore = baseProgress(regionId)
    const outcome = completeQuest(quest, { skills: {}, reviewQueue: [] }, emptyAvatar(), progressBefore, false)
    expect(outcome.progress.unlockedRegionIds).not.toContain(nextLevel.regionId)
    expect(outcome.progress.currentLevel).toBe(progressBefore.currentLevel)
  })

  it('DÉFAUT CHASSÉ : le boss du niveau 10 (dernier niveau) ne plante pas et laisse la progression telle quelle (pas de niveau 11)', () => {
    const level10 = curriculum.levels[curriculum.levels.length - 1]
    const quest: QuestState = {
      questId: 'final-boss',
      regionId: level10.regionId,
      challengeQueue: [],
      currentIndex: 0,
      results: [],
      startedAt: '2026-01-01T00:00:00.000Z',
    }
    const progressBefore = { ...baseProgress(level10.regionId), currentLevel: level10.level }
    expect(() => completeQuest(quest, { skills: {}, reviewQueue: [] }, emptyAvatar(), progressBefore, true)).not.toThrow()
    const outcome = completeQuest(quest, { skills: {}, reviewQueue: [] }, emptyAvatar(), progressBefore, true)
    expect(outcome.progress.currentLevel).toBe(level10.level)
    expect(outcome.progress.currentRegionId).toBe(level10.regionId)
    expect(outcome.progress.unlockedRegionIds).toEqual(progressBefore.unlockedRegionIds)
  })
})
