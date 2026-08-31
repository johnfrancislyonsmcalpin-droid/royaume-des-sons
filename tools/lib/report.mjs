// tools/lib/report.mjs — GF5 (leaf-F4 : sous-commande `report`, SPEC §12
// G-F9, §13 "Report audit"). Assemble un rapport chiffré du projet.
//
// Règle non négociable de ce fichier (SPEC §0 "Report audit") : chaque nombre
// affiché vient d'une lecture FRAÎCHE des fichiers sources au moment de
// l'appel (curriculum.json, corpus/*.json, .unlazy/royaume/gates/*.md) ou
// d'un ré-appel réel des autres sous-commandes de check.mjs — jamais d'une
// constante recopiée à la main ici. Node pur, aucune dépendance npm, même
// convention que le reste de tools/ (voir io.mjs).
import fs from 'node:fs'
import path from 'node:path'
import { allGraphemeIds } from './curriculumLogic.mjs'

/**
 * Répartit les items du corpus réel par (niveau, nature) — recompté à chaque
 * appel à partir du tableau `corpusItems` fourni (lui-même chargé à chaud par
 * l'appelant via loadContent.mjs::loadCorpus, jamais mis en cache ici).
 * @param {Array<{level?: number, kind?: string}>} corpusItems
 * @returns {Record<string, Record<string, number>>} { [level]: { [kind]: count } }
 */
export function countCorpusByKindAndLevel(corpusItems) {
  const counts = {}
  for (const item of corpusItems) {
    const level = String(item.level ?? '?')
    const kind = String(item.kind ?? '?')
    counts[level] ??= {}
    counts[level][kind] = (counts[level][kind] ?? 0) + 1
  }
  return counts
}

/**
 * Compte les lignes de gate ("- [ ]" en attente, "- [x]"/"- [X]" cochée)
 * réellement présentes dans chaque fichier *.md d'un dossier de gates, lues
 * sur le disque à l'instant de l'appel — jamais un total mémorisé : si un
 * fichier de gates change entre deux exécutions, ce compte change avec lui.
 * @param {string} gatesDir
 */
export function countGateLines(gatesDir) {
  const entries = fs.existsSync(gatesDir)
    ? fs.readdirSync(gatesDir).filter((name) => name.endsWith('.md')).sort()
    : []
  const perFile = []
  let totalChecked = 0
  let totalUnchecked = 0
  for (const file of entries) {
    const content = fs.readFileSync(path.join(gatesDir, file), 'utf8')
    const checkedMatches = content.match(/^- \[[xX]\]/gm) ?? []
    const uncheckedMatches = content.match(/^- \[ \]/gm) ?? []
    totalChecked += checkedMatches.length
    totalUnchecked += uncheckedMatches.length
    perFile.push({ file, checked: checkedMatches.length, unchecked: uncheckedMatches.length })
  }
  return { files: perFile, totalChecked, totalUnchecked, total: totalChecked + totalUnchecked }
}

/**
 * Rassemble toutes les sections chiffrées du rapport à partir de données déjà
 * chargées par l'appelant (check.mjs, seul endroit qui connaît les chemins
 * réels — ce module reste indépendant du disposition exacte du dépôt, hormis
 * `gatesDir` qui pointe vers .unlazy/royaume/gates/).
 * @param {{curriculumData: object, corpusItems: object[], gatesDir: string}} args
 */
export function buildReportSections({ curriculumData, corpusItems, gatesDir }) {
  const graphemeCount = allGraphemeIds(curriculumData).size
  const corpusCounts = countCorpusByKindAndLevel(corpusItems)
  const gates = countGateLines(gatesDir)
  const totalCorpusItems = corpusItems.length
  return { graphemeCount, corpusCounts, gates, totalCorpusItems }
}

/**
 * Formate le rapport en texte lisible. `checkResults` est la liste ordonnée
 * des résultats RÉELS des autres sous-commandes de check.mjs (chacune déjà
 * exécutée par l'appelant juste avant l'appel à cette fonction) — ce module
 * ne réévalue rien lui-même, il ne fait que mettre en forme des résultats
 * déjà mesurés.
 * @param {ReturnType<typeof buildReportSections>} sections
 * @param {Array<{key: string, ok: boolean}>} checkResults
 */
export function formatReport(sections, checkResults) {
  const lines = []
  lines.push('=== Rapport — Le Royaume des Sons (re-mesuré à l\'instant) ===')
  lines.push('')
  lines.push(`Graphèmes déclarés dans le curriculum : ${sections.graphemeCount}`)
  lines.push('')
  lines.push(`Corpus : ${sections.totalCorpusItems} item(s) au total, par niveau et par nature :`)
  const levels = Object.keys(sections.corpusCounts).sort((a, b) => Number(a) - Number(b))
  for (const level of levels) {
    const kinds = sections.corpusCounts[level]
    const parts = Object.entries(kinds)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([kind, n]) => `${kind}: ${n}`)
    lines.push(`  niveau ${level} — ${parts.join(', ')}`)
  }
  lines.push('')
  lines.push(
    `Gates (.unlazy/royaume/gates/*.md) : ${sections.gates.total} ligne(s) de gate au total, ` +
      `${sections.gates.totalChecked} cochée(s), ${sections.gates.totalUnchecked} en attente`,
  )
  for (const f of sections.gates.files) {
    lines.push(`  ${f.file} : ${f.checked}/${f.checked + f.unchecked}`)
  }
  lines.push('')
  lines.push('Résultat des sous-commandes de contenu (node tools/check.mjs), ré-exécutées à l\'instant :')
  for (const r of checkResults) {
    lines.push(`  ${r.key} : ${r.ok ? 'OK' : 'ÉCHEC'}`)
  }
  lines.push('')
  return lines.join('\n')
}
