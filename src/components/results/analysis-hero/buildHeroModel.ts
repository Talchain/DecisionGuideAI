/**
 * buildHeroModel — PURE mapper from the adapted Results Panel object
 * (`ResultsSectionDataReturn`) to the hero's display model.
 *
 * Read-only discipline (the crux of this module):
 *   - SELECTION of existing values is allowed (which option to highlight,
 *     which existing figure to show). CREATION of values is not: no new
 *     probabilities, deltas, confidence bands, qualitative bands, defaults
 *     or clamps. Formatting reuses the existing Results Panel formatters
 *     (formatThreshold, formatPercent, formatProbabilityWithResolution) so
 *     hero numbers reconcile with the panels below.
 *   - The outcome-axis domain is LAYOUT ONLY: it positions bars/dots and is
 *     never displayed as data, never described semantically, and never fed
 *     back into selection logic.
 *
 * Leader rules (review-locked):
 *   - Headline leader = `recommendation.recommendedOption` (the Results
 *     Panel's own leader) — never an independent argmax of goalProbability,
 *     so the hero cannot disagree with the panels below. The goal-fit lens
 *     highlight follows the same leader.
 *   - Outcome leader = highest existing outcome centre (expected ?? mean ??
 *     p50), a genuinely distinct question. Ties break deterministically to
 *     the earliest option in `allOptions[]` presentation order.
 *
 * Goal-fit honesty: the adapted selector collapses joint/unconstrained into
 * one `goalProbability` (= probability_of_joint_goal when constraints exist,
 * else goal_probability — see useResultsSectionData). The hero therefore
 * shows ONE bar labelled by constraint presence and renders NO separate
 * goal-alone marker (selector gap, reported in the PR).
 *
 * Target/domain guard (top silent-bug risk): `goalThreshold` is in user
 * units while outcome values are user-unit only when `isNormalised ===
 * false`. The target marker renders — and the threshold joins the layout
 * domain — ONLY under that exact condition; any uncertainty (undefined)
 * omits both so an incompatible threshold can never distort the chart.
 */

import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { FlipThreshold, OptionResult } from '../types'
import { formatThreshold } from '../RangeVisualization'
import { stripEncodingNotation } from '../utils/cleanFactorLabel'
import { sortOptionsForDisplay } from '../utils/optionDisplayOrder'
import {
  getExpectedValue,
  getMedian,
  getOptimistic,
  getPessimistic,
} from '../utils/getExpectedValue'
import { safeInterpolatedLabel, containsBannedTerm } from '../analysisHeroV17/glossaryCheck'
import { formatPercent, formatProbabilityWithResolution } from '@/utils/formatPercent'
import { classifyUnit } from '@/utils/unitClassifier'
import { HERO_COPY } from './heroCopy'
import type { HeroChartModel, HeroLens, HeroModel, HeroRowVM, HeroStatusModel } from './heroTypes'

// ─── Small helpers (selection + display formatting only) ────────────────────

function statusModel(variant: HeroStatusModel['variant']): HeroStatusModel {
  const copy = HERO_COPY.status[variant]
  return { kind: 'status', variant, headline: copy.headline, body: copy.body }
}

/**
 * Existing-value fallback chains, composed from the canonical percentile
 * helpers plus the deprecated top-level fields for backward compatibility
 * (the same fallback ResultsBody itself uses). The centre deliberately
 * blends mean → median (unlike getExpectedValue alone, which refuses the
 * median): the hero shows ONE centre per option and prefers whichever
 * existing value the Results Panel would surface first.
 */
function outcomeCentre(o: OptionResult): number | null {
  return getExpectedValue(o) ?? getMedian(o) ?? o.p50 ?? null
}
function outcomeP10(o: OptionResult): number | null {
  return getPessimistic(o) ?? o.p10 ?? null
}
function outcomeP90(o: OptionResult): number | null {
  return getOptimistic(o) ?? o.p90 ?? null
}

