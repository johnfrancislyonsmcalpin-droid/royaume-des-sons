// Enveloppe le premier écran de jeu (A1, src/app/screens/PlayScreen.tsx) —
// « réutilisé tel quel » (consigne du ledger) : ce fichier ne modifie jamais
// PlayScreen.tsx lui-même (hors OWNS de cette leaf), il se contente de le
// composer.
//
// Défaut d'intégration comblé ici (chasse aux défauts, passe 3) : le bouton
// « Jouer » de PlayScreen.tsx n'a AUCUN gestionnaire de clic câblé (composant
// de présentation pur, voir son en-tête — la narration elle-même est
// documentée comme branchée séparément par l'intégrateur). Ni l'amorçage de
// la voix sur le geste utilisateur (SPEC §3 : « l'audio ne peut démarrer
// qu'après un geste utilisateur ») ni la navigation qui suit n'étaient donc
// câblés nulle part avant cette leaf. Solution : un simple `onClick` sur un
// conteneur englobant, qui capte le clic sur le bouton interne par
// remontée (bubbling) DOM standard, sans avoir besoin de modifier
// PlayScreen.tsx ni de lui ajouter une prop hors du contrat ScreenNavigatorApi
// qu'il attend déjà.
import { primeVoice } from '../../../voice'
import { useScreenNarration } from '../../../narration/useScreenNarration'
import { PlayScreen } from '../../screens/PlayScreen'
import { uiText } from '../../../content/uiText'
import type { ScreenNavigatorApi } from '../../ScreenNavigator'

const SCREEN_ID = 'play'

export interface PlayScreenGateProps extends ScreenNavigatorApi {
  /** Appelé une fois la voix amorcée, pour décider où naviguer (l'appelant
   * connaît la sauvegarde courante, cette enveloppe ne la connaît pas). */
  onPlay: () => void
}

export function PlayScreenGate({ onPlay, ...api }: PlayScreenGateProps) {
  // PlayScreen ne déclare aucune narration lui-même (composant de
  // présentation pur) : SPEC §2.1 exige pourtant que CHAQUE écran soit narré
  // à son apparition, y compris le tout premier. Déclarée ici plutôt que
  // dans PlayScreen.tsx, hors OWNS.
  useScreenNarration(SCREEN_ID, {
    id: `${SCREEN_ID}-intro`,
    text: uiText.screens.playIntro,
    priority: 'screen-intro',
    interruptible: true,
  })

  function handleClick() {
    // SPEC §3 : l'audio ne peut démarrer qu'après un geste utilisateur ; ce
    // clic EST ce geste. Idempotent (primeVoice() ignore les appels suivants).
    primeVoice()
    onPlay()
  }

  return (
    <div onClick={handleClick} style={{ width: '100%', height: '100%' }}>
      <PlayScreen {...api} />
    </div>
  )
}
