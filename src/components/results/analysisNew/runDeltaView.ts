/**
 * "What's changed" — the run-over-run consequence, turned into a view model.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐⭐ TWO STATEMENTS, AND THEY MUST NEVER BE FUSED.
 * ═══════════════════════════════════════════════════════════════════════════
 * `attribution_case` describes the COMPARABILITY CONDITIONS OF THE PAIR. It does
 * NOT describe whether anything moved, and reading it as if it did is the defect
 * this file was rewritten to remove.
 *
 * Measured against the installed schema, all three of these PARSE:
 *
 *     C0_identical     with DIFFERING reported probabilities
 *     C1_attributable  with NO reported movement
 *     C2_unpaired      with IDENTICAL reported probabilities
 *
 * `refineRunDelta` constrains `pair_provenance` and nothing else
 * (`run-delta.js:186-204`) — it says not one word about `win_probabilities`. So
 * "nothing moved" and "this differs" are NOT derivable from the case, and an
 * earlier draft of this surface said both. CLAUDE.md trap 21 inside one sentence:
 * two questions wearing one name.
 *
 * Therefore:
 *   PART A — comparability — reads `attribution_case` ALONE.
 *   PART B — movement      — reads `win_probabilities` ALONE.
 * They render as separate lines and neither may borrow the other's claim.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE MAY NOT DO
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ NO CLIENT-SIDE COMPUTATION OF ANY QUANTITY. The contract is explicit that
 * "the UI renders it with ZERO client-side computation: every number, tag and
 * entitlement below is producer-computed". This module selects sentences and
 * passes numbers through. It does not subtract, threshold, rank or round into a
 * claim.
 *
 * ⛔ `flip_thresholds` IS NOT READ, AND THAT IS DELIBERATE. CEE emits it as a
 * frozen `[]` at every emission today (`claim-safety-cage.ts:311`,
 * `RUN_DELTA_FLIP_THRESHOLDS_NOT_COMPUTED`) because, in its own words, "the join
 * is deferred and we never looked". Its own comment names the hazard: "an empty
 * array read naively ASSERTS there are no flip thresholds, which is a claim we
 * have not earned". That ground alone settles it: there is no honest sentence to
 * build from a value the producer has not earned.
 *
 * ⚠⚠ CORRECTED — an earlier draft of this note gave a SECOND reason that is
 * false, and the true version is a hazard rather than a nuance. It said absence
 * and emptiness are "indistinguishable" here. They are MAXIMALLY distinguishable:
 * `flip_thresholds: z.array(...)` carries NO `.optional()` (target 0 against a
 * contrast of 5 `.optional()` in the same file, `edit_list` among them), so it is
 * REQUIRED. Proven by execution against the vendored 0.55.0 with a must-pass
 * control: the same block PARSES with the field and fails `flip_thresholds
 * Required` without it.
 *
 * ⛔ AND THE FAILURE IS SILENT AND TOTAL. `run_delta` sits in
 * `QUARANTINABLE_ADDITIVE_KEYS` (`responseParser.ts:284`), so a parse failure
 * lifts THE WHOLE KEY out and the turn survives without it — no error, no red,
 * and a section that renders nothing, which is indistinguishable from this
 * feature's own legitimate default. If CEE ever stops emitting the field, the
 * capability goes dark exactly the way the two-writer defect made it dark.
 * Reported to Core; nothing the consumer can guard, because the block is gone
 * before any consumer sees it.
 *
 * ⛔ `edit_list` IS NOT READ EITHER — it is declared in 0.55.0 and emitted
 * nowhere (verified at CEE `78515b95` with a contrast control). When Core ships
 * it, C1's line can name WHICH values changed; until then it degrades to "your
 * change", which the contract explicitly sanctions.
 */

import type { RunDelta } from '@talchain/schemas/boundary'

export type NoiseVerdict = 'signal' | 'within_noise' | 'not_noise_qualified'

/** Which way a score went. Derived from the producer's own two numbers only. */
export type MovementDirection = 'up' | 'down' | 'level'

