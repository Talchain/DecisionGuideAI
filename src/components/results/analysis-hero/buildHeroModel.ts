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
import {
  getExpectedValue,
  getMedian,
  getOptimistic,
  getPessimistic,
} from '../utils/getExpectedValue'
import { safeInterpolatedLabel, containsBannedTerm } from '../analysisHeroV17/glossaryCheck'
import { formatPercent, formatProbabilityWithResolution } from '@/utils/formatPercent'
import { formatValueWithUnit } from '@/canvas/utils/formatValueWithUnit'
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
  // formatValueWithUnit is the app-wide raw-value+unit convention (symbol
  // prefix, ISO space-prefix, % suffix, generic suffix) — factor space, not
  // outcome space; display formatting only, value unchanged.
  return HERO_COPY.detail.couldChangeIf(factor, formatValueWithUnit(ft.flip_value, ft.unit))
}

// ─── Main mapper ─────────────────────────────────────────────────────────────

export function buildHeroModel(data: ResultsSectionDataReturn): HeroModel {
  // Fail closed on a partially-shaped object (e.g. hydrated older state):
  // the type guarantees these fields, but the hero must render nothing —
  // never throw — when a caller supplies less than the type promises.
  if (!data?.recommendation?.allOptions) return { kind: 'empty' }
  const { recommendation, drivers, isLoading, isError } = data
  const completenessStatus = data.completeness?.status

  // Non-chart states first. `completeness` consults SOURCE fields (P0 V5
  // golden-path repair) and reads 'full' before any run, so these branches
  // cannot fire on a fresh canvas. Curated copy only — statusReason may carry
  // internal identifiers, so it is deliberately not interpolated.
  if (isLoading) return { kind: 'empty' }
  if (recommendation.analysisStatus === 'blocked') return statusModel('blocked')
  if (isError || recommendation.analysisStatus === 'failed' || completenessStatus === 'failed') {
    return statusModel('failed')
  }
  if (recommendation.analysisStatus === 'partial' || completenessStatus === 'partial') {
    return statusModel('partial')
  }

  const options = recommendation.allOptions
  // No analysis yet (the hook's pre-run default) — the tab stays unchanged.
  if (options.length === 0) return { kind: 'empty' }

  const { outcomeUnit, outcomeUnitSymbol, isNormalised, goalThreshold } = recommendation

  // Constraint presence drives copy only (goal-and-limits vs goal-alone).
  const hasConstraints = options.some(
    (o) => (o.constraintAnalysis?.constraints?.length ?? 0) > 0,
  )

  const recommendedId = recommendation.recommendedOption?.id ?? null
  // Pre-filter once: resolvable thresholds only (shared across every row).
  const usableFlips = (recommendation.flipThresholds ?? []).filter(
    (ft) => ft.flip_value != null,
  )

  // Rows in allOptions[] presentation order — the same order for every lens,
  // so numbering is stable across lens switches (asserted in tests).
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
        readout:
          goalValue != null
            ? formatPercent(goalValue, { fromDecimal: true })
            : HERO_COPY.readout.missing,
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

  const safeLabel = (row: HeroRowVM) =>
    safeInterpolatedLabel(row.label, HERO_COPY.labelFallback)

  let headline: string
  if (rows.length === 1) {
    headline = HERO_COPY.headline.singleOption(safeLabel(rows[0]))
  } else if (headlineRow && goalAvailable) {
    headline = hasConstraints
      ? HERO_COPY.headline.goalWithLimits(safeLabel(headlineRow))
      : HERO_COPY.headline.goalOnly(safeLabel(headlineRow))
  } else {
    // No goal basis: name whichever leader exists with the weaker
    // "looks strongest" claim, or claim no leader at all.
    const leader = headlineRow ?? outcomeLeaderRow
    headline = leader
      ? HERO_COPY.headline.outcomeOnly(safeLabel(leader))
      : HERO_COPY.headline.noLeader
  }

  // Tension subline: goal-fit leader vs strongest expected outcome. Display
  // selection only — needs both a goal-based headline leader and an outcome
  // leader to be an honest comparison.
  let subline: string | null = null
  if (rows.length > 1 && goalAvailable && headlineRow && outcomeLeaderRow) {
    subline =
      headlineRow.id === outcomeLeaderRow.id
        ? HERO_COPY.subline.aligned(safeLabel(headlineRow))
        : HERO_COPY.subline.diverged(
            safeLabel(outcomeLeaderRow),
            safeLabel(headlineRow),
            hasConstraints,
          )
  }

  // Target/domain guard: strictly `isNormalised === false` — outcome values
  // have been denormalised into user units, the same space as goalThreshold.
  // `undefined` (older data, pre-run defaults) counts as uncertainty → omit.
  const targetCompatible =
    isNormalised === false &&
    typeof goalThreshold === 'number' &&
    Number.isFinite(goalThreshold)
  const targetValue = targetCompatible ? goalThreshold : null

  // Layout-only display domain for the outcome axis.
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
      // never an independent argmax. Null when no leader is claimable.
      goal: headlineRow?.id ?? null,
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
