/**
 * Analysis (New) — THE adapter. One mapping site, so the IA can be re-tuned in
 * one file and so no component ever reinterprets a raw analysis field.
 *
 * ⭐ IT SELECTS, RANKS, GROUPS AND FORMATS. IT DOES NOT COMPUTE.
 * Every value it emits is either (a) a producer field carried verbatim,
 * (b) a producer field formatted for display, or (c) a selection among producer
 * fields. There is no arithmetic here that constitutes a finding, and no
 * sentence about the user's situation that the producer did not supply.
 *
 * ── THE SEMANTIC RULES THIS FILE IS ANSWERABLE FOR ──────────────────────────
 *  1. LEADER ENTITLEMENT. Nothing may name or presuppose a leading option
 *     unless `recommendation.verdict.hasLeadingOption === true`. A completed
 *     analysis is not an entitlement. Comparative copy is "currently scores
 *     higher", never "wins".
 *  2. INFLUENCE IS NOT A CAUSAL SHARE. `displayProvenance` decides: only
 *     `'influence_score'` is an absolute producer scale; `'normalised_elasticity'`
 *     means "largest in this set" and must carry the caveat.
 *  3. ROBUSTNESS. The display-safe verdict is `robustnessVerdict` (+ its
 *     producer-authored reason, rendered VERBATIM). `robustnessLevel` is
 *     structured data and never drives the headline.
 *  4. ABSENCE IS NOT ZERO. A null confidence suppresses the sentence; it never
 *     prints 0. `evidenceGapsAssessed` separates "assessed, none found" from
 *     "never assessed".
 *  5. COVERAGE IS NOT READINESS. Nothing here reads or speaks for
 *     `RunAdmission`. Incomplete coverage is disclosed as provenance.
 *  6. NO EVPI IN PERCENTAGE POINTS, EVER. `evpi_percentage_points` is refuted
 *     upstream (tests/contracts/no-evpi-display.contract.test.ts). Whole-
 *     decision VOI crosses this boundary as a VERDICT only, never a number.
 *  7. NO WITHHELD-FIELD READS. `recommendation_stability` and
 *     `ranking_stability` are never read here. PLoT withholds the first (ISL
 *     derives it as the leader's win probability RELABELLED — "zero independent
 *     information") and never emitted the second. Rendering either produces a
 *     fabricated SECOND statistic beside the honest one.
 *     `__tests__/withheldFieldReadBan.spec.ts` enforces this estate-wide and
 *     caught exactly that here before it shipped.
 */

import { truncateAtWordBoundary } from '../../../utils/text'
import {
  ASSUMED_STRENGTH_TITLE,
  assumedStrengthAsk,
  assumedStrengthLead,
  assumedStrengthOthers,
  assumedStrengthWhy,
} from '../strengthElicitation/assumedStrengthCopy'
import { formatProbabilityWithResolution } from '../../../utils/formatPercent'
import { driverValueProvenance } from '../driverValueProvenance'
import type { Recommendation } from '../strengthen/strengthenTypes'
import { deriveComparisonScope } from '../utils/goalAnchorCopy'
import { notAnalysedReasonCopy, notComputedReasonCopy } from '../utils/notAnalysedCopy'
import { optionComputationFailed } from '../utils/notAnalysedOptions'
// The two existing warning surfaces' OWN selectors, imported rather than
// respelled. A second copy of either predicate is a mirror that drifts silently
// (CLAUDE.md trap 12), and the drift here would be a warning going quiet.
import { selectRenderableCritiqueEntries } from '../CritiqueWarningStrip'
import {
  isStripEntry,
  selectHumanisedInferenceWarningsOutsideStrip,
} from '../utils/humaniseInferenceWarning'
import type {
  ConditionalWinner,
  DriverItem,
  EvidenceGapItem,
  OptionResult,
  UncertaintyItem,
} from '../types'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
// ⚠ IMPORTED FROM ITS OWNER, NEVER RESTATED. `resolveNextCopy.ts` is "the ONE
// spelling of the Resolve next register" by its own header; a second copy in
// this surface's deck would be the mirror that drifts silently (trap 12).
import { RESOLVE_NEXT_COPY as RESOLVE_NEXT } from '../voi/resolveNextCopy'
import type { VoiRanking } from '../voi/voiRanking'
import { buildHeroModel } from '../analysis-hero/buildHeroModel'
import { HERO_COPY } from '../analysis-hero/heroCopy'
import { safeInterpolatedLabel } from '../utils/glossaryCheck'
import { ANALYSIS_NEW_COPY as COPY } from './analysisNewCopy'
import type {
  AnalysisNewFinding,
  AnalysisNewStatus,
  AnalysisNewViewModel,
  ContextualIntervention,
  InspectRow,
  ScienceGrounding,
  AtAGlance,
  GlanceCondition,
  GlanceDriver,
  GlanceInputProvenance,
  GlanceVerdict,
  GlanceComparisonScope,
  GlanceComparativeClaim,
  ComparisonOption,
  OptionsComparisonSection,
  ImplicationClaim,
  ModelImplication,
} from './analysisNewTypes'

/**
 * §2 of the brief: "a very small number of high-value insights".
 *
 * ⚠⚠ `KEY_INSIGHT_CAP = 4` WAS DELETED HERE, AND IT WAS A DATA CAP OF EXACTLY
 * THE KIND `STRENGTHEN_PREVIEW` BELOW RECORDS FIXING. That commit's rationale
 * named Key insights as one of the sections that "do the opposite" — a
 * component preview over a full list, each therefore carrying a "Show N more".
 * It was not true of this one: `usable.slice(0, KEY_INSIGHT_CAP)` sliced the
 * DATA, so the component never received the rest and could not offer them.
 *
 * It was latent rather than live while exactly four branches could push, which
 * is why nothing caught it — `slice(0, 4)` over at most four candidates is a
 * no-op, and the "cap disclosed" test passed by asserting a bound the code
 * could not reach. Emitting every conditional winner (below) makes the list
 * unbounded and would have made the silent truncation live.
 *
 * The preview length that governs this section is `KEY_INSIGHT_PREVIEW`, and it
 * is already applied at the mount where the remainder can be reached.
 */
/**
 * §2: "1–3 prioritised reasoning interventions" — which is a statement about
 * what is PROMINENT, not about what exists.
 *
 * ⚠ IT WAS A DATA CAP UNTIL NOW, AND THAT MADE THE SECTION LIE BY OMISSION.
 * Slicing here meant the component never received the rest, so it could not
 * offer them however it wished: on a measured staging run the engine emitted
 * EIGHT active recommendations and five were unreachable — not collapsed, not
 * summarised, absent. Every sibling section does the opposite
 * (`KEY_INSIGHT_PREVIEW`, `DRIVER_PREVIEW`, `UNCERTAINTY_PREVIEW` are all
 * component previews over a full list) and each therefore carries a "Show N
 * more". Strengthen is the section the experiment exists to test, and it was
 * the only one that hid its tail.
 *
 * The name now says which question it answers (trap 21): this is a PREVIEW
 * length applied at the mount, never a bound on the engine's output.
 */
const STRENGTHEN_PREVIEW = 3
/** Level-1 rows before "Show more". */
const KEY_INSIGHT_PREVIEW = 3
const DRIVER_PREVIEW = 3
const UNCERTAINTY_PREVIEW = 3
/** Driver rows in the glance. Three is the existing `topDrivers` convention. */
const GLANCE_DRIVER_COUNT = 3

export interface AnalysisNewViewModelInputs {
  data: ResultsSectionDataReturn
  /** Engine output, already lifecycle-filtered by the hook. */
  recommendations: Recommendation[]
  isPreRun: boolean
  isRunning: boolean
  /** The displayed report predates the current model (freshness only). */
  isStale: boolean
  /**
   * Why the report may not match the model. Threaded from the dock's freshness
   * verdict; absent means we could not establish it, which is `unconfirmed`.
   */
  staleReason?: 'changed' | 'unconfirmed' | null
  /** Monte Carlo sample count, when the producer disclosed one. */
  nSamples?: number
  /** Deterministic seed, when disclosed. */
  seedUsed?: number | string
  /** Response hash — the run identity both tabs share. */
  responseHash?: string
  /**
   * Producer DSK attestation keyed by recommendation id, joined by the hook.
   * Sparse: an absent key means the producer attested nothing. Never defaulted.
   */
  scienceGrounding?: Record<string, ScienceGrounding>
  /**
   * Node id -> `observed_state.source`, built by the store-aware hook. THE
   * authorship authority: the analysis result does not carry `observed_state`
   * at all, so this is the only field that can say who put a value on a factor.
   * Absent (older callers/tests) every row reads `undetermined`, the glance
   * says its basis was never established, and no claim is made either way.
   */
  nodeValueSources?: ReadonlyMap<string, string>
}

// ── formatting helpers (display only — none of these decide anything) ────────

const pct = (v: number): string => `${Math.round(v * 100)}%`

/** Absence-safe percentage. `null`/`undefined` yields null, NEVER "0%". */
const pctOrNull = (v: number | null | undefined): string | null =>
  typeof v === 'number' && Number.isFinite(v) ? pct(v) : null

