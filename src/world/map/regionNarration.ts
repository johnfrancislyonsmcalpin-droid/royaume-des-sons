// Textes narrés de la carte du monde — Le Royaume des Sons (leaf E1).
//
// Décision libre (ASSUMPTIONS.md) : CurriculumLevel.labelKey (src/types.ts) est
// documenté comme « clé de narration du nom de région », donc une clé à
// résoudre, pas le texte lui-même — mais aucun dictionnaire de résolution
// (narration-strings) n'existe ni n'est possédé par une leaf accessible à E1
// (OWNS: src/world/map/** uniquement). Plutôt que d'inventer une dépendance sur
// un fichier qui n'est pas garanti stable, ce module reprend directement les
// noms de région du tableau SPEC §5 (la source de vérité pour ces noms), de la
// même façon que E2 (VERIFIED) a choisi d'écrire ses libellés d'avatar
// localement dans avatarData.ts plutôt que d'attendre un dictionnaire externe.
// Ce ne sont pas des mots/phrases du CORPUS PÉDAGOGIQUE (CLAUDE.md #2 : ce que
// l'enfant apprend à lire) mais des phrases d'interface/narration du jeu — la
// même catégorie que les libellés d'avatar déjà acceptés hors src/content/.
//
// Si une leaf ultérieure introduit un vrai dictionnaire labelKey -> texte
// (par ex. rattaché à A4/F3), le driver n'a qu'à remplacer `regionDisplayName`
// par un lookup sur ce dictionnaire : la signature ne change pas.

const REGION_DISPLAY_NAMES: Record<string, string> = {
  'clairiere-des-voyelles': 'La Clairière des Voyelles',
  'foret-des-premieres-consonnes': 'La Forêt des Premières Consonnes',
  'pont-des-syllabes': 'Le Pont des Syllabes',
  'village-des-mots': 'Le Village des Mots',
  'grotte-des-sons-qui-claquent': 'La Grotte des Sons qui Claquent',
  'lac-des-sons-a-deux-lettres': 'Le Lac des Sons à Deux Lettres',
  'marais-des-lettres-muettes': 'Le Marais des Lettres Muettes',
  'route-des-phrases': 'La Route des Phrases',
  'tour-des-histoires': 'La Tour des Histoires',
  'chateau-du-sortilege': 'Le Château du Sortilège',
}

/** Nom parlé d'une région ; retombe sur le regionId brut si jamais inconnu
 * (dégradation silencieuse, jamais de throw visible du joueur — CLAUDE.md). */
export function regionDisplayName(regionId: string): string {
  return REGION_DISPLAY_NAMES[regionId] ?? regionId
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
  return 'Voici la carte du royaume. Touche une région lumineuse pour commencer une quête.'
}

/** Narration jouée à l'apparition (première mention) d'une région dans la liste. */
export function regionAppearanceNarration(regionId: string, state: RegionMapState): string {
  const name = regionDisplayName(regionId)
  if (state === 'locked') return `${name}, encore cachée dans la brume.`
  if (state === 'completed') return `${name}, terminée. Bravo !`
  return `${name}, prête pour une nouvelle quête.`
}

/** Narration jouée quand l'enfant touche une région. */
export function regionTouchNarration(regionId: string, state: RegionMapState): string {
  const name = regionDisplayName(regionId)
  if (state === 'locked') return `${name} est encore cachée dans la brume. Continue tes quêtes pour la libérer.`
  return `Tu ouvres ${name}.`
}

/** Narration jouée à l'apparition de la liste de quêtes d'une région ouverte. */
export function questListAppearanceNarration(regionId: string): string {
  return `Voici les quêtes de ${regionDisplayName(regionId)}.`
}

/** Narration jouée quand l'enfant touche une quête. */
export function questTouchNarration(regionId: string, position: number, isBoss: boolean): string {
  const name = regionDisplayName(regionId)
  if (isBoss) return `Défi du gardien de ${name} !`
  return `Quête ${position} de ${name}.`
}
