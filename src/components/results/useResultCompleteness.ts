/**
 * Result-completeness derivation (P0 V5 golden-path repair, Wave 4).
 *
 * The Wave 4 trace (docs/v5/wave-4-source-to-render-trace.md) confirmed
 * no mapping or hydration bugs in the V5 results pipeline. The
 * remaining null-render risks are:
 *
 *   - Partial source coverage — PLoT returned a result, but specific
 *     fields are absent (e.g. `win_probability` per option, factor
 *     sensitivity values, robustness level).
 *   - UI-SEM fabrication masking — UI-SEM-005 / -006 / -016 / -041 /
 *     -044 silently substitute defaults so the layout doesn't break.
 *     The fabrications are intentional display floors, but they hide
 *     the fact that the underlying data is incomplete.
 *
 * `useResultCompleteness` consults the SOURCE fields BEFORE the UI-SEM
 * fabrications kick in and reports `{ status, missing[], reasons[] }`.
 * Consumers (HeroSection qualifier line, ResultsBody fallback panel)
 * surface partial completeness alongside the existing display so the
 * user sees an honest qualifier rather than fabricated values
 * presented as truth.
 *
 * Pure derivation, no store reads. Tests are table-driven against
 * fixtures that mirror real PLoT response shapes.
 */

import type { ReportV1 } from '../../adapters/plot/types'
import type { DriversPayload } from '../../adapters/driversAdapter'
import type { CeeDecisionReviewPayloadV1 } from '../../adapters/cee/types'
import type { DecisionReview030 } from '../../v5/decisionReviewAdapter'

import type { CompletenessReasonCode } from './copy/freshnessReasons'
import type { OptionComputeStatus } from '../../adapters/plot/optionComputeStatus'
/**
 * The producer's per-option classification, read through the ONE predicate that
 * owns it. Imported from `notAnalysedOptions` rather than respelled here: a
 * second spelling of `status !== 'failed'` would be a second authority on one
 * question, and this hook must classify an option identically to the service
 * that produced it.
 */
import { optionComputationProducedResult } from './utils/notAnalysedOptions'

export type ResultCompletenessStatus = 'full' | 'partial' | 'failed'

export type MissingFieldKey =
  | 'win_probability'
  | 'expected_outcome'
  | 'sensitivity'
  | 'robustness_level'
  | 'recommendation_stability'
  | 'decision_review'
  | 'top_drivers'

export type ResultCompleteness = {
  status: ResultCompletenessStatus
  missing: ReadonlyArray<MissingFieldKey>
  reasons: ReadonlyArray<CompletenessReasonCode>
}

export type ResultCompletenessInputs = {
  /**
   * Local results lifecycle status. `error` short-circuits to
   * status='failed' only when no retained report is displayed (post-SF2
   * the body renders the previous report at 'error' — its completeness
   * describes itself); pre-report states return status='full' with no
   * missing keys (no result to evaluate).
   */
  resultsStatus:
    | 'idle'
    | 'running'
    | 'preparing'
    | 'connecting'
    | 'streaming'
    | 'cancelled'
    | 'complete'
    | 'error'
    | undefined
  /**
   * The ReportV1 the UI is rendering. Null when no analysis has run.
   */
  report: ReportV1 | null | undefined
  /**
   * Decision review / coaching block from the CEE side. Carried
   * separately because `applyV5State` writes it to `runMeta`, not
   * onto `report`.
   */
  ceeReviewV1: CeeDecisionReviewPayloadV1 | null | undefined
  /**
   * ROADMAP 2.154 — the 0.30 `decision_review` view-model from a V5 analysis
   * turn, which `applyV5State` writes to `runMeta.decisionReview030`. Carried
   * separately from `ceeReviewV1` because the two are different payloads with
   * different producers; the `decision_review` completeness signal below is
   * satisfied by EITHER, and was previously blind to this one.
   */
  decisionReview030: DecisionReview030 | null | undefined
  /**
   * Drivers payload (separate from `report.drivers` per the trace).
   */
  driversPayload: DriversPayload | null | undefined
}