/** A 0-100 confidence, absence-safe. Rule 4: absence suppresses, never zeroes. */
const conf100OrNull = (v: number | null | undefined): string | null =>
  typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v)}%` : null

/**
 * A THRESHOLD VALUE, at the precision the producer licenses.
 *
 * ⚠⚠ THE PRODUCER LICENSES NONE, AND THAT IS THE WHOLE JUSTIFICATION.
 * `split_value` (`EnrichmentConditionalWinnerSchema`) and `flip_value`
 * (`EnrichmentFlipThresholdSchema`) are both bare `z.number()` — no declared
 * precision, no scale, no significant-figure count. They are Monte Carlo
 * quantities, so their trailing digits are estimator noise; printing them is a
 * resolution claim the producer never made. This surface has now shipped that
 * defect TWICE, once per field: `Customer demand passes 0.361111%` (#909
 * review) and `Above 0.3007492161730507, …` (the 28 Aug independent audit).
 * ⭐ ONE RULE, ONE HELPER — the second occurrence happened because the first
 * fix lived inside `glanceCondition` where the sibling site could not reach it.
 *
 * Two decimals is not taste: three independent consumers of the SAME producer
 * fields already display them at two or fewer (`model-tab/OptionsSection.tsx`
 * via `formatSmartNumber`, `ConditionalWinnerCards.tsx` via `toLocaleString`,
 * and `glanceCondition` here).
 *
 * ⚠ AND IT NEVER INVENTS: `Math.round(x*100)/100` through `String` leaves a
 * whole number whole, so "passes 3%" never becomes the fabricated "passes
 * 3.00%".
 *
 * ⚠⚠ ROUNDING MAY DROP PRECISION; IT MAY NEVER CHANGE THE CLAIM. A bare
 * `z.number()` admits magnitudes below the rounding step, and `Math.round` maps
 * them to `0` — turning "the ordering changes at 0.0004" into "the ordering
 * changes at zero", which is a different, actionable, false statement. Written
 * against the CONTRACT rather than against the value in hand (trap 13d): below
 * the step, fall back to significant figures.
 */
const formatThresholdValue = (n: number): string => {
  const rounded = Math.round(n * 100) / 100
  if (rounded !== 0 || n === 0) return String(rounded)
  const sig = n.toPrecision(2)
  // An exponent-form string has no trailing zeros to strip and stripping would
  // corrupt it, so it is returned as the engine produced it.
  return sig.includes('e') ? sig : sig.replace(/0+$/, '').replace(/\.$/, '')
}

const rows = (...maybe: Array<InspectRow | null>): InspectRow[] =>
  maybe.filter((r): r is InspectRow => r !== null)

const row = (label: string, value: string | null | undefined): InspectRow | null =>
  value == null || value === '' ? null : { label, value }

/**
 * Prefer the producer's humanised text over its raw one.
 *
 * ⚠ ORDER MATTERS AND IS NOT ARBITRARY: `displayText` is the data layer's
 * pre-sanitised render-safe string (it has already passed the internal-token
 * guard), `userMessage` is PLoT's humanised copy, `message` is the raw code-ish
 * fallback. Reaching past a sanitised string to a raw one is how internal
 * tokens reach a user.
 */
const humanised = (u: UncertaintyItem): string => u.displayText || u.userMessage || u.message

/**
 * Join an engine recommendation to a finding, by TARGET IDENTITY.
 *
 * ⚠ BINDS BY ID, NEVER BY A VALUE PREDICATE (CLAUDE.md trap 19). An earlier
 * shape matched on label text, and two factors sharing a label would each have
 * claimed the other's intervention. `targetId` is the join or there is none.
 */
function interventionFor(
  recommendations: Recommendation[],
  targetId: string | undefined,
): ContextualIntervention | undefined {
  if (!targetId) return undefined
  const rec = recommendations.find((r) => r.targetId === targetId)
  if (!rec) return undefined
  return { recommendationId: rec.id, label: rec.action.label, targetId: rec.targetId }
}

// ── KEY INSIGHTS ────────────────────────────────────────────────────────────

/**
 * Candidate insights, most-consequential first.
 *
 * ⚠ THE ORDER OF THE PUSHES IS THE PRIORITY LADDER, and it is deliberately NOT
 * decision-first. A robustness verdict, a strategic tension and a concentration
 * risk all outrank "which option scores higher", because a decision may not
 * exist in the scenario at all — and when it does not, a decision-first ladder
 * produces an empty section for a perfectly well-analysed problem.
 */
function buildKeyInsights(
  data: ResultsSectionDataReturn,
  recommendations: Recommendation[],
  isStale: boolean,
): { insights: AnalysisNewFinding[]; candidateCount: number } {
  const rec = data.recommendation
  const conf = data.confidence
  const out: AnalysisNewFinding[] = []
  const staleMarker = isStale ? ('stale' as const) : undefined

  // 1. The producer's own executive statement, when it sent one. Verbatim.
  //    This is M1 coaching — deterministic, not LLM-generated.
  if (rec.coachingDecisionStatement || rec.coachingHeadline) {
    out.push({
      id: 'insight:executive-summary',
      headline: rec.coachingHeadline || 'What this run found',
      implication: rec.coachingDecisionStatement || rec.coachingParagraph || '',
      detail: rec.coachingKeyQualifier || undefined,
      groundedIn: 'the analysis executive summary',
      marker: staleMarker,
      inspect: rows(
        row('Action implication', rec.coachingActionImplication),
        row('Readiness', rec.coachingReadiness),
      ),
    })
  }

  // 2. ⛔ ROBUSTNESS AND THE COMPARATIVE READ ARE NOT INSIGHTS ANY MORE.
  //    "At a glance" renders both, under EXACTLY the conditions these branches
  //    used to fire on — so once the glance shipped they were unreachable, and
  //    on a real run all three key insights turned out to be restatements of
  //    the glance one viewport above. Rather than keep two representations and
  //    suppress one, the glance is simply the single surface: it states the
  //    verdict WITH the producer's own reason, and the leader sentence with the
  //    same entitlement gate. `ROBUSTNESS_HEADLINE`'s four-way mapping moved to
  //    `VERDICT_WORD` there. Deleting these here is what keeps "one signal, one
  //    primary surface" true in the code rather than only in a filter.

  // 3. Strategic tensions: the leading option DEPENDS on a factor's value.
  //    A genuine "it depends" finding, and the most reasoning-shaped thing the
  //    producer emits. Neutral arm when the winner identity was withheld.
  //
  // ⚠⚠ EVERY ROW, NOT `[0]` — AND THE LOSS WAS UNDISCLOSED. `conditionalWinners`
  // is an UNBOUNDED producer array: `useResultsSectionData.ts:3620` maps one row
  // per surviving `conditional_winners` entry, so a run whose answer turns on
  // three factors emitted three rows and this surface rendered the first. The
  // other two were not collapsed and not summarised — absent, with nothing on
  // screen saying so. That is the same omission `STRENGTHEN_PREVIEW`'s header
  // records, in the section that carries the most reasoning-shaped finding the
  // producer sends: "what does this depend on" is a question a team debates, and
  // it had exactly one answer however many the run found.
  //
  // ⚠ THE ATTESTATION GATE IS PART OF EMITTING MORE THAN ONE, NOT A SEPARATE
  // TIDY-UP. `winner_flips` is the producer's statement that the winning option
  // CHANGES across the split (`types.ts:891-899` — "says THAT the winner
  // changes, never WHICH option"), and "The answer turns on X" is precisely that
  // claim. An explicit `false` denies it, so such a row is dropped rather than
  // headlined — the read `analysisSnapshotFactory.ts:285` and the Compare tab's
  // D7 already make of the same field. Taking `[0]` risked this claim once;
  // taking every row would have multiplied it.
  //
  // ⚠ ABSENT IS NOT `false`, AND THE DIVERGENCE FROM THOSE TWO CALLERS IS
  // DELIBERATE. They require `=== true`; this requires `!== false`. The field is
  // optional on `ConditionalWinner`, older payloads omit it, and the producer
  // still sent a split — so absence keeps the row and the two existing arms
  // (named / neutral) go on deciding the sentence, exactly as they do today.
  // Requiring `true` would delete a finding on payloads that currently show one.
  //
  // ⚠ DEDUPED BY `factor_id`, FIRST WINS, IN WIRE ORDER. Nothing in the producer
  // loop stops a repeated `factor_id`, and that id IS this finding's identity —
  // two rows would collide on `key={f.id}`, the defect `uncertaintyKey`'s header
  // below documents at length. Two different splits for one factor contradict
  // each other anyway; the producer's first is kept.
  const conditionalWinners: ConditionalWinner[] = conf.conditionalWinners ?? []
  const seenConditionalFactors = new Set<string>()
  for (const cw of conditionalWinners) {
    if (cw.winner_flips === false) continue
    if (seenConditionalFactors.has(cw.factor_id)) continue
    seenConditionalFactors.add(cw.factor_id)
    const high = cw.high_bucket?.winner_label
    const low = cw.low_bucket?.winner_label
    const namesBoth = Boolean(high && low && high !== low)
    // ⚠ THE SPLIT IS A THRESHOLD, AND IT WAS PRINTED RAW AT ALL THREE SITES
    // BELOW — sixteen significant figures on the deployed build `a9fc1564`,
    // found by the 28 Aug independent audit. See `formatThresholdValue`.
    const splitValue = formatThresholdValue(cw.split_value)
    out.push({
      id: `insight:conditional-winner:${cw.factor_id}`,
      headline: `The answer turns on ${cw.factor_label}`,
      implication: namesBoth
        ? `Above ${splitValue}${cw.split_unit ? ` ${cw.split_unit}` : ''}, ${high} scores higher; below it, ${low} does.`
        : `The preferred direction changes around ${splitValue}${cw.split_unit ? ` ${cw.split_unit}` : ''}.`,
      groundedIn: 'the conditional-winner split from the simulation',
      marker: staleMarker,
      targetId: cw.factor_id,
      inspect: rows(row('Split value', splitValue), row('Factor', cw.factor_label)),
      intervention: interventionFor(recommendations, cw.factor_id),
    })
  }

  // 4. Concentration: one factor carries most of the influence. A structural
  //    finding about the MODEL, not about a decision.
  if (rec.dominantFactorLabel) {
    out.push({
      id: 'insight:dominant-factor',
      headline: `${rec.dominantFactorLabel} dominates the model`,
      implication:
        'One factor carries most of the influence here, so the conclusion largely rests on it being right.',
      groundedIn: 'the influence concentration check',
      marker: staleMarker,
      targetId: rec.dominantFactorId,
      inspect: [],
      intervention: interventionFor(recommendations, rec.dominantFactorId),
    })
  }

  // 5. The relationship most able to change the answer.
  const hinge = conf.m1CoachingTopFragileEdge ?? conf.topFragileEdge
  if (hinge && typeof hinge.switchProbability === 'number') {
    out.push({
      id: 'insight:hinge',
      headline: `${hinge.fromLabel} is the hinge`,
      implication: `Its effect on ${hinge.toLabel} is the relationship most able to change the outcome.`,
      groundedIn: 'the fragile-relationship analysis',
      marker: staleMarker,
      targetId: hinge.fromId,
      inspect: rows(row('Chance the result flips', pctOrNull(hinge.switchProbability))),
      intervention: interventionFor(recommendations, hinge.fromId),
    })
  }

  // 6. ⛔ THE COMPARATIVE READ IS NOT AN INSIGHT EITHER — the glance states it,
  //    and its most informative part (the win share) now rides the glance's own
  //    trust line rather than a duplicate card a viewport below. Nothing was
  //    lost: `winShare` in `buildAtAGlance` is the same `winProbability`, on the
  //    same entitlement gate, with the same "never says wins" vocabulary.

  // Insights with no implication sentence say nothing — drop rather than
  // render a headline with an empty body.
  //
  // ⚠ THE WHOLE ORDERED LIST LEAVES HERE. The preview is applied at the mount
  // (`KEY_INSIGHT_PREVIEW`), where the section can disclose and REACH its own
  // tail; slicing here would put the remainder somewhere the component cannot
  // offer it. `candidateCount` is what the RUN produced, before the glance
  // deduplication below removes anything already on screen.
  const usable = out.filter((i) => i.implication.trim().length > 0 || i.detail)
  return { insights: usable, candidateCount: usable.length }
}

// ── DRIVERS AND DYNAMICS ────────────────────────────────────────────────────

function driverFinding(
  d: DriverItem,
  setRelative: boolean,
  recommendations: Recommendation[],
): AnalysisNewFinding {
  const target = d.matchedNodeId ?? d.factorKey
  // ⚠⚠ NO FALLBACK OFF `displayInfluence`, AND THE CONTRACT SAYS SO IN TERMS.
  // `types.ts:638-644`: "Consumers must render/sort this, not
  // `influenceScore ?? normalisedInfluence`, which mixes bases under partial
  // producer coverage." The old chain did exactly the banned thing — an absolute
  // producer score and a set-relative elasticity through one `pct()` as if they
  // were one quantity. The live pipeline always sets `displayInfluence`; the
  // chain existed for legacy fixtures, and a fixture must not dictate production
  // semantics. Absent, the honest render is no number (rule 4).
  const influence = d.displayInfluence
  // ⚠ THE PRODUCER'S DOMAIN IS `positive | negative | mixed | unknown`, and the
  // last two are NOT a direction. `'moves'` is the honest verb for them: a
  // factor whose direction the producer declined to resolve must not be
  // rendered as raising or lowering anything. (An earlier draft compared
  // against `'increase'`/`'decrease'` — tokens that do not exist in this union
  // — so every row silently fell through to the neutral arm and the two real
  // directions were never rendered at all. The typecheck gate caught it.)
  const directionWord =
    d.direction === 'positive' ? 'raises' : d.direction === 'negative' ? 'lowers' : 'moves'

  return {
    id: `driver:${d.factorKey}`,
    headline: d.factorLabel,
    // ⚠ Rule 2. Under a set-relative basis this says "among the strongest in
    // this run" — a RANK claim. It never says "drives N% of the outcome",
    // which would be an absolute causal share the basis does not license.
    implication: setRelative || influence == null
      ? `Among the strongest influences in this run; ${directionWord} the outcome.`
      : `Structural influence ${pct(influence)}; ${directionWord} the outcome.`,
    detail:
      d.fragileEdgeInfo?.switchProbability != null
        ? `This relationship is one the result is sensitive to.`
        : undefined,
    groundedIn: setRelative
      ? 'factor sensitivity, ranked within this run'
      : 'the producer influence score',
    // A defaulted confidence is a placeholder, not a measurement — say so
    // rather than rendering it as evidence.
    marker: d.isDefaultedConfidence ? 'not_assessed' : undefined,
    targetId: d.canFocus ? target : undefined,
    inspect: rows(
      row('Influence', pctOrNull(influence)),
      row('Rank', d.influenceRank != null ? String(d.influenceRank) : String(d.rank)),
      row('Basis', d.displayProvenance === 'influence_score' ? 'producer influence score' : 'ranked within this run'),
      // Absence-safe: a defaulted or absent confidence prints nothing.
      row('Confidence', d.isDefaultedConfidence ? null : pctOrNull(d.confidence)),
      row('Attribution stability', d.attributionStability),
      // ⚠ HOW STABLE IS THE RANK WE JUST SHOWED? `rank_flip_rate` is ISL's own
      // bootstrap answer — "fraction of bootstrap samples where this factor's
      // rank flips" (`types.ts:692`) — and it reached NO surface on this tab
      // while the row above it prints that very rank as a fact. A team reading
      // an ordered list of drivers is entitled to the producer's measure of
      // whether the order holds. Absence-safe: `pctOrNull` prints nothing for a
      // producer that did not send it, and a genuine 0 is a real result.
      row('Chance the rank flips', pctOrNull(d.rankFlipRate)),
      // ⚠ SOMEONE ON THE TEAM DISPUTED THE EVIDENCE FOR THIS FACTOR. Derived by
      // the hook from the canvas edges' own `validation.status === 'contested'`
      // (`useResultsSectionData.ts:2661`), so it is a fact about the shared
      // model, not a claim about the run. Its only other consumer is gated off
      // behind `DISPLAY_SAFE_DRIVER_CONFIDENCE`, so a recorded disagreement
      // currently reaches no screen at all — on the surface whose whole purpose
      // is a team's shared reasoning.
      //
      // ⚠ ONLY `true` RENDERS. `false` is "no contested edge found", which is
      // not a finding, and printing it would fill every row with a negative.
      row('Contested evidence', d.hasContestedEdge === true ? 'yes' : null),
      row('Chance the result flips', pctOrNull(d.fragileEdgeInfo?.switchProbability)),
    ),
    intervention: interventionFor(recommendations, target),
  }
}

function buildDrivers(
  data: ResultsSectionDataReturn,
  recommendations: Recommendation[],
): AnalysisNewViewModel['drivers'] {
  const drivers = data.drivers.drivers ?? []
  // Rule 2: the basis is the PRODUCER's token, not the adapter's taste. Any
  // row on a set-relative basis makes the whole list set-relative — mixing
  // bases in one list is the defect the token exists to prevent.
  const influenceIsSetRelative =
    drivers.length > 0 && drivers.some((d) => d.displayProvenance !== 'influence_score')

  // ⚠⚠ THE ROWS DROPPED HERE ARE NOT NOTHING, AND SAYING THEY WERE WAS A LIVE
  // FALSEHOOD. A row carrying `zeroReason` is a row the PRODUCER measured and
  // scored at zero (`types.ts` — the codes "explain why influence is ZERO").
  // Filtering them is right — a zero-influence factor is not a driver — but
  // the count has to survive the filter, because the empty state below it has
  // to tell "we measured, and it was zero" apart from "we got nothing", and an
  // empty `findings` array cannot.
  const suppressedZero = drivers.filter((d) => d.zeroReason != null)
  const findings = drivers
    .filter((d) => d.zeroReason == null)
    .map((d) => driverFinding(d, influenceIsSetRelative, recommendations))

  return {
    findings,
    influenceIsSetRelative,
    referenceOptionLabel: data.sensitivityReference?.optionLabel ?? null,
    totalCount: findings.length,
    // Passed through, never re-derived: the producer's word for whether driver
    // analysis happened at all.
    driversStatus: data.drivers.driversStatus,
    suppressedZeroCount: suppressedZero.length,
  }
}

// ── UNCERTAINTY AND GAPS ────────────────────────────────────────────────────

function evidenceGapFinding(
  g: EvidenceGapItem,
  recommendations: Recommendation[],
): AnalysisNewFinding {
  const target = g.targetNodeId ?? g.factorId
  return {
    id: `gap:${g.factorId}`,
    headline: `${g.factorLabel} is weakly evidenced`,
    // Producer-authored suggestion, verbatim.
    implication: g.suggestion,
    groundedIn: 'the evidence-gap assessment',
    // Rule 4: a null confidence is "we were not told", not "zero".
    marker: g.confidence == null ? 'not_assessed' : undefined,
    targetId: target,
    inspect: rows(
      row('Confidence', conf100OrNull(g.confidence)),
      // ⛔ evpi_percentage_points is never rendered — refuted upstream.
      row('Expected value of perfect information', g.evpi != null ? String(g.evpi) : null),
    ),
    intervention: interventionFor(recommendations, target),
  }
}

/**
 * The producer's VALUE-OF-INFORMATION RANKING, as one finding.
 *
 * ⭐⭐ WHY THIS EXISTS: THE SECTION NAMED WHAT WAS UNCERTAIN AND NEVER WHICH
 * UNCERTAINTY WAS WORTH RESOLVING — while the run's own answer sat in the
 * browser. `data.voiRanking` is ISL's Strong–Oakley regression EVPPI, read by
 * `voi/voiRanking.ts`, and on this surface it reached exactly two places: a
 * COUNT (`String(resolved.length)`) and a `'yes'`, both level-3 inspect rows
 * inside `Deeper analysis and evidence` — a different section, three levels
 * down, stripped of the ordering that is the only thing the estimator licenses
 * us to show. The EXISTING Analysis tab renders it as a first-class view
 * (`analysis-hero/HeroEvidenceDisclosure.tsx`), so the tab meant to replace
 * that one was the weaker of the two on the most actionable thing in the
 * payload.
 *
 * ⚠ EVERY SENTENCE HERE IS `RESOLVE_NEXT_COPY`, IMPORTED FROM ITS OWNER AND
 * RENDERED VERBATIM. That module's header says why in terms: it is "the ONE
 * spelling of the Resolve next register", and copying its sentences into this
 * surface's own deck would be the hand-maintained mirror (CLAUDE.md trap 12)
 * with SILENT drift — two tabs making differently-worded claims about the same
 * producer rows, each with a green suite. Nothing is authored here.
 *
 * ⚠ NO MAGNITUDE, NO DIGIT. `evppi` is in the decision's OUTCOME units with no
 * licensed display, so the ranking is carried STRUCTURALLY — rank 1 in the
 * headline, ranks 2..n in producer wire order behind it. No sort, no filter, no
 * re-group: a view that "fixes" the order is a view that can invert it.
 *
 * ⚠ HONEST SILENCE ON THE GATE STATE. A null ranking (absent / empty /
 * all-invalid / unlabelable rank 1) produces NO finding at all, which is the
 * convention the existing tab's host already follows: on a run with no usable
 * value-of-information the surface makes no claim rather than offering a row
 * that leads to a dead end. `RESOLVE_NEXT_COPY.gate` is deliberately unused
 * here for that reason.
 *
 * ⚠ AND THE LIMIT, STATED RATHER THAN HIDDEN. Ranks 2..n are named but not
 * individually focusable or actionable — `AnalysisNewFinding` carries ONE
 * `targetId` and ONE `intervention`, so only rank 1 reaches the canvas. The
 * existing tab gives every row a focus target and a `valueAffordance` act. That
 * is a real gap against it, and closing it needs either a bespoke section (a
 * second disclosure pattern this surface bans) or a mount change this lane does
 * not own. Named so the next session inherits the gap and not the impression
 * of parity.
 */
function voiFinding(voi: VoiRanking, recommendations: Recommendation[]): AnalysisNewFinding {
  const lead = voi.resolved[0]
  const belowLabels = voi.belowResolution.map((r) => r.label).join(', ')
  // Both values are the owner's own ratified sentences. The `dt` labels are
  // furniture, exactly as `row('Basis', …)` is in the drivers rows above.
  const inspect = rows(
    row('Precision', belowLabels ? RESOLVE_NEXT.below(belowLabels) : null),
    row('Coverage', voi.someFactorsUnassessed ? RESOLVE_NEXT.partial : null),
  )

  // The arrived-and-all-sub-resolution state. LICENSED because a non-null
  // ranking guarantees rows arrived, validated and label-resolved — so an empty
  // `resolved` band means every surviving row is below resolution, which is
  // exactly what the sentence claims. It must never render on an absent block:
  // that would assert an assessment that never happened, and the caller's
  // null-check is what keeps it out.
  if (!lead) {
    return {
      id: 'voi:none-above-resolution',
      headline: RESOLVE_NEXT.tab,
      implication: RESOLVE_NEXT.noneAboveResolution,
      groundedIn: 'the value-of-information ranking',
      inspect,
    }
  }

  const rest = voi.resolved.slice(1)
  return {
    // Producer identity, so the row survives a reorder and two sections cannot
    // mint the same id (trap 19 — never a value predicate, never a position).
    id: `voi:${lead.factorId}`,
    headline: `${RESOLVE_NEXT.lead}: ${lead.label}`,
    implication: RESOLVE_NEXT.note,
    // `RESOLVE_NEXT_COPY.then` is documented as "Ranks 2..n, producer wire
    // order" — this is that, as a list rather than as a per-row suffix.
    detail: rest.length > 0 ? `${RESOLVE_NEXT.then} ${rest.map((r) => r.label).join(', ')}.` : undefined,
    groundedIn: 'the value-of-information ranking',
    targetId: lead.canFocus ? lead.factorId : undefined,
    inspect,
    intervention: interventionFor(recommendations, lead.factorId),
  }
}

function buildUncertainty(
  data: ResultsSectionDataReturn,
  recommendations: Recommendation[],
): AnalysisNewViewModel['uncertainty'] {
  const conf = data.confidence
  const findings: AnalysisNewFinding[] = []

  // 0. What is most worth resolving, FIRST — because it is the only row in this
  //    section that says what to DO about the uncertainty, and with
  //    `UNCERTAINTY_PREVIEW` at three it must not sit behind "Show more".
  if (data.voiRanking) findings.push(voiFinding(data.voiRanking, recommendations))

  /**
   * ⭐⭐ THE ONE ASSUMED RELATIONSHIP WORTH PINNING DOWN — computed for every
   * run, rendered only on the OLD Analysis tab, and dark here until now.
   *
   * MEASURED LIVE on the deployed build `a75cdf8a`, both tabs, one guest
   * session, one run: the old tab carried "Olumi estimated how strongly X
   * affects Y, but your team has not confirmed it" and what changes in the runs
   * where that link came out weak. This surface carried none of it —
   * `assumedStrength` had ZERO references across the whole `analysisNew` tree
   * (contrast control: `data.drivers`, 8).
   *
   * It is the single most reasoning-shaped thing the producer emits: it names
   * an assumption nobody set, says which option wins when it is wrong, and how
   * often. On the surface that exists to improve reasoning, that cannot be the
   * one thing missing.
   *
   * ⚠ NOTHING HERE IS AUTHORED. Every sentence comes from
   * `strengthElicitation/assumedStrengthCopy`, whose claims are held
   * mechanically by its own spec — the same module the old tab renders, so the
   * two surfaces cannot drift into saying different things about one fact.
   *
   * ⚠ NO INSPECT ROWS, DELIBERATELY. `assumedStrengthWhy` already states the
   * measured rate in its own sentence, and this tab has a census spec whose
   * whole purpose is catching one claim stated twice.
   *
   * ⚠ NO INTERVENTION ATTACHED, AND THAT IS NOT AN OVERSIGHT. The old tab's
   * action ("Ask Olumi to set this strength") dispatches through a route this
   * surface does not own, and `ContextualIntervention.recommendationId` is
   * looked up against the engine's recommendations — a synthetic id would give
   * a button that no-ops. A control that cannot act is an advertisement, not an
   * affordance. The edge is reachable via canvas focus below; wiring the ask is
   * a separate, honest step.
   */
  const assumed = data.assumedStrength?.selected ?? null
  if (assumed) {
    const others = assumedStrengthOthers(data.assumedStrength.assumedFragileCount)
    findings.push({
      // Identity carries the edge, so a test binds to THIS relationship rather
      // than to whichever row happens to sit first.
      id: `uncertainty:assumed-strength:${assumed.edgeId}`,
      headline: ASSUMED_STRENGTH_TITLE,
      implication: assumedStrengthLead(assumed),
      detail: [assumedStrengthWhy(assumed), others, assumedStrengthAsk(assumed)]
        .filter(Boolean)
        .join(' '),
      groundedIn: 'the unconfirmed-strength check on the fragile relationships',
      // `focusModelTarget` resolves against nodes AND edges, so an edge id is a
      // live target here — verified at `focusHelpers.ts:183-205`.
      targetId: assumed.edgeId,
      inspect: [],
    })
  }

  // 1. Consequential uncertainties first — these carry a threshold or an
  //    E-value, i.e. they are quantified, not merely noted.
  /**
   * A finding's identity, from the producer's OWN discriminating fields.
   *
   * ⚠⚠ THE DEFECT: `useResultsSectionData.ts:3197` pushes a row PER DEDUPED
   * FRAGILE EDGE inside a `forEach`, and every one carries the LITERAL
   * `code: 'SENSITIVE_ASSUMPTION'`. So `uncertainty:${u.code}` was the SAME
   * string for every fragile edge in the run. Measured at the deployed DOM on
   * `a9fc1564`: three rendered rows all carrying
   * `data-finding-id="uncertainty:SENSITIVE_ASSUMPTION"`, with
   * `AnalysisNewSection` rendering `key={f.id}`.
   *
   * ⚠⚠ AND POSITION IS NOT THE ANSWER. An index makes the ids unique — which
   * silences the duplicate-key defect — and REINTRODUCES the harm it closes:
   * reorder the producer's list and the same finding acquires a different id,
   * so `DisclosureRow`'s open/inspect state migrates to the wrong row. That is
   * the very failure duplicate keys can cause.
   *
   * `UncertaintyItem` carries real discriminators: `affectedNodes` — for a
   * SENSITIVE_ASSUMPTION these are `[fromId, toId]`, i.e. the fragile EDGE,
   * which is exactly what the producer deduped on — and `threshold.variable`.
   * Those describe the finding, so they survive a reorder.
   *
   * ⚠ THE POSITIONAL FALLBACK IS NECESSARY, AND HERE IS THE DERIVATION —
   * because the obvious review question is "can it be removed?", and the answer
   * is NO. Derived from the COMPLETE manifest: `uncertainties` has exactly TWO
   * producer sites in `useResultsSectionData.ts`, and BOTH can emit a row with
   * zero discriminators.
   *
   *  1. `:2829` — critiques. `code: w.code || 'UNKNOWN'` and
   *     `affectedNodes: w.node_id ? [w.node_id] : undefined`, with no
   *     `threshold` set on this branch. A critique carrying neither a `code`
   *     nor a `node_id` therefore yields `{ code: 'UNKNOWN', affectedNodes:
   *     undefined }` — and two of them are indistinguishable to us.
   *
   *  2. `:3197` — SENSITIVE_ASSUMPTION. It looks safe because it always SETS
   *     `affectedNodes`, but the value is `[fromId, toId].filter(Boolean)`, and
   *     `parseEdgeId` returns `{}` for any edge id that does not split on `::`
   *     into two non-empty parts, so both ids can be undefined and the array is
   *     then EMPTY. `.filter(Boolean)` is the subtle half — "the field is
   *     always assigned" is not "the field always discriminates".
   *
   * ⚠ SCOPE OF THAT CLAIM, STATED EXACTLY. This establishes that both states
   * are REACHABLE BY CONSTRUCTION from the producer code. It does NOT establish
   * that either has occurred in a captured payload — no capture has been
   * inspected for them. "Reachable" is the claim; "observed" is not, and the
   * difference is the one this estate keeps getting wrong in the other
   * direction (asserting absence from a partial look).
   *
   * So reorder-stability is claimed for the population that CARRIES a
   * discriminator, never for the surface. Both zero-discriminator states are
   * pinned.
   *
   * ⚠⚠ AND THE FALLBACK IS DEBT, NOT A RESOLUTION. It prevents COLLISIONS —
   * two rows can no longer share one id — but it cannot preserve identity
   * across a reorder for those rows, so `DisclosureRow`'s open state can still
   * follow the position rather than the finding. The real fix is a
   * producer-issued stable finding id. Until then this is the honest floor,
   * not the answer.
   */
  const uncertaintyKey = (u: UncertaintyItem, i: number): string => {
    const parts = [
      u.code,
      u.affectedNodes?.length ? u.affectedNodes.join('>') : '',
      u.threshold?.variable ?? '',
    ].filter((part) => part.length > 0)
    return parts.length > 1 ? `uncertainty:${parts.join(':')}` : `uncertainty:${u.code}:${i}`
  }

  const uncertaintyRows = conf.uncertainties ?? []
  for (let i = 0; i < uncertaintyRows.length; i++) {
    const u = uncertaintyRows[i]
    const text = humanised(u)
    if (!text) continue
    /**
     * ⭐⭐ THE SENTENCE APPEARS EXACTLY ONCE — AS THE LABEL WHEN IT IS SHORT
     * ENOUGH TO BE ONE, AS THE BODY OTHERWISE.
     *
     * ⚠ WITNESSED ON DEPLOYED `19fe8710`, and it is the third distinct defect
     * this two-slot pair has produced. Every non-threshold row printed its own
     * sentence TWICE — once cut off mid-clause, once in full:
     *
     *     If "Operational Overhead Burden → Operational Overhead Exceeds Team
     *     Capacity"…
     *     If "Operational Overhead Burden → Operational Overhead Exceeds Team
     *     Capacity" changes significantly, "RudderStack" could become the
     *     better choice
     *
     * Two of the three rows in "Uncertainty and gaps" did this, directly under
     * a sibling row that does it correctly (a real short label over a distinct
     * body). One section, two title conventions — which is Paul's "such a lack
     * of consistency in the design", concretely.
     *
     * ⚠⚠ READ THE HISTORY BEFORE CHANGING THIS AGAIN — TWO ALTERNATIVES ARE
     * ALREADY REJECTED AND NEITHER MAY COME BACK:
     *  · `implication = u.suggestion || text`. The producer sends `suggestion`
     *    as the CONSTANT 'Review this assumption' on every fragile-edge row, so
     *    a generic remedy DISPLACED the finding and the reasoning left the page.
     *  · the full sentence promoted into the label slot — 300 characters of
     *    header type, trading truthfulness for the density problem this surface
     *    exists to solve.
     * A third, considered and rejected here: a constant category label
     * ("One assumption the result is sensitive to"). It reads as a real label
     * until you notice two rows carry the SAME one, at which point it is
     * furniture rather than information — Paul's canvas-density ruling, one
     * surface up.
     *
     * ⚠ SO THE FIX IS NOT A BETTER TRUNCATION, IT IS NOT TRUNCATING. A cut
     * prefix of the body is not a label; it is the body said badly, and it was
     * cut BEFORE ITS VERB on all three measured rows, so the reader got the
     * condition and never the consequence. When the cut would change the text,
     * the row carries NO label and the whole sentence rides `implication`,
     * where nothing can displace it and nothing repeats it. When the cut would
     * NOT change the text the sentence already IS label-length, so it stays in
     * the label slot with an empty body — the previously-pinned no-duplicate
     * case, unchanged.
     *
     * A threshold row is untouched: `threshold.variable` is a PRODUCER-SUPPLIED
     * name, a genuine label that is not a prefix of anything, so it keeps both
     * slots. That row and this one are the discriminating pair.
     */
    const labelLength = truncateAtWordBoundary(text, 80)
    const headlineText = u.threshold
      ? `${u.threshold.variable} could tip the result`
      : labelLength === text
        ? text
        : ''
    findings.push({
      id: uncertaintyKey(u, i),
      // ⚠⚠ A HEADLINE IS A LABEL; THE FINDING IS THE SENTENCE — AND NEITHER MAY
      // BE SAID TWICE.
      //
      // The defect was never the cut. It was that the cut sentence existed
      // NOWHERE ELSE: `implication` was `u.suggestion || text`, and the producer
      // sends `suggestion` as the CONSTANT 'Review this assumption' on every
      // fragile-edge row, so a generic remedy DISPLACED the finding and the
      // reasoning left the page. Measured on the deployed build at `a9fc1564`:
      // three rows cut at 80 characters, EACH BEFORE ITS VERB — the reader got
      // the condition and never the consequence — under the identical body.
      //
      // So the cut stays as a LABEL (a truncated label is a loss the reader can
      // see; 300 characters of header type would trade truthfulness for the
      // density problem this surface exists to solve) and the FULL sentence
      // rides `implication`, where no constant can displace it.
      //
      // ⚠ THE BODY IS EMPTY WHEN THE HEADLINE ALREADY IS THE WHOLE SENTENCE. A
      // first draft carried `text` unconditionally and the first-viewport census
      // caught it: an uncertainty shorter than the cut rendered the identical
      // sentence twice. Truthfulness and non-repetition are one requirement.
      //
      // ⭐ THIS LINE IS NOW THE WHOLE NON-REPETITION RULE, and it needed no
      // change to absorb the fix above: a `''` headline is never equal to a
      // non-empty `text`, so the body carries the sentence exactly as it does
      // for a threshold row. The two slots hold the sentence ONCE in every
      // reachable combination — label-only (short), body-only (long, no
      // threshold), or label-plus-body (threshold, where the label is the
      // producer's own variable and not a prefix of the body).
      headline: headlineText,
      implication: headlineText === text ? '' : text,
      // ⚠⚠ THIS COMMENT USED TO SAY "the generic constant is DROPPED rather
      // than promoted". THAT WAS FALSE — there is no generic-suggestion
      // detection here and never was. The only predicate is
      // `suggestion !== text && !threshold`, so on the producer's ORDINARY
      // fragile-edge emission (`useResultsSectionData.ts:3197` — the literal
      // 'Review this assumption', no threshold) all three conjuncts hold and the
      // constant is DEMOTED TO `detail` on every such row. Independent review
      // executed it: 3/3 on `manyFragileEdges`, contrast control 0/1.
      //
      // The comment is corrected rather than the code, because the CODE IS
      // RIGHT and the comment described an intent that was never built:
      //  · the original defect was the constant DISPLACING the finding in
      //    `implication`. It no longer does — the sentence owns that slot.
      //  · `detail` is level-2, behind disclosure, so a remedy there costs
      //    nothing in the first viewport and is genuinely useful when opened.
      //  · and "detect the generic one" has no honest implementation: it would
      //    mean hardcoding a producer literal here, which is the
      //    hand-maintained mirror this estate keeps paying for (trap 12).
      //
      // So: a producer suggestion rides `detail` when it differs from the
      // sentence. Same union as the drivers' direction — `mixed`/`unknown` get
      // the direction-free phrasing rather than a guessed one.
      detail: u.suggestion && u.suggestion !== text && !u.threshold
        ? u.suggestion
        : u.threshold
        // ⚠ THROUGH `formatThresholdValue`, NOT RAW. This is the third
        // threshold-printing site and it was interpolating `.value` directly —
        // exactly the shape #925 fixed at the other two after the deployed
        // build printed a 16-significant-figure split. LATENT rather than live:
        // it bites only if the producer emits `fragile_edges[].threshold`,
        // which rides a `.passthrough()` carrier, so it is possible and
        // unpinned. Routed through the shared helper so a rule the surface
        // already has reaches the site that lacked it.
        ? `The ordering changes around ${formatThresholdValue(u.threshold.value)}${
            u.threshold.direction === 'positive'
              ? ' — above it, the ordering differs'
              : u.threshold.direction === 'negative'
                ? ' — below it, the ordering differs'
                : ''
          }.`
        : undefined,
      groundedIn: 'the sensitivity and critique analysis',
      targetId: u.affectedNodes?.[0],
      inspect: rows(
        row('Severity', u.severity),
        row('E-value', u.eValue != null ? String(u.eValue) : null),
        row('Factor confidence', pctOrNull(u.factorConfidence)),
      ),
      intervention: interventionFor(recommendations, u.affectedNodes?.[0]),
    })
  }

  // 2. Evidence gaps, in the producer's own emission order (PLoT already
  //    selected and ordered these — no client-side re-rank).
  for (const g of conf.evidenceGaps ?? []) findings.push(evidenceGapFinding(g, recommendations))

  // 3. Producer-owned assumptions from the ledger.
  const assumptionRows = conf.assumptions ?? []
  for (let i = 0; i < assumptionRows.length; i++) {
    const a = assumptionRows[i]
    findings.push({
      // Same rule as the uncertainties: the producer's fields first. An
      // `AssumptionItem` is `{ severity, message, target? }` — target alone
      // collapses two assumptions about one factor, so the message is what
      // actually distinguishes them. ⚠ A 60-character prefix CAN still collide
      // on two assumptions that share an opening clause; the index is appended
      // so identity is unique by construction rather than by hope, and the
      // reorder-stability claim is made only for the uncertainties, which have
      // a real producer discriminator.
      id: `assumption:${a.target ?? 'untargeted'}:${a.message.slice(0, 60)}:${i}`,
      headline: a.target ? `Assumption about ${a.target}` : 'Assumption in the model',
      implication: a.message,
      groundedIn: 'the assumption ledger',
      targetId: a.target,
      inspect: rows(row('Severity', a.severity)),
      intervention: interventionFor(recommendations, a.target),
    })
  }

  // 4. ⛔ INFERENCE WARNINGS ARE ENGINE DIAGNOSTICS AND NO LONGER RENDER HERE.
  //    They move to `Deeper analysis and evidence` (`buildDeeper`).
  //
  //    ⚠⚠ MEASURED ON THE DEPLOYED BUILD AT `a9fc1564`, a real guest run. THREE
  //    of the six rows in this section were inference warnings, all rendering
  //    the IDENTICAL headline "The model has a gap the analysis had to work
  //    around", with bodies carrying RAW INTERNAL NODE IDS straight through:
  //
  //      "No observed value provided for root node 'e4ec3415'; defaulted to 0.0"
  //      "Goal node 'a6a496f8' is scored from its forward-propagated outcome…"
  //
  //    An opaque engine id is not a sentence for a reader, and "Uncertainty and
  //    gaps" is where a user looks for STRATEGIC uncertainty — what might change
  //    the answer — not for the engine's account of its own workarounds.
  //
  //    ⛔ AND THEY ARE NOT REWRITTEN. Regexing an opaque id out of free producer
  //    prose would be this surface authoring a producer sentence, which is the
  //    fabrication boundary. `InferenceWarning.affected_labels` is present only
  //    sometimes, so no reliable structured resolution exists here. Demoting is
  //    honest; rewriting would not be. User-readable labels are a producer
  //    change, not a UI one.

  return {
    findings,
    // Rule 4 — the load-bearing distinction for this section's empty state.
    evidenceAssessed: conf.evidenceGapsAssessed === true,
    decisionVoi: data.decisionVoi,
  }
}

// ── DEEPER ANALYSIS (level 3) ───────────────────────────────────────────────

function buildDeeper(inputs: AnalysisNewViewModelInputs): AnalysisNewViewModel['deeper'] {
  const { data } = inputs
  const conf = data.confidence
  const groups: AnalysisNewViewModel['deeper']['groups'] = []

  // ⚠⚠ NO RUN, NO DESCRIPTION OF A RUN. Every group below is titled as a claim
  // about a run ("This run", "What this run covered", "Provenance"), and some of
  // the fields feeding them carry NON-NULL DEFAULTS when nothing has been
  // computed. Mounted pre-run this printed "Analysis status: computed" and
  // "Result completeness: full" directly beneath "No analysis has run yet for
  // this model" — the surface contradicting itself, from producer defaults
  // rather than from producer statements. `rows()` cannot catch it: the values
  // are present, they are just not about anything.
  if (inputs.isPreRun) return { groups: [], critiques: [], caveats: [] }

  const run = rows(
    row('Run identity', inputs.responseHash),
    row('Simulations', inputs.nSamples != null ? String(inputs.nSamples) : null),
    row('Seed', inputs.seedUsed != null ? String(inputs.seedUsed) : null),
    row('Analysis status', data.recommendation.analysisStatus),
    row('Drivers status', data.drivers.driversStatus),
    row('Robustness status', conf.robustnessStatus),
  )
  if (run.length) groups.push({ title: 'This run', rows: run })

  // ⚠ COVERAGE, NOT READINESS (rule 5). These rows say what the run did and did
  // not cover. None of them is a statement about whether analysis may run.
  const coverage = rows(
    row('Result completeness', data.completeness.status),
    row(
      'Fields the producer did not supply',
      data.completeness.missing.length ? data.completeness.missing.join(', ') : null,
    ),
    row(
      'Evidence coverage',
      conf.evidenceCoverage
        ? `${conf.evidenceCoverage.backedByData} backed by data, ${conf.evidenceCoverage.needsValidation} need validation`
        : null,
    ),
    row('Factors ranked for information value', data.voiRanking ? String(data.voiRanking.resolved.length) : null),
    row(
      'Some factors unassessed',
      data.voiRanking?.someFactorsUnassessed ? 'yes' : null,
    ),
    row('Relationships hidden below the display threshold', conf.filteredFragileEdges ? String(conf.filteredFragileEdges.filteredCount) : null),
    row('Zero-impact factors hidden', data.drivers.hiddenZeroImpactCount ? String(data.drivers.hiddenZeroImpactCount) : null),
  )
  if (coverage.length) groups.push({ title: 'What this run covered', rows: coverage })

  // ⚠ THE ENGINE'S ACCOUNT OF ITS OWN WORKAROUNDS. Moved here from "Uncertainty
  // and gaps" (see `buildUncertainty` step 4): diagnostics, and "Uncertainty and
  // gaps" is where a user looks for STRATEGIC uncertainty. Demoting them was
  // right. TWO THINGS ABOUT HOW IT WAS DONE WERE NOT.
  //
  // ⛔⛔ (1) THIS ADAPTER WAS RENDERING THE PRODUCER'S RAW `message`, AND THE
  // GUARD THAT EXISTS TO STOP EXACTLY THAT CANNOT SEE THIS FILE.
  //
  // `utils/humaniseInferenceWarning.ts` opens by recording the defect: ISL
  // inference-warning messages carry internal identifiers, `AdvancedSection`
  // rendered them verbatim, and that was ruled a no-raw-message-invariant
  // violation and fixed (P0-3 fold, external review 2026-07-14). The static
  // tripwire is `__tests__/no-message-render.spec.ts`, and its scanner walks
  // files matching `/\.tsx$/` under `src/components/results/`. This file has a
  // `.ts` extension, so it was never scanned; the value it produced was then
  // rendered by `DeeperAnalysis.tsx` as `{r.value}`, which the brace scanner
  // cannot recognise as a message read either. The invariant was intact, the
  // guard was intact, and the leak walked between them.
  //
  // What actually reached the screen on the deployed build at `a9fc1564`:
  //   "No observed value provided for root node 'e4ec3415'; defaulted to 0.0"
  //   "Goal node 'a6a496f8' is scored from its forward-propagated outcome…"
  //
  // ⛔ AND THE ARGUMENT THAT KEPT IT THERE WAS FALSE ON ITS OWN EVIDENCE. The
  // note this replaces reasoned that rewriting producer prose would be
  // fabrication and that "no reliable structured resolution exists here". There
  // is one, it is the estate's only sanctioned one, and it is already the path
  // both existing surfaces use: `humaniseCritique` maps the producer's own
  // `code` to approved copy, resolves labels from `affected_labels` (never
  // parsed out of the message), and falls through to a deliberately
  // non-factor-framed generic sentence for a code it does not hold. Both codes
  // quoted above — `ROOT_NODE_DEFAULT_VALUE` and `GOAL_OBSERVED_VALUE_UNUSED` —
  // have templates in that map already. Keying off `code` is not this surface
  // authoring a producer sentence; echoing `message` is this surface publishing
  // an engine identifier as if it were one.
  //
  // ⛔ (2) SEVERITY WAS BEING FLATTENED. The existing tab SPLITS these:
  // warning-severity entries go to `InferenceWarningStrip`, always visible at
  // the top of the results body, and `AdvancedSection` renders that set's exact
  // COMPLEMENT. Lumping both into one collapsed group demotes the half the
  // other tab refuses to collapse. The split below uses `isStripEntry` and
  // `selectHumanisedInferenceWarningsOutsideStrip` — the shared predicate and
  // its shared complement, never a second spelling of either (trap 12).
  //
  // The label is the producer's `code`. That is deliberate and it is what the
  // generic fallback presupposes: it tells the reader the raw code "is listed
  // in the run's audit details", and this group IS those audit details. A
  // machine code is right content for an audit trail and wrong content for a
  // caveat strip.
  const caveats = (conf.inferenceWarnings ?? []).filter(isStripEntry)
  const inferenceRows = selectHumanisedInferenceWarningsOutsideStrip(conf.inferenceWarnings)
    .map((w) => ({ label: w.code, value: w.title }))
  if (inferenceRows.length) groups.push({ title: 'Model gaps the analysis worked around', rows: inferenceRows })

  // ⚠ READINESS SIGNALS, RENDERED AS THE PRODUCER'S OWN NUMBERS. `m1_coaching
  // .readiness_signals.dimensions`, normalised upstream to
  // `{ evidence, robustness, clarity }` and absent-or-complete by construction
  // (`useResultsSectionData` returns undefined unless all three arrived). The
  // labels and the percentage rendering are the existing tab's — `clarity` is
  // shown as "Framing" there, and a second name for one dimension across two
  // surfaces is the defect, not the fix.
  //
  // ⚠ A UNIT RENDERING, NOT A DERIVED METRIC. `pctOrNull` is this file's own
  // existing helper and shows the same number the wire carries, the way
  // `AdvancedSection`'s readiness bars already show it. It yields null for a
  // non-finite value, so a dimension that arrives unusable drops its row rather
  // than printing a placeholder: absence renders as absence.
  //
  // ⚠ NOT A READINESS VERDICT, for the reason this file's header gives:
  // `RunAdmission` is the sole authority on whether analysis may run and
  // nothing here reads it or speaks for it. These are quality signals the
  // coaching layer reported ABOUT THE MODEL, on a run that already happened.
  const dims = data.recommendation.coachingReadinessDimensions
  const readiness = dims
    ? rows(
        row('Evidence', pctOrNull(dims.evidence)),
        row('Robustness', pctOrNull(dims.robustness)),
        row('Framing', pctOrNull(dims.clarity)),
      )
    : []
  if (readiness.length) groups.push({ title: 'Readiness signals', rows: readiness })

  const provenance = rows(
    row(
      'Sensitivities measured against',
      data.sensitivityReference?.optionLabel ?? null,
    ),
    // Only disclosed when the producer says it was applied AND provisional —
    // the same gate the existing surfaces use.
    row(
      'Automatic noise applied',
      data.autoNoiseProvenance?.applied && data.autoNoiseProvenance?.isProvisional ? 'yes, provisional' : null,
    ),
    row('Per-factor attribution withheld', data.attributionSuppression === 'not_attested' ? null : String(data.attributionSuppression ?? '')),
  )
  if (provenance.length) groups.push({ title: 'Provenance', rows: provenance })

  // Decision-quality prompts carry DSK grounding ONLY when the producer
  // attested a claim id. Presence IS the attestation — never defaulted.
  const dsk = (conf.m2DecisionQualityPrompts ?? [])
    .filter((p) => p.dskClaimId)
    .map((p) => ({ label: p.principle, value: `${p.question} (${p.dskClaimId})` }))
  if (dsk.length) groups.push({ title: 'Grounded decision-quality prompts', rows: dsk })

  return {
    groups,
    // ⚠⚠ THE WORST DEFECT THIS SECTION HAD: A WARNING THE ENGINE RAISED THAT
    // REACHED NO SCREEN.
    //
    // `confidence.humanisedCritiques` is WARNING-severity engine critiques,
    // already SENSITIVE_ASSUMPTION-excluded and already carrying CEE's approved
    // `user_message` verbatim for the S/U-bucket codes. `ResultsBody` mounts
    // `CritiqueWarningStrip` over it in its UNCONDITIONAL current-view group —
    // i.e. the existing tab treats these as too important to collapse.
    //
    // `OutputsDock` branches on `effectiveActiveTab`: the `results` branch
    // mounts `ResultsBody`, the `analysisNew` branch mounts this tab instead.
    // So on this tab the strip is not merely lower down, it is not mounted at
    // all — a sweep for `humanisedCritiques` under `analysisNew/` returned zero
    // (contrast control in the same sweep: `inferenceWarnings`, present).
    //
    // Selected HERE by the strip's own exported selector so the view model's
    // idea of "is there anything to show" and the component's cannot disagree —
    // which is what drives the render decision in `DeeperAnalysis`.
    critiques: selectRenderableCritiqueEntries(conf.humanisedCritiques),
    caveats,
  }
}

