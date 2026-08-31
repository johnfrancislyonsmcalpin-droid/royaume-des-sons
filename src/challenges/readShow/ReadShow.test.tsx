// Gate leaf-C2 G2 : Lis et montre affiche le mot/la phrase écrite en grand et
// 3 images (emoji) parmi lesquelles une seule correspond au ContentItem
// cible.
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Challenge, ChallengeOption, ContentItem } from '../../types'
import { ReadShow } from './ReadShow'

afterEach(cleanup)

function makeWord(id: string, text: string, emoji: string, overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id,
    kind: 'word',
    level: 4,
    text,
    graphemeIds: text.split(''),
    emoji,
    skillIds: ['L4-mots-simples'],
    ...overrides,
  }
}

const items: Record<string, ContentItem> = {
  chat: makeWord('chat', 'chat', '🐱'),
  lit: makeWord('lit', 'lit', '🛏️'),
  pot: makeWord('pot', 'pot', '🍯'),
  nid: makeWord('nid', 'nid', '🪺'),
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
    id: 'defi-lecture-1',
    kind: 'read-show',
    skillId: 'L4-mots-simples',
    targetItemId: 'chat',
    options: makeOptions(['chat', 'lit', 'pot'], 'chat'),
    isReview: false,
    ...overrides,
  }
}

function renderReadShow(overrides: { challenge?: Partial<Challenge>; helpLevel?: 0 | 1 | 2 | 3 } = {}) {
  const speak = vi.fn().mockResolvedValue(undefined)
  const onAnswer = vi.fn()
  const challenge = makeChallenge(overrides.challenge)
  render(
    <ReadShow
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

describe('ReadShow — mot écrit', () => {
  it('affiche le texte de la cible en grand', () => {
    renderReadShow()
    expect(screen.getByTestId('read-show-text')).toHaveTextContent('chat')
  })

  it("n'énonce jamais la cible automatiquement (la lecture doit rester visuelle)", () => {
    const { speak } = renderReadShow()
    expect(speak).not.toHaveBeenCalled()
  })
})

describe('ReadShow — images', () => {
  it('affiche exactement 3 images pour 3 options', () => {
    renderReadShow()
    expect(screen.getAllByTestId(/^read-show-image-/)).toHaveLength(3)
  })

  it("affiche l'emoji de chaque ContentItem d'option", () => {
    renderReadShow()
    expect(screen.getByTestId('read-show-image-option-chat')).toHaveTextContent('🐱')
    expect(screen.getByTestId('read-show-image-option-lit')).toHaveTextContent('🛏️')
    expect(screen.getByTestId('read-show-image-option-pot')).toHaveTextContent('🍯')
  })

  it('affiche 4 images quand challenge.options en fournit 4', () => {
    renderReadShow({ challenge: { options: makeOptions(['chat', 'lit', 'pot', 'nid'], 'chat') } })
    expect(screen.getAllByTestId(/^read-show-image-/)).toHaveLength(4)
  })
})

describe('ReadShow — réponse', () => {
  it("rapporte onAnswer(correct: true) seulement quand l'image de la cible est touchée", async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderReadShow()

    await user.click(screen.getByTestId('read-show-image-option-chat'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0].correct).toBe(true)
  })

  it('rapporte onAnswer(correct: false) quand une image distractrice est touchée', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderReadShow()

    await user.click(screen.getByTestId('read-show-image-option-lit'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
    expect(onAnswer.mock.calls[0][0].correct).toBe(false)
  })

  it('verrouille les images après une réponse correcte', async () => {
    const user = userEvent.setup()
    const { onAnswer } = renderReadShow()

    await user.click(screen.getByTestId('read-show-image-option-chat'))
    await user.click(screen.getByTestId('read-show-image-option-lit'))

    expect(onAnswer).toHaveBeenCalledTimes(1)
  })
})

describe('ReadShow — aide graduée', () => {
  it('niveau 1 surligne le premier graphème du mot affiché', () => {
    renderReadShow({ helpLevel: 1 })
    expect(screen.getByTestId('read-show-highlight')).toHaveTextContent('c')
  })

  it('niveau 2 retire une image distractrice sans jamais retirer la cible', () => {
    renderReadShow({ helpLevel: 2 })
    const images = screen.getAllByTestId(/^read-show-image-/)
    expect(images).toHaveLength(2)
    expect(screen.getByTestId('read-show-image-option-chat')).toBeInTheDocument()
  })
})

describe('ReadShow — rétroaction', () => {
  it('affiche une rétroaction de succès après une bonne réponse', async () => {
    const user = userEvent.setup()
    renderReadShow()
    await user.click(screen.getByTestId('read-show-image-option-chat'))
    expect(screen.getByTestId('read-show-feedback')).toHaveAttribute('data-outcome', 'success')
  })
})
