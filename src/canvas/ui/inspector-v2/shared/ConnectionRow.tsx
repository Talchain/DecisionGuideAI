/**
 * ConnectionRow — NodeShape + label + optional badge + optional strength
 * Hover bg uses entity-light colour for connected node type.
 * Strength: default shows human label, tech mode shows ±decimal.
 */

import { useCallback } from 'react'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import type { NodeType } from '../../../domain/nodes'
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
  strength?: { weight: number; direction: 'positive' | 'negative' }
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

  const signedValue = strength
    ? strength.direction === 'negative' ? -strength.weight : strength.weight
    : null

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
      {strength && signedValue !== null && (
        <div className="flex items-center gap-1.5 min-w-[90px]">
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
