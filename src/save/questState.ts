// Écriture immédiate du QuestState (leaf A3, OWNS: src/save/**).
//
// SPEC §3 : « Écriture après chaque défi, pas seulement en fin de quête : l'app
// peut être tuée à tout moment. Reprise exacte au défi en cours après
// rechargement. » Ces fonctions persistent immédiatement dans localStorage,
// jamais en mémoire seule.

import type { ChallengeResult, QuestState, SaveFile } from '../types'
import { loadSaveFile, writeSaveFile } from './storage'

function devWarn(...args: unknown[]): void {
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
  if (isDev) {
    console.warn('[save]', ...args)
  }
}

/**
 * Démarre (ou remplace) la quête en cours et persiste immédiatement.
 * `currentIndex` et `results` repartent à zéro : c'est le point d'entrée d'une
 * nouvelle quête, pas une reprise (la reprise se fait en relisant simplement
 * `loadSaveFile().currentQuestState`).
 */
export function setCurrentQuestState(
  quest: QuestState,
  save: SaveFile = loadSaveFile(),
  nowIso: string = new Date().toISOString(),
): SaveFile {
  const updated: SaveFile = { ...save, currentQuestState: quest }
  return writeSaveFile(updated, nowIso).save
}

/** Efface la quête en cours (quête terminée) et persiste immédiatement. */
export function clearCurrentQuestState(
  save: SaveFile = loadSaveFile(),
  nowIso: string = new Date().toISOString(),
): SaveFile {
  const updated: SaveFile = { ...save, currentQuestState: null }
  return writeSaveFile(updated, nowIso).save
}

/**
 * Enregistre le résultat d'UN défi et persiste immédiatement le QuestState mis
 * à jour (SPEC §3, gate G-A3/G2). Appelée après chaque `ChallengeResult`, pas
 * seulement en fin de quête.
 *
 * Si aucune quête n'est en cours (`currentQuestState === null`), c'est une
 * erreur d'appelant (un résultat de défi sans quête active) : on ne bloque
 * jamais l'enfant, on journalise en dev et on retourne la sauvegarde
 * inchangée sans écrire.
 */
export function recordChallengeResult(
  result: ChallengeResult,
  save: SaveFile = loadSaveFile(),
  nowIso: string = new Date().toISOString(),
): SaveFile {
  const quest = save.currentQuestState
  if (quest === null) {
    devWarn('recordChallengeResult appelé sans quête en cours, résultat ignoré', result)
    return save
  }

  const updatedQuest: QuestState = {
    ...quest,
    results: [...quest.results, result],
    currentIndex: quest.currentIndex + 1,
  }
  const updated: SaveFile = { ...save, currentQuestState: updatedQuest }
  return writeSaveFile(updated, nowIso).save
}
