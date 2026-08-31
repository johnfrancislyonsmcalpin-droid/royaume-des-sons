// Composition de l'écran parent (SPEC §9, leaf F1) : la porte cachée
// (HiddenAccessGate) reste toujours montée par l'intégrateur ; une fois
// débloquée, ce composant affiche le tableau de bord (lecture) et les
// réglages/actions (écriture) dans un même écran, avec un bouton de
// fermeture explicite pour revenir au jeu.
import { useCallback, useState } from 'react'
import { loadSaveFile } from '../save'
import { HiddenAccessGate } from './HiddenAccessGate'
import { ParentDashboard } from './Dashboard'
import { ParentSettings } from './Settings'
import { CloseIcon } from './icons'

export function ParentScreen() {
  const [unlocked, setUnlocked] = useState(false)
  // Snapshot pris à l'ouverture : le tableau de bord ne doit pas se remettre
  // à jour tout seul pendant qu'un adulte le consulte (SaveFile lu une fois,
  // pas un flux réactif).
  const [save, setSave] = useState(() => loadSaveFile())

  const unlock = useCallback(() => {
    setSave(loadSaveFile())
    setUnlocked(true)
  }, [])

  const close = useCallback(() => setUnlocked(false), [])

  if (!unlocked) {
    return <HiddenAccessGate onUnlock={unlock} />
  }

  return (
    <div data-testid="parent-screen" role="region" aria-label="Écran parent" style={{ padding: 16 }}>
      <button
        type="button"
        data-testid="parent-screen-close"
        onClick={close}
        aria-label="Fermer l'écran parent"
        style={{ minWidth: 64, minHeight: 64, border: 'none', borderRadius: 12, cursor: 'pointer' }}
      >
        <CloseIcon />
      </button>
      <ParentDashboard save={save} />
      <ParentSettings getSaveForExport={() => loadSaveFile()} onReset={() => setSave(loadSaveFile())} />
    </div>
  )
}
