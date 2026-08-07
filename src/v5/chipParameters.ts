/**
 * Typed chip-parameter builders — the UI-producer shape authority for the S2
 * typed-mutation / add-option intents (@talchain/schemas 0.22.0).
 *
 * THE GAP THESE CLOSE: today a mutation chip sends free-text and relies on CEE
 * re-parsing the rendered copy (Sonnet ORIENT / the deterministic value parser).
 * S2 stops that: when the UI has RESOLVED the edit on the canvas (target id + a
 * numeric value), it ships that pre-resolved spec in `chip.parameters` and CEE's
 * typed reader synthesises a zero-LLM proposal. These builders produce EXACTLY
 * the parameter shape CEE's readers accept — matched byte-for-byte against the
 * CEE-side shape authorities at staging tip `e7f312d` (edge-chip-door build):
 *   set_factor_value / adjust_edge_strength / add_constraint
 *     → src/orchestrator-v5/routing/typed-chip-mutation-proposal.ts
 *   add_option (an Intent, not an action_type)
 *     → src/orchestrator-v5/routing/add-option-transaction.ts
 *
 * TWO HARD RULES (both enforced here, both proven by tests):
 *  1. GENUINELY-TYPED FINITE NUMBERS, NEVER STRINGS, NEVER COERCED. Every
 *     numeric field is emitted as a real `number` and validated `Number.isFinite`
 *     (NaN / ±Infinity are rejected, not clamped). CEE's readers reject a
 *     non-finite / non-numeric value and fall through to the LLM (#635); a
 *     silent commit of a coerced value is the exact failure mode this closes.
 *  2. NO SILENT DEFAULTING. A builder REFUSES (returns `{ ok: false, reason }`)
 *     rather than fabricate a value or drop a bad one — the UI-is-a-passthrough
 *     rule. The caller decides (fall through to free-text, surface an error).
 *
 * Chip copy is NOT a fallback channel (CEE no longer re-parses it, #639) — the
 * value MUST ride these typed parameters or it does not reach CEE at all.
 */

/** Discriminated result — never throws, never coerces. */
export type ChipParametersResult<T> =
  | { readonly ok: true; readonly parameters: T }
  | { readonly ok: false; readonly reason: ChipParametersFailReason }

export type ChipParametersFailReason =
  | 'target_id_required'
  | 'edge_target_required'
  | 'value_not_finite'
  | 'value_out_of_range'
  | 'std_not_finite'
  | 'std_out_of_range'
  | 'unit_invalid'
  | 'operator_invalid'
  | 'constraint_type_invalid'
  | 'label_required'
  | 'parent_decision_id_required'
  | 'option_id_invalid'
  | 'factor_id_required'
  | 'raw_value_not_finite'
  | 'duplicate_factor'
  | 'too_many_interventions'

/**
 * Operator vocabulary — identical to CEE's `OperatorSchema`
 * (typed-chip-mutation-proposal.ts). CEE defaults a missing operator to 'set';
 * the UI only emits `operator` when it genuinely means a non-set operation.
 */
export const CHIP_PARAM_OPERATORS = ['set', 'increase', 'decrease', 'multiply'] as const
export type ChipParamOperator = (typeof CHIP_PARAM_OPERATORS)[number]

/** add_constraint direction vocabulary — CEE `constraint_type`. */
export const CONSTRAINT_TYPES = ['at_least', 'at_most'] as const
export type ConstraintType = (typeof CONSTRAINT_TYPES)[number]

/**
 * Max intervention factors on a single add_option chip.
 *
 * CEE's held-proposal PROPOSAL_CAP is 8 PatchOperations. An add_option
 * transaction (add-option-transaction.ts) emits: 1 `add_node` (the option) +
 * 1 `add_edge` (parent-decision → option) + N `add_edge` (option → factor),
 * where N = interventions.length. So N + 2 ≤ 8 ⇒ N ≤ 6. A chip proposing more
 * than 6 configured factors exceeds the cap and CEE classifies it as a
 * fall-through — never let the UI emit a doomed transaction.
 */
export const MAX_ADD_OPTION_INTERVENTIONS = 6

// --- shared guards ----------------------------------------------------------

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function isOperator(v: unknown): v is ChipParamOperator {
  return typeof v === 'string' && (CHIP_PARAM_OPERATORS as readonly string[]).includes(v)
}

function fail<T>(reason: ChipParametersFailReason): ChipParametersResult<T> {
  return { ok: false, reason }
}

// --- set_factor_value -------------------------------------------------------

export type SetFactorValueParameters = {
  target_id: string
  value: number
  unit?: string
  operator?: ChipParamOperator
}

export interface SetFactorValueInput {
  /** Factor node id (CEE requires the target to resolve to a `factor` node). */
  targetId: string
  /** The factor value — a genuine finite number. */
  value: number
  unit?: string
  operator?: ChipParamOperator
}

export function buildSetFactorValueParameters(
  input: SetFactorValueInput,
): ChipParametersResult<SetFactorValueParameters> {
  if (!isNonEmptyString(input.targetId)) return fail('target_id_required')
  if (!Number.isFinite(input.value)) return fail('value_not_finite')
  if (input.unit !== undefined && !isNonEmptyString(input.unit)) return fail('unit_invalid')
  if (input.operator !== undefined && !isOperator(input.operator)) return fail('operator_invalid')
  return {
    ok: true,
    parameters: {
      target_id: input.targetId,
      value: input.value,
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
      ...(input.operator !== undefined ? { operator: input.operator } : {}),
    },
  }
}

// --- adjust_edge_strength ---------------------------------------------------