// ── AT A GLANCE ─────────────────────────────────────────────────────────────

/** Producer enum → one user-facing word. Content strategy, not new truth. */
const VERDICT_WORD: Record<string, { tone: GlanceVerdict['tone']; label: string }> = {
  robust: { tone: 'stable', label: 'Stable' },
  moderate: { tone: 'mixed', label: 'Mixed' },
  fragile: { tone: 'sensitive', label: 'Sensitive' },
  // 'not_assessed' is DELIBERATELY ABSENT — the producer's stated absence must
  // render no chip at all, never a fourth word that reads as a measurement.
}

/** Drivers, capped, with a within-run comparable magnitude. */
function glanceDrivers(data: ResultsSectionDataReturn): {
  drivers: GlanceDriver[]
  setRelative: boolean
} {
  const rows = (data.drivers.drivers ?? []).filter((d) => d.zeroReason == null)
  const setRelative = rows.length > 0 && rows.some((d) => d.displayProvenance !== 'influence_score')
  // Same contract rule as `driverFinding`: `displayInfluence` or nothing. A bar
  // drawn from a mixed basis ranks across two different scales.
  const magnitude = (d: (typeof rows)[number]) => d.displayInfluence ?? 0
  // ⚠ THE BAR IS SCALED TO THE STRONGEST DRIVER IN THIS RUN, NOT TO 1.0 AND NOT
  // TO A SUM. Scaling to a sum would render each bar as a SHARE OF THE OUTCOME —
  // a claim neither basis licenses, and the exact misreading the earlier
  // "41% / 22% / 15%" concept invited (they sum to 78%, which reads as
  // "the rest is something else"). A within-run maximum makes the bars a RANK
  // COMPARISON, which is all either basis supports.
  const top = Math.max(...rows.map(magnitude), 0)
  return {
    setRelative,
    drivers: rows.slice(0, GLANCE_DRIVER_COUNT).map((d) => ({
      id: d.factorKey,
      label: d.factorLabel,
      fraction: top > 0 ? Math.max(0.04, magnitude(d) / top) : 0,
      // Fail-closed focus pre-gate, the pattern `analysis-hero` established:
      // an unfocusable row yields null and renders as text, never a dead link.
      targetId: d.canFocus ? (d.matchedNodeId ?? d.factorKey) : null,
    })),
  }
}

