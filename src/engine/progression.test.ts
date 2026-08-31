import { describe, expect, it } from 'vitest'
import { canUnlockNextLevel } from './progression'
import type { MasteryState, SkillMastery } from '../types'

function skill(skillId: string, last10: boolean[]): SkillMastery {
  return { skillId, last10, masteredAt: null, decayedAt: null }
}

const FULL_MASTERED = [true, true, true, true, true, true, true, true, true, true]

describe('canUnlockNextLevel', () => {
  it('refuse le déblocage si le boss n\'est pas réussi, même si toutes les compétences sont maîtrisées', () => {
    const mastery: MasteryState = {
      skills: { s1: skill('s1', FULL_MASTERED) },
      reviewQueue: [],
    }
    expect(canUnlockNextLevel(mastery, ['s1'], false)).toBe(false)
  })

  it('refuse le déblocage si une seule compétence requise n\'est pas maîtrisée', () => {
    const mastery: MasteryState = {
      skills: {
        s1: skill('s1', FULL_MASTERED),
        // 7/10 correctes : sous le seuil de 8/10
        s2: skill('s2', [true, true, true, true, true, true, true, false, false, false]),
      },
      reviewQueue: [],
    }
    expect(canUnlockNextLevel(mastery, ['s1', 's2'], true)).toBe(false)
  })

  it('autorise le déblocage seulement quand toutes les compétences requises sont maîtrisées ET le boss réussi', () => {
    const mastery: MasteryState = {
      skills: {
        s1: skill('s1', FULL_MASTERED),
        // 9/10 correctes : au-dessus du seuil de 8/10
        s2: skill('s2', [false, true, true, true, true, true, true, true, true, true]),
      },
      reviewQueue: [],
    }
    expect(canUnlockNextLevel(mastery, ['s1', 's2'], true)).toBe(true)
  })

  it('refuse le déblocage si une compétence requise est absente de MasteryState', () => {
    const mastery: MasteryState = { skills: {}, reviewQueue: [] }
    expect(canUnlockNextLevel(mastery, ['s1'], true)).toBe(false)
  })

  it('refuse le déblocage tant que la fenêtre de la compétence n\'a pas encore 10 entrées, même si toutes sont correctes', () => {
    const mastery: MasteryState = {
      // 8/8 correctes, mais la fenêtre n'a que 8 entrées, pas 10 : "8 des 10
      // dernières" n'est pas encore mesurable, donc pas mastered par optimisme.
      skills: { s1: skill('s1', [true, true, true, true, true, true, true, true]) },
      reviewQueue: [],
    }
    expect(canUnlockNextLevel(mastery, ['s1'], true)).toBe(false)
  })

  it('requiredSkillIds vide est trivialement satisfait, mais le boss reste requis dans tous les cas', () => {
    const mastery: MasteryState = { skills: {}, reviewQueue: [] }
    expect(canUnlockNextLevel(mastery, [], true)).toBe(true)
    expect(canUnlockNextLevel(mastery, [], false)).toBe(false)
  })

  // --- La preuve demandée par le driver : temps de jeu et tentatives ne débloquent jamais rien ---

  it('la signature de canUnlockNextLevel n\'accepte QUE (mastery, requiredSkillIds, bossCompleted) : impossible par construction de lui fournir un temps de jeu ou un nombre de tentatives', () => {
    expect(canUnlockNextLevel.length).toBe(3)
  })

  it('un historique synthétique de très nombreuses tentatives (temps de jeu élevé simulé par un long historique) mais sous le seuil de maîtrise ne débloque rien', () => {
    // La fenêtre glissante ne retient que les 10 dernières réponses : peu
    // importe combien de tentatives ont précédé (des centaines, simulées ici
    // par un motif alterné), seul le contenu de `last10` compte, et il reste
    // sous le seuil de 8/10.
    const longButInsufficientHistory = Array.from({ length: 10 }, (_, i) => i % 2 === 0)
    const mastery: MasteryState = {
      skills: { s1: skill('s1', longButInsufficientHistory) },
      reviewQueue: [],
    }
    expect(canUnlockNextLevel(mastery, ['s1'], true)).toBe(false)
  })

  it('un boss réussi de nombreuses fois (répété) ne compense jamais une compétence non maîtrisée', () => {
    const mastery: MasteryState = {
      skills: { s1: skill('s1', [false, false, false, false, false, false, false, false, false, false]) },
      reviewQueue: [],
    }
    // "bossCompleted" répété n'existe même pas comme concept ici : un simple
    // booléen vrai, autant de fois qu'on l'appelle, ne débloque rien si la
    // compétence n'est pas maîtrisée.
    expect(canUnlockNextLevel(mastery, ['s1'], true)).toBe(false)
    expect(canUnlockNextLevel(mastery, ['s1'], true)).toBe(false)
    expect(canUnlockNextLevel(mastery, ['s1'], true)).toBe(false)
  })
})
