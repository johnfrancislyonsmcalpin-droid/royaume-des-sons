// Utilitaires partagés par la suite e2e (leaf F4, OWNS: e2e/**).
//
// Contrainte méthodologique du ledger (leaf-F4.md, GF1) : piloter le jeu
// UNIQUEMENT via data-testid / rôles+noms accessibles ARIA, jamais en lisant
// du texte affiché à l'écran — exactement comme l'enfant qui ne sait pas
// lire. Le point délicat est la mécanique "Écoute et touche" (ListenTouch,
// niveau 1 : seule mécanique jouable sur un graphème isolé, voir
// challengeKind.ts) : la bonne carte ne se distingue des distracteurs que par
// le SON que le compagnon énonce (`speak(targetItem.text)` au montage du
// défi), jamais par un signal visuel disponible sans indice. Un enfant qui
// entend distingue la bonne carte par le son ; ce test "entend" de la même
// façon en interceptant l'appel réel à `window.speechSynthesis.speak()`
// (jamais en lisant le texte rendu à l'écran) puis clique la carte dont le
// NOM ACCESSIBLE (aria-label, posé par TapTarget/ListenTouch sur
// `item.text`) correspond au texte intercepté — c'est le pont ARIA que
// l'instruction du ledger autorise explicitement ("data-testid/rôles ARIA").
//
// Décision délibérée (documentée pour ASSUMPTIONS.md par le driver) : ce
// test n'utilise JAMAIS la lanterne (aide graduée, SPEC §8) pour identifier
// la bonne carte, même si le palier 3 rend la carte cible visuellement
// distincte (aria-pressed) — parce que `usedHelpLevel !== 0` disqualifie
// explicitement la réponse du calcul de maîtrise (src/engine/mastery.ts,
// countsAsCorrectWithoutHelp) et qu'une compétence non maîtrisée bloquerait
// indéfiniment le boss (bossGate.ts). Répondre "sans indice" via le son
// intercepté est donc la SEULE stratégie qui à la fois évite la lecture de
// texte ET permet réellement d'atteindre le boss.
import { type Page, expect } from '@playwright/test'

/**
 * Doit être appelé AVANT toute navigation (page.goto), pour que le script
 * d'interception soit déjà en place au tout premier chargement de module.
 *
 * N'appelle JAMAIS le `speechSynthesis.speak()` natif du navigateur :
 * Chromium headless n'a généralement aucune voix française installée (voir
 * en-tête de VoiceCheckScreen.tsx), et selon la plateforme, un `speak()`
 * natif sans voix peut ne JAMAIS déclencher `onstart`/`onend` — ce qui
 * forcerait chaque énoncé du jeu à attendre le chien de garde complet de
 * l'app (600 ms + une reprise, voir src/voice/watchdog.ts) avant de traiter
 * le suivant dans la file sérialisée (src/voice/queue.ts traite un énoncé à
 * la fois). Avec le nombre d'énoncés réellement produits par une session de
 * jeu (chaque écran ET chaque région de la carte du monde s'annoncent à
 * l'apparition, voir WorldMap.tsx), ce délai s'accumulerait au point de
 * rendre ce test peu fiable et inutilement lent, sans rien y gagner : ce
 * test n'a besoin que du TEXTE transmis à `speak()` (ce qu'un enfant
 * entendrait), jamais d'audio réel. On simule donc ici un moteur de synthèse
 * "parfait" qui démarre et termine chaque énoncé immédiatement, ce qui laisse
 * la file d'attente réelle du jeu (queue.ts) s'écouler aussi vite que
 * possible, tout en exerçant fidèlement son VRAI mécanisme de sérialisation
 * (un texte à la fois, dans l'ordre).
 */
