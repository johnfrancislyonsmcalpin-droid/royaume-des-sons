// Gates leaf-F2:G1/G4 : le nom de cache du service worker inclut un numéro de
// version et une nouvelle version invalide l'ancien cache plutôt que de
// l'accumuler ; registerServiceWorker()/clearCacheAndReload() dégradent
// proprement (jamais d'exception, jamais de blocage) quand l'API Cache/
// ServiceWorker est absente ou échoue.
//
// public/sw.js est un script "classic" (pas de `export`, voir son en-tête)
// qui utilise les globales propres à un ServiceWorkerGlobalScope (`self`,
// `caches`, `clients`). Sous jsdom, `self` existe déjà (alias de `window`),
// ce qui permet d'exécuter le vrai fichier livré tel quel (aucune réécriture
// pour les tests, importé via `?raw` — même technique que
// src/app/fullscreen.test.tsx pour public/manifest.webmanifest) et de simuler
// son cycle de vie en distribuant de faux événements install/activate/fetch
// avec les méthodes waitUntil()/respondWith() que le vrai navigateur
// fournirait, plutôt que de deviner le comportement en relisant le code
// source. `new Function` exécute ce texte dans la portée globale de test (pas
// une fermeture locale) : les identifiants libres (`self`, `caches`, `fetch`)
// s'y résolvent contre le contexte jsdom réel, exactement comme le ferait un
// vrai navigateur qui charge ce fichier comme service worker.
import { afterEach, describe, expect, it, vi } from 'vitest'
import swSource from '../../public/sw.js?raw'
import { clearCacheAndReload, registerServiceWorker } from './serviceWorker'

// N'enregistre les gestionnaires d'événements qu'une seule fois (comme un
// vrai navigateur ne charge le script du service worker qu'une fois).
new Function(swSource)()

// CACHE_NAME/CACHE_VERSION sont des `const` locales au script, non exposées
// globalement (volontairement : ce n'est pas un module, voir son en-tête) ;
// on lit leur valeur réelle directement dans le texte source plutôt que de
// la deviner, cohérent avec la vérification structurelle déjà utilisée par
// src/app/navigator.test.tsx pour d'autres fichiers de src/app.
const CACHE_VERSION = swSource.match(/CACHE_VERSION\s*=\s*'([^']+)'/)?.[1] ?? ''
const CACHE_NAME = `royaume-des-sons-${CACHE_VERSION}`

// --- Fausse Cache Storage --------------------------------------------------

function requestKey(request: { url: string } | string): string {
  return typeof request === 'string' ? request : request.url
}

function createFakeCaches() {
  const store = new Map<string, Map<string, unknown>>()

  const openCache = (name: string) => {
    if (!store.has(name)) store.set(name, new Map())
    const bucket = store.get(name) as Map<string, unknown>
    return {
      match: vi.fn(async (request: { url: string } | string) => bucket.get(requestKey(request))),
      put: vi.fn(async (request: { url: string } | string, response: unknown) => {
        bucket.set(requestKey(request), response)
      }),
    }
  }

  const fakeCaches = {
    open: vi.fn(async (name: string) => openCache(name)),
    keys: vi.fn(async () => Array.from(store.keys())),
    delete: vi.fn(async (name: string) => store.delete(name)),
  }

  return { fakeCaches, store }
}

