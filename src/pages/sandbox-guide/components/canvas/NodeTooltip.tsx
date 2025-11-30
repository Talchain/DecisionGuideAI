/**
 * Node Tooltip Component
 *
 * Rich tooltip for nodes showing:
 * - Node label and type
 * - Driver status and rank
 * - Bias warnings
 * - Connection counts
 * - Actionable buttons (inspect, edit, view connections)
 */

import type { Node } from '@xyflow/react'
import { useCanvasStore } from '@/canvas/store'
import { useResultsStore } from '@/canvas/stores/resultsStore'
import { useGuideStore } from '../../hooks/useGuideStore'
import { Button } from '../shared/Button'

export interface NodeTooltipProps {
  node: Node
  onViewConnections?: (nodeId: string) => void
  onEdit?: (nodeId: string) => void
}

export function NodeTooltip({
  node,
  onViewConnections,
  onEdit,
}: NodeTooltipProps): JSX.Element {
  const report = useResultsStore((state) => state.report)
  const selectElement = useGuideStore((state) => state.selectElement)
  const edges = useCanvasStore((state) => state.edges)

  const driver = report?.drivers?.find((d: any) => d.node_id === node.id)
  const driverRank = driver
    ? report.drivers.findIndex((d: any) => d.node_id === node.id) + 1
    : null

  // Count connections
  const outgoingEdges = edges.filter((e) => e.source === node.id)
  const incomingEdges = edges.filter((e) => e.target === node.id)

  // Get node label and type
  const label = node.data?.label || node.id
  const nodeType = node.data?.type || node.type || 'Node'

  const handleInspect = () => {
    selectElement(node.id)
  }

  return (
    <div
      className="
        bg-white rounded-lg shadow-xl border border-storm-200
        p-4 min-w-[240px] max-w-[280px]
        space-y-3
      "
      role="tooltip"
    >
      {/* Header */}
      <div className="space-y-1">
        <div className="text-xs text-storm-500 uppercase tracking-wide">
          {nodeType}
        </div>
        <div className="font-medium text-charcoal-900">{label}</div>
      </div>

      {/* Driver Status */}
      {driver && (
        <div className="p-3 bg-analytical-50 rounded-lg text-sm">
          <div className="flex items-center gap-2 mb-1">
            <span>🎯</span>
            <span className="font-medium text-analytical-900">
              Top {driverRank} driver
            </span>
          </div>
          <div className="text-xs text-analytical-700">
            {driver.explanation || `${Math.round(driver.contribution * 100)}% impact on outcome`}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-storm-600">Influences</span>
          <span className="font-medium">{outgoingEdges.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-storm-600">Influenced by</span>
          <span className="font-medium">{incomingEdges.length}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-2 border-t border-storm-100 space-y-2">
        <Button size="sm" variant="outline" fullWidth onClick={handleInspect}>
          Inspect details
        </Button>
        {onViewConnections && (
          <Button
            size="sm"
            variant="ghost"
            fullWidth
            onClick={() => onViewConnections(node.id)}
          >
            View connections
          </Button>
        )}
        {onEdit && (
          <Button
            size="sm"
            variant="ghost"
            fullWidth
            onClick={() => onEdit(node.id)}
          >
            Edit properties
          </Button>
        )}
      </div>
    </div>
  )
}
