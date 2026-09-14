/**
 * A POINTER, NOT A CLAIM.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * A person can edit a value here and re-run here without ever leaving the Model
 * tab — and the explanation of what that did lives on the Reasoning tab. This
 * one line sends them to it.
 *
 * ⛔ NAVIGATION TEXT CAN STILL MAKE A FALSE PROMISE, WHICH IS WHY THE WORDING IS
 * NARROW. The nearest precedent in this estate is `compare-tab/Hero.tsx:176`'s
 * "Review what caused the change" — which survived a round that deleted the
 * causal sentence beside it, and should not have: it presupposes a cause even as
 * a button label. On four of the producer's five cases (`C2_unpaired`,
 * `C3_engine_drift`, `C4_budget_drift`, and `C0_identical`) there is no cause to
 * review, and the producer has explicitly refused to attribute one. So this says
 * "View comparison" and nothing more.
 *
 * ⛔ GATED ON THE DELTA BEING PRESENT *AND* ABOUT THE ANALYSIS ON SCREEN, by the
 * same predicate the Reasoning tab's section uses. A pointer rendered on absence
 * points at nothing; a pointer rendered on a superseded delta points at the
 * wrong thing. One predicate, so the two surfaces cannot disagree about whether
 * there is anything to see.
 */

import { useCanvasStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'
import { runDeltaDescribesDisplayedAnalysis } from '../../state/storedRunDelta'
import { typography } from '../../../styles/typography'

export const VIEW_COMPARISON_TESTID = 'model-tab-view-comparison'

export function ViewComparisonPointer(): JSX.Element | null {
  const stored = useCanvasStore((s) => s.runDelta)
  const displayedHash = useCanvasStore((s) => s.results?.hash)
  const scenarioId = useCanvasStore((s) => s.currentScenarioId)

  if (!runDeltaDescribesDisplayedAnalysis(stored, displayedHash, scenarioId)) return null

  return (
    <div className={`${typography.panelMeta} text-text-light px-3 py-1.5`} data-testid={`${VIEW_COMPARISON_TESTID}-row`}>
      <button
        type="button"
        // `text-info` + underline on a real <button> is what says PRESSABLE on
        // these panels; the estate pins that with `actionColourMeansPressable`.
        className="text-info underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-info"
        data-testid={VIEW_COMPARISON_TESTID}
        onClick={() => { useUIStore.getState().setActiveOutputTab('analysisNew') }}
      >
        View comparison
      </button>
    </div>
  )
}
