// Défaut d'intégration comblé en revue de branche (node-E) : le moteur pur de
// suggestion de pause (SPEC §2.6, src/world/quest/sessionPause.ts, livré par
// E3) et le champ `progress.sessionMinutesByDay` (SaveFile, A3/E2) existaient
// tous les deux, mais rien ne les reliait jamais à un composant réellement
// monté — ni la suggestion de pause à l'enfant, ni le graphique "temps de
// jeu" de l'écran parent (F1) n'avaient de données. Ce test prouve le
// câblage réel ajouté dans GameRoot.tsx (src/app/root/sessionTime.ts +
// PausePrompt.tsx) avec de vrais timers accélérés (vi.useFakeTimers),
// jamais un appel direct aux fonctions pures d'engine (déjà testées
// isolément par sessionPause.test.ts/pausePrompt.test.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from '../../src/App'
import { markVoiceCheckDone } from '../../src/app/VoiceCheckScreen/storage'
import { loadSaveFile, writeSaveFile } from '../../src/save'
import { createEmptySaveFile } from '../../src/save/storage'
import { todayKey } from '../../src/app/root/sessionTime'

beforeEach(() => {
  window.localStorage.clear()
  markVoiceCheckDone()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.useRealTimers()
})

describe('suggestion de pause à 20 minutes cumulées, câblée sur GameRoot réel (node-E N6)', () => {
  it("n'affiche rien avant 20 minutes, puis affiche le bandeau non modal à 20 minutes et écrit sessionMinutesByDay", () => {
    vi.useFakeTimers()
    render(<App />)

    expect(screen.queryByTestId('pause-prompt')).not.toBeInTheDocument()

    // 19 ticks de 15s = 4:45 : bien avant le seuil, rien ne doit apparaître.
    act(() => vi.advanceTimersByTime(15000 * 19))
    expect(screen.queryByTestId('pause-prompt')).not.toBeInTheDocument()

    // Assez de ticks de 15s pour dépasser 20 minutes cumulées (80 ticks = 20:00).
    act(() => vi.advanceTimersByTime(15000 * 80))
    expect(screen.getByTestId('pause-prompt')).toBeInTheDocument()

    const key = todayKey(new Date())
    const saved = loadSaveFile()
    expect(saved.progress.sessionMinutesByDay[key]).toBeGreaterThanOrEqual(20)
  })

  it('le bandeau ne bloque jamais le jeu : le bouton "Continuer à jouer" le referme sans naviguer ailleurs', () => {
    vi.useFakeTimers()
    render(<App />)
    act(() => vi.advanceTimersByTime(15000 * 81))
    expect(screen.getByTestId('pause-prompt')).toBeInTheDocument()
    expect(screen.getByTestId('play-button')).toBeInTheDocument() // le jeu reste affiché et jouable en dessous

    fireEvent.click(screen.getByTestId('pause-prompt-continue'))
    expect(screen.queryByTestId('pause-prompt')).not.toBeInTheDocument()
  })

  it("part d'une valeur déjà accumulée aujourd'hui (baseline) plutôt que de repartir de zéro à chaque montage", () => {
    const key = todayKey(new Date())
    writeSaveFile({ ...createEmptySaveFile(), progress: { ...createEmptySaveFile().progress, sessionMinutesByDay: { [key]: 19 } } })
    markVoiceCheckDone()

    vi.useFakeTimers()
    render(<App />)

    // Une seule minute de plus suffit à dépasser le seuil de 20, puisqu'on
    // part de 19 déjà écrites aujourd'hui.
    act(() => vi.advanceTimersByTime(15000 * 5)) // ~1:15 de plus
    expect(screen.getByTestId('pause-prompt')).toBeInTheDocument()
  })
})
