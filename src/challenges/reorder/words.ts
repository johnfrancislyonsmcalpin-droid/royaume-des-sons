// Découpage d'une phrase cible en pièces "mot" + mélange, pour Remets en
// ordre (C4, SPEC §6.5). Séparé de Reorder.tsx pour rester testable comme
// pure logique, indépendamment du rendu React.
//
// Convention de découpage (décision consignée, le comportement exact n'est
// pas entièrement fixé par SPEC.md) :
// - Le découpage en mots se fait sur les espaces (`text.trim().split(/\s+/)`).
//   Chaque `raw` token conserve la ponctuation éventuellement collée au mot
//   dans le texte source (ex. "chat," ou "dort.").
// - `display` retire la ponctuation de début/fin d'un token pour ce que
//   l'enfant voit et entend prononcer sur la pièce ("chat", "dort") — un
//   enfant de 5 ans qui ne sait pas encore lire n'a pas à décoder une virgule
//   collée à un mot pour reconnaître la pièce.
// - La ponctuation n'est PAS perdue : elle reste portée par `raw`, qui est ce
//   qui sert à vérifier l'ordre final (voir `isCorrectOrder`). Reconstituer
//   l'ordre exact des `raw` revient donc à restituer la ponctuation dans la
//   comparaison, sans avoir à la ré-attacher manuellement à la fin.
// - Chaque token porte un `id` stable dérivé de sa position d'origine
//   (`word-0`, `word-1`, ...), jamais du texte du mot : deux occurrences du
//   même mot dans une phrase (ex. "le chat regarde le chien") doivent rester
//   des pièces distinctes et se comparer par position, pas par égalité de
//   texte.

/** Ponctuation à retirer en tête/fin d'un mot pour l'affichage de la pièce.
 * Couvre la ponctuation française courante (SPEC §5 niveaux 8-9 : point,
 * virgule, `?`, `!`, tiret de dialogue, guillemets). */
const LEADING_PUNCTUATION_RE = /^[.,!?;:…»«"'"'()[\]—-]+/
const TRAILING_PUNCTUATION_RE = /[.,!?;:…»«"'"'()[\]—-]+$/

export interface SentenceWordToken {
  /** Identifiant stable dérivé de la position d'origine dans la phrase — pas
   * du texte du mot (deux occurrences du même mot doivent rester distinctes). */
  id: string
  /** Position d'origine (0-based) dans la phrase cible. */
  index: number
  /** Token exactement tel que découpé du texte source, ponctuation collée
   * comprise — c'est ce qui sert à vérifier l'ordre final. */
  raw: string
  /** Texte affiché/énoncé sur la pièce, ponctuation de bord retirée. */
  display: string
}

/** Découpe une phrase en pièces "mot" dans leur ordre d'origine (jamais
 * mélangé ici — voir `shuffleWords`). Phrase vide ou blanche : tableau vide,
 * jamais d'exception. */
export function tokenizeSentence(text: string): SentenceWordToken[] {
  const rawTokens = text
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)

  return rawTokens.map((raw, index) => {
    const stripped = raw.replace(LEADING_PUNCTUATION_RE, '').replace(TRAILING_PUNCTUATION_RE, '')
    return {
      id: `word-${index}`,
      index,
      raw,
      // Repli sur `raw` si le token n'était QUE de la ponctuation (cas
      // dégénéré qui ne devrait pas exister dans un corpus de phrases, mais
      // ne doit jamais faire disparaître silencieusement une pièce).
      display: stripped.length > 0 ? stripped : raw,
    }
  })
}

function sameOrder(a: readonly SentenceWordToken[], b: readonly SentenceWordToken[]): boolean {
  return a.length === b.length && a.every((token, index) => token.id === b[index].id)
}

function fisherYates<T>(input: readonly T[]): T[] {
  const shuffled = [...input]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

/**
 * Mélange réellement les pièces (Fisher-Yates), en garantissant que le
 * résultat n'est JAMAIS exactement l'ordre d'origine (SPEC §6.5 : "jamais
 * dans le bon ordre par défaut"). Avec 0 ou 1 pièce, aucun autre ordre
 * n'existe : retourne une copie telle quelle plutôt que de boucler
 * indéfiniment.
 */
export function shuffleWords(tokens: readonly SentenceWordToken[]): SentenceWordToken[] {
  if (tokens.length <= 1) return [...tokens]

  let shuffled = fisherYates(tokens)
  // Le mélange doit rester un VRAI tirage aléatoire (gate G3) : on ne biaise
  // jamais volontairement une position précise, on retire seulement la seule
  // issue qui annulerait le défi (l'ordre identique à l'original).
  while (sameOrder(shuffled, tokens)) {
    shuffled = fisherYates(tokens)
  }
  return shuffled
}

/** Vrai si les pièces posées dans `slots`, dans cet ordre, reconstituent
 * exactement la phrase cible (mêmes tokens, y compris la ponctuation portée
 * par `raw`, dans le même ordre). `null` (emplacement vide) n'est jamais
 * correct : un ordre partiel ne déclenche jamais de succès. */
export function isCorrectOrder(
  slots: ReadonlyArray<SentenceWordToken | null>,
  target: readonly SentenceWordToken[],
): boolean {
  if (slots.length !== target.length) return false
  return slots.every((piece, index) => piece !== null && piece.raw === target[index].raw && piece.id === target[index].id)
}
