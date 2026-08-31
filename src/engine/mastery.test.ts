import { describe, expect, it } from 'vitest'
import type { ChallengeResult, HelpLevel, SkillMastery } from '../types'
import {
  MASTERY_THRESHOLD,
  MASTERY_WINDOW,
  countsAsCorrectWithoutHelp,
  isMastered,
  recordResult,
} from './mastery'

function makeResult(overrides: Partial<ChallengeResult> = {}): ChallengeResult {
  return {
    challengeId: 'c1',
    correct: true,
    usedHelpLevel: 0 as HelpLevel,
    usedListenAgain: false,
    responseMs: 1500,
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function emptyMastery(): SkillMastery {
  return { skillId: 'L1-voyelles', last10: [], masteredAt: null, decayedAt: null }
}

/** Pousse une séquence de résultats corrects/incorrects (sans indice, sans réécoute). */
function pushSequence(mastery: SkillMastery, pattern: boolean[], level = 1): SkillMastery {
  let current = mastery
  for (const correct of pattern) {
    current = recordResult(current, makeResult({ correct }), level)
  }
  return current
}

describe('mastery: countsAsCorrectWithoutHelp', () => {
  it('compte correct + helpLevel 0 comme correct-sans-indice', () => {
    expect(countsAsCorrectWithoutHelp(makeResult(), 1)).toBe(true)
  })

  it('ne compte pas un résultat incorrect', () => {
    expect(countsAsCorrectWithoutHelp(makeResult({ correct: false }), 1)).toBe(false)
  })

  it('ne compte pas un résultat correct avec un niveau d’aide > 0', () => {
    expect(countsAsCorrectWithoutHelp(makeResult({ usedHelpLevel: 1 }), 1)).toBe(false)
    expect(countsAsCorrectWithoutHelp(makeResult({ usedHelpLevel: 2 }), 1)).toBe(false)
    expect(countsAsCorrectWithoutHelp(makeResult({ usedHelpLevel: 3 }), 1)).toBe(false)
  })
})

describe('mastery: isMastered — séquences synthétiques', () => {
  it('7/10 corrects-sans-indice → pas maîtrisé', () => {
    const pattern = [true, true, true, true, true, true, true, false, false, false]
    const mastery = pushSequence(emptyMastery(), pattern)
    expect(mastery.last10).toHaveLength(MASTERY_WINDOW)
    expect(isMastered(mastery)).toBe(false)
  })

  it('8/10 corrects-sans-indice → maîtrisé (seuil exact)', () => {
    const pattern = [true, true, true, true, true, true, true, true, false, false]
    const mastery = pushSequence(emptyMastery(), pattern)
    expect(isMastered(mastery)).toBe(true)
  })

  it('9/10 avec indices mélangés → maîtrisé si les indices restent sous le seuil de rupture', () => {
    // 9 réponses correctes, mais une avec usedHelpLevel=2 (compte comme raté),
    // donc 8/10 corrects-sans-indice au final : toujours maîtrisé.
    let mastery = emptyMastery()
    const pushes: ChallengeResult[] = [
      makeResult({ correct: true }),
      makeResult({ correct: true }),
      makeResult({ correct: true, usedHelpLevel: 2 }), // correct mais aidé → ne compte pas
      makeResult({ correct: true }),
      makeResult({ correct: true }),
      makeResult({ correct: true }),
      makeResult({ correct: true }),
      makeResult({ correct: true }),
      makeResult({ correct: true }),
      makeResult({ correct: false }),
    ]
    for (const r of pushes) mastery = recordResult(mastery, r, 1)
    expect(mastery.last10.filter(Boolean)).toHaveLength(8)
    expect(isMastered(mastery)).toBe(true)
  })

  it('9/10 avec indices mélangés → non maîtrisé si trop d’aide fait chuter sous 8', () => {
    let mastery = emptyMastery()
    const pushes: ChallengeResult[] = [
      makeResult({ correct: true }),
      makeResult({ correct: true, usedHelpLevel: 1 }),
      makeResult({ correct: true, usedHelpLevel: 3 }),
      makeResult({ correct: true }),
      makeResult({ correct: true }),
      makeResult({ correct: true }),
      makeResult({ correct: true }),
      makeResult({ correct: true }),
      makeResult({ correct: true }),
      makeResult({ correct: false }),
    ]
    for (const r of pushes) mastery = recordResult(mastery, r, 1)
    expect(mastery.last10.filter(Boolean)).toHaveLength(7)
    expect(isMastered(mastery)).toBe(false)
  })

  it('moins de 10 entrées → jamais maîtrisé, même à 9/9', () => {
    const pattern = [true, true, true, true, true, true, true, true, true]
    const mastery = pushSequence(emptyMastery(), pattern)
    expect(mastery.last10).toHaveLength(9)
    expect(isMastered(mastery)).toBe(false)
  })

  it('la fenêtre glissante ne dépasse jamais 10 entrées et ne garde que les plus récentes', () => {
    // 8 vrais suivis de 3 faux : si la fenêtre glissait mal on garderait
    // les 8 vrais + serait maîtrisé ; en réalité les 2 plus anciens vrais
    // sortent de la fenêtre.
    const pattern = [true, true, true, true, true, true, true, true, false, false, false]
    const mastery = pushSequence(emptyMastery(), pattern)
    expect(mastery.last10).toHaveLength(MASTERY_WINDOW)
    // 11 poussées au total : le plus ancien `true` sort de la fenêtre.
    // Les 10 dernières entrées sont donc : 7 true, puis false, false, false → 7/10
    expect(mastery.last10.filter(Boolean)).toHaveLength(7)
    expect(isMastered(mastery)).toBe(false)
  })
})

describe('mastery: masteredAt', () => {
  it('reste null tant que la compétence n’est pas maîtrisée', () => {
    const pattern = [true, true, true, true, true, true, true, false, false, false]
    const mastery = pushSequence(emptyMastery(), pattern)
    expect(mastery.masteredAt).toBeNull()
  })

  it('est fixé à l’horodatage injecté quand la maîtrise est atteinte', () => {
    const now = new Date('2026-03-15T10:00:00.000Z')
    let mastery = emptyMastery()
    const pattern = [true, true, true, true, true, true, true, true, false, false]
    for (const correct of pattern) {
      mastery = recordResult(mastery, makeResult({ correct }), 1, now)
    }
    expect(mastery.masteredAt).toBe(now.toISOString())
  })

  it('est republié (rafraîchi) tant que la compétence reste mesurée maîtrisée à chaque nouvel appel', () => {
    const t1 = new Date('2026-03-15T10:00:00.000Z')
    const t2 = new Date('2026-03-16T10:00:00.000Z')
    let mastery = emptyMastery()
    const pattern = [true, true, true, true, true, true, true, true, false, false]
    for (const correct of pattern) {
      mastery = recordResult(mastery, makeResult({ correct }), 1, t1)
    }
    expect(mastery.masteredAt).toBe(t1.toISOString())

    // Nouvelle réponse correcte-sans-indice : la fenêtre reste ≥8/10, la
    // compétence est toujours mesurée maîtrisée → masteredAt avance.
    mastery = recordResult(mastery, makeResult({ correct: true }), 1, t2)
    expect(isMastered(mastery)).toBe(true)
    expect(mastery.masteredAt).toBe(t2.toISOString())
  })

  it('n’est pas modifié par un appel qui fait perdre la maîtrise (chute sous 8/10)', () => {
    const t1 = new Date('2026-03-15T10:00:00.000Z')
    const t2 = new Date('2026-03-16T10:00:00.000Z')
    let mastery = emptyMastery()
    // 8/10 tout juste maîtrisé : true x8, false x2
    const pattern = [true, true, true, true, true, true, true, true, false, false]
    for (const correct of pattern) {
      mastery = recordResult(mastery, makeResult({ correct }), 1, t1)
    }
    expect(mastery.masteredAt).toBe(t1.toISOString())

    // Une nouvelle réponse ratée fait glisser la fenêtre : les 10 dernières
    // deviennent 7 true / 3 false → sous le seuil.
    mastery = recordResult(mastery, makeResult({ correct: false }), 1, t2)
    expect(isMastered(mastery)).toBe(false)
    expect(mastery.masteredAt).toBe(t1.toISOString())
  })

  it('utilise `new Date()` par défaut si aucun horodatage n’est injecté', () => {
    const before = Date.now()
    let mastery = emptyMastery()
    const pattern = [true, true, true, true, true, true, true, true, false, false]
    for (const correct of pattern) {
      mastery = recordResult(mastery, makeResult({ correct }), 1)
    }
    const after = Date.now()
    expect(mastery.masteredAt).not.toBeNull()
    const masteredAtMs = new Date(mastery.masteredAt as string).getTime()
    expect(masteredAtMs).toBeGreaterThanOrEqual(before)
    expect(masteredAtMs).toBeLessThanOrEqual(after)
  })
})

describe('mastery: pureté', () => {
  it('recordResult ne mute jamais l’objet SkillMastery reçu', () => {
    const original = emptyMastery()
    const snapshot = JSON.parse(JSON.stringify(original))
    recordResult(original, makeResult({ correct: true }), 1, new Date('2026-01-01T00:00:00.000Z'))
    expect(original).toEqual(snapshot)
  })

  it('renvoie un nouvel objet (pas la même référence) à chaque appel', () => {
    const original = emptyMastery()
    const updated = recordResult(original, makeResult({ correct: true }), 1)
    expect(updated).not.toBe(original)
    expect(updated.last10).not.toBe(original.last10)
  })
})

describe('mastery: reecoute (usedListenAgain)', () => {
  it('à un niveau normal (≠10), la réécoute ne compte pas comme un indice : correct + usedListenAgain=true + usedHelpLevel=0 → correct-sans-indice', () => {
    const result = makeResult({ correct: true, usedHelpLevel: 0, usedListenAgain: true })
    expect(countsAsCorrectWithoutHelp(result, 1)).toBe(true)
    expect(countsAsCorrectWithoutHelp(result, 7)).toBe(true)
    expect(countsAsCorrectWithoutHelp(result, 9)).toBe(true)
  })

  it('au niveau 10, la réécoute compte comme un indice : correct + usedListenAgain=true + usedHelpLevel=0 → NE compte PAS comme correct-sans-indice', () => {
    const result = makeResult({ correct: true, usedHelpLevel: 0, usedListenAgain: true })
    expect(countsAsCorrectWithoutHelp(result, 10)).toBe(false)
  })

  it('au niveau 10, sans réécoute, un résultat correct sans indice compte normalement', () => {
    const result = makeResult({ correct: true, usedHelpLevel: 0, usedListenAgain: false })
    expect(countsAsCorrectWithoutHelp(result, 10)).toBe(true)
  })

  it('une séquence de 8/10 correcte avec réécoute systématique à un niveau normal reste maîtrisée', () => {
    let mastery = emptyMastery()
    const pattern = [true, true, true, true, true, true, true, true, false, false]
    for (const correct of pattern) {
      mastery = recordResult(
        mastery,
        makeResult({ correct, usedListenAgain: true }),
        3, // niveau normal, pas 10
      )
    }
    expect(isMastered(mastery)).toBe(true)
  })

  it('la même séquence de 8/10 au niveau 10 avec réécoute systématique n’atteint PAS la maîtrise (chaque réécoute invalide le "sans indice")', () => {
    let mastery = emptyMastery()
    const pattern = [true, true, true, true, true, true, true, true, false, false]
    for (const correct of pattern) {
      mastery = recordResult(
        mastery,
        makeResult({ correct, usedListenAgain: true }),
        10,
      )
    }
    // Toutes les entrées sont invalidées par la réécoute au niveau 10, y
    // compris celles qui étaient `correct`.
    expect(mastery.last10.every((entry) => entry === false)).toBe(true)
    expect(isMastered(mastery)).toBe(false)
  })

  it('au niveau 10, une compétence peut quand même être maîtrisée si la réécoute n’est PAS utilisée sur les réponses correctes', () => {
    let mastery = emptyMastery()
    const pattern = [true, true, true, true, true, true, true, true, false, false]
    for (const correct of pattern) {
      mastery = recordResult(
        mastery,
        makeResult({ correct, usedListenAgain: false }),
        10,
      )
    }
    expect(isMastered(mastery)).toBe(true)
  })
})

describe('mastery: constantes exposées', () => {
  it('expose la fenêtre et le seuil attendus par SPEC §7', () => {
    expect(MASTERY_WINDOW).toBe(10)
    expect(MASTERY_THRESHOLD).toBe(8)
  })
})
