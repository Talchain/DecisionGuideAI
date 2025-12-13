/**
 * AssumptionsSection - Assumptions to validate
 *
 * Displays critical assumptions underlying the recommendation.
 * Each assumption has a validation suggestion and can link to belief editor.
 */

import { AlertCircle, CheckCircle2, Pencil } from 'lucide-react'
import { typography } from '../../../styles/typography'
import type { Assumption } from './types'

interface AssumptionsSectionProps {
  assumptions: Assumption[]
  onAssumptionClick?: (edgeId: string, nodeId?: string) => void
}

const criticalityConfig = {
  critical: {
    icon: AlertCircle,
    iconColor: 'text-carrot-600',
    bgColor: 'bg-carrot-50',
    borderColor: 'border-carrot-200',
    label: 'Critical',
    labelBg: 'bg-carrot-100 text-carrot-700',
  },
  important: {
    icon: AlertCircle,
    iconColor: 'text-banana-600',
    bgColor: 'bg-banana-50',
    borderColor: 'border-banana-200',
    label: 'Important',
    labelBg: 'bg-banana-100 text-banana-700',
  },
  minor: {
    icon: CheckCircle2,
    iconColor: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-200',
    label: 'Minor',
    labelBg: 'bg-sky-100 text-sky-700',
  },
}

export function AssumptionsSection({ assumptions, onAssumptionClick }: AssumptionsSectionProps) {
  // Task 5: Don't render empty placeholder - section simply doesn't appear when empty
  if (!assumptions || assumptions.length === 0) {
    return null
  }

  // Sort by criticality
  const sortedAssumptions = [...assumptions].sort((a, b) => {
    const order = { critical: 0, important: 1, minor: 2 }
    return order[a.criticality] - order[b.criticality]
  })

  return (
    <div className="space-y-3">
      {sortedAssumptions.map((assumption, index) => {
        const config = criticalityConfig[assumption.criticality]
        const Icon = config.icon
        const isClickable = !!assumption.edge_id || !!assumption.node_id

        return (
          <div
            key={assumption.edge_id || index}
            className={`p-3 rounded-lg border ${config.borderColor} ${config.bgColor}`}
          >
            <div className="flex items-start gap-3">
              <Icon
                className={`h-4 w-4 ${config.iconColor} flex-shrink-0 mt-0.5`}
                aria-hidden="true"
              />
              <div className="flex-1 min-w-0">
                {/* Criticality badge */}
                <div className="flex items-center gap-2 mb-1">
                  <span className={`${typography.caption} px-1.5 py-0.5 rounded ${config.labelBg}`}>
                    {config.label}
                  </span>
                </div>

                {/* Description */}
                <p className={`${typography.bodySmall} text-ink-800 mb-2`}>
                  {assumption.description}
                </p>

                {/* Validation suggestion */}
                <div className="flex items-center justify-between gap-2">
                  <p className={`${typography.caption} text-ink-500 italic`}>
                    {assumption.validation_suggestion}
                  </p>

                  {isClickable && (
                    <button
                      type="button"
                      onClick={() => onAssumptionClick?.(assumption.edge_id!, assumption.node_id)}
                      className={`${typography.caption} flex items-center gap-1 px-2 py-1 rounded text-sky-600 hover:bg-sky-100 transition-colors`}
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