export async function installSpeechCapture(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Tableau exposé sur window : chaque texte réellement transmis à
    // synth.speak(), dans l'ordre chronologique exact des appels — c'est
    // l'équivalent, pour ce test, de ce qu'un enfant entendrait.
    ;(window as unknown as { __spokenTexts: string[] }).__spokenTexts = []
    const synth = (window as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis
    if (!synth) return
    synth.speak = (utterance: SpeechSynthesisUtterance) => {
      try {
        ;(window as unknown as { __spokenTexts: string[] }).__spokenTexts.push(String(utterance?.text ?? ''))
      } catch {
        // Ne jamais laisser l'interception elle-même casser le jeu.
      }
      // Démarre puis termine l'énoncé au tour suivant de la boucle
      // d'événements (jamais synchrone : `speakOnce`, watchdog.ts, installe
      // ses gestionnaires juste après avoir appelé `synth.speak()`, un appel
      // synchrone à `onstart` ici les manquerait).
      setTimeout(() => {
        try {
          utterance.onstart?.(new Event('start') as unknown as SpeechSynthesisEvent)
        } catch {
          // idem : ne jamais casser le jeu depuis cette simulation de test.
        }
        setTimeout(() => {
          try {
            utterance.onend?.(new Event('end') as unknown as SpeechSynthesisEvent)
          } catch {
            // idem.
          }
        }, 0)
      }, 0)
    }
    synth.cancel = () => {
      // No-op délibéré : watchdog.ts n'attend jamais de callback en
      // provenance de cancel(), seulement de la paire onstart/onend
      // ci-dessus. Un no-op évite toute exception si le natif absent/instable
      // de Chromium headless levait ici.
    }
  })
}

/** Navigue vers la page d'accueil et attend que le chargement initial (bundle
 * + éventuel enregistrement du service worker) soit terminé. */
export async function gotoHome(page: Page): Promise<void> {
  // Le bouton "Jouer" porte une animation CSS infinie décorative,
  // explicitement désactivée sous `prefers-reduced-motion: reduce`
  // (PlayScreen.css, SPEC §3). Sans ceci, Playwright considère le bouton
  // perpétuellement "instable" (sa transform change en continu) et
  // n'aboutit jamais à un clic — émuler cette préférence média exerce une
  // vraie fonctionnalité de l'app plutôt que de contourner un défaut de test.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
}

/** Franchit l'écran de vérification de la voix (premier lancement
 * uniquement) sans jamais lire son texte : cible directement les deux
 * boutons qui font progresser vers l'écran Jouer, quel que soit celui que
 * l'app affiche (dépend de la présence réelle d'une voix française dans
 * Chromium headless — voir en-tête de VoiceCheckScreen.tsx). No-op silencieux
 * si l'écran n'apparaît pas (déjà franchi dans une session précédente du
 * même contexte navigateur). */
export async function passVoiceCheckIfPresent(page: Page): Promise<void> {
  const startButton = page.getByTestId('voice-check-start')
  const present = await startButton.isVisible().catch(() => false)
  if (!present) return

  await startButton.click()

  // Selon que Chromium headless expose ou non une voix fr-*, l'écran bascule
  // soit vers "confirming" (boutons heard/not-heard) soit automatiquement
  // vers "explanation" (bouton continue-anyway) — voir le commentaire détaillé
  // dans VoiceCheckScreen.tsx. Les deux mènent à l'écran Jouer ; on prend
  // celui des deux qui devient actionnable en premier.
  await Promise.race([
    page.getByTestId('voice-check-heard').click({ timeout: 20000 }).catch(() => undefined),
    page.getByTestId('voice-check-continue-anyway').click({ timeout: 20000 }).catch(() => undefined),
  ])

  // Défense en profondeur : si la course ci-dessus n'a abouti à aucun clic
  // réel (cas extrême), l'écran de vérification serait resté affiché — le
  // test suivant (attente de play-button) échouerait alors avec un message
  // clair plutôt que silencieusement.
}

/** Clique le bouton Jouer (amorce la voix sur ce geste, comme l'exige SPEC §3). */
export async function clickPlay(page: Page): Promise<void> {
  await page.getByTestId('play-button').click()
}

