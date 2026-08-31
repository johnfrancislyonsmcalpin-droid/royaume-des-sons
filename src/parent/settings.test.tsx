// Gate G4 (leaf-F1.md) : réinitialisation exige une double confirmation ;
// réglages de voix (vitesse, sélection parmi les voix disponibles, test) et
// bouton "vider le cache et recharger" sont fonctionnels.
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SCHEMA_VERSION, type SaveFile } from '../types'
import { STORAGE_KEY } from '../save/storage'

const primeVoice = vi.fn()
const speak = vi.fn()
const setRate = vi.fn()
const setVoiceOverride = vi.fn()
let fakeRate = 0.85
const fakeVoices = [
  { name: 'Chantal', lang: 'fr-CA' },
  { name: 'Amélie', lang: 'fr-FR' },
]

vi.mock('../voice', () => ({
  primeVoice: (...args: unknown[]) => primeVoice(...args),
  speak: (...args: unknown[]) => speak(...args),
  getRate: () => fakeRate,
  setRate: (...args: unknown[]) => {
    fakeRate = args[0] as number
    setRate(...args)
  },
  listVoices: () => fakeVoices,
  setVoiceOverride: (...args: unknown[]) => setVoiceOverride(...args),
}))

const clearCacheAndReload = vi.fn((..._args: unknown[]) => Promise.resolve())

vi.mock('../app/serviceWorker', () => ({
  clearCacheAndReload: (...args: unknown[]) => clearCacheAndReload(...args),
}))

const { ParentSettings } = await import('./Settings')
const { loadSaveFile, writeSaveFile } = await import('../save')

function makeSave(overrides: Partial<SaveFile> = {}): SaveFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    mastery: { skills: {}, reviewQueue: [] },
    avatar: { avatarId: 'comete', companionId: 'luciole', cosmetics: [], xp: 12, coins: 3 },
    progress: {
      currentLevel: 4,
      currentRegionId: 'village-des-mots',
      unlockedRegionIds: ['clairiere-des-voyelles'],
      grandLivreItemIds: ['mot-1'],
      helpAdultCount: 2,
      sessionMinutesByDay: { '2026-08-20': 15 },
    },
    currentQuestState: null,
    lastSavedAt: '2026-08-20T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  primeVoice.mockClear()
  speak.mockClear()
  clearCacheAndReload.mockClear()
})

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('ParentSettings — réglages voix', () => {
  it('le slider de vitesse a une valeur par défaut plausible et se met à jour au déplacement', () => {
    render(<ParentSettings />)
    const slider = screen.getByTestId('parent-voice-rate') as HTMLInputElement
    expect(Number(slider.value)).toBeGreaterThan(0)

    fireEvent.change(slider, { target: { value: '1.2' } })
    expect(screen.getByTestId('parent-voice-rate-value')).toHaveTextContent('1.20')
  })

  it('liste les voix exposées par src/voice/listVoices() dans le sélecteur', () => {
    render(<ParentSettings />)
    const select = screen.getByTestId('parent-voice-select') as HTMLSelectElement
    const optionLabels = Array.from(select.options).map((o) => o.textContent)
    expect(optionLabels.some((label) => label?.includes('Chantal'))).toBe(true)
    expect(optionLabels.some((label) => label?.includes('Amélie'))).toBe(true)
  })

  it('choisir une voix appelle setVoiceOverride(voice) du module voix ; revenir à la voix par défaut appelle setVoiceOverride(null)', () => {
    render(<ParentSettings />)
    const select = screen.getByTestId('parent-voice-select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: select.options[1]!.value } })
    expect(setVoiceOverride).toHaveBeenCalledWith(expect.objectContaining({ name: 'Chantal' }))

    fireEvent.change(select, { target: { value: '' } })
    expect(setVoiceOverride).toHaveBeenLastCalledWith(null)
  })

  it('déplacer le slider de vitesse appelle setRate(...) du module voix', () => {
    render(<ParentSettings />)
    const slider = screen.getByTestId('parent-voice-rate') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '1.2' } })
    expect(setRate).toHaveBeenCalledWith(1.2)
  })

  it('le bouton "Tester" amorce la voix et appelle speak() avec un texte non vide', () => {
    render(<ParentSettings />)
    fireEvent.click(screen.getByTestId('parent-voice-test'))

    expect(primeVoice).toHaveBeenCalledTimes(1)
    expect(speak).toHaveBeenCalledTimes(1)
    const request = speak.mock.calls[0][0]
    expect(typeof request.text).toBe('string')
    expect(request.text.length).toBeGreaterThan(0)
  })
})

