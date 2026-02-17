/**
 * DecisionQualityChecks — Collapsible section showing client-side decision quality heuristics.
 *
 * Renders up to 6 checks: no_risks, no_baseline, all_positive_edges, same_levers,
 * many_ai_estimates, no_target. Each has a one-sentence nudge, a pill tag
 * (Framing or Verify), and a CTA button.
 *
 * Hidden when 0 checks triggered. Max 3 visible; remainder under "N more" toggle.
 *
 * Data source: usePreAnalysisData().qualityChecks
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight, Shield } from 'lucide-react'
import { Pill } from './primitives'
import type { QualityCheck } from './hooks/usePreAnalysisData'

interface DecisionQualityChecksProps {
  checks: QualityCheck[]
  /** CTA action handler — routes action string to parent */
  onAction?: (action: string) => void
}

function CheckRow({
  check,
  onAction,
}: {
  check: QualityCheck
  onAction?: (action: string) => void
}) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm text-text-body">{check.message}</p>
        <div className="flex items-center gap-2">
          {check.pill === 'framing' ? (
            <span className="inline-flex items-center rounded-full font-medium px-2 py-0.5 text-xs bg-option-light text-option">
              Framing
            </span>
          ) : (
            <Pill size="small" variant="info">Verify</Pill>
          )}
          <button
            type="button"
            onClick={() => onAction?.(check.ctaAction)}
            className="text-xs font-medium text-info border border-info/30 rounded-xl px-2.5 py-0.5 bg-transparent hover:border-info hover:bg-info/5 cursor-pointer"
          >
            {check.cta}
          </button>
        </div>
      </div>
    </div>
  )
}

export function DecisionQualityChecks({ checks, onAction }: DecisionQualityChecksProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showAll, setShowAll] = useState(false)

  if (checks.length === 0) return null

  const maxVisible = 3
  const visibleChecks = showAll ? checks : checks.slice(0, maxVisible)
  const hiddenCount = checks.length - maxVisible

  return (
    <div className="rounded-lg border border-panel-border" data-testid="decision-quality-checks">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-black/[0.02]"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-option" />
          <span className="text-sm font-semibold text-text-body">Decision quality</span>
        </div>
        <div className="flex items-center gap-2">
          <Pill size="small" variant="warning">{checks.length}</Pill>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-light" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-light" />
          )}
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-3 pb-3">
          {visibleChecks.map((check, idx) => (
            <div
              key={check.id}
              className={idx > 0 ? 'border-t border-panel-border' : ''}
            >
              <CheckRow check={check} onAction={onAction} />
            </div>
          ))}

          {/* Show more / show less toggle */}
          {hiddenCount > 0 && !showAll && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-xs text-info hover:underline cursor-pointer mt-1"
            >
              {hiddenCount} more
            </button>
          )}
          {showAll && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAll(false)}
              className="text-xs text-info hover:underline cursor-pointer mt-1"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default DecisionQualityChecks
