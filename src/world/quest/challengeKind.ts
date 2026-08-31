// Choix de la mécanique de défi (ChallengeKind, src/types.ts FIGÉ) pour un
// nouveau défi, à partir du kind du ContentItem cible. SPEC §6 fixe la liste
// des 6 mécaniques et leur niveau d'entrée en jeu, mais pas une règle
// explicite de correspondance ContentItemKind -> ChallengeKind : décision
// libre de cette leaf (ASSUMPTIONS.md), documentée ci-dessous.
import type { ChallengeKind, ContentItemKind } from '../../types'

const SYLLABLE_KIND_ROTATION: readonly ChallengeKind[] = ['listen-touch', 'forge']
const WORD_KIND_ROTATION: readonly ChallengeKind[] = ['listen-touch', 'forge', 'read-show']

/**
 * Règle de correspondance (ASSUMPTION) :
 *   - grapheme    -> listen-touch. Seule mécanique jouable sur un graphème
 *     isolé : Forge/Reorder exigent plusieurs positions à assembler, Vrai/
 *     Faux-mot et la question du compagnon ne s'appliquent pas à un
 *     graphème seul (SPEC §5 niveaux 1-2 : « Lettre → son, son → lettre »).
 *   - syllable    -> alterne listen-touch / forge (les deux mécaniques ont
 *     un sens pédagogique identique pour une syllabe, SPEC §5 niveau 3 :
 *     « Entendre → choisir ; assembler deux lettres ; lire une syllabe »).
 *   - word        -> alterne listen-touch / forge / read-show, les trois
 *     mécaniques génériques à choix/assemblage qui s'appliquent à un mot.
 *   - pseudoword  -> true-false-word, seule mécanique dédiée (SPEC §6.4,
 *     niveau 7+).
 *   - sentence    -> reorder, seule mécanique dédiée (SPEC §6.5, niveau 8+).
 *   - text        -> companion-question, seule mécanique dédiée (SPEC §6.6,
 *     niveau 9+).
 * `rotationIndex` fait varier le choix pour syllable/word d'un défi à
 * l'autre de la même quête (évite qu'une seule mécanique domine toute une
 * quête), sans effet sur les kinds à mécanique unique.
 */
export function pickChallengeKind(itemKind: ContentItemKind, rotationIndex: number): ChallengeKind {
  switch (itemKind) {
    case 'grapheme':
      return 'listen-touch'
    case 'syllable':
      return SYLLABLE_KIND_ROTATION[rotationIndex % SYLLABLE_KIND_ROTATION.length]
    case 'word':
      return WORD_KIND_ROTATION[rotationIndex % WORD_KIND_ROTATION.length]
    case 'pseudoword':
      return 'true-false-word'
    case 'sentence':
      return 'reorder'
    case 'text':
      return 'companion-question'
    default: {
      // Défense en profondeur : ContentItemKind est une union fermée
      // (types.ts, FIGÉ) — cette branche est structurellement inatteignable
      // en TypeScript, mais un id de contenu malformé à l'exécution (JSON
      // non typé) ne doit jamais planter le jeu.
      const exhaustiveCheck: never = itemKind
      void exhaustiveCheck
      return 'listen-touch'
    }
  }
}
