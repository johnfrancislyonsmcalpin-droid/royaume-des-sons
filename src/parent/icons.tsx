// Silhouettes SVG inline pour l'écran parent — géométriques, sans image
// externe (SPEC §3 « Assets »), même convention que src/world/avatar/Glyphs.tsx.
// CLAUDE.md règle #1 impose une icône par bouton même si cet écran s'adresse
// à un adulte (précédent : src/app/VoiceCheckScreen/icons.tsx).

import type { ReactNode } from 'react'

const STROKE = '#2B2B2B'

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" role="presentation" aria-hidden="true">
      {children}
    </svg>
  )
}

export function LockIcon() {
  return (
    <Svg>
      <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke={STROKE} strokeWidth="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke={STROKE} strokeWidth="2" />
    </Svg>
  )
}

export function CloseIcon() {
  return (
    <Svg>
      <path d="M6 6l12 12M18 6L6 18" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  )
}

export function BackspaceIcon() {
  return (
    <Svg>
      <path
        d="M9 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-6-6z"
        fill="none"
        stroke={STROKE}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 10l5 5M17 10l-5 5" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  )
}

export function CheckIcon() {
  return (
    <Svg>
      <path d="M5 13l4 4L19 7" fill="none" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function DownloadIcon() {
  return (
    <Svg>
      <path d="M12 4v11m0 0l-4-4m4 4l4-4" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  )
}

export function UploadIcon() {
  return (
    <Svg>
      <path d="M12 20V9m0 0l-4 4m4-4l4 4" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 5h14" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  )
}

export function TrashIcon() {
  return (
    <Svg>
      <path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0l1 13h8l1-13" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function SpeakerIcon() {
  return (
    <Svg>
      <path d="M4 10v4h4l5 4V6l-5 4z" fill={STROKE} />
      <path d="M16 9a4 4 0 0 1 0 6" fill="none" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  )
}

export function RefreshIcon() {
  return (
    <Svg>
      <path
        d="M5 12a7 7 0 0 1 12-4.9M19 12a7 7 0 0 1-12 4.9M17 5v3.5H13.5M7 19v-3.5H10.5"
        fill="none"
        stroke={STROKE}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function WarningIcon() {
  return (
    <Svg>
      <path d="M12 4l9 16H3z" fill="none" stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill={STROKE} />
    </Svg>
  )
}

export function ChartIcon() {
  return (
    <Svg>
      <path d="M5 19V9m6.5 10V5M18 19v-6" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  )
}
