// Découpage des énoncés longs (SPEC §3 « Voix » / gate A2:G3).
//
// Chrome Android tronque une SpeechSynthesisUtterance dont l'énonciation dépasse
// environ 15 secondes. Plutôt que de mesurer une durée (dépend de la voix, du
// débit, de l'appareil — invérifiable de façon fiable), on borne la longueur en
// caractères de chaque morceau, en visant une marge large sous 15 s.
//
// Choix (voir ASSUMPTIONS.md) : MAX_CHUNK_CHARS = 100. Justification : à un débit
// de 0.85 (SPEC), une voix française prononce grossièrement entre 12 et 16
// caractères par seconde selon la voix (moteurs plus lents inclus). 100
// caractères donnent donc un majorant d'environ 8 secondes par morceau, soit une
// marge d'environ 2x sous le seuil de troncature observé, pour absorber la
// variance entre voix et appareils.
export const MAX_CHUNK_CHARS = 100

// Coupe après un point, un point d'exclamation, une interrogation ou des
// points de suspension suivis d'espace(s) — sans consommer l'espace, pour ne
// pas produire de segments vides.
const SENTENCE_BOUNDARY_RE = /(?<=[.!?…])\s+/

/**
 * Découpe un texte en morceaux prononçables séquentiellement, chacun sous
 * `maxChars`. Découpe d'abord sur les frontières de phrase, puis sur les
 * frontières de mot si une phrase seule dépasse encore le seuil. Ne coupe
 * jamais au milieu d'un mot : un mot isolé plus long que `maxChars` (cas
 * limite, non attendu dans le corpus français) forme son propre morceau
 * plutôt que d'être tronqué, pour ne jamais mutiler une prononciation.
 */
export function splitIntoChunks(text: string, maxChars: number = MAX_CHUNK_CHARS): string[] {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length === 0) return []
  if (trimmed.length <= maxChars) return [trimmed]

  const sentences = trimmed.split(SENTENCE_BOUNDARY_RE).filter((s) => s.length > 0)
  const chunks: string[] = []
  let current = ''

  const flush = () => {
    if (current.length > 0) {
      chunks.push(current)
      current = ''
    }
  }

  const appendWithinLimit = (piece: string) => {
    const candidate = current.length === 0 ? piece : `${current} ${piece}`
    if (candidate.length > maxChars && current.length > 0) {
      flush()
      current = piece
    } else {
      current = candidate
    }
  }

  for (const sentence of sentences) {
    if (sentence.length <= maxChars) {
      appendWithinLimit(sentence)
      continue
    }
    // Phrase seule trop longue : redécoupe mot par mot sans jamais couper un mot.
    flush()
    for (const word of sentence.split(' ')) {
      appendWithinLimit(word)
    }
  }
  flush()
  return chunks
}
