// Double de test fidèle pour `window.speechSynthesis` / `SpeechSynthesisUtterance`.
// jsdom n'implémente pas la synthèse vocale : ce module reproduit les
// comportements dont src/voice/** dépend, pour que les tests exercent le vrai
// code de production (voiceSelection.ts, watchdog.ts, queue.ts, engine.ts)
// sans jamais toucher au vrai navigateur.
//
// Reproduit :
// - `voiceschanged` asynchrone (délai configurable, ou jamais émis) ;
// - `onstart` / `onend` / `onerror` avec un séquencement asynchrone réaliste
//   (setTimeout, jamais synchrone) ;
// - un gel simulé (onstart qui ne se déclenche jamais), pour exercer le
//   watchdog de démarrage ;
// - une troncature simulée au-delà d'un seuil de caractères (onerror au lieu
//   de onend avant la fin du texte), pour prouver que le découpage en
//   chunking.ts empêche réellement toute utterance envoyée au moteur de
//   dépasser ce seuil.
import type { SpeechSynthesisLike, SpeechSynthesisUtteranceLike, SpeechSynthesisVoiceLike } from '../types'

export interface FakeVoice extends SpeechSynthesisVoiceLike {}

export interface FakeSpeechSynthesisOptions {
  /** Voix "installées" sur le moteur fake, livrées via `voiceschanged`. */
  voices?: FakeVoice[]
  /** Délai avant l'émission de `voiceschanged`. `null` = l'événement ne se
   * déclenche jamais (pour tester le délai de garde de waitForVoices). */
  voicesDelayMs?: number | null
  /** Si le texte d'une utterance dépasse cette longueur, elle est "tronquée" :
   * `onstart` se déclenche puis `onerror('interrupted')` avant la fin du
   * texte simulé, au lieu de `onend` — reproduit la troncature de Chrome
   * Android au-delà d'~15s d'énonciation. */
  truncateAtChars?: number
  /** Délai simulé avant `onstart`, en ms. */
  startDelayMs?: number
  /** Ms simulées "parlées" par caractère, pour dater `onend` / `onerror`. */
  msPerChar?: number
}

export interface FakeSpeechSynthesisControl {
  synth: SpeechSynthesisLike
  createUtterance: (text: string) => SpeechSynthesisUtteranceLike
  /** Force les N prochains appels à `speak()` à ne jamais déclencher
   * `onstart` (simule un gel de speechSynthesis, pour le watchdog). */
  failNextStarts: (count: number) => void
  /** Textes effectivement envoyés à `speak()`, dans l'ordre. */
  spokenTexts: () => string[]
  /** Voix effectivement assignées aux utterances envoyées à `speak()`, dans
   * l'ordre (pour vérifier qu'un `setVoiceOverride` a bien été appliqué). */
  spokenVoices: () => (SpeechSynthesisVoiceLike | null)[]
  /** Nombre d'utterances actuellement en cours de simulation (0 ou 1). */
  activeCount: () => number
  /** Remplace la liste de voix "installées" et redéclenche `voiceschanged`
   * immédiatement (simule une installation tardive de voix). */
  setVoicesNow: (voices: FakeVoice[]) => void
}

export function createFakeSpeechSynthesis(
  options: FakeSpeechSynthesisOptions = {},
): FakeSpeechSynthesisControl {
  const { voices = [], voicesDelayMs = 0, truncateAtChars, startDelayMs = 5, msPerChar = 1 } = options

  let currentVoices: FakeVoice[] = []
  const voiceListeners = new Set<() => void>()
  let failNextStartsCount = 0
  const spoken: string[] = []
  const spokenVoices: (SpeechSynthesisVoiceLike | null)[] = []
  let activeUtterance: SpeechSynthesisUtteranceLike | null = null
  // Timers de simulation d'énoncé (onstart/onend), distincts des timers de
  // livraison des voix : `cancel()` doit interrompre un énoncé en cours sans
  // jamais affecter une émission de voiceschanged déjà planifiée.
  let utteranceTimers: Array<ReturnType<typeof setTimeout>> = []

  if (voicesDelayMs !== null) {
    setTimeout(() => {
      currentVoices = voices
      for (const listener of voiceListeners) listener()
    }, voicesDelayMs)
  }

  function createUtterance(text: string): SpeechSynthesisUtteranceLike {
    return {
      text,
      lang: '',
      rate: 1,
      voice: null,
      onstart: null,
      onend: null,
      onerror: null,
    }
  }

  const synth: SpeechSynthesisLike = {
    getVoices: () => currentVoices.slice(),
    speak(utterance: SpeechSynthesisUtteranceLike) {
      spoken.push(utterance.text)
      spokenVoices.push(utterance.voice)
      activeUtterance = utterance
      const suppressStart = failNextStartsCount > 0
      if (suppressStart) failNextStartsCount -= 1

      const startTimer = setTimeout(() => {
        if (activeUtterance !== utterance) return // annulé ou remplacé entre-temps
        if (suppressStart) return // ne jamais démarrer : déclenche le watchdog de démarrage
        utterance.onstart?.()

        const truncated = truncateAtChars != null && utterance.text.length > truncateAtChars
        const spokenChars = truncated ? truncateAtChars! : utterance.text.length
        const endTimer = setTimeout(() => {
          if (activeUtterance !== utterance) return
          if (truncated) {
            utterance.onerror?.({ error: 'interrupted' })
          } else {
            utterance.onend?.()
          }
        }, Math.max(1, spokenChars * msPerChar))
        utteranceTimers.push(endTimer)
      }, startDelayMs)
      utteranceTimers.push(startTimer)
    },
    cancel() {
      activeUtterance = null
      for (const timer of utteranceTimers) clearTimeout(timer)
      utteranceTimers = []
    },
    addEventListener(type, listener) {
      if (type === 'voiceschanged') voiceListeners.add(listener)
    },
    removeEventListener(type, listener) {
      if (type === 'voiceschanged') voiceListeners.delete(listener)
    },
  }

  return {
    synth,
    createUtterance,
    failNextStarts(count: number) {
      failNextStartsCount = count
    },
    spokenTexts: () => spoken.slice(),
    spokenVoices: () => spokenVoices.slice(),
    activeCount: () => (activeUtterance ? 1 : 0),
    setVoicesNow(list: FakeVoice[]) {
      currentVoices = list
      for (const listener of voiceListeners) listener()
    },
  }
}
