import { describe, expect, it } from 'vitest'
import { crossedPauseThreshold, PAUSE_PROMPT_INTERVAL_MINUTES, shouldProposePause } from './sessionPause'

describe('shouldProposePause — G2', () => {
  it('est vrai à 20 minutes cumulées (SPEC §2.6)', () => {
    expect(shouldProposePause(20)).toBe(true)
  })

  it('est vrai de nouveau à 40 minutes cumulées (SPEC §2.6)', () => {
    expect(shouldProposePause(40)).toBe(true)
  })

  it('est faux avant 20 minutes', () => {
    for (const minutes of [0, 1, 5, 10, 19]) {
      expect(shouldProposePause(minutes)).toBe(false)
    }
  })

  it('est faux entre 20 et 40 minutes (21..39)', () => {
    for (const minutes of [21, 25, 30, 35, 39]) {
      expect(shouldProposePause(minutes)).toBe(false)
    }
  })

  it('reste vrai au-delà de 40 (60, 80...) : le motif continue pour une session longue', () => {
    expect(shouldProposePause(60)).toBe(true)
    expect(shouldProposePause(80)).toBe(true)
  })

  it('ne lève jamais d\'exception ni ne bloque : entrées négatives ou non finies renvoient simplement faux', () => {
    expect(() => shouldProposePause(-5)).not.toThrow()
    expect(shouldProposePause(-5)).toBe(false)
    expect(() => shouldProposePause(Number.NaN)).not.toThrow()
    expect(shouldProposePause(Number.NaN)).toBe(false)
  })

  it("ne renvoie jamais qu'un booléen (jamais un objet de blocage / une promesse) : jamais de blocage autoritaire", () => {
    const result = shouldProposePause(20)
    expect(typeof result).toBe('boolean')
  })

  it('PAUSE_PROMPT_INTERVAL_MINUTES vaut 20 (SPEC §2.6)', () => {
    expect(PAUSE_PROMPT_INTERVAL_MINUTES).toBe(20)
  })
})

describe('crossedPauseThreshold — polling à grain fin', () => {
  it('détecte le franchissement de 20 minutes même sans tomber pile sur 20', () => {
    expect(crossedPauseThreshold(19.5, 20.2)).toBe(true)
  })

  it('détecte le franchissement de 40 minutes', () => {
    expect(crossedPauseThreshold(39, 41)).toBe(true)
  })

  it("ne détecte rien tant qu'aucun seuil n'est franchi", () => {
    expect(crossedPauseThreshold(21, 25)).toBe(false)
  })

  it('renvoie faux si le temps ne progresse pas (courant <= précédent)', () => {
    expect(crossedPauseThreshold(20, 20)).toBe(false)
    expect(crossedPauseThreshold(25, 20)).toBe(false)
  })
})
