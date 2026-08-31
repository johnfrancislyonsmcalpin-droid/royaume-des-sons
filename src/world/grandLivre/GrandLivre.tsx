// Grand Livre — Le Royaume des Sons (leaf E4).
//
// Galerie de tous les mots/phrases/textes maîtrisés (SPEC §4) : consultable et
// réécoutable à volonté. À partir du niveau 8, un item s'affiche SANS aide ni
// surlignage, comme une page de livre ordinaire (texte seul, grande taille,
// aucune décomposition graphémique visible) — c'est la passerelle vers les
// vrais livres (SPEC §10). En dessous du niveau 8, l'emoji du contenu peut
// être affiché en plus du texte, comme aide visuelle.
//
// OWNS: src/world/grandLivre/** uniquement. Ce module ne décide JAMAIS de ce
// qui entre ou sort de `grandLivreItemIds` : c'est une pure vue en lecture
// (aucune callback de suppression n'existe dans ses props), et il n'importe
// ni `src/engine/mastery.ts` (D1) ni un futur module de décroissance — la
// liste reçue en prop est affichée telle quelle, dans l'ordre reçu, sans
// filtrage d'aucune sorte. La décision d'ajouter/retirer un id de
// `ProgressState.grandLivreItemIds` appartient exclusivement au moteur de
// maîtrise, hors du périmètre de cette leaf.
//
// Voix : `speak` est injecté (même contrat que `ChallengeSpeakFn` de
// src/challenges/shared/contract.ts, redéfini ici pour ne pas importer une
// leaf hors OWNS). Narration d'écran : callback `onAnnounce?` optionnel, même
// précédent de découplage que E1/E2/E3.
//
// Bouton tactile : `GrandLivreButton` (doublure locale ≥64×64px, voir son
// en-tête — même précédent documenté que E1/E2 en attendant TapTarget/C1).
//
// Défense en profondeur (chasse aux défauts, passe 3) : `resolveItem` est
// typé pour renvoyer un `ContentItem`, mais peut être fourni par un appelant
// qui viole ce contrat à l'exécution (id inconnu, item malformé). Un item qui
// ne résout à rien d'exploitable (résolution qui lève, ou résultat sans
// `text`/`id` non vide) est silencieusement ignoré à l'affichage : jamais de
// crash, jamais d'entrée cassée montrée à l'enfant. Ceci n'altère PAS
// `grandLivreItemIds` lui-même (aucune mutation, aucun callback de retrait) —
// seule la restitution visuelle de cette entrée est sautée.

import { useEffect, useMemo, useState } from 'react'
import type { ContentItem } from '../../types'
import { GrandLivreButton } from './GrandLivreButton'
import { EmptyBookGlyph, ListenGlyph } from './Glyphs'
import { itemTouchNarration, screenIntroNarration } from './grandLivreNarration'

/** Niveau à partir duquel un item s'affiche sans aide ni surlignage, comme une
 * page de livre ordinaire (SPEC §4, table SPEC §5 niveau 8 « Route des Phrases »). */
const BOOK_PAGE_MIN_LEVEL = 8

export type GrandLivreSpeakFn = (text: string) => Promise<void>

export interface GrandLivreProps {
  /** Identifiants des items maîtrisés, dans l'ordre à afficher — jamais
   * réordonnés ni filtrés par ce composant. */
  grandLivreItemIds: string[]
  /** Résout un identifiant en `ContentItem` complet. Peut lever ou renvoyer un
   * résultat invalide pour un id inconnu : voir note de défense en tête de
   * fichier, géré sans crash. */
  resolveItem: (id: string) => ContentItem
  /** Point d'entrée voix unique. Jamais d'appel direct à `window.speechSynthesis`
   * ni à `src/voice/**` depuis cette leaf (CLAUDE.md, PLAN.md). */
  speak: GrandLivreSpeakFn
  /** Callback d'annonce vocale d'écran ; optionnel, même précédent que E1/E2/E3. */
  onAnnounce?: (text: string) => void
}

function resolveSafely(
  id: string,
  resolveItem: (id: string) => ContentItem,
): ContentItem | null {
  try {
    const item = resolveItem(id)
    if (!item || typeof item.text !== 'string' || item.text.length === 0) return null
    if (typeof item.id !== 'string' || item.id.length === 0) return null
    return item
  } catch {
    return null
  }
}

