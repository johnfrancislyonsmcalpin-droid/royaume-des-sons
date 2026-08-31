// Lecture/écriture localStorage (leaf A3, OWNS: src/save/**).
//
// Règle du projet (PLAN.md) : jamais de throw visible du joueur. Toute erreur
// (localStorage plein, JSON corrompu, localStorage indisponible) dégrade
// proprement — log dev uniquement, jamais de blocage.

import { SCHEMA_VERSION } from '../types'
import type { SaveFile } from '../types'
import { parseKnownSave } from './migration'

export const STORAGE_KEY = 'royaume-des-sons:save'

function devWarn(...args: unknown[]): void {
  // import.meta.env.DEV est fourni par Vite ; en environnement de test (jsdom,
  // pas de bundling Vite complet) le champ peut être absent, d'où la garde.
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
  if (isDev) {
    console.warn('[save]', ...args)
  }
}

/** Sauvegarde neutre de départ : aucune progression, aucune donnée personnelle. */
export function createEmptySaveFile(nowIso: string = new Date().toISOString()): SaveFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    mastery: {
      skills: {},
      reviewQueue: [],
    },
    avatar: {
      avatarId: '',
      companionId: '',
      cosmetics: [],
      xp: 0,
      coins: 0,
    },
    progress: {
      currentLevel: 1,
      currentRegionId: '',
      unlockedRegionIds: [],
      grandLivreItemIds: [],
      helpAdultCount: 0,
      sessionMinutesByDay: {},
    },
    currentQuestState: null,
    lastSavedAt: nowIso,
  }
}

/**
 * Lit la sauvegarde depuis localStorage. Ne lève jamais : en cas d'absence, de
 * JSON corrompu, de forme invalide ou de version inconnue, retourne une
 * sauvegarde neutre en mémoire SANS réécrire localStorage — la donnée
 * potentiellement corrompue déjà présente n'est jamais écrasée silencieusement
 * par ce simple appel de lecture.
 */
export function loadSaveFile(): SaveFile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return createEmptySaveFile()
    const parsed: unknown = JSON.parse(raw)
    return parseKnownSave(parsed)
  } catch (err) {
    devWarn('lecture impossible, sauvegarde neutre utilisée', err)
    return createEmptySaveFile()
  }
}

export interface WriteResult {
  ok: boolean
  save: SaveFile
}

/**
 * Écrit la sauvegarde en localStorage. Horodate `lastSavedAt` au moment de
 * l'écriture. Ne lève jamais : si l'écriture échoue (quota dépassé, stockage
 * indisponible), l'ancienne valeur en localStorage reste intacte
 * (`localStorage.setItem` est atomique : il réussit intégralement ou échoue
 * sans effet) et cette fonction retourne `{ ok: false, save }` avec la
 * sauvegarde non horodatée telle que reçue, sans lancer d'exception.
 */
export function writeSaveFile(save: SaveFile, nowIso: string = new Date().toISOString()): WriteResult {
  const toPersist: SaveFile = { ...save, lastSavedAt: nowIso }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist))
    return { ok: true, save: toPersist }
  } catch (err) {
    devWarn('écriture impossible (localStorage plein ou indisponible)', err)
    return { ok: false, save }
  }
}
