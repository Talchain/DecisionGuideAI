/**
 * ModelReceiptBlock — pre-analysis "check this before analysis" card rendered in
 * the conversation after graph generation (F1 PR B).
 *
 * Action-first hierarchy: a neutral headline, then the CEE-provided coaching
 * (analysis_ready.coaching_summary) verbatim as the main content, then a static
 * neutral next-step nudge. Model statistics (counts / readiness / goal) are
 * demoted into a collapsed "Model details" disclosure — never in the primary
 * visual path. Honest pre-analysis: no materiality / confidence / likelihood /
 * winner / verdict language, no colour-as-status (analysis has not run yet).
 *
 * Consumes only the stable view-model from selectModelReceiptData.
 * No direct reads from guidance_items, envelope fields, or patch timing.
 */

import { memo, useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardCheck, Wrench } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { ModelReceiptData } from '../adapters/modelCardAdapter'

// ---------------------------------------------------------------------------
// § 1 — Readiness label (neutral; demoted to the "Model details" disclosure)
// ---------------------------------------------------------------------------

function readinessLabel(readiness: ModelReceiptData['readiness']): string {
  switch (readiness) {
    case 'ready':
      return 'Ready to run'
    case 'blocked':
      return 'Needs attention'
    case 'incomplete':
      return 'Needs review'
    default:
      return 'Draft'
  }
}

// ---------------------------------------------------------------------------
// § 2 — Main component
// ---------------------------------------------------------------------------

interface ModelReceiptBlockProps {
  data: ModelReceiptData
}

export const ModelReceiptBlock = memo(function ModelReceiptBlock({ data }: ModelReceiptBlockProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const [adjustmentsExpanded, setAdjustmentsExpanded] = useState(false)

  const countsLine = [
    data.factorCount > 0 ? `${data.factorCount} factor${data.factorCount !== 1 ? 's' : ''}` : null,
    `${data.edgeCount} relationship${data.edgeCount !== 1 ? 's' : ''}`,
    data.optionCount > 0 ? `${data.optionCount} option${data.optionCount !== 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(', ')

  const detailLine = [
    readinessLabel(data.readiness),
    countsLine,
    data.goalLabel ? `toward ${data.goalLabel}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div
      className="bg-panel rounded-lg shadow-s1 p-3 space-y-1.5"
      data-testid="model-receipt-block"
    >
      {/* 1 — Action headline (neutral icon; no success/verdict colour) */}
      <div className="flex items-center gap-1.5">
        <ClipboardCheck className="w-3.5 h-3.5 text-text-light shrink-0" aria-hidden="true" />
        <span className={typography.panelHeader}>Check this before analysis</span>
      </div>

      {/* 2 — Main content: CEE coaching, verbatim. Not glossary-gated (CEE owns it). */}
      {data.coachingSummary && (
        <p className={`${typography.bodySmall} text-text-body`}>
          {data.coachingSummary}
        </p>
      )}

      {/* 3 — Static neutral next-step nudge (DGAI chrome; passes the copy gate) */}
      <p className={`${typography.panelMeta} text-text-light`}>
        Review or strengthen this before running analysis.
      </p>

      {/* 4 — Demoted "Model details": readiness + counts + goal, collapsed */}
      <div>
        <button
          type="button"
          onClick={() => setDetailsExpanded(!detailsExpanded)}
          className={`${typography.panelMeta} text-text-light inline-flex items-center gap-1 hover:text-text-body transition-colors`}
          aria-expanded={detailsExpanded}
          aria-controls="receipt-details"
        >
          Model details
          {detailsExpanded
            ? <ChevronDown className="w-3 h-3" aria-hidden="true" />
            : <ChevronRight className="w-3 h-3" aria-hidden="true" />
          }
        </button>

        {detailsExpanded && (
          <p
            id="receipt-details"
            className={`${typography.panelMeta} text-text-light mt-1 pl-4`}
          >
            {detailLine}
          </p>
        )}
      </div>

      {/* 5 — Collapsible adjustments (unchanged behaviour) */}
      {data.adjustments.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setAdjustmentsExpanded(!adjustmentsExpanded)}
            className={`${typography.panelMeta} text-text-light inline-flex items-center gap-1 hover:text-text-body transition-colors`}
            aria-expanded={adjustmentsExpanded}
            aria-controls="receipt-adjustments"
          >
            <Wrench className="w-3 h-3" aria-hidden="true" />
            Olumi made {data.adjustments.length} adjustment{data.adjustments.length !== 1 ? 's' : ''} to keep the model valid
            {adjustmentsExpanded
              ? <ChevronDown className="w-3 h-3" aria-hidden="true" />
              : <ChevronRight className="w-3 h-3" aria-hidden="true" />
            }
          </button>

          {adjustmentsExpanded && (
            <ul
              id="receipt-adjustments"
              className="mt-1 space-y-0.5 pl-4"
              role="list"
            >
              {data.adjustments.map((a, i) => (
                <li key={i} className={`${typography.panelMeta} text-text-light`}>
                  <span className="font-medium text-text-body">{a.action}</span> {a.label}
                  {a.before != null && a.after != null && (
                    <span> ({a.before} → {a.after})</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
})
