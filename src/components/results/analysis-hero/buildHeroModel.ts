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
 *     the earliest row in the shared display order (sortOptionsForDisplay).
 *
 * Goal-fit honesty: the adapted selector collapses joint/unconstrained into
 * one `goalProbability` (= probability_of_joint_goal when constraints exist,
 * else goal_probability — see useResultsSectionData). The hero therefore
 * shows ONE bar labelled by constraint presence and renders NO separate
 * goal-alone marker (selector gap, reported in the PR).
 *
 * Lens ownership: the Likely outcome lens owns OPTION COMPARISON, so its
 * layout domain is derived from the option outcome values only and it never
 * renders a goal-target marker (a target far above the option spread would
 * compress the bars and destroy discrimination). Target ATTAINMENT lives on
 * the Goal fit lens — its probability bars plus the sub-1% / no-option-on-
 * track honesty carry the shortfall truth.
 */

import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { FlipThreshold, OptionResult } from '../types'
import { GAP_THRESHOLD } from '../buildResultsVM'
import { formatThreshold } from '../RangeVisualization'
import { stripEncodingNotation } from '../utils/cleanFactorLabel'
import { sortOptionsForDisplay } from '../utils/optionDisplayOrder'
import { SUB_ONE_PERCENT_FLOOR } from '../utils/displayFloors'
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
  return {
    kind: 'status',
    provenance: 'live',
    variant,
    headline: copy.headline,
    body: copy.body,
  }
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
 * UI-SEM-057: sub-1% goal readout floor — the SHARED constant OptionCards'
 * "< 1% likely to reach target" affordance uses (utils/displayFloors), so a
 * 0.4% probability never rounds to a bare "0%" here while the panel below
 * says "< 1%". Display-only; the value itself is unchanged and the bar
 * still draws from the raw value. The same floor — no new threshold — also
 * gates the goal-fit leader claim and the no-option-on-track headline:
 * when EVERY goal readout would render "< 1%", claiming any option "best
 * fits your goal" would be false.
 */
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

  // One row per option, preserving the display order established above.
  const rows: HeroRowVM[] = options.map((o, i) => {
    const goalValue = o.goalProbability ?? null
    const centre = outcomeCentre(o)
    const p10 = outcomeP10(o)
    const p90 = outcomeP90(o)
    const why = recommendation.storyHeadlines?.[o.id]
    const couldChangeIf = couldChangeIfLine(o, o.id === recommendedId, usableFlips)
    const winChance =
      typeof o.winProbability === 'number'
        ? HERO_COPY.detail.winChance(
            formatProbabilityWithResolution(o.winProbability, o.nValidSamples),
          )
        : undefined
    // Grounded detail lines from the row's OWN existing fields (same
    // formatters as the readouts) — never authored prose, omitted when the
    // sourcing fields are absent.
    const range =
      p10 != null && p90 != null
        ? HERO_COPY.detail.range(
            formatThreshold(p10, outcomeUnit, outcomeUnitSymbol, isNormalised),
            formatThreshold(p90, outcomeUnit, outcomeUnitSymbol, isNormalised),
          )
        : undefined
    // Per-ROW constraint wording (unlike the shared axis/caption, which use
    // the every-quantifier `hasConstraints`): the selector collapses THIS
    // option's goalProbability to the joint figure exactly when the option
    // carries its own constraint analysis, so the row's detail line can name
    // the quantity precisely — a constrained option's joint figure is never
    // mislabelled goal-alone in a mixed set.
    const goalFit =
      goalValue != null
        ? optionHasConstraints(o)
          ? HERO_COPY.detail.goalFitWithLimits(goalReadout(goalValue))
          : HERO_COPY.detail.goalFit(goalReadout(goalValue))
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
        p10,
        p90,
        centre,
        readout:
          centre != null
            ? formatThreshold(centre, outcomeUnit, outcomeUnitSymbol, isNormalised)
            : HERO_COPY.readout.missing,
      },
      detail: { why, couldChangeIf, winChance, range, goalFit },
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
  // row on ties (deterministic shared-display-order tie-break).
  let outcomeLeaderRow: HeroRowVM | null = null
  let outcomeLeaderCentre = -Infinity
  for (const r of rows) {
    if (r.outcome.centre != null && r.outcome.centre > outcomeLeaderCentre) {
      outcomeLeaderCentre = r.outcome.centre
      outcomeLeaderRow = r
    }
  }
  const outcomeLeaderId = outcomeLeaderRow?.id ?? null

  // Outcome runner-up: second-highest existing centre, same deterministic
  // tie-break. Needed only for the close-call calibration below.
  let outcomeRunnerUpRow: HeroRowVM | null = null
  let runnerUpCentre = -Infinity
  for (const r of rows) {
    if (r.id === outcomeLeaderId) continue
    if (r.outcome.centre != null && r.outcome.centre > runnerUpCentre) {
      runnerUpCentre = r.outcome.centre
      outcomeRunnerUpRow = r
    }
  }

  // Headline leader: the Results Panel's recommended option. `find` also
  // guards the recovered-session identity mismatch — if the recommended id
  // is not among the analysed rows, no leader is claimed.
  const headlineRow = rows.find((r) => r.id === recommendedId) ?? null

  // UI-SEM-060 (revised): leader-claim banding for the no-goal-basis
  // headline. Three concepts the copy must keep separate (staging trust
  // follow-up): (1) how likely the leader is to be strongest — the
  // producer's OWN win probability, the same value the detail line shows;
  // (2) how close the top expected outcomes are — the top-two centres;
  // (3) whether the drawn uncertainty ranges overlap. Range overlap alone
  // must never produce a "close" claim (a 77%-win leader with a +22 vs +8
  // spread is not a close call just because p10-p90 ranges intersect); it
  // only appends the state-A overlap advisory. Every signal is an existing
  // producer value or a comparison of two of them — display calibration
  // only, never fed back into ranking or selection.

  // Win probabilities: the headline leader's own, and the strongest rival's
  // (for the clear-lead gap). null when the producer did not send one.
  const winProbOf = (o: OptionResult): number | null =>
    typeof o.winProbability === 'number' ? o.winProbability : null
  const leaderOption = options.find((o) => o.id === recommendedId) ?? null
  const leadWinP = leaderOption ? winProbOf(leaderOption) : null
  let rivalWinP: number | null = null
  for (const o of options) {
    if (o.id === recommendedId) continue
    const w = winProbOf(o)
    if (w != null && (rivalWinP == null || w > rivalWinP)) rivalWinP = w
  }

  // Band thresholds: 0.65 = strong/likely leader (the "most likely to be
  // strongest overall" claim is safe well past the coin-flip); 0.5 =
  // majority; GAP_THRESHOLD (0.10) is the SAME win-gap the Results Panel's
  // decisionState uses for 'indeterminate' (UI-SEM-006), so the hero can
  // never call "no clear leader" by a different standard than the panel
  // below. Sub-majority leaders with a clear gap over the strongest rival
  // (win probabilities dilute as the option count grows) stay "ahead" —
  // never "no clear leader".
  const WIN_STRONG_LEADER = 0.65
  const WIN_MAJORITY = 0.5
  let leaderBand: 'strong' | 'ahead' | 'none' | null = null
  if (leadWinP != null) {
    if (leadWinP >= WIN_STRONG_LEADER) leaderBand = 'strong'
    else if (leadWinP >= WIN_MAJORITY) leaderBand = 'ahead'
    else if (rivalWinP != null)
      leaderBand = leadWinP - rivalWinP >= GAP_THRESHOLD ? 'ahead' : 'none'
    // Below majority with no rival win probability to compare against the
    // band stays null — the unbanded fallback claim, never a guess.
  }

  // Signal (3): the top-two rendered outcome rows' p10-p90 ranges intersect
  // (inclusive — touching ranges count). Drives ONLY the state-A overlap
  // advisory sentence; false whenever either range is missing.
  const topTwoRangesOverlap =
    outcomeLeaderRow != null &&
    outcomeRunnerUpRow != null &&
    outcomeLeaderRow.outcome.p10 != null &&
    outcomeLeaderRow.outcome.p90 != null &&
    outcomeRunnerUpRow.outcome.p10 != null &&
    outcomeRunnerUpRow.outcome.p90 != null &&
    Math.max(outcomeLeaderRow.outcome.p10, outcomeRunnerUpRow.outcome.p10) <=
      Math.min(outcomeLeaderRow.outcome.p90, outcomeRunnerUpRow.outcome.p90)

  // Signal (2): the top-two expected outcomes are genuinely close — the
  // centres differ by no more than 15% of the larger magnitude. Range-
  // independent by design (closeness of expectations is a different fact
  // from overlapping uncertainty), and the ONLY gate on naming a runner-up
  // as "close on expected outcome".
  const OUTCOME_GAP_CLOSE_RATIO = 0.15
  const outcomeGapSmall =
    outcomeLeaderRow?.outcome.centre != null &&
    outcomeRunnerUpRow?.outcome.centre != null &&
    outcomeLeaderRow.outcome.centre - outcomeRunnerUpRow.outcome.centre <=
      OUTCOME_GAP_CLOSE_RATIO *
        Math.max(
          Math.abs(outcomeLeaderRow.outcome.centre),
          Math.abs(outcomeRunnerUpRow.outcome.centre),
        )

  // Goal honesty (UI-SEM-057 reuse — the same sub-1% floor that drives the
  // "< 1%" readouts, no new threshold): when EVERY row carries a goal
  // probability below the floor, no option is meaningfully on track, so the
  // hero declines to crown a goal-fit leader at all — headline and goal-lens
  // highlight both switch to the no-option-on-track state. Mixed coverage
  // (any row without a goal value) falls through to the normal branches.
  // (rows is never empty here — the empty-options case returned above.)
  const allGoalBelowFloor = rows.every(
    (r) => r.goal.value != null && r.goal.value < SUB_ONE_PERCENT_FLOOR,
  )

  // A goal-fit claim ("best fits your goal") is only honest when the claimed
  // option ITSELF carries a goal probability AT OR ABOVE the same sub-1%
  // floor — a recommended option whose goal readout would be "—" or "< 1%"
  // must not be headlined or highlighted as the goal-fit leader while other
  // rows show real figures. Below-floor leaders fall through to the
  // analysis-leader wording instead. (The >= floor check also makes this
  // null whenever allGoalBelowFloor is true — headlineRow is one of rows.)
  const goalLeaderRow =
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
    // Constraint-aware like every goal claim: under constraints the floored
    // figure is the JOINT probability and the axis/caption say "goal and
    // limits" — the headline must describe the same quantity.
    headline = hasConstraints
      ? HERO_COPY.headline.noneOnTrackWithLimits
      : HERO_COPY.headline.noneOnTrack
  } else if (goalLeaderRow) {
    headline = hasConstraints
      ? HERO_COPY.headline.goalWithLimits(safeLabel(goalLeaderRow))
      : HERO_COPY.headline.goalOnly(safeLabel(goalLeaderRow))
  } else if (headlineRow) {
    // No goal basis: the leader claim names the canonical analysis leader
    // (recommendedOption — proven to equal the Results Panel/producer
    // leader), banded by the producer's win probabilities (UI-SEM-060).
    // The banded claims are win-probability claims, so they stay honest
    // whether or not the leader also has the strongest expected outcome;
    // missing win probabilities fall back to the unbanded analysis claim.
    headline =
      leaderBand === 'strong'
        ? HERO_COPY.headline.mostLikelyStrongest(safeLabel(headlineRow))
        : leaderBand === 'ahead'
          ? HERO_COPY.headline.slightlyAhead(safeLabel(headlineRow))
          : leaderBand === 'none'
            ? HERO_COPY.headline.noClearLeader
            : HERO_COPY.headline.analysisLeads(safeLabel(headlineRow))
  } else if (outcomeAvailable && outcomeLeaderRow) {
    // No recommended option among the rows: headline the outcome fact
    // itself — but ONLY when the outcome lens is actually visible (centres
    // without ranges hide it, and the hero must not assert an
    // expected-outcome comparison it cannot show). The subline is then
    // redundant and stays null.
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
  const bandedNoGoalClaim =
    rows.length > 1 && !allGoalBelowFloor && !goalLeaderRow && headlineRow != null
  if (bandedNoGoalClaim && leaderBand === 'none') {
    // State C: no leader was claimed, so no divergence exists to state —
    // the companion line points at the comparison without risking a name.
    subline = HERO_COPY.subline.compareTop
  } else if (rows.length > 1 && outcomeAvailable && outcomeLeaderRow) {
    if (allGoalBelowFloor) {
      // No leader was claimed; the outcome fact is the one honest pointer.
      subline = HERO_COPY.subline.highestOutcome(safeLabel(outcomeLeaderRow))
    } else if (headlineRow) {
      // Aligned case per band (UI-SEM-060): state B names the runner-up as
      // close ONLY when the expected-outcome gap is genuinely small (never
      // from range overlap); state A states the outcome fact plainly.
      // goalLeaderRow-headlined runs keep the plain aligned/divergence pair
      // — the goal claim is not an outcome claim. Diverged leaders keep the
      // persistent divergence line in every band.
      const alignedLeaders = headlineRow.id === outcomeLeaderRow.id
      if (!alignedLeaders) {
        subline = HERO_COPY.subline.highestOutcome(safeLabel(outcomeLeaderRow))
      } else if (
        bandedNoGoalClaim &&
        leaderBand === 'ahead' &&
        outcomeGapSmall &&
        outcomeRunnerUpRow
      ) {
        subline = HERO_COPY.subline.closeOnOutcome(safeLabel(outcomeRunnerUpRow))
      } else if (bandedNoGoalClaim && leaderBand === 'strong') {
        subline = HERO_COPY.subline.highestOutcome(safeLabel(headlineRow))
      } else {
        subline = HERO_COPY.subline.aligned(safeLabel(headlineRow))
      }
      // State-A overlap advisory: overlap is disclosed as uncertainty about
      // the RANGES — appended, never a downgrade of the leader claim.
      if (bandedNoGoalClaim && leaderBand === 'strong' && topTwoRangesOverlap) {
        subline = `${subline} ${HERO_COPY.subline.overlapAdvisory}`
      }
    }
  }

  // UI-SEM-054: outcome-axis layout domain derivation. Min/max over the
  // existing p10/p90/centre values ONLY, padded 5% each side (matching
  // RangeVisualization) with a unit pad on a degenerate span. Layout only —
  // the domain positions bars and is never displayed as data.
  //
  // The goal threshold is deliberately NOT in this domain: the Likely
  // outcome lens owns option comparison, and a target far from every
  // outcome (the common case — the goal sits well above the option spread)
  // would stretch the domain and compress the bars into a narrow band,
  // destroying the discrimination the lens exists to show. Target
  // attainment lives on the Goal fit lens instead (its probability bars and
  // the sub-1% / no-option-on-track honesty), so the outcome chart never
  // renders a target marker.
  let outcomeDomain: { min: number; max: number } | null = null
  if (outcomeAvailable) {
    const values: number[] = []
    for (const r of rows) {
      if (r.outcome.p10 != null) values.push(r.outcome.p10)
      if (r.outcome.p90 != null) values.push(r.outcome.p90)
      if (r.outcome.centre != null) values.push(r.outcome.centre)
    }
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
    // This function is the ONLY producer of 'live' models (asserted by the
    // suite): fixture models exist solely in the internal gallery and are
    // branded 'fixture' so the panel shows the internal-preview banner.
    provenance: 'live',
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
      // Stability / What-changed carry no live data (producer gaps 211/212)
      // — no leader can exist on a lens with nothing to lead.
      stability: null,
      whatChanged: null,
    },
    outcomeDomain,
    // Caption honesty: only describe range lines (and overlap) the chart
    // actually draws — 0/1/2+ ranged rows pick the caption wording.
    outcomeRangedRowCount: rows.filter(
      (r) => r.outcome.p10 != null && r.outcome.p90 != null,
    ).length,
    // Discoverability hint fires ONLY when the goal lens is absent because
    // no success target exists — a targeted run missing goal probabilities
    // is a producer gap where "set a success target" would mislead.
    showGoalHint: !goalAvailable && goalThreshold == null,
    mainReason,
    // Producer-gap slots — the LIVE adapter NEVER populates these (no
    // display-safe trust/status label: issues 219/221; no coaching
    // top-action contract: issue 220). They render only from typed
    // fixtures until the producer fields exist; missing fields are
    // unavailable states, never fabricated values.
    trustLine: null,
    statusChip: null,
    focusAction: null,
    // Success-target editor unit — passthrough of the existing outcome
    // unit fields (the target is a threshold on the outcome axis, so the
    // outcome unit IS the target unit). Display labelling only.
    targetUnit:
      outcomeUnit === 'percent' ? '%' : (outcomeUnitSymbol ?? null),
  }
  return model
}
