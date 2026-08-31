// Point d'entrée public de la couche de sauvegarde (leaf A3).
// Le reste du jeu (moteur de progression, écran parent, moteur de quête)
// importe depuis `src/save`, jamais directement depuis les fichiers internes.

export { createEmptySaveFile, loadSaveFile, writeSaveFile } from './storage'
export type { WriteResult } from './storage'

export { recordChallengeResult, setCurrentQuestState, clearCurrentQuestState } from './questState'

export { exportSaveFile, importSaveFile, importAndPersistSaveFile } from './exportImport'
export type { ImportResult, ImportFailureReason } from './exportImport'

export { parseKnownSave, migrateV0ToV1, SaveValidationError } from './migration'
export type { LegacySaveFileV0, SaveValidationReason } from './migration'
