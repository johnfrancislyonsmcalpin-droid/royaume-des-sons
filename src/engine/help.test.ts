import { describe, expect, it } from 'vitest'
import {
  applyHiddenOption,
  createChallengeHelpState,
  createQuestHelpState,
  didChallengeFailDespiteHelp,
  lanternHintForLevel,
  listenAgain,
  pickDistractorToHide,
  recordChallengeOutcome,
  recordIncorrectAnswer,
  revealAnswer,
  shouldRevealAnswer,
  useLantern,
} from './help'
import type { AvatarState, Challenge } from '../types'

function makeChallenge(): Challenge {
  return {
    id: 'challenge-1',
    kind: 'listen-touch',
    skillId: 'L2-consonnes',
    targetItemId: 'item-chat',
    isReview: false,
    options: [
      { id: 'opt-correct', contentItemId: 'item-chat', isDistractor: false },
      { id: 'opt-distractor-1', contentItemId: 'item-chien', isDistractor: true },
      { id: 'opt-distractor-2', contentItemId: 'item-cheval', isDistractor: true },
    ],
  }
}

describe('aide graduée', () => {
  describe('lanterne', () => {
    it('palier 0 (aucun appui) ne produit aucun indice', () => {
      const state = createChallengeHelpState()
      const challenge = makeChallenge()
      expect(state.helpLevel).toBe(0)
      expect(lanternHintForLevel(state, challenge, ['ch', 'a', 't'])).toBeNull()
    })

    it('palier 1 : le compagnon énonce le son de la première lettre/syllabe et la surligne', () => {
      const challenge = makeChallenge()
      const state = useLantern(createChallengeHelpState())
      expect(state.helpLevel).toBe(1)
      const hint = lanternHintForLevel(state, challenge, ['ch', 'a', 't'])
      expect(hint).toEqual({ type: 'highlight-first', graphemeId: 'ch' })
    })

    it('palier 2 : une mauvaise option disparaît, jamais la bonne réponse', () => {
      const challenge = makeChallenge()
      let state = useLantern(createChallengeHelpState())
      state = useLantern(state)
      expect(state.helpLevel).toBe(2)

      const hint = lanternHintForLevel(state, challenge, ['ch', 'a', 't'])
      expect(hint?.type).toBe('hide-option')
      if (hint?.type !== 'hide-option') throw new Error('expected hide-option')

      const hiddenOption = challenge.options.find((o) => o.id === hint.optionId)
      expect(hiddenOption?.isDistractor).toBe(true)
      expect(hiddenOption?.contentItemId).not.toBe(challenge.targetItemId)
    })

    it('palier 2 : ne retire jamais deux fois la même option déjà retirée', () => {
      const challenge = makeChallenge()
      let state = useLantern(useLantern(createChallengeHelpState()))
      const firstHint = lanternHintForLevel(state, challenge, ['ch', 'a', 't'])
      if (firstHint?.type !== 'hide-option') throw new Error('expected hide-option')
      state = applyHiddenOption(state, firstHint.optionId)

      const remaining = pickDistractorToHide(challenge, state.hiddenOptionIds)
      expect(remaining).not.toBe(firstHint.optionId)
      expect(remaining).not.toBeNull()
    })

    it('palier 3 : la bonne réponse clignote, mais le joueur doit quand même la toucher (pas d\'auto-validation), et le défi doit revenir plus tard sans indice', () => {
      const challenge = makeChallenge()
      const state = useLantern(useLantern(useLantern(createChallengeHelpState())))
      expect(state.helpLevel).toBe(3)

      const hint = lanternHintForLevel(state, challenge, ['ch', 'a', 't'])
      expect(hint).toEqual({
        type: 'blink-correct',
        optionId: 'opt-correct',
        requeueWithoutHint: true,
      })
      // Le hint ne contient AUCUN signal de validation automatique : ni
      // `correct`, ni `challengeResolved`, ni quoi que ce soit qui dispense le
      // joueur de toucher lui-même l'option. Seules les clés attendues existent.
      expect(Object.keys(hint as object).sort()).toEqual(['optionId', 'requeueWithoutHint', 'type'])
    })

    it('ne dépasse jamais le palier 3, même après de nombreux appuis supplémentaires', () => {
      let state = createChallengeHelpState()
      for (let i = 0; i < 10; i++) {
        state = useLantern(state)
      }
      expect(state.helpLevel).toBe(3)
    })

    it('ne redescend jamais automatiquement : le palier reste stable tant que useLantern n\'est pas rappelée', () => {
      const state = useLantern(useLantern(createChallengeHelpState()))
      expect(state.helpLevel).toBe(2)
      // Aucune fonction du module ne fait redescendre helpLevel : on relit
      // simplement le même state (immuable) et on vérifie qu'il n'a pas changé.
      const snapshot = { ...state }
      expect(state).toEqual(snapshot)
      expect(state.helpLevel).toBe(2)
    })

    it('l\'oreille (réécoute) est gratuite, illimitée, et ne modifie JAMAIS le palier de lanterne', () => {
      let state = createChallengeHelpState()
      for (let i = 0; i < 20; i++) {
        const result = listenAgain(state)
        expect(result.action).toEqual({ type: 'replay-instruction' })
        state = result.state
      }
      expect(state.helpLevel).toBe(0)

      // Même à un palier de lanterne déjà entamé, l'oreille reste sans effet
      // sur ce palier : les deux mécanismes sont indépendants.
      let stateAtLevel2 = useLantern(useLantern(createChallengeHelpState()))
      for (let i = 0; i < 5; i++) {
        stateAtLevel2 = listenAgain(stateAtLevel2).state
      }
      expect(stateAtLevel2.helpLevel).toBe(2)
    })
  })

  describe('deux echecs', () => {
    it('ne révèle rien après une seule réponse incorrecte', () => {
      const state = recordIncorrectAnswer(createChallengeHelpState())
      expect(state.incorrectCount).toBe(1)
      expect(shouldRevealAnswer(state)).toBe(false)
    })

    it('révèle la bonne réponse décodée syllabe par syllabe après 2 réponses incorrectes', () => {
      let state = createChallengeHelpState()
      state = recordIncorrectAnswer(state)
      state = recordIncorrectAnswer(state)
      expect(state.incorrectCount).toBe(2)
      expect(shouldRevealAnswer(state)).toBe(true)

      const { state: nextState, reveal } = revealAnswer(state, ['ch', 'a', 't'])
      expect(reveal.revealAnswer).toBe(true)
      expect(reveal.syllables).toEqual(['ch', 'a', 't'])
      expect(nextState.revealed).toBe(true)
    })

    it('signale explicitement qu\'il faut reproposer le même défi après révélation', () => {
      let state = createChallengeHelpState()
      state = recordIncorrectAnswer(state)
      state = recordIncorrectAnswer(state)
      const { reveal } = revealAnswer(state, ['ch', 'a', 't'])
      expect(reveal.requeueSameChallenge).toBe(true)
    })

    it('la révélation se déclenche peu importe l\'aide (lanterne) déjà utilisée', () => {
      let state = useLantern(useLantern(createChallengeHelpState()))
      state = recordIncorrectAnswer(state)
      state = recordIncorrectAnswer(state)
      expect(shouldRevealAnswer(state)).toBe(true)
    })

    it('ne se redéclenche pas si d\'autres réponses incorrectes suivent la révélation initiale', () => {
      let state = createChallengeHelpState()
      state = recordIncorrectAnswer(state)
      state = recordIncorrectAnswer(state)
      state = revealAnswer(state, ['ch', 'a', 't']).state
      expect(state.revealed).toBe(true)

      // Une 3e réponse incorrecte (sur le défi reproposé) ne doit pas re-signaler
      // qu'il faut révéler puisque c'est déjà fait pour ce défi.
      state = recordIncorrectAnswer(state)
      expect(shouldRevealAnswer(state)).toBe(false)
    })
  })

  describe('va chercher un grand', () => {
    it('n\'émet rien après 1 défi échoué', () => {
      const state = createQuestHelpState()
      const result = recordChallengeOutcome(state, {
        challengeId: 'c1',
        failedDespiteHelp: true,
        timestamp: '2026-08-31T10:00:00.000Z',
      })
      expect(result.vaChercherUnGrand).toBe(false)
      expect(result.state.consecutiveFailedChallenges).toBe(1)
      expect(result.state.vaChercherUnGrandEvents).toEqual([])
    })

    it('n\'émet rien après 2 défis échoués consécutifs', () => {
      let state = createQuestHelpState()
      let result = recordChallengeOutcome(state, { challengeId: 'c1', failedDespiteHelp: true, timestamp: 't1' })
      state = result.state
      result = recordChallengeOutcome(state, { challengeId: 'c2', failedDespiteHelp: true, timestamp: 't2' })
      expect(result.vaChercherUnGrand).toBe(false)
      expect(result.state.consecutiveFailedChallenges).toBe(2)
    })

    it('émet vaChercherUnGrand: true après exactement 3 défis CONSÉCUTIFS échoués malgré les indices, et le journalise', () => {
      let state = createQuestHelpState()
      let result = recordChallengeOutcome(state, { challengeId: 'c1', failedDespiteHelp: true, timestamp: 't1' })
      state = result.state
      result = recordChallengeOutcome(state, { challengeId: 'c2', failedDespiteHelp: true, timestamp: 't2' })
      state = result.state
      result = recordChallengeOutcome(state, { challengeId: 'c3', failedDespiteHelp: true, timestamp: 't3' })

      expect(result.vaChercherUnGrand).toBe(true)
      expect(result.state.vaChercherUnGrandEvents).toEqual([{ challengeId: 'c3', timestamp: 't3' }])
      // Le compteur repart à zéro : ce n'est jamais bloquant, l'enchaînement
      // peut reprendre (et se redéclencher plus tard si de nouveaux échecs surviennent).
      expect(result.state.consecutiveFailedChallenges).toBe(0)
    })

    it('un défi réussi remet le compteur à zéro : pas de cumul entre des paquets d\'échecs séparés par une réussite', () => {
      let state = createQuestHelpState()
      let result = recordChallengeOutcome(state, { challengeId: 'c1', failedDespiteHelp: true, timestamp: 't1' })
      state = result.state
      result = recordChallengeOutcome(state, { challengeId: 'c2', failedDespiteHelp: true, timestamp: 't2' })
      state = result.state
      // Réussite entre les deux : le compteur retombe à 0.
      result = recordChallengeOutcome(state, { challengeId: 'c3', failedDespiteHelp: false, timestamp: 't3' })
      state = result.state
      expect(state.consecutiveFailedChallenges).toBe(0)

      result = recordChallengeOutcome(state, { challengeId: 'c4', failedDespiteHelp: true, timestamp: 't4' })
      state = result.state
      result = recordChallengeOutcome(state, { challengeId: 'c5', failedDespiteHelp: true, timestamp: 't5' })
      expect(result.vaChercherUnGrand).toBe(false)
      expect(result.state.consecutiveFailedChallenges).toBe(2)
    })

    it('n\'est jamais bloquant : l\'événement peut se redéclencher après 3 nouveaux échecs consécutifs, et chaque occurrence est journalisée séparément', () => {
      let state = createQuestHelpState()
      const outcomes = [
        { challengeId: 'c1', failedDespiteHelp: true, timestamp: 't1' },
        { challengeId: 'c2', failedDespiteHelp: true, timestamp: 't2' },
        { challengeId: 'c3', failedDespiteHelp: true, timestamp: 't3' }, // 1er déclenchement
        { challengeId: 'c4', failedDespiteHelp: true, timestamp: 't4' },
        { challengeId: 'c5', failedDespiteHelp: true, timestamp: 't5' },
        { challengeId: 'c6', failedDespiteHelp: true, timestamp: 't6' }, // 2e déclenchement
      ]
      const triggered: boolean[] = []
      for (const outcome of outcomes) {
        const result = recordChallengeOutcome(state, outcome)
        state = result.state
        triggered.push(result.vaChercherUnGrand)
      }
      expect(triggered).toEqual([false, false, true, false, false, true])
      expect(state.vaChercherUnGrandEvents).toEqual([
        { challengeId: 'c3', timestamp: 't3' },
        { challengeId: 'c6', timestamp: 't6' },
      ])
      // "Jamais bloquant" : la fonction ne retourne rien qui empêcherait de
      // continuer à jouer, il n'y a pas de mode "verrouillé" dans le state.
      expect(state).not.toHaveProperty('blocked')
      expect(state).not.toHaveProperty('locked')
    })

    it('didChallengeFailDespiteHelp reflète exactement l\'état de révélation du défi', () => {
      let helpState = createChallengeHelpState()
      expect(didChallengeFailDespiteHelp(helpState)).toBe(false)
      helpState = recordIncorrectAnswer(recordIncorrectAnswer(helpState))
      expect(didChallengeFailDespiteHelp(helpState)).toBe(false)
      helpState = revealAnswer(helpState, ['ch', 'a', 't']).state
      expect(didChallengeFailDespiteHelp(helpState)).toBe(true)
    })
  })

  describe('avatar et récompenses', () => {
    it('aucune fonction du module aide graduée ne lit ni ne modifie AvatarState : un avatar gelé traverse toute une séquence complète d\'aide sans être touché', () => {
      const avatar: AvatarState = Object.freeze({
        avatarId: 'avatar-1',
        companionId: 'compagnon-1',
        cosmetics: Object.freeze(['chapeau-1']) as string[],
        xp: 42,
        coins: 7,
      })
      const avatarSnapshot = JSON.parse(JSON.stringify(avatar))

      const challenge = makeChallenge()

      // Séquence complète : lanterne aux 3 paliers, oreille, 2 échecs +
      // révélation, puis 3 défis consécutifs échoués déclenchant
      // "va chercher un grand". Aucune de ces opérations ne reçoit `avatar`
      // en paramètre (impossible par construction), et `avatar` n'est donc
      // jamais lu ni muté par cette séquence.
      let challengeHelp = createChallengeHelpState()
      challengeHelp = useLantern(challengeHelp)
      lanternHintForLevel(challengeHelp, challenge, ['ch', 'a', 't'])
      challengeHelp = useLantern(challengeHelp)
      lanternHintForLevel(challengeHelp, challenge, ['ch', 'a', 't'])
      challengeHelp = useLantern(challengeHelp)
      lanternHintForLevel(challengeHelp, challenge, ['ch', 'a', 't'])
      listenAgain(challengeHelp)
      challengeHelp = recordIncorrectAnswer(challengeHelp)
      challengeHelp = recordIncorrectAnswer(challengeHelp)
      revealAnswer(challengeHelp, ['ch', 'a', 't'])

      let questHelp = createQuestHelpState()
      for (const id of ['c1', 'c2', 'c3']) {
        const result = recordChallengeOutcome(questHelp, {
          challengeId: id,
          failedDespiteHelp: true,
          timestamp: '2026-08-31T10:00:00.000Z',
        })
        questHelp = result.state
      }

      expect(avatar).toEqual(avatarSnapshot)
      expect(Object.isFrozen(avatar)).toBe(true)
      expect(avatar.xp).toBe(42)
      expect(avatar.coins).toBe(7)
      expect(avatar.cosmetics).toEqual(['chapeau-1'])
      // Le "va chercher un grand" a bien été journalisé, preuve que la
      // séquence a réellement exercé le module — sans jamais toucher l'avatar.
      expect(questHelp.vaChercherUnGrandEvents.length).toBe(1)
    })
  })
})
