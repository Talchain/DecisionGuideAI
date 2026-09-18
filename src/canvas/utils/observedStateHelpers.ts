// ============================================================================
// OBSERVED STATE HELPERS — Canonical read/write for observed_state
// ============================================================================
//
// DraftChat stores observed_state as camelCase (observedState) in node.data.
// Some consumers read snake_case (observed_state). These helpers bridge the
// naming inconsistency so callers don't need to know which key is present.
//
// TODO: collapse to single canonical key once all consumers migrated
//
// USAGE:
//   import { getObservedState, withObservedStateUpdate } from '@/canvas/utils/observedStateHelpers'
//
//   const os = getObservedState(node.data)           // reads whichever key exists
//   const patch = withObservedStateUpdate(node.data, { source: 'user_confirmed' })
//   updateNode(id, { data: patch })                  // writes to both keys
// ============================================================================

import { classifyValueProvenance } from '../domain/valueProvenance'
import { isUnquantifiedPrior } from '../domain/nodes'

/** Shape of observed_state on factor nodes */
export interface ObservedStateData {
  value?: number
  raw_value?: number | string | null
  baseline?: number
  std?: number
  unit?: string
  source?: string
  cap?: number
  factor_type?: string
  uncertainty_drivers?: string[]
  extractionType?: string
  /** CEE-provided display text. When present the UI renders verbatim. */
  display_value?: string | null
  [key: string]: unknown
}

/** Node data shape for observed_state access (supports both naming conventions) */
interface NodeDataWithObservedState {
  observedState?: ObservedStateData
  observed_state?: ObservedStateData
  [key: string]: unknown
}

/**
 * Read observed_state from node data, checking both camelCase and snake_case.
 * Returns the first non-undefined value, or an empty object if neither exists.
 *
 * Priority: camelCase (observedState) first — this is what DraftChat writes.
 */
export function getObservedState(nodeData: unknown): ObservedStateData {
  const data = nodeData as NodeDataWithObservedState | undefined
  return data?.observedState ?? data?.observed_state ?? {}
}

/**
 * ⭐⭐ A PRODUCER PLACEHOLDER IS NOT EVIDENCE — AND TREATING IT AS EVIDENCE WAS
 * SILENTLY WITHHOLDING A BIAS WARNING.
 *
 * THE DEFECT, MEASURED. CEE sends `uncertainty_drivers: ['Not provided']` on
 * factors it has no evidence for. Across the four committed starter captures
 * there are only NINE distinct driver strings in total, and `'Not provided'`
 * accounts for **16 of the 24 occurrences** — every genuine driver appears
 * exactly once. So two thirds of all the "evidence" this product holds about
 * its factors is the literal word that there is none.
 *
 * ⛔ THE SERIOUS HALF IS NOT THE RENDERED TEXT. `PreAnalysisPanel` raises an
 * OVERCONFIDENCE warning for an AI-sourced factor with no supporting evidence —
 * *"X is among the highest-priority factors to review but has no supporting
 * evidence. Validate it before relying on it."* Its test was
 * `!drivers || drivers.length === 0`. A placeholder array has length ONE, so
 * the test failed and **the warning was suppressed on exactly the factors that
 * have no evidence** — the population it exists to catch. The product went
 * quiet precisely where it had most to say, and it read as working.
 *
 * ⚠ WHY A LIST AT ALL, GIVEN TRAP 12. A hand-maintained list of placeholder
 * spellings is a mirror and will drift. It is accepted here, narrowly and
 * deliberately, because the alternative is leaving a live coaching defect open
 * until a producer change lands in another service. Two constraints keep it
 * honest: the set is DERIVED FROM MEASUREMENT (every string in it was observed
 * in a committed capture, not imagined), and a spec pins the exact census —
 * 16/24 — so the day the producer stops sending it, or starts sending a
 * spelling this does not know, the test says so rather than the product going
 * quiet again.
 *
 * ⛔ THE REAL FIX IS CEE'S: send `[]`, or omit the key, rather than a sentence
 * saying there is nothing. Reported separately. This is the mitigation, and it
 * is written to fail loud rather than to be forgotten.
 *
 * Matching is case-insensitive and trims, because a placeholder's capitalisation
 * is not a meaningful distinction. It matches the WHOLE string only: a real
 * driver that happens to contain the word "unknown" — and two of the nine
 * genuine strings do, e.g. *"Onboarding complexity unknown"* — is real evidence
 * and must survive. That is why this is not a substring test.
 */
