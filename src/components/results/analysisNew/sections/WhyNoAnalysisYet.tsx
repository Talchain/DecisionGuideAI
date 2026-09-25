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
/**
 * @panel-act-opt-out a dotted-underline word inside a sentence; a tier's padding would break the line it sits in
 *
 * ⚠ DECLARED, NOT SILENT. This file renders an interactive element without an
 * `action()` tier. The geometry is therefore carried HERE and must be BOTH
 * dimensions — WCAG 2.2 AA is 24x24, and a control that passes the height and
 * fails the width is the exact shape the Strengthen row toggle shipped (22px).
 * `everyActIsReachableByTouch` reads this marker; removing it REDs the guard.
 */
import { AlertCircle } from 'lucide-react'
import { icon } from '../panelSurfaces'
import { typography } from '../../../../styles/typography'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { PanelIconButton } from '../PanelIconButton'
import type { AskOlumiPayload } from '../../coaching/askOlumiStore'
import type { GateBlockedListing } from '../../../../canvas/utils/canRunAnalysis'

export interface WhyNoAnalysisYetProps {
  /**
   * The run gate's published ITEMISED refusal, or null when the gate published
   * none. Nothing to list renders NOTHING — an empty explanation box on a model
   * that can run would be an invented obstacle.
   *
   * ⛔ IT IS NOT "NULL WHEN THE RUN IS NOT BLOCKED", WHICH IS WHAT THIS LINE
   * USED TO SAY, and the over-claim reached two consumers before it was
   * measured. `canRunAnalysis` states the opposite directly above its own early
   * returns: *"The early returns below do NOT publish a listing, and that is
   * deliberate … They are all single-blocker states, which render as a sentence
   * rather than a list anyway."* A held model, zero nodes, an unsettled
   * streamed draft and a run in flight all refuse with no listing. `reason`
   * below is that sentence.
   */
  listing: GateBlockedListing | null | undefined
  /**
   * ⭐⭐ THE SINGLE-BLOCKER SENTENCE — `getRunButtonTooltip(runGateResult)`, the
   * gate's own `reason`, passed through exactly as `listing` is and never
   * composed here. This component still adds no rung and no copy of its own.
   *
   * Read ONLY when the listing has nothing to list, so a refusal that itemises
   * never prints its summary beside its items.
   *
   * ⚠ NO ROUTE. `GateBlockedItem.scope` is attached by the composer only when
   * exactly one blocker authored that exact sentence; an early return publishes
   * no item and therefore no scope, so this row is deliberately inert rather
   * than linked to a guess.
   */
  reason?: string | null
  /** Route to a node on canvas. The tab already owns this. */
  onFocusTarget: (id: string) => void
  /**
   * The repair act: drafts "help me fix this" for ONE blocker in the composer,
   * bound to its node when the gate named one. Absent = no act, never a dead
   * one (the fail-closed shape `onSendMessage` uses on this tab).
   */
  onAsk?: (payload: AskOlumiPayload) => void
  testId?: string
}

export function WhyNoAnalysisYet({
  listing,
  reason = null,
  onFocusTarget,
  onAsk,
  testId = 'analysis-new-why-no-analysis',
}: WhyNoAnalysisYetProps) {
  const itemised = listing?.sentences ?? []
  /**
   * ⚠ THE FALLBACK IS SUBORDINATE, NEVER ADDITIVE. The itemised list wins
   * whenever it has anything in it — the summary and the items are two views of
   * ONE refusal, and printing both is the "two expressions of one refusal"
   * defect `GateBlockedListing` exists to close.
   */
  const sentences =
    itemised.length > 0
      ? itemised
      : typeof reason === 'string' && reason.trim() !== ''
        ? [{ text: reason }]
        : []
  // ⚠ NOTHING TO SAY RENDERS NOTHING. An "everything is fine" reassurance would
  // be a claim this component never measured, and a heading over an empty list
  // reads as a failure to load.
  if (sentences.length === 0) return null

  return (
    <div
      className="mt-2 rounded border border-panel-border bg-panel-hover p-2 space-y-1"
      data-testid={testId}
    >
      <p className={`${typography.panelMeta} text-text-body flex items-center gap-1.5 m-0`}>
        <AlertCircle className={`${icon('inline')} shrink-0 text-warning-ink`} aria-hidden="true" />
        {COPY.whyNoAnalysis.heading}
      </p>
      <ul className="list-none p-0 m-0 space-y-1">
        {sentences.map((item, i) => {
          const targetId = item.scope?.id
          return (
            <li
              key={`${item.text}-${i}`}
              className={`${typography.panelMeta} text-text-light min-w-0 flex items-start gap-1`}
              data-testid={`${testId}-item`}
              data-has-route={targetId ? 'true' : 'false'}
            >
              <span className="min-w-0 flex-1">
              {/* ⚠ THE SENTENCE IS RENDERED VERBATIM, INSIDE THE CONTROL OR
                  OUTSIDE IT — never re-worded for the clickable case. The two
                  branches differ only in whether the row routes. */}
              {targetId ? (
                <button
                  type="button"
                  onClick={() => onFocusTarget(targetId)}
                  className="text-left min-h-[24px] min-w-[24px] underline underline-offset-2 decoration-dotted hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-info rounded"
                  data-testid={`${testId}-route`}
                  data-target-id={targetId}
                >
                  {item.text}
                </button>
              ) : (
                item.text
              )}
              </span>
              {onAsk ? (
                <PanelIconButton
                  ai
                  label={COPY.whyNoAnalysis.askFix}
                  onClick={() =>
                    onAsk({
                      context: item.text,
                      draft: COPY.whyNoAnalysis.askFixDraft(item.text),
                      label: COPY.whyNoAnalysis.askFix,
                      ...(targetId ? { targetId } : {}),
                    })
                  }
                  testId={`${testId}-ask`}
                />
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
