import { describe, expect, it } from 'vitest'
import type { ContentItem } from '../../types'
import { graphemesKnownAtLevel } from '../curriculum'
import rawSentences from './sentences-l8.json'

const sentences = rawSentences as ContentItem[]

// Liste figée SPEC §5 niveau 8 : mots-outils "reconnus globalement", seule
// exception à la contrainte de décodabilité. Décision de modélisation (voir
// ASSUMPTIONS.md) : ContentItem n'a qu'un seul graphemeIds/isSightWord par
// item, or une phrase (kind: 'sentence') mélange mots-outils et mots
// décodables. On ne crée donc pas d'items 'word' isSightWord séparés ici :
// les mots-outils sont simplement EXCLUS du graphemeIds de la phrase (ils ne
// sont jamais décodés lettre à lettre), et seuls les mots décodables du reste
// de la phrase y contribuent. isSightWord n'est pas posé sur l'item 'sentence'
// lui-même (ce champ documente un mot-outil isolé, pas une phrase entière).
const SIGHT_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'est', 'et', 'dans', 'sur', 'avec',
  'il', 'elle', 'je', 'tu', 'a', 'ont', 'qui',
])

// Décomposition graphémique explicite de chaque mot décodable utilisé dans le
// corpus de phrases (SPEC : "le découpage d'un mot en graphèmes est fourni
// explicitement... ne pas tenter de le deviner à l'exécution"). Fournie ici
// comme fixture de test pour vérifier, mot par mot, que rien n'échappe à la
// contrainte de décodabilité et que le graphemeIds déclaré dans le JSON est
// bien la somme des mots réellement décodables de la phrase.
const WORD_GRAPHEMES: Record<string, string[]> = {
  chat: ['ch', 'a', 't'],
  souris: ['s', 'ou', 'r', 'i', 's'],
  chapeau: ['ch', 'a', 'p', 'eau'],
  loup: ['l', 'ou', 'p'],
  boit: ['b', 'oi', 't'],
  lac: ['l', 'a', 'c-dur'],
  chien: ['ch', 'i', 'en'],
  saute: ['s', 'au', 't', 'e-muet'],
  chaton: ['ch', 'a', 't', 'on'],
  papa: ['p', 'a', 'p', 'a'],
  vélo: ['v', 'é', 'l', 'o'],
  vélos: ['v', 'é', 'l', 'o', 's'],
  maman: ['m', 'a', 'm', 'an'],
  chante: ['ch', 'an', 't', 'e-muet'],
  chantes: ['ch', 'an', 't', 'e-muet', 's'],
  parc: ['p', 'a', 'r', 'c-dur'],
  lion: ['l', 'i', 'on'],
  fort: ['f', 'o', 'r', 't'],
  tortue: ['t', 'o', 'r', 't', 'u', 'e-muet'],
  arrive: ['a', 'r', 'r', 'i', 'v', 'e-muet'],
  robot: ['r', 'o', 'b', 'o', 't'],
  danse: ['d', 'an', 's', 'e-muet'],
  sac: ['s', 'a', 'c-dur'],
  sofa: ['s', 'o', 'f', 'a'],
  dame: ['d', 'a', 'm', 'e-muet'],
  valise: ['v', 'a', 'l', 'i', 's', 'e-muet'],
  nid: ['n', 'i', 'd'],
  dinosaure: ['d', 'i', 'n', 'o', 's', 'au', 'r', 'e-muet'],
  bébé: ['b', 'é', 'b', 'é'],
  rit: ['r', 'i', 't'],
  bol: ['b', 'o', 'l'],
  ami: ['a', 'm', 'i'],
  amie: ['a', 'm', 'i', 'e-muet'],
  enfants: ['en', 'f', 'an', 't', 's'],
  fourmi: ['f', 'ou', 'r', 'm', 'i'],
  porte: ['p', 'o', 'r', 't', 'e-muet'],
  tulipe: ['t', 'u', 'l', 'i', 'p', 'e-muet'],
  minou: ['m', 'i', 'n', 'ou'],
  dort: ['d', 'o', 'r', 't'],
  content: ['c-dur', 'on', 't', 'en', 't'],
  beau: ['b', 'eau'],
  bonne: ['b', 'o', 'n', 'n', 'e-muet'],
  banane: ['b', 'a', 'n', 'a', 'n', 'e-muet'],
  cube: ['c-dur', 'u', 'b', 'e-muet'],
  canif: ['c-dur', 'a', 'n', 'i', 'f'],
  cabane: ['c-dur', 'a', 'b', 'a', 'n', 'e-muet'],
  boutons: ['b', 'ou', 't', 'on', 's'],
  glisse: ['g-dur', 'l', 'i', 's', 's', 'e-muet'],
  monte: ['m', 'on', 't', 'e-muet'],
  lit: ['l', 'i', 't'],
  aime: ['ai', 'm', 'e-muet'],
}

