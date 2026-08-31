import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { NarrationDriver } from './types'
import { createNarrationOrchestrator, type NarrationOrchestrator } from './orchestrator'

const NarrationContext = createContext<NarrationOrchestrator | null>(null)

export interface NarrationProviderProps {
  /**
   * L'implémentation réelle vient de la leaf A2 (`src/voice/**`), câblée par le
   * driver à l'intégration de la branche A. Voir types.ts pour le contrat exact
   * attendu de `driver.speak` / `driver.cancel`.
   */
  driver: NarrationDriver
  children: ReactNode
}

/**
 * Doit englober tout sous-arbre d'écrans du jeu. Un seul orchestrateur par
 * `driver` fourni (recréé seulement si l'identité de `driver` change).
 */
export function NarrationProvider({ driver, children }: NarrationProviderProps) {
  const orchestrator = useMemo(() => createNarrationOrchestrator(driver), [driver])
  return <NarrationContext.Provider value={orchestrator}>{children}</NarrationContext.Provider>
}

/**
 * Accès direct à l'orchestrateur, pour les rares cas hors écran (ex. un futur
 * outil d'audit qui veut inspecter l'état de la file). Les écrans doivent
 * utiliser `useScreenNarration`, pas cet accès direct.
 */
export function useNarrationOrchestrator(): NarrationOrchestrator {
  const orchestrator = useContext(NarrationContext)
  if (!orchestrator) {
    // Erreur de câblage au développement (arbre monté hors NarrationProvider),
    // jamais une situation atteignable en jeu si l'app racine englobe bien tous
    // les écrans dans <NarrationProvider> — pas le « throw visible du joueur »
    // que CLAUDE.md interdit, qui concerne les erreurs runtime en cours de jeu.
    throw new Error(
      'useNarrationOrchestrator (ou useScreenNarration) doit être utilisé sous <NarrationProvider driver={...}>.',
    )
  }
  return orchestrator
}
