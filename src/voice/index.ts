// Point d'entrée public du module voix. C'est le SEUL fichier de tout le
// dépôt autorisé à toucher `window.speechSynthesis` / `SpeechSynthesisUtterance`
// directement (convention PLAN.md : "speak() unique dans src/voice/, jamais
// d'appel direct à window.speechSynthesis ailleurs"). Tout le reste de l'app
// importe uniquement les exports ci-dessous.
import { createNoopVoiceEngine, createVoiceEngine } from './engine'
import type { SpeechSynthesisLike, SpeechSynthesisUtteranceLike } from './types'

function createBrowserUtterance(text: string): SpeechSynthesisUtteranceLike {
  // Cast à la frontière : l'API DOM réelle a plus de membres que notre
  // interface minimale (voir types.ts), ce qui est toujours sûr à l'exécution.
  return new SpeechSynthesisUtterance(text) as unknown as SpeechSynthesisUtteranceLike
}

function hasBrowserSpeechSynthesis(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
}

const engine = hasBrowserSpeechSynthesis()
  ? createVoiceEngine({
      synth: window.speechSynthesis as unknown as SpeechSynthesisLike,
      createUtterance: createBrowserUtterance,
    })
  : createNoopVoiceEngine()

/** À appeler depuis un gestionnaire de clic/tap (ex. le bouton « Jouer »).
 * Amorce la synthèse vocale sur un geste utilisateur explicite ; obligatoire
 * avant tout appel à `speak()` (SPEC §3, gate G5). */
export const primeVoice = engine.primeVoice

/** Seul point d'accès pour faire parler le jeu. Consomme un `NarrationRequest`
 * (src/types.ts). No-op silencieux tant que `primeVoice()` n'a pas été appelé,
 * ou pour un texte vide. Sérialise, découpe les textes longs et gère
 * réessai/état muet en interne : ne lève jamais d'exception. */
export const speak = engine.speak

/** Annule proprement tout énoncé en cours ou en attente (à appeler à chaque
 * changement d'écran) : aucun énoncé résiduel ne se déclenche après coup. */
export const cancelAll = engine.cancelAll

/** État courant "voix muette" (deux échecs consécutifs de démarrage). */
export const getMuteState = engine.getMuteState

/** S'abonne aux changements d'état muet ; retourne une fonction de désabonnement. */
export const subscribeMuteState = engine.subscribeMuteState

/** Utilisé par l'UI pour savoir si l'amorçage a déjà eu lieu. */
export const isPrimed = engine.isPrimed

/** Change le débit de narration (écran parent, SPEC §9). */
export const setRate = engine.setRate

/** Débit courant. */
export const getRate = engine.getRate

/** Voix disponibles pour un sélecteur d'écran parent (SPEC §9) ; seul appel
 * en lecture sur `synth.getVoices()` en dehors de la sélection automatique. */
export const listVoices = engine.listVoices

/** Force une voix précise (écran parent) ; `null` réactive la sélection
 * automatique fr-CA>fr-FR>fr-*. */
export const setVoiceOverride = engine.setVoiceOverride
