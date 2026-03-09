/**
 * BlockersSection — Structured blocker cards for pre-analysis panel.
 *
 * Renders "Fix before running" section with count badge for blocking items,
 * and a separate "Notes" section for informational (non-blocking) items.
 *
 * Constraint_dropped items are grouped into a single collapsible card
 * to avoid overwhelming users with many individual constraint cards.
 *
 * ⚠️  READ-ONLY GUARDRAIL: This component renders enriched blockers.
 *     It must NEVER mutate store state directly — all mutations flow through
 *     callbacks (onRetryDraft, onEditBrief) passed from the parent.
 *
 * Design tokens:
 * - Card bg: bg-panel (neutral surface)
 * - Blocking left border: 3px solid severity colour (danger / warning)
 * - Informational left border: 3px solid info colour
 * - No filled/tinted backgrounds
 */

import { useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Info, RefreshCw, Pencil } from 'lucide-react'
import type { EnrichedBlocker } from './blockerEnrichment'
import { typography } from '@/styles/typography'

interface BlockersSectionProps {
  /** Enriched blockers to render (blocking — prevent run) */
  blockers: EnrichedBlocker[]
  /** Informational (non-blocking) items like constraint_dropped */
  informationalBlockers?: EnrichedBlocker[]
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
  informationalBlockers = [],
  canRetryDraft,
  isRetrying,
  lastDraftRetryable,
  onRetryDraft,
  onEditBrief,
}: BlockersSectionProps) {
  if (blockers.length === 0 && informationalBlockers.length === 0) return null

  // When lastDraftRetryable is explicitly false, show "Edit brief" instead of "Retry Draft"
  const showEditBriefInstead = lastDraftRetryable === false

  // Partition informational blockers: constraint_dropped grouped, others individual
  const constraintItems = informationalBlockers.filter(e => e.blocker.code === 'CONSTRAINT_DROPPED')
  const otherInfoItems = informationalBlockers.filter(e => e.blocker.code !== 'CONSTRAINT_DROPPED')

  return (
    <div className="space-y-2" data-testid="blockers-section">
      {/* Blocking items — "Fix before running" */}
      {blockers.length > 0 && (
        <>
          {/* Section header with count badge */}
          <div className="flex items-center gap-2">
            <span className={`${typography.panelHeader} text-danger`}>
              Fix before running
            </span>
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-transparent border border-danger/30 text-text-body ${typography.panelMeta}`}>
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
                className={`rounded-md bg-panel border px-3 py-2.5 ${
                  isCritical ? 'border-danger/30' : 'border-warning/30'
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
                    <p className={`${typography.panelHeader} ${
                      isCritical ? 'text-danger' : 'text-warning'
                    }`}>
                      {display.title}
                    </p>
                    <p className={`${typography.panelBody} text-text-body mt-0.5`}>
                      {display.description}
                    </p>

                    {/* Suggested actions */}
                    {display.suggestedActions?.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {display.suggestedActions.map((action) => (
                          <li key={action} className={`${typography.panelMeta} text-text-light flex items-center gap-1`}>
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
                            className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelMeta} text-info bg-transparent border border-info/40 rounded-md hover:border-success/40 hover:text-success transition-colors`}
                            data-testid={`blocker-edit-brief-${blocker.code}`}
                          >
                            <Pencil size={12} />
                            Edit brief
                          </button>
                          <p className={`${typography.panelMeta} text-text-light mt-1`}>
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
                          className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 ${typography.panelMeta} text-info bg-transparent border border-info/40 rounded-md hover:border-success/40 hover:text-success disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
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
        </>
      )}

      {/* Informational items — "Notes" (non-blocking) */}
      {(constraintItems.length > 0 || otherInfoItems.length > 0) && (
        <>
          <div className="flex items-center gap-2">
            <span className={`${typography.panelHeader} text-info`}>
              Notes
            </span>
            <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-transparent border border-info/30 text-text-body ${typography.panelMeta}`}>
              {constraintItems.length > 0 ? (otherInfoItems.length + 1) : otherInfoItems.length}
            </span>
          </div>

          {/* Grouped constraint_dropped card */}
          {constraintItems.length > 0 && (
            <ConstraintGroupCard items={constraintItems} />
          )}

          {/* Other informational items rendered individually */}
          {otherInfoItems.map((enriched, idx) => {
            const { blocker, display } = enriched

            return (
              <div
                key={`${blocker.code}-${idx}`}
                className="rounded-md bg-panel border border-info/30 px-3 py-2.5"
                data-testid={`info-card-${blocker.code}`}
              >
                <div className="flex items-start gap-2">
                  <Info
                    size={16}
                    className="mt-0.5 flex-shrink-0 text-info"
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`${typography.panelHeader} text-info`}>
                      {display.title}
                    </p>
                    <p className={`${typography.panelBody} text-text-body mt-0.5`}>
                      {display.description}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

/**
 * Grouped card for multiple constraint_dropped items.
 * Collapses N individual constraint cards into one with a collapsible list.
 */
function ConstraintGroupCard({ items }: { items: EnrichedBlocker[] }) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Extract individual constraint labels — prefer structured fields, regex fallback
  const constraintLabels = items.map((enriched) => {
    // 1. Structured: action label from blocker
    if (enriched.blocker.action?.label) return enriched.blocker.action.label
    // 2. Structured: first affected ID
    if (enriched.blocker.affectedIds?.[0]) return enriched.blocker.affectedIds[0]
    // 3. Regex fallback: parse hydrated title 'Constraint not applied: "Label"'
    const title = enriched.display.title
    const match = title.match(/:\s*"(.+)"$/)
    if (match) return match[1]
    return title
  })

  return (
    <div
      className="rounded-md bg-panel border border-info/30 px-3 py-2.5"
      data-testid="constraint-group-card"
    >
      <div className="flex items-start gap-2">
        <Info
          size={16}
          className="mt-0.5 flex-shrink-0 text-info"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`${typography.panelHeader} text-info`}>
              Constraints not applied
            </p>
            <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-transparent border border-info/30 text-text-body ${typography.panelMeta}`}>
              {items.length}
            </span>
          </div>
          <p className={`${typography.panelBody} text-text-body mt-0.5`}>
            Some constraints from your brief couldn't be matched to factors in
            your model. The analysis will run without them. If you want them
            enforced, try adding them as explicit factors or set them as targets.
          </p>

          {/* Collapsible constraint list — default collapsed */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`mt-1.5 inline-flex items-center gap-1 ${typography.panelMeta} text-info hover:text-info-hover transition-colors`}
            data-testid="constraint-group-toggle"
          >
            {isExpanded ? (
              <ChevronDown size={12} />
            ) : (
              <ChevronRight size={12} />
            )}
            {isExpanded ? 'Hide constraints' : 'Show constraints'}
          </button>

          {isExpanded && (
            <ul className="mt-1 space-y-0.5" data-testid="constraint-group-list">
              {constraintLabels.map((label, idx) => (
                <li key={idx} className={`${typography.panelMeta} text-text-light flex items-center gap-1`}>
                  <span className="text-text-light/50">&bull;</span>
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default BlockersSection
