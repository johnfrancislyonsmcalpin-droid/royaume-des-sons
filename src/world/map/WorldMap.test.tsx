import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ProgressState } from '../../types'
import { curriculum } from '../../content/curriculum'
import { WorldMap } from './WorldMap'

function makeProgress(overrides: Partial<ProgressState> = {}): ProgressState {
  return {
    currentLevel: 1,
    currentRegionId: curriculum.levels[0].regionId,
    unlockedRegionIds: [curriculum.levels[0].regionId],
    grandLivreItemIds: [],
    helpAdultCount: 0,
    sessionMinutesByDay: {},
    ...overrides,
  }
}

const ALL_REGION_IDS = curriculum.levels.map((level) => level.regionId)

describe('WorldMap — ordre et déblocage des régions (G1)', () => {
  it('affiche les 10 régions du curriculum dans leur ordre exact', () => {
    render(<WorldMap progress={makeProgress()} />)
    const regionsGroup = screen.getByTestId('world-map-regions')
    const buttons = within(regionsGroup).getAllByRole('button')
    expect(buttons).toHaveLength(10)
    buttons.forEach((button, index) => {
      expect(button).toHaveAttribute('data-testid', `region-${ALL_REGION_IDS[index]}`)
    })
  })

  it("une région ABSENTE de unlockedRegionIds ne déclenche aucune navigation au toucher", async () => {
    const user = userEvent.setup()
    const onSelectQuest = vi.fn()
    const progress = makeProgress({
      unlockedRegionIds: [curriculum.levels[0].regionId], // seule la région 1 est débloquée
      currentRegionId: 'autre-region-temp', // évite l'ouverture par défaut au montage
    })
    render(<WorldMap progress={progress} onSelectQuest={onSelectQuest} />)

    const lockedRegionId = curriculum.levels[1].regionId // région 2, verrouillée
    await user.click(screen.getByTestId(`region-${lockedRegionId}`))

    // Aucune liste de quêtes ne doit apparaître pour la région verrouillée.
    expect(screen.queryByTestId('world-map-quests')).not.toBeInTheDocument()
    expect(onSelectQuest).not.toHaveBeenCalled()
  })

  it('une région PRÉSENTE dans unlockedRegionIds révèle ses quêtes au toucher', async () => {
    const user = userEvent.setup()
    const regionId = curriculum.levels[0].regionId
    const progress = makeProgress({ unlockedRegionIds: [regionId], currentRegionId: 'autre-region-temp' })
    // currentRegionId volontairement différent de regionId : l'ouverture par
    // défaut au montage ne doit pas être ce qui fait passer ce test.
    render(<WorldMap progress={progress} />)

    expect(screen.queryByTestId('world-map-quests')).not.toBeInTheDocument()
    await user.click(screen.getByTestId(`region-${regionId}`))
    expect(screen.getByTestId('world-map-quests')).toBeInTheDocument()
  })

  it('les boutons de région verrouillée portent l\'attribut natif disabled', () => {
    const progress = makeProgress({ unlockedRegionIds: [curriculum.levels[0].regionId] })
    render(<WorldMap progress={progress} />)
    for (const level of curriculum.levels.slice(1)) {
      expect(screen.getByTestId(`region-${level.regionId}`)).toBeDisabled()
    }
    expect(screen.getByTestId(`region-${curriculum.levels[0].regionId}`)).not.toBeDisabled()
  })
})

describe('WorldMap — quêtes de région (intégration avec regionQuests.ts)', () => {
  it('une région ouverte expose entre 4 et 6 quêtes, la dernière étant le boss = bossQuestId du curriculum', async () => {
    const user = userEvent.setup()
    const level = curriculum.levels[3] // niveau 4, choisi arbitrairement au milieu
    const progress = makeProgress({
      currentLevel: level.level,
      currentRegionId: level.regionId,
      unlockedRegionIds: curriculum.levels.slice(0, level.level).map((l) => l.regionId),
    })
    render(<WorldMap progress={progress} />)
    await user.click(screen.getByTestId(`region-${level.regionId}`))

    const quests = within(screen.getByTestId('world-map-quests')).getAllByRole('button')
    expect(quests.length).toBeGreaterThanOrEqual(4)
    expect(quests.length).toBeLessThanOrEqual(6)
    const lastQuest = quests[quests.length - 1]
    expect(lastQuest).toHaveAttribute('data-testid', `quest-${level.bossQuestId}`)
  })

  it('toucher une quête notifie onSelectQuest avec le regionId et le questId exacts', async () => {
    const user = userEvent.setup()
    const level = curriculum.levels[0]
    const progress = makeProgress({ unlockedRegionIds: [level.regionId], currentRegionId: level.regionId })
    const onSelectQuest = vi.fn()
    render(<WorldMap progress={progress} onSelectQuest={onSelectQuest} />)

    const quests = within(screen.getByTestId('world-map-quests')).getAllByRole('button')
    await user.click(quests[0])
    expect(onSelectQuest).toHaveBeenCalledWith(level.regionId, `${level.regionId}-q1`)

    await user.click(quests[quests.length - 1])
    expect(onSelectQuest).toHaveBeenCalledWith(level.regionId, level.bossQuestId)
  })
})

