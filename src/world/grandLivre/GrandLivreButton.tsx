// Bouton tactile local temporaire — Grand Livre (leaf E4).
//
// La leaf C1 (src/challenges/shared/TapTarget.tsx) est en cours en parallèle
// et n'est pas dans le périmètre accessible à E4 (OWNS: src/world/grandLivre/**
// uniquement). Même précédent déjà appliqué et VERIFIED par E1
// (src/world/map/TapButton.tsx) et E2 (src/world/avatar/TouchButton.tsx) :
// ce fichier redéfinit localement une zone tactile ≥ 64×64 px CSS (SPEC §3),
// avec les mêmes propriétés attendues d'une cible tactile du jeu :
//   - min-width / min-height 64px CSS
//   - touch-action: manipulation (pas de zoom double-tap)
//   - user-select: none
//   - un seul geste : tap => onPress. Pas de survol, pas de glisser-déposer,
//     pas de double-tap.
//   - `disabled` utilise l'attribut HTML natif `disabled` : un bouton
//     désactivé (ex. pendant que la voix parle déjà cet item) ne déclenche
//     STRICTEMENT AUCUNE action au toucher.
// Le driver d'intégration devra remplacer GrandLivreButton par TapTarget
// partagé une fois C1 livrée, sans changer la signature publique de
// GrandLivre (précédent documenté par E1/E2 pour ASSUMPTIONS.md).

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

export interface GrandLivreButtonProps {
  /** Uniquement `aria-label` (lecteur d'écran adulte) : jamais affiché comme
   * texte à l'écran par ce bouton lui-même (l'icône porte l'affordance). */
  label: string
  onPress: () => void
  disabled?: boolean
  children?: ReactNode
  testId?: string
  className?: string
}

export function GrandLivreButton({
  label,
  onPress,
  disabled = false,
  children,
  testId,
  className,
}: GrandLivreButtonProps) {
  return (
    <button
      type="button"
      className={['grand-livre-button', className].filter(Boolean).join(' ')}
      style={{
        ...buttonStyle,
        opacity: disabled ? 0.6 : 1,
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
