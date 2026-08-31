// Drapeau "vérification de la voix déjà effectuée" (leaf F2, écran de
// vérification voix — SPEC §3). Clé localStorage dédiée, distincte de
// STORAGE_KEY (src/save/storage.ts, leaf A3) : ce n'est pas une donnée de
// progression de jeu versionnée (SaveFile), seulement un indicateur
// d'affichage ponctuel du tout premier lancement, propre à cet écran. Mêmes
// garanties de non-échec que src/save/storage.ts : ne lève jamais.

export const VOICE_CHECK_STORAGE_KEY = 'royaume-des-sons:voice-check-done'

function devWarn(...args: unknown[]): void {
  // import.meta.env.DEV est fourni par Vite ; en environnement de test (jsdom,
  // pas de bundling Vite complet) le champ peut être absent, d'où la garde.
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
  if (isDev) {
    console.warn('[voice-check]', ...args)
  }
}

/**
 * Vrai si l'écran de vérification de la voix a déjà été complété une fois
 * (confirmation « j'entends » ou « continuer quand même » après
 * l'explication). Faux par défaut, y compris si localStorage est
 * indisponible : dans ce cas l'écran de vérification réapparaît à chaque
 * lancement plutôt que d'empêcher l'app de démarrer sur une exception.
 */
export function hasCompletedVoiceCheck(): boolean {
  try {
    return window.localStorage.getItem(VOICE_CHECK_STORAGE_KEY) === '1'
  } catch (err) {
    devWarn('lecture impossible, vérification voix considérée non faite', err)
    return false
  }
}

/**
 * Marque la vérification de la voix comme complétée. Ne lève jamais : si
 * l'écriture échoue (stockage plein ou indisponible), l'écran réapparaîtra
 * simplement au prochain lancement — une friction adulte répétée, jamais un
 * blocage de l'enfant.
 */
export function markVoiceCheckDone(): void {
  try {
    window.localStorage.setItem(VOICE_CHECK_STORAGE_KEY, '1')
  } catch (err) {
    devWarn('écriture impossible (localStorage plein ou indisponible)', err)
  }
}

/** Pour les tests uniquement : réinitialise le drapeau. */
export function resetVoiceCheckForTests(): void {
  try {
    window.localStorage.removeItem(VOICE_CHECK_STORAGE_KEY)
  } catch {
    // pas d'effet à récupérer en test si localStorage est indisponible
  }
}
