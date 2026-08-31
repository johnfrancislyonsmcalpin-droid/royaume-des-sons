// Cycle de vie d'une quête (SPEC §4, §7, §8 ; tâche E3 points 5-6) :
// démarrage, fin (récompenses + Grand Livre + déblocage de région) et le
// contrat de reprise après rechargement.
import type {
  AvatarState,
  Challenge,
  ChallengeResult,
  MasteryState,
  ProgressState,
  QuestState,
} from '../../types'
import { curriculum } from '../../content/curriculum'
import { isMastered } from '../../engine/mastery'
import { computeQuestReward } from '../rewards/rewardScale'
import { applyQuestReward } from '../rewards/rewards'

/**
 * Construit l'état initial d'une quête à partir des défis assemblés
 * (questAssembly.ts::assembleQuest). Toujours `currentIndex: 0` /
 * `results: []` : une quête commence toujours par son premier défi
 * (SPEC §4).
 */
export function startQuest(
  questId: string,
  regionId: string,
  challengeQueue: Challenge[],
  startedAt: string = new Date().toISOString(),
): QuestState {
  return { questId, regionId, challengeQueue, currentIndex: 0, results: [], startedAt }
}

/**
 * Contrat de reprise (tâche E3 point 6) : `QuestState` ne contient que des
 * données sérialisables au sens JSON (types.ts, FIGÉ : chaînes, nombres,
 * tableaux, objets plats) — cette fonction affirme/valide ce contrat pour
 * l'appelant (A3 persistance, hors OWNS de cette leaf), elle ne transforme
 * rien. Un aller-retour `JSON.stringify`/`JSON.parse` sur ce que produit
 * `assembleQuest`/`startQuest` doit reproduire exactement le même défi en
 * cours (`challengeQueue[currentIndex]` identique) : c'est ce que vérifie
 * questLifecycle.test.ts (G4).
 */
export function resumeQuestState(saved: QuestState): QuestState {
  return saved
}

/** Nombre de défis DISTINCTS réussis dans la quête : un même `challengeId`
 * ne doit jamais compter plusieurs fois pour la récompense, même s'il a
 * produit plusieurs `ChallengeResult` (essai raté puis réussi, ou
 * révélation après 2 échecs, SPEC §8). */
function countDistinctCorrectChallenges(results: readonly ChallengeResult[]): number {
  return new Set(results.filter((result) => result.correct).map((result) => result.challengeId)).size
}

/**
 * Règle du Grand Livre (décision libre de cette leaf, ASSUMPTIONS.md : SPEC
 * §4 ne fixe pas la règle d'entrée exacte). Un `ContentItem` entre dans
 * `ProgressState.grandLivreItemIds` quand DEUX conditions sont réunies pour
 * un défi de la quête qui vient de se terminer :
 *   1. ce défi précis a été répondu correctement au moins une fois
 *      (`ChallengeResult.correct === true` pour son `challengeId`) ;
 *   2. la compétence associée (`Challenge.skillId`) est MAÎTRISÉE dans
 *      `mastery` — le paramètre `mastery` passé ici est supposé déjà à jour
 *      de TOUS les résultats de cette quête (appliqués en amont, défi par
 *      défi, via `recordResult`/D1, par le moteur de session/QuestRunner) ;
 *      cette fonction ne recalcule aucune maîtrise elle-même, elle la LIT
 *      seulement.
 * Raisonnement : le Grand Livre promet des mots « maîtrisés » (SPEC §4), pas
 * seulement « réussis une fois ». Un item deviné une seule fois avant même
 * d'être appris entrerait sinon dans la galerie, ce qui viderait le mot
 * « maîtrisé » de son sens pour l'enfant qui le réécoute plus tard comme un
 * modèle fiable de lecture.
 */
function computeGrandLivreAdditions(
  challengeQueue: readonly Challenge[],
  results: readonly ChallengeResult[],
  mastery: MasteryState,
): string[] {
  const correctChallengeIds = new Set(results.filter((result) => result.correct).map((result) => result.challengeId))
  const additions: string[] = []
  const seen = new Set<string>()

  for (const challenge of challengeQueue) {
    if (!correctChallengeIds.has(challenge.id)) continue
    const skillMastery = mastery.skills[challenge.skillId]
    if (!skillMastery || !isMastered(skillMastery)) continue
    if (seen.has(challenge.targetItemId)) continue
    seen.add(challenge.targetItemId)
    additions.push(challenge.targetItemId)
  }

  return additions
}

/** Étend `progress.grandLivreItemIds` avec les nouveaux ids, dédoublonnés
 * (jamais de doublon même si un id y figurait déjà). Fonction pure : renvoie
 * `progress` inchangé (même référence) si rien de neuf à ajouter. */
