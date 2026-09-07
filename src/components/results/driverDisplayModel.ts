/**
 * driverDisplayModel — the SINGLE source of truth for the "which number does a
 * driver display, and how is it ranked" policy, shared by every surface that
 * shows factor influence: the results Drivers panel (useResultsSectionData),
 * the analysis hero (via the panel model), and the canvas graph badge
 * (useNodeDisplayMetadata).
 *
 * Codex R2-B2 / R3-B1 doctrine: the surface says "Influence", so the order,
 * the rank-1 crown, and the bar must all follow the SAME number — and that
 * number must be on ONE comparable basis across the whole factor set. Producer
 * `influence_score` is adopted only when EVERY ranked factor carries a finite
 * one; under partial coverage every factor falls back to per-set normalised
 * |elasticity|. Mixing the two (a producer 0.9 ranked against a fallback 0.2)
 * is exactly the "#1 with a lower displayed influence" contradiction the
 * review caught — so the policy lives here, once, and both hooks import it
 * rather than keeping their own copy that can drift.
 *
 * `provenance` is returned so a surface can make the basis explicit (e.g. a
 * debug readout or a future "producer / derived" marker) without re-deriving
 * the decision.
 */

import type { DriverSemanticLabel } from './types'

export type DriverDisplayProvenance = 'influence_score' | 'normalised_elasticity'

export interface DriverDisplayEntry {
  /** The 0-1 value the surface displays AND ranks by. */
  value: number
  /** Which basis produced `value` — explicit so no consumer re-decides it. */
  provenance: DriverDisplayProvenance
}

/**
 * The bases that may license a numeric analysis claim in mounted UI copy.
 *
 * ⚠⚠ THIS SAID "`influence_score` is an absolute producer scale, not a share"
 * UNTIL 6 Sep 2026, AND THAT SENTENCE PROPAGATED. It is the premise PR #1221
 * cited, in good faith and by name, when it removed a DIFFERENT falsehood from
 * the same tooltip clause and deliberately kept the scale wording: "the
 * producer's own declared semantics". A careful lane got a false sentence from
 * this file and had no reason to doubt it.
 *
 * BOTH stamped bases are SET-RELATIVE. `influence_score` is the producer's
 * normalisation against `max|influence|` — its top row is 1.0 BY CONSTRUCTION —
 * and `normalised_elasticity` is this app's own normalisation of a raw
 * elasticity. They are two different NORMALISATIONS, not absolute vs relative.
 *
 * Measured on data rather than argued from code — and NARROWED 6 Sep 2026 to
 * what is actually measured, after a reviewer refuted the universal this line
 * used to state ("every capture … twelve files"). Of the 21 JSON files under
 * `src/` carrying `influence_score`, every one whose maximum is NON-ZERO maxes
 * at EXACTLY 1.0 (live staging responses among them), and none exceeds 1.0.
 * ONE is uniformly 0 — `seeded-2026-08-17-w2d-analysis-turn.json`, a real
 * `response_version: 2` turn — which is the degenerate run, not a counter-scale.
 * The sweep is DERIVED in `influenceIsNeverCalledAbsolute.spec.ts`, so it REDs
 * if either half changes.
 *
 * ⚠ The distinction between them is real and worth keeping — one is a producer
 * measurement and the other our fallback, which is why only the first licenses
 * a FIGURE. That is a provenance question, not a scale one, and conflating the
 * two is what this sentence was doing.
 *
 * Pre-analysis influence and value of information remain separate producer
 * metrics and must never borrow each other's label.
 */
export type AnalysisMetricBasis =
  | DriverDisplayProvenance
  | 'pre_analysis_influence'
  | 'value_of_information'

export type PermittedAnalysisMetricLanguage =
  /* ⚠ `'absolute_influence_score'` WAS HERE AND IS DELETED, NOT DEPRECATED.
     No basis is absolute — see `PERMITTED_LANGUAGE_BY_BASIS` — so leaving the
     member in the union would keep three `switch` arms alive for a state
     nothing can produce, and would let a future mapping quietly reach for it
     again. Removing it makes that a type error. */
  | 'set_relative_influence'
  | 'pre_analysis_influence_score'
  | 'value_of_information'

/** A numeric claim can travel only as this indivisible policy result. */
export interface ResolvedAnalysisMetric {
  /** Producer or policy value, unchanged. */
  value: number
  /** Attested meaning of that value. */
  basis: AnalysisMetricBasis
  /** The only class of language the mounted consumer may generate. */
  permittedLanguage: PermittedAnalysisMetricLanguage
}