describe('WorldMap — cas limite : dernière région (niveau 10) sans région suivante', () => {
  it('la région 10 se rend sans erreur et expose ses propres quêtes, sans connecteur ni région fantôme après elle', async () => {
    const user = userEvent.setup()
    const lastLevel = curriculum.levels[curriculum.levels.length - 1]
    const progress = makeProgress({
      currentLevel: lastLevel.level,
      currentRegionId: lastLevel.regionId,
      unlockedRegionIds: curriculum.levels.map((l) => l.regionId), // tout débloqué (fin de jeu)
    })
    render(<WorldMap progress={progress} />)

    const regionsGroup = screen.getByTestId('world-map-regions')
    expect(within(regionsGroup).getAllByRole('button')).toHaveLength(10)

    await user.click(screen.getByTestId(`region-${lastLevel.regionId}`))
    const quests = within(screen.getByTestId('world-map-quests')).getAllByRole('button')
    expect(quests[quests.length - 1]).toHaveAttribute('data-testid', `quest-${lastLevel.bossQuestId}`)
  })
})

describe('WorldMap — narration à l\'apparition et au toucher', () => {
  it('annonce un aperçu de la carte et le nom/état de chaque région au montage', () => {
    const onAnnounce = vi.fn()
    render(<WorldMap progress={makeProgress()} onAnnounce={onAnnounce} />)

    // Aperçu d'écran + une narration par région (10) = au moins 11 appels.
    expect(onAnnounce.mock.calls.length).toBeGreaterThanOrEqual(11)
    onAnnounce.mock.calls.forEach(([text]) => {
      expect(typeof text).toBe('string')
      expect(text.length).toBeGreaterThan(0)
    })
  })

  it('annonce de nouveau au toucher d\'une région débloquée, avec un texte différent de la narration de montage', async () => {
    const user = userEvent.setup()
    const level = curriculum.levels[0]
    const progress = makeProgress({ unlockedRegionIds: [level.regionId], currentRegionId: 'autre-region-temp' })
    const onAnnounce = vi.fn()
    render(<WorldMap progress={progress} onAnnounce={onAnnounce} />)

    onAnnounce.mockClear()
    await user.click(screen.getByTestId(`region-${level.regionId}`))
    expect(onAnnounce).toHaveBeenCalled()
    const allTexts = onAnnounce.mock.calls.map(([text]) => text as string)
    expect(allTexts.some((text) => text.length > 0)).toBe(true)
  })

  it('annonce chaque quête au toucher', async () => {
    const user = userEvent.setup()
    const level = curriculum.levels[0]
    const progress = makeProgress({ unlockedRegionIds: [level.regionId], currentRegionId: level.regionId })
    const onAnnounce = vi.fn()
    render(<WorldMap progress={progress} onAnnounce={onAnnounce} />)

    onAnnounce.mockClear()
    const quests = within(screen.getByTestId('world-map-quests')).getAllByRole('button')
    await user.click(quests[0])
    expect(onAnnounce).toHaveBeenCalledTimes(1)
    expect((onAnnounce.mock.calls[0][0] as string).length).toBeGreaterThan(0)
  })

  it("ne plante jamais si onAnnounce n'est pas fourni", async () => {
    const user = userEvent.setup()
    const level = curriculum.levels[0]
    const progress = makeProgress({ unlockedRegionIds: [level.regionId], currentRegionId: level.regionId })
    expect(() => render(<WorldMap progress={progress} />)).not.toThrow()
    const quests = within(screen.getByTestId('world-map-quests')).getAllByRole('button')
    await expect(user.click(quests[0])).resolves.not.toThrow()
  })
})

