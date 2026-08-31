// Enregistrement du service worker (public/sw.js) et purge de cache
// (SPEC §3 « PWA / service worker », gates leaf-F2:G1/G4). Le chemin de
// sw.js dérive de `import.meta.env.BASE_URL` plutôt que d'être codé en dur à
// la racine : CLAUDE.md impose que `base` de Vite soit calé sur le nom du
// dépôt (GitHub Pages), donc l'app n'est pas servie à la racine du domaine.

function devWarn(...args: unknown[]): void {
  // import.meta.env.DEV est fourni par Vite ; en environnement de test
  // (jsdom, pas de bundling Vite complet) le champ peut être absent, d'où la
  // garde (même convention que src/save/storage.ts, leaf A3).
  const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV
  if (isDev) {
    console.warn('[service-worker]', ...args)
  }
}

function swUrl(): string {
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
  return `${base}sw.js`
}

/**
 * Enregistre le service worker de cache. Ne fait rien si l'API est absente
 * (dégradation silencieuse, jamais de blocage du jeu) ni hors d'un contexte
 * navigateur. N'enregistre qu'une fois le chargement de la page terminé
 * (évite de faire concurrence au chargement des premières ressources), sauf
 * si la page est déjà chargée au moment de l'appel. public/sw.js est un
 * script "classic" (pas d'instruction `export`), donc aucune option
 * `{ type: 'module' }` n'est nécessaire ici. Ne lève jamais.
 */
export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const register = () => {
    navigator.serviceWorker.register(swUrl()).catch((err: unknown) => {
      // Un échec d'enregistrement isolé ne doit jamais bloquer le jeu : on
      // log et on continue sans mise en cache hors-ligne. Si le service
      // worker s'avérait instable de façon répétée en usage réel plutôt
      // qu'un simple échec d'enregistrement isolé, la décision à prendre est
      // de le désactiver entièrement (voir ASSUMPTIONS.md) plutôt que de
      // livrer un cache empoisonné (SPEC §3, gate G4) — pas de le masquer
      // silencieusement ici.
      devWarn("échec d'enregistrement", err)
    })
  }

  if (document.readyState === 'complete') {
    register()
  } else {
    window.addEventListener('load', register, { once: true })
  }
}

/**
 * Vide tous les caches de l'app et désenregistre le(s) service worker(s)
 * avant de recharger la page. Utilisé par le bouton « vider le cache et
 * recharger » de l'écran parent (SPEC §9, leaf F1 à venir — cette fonction
 * est le point d'intégration prévu pour ce bouton).
 *
 * Choix de conception : purge directe de Cache Storage + désenregistrement,
 * plutôt qu'un protocole de message vers le service worker actif. Plus
 * simple, fonctionne même si aucun service worker n'est actuellement
 * contrôlant la page, et le prochain `registerServiceWorker()` (au
 * rechargement qui suit) reconstruit un cache neuf de toute façon.
 *
 * Recharge toujours la page à la fin, même si la purge échoue partiellement
 * (stockage indisponible, API absente) : jamais un bouton qui ne fait rien
 * visible pour l'adulte qui l'a pressé.
 */
export async function clearCacheAndReload(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch (err) {
    devWarn('purge du cache incomplète', err)
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  } catch (err) {
    devWarn('désenregistrement du service worker incomplet', err)
  }

  window.location.reload()
}
