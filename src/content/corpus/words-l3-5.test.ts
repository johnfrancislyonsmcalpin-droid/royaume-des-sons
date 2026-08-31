import { describe, expect, it } from 'vitest'
import type { ContentItem } from '../../types'
import { graphemesKnownAtLevel } from '../curriculum'
import rawWords from './words-l3-5.json'

const words = rawWords as ContentItem[]
const LEVELS = [3, 4, 5] as const

// Lettre littérale représentée par chaque grapheme utilisable aux niveaux 3-5
// (aucun digraphe avant le niveau 6 : cette table sert uniquement à vérifier
// que la décomposition graphémique reproduit exactement l'orthographe réelle
// du mot, cf. SPEC §5 "le découpage d'un mot en graphèmes est fourni
// explicitement... ne pas tenter de le deviner à l'exécution").
const LETTER_OF_GRAPHEME: Record<string, string> = {
  a: 'a',
  i: 'i',
  o: 'o',
  u: 'u',
  é: 'é',
  l: 'l',
  m: 'm',
  r: 'r',
  s: 's',
  p: 'p',
  t: 't',
  f: 'f',
  v: 'v',
  n: 'n',
  d: 'd',
  b: 'b',
  'c-dur': 'c',
  'g-dur': 'g',
  k: 'k',
  'e-muet': 'e',
}

function byLevel(level: number): ContentItem[] {
  return words.filter((w) => w.level === level)
}

describe('words-l3-5.json — volume et forme', () => {
  it.each(LEVELS)('contient au moins 40 mots au niveau %i', (level) => {
    expect(byLevel(level).length).toBeGreaterThanOrEqual(40)
  })

  it('chaque item est de kind "word" et de niveau 3, 4 ou 5', () => {
    for (const item of words) {
      expect(item.kind).toBe('word')
      expect(LEVELS).toContain(item.level)
    }
  })

  it('chaque mot a un id non vide et unique', () => {
    const ids = words.map((w) => w.id)
    expect(ids.every((id) => id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('chaque mot a un text non vide et unique', () => {
    const texts = words.map((w) => w.text)
    expect(texts.every((t) => t.length > 0)).toBe(true)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('chaque mot a un emoji non vide', () => {
    for (const item of words) {
      expect(item.emoji, `"${item.text}" n'a pas d'emoji`).toBeTruthy()
      expect(item.emoji!.length).toBeGreaterThan(0)
    }
  })

  it('aucun emoji n\'est réutilisé pour deux mots différents', () => {
    const byEmoji = new Map<string, string[]>()
    for (const item of words) {
      const list = byEmoji.get(item.emoji!) ?? []
      list.push(item.text)
      byEmoji.set(item.emoji!, list)
    }
    const duplicates = [...byEmoji.entries()].filter(([, texts]) => texts.length > 1)
    expect(duplicates, `emoji réutilisés : ${JSON.stringify(duplicates)}`).toEqual([])
  })

  it('chaque mot a une décomposition graphémique non vide', () => {
    for (const item of words) {
      expect(item.graphemeIds.length, `"${item.text}" n'a pas de graphemeIds`).toBeGreaterThan(0)
    }
  })

  it('la décomposition graphémique reproduit exactement l\'orthographe réelle du mot', () => {
    const offenders: string[] = []
    for (const item of words) {
      const reconstructed = item.graphemeIds
        .map((g) => {
          const letter = LETTER_OF_GRAPHEME[g]
          if (letter === undefined) {
            offenders.push(`"${item.text}" utilise le graphème "${g}", absent de la table de lettres niveaux 3-5`)
            return ''
          }
          return letter
        })
        .join('')
      if (reconstructed !== item.text) {
        offenders.push(
          `"${item.text}" : décomposition [${item.graphemeIds.join(', ')}] reconstruit "${reconstructed}" au lieu de "${item.text}"`,
        )
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('words-l3-5.json — decodabilite', () => {
  it('chaque graphème de chaque mot appartient à graphemesKnownAtLevel(mot.level)', () => {
    const offenders: string[] = []
    for (const item of words) {
      const known = graphemesKnownAtLevel(item.level)
      for (const graphemeId of item.graphemeIds) {
        if (!known.has(graphemeId)) {
          offenders.push(`"${item.text}" (niveau ${item.level}) utilise "${graphemeId}", inconnu à ce niveau`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('aucun mot de niveau 3 n\'utilise un graphème introduit au niveau 4 ou 5 (f,v,n,d,b,c-dur,g-dur,k,e-muet)', () => {
    const level4plus = ['f', 'v', 'n', 'd', 'b', 'c-dur', 'g-dur', 'k', 'e-muet']
    const offenders: string[] = []
    for (const item of byLevel(3)) {
      for (const graphemeId of item.graphemeIds) {
        if (level4plus.includes(graphemeId)) {
          offenders.push(`"${item.text}" (niveau 3) utilise "${graphemeId}", introduit au niveau 4`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
