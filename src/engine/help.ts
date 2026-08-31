// Aide graduée (leaf D4, SPEC §8) — moteur pur : aucune UI, aucun appel voix,
// aucune lecture d'horloge globale (les horodatages sont toujours injectés
// par l'appelant), et surtout AUCUN effet sur les récompenses ou l'avatar.
// Aucune fonction de ce module n'accepte ni ne retourne d'`AvatarState` :
// c'est vérifié explicitement dans help.test.ts (groupe "avatar et
// récompenses"), pas seulement affirmé ici.
//
// Deux mécanismes distincts et volontairement non interchangeables :
//
// - Oreille : réécoute de la consigne. Gratuite, illimitée, sans effet sur la
//   maîtrise ni sur le niveau d'aide. Modélisée par `listenAgain`, qui ne
//   touche JAMAIS `ChallengeHelpState.helpLevel` — c'est la preuve, pas
//   seulement l'affirmation, que l'oreille n'est pas un indice.
// - Lanterne : indice gradué à l'intérieur du défi courant, 3 paliers,
//   jamais au-delà de 3, jamais décrémenté automatiquement. Modélisée par
//   `useLantern` (avance le palier) et `lanternHintForLevel` (calcule
//   l'action à exposer à l'UI/voix pour le palier courant).
//
// Au-delà de 2 réponses incorrectes sur le même défi : révélation guidée
// (décodage syllabe par syllabe) puis re-proposition du même défi
// (`revealAnswer`). Au-delà de 3 défis CONSÉCUTIFS échoués malgré les
// indices : signal `vaChercherUnGrand`, jamais bloquant, journalisé
// (`recordChallengeOutcome`).

import type { Challenge, GraphemeId, HelpLevel } from '../types'

// ---------------------------------------------------------------------------
// État d'aide pour UN défi en cours
// ---------------------------------------------------------------------------

export interface ChallengeHelpState {
  /** Palier de lanterne courant pour CE défi. Jamais > 3, jamais décrémenté automatiquement. */
  helpLevel: HelpLevel
  /** Nombre de réponses incorrectes données sur ce défi, peu importe l'aide utilisée. */
  incorrectCount: number
  /** Vrai une fois que la révélation (2 échecs) a eu lieu pour ce défi. */
  revealed: boolean
  /** Options déjà retirées par la lanterne (palier 2), pour ne jamais en retirer une deuxième fois par erreur. */
  hiddenOptionIds: string[]
}

export function createChallengeHelpState(): ChallengeHelpState {
  return { helpLevel: 0, incorrectCount: 0, revealed: false, hiddenOptionIds: [] }
}

// ---------------------------------------------------------------------------
// Oreille — réécoute, gratuite, illimitée, sans effet sur l'aide
// ---------------------------------------------------------------------------

export interface ListenAgainAction {
  type: 'replay-instruction'
}

/**
 * Rejoue la consigne. Ne modifie JAMAIS `state.helpLevel` (contrairement à la
 * lanterne) : c'est la différence structurelle entre les deux boutons.
 * Retourne le même état par valeur (nouvelle référence, contenu identique)
 * pour rester homogène avec le style « fonction pure » du reste du module.
 */
export function listenAgain(state: ChallengeHelpState): {
  state: ChallengeHelpState
  action: ListenAgainAction
} {
  return { state: { ...state }, action: { type: 'replay-instruction' } }
}

// ---------------------------------------------------------------------------
// Lanterne — 3 paliers gradués, jamais au-delà, jamais décrémentés
// ---------------------------------------------------------------------------

export interface HighlightFirstHint {
  type: 'highlight-first'
  graphemeId: GraphemeId
}

export interface HideOptionHint {
  type: 'hide-option'
  optionId: string
}

export interface BlinkCorrectHint {
  type: 'blink-correct'
  optionId: string
  /** Ce même défi doit revenir plus tard dans la quête, sans indice cette fois. */
  requeueWithoutHint: true
}

export type LanternHint = HighlightFirstHint | HideOptionHint | BlinkCorrectHint | null

