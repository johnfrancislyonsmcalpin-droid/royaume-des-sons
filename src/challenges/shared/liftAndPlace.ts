// Primitive touch-lift/touch-place partagée par Forge (C3) et Remets en
// ordre (C4) — SPEC §3 / §6.2 : "on touche une pièce (elle se soulève), on
// touche un emplacement (elle s'y pose). Toucher une pièce déjà posée la
// renvoie à sa réserve." Générique sur le type de pièce : des lettres pour
// Forge, des mots pour Remets en ordre.
//
// Décisions consignées pour ASSUMPTIONS.md (le comportement exact n'est pas
// entièrement spécifié par SPEC.md, ce module fixe le contrat que C3/C4
// implémenteront tel quel) :
// - Toucher une pièce de réserve différente pendant qu'une autre est déjà
//   soulevée change simplement la pièce soulevée (bascule), plutôt que
//   d'ignorer le tap : un enfant qui change d'avis ne doit pas être bloqué.
// - Toucher un emplacement déjà occupé pendant qu'une pièce est soulevée est
//   un no-op : il faut d'abord libérer l'emplacement en touchant la pièce qui
//   s'y trouve (qui la renvoie à la réserve), pour ne jamais faire disparaître
//   silencieusement une pièce déjà placée.
// - Toucher un emplacement vide sans aucune pièce soulevée est un no-op.
// - 0 pièce / 0 emplacement : état initial cohérent (réserve vide, aucun
//   emplacement), tous les taps sont des no-op silencieux, jamais d'exception.
import { useCallback, useMemo, useState } from 'react'

export interface LiftAndPlaceState<TPiece> {
  /** Pièces encore dans la réserve, dans leur ordre d'origine. */
  reserve: TPiece[]
  /** Un élément par emplacement : la pièce qui y est posée, ou `null`. */
  slots: Array<TPiece | null>
  /** Id de la pièce actuellement soulevée (en main), ou `null`. */
  liftedPieceId: string | null
}

export interface UseLiftAndPlaceResult<TPiece> extends LiftAndPlaceState<TPiece> {
  /** Toucher une pièce : la soulève, la repose en réserve si elle est déjà
   * soulevée, ou la renvoie en réserve si elle est déjà posée sur un
   * emplacement. Sans effet sur un id inconnu. */
  tapPiece: (pieceId: string) => void
  /** Toucher un emplacement : y pose la pièce actuellement soulevée, s'il y en
   * a une et que l'emplacement est libre. Sans effet sinon (voir décisions
   * ci-dessus) ou sur un index hors limites. */
  tapSlot: (slotIndex: number) => void
  /** Revient à l'état initial : toutes les pièces en réserve, rien de posé. */
  reset: () => void
  /** Vrai quand tous les emplacements sont occupés. */
  isComplete: boolean
}

export function useLiftAndPlace<TPiece>(
  pieces: TPiece[],
  slotCount: number,
  getId: (piece: TPiece) => string,
): UseLiftAndPlaceResult<TPiece> {
  // `placedIds[i]` = id de la pièce posée à l'emplacement i, ou null.
  const [placedIds, setPlacedIds] = useState<Array<string | null>>(() =>
    Array.from({ length: Math.max(0, slotCount) }, () => null),
  )
  const [liftedPieceId, setLiftedPieceId] = useState<string | null>(null)

  const pieceById = useMemo(() => {
    const map = new Map<string, TPiece>()
    for (const piece of pieces) map.set(getId(piece), piece)
    return map
  }, [pieces, getId])

  const placedIdSet = useMemo(() => new Set(placedIds.filter((id): id is string => id !== null)), [placedIds])

  const reserve = useMemo(() => pieces.filter((piece) => !placedIdSet.has(getId(piece))), [pieces, placedIdSet, getId])

  const slots = useMemo<Array<TPiece | null>>(
    () => placedIds.map((id) => (id === null ? null : (pieceById.get(id) ?? null))),
    [placedIds, pieceById],
  )

  const tapPiece = useCallback(
    (pieceId: string) => {
      if (!pieceById.has(pieceId)) return // id inconnu : no-op

      const placedIndex = placedIds.indexOf(pieceId)
      if (placedIndex !== -1) {
        // Pièce déjà posée : la renvoyer à la réserve (comportement imposé
        // par SPEC §3), quel que soit l'état de levée courant.
        setPlacedIds((prev) => prev.map((id, index) => (index === placedIndex ? null : id)))
        return
      }

      // Pièce en réserve : bascule (soulève, ou repose si déjà soulevée),
      // et remplace toute autre pièce actuellement soulevée.
      setLiftedPieceId((prev) => (prev === pieceId ? null : pieceId))
    },
    [pieceById, placedIds],
  )

  const tapSlot = useCallback(
    (slotIndex: number) => {
      if (slotIndex < 0 || slotIndex >= placedIds.length) return // hors limites : no-op
      if (liftedPieceId === null) return // rien en main : no-op
      if (placedIds[slotIndex] !== null) return // emplacement occupé : no-op

      setPlacedIds((prev) => prev.map((id, index) => (index === slotIndex ? liftedPieceId : id)))
      setLiftedPieceId(null)
    },
    [liftedPieceId, placedIds],
  )

  const reset = useCallback(() => {
    setPlacedIds(Array.from({ length: Math.max(0, slotCount) }, () => null))
    setLiftedPieceId(null)
  }, [slotCount])

  const isComplete = placedIds.length > 0 && placedIds.every((id) => id !== null)

  return { reserve, slots, liftedPieceId, tapPiece, tapSlot, reset, isComplete }
}
