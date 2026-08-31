// Gates leaf-F2:G2/G3 : l'écran énonce une phrase test via speak() et attend
// une confirmation adulte avant de continuer (G2) ; si aucune voix fr-*
// n'est disponible, une page d'explication adulte s'affiche avec la marche à
// suivre Android (G3, groupe "aucune voix" ci-dessous).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ScreenNavigatorApi } from '../ScreenNavigator'
import { resetVoiceCheckForTests, hasCompletedVoiceCheck } from './storage'

const primeVoice = vi.fn()
const speak = vi.fn()
const cancelAll = vi.fn()
const getMuteState = vi.fn(() => false)
let muteListener: ((muted: boolean) => void) | undefined
const subscribeMuteState = vi.fn((listener: (muted: boolean) => void) => {
  muteListener = listener
  return vi.fn()
})

vi.mock('../../voice', () => ({
  primeVoice: (...args: unknown[]) => primeVoice(...args),
  speak: (...args: unknown[]) => speak(...args),
  cancelAll: (...args: unknown[]) => cancelAll(...args),
  getMuteState: () => getMuteState(),
  subscribeMuteState: (listener: (muted: boolean) => void) => subscribeMuteState(listener),
  isPrimed: () => true,
}))

// Importé après le mock : ce module lit `getMuteState()` dès le rendu
// initial (état React initial calculé paresseusement).
const { VoiceCheckScreen, VOICE_CHECK_SCREEN_ID, shouldShowVoiceCheck } = await import('./VoiceCheckScreen')

function makeApi(overrides: Partial<ScreenNavigatorApi> = {}): ScreenNavigatorApi {
  return { currentScreenId: VOICE_CHECK_SCREEN_ID, navigate: vi.fn(), ...overrides }
}