const PERMITTED_LANGUAGE_BY_BASIS: Record<AnalysisMetricBasis, PermittedAnalysisMetricLanguage> = {
  /**
   * ⭐⭐ `influence_score` IS SET-RELATIVE. IT WAS MAPPED TO ABSOLUTE LANGUAGE,
   * AND THAT MAPPING IS WHAT LICENSED "Influence score 100%".
   *
   * The producer divides every factor by `max|influence|`, so the top row is
   * **1.0 by construction** — driver count is irrelevant, and 100% means
   * "largest in this set" and nothing more. Confirmed independently from this
   * side before the change, and stated as measured (see the file header for the
   * 6 Sep narrowing): of the 21 JSON files under `src/` carrying
   * `influence_score`, every one whose maximum is non-zero maxes at EXACTLY 1.0,
   * none exceeds 1.0, and one is uniformly 0. A quantity that is either exactly
   * 1 at its top or uniformly zero is a ratio to its own maximum.
   *
   * ⚠⚠ AND WHY IT IS A TRUST DEFECT RATHER THAN A WORDING ONE.
   * `live-influence-score-one-2026-08-23.json`, a real staging response, holds
   * `"Monthly Payroll Burn"` at `influence_score: 1` with `elasticity: 0`. That
   * is a DEMOTED LEVER — the producer zeroes sensitivity, elasticity and
   * value-of-information for a lever and deliberately leaves the structural
   * weight alone. So the panel said a factor "has an influence score of 100%"
   * about one the same response says moves nothing.
   *
   * ⚠ THE TWO BASES ARE NOT ABSOLUTE-vs-RELATIVE. They are two different
   * NORMALISATIONS: this one is the producer's (against max |influence|),
   * `normalised_elasticity` is this app's own. The distinction is real and
   * worth keeping; only the label was wrong.
   */
  influence_score: 'set_relative_influence',
  normalised_elasticity: 'set_relative_influence',
  pre_analysis_influence: 'pre_analysis_influence_score',
  value_of_information: 'value_of_information',
}

function isAnalysisMetricBasis(value: unknown): value is AnalysisMetricBasis {
  return typeof value === 'string' && value in PERMITTED_LANGUAGE_BY_BASIS
}

/**
 * Canonical value + basis + permitted-language resolver.
 *
 * Absence fails closed. Zero remains a real value. The resolver does not
 * clamp, scale, normalise, or otherwise modify the supplied number.
 */
export function resolveAnalysisMetric(input: {
  value: unknown
  basis: AnalysisMetricBasis | null | undefined
}): ResolvedAnalysisMetric | null {
  if (typeof input.value !== 'number' || !Number.isFinite(input.value)) return null
  if (!isAnalysisMetricBasis(input.basis)) return null
  return {
    value: input.value,
    basis: input.basis,
    permittedLanguage: PERMITTED_LANGUAGE_BY_BASIS[input.basis],
  }
}

/**
 * The smallest |elasticity| this module will treat as a MEASUREMENT rather
 * than as an absent one.
 *
 * ⚠ ONE OWNER FOR THE SENTINEL, BECAUSE THE ZERO IT PRODUCES IS NOT A VALUE.
 * `computeNormalisedInfluences` maps a degenerate set to 0 for every factor —
 * that 0 is a SIGNAL ("we have no magnitude data"), not a measured influence,
 * and a consumer that cannot tell it from a real 0 will print `Influence 0%`
 * about a factor nothing measured. It was an unnamed inline `0.001` here, so
 * no consumer could ask the question at all; naming it is what makes
 * `hasMeaningfulMagnitude` below derivable rather than a second copy.
 */
export const MAGNITUDE_DATA_EPSILON = 0.001

