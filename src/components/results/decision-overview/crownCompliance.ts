/**
 * CROWN COMPLIANCE — the render seam for hard-constraint chain step 6.
 *
 * WHAT THIS CLOSES. `DecisionOverviewCard` has stated the user's limits since
 * UI #832 while being "deliberately silent about COMPLIANCE", on the recorded
 * grounds that PLoT's run-level `constraints_status` is stripped on the CEE→UI
 * hop. That reasoning was correct about `constraints_status` and it is NOT
 * correct about the field this module reads: PLoT #338 emits
 * `robustness.recommended_option_compliance`, and CEE keep-lists `robustness`
 * WHOLE (`compose.ts:723`), projecting it with a shallow top-level keep plus a
 * deep DENY-strip of internal carriers only (`compose.ts:1079`) — so additive
 * members ride through. They also survive the withheld-crown projection,
 * because `keyDesignatesLeadingOption`'s pattern is anchored with a closed
 * suffix group (`id|label|name`) these names do not match. The verdict reaches
 * the browser; before this module nothing read it.
 *
 * ⛔ THE UI AUTHORS NO COPY FOR THE VERDICT. The reason string is the
 * producer's own claim-safe phrase and is rendered VERBATIM
 * (`contracts/isl-to-ui.contract.ts:281` — "emit verbatim, never re-derive").
 * A consumer that reworded it would be the second opinion this whole chain
 * exists to remove.
 *
 * ⚠ THE FOUR THINGS THIS MODULE MUST NOT DO, each a defect the chain already
 * paid for upstream:
 *   1. NEVER BINARISE `uncertain`. ISL publishes no satisfied/breached
 *      threshold, so any cut invented here is a claim the producer declined to
 *      make. It renders as unknown.
 *   2. `unverified` means the SCALE could not be trusted — no claim in either
 *      direction. Not compliant, not breaching. Unknown.
 *   3. `not_assessed` does NOT mean "no limits were set". It means the limits
 *      were not fully checked (including a limit PLoT withheld before it
 *      reached the engine). Rendering it as "no limits" would recreate exactly
 *      the falsehood PLoT #338 fixed one layer up. `not_applicable` is the
 *      only value that means no limits were set.
 *   4. On `no_eligible_option` there is NO `recommended_option_id`. The reason
 *      MUST be rendered rather than an empty leader slot — a blank badge is
 *      indistinguishable from "we did not compute one", a different and much
 *      weaker statement than the one the producer is making.
 */

/**
 * The producer's enum, verbatim (`plot-lite-service`
 * `src/routes/v2/crown-eligibility.ts`). Ordered as the producer's own ladder
 * documents it, not alphabetically.
 */
export const CROWN_COMPLIANCE_VALUES = [
  'not_applicable',
  'compliant',
  'uncertain',
  'unverified',
  'not_assessed',
  'no_eligible_option',
] as const

export type CrownCompliance = (typeof CROWN_COMPLIANCE_VALUES)[number]

/**
 * Screen tone. Reuses `DecisionOverviewCard`'s OWN established vocabulary
 * (`STATE_DOT_TONE`) rather than minting a second one — `bg-text-light` is
 * already this card's "unassessed" tone.
 */
export type CrownComplianceTone = 'positive' | 'unknown' | 'negative'

/**
 * Verdict → tone. THREE tones for six states, and the collapsing is the whole
 * point: only two of the six are claims the producer is entitled to make in a
 * direction. The other four are disclosures, and a disclosure that borrowed a
 * directional tone would be the binarisation this chain forbids.
 */
const CROWN_COMPLIANCE_TONE: Record<CrownCompliance, CrownComplianceTone> = {
  // The producer checked every limit on a trusted scale and every draw satisfied.
  compliant: 'positive',
  // A definite producer statement: no option qualified. Not an absence.
  no_eligible_option: 'negative',
  // Partial satisfaction. Genuinely unknown — never a breach.
  uncertain: 'unknown',
  // Untrusted scale. No claim in either direction.
  unverified: 'unknown',
  // Limits stated, not fully evaluated. NOT "no limits".
  not_assessed: 'unknown',
  // No limits were stated. Never rendered — see `selectCrownComplianceDisclosure`.
  not_applicable: 'unknown',
}

