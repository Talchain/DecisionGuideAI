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
  const optionProbs = inputs.report.option_probabilities ?? {}
  const optionIds = Object.keys(optionProbs)
  if (optionIds.length > 0) {
    const anyWin = optionIds.some(
      (id) => typeof optionProbs[id]?.win_probability === 'number',
    )
    if (!anyWin) {
      missing.add('win_probability')
      reasons.add('win_probability_missing')
    }
  }

  // Field 3 — expected outcome: one or more options without any
  // numeric outcome reading is partial coverage. We check the same
  // sources as `useResultsSectionData`'s fallback chain so a value
  // present anywhere counts.
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

  // Field 4 — drivers / sensitivity. The trace identified
  // `useResultsSectionData.getRawElasticity` falling through to null
  // when sensitivity_score, elasticity, AND importance_score are all
  // absent. We check the same source: report.drivers AND
  // driversPayload.drivers; presence of any sensitivity-bearing
  // value across all factors means full coverage.
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
    const anySensitivity = allDrivers.some((d) => {
      const s = d as {
        sensitivity_score?: unknown
        elasticity?: unknown
        importance_score?: unknown
      }
      return (
        typeof s.sensitivity_score === 'number' ||
        typeof s.elasticity === 'number' ||
        typeof s.importance_score === 'number'
      )
    })
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
