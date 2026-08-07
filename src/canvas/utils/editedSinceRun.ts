/**
 * editedSinceRun — N3 (graph-visuals): which nodes have been edited since the
 * last analysis run. The freshness strip says "the model changed"; the amber
 * corner dot makes that spatial by marking WHERE.
 *
 * Device-local comparison of the CURRENT canvas nodes against the latest
 * stored run's graph snapshot (runHistory) — the same honestly-labelled
 * client-side mechanism as the What-changed chip (Paul's 2026-07-12 ruling).
 *
 * "Edited" means an ANALYSIS-RELEVANT change:
 *   - the node was added since the run (no snapshot counterpart), or
 *   - its label changed (the chip's node-modified rule), or
 *   - its observed state / value changed (what actually invalidates results).
 * Position moves are layout, not edits (auto-arrange would otherwise mark
 * every node). Removed nodes are gone from the canvas — nothing to dot.
 *
 * Fail-closed: no runs, or a legacy run without a graph snapshot, yields an
 * empty set (never "everything is edited").
 */
import type { Node } from '@xyflow/react'

/** Stable stringify of the analysis-relevant slice of node data. */
function analyticalFingerprint(node: Node): string {
  const data = (node.data ?? {}) as Record<string, unknown>
  // label + observed state/value fields; everything else (position, ui flags,
  // coaching decorations) is not an analytical edit.
  return JSON.stringify({
    label: data.label ?? null,
    observedState: data.observedState ?? null,
    value: data.value ?? null,
    threshold: data.threshold ?? null,
  })
}

export function diffEditedNodeIds(
  currentNodes: readonly Node[],
  snapshotNodes: readonly Node[] | undefined,
): Set<string> {
  if (!snapshotNodes) return new Set()
  const snapshot = new Map(snapshotNodes.map((n) => [n.id, analyticalFingerprint(n)]))
  const edited = new Set<string>()
  for (const node of currentNodes) {
    const before = snapshot.get(node.id)
    if (before === undefined) {
      edited.add(node.id) // added since the run
    } else if (before !== analyticalFingerprint(node)) {
      edited.add(node.id) // label / observed-state change
    }
  }
  return edited
}
