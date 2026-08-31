// Enveloppe le Grand Livre (E4, src/world/grandLivre/GrandLivre.tsx). Même
// convention que WorldMapScreen.tsx : narration d'apparition déclarée ici,
// callback `onAnnounce` bridgé vers l'orchestrateur réel, `resolveItem`/`speak`
// branchés sur les vrais modules de contenu et de voix.
//
// Ajoute un bouton retour vers la carte (GrandLivre.tsx n'a lui-même aucune
// affordance de sortie, voir son en-tête : « pure vue en lecture ») — sans ce
// bouton, cet écran serait une impasse (gate G3).
import { useCallback } from 'react'
import { useScreenNarration } from '../../../narration/useScreenNarration'
import { useNarrationOrchestrator } from '../../../narration/NarrationProvider'
import { GrandLivre } from '../../../world/grandLivre/GrandLivre'
import { resolveQuestItem } from '../../../world/quest/content'
import { speakChallengeText } from '../challengeSpeak'
import { BackIcon } from '../icons'
import { uiText } from '../../../content/uiText'

const SCREEN_ID = 'grand-livre'

let announceCounter = 0

export interface GrandLivreScreenProps {
  grandLivreItemIds: string[]
  onBack: () => void
}

export function GrandLivreScreen({ grandLivreItemIds, onBack }: GrandLivreScreenProps) {
  useScreenNarration(SCREEN_ID, {
    id: `${SCREEN_ID}-intro`,
    text: uiText.grandLivre.intro,
    priority: 'screen-intro',
    interruptible: true,
  })

  const orchestrator = useNarrationOrchestrator()
  const announce = useCallback(
    (text: string) => {
      announceCounter += 1
      orchestrator.submit({
        id: `grand-livre-announce-${announceCounter}`,
        text,
        priority: 'instruction',
        interruptible: true,
      })
    },
    [orchestrator],
  )

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <GrandLivre
        grandLivreItemIds={grandLivreItemIds}
        resolveItem={resolveQuestItem}
        speak={speakChallengeText}
        onAnnounce={announce}
      />
      <button
        type="button"
        data-testid="grand-livre-back"
        aria-label="Retour à la carte"
        onClick={onBack}
        style={backButtonStyle}
      >
        <BackIcon />
      </button>
    </div>
  )
}

const backButtonStyle = {
  position: 'fixed',
  left: 16,
  bottom: 16,
  minWidth: 64,
  minHeight: 64,
  borderRadius: 16,
  border: 'none',
  background: '#EAF1F8',
  touchAction: 'manipulation',
  userSelect: 'none',
  cursor: 'pointer',
} as const
