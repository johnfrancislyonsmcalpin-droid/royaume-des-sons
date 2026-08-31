// Garde du boss (SPEC §7 dernier paragraphe, §4 ; tâche E3 point 4) : la
// quête boss d'une région ne peut démarrer que si TOUTES les compétences de
// la région sont maîtrisées.
//
// Réutilise `isMastered` (D1/mastery.ts) directement plutôt que
// `canUnlockNextLevel` (D4/progression.ts) : `canUnlockNextLevel` répond à
// « peut-on débloquer le niveau SUIVANT », ce qui exige déjà
// `bossCompleted === true` en entrée — c'est la question posée APRÈS avoir
// joué le boss. Ici la question est l'inverse : « peut-on COMMENCER le
// boss », donc AVANT de le jouer. Décision documentée (ASSUMPTIONS.md) :
// appeler `canUnlockNextLevel(mastery, requiredSkillIds, true)` avec un
// `bossCompleted` hypothétique aurait fonctionné arithmétiquement
// (`bossCompleted` n'intervient que par un ET logique), mais aurait détourné
// le nom d'une fonction pour une question qu'elle ne pose pas. Vérifier
// `isMastered` compétence par compétence, directement, est plus honnête et
// plus lisible pour quiconque relit ce fichier isolément.
import type { MasteryState, SkillId } from '../../types'
import { isMastered } from '../../engine/mastery'

/**
 * Vrai seulement si CHAQUE compétence de `requiredSkillIds` est maîtrisée
 * (D1/isMastered : fenêtre de 10 réponses avec au moins 8 correctes sans
 * indice). `requiredSkillIds` vide est trivialement satisfait (aucune
 * compétence à vérifier) — même comportement documenté que
 * `canUnlockNextLevel` (D4), pour rester cohérent avec le reste du moteur de
 * progression même si ce cas ne devrait jamais se produire avec un
 * curriculum réel (B1 exige au moins une compétence par niveau).
 */
export function canStartBossQuest(mastery: MasteryState, requiredSkillIds: SkillId[]): boolean {
  return requiredSkillIds.every((skillId) => {
    const skillMastery = mastery.skills[skillId]
    return skillMastery !== undefined && isMastered(skillMastery)
  })
}
