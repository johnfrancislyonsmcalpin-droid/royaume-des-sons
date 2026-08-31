// Table de dispatch ChallengeKind -> composant de mécanique (tâche E3,
// « Tu dois créer une table ChallengeKind -> Component »). Les 6 composants
// (C1-C4, VERIFIED) implémentent tous `ChallengeComponentProps` TEL QUEL
// (contract.ts) : aucune adaptation de props nécessaire ici.
import type { ComponentType } from 'react'
import type { ChallengeKind } from '../../types'
import type { ChallengeComponentProps } from '../../challenges/shared/contract'
import { ListenTouch } from '../../challenges/listenTouch/ListenTouch'
import { Forge } from '../../challenges/forge/Forge'
import { ReadShow } from '../../challenges/readShow/ReadShow'
import { TrueFalseWord } from '../../challenges/trueFalseWord/TrueFalseWord'
import { Reorder } from '../../challenges/reorder/Reorder'
import { CompanionQuestion } from '../../challenges/companionQuestion/CompanionQuestion'

export const CHALLENGE_COMPONENTS: Record<ChallengeKind, ComponentType<ChallengeComponentProps>> = {
  'listen-touch': ListenTouch,
  forge: Forge,
  'read-show': ReadShow,
  'true-false-word': TrueFalseWord,
  reorder: Reorder,
  'companion-question': CompanionQuestion,
}
