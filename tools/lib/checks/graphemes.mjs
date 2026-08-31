// GB1 / G-B1 (SPEC §5) : chaque item du corpus n'utilise que des graphèmes
// enseignés à son niveau ou avant. Recalculé depuis curriculum.json à chaque
// appel (jamais copié), via graphemesKnownAtLevel.

import { graphemesKnownAtLevel } from '../curriculumLogic.mjs'

/**
 * @param {object} curriculumData
 * @param {Array<object>} corpusItems
 * @returns {Array<{itemId:string, level:number, grapheme:string, sourceFile?:string}>}
 */
export function checkGraphemes(curriculumData, corpusItems) {
  const violations = []
  const cache = new Map()
  for (const item of corpusItems) {
    const level = item?.level
    if (!cache.has(level)) {
      cache.set(level, graphemesKnownAtLevel(curriculumData, level))
    }
    const known = cache.get(level)
    const graphemeIds = Array.isArray(item?.graphemeIds) ? item.graphemeIds : []
    for (const grapheme of graphemeIds) {
      if (!known.has(grapheme)) {
        violations.push({
          itemId: item.id ?? '(id manquant)',
          level,
          grapheme,
          sourceFile: item.__sourceFile,
        })
      }
    }
  }
  return violations
}
