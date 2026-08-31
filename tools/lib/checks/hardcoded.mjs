// GB6 / G-B6 (CLAUDE.md règle #2, SPEC "Contenu séparé du code") : aucun
// mot, syllabe ou phrase en dur dans src/**/*.{ts,tsx}, hors src/content/**
// et hors fichiers de test.
//
// Heuristique pragmatique (documentée dans ASSUMPTIONS.md section B4) :
// scan des littéraux de chaîne ('...', "...", `...`) d'un fichier source, et
// signalement si l'un d'eux contient soit un caractère accentué français
// (é, à, ç, etc. — très peu de code non-francophone en contient
// légitimement), soit un mot entier appartenant à la liste des mots-outils
// de SPEC §5 niveau 8 (le, la, les, un, une, des, est, et, dans, sur, avec,
// il, elle, je, tu, ont, qui). "a" est délibérément exclu de cette liste :
// c'est aussi l'article indéfini anglais ("a button", "select a level"),
// son inclusion aurait produit un flot de faux positifs sur du code/anglais
// légitime sans gain réel de détection (l'accentuation et les autres mots-
// outils suffisent à attraper une vraie régression de contenu en dur).
//
// Exceptions documentées :
//  - src/content/** : c'est précisément là que le contenu pédagogique DOIT
//    vivre (règle #2).
//  - *.test.ts / *.test.tsx : fixtures de test, pas du contenu livré au joueur.
//  - src/app/VoiceCheckScreen/** : SPEC §3 désigne explicitement cet écran
//    comme le seul du jeu qui s'adresse à un lecteur ADULTE (marche à suivre
//    Android), hors du périmètre "contenu pédagogique enfant" de CLAUDE.md
//    règle #2 — décision confirmée par le driver (voir ASSUMPTIONS.md
//    section F2).
//  - Littéraux dont le contexte immédiat précédent est un attribut/prop
//    d'accessibilité pur : `aria-*=`, ou la prop `label` telle qu'utilisée
//    par TouchButton/TapButton/TapTarget/GrandLivreButton (src/world/**,
//    src/challenges/shared/TapTarget.tsx) — ces quatre composants
//    documentent explicitement (commentaires relus lors du calibrage de ce
//    check) que `label` n'alimente QUE `aria-label`, jamais un texte affiché
//    ou énoncé à l'enfant. Même catégorie que l'exception VoiceCheckScreen :
//    un libellé pour lecteur d'écran adulte, pas du contenu pédagogique.
//  - Littéraux dont le contexte immédiat précédent est un appel de
//    diagnostic développeur (`console.log/warn/error/info/debug(`,
//    `new Error(`/`new TypeError(`/`new RangeError(`, l'utilitaire interne
//    `fail(`/`devWarn(`/`invariant(`, ou la propriété `reason:` d'un objet
//    de violation d'audit) : ce sont des messages qui n'atteignent jamais le
//    joueur (voir le commentaire de src/narration/NarrationProvider.tsx qui
//    raisonne explicitement sur cette même distinction : « erreur de
//    programmation, pas... narration au joueur »).
//  - Correspondance par mot-outil (pas par accent) sur un littéral SANS
//    espace : ce sont typiquement des identifiants/clés (ex. clé
//    localStorage "royaume-des-sons:save", slug d'id de région
//    "clairiere-des-voyelles"), pas des phrases. Un littéral accentué reste
//    signalé même sans espace (ex. "Écoute." — un seul mot francophone
//    énoncé à l'enfant est déjà une violation).

import path from 'node:path'
import { listFilesRecursive, readText } from '../io.mjs'

export const FRENCH_STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'est', 'et', 'dans', 'sur', 'avec',
  'il', 'elle', 'je', 'tu', 'ont', 'qui',
])

