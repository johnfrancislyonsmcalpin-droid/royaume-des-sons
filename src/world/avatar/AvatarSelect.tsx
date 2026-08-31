// Écran de choix de personnage — Le Royaume des Sons (leaf E2).
//
// Propose exactement 4 avatars et 3 compagnons magiques. Le choix n'est écrit
// dans AvatarState qu'après confirmation explicite (bouton coche) : toucher
// un avatar ou un compagnon ne fait que le sélectionner localement, jamais
// n'appelle onSelect tout seul — évite une validation accidentelle en un tap
// (SPEC §2.2 « un seul geste possible à la fois », mais un choix aussi
// définitif que le personnage mérite une confirmation explicite séparée).
//
// Cette leaf ne touche pas src/save/** (propriété de A3, en écriture
// parallèle) : le parent (écran carte / onboarding) est responsable
// d'écrire avatarId/companionId dans le SaveFile via le callback onSelect.

import { useState } from 'react'
import { AVATARS, COMPANIONS } from './avatarData'
import { AvatarGlyph, CompanionGlyph, ConfirmGlyph } from './Glyphs'
import { TouchButton } from './TouchButton'

export interface AvatarSelectProps {
  /** Sélection initiale, pour re-visiter l'écran depuis l'écran parent par exemple. */
  initialAvatarId?: string | null
  initialCompanionId?: string | null
  /** Appelé une seule fois, au moment de la confirmation, avec les deux ids choisis. */
  onSelect: (avatarId: string, companionId: string) => void
}

export function AvatarSelect({
  initialAvatarId = null,
  initialCompanionId = null,
  onSelect,
}: AvatarSelectProps) {
  const [avatarId, setAvatarId] = useState<string | null>(initialAvatarId)
  const [companionId, setCompanionId] = useState<string | null>(initialCompanionId)

  const canConfirm = avatarId !== null && companionId !== null

  function handleConfirm() {
    if (avatarId === null || companionId === null) return
    onSelect(avatarId, companionId)
  }

  return (
    <div className="avatar-select">
      <div
        role="group"
        aria-label="Choix du personnage"
        className="avatar-select__row"
        data-testid="avatar-options"
      >
        {AVATARS.map((avatar) => (
          <TouchButton
            key={avatar.id}
            label={avatar.label}
            pressed={avatarId === avatar.id}
            onPress={() => setAvatarId(avatar.id)}
            testId={avatar.id}
          >
            <AvatarGlyph avatar={avatar} />
          </TouchButton>
        ))}
      </div>

      <div
        role="group"
        aria-label="Choix du compagnon magique"
        className="avatar-select__row"
        data-testid="companion-options"
      >
        {COMPANIONS.map((companion) => (
          <TouchButton
            key={companion.id}
            label={companion.label}
            pressed={companionId === companion.id}
            onPress={() => setCompanionId(companion.id)}
            testId={companion.id}
          >
            <CompanionGlyph companion={companion} />
          </TouchButton>
        ))}
      </div>

      <TouchButton
        label="Confirmer ce personnage et ce compagnon"
        onPress={handleConfirm}
        disabled={!canConfirm}
        testId="avatar-confirm"
      >
        <ConfirmGlyph />
      </TouchButton>
    </div>
  )
}
