import { describe, expect, it } from 'vitest'
import type { ContentItem } from '../../types'
import { graphemesKnownAtLevel } from '../curriculum'
import words from './words-l6-7.json'

const items = words as ContentItem[]
const MIN_PER_LEVEL = 40

function byLevel(level: number): ContentItem[] {
  return items.filter((item) => item.level === level)
}

describe('words-l6-7.json — volume et forme', () => {
  it('contient au moins 40 mots niveau 6', () => {
    expect(byLevel(6).length).toBeGreaterThanOrEqual(MIN_PER_LEVEL)
  })

  it('contient au moins 40 mots niveau 7', () => {
    expect(byLevel(7).length).toBeGreaterThanOrEqual(MIN_PER_LEVEL)
  })

  it("ne contient que des niveaux 6 ou 7", () => {
    for (const item of items) {
      expect([6, 7]).toContain(item.level)
    }
  })

  it("chaque item est de kind 'word'", () => {
    for (const item of items) {
      expect(item.kind).toBe('word')
    }
  })

  it('chaque mot a un id unique', () => {
    const ids = items.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('chaque mot a un texte non vide', () => {
    for (const item of items) {
      expect(item.text.length).toBeGreaterThan(0)
    }
  })

  it('chaque mot a un emoji non vide (obligatoire pour kind === word)', () => {
    for (const item of items) {
      expect(item.emoji, `mot "${item.text}" (${item.id}) sans emoji`).toBeTruthy()
      expect(item.emoji!.length).toBeGreaterThan(0)
    }
  })

  it('aucun emoji réutilisé pour deux mots différents dans ce fichier', () => {
    const emojiToWords = new Map<string, string[]>()
    for (const item of items) {
      const list = emojiToWords.get(item.emoji!) ?? []
      list.push(item.text)
      emojiToWords.set(item.emoji!, list)
    }
    const duplicates = [...emojiToWords.entries()].filter(([, words]) => words.length > 1)
    expect(duplicates, `emoji dupliqués: ${JSON.stringify(duplicates)}`).toEqual([])
  })

  it('chaque mot a une décomposition graphémique non vide', () => {
    for (const item of items) {
      expect(item.graphemeIds.length).toBeGreaterThan(0)
    }
  })

  it('chaque mot a au moins un skillId déclaré', () => {
    for (const item of items) {
      expect(item.skillIds.length).toBeGreaterThan(0)
    }
  })
})

describe('words-l6-7.json — decodabilite', () => {
  it('niveau 6 : chaque graphème appartient à graphemesKnownAtLevel(6)', () => {
    const known = graphemesKnownAtLevel(6)
    const violations: string[] = []
    for (const item of byLevel(6)) {
      for (const g of item.graphemeIds) {
        if (!known.has(g)) {
          violations.push(`${item.id} ("${item.text}") utilise le graphème inconnu "${g}"`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('niveau 7 : chaque graphème appartient à graphemesKnownAtLevel(7)', () => {
    const known = graphemesKnownAtLevel(7)
    const violations: string[] = []
    for (const item of byLevel(7)) {
      for (const g of item.graphemeIds) {
        if (!known.has(g)) {
          violations.push(`${item.id} ("${item.text}") utilise le graphème inconnu "${g}"`)
        }
      }
    }
    expect(violations).toEqual([])
  })

  it('niveau 6 : aucun mot ne dépend prématurément d\'un graphème de niveau 7 (c-doux, g-doux, qu, ph)', () => {
    const level7Only = new Set(['c-doux', 'g-doux', 'qu', 'ph'])
    const violations: string[] = []
    for (const item of byLevel(6)) {
      for (const g of item.graphemeIds) {
        if (level7Only.has(g)) {
          violations.push(`${item.id} ("${item.text}") utilise prématurément "${g}"`)
        }
      }
    }
    expect(violations).toEqual([])
  })
})
