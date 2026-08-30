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
import type { Recommendation } from '../strengthen/strengthenTypes'
import { deriveComparisonScope } from '../utils/goalAnchorCopy'
import { notAnalysedReasonCopy } from '../utils/notAnalysedCopy'
import type {
  ConditionalWinner,
  DriverItem,
  EvidenceGapItem,
  UncertaintyItem,
} from '../types'
import type { ResultsSectionDataReturn } from '../useResultsSectionData'
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
  GlanceVerdict,
  GlanceComparisonScope,
  GlanceComparativeClaim,
} from './analysisNewTypes'

/** §2 of the brief: "a very small number of high-value insights". */
const KEY_INSIGHT_CAP = 4
/** §2: "1–3 prioritised reasoning interventions". */
const STRENGTHEN_CAP = 3
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
  /** Total active engine output BEFORE the cap, for honest disclosure. */
  recommendationCandidateCount: number
  isPreRun: boolean
  isRunning: boolean
  /** The displayed report predates the current model (freshness only). */
  isStale: boolean
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

  // 3. Strategic tension: the leading option DEPENDS on a factor's value.
  //    A genuine "it depends" finding, and the most reasoning-shaped thing the
  //    producer emits. Neutral arm when the winner identity was withheld.
  const cw: ConditionalWinner | undefined = conf.conditionalWinners?.[0]
  if (cw) {
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
  const usable = out.filter((i) => i.implication.trim().length > 0 || i.detail)
  return { insights: usable.slice(0, KEY_INSIGHT_CAP), candidateCount: usable.length }
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

function buildUncertainty(
  data: ResultsSectionDataReturn,
  recommendations: Recommendation[],
): AnalysisNewViewModel['uncertainty'] {
  const conf = data.confidence
  const findings: AnalysisNewFinding[] = []

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
    // A threshold row gets the producer's own variable as its label; everything
    // else gets the sentence cut to a label length.
    const headlineText = u.threshold
      ? `${u.threshold.variable} could tip the result`
      : truncateAtWordBoundary(text, 80)
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
    totalCount: findings.length,
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
  if (inputs.isPreRun) return { groups: [] }

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
  // and gaps" (see `buildUncertainty` step 4): diagnostics, carrying raw node
  // ids the producer does not humanise, three of them rendering one headline on
  // a real run. Real provenance, kept available one level down where technical
  // material belongs, and never rewritten.
  const inferenceRows = (conf.inferenceWarnings ?? [])
    .map((w) => {
      const message = (w as { message?: string; description?: string }).message
        ?? (w as { description?: string }).description
      return message ? { label: (w as { code?: string }).code ?? 'Model gap', value: message } : null
    })
    .filter((r): r is { label: string; value: string } => r !== null)
  if (inferenceRows.length) groups.push({ title: 'Model gaps the analysis worked around', rows: inferenceRows })

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

  return { groups }
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

function buildAtAGlance(
  data: ResultsSectionDataReturn,
  recommendations: Recommendation[],
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
    winPercentLabel: winPct,
    winFraction,
    comparisonScope,
    comparativeClaim,
    verdict: verdictBlock,
    drivers,
    influenceIsSetRelative: setRelative,
    condition: glanceCondition(data),
    primaryInterventionId: recommendations[0]?.id ?? null,
  }
}

// ── STATUS ──────────────────────────────────────────────────────────────────

function buildStatus(inputs: AnalysisNewViewModelInputs): AnalysisNewStatus {
  const { data } = inputs
  const status = data.recommendation.analysisStatus
  return {
    isPreRun: inputs.isPreRun,
    isRunning: inputs.isRunning,
    isStale: inputs.isStale,
    // 'partial' is the producer's own word for an incomplete result. The
    // completeness verdict is the second, independent source.
    isProvisional: status === 'partial' || data.completeness.status === 'partial',
    // Producer-owned, verbatim. Never authored here.
    statusNote: data.recommendation.statusReason ?? null,
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
  const { data, recommendations, recommendationCandidateCount, isStale } = inputs
  const glance = buildAtAGlance(data, recommendations)

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
      ? { headline: null, leaderLabel: null, winShare: null, winPercentLabel: null, winFraction: null, comparisonScope: { kind: 'unresolved' as const }, comparativeClaim: 'none' as const, verdict: null, drivers: [], influenceIsSetRelative: false, condition: null, primaryInterventionId: glance.primaryInterventionId }
      : glance,
    keyInsights: preRun
      ? { insights: [], candidateCount: 0 }
      : dedupeAgainstGlance(buildKeyInsights(data, recommendations, isStale), glance),
    strengthen: {
      interventions: recommendations.slice(0, STRENGTHEN_CAP),
      candidateCount: recommendationCandidateCount,
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
      ? { findings: [], totalCount: 0, evidenceAssessed: false, decisionVoi: 'not_computed' as const }
      : buildUncertainty(data, recommendations),
    deeper: buildDeeper(inputs),
  }
}

export const ANALYSIS_NEW_LIMITS = {
  KEY_INSIGHT_CAP,
  KEY_INSIGHT_PREVIEW,
  STRENGTHEN_CAP,
  DRIVER_PREVIEW,
  UNCERTAINTY_PREVIEW,
} as const

export { COPY as ANALYSIS_NEW_VIEW_COPY }
