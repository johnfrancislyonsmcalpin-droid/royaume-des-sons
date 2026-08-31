// Validation + migration de la sauvegarde (leaf A3, OWNS: src/save/**).
//
// Le contrat courant (`SaveFile`, `SCHEMA_VERSION`) vient de src/types.ts et est figé.
// Ce module sait lire n'importe quelle version de sauvegarde *connue* (schemaVersion
// antérieur) et produire un `SaveFile` courant valide, sans perte de données.
//
// Fixture "v1" du brief (ASSUMPTIONS.md) : SCHEMA_VERSION vaut déjà 1 dans le contrat
// figé, donc il n'existe pas de version "0.x" antérieure dans le code de production.
// Pour respecter la consigne ("fabrique un fixture v1 plausible, une forme de
// sauvegarde légèrement différente, ex. sans un champ ajouté depuis"), la version
// antérieure plausible est modélisée ici comme `schemaVersion: 0` — une forme de
// sauvegarde qui existait avant deux ajouts de champs :
//   - `progress.helpAdultCount` (journalisation "Va chercher un grand", SPEC §8)
//   - `mastery.reviewQueue` (répétition espacée, SPEC §7)
// La migration v0 -> v1 (courant) comble ces deux champs avec des valeurs par
// défaut neutres et préserve tout le reste à l'identique.

import { SCHEMA_VERSION } from '../types'
import type {
  AvatarState,
  Challenge,
  ChallengeOption,
  ChallengeResult,
  HelpLevel,
  QuestState,
  ReviewQueueItem,
  SaveFile,
  SkillMastery,
} from '../types'

export type SaveValidationReason = 'invalid-shape' | 'unknown-schema-version'

export class SaveValidationError extends Error {
  reason: SaveValidationReason

  constructor(reason: SaveValidationReason, message: string) {
    super(message)
    this.reason = reason
    this.name = 'SaveValidationError'
  }
}

/** Forme de sauvegarde antérieure connue (voir note d'hypothèse en tête de fichier). */
export interface LegacySaveFileV0 {
  schemaVersion: 0
  mastery: {
    skills: Record<string, SkillMastery>
    // pas de reviewQueue en v0 : la répétition espacée n'existait pas encore
  }
  avatar: AvatarState
  progress: {
    currentLevel: number
    currentRegionId: string
    unlockedRegionIds: string[]
    grandLivreItemIds: string[]
    // pas de helpAdultCount en v0
    sessionMinutesByDay: Record<string, number>
  }
  currentQuestState: QuestState | null
  lastSavedAt: string
}

const KNOWN_SCHEMA_VERSIONS = [0, SCHEMA_VERSION] as const

// ---- gardes de type minimales -------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value)
}

function isHelpLevel(value: unknown): value is HelpLevel {
  return value === 0 || value === 1 || value === 2 || value === 3
}

function fail(message: string): never {
  throw new SaveValidationError('invalid-shape', message)
}

function isChallengeOption(value: unknown): value is ChallengeOption {
  return (
    isPlainObject(value) &&
    isString(value.id) &&
    isString(value.contentItemId) &&
    isBoolean(value.isDistractor)
  )
}

function isChallenge(value: unknown): value is Challenge {
  return (
    isPlainObject(value) &&
    isString(value.id) &&
    isString(value.kind) &&
    isString(value.skillId) &&
    isString(value.targetItemId) &&
    Array.isArray(value.options) &&
    value.options.every(isChallengeOption) &&
    isBoolean(value.isReview)
  )
}

function isChallengeResult(value: unknown): value is ChallengeResult {
  return (
    isPlainObject(value) &&
    isString(value.challengeId) &&
    isBoolean(value.correct) &&
    isHelpLevel(value.usedHelpLevel) &&
    isBoolean(value.usedListenAgain) &&
    isFiniteNumber(value.responseMs) &&
    isString(value.timestamp)
  )
}

function isQuestState(value: unknown): value is QuestState {
  return (
    isPlainObject(value) &&
    isString(value.questId) &&
    isString(value.regionId) &&
    Array.isArray(value.challengeQueue) &&
    value.challengeQueue.every(isChallenge) &&
    isFiniteNumber(value.currentIndex) &&
    Array.isArray(value.results) &&
    value.results.every(isChallengeResult) &&
    isString(value.startedAt)
  )
}

