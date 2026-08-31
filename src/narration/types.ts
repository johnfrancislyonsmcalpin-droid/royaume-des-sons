// Contrat de la leaf A4 (système de narration d'écran).
//
// Ce module orchestre QUAND parler (ordre, priorité, interruption) mais n'appelle
// JAMAIS directement `window.speechSynthesis` : le bas niveau (file d'attente
// sérialisée, débit, watchdog, découpage des énoncés longs) est la responsabilité
// de la leaf A2 (`src/voice/**`). Comme A2 est développée en parallèle et n'est
// pas garantie stable/disponible pendant le développement de A4, ce module
// n'importe JAMAIS `src/voice/**`. Il définit à la place la petite interface
// d'injection ci-dessous, que ses propres tests doublent avec un mock, et que le
// driver câblera au vrai module A2 au moment de l'intégration de la branche A.

import type { NarrationRequest } from '../types'

/**
 * Démarre l'énonciation d'une NarrationRequest.
 *
 * Contrat attendu de l'implémentation réelle (A2) :
 * - Résout quand l'énonciation est terminée — que ce soit une fin naturelle OU
 *   parce que `NarrationDriver.cancel()` a été appelé entre-temps.
 * - Ne rejette JAMAIS pour un fonctionnement normal : toute dégradation (aucune
 *   voix française, watchdog `onstart` qui échoue deux fois, etc.) est gérée en
 *   interne par A2 et doit se résoudre silencieusement — cf. CLAUDE.md
 *   « jamais de throw visible du joueur » et SPEC §3 (icône « son muet »).
 *
 * Remarque pour le driver : ceci diffère volontairement de l'esquisse
 * `SpeakFn = (req) => void` donnée dans la tâche. Une signature purement
 * fire-and-forget ne permet pas à l'orchestrateur de savoir quand une narration
 * se termine, donc pas de savoir quand jouer l'élément suivant de la file — or la
 * mise en file des demandes de priorité inférieure pendant qu'une narration non
 * interruptible est en cours (au lieu de les perdre silencieusement) fait partie
 * du contrat de G3. Envelopper le `speak()` de A2 (probablement basé sur les
 * événements `onstart`/`onend`) dans une Promise à l'intégration est trivial.
 */
export type SpeakFn = (request: NarrationRequest) => Promise<void>

/**
 * Interface d'injection complète attendue par ce module. Fournie via
 * `<NarrationProvider driver={...}>` — voir NarrationProvider.tsx.
 */
export interface NarrationDriver {
  speak: SpeakFn
  /**
   * Interrompt immédiatement l'énonciation en cours, s'il y en a une, et doit
   * provoquer la résolution de la Promise de `speak()` en attente (pour que
   * l'orchestrateur puisse enchaîner sur la narration suivante). Sans effet si
   * rien n'est en cours.
   */
  cancel: () => void
}

/** Une violation du contrat « chaque écran déclare une narration non vide ». */
export interface ScreenNarrationViolation {
  screenId: string
  reason: string
}
