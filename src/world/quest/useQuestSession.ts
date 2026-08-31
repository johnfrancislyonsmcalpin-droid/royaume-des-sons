// Moteur de session de quête (tâche E3 point 2) : maintient un `QuestState`
// (types.ts, FIGÉ), avance au défi suivant après chaque `onAnswer`, applique
// à chaque résultat `updateAntiGuess` (D5), `recordResult` (D1/mastery),
// `recordChallengeResult` (D2/spacing) et l'aide graduée (D4/help.ts), et
// propage `vaChercherUnGrand` comme un événement exposé — pas géré ici,
// c'est l'écran parent (F1, pas encore livré) qui l'affichera (tâche E3).
//
// Ce hook ne touche jamais src/save/** (A3, hors OWNS) : il expose l'état à
// jour via des callbacks (`onQuestStateChange`, `onMasteryChange`,
// `onReviewQueueChange`) après CHAQUE défi — jamais seulement en fin de
// quête — pour que l'appelant puisse persister à la même cadence que SPEC
// §3 l'exige de la sauvegarde (« écriture après chaque défi, pas seulement
// en fin de quête »), sans que ce hook ait à connaître localStorage.
import { useCallback, useRef, useState } from 'react'
import type { Challenge, ChallengeResult, ContentItem, HelpLevel, MasteryState, QuestState, ReviewQueueItem } from '../../types'
import type { ChallengeSpeakFn } from '../../challenges/shared/contract'
import { recordResult } from '../../engine/mastery'
import { recordChallengeResult } from '../../engine/spacing'
import { initialAntiGuessState, updateAntiGuess, type AntiGuessState } from '../../engine/antiguess'
import {
  createChallengeHelpState,
  createQuestHelpState,
  recordChallengeOutcome,
  recordIncorrectAnswer,
  revealAnswer,
  shouldRevealAnswer,
  useLantern as advanceLantern,
  type ChallengeHelpState,
  type QuestHelpState,
  type VaChercherUnGrandEvent,
} from '../../engine/help'
import { getPronunciation } from '../../content/tables'

async function speakSequential(speak: ChallengeSpeakFn, texts: readonly string[]): Promise<void> {
  for (const text of texts) {
    if (!text) continue
    // Volontairement séquentiel (pas Promise.all) : c'est un décodage
    // syllabe par syllabe, l'ordre et l'espacement temporel SONT la
    // pédagogie (SPEC §6, §8).
    // eslint-disable-next-line no-await-in-loop
    await speak(text)
  }
}

function emptySkillMastery(skillId: string) {
  return { skillId, last10: [] as boolean[], masteredAt: null, decayedAt: null }
}

export interface UseQuestSessionArgs {
  questState: QuestState
  /** Niveau courant du joueur (règle spéciale niveau 10 de D1/mastery.ts :
   * la réécoute y compte comme un indice). */
  level: number
  mastery: MasteryState
  reviewQueue: ReviewQueueItem[]
  /** Compteur cumulatif de quêtes jouées, base de D2/spacing.ts. */
  questsPlayed: number
  resolveItem: (contentItemId: string) => ContentItem
  speak: ChallengeSpeakFn
  /** Persistance après CHAQUE défi (voir en-tête de fichier) — jamais requis,
   * un appelant qui teste ce hook isolément peut l'omettre. */
  onQuestStateChange?: (next: QuestState) => void
  onMasteryChange?: (next: MasteryState) => void
  onReviewQueueChange?: (next: ReviewQueueItem[]) => void
  /** SPEC §8 : 3 défis consécutifs échoués malgré les indices -> événement
   * journalisé, jamais bloquant. Cette fonction ne décide d'aucun affichage :
   * elle propage seulement l'événement à l'écran parent (F1). */
  onVaChercherUnGrand?: (event: VaChercherUnGrandEvent) => void
  /** Appelé une fois quand le dernier défi de la file vient d'être résolu. */
  onQuestComplete?: (finalQuestState: QuestState) => void
}

