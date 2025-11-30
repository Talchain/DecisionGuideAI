/**
 * Node Tooltip Component
 *
 * Shows contextual information when hovering over a node:
 * - Node label and type
 * - Contribution percentage (if available)
 * - Quick actions (inspect, edit)
 */

import { useCanvasStore } from '@/canvas/store'
import { useResultsStore } from '@/canvas/stores/resultsStore'
import { useGuideStore } from '../../hooks/useGuideStore'
import { Button } from '../shared/Button'

export interface NodeTooltipProps {
  nodeId: string
  position: { x: number; y: number }
  contribution?: number
}

export function NodeTooltip({ nodeId, position, contribution }: NodeTooltipProps): JSX.Element | null {
  const nodes = useCanvasStore((state) => state.nodes)
  const report = useResultsStore((state) => state.report)
  const selectElement = useGuideStore((state) => state.selectElement)

  const node = nodes.find((n) => n.id === nodeId)
  if (!node) return null

  const label = node.data?.label || 'Untitled'
  const nodeType = node.data?.type || node.type || 'unknown'
  const driver = report?.drivers?.find((d) => d.node_id === nodeId)

  const handleInspect = () => {
    selectElement(nodeId)
  }

  return (
    <div
      className="fixed z-50 pointer-events-auto"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <div className="bg-white rounded-lg shadow-xl border border-storm-200 p-3 w-64">
        {/* Header */}
        <div className="mb-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-storm-600 uppercase">{nodeType}</span>
          </div>
          <div className="text-sm font-semibold text-charcoal-900">{label}</div>
        </div>

        {/* Contribution (if available) */}
        {contribution !== undefined && contribution > 0 && (
          <div className="mb-3 p-2 bg-analytical-50 rounded border border-analytical-200">
            <div className="text-xs text-analytical-800 mb-1">Impact on Outcome</div>
            <div className="text-lg font-bold text-analytical-900">
              {Math.round(contribution * 100)}%
            </div>
            {driver?.polarity && (
              <div className="text-xs text-storm-600 mt-1">
                {driver.polarity === 'up' && '↑ Increases likelihood'}
                {driver.polarity === 'down' && '↓ Decreases likelihood'}
                {driver.polarity === 'neutral' && '→ Neutral effect'}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-1">
          <Button variant="outline" size="sm" fullWidth onClick={handleInspect}>
            Inspect details
          </Button>
        </div>
      </div>
    </div>
  )
}
