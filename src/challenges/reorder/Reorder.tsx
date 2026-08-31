// Mécanique de défi "Remets en ordre" (SPEC §6.5, niveau 8+) : replacer 2 à 4
// mots pour reconstituer une phrase entendue. Réutilise `useLiftAndPlace`
// (C1) au niveau du mot plutôt que de la lettre (comme pour Forge), via les
// mêmes primitives `TapTarget`.
//
// Décisions consignées (comportement non entièrement fixé par SPEC.md) :
// - La consigne énoncée est la phrase cible elle-même (`speak(item.text)`),
//   une seule fois à l'apparition du défi — la réécoute (bouton oreille) est
//   un élément de chrome hors du périmètre de ce composant (contract.ts).
// - Un "essai" est une pose complète de tous les emplacements
//   (`isComplete === true`). `onAnswer` est appelé une fois par essai, y
//   compris les essais ratés (contract.ts). Aucun bouton "réessayer" séparé
//   n'est nécessaire : `useLiftAndPlace` renvoie déjà une pièce posée à la
//   réserve quand on la retouche, donc corriger un essai raté revient à
//   retoucher une pièce mal placée puis reposer les emplacements vidés — un
//   nouvel essai (nouvel appel à `onAnswer`) se déclenche à la complétion
//   suivante.
// - Une fois un essai CORRECT obtenu, l'interaction est verrouillée
//   (`locked`) : la phrase reconstituée reste affichée telle quelle, plutôt
//   que de permettre à l'enfant de la redéfaire par erreur pendant que le
//   moteur de quête (E3, pas encore livré) enchaîne sur la suite.
// - Ce composant ne rend PAS de rétroaction visuelle de réussite/échec
//   (`ChallengeFeedback`/`SuccessFlow` de C1) : ces primitives exigent une
//   `companionPhrase` fournie par l'appelant et résolue depuis du contenu
//   (`src/content/*.json`, CLAUDE.md règle #2) que cette leaf ne possède pas
//   (OWNS: `src/challenges/reorder/**` uniquement) et que `Challenge` /
//   `ContentItem` (types.ts, FIGÉ) n'exposent pas pour ce défi. Composer une
//   phrase de compagnon en dur ici violerait la règle "aucun mot en dur dans
//   le code". La rétroaction reste donc la responsabilité de l'appelant, qui
//   reçoit `correct` via `onAnswer` et peut l'orchestrer avec le contenu dont
//   il dispose.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChallengeComponentProps } from '../shared/contract'
import { TapTarget } from '../shared/TapTarget'
import { useLiftAndPlace } from '../shared/liftAndPlace'
import { isCorrectOrder, shuffleWords, tokenizeSentence, type SentenceWordToken } from './words'

const getTokenId = (token: SentenceWordToken) => token.id

export function Reorder({ challenge, helpLevel, usedListenAgain, resolveItem, speak, onAnswer }: ChallengeComponentProps) {
  const item = resolveItem(challenge.targetItemId)

  // Découpage stable pour ce défi : ne change que si la phrase cible change
  // réellement (nouveau défi), jamais à chaque re-render.
  const targetTokens = useMemo(() => tokenizeSentence(item.text), [item.id, item.text])
  // Mélange tiré UNE fois par défi : `targetTokens` n'a une nouvelle
  // identité que quand le défi change, donc ce `useMemo` ne relance pas
  // `shuffleWords` (et son tirage aléatoire) à chaque re-render.
  const shuffledPieces = useMemo(() => shuffleWords(targetTokens), [targetTokens])

  const { reserve, slots, liftedPieceId, tapPiece, tapSlot, isComplete } = useLiftAndPlace(
    shuffledPieces,
    targetTokens.length,
    getTokenId,
  )

  const [locked, setLocked] = useState(false)
  const startedAtRef = useRef(Date.now())

  // Nouvelle tentative de défi : on réarme le chronomètre de réponse et le
  // verrou de réussite.
  useEffect(() => {
    startedAtRef.current = Date.now()
    setLocked(false)
  }, [challenge.id])

  // Consigne : énoncer la phrase cible une seule fois à l'apparition du défi.
  useEffect(() => {
    void speak(item.text)
    // Volontaire : ne re-énonce que si le défi change réellement (même
    // convention que PostSuccessReplay/SuccessFlow, C1) — pas à chaque
    // re-render qui recréerait `speak`/`item` par changement de référence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id])

  // Un essai = tous les emplacements occupés. On évalue et on notifie
  // `onAnswer` une fois par essai (y compris raté), jamais en continu.
  useEffect(() => {
    if (!isComplete || locked) return

    const correct = isCorrectOrder(slots, targetTokens)
    const responseMs = Date.now() - startedAtRef.current

    onAnswer({
      challengeId: challenge.id,
      correct,
      usedHelpLevel: helpLevel,
      usedListenAgain,
      responseMs,
    })

    if (correct) setLocked(true)
    // Volontaire : réagit uniquement à la transition de `isComplete`, pas à
    // chaque changement de référence de `slots`/`onAnswer` — un essai est un
    // événement ponctuel (complétion), pas un état continu à re-signaler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete])

  return (
    <div className="reorder-challenge" data-testid="reorder-challenge" data-locked={locked}>
      <div className="reorder-challenge__slots" data-testid="reorder-slots">
        {slots.map((placedToken, slotIndex) => (
          <TapTarget
            key={`slot-${slotIndex}`}
            label={placedToken ? `Reprendre le mot ${placedToken.display}` : `Emplacement ${slotIndex + 1}`}
            onTap={() => (placedToken ? tapPiece(placedToken.id) : tapSlot(slotIndex))}
            selected={placedToken !== null}
            disabled={locked}
            testId={`reorder-slot-${slotIndex}`}
            style={{ fontSize: 36, minWidth: 96 }}
          >
            {placedToken ? placedToken.display : ''}
          </TapTarget>
        ))}
      </div>

      <div className="reorder-challenge__reserve" data-testid="reorder-reserve">
        {reserve.map((token) => (
          <TapTarget
            key={token.id}
            label={`Mot ${token.display}`}
            onTap={() => tapPiece(token.id)}
            selected={liftedPieceId === token.id}
            disabled={locked}
            testId={`reorder-piece-${token.id}`}
            style={{ fontSize: 36, minWidth: 96 }}
          >
            {token.display}
          </TapTarget>
        ))}
      </div>
    </div>
  )
}
