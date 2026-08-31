// Mécanique de défi "La question du compagnon" (SPEC §6.6, niveau 9+) :
// question orale après un texte, réponses en images ou mots courts.
//
// Décisions consignées (comportement non entièrement fixé par SPEC.md,
// `Challenge`/`ContentItem`/`TextQuestion` FIGÉS — types.ts) :
// - `challenge.targetItemId` cible le TEXTE (`ContentItem` de `kind ===
//   'text'`), dont `questions?: TextQuestion[]` porte la question et ses
//   réponses. Ni `Challenge` ni `ChallengeOption` n'ont de champ pour
//   distinguer QUELLE question d'un texte à plusieurs questions ce défi
//   précis interroge (`ChallengeOption.contentItemId` référence un
//   `ContentItem`, pas un `TextQuestion` — espace d'id différent, et
//   `TextQuestion.answerOptions` sont des libellés bruts, pas des ids de
//   contenu). Décision, cohérente avec le fait qu'un `Challenge` cible
//   toujours UN SEUL élément pédagogique (`targetItemId`, singulier) : ce
//   composant utilise la PREMIÈRE question du texte
//   (`targetItem.questions?.[0]`). Limite connue : un texte à 2 questions
//   (SPEC §5, niveau 10) suppose que le moteur de quête (E3, pas encore
//   livré) instancie 2 `Challenge` distincts pour le même `targetItemId` — ce
//   composant n'a aucun moyen de savoir qu'il doit poser la seconde plutôt
//   que la première tant qu'aucun champ d'index n'existe dans le contrat. À
//   documenter dans ASSUMPTIONS.md par le driver si un champ `questionIndex`
//   doit être ajouté au contrat à l'intégration.
// - Consigne vocale : `speak(targetItem.text)` (le texte lui-même) suivi de
//   `speak(getQuestionPrompt(question.promptKey))`, une fois à l'apparition
//   du défi. `TextQuestion.promptKey` est une clé résolue en phrase française
//   via `src/content/questionPrompts.json` (corrigé à l'intégration : la
//   première version de ce composant énonçait la clé brute, jamais détecté
//   par les tests unitaires qui fabriquent leurs propres promptKey de test —
//   voir ASSUMPTIONS.md).
// - `challenge.options` n'est pas utilisé : les réponses proposées viennent
//   de `question.answerOptions` (libellés courts ou emoji, déjà fournis par
//   le contenu), validées contre `question.correctIndex`.
// - `challenge.options` étant ignoré, l'aide graduée niveau 2 (retrait d'une
//   mauvaise option) s'applique directement sur les index de
//   `answerOptions` autres que `correctIndex`. Niveau 1 n'a pas de graphème à
//   surligner (la question ne porte pas sur un graphème isolé) : il ré-énonce
//   la question. Niveau 3 fait clignoter la bonne réponse.
// - Même statut que les 3 autres mécaniques de C2 pour la phrase de
//   compagnon de `ChallengeFeedback` : générique, courte, en dur
//   (narration/chrome, voir en-tête de `ListenTouch.tsx`).
//   `PostSuccessReplay` rejoue le texte cible après une réponse correcte,
//   sans `SuccessFlow` (pas de récepteur pour son bouton "continuer" avant
//   E3).
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChallengeComponentProps } from '../shared/contract'
import { TapTarget } from '../shared/TapTarget'
import { ChallengeFeedback } from '../shared/feedback'
import { PostSuccessReplay } from '../shared/postSuccessReplay'
import { uiText } from '../../content/uiText'
import { getQuestionPrompt } from '../../content/questionPrompts'

type Outcome = 'idle' | 'correct' | 'incorrect'

export function CompanionQuestion({
  challenge,
  helpLevel,
  usedListenAgain,
  resolveItem,
  speak,
  onAnswer,
}: ChallengeComponentProps) {
  const targetItem = useMemo(() => resolveItem(challenge.targetItemId), [resolveItem, challenge.targetItemId])
  const question = targetItem.questions?.[0] ?? null

  const [outcome, setOutcome] = useState<Outcome>('idle')
  const startedAtRef = useRef(Date.now())
  const spokenForChallengeRef = useRef<string | null>(null)

  useEffect(() => {
    startedAtRef.current = Date.now()
    setOutcome('idle')
  }, [challenge.id])

  // Consigne : le texte, puis la question, une seule fois à l'apparition.
  useEffect(() => {
    if (spokenForChallengeRef.current === challenge.id) return
    spokenForChallengeRef.current = challenge.id
    void (async () => {
      await speak(targetItem.text)
      if (question) await speak(getQuestionPrompt(question.promptKey))
    })()
  }, [challenge.id, targetItem.text, question, speak])

  const visibleAnswerIndexes = useMemo(() => {
    if (!question) return []
    const allIndexes = question.answerOptions.map((_, index) => index)
    if (helpLevel < 2) return allIndexes
    let removed = false
    return allIndexes.filter((index) => {
      if (removed) return true
      if (index === question.correctIndex) return true
      removed = true
      return false
    })
  }, [question, helpLevel])

  function handleChoice(answerIndex: number) {
    if (!question || outcome === 'correct') return
    const correct = answerIndex === question.correctIndex
    const responseMs = Date.now() - startedAtRef.current

    onAnswer({
      challengeId: challenge.id,
      correct,
      usedHelpLevel: helpLevel,
      usedListenAgain,
      responseMs,
    })

    if (correct) {
      setOutcome('correct')
    } else {
      setOutcome('incorrect')
      startedAtRef.current = Date.now()
    }
  }

  if (!question) {
    // Texte sans question associée : état défensif, ne devrait jamais se
    // produire avec le corpus vérifié (B4), mais ne doit jamais planter.
    return <div className="companion-question" data-testid="companion-question" data-outcome="idle" />
  }

  return (
    <div className="companion-question" data-testid="companion-question" data-outcome={outcome}>
      <div
        role="group"
        aria-label="Réponses à la question du compagnon"
        className="companion-question__answers"
        data-testid="companion-question-answers"
      >
        {visibleAnswerIndexes.map((answerIndex) => {
          const label = question.answerOptions[answerIndex]
          const isCorrect = answerIndex === question.correctIndex
          const blinking = helpLevel >= 3 && isCorrect

          return (
            <TapTarget
              key={`${question.id}-${answerIndex}`}
              onTap={() => handleChoice(answerIndex)}
              label={label}
              selected={blinking}
              disabled={outcome === 'correct'}
              testId={`companion-question-answer-${answerIndex}`}
              className={blinking ? 'companion-question__answer companion-question__answer--blink' : 'companion-question__answer'}
              style={{ fontSize: 32, padding: '16px 24px', backgroundColor: '#EAF1F8' }}
            >
              {label}
            </TapTarget>
          )
        })}
      </div>

      {outcome === 'correct' && (
        <>
          <ChallengeFeedback
            outcome="success"
            companionPhrase={uiText.challenges.companionQuestionSuccess}
            speak={speak}
            testId="companion-question-feedback"
          />
          <PostSuccessReplay item={targetItem} speak={speak} testId="companion-question-replay" />
        </>
      )}

      {outcome === 'incorrect' && (
        <ChallengeFeedback
          outcome="error"
          companionPhrase={uiText.challenges.companionQuestionRetry}
          speak={speak}
          testId="companion-question-feedback"
        />
      )}
    </div>
  )
}
