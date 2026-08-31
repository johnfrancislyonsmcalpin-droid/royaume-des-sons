import { describe, expect, it } from 'vitest'
import { curriculum, graphemesKnownAtLevel, loadCurriculum } from './curriculum'

// Fixture recopiant fidèlement le tableau de SPEC.md §5 "Curriculum — 10 niveaux",
// indépendamment de curriculum.json, pour détecter toute erreur de transcription.
// Pour chaque niveau : le regionId attendu et les graphèmes NOUVEAUX enseignés à
// ce niveau précis (pas la liste cumulative).
const SPEC_LEVELS: {
  level: number
  regionId: string
  newGraphemeIds: string[]
}[] = [
  {
    level: 1,
    regionId: 'clairiere-des-voyelles',
    newGraphemeIds: ['a', 'i', 'o', 'u', 'é'],
  },
  {
    level: 2,
    regionId: 'foret-des-premieres-consonnes',
    newGraphemeIds: ['l', 'm', 'r', 's', 'p', 't'],
  },
  {
    // Pont des Syllabes : fusion CV avec N1+N2, pas de nouveau graphème isolé.
    level: 3,
    regionId: 'pont-des-syllabes',
    newGraphemeIds: [],
  },
  {
    // Village des Mots : décision pédagogique structurante — le e muet final
    // est enseigné ICI, dès le niveau 4.
    level: 4,
    regionId: 'village-des-mots',
    newGraphemeIds: ['f', 'v', 'n', 'd', 'b', 'c-dur', 'g-dur', 'k', 'e-muet'],
  },
  {
    // Grotte des Sons qui claquent : syllabes inversées + mots CVC + mnémotechnique
    // b/d/p/q — SPEC est explicite : "pas un nouveau son", donc aucun nouveau graphème.
    level: 5,
    regionId: 'grotte-des-sons-qui-claquent',
    newGraphemeIds: [],
  },
  {
    level: 6,
    regionId: 'lac-des-sons-a-deux-lettres',
    newGraphemeIds: [
      'ou',
      'on',
      'an',
      'en',
      'in',
      'oi',
      'eu',
      'ch',
      'gn',
      'au',
      'eau',
      'ai',
      'ei',
    ],
  },
  {
    // Marais des Lettres muettes : consonne finale muette, s=z, pluriel -s et
    // vrai mot/faux mot sont des règles/compétences sur des graphèmes déjà connus,
    // pas de nouveaux graphèmes hors c doux, g doux, qu, ph.
    level: 7,
    regionId: 'marais-des-lettres-muettes',
    newGraphemeIds: ['c-doux', 'g-doux', 'qu', 'ph'],
  },
  {
    level: 8,
    regionId: 'route-des-phrases',
    newGraphemeIds: [],
  },
  {
    level: 9,
    regionId: 'tour-des-histoires',
    newGraphemeIds: [],
  },
  {
    level: 10,
    regionId: 'chateau-du-sortilege',
    newGraphemeIds: [],
  },
]

