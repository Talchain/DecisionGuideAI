/**
 * CompareView - Side-by-side comparison of runs with delta visualization
 *
 * Features:
 * - Side-by-side summary comparison
 * - Delta bars for driver changes (added/removed/common)
 * - Highlight changed drivers
 * - "Reveal on canvas" button to toggle highlighting
 */

import { useMemo, useRef, useCallback } from 'react'
import { ArrowUp, ArrowDown, Equal, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { compareRuns, type RunComparison } from '../store/runHistory'
import { deriveCompareAcrossRuns, type CompareDelta } from '../../lib/compare'
import { useCanvasStore } from '../store'

interface CompareViewProps {
  runIds: string[]
  onClose: () => void
}

export function CompareView({ runIds, onClose }: CompareViewProps) {
  // For now, compare first two runs
  const comparison = useMemo(() => {
    if (runIds.length < 2) return null
    return compareRuns(runIds[0], runIds[1])
  }, [runIds])

  // Derive debug comparison data (Phase 2+)
  const debugEnabled = import.meta.env.VITE_FEATURE_COMPARE_DEBUG === '1'
  const debugComparison = useMemo(() => {
    if (!debugEnabled || !comparison) return null

    const { runA, runB } = comparison

    // Check if both runs have debug.compare data
    const compareMapA = runA.report?.debug?.compare
    const compareMapB = runB.report?.debug?.compare

    if (!compareMapA || !compareMapB) return null

    // Derive cross-run deltas for each option (runA vs runB)
    const conservative = deriveCompareAcrossRuns(compareMapA, compareMapB, 'conservative')
    const likely = deriveCompareAcrossRuns(compareMapA, compareMapB, 'likely')
    const optimistic = deriveCompareAcrossRuns(compareMapA, compareMapB, 'optimistic')

    return { conservative, likely, optimistic }
  }, [debugEnabled, comparison])

  // Throttled edge highlight handler (10Hz = 100ms rate limit)
  const lastHighlightTime = useRef<number>(0)
  const setHighlightedDriver = useCanvasStore(s => s.setHighlightedDriver)
  const clearHighlightedDriver = useCanvasStore(s => s.clearHighlightedDriver)

  const handleEdgeHighlight = useCallback((edgeId: string) => {
    const now = Date.now()
    const timeSinceLastHighlight = now - lastHighlightTime.current

    // Throttle to 10Hz (100ms minimum interval)
    if (timeSinceLastHighlight < 100) {
      return
    }

    lastHighlightTime.current = now
    setHighlightedDriver({ kind: 'edge', id: edgeId })

    // Auto-clear highlight after 2 seconds
    setTimeout(() => {
      clearHighlightedDriver()
    }, 2000)
  }, [setHighlightedDriver, clearHighlightedDriver])

  if (!comparison) {
    return (
      <div
        className="p-4 rounded-lg border text-center"
        style={{
          backgroundColor: 'rgba(91, 108, 255, 0.05)',
          borderColor: 'rgba(91, 108, 255, 0.2)',
          color: 'var(--olumi-text)'
        }}
      >
        <p className="text-sm">
          Unable to load runs for comparison.
        </p>
        <button
          onClick={onClose}
          className="mt-2 px-3 py-1 rounded text-xs transition-colors"
          style={{
            backgroundColor: 'var(--olumi-primary)',
            color: 'white'
          }}
        >
          Close
        </button>
      </div>
    )
  }

  const { runA, runB, summaryChanged, driversAdded, driversRemoved, driversCommon } = comparison

  return (
    <div
      className="space-y-4 p-4 rounded-lg border"
      style={{
        backgroundColor: 'rgba(91, 108, 255, 0.05)',
        borderColor: 'rgba(91, 108, 255, 0.2)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold" style={{ color: 'var(--olumi-text)' }}>
          Compare Runs
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--olumi-text)' }}
          aria-label="Close comparison"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Run meta */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div
          className="p-2 rounded border"
          style={{
            backgroundColor: 'rgba(91, 108, 255, 0.08)',
            borderColor: 'rgba(91, 108, 255, 0.15)',
            color: 'rgba(232, 236, 245, 0.7)'
          }}
        >
          <div className="font-semibold mb-1">Run A</div>
          <div>Seed: {runA.seed}</div>
          <div>Hash: {runA.hash?.slice(0, 8) || 'N/A'}</div>
          <div>{formatTimestamp(runA.ts)}</div>
        </div>

        <div
          className="p-2 rounded border"
          style={{
            backgroundColor: 'rgba(91, 108, 255, 0.08)',
            borderColor: 'rgba(91, 108, 255, 0.15)',
            color: 'rgba(232, 236, 245, 0.7)'
          }}
        >
          <div className="font-semibold mb-1">Run B</div>
          <div>Seed: {runB.seed}</div>
          <div>Hash: {runB.hash?.slice(0, 8) || 'N/A'}</div>
          <div>{formatTimestamp(runB.ts)}</div>
        </div>
      </div>

      {/* Summary comparison */}
      {summaryChanged && (
        <div>
          <h4
            className="text-sm font-medium mb-2"
            style={{ color: 'var(--olumi-text)' }}
          >
            Summary Changed
          </h4>
          <div className="space-y-2">
            <div
              className="p-2 rounded text-xs"
              style={{
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                borderLeft: '3px solid var(--olumi-danger)'
              }}
            >
              <div
                className="font-medium mb-1"
                style={{ color: 'var(--olumi-danger)' }}
              >
                Before (A):
              </div>
              <div style={{ color: 'var(--olumi-text)' }}>{runA.summary}</div>
            </div>

            <div
              className="p-2 rounded text-xs"
              style={{
                backgroundColor: 'rgba(32, 201, 151, 0.1)',
                borderLeft: '3px solid var(--olumi-success)'
              }}
            >
              <div
                className="font-medium mb-1"
                style={{ color: 'var(--olumi-success)' }}
              >
                After (B):
              </div>
              <div style={{ color: 'var(--olumi-text)' }}>{runB.summary}</div>
            </div>
          </div>
        </div>
      )}

      {/* Driver deltas */}
      <div>
        <h4
          className="text-sm font-medium mb-2"
          style={{ color: 'var(--olumi-text)' }}
        >
          Driver Changes
        </h4>

        {/* Delta bars */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex-1 h-2 rounded overflow-hidden flex">
              {driversRemoved.length > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${(driversRemoved.length / (driversRemoved.length + driversAdded.length + driversCommon.length)) * 100}%`,
                    backgroundColor: 'var(--olumi-danger)'
                  }}
                  title={`${driversRemoved.length} removed`}
                />
              )}
              {driversCommon.length > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${(driversCommon.length / (driversRemoved.length + driversAdded.length + driversCommon.length)) * 100}%`,
                    backgroundColor: 'rgba(128, 128, 128, 0.5)'
                  }}
                  title={`${driversCommon.length} unchanged`}
                />
              )}
              {driversAdded.length > 0 && (
                <div
                  className="h-full"
                  style={{
                    width: `${(driversAdded.length / (driversRemoved.length + driversAdded.length + driversCommon.length)) * 100}%`,
                    backgroundColor: 'var(--olumi-success)'
                  }}
                  title={`${driversAdded.length} added`}
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <ArrowDown className="w-3 h-3" style={{ color: 'var(--olumi-danger)' }} />
              <span style={{ color: 'var(--olumi-text)' }}>
                {driversRemoved.length} removed
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Equal className="w-3 h-3" style={{ color: 'rgba(232, 236, 245, 0.5)' }} />
              <span style={{ color: 'var(--olumi-text)' }}>
                {driversCommon.length} unchanged
              </span>
            </div>
            <div className="flex items-center gap-1">
              <ArrowUp className="w-3 h-3" style={{ color: 'var(--olumi-success)' }} />
              <span style={{ color: 'var(--olumi-text)' }}>
                {driversAdded.length} added
              </span>
            </div>
          </div>
        </div>

        {/* Driver lists */}
        <div className="space-y-2">
          {driversRemoved.length > 0 && (
            <div>
              <div
                className="text-xs font-medium mb-1"
                style={{ color: 'var(--olumi-danger)' }}
              >
                Removed:
              </div>
              <div className="space-y-1">
                {driversRemoved.map((driver, i) => (
                  <div
                    key={i}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: 'rgba(255, 107, 107, 0.1)',
                      color: 'var(--olumi-text)'
                    }}
                  >
                    {driver.label || driver.id || 'Unnamed'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {driversAdded.length > 0 && (
            <div>
              <div
                className="text-xs font-medium mb-1"
                style={{ color: 'var(--olumi-success)' }}
              >
                Added:
              </div>
              <div className="space-y-1">
                {driversAdded.map((driver, i) => (
                  <div
                    key={i}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: 'rgba(32, 201, 151, 0.1)',
                      color: 'var(--olumi-text)'
                    }}
                  >
                    {driver.label || driver.id || 'Unnamed'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {driversCommon.length > 0 && (
            <div>
              <div
                className="text-xs font-medium mb-1"
                style={{ color: 'rgba(232, 236, 245, 0.7)' }}
              >
                Unchanged ({driversCommon.length}):
              </div>
              <div className="text-xs" style={{ color: 'rgba(232, 236, 245, 0.5)' }}>
                {driversCommon.map(d => d.label || d.id || 'Unnamed').join(', ')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Debug Comparison (Phase 2+) - Feature Flag Gated */}
      {debugEnabled && debugComparison && (
        <div>
          <h4
            className="text-sm font-medium mb-2 flex items-center gap-2"
            style={{ color: 'var(--olumi-primary)' }}
          >
            <span>Debug Analysis</span>
            <span
              className="px-2 py-0.5 rounded text-xs font-normal"
              style={{
                backgroundColor: 'rgba(91, 108, 255, 0.15)',
                color: 'var(--olumi-primary)'
              }}
            >
              Beta
            </span>
          </h4>

          <div className="space-y-3">
            {/* Conservative Option */}
            {debugComparison.conservative && (
              <DebugOptionSection
                title="Conservative"
                delta={debugComparison.conservative}
                color="var(--olumi-danger)"
                onEdgeClick={handleEdgeHighlight}
              />
            )}

            {/* Likely Option */}
            {debugComparison.likely && (
              <DebugOptionSection
                title="Likely"
                delta={debugComparison.likely}
                color="var(--olumi-primary)"
                onEdgeClick={handleEdgeHighlight}
              />
            )}

            {/* Optimistic Option */}
            {debugComparison.optimistic && (
              <DebugOptionSection
                title="Optimistic"
                delta={debugComparison.optimistic}
                color="var(--olumi-success)"
                onEdgeClick={handleEdgeHighlight}
              />
            )}
          </div>
        </div>
      )}

      {/* Close button */}
      <button
        onClick={onClose}
        className="w-full px-4 py-2 text-sm rounded-md border transition-colors"
        style={{
          borderColor: 'rgba(91, 108, 255, 0.3)',
          color: 'var(--olumi-text)'
        }}
      >
        Close
      </button>
    </div>
  )
}

/**
 * Format timestamp as relative time
 */
function formatTimestamp(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

/**
 * Debug Option Section - Display p10/p50/p90 deltas + Top-3 edges
 */
interface DebugOptionSectionProps {
  title: string
  delta: CompareDelta
  color: string
  onEdgeClick: (edgeId: string) => void
}

function DebugOptionSection({ title, delta, color, onEdgeClick }: DebugOptionSectionProps) {
  // Format delta with sign
  const formatDelta = (val: number) => {
    const sign = val >= 0 ? '+' : ''
    return `${sign}${val.toFixed(1)}`
  }

  // Get delta icon
  const getDeltaIcon = (val: number) => {
    if (val > 0) return <TrendingUp className="w-3 h-3" style={{ color: 'var(--olumi-success)' }} />
    if (val < 0) return <TrendingDown className="w-3 h-3" style={{ color: 'var(--olumi-danger)' }} />
    return <Minus className="w-3 h-3" style={{ color: 'rgba(232, 236, 245, 0.5)' }} />
  }

  return (
    <div
      className="p-3 rounded border"
      style={{
        backgroundColor: 'rgba(91, 108, 255, 0.05)',
        borderColor: 'rgba(91, 108, 255, 0.15)',
      }}
    >
      <div
        className="text-xs font-semibold mb-2"
        style={{ color }}
      >
        {title}
      </div>

      {/* p10/p50/p90 Grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {/* p10 */}
        <div
          className="p-2 rounded text-center"
          style={{
            backgroundColor: 'rgba(91, 108, 255, 0.08)',
          }}
        >
          <div className="text-xs font-medium mb-1" style={{ color: 'rgba(232, 236, 245, 0.6)' }}>
            p10
          </div>
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--olumi-text)' }}>
            {delta.p10.b.toFixed(1)}
          </div>
          <div className="flex items-center justify-center gap-1 text-xs">
            {getDeltaIcon(delta.p10.delta)}
            <span style={{ color: delta.p10.delta >= 0 ? 'var(--olumi-success)' : 'var(--olumi-danger)' }}>
              {formatDelta(delta.p10.delta)}
            </span>
          </div>
        </div>

        {/* p50 */}
        <div
          className="p-2 rounded text-center"
          style={{
            backgroundColor: 'rgba(91, 108, 255, 0.08)',
          }}
        >
          <div className="text-xs font-medium mb-1" style={{ color: 'rgba(232, 236, 245, 0.6)' }}>
            p50
          </div>
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--olumi-text)' }}>
            {delta.p50.b.toFixed(1)}
          </div>
          <div className="flex items-center justify-center gap-1 text-xs">
            {getDeltaIcon(delta.p50.delta)}
            <span style={{ color: delta.p50.delta >= 0 ? 'var(--olumi-success)' : 'var(--olumi-danger)' }}>
              {formatDelta(delta.p50.delta)}
            </span>
          </div>
        </div>

        {/* p90 */}
        <div
          className="p-2 rounded text-center"
          style={{
            backgroundColor: 'rgba(91, 108, 255, 0.08)',
          }}
        >
          <div className="text-xs font-medium mb-1" style={{ color: 'rgba(232, 236, 245, 0.6)' }}>
            p90
          </div>
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--olumi-text)' }}>
            {delta.p90.b.toFixed(1)}
          </div>
          <div className="flex items-center justify-center gap-1 text-xs">
            {getDeltaIcon(delta.p90.delta)}
            <span style={{ color: delta.p90.delta >= 0 ? 'var(--olumi-success)' : 'var(--olumi-danger)' }}>
              {formatDelta(delta.p90.delta)}
            </span>
          </div>
        </div>
      </div>

      {/* Top-3 Edges */}
      {delta.top3_edges.length > 0 && (
        <div>
          <div
            className="text-xs font-medium mb-1"
            style={{ color: 'rgba(232, 236, 245, 0.7)' }}
          >
            Top-3 Contributing Edges:
          </div>
          <div className="flex flex-wrap gap-1">
            {delta.top3_edges.map((edge, i) => (
              <button
                key={edge.edge_id}
                onClick={() => onEdgeClick(edge.edge_id)}
                className="px-2 py-1 rounded text-xs transition-colors cursor-pointer focus:outline-none focus:ring-2"
                style={{
                  backgroundColor: 'rgba(91, 108, 255, 0.15)',
                  color: 'var(--olumi-text)',
                  border: '1px solid rgba(91, 108, 255, 0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(91, 108, 255, 0.25)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(91, 108, 255, 0.15)'
                }}
                title={`Click to highlight edge: ${edge.from} → ${edge.to} (weight: ${edge.weight.toFixed(2)})`}
                aria-label={`Highlight edge from ${edge.from} to ${edge.to}`}
              >
                {edge.label || `${edge.from} → ${edge.to}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