const FULL: ResultCompleteness = {
  status: 'full',
  missing: [],
  reasons: [],
}

/**
 * Pure derivation. Consults the SOURCE fields, not the UI-SEM
 * fabrications, so the verdict reflects what PLoT/ISL actually
 * delivered.
 */
export function deriveResultCompleteness(
  inputs: ResultCompletenessInputs,
): ResultCompleteness {
  // Status `error` short-circuits to failed ONLY when there is nothing on
  // screen — post-SF2 the body renders the RETAINED previous report at
  // 'error', and that report's completeness must describe ITSELF, not the
  // new run's failure (Lane 3 review fold: the legacy confidence panel was
  // rendering "Analysis returned partial results" over a fully-complete
  // retained analysis). idle/running mean we have nothing to evaluate yet,
  // so report `full` with no missing keys.
  if (inputs.resultsStatus === 'error' && !inputs.report) {
    return {
      status: 'failed',
      missing: [],
      reasons: ['analysis_partial'],
    }
  }
  if (
    (inputs.resultsStatus !== 'complete' && inputs.resultsStatus !== 'error') ||
    !inputs.report
  ) {
    return FULL
  }

  const missing = new Set<MissingFieldKey>()
  const reasons = new Set<CompletenessReasonCode>()

  // Field 2 — win probabilities: at least one option must carry
  // `win_probability` for likelihood-based ranking. The brief flagged
  // "Analysis complete" with null win probabilities as the headline
  // bug; this surfaces it.
  //
  // ⭐ A FAILED OPTION'S `win_probability` IS NOT ONE OF THEM.
  //
  // ISL emits `status: 'failed'` exactly when `n_valid === 0` — zero finite
  // Monte Carlo samples, so no distribution and no share — and PLoT forwards a
  // `win_probability: 0` beside it. Zero is a number, so the bare `typeof`
  // test counted that fabrication as a present measurement and SUPPRESSED this
  // disclosure on a run where the only "win probability" was invented. The one
  // surface whose job is to say the field is missing was silenced by the very
  // absence it exists to report.
  //
  // Gated on the PRODUCER'S EMITTED TOKEN, never on falsiness. A `win > 0`
  // test would be a second, worse classification: it would admit a failed
  // option carrying any non-zero fabricated value, and would wrongly drop a
  // GENUINE measured zero — an option ISL computed at full sample count and
  // found never wins. Those two are indistinguishable by value and
  // distinguishable only by `status`.
  //
  // `optionComputationProducedResult` is QUOTED, not respelled: `'partial'`
  // stays in (samples exist — a disclosure, not a failure) and an ABSENT
  // status stays in (the legacy V1 shape, which has no status field at all).
  // A `status !== 'computed'` test here would discard results ISL honestly
  // produced.
  const optionProbs = inputs.report.option_probabilities ?? {}
  const optionIds = Object.keys(optionProbs)
  if (optionIds.length > 0) {
    const anyWin = optionIds.some((id) => {
      const entry = optionProbs[id] as
        | ((typeof optionProbs)[string] & { status?: OptionComputeStatus })
        | undefined
      if (!optionComputationProducedResult(entry?.status)) return false
      return typeof entry?.win_probability === 'number'
    })
    if (!anyWin) {
      missing.add('win_probability')
      reasons.add('win_probability_missing')
    }
  }

  // Field 3 — expected outcome: one or more options without any
  // numeric outcome reading is partial coverage. We check the same
  // sources as `useResultsSectionData`'s fallback chain so a value
  // present anywhere counts.
  //
  // ⛔ DELIBERATELY NOT GATED ON `status`, AND MAKING IT SYMMETRIC WITH FIELD 2
  // WOULD MAKE THE PRODUCT QUIETER ABOUT A REAL FAILURE. A review asked why
  // the sibling ten lines up now consults `status` and this does not. The two
  // `.some()` calls point in OPPOSITE directions, so the same gate has
  // opposite effects:
  //
  //   · Field 2 asks "did ANY option produce a win?" — so a failed option
  //     contributing a fabricated value could MANUFACTURE presence and silence
  //     a disclosure. That is under-disclosure, and it is the defect fixed.
  //   · Field 3 asks "is ANY option missing an outcome?" — a failed option has
  //     none, so it TRIGGERS a disclosure. That is over-disclosure.
  //
  // Worked through: four computed options and one failed. Field 2 sees the
  // four, `anyWin` is true, and it says nothing. Field 3 sees the failed one
  // and marks `expected_outcome`. So WITHIN THIS HOOK field 3 is the only
  // predicate that discloses a partially-failed run, and gating it on `status`
  // would make the completeness signal silent on that run.
  //
  // ⚠ SCOPED TO THIS HOOK ON PURPOSE — an earlier version of this comment said
  // field 3 was "the ONLY thing that discloses a partially-failed run at all",
  // and that is FALSE. `OptionCards.tsx:1367` renders `NotComputedOptionCard`
  // off the same `status`, and `buildAnalysisNewViewModel.ts` reads it too. The
  // user is not left with nothing; the COMPLETENESS BANNER is what goes quiet.
  // The design decision is unchanged — the superlative was, and a superlative
  // in a sentence about coverage is exactly the part nobody measures.
  //
  // ⚠ WHAT IS MISSING FROM THIS HOOK is a disclosure that names the real event.
  // Through this path a failed option reaches the user as "the expected
  // outcome" being absent — true of the symptom, wrong about the cause. Other
  // surfaces do name it; this one cannot, because `missing` is keyed by FIELD
  // and the event is about an OPTION. A new key and a new string, i.e. its own
  // change — rowed, not smuggled in here.
  if (optionIds.length > 0) {
    const anyOutcomeMissing = optionIds.some((id) => {
      const prob = optionProbs[id] as
        | (typeof optionProbs)[string] & {
            outcome?: { p10?: number; p50?: number; p90?: number; mean?: number }
            bands?: { p10?: number; p50?: number; p90?: number }
            expected_outcome?: number
            expected?: number
          }
        | undefined
      if (!prob) return true
      const expected =
        prob.expected_outcome ??
        prob.expected ??
        prob.outcome?.mean ??
        prob.bands?.p50 ??
        null
      const p50 = prob.outcome?.p50 ?? prob.bands?.p50 ?? expected
      return expected == null && p50 == null
    })
    if (anyOutcomeMissing) {
      missing.add('expected_outcome')
      reasons.add('expected_outcome_missing')
    }
  }

  // Field 4 — drivers / sensitivity. TWO QUESTIONS, DELIBERATELY NAMED APART.
  //
  //   `top_drivers` — did a ranked driver list arrive to render?
  //   `sensitivity` — did this run carry sensitivity MAGNITUDES at all?
  //
  // ⚠ THEY WERE FUSED, AND THE FUSION SHIPPED A FALSE ABSENCE (trap 21).
  // This check used to ask whether any DRIVER carried `sensitivity_score`,
  // `elasticity` or `importance_score`. `mapV5AnalysisToReport:910` builds
  // `drivers` FROM `factor_sensitivity` and renames the magnitude to
  // `contribution` on the way past; `ReportV1['drivers']` does not declare any
  // of the three names (`adapters/plot/types.ts:65-75`). So the predicate was
  // unsatisfiable on the V5 path by construction, and the completeness banner
  // read "Not included in this result: the sensitivity check" one line above a
  // populated sensitivity section. Measured on Paul's run `1dd2133d`: six
  // `factor_sensitivity` rows each carrying `sensitivity_score` AND
  // `elasticity`, and no `drivers`/`drivers_payload` anywhere on the wire.
  //
  // The repair asks the question of the authority that answers it rather than
  // lengthening a list of field names — the name list IS the hand-maintained
  // mirror that produced this (trap 12). `normaliseFactorEntry` is the mapper's
  // single owner of "is there a usable magnitude here": it DROPS every entry
  // without one and writes the survivors to `report.factor_sensitivity`. So a
  // non-empty `factor_sensitivity` is the producer's own statement that
  // sensitivity was computed, and no alias set has to be kept in step with it.
  //
  // The driver-side check stays for the paths that have no `factor_sensitivity`
  // (`drivers_payload.drivers[].sensitivity_score`, PLoT v1), and gains
  // `contribution` — named as a magnitude by the estate's existing fallback
  // chain, `test/fixtures/golden-expectations.ts:230`.
  const driversFromReport = readDrivers(inputs.report)
  const driversFromPayload = inputs.driversPayload?.drivers ?? []
  const allDrivers = [...driversFromReport, ...driversFromPayload]
  if (allDrivers.length === 0) {
    // Drivers are an optional enrichment — absence is "no top drivers
    // computed", not "partial". We only flag when the array is empty
    // AND the result claims completion, so the caller can show a
    // curated "no drivers available" line rather than an empty
    // section. ResultV1.drivers is required, so an empty array is the
    // signal.
    missing.add('top_drivers')
  } else {
    /**
     * ⛔ TWO ARMS, TWO QUESTIONS — AND BOTH WRONG ANSWERS WERE SHIPPED HERE.
     *
     * FIRST MISTAKE, a second spelling. The correction above added the
     * producer-row check as `Number.isFinite` and left the driver check as
     * `typeof === 'number'`, and `claim-ownership.drift.spec.ts` went red:
     * "MORE reads of one field than the baseline allows ... elasticity:
     * baseline 1 -> current 2". Two spellings of one question in one file is
     * the mirror this change set exists to remove (trap 12), and I committed
     * it inside the fix for it.
     *
     * SECOND MISTAKE, the opposite one, and it is why there are two functions
     * rather than the single `rowCarriesSensitivityMagnitude` this comment used
     * to name. Collapsing both arms into ONE predicate silenced the ratchet by
     * MOVING THE BOUNDARY: that predicate accepted `contribution`, so a RAW
     * `factor_sensitivity` row carrying only `contribution` satisfied
     * availability. `contribution` is written solely by the DRIVER projections
     * (`mapV5AnalysisToReport:910` renames the magnitude to it,
     * `responseMapper:1098` normalises it), so such a row is one
     * `normaliseFactorEntry` itself would DROP — and admitting it suppresses a
     * true `sensitivity_missing`, the false absence this file was changed to
     * remove, sign flipped (trap 22b).
     *
     * ⭐ SO THE TWO QUESTIONS ARE NAMED APART (trap 21) RATHER THAN RECONCILED:
     *   `producerRowCarriesMagnitude`  asks "does this RAW row carry a
     *     magnitude the mapper would keep?" — the four aliases
     *     `normaliseFactorEntry` accepts, and nothing else.
     *   `projectedRowCarriesMagnitude` asks "does this DRIVER row carry one?" —
     *     the same four, plus the name the projection gives it.
     *
     * ⭐ DELEGATION IS WHAT KEEPS THE RATCHET GREEN, AND IT IS NOT A STYLE
     * CHOICE. The projected check CALLS the producer check instead of
     * restating the four names, so each alias is still read EXACTLY ONCE in
     * this file and the drift spec sees the baseline's per-field counts.
     * Restating them reds it again; widening the producer predicate to admit
     * `contribution` keeps it green and reopens the false absence. Only
     * delegation satisfies both — THE FIX FOR A MIRROR IS DELEGATION, NOT A
     * WIDER PREDICATE.
     *
     * ⚠ `Number.isFinite` is the surviving spelling in both arms: it rejects
     * `NaN`, `Infinity` and a numeric string, and it ADMITS a measured zero,
     * which is a producer statement rather than an absence.
     */
    const anySensitivity =
      // Producer rows: the four aliases the mapper accepts, and nothing else.
      readFactorSensitivity(inputs.report).some(producerRowCarriesMagnitude) ||
      // Driver rows: the same four, plus the name the projection gives it.
      allDrivers.some(projectedRowCarriesMagnitude)
    if (!anySensitivity) {
      missing.add('sensitivity')
      reasons.add('sensitivity_missing')
    }
  }

  // Field 5 — robustness / stability. UI-SEM-005 derives level from
  // stability when level is absent; UI-SEM-016 derives label from a
  // numeric score. The completeness check looks at the SOURCE fields:
  // when both `robustness.level` and `robustness.recommendation_stability`
  // are absent, the rendered robustness state is fabricated.
  const robustness = (inputs.report as { robustness?: { level?: unknown; recommendation_stability?: unknown } }).robustness
  if (robustness) {
    const hasLevel = typeof robustness.level === 'string'
    const hasStability = typeof robustness.recommendation_stability === 'number'
    if (!hasLevel && !hasStability) {
      missing.add('robustness_level')
      missing.add('recommendation_stability')
      reasons.add('robustness_unavailable')
    }
  }

  // Field 6 — decision review. Optional enrichment that may legitimately be
  // absent; flagged so consumers render the curated fallback block instead of
  // a silent omission.
  //
  // ⚠ ROADMAP 2.154 — THIS SIGNAL USED TO FIRE ON EVERY SINGLE TURN. It
  // tested ONE optional sub-field of ONE shape: `ceeReviewV1.m1_coaching
  // .executive_summary`. On the live V5 path `m1_coaching` does not exist at
  // all — CEE sends the 0.30 `decision_review` payload, which has no
  // `m1_coaching` key — so `hasCoaching` was false on every analysis, and the
  // user was told "Decision coaching is still being prepared for this
  // analysis" (freshnessReasons.ts) while a real ~8-9s gpt-4.1 review sat in
  // the same response. A signal that is always true carries no information,
  // and its name promised something much broader than what it measured.
  //
  // The signal now means what it says: no decision review reached the UI in
  // ANY recognised shape. Either witness clears it — the 0.30 view-model
  // `applyV5State` writes to `runMeta.decisionReview030` (with renderable
  // prose), or the M1 coaching block on `ceeReviewV1` (still live via
  // `synthesizeCeeReviewFromV2`).
  const coaching = inputs.ceeReviewV1?.m1_coaching as
    | { executive_summary?: { headline?: unknown; paragraph?: unknown } }
    | undefined
  const hasCoaching =
    typeof coaching?.executive_summary?.headline === 'string' ||
    typeof coaching?.executive_summary?.paragraph === 'string'
  // `hasProse` and not mere presence: a 0.30 review can validly carry no
  // prose, and a review with nothing to show is, for this signal, unavailable.
  const hasReview030Prose = inputs.decisionReview030?.hasProse === true
  if (!hasCoaching && !hasReview030Prose) {
    missing.add('decision_review')
    reasons.add('decision_review_unavailable')
  }

  if (missing.size === 0) return FULL
  return {
    status: 'partial',
    missing: Array.from(missing),
    reasons: Array.from(reasons),
  }
}

