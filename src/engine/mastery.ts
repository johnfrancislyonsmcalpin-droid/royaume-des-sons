// Moteur de maîtrise — Le Royaume des Sons (leaf D1).
//
// Règle (SPEC §7) : une compétence est maîtrisée quand 8 des 10 dernières
// réponses sont correctes et sans indice. La réécoute de la consigne
// (usedListenAgain) ne compte PAS comme un indice, sauf au niveau 10 où elle
// en compte comme un.
//
// Fonctions pures uniquement : aucune fonction ici ne mute son entrée, ne lit
// ni n'écrit localStorage/réseau/horloge globale (l'horodatage est toujours
// injecté par l'appelant, jamais lu via `new Date()` par défaut sans que
// l'appelant puisse le fixer pour les tests).

import type { ChallengeResult, SkillMastery } from '../types'

/** Taille de la fenêtre glissante de réponses retenue par compétence. */
export const MASTERY_WINDOW = 10

/** Nombre minimal de réponses correctes-sans-indice dans la fenêtre pour être maîtrisé. */
export const MASTERY_THRESHOLD = 8

/**
 * Détermine si un ChallengeResult donné compte comme "correct sans indice"
 * pour la fenêtre de maîtrise, au niveau `level` où il a été joué.
 *
 * - Il faut `correct === true`.
 * - Il faut `usedHelpLevel === 0` (aucune lanterne utilisée).
 * - La réécoute (`usedListenAgain`) est gratuite et ne compte jamais comme un
 *   indice — SAUF au niveau 10 (boss final, SPEC §5 "seule aide restante :
 *   réécouter un mot, ce qui compte comme indice") où elle invalide le
 *   caractère "sans indice" du résultat même si `usedHelpLevel === 0`.
 */
export function countsAsCorrectWithoutHelp(result: ChallengeResult, level: number): boolean {
  if (!result.correct) return false
  if (result.usedHelpLevel !== 0) return false
  if (level === 10 && result.usedListenAgain) return false
  return true
}

/**
 * Une compétence est maîtrisée si sa fenêtre contient au moins
 * `MASTERY_WINDOW` (10) entrées ET qu'au moins `MASTERY_THRESHOLD` (8) des 10
 * plus récentes sont `true`. En dessous de 10 entrées enregistrées, la
 * maîtrise n'est pas encore mesurable : on renvoie `false`, jamais `true` par
 * optimisme (ex. 9/9 correct ne suffit pas).
 */
export function isMastered(mastery: SkillMastery): boolean {
  if (mastery.last10.length < MASTERY_WINDOW) return false
  const recent = mastery.last10.slice(-MASTERY_WINDOW)
  const successCount = recent.filter((entry) => entry).length
  return successCount >= MASTERY_THRESHOLD
}

/**
 * Pousse le résultat d'un défi dans la fenêtre glissante `last10` d'une
 * compétence et renvoie un nouvel objet `SkillMastery` (aucune mutation de
 * `mastery` en entrée).
 *
 * - `level` est le niveau courant du joueur au moment du défi : nécessaire
 *   pour appliquer la règle spéciale de la réécoute au niveau 10.
 * - `now` est l'horodatage à utiliser si la maîtrise est (re)confirmée par cet
 *   appel ; injectable pour les tests, sinon `new Date()` au moment de
 *   l'appel réel en jeu.
 *
 * Représentation de `masteredAt` (décision documentée, cf. décroissance dans
 * decay.ts) : `SkillMastery` n'a aucun champ "dernière activité" séparé.
 * `masteredAt` sert donc de proxy pour cette notion : il est mis à jour à
 * `now` à CHAQUE appel où la compétence ressort maîtrisée après la poussée du
 * résultat (pas seulement lors du premier franchissement du seuil). Ainsi,
 * tant que le joueur continue de pratiquer une compétence déjà maîtrisée,
 * `masteredAt` reste frais ; s'il arrête, `masteredAt` se fige et
 * `decay.ts` peut mesurer "14 jours sans activité" comme `now - masteredAt`
 * sans avoir besoin d'un champ supplémentaire hors du contrat figé de
 * `types.ts`.
 */
export function recordResult(
  mastery: SkillMastery,
  result: ChallengeResult,
  level: number,
  now: Date = new Date(),
): SkillMastery {
  const entry = countsAsCorrectWithoutHelp(result, level)
  const nextLast10 = [...mastery.last10, entry].slice(-MASTERY_WINDOW)

  const updated: SkillMastery = {
    ...mastery,
    last10: nextLast10,
  }

  if (isMastered(updated)) {
    updated.masteredAt = now.toISOString()
  }

  return updated
}
