#!/usr/bin/env node
// node-A N2 : le shell (A1) et l'orchestrateur de narration (A4) n'invoquent
// JAMAIS window.speechSynthesis / SpeechSynthesisUtterance directement — le
// seul point d'accès à l'API voix du navigateur est src/voice/** (A2,
// CLAUDE.md « Le son d'une lettre n'est pas son nom » + PLAN.md contrat).
// Scan statique (même style que no-drag-drop.mjs) des chemins passés en
// argument, en excluant explicitement src/voice/** même s'il est passé par
// erreur (c'est le SEUL module autorisé à toucher l'API).
import fs from 'node:fs'
import path from 'node:path'

const FORBIDDEN_RE = /\b(speechSynthesis|SpeechSynthesisUtterance)\b/

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

function isExemptPath(relativePath) {
  const segments = relativePath.split(/[\\/]/)
  // src/voice/** reste le seul module autorisé à toucher l'API navigateur.
  return segments.includes('voice')
}

function scanFile(absPath) {
  const findings = []
  const text = fs.readFileSync(absPath, 'utf8')
  const lines = text.split('\n')
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return
    const match = FORBIDDEN_RE.exec(line)
    if (match) {
      findings.push({ file: absPath, line: index + 1, token: match[1], snippet: trimmed.slice(0, 100) })
    }
  })
  return findings
}

function main() {
  const targets = process.argv.slice(2)
  if (targets.length === 0) {
    console.error('usage: node no-direct-speechsynthesis.mjs <dir...>')
    process.exit(2)
  }

  const findings = []
  for (const target of targets) {
    const absRoot = path.resolve(target)
    const files = listFilesRecursive(absRoot).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
    for (const file of files) {
      const relativeToTarget = path.relative(absRoot, file)
      if (isExemptPath(relativeToTarget)) continue
      findings.push(...scanFile(file))
    }
  }

  if (findings.length === 0) {
    console.log('NO DIRECT SPEECHSYNTHESIS')
    process.exit(0)
  }

  console.error(`${findings.length} violation(s) trouvée(s) :`)
  for (const f of findings) {
    console.error(`  - ${path.relative(process.cwd(), f.file)}:${f.line} — accès direct "${f.token}" : ${f.snippet}`)
  }
  process.exit(1)
}

main()
