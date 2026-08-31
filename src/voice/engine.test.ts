// Preuve automatisée du gate manuel G5 (« l'audio ne démarre jamais avant un
// geste utilisateur explicite ») en plus de la documentation dans le rapport :
// avant primeVoice(), aucun appel à speak() ne doit jamais atteindre
// synth.speak(), quel que soit le nombre de tentatives.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createNoopVoiceEngine, createVoiceEngine } from './engine'
import { createFakeSpeechSynthesis } from './testUtils/fakeSpeechSynthesis'
import type { NarrationRequest } from '../types'

afterEach(() => {
  vi.useRealTimers()
})

function request(text: string): NarrationRequest {
  return { id: 'r1', text, priority: 'instruction', interruptible: true }
}

describe('createVoiceEngine — amorçage obligatoire (gate A2:G5)', () => {
  it("speak() est un no-op silencieux avant primeVoice() : synth.speak() n'est jamais appelé", async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ voices: [{ name: 'Chantal', lang: 'fr-CA' }] })
    const engine = createVoiceEngine({ synth: fake.synth, createUtterance: fake.createUtterance })

    expect(engine.isPrimed()).toBe(false)
    expect(() => engine.speak(request('Bonjour, prêt à jouer ?'))).not.toThrow()
    await vi.runAllTimersAsync()

    expect(fake.spokenTexts()).toEqual([])
  })

  it('speak() fonctionne normalement après primeVoice()', async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ voices: [{ name: 'Chantal', lang: 'fr-CA' }], voicesDelayMs: 0 })
    const engine = createVoiceEngine({ synth: fake.synth, createUtterance: fake.createUtterance })

    engine.primeVoice() // simule le geste utilisateur (bouton « Jouer »)
    expect(engine.isPrimed()).toBe(true)
    engine.speak(request('Bonjour, prêt à jouer ?'))
    await vi.runAllTimersAsync()

    expect(fake.spokenTexts()).toEqual(['Bonjour, prêt à jouer ?'])
  })

  it('primeVoice() est idempotent : un second appel ne relance pas la sélection de voix', () => {
    const fake = createFakeSpeechSynthesis({ voices: [{ name: 'Chantal', lang: 'fr-CA' }] })
    const getVoicesSpy = vi.spyOn(fake.synth, 'getVoices')
    const engine = createVoiceEngine({ synth: fake.synth, createUtterance: fake.createUtterance })

    engine.primeVoice()
    const callsAfterFirst = getVoicesSpy.mock.calls.length
    engine.primeVoice()
    engine.primeVoice()
    expect(getVoicesSpy.mock.calls.length).toBe(callsAfterFirst)
  })

  it('un texte vide ou blanc ne produit aucun énoncé, même après amorçage', async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ voices: [{ name: 'Chantal', lang: 'fr-CA' }] })
    const engine = createVoiceEngine({ synth: fake.synth, createUtterance: fake.createUtterance })
    engine.primeVoice()

    engine.speak(request('   '))
    await vi.runAllTimersAsync()

    expect(fake.spokenTexts()).toEqual([])
  })
})

describe('createVoiceEngine — état muet et annulation', () => {
  it('expose getMuteState()/subscribeMuteState() et notifie au bon moment', async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ voices: [{ name: 'Chantal', lang: 'fr-CA' }], startDelayMs: 5 })
    fake.failNextStarts(2)
    const engine = createVoiceEngine({ synth: fake.synth, createUtterance: fake.createUtterance })
    engine.primeVoice()

    const seen: boolean[] = []
    engine.subscribeMuteState((muted) => seen.push(muted))

    engine.speak(request('Ce message va échouer deux fois'))
    await vi.runAllTimersAsync()

    expect(engine.getMuteState()).toBe(true)
    expect(seen[seen.length - 1]).toBe(true)
  })

  it('cancelAll() délègue proprement à la file (aucun énoncé résiduel)', async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ voices: [{ name: 'Chantal', lang: 'fr-CA' }], startDelayMs: 5, msPerChar: 5 })
    const engine = createVoiceEngine({ synth: fake.synth, createUtterance: fake.createUtterance })
    engine.primeVoice()

    engine.speak(request('Un message assez long pour ne pas finir tout de suite'))
    await vi.advanceTimersByTimeAsync(5)
    engine.cancelAll()
    await vi.runAllTimersAsync()

    engine.speak(request('Message suivant'))
    await vi.runAllTimersAsync()

    expect(fake.spokenTexts()[fake.spokenTexts().length - 1]).toBe('Message suivant')
  })
})

describe('createNoopVoiceEngine — dégradation propre sans speechSynthesis', () => {
  it('ne lève jamais et reste muet en permanence', () => {
    const engine = createNoopVoiceEngine()
    expect(() => engine.primeVoice()).not.toThrow()
    expect(() => engine.speak(request('Bonjour'))).not.toThrow()
    expect(() => engine.cancelAll()).not.toThrow()
    expect(engine.getMuteState()).toBe(true)
  })
})