function isQuestStateOrNull(value: unknown): value is QuestState | null {
  return value === null || isQuestState(value)
}

function isSkillMastery(value: unknown): value is SkillMastery {
  return (
    isPlainObject(value) &&
    isString(value.skillId) &&
    Array.isArray(value.last10) &&
    value.last10.every(isBoolean) &&
    isNullableString(value.masteredAt) &&
    isNullableString(value.decayedAt)
  )
}

function isSkillsRecord(value: unknown): value is Record<string, SkillMastery> {
  return isPlainObject(value) && Object.values(value).every(isSkillMastery)
}

function isReviewQueueItem(value: unknown): value is ReviewQueueItem {
  return (
    isPlainObject(value) &&
    isString(value.id) &&
    isString(value.contentItemId) &&
    isString(value.skillId) &&
    isString(value.createdAt) &&
    (value.stage === 1 || value.stage === 2 || value.stage === 3) &&
    isFiniteNumber(value.dueAfterQuestCount)
  )
}

function isAvatarState(value: unknown): value is AvatarState {
  return (
    isPlainObject(value) &&
    isString(value.avatarId) &&
    isString(value.companionId) &&
    isStringArray(value.cosmetics) &&
    isFiniteNumber(value.xp) &&
    isFiniteNumber(value.coins)
  )
}

function isSessionMinutesByDay(value: unknown): value is Record<string, number> {
  return isPlainObject(value) && Object.values(value).every(isFiniteNumber)
}

// ---- validation par version -----------------------------------------------

function validateCurrentShape(data: Record<string, unknown>): SaveFile {
  if (data.schemaVersion !== SCHEMA_VERSION) fail('schemaVersion inattendu pour la forme courante')
  if (!isPlainObject(data.mastery)) fail('mastery manquant ou invalide')
  const rawMastery = data.mastery
  if (!isSkillsRecord(rawMastery.skills)) fail('mastery.skills invalide')
  const masterySkills = rawMastery.skills as Record<string, SkillMastery>
  if (!Array.isArray(rawMastery.reviewQueue) || !rawMastery.reviewQueue.every(isReviewQueueItem)) {
    fail('mastery.reviewQueue invalide')
  }
  const reviewQueue = rawMastery.reviewQueue as ReviewQueueItem[]
  if (!isAvatarState(data.avatar)) fail('avatar invalide')
  const avatar = data.avatar as AvatarState
  if (!isPlainObject(data.progress)) fail('progress manquant ou invalide')
  const rawProgress = data.progress
  if (
    !isFiniteNumber(rawProgress.currentLevel) ||
    !isString(rawProgress.currentRegionId) ||
    !isStringArray(rawProgress.unlockedRegionIds) ||
    !isStringArray(rawProgress.grandLivreItemIds) ||
    !isFiniteNumber(rawProgress.helpAdultCount) ||
    !isSessionMinutesByDay(rawProgress.sessionMinutesByDay)
  ) {
    fail('progress invalide')
  }
  const progress = rawProgress as {
    currentLevel: number
    currentRegionId: string
    unlockedRegionIds: string[]
    grandLivreItemIds: string[]
    helpAdultCount: number
    sessionMinutesByDay: Record<string, number>
  }
  if (!isQuestStateOrNull(data.currentQuestState)) fail('currentQuestState invalide')
  const currentQuestState = data.currentQuestState as QuestState | null
  if (!isString(data.lastSavedAt)) fail('lastSavedAt invalide')
  const lastSavedAt = data.lastSavedAt as string

  return {
    schemaVersion: SCHEMA_VERSION,
    mastery: {
      skills: masterySkills,
      reviewQueue,
    },
    avatar,
    progress: {
      currentLevel: progress.currentLevel,
      currentRegionId: progress.currentRegionId,
      unlockedRegionIds: progress.unlockedRegionIds,
      grandLivreItemIds: progress.grandLivreItemIds,
      helpAdultCount: progress.helpAdultCount,
      sessionMinutesByDay: progress.sessionMinutesByDay,
    },
    currentQuestState,
    lastSavedAt,
  }
}

