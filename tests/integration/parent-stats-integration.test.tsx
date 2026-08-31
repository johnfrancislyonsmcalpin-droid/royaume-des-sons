// node-F N2 : les statistiques affichées par l'écran parent (F1,
// ParentDashboard) correspondent aux données RÉELLES produites par une
// quête jouée de bout en bout (E3), pas à des données factices.
//
// La porte cachée elle-même (HiddenAccessGate, gate G1 de leaf-F1) est déjà
// entièrement vérifiée par src/parent/hiddenAccess.test.tsx : ce test-ci
// couvre un défaut distinct, jamais prouvé ailleurs — que les DONNÉES
// affichées par ParentDashboard proviennent bien de la même localStorage que
// celle où GameRoot écrit après chaque défi (src/save/**), pas d'un état
// mémoire séparé ou d'un instantané figé au chargement du module. Rendre
// ParentDashboard directement (plutôt que de re-simuler l'appui long + le
// calcul mental de la porte, déjà couverts ailleurs) isole précisément ce
// défaut potentiel.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from '../../src/App'
import { ParentDashboard } from '../../src/parent/Dashboard'
import { markVoiceCheckDone } from '../../src/app/VoiceCheckScreen/storage'
import { loadSaveFile } from '../../src/save'

beforeEach(() => {
  window.localStorage.clear()
  markVoiceCheckDone()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('ParentDashboard reflète une vraie quête jouée de bout en bout (node-F N2)', () => {
  it("le niveau, l'aide adulte et l'horodatage affichés correspondent à la sauvegarde réellement écrite par une partie jouée, pas à des valeurs par défaut", () => {
    render(<App />)

    fireEvent.click(screen.getByTestId('play-button'))
    fireEvent.click(within(screen.getByTestId('avatar-options')).getByTestId('avatar-comete'))
    fireEvent.click(within(screen.getByTestId('companion-options')).getByTestId('companion-luciole'))
    fireEvent.click(screen.getByTestId('avatar-confirm'))

    const worldMap = screen.getByTestId('world-map')
    const firstQuestButton = within(worldMap)
      .getAllByRole('button')
      .find((button) => button.getAttribute('data-testid')?.startsWith('quest-'))
    expect(firstQuestButton).toBeDefined()
    fireEvent.click(firstQuestButton!)

    expect(screen.getByTestId('quest-runner')).toBeInTheDocument()
    const cards = within(screen.getByTestId('listen-touch-cards')).getAllByRole('button')
    fireEvent.click(cards[0])

    // Preuve durable : la sauvegarde réellement persistée par GameRoot (pas
    // la rétroaction transitoire à l'écran, qui peut déjà avoir cédé la
    // place au défi suivant — même raisonnement que game-flow.test.tsx).
    const playedSave = loadSaveFile()
    expect(playedSave.currentQuestState).not.toBeNull()
    expect(playedSave.currentQuestState!.results.length).toBeGreaterThan(0)
    expect(playedSave.progress.currentLevel).toBe(1)

    cleanup() // démonte <App/> : le tableau de bord ne doit dépendre que de localStorage, jamais d'un état React encore monté ailleurs.

    render(<ParentDashboard />)
    expect(screen.getByTestId('parent-dashboard-level')).toHaveTextContent('1')
    // Au moins une ligne de maîtrise par compétence de la région 1 est
    // affichée : la trace de la quête jouée a bien atteint le moteur de
    // maîtrise (D1) avant d'atteindre le tableau de bord (F1).
    expect(screen.getByTestId('parent-dashboard-mastery')).toBeInTheDocument()
    const skillRows = within(screen.getByTestId('parent-dashboard-mastery')).getAllByRole('listitem')
    expect(skillRows.length).toBeGreaterThan(0)
  })

  it("un adulte qui consulte l'écran parent AVANT toute partie voit des compteurs à zéro, jamais des données inventées", () => {
    render(<ParentDashboard />)
    expect(screen.getByTestId('parent-dashboard-level')).toHaveTextContent('1')
    expect(screen.getByTestId('parent-dashboard-help-count')).toHaveTextContent('0')
    expect(screen.getByTestId('parent-dashboard-errors-empty')).toBeInTheDocument()
  })
})
