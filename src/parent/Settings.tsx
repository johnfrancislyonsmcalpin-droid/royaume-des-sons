// Réglages et actions de l'écran parent (SPEC §9, gate G4) :
//  - réglages voix (vitesse, sélection de voix, test) ;
//  - réinitialisation à double confirmation ;
//  - export / import JSON ;
//  - bouton « vider le cache et recharger ».
//
// Réglages voix réellement appliqués au moteur singleton via
// src/voice/{setRate,setVoiceOverride,listVoices} (extension ajoutée par le
// driver à l'intégration de cette leaf — voir ASSUMPTIONS.md « Décisions
// F1 »). Aucun accès direct à window.speechSynthesis ici : src/voice/index.ts
// reste le seul point d'accès à l'API, cette leaf ne fait que consommer ses
// exports publics.
import { useEffect, useState } from 'react'
import { clearCacheAndReload } from '../app/serviceWorker'
import { createEmptySaveFile, exportSaveFile, importAndPersistSaveFile, loadSaveFile, writeSaveFile } from '../save'
import { getRate as getEngineRate, listVoices, primeVoice, setRate as setEngineRate, setVoiceOverride, speak } from '../voice'
import type { SpeechSynthesisVoiceLike } from '../voice/types'
import type { SaveFile } from '../types'
import { PARENT_VOICE_TEST_PHRASE, PARENT_VOICE_TEST_PHRASE_ID } from './content/parentContent'
import { CheckIcon, DownloadIcon, RefreshIcon, SpeakerIcon, TrashIcon, UploadIcon, WarningIcon } from './icons'

// Bornes raisonnables pour le slider (le moteur démarre à DEFAULT_RATE=0.85,
// src/voice/engine.ts) ; `setEngineRate` ignore toute valeur <= 0 hors bornes.
export const VOICE_RATE_MIN = 0.5
export const VOICE_RATE_MAX = 1.5
export const VOICE_RATE_STEP = 0.05
export const VOICE_RATE_DEFAULT = 0.85

interface VoiceOption {
  id: string
  label: string
  voice: SpeechSynthesisVoiceLike
}

function listAvailableVoices(): VoiceOption[] {
  try {
    return listVoices().map((voice, index) => ({
      id: `${voice.name}::${voice.lang}::${index}`,
      label: `${voice.name} (${voice.lang})`,
      voice,
    }))
  } catch {
    return []
  }
}

type ResetStep = 'idle' | 'confirm-1' | 'confirm-2' | 'done'
type ImportStatus = { kind: 'idle' } | { kind: 'success' } | { kind: 'error'; message: string }

export interface ParentSettingsProps {
  /** SaveFile source pour l'export ; par défaut lu via loadSaveFile() au moment de l'export. */
  getSaveForExport?: () => SaveFile
  /** Appelé après une réinitialisation réussie (ex. pour fermer l'écran parent). */
  onReset?: () => void
}

