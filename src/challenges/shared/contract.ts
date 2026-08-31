// Contrat partagé par les 6 mécaniques de défi (SPEC §6). Fixé par la leaf C1
// pour C2 (choix à cartes), C3 (Forge) et C4 (Remets en ordre) : ces leaves
// implémentent `ChallengeComponentProps` TEL QUEL, elles ne redéfinissent pas
// une forme de props ad hoc (PLAN.md, convention "contrats avant fan-out").
//
// Ce module n'importe JAMAIS `src/voice/**` ni `src/narration/**` directement :
// comme A4, il reste bas niveau et reçoit ses capacités par injection
// (`speak`), pour rester testable sans dépendre d'un moteur vocal réel et pour
// ne pas coupler C1 à la disponibilité de ces modules pendant le développement
// parallèle.

import type { Challenge, ChallengeResult, ContentItem, HelpLevel } from '../../types'

/**
 * Signature voix commune à tous les composants de défi et primitives
 * partagées (`ChallengeFeedback`, `PostSuccessReplay`). Enveloppe le `speak()`
 * bas niveau de A2 (fire-and-forget) dans une Promise qui résout à la fin de
 * l'énoncé — même contrat de principe que `NarrationDriver.speak` de A4,
 * défini indépendamment ici pour que `src/challenges/shared/**` n'ait besoin
 * d'importer ni `src/voice/**` ni `src/narration/**`. Le câblage réel (quel
 * texte résolu via pronunciation.json, quelle file d'attente) est la
 * responsabilité de l'appelant (moteur de quête / écran de défi), pas de C1.
 */
export type ChallengeSpeakFn = (text: string) => Promise<void>

/**
 * Props que TOUT composant de mécanique de défi (C2/C3/C4) reçoit. Le moteur
 * de quête (E3, pas encore livré) instancie le composant correspondant à
 * `challenge.kind` avec ces props ; les 6 mécaniques n'ont pas d'autre canal
 * d'entrée (pas de contexte React implicite, pas d'import direct du moteur de
 * progression D1-D4) : ça les garde testables isolément avec des doublures.
 */
export interface ChallengeComponentProps {
  /** Le défi à présenter. `challenge.options` est déjà mélangé par le moteur
   * (D3, anti-position) : un composant de défi ne réordonne jamais lui-même
   * les options reçues. */
  challenge: Challenge

  /** Niveau d'aide courant pour CE défi, décidé et incrémenté par le moteur
   * d'aide (D4) en réaction aux appuis sur la lanterne — ce bouton n'est pas
   * rendu par le composant de défi lui-même (chrome commun à tous les défis,
   * hors périmètre de C1/OWNS). Le composant doit refléter visuellement l'aide
   * en cours (SPEC §8 : surlignage niveau 1, retrait d'option niveau 2,
   * clignotement niveau 3) mais ne décide jamais lui-même de l'augmenter. */
  helpLevel: HelpLevel

  /** Vrai si l'enfant a déjà appuyé sur le bouton oreille (réécoute) pendant
   * CE défi. Comme la lanterne, le bouton oreille est un élément de chrome
   * commun rendu en dehors du composant de défi ; ce booléen lui est
   * simplement répercuté pour qu'il puisse le recopier tel quel dans
   * `ChallengeResult.usedListenAgain` au moment de répondre (voir `onAnswer`).
   * Décision consignée pour ASSUMPTIONS.md : la signature de `onAnswer` fixée
   * par la tâche (`Omit<ChallengeResult, 'timestamp'>`) exige que le composant
   * produise ce champ lui-même ; comme C1 ne possède pas le bouton oreille
   * (hors périmètre), la valeur doit lui arriver par une prop plutôt que d'être
   * mesurée localement. */
  usedListenAgain: boolean

  /** Résout un identifiant de `ContentItem` (cible ou option) en item complet.
   * Le corpus est déjà vérifié décodable par B4 : un composant de défi n'a
   * jamais à valider `graphemeIds` lui-même. */
  resolveItem: (contentItemId: string) => ContentItem

  /** Point d'entrée voix unique pour ce défi (consigne, réécoute, décodage de
   * la relecture post-succès). Jamais d'appel direct à `window.speechSynthesis`
   * ni à `src/voice/**` depuis un composant de défi (CLAUDE.md, PLAN.md). */
  speak: ChallengeSpeakFn

  /** Appelé une fois par tentative de réponse (une par essai, y compris les
   * essais ratés : le moteur d'aide D4 gère la reproposition du même défi
   * après 2 échecs, pas ce composant). Le moteur de quête complète
   * `timestamp` et persiste. */
  onAnswer: (result: Omit<ChallengeResult, 'timestamp'>) => void
}
