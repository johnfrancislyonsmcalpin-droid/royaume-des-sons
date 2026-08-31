// Suivi du temps de session cumulé par jour (SPEC §2.6, progress.
// sessionMinutesByDay de src/types.ts). Moteur pur et testable : ne lit
// jamais l'horloge lui-même, tout horodatage est injecté par l'appelant
// (même discipline que src/engine/** et src/world/quest/sessionPause.ts).
//
// Défaut d'intégration comblé ici (node-E, revue de branche) : E3 avait déjà
// livré la règle pure de proposition de pause (sessionPause.ts) et le champ
// `sessionMinutesByDay` existait déjà dans SaveFile (A3/E2), mais rien
// n'incrémentait jamais ce compteur ni n'appelait `shouldProposePause` /
// `crossedPauseThreshold` depuis un composant réellement monté — la
// suggestion de pause SPEC §2.6 et le graphique "temps de jeu" de l'écran
// parent (F1, ParentDashboard) étaient tous deux silencieusement inertes.

/** Clé de date (YYYY-MM-DD, heure locale de l'appareil) utilisée comme index
 * de `sessionMinutesByDay` — cohérent avec `computeDailyMinutesRows`
 * (src/parent/dashboardData.ts), seul autre lecteur de ce champ. */
export function todayKey(now: Date): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Minutes entières écoulées depuis `mountedAtMs`, jamais négatives. */
export function computeElapsedMinutes(mountedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - mountedAtMs) / 60000))
}
