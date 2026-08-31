// Gates leaf-C4 : G1 (consigne + pièces mélangées), G2 ("ordre exact" —
// succès seulement sur reconstitution exacte), G3 ("melange" — tirage
// réellement aléatoire, 200 tirages).
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Challenge, ChallengeResult, ContentItem } from '../../types'
import type { ChallengeSpeakFn } from '../shared/contract'
import { Reorder } from './Reorder'
import { shuffleWords, tokenizeSentence } from './words'

afterEach(cleanup)

function makeSentenceItem(id: string, text: string): ContentItem {
  return {
    id,
    kind: 'sentence',
    level: 8,
    text,
    graphemeIds: [],
    skillIds: ['L8-phrases'],
  }
}

function makeChallenge(targetItemId: string): Challenge {
  return {
    id: 'challenge-reorder-1',
    kind: 'reorder',
    skillId: 'L8-phrases',
    targetItemId,
    options: [],
    isReview: false,
  }
}

function setup(text: string) {
  const item = makeSentenceItem('phrase-1', text)
  const challenge = makeChallenge(item.id)
  const speak: ChallengeSpeakFn = vi.fn(async () => {})
  const answers: Array<Omit<ChallengeResult, 'timestamp'>> = []
  const onAnswer = vi.fn((result: Omit<ChallengeResult, 'timestamp'>) => {
    answers.push(result)
  })

  render(
    <Reorder
      challenge={challenge}
      helpLevel={0}
      usedListenAgain={false}
      resolveItem={(id) => {
        expect(id).toBe(item.id)
        return item
      }}
      speak={speak}
      onAnswer={onAnswer}
    />,
  )

  return { item, challenge, speak, onAnswer, answers }
}

/** Tape word-N (le N-ième mot de la phrase cible, quelle que soit sa position
 * courante à l'écran) puis l'emplacement `slotIndex` — l'id de test des
 * pièces est stable (dérivé de la position d'ORIGINE), donc indépendant du
 * mélange visuel. */
async function placeWordAt(user: ReturnType<typeof userEvent.setup>, wordIndex: number, slotIndex: number) {
  await user.click(screen.getByTestId(`reorder-piece-word-${wordIndex}`))
  await user.click(screen.getByTestId(`reorder-slot-${slotIndex}`))
}

describe('Reorder — rendu initial (G1)', () => {
  it('énonce la phrase cible via speak() au chargement', () => {
    const { speak, item } = setup('Le chat dort')
    expect(speak).toHaveBeenCalledWith(item.text)
    expect(speak).toHaveBeenCalledTimes(1)
  })

  it('affiche les mots comme pièces déplaçables, une par mot de la phrase', () => {
    setup('Le chat dort')
    expect(screen.getByTestId('reorder-piece-word-0')).toBeInTheDocument()
    expect(screen.getByTestId('reorder-piece-word-1')).toBeInTheDocument()
    expect(screen.getByTestId('reorder-piece-word-2')).toBeInTheDocument()
    expect(screen.getAllByTestId(/^reorder-slot-\d+$/)).toHaveLength(3)
  })

  it("n'affiche jamais les pièces dans le bon ordre par défaut", () => {
    setup('Le petit chat dort bien')
    const pieces = screen.getAllByTestId(/^reorder-piece-word-\d+$/)
    const order = pieces.map((el) => el.getAttribute('data-testid'))
    expect(order).not.toEqual(['reorder-piece-word-0', 'reorder-piece-word-1', 'reorder-piece-word-2', 'reorder-piece-word-3', 'reorder-piece-word-4'])
  })

  it('retire la ponctuation finale pour l\'affichage de la pièce mais la conserve pour la comparaison', () => {
    setup('Le chat dort.')
    // "dort." est affiché sans le point sur la pièce...
    expect(screen.getByTestId('reorder-piece-word-2')).toHaveTextContent('dort')
    expect(screen.getByTestId('reorder-piece-word-2')).not.toHaveTextContent('dort.')
  })
})