/**
 * Does this factor set carry magnitude data at all — i.e. will
 * `computeNormalisedInfluences` return real proportions rather than the
 * all-zero sentinel?
 *
 * Deliberately the exact complement of that function's degenerate branch
 * (`actualMax < MAGNITUDE_DATA_EPSILON`), because the question a consumer is
 * really asking is "is the number I got back a measurement or the sentinel?",
 * and only the sentinel's PRODUCER can answer that. Derived from it, not
 * copied beside it.
 *
 * ⚠ A NAMED, UNFOLDED RIVAL, so a later sweep does not have to rediscover it.
 * `useResultsSectionData.ts:2780` computes the Drivers panel's
 * `hasMagnitudeData` as `maxRawElasticity > 0.001` — the same concept, but
 * `>` where this is `>=`. The two therefore DISAGREE on a set whose max
 * magnitude is exactly `0.001`: the panel calls it magnitude-less and shows
 * direction-only, while `computeNormalisedInfluences` does NOT degenerate and
 * normalises that factor to 1.0. This module binds to the sentinel's producer
 * because that is the only correct binding for "is my number real"; the panel
 * boundary is left alone deliberately (it is another lane's file, and moving a
 * threshold that gates a whole panel's display mode is not a drive-by change).
 * Rowed rather than folded.
 */
export function hasMeaningfulMagnitude(
  factors: ReadonlyArray<{ rawElasticity: number }>,
): boolean {
  if (factors.length === 0) return false
  const max = Math.max(
    ...factors.map((f) => (Number.isFinite(f.rawElasticity) ? Math.abs(f.rawElasticity) : 0)),
  )
  return max >= MAGNITUDE_DATA_EPSILON
}

/**
 * The metric fields that can put a real magnitude on a driver row, in the
 * order the feed's normaliser consults them.
 *
 * ⚠ THIS LIST IS A MIRROR OF `normalizeFactorSensitivity`'s CHAIN
 * (`useResultsSectionData.ts`), so it gets a FAIL-LOUD completeness guard
 * rather than a promise to keep it in sync: `driverRowMetricPresence.spec.ts`
 * drives the real feed once per member (asserting the field IS in the chain)
 * and once per plausible NON-member such as `contribution` (asserting it is
 * NOT). A field added to or removed from the chain REDs that spec.
 */
const MAGNITUDE_FIELDS = [
  'elasticity',
  'sensitivity_score',
  'sensitivity',
  'importance_score',
] as const

/**
 * Did this wire row carry data into the MAGNITUDE chain — the chain that
 * produced its `rawElasticity`?
 *
 * ⚠ WHY THIS EXISTS: THE ZERO IS MANUFACTURED, NOT MEASURED. The feed's
 * normaliser ends its magnitude chain with a terminal `: 0`, and
 * `getRawElasticity` then reads that 0 back as though it were producer data.
 * So a row carrying NO magnitude field whatsoever arrives downstream
 * indistinguishable from a row that genuinely measured zero influence. The
 * Drivers panel absorbs this — a sub-threshold driver is filtered out of its
 * default view entirely (`isZeroImpact`, `hiddenZeroImpactCount`) — but the
 * canvas has no such filter and prints `Influence 0%` beside the node, which
 * is a measurement claim about a row nothing measured.
 *
 * ⚠⚠ THE QUESTION IS ABOUT THE MAGNITUDE CHAIN, NOT ABOUT "ANY METRIC"
 * (2026-09-04, review round 2). This was named `rowCarriesInfluenceMetric`
 * and returned true on a finite `influence_score` too. But `influence_score`
 * DOES NOT FEED `rawElasticity`: `normalizeFactorSensitivity` collapses only
 * `elasticity → sensitivity_score → sensitivity → importance_score → 0`, and
 * the producer score lands on the separate `influenceScore` field. So that
 * limb could only ever DECIDE anything when the displayed basis was NOT
 * `influence_score` — under complete producer coverage the call site's
 * `provenance === 'influence_score'` limb has already short-circuited. It was
 * redundant where it was right, and live only where it was wrong: a row
 * `{ influence_score: 0.9 }` with no magnitude field, in an
 * incomplete-coverage set, was licensed to render `Influence 0%` — a real 0.9
 * displayed as its opposite, which is worse than the unmeasured row this
 * guard was written to stop. Removing the limb, and renaming the function to
 * the question it actually answers, is the fix. Reachability is STRUCTURAL —
 * `selectDriverPolicyFeed` unions five heterogeneous sources and
 * `selectDriverDisplayModel` requires EVERY row to carry `influenceScore`, so
 * any mix drops the set onto the fallback basis (source 2, `legacyDrivers`,
 * builds rows with `sensitivity` and no `influence_score` at all). It is NOT
 * wire-witnessed: no live payload of this shape has been captured, so the
 * frequency is unknown and only the behaviour is measured.
 *
 * Absence fails closed; an explicit zero survives (`{ elasticity: 0 }` is a
 * real measurement and returns true).
 */
