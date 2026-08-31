// node-F N3 : le bouton "vider le cache et recharger" de l'écran parent (F1)
// déclenche bien l'invalidation du service worker versionné de F2 — la vraie
// fonction `clearCacheAndReload` de src/app/serviceWorker.ts, pas un double
// de test. src/parent/settings.test.tsx MOCK ce module (`vi.mock('../app/
// serviceWorker', ...)`) pour tester ParentSettings isolément, et
// src/app/serviceWorker.test.ts teste clearCacheAndReload isolément : aucun
// des deux ne prouve que le clic sur CE bouton précis atteint bien CETTE
// fonction précise sans mock entre les deux. Ce test-ci n'importe
// délibérément aucun mock de '../app/serviceWorker' pour combler ce vide.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { ParentSettings } from '../../src/parent/Settings'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('bouton "vider le cache et recharger" — câblage réel F1 -> F2 (node-F N3)', () => {
  it('appelle la suppression réelle de tous les caches puis recharge la page, sans aucun mock du module serviceWorker', async () => {
    const deleteCache = vi.fn().mockResolvedValue(true)
    // @ts-expect-error stub CacheStorage globale pour ce test, même technique que src/app/serviceWorker.test.ts
    globalThis.caches = { keys: vi.fn().mockResolvedValue(['royaume-des-sons-v1']), delete: deleteCache }

    const unregister = vi.fn().mockResolvedValue(true)
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) },
      configurable: true,
    })

    const reload = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { value: { ...originalLocation, reload }, configurable: true })

    render(<ParentSettings />)
    fireEvent.click(screen.getByTestId('parent-clear-cache'))

    // clearCacheAndReload est asynchrone (Promise.all interne) : laisse les
    // microtâches réelles se résoudre avant d'observer ses effets.
    await vi.waitFor(() => {
      expect(reload).toHaveBeenCalledTimes(1)
    })

    expect(deleteCache).toHaveBeenCalledWith('royaume-des-sons-v1')
    expect(unregister).toHaveBeenCalledTimes(1)

    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
    // @ts-expect-error nettoyage du stub CacheStorage global
    delete globalThis.caches
  })
})
