/**
 * LimitsPanel - Displays detailed engine limits information
 *
 * Shows node/edge capacity, p95 budget, and source information
 * Opened by clicking the status chip in the top-right
 */

import { Box, GitBranch, Clock, Database, AlertTriangle, RefreshCw } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { useEngineLimits } from '../hooks/useEngineLimits'

interface LimitsPanelProps {
  isOpen: boolean
  onClose: () => void
  currentNodes: number
  currentEdges: number
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

export function LimitsPanel({ isOpen, onClose, currentNodes, currentEdges }: LimitsPanelProps) {
  const { limits, source, loading, error, fetchedAt, retry } = useEngineLimits()

  if (!isOpen) return null

  const renderContent = () => {
    // Error state
    if (error) {
      const timestamp = fetchedAt ? formatTimestamp(fetchedAt) : 'Unknown'
      return (
        <div className="py-6 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-danger-500" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Limits Unavailable</h3>
          <p className="text-sm text-gray-600 mb-4">
            {error.message}
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Last attempt: {timestamp}
          </p>
          <button
            onClick={retry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-info-600 text-white rounded-lg hover:bg-info-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )
    }

    if (loading || !limits) {
      return (
        <div className="py-12 text-center">
          <div className="w-8 h-8 mx-auto mb-4 border-4 border-info-200 border-t-info-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading limits...</p>
        </div>
      )
    }

    const nodesPercent = Math.round((currentNodes / limits.nodes.max) * 100)
    const edgesPercent = Math.round((currentEdges / limits.edges.max) * 100)
    const timestamp = fetchedAt ? formatTimestamp(fetchedAt) : 'Unknown'

    const getStatusColor = (percent: number) => {
      if (percent >= 90) return 'text-danger-600'
      if (percent >= 70) return 'text-warning-600'
      return 'text-success-600'
    }

    const getProgressColor = (percent: number) => {
      if (percent >= 90) return 'bg-danger-500'
      if (percent >= 70) return 'bg-warning-500'
      return 'bg-success-500'
    }

    return (
      <div className="space-y-6">
        {/* Source Info */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
          <div className="flex items-center gap-2 text-sm">
            <Database className="w-4 h-4 text-gray-500" />
            <span className="text-gray-700">
              Source: <span className="font-medium">{source === 'live' ? 'Live' : 'Fallback'}</span>
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Fetched: {timestamp}
          </div>
        </div>

        {source === 'fallback' && (
          <div className="p-3 rounded-lg bg-warning-50 border border-warning-200">
            <p className="text-sm text-warning-800">
              Using fallback limits because the live endpoint is unavailable.
            </p>
            <button
              onClick={retry}
              className="mt-2 text-sm text-warning-700 hover:text-warning-800 underline"
            >
              Retry connection
            </button>
          </div>
        )}

        {/* Nodes */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">Nodes</span>
            </div>
            <div className="text-sm tabular-nums">
              <span className={`font-semibold ${getStatusColor(nodesPercent)}`}>
                {currentNodes}
              </span>
              <span className="text-gray-500"> / {limits.nodes.max}</span>
              <span className="ml-2 text-gray-400">({nodesPercent}%)</span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressColor(nodesPercent)}`}
              style={{ width: `${Math.min(nodesPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Edges */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-900">Edges</span>
            </div>
            <div className="text-sm tabular-nums">
              <span className={`font-semibold ${getStatusColor(edgesPercent)}`}>
                {currentEdges}
              </span>
              <span className="text-gray-500"> / {limits.edges.max}</span>
              <span className="ml-2 text-gray-400">({edgesPercent}%)</span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${getProgressColor(edgesPercent)}`}
              style={{ width: `${Math.min(edgesPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* p95 Budget (optional) */}
        {limits.engine_p95_ms_budget !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Engine p95 Budget</span>
              </div>
              <div className="text-sm tabular-nums">
                <span className="font-semibold text-info-600">{limits.engine_p95_ms_budget}ms</span>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Maximum expected execution time (95th percentile)
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Engine Limits">
      {renderContent()}
    </BottomSheet>
  )
}