// Lettre(s) littérale(s) représentée(s) par chaque grapheme utilisable
// jusqu'au niveau 8 (aucun nouveau grapheme n'est introduit au niveau 8 :
// graphemesKnownAtLevel(8) === graphemesKnownAtLevel(7)). Sert uniquement à
// vérifier que WORD_GRAPHEMES reconstruit l'orthographe exacte de chaque mot.
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

function words(text: string): string[] {
  return text
    .split(/\s+/)
    .map(stripPunctuation)
    .filter((w) => w.length > 0)
}

describe('sentences-l8.json — volume et forme', () => {
  it('contient au moins 30 phrases de niveau 8', () => {
    expect(sentences.length).toBeGreaterThanOrEqual(30)
  })

  it('chaque item est de kind "sentence" et de niveau 8', () => {
    for (const item of sentences) {
      expect(item.kind).toBe('sentence')
      expect(item.level).toBe(8)
    }
  })

  it('chaque phrase a un id et un text non vides et uniques', () => {
    const ids = sentences.map((s) => s.id)
    const texts = sentences.map((s) => s.text)
    expect(ids.every((id) => id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
    expect(texts.every((t) => t.length > 0)).toBe(true)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('chaque phrase contient de 3 à 6 mots', () => {
    const offenders: string[] = []
    for (const item of sentences) {
      const count = words(item.text).length
      if (count < 3 || count > 6) {
        offenders.push(`"${item.text}" a ${count} mots`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('chaque phrase commence par une majuscule et finit par un point', () => {
    const offenders: string[] = []
    for (const item of sentences) {
      const t = item.text
      if (!/^[A-ZÀ-Ü]/.test(t)) {
        offenders.push(`"${t}" ne commence pas par une majuscule`)
      }
      if (!t.endsWith('.')) {
        offenders.push(`"${t}" ne finit pas par un point`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('chaque phrase référence au moins un skillId du niveau 8', () => {
    for (const item of sentences) {
      expect(item.skillIds.length).toBeGreaterThan(0)
      for (const skillId of item.skillIds) {
        expect(['L8-mots-outils', 'L8-majuscule-point']).toContain(skillId)
      }
    }
  })
})

describe('sentences-l8.json — decodabilite', () => {
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

  it('tout mot non décodable au niveau 8 est un mot-outil de la liste SPEC §5', () => {
    const offenders: string[] = []
    for (const item of sentences) {
      for (const word of words(item.text)) {
        if (SIGHT_WORDS.has(word)) continue
        if (!WORD_GRAPHEMES[word]) {
          offenders.push(`"${item.text}" : le mot "${word}" n'est ni un mot-outil ni décomposé`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('chaque grapheme de chaque mot décodable appartient à graphemesKnownAtLevel(8)', () => {
    const known = graphemesKnownAtLevel(8)
    const offenders: string[] = []
    for (const item of sentences) {
      for (const word of words(item.text)) {
        if (SIGHT_WORDS.has(word)) continue
        for (const g of WORD_GRAPHEMES[word] ?? []) {
          if (!known.has(g)) {
            offenders.push(`"${item.text}" : "${word}" utilise "${g}", inconnu au niveau 8`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('le graphemeIds déclaré de chaque phrase est exactement l\'union des mots décodables (mots-outils exclus)', () => {
    const offenders: string[] = []
    for (const item of sentences) {
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
        offenders.push(`"${item.text}" : manquants=[${missing.join(',')}] en-trop=[${extra.join(',')}]`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('chaque phrase utilise au moins un mot-outil de la liste SPEC §5', () => {
    const offenders: string[] = []
    for (const item of sentences) {
      const hasSightWord = words(item.text).some((w) => SIGHT_WORDS.has(w))
      if (!hasSightWord) {
        offenders.push(item.text)
      }
    }
    expect(offenders).toEqual([])
  })
})
