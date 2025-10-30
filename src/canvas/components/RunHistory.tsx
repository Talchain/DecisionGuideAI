/**
 * RunHistory - List of recent analysis runs with pin/delete/compare
 *
 * Features:
 * - Last 20 runs, latest first
 * - Pin up to 5 runs (pinned always visible)
 * - Multi-select for comparison (up to 3)
 * - Quick actions: View, Pin, Delete
 * - Compact mini-sparkline visualization
 * - Virtualized list when >20 items (performance optimization)
 */

import { useState, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Pin, Trash2, Eye, GitCompare } from 'lucide-react'
import { loadRuns, togglePin, deleteRun, type StoredRun } from '../store/runHistory'

interface RunHistoryProps {
  onViewRun: (run: StoredRun) => void
  onCompare: (runIds: string[]) => void
}

export function RunHistory({ onViewRun, onCompare }: RunHistoryProps) {
  const [runs, setRuns] = useState<StoredRun[]>(() => loadRuns())
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const parentRef = useRef<HTMLDivElement>(null)

  // Virtualize when >20 items for performance
  const shouldVirtualize = runs.length > 20

  const virtualizer = useVirtualizer({
    count: runs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Approximate height of each item
    overscan: 5, // Render 5 items outside viewport
    enabled: shouldVirtualize,
  })

  const refreshRuns = useCallback(() => {
    setRuns(loadRuns())
  }, [])

  const handleTogglePin = useCallback((runId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    togglePin(runId)
    refreshRuns()
  }, [refreshRuns])

  const handleDelete = useCallback((runId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('Delete this run?')) {
      deleteRun(runId)
      refreshRuns()
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(runId)
        return next
      })
    }
  }, [refreshRuns])

  const handleToggleSelect = useCallback((runId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(runId)) {
        next.delete(runId)
      } else {
        if (next.size >= 3) {
          // Max 3 selections
          return prev
        }
        next.add(runId)
      }
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
      <div
        className="text-center py-4 text-sm"
        style={{ color: 'rgba(232, 236, 245, 0.5)' }}
      >
        No runs yet. Run an analysis to build history.
      </div>
    )
  }

  // Helper to render a single run item (used in both virtualized and non-virtualized modes)
  const renderRunItem = useCallback((run: StoredRun) => {
    const isSelected = selectedIds.has(run.id)
    const isPinned = run.isPinned

    return (
      <div
        key={run.id}
        className="p-2 rounded border transition-colors cursor-pointer"
        style={{
          backgroundColor: isSelected
            ? 'rgba(91, 108, 255, 0.15)'
            : 'rgba(91, 108, 255, 0.05)',
          borderColor: isSelected
            ? 'rgba(91, 108, 255, 0.4)'
            : 'rgba(91, 108, 255, 0.15)'
        }}
        onClick={() => handleToggleSelect(run.id)}
      >
        {/* Header: Seed • Hash • Time */}
        <div className="flex items-center justify-between text-xs mb-1">
          <div
            className="flex items-center gap-2"
            style={{ color: 'rgba(232, 236, 245, 0.7)' }}
          >
            <span>Seed: {run.seed}</span>
            <span>•</span>
            <span title={run.hash}>
              Hash: {run.hash?.slice(0, 6) || 'N/A'}
            </span>
          </div>
          <span style={{ color: 'rgba(232, 236, 245, 0.5)' }}>
            {formatTimestamp(run.ts)}
          </span>
        </div>

        {/* Summary */}
        <div
          className="text-sm mb-2 line-clamp-2"
          style={{ color: 'var(--olumi-text)' }}
        >
          {run.summary || 'No summary'}
        </div>

        {/* Mini sparkline (optional) */}
        {run.drivers && run.drivers.length > 0 && (
          <div className="flex items-center gap-1 mb-2">
            {run.drivers.slice(0, 5).map((driver, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded"
                style={{
                  backgroundColor:
                    driver.kind === 'node'
                      ? 'var(--olumi-primary)'
                      : 'var(--olumi-info)'
                }}
                title={driver.label || driver.id}
              />
            ))}
            {run.drivers.length > 5 && (
              <span
                className="text-xs"
                style={{ color: 'rgba(232, 236, 245, 0.5)' }}
              >
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
            className="px-2 py-1 rounded text-xs transition-colors"
            style={{
              backgroundColor: 'rgba(91, 108, 255, 0.1)',
              color: 'var(--olumi-primary)'
            }}
            title="View run"
          >
            <Eye className="w-3 h-3" />
          </button>

          <button
            onClick={(e) => handleTogglePin(run.id, e)}
            className="px-2 py-1 rounded text-xs transition-colors"
            style={{
              backgroundColor: isPinned
                ? 'rgba(247, 201, 72, 0.2)'
                : 'rgba(91, 108, 255, 0.1)',
              color: isPinned
                ? 'var(--olumi-warning)'
                : 'var(--olumi-text)'
            }}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin className="w-3 h-3" />
          </button>

          <button
            onClick={(e) => handleDelete(run.id, e)}
            className="px-2 py-1 rounded text-xs transition-colors"
            style={{
              backgroundColor: 'rgba(255, 107, 107, 0.1)',
              color: 'var(--olumi-danger)'
            }}
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    )
  }, [selectedIds, handleToggleSelect, handleTogglePin, handleDelete, onViewRun])

  return (
    <div className="space-y-2">
      {/* Compare CTA */}
      {selectedIds.size >= 2 && (
        <button
          onClick={handleCompare}
          className="w-full px-3 py-2 rounded-md border transition-colors flex items-center justify-center gap-2 text-sm font-medium"
          style={{
            backgroundColor: 'var(--olumi-primary)',
            color: 'white',
            borderColor: 'var(--olumi-primary)'
          }}
        >
          <GitCompare className="w-4 h-4" />
          Compare {selectedIds.size} runs
        </button>
      )}

      {/* Run list - virtualized when >20 items */}
      {shouldVirtualize ? (
        <div
          ref={parentRef}
          className="space-y-1"
          style={{
            height: '400px',
            overflow: 'auto',
            contain: 'strict',
          }}
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {renderRunItem(runs[virtualItem.index])}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {runs.map(run => renderRunItem(run))}
        </div>
      )}
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
