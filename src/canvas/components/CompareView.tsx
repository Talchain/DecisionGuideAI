/**
 * CompareView - Side-by-side comparison of runs with delta visualization
 *
 * Features:
 * - Side-by-side summary comparison
 * - Delta bars for driver changes (added/removed/common)
 * - Highlight changed drivers
 * - "Reveal on canvas" button to toggle highlighting
 *
 * Note: This component is designed as tab content (not a standalone panel)
 * It's displayed within ResultsPanel's Compare tab
 */

import { useMemo } from 'react'
import { ArrowUp, ArrowDown, Equal } from 'lucide-react'
import { compareRuns, type RunComparison } from '../store/runHistory'
import { PanelSection } from '../panels/_shared/PanelSection'

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
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-gray-600 mb-4">
          Unable to load runs for comparison.
        </p>
        <p className="text-xs text-gray-500">
          Switch to the History tab to select runs.
        </p>
      </div>
    )
  }

  const { runA, runB, summaryChanged, driversAdded, driversRemoved, driversCommon } = comparison

  return (
    <>
      {/* Run Metadata */}
      <PanelSection title="Run Details">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div className="font-semibold text-gray-900 mb-2">Run A</div>
            <div className="space-y-1 text-gray-600">
              <div>Seed: {runA.seed}</div>
              <div>Hash: <code className="text-xs">{runA.hash?.slice(0, 8) || 'N/A'}</code></div>
              <div className="text-gray-500">{formatTimestamp(runA.ts)}</div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
            <div className="font-semibold text-gray-900 mb-2">Run B</div>
            <div className="space-y-1 text-gray-600">
              <div>Seed: {runB.seed}</div>
              <div>Hash: <code className="text-xs">{runB.hash?.slice(0, 8) || 'N/A'}</code></div>
              <div className="text-gray-500">{formatTimestamp(runB.ts)}</div>
            </div>
          </div>
        </div>
      </PanelSection>

      {/* Summary comparison */}
      {summaryChanged && (
        <PanelSection title="Summary Changed">
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-red-50 border-l-4 border-red-500">
              <div className="text-xs font-semibold text-red-700 mb-2">
                Before (Run A):
              </div>
              <div className="text-sm text-gray-900">{runA.summary}</div>
            </div>

            <div className="p-3 rounded-lg bg-green-50 border-l-4 border-green-500">
              <div className="text-xs font-semibold text-green-700 mb-2">
                After (Run B):
              </div>
              <div className="text-sm text-gray-900">{runB.summary}</div>
            </div>
          </div>
        </PanelSection>
      )}

      {/* Driver deltas */}
      <PanelSection title="Driver Changes">
        {/* Delta bars */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-2 rounded-full overflow-hidden flex bg-gray-100">
              {driversRemoved.length > 0 && (
                <div
                  className="h-full bg-red-500"
                  style={{
                    width: `${(driversRemoved.length / (driversRemoved.length + driversAdded.length + driversCommon.length)) * 100}%`
                  }}
                  title={`${driversRemoved.length} removed`}
                />
              )}
              {driversCommon.length > 0 && (
                <div
                  className="h-full bg-gray-400"
                  style={{
                    width: `${(driversCommon.length / (driversRemoved.length + driversAdded.length + driversCommon.length)) * 100}%`
                  }}
                  title={`${driversCommon.length} unchanged`}
                />
              )}
              {driversAdded.length > 0 && (
                <div
                  className="h-full bg-green-500"
                  style={{
                    width: `${(driversAdded.length / (driversRemoved.length + driversAdded.length + driversCommon.length)) * 100}%`
                  }}
                  title={`${driversAdded.length} added`}
                />
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-1.5">
              <ArrowDown className="w-3 h-3 text-red-600" />
              <span>{driversRemoved.length} removed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Equal className="w-3 h-3 text-gray-400" />
              <span>{driversCommon.length} unchanged</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowUp className="w-3 h-3 text-green-600" />
              <span>{driversAdded.length} added</span>
            </div>
          </div>
        </div>

        {/* Driver lists */}
        <div className="space-y-3">
          {driversRemoved.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-red-700 mb-2">
                Removed:
              </div>
              <div className="space-y-1.5">
                {driversRemoved.map((driver, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-lg text-xs bg-red-50 border border-red-200 text-gray-900"
                  >
                    {driver.label || driver.id || 'Unnamed'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {driversAdded.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-green-700 mb-2">
                Added:
              </div>
              <div className="space-y-1.5">
                {driversAdded.map((driver, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-lg text-xs bg-green-50 border border-green-200 text-gray-900"
                  >
                    {driver.label || driver.id || 'Unnamed'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {driversCommon.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-600 mb-2">
                Unchanged ({driversCommon.length}):
              </div>
              <div className="text-xs text-gray-500 leading-relaxed">
                {driversCommon.map(d => d.label || d.id || 'Unnamed').join(', ')}
              </div>
            </div>
          )}
        </div>
      </PanelSection>
    </>
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
