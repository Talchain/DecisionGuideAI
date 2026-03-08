/**
 * DecisionReviewPanel - M1 CEE Orchestrator UI Component
 *
 * Renders the CEE Decision Review with four render states:
 * - Hidden: review, trace, error all nullish → Nothing
 * - Error: error present → Error message + Re-run CTA + trace footer
 * - Unavailable: review null, error null, trace present → "Review unavailable" + trace
 * - Success: review present → Full review panel with blocks
 *
 * CRITICAL: Engine remains source of truth for drivers.
 * DecisionReviewPanel displays CEE synthesis but does NOT replace DriversSignal.
 *
 * @see M1 CEE Orchestrator UI Workstream v1.3
 */

import { useState, useMemo, useCallback } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, Info, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { typography } from '../../styles/typography'
import { cleanInsightText } from '../utils/cleanInsightText'

// Legacy types (deprecated - for backwards compatibility)
import type { CeeDecisionReviewPayload, CeeTraceMeta, CeeErrorViewModel } from '../decisionReview/types'
// M1 CEE Orchestrator types (new contract)
import type {
  CeeDecisionReviewPayloadV1,
  CeeTrace,
  CeeError,
  ReviewBlock,
  BlockId,
  ReadinessLevel,
  ReviewReadiness,
} from '../../types/cee'
import { getBlock, getBlocksForIntent, canRetry } from '../../types/cee'

// =============================================================================
// Types
// =============================================================================

export type DecisionReviewStatus = 'loading' | 'empty' | 'error' | 'ready'

interface DecisionReviewPanelProps {
  status: DecisionReviewStatus
  // Legacy types (deprecated)
  review?: CeeDecisionReviewPayload | null
  error?: CeeErrorViewModel | null
  trace?: CeeTraceMeta | null
  // M1 CEE Orchestrator types (preferred)
  reviewV1?: CeeDecisionReviewPayloadV1 | null
  errorV1?: CeeError | null
  traceV1?: CeeTrace | null
  // Callbacks
  onRetry?: () => void
  /**
   * Whether a retry is currently allowed. When false, retry button is hidden
   * even if canRetry(error) returns true. Use to prevent retry during:
   * - Loading/streaming state
   * - Degraded runs
   * - Duplicate runs
   */
  canRetryRun?: boolean
}

// =============================================================================
// Sub-components
// =============================================================================

/**
 * ReadinessHeader - Decision readiness indicator with traffic light colors
 */
interface ReadinessHeaderProps {
  readiness: ReviewReadiness
}

