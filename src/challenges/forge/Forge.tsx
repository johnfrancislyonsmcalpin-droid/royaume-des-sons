// Mécanique de défi "Forge" (SPEC §6.2) : assembler des pièces (lettres ou
// syllabes) pour former ce qu'on entend ou ce que l'image montre.
// Réutilise `useLiftAndPlace` (C1) au niveau du graphème — aucune
// ré-implémentation locale de glisser-déposer (tâche C3, même principe que
// `src/challenges/reorder/Reorder.tsx`, C4, au niveau du mot).
//
// Décisions consignées (comportement non entièrement fixé par SPEC.md) :
// - La consigne énoncée est le texte cible lui-même (`speak(item.text)`),
//   une seule fois à l'apparition du défi — même convention que Reorder
//   (C4). L'image (`item.emoji`, si présent) est affichée en complément :
//   SPEC §6.2 dit "ce qu'on entend OU ce que l'image montre", les deux
//   canaux sont donc couverts sans coût supplémentaire quand l'un des deux
//   est absent du contenu.
// - Une pièce posée au MAUVAIS emplacement n'est JAMAIS réellement déposée
//   dans l'état de `useLiftAndPlace` : on vérifie l'exactitude AVANT
//   d'appeler `tapSlot`, on ne l'appelle que pour un placement correct.
//   Pour un placement incorrect, la pièce reste déjà "en réserve" du point
//   de vue de la primitive (soulever ne la retire pas de la réserve, voir
//   liftAndPlace.ts) : on se contente d'annuler la levée (`tapPiece` sur la
//   même pièce, qui bascule la levée à `null`) et de déclencher la
//   rétroaction douce (son + animation). Ce choix évite toute dépendance à
//   un minuteur différé qui manipulerait l'état de la primitive après coup
//   (risque de fermeture obsolète si le défi change entre-temps) tout en
//   respectant SPEC §6.2 : la pièce "retourne à sa réserve" — elle n'en est
//   jamais réellement sortie.
// - Un graphème cible peut apparaître plusieurs fois (ex. "papa" -> p,a,p,a) :
//   deux pièces différentes de même valeur sont interchangeables pour une
//   position qui attend cette valeur (comportement voulu, pas un défaut).
// - `onAnswer` n'est appelé qu'UNE fois, avec `correct: true`, quand tous
//   les emplacements sont remplis et forment exactement la cible (tâche
//   C3). Contrairement à Reorder (qui autorise un essai complet incorrect
//   et notifie `correct: false`), ce scénario est structurellement
//   impossible ici : une pièce mal placée est rejetée avant de pouvoir
//   coexister avec les autres pour former un assemblage "complet" — il n'y
//   a donc jamais d'essai raté à notifier.
// - Une fois un assemblage CORRECT obtenu, l'interaction est verrouillée
//   (`locked`, même convention que Reorder/C4) : les pièces posées restent
//   affichées telles quelles, plutôt que de permettre à l'enfant de défaire
//   par erreur un assemblage déjà réussi et déjà notifié via `onAnswer`.
// - Ce composant ne rend PAS de rétroaction de réussite (`ChallengeFeedback`
//   / `SuccessFlow` de C1) : ces primitives exigent une `companionPhrase`
//   fournie par l'appelant et résolue depuis du contenu
//   (`src/content/*.json`, CLAUDE.md règle #2) que cette leaf ne possède pas
//   (OWNS : `src/challenges/forge/**` uniquement) et que `Challenge` /
//   `ContentItem` (types.ts, FIGÉ) n'exposent pas pour ce défi — même
//   décision que Reorder (C4). La rétroaction de succès reste la
//   responsabilité de l'appelant, qui reçoit `correct` via `onAnswer`.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChallengeComponentProps } from '../shared/contract'
import { TapTarget } from '../shared/TapTarget'
import { useLiftAndPlace } from '../shared/liftAndPlace'
import { buildForgePieces, type ForgePiece } from './pieces'
import { playSoftReturnSound } from './softReturnSound'

const getPieceId = (piece: ForgePiece) => piece.id

/** Durée (ms) pendant laquelle l'emplacement visé par un placement raté
 * affiche la rétroaction douce (contour/animation), avant de revenir à son
 * état normal. Purement visuel : n'affecte jamais l'état de la primitive. */
const WRONG_PLACEMENT_FEEDBACK_MS = 400

