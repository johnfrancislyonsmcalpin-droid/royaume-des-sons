import { describe, expect, it } from 'vitest'
import {
  ANTI_GUESS_FAST_THRESHOLD_MS,
  initialAntiGuessState,
  updateAntiGuess,
  type AntiGuessState,
} from './antiguess'

describe('updateAntiGuess — scénario nominal', () => {
  it('deux réponses fausses rapides (<700ms) consécutives déclenchent l\'anti-devinette', () => {
    const step1 = updateAntiGuess(initialAntiGuessState, {
      correct: false,
      responseMs: 400,
    })
    expect(step1.triggered).toBe(false)
    expect(step1.state.consecutiveFastWrong).toBe(1)

    const step2 = updateAntiGuess(step1.state, { correct: false, responseMs: 350 })
    expect(step2.triggered).toBe(true)
  })

  it('une seule réponse fausse rapide ne déclenche pas encore', () => {
    const result = updateAntiGuess(initialAntiGuessState, {
      correct: false,
      responseMs: 200,
    })
    expect(result.triggered).toBe(false)
  })

  it('une réponse fausse lente (>=700ms) ne compte pas comme rapide et ne déclenche rien seule', () => {
    const result = updateAntiGuess(initialAntiGuessState, {
      correct: false,
      responseMs: ANTI_GUESS_FAST_THRESHOLD_MS,
    })
    expect(result.triggered).toBe(false)
    expect(result.state.consecutiveFastWrong).toBe(0)
  })

  it('deux réponses fausses dont une lente ne déclenche pas (la faute lente casse la chaîne)', () => {
    const step1 = updateAntiGuess(initialAntiGuessState, {
      correct: false,
      responseMs: 400,
    })
    const step2 = updateAntiGuess(step1.state, { correct: false, responseMs: 800 })
    expect(step2.triggered).toBe(false)
    expect(step2.state.consecutiveFastWrong).toBe(0)
  })

  it('après un déclenchement, le compteur repart à zéro : il faut de nouveau deux fautes rapides pour redéclencher', () => {
    const step1 = updateAntiGuess(initialAntiGuessState, { correct: false, responseMs: 300 })
    const step2 = updateAntiGuess(step1.state, { correct: false, responseMs: 300 })
    expect(step2.triggered).toBe(true)
    expect(step2.state.consecutiveFastWrong).toBe(0)

    const step3 = updateAntiGuess(step2.state, { correct: false, responseMs: 300 })
    expect(step3.triggered).toBe(false)
    expect(step3.state.consecutiveFastWrong).toBe(1)
  })

  it('trois réponses fausses rapides consécutives déclenchent une seule fois sur les deux premières', () => {
    let state: AntiGuessState = initialAntiGuessState
    const triggers: boolean[] = []

    for (let i = 0; i < 3; i++) {
      const result = updateAntiGuess(state, { correct: false, responseMs: 250 })
      triggers.push(result.triggered)
      state = result.state
    }

    expect(triggers).toEqual([false, true, false])
  })
})

describe('updateAntiGuess — bonne réponse rapide jamais pénalisée', () => {
  it('une réponse correcte rapide (<700ms) ne déclenche jamais l\'anti-devinette', () => {
    const result = updateAntiGuess(initialAntiGuessState, {
      correct: true,
      responseMs: 100,
    })
    expect(result.triggered).toBe(false)
  })

  it('une réponse correcte très rapide (quasi 0ms) n\'est jamais pénalisée : compteur reste à 0', () => {
    const result = updateAntiGuess(initialAntiGuessState, { correct: true, responseMs: 1 })
    expect(result.triggered).toBe(false)
    expect(result.state.consecutiveFastWrong).toBe(0)
  })

  it('une réponse correcte rapide après une faute rapide ne déclenche rien et n\'accumule pas de pénalité', () => {
    const step1 = updateAntiGuess(initialAntiGuessState, {
      correct: false,
      responseMs: 300,
    })
    const step2 = updateAntiGuess(step1.state, { correct: true, responseMs: 150 })

    expect(step2.triggered).toBe(false)
    expect(step2.state.consecutiveFastWrong).toBe(0)
  })

  it('des réponses correctes rapides répétées ne déclenchent jamais, quelle que soit la longueur de la séquence', () => {
    let state: AntiGuessState = initialAntiGuessState

    for (let i = 0; i < 50; i++) {
      const result = updateAntiGuess(state, { correct: true, responseMs: 50 })
      expect(result.triggered).toBe(false)
      expect(result.state.consecutiveFastWrong).toBe(0)
      state = result.state
    }
  })
})

describe('reinitialisation', () => {
  it('une réponse fausse rapide suivie d\'une réponse correcte rapide réinitialise le compteur sans déclencher', () => {
    const step1 = updateAntiGuess(initialAntiGuessState, {
      correct: false,
      responseMs: 200,
    })
    expect(step1.state.consecutiveFastWrong).toBe(1)

    const step2 = updateAntiGuess(step1.state, { correct: true, responseMs: 200 })
    expect(step2.triggered).toBe(false)
    expect(step2.state.consecutiveFastWrong).toBe(0)
  })

  it('une réponse fausse rapide suivie d\'une réponse correcte lente réinitialise également le compteur sans déclencher', () => {
    const step1 = updateAntiGuess(initialAntiGuessState, {
      correct: false,
      responseMs: 200,
    })
    const step2 = updateAntiGuess(step1.state, { correct: true, responseMs: 3000 })

    expect(step2.triggered).toBe(false)
    expect(step2.state.consecutiveFastWrong).toBe(0)
  })

  it('après réinitialisation par une bonne réponse, il faut de nouveau deux fautes rapides pour déclencher', () => {
    const afterFastWrong = updateAntiGuess(initialAntiGuessState, {
      correct: false,
      responseMs: 200,
    })
    const afterReset = updateAntiGuess(afterFastWrong.state, {
      correct: true,
      responseMs: 100,
    })
    expect(afterReset.state.consecutiveFastWrong).toBe(0)

    const oneFastWrong = updateAntiGuess(afterReset.state, {
      correct: false,
      responseMs: 300,
    })
    expect(oneFastWrong.triggered).toBe(false)

    const twoFastWrong = updateAntiGuess(oneFastWrong.state, {
      correct: false,
      responseMs: 300,
    })
    expect(twoFastWrong.triggered).toBe(true)
  })
})
