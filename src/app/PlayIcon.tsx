// Icône purement décorative (triangle "lecture" dans un cercle). Aucun mot,
// aucune lettre : le premier écran ne doit rien exiger de lisible (SPEC §2).
export function PlayIcon() {
  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="50" cy="50" r="47" fill="#3ba55c" />
      <polygon points="38,28 76,50 38,72" fill="#ffffff" />
    </svg>
  )
}
