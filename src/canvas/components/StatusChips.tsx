/**
 * Status chips showing engine limits and p95 budget (v1.2)
 * Displays nodes/edges caps and execution time budget
 * Shows fallback/error states with timestamps (Sprint 1 & 2 Finalisation)
 *
 * B5 P1 Polish: Simplified to single clickable chip "Nodes X/Y • Edges A/B"
 */

import { AlertTriangle } from 'lucide-react'
import { useEngineLimits } from '../hooks/useEngineLimits'
import { deriveLimitsStatus } from '../utils/limitsStatus'
import { typography } from '../../styles/typography'

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
  const { limits, loading, error, fetchedAt, retry, source } = useEngineLimits()

  // Error state: limits unavailable
  if (error) {
    const timestamp = fetchedAt ? ` Last attempt: ${formatTimestamp(fetchedAt)}` : ''
    return (
      <button
        onClick={onClick || retry}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${typography.caption} font-medium text-danger bg-panel border-danger/30 hover:opacity-80 transition-colors cursor-pointer ${className}`}
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
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${typography.caption} font-medium text-gray-600 bg-gray-50 border-gray-200 transition-colors ${onClick ? 'cursor-pointer hover:bg-gray-100' : ''} ${className}`}
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

  const limitsStatus = deriveLimitsStatus(limits, currentNodes, currentEdges)

  const nodesPercent = limitsStatus?.nodes.percent ?? 0
  const edgesPercent = limitsStatus?.edges.percent ?? 0

  // Determine highest usage to set chip color
  const maxPercent = Math.max(nodesPercent, edgesPercent)
  const getChipColor = () => {
    if (maxPercent >= 90) return 'text-danger bg-panel border-danger/30 hover:opacity-80'
    if (maxPercent >= 70) return 'text-warning bg-panel border-warning/30 hover:opacity-80'
    return 'text-success bg-panel border-success/30 hover:opacity-80'
  }

  const timestamp = fetchedAt ? formatTimestamp(fetchedAt) : 'Unknown'
  const zoneLabel = limitsStatus?.zoneLabel ?? 'Comfortable'
  const sourceLabel = source === 'fallback' ? 'Fallback' : source === 'live' ? 'Live' : 'Unknown'

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${typography.caption} font-medium transition-colors ${getChipColor()} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      title={`Status: ${zoneLabel}\nNodes: ${currentNodes}/${limits.nodes.max} (${nodesPercent}%)\nEdges: ${currentEdges}/${limits.edges.max} (${edgesPercent}%)\nSource: ${sourceLabel}\nLast fetched: ${timestamp}${onClick ? '\nClick for details' : ''}`}
      aria-label={`Graph limits (${zoneLabel}): ${currentNodes} of ${limits.nodes.max} nodes, ${currentEdges} of ${limits.edges.max} edges${onClick ? ' - click for details' : ''}`}
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