export function ParentSettings({ getSaveForExport, onReset }: ParentSettingsProps) {
  const [rate, setRate] = useState(() => getEngineRate())
  const [voices, setVoices] = useState<VoiceOption[]>(() => listAvailableVoices())
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('')
  const [resetStep, setResetStep] = useState<ResetStep>('idle')
  const [exportJson, setExportJson] = useState<string | null>(null)
  const [importText, setImportText] = useState('')
  const [importStatus, setImportStatus] = useState<ImportStatus>({ kind: 'idle' })

  // Les voix se chargent de façon asynchrone (SPEC §3) ; src/voice n'expose
  // pas d'abonnement `voiceschanged` en dehors de sa propre sélection
  // automatique, donc cet écran ressonde `listVoices()` à intervalles courts
  // le temps qu'elles apparaissent, plutôt que de dépendre d'un événement
  // auquel il n'a pas accès (seul src/voice/index.ts touche speechSynthesis).
  useEffect(() => {
    if (voices.length > 0) return
    const interval = setInterval(() => {
      const next = listAvailableVoices()
      if (next.length > 0) {
        setVoices(next)
        clearInterval(interval)
      }
    }, 300)
    return () => clearInterval(interval)
  }, [voices.length])

  const changeRate = (nextRate: number) => {
    setRate(nextRate)
    setEngineRate(nextRate)
  }

  const changeVoice = (voiceId: string) => {
    setSelectedVoiceId(voiceId)
    const option = voices.find((v) => v.id === voiceId)
    setVoiceOverride(option ? option.voice : null)
  }

  const testVoice = () => {
    primeVoice()
    speak({
      id: PARENT_VOICE_TEST_PHRASE_ID,
      text: PARENT_VOICE_TEST_PHRASE,
      priority: 'instruction',
      interruptible: true,
    })
  }

  const startExport = () => {
    const save = getSaveForExport ? getSaveForExport() : loadSaveFile()
    setExportJson(exportSaveFile(save))
  }

  const runImport = () => {
    const result = importAndPersistSaveFile(importText)
    if (result.ok) {
      setImportStatus({ kind: 'success' })
    } else {
      setImportStatus({ kind: 'error', message: result.message })
    }
  }

  const startReset = () => setResetStep('confirm-1')
  const continueReset = () => setResetStep('confirm-2')
  const cancelReset = () => setResetStep('idle')
  const confirmReset = () => {
    writeSaveFile(createEmptySaveFile())
    setResetStep('done')
    onReset?.()
  }

  const handleClearCache = () => {
    void clearCacheAndReload()
  }

  return (
    <section data-testid="parent-settings" aria-label="Réglages">
      <div data-testid="parent-voice-settings" style={sectionStyle}>
        <h2 style={headingStyle}>
          <span aria-hidden="true" style={{ marginRight: 6 }}>
            <SpeakerIcon />
          </span>
          Voix
        </h2>
        <label htmlFor="parent-voice-rate">Vitesse</label>
        <input
          id="parent-voice-rate"
          type="range"
          data-testid="parent-voice-rate"
          min={VOICE_RATE_MIN}
          max={VOICE_RATE_MAX}
          step={VOICE_RATE_STEP}
          value={rate}
          onChange={(event) => changeRate(Number(event.target.value))}
        />
        <span data-testid="parent-voice-rate-value">{rate.toFixed(2)}</span>

        <div>
          <label htmlFor="parent-voice-select">Voix</label>
          <select
            id="parent-voice-select"
            data-testid="parent-voice-select"
            value={selectedVoiceId}
            onChange={(event) => changeVoice(event.target.value)}
          >
            <option value="">(voix par défaut du moteur)</option>
            {voices.map((voice) => (
              <option key={voice.id} value={voice.id}>
                {voice.label}
              </option>
            ))}
          </select>
        </div>

        <button type="button" data-testid="parent-voice-test" onClick={testVoice} style={buttonStyle}>
          <span aria-hidden="true">
            <SpeakerIcon />
          </span>{' '}
          Tester
        </button>
      </div>

      <div data-testid="parent-export-import" style={sectionStyle}>
        <h2 style={headingStyle}>Export / import</h2>
        <button type="button" data-testid="parent-export-start" onClick={startExport} style={buttonStyle}>
          <span aria-hidden="true">
            <DownloadIcon />
          </span>{' '}
          Exporter
        </button>
        {exportJson !== null && (
          <>
            <textarea
              data-testid="parent-export-json"
              readOnly
              value={exportJson}
              style={{ width: '100%', height: 120 }}
            />
            <a
              data-testid="parent-export-download"
              href={`data:application/json;charset=utf-8,${encodeURIComponent(exportJson)}`}
              download="royaume-des-sons-sauvegarde.json"
              style={buttonStyle}
            >
              <span aria-hidden="true">
                <DownloadIcon />
              </span>{' '}
              Télécharger le fichier
            </a>
          </>
        )}

        <div>
          <label htmlFor="parent-import-textarea">Coller une sauvegarde exportée</label>
          <textarea
            id="parent-import-textarea"
            data-testid="parent-import-textarea"
            value={importText}
            onChange={(event) => {
              setImportText(event.target.value)
              setImportStatus({ kind: 'idle' })
            }}
            style={{ width: '100%', height: 120 }}
          />
          <button type="button" data-testid="parent-import-submit" onClick={runImport} style={buttonStyle}>
            <span aria-hidden="true">
              <UploadIcon />
            </span>{' '}
            Importer
          </button>
          {importStatus.kind === 'success' && (
            <p data-testid="parent-import-success">
              <span aria-hidden="true">
                <CheckIcon />
              </span>{' '}
              Importation réussie.
            </p>
          )}
          {importStatus.kind === 'error' && (
            <p data-testid="parent-import-error">
              <span aria-hidden="true">
                <WarningIcon />
              </span>{' '}
              Importation refusée : {importStatus.message}
            </p>
          )}
        </div>
      </div>

      <div data-testid="parent-reset" style={sectionStyle}>
        <h2 style={headingStyle}>Réinitialisation</h2>
        {resetStep === 'idle' && (
          <button type="button" data-testid="parent-reset-start" onClick={startReset} style={buttonStyle}>
            <span aria-hidden="true">
              <TrashIcon />
            </span>{' '}
            Réinitialiser la progression
          </button>
        )}
        {resetStep === 'confirm-1' && (
          <div data-testid="parent-reset-confirm-1">
            <p>
              <span aria-hidden="true">
                <WarningIcon />
              </span>{' '}
              Toute la progression sera effacée définitivement.
            </p>
            <button type="button" data-testid="parent-reset-continue" onClick={continueReset} style={buttonStyle}>
              Continuer
            </button>
            <button type="button" data-testid="parent-reset-cancel" onClick={cancelReset} style={buttonStyle}>
              Annuler
            </button>
          </div>
        )}
        {resetStep === 'confirm-2' && (
          <div data-testid="parent-reset-confirm-2">
            <p>
              <span aria-hidden="true">
                <WarningIcon />
              </span>{' '}
              Dernière confirmation : cette action est irréversible.
            </p>
            <button type="button" data-testid="parent-reset-confirm" onClick={confirmReset} style={buttonStyle}>
              Oui, tout effacer
            </button>
            <button type="button" data-testid="parent-reset-cancel-2" onClick={cancelReset} style={buttonStyle}>
              Annuler
            </button>
          </div>
        )}
        {resetStep === 'done' && (
          <p data-testid="parent-reset-done">
            <span aria-hidden="true">
              <CheckIcon />
            </span>{' '}
            Progression réinitialisée.
          </p>
        )}
      </div>

      <div data-testid="parent-clear-cache-section" style={sectionStyle}>
        <h2 style={headingStyle}>Cache</h2>
        <button type="button" data-testid="parent-clear-cache" onClick={handleClearCache} style={buttonStyle}>
          <span aria-hidden="true">
            <RefreshIcon />
          </span>{' '}
          Vider le cache et recharger
        </button>
      </div>
    </section>
  )
}

const sectionStyle = { marginBottom: 24 }
const headingStyle = { fontSize: 18, marginBottom: 8 }
const buttonStyle = {
  minWidth: 64,
  minHeight: 64,
  touchAction: 'manipulation' as const,
  border: 'none',
  borderRadius: 12,
  padding: '8px 16px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}
