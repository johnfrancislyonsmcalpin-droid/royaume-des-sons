// Gates leaf-C3 : G1 (primitive touch-lift/touch-place réutilisée, pièces
// cible + distracteur affichées), G2 ("piece mal placee" — retour à la
// réserve avec rétroaction douce, sans échec compté), G3 ("assemblage
// complet" — onAnswer(correct: true) seulement sur assemblage exact).
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Challenge, ChallengeOption, ChallengeResult, ContentItem } from '../../types'
import type { ChallengeSpeakFn } from '../shared/contract'
import { Forge } from './Forge'

afterEach(cleanup)

function makeWordItem(id: string, text: string, graphemeIds: string[], emoji?: string): ContentItem {
  return {
    id,
    kind: 'word',
    level: 3,
    text,
    graphemeIds,
    emoji,
    skillIds: ['L3-fusion-cv'],
  }
}

// Cible "chat" (ch, a, t) + distracteur "chien" (ch, i, en) : "ch" est déjà
// un graphème de la cible, donc le distracteur retenu est "i" (premier
// graphème du distracteur qui n'est PAS dans la cible) — exerce
// explicitement l'exclusion de chevauchement (voir pieces.ts).
const TARGET = makeWordItem('word-chat', 'chat', ['ch', 'a', 't'], '🐈')
const DISTRACTOR_SOURCE = makeWordItem('word-chien', 'chien', ['ch', 'i', 'en'], '🐕')

const ITEMS: Record<string, ContentItem> = {
  [TARGET.id]: TARGET,
  [DISTRACTOR_SOURCE.id]: DISTRACTOR_SOURCE,
}

function makeChallenge(): Challenge {
  const options: ChallengeOption[] = [
    { id: 'opt-1', contentItemId: TARGET.id, isDistractor: false },
    { id: 'opt-2', contentItemId: DISTRACTOR_SOURCE.id, isDistractor: true },
  ]
  return {
    id: 'challenge-forge-1',
    kind: 'forge',
    skillId: 'L3-fusion-cv',
    targetItemId: TARGET.id,
    options,
    isReview: false,
  }
}

function setup(challenge: Challenge = makeChallenge()) {
  const speak: ChallengeSpeakFn = vi.fn(async () => {})
  const answers: Array<Omit<ChallengeResult, 'timestamp'>> = []
  const onAnswer = vi.fn((result: Omit<ChallengeResult, 'timestamp'>) => {
    answers.push(result)
  })

  render(
    <Forge
      challenge={challenge}
      helpLevel={0}
      usedListenAgain={false}
      resolveItem={(id) => {
        const found = ITEMS[id]
        if (!found) throw new Error(`item inconnu dans le test : ${id}`)
        return found
      }}
      speak={speak}
      onAnswer={onAnswer}
    />,
  )

  return { challenge, speak, onAnswer, answers }
}

describe('Forge — rendu initial (G1)', () => {
  it('énonce le texte cible via speak() au chargement', () => {
    const { speak } = setup()
    expect(speak).toHaveBeenCalledWith('chat')
    expect(speak).toHaveBeenCalledTimes(1)
  })

  it('affiche un emplacement par graphème cible', () => {
    setup()
    expect(screen.getAllByTestId(/^forge-slot-\d+$/)).toHaveLength(3)
  })

  it('affiche les graphèmes cibles comme pièces déplaçables, plus au moins un distracteur, via la primitive partagée', () => {
    setup()
    // 3 pièces cible (target-0..2) + 1 pièce distractrice (distractor-0).
    const pieces = screen.getAllByTestId(/^forge-piece-/)
    expect(pieces).toHaveLength(4)
    expect(screen.getByTestId('forge-piece-target-0')).toHaveTextContent('ch')
    expect(screen.getByTestId('forge-piece-target-1')).toHaveTextContent('a')
    expect(screen.getByTestId('forge-piece-target-2')).toHaveTextContent('t')
  })

  it("le distracteur retenu n'est jamais un graphème déjà présent dans la cible (exclut 'ch', retient 'i')", () => {
    setup()
    expect(screen.getByTestId('forge-piece-distractor-0')).toHaveTextContent('i')
  })

  it("affiche l'image (emoji) de la cible quand elle est fournie", () => {
    setup()
    expect(screen.getByTestId('forge-image')).toHaveTextContent('🐈')
  })

  it('aucun emplacement ne contient de pièce au départ', () => {
    setup()
    for (const slot of screen.getAllByTestId(/^forge-slot-\d+$/)) {
      expect(slot).toHaveTextContent('')
    }
  })
})

