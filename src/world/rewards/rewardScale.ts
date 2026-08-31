// Échelle de récompense par quête — Le Royaume des Sons (leaf E2).
//
// Décision libre (voir ASSUMPTIONS.md), non imposée par SPEC.md : SPEC §4 dit
// seulement « barre d'XP, pièces, cosmétiques » sans chiffrer les montants.
// Choix retenu, pensé pour une quête de 8-12 défis durant 3-6 min (SPEC §4) :
//   - un petit gain à chaque défi réussi maintient une rétroaction fréquente,
//     sans que l'enfant ait besoin de lire une barre de progression pour
//     sentir qu'il avance (le compagnon le dit à voix haute — hors périmètre
//     E2, narration = A4) ;
//   - un bonus de fin de quête récompense l'achèvement plutôt que le seul
//     grinding, sans pénaliser l'aide (SPEC §8 : « l'aide retarde la
//     maîtrise, elle ne punit pas » — donc aucun montant ici ne dépend du
//     nombre d'indices utilisés) ;
//   - le bonus de boss est nettement plus généreux pour marquer la fin de
//     région comme un vrai jalon.
// Ces constantes ne sont pas encore consommées ailleurs : le moteur de quête
// (leaf E3, vague 5) est responsable d'appeler applyQuestReward avec des
// montants dérivés de cette échelle une fois le contenu réel de la quête
// connu (nombre de défis, présence d'un boss).
export const QUEST_REWARD_SCALE = {
  /** Gagné à chaque défi réussi, boss ou non, indépendamment de l'aide utilisée. */
  perChallengeCorrect: { xp: 10, coins: 2 },
  /** Bonus unique versé quand la dernière quête d'une région (le boss) est réussie. */
  bossCompletionBonus: { xp: 100, coins: 50 },
} as const

export interface RewardAmount {
  xp: number
  coins: number
}

/**
 * Calcule le montant total à accorder pour une quête, à partir du nombre de
 * défis réussis et du fait qu'il s'agisse ou non d'un boss. Fonction pure,
 * ne modifie rien : le résultat est destiné à être passé à
 * applyQuestReward().
 */
export function computeQuestReward(
  challengesCorrectCount: number,
  isBossQuest: boolean,
): RewardAmount {
  const safeCount = Math.max(0, challengesCorrectCount)
  const base = QUEST_REWARD_SCALE.perChallengeCorrect
  const bonus = isBossQuest ? QUEST_REWARD_SCALE.bossCompletionBonus : { xp: 0, coins: 0 }
  return {
    xp: safeCount * base.xp + bonus.xp,
    coins: safeCount * base.coins + bonus.coins,
  }
}