/**
 * Pull whatever the report carries on its `drivers` field, accepting
 * both the legacy shape (used by ReportV1.drivers) and any object that
 * looks driver-like. The source-to-render trace confirmed multiple
 * shapes can land here; the completeness check just needs to know
 * whether sensitivity-bearing values are present anywhere.
 */
function readDrivers(report: ReportV1): ReadonlyArray<unknown> {
  const direct = (report as { drivers?: unknown }).drivers
  if (Array.isArray(direct)) return direct as ReadonlyArray<unknown>
  return []
}

/**
 * The producer's normalised sensitivity rows, as the mapper wrote them.
 *
 * `factor_sensitivity` is NOT declared on `ReportV1` — it is one of the
 * auxiliary fields `mapV5AnalysisToReport` writes onto the same record through
 * a widening cast (`mapV5AnalysisToReport.ts:1558-1560`), and which the Results
 * panel and inspector read through their own widened index signatures. The read
 * is cast for the same reason every other consumer of it is
 * (`OptionNode.tsx:87`, `assembleAnalysisInputsSummary.ts:65`).
 *
 * ⚠ THE LENGTH IS THE CLAIM, not any field on a row. `normaliseFactorEntry`
 * returns null for an entry with no usable magnitude, so every row present has
 * one — which is why this function reads no field names and cannot drift from
 * the alias set the mapper accepts.
 */
