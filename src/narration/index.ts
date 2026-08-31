// Point d'entrée public de la leaf A4 (système de narration d'écran).

export type { SpeakFn, NarrationDriver, ScreenNarrationViolation } from './types'
export { priorityRank, isHigherPriority } from './priority'
export {
  registerScreen,
  unregisterScreen,
  getRegisteredScreenIds,
  clearScreenRegistry,
  verifyScreenNarration,
} from './registry'
export {
  createNarrationOrchestrator,
  type NarrationOrchestrator,
  type NarrationOrchestratorSnapshot,
} from './orchestrator'
export { NarrationProvider, useNarrationOrchestrator, type NarrationProviderProps } from './NarrationProvider'
export { useScreenNarration } from './useScreenNarration'
