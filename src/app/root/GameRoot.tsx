// Composant racine réel du jeu (leaf A5, intégration) : assemble toutes les
// pièces livrées par les autres branches en une boucle de jeu jouable de bout
// en bout. Voir .unlazy/royaume/gates/leaf-A5.md pour le contrat exact.
import { useRef, useState } from 'react'
import { NarrationProvider } from '../../narration/NarrationProvider'
import { ScreenNavigator, type ScreenDefinition, type ScreenNavigatorApi } from '../ScreenNavigator'
import { touchSafeStyle } from '../touchSafety'
import { useFullscreenOnFirstGesture } from '../useFullscreenOnFirstGesture'
import { VoiceCheckScreen, VOICE_CHECK_SCREEN_ID, shouldShowVoiceCheck } from '../VoiceCheckScreen/VoiceCheckScreen'
import { loadSaveFile, writeSaveFile, setCurrentQuestState } from '../../save'
import type { MasteryState, QuestState, ReviewQueueItem, SaveFile, Skill } from '../../types'
import { curriculum } from '../../content/curriculum'
import { buildRegionQuests } from '../../world/map/regionQuests'
import { assembleQuest } from '../../world/quest/questAssembly'
import { startQuest, completeQuest } from '../../world/quest/questLifecycle'
import { canStartBossQuest } from '../../world/quest/bossGate'
import type { VaChercherUnGrandEvent } from '../../engine/help'
import { narrationDriver } from './narrationDriver'
import { getQuestsPlayed, incrementQuestsPlayed } from './questsPlayedCounter'
import { ParentOverlay } from './ParentOverlay'
import { PlayScreenGate } from './screens/PlayScreenGate'
import { AvatarSelectScreen } from './screens/AvatarSelectScreen'
import { WorldMapScreen } from './screens/WorldMapScreen'
import { QuestScreen } from './screens/QuestScreen'
import { GrandLivreScreen } from './screens/GrandLivreScreen'

// Dérivation pure et déterministe du curriculum (voir regionQuests.ts) :
// calculée une seule fois au chargement du module, jamais recalculée à
// chaque rendu.
const REGION_QUESTS = buildRegionQuests(curriculum.levels)

// Doit correspondre à HIDDEN_ZONE_SIZE_PX (src/parent/HiddenAccessGate.tsx,
// non exporté) : la porte cachée occupe en permanence ce carré en coin
// supérieur gauche (SPEC §9), en position fixed par-dessus tout le jeu.
const HIDDEN_ACCESS_ZONE_PX = 64

/** Écran affiché au tout premier rendu (SPEC §3, gate G2) :
 *  1. la vérification de la voix passe toujours en premier, une seule fois
 *     dans la vie de l'app (adulte uniquement, exempté de la règle de
 *     narration enfant — voir en-tête de VoiceCheckScreen.tsx) ;
 *  2. sinon, une quête interrompue en cours reprend directement (SPEC §3 :
 *     « reprise exacte au défi en cours après rechargement »), sans repasser
 *     par Jouer ni par la carte ;
 *  3. sinon, l'écran Jouer habituel. */
function computeInitialScreenId(save: SaveFile): string {
  if (shouldShowVoiceCheck()) return VOICE_CHECK_SCREEN_ID
  if (save.currentQuestState !== null) return 'quest'
  return 'play'
}

