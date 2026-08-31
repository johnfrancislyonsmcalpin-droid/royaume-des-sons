// Enveloppe l'écran de choix de personnage (E2, src/world/avatar/AvatarSelect.tsx),
// qui ne déclare aucune narration lui-même (délibérément découplé de
// src/narration/**, voir en-tête de la leaf E2) : la narration d'apparition
// de cet écran est donc déclarée ici, à l'intégration.
import { useScreenNarration } from '../../../narration/useScreenNarration'
import { AvatarSelect } from '../../../world/avatar/AvatarSelect'
import { uiText } from '../../../content/uiText'
import type { AvatarState } from '../../../types'

const SCREEN_ID = 'avatar-select'

export interface AvatarSelectScreenProps {
  avatar: AvatarState
  onSelect: (avatarId: string, companionId: string) => void
}

export function AvatarSelectScreen({ avatar, onSelect }: AvatarSelectScreenProps) {
  useScreenNarration(SCREEN_ID, {
    id: `${SCREEN_ID}-intro`,
    text: uiText.screens.avatarSelectIntro,
    priority: 'screen-intro',
    interruptible: true,
  })

  return (
    <AvatarSelect
      initialAvatarId={avatar.avatarId || null}
      initialCompanionId={avatar.companionId || null}
      onSelect={onSelect}
    />
  )
}