const FRENCH_ACCENTS_RE = /[àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/

const WORD_RE = /[a-zàâäéèêëîïôöùûüç]+/gi

// Contexte immédiatement précédent (fenêtre de 160 caractères avant le
// littéral) reconnu comme accessibilité pure (jamais affiché/énoncé à
// l'enfant) — voir le bloc de commentaires en tête de fichier. Le caractère
// ouvrant du littéral lui-même (guillemet) n'est PAS inclus dans la fenêtre
// testée (voir extractStringLiterals : `start` pointe sur ce caractère),
// donc la regex s'arrête juste après `=`/`:` et un éventuel `{` JSX.
const ACCESSIBILITY_CONTEXT_RE = /\b(?:aria-[a-z-]+|label)\s*[:=]\s*\{?\s*$/i

// Contexte immédiatement précédent reconnu comme diagnostic développeur
// (jamais affiché/énoncé à l'enfant) — voir le bloc de commentaires en tête
// de fichier.
const DEV_DIAGNOSTIC_CONTEXT_RE =
  /(?:console\.(?:log|warn|error|info|debug)|new\s+(?:Error|TypeError|RangeError)|\bfail|\bdevWarn|\binvariant)\s*\(\s*$/
const DEV_DIAGNOSTIC_PROPERTY_RE = /\breason\s*:\s*$/

export const EXCLUDED_DIR_SEGMENTS = ['content', 'VoiceCheckScreen']
export const INCLUDED_EXTENSIONS = ['.ts', '.tsx']

function isTestFile(filePath) {
  return /\.test\.tsx?$/.test(filePath)
}

function isExcludedPath(relativePath) {
  const segments = relativePath.split(/[\\/]/)
  return segments.some((segment) => EXCLUDED_DIR_SEGMENTS.includes(segment))
}

function containsFrenchStopword(content) {
  const words = content.match(WORD_RE) ?? []
  return words.some((word) => FRENCH_STOPWORDS.has(word.toLowerCase()))
}

function lineNumberAt(sourceText, index) {
  let line = 1
  for (let i = 0; i < index; i += 1) {
    if (sourceText[i] === '\n') line += 1
  }
  return line
}

/**
 * Petit tokenizer (pas un vrai parseur JS/TS, mais suffisant ici) qui
 * extrait UNIQUEMENT le contenu des littéraux de chaîne réels ('...', "...",
 * `...`), en ignorant explicitement les commentaires `//` et `/* *‍/`.
 *
 * Nécessaire car une extraction par simple regex sur des paires de guillemets
 * confond les apostrophes d'élision du français ("l'écran", "d'un", "c'est")
 * à l'intérieur des commentaires JSDoc avec des délimiteurs de chaîne, ce qui
 * fabrique de faux littéraux à partir de fragments de commentaires — source
 * majeure de faux positifs constatée en calibrant ce check sur le vrai dépôt.
 *
 * @param {string} sourceText
 * @returns {Array<{content:string, index:number}>}
 */
function extractStringLiterals(sourceText) {
  const literals = []
  const n = sourceText.length
  let i = 0
  while (i < n) {
    const ch = sourceText[i]
    const next = sourceText[i + 1]

    if (ch === '/' && next === '/') {
      i += 2
      while (i < n && sourceText[i] !== '\n') i += 1
      continue
    }

    if (ch === '/' && next === '*') {
      i += 2
      while (i < n && !(sourceText[i] === '*' && sourceText[i + 1] === '/')) i += 1
      i += 2
      continue
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      const start = i
      i += 1
      let content = ''
      while (i < n && sourceText[i] !== quote) {
        if (sourceText[i] === '\\') {
          content += sourceText[i] + (sourceText[i + 1] ?? '')
          i += 2
          continue
        }
        if (quote !== '`' && sourceText[i] === '\n') break // chaîne '/" non terminée sur la ligne : on abandonne ce littéral
        content += sourceText[i]
        i += 1
      }
      i += 1 // guillemet fermant (ou fin de ligne abandonnée ci-dessus)
      literals.push({ content, index: start })
      continue
    }

    i += 1
  }
  return literals
}

const CONTEXT_WINDOW = 160

function precedingContext(sourceText, index) {
  return sourceText.slice(Math.max(0, index - CONTEXT_WINDOW), index)
}

// Ouverture `label={` / `aria-x={` suivie d'une expression JS avant le
// littéral (ex. un ternaire `label={cond ? 'a' : 'b'}`, vu en pratique dans
// Forge.tsx et WorldMap.tsx) : ACCESSIBILITY_CONTEXT_RE seul exige une
// adjacence immédiate et rate ce cas. On cherche donc la dernière ouverture
// `label={`/`aria-x={` dans la fenêtre, puis on vérifie par comptage
// d'accolades qu'aucun `}` ne l'a refermée avant notre littéral — c'est-à-
// dire qu'on est toujours syntaxiquement à l'intérieur de cette expression.
const ACCESSIBILITY_BRACE_OPENER_RE = /\b(?:aria-[a-z-]+|label)\s*=\s*\{/gi

function isInsideOpenAccessibilityExpression(before) {
  let lastOpenEnd = -1
  let match
  ACCESSIBILITY_BRACE_OPENER_RE.lastIndex = 0
  while ((match = ACCESSIBILITY_BRACE_OPENER_RE.exec(before))) {
    lastOpenEnd = match.index + match[0].length
  }
  if (lastOpenEnd === -1) return false
  let depth = 0
  for (let i = lastOpenEnd; i < before.length; i += 1) {
    if (before[i] === '{') depth += 1
    else if (before[i] === '}') {
      if (depth === 0) return false // l'expression JSX s'est refermée avant notre littéral
      depth -= 1
    }
  }
  return true
}

function isExemptContext(sourceText, index) {
  const before = precedingContext(sourceText, index)
  return (
    ACCESSIBILITY_CONTEXT_RE.test(before) ||
    DEV_DIAGNOSTIC_CONTEXT_RE.test(before) ||
    DEV_DIAGNOSTIC_PROPERTY_RE.test(before) ||
    isInsideOpenAccessibilityExpression(before)
  )
}

/**
 * Scanne un unique fichier source et retourne les littéraux suspects.
 * @param {string} sourceText
 * @param {string} fileLabel - chemin affiché dans les messages
 * @returns {Array<{file:string, line:number, snippet:string}>}
 */
export function scanSourceForHardcodedContent(sourceText, fileLabel) {
  const findings = []
  for (const { content, index } of extractStringLiterals(sourceText)) {
    const trimmed = content.trim()
    if (trimmed.length === 0) continue

    const hasAccent = FRENCH_ACCENTS_RE.test(content)
    // Un mot-outil seul, sans espace, est le plus souvent un identifiant/clé
    // (slug, clé localStorage) plutôt qu'une phrase — voir le commentaire de
    // tête de fichier. L'accentuation reste, elle, un signal suffisant même
    // pour un seul mot (ex. "Écoute.") : un enfant francophone entend "des"
    // dans un identifiant sans y penser, mais "Écoute." énoncé est déjà du
    // contenu.
    const hasStopword = /\s/.test(content) && containsFrenchStopword(content)
    if (!hasAccent && !hasStopword) continue

    if (isExemptContext(sourceText, index)) continue

    findings.push({
      file: fileLabel,
      line: lineNumberAt(sourceText, index),
      snippet: content.length > 80 ? `${content.slice(0, 80)}…` : content,
    })
  }
  return findings
}

/**
 * Scanne tout src/**\/*.{ts,tsx} (hors exclusions documentées ci-dessus).
 * @param {string} srcDir - chemin absolu de src/
 * @returns {Array<{file:string, line:number, snippet:string}>}
 */
export function checkNoHardcodedContent(srcDir) {
  const allFiles = listFilesRecursive(srcDir)
  const findings = []
  for (const absPath of allFiles) {
    if (!INCLUDED_EXTENSIONS.includes(path.extname(absPath))) continue
    if (isTestFile(absPath)) continue
    const relativePath = path.relative(srcDir, absPath)
    if (isExcludedPath(relativePath)) continue
    const sourceText = readText(absPath)
    findings.push(...scanSourceForHardcodedContent(sourceText, relativePath))
  }
  return findings
}