export const PLACEHOLDER_EVIDENCE_STRINGS: ReadonlySet<string> = new Set([
  // Measured, 16 occurrences across all four starter captures.
  'not provided',
  // Observed nowhere yet. Included because they are the SAME producer gesture
  // and cost nothing to refuse; the spec records that they are unwitnessed, so
  // nobody later mistakes this for a census.
  'n/a',
  'none',
  'not specified',
  'unknown',
])

/** Is this string the producer saying "I have nothing", rather than evidence? */
export function isPlaceholderEvidence(value: unknown): boolean {
  return typeof value === 'string'
    && PLACEHOLDER_EVIDENCE_STRINGS.has(value.trim().toLowerCase())
}

/**
 * The uncertainty drivers that are actually evidence.
 *
 * ⭐ ONE PREDICATE, BOTH CONSUMERS. The card that RENDERS drivers and the check
 * that COUNTS them must not be able to disagree about what a driver is — that
 * is two answers to one question (trap 21), and the disagreement would be
 * invisible: a card showing a bullet while the coaching says there is no
 * evidence. Both now call this.
 */
/**
 * ⭐ THE OVERCONFIDENCE SENTENCE, CLAIMING ONLY WHAT WAS CHECKED.
 *
 * It used to read *"X is among the highest-priority factors to review but has no
 * supporting evidence. Validate it before relying on it."* — two claims drawn from
 * one signal, and neither of them was the signal.
 *
 * 1. "among the highest-priority factors to review" came from `topInfluence`, the
 *    single MOST INFLUENTIAL factor. Influence is not review priority, and the
 *    comment immediately above that call site is already careful to make "no
 *    causal-share claim" — the care simply stopped one clause short.
 * 2. "has no supporting evidence" is a claim about EVERY carrier of a basis while
 *    the test reads ONE, `uncertainty_drivers`.
 *
 * ⚠ AND WHY THIS IS WORDING RATHER THAN A CARRIER CHECK, which is the tempting
 * fix and would have been a dark branch. Measured across the eight committed
 * coherence captures: nine factors carry an `observedState`, eight are AI-sourced
 * under the real `AI_SOURCES` set, all eight fire this warning, and ZERO of them
 * carry `extractionType === 'explicit'`, a `source_quote`, a `rationale` or a
 * `provenance` value. `source_quote` appears in 27 files of code and reaches a
 * factor's observed state in none of them. So a "check the other carriers" branch
 * would execute on 0 of 8 firing factors. Naming the carrier in the sentence gets
 * the honesty without shipping a branch nothing can reach. If a producer change
 * ever stamps a basis without drivers, the carrier check becomes real and this
 * comment is the trigger to revisit it.
 */
export function overconfidenceSentence(label: string): string {
  return `${label} is the most influential factor in this model, and no uncertainty drivers are recorded for it. Validate it before relying on it.`
}

export function meaningfulUncertaintyDrivers(drivers: unknown): string[] {
  if (!Array.isArray(drivers)) return []
  return drivers.filter(
    (d): d is string => typeof d === 'string' && d.trim() !== '' && !isPlaceholderEvidence(d),
  )
}

/**
 * Check whether node data has any observed_state (either key).
 */
export function hasObservedState(nodeData: unknown): boolean {
  const data = nodeData as NodeDataWithObservedState | undefined
  return data?.observedState !== undefined || data?.observed_state !== undefined
}

