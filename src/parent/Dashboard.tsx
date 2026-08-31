// Tableau de bord parent (SPEC §9, gate G2) : dérivé d'un SaveFile réel, prop
// injectée par défaut lue via `loadSaveFile()`. Composant de LECTURE seule :
// il n'écrit jamais dans la sauvegarde (voir Settings.tsx pour les actions
// qui écrivent : export/import/réinitialisation).
import { loadSaveFile } from '../save'
import type { SaveFile } from '../types'
import {
  computeDailyMinutesRows,
  computeFrequentErrorRows,
  computeSkillMasteryRows,
  getHelpAdultCount,
  getLastSavedAt,
  summarizeCurrentPosition,
} from './dashboardData'
import { ChartIcon } from './icons'
import { PARENT_SKILL_STATUS_LABEL } from './content/parentContent'

export interface ParentDashboardProps {
  /** SaveFile à afficher ; par défaut lu via loadSaveFile() (source réelle en jeu). */
  save?: SaveFile
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('fr-CA')
}

export function ParentDashboard({ save: saveProp }: ParentDashboardProps) {
  const save = saveProp ?? loadSaveFile()

  const position = summarizeCurrentPosition(save)
  const skillRows = computeSkillMasteryRows(save)
  const errorRows = computeFrequentErrorRows(save)
  const dailyMinutes = computeDailyMinutesRows(save)
  const helpAdultCount = getHelpAdultCount(save)
  const lastSavedAt = getLastSavedAt(save)
  const maxMinutes = Math.max(1, ...dailyMinutes.map((row) => row.minutes))

  return (
    <section data-testid="parent-dashboard" aria-label="Tableau de bord">
      <div data-testid="parent-dashboard-position" style={sectionStyle}>
        <h2 style={headingStyle}>Progression actuelle</h2>
        <p>
          Niveau <strong data-testid="parent-dashboard-level">{position.level}</strong> —{' '}
          <span data-testid="parent-dashboard-region">{position.regionLabel}</span>
        </p>
      </div>

      <div data-testid="parent-dashboard-mastery" style={sectionStyle}>
        <h2 style={headingStyle}>Maîtrise par compétence</h2>
        <ul style={listStyle}>
          {skillRows.map((row) => (
            <li key={row.skillId} data-testid={`parent-skill-row-${row.skillId}`}>
              <span>{row.label}</span> — <span>{row.percent}%</span> —{' '}
              <span data-testid={`parent-skill-status-${row.skillId}`}>{PARENT_SKILL_STATUS_LABEL[row.status]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div data-testid="parent-dashboard-errors" style={sectionStyle}>
        <h2 style={headingStyle}>Compétences les plus en difficulté</h2>
        {errorRows.length === 0 ? (
          <p data-testid="parent-dashboard-errors-empty">
            Aucune donnée d'erreur exploitable pour l'instant : le jeu ne conserve que la maîtrise
            agrégée par compétence, pas un journal détaillé de chaque réponse.
          </p>
        ) : (
          <ol data-testid="parent-dashboard-errors-list" style={listStyle}>
            {errorRows.map((row) => (
              <li key={row.skillId} data-testid={`parent-error-row-${row.skillId}`}>
                {row.label} — {row.errorCount} échec(s) sur {row.attemptCount} réponse(s) récentes
              </li>
            ))}
          </ol>
        )}
      </div>

      <div data-testid="parent-dashboard-time" style={sectionStyle}>
        <h2 style={headingStyle}>
          <span aria-hidden="true" style={{ marginRight: 6 }}>
            <ChartIcon />
          </span>
          Temps de jeu (14 derniers jours)
        </h2>
        {dailyMinutes.length === 0 ? (
          <p data-testid="parent-dashboard-time-empty">Aucune session enregistrée pour l'instant.</p>
        ) : (
          <ul data-testid="parent-dashboard-time-list" style={{ ...listStyle, display: 'flex', gap: 4, alignItems: 'flex-end' }}>
            {dailyMinutes.map((row) => (
              <li
                key={row.date}
                data-testid={`parent-time-row-${row.date}`}
                title={`${row.date} : ${row.minutes} min`}
                style={{
                  listStyle: 'none',
                  width: 16,
                  height: Math.max(4, (row.minutes / maxMinutes) * 80),
                  background: '#5a8fd6',
                }}
              />
            ))}
          </ul>
        )}
      </div>

      <div data-testid="parent-dashboard-help" style={sectionStyle}>
        <h2 style={headingStyle}>Aides « Va chercher un grand »</h2>
        <p data-testid="parent-dashboard-help-count">{helpAdultCount}</p>
      </div>

      <div data-testid="parent-dashboard-saved-at" style={sectionStyle}>
        <h2 style={headingStyle}>Dernière sauvegarde</h2>
        <p>{formatDate(lastSavedAt)}</p>
      </div>
    </section>
  )
}

const sectionStyle = { marginBottom: 24 }
const headingStyle = { fontSize: 18, marginBottom: 8 }
const listStyle = { margin: 0, paddingLeft: 20 }
