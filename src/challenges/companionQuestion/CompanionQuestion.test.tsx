// Gate leaf-C2 G4 : La question du compagnon pose oralement la question
// associée au texte (TextQuestion.promptKey) et valide uniquement l'option à
// correctIndex parmi answerOptions.
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Challenge, ContentItem } from '../../types'
import { CompanionQuestion } from './CompanionQuestion'

afterEach(cleanup)

function makeTextItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'texte-1',
    kind: 'text',
    level: 10,
    text: 'Le chat dort sur le tapis.\nIl ronronne.',
    graphemeIds: ['ch', 'a', 't'],
    skillIds: ['L10-comprehension'],
    questions: [
      {
        id: 'texte-1-q1',
        promptKey: 'texte-1-q1-prompt',
        answerOptions: ['🐱', '🐶', '🐦'],
        correctIndex: 0,
      },
    ],
    ...overrides,
  }
}

function resolveItem(_id: string, item: ContentItem = makeTextItem()): ContentItem {
  return item
}

function makeChallenge(overrides: Partial<Challenge> = {}): Challenge {
  return {
    id: 'defi-question-1',
    kind: 'companion-question',
    skillId: 'L10-comprehension',
    targetItemId: 'texte-1',
    options: [],
    isReview: false,
    ...overrides,
  }
}

function renderCompanionQuestion(
  overrides: { challenge?: Partial<Challenge>; helpLevel?: 0 | 1 | 2 | 3; item?: ContentItem } = {},
) {
  const speak = vi.fn().mockResolvedValue(undefined)
  const onAnswer = vi.fn()
  const challenge = makeChallenge(overrides.challenge)
  const item = overrides.item ?? makeTextItem()
  render(
    <CompanionQuestion
      challenge={challenge}
      helpLevel={overrides.helpLevel ?? 0}
      usedListenAgain={false}
      resolveItem={(id) => resolveItem(id, item)}
      speak={speak}
      onAnswer={onAnswer}
    />,
  )
  return { speak, onAnswer, challenge, item }
}

describe('CompanionQuestion — consigne vocale', () => {
  it('énonce le texte puis la question (promptKey) à l\'apparition du défi', async () => {
    const { speak } = renderCompanionQuestion()
    await waitFor(() => expect(speak).toHaveBeenCalledWith('texte-1-q1-prompt'))
    expect(speak).toHaveBeenNthCalledWith(1, 'Le chat dort sur le tapis.\nIl ronronne.')
    expect(speak).toHaveBeenNthCalledWith(2, 'texte-1-q1-prompt')
  })
})

describe('CompanionQuestion — réponses', () => {
  it('affiche une réponse par answerOptions de la question', () => {
    renderCompanionQuestion()
    expect(screen.getByTestId('companion-question-answer-0')).toHaveTextContent('🐱')
    expect(screen.getByTestId('companion-question-answer-1')).toHaveTextContent('🐶')
    expect(screen.getByTestId('companion-question-answer-2')).toHaveTextContent('🐦')
  })

  it('rapporte onAnswer(correct: true) uniquement quand l\'option à correctIndex est touchée', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderCompanionQuestion()

    await user.click(screen.getByTestId('companion-question-answer-0'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0].correct).toBe(true)
  })

  it('rapporte onAnswer(correct: false) quand une option autre que correctIndex est touchée', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderCompanionQuestion()

    await user.click(screen.getByTestId('companion-question-answer-1'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0].correct).toBe(false)
  })

  it('valide un correctIndex différent de 0 correctement', async () => {
    const user = userEvent.setup()
    const item = makeTextItem({
      questions: [
        { id: 'texte-1-q2', promptKey: 'texte-1-q2-prompt', answerOptions: ['🐱', '🐶', '🐦'], correctIndex: 2 },
      ],
    })
    const { onAnswer } = renderCompanionQuestion({ item })

    await user.click(screen.getByTestId('companion-question-answer-2'))

    expect(onAnswer.mock.calls[0][0].correct).toBe(true)
  })

  it('verrouille les réponses après une réponse correcte', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderCompanionQuestion()

    await user.click(screen.getByTestId('companion-question-answer-0'))
    await user.click(screen.getByTestId('companion-question-answer-1'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
  })

  it('permet une nouvelle tentative après une réponse incorrecte', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderCompanionQuestion()

    await user.click(screen.getByTestId('companion-question-answer-1'))
    await user.click(screen.getByTestId('companion-question-answer-0'))

    expect(onAnswer).toHaveBeenCalledTimes(2)
    expect(onAnswer.mock.calls[1][0].correct).toBe(true)
  })
})

describe('CompanionQuestion — aide graduée', () => {
  it('niveau 2 retire une réponse incorrecte sans jamais retirer la bonne', () => {
    renderCompanionQuestion({ helpLevel: 2 })
    const answers = screen.getAllByTestId(/^companion-question-answer-/)
    expect(answers).toHaveLength(2)
    expect(screen.getByTestId('companion-question-answer-0')).toBeInTheDocument()
  })
})

describe('CompanionQuestion — rétroaction', () => {
  it('affiche une rétroaction de succès après une bonne réponse', async () => {
    const user = userEvent.setup()
    renderCompanionQuestion()
    await user.click(screen.getByTestId('companion-question-answer-0'))
    expect(screen.getByTestId('companion-question-feedback')).toHaveAttribute('data-outcome', 'success')
  })
})

describe('CompanionQuestion — cas limite sans question', () => {
  it('ne plante jamais si le texte ciblé n\'a aucune question', () => {
    const item = makeTextItem({ questions: [] })
    expect(() => renderCompanionQuestion({ item })).not.toThrow()
  })
})
