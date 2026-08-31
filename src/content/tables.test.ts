import { describe, expect, it } from 'vitest'
import { graphemesKnownAtLevel } from './curriculum'
import { getConfusionsFor, getPronunciation } from './tables'

describe('couverture prononciation', () => {
  const known = [...graphemesKnownAtLevel(10)]

  it('graphemesKnownAtLevel(10) retourne bien les 37 graphèmes du curriculum', () => {
    expect(known.length).toBe(37)
  })

  it.each(known)('getPronunciation("%s") ne lève pas et retourne une chaîne', (graphemeId) => {
    expect(() => getPronunciation(graphemeId)).not.toThrow()
    expect(typeof getPronunciation(graphemeId)).toBe('string')
  })

  it('100% des graphèmes de graphemesKnownAtLevel(10) ont une entrée de prononciation', () => {
    const missing = known.filter((id) => {
      try {
        getPronunciation(id)
        return false
      } catch {
        return true
      }
    })
    expect(missing).toEqual([])
  })

  it('toutes les entrées sauf "e-muet" (silencieux par construction) sont non vides', () => {
    const emptyButUnexpected = known.filter(
      (id) => id !== 'e-muet' && getPronunciation(id).length === 0,
    )
    expect(emptyButUnexpected).toEqual([])
  })

  it('"e-muet" est explicitement silencieux (chaîne vide), pas un son inventé', () => {
    expect(getPronunciation('e-muet')).toBe('')
  })

  it('getPronunciation lève une erreur claire pour un graphème inconnu du curriculum', () => {
    expect(() => getPronunciation('zzz-inexistant')).toThrow(/inconnu/)
  })
})

describe('son pas nom', () => {
  it('m est une nasale prolongée ("mmm" ou équivalent), jamais le nom de la lettre ("ème")', () => {
    const value = getPronunciation('m')
    expect(value).toMatch(/^m{2,}$/)
    expect(value.toLowerCase()).not.toBe('ème')
  })

  it('n est une nasale prolongée, jamais le nom de la lettre ("enne")', () => {
    const value = getPronunciation('n')
    expect(value).toMatch(/^n{2,}$/)
  })

  it.each(['l', 'r', 's', 'f', 'v'])(
    'la consonne continue "%s" est rendue par la lettre répétée (prolongable), jamais par son nom de lettre',
    (graphemeId) => {
      const value = getPronunciation(graphemeId)
      expect(value).toMatch(new RegExp(`^${graphemeId}{2,}$`))
    },
  )

  it('p est une occlusive brève ("peu"), explicitement pas "pé" (SPEC §3)', () => {
    const value = getPronunciation('p')
    expect(value).toBe('peu')
    expect(value).not.toBe('pé')
  })

  it.each(['b', 'd', 'g-dur', 'k', 'c-dur', 't', 'qu'])(
    'l\'occlusive "%s" ne se termine jamais par le son "é" qui imiterait le nom de la lettre',
    (graphemeId) => {
      const value = getPronunciation(graphemeId)
      expect(value.toLowerCase().endsWith('é')).toBe(false)
    },
  )

  it('aucune occlusive citée en SPEC (b, d, g-dur, k, c-dur, p, t, qu) n\'est identique au nom français de sa lettre', () => {
    const letterNames: Record<string, string> = {
      b: 'bé',
      d: 'dé',
      'g-dur': 'gé',
      k: 'ka',
      'c-dur': 'cé',
      p: 'pé',
      t: 'té',
      qu: 'ku',
    }
    for (const [graphemeId, letterName] of Object.entries(letterNames)) {
      expect(getPronunciation(graphemeId)).not.toBe(letterName)
    }
  })

  it('les voyelles s\'énoncent comme leur propre son (a, i, o, u, é)', () => {
    for (const graphemeId of ['a', 'i', 'o', 'u', 'é']) {
      expect(getPronunciation(graphemeId)).toBe(graphemeId)
    }
  })
})

describe('paires de confusion', () => {
  // SPEC §7 : visuelle b/d, p/q, m/n, u/n, ou/on ; phonétique f/v, s/z,
  // p/b, t/d, ch/j. "q" et "z" et "j" n'existent pas comme graphèmes isolés
  // du curriculum (pas de son "q" enseigné hors "qu", pas de grapheme "z"
  // ou "j" dédié) : ils sont représentés par leur plus proche équivalent
  // (qu pour q) ou par un identifiant symbolique dédié à la confusion
  // (z, j) — voir le rapport de la leaf pour la justification.
  const requiredPairs: [string, string][] = [
    ['b', 'd'],
    ['p', 'qu'],
    ['m', 'n'],
    ['u', 'n'],
    ['ou', 'on'],
    ['f', 'v'],
    ['s', 'z'],
    ['p', 'b'],
    ['t', 'd'],
    ['ch', 'j'],
  ]

  it.each(requiredPairs)(
    'la paire de confusion %s / %s de SPEC §7 est couverte',
    (a, b) => {
      const confusionsOfA = getConfusionsFor(a)
      const confusionsOfB = getConfusionsFor(b)
      expect(
        confusionsOfA.includes(b) || confusionsOfB.includes(a),
        `ni getConfusionsFor("${a}") ni getConfusionsFor("${b}") ne mentionne l'autre`,
      ).toBe(true)
    },
  )

  it('getConfusionsFor symétrise correctement même quand confusion.json ne déclare la paire que dans un seul sens', () => {
    // "b": ["d", "p"] est déclaré dans un seul sens dans confusion.json ;
    // les deux sens doivent fonctionner via getConfusionsFor.
    expect(getConfusionsFor('b')).toEqual(expect.arrayContaining(['d', 'p']))
    expect(getConfusionsFor('d')).toEqual(expect.arrayContaining(['b']))
    expect(getConfusionsFor('p')).toEqual(expect.arrayContaining(['b']))
  })

  it('getConfusionsFor retourne un tableau vide (pas une erreur) pour un graphème sans confusion connue', () => {
    expect(getConfusionsFor('gn')).toEqual([])
  })

  it('toutes les paires requises sont couvertes dans les deux sens après symétrisation', () => {
    for (const [a, b] of requiredPairs) {
      expect(getConfusionsFor(a).includes(b) || getConfusionsFor(b).includes(a)).toBe(true)
      // Une fois qu'un sens contient l'autre, la symétrisation garantit le retour.
      if (getConfusionsFor(a).includes(b)) {
        expect(getConfusionsFor(b)).toContain(a)
      }
      if (getConfusionsFor(b).includes(a)) {
        expect(getConfusionsFor(a)).toContain(b)
      }
    }
  })
})