/**
 * ⭐⭐ THE ANTECEDENT — whose numbers this run actually consumed.
 *
 * ⚠⚠ NO LONGER A COPY — IT IS THE SAME FUNCTION. This used to hold a DECLARED
 * copy of `analysis-hero/buildHeroModel.ts`'s expression, "semantics and
 * ordering intact". A declared copy is still a copy: it can be checked for
 * agreement and never for correctness. Both surfaces now import
 * `driverValueProvenance` from `../driverValueProvenance`, so there is one
 * answer to one question and nothing left to drift.
 *
 * ⚠⚠ AND THE FIELD IT ASKS CHANGED. The old expression led with
 * `isDefaultedConfidence`, which is ISL bootstrap degeneracy — it answers
 * whether the CONFIDENCE was a placeholder, not who authored the VALUE. The
 * authority is the node's `observed_state.source`. Measured on
 * `live-analysis-turn-T3-20260808T155759Z`: `fac_switch_cost` is
 * `value_source: 'brief_extraction'` with `sampling_stability: 0`, so the old
 * read called a figure from the user's own brief an Olumi estimate.
 *
 * ⛔ NO THRESHOLD, NO INFERENCE FROM THE VALUE ITSELF, AND NO COUNT. The wire
 * carries a per-factor flag and nothing else; a proportion would be a metric
 * this surface invented, which is the defect class it has already shipped
 * three times.
 *
 * ⚠ SCOPE, STATED SO THE COPY CANNOT OUTRUN IT: this reads the FACTOR ROWS the
 * producer returned — every row, including zero-influence ones, because a
 * factor scored at zero was still an input and filtering by influence would
 * make a provenance claim depend on an unrelated quantity. It says nothing
 * about inputs that never appear as factor rows, which is why the sanctioned
 * copy speaks of inputs and figures rather than of "everything".
 */
