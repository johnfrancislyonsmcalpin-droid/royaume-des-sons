// GB2 / G-B2 (SPEC §5) : volumes minimaux du corpus.
//
// | Élément                          | Minimum |
// |-----------------------------------|---------|
// | Syllabes CV, niveau 3              | 30      |
// | Mots, niveaux 3 à 7 (chacun)       | 40      |
// | Pseudo-mots, niveau 7              | 25      |
// | Phrases, niveau 8                  | 30      |
// | Textes, niveau 9                   | 12 (3 à 5 phrases chacun) |
// | Textes, niveau 10                  | 4 (5 à 6 phrases + 2 questions chacun) |
//
// Une "phrase" d'un texte multi-lignes est une ligne séparée par "\n"
// (convention B2.3, voir ASSUMPTIONS.md) : pas un découpage par ponctuation,
// qui fausserait le compte sur une ligne de dialogue contenant un "!" interne.

export const MIN_SYLLABLES_L3 = 30
export const MIN_WORDS_PER_LEVEL = 40
export const WORD_LEVELS = [3, 4, 5, 6, 7]
export const MIN_PSEUDOWORDS_L7 = 25
export const MIN_SENTENCES_L8 = 30
export const MIN_TEXTS_L9 = 12
export const L9_LINES_MIN = 3
export const L9_LINES_MAX = 5
export const MIN_TEXTS_L10 = 4
export const L10_LINES_MIN = 5
export const L10_LINES_MAX = 6
export const L10_QUESTIONS_EXPECTED = 2

function countLines(text) {
  return String(text ?? '')
    .split('\n')
    .filter((line) => line.trim().length > 0).length
}

function byKindLevel(corpusItems, kind, level) {
  return corpusItems.filter((item) => item.kind === kind && item.level === level)
}

/**
 * @param {Array<object>} corpusItems
 * @returns {Array<string>} liste des problèmes rencontrés, vide si tous les volumes sont atteints
 */
export function checkCounts(corpusItems) {
  const problems = []

  const syllablesL3 = byKindLevel(corpusItems, 'syllable', 3)
  if (syllablesL3.length < MIN_SYLLABLES_L3) {
    problems.push(`syllabes niveau 3 : ${syllablesL3.length} < ${MIN_SYLLABLES_L3}`)
  }

  for (const level of WORD_LEVELS) {
    const words = byKindLevel(corpusItems, 'word', level)
    if (words.length < MIN_WORDS_PER_LEVEL) {
      problems.push(`mots niveau ${level} : ${words.length} < ${MIN_WORDS_PER_LEVEL}`)
    }
  }

  const pseudowordsL7 = byKindLevel(corpusItems, 'pseudoword', 7)
  if (pseudowordsL7.length < MIN_PSEUDOWORDS_L7) {
    problems.push(`pseudo-mots niveau 7 : ${pseudowordsL7.length} < ${MIN_PSEUDOWORDS_L7}`)
  }

  const sentencesL8 = byKindLevel(corpusItems, 'sentence', 8)
  if (sentencesL8.length < MIN_SENTENCES_L8) {
    problems.push(`phrases niveau 8 : ${sentencesL8.length} < ${MIN_SENTENCES_L8}`)
  }

  const textsL9 = byKindLevel(corpusItems, 'text', 9)
  if (textsL9.length < MIN_TEXTS_L9) {
    problems.push(`textes niveau 9 : ${textsL9.length} < ${MIN_TEXTS_L9}`)
  }
  for (const text of textsL9) {
    const lines = countLines(text.text)
    if (lines < L9_LINES_MIN || lines > L9_LINES_MAX) {
      problems.push(
        `${text.id} (niveau 9) : ${lines} phrase(s), attendu entre ${L9_LINES_MIN} et ${L9_LINES_MAX}`,
      )
    }
  }

  const textsL10 = byKindLevel(corpusItems, 'text', 10)
  if (textsL10.length < MIN_TEXTS_L10) {
    problems.push(`textes niveau 10 : ${textsL10.length} < ${MIN_TEXTS_L10}`)
  }
  for (const text of textsL10) {
    const lines = countLines(text.text)
    if (lines < L10_LINES_MIN || lines > L10_LINES_MAX) {
      problems.push(
        `${text.id} (niveau 10) : ${lines} phrase(s), attendu entre ${L10_LINES_MIN} et ${L10_LINES_MAX}`,
      )
    }
    const questions = Array.isArray(text.questions) ? text.questions : []
    if (questions.length !== L10_QUESTIONS_EXPECTED) {
      problems.push(
        `${text.id} (niveau 10) : ${questions.length} question(s), attendu exactement ${L10_QUESTIONS_EXPECTED}`,
      )
    }
  }

  return problems
}
