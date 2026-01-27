import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { BaseNode } from './BaseNode'
import { NODE_REGISTRY } from '../domain/nodes'
import type { RiskImpact } from '../domain/nodes'
import { calculateRiskSeverity, getRiskSeverityColors } from '../utils/graphDisplayCalculations'

export const RiskNode = memo((props: NodeProps) => {
  const metadata = NODE_REGISTRY.risk

  // Decision Graph Display v2 Task 9: Risk severity summary
  const probability = props.data?.probability as number | undefined
  const impact = props.data?.impact as RiskImpact | undefined
  const severity = calculateRiskSeverity(probability, impact)
  const severityColors = getRiskSeverityColors(severity)

  return (
    <BaseNode {...props} nodeType="risk" icon={metadata.icon}>
      {/* Decision Graph Display v2 Task 9 + Task C: Risk severity heat + label */}
      {/* Task 1 Fix: Only show badge when severity is present, not "Not rated" placeholder */}
      {severity && (
        <div
          className={`${severityColors.bg} ${severityColors.border} ${severityColors.text} border rounded px-2 py-1 text-xs font-semibold mb-2`}
          style={{ textAlign: 'center' }}
        >
          {severity.charAt(0).toUpperCase() + severity.slice(1)} Risk
        </div>
      )}

      {props.data?.description && (
        <div className="text-xs opacity-70">
          {props.data.description}
        </div>
      )}
    </BaseNode>
  )
})

RiskNode.displayName = 'RiskNode'
