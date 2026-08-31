// Textes narrés de la carte du monde — Le Royaume des Sons (leaf E1).
//
// Les libellés viennent de src/content/uiText.json (voir GB6,
// tools/check.mjs code --no-hardcoded-content) : ce module ne fait que
// résoudre l'état (locked/completed/current) vers la bonne clé et
// interpoler le nom de région, jamais de phrase française en dur ici.

import { formatUiText, uiText } from '../../content/uiText'

/** Nom parlé d'une région ; retombe sur le regionId brut si jamais inconnu
 * (dégradation silencieuse, jamais de throw visible du joueur — CLAUDE.md). */
export function regionDisplayName(regionId: string): string {
  return uiText.map.regionNames[regionId] ?? regionId
}

export type RegionMapState = 'locked' | 'current' | 'completed'

/** État visuel/narratif d'une région, dérivé de ProgressState uniquement
 * (aucun champ « complétée » dédié dans ProgressState — src/types.ts est figé,
 * voir ASSUMPTIONS.md : une région est « completed » quand son niveau est
 * strictement inférieur à progress.currentLevel ET qu'elle est débloquée). */
export function deriveRegionState(
  level: number,
  regionId: string,
  unlockedRegionIds: readonly string[],
  currentLevel: number,
): RegionMapState {
  if (!unlockedRegionIds.includes(regionId)) return 'locked'
  if (level < currentLevel) return 'completed'
  return 'current'
}

/** Narration jouée à l'apparition de la carte (une seule fois, écran entier). */
export function mapOverviewNarration(): string {
  return uiText.map.overview
}

/** Narration jouée à l'apparition (première mention) d'une région dans la liste. */
export function regionAppearanceNarration(regionId: string, state: RegionMapState): string {
  const name = regionDisplayName(regionId)
  if (state === 'locked') return formatUiText(uiText.map.regionLocked, { name })
  if (state === 'completed') return formatUiText(uiText.map.regionCompleted, { name })
  return formatUiText(uiText.map.regionCurrent, { name })
}

/** Narration jouée quand l'enfant touche une région. */
export function regionTouchNarration(regionId: string, state: RegionMapState): string {
  const name = regionDisplayName(regionId)
  if (state === 'locked') return formatUiText(uiText.map.regionTouchLocked, { name })
  return formatUiText(uiText.map.regionTouchOpen, { name })
}

/** Narration jouée à l'apparition de la liste de quêtes d'une région ouverte. */
export function questListAppearanceNarration(regionId: string): string {
  return formatUiText(uiText.map.questListAppearance, { name: regionDisplayName(regionId) })
}

/** Narration jouée quand l'enfant touche une quête. */
export function questTouchNarration(regionId: string, position: number, isBoss: boolean): string {
  const name = regionDisplayName(regionId)
  if (isBoss) return formatUiText(uiText.map.questTouchBoss, { name })
  return formatUiText(uiText.map.questTouchRegular, { name, position })
}
