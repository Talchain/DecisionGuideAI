/**
 * Status chips showing engine limits and p95 budget (v1.2)
 * Displays nodes/edges caps and execution time budget
 * Shows fallback/error states with timestamps (Sprint 1 & 2 Finalisation)
 */

import { Box, GitBranch, Clock, AlertTriangle, Database } from 'lucide-react'
import { useEngineLimits } from '../hooks/useEngineLimits'

interface StatusChipsProps {
  currentNodes?: number
  currentEdges?: number
  className?: string
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

export function StatusChips({ currentNodes = 0, currentEdges = 0, className = '' }: StatusChipsProps) {
  const { limits, source, loading, error, fetchedAt, retry } = useEngineLimits()

  // Error state: limits unavailable (orange)
  if (error) {
    const timestamp = fetchedAt ? ` Last attempt: ${formatTimestamp(fetchedAt)}` : ''
    return (
      <div className={`flex items-center gap-2 ${className}`} role="alert" aria-label="Limits unavailable">
        <button
          onClick={retry}
          className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium text-danger-700 bg-danger-50 border-danger-200 hover:bg-danger-100 transition-colors cursor-pointer"
          title={`Failed to load limits: ${error.message}${timestamp}\nClick to retry`}
        >
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Limits Unavailable</span>
        </button>
      </div>
    )
  }

  if (loading || !limits) return null

  const nodesPercent = Math.round((currentNodes / limits.nodes.max) * 100)
  const edgesPercent = Math.round((currentEdges / limits.edges.max) * 100)

  // Determine status color based on usage
  const getStatusColor = (percent: number) => {
    if (percent >= 90) return 'text-danger-700 bg-danger-50 border-danger-200'
    if (percent >= 70) return 'text-warning-700 bg-warning-50 border-warning-200'
    return 'text-gray-700 bg-gray-50 border-gray-200'
  }

  const timestamp = fetchedAt ? formatTimestamp(fetchedAt) : 'Unknown'

  return (
    <div className={`flex items-center gap-2 ${className}`} role="status" aria-label="Engine limits and budget">
      {/* Fallback indicator (yellow) - only in fallback mode */}
      {source === 'fallback' && (
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium text-warning-700 bg-warning-50 border-warning-200"
          title={`Using fallback limits (live endpoint unavailable)\nLast fetched: ${timestamp}\nClick to retry`}
          onClick={retry}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              retry()
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <Database className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Fallback</span>
        </div>
      )}

      {/* Nodes */}
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium ${getStatusColor(nodesPercent)}`}
        title={`${currentNodes} / ${limits.nodes.max} nodes (${nodesPercent}%)\nSource: ${source || 'unknown'}\nLast fetched: ${timestamp}`}
      >
        <Box className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="tabular-nums">
          {currentNodes} / {limits.nodes.max}
        </span>
      </div>

      {/* Edges */}
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium ${getStatusColor(edgesPercent)}`}
        title={`${currentEdges} / ${limits.edges.max} edges (${edgesPercent}%)\nSource: ${source || 'unknown'}\nLast fetched: ${timestamp}`}
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
          title={`Engine p95 budget: ${limits.engine_p95_ms_budget}ms\nSource: ${source || 'unknown'}\nLast fetched: ${timestamp}`}
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
