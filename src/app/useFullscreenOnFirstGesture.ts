// Déclenche le plein écran sur le tout premier geste utilisateur, sauf si
// l'application tourne déjà en mode standalone (lancée depuis l'icône ajoutée
// à l'écran d'accueil — SPEC §3 : les deux mécanismes sont complémentaires,
// standalone au lancement, requestFullscreen sinon).
import { useCallback, useRef, type RefObject } from 'react'

/** Vrai si l'app est affichée en mode standalone (ajoutée à l'écran d'accueil). */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(display-mode: standalone)').matches
}

/**
 * Retourne un gestionnaire d'événement à poser sur la racine de l'app. Au
 * premier appel seulement, et uniquement hors mode standalone, tente
 * `requestFullscreen()` sur l'élément ciblé. Ne fait jamais rien planter :
 * un navigateur qui refuse (API absente, permission refusée, contexte non
 * autorisé) laisse simplement le jeu continuer en mode navigateur normal.
 */
export function useFullscreenOnFirstGesture(
  targetRef: RefObject<HTMLElement | null>,
): () => void {
  const hasTriggeredRef = useRef(false)

  return useCallback(() => {
    if (hasTriggeredRef.current) {
      return
    }
    hasTriggeredRef.current = true

    if (isStandaloneDisplayMode()) {
      return
    }

    const target = targetRef.current
    if (!target) {
      return
    }

    const requestFullscreen = target.requestFullscreen?.bind(target)
    if (!requestFullscreen) {
      // API absente sur ce navigateur : on continue sans plein écran plutôt
      // que de bloquer l'enfant.
      return
    }

    try {
      const result = requestFullscreen()
      // Certains navigateurs renvoient une Promise qui peut être rejetée
      // (permission refusée, absence de geste utilisateur détecté, etc.) ;
      // on l'avale silencieusement, jamais d'erreur visible par l'enfant.
      void result?.catch(() => undefined)
    } catch {
      // Par sécurité si un navigateur lance de façon synchrone plutôt que de
      // rejeter la Promise.
    }
  }, [targetRef])
}
