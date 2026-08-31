// Silhouettes SVG inline pour les boutons de composition ajoutés par
// l'intégration (accès au Grand Livre depuis la carte, retour depuis le
// Grand Livre) — mêmes conventions que src/parent/icons.tsx et
// src/app/VoiceCheckScreen/icons.tsx (SPEC §3 « Assets » : aucune image
// externe, formes géométriques simples).
import type { ReactNode } from 'react'

const STROKE = '#2B2B2B'

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" role="presentation" aria-hidden="true">
      {children}
    </svg>
  )
}

export function BookIcon() {
  return (
    <Svg>
      <path
        d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5z"
        fill="none"
        stroke={STROKE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M18 19H6a2 2 0 0 1 0-4h12" fill="none" stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
    </Svg>
  )
}

export function BackIcon() {
  return (
    <Svg>
      <path
        d="M14 6l-6 6 6 6"
        fill="none"
        stroke={STROKE}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Sablier — suggestion de pause (SPEC §2.6), jamais un minuteur qui compte
 * réellement (pas d'aiguille animée, pas de compte à rebours visible). */
export function HourglassIcon() {
  return (
    <Svg>
      <path
        d="M7 4h10M7 20h10M7 4c0 5 5 6 5 8s-5 3-5 8M17 4c0 5-5 6-5 8s5 3 5 8"
        fill="none"
        stroke={STROKE}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}
