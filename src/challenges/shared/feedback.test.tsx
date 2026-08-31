// Gate leaf-C1 G5 : la rétroaction de réussite/échec combine toujours
// forme + son + animation + phrase du compagnon ; aucun état ne s'appuie sur
// la seule couleur.
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ChallengeFeedback } from './feedback'

afterEach(cleanup)

describe('ChallengeFeedback — forme', () => {
  it('affiche une icône de silhouette différente pour succès et échec (pas seulement une couleur différente)', () => {
    const { unmount } = render(
      <ChallengeFeedback outcome="success" companionPhrase="Bravo !" reducedMotion />,
    )
    expect(screen.getByTestId('feedback-icon-success')).toBeInTheDocument()
    unmount()

    render(<ChallengeFeedback outcome="error" companionPhrase="On réessaie !" reducedMotion />)
    expect(screen.getByTestId('feedback-icon-error')).toBeInTheDocument()
  })

  it('les deux icônes ont des tracés SVG différents (silhouettes distinctes)', () => {
    const { container, unmount } = render(
      <ChallengeFeedback outcome="success" companionPhrase="Bravo !" reducedMotion />,
    )
    const successPath = container.querySelector('[data-testid="feedback-icon-success"] path')?.getAttribute('d')
    unmount()

    const { container: container2 } = render(
      <ChallengeFeedback outcome="error" companionPhrase="On réessaie !" reducedMotion />,
    )
    const errorPath = container2.querySelector('[data-testid="feedback-icon-error"] path')?.getAttribute('d')

    expect(successPath).toBeTruthy()
    expect(errorPath).toBeTruthy()
    expect(successPath).not.toBe(errorPath)
  })
})

describe('ChallengeFeedback — phrase du compagnon', () => {
  it('affiche la phrase fournie en prop, jamais un texte en dur', () => {
    render(<ChallengeFeedback outcome="success" companionPhrase="Tu es un champion des sons !" reducedMotion />)
    expect(screen.getByTestId('feedback-phrase')).toHaveTextContent('Tu es un champion des sons !')
  })
})

describe('ChallengeFeedback — son', () => {
  it('énonce la phrase du compagnon via speak() quand fourni', async () => {
    const speak = vi.fn().mockResolvedValue(undefined)
    render(<ChallengeFeedback outcome="success" companionPhrase="Bravo !" speak={speak} reducedMotion />)
    expect(speak).toHaveBeenCalledWith('Bravo !')
  })

  it("n'appelle pas speak() pour une phrase vide", () => {
    const speak = vi.fn().mockResolvedValue(undefined)
    render(<ChallengeFeedback outcome="success" companionPhrase="   " speak={speak} reducedMotion />)
    expect(speak).not.toHaveBeenCalled()
  })

  it('reste purement visuel sans planter si speak est absent', () => {
    expect(() =>
      render(<ChallengeFeedback outcome="error" companionPhrase="On réessaie !" reducedMotion />),
    ).not.toThrow()
  })
})

describe('ChallengeFeedback — animation', () => {
  it('applique une animation CSS différente selon l\'issue quand le mouvement réduit est désactivé', () => {
    const { unmount } = render(
      <ChallengeFeedback outcome="success" companionPhrase="Bravo !" reducedMotion={false} testId="fb" />,
    )
    const successAnimation = screen.getByTestId('fb').style.animation
    expect(successAnimation).not.toBe('none')
    unmount()

    render(<ChallengeFeedback outcome="error" companionPhrase="On réessaie !" reducedMotion={false} testId="fb2" />)
    const errorAnimation = screen.getByTestId('fb2').style.animation
    expect(errorAnimation).not.toBe('none')
    expect(errorAnimation).not.toBe(successAnimation)
  })

  it('désactive l\'animation quand prefers-reduced-motion est actif', () => {
    render(<ChallengeFeedback outcome="success" companionPhrase="Bravo !" reducedMotion testId="fb" />)
    expect(screen.getByTestId('fb').style.animation).toBe('none')
  })
})

describe('ChallengeFeedback — pas de couleur seule', () => {
  it('le marqueur data-outcome est présent en plus de toute couleur, pour un état identifiable sans couleur', () => {
    render(<ChallengeFeedback outcome="error" companionPhrase="On réessaie !" reducedMotion testId="fb" />)
    const el = screen.getByTestId('fb')
    expect(el.dataset.outcome).toBe('error')
    // Forme distincte présente indépendamment de toute couleur.
    expect(screen.getByTestId('feedback-icon-error')).toBeInTheDocument()
    // Texte (phrase du compagnon) présent indépendamment de toute couleur.
    expect(screen.getByTestId('feedback-phrase')).toHaveTextContent('On réessaie !')
  })
})
