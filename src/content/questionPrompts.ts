// Résolution TextQuestion.promptKey -> phrase française à énoncer (SPEC §6.6
// "La question du compagnon"). Défaut corrigé à l'intégration (leaf A5/F3) :
// C2/CompanionQuestion.tsx appelait `speak(question.promptKey)` directement,
// énonçant la clé brute ("l9-text-01-q1-qui-arrive") plutôt qu'une vraie
// question — jamais détecté par un test unitaire parce que ceux-ci fabriquent
// leurs propres promptKey de test qui n'ont pas besoin d'être une vraie
// phrase. Ce fichier est la seule source ; jamais de phrase de compagnon en
// dur ailleurs (CLAUDE.md règle #2, GB6).
import rawPrompts from './questionPrompts.json'

const prompts: Record<string, string> = rawPrompts

/**
 * Résout une clé de question en phrase française. Dégrade silencieusement
 * vers la clé brute si elle est inconnue (erreur de contenu, jamais un
 * throw visible par l'enfant), avec un avertissement en développement.
 */
export function getQuestionPrompt(promptKey: string): string {
  const prompt = prompts[promptKey]
  if (prompt === undefined) {
    if (typeof console !== 'undefined' && import.meta.env?.DEV) {
      console.warn(`[content/questionPrompts] clé de question inconnue : "${promptKey}"`)
    }
    return promptKey
  }
  return prompt
}