describe('piece mal placee', () => {
  it("une pièce distractrice posée sur un emplacement retourne à sa réserve, sans se poser et sans appeler onAnswer", async () => {
    const user = userEvent.setup()
    const { onAnswer } = setup()

    await user.click(screen.getByTestId('forge-piece-distractor-0')) // soulève "i"
    await user.click(screen.getByTestId('forge-slot-0')) // emplacement attend "ch"

    expect(screen.getByTestId('forge-slot-0')).toHaveTextContent('')
    expect(screen.getByTestId('forge-piece-distractor-0')).toBeInTheDocument()
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('affiche une rétroaction visuelle douce (jamais un échec) sur l\'emplacement visé par un placement raté', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByTestId('forge-piece-distractor-0'))
    await user.click(screen.getByTestId('forge-slot-0'))

    expect(screen.getByTestId('forge-slot-0')).toHaveClass('forge-slot--wrong')
  })

  it("une pièce cible posée à la MAUVAISE position (bonne valeur, mauvais emplacement) retourne aussi à la réserve", async () => {
    const user = userEvent.setup()
    const { onAnswer } = setup()

    // "a" (target-1) est un graphème cible valide, mais pas à la position 0
    // (qui attend "ch") : doit être rejeté comme un distracteur.
    await user.click(screen.getByTestId('forge-piece-target-1'))
    await user.click(screen.getByTestId('forge-slot-0'))

    expect(screen.getByTestId('forge-slot-0')).toHaveTextContent('')
    expect(screen.getByTestId('forge-piece-target-1')).toBeInTheDocument()
    expect(onAnswer).not.toHaveBeenCalled()
  })

  it('une pièce rejetée reste ensuite normalement utilisable pour sa bonne position', async () => {
    // "target-1" est retapée deux fois de suite (tentative ratée, puis pose
    // correcte) : on avance une horloge simulée entre les deux pour rester
    // au-delà de la fenêtre anti-rebond de TapTarget (300ms, C1 VERIFIED) —
    // même convention que Reorder.test.tsx (C4).
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const advance = () => {
      now += 350
    }
    const user = userEvent.setup()
    const { answers } = setup()

    // Tentative ratée : "a" (target-1) au mauvais emplacement (0).
    await user.click(screen.getByTestId('forge-piece-target-1'))
    advance()
    await user.click(screen.getByTestId('forge-slot-0'))
    advance()
    expect(screen.getByTestId('forge-slot-0')).toHaveTextContent('')

    // Assemblage correct malgré la tentative ratée précédente.
    await user.click(screen.getByTestId('forge-piece-target-0'))
    advance()
    await user.click(screen.getByTestId('forge-slot-0'))
    advance()
    await user.click(screen.getByTestId('forge-piece-target-1'))
    advance()
    await user.click(screen.getByTestId('forge-slot-1'))
    advance()
    await user.click(screen.getByTestId('forge-piece-target-2'))
    advance()
    await user.click(screen.getByTestId('forge-slot-2'))

    expect(answers).toHaveLength(1)
    expect(answers[0].correct).toBe(true)

    vi.restoreAllMocks()
  })

  it('ne renvoie rien à la réserve quand aucune pièce n\'est soulevée (no-op, cohérent avec la primitive)', async () => {
    const user = userEvent.setup()
    setup()

    await user.click(screen.getByTestId('forge-slot-0'))
    expect(screen.getByTestId('forge-slot-0')).toHaveTextContent('')
  })
})

