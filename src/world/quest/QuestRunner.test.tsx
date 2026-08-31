// Test de fumée de l'assemblage final (QuestRunner + useQuestSession) :
// vérifie que ce n'est pas un stub — le composant rend réellement la
// mécanique correspondant au ChallengeKind courant, avance au défi suivant
// après une réponse correcte, applique la maîtrise/répétition espacée, et se
// termine (isComplete) quand la file est épuisée. Ce fichier n'est pas l'un
// des CHECK du ledger leaf-E3 (G1-G4, tous des tests de logique pure) : il
// complète la « chasse aux défauts » côté composant assemblé, comme demandé
// par la tâche (« n'importe quelle fonction stub » interdite par CLAUDE.md
// règle #7).
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Challenge, ChallengeOption, ContentItem, MasteryState, QuestState, ReviewQueueItem } from '../../types'
import { QuestRunner } from './QuestRunner'

afterEach(cleanup)

function makeItem(id: string, text: string): ContentItem {
  return { id, kind: 'grapheme', level: 1, text, graphemeIds: [text], skillIds: ['L1-voyelles'] }
}

const items: Record<string, ContentItem> = {
  a: makeItem('a', 'a'),
  i: makeItem('i', 'i'),
  o: makeItem('o', 'o'),
}

function resolveItem(id: string): ContentItem {
  const item = items[id]
  if (!item) throw new Error(`item inconnu : ${id}`)
  return item
}

function options(targetId: string, distractorIds: string[]): ChallengeOption[] {
  return [
    { id: `${targetId}-opt-target`, contentItemId: targetId, isDistractor: false },
    ...distractorIds.map((id, i) => ({ id: `${targetId}-opt-d${i}`, contentItemId: id, isDistractor: true })),
  ]
}

function makeChallenges(): Challenge[] {
  return [
    { id: 'c0', kind: 'listen-touch', skillId: 'L1-voyelles', targetItemId: 'a', options: options('a', ['i', 'o']), isReview: false },
    { id: 'c1', kind: 'listen-touch', skillId: 'L1-voyelles', targetItemId: 'i', options: options('i', ['a', 'o']), isReview: false },
  ]
}

function emptyMastery(): MasteryState {
  return { skills: {}, reviewQueue: [] }
}

describe('QuestRunner — assemblage final (fumée)', () => {
  it('rend la mécanique du premier défi, avance au suivant après une bonne réponse (une fois la relecture post-succès laissée le temps de s\'afficher), puis se termine', { timeout: 15000 }, async () => {
    const user = userEvent.setup()
    const speak = vi.fn().mockResolvedValue(undefined)
    const questState: QuestState = {
      questId: 'quest-test',
      regionId: 'clairiere-des-voyelles',
      challengeQueue: makeChallenges(),
      currentIndex: 0,
      results: [],
      startedAt: '2026-01-01T00:00:00.000Z',
    }
    const onQuestComplete = vi.fn()
    const onMasteryChange = vi.fn()
    const onReviewQueueChange = vi.fn()
    const onQuestStateChange = vi.fn()

    render(
      <QuestRunner
        questState={questState}
        level={1}
        mastery={emptyMastery()}
        reviewQueue={[] as ReviewQueueItem[]}
        questsPlayed={0}
        resolveItem={resolveItem}
        speak={speak}
        onQuestComplete={onQuestComplete}
        onMasteryChange={onMasteryChange}
        onReviewQueueChange={onReviewQueueChange}
        onQuestStateChange={onQuestStateChange}
      />,
    )

    // Premier défi rendu : la mécanique listen-touch (C2), pas un stub vide.
    expect(screen.getByTestId('listen-touch')).toBeInTheDocument()
    expect(screen.getByTestId('quest-runner-ear')).toBeInTheDocument()
    expect(screen.getByTestId('quest-runner-lantern')).toBeInTheDocument()

    // Répond correctement au premier défi (cible : "a").
    await user.click(screen.getByTestId('listen-touch-card-a-opt-target'))

    expect(onMasteryChange).toHaveBeenCalled()
    expect(onReviewQueueChange).toHaveBeenCalled()
    expect(onQuestStateChange).toHaveBeenCalled()

    // Le résultat est persisté IMMÉDIATEMENT (SPEC §3 "écriture après chaque
    // défi"), mais currentIndex n'avance PAS encore : le composant de défi
    // "c0" doit rester monté (même challenge.id) le temps que sa rétroaction
    // de succès et sa relecture post-succès (C1, SPEC §6 "ne doit jamais être
    // sautée") aient une vraie fenêtre pour s'afficher — voir
    // estimateSuccessReplayDelayMs dans useQuestSession.ts (défaut trouvé et
    // corrigé en intégration, leaf A5 / driver).
    const afterAnswer = onQuestStateChange.mock.calls[0][0] as QuestState
    expect(afterAnswer.currentIndex).toBe(0)
    expect(afterAnswer.results).toHaveLength(1)
    expect(afterAnswer.results[0]).toMatchObject({ challengeId: 'c0', correct: true })
    expect(screen.getByTestId('listen-touch')).toBeInTheDocument()
    expect(onQuestComplete).not.toHaveBeenCalled()

    // Après le délai estimé (1 graphème pour "a" -> 1200 + 700 = 1900ms),
    // l'avancement réel se produit et le deuxième défi (cible : "i") s'affiche.
    await waitFor(
      () => {
        const afterAdvance = onQuestStateChange.mock.calls[onQuestStateChange.mock.calls.length - 1][0] as QuestState
        expect(afterAdvance.currentIndex).toBe(1)
      },
      { timeout: 4000 },
    )
    expect(await screen.findByTestId('listen-touch-card-i-opt-target')).toBeInTheDocument()

    await user.click(screen.getByTestId('listen-touch-card-i-opt-target'))

    await waitFor(() => expect(onQuestComplete).toHaveBeenCalledTimes(1), { timeout: 4000 })
    expect(screen.getByTestId('quest-runner-complete')).toBeInTheDocument()
  })

  it('la lanterne avance le palier d\'aide (SPEC §8), jamais au-delà de 3', async () => {
    const user = userEvent.setup()
    const speak = vi.fn().mockResolvedValue(undefined)
    const questState: QuestState = {
      questId: 'quest-test-2',
      regionId: 'clairiere-des-voyelles',
      challengeQueue: makeChallenges(),
      currentIndex: 0,
      results: [],
      startedAt: '2026-01-01T00:00:00.000Z',
    }

    render(
      <QuestRunner
        questState={questState}
        level={1}
        mastery={emptyMastery()}
        reviewQueue={[] as ReviewQueueItem[]}
        questsPlayed={0}
        resolveItem={resolveItem}
        speak={speak}
      />,
    )

    const lantern = screen.getByTestId('quest-runner-lantern')
    // Chaque tap réel est espacé de plus de DOUBLE_TAP_GUARD_MS (TapTarget,
    // C1) : sans cela, des taps rapprochés sur la MÊME instance de bouton
    // seraient ignorés comme anti-rebond, pas comme 3 appuis lanterne
    // distincts.
    async function tapLanternOnce() {
      await user.click(lantern)
      await new Promise((resolve) => setTimeout(resolve, 320))
    }

    await tapLanternOnce() // palier 1
    await tapLanternOnce() // palier 2
    await tapLanternOnce() // palier 3 : la carte cible clignote

    expect(screen.getByTestId('listen-touch-card-a-opt-target').className).toContain('blink')
  })
})
