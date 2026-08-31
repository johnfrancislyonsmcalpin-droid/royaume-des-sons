import type { NarrationPriority } from '../types'

/**
 * Ordre de priorité des narrations, du moins urgent au plus urgent. Une
 * narration de priorité supérieure interrompt une narration `interruptible:
 * true` en cours (G3) ; une narration `interruptible: false` n'est jamais
 * interrompue, quelle que soit la priorité de la demande entrante.
 *
 * Justification pédagogique (voir ASSUMPTIONS.md — décision prise sans
 * consigne explicite de SPEC.md, qui définit le type mais pas l'ordre) :
 *
 * 1. `screen-intro` — présentation ambiante d'un écran à son apparition,
 *    jamais causée par un geste de l'enfant. La plus interruptible : elle sert
 *    à orienter, pas à répondre à une action.
 * 2. `instruction` — la consigne d'un défi. Essentielle, mais énoncée avant
 *    que l'enfant n'agisse ; rien de plus urgent qu'une simple présentation ne
 *    devrait la couper, mais une demande explicite de l'enfant ou une
 *    rétroaction sur une action déjà en cours passent devant.
 * 3. `help` — réponse à une demande explicite de l'enfant (bouton « oreille »
 *    ou « lanterne », SPEC §8). Un geste tactile qui attend une réaction
 *    immédiate : ignorer l'appui casserait la confiance dans l'interface.
 * 4. `feedback` — rétroaction sur une réponse déjà donnée (SPEC §6,
 *    « rétroaction immédiate »). La plus urgente : c'est la conséquence
 *    directe d'une action que l'enfant vient de faire, et c'est le cœur du
 *    mécanisme d'apprentissage (renforcement immédiat, modélisation du
 *    décodage syllabe par syllabe).
 */
const PRIORITY_ORDER: readonly NarrationPriority[] = [
  'screen-intro',
  'instruction',
  'help',
  'feedback',
]

/** Rang numérique d'une priorité : plus grand = plus urgent. */
export function priorityRank(priority: NarrationPriority): number {
  const rank = PRIORITY_ORDER.indexOf(priority)
  if (rank === -1) {
    throw new Error(`Priorité de narration inconnue: ${String(priority)}`)
  }
  return rank
}

/** true si `a` est strictement plus prioritaire que `b`. */
export function isHigherPriority(a: NarrationPriority, b: NarrationPriority): boolean {
  return priorityRank(a) > priorityRank(b)
}
