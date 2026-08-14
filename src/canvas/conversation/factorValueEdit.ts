/**
 * `factor_value_edit` — the inspector value-commit, as a wire event.
 *
 * ROADMAP 1.346. An inspector value edit used to terminate in the client store
 * and emit nothing (live-probed: CEE's `graph_hash` byte-identical across a 10x
 * edit on the #1 driver). This module turns that commit into a real turn.
 *
 * The wire TYPE comes from the contract package (`@talchain/schemas`) — see
 * `src/v5/buildPayload.ts`, which types the emitted event against
 * `SystemEventTurnPayload`. Nothing here hand-rolls a wire shape; this module
 * only decides WHICH numbers to put in the contract's fields, which is the part
 * the contract cannot decide for us.
 *
 * THE SCALE CONTRACT, and why it needs a module of its own.
 * `observed_state.value` is MODEL scale (for a capped factor, `raw_value / cap`)
 * and `observed_state.raw_value` is the USER-UNIT magnitude. They are NOT
 * interchangeable. The live defect this fixes wrote a display magnitude
 * (300000) into the model-scale field; CEE's validator refuses exactly that, so
 * closing the transport gap without closing the scale gap would have converted
 * a silent nothing into a visible rejection.
 *
 * THE AMBIGUITY THIS RESOLVES. The inspector's number input is seeded from
 * `raw_value ?? value` — so the scale of the number the user typed depends on
 * which of those was present. Getting this wrong in either direction is a
 * silent numeric corruption:
 *   - treating a model-scale entry as user units divides it by the cap again;
 *   - treating a user-unit entry as model scale ships 20000 where <=1 is meant.
 * `resolveValueInputSeed` is the ONE place that rule lives. The panel uses it to
 * seed and to compare; the emitter uses it to label the scale. A second copy of
 * `raw_value ?? value` anywhere else re-opens the ambiguity, which is why the
 * panel imports this rather than re-deriving it.
 */

import { normaliseRawFactorValue, getObservedState } from '../utils/observedStateHelpers'
import { unwrapInterventionValue } from '../utils/labelUtils'
import type { WireSystemEvent } from './types'

/**
 * Read one numeric field off an observed state, DEFENSIVELY.
 *
 * `value` / `raw_value` / `cap` should be plain numbers, but CEE and legacy
 * paths can wrap them as `{ value: number, unit?: string }`. Reading such a
 * field with a bare `typeof x === 'number'` test silently reports it as ABSENT
 * — which here would mean an emitted edit that omits the user's magnitude, or
 * an uncapped-factor fallback that ships a display magnitude as a model value.
 * `unwrapInterventionValue` is the repo's generic numeric defence (it accepts
 * both shapes) and is what every display path already routes through.
 */
