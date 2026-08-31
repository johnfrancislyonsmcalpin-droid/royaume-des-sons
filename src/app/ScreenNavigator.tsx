// Navigateur d'écrans : une machine à états simple qui affiche exactement un
// écran à la fois. Volontairement PAS un routeur d'URL : SPEC §2 interdit toute
// navigation qui dépendrait de la lecture (d'une adresse, d'un hash, etc.),
// donc l'écran affiché ne dépend jamais de window.location/URL, seulement de
// l'état interne de ce composant.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ScreenId = string

export interface ScreenNavigatorApi {
  /** Identifiant de l'écran actuellement affiché. */
  currentScreenId: ScreenId
  /** Change l'écran affiché. Ignoré silencieusement si l'identifiant est inconnu
   * (erreur de configuration développeur : jamais visible par l'enfant). */
  navigate: (screenId: ScreenId) => void
}

export interface ScreenDefinition {
  id: ScreenId
  render: (api: ScreenNavigatorApi) => ReactNode
}

export interface ScreenNavigatorProps {
  screens: ScreenDefinition[]
  initialScreenId: ScreenId
  /** Point d'extension : appelé à chaque montage/changement d'écran, avant le
   * rendu suivant. Branché par la leaf A4 (narration) pour déclencher la
   * narration de l'écran affiché. Ne fait rien par défaut. */
  onScreenMount?: (screenId: ScreenId) => void
}

export function ScreenNavigator({
  screens,
  initialScreenId,
  onScreenMount,
}: ScreenNavigatorProps) {
  const screenMap = useMemo(() => {
    const map = new Map<ScreenId, ScreenDefinition>()
    for (const screen of screens) {
      map.set(screen.id, screen)
    }
    return map
  }, [screens])

  const [currentScreenId, setCurrentScreenId] = useState<ScreenId>(initialScreenId)

  const navigate = useCallback(
    (screenId: ScreenId) => {
      if (!screenMap.has(screenId)) {
        // Configuration développeur invalide : on dégrade sans jamais bloquer
        // ou faire planter l'enfant (voir conventions PLAN.md).
        if (import.meta.env.DEV) {
          console.warn(`ScreenNavigator: écran inconnu "${screenId}"`)
        }
        return
      }
      setCurrentScreenId(screenId)
    },
    [screenMap],
  )

  useEffect(() => {
    onScreenMount?.(currentScreenId)
  }, [currentScreenId, onScreenMount])

  const screen = screenMap.get(currentScreenId)
  if (!screen) {
    return null
  }

  const api: ScreenNavigatorApi = { currentScreenId, navigate }
  return screen.render(api)
}