/**
 * "Could change if" line for one option — producer flip-threshold data only.
 * The recommended option reads the first resolvable threshold (the value at
 * which the recommendation changes); any other option only gets a line when
 * a threshold explicitly names it as the alternative winner. No thresholds,
 * no line. `usable` is pre-filtered once by the caller (flip_value != null).
 */
function couldChangeIfLine(
  option: OptionResult,
  isRecommended: boolean,
  usable: readonly FlipThreshold[],
): string | undefined {
  // Normalise both sides for the MATCH only (display still uses the raw
  // producer strings) — encoding notation on either label must not silently
  // drop a sourced line.
  const optionLabel = stripEncodingNotation(option.label)
  const ft = isRecommended
    ? usable[0]
    : usable.find(
        (f) =>
          f.alternative_winner_label != null &&
          stripEncodingNotation(f.alternative_winner_label) === optionLabel,
      )
  if (!ft || ft.flip_value == null) return undefined
  const factor = safeInterpolatedLabel(stripEncodingNotation(ft.label), HERO_COPY.factorFallback)
  return HERO_COPY.detail.couldChangeIf(factor, formatFlipValue(ft.flip_value, ft.unit))
}

/**
 * UI-SEM-057: sub-1% goal readout floor. Mirrors OptionCards' existing
 * display-honesty affordance (`goalProbability < 0.01` → "< 1% likely to
 * reach target", OptionCards.tsx) so a 0.4% probability never rounds to a
 * bare "0%" here while the panel below says "< 1%". Display-only; the
 * value itself is unchanged and the bar still draws from the raw value.
 * The same floor — no new threshold — also gates the no-option-on-track
 * headline: when EVERY goal readout would render "< 1%", claiming any
 * option "best fits your goal" would be false.
 */
const SUB_ONE_PERCENT_FLOOR = 0.01

function goalReadout(value: number | null): string {
  if (value == null) return HERO_COPY.readout.missing
  if (value < SUB_ONE_PERCENT_FLOOR) return HERO_COPY.readout.subOnePercent
  return formatPercent(value, { fromDecimal: true })
}

/**
 * Format a flip-threshold factor value with its OWN unit string (factor
 * space, not outcome space). Unit placement follows the app-wide
 * classifyUnit convention (symbol prefix, ISO space-prefix, % suffix,
 * generic space-suffix) — but unlike formatValueWithUnit, the value ALWAYS
 * renders as a number: a "crosses <value>" sentence must never substitute
 * a qualitative word for the producer's numeric threshold. Display
 * formatting only; the value itself is unchanged.
 */
function formatFlipValue(value: number, unit?: string): string {
  const rendered = value.toLocaleString('en-GB', { maximumFractionDigits: 1 })
  const { kind, canonical } = classifyUnit(unit ?? null)
  if (kind === 'symbol') return `${canonical}${rendered}`
  if (kind === 'iso') return `${canonical} ${rendered}`
  if (kind === 'percent') return `${rendered}%`
  if (kind === 'none' || kind === 'placeholder') return rendered
  return `${rendered} ${canonical}`
}

// ─── Main mapper ─────────────────────────────────────────────────────────────

