#!/usr/bin/env node
// tools/check.mjs — vérificateur mécanique des contraintes de contenu
// (SPEC §5/§7, CLAUDE.md règles #2/#3). Node pur, aucune dépendance npm,
// aucune importation des loaders .ts de src/content/ (voir ASSUMPTIONS.md
// section B4 pour le pourquoi). Chaque sous-commande n'imprime son marqueur
// de succès qu'après que TOUTES ses assertions ont réellement passé ; sur
// échec, elle liste chaque violation et quitte avec un code non nul.
//
// Usage :
//   node tools/check.mjs content --graphemes
//   node tools/check.mjs content --counts
//   node tools/check.mjs content --emoji
//   node tools/check.mjs content --pronunciation
//   node tools/check.mjs content --distractors
//   node tools/check.mjs code --no-hardcoded-content
//   node tools/check.mjs self-test --negative-controls
//   node tools/check.mjs all

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readJson, readText } from './lib/io.mjs'
import { loadCorpus, loadCorpusFile } from './lib/loadContent.mjs'
import { checkGraphemes } from './lib/checks/graphemes.mjs'
import { checkCounts } from './lib/checks/counts.mjs'
import { checkEmoji } from './lib/checks/emoji.mjs'
import { checkPronunciation } from './lib/checks/pronunciation.mjs'
import { checkConfusionIds, checkNoUnconstrainedRandom } from './lib/checks/distractors.mjs'
import { checkNoHardcodedContent, scanSourceForHardcodedContent } from './lib/checks/hardcoded.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const CONTENT_DIR = path.join(ROOT, 'src', 'content')
const CORPUS_DIR = path.join(CONTENT_DIR, 'corpus')
const CURRICULUM_PATH = path.join(CONTENT_DIR, 'curriculum.json')
const PRONUNCIATION_PATH = path.join(CONTENT_DIR, 'pronunciation.json')
const CONFUSION_PATH = path.join(CONTENT_DIR, 'confusion.json')
const DISTRACTORS_SRC_PATH = path.join(ROOT, 'src', 'engine', 'distractors.ts')
const SRC_DIR = path.join(ROOT, 'src')
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'invalid')

// --- Sous-commandes content ------------------------------------------------

function runGraphemesCheck() {
  const curriculumData = readJson(CURRICULUM_PATH)
  const corpusItems = loadCorpus(CORPUS_DIR)
  const violations = checkGraphemes(curriculumData, corpusItems)
  if (violations.length === 0) {
    console.log('content --graphemes : 0 violation')
    return true
  }
  console.error(`content --graphemes : ${violations.length} violation(s)`)
  for (const v of violations) {
    console.error(
      `  - ${v.itemId} (niveau ${v.level}, ${v.sourceFile}) utilise le graphème "${v.grapheme}" non enseigné à ce niveau`,
    )
  }
  return false
}

function runCountsCheck() {
  const corpusItems = loadCorpus(CORPUS_DIR)
  const problems = checkCounts(corpusItems)
  if (problems.length === 0) {
    console.log('content --counts : all levels ok')
    return true
  }
  console.error(`content --counts : ${problems.length} problème(s)`)
  for (const p of problems) console.error(`  - ${p}`)
  return false
}

function runEmojiCheck() {
  const corpusItems = loadCorpus(CORPUS_DIR)
  const { missing, duplicates } = checkEmoji(corpusItems)
  if (missing.length === 0 && duplicates.length === 0) {
    console.log('content --emoji : 0 missing, 0 duplicate')
    return true
  }
  console.error(`content --emoji : ${missing.length} missing, ${duplicates.length} duplicate`)
  for (const m of missing) console.error(`  - manquant : ${m.id} ("${m.text}")`)
  for (const d of duplicates) console.error(`  - dupliqué : "${d.emoji}" utilisé par ${d.texts.join(', ')}`)
  return false
}

function runPronunciationCheck() {
  const curriculumData = readJson(CURRICULUM_PATH)
  const pronunciationData = readJson(PRONUNCIATION_PATH)
  const { total, missing } = checkPronunciation(curriculumData, pronunciationData)
  const covered = total - missing.length
  const pct = total === 0 ? 100 : Math.round((covered / total) * 100)
  if (missing.length === 0) {
    console.log(`content --pronunciation : coverage 100% (${covered}/${total})`)
    return true
  }
  console.error(`content --pronunciation : coverage ${pct}% (${covered}/${total})`)
  for (const m of missing) console.error(`  - ${m}`)
  return false
}

function runDistractorsCheck() {
  const curriculumData = readJson(CURRICULUM_PATH)
  const confusionData = readJson(CONFUSION_PATH)
  const idViolations = checkConfusionIds(curriculumData, confusionData)

  const distractorsSource = readText(DISTRACTORS_SRC_PATH)
  const randomViolations = checkNoUnconstrainedRandom(distractorsSource)

  const total = idViolations.length + randomViolations.length
  if (total === 0) {
    console.log('content --distractors : 0 invalid confusion id, 0 random distractor')
    return true
  }
  console.error(
    `content --distractors : ${idViolations.length} invalid confusion id, ${randomViolations.length} random distractor`,
  )
  for (const v of idViolations) console.error(`  - id invalide "${v.id}" (${v.context})`)
  for (const v of randomViolations) console.error(`  - ${v}`)
  return false
}

// --- Sous-commande code -----------------------------------------------------

