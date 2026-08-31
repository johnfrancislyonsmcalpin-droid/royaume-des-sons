// État observable "voix muette" (SPEC §3 / gate A2:G2). Exposé pour que
// l'interface affiche une icône son coupé quand la synthèse vocale échoue deux
// fois de suite, sans jamais lever d'exception vers l'appelant de speak().

export type MuteListener = (muted: boolean) => void

export interface MuteStore {
  get: () => boolean
  set: (next: boolean) => void
  subscribe: (listener: MuteListener) => () => void
}

export function createMuteStore(): MuteStore {
  let muted = false
  const listeners = new Set<MuteListener>()

  return {
    get: () => muted,
    set(next: boolean) {
      if (muted === next) return
      muted = next
      for (const listener of listeners) listener(muted)
    },
    subscribe(listener: MuteListener) {
      listeners.add(listener)
      listener(muted)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
