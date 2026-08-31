import { describe, expect, it } from 'vitest'
import type { ContentItem } from '../../types'
import { graphemesKnownAtLevel } from '../curriculum'
import rawTexts from './texts-l9.json'

const texts = rawTexts as ContentItem[]

// Même liste figée qu'en sentences-l8.test.ts (SPEC §5) : les mots-outils
// restent reconnus globalement au niveau 9, le curriculum étant cumulatif
// (décision de modélisation documentée dans ASSUMPTIONS.md).
const SIGHT_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'est', 'et', 'dans', 'sur', 'avec',
  'il', 'elle', 'je', 'tu', 'a', 'ont', 'qui',
])

// Décomposition graphémique explicite de chaque mot décodable utilisé dans le
// corpus de mini-textes (SPEC : décomposition explicite fournie par le
// contenu, jamais devinée à l'exécution).
const WORD_GRAPHEMES: Record<string, string[]> = {
  chat: ['ch', 'a', 't'],
  dort: ['d', 'o', 'r', 't'],
  cabane: ['c-dur', 'a', 'b', 'a', 'n', 'e-muet'],
  chien: ['ch', 'i', 'en'],
  arrive: ['a', 'r', 'r', 'i', 'v', 'e-muet'],
  saute: ['s', 'au', 't', 'e-muet'],
  rit: ['r', 'i', 't'],
  robot: ['r', 'o', 'b', 'o', 't'],
  chapeau: ['ch', 'a', 'p', 'eau'],
  danse: ['d', 'an', 's', 'e-muet'],
  chante: ['ch', 'an', 't', 'e-muet'],
  maman: ['m', 'a', 'm', 'an'],
  glisse: ['g-dur', 'l', 'i', 's', 's', 'e-muet'],
  sofa: ['s', 'o', 'f', 'a'],
  bravo: ['b', 'r', 'a', 'v', 'o'],
  dit: ['d', 'i', 't'],
  lion: ['l', 'i', 'on'],
  fort: ['f', 'o', 'r', 't'],
  parc: ['p', 'a', 'r', 'c-dur'],
  peur: ['p', 'eu', 'r'],
  tortue: ['t', 'o', 'r', 't', 'u', 'e-muet'],
  adore: ['a', 'd', 'o', 'r', 'e-muet'],
  sac: ['s', 'a', 'c-dur'],
  porte: ['p', 'o', 'r', 't', 'e-muet'],
  contente: ['c-dur', 'on', 't', 'en', 't', 'e-muet'],
  bouton: ['b', 'ou', 't', 'on'],
  roule: ['r', 'ou', 'l', 'e-muet'],
  nage: ['n', 'a', 'g-doux', 'e-muet'],
  vite: ['v', 'i', 't', 'e-muet'],
  garde: ['g-dur', 'a', 'r', 'd', 'e-muet'],
  ici: ['i', 'c-doux', 'i'],
  ami: ['a', 'm', 'i'],
  as: ['a', 's'],
  oui: ['ou', 'i'],
  trotte: ['t', 'r', 'o', 't', 't', 'e-muet'],
  non: ['n', 'on'],
  encore: ['en', 'c-dur', 'o', 'r', 'e-muet'],
  vole: ['v', 'o', 'l', 'e-muet'],
}

// Lettre(s) littérale(s) représentée(s) par chaque grapheme (identique à
// sentences-l8.test.ts) : aucun nouveau grapheme n'est introduit au niveau 9,
// graphemesKnownAtLevel(9) === graphemesKnownAtLevel(8) === graphemesKnownAtLevel(7).
const LETTER_OF_GRAPHEME: Record<string, string> = {
  a: 'a', i: 'i', o: 'o', u: 'u', é: 'é',
  l: 'l', m: 'm', r: 'r', s: 's', p: 'p', t: 't',
  f: 'f', v: 'v', n: 'n', d: 'd', b: 'b',
  'c-dur': 'c', 'g-dur': 'g', k: 'k', 'e-muet': 'e',
  ou: 'ou', on: 'on', an: 'an', en: 'en', in: 'in',
  oi: 'oi', eu: 'eu', ch: 'ch', gn: 'gn',
  au: 'au', eau: 'eau', ai: 'ai', ei: 'ei',
  'c-doux': 'c', 'g-doux': 'g', qu: 'qu', ph: 'ph',
}

