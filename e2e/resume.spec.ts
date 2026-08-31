// GF3 (leaf-F4.md) / G-F3 (SPEC §3 "Persistance" : « Reprise exacte au défi en
// cours après rechargement ») : un rechargement en plein milieu d'une quête
// reprend au MÊME défi — pas au début de la quête, pas à l'écran d'accueil.
import { test, expect } from '@playwright/test'
import {
  answerCurrentListenTouchChallengeCorrectly,
  currentListenTouchCardTestIds,
  gotoHome,
  installSpeechCapture,
  openRegion,
  reachWorldMap,
  selectQuest,
  waitForListenTouchAdvanceOrQuestEnd,
} from './helpers'

test('recharger la page en plein milieu d\'une quête reprend exactement au même défi', async ({ page }) => {
  test.setTimeout(60 * 1000)

  await installSpeechCapture(page)
  await gotoHome(page)
  await reachWorldMap(page)
  await openRegion(page, 'clairiere-des-voyelles')
  await selectQuest(page, 'clairiere-des-voyelles-q1')

  // Répond correctement au tout premier défi et attend l'avancement réel à
  // l'index suivant (SPEC §3 : la sauvegarde est réécrite après CHAQUE défi,
  // voir GameRoot.tsx::handleQuestStateChange) — le rechargement doit donc
  // reprendre au DEUXIÈME défi, pas au premier.
  const firstChallengeCardIds = await currentListenTouchCardTestIds(page)
  await answerCurrentListenTouchChallengeCorrectly(page)
  await waitForListenTouchAdvanceOrQuestEnd(page, firstChallengeCardIds)

  // Signature du défi en cours (le deuxième de la quête) AVANT rechargement :
  // les testids des cartes encodent l'id du défi (questAssembly.ts), stable
  // tant que currentIndex ne change pas. On capture aussi le nombre de
  // résultats déjà enregistrés (visible indirectement via ce même id, mais
  // le jeu de testids suffit à identifier le défi sans lire aucun texte).
  const secondChallengeCardIdsBeforeReload = await currentListenTouchCardTestIds(page)
  expect(secondChallengeCardIdsBeforeReload).not.toEqual(firstChallengeCardIds)

  await page.reload()
  await page.waitForLoadState('networkidle')

  // SPEC §3 / GameRoot.tsx::computeInitialScreenId : une sauvegarde avec
  // `currentQuestState !== null` reprend DIRECTEMENT sur l'écran de quête,
  // sans repasser par la vérification de voix (déjà faite), Jouer, ni la
  // carte du monde.
  await expect(page.getByTestId('quest-runner')).toBeVisible()

  const cardIdsAfterReload = await currentListenTouchCardTestIds(page)
  expect(
    cardIdsAfterReload,
    'après rechargement, le jeu doit reprendre exactement au 2e défi (mêmes ids de cartes), ' +
      'pas au 1er défi ni à un autre écran',
  ).toEqual(secondChallengeCardIdsBeforeReload)
})
