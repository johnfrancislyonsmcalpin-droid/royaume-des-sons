// Assemblage du corpus réel à partir de src/content/corpus/*.json.
// Miroir volontairement simplifié de src/content/corpus.ts (SOURCES) — voir
// ASSUMPTIONS.md section B4. La liste de fichiers est tenue à jour à la main :
// si une leaf B2 ajoute un fichier de corpus sans l'ajouter ici, GB2 sous-
// comptera et échouera bruyamment (fail loud), ce qui est le comportement
// voulu plutôt qu'un silence.

import path from 'node:path'
import { readJson } from './io.mjs'

export const CORPUS_FILENAMES = [
  'syllables.json',
  'words-l3-5.json',
  'words-l6-7.json',
  'pseudowords.json',
  'sentences-l8.json',
  'texts-l9.json',
  'texts-l10.json',
]

/**
 * Charge et concatène tous les fichiers de corpus. Chaque item porte en plus
 * `__sourceFile` (nom du fichier d'origine) pour des messages d'erreur utiles ;
 * ce champ n'existe pas dans le vrai ContentItem (src/types.ts), il est ajouté
 * ici uniquement pour l'outillage.
 */
export function loadCorpus(corpusDir) {
  const items = []
  for (const filename of CORPUS_FILENAMES) {
    const filePath = path.join(corpusDir, filename)
    const data = readJson(filePath)
    if (!Array.isArray(data)) {
      throw new Error(`${filename} doit être un tableau JSON`)
    }
    for (const item of data) {
      items.push({ ...item, __sourceFile: filename })
    }
  }
  return items
}

/** Charge un unique fichier de corpus (tableau de ContentItem), pour les fixtures. */
export function loadCorpusFile(filePath) {
  const data = readJson(filePath)
  if (!Array.isArray(data)) {
    throw new Error(`${filePath} doit être un tableau JSON`)
  }
  return data.map((item) => ({ ...item, __sourceFile: path.basename(filePath) }))
}
