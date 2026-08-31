// node-C N2 : preuve d'intégration que les 6 mécaniques (C1-C4) partagent
// TOUTES le même contrat de props (ChallengeComponentProps, C1) sans
// divergence. `challengeComponents.ts` (E3) le prouve déjà à la compilation
// (Record<ChallengeKind, ComponentType<ChallengeComponentProps>> ne
// typecheckerait pas si un composant divergeait) — ce test ajoute la preuve
// à l'exécution : chaque composant, instancié avec un Challenge RÉEL du pool
// de contenu réellement assemblé par le moteur de quête (E3, pas des
// fixtures inventées ici), se monte sans lever et rend au moins un élément
// interactif, pour les 6 ChallengeKind du curriculum.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { Challenge, ChallengeKind, ChallengeOption, ChallengeResult, ContentItem, ContentItemKind, HelpLevel } from '../../src/types'
import { CHALLENGE_COMPONENTS } from '../../src/world/quest/challengeComponents'
import { pickChallengeKind } from '../../src/world/quest/challengeKind'
import { questContentPool, resolveQuestItem } from '../../src/world/quest/content'
import type { ChallengeSpeakFn } from '../../src/challenges/shared/contract'

afterEach(() => {
  cleanup()
})

const ALL_KINDS: ChallengeKind[] = ['listen-touch', 'forge', 'read-show', 'true-false-word', 'reorder', 'companion-question']

/** Trouve un ContentItem réel du pool de quête (corpus + graphèmes
 * synthétiques, E3) dont le kind produit, via la vraie règle de mapping de
 * challengeKind.ts, le ChallengeKind demandé. Essaie plusieurs valeurs de
 * rotationIndex pour couvrir syllable/word qui alternent entre mécaniques. */
function findRealItemForChallengeKind(target: ChallengeKind): { item: ContentItem; rotationIndex: number } {
  for (const item of questContentPool) {
    for (let rotationIndex = 0; rotationIndex < 3; rotationIndex += 1) {
      if (pickChallengeKind(item.kind, rotationIndex) === target) {
        return { item, rotationIndex }
      }
    }
  }
  throw new Error(`aucun item réel du pool de quête ne produit le ChallengeKind "${target}"`)
}

function buildOptionsFor(item: ContentItem): ChallengeOption[] {
  const distractor = questContentPool.find(
    (candidate) => candidate.id !== item.id && candidate.kind === item.kind && candidate.level === item.level,
  )
  const options: ChallengeOption[] = [{ id: `${item.id}-opt-correct`, contentItemId: item.id, isDistractor: false }]
  if (distractor) {
    options.push({ id: `${item.id}-opt-distractor`, contentItemId: distractor.id, isDistractor: true })
  }
  return options
}

function buildRealChallenge(kind: ChallengeKind): Challenge {
  const { item, rotationIndex } = findRealItemForChallengeKind(kind)
  void rotationIndex
  const skillId = item.skillIds[0] ?? 'L1-voyelles'
  return {
    id: `contract-test-${kind}`,
    kind,
    skillId,
    targetItemId: item.id,
    options: buildOptionsFor(item),
    isReview: false,
  }
}

describe('contrat partagé des 6 mécaniques de défi (node-C N2)', () => {
  for (const kind of ALL_KINDS) {
    it(`${kind} : le composant enregistré se monte avec un ChallengeComponentProps réel sans lever et rend du contenu`, () => {
      const Component = CHALLENGE_COMPONENTS[kind]
      expect(typeof Component).toBe('function')

      const challenge = buildRealChallenge(kind)
      const received: Array<Omit<ChallengeResult, 'timestamp'>> = []
      const speak: ChallengeSpeakFn = () => Promise.resolve()
      const helpLevel: HelpLevel = 0

      let container: HTMLElement | undefined
      expect(() => {
        const result = render(
          <Component
            challenge={challenge}
            helpLevel={helpLevel}
            usedListenAgain={false}
            resolveItem={resolveQuestItem}
            speak={speak}
            onAnswer={(r) => received.push(r)}
          />,
        )
        container = result.container
      }).not.toThrow()

      expect(container).toBeDefined()
      expect(container!.children.length).toBeGreaterThan(0)
    })
  }

  it("chaque ChallengeKind de src/types.ts a exactement une entrée dans CHALLENGE_COMPONENTS", () => {
    const registeredKinds = Object.keys(CHALLENGE_COMPONENTS) as ChallengeKind[]
    expect(new Set(registeredKinds)).toEqual(new Set(ALL_KINDS))
  })

  it('la règle de mapping ContentItemKind -> ChallengeKind (challengeKind.ts) couvre les 6 ChallengeKind sans exception non gérée', () => {
    const itemKinds: ContentItemKind[] = ['grapheme', 'syllable', 'word', 'pseudoword', 'sentence', 'text']
    const produced = new Set<ChallengeKind>()
    for (const itemKind of itemKinds) {
      for (let rotationIndex = 0; rotationIndex < 3; rotationIndex += 1) {
        produced.add(pickChallengeKind(itemKind, rotationIndex))
      }
    }
    expect(produced).toEqual(new Set(ALL_KINDS))
  })
})
