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
 *   · its operator is the comparator the goal HOLDS (`goal_direction`), `>=` when it holds none — SD-1 (DL 0df0e1,
 *     6 Oct): CEE now stamps a brief-stated CEILING too (`stated-by-user.ts`, RT-10 #2585: `goal_threshold_raw` +
 *     `goal_direction '<='`), so its `<=` row restates that target exactly as a floor's `>=` row restates a floor;
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
import {
  canCaptureGoalTarget, goalHeldComparatorOf, goalTargetChangeFrameOf, goalTargetFrameIsUnread, resolveGoalTarget,
  statedGoalTargetRaw, statedTargetNumber, type GoalHeldComparator, type GoalTargetSource, type ResolvedGoalTarget,
} from './goalTarget'

/** The target a surface STATES — its figure (number or numeric string), its unit, and the comparator the goal holds. */
export interface StatedGoalTargetFigure {
  readonly raw: unknown
  readonly unit: unknown
  /** The goal node's `goal_direction`, read raw (`goalHeldComparatorOf`). Absent or unheld = `>=`, the floor default. */
  readonly comparator?: unknown
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
  if (constraint.node_id !== goalId) return false
  // A DEADLINE row is a time limit, never the target restated (Codex #2544 r1 item 2).
  const deadline = (constraint as { deadline_metadata?: unknown }).deadline_metadata
  if (deadline !== null && typeof deadline === 'object' && !Array.isArray(deadline)) return false
  // The row's STATED sense must be exactly the held one: a stricter "< 400" beside an inclusive "at most 400" is a
  // different limit and stays listed (Codex #2544 r1 item 2).
  const held = goalHeldComparatorOf(statedTarget.comparator) ?? '>='
  const rowSense = statedOperatorOf(constraint as { operator?: unknown; operator_as_stated?: unknown }) ?? constraint.operator
  if (rowSense !== held) return false
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
  // CEE's rule (`goalOwnLimitRow`): with no target on the node, the goal's own non-deadline limit row IS its target
  // ("at most 400"). The card then states it as that row's pill instead of "Target not captured" (DL 0df0e1).
  if (!hasTarget && !isDetailed && goalOwnLimitRow(constraints, goalId) === null) return []
  const statedTarget = hasTarget
    ? { raw: statedGoalTargetRaw(goalData), unit: goalData?.goal_threshold_unit, comparator: goalData?.goal_direction }
    : null
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

/**
 * ⭐ THE GOAL'S OWN LIMIT ROW IS ITS TARGET WHEN THE NODE HOLDS NONE — CEE's ONE target rule, read here as CEE reads it
 * (`stated-goal-target.ts` `goalOwnLimitRow` / `statedGoalTargetOf`, CEE staging ba4759af; RT-10 a8, DL 0df0e1).
 *
 * Served (red team #87 6003539060): "at most 400" set in the Model panel writes ONLY the goal's `<=` row; CEE never
 * stamps `goal_threshold_raw` for `<=`. So every reader of the node alone said "Not set" (the Model row) and "No
 * measurable success target is set" (Analysis) for the target the user had just given.
 *
 * Counts: `node_id` is the goal's, a finite `value`, and NO `deadline_metadata` (a "within 6 months" row on the goal is
 * a time limit, not its target). The first such row in stored order. Another node's limit never counts.
 * ⚠ A second reader of CEE's rule until CEE carries the one authority on `analysis_ready` (a8, after cut 3).
 */
export function goalOwnLimitRow<C extends CEEGoalConstraint>(
  constraints: readonly C[] | null | undefined,
  goalId: string | null | undefined,
): C | null {
  if (!constraints || !goalId) return null
  return constraints.find((c) => {
    const deadline = (c as { deadline_metadata?: unknown }).deadline_metadata
    return c.node_id === goalId && typeof c.value === 'number' && Number.isFinite(c.value)
      && !(deadline !== null && typeof deadline === 'object' && !Array.isArray(deadline))
  }) ?? null
}

/** CEE's words for a limit's comparator (`limit-operator-words.ts`), read through its `statedOperatorOf`. */
const LIMIT_OPERATOR_WORDS: Readonly<Record<string, string>> = {
  '>=': 'at least', '<=': 'at most', '>': 'more than', '<': 'less than',
}
function statedOperatorOf(row: { readonly operator?: unknown; readonly operator_as_stated?: unknown }): string | undefined {
  const held = row.operator
  if (held !== '<=' && held !== '>=') return undefined
  if (held === '<=' && row.operator_as_stated === '<') return '<'
  if (held === '>=' && row.operator_as_stated === '>') return '>'
  return held
}

/** A target read from the goal's own limit row: the figure and unit as the row states them, and its bound in CEE's words. */
export interface GoalOwnRowTarget extends ResolvedGoalTarget {
  /** "at most" / "at least" / "less than" / "more than": said before the figure, since the row's comparator IS the target's sense. */
  readonly bound: string
}

/**
 * The goal's stated target as CEE resolves it: the node's own (`resolveGoalTarget`), else its own limit row
 * (`goalOwnLimitRow`) with that row's bound. Null when neither states one, when the node's frame is one this UI cannot
 * read, or when the row's comparator has no words (it still COUNTS as a stated target: `goalOwnLimitRow`).
 */
export function resolveGoalTargetWithOwnRow(
  data: GoalTargetSource | null | undefined,
  constraints: readonly CEEGoalConstraint[] | null | undefined,
  goalId: string | null | undefined,
): ResolvedGoalTarget | GoalOwnRowTarget | null {
  const fromNode = resolveGoalTarget(data)
  if (fromNode !== null) {
    // SD-1: a node that HOLDS a ceiling says so. A bare figure reads as a level to reach (`>=`), so every other held
    // comparator is said before it, in CEE's words — the same bound its own row gives below.
    const bound = heldTargetBoundWords(data)
    return bound === null ? fromNode : { ...fromNode, bound }
  }
  if (goalTargetFrameIsUnread(data?.goal_threshold_frame)) return null
  const row = goalOwnLimitRow(constraints, goalId)
  if (row === null) return null
  const comparator = statedOperatorOf(row as { operator?: unknown; operator_as_stated?: unknown })
  const bound = comparator === undefined ? undefined : LIMIT_OPERATOR_WORDS[comparator]
  if (bound === undefined) return null
  const changeFrame = goalTargetChangeFrameOf((row as { value_frame?: unknown }).value_frame)
  return {
    raw: row.value as number,
    unit: typeof row.unit === 'string' ? row.unit : undefined,
    // The row says nothing about who set it in the attestation sense `source` licenses ("Set by you").
    source: 'unrecorded',
    ...(changeFrame === null ? {} : { frame: changeFrame }),
    bound,
  }
}

/** The bound a resolved target carries, when it was read from the goal's own limit row. */
export function goalTargetBound(target: ResolvedGoalTarget | GoalOwnRowTarget | null | undefined): string | null {
  return target != null && 'bound' in target && typeof target.bound === 'string' ? target.bound : null
}

/**
 * ⭐⭐ SD-1 (domain 2; DL 0df0e1 6 Oct, a8 census `output/domain3-a8/reader-census.md`): ONE SOURCE FOR WHICH SIDE OF
 * ITS TARGET THE GOAL IS ON — the canonical goal node's `goal_direction` in CEE's current read, and nothing else.
 *
 * The words a goal's LEVEL target needs before its figure: CEE's limit words for a held `<=` / `<` / `>`. `null` for
 * a held `>=` (a bare figure already reads as a level to reach), for no held comparator, and for a change frame (its
 * own words, `formatGoalChangeBound`). Every display reader of a node-held target says its bound through this.
 */
export function heldTargetBoundWords(data: GoalTargetSource | null | undefined): string | null {
  if (data == null || goalTargetChangeFrameOf(data.goal_threshold_frame) !== null) return null
  const held = goalHeldComparatorOf(data.goal_direction)
  return held === null || held === '>=' ? null : LIMIT_OPERATOR_WORDS[held]
}

/**
 * The comparator the goal's stated target holds, for an EDITOR to open on: the node's `goal_direction` when the node
 * holds the target, else its own limit row's (`goalOwnLimitRow`, CEE's one target rule). An editor that opened on
 * `at_least` regardless restated a ceiling as a floor on save (a8 census, DGAI rows 2-4).
 */
export function goalTargetComparator(
  data: GoalTargetSource | null | undefined,
  constraints: readonly CEEGoalConstraint[] | null | undefined,
  goalId: string | null | undefined,
): GoalHeldComparator | null {
  // The node's own held side WINS, figure or not: one source (Codex #2544 r1 item 3: a held '<=' beside a first own
  // row '>=' must not open on "at least").
  const held = goalHeldComparatorOf(data?.goal_direction)
  if (held !== null || resolveGoalTarget(data) !== null) return held
  const row = goalOwnLimitRow(constraints, goalId)
  return row === null ? null : goalHeldComparatorOf(statedOperatorOf(row as { operator?: unknown; operator_as_stated?: unknown }))
}

/** The editors' two-way direction for a held comparator: a ceiling opens on `at_most`, everything else on `at_least`. */
export function goalTargetEditDirection(comparator: GoalHeldComparator | null): 'at_least' | 'at_most' {
  return comparator === '<=' || comparator === '<' ? 'at_most' : 'at_least'
}
