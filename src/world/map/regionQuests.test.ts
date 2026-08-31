import { describe, expect, it } from 'vitest'
import { curriculum } from '../../content/curriculum'
import { buildRegionQuests } from './regionQuests'

describe('buildRegionQuests', () => {
  const regionQuests = buildRegionQuests(curriculum.levels)

  it('produit une entrée par région du curriculum, dans le même ordre (niveaux 1..10)', () => {
    expect(regionQuests).toHaveLength(10)
    regionQuests.forEach((entry, index) => {
      expect(entry.level).toBe(index + 1)
      expect(entry.regionId).toBe(curriculum.levels[index].regionId)
    })
  })

  it('chaque région expose entre 4 et 6 quêtes (SPEC §4)', () => {
    for (const entry of regionQuests) {
      expect(entry.quests.length).toBeGreaterThanOrEqual(4)
      expect(entry.quests.length).toBeLessThanOrEqual(6)
    }
  })

  it("la dernière quête de chaque région est un boss dont l'id est exactement le bossQuestId du curriculum", () => {
    for (const [index, entry] of regionQuests.entries()) {
      const level = curriculum.levels[index]
      const lastQuest = entry.quests[entry.quests.length - 1]
      expect(lastQuest.isBoss).toBe(true)
      expect(lastQuest.id).toBe(level.bossQuestId)
    }
  })

  it('seule la dernière quête de chaque région est marquée boss', () => {
    for (const entry of regionQuests) {
      const bossCount = entry.quests.filter((quest) => quest.isBoss).length
      expect(bossCount).toBe(1)
      expect(entry.quests.slice(0, -1).every((quest) => !quest.isBoss)).toBe(true)
    }
  })

  it('les quêtes de chaque région sont numérotées 1..N sans trou dans l\'ordre de jeu', () => {
    for (const entry of regionQuests) {
      entry.quests.forEach((quest, index) => {
        expect(quest.position).toBe(index + 1)
        expect(quest.regionId).toBe(entry.regionId)
      })
    }
  })

  it('tous les ids de quête sont uniques sur l\'ensemble de la carte', () => {
    const allIds = regionQuests.flatMap((entry) => entry.quests.map((quest) => quest.id))
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('est pure et déterministe : deux appels produisent un résultat structurellement identique', () => {
    const again = buildRegionQuests(curriculum.levels)
    expect(again).toEqual(regionQuests)
  })
})
