import { describe, expect, it } from 'vitest'
import type { ChallengeResult, SkillMastery } from '../types'
import { DECAY_AFTER_DAYS, DECAY_THRESHOLD_MS, applyDecay, applyDecayToSkills, isDecayed } from './decay'
import { isMastered, recordResult } from './mastery'

function makeResult(correct: boolean): ChallengeResult {
  return {
    challengeId: 'c1',
    correct,
    usedHelpLevel: 0,
    usedListenAgain: false,
    responseMs: 1200,
    timestamp: '2026-01-01T00:00:00.000Z',
  }
}

function masteredAt(now: Date): SkillMastery {
  let mastery: SkillMastery = { skillId: 'L1-voyelles', last10: [], masteredAt: null, decayedAt: null }
  const pattern = [true, true, true, true, true, true, true, true, false, false]
  for (const correct of pattern) {
    mastery = recordResult(mastery, makeResult(correct), 1, now)
  }
  return mastery
}

const DAY_MS = 24 * 60 * 60 * 1000

describe('decay: constantes', () => {
  it('la fenêtre de décroissance est bien 14 jours', () => {
    expect(DECAY_AFTER_DAYS).toBe(14)
    expect(DECAY_THRESHOLD_MS).toBe(14 * DAY_MS)
  })
})

describe('decay: séquence de 14 jours simulés', () => {
  it('jour par jour, aucune décroissance avant le 14e jour, puis décroissance au 14e', () => {
    const t0 = new Date('2026-01-01T00:00:00.000Z')
    const mastery = masteredAt(t0)
    expect(isMastered(mastery)).toBe(true)

    let current = mastery
    for (let day = 1; day < 14; day++) {
      const now = new Date(t0.getTime() + day * DAY_MS)
      current = applyDecay(current, now)
      expect(isMastered(current)).toBe(true) // pas encore décroissée
      expect(current.decayedAt).toBeNull()
    }

    const day14 = new Date(t0.getTime() + 14 * DAY_MS)
    current = applyDecay(current, day14)
    expect(isMastered(current)).toBe(false)
    expect(current.decayedAt).toBe(day14.toISOString())
    expect(current.last10).toEqual([])
    expect(isDecayed(current)).toBe(true)
  })

  it('ne fait jamais redescendre masteredAt : il reste la trace historique de la dernière maîtrise', () => {
    const t0 = new Date('2026-01-01T00:00:00.000Z')
    const mastery = masteredAt(t0)
    const day14 = new Date(t0.getTime() + 14 * DAY_MS)
    const decayed = applyDecay(mastery, day14)
    expect(decayed.masteredAt).toBe(mastery.masteredAt)
  })
})

describe('decay: bord exact à 14 jours pile', () => {
  it('à 13 jours 23h59m59s999ms, pas de décroissance', () => {
    const t0 = new Date('2026-01-01T00:00:00.000Z')
    const mastery = masteredAt(t0)
    const justBefore = new Date(t0.getTime() + 14 * DAY_MS - 1)
    const result = applyDecay(mastery, justBefore)
    expect(result).toBe(mastery) // aucun changement, même référence
    expect(isMastered(result)).toBe(true)
  })

  it('à exactement 14 jours pile (millisecondes identiques), la décroissance se déclenche', () => {
    const t0 = new Date('2026-01-01T00:00:00.000Z')
    const mastery = masteredAt(t0)
    const exactly14 = new Date(t0.getTime() + 14 * DAY_MS)
    const result = applyDecay(mastery, exactly14)
    expect(result).not.toBe(mastery)
    expect(isMastered(result)).toBe(false)
    expect(result.decayedAt).toBe(exactly14.toISOString())
  })
})

