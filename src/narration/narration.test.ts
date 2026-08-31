// G-A4 / G1 : chaque écran enregistré déclare une narration non vide ; un écran
// de test délibérément sans narration fait échouer le contrôle (contrôle positif
// ET négatif).

import { describe, it, expect, beforeEach } from 'vitest'
import type { NarrationRequest } from '../types'
import { registerScreen, clearScreenRegistry, verifyScreenNarration } from './registry'

// « Écran de test » : le registre n'a aucune idée de React, donc on simule le
// montage d'un écran comme une simple fonction qui s'enregistre (ou non) — le
// même chemin de code que `useScreenNarration` emprunte réellement au montage
// (voir autoTrigger.test.tsx pour la version qui monte un vrai composant React
// et vérifie le déclenchement automatique).

function mountScreenWithNarration(screenId: string, text: string): void {
  const request: NarrationRequest = {
    id: screenId,
    text,
    priority: 'screen-intro',
    interruptible: true,
  }
  registerScreen(screenId, () => request)
}

// Contrôle négatif délibéré : cet « écran » ne s'enregistre JAMAIS. Un
// développeur qui oublie d'appeler useScreenNarration produit exactement ce
// comportement.
function mountScreenWithoutNarration(): void {
  // volontairement vide — aucun registerScreen ici
}

describe('registre de narration d’écran (G-A4 / G1)', () => {
  beforeEach(() => {
    clearScreenRegistry()
  })

  it('contrôle positif : un écran qui déclare sa narration passe la vérification', () => {
    mountScreenWithNarration('clairiere-intro', 'Bienvenue dans la clairière des voyelles.')

    const violations = verifyScreenNarration(['clairiere-intro'])

    expect(violations).toEqual([])
  })

  it('contrôle négatif : un écran qui oublie de déclarer sa narration est détecté', () => {
    mountScreenWithoutNarration()

    const violations = verifyScreenNarration(['ecran-sans-narration'])

    expect(violations).toHaveLength(1)
    expect(violations[0]).toMatchObject({ screenId: 'ecran-sans-narration' })
    expect(violations[0].reason).toMatch(/non enregistré/)
  })

  it('détecte un écran enregistré dont la narration est un texte vide', () => {
    registerScreen('ecran-texte-vide', () => ({
      id: 'ecran-texte-vide',
      text: '   ',
      priority: 'screen-intro',
      interruptible: true,
    }))

    const violations = verifyScreenNarration(['ecran-texte-vide'])

    expect(violations).toHaveLength(1)
    expect(violations[0].reason).toMatch(/vide/)
  })

  it('détecte un écran dont la fabrique de narration lève une erreur', () => {
    registerScreen('ecran-qui-plante', () => {
      throw new Error('contenu manquant')
    })

    const violations = verifyScreenNarration(['ecran-qui-plante'])

    expect(violations).toHaveLength(1)
    expect(violations[0].screenId).toBe('ecran-qui-plante')
  })

  it('vérifie plusieurs écrans à la fois et ne signale que ceux en violation', () => {
    mountScreenWithNarration('ecran-ok-1', 'Texte narré un.')
    mountScreenWithNarration('ecran-ok-2', 'Texte narré deux.')
    mountScreenWithoutNarration()

    const violations = verifyScreenNarration(['ecran-ok-1', 'ecran-ok-2', 'ecran-manquant'])

    expect(violations).toHaveLength(1)
    expect(violations[0].screenId).toBe('ecran-manquant')
  })

  it('un écran non attendu et non enregistré ne fait pas échouer la liste vide', () => {
    const violations = verifyScreenNarration([])

    expect(violations).toEqual([])
  })

  it('getRegisteredScreenIds reflète le registre courant', async () => {
    const { getRegisteredScreenIds } = await import('./registry')
    mountScreenWithNarration('ecran-a', 'Texte a.')
    mountScreenWithNarration('ecran-b', 'Texte b.')

    expect(getRegisteredScreenIds().sort()).toEqual(['ecran-a', 'ecran-b'])
  })
})
