// Utilitaires I/O partagés par tous les checks (tools/check.mjs).
// Aucune dépendance npm : uniquement fs/path/url du runtime Node.
// Réimplémentation volontaire en JS pur — voir ASSUMPTIONS.md section B4 :
// tools/check.mjs doit s'exécuter avec `node` seul, sans étape de build ni
// runtime TypeScript (ts-node/tsx absents du dépôt), donc ce module lit et
// parse directement les fichiers JSON sources plutôt que d'importer les
// loaders .ts de src/content/.

import fs from 'node:fs'
import path from 'node:path'

/**
 * Lit et parse un fichier JSON. Erreur explicite (chemin + cause) en cas
 * d'échec de lecture ou de parsing, pour que les checks échouent bruyamment
 * plutôt que silencieusement.
 */
export function readJson(absPath) {
  let raw
  try {
    raw = fs.readFileSync(absPath, 'utf8')
  } catch (err) {
    throw new Error(`lecture impossible de ${absPath} : ${err.message}`)
  }
  try {
    return JSON.parse(raw)
  } catch (err) {
    throw new Error(`JSON invalide dans ${absPath} : ${err.message}`)
  }
}

/** Lit un fichier texte brut (ex. source .ts scannée par les checks statiques). */
export function readText(absPath) {
  try {
    return fs.readFileSync(absPath, 'utf8')
  } catch (err) {
    throw new Error(`lecture impossible de ${absPath} : ${err.message}`)
  }
}

/**
 * Liste récursivement les fichiers d'un répertoire, chemins absolus.
 * `{ recursive: true }` sur fs.readdirSync est disponible depuis Node 20 —
 * ce dépôt cible Node 22 (CLAUDE.md), donc pas de repli nécessaire.
 */
export function listFilesRecursive(dirAbsPath) {
  if (!fs.existsSync(dirAbsPath)) return []
  const entries = fs.readdirSync(dirAbsPath, { recursive: true, withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (!entry.isFile()) continue
    // Node >=20 : entry.path est le dossier parent de l'entrée (pas encore
    // normalisé partout selon la version mineure) ; entry.parentPath est la
    // forme stable récente. On prend ce qui est disponible.
    const parentDir = entry.parentPath ?? entry.path ?? dirAbsPath
    files.push(path.join(parentDir, entry.name))
  }
  return files
}
