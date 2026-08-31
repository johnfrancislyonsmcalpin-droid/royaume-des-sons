// Sélection de voix (SPEC §3 / gate A2:G1) : fr-CA en priorité, sinon fr-FR,
// sinon toute voix fr-*. La liste des voix se charge de façon asynchrone côté
// navigateur (événement `voiceschanged`) ; on l'attend, avec un délai de garde
// au cas où l'événement ne vient jamais (observé sur certains navigateurs qui
// exposent déjà `getVoices()` synchrone sans jamais émettre l'événement, ou
// l'inverse).
import type { SpeechSynthesisLike, SpeechSynthesisVoiceLike } from './types'

// Choix (voir ASSUMPTIONS.md) : 1000 ms. Le chargement des voix est
// normalement quasi instantané une fois le moteur natif prêt ; 1 s laisse une
// marge confortable pour un appareil lent sans faire attendre l'enfant de
// façon perceptible sur le premier écran (le bouton « Jouer » amorce déjà la
// sélection avant que la première narration n'en ait besoin, voir engine.ts).
export const VOICE_LOAD_GUARD_MS = 1000

const PREFERRED_LANGS = ['fr-ca', 'fr-fr']
const FRENCH_PREFIX = 'fr'

function normalizeLang(lang: string): string {
  return lang.trim().toLowerCase().replace(/_/g, '-')
}

/**
 * Résout la liste des voix disponibles, en attendant `voiceschanged` de façon
 * asynchrone si `getVoices()` est vide au premier appel. Se résout avec la
 * liste courante (éventuellement vide) si le délai de garde expire avant que
 * l'événement n'arrive.
 */
export function waitForVoices(
  synth: SpeechSynthesisLike,
  guardMs: number = VOICE_LOAD_GUARD_MS,
): Promise<SpeechSynthesisVoiceLike[]> {
  const initial = synth.getVoices()
  if (initial.length > 0) return Promise.resolve(initial)

  return new Promise((resolve) => {
    let settled = false
    let guardTimer: ReturnType<typeof setTimeout>

    const onVoicesChanged = () => {
      if (settled) return
      settled = true
      clearTimeout(guardTimer)
      synth.removeEventListener('voiceschanged', onVoicesChanged)
      resolve(synth.getVoices())
    }

    guardTimer = setTimeout(() => {
      if (settled) return
      settled = true
      synth.removeEventListener('voiceschanged', onVoicesChanged)
      resolve(synth.getVoices())
    }, guardMs)

    synth.addEventListener('voiceschanged', onVoicesChanged)
  })
}

/**
 * Choisit la meilleure voix française disponible : fr-CA d'abord, puis fr-FR,
 * puis toute voix dont la langue commence par "fr". `null` si aucune voix
 * française n'est disponible (déclenche l'écran de vérification voix, F2).
 */
export function pickFrenchVoice(voices: SpeechSynthesisVoiceLike[]): SpeechSynthesisVoiceLike | null {
  const normalized = voices.map((voice) => ({ voice, lang: normalizeLang(voice.lang) }))

  for (const preferred of PREFERRED_LANGS) {
    const match = normalized.find((entry) => entry.lang === preferred)
    if (match) return match.voice
  }

  const anyFrench = normalized.find((entry) => entry.lang.startsWith(FRENCH_PREFIX))
  return anyFrench ? anyFrench.voice : null
}

/** Combine l'attente asynchrone des voix et le choix de la meilleure voix française. */
export async function selectVoice(
  synth: SpeechSynthesisLike,
  guardMs: number = VOICE_LOAD_GUARD_MS,
): Promise<SpeechSynthesisVoiceLike | null> {
  const voices = await waitForVoices(synth, guardMs)
  return pickFrenchVoice(voices)
}
