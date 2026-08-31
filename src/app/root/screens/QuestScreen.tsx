// Enveloppe le moteur de quête (E3, src/world/quest/QuestRunner.tsx /
// useQuestSession.ts). Câble `resolveItem`/`speak` sur les vrais modules de
// contenu et de voix (jamais un mock, cf. gate G5) et déclare la narration
// d'apparition de l'écran (E3 n'importe volontairement jamais
// src/narration/**, voir en-tête de useQuestSession.ts).
import { useEffect } from 'react'
import { useScreenNarration } from '../../../narration/useScreenNarration'
import { QuestRunner } from '../../../world/quest/QuestRunner'
import { resolveQuestItem } from '../../../world/quest/content'
import { speakChallengeText } from '../challengeSpeak'
import { uiText } from '../../../content/uiText'
import type { MasteryState, QuestState, ReviewQueueItem } from '../../../types'
import type { VaChercherUnGrandEvent } from '../../../engine/help'

const SCREEN_ID = 'quest'

export interface QuestScreenProps {
  questState: QuestState | null
  level: number
  mastery: MasteryState
  reviewQueue: ReviewQueueItem[]
  questsPlayed: number
  onQuestStateChange: (next: QuestState) => void
  onMasteryChange: (next: MasteryState) => void
  onReviewQueueChange: (next: ReviewQueueItem[]) => void
  onVaChercherUnGrand: (event: VaChercherUnGrandEvent) => void
  onQuestComplete: (finalQuestState: QuestState) => void
  /** Défense en profondeur (chasse aux défauts, passe 3) : appelée si cet
   * écran est affiché sans QuestState actif (ex. réinitialisation de la
   * sauvegarde depuis l'écran parent pendant qu'une quête était affichée).
   * Jamais un écran de défi vide montré à l'enfant (gate G3) : retour
   * immédiat, silencieux, à la carte du monde. */
  onOrphan: () => void
}

export function QuestScreen({
  questState,
  level,
  mastery,
  reviewQueue,
  questsPlayed,
  onQuestStateChange,
  onMasteryChange,
  onReviewQueueChange,
  onVaChercherUnGrand,
  onQuestComplete,
  onOrphan,
}: QuestScreenProps) {
  useScreenNarration(SCREEN_ID, {
    id: `${SCREEN_ID}-intro`,
    text: uiText.screens.questIntro,
    priority: 'screen-intro',
    interruptible: true,
  })

  useEffect(() => {
    if (!questState) onOrphan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questState])

  if (!questState) return null

  return (
    <QuestRunner
      questState={questState}
      level={level}
      mastery={mastery}
      reviewQueue={reviewQueue}
      questsPlayed={questsPlayed}
      resolveItem={resolveQuestItem}
      speak={speakChallengeText}
      onQuestStateChange={onQuestStateChange}
      onMasteryChange={onMasteryChange}
      onReviewQueueChange={onReviewQueueChange}
      onVaChercherUnGrand={onVaChercherUnGrand}
      onQuestComplete={onQuestComplete}
    />
  )
}
