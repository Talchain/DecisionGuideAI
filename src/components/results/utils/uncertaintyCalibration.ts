/**
 * uncertaintyCalibration — Sci-4B "verbal uncertainty calibration" v1.
 *
 * Maps the analysis result's robustness verdict/band (already on the wire —
 * `report.robustness.level` / `.label` via mapV5AnalysisToReport and
 * useResultsSectionData's `robustnessLevel`/`robustnessLabel`, or
 * `block.enrichment.robustness.level` on the raw V5 conversational block) to
 * calibrated verbal framing:
 *
 *   - high robustness + tight interval  → "fairly confident"
 *   - moderate robustness               → "it appears… though there's
 *                                          meaningful uncertainty"
 *   - low/fragile robustness            → "tentative — the uncertainty is
 *                                          substantial"
 *
 * Honest-render rule: renders ONLY from fields the wire actually carries. No
 * robustness signal on the wire → returns null (say nothing, never invent a
 * confidence level). This mirrors the UI's passthrough doctrine — see
 * DecisionGuideAI/CLAUDE.md "Core doctrine: the UI is a passthrough".
 *
 * Code-keyed templates only (V14.3 no-raw-message guard style) — never
 * interpolates raw upstream text, so there is nothing here for the
 * internal-token / raw-message leak guards to catch.
 *
 * Pure function — shared by both surfaces that render this calibration:
 * DecisionConfidencePanel (results panel headline) and V5AnalysisResultBlock
 * (conversational analysis_result block), each responsible for extracting
 * the primitive inputs from their own (differently-shaped) data.
 */

export type UncertaintyTier = 'confident' | 'moderate' | 'tentative'

export interface UncertaintyCopy {
  tier: UncertaintyTier
  text: string
}

const CONFIDENT_TEXT = 'This result looks fairly confident.'
const MODERATE_TEXT =
  "It appears the result holds, though there's meaningful uncertainty in the estimate."
const TENTATIVE_TEXT = 'This result is tentative. The uncertainty is substantial.'

type RobustnessBand = 'high' | 'moderate' | 'low'

/**
 * Normalise the two alternative wire spellings of the robustness verdict —
 * `level` ('high'|'moderate'|'low'|'very_low') and the fallback `label`
 * ('robust'|'moderate'|'fragile') — into one 3-way band. Returns undefined
 * when neither field is present/recognised (honest-render: caller must say
 * nothing rather than guess).
 */
function normaliseBand(
  level: string | null | undefined,
  label: string | null | undefined,
): RobustnessBand | undefined {
  if (level === 'high') return 'high'
  if (level === 'moderate') return 'moderate'
  if (level === 'low' || level === 'very_low') return 'low'
  if (label === 'robust') return 'high'
  if (label === 'moderate') return 'moderate'
  if (label === 'fragile') return 'low'
  return undefined
}

export interface CalibrateUncertaintyInput {
  /** Wire field: report.robustness.level / recommendation.robustnessLevel */
  robustnessLevel?: string | null
  /** Wire field: report.robustness.label / recommendation.robustnessLabel (fallback naming) */
  robustnessLabel?: string | null
  /** Headline option's outcome.p10 (10th percentile) */
  p10?: number | null
  /** Headline option's outcome.p90 (90th percentile) */
  p90?: number | null
}

/**
 * Calibrate the robustness band + interval into a fixed verbal-framing
 * template. Returns null when there is no robustness signal on the wire at
 * all — the honest-render rule says nothing rather than invent a tier.
 */
export function calibrateUncertaintyCopy(
  input: CalibrateUncertaintyInput,
): UncertaintyCopy | null {
  const band = normaliseBand(input.robustnessLevel, input.robustnessLabel)
  if (!band) return null

  if (band === 'low') {
    return { tier: 'tentative', text: TENTATIVE_TEXT }
  }

  if (band === 'moderate') {
    return { tier: 'moderate', text: MODERATE_TEXT }
  }

  // band === 'high' — UI-SEM-073: downgrade the "fairly confident" framing
  // when the outcome interval straddles zero (the direction of the outcome
  // itself is still uncertain even though the edge-robustness band is
  // high). Classification of existing wire values only — no numbers
  // fabricated, same class as UI-SEM-050 (leadingOptionDownsideFlag).
  const p10 = input.p10
  const p90 = input.p90
  const straddlesZero =
    typeof p10 === 'number' && Number.isFinite(p10) &&
    typeof p90 === 'number' && Number.isFinite(p90) &&
    p10 < 0 && p90 > 0

  if (straddlesZero) {
    return { tier: 'moderate', text: MODERATE_TEXT }
  }

  return { tier: 'confident', text: CONFIDENT_TEXT }
}
