// Zone tactile partagée par les 6 mécaniques de défi (SPEC §3, gate C1:G2).
// Toute cible tactile d'un défi (carte à choisir, lettre à soulever,
// emplacement où la poser, bouton continuer...) passe par ce composant plutôt
// que par un <button> nu redéfini localement (convention PLAN.md).
//
// Décisions délibérées :
// - On écoute UNIQUEMENT `onClick` (jamais `onTouchStart`/`onPointerDown`
//   pour déclencher l'action). C'est ce qui protège gratuitement contre le
//   « relâchement du doigt hors cible » : le navigateur n'émet un `click` que
//   si le pointeur a été pressé ET relâché sur le même élément. Un enfant qui
//   pose le doigt sur une pièce puis fait glisser hors de la zone avant de
//   relâcher n'active donc rien, sans code de suivi tactile personnalisé.
// - `onDoubleClick`, `onDragStart` et `onMouseEnter` ne sont volontairement
//   jamais câblés à une action : SPEC §3 interdit le glisser-déposer, le
//   survol et le double-tap comme gestes signifiants.
// - Un anti-rebond court protège contre un double-appui rapide accidentel
//   (doigt qui rebondit) déclenchant deux réponses pour un seul tap voulu.
import { type CSSProperties, type ReactNode, useRef } from 'react'

/** Taille tactile minimale imposée par SPEC §3 / CLAUDE.md règle #4. */
export const MIN_TAP_TARGET_PX = 64

/** Fenêtre anti-rebond : deux taps sur LA MÊME instance de cible séparés de
 * moins de ce délai ne comptent que pour un. Ne bloque pas deux taps sur deux
 * cibles différentes (ex. toucher une pièce puis un emplacement juste après),
 * puisque le minuteur est local à chaque instance de composant. */
export const DOUBLE_TAP_GUARD_MS = 300

const baseStyle: CSSProperties = {
  minWidth: MIN_TAP_TARGET_PX,
  minHeight: MIN_TAP_TARGET_PX,
  touchAction: 'manipulation',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  WebkitTapHighlightColor: 'transparent',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: 'none',
  borderRadius: 16,
  cursor: 'pointer',
  boxSizing: 'border-box',
}

export interface TapTargetProps {
  /** Action déclenchée par un tap simple valide. */
  onTap: () => void
  /** Libellé accessible (lu par un lecteur d'écran adulte, jamais requis pour
   * que l'enfant comprenne — la narration à voix haute reste la source pour
   * lui, SPEC §2). Obligatoire : une cible tactile du jeu ne doit jamais être
   * silencieuse pour l'accessibilité. */
  label: string
  children?: ReactNode
  /** Reflète un état "soulevé"/sélectionné (pièce en main, carte mise en
   * évidence par une aide) — jamais le seul signal, voir `ChallengeFeedback`
   * pour la combinaison forme+son+animation+phrase. */
  selected?: boolean
  disabled?: boolean
  testId?: string
  className?: string
  style?: CSSProperties
}

export function TapTarget({
  onTap,
  label,
  children,
  selected = false,
  disabled = false,
  testId,
  className,
  style,
}: TapTargetProps) {
  const lastTapAtRef = useRef(0)

  const handleClick = () => {
    if (disabled) return
    const now = Date.now()
    if (now - lastTapAtRef.current < DOUBLE_TAP_GUARD_MS) return
    lastTapAtRef.current = now
    onTap()
  }

  return (
    <button
      type="button"
      className={['tap-target', className].filter(Boolean).join(' ')}
      style={{
        ...baseStyle,
        ...style,
        opacity: disabled ? 0.5 : 1,
        outline: selected ? '4px solid #2B2B2B' : 'none',
        outlineOffset: selected ? 2 : 0,
      }}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      onClick={handleClick}
      // Neutralise explicitement les gestes non voulus plutôt que de
      // simplement ne pas les câbler : un menu contextuel (appui long) ou un
      // glisser-déposer natif du navigateur ne doit jamais interrompre le jeu.
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
      draggable={false}
      data-testid={testId}
    >
      {children}
    </button>
  )
}
