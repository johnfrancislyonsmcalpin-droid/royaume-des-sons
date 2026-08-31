import { beforeEach, describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../types'
import type { SaveFile } from '../types'
import { exportSaveFile, importAndPersistSaveFile, importSaveFile } from './exportImport'
import { createEmptySaveFile, loadSaveFile, writeSaveFile, STORAGE_KEY } from './storage'

function buildSave(overrides: Partial<SaveFile> = {}): SaveFile {
  return {
    ...createEmptySaveFile('2026-08-31T00:00:00.000Z'),
    avatar: { avatarId: 'avatar-hibou', companionId: 'compagnon-etoile', cosmetics: ['cape-rouge'], xp: 50, coins: 4 },
    progress: {
      currentLevel: 3,
      currentRegionId: 'pont-syllabes',
      unlockedRegionIds: ['clairiere-voyelles', 'foret-consonnes', 'pont-syllabes'],
      grandLivreItemIds: ['item-a', 'item-papa'],
      helpAdultCount: 1,
      sessionMinutesByDay: { '2026-08-30': 6 },
    },
    ...overrides,
  }
}

describe('export JSON', () => {
  it('produit un JSON qui redonne un SaveFile équivalent une fois reparsé', () => {
    const save = buildSave()
    const json = exportSaveFile(save)
    expect(() => JSON.parse(json)).not.toThrow()
    expect(JSON.parse(json)).toEqual(save)
  })

  it('exportSaveFile puis importSaveFile est une identité', () => {
    const save = buildSave()
    const json = exportSaveFile(save)
    const result = importSaveFile(json)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.save).toEqual(save)
  })
})

describe('import JSON — cas valides', () => {
  it('importe une sauvegarde au schéma courant', () => {
    const save = buildSave()
    const result = importSaveFile(exportSaveFile(save))
    expect(result).toEqual({ ok: true, save })
  })

  it('importe et migre une sauvegarde v0 (legacy) vers le schéma courant', () => {
    const legacyJson = JSON.stringify({
      schemaVersion: 0,
      mastery: { skills: {} },
      avatar: { avatarId: 'a', companionId: 'c', cosmetics: [], xp: 0, coins: 0 },
      progress: {
        currentLevel: 1,
        currentRegionId: 'clairiere-voyelles',
        unlockedRegionIds: ['clairiere-voyelles'],
        grandLivreItemIds: [],
        sessionMinutesByDay: {},
      },
      currentQuestState: null,
      lastSavedAt: '2026-08-01T00:00:00.000Z',
    })

    const result = importSaveFile(legacyJson)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.save.schemaVersion).toBe(SCHEMA_VERSION)
      expect(result.save.mastery.reviewQueue).toEqual([])
      expect(result.save.progress.helpAdultCount).toBe(0)
    }
  })
})

describe('import JSON — cas invalides (rejet propre)', () => {
  it('rejette un JSON malformé', () => {
    const result = importSaveFile('{ ceci n\'est pas du JSON valide')
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: 'malformed-json' }),
    )
  })

  it('rejette un schemaVersion inconnu', () => {
    const result = importSaveFile(JSON.stringify({ ...buildSave(), schemaVersion: 999 }))
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: 'unknown-schema-version' }),
    )
  })

  it('rejette une forme invalide (champ requis manquant)', () => {
    const broken = { schemaVersion: SCHEMA_VERSION, mastery: { skills: {}, reviewQueue: [] } }
    const result = importSaveFile(JSON.stringify(broken))
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: 'invalid-shape' }),
    )
  })

  it('rejette une chaîne vide', () => {
    const result = importSaveFile('')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('malformed-json')
  })
})

describe('importAndPersistSaveFile — ne corrompt jamais la sauvegarde existante en cas d\'échec', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('un import valide remplace bien la sauvegarde persistée', () => {
    const original = buildSave({ progress: buildSave().progress })
    writeSaveFile(original)

    const incoming = buildSave({
      progress: {
        currentLevel: 5,
        currentRegionId: 'grotte-sons-qui-claquent',
        unlockedRegionIds: ['clairiere-voyelles', 'foret-consonnes', 'pont-syllabes', 'village-mots', 'grotte-sons-qui-claquent'],
        grandLivreItemIds: ['item-a'],
        helpAdultCount: 3,
        sessionMinutesByDay: {},
      },
    })

    const result = importAndPersistSaveFile(exportSaveFile(incoming))
    expect(result.ok).toBe(true)

    const reloaded = loadSaveFile()
    expect(reloaded.progress.currentRegionId).toBe('grotte-sons-qui-claquent')
  })

  it('un JSON malformé est rejeté sans toucher à la sauvegarde déjà en place', () => {
    const persistedOriginal = writeSaveFile(buildSave(), '2026-08-31T00:00:00.000Z').save
    const rawBefore = window.localStorage.getItem(STORAGE_KEY)

    const result = importAndPersistSaveFile('{ pas du JSON')
    expect(result.ok).toBe(false)

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(rawBefore)
    expect(loadSaveFile()).toEqual(persistedOriginal)
  })

  it('un schemaVersion inconnu est rejeté sans toucher à la sauvegarde déjà en place', () => {
    const persistedOriginal = writeSaveFile(buildSave(), '2026-08-31T00:00:00.000Z').save
    const rawBefore = window.localStorage.getItem(STORAGE_KEY)

    const result = importAndPersistSaveFile(JSON.stringify({ ...buildSave(), schemaVersion: 7 }))
    expect(result.ok).toBe(false)

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(rawBefore)
    expect(loadSaveFile()).toEqual(persistedOriginal)
  })

  it('une forme invalide est rejetée sans toucher à la sauvegarde déjà en place', () => {
    const persistedOriginal = writeSaveFile(buildSave(), '2026-08-31T00:00:00.000Z').save
    const rawBefore = window.localStorage.getItem(STORAGE_KEY)

    const result = importAndPersistSaveFile(JSON.stringify({ schemaVersion: SCHEMA_VERSION }))
    expect(result.ok).toBe(false)

    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(rawBefore)
    expect(loadSaveFile()).toEqual(persistedOriginal)
  })
})
