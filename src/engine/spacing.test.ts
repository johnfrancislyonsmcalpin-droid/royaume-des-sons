import { describe, expect, it } from 'vitest'
import {
  STAGE_INTERVAL,
  createReviewItem,
  recordChallengeResult,
  reviewSlotCount,
  selectReviewItems,
  selectReviewItemsForQuest,
} from './spacing'
import type { ReviewQueueItem } from '../types'

describe('STAGE_INTERVAL', () => {
  it('définit les paliers 1, 3 et 8 quêtes (SPEC §7)', () => {
    expect(STAGE_INTERVAL).toEqual({ 1: 1, 2: 3, 3: 8 })
  })
})

describe('createReviewItem', () => {
  it('crée un item au palier 1, dû une quête plus tard', () => {
    const item = createReviewItem('mot-chat', 'L2-consonnes', 5, '2026-01-01T00:00:00.000Z')
    expect(item.stage).toBe(1)
    expect(item.dueAfterQuestCount).toBe(6)
    expect(item.contentItemId).toBe('mot-chat')
    expect(item.skillId).toBe('L2-consonnes')
    expect(item.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('recordChallengeResult', () => {
  it('crée un item palier 1 sur une réponse incorrecte sans item existant', () => {
    const queue: ReviewQueueItem[] = []
    const updated = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 0)
    expect(updated).toHaveLength(1)
    expect(updated[0].stage).toBe(1)
    expect(updated[0].dueAfterQuestCount).toBe(1)
  })

  it("n'a aucun effet sur une réponse correcte sans item existant", () => {
    const queue: ReviewQueueItem[] = []
    const updated = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: true }, 0)
    expect(updated).toEqual([])
  })

  it('fait progresser un item du palier 1 au palier 2 (dû après 3 quêtes de plus) en cas de nouvel échec', () => {
    let queue: ReviewQueueItem[] = []
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 0) // due at 1
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 1) // raté au palier 1
    expect(queue).toHaveLength(1)
    expect(queue[0].stage).toBe(2)
    expect(queue[0].dueAfterQuestCount).toBe(4) // 1 (questsPlayed) + 3
  })

  it('fait progresser un item du palier 2 au palier 3 (dû après 8 quêtes de plus) en cas de nouvel échec', () => {
    let queue: ReviewQueueItem[] = []
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 0)
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 1)
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 4) // raté au palier 2
    expect(queue[0].stage).toBe(3)
    expect(queue[0].dueAfterQuestCount).toBe(12) // 4 + 8
  })

  it('boucle sur le palier 3 (repoussé de 8 quêtes) en cas de nouvel échec au palier 3', () => {
    let queue: ReviewQueueItem[] = []
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 0)
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 1)
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 4)
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 12) // raté au palier 3
    expect(queue).toHaveLength(1)
    expect(queue[0].stage).toBe(3) // reste au palier 3 — pas de palier 4 dans le contrat
    expect(queue[0].dueAfterQuestCount).toBe(20) // 12 + 8
  })

  it('retire l\'item de la file dès une réponse correcte, quel que soit le palier', () => {
    let queue: ReviewQueueItem[] = []
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 0)
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 1) // palier 2
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: true }, 4) // réussi
    expect(queue).toEqual([])
  })

  it('ne modifie pas les autres items de la file', () => {
    let queue: ReviewQueueItem[] = []
    queue = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: false }, 0)
    queue = recordChallengeResult(queue, 'mot-loup', 'L2-consonnes', { correct: false }, 0)
    const updated = recordChallengeResult(queue, 'mot-chat', 'L2-consonnes', { correct: true }, 1)
    expect(updated).toHaveLength(1)
    expect(updated[0].contentItemId).toBe('mot-loup')
  })
})