/**
 * Avance le palier de lanterne d'un cran, jamais au-delà de 3. Un appui alors
 * que le palier est déjà à 3 est un no-op explicite : le palier ne redescend
 * jamais automatiquement et ne dépasse jamais 3, quel que soit le nombre
 * d'appuis supplémentaires.
 */
export function useLantern(state: ChallengeHelpState): ChallengeHelpState {
  if (state.helpLevel >= 3) return state
  return { ...state, helpLevel: (state.helpLevel + 1) as HelpLevel }
}

/**
 * Choisit la mauvaise option à retirer au palier 2 : un distracteur du défi
 * (jamais la bonne réponse), qui n'a pas déjà été retiré par un appel
 * précédent.
 */
export function pickDistractorToHide(challenge: Challenge, hiddenOptionIds: string[]): string | null {
  const candidate = challenge.options.find(
    (option) =>
      option.isDistractor &&
      option.contentItemId !== challenge.targetItemId &&
      !hiddenOptionIds.includes(option.id),
  )
  return candidate ? candidate.id : null
}

/**
 * Enregistre qu'une option a été retirée par la lanterne, pour que
 * `pickDistractorToHide` ne la reretire pas et n'en retire pas une seconde
 * involontairement si le palier est recalculé plusieurs fois (ex. re-render UI).
 */
export function applyHiddenOption(state: ChallengeHelpState, optionId: string): ChallengeHelpState {
  if (state.hiddenOptionIds.includes(optionId)) return state
  return { ...state, hiddenOptionIds: [...state.hiddenOptionIds, optionId] }
}

/**
 * Calcule l'action d'aide à exposer à l'UI/voix pour le palier courant de
 * `state`. `targetGraphemeIds` est la décomposition explicite de l'item
 * cible du défi (fournie par le contenu — cf. SPEC §5, jamais devinée) ;
 * son premier élément est « la première lettre ou syllabe » du palier 1.
 *
 * Ne fait AUCUNE validation à la place du joueur : au palier 3, la bonne
 * réponse clignote (`blink-correct`) mais `requeueWithoutHint: true` est la
 * seule conséquence encodée ici — le joueur doit toujours toucher lui-même
 * l'option pour que le défi soit considéré réussi (cette leaf n'émet jamais
 * de validation automatique).
 */