export function rowCarriesMagnitudeMetric(raw: unknown): boolean {
  if (raw == null || typeof raw !== 'object') return false
  const f = raw as Record<string, unknown>
  const finite = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v)
  return MAGNITUDE_FIELDS.some((field) => finite(f[field]))
}

/** Exported for the completeness guard only — never for policy decisions. */
export const MAGNITUDE_FIELD_NAMES: ReadonlyArray<string> = MAGNITUDE_FIELDS

/**
 * Normalise raw elasticities to 0-1 relative to the largest magnitude in the
 * set (top = 1.0, others proportional). Degenerate sets (max |elasticity| <
 * MAGNITUDE_DATA_EPSILON) map every factor to 0 so a direction-only display is
 * triggered instead of misleading ~100% bars. Kept as a named export because
 * several surfaces consume the normalised value directly for semantic-label
 * thresholds.
 */
export function computeNormalisedInfluences(
  factors: Array<{ key: string; rawElasticity: number }>,
): Map<string, number> {
  const result = new Map<string, number>()

  if (factors.length === 0) {
    return result
  }

  const absoluteValues = factors.map((f) => Math.abs(f.rawElasticity))
  const actualMax = Math.max(...absoluteValues)

  // No meaningful magnitude data → all zero (direction-only display upstream).
  if (actualMax < MAGNITUDE_DATA_EPSILON) {
    factors.forEach((f) => result.set(f.key, 0))
    return result
  }

  factors.forEach((f) => {
    const normalised = Math.min(1, Math.abs(f.rawElasticity) / actualMax)
    result.set(f.key, normalised)
  })

  return result
}

/**
 * Resolve the display value + provenance for every factor under the
 * complete-metric-set policy. This is THE policy — every driver surface must
 * render and rank by `value` from this map, never `influenceScore ??
 * normalisedInfluence` (which mixes bases under partial producer coverage).
 */
/**
 * Shared wire-row → policy-input extractor (Lane 2 review fold): the policy
 * FUNCTION being shared means nothing if each surface feeds it different
 * inputs — the coverage-complete verdict and the normalisation base must be
 * computed from the SAME fields everywhere.
 *
 * Field semantics mirror the drivers panel (useResultsSectionData
 * normaliseFactorSensitivity, the reference implementation):
 * - producer influence: snake_case `influence_score` ONLY (the panel never
 *   reads camelCase, so accepting it elsewhere flips the coverage verdict
 *   per surface);
 * - magnitude chain: `elasticity` → `sensitivity_score` → `sensitivity` →
 *   `importance_score` (the panel includes `sensitivity` third; feeders that
 *   omitted it ranked a different row-set).
 * Returns null when the row has no id or no finite metric at all (absence is
 * never defaulted).
 */
export function extractPolicyRow(
  raw: unknown,
): { key: string; influenceScore: number | null; rawElasticity: number } | null {
  if (raw == null || typeof raw !== 'object') return null
  const f = raw as Record<string, unknown>
  const key = (f.factor_id ?? f.factorId ?? f.node_id ?? f.nodeId) as string | undefined
  if (!key) return null
  const producer =
    typeof f.influence_score === 'number' && Number.isFinite(f.influence_score)
      ? f.influence_score
      : null
  const magnitude =
    typeof f.elasticity === 'number' ? f.elasticity
      : typeof f.sensitivity_score === 'number' ? f.sensitivity_score
        : typeof f.sensitivity === 'number' ? f.sensitivity
          : typeof f.importance_score === 'number' ? f.importance_score
            : null
  if (producer === null && magnitude === null) return null
  return {
    key,
    influenceScore: producer,
    rawElasticity: magnitude === null || !Number.isFinite(magnitude) ? 0 : Math.abs(magnitude),
  }
}

export function selectDriverDisplayModel(
  factors: ReadonlyArray<{ key: string; influenceScore?: number | null; rawElasticity: number }>,
): Map<string, DriverDisplayEntry> {
  const coverageComplete =
    factors.length > 0 &&
    factors.every((f) => typeof f.influenceScore === 'number' && Number.isFinite(f.influenceScore))

  const normalisedMap = computeNormalisedInfluences(
    factors.map((f) => ({ key: f.key, rawElasticity: f.rawElasticity })),
  )

  const out = new Map<string, DriverDisplayEntry>()
  for (const f of factors) {
    if (coverageComplete && typeof f.influenceScore === 'number') {
      out.set(f.key, { value: f.influenceScore, provenance: 'influence_score' })
    } else {
      out.set(f.key, { value: normalisedMap.get(f.key) ?? 0, provenance: 'normalised_elasticity' })
    }
  }
  return out
}

