// Tests de logique pure de buildForgePieces (indépendants du rendu React —
// voir pieces.ts pour les décisions détaillées).
import { describe, expect, it } from 'vitest'
import type { ChallengeOption, ContentItem } from '../../types'
import { buildForgePieces } from './pieces'

function makeItem(id: string, graphemeIds: string[]): ContentItem {
  return { id, kind: 'word', level: 3, text: id, graphemeIds, skillIds: [] }
}

const target = makeItem('target', ['ch', 'a', 't'])

function resolve(items: ContentItem[]) {
  const map = new Map(items.map((item) => [item.id, item]))
  return (id: string): ContentItem => {
    const found = map.get(id)
    if (!found) throw new Error(`item inconnu : ${id}`)
    return found
  }
}

describe('buildForgePieces — pièces cible', () => {
  it('une pièce par graphème cible, avec des id distincts même pour des valeurs répétées', () => {
    const papa = makeItem('papa', ['p', 'a', 'p', 'a'])
    const pieces = buildForgePieces(papa, [], resolve([papa]))
    const targetPieces = pieces.filter((p) => !p.isDistractor)
    expect(targetPieces).toHaveLength(4)
    expect(new Set(targetPieces.map((p) => p.id)).size).toBe(4)
    expect(targetPieces.map((p) => p.graphemeId).sort()).toEqual(['a', 'a', 'p', 'p'])
  })
})

describe('buildForgePieces — distracteurs, exclusion de chevauchement', () => {
  it("choisit le premier graphème du distracteur qui n'est PAS dans la cible", () => {
    const decoy = makeItem('decoy', ['ch', 'i', 'en']) // "ch" chevauche la cible "chat"
    const options: ChallengeOption[] = [{ id: 'o1', contentItemId: decoy.id, isDistractor: true }]
    const pieces = buildForgePieces(target, options, resolve([target, decoy]))
    const distractors = pieces.filter((p) => p.isDistractor)
    expect(distractors).toHaveLength(1)
    expect(distractors[0].graphemeId).toBe('i')
  })

  it("n'ajoute AUCUNE pièce distractrice si tous les graphèmes de l'option chevauchent la cible", () => {
    const decoy = makeItem('decoy', ['ch', 'a', 't']) // chevauche entièrement "chat"
    const options: ChallengeOption[] = [{ id: 'o1', contentItemId: decoy.id, isDistractor: true }]
    const pieces = buildForgePieces(target, options, resolve([target, decoy]))
    expect(pieces.filter((p) => p.isDistractor)).toHaveLength(0)
  })

  it('ignore les options non marquées isDistractor (jamais de pièce fabriquée hors de challenge.options)', () => {
    const other = makeItem('other', ['o', 'u'])
    const options: ChallengeOption[] = [{ id: 'o1', contentItemId: other.id, isDistractor: false }]
    const pieces = buildForgePieces(target, options, resolve([target, other]))
    expect(pieces.filter((p) => p.isDistractor)).toHaveLength(0)
  })

  it('une pièce distractrice par option distractrice éligible, jamais tous les graphèmes de l\'item', () => {
    const decoy = makeItem('decoy', ['o', 'u', 'p']) // 3 graphèmes, aucun dans la cible
    const options: ChallengeOption[] = [{ id: 'o1', contentItemId: decoy.id, isDistractor: true }]
    const pieces = buildForgePieces(target, options, resolve([target, decoy]))
    const distractors = pieces.filter((p) => p.isDistractor)
    expect(distractors).toHaveLength(1)
    expect(distractors[0].graphemeId).toBe('o')
  })

  it('deux options distractrices distinctes ne produisent jamais deux pièces de même valeur', () => {
    const decoyA = makeItem('decoyA', ['o', 'u'])
    const decoyB = makeItem('decoyB', ['o', 'p']) // "o" déjà retenu par decoyA -> doit retomber sur "p"
    const options: ChallengeOption[] = [
      { id: 'o1', contentItemId: decoyA.id, isDistractor: true },
      { id: 'o2', contentItemId: decoyB.id, isDistractor: true },
    ]
    const pieces = buildForgePieces(target, options, resolve([target, decoyA, decoyB]))
    // L'ordre final est mélangé (voir describe "mélange" ci-dessous) : on
    // compare un ensemble, pas une séquence.
    const distractorValues = pieces.filter((p) => p.isDistractor).map((p) => p.graphemeId)
    expect(distractorValues.sort()).toEqual(['o', 'p'])
  })
})

describe('buildForgePieces — mélange', () => {
  it("sur 200 tirages, l'ordre des pièces n'est jamais systématiquement celui de la cible", () => {
    const decoy = makeItem('decoy', ['o', 'u'])
    const options: ChallengeOption[] = [{ id: 'o1', contentItemId: decoy.id, isDistractor: true }]
    let sawNonIdentityOrder = false
    for (let i = 0; i < 200; i += 1) {
      const pieces = buildForgePieces(target, options, resolve([target, decoy]))
      const ids = pieces.map((p) => p.id)
      if (ids.join(',') !== 'target-0,target-1,target-2,distractor-0') {
        sawNonIdentityOrder = true
        break
      }
    }
    expect(sawNonIdentityOrder).toBe(true)
  })

  it('rng injecté : mélange déterministe et reproductible', () => {
    const decoy = makeItem('decoy', ['o', 'u'])
    const options: ChallengeOption[] = [{ id: 'o1', contentItemId: decoy.id, isDistractor: true }]
    const constantRng = () => 0.999999 // pousse chaque élément vers l'index le plus bas à chaque étape
    const a = buildForgePieces(target, options, resolve([target, decoy]), constantRng)
    const b = buildForgePieces(target, options, resolve([target, decoy]), constantRng)
    expect(a.map((p) => p.id)).toEqual(b.map((p) => p.id))
  })
})
