/**
 * CompareView - Side-by-side comparison of runs with delta visualization
 *
 * Features:
 * - Side-by-side summary comparison
 * - Delta bars for driver changes (added/removed/common)
 * - Highlight changed drivers
 * - "Reveal on canvas" button to toggle highlighting
 */

import { useMemo } from 'react'
import { ArrowUp, ArrowDown, Equal, X } from 'lucide-react'
import { compareRuns, type RunComparison } from '../store/runHistory'

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