/**
 * Resolve the exact value and basis that may back generated driver copy.
 *
 * A stamped display pair is accepted only when it agrees with the field that
 * attests that basis. This makes a contradictory display value/basis fail
 * closed instead of certifying one number and printing another. Unstamped
 * legacy rows read directly from the basis-bearing producer field; a bare
 * `displayInfluence` never licenses a claim. Missing values return null and
 * an explicit zero survives.
 */
export function resolveDriverClaimBasis(
  driver: {
    displayInfluence?: number | null
    displayProvenance?: DriverDisplayProvenance | null
    influenceScore?: number | null
    normalisedInfluence?: number | null
  } | null | undefined,
): ResolvedAnalysisMetric | null {
  if (!driver) return null
  const finite = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value)

  if (driver.displayProvenance != null) {
    if (!isAnalysisMetricBasis(driver.displayProvenance)) return null
    if (!finite(driver.displayInfluence)) return null
    const attestedValue = driver.displayProvenance === 'influence_score'
      ? driver.influenceScore
      : driver.normalisedInfluence
    if (!finite(attestedValue) || !Object.is(attestedValue, driver.displayInfluence)) return null
    return resolveAnalysisMetric({
      value: driver.displayInfluence,
      basis: driver.displayProvenance,
    })
  }

  if (finite(driver.influenceScore)) {
    return resolveAnalysisMetric({ value: driver.influenceScore, basis: 'influence_score' })
  }
  if (finite(driver.normalisedInfluence)) {
    return resolveAnalysisMetric({
      value: driver.normalisedInfluence,
      basis: 'normalised_elasticity',
    })
  }
  return null
}

/**
 * Rank comparator on a resolved display model: value descending, then
 * elasticity as the tie-break, then key alphabetically for determinism.
 * The graph badge ranks with this so its order matches the panel's, both keyed
 * off the shared `value`.
 *
 * PRECONDITION: `elasticity` must be an UNSIGNED magnitude. This sorts the
 * number as given — it does not abs — so a signed input silently ranks a
 * positive driver above an equal-magnitude negative one, which is how the
 * canvas once forked from the panel on rows both surfaces valued identically.
 * Every feeder abs's at construction (extractPolicyRow below;
 * DriverPolicyRow.rawElasticity in useResultsSectionData). Deliberately NOT
 * abs'd here: absorbing a signed value would mask the producer-side contract
 * break rather than surface it, and would blind the cross-surface order pins
 * to exactly the regression they exist to catch.
 */
export function compareByDisplayModel(
  a: { value: number; elasticity: number; key: string },
  b: { value: number; elasticity: number; key: string },
): number {
  if (b.value !== a.value) return b.value - a.value
  if (b.elasticity !== a.elasticity) return b.elasticity - a.elasticity
  return a.key.localeCompare(b.key)
}

/**
 * The smallest gap in displayed influence that the panel is willing to call a
 * DIFFERENCE. Below it, two factors are shown as equally influential and no
 * copy may rank one above the other.
 *
 * ⚠ ONE OWNER, THREE CONSUMERS. This was previously an unnamed `0.01` inlined
 * at the Drivers panel's equal-influence note, while the rank-1 crown used no
 * tie notion at all and the dominance nudge used none either — so the same
 * screen could print "these factors have similar influence" beside a badge
 * crowning one of them "Top driver". A tie is one concept; it gets one number.
 */
export const INFLUENCE_TIE_EPSILON = 0.01