describe('assemblage complet', () => {
  it('déclenche onAnswer(correct: true) une seule fois quand tous les emplacements forment exactement la cible', async () => {
    const user = userEvent.setup()
    const { answers } = setup()

    await user.click(screen.getByTestId('forge-piece-target-0'))
    await user.click(screen.getByTestId('forge-slot-0'))
    await user.click(screen.getByTestId('forge-piece-target-1'))
    await user.click(screen.getByTestId('forge-slot-1'))
    await user.click(screen.getByTestId('forge-piece-target-2'))
    await user.click(screen.getByTestId('forge-slot-2'))

    expect(answers).toHaveLength(1)
    expect(answers[0]).toMatchObject({
      challengeId: 'challenge-forge-1',
      correct: true,
      usedHelpLevel: 0,
      usedListenAgain: false,
    })
    expect(typeof answers[0].responseMs).toBe('number')
  })

  it("n'appelle jamais onAnswer tant que l'assemblage n'est pas complet", async () => {
    const user = userEvent.setup()
    const { onAnswer } = setup()

    await user.click(screen.getByTestId('forge-piece-target-0'))
    await user.click(screen.getByTestId('forge-slot-0'))
    await user.click(screen.getByTestId('forge-piece-target-1'))
    await user.click(screen.getByTestId('forge-slot-1'))

    expect(onAnswer).not.toHaveBeenCalled()
  })

  it("ne rappelle pas onAnswer après un succès si l'enfant retouche une pièce déjà posée (verrouillage)", async () => {
    const user = userEvent.setup()
    const { answers } = setup()

    await user.click(screen.getByTestId('forge-piece-target-0'))
    await user.click(screen.getByTestId('forge-slot-0'))
    await user.click(screen.getByTestId('forge-piece-target-1'))
    await user.click(screen.getByTestId('forge-slot-1'))
    await user.click(screen.getByTestId('forge-piece-target-2'))
    await user.click(screen.getByTestId('forge-slot-2'))
    expect(answers).toHaveLength(1)

    await user.click(screen.getByTestId('forge-slot-2'))
    expect(answers).toHaveLength(1)
  })

  it('gère un mot avec des graphèmes répétés (deux pièces "p" interchangeables pour "papa")', async () => {
    const user = userEvent.setup()
    const papaTarget = makeWordItem('word-papa', 'papa', ['p', 'a', 'p', 'a'])
    const challenge: Challenge = {
      id: 'challenge-forge-papa',
      kind: 'forge',
      skillId: 'L3-fusion-cv',
      targetItemId: papaTarget.id,
      options: [{ id: 'opt-1', contentItemId: papaTarget.id, isDistractor: false }],
      isReview: false,
    }

    const speak: ChallengeSpeakFn = vi.fn(async () => {})
    const answers: Array<Omit<ChallengeResult, 'timestamp'>> = []
    const onAnswer = vi.fn((result: Omit<ChallengeResult, 'timestamp'>) => {
      answers.push(result)
    })

    render(
      <Forge
        challenge={challenge}
        helpLevel={0}
        usedListenAgain={false}
        resolveItem={(id) => (id === papaTarget.id ? papaTarget : TARGET)}
        speak={speak}
        onAnswer={onAnswer}
      />,
    )

    // 4 pièces cible, aucun distracteur (aucune option isDistractor: true).
    expect(screen.getAllByTestId(/^forge-piece-/)).toHaveLength(4)

    await user.click(screen.getByTestId('forge-piece-target-0'))
    await user.click(screen.getByTestId('forge-slot-0'))
    await user.click(screen.getByTestId('forge-piece-target-1'))
    await user.click(screen.getByTestId('forge-slot-1'))
    await user.click(screen.getByTestId('forge-piece-target-2'))
    await user.click(screen.getByTestId('forge-slot-2'))
    await user.click(screen.getByTestId('forge-piece-target-3'))
    await user.click(screen.getByTestId('forge-slot-3'))

    expect(answers).toHaveLength(1)
    expect(answers[0].correct).toBe(true)
  })
})