export interface RunDeltaMovement {
  /** Identity, never a label (contract: "identity-bound (trap 19)"). */
  readonly optionId: string
  /** Resolved from the caller's node map. `null` = this run does not name it. */
  readonly label: string | null
  readonly prior: number
  readonly current: number
  readonly direction: MovementDirection
  /**
   * The producer's tag, VERBATIM. The three states are "deliberately never
   * collapsible" — collapsing `within_noise` into `signal` is precisely how a
   * surface starts reporting sampling movement as a finding.
   */
  readonly noiseVerdict: NoiseVerdict
  /** False for `not_noise_qualified`: direction only, never dressed as signal. */
  readonly mayShowMagnitude: boolean
}

export interface RunDeltaLeaderLine {
  readonly changed: boolean
  readonly noiseVerdict: NoiseVerdict
  /**
   * False when either side's id is absent. The contract is explicit that an
   * absent id means the producer is not entitled to make a claim on that side —
   * never that no such option existed — and that a consumer must not name one.
   */
  readonly mayName: boolean
  readonly priorLabel: string | null
  readonly currentLabel: string | null
}

export interface RunDeltaView {
  /** PART A. */
  readonly comparability: string
  /** True ONLY for `C1_attributable`. Nothing else licenses a causal reading. */
  readonly attributable: boolean
  /**
   * The cause rider, SELECTED BY CASE. `null` on C1 only. ⛔ Not a binary on
   * `attributable`: C0 proves a model change did not happen, while C2/C3/C4
   * merely cannot establish one — opposite claims that a binary fused.
   */
  readonly attributionLimit: string | null
  /** PART B. Empty array + `movementsUnavailable` are different states. */
  readonly movements: readonly RunDeltaMovement[]
  /** True when the producer sent no comparable pair for ANY option. */
  readonly movementsUnavailable: boolean
  readonly leader: RunDeltaLeaderLine | null
}

/**
 * PART A, by identity. The case enum is "the ONLY input the sentence builder may
 * take", and this is that builder.
 *
 * ⚠ Every arm talks about the PAIR. Not one of them says whether a number moved.
 */
const COMPARABILITY: Record<RunDelta['attribution_case'], string> = {
  // ⛔ "A CHANGE TO THE MODEL", NEVER "YOUR CHANGE" — and the distinction is not
  // pedantry. C1 is `seed_equal && !hash_equal && builds_equal='equal' &&
  // n_equal`: it establishes that THE MODEL CHANGED and that nothing else did.
  // It carries nothing whatever about WHO changed it, and Olumi's own graph_patch
  // path moves that same hash. Saying "your change" would attribute authorship the
  // producer never sent — entitled by the pair's comparability and unentitled by
  // what the product actually knows. That is the defect this file's header
  // describes, one level up in the prose, and `edit_list`'s absence makes it worse:
  // we cannot even name WHAT changed, let alone who did it.
  C1_attributable:
    'The only difference between this analysis and the previous one is a change to the model.',
  C0_identical:
    'Nothing about the model, or the way it was worked out, differed between this analysis and the previous one.',
  C2_unpaired:
    'This analysis and the previous one were not worked out on a comparable basis.',
  C3_engine_drift:
    'The way this analysis was worked out changed between the two.',
  C4_budget_drift:
    'This analysis and the previous one were worked out to different levels of precision.',
}

