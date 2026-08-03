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
 * Leader rules (review-locked; goal-fit crown revised by lane 35):
 *   - Goal-fit crown (the goal-attainment headline + goal-lens
 *     highlight) = the goalProbability ARGMAX (UI-SEM-072) — the claim
 *     describes the GOAL view, so it must follow the view's own maximum,
 *     never the recommendation re-crowned onto a view it does not lead
 *     (live staging: a 4% fit was crowned over 7%/6%). Withheld entirely
 *     (no crown rather than a wrong crown) when fits are missing on any
 *     row, tied at the max, or below the shared sub-1% floor.
 *   - No-goal-basis headline leader = `recommendation.recommendedOption`
 *     (the Results Panel's own leader) — never an independent argmax of
 *     winProbability, so the hero cannot disagree with the panels below.
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
import { formatThreshold } from '../RangeVisualization'
import { stripEncodingNotation } from '../utils/cleanFactorLabel'
import { selectFlipRisk } from '../utils/selectFlipRisk'
import { sortOptionsForDisplay } from '../utils/optionDisplayOrder'
// `SUB_ONE_PERCENT_FLOOR` is still imported, and deliberately: it no longer
// formats anything here, but it still GATES the no-option-on-track headline
// (`allGoalBelowFloor`). That gate is a semantic threshold about the raw
// values — "is any option meaningfully on track" — not a display rule, so it
// keeps reading the constant even though the readouts now resolve finer.
import { SUB_ONE_PERCENT_FLOOR, formatGoalProbability } from '../utils/displayFloors'
import { hasAnyGoalValue, selectGoalLeader } from '../utils/selectGoalLeader'
import { isDirectionalFactor } from '../../../lib/factorDirection'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../utils/goalFitBasisCaveatCopy'
import {
  getExpectedValue,
  getMedian,
  getOptimistic,
  getPessimistic,
} from '../utils/getExpectedValue'
import { safeInterpolatedLabel, containsBannedTerm } from '../analysisHeroV17/glossaryCheck'
import { formatPercent, formatProbabilityWithResolution } from '@/utils/formatPercent'
import { flipDirectionWording, formatFlipValue } from '../utils/flipThresholdDisplay'
import { HERO_COPY } from './heroCopy'
import type { HeroChartModel, HeroLens, HeroModel, HeroRowVM, HeroStatusModel } from './heroTypes'

// ─── Small helpers (selection + display formatting only) ────────────────────

// Live variants only — 'paused' (§6.2) is deliberately unrepresentable
// here: it is producer-gated with no live signal, so the type narrows the
// never-emits-paused pin into the compiler.
function statusModel(variant: 'partial' | 'failed' | 'blocked'): HeroStatusModel {
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
 * OUTCOME_CLOSE_RATIO — the single relative tolerance that defines "the top
 * expected outcomes are close" across this module. Two uses, one number:
 *   (1) subline copy: name the runner-up as "close on expected outcome"
 *       instead of crowning a "strongest" leader (win-banded state B); and
 *   (2) layout: floor the outcome-axis span (UI-SEM-054) so a spread that is
 *       tiny RELATIVE to the values does not zoom the axis.
 * It is deliberately NOT the gate for suppressing the "strongest" claim in
 * the unbanded case — that uses exact rendered-readout equality (UI-SEM-070),
 * a stricter "the chart literally shows the same number" test, so an 8–15%
 * gap still reads as a genuine (if modest) lead.
 */
const OUTCOME_CLOSE_RATIO = 0.15

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
/**
 * ⭐ ROADMAP 2.333/2.334 — this was a THIRD hand-copy of the goal register's
 * floor (`value < SUB_ONE_PERCENT_FLOOR ? subOnePercent : formatPercent`),
 * sitting beside the option card's and the V7 lens's copies of the same rule.
 * It now calls the register's own formatter.
 *
 * The delegation is byte-identical to the previous behaviour whenever no
 * sample count is supplied: `SUB_ONE_PERCENT_READOUT` and
 * `HERO_COPY.readout.subOnePercent` are the same string ("< 1%"), and above
 * the floor both paths are `formatPercent(v, { fromDecimal: true })`. The
 * `missing` arm is the hero's own and stays here — it is a copy decision
 * about an ABSENT value, not a formatting rule about a present one.
 *
 * With a count, the readout resolves exactly as the card and the goal lens
 * now do. That matters most on this surface: the hero states its figure ABOVE
 * the rows, so a hero saying "< 1%" over rows saying "0.1%" would be the same
 * one-number-two-answers contradiction this slice exists to remove, moved one
 * element up.
 */
function goalReadout(value: number | null, nSamples?: number | null): string {
  if (value == null) return HERO_COPY.readout.missing
  return formatGoalProbability(value, nSamples)
}

// formatFlipValue moved VERBATIM to `../utils/flipThresholdDisplay` (ROADMAP
// 2.291) so the V7 signal chip renders the same producer rows through the
// same formatter — "one threshold must never render two ways in one panel"
// now holds across surfaces, not just within this module.

// ─── Main mapper ─────────────────────────────────────────────────────────────

export function buildHeroModel(
  data: ResultsSectionDataReturn,
  numbering?: Readonly<Record<string, number>>,
  /**
   * Canvas node ids for the flip-risk focus pre-gate (supplied by the
   * store-aware hook). When provided, a flip row whose node_id is not on
   * the canvas gets a null target — the row renders as text instead of a
   * silently no-oping button (fail-closed, same discipline as the drivers'
   * canFocus). When absent (older callers/tests) the target passes through
   * and the container's focus resolver remains the fail-closed layer.
   */
  canvasNodeIds?: ReadonlySet<string>,
): HeroModel {
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
  // Lane 3 (SF2) review blocker fold: during a RERUN the store retains the
  // previous report, so `recommendation` still carries renderable rows —
  // returning 'empty' here unmounted AnalysisHeroPanel on every rerun,
  // wiping lensState/openRowId/prevGoalHintRef (the goal-lens auto-switch
  // could never observe its transition) and collapsing the hero slot while
  // the rest of the body stayed rendered. Same for a FAILED rerun: the
  // retained rows keep rendering (the error banner + strip tell the new
  // run's failure story); the 'failed' card is only honest when there is
  // nothing to show. `analysisStatus` belongs to the DISPLAYED report
  // itself, so its blocked/failed/partial states still gate as before.
  const hasRenderableRows = recommendation.allOptions.length > 0
  if (isLoading && !hasRenderableRows) return { kind: 'empty' }
  if (recommendation.analysisStatus === 'blocked') return statusModel('blocked')
  if ((isError && !hasRenderableRows) || recommendation.analysisStatus === 'failed') return statusModel('failed')
  if (recommendation.analysisStatus === 'partial') return statusModel('partial')

  // ROADMAP 1.267 — DESIGNATION vs DATA. On a run whose verdict withholds the
  // leader claim, ORDER, ORDINALS and the CROWN are designations and go; the
  // probabilities and every row stay. Read from the verdict the hook already
  // derived — this surface renders that decision, it never re-derives one
  // (the same rule that deleted `decisionVerdict`'s Authority 3).
  //
  // A caller supplying NO verdict is a legacy fixture, not a withheld run, so
  // it keeps byte-identical behaviour. The live path always supplies one
  // (`useResultsSectionData` derives it unconditionally).
  const designationsWithheld = recommendation.verdict != null && !recommendation.verdict.hasLeadingOption

  // Present rows in the SHARED option display order (win probability when
  // complete, else expected — sortOptionsForDisplay) so hero numbering always
  // matches the OptionCards/WinGauge ranking below. Presentation numbering,
  // not graph-node truth; stable across lens switches (asserted in tests).
  // WITHHELD: the comparator does not run and `allOptions` arrives in
  // canonical (graph) order, because the hook skipped its own sort too.
  const options = sortOptionsForDisplay(recommendation.allOptions, { designationsWithheld })
  // Wave 2 (§6.4): identity-anchored ordinals, all-or-nothing — if ANY row
  // is unregistered every row falls back to the positional index at render
  // (mixing the two schemes in one list could show duplicate numbers).
  const stableNumberFor = (id: string): number | null =>
    numbering != null && options.every((o) => numbering[o.id] != null)
      ? numbering[id] ?? null
      : null
  // No analysis yet (the hook's pre-run default) — the tab stays unchanged.
  if (options.length === 0) return { kind: 'empty' }

  const { outcomeUnit, outcomeUnitSymbol, isNormalised, goalThreshold } = recommendation

  // UI-SEM-071: null-target goal-claim suppression. Goal-fit display is
  // gated on the USER success target (goalThreshold), NEVER on producer
  // value presence: when the request omits goal_threshold, PLoT/ISL
  // synthesize auto_goal_threshold and the selector fallback still adopts
  // probability_of_joint_goal as goalProbability — values that describe a
  // target the user never set. Without a user target the hero must not
  // render fit percentages, the goal axis, or any goal-attainment claim
  // (the crown headline, the no-option-on-track headline), so every row's
  // goal slot is suppressed at source (below) and the goal lens becomes the honest
  // needs-target state. Suppression only — no value is transformed.
  const hasUserTarget = goalThreshold != null

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
    // UI-SEM-071: without a USER target the goal slot is suppressed at
    // source — bars, readouts, the goalFit detail line and every downstream
    // goal claim (allGoalBelowFloor, goalLeaderRow, goal lens availability)
    // all key off this value, so a synthesized goalProbability cannot
    // bypass the gate anywhere.
    const goalValue = hasUserTarget ? (o.goalProbability ?? null) : null
    const centre = outcomeCentre(o)
    const p10 = outcomeP10(o)
    const p90 = outcomeP90(o)
    const why = recommendation.storyHeadlines?.[o.id]
    const couldChangeIf = couldChangeIfLine(o, o.id === recommendedId, usableFlips)
    const winReadout =
      typeof o.winProbability === 'number'
        ? formatProbabilityWithResolution(o.winProbability, o.nValidSamples)
        : undefined
    const winChance = winReadout != null ? HERO_COPY.detail.winChance(winReadout) : undefined
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
    // Goal-probability IDENTITY: when the row's number is the joint figure
    // STANDING IN for an absent goal probability (`goalFitIsSubstitutedJoint`,
    // set by the shared selector — never re-derived here), the possessive
    // "your goal" wording names a question the number does not answer, so the
    // line states the quantity it actually is. The number itself is unchanged
    // and still shown: this is a copy switch, never a value transform.
    // ⚠ On the live V5 wire this is the ONLY branch that runs: the selector's
    // basis is `joint_goal_substituted` on every run (both discriminating
    // inputs are pinned constants — see heroCopy's `noneOnTrack` block), and
    // `optionHasConstraints` is always false. So this line, the headline and
    // the caption must state ONE claim in one voice — they are read together,
    // in a single render, about a single number.
    const goalFit =
      goalValue != null
        ? optionHasConstraints(o)
          ? HERO_COPY.detail.goalFitWithLimits(goalReadout(goalValue, o.nValidSamples))
          : o.goalFitIsSubstitutedJoint === true
            ? HERO_COPY.detail.goalFitJointBasis(goalReadout(goalValue, o.nValidSamples))
            : HERO_COPY.detail.goalFit(goalReadout(goalValue, o.nValidSamples))
        : undefined
    // Display-honesty (ROADMAP 1.6b follow-up, claim-integrity): the caveat
    // renders ONLY when the goalFit number just above it is actually shown
    // (goalValue != null) AND the row's own goalFitIsModelledBasis flag is
    // set — computed by useResultsSectionData.ts using the exact same
    // hasConstraints/jointGoalProb branches OptionCards' caveat gates on
    // (o.goalFitIsModelledBasis), never re-derived here. Shared wording
    // (GOAL_FIT_BASIS_CAVEAT_COPY) — never invented, never a separate claim.
    const goalFitCaveat =
      goalValue != null && o.goalFitIsModelledBasis === true
        ? GOAL_FIT_BASIS_CAVEAT_COPY
        : undefined
    return {
      id: o.id,
      index: i + 1,
      stableNumber: stableNumberFor(o.id),
      label: stripEncodingNotation(o.label),
      goal: {
        value: goalValue,
        readout: goalReadout(goalValue, o.nValidSamples),
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
      comparativeReadout: winReadout ?? null,
      detail: { why, couldChangeIf, winChance, range, goalFit, goalFitCaveat },
    }
  })

  // Lens availability — hidden entirely when the sourcing fields are absent.
  // The goal lens is additionally gated on the USER target (UI-SEM-071):
  // the row-level suppression above already nulls every goal value when no
  // target exists, but the explicit `hasUserTarget` term keeps the gate
  // visible and future-proof (value presence alone must never re-enable
  // the lens for synthesized values).
  //
  // ⭐ ROADMAP 2.233 — AVAILABILITY, kept as `.some`, now NAMED.
  //
  // This is `hasUserTarget && rows.some(...)` exactly as before; only the
  // predicate's home and name changed. A revision of 2.233 briefly tightened it
  // to `.every` to "match" the V7 lens, and that was a mistake worth recording:
  // it conflated what we may DISPLAY with what we may CLAIM. The crown was
  // ALREADY withheld on partial coverage by `selectGoalLeader`'s complete-field
  // gate, so tightening this bought no claim-safety — it only hid goal values
  // the producer HAD measured, on a surface that renders the missing ones as
  // `'—'` (`goalReadout`). Data is not a claim; an honest gap marker is not a
  // reason to blank the row beside it.
  const goalAvailable = hasAnyGoalValue(rows, (r) => r.goal.value, { hasUserTarget })
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

  // Leader-claim banding for the no-goal-basis headline — PRODUCER-FIRST
  // (Lane UI-W4, PLoT #200): PLoT's decision_brief.headline_banded now
  // carries the leader-confidence band UI-SEM-060 existed to fake
  // (very_close / slightly_ahead / clearly_ahead, robustness downgrades
  // already folded in producer-side via robustness_gated). When the
  // producer band is present AND names the SAME leader this hero
  // headlines, it drives the banded copy directly — no second opinion.
  //
  // UI-SEM-060 (residual fallback, revised): the UI's own win-probability
  // banding applies ONLY when the producer band is absent (older PLoT
  // build, single-option run, failed normalisation) or names a different
  // leader (applying a producer claim about option X to option Y would
  // transform meaning — the identity gate fails closed to the fallback).
  // Three concepts the fallback copy must keep separate (staging trust
  // follow-up): (1) how likely the leader is to be strongest — the
  // producer's OWN win probability, the same value the detail line shows;
  // (2) how close the top expected outcomes are — the top-two centres;
  // (3) whether the drawn uncertainty ranges overlap. Range overlap alone
  // must never produce a "close" claim (a 77%-win leader with a +22 vs +8
  // spread is not a close call just because p10-p90 ranges intersect); it
  // only appends the state-A overlap advisory. Every signal is an existing
  // producer value or a comparison of two of them — display calibration
  // only, never fed back into ranking or selection.

  // (The headline leader's own win probability and the strongest rival's used
  // to be computed here, to band the leader claim when the producer sent no
  // band. Both are gone with that branch — ROADMAP 1.223. The win
  // probabilities themselves are unaffected: the rows still render them.)

  // Producer band (PLoT decision_brief.headline_banded, normalised
  // fail-closed upstream): applied ONLY when it names the exact leader the
  // hero headlines. The three producer tokens map onto the three existing
  // banded copy states — no new wording is invented:
  //   clearly_ahead  → 'strong'  ("most likely to be strongest overall")
  //   slightly_ahead → 'ahead'   ("slightly ahead")
  //   very_close     → 'none'    ("No option is clearly ahead.")
  // robustness_gated downgrades arrive already folded into the band by the
  // producer, so no copy keys off the flag here.
  // SINGLE VERDICT (2026-07-25): the hero no longer resolves the producer band
  // or bands win probabilities itself. Both are now done once, in
  // `deriveDecisionVerdict` (src/lib/decisionVerdict.ts), and every surface
  // that asserts or denies a leading option quotes that one answer — this
  // hero, the results-panel headline, the canvas badge and the checks footer.
  // The local resolution below is kept ONLY as the fallback for callers that
  // do not yet supply a verdict (older fixtures), and is byte-identical to
  // what it did before.
  const sharedVerdict = recommendation.verdict ?? null
  const sharedVerdictApplies =
    sharedVerdict != null &&
    headlineRow != null &&
    sharedVerdict.separation !== 'unknown' &&
    sharedVerdict.leaderId === headlineRow.id

  const producerBand = recommendation.headlineBanded ?? null
  // WITHHELD GATE 1 of 4 (ROADMAP 1.267, prose leg — sweep 2026-07-27).
  //
  // The two identity gates anchor on DIFFERENT rows, and that difference is
  // a live leak: `deriveDecisionVerdict` applies the band only when it names
  // the win-probability ARGMAX (`top1`), while this local fallback applies it
  // when it names the RECOMMENDED option (`headlineRow`). PLoT is documented
  // to recommend a non-argmax option — and on such a run the shared verdict
  // withholds (`separation: 'unknown'`, `hasLeadingOption: false`) while this
  // line still resolves a band and re-authors the claim as
  // "<option> is most likely to be strongest overall."
  //
  // That is Authority 3 re-entering by the side door. The shared verdict is
  // the single answer to "may we name a leader?" (2026-07-25); when it says
  // no, the local band resolution may not say yes. The producer's own TIE
  // call is unaffected — it arrives via `sharedVerdictApplies` above, keeps
  // `leaderBand === 'none'`, and still earns "No option is clearly ahead."
  const producerBandApplies =
    producerBand != null &&
    headlineRow != null &&
    !designationsWithheld &&
    producerBand.leaderOptionId === headlineRow.id

  // UI-SEM-060 (ROADMAP 1.223): the band comes from a PRODUCER claim or it
  // does not come at all.
  //
  // A third branch used to sit here, banding the win probabilities itself
  // (>= 0.65 "strong", >= 0.50 "ahead", gap >= GAP_THRESHOLD "ahead"). It is
  // DELETED. CEE #711 made the absence of `headline_banded` the signal that
  // the leader claim is WITHHELD, while the win probabilities keep riding the
  // wire — so re-banding them here reconstructed precisely the claim the
  // producer had just withheld, and put "X is slightly ahead" on the same
  // screen as "no option can be put forward yet".
  //
  // `null` now means one thing only: NO OWNED CLAIM. It is handled at the
  // headline below by declining to name a leader, never by inventing a band.
  let leaderBand: 'strong' | 'ahead' | 'none' | null = null
  if (sharedVerdictApplies) {
    // clear → "most likely to be strongest overall"
    // slight → "slightly ahead"
    // tied → "No option is clearly ahead."
    leaderBand =
      sharedVerdict!.separation === 'clear'
        ? 'strong'
        : sharedVerdict!.separation === 'slight'
          ? 'ahead'
          : 'none'
  } else if (producerBandApplies) {
    leaderBand =
      producerBand.band === 'clearly_ahead'
        ? 'strong'
        : producerBand.band === 'slightly_ahead'
          ? 'ahead'
          : 'none'
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
  const outcomeGapSmall =
    outcomeLeaderRow?.outcome.centre != null &&
    outcomeRunnerUpRow?.outcome.centre != null &&
    outcomeLeaderRow.outcome.centre - outcomeRunnerUpRow.outcome.centre <=
      OUTCOME_CLOSE_RATIO *
        Math.max(
          Math.abs(outcomeLeaderRow.outcome.centre),
          Math.abs(outcomeRunnerUpRow.outcome.centre),
        )

  // UI-SEM-070: readout-tie coherence gate. When the top-two outcome rows
  // render the SAME readout string, the chart literally shows no strongest
  // option (the reported staging run displayed "100" on all four), so the
  // subline must NOT claim one — it names the close rival instead. This is
  // the exact "what the user sees" signal: string equality of the rendered
  // readouts, never a fabricated value and never a loose ratio (so an 8–15%
  // gap that renders as distinct numbers still reads as a genuine lead).
  const topOutcomesReadoutTied =
    outcomeLeaderRow != null &&
    outcomeRunnerUpRow != null &&
    outcomeLeaderRow.outcome.readout !== HERO_COPY.readout.missing &&
    outcomeLeaderRow.outcome.readout === outcomeRunnerUpRow.outcome.readout

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

  // UI-SEM-072: goal-fit crown = the goalProbability ARGMAX, honestly gated.
  // The goal-attainment headline and the goal-lens "(Leads on this
  // view)" ring describe the GOAL view, so they must crown the row with the
  // HIGHEST goal probability — never the recommendation/win-probability
  // leader re-crowned onto a view it does not lead (live staging evidence:
  // a 4% fit crowned over 7%/6% — acceptance-evidence/goal-fit/6b-browser).
  // SELECTION of existing producer values only; the crown is withheld (null
  // — no crown rather than a wrong crown) unless ALL of:
  //   - a USER target exists (UI-SEM-071 nulls every goal value without
  //     one, but the gate is stated explicitly so it cannot be silently
  //     re-opened by a change to the row mapping);
  //   - EVERY row carries its own goal probability (a max over unmeasured
  //     rivals cannot honestly claim "best");
  //   - the max is UNIQUELY held (uniform or tied-at-the-top fits identify
  //     no single best option — crowning either would be arbitrary); and
  //   - the max clears the shared sub-1% floor (UI-SEM-057 — also null
  //     whenever allGoalBelowFloor is true, so the no-option-on-track
  //     headline keeps precedence).
  // With no crown the headline falls through to the existing honest
  // branches (banded analysis-leader claim) and the goal lens shows no ring.
  //
  // WITHHELD GATE 2 of 4 (ROADMAP 1.267, prose leg — sweep 2026-07-27).
  // The crown is withheld AT SOURCE on a withheld run, not just where it is
  // read. `leaders.goal` below already nulled it for the lens ring, and that
  // gate's own comment states the rule — "null on EVERY lens when the verdict
  // withholds… a designation whatever it is derived from". But the SAME
  // argmax also selects the goal-attainment HEADLINE ("<option> is most
  // likely to meet every target this run scored.") and the `claimedRow` the
  // subline describes, and neither was gated: the ring went dark while the
  // sentence above it kept crowning the identical row. Gating the selection
  // rather than one of its three readers is the single change point — and it
  // removes the hand-maintained mirror in which each new reader has to
  // remember to re-apply the rule.
  //
  // ⭐ EXTRACTED 2026-08-01 (ROADMAP 2.233). The loop that used to sit here is
  // now `utils/selectGoalLeader.ts`, unchanged in behaviour except that the
  // completeness check is `Number.isFinite` rather than `!= null` (a NaN row
  // passed the old check while losing every comparison, so one NaN could let a
  // rival be crowned on an "complete" set). It moved because `buildV7Headline`
  // made the identical claim with NO rule at all and crowned the COMPARATIVE
  // leader on the goal metric — the second copy of a rule is where the defect
  // lives, so there is now one copy and both surfaces select through it.
  const goalLeaderRow: HeroRowVM | null = selectGoalLeader(
    rows,
    (r) => r.goal.value,
    { designationsWithheld, hasUserTarget },
  )

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
      ? HERO_COPY.headline.goalWithLimits(safeLabel(goalLeaderRow), goalLeaderRow.goal.readout)
      : HERO_COPY.headline.goalOnly(safeLabel(goalLeaderRow), goalLeaderRow.goal.readout)
  } else if (headlineRow) {
    // No goal basis: the leader claim names the canonical analysis leader
    // (recommendedOption — proven to equal the Results Panel/producer
    // leader), banded by the PRODUCER's headline_banded when present
    // (PLoT #200) or by the producer's win probabilities as the residual
    // UI-SEM-060 fallback. The banded claims are win-probability claims,
    // so they stay honest whether or not the leader also has the strongest
    // expected outcome; no band at all falls back to the unbanded
    // analysis claim.
    // `null` = NO OWNED CLAIM (ROADMAP 1.223). It used to fall through to
    // `analysisLeads` — "{label} currently leads the overall analysis." —
    // which is a leader claim, and exactly the sentence a withheld turn must
    // not produce. It now takes the neutral comparison headline: SILENCE, not
    // a denial. `noClearLeader` ("No option is clearly ahead.") is reserved
    // for `'none'`, where the producer positively said the options are close;
    // asserting it on a withheld turn would swap one unearned claim for
    // another. Same doctrine as `decisionVerdict`: 'unknown' licenses silence,
    // never a denial.
    headline =
      leaderBand === 'strong'
        ? HERO_COPY.headline.mostLikelyStrongest(
            safeLabel(headlineRow),
            // null, NOT the missing glyph: the sentence drops its magnitude
            // clause rather than printing '—' where a quantity should be.
            //
            // Read straight off the ROW. This used to come from a
            // `winReadoutById` side-table populated by a mutation inside the
            // row `.map()` — a second store of a value the row already
            // carries, written in one place and read in another, which is the
            // shape every drift defect in this file has taken.
            headlineRow.comparativeReadout ?? null,
          )
        : leaderBand === 'ahead'
          ? HERO_COPY.headline.slightlyAhead(safeLabel(headlineRow))
          : leaderBand === 'none'
            ? HERO_COPY.headline.noClearLeader
            : HERO_COPY.headline.noLeader
  } else if (
    outcomeAvailable &&
    outcomeLeaderRow &&
    !topOutcomesReadoutTied &&
    // WITHHELD GATE 3 of 4 (ROADMAP 1.267, prose leg — sweep 2026-07-27).
    // "<option> has the highest expected outcome." is a superlative naming a
    // single option; that it is derived from the outcome lens rather than
    // from the producer's leader field does not make it less of a
    // designation — the identical argument was made for the per-lens crown
    // and overturned at the screenshots (row 1.306). Withheld runs fall to
    // `noLeader` below: SILENCE, not a denial.
    !designationsWithheld
  ) {
    // No recommended option among the rows: headline the outcome fact
    // itself — but ONLY when the outcome lens is actually visible (centres
    // without ranges hide it, and the hero must not assert an
    // expected-outcome comparison it cannot show) AND the top-two readouts
    // differ (UI-SEM-070: identical readouts show no winner to crown — this
    // falls through to the neutral "here is how your options compare"
    // headline, with the "top options are close" subline below).
    headline = HERO_COPY.headline.outcomeLeader(
      safeLabel(outcomeLeaderRow),
      outcomeLeaderRow.outcome.readout,
    )
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
  if (bandedNoGoalClaim && (leaderBand === 'none' || leaderBand === null)) {
    // State C: no leader was claimed, so no divergence exists to state —
    // the companion line points at the comparison without risking a name.
    // `null` (no owned claim, ROADMAP 1.223) joins this branch: the tension
    // subline below names an option as having "the highest expected outcome",
    // which is comparative language derived from raw numbers, and on a
    // withheld turn it simply relocates the leader claim one line down.
    subline = HERO_COPY.subline.compareTop
  } else if (rows.length > 1 && outcomeAvailable && outcomeLeaderRow) {
    // The row the headline actually names: the goal-fit crown when one
    // exists (UI-SEM-072 — may differ from the recommendation), else the
    // analysis leader. The tension/aligned subline must describe the
    // headlined row, or it would state a divergence about an option the
    // headline never mentioned.
    const claimedRow = goalLeaderRow ?? headlineRow
    if (topOutcomesReadoutTied) {
      // UI-SEM-070: the top-two options render the SAME readout, so no outcome
      // winner is claimable in ANY branch — no-option-on-track, aligned or
      // diverged. A neutral plural line; naming a runner-up among tied values
      // would be arbitrary. This is the reported run: four "100" readouts.
      subline = HERO_COPY.subline.outcomesClose
    } else if (designationsWithheld) {
      // WITHHELD GATE 4 of 4 (ROADMAP 1.267, prose leg — sweep 2026-07-27).
      // THIS IS THE BRANCH THE SWEEP PHOTOGRAPHED. Every remaining branch in
      // this chain NAMES an option — `highestOutcome`, `closeOnOutcome`,
      // `aligned` — so the gate sits once, ahead of all of them, rather than
      // being repeated on each (a per-branch guard list is a mirror, and the
      // next branch added would silently miss it: that is exactly how this
      // defect happened).
      //
      // The state-C branch sixteen lines above ALREADY carries this rule in
      // its comment — "on a withheld turn it simply relocates the leader
      // claim one line down" — and takes `compareTop` for it. Its condition
      // reaches only the no-goal-basis case, so the two paths that bypass it
      // (`allGoalBelowFloor`, and a headlined leader) were left naming an
      // option. On the sweep's run the headline correctly said "No option is
      // currently on track…" and this chain answered "<option> has the
      // highest expected outcome." directly underneath.
      //
      // Same neutral line as the sibling, so no new voice is introduced. It
      // SUBSTITUTES rather than deletes: the sweep proved the surface
      // renders, so an empty subline would be its own regression.
      subline = HERO_COPY.subline.compareTop
    } else if (allGoalBelowFloor) {
      // No leader was claimed; the outcome fact is the one honest pointer.
      subline = HERO_COPY.subline.highestOutcome(
        safeLabel(outcomeLeaderRow),
        outcomeLeaderRow.outcome.readout,
      )
    } else if (claimedRow) {
      // Aligned case per band (producer band or UI-SEM-060 fallback —
      // whichever sourced leaderBand above): state B names the runner-up as
      // close ONLY when the expected-outcome gap is genuinely small (never
      // from range overlap); state A states the outcome fact plainly.
      // goalLeaderRow-headlined runs keep the plain aligned/divergence pair
      // — the goal claim is not an outcome claim. Diverged leaders keep the
      // persistent divergence line in every band. (The banded branches only
      // fire on bandedNoGoalClaim, which implies claimedRow === headlineRow.)
      const alignedLeaders = claimedRow.id === outcomeLeaderRow.id
      if (!alignedLeaders) {
        subline = HERO_COPY.subline.highestOutcome(
          safeLabel(outcomeLeaderRow),
          outcomeLeaderRow.outcome.readout,
        )
      } else if (
        bandedNoGoalClaim &&
        leaderBand === 'ahead' &&
        outcomeGapSmall &&
        outcomeRunnerUpRow
      ) {
        subline = HERO_COPY.subline.closeOnOutcome(safeLabel(outcomeRunnerUpRow))
      } else if (bandedNoGoalClaim && leaderBand === 'strong') {
        subline = HERO_COPY.subline.highestOutcome(safeLabel(claimedRow), claimedRow.outcome.readout)
      } else {
        subline = HERO_COPY.subline.aligned(safeLabel(claimedRow))
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
    let span = max - min
    // UI-SEM-054 (span floor): a spread that is tiny RELATIVE to the values
    // (the reported run: ~99.5..100.5 around 100) must not zoom the axis and
    // amplify sub-resolution noise into full-width dot separation. Floor the
    // span to OUTCOME_CLOSE_RATIO × the largest coordinate magnitude and
    // re-centre, so near-identical outcomes read as clustered dots — honest —
    // while a genuine spread wider than the floor is untouched. Layout only.
    const minSpan = Math.max(Math.abs(min), Math.abs(max)) * OUTCOME_CLOSE_RATIO
    if (span < minSpan) {
      const mid = (min + max) / 2
      min = mid - minSpan / 2
      max = mid + minSpan / 2
      span = minSpan
    }
    // 5% padding, matching RangeVisualization; a truly degenerate span (all
    // values zero) still gets a unit pad so positioning maths stays finite.
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

  // §6.5 quick evidence links — selection of existing producer-backed
  // values only. Main driver = the Drivers section's #1 (strongest effect
  // on the analysed outcome) when it can focus a canvas node; Top flip
  // risk = the fragile driver most likely to change which option leads
  // (highest switch_probability), gated by the SAME visibility floor as
  // the fragile-edge surfaces (UI-SEM-013, 0.15) so a negligible flip
  // risk never earns a summary link. Both labels glossary-gated like
  // mainReason; unfocusable or gated entries yield null, never a dead link.
  const topDriverItem = drivers?.topDrivers?.[0]
  const mainDriver =
    mainReason && cleanDriverLabel && topDriverItem?.canFocus
      ? {
          label: cleanDriverLabel,
          targetId: topDriverItem.matchedNodeId ?? topDriverItem.factorKey,
        }
      : null
  // ROADMAP 2.276 — the flip-risk quick link is chosen by `selectFlipRisk`,
  // never here. This block used to rank `fragileEdgeInfo.switchProbability`
  // alone and never consulted `flip_thresholds`, so on a turn whose thresholds
  // were 100 % non-flipping it still named a "Top flip risk" (witness §4b:
  // "Leeds Site Activation Effectiveness", `rank_flip_rate` 0). The owner
  // holds the honest-absence gate, the UI-SEM-013 floor and the attribution
  // rule; adding a second chooser here is what produced the two-statements-
  // disagree defect in the first place.
  const flipSelection = selectFlipRisk(
    recommendation.flipThresholds,
    (drivers?.drivers ?? [])
      .filter((d) => d.canFocus)
      .map((d) => ({
        label: stripEncodingNotation(d.factorLabel),
        switchProbability: d.fragileEdgeInfo?.switchProbability,
        targetId: d.matchedNodeId ?? d.factorKey,
        joinId: d.matchedNodeId ?? d.factorKey,
      })),
  )
  const flipLabel = flipSelection.topFlipRisk?.label ?? null
  const topFlipRisk =
    flipSelection.topFlipRisk && flipLabel && !containsBannedTerm(flipLabel)
      ? {
          label: flipLabel,
          targetId: flipSelection.topFlipRisk.targetId ?? '',
        }
      : null

  // §6.6 evidence disclosure — selection/format of existing producer
  // values only. Drivers: the section's own rank order, glossary-gated
  // labels, focus target only when the item can focus (no dead rows).
  // Evidence-quality wording is deliberately ABSENT live: an evidence
  // claim derived from raw confidence fields is forbidden (same class as
  // the hidden DriversSection quality hint / trust line, issues 219/221).
  const evidenceDrivers = (drivers?.drivers ?? [])
    .map((d) => {
      const label = stripEncodingNotation(d.factorLabel)
      // UI-SEM-080 (data selection half): the magnitude bar renders the SAME
      // displayed influence metric DriversSection's bar consumes
      // (displayInfluence ?? influenceScore ?? normalisedInfluence — Codex
      // R3-B1 resolves displayInfluence upstream under the complete-metric-
      // set policy). Selection of an existing value only; the % width
      // mapping lives in the disclosure component. Null hides the bar.
      const influenceValue =
        d.displayInfluence ?? d.influenceScore ?? d.normalisedInfluence
      return label && !containsBannedTerm(label)
        ? {
            rank: d.rank,
            label,
            targetId: d.canFocus ? d.matchedNodeId ?? d.factorKey : null,
            // Producer-normalised direction, passed through; absent stays
            // absent (the sign glyph is omitted, never guessed).
            //
            // ROADMAP 2.234: `DriverItem.direction` now carries the producer's
            // FULL domain, so the narrowing happens HERE — at the boundary of a
            // render model that can only draw two states. `isDirectionalFactor`
            // is the shared gate: `'mixed'` and `'unknown'` are PRESENT values
            // that still forbid a directional glyph, so `!= null` is the wrong
            // question and this is the right one.
            direction: isDirectionalFactor(d.direction) ? d.direction : null,
            influence: typeof influenceValue === 'number' && Number.isFinite(influenceValue)
              ? influenceValue
              : null,
          }
        : null
    })
    .filter((d): d is NonNullable<typeof d> => d != null)

  // Producer switch probabilities for the flip-risk rows, joined by node id
  // to the SAME fragileEdgeInfo values the top-flip-risk quick link ranks by.
  // Selection/format of existing values only; rows without a joinable value
  // render without the meta or bar (never a fabricated probability).
  const switchProbByNodeId = new Map<string, number>()
  for (const d of drivers?.drivers ?? []) {
    const p = d.fragileEdgeInfo?.switchProbability
    if (typeof p !== 'number') continue
    for (const key of [d.matchedNodeId, d.factorKey]) {
      if (key && !switchProbByNodeId.has(key)) switchProbByNodeId.set(key, p)
    }
  }

  // Flip risks: producer flipThresholds → plain-language consequences.
  // UI-SEM-074: direction wording derived from producer values (flip_value
  // vs current_value). Only a strict inequality earns a direction; equality
  // (and therefore also the upstream missing-current_value→0 default when
  // flip_value is 0) falls back to the direction-neutral "crosses" wording
  // the detail line already uses. The unit is the producer's user unit via
  // the module formatFlipValue (one threshold must never render two ways in
  // one panel); undetermined thresholds (flip_value null) have nothing
  // displayable and are skipped. Normalised internals never surface.
  const evidenceFlipRisks = (recommendation.flipThresholds ?? [])
    .map((ft) => {
      if (ft.flip_value == null) return null
      const label = stripEncodingNotation(ft.label)
      if (!label || containsBannedTerm(label)) return null
      // UI-SEM-074 (Codex B3 tightened): a direction claim needs BOTH values —
      // with no producer baseline the direction is unknowable, so the
      // neutral 'crosses' wording is the only honest option. The rule lives
      // in the shared `flipThresholdDisplay` module (2.291) so the V7 chip
      // cannot state a different direction for the same row.
      const direction = flipDirectionWording(ft.current_value, ft.flip_value)
      const value = formatFlipValue(ft.flip_value, ft.unit)
      const alt = ft.alternative_winner_label
        ? stripEncodingNotation(ft.alternative_winner_label)
        : null
      // ROADMAP 1.267: the flip VALUE, its unit, its direction and the
      // producer's alternative-winner label all survive on a withheld run —
      // only the leader framing around them changes.
      const text =
        alt && !containsBannedTerm(alt)
          ? HERO_COPY.evidence.flipRiskWithAlternative(
              label,
              direction,
              value,
              alt,
              designationsWithheld,
            )
          : HERO_COPY.evidence.flipRiskNoAlternative(
              label,
              direction,
              value,
              designationsWithheld,
            )
      // Fail-closed focus pre-gate: with canvas knowledge supplied, a
      // node_id absent from the canvas yields a text row, not a dead button.
      const rawTarget = ft.node_id || null
      const targetId =
        rawTarget && canvasNodeIds != null && !canvasNodeIds.has(rawTarget)
          ? null
          : rawTarget
      // Switch-probability meta + magnitude joined from the fragile-edge
      // values (existing producer data); absent join → no meta, no bar.
      const switchProb = rawTarget != null ? switchProbByNodeId.get(rawTarget) : undefined
      return {
        text,
        targetId,
        switchMeta:
          switchProb != null
            ? HERO_COPY.evidence.switchMeta(formatPercent(switchProb, { fromDecimal: true }))
            : null,
        magnitude: switchProb ?? null,
      }
    })
    .filter((r): r is NonNullable<typeof r> => r != null)

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
    designationsWithheld,
    leaders: {
      // Goal-fit highlight = the goalProbability argmax (UI-SEM-072), the
      // same row the goal-fit headline crowns — never the recommendation
      // re-crowned onto this view. Null when no crown is honest (missing
      // fits, tie at the max, sub-1% floor, no user target).
      //
      // ROADMAP 1.267 — and null on EVERY lens when the verdict withholds.
      // `heroCopy.srLeader` used to argue the per-lens crown was exempt
      // because it marks "the highest row on the lens in view" rather than
      // the producer's leader. Row 1.306 overturns that at the screenshots:
      // an argmax rendered as a filled badge, an emphasised readout,
      // `aria-current` and a spoken "(Highest on this view)" is a
      // designation whatever it is derived from, and it reached screen
      // readers on the same screen as CEE's "no option can be put forward
      // yet". Suppressing it here is one change point for all four cues.
      goal: designationsWithheld ? null : goalLeaderRow?.id ?? null,
      outcome: designationsWithheld ? null : outcomeLeaderId,
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
    quickLinks: { mainDriver, topFlipRisk },
    // Trade-offs require a grounded producer or reviewed narrative — the
    // live adapter has none (producer gap), so the slot is null and the
    // view exists only in gallery fixtures. The UI must not invent
    // trade-offs from labels.
    evidence: {
      drivers: evidenceDrivers,
      flipRisks: evidenceFlipRisks,
      tradeOffs: null,
      designationsWithheld,
    },
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
