import { afterEach, describe, expect, it, vi } from 'vitest'
import { END_WATCHDOG_MIN_MS, speakOnce, START_WATCHDOG_MS } from './watchdog'
import { createFakeSpeechSynthesis } from './testUtils/fakeSpeechSynthesis'
import type { SpeechSynthesisLike, SpeechSynthesisUtteranceLike } from './types'

afterEach(() => {
  vi.useRealTimers()
})

const spec = { text: 'Bonjour', voice: null, rate: 0.85, lang: 'fr-CA' }

describe('speakOnce — chemin normal', () => {
  it("résout 'ok' quand onstart se déclenche à temps puis onend", async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ startDelayMs: 5, msPerChar: 1 })
    const promise = speakOnce(spec, { synth: fake.synth, createUtterance: fake.createUtterance })
    await vi.runAllTimersAsync()
    expect(await promise).toBe('ok')
  })

  it("résout 'ok' même si une erreur survient après le démarrage (ex. troncature)", async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ startDelayMs: 5, msPerChar: 1, truncateAtChars: 3 })
    const promise = speakOnce(spec, { synth: fake.synth, createUtterance: fake.createUtterance })
    await vi.runAllTimersAsync()
    expect(await promise).toBe('ok')
  })
})

describe('speakOnce — watchdog de démarrage (gate A2:G2)', () => {
  it(`résout 'no-start' si onstart ne se déclenche pas dans les ${START_WATCHDOG_MS}ms`, async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ startDelayMs: 5 })
    fake.failNextStarts(1) // simule un gel : onstart ne se déclenchera jamais
    const promise = speakOnce(spec, { synth: fake.synth, createUtterance: fake.createUtterance })
    await vi.advanceTimersByTimeAsync(START_WATCHDOG_MS)
    expect(await promise).toBe('no-start')
  })

  it("résout 'ok' si onstart se déclenche juste avant l'expiration du délai de garde", async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ startDelayMs: START_WATCHDOG_MS - 50, msPerChar: 1 })
    const promise = speakOnce(spec, { synth: fake.synth, createUtterance: fake.createUtterance })
    await vi.runAllTimersAsync()
    expect(await promise).toBe('ok')
  })

  it("résout 'no-start' si une erreur survient avant tout démarrage", async () => {
    const utteranceRef: { current: SpeechSynthesisUtteranceLike | null } = { current: null }
    const synth: SpeechSynthesisLike = {
      getVoices: () => [],
      speak(utterance) {
        utteranceRef.current = utterance
        // Erreur synchrone, avant tout onstart.
        utterance.onerror?.({ error: 'network' })
      },
      cancel() {},
      addEventListener() {},
      removeEventListener() {},
    }
    const createUtterance = (text: string): SpeechSynthesisUtteranceLike => ({
      text,
      lang: '',
      rate: 1,
      voice: null,
      onstart: null,
      onend: null,
      onerror: null,
    })
    const outcome = await speakOnce(spec, { synth, createUtterance })
    expect(outcome).toBe('no-start')
  })
})

describe('speakOnce — dégradation propre, jamais d\'exception', () => {
  it('résout no-start sans lever si createUtterance() échoue', async () => {
    const synth: SpeechSynthesisLike = {
      getVoices: () => [],
      speak() {},
      cancel() {},
      addEventListener() {},
      removeEventListener() {},
    }
    const createUtterance = (): SpeechSynthesisUtteranceLike => {
      throw new Error('SpeechSynthesisUtterance indisponible')
    }
    await expect(speakOnce(spec, { synth, createUtterance })).resolves.toBe('no-start')
  })

  it('résout no-start sans lever si synth.speak() lève une exception', async () => {
    const synth: SpeechSynthesisLike = {
      getVoices: () => [],
      speak() {
        throw new Error('moteur indisponible')
      },
      cancel() {},
      addEventListener() {},
      removeEventListener() {},
    }
    const createUtterance = (text: string): SpeechSynthesisUtteranceLike => ({
      text,
      lang: '',
      rate: 1,
      voice: null,
      onstart: null,
      onend: null,
      onerror: null,
    })
    await expect(speakOnce(spec, { synth, createUtterance })).resolves.toBe('no-start')
  })
})

describe('speakOnce — filet de sécurité de fin (décision au-delà de la spec, voir ASSUMPTIONS.md)', () => {
  it("résout tout de même 'ok' après un délai borné si onend ne se déclenche jamais post-démarrage", async () => {
    vi.useFakeTimers()
    // Enveloppe dans un objet plutôt qu'une variable `let` nue : TypeScript
    // rétrécit une `let` réassignée uniquement à l'intérieur d'une closure
    // imbriquée à `never` en lecture ultérieure (limitation connue de son
    // analyse de flux de contrôle) ; l'accès à une propriété d'objet évite
    // ce piège.
    const startCbRef: { current: (() => void) | null } = { current: null }
    const synth: SpeechSynthesisLike = {
      getVoices: () => [],
      speak(utterance) {
        startCbRef.current = utterance.onstart
        // onend / onerror volontairement jamais appelés : bug simulé.
      },
      cancel() {},
      addEventListener() {},
      removeEventListener() {},
    }
    const createUtterance = (text: string): SpeechSynthesisUtteranceLike => ({
      text,
      lang: '',
      rate: 1,
      voice: null,
      onstart: null,
      onend: null,
      onerror: null,
    })
    const promise = speakOnce(spec, { synth, createUtterance })
    // Laisse le moteur déclencher onstart "manuellement", comme un vrai moteur le ferait.
    await vi.advanceTimersByTimeAsync(1)
    startCbRef.current?.()
    await vi.advanceTimersByTimeAsync(END_WATCHDOG_MIN_MS)
    expect(await promise).toBe('ok')
  })
})
