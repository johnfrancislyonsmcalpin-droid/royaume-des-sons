// Loader et fonctions dérivées pour le curriculum (SPEC §5).
// Le contenu vit exclusivement dans curriculum.json ; ce module ne fait que
// parser, valider (erreur de développement claire si la structure est invalide)
// et exposer des dérivations utiles au moteur (B2, B3, B4 en dépendent).

import type {
  Curriculum,
  CurriculumLevel,
  Grapheme,
  GraphemeId,
  Skill,
  SkillId,
} from '../types'
import rawCurriculum from './curriculum.json'

function fail(message: string): never {
  throw new Error(`[curriculum] structure invalide : ${message}`)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateGrapheme(value: unknown, id: string): Grapheme {
  if (typeof value !== 'object' || value === null) {
    fail(`graphemes["${id}"] n'est pas un objet`)
  }
  const candidate = value as Record<string, unknown>
  if (!isNonEmptyString(candidate.id) || candidate.id !== id) {
    fail(`graphemes["${id}"].id absent ou incohérent avec sa clé`)
  }
  if (!isFiniteNumber(candidate.level) || candidate.level < 1 || candidate.level > 10) {
    fail(`graphemes["${id}"].level doit être un nombre entre 1 et 10`)
  }
  if (!isNonEmptyString(candidate.pronunciationKey)) {
    fail(`graphemes["${id}"].pronunciationKey manquant`)
  }
  return {
    id: candidate.id,
    level: candidate.level,
    pronunciationKey: candidate.pronunciationKey,
  }
}

function validateSkill(value: unknown, id: string): Skill {
  if (typeof value !== 'object' || value === null) {
    fail(`skills["${id}"] n'est pas un objet`)
  }
  const candidate = value as Record<string, unknown>
  if (!isNonEmptyString(candidate.id) || candidate.id !== id) {
    fail(`skills["${id}"].id absent ou incohérent avec sa clé`)
  }
  if (!isFiniteNumber(candidate.level) || candidate.level < 1 || candidate.level > 10) {
    fail(`skills["${id}"].level doit être un nombre entre 1 et 10`)
  }
  if (!isNonEmptyString(candidate.label)) {
    fail(`skills["${id}"].label manquant`)
  }
  if (!Array.isArray(candidate.graphemeIds) || !candidate.graphemeIds.every(isNonEmptyString)) {
    fail(`skills["${id}"].graphemeIds doit être un tableau de chaînes`)
  }
  return {
    id: candidate.id,
    level: candidate.level,
    label: candidate.label,
    graphemeIds: candidate.graphemeIds as GraphemeId[],
  }
}

function validateLevel(value: unknown, index: number): CurriculumLevel {
  if (typeof value !== 'object' || value === null) {
    fail(`levels[${index}] n'est pas un objet`)
  }
  const candidate = value as Record<string, unknown>
  if (!isFiniteNumber(candidate.level) || candidate.level < 1 || candidate.level > 10) {
    fail(`levels[${index}].level doit être un nombre entre 1 et 10`)
  }
  if (!isNonEmptyString(candidate.regionId)) {
    fail(`levels[${index}].regionId manquant`)
  }
  if (!isNonEmptyString(candidate.labelKey)) {
    fail(`levels[${index}].labelKey manquant`)
  }
  if (!Array.isArray(candidate.skillIds) || !candidate.skillIds.every(isNonEmptyString) || candidate.skillIds.length === 0) {
    fail(`levels[${index}].skillIds doit être un tableau non vide de chaînes`)
  }
  if (!isNonEmptyString(candidate.bossQuestId)) {
    fail(`levels[${index}].bossQuestId manquant`)
  }
  return {
    level: candidate.level,
    regionId: candidate.regionId,
    labelKey: candidate.labelKey,
    skillIds: candidate.skillIds as SkillId[],
    bossQuestId: candidate.bossQuestId,
  }
}

export function loadCurriculum(data: unknown): Curriculum {
  if (typeof data !== 'object' || data === null) {
    fail('le document racine n\'est pas un objet')
  }
  const candidate = data as Record<string, unknown>

  if (!Array.isArray(candidate.levels)) {
    fail('"levels" doit être un tableau')
  }
  const levels = candidate.levels.map((level, index) => validateLevel(level, index))

  if (typeof candidate.skills !== 'object' || candidate.skills === null) {
    fail('"skills" doit être un objet')
  }
  const skillEntries = Object.entries(candidate.skills as Record<string, unknown>)
  const skills: Record<SkillId, Skill> = {}
  for (const [id, value] of skillEntries) {
    skills[id] = validateSkill(value, id)
  }

  if (typeof candidate.graphemes !== 'object' || candidate.graphemes === null) {
    fail('"graphemes" doit être un objet')
  }
  const graphemeEntries = Object.entries(candidate.graphemes as Record<string, unknown>)
  const graphemes: Record<GraphemeId, Grapheme> = {}
  for (const [id, value] of graphemeEntries) {
    graphemes[id] = validateGrapheme(value, id)
  }

  // Cohérence : niveaux 1..10 sans trou ni doublon, dans l'ordre.
  const expectedLevels = Array.from({ length: 10 }, (_, i) => i + 1)
  const actualLevels = levels.map((l) => l.level)
  if (actualLevels.length !== expectedLevels.length || actualLevels.some((n, i) => n !== expectedLevels[i])) {
    fail(`"levels" doit contenir exactement les niveaux 1 à 10 dans l'ordre, reçu [${actualLevels.join(', ')}]`)
  }

  // Cohérence : chaque skillId référencé par un niveau existe dans "skills"
  // et son propre .level correspond au niveau qui le référence.
  for (const level of levels) {
    for (const skillId of level.skillIds) {
      const skill = skills[skillId]
      if (!skill) {
        fail(`levels[level=${level.level}] référence le skillId "${skillId}" absent de "skills"`)
      }
      if (skill.level !== level.level) {
        fail(`skills["${skillId}"].level (${skill.level}) ne correspond pas au niveau qui le référence (${level.level})`)
      }
    }
  }

  // Cohérence : chaque graphemeId référencé par une compétence existe dans "graphemes".
  for (const skill of Object.values(skills)) {
    for (const graphemeId of skill.graphemeIds) {
      if (!graphemes[graphemeId]) {
        fail(`skills["${skill.id}"] référence le graphemeId "${graphemeId}" absent de "graphemes"`)
      }
    }
  }

  return { levels, skills, graphemes }
}

export const curriculum: Curriculum = loadCurriculum(rawCurriculum)

/**
 * Union cumulative des graphèmes enseignés au niveau `level` et à tous les
 * niveaux précédents (1..level inclus). Signature figée : B2.x et B3 en
 * dépendent directement.
 */
export function graphemesKnownAtLevel(level: number): Set<GraphemeId> {
  const known = new Set<GraphemeId>()
  for (const grapheme of Object.values(curriculum.graphemes)) {
    if (grapheme.level <= level) {
      known.add(grapheme.id)
    }
  }
  return known
}
