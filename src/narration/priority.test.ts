// G-A4 / G3 : une narration de priorité supérieure interrompt une narration
// interruptible en cours, sans jamais interrompre une narration non
// interruptible.

import { describe, it, expect } from 'vitest'
import type { NarrationRequest } from '../types'
import { priorityRank, isHigherPriority } from './priority'
import { createNarrationOrchestrator } from './orchestrator'
import { createControllableMockDriver } from './mockDriver'

function req(
  id: string,
  priority: NarrationRequest['priority'],
  interruptible: boolean,
): NarrationRequest {
  return { id, text: `texte ${id}`, priority, interruptible }
}

// Laisse les microtâches (les .then() de l'orchestrateur) s'exécuter avant de
// faire les assertions suivantes.
async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('ordre de priorité (priority.ts)', () => {
  it('respecte l’ordre documenté : screen-intro < instruction < help < feedback', () => {
    expect(priorityRank('screen-intro')).toBeLessThan(priorityRank('instruction'))
    expect(priorityRank('instruction')).toBeLessThan(priorityRank('help'))
    expect(priorityRank('help')).toBeLessThan(priorityRank('feedback'))
  })

  it('isHigherPriority compare correctement deux priorités', () => {
    expect(isHigherPriority('feedback', 'screen-intro')).toBe(true)
    expect(isHigherPriority('screen-intro', 'feedback')).toBe(false)
    expect(isHigherPriority('help', 'help')).toBe(false) // égalité : pas "plus haute"
  })
})

