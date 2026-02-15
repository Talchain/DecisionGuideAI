/**
 * BlockersSection — Structured blocker cards for pre-analysis panel.
 *
 * Renders "Fix before running" section with count badge.
 * Each blocker is a card with icon, title, description, and optional retry/edit button.
 *
 * ⚠️  READ-ONLY GUARDRAIL: This component renders enriched blockers.
 *     It must NEVER mutate store state directly — all mutations flow through
 *     callbacks (onRetryDraft, onEditBrief) passed from the parent.
 *
 * Design tokens:
 * - Card bg: bg-panel (neutral surface)
 * - Left border: 3px solid severity colour (danger / warning)
 * - No filled/tinted backgrounds
 */

import { AlertTriangle, RefreshCw, Pencil } from 'lucide-react'
import type { EnrichedBlocker } from './blockerEnrichment'

interface BlockersSectionProps {
  /** Enriched blockers to render */
  blockers: EnrichedBlocker[]
  /** Whether retry draft is available */
  canRetryDraft: boolean
  /** Whether retry is currently in progress */
  isRetrying: boolean
  /** Whether the last draft error is non-retryable (deterministic failure) */
  lastDraftRetryable?: boolean
  /** Retry callback — no scroll (amendment #8) */
  onRetryDraft: () => void
  /** Edit brief callback — opens DraftChat for re-phrasing */
  onEditBrief: () => void
}

export function BlockersSection({
  blockers,
  canRetryDraft,
  isRetrying,
  lastDraftRetryable,
  onRetryDraft,
  onEditBrief,
}: BlockersSectionProps) {
  if (blockers.length === 0) return null

  // When lastDraftRetryable is explicitly false, show "Edit brief" instead of "Retry Draft"
  const showEditBriefInstead = lastDraftRetryable === false

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
            className={`rounded-md bg-panel border-l-[3px] border border-panel-border px-3 py-2.5 ${
              isCritical ? 'border-l-danger' : 'border-l-warning'
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

                {/* Suggested actions */}
                {display.suggestedActions.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {display.suggestedActions.map((action) => (
                      <li key={action} className="text-xs text-text-light flex items-center gap-1">
                        <span className="text-text-light/50">&bull;</span>
                        {action}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Action button inside card when retry is supported */}
                {display.supportsRetry && canRetryDraft && (
                  showEditBriefInstead ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditBrief()
                        }}
                        className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-info bg-panel border border-info/30 rounded-md hover:bg-info-light transition-colors"
                        data-testid={`blocker-edit-brief-${blocker.code}`}
                      >
                        <Pencil size={12} />
                        Edit brief
                      </button>
                      <p className="text-xs text-text-light mt-1">
                        The previous draft couldn't be validated. Try rephrasing your decision brief.
                      </p>
                    </>
                  ) : (
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
                  )
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