/**
 * Do these factors have a SINGLE leader — one factor clear of the next
 * DISTINCT factor by more than `INFLUENCE_TIE_EPSILON`?
 *
 * ⚠ EXTRACTED, NOT INVENTED (2026-08-29). This predicate already existed,
 * inlined inside `resolveDriverSemanticLabels`, where it correctly withheld the
 * panel's "biggest" crown at a tie. `OptionNode`'s "the #1 driver" claim
 * carried NO tie notion at all — so on a degenerate draft the leader node
 * crowned a factor the panel beside it was simultaneously describing as one of
 * several with "similar influence". Measured 2026-08-29 by executing ISL at
 * `28fe0c95`: 5 of 18 fresh drafts come back fully degenerate (every AI causal
 * edge at |mean| 0.5), and on such a draft five factors resolve to an IDENTICAL
 * display value — at which point `compareByDisplayModel` falls through value
 * and elasticity to `key.localeCompare`, and the crown goes to whichever factor
 * sorts first ALPHABETICALLY. Across 20 varied-magnitude reconstructions of
 * each degenerate draft the "biggest lever" was undetermined in 5 of 5.
 *
 * A crown is a COMPARATIVE claim and a tie cannot support one.
 *
 * ⚠⚠ IT TAKES IDENTITIES, NOT A BAG OF NUMBERS — AND THAT IS NOT A STYLE
 * CHOICE (2026-08-30, adversarial review of #964). This shipped for one round
 * as `hasClearInfluenceLeader(values: ReadonlyArray<number>)`, replacing an
 * identity test (`f.id === globalTopId`) at the leader node with a VALUE COUNT.
 * Measured at head `d5d11c1b`: `factor_sensitivity = [a@1.0, a@1.0, c@0.4]` —
 * ONE factor listed twice — made the leader node say *"tied for its biggest
 * lever"* where the pre-#964 code correctly said *", the #1 driver"*. A single
 * duplicated row committed BOTH harms at once: it SUPPRESSED a genuine 2.5x
 * leader and ASSERTED a tie that does not exist, the factor "tied" with itself.
 * Counting values cannot tell one factor listed twice from two factors — only
 * an id can, which is the standing rule (bind by IDENTITY, never by a value
 * predicate another object could satisfy) that the tie fix was itself applying.
 *
 * ⚠ Reachability of a duplicated `factor_id` is UNESTABLISHED, deliberately.
 * The in-UI route is closed (`normaliseGraphIds` in `utils/nodeIdNormalisation`
 * resolves collisions against `usedIds`, so the id map is injective); the
 * trigger needs the producer — CEE / PLoT / ISL — to emit two
 * `factor_sensitivity` rows under one `factor_id`, and no lane has reached that
 * location to say either way. The binding is correct regardless, so this is not
 * priced as a reachability question.
 *
 * A single-member set has no runner-up, so its member is trivially clear. An
 * empty set has no leader to be clear. Two entries sharing one id are ONE
 * factor: a factor is not tied with itself.
 *
 * ⚠⚠ THE COMPLETE CONSUMER LIST, AND WHAT THIS FUNCTION STILL DOES **NOT**
 * OWN. This header claimed, for one round, that *"both surfaces now ask this
 * one function, so neither can drift into its own idea of a tie"* — **false
 * when written**, and exactly the label-drift this estate keeps paying for: an
 * honest scope overwritten by a reassuring one teaches every later lane to
 * stop looking. Derived by `command grep -raIn` over `src/`, 2026-08-30.
 *
 * THREE consumers ask this function:
 * - `resolveDriverSemanticLabels` below — the Drivers panel's "biggest" badge.
 * - `canvas/nodes/OptionNode.tsx` — the leader node's "#1 driver" claim, over
 *   two DIFFERENT sets (all factors; then this option's levers).
 * - `canvas/hooks/useNodeDisplayMetadata.ts` — `sensitivityRank`, added
 *   2026-08-30. It sorts by `compareByDisplayModel` and takes the index, and
 *   that comparator falls through value → elasticity → `key.localeCompare`, so
 *   it used to RESOLVE a tie instead of reporting one: five byte-identical
 *   factors fed in shuffled order ranked `#1 fac_a … #5 fac_e`, ALPHABETICAL.
 *   It reaches the user as `#N` at `NodeInspector.tsx`, a "Key driver #N"
 *   canvas badge at `BaseNode.tsx`, "Connects factor ranked #N in influence"
 *   at `EdgeInspector.tsx`, an ordinal at `inspector-v2/shared/ImportanceBar`,
 *   coaching gates at `inspector/coachingText.ts`, four `inspector-v2/panels/*`
 *   and icon selection at `hooks/useScienceIcons.ts` — twelve non-test files
 *   off one number, which is why it is gated at the single producer rather
 *   than at each render site.
 *
 * These do NOT, and are named so a later sweep does not have to rediscover them:
 * - `components/results/TriageActionCardsBody.tsx:486-488` — a hand-maintained
 *   inline rival (`> INFLUENCE_TIE_EPSILON`, same boundary), additionally gated
 *   on `basis === 'influence_score'` for both rows. Correct today; it should be
 *   folded in, and is not, deliberately.
 * - `components/results/DriversSection.tsx:1015-1019` — `(max - min) <=
 *   INFLUENCE_TIE_EPSILON`. This answers a DIFFERENT question ("is the whole
 *   set flat?") and is RIGHT not to be unified; named only so it is not
 *   mistaken for a third copy of this one.
 */
