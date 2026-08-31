// Gate leaf-A1 G1 : le navigateur d'écrans affiche exactement un écran à la
// fois, démarre sur l'écran « Jouer », et ne référence jamais
// window.location/URL pour décider de l'écran affiché.
import { afterEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import {
  ScreenNavigator,
  type ScreenDefinition,
  type ScreenNavigatorApi,
} from './ScreenNavigator'
import { AppShell, INITIAL_SCREEN_ID } from './AppShell'
// Import brut du code source : permet de vérifier statiquement, sans deviner
// le comportement à l'exécution, que ces fichiers ne consultent jamais
// window.location/URL pour décider quel écran afficher (SPEC §2 : rien ne
// dépend de la lecture, donc certainement pas d'une adresse).
import screenNavigatorSource from './ScreenNavigator.tsx?raw'
import appShellSource from './AppShell.tsx?raw'

afterEach(() => {
  cleanup()
  window.location.hash = ''
})

function makeScreens(): ScreenDefinition[] {
  return [
    {
      id: 'ecran-un',
      render: (api: ScreenNavigatorApi) => (
        <button type="button" onClick={() => api.navigate('ecran-deux')}>
          contenu-un
        </button>
      ),
    },
    {
      id: 'ecran-deux',
      render: () => <div>contenu-deux</div>,
    },
  ]
}

describe('ScreenNavigator', () => {
  it("affiche uniquement l'écran initial au démarrage", () => {
    render(<ScreenNavigator screens={makeScreens()} initialScreenId="ecran-un" />)
    expect(screen.getByText('contenu-un')).toBeInTheDocument()
    expect(screen.queryByText('contenu-deux')).not.toBeInTheDocument()
  })

  it('affiche exactement un écran à la fois après une navigation', () => {
    render(<ScreenNavigator screens={makeScreens()} initialScreenId="ecran-un" />)
    fireEvent.click(screen.getByText('contenu-un'))
    expect(screen.queryByText('contenu-un')).not.toBeInTheDocument()
    expect(screen.getByText('contenu-deux')).toBeInTheDocument()
  })

  it('ignore un identifiant d’écran inconnu sans planter et sans changer d’écran', () => {
    const screens: ScreenDefinition[] = [
      {
        id: 'ecran-un',
        render: (api: ScreenNavigatorApi) => (
          <button type="button" onClick={() => api.navigate('inexistant')}>
            contenu-un
          </button>
        ),
      },
    ]
    render(<ScreenNavigator screens={screens} initialScreenId="ecran-un" />)
    fireEvent.click(screen.getByText('contenu-un'))
    expect(screen.getByText('contenu-un')).toBeInTheDocument()
  })

  it("ne change jamais d'écran affiché quand window.location/hash change", () => {
    render(<ScreenNavigator screens={makeScreens()} initialScreenId="ecran-un" />)
    window.location.hash = '#ecran-deux'
    window.dispatchEvent(new Event('hashchange'))
    expect(screen.getByText('contenu-un')).toBeInTheDocument()
    expect(screen.queryByText('contenu-deux')).not.toBeInTheDocument()
  })

  it('ne référence jamais window.location ni URL dans son code source', () => {
    // On ignore les lignes de commentaire (qui peuvent, en français, décrire
    // pourquoi le code évite précisément ces API) et on ne vérifie que le
    // code réellement exécuté.
    const stripComments = (src: string) =>
      src
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*'))
        .join('\n')

    const forbidden = /window\.location|\bURL\(|useSearchParams|react-router/
    expect(stripComments(screenNavigatorSource)).not.toMatch(forbidden)
    expect(stripComments(appShellSource)).not.toMatch(forbidden)
  })
})

describe('AppShell', () => {
  it("démarre sur l'écran « Jouer »", () => {
    render(<AppShell />)
    expect(INITIAL_SCREEN_ID).toBe('play')
    expect(screen.getByTestId('play-button')).toBeInTheDocument()
  })

  it('affiche un seul écran (pas de doublon d’écrans montés simultanément)', () => {
    render(<AppShell />)
    expect(screen.getAllByTestId('play-button')).toHaveLength(1)
  })
})
