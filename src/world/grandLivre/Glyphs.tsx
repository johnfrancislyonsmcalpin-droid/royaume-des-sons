// Icônes SVG inline du Grand Livre — géométriques, sans image externe
// (SPEC §3 « Assets »). Décoratives (`aria-hidden`) : l'accessibilité passe
// par `aria-label` sur GrandLivreButton, jamais par ces formes elles-mêmes.
// L'enfant, lui, ne lit rien : il reconnaît le bouton de réécoute par son
// icône (haut-parleur), jamais par un mot écrit.

/** Bouton « réécouter » : haut-parleur + ondes sonores. */
export function ListenGlyph() {
  return (
    <svg viewBox="0 0 100 100" width="40" height="40" role="presentation" aria-hidden="true">
      <path d="M30 40 H42 L60 26 V74 L42 60 H30 Z" fill="#4A90D9" />
      <path
        d="M70 38 Q80 50 70 62"
        stroke="#4A90D9"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M78 28 Q94 50 78 72"
        stroke="#4A90D9"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
    </svg>
  )
}

/** Grand Livre encore vide : livre fermé, pour l'écran d'accueil de la galerie. */
export function EmptyBookGlyph() {
  return (
    <svg viewBox="0 0 100 100" width="64" height="64" role="presentation" aria-hidden="true">
      <path d="M50 20 L14 30 V80 L50 70 Z" fill="#E8935C" />
      <path d="M50 20 L86 30 V80 L50 70 Z" fill="#F5A623" />
      <path d="M50 20 V70" stroke="#2B2B2B" strokeWidth="2" />
    </svg>
  )
}
