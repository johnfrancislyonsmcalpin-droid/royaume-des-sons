// Bouton tactile local temporaire — carte du monde (leaf E1).
//
// La leaf C1 (src/challenges/shared/TapTarget.tsx) n'est pas encore livrée au
// moment où E1 est écrite (E1 et C1 sont toutes deux planifiées en vague 2,
// dispatchées en parallèle — voir PLAN.md, table de dispatch). Pour ne pas
// bloquer E1 sur une dépendance qui n'existe pas encore, ce fichier redéfinit
// localement une zone tactile ≥ 64×64 px CSS (SPEC §3), avec les mêmes
// propriétés attendues d'une cible tactile du jeu :
//   - min-width / min-height 64px, espacées d'au moins 16px par le parent
//   - touch-action: manipulation (pas de zoom double-tap)
//   - user-select: none
//   - un seul geste : tap => onPress. Pas de survol, pas de glisser-déposer,
//     pas de double-tap.
//   - `disabled` utilise l'attribut HTML natif `disabled` : un bouton
//     verrouillé ne déclenche STRICTEMENT AUCUNE action au toucher (ni
//     `onPress`, ni aucun autre effet), y compris en cas de tap répété — c'est
//     le mécanisme choisi pour satisfaire « les régions non débloquées [...]
//     ne déclenchent aucune action au toucher » (consigne E1) sans code de
//     garde ad hoc dans WorldMap.
// Le driver d'intégration devra remplacer TapButton par TapTarget partagé une
// fois C1 livrée, sans changer la signature publique de WorldMap (précédent :
// E2/TouchButton.tsx, VERIFIED, fait exactement ce même choix documenté).
//
// Accessibilité / autonomie sans lecture (SPEC §2) : le libellé (`label`) n'est
// JAMAIS affiché comme texte à l'écran — il n'existe que comme `aria-label`,
// pour un lecteur d'écran adulte. L'enfant reconnaît le bouton uniquement par
// sa forme, sa couleur et son icône (`children`), jamais par un mot écrit.

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

export interface TapButtonProps {
  /** Jamais affiché à l'écran : uniquement aria-label (lecteur d'écran adulte). */
  label: string
  onPress: () => void
  disabled?: boolean
  children?: ReactNode
  testId?: string
  className?: string
}

export function TapButton({
  label,
  onPress,
  disabled = false,
  children,
  testId,
  className,
}: TapButtonProps) {
  return (
    <button
      type="button"
      className={['tap-button', className].filter(Boolean).join(' ')}
      style={{
        ...buttonStyle,
        opacity: disabled ? 0.55 : 1,
      }}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onPress}
      data-testid={testId}
    >
      {children}
    </button>
  )
}
