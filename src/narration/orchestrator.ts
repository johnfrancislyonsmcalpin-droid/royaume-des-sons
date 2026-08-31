// Orchestrateur pur (aucune dépendance React) qui décide QUAND parler : quelle
// NarrationRequest est active, laquelle attend, et quand une demande entrante
// interrompt la narration en cours plutôt que d'attendre son tour. Séparé de
// NarrationProvider.tsx pour rester testable sans monter de composants React.

import type { NarrationRequest } from '../types'
import type { NarrationDriver } from './types'
import { priorityRank } from './priority'

export interface NarrationOrchestratorSnapshot {
  current: NarrationRequest | null
  queue: NarrationRequest[]
}

export interface NarrationOrchestrator {
  /** Soumet une demande de narration. Voir la logique de priorité dans priority.ts. */
  submit: (request: NarrationRequest) => void
  /**
   * Retire une demande par id : si elle est en cours, l'interrompt et enchaîne
   * sur la suite de la file ; si elle est seulement en attente, la retire sans
   * effet de bord. Utilisé quand un écran se démonte (SPEC : la narration d'un
   * écran qui n'est plus visible ne doit jamais continuer).
   */
  dismiss: (requestId: string) => void
  /** Réservé aux tests / au débogage : état courant, sans référence mutable. */
  getSnapshot: () => NarrationOrchestratorSnapshot
}

export function createNarrationOrchestrator(driver: NarrationDriver): NarrationOrchestrator {
  let current: NarrationRequest | null = null
  let queue: NarrationRequest[] = []

  // Jeton de génération : incrémenté à chaque fois qu'on commence à parler.
  // La résolution d'un ancien `driver.speak()` (qui peut arriver après coup,
  // par exemple si elle était déjà en vol au moment d'un `cancel()`) ne doit
  // jamais faire avancer la file à la place de la narration qui l'a remplacée.
  let generation = 0

  function insertByPriority(request: NarrationRequest): void {
    // Un même id ne doit jamais être présent deux fois dans la file (évite
    // l'empilement de demandes identiques, ex. appuis répétés sur « oreille »
    // pendant qu'une narration non interruptible joue déjà).
    queue = queue.filter((item) => item.id !== request.id)
    const rank = priorityRank(request.priority)
    const insertAt = queue.findIndex((item) => priorityRank(item.priority) < rank)
    if (insertAt === -1) {
      queue.push(request)
    } else {
      queue.splice(insertAt, 0, request)
    }
  }

  function startSpeaking(request: NarrationRequest): void {
    current = request
    const myGeneration = ++generation
    void driver.speak(request).then(() => {
      if (myGeneration !== generation) return // supplantée entre-temps, ignorer
      advance()
    })
  }

  function advance(): void {
    const next = queue.shift()
    if (!next) {
      current = null
      return
    }
    startSpeaking(next)
  }

  function submit(request: NarrationRequest): void {
    if (current && current.id === request.id) {
      // Déjà en train d'être énoncée : ne pas la redémarrer depuis le début.
      return
    }

    if (!current) {
      startSpeaking(request)
      return
    }

    if (priorityRank(request.priority) > priorityRank(current.priority) && current.interruptible) {
      driver.cancel()
      startSpeaking(request) // incrémente `generation`, invalidant l'ancien .then()
      return
    }

    insertByPriority(request)
  }

  function dismiss(requestId: string): void {
    if (current && current.id === requestId) {
      driver.cancel()
      generation++ // invalide la résolution de l'ancien speak() avant d'avancer
      advance()
      return
    }
    queue = queue.filter((item) => item.id !== requestId)
  }

  function getSnapshot(): NarrationOrchestratorSnapshot {
    return { current, queue: [...queue] }
  }

  return { submit, dismiss, getSnapshot }
}
