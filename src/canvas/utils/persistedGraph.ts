/**
 * persistedGraph — the canonical shape of the `scenarios.graph` JSONB column.
 *
 * B3 (Codex deep review, 2026-07-18). Before this module the column was
 * written as `{ nodes, edges }` and read back as `{ nodes, edges }`, so a
 * scenario's hard constraints were session-only:
 *
 *   - the browser's full-graph save carried only `{ nodes, edges }`, which
 *     STRIPPED any top-level `goal_constraints` already persisted into that
 *     column, and
 *   - `useScenario.loadScenario` reconstructed only `{ nodes, edges }`, so a
 *     cold load could not restore a constraint even when one was stored.
 *
 * The constraint therefore survived only in memory, which is also why it
 * leaked across a scenario switch (see DECISION_CONTEXT_CLEAR in store.ts).
 *
 * WIRE-KEY CHOICE: the persisted key is `goal_constraints` (snake_case),
 * matching the CEE/@talchain/schemas wire name, NOT the store's camelCase
 * `goalConstraints`. The column is a cross-boundary artefact — CEE reads and
 * writes it too — so it keeps the wire spelling; the camelCase name stops at
 * the store. Both spellings are accepted on READ so a row written by either
 * side hydrates (fail-open on read, canonical on write).
 *
 * The graph HASH is deliberately still computed over `{ nodes, edges }` only
 * (see scenarioService.saveGraphViaGatedPath): the hash is compared against
 * CEE's own graph hash, and adding a key to the hashed surface would fork
 * the two hash definitions. Constraints ride the column, not the hash.
 */

import type { CEEGoalConstraint } from '../../adapters/cee/types'

/** The persisted `scenarios.graph` payload. */
export interface PersistedGraph<TNode = unknown, TEdge = unknown> {
  nodes: TNode[]
  edges: TEdge[]
  /** Canonical persisted spelling — matches the CEE wire, not the store. */
  goal_constraints?: CEEGoalConstraint[] | null
}

/**
 * Defensive read of `goal_constraints` out of a `scenarios.graph` JSONB value.
 *
 * Returns `null` for every shape that is not a non-empty array of
 * constraint-like objects. JSONB is untyped at the boundary and this value is
 * fed straight to the run request, so a malformed row must degrade to "no
 * constraint" rather than shipping junk to PLoT.
 *
 * An EMPTY array also returns null: `[]` and "absent" mean the same thing to
 * every downstream reader (isGoalDefined, GoalPanel, the run request), and
 * collapsing them here keeps the round-trip assertion unambiguous.
 */
export function readPersistedGoalConstraints(
  graph: unknown,
): CEEGoalConstraint[] | null {
  if (graph == null || typeof graph !== 'object') return null

  const raw =
    (graph as { goal_constraints?: unknown }).goal_constraints ??
    // Fail-open: tolerate a row written with the store's camelCase spelling.
    (graph as { goalConstraints?: unknown }).goalConstraints

  if (!Array.isArray(raw) || raw.length === 0) return null

  const valid = raw.filter(isConstraintLike)
  return valid.length > 0 ? valid : null
}

/**
 * Minimum shape a persisted constraint must have to be usable.
 *
 * `operator` and `value` are the only fields every consumer dereferences
 * unconditionally (`id`/`constraint_id`/`label` are all documented-optional on
 * CEEGoalConstraint), so they are the only ones required here. Anything
 * looser would let a `{}` through and re-open the class of bug where a
 * constraint renders as an empty row.
 */
function isConstraintLike(c: unknown): c is CEEGoalConstraint {
  if (c == null || typeof c !== 'object') return false
  const { operator, value } = c as { operator?: unknown; value?: unknown }
  return (
    (operator === '>=' ||
      operator === '<=' ||
      operator === '>' ||
      operator === '<' ||
      operator === '=') &&
    typeof value === 'number' &&
    Number.isFinite(value)
  )
}

/**
 * Build the canonical persisted payload.
 *
 * `goal_constraints` is emitted ONLY when there is something to persist, so a
 * constraint-free scenario keeps writing the historical `{ nodes, edges }`
 * bytes exactly — no churn in the saved snapshot, and no new key appearing on
 * every row in the estate.
 */
export function buildPersistedGraph<TNode, TEdge>(
  nodes: TNode[],
  edges: TEdge[],
  goalConstraints: CEEGoalConstraint[] | null | undefined,
): PersistedGraph<TNode, TEdge> {
  const base: PersistedGraph<TNode, TEdge> = { nodes, edges }
  if (Array.isArray(goalConstraints) && goalConstraints.length > 0) {
    base.goal_constraints = goalConstraints
  }
  return base
}
