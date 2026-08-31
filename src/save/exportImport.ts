// Export / import JSON du SaveFile (leaf A3, OWNS: src/save/**).
//
// SPEC §3 : l'export JSON est le filet de sécurité général contre la perte de
// données (changement d'appareil, désinstallation, effacement manuel). SPEC
// §9 : l'écran parent propose export et import. Gate G3 : un import invalide
// (JSON malformé ou schemaVersion inconnu) doit être rejeté proprement, SANS
// corrompre la sauvegarde déjà en place.

import type { SaveFile } from '../types'
import { SaveValidationError, parseKnownSave } from './migration'
import { writeSaveFile } from './storage'

/** Sérialisation propre et lisible du SaveFile complet, prête pour un fichier .json. */
export function exportSaveFile(save: SaveFile): string {
  return JSON.stringify(save, null, 2)
}

export type ImportFailureReason = 'malformed-json' | 'invalid-shape' | 'unknown-schema-version'

export type ImportResult =
  | { ok: true; save: SaveFile }
  | { ok: false; reason: ImportFailureReason; message: string }

/**
 * Valide et migre un JSON de sauvegarde vers la forme courante, SANS effet de
 * bord sur localStorage. Un appelant qui veut aussi persister le résultat
 * utilise `importAndPersistSaveFile`.
 */
export function importSaveFile(json: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'JSON illisible'
    return { ok: false, reason: 'malformed-json', message }
  }

  try {
    const save = parseKnownSave(parsed)
    return { ok: true, save }
  } catch (err) {
    if (err instanceof SaveValidationError) {
      return { ok: false, reason: err.reason, message: err.message }
    }
    // Défense en profondeur : parseKnownSave ne lève que SaveValidationError,
    // mais on ne laisse jamais une exception inattendue remonter à l'appelant.
    const message = err instanceof Error ? err.message : 'sauvegarde invalide'
    return { ok: false, reason: 'invalid-shape', message }
  }
}

/**
 * Importe et persiste seulement si la validation réussit. En cas d'échec
 * (JSON malformé, forme invalide, version inconnue), localStorage n'est
 * JAMAIS touché : la sauvegarde déjà en place reste intacte (gate G3).
 */
export function importAndPersistSaveFile(json: string): ImportResult {
  const result = importSaveFile(json)
  if (result.ok) {
    writeSaveFile(result.save)
  }
  return result
}
