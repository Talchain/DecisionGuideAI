/**
 * Edge Tooltip Component
 *
 * Rich tooltip for edges showing:
 * - Relationship context
 * - Driver status and contribution
 * - Critical gap warnings
 * - Edge properties (strength, belief)
 * - Evidence count
 * - Actionable buttons
 */

import type { Edge } from '@xyflow/react'
import { useResultsStore } from '@/canvas/stores/resultsStore'
import { Button } from '../../shared/Button'

export interface EdgeTooltipProps {
  edge: Edge
  onAddEvidence?: (edgeId: string) => void
  onExplain?: (edgeId: string) => void
}

export function EdgeTooltip({
  edge,
  onAddEvidence,
  onExplain,
}: EdgeTooltipProps): JSX.Element {
  const report = useResultsStore((state) => state.report)

  // Find if this edge connects to a driver
  const targetDriver = report?.drivers?.find((d: any) => d.node_id === edge.target)
  const sourceDriver = report?.drivers?.find((d: any) => d.node_id === edge.source)
  const driver = targetDriver || sourceDriver

  // Find if this is a critical gap
  const criticalGap = report?.critical_gaps?.find((g: any) => g.edge_id === edge.id)

  // Get evidence count from edge metadata or visual encoding
  const evidenceCount = edge.data?.visualEncoding?.evidenceCount || edge.data?.documents?.length || 0

  // Get source and target labels
  const sourceLabel = edge.data?.sourceLabel || edge.source
  const targetLabel = edge.data?.targetLabel || edge.target

  return (
    <div
      className="
        bg-white rounded-lg shadow-xl border border-storm-200
        p-4 min-w-[280px] max-w-[320px]
        space-y-3
      "
      role="tooltip"
    >
      {/* Header */}
      <div className="space-y-1">
        <div className="text-xs text-storm-500 uppercase tracking-wide">
          Relationship
        </div>
        <div className="font-medium text-charcoal-900 text-sm">
          {sourceLabel} → {targetLabel}
        </div>
      </div>

      {/* AI Insight - Driver */}
      {driver && (
        <div className="p-3 bg-analytical-50 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-lg">🎯</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-analytical-900 mb-1">
                {driver.contribution > 0.4 ? 'Critical driver' : 'Key contributor'}
              </div>
              <div className="text-xs text-analytical-700">
                {Math.round(driver.contribution * 100)}% impact on outcome
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Insight - Critical Gap */}
      {criticalGap && (
        <div className="p-3 bg-creative-50 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-lg">⚠️</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-creative-900 mb-1">
                Critical evidence gap
              </div>
              <div className="text-xs text-creative-700">
                {criticalGap.recommendation || 'Add evidence to strengthen this relationship'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Properties */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-storm-600">Strength</span>
          <span className="font-medium">
            {edge.data?.weight?.toFixed(2) || 'Not set'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-storm-600">Belief</span>
          <span className="font-medium">
            {edge.data?.belief ? `${edge.data.belief}%` : 'Not set'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-storm-600">Evidence</span>
          <span
            className={`
            font-medium
            ${evidenceCount === 0 ? 'text-creative-600' : 'text-practical-600'}
          `}
          >
            {evidenceCount} {evidenceCount === 1 ? 'source' : 'sources'}
          </span>
        </div>
      </div>

      {/* Actions */}
      {(onAddEvidence || onExplain) && (
        <div className="pt-2 border-t border-storm-100 space-y-2">
          {onAddEvidence && (
            <Button
              size="sm"
              variant={evidenceCount === 0 ? 'primary' : 'outline'}
              fullWidth
              onClick={() => onAddEvidence(edge.id)}
            >
              {evidenceCount === 0 ? 'Add evidence' : 'Add more evidence'}
            </Button>
          )}
          {onExplain && driver && (
            <Button
              size="sm"
              variant="ghost"
              fullWidth
              onClick={() => onExplain(edge.id)}
            >
              Why is this important?
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
