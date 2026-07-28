/**
 * InlineRerunPrompt — compact re-run nudge shown below an edited control
 * when analysis results are stale. Does not replace StaleGuardBanner.
 *
 * ⚠ THE DEFECT THIS FILE'S SHAPE EXISTS TO PREVENT (ROADMAP 2.102, fixed
 * 2026-07-28). The button used to be wrapped in `{onRerun && (…)}` with
 * `onRerun` an OPTIONAL prop — and all four render sites (EdgePanel,
 * FactorControllablePanel, FactorObservablePanel, RiskPanel) passed only
 * `visible`. So the prompt rendered its instruction — "Re-run to see how this
 * affects the results" — and NEVER rendered the control that would do it.
 * After the #513 value-edit loop landed, that made the inspector's post-edit
 * advice unfollowable: the copy told the user to re-run and gave them nothing
 * to click. Live-confirmed on staging `03e13443` (the prompt text visible, a
 * `button:has-text("Re-run")` count of ZERO).
 *
 * That was a hand-maintained mirror (CLAUDE.md trap 12): four call sites each
 * had to remember to pass the wiring, and all four forgot. The fix removes the
 * mirror rather than repairing it — this component now OWNS its dispatch, so
 * there is no prop for a call site to omit and no way to render a dead button.
 *
 * ONE dispatch, never a parallel path: it calls `executeCanonicalRun`, the same
 * registry every other run affordance goes through (canvas ⌘Enter, command
 * palette, Actions menu, Define-success modal) and which resolves to
 * OutputsDock's `runCanonicalAnalysis` — the identical pipeline the composer's
 * rerun uses, with the same gate, the same `flushPendingSaves` barrier and the
 * same stored-goal_threshold re-attachment.
 *
 * It never no-ops silently. `executeCanonicalRun` folds every refusal into one
 * outcome union carrying a human-readable reason; each is surfaced as a toast.
 * A run already in flight disables the button instead of racing it.
 */

import { useCallback } from 'react'
import { typography } from '../../../../styles/typography'
import { useShowToastSafe } from '../../../ToastContext'
import { useAnalysisTrust } from '../../../hooks/useAnalysisTrust'
import { executeCanonicalRun } from '../../../analysis/canonicalRunRegistry'

interface InlineRerunPromptProps {
  visible: boolean
}

export function InlineRerunPrompt({ visible }: InlineRerunPromptProps) {
  const showToast = useShowToastSafe()
  // Same composed trust surface the Model tab's ReanalyseBar reads, so the two
  // rerun affordances can never disagree about whether a run is in flight.
  const { isRunning } = useAnalysisTrust()

  const handleRerun = useCallback(async () => {
    const outcome = await executeCanonicalRun({ source: 'inspector-inline-rerun' })
    // 'dispatched' / 'v2' are the two success shapes. Everything else carries a
    // reason the user is entitled to see — a rerun control that swallows its
    // own refusal is the guarantee-theatre this lane exists to remove.
    if (outcome.status === 'blocked' || outcome.status === 'unavailable') {
      showToast(outcome.reason, 'warning')
    } else if (outcome.status === 'already-running') {
      showToast('Analysis is already running.', 'info')
    }
  }, [showToast])

  if (!visible) return null

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <span className={`${typography.panelMeta} text-text-light`}>
        Re-run to see how this affects the results
      </span>
      <button
        type="button"
        data-testid="inline-rerun"
        onClick={handleRerun}
        disabled={isRunning}
        aria-label="Re-run the analysis"
        className={`${typography.panelMeta} px-2 py-0.5 rounded-full border border-primary/30 bg-transparent text-primary hover:bg-panel-hover transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {isRunning ? 'Re-running…' : 'Re-run'}
      </button>
    </div>
  )
}