function glanceInputProvenance(
  data: ResultsSectionDataReturn,
  nodeValueSources?: ReadonlyMap<string, string>,
): GlanceInputProvenance | null {
  const rows = data.drivers.drivers ?? []
  // ⚠ NO ROWS IS A DRIVERS-FEED CONDITION, NOT A PROVENANCE ONE, AND THE TWO
  // MUST NOT SHARE A SENTENCE. `useResultsSectionData` downgrades
  // `driversStatus` 'computed' → 'unavailable' whenever the row set is empty,
  // so an empty set always means the sensitivity feed was unavailable or
  // errored — never that a run examined some inputs and could not place them.
  // Rendering "Olumi could not establish where these came from" over a
  // transport failure would describe an outage as a finding, which is the same
  // two-questions-one-name defect this change removes, pointed the other way.
  if (rows.length === 0) return null

  // The SHARED oracle's two positive answers. Its third, `undetermined`, is
  // what neither predicate matches — and it is the one that demotes a
  // universal claim to a "partly" one below.
  const estimated = (d: (typeof rows)[number]) =>
    driverValueProvenance(d, nodeValueSources) === 'estimated'
  const userStated = (d: (typeof rows)[number]) =>
    driverValueProvenance(d, nodeValueSources) === 'not_estimated'

  const hasEstimated = rows.some(estimated)
  const hasUserStated = rows.some(userStated)
  // Determined = the producer landed on one of the two positive answers. A row
  // that is neither is the silent third state, and its presence is what demotes
  // a universal claim to a "partly" one.
  const allDetermined = rows.every((d) => estimated(d) || userStated(d))

  // ⭐⭐ NOTHING POSITIVELY WITNESSED EITHER WAY — AND THIS IS NOT SILENCE.
  //
  // It used to be. That is why this line never reached a screen: the per-factor
  // oracle is three-state, this set-level one had names for two of them, and
  // the third was folded into `null` next to "there are no rows at all". Two
  // different facts under one name (trap 21), and the cost was measured — over
  // every factor-bearing capture in this repo the oracle returns `estimated` on
  // 7 files, `partly_estimated` on 9, and this branch on 9 more whose rows are
  // all real and all unsettled. On those nine the panel printed a prominent
  // share and stated its basis nowhere.
  //
  // The producer having said nothing is itself the answer to "what does this
  // rest on", and it is the answer a reader most needs. `undetermined` reports
  // our own knowledge and attributes the figures to nobody, so it carries none
  // of the authorship risk that makes the other five words gated.
  //
  // ⛔ STILL NO COUNT AND NO PROPORTION. The wire carries a per-factor flag.
  if (!hasEstimated && !hasUserStated) return 'undetermined'
  // Both witnessed. Silence on any remaining row cannot falsify a claim that
  // only asserts one of each exists, so this needs no `allDetermined` gate.
  if (hasEstimated && hasUserStated) return 'mixed'
  if (hasEstimated) return allDetermined ? 'estimated' : 'partly_estimated'
  return allDetermined ? 'user_supplied' : 'partly_user_supplied'
}