export function GameRoot() {
  const [save, setSave] = useState<SaveFile>(() => loadSaveFile())
  const [initialScreenId] = useState<string>(() => computeInitialScreenId(save))

  const rootRef = useRef<HTMLDivElement | null>(null)
  const triggerFullscreenOnce = useFullscreenOnFirstGesture(rootRef)

  // Miroir en mémoire de la mastery/reviewQueue la plus à jour produite par
  // le moteur de session de quête (useQuestSession appelle onMasteryChange
  // PUIS onReviewQueueChange PUIS onQuestStateChange, dans cet ordre exact,
  // à chaque défi répondu — vérifié en lisant useQuestSession.ts, pas
  // supposé) : ces refs permettent de combiner les trois callbacks en UNE
  // seule écriture localStorage par défi, déclenchée par onQuestStateChange.
  const pendingMasteryRef = useRef<MasteryState>(save.mastery)
  const pendingReviewQueueRef = useRef<ReviewQueueItem[]>(save.mastery.reviewQueue)

  function handleAvatarSelect(avatarId: string, companionId: string, api: ScreenNavigatorApi) {
    // Amorçage de la toute première région (défaut comblé en intégration,
    // chasse aux défauts passe 3) : une sauvegarde neuve a
    // `unlockedRegionIds: []` (src/save/storage.ts::createEmptySaveFile) —
    // sans déblocage explicite ici, la carte du monde n'afficherait AUCUNE
    // région ouverte et le jeu serait une impasse dès l'écran suivant
    // (gate G3). Le choix du personnage, narrativement, EST le début de
    // l'aventure : c'est le moment naturel pour débloquer la région 1.
    const needsBootstrap = save.progress.unlockedRegionIds.length === 0
    const firstLevel = curriculum.levels.find((level) => level.level === 1)
    const nextProgress =
      needsBootstrap && firstLevel
        ? {
            ...save.progress,
            currentLevel: 1,
            currentRegionId: firstLevel.regionId,
            unlockedRegionIds: [firstLevel.regionId],
          }
        : save.progress

    const next: SaveFile = {
      ...save,
      avatar: { ...save.avatar, avatarId, companionId },
      progress: nextProgress,
    }
    const written = writeSaveFile(next).save
    setSave(written)
    api.navigate('world-map')
  }

  function handleSelectQuest(regionId: string, questId: string, api: ScreenNavigatorApi) {
    const regionEntry = REGION_QUESTS.find((entry) => entry.regionId === regionId)
    const questMeta = regionEntry?.quests.find((quest) => quest.id === questId)
    const regionLevel = curriculum.levels.find((level) => level.regionId === regionId)
    if (!questMeta || !regionLevel) return // configuration inconnue : défensif, ne devrait jamais arriver

    if (questMeta.isBoss && !canStartBossQuest(save.mastery, regionLevel.skillIds)) {
      // SPEC §7 : le boss ne démarre que toutes compétences maîtrisées.
      // Le tap est ignoré silencieusement, jamais de blocage visible
      // (CLAUDE.md règle #1 / SPEC §2.3 : jamais de message d'erreur).
      return
    }

    const skills = regionLevel.skillIds
      .map((skillId) => curriculum.skills[skillId])
      .filter((skill): skill is Skill => Boolean(skill))
    const encounteredItemIds = new Set(save.progress.grandLivreItemIds)
    const questsPlayed = getQuestsPlayed()

    const challengeQueue = assembleQuest(
      regionLevel,
      skills,
      save.mastery,
      save.mastery.reviewQueue,
      encounteredItemIds,
      questsPlayed,
      questMeta.isBoss,
    )
    const quest = startQuest(questId, regionId, challengeQueue)
    const nextSave = setCurrentQuestState(quest, save)
    setSave(nextSave)
    api.navigate('quest')
  }

  function handleQuestStateChange(next: QuestState) {
    setSave((prev) => {
      const updated: SaveFile = {
        ...prev,
        mastery: {
          skills: pendingMasteryRef.current.skills,
          reviewQueue: pendingReviewQueueRef.current,
        },
        currentQuestState: next,
      }
      // SPEC §3 : écriture après CHAQUE défi, pas seulement en fin de quête —
      // ce gestionnaire est appelé après chaque `ChallengeResult` par
      // useQuestSession (onQuestStateChange), qu'il soit correct ou non.
      writeSaveFile(updated)
      return updated
    })
  }

  function handleVaChercherUnGrand(_event: VaChercherUnGrandEvent) {
    // SPEC §8 : « L'événement est journalisé pour l'écran parent. »
    setSave((prev) => {
      const updated: SaveFile = {
        ...prev,
        progress: { ...prev.progress, helpAdultCount: prev.progress.helpAdultCount + 1 },
      }
      writeSaveFile(updated)
      return updated
    })
  }

  function handleQuestComplete(finalQuestState: QuestState, api: ScreenNavigatorApi) {
    setSave((prev) => {
      const regionLevel = curriculum.levels.find((level) => level.regionId === finalQuestState.regionId)
      const isBoss = regionLevel?.bossQuestId === finalQuestState.questId
      const currentMastery: MasteryState = {
        skills: pendingMasteryRef.current.skills,
        reviewQueue: pendingReviewQueueRef.current,
      }
      const result = completeQuest(finalQuestState, currentMastery, prev.avatar, prev.progress, Boolean(isBoss))
      const updated: SaveFile = {
        ...prev,
        avatar: result.avatar,
        progress: result.progress,
        mastery: currentMastery,
        currentQuestState: result.clearedQuestState,
      }
      writeSaveFile(updated)
      return updated
    })
    incrementQuestsPlayed()
    // Choix documenté (ASSUMPTIONS.md) : retour à la carte du monde plutôt
    // qu'au Grand Livre après une quête. La carte est le "hub" naturel d'où
    // l'enfant enchaîne sur la quête suivante ; le Grand Livre reste
    // accessible en permanence depuis la carte (bouton ajouté par
    // WorldMapScreen.tsx) pour qui veut réécouter ce qu'il a appris.
    api.navigate('world-map')
  }

  function handleParentOverlayClosed() {
    // Défense en profondeur : voir ParentOverlay.tsx pour le défaut comblé
    // (réinitialisation/import depuis l'écran parent contournant l'état React).
    // Resynchronise aussi les refs mastery/reviewQueue (pas seulement `save`) :
    // sans ça, une réponse à un défi juste après un import/reset écraserait la
    // mastery fraîchement importée par l'ancienne valeur mise en cache dans
    // ces refs (voir leur commentaire plus haut).
    const reloaded = loadSaveFile()
    pendingMasteryRef.current = reloaded.mastery
    pendingReviewQueueRef.current = reloaded.mastery.reviewQueue
    setSave(reloaded)
  }

  const screens: ScreenDefinition[] = [
    {
      id: VOICE_CHECK_SCREEN_ID,
      render: (api) => <VoiceCheckScreen {...api} />,
    },
    {
      id: 'play',
      render: (api) => (
        <PlayScreenGate
          {...api}
          onPlay={() => api.navigate(save.avatar.avatarId === '' ? 'avatar-select' : 'world-map')}
        />
      ),
    },
    {
      id: 'avatar-select',
      render: (api) => (
        <AvatarSelectScreen
          avatar={save.avatar}
          onSelect={(avatarId, companionId) => handleAvatarSelect(avatarId, companionId, api)}
        />
      ),
    },
    {
      id: 'world-map',
      render: (api) => (
        <WorldMapScreen
          progress={save.progress}
          onSelectQuest={(regionId, questId) => handleSelectQuest(regionId, questId, api)}
          onOpenGrandLivre={() => api.navigate('grand-livre')}
        />
      ),
    },
    {
      id: 'quest',
      render: (api) => (
        <QuestScreen
          questState={save.currentQuestState}
          level={save.progress.currentLevel}
          mastery={save.mastery}
          reviewQueue={save.mastery.reviewQueue}
          questsPlayed={getQuestsPlayed()}
          onQuestStateChange={handleQuestStateChange}
          onMasteryChange={(next) => {
            pendingMasteryRef.current = next
          }}
          onReviewQueueChange={(next) => {
            pendingReviewQueueRef.current = next
          }}
          onVaChercherUnGrand={handleVaChercherUnGrand}
          onQuestComplete={(finalState) => handleQuestComplete(finalState, api)}
          onOrphan={() => api.navigate('world-map')}
        />
      ),
    },
    {
      id: 'grand-livre',
      render: (api) => (
        <GrandLivreScreen
          grandLivreItemIds={save.progress.grandLivreItemIds}
          onBack={() => api.navigate('world-map')}
        />
      ),
    },
  ]

  return (
    <div ref={rootRef} className="game-root" style={touchSafeStyle} onPointerDown={triggerFullscreenOnce}>
      {/* Défaut réel trouvé par la suite e2e (leaf F4) et corrigé par le
       * driver : HiddenAccessGate (F1) occupe en permanence, en position
       * fixed et z-index 9999, le coin supérieur GAUCHE du viewport
       * (64x64px, SPEC §9) — mais rien n'empêchait le contenu de jeu de
       * rendre un bouton exactement dans ce même coin (le 1er avatar, ou
       * l'unique région débloquée d'une sauvegarde neuve), lui volant tout
       * clic réel. Cette réserve garantit qu'AUCUN écran de jeu ne peut
       * jamais placer un élément interactif dans la zone que la porte
       * cachée occupe, sans changer le contrat d'aucun écran individuel. */}
      <div style={{ paddingTop: HIDDEN_ACCESS_ZONE_PX, paddingLeft: HIDDEN_ACCESS_ZONE_PX }}>
        <NarrationProvider driver={narrationDriver}>
          <ScreenNavigator screens={screens} initialScreenId={initialScreenId} />
        </NarrationProvider>
      </div>
      <ParentOverlay onClose={handleParentOverlayClosed} />
    </div>
  )
}