describe('curriculum — conformité au tableau SPEC.md §5', () => {
  it('contient exactement les 10 niveaux, dans l\'ordre 1 à 10', () => {
    expect(curriculum.levels.map((l) => l.level)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
  })

  it.each(SPEC_LEVELS)(
    'niveau $level ($regionId) a le bon regionId et les bons nouveaux graphèmes',
    ({ level, regionId, newGraphemeIds }) => {
      const curriculumLevel = curriculum.levels.find((l) => l.level === level)
      expect(curriculumLevel, `niveau ${level} absent`).toBeDefined()
      expect(curriculumLevel?.regionId).toBe(regionId)

      const actualNewGraphemeIds = Object.values(curriculum.graphemes)
        .filter((g) => g.level === level)
        .map((g) => g.id)
        .sort()

      expect(actualNewGraphemeIds).toEqual([...newGraphemeIds].sort())
    },
  )

  it('le e muet final apparaît au niveau 4, et seulement au niveau 4', () => {
    expect(curriculum.graphemes['e-muet']).toBeDefined()
    expect(curriculum.graphemes['e-muet'].level).toBe(4)

    // Absent de tout niveau antérieur : ni dans les graphèmes de niveau < 4,
    // ni connu avant le niveau 4 via l'union cumulative.
    const graphemesBeforeLevel4 = Object.values(curriculum.graphemes).filter(
      (g) => g.level < 4,
    )
    expect(graphemesBeforeLevel4.map((g) => g.id)).not.toContain('e-muet')
    expect(graphemesKnownAtLevel(3).has('e-muet')).toBe(false)
    expect(graphemesKnownAtLevel(4).has('e-muet')).toBe(true)
  })

  it('chaque graphème couvert par le curriculum a un niveau entre 1 et 10 et une pronunciationKey', () => {
    for (const grapheme of Object.values(curriculum.graphemes)) {
      expect(grapheme.level).toBeGreaterThanOrEqual(1)
      expect(grapheme.level).toBeLessThanOrEqual(10)
      expect(grapheme.pronunciationKey.length).toBeGreaterThan(0)
    }
  })

  it('le total des graphèmes correspond exactement à l\'union des nouveaux graphèmes par niveau', () => {
    const expectedTotal = SPEC_LEVELS.flatMap((l) => l.newGraphemeIds)
    expect(Object.keys(curriculum.graphemes).sort()).toEqual(
      [...expectedTotal].sort(),
    )
  })

  it('chaque niveau référence au moins une compétence (skillIds non vide)', () => {
    for (const level of curriculum.levels) {
      expect(level.skillIds.length).toBeGreaterThan(0)
    }
  })

  it('chaque niveau a un bossQuestId non vide', () => {
    for (const level of curriculum.levels) {
      expect(level.bossQuestId.length).toBeGreaterThan(0)
    }
  })
})

describe('auto-coherence', () => {
  it('aucune compétence ne référence un graphème de niveau supérieur au sien', () => {
    const offenders: string[] = []
    for (const skill of Object.values(curriculum.skills)) {
      for (const graphemeId of skill.graphemeIds) {
        const grapheme = curriculum.graphemes[graphemeId]
        if (!grapheme) {
          offenders.push(
            `skill "${skill.id}" référence le graphemeId inconnu "${graphemeId}"`,
          )
          continue
        }
        if (grapheme.level > skill.level) {
          offenders.push(
            `skill "${skill.id}" (niveau ${skill.level}) référence "${graphemeId}" (niveau ${grapheme.level})`,
          )
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('chaque compétence référencée par un niveau existe et a le même niveau que celui qui la référence', () => {
    const offenders: string[] = []
    for (const level of curriculum.levels) {
      for (const skillId of level.skillIds) {
        const skill = curriculum.skills[skillId]
        if (!skill) {
          offenders.push(`niveau ${level.level} référence le skillId inconnu "${skillId}"`)
          continue
        }
        if (skill.level !== level.level) {
          offenders.push(
            `skill "${skillId}" a le niveau ${skill.level} mais est référencé par le niveau ${level.level}`,
          )
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('chaque compétence appartient à un niveau entre 1 et 10', () => {
    for (const skill of Object.values(curriculum.skills)) {
      expect(skill.level).toBeGreaterThanOrEqual(1)
      expect(skill.level).toBeLessThanOrEqual(10)
    }
  })

  it('le loader rejette une structure invalide avec un message clair', () => {
    expect(() => loadCurriculum(null)).toThrow()
    expect(() => loadCurriculum({})).toThrow()
    const tenLevelsWithBadSkillRef = Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      regionId: `region-${i + 1}`,
      labelKey: `label-${i + 1}`,
      skillIds: [i === 0 ? 'inconnu' : `skill-${i + 1}`],
      bossQuestId: `boss-${i + 1}`,
    }))
    expect(() =>
      loadCurriculum({
        levels: tenLevelsWithBadSkillRef,
        skills: Object.fromEntries(
          tenLevelsWithBadSkillRef
            .slice(1)
            .map((l) => [l.skillIds[0], { id: l.skillIds[0], level: l.level, label: 'x', graphemeIds: [] }]),
        ),
        graphemes: {},
      }),
    ).toThrow(/skillId/)

    const tenLevelsWithBadGraphemeRef = Array.from({ length: 10 }, (_, i) => ({
      level: i + 1,
      regionId: `region-${i + 1}`,
      labelKey: `label-${i + 1}`,
      skillIds: [`skill-${i + 1}`],
      bossQuestId: `boss-${i + 1}`,
    }))
    expect(() =>
      loadCurriculum({
        levels: tenLevelsWithBadGraphemeRef,
        skills: Object.fromEntries(
          tenLevelsWithBadGraphemeRef.map((l) => [
            l.skillIds[0],
            {
              id: l.skillIds[0],
              level: l.level,
              label: 'x',
              graphemeIds: l.level === 1 ? ['inconnu'] : [],
            },
          ]),
        ),
        graphemes: {},
      }),
    ).toThrow(/graphemeId/)
  })
})

describe('graphemesKnownAtLevel', () => {
  // Union cumulative attendue, dérivée indépendamment de la fixture SPEC ci-dessus
  // (pas de curriculum.json), pour n = 1 à 10.
  function expectedCumulative(n: number): Set<string> {
    const set = new Set<string>()
    for (const level of SPEC_LEVELS) {
      if (level.level <= n) {
        for (const g of level.newGraphemeIds) set.add(g)
      }
    }
    return set
  }

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])(
    'retourne l\'union cumulative correcte pour le niveau %i',
    (n) => {
      const actual = graphemesKnownAtLevel(n)
      const expected = expectedCumulative(n)
      expect([...actual].sort()).toEqual([...expected].sort())
    },
  )

  it('n=1 ne contient que les 5 voyelles du niveau 1', () => {
    const result = graphemesKnownAtLevel(1)
    expect(result.size).toBe(5)
    expect([...result].sort()).toEqual(['a', 'i', 'o', 'u', 'é'].sort())
  })

  it('n=10 contient tous les graphèmes du curriculum (37 au total)', () => {
    const result = graphemesKnownAtLevel(10)
    expect(result.size).toBe(Object.keys(curriculum.graphemes).length)
    expect(result.size).toBe(37)
  })

  it('est strictement croissant en taille (jamais de régression) de n=1 à n=10', () => {
    let previousSize = 0
    for (let n = 1; n <= 10; n++) {
      const size = graphemesKnownAtLevel(n).size
      expect(size).toBeGreaterThanOrEqual(previousSize)
      previousSize = size
    }
  })

  it('graphemesKnownAtLevel(n) est un sur-ensemble de graphemesKnownAtLevel(n-1) pour tout n', () => {
    for (let n = 2; n <= 10; n++) {
      const previous = graphemesKnownAtLevel(n - 1)
      const current = graphemesKnownAtLevel(n)
      for (const id of previous) {
        expect(current.has(id)).toBe(true)
      }
    }
  })
})
