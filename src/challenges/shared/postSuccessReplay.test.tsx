// Gate leaf-C1 G4 : après une bonne réponse, la relecture surligne chaque
// graphème/syllabe l'un après l'autre en synchronisation avec des appels
// speak() séquencés, jamais sautée.
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ContentItem } from '../../types'
import { PostSuccessReplay, SuccessFlow } from './postSuccessReplay'

afterEach(cleanup)

function makeItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'mot-papa',
    kind: 'word',
    level: 3,
    text: 'papa',
    graphemeIds: ['p', 'a', 'p', 'a'],
    skillIds: ['L3-fusion-cv'],
    emoji: '👨',
    ...overrides,
  }
}

/** speak() contrôlable manuellement : ne résout que quand on appelle
 * resolveNext(), pour observer la synchronisation appel-par-appel. */
function createControlledSpeak() {
  const calls: string[] = []
  const resolvers: Array<() => void> = []
  const speak = vi.fn((text: string) => {
    calls.push(text)
    return new Promise<void>((resolve) => {
      resolvers.push(resolve)
    })
  })
  const resolveNext = async () => {
    const resolver = resolvers.shift()
    if (!resolver) throw new Error('Aucun appel speak() en attente à résoudre')
    await act(async () => {
      resolver()
      await Promise.resolve()
    })
  }
  return { speak, calls, resolveNext }
}

describe('PostSuccessReplay — séquençage', () => {
  it("n'énonce le graphème suivant qu'après résolution du précédent (jamais en parallèle)", async () => {
    const { speak, calls, resolveNext } = createControlledSpeak()
    render(<PostSuccessReplay item={makeItem()} speak={speak} testId="replay" />)

    expect(calls).toEqual(['p'])
    expect(screen.getByTestId('replay-grapheme-0')).toHaveAttribute('data-active', 'true')

    await resolveNext()
    expect(calls).toEqual(['p', 'a'])
    expect(screen.getByTestId('replay-grapheme-0')).toHaveAttribute('data-active', 'false')
    expect(screen.getByTestId('replay-grapheme-1')).toHaveAttribute('data-active', 'true')

    await resolveNext()
    expect(calls).toEqual(['p', 'a', 'p'])
    await resolveNext()
    expect(calls).toEqual(['p', 'a', 'p', 'a'])

    await resolveNext()
    await waitFor(() => expect(screen.getByTestId('replay').dataset.complete).toBe('true'))
  })

  it('appelle onComplete une seule fois, après le dernier graphème, jamais avant', async () => {
    const { speak, resolveNext } = createControlledSpeak()
    const onComplete = vi.fn()
    render(<PostSuccessReplay item={makeItem({ graphemeIds: ['m', 'a'] })} speak={speak} onComplete={onComplete} />)

    await resolveNext()
    expect(onComplete).not.toHaveBeenCalled()

    await resolveNext()
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
  })

  it("n'est jamais sautée : un item d'un seul graphème déclenche quand même exactement un appel speak() et complète", async () => {
    const { speak, calls, resolveNext } = createControlledSpeak()
    const onComplete = vi.fn()
    render(
      <PostSuccessReplay item={makeItem({ graphemeIds: ['a'] })} speak={speak} onComplete={onComplete} />,
    )
    expect(calls).toEqual(['a'])
    await resolveNext()
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
  })
})

describe('PostSuccessReplay — prononciation', () => {
  it('utilise resolvePronunciation quand fourni (le son, pas la lettre brute)', () => {
    const { speak, calls } = createControlledSpeak()
    const resolvePronunciation = (graphemeId: string) => (graphemeId === 'm' ? 'mmm' : graphemeId)
    render(<PostSuccessReplay item={makeItem({ graphemeIds: ['m', 'a'] })} speak={speak} resolvePronunciation={resolvePronunciation} />)
    expect(calls).toEqual(['mmm'])
  })

  it('se rabat sur le graphemeId littéral quand resolvePronunciation est absent', () => {
    const { speak, calls } = createControlledSpeak()
    render(<PostSuccessReplay item={makeItem({ graphemeIds: ['ch', 'a'] })} speak={speak} />)
    expect(calls).toEqual(['ch'])
  })
})

describe('PostSuccessReplay — affichage', () => {
  it('affiche chaque graphème (repli : le graphemeId littéral) dans son propre segment', () => {
    const { speak } = createControlledSpeak()
    render(<PostSuccessReplay item={makeItem({ graphemeIds: ['ch', 'a', 't'] })} speak={speak} />)
    expect(screen.getByTestId('replay-grapheme-0')).toHaveTextContent('ch')
    expect(screen.getByTestId('replay-grapheme-1')).toHaveTextContent('a')
    expect(screen.getByTestId('replay-grapheme-2')).toHaveTextContent('t')
  })

  it('utilise renderGrapheme pour personnaliser le libellé visuel quand fourni', () => {
    const { speak } = createControlledSpeak()
    const renderGrapheme = (graphemeId: string) => (graphemeId === 'e-muet' ? 'e' : graphemeId)
    render(
      <PostSuccessReplay
        item={makeItem({ id: 'mot-tomate', graphemeIds: ['t', 'o', 'm', 'a', 't', 'e-muet'] })}
        speak={speak}
        renderGrapheme={renderGrapheme}
      />,
    )
    expect(screen.getByTestId('replay-grapheme-5')).toHaveTextContent('e')
  })
})

describe('PostSuccessReplay — cas limite 0 graphème', () => {
  it("complète immédiatement sans appeler speak() si graphemeIds est vide", async () => {
    const { speak } = createControlledSpeak()
    const onComplete = vi.fn()
    render(<PostSuccessReplay item={makeItem({ graphemeIds: [] })} speak={speak} onComplete={onComplete} testId="replay" />)
    expect(speak).not.toHaveBeenCalled()
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(screen.getByTestId('replay').dataset.complete).toBe('true')
  })
})

describe('SuccessFlow — jamais sautée', () => {
  it('le bouton continuer reste désactivé tant que la relecture ne s\'est pas terminée, puis se réactive', async () => {
    // Mock à résolution automatique (pas de contrôle manuel ici) : ChallengeFeedback
    // ET PostSuccessReplay appellent le même `speak`, un ordre de résolution manuel
    // FIFO ne pourrait pas distinguer de façon fiable quel appel appartient à qui.
    // Ce test vérifie seulement l'état avant/après complétion, via waitFor.
    const speak = vi.fn().mockResolvedValue(undefined)
    const onContinue = vi.fn()
    const user = userEvent.setup()

    render(
      <SuccessFlow
        item={makeItem({ graphemeIds: ['m', 'a'] })}
        companionPhrase="Bravo, tu as trouvé !"
        speak={speak}
        continueLabel="Continuer"
        onContinue={onContinue}
        testId="flow"
      />,
    )

    const continueButton = screen.getByTestId('flow-continue')
    // Immédiatement après le montage, la boucle de relecture est suspendue sur
    // le premier `await speak(...)` (encore non résolu) : le bouton doit donc
    // être désactivé dès le premier rendu, pas seulement "un peu plus tard".
    expect(continueButton).toBeDisabled()
    // fireEvent (synchrone) plutôt que userEvent ici : userEvent introduit des
    // délais internes qui laisseraient le temps aux promesses `speak()` mockées
    // de se résoudre avant même que le clic ne parte, rendant ce clic anticipé
    // non probant.
    fireEvent.click(continueButton)
    expect(onContinue).not.toHaveBeenCalled()

    await waitFor(() => expect(continueButton).not.toBeDisabled())
    await user.click(continueButton)
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
