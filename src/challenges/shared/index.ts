// Point d'entrée public de la leaf C1 (primitives partagées des 6 mécaniques
// de défi). C2/C3/C4 importent depuis ce module plutôt que directement
// depuis les fichiers internes.

export type { ChallengeComponentProps, ChallengeSpeakFn } from './contract'
export { MIN_TAP_TARGET_PX, DOUBLE_TAP_GUARD_MS, TapTarget, type TapTargetProps } from './TapTarget'
export { useLiftAndPlace, type LiftAndPlaceState, type UseLiftAndPlaceResult } from './liftAndPlace'
export { ChallengeFeedback, type ChallengeFeedbackOutcome, type ChallengeFeedbackProps } from './feedback'
export {
  PostSuccessReplay,
  type PostSuccessReplayProps,
  SuccessFlow,
  type SuccessFlowProps,
} from './postSuccessReplay'
