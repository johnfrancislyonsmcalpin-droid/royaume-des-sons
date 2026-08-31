// Loader et accesseurs pour la table de prononciation et la table de
// confusion (SPEC §3, §7). Le contenu vit exclusivement dans
// pronunciation.json et confusion.json ; ce module ne fait que parser,
// valider (erreur de développement claire si la structure est invalide) et
// exposer des accesseurs typés. Le module voix (A2) et le moteur de
// distracteurs (D2) en dépendent.

import type { GraphemeId } from '../types'
import { curriculum } from './curriculum'
import rawPronunciation from './pronunciation.json'
import rawConfusion from './confusion.json'

function fail(message: string): never {
  throw new Error(`[tables] structure invalide : ${message}`)
}

// --- Prononciation -----------------------------------------------------

function validatePronunciation(data: unknown): Record<string, string> {
  if (typeof data !== 'object' || data === null) {
    fail('pronunciation.json : le document racine n\'est pas un objet')
  }
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      fail(`pronunciation.json["${key}"] doit être une chaîne`)
    }
    result[key] = value
  }
  return result
}

const pronunciationTable: Record<string, string> = validatePronunciation(rawPronunciation)

/**
 * Texte à énoncer pour le SON du graphème `graphemeId`, jamais le nom de la
 * lettre (SPEC §3 : m -> "mmm", pas "ème" ; p -> "peu", pas "pé").
 *
 * Indirection volontaire via `curriculum.graphemes[id].pronunciationKey`
 * (voir src/types.ts) plutôt qu'une clé directe sur `graphemeId` : c'est le
 * contrat fixé par B1, pour que pronunciation.json puisse un jour être
 * réindexé (mutualiser deux graphèmes qui partagent un même son, par
 * exemple) sans casser les appelants.
 *
 * `e-muet` a une entrée volontairement vide ("") : ce graphème n'a pas de
 * son propre à énoncer, c'est la lettre précédente qu'il "réveille"
 * (SPEC §5). Une chaîne vide y est fidèle : ne rien énoncer plutôt que
 * d'inventer un son.
 */
export function getPronunciation(graphemeId: GraphemeId): string {
  const grapheme = curriculum.graphemes[graphemeId]
  if (!grapheme) {
    fail(`getPronunciation("${graphemeId}") : graphème inconnu du curriculum`)
  }
  const key = grapheme.pronunciationKey
  const text = pronunciationTable[key]
  if (text === undefined) {
    fail(
      `getPronunciation("${graphemeId}") : aucune entrée pronunciation.json pour la clé "${key}"`,
    )
  }
  return text
}

// --- Confusion -----------------------------------------------------------

function validateConfusion(data: unknown): Record<string, GraphemeId[]> {
  if (typeof data !== 'object' || data === null) {
    fail('confusion.json : le document racine n\'est pas un objet')
  }
  const result: Record<string, GraphemeId[]> = {}
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) {
      fail(`confusion.json["${key}"] doit être un tableau de chaînes`)
    }
    result[key] = value as GraphemeId[]
  }
  return result
}

const confusionTable: Record<string, GraphemeId[]> = validateConfusion(rawConfusion)

// confusion.json ne déclare chaque paire que dans un seul sens (par
// exemple "b": ["d"]) : le graphe est symétrisé une fois au chargement du
// module pour que getConfusionsFor réponde correctement dans les deux sens
// sans que chaque appelant n'ait à y penser.
const symmetrizedConfusion: Map<GraphemeId, Set<GraphemeId>> = (() => {
  const map = new Map<GraphemeId, Set<GraphemeId>>()
  const add = (a: GraphemeId, b: GraphemeId): void => {
    let set = map.get(a)
    if (!set) {
      set = new Set()
      map.set(a, set)
    }
    set.add(b)
  }
  for (const [id, confusions] of Object.entries(confusionTable)) {
    for (const other of confusions) {
      add(id, other)
      add(other, id)
    }
  }
  return map
})()

/**
 * Graphèmes visuellement ou phonétiquement confondus avec `graphemeId`
 * (SPEC §7), dans les deux sens, même si confusion.json ne déclare la
 * paire que dans un seul sens. Tableau vide si `graphemeId` n'a aucune
 * confusion connue (pas une erreur : tous les graphèmes n'en ont pas).
 */
export function getConfusionsFor(graphemeId: GraphemeId): GraphemeId[] {
  const set = symmetrizedConfusion.get(graphemeId)
  return set ? [...set] : []
}
