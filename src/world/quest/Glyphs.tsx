// Icônes du chrome d'aide de quête (oreille, lanterne — SPEC §8). Doublure
// locale à src/world/quest/**, même précédent documenté que E1 (TapButton)
// et E4 (GrandLivreButton) : chaque leaf du monde possède ses propres petits
// composants visuels plutôt que d'importer un module hors de son OWNS.
// Silhouettes distinctes (pas seulement des couleurs différentes), SPEC §3 :
// « la réussite et l'échec ne sont jamais signalés par la seule couleur ».

/** Oreille stylisée — bouton de réécoute (gratuit, illimité, SPEC §8). */
export function EarGlyph() {
  return (
    <svg viewBox="0 0 100 100" width={40} height={40} role="img" aria-hidden="true" data-testid="quest-glyph-ear">
      <path
        d="M60 15 C40 15 26 32 26 52 C26 66 36 70 36 80 C36 88 44 90 48 84 C50 80 46 76 48 70 C58 72 74 62 74 45 C74 28 78 15 60 15 Z"
        fill="#4A90D9"
        stroke="#2C5C8F"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path d="M46 40 C40 46 40 56 46 62" stroke="#2C5C8F" strokeWidth={3} fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Lanterne stylisée — bouton d'indice gradué (3 paliers, SPEC §8). */
export function LanternGlyph() {
  return (
    <svg viewBox="0 0 100 100" width={40} height={40} role="img" aria-hidden="true" data-testid="quest-glyph-lantern">
      <rect x="38" y="8" width="24" height="10" rx="2" fill="#B9860A" />
      <path
        d="M30 20 h40 l-6 55 a4 4 0 0 1 -4 4 h-20 a4 4 0 0 1 -4 -4 Z"
        fill="#F4B400"
        stroke="#B9860A"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <circle cx="50" cy="46" r="12" fill="#FFE38A" />
      <rect x="42" y="82" width="16" height="10" rx="2" fill="#B9860A" />
    </svg>
  )
}