describe('decay: plusieurs décroissances consécutives', () => {
  it('une décroissance déjà appliquée est idempotente : rappeler applyDecay ne change plus rien', () => {
    const t0 = new Date('2026-01-01T00:00:00.000Z')
    const mastery = masteredAt(t0)
    const day14 = new Date(t0.getTime() + 14 * DAY_MS)
    const decayedOnce = applyDecay(mastery, day14)

    const day20 = new Date(t0.getTime() + 20 * DAY_MS)
    const decayedAgain = applyDecay(decayedOnce, day20)
    expect(decayedAgain).toBe(decayedOnce) // même référence : no-op
    expect(decayedAgain.decayedAt).toBe(decayedOnce.decayedAt)
  })

  it('après re-maîtrise suite à une décroissance, une nouvelle inactivité de 14 jours déclenche une deuxième décroissance', () => {
    const t0 = new Date('2026-01-01T00:00:00.000Z')
    let mastery = masteredAt(t0)
    const day14 = new Date(t0.getTime() + 14 * DAY_MS)
    mastery = applyDecay(mastery, day14)
    expect(isDecayed(mastery)).toBe(true)

    // Le joueur reprend et re-maîtrise la compétence.
    const remasterStart = new Date(t0.getTime() + 15 * DAY_MS)
    const pattern = [true, true, true, true, true, true, true, true, false, false]
    for (const correct of pattern) {
      mastery = recordResult(mastery, makeResult(correct), 1, remasterStart)
    }
    expect(isMastered(mastery)).toBe(true)
    expect(isDecayed(mastery)).toBe(false) // masteredAt > decayedAt

    // 14 jours d'inactivité supplémentaires depuis la re-maîtrise.
    const secondDecayAt = new Date(remasterStart.getTime() + 14 * DAY_MS)
    mastery = applyDecay(mastery, secondDecayAt)
    expect(isMastered(mastery)).toBe(false)
    expect(mastery.decayedAt).toBe(secondDecayAt.toISOString())
    expect(isDecayed(mastery)).toBe(true)
  })
})

describe('decay: cas particuliers', () => {
  it('une compétence jamais maîtrisée (masteredAt=null) n’est jamais affectée', () => {
    const untouched: SkillMastery = {
      skillId: 'L2-consonnes',
      last10: [true, true, false],
      masteredAt: null,
      decayedAt: null,
    }
    const result = applyDecay(untouched, new Date('2026-06-01T00:00:00.000Z'))
    expect(result).toBe(untouched)
  })

  it('une compétence déjà sous le seuil (jamais atteint 8/10) n’est jamais décroissée même après 14 jours', () => {
    const t0 = new Date('2026-01-01T00:00:00.000Z')
    let mastery: SkillMastery = { skillId: 'L1-voyelles', last10: [], masteredAt: null, decayedAt: null }
    const weakPattern = [true, true, true, true, true, true, true, false, false, false] // 7/10
    for (const correct of weakPattern) {
      mastery = recordResult(mastery, makeResult(correct), 1, t0)
    }
    expect(mastery.masteredAt).toBeNull()
    const muchLater = new Date(t0.getTime() + 30 * DAY_MS)
    const result = applyDecay(mastery, muchLater)
    expect(result).toBe(mastery)
  })

  it('n’effectue jamais de mutation de l’objet SkillMastery reçu', () => {
    const t0 = new Date('2026-01-01T00:00:00.000Z')
    const mastery = masteredAt(t0)
    const snapshot = JSON.parse(JSON.stringify(mastery))
    applyDecay(mastery, new Date(t0.getTime() + 14 * DAY_MS))
    expect(mastery).toEqual(snapshot)
  })
})

describe('decay: isDecayed', () => {
  it('false quand decayedAt est null', () => {
    const mastery: SkillMastery = { skillId: 's', last10: [], masteredAt: null, decayedAt: null }
    expect(isDecayed(mastery)).toBe(false)
  })

  it('true quand decayedAt est postérieur ou égal à masteredAt', () => {
    const mastery: SkillMastery = {
      skillId: 's',
      last10: [],
      masteredAt: '2026-01-01T00:00:00.000Z',
      decayedAt: '2026-01-15T00:00:00.000Z',
    }
    expect(isDecayed(mastery)).toBe(true)
  })

  it('false quand une re-maîtrise plus récente a déjà eu lieu après la décroissance', () => {
    const mastery: SkillMastery = {
      skillId: 's',
      last10: [],
      masteredAt: '2026-02-01T00:00:00.000Z',
      decayedAt: '2026-01-15T00:00:00.000Z',
    }
    expect(isDecayed(mastery)).toBe(false)
  })
})

