// Réimplémentation JS pure de la logique dérivée de src/content/curriculum.ts
// (fonction graphemesKnownAtLevel) — voir ASSUMPTIONS.md section B4 pour le
// pourquoi de la duplication : tools/check.mjs ne peut pas importer les .ts
// de src/content/ (pas de runtime TypeScript disponible en ligne de
// commande). La signature et le comportement sont recopiés fidèlement :
// union cumulative des graphèmes enseignés au niveau `level` et à tous les
// niveaux précédents (1..level inclus).

/**
 * @param {object} curriculumData - contenu brut de curriculum.json (déjà parsé)
 * @param {number} level
 * @returns {Set<string>} graphemeIds connus à ce niveau ou avant
 */
export function graphemesKnownAtLevel(curriculumData, level) {
  const known = new Set()
  const graphemes = curriculumData?.graphemes ?? {}
  for (const grapheme of Object.values(graphemes)) {
    if (typeof grapheme?.level === 'number' && grapheme.level <= level) {
      known.add(grapheme.id)
    }
  }
  return known
}

/** Tous les graphemeIds déclarés dans curriculum.json, quel que soit leur niveau. */
export function allGraphemeIds(curriculumData) {
  return new Set(Object.keys(curriculumData?.graphemes ?? {}))
}
