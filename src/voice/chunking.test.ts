import { describe, expect, it, vi } from 'vitest'
import { MAX_CHUNK_CHARS, splitIntoChunks } from './chunking'
import { createFakeSpeechSynthesis } from './testUtils/fakeSpeechSynthesis'
import { createVoiceQueue } from './queue'
import { createMuteStore } from './muteState'

describe('splitIntoChunks', () => {
  it('renvoie un seul morceau pour un texte court', () => {
    expect(splitIntoChunks('Touche le a.')).toEqual(['Touche le a.'])
  })

  it('renvoie un tableau vide pour un texte vide ou blanc', () => {
    expect(splitIntoChunks('')).toEqual([])
    expect(splitIntoChunks('   ')).toEqual([])
  })

  it('ne découpe jamais un morceau au-delà de la limite', () => {
    const long = Array.from({ length: 40 }, (_, i) => `mot${i}`).join(' ')
    const chunks = splitIntoChunks(long, 30)
    expect(chunks.length).toBeGreaterThan(1)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(30)
    }
  })

  it('recolle les morceaux dans le bon ordre sans perdre de mots', () => {
    const long = Array.from({ length: 40 }, (_, i) => `mot${i}`).join(' ')
    const chunks = splitIntoChunks(long, 30)
    expect(chunks.join(' ')).toBe(long)
  })

  it('découpe de préférence sur les frontières de phrase', () => {
    const text = 'Le chat dort. Le chien joue dehors.'
    const chunks = splitIntoChunks(text, 20)
    expect(chunks).toEqual(['Le chat dort.', 'Le chien joue', 'dehors.'])
  })

  it('découpe mot par mot une phrase seule plus longue que la limite, sans couper un mot', () => {
    const text = 'anticonstitutionnellement est un mot très long en français'
    const chunks = splitIntoChunks(text, 15)
    for (const chunk of chunks) {
      // Chaque morceau est composé de mots entiers issus du texte d'origine.
      for (const word of chunk.split(' ')) {
        expect(text.split(' ')).toContain(word)
      }
    }
    expect(chunks.join(' ')).toBe(text)
  })

  it("garde un mot isolé plus long que la limite comme son propre morceau plutôt que de le tronquer", () => {
    const word = 'a'.repeat(150)
    const chunks = splitIntoChunks(word, 100)
    expect(chunks).toEqual([word])
  })

  it('normalise les espaces multiples et le texte au bord (trim)', () => {
    expect(splitIntoChunks('  Bonjour   le monde  ')).toEqual(['Bonjour le monde'])
  })

  it("respecte le seuil par défaut MAX_CHUNK_CHARS quand aucune limite n'est fournie", () => {
    const long = 'mot '.repeat(60).trim()
    const chunks = splitIntoChunks(long)
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS)
    }
  })
})

describe('découpage bout en bout : aucune utterance envoyée au moteur ne dépasse le seuil de troncature', () => {
  it("un texte long qui déclencherait la troncature simulée est découpé avant d'atteindre le moteur", async () => {
    vi.useFakeTimers()
    try {
      const fake = createFakeSpeechSynthesis({
        voices: [{ name: 'Amélie', lang: 'fr-CA' }],
        voicesDelayMs: 0,
        truncateAtChars: 120, // le fake simulerait une troncature au-delà de 120 caractères
        startDelayMs: 1,
        msPerChar: 1,
      })
      const muteStore = createMuteStore()
      const queue = createVoiceQueue({
        synth: fake.synth,
        createUtterance: fake.createUtterance,
        getVoice: () => fake.synth.getVoices()[0] ?? null,
        getRate: () => 0.85,
        getLang: () => 'fr-CA',
        muteStore,
        voiceReady: () => Promise.resolve(),
        maxChunkChars: 100, // sous le seuil de troncature simulé (120) : la protection s'applique
      })

      const longText =
        'Le compagnon magique explique très longuement comment lancer un sort de lecture ' +
        'sur les mots endormis du royaume, avec beaucoup de détails et de patience pour ' +
        "que l'enfant comprenne bien chaque étape du sortilège avant de recommencer."

      queue.enqueue(longText)
      await vi.runAllTimersAsync()

      const spokenTexts = fake.spokenTexts()
      expect(spokenTexts.length).toBeGreaterThan(1)
      for (const text of spokenTexts) {
        expect(text.length).toBeLessThanOrEqual(100)
      }
      // Preuve que la protection était nécessaire : sans découpage, le texte
      // entier aurait dépassé le seuil de troncature simulé.
      expect(longText.length).toBeGreaterThan(120)
      // Et la mute store ne doit jamais avoir été déclenchée : aucune
      // utterance envoyée n'a subi la troncature simulée puisqu'aucune ne
      // dépassait 120 caractères.
      expect(muteStore.get()).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
