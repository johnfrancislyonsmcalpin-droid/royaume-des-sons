import { describe, expect, it } from 'vitest'
import { pickDistractors, type ConfusionTable } from './distractors'
import type { ContentItem } from '../types'

function word(
  id: string,
  text: string,
  graphemeIds: string[],
  level: number,
  overrides: Partial<ContentItem> = {},
): ContentItem {
  return {
    id,
    kind: 'word',
    level,
    text,
    graphemeIds,
    emoji: '🔤',
    skillIds: [],
    ...overrides,
  }
}

// RNG déterministe pour des tests reproductibles (pas de dépendance à Math.random).
function seededRng(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
}

describe('pickDistractors', () => {
  const target = word('mot-bol', 'bol', ['b', 'o', 'l'], 5)

  const confusionTable: ConfusionTable = {
    b: ['d', 'p'],
  }

  const pool: ContentItem[] = [
    target,
    word('mot-dos', 'dos', ['d', 'o'], 5), // confusable via b/d
    word('mot-pot', 'pot', ['p', 'o', 't'], 5), // confusable via b/p
    word('mot-sac', 'sac', ['s', 'a', 'c'], 5), // sans confusion connue avec b
    word('mot-ile', 'île', ['i', 'l'], 9), // niveau trop avancé, jamais choisi
  ]

  it('choisit des distracteurs uniquement depuis la table de confusion quand elle en fournit assez', () => {
    const result = pickDistractors(target, pool, confusionTable, new Set(), 2, seededRng(1))
    expect(result).toHaveLength(2)
    const ids = result.map((i) => i.id).sort()
    expect(ids).toEqual(['mot-dos', 'mot-pot'])
  })

  it('ne choisit jamais la cible elle-même', () => {
    const result = pickDistractors(target, pool, confusionTable, new Set(), 4, seededRng(2))
    expect(result.some((i) => i.id === target.id)).toBe(false)
  })

  it('ne choisit jamais un item de niveau supérieur à la cible', () => {
    const result = pickDistractors(target, pool, confusionTable, new Set(['mot-ile']), 4, seededRng(3))
    expect(result.some((i) => i.id === 'mot-ile')).toBe(false)
  })

  it('ne choisit jamais un item d\'un autre type de contenu (kind) que la cible', () => {
    const poolWithGrapheme: ContentItem[] = [
      ...pool,
      { id: 'gr-b', kind: 'grapheme', level: 2, text: 'b', graphemeIds: ['b'], skillIds: [] },
    ]
    const result = pickDistractors(target, poolWithGrapheme, confusionTable, new Set(), 4, seededRng(4))
    expect(result.every((i) => i.kind === 'word')).toBe(true)
  })

  it('complète avec des items déjà rencontrés du même niveau quand la confusion ne suffit pas', () => {
    const encountered = new Set(['mot-sac'])
    // Seul mot-dos et mot-pot sont confusables ; mot-sac vient du repli.
    const result = pickDistractors(target, pool, confusionTable, encountered, 3, seededRng(5))
    expect(result).toHaveLength(3)
    const ids = result.map((i) => i.id).sort()
    expect(ids).toEqual(['mot-dos', 'mot-pot', 'mot-sac'])
  })

  it('ne dépasse jamais count et ne duplique jamais un item', () => {
    const result = pickDistractors(target, pool, confusionTable, new Set(['mot-sac']), 10, seededRng(6))
    const ids = result.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(result.length).toBeLessThanOrEqual(3) // seulement 3 candidats valides existent au total
  })
})

describe('pickDistractors — repli (aucune confusion connue)', () => {
  const target = word('mot-tulipe', 'tulipe', ['t', 'u', 'l', 'i', 'p'], 5)

  // Table de confusion vide : aucune entrée pour aucun graphème de la cible.
  const emptyConfusionTable: ConfusionTable = {}

  const pool: ContentItem[] = [
    target,
    word('mot-cabane', 'cabane', ['c', 'a', 'b', 'a', 'n'], 5),
    word('mot-domino', 'domino', ['d', 'o', 'm', 'i', 'n', 'o'], 5),
    word('mot-robot', 'robot', ['r', 'o', 'b', 'o', 't'], 5),
    word('mot-avion', 'avion', ['a', 'v', 'i', 'on'], 6), // autre niveau : jamais choisi même rencontré
  ]

  it('se replie sur les items déjà rencontrés du même niveau quand aucune confusion n\'existe', () => {
    const encountered = new Set(['mot-cabane', 'mot-domino'])
    const result = pickDistractors(target, pool, emptyConfusionTable, encountered, 2, seededRng(7))
    expect(result).toHaveLength(2)
    const ids = result.map((i) => i.id).sort()
    expect(ids).toEqual(['mot-cabane', 'mot-domino'])
  })

  it('ne choisit jamais un item non rencontré quand la table de confusion est vide', () => {
    const encountered = new Set(['mot-cabane']) // un seul item rencontré
    const result = pickDistractors(target, pool, emptyConfusionTable, encountered, 3, seededRng(8))
    // "mot-robot" n'a jamais été rencontré et il n'y a aucune confusion connue :
    // il ne doit jamais apparaître, même si count=3 ne peut pas être atteint.
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('mot-cabane')
  })

  it("ne choisit jamais un item hors curriculum (niveau différent) même s'il a été rencontré", () => {
    const encountered = new Set(['mot-avion']) // rencontré, mais niveau 6 alors que la cible est niveau 5
    const result = pickDistractors(target, pool, emptyConfusionTable, encountered, 2, seededRng(9))
    expect(result).toHaveLength(0)
  })

  it('retourne une liste vide plutôt qu\'un item hors des deux sources autorisées quand tout manque', () => {
    const result = pickDistractors(target, pool, emptyConfusionTable, new Set(), 5, seededRng(10))
    expect(result).toEqual([])
  })
})
