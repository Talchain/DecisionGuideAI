/**
 * AnalysisReadinessBar — the pre-run readiness statement, on the surface the
 * product's own advice sends the user to.
 *
 * ── THE WITNESSED DEFECT (fresh guest, headful Chrome, 20 Aug 2026) ────────
 * With the run blocked, the Analysis footer says, verbatim:
 *
 *     "4 parts of your model are not ready for analysis yet.
 *      Ask in the chat what they need."
 *
 * Selecting the Olumi tab — doing exactly that — UNMOUNTS the whole
 * pre-analysis subtree, because `OutputsDock` renders it under
 * `{effectiveActiveTab === 'results' && …}`. The sentence and the Analyse
 * control both leave the DOM. The instruction destroyed its own context: the
 * user arrives in the chat with nothing on screen saying what they came to ask
 * about, and no control to run once the answer lands.
 *
 * ── WHAT THIS BAR IS, AND THE FOUR THINGS IT DELIBERATELY IS NOT ───────────
 * The shell hosts it in its reserved footer region, declared by the Olumi
 * surface as `footerBar: 'readiness'` (`shellContract.ts`) — the same mechanism
 * the Model surface uses to ask for `ReanalyseBar`, and for the same underlying
 * reason: the control the surface needs is mounted on `results` only.
 *
 *  1. NOT A SECOND GATE. `canRun` and `blockedReason` are the shell's own
 *     `canRunAnalysis` / `runBlockedTooltip` — the SAME two values the Analysis
 *     footer's button and title are derived from, computed once in
 *     `OutputsDock` above the tab branch. Nothing is re-derived here. A bar
 *     that recomputed readiness would be the two-authorities defect this estate
 *     keeps paying for.
 *  2. NOT A SECOND RUNNER. `onAnalyse` is `handleRunAnalysis`, the canonical
 *     runner registered in `canonicalRunRegistry`. The retired
 *     `StaleAnalysisBadge` is the counter-example: its rerun bypassed it.
 *  3. NOT A FRESHNESS SURFACE. It renders only PRE-RUN. Staleness after a
 *     completed analysis belongs to the freshness strip and `ReanalyseBar`, and
 *     adding a third claimant is what got the last one retired.
 *  4. NOT A NEW SENTENCE. Every string here is the one the Analysis footer
 *     already renders for the same state, through the same `vetBlockedReason`.
 *     Two surfaces, one copy authority.
 *
 * ⚠ THE BUTTON'S HONESTY IS THE POINT AND IS NOT NEGOTIABLE. It is `disabled`
 * on exactly `!canRun`, and carries the same reason as its `title`. It must
 * never look pressable while the gate is shut — the blocked state on the
 * Analysis surface was hard-won and this surface inherits it rather than
 * re-deciding it.
 */

import { typography } from '../../../styles/typography'
import { FOOTER_COPY } from '../pre-analysis-v3/constants'
import { BLOCKED_REASON_FALLBACK, vetBlockedReason } from '../../utils/vetBlockedReason'

export interface AnalysisReadinessBarProps {
  /**
   * True while no analysis has completed AND there is a model to analyse —
   * i.e. exactly when the Analysis surface would be showing its pre-run panel.
   * The bar makes no claim outside that window.
   */
  preRunWithModel: boolean
  /** OutputsDock's `canRunAnalysis`. The run gate, not a copy of it. */
  canRun: boolean
  /** OutputsDock's `runBlockedTooltip`. Only read while `!canRun`. */
  blockedReason?: string
  /** OutputsDock's `isRunning`. */
  isAnalysing: boolean
  /** OutputsDock's `handleRunAnalysis` — the canonical runner. */
  onAnalyse: () => void
}

export function AnalysisReadinessBar({
  preRunWithModel,
  canRun,
  blockedReason,
  isAnalysing,
  onAnalyse,
}: AnalysisReadinessBarProps) {
  // Outside the pre-run window the Analysis surface itself shows no readiness
  // panel, so there is nothing to carry and a bar here would be a claim no
  // other surface is making.
  if (!preRunWithModel) return null

  const blocked = !canRun && !isAnalysing
  // While a run is in flight the gate reports blocked for an obvious reason the
  // label already states, so repeating a gate reason would be noise — and it is
  // not the reason the control is unpressable.
  const subline = blocked ? vetBlockedReason(blockedReason || BLOCKED_REASON_FALLBACK) : null

  return (
    <div
      className="bg-panel border-t border-panel-border px-3 py-2 flex items-center gap-3"
      data-testid="analysis-readiness-bar"
      data-blocked={blocked ? 'true' : 'false'}
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className={`h-2 w-2 flex-none rounded-full ${blocked ? 'bg-text-light' : 'bg-success'}`}
      />
      <div className="min-w-0 flex-1">
        <p className={`${typography.panelBody} text-text-header`}>
          {blocked ? FOOTER_COPY.notReady : FOOTER_COPY.ready}
        </p>
        {subline && (
          <p className={`${typography.panelMeta} text-text-light`} data-testid="analysis-readiness-bar-reason">
            {subline}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onAnalyse}
        disabled={isAnalysing || !canRun}
        title={blocked ? subline || undefined : undefined}
        className={`${typography.panelBody} flex-none rounded px-3 py-2 bg-primary text-text-on-color hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-info focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed`}
        data-testid="analysis-readiness-bar-analyse"
      >
        {isAnalysing ? FOOTER_COPY.analysing : FOOTER_COPY.analyse}
      </button>
    </div>
  )
}
