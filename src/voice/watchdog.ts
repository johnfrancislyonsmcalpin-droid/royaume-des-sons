// Un seul énoncé, protégé par un chien de garde (SPEC §3 / gate A2:G2).
//
// Si `onstart` ne se déclenche pas dans les 600 ms, on considère l'énoncé
// perdu (bug connu de `speechSynthesis` qui peut geler silencieusement,
// notamment après une période d'inactivité). `speakOnce` résout alors avec
// 'no-start' ; c'est à l'appelant (queue.ts) de décider de réessayer.
//
// Décision de conception au-delà de la lettre de la spec (voir ASSUMPTIONS.md) :
// un filet de sécurité secondaire borne aussi l'attente de `onend` une fois
// l'énoncé démarré. Sans lui, un `onend` qui ne se déclenche jamais (autre bug
// observé de `speechSynthesis`) bloquerait la file indéfiniment — silencieux,
// mais bloquant, ce que la SPEC interdit explicitement pour la file d'attente.
import type {
  SpeechSynthesisErrorLike,
  SpeechSynthesisLike,
  SpeechSynthesisUtteranceLike,
  SpeechSynthesisVoiceLike,
} from './types'

export const START_WATCHDOG_MS = 600

// Filet de sécurité post-démarrage : au moins 5 s, plus 200 ms par caractère
// (majorant très large par rapport aux ~8 s max estimées pour 100 caractères
// en chunking.ts), pour ne jamais couper un énoncé légitime encore en cours.
export const END_WATCHDOG_MIN_MS = 5000
export const END_WATCHDOG_MS_PER_CHAR = 200

export type SpeakOnceOutcome = 'ok' | 'no-start'

export interface UtteranceSpec {
  text: string
  voice: SpeechSynthesisVoiceLike | null
  rate: number
  lang: string
}

export interface SpeakOnceDeps {
  synth: SpeechSynthesisLike
  createUtterance: (text: string) => SpeechSynthesisUtteranceLike
}

function computeEndWatchdogMs(textLength: number): number {
  return Math.max(END_WATCHDOG_MIN_MS, textLength * END_WATCHDOG_MS_PER_CHAR)
}

/**
 * Parle un seul morceau de texte via une SpeechSynthesisUtterance fraîche.
 * Résout 'ok' si `onstart` s'est déclenché à temps (l'énoncé est ensuite
 * considéré terminé sur `onend`, `onerror` post-démarrage, ou le filet de
 * sécurité de fin). Résout 'no-start' si `onstart` ne s'est pas déclenché
 * dans `START_WATCHDOG_MS`, ou si une erreur survient avant tout démarrage.
 * Ne lève jamais d'exception.
 */
export function speakOnce(spec: UtteranceSpec, deps: SpeakOnceDeps): Promise<SpeakOnceOutcome> {
  return new Promise((resolve) => {
    let utterance: SpeechSynthesisUtteranceLike
    try {
      utterance = deps.createUtterance(spec.text)
    } catch {
      // Construction de l'utterance elle-même en échec (environnement sans
      // SpeechSynthesisUtterance, par ex.) : jamais d'exception visible.
      resolve('no-start')
      return
    }
    utterance.lang = spec.lang
    utterance.rate = spec.rate
    utterance.voice = spec.voice

    let started = false
    let settled = false
    let startTimer: ReturnType<typeof setTimeout>
    let endTimer: ReturnType<typeof setTimeout> | null = null

    const finish = (outcome: SpeakOnceOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(startTimer)
      if (endTimer) clearTimeout(endTimer)
      resolve(outcome)
    }

    startTimer = setTimeout(() => {
      if (!started) finish('no-start')
    }, START_WATCHDOG_MS)

    utterance.onstart = () => {
      if (settled) return
      started = true
      clearTimeout(startTimer)
      endTimer = setTimeout(() => finish('ok'), computeEndWatchdogMs(spec.text.length))
    }
    utterance.onend = () => finish('ok')
    utterance.onerror = (_event: SpeechSynthesisErrorLike) => {
      // Une erreur avant tout démarrage compte comme un échec de démarrage
      // (déclenche la même logique de réessai que le silence). Une erreur
      // après démarrage (ex. troncature) ne bloque pas la file : on avance.
      finish(started ? 'ok' : 'no-start')
    }

    try {
      deps.synth.speak(utterance)
    } catch {
      finish('no-start')
    }
  })
}
