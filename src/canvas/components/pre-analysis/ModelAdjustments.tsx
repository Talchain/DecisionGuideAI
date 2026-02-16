/**
 * ModelAdjustments — Collapsible section showing CEE's automatic model repairs.
 *
 * Surfaces analysis_ready.model_adjustments for transparency.
 * Each adjustment describes what the STRP/repair pipeline changed.
 *
 * Hidden when model_adjustments is absent or empty.
 *
 * CEE sends adjustments with `code` + `reason` fields; legacy format used
 * `type` + `detail`. This component accepts both shapes defensively.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Wrench } from 'lucide-react'

interface ModelAdjustment {
  /** Legacy type identifier */
  type?: string
  /** CEE code identifier (preferred over type) */
  code?: string
  field?: string
  /** Legacy detail text */
  detail?: string
  /** CEE reason text (preferred over detail) */
  reason?: string
  target?: string
  /** Extra CEE fields passed through */
  [key: string]: unknown
}

interface ModelAdjustmentsProps {
  adjustments: ModelAdjustment[]
}

/** Humanise adjustment type/code for display */
function formatAdjustmentType(type: string | undefined): string {
  if (!type || typeof type !== 'string') return 'System adjustment'

  const labels: Record<string, string> = {
    'factor_reclassified': 'Factor reclassified',
    'edge_added': 'Edge added',
    'edge_removed': 'Edge removed',
    'node_removed': 'Node removed',
    'strength_defaulted': 'Strength defaulted',
    'observed_state_defaulted': 'Observed state defaulted',
    'category_inferred': 'Category inferred',
    'baseline_created': 'Baseline created',
    'deterministic_repair': 'Deterministic repair',
    'risk_coefficient_corrected': 'Risk coefficient corrected',
    'strp_repair': 'STRP repair',
    'category_infer': 'Category inferred',
  }
  return labels[type] ?? type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
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
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-text-body">
            Auto-fixes applied
          </span>
          <p className="text-xs text-text-light leading-tight">
            We fixed small issues without changing your intent.
          </p>
        </div>
        <span className="text-xs text-text-light">{adjustments.length}</span>
        {isExpanded ? (
          <ChevronDown size={14} className="text-text-light" />
        ) : (
          <ChevronRight size={14} className="text-text-light" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-2 space-y-1.5">
          {adjustments.map((adj, idx) => {
            const displayType = adj.type ?? adj.code
            const displayDetail = adj.detail ?? adj.reason
            return (
              <div
                key={`${displayType ?? 'adj'}-${adj.target ?? adj.field ?? idx}`}
                className="flex items-start gap-2 text-xs"
              >
                <span className="text-text-light mt-0.5 flex-shrink-0">&bull;</span>
                <div>
                  <span className="font-medium text-text-body">
                    {formatAdjustmentType(displayType)}
                  </span>
                  {adj.target && (
                    <span className="text-text-light"> on {adj.target}</span>
                  )}
                  {adj.field && (
                    <span className="text-text-light"> ({adj.field})</span>
                  )}
                  {displayDetail && (
                    <p className="text-text-light mt-0.5">{displayDetail}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default ModelAdjustments
