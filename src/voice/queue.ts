// File d'attente sérialisée (SPEC §3 / gate A2:G4) : un énoncé à la fois,
// découpage automatique des textes longs, réessai + état muet géré par
// watchdog.ts, annulation propre au changement d'écran.
import { MAX_CHUNK_CHARS, splitIntoChunks } from './chunking'
import type { MuteStore } from './muteState'
import type { SpeechSynthesisLike, SpeechSynthesisUtteranceLike, SpeechSynthesisVoiceLike } from './types'
import { speakOnce } from './watchdog'

export interface VoiceQueueDeps {
  synth: SpeechSynthesisLike
  createUtterance: (text: string) => SpeechSynthesisUtteranceLike
  getVoice: () => SpeechSynthesisVoiceLike | null
  getRate: () => number
  getLang: () => string
  muteStore: MuteStore
  /** Résolue quand la sélection de voix est terminée ; attendue une seule fois
   * avant le tout premier énoncé traité pour ne jamais parler avec une voix
   * par défaut non française pendant que la vraie sélection est en cours. */
  voiceReady: () => Promise<unknown>
  maxChunkChars?: number
}

export interface VoiceQueue {
  /** Découpe et ajoute un texte à la file. Synchrone : le texte est dans la
   * file avant le retour de l'appel, pour que `cancelAll()` appelé juste après
   * dans le même tour de boucle d'événements annule bien ce texte. */
  enqueue: (text: string) => void
  /** Vide la file, annule l'énoncé en cours et empêche tout énoncé résiduel
   * déjà en vol de déclencher un nouvel appel à `synth.speak()`. */
  cancelAll: () => void
}

export function createVoiceQueue(deps: VoiceQueueDeps): VoiceQueue {
  let pending: string[] = []
  let processing = false
  // Incrémenté à chaque cancelAll() : toute itération de traitement en cours
  // capture la génération courante au démarrage et abandonne dès qu'elle
  // change, plutôt que de continuer à parler ou à muter l'état sur la base
  // d'un résultat qui appartient à un énoncé déjà annulé.
  let generation = 0

  const runLoop = async () => {
    if (processing) return
    processing = true
    const myGeneration = generation

    await deps.voiceReady().catch(() => undefined)

    while (myGeneration === generation && pending.length > 0) {
      const chunk = pending.shift() as string

      const spec = { text: chunk, voice: deps.getVoice(), rate: deps.getRate(), lang: deps.getLang() }
      const outcome = await speakOnce(spec, { synth: deps.synth, createUtterance: deps.createUtterance })
      if (myGeneration !== generation) break

      if (outcome === 'ok') {
        deps.muteStore.set(false)
        continue
      }

      // Premier échec : un seul réessai immédiat, avec une utterance fraîche.
      const retryOutcome = await speakOnce(spec, { synth: deps.synth, createUtterance: deps.createUtterance })
      if (myGeneration !== generation) break

      if (retryOutcome === 'ok') {
        deps.muteStore.set(false)
      } else {
        // Second échec : état muet exposé, jamais d'exception, la file
        // continue de servir les prochains morceaux et les prochains appels
        // à speak() (SPEC : "sans bloquer la file d'attente pour les
        // prochains appels").
        deps.muteStore.set(true)
      }
    }

    processing = false
    // Du travail est peut-être arrivé pour une génération plus récente
    // pendant qu'on attendait la voix ou qu'on terminait le morceau courant
    // (ex. cancelAll() suivi immédiatement d'un nouvel enqueue()) : la boucle
    // ci-dessus s'est arrêtée sans le traiter puisqu'elle appartenait à
    // l'ancienne génération. Relancer si nécessaire pour ne jamais perdre un
    // enqueue() légitime.
    if (pending.length > 0) void runLoop()
  }

  return {
    enqueue(text: string) {
      const chunks = splitIntoChunks(text, deps.maxChunkChars ?? MAX_CHUNK_CHARS)
      if (chunks.length === 0) return
      pending.push(...chunks)
      void runLoop()
    },
    cancelAll() {
      generation += 1
      pending = []
      try {
        deps.synth.cancel()
      } catch {
        // Ne jamais laisser une erreur d'annulation remonter au joueur.
      }
    },
  }
}
