// GB5 / G-B5 (SPEC §7) : chaque distracteur provient de la table de confusion
// ou d'items déjà rencontrés, jamais du hasard non contraint sur tout le
// corpus. La vraie sélection de distracteurs est un comportement runtime du
// moteur (src/engine/distractors.ts, leaf D2) : ce n'est pas une donnée
// statique, donc GB5 est vérifié statiquement en deux parties documentées
// dans ASSUMPTIONS.md section B4 :
//
//  (a) checkConfusionIds : chaque id référencé par confusion.json (clé ou
//      valeur) est soit un GraphemeId réel de curriculum.json, soit un des
//      deux identifiants symboliques documentés `z`/`j` (ASSUMPTIONS.md
//      section B3 : le curriculum n'a pas de graphème isolé pour le son /z/
//      -- règle "s entre voyelles" -- ni pour /ʒ/ -- g-doux -- donc
//      confusion.json les référence quand même pour rester fidèle aux
//      paires phonétiques de SPEC §7, sans jamais produire de crash ni de
//      distracteur invalide côté moteur : D2 retombe sur son repli quand la
//      recherche par graphème confusable ne trouve aucun item).
//
//  (b) checkNoUnconstrainedRandom : scan statique (regex, pas un vrai parseur
//      JS/TS) de src/engine/distractors.ts pour confirmer que `shuffle(...)`
//      -- le seul point d'entrée du hasard (rng) dans ce module -- n'est
//      jamais appelé directement sur le pool brut/non filtré. Un appel
//      shuffle(X) n'est accepté que si X est une variable locale déclarée
//      via une expression contenant `.filter(` (ex. confusionSourced,
//      encounteredSourced) : ce sont les deux seules sources autorisées par
//      SPEC §7. Un futur `shuffle(pool, rng)` ou `pool[Math.floor(Math.random()...)]`
//      appliqué au pool brut serait détecté comme une régression.

export const SYMBOLIC_CONFUSION_IDS = ['z', 'j']

/**
 * @param {object} curriculumData
 * @param {Record<string, string[]>} confusionData
 * @returns {Array<{id:string, context:string}>}
 */
export function checkConfusionIds(curriculumData, confusionData) {
  const validIds = new Set(Object.keys(curriculumData?.graphemes ?? {}))
  const allowed = new Set(SYMBOLIC_CONFUSION_IDS)
  const invalid = []

  for (const [key, values] of Object.entries(confusionData ?? {})) {
    if (!validIds.has(key) && !allowed.has(key)) {
      invalid.push({ id: key, context: 'clé de confusion.json' })
    }
    if (!Array.isArray(values)) {
      invalid.push({ id: key, context: 'valeur de confusion.json doit être un tableau' })
      continue
    }
    for (const value of values) {
      if (!validIds.has(value) && !allowed.has(value)) {
        invalid.push({ id: value, context: `valeur associée à la clé "${key}"` })
      }
    }
  }
  return invalid
}

/**
 * Extrait les déclarations `const NAME = <expr>` d'un texte source, en
 * capturant `<expr>` par comptage de profondeur de parenthèses/accolades/
 * crochets (pas un vrai lexer JS/TS, mais suffisant pour ce fichier sans
 * chaînes contenant des parenthèses non équilibrées).
 */
function extractDeclarations(sourceText) {
  const decls = new Map()
  const declStart = /const\s+([A-Za-z0-9_]+)\s*=\s*/g
  let match
  while ((match = declStart.exec(sourceText))) {
    const name = match[1]
    let i = declStart.lastIndex
    let depth = 0
    const start = i
    for (; i < sourceText.length; i += 1) {
      const ch = sourceText[i]
      if (ch === '(' || ch === '[' || ch === '{') {
        depth += 1
      } else if (ch === ')' || ch === ']' || ch === '}') {
        if (depth === 0) break
        depth -= 1
      } else if (ch === '\n' && depth === 0) {
        break
      }
    }
    decls.set(name, sourceText.slice(start, i))
  }
  return decls
}

/**
 * @param {string} sourceText - contenu de src/engine/distractors.ts (ou d'une fixture)
 * @returns {string[]} violations détectées, vide si aucune
 */
export function checkNoUnconstrainedRandom(sourceText) {
  const violations = []
  const declarations = extractDeclarations(sourceText)

  const shuffleCallRe = /shuffle\(\s*([A-Za-z0-9_]+)/g
  let match
  while ((match = shuffleCallRe.exec(sourceText))) {
    const arg = match[1]
    const expr = declarations.get(arg)
    if (!expr || !expr.includes('.filter(')) {
      violations.push(
        `shuffle(${arg}, ...) : "${arg}" n'est pas dérivé d'un .filter( sur la table de confusion ou les items rencontrés`,
      )
    }
  }

  const directIndexRe = /([A-Za-z0-9_]+)\[\s*Math\.floor\(\s*Math\.random\(/g
  while ((match = directIndexRe.exec(sourceText))) {
    const arg = match[1]
    const expr = declarations.get(arg)
    if (!expr || !expr.includes('.filter(')) {
      violations.push(
        `${arg}[Math.floor(Math.random(...))] : indexation directe par hasard sur "${arg}", non filtré`,
      )
    }
  }

  return violations
}
