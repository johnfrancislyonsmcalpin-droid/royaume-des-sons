import { describe, expect, it } from 'vitest'
import type { ContentItem } from '../../types'
import { graphemesKnownAtLevel } from '../curriculum'
import pseudowords from './pseudowords.json'
import words from './words-l6-7.json'

const items = pseudowords as ContentItem[]
const realWords = words as ContentItem[]
const MIN_COUNT = 25

// Liste de secours de mots français courants à ne jamais produire par accident
// comme pseudo-mot. Cette leaf n'a pas accès aux autres corpus dispatchés en
// parallèle (B2.1, B2.3) : cette liste est le seul filet de sécurité local,
// en plus de la comparaison avec le corpus propre à ce fichier (words-l6-7.json).
const COMMON_FRENCH_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'et', 'est', 'dans', 'sur', 'avec',
  'il', 'elle', 'je', 'tu', 'a', 'ont', 'qui', 'papa', 'maman', 'ami', 'moto',
  'loto', 'puma', 'lama', 'mari', 'salami', 'meteo', 'meteo', 'totem', 'tomate',
  'patate', 'banane', 'cabane', 'domino', 'robot', 'tulipe', 'velo', 'sofa',
  'farine', 'cafe', 'dame', 'cube', 'note', 'bebe', 'olive', 'canif', 'sac',
  'bol', 'lac', 'bec', 'sel', 'vif', 'film', 'parc', 'mardi', 'tortue', 'rabbin',
  'lapin', 'chat', 'chien', 'oiseau', 'fille', 'garcon', 'ecole', 'maison',
])

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
}

describe('pseudowords.json — volume et forme', () => {
  it('contient au moins 25 pseudo-mots', () => {
    expect(items.length).toBeGreaterThanOrEqual(MIN_COUNT)
  })

  it('tous les pseudo-mots sont de niveau 7', () => {
    for (const item of items) {
      expect(item.level).toBe(7)
    }
  })

  it("chaque item est de kind 'pseudoword'", () => {
    for (const item of items) {
      expect(item.kind).toBe('pseudoword')
    }
  })

  it('chaque pseudo-mot a un id unique', () => {
    const ids = items.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('chaque pseudo-mot a un texte unique dans ce fichier', () => {
    const texts = items.map((item) => normalize(item.text))
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('chaque pseudo-mot a une décomposition graphémique non vide', () => {
    for (const item of items) {
      expect(item.graphemeIds.length).toBeGreaterThan(0)
    }
  })

  it('chaque pseudo-mot déclare le skill L7-vrai-faux-mot', () => {
    for (const item of items) {
      expect(item.skillIds).toContain('L7-vrai-faux-mot')
    }
  })
})

describe('pseudowords.json — decodabilite', () => {
  it('chaque graphème appartient à graphemesKnownAtLevel(7)', () => {
    const known = graphemesKnownAtLevel(7)
    const violations: string[] = []
    for (const item of items) {
      for (const g of item.graphemeIds) {
        if (!known.has(g)) {
          violations.push(`${item.id} ("${item.text}") utilise le graphème inconnu "${g}"`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})

describe('pseudowords.json — ne sont pas de vrais mots', () => {
  it("aucun pseudo-mot ne coïncide avec un mot du corpus words-l6-7.json", () => {
    const realTexts = new Set(realWords.map((w) => normalize(w.text)))
    const collisions = items
      .map((item) => item.text)
      .filter((text) => realTexts.has(normalize(text)))
    expect(collisions).toEqual([])
  })

  it('aucun pseudo-mot ne coïncide avec un mot français courant connu', () => {
    const collisions = items
      .map((item) => item.text)
      .filter((text) => COMMON_FRENCH_WORDS.has(normalize(text)))
    expect(collisions).toEqual([])
  })
})
