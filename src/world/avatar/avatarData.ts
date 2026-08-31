// Données de choix de personnage — Le Royaume des Sons (leaf E2).
//
// Décision libre (voir ASSUMPTIONS.md) : exactement 4 avatars et 3 compagnons,
// tous des créatures abstraites (blob + motif), sans trait de genre (pas de
// vêtement, pas de coiffure, pas de caractéristique corporelle genrée), pour
// respecter SPEC §4 « avatar non genré ». Les libellés sont décoratifs
// (aria-label pour l'accessibilité adulte/lecteur d'écran) : l'enfant ne sait
// pas lire et choisit uniquement par la forme et la couleur, jamais par le
// texte — conforme à la règle d'autonomie de SPEC §2.

export type AvatarShape = 'comete' | 'feuille' | 'vague' | 'flamme'
export type CompanionShape = 'luciole' | 'renardeau' | 'hibou'

export interface AvatarOption {
  id: string
  label: string
  shape: AvatarShape
  colorPrimary: string
  colorSecondary: string
}

export interface CompanionOption {
  id: string
  label: string
  shape: CompanionShape
  colorPrimary: string
  colorSecondary: string
}

// Exactement 4 avatars (SPEC §4 : « un avatar parmi 4 »). Ne pas en ajouter ou
// en retirer sans mettre à jour AvatarSelect.test.tsx (gate G1).
export const AVATARS: readonly AvatarOption[] = [
  {
    id: 'avatar-comete',
    label: 'Personnage comète dorée',
    shape: 'comete',
    colorPrimary: '#F5A623',
    colorSecondary: '#FFE0A3',
  },
  {
    id: 'avatar-feuille',
    label: 'Personnage feuille verte',
    shape: 'feuille',
    colorPrimary: '#4CAF7D',
    colorSecondary: '#BCEBD3',
  },
  {
    id: 'avatar-vague',
    label: 'Personnage vague bleue',
    shape: 'vague',
    colorPrimary: '#4A90D9',
    colorSecondary: '#BFE0FF',
  },
  {
    id: 'avatar-flamme',
    label: 'Personnage flamme corail',
    shape: 'flamme',
    colorPrimary: '#E8613C',
    colorSecondary: '#FFCBB8',
  },
] as const

// 2-3 compagnons magiques raisonnables (SPEC §4 : « un compagnon magique qui
// parle »). 3 options retenues pour laisser un vrai choix sans le noyer.
export const COMPANIONS: readonly CompanionOption[] = [
  {
    id: 'companion-luciole',
    label: 'Compagnon luciole scintillante',
    shape: 'luciole',
    colorPrimary: '#F6D860',
    colorSecondary: '#FFF3C4',
  },
  {
    id: 'companion-renardeau',
    label: 'Compagnon renardeau espiègle',
    shape: 'renardeau',
    colorPrimary: '#E8935C',
    colorSecondary: '#FFD9B8',
  },
  {
    id: 'companion-hibou',
    label: 'Compagnon hibou curieux',
    shape: 'hibou',
    colorPrimary: '#8C7AE6',
    colorSecondary: '#DCD3FA',
  },
] as const
