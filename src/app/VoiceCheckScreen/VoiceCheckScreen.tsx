// Écran de vérification de la voix au tout premier lancement (SPEC §3,
// « Écran de vérification de la voix au premier lancement » ; gates
// leaf-F2:G2/G3). C'est le SEUL écran du jeu qui s'adresse explicitement à un
// lecteur adulte (SPEC l'affirme en toutes lettres) : le texte y est donc
// acceptable, contrairement à tout écran destiné à l'enfant qui ne peut rien
// exiger de la lecture (CLAUDE.md règle 1). Le texte de ce fichier (consignes
// adulte, marche à suivre Android) n'est pas du « contenu pédagogique » au
// sens de CLAUDE.md règle 2 : il n'entre jamais dans le corpus appris par
// l'enfant, il ne relève donc pas de src/content/*.json.
//
// Enchaînement choisi (voir ASSUMPTIONS.md, à documenter par le driver) :
// cet écran s'affiche *avant* l'écran « Jouer » habituel, uniquement au tout
// premier lancement (drapeau localStorage dédié, storage.ts). Il amorce
// lui-même la voix sur son propre geste (bouton « Écouter un exemple de
// voix ») plutôt que de dépendre du bouton Jouer de l'écran suivant (src/app/
// screens/PlayScreen.tsx, propriété de la leaf A1) : cela garde cet écran
// entièrement autonome, sans dépendre de l'ordre d'intégration décidé par une
// autre leaf. L'intégrateur (AppShell) insère cet écran comme écran initial
// quand `shouldShowVoiceCheck()` est vrai, sinon démarre directement sur
// « play » comme aujourd'hui.
//
// Défaut évité : l'état muet exposé par src/voice (getMuteState) ne signifie
// pas littéralement « aucune voix fr-* » — il signifie « deux échecs
// consécutifs de démarrage de la synthèse » (voir src/voice/watchdog.ts). Un
// navigateur qui a `speechSynthesis` mais aucune voix française peut très
// bien démarrer normalement avec une voix par défaut dans une autre langue :
// `getMuteState()` resterait alors `false` alors que l'adulte n'entend pas de
// français. La confirmation manuelle de l'adulte (« je n'entends pas ») reste
// donc le détecteur principal et fiable ; `getMuteState()` n'est qu'une
// détection automatique complémentaire pour le cas où la synthèse échoue
// carrément (aucune capacité vocale du tout, ou pannes répétées).
import { useEffect, useRef, useState } from 'react'
import type { ScreenNavigatorApi } from '../ScreenNavigator'
import { cancelAll, getMuteState, primeVoice, speak, subscribeMuteState } from '../../voice'
import { AdultIcon, CheckIcon, CrossIcon, EarIcon } from './icons'
import { hasCompletedVoiceCheck, markVoiceCheckDone } from './storage'
import './VoiceCheckScreen.css'

export const VOICE_CHECK_SCREEN_ID = 'voice-check'

/** À utiliser par l'intégrateur (écran initial d'AppShell) pour savoir si cet
 * écran doit être inséré avant l'écran « Jouer » habituel. */
export function shouldShowVoiceCheck(): boolean {
  return !hasCompletedVoiceCheck()
}

// Phrase de test : volontairement courte (bien sous le seuil de troncature
// d'environ 15 s de Chrome Android, voir src/voice/chunking.ts), et
// suffisamment naturelle pour qu'un adulte francophone reconnaisse
// immédiatement une voix française correcte.
const TEST_PHRASE = 'Bonjour ! Ceci est un test de la voix du jeu, en français.'

type Step = 'ready' | 'confirming' | 'explanation'