describe('selectReviewItems', () => {
  const queue: ReviewQueueItem[] = [
    { id: 'a', contentItemId: 'a', skillId: 'S', createdAt: '2026-01-01T00:00:00.000Z', stage: 1, dueAfterQuestCount: 5 },
    { id: 'b', contentItemId: 'b', skillId: 'S', createdAt: '2026-01-02T00:00:00.000Z', stage: 1, dueAfterQuestCount: 10 },
    { id: 'c', contentItemId: 'c', skillId: 'S', createdAt: '2026-01-03T00:00:00.000Z', stage: 2, dueAfterQuestCount: 3 },
  ]

  it('ne retourne que les items dont l\'échéance est atteinte', () => {
    const due = selectReviewItems(queue, 5, 10)
    expect(due.map((i) => i.id).sort()).toEqual(['a', 'c'])
  })

  it("retourne une file vide quand aucun item n'est dû", () => {
    expect(selectReviewItems(queue, 0, 10)).toEqual([])
  })

  it("retourne une liste vide sur une file de révision vide", () => {
    expect(selectReviewItems([], 100, 5)).toEqual([])
  })

  it('respecte la limite `count` en priorisant les items les plus en retard', () => {
    const due = selectReviewItems(queue, 20, 2)
    expect(due).toHaveLength(2)
    expect(due.map((i) => i.id)).toEqual(['c', 'a']) // due=3 puis due=5, avant due=10
  })
})

describe('reviewSlotCount', () => {
  it('vise ~25% de révisions pour une quête de 8 à 12 défis (2 ou 3 sur 10)', () => {
    for (let total = 8; total <= 12; total += 1) {
      const slots = reviewSlotCount(total)
      expect(slots).toBeGreaterThanOrEqual(2)
      expect(slots).toBeLessThanOrEqual(3)
    }
  })

  it('retourne 0 pour une quête vide ou invalide', () => {
    expect(reviewSlotCount(0)).toBe(0)
    expect(reviewSlotCount(-3)).toBe(0)
  })
})

describe('selectReviewItemsForQuest — quête simulée de 10 défis avec historique réaliste', () => {
  it('injecte environ 25% (2 à 3) de révisions dans une quête de 10 défis', () => {
    // Historique réaliste : au fil de quêtes précédentes, l'enfant a raté
    // plusieurs items à des moments différents, créant des échéances variées.
    let queue: ReviewQueueItem[] = []
    // Quête 1 : deux erreurs.
    queue = recordChallengeResult(queue, 'son-b', 'L2-consonnes', { correct: false }, 1) // dû à 2
    queue = recordChallengeResult(queue, 'mot-chat', 'L4-mots', { correct: false }, 1) // dû à 2
    // Quête 2 : une nouvelle erreur, une réussite qui ne change rien à la file (pas de review item).
    queue = recordChallengeResult(queue, 'son-d', 'L2-consonnes', { correct: false }, 2) // dû à 3
    // Quête 3 : l'enfant rate encore "son-b" en révision -> palier 2, dû à 3+3=6.
    queue = recordChallengeResult(queue, 'son-b', 'L2-consonnes', { correct: false }, 3)
    // Quête 3 : "mot-chat" est réussi en révision -> résolu, retiré.
    queue = recordChallengeResult(queue, 'mot-chat', 'L4-mots', { correct: true }, 3)
    // Quête 3 : une erreur de plus, jamais encore revue.
    queue = recordChallengeResult(queue, 'mot-loup', 'L4-mots', { correct: false }, 3) // dû à 4

    // On assemble la quête 6 (questsPlayed = 6) : "son-d" (dû à 3), "mot-loup" (dû
    // à 4) et "son-b" (dû à 6) sont tous échus ; "mot-chat" a été résolu.
    const selected = selectReviewItemsForQuest(queue, 6, 10)

    expect(selected.length).toBeGreaterThanOrEqual(2)
    expect(selected.length).toBeLessThanOrEqual(3)
    expect(reviewSlotCount(10)).toBe(3)
    expect(selected).toHaveLength(3)

    const ids = selected.map((i) => i.contentItemId)
    expect(ids).toEqual(['son-d', 'mot-loup', 'son-b']) // les plus en retard d'abord
  })

  it('ne retourne jamais plus de défis de révision que ce que la file contient réellement de dû', () => {
    let queue: ReviewQueueItem[] = []
    queue = recordChallengeResult(queue, 'son-b', 'L2-consonnes', { correct: false }, 1) // dû à 2, un seul item
    const selected = selectReviewItemsForQuest(queue, 2, 10) // 3 slots visés, 1 seul disponible
    expect(selected).toHaveLength(1)
  })
})
