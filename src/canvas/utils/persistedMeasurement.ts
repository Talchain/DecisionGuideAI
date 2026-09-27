/**
 * ⛔⛔ A PERSISTED `measured` IS ANOTHER SESSION'S DOM — DROP IT AT THE RESTORE
 * BOUNDARY (canvas audit edit-structure/F1, the sticky half, 27 Sep 2026).
 *
 * React Flow writes `node.measured` after it has drawn a card, and the canvas
 * store keeps it (that in-session copy is load-bearing — see the ghost-door
 * livelock note in `store.ts`'s `onNodesChange`). But the store is persisted as
 * it stands, so the autosave and the local scenario list carried every card's
 * measured size into the NEXT session — a size measured at another width, at
 * another zoom, in a DOM that no longer exists.
 *
 * WHAT THAT BROKE, measured on the served build. `useRestoredLayoutWidth` waits
 * for "at least one measured height" before it bounds the per-kind widths,
 * because the bound is only as good as the heights. Restored heights satisfied
 * that wait before React Flow had measured anything, so the bound was computed
 * on the previous session's heights. After one reload had drawn the factors at
 * 191, those taller heights paired the two factor sub-rows, the bound fell to
 * 124, and the board drew at 191 again — on every reload, and even after the
 * user moved the card back. The loop fed itself.
 *
 * ⭐ So a restore installs positions, kinds, data and paint order exactly as
 * saved, and no measurement: React Flow measures the cards afresh, as it does
 * for a fresh draft, and every reader of `measured` sees this session's DOM.
 *
 * ⚠ ONLY `measured`. A user-set `width` / `height` is an authored size, not a
 * reading, and is left alone.
 */
import type { Node } from '@xyflow/react'

function carriesMeasurement(n: unknown): boolean {
  return typeof n === 'object' && n !== null && 'measured' in n
}

/**
 * The same nodes without React Flow's persisted `measured`. Returns the SAME
 * array when no node carries one, and the same node object for every node that
 * does not, so a restore with nothing to drop churns no identity.
 */
export function withoutPersistedMeasurement<T extends Node>(nodes: T[]): T[] {
  if (!Array.isArray(nodes) || !nodes.some(carriesMeasurement)) return nodes
  return nodes.map((n) => {
    if (!carriesMeasurement(n)) return n
    const copy = { ...n }
    delete (copy as { measured?: unknown }).measured
    return copy
  })
}
