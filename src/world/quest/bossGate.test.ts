import { describe, expect, it } from 'vitest'
import type { MasteryState, SkillMastery } from '../../types'
import { canStartBossQuest } from './bossGate'

function masteredSkill(skillId: string): SkillMastery {
  return {
    skillId,
    last10: [true, true, true, true, true, true, true, true, false, true], // 9/10, largement mastered
    masteredAt: '2026-01-01T00:00:00.000Z',
    decayedAt: null,
  }
}

function unmasteredSkill(skillId: string): SkillMastery {
  return {
    skillId,
    last10: [true, true, false, false, false, false, false, true, false, false], // 3/10
    masteredAt: null,
    decayedAt: null,
  }
}

function notEnoughDataSkill(skillId: string): SkillMastery {
  return { skillId, last10: [true, true, true], masteredAt: null, decayedAt: null } // < 10 réponses
}

describe('canStartBossQuest — G3', () => {
  it('est vrai quand toutes les compétences requises sont maîtrisées', () => {
    const mastery: MasteryState = {
      skills: {
        'L2-consonnes': masteredSkill('L2-consonnes'),
      },
      reviewQueue: [],
    }
    expect(canStartBossQuest(mastery, ['L2-consonnes'])).toBe(true)
  })

  it("est faux si UNE SEULE compétence requise n'est pas maîtrisée (SPEC §7 : maîtrise de TOUTES les compétences)", () => {
    const mastery: MasteryState = {
      skills: {
        'L4-consonnes': masteredSkill('L4-consonnes'),
        'L4-e-muet': unmasteredSkill('L4-e-muet'),
      },
      reviewQueue: [],
    }
    expect(canStartBossQuest(mastery, ['L4-consonnes', 'L4-e-muet'])).toBe(false)
  })

  it("est faux si une compétence requise n'a même pas d'entrée dans mastery.skills (jamais pratiquée)", () => {
    const mastery: MasteryState = { skills: {}, reviewQueue: [] }
    expect(canStartBossQuest(mastery, ['L1-voyelles'])).toBe(false)
  })

  it('est faux si une compétence a moins de 10 réponses enregistrées (pas encore mesurable, jamais vrai par optimisme)', () => {
    const mastery: MasteryState = {
      skills: { 'L1-voyelles': notEnoughDataSkill('L1-voyelles') },
      reviewQueue: [],
    }
    expect(canStartBossQuest(mastery, ['L1-voyelles'])).toBe(false)
  })

  it('DÉFAUT CHASSÉ : un boss sans AUCUNE compétence requise (tableau vide) ne doit jamais être le chemin normal, mais ne plante pas', () => {
    const mastery: MasteryState = { skills: {}, reviewQueue: [] }
    expect(() => canStartBossQuest(mastery, [])).not.toThrow()
    // Cohérent avec D4/canUnlockNextLevel : every() sur un tableau vide est
    // trivialement vrai — documenté, pas un bug de cette fonction (un
    // curriculum réel n'a jamais de niveau à 0 compétence, B1 l'interdit).
    expect(canStartBossQuest(mastery, [])).toBe(true)
  })

  it('vrai seulement quand PLUSIEURS compétences requises sont TOUTES maîtrisées ensemble', () => {
    const mastery: MasteryState = {
      skills: {
        'L7-lettres-muettes': masteredSkill('L7-lettres-muettes'),
        'L7-s-z': masteredSkill('L7-s-z'),
        'L7-c-g-doux': masteredSkill('L7-c-g-doux'),
      },
      reviewQueue: [],
    }
    expect(canStartBossQuest(mastery, ['L7-lettres-muettes', 'L7-s-z', 'L7-c-g-doux'])).toBe(true)
    expect(canStartBossQuest(mastery, ['L7-lettres-muettes', 'L7-s-z', 'L7-c-g-doux', 'L7-qu-ph'])).toBe(false)
  })
})