function runNoHardcodedContentCheck() {
  const findings = checkNoHardcodedContent(SRC_DIR)
  if (findings.length === 0) {
    console.log('code --no-hardcoded-content : 0 occurrence')
    return true
  }
  console.error(`code --no-hardcoded-content : ${findings.length} occurrence(s)`)
  for (const f of findings) {
    console.error(`  - ${f.file}:${f.line} : "${f.snippet}"`)
  }
  return false
}

// --- Sous-commande self-test ------------------------------------------------

function runNegativeControls() {
  const results = []

  // GB1 : un item référence un graphème hors curriculum au niveau donné.
  {
    const curriculumData = readJson(CURRICULUM_PATH)
    const badItems = loadCorpusFile(path.join(FIXTURES_DIR, 'graphemes-violation.json'))
    const violations = checkGraphemes(curriculumData, badItems)
    results.push({ name: 'GB1 content --graphemes', failed: violations.length > 0 })
  }

  // GB2 : corpus délibérément sous les volumes minimaux.
  {
    const badItems = loadCorpusFile(path.join(FIXTURES_DIR, 'counts-violation.json'))
    const problems = checkCounts(badItems)
    results.push({ name: 'GB2 content --counts', failed: problems.length > 0 })
  }

  // GB3 : un mot sans emoji, deux mots différents partageant un emoji.
  {
    const badItems = loadCorpusFile(path.join(FIXTURES_DIR, 'emoji-violation.json'))
    const { missing, duplicates } = checkEmoji(badItems)
    results.push({ name: 'GB3 content --emoji', failed: missing.length > 0 && duplicates.length > 0 })
  }

  // GB4 : pronunciation.json auquel il manque une entrée pour un graphème connu.
  {
    const curriculumData = readJson(CURRICULUM_PATH)
    const badPronunciation = readJson(path.join(FIXTURES_DIR, 'pronunciation-violation.json'))
    const { missing } = checkPronunciation(curriculumData, badPronunciation)
    results.push({ name: 'GB4 content --pronunciation', failed: missing.length > 0 })
  }

  // GB5a : confusion.json référence un id inconnu du curriculum et hors z/j.
  {
    const curriculumData = readJson(CURRICULUM_PATH)
    const badConfusion = readJson(path.join(FIXTURES_DIR, 'confusion-violation.json'))
    const idViolations = checkConfusionIds(curriculumData, badConfusion)
    results.push({ name: 'GB5a confusion ids', failed: idViolations.length > 0 })
  }

  // GB5b : shuffle() appelé directement sur le pool brut, non filtré.
  {
    const badSource = readText(path.join(FIXTURES_DIR, 'distractors-unconstrained.ts.fixture'))
    const randomViolations = checkNoUnconstrainedRandom(badSource)
    results.push({ name: 'GB5b unconstrained random', failed: randomViolations.length > 0 })
  }

  // GB6 : chaîne de contenu francophone en dur dans un fichier hors src/content/.
  {
    const badSource = readText(path.join(FIXTURES_DIR, 'hardcoded-content-violation.ts.fixture'))
    const findings = scanSourceForHardcodedContent(badSource, 'fixture')
    results.push({ name: 'GB6 code --no-hardcoded-content', failed: findings.length > 0 })
  }

  const allFailedAsExpected = results.every((r) => r.failed)
  for (const r of results) {
    const status = r.failed ? 'a échoué comme attendu' : "N'A PAS échoué (défaut du contrôle négatif)"
    console.log(`  - ${r.name} : ${status}`)
  }

  if (allFailedAsExpected) {
    console.log('self-test --negative-controls : all negative controls failed as expected')
    return true
  }
  console.error('self-test --negative-controls : au moins un contrôle négatif n\'a pas échoué comme attendu')
  return false
}

// --- Dispatch ----------------------------------------------------------------

const SUBCOMMANDS = {
  'content --graphemes': runGraphemesCheck,
  'content --counts': runCountsCheck,
  'content --emoji': runEmojiCheck,
  'content --pronunciation': runPronunciationCheck,
  'content --distractors': runDistractorsCheck,
  'code --no-hardcoded-content': runNoHardcodedContentCheck,
  'self-test --negative-controls': runNegativeControls,
}

function runAll() {
  const order = [
    'content --graphemes',
    'content --counts',
    'content --emoji',
    'content --pronunciation',
    'content --distractors',
    'code --no-hardcoded-content',
    'self-test --negative-controls',
  ]
  const failures = []
  for (const key of order) {
    console.log(`\n> node tools/check.mjs ${key}`)
    const ok = SUBCOMMANDS[key]()
    if (!ok) failures.push(key)
  }
  console.log('')
  if (failures.length === 0) {
    console.log('ALL CONTENT CHECKS PASSED')
    return true
  }
  console.error(`ÉCHEC : ${failures.length} sous-commande(s) en échec : ${failures.join(', ')}`)
  return false
}

function main() {
  const args = process.argv.slice(2)
  const key = args.join(' ')

  let ok
  if (key === 'all') {
    ok = runAll()
  } else if (Object.prototype.hasOwnProperty.call(SUBCOMMANDS, key)) {
    ok = SUBCOMMANDS[key]()
  } else {
    console.error(`Sous-commande inconnue : "${key}"`)
    console.error('Sous-commandes disponibles :')
    for (const k of Object.keys(SUBCOMMANDS)) console.error(`  node tools/check.mjs ${k}`)
    console.error('  node tools/check.mjs all')
    process.exit(2)
  }

  process.exit(ok ? 0 : 1)
}

main()
