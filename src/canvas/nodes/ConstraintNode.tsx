/**
 * ConstraintNode - Represents boundaries and limits
 *
 * Task 4.5: Constraint node with distinct styling
 * - Red border to indicate limiting nature
 * - Shield icon
 * - Displays constraint type, value, and unit
 */

import { memo, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { Shield, AlertCircle } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { ConstraintType } from '../domain/nodes'

interface ConstraintNodeData {
  label: string
  description?: string
  constraintType?: ConstraintType
  thresholdValue?: number
  unit?: string
  hardConstraint?: boolean
}

// Constraint type display config
const CONSTRAINT_TYPE_CONFIG: Record<ConstraintType, { label: string; prefix: string }> = {
  upper_bound: { label: 'Maximum', prefix: '≤' },
  lower_bound: { label: 'Minimum', prefix: '≥' },
  deadline: { label: 'Deadline', prefix: 'by' },
  resource: { label: 'Resource', prefix: '' },
  other: { label: 'Constraint', prefix: '' },
}

export const ConstraintNode = memo((props: NodeProps) => {
  const { data, selected } = props
  const nodeData = data as ConstraintNodeData

  const constraintType = nodeData.constraintType || 'other'
  const typeConfig = CONSTRAINT_TYPE_CONFIG[constraintType]

  // Format the constraint value display
  const valueDisplay = useMemo(() => {
    if (nodeData.thresholdValue === undefined) return null

    const unit = nodeData.unit || ''
    const prefix = typeConfig.prefix

    // Format based on unit type
    if (unit.toLowerCase() === 'usd' || unit.toLowerCase() === 'dollars' || unit === '$') {
      return `${prefix} $${nodeData.thresholdValue.toLocaleString()}`
    }
    if (unit === '%' || unit.toLowerCase() === 'percent') {
      return `${prefix} ${nodeData.thresholdValue}%`
    }

    return unit ? `${prefix} ${nodeData.thresholdValue} ${unit}` : `${prefix} ${nodeData.thresholdValue}`
  }, [nodeData.thresholdValue, nodeData.unit, typeConfig.prefix])

  const isHard = nodeData.hardConstraint !== false

  return (
    <div
      className={`
        relative px-4 py-3 rounded-lg min-w-[160px] max-w-[220px]
        border-2
        ${selected ? 'border-danger ring-2 ring-danger-light' : 'border-danger'}
        shadow-1 hover:shadow-2 transition-shadow
      `}
      style={{ backgroundColor: 'var(--bg-panel)' }}
      data-testid="constraint-node"
      role="group"
      aria-label={`Constraint: ${nodeData.label}`}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-danger !border-danger"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 !bg-danger !border-danger"
      />

      {/* Header with icon */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded bg-danger-light">
          <Shield className="h-4 w-4 text-danger" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`${typography.caption} text-danger font-medium uppercase tracking-wide`}>
            {typeConfig.label}
          </span>
        </div>
        {!isHard && (
          <span className={`${typography.caption} px-1.5 py-0.5 rounded bg-warning-light text-text-body`}>
            Soft
          </span>
        )}
      </div>

      {/* Label */}
      <p className={`${typography.bodySmall} font-medium text-text-header truncate`}>
        {nodeData.label}
      </p>

      {/* Constraint value */}
      {valueDisplay && (
        <p className={`${typography.body} font-semibold text-danger mt-1`}>
          {valueDisplay}
        </p>
      )}

      {/* Description */}
      {nodeData.description && (
        <p className={`${typography.caption} text-text-light mt-1 line-clamp-2`}>
          {nodeData.description}
        </p>
      )}

      {/* Hard constraint indicator */}
      {isHard && (
        <div className="absolute -top-1 -right-1">
          <div
            className="w-4 h-4 rounded-full bg-danger flex items-center justify-center"
            title="Hard constraint - must be met"
          >
            <AlertCircle className="h-3 w-3 text-white" />
          </div>
        </div>
      )}
    </div>
  )
})

ConstraintNode.displayName = 'ConstraintNode'
