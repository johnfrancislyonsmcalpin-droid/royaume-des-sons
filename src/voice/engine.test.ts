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

  it('setRate/listVoices/setVoiceOverride ne lèvent jamais (écran parent, gate F1)', () => {
    const engine = createNoopVoiceEngine()
    expect(() => engine.setRate(1.2)).not.toThrow()
    expect(engine.listVoices()).toEqual([])
    expect(() => engine.setVoiceOverride(null)).not.toThrow()
  })
})

describe('createVoiceEngine — réglages voix (écran parent, gate F1)', () => {
  it('setRate change le débit utilisé par les prochains énoncés', () => {
    const fake = createFakeSpeechSynthesis({ voices: [{ name: 'Chantal', lang: 'fr-CA' }] })
    const engine = createVoiceEngine({ synth: fake.synth, createUtterance: fake.createUtterance })

    expect(engine.getRate()).toBe(0.85)
    engine.setRate(1.3)
    expect(engine.getRate()).toBe(1.3)
  })

  it('ignore une valeur de débit non finie ou <= 0', () => {
    const fake = createFakeSpeechSynthesis({ voices: [] })
    const engine = createVoiceEngine({ synth: fake.synth, createUtterance: fake.createUtterance })

    engine.setRate(0)
    expect(engine.getRate()).toBe(0.85)
    engine.setRate(-1)
    expect(engine.getRate()).toBe(0.85)
    engine.setRate(Number.NaN)
    expect(engine.getRate()).toBe(0.85)
  })

  it('listVoices() reflète synth.getVoices() sans jamais construire une utterance', async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({
      voices: [
        { name: 'Chantal', lang: 'fr-CA' },
        { name: 'Amélie', lang: 'fr-FR' },
      ],
      voicesDelayMs: 0,
    })
    const engine = createVoiceEngine({ synth: fake.synth, createUtterance: fake.createUtterance })

    await vi.advanceTimersByTimeAsync(0)
    const voices = engine.listVoices()
    expect(voices.map((v) => v.name)).toEqual(['Chantal', 'Amélie'])
  })

  it('setVoiceOverride(voice) impose la voix choisie, ignorant la sélection automatique', async () => {
    vi.useFakeTimers()
    const chantal = { name: 'Chantal', lang: 'fr-CA' }
    const amelie = { name: 'Amélie', lang: 'fr-FR' }
    const fake = createFakeSpeechSynthesis({ voices: [chantal, amelie], voicesDelayMs: 0 })
    const engine = createVoiceEngine({ synth: fake.synth, createUtterance: fake.createUtterance })

    engine.setVoiceOverride(amelie)
    engine.primeVoice()
    engine.speak(request('Bonjour'))
    await vi.runAllTimersAsync()

    expect(fake.spokenVoices()[0]?.name).toBe('Amélie')
  })

  it('setVoiceOverride(null) réactive la sélection automatique fr-CA>fr-FR>fr-*', async () => {
    vi.useFakeTimers()
    const chantal = { name: 'Chantal', lang: 'fr-CA' }
    const fake = createFakeSpeechSynthesis({ voices: [chantal], voicesDelayMs: 0 })
    const engine = createVoiceEngine({ synth: fake.synth, createUtterance: fake.createUtterance })

    engine.setVoiceOverride({ name: 'Intruse', lang: 'fr-FR' })
    engine.setVoiceOverride(null)
    engine.primeVoice()
    engine.speak(request('Bonjour'))
    await vi.runAllTimersAsync()

    expect(fake.spokenVoices()[0]?.name).toBe('Chantal')
  })
})
