// Styles de sécurité tactile appliqués à la racine de l'application (SPEC §3).
// Exposés comme objet de style React (inline) plutôt que via une feuille CSS
// externe : appliqués systématiquement au premier rendu, sans dépendre du
// chargement d'un fichier CSS séparé, et donc directement vérifiables par test.
import type { CSSProperties } from 'react'

export const touchSafeStyle: CSSProperties = {
  // Autorise le geste tactile de base (tap, pan) mais désactive le double-tap
  // pour zoomer : c'est le mécanisme standard de désactivation du zoom par
  // double-tap sur Chrome Android (SPEC §3).
  touchAction: 'manipulation',
  // Empêche la sélection de texte accidentelle par appui long, sans intérêt
  // pour un enfant qui ne lit pas et ne doit jamais voir de menu de sélection.
  WebkitUserSelect: 'none',
  userSelect: 'none',
  // Empêche le "pull-to-refresh" et le rebond de défilement du navigateur
  // pendant le jeu.
  overscrollBehavior: 'none',
  // La racine occupe tout l'écran disponible ; évite toute barre de défilement
  // qui inviterait au balayage.
  width: '100%',
  height: '100%',
  minHeight: '100svh',
}
