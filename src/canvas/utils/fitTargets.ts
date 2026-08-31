/**
 * fitTargets — which nodes a whole-graph `fitView` is allowed to frame.
 *
 * `WORKSPACE-COMPOSITION-DECISION-2026-08-18.md` §5.1 / step 2: exclude the
 * `__ghost-option__` placeholder from every whole-graph fit.
 *
 * ⚠ PRICED HONESTLY, because the brief that commissioned this priced it wrong.
 * The ghost is NOT free width nobody is taking. Three lanes measured its cost at
 * 220, 76, 60, 32 and **zero** flow units on different models, and the
 * load-bearing correction is that the two models where it costs width are
 * HEIGHT-bound — so removing it changes their fit zoom by nothing. On the
 * measured corpus it adds 9% to the width of one starter (vendor-selection,
 * 820 → 896 units) whose fit verdict has ~5% of headroom. So: one line, honest,
 * costless, and **not a win to bank**. It stops a UI affordance from being
 * framed as though it were part of the user's model.
 */

/**
 * The prefix every frontier affordance's id carries, spelled ONCE for the whole
 * codebase — and this file is where it lives because this file owns exclusion.
 *
 * ⚠ IT WAS SPELLED THREE TIMES, WHICH IS HOW IT DRIFTED. `ghostTiers.ts` kept
 * its own `GHOST_ID_PREFIX` and a SECOND `export const GHOST_OPTION_NODE_ID`
 * with the same value, under a comment here claiming the id was "spelled ONCE
 * for the whole codebase" — a hand-maintained mirror inside the sentence
 * denying there was one. Meanwhile `excludeNonModelNodes` matched a bare
 * `'__ghost-'` literal, so nothing tied the filter to the ids it was filtering.
 */
export const GHOST_ID_PREFIX = '__ghost-'

/** The options affordance's id. */
export const GHOST_OPTION_NODE_ID = `${GHOST_ID_PREFIX}option__`

/**
 * Is this a frontier affordance rather than part of the user's model?
 *
 * The one predicate. `excludeNonModelNodes` is its filter form; the
 * `ModelExtentNotice` count and the e2e geometry measures resolve to it too, so
 * "the model" cannot mean three different sets in three places.
 */
export function isGhostNode(id: string): boolean {
  return id.startsWith(GHOST_ID_PREFIX)
}

/**
 * Drop UI placeholders from a fit target list.
 *
 * Generic over the node shape so it serves both `Node[]` from the store and
 * ReactFlow's `getNodes()` without either caller casting.
 */
export function excludeNonModelNodes<T extends { id: string }>(nodes: readonly T[]): T[] {
  // ⚠ PREFIX, NOT ONE ID. The frontier affordance now exists on every tier,
  // and an exclusion keyed on a single id silently stops excluding the moment a
  // second one is added — the hand-maintained-mirror defect, in a filter.
  return nodes.filter((n) => !isGhostNode(n.id))
}
