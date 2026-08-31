// GF2 (leaf-F4.md) / G-F2 (SPEC §3, CLAUDE.md règle #4) : toutes les zones
// tactiles interactives visibles font au moins 64x64 px CSS, mesuré RÉELLEMENT
// via `boundingBox()` dans un vrai navigateur (jamais une relecture du CSS
// source) sur au moins 3 écrans distincts : Jouer, choix d'avatar, carte du
// monde.
import { type Page, test, expect } from '@playwright/test'
import {
  chooseFirstAvatarAndCompanion,
  gotoHome,
  installSpeechCapture,
  openRegion,
  passVoiceCheckIfPresent,
} from './helpers'

const MIN_TAP_TARGET_PX = 64

interface Undersized {
  screen: string
  testId: string
  width: number
  height: number
}

/** Mesure tous les `<button>` visibles de la page (chaque zone tactile
 * interactive du jeu est un `<button>`, voir TapTarget.tsx/TapButton.tsx/
 * TouchButton.tsx : convention PLAN.md, aucune zone tactile custom hors
 * `<button>`) et retourne celles strictement sous 64x64 px CSS. Un élément
 * sans boundingBox (non rendu, ex. display:none) est ignoré : rien à mesurer
 * sur un bouton invisible pour l'enfant.
 */
async function findUndersizedButtons(page: Page, screenLabel: string): Promise<Undersized[]> {
  const buttons = page.locator('button')
  const count = await buttons.count()
  expect(count, `${screenLabel} : aucun bouton trouvé sur cet écran`).toBeGreaterThan(0)

  const undersized: Undersized[] = []
  for (let i = 0; i < count; i += 1) {
    const button = buttons.nth(i)
    if (!(await button.isVisible())) continue
    const box = await button.boundingBox()
    if (!box) continue
    if (box.width < MIN_TAP_TARGET_PX || box.height < MIN_TAP_TARGET_PX) {
      const testId = (await button.getAttribute('data-testid')) ?? '(sans data-testid)'
      undersized.push({ screen: screenLabel, testId, width: box.width, height: box.height })
    }
  }
  return undersized
}

function formatUndersized(items: Undersized[]): string {
  return items
    .map((u) => `${u.screen} :: ${u.testId} -> ${u.width.toFixed(1)}x${u.height.toFixed(1)} px (minimum ${MIN_TAP_TARGET_PX}x${MIN_TAP_TARGET_PX})`)
    .join('\n')
}

test('toutes les zones tactiles interactives font au moins 64x64 px CSS sur play / avatar-select / world-map', async ({
  page,
}) => {
  await installSpeechCapture(page)
  await gotoHome(page)
  await passVoiceCheckIfPresent(page)

  const allUndersized: Undersized[] = []

  // Écran 1 : Jouer.
  await expect(page.getByTestId('play-button')).toBeVisible()
  allUndersized.push(...(await findUndersizedButtons(page, 'play')))

  await page.getByTestId('play-button').click()

  // Écran 2 : choix d'avatar (avant confirmation, pour mesurer aussi les
  // options d'avatar/compagnon non encore sélectionnées, pas seulement le
  // bouton de confirmation).
  await expect(page.getByTestId('avatar-options')).toBeVisible()
  allUndersized.push(...(await findUndersizedButtons(page, 'avatar-select')))

  await chooseFirstAvatarAndCompanion(page)

  // Écran 3 : carte du monde, région ouverte (pour mesurer aussi les cibles
  // de quête révélées au toucher d'une région, pas seulement les régions
  // elles-mêmes et le bouton Grand Livre).
  await expect(page.getByTestId('world-map')).toBeVisible()
  await openRegion(page, 'clairiere-des-voyelles')
  allUndersized.push(...(await findUndersizedButtons(page, 'world-map')))

  expect(allUndersized, formatUndersized(allUndersized)).toEqual([])
})