describe('public/sw.js — service worker de cache', () => {
  let restoreCaches: (() => void) | undefined
  let restoreFetch: (() => void) | undefined

  afterEach(() => {
    restoreCaches?.()
    restoreCaches = undefined
    restoreFetch?.()
    restoreFetch = undefined
    vi.restoreAllMocks()
  })

  it('CACHE_NAME inclut un numéro de version (gate G1)', () => {
    expect(CACHE_VERSION).toMatch(/^v\d+$/)
    expect(swSource).toMatch(/CACHE_NAME\s*=\s*`royaume-des-sons-\$\{CACHE_VERSION\}`/)
  })

  it("install : passe immédiatement en 'activated' via skipWaiting()", () => {
    const skipWaiting = vi.fn()
    // @ts-expect-error stub ServiceWorkerGlobalScope pour ce test
    self.skipWaiting = skipWaiting

    self.dispatchEvent(new Event('install'))

    expect(skipWaiting).toHaveBeenCalledTimes(1)
  })

  it('activate : supprime tout cache dont le nom ne correspond pas à la version courante (invalidation, pas accumulation)', async () => {
    const { fakeCaches, store } = createFakeCaches()
    store.set('royaume-des-sons-v0', new Map())
    store.set('un-cache-etranger', new Map())
    store.set(CACHE_NAME, new Map([['/deja-la', 'reponse']]))
    // @ts-expect-error stub CacheStorage globale pour ce test
    globalThis.caches = fakeCaches
    restoreCaches = () => {
      // @ts-expect-error nettoyage
      delete globalThis.caches
    }

    const claim = vi.fn().mockResolvedValue(undefined)
    // @ts-expect-error stub ServiceWorkerGlobalScope pour ce test
    self.clients = { claim }

    let waitUntilPromise: Promise<unknown> | undefined
    const activateEvent = new Event('activate') as Event & { waitUntil: (p: Promise<unknown>) => void }
    activateEvent.waitUntil = (p) => {
      waitUntilPromise = p
    }
    self.dispatchEvent(activateEvent)
    await waitUntilPromise

    expect(store.has('royaume-des-sons-v0')).toBe(false)
    expect(store.has('un-cache-etranger')).toBe(false)
    expect(store.has(CACHE_NAME)).toBe(true)
    expect(claim).toHaveBeenCalledTimes(1)
  })

  it('fetch : sert depuis le cache si présent (cache-first), sans appeler le réseau', async () => {
    const { fakeCaches, store } = createFakeCaches()
    const origin = self.location.origin
    const url = `${origin}/assets/deja-en-cache.js`
    store.set(CACHE_NAME, new Map([[url, { ok: true, cached: true }]]))
    // @ts-expect-error stub CacheStorage globale pour ce test
    globalThis.caches = fakeCaches
    restoreCaches = () => {
      // @ts-expect-error nettoyage
      delete globalThis.caches
    }

    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy
    restoreFetch = () => {
      // @ts-expect-error nettoyage
      delete globalThis.fetch
    }

    let respondWithPromise: Promise<unknown> | undefined
    const fetchEvent = new Event('fetch') as Event & {
      request: { method: string; url: string }
      respondWith: (p: Promise<unknown>) => void
    }
    fetchEvent.request = { method: 'GET', url }
    fetchEvent.respondWith = (p) => {
      respondWithPromise = p
    }
    self.dispatchEvent(fetchEvent)
    const result = await respondWithPromise

    expect(result).toEqual({ ok: true, cached: true })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("fetch : va au réseau puis met en cache la réponse quand rien n'est en cache", async () => {
    const { fakeCaches, store } = createFakeCaches()
    const origin = self.location.origin
    const url = `${origin}/assets/nouveau.js`
    // @ts-expect-error stub CacheStorage globale pour ce test
    globalThis.caches = fakeCaches
    restoreCaches = () => {
      // @ts-expect-error nettoyage
      delete globalThis.caches
    }

    const cloned = { ok: true, clone: () => 'copie' }
    const networkResponse = { ok: true, clone: vi.fn(() => cloned) }
    const fetchSpy = vi.fn().mockResolvedValue(networkResponse)
    globalThis.fetch = fetchSpy
    restoreFetch = () => {
      // @ts-expect-error nettoyage
      delete globalThis.fetch
    }

    let respondWithPromise: Promise<unknown> | undefined
    const fetchEvent = new Event('fetch') as Event & {
      request: { method: string; url: string }
      respondWith: (p: Promise<unknown>) => void
    }
    fetchEvent.request = { method: 'GET', url }
    fetchEvent.respondWith = (p) => {
      respondWithPromise = p
    }
    self.dispatchEvent(fetchEvent)
    const result = await respondWithPromise

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(result).toBe(networkResponse)
    expect(store.get(CACHE_NAME)?.get(url)).toBe(cloned)
  })

  it('fetch : ignore les requêtes non-GET (ne les met jamais en cache)', () => {
    const { fakeCaches } = createFakeCaches()
    // @ts-expect-error stub CacheStorage globale pour ce test
    globalThis.caches = fakeCaches
    restoreCaches = () => {
      // @ts-expect-error nettoyage
      delete globalThis.caches
    }

    const respondWith = vi.fn()
    const fetchEvent = new Event('fetch') as Event & {
      request: { method: string; url: string }
      respondWith: (p: Promise<unknown>) => void
    }
    fetchEvent.request = { method: 'POST', url: `${self.location.origin}/api` }
    fetchEvent.respondWith = respondWith
    self.dispatchEvent(fetchEvent)

    expect(respondWith).not.toHaveBeenCalled()
  })

  it('fetch : ignore les requêtes vers une autre origine (jamais de cache-poisoning tiers)', () => {
    const { fakeCaches } = createFakeCaches()
    // @ts-expect-error stub CacheStorage globale pour ce test
    globalThis.caches = fakeCaches
    restoreCaches = () => {
      // @ts-expect-error nettoyage
      delete globalThis.caches
    }

    const respondWith = vi.fn()
    const fetchEvent = new Event('fetch') as Event & {
      request: { method: string; url: string }
      respondWith: (p: Promise<unknown>) => void
    }
    fetchEvent.request = { method: 'GET', url: 'https://un-autre-domaine.example/x.js' }
    fetchEvent.respondWith = respondWith
    self.dispatchEvent(fetchEvent)

    expect(respondWith).not.toHaveBeenCalled()
  })
})

// --- src/app/serviceWorker.ts ----------------------------------------------

describe('registerServiceWorker', () => {
  const originalServiceWorker = navigator.serviceWorker
  const originalReadyState = Object.getOwnPropertyDescriptor(Document.prototype, 'readyState')

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      configurable: true,
    })
    if (originalReadyState) {
      Object.defineProperty(document, 'readyState', originalReadyState)
    }
    vi.restoreAllMocks()
  })

  function mockReadyState(value: DocumentReadyState) {
    Object.defineProperty(document, 'readyState', { value, configurable: true })
  }

  it("ne fait rien et ne lève pas si l'API serviceWorker est absente", () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true })
    expect(() => registerServiceWorker()).not.toThrow()
  })

  it('enregistre public/sw.js, immédiatement si la page est déjà chargée', () => {
    mockReadyState('complete')
    const register = vi.fn().mockResolvedValue({})
    Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true })

    registerServiceWorker()

    expect(register).toHaveBeenCalledTimes(1)
    const [url] = register.mock.calls[0]
    expect(String(url)).toMatch(/sw\.js$/)
  })

  it("attend l'événement 'load' si la page n'est pas encore chargée", () => {
    mockReadyState('loading')
    const register = vi.fn().mockResolvedValue({})
    Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true })

    registerServiceWorker()
    expect(register).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('load'))
    expect(register).toHaveBeenCalledTimes(1)
  })

  it("un échec d'enregistrement ne lève jamais (dégradation silencieuse)", async () => {
    mockReadyState('complete')
    const register = vi.fn().mockRejectedValue(new Error('échec réseau'))
    Object.defineProperty(navigator, 'serviceWorker', { value: { register }, configurable: true })

    expect(() => registerServiceWorker()).not.toThrow()
    // Laisse la microtâche du .catch() interne se résoudre sans qu'aucun
    // rejet non géré ne remonte.
    await Promise.resolve()
    await Promise.resolve()
  })
})