beforeEach(() => {
  resetVoiceCheckForTests()
  primeVoice.mockClear()
  speak.mockClear()
  cancelAll.mockClear()
  getMuteState.mockReturnValue(false)
  subscribeMuteState.mockClear()
  muteListener = undefined
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('VoiceCheckScreen — test de la voix (gate G2)', () => {
  it("affiche un bouton d'écoute au départ quand une voix est potentiellement disponible", () => {
    render(<VoiceCheckScreen {...makeApi()} />)
    expect(screen.getByTestId('voice-check-start')).toBeInTheDocument()
  })

  it("amorce la voix et énonce une phrase test via speak() au toucher du bouton d'écoute", () => {
    render(<VoiceCheckScreen {...makeApi()} />)
    fireEvent.click(screen.getByTestId('voice-check-start'))

    expect(primeVoice).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledTimes(1)
    const request = speak.mock.calls[0][0]
    expect(typeof request.text).toBe('string')
    expect(request.text.length).toBeGreaterThan(0)
  })

  it("propose les deux boutons de confirmation (j'entends / je n'entends pas) après le test", () => {
    render(<VoiceCheckScreen {...makeApi()} />)
    fireEvent.click(screen.getByTestId('voice-check-start'))

    expect(screen.getByTestId('voice-check-heard')).toBeInTheDocument()
    expect(screen.getByTestId('voice-check-not-heard')).toBeInTheDocument()
  })

  it("« j'entends » marque la vérification comme faite et navigue vers l'écran « play »", () => {
    const navigate = vi.fn()
    render(<VoiceCheckScreen {...makeApi({ navigate })} />)
    fireEvent.click(screen.getByTestId('voice-check-start'))
    fireEvent.click(screen.getByTestId('voice-check-heard'))

    expect(navigate).toHaveBeenCalledWith('play')
    expect(hasCompletedVoiceCheck()).toBe(true)
  })

  it('une confirmation accidentellement double ne navigue qu’une seule fois (anti double-confirmation)', () => {
    const navigate = vi.fn()
    render(<VoiceCheckScreen {...makeApi({ navigate })} />)
    fireEvent.click(screen.getByTestId('voice-check-start'))
    fireEvent.click(screen.getByTestId('voice-check-heard'))
    fireEvent.click(screen.getByTestId('voice-check-heard'))

    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it("« je n'entends pas » bascule vers l'écran d'explication adulte", () => {
    render(<VoiceCheckScreen {...makeApi()} />)
    fireEvent.click(screen.getByTestId('voice-check-start'))
    fireEvent.click(screen.getByTestId('voice-check-not-heard'))

    expect(screen.getByTestId('voice-check-retry')).toBeInTheDocument()
    expect(screen.getByTestId('voice-check-continue-anyway')).toBeInTheDocument()
  })

  it('« réécouter » relance speak() sans changer de mode', () => {
    render(<VoiceCheckScreen {...makeApi()} />)
    fireEvent.click(screen.getByTestId('voice-check-start'))
    fireEvent.click(screen.getByTestId('voice-check-repeat'))

    expect(speak).toHaveBeenCalledTimes(2)
    expect(screen.getByTestId('voice-check-heard')).toBeInTheDocument()
  })

  it('si speak() échoue pendant le test (état muet notifié après coup), bascule automatiquement vers l’explication', () => {
    render(<VoiceCheckScreen {...makeApi()} />)
    fireEvent.click(screen.getByTestId('voice-check-start'))
    expect(screen.getByTestId('voice-check-heard')).toBeInTheDocument()

    // Simule l'échec asynchrone (deux échecs consécutifs de onstart, voir
    // src/voice/queue.ts) notifié après le clic, via le abonnement pris au
    // montage.
    expect(muteListener).toBeDefined()
    act(() => {
      muteListener?.(true)
    })

    expect(screen.getByTestId('voice-check-retry')).toBeInTheDocument()
  })

  it('annule tout énoncé résiduel au démontage (changement d’écran)', () => {
    const { unmount } = render(<VoiceCheckScreen {...makeApi()} />)
    unmount()
    expect(cancelAll).toHaveBeenCalledTimes(1)
  })
})

describe('aucune voix', () => {
  it("affiche directement l'écran d'explication quand l'état muet est déjà actif au montage (aucune voix fr-* disponible)", () => {
    getMuteState.mockReturnValue(true)
    render(<VoiceCheckScreen {...makeApi()} />)

    expect(screen.getByTestId('voice-check-retry')).toBeInTheDocument()
    expect(screen.getByTestId('voice-check-continue-anyway')).toBeInTheDocument()
    expect(screen.queryByTestId('voice-check-start')).not.toBeInTheDocument()
  })

  it("l'explication mentionne la marche à suivre Android (Paramètres > Système > Langues > Synthèse vocale > Google Text-to-Speech > pack français)", () => {
    getMuteState.mockReturnValue(true)
    const { container } = render(<VoiceCheckScreen {...makeApi()} />)
    const text = container.textContent ?? ''

    expect(text).toMatch(/Paramètres/)
    expect(text).toMatch(/Système/)
    expect(text).toMatch(/Langues/)
    expect(text).toMatch(/Synthèse vocale/)
    expect(text).toMatch(/Google Text-to-Speech/)
    expect(text).toMatch(/données vocales du français/)
  })

  it("« continuer quand même » ne bloque jamais l'accès au jeu : marque la vérification faite et navigue vers « play »", () => {
    getMuteState.mockReturnValue(true)
    const navigate = vi.fn()
    render(<VoiceCheckScreen {...makeApi({ navigate })} />)

    fireEvent.click(screen.getByTestId('voice-check-continue-anyway'))

    expect(navigate).toHaveBeenCalledWith('play')
    expect(hasCompletedVoiceCheck()).toBe(true)
  })

  it('« réessayer après installation » recharge la page plutôt que de simplement changer d’état local (la sélection de voix n’est résolue qu’une fois par instance du moteur)', () => {
    getMuteState.mockReturnValue(true)
    render(<VoiceCheckScreen {...makeApi()} />)

    const reload = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: { ...originalLocation, reload }, configurable: true })

    fireEvent.click(screen.getByTestId('voice-check-retry'))

    expect(reload).toHaveBeenCalledTimes(1)
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
  })
})

describe('shouldShowVoiceCheck', () => {
  it('renvoie true tant que la vérification n’a jamais été complétée', () => {
    resetVoiceCheckForTests()
    expect(shouldShowVoiceCheck()).toBe(true)
  })

  it('renvoie false une fois la vérification complétée', () => {
    const navigate = vi.fn()
    render(<VoiceCheckScreen {...makeApi({ navigate })} />)
    fireEvent.click(screen.getByTestId('voice-check-start'))
    fireEvent.click(screen.getByTestId('voice-check-heard'))

    expect(shouldShowVoiceCheck()).toBe(false)
  })
})
