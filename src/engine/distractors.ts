// Sélection des distracteurs (SPEC §7) : jamais aléatoires dans tout le
// corpus. Deux sources autorisées, dans cet ordre de priorité :
//   1) la table de confusion — graphèmes visuellement ou phonétiquement
//      proches du graphème cible (ex. b/d/p/q, m/n, f/v, s/z, ch/j) ;
//   2) en repli, les items déjà rencontrés par le joueur, du même niveau que
//      la cible.
// Un distracteur ne doit JAMAIS provenir d'ailleurs, même si le nombre
// demandé ne peut pas être atteint : retourner moins de distracteurs que
// demandé est acceptable, en choisir un hors de ces deux sources ne l'est
// jamais.

import type { ContentItem, GraphemeId } from '../types'

/**
 * Table de confusion : pour un graphème donné, la liste des graphèmes
 * visuellement ou phonétiquement proches (ex. `{ b: ['d', 'p', 'q'] }`).
 *
 * Interface définie par cette leaf (D2) car la table réelle de la leaf B3
 * n'est pas garantie disponible au moment de l'écriture. Le driver branche la
 * vraie table de confusion (`src/content/confusion.json`, exposée via
 * `src/content/tables.ts`) sur ce même type au moment de l'intégration ; ce
 * module n'a aucune dépendance sur le format JSON réel de B3, seulement sur
 * cette forme `Record<GraphemeId, GraphemeId[]>`.
 *
 * ASSUMPTION : traitée comme un graphe NON dirigé par ce module — une entrée
 * `a: [b]` implique aussi une confusion `b: [a]`, même si la table source ne
 * liste la relation que dans un sens. Les paires de confusion (b/d, m/n, …)
 * sont symétriques par nature ; exiger que B3 liste chaque paire deux fois
 * serait une source d'erreur silencieuse.
 */
export type ConfusionTable = Record<GraphemeId, GraphemeId[]>

function expandSymmetric(table: ConfusionTable): Map<GraphemeId, Set<GraphemeId>> {
  const expanded = new Map<GraphemeId, Set<GraphemeId>>()
  const add = (from: GraphemeId, to: GraphemeId) => {
    if (from === to) return
    let set = expanded.get(from)
    if (!set) {
      set = new Set()
      expanded.set(from, set)
    }
    set.add(to)
  }
  for (const [grapheme, neighbors] of Object.entries(table)) {
    for (const neighbor of neighbors) {
      add(grapheme, neighbor)
      add(neighbor, grapheme)
    }
  }
  return expanded
}

function confusableGraphemes(
  target: ContentItem,
  symmetricTable: Map<GraphemeId, Set<GraphemeId>>,
): Set<GraphemeId> {
  const confusable = new Set<GraphemeId>()
  for (const graphemeId of target.graphemeIds) {
    for (const neighbor of symmetricTable.get(graphemeId) ?? []) {
      confusable.add(neighbor)
    }
  }
  return confusable
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy
}

/**
 * Choisit jusqu'à `count` distracteurs pour `target`, en priorité depuis la
 * table de confusion, puis en repli depuis les items déjà rencontrés par le
 * joueur (`encounteredItemIds`) du même niveau que la cible. Ne choisit
 * jamais un item hors de ces deux sources, même au prix de retourner moins de
 * `count` distracteurs.
 *
 * Restrictions supplémentaires appliquées aux deux sources (ASSUMPTION, non
 * explicitement dictées par SPEC mais nécessaires pour rester cohérent avec
 * la règle d'autonomie — CLAUDE.md #1/#3 — et la contrainte de décodabilité) :
 *   - un distracteur est toujours du même `kind` que la cible (un mot n'est
 *     jamais mélangé à une syllabe ou un graphème isolé) ;
 *   - un distracteur issu de la table de confusion est toujours d'un niveau
 *     `<= target.level` : jamais un graphème que l'enfant n'a pas encore
 *     appris, même s'il est phonétiquement proche.
 */
export function pickDistractors(
  target: ContentItem,
  pool: ContentItem[],
  confusionTable: ConfusionTable,
  encounteredItemIds: Set<string>,
  count: number,
  rng: () => number = Math.random,
): ContentItem[] {
  if (count <= 0) return []

  const candidates = pool.filter((item) => item.id !== target.id && item.kind === target.kind)

  const symmetricTable = expandSymmetric(confusionTable)
  const confusable = confusableGraphemes(target, symmetricTable)
  const confusionSourced = candidates.filter(
    (item) => item.level <= target.level && item.graphemeIds.some((g) => confusable.has(g)),
  )

  const selected: ContentItem[] = []
  const usedIds = new Set<string>([target.id])

  for (const item of shuffle(confusionSourced, rng)) {
    if (selected.length >= count) break
    if (usedIds.has(item.id)) continue
    selected.push(item)
    usedIds.add(item.id)
  }

  if (selected.length < count) {
    const encounteredSourced = candidates.filter(
      (item) =>
        item.level === target.level && encounteredItemIds.has(item.id) && !usedIds.has(item.id),
    )
    for (const item of shuffle(encounteredSourced, rng)) {
      if (selected.length >= count) break
      selected.push(item)
      usedIds.add(item.id)
    }
  }

  return selected
}
