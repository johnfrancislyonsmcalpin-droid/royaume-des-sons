// Gate leaf-A1 G2 : la racine applique touch-action: manipulation,
// user-select: none, overscroll-behavior: none, et désactive le zoom par
// double-tap.
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { AppShell } from './AppShell'
import { touchSafeStyle } from './touchSafety'

afterEach(cleanup)

describe('touchSafeStyle', () => {
  it('déclare touch-action: manipulation (mécanisme de désactivation du zoom par double-tap)', () => {
    expect(touchSafeStyle.touchAction).toBe('manipulation')
  })

  it('désactive la sélection de texte', () => {
    expect(touchSafeStyle.userSelect).toBe('none')
    expect(touchSafeStyle.WebkitUserSelect).toBe('none')
  })

  it('désactive le rebond de défilement / pull-to-refresh', () => {
    expect(touchSafeStyle.overscrollBehavior).toBe('none')
  })
})

describe('AppShell racine', () => {
  it('applique les styles de sécurité tactile directement sur son élément racine', () => {
    const { container } = render(<AppShell />)
    const root = container.querySelector('.app-shell') as HTMLElement | null
    expect(root).not.toBeNull()
    expect(root?.style.touchAction).toBe('manipulation')
    expect(root?.style.userSelect).toBe('none')
    expect(root?.style.overscrollBehavior).toBe('none')
  })
})
