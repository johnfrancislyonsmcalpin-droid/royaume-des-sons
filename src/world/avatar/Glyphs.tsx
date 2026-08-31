// Silhouettes SVG inline — géométriques, sans image externe (SPEC §3 « Assets »).
// Chaque créature est un corps rond + un motif distinctif, sans aucun trait
// genré (pas de vêtement, pas de coiffure), conformément à SPEC §4.

import type { AvatarOption, CompanionOption } from './avatarData'

const EYE_FILL = '#2B2B2B'

function Eyes() {
  return (
    <>
      <circle cx="41" cy="52" r="4" fill={EYE_FILL} />
      <circle cx="59" cy="52" r="4" fill={EYE_FILL} />
    </>
  )
}

function Body({ fill }: { fill: string }) {
  return <circle cx="50" cy="56" r="30" fill={fill} />
}

export function AvatarGlyph({ avatar }: { avatar: AvatarOption }) {
  const { shape, colorPrimary, colorSecondary } = avatar
  return (
    <svg
      viewBox="0 0 100 100"
      width="56"
      height="56"
      role="presentation"
      aria-hidden="true"
    >
      <Body fill={colorPrimary} />
      {shape === 'comete' && (
        <path
          d="M50 8 L58 26 L78 22 L62 36 L70 54 L50 42 L30 54 L38 36 L22 22 L42 26 Z"
          fill={colorSecondary}
        />
      )}
      {shape === 'feuille' && (
        <path
          d="M50 10 C70 18 74 40 50 52 C26 40 30 18 50 10 Z"
          fill={colorSecondary}
        />
      )}
      {shape === 'vague' && (
        <path
          d="M18 32 Q34 12 50 32 Q66 52 82 32 L82 40 Q66 60 50 40 Q34 20 18 40 Z"
          fill={colorSecondary}
        />
      )}
      {shape === 'flamme' && (
        <path
          d="M50 8 C62 24 66 34 58 46 C64 40 66 46 64 52 C60 44 54 42 50 48 C46 42 40 44 36 52 C34 46 36 40 42 46 C34 34 38 24 50 8 Z"
          fill={colorSecondary}
        />
      )}
      <Eyes />
    </svg>
  )
}

export function CompanionGlyph({ companion }: { companion: CompanionOption }) {
  const { shape, colorPrimary, colorSecondary } = companion
  return (
    <svg
      viewBox="0 0 100 100"
      width="56"
      height="56"
      role="presentation"
      aria-hidden="true"
    >
      {shape === 'luciole' && (
        <>
          <ellipse cx="30" cy="46" rx="16" ry="10" fill={colorSecondary} />
          <ellipse cx="70" cy="46" rx="16" ry="10" fill={colorSecondary} />
          <circle cx="50" cy="56" r="18" fill={colorPrimary} />
          <circle cx="50" cy="70" r="7" fill={colorSecondary} />
        </>
      )}
      {shape === 'renardeau' && (
        <>
          <path d="M32 30 L44 48 L24 50 Z" fill={colorPrimary} />
          <path d="M68 30 L76 50 L56 48 Z" fill={colorPrimary} />
          <Body fill={colorPrimary} />
          <path d="M50 60 L58 70 L42 70 Z" fill={colorSecondary} />
        </>
      )}
      {shape === 'hibou' && (
        <>
          <Body fill={colorPrimary} />
          <circle cx="41" cy="50" r="10" fill={colorSecondary} />
          <circle cx="59" cy="50" r="10" fill={colorSecondary} />
          <path d="M50 58 L45 66 L55 66 Z" fill="#E8935C" />
        </>
      )}
      {shape !== 'hibou' && <Eyes />}
      {shape === 'hibou' && (
        <>
          <circle cx="41" cy="50" r="3" fill={EYE_FILL} />
          <circle cx="59" cy="50" r="3" fill={EYE_FILL} />
        </>
      )}
    </svg>
  )
}

export function ConfirmGlyph() {
  return (
    <svg
      viewBox="0 0 100 100"
      width="40"
      height="40"
      role="presentation"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="42" fill="#4CAF7D" />
      <path
        d="M30 52 L44 66 L72 34"
        stroke="#FFFFFF"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
