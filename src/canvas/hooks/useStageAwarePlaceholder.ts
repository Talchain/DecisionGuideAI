import { useCanvasStore, selectResultsStatus } from '../store'
import { useStaleGuard } from '../ui/inspector-v2/useStaleGuard'
import { useSelectionContext } from './useSelectionContext'

/**
 * Returns the placeholder text the persistent input strip / floating composer
 * should display, derived from the current canvas + analysis + selection state.
 *
 * Priority (highest first):
 *   1. Node/edge selected      → "Ask about [label]..."
 *   2. Post-analysis stale     → "Model changed. Ask or rerun..."
 *   3. Post-analysis current   → "Ask about the latest analysis..."
 *   4. Model exists            → "Ask about this model..."
 *   5. No model                → "Describe your decision..."
 */
export function useStageAwarePlaceholder(): string {
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const resultsStatus = useCanvasStore(selectResultsStatus)
  const { analysisState } = useStaleGuard()
  const selection = useSelectionContext()

  if (selection) {
    return `Ask about ${selection.label}…`
  }
  if (analysisState === 'stale') {
    return 'Model changed. Ask or rerun…'
  }
  if (resultsStatus === 'complete' && analysisState === 'current') {
    return 'Ask about the latest analysis…'
  }
  if (nodeCount > 0) {
    return 'Ask about this model…'
  }
  return 'Describe your decision…'
}
