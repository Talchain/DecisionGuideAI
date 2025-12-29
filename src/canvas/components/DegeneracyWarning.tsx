/**
 * DegeneracyWarning Component (Phase 0.3)
 *
 * Displays warnings when analysis results show degenerate outcomes
 * (e.g., all options produce identical results).
 *
 * Key features:
 * - Backend blockers are non-dismissible (authoritative)
 * - UI heuristic warnings have "Show anyway" escape hatch
 * - Clear messaging about what's wrong and how to fix it
 */

import { useState } from 'react'
import { AlertTriangle, X, ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { DegeneracyCheck } from '../../lib/responseNormalisation'

interface DegeneracyWarningProps {
  /** Degeneracy check result */
  check: DegeneracyCheck
  /** Callback when user dismisses (only for dismissible warnings) */
  onDismiss?: () => void
  /** Whether in compact mode */
  compact?: boolean
}

export function DegeneracyWarning({
  check,
  onDismiss,
  compact = false,
}: DegeneracyWarningProps) {
  const [isDismissed, setIsDismissed] = useState(false)

  // Don't render if no degeneracy or already dismissed
  if (!check.detected || isDismissed) {
    return null
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    onDismiss?.()
  }

  // Backend blocker - more prominent, no dismiss
  if (check.isBackendBlocker) {
    return (
      <div
        className="p-4 bg-carrot-50 border-2 border-carrot-300 rounded-xl"
        role="alert"
        aria-live="polite"
        data-testid="degeneracy-warning-blocker"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="h-5 w-5 text-carrot-600 flex-shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className={`${typography.body} font-semibold text-carrot-800`}>
              Analysis Blocked
            </p>
            <p className={`${typography.bodySmall} text-carrot-700 mt-1`}>
              {check.message}
            </p>
            {check.suggestion && (
              <p className={`${typography.caption} text-carrot-600 mt-2`}>
                <strong>To fix:</strong> {check.suggestion}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // UI heuristic warning - dismissible with escape hatch
  if (compact) {
    return (
      <div
        className="flex items-center justify-between gap-2 px-3 py-2 bg-banana-50 border border-banana-200 rounded-lg"
        role="alert"
        data-testid="degeneracy-warning-compact"
      >
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle
            className="h-4 w-4 text-banana-600 flex-shrink-0"
            aria-hidden="true"
          />
          <span className={`${typography.caption} text-banana-700 truncate`}>
            {check.message}
          </span>
        </div>
        {check.canDismiss && onDismiss && (
          <button
            type="button"
            onClick={handleDismiss}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-banana-700 hover:text-banana-800 hover:bg-banana-100 rounded transition-colors flex-shrink-0"
          >
            Show anyway
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      className="p-4 bg-banana-50 border border-banana-200 rounded-xl"
      role="alert"
      aria-live="polite"
      data-testid="degeneracy-warning"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="h-5 w-5 text-banana-600 flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`${typography.body} font-medium text-banana-800`}>
              Results May Be Misleading
            </p>
            {check.canDismiss && onDismiss && (
              <button
                type="button"
                onClick={handleDismiss}
                className="p-1 text-banana-500 hover:text-banana-700 hover:bg-banana-100 rounded transition-colors"
                aria-label="Dismiss warning"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className={`${typography.bodySmall} text-banana-700 mt-1`}>
            {check.message}
          </p>
          {check.suggestion && (
            <p className={`${typography.caption} text-banana-600 mt-2`}>
              {check.suggestion}
            </p>
          )}
          {check.canDismiss && onDismiss && (
            <button
              type="button"
              onClick={handleDismiss}
              className="mt-3 px-3 py-1.5 text-sm font-medium text-banana-700 bg-banana-100 hover:bg-banana-200 rounded-lg transition-colors"
            >
              Show results anyway
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to manage degeneracy dismissal state.
 * Resets when a new run completes (different runId).
 */
export function useDegeneracyDismissal(runId?: string) {
  const [dismissedForRun, setDismissedForRun] = useState<string | null>(null)

  const isDismissed = dismissedForRun === runId
  const dismiss = () => {
    if (runId) {
      setDismissedForRun(runId)
    }
  }
  const reset = () => setDismissedForRun(null)

  return { isDismissed, dismiss, reset }
}
