import { describe, expect, it } from 'vitest'
import { SCHEMA_VERSION } from '../types'
import type { QuestState, SaveFile } from '../types'
import { SaveValidationError, migrateV0ToV1, parseKnownSave } from './migration'
import type { LegacySaveFileV0 } from './migration'

// Fixture "v1" du brief (voir note d'hypothèse en tête de migration.ts) : une
// sauvegarde antérieure plausible, modélisée en schemaVersion 0, sans
// `progress.helpAdultCount` ni `mastery.reviewQueue` — deux champs ajoutés
// depuis. Elle contient une quête en cours avec un résultat déjà enregistré,
// pour vérifier que la reprise exacte survit à la migration.
function buildLegacyFixture(): LegacySaveFileV0 {
  const quest: QuestState = {
    questId: 'q-foret-1',
    regionId: 'foret-consonnes',
    challengeQueue: [
      {
        id: 'c1',
        kind: 'listen-touch',
        skillId: 'L2-consonnes',
        targetItemId: 'item-l',
        options: [
          { id: 'o1', contentItemId: 'item-l', isDistractor: false },
          { id: 'o2', contentItemId: 'item-m', isDistractor: true },
        ],
        isReview: false,
      },
      {
        id: 'c2',
        kind: 'forge',
        skillId: 'L2-consonnes',
        targetItemId: 'item-r',
        options: [],
        isReview: false,
      },
    ],
    currentIndex: 1,
    results: [
      {
        challengeId: 'c1',
        correct: true,
        usedHelpLevel: 0,
        usedListenAgain: false,
        responseMs: 1200,
        timestamp: '2026-08-20T10:00:00.000Z',
      },
    ],
    startedAt: '2026-08-20T09:58:00.000Z',
  }

  return {
    schemaVersion: 0,
    mastery: {
      skills: {
        'L2-consonnes': {
          skillId: 'L2-consonnes',
          last10: [true, true, false, true],
          masteredAt: null,
          decayedAt: null,
        },
      },
      // pas de reviewQueue en v0
    },
    avatar: {
      avatarId: 'avatar-renard',
      companionId: 'compagnon-luciole',
      cosmetics: ['chapeau-bleu'],
      xp: 340,
      coins: 12,
    },
    progress: {
      currentLevel: 2,
      currentRegionId: 'foret-consonnes',
      unlockedRegionIds: ['clairiere-voyelles', 'foret-consonnes'],
      grandLivreItemIds: ['item-a', 'item-i'],
      // pas de helpAdultCount en v0
      sessionMinutesByDay: { '2026-08-20': 8 },
    },
    currentQuestState: quest,
    lastSavedAt: '2026-08-20T10:00:05.000Z',
  }
}

describe('migration v0 -> courant (SCHEMA_VERSION)', () => {
  it('SCHEMA_VERSION du contrat figé vaut 1 (hypothèse documentée dans ASSUMPTIONS.md)', () => {
    expect(SCHEMA_VERSION).toBe(1)
  })

  it('migrateV0ToV1 ajoute les champs manquants avec des valeurs neutres', () => {
    const legacy = buildLegacyFixture()
    const migrated = migrateV0ToV1(legacy)

    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION)
    expect(migrated.mastery.reviewQueue).toEqual([])
    expect(migrated.progress.helpAdultCount).toBe(0)
  })

  it('migrateV0ToV1 préserve toutes les données existantes sans perte', () => {
    const legacy = buildLegacyFixture()
    const migrated = migrateV0ToV1(legacy)

    expect(migrated.mastery.skills).toEqual(legacy.mastery.skills)
    expect(migrated.avatar).toEqual(legacy.avatar)
    expect(migrated.progress.currentLevel).toBe(legacy.progress.currentLevel)
    expect(migrated.progress.currentRegionId).toBe(legacy.progress.currentRegionId)
    expect(migrated.progress.unlockedRegionIds).toEqual(legacy.progress.unlockedRegionIds)
    expect(migrated.progress.grandLivreItemIds).toEqual(legacy.progress.grandLivreItemIds)
    expect(migrated.progress.sessionMinutesByDay).toEqual(legacy.progress.sessionMinutesByDay)
    expect(migrated.lastSavedAt).toBe(legacy.lastSavedAt)
    // Reprise exacte : le défi en cours de la quête migrée est identique.
    expect(migrated.currentQuestState).toEqual(legacy.currentQuestState)
  })

  it('parseKnownSave(v0) produit le même résultat que migrateV0ToV1 direct', () => {
    const legacy = buildLegacyFixture()
    const viaParse = parseKnownSave(legacy)
    const viaDirect = migrateV0ToV1(legacy)
    expect(viaParse).toEqual(viaDirect)
  })

  it('parseKnownSave accepte une sauvegarde déjà au format courant sans altération', () => {
    const current: SaveFile = {
      schemaVersion: SCHEMA_VERSION,
      mastery: { skills: {}, reviewQueue: [] },
      avatar: { avatarId: 'a', companionId: 'c', cosmetics: [], xp: 0, coins: 0 },
      progress: {
        currentLevel: 1,
        currentRegionId: 'clairiere-voyelles',
        unlockedRegionIds: ['clairiere-voyelles'],
        grandLivreItemIds: [],
        helpAdultCount: 0,
        sessionMinutesByDay: {},
      },
      currentQuestState: null,
      lastSavedAt: '2026-08-31T00:00:00.000Z',
    }
    expect(parseKnownSave(current)).toEqual(current)
  })

  it('rejette un schemaVersion inconnu (ni v0 ni courant) sans lever autre chose que SaveValidationError', () => {
    const future = { ...buildLegacyFixture(), schemaVersion: 42 }
    expect(() => parseKnownSave(future)).toThrow(SaveValidationError)
    try {
      parseKnownSave(future)
    } catch (err) {
      expect(err).toBeInstanceOf(SaveValidationError)
      expect((err as SaveValidationError).reason).toBe('unknown-schema-version')
    }
  })

  it('rejette une forme invalide au schemaVersion courant (champ manquant)', () => {
    const broken = {
      schemaVersion: SCHEMA_VERSION,
      mastery: { skills: {}, reviewQueue: [] },
      // avatar manquant
      progress: {
        currentLevel: 1,
        currentRegionId: 'x',
        unlockedRegionIds: [],
        grandLivreItemIds: [],
        helpAdultCount: 0,
        sessionMinutesByDay: {},
      },
      currentQuestState: null,
      lastSavedAt: '2026-08-31T00:00:00.000Z',
    }
    expect(() => parseKnownSave(broken)).toThrow(SaveValidationError)
    try {
      parseKnownSave(broken)
    } catch (err) {
      expect((err as SaveValidationError).reason).toBe('invalid-shape')
    }
  })

  it('rejette une valeur qui n\'est pas un objet', () => {
    expect(() => parseKnownSave('pas un objet')).toThrow(SaveValidationError)
    expect(() => parseKnownSave(null)).toThrow(SaveValidationError)
    expect(() => parseKnownSave([1, 2, 3])).toThrow(SaveValidationError)
  })
})
