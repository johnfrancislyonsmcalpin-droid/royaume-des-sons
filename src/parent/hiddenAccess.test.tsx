// Gate G1 (leaf-F1.md) : l'écran parent n'est atteignable qu'après un appui
// long de 3 s sur le coin supérieur gauche suivi de la résolution correcte
// d'une addition à deux chiffres générée aléatoirement.
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { generateAdditionChallenge, isCorrectAnswer, HIDDEN_ACCESS_HOLD_MS } from './access'
import { HiddenAccessGate } from './HiddenAccessGate'

afterEach(() => {
  cleanup()
})

describe('generateAdditionChallenge (moteur pur)', () => {
  it('produit deux opérandes à deux chiffres (10-99) et une réponse cohérente', () => {
    const sequence = [0, 0.999, 0.5]
    let i = 0
    const random = () => sequence[i++ % sequence.length]
    for (let n = 0; n < 20; n += 1) {
      const challenge = generateAdditionChallenge(random)
      expect(challenge.a).toBeGreaterThanOrEqual(10)
      expect(challenge.a).toBeLessThanOrEqual(99)
      expect(challenge.b).toBeGreaterThanOrEqual(10)
      expect(challenge.b).toBeLessThanOrEqual(99)
      expect(challenge.answer).toBe(challenge.a + challenge.b)
    }
  })
})

describe('isCorrectAnswer (moteur pur)', () => {
  it('accepte uniquement la bonne réponse exacte', () => {
    const challenge = { a: 27, b: 15, answer: 42 }
    expect(isCorrectAnswer(challenge, '42')).toBe(true)
    expect(isCorrectAnswer(challenge, '41')).toBe(false)
    expect(isCorrectAnswer(challenge, '')).toBe(false)
    expect(isCorrectAnswer(challenge, 'abc')).toBe(false)
    expect(isCorrectAnswer(challenge, ' 42 ')).toBe(true)
  })
})

describe('HiddenAccessGate — porte cachée (gate G1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("n'affiche rien de visible par défaut : la zone est invisible (opacity 0)", () => {
    render(<HiddenAccessGate onUnlock={vi.fn()} random={() => 0.1} />)
    const zone = screen.getByTestId('parent-hidden-zone')
    expect(zone).toHaveStyle({ opacity: '0' })
    expect(screen.queryByTestId('parent-gate-keypad')).not.toBeInTheDocument()
  })

  it('un appui de moins de 3 s ne déclenche jamais le pavé numérique', () => {
    render(<HiddenAccessGate onUnlock={vi.fn()} random={() => 0.1} />)
    const zone = screen.getByTestId('parent-hidden-zone')

    fireEvent.pointerDown(zone)
    act(() => {
      vi.advanceTimersByTime(HIDDEN_ACCESS_HOLD_MS - 1)
    })
    fireEvent.pointerUp(zone)
    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(screen.queryByTestId('parent-gate-keypad')).not.toBeInTheDocument()
  })

  it('un appui maintenu 3 s affiche le pavé numérique avec une addition à deux chiffres', () => {
    render(<HiddenAccessGate onUnlock={vi.fn()} random={() => 0.1} />)
    const zone = screen.getByTestId('parent-hidden-zone')

    fireEvent.pointerDown(zone)
    act(() => {
      vi.advanceTimersByTime(HIDDEN_ACCESS_HOLD_MS)
    })

    expect(screen.getByTestId('parent-gate-keypad')).toBeInTheDocument()
  })

  it('relâcher puis ré-appuyer redémarre le minuteur (pas de cumul entre deux appuis)', () => {
    render(<HiddenAccessGate onUnlock={vi.fn()} random={() => 0.1} />)
    const zone = screen.getByTestId('parent-hidden-zone')

    fireEvent.pointerDown(zone)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    fireEvent.pointerUp(zone)

    fireEvent.pointerDown(zone)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.queryByTestId('parent-gate-keypad')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByTestId('parent-gate-keypad')).toBeInTheDocument()
  })

  it("la bonne réponse à l'addition appelle onUnlock une seule fois et referme le pavé", () => {
    const onUnlock = vi.fn()
    // random déterministe : a = 10 + floor(0.1*90) = 19, b = 19, réponse = 38
    render(<HiddenAccessGate onUnlock={onUnlock} random={() => 0.1} />)
    const zone = screen.getByTestId('parent-hidden-zone')
    fireEvent.pointerDown(zone)
    act(() => {
      vi.advanceTimersByTime(HIDDEN_ACCESS_HOLD_MS)
    })

    fireEvent.click(screen.getByTestId('parent-gate-digit-3'))
    fireEvent.click(screen.getByTestId('parent-gate-digit-8'))
    fireEvent.click(screen.getByTestId('parent-gate-submit'))

    expect(onUnlock).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('parent-gate-keypad')).not.toBeInTheDocument()
  })

  it("une mauvaise réponse n'appelle jamais onUnlock et propose un nouvel essai", () => {
    const onUnlock = vi.fn()
    render(<HiddenAccessGate onUnlock={onUnlock} random={() => 0.1} />)
    const zone = screen.getByTestId('parent-hidden-zone')
    fireEvent.pointerDown(zone)
    act(() => {
      vi.advanceTimersByTime(HIDDEN_ACCESS_HOLD_MS)
    })

    fireEvent.click(screen.getByTestId('parent-gate-digit-1'))
    fireEvent.click(screen.getByTestId('parent-gate-submit'))

    expect(onUnlock).not.toHaveBeenCalled()
    expect(screen.getByTestId('parent-gate-keypad')).toBeInTheDocument()
    expect(screen.getByTestId('parent-gate-wrong')).toBeInTheDocument()
  })

  it('le bouton annuler referme le pavé sans appeler onUnlock', () => {
    const onUnlock = vi.fn()
    render(<HiddenAccessGate onUnlock={onUnlock} random={() => 0.1} />)
    const zone = screen.getByTestId('parent-hidden-zone')
    fireEvent.pointerDown(zone)
    act(() => {
      vi.advanceTimersByTime(HIDDEN_ACCESS_HOLD_MS)
    })

    fireEvent.click(screen.getByTestId('parent-gate-cancel'))

    expect(onUnlock).not.toHaveBeenCalled()
    expect(screen.queryByTestId('parent-gate-keypad')).not.toBeInTheDocument()
  })

  it('la zone tactile mesure au moins 64x64 px (CLAUDE.md règle #4)', () => {
    render(<HiddenAccessGate onUnlock={vi.fn()} random={() => 0.1} />)
    const zone = screen.getByTestId('parent-hidden-zone') as HTMLElement
    expect(parseInt(zone.style.minWidth, 10)).toBeGreaterThanOrEqual(64)
    expect(parseInt(zone.style.minHeight, 10)).toBeGreaterThanOrEqual(64)
  })
})
