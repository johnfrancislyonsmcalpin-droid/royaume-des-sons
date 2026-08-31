// Relecture post-succès (SPEC §6 : "Après une bonne réponse, le jeu relit le
// mot ou la phrase en surlignant les syllabes une à une — c'est la
// modélisation du décodage, elle ne doit jamais être sautée."). Gate C1:G4.
//
// La table de prononciation (B3, `src/content/pronunciation.json`) n'est pas
// encore livrée au moment où C1 est écrite (dispatch en parallèle, voir
// PLAN.md). Ce module accepte donc `resolvePronunciation` en injection :
// - Fourni (intégration réelle) : chaque `graphemeId` de `item.graphemeIds`
//   est résolu vers le texte à énoncer (ex. "m" -> "mmm"), exactement comme
//   l'exige SPEC §3 ("le son de m est énoncé mmm et non ème").
// - Absent (repli documenté pour ASSUMPTIONS.md) : le `graphemeId` lui-même
//   est énoncé tel quel. C'est correct pour un graphème simple dont l'id EST
//   la lettre/le groupe littéral ("a", "ch", "eau"...) mais PAS pour un id
//   synthétique comme "e-muet" (qui serait énoncé "e-muet" au lieu du son
//   attendu) — limite connue, à ne jamais utiliser sans `resolvePronunciation`
//   au-delà de tests/prototypage.
// Même repli, même raison, pour l'affichage : `renderGrapheme` (optionnel)
// permet à un appelant averti de personnaliser le libellé visuel d'un
// graphème (ex. afficher "e" pour l'id "e-muet" avec un style atténué) ; par
// défaut le `graphemeId` littéral est affiché.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ContentItem } from '../../types'
import type { ChallengeSpeakFn } from './contract'
import { ChallengeFeedback } from './feedback'
import { TapTarget } from './TapTarget'

export interface PostSuccessReplayProps {
  item: ContentItem
  speak: ChallengeSpeakFn
  resolvePronunciation?: (graphemeId: string) => string
  renderGrapheme?: (graphemeId: string) => string
  /** Appelé une fois après le dernier graphème énoncé (jamais avant, jamais si
   * la relecture est interrompue par un démontage). */
  onComplete?: () => void
  /** Démarre automatiquement au montage / au changement d'item. `false`
   * seulement pour un déclenchement manuel exceptionnel (hors chemin normal du
   * jeu, où la relecture ne doit jamais être sautée). */
  autoStart?: boolean
  testId?: string
}

const identity = (graphemeId: string) => graphemeId

export function PostSuccessReplay({
  item,
  speak,
  resolvePronunciation,
  renderGrapheme = identity,
  onComplete,
  autoStart = true,
  testId,
}: PostSuccessReplayProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  // Compteur de génération : incrémenté au démontage ou avant un nouveau run,
  // pour qu'un `await speak()` qui résout tardivement (défi déjà quitté)
  // n'aille pas mettre à jour l'état d'un composant obsolète ni appeler
  // `onComplete` en double.
  const generationRef = useRef(0)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const graphemeIds = item.graphemeIds

  const run = useCallback(async () => {
    const generation = ++generationRef.current
    setIsComplete(false)

    for (let index = 0; index < graphemeIds.length; index += 1) {
      if (generationRef.current !== generation) return
      setActiveIndex(index)
      const graphemeId = graphemeIds[index]
      const spokenText = resolvePronunciation ? resolvePronunciation(graphemeId) : graphemeId
      await speak(spokenText)
    }

    if (generationRef.current !== generation) return
    setActiveIndex(null)
    setIsComplete(true)
    onCompleteRef.current?.()
  }, [graphemeIds, resolvePronunciation, speak])

  useEffect(() => {
    if (!autoStart) return undefined
    void run()
    return () => {
      generationRef.current += 1
    }
    // Volontaire : ne redémarre que quand l'item change réellement (nouvel
    // identifiant), pas à chaque re-render qui recréerait `run` par
    // changement de référence de `speak`/`resolvePronunciation`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, autoStart])

  return (
    <div className="post-success-replay" data-testid={testId} data-complete={isComplete}>
      {graphemeIds.map((graphemeId, index) => (
        <span
          // eslint-disable-next-line react/no-array-index-key -- même graphemeId peut apparaître deux fois dans un mot (ex. "papa" -> ["p","a","p","a"])
          key={`${graphemeId}-${index}`}
          data-testid={`replay-grapheme-${index}`}
          data-active={activeIndex === index}
          style={{
            display: 'inline-block',
            fontSize: 44,
            padding: '4px 10px',
            margin: '0 2px',
            borderRadius: 8,
            backgroundColor: activeIndex === index ? '#FFE38A' : 'transparent',
            outline: activeIndex === index ? '3px solid #B9860A' : 'none',
          }}
        >
          {renderGrapheme(graphemeId)}
        </span>
      ))}
    </div>
  )
}

export interface SuccessFlowProps {
  item: ContentItem
  /** Phrase du compagnon pour la rétroaction de réussite — fournie par
   * l'appelant (contenu), jamais en dur ici. */
  companionPhrase: string
  speak: ChallengeSpeakFn
  /** Libellé accessible du bouton "continuer" — fourni par l'appelant
   * (contenu), pour respecter CLAUDE.md règle #2 : aucun mot en dur ici. */
  continueLabel: string
  onContinue: () => void
  resolvePronunciation?: (graphemeId: string) => string
  renderGrapheme?: (graphemeId: string) => string
  testId?: string
}

/**
 * Compose la rétroaction de réussite (`ChallengeFeedback`) et la relecture
 * post-succès (`PostSuccessReplay`), et matérialise la règle "jamais sautée"
 * (SPEC §6) : le bouton "continuer" reste désactivé tant que la relecture
 * n'est pas arrivée à son terme. C2/C3/C4 réutilisent ce composant plutôt que
 * de recomposer indépendamment feedback + relecture + condition de passage.
 */
export function SuccessFlow({
  item,
  companionPhrase,
  speak,
  continueLabel,
  onContinue,
  resolvePronunciation,
  renderGrapheme,
  testId,
}: SuccessFlowProps) {
  const [replayDone, setReplayDone] = useState(false)

  const handleReplayComplete = useCallback(() => setReplayDone(true), [])

  return (
    <div className="success-flow" data-testid={testId}>
      <ChallengeFeedback outcome="success" companionPhrase={companionPhrase} speak={speak} />
      <PostSuccessReplay
        item={item}
        speak={speak}
        resolvePronunciation={resolvePronunciation}
        renderGrapheme={renderGrapheme}
        onComplete={handleReplayComplete}
        testId={testId ? `${testId}-replay` : 'success-flow-replay'}
      />
      <TapTarget
        onTap={onContinue}
        label={continueLabel}
        disabled={!replayDone}
        testId={testId ? `${testId}-continue` : 'success-flow-continue'}
      >
        {continueLabel}
      </TapTarget>
    </div>
  )
}
