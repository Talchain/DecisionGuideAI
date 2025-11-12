/**
 * Status chips showing engine limits and p95 budget (v1.2)
 * Displays nodes/edges caps and execution time budget
 * Shows fallback/error states with timestamps (Sprint 1 & 2 Finalisation)
 *
 * B5 P1 Polish: Simplified to single clickable chip "Nodes X/Y • Edges A/B"
 */

import { AlertTriangle } from 'lucide-react'
import { useEngineLimits } from '../hooks/useEngineLimits'

interface StatusChipsProps {
  currentNodes?: number
  currentEdges?: number
  className?: string
  onClick?: () => void
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString()
}

export function StatusChips({ currentNodes = 0, currentEdges = 0, className = '', onClick }: StatusChipsProps) {
  const { limits, loading, error, fetchedAt, retry } = useEngineLimits()

  // Error state: limits unavailable
  if (error) {
    const timestamp = fetchedAt ? ` Last attempt: ${formatTimestamp(fetchedAt)}` : ''
    return (
      <button
        onClick={onClick || retry}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium text-danger-700 bg-danger-50 border-danger-200 hover:bg-danger-100 transition-colors cursor-pointer ${className}`}
        title={`Failed to load limits: ${error.message}${timestamp}\nClick to ${onClick ? 'view details' : 'retry'}`}
        aria-label="Limits unavailable - click for details"
      >
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Limits Unavailable</span>
      </button>
    )
  }

  // Loading state: show placeholder chip with live counts
  if (loading || !limits) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium text-gray-600 bg-gray-50 border-gray-200 transition-colors ${onClick ? 'cursor-pointer hover:bg-gray-100' : ''} ${className}`}
        title={`Loading limits...\nNodes: ${currentNodes}\nEdges: ${currentEdges}${onClick ? '\nClick for details' : ''}`}
        aria-label={`Graph usage: ${currentNodes} nodes, ${currentEdges} edges - limits loading${onClick ? ' - click for details' : ''}`}
        disabled={!onClick}
      >
        <span className="tabular-nums">
          Nodes {currentNodes}
        </span>
        <span className="text-gray-400">•</span>
        <span className="tabular-nums">
          Edges {currentEdges}
        </span>
      </button>
    )
  }

  const nodesPercent = Math.round((currentNodes / limits.nodes.max) * 100)
  const edgesPercent = Math.round((currentEdges / limits.edges.max) * 100)

  // Determine highest usage to set chip color
  const maxPercent = Math.max(nodesPercent, edgesPercent)
  const getChipColor = () => {
    if (maxPercent >= 90) return 'text-danger-700 bg-danger-50 border-danger-200 hover:bg-danger-100'
    if (maxPercent >= 70) return 'text-warning-700 bg-warning-50 border-warning-200 hover:bg-warning-100'
    return 'text-gray-700 bg-gray-50 border-gray-200 hover:bg-gray-100'
  }

  const timestamp = fetchedAt ? formatTimestamp(fetchedAt) : 'Unknown'

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${getChipColor()} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      title={`Nodes: ${currentNodes}/${limits.nodes.max} (${nodesPercent}%)\nEdges: ${currentEdges}/${limits.edges.max} (${edgesPercent}%)\nLast fetched: ${timestamp}${onClick ? '\nClick for details' : ''}`}
      aria-label={`Graph limits: ${currentNodes} of ${limits.nodes.max} nodes, ${currentEdges} of ${limits.edges.max} edges${onClick ? ' - click for details' : ''}`}
      disabled={!onClick}
    >
      <span className="tabular-nums">
        Nodes {currentNodes}/{limits.nodes.max}
      </span>
      <span className="text-gray-400">•</span>
      <span className="tabular-nums">
        Edges {currentEdges}/{limits.edges.max}
      </span>
    </button>
  )
}
