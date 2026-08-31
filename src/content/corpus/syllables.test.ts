import { describe, expect, it } from 'vitest'
import type { ContentItem } from '../../types'
import { graphemesKnownAtLevel } from '../curriculum'
import rawSyllables from './syllables.json'

const syllables = rawSyllables as ContentItem[]

// Consonnes du niveau 2 et voyelles du niveau 1 — seules briques autorisées
// pour une syllabe CV de niveau 3 (SPEC §5 : "Fusion CV avec N1+N2").
const LEVEL1_VOWELS = ['a', 'i', 'o', 'u', 'é']
const LEVEL2_CONSONANTS = ['l', 'm', 'r', 's', 'p', 't']

describe('syllables.json — volume et forme', () => {
  it('contient au moins 30 syllabes', () => {
    expect(syllables.length).toBeGreaterThanOrEqual(30)
  })

  it('chaque item est de kind "syllable" et de niveau 3', () => {
    for (const item of syllables) {
      expect(item.kind).toBe('syllable')
      expect(item.level).toBe(3)
    }
  })

  it('chaque item a un id non vide et unique', () => {
    const ids = syllables.map((s) => s.id)
    expect(ids.every((id) => id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('chaque item a un text non vide et unique', () => {
    const texts = syllables.map((s) => s.text)
    expect(texts.every((t) => t.length > 0)).toBe(true)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('chaque syllabe a une décomposition d\'exactement 2 graphèmes', () => {
    for (const item of syllables) {
      expect(item.graphemeIds).toHaveLength(2)
    }
  })

  it('chaque syllabe est une consonne du niveau 2 suivie d\'une voyelle du niveau 1 (structure CV)', () => {
    for (const item of syllables) {
      const [consonant, vowel] = item.graphemeIds
      expect(
        LEVEL2_CONSONANTS,
        `"${item.text}" : première lettre "${consonant}" doit être une consonne du niveau 2`,
      ).toContain(consonant)
      expect(
        LEVEL1_VOWELS,
        `"${item.text}" : deuxième lettre "${vowel}" doit être une voyelle du niveau 1`,
      ).toContain(vowel)
    }
  })

  it('la concaténation des graphèmes reproduit exactement le texte de la syllabe', () => {
    for (const item of syllables) {
      expect(item.graphemeIds.join('')).toBe(item.text)
    }
  })

  it('chaque syllabe référence le skillId L3-fusion-cv', () => {
    for (const item of syllables) {
      expect(item.skillIds).toContain('L3-fusion-cv')
    }
  })
})

describe('syllables.json — decodabilite', () => {
  it('chaque graphème de chaque syllabe appartient à graphemesKnownAtLevel(item.level)', () => {
    const offenders: string[] = []
    for (const item of syllables) {
      const known = graphemesKnownAtLevel(item.level)
      for (const graphemeId of item.graphemeIds) {
        if (!known.has(graphemeId)) {
          offenders.push(`"${item.text}" (niveau ${item.level}) utilise "${graphemeId}", inconnu à ce niveau`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
