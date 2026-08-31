// Interfaces minimales et structurelles pour l'API Web Speech, utilisées comme
// frontière de test. `window.speechSynthesis` et `new SpeechSynthesisUtterance()`
// satisfont ces interfaces par structure (ils ont plus de membres, ce qui est
// toujours assignable) ; le double de test (`testUtils/fakeSpeechSynthesis.ts`)
// les implémente aussi, sans dépendre de jsdom qui n'a pas de vraie synthèse
// vocale. Aucun autre fichier du dépôt ne doit importer les types DOM
// `SpeechSynthesis*` directement : tout passe par ces interfaces.

export interface SpeechSynthesisVoiceLike {
  name: string
  lang: string
  default?: boolean
}

export interface SpeechSynthesisErrorLike {
  error: string
}

export interface SpeechSynthesisUtteranceLike {
  text: string
  lang: string
  rate: number
  voice: SpeechSynthesisVoiceLike | null
  onstart: (() => void) | null
  onend: (() => void) | null
  onerror: ((event: SpeechSynthesisErrorLike) => void) | null
}

export interface SpeechSynthesisLike {
  getVoices: () => SpeechSynthesisVoiceLike[]
  speak: (utterance: SpeechSynthesisUtteranceLike) => void
  cancel: () => void
  addEventListener: (type: 'voiceschanged', listener: () => void) => void
  removeEventListener: (type: 'voiceschanged', listener: () => void) => void
}
