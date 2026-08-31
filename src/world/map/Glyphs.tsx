// Icônes SVG inline de la carte du monde — géométriques, sans image externe
// (SPEC §3 « Assets »). Décoratives (`aria-hidden`) : l'accessibilité passe par
// `aria-label` sur TapButton, jamais par ces formes elles-mêmes. L'enfant, lui,
// ne lit rien : il distingue verrouillé / ouvert / terminé / boss uniquement
// par la forme et la couleur (consigne E1 « icônes/couleurs/formes uniquement »).

const INK = '#2B2B2B'

/** Région non débloquée : brume grise + cadenas — jamais la seule couleur qui
 * signale l'état, cf. SPEC §3 « la réussite et l'échec ne sont jamais signalés
 * par la seule couleur ». */
export function FogGlyph() {
  return (
    <svg viewBox="0 0 100 100" width="48" height="48" role="presentation" aria-hidden="true">
      <circle cx="50" cy="50" r="42" fill="#C7CCD1" />
      <circle cx="34" cy="42" r="16" fill="#DEE2E6" />
      <circle cx="62" cy="40" r="18" fill="#DEE2E6" />
      <circle cx="50" cy="58" r="20" fill="#DEE2E6" />
      <rect x="40" y="52" width="20" height="16" rx="3" fill="#8B93A0" />
      <path d="M43 52 V45 a7 7 0 0 1 14 0 V52" fill="none" stroke="#8B93A0" strokeWidth="4" />
    </svg>
  )
}

/** Région débloquée et jouable maintenant : éclat/étincelle. */
export function OpenGlyph({ color = '#F5A623' }: { color?: string }) {
  return (
    <svg viewBox="0 0 100 100" width="48" height="48" role="presentation" aria-hidden="true">
      <circle cx="50" cy="50" r="42" fill={color} />
      <path
        d="M50 20 L58 42 L80 50 L58 58 L50 80 L42 58 L20 50 L42 42 Z"
        fill="#FFFFFF"
        opacity="0.85"
      />
    </svg>
  )
}

/** Région terminée : badge étoile pleine + coche. */
export function CompletedGlyph() {
  return (
    <svg viewBox="0 0 100 100" width="48" height="48" role="presentation" aria-hidden="true">
      <circle cx="50" cy="50" r="42" fill="#4CAF7D" />
      <path
        d="M32 52 L44 64 L70 36"
        stroke="#FFFFFF"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

/** Quête régulière : orbe simple. */
export function QuestOrbGlyph({ color = '#4A90D9' }: { color?: string }) {
  return (
    <svg viewBox="0 0 100 100" width="36" height="36" role="presentation" aria-hidden="true">
      <circle cx="50" cy="50" r="34" fill={color} />
      <circle cx="40" cy="40" r="8" fill="#FFFFFF" opacity="0.6" />
    </svg>
  )
}

/** Quête boss : couronne, toujours en dernière position d'une région. */
export function BossGlyph() {
  return (
    <svg viewBox="0 0 100 100" width="40" height="40" role="presentation" aria-hidden="true">
      <circle cx="50" cy="50" r="38" fill="#8C4AE6" />
      <path
        d="M28 62 L32 40 L46 52 L50 34 L54 52 L68 40 L72 62 Z"
        fill="#FFE0A3"
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
