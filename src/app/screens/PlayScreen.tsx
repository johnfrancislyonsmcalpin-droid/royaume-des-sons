// Premier écran du jeu : un unique gros bouton, identifié par une icône, sans
// aucun mot requis pour être compris (SPEC §2 — l'enfant ne sait pas lire).
// La narration (« appuie sur le bouton pour jouer ») est branchée séparément
// par la leaf A4 via ScreenNavigator.onScreenMount ; ce composant ne narre
// rien lui-même.
import type { ScreenNavigatorApi } from '../ScreenNavigator'
import { PlayIcon } from '../PlayIcon'
import './PlayScreen.css'

export function PlayScreen(_api: ScreenNavigatorApi) {
  return (
    <div className="screen screen-play" style={playScreenStyle}>
      <button
        type="button"
        className="play-button"
        data-testid="play-button"
        style={playButtonStyle}
      >
        <PlayIcon />
      </button>
    </div>
  )
}

const playScreenStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
} as const

// Grosse zone tactile bien au-delà du minimum de 64x64 px (SPEC §3) : c'est le
// seul geste possible sur cet écran, il doit être impossible à manquer.
const playButtonStyle = {
  width: 'min(45vmin, 260px)',
  height: 'min(45vmin, 260px)',
  minWidth: '64px',
  minHeight: '64px',
  border: 'none',
  borderRadius: '50%',
  padding: 0,
  background: 'transparent',
  cursor: 'pointer',
  touchAction: 'manipulation',
} as const
