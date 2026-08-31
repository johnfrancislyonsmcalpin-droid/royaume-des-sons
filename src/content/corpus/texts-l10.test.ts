import { describe, expect, it } from 'vitest'
import type { ContentItem } from '../../types'
import { graphemesKnownAtLevel } from '../curriculum'
import rawTexts from './texts-l10.json'

const texts = rawTexts as ContentItem[]

// Même liste figée que sentences-l8.test.ts / texts-l9.test.ts (SPEC §5) :
// les mots-outils restent reconnus globalement au niveau 10, le curriculum
// étant cumulatif (décision de modélisation documentée dans ASSUMPTIONS.md).
const SIGHT_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'est', 'et', 'dans', 'sur', 'avec',
  'il', 'elle', 'je', 'tu', 'a', 'ont', 'qui',
])

// Décomposition graphémique explicite de chaque mot décodable utilisé dans le
// corpus de textes boss (SPEC : décomposition explicite fournie par le
// contenu, jamais devinée à l'exécution).
const WORD_GRAPHEMES: Record<string, string[]> = {
  roi: ['r', 'oi'],
  arrive: ['a', 'r', 'r', 'i', 'v', 'e-muet'],
  parc: ['p', 'a', 'r', 'c-dur'],
  dragon: ['d', 'r', 'a', 'g-dur', 'on'],
  dort: ['d', 'o', 'r', 't'],
  peur: ['p', 'eu', 'r'],
  chat: ['ch', 'a', 't'],
  vite: ['v', 'i', 't', 'e-muet'],
  rit: ['r', 'i', 't'],
  bravo: ['b', 'r', 'a', 'v', 'o'],
  reine: ['r', 'ei', 'n', 'e-muet'],
  clé: ['c-dur', 'l', 'é'],
  trésor: ['t', 'r', 'é', 's', 'o', 'r'],
  trouve: ['t', 'r', 'ou', 'v', 'e-muet'],
  fée: ['f', 'é', 'e-muet'],
  lion: ['l', 'i', 'on'],
  sourit: ['s', 'ou', 'r', 'i', 't'],
  danse: ['d', 'an', 's', 'e-muet'],
  beau: ['b', 'eau'],
  content: ['c-dur', 'on', 't', 'en', 't'],
  encore: ['en', 'c-dur', 'o', 'r', 'e-muet'],
}

// Lettre(s) littérale(s) représentée(s) par chaque grapheme (identique à
// sentences-l8.test.ts / texts-l9.test.ts) : aucun nouveau grapheme n'est
// introduit au niveau 10, graphemesKnownAtLevel(10) === graphemesKnownAtLevel(7).
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

// Une "phrase" du texte boss est une ligne (séparateur \n), même convention
// que texts-l9.test.ts.
function lines(text: string): string[] {
  return text.split('\n').filter((l) => l.trim().length > 0)
}

function words(text: string): string[] {
  return text
    .split(/\s+/)
    .map(stripPunctuation)
    .filter((w) => w.length > 0)
}

describe('texts-l10.json — volume et forme', () => {
  it('contient au moins 4 textes boss de niveau 10', () => {
    expect(texts.length).toBeGreaterThanOrEqual(4)
  })

  it('chaque item est de kind "text" et de niveau 10', () => {
    for (const item of texts) {
      expect(item.kind).toBe('text')
      expect(item.level).toBe(10)
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

  it('chaque texte contient de 5 à 6 phrases', () => {
    const offenders: string[] = []
    for (const item of texts) {
      const count = lines(item.text).length
      if (count < 5 || count > 6) {
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

  it('chaque texte a exactement 2 questions de compréhension avec un correctIndex valide', () => {
    const offenders: string[] = []
    for (const item of texts) {
      if (!item.questions || item.questions.length !== 2) {
        offenders.push(`"${item.id}" n'a pas exactement 2 questions`)
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

  it('chaque question a un id unique à travers tout le fichier', () => {
    const questionIds = texts.flatMap((t) => (t.questions ?? []).map((q) => q.id))
    expect(new Set(questionIds).size).toBe(questionIds.length)
  })

  it('chaque texte référence au moins un skillId du niveau 10', () => {
    for (const item of texts) {
      expect(item.skillIds.length).toBeGreaterThan(0)
      for (const skillId of item.skillIds) {
        expect(['L10-lecture-autonome']).toContain(skillId)
      }
    }
  })
})

describe('texts-l10.json — decodabilite', () => {
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

  it('tout mot non décodable au niveau 10 est un mot-outil de la liste SPEC §5', () => {
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

  it('chaque grapheme de chaque mot décodable appartient à graphemesKnownAtLevel(10)', () => {
    const known = graphemesKnownAtLevel(10)
    const offenders: string[] = []
    for (const item of texts) {
      for (const word of words(item.text)) {
        if (SIGHT_WORDS.has(word)) continue
        for (const g of WORD_GRAPHEMES[word] ?? []) {
          if (!known.has(g)) {
            offenders.push(`"${item.id}" : "${word}" utilise "${g}", inconnu au niveau 10`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('graphemesKnownAtLevel(10) est identique à graphemesKnownAtLevel(7) (aucun nouveau grapheme au niveau 10)', () => {
    const known7 = [...graphemesKnownAtLevel(7)].sort()
    const known10 = [...graphemesKnownAtLevel(10)].sort()
    expect(known10).toEqual(known7)
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
})
