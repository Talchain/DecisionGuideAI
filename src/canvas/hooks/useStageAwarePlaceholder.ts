import { useCanvasStore, selectResultsStatus } from '../store'
import { useMayStalenessVoiceSpeak } from '../conversation/stalenessVoice'
import { useAnalysisTrust } from './useAnalysisTrust'

/**
 * Returns the placeholder text the persistent input strip / floating composer
 * should display, derived from the current canvas + analysis + selection state.
 *
 * Freshness comes from the composed trust semantic (useAnalysisTrust: CEE
 * verdict + local dirty overlay + orphan fold), NOT the legacy graph-hash
 * stale path (deleted 2026-07-16) (_internal.graphHash is never written, so
 * its 'stale' never fired and its 'current' falsely persisted after an edit —
 * the composer would still claim "latest analysis" once the Results surface
 * had moved to cannot-confirm).
 *
 * Priority (highest first):
 *   1. Model changed since the run    → "Model changed. Ask or rerun..."
 *      (CEE 'stale' OR a local edit that downgraded a retained 'fresh')
 *      — SUPPRESSED while a higher staleness voice is on screen, see below.
 *   2. Confirmed current analysis     → "Ask about the latest analysis..."
 *   3. Analysis exists, can't confirm → "Ask about this analysis..."
 *      (cannot-confirm / no freshness verdict — never claims "latest")
 *   4. Model exists                   → "Ask about this model..."
 *   5. No model                       → "Describe your decision..."
 *
 * ── L-17: THE SELECTION BRANCH IS GONE, DELIBERATELY ───────────────────────
 * This hook used to return "Ask about [label]…" whenever one element was
 * selected. That read as a PREPARED SENTENCE the user could send, and it was
 * not one: a placeholder is an attribute, the composer's value stayed empty,
 * and there was no way to submit it. The selection now carries a REAL,
 * submittable control (`SelectionPill`), so the placeholder returns to the
 * neutral prompt and stops impersonating content it never held.
 *
 * ── L-42: ONE STALENESS COMMUNICATION PER TURN VIEW ────────────────────────
 * The applied-edit card's freshness note and the freshness pill both outrank
 * this placeholder. While either is on screen the composer says the neutral
 * thing rather than being the third voice telling the user to re-run.
 * Suppression is limited to the 'changed' branch — the only one that repeats
 * the higher surfaces' claim.
 */
export function useStageAwarePlaceholder(): string {
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  const resultsStatus = useCanvasStore(selectResultsStatus)
  const freshness = useAnalysisTrust().semantic
  const mayNagAboutStaleness = useMayStalenessVoiceSpeak('placeholder')

  if (freshness === 'changed' && mayNagAboutStaleness) {
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
