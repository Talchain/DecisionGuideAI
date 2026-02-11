/**
 * BlockersSection — Structured blocker cards for pre-analysis panel.
 *
 * Renders "Fix before running" section with count badge.
 * Each blocker is a card with icon, title, description, and optional retry button.
 *
 * ⚠️  READ-ONLY GUARDRAIL: This component renders enriched blockers.
 *     It must NEVER mutate store state directly — all mutations flow through
 *     callbacks (onRetryDraft) passed from the parent.
 *
 * Design tokens (Olumi two-shade):
 * - critical: bg-danger-light, border-danger/30, text-danger
 * - warning:  bg-warning-light, border-warning/30, text-warning
 */

import { AlertTriangle, RefreshCw } from 'lucide-react'
import type { EnrichedBlocker } from './blockerEnrichment'

interface BlockersSectionProps {
  /** Enriched blockers to render */
  blockers: EnrichedBlocker[]
  /** Whether retry draft is available */
  canRetryDraft: boolean
  /** Whether retry is currently in progress */
  isRetrying: boolean
  /** Retry callback — no scroll (amendment #8) */
  onRetryDraft: () => void
}

export function BlockersSection({
  blockers,
  canRetryDraft,
  isRetrying,
  onRetryDraft,
}: BlockersSectionProps) {
  if (blockers.length === 0) return null

  return (
    <div className="space-y-2" data-testid="blockers-section">
      {/* Section header with count badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-danger">
          Fix before running
        </span>
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-danger-light text-danger text-xs font-semibold">
          {blockers.length}
        </span>
      </div>

      {/* Blocker cards */}
      {blockers.map((enriched, idx) => {
        const { blocker, display } = enriched
        const isCritical = display.severity === 'critical'

        return (
          <div
            key={`${blocker.code}-${idx}`}
            className={`rounded-md border px-3 py-2.5 ${
              isCritical
                ? 'bg-danger-light border-danger/30'
                : 'bg-warning-light border-warning/30'
            }`}
            data-testid={`blocker-card-${blocker.code}`}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                size={16}
                className={`mt-0.5 flex-shrink-0 ${
                  isCritical ? 'text-danger' : 'text-warning'
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${
                  isCritical ? 'text-danger' : 'text-warning'
                }`}>
                  {display.title}
                </p>
                <p className="text-xs text-text-body mt-0.5">
                  {display.description}
                </p>

                {/* Retry button inside card when supported */}
                {display.supportsRetry && canRetryDraft && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRetryDraft()
                    }}
                    disabled={isRetrying}
                    className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-info bg-panel border border-info/30 rounded-md hover:bg-info-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    data-testid={`blocker-retry-${blocker.code}`}
                  >
                    <RefreshCw size={12} className={isRetrying ? 'animate-spin' : ''} />
                    {isRetrying ? 'Retrying…' : 'Retry Draft'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default BlockersSection