/**
 * Choisit un avatar et un compagnon puis confirme. Le choix précis n'a aucune
 * importance fonctionnelle pour ces tests (un seul avatar/compagnon suffit à
 * débloquer la région 1, voir GameRoot.tsx::handleAvatarSelect).
 *
 * Utilise volontairement le TOUT PREMIER avatar (`avatar-comete`), pas un
 * autre : c'est exactement le clic réel qui révélait la collision avec la
 * zone cachée de l'écran parent (`parent-hidden-zone`,
 * src/parent/HiddenAccessGate.tsx, fixed/coin supérieur gauche/64x64/
 * z-index 9999) avant le correctif du driver (GameRoot.tsx réserve
 * désormais ce coin par une marge de contenu). `Locator.click()` (jamais
 * `.evaluate(el => el.click())`) est essentiel ici : Playwright refuse ce
 * clic si un autre élément intercepte réellement le point de frappe,
 * exactement comme un doigt sur un vrai appareil — c'est ce qui prouve la
 * correction, pas seulement qu'un gestionnaire React a été invoqué.
 */
export async function chooseFirstAvatarAndCompanion(page: Page): Promise<void> {
  await page.getByTestId('avatar-comete').click()
  await page.getByTestId('companion-renardeau').click()
  await page.getByTestId('avatar-confirm').click()
}

/** Enchaîne vérification voix -> Jouer -> choix d'avatar, jusqu'à la carte du
 * monde. Ne navigue PAS lui-même vers la page d'accueil (voir gotoHome) : les
 * tests qui doivent observer le réseau démarrent le monitoring entre les
 * deux, sinon les requêtes du chargement initial fausseraient GF4. */
export async function reachWorldMap(page: Page): Promise<void> {
  await passVoiceCheckIfPresent(page)
  await clickPlay(page)
  await chooseFirstAvatarAndCompanion(page)
  await expect(page.getByTestId('world-map')).toBeVisible()
}

/**
 * Ouvre une région déjà débloquée sur la carte du monde (ses quêtes
 * deviennent visibles dans le même écran, aucune navigation).
 *
 * `Locator.click()` réel (pas `.evaluate`) : avant le correctif du driver
 * (GameRoot.tsx réserve désormais le coin supérieur gauche par une marge de
 * contenu, voir HIDDEN_ACCESS_ZONE_PX), cette suite avait révélé que la
 * région du niveau 1 — TOUJOURS la première de `world-map__regions`,
 * TOUJOURS rendue dans ce coin — était structurellement inatteignable au
 * toucher (interceptée par la zone cachée de l'écran parent, elle-même en
 * position fixed par-dessus tout le jeu). Un vrai clic réussi ici, sans
 * contournement, est la preuve que la superposition est résolue.
 */
export async function openRegion(page: Page, regionId: string): Promise<void> {
  await page.getByTestId(`region-${regionId}`).click()
  await expect(page.getByTestId('world-map-quests')).toBeVisible()
}

/**
 * Touche une quête déjà visible (région ouverte) et attend l'écran de quête.
 *
 * `Locator.click()` réel (pas `.evaluate`) : avant le correctif du driver
 * (src/world/map/WorldMap.css, ajouté après que cette suite a révélé
 * l'absence totale de mise en page pour `.world-map__regions`/
 * `.world-map__quests` — les boutons s'empilaient hors du viewport 1024x768
 * dès la 3e quête d'une région, sans aucun moyen de les atteindre), ce clic
 * réel aurait échoué pour toute quête au-delà de la 2e. Le fait que ce test
 * utilise `Locator.click()` sans scroll manuel est la preuve que la mise en
 * page tient désormais dans le viewport de référence.
 */
export async function selectQuest(page: Page, questId: string): Promise<void> {
  await page.getByTestId(`quest-${questId}`).click()
  await expect(page.getByTestId('quest-runner')).toBeVisible()
}

const CARD_TESTID_PREFIX = 'listen-touch-card-'
const CARD_SELECTOR = `[data-testid^="${CARD_TESTID_PREFIX}"]`

