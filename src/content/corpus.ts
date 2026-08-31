// Loader du corpus complet — assemble tous les fichiers `corpus/*.json`
// (B2.1-B2.4) en un unique ContentItem[] validé (SPEC §5, §0 : les contrats de
// src/types.ts font foi). Ce module ne contient aucun contenu pédagogique en
// dur : tout vit dans les fichiers JSON sous src/content/corpus/.

import type { ContentItem, ContentItemKind, TextQuestion } from '../types'

import rawSyllables from './corpus/syllables.json'
import rawWordsL35 from './corpus/words-l3-5.json'
import rawWordsL67 from './corpus/words-l6-7.json'
import rawPseudowords from './corpus/pseudowords.json'
import rawSentencesL8 from './corpus/sentences-l8.json'
import rawTextsL9 from './corpus/texts-l9.json'
import rawTextsL10 from './corpus/texts-l10.json'

function fail(message: string): never {
  throw new Error(`[corpus] structure invalide : ${message}`)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

const VALID_KINDS: ContentItemKind[] = [
  'grapheme',
  'syllable',
  'word',
  'pseudoword',
  'sentence',
  'text',
]

function validateQuestion(value: unknown, itemId: string, index: number): TextQuestion {
  if (typeof value !== 'object' || value === null) {
    fail(`${itemId}.questions[${index}] n'est pas un objet`)
  }
  const candidate = value as Record<string, unknown>
  if (!isNonEmptyString(candidate.id)) {
    fail(`${itemId}.questions[${index}].id manquant`)
  }
  if (!isNonEmptyString(candidate.promptKey)) {
    fail(`${itemId}.questions[${index}].promptKey manquant`)
  }
  if (!Array.isArray(candidate.answerOptions) || !candidate.answerOptions.every(isNonEmptyString)) {
    fail(`${itemId}.questions[${index}].answerOptions doit être un tableau de chaînes`)
  }
  const answerOptions = candidate.answerOptions as string[]
  if (
    !isFiniteNumber(candidate.correctIndex) ||
    candidate.correctIndex < 0 ||
    candidate.correctIndex >= answerOptions.length
  ) {
    fail(`${itemId}.questions[${index}].correctIndex invalide`)
  }
  return {
    id: candidate.id,
    promptKey: candidate.promptKey,
    answerOptions,
    correctIndex: candidate.correctIndex,
  }
}

function validateItem(value: unknown, sourceFile: string, index: number): ContentItem {
  if (typeof value !== 'object' || value === null) {
    fail(`${sourceFile}[${index}] n'est pas un objet`)
  }
  const candidate = value as Record<string, unknown>

  if (!isNonEmptyString(candidate.id)) {
    fail(`${sourceFile}[${index}].id manquant`)
  }
  const id = candidate.id

  if (!isNonEmptyString(candidate.kind) || !VALID_KINDS.includes(candidate.kind as ContentItemKind)) {
    fail(`${id} : kind invalide "${String(candidate.kind)}"`)
  }
  if (!isFiniteNumber(candidate.level) || candidate.level < 1 || candidate.level > 10) {
    fail(`${id} : level doit être un nombre entre 1 et 10`)
  }
  if (!isNonEmptyString(candidate.text)) {
    fail(`${id} : text manquant`)
  }
  if (!Array.isArray(candidate.graphemeIds) || !candidate.graphemeIds.every(isNonEmptyString)) {
    fail(`${id} : graphemeIds doit être un tableau de chaînes`)
  }
  if (!Array.isArray(candidate.skillIds) || !candidate.skillIds.every(isNonEmptyString)) {
    fail(`${id} : skillIds doit être un tableau de chaînes`)
  }
  if (candidate.kind === 'word' && !isNonEmptyString(candidate.emoji)) {
    fail(`${id} : les items de kind "word" doivent avoir un emoji`)
  }
  if (candidate.emoji !== undefined && !isNonEmptyString(candidate.emoji)) {
    fail(`${id} : emoji doit être une chaîne non vide si présent`)
  }
  if (candidate.isSightWord !== undefined && typeof candidate.isSightWord !== 'boolean') {
    fail(`${id} : isSightWord doit être un booléen si présent`)
  }

  let questions: TextQuestion[] | undefined
  if (candidate.questions !== undefined) {
    if (!Array.isArray(candidate.questions)) {
      fail(`${id} : questions doit être un tableau si présent`)
    }
    questions = candidate.questions.map((q, qi) => validateQuestion(q, id, qi))
  }

  const item: ContentItem = {
    id,
    kind: candidate.kind as ContentItemKind,
    level: candidate.level,
    text: candidate.text,
    graphemeIds: candidate.graphemeIds as string[],
    skillIds: candidate.skillIds as string[],
  }
  if (candidate.emoji !== undefined) item.emoji = candidate.emoji as string
  if (candidate.isSightWord !== undefined) item.isSightWord = candidate.isSightWord as boolean
  if (questions !== undefined) item.questions = questions

  return item
}

function loadFile(raw: unknown, sourceFile: string): ContentItem[] {
  if (!Array.isArray(raw)) {
    fail(`${sourceFile} doit être un tableau`)
  }
  return raw.map((value, index) => validateItem(value, sourceFile, index))
}

const SOURCES: Array<[unknown, string]> = [
  [rawSyllables, 'syllables.json'],
  [rawWordsL35, 'words-l3-5.json'],
  [rawWordsL67, 'words-l6-7.json'],
  [rawPseudowords, 'pseudowords.json'],
  [rawSentencesL8, 'sentences-l8.json'],
  [rawTextsL9, 'texts-l9.json'],
  [rawTextsL10, 'texts-l10.json'],
]

function loadCorpus(): ContentItem[] {
  const items: ContentItem[] = []
  const seenIds = new Set<string>()
  for (const [raw, sourceFile] of SOURCES) {
    for (const item of loadFile(raw, sourceFile)) {
      if (seenIds.has(item.id)) {
        fail(`id "${item.id}" dupliqué (rencontré dans ${sourceFile})`)
      }
      seenIds.add(item.id)
      items.push(item)
    }
  }
  return items
}

export const corpus: ContentItem[] = loadCorpus()
