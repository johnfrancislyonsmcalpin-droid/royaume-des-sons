// Comble un vide de contenu identifié en intégration (leaf E3, 1re passe) :
// le corpus pédagogique (B2, src/content/corpus/*.json) ne fournit AUCUN
// ContentItem de kind 'grapheme' — `syllables.json` ne commence qu'au
// niveau 3. Les niveaux 1 et 2 (Clairière des Voyelles, Forêt des Premières
// Consonnes) n'ont donc aucun item exploitable dans `corpus` pour leurs
// compétences (L1-nom-son-lettre, L1-voyelles, L2-consonnes), qui portent
// justement sur des graphèmes isolés (SPEC §5 : « Lettre → son, son →
// lettre »). Sans ce module, `assembleQuest` ne pourrait produire AUCUN défi
// pour les deux premières régions du jeu — c'est exactement le défaut
// « quête avec moins de compétences que de défis nécessaires » à chasser en
// 4e passe, ici corrigé plutôt que découvert en aval.
//
// Solution retenue, dans le périmètre OWNS de cette leaf (src/world/quest/**,
// jamais src/content/**) : dériver un ContentItem synthétique par graphème
// directement de `curriculum.graphemes` (déjà FIGÉ, déjà vérifié par B4).
// Aucun mot n'est inventé (CLAUDE.md règle #2) : `text` et `graphemeIds` sont
// littéralement l'id du graphème lui-même (ex. "a", "l"), une donnée
// curriculum, pas un littéral pédagogique nouveau. `skillIds` est dérivé des
// compétences qui référencent ce graphème via `skill.graphemeIds` (B1).
import type { ContentItem, Curriculum, GraphemeId } from '../../types'
import { curriculum } from '../../content/curriculum'
import { corpus } from '../../content/corpus'

function skillIdsForGrapheme(cur: Curriculum, graphemeId: GraphemeId): string[] {
  const ids: string[] = []
  for (const skill of Object.values(cur.skills)) {
    if (skill.graphemeIds.includes(graphemeId)) ids.push(skill.id)
  }
  return ids
}

/** Préfixe des id d'items synthétiques : ne peut jamais entrer en collision
 * avec un id du corpus réel (convention id du corpus : mots-clés lisibles
 * sans deux-points, voir src/content/corpus/*.json). */
export const SYNTHETIC_GRAPHEME_ID_PREFIX = 'grapheme:'

/**
 * Un ContentItem synthétique par graphème du curriculum, kind 'grapheme'.
 * Pure et déterministe : dérivé uniquement de `cur` (par défaut le
 * curriculum réel), jamais d'aléatoire ni d'horloge.
 */
export function buildSyntheticGraphemeItems(cur: Curriculum = curriculum): ContentItem[] {
  return Object.values(cur.graphemes).map((grapheme) => ({
    id: `${SYNTHETIC_GRAPHEME_ID_PREFIX}${grapheme.id}`,
    kind: 'grapheme' as const,
    level: grapheme.level,
    text: grapheme.id,
    graphemeIds: [grapheme.id],
    skillIds: skillIdsForGrapheme(cur, grapheme.id),
  }))
}

export const syntheticGraphemeItems: ContentItem[] = buildSyntheticGraphemeItems()

/** Pool complet utilisé par l'assemblage de quête (E3) : le corpus
 * pédagogique réel (B2) complété par les items de graphème synthétiques
 * ci-dessus, pour que chaque niveau du curriculum ait au moins un item
 * exploitable. */
export const questContentPool: ContentItem[] = [...corpus, ...syntheticGraphemeItems]

const poolIndex: Map<string, ContentItem> = new Map(questContentPool.map((item) => [item.id, item]))

/**
 * Résout un id vers son ContentItem dans le pool de la quête (corpus +
 * graphèmes synthétiques). Lève une erreur de développement claire si l'id
 * est inconnu (même convention que curriculum.ts/corpus.ts : jamais un item
 * malformé injecté silencieusement dans un Challenge).
 */
export function resolveQuestItem(id: string): ContentItem {
  const item = poolIndex.get(id)
  if (!item) {
    throw new Error(`[world/quest] item de contenu inconnu dans le pool de quête : "${id}"`)
  }
  return item
}
