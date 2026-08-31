// Mécanique de défi "Vrai mot / faux mot" (SPEC §6.4, niveau 7+) : force le
// décodage plutôt que la reconnaissance globale. Présente UN item
// (`resolveItem(challenge.targetItemId)`, `kind` 'word' ou 'pseudoword') et 2
// boutons ; correct seulement si le choix correspond au vrai `kind` de
// l'item.
//
// Décisions consignées (comportement non entièrement fixé par SPEC.md) :
// - Comme "Lis et montre", la cible n'est JAMAIS énoncée à voix haute
//   automatiquement : le principe de cette mécanique ("force le décodage
//   plutôt que la reconnaissance globale", SPEC §6.4) exige que l'enfant
//   décode le mot AFFICHÉ, pas un mot entendu — l'énoncer d'emblée
//   annulerait l'exercice. Réécoute possible via le bouton oreille (chrome
//   externe, `usedListenAgain`).
// - `challenge.options` n'est pas utilisé pour cette mécanique : il n'y a
//   qu'un seul item à juger (`targetItemId`), pas un choix parmi plusieurs
//   `ContentItem`. Les 2 boutons ("ce mot existe" / "ce mot est inventé")
//   sont fixes, pas dérivés du contenu.
// - Aide graduée adaptée à un choix à 2 boutons (le niveau 2 de SPEC §8,
//   « une mauvaise option disparaît », ne s'applique pas tel quel : avec
//   seulement 2 boutons, retirer le mauvais réduirait le défi à un seul
//   bouton restant, ce qui RÉVÈLE la réponse au lieu de la clignoter comme le
//   fait le niveau 3 — les deux se confondraient). Décision : niveau 1
//   surligne le premier graphème du mot affiché (jamais énoncé, même
//   raison que pour l'absence de consigne vocale) ; niveaux 2 ET 3 font
//   clignoter le bouton correct (l'enfant doit quand même le toucher) — pas
//   de retrait d'option pour cette mécanique à 2 choix.
// - Même statut que ListenTouch/ReadShow (C2) pour la phrase de compagnon de
//   `ChallengeFeedback` : générique, courte, en dur (narration/chrome, voir
//   en-tête de `ListenTouch.tsx`). `PostSuccessReplay` composé directement
//   après une réponse correcte, sans `SuccessFlow` (pas de récepteur pour son
//   bouton "continuer" avant E3).
// - Verrouillage après réponse correcte, retente libre après une réponse
//   incorrecte : même convention que ListenTouch/ReadShow/Reorder.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChallengeComponentProps } from '../shared/contract'
import { TapTarget } from '../shared/TapTarget'
import { ChallengeFeedback } from '../shared/feedback'
import { PostSuccessReplay } from '../shared/postSuccessReplay'
import { uiText } from '../../content/uiText'

type Outcome = 'idle' | 'correct' | 'incorrect'

/** Silhouette "mot réel" — livre ouvert, distincte de la silhouette
 * "mot inventé" (pas seulement une couleur différente). */
function RealWordGlyph() {
  return (
    <svg viewBox="0 0 100 100" width={48} height={48} role="img" aria-hidden="true" data-testid="true-false-icon-real">
      <path
        d="M50 20 C40 12 20 12 12 18 V78 C20 72 40 72 50 80 C60 72 80 72 88 78 V18 C80 12 60 12 50 20 Z"
        fill="#4C8C4A"
        stroke="#2E5E2C"
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <line x1="50" y1="20" x2="50" y2="80" stroke="#2E5E2C" strokeWidth={2} />
    </svg>
  )
}

/** Silhouette "mot inventé" — étoile filante à queue ondulée, distincte du
 * livre (forme, pas seulement couleur). */
function InventedWordGlyph() {
  return (
    <svg
      viewBox="0 0 100 100"
      width={48}
      height={48}
      role="img"
      aria-hidden="true"
      data-testid="true-false-icon-invented"
    >
      <circle cx="66" cy="34" r="16" fill="#8A5FC2" stroke="#5B3B85" strokeWidth={3} />
      <path
        d="M50 46 C40 52 30 50 20 60 C30 58 38 62 30 70 C40 66 46 72 40 80 C48 74 52 68 46 62"
        fill="none"
        stroke="#5B3B85"
        strokeWidth={4}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function TrueFalseWord({
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

  const isActuallyReal = targetItem.kind === 'word'

  function handleChoice(choseReal: boolean) {
    if (outcome === 'correct') return
    const correct = choseReal === isActuallyReal
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

  const blinkReal = helpLevel >= 2 && isActuallyReal
  const blinkInvented = helpLevel >= 2 && !isActuallyReal

  return (
    <div className="true-false-word" data-testid="true-false-word" data-outcome={outcome}>
      <p
        className="true-false-word__text"
        data-testid="true-false-word-text"
        style={{ fontSize: 64, textAlign: 'center', margin: '0 0 24px' }}
      >
        {helpLevel >= 1 && firstGrapheme ? (
          <>
            <span data-testid="true-false-word-highlight" style={{ backgroundColor: '#FFE38A', borderRadius: 8 }}>
              {firstGrapheme}
            </span>
            {restOfWord}
          </>
        ) : (
          targetItem.text
        )}
      </p>

      <div role="group" aria-label="Ce mot existe-t-il ?" className="true-false-word__choices" data-testid="true-false-word-choices">
        <TapTarget
          onTap={() => handleChoice(true)}
          label="Ce mot existe"
          selected={blinkReal}
          disabled={outcome === 'correct'}
          testId="true-false-word-real"
          style={{ padding: '20px 24px', backgroundColor: '#EAF1F8' }}
        >
          <RealWordGlyph />
        </TapTarget>
        <TapTarget
          onTap={() => handleChoice(false)}
          label="Ce mot est inventé"
          selected={blinkInvented}
          disabled={outcome === 'correct'}
          testId="true-false-word-invented"
          style={{ padding: '20px 24px', backgroundColor: '#EAF1F8' }}
        >
          <InventedWordGlyph />
        </TapTarget>
      </div>

      {outcome === 'correct' && (
        <>
          <ChallengeFeedback
            outcome="success"
            companionPhrase={uiText.challenges.trueFalseSuccess}
            speak={speak}
            testId="true-false-word-feedback"
          />
          <PostSuccessReplay item={targetItem} speak={speak} testId="true-false-word-replay" />
        </>
      )}

      {outcome === 'incorrect' && (
        <ChallengeFeedback
          outcome="error"
          companionPhrase={uiText.challenges.trueFalseRetry}
          speak={speak}
          testId="true-false-word-feedback"
        />
      )}
    </div>
  )
}
