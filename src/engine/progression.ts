// Moteur de progression — déblocage de niveau (leaf D4, SPEC §7 dernier §).
//
// Règle absolue : « Passer de niveau exige la maîtrise de TOUTES les
// compétences du niveau ET la réussite du boss. Ni le temps de jeu ni le
// nombre de tentatives ne débloquent quoi que ce soit. »
//
// `canUnlockNextLevel` ne prend en paramètre ni durée de session ni compteur
// de tentatives : il est donc impossible PAR CONSTRUCTION de lui faire
// produire un déblocage sur la base de ces signaux, puisqu'elle ne les reçoit
// jamais et ne les lit nulle part (pas d'accès à `Date.now()`, pas de lecture
// d'un historique de tentatives).

import type { MasteryState, SkillId, SkillMastery } from '../types'

/** Taille de la fenêtre glissante de réponses retenue par compétence. */
const MASTERY_WINDOW = 10

/** Nombre minimal de réponses correctes-sans-indice dans la fenêtre pour être maîtrisé. */
const MASTERY_THRESHOLD = 8

// Duplication assumée, documentée pour ASSUMPTIONS.md : `isMastered` est
// redéfinie ici plutôt qu'importée de `src/engine/mastery.ts` (propriété de
// la leaf D1, écrite en parallèle sous le même dispatch — l'importer aurait
// couplé D4 à un module en cours d'écriture ailleurs). La règle appliquée est
// strictement celle de SPEC §7 : « une compétence est maîtrisée quand 8 des
// 10 dernières réponses sont correctes et sans indice » — identique en
// substance à `isMastered` de D1 (fenêtre de 10, seuil de 8, `false` tant que
// la fenêtre n'a pas 10 entrées, jamais `true` par optimisme sur une fenêtre
// incomplète). `SkillMastery.last10` ne contient, par contrat de
// `src/types.ts`, que des réponses déjà filtrées « sans indice » : ce module
// n'a donc pas à re-filtrer l'aide utilisée. Le driver pourra factoriser les
// deux implémentations à l'intégration (D1 et D4 sur une même source unique).
function isMastered(skill: SkillMastery | undefined): boolean {
  if (!skill) return false
  if (skill.last10.length < MASTERY_WINDOW) return false
  const recent = skill.last10.slice(-MASTERY_WINDOW)
  const successCount = recent.filter((entry) => entry).length
  return successCount >= MASTERY_THRESHOLD
}

/**
 * Vrai seulement si CHAQUE compétence de `requiredSkillIds` est maîtrisée
 * (au sens de `isMastered` ci-dessus) ET que `bossCompleted` est vrai.
 * `requiredSkillIds` vide est trivialement satisfait par la boucle `every`
 * (aucune compétence à vérifier) mais `bossCompleted` reste requis dans tous
 * les cas : aucun raccourci de déblocage n'existe hors de ces deux
 * conditions.
 */
export function canUnlockNextLevel(
  mastery: MasteryState,
  requiredSkillIds: SkillId[],
  bossCompleted: boolean,
): boolean {
  if (!bossCompleted) return false
  return requiredSkillIds.every((skillId) => isMastered(mastery.skills[skillId]))
}
