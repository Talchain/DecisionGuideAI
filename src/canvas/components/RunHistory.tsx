/**
 * RunHistory - List of recent analysis runs with pin/delete/compare
 *
 * Features:
 * - Last 20 runs, latest first
 * - Pin up to 5 runs (pinned always visible)
 * - Multi-select for comparison (up to 3)
 * - Quick actions: View, Pin, Delete
 * - Compact mini-sparkline visualization
 * - Live refresh: Updates automatically when runs change (same-tab and cross-tab)
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { Pin, Trash2, Eye, GitCompare } from 'lucide-react'
import { useCanvasStore } from '../store'
import { loadRuns, togglePin, deleteRun, computeRunSummary, STORAGE_KEY, type StoredRun } from '../store/runHistory'
import * as runsBus from '../store/runsBus'
import { selectScenarioLastRun } from '../shared/lastRun'
import { trackHistoryItemSelected } from '../utils/sandboxTelemetry'
import { typography } from '../../styles/typography'

interface RunHistoryProps {
  // eslint-disable-next-line no-unused-vars
  onViewRun: (run: StoredRun) => void
  // eslint-disable-next-line no-unused-vars
  onCompare: (runIds: string[]) => void
}

export function RunHistory({ onViewRun, onCompare }: RunHistoryProps) {
  const [runs, setRuns] = useState<StoredRun[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const scenarioTitle = useCanvasStore(s => s.currentScenarioFraming?.title ?? null)
  const scenarioLastResultHash = useCanvasStore(s => s.currentScenarioLastResultHash ?? null)
  const currentResultsHash = useCanvasStore(s => s.results.hash ?? null)

  /**
   * Debounced refresh function
   * Uses requestAnimationFrame to throttle updates and preserve selection
   */
  const applyRefresh = useMemo(() => {
    let rafId: number | null = null
    let debounceTimer: ReturnType<typeof setTimeout> | null = null

    return () => {
      // Cancel any pending RAF
      if (rafId) {
        window.cancelAnimationFrame(rafId)
        rafId = null
      }

      // Clear any pending debounce
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      // Debounce to 200ms to prevent render storms
      debounceTimer = setTimeout(() => {
        rafId = window.requestAnimationFrame(() => {
          const nextRuns = loadRuns()
          setRuns(nextRuns)

          // Preserve selection for IDs that still exist
          setSelectedIds(prev => {
            const nextIds = new Set(nextRuns.map(r => r.id))
            const preserved = new Set([...prev].filter(id => nextIds.has(id)))
            return preserved.size === prev.size ? prev : preserved
          })

          rafId = null
        })
      }, 200)
    }
  }, [])

  const scenarioLastRunId = useMemo(() => {
    if (!runs.length) return null

    const selected = selectScenarioLastRun({
      runs,
      scenarioLastResultHash,
      currentResultsHash,
    })

    return selected?.id ?? null
  }, [runs, scenarioLastResultHash, currentResultsHash])

  /**
   * Subscribe to runs updates
   * - Same-tab: runsBus events
   * - Cross-tab: storage events
   * - Visibility: refresh when tab becomes visible
   */
  useEffect(() => {
    // Initial load
    applyRefresh()

    // Same-tab updates via bus
    const unsubscribe = runsBus.on(applyRefresh)

    // Cross-tab updates via storage event
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        applyRefresh()
      }
    }
    window.addEventListener('storage', onStorage)

    // Refresh when tab becomes visible (handles background updates)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        applyRefresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    // Cleanup
    return () => {
      unsubscribe()
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [applyRefresh])

  const handleTogglePin = useCallback((runId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    togglePin(runId)
    // No manual refresh needed - bus will emit and trigger applyRefresh
  }, [])

  const handleDelete = useCallback((runId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Delete this run?')) {
      deleteRun(runId)
      // No manual refresh needed - bus will emit and trigger applyRefresh
      // Selection will be preserved automatically via applyRefresh
    }
  }, [])

  const handleToggleSelect = useCallback((runId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(runId)) {
        next.delete(runId)
        return next
      }
      if (next.size >= 3) {
        // Max 3 selections
        return prev
      }
      next.add(runId)
      trackHistoryItemSelected()
      return next
    })
  }, [])

  const handleCompare = useCallback(() => {
    if (selectedIds.size < 2) return
    onCompare(Array.from(selectedIds))
    setSelectedIds(new Set())
  }, [selectedIds, onCompare])

  if (runs.length === 0) {
    return (
      <div className={`text-center py-4 ${typography.body} text-gray-400`} data-testid="run-history-empty">
        {scenarioTitle && (
          <div className={`mb-1 ${typography.caption} text-gray-500`} data-testid="run-history-scenario-context">
            Current decision:{' '}
            <span className="font-medium text-gray-900">{scenarioTitle}</span>
          </div>
        )}
        <div>
          {scenarioTitle
            ? 'No runs yet for this decision. Run an analysis to build history.'
            : 'No runs yet. Run an analysis to build history.'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {scenarioTitle && (
        <div
          className={`${typography.caption} text-gray-500`}
          data-testid="run-history-scenario-context"
        >
          Current decision:{' '}
          <span className="font-medium text-gray-900">{scenarioTitle}</span>
        </div>
      )}
      {/* Compare CTA */}
      {selectedIds.size >= 2 && (
        <button
          onClick={handleCompare}
          className={`w-full px-3 py-2 rounded-md border border-info-500 bg-info-500 hover:bg-info-600 text-white transition-colors flex items-center justify-center gap-2 ${typography.label}`}
        >
          <GitCompare className="w-4 h-4" />
          Compare {selectedIds.size} runs
        </button>
      )}

      {/* Run list */}
      <div className="space-y-1">
        {runs.map((run, index) => {
          const isSelected = selectedIds.has(run.id)
          const isPinned = run.isPinned
          const isScenarioLastRun = scenarioLastRunId === run.id

          // Get prior run for delta computation (immediately preceding run)
          const priorRun = index < runs.length - 1 ? runs[index + 1] : undefined

          // Compute p50 summary
          const summary = computeRunSummary(run, priorRun)

          return (
            <div
              key={run.id}
              className={`p-2 rounded border transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-blue-100 border-blue-400'
                  : 'bg-blue-50 border-blue-200 hover:bg-blue-100'
              }`}
              onClick={() => handleToggleSelect(run.id)}
            >
              {/* Header: Seed • Hash • Time */}
              <div className={`flex items-center justify-between ${typography.caption} mb-1`}>
                <div className="flex items-center gap-2 text-gray-500">
                  <span>Seed: {run.seed}</span>
                  <span>•</span>
                  <span title={run.hash}>
                    Hash: {run.hash?.slice(0, 6) || 'N/A'}
                  </span>
                </div>
                <span className="text-gray-400">
                  {formatTimestamp(run.ts)}
                </span>
              </div>

              {/* P50 Summary: "p50 0.62 (Δ −0.05) · 3 edges changed" */}
              <div className={`${typography.caption} text-gray-600 mb-1 font-mono`}>
                <span>{summary.p50Text}</span>
                {summary.deltaText && (
                  <>
                    <span className="mx-1">·</span>
                    <span>{summary.deltaText}</span>
                  </>
                )}
                {summary.edgesChangedText && (
                  <>
                    <span className="mx-1">·</span>
                    <span>{summary.edgesChangedText}</span>
                  </>
                )}
              </div>

              {/* Original Summary */}
              <div className={`${typography.body} mb-2 line-clamp-2 text-gray-900`}>
                {run.summary || 'No summary'}
              </div>

              {isScenarioLastRun && scenarioTitle && (
                <div
                  className={`mt-1 ${typography.caption} font-medium text-blue-700`}
                  data-testid="run-history-scenario-last-run"
                >
                  Last run for this decision
                </div>
              )}

              {/* v1.2: Duplicate indicator */}
              {run.isDuplicate && run.duplicateCount && (
                <div className="mb-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 ${typography.caption} font-medium rounded-full bg-info-50 border border-info-200 text-info-700`}
                    title={`This result has been re-run ${run.duplicateCount} times with identical output`}
                  >
                    Re-run (identical × {run.duplicateCount})
                  </span>
                </div>
              )}

              {/* Mini sparkline (optional) */}
              {run.drivers && run.drivers.length > 0 && (
                <div className="flex items-center gap-1 mb-2">
                  {run.drivers.slice(0, 5).map((driver, i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded bg-info-500"
                      title={driver.label || driver.id}
                    />
                  ))}
                  {run.drivers.length > 5 && (
                    <span className={`${typography.caption} text-gray-400`}>
                      +{run.drivers.length - 5}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onViewRun(run)
                  }}
                  className={`px-2 py-1 rounded ${typography.caption} bg-info-100 text-info-600 hover:bg-info-200 transition-colors`}
                  title="View"
                  aria-label="View"
                >
                  <Eye className="w-3 h-3" />
                </button>

                <button
                  onClick={(e) => handleTogglePin(run.id, e)}
                  className={`px-2 py-1 rounded ${typography.caption} transition-colors ${
                    isPinned
                      ? 'bg-warning-100 text-warning-600 hover:bg-warning-200'
                      : 'bg-info-100 text-gray-600 hover:bg-info-200'
                  }`}
                  title={isPinned ? 'Unpin' : 'Pin'}
                  aria-label={isPinned ? 'Unpin' : 'Pin'}
                >
                  <Pin className="w-3 h-3" />
                </button>

                <button
                  onClick={(e) => handleDelete(run.id, e)}
                  className={`px-2 py-1 rounded ${typography.caption} bg-red-100 text-red-600 hover:bg-red-200 transition-colors`}
                  title="Delete"
                  aria-label="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
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
