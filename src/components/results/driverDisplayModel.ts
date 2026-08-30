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
 * `influence_score` is an absolute producer scale, not a share. The
 * elasticity fallback is set-relative. Pre-analysis influence and value of
 * information are separate producer metrics and must never borrow each
 * other's label.
 */
export type AnalysisMetricBasis =
  | DriverDisplayProvenance
  | 'pre_analysis_influence'
  | 'value_of_information'

export type PermittedAnalysisMetricLanguage =
  | 'absolute_influence_score'
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
  influence_score: 'absolute_influence_score',
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
 * Normalise raw elasticities to 0-1 relative to the largest magnitude in the
 * set (top = 1.0, others proportional). Degenerate sets (max |elasticity| <
 * 0.001) map every factor to 0 so a direction-only display is triggered
 * instead of misleading ~100% bars. Kept as a named export because several
 * surfaces consume the normalised value directly for semantic-label thresholds.
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
  if (actualMax < 0.001) {
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
  if (entries.length === 0) return false
  const safe = entries.map((e) => ({
    id: e.id,
    value: Number.isFinite(e.value) ? e.value : 0,
  }))
  const max = Math.max(...safe.map((e) => e.value))
  const idsAtTop = new Set(
    safe.filter((e) => max - e.value <= INFLUENCE_TIE_EPSILON).map((e) => e.id),
  )
  return idsAtTop.size === 1
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
