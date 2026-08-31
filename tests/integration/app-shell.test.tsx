// Gate G2 (leaf A5) : l'app démarre sur l'écran de vérification voix au tout
// premier lancement, puis sur l'écran Jouer aux lancements suivants ; le
// premier écran affiché déclare toujours une narration non vide (vérifiée
// via le registre central de narration, jamais via un texte affiché — SPEC
// §2 : l'enfant ne lit pas). Couvre aussi l'attendu de app-shell.test.tsx du
// ledger : une sauvegarde vide s'initialise puis se recharge à l'identique.
//
// Exerce l'app réelle telle que composée par src/App.tsx / GameRoot.tsx :
// aucun mock de src/voice, src/narration, src/save ou src/parent — ces
// modules tournent tels qu'ils tourneraient en jeu (jsdom ne fournissant pas
// `window.speechSynthesis`, le moteur voix dégrade automatiquement vers son
// implémentation noop, comportement réel et déjà prévu par A2, pas un mock
// ajouté par ce test).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import App from '../../src/App'
import { markVoiceCheckDone, resetVoiceCheckForTests } from '../../src/app/VoiceCheckScreen/storage'
import { loadSaveFile } from '../../src/save'
import { verifyScreenNarration } from '../../src/narration/registry'

beforeEach(() => {
  window.localStorage.clear()
  resetVoiceCheckForTests()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('démarrage de l’app réelle (gate G2)', () => {
  it('démarre sur l’écran de vérification voix au tout premier lancement', () => {
    render(<App />)
    // jsdom ne fournit pas window.speechSynthesis : le moteur voix réel (A2)
    // dégrade vers son implémentation noop et démarre "muet" (getMuteState()
    // === true dès le départ, voir src/voice/engine.ts::createNoopVoiceEngine),
    // donc VoiceCheckScreen affiche directement son étape "explication" plutôt
    // que "prêt à écouter" — comportement réel de cet environnement, pas un
    // artefact de mock. On accepte les deux étapes possibles pour rester
    // robuste à un environnement de test qui fournirait speechSynthesis.
    const onReadyStep = screen.queryByTestId('voice-check-start')
    const onExplanationStep = screen.queryByTestId('voice-check-continue-anyway')
    expect(onReadyStep ?? onExplanationStep).not.toBeNull()
    expect(screen.queryByTestId('play-button')).not.toBeInTheDocument()
  })

  it('démarre sur l’écran Jouer aux lancements suivants, et ce premier écran déclare une narration non vide', () => {
    markVoiceCheckDone()
    render(<App />)

    expect(screen.getByTestId('play-button')).toBeInTheDocument()
    expect(screen.queryByTestId('voice-check-start')).not.toBeInTheDocument()

    // G2 : narre sans dépendre d'un texte lu — vérifié via le registre
    // d'audit A4 (src/narration/registry.ts), pas via une assertion sur un
    // texte affiché à l'écran.
    const violations = verifyScreenNarration(['play'])
    expect(violations).toEqual([])
  })

  it('l’accès caché à l’écran parent est présent en permanence, dès le premier écran', () => {
    markVoiceCheckDone()
    render(<App />)
    expect(screen.getByTestId('parent-hidden-zone')).toBeInTheDocument()
  })

  it('une sauvegarde vide s’initialise puis se recharge à l’identique (aucune interaction)', () => {
    markVoiceCheckDone()
    const { unmount } = render(<App />)
    const first = loadSaveFile()

    // Aucune écriture tacite : loadSaveFile() ne persiste jamais une
    // sauvegarde neutre en son absence (contrat A3), donc un simple montage
    // sans interaction ne doit rien écrire en localStorage.
    expect(window.localStorage.getItem('royaume-des-sons:save')).toBeNull()

    unmount()
    render(<App />)
    const second = loadSaveFile()

    expect(second.schemaVersion).toBe(first.schemaVersion)
    expect(second.avatar).toEqual(first.avatar)
    expect(second.progress).toEqual(first.progress)
    expect(second.mastery).toEqual(first.mastery)
    expect(second.currentQuestState).toBeNull()
    expect(first.currentQuestState).toBeNull()
  })
})
