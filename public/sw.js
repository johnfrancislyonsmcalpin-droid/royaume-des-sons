// Service worker de cache simple (SPEC §3 « PWA / service worker »,
// gate leaf-F2:G1). Script "classic" volontairement (pas de `export`, pas de
// `{ type: 'module' }` à l'enregistrement, voir src/app/serviceWorker.ts) :
// c'est la forme la plus largement supportée et la plus simple à raisonner
// pour un service worker qui n'a besoin d'aucun import.
//
// Nom de cache versionné : toute nouvelle version (CACHE_VERSION incrémenté à
// la main lors d'une livraison) invalide l'ancien cache à l'activation au
// lieu de l'accumuler indéfiniment (voir le gestionnaire 'activate'
// ci-dessous). src/app/serviceWorker.test.ts vérifie ce numéro de version en
// important ce fichier tel quel (`?raw`) plutôt que d'en deviner la valeur.
//
// Stratégie : cache-first pour les requêtes GET même origine. Aucune liste de
// précache figée : les noms de fichiers du build Vite sont hachés et inconnus
// à l'écriture de ce fichier statique (servi tel quel depuis public/, jamais
// transformé par le build) ; la mise en cache au premier accès (runtime
// caching, dans le gestionnaire 'fetch') couvre ce cas sans liste à
// maintenir à la main.
const CACHE_VERSION = 'v1'
const CACHE_NAME = `royaume-des-sons-${CACHE_VERSION}`

self.addEventListener('install', () => {
  // Passe immédiatement en 'activated' au prochain rechargement plutôt que
  // d'attendre la fermeture de tous les onglets existants : sur une tablette
  // où l'app tourne seule en plein écran / standalone, il n'y a jamais
  // plusieurs onglets à coordonner.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Invalidation, pas accumulation : tout cache dont le nom ne
      // correspond pas à la version courante est supprimé.
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Seules les requêtes GET même origine sont interceptées et mises en
  // cache : jamais de cache-poisoning depuis une origine tierce, et jamais
  // d'interférence avec d'éventuelles requêtes non idempotentes.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      const cached = await cache.match(request)
      if (cached) return cached

      const response = await fetch(request)
      if (response && response.ok) {
        // .clone() : une réponse ne peut être lue qu'une fois : celle mise en
        // cache doit être une copie distincte de celle renvoyée à la page.
        cache.put(request, response.clone())
      }
      return response
    })(),
  )
})
