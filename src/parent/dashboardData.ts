// Dérivations pures pour le tableau de bord parent (SPEC §9, leaf F1).
//
// Rien ici ne lit localStorage ni le DOM : chaque fonction prend un `SaveFile`
// (contrat figé, src/types.ts) et retourne une forme d'affichage. Dashboard.tsx
// ne fait que rendre ce que ces fonctions calculent.

import type { SaveFile, SkillId } from '../types'
import { curriculum } from '../content/curriculum'
import { uiText } from '../content/uiText'
import { isMastered } from '../engine/mastery'

// ---------------------------------------------------------------------------
// Niveau / région courants
// ---------------------------------------------------------------------------

export interface CurrentPositionSummary {
  level: number
  regionId: string
  regionLabel: string
}

/** Libellé de région lisible par un adulte : uiText.map.regionNames, avec repli sur le regionId brut. */
export function summarizeCurrentPosition(save: SaveFile): CurrentPositionSummary {
  const regionId = save.progress.currentRegionId
  const regionLabel = uiText.map.regionNames[regionId] ?? (regionId || '—')
  return { level: save.progress.currentLevel, regionId, regionLabel }
}

// ---------------------------------------------------------------------------
// Maîtrise par compétence
// ---------------------------------------------------------------------------

export type SkillMasteryStatus = 'not-started' | 'in-progress' | 'mastered'

export interface SkillMasteryRow {
  skillId: SkillId
  label: string
  level: number
  attemptCount: number
  successCount: number
  /** Pourcentage de réussite sans indice sur la fenêtre enregistrée (0 si aucune tentative). */
  percent: number
  status: SkillMasteryStatus
}

/**
 * Une ligne par compétence du curriculum (pas seulement celles déjà
 * pratiquées) : une compétence jamais abordée apparaît avec `attemptCount: 0`
 * et le statut `not-started`, pour que l'adulte voie l'ensemble du parcours.
 */
export function computeSkillMasteryRows(save: SaveFile): SkillMasteryRow[] {
  return Object.values(curriculum.skills)
    .map((skill) => {
      const mastery = save.mastery.skills[skill.id]
      const last10 = mastery?.last10 ?? []
      const attemptCount = last10.length
      const successCount = last10.filter(Boolean).length
      const percent = attemptCount === 0 ? 0 : Math.round((successCount / attemptCount) * 100)
      const status: SkillMasteryStatus =
        attemptCount === 0 ? 'not-started' : mastery && isMastered(mastery) ? 'mastered' : 'in-progress'
      return {
        skillId: skill.id,
        label: skill.label,
        level: skill.level,
        attemptCount,
        successCount,
        percent,
        status,
      }
    })
    .sort((a, b) => a.level - b.level || a.skillId.localeCompare(b.skillId))
}

// ---------------------------------------------------------------------------
// "10 erreurs les plus fréquentes" — approximation documentée (ASSUMPTIONS.md)
// ---------------------------------------------------------------------------
//
// SaveFile ne conserve aucun journal détaillé de ChallengeResult individuels :
// seul l'état agrégé MasteryState (fenêtre glissante last10 PAR COMPÉTENCE)
// est persisté (voir src/types.ts, SkillMastery). Il est donc impossible de
// reconstruire les items ou phrases précis qui ont échoué. Approximation
// retenue : classer les COMPÉTENCES (pas les items) par nombre d'échecs dans
// la fenêtre enregistrée, la pire en tête, et exposer cette liste comme
// "compétences les plus en difficulté" plutôt que des erreurs item par item.
// Une compétence jamais pratiquée ou sans aucun échec enregistré n'apparaît
// jamais dans cette liste (liste vide si aucune donnée exploitable).

export interface FrequentErrorRow {
  skillId: SkillId
  label: string
  errorCount: number
  attemptCount: number
  percent: number
}

const FREQUENT_ERRORS_LIMIT = 10

export function computeFrequentErrorRows(save: SaveFile, limit: number = FREQUENT_ERRORS_LIMIT): FrequentErrorRow[] {
  return computeSkillMasteryRows(save)
    .filter((row) => row.attemptCount > 0 && row.successCount < row.attemptCount)
    .map((row) => ({
      skillId: row.skillId,
      label: row.label,
      errorCount: row.attemptCount - row.successCount,
      attemptCount: row.attemptCount,
      percent: row.percent,
    }))
    .sort((a, b) => b.errorCount - a.errorCount || a.percent - b.percent || a.skillId.localeCompare(b.skillId))
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Temps de jeu par jour sur 14 jours
// ---------------------------------------------------------------------------

export interface DailyMinutesRow {
  date: string // YYYY-MM-DD
  minutes: number
}

const DAILY_MINUTES_WINDOW = 14

/** `progress.sessionMinutesByDay` trié chronologiquement, borné aux 14 dates les plus récentes présentes. */
export function computeDailyMinutesRows(save: SaveFile): DailyMinutesRow[] {
  return Object.entries(save.progress.sessionMinutesByDay)
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-DAILY_MINUTES_WINDOW)
}

// ---------------------------------------------------------------------------
// Compteur "va chercher un grand" et date de dernière sauvegarde
// ---------------------------------------------------------------------------

export function getHelpAdultCount(save: SaveFile): number {
  return save.progress.helpAdultCount
}

export function getLastSavedAt(save: SaveFile): string {
  return save.lastSavedAt
}