/**
 * "Could change if" — the TIPPING POINT, from `flipThresholds`.
 *
 * ⚠ GATED ON `flipThresholdsStatus`, WHICH IS THE HONESTY FIELD. 'unavailable'
 * and 'unresolved' mean the producer could not determine a flip; rendering a
 * row anyway would convert a technical non-result into an apparent finding.
 * 'all_no_effect' means it looked and found none — also no row.
 *
 * ⚠ AND IT IS NOT DERIVED FROM INFLUENCE. Influence ranks what moves the
 * outcome; this names the value at which the ORDERING changes. They are
 * different quantities and putting the influence leader here under a different
 * name would be the same signal shown twice.
 */
function glanceCondition(data: ResultsSectionDataReturn): GlanceCondition | null {
  const status = data.recommendation.flipThresholdsStatus
  if (status && status !== 'computed' && status !== 'partial_no_effect') return null
  const rows = data.recommendation.flipThresholds ?? []
  // ⚠ THE PRODUCER'S OWN WORD FOR "I DETERMINED A FLIP" IS `flip_reason:
  // 'found'`, AND IT IS WHAT THIS GATES ON. Derived from a real payload:
  // 3 of 4 rows came back `no_flip_in_range: true` with reasons
  // 'no_effect_within_bounds' and 'structurally_invariant'. Those were skipped
  // only because their `flip_value` also happened to be null — a row carrying
  // BOTH a value and `no_flip_in_range` would have rendered a tipping point the
  // producer had explicitly said it did not find. Checking the value alone was
  // right by luck, not by construction.
  const usable = rows.find(
    (t) =>
      t &&
      typeof t.flip_value === 'number' &&
      typeof t.label === 'string' &&
      t.label.length > 0 &&
      (t as { no_flip_in_range?: boolean }).no_flip_in_range !== true &&
      (t.flip_reason === undefined || t.flip_reason === 'found'),
  )
  if (!usable) return null
  // ⚠ A BARE NUMBER WITH NO UNIT IS UNINTERPRETABLE, AND IT SHIPPED THAT WAY IN
  // THE FIRST MOUNTED WITNESS: "Price increase for new customers passes 1" — one
  // what? The producer sends `unit` only sometimes; when it does not, the value
  // sits on the model's own scale and needs a reference point to mean anything.
  // `current_value` is that reference and comes from the same producer row, so
  // pairing them invents nothing. When even that is absent, the direction of
  // travel is unknowable (Codex B3: a defaulted 0 fabricated a flip DIRECTION),
  // so the row states the condition without a number rather than printing one
  // the reader cannot place.
  // ⚠⚠ TWO DEFECTS MEASURED BY EXECUTION ON THE DEPLOYED BUILD (#909 review).
  //  (1) NOTHING WAS ROUNDED. `flip_value` arrives at full float precision and
  //      was printed raw: "Customer demand passes 0.361111%". Six decimal
  //      places of estimator noise, shown as precision, on the surface whose
  //      entire claim is a five-to-ten-second read.
  //  (2) EVERY NON-'%' UNIT WAS PREFIXED. Units observed across this repo's
  //      captures are '%', '£', 'index' and 'scale'. Prefixing is right for a
  //      currency and wrong for a SCALE NAME, which rendered literally as
  //      "Customer demand passes index0.361111".
  // 'index'/'scale' are not units at all — they NAME the scale the number sits
  // on — so the printable set is closed to '%' and currency symbols, and
  // anything else falls through to the `current -> flip` form. That is not a
  // new rule: it is THIS function's own stated rule for a unit it cannot print,
  // applied to a unit that is unprintable rather than only to one that is
  // absent. The reference point is what makes the number placeable.
  const rawUnit = typeof usable.unit === 'string' ? usable.unit : ''
  const CURRENCY_SYMBOLS = ['£', '$', '€', '¥']
  const unit = rawUnit === '%' || CURRENCY_SYMBOLS.includes(rawUnit) ? rawUnit : ''
  // ⚠ THE RULE THAT USED TO BE INLINE HERE NOW LIVES IN `formatThresholdValue`,
  // AND THAT MOVE IS THE POINT. It was written for THIS field, the sibling
  // conditional-winner split never got it, and the identical defect shipped a
  // second time. A rule that only one of two threshold sites can reach is a
  // rule this surface does not have.
  const fmt = (n: number) => {
    const v = formatThresholdValue(n)
    return unit === '%' ? `${v}%` : `${unit}${v}`
  }
  const flip = fmt(usable.flip_value as number)
  const current = typeof usable.current_value === 'number' ? fmt(usable.current_value) : null
  const text = unit
    ? `${usable.label} passes ${flip}`
    : current
      ? `${usable.label} moves from ${current} to ${flip}`
      : `${usable.label} changes materially`
  return {
    text,
    targetId: typeof usable.node_id === 'string' && usable.node_id.length > 0 ? usable.node_id : null,
  }
}

/**
 * ⚠ `recommendations` WAS DROPPED FROM THIS SIGNATURE, and that is a finding
 * rather than a tidy-up: its ONLY use was computing `primaryInterventionId`,
 * a field nothing rendered. The glance never needed the engine's list — the
 * mount derives the top recommendation itself, from the array it already holds.
 */
function buildAtAGlance(
  data: ResultsSectionDataReturn,
  nodeValueSources?: ReadonlyMap<string, string>,
): AtAGlance {
  const rec = data.recommendation
  const { drivers, setRelative } = glanceDrivers(data)

  // The synthesis is the LEADER SENTENCE when the single verdict entitles one,
  // and otherwise nothing. There is no UI-generated strategic conclusion here:
  // absent an entitlement, the glance leads with the drivers instead.
  const leader = rec.recommendedOption
  const headline =
    rec.verdict?.hasLeadingOption === true && leader && !rec.isSingleOption
      ? `${leader.label} currently scores higher`
      : null

  // ── SCOPE: what does the win share range over? ────────────────────────────
  //
  // ⚠⚠ THE DEFECT THIS CLOSES, MEASURED AT A CONTROLLED CAPTURE (ROADMAP 2.1340).
  // This surface rendered "Ahead in 60% of simulated futures" while the run had
  // compared TWO of the user's THREE options. The existing Analysis tab says so
  // on the same run; this one said nothing, anywhere. The number is not wrong —
  // it is a true statement about a candidate set the reader never learns, and a
  // reader takes it as "of my three".
  //
  // ⛔ NO SECOND PREDICATE. "Was this option in the comparison?" is owned by
  // `notAnalysedOptions.ts` and surfaced as `notAnalysed`; `deriveComparisonScope`
  // COUNTS that flag. This function counts nothing itself — it only splits that
  // owner's `null` into the two questions it answers (see GlanceComparisonScope).
  const allOptions = rec.allOptions ?? []
  const analysedCount = allOptions.filter((o) => o.notAnalysed !== true).length
  const comparisonScope: GlanceComparisonScope =
    allOptions.length === 0 || analysedCount === 0
      ? { kind: 'unresolved' }
      : (() => {
          const scope = deriveComparisonScope(allOptions)
          if (!scope) return { kind: 'whole_set' as const }
          return {
            kind: 'partial' as const,
            scope,
            // Named with the SANCTIONED copy, never re-worded here. An option
            // whose label is missing is dropped rather than invented — the
            // scope sentence still reports it by count.
            excluded: allOptions
              .filter((o) => o.notAnalysed === true)
              .map((o) => ({
                id: o.id,
                label: typeof o.label === 'string' ? o.label.trim() : '',
                reasonCopy: notAnalysedReasonCopy(o.notAnalysedReason ?? 'not_returned'),
              }))
              .filter((o) => o.label.length > 0 && o.label !== o.id),
          }
        })()

  const word = rec.robustnessVerdict ? VERDICT_WORD[rec.robustnessVerdict] : undefined
  // The single most informative number on the surface, and it is only licensed
  // alongside an entitled leader — so it is gated on the SAME condition as the
  // headline, never rendered on its own.
  // Gated twice: on the leader entitlement AND on scope being establishable.
  const winPct =
    headline && comparisonScope.kind !== 'unresolved'
      ? pctOrNull(leader?.winProbability ?? rec.winProbability)
      : null

  const winShare = winPct ? `Ahead in ${winPct} of simulated futures` : null
  // Bar geometry only — see `winFraction`'s doc comment. Gated on exactly the
  // same condition as `winPct`, so the number and the bar can never disagree
  // about whether there is a share at all.
  const winRaw = leader?.winProbability ?? rec.winProbability
  const winFraction =
    winPct && typeof winRaw === 'number' && Number.isFinite(winRaw)
      ? Math.max(0, Math.min(1, winRaw > 1 ? winRaw / 100 : winRaw))
      : null
  const verdictBlock = word
    ? { tone: word.tone, label: word.label, ...(rec.robustnessVerdictReason ? { reason: rec.robustnessVerdictReason } : {}) }
    : null

  // ⚠⚠ WHAT THE SURFACE ACTUALLY PUTS ON SCREEN, computed from the SAME fields
  // the components render from — so the gate and the render cannot disagree.
  //
  // `AtAGlance` renders the share only inside the verdict block, so a run with
  // a share and no verdict shows no percentage; and a leader determined by
  // EXPECTED OUTCOME carries a null win probability, so it shows a superlative
  // and an ordering verdict with no percentage at all. Both are set-dependent
  // claims and both need the scope disclosure. Gating on the share alone
  // suppressed it on exactly those runs.
  const shareOnScreen = Boolean(verdictBlock && winShare)
  const comparativeClaim: GlanceComparativeClaim = shareOnScreen
    ? 'value'
    : headline || verdictBlock
      ? 'order'
      : 'none'

  return {
    headline,
    leaderLabel: headline && leader ? leader.label : null,
    winShare,
    winFraction,
    comparisonScope,
    comparativeClaim,
    verdict: verdictBlock,
    drivers,
    influenceIsSetRelative: setRelative,
    condition: glanceCondition(data),
    inputProvenance: glanceInputProvenance(data, nodeValueSources),
  }
}