function ReadinessHeader({ readiness }: ReadinessHeaderProps) {
  const levelConfig: Record<ReadinessLevel, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    ready: {
      bg: 'bg-panel',
      text: 'text-success',
      border: 'border-success/30',
      icon: <CheckCircle className="w-4 h-4 text-success" aria-hidden="true" />,
    },
    caution: {
      bg: 'bg-panel',
      text: 'text-warning',
      border: 'border-warning/30',
      icon: <AlertTriangle className="w-4 h-4 text-warning" aria-hidden="true" />,
    },
    not_ready: {
      bg: 'bg-panel',
      text: 'text-danger',
      border: 'border-danger/30',
      icon: <XCircle className="w-4 h-4 text-danger" aria-hidden="true" />,
    },
  }

  const config = levelConfig[readiness.level]

  return (
    <div
      className={`flex items-start gap-2 p-3 rounded-lg border ${config.bg} ${config.border}`}
      role="status"
      aria-live="polite"
      data-testid="readiness-header"
    >
      {config.icon}
      <div className="flex-1 min-w-0">
        <p className={`${typography.label} font-medium ${config.text}`}>
          {readiness.headline}
        </p>
        {readiness.factors.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {readiness.factors.map((factor, idx) => {
              const statusIcon = factor.status === 'ok' ? '✓' : factor.status === 'warning' ? '!' : '✕'
              const statusColor =
                factor.status === 'ok'
                  ? 'text-success'
                  : factor.status === 'warning'
                  ? 'text-warning'
                  : 'text-danger'
              return (
                <li
                  key={idx}
                  className={`${typography.caption} flex items-center gap-1 ${config.text}`}
                >
                  <span className={statusColor} aria-hidden="true">{statusIcon}</span>
                  {factor.label}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

/**
 * TraceFooter - Collapsible debug trace information
 */
interface TraceFooterProps {
  trace: CeeTrace
}

function TraceFooter({ trace }: TraceFooterProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Format trace ID - handles null, undefined, and empty string
  const formatTraceId = (id: string | null | undefined): string => {
    if (id === null || id === undefined || id === '') return '—'
    return id
  }

  // Compute id_mismatch client-side if server didn't provide it
  // Mismatch occurs when sent ID differs from returned ID (and both are present)
  const hasIdMismatch = useMemo(() => {
    // Use server-provided flag if available
    if (trace.id_mismatch === true) return true
    if (trace.id_mismatch === false) return false
    // Compute client-side: mismatch if both IDs exist and differ
    const sentId = trace.cee_sent_request_id
    const returnedId = trace.cee_returned_request_id
    if (sentId && returnedId && sentId !== returnedId) return true
    return false
  }, [trace.id_mismatch, trace.cee_sent_request_id, trace.cee_returned_request_id])

  const hasLatency = typeof trace.latency_ms === 'number'

  return (
    <div
      className={`mt-3 pt-3 border-t border-sand-200 ${typography.code}`}
      data-testid="trace-footer"
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-ink-900/60 hover:text-ink-900/80"
        aria-expanded={isExpanded}
        aria-controls="trace-details"
      >
        {isExpanded ? (
          <ChevronUp className="w-3 h-3" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-3 h-3" aria-hidden="true" />
        )}
        <span>Debug trace</span>
        {hasIdMismatch && (
          <span className="ml-1 px-1 py-0.5 bg-sun-100 text-sun-800 rounded text-xs">
            ID mismatch
          </span>
        )}
      </button>

      {isExpanded && (
        <div
          id="trace-details"
          className="mt-2 space-y-1 text-ink-900/70"
        >
          <div className="flex justify-between">
            <span>PLoT Request ID:</span>
            <span className="font-mono">{formatTraceId(trace.plot_request_id)}</span>
          </div>
          <div className="flex justify-between">
            <span>CEE Sent ID:</span>
            <span className="font-mono">{formatTraceId(trace.cee_sent_request_id)}</span>
          </div>
          <div className="flex justify-between">
            <span>CEE Returned ID:</span>
            <span className="font-mono">{formatTraceId(trace.cee_returned_request_id)}</span>
          </div>
          {hasLatency && (
            <div className="flex justify-between">
              <span>CEE Latency:</span>
              <span>{trace.latency_ms}ms</span>
            </div>
          )}
          {trace.model && (
            <div className="flex justify-between">
              <span>Model:</span>
              <span>{trace.model}</span>
            </div>
          )}
          {hasIdMismatch && (
            <p className="mt-1 text-sun-700">
              Request ID mismatch detected. This may indicate a routing issue.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * ReviewBlockCard - Renders a single review block with severity styling
 */
interface ReviewBlockCardProps {
  block: ReviewBlock
}

function ReviewBlockCard({ block }: ReviewBlockCardProps) {
  // Skip not_applicable blocks entirely (truly not relevant)
  if (block.status === 'not_applicable') {
    return null
  }

  // For cannot_compute blocks, show a diagnostic message with reason
  if (block.status === 'cannot_compute') {
    return (
      <div
        className="p-3 rounded-lg border border-sand-300 bg-sand-50"
        data-testid={`review-block-${block.id}`}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 className={`${typography.label} font-medium capitalize text-ink-700`}>
            {block.id.replace(/_/g, ' ')}
          </h4>
          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-sand-200 text-ink-600">
            unavailable
          </span>
        </div>
        <p className={`mt-1 ${typography.caption} text-ink-600`}>
          {block.status_reason || block.summary || 'This section could not be computed for the current analysis.'}
        </p>
      </div>
    )
  }

  const severityConfig = {
    low: { bg: 'bg-panel', border: 'border-info/30', text: 'text-info' },
    medium: { bg: 'bg-panel', border: 'border-warning/30', text: 'text-warning' },
    high: { bg: 'bg-panel', border: 'border-danger/30', text: 'text-danger' },
  }

  const config = block.severity ? severityConfig[block.severity] : null
  const containerClass = config
    ? `p-3 rounded-lg border ${config.bg} ${config.border}`
    : 'p-3 rounded-lg border border-sand-200 bg-paper-50'
  const textClass = config ? config.text : 'text-ink-900'

  // Show status badge for non-ok statuses
  const showStatusBadge = block.status !== 'ok' && block.status !== 'requires_run'

  return (
    <div className={containerClass} data-testid={`review-block-${block.id}`}>
      <div className="flex items-start justify-between gap-2">
        <h4 className={`${typography.label} font-medium capitalize ${textClass}`}>
          {block.id.replace(/_/g, ' ')}
        </h4>
        {showStatusBadge && (
          <span
            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
              block.status === 'low_discrimination'
                ? 'bg-sun-100 text-sun-800'
                : 'bg-sand-200 text-ink-700'
            }`}
          >
            {block.status.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <p className={`mt-1 ${typography.caption} ${textClass}`}>
        {cleanInsightText(block.summary)}
      </p>

      {block.details && (
        <p className={`mt-1 ${typography.code} text-ink-900/70`}>
          {cleanInsightText(block.details)}
        </p>
      )}

      {block.items && block.items.length > 0 && (
        <ul className="mt-2 space-y-1">
          {block.items.map((item, idx) => (
            <li
              key={item.id || idx}
              className={`${typography.caption} flex items-start gap-1.5`}
            >
              <span className="text-ink-900/50 mt-0.5">•</span>
              <div>
                <span className="font-medium">{item.label}</span>
                {item.description && (
                  <span className="text-ink-900/70"> — {item.description}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {block.status_reason && (
        <p className={`mt-2 ${typography.code} text-ink-900/60 italic`}>
          {block.status_reason}
        </p>
      )}
    </div>
  )
}

/**
 * IntentBasedLayout - Renders blocks according to intent layout
 */
interface IntentBasedLayoutProps {
  review: CeeDecisionReviewPayloadV1
}

function IntentBasedLayout({ review }: IntentBasedLayoutProps) {
  const layout = useMemo(() => getBlocksForIntent(review, review.intent), [review])

  const heroBlock = getBlock(review, layout.hero)
  const analysisBlocks = layout.analysis.map(id => getBlock(review, id)).filter(Boolean) as ReviewBlock[]
  const considerationBlocks = layout.considerations.map(id => getBlock(review, id)).filter(Boolean) as ReviewBlock[]
  const actionsBlock = getBlock(review, layout.actions)

  return (
    <div className="space-y-4" data-testid="intent-based-layout">
      {/* Hero block - main recommendation/prediction */}
      {heroBlock && (
        <div data-testid="hero-section">
          <ReviewBlockCard block={heroBlock} />
        </div>
      )}

      {/* Analysis section */}
      {analysisBlocks.length > 0 && (
        <div data-testid="analysis-section">
          <h3 className={`${typography.code} font-medium text-ink-900/70 mb-2`}>
            Analysis
          </h3>
          <div className="space-y-2">
            {analysisBlocks.map(block => (
              <ReviewBlockCard key={block.id} block={block} />
            ))}
          </div>
        </div>
      )}

      {/* Considerations section */}
      {considerationBlocks.length > 0 && (
        <div data-testid="considerations-section">
          <h3 className={`${typography.code} font-medium text-ink-900/70 mb-2`}>
            Considerations
          </h3>
          <div className="space-y-2">
            {considerationBlocks.map(block => (
              <ReviewBlockCard key={block.id} block={block} />
            ))}
          </div>
        </div>
      )}

      {/* Actions section */}
      {actionsBlock && (
        <div data-testid="actions-section">
          <h3 className={`${typography.code} font-medium text-ink-900/70 mb-2`}>
            Next Steps
          </h3>
          <ReviewBlockCard block={actionsBlock} />
        </div>
      )}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export function DecisionReviewPanel({
  status,
  review,
  error,
  trace,
  reviewV1,
  errorV1,
  traceV1,
  onRetry,
  canRetryRun,
}: DecisionReviewPanelProps) {
  // Check if V1 types are available (prefer V1 over legacy)
  const hasV1Data = reviewV1 !== undefined && reviewV1 !== null ||
                    errorV1 !== undefined && errorV1 !== null ||
                    traceV1 !== undefined && traceV1 !== null

  // If no V1 data, fall back entirely to legacy rendering
  if (!hasV1Data) {
    // Loading state
    if (status === 'loading') {
      return (
        <section
          aria-label="Decision review"
          data-testid="decision-review-loading"
          className={`p-3 ${typography.caption} text-ink-900/60`}
        >
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-sand-200 rounded" />
            <div className="h-3 bg-sand-200 rounded w-5/6" />
            <div className="h-3 bg-sand-100 rounded w-4/6" />
          </div>
        </section>
      )
    }

    // Empty state
    if (status === 'empty') {
      return (
        <section
          aria-label="Decision review"
          data-testid="decision-review-empty"
          className={`p-3 ${typography.caption}`}
        >
          <p className="text-ink-900/70">
            Decision Review is not available for this run. You can still use the main results to guide your next steps.
          </p>
        </section>
      )
    }

    // Render legacy component for legacy data
    if (review || error || trace) {
      return <LegacyDecisionReview review={review} error={error} trace={trace} />
    }

    return null
  }

  // V1 data is present - use new rendering
  const activeReview = reviewV1 ?? null
  const activeError = errorV1 ?? null
  const activeTrace = traceV1 ?? null

  // Convert trace to normalized format for display
  const normalizedTrace: CeeTrace | null = activeTrace

  // Handle retry click
  const handleRetry = useCallback(() => {
    if (onRetry) {
      onRetry()
    }
  }, [onRetry])

  // ==========================================================================
  // V1 Render States
  // ==========================================================================

  // Loading state
  if (status === 'loading') {
    return (
      <section
        aria-label="Decision review"
        data-testid="decision-review-loading"
        className={`p-3 ${typography.caption} text-ink-900/60`}
      >
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-sand-200 rounded" />
          <div className="h-3 bg-sand-200 rounded w-5/6" />
          <div className="h-3 bg-sand-100 rounded w-4/6" />
        </div>
      </section>
    )
  }

  // Hidden state: all V1 nullish → render nothing
  if (!activeReview && !activeError && !normalizedTrace) {
    return null
  }

  // Error state: error present
  if (activeError) {
    const isRetriable = canRetry(activeError)

    // P0.1 Fix: Detect timeout errors and show informational message instead of error
    // CEE timeouts are transient and don't indicate a problem with the analysis
    // Check both error code AND trace.degraded flag
    const errorCodeIsTimeout = activeError.code?.toUpperCase().includes('TIMEOUT') ?? false
    const traceIsDegraded = (normalizedTrace as Record<string, unknown> | null)?.degraded === true
    const isTimeout = errorCodeIsTimeout || traceIsDegraded

    if (isTimeout) {
      // Timeout-specific messaging: informational, not error
      return (
        <section
          aria-label="Decision review"
          data-testid="decision-review-timeout"
          className={`p-3 ${typography.caption} bg-panel border border-info/30 rounded`}
        >
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <h3 className={`${typography.label} text-info mb-1`}>
                AI review is taking longer than expected
              </h3>
              <p className="text-info mb-2">
                Your analysis is complete. The AI review will be available on your next run.
              </p>

              {onRetry && canRetryRun !== false && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-info-600 text-text-on-color rounded hover:bg-info-700 transition-colors"
                  data-testid="decision-review-retry"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  Try Again
                </button>
              )}
            </div>
          </div>

          {normalizedTrace && <TraceFooter trace={normalizedTrace} />}
        </section>
      )
    }

    const headline = isRetriable
      ? 'Decision Review is temporarily unavailable'
      : activeError.suggestedAction === 'fix_input'
      ? 'Decision Review could not run on this input'
      : 'Decision Review is unavailable for this run'

    const body = isRetriable
      ? 'This is usually transient. You can try again in a moment; core results remain valid.'
      : activeError.suggestedAction === 'fix_input'
      ? 'Please adjust the scenario or inputs, then run analysis again. The main results panel has more detail.'
      : activeError.message || 'The engine results are still available. Decision Review could not be generated this time.'

    return (
      <section
        aria-label="Decision review"
        data-testid="decision-review-error"
        className={`p-3 ${typography.caption} bg-sun-50 border border-sun-200 rounded`}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-sun-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <h3 className={`${typography.label} text-sun-900 mb-1`}>{headline}</h3>
            <p className="text-sun-900 mb-2">{body}</p>

            {isRetriable && onRetry && canRetryRun !== false && (
              <button
                type="button"
                onClick={handleRetry}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sun-600 text-white rounded hover:bg-sun-700 transition-colors"
                data-testid="decision-review-retry"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Retry
              </button>
            )}

            {activeError.code && (
              <p className={`mt-2 ${typography.code} text-sun-900/70`}>
                Error code: <span className="font-mono">{activeError.code}</span>
              </p>
            )}
          </div>
        </div>

        {normalizedTrace && <TraceFooter trace={normalizedTrace} />}
      </section>
    )
  }

  // Unavailable state: review null, error null, trace present
  if (!activeReview && normalizedTrace) {
    // P0.1 Fix: Detect timeout via trace.reason OR trace.degraded when no error object present
    // When CEE times out, there may be no error - just trace with:
    // - reason='CEE_V2_TIMEOUT' (specific timeout reason)
    // - OR degraded=true (general degraded state indicator)
    const traceReason = String((normalizedTrace as Record<string, unknown>).reason ?? '').toUpperCase()
    const isDegraded = (normalizedTrace as Record<string, unknown>).degraded === true
    const isTimeout = traceReason.includes('TIMEOUT') || traceReason.includes('CEE_V2_TIMEOUT') || isDegraded

    if (isTimeout) {
      // Show info-styled timeout message instead of generic unavailable
      return (
        <section
          aria-label="Decision review"
          data-testid="decision-review-timeout"
          className={`p-3 ${typography.caption} bg-panel border border-info/30 rounded`}
        >
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <h3 className={`${typography.label} text-info mb-1`}>
                AI review is taking longer than expected
              </h3>
              <p className="text-info mb-2">
                Your analysis is complete. The AI review will be available on your next run.
              </p>

              {onRetry && canRetryRun !== false && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-info-600 text-text-on-color rounded hover:bg-info-700 transition-colors"
                  data-testid="decision-review-retry"
                >
                  <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                  Try Again
                </button>
              )}
            </div>
          </div>
          <TraceFooter trace={normalizedTrace} />
        </section>
      )
    }

    return (
      <section
        aria-label="Decision review"
        data-testid="decision-review-unavailable"
        className={`p-3 ${typography.caption}`}
      >
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-ink-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-ink-900/70">
            Decision Review is not available for this run. You can still use the main results to guide your next steps.
          </p>
        </div>
        <TraceFooter trace={normalizedTrace} />
      </section>
    )
  }

  // Success state: review present → Full review panel
  if (activeReview) {
    return (
      <section
        aria-label="Decision review"
        data-testid="decision-review-ready"
        className={`p-3 ${typography.caption} text-ink-900/70 space-y-4`}
      >
        {/* Readiness Header */}
        {activeReview.readiness && (
          <ReadinessHeader readiness={activeReview.readiness} />
        )}

        {/* Analysis State Indicator */}
        {activeReview.analysis_state !== 'ran' && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded ${
              activeReview.analysis_state === 'stale'
                ? 'bg-sun-50 border border-sun-200 text-sun-900'
                : 'bg-sand-100 text-ink-700'
            }`}
            data-testid="analysis-state-indicator"
          >
            <Info className="w-4 h-4" aria-hidden="true" />
            <span className={typography.caption}>
              {activeReview.analysis_state === 'not_run'
                ? 'Analysis has not been run yet.'
                : activeReview.analysis_state === 'partial'
                ? 'Partial analysis results available.'
                : activeReview.analysis_state === 'stale'
                ? 'Results may be outdated. Consider re-running analysis.'
                : null}
            </span>
          </div>
        )}

        {/* Intent-based Block Layout */}
        <IntentBasedLayout review={activeReview} />

        {/* Trace Footer (collapsed by default) */}
        {normalizedTrace && <TraceFooter trace={normalizedTrace} />}
      </section>
    )
  }

  // Fallback - should not reach here
  return null
}

// =============================================================================
// Legacy Support
// =============================================================================

/**
 * LegacyDecisionReview - Renders legacy CEE format (deprecated)
 * Preserved for backwards compatibility during migration
 */
function LegacyDecisionReview({
  review,
  error,
  trace,
}: {
  review?: CeeDecisionReviewPayload | null
  error?: CeeErrorViewModel | null
  trace?: CeeTraceMeta | null
}) {
  if (error) {
    // P0.1 Fix: Detect timeout errors and show informational message instead of error
    // Check both error code AND trace.degraded flag
    const errorCodeIsTimeout = error.code?.toUpperCase().includes('TIMEOUT') ?? false
    const traceIsDegraded = trace?.degraded === true
    const isTimeout = errorCodeIsTimeout || traceIsDegraded

    if (isTimeout) {
      return (
        <section
          aria-label="Decision review"
          data-testid="decision-review-timeout"
          className={`p-3 ${typography.caption} bg-panel border border-info/30 rounded`}
        >
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-info flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <h3 className={`${typography.label} text-info mb-1`}>
                AI review is taking longer than expected
              </h3>
              <p className="text-info">
                Your analysis is complete. The AI review will be available on your next run.
              </p>
            </div>
          </div>
        </section>
      )
    }

    const suggested = error.suggestedAction
    const headline =
      suggested === 'retry'
        ? 'Decision Review is temporarily unavailable'
        : suggested === 'fix_input'
        ? 'Decision Review could not run on this input'
        : 'Decision Review is unavailable for this run'

    const body =
      suggested === 'retry'
        ? 'This is usually transient. You can try again in a moment; core results remain valid.'
        : suggested === 'fix_input'
        ? 'Please adjust the scenario or inputs, then run analysis again. The main results panel has more detail.'
        : 'The engine results are still available. Decision Review could not be generated this time.'

    return (
      <section
        aria-label="Decision review"
        data-testid="decision-review-error"
        className={`p-3 ${typography.caption} bg-sun-50 border border-sun-200 rounded`}
      >
        <h3 className={`${typography.label} text-sun-900 mb-1`}>{headline}</h3>
        <p className="text-sun-900 mb-1">{body}</p>
        {trace?.requestId && (
          <p className={`${typography.code} text-sun-900/70`} data-testid="decision-review-trace-id">
            Reference ID: <span className="font-mono">{trace.requestId}</span>
          </p>
        )}
      </section>
    )
  }

  if (!review) {
    return null
  }

  const story = review.story
  const keyDrivers = story?.key_drivers ?? []
  const nextActions = story?.next_actions ?? []
  const cleanedHeadline = cleanInsightText(story?.headline) || 'Decision Review'

  return (
    <section
      aria-label="Decision review"
      data-testid="decision-review-ready"
      className={`p-3 ${typography.caption} text-ink-900/70 space-y-3`}
    >
      <div>
        <h3 className={`${typography.label} text-ink-900`} data-testid="decision-review-headline">
          {cleanedHeadline}
        </h3>
        {review.journey && (
          <p className={`mt-1 ${typography.code} text-ink-900/60`} data-testid="decision-review-journey">
            {review.journey.is_complete
              ? 'Based on a complete decision journey.'
              : 'Based on the current decision journey.'}
          </p>
        )}
      </div>

      {keyDrivers.length > 0 && (
        <div data-testid="decision-review-drivers">
          <div className={`${typography.code} font-medium text-ink-900/60 mb-1`}>
            What shaped this view
          </div>
          <ul className="list-disc pl-4 space-y-1">
            {keyDrivers.map((d, idx) => (
              <li key={idx} className={`${typography.caption} text-ink-900`}>
                <span className="font-medium">{d.label}</span>
                {d.why && <span className="text-ink-900/60"> — {d.why}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {nextActions.length > 0 && (
        <div data-testid="decision-review-next-actions">
          <div className={`${typography.code} font-medium text-ink-900/60 mb-1`}>
            Suggested next moves
          </div>
          <ul className="list-disc pl-4 space-y-1">
            {nextActions.map((a, idx) => (
              <li key={idx} className={`${typography.caption} text-ink-900`}>
                <span className="font-medium">{a.label}</span>
                {a.why && <span className="text-ink-900/60"> — {a.why}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
