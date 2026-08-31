import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AvatarSelect } from './AvatarSelect'
import { AVATARS, COMPANIONS } from './avatarData'

// Mots bannis dans les libellés d'avatar/compagnon : SPEC §4 exige un avatar
// "non genré". On vérifie ici qu'aucun libellé ne contient de vocabulaire
// explicitement genré (garçon/fille/homme/femme/prince/princesse...).
const GENDERED_WORDS = [
  'garçon',
  'garcon',
  'fille',
  'homme',
  'femme',
  'prince',
  'princesse',
  'monsieur',
  'madame',
  'il ',
  'elle ',
]

describe('AvatarSelect', () => {
  it('propose exactement 4 avatars', () => {
    expect(AVATARS).toHaveLength(4)
    render(<AvatarSelect onSelect={vi.fn()} />)
    const options = screen.getByTestId('avatar-options')
    expect(options.querySelectorAll('button')).toHaveLength(4)
  })

  it('propose au moins 2 compagnons magiques', () => {
    expect(COMPANIONS.length).toBeGreaterThanOrEqual(2)
    render(<AvatarSelect onSelect={vi.fn()} />)
    const options = screen.getByTestId('companion-options')
    expect(options.querySelectorAll('button').length).toBe(COMPANIONS.length)
  })

  it("n'appelle pas onSelect tant que le choix n'est pas confirmé", async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<AvatarSelect onSelect={onSelect} />)

    await user.click(screen.getByTestId(AVATARS[0].id))
    expect(onSelect).not.toHaveBeenCalled()

    await user.click(screen.getByTestId(COMPANIONS[0].id))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('le bouton de confirmation reste désactivé tant que avatar ET compagnon ne sont pas choisis', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<AvatarSelect onSelect={onSelect} />)

    const confirm = screen.getByTestId('avatar-confirm')
    expect(confirm).toBeDisabled()

    await user.click(screen.getByTestId(AVATARS[0].id))
    expect(confirm).toBeDisabled()

    await user.click(confirm)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('écrit avatarId et companionId (via onSelect) seulement après confirmation explicite', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<AvatarSelect onSelect={onSelect} />)

    await user.click(screen.getByTestId(AVATARS[2].id))
    await user.click(screen.getByTestId(COMPANIONS[1].id))
    expect(onSelect).not.toHaveBeenCalled()

    await user.click(screen.getByTestId('avatar-confirm'))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith(AVATARS[2].id, COMPANIONS[1].id)
  })

  it('permet de changer de sélection avant confirmation (dernier tap gagne)', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<AvatarSelect onSelect={onSelect} />)

    await user.click(screen.getByTestId(AVATARS[0].id))
    await user.click(screen.getByTestId(AVATARS[1].id))
    await user.click(screen.getByTestId(COMPANIONS[0].id))
    await user.click(screen.getByTestId('avatar-confirm'))

    expect(onSelect).toHaveBeenCalledWith(AVATARS[1].id, COMPANIONS[0].id)
  })

  it('toutes les zones tactiles (avatars, compagnons, confirmation) mesurent au moins 64x64 px', () => {
    render(<AvatarSelect onSelect={vi.fn()} />)
    const buttons = document.querySelectorAll('button.touch-button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      const style = (button as HTMLElement).style
      expect(parseInt(style.minWidth, 10)).toBeGreaterThanOrEqual(64)
      expect(parseInt(style.minHeight, 10)).toBeGreaterThanOrEqual(64)
    }
  })

  it('aucun libellé d\'avatar ou de compagnon ne contient de vocabulaire genré', () => {
    const allLabels = [...AVATARS, ...COMPANIONS].map((option) => option.label.toLowerCase())
    for (const label of allLabels) {
      for (const bannedWord of GENDERED_WORDS) {
        expect(label.includes(bannedWord)).toBe(false)
      }
    }
  })

  it('respecte une sélection initiale fournie (reprise depuis une sauvegarde)', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(
      <AvatarSelect
        initialAvatarId={AVATARS[3].id}
        initialCompanionId={COMPANIONS[2].id}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByTestId('avatar-confirm'))
    expect(onSelect).toHaveBeenCalledWith(AVATARS[3].id, COMPANIONS[2].id)
  })
})
