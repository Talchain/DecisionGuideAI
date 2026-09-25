/**
 * `goal_target_edit` — the UI half of the DURABLE, TYPED goal-target write CEE
 * has not shipped yet.
 *
 * ── WHAT THIS CLOSES ─────────────────────────────────────────────────────────
 * Today `useModelEditAuthority.proposeGoalTarget` records a target through the
 * LLM-mediated `add_constraint` chip action (`manualGoalTarget.ts`). That path
 * works, but it is a natural-language tool call: CEE's coach derives structure
 * from a sentence, and in OpenAI mode no goal-target writer exists at all
 * (served witness #63 5818078809 — `goal_threshold_raw` unchanged). A strict,
 * typed system event closes that gap the same way `structural_rename` closed
 * the equivalent one for labels.
 *
 * ── ⚠⚠ THIS MEMBER IS NOT YET IN THE VENDORED CONTRACT, AND THAT IS WHY THIS
 * MODULE IS PREPARED RATHER THAN ARMED ────────────────────────────────────────
 * CEE's Canonical State lane is adding `goal_target_edit` to the strict
 * system-event union (Talchain/olumi-programme-docs#63 comment 5821033941,
 * Codex amendment 5821693599 widening `raw_value` to allow `0` for
 * `at_most`). At the time this module was written the pinned
 * `@talchain/schemas` is 0.55.0 and carries NO `goal_target_edit` member —
 * checked verbatim in `node_modules/@talchain/schemas`, not assumed. Every
 * member of `SystemEventSchema`'s union is `.strict()`, so a CEE that has not
 * deployed a reader for this kind fails the DISCRIMINATOR and rejects the
 * WHOLE TURN (422), exactly as the READER-FIRST notes beside
 * `structural_rename` / `structural_add` in `conversation/types.ts` describe.
 *
 * Those three siblings solved reader-first by MERGE ORDERING — the emitter
 * simply did not exist in the tree until CEE's writer had already shipped.
 * That is not available here: this PR is explicitly "prepare now; CEE ships
 * the carrier separately", so the emitter must exist, compile and be testable
 * BEFORE CEE's reader exists. `GOAL_TARGET_EDIT_ENABLED` is the substitute
 * gate — it is the ONE place that decides whether the one real producer
 * (`useModelEditAuthority.proposeGoalTarget`) ever calls
 * {@link buildGoalTargetEditEvent} instead of taking the existing
 * `add_constraint` path. Flip it to `true` only after CEE's reader is
 * deployed — never before, and never as part of this change.
 *
 * ── WHAT THE CLIENT MAY ASSERT, AND WHAT IT MAY NOT ────────────────────────
 * Five fields, `.strict()` (once vendored): `goal_node_id`, `constraint_type`,
 * `raw_value`, `unit`, `base_graph_hash`. The server derives `cap`,
 * `goal_threshold`, `frame` and provenance from those — the client never
 * sends them, matching the contract's own instruction that "the server derives
 * cap, goal_threshold, frame, provenance".
 *
 * ⚠ `raw_value` ZERO IS REAL FOR `at_most`, REFUSED FOR `at_least`. Codex's
 * amendment (5821693599) widened the field to permit `0` — a genuine ceiling,
 * e.g. "at most 0 defects" — while `at_least` keeps the strict `>0` bound: a
 * floor of exactly zero states nothing ("at least 0" is true of every value),
 * so it is refused rather than sent as a no-op assertion.
 *
 * ⚠ `base_graph_hash` IS NON-OPTIONAL AND HAS NO CLIENT-SIDE DEFAULT — the
 * same stale gate every other mutating member states. See
 * `optionInterventionEdit.ts` for the fuller reasoning; it applies verbatim.
 */
import type { WireSystemEvent } from './types'
import type { ConstraintType } from '../../v5/chipParameters'

/**
 * ⛔⛔ THE READER-FIRST GATE FOR THIS MEMBER. `false` until CEE's Canonical
 * State lane has DEPLOYED a reader for `goal_target_edit` — see this module's
 * header. While `false`, `useModelEditAuthority.proposeGoalTarget` takes the
 * existing `add_constraint` path and this builder has no production caller;
 * every other export below stays testable regardless of the flag's value.
 *
 * `rg GOAL_TARGET_EDIT_ENABLED` finds every place that reads it — there is
 * deliberately exactly one place that WRITES it: this line.
 */
