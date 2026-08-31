// Moteur de décroissance — Le Royaume des Sons (leaf D1).
//
// Règle (SPEC §7 "Décroissance") : « Après 14 jours sans jouer, les
// compétences maîtrisées repassent sous le seuil et sont réinjectées en
// révision — sans jamais faire redescendre le niveau affiché ni retirer une
// récompense. L'enfant ne doit jamais avoir l'impression de perdre. »
//
// PRINCIPE NON NÉGOCIABLE : ce module opère STRICTEMENT sur `SkillMastery`.
// Il ne connaît, n'importe et ne référence à aucun moment `ProgressState`
// (currentLevel, unlockedRegionIds) ni `AvatarState` (récompenses,
// cosmétiques, xp, pièces). Ce n'est pas un oubli : c'est une garantie de
// type — les signatures ci-dessous ne peuvent structurellement pas toucher
// à autre chose que `SkillMastery` / `Record<SkillId, SkillMastery>`. Toute
// évolution future de ce fichier qui importerait `ProgressState` ou
// `AvatarState` violerait cette règle et doit être refusée en revue.

import type { SkillId, SkillMastery } from '../types'
import { isMastered } from './mastery'

/** Nombre de jours d'inactivité sur une compétence maîtrisée avant décroissance. */
export const DECAY_AFTER_DAYS = 14

/** Fenêtre de décroissance en millisecondes (14 jours). */
export const DECAY_THRESHOLD_MS = DECAY_AFTER_DAYS * 24 * 60 * 60 * 1000

/**
 * Applique la décroissance à une compétence unique.
 *
 * Condition de déclenchement : la compétence est actuellement maîtrisée
 * (`isMastered(mastery)`) ET au moins 14 jours se sont écoulés depuis
 * `masteredAt` sans qu'aucune activité n'ait rafraîchi cette date (voir le
 * commentaire de `recordResult` dans mastery.ts : `masteredAt` est
 * republié à chaque pratique confirmant encore la maîtrise, donc son
 * ancienneté mesure directement l'inactivité sur CETTE compétence).
 *
 * Représentation choisie pour « repasser sous le seuil » : on vide
 * intégralement `last10` (`[]`). C'est la représentation la plus propre et
 * la plus sans ambiguïté disponible avec le contrat figé de `SkillMastery` :
 * - `isMastered` redevient immédiatement `false` (longueur < 10 : « pas
 *   encore mesurable », exactement la même sémantique que pour une
 *   compétence jamais pratiquée) ;
 * - aucune réponse historique n'est falsifiée (on ne réécrit pas des `true`
 *   en `false` dans l'historique, on efface simplement la fenêtre) ;
 * - la fonction est idempotente : un appel ultérieur trouvera
 *   `isMastered === false` et ne fera plus rien (voir le garde-fou
 *   `!isMastered(mastery)` ci-dessous), donc plusieurs décroissances
 *   consécutives sans nouvelle activité n'ont d'effet qu'une seule fois.
 * - `masteredAt` est conservé tel quel (trace historique de la dernière
 *   maîtrise confirmée) ; seul `decayedAt` est mis à jour à `now`. Si la
 *   compétence est plus tard re-maîtrisée, `recordResult` republiera un
 *   `masteredAt` plus récent que `decayedAt`, ce qui permet à `isDecayed`
 *   ci-dessous de redevenir `false` naturellement.
 *
 * Ne mute jamais `mastery` : renvoie soit la même référence (aucun
 * changement), soit un nouvel objet.
 */
export function applyDecay(mastery: SkillMastery, now: Date): SkillMastery {
  if (mastery.masteredAt === null) return mastery // jamais maîtrisée : rien à décroître
  if (!isMastered(mastery)) return mastery // déjà sous le seuil (ou déjà décroissée) : rien à faire

  const masteredAtMs = new Date(mastery.masteredAt).getTime()
  const elapsedMs = now.getTime() - masteredAtMs
  if (elapsedMs < DECAY_THRESHOLD_MS) return mastery // pas encore 14 jours pile

  return {
    ...mastery,
    last10: [],
    decayedAt: now.toISOString(),
  }
}

/**
 * Une compétence est "en décroissance active" si sa dernière décroissance est
 * plus récente (ou aussi récente) que sa dernière maîtrise confirmée — càd
 * qu'elle n'a pas été re-maîtrisée depuis. C'est le prédicat minimal que D2
 * (répétition espacée) pourra consommer pour savoir quelles compétences
 * réinjecter en révision, sans que ce module dépende de D2 en retour.
 */
export function isDecayed(mastery: SkillMastery): boolean {
  if (mastery.decayedAt === null) return false
  if (mastery.masteredAt === null) return true
  return new Date(mastery.decayedAt).getTime() >= new Date(mastery.masteredAt).getTime()
}

/**
 * Applique la décroissance à un ensemble de compétences (par exemple
 * `MasteryState.skills`, mais ce fichier ne dépend pas de `MasteryState` :
 * il accepte n'importe quel `Record<SkillId, SkillMastery>`) et renvoie à la
 * fois le nouvel ensemble et la liste des identifiants de compétences qui
 * viennent de basculer en décroissance lors de CET appel — la donnée
 * minimale dont D2 a besoin pour réinjecter les items correspondants en
 * révision, sans que ce module connaisse `ReviewQueueItem`.
 */
export function applyDecayToSkills(
  skills: Record<SkillId, SkillMastery>,
  now: Date,
): { skills: Record<SkillId, SkillMastery>; decayedSkillIds: SkillId[] } {
  const nextSkills: Record<SkillId, SkillMastery> = {}
  const decayedSkillIds: SkillId[] = []

  for (const [skillId, mastery] of Object.entries(skills)) {
    const decayed = applyDecay(mastery, now)
    nextSkills[skillId] = decayed
    if (decayed !== mastery) {
      decayedSkillIds.push(skillId)
    }
  }

  return { skills: nextSkills, decayedSkillIds }
}
