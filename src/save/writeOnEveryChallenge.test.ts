import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Challenge, ChallengeResult, QuestState, SaveFile } from '../types'
import { SCHEMA_VERSION } from '../types'
import { recordChallengeResult, setCurrentQuestState } from './questState'
import { createEmptySaveFile, loadSaveFile, writeSaveFile, STORAGE_KEY } from './storage'

function buildChallenge(id: string): Challenge {
  return {
    id,
    kind: 'listen-touch',
    skillId: 'L1-voyelles',
    targetItemId: `item-${id}`,
    options: [
      { id: `${id}-o1`, contentItemId: `item-${id}`, isDistractor: false },
      { id: `${id}-o2`, contentItemId: 'item-distractor', isDistractor: true },
    ],
    isReview: false,
  }
}

function buildResult(challengeId: string, correct = true): ChallengeResult {
  return {
    challengeId,
    correct,
    usedHelpLevel: 0,
    usedListenAgain: false,
    responseMs: 900,
    timestamp: '2026-08-31T00:00:00.000Z',
  }
}

function buildQuest(): QuestState {
  return {
    questId: 'q-clairiere-1',
    regionId: 'clairiere-voyelles',
    challengeQueue: [buildChallenge('c1'), buildChallenge('c2'), buildChallenge('c3')],
    currentIndex: 0,
    results: [],
    startedAt: '2026-08-31T00:00:00.000Z',
  }
}

describe('écriture après chaque ChallengeResult', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('persiste immédiatement après un seul défi (pas seulement en fin de quête)', () => {
    setCurrentQuestState(buildQuest(), createEmptySaveFile())

    const afterFirst = recordChallengeResult(buildResult('c1'))

    expect(afterFirst.currentQuestState?.results).toHaveLength(1)
    expect(afterFirst.currentQuestState?.currentIndex).toBe(1)

    // Vérifie que c'est bien dans localStorage, pas seulement en mémoire.
    const raw = window.localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const persisted = JSON.parse(raw as string) as SaveFile
    expect(persisted.currentQuestState?.results).toHaveLength(1)
    expect(persisted.currentQuestState?.results[0].challengeId).toBe('c1')
  })

  it('reprise exacte : après un rechargement simulé, le même défi en cours est restauré', () => {
    setCurrentQuestState(buildQuest(), createEmptySaveFile())
    recordChallengeResult(buildResult('c1', true))
    recordChallengeResult(buildResult('c2', false))

    // "Rechargement simulé" : on ré-instancie l'état uniquement à partir de
    // localStorage, sans réutiliser aucune référence en mémoire.
    const reloaded = loadSaveFile()

    expect(reloaded.currentQuestState).not.toBeNull()
    expect(reloaded.currentQuestState?.questId).toBe('q-clairiere-1')
    expect(reloaded.currentQuestState?.currentIndex).toBe(2)
    expect(reloaded.currentQuestState?.results.map((r) => r.challengeId)).toEqual(['c1', 'c2'])
    // Le défi en cours après reprise est bien le 3e (index 2 -> challengeQueue[2]).
    expect(reloaded.currentQuestState?.challengeQueue[reloaded.currentQuestState.currentIndex].id).toBe('c3')
  })

  it('chaque appel écrit un lastSavedAt à jour', () => {
    setCurrentQuestState(buildQuest(), createEmptySaveFile(), '2026-08-31T09:00:00.000Z')
    const before = loadSaveFile().lastSavedAt
    expect(before).toBe('2026-08-31T09:00:00.000Z')

    const after = recordChallengeResult(buildResult('c1'), loadSaveFile(), '2026-08-31T09:05:00.000Z')
    expect(after.lastSavedAt).toBe('2026-08-31T09:05:00.000Z')
    expect(after.lastSavedAt).not.toBe(before)
  })

  it('ne fait rien et ne lève pas si aucune quête n\'est en cours', () => {
    const empty = createEmptySaveFile()
    writeSaveFile(empty)

    const result = recordChallengeResult(buildResult('orphan'))
    expect(result.currentQuestState).toBeNull()

    const reloaded = loadSaveFile()
    expect(reloaded.currentQuestState).toBeNull()
  })

  it('schemaVersion reste courant après une série d\'écritures', () => {
    setCurrentQuestState(buildQuest(), createEmptySaveFile())
    recordChallengeResult(buildResult('c1'))
    const reloaded = loadSaveFile()
    expect(reloaded.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('une écriture qui échoue (localStorage plein) ne perd pas la progression déjà persistée', () => {
    setCurrentQuestState(buildQuest(), createEmptySaveFile())
    recordChallengeResult(buildResult('c1'))

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota dépassé', 'QuotaExceededError')
    })

    // Cet appel échoue à écrire, mais ne doit pas lever.
    expect(() => recordChallengeResult(buildResult('c2'))).not.toThrow()

    setItemSpy.mockRestore()

    // La dernière écriture réussie (c1) est toujours là, intacte.
    const reloaded = loadSaveFile()
    expect(reloaded.currentQuestState?.results.map((r) => r.challengeId)).toEqual(['c1'])
  })
})
