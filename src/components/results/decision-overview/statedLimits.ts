/**
 * statedLimits — the user's own hard limits, formatted for display.
 *
 * ── WHAT THIS IS, AND THE ONE THING IT MUST NEVER DO ────────────────────────
 * The hard-constraint chain carries TWO different facts about a limit, with
 * two different trust levels, and this module handles exactly one of them:
 *
 *   TRUSTWORTHY — the limit ITSELF: label, operator, value, unit. The user
 *     stated it; CEE recorded it into `goal_constraints[]`; the store holds it
 *     at `goalConstraints`. Nothing here is computed. That is what this module
 *     formats.
 *
 *   DISTRUSTED — `prob_satisfied` / `joint_probability` /
 *     `constraint_probabilities` / the per-constraint `probability` field.
 *     These are producer-computed and currently gated OFF for cause
 *     (`PLOT_PER_OPTION_CONSTRAINTS_SUSPECT`, `adapters/plot/constraintTrust.ts`).
 *
 * This module therefore reads `label`, `operator`, `value` and `unit` and
 * NOTHING ELSE. It deliberately does not accept, thread or format
 * `probability` — a limit is displayed as the user's own statement of a
 * boundary, never as a likelihood of meeting it. Reviving the suspect
 * probabilities here would ship exactly the confident wrongness the constraint
 * chain exists to prevent.
 *
 * ── WHY A CONSTRAINT CAN BE SKIPPED ─────────────────────────────────────────
 * `CEEGoalConstraint` types `value` and `operator` as required, but the value
 * arrives across a wire boundary from two independent producers (CEE's
 * `draft_graph.goal_constraints` and `add_constraint` graph patches) and the
 * persisted JSONB column is untyped. A row whose value is absent or non-finite
 * is not a limit we can state, so it is omitted rather than rendered as
 * "undefined" or coerced to a number the user never said.
 */
import type { CEEGoalConstraint } from '../../../adapters/cee/types'
import { formatTargetValue } from '../utils/formatTargetValue'

/**
 * ASCII → unicode for display. The wire operator is ASCII by contract
 * (@talchain/schemas `DraftGoalConstraintSchema`: `z.enum(['>=', '<='])`);
 * an unrecognised operator is passed through verbatim rather than guessed at.
 */
export function renderLimitOperator(operator: string): string {
  if (operator === '>=') return '≥'
  if (operator === '<=') return '≤'
  return operator
}

/**
 * Currency units arrive as the SYMBOL itself ('£', '$'), not as the
 * `'currency'` union member `formatTargetValue` expects, so the symbol is
 * mapped onto that formatter rather than a second number-formatting
 * vocabulary being minted here.
 */
const CURRENCY_SYMBOLS = new Set(['£', '$', '€', '¥'])

/**
 * Format the limit's value in the user's units.
 *
 * An unrecognised unit (e.g. 'fraction', 'headcount') formats the bare number
 * — appending an unknown unit string would be inventing a display the producer
 * did not specify.
 */
export function formatStatedLimitValue(value: number, unit?: string): string {
  if (unit != null && CURRENCY_SYMBOLS.has(unit)) return formatTargetValue(value, 'currency', unit)
  if (unit === '%') return formatTargetValue(value, 'percent')
  return formatTargetValue(value)
}

export interface StatedLimit {
  /**
   * Stable identity for this limit, `constraint_id ?? id ?? index`.
   * Consumers bind to a limit BY THIS ID — never by its text or its value,
   * either of which another limit could satisfy.
   */
  id: string
  /** The limit as the user stated it, e.g. "Budget ≤ £50,000". */
  text: string
}

/**
 * Project the store's `goalConstraints` slice into displayable limits.
 *
 * Returns an EMPTY ARRAY for every shape that is not a usable constraint, so a
 * model with no stated limit renders exactly as it did before this existed.
 */
export function selectStatedLimits(
  constraints: readonly CEEGoalConstraint[] | null | undefined,
): StatedLimit[] {
  if (!Array.isArray(constraints)) return []

  const limits: StatedLimit[] = []

  constraints.forEach((constraint, index) => {
    if (constraint == null || typeof constraint !== 'object') return

    const { value, operator } = constraint
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    if (typeof operator !== 'string' || operator.length === 0) return

    const id = String(constraint.constraint_id ?? constraint.id ?? index)
    const measure = `${renderLimitOperator(operator)} ${formatStatedLimitValue(value, constraint.unit)}`
    // Guard the read: CEE's own producer schema declares `label` optional and
    // it is genuinely absent in practice. A limit with no label shows its
    // boundary alone rather than a fabricated name like "Constraint 1".
    const label = typeof constraint.label === 'string' ? constraint.label.trim() : ''

    limits.push({ id, text: label.length > 0 ? `${label} ${measure}` : measure })
  })

  return limits
}

/**
 * A PRIMITIVE, content-addressed key for the stated limits.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 * `DecisionOverviewCard` is under a standing primitive-selector contract
 * (`DecisionOverviewCard.primitiveSelectors.spec.tsx`, React 185 / the
 * `ci:guard:zustand` guard): the card must re-commit only when a value it
 * RENDERS changes. Selecting `s.goalConstraints` directly hands back the array
 * IDENTITY, so every store write that rebuilds an equal-content array — a node
 * drag, a producer re-sync — would re-commit the whole card. That regression
 * was caught by the existing suite, not theorised.
 *
 * Selecting this string instead means the card re-commits when, and only when,
 * the limits it displays actually change. JSON is used rather than a delimiter
 * so no label content can corrupt the encoding; the list is at most a handful
 * of entries.
 */
export function selectStatedLimitsKey(
  constraints: readonly CEEGoalConstraint[] | null | undefined,
): string {
  return JSON.stringify(selectStatedLimits(constraints))
}

/** Inverse of {@link selectStatedLimitsKey}. */
export function parseStatedLimitsKey(key: string): StatedLimit[] {
  try {
    const parsed: unknown = JSON.parse(key)
    return Array.isArray(parsed) ? (parsed as StatedLimit[]) : []
  } catch {
    return []
  }
}
