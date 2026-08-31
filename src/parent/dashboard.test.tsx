// Gate G2 (leaf-F1.md) : le tableau de bord affiche niveau/région courants,
// maîtrise par compétence, les 10 erreurs les plus fréquentes, le temps de
// jeu par jour sur 14 jours, le compteur "va chercher un grand", et la date
// de dernière sauvegarde, tous dérivés de SaveFile réel.
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SCHEMA_VERSION } from '../types'
import type { SaveFile, SkillMastery } from '../types'
import {
  computeDailyMinutesRows,
  computeFrequentErrorRows,
  computeSkillMasteryRows,
  getHelpAdultCount,
  getLastSavedAt,
  summarizeCurrentPosition,
} from './dashboardData'
import { ParentDashboard } from './Dashboard'

afterEach(() => {
  cleanup()
})

function makeSkillMastery(skillId: string, last10: boolean[], masteredAt: string | null = null): SkillMastery {
  return { skillId, last10, masteredAt, decayedAt: null }
}

function makeSave(overrides: Partial<SaveFile> = {}): SaveFile {
  return {
    schemaVersion: SCHEMA_VERSION,
    mastery: { skills: {}, reviewQueue: [] },
    avatar: { avatarId: 'comete', companionId: 'luciole', cosmetics: [], xp: 0, coins: 0 },
    progress: {
      currentLevel: 1,
      currentRegionId: 'clairiere-des-voyelles',
      unlockedRegionIds: ['clairiere-des-voyelles'],
      grandLivreItemIds: [],
      helpAdultCount: 0,
      sessionMinutesByDay: {},
    },
    currentQuestState: null,
    lastSavedAt: '2026-08-20T10:00:00.000Z',
    ...overrides,
  }
}

describe('dashboardData (dérivations pures)', () => {
  it('summarizeCurrentPosition résout le libellé de région à partir de uiText', () => {
    const save = makeSave()
    const position = summarizeCurrentPosition(save)
    expect(position.level).toBe(1)
    expect(position.regionId).toBe('clairiere-des-voyelles')
    expect(position.regionLabel).toContain('Voyelles')
  })

  it('computeSkillMasteryRows inclut toutes les compétences du curriculum, même non pratiquées', () => {
    const save = makeSave({
      mastery: {
        skills: { 'L1-voyelles': makeSkillMastery('L1-voyelles', [true, true, true, true, true, true, true, true, false, false]) },
        reviewQueue: [],
      },
    })
    const rows = computeSkillMasteryRows(save)
    expect(rows.length).toBeGreaterThan(1)
    const practiced = rows.find((r) => r.skillId === 'L1-voyelles')
    expect(practiced?.attemptCount).toBe(10)
    expect(practiced?.successCount).toBe(8)
    expect(practiced?.percent).toBe(80)
    expect(practiced?.status).toBe('mastered')

    const untouched = rows.find((r) => r.skillId !== 'L1-voyelles')
    expect(untouched?.attemptCount).toBe(0)
    expect(untouched?.status).toBe('not-started')
  })

  it('computeFrequentErrorRows classe les compétences par échecs décroissants et retourne au plus 10 lignes', () => {
    const save = makeSave({
      mastery: {
        skills: {
          'L1-voyelles': makeSkillMastery('L1-voyelles', [true, false, false, false]),
          'L2-consonnes': makeSkillMastery('L2-consonnes', [true, true, false]),
        },
        reviewQueue: [],
      },
    })
    const rows = computeFrequentErrorRows(save)
    expect(rows.length).toBeLessThanOrEqual(10)
    expect(rows[0].skillId).toBe('L1-voyelles')
    expect(rows[0].errorCount).toBe(3)
    expect(rows[1].skillId).toBe('L2-consonnes')
    expect(rows[1].errorCount).toBe(1)
  })

  it('computeFrequentErrorRows retourne une liste vide sans donnée exploitable (aucune tentative)', () => {
    const rows = computeFrequentErrorRows(makeSave())
    expect(rows).toEqual([])
  })

  it('computeDailyMinutesRows trie chronologiquement et borne à 14 jours', () => {
    const sessionMinutesByDay: Record<string, number> = {}
    for (let i = 0; i < 20; i += 1) {
      sessionMinutesByDay[`2026-08-${String(i + 1).padStart(2, '0')}`] = i
    }
    const save = makeSave({ progress: { ...makeSave().progress, sessionMinutesByDay } })
    const rows = computeDailyMinutesRows(save)
    expect(rows.length).toBe(14)
    expect(rows[0].date).toBe('2026-08-07')
    expect(rows[13].date).toBe('2026-08-20')
  })

  it('getHelpAdultCount et getLastSavedAt lisent directement progress/save', () => {
    const save = makeSave({ progress: { ...makeSave().progress, helpAdultCount: 4 } })
    expect(getHelpAdultCount(save)).toBe(4)
    expect(getLastSavedAt(save)).toBe('2026-08-20T10:00:00.000Z')
  })
})

describe('ParentDashboard (rendu, gate G2)', () => {
  it('affiche niveau, région, maîtrise, temps de jeu, aide adulte et date de sauvegarde à partir de la prop save', () => {
    const save = makeSave({
      mastery: {
        skills: { 'L1-voyelles': makeSkillMastery('L1-voyelles', [true, true, true, true, true, true, true, true, true, true], '2026-08-19T00:00:00.000Z') },
        reviewQueue: [],
      },
      progress: {
        currentLevel: 3,
        currentRegionId: 'pont-des-syllabes',
        unlockedRegionIds: ['clairiere-des-voyelles', 'pont-des-syllabes'],
        grandLivreItemIds: [],
        helpAdultCount: 7,
        sessionMinutesByDay: { '2026-08-20': 12 },
      },
    })

    render(<ParentDashboard save={save} />)

    expect(screen.getByTestId('parent-dashboard-level')).toHaveTextContent('3')
    expect(screen.getByTestId('parent-dashboard-region')).toHaveTextContent('Syllabes')
    expect(screen.getByTestId('parent-skill-row-L1-voyelles')).toHaveTextContent('100%')
    expect(screen.getByTestId('parent-dashboard-help-count')).toHaveTextContent('7')
    expect(screen.getByTestId('parent-time-row-2026-08-20')).toBeInTheDocument()
    expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument()
  })

  it("affiche un état vide explicite pour les erreurs fréquentes quand aucune donnée n'est exploitable", () => {
    render(<ParentDashboard save={makeSave()} />)
    expect(screen.getByTestId('parent-dashboard-errors-empty')).toBeInTheDocument()
  })

  it('affiche la liste des 10 erreurs les plus fréquentes quand des données existent', () => {
    const save = makeSave({
      mastery: {
        skills: { 'L1-voyelles': makeSkillMastery('L1-voyelles', [false, false, true]) },
        reviewQueue: [],
      },
    })
    render(<ParentDashboard save={save} />)
    expect(screen.getByTestId('parent-error-row-L1-voyelles')).toBeInTheDocument()
  })
})
