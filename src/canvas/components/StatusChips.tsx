/**
 * Status chips showing engine limits and p95 budget (v1.2)
 * Displays nodes/edges caps and execution time budget
 */

import { Box, GitBranch, Clock } from 'lucide-react'
import { useEngineLimits } from '../hooks/useEngineLimits'

interface StatusChipsProps {
  currentNodes?: number
  currentEdges?: number
  className?: string
}

export function StatusChips({ currentNodes = 0, currentEdges = 0, className = '' }: StatusChipsProps) {
  const { limits, loading } = useEngineLimits()

  if (loading || !limits) return null

  const nodesPercent = Math.round((currentNodes / limits.nodes.max) * 100)
  const edgesPercent = Math.round((currentEdges / limits.edges.max) * 100)

  // Determine status color based on usage
  const getStatusColor = (percent: number) => {
    if (percent >= 90) return 'text-danger-700 bg-danger-50 border-danger-200'
    if (percent >= 70) return 'text-warning-700 bg-warning-50 border-warning-200'
    return 'text-gray-700 bg-gray-50 border-gray-200'
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} role="status" aria-label="Engine limits and budget">
      {/* Nodes */}
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium ${getStatusColor(nodesPercent)}`}
        title={`${currentNodes} / ${limits.nodes.max} nodes (${nodesPercent}%)`}
      >
        <Box className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="tabular-nums">
          {currentNodes} / {limits.nodes.max}
        </span>
      </div>

      {/* Edges */}
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium ${getStatusColor(edgesPercent)}`}
        title={`${currentEdges} / ${limits.edges.max} edges (${edgesPercent}%)`}
      >
        <GitBranch className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="tabular-nums">
          {currentEdges} / {limits.edges.max}
        </span>
      </div>

      {/* p95 Budget (v1.2 - optional) */}
      {limits.engine_p95_ms_budget !== undefined && (
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium text-info-700 bg-info-50 border-info-200"
          title={`Engine p95 budget: ${limits.engine_p95_ms_budget}ms`}
        >
          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="tabular-nums">
            {limits.engine_p95_ms_budget}ms
          </span>
        </div>
      )}
    </div>
  )
}
