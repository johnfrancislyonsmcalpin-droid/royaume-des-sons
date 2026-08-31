// Application des récompenses de fin de quête — Le Royaume des Sons (leaf E2).
//
// SPEC §7 / §8 : ni le temps de jeu ni l'aide ne retirent jamais quoi que ce
// soit à l'enfant. applyQuestReward() est donc conçue pour être impossible à
// faire régresser : xp et coins ne peuvent qu'augmenter ou rester égaux,
// jamais décroître, même si un appelant passait par erreur un montant
// négatif (défense en profondeur : la fonction ne fait pas confiance à ses
// appelants pour garantir seule la monotonie promise par le gate G2).

import type { AvatarState } from '../../types'

/**
 * Retourne un nouvel AvatarState avec xp/coins augmentés et les nouveaux
 * cosmétiques ajoutés, sans jamais dupliquer un cosmétique déjà présent dans
 * avatar.cosmetics (ni dupliquer un id répété plusieurs fois dans
 * cosmeticIdsUnlocked lui-même). Fonction pure : avatar n'est pas modifié.
 */
export function applyQuestReward(
  avatar: AvatarState,
  xpGained: number,
  coinsGained: number,
  cosmeticIdsUnlocked: string[],
): AvatarState {
  // Défense en profondeur : jamais de décroissance, même sur une entrée
  // invalide (un appelant qui calculerait un delta négatif par erreur).
  const safeXpGained = Math.max(0, xpGained)
  const safeCoinsGained = Math.max(0, coinsGained)

  const alreadyOwned = new Set(avatar.cosmetics)
  const newCosmetics: string[] = []
  for (const cosmeticId of cosmeticIdsUnlocked) {
    if (!alreadyOwned.has(cosmeticId)) {
      alreadyOwned.add(cosmeticId) // évite aussi les doublons internes à cosmeticIdsUnlocked
      newCosmetics.push(cosmeticId)
    }
  }

  return {
    ...avatar,
    xp: avatar.xp + safeXpGained,
    coins: avatar.coins + safeCoinsGained,
    cosmetics: [...avatar.cosmetics, ...newCosmetics],
  }
}