/**
 * Verdicts this surface renders. `not_applicable` is DELIBERATELY ABSENT.
 *
 * WHY. Its producer reason is "no limits were set for this decision", and this
 * surface only exists to speak about limits. Printing that sentence would at
 * best be redundant and at worst directly contradict the list of the user's own
 * stated limits sitting immediately above it. Silence is the honest state — and
 * it is not a dead end, because the limits themselves still render.
 *
 * Every OTHER state renders, including all three unknowns: a limit the product
 * could not check is precisely the thing a user needs told.
 */
const RENDERED_CROWN_COMPLIANCE: ReadonlySet<CrownCompliance> = new Set<CrownCompliance>([
  'compliant',
  'uncertain',
  'unverified',
  'not_assessed',
  'no_eligible_option',
])

/**
 * Narrow an untrusted wire value to the producer enum. FAIL-CLOSED: anything
 * unrecognised — an older producer's absence, a future value this build has
 * never heard of, a non-string — yields `undefined` and the surface stays
 * silent. The same rule `display_verdict` already follows
 * (`useResultsSectionData.ts`), for the same reason: a UI that guessed at an
 * unknown token would be inventing a verdict.
 */
export function normaliseCrownCompliance(raw: unknown): CrownCompliance | undefined {
  return typeof raw === 'string' &&
    (CROWN_COMPLIANCE_VALUES as readonly string[]).includes(raw)
    ? (raw as CrownCompliance)
    : undefined
}

/** What the surface renders, or `null` for "say nothing". */
export interface CrownComplianceDisclosure {
  readonly verdict: CrownCompliance
  /** The PRODUCER's phrase, verbatim. Never authored in this repo. */
  readonly reason: string
  readonly tone: CrownComplianceTone
}

/**
 * Build the disclosure, or `null`.
 *
 * ⚠ THE REASON IS REQUIRED, AND THAT IS NOT DEFENSIVE PADDING. The verdict
 * token alone is not user-facing English, and this module is forbidden from
 * authoring a substitute. A verdict whose producer reason did not arrive is
 * therefore unrenderable — exposing the token would either show a raw enum or
 * force this consumer to invent the sentence. `display_verdict` already binds
 * the two together the same way ("never exposed without its verdict").
 */
export function selectCrownComplianceDisclosure(
  rawVerdict: unknown,
  rawReason: unknown,
): CrownComplianceDisclosure | null {
  const verdict = normaliseCrownCompliance(rawVerdict)
  if (verdict === undefined) return null
  if (!RENDERED_CROWN_COMPLIANCE.has(verdict)) return null

  const reason = typeof rawReason === 'string' ? rawReason.trim() : ''
  if (reason === '') return null

  return { verdict, reason, tone: CROWN_COMPLIANCE_TONE[verdict] }
}

/**
 * Tone → the card's own dot class. Kept beside the tone table so a reader sees
 * both halves at once; the classes are `STATE_DOT_TONE`'s, not new ones.
 */
export const CROWN_COMPLIANCE_DOT_TONE: Record<CrownComplianceTone, string> = {
  positive: 'bg-success',
  negative: 'bg-danger',
  unknown: 'bg-text-light',
}

// ---------------------------------------------------------------------------
// Store selectors
// ---------------------------------------------------------------------------

