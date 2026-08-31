// GF4 (leaf-F4.md) / G-F4 (SPEC §3 "Zéro dépendance réseau à l'exécution",
// CLAUDE.md règle #5) : aucune requête réseau ne part APRÈS le chargement
// initial. Les requêtes du serveur de preview pour charger la page initiale
// (bundle JS/CSS, police Andika via @fontsource, manifeste, éventuel
// enregistrement du service worker) sont attendues et exclues explicitement :
// seules les requêtes déclenchées PENDANT les interactions de jeu qui suivent
// comptent pour ce gate.
import { test, expect } from '@playwright/test'
import {
  answerCurrentListenTouchChallengeCorrectly,
  chooseFirstAvatarAndCompanion,
  currentListenTouchCardTestIds,
  gotoHome,
  installSpeechCapture,
  openRegion,
  passVoiceCheckIfPresent,
  selectQuest,
  waitForListenTouchAdvanceOrQuestEnd,
} from './helpers'

test('aucune requête réseau ne part après le chargement initial', async ({ page }) => {
  test.setTimeout(60 * 1000)

  await installSpeechCapture(page)
  await gotoHome(page)
  // `networkidle` (dans gotoHome) laisse le temps à un éventuel
  // enregistrement de service worker (déclenché sur l'évènement `load`, voir
  // src/app/serviceWorker.ts) de se produire et de se stabiliser AVANT qu'on
  // commence à observer le réseau — sinon cette requête légitime de
  // chargement initial serait comptée à tort comme une violation.

  const requestsAfterInitialLoad: string[] = []
  page.on('request', (request) => {
    requestsAfterInitialLoad.push(`${request.method()} ${request.url()}`)
  })

  // Interactions représentatives d'une vraie session de jeu : vérification
  // voix (1er lancement) -> Jouer -> choix d'avatar -> carte du monde ->
  // ouverture d'une région -> une quête -> un défi répondu correctement.
  await passVoiceCheckIfPresent(page)
  await page.getByTestId('play-button').click()
  await chooseFirstAvatarAndCompanion(page)
  await expect(page.getByTestId('world-map')).toBeVisible()
  await openRegion(page, 'clairiere-des-voyelles')
  await selectQuest(page, 'clairiere-des-voyelles-q1')

  const cardIds = await currentListenTouchCardTestIds(page)
  await answerCurrentListenTouchChallengeCorrectly(page)
  await waitForListenTouchAdvanceOrQuestEnd(page, cardIds)

  expect(
    requestsAfterInitialLoad,
    `requête(s) réseau inattendue(s) après le chargement initial :\n${requestsAfterInitialLoad.join('\n')}`,
  ).toEqual([])
})