export function hasClearInfluenceLeader(
  entries: ReadonlyArray<{ id: string; value: number }>,
): boolean {
  // ONE QUESTION, ONE FUNCTION. "Is rank 1 clear?" is the depth-1 case of
  // "how many leading ranks are clear?" — see `determinedRankDepth`. Keeping a
  // separate body here would be two implementations of one tie notion, which
  // is the drift this module exists to prevent. Equivalence with the original
  // implementation is pinned over a corpus (including a randomised one) in
  // `determinedRankDepth.equivalence.spec.ts`, so this fold is measured rather
  // than argued.
  return determinedRankDepth(entries, 1) === 1
}

/**
 * How many LEADING ranks are genuinely determined — i.e. how deep can an
 * ordinal claim go before it stops being supported by the numbers?
 *
 * Returns the largest `k <= maxDepth` such that ranks 1…k are EACH clear of
 * the next distinct factor below them by more than `INFLUENCE_TIE_EPSILON`.
 * Ranks beyond `k` are decided by the comparator's tie-breaks, which the user
 * cannot see, and must not be claimed.
 *
 * ⚠⚠ WHY THIS EXISTS: THE GATE WAS NARROWER THAN THE BADGE IT GUARDS
 * (2026-09-03). `hasClearInfluenceLeader` asks ONLY "is the TOP unique?", and
 * `useNodeDisplayMetadata` then handed `#1`, `#2` AND `#3` out on the strength
 * of that single answer. Measured on a real user's model, eight factors came
 * back at `{1.00, 0.67 x6, 0.00}` — SIX of them tied. The leader gate passes
 * (1.00 is clear of 0.67), so `#2` and `#3` were awarded to two of the six
 * tied factors, selected by `compareByDisplayModel` falling through value →
 * elasticity → `key.localeCompare` — i.e. **alphabetical node id**. The badge's
 * own tooltip reads "ranked by influence on the outcome", so the product was
 * asserting a sensitivity ranking it did not have AND attributing it to a
 * measurement. The leader gate was tightened in 2026-08-30 and the `#2`/`#3`
 * gate was never widened to match; this closes that gap at the same owner
 * rather than minting a rival predicate.
 *
 * ⚠ THE DEPTH IS A PREFIX, DELIBERATELY. It stops at the first undetermined
 * rank instead of skipping past it, because printing a `#3` with no `#2`
 * beside it is its own kind of nonsense — the same set-level reasoning the
 * depth-1 gate already applied, now expressed as "how far does the ordering
 * hold" rather than "does it hold at all". Under the NO-HIDING ruling this
 * withholds a claim the data cannot support rather than hiding a finding.
 *
 * ⚠⚠ BUT IT IS NOT COSTLESS TO THE READER, AND THIS COMMENT USED TO SAY IT WAS
 * (2026-09-04, review round 2). It read "it does not hide a finding, since
 * every factor's influence VALUE and its basis are still surfaced beside it".
 * On the ordinary set that is true. On the MAGNITUDE-LESS set it is false, and
 * the falsifier is this PR's own sibling fix: when no factor carries a real
 * magnitude, `computeNormalisedInfluences` returns the all-zero sentinel, the
 * canvas withholds the influence figure as a manufactured zero, AND this depth
 * returns 0 — so the node renders no rank, no number and no explanation.
 * Measured, and pinned by `useNodeDisplayMetadata.rankGateBreadth.spec.ts`
 * ("THE DEFECT (set-level)"): `[{ elasticity: 0.0001 }, { elasticity: 0.0002 }]`
 * → `sensitivityRank = null`, `influence = null`, `influenceProvenance = null`,
 * `inSensitivityAnalysis = true`. Both channels go quiet at once. That state is
 * still the honest one — every number the badge could print there would be
 * invented — but it makes the deferred tie/silence copy MORE load-bearing, not
 * less, and it must not be justified by a sentence claiming the reader keeps
 * the number. Copy is rowed as CANVAS-BACKLOG S47.
 *
 * ⚠ IT TAKES IDENTITIES, NOT A BAG OF NUMBERS — inherited from
 * `hasClearInfluenceLeader` above and load-bearing for the same reason: two
 * entries sharing one id are ONE factor, and a factor is not tied with itself.
 * Duplicate ids collapse to their highest value before the gaps are measured,
 * which is exactly what the depth-1 case did by set-membership.
 *
 * A rank with no runner-up beneath it is trivially clear. An empty set has no
 * determined rank at all.
 */
