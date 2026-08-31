import { describe, expect, it } from 'vitest'
import type { ChallengeOption } from '../types'
import { computeShuffledPositions, shuffleOptions } from './shuffle'

function makeOptions(count: number, correctIndex: number): ChallengeOption[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `opt-${i}`,
    contentItemId: `item-${i}`,
    isDistractor: i !== correctIndex,
  }))
}

describe('shuffleOptions — anti-position (G-D3)', () => {
  it('sur 1000 tirages successifs (4 options), aucune position de bonne réponse ne se répète d\'un tirage au suivant', () => {
    const sequence: ChallengeOption[][] = Array.from({ length: 1000 }, () =>
      makeOptions(4, 0)
    )

    const positions = computeShuffledPositions(sequence, Math.random)

    expect(positions).toHaveLength(1000)
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).not.toBe(positions[i - 1])
    }
  })

  it('sur 1000 tirages successifs avec un nombre d\'options variable (2 à 4), aucune position ne se répète', () => {
    const sequence: ChallengeOption[][] = Array.from({ length: 1000 }, (_, i) => {
      const count = 2 + (i % 3) // alterne 2, 3, 4 options
      return makeOptions(count, 0)
    })

    const positions = computeShuffledPositions(sequence, Math.random)

    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).not.toBe(positions[i - 1])
    }
  })

  it('mélange réellement les options (ne retourne pas toujours la même permutation)', () => {
    const options = makeOptions(4, 0)
    const seenPositions = new Set<number>()

    for (let i = 0; i < 200; i++) {
      const shuffled = shuffleOptions(options, null, Math.random)
      const pos = shuffled.findIndex((o) => !o.isDistractor)
      seenPositions.add(pos)
    }

    // Avec un vrai tirage aléatoire sur 200 essais, on doit voir plus d'une
    // seule position occuper la bonne réponse.
    expect(seenPositions.size).toBeGreaterThan(1)
  })

  it('ne modifie pas le tableau d\'options passé en entrée (retourne une nouvelle référence)', () => {
    const options = makeOptions(4, 0)
    const originalOrder = options.map((o) => o.id)

    shuffleOptions(options, 0, Math.random)

    expect(options.map((o) => o.id)).toEqual(originalOrder)
  })

  it('conserve l\'ensemble des options (aucune perte, aucun doublon)', () => {
    const options = makeOptions(4, 2)
    const shuffled = shuffleOptions(options, 1, Math.random)

    expect(shuffled.map((o) => o.id).sort()).toEqual(options.map((o) => o.id).sort())
  })

  describe('cas limite : 2 options', () => {
    it('avec une position précédente fixée, force systématiquement l\'autre position (ce n\'est pas un bug)', () => {
      const options = makeOptions(2, 0)

      for (let trial = 0; trial < 50; trial++) {
        const shuffled = shuffleOptions(options, 0, Math.random)
        const pos = shuffled.findIndex((o) => !o.isDistractor)
        expect(pos).toBe(1)
      }

      for (let trial = 0; trial < 50; trial++) {
        const shuffled = shuffleOptions(options, 1, Math.random)
        const pos = shuffled.findIndex((o) => !o.isDistractor)
        expect(pos).toBe(0)
      }
    })

    it('sans position précédente (null), les deux positions restent possibles', () => {
      const options = makeOptions(2, 0)
      const seen = new Set<number>()

      for (let trial = 0; trial < 100; trial++) {
        const shuffled = shuffleOptions(options, null, Math.random)
        seen.add(shuffled.findIndex((o) => !o.isDistractor))
      }

      expect(seen.size).toBe(2)
    })
  })

  describe('cas limite : 0 ou 1 option', () => {
    it('1 option : contrainte structurellement insatisfaisable, retourne le tableau tel quel sans boucler', () => {
      const options = makeOptions(1, 0)
      const shuffled = shuffleOptions(options, 0, Math.random)

      expect(shuffled).toHaveLength(1)
      expect(shuffled[0].id).toBe(options[0].id)
    })

    it('0 option : retourne un tableau vide sans erreur', () => {
      const shuffled = shuffleOptions([], null, Math.random)
      expect(shuffled).toEqual([])
    })
  })

  describe('cas limite : aucune option correcte (données malformées en amont)', () => {
    it('ne lance pas d\'erreur et retourne un mélange simple', () => {
      const options: ChallengeOption[] = [
        { id: 'a', contentItemId: 'x', isDistractor: true },
        { id: 'b', contentItemId: 'y', isDistractor: true },
        { id: 'c', contentItemId: 'z', isDistractor: true },
      ]

      const shuffled = shuffleOptions(options, 0, Math.random)
      expect(shuffled).toHaveLength(3)
      expect(shuffled.map((o) => o.id).sort()).toEqual(['a', 'b', 'c'])
    })
  })

  it('avec un rng injecté déterministe, le comportement est reproductible', () => {
    const options = makeOptions(4, 0)
    let calls = 0
    const values = [0.9, 0.1, 0.5, 0.99, 0.0, 0.3, 0.7]
    const rng = () => values[calls++ % values.length]

    const a = shuffleOptions(options, 2, rng)
    calls = 0
    const b = shuffleOptions(options, 2, rng)

    expect(a.map((o) => o.id)).toEqual(b.map((o) => o.id))
  })
})

describe('computeShuffledPositions', () => {
  it('retourne une position par défi de la séquence', () => {
    const sequence: ChallengeOption[][] = Array.from({ length: 10 }, () => makeOptions(3, 1))
    const positions = computeShuffledPositions(sequence, Math.random)
    expect(positions).toHaveLength(10)
    positions.forEach((p) => expect(p).toBeGreaterThanOrEqual(0))
  })

  it('tableau vide en entrée donne un tableau de positions vide', () => {
    expect(computeShuffledPositions([], Math.random)).toEqual([])
  })
})
