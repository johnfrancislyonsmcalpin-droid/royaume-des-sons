import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ContentItem } from '../../types'
import { GrandLivre } from './GrandLivre'
// Import brut via Vite plutôt que node:fs (même précédent que
// src/app/fullscreen.test.tsx) : permet de vérifier par une recherche
// textuelle que GrandLivre.tsx ne dépend d'aucun module de
// maîtrise/décroissance, sans dépendre des types Node absents de
// tsconfig.app.json.
import grandLivreSource from './GrandLivre.tsx?raw'

function makeItem(overrides: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'item-1',
    kind: 'word',
    level: 3,
    text: 'lune',
    graphemeIds: ['l', 'u', 'n', 'e-muet'],
    emoji: '🌙',
    skillIds: ['L3-fusion-cv'],
    ...overrides,
  }
}

function makeResolver(items: ContentItem[]): (id: string) => ContentItem {
  const byId = new Map(items.map((item) => [item.id, item]))
  return (id: string) => {
    const item = byId.get(id)
    if (!item) throw new Error(`id inconnu : ${id}`)
    return item
  }
}

describe('GrandLivre — affichage et réécoute (G1)', () => {
  it('affiche exactement les items dont l\'id figure dans grandLivreItemIds, dans l\'ordre reçu', () => {
    const items = [
      makeItem({ id: 'a', text: 'lune' }),
      makeItem({ id: 'b', text: 'chat', emoji: '🐱' }),
      makeItem({ id: 'c', text: 'fusée', emoji: '🚀' }),
    ]
    render(
      <GrandLivre
        grandLivreItemIds={['a', 'b', 'c']}
        resolveItem={makeResolver(items)}
        speak={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const gallery = screen.getByTestId('grand-livre-gallery')
    const rendered = within(gallery).getAllByRole('listitem')
    expect(rendered).toHaveLength(3)
    expect(screen.getByTestId('grand-livre-text-a')).toHaveTextContent('lune')
    expect(screen.getByTestId('grand-livre-text-b')).toHaveTextContent('chat')
    expect(screen.getByTestId('grand-livre-text-c')).toHaveTextContent('fusée')
  })

  it('un item est réécouté via speak() au toucher du bouton dédié (≥64×64 px CSS)', async () => {
    const user = userEvent.setup()
    const items = [makeItem({ id: 'a', text: 'lune' })]
    const speak = vi.fn().mockResolvedValue(undefined)
    render(<GrandLivre grandLivreItemIds={['a']} resolveItem={makeResolver(items)} speak={speak} />)

    const button = screen.getByTestId('grand-livre-listen-a')
    const style = (button as HTMLElement).style
    expect(parseInt(style.minWidth, 10)).toBeGreaterThanOrEqual(64)
    expect(parseInt(style.minHeight, 10)).toBeGreaterThanOrEqual(64)

    await user.click(button)
    expect(speak).toHaveBeenCalledWith('lune')
  })

  it('un même item peut être réécouté plusieurs fois de suite', async () => {
    const user = userEvent.setup()
    const items = [makeItem({ id: 'a', text: 'lune' })]
    const speak = vi.fn().mockResolvedValue(undefined)
    render(<GrandLivre grandLivreItemIds={['a']} resolveItem={makeResolver(items)} speak={speak} />)

    const button = screen.getByTestId('grand-livre-listen-a')
    await user.click(button)
    await user.click(button)
    await user.click(button)
    expect(speak).toHaveBeenCalledTimes(3)
  })

  it('annonce un aperçu de l\'écran au montage', () => {
    const items = [makeItem({ id: 'a' })]
    const onAnnounce = vi.fn()
    render(
      <GrandLivre
        grandLivreItemIds={['a']}
        resolveItem={makeResolver(items)}
        speak={vi.fn().mockResolvedValue(undefined)}
        onAnnounce={onAnnounce}
      />,
    )
    expect(onAnnounce).toHaveBeenCalled()
    expect(typeof onAnnounce.mock.calls[0][0]).toBe('string')
    expect((onAnnounce.mock.calls[0][0] as string).length).toBeGreaterThan(0)
  })
})

describe('GrandLivre — niveau 8 : page de livre sans aide ni surlignage (G2)', () => {
  it('un item de niveau >= 8 affiche le texte SANS emoji et sans décomposition graphémique visible', () => {
    const items = [
      makeItem({
        id: 'phrase-8',
        kind: 'sentence',
        level: 8,
        text: 'Le chat dort sur le tapis.',
        emoji: undefined,
        graphemeIds: ['ch', 'a', 't', 'o', 'r', 's'],
      }),
    ]
    render(
      <GrandLivre
        grandLivreItemIds={['phrase-8']}
        resolveItem={makeResolver(items)}
        speak={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    // Le texte apparaît tel quel, en un seul nœud.
    const text = screen.getByTestId('grand-livre-text-phrase-8')
    expect(text).toHaveTextContent('Le chat dort sur le tapis.')

    // Aucun emoji affiché pour un item "page de livre".
    expect(screen.queryByTestId('grand-livre-emoji-phrase-8')).not.toBeInTheDocument()

    // Aucune décomposition graphémique (span par graphème / surlignage) : le
    // texte n'est jamais éclaté en plusieurs éléments enfants.
    expect(text.children).toHaveLength(0)
    expect(text.querySelector('[data-testid^="replay-grapheme"]')).toBeNull()

    const container = screen.getByTestId('grand-livre-item-phrase-8')
    expect(container).toHaveAttribute('data-book-page', 'true')
  })

  it('un item de niveau < 8 peut afficher l\'emoji associé en plus du texte', () => {
    const items = [makeItem({ id: 'mot-3', level: 3, text: 'lune', emoji: '🌙' })]
    render(
      <GrandLivre
        grandLivreItemIds={['mot-3']}
        resolveItem={makeResolver(items)}
        speak={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.getByTestId('grand-livre-emoji-mot-3')).toHaveTextContent('🌙')
    const container = screen.getByTestId('grand-livre-item-mot-3')
    expect(container).toHaveAttribute('data-book-page', 'false')
  })

  it('la taille de texte d\'un item niveau >= 8 est strictement plus grande que celle d\'un item niveau < 8 (distinction visuelle, jamais la seule couleur)', () => {
    const items = [
      makeItem({ id: 'bas', level: 2, text: 'ami', emoji: '🙂' }),
      makeItem({ id: 'haut', level: 9, text: 'Le loup a faim.', emoji: undefined, kind: 'sentence' }),
    ]
    render(
      <GrandLivre
        grandLivreItemIds={['bas', 'haut']}
        resolveItem={makeResolver(items)}
        speak={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    const lowSize = parseInt(screen.getByTestId('grand-livre-text-bas').style.fontSize, 10)
    const highSize = parseInt(screen.getByTestId('grand-livre-text-haut').style.fontSize, 10)
    expect(highSize).toBeGreaterThan(lowSize)
    expect(lowSize).toBeGreaterThanOrEqual(36) // taille minimale lisible, SPEC §3
    expect(highSize).toBeGreaterThanOrEqual(36)
  })

  it('un texte de niveau 10 (boss) suit la même règle "page de livre" qu\'un niveau 8', () => {
    const items = [
      makeItem({
        id: 'texte-10',
        kind: 'text',
        level: 10,
        text: 'Le loup a faim.\nIl cherche un ami.',
        emoji: undefined,
      }),
    ]
    render(
      <GrandLivre
        grandLivreItemIds={['texte-10']}
        resolveItem={makeResolver(items)}
        speak={vi.fn().mockResolvedValue(undefined)}
      />,
    )
    expect(screen.queryByTestId('grand-livre-emoji-texte-10')).not.toBeInTheDocument()
    expect(screen.getByTestId('grand-livre-item-texte-10')).toHaveAttribute('data-book-page', 'true')
  })
})

describe('GrandLivre — jamais retire un item (G3)', () => {
  it('GrandLivre.tsx n\'importe aucun module de maîtrise/décroissance : aucun mécanisme de filtrage n\'est même possible', () => {
    // Recherche des lignes `import ... from '...'` réelles, pas des mentions
    // en commentaire (ce fichier documente volontairement, en prose, qu'il
    // n'importe PAS ces modules — un simple `.toMatch` sur le texte brut
    // matcherait donc cette phrase elle-même).
    const importLines = grandLivreSource
      .split('\n')
      .filter((line) => /^\s*import\b/.test(line))
    expect(importLines.some((line) => /engine\/(mastery|decay)/.test(line))).toBe(false)
    expect(grandLivreSource).not.toMatch(/onRemove|onForget|onDecay|removeItem|filterMastered/i)
  })

  it('les props de GrandLivre n\'exposent aucune fonction/callback de retrait', () => {
    const items = [makeItem({ id: 'a' })]
    // On appelle le composant avec exactement les 4 props attendues ; en
    // fournir davantage (ex. onRemove) n'aurait aucun effet observable —
    // preuve par le comportement, pas seulement par lecture du type.
    const props = {
      grandLivreItemIds: ['a'],
      resolveItem: makeResolver(items),
      speak: vi.fn().mockResolvedValue(undefined),
    }
    expect(Object.keys(props)).toEqual(['grandLivreItemIds', 'resolveItem', 'speak'])
  })

  it('un item reste affiché après plusieurs réécoutes successives (aucun effet de bord ne le retire de la galerie)', async () => {
    const user = userEvent.setup()
    const items = [makeItem({ id: 'a', text: 'lune' }), makeItem({ id: 'b', text: 'chat', emoji: '🐱' })]
    const speak = vi.fn().mockResolvedValue(undefined)
    render(<GrandLivre grandLivreItemIds={['a', 'b']} resolveItem={makeResolver(items)} speak={speak} />)

    expect(within(screen.getByTestId('grand-livre-gallery')).getAllByRole('listitem')).toHaveLength(2)

    await user.click(screen.getByTestId('grand-livre-listen-a'))
    await user.click(screen.getByTestId('grand-livre-listen-a'))
    await user.click(screen.getByTestId('grand-livre-listen-b'))

    expect(within(screen.getByTestId('grand-livre-gallery')).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByTestId('grand-livre-item-a')).toBeInTheDocument()
    expect(screen.getByTestId('grand-livre-item-b')).toBeInTheDocument()
  })

  it('un item reste affiché même quand speak() rejette (échec voix, SPEC §3 watchdog) : jamais retiré ni de crash', async () => {
    const user = userEvent.setup()
    const items = [makeItem({ id: 'a', text: 'lune' })]
    const speak = vi.fn().mockRejectedValue(new Error('voix muette'))
    render(<GrandLivre grandLivreItemIds={['a']} resolveItem={makeResolver(items)} speak={speak} />)

    await user.click(screen.getByTestId('grand-livre-listen-a'))
    expect(screen.getByTestId('grand-livre-item-a')).toBeInTheDocument()
  })

  it('re-rendre avec la même liste (simulant une décroissance ailleurs dans le moteur qui ne toucherait pas grandLivreItemIds) laisse tous les items en place', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b', text: 'chat' }), makeItem({ id: 'c', text: 'fusée' })]
    const resolveItem = makeResolver(items)
    const speak = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(
      <GrandLivre grandLivreItemIds={['a', 'b', 'c']} resolveItem={resolveItem} speak={speak} />,
    )
    expect(within(screen.getByTestId('grand-livre-gallery')).getAllByRole('listitem')).toHaveLength(3)

    // Même liste, nouveau rendu : GrandLivre ne raccourcit jamais la liste de
    // lui-même. Seul l'appelant (hors périmètre E4) déciderait de changer
    // grandLivreItemIds ; ici il ne change pas.
    rerender(<GrandLivre grandLivreItemIds={['a', 'b', 'c']} resolveItem={resolveItem} speak={speak} />)
    expect(within(screen.getByTestId('grand-livre-gallery')).getAllByRole('listitem')).toHaveLength(3)
  })
})

describe('GrandLivre — cas limites (chasse aux défauts, passe 3)', () => {
  it('une liste vide ne plante pas et affiche un état vide narré, sans galerie', () => {
    const onAnnounce = vi.fn()
    expect(() =>
      render(
        <GrandLivre
          grandLivreItemIds={[]}
          resolveItem={() => {
            throw new Error('ne devrait jamais être appelé pour une liste vide')
          }}
          speak={vi.fn().mockResolvedValue(undefined)}
          onAnnounce={onAnnounce}
        />,
      ),
    ).not.toThrow()
    expect(screen.getByTestId('grand-livre-empty')).toBeInTheDocument()
    expect(screen.queryByTestId('grand-livre-gallery')).not.toBeInTheDocument()
    expect(onAnnounce).toHaveBeenCalled()
  })

  it('un id qui ne résout à aucun ContentItem (resolveItem lève) est ignoré silencieusement, sans crash et sans casser les autres items', () => {
    const items = [makeItem({ id: 'valide', text: 'lune' })]
    const resolveItem = (id: string) => {
      if (id === 'fantome') throw new Error('id inconnu')
      return makeResolver(items)(id)
    }
    expect(() =>
      render(
        <GrandLivre
          grandLivreItemIds={['fantome', 'valide']}
          resolveItem={resolveItem}
          speak={vi.fn().mockResolvedValue(undefined)}
        />,
      ),
    ).not.toThrow()
    expect(within(screen.getByTestId('grand-livre-gallery')).getAllByRole('listitem')).toHaveLength(1)
    expect(screen.getByTestId('grand-livre-text-valide')).toHaveTextContent('lune')
  })

  it('un item résolu sans texte exploitable (chaîne vide) est ignoré silencieusement plutôt qu\'affiché cassé', () => {
    const resolveItem = () => makeItem({ id: 'casse', text: '' })
    expect(() =>
      render(
        <GrandLivre
          grandLivreItemIds={['casse']}
          resolveItem={resolveItem}
          speak={vi.fn().mockResolvedValue(undefined)}
        />,
      ),
    ).not.toThrow()
    expect(screen.getByTestId('grand-livre-empty')).toBeInTheDocument()
  })

  it('un double-tap rapide sur le même bouton pendant que speak() est en cours ne relance pas un second appel avant résolution', async () => {
    const items = [makeItem({ id: 'a', text: 'lune' })]
    let resolveSpeak: (() => void) | undefined
    const speak = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSpeak = resolve
        }),
    )
    const user = userEvent.setup()
    render(<GrandLivre grandLivreItemIds={['a']} resolveItem={makeResolver(items)} speak={speak} />)

    const button = screen.getByTestId('grand-livre-listen-a')
    await user.click(button)
    expect(button).toBeDisabled()
    await user.click(button) // sans effet : bouton désactivé pendant la lecture en cours
    expect(speak).toHaveBeenCalledTimes(1)

    resolveSpeak?.()
    await vi.waitFor(() => expect(button).not.toBeDisabled())
  })
})