function readNumber(field: unknown): number | undefined {
  const n = unwrapInterventionValue(field).value
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

/**
 * WHICH number the input the user typed into was DISPLAYING.
 *
 * The scale of a typed number is decided by what the field showed, not by what
 * the node happens to store — so a surface whose input is seeded differently
 * needs to say so HERE rather than grow its own rule. Two bases exist today:
 *
 * - `'raw_or_value'` (default) — the inspector panel and the Model-tab chips,
 *   whose inputs display `raw_value ?? value`.
 * - `'raw_only'` — the pre-analysis drill-in, whose prefill is
 *   `EstimateRowModel.rawPrefill` (the node's `raw_value`, or an EMPTY field)
 *   and which by design NEVER displays the normalised model-scale `value`
 *   (`buildEstimateRows`: "The normalised model-scale `value` is never
 *   displayed"). On that surface a stored `value` therefore says nothing about
 *   the scale of what was typed, and reading it as the seed would classify a
 *   `£60,000` entry on a capped factor as a model-scale number — the
 *   6000000% class the #559 entry guard exists to stop, re-entered through the
 *   scale module. `'raw_only'` falls through to the module's own EMPTY-input
 *   rule instead (see `ValueInputSeed.inUserUnits`).
 * - `'model_scale'` (ROADMAP 2.364) — the committing control did not carry a
 *   TYPED number at all: it carried a probability in [0,1] produced by CEE's
 *   belief-elicitation engine, which is already what `observed_state.value`
 *   holds. The node's own `raw_value` therefore says nothing about it, so this
 *   basis is answered BEFORE the `raw_value` rule rather than after it —
 *   otherwise an elicited 0.7 on a factor storing `raw_value: 8, cap: 20`
 *   would be labelled a user-unit magnitude and normalised to 0.035.
 *
 *   WHY THE UI DOES NOT CONVERT INSTEAD. The user-unit magnitude for an
 *   elicited probability is `value * cap`, and that inversion already exists,
 *   server-side, as the ONE authority that owns it: CEE's
 *   `resolveUserUnitInput` (`orchestrator-v5/system-events/
 *   factor-value-edit.ts`, read at `staging` 2026-08-03) does exactly
 *   `cap !== undefined ? value * cap : value` when the wire carries no
 *   `raw_value`. Re-deriving it here would be a SECOND scale authority in a
 *   component — the defect this module exists to prevent — and it would use
 *   the client's cached cap rather than the factor's stored one.
 */
export type ValueInputSeedBasis = 'raw_or_value' | 'raw_only' | 'model_scale'

export interface ValueInputSeed {
  /** The number the input should display, or undefined for an empty input. */
  seed: number | undefined
  /**
   * Whether the number in the input is a USER-UNIT magnitude (true) or an
   * already-model-scale number (false).
   *
   * True when the seed came from `raw_value`, and also when there is no seed at
   * all: an operator typing into an EMPTY field on a factor that carries a
   * scale is entering a real-world magnitude, not a normalised fraction. False
   * only when the field genuinely displayed the model-scale `value` — the one
   * case where re-normalising would divide by the cap twice.
   */
  inUserUnits: boolean
}

/**
 * The single definition of what the inspector's value input shows and what
 * scale that number is in. Derived from the node's own observed state — never
 * from a hard-coded bound, because scales vary per draft.
 */
export function resolveValueInputSeed(
  nodeData: unknown,
  basis: ValueInputSeedBasis = 'raw_or_value',
): ValueInputSeed {
  const obs = getObservedState(nodeData)
  const rawValue = readNumber(obs.raw_value)
  const value = readNumber(obs.value)

  // FIRST, deliberately: a model-scale commit is a statement about the number
  // being committed, not about what the node happens to store, so no stored
  // field may override it.
  if (basis === 'model_scale') return { seed: value, inUserUnits: false }
  if (rawValue != null) return { seed: rawValue, inUserUnits: true }
  // A `raw_only` input never showed `value`, so the field the user typed into
  // was EMPTY — which is the module's existing user-units case, not a new rule.
  if (basis === 'raw_only') return { seed: undefined, inUserUnits: true }
  if (value != null) return { seed: value, inUserUnits: false }
  return { seed: undefined, inUserUnits: true }
}

/**
 * Does this factor's MODEL scale carry a real-world magnitude?
 *
 * ⚠ THIS PREDICATE EXISTS BECAUSE OF A CONFIRMED CORRUPTION (review of #572).
 * When a factor declares a unit but NO cap, CEE stores `value` and `raw_value`
 * IDENTICALLY (`d1-shared/normalise-factor-value.ts:16`, and its own
 * `resolveUserUnitInput` comment: "an uncapped factor stores raw and model
 * identically"). The staging-witnessed shape is
 * `{value: 40000, unit: '£', raw_value: 40000}` — no cap.
 *
 * On that shape a `'model_scale'` commit of a probability is a catastrophe with
 * no surviving guard: the wire carries `{value: 0.7}` with no `raw_value`, CEE's
 * `resolveUserUnitInput` takes the cap-absent branch and reads 0.7 AS THE
 * POUNDS, and £40,000 becomes £0.70 — with a receipt-gated "checked by you"
 * stamp on it. CEE's own `bare_ratio_on_unit_factor` gate, whose comment
 * describes exactly this output, CANNOT fire: the system-event adapter stamps
 * the factor's OWN unit onto the proposal (`factor-value-edit.ts:323`), so
 * `inputHasUnit` is true; and with no cap the range guards never run.
 *
 * So the refusal has to live here, in the client, at the one place that knows
 * both the basis and the factor's declared shape.
 */
export function isMagnitudeScaledFactor(nodeData: unknown): boolean {
  const obs = getObservedState(nodeData)
  const cap = readNumber(obs.cap)
  const hasPositiveCap = typeof cap === 'number' && Number.isFinite(cap) && cap > 0
  if (hasPositiveCap) return false
  const unit = typeof obs.unit === 'string' ? obs.unit.trim() : ''
  return unit.length > 0
}

/**
 * May an elicited PROBABILITY be offered — and afterwards SHOWN — on this
 * factor?
 *
 * Narrower than `!isMagnitudeScaledFactor`, and the extra narrowing is the
 * display half of the same question. On a CAPPED factor the accepted 0.7 is
 * scale-correct on the wire (CEE inverts it to `0.7 × cap`), but the client
 * cannot DISPLAY it: `setObservedValue` clears both `display_value` copies, no
 * receipt writes the server's `after` values back into node data
 * (`confirmOptimisticFactorEdit` writes the provenance stamp and nothing else),
 * and computing `value × cap` here would be the second scale authority this
 * module exists to prevent. The row would therefore either go blank or keep
 * showing the PREVIOUS magnitude beside the new value — a confident wrong
 * number, which is worse than a blank one.
 *
 * On a factor with no unit and no cap, none of that arises: `value` IS the
 * display scale, CEE persists `raw_value = value`, and the accepted number
 * stays visible exactly as a typed `0.7` does today.
 *
 * WIDENING THIS IS A REAL FEATURE, NOT A ONE-LINE RELAXATION: it needs the
 * applied `graph_patch`'s `after` values written back into node data. Rowed.
 */
export function acceptsElicitedBelief(nodeData: unknown): boolean {
  const obs = getObservedState(nodeData)
  const cap = readNumber(obs.cap)
  if (typeof cap === 'number' && Number.isFinite(cap) && cap > 0) return false
  const unit = typeof obs.unit === 'string' ? obs.unit.trim() : ''
  return unit.length === 0
}

export interface FactorValueEditInput {
  /** The factor node's id. ID-ADDRESSED — a label would retarget on a rename. */
  nodeId: string
  /** The number the user typed, in whatever scale the input was showing. */
  typedValue: number
  /** The node's `data`, read for its OWN cap / unit. */
  nodeData: unknown
  /**
   * Which number the committing input was DISPLAYING. Omit for the
   * `raw_value ?? value` inputs; see `ValueInputSeedBasis`.
   */
  seedBasis?: ValueInputSeedBasis
  /**
   * 0.40.0 — present iff this edit APPLIES a named participant's panel answer
   * ("Use Grace's 0.85" on a closed round's reveal). Ids only; a display name
   * is refused at parse by `RoundParticipantRefSchema.strict()`, which is the
   * PII rule made structural rather than remembered.
   *
   * ⚠ THIS IS A CLAIM, NOT AN INSTRUCTION. CEE verifies it against its own
   * collab store — round on this scenario · participant on that round · that
   * participant's latest belief for this target · round closed · value equal to
   * the server's record — and refuses the whole edit on any mismatch. So the
   * client cannot use it to attribute a number to someone who did not say it;
   * the worst a wrong claim achieves is a refusal.
   *
   * ⚠ REQUIRES A CEE ON >=0.40.0. Every member of the system-event union is
   * `.strict()`, so a CEE still pinned <=0.39.0 REFUSES THE WHOLE TURN rather
   * than dropping the field. That is why the CEE pin bump ships and deploys
   * first.
   */
  appliedFrom?: { round_id: string; participant_id: string }
}

/**
 * Build the UI-side system event for a committed inspector value edit.
 *
 * Returns `null` when the edit is unencodable (no node id, or a non-finite
 * number). Fail CLOSED: a dropped event is a visible "nothing happened", while
 * a fabricated one is a silent wrong mutation on someone's model.
 */
export function buildFactorValueEditEvent(
  input: FactorValueEditInput,
): WireSystemEvent | null {
  const { nodeId, typedValue, nodeData, seedBasis, appliedFrom } = input
  if (!nodeId) return null
  if (typeof typedValue !== 'number' || !Number.isFinite(typedValue)) return null

  // ── the panel-apply belt ─────────────────────────────────────────────────
  // A panel belief IS a model-scale number: it is what the reveal shows beside
  // `model_value_at_version`, and `acceptsElicitedBelief` already refuses to
  // offer elicitation on a capped/united factor at all. So an apply borrows the
  // `'model_scale'` refusals WHOLESALE rather than restating them — the two
  // must not be able to disagree about what a bare belief number means.
  const effectiveSeedBasis: ValueInputSeedBasis | undefined =
    appliedFrom !== undefined ? 'model_scale' : seedBasis

  // ── the `'model_scale'` belt ─────────────────────────────────────────────
  // Both refusals are STRUCTURAL: they hold for every caller, present and
  // future, and they fail CLOSED (no event ⇒ no local write, no wire, no
  // receipt, no stamp) rather than emitting a number the factor cannot mean.
  if (effectiveSeedBasis === 'model_scale') {
    // A probability outside [0,1] is not a model-scale value. The client
    // boundary refuses one in `suggested_value`; this catches every OTHER way
    // a number can reach here — a clarification chip, or a future caller.
    if (typedValue < 0 || typedValue > 1) return null
    // The £40,000 → £0.70 shape. See `isMagnitudeScaledFactor`.
    if (isMagnitudeScaledFactor(nodeData)) return null
  }

  const obs = getObservedState(nodeData)
  const cap = readNumber(obs.cap)
  const unit = typeof obs.unit === 'string' && obs.unit.length > 0 ? obs.unit : undefined
  const { inUserUnits } = resolveValueInputSeed(nodeData, effectiveSeedBasis)

  // `value` is ALWAYS model scale. `normaliseRawFactorValue` is the canonical
  // rule (raw/cap, with the typed number passed through when no honest scale
  // exists) and its own guard spec fails loud if anyone re-inlines it — so it
  // is called, never re-typed.
  const value = inUserUnits ? normaliseRawFactorValue(typedValue, cap) : typedValue

  if (!Number.isFinite(value)) return null

  const payload: Record<string, unknown> = {
    target_id: nodeId,
    value,
    // `field` is a LITERAL in the contract: 'value' is the only accepted value,
    // and absence means the same thing. Sent explicitly so the wire says which
    // field was edited rather than leaving it to be inferred.
    field: 'value' as const,
  }

  // raw_value / unit ABSENCE IS DISTINCT from any value in the contract: it
  // means "the client did not state a magnitude / unit", and the server derives
  // one from `value` and its own stored cap. So only attach them when the user
  // genuinely typed a user-unit magnitude — never as a zero-ish default, which
  // would assert a magnitude the user never gave.
  if (inUserUnits) {
    payload.raw_value = typedValue
    if (unit) payload.unit = unit
  }

  // The attribution claim rides LAST and alone. No `raw_value`/`unit` can
  // accompany it: `effectiveSeedBasis` forces `'model_scale'`, so `inUserUnits`
  // is false and the block above did not run. That matters — CEE discards a
  // client's user-unit fields on a verified apply, and a client that sent them
  // anyway would be asserting a magnitude nobody stated.
  if (appliedFrom !== undefined) {
    payload.applied_from = {
      round_id: appliedFrom.round_id,
      participant_id: appliedFrom.participant_id,
    }
  }

  return { type: 'factor_value_edit', payload }
}