// Animation CSS de la "petite animation" douce (SPEC §6.2) accompagnant le
// retour en réserve d'une pièce mal placée — un léger balancement, jamais
// un tremblement violent ni une croix (SPEC §2 : l'échec reste doux).
// Feuille de style inline injectée une seule fois, même convention que
// `ChallengeFeedback` (C1, feedback.tsx) : pas de fichier CSS séparé à
// charger, pas de CDN (CLAUDE.md règle #5).
const WRONG_SLOT_ANIMATION = 'forge-wrong-slot-wobble'
const FORGE_STYLE_ID = 'forge-wrong-slot-keyframes'
function ensureWrongSlotStyleInjected() {
  if (typeof document === 'undefined') return
  if (document.getElementById(FORGE_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = FORGE_STYLE_ID
  style.textContent = `
@keyframes ${WRONG_SLOT_ANIMATION} {
  0% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-3px); }
  100% { transform: translateX(0); }
}`
  document.head.appendChild(style)
}

function detectReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

export function Forge({ challenge, helpLevel, usedListenAgain, resolveItem, speak, onAnswer }: ChallengeComponentProps) {
  const item = resolveItem(challenge.targetItemId)

  // Pièces mélangées, tirées UNE fois par défi (cible + distracteurs
  // éligibles de challenge.options — voir pieces.ts). `challenge.id` est la
  // seule dépendance volontaire : re-résoudre `item`/`challenge.options` au
  // même défi ne doit jamais relancer le mélange.
  const pieces = useMemo(
    () => buildForgePieces(item, challenge.options, resolveItem),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [challenge.id],
  )

  const { reserve, slots, liftedPieceId, tapPiece, tapSlot, isComplete } = useLiftAndPlace(
    pieces,
    item.graphemeIds.length,
    getPieceId,
  )

  const [wrongSlotIndex, setWrongSlotIndex] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)
  const wrongFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const answeredRef = useRef(false)
  const startedAtRef = useRef(Date.now())

  useEffect(() => {
    ensureWrongSlotStyleInjected()
  }, [])

  // Nouveau défi : réarme le chronomètre de réponse et les verrous, et
  // efface toute rétroaction de placement raté encore affichée.
  useEffect(() => {
    startedAtRef.current = Date.now()
    answeredRef.current = false
    setLocked(false)
    setWrongSlotIndex(null)
    if (wrongFeedbackTimeoutRef.current) clearTimeout(wrongFeedbackTimeoutRef.current)
  }, [challenge.id])

  useEffect(() => {
    return () => {
      if (wrongFeedbackTimeoutRef.current) clearTimeout(wrongFeedbackTimeoutRef.current)
    }
  }, [])

  // Consigne : énoncer le texte cible une seule fois à l'apparition du défi
  // (même convention que Reorder/C4 — ne re-énonce que si le défi change
  // réellement, pas à chaque re-render qui recréerait `speak`/`item` par
  // changement de référence).
  useEffect(() => {
    void speak(item.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.id])

  // G3 : onAnswer(correct: true) seulement quand l'assemblage est complet ET
  // exact (voir décision ci-dessus : un assemblage complet mais incorrect
  // est structurellement impossible, mais on revérifie explicitement plutôt
  // que de faire confiance à cette seule invariance).
  useEffect(() => {
    if (!isComplete || answeredRef.current) return
    const isFullyCorrect = slots.every(
      (piece, index) => piece !== null && piece.graphemeId === item.graphemeIds[index],
    )
    if (!isFullyCorrect) return

    answeredRef.current = true
    onAnswer({
      challengeId: challenge.id,
      correct: true,
      usedHelpLevel: helpLevel,
      usedListenAgain,
      responseMs: Date.now() - startedAtRef.current,
    })
    setLocked(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete])

  const handleSlotTap = (slotIndex: number) => {
    if (locked) return
    const placedPiece = slots[slotIndex]

    if (placedPiece) {
      // Emplacement déjà occupé : le retoucher renvoie sa pièce à la
      // réserve (comportement de la primitive pour une pièce déjà posée).
      tapPiece(placedPiece.id)
      return
    }

    if (liftedPieceId === null) return // rien en main : no-op, cohérent avec la primitive

    const liftedPiece = pieces.find((piece) => piece.id === liftedPieceId)
    if (!liftedPiece) return

    const expectedGraphemeId = item.graphemeIds[slotIndex]
    if (liftedPiece.graphemeId === expectedGraphemeId) {
      tapSlot(slotIndex) // placement correct : posé pour de bon
      return
    }

    // Placement incorrect (G2) : jamais posé dans l'état de la primitive.
    // La pièce reste en réserve (soulever ne l'en retire pas) ; on annule
    // simplement la levée et on déclenche la rétroaction douce — "pas un
    // échec compté, pas de pénalité" (aucun appel à onAnswer ici).
    tapPiece(liftedPieceId) // bascule : annule la levée de la même pièce
    playSoftReturnSound()
    setWrongSlotIndex(slotIndex)
    if (wrongFeedbackTimeoutRef.current) clearTimeout(wrongFeedbackTimeoutRef.current)
    wrongFeedbackTimeoutRef.current = setTimeout(() => {
      setWrongSlotIndex((current) => (current === slotIndex ? null : current))
    }, WRONG_PLACEMENT_FEEDBACK_MS)
  }

  return (
    <div className="forge" data-testid="forge" data-complete={isComplete} data-locked={locked}>
      {item.emoji ? (
        <div className="forge__image" data-testid="forge-image" aria-hidden="true">
          {item.emoji}
        </div>
      ) : null}

      <div className="forge__slots" data-testid="forge-slots">
        {slots.map((placedPiece, slotIndex) => (
          <TapTarget
            key={`slot-${slotIndex}`}
            label={placedPiece ? `Reprendre la pièce ${placedPiece.graphemeId}` : `Emplacement ${slotIndex + 1}`}
            onTap={() => handleSlotTap(slotIndex)}
            selected={placedPiece !== null}
            disabled={locked}
            testId={`forge-slot-${slotIndex}`}
            className={wrongSlotIndex === slotIndex ? 'forge-slot--wrong' : undefined}
            style={{
              fontSize: 36,
              minWidth: 72,
              animation:
                wrongSlotIndex === slotIndex && !detectReducedMotion()
                  ? `${WRONG_SLOT_ANIMATION} 300ms ease-out`
                  : undefined,
            }}
          >
            {placedPiece ? placedPiece.graphemeId : ''}
          </TapTarget>
        ))}
      </div>

      <div className="forge__reserve" data-testid="forge-reserve">
        {reserve.map((piece) => (
          <TapTarget
            key={piece.id}
            label={`Pièce ${piece.graphemeId}`}
            onTap={() => tapPiece(piece.id)}
            selected={liftedPieceId === piece.id}
            disabled={locked}
            testId={`forge-piece-${piece.id}`}
            style={{ fontSize: 36, minWidth: 72 }}
          >
            {piece.graphemeId}
          </TapTarget>
        ))}
      </div>
    </div>
  )
}
