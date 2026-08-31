import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVoiceQueue } from './queue'
import { createMuteStore } from './muteState'
import { createFakeSpeechSynthesis } from './testUtils/fakeSpeechSynthesis'

afterEach(() => {
  vi.useRealTimers()
})

function makeQueue(fake: ReturnType<typeof createFakeSpeechSynthesis>, maxChunkChars = 100) {
  const muteStore = createMuteStore()
  const queue = createVoiceQueue({
    synth: fake.synth,
    createUtterance: fake.createUtterance,
    getVoice: () => null,
    getRate: () => 0.85,
    getLang: () => 'fr-CA',
    muteStore,
    voiceReady: () => Promise.resolve(),
    maxChunkChars,
  })
  return { queue, muteStore }
}

describe('createVoiceQueue — sérialisation (gate A2:G4)', () => {
  it('ne parle jamais deux énoncés en même temps : le second attend la fin du premier', async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ startDelayMs: 5, msPerChar: 5 })
    const { queue } = makeQueue(fake)

    queue.enqueue('Premier message court')
    queue.enqueue('Deuxième message court')

    // Juste après les deux enqueue, un seul énoncé doit avoir été transmis au moteur.
    await vi.advanceTimersByTimeAsync(5) // laisse le premier onstart se déclencher
    expect(fake.spokenTexts()).toEqual(['Premier message court'])
    expect(fake.activeCount()).toBe(1)

    await vi.runAllTimersAsync()
    expect(fake.spokenTexts()).toEqual(['Premier message court', 'Deuxième message court'])
  })

  it('traite les morceaux dans l\'ordre pour un texte découpé en plusieurs chunks', async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ startDelayMs: 1, msPerChar: 1 })
    const { queue } = makeQueue(fake, 10)

    queue.enqueue('un deux trois quatre cinq six sept')
    await vi.runAllTimersAsync()

    const spoken = fake.spokenTexts()
    expect(spoken.length).toBeGreaterThan(1)
    expect(spoken.join(' ')).toBe('un deux trois quatre cinq six sept')
  })
})

describe("createVoiceQueue — annulation propre au changement d'écran (gate A2:G4)", () => {
  it("cancelAll() vide la file : les morceaux en attente ne sont jamais envoyés au moteur", async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ startDelayMs: 5, msPerChar: 20 })
    const { queue } = makeQueue(fake, 10)

    queue.enqueue('un deux trois quatre cinq six sept')
    await vi.advanceTimersByTimeAsync(5) // le premier morceau démarre
    const spokenBeforeCancel = fake.spokenTexts()
    expect(spokenBeforeCancel).toEqual(['un deux'])

    queue.cancelAll()

    // Même en laissant largement le temps aux morceaux restants de se jouer
    // s'ils n'avaient pas été annulés, aucun autre ne doit apparaître : le
    // morceau déjà en cours au moment de l'annulation reste (on ne peut pas
    // retirer un son déjà émis, comme le vrai speechSynthesis.cancel()), mais
    // aucun morceau suivant ('trois', 'quatre', 'cinq six', 'sept') n'est
    // jamais envoyé au moteur.
    await vi.runAllTimersAsync()
    expect(fake.spokenTexts()).toEqual(spokenBeforeCancel)
  })

  it("appelle synth.cancel() pour interrompre l'audio en cours immédiatement", () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis()
    const cancelSpy = vi.spyOn(fake.synth, 'cancel')
    const { queue } = makeQueue(fake)

    queue.enqueue('Bonjour')
    queue.cancelAll()

    expect(cancelSpy).toHaveBeenCalledTimes(1)
  })

  it('après cancelAll(), un nouvel enqueue() est traité normalement (nouvelle génération), sans résidu de l\'ancien texte', async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ startDelayMs: 5, msPerChar: 5 })
    const { queue } = makeQueue(fake) // un seul chunk pour ce texte court : annulé avant tout envoi

    queue.enqueue('ancien texte à ne jamais entendre')
    queue.cancelAll() // même tour synchrone : rien n'est encore parti vers le moteur

    queue.enqueue('nouveau texte')
    await vi.runAllTimersAsync()

    const spoken = fake.spokenTexts()
    expect(spoken).toEqual(['nouveau texte'])
  })

  it("cancelAll() appelé juste après enqueue(), dans le même tour synchrone, empêche tout envoi au moteur", async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ startDelayMs: 5 })
    const { queue } = makeQueue(fake)

    queue.enqueue('Ce texte ne doit jamais être parlé')
    queue.cancelAll() // même tick JS, avant que runLoop() n'ait eu la main

    await vi.runAllTimersAsync()
    expect(fake.spokenTexts()).toEqual([])
  })
})

describe('createVoiceQueue — réessai puis état muet (gate A2:G2 exercé via la file)', () => {
  it("réessaie une fois un morceau dont onstart ne s'est pas déclenché, puis expose l'état muet au second échec, sans lever et sans bloquer les appels suivants", async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ startDelayMs: 5, msPerChar: 5 })
    fake.failNextStarts(2) // les deux tentatives du même morceau échouent
    const { queue, muteStore } = makeQueue(fake)

    queue.enqueue('Morceau condamné')
    await vi.runAllTimersAsync()

    expect(muteStore.get()).toBe(true)

    // La file continue de servir les appels suivants sans exception ni blocage.
    fake.failNextStarts(0)
    queue.enqueue('Morceau qui réussit')
    await vi.runAllTimersAsync()

    expect(fake.spokenTexts()).toContain('Morceau qui réussit')
    expect(muteStore.get()).toBe(false) // l'état muet se lève dès qu'un énoncé réussit
  })

  it('un seul échec de démarrage (récupéré au réessai) ne déclenche pas l\'état muet', async () => {
    vi.useFakeTimers()
    const fake = createFakeSpeechSynthesis({ startDelayMs: 5, msPerChar: 5 })
    fake.failNextStarts(1) // seule la première tentative échoue, le réessai réussit
    const { queue, muteStore } = makeQueue(fake)

    queue.enqueue('Bonjour')
    await vi.runAllTimersAsync()

    expect(muteStore.get()).toBe(false)
    expect(fake.spokenTexts()).toEqual(['Bonjour', 'Bonjour']) // tentative + réessai
  })
})
