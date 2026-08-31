// "Son doux" de rétroaction quand une pièce mal placée retourne à sa
// réserve (SPEC §6.2 : "Pièce mal placée : elle retourne à sa réserve avec
// un son doux, sans pénalité").
//
// Décision consignée pour ASSUMPTIONS.md : `ChallengeComponentProps` (FIGÉ)
// ne fournit que `speak(text: string)` pour l'audio, et CLAUDE.md règle #2
// interdit tout mot/phrase en dur dans le code — impossible de fabriquer
// ici une phrase ad hoc à énoncer, et de toute façon un "son doux" n'est pas
// une phrase du compagnon. On produit donc une tonalité brève via l'API Web
// Audio (générée, aucun fichier ni requête réseau — CLAUDE.md règle #5),
// plutôt que de contourner l'interdiction avec un texte inventé passé à
// `speak()`. No-op silencieux si l'API est indisponible (navigateur non
// supporté, environnement de test jsdom) : ce n'est qu'une rétroaction
// accessoire, jamais bloquante pour le jeu.
type AudioContextCtor = typeof AudioContext

function resolveAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const withWebkit = window as unknown as { webkitAudioContext?: AudioContextCtor }
  return window.AudioContext ?? withWebkit.webkitAudioContext ?? null
}

/** Joue une courte glissade descendante douce (sol4 -> mi4, ~180ms) —
 * jamais un son alarmant ou punitif (SPEC §2 : l'échec est doux, sans
 * perte). */
export function playSoftReturnSound(): void {
  const Ctor = resolveAudioContextCtor()
  if (!Ctor) return

  try {
    const ctx = new Ctor()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(392, ctx.currentTime) // sol4
    oscillator.frequency.exponentialRampToValueAtTime(330, ctx.currentTime + 0.15) // mi4

    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)

    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.2)
    oscillator.onended = () => {
      void ctx.close().catch(() => {})
    }
  } catch {
    // Best effort : jamais bloquant pour le jeu (SPEC §2 : jamais de perte).
  }
}