export type AdjustEdgeStrengthParameters = {
  target_id?: string
  from?: string
  to?: string
  /** Edge strength — CEE's chip.parameters field is `value` (the ProposalAction
   * later names it `strength`). Finite, in [-1, 1]. */
  value: number
  std?: number
  operator?: ChipParamOperator
}

export interface AdjustEdgeStrengthInput {
  /** A composed edge id ("from→to" or "from->to"). Provide this OR from+to. */
  targetId?: string
  from?: string
  to?: string
  /** Edge strength (finite, [-1, 1]). */
  value: number
  /** Optional dispersion (finite, (0, 0.5]). */
  std?: number
  operator?: ChipParamOperator
}

export function buildAdjustEdgeStrengthParameters(
  input: AdjustEdgeStrengthInput,
): ChipParametersResult<AdjustEdgeStrengthParameters> {
  const hasComposed = isNonEmptyString(input.targetId)
  const hasPair = isNonEmptyString(input.from) && isNonEmptyString(input.to)
  // CEE refine: target_id != null OR (from != null AND to != null).
  if (!hasComposed && !hasPair) return fail('edge_target_required')
  if (!Number.isFinite(input.value)) return fail('value_not_finite')
  if (input.value < -1 || input.value > 1) return fail('value_out_of_range')
  if (input.std !== undefined) {
    if (!Number.isFinite(input.std)) return fail('std_not_finite')
    if (input.std <= 0 || input.std > 0.5) return fail('std_out_of_range')
  }
  if (input.operator !== undefined && !isOperator(input.operator)) return fail('operator_invalid')
  // Prefer the composed id when supplied (CEE parses "from→to"); otherwise the
  // explicit endpoint pair. Never emit both.
  const target = hasComposed
    ? { target_id: input.targetId as string }
    : { from: input.from as string, to: input.to as string }
  return {
    ok: true,
    parameters: {
      ...target,
      value: input.value,
      ...(input.std !== undefined ? { std: input.std } : {}),
      ...(input.operator !== undefined ? { operator: input.operator } : {}),
    },
  }
}

// --- add_constraint ---------------------------------------------------------

export type AddConstraintParameters = {
  target_id: string
  constraint_type: ConstraintType
  value: number
  label?: string
  unit?: string
}

export interface AddConstraintInput {
  /** Goal / node id the constraint attaches to (an option target is refused by CEE). */
  targetId: string
  constraintType: ConstraintType
  value: number
  label?: string
  unit?: string
}

export function buildAddConstraintParameters(
  input: AddConstraintInput,
): ChipParametersResult<AddConstraintParameters> {
  if (!isNonEmptyString(input.targetId)) return fail('target_id_required')
  if (input.constraintType !== 'at_least' && input.constraintType !== 'at_most') {
    return fail('constraint_type_invalid')
  }
  if (!Number.isFinite(input.value)) return fail('value_not_finite')
  if (input.label !== undefined && !isNonEmptyString(input.label)) return fail('label_required')
  if (input.unit !== undefined && !isNonEmptyString(input.unit)) return fail('unit_invalid')
  return {
    ok: true,
    parameters: {
      target_id: input.targetId,
      constraint_type: input.constraintType,
      value: input.value,
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
    },
  }
}

// --- add_option (Intent) ----------------------------------------------------

export type AddOptionInterventionParameters = {
  factor_id: string
  value: number
  unit?: string
  raw_value?: number | string | boolean
}

export type AddOptionParameters = {
  parent_decision_id: string
  label: string
  option_id?: string
  interventions: AddOptionInterventionParameters[]
}

export interface AddOptionInterventionInput {
  factorId: string
  /** The effect value — a genuine finite number. */
  value: number
  unit?: string
  /** Polymorphic raw value; the NUMBER branch must still be finite. */
  rawValue?: number | string | boolean
}

export interface AddOptionInput {
  parentDecisionId: string
  label: string
  optionId?: string
  interventions: AddOptionInterventionInput[]
}

export function buildAddOptionParameters(
  input: AddOptionInput,
): ChipParametersResult<AddOptionParameters> {
  if (!isNonEmptyString(input.parentDecisionId)) return fail('parent_decision_id_required')
  if (!isNonEmptyString(input.label)) return fail('label_required')
  if (input.optionId !== undefined && !isNonEmptyString(input.optionId)) {
    return fail('option_id_invalid')
  }
  // Guard the PROPOSAL_CAP up front so the UI never emits a doomed transaction.
  if (input.interventions.length > MAX_ADD_OPTION_INTERVENTIONS) {
    return fail('too_many_interventions')
  }
  const seenFactors = new Set<string>()
  const interventions: AddOptionInterventionParameters[] = []
  for (const iv of input.interventions) {
    if (!isNonEmptyString(iv.factorId)) return fail('factor_id_required')
    if (seenFactors.has(iv.factorId)) return fail('duplicate_factor')
    seenFactors.add(iv.factorId)
    if (!Number.isFinite(iv.value)) return fail('value_not_finite')
    if (iv.unit !== undefined && !isNonEmptyString(iv.unit)) return fail('unit_invalid')
    if (typeof iv.rawValue === 'number' && !Number.isFinite(iv.rawValue)) {
      return fail('raw_value_not_finite')
    }
    interventions.push({
      factor_id: iv.factorId,
      value: iv.value,
      ...(iv.unit !== undefined ? { unit: iv.unit } : {}),
      ...(iv.rawValue !== undefined ? { raw_value: iv.rawValue } : {}),
    })
  }
  return {
    ok: true,
    parameters: {
      parent_decision_id: input.parentDecisionId,
      label: input.label,
      ...(input.optionId !== undefined ? { option_id: input.optionId } : {}),
      interventions,
    },
  }
}

/** The typed intent an add_option chip carries (an `Intent`, not an `ActionType`). */
export const ADD_OPTION_INTENT = 'add_option' as const
