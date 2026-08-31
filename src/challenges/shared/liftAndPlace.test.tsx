// Gate leaf-C1 G3 : la primitive touch-lift/touch-place lève une pièce au
// premier toucher et la pose au toucher d'un emplacement ; toucher une pièce
// déjà posée la renvoie à sa réserve.
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useLiftAndPlace } from './liftAndPlace'

interface Letter {
  id: string
  char: string
}

const LETTERS: Letter[] = [
  { id: 'p1', char: 'm' },
  { id: 'p2', char: 'a' },
  { id: 'p3', char: 't' },
]

const getId = (piece: Letter) => piece.id

describe('useLiftAndPlace — état initial', () => {
  it('place toutes les pièces en réserve, aucun emplacement occupé, rien de soulevé', () => {
    const { result } = renderHook(() => useLiftAndPlace(LETTERS, 3, getId))
    expect(result.current.reserve).toEqual(LETTERS)
    expect(result.current.slots).toEqual([null, null, null])
    expect(result.current.liftedPieceId).toBeNull()
    expect(result.current.isComplete).toBe(false)
  })
})

describe('useLiftAndPlace — toucher une pièce', () => {
  it('soulève la pièce au premier toucher', () => {
    const { result } = renderHook(() => useLiftAndPlace(LETTERS, 3, getId))
    act(() => result.current.tapPiece('p1'))
    expect(result.current.liftedPieceId).toBe('p1')
  })

  it('reposer la même pièce en réserve annule la levée (bascule)', () => {
    const { result } = renderHook(() => useLiftAndPlace(LETTERS, 3, getId))
    act(() => result.current.tapPiece('p1'))
    act(() => result.current.tapPiece('p1'))
    expect(result.current.liftedPieceId).toBeNull()
  })

  it('toucher une autre pièce de réserve remplace la pièce soulevée', () => {
    const { result } = renderHook(() => useLiftAndPlace(LETTERS, 3, getId))
    act(() => result.current.tapPiece('p1'))
    act(() => result.current.tapPiece('p2'))
    expect(result.current.liftedPieceId).toBe('p2')
  })

  it('un id inconnu ne fait rien et ne lève pas d\'exception', () => {
    const { result } = renderHook(() => useLiftAndPlace(LETTERS, 3, getId))
    expect(() => act(() => result.current.tapPiece('inconnu'))).not.toThrow()
    expect(result.current.liftedPieceId).toBeNull()
  })
})

describe('useLiftAndPlace — toucher un emplacement', () => {
  it('pose la pièce soulevée sur un emplacement libre, la retire de la réserve, et lâche la levée', () => {
    const { result } = renderHook(() => useLiftAndPlace(LETTERS, 3, getId))
    act(() => result.current.tapPiece('p1'))
    act(() => result.current.tapSlot(0))

    expect(result.current.slots[0]).toEqual({ id: 'p1', char: 'm' })
    expect(result.current.reserve.map(getId)).not.toContain('p1')
    expect(result.current.liftedPieceId).toBeNull()
  })

  it("toucher un emplacement sans rien avoir soulevé ne fait rien", () => {
    const { result } = renderHook(() => useLiftAndPlace(LETTERS, 3, getId))
    act(() => result.current.tapSlot(0))
    expect(result.current.slots).toEqual([null, null, null])
  })

  it('toucher un emplacement déjà occupé pendant une levée ne remplace pas la pièce en place', () => {
    const { result } = renderHook(() => useLiftAndPlace(LETTERS, 3, getId))
    act(() => result.current.tapPiece('p1'))
    act(() => result.current.tapSlot(0))
    act(() => result.current.tapPiece('p2'))
    act(() => result.current.tapSlot(0))

    expect(result.current.slots[0]).toEqual({ id: 'p1', char: 'm' })
    // La pièce p2 reste soulevée : le tap sur l'emplacement occupé a été ignoré.
    expect(result.current.liftedPieceId).toBe('p2')
  })

  it('un index hors limites ne fait rien et ne lève pas d\'exception', () => {
    const { result } = renderHook(() => useLiftAndPlace(LETTERS, 3, getId))
    act(() => result.current.tapPiece('p1'))
    expect(() => act(() => result.current.tapSlot(99))).not.toThrow()
    expect(() => act(() => result.current.tapSlot(-1))).not.toThrow()
    expect(result.current.liftedPieceId).toBe('p1')
  })
})

describe('useLiftAndPlace — pièce déjà posée', () => {
  it('toucher une pièce déjà posée la renvoie à sa réserve', () => {
    const { result } = renderHook(() => useLiftAndPlace(LETTERS, 3, getId))
    act(() => result.current.tapPiece('p1'))
    act(() => result.current.tapSlot(0))
    act(() => result.current.tapPiece('p1'))

    expect(result.current.slots[0]).toBeNull()
    expect(result.current.reserve.map(getId)).toContain('p1')
    expect(result.current.liftedPieceId).toBeNull()
  })
})

describe('useLiftAndPlace — assemblage complet', () => {
  it('isComplete devient vrai seulement quand tous les emplacements sont occupés', () => {
    const { result } = renderHook(() => useLiftAndPlace(LETTERS, 3, getId))
    act(() => result.current.tapPiece('p1'))
    act(() => result.current.tapSlot(0))
    expect(result.current.isComplete).toBe(false)

    act(() => result.current.tapPiece('p2'))
    act(() => result.current.tapSlot(1))
    expect(result.current.isComplete).toBe(false)

    act(() => result.current.tapPiece('p3'))
    act(() => result.current.tapSlot(2))
    expect(result.current.isComplete).toBe(true)
  })

  it('reset() revient à l\'état initial', () => {
    const { result } = renderHook(() => useLiftAndPlace(LETTERS, 3, getId))
    act(() => result.current.tapPiece('p1'))
    act(() => result.current.tapSlot(0))
    act(() => result.current.reset())

    expect(result.current.reserve).toEqual(LETTERS)
    expect(result.current.slots).toEqual([null, null, null])
    expect(result.current.liftedPieceId).toBeNull()
    expect(result.current.isComplete).toBe(false)
  })
})

describe('useLiftAndPlace — cas 0 pièce', () => {
  it('0 pièce et 0 emplacement : état cohérent, aucun tap ne lève d\'exception', () => {
    const { result } = renderHook(() => useLiftAndPlace<Letter>([], 0, getId))
    expect(result.current.reserve).toEqual([])
    expect(result.current.slots).toEqual([])
    expect(result.current.isComplete).toBe(false)

    expect(() => act(() => result.current.tapPiece('p1'))).not.toThrow()
    expect(() => act(() => result.current.tapSlot(0))).not.toThrow()
  })
})
