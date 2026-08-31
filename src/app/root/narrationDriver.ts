// Câblage réel du système de narration d'écran (A4, src/narration/**) sur le
// module voix (A2, src/voice/**) — c'est le point d'intégration explicitement
// prévu par A4 (voir src/narration/types.ts, en-tête de SpeakFn) et documenté
// par le ledger de cette leaf.
//
// `voice.speak()` est fire-and-forget (ne retourne rien) alors que
// `NarrationDriver.speak` attend une Promise qui résout à la fin de
// l'énonciation, pour que l'orchestrateur sache quand enchaîner sur la
// narration suivante de sa file. Adaptation minimale : on enveloppe l'appel
// dans `Promise.resolve(...)`, qui résout donc immédiatement plutôt qu'à la
// fin réelle de la parole. Limite connue et documentée (ASSUMPTIONS.md) :
// - `src/voice/**` sérialise déjà ses propres énoncés en interne (file
//   d'attente, voir src/voice/queue.ts), donc aucun énoncé n'est jamais
//   coupé ou chevauché même si l'orchestrateur "pense" avoir fini plus tôt ;
// - la seule conséquence observable est que l'orchestrateur peut soumettre
//   une narration de priorité inférieure à la file de A2 avant que la
//   précédente ait fini de se dire, plutôt que d'attendre — un défaut mineur
//   d'ordonnancement, jamais un énoncé perdu ou un plantage.
// Un contrat `speak()` réellement "résout à la fin" exigerait d'exposer un
// événement de fin d'énoncé depuis src/voice/**, hors du périmètre OWNS de
// cette leaf (src/voice/** appartient à A2, VERIFIED).
import { cancelAll, speak as voiceSpeak } from '../../voice'
import type { NarrationDriver } from '../../narration/types'

export const narrationDriver: NarrationDriver = {
  speak: (request) => Promise.resolve(voiceSpeak(request)),
  cancel: () => cancelAll(),
}