/**
 * The two slots, in precedence order — the SAME chain `display_verdict` already
 * uses (`useResultsSectionData`: `raw ?? mapped`).
 *
 *   1. `rawV2Response.robustness` — the FRESH-RUN seam. Permissive: the whole
 *      producer object is cast through verbatim (`analysisEnrichmentShape.ts`
 *      `readRobustnessSlot`), so additive members are present without any
 *      keep-list entry.
 *   2. `results.report.robustness` — the SAVED/HYDRATED fallback, which travels
 *      through `mapV5AnalysisToReport`'s explicit keep-list.
 *
 * ⚠ ORDER IS LOAD-BEARING. Raw must win: the mapped report can outlive the run
 * that produced it, and a hydrated verdict outranking the current one would
 * show the user last run's compliance beside this run's limits.
 */
interface CrownComplianceStoreSlice {
  readonly rawV2Response?: unknown
  readonly results?: unknown
}

function robustnessOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readMember(s: CrownComplianceStoreSlice, member: string): string | null {
  const raw = robustnessOf(robustnessOf(s.rawV2Response)?.robustness)
  const report = robustnessOf(robustnessOf(robustnessOf(s.results)?.report)?.robustness)
  const value = raw?.[member] ?? report?.[member]
  return typeof value === 'string' ? value : null
}

/**
 * PRIMITIVE selectors — `string | null`, never an object.
 *
 * The card is under a primitive-selector contract
 * (`DecisionOverviewCard.primitiveSelectors.spec.tsx`): an object-returning
 * selector re-commits the whole card subtree on every store write that rebuilds
 * an equal-content object, which on the live path means every frame of every
 * node drag. Two primitives, composed in a `useMemo`, keep that contract.
 */
export function selectCrownComplianceVerdict(s: CrownComplianceStoreSlice): string | null {
  return readMember(s, 'recommended_option_compliance')
}

export function selectCrownComplianceReason(s: CrownComplianceStoreSlice): string | null {
  return readMember(s, 'recommended_option_compliance_reason')
}

/**
 * How many constraints the user actually set — a PRIMITIVE count.
 *
 * ⭐ WHY THIS EXISTS RATHER THAN REUSING `statedLimits.length` (trap 21 — ONE
 * PREDICATE ANSWERING TWO QUESTIONS). The compliance row was originally gated
 * on `statedLimits.length > 0`. Those are different questions:
 *
 *   `statedLimits.length > 0`  answers "can we FORMAT and display the limits?"
 *   this selector              answers "did the user set limits the producer
 *                              could make a claim about?"
 *
 * They diverge in BOTH directions, and the gap is not hypothetical:
 * `selectStatedLimits` (statedLimits.ts:96-98) SKIPS any constraint whose
 * `value` is non-finite or whose `operator` is empty. So `statedLimits` can be
 * EMPTY while `goalConstraints` is populated.
 *
 * ⚠ AND THE CORRELATION IS THE SHARP EDGE. `not_assessed` means "we could not
 * check every limit you set on this run" — precisely the state a malformed or
 * withheld constraint produces. Gating on `statedLimits` therefore suppressed
 * the disclosure in exactly the case most likely to need it: the user's limit
 * was unformattable, the producer said so, and the surface stayed silent.
 *
 * ⚠⚠ THE OTHER DIRECTION MUST BE PRESERVED, AND IT IS WHY THIS IS NOT SIMPLY
 * "ALWAYS RENDER". PLoT auto-synthesises a `'Goal target'` constraint
 * (`constraint_id: 'auto_goal_threshold'`, run.ts:6035-6042) from the goal
 * node's threshold when the user set no limits, which can yield `compliant`
 * carrying the reason "this option met every limit YOU SET" — about limits
 * nobody set. That synthesis happens INSIDE PLoT's run handler and never
 * reaches this store, so `goalConstraints` is genuinely empty in that case and
 * this gate keeps the falsehood suppressed. A PLoT-side fix for the reason
 * wording is commissioned separately; until it lands, this gate is load-bearing.
 */
export function selectGoalConstraintCount(s: { readonly goalConstraints?: unknown }): number {
  return Array.isArray(s.goalConstraints) ? s.goalConstraints.length : 0
}
