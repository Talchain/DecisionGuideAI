/**
 * ConnectionRow — NodeShape + label + optional badge + optional strength
 * Hover bg uses entity-light colour for connected node type.
 * Strength: default shows human label, tech mode shows ±decimal.
 */

import { useCallback } from 'react'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import type { NodeType } from '../../../domain/nodes'
import type { EdgeValueDisplay } from '../../../domain/edgeValueProvenance'
import { typography } from '../../../../styles/typography'
import { getStrengthLabel } from '../inspectorStrings'

// Entity-light hover backgrounds (Tailwind hover: variants)
const HOVER_BG: Partial<Record<NodeType, string>> = {
  goal:     'hover:bg-goal-light',
  option:   'hover:bg-option-light',
  factor:   'hover:bg-factor-light',
  decision: 'hover:bg-info-light',
  outcome:  'hover:bg-success-light',
  risk:     'hover:bg-danger-light',
}

interface ConnectionRowProps {
  nodeKind: NodeType
  label: string
  badge?: React.ReactNode
  /**
   * The connection's strength, ALREADY resolved through the provenance gate
   * (`resolveEdgeSignedStrengthDisplay`).
   *
   * ⛔ THIS TYPE IS THE FIX. It used to be `{ weight: number; direction:
   * 'positive' | 'negative' }` — a shape that cannot express "nobody set
   * this", exactly like the `thresholdColor(v: number)` signature removed in
   * #476. Every one of the nine construction sites therefore wrote
   * `{ weight: e.data?.weight ?? 0, direction: e.data?.direction ?? 'positive' }`
   * and this row painted `USER_EDGE_DEFAULTS.weight` as a coloured bar, a
   * "Moderate +" band label and a ± glyph across EIGHT inspector panels.
   *
   * Fixing the eight consumers would have left the enabler in place. Taking
   * `EdgeValueDisplay` means there is no argument a caller can construct that
   * means "0.3, source unknown", and handling the unset case is a type error
   * rather than something a tenth panel can forget.
   */
  strength?: EdgeValueDisplay
  techMode?: boolean
  onClick?: () => void
  /** When true, label is not truncated (used by DriversList where full names matter) */
  fullLabel?: boolean
}

export function ConnectionRow({
  nodeKind,
  label,
  badge,
  strength,
  techMode = false,
  onClick,
  fullLabel = false,
}: ConnectionRowProps) {
  const hoverClass = HOVER_BG[nodeKind] ?? 'hover:bg-panel-hover'

  const handleClick = useCallback(() => onClick?.(), [onClick])

  // `show: true` is the ONLY path to a number here. `not_set` keeps the row
  // (the connection is real — the user drew it) and says so in words instead
  // of painting a bar sized to a value nobody chose; `absent` means there is
  // no strength channel on this row at all (e.g. the option rows in
  // FactorControllablePanel, which pass no `strength` prop).
  const signedValue = strength?.show ? strength.value : null
  const showNotSet = strength?.show === false && strength.reason === 'not_set'

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick() } } : undefined}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors bg-transparent ${hoverClass} ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <NodeShapeIndicator nodeKind={nodeKind} size={16} />
      <span className={`${typography.panelBody} text-text-body flex-1 ${fullLabel ? 'break-words' : 'truncate'}`}>{label}</span>
      {badge}
      {showNotSet && (
        <span
          data-testid="connection-row-strength-not-set"
          className={`${typography.panelMeta} text-text-light min-w-[90px] text-right`}
        >
          Not set
        </span>
      )}
      {signedValue !== null && (
        <div className="flex items-center gap-1.5 min-w-[90px]" data-testid="connection-row-strength">
          {/* Strength bar */}
          <div className="flex-1 h-1 bg-panel-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${signedValue >= 0 ? 'bg-success' : 'bg-danger'}`}
              style={{ width: `${Math.abs(signedValue) * 100}%` }}
            />
          </div>
          {/* Label or decimal */}
          {techMode ? (
            <span className={`${typography.panelMeta} text-text-light tabular-nums min-w-[32px] text-right`}>
              {signedValue > 0 ? '+' : ''}{signedValue.toFixed(2)}
            </span>
          ) : (
            <span className={`${typography.panelMeta} text-text-light min-w-[60px] text-right`}>
              {getStrengthLabel(Math.abs(signedValue))} {signedValue >= 0 ? '+' : '\u2212'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
