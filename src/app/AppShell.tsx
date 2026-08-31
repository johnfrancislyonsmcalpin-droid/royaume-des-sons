// Coquille applicative : racine tactile-sûre + navigateur d'écrans + logique
// de passage en plein écran sur le premier geste. Composant d'intégration que
// node-A (branche Socle technique) branchera dans src/main.tsx une fois A2
// (voix), A3 (persistance) et A4 (narration) disponibles.
import { useRef } from 'react'
import { ScreenNavigator, type ScreenDefinition, type ScreenId } from './ScreenNavigator'
import { PlayScreen } from './screens/PlayScreen'
import { touchSafeStyle } from './touchSafety'
import { useFullscreenOnFirstGesture } from './useFullscreenOnFirstGesture'

const screens: ScreenDefinition[] = [{ id: 'play', render: PlayScreen }]

export const INITIAL_SCREEN_ID: ScreenId = 'play'

export interface AppShellProps {
  /** Point d'extension : appelé au montage/changement de chaque écran affiché.
   * Non fourni ici — branché par la leaf A4 (narration) pour déclencher la
   * narration de l'écran affiché à voix haute dès son apparition. */
  onScreenMount?: (screenId: ScreenId) => void
}

export function AppShell({ onScreenMount }: AppShellProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerFullscreenOnce = useFullscreenOnFirstGesture(rootRef)

  return (
    <div
      ref={rootRef}
      className="app-shell"
      style={touchSafeStyle}
      onPointerDown={triggerFullscreenOnce}
    >
      <ScreenNavigator
        screens={screens}
        initialScreenId={INITIAL_SCREEN_ID}
        onScreenMount={onScreenMount}
      />
    </div>
  )
}