/**
 * THE RIDER — what the reader may and may not conclude about CAUSE.
 *
 * ⛔⛔ BY CASE, NEVER BINARY, AND THE DIFFERENCE IS A FALSE STATEMENT. An earlier
 * draft was `attributable ? null : ONE_SENTENCE`, i.e. a binary over a FIVE-value
 * enum, and the one sentence DENIED a model change: "any difference below cannot
 * be put down to a change in the model". Two separate defects fell out of that:
 *
 *   ⛔ ON `C2_unpaired` IT DENIES THE CAUSE THAT IS ROUTINELY THE REAL ONE. CEE
 *     emits C2 on `!seed_equal` WITHOUT CONSULTING THE HASH, and its own producer
 *     note (`build-run-delta.ts:332-335`) says a factor-value edit moves
 *     `observed_state.value` — which sits in BOTH the seed inputs AND the hash.
 *     So the likeliest edit a person makes lands in C2, and the card told them
 *     their change could not explain what they were looking at. "Not established"
 *     and "not the cause" are different claims; only the first is ours to make.
 *
 *   ⛔ ON `C0_identical` IT FIRED AS A LIMIT WHERE THE PAIR IS AT ITS STRONGEST.
 *     C0 requires `hash_equal === true` (`refineRunDelta` demands all four
 *     echoes), so "the model did not change" is PROVEN, not merely unestablished.
 *     Printing a not-comparable rider there mislabels a certainty as a gap.
 *
 * ⇒ Three distinct riders. C1 needs none — part A already carries the whole
 * claim. C0 states a proven negative. C2/C3/C4 REFUSE TO ATTRIBUTE, which is the
 * honest shape of "we cannot tell from this pair".
 */
const ATTRIBUTION_LIMIT: Record<RunDelta['attribution_case'], string | null> = {
  // Part A already says the only difference is a change to the model. A rider
  // would either repeat it or weaken it.
  C1_attributable: null,
  // ⭐ PROVEN, NOT UNKNOWN. `hash_equal` is true by the case's own preconditions,
  // so this is the one arm entitled to say a model change is NOT the explanation.
  C0_identical:
    'The model itself did not change between these two, so nothing below can be explained by an edit to it.',
  // ⛔ REFUSAL TO ATTRIBUTE, NOT DENIAL. C2 is decided on the seed alone; the hash
  // is never consulted, so a change to the model may well be the cause and this
  // pair simply cannot show it.
  C2_unpaired:
    'Whether a change to the model explains anything below cannot be established from this pair.',
  C3_engine_drift:
    'Whether a change to the model explains anything below cannot be established from this pair.',
  C4_budget_drift:
    'Whether a change to the model explains anything below cannot be established from this pair.',
}

function directionOf(prior: number, current: number): MovementDirection {
  if (current > prior) return 'up'
  if (current < prior) return 'down'
  return 'level'
}

/**
 * Build the view model.
 *
 * `labelFor` resolves an option id to what this surface already calls it —
 * passed in rather than read here so this module stays pure and so the section
 * cannot disagree with the rest of the tab about an option's name.
 */
export function buildRunDeltaView(
  delta: RunDelta,
  labelFor: (optionId: string) => string | null,
): RunDeltaView {
  const attributable = delta.attribution_case === 'C1_attributable'

  const movements: RunDeltaMovement[] = delta.win_probabilities.map((w) => ({
    optionId: w.option_id,
    label: labelFor(w.option_id),
    prior: w.prior,
    current: w.current,
    direction: directionOf(w.prior, w.current),
    noiseVerdict: w.noise_verdict,
    mayShowMagnitude: w.noise_verdict !== 'not_noise_qualified',
  }))

  const priorId = delta.leader.prior_leading_option_id
  const currentId = delta.leader.current_leading_option_id
  const mayName =
    typeof priorId === 'string' && priorId.length > 0 &&
    typeof currentId === 'string' && currentId.length > 0

  return {
    comparability: COMPARABILITY[delta.attribution_case],
    attributable,
    attributionLimit: ATTRIBUTION_LIMIT[delta.attribution_case],
    movements,
    // ⚠ AN EMPTY LIST IS "NO OPTION HAD A COMPARABLE PAIR", NEVER "NOTHING
    // MOVED". The contract permits an empty array on a pair where no option
    // could be matched; reading it as stillness would be the same fabrication
    // `flip_thresholds` is withheld to avoid, one field over.
    movementsUnavailable: movements.length === 0,
    leader: {
      changed: delta.leader.changed,
      noiseVerdict: delta.leader.noise_verdict,
      mayName,
      priorLabel: mayName ? labelFor(priorId as string) : null,
      currentLabel: mayName ? labelFor(currentId as string) : null,
    },
  }
}