/**
 * Check whether a factor node has actual observed data — i.e., the observed_state
 * object is present, its `value` field is a number, AND no producer has stamped
 * that number as the model's own invention.
 *
 * Evidence gap badge semantics:
 * - `observedState === null`      → no data (badge shows)
 * - `observedState === undefined` → no data (badge shows)
 * - `observedState.value === 0`   → valid data (badge hidden — 0 is "None" for binary factors)
 * - `observedState.value === 1`   → valid data (badge hidden)
 * - `observedState.value === 0.5` → valid data (badge hidden)
 * - `observedState.value == null` → no value yet (badge shows)
 * - `observedState.source` stamped `ai` → NOT data (badge shows) — see below
 *
 * ⭐⭐ WHY THE SOURCE STAMP IS PART OF THIS PREDICATE (2026-08-29).
 *
 * CEE defaults a factor with no stated value to a neutral number and records
 * that it did so: `adapters/llm/normalisation.ts` writes the value and
 * `observed_state.source = 'cee_inference'` / `extractionType: 'inferred'`.
 * Witnessed on the deployed staging build (UI `489f5fc5`, deploy permalink
 * `6a931cc56bd89d0008ecab16`): three controllable factors on the shipped
 * market-entry starter carried `{ value: 0, source: 'cee_inference' }` and a
 * fourth carried `{ value: 0.5, … }`.
 *
 * This predicate asked only `typeof value === 'number'`, so all four answered
 * TRUE — and `EvidenceGapBadge`, whose tooltip reads *"No observed data for
 * X"*, was suppressed on precisely the factors that have none. **The predicate
 * that decides whether to say "no observed data" was satisfied by the
 * placeholder that means there is no observed data.** Proven by a
 * within-render discriminating pair on the deployed build: three
 * `cee_inference` controllables rendered no badge; the same node with its
 * `observed_state` removed rendered one.
 *
 * ⚠ POSITIVE EVIDENCE ONLY — THE POLARITY IS THE DESIGN, NOT AN ACCIDENT. CEE's
 * `cee/provenance/factor-value-provenance.ts` records getting this backwards:
 * written fail-closed, a factor carrying a perfectly real number with NO stamp
 * landed in the invented tier, and the caller then replaced real information
 * with an assertion of ignorance it did not have. A gap wrongly hidden costs a
 * tester a look; a gap wrongly INVENTED tells them a number they supplied is
 * not theirs, which is the worse harm. So an absent or unrecognised `source`
 * keeps the previous answer, and both directions are pinned in
 * `__tests__/observedStateHelpers.spec.ts`.
 *
 * ⚠ THE STAMP, NOT THE MAGNITUDE. A genuinely user-stated 0.5 is indistinguishable
 * from CEE's placeholder by value (CLAUDE.md trap 19), which is why the test is
 * `source`. The classification is delegated to `classifyValueProvenance` — the
 * estate's ONE authority for "who put this number here" — rather than re-typed
 * here, so the literal set cannot drift from it (trap 12).
 *
 * ⚠ NOT THE SAME QUESTION AS `isFactorNeedsInput` (trap 21). This asks *"is
 * there evidence behind this number?"*; that one asks *"must a human act on this
 * factor before we run?"*. They are deliberately left with different answers on
 * a stamped estimate: the amber call-to-action firing on every drafted factor
 * would be uniform, and a uniform signal carries no information.
 *
 * Note: the pipeline does not produce `observedState.value === ''` (string). The
 * `value` field is always typed as `number | undefined`. Treating empty-string as
 * "no data" is therefore moot; `typeof '' !== 'number'` would catch it anyway.
 */
export function hasObservedData(nodeData: unknown): boolean {
  const obs = getObservedState(nodeData)
  // Empty object returned when key is absent — no keys means no data
  if (Object.keys(obs).length === 0) return false
  if (typeof obs.value !== 'number') return false
  const stamped = classifyValueProvenance(typeof obs.source === 'string' ? obs.source : null)
  return stamped?.kind !== 'ai'
}

