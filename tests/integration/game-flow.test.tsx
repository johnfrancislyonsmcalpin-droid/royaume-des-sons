// Gate G3 (leaf A5) : le parcours complet Jouer -> avatar -> carte -> quête
// -> au moins un défi répondu est navigable par composition RÉELLE des
// écrans, sans écran orphelin ni impasse. Couvre aussi l'accessibilité du
// Grand Livre depuis la carte (ajoutée par cette leaf, sinon inatteignable).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from '../../src/App'
import { markVoiceCheckDone } from '../../src/app/VoiceCheckScreen/storage'
import { curriculum } from '../../src/content/curriculum'
import { loadSaveFile } from '../../src/save'

beforeEach(() => {
  window.localStorage.clear()
  markVoiceCheckDone()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

function chooseAvatarAndCompanion(avatarTestId: string, companionTestId: string) {
  fireEvent.click(within(screen.getByTestId('avatar-options')).getByTestId(avatarTestId))
  fireEvent.click(within(screen.getByTestId('companion-options')).getByTestId(companionTestId))
  fireEvent.click(screen.getByTestId('avatar-confirm'))
}

describe('parcours complet Jouer -> avatar -> carte -> quête (gate G3)', () => {
  it('navigue de bout en bout par composition réelle des écrans, jusqu’à répondre à un défi, sans écran orphelin', () => {
    render(<App />)

    // Jouer : une sauvegarde vide (avatarId === '') doit mener à l'écran avatar.
    fireEvent.click(screen.getByTestId('play-button'))
    expect(screen.getByTestId('avatar-options')).toBeInTheDocument()

    chooseAvatarAndCompanion('avatar-comete', 'companion-luciole')

    // Carte du monde : la région 1 doit être débloquée et ouverte d'office
    // (bootstrap de la première partie, voir GameRoot.tsx::handleAvatarSelect),
    // donc sa première quête doit être immédiatement visible et jouable.
    expect(screen.getByTestId('world-map')).toBeInTheDocument()
    const firstRegionId = curriculum.levels[0].regionId
    const firstQuestId = `${firstRegionId}-q1`
    const questButton = screen.getByTestId(`quest-${firstQuestId}`)
    expect(questButton).toBeInTheDocument()
    fireEvent.click(questButton)

    // Quête : le défi courant est affiché (niveau 1 -> uniquement des
    // graphèmes isolés -> mécanique "Écoute et touche" garantie, voir
    // src/world/quest/challengeKind.ts).
    expect(screen.getByTestId('quest-runner')).toBeInTheDocument()
    expect(screen.queryByTestId('world-map')).not.toBeInTheDocument()

    const cards = within(screen.getByTestId('listen-touch-cards')).getAllByRole('button')
    expect(cards.length).toBeGreaterThan(0)
    fireEvent.click(cards[0])

    // Au moins un défi a été répondu : vérifié sur la sauvegarde réellement
    // persistée (SPEC §3, écriture après chaque défi) plutôt que sur la
    // rétroaction transitoire à l'écran — une réponse correcte avance
    // immédiatement au défi suivant dans le même batch React, donc la carte
    // de rétroaction peut déjà avoir cédé la place au défi suivant au moment
    // où ce test s'exécute. La sauvegarde est la preuve durable que `onAnswer`
    // a bien atteint le moteur de quête réel jusqu'à localStorage.
    const savedQuest = loadSaveFile().currentQuestState
    expect(savedQuest).not.toBeNull()
    expect(savedQuest!.results.length).toBeGreaterThan(0)

    // La quête reste jouable (un défi est toujours affiché) : jamais d'écran
    // orphelin. Les écrans précédents ne sont plus montés.
    expect(screen.getByTestId('quest-runner')).toBeInTheDocument()
    expect(screen.queryByTestId('play-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('avatar-options')).not.toBeInTheDocument()

    // L'accès parent reste accessible depuis cet écran de jeu, comme tous
    // les autres (overlay permanent, hors du ScreenNavigator).
    expect(screen.getByTestId('parent-hidden-zone')).toBeInTheDocument()
  })

  it('ouvre et referme le Grand Livre depuis la carte, sans perdre la carte (pas d’impasse)', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('play-button'))
    chooseAvatarAndCompanion('avatar-vague', 'companion-hibou')

    expect(screen.getByTestId('world-map')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('open-grand-livre'))

    expect(screen.getByTestId('grand-livre')).toBeInTheDocument()
    expect(screen.queryByTestId('world-map')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('grand-livre-back'))
    expect(screen.getByTestId('world-map')).toBeInTheDocument()
  })

  it('ignore silencieusement le tap sur un boss dont les compétences ne sont pas maîtrisées (jamais de blocage visible)', () => {
    render(<App />)
    fireEvent.click(screen.getByTestId('play-button'))
    chooseAvatarAndCompanion('avatar-feuille', 'companion-renardeau')

    const firstRegionId = curriculum.levels[0].regionId
    const firstLevel = curriculum.levels.find((level) => level.regionId === firstRegionId)!
    const bossButton = screen.getByTestId(`quest-${firstLevel.bossQuestId}`)
    fireEvent.click(bossButton)

    // Aucune compétence n'est maîtrisée sur une sauvegarde neuve : le tap sur
    // le boss ne doit déclencher aucune navigation, ni aucun message d'erreur.
    expect(screen.getByTestId('world-map')).toBeInTheDocument()
    expect(screen.queryByTestId('quest-runner')).not.toBeInTheDocument()
  })
})
