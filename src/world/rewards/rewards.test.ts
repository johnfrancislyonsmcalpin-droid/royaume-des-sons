import { describe, expect, it } from 'vitest'
import type { AvatarState } from '../../types'
import { applyQuestReward } from './rewards'

function makeAvatar(overrides: Partial<AvatarState> = {}): AvatarState {
  return {
    avatarId: 'avatar-comete',
    companionId: 'companion-luciole',
    cosmetics: [],
    xp: 0,
    coins: 0,
    ...overrides,
  }
}

describe('applyQuestReward', () => {
  it('augmente xp et coins du montant accordé', () => {
    const avatar = makeAvatar({ xp: 10, coins: 5 })
    const result = applyQuestReward(avatar, 30, 12, [])
    expect(result.xp).toBe(40)
    expect(result.coins).toBe(17)
  })

  it('ne modifie jamais avatar en place (fonction pure)', () => {
    const avatar = makeAvatar({ xp: 10, coins: 5, cosmetics: ['chapeau-a'] })
    const before = JSON.parse(JSON.stringify(avatar))
    applyQuestReward(avatar, 20, 5, ['cape-b'])
    expect(avatar).toEqual(before)
  })

  it('ajoute les nouveaux cosmétiques à la liste existante', () => {
    const avatar = makeAvatar({ cosmetics: ['chapeau-a'] })
    const result = applyQuestReward(avatar, 10, 5, ['cape-b', 'monture-c'])
    expect(result.cosmetics).toEqual(['chapeau-a', 'cape-b', 'monture-c'])
  })

  it('conserve avatarId et companionId inchangés', () => {
    const avatar = makeAvatar()
    const result = applyQuestReward(avatar, 10, 5, [])
    expect(result.avatarId).toBe(avatar.avatarId)
    expect(result.companionId).toBe(avatar.companionId)
  })

  describe('monotonie stricte (jamais de décroissance)', () => {
    it('un gain de 0 laisse xp et coins inchangés, jamais négatifs', () => {
      const avatar = makeAvatar({ xp: 50, coins: 20 })
      const result = applyQuestReward(avatar, 0, 0, [])
      expect(result.xp).toBe(50)
      expect(result.coins).toBe(20)
    })

    it('un montant négatif passé par erreur ne fait jamais décroître xp/coins', () => {
      const avatar = makeAvatar({ xp: 50, coins: 20 })
      const result = applyQuestReward(avatar, -100, -100, [])
      expect(result.xp).toBeGreaterThanOrEqual(avatar.xp)
      expect(result.coins).toBeGreaterThanOrEqual(avatar.coins)
    })

    it('une séquence de récompenses successives ne fait jamais redescendre xp ou coins', () => {
      let avatar = makeAvatar({ xp: 0, coins: 0 })
      const gains: Array<[number, number]> = [
        [10, 2],
        [0, 0],
        [30, 10],
        [-5, -5],
        [100, 50],
      ]
      let previousXp = avatar.xp
      let previousCoins = avatar.coins
      for (const [xpGained, coinsGained] of gains) {
        avatar = applyQuestReward(avatar, xpGained, coinsGained, [])
        expect(avatar.xp).toBeGreaterThanOrEqual(previousXp)
        expect(avatar.coins).toBeGreaterThanOrEqual(previousCoins)
        previousXp = avatar.xp
        previousCoins = avatar.coins
      }
    })
  })

  describe('pas de doublon', () => {
    it("n'ajoute pas un cosmétique déjà présent dans avatar.cosmetics", () => {
      const avatar = makeAvatar({ cosmetics: ['chapeau-a', 'cape-b'] })
      const result = applyQuestReward(avatar, 10, 5, ['chapeau-a'])
      expect(result.cosmetics).toEqual(['chapeau-a', 'cape-b'])
    })

    it('mélange cosmétiques déjà possédés et nouveaux sans dupliquer les possédés', () => {
      const avatar = makeAvatar({ cosmetics: ['chapeau-a'] })
      const result = applyQuestReward(avatar, 10, 5, ['chapeau-a', 'monture-c'])
      expect(result.cosmetics).toEqual(['chapeau-a', 'monture-c'])
      expect(result.cosmetics.filter((id) => id === 'chapeau-a')).toHaveLength(1)
    })

    it("ne duplique pas non plus si le même id apparaît deux fois dans cosmeticIdsUnlocked lui-même", () => {
      const avatar = makeAvatar({ cosmetics: [] })
      const result = applyQuestReward(avatar, 10, 5, ['cape-b', 'cape-b', 'monture-c'])
      expect(result.cosmetics).toEqual(['cape-b', 'monture-c'])
    })

    it('un avatar sans aucun cosmétique unlocké reste avec la même liste (référence différente, contenu égal)', () => {
      const avatar = makeAvatar({ cosmetics: ['chapeau-a'] })
      const result = applyQuestReward(avatar, 10, 5, [])
      expect(result.cosmetics).toEqual(['chapeau-a'])
      expect(result.cosmetics).not.toBe(avatar.cosmetics)
    })
  })
})
