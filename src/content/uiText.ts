// Loader pour les phrases d'interface/narration du jeu (jamais lues/décodées
// par l'enfant, seulement énoncées ou destinées à un lecteur d'écran adulte) :
// libellés de la carte du monde, du Grand Livre, et rétroaction du compagnon
// dans les mécaniques de défi. Distinct du corpus pédagogique (mots/phrases/
// textes que l'enfant apprend à décoder), qui reste seul soumis à la
// contrainte de décodabilité et vit dans src/content/corpus/*.json.
//
// GB6 (tools/check.mjs code --no-hardcoded-content) interdit toute phrase
// française en dur ailleurs dans le code : ce fichier est la source unique.

import rawUiText from './uiText.json'

interface UiText {
  map: {
    regionNames: Record<string, string>
    overview: string
    regionLocked: string
    regionCompleted: string
    regionCurrent: string
    regionTouchLocked: string
    regionTouchOpen: string
    questListAppearance: string
    questTouchBoss: string
    questTouchRegular: string
  }
  grandLivre: {
    empty: string
    intro: string
    listen: string
  }
  challenges: {
    listenTouchSuccess: string
    listenTouchRetry: string
    readShowSuccess: string
    readShowRetry: string
    trueFalseSuccess: string
    trueFalseRetry: string
    companionQuestionSuccess: string
    companionQuestionRetry: string
  }
}

export const uiText: UiText = rawUiText as UiText

/** Remplace les jetons `{cle}` d'un gabarit par les valeurs de `params`. */
export function formatUiText(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  )
}
