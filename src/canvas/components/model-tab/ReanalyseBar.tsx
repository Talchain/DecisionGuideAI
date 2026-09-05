/**
 * ReanalyseBar — in-flow bar prompting re-analysis after graph edits.
 *
 * ⚠ IT WAS `sticky bottom-0`, AND THAT WAS THE CONFIRMED OVERLAP. The Model
 * surface declares `scroll: 'shell'`, so its content sits inside the dock's
 * `overflow-y-auto` body and `ModelTabBody` creates no scroll container of its
 * own. A `sticky bottom-0` element therefore pinned itself to the bottom of
 * the dock's scroller from a mid-list position — and it is opaque (`bg-panel`),
 * so it occluded `ModelFooter`, which is rendered immediately AFTER it, plus
 * everything below. The footer was reachable only by the user not noticing it
 * was covered.
 *
 * The shell owns the footer region and reserves space for it as a flex SIBLING
 * of the scrolling body; that is the mechanism a bar like this should use. The
 * `sticky` is simply removed here: the bar is in flow, at the end of the Model
 * content, where it can occlude nothing. Per the shell contract a child surface
 * may not use bottom-anchored `sticky` inside the body, and the conformance
 * guard now REDs on it.
 *
 * ⚠ THE BAR'S CLAIM AND THE BUTTON'S GATE ARE TWO QUESTIONS, NOT ONE (trap 21).
 * *"Has the model changed since the last run?"* is what this bar SAYS;
 * *"may an analysis run right now?"* is what its button may DO. They are
 * independently true, so `canRun` gates the control and never edits the claim.
 *
 * ⚠ AND THE CONTROL WAS UNGATED — WITNESSED ON DEPLOYED `582b7ea7` (5 Sep 2026).
 * On one starter model at one moment the Analysis tab's `pre-analysis-v3-analyse`
 * sat DISABLED with "Analysis is held on a saved example. Re-draft it live to run
 * one.", while this button sat ENABLED with no title on both surfaces that host
 * it. Pressing it produced ZERO network requests (read at the CDP layer) and no
 * change to the tab's content.
 *
 * ⚠ AND THE FIRST TELLING OF THIS OVERSTATED IT. It said the click "terminated
 * in silence". `handleRunAnalysis` calls `showToast(outcome.reason, 'warning')`
 * and the dock sits inside a real `ToastProvider`, so a blocked click should
 * raise a `role="alert"` carrying the same sentence. The capture could not tell
 * a raised toast from the starter banner, which was already displaying that
 * exact sentence — so ZERO-NETWORK is measured and SILENCE is not. The defect
 * is a control that looks pressable and cannot work; the explanation arriving
 * only after the press, in a notice that dismisses itself, is the lesser half.
 *
 * `canRun`/`blockedReason` are `OutputsDock`'s own `canRunAnalysis` /
 * `runBlockedTooltip` — the SAME pair its sibling `AnalysisReadinessBar` is
 * handed from the SAME switch, computed once above the tab branch. Nothing is
 * re-derived here, and that sibling's rule applies verbatim: the button "is
 * `disabled` on exactly `!canRun`, and carries the gate's own sentence as its
 * `title`. It must never look pressable while the gate is shut."
 *
 * Visible only when the analysis is DEFINITELY out of date — the composed
 * trust semantic (`useAnalysisTrust`) is 'changed' (CEE 'stale' OR a
 * retained-fresh-now-dirtied by a local edit), NOT the local
 * `graphEditedSinceLastRun` flag (which would claim "Model changed" without a
 * CEE verdict). Triggers onReanalyse() which calls OutputsDock's handleRunAnalysis.
 */

import { RefreshCw } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { gateBlockedSubline } from '../pre-analysis-v3/footer/readinessDisplay'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useCanvasStore } from '../../store'