function validateLegacyV0Shape(data: Record<string, unknown>): LegacySaveFileV0 {
  if (data.schemaVersion !== 0) fail('schemaVersion inattendu pour la forme v0')
  if (!isPlainObject(data.mastery)) fail('mastery manquant ou invalide (v0)')
  const rawMastery = data.mastery
  if (!isSkillsRecord(rawMastery.skills)) fail('mastery.skills invalide (v0)')
  const masterySkills = rawMastery.skills as Record<string, SkillMastery>
  if (!isAvatarState(data.avatar)) fail('avatar invalide (v0)')
  const avatar = data.avatar as AvatarState
  if (!isPlainObject(data.progress)) fail('progress manquant ou invalide (v0)')
  const rawProgress = data.progress
  if (
    !isFiniteNumber(rawProgress.currentLevel) ||
    !isString(rawProgress.currentRegionId) ||
    !isStringArray(rawProgress.unlockedRegionIds) ||
    !isStringArray(rawProgress.grandLivreItemIds) ||
    !isSessionMinutesByDay(rawProgress.sessionMinutesByDay)
  ) {
    fail('progress invalide (v0)')
  }
  const progress = rawProgress as {
    currentLevel: number
    currentRegionId: string
    unlockedRegionIds: string[]
    grandLivreItemIds: string[]
    sessionMinutesByDay: Record<string, number>
  }
  if (!isQuestStateOrNull(data.currentQuestState)) fail('currentQuestState invalide (v0)')
  const currentQuestState = data.currentQuestState as QuestState | null
  if (!isString(data.lastSavedAt)) fail('lastSavedAt invalide (v0)')
  const lastSavedAt = data.lastSavedAt as string

  return {
    schemaVersion: 0,
    mastery: { skills: masterySkills },
    avatar,
    progress: {
      currentLevel: progress.currentLevel,
      currentRegionId: progress.currentRegionId,
      unlockedRegionIds: progress.unlockedRegionIds,
      grandLivreItemIds: progress.grandLivreItemIds,
      sessionMinutesByDay: progress.sessionMinutesByDay,
    },
    currentQuestState,
    lastSavedAt,
  }
}

/** Migration v0 -> v1 (courant) : ajoute les champs introduits depuis, sans perte. */
export function migrateV0ToV1(legacy: LegacySaveFileV0): SaveFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    mastery: {
      skills: legacy.mastery.skills,
      reviewQueue: [],
    },
    avatar: legacy.avatar,
    progress: {
      currentLevel: legacy.progress.currentLevel,
      currentRegionId: legacy.progress.currentRegionId,
      unlockedRegionIds: legacy.progress.unlockedRegionIds,
      grandLivreItemIds: legacy.progress.grandLivreItemIds,
      helpAdultCount: 0,
      sessionMinutesByDay: legacy.progress.sessionMinutesByDay,
    },
    currentQuestState: legacy.currentQuestState,
    lastSavedAt: legacy.lastSavedAt,
  }
}

/**
 * Point d'entrée unique : valide une donnée de provenance inconnue (localStorage,
 * import JSON) contre une version de schéma connue, puis migre vers `SaveFile`
 * courant si nécessaire. Ne lève que `SaveValidationError` (jamais d'autre
 * exception) afin que les appelants puissent distinguer JSON malformé (géré en
 * amont par `JSON.parse`) de forme invalide / version inconnue.
 */
export function parseKnownSave(data: unknown): SaveFile {
  if (!isPlainObject(data)) fail('la sauvegarde doit être un objet JSON')
  if (!isFiniteNumber(data.schemaVersion)) fail('schemaVersion manquant ou invalide')

  if (data.schemaVersion === SCHEMA_VERSION) {
    return validateCurrentShape(data)
  }
  if (data.schemaVersion === 0) {
    return migrateV0ToV1(validateLegacyV0Shape(data))
  }

  throw new SaveValidationError(
    'unknown-schema-version',
    `schemaVersion inconnu : ${data.schemaVersion} (versions connues : ${KNOWN_SCHEMA_VERSIONS.join(', ')})`,
  )
}
