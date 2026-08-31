// Gate leaf-C2 G3 : Vrai mot/faux mot classe correctement un item réel vs un
// pseudo-mot (kind='word'/'pseudoword' du corpus), sans jamais accepter un
// pseudo-mot marqué comme un mot réel.
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Challenge, ContentItem } from '../../types'
import { TrueFalseWord } from './TrueFalseWord'

afterEach(cleanup)

function makeItem(id: string, text: string, kind: ContentItem['kind'], overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id,
    kind,
    level: 7,
    text,
    graphemeIds: text.split(''),
    skillIds: ['L7-decodage'],
    ...overrides,
  }
}

const items: Record<string, ContentItem> = {
  'mot-chat': makeItem('mot-chat', 'chat', 'word', { emoji: '🐱' }),
  'pseudo-vorli': makeItem('pseudo-vorli', 'vorli', 'pseudoword'),
}

function resolveItem(id: string): ContentItem {
  const item = items[id]
  if (!item) throw new Error(`ContentItem inconnu dans le test : ${id}`)
  return item
}

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'defi-vf-1',
    kind: 'true-false-word',
    skillId: 'L7-decodage',
    targetItemId: 'mot-chat',
    options: [{ id: 'option-mot-chat', contentItemId: 'mot-chat', isDistractor: false }],
    isReview: false,
    ...overrides,
  }
}

function renderTrueFalseWord(overrides: { challenge?: Partial<Challenge>; helpLevel?: 0 | 1 | 2 | 3 } = {}) {
  const speak = vi.fn().mockResolvedValue(undefined)
  const onAnswer = vi.fn()
  const challenge = makeChallenge(overrides.challenge)
  render(
    <TrueFalseWord
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

describe('TrueFalseWord — affichage', () => {
  it('affiche le texte du seul item ciblé', () => {
    renderTrueFalseWord()
    expect(screen.getByTestId('true-false-word-text')).toHaveTextContent('chat')
  })

  it('affiche exactement 2 boutons de choix', () => {
    renderTrueFalseWord()
    expect(screen.getByTestId('true-false-word-real')).toBeInTheDocument()
    expect(screen.getByTestId('true-false-word-invented')).toBeInTheDocument()
  })

  it("n'énonce jamais la cible automatiquement (force le décodage visuel)", () => {
    const { speak } = renderTrueFalseWord()
    expect(speak).not.toHaveBeenCalled()
  })
})

describe('TrueFalseWord — classification d\'un mot réel', () => {
  it('rapporte onAnswer(correct: true) quand "ce mot existe" est touché pour un mot réel', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderTrueFalseWord()

    await user.click(screen.getByTestId('true-false-word-real'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0].correct).toBe(true)
  })

  it('rapporte onAnswer(correct: false) quand "ce mot est inventé" est touché pour un mot réel', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderTrueFalseWord()

    await user.click(screen.getByTestId('true-false-word-invented'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0].correct).toBe(false)
  })
})

describe('TrueFalseWord — classification d\'un pseudo-mot', () => {
  it('rapporte onAnswer(correct: true) quand "ce mot est inventé" est touché pour un pseudo-mot', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderTrueFalseWord({ challenge: { targetItemId: 'pseudo-vorli' } })

    await user.click(screen.getByTestId('true-false-word-invented'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0].correct).toBe(true)
  })

  it('ne rapporte JAMAIS onAnswer(correct: true) quand un pseudo-mot est marqué "ce mot existe"', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderTrueFalseWord({ challenge: { targetItemId: 'pseudo-vorli' } })

    await user.click(screen.getByTestId('true-false-word-real'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0].correct).toBe(false)
  })
})

describe('TrueFalseWord — verrouillage', () => {
  it('verrouille les boutons après une réponse correcte', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderTrueFalseWord()

    await user.click(screen.getByTestId('true-false-word-real'))
    await user.click(screen.getByTestId('true-false-word-invented'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('permet une nouvelle tentative après une réponse incorrecte', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderTrueFalseWord()

    await user.click(screen.getByTestId('true-false-word-invented'))
    await user.click(screen.getByTestId('true-false-word-real'))

    expect(onAnswer).toHaveBeenCalledTimes(2)
    expect(onAnswer.mock.calls[1][0].correct).toBe(true)
  })
})

describe('TrueFalseWord — aide graduée', () => {
  it('niveau 1 surligne le premier graphème du mot affiché', () => {
    renderTrueFalseWord({ helpLevel: 1 })
    expect(screen.getByTestId('true-false-word-highlight')).toHaveTextContent('c')
  })
})

describe('TrueFalseWord — rétroaction', () => {
  it('affiche une rétroaction de succès après une bonne réponse', async () => {
    const user = userEvent.setup()
    renderTrueFalseWord()
    await user.click(screen.getByTestId('true-false-word-real'))
    expect(screen.getByTestId('true-false-word-feedback')).toHaveAttribute('data-outcome', 'success')
  })
})