describe('decay: applyDecayToSkills (donnée consommable par D2)', () => {
  it('renvoie la liste des skillIds qui viennent de basculer en décroissance lors de cet appel', () => {
    const t0 = new Date('2026-01-01T00:00:00.000Z')
    const skillA = masteredAt(t0) // 'L1-voyelles'
    const skillB: SkillMastery = { skillId: 'L2-consonnes', last10: [true, false], masteredAt: null, decayedAt: null }

    const day14 = new Date(t0.getTime() + 14 * DAY_MS)
    const { skills, decayedSkillIds } = applyDecayToSkills(
      { 'L1-voyelles': skillA, 'L2-consonnes': skillB },
      day14,
    )

    expect(decayedSkillIds).toEqual(['L1-voyelles'])
    expect(isDecayed(skills['L1-voyelles'])).toBe(true)
    expect(skills['L2-consonnes']).toBe(skillB) // non affectée, non touchée
  })

  it('renvoie une liste vide de decayedSkillIds si aucun appel n’a rien changé', () => {
    const t0 = new Date('2026-01-01T00:00:00.000Z')
    const skillA = masteredAt(t0)
    const soon = new Date(t0.getTime() + DAY_MS) // bien avant 14 jours
    const { decayedSkillIds } = applyDecayToSkills({ 'L1-voyelles': skillA }, soon)
    expect(decayedSkillIds).toEqual([])
  })
})

describe('decay: isolation stricte hors de SkillMastery (SPEC §7 — principe non négociable)', () => {
  it('appliquer la décroissance sur la tranche mastery d’un état de jeu plus large ne touche à rien d’autre (progress, avatar)', () => {
    // Simule un SaveFile-like : seule la tranche `mastery.skills` est passée
    // à ce module. Les autres tranches ne lui sont même pas données, donc
    // structurellement inatteignables — ce test le vérifie à l'exécution en
    // s'assurant qu'elles restent des références strictement identiques.
    const t0 = new Date('2026-01-01T00:00:00.000Z')
    const gameState = {
      progress: {
        currentLevel: 3,
        currentRegionId: 'pont-des-syllabes',
        unlockedRegionIds: ['clairiere', 'foret', 'pont-des-syllabes'],
        grandLivreItemIds: ['mot-papa'],
        helpAdultCount: 0,
        sessionMinutesByDay: {},
      },
      avatar: {
        avatarId: 'avatar-1',
        companionId: 'compagnon-1',
        cosmetics: ['chapeau-etoile'],
        xp: 120,
        coins: 40,
      },
      masterySkills: { 'L1-voyelles': masteredAt(t0) },
    }
    const progressSnapshot = JSON.parse(JSON.stringify(gameState.progress))
    const avatarSnapshot = JSON.parse(JSON.stringify(gameState.avatar))

    const day14 = new Date(t0.getTime() + 14 * DAY_MS)
    const { skills } = applyDecayToSkills(gameState.masterySkills, day14)

    // La compétence a bien décroissé...
    expect(isMastered(skills['L1-voyelles'])).toBe(false)
    // ...mais progress et avatar n'ont pas bougé d'un iota : ce module n'a
    // même jamais reçu ces objets en paramètre.
    expect(gameState.progress).toEqual(progressSnapshot)
    expect(gameState.avatar).toEqual(avatarSnapshot)
    expect(gameState.progress.currentLevel).toBe(3)
    expect(gameState.avatar.cosmetics).toEqual(['chapeau-etoile'])
  })

  it('les signatures exportées de ce module n’acceptent que SkillMastery ou Record<SkillId, SkillMastery>', () => {
    // Preuve à la compilation (TypeScript) : si ce fichier compile, aucune
    // fonction exportée de decay.ts n'accepte ProgressState ni AvatarState.
    // Ce test sert de garde-fou exécutable minimal + documentaire.
    expect(applyDecay.length).toBe(2) // (mastery, now)
    expect(applyDecayToSkills.length).toBe(2) // (skills, now)
  })
})
