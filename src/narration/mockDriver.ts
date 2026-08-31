// Double de test pour NarrationDriver (voir types.ts), partagé par
// autoTrigger.test.tsx et priority.test.ts. Pas un fichier de test lui-même
// (aucune suite `describe` ici), donc non ramassé par `include` de vitest.config.ts.

import type { NarrationRequest } from '../types'
import type { NarrationDriver } from './types'

export interface ControllableMockDriver {
  driver: NarrationDriver
  /** Chaque NarrationRequest passée à `driver.speak`, dans l'ordre d'appel. */
  calls: NarrationRequest[]
  state: { cancelCallCount: number }
  /**
   * Résout l'appel `speak()` actuellement en attente, comme si l'énonciation
   * s'était terminée naturellement. Sans effet si rien n'est en attente.
   */
  resolveCurrent: () => void
}

export function createControllableMockDriver(): ControllableMockDriver {
  const calls: NarrationRequest[] = []
  const state = { cancelCallCount: 0 }
  let pendingResolve: (() => void) | null = null

  function resolveCurrent(): void {
    const resolve = pendingResolve
    pendingResolve = null
    resolve?.()
  }

  const driver: NarrationDriver = {
    speak: (request) => {
      calls.push(request)
      return new Promise<void>((resolve) => {
        pendingResolve = resolve
      })
    },
    cancel: () => {
      state.cancelCallCount++
      resolveCurrent()
    },
  }

  return { driver, calls, state, resolveCurrent }
}