describe('ordre exact', () => {
  it('déclenche onAnswer(correct: true) quand les mots sont posés dans l\'ordre exact de la phrase cible', async () => {
    const user = userEvent.setup()
    const { answers } = setup('Le chat dort')

    await placeWordAt(user, 0, 0)
    await placeWordAt(user, 1, 1)
    await placeWordAt(user, 2, 2)

    expect(answers).toHaveLength(1)
    expect(answers[0]).toMatchObject({ challengeId: 'challenge-reorder-1', correct: true })
  })

  it('ne déclenche jamais onAnswer(correct: true) pour une seule inversion de deux mots adjacents', async () => {
    const user = userEvent.setup()
    const { answers } = setup('Le petit chat dort bien')
    // Ordre correct : Le(0) petit(1) chat(2) dort(3) bien(4).
    // On inverse seulement chat(2) et dort(3).
    await placeWordAt(user, 0, 0)
    await placeWordAt(user, 1, 1)
    await placeWordAt(user, 3, 2) // dort avant chat
    await placeWordAt(user, 2, 3) // chat après dort
    await placeWordAt(user, 4, 4)

    expect(answers).toHaveLength(1)
    expect(answers[0].correct).toBe(false)
  })

  it('ne déclenche jamais onAnswer(correct: true) pour un ordre partiel/quelconque incorrect', async () => {
    const user = userEvent.setup()
    const { answers } = setup('Un chat noir dort')
    // Ordre correct : Un(0) chat(1) noir(2) dort(3). On pose un ordre
    // complètement mélangé.
    await placeWordAt(user, 3, 0)
    await placeWordAt(user, 1, 1)
    await placeWordAt(user, 0, 2)
    await placeWordAt(user, 2, 3)

    expect(answers).toHaveLength(1)
    expect(answers[0].correct).toBe(false)
  })

  it('gère le cas limite d\'une phrase de seulement 2 mots (aucun succès sur l\'ordre inversé)', async () => {
    const user = userEvent.setup()
    const { answers } = setup('Chat dort')

    await placeWordAt(user, 1, 0) // dort en premier
    await placeWordAt(user, 0, 1) // Chat en second

    expect(answers).toHaveLength(1)
    expect(answers[0].correct).toBe(false)
  })

  it('réussit un ordre exact pour une phrase de seulement 2 mots', async () => {
    const user = userEvent.setup()
    const { answers } = setup('Chat dort')

    await placeWordAt(user, 0, 0)
    await placeWordAt(user, 1, 1)

    expect(answers).toHaveLength(1)
    expect(answers[0].correct).toBe(true)
  })

  it('ne rappelle pas onAnswer après un succès si l\'enfant retouche une pièce déjà posée', async () => {
    const user = userEvent.setup()
    const { answers } = setup('Le chat dort')

    await placeWordAt(user, 0, 0)
    await placeWordAt(user, 1, 1)
    await placeWordAt(user, 2, 2)
    expect(answers).toHaveLength(1)

    // Une fois verrouillé (succès), les cibles sont désactivées : retoucher
    // ne doit produire aucun deuxième appel.
    await user.click(screen.getByTestId('reorder-slot-2'))
    expect(answers).toHaveLength(1)
  })

  it('un essai raté peut être corrigé (retoucher une pièce mal placée puis compléter) et déclenche un nouvel essai', async () => {
    // Chaque emplacement est retapé plusieurs fois de suite (pose, dépose,
    // repose) : on avance une horloge simulée entre chaque tap répété sur la
    // MÊME cible pour rester au-delà de la fenêtre anti-rebond de TapTarget
    // (300ms, C1 VERIFIED) — un second tap sur la même cible en deçà serait
    // légitimement ignoré comme rebond accidentel, ce n'est pas ce qu'on
    // veut exercer ici.
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const advance = () => {
      now += 350
    }
    const user = userEvent.setup()
    const { answers } = setup('Le chat dort')

    // Essai 1 : ordre incorrect.
    await placeWordAt(user, 1, 0)
    advance()
    await placeWordAt(user, 0, 1)
    advance()
    await placeWordAt(user, 2, 2)
    advance()
    expect(answers).toHaveLength(1)
    expect(answers[0].correct).toBe(false)

    // Correction : renvoyer les deux pièces mal placées à la réserve puis
    // reposer dans le bon ordre.
    await user.click(screen.getByTestId('reorder-slot-0')) // renvoie "chat" en réserve
    advance()
    await user.click(screen.getByTestId('reorder-slot-1')) // renvoie "Le" en réserve
    advance()
    await placeWordAt(user, 0, 0)
    advance()
    await placeWordAt(user, 1, 1)

    expect(answers).toHaveLength(2)
    expect(answers[1].correct).toBe(true)

    vi.restoreAllMocks()
  })
})

describe('melange', () => {
  it('sur 200 tirages, le premier mot de la phrase cible ne se retrouve jamais en première position plus de la moitié du temps', () => {
    const tokens = tokenizeSentence('Le petit chat noir dort bien')
    const draws = 200
    let firstPositionCount = 0

    for (let i = 0; i < draws; i += 1) {
      const shuffled = shuffleWords(tokens)
      if (shuffled[0].id === tokens[0].id) firstPositionCount += 1
    }

    expect(firstPositionCount).toBeLessThanOrEqual(draws / 2)
  })

  it('sur 200 tirages, ne retombe jamais exactement sur l\'ordre d\'origine de la phrase cible', () => {
    const tokens = tokenizeSentence('Chat dort')
    const draws = 200

    for (let i = 0; i < draws; i += 1) {
      const shuffled = shuffleWords(tokens)
      const isIdentity = shuffled.every((token, index) => token.id === tokens[index].id)
      expect(isIdentity).toBe(false)
    }
  })

  it('produit au moins deux permutations différentes sur 200 tirages (mélange non déterministe)', () => {
    const tokens = tokenizeSentence('Le petit chat noir dort bien')
    const seen = new Set<string>()

    for (let i = 0; i < 200; i += 1) {
      const shuffled = shuffleWords(tokens)
      seen.add(shuffled.map((token) => token.id).join(','))
    }

    expect(seen.size).toBeGreaterThan(1)
  })
})
