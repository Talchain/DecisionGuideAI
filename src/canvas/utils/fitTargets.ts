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

/** The affordance's id, spelled ONCE for the whole codebase. */
export const GHOST_OPTION_NODE_ID = '__ghost-option__'

/**
 * Drop UI placeholders from a fit target list.
 *
 * Generic over the node shape so it serves both `Node[]` from the store and
 * ReactFlow's `getNodes()` without either caller casting.
 */
export function excludeNonModelNodes<T extends { id: string }>(nodes: readonly T[]): T[] {
  return nodes.filter((n) => n.id !== GHOST_OPTION_NODE_ID)
}