function readFactorSensitivity(
  report: ReportV1 | null | undefined,
): ReadonlyArray<unknown> {
  const rows = (report as { factor_sensitivity?: unknown } | null | undefined)
    ?.factor_sensitivity
  if (Array.isArray(rows)) return rows as ReadonlyArray<unknown>
  return []
}

/**
 * ⛔⛔ A ROW IS NOT A MAGNITUDE — CORRECTED AFTER INDEPENDENT REVIEW (CX182).
 *
 * The first cut asked only whether `factor_sensitivity` was NON-EMPTY, and
 * justified it from `mapV5AnalysisToReport.normaliseFactorEntry`, which drops
 * any entry with no usable magnitude. That invariant is real AND IT IS THE V5
 * MAPPER'S ALONE. `factor_sensitivity` also arrives from the V2 path and, on
 * the hydrate path, from an untyped passthrough — neither of which is bound by
 * it. So an identity-only or null-magnitude row would have satisfied the check
 * and SUPPRESSED a true "the sensitivity check was not included" disclosure:
 * the same false-absence defect this fix was written to remove, with the sign
 * flipped (trap 22b).
 *
 * I generalised one mapper's guarantee to a field that has three writers. The
 * review executed the contrast; I had not.
 *
 * ⚠ A GENUINE ZERO IS RETAINED. `Number.isFinite(0)` is true and a measured
 * zero sensitivity is a real producer statement — excluding it would trade this
 * defect for the opposite one. The alias set is the one
 * `normaliseFactorEntry` itself accepts, so this predicate cannot admit a row
 * that mapper would drop.
 */
