// Gate G4 (leaf A5) : une sauvegarde vide s'initialise puis se recharge à
// l'identique (couvert aussi par app-shell.test.tsx) ; un QuestState en cours
// est restauré EXACTEMENT (même défi courant, pas le premier de la quête)
// après un rechargement simulé de l'app — SPEC §3 : « Reprise exacte au défi
// en cours après rechargement. »
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from '../../src/App'
import { markVoiceCheckDone, resetVoiceCheckForTests } from '../../src/app/VoiceCheckScreen/storage'
import { createEmptySaveFile, writeSaveFile } from '../../src/save'
import { curriculum } from '../../src/content/curriculum'
import { assembleQuest } from '../../src/world/quest/questAssembly'
import { startQuest } from '../../src/world/quest/questLifecycle'
import type { ChallengeResult, MasteryState, SaveFile } from '../../src/types'

beforeEach(() => {
  window.localStorage.clear()
  resetVoiceCheckForTests()
  markVoiceCheckDone()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('reprise exacte d’une quête en cours après rechargement (gate G4)', () => {
  it('reprend précisément au défi en cours (le deuxième), pas au premier défi de la quête', () => {
    // Assemble une vraie quête avec les modules réels (E3), pour reprendre
    // exactement les mêmes formes de données que la production, plutôt qu'un
    // QuestState fabriqué à la main.
    const level1 = curriculum.levels.find((level) => level.level === 1)!
    const skills = level1.skillIds.map((skillId) => curriculum.skills[skillId])
    const emptyMastery: MasteryState = { skills: {}, reviewQueue: [] }
    const challengeQueue = assembleQuest(level1, skills, emptyMastery, [], new Set(), 0, false, () => 0.1)
    const quest = startQuest(`${level1.regionId}-q1`, level1.regionId, challengeQueue)

    // Simule une réponse déjà donnée au premier défi (avance currentIndex à
    // 1), exactement comme le ferait useQuestSession après une réponse
    // correcte (voir src/world/quest/useQuestSession.ts).
    const firstResult: ChallengeResult = {
      challengeId: challengeQueue[0].id,
      correct: true,
      usedHelpLevel: 0,
      usedListenAgain: false,
      responseMs: 1200,
      timestamp: new Date().toISOString(),
    }
    const inProgressQuest = { ...quest, currentIndex: 1, results: [firstResult] }

    const save: SaveFile = { ...createEmptySaveFile(), currentQuestState: inProgressQuest }
    writeSaveFile(save)

    // "Rechargement" simulé : un tout nouveau montage de l'app réelle, qui ne
    // lit son état qu'à travers localStorage (src/save/**), pas d'un état
    // React résiduel.
    render(<App />)

    // Démarre directement sur l'écran de quête, sans repasser par
    // Jouer / avatar / carte du monde.
    expect(screen.getByTestId('quest-runner')).toBeInTheDocument()
    expect(screen.queryByTestId('play-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('world-map')).not.toBeInTheDocument()

    // Le défi affiché est EXACTEMENT challengeQueue[1] : ses options
    // apparaissent toutes, celles du premier défi n'apparaissent pas.
    const secondChallenge = challengeQueue[1]
    for (const option of secondChallenge.options) {
      expect(screen.getByTestId(`listen-touch-card-${option.id}`)).toBeInTheDocument()
    }
    const firstChallenge = challengeQueue[0]
    for (const option of firstChallenge.options) {
      expect(screen.queryByTestId(`listen-touch-card-${option.id}`)).not.toBeInTheDocument()
    }
  })

  it('sans quête en cours, une sauvegarde neutre se recharge sans écran orphelin (aucun QuestState)', () => {
    const save = createEmptySaveFile()
    writeSaveFile(save)

    render(<App />)

    expect(screen.getByTestId('play-button')).toBeInTheDocument()
    expect(screen.queryByTestId('quest-runner')).not.toBeInTheDocument()
  })
})