export interface UseQuestSessionResult {
  questState: QuestState
  currentChallenge: Challenge | null
  helpLevel: HelpLevel
  usedListenAgain: boolean
  /** Vrai quand tous les défis de la file ont été résolus. */
  isComplete: boolean
  /** Nombre de défis consécutifs échoués malgré les indices (SPEC §8),
   * exposé pour un affichage éventuel côté F1 sans dupliquer le calcul. */
  consecutiveFailedChallenges: number
  /** Bouton oreille : réécoute, gratuite et illimitée, sans effet sur l'aide. */
  pressEar: () => void
  /** Bouton lanterne : avance le palier d'indice courant, jamais au-delà de 3. */
  pressLantern: () => void
  /** À passer tel quel en `onAnswer` au composant de défi courant. */
  handleAnswer: (result: Omit<ChallengeResult, 'timestamp'>) => void
}

export function useQuestSession(args: UseQuestSessionArgs): UseQuestSessionResult {
  const {
    questState: initialQuestState,
    level,
    mastery: initialMastery,
    reviewQueue: initialReviewQueue,
    questsPlayed,
    resolveItem,
    speak,
    onQuestStateChange,
    onMasteryChange,
    onReviewQueueChange,
    onVaChercherUnGrand,
    onQuestComplete,
  } = args

  const [questState, setQuestState] = useState<QuestState>(initialQuestState)
  const [helpState, setHelpState] = useState<ChallengeHelpState>(createChallengeHelpState())
  const [questHelpState, setQuestHelpState] = useState<QuestHelpState>(createQuestHelpState())
  const [usedListenAgain, setUsedListenAgain] = useState(false)

  // Ces trois états n'ont pas besoin de déclencher un nouveau rendu à eux
  // seuls (ils ne pilotent aucun affichage direct, seulement des callbacks
  // de persistance) : une ref évite un rendu supplémentaire à chaque défi.
  const antiGuessRef = useRef<AntiGuessState>(initialAntiGuessState)
  const masteryRef = useRef<MasteryState>(initialMastery)
  const reviewQueueRef = useRef<ReviewQueueItem[]>(initialReviewQueue)

  const currentChallenge = questState.challengeQueue[questState.currentIndex] ?? null
  const isComplete = currentChallenge === null

  const pressLantern = useCallback(() => {
    setHelpState((prev) => advanceLantern(prev))
  }, [])

  const pressEar = useCallback(() => {
    setUsedListenAgain(true)
    if (currentChallenge) {
      void speak(resolveItem(currentChallenge.targetItemId).text)
    }
  }, [currentChallenge, resolveItem, speak])

  const handleAnswer = useCallback(
    (partial: Omit<ChallengeResult, 'timestamp'>) => {
      if (!currentChallenge) return
      const timestamp = new Date().toISOString()
      const result: ChallengeResult = { ...partial, timestamp }

      // D5 anti-devinette : le signal se traduit ici par une consigne
      // rejouée. `contract.ts` n'offre aucun moyen de refuser l'appel
      // suivant à `onAnswer` du composant de défi (il gère lui-même sa
      // propre re-tentative après une réponse incorrecte) : le blocage dur
      // décrit par SPEC §7 (« avant d'accepter la réponse suivante ») n'est
      // donc pas atteignable avec le contrat FIGÉ actuel. Limite connue,
      // documentée pour ASSUMPTIONS.md — la consigne est bien rejouée, ce
      // qui reste la partie observable par l'enfant.
      const antiGuessUpdate = updateAntiGuess(antiGuessRef.current, {
        correct: result.correct,
        responseMs: result.responseMs,
      })
      antiGuessRef.current = antiGuessUpdate.state
      if (antiGuessUpdate.triggered) {
        void speak(resolveItem(currentChallenge.targetItemId).text)
      }

      // D1 maîtrise
      const previousSkillMastery = masteryRef.current.skills[currentChallenge.skillId] ?? emptySkillMastery(currentChallenge.skillId)
      const nextSkillMastery = recordResult(previousSkillMastery, result, level)
      const nextMastery: MasteryState = {
        ...masteryRef.current,
        skills: { ...masteryRef.current.skills, [currentChallenge.skillId]: nextSkillMastery },
      }
      masteryRef.current = nextMastery
      onMasteryChange?.(nextMastery)

      // D2 répétition espacée
      const nextReviewQueue = recordChallengeResult(
        reviewQueueRef.current,
        currentChallenge.targetItemId,
        currentChallenge.skillId,
        { correct: result.correct },
        questsPlayed,
        timestamp,
      )
      reviewQueueRef.current = nextReviewQueue
      onReviewQueueChange?.(nextReviewQueue)

      const nextResults = [...questState.results, result]

      if (!result.correct) {
        // SPEC §8 : après 2 réponses incorrectes sur ce défi, révélation
        // guidée (décodage syllabe par syllabe) puis reproposition du même
        // défi — l'index de quête n'avance PAS.
        const afterIncorrect = recordIncorrectAnswer(helpState)
        let finalHelpState = afterIncorrect
        if (shouldRevealAnswer(afterIncorrect)) {
          const targetGraphemeIds = resolveItem(currentChallenge.targetItemId).graphemeIds
          const { state: revealedState, reveal } = revealAnswer(afterIncorrect, targetGraphemeIds)
          finalHelpState = revealedState
          void speakSequential(speak, reveal.syllables.map((graphemeId) => getPronunciation(graphemeId)))
        }
        setHelpState(finalHelpState)

        const nextQuestState: QuestState = { ...questState, results: nextResults }
        setQuestState(nextQuestState)
        onQuestStateChange?.(nextQuestState)
        return
      }

      // Réponse correcte : le défi est résolu pour ce passage. SPEC §8 : un
      // défi résolu au palier 3 de lanterne (bonne réponse clignotante) doit
      // revenir plus tard dans la quête SANS indice.
      const failedDespiteHelp = helpState.revealed
      const outcome = recordChallengeOutcome(questHelpState, {
        challengeId: currentChallenge.id,
        failedDespiteHelp,
        timestamp,
      })
      setQuestHelpState(outcome.state)
      if (outcome.vaChercherUnGrand) {
        onVaChercherUnGrand?.({ challengeId: currentChallenge.id, timestamp })
      }

      const shouldRequeueWithoutHint = helpState.helpLevel >= 3
      const nextQueue = shouldRequeueWithoutHint
        ? [...questState.challengeQueue, { ...currentChallenge, id: `${currentChallenge.id}:requeue:${questState.results.length}` }]
        : questState.challengeQueue

      const nextIndex = questState.currentIndex + 1
      const nextQuestState: QuestState = {
        ...questState,
        challengeQueue: nextQueue,
        currentIndex: nextIndex,
        results: nextResults,
      }
      setQuestState(nextQuestState)
      onQuestStateChange?.(nextQuestState)
      setHelpState(createChallengeHelpState())
      setUsedListenAgain(false)

      if (nextIndex >= nextQueue.length) {
        onQuestComplete?.(nextQuestState)
      }
    },
    [
      currentChallenge,
      questState,
      helpState,
      questHelpState,
      level,
      questsPlayed,
      resolveItem,
      speak,
      onMasteryChange,
      onReviewQueueChange,
      onQuestStateChange,
      onVaChercherUnGrand,
      onQuestComplete,
    ],
  )

  return {
    questState,
    currentChallenge,
    helpLevel: helpState.helpLevel,
    usedListenAgain,
    isComplete,
    consecutiveFailedChallenges: questHelpState.consecutiveFailedChallenges,
    pressEar,
    pressLantern,
    handleAnswer,
  }
}