interface ReanalyseBarProps {
  onReanalyse?: () => void
  /**
   * `OutputsDock`'s `canRunAnalysis` — the run gate, not a copy of it.
   *
   * ⚠ DEFAULTS TO TODAY'S BEHAVIOUR, DELIBERATELY. Losing this control outright
   * is a defect this component has already paid for once (ROADMAP 2.129 (a)),
   * so an absent verdict is not read as a refusal. That default is only safe
   * because a guard asserts the shell's `reanalyse` arm actually passes the
   * pair — without it the default would quietly reinstate the ungated button.
   */
  canRun?: boolean
  /** `OutputsDock`'s `runBlockedTooltip`. Read only while the gate is shut. */
  blockedReason?: string
  /**
   * `OutputsDock`'s `isRunning`, and it is NOT optional to the logic even though
   * it is optional to the type.
   *
   * ⚠ WITHOUT IT THIS BAR CALLS A RUNNING ANALYSIS A REFUSAL. `canRunAnalysis`
   * is false WHILE a run is in flight, so `blocked = !canRun` alone puts
   * "Analysis is currently running" through `gateBlockedSubline` and prints it
   * as the reason the button is dead. Every other consumer of this pair
   * excludes the running state — `AnalysisReadinessBar` computes
   * `blocked = !canRun && !isAnalysing`, and so do `PanelFooter:168` and both
   * `OutputsDock` sites. This bar is now the same expression, not a fourth one.
   */
  isAnalysing?: boolean
}

export function ReanalyseBar({
  onReanalyse,
  canRun = true,
  blockedReason,
  isAnalysing = false,
}: ReanalyseBarProps) {
  const { semantic } = useAnalysisTrust()
  const importHold = useCanvasStore((s) => s.importPendingServerRegistration)

  // AFFORDANCE ≠ ASSERTION (interim 2.467). This bar is BOTH the "Model
  // changed" claim and the Model tab's ONLY re-analyse control — and conflating
  // them is what cost the control once already (ROADMAP 2.129 (a), live-proved
  // on staging `98aae72e`), then nearly again here: an import hold downgrades
  // the semantic to cannot-confirm, which under the old `!== 'changed'` guard
  // removed the button outright. The Rerun in the sticky AnalysisFooter is NOT
  // a substitute — that footer lives in OutputsDock's RESULTS branch, while
  // this bar's ModelTabBody is a sibling under `diagnostics`, so a Model-tab
  // user loses the control entirely.
  //
  // So: render for a held cannot-confirm too, with copy that states uncertainty
  // instead of asserting a change. You can be honestly unsure AND still offer
  // the button.
  const heldUnsure = importHold && semantic === 'cannot_confirm'
  if (semantic !== 'changed' && !heldUnsure) return null

  // The gate's verdict, and the gate's own sentence. Both arrive from the shell;
  // neither is recomputed. `blockedSentence` goes through the shared
  // `gateBlockedSubline` so a refusal without a reason still says something —
  // the same fallback the pre-analysis footer and the readiness bar use.
  // The sibling's expression, verbatim. A run in flight is not a refusal.
  const blocked = !canRun && !isAnalysing
  const blockedSentence = blocked ? gateBlockedSubline(blockedReason) : undefined

  return (
    <div
      className="bg-panel border-t border-warning/30 px-3 py-2 flex items-center justify-between gap-2"
      data-testid="reanalyse-bar"
      data-reason={heldUnsure ? 'import-unregistered' : 'model-changed'}
      role="status"
      aria-live="polite"
    >
      <span className={`${typography.panelMeta} text-text-light flex-1 min-w-0`}>
        {heldUnsure
          ? "Can't confirm this analysis matches the current model."
          : 'Model changed. Results may be out of date.'}
        {/* ⚠ TEXT, NOT ONLY A `title`. The witnessed defect was not merely that
            the button was pressable — it was that pressing it said NOTHING, and
            a tooltip is unreachable by touch and by keyboard, so the reason has
            to be legible without a pointer. The `title` below is kept as well,
            for parity with the sibling bar's blocked treatment. */}
        {blocked && (
          <span className="block text-text-light/80" data-testid="reanalyse-blocked-reason">
            {blockedSentence}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onReanalyse}
        disabled={!onReanalyse || blocked || isAnalysing}
        title={blocked ? blockedSentence : undefined}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-text-on-color ${typography.panelMeta} hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0`}
        data-testid="reanalyse-button"
      >
        <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Re-analyse
      </button>
    </div>
  )
}
