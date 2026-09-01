/**
 * ⭐⭐ WHY NO ANALYSIS HAS RUN — the pre-run panel's missing half.
 *
 * ⚠⚠ FOUND BY DRIVING DEPLOYED `3595403b`, guest, a saved model. Clicking the
 * product's primary button — **Run analysis** — fired
 * `POST /bff/cee/graph-readiness`, which answered:
 *
 *     can_run_analysis: false
 *     blocker_reason:  "This model can't be analysed yet. The values involved
 *                       are Olumi's own suggestions, not yours — ask Olumi to
 *                       work them through, or set them yourself."
 *     readiness_issues: 5 × 'Factor "X" needs a numeric value for option "Y"'
 *
 * and the user was shown NOTHING. Verified with a positive control in the same
 * probe (a canvas label read TRUE on screen, so the probe could see page text):
 * the blocker sentence, "needs a numeric value" and "Olumi's own suggestions"
 * all read FALSE. Meanwhile this panel said "No analysis has run yet for this
 * model" and stopped — true, and silent about the only thing the reader needed.
 *
 * ⭐ NOTHING HERE IS DERIVED, AND THAT IS THE DESIGN. Every sentence is the run
 * gate's own `blockedListing`, published by `canRunAnalysis` precisely so a
 * surface can render the refusal without recomputing it
 * (`GateBlockedListing`: "the summary string beside the list, so the surfaces
 * can PROVE the two came from one computation rather than compare their bytes
 * and hope"). This component adds no rung, no threshold and no copy of its own
 * beyond a heading — a second expression of a refusal is the mirror that let
 * two surfaces disagree about one model before.
 *
 * ⚠ THE ROUTE IS THE GATE'S TOO. `GateBlockedItem.scope` is attached only when
 * EXACTLY ONE blocker authored that exact sentence — the composer refuses to
 * link a line that speaks for several, because a wrong link "looks exactly as
 * authoritative as a correct one". So a row is clickable when the gate said it
 * is safe to be, and inert otherwise. This surface never decides that.
 *
 * ⚠ STALENESS IS ALREADY HANDLED UPSTREAM AND MUST NOT BE RE-HANDLED HERE.
 * `composeReadinessBlockedReason` short-circuits every rung to
 * `BLOCKED_REASON_COPY.staleRecheck` when the verdict has outlived the model it
 * graded, before any field is read. A second staleness test here would be a
 * second authority on the same question — the exact defect class this file's
 * own dependencies were built to end.
 */
import { AlertCircle } from 'lucide-react'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { GateBlockedListing } from '../../../../canvas/utils/canRunAnalysis'

export interface WhyNoAnalysisYetProps {
  /**
   * The run gate's published refusal, or null when the run is not blocked (or
   * no verdict exists yet). Null renders NOTHING — an empty explanation box on
   * a model that can run would be an invented obstacle.
   */
  listing: GateBlockedListing | null | undefined
  /** Route to a node on canvas. The tab already owns this. */
  onFocusTarget: (id: string) => void
  testId?: string
}

export function WhyNoAnalysisYet({
  listing,
  onFocusTarget,
  testId = 'analysis-new-why-no-analysis',
}: WhyNoAnalysisYetProps) {
  const sentences = listing?.sentences ?? []
  // ⚠ NO LISTING, OR NOTHING TO LIST, RENDERS NOTHING. An "everything is fine"
  // reassurance would be a claim this component never measured, and a heading
  // over an empty list reads as a failure to load.
  if (sentences.length === 0) return null

  return (
    <div
      className="mt-2 rounded border border-panel-border bg-panel-hover p-2 space-y-1"
      data-testid={testId}
    >
      <p className={`${typography.panelMeta} text-text-body flex items-center gap-1.5 m-0`}>
        <AlertCircle className="w-3 h-3 shrink-0 text-warning" aria-hidden="true" />
        {COPY.whyNoAnalysis.heading}
      </p>
      <ul className="list-none p-0 m-0 space-y-1">
        {sentences.map((item, i) => {
          const targetId = item.scope?.id
          return (
            <li
              key={`${item.text}-${i}`}
              className={`${typography.panelMeta} text-text-light min-w-0`}
              data-testid={`${testId}-item`}
              data-has-route={targetId ? 'true' : 'false'}
            >
              {/* ⚠ THE SENTENCE IS RENDERED VERBATIM, INSIDE THE CONTROL OR
                  OUTSIDE IT — never re-worded for the clickable case. The two
                  branches differ only in whether the row routes. */}
              {targetId ? (
                <button
                  type="button"
                  onClick={() => onFocusTarget(targetId)}
                  className="text-left underline underline-offset-2 decoration-dotted hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded"
                  data-testid={`${testId}-route`}
                  data-target-id={targetId}
                >
                  {item.text}
                </button>
              ) : (
                item.text
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
