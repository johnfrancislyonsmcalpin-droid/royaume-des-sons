// Compteur cumulatif de quêtes jouées (SPEC §7 ; src/engine/spacing.ts traite
// `questsPlayed` comme une valeur ABSOLUE qui doit survivre aux rechargements,
// voir l'ASSUMPTION en tête de ce fichier). `SaveFile` / `ProgressState`
// (src/types.ts, FIGÉ avant tout travail de leaf) ne réservent aucun champ
// pour cette valeur, et il est hors de question d'ajouter un champ à un
// contrat gelé partagé par ~30 leaves déjà VERIFIED à ce stade de
// l'intégration.
//
// Décision d'intégration (à reporter dans ASSUMPTIONS.md) : ce compteur vit
// dans sa propre clé localStorage, distincte du schéma de sauvegarde
// versionné de src/save/** (A3) — ce n'est pas une donnée de progression
// affichée au joueur, seulement un compteur technique consommé par le moteur
// de répétition espacée (D2) au moment d'assembler une quête. Mêmes garanties
// de non-échec que src/save/storage.ts : ne lève jamais.

const STORAGE_KEY = 'royaume-des-sons:quests-played'

function devWarn(...args: unknown[]): void {
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
  if (isDev) {
    console.warn('[app/root]', ...args)
  }
}

/** Nombre cumulatif de quêtes terminées depuis le début du jeu (0 par défaut). */
export function getQuestsPlayed(): number {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return 0
    const parsed = Number.parseInt(raw, 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  } catch (err) {
    devWarn('lecture du compteur de quêtes impossible', err)
    return 0
  }
}

/** Incrémente et persiste le compteur ; à appeler une fois par quête TERMINÉE
 * (jamais au démarrage d'une quête, sous peine de compter les quêtes
 * abandonnées en cours de route). Retourne la nouvelle valeur. */
export function incrementQuestsPlayed(): number {
  const next = getQuestsPlayed() + 1
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next))
  } catch (err) {
    devWarn('écriture du compteur de quêtes impossible', err)
  }
  return next
}
