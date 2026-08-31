// Dérivation des quêtes par région — Le Royaume des Sons (leaf E1).
//
// SPEC §4 : « Chaque région contient 4 à 6 quêtes ; la dernière est un boss. »
// Le curriculum (leaf B1, VERIFIED) ne fournit qu'un `bossQuestId` par niveau —
// il n'invente pas les quêtes régulières qui le précèdent. Ce module comble cet
// écart de façon déterministe et pure (aucun aléatoire, aucun accès réseau/DOM),
// pour que la carte du monde (WorldMap.tsx) et ses tests s'appuient sur la même
// source.
//
// Décision libre (ASSUMPTIONS.md) : exactement 5 quêtes par région (4 quêtes
// régulières + 1 boss), constante pour les 10 régions. C'est une valeur au
// milieu de la fourchette 4-6 imposée par SPEC §4 : simple, uniforme, et laisse
// à une leaf ultérieure (E3, moteur de quête) toute latitude pour varier ce
// nombre région par région si le contenu réel (corpus B2) le justifie — WorldMap
// ne fait alors que refléter regionQuests.ts, pas l'inverse.
//
// L'id de la quête boss est TOUJOURS `level.bossQuestId` tel quel (jamais un id
// généré) : c'est le contrat testé par le gate G2 et par node-E à l'intégration.

import type { CurriculumLevel } from '../../types'

export const QUESTS_PER_REGION = 5
const REGULAR_QUESTS_PER_REGION = QUESTS_PER_REGION - 1

export interface RegionQuest {
  id: string
  regionId: string
  /** Position 1-indexée dans la région, dans l'ordre de jeu. */
  position: number
  isBoss: boolean
}

export interface RegionQuests {
  regionId: string
  level: number
  quests: RegionQuest[]
}

/**
 * Construit, pour chaque niveau du curriculum, la liste ordonnée de ses
 * quêtes : `REGULAR_QUESTS_PER_REGION` quêtes régulières puis exactement une
 * quête boss en dernière position, dont l'id est `level.bossQuestId`.
 *
 * Pure et déterministe : un même `levels` produit toujours le même résultat,
 * dans le même ordre que `levels` (qui est lui-même vérifié 1..10 sans trou ni
 * doublon par `loadCurriculum`, voir src/content/curriculum.ts).
 */
export function buildRegionQuests(levels: readonly CurriculumLevel[]): RegionQuests[] {
  return levels.map((level) => {
    const quests: RegionQuest[] = []
    for (let position = 1; position <= REGULAR_QUESTS_PER_REGION; position++) {
      quests.push({
        id: `${level.regionId}-q${position}`,
        regionId: level.regionId,
        position,
        isBoss: false,
      })
    }
    quests.push({
      id: level.bossQuestId,
      regionId: level.regionId,
      position: QUESTS_PER_REGION,
      isBoss: true,
    })
    return { regionId: level.regionId, level: level.level, quests }
  })
}
