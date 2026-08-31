// Accès caché à l'écran parent (SPEC §9, gate G1) : un appui long de 3 s sur
// une zone invisible du coin supérieur gauche ouvre un pavé numérique avec
// une addition à deux chiffres générée aléatoirement ; seule la bonne réponse
// débloque l'écran parent (`onUnlock`). Ce composant ne connaît RIEN du
// contenu de l'écran parent lui-même : il n'est responsable que de la porte.
//
// La zone tactile est délibérément sans retour visuel (SPEC : accès "caché"),
// mais reste ≥ 64x64 px (CLAUDE.md règle #4) pour rester atteignable par un
// doigt d'adulte qui sait où appuyer, même si elle n'est jamais montrée à
// l'enfant.
import { useCallback, useRef, useState } from 'react'
import { generateAdditionChallenge, isCorrectAnswer, HIDDEN_ACCESS_HOLD_MS, type AdditionChallenge } from './access'
import { BackspaceIcon, CloseIcon, LockIcon } from './icons'

export interface HiddenAccessGateProps {
  /** Appelé une seule fois, quand l'addition proposée est résolue correctement. */
  onUnlock: () => void
  /** Injectable pour les tests : durée d'appui avant apparition du pavé. */
  holdMs?: number
  /** Injectable pour les tests : générateur pseudo-aléatoire déterministe. */
  random?: () => number
}

type Phase = 'locked' | 'challenge'

const HIDDEN_ZONE_SIZE_PX = 64
const MAX_INPUT_DIGITS = 3

export function HiddenAccessGate({ onUnlock, holdMs = HIDDEN_ACCESS_HOLD_MS, random = Math.random }: HiddenAccessGateProps) {
  const [phase, setPhase] = useState<Phase>('locked')
  const [challenge, setChallenge] = useState<AdditionChallenge | null>(null)
  const [input, setInput] = useState('')
  const [wrongAttempt, setWrongAttempt] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearHoldTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const openChallenge = useCallback(() => {
    setChallenge(generateAdditionChallenge(random))
    setInput('')
    setWrongAttempt(false)
    setPhase('challenge')
  }, [random])

  const startHold = useCallback(() => {
    clearHoldTimer()
    timerRef.current = setTimeout(openChallenge, holdMs)
  }, [clearHoldTimer, holdMs, openChallenge])

  const cancelHold = useCallback(() => {
    clearHoldTimer()
  }, [clearHoldTimer])

  const closeChallenge = useCallback(() => {
    setPhase('locked')
    setChallenge(null)
    setInput('')
    setWrongAttempt(false)
  }, [])

  const pressDigit = (digit: string) => {
    setWrongAttempt(false)
    setInput((prev) => (prev.length >= MAX_INPUT_DIGITS ? prev : prev + digit))
  }

  const backspace = () => {
    setWrongAttempt(false)
    setInput((prev) => prev.slice(0, -1))
  }

  const submit = () => {
    if (!challenge) return
    if (isCorrectAnswer(challenge, input)) {
      setPhase('locked')
      setChallenge(null)
      setInput('')
      setWrongAttempt(false)
      onUnlock()
      return
    }
    // Mauvaise réponse : nouvelle addition (jamais la même, pour ne pas
    // laisser deviner par essais successifs sur le même calcul).
    setWrongAttempt(true)
    setChallenge(generateAdditionChallenge(random))
    setInput('')
  }

  return (
    <>
      <div
        data-testid="parent-hidden-zone"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: HIDDEN_ZONE_SIZE_PX,
          height: HIDDEN_ZONE_SIZE_PX,
          minWidth: HIDDEN_ZONE_SIZE_PX,
          minHeight: HIDDEN_ZONE_SIZE_PX,
          opacity: 0,
          touchAction: 'none',
          zIndex: 9999,
        }}
      />

      {phase === 'challenge' && challenge && (
        <div
          data-testid="parent-gate-keypad"
          role="dialog"
          aria-label="Accès parent"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            background: 'rgba(20, 20, 30, 0.92)',
            color: '#fff',
            zIndex: 10000,
          }}
        >
          <span aria-hidden="true">
            <LockIcon />
          </span>
          <p style={{ fontSize: 28, margin: 0 }}>
            {challenge.a} + {challenge.b} = ?
          </p>
          <p
            data-testid="parent-gate-input"
            style={{ fontSize: 32, minHeight: 40, letterSpacing: 4, margin: 0 }}
            aria-live="polite"
          >
            {input || ' '}
          </p>
          {wrongAttempt && (
            <p data-testid="parent-gate-wrong" style={{ color: '#ff8080', margin: 0 }}>
              Réponse incorrecte, nouvel essai.
            </p>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 64px)',
              gap: 8,
            }}
          >
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                data-testid={`parent-gate-digit-${digit}`}
                onClick={() => pressDigit(digit)}
                style={keypadButtonStyle}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              data-testid="parent-gate-backspace"
              onClick={backspace}
              style={keypadButtonStyle}
              aria-label="Effacer le dernier chiffre"
            >
              <BackspaceIcon />
            </button>
            <button
              type="button"
              data-testid="parent-gate-digit-0"
              onClick={() => pressDigit('0')}
              style={keypadButtonStyle}
            >
              0
            </button>
            <button
              type="button"
              data-testid="parent-gate-submit"
              onClick={submit}
              style={{ ...keypadButtonStyle, background: '#3a7a3a' }}
              aria-label="Valider"
            >
              ✓
            </button>
          </div>
          <button
            type="button"
            data-testid="parent-gate-cancel"
            onClick={closeChallenge}
            style={{ ...keypadButtonStyle, marginTop: 8 }}
            aria-label="Annuler"
          >
            <CloseIcon />
          </button>
        </div>
      )}
    </>
  )
}

const keypadButtonStyle = {
  minWidth: 64,
  minHeight: 64,
  touchAction: 'manipulation' as const,
  userSelect: 'none' as const,
  border: 'none',
  borderRadius: 12,
  fontSize: 22,
  background: '#444',
  color: '#fff',
  cursor: 'pointer',
}
