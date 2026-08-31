// Icônes purement décoratives pour l'écran de vérification de la voix.
// aria-hidden partout : ce composant complète le texte (accepté ici,
// exceptionnellement — voir VoiceCheckScreen.tsx) mais ne s'appuie jamais sur
// une icône seule pour porter le sens (même logique que PlayIcon.tsx, A1).
export function EarIcon() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="47" fill="#3ba9a5" />
      <path
        d="M55 25c-14 0-24 11-24 24 0 9 5 13 5 20 0 5-4 6-4 11 0 6 5 9 10 9 8 0 12-7 12-14"
        fill="none"
        stroke="#ffffff"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path
        d="M52 38c-7 0-12 6-12 13 0 5 3 7 3 11"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="47" fill="#3ba55c" />
      <path
        d="M30 52 44 66 72 36"
        fill="none"
        stroke="#ffffff"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CrossIcon() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="47" fill="#c94b4b" />
      <path
        d="M33 33 67 67M67 33 33 67"
        fill="none"
        stroke="#ffffff"
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function AdultIcon() {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" focusable="false">
      <circle cx="50" cy="50" r="47" fill="#aa3bff" />
      <circle cx="50" cy="34" r="14" fill="#ffffff" />
      <path
        d="M24 82c2-18 12-28 26-28s24 10 26 28"
        fill="none"
        stroke="#ffffff"
        strokeWidth="7"
        strokeLinecap="round"
      />
    </svg>
  )
}
