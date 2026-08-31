// Orchestration de haut niveau (SPEC §3 / gates A2:G1-G5) : amorçage sur geste
// utilisateur, résolution de la voix française, exposition de l'état muet, et
// mise en file des `NarrationRequest`. `createVoiceEngine` est la seule
// fabrique qui assemble voiceSelection.ts + watchdog.ts (via queue.ts) +
// muteState.ts ; `index.ts` en fait un singleton branché sur le vrai
// `window.speechSynthesis`, seul point d'accès à l'API dans toute l'app.
import { createMuteStore, type MuteListener } from './muteState'
import { createVoiceQueue } from './queue'
import type { SpeechSynthesisLike, SpeechSynthesisUtteranceLike, SpeechSynthesisVoiceLike } from './types'
import type { NarrationRequest } from '../types'
import { selectVoice, VOICE_LOAD_GUARD_MS } from './voiceSelection'

// Débit ~0.85 imposé par la SPEC §3.
export const DEFAULT_RATE = 0.85
// fr-CA est la langue de narration cible (SPEC §1 : français québécois) ; sert
// aussi de repli pour `utterance.lang` quand aucune voix fr-* n'est
// disponible (l'utterance garde une langue française déclarée même sans
// voix correspondante, au cas où le moteur en choisit une par lui-même).
export const DEFAULT_LANG = 'fr-CA'

export interface VoiceEngineDeps {
  synth: SpeechSynthesisLike
  createUtterance: (text: string) => SpeechSynthesisUtteranceLike
  rate?: number
  lang?: string
  voiceGuardMs?: number
  maxChunkChars?: number
}

export interface VoiceEngine {
  /** À appeler depuis un gestionnaire de clic/tap. Idempotent. Tant qu'elle
   * n'a pas été appelée, `speak()` est un no-op silencieux (gate G5). */
  primeVoice: () => void
  /** Seul point d'entrée pour faire parler le jeu. No-op silencieux avant
   * `primeVoice()` ou pour un texte vide. */
  speak: (request: NarrationRequest) => void
  /** Annule proprement tout énoncé en cours ou en attente (changement d'écran). */
  cancelAll: () => void
  getMuteState: () => boolean
  subscribeMuteState: (listener: MuteListener) => () => void
  /** A-t-on déjà amorcé la voix ? Exposé pour les tests et pour l'UI (icône
   * "toucher pour activer le son" tant que non amorcé). */
  isPrimed: () => boolean
}

export function createVoiceEngine(deps: VoiceEngineDeps): VoiceEngine {
  const rate = deps.rate ?? DEFAULT_RATE
  const lang = deps.lang ?? DEFAULT_LANG
  const muteStore = createMuteStore()

  let primed = false
  let selectedVoice: SpeechSynthesisVoiceLike | null = null
  let voiceReadyPromise: Promise<SpeechSynthesisVoiceLike | null> | null = null

  const ensureVoiceSelection = (): Promise<SpeechSynthesisVoiceLike | null> => {
    if (!voiceReadyPromise) {
      voiceReadyPromise = selectVoice(deps.synth, deps.voiceGuardMs ?? VOICE_LOAD_GUARD_MS).then(
        (voice) => {
          selectedVoice = voice
          return voice
        },
        () => {
          // La sélection de voix ne doit jamais faire échouer le moteur :
          // dégrader vers "aucune voix" plutôt que de propager une erreur.
          selectedVoice = null
          return null
        },
      )
    }
    return voiceReadyPromise
  }

  const queue = createVoiceQueue({
    synth: deps.synth,
    createUtterance: deps.createUtterance,
    getVoice: () => selectedVoice,
    getRate: () => rate,
    getLang: () => lang,
    muteStore,
    voiceReady: ensureVoiceSelection,
    maxChunkChars: deps.maxChunkChars,
  })

  return {
    primeVoice() {
      if (primed) return
      primed = true
      // Démarre la résolution de voix immédiatement : par le temps où le
      // premier écran narré appelle speak(), la voix est déjà (ou presque)
      // résolue, ce qui limite la latence perçue par l'enfant.
      void ensureVoiceSelection()
    },
    speak(request: NarrationRequest) {
      if (!primed) {
        if (typeof console !== 'undefined') {
          console.warn(
            '[voice] speak() ignoré : primeVoice() doit être appelé depuis un geste utilisateur avant toute narration.',
          )
        }
        return
      }
      const text = request.text.trim()
      if (text.length === 0) return
      queue.enqueue(text)
    },
    cancelAll() {
      queue.cancelAll()
    },
    getMuteState: muteStore.get,
    subscribeMuteState: muteStore.subscribe,
    isPrimed: () => primed,
  }
}

/**
 * Moteur de secours pour un environnement dépourvu de `speechSynthesis`
 * (dégradation propre, jamais d'exception vers le joueur). L'état muet est
 * fixé à `true` en permanence : l'UI peut afficher l'icône son coupé dès le
 * départ plutôt que d'attendre un premier échec.
 */
export function createNoopVoiceEngine(): VoiceEngine {
  const muteStore = createMuteStore()
  muteStore.set(true)
  let primed = false
  return {
    primeVoice() {
      primed = true
    },
    speak() {
      // no-op : aucune capacité de synthèse vocale disponible.
    },
    cancelAll() {
      // no-op
    },
    getMuteState: muteStore.get,
    subscribeMuteState: muteStore.subscribe,
    isPrimed: () => primed,
  }
}