/** testid de chaque carte "Écoute et touche" actuellement affichée, dans
 * l'ordre du DOM — sert de signature du défi courant (les testids encodent
 * l'id du défi, stable tant que le défi n'a pas avancé, voir
 * questAssembly.ts::challengeId). */
export async function currentListenTouchCardTestIds(page: Page): Promise<string[]> {
  const cards = page.locator(CARD_SELECTOR)
  await cards.first().waitFor({ state: 'visible', timeout: 15000 })
  return cards.evaluateAll((elements) => elements.map((el) => el.getAttribute('data-testid') ?? ''))
}

// Sentinelle pour délimiter, dans le flux `__spokenTexts`, la frontière entre
// un défi résolu et le suivant (voir waitForListenTouchAdvanceOrQuestEnd et
// answerCurrentListenTouchChallengeCorrectly juste en dessous). Nécessaire
// car PostSuccessReplay (src/challenges/shared/postSuccessReplay.tsx) ré-énonce
// le graphème de la cible APRÈS une bonne réponse (sans `resolvePronunciation`
// dans ListenTouch.tsx, c'est le texte littéral, ex. "o" re-parlé après avoir
// répondu "o") — un simple curseur croissant peut alors, pour le défi
// SUIVANT, matcher à tort cet écho résiduel plutôt que la vraie consigne du
// nouveau défi, si par hasard le même graphème réapparaît parmi ses cartes
// (très probable : le niveau 1 n'a que 5 voyelles au total). La sentinelle
// est pоsée de façon ATOMIQUE avec la détection du changement de défi
// (même fonction évaluée côté page, un seul aller-retour), donc sans fenêtre
// de course possible avec l'écho de relecture.
const CHALLENGE_BOUNDARY_MARKER = ' __E2E_CHALLENGE_BOUNDARY__ '

/**
 * Répond CORRECTEMENT au défi "Écoute et touche" actuellement affiché, sans
 * jamais lire de texte visible : attend que le texte intercepté par
 * `installSpeechCapture`, apparu APRÈS la dernière sentinelle de frontière
 * (voir CHALLENGE_BOUNDARY_MARKER), corresponde au nom accessible
 * (aria-label) d'une des cartes actuellement affichées, puis clique cette
 * carte précise. N'utilise JAMAIS la lanterne (voir en-tête de fichier) :
 * `usedHelpLevel` reste 0, la réponse compte pour la maîtrise (SPEC §7).
 *
 * Presse d'abord le bouton oreille (`quest-runner-ear`, gratuit et illimité,
 * SPEC §8, sans effet sur la maîtrise au niveau 1 — seul le niveau 10 compte
 * la réécoute comme un indice, voir src/engine/mastery.ts) plutôt que de
 * s'appuyer sur l'auto-énoncé au montage du défi : un geste enfant réel tout
 * aussi valide, et un signal plus robuste pour ce test (indépendant de tout
 * timing d'apparition d'écran). Avant le correctif du driver sur
 * `narrationDriver.ts` (`cancel` était un `cancelAll()` qui vidait la file
 * vocale brute PARTAGÉE entre narration d'écran (A4) et voix directe des
 * défis (E3/challengeSpeak.ts), pouvant faire disparaître silencieusement la
 * toute première consigne d'une quête), ce même bouton oreille servait aussi
 * de contournement fiable — il reste la stratégie de ce test, désormais pour
 * sa robustesse propre, plus pour contourner un défaut.
 */
export async function answerCurrentListenTouchChallengeCorrectly(page: Page): Promise<void> {
  const cardsGroup = page.getByTestId('listen-touch-cards')
  const cards = cardsGroup.locator(CARD_SELECTOR)
  await cards.first().waitFor({ state: 'visible', timeout: 15000 })
  const cardLabels = await cards.evaluateAll((elements) => elements.map((el) => el.getAttribute('aria-label') ?? ''))

  await page.getByTestId('quest-runner-ear').click()

  const matchHandle = await page.waitForFunction(
    ({ labels, marker }) => {
      const texts = (window as unknown as { __spokenTexts?: string[] }).__spokenTexts ?? []
      let start = 0
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        if (texts[i] === marker) {
          start = i + 1
          break
        }
      }
      for (let i = start; i < texts.length; i += 1) {
        if (labels.includes(texts[i])) return { index: i, value: texts[i] }
      }
      return null
    },
    { labels: cardLabels, marker: CHALLENGE_BOUNDARY_MARKER },
    { timeout: 20000 },
  )
  const match = (await matchHandle.jsonValue()) as { index: number; value: string }

  await cardsGroup.getByRole('button', { name: match.value, exact: true }).click()
}

