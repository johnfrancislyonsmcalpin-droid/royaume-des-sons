import { describe, expect, it } from 'vitest'
import * as voice from './index'

describe('index.ts — import du singleton sous jsdom (pas de vraie speechSynthesis)', () => {
  it("s'importe sans lever, et dégrade proprement vers l'état muet", () => {
    expect(() => voice.primeVoice()).not.toThrow()
    expect(() => voice.speak({ id: 'x', text: 'test', priority: 'instruction', interruptible: true })).not.toThrow()
    expect(() => voice.cancelAll()).not.toThrow()
    expect(typeof voice.getMuteState()).toBe('boolean')
  })
})
