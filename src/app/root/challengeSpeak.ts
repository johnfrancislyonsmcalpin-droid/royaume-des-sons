// Point d'entrée voix pour tout ce qui reçoit sa capacité de parole par
// injection sous la forme `(text: string) => Promise<void>` : les 6
// mécaniques de défi (C1-C4, `ChallengeSpeakFn`), le moteur de session de
// quête (E3, `useQuestSession`) et le Grand Livre (E4, `GrandLivreSpeakFn`).
// Ces modules déclarent explicitement dans leurs en-têtes ne jamais importer
// `src/narration/**` ni `src/voice/**` directement, pour rester développables
// et testables indépendamment de la disponibilité réelle de la voix — ce
// fichier est le câblage réel que chacun de leurs en-têtes annonce comme
// « responsabilité de l'appelant / du driver à l'intégration ».
//
// Volontairement séparé de narrationDriver.ts (celui-ci sert les narrations
// D'ÉCRAN via l'orchestrateur A4, avec ordonnancement par priorité) : la voix
// « moment à moment » d'un défi déjà affiché (consigne, réécoute, décodage
// syllabe par syllabe après une bonne réponse) n'a pas besoin de cet
// ordonnancement — elle est déjà séquencée par la logique du défi lui-même
// (ex. `speakSequential` dans useQuestSession.ts, qui attend chaque énoncé
// avant le suivant). Appeler `src/voice` directement ici, sans passer par
// l'orchestrateur, reflète fidèlement ce choix des leaves C1/E3/E4.
import { speak as voiceSpeak } from '../../voice'
import type { ChallengeSpeakFn } from '../../challenges/shared/contract'

let counter = 0

export const speakChallengeText: ChallengeSpeakFn = (text) => {
  counter += 1
  // Même adaptation fire-and-forget -> Promise que narrationDriver.ts : voir
  // son en-tête pour la justification complète (A2 sérialise déjà en interne).
  return Promise.resolve(
    voiceSpeak({
      id: `challenge-speak-${counter}`,
      text,
      priority: 'instruction',
      interruptible: true,
    }),
  )
}
