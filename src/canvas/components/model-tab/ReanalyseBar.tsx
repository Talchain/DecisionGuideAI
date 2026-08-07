/**
 * ReanalyseBar — sticky bottom bar prompting re-analysis after graph edits.
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
      className="sticky bottom-0 left-0 right-0 bg-panel border-t border-warning/30 px-3 py-2 flex items-center justify-between gap-2"
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
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-text-on-color ${typography.panelMeta} font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shrink-0`}
        data-testid="reanalyse-button"
      >
        <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Re-analyse
      </button>
    </div>
  )
}
