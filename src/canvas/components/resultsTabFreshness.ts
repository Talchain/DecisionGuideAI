/**
 * ⚠ COLLAPSED (analysis-state authority, step 5). This is one of the six
 * derivations now composed by `canvas/state/analysisStateSelector.ts`, and the
 * selector calls THIS function for the Results-tab member of its verdict —
 * there is no second copy of the rule below.
 *
 * A surface that wants the composed answer reads `useAnalysisState().resultsTab`
 * and gets wire authority for free. A surface that calls this function directly
 * still gets the legacy derivation, which is correct and unchanged but does NOT
 * consult CEE's `analysis_state`.
 *
 * ⚠ ONE SUCH CALL SITE REMAINS: `OutputsDock.tsx`. Re-pointing it is owned by
 * the OutputsDock lane, not this one (file ownership), so it is DISCLOSED here
 * rather than left to be discovered: until it moves, the Results-tab glyph is
 * the one truth surface still deriving its own answer.
 *
 * Results-tab freshness indicator decision.
 *
 * Maps the displayed freshness verdict (CEE verdict + local dirty overlay, via
 * resolveDisplayedFreshness) to the Results-tab label's icon treatment. Extracted
 * as a pure function so the "never fabricate stale" rule is explicit and unit-
 * testable without rendering OutputsDock (which pulls Supabase/ELK/heavy deps).
 *
 * The cannot-confirm overlay state ('unknown', produced when local edits downgrade
 * a retained 'fresh') must NEVER be mapped to the stale glyph/label — that would
 * fabricate 'stale', which the overlay never produces. It gets a NEUTRAL glyph +
 * neutral label instead, mirroring AnalysisFreshnessNotice's icon/copy map.
 * fresh/none → no icon. Gated off entirely when the aiPanelV2 surface is disabled.
 */

import type { AnalysisFreshnessValue } from '../store/analysisFreshness'

export interface ResultsTabFreshnessIndicator {
  /** Genuine CEE 'stale' verdict → warning glyph + "Analysis is stale". */
  reallyStale: boolean
  /** Cannot-confirm overlay state ('unknown') → NEUTRAL glyph + neutral label. */
  cannotConfirm: boolean
  /** Whether to render any freshness icon on the Results tab. */
  showIcon: boolean
}

export function deriveResultsTabFreshness(
  aiPanelV2On: boolean,
  displayedFreshness: AnalysisFreshnessValue | null,
): ResultsTabFreshnessIndicator {
  const f = aiPanelV2On ? displayedFreshness : null
  const reallyStale = f === 'stale'
  const cannotConfirm = f === 'unknown'
  return { reallyStale, cannotConfirm, showIcon: reallyStale || cannotConfirm }
}
