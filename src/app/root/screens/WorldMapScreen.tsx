// Enveloppe la carte du monde (E1, src/world/map/WorldMap.tsx).
//
// WorldMap déclare volontairement ne jamais importer src/narration/**
// directement (voir son en-tête) et expose à la place un callback texte brut
// `onAnnounce?: (text: string) => void` pour ses annonces DYNAMIQUES (région
// touchée, liste de quêtes ouverte, quête touchée) — distinctes de la
// narration d'apparition de l'écran lui-même (déclarée ci-dessous via
// useScreenNarration, seule inscrite au registre d'audit G-A4). Le pont entre
// ce callback et l'orchestrateur réel (A4) est le rôle propre de
// l'intégrateur, exactement comme pour narrationDriver.ts / challengeSpeak.ts.
//
// Défaut comblé ici (chasse aux défauts, passe 3 — « écran orphelin ni
// impasse », gate G3) : ni WorldMap ni aucune autre pièce livrée n'offre de
// chemin vers l'écran Grand Livre (E4) : sans le bouton ajouté ici, cet écran
// serait inatteignable dans le jeu composé.
import { useCallback } from 'react'
import { useScreenNarration } from '../../../narration/useScreenNarration'
import { useNarrationOrchestrator } from '../../../narration/NarrationProvider'
import { WorldMap } from '../../../world/map/WorldMap'
import type { ProgressState } from '../../../types'
import { BookIcon } from '../icons'
import { uiText } from '../../../content/uiText'

const SCREEN_ID = 'world-map'

let announceCounter = 0

export interface WorldMapScreenProps {
  progress: ProgressState
  onSelectQuest: (regionId: string, questId: string) => void
  onOpenGrandLivre: () => void
}

export function WorldMapScreen({ progress, onSelectQuest, onOpenGrandLivre }: WorldMapScreenProps) {
  useScreenNarration(SCREEN_ID, {
    id: `${SCREEN_ID}-intro`,
    text: uiText.map.overview,
    priority: 'screen-intro',
    interruptible: true,
  })

  const orchestrator = useNarrationOrchestrator()
  const announce = useCallback(
    (text: string) => {
      announceCounter += 1
      orchestrator.submit({
        id: `world-map-announce-${announceCounter}`,
        text,
        priority: 'instruction',
        interruptible: true,
      })
    },
    [orchestrator],
  )

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <WorldMap progress={progress} onAnnounce={announce} onSelectQuest={onSelectQuest} />
      <button
        type="button"
        data-testid="open-grand-livre"
        aria-label="Ouvrir le Grand Livre"
        onClick={onOpenGrandLivre}
        style={openGrandLivreStyle}
      >
        <BookIcon />
      </button>
    </div>
  )
}

const openGrandLivreStyle = {
  position: 'fixed',
  right: 16,
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
