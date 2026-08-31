#!/usr/bin/env node
// node-C N3 : aucun composant de défi n'utilise glisser-déposer, survol ou
// double-tap (CLAUDE.md règle #4). Scan statique des littéraux JSX
// (onDragStart/onDrop/draggable, onMouseEnter/onMouseOver/onMouseLeave sans
// équivalent tactile, onDoubleClick) sous les chemins passés en argument.
// Node pur, même style que tools/lib/checks/hardcoded.mjs (pas de
// dépendance npm, pas de vrai parseur JS/TS — une regex ciblée sur des noms
// de props JSX suffit à détecter une régression réelle).
//
// Négatif attendu (contrôle positif de ce check, pas une violation) :
// TapTarget.tsx (src/challenges/shared) neutralise EXPLICITEMENT le
// glisser-déposer natif du navigateur (`draggable={false}`,
// `onDragStart={(event) => event.preventDefault()}`) pour qu'un appui
// prolongé ne déclenche jamais un drag natif — c'est l'inverse d'une
// fonctionnalité de glisser-déposer, donc explicitement exempté ci-dessous
// plutôt que remonté comme violation.
import fs from 'node:fs'
import path from 'node:path'

const FORBIDDEN_PROPS = [
  'onDragStart',
  'onDragEnd',
  'onDragOver',
  'onDrop',
  'draggable',
  'onMouseEnter',
  'onMouseOver',
  'onMouseLeave',
  'onDoubleClick',
  'ondblclick',
]

const FORBIDDEN_RE = new RegExp(`\\b(${FORBIDDEN_PROPS.join('|')})\\b`)

// `draggable={false}` désactive le drag natif : ce n'est pas une
// fonctionnalité de glisser-déposer, donc pas une violation.
const DRAGGABLE_DISABLED_RE = /draggable\s*=\s*\{?\s*false\s*\}?/
// Un handler de drag dont le corps entier ne fait qu'empêcher le
// comportement natif (`preventDefault`/`stopPropagation`, sans jamais lire
// `dataTransfer`) neutralise le drag, il ne l'implémente pas.
const DRAG_NEUTRALIZER_RE = /on(?:DragStart|DragEnd|DragOver|Drop)\s*=\s*\{[^}]*(?:preventDefault|stopPropagation)\(\)[^}]*\}/
const DATA_TRANSFER_RE = /dataTransfer/

function listFilesRecursive(dirAbsPath) {
  if (!fs.existsSync(dirAbsPath)) return []
  const entries = fs.readdirSync(dirAbsPath, { recursive: true, withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const parentDir = entry.parentPath ?? entry.path ?? dirAbsPath
    files.push(path.join(parentDir, entry.name))
  }
  return files
}

function scanFile(absPath) {
  const findings = []
  const text = fs.readFileSync(absPath, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, index) => {
    // Les commentaires qui NOMMENT une prop interdite pour dire qu'on ne
    // l'utilise pas (comme l'en-tête de ce fichier, ou TapTarget.tsx) ne
    // sont pas des violations : seule une ligne de code (hors commentaire //
    // en tête de ligne trimée) compte.
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    if (DATA_TRANSFER_RE.test(line)) {
      findings.push({ file: absPath, line: index + 1, prop: 'dataTransfer', snippet: trimmed.slice(0, 100) })
      return
    }
    const match = FORBIDDEN_RE.exec(line)
    if (!match) return
    if (match[1] === 'draggable' && DRAGGABLE_DISABLED_RE.test(line)) return
    if (/^on(?:DragStart|DragEnd|DragOver|Drop)$/.test(match[1]) && DRAG_NEUTRALIZER_RE.test(line)) return
    findings.push({ file: absPath, line: index + 1, prop: match[1], snippet: trimmed.slice(0, 100) })
  })
  return findings
}

function main() {
  const targets = process.argv.slice(2)
  if (targets.length === 0) {
    console.error('usage: node no-drag-drop.mjs <dir...>')
    process.exit(2)
  }

  const findings = []
  for (const target of targets) {
    const absTarget = path.resolve(target)
    const files = listFilesRecursive(absTarget).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
    for (const file of files) {
      findings.push(...scanFile(file))
    }
  }

  if (findings.length === 0) {
    console.log('NO DRAG DROP')
    process.exit(0)
  }

  console.error(`${findings.length} violation(s) trouvée(s) :`)
  for (const f of findings) {
    console.error(`  - ${path.relative(process.cwd(), f.file)}:${f.line} — prop interdite "${f.prop}" : ${f.snippet}`)
  }
  process.exit(1)
}

main()
