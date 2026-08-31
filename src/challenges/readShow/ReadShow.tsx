// Mécanique de défi "Lis et montre" (SPEC §6.3) : un mot ou une phrase
// écrite, toucher l'image correspondante parmi 3. Contrairement à "Écoute et
// touche", la cible n'est JAMAIS énoncée à voix haute automatiquement : le
// principe même de cette mécanique est de forcer le décodage visuel du texte
// affiché (l'énoncer d'emblée court-circuiterait l'exercice de lecture). La
// réécoute reste possible via le bouton oreille (chrome externe, hors
// périmètre de ce composant, contract.ts) qui pilote `usedListenAgain`.
//
// Décisions consignées (comportement non entièrement fixé par SPEC.md) :
// - Les 3 images sont les emoji des `ContentItem` de `challenge.options`
//   (`item.emoji`, obligatoire pour `kind === 'word'` — types.ts). Un item
//   sans emoji (cas non attendu du corpus vérifié B4) retombe sur son texte
//   écrit plutôt que de planter, pour rester robuste en test isolé.
// - Aide graduée : niveau 1 surligne visuellement le premier graphème du mot
//   affiché (jamais énoncé : énoncer romprait le principe "lire, pas
//   entendre" de cette mécanique) ; niveau 2 retire une image distractrice
//   (jamais la cible) ; niveau 3 fait clignoter l'image cible.
// - Même statut que ListenTouch (C2) pour la phrase de compagnon de
//   `ChallengeFeedback` : générique, courte, en dur — narration/chrome, pas
//   contenu pédagogique (voir en-tête de `ListenTouch.tsx` pour la
//   justification complète et le précédent des leaves déjà vérifiées).
//   `SuccessFlow` n'est pas utilisé pour la même raison (pas de récepteur
//   pour son bouton "continuer" avant E3) ; `ChallengeFeedback` +
//   `PostSuccessReplay` sont composés directement.
// - Verrouillage après réponse correcte, retente libre après une réponse
//   incorrecte : même convention que ListenTouch/Reorder.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChallengeComponentProps } from '../shared/contract'
import { TapTarget } from '../shared/TapTarget'
import { ChallengeFeedback } from '../shared/feedback'
import { PostSuccessReplay } from '../shared/postSuccessReplay'
import { uiText } from '../../content/uiText'

type Outcome = 'idle' | 'correct' | 'incorrect'

export function ReadShow({
  challenge,
  helpLevel,
  usedListenAgain,
  resolveItem,
  speak,
  onAnswer,
}: ChallengeComponentProps) {
  const targetItem = useMemo(() => resolveItem(challenge.targetItemId), [resolveItem, challenge.targetItemId])

  const [outcome, setOutcome] = useState<Outcome>('idle')
  const startedAtRef = useRef(Date.now())

  useEffect(() => {
    startedAtRef.current = Date.now()
    setOutcome('idle')
  }, [challenge.id])

  const visibleOptions = useMemo(() => {
    if (helpLevel < 2) return challenge.options
    let removed = false
    return challenge.options.filter((option) => {
      if (removed) return true
      if (option.contentItemId === challenge.targetItemId) return true
      if (!option.isDistractor) return true
      removed = true
      return false
    })
  }, [challenge.options, challenge.targetItemId, helpLevel])

  function handleTap(contentItemId: string) {
    if (outcome === 'correct') return
    const correct = contentItemId === challenge.targetItemId
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

  const firstGrapheme = targetItem.graphemeIds[0] ?? ''
  const restOfWord = firstGrapheme ? targetItem.text.slice(firstGrapheme.length) : targetItem.text

  return (
    <div className="read-show" data-testid="read-show" data-outcome={outcome}>
      <p
        className="read-show__text"
        data-testid="read-show-text"
        style={{ fontSize: 64, textAlign: 'center', margin: '0 0 24px' }}
      >
        {helpLevel >= 1 && firstGrapheme ? (
          <>
            <span data-testid="read-show-highlight" style={{ backgroundColor: '#FFE38A', borderRadius: 8 }}>
              {firstGrapheme}
            </span>
            {restOfWord}
          </>
        ) : (
          targetItem.text
        )}
      </p>

      <div role="group" aria-label="Images à toucher" className="read-show__images" data-testid="read-show-images">
        {visibleOptions.map((option) => {
          const item = resolveItem(option.contentItemId)
          const isTarget = option.contentItemId === challenge.targetItemId
          const blinking = helpLevel >= 3 && isTarget
          const visual = item.emoji ?? item.text

          return (
            <TapTarget
              key={option.id}
              onTap={() => handleTap(option.contentItemId)}
              label={item.emoji ? item.text : `Image : ${item.text}`}
              selected={blinking}
              disabled={outcome === 'correct'}
              testId={`read-show-image-${option.id}`}
              className={blinking ? 'read-show__image read-show__image--blink' : 'read-show__image'}
              style={{ fontSize: 56, padding: '20px 24px', backgroundColor: '#EAF1F8' }}
            >
              {visual}
            </TapTarget>
          )
        })}
      </div>

      {outcome === 'correct' && (
        <>
          <ChallengeFeedback
            outcome="success"
            companionPhrase={uiText.challenges.readShowSuccess}
            speak={speak}
            testId="read-show-feedback"
          />
          <PostSuccessReplay item={targetItem} speak={speak} testId="read-show-replay" />
        </>
      )}

      {outcome === 'incorrect' && (
        <ChallengeFeedback
          outcome="error"
          companionPhrase={uiText.challenges.readShowRetry}
          speak={speak}
          testId="read-show-feedback"
        />
      )}
    </div>
  )
}