export function VoiceCheckScreen({ navigate }: ScreenNavigatorApi) {
  const [step, setStep] = useState<Step>(() => (getMuteState() ? 'explanation' : 'ready'))
  // Garde contre une confirmation accidentellement double (double appui,
  // événement dupliqué) : une fois la décision finale prise, tout appel
  // suivant est ignoré même si un second événement arrive avant que
  // l'écran ait fini de naviguer ailleurs.
  const decidedRef = useRef(false)

  useEffect(() => {
    const unsubscribe = subscribeMuteState((muted) => {
      // speak() peut échouer pendant le test lui-même (deux échecs
      // consécutifs de démarrage, voir src/voice/queue.ts) : l'état muet
      // bascule alors à `true` de façon asynchrone, après le clic. On le
      // traite comme un échec du test et on bascule automatiquement vers
      // l'explication, plutôt que de laisser l'adulte face à des boutons de
      // confirmation qui n'ont objectivement rien pu faire entendre.
      if (muted && !decidedRef.current) setStep('explanation')
    })
    return () => {
      unsubscribe()
      // Changement d'écran : aucun énoncé résiduel ne doit se déclencher
      // après coup (convention PLAN.md, cohérent avec cancelAll() d'A2).
      cancelAll()
    }
  }, [])

  const finish = () => {
    if (decidedRef.current) return
    decidedRef.current = true
    markVoiceCheckDone()
    navigate('play')
  }

  const startOrRepeatTest = () => {
    primeVoice()
    speak({ id: 'voice-check-test', text: TEST_PHRASE, priority: 'instruction', interruptible: true })
    setStep('confirming')
  }

  const confirmNotHeard = () => {
    setStep('explanation')
  }

  const retryFromExplanation = () => {
    // Important : la sélection de voix (src/voice/voiceSelection.ts) n'est
    // résolue qu'une seule fois par instance du moteur (voir engine.ts,
    // `voiceReadyPromise` mis en cache). Si l'adulte vient d'installer une
    // voix française dans les réglages Android pendant que le jeu était
    // ouvert, un simple retour à l'étape « ready » n'en tiendrait pas
    // compte : il faut recharger la page pour que le moteur redémarre et
    // relise la liste des voix à jour.
    window.location.reload()
  }

  return (
    <div className="screen voice-check-screen">
      {step === 'ready' && (
        <>
          <h1 className="voice-check-screen__title">Vérification de la voix</h1>
          <p className="voice-check-screen__body">
            Cet écran s'adresse à un adulte. Touchez le bouton pour écouter un exemple de la voix
            du jeu, puis confirmez si vous entendez bien une voix qui parle français.
          </p>
          <div className="voice-check-screen__actions">
            <button
              type="button"
              className="voice-check-screen__button voice-check-screen__button--primary"
              data-testid="voice-check-start"
              onClick={startOrRepeatTest}
            >
              <span className="voice-check-screen__icon">
                <EarIcon />
              </span>
              Écouter un exemple de voix
            </button>
          </div>
        </>
      )}

      {step === 'confirming' && (
        <>
          <h1 className="voice-check-screen__title">Avez-vous entendu une voix en français ?</h1>
          <div className="voice-check-screen__actions">
            <button
              type="button"
              className="voice-check-screen__button"
              data-testid="voice-check-repeat"
              onClick={startOrRepeatTest}
            >
              <span className="voice-check-screen__icon">
                <EarIcon />
              </span>
              Réécouter
            </button>
            <button
              type="button"
              className="voice-check-screen__button"
              data-testid="voice-check-heard"
              onClick={finish}
            >
              <span className="voice-check-screen__icon">
                <CheckIcon />
              </span>
              J'entends une voix française
            </button>
            <button
              type="button"
              className="voice-check-screen__button"
              data-testid="voice-check-not-heard"
              onClick={confirmNotHeard}
            >
              <span className="voice-check-screen__icon">
                <CrossIcon />
              </span>
              Je n'entends pas de voix française
            </button>
          </div>
        </>
      )}

      {step === 'explanation' && (
        <>
          <span className="voice-check-screen__icon" style={{ width: 72, height: 72 }}>
            <AdultIcon />
          </span>
          <h1 className="voice-check-screen__title">Aucune voix française n'est installée</h1>
          <p className="voice-check-screen__body">
            Le jeu a besoin d'une voix française pour guider l'enfant. Sur une tablette Android,
            installez le pack vocal français en suivant ces étapes :
          </p>
          <ol className="voice-check-screen__steps">
            <li>Paramètres</li>
            <li>Système</li>
            <li>Langues</li>
            <li>Synthèse vocale</li>
            <li>Moteur Google Text-to-Speech</li>
            <li>Paramètres du moteur</li>
            <li>Installer les données vocales du français</li>
          </ol>
          <div className="voice-check-screen__actions">
            <button
              type="button"
              className="voice-check-screen__button"
              data-testid="voice-check-retry"
              onClick={retryFromExplanation}
            >
              <span className="voice-check-screen__icon">
                <EarIcon />
              </span>
              Réessayer après installation
            </button>
            <button
              type="button"
              className="voice-check-screen__button voice-check-screen__button--ghost"
              data-testid="voice-check-continue-anyway"
              onClick={finish}
            >
              Continuer quand même
            </button>
          </div>
        </>
      )}
    </div>
  )
}