/**
 * Single source of truth for the "factor needs input" predicate used by the
 * amber StatusPill (BaseNode) AND the in-body coaching chip (FactorNode).
 *
 * Wireframe v4 trigger (FactorNeedsPre): factor needs input when ALL of
 * `value`, `raw_value` and `display_value` are nullish AND the factor is not
 * external AND it has no prior range. External / prior-range factors are
 * exempt — dashed border = "outside your control" must not be confused with
 * amber = "needs your judgement".
 *
 * Both call sites must agree on this predicate, otherwise a node can show the
 * "Help me estimate this" chip without the amber border (or vice-versa).
 *
 * ⭐⭐ THE PRIOR EXEMPTION NOW REFUSES AN IGNORANCE PRIOR (CEE PR #1223).
 *
 * CEE stops substituting a placeholder `0.5` for a factor the brief gave no
 * number for. It now sends `prior: uniform(0,1)` carrying
 * `prior_is_unquantified: true`. Both bounds are non-null, so the exemption
 * below fired — and the amber "needs your judgement" affordance stayed dark on
 * precisely the factors that need it most.
 *
 * ⚠ THE DISCRIMINATOR IS THE FLAG, NEVER THE RANGE — see `isUnquantifiedPrior`
 * for the two corpora that return opposite verdicts on a range predicate. A
 * genuine unflagged `uniform(0,1)` prior keeps its exemption, and that twin is
 * pinned in this file's spec.
 */
export function isFactorNeedsInput(nodeData: unknown): boolean {
  const data = nodeData as {
    category?: string
    prior?: { range_min?: number; range_max?: number }
  } | undefined
  if (data?.category === 'external') return false
  if (priorCountsAsEvidence(data?.prior)) return false
  return hasAnyStatedValue(nodeData) === false
}

/**
 * Does this prior stand in for a value the user would otherwise have to supply?
 *
 * A complete range does — that is the exemption the legacy BaseNode incomplete
 * check applied, and it is written for genuine external priors. An explicit
 * statement of ignorance does NOT: it is the absence of an estimate, recorded
 * honestly, and treating it as evidence is how the absence disappears.
 */
function priorCountsAsEvidence(prior: { range_min?: number; range_max?: number } | undefined): boolean {
  if (isUnquantifiedPrior(prior)) return false
  return prior?.range_min != null && prior?.range_max != null
}

/**
 * Does this factor carry a value in ANY of the three carriers a value can
 * arrive in?
 *
 * Extracted so the triple has ONE owner: `isFactorNeedsInput` and FactorNode's
 * "what does this node say about its own number" decision both ask it, and a
 * second hand-listed copy is the drift this estate keeps paying for
 * (CLAUDE.md trap 12). `display_value` is CEE-authored copy and `raw_value` is
 * the pre-normalisation figure; either alone means the user is not being asked
 * for anything.
 */
export function hasAnyStatedValue(nodeData: unknown): boolean {
  const obs = getObservedState(nodeData)
  return obs.value != null || obs.raw_value != null || obs.display_value != null
}

/**
 * Convert a raw, real-world factor figure into the normalised model-space
 * `value` the engine consumes.
 *
 * This is the rule every value-edit path in the UI applies, and this is its
 * ONLY implementation — call it, never re-type it.
 *
 * Deliberately NOT documented here: a list of the call sites. The previous
 * version of this docstring kept one, it drifted (it named two of the three
 * inline copies and missed the triage path in OutputsDock), and the drift read
 * as green because nothing checked it. The convergence is enforced instead by
 * a guard in `__tests__/observedStateHelpers.spec.ts` that derives the file set
 * from `git ls-files` and fails loud when the rule is re-inlined anywhere.
 *
 * A missing, non-finite or non-positive cap means "no honest scale exists", in
 * which case the typed number IS the model-space value — the same fallback the
 * existing call sites take. Never throws; a non-finite raw value is returned
 * unchanged so the caller's own finite-number guard is the single rejection
 * point rather than a silent coercion here.
 */
export function normaliseRawFactorValue(rawValue: number, cap: number | undefined | null): number {
  if (!Number.isFinite(rawValue)) return rawValue
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap <= 0) return rawValue
  return rawValue / cap
}

/**
 * Build a node data patch that writes observed_state updates to BOTH keys.
 * Spreads existing state, then overlays the updates.
 *
 * Returns a partial node data object suitable for updateNode:
 *   updateNode(id, { data: withObservedStateUpdate(node.data, { source: 'user_confirmed' }) })
 */
export function withObservedStateUpdate(
  nodeData: unknown,
  updates: Partial<ObservedStateData>,
): Record<string, unknown> {
  const existing = getObservedState(nodeData)
  const merged = { ...existing, ...updates }
  const data = nodeData as Record<string, unknown> | undefined

  return {
    ...(data ?? {}),
    observedState: merged,
    observed_state: merged,
  }
}