/**
 * Attend que le défi "Écoute et touche" affiché change (nouveau jeu de
 * testids de cartes) ou que la quête se termine (retour à la carte du monde,
 * ou marqueur de fin de file de défis) ; pose alors la sentinelle de
 * frontière (voir CHALLENGE_BOUNDARY_MARKER) dans le MÊME appel évalué côté
 * page que la détection, pour qu'aucun texte intercepté ensuite (le premier
 * étant la consigne du nouveau défi) ne puisse être confondu avec un écho
 * résiduel du défi qui vient d'être résolu. `previousCardTestIds` doit avoir
 * été capturé AVANT l'action qui fait avancer la quête (voir
 * currentListenTouchCardTestIds). Timeout généreux : SPEC §6 impose une
 * relecture post-succès visible, différée jusqu'à 8000 ms
 * (useQuestSession.ts::ADVANCE_MAX_DELAY_MS) avant l'avancement réel.
 */
export async function waitForListenTouchAdvanceOrQuestEnd(
  page: Page,
  previousCardTestIds: readonly string[],
): Promise<void> {
  await page.waitForFunction(
    ({ prevIds, marker }) => {
      const w = window as unknown as { __spokenTexts?: string[] }
      const markBoundary = () => {
        w.__spokenTexts = w.__spokenTexts ?? []
        w.__spokenTexts.push(marker)
      }
      if (document.querySelector('[data-testid="world-map"]')) {
        markBoundary()
        return true
      }
      if (document.querySelector('[data-testid="quest-runner-complete"]')) {
        markBoundary()
        return true
      }
      const cards = Array.from(document.querySelectorAll('[data-testid^="listen-touch-card-"]')).map((el) =>
        el.getAttribute('data-testid'),
      )
      if (cards.length === 0) return false
      const changed = cards.length !== prevIds.length || cards.some((id, index) => id !== prevIds[index])
      if (changed) markBoundary()
      return changed
    },
    { prevIds: previousCardTestIds, marker: CHALLENGE_BOUNDARY_MARKER },
    { timeout: 20000 },
  )
}

/**
 * Joue une quête entière composée uniquement de défis "Écoute et touche"
 * (vrai pour toute la région 1, voir challengeKind.ts::pickChallengeKind —
 * un ContentItem de nature "grapheme" est TOUJOURS 'listen-touch') : répond
 * correctement à chaque défi jusqu'à ce que le jeu revienne à la carte du
 * monde. `maxChallenges` est un plafond de sécurité (jamais atteint en
 * fonctionnement normal, une quête régulière ou boss fait 10 ou 12 défis,
 * voir questAssembly.ts) qui fait échouer le test avec un message clair
 * plutôt que de boucler indéfiniment si l'avancement ne se comporte pas comme
 * attendu.
 */
export async function playFullListenTouchQuest(page: Page, maxChallenges = 20): Promise<void> {
  for (let i = 0; i < maxChallenges; i += 1) {
    const worldMapAlreadyBack = await page.getByTestId('world-map').isVisible().catch(() => false)
    if (worldMapAlreadyBack) return

    const prevIds = await currentListenTouchCardTestIds(page)
    await answerCurrentListenTouchChallengeCorrectly(page)
    await waitForListenTouchAdvanceOrQuestEnd(page, prevIds)
  }
  throw new Error(
    `playFullListenTouchQuest : ${maxChallenges} défis joués sans retour à la carte du monde — ` +
      'la quête ne semble jamais se terminer (plafond de sécurité atteint).',
  )
}
