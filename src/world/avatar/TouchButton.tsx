// Bouton tactile local temporaire — ASSUMPTIONS.md.
//
// La leaf C1 (src/challenges/shared/TapTarget.tsx) n'existe pas encore au
// moment où E2 est écrite (leaves parallèles, cf. dispatch table PLAN.md :
// C1 dépend de A2+A4 et est planifiée en vague 2, après E2 en vague 1). Pour
// ne pas bloquer E2 sur une dépendance inexistante, ce fichier redéfinit
// localement une zone tactile ≥ 64×64 px CSS (SPEC §3), avec les mêmes
// propriétés attendues d'une cible tactile du jeu :
//   - min-width / min-height 64px
//   - touch-action: manipulation (pas de double-tap zoom)
//   - user-select: none
//   - un seul geste : tap => onPress, pas de survol ni de glisser-déposer
// Le driver d'intégration devra remplacer TouchButton par TapTarget partagé
// une fois C1 livrée, sans changer la signature publique de AvatarSelect.

import type { CSSProperties, ReactNode } from 'react'

const MIN_TOUCH_SIZE_PX = 64

const buttonStyle: CSSProperties = {
  minWidth: MIN_TOUCH_SIZE_PX,
  minHeight: MIN_TOUCH_SIZE_PX,
  touchAction: 'manipulation',
  userSelect: 'none',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 16,
  cursor: 'pointer',
}

export interface TouchButtonProps {
  label: string
  onPress: () => void
  pressed?: boolean
  disabled?: boolean
  children?: ReactNode
  testId?: string
}

export function TouchButton({
  label,
  onPress,
  pressed = false,
  disabled = false,
  children,
  testId,
}: TouchButtonProps) {
  return (
    <button
      type="button"
      className="touch-button"
      style={{
        ...buttonStyle,
        opacity: disabled ? 0.5 : 1,
        outline: pressed ? '4px solid #2B2B2B' : 'none',
      }}
      aria-pressed={pressed}
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      data-testid={testId}
    >
      {children}
    </button>
  )
}
