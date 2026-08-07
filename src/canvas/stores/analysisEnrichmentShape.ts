/**
 * The ONE reader of an analysis enrichment envelope, shared by every caller
 * that rebuilds an `AnalysisSnapshot` from one.
 *
 * ⚠ WHY THIS MODULE EXISTS AT ALL (CLAUDE.md trap 12 — derive, don't mirror).
 * There are now TWO sources of the same material:
 *
 *   1. a persisted `v5_handler_facts` `run_analysis` row's
 *      `payload.result.enrichment`  (`persistedRunSnapshotFactory`)
 *   2. a live V5 turn's `analysis_result` block's own `enrichment`
 *      (`v5RunSnapshotFactory`, ROADMAP 2.350)
 *
 * They are the SAME bytes at two moments — (1) is (2) after CEE persisted it.
 * Giving each its own guards would be a mirror of exactly the estate's
 * hard-won absence-preserving logic, and the two copies would drift: the
 * enrichment-root sibling extractors already had to be fixed twice
 * (ROADMAP 2.173 / 2.177) because a compensation lived in one caller and not
 * the other, so the SAME Compare surface rendered values or `[]` depending on
 * which caller built the snapshot. This module is the un-mirrorable half.
 *
 * It does NOT re-derive anything. It validates, then reshapes into the
 * `V2RunResponse` slot the ONE factory (`buildAnalysisSnapshot`) already
 * consumes.
 */
import type { V2RunResponse } from '../../adapters/plot/v2/types'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0
}

/**
 * A readable analysis envelope. `null` from the parser means "this cannot be
 * read as a completed analysis", and the caller DROPS it rather than
 * defaulting it.
 */
export interface ParsedAnalysisEnrichment {
  enrichment: Record<string, unknown>
  /**
   * The two arrays every DECIDING snapshot field comes from, carried out of
   * the parser already proven non-empty, so `toV2ResponseShape` has no `?? []`
   * arm that reads like sanctioned defaulting. Readability only — see that
   * function's header for why this is NOT a second line of defence.
   */
  optionComparison: unknown[]
  factorSensitivity: unknown[]
}

/**
 * Read an untrusted enrichment envelope.
 *
 * ⚠ A PRESENT ENVELOPE IS NOT A READABLE RUN. Found by the adversarial review
 * of PR #523 (finding 1) and closed here.
 *
 * Until this guard existed, callers accepted any object with an `enrichment`
 * key and `toV2ResponseShape` DEFAULTED a missing or empty `option_comparison`
 * to `[]`. `buildAnalysisSnapshot`'s pre-existing `winner?.win_probability ?? 0`
 * then produced a fully renderable snapshot. The reviewer's probe, reproduced
 * verbatim:
 *
 *   RESULT:  {"winnerId":"","winnerLabel":"","winnerProbability":0,
 *             "goalProbability":null,"runnerUpProbability":null}
 *   FACTORS: {"topElasticity":0,"rankFlipRate":0,
 *             "influenceConcentration":0,"topCalibrationFactor":""}
 *
 * i.e. a run plotted on the trajectory at 0% with an empty winner label, and a
 * hero inviting the user to "Calibrate " at "0% influence" — three fabricated
 * measurements in one sentence.
 *
 * Both arrays are non-empty in 773/773 live persisted facts AND in both
 * `analysis_result` blocks captured off the live guest wire on the 2026-08-04b
 * walk (4 options / 6 factors each), so this costs nothing on real data — it
 * is a guard against PRODUCER DRIFT, and it makes that drift loud by omission
 * (a run vanishes from the journey) instead of silently publishing zeros the
 * engine never measured.
 *
 * Every OTHER producer field stays absence-preserving rather than drop-worthy
 * (`recommendation_stability` is legitimately absent in 426/773 runs and must
 * render "Not assessed", not delete the run).
 */
export function parseAnalysisEnrichment(value: unknown): ParsedAnalysisEnrichment | null {
  const enrichment = asRecord(value)
  // No envelope ⇒ nothing to render. A payload that carries none is a producer
  // change, and the honest response is to omit the run from the journey, not
  // to render a run with every field blank.
  if (!enrichment) return null

  if (!isNonEmptyArray(enrichment.option_comparison)) return null
  if (!isNonEmptyArray(enrichment.factor_sensitivity)) return null

  return {
    enrichment,
    optionComparison: enrichment.option_comparison,
    factorSensitivity: enrichment.factor_sensitivity,
  }
}

/**
 * The `robustness` slot, read off the untrusted envelope.
 *
 * This was `composeRobustness`, the root→robustness fold — deleted as
 * redundant once all three sibling extractors adopted the root-wins dual read
 * (ROADMAP 2.173 / 2.177). What remains is only the slot read, with `{}` — not
 * undefined — preserved for an absent or malformed `robustness`, exactly as
 * the fold-era code behaved.
 */
function readRobustnessSlot(enrichment: Record<string, unknown>): V2RunResponse['robustness'] {
  // Double cast, deliberately: the object is untrusted JSONB, not a validated
  // V2RobustnessActual. The factory's extractors already re-read every field
  // off it defensively (`as Record<string, unknown>` + type guards), so
  // widening through `unknown` is honest about what is known — asserting the
  // nominal type directly would claim a validation nobody did.
  return (asRecord(enrichment.robustness) ?? {}) as unknown as V2RunResponse['robustness']
}

/**
 * Shape the parsed envelope into the `V2RunResponse` slot the factory
 * consumes. No value is invented: absent producer fields stay absent, and the
 * factory's own absence-preserving branches then fire.
 *
 * It takes the PARSED envelope rather than the raw enrichment so that the two
 * deciding arrays arrive already proven non-empty and this function has no
 * `Array.isArray(...) : []` arm that READS like sanctioned defaulting.
 *
 * ⚠ BE CLEAR ABOUT WHAT THIS IS NOT. It is **not** a second line of defence.
 * `buildAnalysisSnapshot` has its own `rawV2Response.option_comparison ?? []`
 * and `factor_sensitivity ?? []` (analysisSnapshotFactory.ts:250,257), so
 * deleting the `parseAnalysisEnrichment` guards would re-create finding 1
 * exactly, whatever this function passes through. Mutation-checked: restoring
 * the defaulting arm here with the guards intact REDs nothing (M13), while
 * deleting either guard REDs immediately (M10/M11). **The guards in
 * `parseAnalysisEnrichment` are the whole fix; this is readability, and it
 * must not be mistaken for a guarantee.**
 *
 * `responseHash` is threaded in because `buildAnalysisSnapshot` reads run
 * identity off `rawV2Response.response_hash` (analysisSnapshotFactory.ts:500).
 * Persisted facts carry it inside the enrichment (773/773 live rows); the live
 * V5 block does NOT — the applicator derives it — so that caller passes it
 * explicitly. Omitting it leaves the enrichment's own value in place.
 */
export function enrichmentToV2ResponseShape(
  parsed: ParsedAnalysisEnrichment,
  responseHash?: string | null,
): V2RunResponse {
  return {
    ...parsed.enrichment,
    option_comparison: parsed.optionComparison,
    factor_sensitivity: parsed.factorSensitivity,
    robustness: readRobustnessSlot(parsed.enrichment),
    ...(responseHash ? { response_hash: responseHash } : {}),
  } as unknown as V2RunResponse
}
