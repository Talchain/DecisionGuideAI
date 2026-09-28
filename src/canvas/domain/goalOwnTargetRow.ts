/**
 * ⭐ THE GOAL'S OWN TARGET IS NOT ONE OF ITS LIMITS — and ONLY the target row is
 * set aside (canvas audit edit-values F7; review r2 blocker 1).
 *
 * CEE stores a success target in two forms, deliberately (`add-constraint.ts`,
 * "(a) the goal_constraints row … (b) the goal node's OWN goal_threshold_raw"):
 * an `at_least` goal edit (`isSuccessTargetTurn` is `kind === 'goal' &&
 * operator === '>='`) upserts a `goal_constraints` row on the GOAL ITSELF,
 * `value: params.value // user units, no normalisation`, and stamps the node's
 * `goal_threshold_raw` / `success_threshold` with the SAME number and
 * `goal_threshold_unit` with the row's unit. A surface that already states form
 * (b) as `Target: X` and lists form (a) as well prints the target twice.
 *
 * ⛔ THE FIRST CUT DROPPED EVERY ROW ON THE GOAL'S NODE, and that hid real
 * limits. CEE's `at_most` goal edit "deliberately does NOT stamp a threshold.
 * The constraint entry still lands" (`manualGoalTarget.ts`), and the
 * headcount-allocation starter carries `{node_id: 'goal_arr', operator: '<=',
 * value: 2, unit: 'months', label: 'Delivery deadline'}` — a ceiling on the goal
 * node that is NOT its target. Once a target was set, that bound vanished from
 * the card's pills and from Layer 2.
 *
 * So the row is identified, not located: it restates the target only when ALL
 * of these hold —
 *   · it sits on the goal's own node;
 *   · its operator is `>=` — the only operator CEE stamps a target from;
 *   · its figure EQUALS the stated target (float noise aside), read as the row's
 *     `value`, or as its audited reader's figure when CEE rewrote the scale;
 *   · its unit is the target's unit (`%`/`percent`/`percentage` are one unit;
 *     `GBP` and `£` are one currency — CEE's own `sameUnit` treats a currency
 *     spelling as the same quantity; every other unit compares as written).
 * Anything else — a ceiling, a different number, a different unit, a row on
 * another node — is a limit and stays. When a comparison cannot be made (no
 * stated target, no finite number), nothing is set aside: a doubled target is a
 * lesser harm than a hidden limit.
 */
import type { CEEGoalConstraint } from '../../adapters/cee/types'
import { classifyUnit, ISO_CURRENCY_GLYPHS } from '../../utils/unitClassifier'
import { canCaptureGoalTarget, statedGoalTargetRaw, statedTargetNumber, type GoalTargetSource } from './goalTarget'

/** The target a surface STATES — its figure (number or numeric string) and its unit. */
export interface StatedGoalTargetFigure {
  readonly raw: unknown
  readonly unit: unknown
}

/** One comparison key per unit: a currency by its glyph, a percent by `%`, anything else as written. */
function unitKey(unit: unknown): string {
  const { kind, canonical } = classifyUnit(typeof unit === 'string' ? unit : null)
  if (kind === 'none') return ''
  if (kind === 'iso') return ISO_CURRENCY_GLYPHS[canonical.toUpperCase()] ?? canonical.toUpperCase()
  return canonical
}

function sameFigure(a: number, b: number): boolean {
  return Number(a.toPrecision(12)) === Number(b.toPrecision(12))
}

/** Does this constraint row restate the goal's stated target (see the header)? */
export function constraintRestatesGoalTarget(
  constraint: CEEGoalConstraint,
  goalId: string,
  statedTarget: StatedGoalTargetFigure | null | undefined,
): boolean {
  if (statedTarget == null) return false
  if (constraint.node_id !== goalId || constraint.operator !== '>=') return false
  const figure = statedTargetNumber(statedTarget.raw)
  if (figure === null) return false
  const key = unitKey(statedTarget.unit)
  const matches = (value: unknown, unit: unknown): boolean =>
    typeof value === 'number' && Number.isFinite(value) && sameFigure(value, figure) && unitKey(unit) === key
  if (matches(constraint.value, constraint.unit)) return true
  const audit = constraint.provenance_unit_normalised
  return audit != null && matches(audit.original_value, audit.original_unit)
}

/**
 * The limits a goal surface states: every row except the one that restates the
 * target THIS SURFACE ALREADY STATES. Pass `null` for `statedTarget` when the
 * surface shows no target line — then that row is the only statement of the
 * target and is kept.
 */
export function goalStatedLimits<C extends CEEGoalConstraint>(
  constraints: readonly C[] | null | undefined,
  goalId: string,
  statedTarget: StatedGoalTargetFigure | null | undefined,
): C[] | null {
  if (!constraints) return null
  return constraints.filter((c) => !constraintRestatesGoalTarget(c, goalId, statedTarget))
}

/**
 * ⭐⭐ THE LIMIT ROWS THE GOAL CARD ITSELF SHOWS, WITH NOTHING OPENED — the one
 * answer to "does the Goal already state this limit?" (side-by-side DIFF pre-run
 * item 7, 28 Sep 2026).
 *
 * The Goal card states its limits in exactly two resting forms:
 *   · Standard view: the boundary pills beside `Target: …` — only when a target
 *     is on the row (the missing state shows ONE pill, "Target not captured");
 *   · Detailed view: Layer 2 inline, whose constraint list states every limit.
 * Both read `goalStatedLimits` with the target the card states, so this is the
 * SAME set, from the same inputs `GoalNode` reads (`canCaptureGoalTarget`,
 * `statedGoalTargetRaw`, the node's `goal_threshold_unit`) — `GoalNode`'s pill
 * row calls this, so the pills and every reader of this function cannot drift.
 *
 * ⚠ THE ROWS ARE THE CALLER'S OWN OBJECTS (a filter, never a copy), so a reader
 * holding the same constraint slice can key "the same limit" by row identity.
 */
export function goalCardShownLimits<C extends CEEGoalConstraint>(
  constraints: readonly C[] | null | undefined,
  goalId: string,
  goalData: GoalTargetSource | null | undefined,
  isDetailed: boolean,
): C[] {
  const hasTarget = !canCaptureGoalTarget(goalData)
  if (!hasTarget && !isDetailed) return []
  const statedTarget = hasTarget ? { raw: statedGoalTargetRaw(goalData), unit: goalData?.goal_threshold_unit } : null
  return goalStatedLimits(constraints, goalId, statedTarget) ?? []
}

/**
 * The identity of a constraint ROW: the producer's `constraint_id`, then `id`.
 * `null` when it carries neither — such a row is the same row only as the same
 * object (see `sameConstraintRow`).
 */
function constraintRowKey(c: CEEGoalConstraint): string | null {
  const key = c.constraint_id ?? c.id
  return typeof key === 'string' && key !== '' ? key : null
}

/**
 * ⭐ IS THIS THE SAME CONSTRAINT ROW? — by identity, never by its text or its
 * figure: the same object, or the same producer id. Two different limits that
 * happen to print alike ("≥110%" on two outcomes) are two rows.
 */
export function sameConstraintRow(a: CEEGoalConstraint, b: CEEGoalConstraint): boolean {
  if (a === b) return true
  const ka = constraintRowKey(a)
  return ka !== null && ka === constraintRowKey(b)
}
