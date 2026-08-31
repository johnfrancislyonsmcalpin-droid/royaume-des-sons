// Suggestion de pause à 20/40 minutes cumulées (SPEC §2.6). Bandeau non
// modal : contrairement à ParentOverlay, il ne couvre jamais tout l'écran et
// n'intercepte aucun tap en dehors de sa propre zone — le jeu reste
// entièrement jouable en dessous, jamais bloqué (CLAUDE.md règle #1, SPEC §2
// règle 3 : « jamais de compte à rebours, de minuteur visible ni de blocage
// autoritaire »). Les deux boutons ne font que refermer le bandeau : c'est le
// choix explicite offert à l'enfant qui compte, pas une navigation forcée
// (aucune action "quitter" ne pourrait de toute façon fermer une PWA).
import { TapTarget } from '../../challenges/shared/TapTarget'
import { uiText } from '../../content/uiText'
import { HourglassIcon } from './icons'

export interface PausePromptProps {
  visible: boolean
  onContinue: () => void
  onTakeBreak: () => void
}

export function PausePrompt({ visible, onContinue, onTakeBreak }: PausePromptProps) {
  if (!visible) return null

  return (
    <div
      data-testid="pause-prompt"
      role="region"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 500,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 16,
        background: '#FFF6E0',
        borderTop: '3px solid #E8B84B',
      }}
    >
      <span aria-hidden="true">
        <HourglassIcon />
      </span>
      <TapTarget onTap={onContinue} label={uiText.pause.continueLabel} testId="pause-prompt-continue">
        {uiText.pause.continueLabel}
      </TapTarget>
      <TapTarget onTap={onTakeBreak} label={uiText.pause.takeBreakLabel} testId="pause-prompt-take-break">
        {uiText.pause.takeBreakLabel}
      </TapTarget>
    </div>
  )
}
