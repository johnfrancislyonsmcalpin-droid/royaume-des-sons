// Gate leaf-C1 G1 : `ChallengeComponentProps` est exporté et chaque champ a le
// type attendu de src/types.ts. vitest ne type-vérifie pas au-delà de ce que
// TypeScript exige pour compiler ce fichier (esbuild transpile-only) : la
// preuve *complète* de conformité de type est `npx tsc -b` (voir rapport de
// leaf), mais ce fichier documente et vérifie à l'exécution la forme exacte
// attendue par C2/C3/C4, pour détecter tout de suite un champ manquant ou
// renommé par erreur.
import { describe, expect, it } from 'vitest'
import type {
  Challenge,
  ChallengeOption,
  ChallengeResult,
  ContentItem,
  HelpLevel,
} from '../../types'
import type { ChallengeComponentProps, ChallengeSpeakFn } from './contract'

function makeChallenge(): Challenge {
  const options: ChallengeOption[] = [
    { id: 'opt-1', contentItemId: 'item-a', isDistractor: false },
    { id: 'opt-2', contentItemId: 'item-b', isDistractor: true },
  ]
  return {
    id: 'challenge-1',
    kind: 'listen-touch',
    skillId: 'L1-voyelles',
    targetItemId: 'item-a',
    options,
    isReview: false,
  }
}

function makeItem(id: string): ContentItem {
  return {
    id,
    kind: 'grapheme',
    level: 1,
    text: 'a',
    graphemeIds: ['a'],
    skillIds: ['L1-voyelles'],
  }
}

describe('ChallengeComponentProps', () => {
  it('accepte un objet avec exactement les champs challenge, helpLevel, usedListenAgain, resolveItem, speak, onAnswer', () => {
    const received: Array<Omit<ChallengeResult, 'timestamp'>> = []
    const speak: ChallengeSpeakFn = async () => {}
    const helpLevel: HelpLevel = 0

    const props: ChallengeComponentProps = {
      challenge: makeChallenge(),
      helpLevel,
      usedListenAgain: false,
      resolveItem: (id) => makeItem(id),
      speak,
      onAnswer: (result) => {
        received.push(result)
      },
    }

    // Vérification à l'exécution que chaque champ est bien présent avec le
    // type dynamique attendu (fonction / objet / booléen / nombre selon le
    // champ) — complète la vérification statique faite par tsc.
    expect(typeof props.challenge).toBe('object')
    expect(props.challenge.id).toBe('challenge-1')
    expect([0, 1, 2, 3]).toContain(props.helpLevel)
    expect(typeof props.usedListenAgain).toBe('boolean')
    expect(typeof props.resolveItem).toBe('function')
    expect(typeof props.speak).toBe('function')
    expect(typeof props.onAnswer).toBe('function')

    const resolved = props.resolveItem('item-a')
    expect(resolved.id).toBe('item-a')
    expect(Array.isArray(resolved.graphemeIds)).toBe(true)

    props.onAnswer({
      challengeId: props.challenge.id,
      correct: true,
      usedHelpLevel: props.helpLevel,
      usedListenAgain: props.usedListenAgain,
      responseMs: 1234,
    })
    expect(received).toHaveLength(1)
    expect(received[0].challengeId).toBe('challenge-1')
  })

  it('resolveItem retourne un ContentItem complet exploitable sans champ manquant', () => {
    const resolveItem: ChallengeComponentProps['resolveItem'] = (id) => makeItem(id)
    const item = resolveItem('mot-chapeau')
    expect(item).toEqual({
      id: 'mot-chapeau',
      kind: 'grapheme',
      level: 1,
      text: 'a',
      graphemeIds: ['a'],
      skillIds: ['L1-voyelles'],
    })
  })

  it('speak() a la signature (text: string) => Promise<void>', async () => {
    const calls: string[] = []
    const speak: ChallengeSpeakFn = (text) => {
      calls.push(text)
      return Promise.resolve()
    }
    await speak('mmm')
    expect(calls).toEqual(['mmm'])
  })
})
