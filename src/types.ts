// Contrat de domaine partagé — Le Royaume des Sons.
// Fixé avant tout travail de leaf (SPEC §0). Toute leaf qui a besoin d'un nouveau
// champ propose une modification ici et la fait valider par le driver avant de l'utiliser :
// ne pas dupliquer une forme de données ad hoc dans une leaf.

export type GraphemeId = string // ex: "a", "ch", "eau", "e-muet"

export interface Grapheme {
  id: GraphemeId
  level: number // 1-10, niveau où le graphème est enseigné pour la première fois
  pronunciationKey: string // clé dans src/content/pronunciation.json
}

export type SkillId = string // ex: "L1-voyelles", "L3-fusion-cv"

export interface Skill {
  id: SkillId
  level: number
  label: string // libellé adulte (écran parent) — jamais l'unique indice pour l'enfant
  graphemeIds: GraphemeId[] // graphèmes enseignés/renforcés par cette compétence
}

export interface CurriculumLevel {
  level: number // 1-10
  regionId: string
  labelKey: string // clé de narration du nom de région
  skillIds: SkillId[]
  bossQuestId: string
}

export interface Curriculum {
  levels: CurriculumLevel[]
  skills: Record<SkillId, Skill>
  graphemes: Record<GraphemeId, Grapheme>
}

export type ContentItemKind =
  | 'grapheme'
  | 'syllable'
  | 'word'
  | 'pseudoword'
  | 'sentence'
  | 'text'

export interface TextQuestion {
  id: string
  promptKey: string // clé de narration de la question
  answerOptions: string[] // libellés courts ou emoji ; décoratifs, jamais seule source
  correctIndex: number
}

export interface ContentItem {
  id: string
  kind: ContentItemKind
  level: number
  text: string // graphème/syllabe/mot/phrase/texte littéral
  graphemeIds: GraphemeId[] // décomposition explicite, fournie par le contenu, jamais devinée
  emoji?: string // obligatoire pour kind === 'word'
  skillIds: SkillId[]
  isSightWord?: boolean // mot-outil niveau 8, reconnu globalement (exempté de décodabilité)
  questions?: TextQuestion[] // pour kind === 'text'
}

export type ChallengeKind =
  | 'listen-touch' // Écoute et touche
  | 'forge' // Forge
  | 'read-show' // Lis et montre
  | 'true-false-word' // Vrai mot / faux mot
  | 'reorder' // Remets en ordre
  | 'companion-question' // La question du compagnon

export interface ChallengeOption {
  id: string
  contentItemId: string
  isDistractor: boolean
}

export interface Challenge {
  id: string
  kind: ChallengeKind
  skillId: SkillId
  targetItemId: string
  options: ChallengeOption[] // options présentées ; ordre à mélanger par le moteur (D3)
  isReview: boolean // réinjection de répétition espacée
}

export type HelpLevel = 0 | 1 | 2 | 3
// 0 = aucune aide ; 1 = première lettre/syllabe énoncée + surlignée ;
// 2 = une mauvaise option retirée ; 3 = bonne réponse clignote (toujours à toucher)

export interface ChallengeResult {
  challengeId: string
  correct: boolean
  usedHelpLevel: HelpLevel
  usedListenAgain: boolean
  responseMs: number
  timestamp: string // ISO 8601
}

export interface SkillMastery {
  skillId: SkillId
  last10: boolean[] // fenêtre glissante, dernière entrée = réponse la plus récente sans indice
  masteredAt: string | null // ISO 8601, dernière fois que le seuil 8/10 a été atteint
  decayedAt: string | null // ISO 8601, dernière décroissance après 14 jours d'inactivité
}

export interface ReviewQueueItem {
  id: string
  contentItemId: string
  skillId: SkillId
  createdAt: string // ISO 8601
  stage: 1 | 2 | 3 // palier de répétition espacée : réinjection après 1, 3, puis 8 quêtes
  dueAfterQuestCount: number // quêtes restantes avant réinjection
}

export interface MasteryState {
  skills: Record<SkillId, SkillMastery>
  reviewQueue: ReviewQueueItem[]
}

export interface AvatarState {
  avatarId: string
  companionId: string
  cosmetics: string[]
  xp: number
  coins: number
}

export interface ProgressState {
  currentLevel: number
  currentRegionId: string
  unlockedRegionIds: string[]
  grandLivreItemIds: string[] // items maîtrisés, consultables/réécoutables
  helpAdultCount: number
  sessionMinutesByDay: Record<string, number> // date ISO (YYYY-MM-DD) -> minutes, 14 jours glissants
}

export interface QuestState {
  questId: string
  regionId: string
  challengeQueue: Challenge[]
  currentIndex: number
  results: ChallengeResult[]
  startedAt: string // ISO 8601
}

export interface SaveFile {
  schemaVersion: number
  mastery: MasteryState
  avatar: AvatarState
  progress: ProgressState
  currentQuestState: QuestState | null // reprise exacte après rechargement
  lastSavedAt: string // ISO 8601
}

export type NarrationPriority = 'screen-intro' | 'instruction' | 'feedback' | 'help'

export interface NarrationRequest {
  id: string
  text: string // texte à énoncer, déjà résolu via pronunciation.json si c'est un son
  priority: NarrationPriority
  interruptible: boolean // peut être annoncée par une narration plus prioritaire
}

export const SCHEMA_VERSION = 1
