/**
 * ⭐⭐ WHICH OPTIONS ARE LINKED TO THIS NODE — the fact the sentence "Nothing to
 * compare yet" is actually about.
 *
 * ── WHY IT EXISTS ──────────────────────────────────────────────────────────
 * `BaseNode`'s decision arm asked `edges.some(e => e.source === id)` and
 * rendered a pill that says the decision has no OPTIONS. Those are two
 * different facts, and they come apart in both directions:
 *
 *   FALSE CLAIM   An `option → decision` edge — which `isValidConnection`
 *                 (`ReactFlowGraph.tsx:2347`) permits, as it applies no kind
 *                 or direction rule — is not an OUTGOING edge, so the card
 *                 announced "Nothing to compare yet" about a decision whose
 *                 option is sitting right there on the canvas.
 *   SILENT GAP    A `decision → factor` edge IS outgoing, so it suppressed the
 *                 pill on a decision that genuinely has nothing to compare.
 *
 * One predicate, two harms, opposite signs — the shape CLAUDE.md trap 22b
 * warns about. Binding the predicate to the sentence closes both at once.
 *
 * ── BOTH DIRECTIONS, AND THAT IS NOT A NEW ANSWER ──────────────────────────
 * `DecisionPanel.tsx:66-77` already ruled on this exact state (review D3): an
 * `option → decision` edge "fell through BOTH lists", so the panel reported
 * "No connections yet." while the canvas plainly drew the edge. Its fix counts
 * an option joined in EITHER direction, and dedupes by the option's node id
 * because "an option joined in BOTH directions is ONE connection to the user".
 * This module is that same rule, named once so the pill cannot invent a second
 * one (CLAUDE.md trap 12).
 *
 * ── THE DEDUPE IS NOT SPECULATIVE ──────────────────────────────────────────
 * `DecisionNode.tsx:316-341` records duplicate decision→option edges as a
 * REACHABLE state: `store.addEdge` refuses them, but the CEE patch path
 * (`applyPatch.ts:350`) appends supplied edges wholesale with no duplicate
 * check, and `useModelHealth.ts:180` already ships a "Duplicate edge" warning
 * for it. Two edges to one option are one option. Pinned in this module's spec,
 * not left as untested generality.
 *
 * ── THE KIND CHAIN IS BORROWED, NEVER RE-SPELLED ───────────────────────────
 * `resolveNodeTypeLiteral` (`domain/nodes.ts:57`) is the estate's declared owner
 * of "what kind is this node", and its own header forbids a second copy. A
 * private `n.type === 'option' || n.data?.type === 'option'` here would be a
 * fourth spelling in this repo (`DecisionNode`'s local filter, `DecisionPanel`'s
 * `type || data.kind`, `graphFacts.kindOf`'s kind-first-default-factor chain)
 * and would answer differently on a node seeded through `data.kind`.
 *
 * ⚠ AN EDGE TO AN ID THAT IS NOT IN `nodes` ESTABLISHES NOTHING. A dangling
 * edge has no option at its far end, so it is not counted — the claim needs a
 * node it can name, not an id it can read.
 *
 * ⛔ SCOPE — WHAT THIS DELIBERATELY DOES NOT TOUCH. `DecisionNode`'s own
 * `optionCount` (:342) is still outgoing-only, and `DecisionNode.spec.tsx:151`
 * PINS that ("does not count edges where this node is the target (not source)").
 * Migrating it would change four user-visible readers — the "N options" chip,
 * the "My model has N options so far" sentence, the resting line and the
 * popover gate — and flip a deliberate pin, which needs its own evidence and
 * its own review. Named here so the next round has a target rather than a
 * fifth invention.
 */

import { resolveNodeTypeLiteral } from './nodes'

/** The shape this module reads — structural, so store nodes and test fixtures both fit. */
export interface LinkableNode {
  id: string
  type?: string
  data?: unknown
}

/** The shape this module reads from an edge. */
export interface LinkableEdge {
  source?: string
  target?: string
}

/**
 * The distinct option nodes joined to `nodeId` by an edge in EITHER direction,
 * in edge order. Empty array = nothing linked, which is a fact to act on.
 *
 * Guarded against absent slices rather than assuming them: every canvas card
 * calls this on every render, and a not-yet-populated store would otherwise
 * take the whole board down rather than omit one pill.
 */
export function linkedOptionIds(
  nodes: ReadonlyArray<LinkableNode> | null | undefined,
  edges: ReadonlyArray<LinkableEdge> | null | undefined,
  nodeId: string,
): string[] {
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !nodeId) return []

  const byId = new Map<string, LinkableNode>()
  for (const node of nodes) {
    if (node && typeof node.id === 'string') byId.set(node.id, node)
  }

  const ids: string[] = []
  const seen = new Set<string>()
  for (const edge of edges) {
    if (!edge) continue
    // A self-loop resolves to `nodeId` itself and is skipped: a node is not its
    // own option, and the kind check below would refuse it anyway.
    const otherId =
      edge.source === nodeId ? edge.target
      : edge.target === nodeId ? edge.source
      : undefined
    if (typeof otherId !== 'string' || otherId === nodeId) continue
    if (seen.has(otherId)) continue
    const other = byId.get(otherId)
    if (!other) continue
    if (resolveNodeTypeLiteral(other) !== 'option') continue
    seen.add(otherId)
    ids.push(otherId)
  }
  return ids
}
