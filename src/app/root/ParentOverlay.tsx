// Enveloppe l'écran parent (F1) monté en overlay permanent (voir GameRoot.tsx :
// sibling du ScreenNavigator, jamais un écran navigable parmi d'autres).
//
// Défaut identifié en intégration (chasse aux défauts, passe 3) : ParentScreen
// (SANS PROPS, voir son en-tête — « toujours monté par l'intégrateur ») écrit
// directement dans localStorage via src/save/** pour la réinitialisation et
// l'import de sauvegarde (src/parent/Settings.tsx), en contournant totalement
// le SaveFile tenu en mémoire par GameRoot. Sans intervention, un parent qui
// réinitialise ou importe une sauvegarde depuis cet écran laisserait le jeu
// continuer avec un état React périmé après la fermeture du panneau — un
// « sauvegarde jamais rechargée » classique.
//
// Solution retenue sans modifier ParentScreen.tsx (hors OWNS de cette leaf) :
// un gestionnaire de clic délégué sur son bouton de fermeture, identifié par
// son data-testid stable (`parent-screen-close`, voir ParentScreen.tsx),
// déclenche un rechargement de la sauvegarde en mémoire au moment précis où
// l'adulte referme le panneau — jamais avant (le tableau de bord parent lui
// -même prend son propre instantané à l'ouverture, voir ParentScreen.tsx).
import type { MouseEvent } from 'react'
import { ParentScreen } from '../../parent/ParentScreen'

export interface ParentOverlayProps {
  /** Appelé une fois, quand l'adulte referme le panneau parent : l'occasion
   * de resynchroniser la sauvegarde en mémoire avec localStorage (réinitialisation,
   * import, ou tout autre changement effectué pendant que le panneau était ouvert). */
  onClose: () => void
}

const PARENT_CLOSE_TESTID = 'parent-screen-close'

export function ParentOverlay({ onClose }: ParentOverlayProps) {
  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (target.closest(`[data-testid="${PARENT_CLOSE_TESTID}"]`)) {
      onClose()
    }
  }

  return (
    <div onClickCapture={handleClickCapture}>
      <ParentScreen />
    </div>
  )
}
