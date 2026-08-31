// Rétroaction commune de réussite/échec (SPEC §2, §6 ; gate C1:G5). Combine
// TOUJOURS forme (icône distincte selon l'issue) + son (déclenché via
// `speak(companionPhrase)`) + animation CSS + phrase du compagnon (fournie en
// prop, jamais en dur ici — CLAUDE.md règle #2). Aucun état ne s'appuie sur la
// seule couleur : les deux icônes ont des silhouettes différentes, pas
// seulement des teintes différentes, et l'animation diffère aussi (rebond vs
// dissolution douce), pour un enfant qui pourrait être daltonien.
import { type CSSProperties, useEffect, useMemo } from 'react'
import type { ChallengeSpeakFn } from './contract'

export type ChallengeFeedbackOutcome = 'success' | 'error'

export interface ChallengeFeedbackProps {
  outcome: ChallengeFeedbackOutcome
  /** Phrase du compagnon à afficher ET énoncer — texte fourni par l'appelant
   * (résolu depuis src/content/*.json), jamais en dur dans ce composant. */
  companionPhrase: string
  /** Optionnel : si fourni, la phrase est énoncée automatiquement à
   * l'apparition (et à chaque changement de phrase/issue). Si absent, le
   * composant reste purement visuel — l'appelant se charge de la narration
   * par un autre canal (ex. `useScreenNarration`). */
  speak?: ChallengeSpeakFn
  /** Force le mode "mouvement réduit" en test ; en jeu, détecté via
   * `matchMedia('(prefers-reduced-motion: reduce)')` (SPEC §3). */
  reducedMotion?: boolean
  testId?: string
}

function detectReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

const iconWrapperStyle: CSSProperties = {
  width: 96,
  height: 96,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

/** Étoile à 5 branches — silhouette de réussite, distincte d'un cercle. */
function SuccessGlyph() {
  return (
    <svg viewBox="0 0 100 100" width={72} height={72} role="img" aria-hidden="true" data-testid="feedback-icon-success">
      <path
        d="M50 4 L61 37 L96 37 L67 58 L78 91 L50 70 L22 91 L33 58 L4 37 L39 37 Z"
        fill="#F4B400"
        stroke="#B9860A"
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Nuage arrondi et souriant — silhouette d'échec doux : jamais de croix, de
 * visage triste ou d'objet cassé (SPEC §2 : l'échec est doux, sans perte). */
function TryAgainGlyph() {
  return (
    <svg viewBox="0 0 100 100" width={72} height={72} role="img" aria-hidden="true" data-testid="feedback-icon-error">
      <path
        d="M28 70 a18 18 0 0 1 -4 -35.6 a22 22 0 0 1 43 -8 a17 17 0 0 1 15.5 26.6 a15 15 0 0 1 -6.5 17 Z"
        fill="#9AA6B2"
        stroke="#5E6B77"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path d="M38 58 q12 10 24 0" stroke="#5E6B77" strokeWidth={4} fill="none" strokeLinecap="round" />
    </svg>
  )
}

const successAnimation = 'challenge-feedback-bounce'
const errorAnimation = 'challenge-feedback-settle'

// Styles d'animation injectés une seule fois (feuille de style inline, pas de
// CDN ni de fichier CSS séparé à charger — CLAUDE.md règle #5).
const ANIMATION_STYLE_ID = 'challenge-feedback-keyframes'
function ensureAnimationStyleInjected() {
  if (typeof document === 'undefined') return
  if (document.getElementById(ANIMATION_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = ANIMATION_STYLE_ID
  style.textContent = `
@keyframes ${successAnimation} {
  0% { transform: scale(0.6) rotate(-8deg); opacity: 0; }
  60% { transform: scale(1.15) rotate(4deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
@keyframes ${errorAnimation} {
  0% { transform: translateY(-6px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}`
  document.head.appendChild(style)
}

export function ChallengeFeedback({
  outcome,
  companionPhrase,
  speak,
  reducedMotion,
  testId,
}: ChallengeFeedbackProps) {
  const effectiveReducedMotion = reducedMotion ?? detectReducedMotion()

  useEffect(() => {
    ensureAnimationStyleInjected()
  }, [])

  useEffect(() => {
    const text = companionPhrase.trim()
    if (text.length === 0 || !speak) return
    void speak(text)
    // Volontaire : re-narrer si l'issue ou la phrase change (nouveau défi),
    // mais pas sur un changement d'identité de `speak` seul.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome, companionPhrase])

  const animationName = outcome === 'success' ? successAnimation : errorAnimation
  const style: CSSProperties = useMemo(
    () => ({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      animation: effectiveReducedMotion ? 'none' : `${animationName} 420ms ease-out`,
    }),
    [animationName, effectiveReducedMotion],
  )

  return (
    <div
      className={`challenge-feedback challenge-feedback--${outcome}`}
      style={style}
      role="status"
      data-testid={testId}
      data-outcome={outcome}
    >
      <div style={iconWrapperStyle}>{outcome === 'success' ? <SuccessGlyph /> : <TryAgainGlyph />}</div>
      <p style={{ fontSize: 36, margin: 0, textAlign: 'center' }} data-testid="feedback-phrase">
        {companionPhrase}
      </p>
    </div>
  )
}
