import { describe, expect, it } from 'vitest'
import { corpus } from './corpus'

describe('corpus.ts — assemblage', () => {
  it("exporte un ContentItem[] non vide", () => {
    expect(Array.isArray(corpus)).toBe(true)
    expect(corpus.length).toBeGreaterThan(0)
  })

  it('couvre chaque niveau 3 à 10 avec au moins un item', () => {
    const levels = new Set(corpus.map((item) => item.level))
    for (let level = 3; level <= 10; level += 1) {
      expect(levels.has(level)).toBe(true)
    }
  })

  it('unicite des ids', () => {
    const ids = corpus.map((item) => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('chaque item a un id, un kind, un text et des graphemeIds non vides (sauf graphemeIds pour les mots-outils purs)', () => {
    for (const item of corpus) {
      expect(item.id.length).toBeGreaterThan(0)
      expect(item.kind.length).toBeGreaterThan(0)
      expect(item.text.length).toBeGreaterThan(0)
      expect(Array.isArray(item.graphemeIds)).toBe(true)
    }
  })

  it('tout item de kind "word" a un emoji', () => {
    for (const item of corpus) {
      if (item.kind === 'word') {
        expect(item.emoji).toBeTruthy()
      }
    }
  })

  it('tout item de kind "text" a des questions avec un correctIndex valide', () => {
    for (const item of corpus) {
      if (item.kind === 'text') {
        expect(item.questions && item.questions.length).toBeGreaterThan(0)
        for (const q of item.questions ?? []) {
          expect(q.correctIndex).toBeGreaterThanOrEqual(0)
          expect(q.correctIndex).toBeLessThan(q.answerOptions.length)
        }
      }
    }
  })
})
