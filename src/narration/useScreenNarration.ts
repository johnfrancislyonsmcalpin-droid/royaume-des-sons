import { useEffect, useRef } from 'react'
import type { NarrationRequest } from '../types'
import { useNarrationOrchestrator } from './NarrationProvider'
import { registerScreen, unregisterScreen } from './registry'

/**
 * Contrat que CHAQUE composant écran du jeu doit appeler pour déclarer sa
 * narration (SPEC §2.1 : « chaque écran est narré à voix haute dès son
 * apparition »). Un écran qui omet cet appel n'apparaît jamais dans le registre
 * central (registry.ts) et est détecté par `verifyScreenNarration` (G-A4).
 *
 * Déclenche l'énonciation automatiquement au MONTAGE du composant, jamais sur
 * une action explicite de l'enfant (G2). Les rendus suivants du même composant
 * (screenId inchangé) ne redéclenchent pas la narration, même si `request`
 * change de valeur d'un rendu à l'autre — seule la valeur au moment du montage
 * est énoncée automatiquement ; le registre, lui, reste à jour avec la valeur
 * la plus récente pour que l'audit (G1) reflète toujours l'état actuel de
 * l'écran.
 *
 * @param screenId identifiant stable de l'écran (ex. "clairiere-voyelles-intro").
 *   Un changement de `screenId` sur la même instance de composant est traité
 *   comme un nouvel écran : la narration précédente est retirée et la nouvelle
 *   est déclenchée.
 * @param request la NarrationRequest à énoncer à l'apparition de l'écran.
 */
export function useScreenNarration(screenId: string, request: NarrationRequest): void {
  const orchestrator = useNarrationOrchestrator()

  // Reflète toujours la narration la plus récente déclarée par l'écran, pour le
  // registre d'audit — indépendamment du moment où l'effet de montage a couru.
  const requestRef = useRef(request)
  requestRef.current = request

  // L'id réellement soumis à l'orchestrateur au montage : le nettoyage doit
  // retirer EXACTEMENT cette demande, même si `request.id` a changé entre-temps
  // sur un rendu ultérieur (l'orchestrateur ne connaît que l'id d'origine).
  const submittedIdRef = useRef<string | null>(null)

  useEffect(() => {
    const requestAtMount = requestRef.current
    submittedIdRef.current = requestAtMount.id
    registerScreen(screenId, () => requestRef.current)
    orchestrator.submit(requestAtMount)

    return () => {
      unregisterScreen(screenId)
      const submittedId = submittedIdRef.current
      if (submittedId) {
        orchestrator.dismiss(submittedId)
      }
    }
    // Volontaire : seuls `screenId`/`orchestrator` doivent redéclencher l'effet.
    // `request` est lu via la ref pour ne JAMAIS redéclencher l'énonciation sur
    // un simple changement de props (G2 : jamais sur une action explicite).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenId, orchestrator])
}