// ── HOW THE OPTIONS COMPARE ─────────────────────────────────────────────────

/**
 * Is this option's label usable AS A NAME, or is it a gap in what reached us?
 *
 * The predicate is `deriveComparisonScope`'s, reproduced from the ONE place the
 * estate already applies it (`buildAtAGlance`'s excluded filter): a blank label
 * carries no name, and a label that is merely the node's own id is an id, not a
 * name. Neither may be replaced with an invented "Untitled option" — that is
 * the fabrication the excluded-option path exists to refuse — so an option
 * failing this is COUNTED and disclosed rather than named or silently dropped.
 */
function usableOptionLabel(o: OptionResult): string | null {
  const label = typeof o.label === 'string' ? o.label.trim() : ''
  return label.length > 0 && label !== o.id ? label : null
}

/**
 * Every option, with what the run is entitled to say about each one.
 *
 * ⚠⚠ THE ORDER IS NOT DECIDED HERE AND MUST NOT BE. `rec.allOptions` arrives
 * already ordered by `sortOptionsForDisplay` (called ONCE, in
 * `useResultsSectionData`, gated on `designationsWithheld`), which returns the
 * caller's canonical graph order untouched when the verdict withholds the
 * leader claim, and which puts unanalysed options LAST — "last is not a rank,
 * it is outside the list". Re-sorting here would be a second designation
 * channel that does not carry that gate (ROADMAP 1.267).
 *
 * ⚠⚠ AND NO ORDINAL IS EMITTED, DELIBERATELY. `OptionResult.rank` is a real
 * producer field, but printing it beside the labels would put a RANKING on
 * screen on a run whose verdict withheld one — the ordering claim survives in
 * the array order, where exactly one authority decides whether to make it.
 * A number is a louder designation than a position, and this section is not
 * entitled to a louder one than the surface it sits on.
 *
 * ⚠ NO GAP, NO DIFFERENCE, NO DELTA. `OptionResult` carries `deltaFromBaseline`
 * and the win-probability gap is computable from two rows here — and the
 * ratified rule (OptionCards' `tiedOrWithheld`, retired 2026-08-10) is that no
 * user-facing surface states the gap between two Monte Carlo win frequencies:
 * a difference of two estimates carries more uncertainty than either does, and
 * printed bare it reads as the most precise number on screen while being the
 * least reliable. Own-probability statements only.
 */
/**
 * ⭐⭐ WHAT YOUR MODEL IMPLIES — the two readings, and whether they agree.
 *
 * See `ModelImplication` in `analysisNewTypes.ts` for WHY this section exists.
 * This note is about HOW, and the how is almost entirely "it does not decide
 * anything".
 *
 * ── THE ONE ARCHITECTURAL DECISION ─────────────────────────────────────────
 * This calls `buildHeroModel` and READS ITS ANSWERS. It does not re-implement
 * a single predicate. The alternative — importing `selectGoalLeader` and
 * re-deriving the outcome argmax here — was rejected because the outcome
 * centre is a THREE-STEP FALLBACK CHAIN (`getExpectedValue ?? getMedian ??
 * p50`) that exists in exactly one place in this repo (`buildHeroModel.ts:122`)
 * and is not exported. Writing it again would have created the second copy on
 * day one, in the same commit as a comment promising not to.
 *
 * `buildHeroModel` is a PURE function of the same `ResultsSectionDataReturn`
 * this builder already receives, and the whole view model is memoised one
 * level up in `useAnalysisNewViewModel`, so this is one extra pure call per
 * report — not per render.
 *
 * ── WHAT IS INHERITED, AND WHY EACH ONE MATTERS ────────────────────────────
 *  · `leaders.goal`    — the goal crown, already gated by `selectGoalLeader` on
 *                        a user target, a COMPLETE field, a UNIQUE maximum and
 *                        the sub-1% floor, and already nulled on a withheld run.
 *  · `leaders.outcome` — the outcome argmax, already nulled on a withheld run.
 *  · `showGoalHint`    — `!goalAvailable && goalThreshold == null`: the goal
 *                        reading is missing BECAUSE no target exists, as
 *                        opposed to a producer gap. This is the difference
 *                        between honest guidance and false advice.
 *  · `hasConstraints`  — decides "your goal" vs "your goal and limits".
 *
 * Because `leaders` is all-null on a withheld run, EVERY branch below falls to
 * `none` on such a run without this function mentioning the verdict once. That
 * is the intended shape: ROADMAP 1.267 gates at SELECTION precisely so a new
 * reader cannot be born un-gated, and this is a new reader.
 *
 * ── ⚠ THE ONE PLACE THIS IS STRICTER THAN THE HERO, DELIBERATELY ───────────
 * `leaders.outcome` is the entitlement for the hero's CHART RING. The hero's
 * outcome SENTENCE carries one further gate the ring does not — UI-SEM-070,
 * `topOutcomesReadoutTied`: when the top two options render the SAME readout
 * string, the chart shows no winner, so no sentence may crown one. That flag is
 * not exposed on `HeroChartModel`, and re-deriving it would mean re-deriving the
 * runner-up, and therefore the ranking, and therefore the centre chain — the
 * exact thing this module refuses to do.
 *
 * So the gate here is `readoutIsUnique`: the leader's rendered outcome readout
 * must be unique across ALL rows, not merely different from the runner-up's.
 * That is STRICTLY STRONGER than the hero's flag (leader-vs-any implies
 * leader-vs-runner-up), which is the safe direction of difference: it can only
 * ever WITHHOLD where the hero speaks, never speak where the hero withholds. It
 * is also the same signal the hero's own comment names as the authority — "the
 * exact 'what the user sees' signal: string equality of the rendered readouts".
 */
function buildModelImplication(data: ResultsSectionDataReturn): ModelImplication {
  const hero = buildHeroModel(data)
  // 'status' (blocked/failed/partial) and 'empty' carry no rows and no leaders.
  if (hero.kind !== 'chart') return { kind: 'none' }

  /**
   * ⚠ A COMPARISON NEEDS SOMETHING TO COMPARE WITH — the SAME two-conjunct gate
   * `buildOptionsComparison` applies below, and for the same reason. With one
   * option "X has the highest expected outcome" is not a finding, it is a
   * tautology dressed as one. `isSingleOption` is the producer's own word and
   * the length check catches a payload where the flag is absent; neither alone
   * is the rule the rest of the estate applies (`ResultsBody.tsx:522`).
   */
  if (data.recommendation.isSingleOption === true || hero.rows.length <= 1) {
    return { kind: 'none' }
  }

  const { rows, leaders, hasConstraints, showGoalHint } = hero

  /**
   * ⚠ THE LABEL IS PASSED THROUGH THE HERO'S OWN INTERPOLATION GUARD, not used
   * raw. `safeInterpolatedLabel` is what stops a label the glossary bans, or one
   * that is merely a node id, being welded into a generated sentence — and both
   * tabs must refuse the same labels, or one of them prints what the other
   * suppressed.
   */
  const safeLabel = (row: (typeof rows)[number]): string =>
    safeInterpolatedLabel(row.label, HERO_COPY.labelFallback)

  const outcomeRow = leaders.outcome != null ? rows.find((r) => r.id === leaders.outcome) : null
  if (!outcomeRow) return { kind: 'none' }

  /**
   * ⚠ A CLAIM WITH NO NUMBER BEHIND IT IS NOT A CLAIM. `outcome.readout` is the
   * missing glyph when the option has no centre; the argmax cannot select such a
   * row today, but the sentence template interpolates the readout directly, so
   * the guard sits where the string is built rather than depending on a
   * selector's discipline upstream.
   */
  if (outcomeRow.outcome.readout === HERO_COPY.readout.missing) return { kind: 'none' }

  // UI-SEM-070, strengthened — see the header note.
  const readoutIsUnique =
    rows.filter((r) => r.outcome.readout === outcomeRow.outcome.readout).length === 1
  if (!readoutIsUnique) return { kind: 'none' }

  const outcome: ImplicationClaim = {
    optionId: outcomeRow.id,
    sentence: COPY.implications.outcomeClaim(safeLabel(outcomeRow), outcomeRow.outcome.readout),
  }

  const goalRow = leaders.goal != null ? rows.find((r) => r.id === leaders.goal) : null
  if (!goalRow) {
    /**
     * No second reading. `showGoalHint` decides between an honest unlock and
     * silence — it is TRUE only when the reading is missing because no target
     * exists. A target-bearing run whose crown is withheld (tie, incomplete
     * field, sub-1% floor) or that has no goal probabilities at all takes the
     * silent branch: we are not entitled to a second claim and have no true
     * unlock to offer, and "set a success target" to someone who already set one
     * is advice that cannot be followed.
     */
    return showGoalHint ? { kind: 'needs_target', outcome } : { kind: 'none' }
  }

  const goal: ImplicationClaim = {
    optionId: goalRow.id,
    sentence: COPY.implications.goalClaim(
      safeLabel(goalRow),
      goalRow.goal.readout,
      hasConstraints,
    ),
  }

  /**
   * ⚠ COMPARED BY ID, NEVER BY LABEL OR BY VALUE. Two options can share a label
   * (and `safeLabel` can collapse two distinct unusable labels onto the SAME
   * fallback string), and two can share a readout. Identity is the only
   * comparison that answers "is this the same option?" — CLAUDE.md trap 19.
   */
  return goalRow.id === outcomeRow.id
    ? { kind: 'aligned', label: safeLabel(goalRow), outcome, goal }
    : { kind: 'diverged', outcome, goal }
}

function buildOptionsComparison(data: ResultsSectionDataReturn): OptionsComparisonSection {
  const allOptions = data.recommendation.allOptions ?? []

  /**
   * ⚠ A COMPARISON NEEDS SOMETHING TO COMPARE WITH. With one option the
   * section rendered "How the options compare … >99.99%" — a heading promising
   * a comparison over a set of one, and a near-certainty readout that is an
   * artefact of having nothing to lose to.
   *
   * TWO ESTATE GATES ALREADY SAY THIS AND NEITHER WAS APPLIED HERE:
   * `ResultsBody.tsx:522` gates the whole "Your options" section on
   * `!isSingleOption && allOptions.length > 1`, and this very file gates the
   * leader headline at `:968` on `!rec.isSingleOption`. Gating only on
   * `totalCount === 0` left the one-option case open.
   *
   * Both conjuncts, deliberately, matching `ResultsBody`: `isSingleOption` is
   * the producer's own word, and the length check catches a payload where the
   * flag is absent. Neither alone is the rule the rest of the estate applies.
   */
  if (data.recommendation.isSingleOption === true || allOptions.length <= 1) {
    return { rows: [], totalCount: 0 }
  }
  const storyHeadlines = data.recommendation.storyHeadlines

  const rows: ComparisonOption[] = []
  for (const o of allOptions) {
    const label = usableOptionLabel(o)
    if (label === null) continue

    if (o.notAnalysed === true) {
      rows.push({
        kind: 'not_analysed',
        id: o.id,
        label,
        // The SANCTIONED sentence, resolved here so no component re-words it.
        // `not_returned` is the same default `buildAtAGlance` applies, and it
        // is the weaker of the two claims: it reports that the analysis came
        // back with nothing, and prescribes no action the user cannot take.
        reasonCopy: notAnalysedReasonCopy(o.notAnalysedReason ?? 'not_returned'),
      })
      continue
    }

    // ⭐ THE SECOND FORK — the option the analysis RAN ON and could not compute.
    //
    // BESIDE the one above, never inside it: that one answers "was this option
    // in the analysis at all?" (derived from the producer's omission), this one
    // answers "did the computation produce a usable result?" (stated by the
    // producer). An option can be analysed and not computed, so one branch
    // cannot serve both without lying on that intersection (CLAUDE.md trap 21).
    //
    // ⛔ WHY IT MUST FORK BEFORE THE `hasWin` LINE BELOW. On a failed option
    // (`'failed'` ⇔ `n_valid === 0`) `winProbability` is a finite `0`, so
    // `hasWin` is TRUE and the row below emits a `winReadout` of `'0%'` and a
    // `winFraction` of `0` — a zero-width bar and a measured claim, from a
    // computation that drew no valid samples. The absence rule the block below
    // enforces cannot help here, because this is not an absence: it is a
    // present, finite, meaningless zero.
    //
    // Gated on the producer's EMITTED value: `'partial'` has a real
    // distribution behind it and takes the ordinary path, and an ABSENT status
    // (the legacy V1 shape) takes it too.
    //
    // ⭐ THE SAME PREDICATE `OptionCards` FORKS ON, so the two tabs cannot
    // disagree about which options carry a share.
    if (optionComputationFailed(o.computeStatus)) {
      rows.push({
        kind: 'not_computed',
        id: o.id,
        label,
        reasonCopy: notComputedReasonCopy(o.computeStatusReason),
      })
      continue
    }

    // ⚠ ABSENCE IS NOT ZERO, AND IT IS ENFORCED AT THE ONE PLACE THE NUMBER IS
    // BORN. A win probability that is absent, non-finite, or not a number at
    // all yields `null` on BOTH fields together — no readout and no bar — so
    // the renderer has nothing to coalesce into a `0%` or a zero-width bar.
    const raw = o.winProbability
    const hasWin = typeof raw === 'number' && Number.isFinite(raw)

    // The producer's own sentence for THIS option, joined by option id — the
    // same join `OptionCards` and the analysis hero already make. Trimmed to
    // non-empty because `useResultsSectionData` sanitises a non-string value to
    // `''`, and an empty string is absence wearing a present field's clothes.
    const rawWhy = storyHeadlines?.[o.id]
    const why = typeof rawWhy === 'string' && rawWhy.trim().length > 0 ? rawWhy.trim() : null

    rows.push({
      kind: 'analysed',
      id: o.id,
      label,
      // The display-honesty authority, given the SAME arguments `OptionCards`
      // gives it, so the two tabs cannot print two different readouts of one
      // probability on one run. A measured-but-tiny share renders "<0.01%",
      // never "0%".
      winReadout: hasWin ? formatProbabilityWithResolution(raw, o.nValidSamples) : null,
      // Geometry only. Clamped because a bar cannot render outside its track;
      // the READOUT above is never clamped, so a value the producer sent out of
      // range still shows the producer's own number.
      winFraction: hasWin ? Math.max(0, Math.min(1, raw)) : null,
      why,
    })
  }

  return { rows, totalCount: allOptions.length }
}

