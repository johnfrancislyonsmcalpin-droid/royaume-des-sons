// Point d'entrée public de la leaf E3 (moteur de quête). Les écrans/leaves
// appelants (F1, pas encore livré) importent depuis ce module plutôt que
// directement depuis les fichiers internes.

export { assembleQuest, REGULAR_QUEST_SIZE, BOSS_QUEST_SIZE, DISTRACTOR_COUNT } from './questAssembly'
export { pickChallengeKind } from './challengeKind'
export { CHALLENGE_COMPONENTS } from './challengeComponents'
export { QuestRunner, type QuestRunnerProps } from './QuestRunner'
export { useQuestSession, type UseQuestSessionArgs, type UseQuestSessionResult } from './useQuestSession'
export { startQuest, resumeQuestState, completeQuest, type CompleteQuestResult } from './questLifecycle'
export { canStartBossQuest } from './bossGate'
export { shouldProposePause, crossedPauseThreshold, PAUSE_PROMPT_INTERVAL_MINUTES } from './sessionPause'
export {
  buildSyntheticGraphemeItems,
  syntheticGraphemeItems,
  questContentPool,
  resolveQuestItem,
  SYNTHETIC_GRAPHEME_ID_PREFIX,
} from './content'
