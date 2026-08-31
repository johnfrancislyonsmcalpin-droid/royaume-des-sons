// Gate leaf-C2 G1 : Écoute et touche énonce la cible via speak(), affiche 3
// ou 4 cartes issues de challenge.options, et rapporte onAnswer(correct:
// true) seulement quand la carte ciblant targetItemId est touchée.
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Challenge, ChallengeOption, ContentItem } from '../../types'
import { ListenTouch } from './ListenTouch'

afterEach(cleanup)

function makeItem(id: string, text: string, overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id,
    kind: 'syllable',
    level: 3,
    text,
    graphemeIds: text.split(''),
    skillIds: ['L3-fusion-cv'],
    ...overrides,
  }
}

const items: Record<string, ContentItem> = {
  cible: makeItem('cible', 'ma'),
  distracteur1: makeItem('distracteur1', 'pa'),
  distracteur2: makeItem('distracteur2', 'ta'),
  distracteur3: makeItem('distracteur3', 'la'),
}

function resolveItem(id: string): ContentItem {
  const item = items[id]
  if (!item) throw new Error(`ContentItem inconnu dans le test : ${id}`)
  return item
}

function makeOptions(ids: string[], targetId: string): ChallengeOption[] {
  return ids.map((id) => ({ id: `option-${id}`, contentItemId: id, isDistractor: id !== targetId }))
}

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'defi-1',
    kind: 'listen-touch',
    skillId: 'L3-fusion-cv',
    targetItemId: 'cible',
    options: makeOptions(['cible', 'distracteur1', 'distracteur2'], 'cible'),
    isReview: false,
    ...overrides,
  }
}

function renderListenTouch(overrides: { challenge?: Partial<Challenge>; helpLevel?: 0 | 1 | 2 | 3 } = {}) {
  const speak = vi.fn().mockResolvedValue(undefined)
  const onAnswer = vi.fn()
  const challenge = makeChallenge(overrides.challenge)
  render(
    <ListenTouch
      challenge={challenge}
      helpLevel={overrides.helpLevel ?? 0}
      usedListenAgain={false}
      resolveItem={resolveItem}
      speak={speak}
      onAnswer={onAnswer}
    />,
  )
  return { speak, onAnswer, challenge }
}

describe('ListenTouch — consigne vocale', () => {
  it('énonce le texte de la cible via speak() à l\'apparition du défi', () => {
    const { speak } = renderListenTouch()
    expect(speak).toHaveBeenCalledWith('ma')
  })
})

describe('ListenTouch — cartes', () => {
  it('affiche exactement une carte par option (3 options ici)', () => {
    renderListenTouch()
    expect(screen.getByTestId('listen-touch-card-option-cible')).toBeInTheDocument()
    expect(screen.getByTestId('listen-touch-card-option-distracteur1')).toBeInTheDocument()
    expect(screen.getByTestId('listen-touch-card-option-distracteur2')).toBeInTheDocument()
  })

  it('affiche 4 cartes quand challenge.options en fournit 4', () => {
    renderListenTouch({
      challenge: { options: makeOptions(['cible', 'distracteur1', 'distracteur2', 'distracteur3'], 'cible') },
    })
    expect(screen.getAllByTestId(/^listen-touch-card-/)).toHaveLength(4)
  })

  it('affiche le texte écrit de chaque ContentItem sur sa carte', () => {
    renderListenTouch()
    expect(screen.getByTestId('listen-touch-card-option-cible')).toHaveTextContent('ma')
    expect(screen.getByTestId('listen-touch-card-option-distracteur1')).toHaveTextContent('pa')
  })
})

describe('ListenTouch — réponse', () => {
  it('rapporte onAnswer(correct: true) uniquement quand la carte de la cible est touchée', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderListenTouch()

    await user.click(screen.getByTestId('listen-touch-card-option-cible'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
    const result = onAnswer.mock.calls[0][0]
    expect(result.correct).toBe(true)
    expect(result.challengeId).toBe('defi-1')
    expect(typeof result.responseMs).toBe('number')
  })

  it('rapporte onAnswer(correct: false) quand une carte distractrice est touchée', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderListenTouch()

    await user.click(screen.getByTestId('listen-touch-card-option-distracteur1'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0].correct).toBe(false)
  })

  it('permet une nouvelle tentative après une réponse incorrecte (pas de verrou)', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderListenTouch()

    await user.click(screen.getByTestId('listen-touch-card-option-distracteur1'))
    await user.click(screen.getByTestId('listen-touch-card-option-cible'))

    expect(onAnswer).toHaveBeenCalledTimes(2)
    expect(onAnswer.mock.calls[0][0].correct).toBe(false)
    expect(onAnswer.mock.calls[1][0].correct).toBe(true)
  })

  it('verrouille les cartes après une réponse correcte (une nouvelle tentative ne rappelle pas onAnswer)', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderListenTouch()

    await user.click(screen.getByTestId('listen-touch-card-option-cible'))
    expect(onAnswer).toHaveBeenCalledTimes(1)

    await user.click(screen.getByTestId('listen-touch-card-option-distracteur1'))
    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('reflète usedListenAgain et usedHelpLevel tels que fournis en props', async () => {
    const user = userEvent.setup()
    const speak = vi.fn().mockResolvedValue(undefined)
    const onAnswer = vi.fn()
    render(
      <ListenTouch
        challenge={makeChallenge()}
        helpLevel={2}
        usedListenAgain
        resolveItem={resolveItem}
        speak={speak}
        onAnswer={onAnswer}
      />,
    )
    // Niveau d'aide 2 retire une carte distractrice : il n'en reste plus que 2.
    await user.click(screen.getAllByTestId(/^listen-touch-card-/)[0])
    const result = onAnswer.mock.calls[0][0]
    expect(result.usedListenAgain).toBe(true)
    expect(result.usedHelpLevel).toBe(2)
  })
})

describe('ListenTouch — aide graduée', () => {
  it('niveau 2 retire une carte distractrice sans jamais retirer la cible', () => {
    renderListenTouch({ helpLevel: 2 })
    const cards = screen.getAllByTestId(/^listen-touch-card-/)
    expect(cards).toHaveLength(2)
    expect(screen.getByTestId('listen-touch-card-option-cible')).toBeInTheDocument()
  })

  it("niveau 1 énonce le son du premier graphème de la cible en plus de la consigne", () => {
    const { speak } = renderListenTouch({ helpLevel: 1 })
    expect(speak).toHaveBeenCalledWith('ma')
    expect(speak).toHaveBeenCalledWith('m')
  })
})

describe('ListenTouch — rétroaction', () => {
  it('affiche une rétroaction de succès (forme + phrase) après une bonne réponse', async () => {
    const user = userEvent.setup()
    renderListenTouch()
    await user.click(screen.getByTestId('listen-touch-card-option-cible'))
    expect(screen.getByTestId('listen-touch-feedback')).toHaveAttribute('data-outcome', 'success')
  })

  it("affiche une rétroaction d'échec après une mauvaise réponse", async () => {
    const user = userEvent.setup()
    renderListenTouch()
    await user.click(screen.getByTestId('listen-touch-card-option-distracteur1'))
    expect(screen.getByTestId('listen-touch-feedback')).toHaveAttribute('data-outcome', 'error')
  })
})
