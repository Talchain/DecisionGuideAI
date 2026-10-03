/**
 * APPLY A VERSION RESTORE TO THE CANVAS — the ONE path every server-side
 * restore takes (Version history today; canvas Undo/Redo next, which is
 * CEE's own rule: "undo is 'restore the version the current head names as its
 * undo pointer'", assist.v1.scenario-versions.ts).
 *
 * A restore is not a receipt. Its graph is the COMPLETE stored model, so:
 *
 *  1. REPLACE, DON'T OVERLAY. The receipt rule "the canvas KEEPS keys the wire
 *     omits" (`overlayNode`) would leave an undone first-time value on screen
 *     while the saved model has none. `restoreReplace` makes the canvas node's
 *     data exactly what a fresh browser maps from the same wire node; layout is
 *     kept.
 *  2. RETIRE THE PRE-RESTORE READY SNAPSHOT FIRST (see ServerVersionsSection's
 *     note: the reconcile's intervention backfill reads it, and it describes the
 *     model the user just replaced).
 *  3. FORGET RESTORED DELETIONS. An element the restore put back is held by the
 *     server again; leaving it in `durablyDeletedElements` lets the next proven
 *     delete's whole-record reconcile strip it off the canvas.
 *  4. SETTLE THROUGH THE COLD-OPEN READ (`settleRestoredModel`). The write base,
 *     server identity, acknowledgement and run currency are the reload path's
 *     job (serverGraphHydration.ts, Canvas-owned); a restore reuses it rather
 *     than growing a second implementation. Until it settles, the next edit's
 *     base is the pre-restore one and would be refused as stale.
 */

import { useCanvasStore } from '../store'
import { reconcileAppliedGraph, type ReconcileAppliedGraphResult } from '../utils/mergeAppliedGraph'
import { hydrateCanvasFromServer, type HydrationOutcome } from '../hydrate/serverGraphHydration'
import { canvasEdgePairKey, wireEdgePairKey } from '../utils/graphIdentity'

export interface RestoredGraph {
  readonly nodes: readonly unknown[]
  readonly edges: readonly unknown[]
}

function wireIds(items: readonly unknown[]): string[] {
  const ids: string[] = []
  for (const item of items) {
    const id = (item as { id?: unknown } | null)?.id
    if (typeof id === 'string' && id.length > 0) ids.push(id)
  }
  return ids
}

/** The restore adapter types its graph `unknown`; read only its two arrays. */
function asRestoredGraph(value: unknown): RestoredGraph {
  const g = value as { nodes?: unknown; edges?: unknown } | null | undefined
  return {
    nodes: Array.isArray(g?.nodes) ? g.nodes : [],
    edges: Array.isArray(g?.edges) ? g.edges : [],
  }
}

/** Steps 1–3, synchronously. Returns the reconcile's own counts. */
export function applyRestoredGraph(restored: unknown): ReconcileAppliedGraphResult {
  const graph = asRestoredGraph(restored)
  useCanvasStore.getState().setCeeAnalysisReady(null)

  const applied = reconcileAppliedGraph(
    // The reconcile reads `.graph.nodes/.graph.edges` on exactly this shape.
    { graph } as unknown as Parameters<typeof reconcileAppliedGraph>[0],
    { restoreReplace: true },
  )

  // Forget exactly what the server holds again: restored node ids, and the
  // canvas ids of edges whose endpoint PAIR the restored graph carries.
  const restoredPairs = new Set<string>()
  for (const e of graph.edges) {
    const key = wireEdgePairKey(e as Parameters<typeof wireEdgePairKey>[0])
    if (key !== null) restoredPairs.add(key)
  }
  const heldAgainEdgeIds = useCanvasStore
    .getState()
    .edges.filter((e) => {
      const key = canvasEdgePairKey(e)
      return key !== null && restoredPairs.has(key)
    })
    .map((e) => e.id)
  useCanvasStore.getState().forgetDurableDeletion({
    nodeIds: wireIds(graph.nodes),
    edgeIds: heldAgainEdgeIds,
  })

  return applied
}

/** Step 4: adopt the restored model's write base, identity and run currency. */
export function settleRestoredModel(
  scenarioId: string,
  identity: { readonly userId?: string | null; readonly accessToken?: string | null },
): Promise<HydrationOutcome> {
  return hydrateCanvasFromServer(scenarioId, {
    userId: identity.userId ?? null,
    accessToken: identity.accessToken ?? null,
  })
}
