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
  const { nodeId, typedValue, nodeData, seedBasis } = input
  if (!nodeId) return null
  if (typeof typedValue !== 'number' || !Number.isFinite(typedValue)) return null

  const obs = getObservedState(nodeData)
  const cap = readNumber(obs.cap)
  const unit = typeof obs.unit === 'string' && obs.unit.length > 0 ? obs.unit : undefined
  const { inUserUnits } = resolveValueInputSeed(nodeData, seedBasis)

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

  return { type: 'factor_value_edit', payload }
}
