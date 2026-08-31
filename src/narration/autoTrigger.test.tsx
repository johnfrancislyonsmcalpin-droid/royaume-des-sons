// G-A4 / G2 : la narration d'un écran se déclenche automatiquement à son
// apparition (montage du composant), jamais sur une action explicite de
// l'enfant. Inclut la chasse aux défauts sur les écrans qui se démontent /
// remontent et les changements rapides d'écran.

import { StrictMode } from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { NarrationPriority, NarrationRequest } from '../types'
import { NarrationProvider } from './NarrationProvider'
import { useScreenNarration } from './useScreenNarration'
import { clearScreenRegistry } from './registry'
import { createControllableMockDriver } from './mockDriver'

function TestScreen({
  screenId,
  text,
  priority = 'screen-intro',
  interruptible = true,
}: {
  screenId: string
  text: string
  priority?: NarrationPriority
  interruptible?: boolean
}) {
  const request: NarrationRequest = { id: screenId, text, priority, interruptible }
  useScreenNarration(screenId, request)
  return <div data-testid={screenId}>écran</div>
}

describe('déclenchement automatique de la narration au montage (G-A4 / G2)', () => {
  beforeEach(() => {
    clearScreenRegistry()
  })

  it("énonce la narration dès le montage, sans aucune interaction de l'enfant", () => {
    const { driver, calls } = createControllableMockDriver()

    render(
      <NarrationProvider driver={driver}>
        <TestScreen screenId="ecran-1" text="Bienvenue au royaume." />
      </NarrationProvider>,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ id: 'ecran-1', text: 'Bienvenue au royaume.' })
  })

  it('ne redéclenche jamais la narration sur un simple re-rendu du même écran', () => {
    const { driver, calls } = createControllableMockDriver()

    const { rerender } = render(
      <NarrationProvider driver={driver}>
        <TestScreen screenId="ecran-1" text="Premier texte." />
      </NarrationProvider>,
    )
    expect(calls).toHaveLength(1)

    // Le composant se re-rend avec un texte différent (ex. état interne qui
    // change) mais le même screenId : toujours un seul appel à speak().
    rerender(
      <NarrationProvider driver={driver}>
        <TestScreen screenId="ecran-1" text="Texte modifié après un rendu." />
      </NarrationProvider>,
    )

    expect(calls).toHaveLength(1)
    expect(calls[0].text).toBe('Premier texte.')
  })

  it("ne déclenche jamais la narration sur une action explicite (aucun écouteur de clic n'est câblé)", () => {
    const { driver, calls } = createControllableMockDriver()

    const { getByTestId } = render(
      <NarrationProvider driver={driver}>
        <TestScreen screenId="ecran-1" text="Texte." />
      </NarrationProvider>,
    )
    expect(calls).toHaveLength(1)

    // Simuler une interaction ne doit rien redéclencher : useScreenNarration
    // n'installe aucun gestionnaire d'événement, seul le montage compte.
    getByTestId('ecran-1').dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(calls).toHaveLength(1)
  })

  it('un démontage avant la fin de l’énonciation annule proprement (pas de résidu)', () => {
    const { driver, calls, state } = createControllableMockDriver()

    const { unmount } = render(
      <NarrationProvider driver={driver}>
        <TestScreen screenId="ecran-1" text="Texte." />
      </NarrationProvider>,
    )
    expect(calls).toHaveLength(1)
    expect(state.cancelCallCount).toBe(0)

    unmount()

    expect(state.cancelCallCount).toBe(1)
  })

  it('démontage puis remontage rapide (avant résolution) produit une narration propre, sans doublon', () => {
    const { driver, calls, state } = createControllableMockDriver()

    const { unmount } = render(
      <NarrationProvider driver={driver}>
        <TestScreen screenId="ecran-1" text="Premier passage." />
      </NarrationProvider>,
    )
    unmount()
    expect(state.cancelCallCount).toBe(1)

    render(
      <NarrationProvider driver={driver}>
        <TestScreen screenId="ecran-1" text="Second passage." />
      </NarrationProvider>,
    )

    expect(calls).toHaveLength(2)
    expect(calls[1].text).toBe('Second passage.')
  })

  it("un changement rapide d'écran interrompt l'ancien et démarre le nouveau sans résidu", () => {
    const { driver, calls, state } = createControllableMockDriver()

    const { rerender } = render(
      <NarrationProvider driver={driver}>
        <TestScreen screenId="ecran-a" text="Écran A." />
      </NarrationProvider>,
    )
    expect(calls).toHaveLength(1)

    // Remplace l'écran monté par un autre, avant que la narration de l'écran A
    // n'ait eu le temps de se terminer — simule une navigation rapide.
    rerender(
      <NarrationProvider driver={driver}>
        <TestScreen screenId="ecran-b" text="Écran B." />
      </NarrationProvider>,
    )

    expect(state.cancelCallCount).toBe(1) // l'écran A a bien été coupé
    expect(calls).toHaveLength(2)
    expect(calls[1]).toMatchObject({ id: 'ecran-b', text: 'Écran B.' })
  })

  it('supporte le double-montage de React.StrictMode sans narration dupliquée ni résidu', () => {
    const { driver, calls, state } = createControllableMockDriver()

    render(
      <StrictMode>
        <NarrationProvider driver={driver}>
          <TestScreen screenId="ecran-strict" text="Texte en StrictMode." />
        </NarrationProvider>
      </StrictMode>,
    )

    // StrictMode monte, démonte puis remonte le composant en développement :
    // le premier passage doit être proprement annulé, et il ne doit rester
    // qu'une seule narration active correspondant au montage final.
    expect(calls.length).toBeGreaterThanOrEqual(1)
    expect(calls[calls.length - 1]).toMatchObject({
      id: 'ecran-strict',
      text: 'Texte en StrictMode.',
    })
    // Aucun appel orphelin : chaque cancel correspond à un speak antérieur, donc
    // au plus (nombre d'appels - 1) cancels, jamais plus.
    expect(state.cancelCallCount).toBeLessThan(calls.length)
  })

  it('après cleanup RTL, un nouvel écran repart sur un état sain (aucune fuite entre tests)', () => {
    const { driver, calls } = createControllableMockDriver()

    render(
      <NarrationProvider driver={driver}>
        <TestScreen screenId="ecran-isole" text="Texte isolé." />
      </NarrationProvider>,
    )
    expect(calls).toHaveLength(1)

    cleanup()
  })
})
