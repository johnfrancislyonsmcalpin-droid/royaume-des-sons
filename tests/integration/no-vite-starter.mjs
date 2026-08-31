// Gate G1 (leaf A5) : src/App.tsx ne doit plus contenir la moindre trace du
// squelette de démarrage Vite (compteur, logos Vite/React, liens vite.dev).
// Script Node autonome, sans dépendance, exécuté directement (pas via vitest)
// — voir .unlazy/royaume/gates/leaf-A5.md, CHECK de G1.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const appPath = resolve(here, '..', '..', 'src', 'App.tsx')
const source = readFileSync(appPath, 'utf8')

const forbiddenPatterns = [
  /vite\.dev/i,
  /chat\.vite\.dev/i,
  /Count is/,
  /reactLogo/,
  /viteLogo/,
  /react\.svg/,
  /vite\.svg/,
  /Explore Vite/i,
  /Get started/i,
  /HMR/,
  /icons\.svg#/,
]

const violations = forbiddenPatterns.filter((pattern) => pattern.test(source))

if (violations.length > 0) {
  console.error('VITE STARTER REMNANTS FOUND in src/App.tsx:')
  for (const pattern of violations) {
    console.error(`  - matches ${pattern}`)
  }
  process.exit(1)
}

console.log('NO VITE STARTER REMNANTS')
process.exit(0)
