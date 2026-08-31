// GB3 / G-B3 (SPEC §3, §5) : chaque item kind:'word' a un emoji non vide ;
// aucun emoji n'est réutilisé pour deux mots DIFFÉRENTS (texte différent)
// dans tout le corpus assemblé.
//
// Un même mot peut légitimement réapparaître à deux niveaux (ex. "nid" en
// niveau 5 CVC puis revu en niveau 7 pour la consonne finale muette) avec le
// même emoji : ce n'est pas une violation, c'est le même mot. La règle
// s'applique entre mots au TEXTE différent.

/**
 * @param {Array<object>} corpusItems
 * @returns {{missing: Array<object>, duplicates: Array<{emoji:string, texts:string[]}>}}
 */
export function checkEmoji(corpusItems) {
  const words = corpusItems.filter((item) => item.kind === 'word')

  const missing = words.filter(
    (word) => typeof word.emoji !== 'string' || word.emoji.trim().length === 0,
  )

  const emojiToTexts = new Map()
  for (const word of words) {
    if (typeof word.emoji !== 'string' || word.emoji.trim().length === 0) continue
    if (!emojiToTexts.has(word.emoji)) emojiToTexts.set(word.emoji, new Set())
    emojiToTexts.get(word.emoji).add(word.text)
  }

  const duplicates = []
  for (const [emoji, texts] of emojiToTexts) {
    if (texts.size > 1) {
      duplicates.push({ emoji, texts: [...texts] })
    }
  }

  return { missing, duplicates }
}
