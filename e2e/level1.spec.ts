// GF1 (leaf-F4.md) / G-F1 (SPEC §12) : parcours e2e complet niveau 1 -> boss 1
// sans jamais lire une consigne écrite. Voir e2e/helpers.ts (en-tête) pour la
// stratégie qui permet de répondre correctement sans lecture : interception
// du texte réellement transmis à `speechSynthesis.speak()` (ce que l'enfant
// entendrait), résolu contre le nom accessible (aria-label) des cartes.
//
// Portée jouée : la région 1 (La Clairière des Voyelles) contient 4 quêtes
// régulières + 1 boss (regionQuests.ts::QUESTS_PER_REGION = 5, constant pour
// les 10 régions). Ce test joue les 4 quêtes régulières PUIS le boss, soit un
// parcours complet et non réduit de "niveau 1 -> boss 1" — aucune réduction
// de portée n'a été nécessaire : les items du niveau 1 sont tous de nature
// "grapheme" (a, i, o, u, é), qui ne se joue qu'avec la mécanique unique
// "Écoute et touche" (challengeKind.ts), ce qui rend un parcours automatisé
// complet praticable en quelques minutes.
import { test, expect } from '@playwright/test'
import {
  installSpeechCapture,
  gotoHome,
  openRegion,
  playFullListenTouchQuest,
  reachWorldMap,
  selectQuest,
} from './helpers'

const REGION_ID = 'clairiere-des-voyelles'
const BOSS_QUEST_ID = 'boss-clairiere-des-voyelles'
const REGULAR_QUEST_IDS = [1, 2, 3, 4].map((position) => `${REGION_ID}-q${position}`)

test('parcours complet niveau 1 (Clairière des Voyelles) jusqu\'au boss, sans lire aucune consigne écrite', async ({
  page,
}) => {
  // Généreux à dessein : 4 quêtes régulières (10 défis) + 1 boss (12 défis) =
  // 52 défis, chacun pouvant différer son avancement jusqu'à 8 s après une
  // bonne réponse (SPEC §6, useQuestSession.ts::ADVANCE_MAX_DELAY_MS) —
  // plusieurs minutes réelles sont attendues, voir consigne de la tâche.
  test.setTimeout(6 * 60 * 1000)

  await installSpeechCapture(page)
  await gotoHome(page)
  await reachWorldMap(page)

  // Le personnage vient d'être confirmé : GameRoot.tsx débloque la région 1 à
  // ce moment précis (voir son en-tête, handleAvatarSelect). La carte
  // s'ouvre déjà dessus (WorldMap.tsx : progress.currentRegionId), mais on
  // touche quand même le bouton région explicitement — c'est le geste que
  // ferait l'enfant, et il reste sans risque si la région est déjà ouverte.
  await openRegion(page, REGION_ID)

  for (const questId of REGULAR_QUEST_IDS) {
    await selectQuest(page, questId)
    await playFullListenTouchQuest(page)
    await expect(page.getByTestId('world-map')).toBeVisible()
    // Retour au hub : on ré-ouvre la région pour accéder à la quête
    // régulière suivante (voir GameRoot.tsx::handleQuestComplete).
    await openRegion(page, REGION_ID)
  }

  // Garde de contenu (échoue avec un message clair plutôt que de bloquer 15s
  // sur un bouton jamais actionnable) : le boss ne doit être accessible
  // qu'une fois les deux compétences du niveau 1 maîtrisées (SPEC §7,
  // bossGate.ts::canStartBossQuest). Avec 4 quêtes régulières de 10 défis
  // répartis moitié-moitié entre les 2 compétences du niveau 1
  // (questAssembly.ts::orderSkillsByMasteryNeed, round-robin), chaque
  // compétence a largement dépassé la fenêtre de maîtrise de 10 réponses
  // (SPEC §7 : 8/10 sans indice) avant la fin de la 2e quête déjà — le
  // bouton doit donc être actionnable ici.
  await selectQuest(page, BOSS_QUEST_ID)

  await playFullListenTouchQuest(page)
  await expect(page.getByTestId('world-map')).toBeVisible()
})
