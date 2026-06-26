import { useCanvasStore, selectResultsStatus } from '../store'
import { classifyFreshnessForDisplay } from '../store/analysisFreshness'
import { useSelectionContext } from './useSelectionContext'

/**
 * Returns the placeholder text the persistent input strip / floating composer
 * should display, derived from the current canvas + analysis + selection state.
 *
 * Freshness comes from the CEE verdict + local dirty overlay
 * (classifyFreshnessForDisplay), NOT the legacy useStaleGuard graph-hash path
 * (_internal.graphHash is never written, so its 'stale' never fired and its
 * 'current' falsely persisted after an edit — the composer would still claim
 * "latest analysis" once the Results surface had moved to cannot-confirm).
 *
 * Priority (highest first):
 *   1. Node/edge selected            → "Ask about [label]..."
 *   2. Model changed since the run    → "Model changed. Ask or rerun..."
 *      (CEE 'stale' OR a local edit that downgraded a retained 'fresh')
 *   3. Confirmed current analysis     → "Ask about the latest analysis..."
 *   4. Analysis exists, can't confirm → "Ask about this analysis..."
 *      (cannot-confirm / no freshness verdict — never claims "latest")
 *   5. Model exists                   → "Ask about this model..."
 *   6. No model                       → "Describe your decision..."
 */
export function useStageAwarePlaceholder(): string {
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const resultsStatus = useCanvasStore(selectResultsStatus)
  const ceeFreshness = useCanvasStore((s) => s.analysisFreshness)
  const freshnessDirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const selection = useSelectionContext()
  const freshness = classifyFreshnessForDisplay(ceeFreshness, freshnessDirty)

  if (selection) {
    return `Ask about ${selection.label}…`
  }
  if (freshness === 'changed') {
    return 'Model changed. Ask or rerun…'
  }
  if (freshness === 'current') {
    return 'Ask about the latest analysis…'
  }
  // Analysis ran but freshness is cannot-confirm or absent → acknowledge the
  // analysis without claiming it is current.
  if (resultsStatus === 'complete') {
    return 'Ask about this analysis…'
  }
  if (nodeCount > 0) {
    return 'Ask about this model…'
  }
  return 'Describe your decision…'
}
