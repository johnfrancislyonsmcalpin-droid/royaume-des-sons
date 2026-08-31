// GB4 / G-B4 (SPEC §3) : la table de prononciation couvre 100% des
// graphèmes du curriculum (niveaux 1 à 10, donc graphemesKnownAtLevel(10) —
// c'est-à-dire tous les graphèmes déclarés). Suit la même indirection que
// src/content/tables.ts::getPronunciation : graphemeId -> pronunciationKey
// -> entrée pronunciation.json. Une entrée présente avec une valeur chaîne
// vide ("") compte comme couverte (cas documenté de "e-muet" : le graphème
// n'a pas de son propre à énoncer, une chaîne vide est fidèle à cette
// réalité, ce n'est pas une absence de couverture).

import { graphemesKnownAtLevel } from '../curriculumLogic.mjs'

/**
 * @param {object} curriculumData
 * @param {Record<string,string>} pronunciationData
 * @returns {{total:number, missing:string[]}}
 */
export function checkPronunciation(curriculumData, pronunciationData) {
  const known = graphemesKnownAtLevel(curriculumData, 10)
  const missing = []
  for (const graphemeId of known) {
    const grapheme = curriculumData.graphemes[graphemeId]
    const key = grapheme?.pronunciationKey
    if (typeof key !== 'string' || key.length === 0) {
      missing.push(`${graphemeId} (pronunciationKey manquante)`)
      continue
    }
    if (!Object.prototype.hasOwnProperty.call(pronunciationData, key)) {
      missing.push(`${graphemeId} (clé "${key}" absente de pronunciation.json)`)
      continue
    }
    if (typeof pronunciationData[key] !== 'string') {
      missing.push(`${graphemeId} (clé "${key}" : valeur non-chaîne)`)
    }
  }
  return { total: known.size, missing }
}
