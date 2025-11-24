/**
 * LimitsPanel - Displays detailed engine limits information
 *
 * Shows node/edge capacity, p95 budget, and source information
 * Opened by clicking the status chip in the top-right
 */

import { Box, GitBranch, Clock, Database, AlertTriangle, RefreshCw } from 'lucide-react'
import { BottomSheet } from './BottomSheet'
import { useEngineLimits } from '../hooks/useEngineLimits'
import { deriveLimitsStatus } from '../utils/limitsStatus'
import { typography } from '../../styles/typography'

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

/**
 * Phase 3: Enhanced progress bar with soft/hard limit awareness
 */
function ProgressBar({
  current,
  soft,
  hard,
  label
}: {
  current: number
  soft: number
  hard: number
  label: string
}) {
  const percentage = (current / soft) * 100
  const isWarning = current > soft * 0.8
  const isDanger = current > soft

  const barColor = isDanger ? 'bg-carrot-500' :
                   isWarning ? 'bg-sun-500' : 'bg-mint-500'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={typography.label}>{label}</span>
        <span className={`${typography.body} tabular-nums`}>
          {current} / {soft}
        </span>
      </div>

      <div className="relative h-2 bg-sand-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
        {current > soft && (
          <div className="absolute top-0 right-0 h-full w-1 bg-carrot-700" />
        )}
      </div>

      {isDanger && (
        <p className={`${typography.caption} text-carrot-700`}>
          Exceeds recommended limit (hard cap: {hard})
        </p>
      )}
    </div>
  )
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
          <h3 className="text-lg font-medium text-ink-900 mb-2">Limits Unavailable</h3>
          <p className="text-sm text-ink-900/70 mb-4">
            {error.message}
          </p>
          <p className="text-xs text-ink-900/60 mb-4">
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
          <p className="text-sm text-ink-900/70">Loading limits...</p>
        </div>
      )
    }

    const limitsStatus = deriveLimitsStatus(limits, currentNodes, currentEdges)
    const timestamp = fetchedAt ? formatTimestamp(fetchedAt) : 'Unknown'

    return (
      <div className="space-y-6">
        {/* Source Info */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-paper-50 border border-sand-200">
          <div className="flex items-center gap-2 text-sm">
            <Database className="w-4 h-4 text-ink-900/70" />
            <span className="text-ink-900/80">
              Source: <span className="font-medium text-ink-900">{source === 'live' ? 'Live' : 'Fallback'}</span>
            </span>
          </div>
          <div className="text-xs text-ink-900/60">
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

        {limitsStatus && (
          <div className="p-3 rounded-lg bg-paper-50 border border-sand-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-900">{limitsStatus.zoneLabel}</span>
            </div>
            <p className="mt-1 text-xs text-ink-900/70">
              {limitsStatus.message}
            </p>
            <p className="mt-1 text-[11px] text-ink-900/60">
              Current limits: up to {limits.nodes.max} nodes and {limits.edges.max} edges per run.
            </p>
          </div>
        )}

        {/* Phase 3: Enhanced progress bars with soft/hard limits */}
        <div className="space-y-3">
          <ProgressBar
            current={currentNodes}
            soft={limits.nodes.max}
            hard={Math.ceil(limits.nodes.max * 1.5)}
            label="Nodes"
          />

          <ProgressBar
            current={currentEdges}
            soft={limits.edges.max}
            hard={Math.ceil(limits.edges.max * 1.5)}
            label="Edges"
          />
        </div>

        {/* p95 Budget (optional) */}
        {limits.engine_p95_ms_budget !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-ink-900/70" />
                <span className="text-sm font-medium text-ink-900">Engine p95 Budget</span>
              </div>
              <div className="text-sm tabular-nums">
                <span className="font-semibold text-info-600">{limits.engine_p95_ms_budget}ms</span>
              </div>
            </div>
            <p className="text-xs text-ink-900/70">
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
