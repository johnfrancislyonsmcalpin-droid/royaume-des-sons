// Registre central des écrans qui ont déclaré une narration.
//
// `useScreenNarration` (voir useScreenNarration.ts) enregistre ici chaque écran
// monté. Ce registre existe pour que le contrat « aucun écran sans narration »
// (SPEC §2.1, CLAUDE.md règle 1) soit vérifiable par machine plutôt que par
// convention : `verifyScreenNarration` compare une liste d'identifiants d'écrans
// attendus au registre et signale toute absence ou narration vide — c'est le
// contrôle utilisé par G-A4 / G1, y compris son contrôle négatif (un écran qui
// oublie d'appeler `useScreenNarration` n'apparaît jamais ici et est donc détecté).

import type { NarrationRequest } from '../types'
import type { ScreenNarrationViolation } from './types'

type NarrationFactory = () => NarrationRequest

const registry = new Map<string, NarrationFactory>()

/**
 * Déclare qu'un écran fournit une narration. `getRequest` est appelée à la
 * demande (par `verifyScreenNarration` ou tout autre outil d'audit), jamais
 * mise en cache, pour toujours refléter la narration la plus à jour de l'écran.
 */
export function registerScreen(screenId: string, getRequest: NarrationFactory): void {
  registry.set(screenId, getRequest)
}

/** Retire un écran du registre (appelé au démontage par `useScreenNarration`). */
export function unregisterScreen(screenId: string): void {
  registry.delete(screenId)
}

export function getRegisteredScreenIds(): string[] {
  return Array.from(registry.keys())
}

/** Réservé aux tests : repart d'un registre vide entre les cas de test. */
export function clearScreenRegistry(): void {
  registry.clear()
}

/**
 * Vérifie que chaque identifiant de `expectedScreenIds` est enregistré et
 * produit une NarrationRequest avec un texte non vide. Retourne la liste des
 * violations (vide = conforme). Ne lève jamais : une fabrique d'écran qui lève
 * est elle-même signalée comme violation plutôt que de faire échouer l'appelant.
 */
export function verifyScreenNarration(expectedScreenIds: string[]): ScreenNarrationViolation[] {
  const violations: ScreenNarrationViolation[] = []

  for (const screenId of expectedScreenIds) {
    const getRequest = registry.get(screenId)
    if (!getRequest) {
      violations.push({
        screenId,
        reason:
          "écran non enregistré : useScreenNarration (ou registerScreen) n'a jamais été appelé pour cet écran",
      })
      continue
    }

    let request: NarrationRequest
    try {
      request = getRequest()
    } catch (error) {
      violations.push({
        screenId,
        reason: `la fabrique de narration a levé une erreur : ${String(error)}`,
      })
      continue
    }

    if (!request || typeof request.text !== 'string' || request.text.trim().length === 0) {
      violations.push({ screenId, reason: 'narration déclarée mais texte vide' })
    }
  }

  return violations
}
