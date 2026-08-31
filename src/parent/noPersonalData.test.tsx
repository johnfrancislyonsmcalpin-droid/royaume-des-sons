// Gate G3 (leaf-F1.md) : aucun champ de saisie de nom, âge ou photo n'existe
// où que ce soit dans src/parent ; l'export JSON ne contient que le SaveFile
// (aucune donnée d'identification). Voir CLAUDE.md règle #6.
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SCHEMA_VERSION } from '../types'
import type { SaveFile } from '../types'
import { exportSaveFile } from '../save'
import { ParentDashboard } from './Dashboard'
import { ParentSettings } from './Settings'

afterEach(() => {
  cleanup()
})

// Scan statique du code source de la leaf, sans dépendre des types Node
// (tsconfig.app.json n'inclut que "vite/client", pas "node") : `import.meta.glob`
// de Vite charge le texte brut de chaque fichier .ts/.tsx de src/parent (hors
// tests), disponible aussi bien en build qu'en environnement vitest/jsdom.
const sourceModules = import.meta.glob<string>('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

function listSourceFiles(): Array<{ file: string; content: string }> {
  return Object.entries(sourceModules)
    .filter(([file]) => !/\.test\.tsx?$/.test(file))
    .map(([file, content]) => ({ file, content }))
}

// Formes de mots interdites (avec limites de mot) : nom/prénom d'enfant, âge,
// photo. Volontairement insensible à la casse et aux accents alternatifs.
const FORBIDDEN_WORD_RE = /\b(nom de l'enfant|prénom|prenom|âge|date de naissance|photo)\b/i

function makeSave(): SaveFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    mastery: { skills: {}, reviewQueue: [] },
    avatar: { avatarId: 'comete', companionId: 'luciole', cosmetics: [], xp: 0, coins: 0 },
    progress: {
      currentLevel: 2,
      currentRegionId: 'foret-des-premieres-consonnes',
      unlockedRegionIds: ['clairiere-des-voyelles', 'foret-des-premieres-consonnes'],
      grandLivreItemIds: [],
      helpAdultCount: 1,
      sessionMinutesByDay: { '2026-08-20': 9 },
    },
    currentQuestState: null,
    lastSavedAt: '2026-08-20T10:00:00.000Z',
  }
}

describe('src/parent — aucune donnée personnelle (gate G3)', () => {
  it("aucun fichier source de src/parent ne contient de vocabulaire de collecte d'identité (nom/prénom/âge/date de naissance/photo)", () => {
    const files = listSourceFiles()
    expect(files.length).toBeGreaterThan(0)
    for (const { file, content } of files) {
      expect(content, `${file} contient un mot interdit`).not.toMatch(FORBIDDEN_WORD_RE)
    }
  })

  it('le tableau de bord rendu ne contient aucun champ de saisie de type texte/nombre/fichier/date', () => {
    render(<ParentDashboard save={makeSave()} />)
    const inputs = document.querySelectorAll('input')
    for (const input of inputs) {
      expect(['text', 'number', 'file', 'date']).not.toContain(input.type)
    }
  })

  it("les réglages rendus n'exposent qu'un input de type range (vitesse voix) ou checkbox, jamais texte/nombre/fichier/date", () => {
    render(<ParentSettings />)
    const inputs = document.querySelectorAll('input')
    expect(inputs.length).toBeGreaterThan(0)
    for (const input of inputs) {
      expect(['range', 'checkbox']).toContain(input.type)
    }
  })

  it('aucun bouton ou champ visible ne demande un nom, un âge ou une photo', () => {
    render(<ParentDashboard save={makeSave()} />)
    render(<ParentSettings />)
    expect(screen.queryByText(FORBIDDEN_WORD_RE)).not.toBeInTheDocument()
  })

  it('exportSaveFile ne sérialise que les champs du contrat SaveFile figé, aucune donnée additionnelle', () => {
    const json = exportSaveFile(makeSave())
    const parsed = JSON.parse(json) as Record<string, unknown>
    expect(Object.keys(parsed).sort()).toEqual(
      ['avatar', 'currentQuestState', 'lastSavedAt', 'mastery', 'progress', 'schemaVersion'].sort(),
    )
    expect(json).not.toMatch(FORBIDDEN_WORD_RE)
  })
})