describe('interruption par priorité (orchestrator.ts, G-A4 / G3)', () => {
  it('une priorité supérieure interrompt une narration interruptible en cours', async () => {
    const { driver, calls, state } = createControllableMockDriver()
    const orchestrator = createNarrationOrchestrator(driver)

    orchestrator.submit(req('intro', 'screen-intro', true))
    expect(calls.map((c) => c.id)).toEqual(['intro'])

    orchestrator.submit(req('fb', 'feedback', true))
    await flush()

    expect(state.cancelCallCount).toBe(1)
    expect(calls.map((c) => c.id)).toEqual(['intro', 'fb'])
    expect(orchestrator.getSnapshot().current?.id).toBe('fb')
  })

  it('une priorité égale ou inférieure ne coupe jamais la narration en cours', async () => {
    const { driver, calls, state } = createControllableMockDriver()
    const orchestrator = createNarrationOrchestrator(driver)

    orchestrator.submit(req('instr', 'instruction', true))
    orchestrator.submit(req('intro-tardif', 'screen-intro', true)) // priorité inférieure
    await flush()

    expect(state.cancelCallCount).toBe(0)
    expect(orchestrator.getSnapshot().current?.id).toBe('instr')
    // la demande de priorité inférieure attend son tour dans la file
    expect(orchestrator.getSnapshot().queue.map((r) => r.id)).toEqual(['intro-tardif'])
    expect(calls.map((c) => c.id)).toEqual(['instr'])
  })

  it('une narration marquée non interruptible n’est JAMAIS interrompue, même par feedback', async () => {
    const { driver, calls, state, resolveCurrent } = createControllableMockDriver()
    const orchestrator = createNarrationOrchestrator(driver)

    orchestrator.submit(req('critique', 'instruction', false))
    orchestrator.submit(req('fb-urgent', 'feedback', true))
    await flush()

    expect(state.cancelCallCount).toBe(0)
    expect(orchestrator.getSnapshot().current?.id).toBe('critique')
    expect(calls.map((c) => c.id)).toEqual(['critique'])

    // Une fois la narration non interruptible terminée naturellement, la
    // demande mise en attente joue à son tour.
    resolveCurrent()
    await flush()

    expect(orchestrator.getSnapshot().current?.id).toBe('fb-urgent')
    expect(calls.map((c) => c.id)).toEqual(['critique', 'fb-urgent'])
  })

  it('après la fin de la narration en cours, la file rejoue par ordre de priorité, pas par ordre d’arrivée', async () => {
    const { driver, calls, resolveCurrent } = createControllableMockDriver()
    const orchestrator = createNarrationOrchestrator(driver)

    orchestrator.submit(req('courant', 'instruction', false))
    // Arrivée dans cet ordre : help d'abord, feedback ensuite — mais feedback
    // est plus prioritaire et doit pourtant passer devant à la reprise.
    orchestrator.submit(req('aide', 'help', true))
    orchestrator.submit(req('retour', 'feedback', true))

    resolveCurrent() // "courant" se termine naturellement
    await flush()
    expect(orchestrator.getSnapshot().current?.id).toBe('retour')

    resolveCurrent()
    await flush()
    expect(orchestrator.getSnapshot().current?.id).toBe('aide')

    expect(calls.map((c) => c.id)).toEqual(['courant', 'retour', 'aide'])
  })

  it('deux demandes de même priorité respectent l’ordre d’arrivée (FIFO)', async () => {
    const { driver, resolveCurrent } = createControllableMockDriver()
    const orchestrator = createNarrationOrchestrator(driver)

    orchestrator.submit(req('courant', 'instruction', false))
    orchestrator.submit(req('premier', 'help', true))
    orchestrator.submit(req('second', 'help', true))

    resolveCurrent()
    await flush()
    expect(orchestrator.getSnapshot().current?.id).toBe('premier')

    resolveCurrent()
    await flush()
    expect(orchestrator.getSnapshot().current?.id).toBe('second')
  })

  it('resoumettre le même id pendant qu’il est déjà en cours ne le redémarre pas', () => {
    const { driver, calls } = createControllableMockDriver()
    const orchestrator = createNarrationOrchestrator(driver)

    orchestrator.submit(req('intro', 'screen-intro', true))
    orchestrator.submit(req('intro', 'screen-intro', true))

    expect(calls).toHaveLength(1)
  })

  it('resoumettre le même id pendant qu’il est en file d’attente le remplace au lieu de le dupliquer', async () => {
    const { driver } = createControllableMockDriver()
    const orchestrator = createNarrationOrchestrator(driver)

    orchestrator.submit(req('courant', 'instruction', false))
    orchestrator.submit(req('aide', 'help', true))
    orchestrator.submit(req('aide', 'help', true)) // ex. deux appuis rapides sur « oreille »

    expect(orchestrator.getSnapshot().queue).toHaveLength(1)
  })

  it('dismiss() retire une demande seulement en attente, sans toucher à la narration en cours', () => {
    const { driver, state } = createControllableMockDriver()
    const orchestrator = createNarrationOrchestrator(driver)

    orchestrator.submit(req('courant', 'instruction', false))
    orchestrator.submit(req('en-attente', 'help', true))

    orchestrator.dismiss('en-attente')

    expect(state.cancelCallCount).toBe(0)
    expect(orchestrator.getSnapshot().queue).toEqual([])
    expect(orchestrator.getSnapshot().current?.id).toBe('courant')
  })

  it('dismiss() de la narration en cours l’interrompt et enchaîne sur la suivante', async () => {
    const { driver, state } = createControllableMockDriver()
    const orchestrator = createNarrationOrchestrator(driver)

    orchestrator.submit(req('courant', 'screen-intro', true))
    orchestrator.submit(req('suivant', 'instruction', true))

    orchestrator.dismiss('courant')
    await flush()

    expect(state.cancelCallCount).toBe(1)
    expect(orchestrator.getSnapshot().current?.id).toBe('suivant')
  })

  it('dismiss() sans rien en cours ni en file ne fait rien (pas d’erreur)', () => {
    const { driver, state } = createControllableMockDriver()
    const orchestrator = createNarrationOrchestrator(driver)

    expect(() => orchestrator.dismiss('inconnu')).not.toThrow()
    expect(state.cancelCallCount).toBe(0)
  })

  it('la file se vide et current redevient null quand tout est terminé', async () => {
    const { driver, resolveCurrent } = createControllableMockDriver()
    const orchestrator = createNarrationOrchestrator(driver)

    orchestrator.submit(req('seul', 'instruction', true))
    resolveCurrent()
    await flush()

    expect(orchestrator.getSnapshot()).toEqual({ current: null, queue: [] })
  })
})
