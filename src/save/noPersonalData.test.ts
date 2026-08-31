import { describe, expect, it } from 'vitest'
import type { SaveFile } from '../types'
import { migrateV0ToV1 } from './migration'
import type { LegacySaveFileV0 } from './migration'
import { createEmptySaveFile } from './storage'

// Gate G4 (leaf-A3) : aucune donnée personnelle (nom, âge, photo) n'existe dans
// la forme SaveFile ni n'est jamais écrite en localStorage (CLAUDE.md règle 6).
// La garantie principale est le contrat figé src/types.ts (revue manuelle, voir
// rapport de leaf). Ce test est un filet de sécurité automatisé qui échouerait
// si un futur champ personnel identifiable était ajouté à une sauvegarde
// produite par ce module — y compris via la migration.

const FORBIDDEN_KEY_FRAGMENTS = [
  'name',
  'nom',
  'prenom',
  'prénom',
  'age',
  'âge',
  'birth',
  'naissance',
  'photo',
  'picture',
  'image',
  'email',
  'courriel',
  'phone',
  'telephone',
  'téléphone',
  'address',
  'adresse',
]

function collectKeys(value: unknown, path = '', keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, path, keys)
    return keys
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      keys.push(`${path}${key}`)
      collectKeys(child, `${path}${key}.`, keys)
    }
  }
  return keys
}

function assertNoForbiddenKeys(save: SaveFile): void {
  const keys = collectKeys(save)
  for (const key of keys) {
    const lowerLeaf = key.split('.').pop()!.toLowerCase()
    for (const forbidden of FORBIDDEN_KEY_FRAGMENTS) {
      // Fragments courts (ex. "age", "nom") : correspondance exacte seulement,
      // sinon des champs légitimes du contrat figé collisionnent (ex. "stage"
      // de ReviewQueueItem contient "age" en sous-chaîne).
      const matches = forbidden.length <= 3 ? lowerLeaf === forbidden : lowerLeaf.includes(forbidden)
      expect(
        matches,
        `clé suspecte "${key}" ressemble à une donnée personnelle ("${forbidden}")`,
      ).toBe(false)
    }
  }
}

describe('G4 — aucune donnée personnelle dans la forme SaveFile', () => {
  it('une sauvegarde neutre ne contient aucune clé évoquant nom/âge/photo/contact', () => {
    assertNoForbiddenKeys(createEmptySaveFile())
  })

  it('une sauvegarde migrée depuis v0 ne contient aucune clé évoquant nom/âge/photo/contact', () => {
    const legacy: LegacySaveFileV0 = {
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
    }
    assertNoForbiddenKeys(migrateV0ToV1(legacy))
  })

  it('les seuls identifiants de personnage sont des id de choix (avatarId/companionId), jamais un nom saisi', () => {
    const save = createEmptySaveFile()
    // avatarId/companionId sont des identifiants de contenu (ex. "avatar-renard"),
    // jamais une saisie libre de l'enfant — le jeu n'a aucun champ de texte libre
    // (CLAUDE.md règle 6, SPEC §2.5).
    expect(typeof save.avatar.avatarId).toBe('string')
    expect(typeof save.avatar.companionId).toBe('string')
  })
})