export function determinedRankDepth(
  entries: ReadonlyArray<{ id: string; value: number }>,
  maxDepth: number,
): number {
  if (entries.length === 0 || maxDepth < 1) return 0

  // Collapse duplicate ids to their best value: one factor, one position.
  const bestById = new Map<string, number>()
  for (const e of entries) {
    const value = Number.isFinite(e.value) ? e.value : 0
    const seen = bestById.get(e.id)
    if (seen === undefined || value > seen) bestById.set(e.id, value)
  }

  const values = [...bestById.values()].sort((a, b) => b - a)

  let depth = 0
  const limit = Math.min(maxDepth, values.length)
  for (let rank = 1; rank <= limit; rank += 1) {
    const isLast = rank === values.length
    // Clear of the next DISTINCT factor below, or there is no factor below.
    if (isLast || values[rank - 1] - values[rank] > INFLUENCE_TIE_EPSILON) {
      depth = rank
      continue
    }
    break
  }
  return depth
}

/**
 * Resolve every driver's semantic label FROM THE DISPLAY VALUES THEMSELVES.
 *
 * ⚠ WHY THIS LIVES HERE AND TAKES THE WHOLE SET. The badge used to be derived
 * by `getSemanticLabel(rank, normalisedInfluence)` in `useResultsSectionData`
 * — a SECOND basis (|elasticity| / max|elasticity|) unrelated to the number
 * printed beside it. Under complete producer coverage the two diverge freely,
 * and a factor the panel printed at **Influence 100%** was badged **"Lower
 * influence"** on a real user's screen. This module's own header has always
 * said the order, the crown and the bar must follow the SAME number; taking
 * the resolved display values as the only input is what makes the second basis
 * unreachable rather than merely discouraged.
 *
 * ⚠ THE CROWN YIELDS TO A TIE. "Rank 1 always gets 'biggest'" bought badge
 * uniqueness by inventing a distinction the data does not contain: at a tie
 * the winner is decided by the comparator's elasticity/key tie-breaks, which
 * the user cannot see. Three factors at 100% were badged "Top driver",
 * "High-impact driver" and "Lower influence". A crown is now awarded only to a
 * top that is clear of its runner-up by more than `INFLUENCE_TIE_EPSILON`;
 * tied factors all take the threshold label, so equal numbers read equal.
 *
 * Thresholds (0.50 strong / 0.20 moderate) are carried over unchanged from
 * UI-SEM-039. Both bases are set-relative 0-1 with the top at 1.0, so moving
 * the basis does not silently re-calibrate them.
 */
export function resolveDriverSemanticLabels(
  entries: ReadonlyArray<{ key: string; value: number }>,
): Map<string, DriverSemanticLabel> {
  const out = new Map<string, DriverSemanticLabel>()
  if (entries.length === 0) return out

  const values = entries.map((e) => (Number.isFinite(e.value) ? e.value : 0))
  const max = Math.max(...values)
  // Clear of the runner-up, or there is no runner-up at all. The predicate is
  // `hasClearInfluenceLeader` above — shared with the leader node's "#1 driver"
  // claim, so the crown and that claim cannot disagree about what a tie is.
  // `key` IS this surface's factor identity (it is what the returned Map is
  // keyed by, so duplicates already collapse in the output) — pass it, so the
  // panel cannot withhold its crown because one factor arrived twice.
  const topIsUnique = hasClearInfluenceLeader(
    entries.map((e, i) => ({ id: e.key, value: values[i] })),
  )

  entries.forEach((entry, i) => {
    const value = values[i]
    if (topIsUnique && value === max) {
      out.set(entry.key, 'biggest')
      return
    }
    out.set(entry.key, value >= 0.5 ? 'strong' : value >= 0.2 ? 'moderate' : 'minor')
  })
  return out
}