export function buildHeroModel(data: ResultsSectionDataReturn): HeroModel {
  // Fail closed on a partially-shaped object (e.g. hydrated older state):
  // the type guarantees these fields, but the hero must render nothing —
  // never throw — when a caller supplies less than the type promises.
  if (!data?.recommendation?.allOptions) return { kind: 'empty' }
  const { recommendation, drivers, isLoading, isError } = data

  // Non-chart states fire ONLY on the real analysis lifecycle — loading, a
  // hook error, or a PLoT-reported blocked/failed/partial run (via
  // `recommendation.analysisStatus`). They deliberately do NOT key off
  // `completeness.status`: that verdict turns 'partial' when OPTIONAL
  // enrichment is absent (e.g. the CEE decision review is skipped when
  // coaching autofire is off, as on staging — `decision_review_unavailable`),
  // which has nothing to do with whether the hero can draw its chart. The
  // hero consumes none of that enrichment; its own per-field gating (lens
  // availability, "—" readouts, omitted detail lines, empty-when-nothing-
  // displayable) already degrades honestly. Gating the whole chart on
  // completeness would show "some steps did not complete" over a perfectly
  // computed run — the exact false-partial this avoids. Curated copy only —
  // statusReason may carry internal identifiers, so it is not interpolated.
  if (isLoading) return { kind: 'empty' }
  if (recommendation.analysisStatus === 'blocked') return statusModel('blocked')
  if (isError || recommendation.analysisStatus === 'failed') return statusModel('failed')
  if (recommendation.analysisStatus === 'partial') return statusModel('partial')

  // Present rows in the SHARED option display order (win probability when
  // complete, else expected — sortOptionsForDisplay) so hero numbering always
  // matches the OptionCards/WinGauge ranking below. Presentation numbering,
  // not graph-node truth; stable across lens switches (asserted in tests).
  const options = sortOptionsForDisplay(recommendation.allOptions)
  // No analysis yet (the hook's pre-run default) — the tab stays unchanged.
  if (options.length === 0) return { kind: 'empty' }

  const { outcomeUnit, outcomeUnitSymbol, isNormalised, goalThreshold } = recommendation

  // UI-SEM-056: constraint-presence copy switch (goal-and-limits vs
  // goal-alone wording; same class as UI-SEM-050). Copy only — never a
  // value transform. Because the selector collapses goalProbability PER
  // OPTION (joint only for options that carry their own constraint
  // analysis), the shared axis/caption claims "and limits" only when EVERY
  // goal-bearing option is constrained; a mixed set (anomalous — constraints
  // are request-level) falls back to the goal-alone wording, which may
  // understate a constrained bar but never overstates an unconstrained one.
  const optionHasConstraints = (o: OptionResult) =>
    (o.constraintAnalysis?.constraints?.length ?? 0) > 0
  const goalBearing = options.filter((o) => o.goalProbability != null)
  const hasConstraints =
    goalBearing.length > 0 && goalBearing.every(optionHasConstraints)

  const recommendedId = recommendation.recommendedOption?.id ?? null
  // Pre-filter once: resolvable thresholds only (shared across every row).
  const usableFlips = (recommendation.flipThresholds ?? []).filter(
    (ft) => ft.flip_value != null,
  )

  // Rows in the shared display order — the same order for every lens, so
  // numbering is stable across lens switches (asserted in tests).
  const rows: HeroRowVM[] = options.map((o, i) => {
    const goalValue = o.goalProbability ?? null
    const centre = outcomeCentre(o)
    const why = recommendation.storyHeadlines?.[o.id]
    const couldChangeIf = couldChangeIfLine(o, o.id === recommendedId, usableFlips)
    const winChance =
      typeof o.winProbability === 'number'
        ? HERO_COPY.detail.winChance(
            formatProbabilityWithResolution(o.winProbability, o.nValidSamples),
          )
        : undefined
    return {
      id: o.id,
      index: i + 1,
      label: stripEncodingNotation(o.label),
      goal: {
        value: goalValue,
        readout: goalReadout(goalValue),
      },
      outcome: {
        p10: outcomeP10(o),
        p90: outcomeP90(o),
        centre,
        readout:
          centre != null
            ? formatThreshold(centre, outcomeUnit, outcomeUnitSymbol, isNormalised)
            : HERO_COPY.readout.missing,
      },
      detail: { why, couldChangeIf, winChance },
    }
  })

  // Lens availability — hidden entirely when the sourcing fields are absent.
  const goalAvailable = rows.some((r) => r.goal.value != null)
  const outcomeAvailable = rows.some(
    (r) => r.outcome.p10 != null && r.outcome.p90 != null,
  )
  const lenses: HeroLens[] = []
  if (goalAvailable) lenses.push('goal')
  if (outcomeAvailable) lenses.push('outcome')
  // Options exist but nothing displayable — the hero has nothing honest to say.
  if (lenses.length === 0) return { kind: 'empty' }

  // Outcome leader: highest existing centre; strict `>` keeps the earliest
  // option on ties (deterministic allOptions[] order tie-break).
  let outcomeLeaderId: string | null = null
  let outcomeLeaderCentre = -Infinity
  for (const r of rows) {
    if (r.outcome.centre != null && r.outcome.centre > outcomeLeaderCentre) {
      outcomeLeaderCentre = r.outcome.centre
      outcomeLeaderId = r.id
    }
  }

  // Headline leader: the Results Panel's recommended option. `find` also
  // guards the recovered-session identity mismatch — if the recommended id
  // is not among the analysed rows, no leader is claimed.
  const headlineRow = rows.find((r) => r.id === recommendedId) ?? null
  const outcomeLeaderRow = rows.find((r) => r.id === outcomeLeaderId) ?? null

  // Goal honesty (UI-SEM-057 reuse — the same sub-1% floor that drives the
  // "< 1%" readouts, no new threshold): when EVERY row carries a goal
  // probability below the floor, no option is meaningfully on track, so the
  // hero declines to crown a goal-fit leader at all — headline and goal-lens
  // highlight both switch to the no-option-on-track state. Mixed coverage
  // (any row without a goal value) falls through to the normal branches.
  const allGoalBelowFloor =
    rows.length > 0 &&
    rows.every((r) => r.goal.value != null && r.goal.value < SUB_ONE_PERCENT_FLOOR)

  // A goal-fit claim ("best fits your goal") is only honest when the claimed
  // option ITSELF carries a goal probability AT OR ABOVE the same sub-1%
  // floor — a recommended option whose goal readout would be "—" or "< 1%"
  // must not be headlined or highlighted as the goal-fit leader while other
  // rows show real figures. Below-floor leaders fall through to the
  // analysis-leader wording instead.
  const goalLeaderRow =
    !allGoalBelowFloor &&
    headlineRow &&
    headlineRow.goal.value != null &&
    headlineRow.goal.value >= SUB_ONE_PERCENT_FLOOR
      ? headlineRow
      : null

  const safeLabel = (row: HeroRowVM) =>
    safeInterpolatedLabel(row.label, HERO_COPY.labelFallback)

  let headline: string
  if (rows.length === 1) {
    headline = HERO_COPY.headline.singleOption(safeLabel(rows[0]))
  } else if (allGoalBelowFloor) {
    headline = HERO_COPY.headline.noneOnTrack
  } else if (goalLeaderRow) {
    headline = hasConstraints
      ? HERO_COPY.headline.goalWithLimits(safeLabel(goalLeaderRow))
      : HERO_COPY.headline.goalOnly(safeLabel(goalLeaderRow))
  } else if (headlineRow) {
    // No goal basis: the leader claim names the canonical analysis leader
    // (recommendedOption — proven to equal the Results Panel/producer
    // leader) with analysis-grounded wording, never an outcome-lens claim.
    headline = HERO_COPY.headline.analysisLeads(safeLabel(headlineRow))
  } else if (outcomeLeaderRow) {
    // No recommended option among the rows: headline the outcome fact
    // itself (the subline below is then redundant and stays null).
    headline = HERO_COPY.headline.outcomeLeader(safeLabel(outcomeLeaderRow))
  } else {
    headline = HERO_COPY.headline.noLeader
  }

  // Tension subline: the headlined leader vs the strongest expected outcome.
  // PERSISTENT across goal and no-goal headline branches (review-locked):
  // whenever a leader is claimed and the outcome leader differs, the
  // divergence is stated — but only when the outcome lens is actually
  // visible (centres without ranges leave it hidden, so the hero must not
  // assert an expected-outcome comparison it cannot show).
  let subline: string | null = null
  if (rows.length > 1 && outcomeAvailable && outcomeLeaderRow) {
    if (allGoalBelowFloor) {
      // No leader was claimed; the outcome fact is the one honest pointer.
      subline = HERO_COPY.subline.highestOutcome(safeLabel(outcomeLeaderRow))
    } else if (headlineRow) {
      subline =
        headlineRow.id === outcomeLeaderRow.id
          ? HERO_COPY.subline.aligned(safeLabel(headlineRow))
          : HERO_COPY.subline.highestOutcome(safeLabel(outcomeLeaderRow))
    }
  }

  // Target/domain guard — the threshold joins the chart ONLY when it
  // provably shares the displayed outcome metric/unit:
  //  1. `isNormalised === false`: outcome values were denormalised into the
  //     goal node's user units (useResultsSectionData scales by
  //     goal_threshold_cap), and `goalThreshold` is goal_threshold_raw from
  //     the SAME goal node — same metric by construction. `true` means
  //     outcomes are relative scores (threshold incompatible); `undefined`
  //     (older data, pre-run defaults) counts as uncertainty → omit.
  //  2. `outcomeUnit != null`: the Results Panel's shared unit convention
  //     (outcomeUnit/outcomeUnitSymbol — the same fields SuccessTargetRow
  //     and RangeVisualization format BOTH the threshold and outcome values
  //     with) actually exists. An unknown unit removes the evidence that
  //     threshold and outcomes share a metric → uncertainty → omit.
  // An incompatible/uncertain threshold is excluded from BOTH the marker
  // and the axis-domain calculation below, so it can never distort the chart.
  const targetCompatible =
    isNormalised === false &&
    outcomeUnit != null &&
    typeof goalThreshold === 'number' &&
    Number.isFinite(goalThreshold)
  const targetValue = targetCompatible ? goalThreshold : null

  // UI-SEM-054: outcome-axis layout domain derivation. Min/max over the
  // existing p10/p90/centre values (plus the goal threshold ONLY when
  // unit-compatible, i.e. isNormalised === false), padded 5% each side
  // (matching RangeVisualization) with a unit pad on a degenerate span.
  // Layout only — the domain positions bars and is never displayed as data.
  let outcomeDomain: { min: number; max: number } | null = null
  if (outcomeAvailable) {
    const values: number[] = []
    for (const r of rows) {
      if (r.outcome.p10 != null) values.push(r.outcome.p10)
      if (r.outcome.p90 != null) values.push(r.outcome.p90)
      if (r.outcome.centre != null) values.push(r.outcome.centre)
    }
    if (targetValue != null) values.push(targetValue)
    let min = Math.min(...values)
    let max = Math.max(...values)
    const span = max - min
    // 5% padding, matching RangeVisualization; degenerate spans get a unit
    // pad so positioning maths stays finite. Layout only.
    const pad = span > 0 ? span * 0.05 : Math.abs(min) * 0.05 || 1
    min -= pad
    max += pad
    outcomeDomain = { min, max }
  }

  // Footer "Main reason": the Drivers section's own top driver label —
  // selection of the existing #1, no re-ranking. Omitted (not replaced with
  // a fallback) when the label would trip the glossary in generated copy.
  const topDriverLabel = drivers?.topDrivers?.[0]?.factorLabel
  const cleanDriverLabel = topDriverLabel ? stripEncodingNotation(topDriverLabel) : null
  const mainReason =
    cleanDriverLabel && !containsBannedTerm(cleanDriverLabel)
      ? HERO_COPY.footer.mainReason(cleanDriverLabel)
      : null

  const model: HeroChartModel = {
    kind: 'chart',
    headline,
    subline,
    lenses,
    defaultLens: goalAvailable ? 'goal' : 'outcome',
    hasConstraints,
    rows,
    leaders: {
      // Goal-fit highlight follows the headline (Results Panel) leader —
      // never an independent argmax — and only when that option carries its
      // own goal probability. Null when no leader is claimable.
      goal: goalLeaderRow?.id ?? null,
      outcome: outcomeLeaderId,
    },
    outcomeDomain,
    targetValue,
    targetReadout:
      targetValue != null
        ? formatThreshold(targetValue, outcomeUnit, outcomeUnitSymbol, false)
        : null,
    mainReason,
  }
  return model
}