interface GrandLivreEntryProps {
  item: ContentItem
  speak: GrandLivreSpeakFn
  onAnnounce?: (text: string) => void
}

function GrandLivreEntry({ item, speak, onAnnounce }: GrandLivreEntryProps) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const isBookPage = item.level >= BOOK_PAGE_MIN_LEVEL
  const showEmoji = !isBookPage && Boolean(item.emoji)

  async function handlePress() {
    // Défense contre le double-tap qui empilerait deux lectures simultanées
    // dans la file d'attente voix : un item déjà en train d'être énoncé
    // n'accepte pas une nouvelle pression tant que la précédente n'est pas
    // résolue (le bouton natif `disabled` fait déjà cette garde ; ce return
    // reste une deuxième ligne de défense explicite, même précédent que
    // WorldMap `pressRegion`).
    if (isSpeaking) return
    setIsSpeaking(true)
    onAnnounce?.(itemTouchNarration())
    try {
      await speak(item.text)
    } catch {
      // La voix peut échouer (watchdog A2, voir SPEC §3) : ne jamais bloquer
      // la galerie ni faire planter l'écran pour autant.
    } finally {
      setIsSpeaking(false)
    }
  }

  return (
    <div
      className={`grand-livre__item ${isBookPage ? 'grand-livre__item--book-page' : 'grand-livre__item--aided'}`}
      data-testid={`grand-livre-item-${item.id}`}
      data-level={item.level}
      data-book-page={isBookPage}
    >
      <GrandLivreButton
        label={`Réécouter : ${item.text}`}
        onPress={() => void handlePress()}
        disabled={isSpeaking}
        testId={`grand-livre-listen-${item.id}`}
        className="grand-livre__listen"
      >
        <ListenGlyph />
      </GrandLivreButton>

      {showEmoji && (
        <span
          className="grand-livre__emoji"
          data-testid={`grand-livre-emoji-${item.id}`}
          aria-hidden="true"
          style={{ fontSize: 40 }}
        >
          {item.emoji}
        </span>
      )}

      {/* Texte simple, un seul nœud — jamais découpé en graphèmes/spans
          surlignés ici, quel que soit le niveau : la décomposition
          pédagogique (PostSuccessReplay) est une mécanique de défi (C1), pas
          une affordance du Grand Livre. La distinction "page de livre" du
          niveau 8 tient à l'absence d'emoji et à une taille plus grande. */}
      <p
        className="grand-livre__text"
        data-testid={`grand-livre-text-${item.id}`}
        style={{
          fontSize: isBookPage ? 52 : 40,
          margin: 0,
        }}
      >
        {item.text}
      </p>
    </div>
  )
}

export function GrandLivre({ grandLivreItemIds, resolveItem, speak, onAnnounce }: GrandLivreProps) {
  const resolvedItems = useMemo(
    () =>
      grandLivreItemIds
        .map((id) => resolveSafely(id, resolveItem))
        .filter((item): item is ContentItem => item !== null),
    [grandLivreItemIds, resolveItem],
  )

  // Narration d'apparition de l'écran : une fois au montage, jamais recalculée
  // sur un simple changement de props (même contrat que WorldMap/A4).
  useEffect(() => {
    onAnnounce?.(screenIntroNarration(grandLivreItemIds.length))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (resolvedItems.length === 0) {
    return (
      <div className="grand-livre grand-livre--empty" data-testid="grand-livre">
        <div data-testid="grand-livre-empty" className="grand-livre__empty">
          <EmptyBookGlyph />
        </div>
      </div>
    )
  }

  return (
    <div className="grand-livre" data-testid="grand-livre">
      <div
        role="list"
        aria-label="Grand Livre : mots, phrases et textes maîtrisés"
        className="grand-livre__gallery"
        data-testid="grand-livre-gallery"
      >
        {resolvedItems.map((item) => (
          <div role="listitem" key={item.id}>
            <GrandLivreEntry item={item} speak={speak} onAnnounce={onAnnounce} />
          </div>
        ))}
      </div>
    </div>
  )
}
