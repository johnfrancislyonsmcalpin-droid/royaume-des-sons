// Textes narrés du Grand Livre — Le Royaume des Sons (leaf E4).
//
// Les libellés viennent de src/content/uiText.json (voir GB6,
// tools/check.mjs code --no-hardcoded-content) : jamais de phrase française
// en dur ici.

import { uiText } from '../../content/uiText'

/** Narration jouée à l'apparition de l'écran (une seule fois, écran entier). */
export function screenIntroNarration(itemCount: number): string {
  if (itemCount === 0) {
    return uiText.grandLivre.empty
  }
  return uiText.grandLivre.intro
}

/** Narration jouée quand l'enfant touche un item pour le réécouter. */
export function itemTouchNarration(): string {
  return uiText.grandLivre.listen
}