function producerRowCarriesMagnitude(row: unknown): boolean {
  if (row === null || typeof row !== 'object') return false
  const r = row as {
    sensitivity_score?: unknown
    sensitivity?: unknown
    elasticity?: unknown
    importance_score?: unknown
  }
  return (
    Number.isFinite(r.sensitivity_score) ||
    Number.isFinite(r.sensitivity) ||
    Number.isFinite(r.elasticity) ||
    Number.isFinite(r.importance_score)
  )
}

/**
 * ⛔⛔ `contribution` IS THE PROJECTION'S NAME, NEVER THE PRODUCER'S — and a
 * previous cut of this file let it satisfy availability on a RAW row.
 *
 * Collapsing the producer check and the driver check into ONE predicate was
 * right about the mirror (two spellings of one alias set in one file) and wrong
 * about the BOUNDARY. `normaliseFactorEntry` accepts exactly four aliases
 * (`sensitivity_score`, `sensitivity`, `elasticity`, `importance_score`);
 * `contribution` is written only by the DRIVER projections
 * (`mapV5AnalysisToReport:910` renames the magnitude to it,
 * `responseMapper:1098` normalises it). So a raw `factor_sensitivity` row
 * carrying only `contribution` is a row the mapper itself would drop, and
 * admitting it hides a true `sensitivity_missing` — the same false-absence
 * defect this file was changed to remove, sign flipped (trap 22b).
 *
 * ⚠ TWO BOUNDARIES, ONE ALIAS SET, AND THE NAMES ARE STILL READ ONCE EACH.
 * The projected check DELEGATES to the producer one rather than restating the
 * four names, so `claim-ownership.drift.spec.ts` still sees exactly one literal
 * read per field — which is what went red when the two checks were spelled out
 * separately. The fix for a mirror is delegation, not a wider predicate.
 */
function projectedRowCarriesMagnitude(row: unknown): boolean {
  if (producerRowCarriesMagnitude(row)) return true
  if (row === null || typeof row !== 'object') return false
  return Number.isFinite((row as { contribution?: unknown }).contribution)
}
