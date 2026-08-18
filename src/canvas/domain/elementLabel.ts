/**
 * elementLabel — THE ONE resolver for "what do we call this element on screen".
 *
 * ⚠ THE DEFECT THIS CLOSES. The inspector's own header already resolved an
 * absent label to `'Untitled'` (`InspectorRouter.tsx`), and so do
 * `useNodeConnections`, `usePreAnalysisInbound`, `BaseNode` and `persist`. The
 * inspector PANELS did not: fourteen call sites resolved an absent label to the
 * element's **id** (`String(n.data?.label ?? n.id)`), unconditionally and
 * outside technical mode. So one and the same unlabelled node read `'Untitled'`
 * in the panel header and `fac_7c21_budget_growth` three lines below it, in a
 * connection row. An internal identifier is not a name, and the user has no way
 * to act on one.
 *
 * ⚠ WHY A FUNCTION RATHER THAN SIX MORE INLINE `?? 'Untitled'`. The estate
 * already carries eight hand-copied `'Untitled'` literals and fourteen
 * hand-copied id fallbacks; that spread is exactly how the two halves drifted
 * apart in the first place (trap 12 — derive, do not mirror). One resolver
 * means the fallback cannot disagree with itself across surfaces, and a
 * source-scan guard can pin the absence of the id form.
 *
 * ⚠ WHAT THIS IS NOT. It does not invent a name. `'Untitled'` is a statement
 * that the element has no name yet — the same honest-absence rule the model
 * outline's provenance pill follows when it renders nothing rather than
 * asserting a value. The id remains available to anyone who needs it: every
 * panel's technical disclosure prints it under `Node ID` / `Edge key`, and the
 * model outline prints it in the Advanced tier. Suppressing an identifier from
 * the plain surface is not hiding information; it is putting it where it means
 * something.
 */

/**
 * The single fallback string. Exported so a guard can pin it and so no caller
 * has to retype it — a retyped literal is a mirror waiting to drift.
 */
export const UNNAMED_ELEMENT_LABEL = 'Untitled'

/**
 * Resolve an element's display name from its `data` bag.
 *
 * Returns the trimmed `label` when the bag carries a non-empty string one, and
 * `UNNAMED_ELEMENT_LABEL` otherwise. A whitespace-only label is treated as
 * absent: it is indistinguishable from no label on screen, and rendering it
 * produces a nameless row with no fallback at all.
 *
 * Deliberately takes the DATA BAG, not the node: edges and nodes both reach
 * this with a `data` object, and a node-shaped parameter would have forced
 * edge callers to build a fake node.
 */
export function resolveElementLabel(data: unknown): string {
  if (data !== null && typeof data === 'object') {
    const label = (data as { label?: unknown }).label
    if (typeof label === 'string' && label.trim() !== '') return label
  }
  return UNNAMED_ELEMENT_LABEL
}

/**
 * The first STATED name among several candidate data bags, else the honest
 * no-name fallback.
 *
 * Exists for the one real case with two legitimate name sources: an option's
 * comparison row, where the graph node's own label wins and the analysis
 * payload's `label` covers an option the graph no longer holds. The id that
 * used to sit at the end of that chain is not a third source — it is a database
 * key, and it has been removed rather than demoted.
 */
export function resolveFirstStatedLabel(...bags: readonly unknown[]): string {
  for (const bag of bags) {
    const resolved = resolveElementLabel(bag)
    if (resolved !== UNNAMED_ELEMENT_LABEL) return resolved
  }
  return UNNAMED_ELEMENT_LABEL
}
