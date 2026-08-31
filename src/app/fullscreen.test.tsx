// Gate leaf-A1 G3 : public/manifest.webmanifest déclare display: standalone ;
// en mode navigateur (non standalone), le premier geste utilisateur déclenche
// requestFullscreen.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, renderHook } from '@testing-library/react'
import { AppShell } from './AppShell'
import {
  isStandaloneDisplayMode,
  useFullscreenOnFirstGesture,
} from './useFullscreenOnFirstGesture'
// Import brut via Vite plutôt que node:fs : évite toute dépendance aux types
// Node (non inclus dans tsconfig.app.json, dont ce fichier de test fait
// partie) tout en lisant le contenu réel du fichier livré.
import manifestRaw from '../../public/manifest.webmanifest?raw'

function mockMatchMedia(matchesStandalone: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(display-mode: standalone)' ? matchesStandalone : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('public/manifest.webmanifest', () => {
  it('déclare display: standalone', () => {
    const manifest = JSON.parse(manifestRaw)
    expect(manifest.display).toBe('standalone')
  })
})

describe('isStandaloneDisplayMode', () => {
  it('renvoie true quand (display-mode: standalone) correspond', () => {
    mockMatchMedia(true)
    expect(isStandaloneDisplayMode()).toBe(true)
  })

  it('renvoie false hors mode standalone', () => {
    mockMatchMedia(false)
    expect(isStandaloneDisplayMode()).toBe(false)
  })
})

describe('useFullscreenOnFirstGesture', () => {
  beforeEach(() => {
    mockMatchMedia(false)
  })

  it("déclenche requestFullscreen sur le premier geste hors mode standalone", () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const target = document.createElement('div')
    Object.defineProperty(target, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true,
    })
    const ref = { current: target }

    const { result } = renderHook(() => useFullscreenOnFirstGesture(ref))
    result.current()

    expect(requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it('ne déclenche pas requestFullscreen une seconde fois sur un geste suivant', () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const target = document.createElement('div')
    Object.defineProperty(target, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true,
    })
    const ref = { current: target }

    const { result } = renderHook(() => useFullscreenOnFirstGesture(ref))
    result.current()
    result.current()
    result.current()

    expect(requestFullscreen).toHaveBeenCalledTimes(1)
  })

  it('ne déclenche pas requestFullscreen quand l’app est déjà en mode standalone', () => {
    mockMatchMedia(true)
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    const target = document.createElement('div')
    Object.defineProperty(target, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true,
    })
    const ref = { current: target }

    const { result } = renderHook(() => useFullscreenOnFirstGesture(ref))
    result.current()

    expect(requestFullscreen).not.toHaveBeenCalled()
  })

  it("ne plante pas si requestFullscreen n'existe pas sur le navigateur", () => {
    const target = document.createElement('div')
    const ref = { current: target }

    const { result } = renderHook(() => useFullscreenOnFirstGesture(ref))
    expect(() => result.current()).not.toThrow()
  })

  it('ne plante pas si le navigateur refuse la demande de plein écran (Promise rejetée)', async () => {
    const requestFullscreen = vi.fn().mockRejectedValue(new Error('refusé'))
    const target = document.createElement('div')
    Object.defineProperty(target, 'requestFullscreen', {
      value: requestFullscreen,
      configurable: true,
    })
    const ref = { current: target }

    const { result } = renderHook(() => useFullscreenOnFirstGesture(ref))
    expect(() => result.current()).not.toThrow()
    // Laisse la microtâche de rejet se résoudre sans qu'aucune exception non
    // gérée ne remonte.
    await Promise.resolve()
    await Promise.resolve()
  })
})

describe('AppShell — intégration plein écran', () => {
  it('déclenche requestFullscreen au premier pointerdown sur la racine, hors mode standalone', () => {
    mockMatchMedia(false)
    // jsdom n'implémente pas requestFullscreen : on l'ajoute au prototype
    // pour ce seul test, puis on le retire (voir nettoyage plus bas).
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    HTMLElement.prototype.requestFullscreen = requestFullscreen

    const { container } = render(<AppShell />)
    const root = container.querySelector('.app-shell') as HTMLElement

    fireEvent.pointerDown(root)

    expect(requestFullscreen).toHaveBeenCalledTimes(1)

    // @ts-expect-error nettoyage du prototype global modifié pour le test
    delete HTMLElement.prototype.requestFullscreen
  })

  it('ne déclenche pas requestFullscreen si déjà en mode standalone', () => {
    mockMatchMedia(true)
    const requestFullscreen = vi.fn().mockResolvedValue(undefined)
    HTMLElement.prototype.requestFullscreen = requestFullscreen

    const { container } = render(<AppShell />)
    const root = container.querySelector('.app-shell') as HTMLElement

    fireEvent.pointerDown(root)

    expect(requestFullscreen).not.toHaveBeenCalled()

    // @ts-expect-error nettoyage du prototype global modifié pour le test
    delete HTMLElement.prototype.requestFullscreen
  })
})