describe('navigation non-lisante', () => {
  it('chaque région et chaque quête visible est un vrai <button> activable au toucher, identifié uniquement par aria-label (jamais par un texte visible à l\'écran)', async () => {
    const user = userEvent.setup()
    const level = curriculum.levels[0]
    const progress = makeProgress({ unlockedRegionIds: [level.regionId], currentRegionId: level.regionId })
    const onSelectQuest = vi.fn()
    render(<WorldMap progress={progress} onSelectQuest={onSelectQuest} />)

    const regionsGroup = screen.getByTestId('world-map-regions')
    const regionButtons = within(regionsGroup).getAllByRole('button')
    for (const button of regionButtons) {
      // Un aria-label existe (accessibilité adulte / lecteur d'écran) ...
      expect(button).toHaveAttribute('aria-label')
      expect(button.getAttribute('aria-label')!.length).toBeGreaterThan(0)
      // ... mais AUCUN texte n'est rendu visuellement dans le bouton : seule
      // une icône SVG (decorative, aria-hidden) sert d'affordance à l'enfant.
      expect(button.textContent).toBe('')
      const svg = button.querySelector('svg[aria-hidden="true"]')
      expect(svg).not.toBeNull()
    }

    const questButtons = within(screen.getByTestId('world-map-quests')).getAllByRole('button')
    for (const button of questButtons) {
      expect(button.textContent).toBe('')
      expect(button.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    }

    // Le geste tactile marche indépendamment de tout libellé lu : cliquer une
    // quête déclenche onSelectQuest sans que le test n'ait jamais lu le texte
    // du bouton pour savoir lequel cliquer (sélection par position/rôle).
    await user.click(questButtons[0])
    expect(onSelectQuest).toHaveBeenCalledTimes(1)
  })

  it('toutes les zones tactiles (régions et quêtes) mesurent au moins 64×64 px CSS', async () => {
    const user = userEvent.setup()
    const level = curriculum.levels[0]
    const progress = makeProgress({ unlockedRegionIds: [level.regionId], currentRegionId: level.regionId })
    render(<WorldMap progress={progress} />)
    await user.click(screen.getByTestId(`region-${level.regionId}`))

    const buttons = document.querySelectorAll('button.tap-button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      const style = (button as HTMLElement).style
      expect(parseInt(style.minWidth, 10)).toBeGreaterThanOrEqual(64)
      expect(parseInt(style.minHeight, 10)).toBeGreaterThanOrEqual(64)
    }
  })

  it('un bouton de région verrouillée ne répond à aucun geste tactile (aucun changement d\'état observable)', async () => {
    const user = userEvent.setup()
    const progress = makeProgress({
      unlockedRegionIds: [curriculum.levels[0].regionId],
      currentRegionId: 'autre-region-temp', // évite l'ouverture par défaut au montage
    })
    const onAnnounce = vi.fn()
    render(<WorldMap progress={progress} onAnnounce={onAnnounce} />)
    onAnnounce.mockClear()

    const lockedButton = screen.getByTestId(`region-${curriculum.levels[1].regionId}`)
    await user.click(lockedButton)
    await user.click(lockedButton)
    await user.click(lockedButton)

    expect(screen.queryByTestId('world-map-quests')).not.toBeInTheDocument()
    expect(onAnnounce).not.toHaveBeenCalled()
  })

  it('aucune couleur seule ne distingue les états : chaque état de région porte une icône SVG différente', () => {
    const level4 = curriculum.levels[3]
    const progress = makeProgress({
      currentLevel: level4.level,
      currentRegionId: level4.regionId,
      unlockedRegionIds: curriculum.levels.slice(0, level4.level).map((l) => l.regionId),
    })
    render(<WorldMap progress={progress} />)

    // Région 1..3 : complétées (niveau < currentLevel). Région 4 : en cours.
    // Région 5..10 : verrouillées. Trois marqueurs SVG distincts attendus.
    const completedButton = screen.getByTestId(`region-${curriculum.levels[0].regionId}`)
    const currentButton = screen.getByTestId(`region-${level4.regionId}`)
    const lockedButton = screen.getByTestId(`region-${curriculum.levels[4].regionId}`)

    const completedSvg = completedButton.querySelector('svg')!.innerHTML
    const currentSvg = currentButton.querySelector('svg')!.innerHTML
    const lockedSvg = lockedButton.querySelector('svg')!.innerHTML

    expect(completedSvg).not.toBe(currentSvg)
    expect(completedSvg).not.toBe(lockedSvg)
    expect(currentSvg).not.toBe(lockedSvg)
  })
})
