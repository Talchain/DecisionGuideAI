/**
 * ModelAdjustments — Collapsible section showing CEE's automatic model repairs.
 *
 * Surfaces analysis_ready.model_adjustments for transparency.
 * Each adjustment describes what the STRP/repair pipeline changed.
 *
 * Hidden when model_adjustments is absent or empty.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'

interface ModelAdjustmentsProps {
  adjustments: Array<{ type: string; field?: string; detail?: string; target?: string }>
}

/** Humanise adjustment type for display */
function formatAdjustmentType(type: string): string {
  const labels: Record<string, string> = {
    'factor_reclassified': 'Factor reclassified',
    'edge_added': 'Edge added',
    'edge_removed': 'Edge removed',
    'node_removed': 'Node removed',
    'strength_defaulted': 'Strength defaulted',
    'observed_state_defaulted': 'Observed state defaulted',
    'category_inferred': 'Category inferred',
    'baseline_created': 'Baseline created',
  }
  return labels[type] ?? type.replace(/_/g, ' ')
}

export function ModelAdjustments({ adjustments }: ModelAdjustmentsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (adjustments.length === 0) return null

  return (
    <div className="rounded-md border border-panel-border bg-panel" data-testid="model-adjustments">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-panel-hover transition-colors rounded-md"
      >
        <Wrench size={14} className="text-text-light flex-shrink-0" />
        <span className="text-xs font-semibold text-text-body flex-1">
          System corrections
        </span>
        <span className="text-xs text-text-light">{adjustments.length}</span>
        {isExpanded ? (
          <ChevronDown size={14} className="text-text-light" />
        ) : (
          <ChevronRight size={14} className="text-text-light" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-2 space-y-1.5">
          {adjustments.map((adj, idx) => (
            <div
              key={`${adj.type}-${adj.target ?? adj.field ?? idx}`}
              className="flex items-start gap-2 text-xs"
            >
              <span className="text-text-light mt-0.5 flex-shrink-0">&bull;</span>
              <div>
                <span className="font-medium text-text-body">
                  {formatAdjustmentType(adj.type)}
                </span>
                {adj.target && (
                  <span className="text-text-light"> on {adj.target}</span>
                )}
                {adj.field && (
                  <span className="text-text-light"> ({adj.field})</span>
                )}
                {adj.detail && (
                  <p className="text-text-light mt-0.5">{adj.detail}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ModelAdjustments
