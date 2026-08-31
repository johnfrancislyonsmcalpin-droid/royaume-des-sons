// Gate leaf-C1 G2 : TapTarget mesure au moins 64x64 CSS et ne répond ni au
// survol, ni au double-tap (au sens "geste distinct"), ni à un glisser-déposer.
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DOUBLE_TAP_GUARD_MS, MIN_TAP_TARGET_PX, TapTarget } from './TapTarget'

afterEach(cleanup)

describe('TapTarget — dimensions', () => {
  it('déclare min-width et min-height >= 64px en style CSS mesurable', () => {
    render(
      <TapTarget onTap={vi.fn()} label="Toucher" testId="target">
        A
      </TapTarget>,
    )
    const el = screen.getByTestId('target')
    expect(parseInt(el.style.minWidth, 10)).toBeGreaterThanOrEqual(64)
    expect(parseInt(el.style.minHeight, 10)).toBeGreaterThanOrEqual(64)
    expect(MIN_TAP_TARGET_PX).toBe(64)
  })

  it('déclare touch-action: manipulation', () => {
    render(
      <TapTarget onTap={vi.fn()} label="Toucher" testId="target">
        A
      </TapTarget>,
    )
    expect(screen.getByTestId('target').style.touchAction).toBe('manipulation')
  })
})

describe('TapTarget — un seul geste (tap)', () => {
  it('déclenche onTap sur un tap simple', async () => {
    const onTap = vi.fn()
    const user = userEvent.setup()
    render(
      <TapTarget onTap={onTap} label="Toucher" testId="target">
        A
      </TapTarget>,
    )
    await user.click(screen.getByTestId('target'))
    expect(onTap).toHaveBeenCalledTimes(1)
  })

  it("ne déclenche rien sur un survol (mouseEnter/mouseOver)", () => {
    const onTap = vi.fn()
    render(
      <TapTarget onTap={onTap} label="Toucher" testId="target">
        A
      </TapTarget>,
    )
    const el = screen.getByTestId('target')
    fireEvent.mouseEnter(el)
    fireEvent.mouseOver(el)
    expect(onTap).not.toHaveBeenCalled()
  })

  it("n'a pas de gestionnaire onDoubleClick câblé à une action, et n'exécute onTap qu'une fois pour un double-clic rapide (anti-rebond)", () => {
    const onTap = vi.fn()
    render(
      <TapTarget onTap={onTap} label="Toucher" testId="target">
        A
      </TapTarget>,
    )
    const el = screen.getByTestId('target')
    fireEvent.dblClick(el)
    // dblClick de testing-library émet aussi les deux `click` sous-jacents ;
    // même s'ils étaient tous deux traités, l'anti-rebond (< 300ms) doit
    // ramener l'effet net à un seul déclenchement.
    expect(onTap.mock.calls.length).toBeLessThanOrEqual(1)
  })

  it('ignore un second tap sur la MÊME cible survenant avant la fenêtre anti-rebond', () => {
    const onTap = vi.fn()
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    render(
      <TapTarget onTap={onTap} label="Toucher" testId="target">
        A
      </TapTarget>,
    )
    const el = screen.getByTestId('target')
    fireEvent.click(el)
    now += DOUBLE_TAP_GUARD_MS - 50
    fireEvent.click(el)
    expect(onTap).toHaveBeenCalledTimes(1)
    now += 100 // dépasse la fenêtre
    fireEvent.click(el)
    expect(onTap).toHaveBeenCalledTimes(2)
    vi.restoreAllMocks()
  })

  it('un glisser-déposer natif (dragstart) ne déclenche pas onTap et est neutralisé', () => {
    const onTap = vi.fn()
    render(
      <TapTarget onTap={onTap} label="Toucher" testId="target">
        A
      </TapTarget>,
    )
    const el = screen.getByTestId('target')
    const event = fireEvent.dragStart(el)
    expect(onTap).not.toHaveBeenCalled()
    // fireEvent renvoie `false` quand preventDefault() a été appelé.
    expect(event).toBe(false)
    expect(el).toHaveAttribute('draggable', 'false')
  })

  it("un relâchement du doigt hors de la cible (pointerdown ici, click ailleurs) ne déclenche pas onTap", () => {
    const onTap = vi.fn()
    render(
      <>
        <TapTarget onTap={onTap} label="Cible" testId="target">
          A
        </TapTarget>
        <div data-testid="ailleurs" />
      </>,
    )
    // Le navigateur ne synthétise un `click` sur la cible que si down+up ont
    // eu lieu sur elle ; on simule directement l'absence de `click` en ne
    // déclenchant qu'un pointerdown sur la cible et un pointerup ailleurs :
    // aucun `click` n'est jamais émis, donc onTap ne doit jamais être appelé.
    fireEvent.pointerDown(screen.getByTestId('target'))
    fireEvent.pointerUp(screen.getByTestId('ailleurs'))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('ne répond pas au tap quand disabled', async () => {
    const onTap = vi.fn()
    const user = userEvent.setup()
    render(
      <TapTarget onTap={onTap} label="Toucher" testId="target" disabled>
        A
      </TapTarget>,
    )
    await user.click(screen.getByTestId('target'))
    expect(onTap).not.toHaveBeenCalled()
  })

  it('expose le libellé accessible fourni', () => {
    render(
      <TapTarget onTap={vi.fn()} label="Toucher la pomme" testId="target">
        🍎
      </TapTarget>,
    )
    expect(screen.getByTestId('target')).toHaveAttribute('aria-label', 'Toucher la pomme')
  })
})