describe('ParentSettings — réinitialisation à double confirmation', () => {
  it("n'efface rien tant que les deux confirmations n'ont pas eu lieu", () => {
    writeSaveFile(makeSave())
    render(<ParentSettings />)

    fireEvent.click(screen.getByTestId('parent-reset-start'))
    expect(screen.getByTestId('parent-reset-confirm-1')).toBeInTheDocument()
    expect(loadSaveFile().progress.currentLevel).toBe(4)

    fireEvent.click(screen.getByTestId('parent-reset-continue'))
    expect(screen.getByTestId('parent-reset-confirm-2')).toBeInTheDocument()
    expect(loadSaveFile().progress.currentLevel).toBe(4)
  })

  it('efface la progression seulement après la seconde confirmation explicite', () => {
    writeSaveFile(makeSave())
    render(<ParentSettings />)

    fireEvent.click(screen.getByTestId('parent-reset-start'))
    fireEvent.click(screen.getByTestId('parent-reset-continue'))
    fireEvent.click(screen.getByTestId('parent-reset-confirm'))

    expect(screen.getByTestId('parent-reset-done')).toBeInTheDocument()
    const reloaded = loadSaveFile()
    expect(reloaded.progress.currentLevel).toBe(1)
    expect(reloaded.avatar.avatarId).toBe('')
  })

  it('annuler à la première étape referme la confirmation sans rien effacer', () => {
    writeSaveFile(makeSave())
    render(<ParentSettings />)

    fireEvent.click(screen.getByTestId('parent-reset-start'))
    fireEvent.click(screen.getByTestId('parent-reset-cancel'))

    expect(screen.queryByTestId('parent-reset-confirm-1')).not.toBeInTheDocument()
    expect(loadSaveFile().progress.currentLevel).toBe(4)
  })

  it('annuler à la seconde étape referme la confirmation sans rien effacer', () => {
    writeSaveFile(makeSave())
    render(<ParentSettings />)

    fireEvent.click(screen.getByTestId('parent-reset-start'))
    fireEvent.click(screen.getByTestId('parent-reset-continue'))
    fireEvent.click(screen.getByTestId('parent-reset-cancel-2'))

    expect(screen.queryByTestId('parent-reset-confirm-2')).not.toBeInTheDocument()
    expect(loadSaveFile().progress.currentLevel).toBe(4)
  })
})

describe('ParentSettings — export / import JSON', () => {
  it('exporte la sauvegarde réelle sous forme de JSON affichable', () => {
    writeSaveFile(makeSave())
    render(<ParentSettings />)

    fireEvent.click(screen.getByTestId('parent-export-start'))
    const textarea = screen.getByTestId('parent-export-json') as HTMLTextAreaElement
    const parsed = JSON.parse(textarea.value)
    expect(parsed.progress.currentLevel).toBe(4)
    expect(screen.getByTestId('parent-export-download')).toHaveAttribute('download')
  })

  it('un import valide affiche un succès clair et persiste la sauvegarde importée', () => {
    render(<ParentSettings />)
    const imported = makeSave({ progress: { ...makeSave().progress, currentLevel: 7 } })

    fireEvent.change(screen.getByTestId('parent-import-textarea'), {
      target: { value: JSON.stringify(imported) },
    })
    fireEvent.click(screen.getByTestId('parent-import-submit'))

    expect(screen.getByTestId('parent-import-success')).toBeInTheDocument()
    expect(loadSaveFile().progress.currentLevel).toBe(7)
  })

  it('un import invalide affiche un échec clair, ne lève jamais et ne touche pas la sauvegarde existante', () => {
    writeSaveFile(makeSave())
    render(<ParentSettings />)

    expect(() => {
      fireEvent.change(screen.getByTestId('parent-import-textarea'), {
        target: { value: '{ ceci nest pas du json' },
      })
      fireEvent.click(screen.getByTestId('parent-import-submit'))
    }).not.toThrow()

    expect(screen.getByTestId('parent-import-error')).toBeInTheDocument()
    expect(loadSaveFile().progress.currentLevel).toBe(4)
  })
})

describe('ParentSettings — vider le cache', () => {
  it('le bouton "vider le cache et recharger" appelle clearCacheAndReload()', () => {
    render(<ParentSettings />)
    fireEvent.click(screen.getByTestId('parent-clear-cache'))
    expect(clearCacheAndReload).toHaveBeenCalledTimes(1)
  })
})

// Confirme que la clé de stockage réelle est bien celle utilisée par
// loadSaveFile/writeSaveFile importés ci-dessus (garde contre une divergence
// silencieuse de clé entre les tests et l'implémentation réelle).
describe('cohérence de la clé de stockage utilisée par les tests', () => {
  it('STORAGE_KEY correspond à la clé lue après writeSaveFile', () => {
    writeSaveFile(makeSave())
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull()
  })
})
