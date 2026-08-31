// QuestRunner (tâche E3 point 2) : rend le composant de mécanique
// correspondant à `challenge.kind` (CHALLENGE_COMPONENTS), lui passe le
// contrat `ChallengeComponentProps` exact (contract.ts), et gère la
// progression au défi suivant via `useQuestSession`. Rend aussi le chrome
// commun à tous les défis (SPEC §8 : boutons oreille + lanterne permanents,
// « pas rendu par le composant de défi lui-même » — contract.ts).
import type { ContentItem } from '../../types'
import type { ChallengeSpeakFn } from '../../challenges/shared/contract'
import { TapTarget } from '../../challenges/shared/TapTarget'
import { CHALLENGE_COMPONENTS } from './challengeComponents'
import { useQuestSession, type UseQuestSessionArgs, type UseQuestSessionResult } from './useQuestSession'
import { EarGlyph, LanternGlyph } from './Glyphs'

export interface QuestRunnerProps extends UseQuestSessionArgs {
  resolveItem: (contentItemId: string) => ContentItem
  speak: ChallengeSpeakFn
  /** Appelé quand la quête n'a plus de défi à présenter (`isComplete`), pour
   * que l'appelant puisse déclencher `completeQuest` (questLifecycle.ts) et
   * naviguer hors de l'écran de quête. Distinct de `onQuestComplete` (fourni
   * à `useQuestSession`) : celui-ci est un événement ponctuel au moment de la
   * résolution du dernier défi, `onRunnerIdle` reflète l'état de rendu
   * courant (utile si le composant est remonté après une reprise déjà
   * terminée). */
  onRunnerIdle?: (session: UseQuestSessionResult) => void
}

export function QuestRunner(props: QuestRunnerProps) {
  const { resolveItem, speak, onRunnerIdle, ...sessionArgs } = props
  const session = useQuestSession({ ...sessionArgs, resolveItem, speak })

  if (session.isComplete || !session.currentChallenge) {
    onRunnerIdle?.(session)
    return <div className="quest-runner quest-runner--complete" data-testid="quest-runner-complete" />
  }

  const ChallengeComponent = CHALLENGE_COMPONENTS[session.currentChallenge.kind]

  return (
    <div className="quest-runner" data-testid="quest-runner">
      <div className="quest-runner__challenge" data-testid="quest-runner-challenge">
        <ChallengeComponent
          challenge={session.currentChallenge}
          helpLevel={session.helpLevel}
          usedListenAgain={session.usedListenAgain}
          resolveItem={resolveItem}
          speak={speak}
          onAnswer={session.handleAnswer}
        />
      </div>

      <div
        role="group"
        aria-label="Aide"
        className="quest-runner__help-chrome"
        data-testid="quest-runner-help-chrome"
      >
        <TapTarget onTap={session.pressEar} label="Réécouter la consigne" testId="quest-runner-ear">
          <EarGlyph />
        </TapTarget>
        <TapTarget onTap={session.pressLantern} label="Demander un indice" testId="quest-runner-lantern">
          <LanternGlyph />
        </TapTarget>
      </div>
    </div>
  )
}
