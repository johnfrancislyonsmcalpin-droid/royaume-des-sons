// Mécanique de défi "Écoute et touche" (SPEC §6.1) : le compagnon énonce un
// son, une syllabe ou un mot ; 3 ou 4 cartes (issues de `challenge.options`) ;
// toucher la bonne. Chaque carte affiche le texte écrit de son `ContentItem`
// (jamais une image) : la tâche pédagogique est d'associer un son entendu à
// son symbole écrit (SPEC §1 fusion phonème-graphème), donc l'appariement se
// fait sur `item.text`, pas sur `item.emoji`.
//
// Décisions consignées (comportement non entièrement fixé par SPEC.md) :
// - La consigne énoncée est le texte de la cible (`speak(targetItem.text)`),
//   une seule fois à l'apparition du défi — même convention que Reorder (C4)
//   et PostSuccessReplay/SuccessFlow (C1) : la réécoute (bouton oreille) est
//   un élément de chrome hors du périmètre de ce composant (contract.ts).
// - Aide graduée (SPEC §8), interprétée pour cette mécanique à choix de
//   cartes : niveau 1 surligne la carte cible et énonce le son de son premier
//   graphème (repli documenté : `speak(graphemeId)` littéral, même limite
//   connue que `PostSuccessReplay` sans `resolvePronunciation`, car
//   `ChallengeComponentProps` ne fournit aucune table de prononciation) ;
//   niveau 2 retire une carte distractrice (jamais la cible) ; niveau 3 fait
//   clignoter la carte cible (l'enfant doit quand même la toucher).
// - Une réponse correcte verrouille l'interaction (comme Reorder) : les
//   cartes restent affichées telles quelles pendant que le moteur de quête
//   (E3, pas encore livré) enchaîne. Une réponse incorrecte ne verrouille
//   rien : l'enfant peut retoucher une autre carte (le moteur d'aide D4 décide
//   de la reproposition après 2 échecs, pas ce composant — contract.ts).
// - Rétroaction (`ChallengeFeedback`, C1) utilisée avec une phrase de
//   compagnon générique et COURTE, sourcée depuis `src/content/uiText.json`
//   (GB6, tools/check.mjs code --no-hardcoded-content, a tranché : ces
//   phrases comptent comme du texte en dur au sens de CLAUDE.md règle #2 et
//   doivent venir de src/content/, même si l'enfant ne les lit jamais —
//   voir ASSUMPTIONS.md « Point de réconciliation »). `SuccessFlow` n'est pas utilisé
//   (son bouton "continuer" n'a pas de récepteur clair tant que E3 n'existe
//   pas) : `ChallengeFeedback` + `PostSuccessReplay` sont composés
//   directement, comme le fait implicitement Reorder pour la relecture.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChallengeComponentProps } from '../shared/contract'
import { TapTarget } from '../shared/TapTarget'
import { ChallengeFeedback } from '../shared/feedback'
import { PostSuccessReplay } from '../shared/postSuccessReplay'
import { uiText } from '../../content/uiText'

type Outcome = 'idle' | 'correct' | 'incorrect'

export function ListenTouch({
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
  const spokenForChallengeRef = useRef<string | null>(null)
  const spokenHelpKeyRef = useRef<string | null>(null)

  // Nouveau défi : réarme le chronomètre de réponse et l'issue affichée.
  useEffect(() => {
    startedAtRef.current = Date.now()
    setOutcome('idle')
  }, [challenge.id])

  // Consigne : énoncer la cible une seule fois à l'apparition du défi.
  useEffect(() => {
    if (spokenForChallengeRef.current === challenge.id) return
    spokenForChallengeRef.current = challenge.id
    void speak(targetItem.text)
  }, [challenge.id, targetItem.text, speak])

  // Aide niveau 1 : énoncer le son du premier graphème de la cible, une
  // seule fois par (défi, niveau d'aide) — pas à chaque re-render.
  useEffect(() => {
    if (helpLevel < 1) return
    const key = `${challenge.id}:${helpLevel}`
    if (spokenHelpKeyRef.current === key) return
    spokenHelpKeyRef.current = key
    const firstGrapheme = targetItem.graphemeIds[0]
    if (firstGrapheme) void speak(firstGrapheme)
  }, [helpLevel, challenge.id, targetItem.graphemeIds, speak])

  // Aide niveau 2 : retire une carte distractrice (jamais la cible), au plus
  // une, pour ne jamais réduire l'affichage à moins de 2 cartes.
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

  return (
    <div className="listen-touch" data-testid="listen-touch" data-outcome={outcome}>
      <div role="group" aria-label="Cartes à écouter et toucher" className="listen-touch__cards" data-testid="listen-touch-cards">
        {visibleOptions.map((option) => {
          const item = resolveItem(option.contentItemId)
          const isTarget = option.contentItemId === challenge.targetItemId
          const highlighted = helpLevel >= 1 && isTarget
          const blinking = helpLevel >= 3 && isTarget

          return (
            <TapTarget
              key={option.id}
              onTap={() => handleTap(option.contentItemId)}
              label={item.text}
              selected={blinking}
              disabled={outcome === 'correct'}
              testId={`listen-touch-card-${option.id}`}
              className={blinking ? 'listen-touch__card listen-touch__card--blink' : 'listen-touch__card'}
              style={{
                fontSize: 40,
                padding: '16px 24px',
                backgroundColor: highlighted ? '#FFE38A' : '#EAF1F8',
              }}
            >
              {item.text}
            </TapTarget>
          )
        })}
      </div>

      {outcome === 'correct' && (
        <>
          <ChallengeFeedback
            outcome="success"
            companionPhrase={uiText.challenges.listenTouchSuccess}
            speak={speak}
            testId="listen-touch-feedback"
          />
          <PostSuccessReplay item={targetItem} speak={speak} testId="listen-touch-replay" />
        </>
      )}

      {outcome === 'incorrect' && (
        <ChallengeFeedback
          outcome="error"
          companionPhrase={uiText.challenges.listenTouchRetry}
          speak={speak}
          testId="listen-touch-feedback"
        />
      )}
    </div>
  )
}
