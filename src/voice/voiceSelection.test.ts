import { describe, expect, it, vi, afterEach } from 'vitest'
import { pickFrenchVoice, selectVoice, VOICE_LOAD_GUARD_MS, waitForVoices } from './voiceSelection'
import { createFakeSpeechSynthesis } from './testUtils/fakeSpeechSynthesis'

afterEach(() => {
  vi.useRealTimers()
})

describe('pickFrenchVoice', () => {
  it('préfère une voix fr-CA quand elle existe, même si fr-FR est listée avant', () => {
    const voices = [
      { name: 'Amelie', lang: 'fr-FR' },
      { name: 'Chantal', lang: 'fr-CA' },
      { name: 'Karen', lang: 'en-US' },
    ]
    expect(pickFrenchVoice(voices)?.name).toBe('Chantal')
  })

  it("retombe sur fr-FR si aucune voix fr-CA n'est disponible", () => {
    const voices = [
      { name: 'Karen', lang: 'en-US' },
      { name: 'Amelie', lang: 'fr-FR' },
    ]
    expect(pickFrenchVoice(voices)?.name).toBe('Amelie')
  })

  it('retombe sur toute voix fr-* si ni fr-CA ni fr-FR ne sont disponibles', () => {
    const voices = [
      { name: 'Karen', lang: 'en-US' },
      { name: 'Belge', lang: 'fr-BE' },
    ]
    expect(pickFrenchVoice(voices)?.name).toBe('Belge')
  })

  it("renvoie null si aucune voix française n'existe", () => {
    const voices = [{ name: 'Karen', lang: 'en-US' }]
    expect(pickFrenchVoice(voices)).toBeNull()
  })

  it('renvoie null pour une liste vide', () => {
    expect(pickFrenchVoice([])).toBeNull()
  })

  it('normalise la casse et le séparateur (fr_CA, FR-fr)', () => {
    const voices = [
      { name: 'A', lang: 'FR-fr' },
      { name: 'B', lang: 'fr_CA' },
    ]
    expect(pickFrenchVoice(voices)?.name).toBe('B')
  })
})

describe('waitForVoices', () => {
  it('résout immédiatement si getVoices() est déjà non vide (pas de voiceschanged nécessaire)', async () => {
    const fake = createFakeSpeechSynthesis({
      voices: [{ name: 'Chantal', lang: 'fr-CA' }],
      voicesDelayMs: 0,
    })
    // Force la liste à être déjà remplie avant tout appel, en simulant un
    // navigateur qui a chargé ses voix de façon synchrone.
    fake.setVoicesNow([{ name: 'Chantal', lang: 'fr-CA' }])
    const voices = await waitForVoices(fake.synth, 1000)
    expect(voices).toHaveLength(1)
  })

  it('attend voiceschanged de façon asynchrone puis résout avec la liste livrée', async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({
      voices: [{ name: 'Chantal', lang: 'fr-CA' }],
      voicesDelayMs: 50,
    })
    const promise = waitForVoices(fake.synth, 1000)
    await vi.advanceTimersByTimeAsync(50)
    const voices = await promise
    expect(voices.map((v) => v.name)).toEqual(['Chantal'])
  })

  it("résout avec une liste vide après le délai de garde si voiceschanged ne se déclenche jamais", async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ voices: [], voicesDelayMs: null })
    const promise = waitForVoices(fake.synth, VOICE_LOAD_GUARD_MS)
    await vi.advanceTimersByTimeAsync(VOICE_LOAD_GUARD_MS)
    const voices = await promise
    expect(voices).toEqual([])
  })

  it("n'attend pas plus longtemps que le délai de garde même si voiceschanged arrive plus tard", async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({
      voices: [{ name: 'Trop tard', lang: 'fr-FR' }],
      voicesDelayMs: 5000, // bien après le délai de garde de 1000ms
    })
    const promise = waitForVoices(fake.synth, 1000)
    await vi.advanceTimersByTimeAsync(1000)
    const voices = await promise
    expect(voices).toEqual([])
  })
})

describe('selectVoice', () => {
  it("attend les voix puis choisit fr-CA en priorité, de bout en bout", async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({
      voices: [
        { name: 'Amelie', lang: 'fr-FR' },
        { name: 'Chantal', lang: 'fr-CA' },
      ],
      voicesDelayMs: 10,
    })
    const promise = selectVoice(fake.synth, 1000)
    await vi.advanceTimersByTimeAsync(10)
    const voice = await promise
    expect(voice?.name).toBe('Chantal')
  })

  it("renvoie null si aucune voix n'est jamais disponible", async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ voices: [], voicesDelayMs: null })
    const promise = selectVoice(fake.synth, 200)
    await vi.advanceTimersByTimeAsync(200)
    expect(await promise).toBeNull()
  })
})
