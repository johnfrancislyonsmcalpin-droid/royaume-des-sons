// Pause 20/40 minutes (SPEC §2.6, tâche E3 point 3) : jamais un blocage,
// seulement un signal que l'appelant (écran parent du jeu / compagnon, F1,
// pas encore livré) peut choisir d'afficher ou d'ignorer. Fonction pure et
// sans état : le suivi du temps de session cumulé (`sessionMinutesElapsed`)
// est la responsabilité de l'appelant — ce module ne lit jamais l'horloge
// lui-même (même discipline que src/engine/**).
export const PAUSE_PROMPT_INTERVAL_MINUTES = 20

/**
 * Vrai quand `sessionMinutesElapsed` est un multiple (non nul) de
 * l'intervalle de pause : 20, 40, 60... (SPEC §2.6 : « après 20 minutes
 * cumulées ... propose une pause ... après 40 minutes, il la propose de
 * nouveau » — le motif continue au-delà de 40 pour une session
 * inhabituellement longue, plutôt que de s'arrêter net après le deuxième
 * rappel explicitement cité par SPEC.md).
 *
 * Jamais bloquant : cette fonction ne renvoie qu'un booléen. L'appelant
 * décide entièrement de la suite (afficher le compagnon, laisser l'enfant
 * refuser, ne rien faire) — SPEC §2 règle 3 : jamais de compte à rebours, de
 * minuteur visible ni de blocage autoritaire.
 */
export function shouldProposePause(sessionMinutesElapsed: number): boolean {
  if (!Number.isFinite(sessionMinutesElapsed) || sessionMinutesElapsed <= 0) return false
  return sessionMinutesElapsed % PAUSE_PROMPT_INTERVAL_MINUTES === 0
}

/**
 * Variante robuste au polling à grain fin (ex. un minuteur qui avance de
 * quelques secondes plutôt que d'exactement une minute, ou un rendu qui ne
 * se déclenche pas pile à la valeur entière) : vrai si un seuil de pause
 * (20, 40, 60...) a été FRANCHI entre `previousMinutesElapsed` (exclu) et
 * `currentMinutesElapsed` (inclus), même si `currentMinutesElapsed`
 * lui-même n'est pas un multiple exact de 20. Complémentaire à
 * `shouldProposePause`, pour un appelant qui préfère comparer deux mesures
 * successives plutôt que de tester l'égalité exacte à chaque tick.
 */
export function crossedPauseThreshold(previousMinutesElapsed: number, currentMinutesElapsed: number): boolean {
  if (!Number.isFinite(previousMinutesElapsed) || !Number.isFinite(currentMinutesElapsed)) return false
  if (currentMinutesElapsed <= previousMinutesElapsed) return false
  const safePrevious = Math.max(0, previousMinutesElapsed)
  const previousThresholdCount = Math.floor(safePrevious / PAUSE_PROMPT_INTERVAL_MINUTES)
  const currentThresholdCount = Math.floor(currentMinutesElapsed / PAUSE_PROMPT_INTERVAL_MINUTES)
  return currentThresholdCount > previousThresholdCount
}
