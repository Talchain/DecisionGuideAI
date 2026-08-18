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
 * Visible only when the analysis is DEFINITELY out of date — the composed
 * trust semantic (`useAnalysisTrust`) is 'changed' (CEE 'stale' OR a
 * retained-fresh-now-dirtied by a local edit), NOT the local
 * `graphEditedSinceLastRun` flag (which would claim "Model changed" without a
 * CEE verdict). Triggers onReanalyse() which calls OutputsDock's handleRunAnalysis.
 */

import { RefreshCw } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useCanvasStore } from '../../store'

interface ReanalyseBarProps {
  onReanalyse?: () => void
}

export function ReanalyseBar({ onReanalyse }: ReanalyseBarProps) {
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
      </span>
      <button
        type="button"
        onClick={onReanalyse}
        disabled={!onReanalyse}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-text-on-color ${typography.panelMeta} hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0`}
        data-testid="reanalyse-button"
      >
        <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Re-analyse
      </button>
    </div>
  )
}