export function lanternHintForLevel(
  state: ChallengeHelpState,
  challenge: Challenge,
  targetGraphemeIds: GraphemeId[],
): LanternHint {
  switch (state.helpLevel) {
    case 0:
      return null
    case 1: {
      const firstGraphemeId = targetGraphemeIds[0]
      if (!firstGraphemeId) return null
      return { type: 'highlight-first', graphemeId: firstGraphemeId }
    }
    case 2: {
      const optionId = pickDistractorToHide(challenge, state.hiddenOptionIds)
      if (!optionId) return null
      return { type: 'hide-option', optionId }
    }
    case 3: {
      const correctOption = challenge.options.find((option) => option.contentItemId === challenge.targetItemId)
      if (!correctOption) return null
      return { type: 'blink-correct', optionId: correctOption.id, requeueWithoutHint: true }
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// 2 réponses incorrectes sur le même défi → révélation guidée puis re-proposition
// ---------------------------------------------------------------------------

export interface RevealAnswer {
  revealAnswer: true
  /** Décodage syllabe par syllabe, dans l'ordre, tel que fourni par le contenu (jamais deviné). */
  syllables: GraphemeId[]
  /** Signal explicite : le même défi doit être reproposé après la révélation. */
  requeueSameChallenge: true
}

/** Enregistre une réponse incorrecte sur ce défi, peu importe l'aide utilisée au moment de la réponse. */
export function recordIncorrectAnswer(state: ChallengeHelpState): ChallengeHelpState {
  return { ...state, incorrectCount: state.incorrectCount + 1 }
}

/** Vrai à partir de la 2e réponse incorrecte sur ce défi, tant que la révélation n'a pas déjà eu lieu. */
export function shouldRevealAnswer(state: ChallengeHelpState): boolean {
  return state.incorrectCount >= 2 && !state.revealed
}

/**
 * Révèle la bonne réponse décodée syllabe par syllabe et signale qu'il faut
 * reproposer le même défi. Idempotent au sens où `state.revealed` passe à
 * `true` : un appelant qui vérifie `shouldRevealAnswer` avant d'appeler cette
 * fonction ne la déclenche donc qu'une seule fois par défi.
 */
export function revealAnswer(
  state: ChallengeHelpState,
  orderedGraphemeIds: GraphemeId[],
): { state: ChallengeHelpState; reveal: RevealAnswer } {
  return {
    state: { ...state, revealed: true },
    reveal: {
      revealAnswer: true,
      syllables: orderedGraphemeIds,
      requeueSameChallenge: true,
    },
  }
}

// ---------------------------------------------------------------------------
// 3 défis CONSÉCUTIFS échoués malgré les indices → « Va chercher un grand »
// ---------------------------------------------------------------------------

export interface VaChercherUnGrandEvent {
  challengeId: string
  timestamp: string // ISO 8601
}

export interface QuestHelpState {
  /** Nombre de défis consécutifs échoués malgré les indices ; remis à zéro dès qu'un défi est réussi. */
  consecutiveFailedChallenges: number
  /** Journal des événements « Va chercher un grand », pour qu'une couche supérieure (écran parent, F1) les compte. */
  vaChercherUnGrandEvents: VaChercherUnGrandEvent[]
}

export function createQuestHelpState(): QuestHelpState {
  return { consecutiveFailedChallenges: 0, vaChercherUnGrandEvents: [] }
}

/**
 * Un défi compte comme « échoué malgré les indices » quand la révélation
 * (2 réponses incorrectes) a été nécessaire pour ce défi : c'est la mesure
 * objective de l'échec au sens de SPEC §8, indépendamment du fait que
 * l'enfant ait ensuite touché la bonne réponse une fois qu'elle lui a été
 * montrée (elle est alors reconnue, pas trouvée).
 */
export function didChallengeFailDespiteHelp(state: ChallengeHelpState): boolean {
  return state.revealed
}

/**
 * À appeler à la fin de chaque défi de la quête, avec le verdict calculé via
 * `didChallengeFailDespiteHelp`. Ne retire JAMAIS de récompense et ne touche
 * JAMAIS à `AvatarState` : cette fonction, comme toutes les autres de ce
 * module, n'accepte aucun paramètre de type avatar/récompense et n'en
 * retourne aucun — impossible par construction d'y toucher depuis ici.
 *
 * Émet `vaChercherUnGrand: true` après 3 défis consécutifs échoués — jamais
 * bloquant : l'appelant garde toujours la main pour proposer un bouton de
 * reprise, cette fonction ne fait qu'émettre le signal et le journaliser.
 * Le compteur est remis à zéro immédiatement après l'émission, pour que
 * l'enchaînement puisse se redéclencher (et se journaliser de nouveau) si de
 * nouveaux échecs consécutifs surviennent plus tard dans la même quête.
 */
export function recordChallengeOutcome(
  state: QuestHelpState,
  outcome: { challengeId: string; failedDespiteHelp: boolean; timestamp: string },
): { state: QuestHelpState; vaChercherUnGrand: boolean } {
  if (!outcome.failedDespiteHelp) {
    return {
      state: { ...state, consecutiveFailedChallenges: 0 },
      vaChercherUnGrand: false,
    }
  }

  const consecutiveFailedChallenges = state.consecutiveFailedChallenges + 1

  if (consecutiveFailedChallenges >= 3) {
    const event: VaChercherUnGrandEvent = {
      challengeId: outcome.challengeId,
      timestamp: outcome.timestamp,
    }
    return {
      state: {
        consecutiveFailedChallenges: 0,
        vaChercherUnGrandEvents: [...state.vaChercherUnGrandEvents, event],
      },
      vaChercherUnGrand: true,
    }
  }

  return {
    state: { ...state, consecutiveFailedChallenges },
    vaChercherUnGrand: false,
  }
}