/**
 * ⭐⭐ WHICH ABSENCES MAKE AN ANALYSIS "PARTIAL" — MEASURED ON THE LIVE WIRE.
 *
 * `completeness.missing` is ONE list answering TWO questions (CLAUDE.md trap
 * 21): a REQUIRED result that did not arrive, and an OPTIONAL enrichment this
 * product does not populate on the live path. Only the first makes an analysis
 * partial. Merging them put a permanent warning on the tab's first line.
 *
 * ⚠ MEASURED on deployed `fc46e7ee`, driving a real completed guest run
 * (4 options, 20 report keys): `report.drivers[]` carry `{label, polarity,
 * strength, contribution, nodeId}` and NONE of `sensitivity_score` /
 * `elasticity` / `importance_score`; `results.drivers` — the payload the
 * derivation unions in — is `undefined`. So `sensitivity` is missing on EVERY
 * run of this shape. `decision_review` is skipped by configuration on staging.
 *
 * ⭐ THE HERO HAD ALREADY DIAGNOSED THIS AND THIS TAB WALKED INTO IT.
 * `buildHeroModel.ts:244` refuses to gate on `completeness.status` in these
 * words: that verdict "turns 'partial' when OPTIONAL enrichment is absent
 * (e.g. the CEE decision review is skipped when coaching autofire is off, as
 * on staging)" and gating on it "would show 'some steps did not complete'
 * over a perfectly computed run".
 *
 * Naming the absences made it louder, not safer: the first line of a healthy
 * run read "This analysis is partial — the sensitivity check, the decision
 * review did not come back", while the canvas beside it rendered a sensitivity
 * chip and the chat rendered the review's own prose.
 *
 * ⚠ `top_drivers` is OPTIONAL BY THE DERIVATION'S OWN ACCOUNT: its comment in
 * `useResultCompleteness.ts` says absence is "no top drivers computed", not
 * "partial" — and it is the ONE key that adds no reason code, which is the
 * tell that it was written as information rather than as a verdict.
 *
 * ⚠ `recommendation_stability` is absent here because it is always added
 * ALONGSIDE `robustness_level`, which already covers that condition — and it
 * is deliberately unlabelled (see `analysisNewCopy.ts`; a CI guard enforces
 * it). Nothing is hidden by this set: the raw completeness verdict and its
 * full key list still render in the diagnostics row above.
 */
const REQUIRED_RESULT_KEYS: ReadonlySet<string> = new Set([
  'win_probability',
  'expected_outcome',
  'robustness_level',
])

// ── STATUS ──────────────────────────────────────────────────────────────────

function buildStatus(inputs: AnalysisNewViewModelInputs): AnalysisNewStatus {
  const { data } = inputs
  const status = data.recommendation.analysisStatus
  const missingRequired = (data.completeness?.missing ?? []).filter((k) =>
    REQUIRED_RESULT_KEYS.has(k),
  )
  return {
    isPreRun: inputs.isPreRun,
    isRunning: inputs.isRunning,
    isStale: inputs.isStale,
    /**
     * ⚠ 'changed' IS A CLAIM ABOUT THE WORLD; 'unconfirmed' IS A CLAIM ABOUT
     * OUR EVIDENCE. The dock hands this surface one boolean covering both, so
     * without the reason the panel asserted the first for either.
     * Fail-closed: an absent or unrecognised reason reads as 'unconfirmed',
     * because not knowing why is itself a cannot-confirm.
     */
    staleKind: inputs.isStale ? (inputs.staleReason === 'changed' ? 'changed' : 'unconfirmed') : null,
    // 'partial' is the producer's own word for an incomplete result. The
    // completeness verdict is the second, independent source — but only its
    // REQUIRED keys speak for it (see REQUIRED_RESULT_KEYS above).
    isProvisional: status === 'partial' || missingRequired.length > 0,
    // Producer-owned, verbatim. Never authored here.
    statusNote: data.recommendation.statusReason ?? null,
    /**
     * ⚠ UNKNOWN KEYS ARE DROPPED, NOT RENDERED. The vocabulary is closed
     * today, but a producer that adds a key must not put a raw token like
     * `foo_bar` on screen — an unrecognised name is worse than the generic
     * sentence it would replace.
     */
    missingResults: missingRequired
      .map((k) => COPY.status.missingResultLabels[k])
      .filter((label): label is string => Boolean(label)),
  }
}

/**
 * ⭐ ONE SIGNAL, ONE PRIMARY SURFACE.
 *
 * ⚠ MEASURED ON A REAL COMPLETED RUN, NOT THEORISED. With "At a glance" above
 * it, ALL THREE key insights were restatements of what the glance had just
 * said, roughly one viewport apart:
 *
 *   glance verdict   "Sensitive — small changes could flip this result"
 *   key insight #1   "This result is sensitive to uncertainty /
 *                     small changes could flip this result"
 *
 *   glance headline  "Status Quo … currently scores higher"
 *   key insight #3   "Status Quo … currently scores higher"
 *
 *   glance condition "Could change if Price increase … moves from 0 to 1"
 *   key insight #2   "Price increase for new customers is the hinge"
 *
 * Key insights was therefore contributing nothing — the section existed, took
 * vertical space, and told the reader only what they had already read. The
 * glance is the PRIMARY surface for these three, so they leave the list.
 *
 * ⚠ SUPPRESSION IS KEYED TO WHAT THE GLANCE ACTUALLY RENDERED, not to the
 * insight ids alone. When the producer withholds the leader the glance shows no
 * headline — and the comparative insight then belongs in the list, because
 * nothing above is saying it. A blanket id filter would silently delete a
 * finding on exactly the runs where it is the only place it appears.
 */
function dedupeAgainstGlance(
  section: { insights: AnalysisNewFinding[]; candidateCount: number },
  glance: AtAGlance,
): { insights: AnalysisNewFinding[]; candidateCount: number } {
  const shown = new Set<string>()
  // Robustness and the comparative read are no longer produced as insights at
  // all — the glance is their only surface. The hinge IS still produced, from a
  // DIFFERENT producer than the glance condition (`topFragileEdge` vs
  // `flipThresholds`), so it is suppressed only when the glance actually
  // rendered a condition.
  if (glance.condition) shown.add('insight:hinge')
  if (shown.size === 0) return section
  return {
    insights: section.insights.filter((i) => !shown.has(i.id)),
    // The candidate count still reports what the RUN produced, not what
    // survived deduplication — the cap disclosure must not shrink silently.
    candidateCount: section.candidateCount,
  }
}

// ── THE ADAPTER ─────────────────────────────────────────────────────────────

export function buildAnalysisNewViewModel(
  inputs: AnalysisNewViewModelInputs,
): AnalysisNewViewModel {
  const { data, recommendations, isStale, nodeValueSources } = inputs
  const glance = buildAtAGlance(data, nodeValueSources)

  /**
   * ⚠⚠ NO RUN, NOTHING DERIVED FROM A RUN — the same rule `buildDeeper` applies,
   * applied to every run-derived section rather than to one of them.
   *
   * Key insights, the glance, drivers and uncertainty are all readings OF AN
   * ANALYSIS. Strengthen is not: it is derived from the MODEL, which exists
   * before any run, which is why a real grounded recommendation ("Define what
   * success looks like", sourced from the goal having no threshold) correctly
   * appears on the mounted pre-run surface and is deliberately left alone here.
   *
   * ⚠ THE FAILURE MODE THIS CLOSES IS NOT HYPOTHETICAL-ONLY. `useResultsSectionData`
   * hands back non-null defaults, so "no findings pre-run" was a property of the
   * DATA rather than of this adapter — true on the runs that happened to be
   * driven, and unguaranteed. Gating here makes it a property of the code, and
   * the pre-run assertions in `AnalysisNewTabBody.spec.tsx` bind to it.
   */
  const preRun = inputs.isPreRun

  return {
    status: buildStatus(inputs),
    atAGlance: preRun
      ? { headline: null, leaderLabel: null, winShare: null, winFraction: null, comparisonScope: { kind: 'unresolved' as const }, comparativeClaim: 'none' as const, verdict: null, drivers: [], influenceIsSetRelative: false, condition: null, inputProvenance: null }
      : glance,
    // ⚠ GATED PRE-RUN LIKE EVERY OTHER RUN-DERIVED SECTION. The option NODES
    // exist before any analysis, but "how the options compare" is a reading OF
    // A RUN — and pre-run the `notAnalysed` derivation is itself suppressed
    // (it is guarded on the run having produced SOME per-option result), so
    // every option would arrive unmarked and render as analysed-with-no-share.
    // A list of names under that heading is a run report about a run that has
    // not happened. `ModelStrip` already says what the model contains.
    /**
     * ⚠ GATED PRE-RUN, for the same reason as the comparison below: both
     * readings are readings OF A RUN. Pre-run there is no outcome centre and no
     * goal probability, so `buildModelImplication` would return `none` anyway —
     * the explicit gate states the intent rather than relying on the absence of
     * data to produce the right answer by accident.
     */
    modelImplication: preRun ? { kind: 'none' } : buildModelImplication(data),
    optionsComparison: preRun
      ? { rows: [], totalCount: 0 }
      : buildOptionsComparison(data),
    keyInsights: preRun
      ? { insights: [], candidateCount: 0 }
      : dedupeAgainstGlance(buildKeyInsights(data, recommendations, isStale), glance),
    strengthen: {
      // The FULL ordered list. The preview length is applied at the mount so
      // the section can disclose, and reach, its own tail.
      interventions: recommendations,
      scienceGrounding: inputs.scienceGrounding ?? {},
    },
    drivers: preRun
      ? {
          findings: [],
          totalCount: 0,
          influenceIsSetRelative: false,
          referenceOptionLabel: null,
          // ⚠ PRE-RUN, THE PRODUCER'S STATUS IS A DEFAULT, NOT A STATEMENT —
          // `useResultsSectionData` hands back 'computed' when nothing has run.
          // Reading it through here would let the surface describe a run that
          // never happened, which is the defect `buildDeeper` documents. The
          // pre-run branch renders no empty message at all, so 'unavailable' is
          // inert here and is the honest token for "we have nothing".
          driversStatus: 'unavailable' as const,
          suppressedZeroCount: 0,
        }
      : buildDrivers(data, recommendations),
    uncertainty: preRun
      ? { findings: [], evidenceAssessed: false, decisionVoi: 'not_computed' as const }
      : buildUncertainty(data, recommendations),
    deeper: buildDeeper(inputs),
  }
}

export const ANALYSIS_NEW_LIMITS = {
  KEY_INSIGHT_PREVIEW,
  STRENGTHEN_PREVIEW,
  DRIVER_PREVIEW,
  UNCERTAINTY_PREVIEW,
} as const

export { COPY as ANALYSIS_NEW_VIEW_COPY }
