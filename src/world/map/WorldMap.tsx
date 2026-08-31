// Carte du monde — Le Royaume des Sons (leaf E1).
//
// Affiche les 10 régions du curriculum (leaf B1, VERIFIED) dans l'ordre exact
// des niveaux, chacune une zone tactile ≥64×64px (TapButton.tsx, doublure
// locale de src/challenges/shared/TapTarget.tsx — voir en-tête de ce fichier
// pour la justification). Une région n'est débloquée que si son `regionId`
// figure dans `progress.unlockedRegionIds` (prop injectée par l'appelant, qui
// possède la logique de déblocage réelle — hors du périmètre de cette leaf) ;
// les régions verrouillées restent visibles (brume) mais ne déclenchent
// STRICTEMENT aucune action au toucher (SPEC §4, consigne E1). Toucher une
// région débloquée révèle ses 4 à 6 quêtes (regionQuests.ts), la dernière
// étant toujours le boss dont l'id est `level.bossQuestId`.
//
// Narration (voir regionNarration.ts) : ce module n'importe JAMAIS
// `src/narration/**` directement — la leaf A4 est livrée mais son intégration
// réelle (NarrationProvider + orchestrateur) n'est pas un contrat que E1 doit
// connaître ; comme A4 elle-même le fait pour A2, on accepte ici un callback
// d'injection `onAnnounce?: (text: string) => void`, plus simple qu'une
// `NarrationRequest` complète (pas de gestion de priorité/interruption ici :
// c'est le rôle de l'orchestrateur réel, câblé par le driver à l'intégration).
// Chaque région ET chaque quête est narrée à son APPARITION (une fois, quand
// elle devient visible : les régions sont toutes visibles dès le montage de la
// carte ; les quêtes d'une région n'apparaissent qu'une fois cette région
// ouverte) et de nouveau au TOUCHER (avec un texte qui reflète l'état actuel).
//
// Aucune navigation n'est jamais déclenchée automatiquement : ouvrir une
// région ne fait qu'afficher ses quêtes (état local) ; c'est le toucher d'une
// quête qui notifie l'appelant via `onSelectQuest`, à qui revient la décision
// de navigation réelle (cette leaf ne possède pas de routeur — PLAN.md interdit
// tout router URL, navigation par machine à états dans src/app/, hors
// périmètre OWNS de E1).

import { useEffect, useMemo, useState } from 'react'
import type { CurriculumLevel, ProgressState } from '../../types'
import { curriculum } from '../../content/curriculum'
import { buildRegionQuests, type RegionQuest } from './regionQuests'
import { TapButton } from './TapButton'
import { BossGlyph, CompletedGlyph, FogGlyph, OpenGlyph, QuestOrbGlyph } from './Glyphs'
import {
  deriveRegionState,
  mapOverviewNarration,
  questListAppearanceNarration,
  questTouchNarration,
  regionAppearanceNarration,
  regionTouchNarration,
  type RegionMapState,
} from './regionNarration'

export interface WorldMapProps {
  progress: ProgressState
  /** Callback d'annonce vocale ; voir en-tête de fichier. Optionnel : les tests
   * et un rendu sans narration ne doivent jamais planter. */
  onAnnounce?: (text: string) => void
  /** Appelé quand l'enfant touche une quête visible (région déjà ouverte). */
  onSelectQuest?: (regionId: string, questId: string) => void
}

function RegionGlyph({ state }: { state: RegionMapState }) {
  if (state === 'locked') return <FogGlyph />
  if (state === 'completed') return <CompletedGlyph />
  return <OpenGlyph />
}

export function WorldMap({ progress, onAnnounce, onSelectQuest }: WorldMapProps) {
  const regionQuestsByRegion = useMemo(() => buildRegionQuests(curriculum.levels), [])

  const [openRegionId, setOpenRegionId] = useState<string | null>(() =>
    progress.unlockedRegionIds.includes(progress.currentRegionId) ? progress.currentRegionId : null,
  )

  // Narration d'apparition de l'écran carte : une fois au montage, jamais sur
  // un simple changement de props (même contrat que useScreenNarration/A4).
  useEffect(() => {
    onAnnounce?.(mapOverviewNarration())
    for (const level of curriculum.levels) {
      onAnnounce?.(regionAppearanceNarration(level.regionId, deriveRegionState(level.level, level.regionId, progress.unlockedRegionIds, progress.currentLevel)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Narration d'apparition de la liste de quêtes : une fois par région
  // effectivement ouverte (jamais pour une région restée fermée).
  useEffect(() => {
    if (openRegionId) {
      onAnnounce?.(questListAppearanceNarration(openRegionId))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRegionId])

  function pressRegion(level: CurriculumLevel, state: RegionMapState) {
    // Défense en profondeur : même si TapButton est déjà `disabled` pour une
    // région verrouillée (ce qui empêche déjà onPress de se déclencher), cette
    // garde explicite est la source de vérité du contrat « aucune action au
    // toucher » — elle ne dépend d'aucun détail d'implémentation du DOM.
    if (state === 'locked') return
    onAnnounce?.(regionTouchNarration(level.regionId, state))
    setOpenRegionId(level.regionId)
  }

  function pressQuest(regionId: string, quest: RegionQuest) {
    onAnnounce?.(questTouchNarration(regionId, quest.position, quest.isBoss))
    onSelectQuest?.(regionId, quest.id)
  }

  const openRegionQuests = openRegionId
    ? regionQuestsByRegion.find((entry) => entry.regionId === openRegionId)?.quests ?? []
    : []

  return (
    <div className="world-map" data-testid="world-map">
      <div
        role="group"
        aria-label="Carte du royaume : régions"
        className="world-map__regions"
        data-testid="world-map-regions"
      >
        {curriculum.levels.map((level, index) => {
          const state = deriveRegionState(level.level, level.regionId, progress.unlockedRegionIds, progress.currentLevel)
          const locked = state === 'locked'
          return (
            // Connecteur décoratif entre régions consécutives : rendu seulement
            // à partir de la deuxième région (index > 0), donc jamais de
            // tentative de connecteur "après" la dernière région (niveau 10) —
            // il n'existe tout simplement aucun code qui regarde au-delà de la
            // fin du tableau `curriculum.levels`.
            <div className="world-map__region-slot" key={level.regionId}>
              {index > 0 && <div className="world-map__connector" aria-hidden="true" />}
              <TapButton
                label={regionAppearanceNarration(level.regionId, state)}
                onPress={() => pressRegion(level, state)}
                disabled={locked}
                testId={`region-${level.regionId}`}
                className={`world-map__region world-map__region--${state}`}
              >
                <RegionGlyph state={state} />
              </TapButton>
            </div>
          )
        })}
      </div>

      {openRegionId && (
        <div
          role="group"
          aria-label="Quêtes de la région ouverte"
          className="world-map__quests"
          data-testid="world-map-quests"
        >
          {openRegionQuests.map((quest) => (
            <TapButton
              key={quest.id}
              label={quest.isBoss ? 'Défi du gardien de la région' : `Quête ${quest.position} de la région`}
              onPress={() => pressQuest(openRegionId, quest)}
              testId={`quest-${quest.id}`}
              className={
                quest.isBoss ? 'world-map__quest world-map__quest--boss' : 'world-map__quest'
              }
            >
              {quest.isBoss ? <BossGlyph /> : <QuestOrbGlyph />}
            </TapButton>
          ))}
        </div>
      )}
    </div>
  )
}