function stripPunctuation(token: string): string {
  return token.replace(/[.,!?;:"'—]/g, '').toLowerCase()
}

// Une "phrase" d'un mini-texte est une ligne (séparateur \n) : décision de
// modélisation (voir ASSUMPTIONS.md) qui évite de deviner les frontières de
// phrase par ponctuation quand une ligne de dialogue contient un "!" interne
// non terminal (ex. "— Je danse ! dit le chien.").
function lines(text: string): string[] {
  return text.split('\n').filter((l) => l.trim().length > 0)
}

function words(text: string): string[] {
  return text
    .split(/\s+/)
    .map(stripPunctuation)
    .filter((w) => w.length > 0)
}

describe('texts-l9.json — volume et forme', () => {
  it('contient au moins 12 mini-textes de niveau 9', () => {
    expect(texts.length).toBeGreaterThanOrEqual(12)
  })

  it('chaque item est de kind "text" et de niveau 9', () => {
    for (const item of texts) {
      expect(item.kind).toBe('text')
      expect(item.level).toBe(9)
    }
  })

  it('chaque texte a un id et un text non vides et uniques', () => {
    const ids = texts.map((t) => t.id)
    const bodies = texts.map((t) => t.text)
    expect(ids.every((id) => id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    expect(bodies.every((t) => t.length > 0)).toBe(true)
    expect(new Set(bodies).size).toBe(bodies.length)
  })

  it('chaque texte contient de 3 à 5 phrases', () => {
    const offenders: string[] = []
    for (const item of texts) {
      const count = lines(item.text).length
      if (count < 3 || count > 5) {
        offenders.push(`"${item.id}" a ${count} phrases`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('chaque phrase du texte finit par ".", "!" ou "?" et commence par une majuscule (ou un tiret de dialogue)', () => {
    const offenders: string[] = []
    for (const item of texts) {
      for (const line of lines(item.text)) {
        if (!/[.!?]$/.test(line)) {
          offenders.push(`"${item.id}" : la ligne "${line}" ne finit pas par . ! ou ?`)
        }
        const firstLetterMatch = line.startsWith('— ') ? line.slice(2) : line
        if (!/^[A-ZÀ-Ü]/.test(firstLetterMatch)) {
          offenders.push(`"${item.id}" : la ligne "${line}" ne commence pas par une majuscule`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('chaque texte a au moins une question de compréhension avec un correctIndex valide', () => {
    const offenders: string[] = []
    for (const item of texts) {
      if (!item.questions || item.questions.length === 0) {
        offenders.push(`"${item.id}" n'a pas de questions`)
        continue
      }
      for (const q of item.questions) {
        if (!q.id || !q.promptKey) {
          offenders.push(`"${item.id}" : question mal formée (${JSON.stringify(q)})`)
        }
        if (q.answerOptions.length < 2) {
          offenders.push(`"${item.id}" : question "${q.id}" a moins de 2 options`)
        }
        if (q.correctIndex < 0 || q.correctIndex >= q.answerOptions.length) {
          offenders.push(`"${item.id}" : question "${q.id}" a un correctIndex invalide`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('chaque texte référence au moins un skillId du niveau 9', () => {
    for (const item of texts) {
      expect(item.skillIds.length).toBeGreaterThan(0)
      for (const skillId of item.skillIds) {
        expect(['L9-comprehension', 'L9-ponctuation']).toContain(skillId)
      }
    }
  })
})

describe('texts-l9.json — decodabilite', () => {
  it('fixture WORD_GRAPHEMES : chaque décomposition reconstruit exactement le mot', () => {
    const offenders: string[] = []
    for (const [word, graphemeIds] of Object.entries(WORD_GRAPHEMES)) {
      const reconstructed = graphemeIds
        .map((g) => {
          const letters = LETTER_OF_GRAPHEME[g]
          if (letters === undefined) {
            offenders.push(`"${word}" utilise le grapheme inconnu "${g}"`)
            return ''
          }
          return letters
        })
        .join('')
      if (reconstructed !== word) {
        offenders.push(`"${word}" : [${graphemeIds.join(', ')}] reconstruit "${reconstructed}"`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('tout mot non décodable au niveau 9 est un mot-outil de la liste SPEC §5', () => {
    const offenders: string[] = []
    for (const item of texts) {
      for (const word of words(item.text)) {
        if (SIGHT_WORDS.has(word)) continue
        if (!WORD_GRAPHEMES[word]) {
          offenders.push(`"${item.id}" : le mot "${word}" n'est ni un mot-outil ni décomposé`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('chaque grapheme de chaque mot décodable appartient à graphemesKnownAtLevel(9)', () => {
    const known = graphemesKnownAtLevel(9)
    const offenders: string[] = []
    for (const item of texts) {
      for (const word of words(item.text)) {
        if (SIGHT_WORDS.has(word)) continue
        for (const g of WORD_GRAPHEMES[word] ?? []) {
          if (!known.has(g)) {
            offenders.push(`"${item.id}" : "${word}" utilise "${g}", inconnu au niveau 9`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('le graphemeIds déclaré de chaque texte est exactement l\'union des mots décodables (mots-outils exclus)', () => {
    const offenders: string[] = []
    for (const item of texts) {
      const expected = new Set<string>()
      for (const word of words(item.text)) {
        if (SIGHT_WORDS.has(word)) continue
        for (const g of WORD_GRAPHEMES[word] ?? []) {
          expected.add(g)
        }
      }
      const declared = new Set(item.graphemeIds)
      const missing = [...expected].filter((g) => !declared.has(g))
      const extra = [...declared].filter((g) => !expected.has(g))
      if (missing.length > 0 || extra.length > 0) {
        offenders.push(`"${item.id}" : manquants=[${missing.join(',')}] en-trop=[${extra.join(',')}]`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('plusieurs textes introduisent ?, ! ou le tiret de dialogue', () => {
    const withSpecialPunctuation = texts.filter(
      (item) => item.text.includes('?') || item.text.includes('!') || item.text.includes('—'),
    )
    // "plusieurs" (SPEC §5/§9) : au moins 3 textes distincts, un seuil au-delà
    // d'une simple curiosité isolée. Le corpus livré en compte 5.
    expect(withSpecialPunctuation.length).toBeGreaterThanOrEqual(3)
  })

  it('au moins un texte introduit chacun de ?, ! et le tiret de dialogue', () => {
    expect(texts.some((t) => t.text.includes('?'))).toBe(true)
    expect(texts.some((t) => t.text.includes('!'))).toBe(true)
    expect(texts.some((t) => t.text.includes('—'))).toBe(true)
  })
})
