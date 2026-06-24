/**
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