function addToGrandLivre(progress: ProgressState, newItemIds: readonly string[]): ProgressState {
  const existing = new Set(progress.grandLivreItemIds)
  const additions = newItemIds.filter((id) => !existing.has(id))
  if (additions.length === 0) return progress
  return { ...progress, grandLivreItemIds: [...progress.grandLivreItemIds, ...additions] }
}

/**
 * Débloque la région suivante quand `completedRegionId` vient de terminer
 * son boss (SPEC §4/§7 : « le boss débloque la région suivante » — jamais
 * avant, garanti en amont par bossGate.ts qui protège le DÉMARRAGE du
 * boss, pas sa fin). S'appuie sur `curriculum.levels`, déjà vérifié 1..10
 * sans trou ni doublon (B1). Niveau 10 (boss final) : aucune région
 * suivante à débloquer — `ProgressState` (types.ts, FIGÉ) n'a aucun champ
 * dédié pour le « mode aventure libre » de SPEC §5 niveau 10 ; cette
 * fonction laisse `progress` inchangé dans ce cas (ASSUMPTION documentée :
 * le déblocage du mode aventure libre attend un futur ajout au contrat,
 * hors de ce que src/types.ts permet aujourd'hui — pas un oubli).
 */
function unlockNextRegionAfterBoss(progress: ProgressState, completedRegionId: string): ProgressState {
  const completedLevel = curriculum.levels.find((level) => level.regionId === completedRegionId)
  if (!completedLevel) return progress // regionId inconnu : défensif, ne devrait jamais arriver

  const nextLevel = curriculum.levels.find((level) => level.level === completedLevel.level + 1)
  if (!nextLevel) return progress // niveau 10 : pas de région suivante

  const unlockedRegionIds = progress.unlockedRegionIds.includes(nextLevel.regionId)
    ? progress.unlockedRegionIds
    : [...progress.unlockedRegionIds, nextLevel.regionId]

  return {
    ...progress,
    unlockedRegionIds,
    currentLevel: nextLevel.level,
    currentRegionId: nextLevel.regionId,
  }
}

export interface CompleteQuestResult {
  avatar: AvatarState
  progress: ProgressState
  /** QuestState à écrire par l'appelant pour vider la quête en cours
   * (SPEC §4, tâche E3 point 5) : toujours `null`. */
  clearedQuestState: null
}

/**
 * Termine une quête réussie (tâche E3 point 5) : vide le `QuestState` (via
 * `clearedQuestState: null`, à persister par l'appelant), applique la
 * récompense d'échelle (E2 : `computeQuestReward` + `applyQuestReward`) et
 * met à jour le Grand Livre (règle ci-dessus). Si `isBossQuest`, débloque la
 * région suivante.
 *
 * `mastery` doit déjà refléter TOUS les résultats de cette quête (appliqués
 * en amont, défi par défi, par le moteur de session — voir
 * useQuestSession.ts) : cette fonction ne recalcule aucune maîtrise
 * elle-même.
 *
 * Décision libre (ASSUMPTIONS.md) : `cosmeticIdsUnlocked` est toujours `[]`
 * ici. Aucun catalogue « quête N débloque le cosmétique X » n'existe dans le
 * dépôt (E2/avatarData.ts ne fournit qu'une liste de choix d'avatar/
 * compagnon, pas une table de déblocage progressif) ; en fabriquer une
 * serait produire du contenu hors du périmètre OWNS de cette leaf.
 * `applyQuestReward` reste appelée avec un tableau vide plutôt que
 * contournée, pour que XP/pièces restent correctement appliquées dès
 * aujourd'hui : le jour où un catalogue de cosmétiques existe, seul cet
 * argument changera.
 */
export function completeQuest(
  questState: QuestState,
  mastery: MasteryState,
  avatar: AvatarState,
  progress: ProgressState,
  isBossQuest: boolean,
): CompleteQuestResult {
  const correctCount = countDistinctCorrectChallenges(questState.results)
  const reward = computeQuestReward(correctCount, isBossQuest)
  const nextAvatar = applyQuestReward(avatar, reward.xp, reward.coins, [])

  const grandLivreAdditions = computeGrandLivreAdditions(questState.challengeQueue, questState.results, mastery)
  let nextProgress = addToGrandLivre(progress, grandLivreAdditions)

  if (isBossQuest) {
    nextProgress = unlockNextRegionAfterBoss(nextProgress, questState.regionId)
  }

  return { avatar: nextAvatar, progress: nextProgress, clearedQuestState: null }
}