describe('clearCacheAndReload', () => {
  const originalServiceWorker = navigator.serviceWorker
  const originalLocation = window.location

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      configurable: true,
    })
    Object.defineProperty(window, 'location', { value: originalLocation, configurable: true })
    // @ts-expect-error nettoyage du stub CacheStorage global
    delete globalThis.caches
    vi.restoreAllMocks()
  })

  function mockLocationReload() {
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, reload },
      configurable: true,
    })
    return reload
  }

  it('supprime tous les caches, désenregistre le service worker, puis recharge', async () => {
    const reload = mockLocationReload()
    const deleteCache = vi.fn().mockResolvedValue(true)
    // @ts-expect-error stub CacheStorage globale pour ce test
    globalThis.caches = { keys: vi.fn().mockResolvedValue(['a', 'b']), delete: deleteCache }

    const unregister1 = vi.fn().mockResolvedValue(true)
    const unregister2 = vi.fn().mockResolvedValue(true)
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistrations: vi.fn().mockResolvedValue([{ unregister: unregister1 }, { unregister: unregister2 }]),
      },
      configurable: true,
    })

    await clearCacheAndReload()

    expect(deleteCache).toHaveBeenCalledWith('a')
    expect(deleteCache).toHaveBeenCalledWith('b')
    expect(unregister1).toHaveBeenCalledTimes(1)
    expect(unregister2).toHaveBeenCalledTimes(1)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('recharge quand même si la purge du cache échoue (jamais un bouton qui ne fait rien)', async () => {
    const reload = mockLocationReload()
    // @ts-expect-error stub CacheStorage globale pour ce test
    globalThis.caches = { keys: vi.fn().mockRejectedValue(new Error('indisponible')), delete: vi.fn() }
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: vi.fn().mockResolvedValue([]) },
      configurable: true,
    })

    await expect(clearCacheAndReload()).resolves.toBeUndefined()
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('recharge quand même si le désenregistrement du service worker échoue', async () => {
    const reload = mockLocationReload()
    // @ts-expect-error stub CacheStorage globale pour ce test
    globalThis.caches = { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() }
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { getRegistrations: vi.fn().mockRejectedValue(new Error('indisponible')) },
      configurable: true,
    })

    await expect(clearCacheAndReload()).resolves.toBeUndefined()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