export const GOAL_TARGET_EDIT_ENABLED = false

export interface BuildGoalTargetEditArgs {
  /** The GOAL node whose target is being set. Canonical id, never a label. */
  goalNodeId: string
  /** The bound direction — CEE's own `at_least` / `at_most` vocabulary. */
  constraintType: ConstraintType
  /** The user-stated magnitude, in `unit`. Model-scale derivation is CEE's. */
  rawValue: number
  /** The user-stated unit. Required — absence is not "no unit", it refuses. */
  unit: string
  /**
   * The last CEE-stamped `graph_hash`, or `null` when none has been seen this
   * session (`useCanvasStore.lastServerGraphHash`). Null REFUSES the build.
   */
  baseGraphHash: string | null
}

/**
 * The two ways this build can refuse — same split `optionInterventionEdit.ts`
 * makes and for the same reason: `needs_fresh_base` is the one refusal a user
 * can clear (any turn refreshes the base), and collapsing it into
 * `not_encodable` would offer a "try again" that terminates in the same
 * refusal with different words.
 */
export type GoalTargetEditRefusal = 'not_encodable' | 'needs_fresh_base'

export type GoalTargetEditBuild =
  | { readonly ok: true; readonly event: WireSystemEvent }
  | { readonly ok: false; readonly refusal: GoalTargetEditRefusal }

/**
 * Canonical ids are open strings — CEE's persisted ids are the authority, so
 * this does NOT narrow to the lowercase `NodeV3Schema.shape.id` pattern. What
 * the contract requires is exact, non-blank bytes with neither composite
 * delimiter, and no trimming: changing an identity byte would be silent
 * retargeting. Mirrors `optionInterventionEdit.ts`'s own local predicate
 * rather than importing `structuralDelete.ts`'s `isCanonicalEndpointId` — same
 * rule, kept local so this module has no import surface into the deletion
 * lane for one four-line check.
 */
function isCanonicalNodeId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id === id.trim() &&
    !id.includes('→') &&
    !id.includes('->')
  )
}

const REFUSE = (refusal: GoalTargetEditRefusal): GoalTargetEditBuild => ({ ok: false, refusal })

/**
 * Build the `goal_target_edit` wire event, or refuse.
 *
 * ⚠ ORDER IS PART OF THE CONTRACT BELOW THIS LINE, same ruling
 * `optionInterventionEdit.ts` makes: everything the user cannot fix is asked
 * FIRST, so a bad input is never reported as a stale base — and
 * `needs_fresh_base` is asked LAST, because it is the only refusal a caller
 * can offer a recovery for.
 */
export function buildGoalTargetEditEvent({
  goalNodeId,
  constraintType,
  rawValue,
  unit,
  baseGraphHash,
}: BuildGoalTargetEditArgs): GoalTargetEditBuild {
  if (!isCanonicalNodeId(goalNodeId)) return REFUSE('not_encodable')

  if (constraintType !== 'at_least' && constraintType !== 'at_most') {
    return REFUSE('not_encodable')
  }

  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return REFUSE('not_encodable')
  }
  // Finite and >= 0 for every direction — a negative magnitude is not a thing
  // the contract's `raw_value` can state for either bound.
  if (rawValue < 0) return REFUSE('not_encodable')
  // `at_least` keeps the strict `>0` bound: "at least 0" asserts nothing, so a
  // typed zero floor is refused rather than sent as a no-op. `at_most` allows
  // zero — Codex's amendment (5821693599) — because "at most 0" is a real,
  // sayable ceiling.
  if (constraintType === 'at_least' && rawValue <= 0) return REFUSE('not_encodable')

  const trimmedUnit = typeof unit === 'string' ? unit.trim() : ''
  if (trimmedUnit.length === 0) return REFUSE('not_encodable')

  // ⭐ Asked LAST, deliberately — the one refusal a user can clear must never
  // be reached by an edit that would be refused anyway (see the order note
  // above and `optionInterventionEdit.ts`'s fuller reasoning).
  if (typeof baseGraphHash !== 'string' || baseGraphHash.length === 0) {
    return REFUSE('needs_fresh_base')
  }

  return {
    ok: true,
    event: {
      type: 'goal_target_edit',
      payload: {
        goal_node_id: goalNodeId,
        constraint_type: constraintType,
        raw_value: rawValue,
        unit: trimmedUnit,
        base_graph_hash: baseGraphHash,
      },
    },
  }
}
