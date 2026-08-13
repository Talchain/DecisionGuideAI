/**
 * normalisePersistedGraph — the ONE place a `scenarios.graph` row is turned into
 * canvas (React Flow) shape before it reaches the store.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (P0, witnessed on deployed `978d073c`, 2026-08-13)
 * ─────────────────────────────────────────────────────────────────────────────
 * The `scenarios.graph` column holds TWO mutually incompatible shapes:
 *
 *   · CEE / GraphV3 — nodes `{id, kind, label, observed_state, …}` with NO
 *     `position` and NO `data`; edges `{from, to, strength, …}` with NO `id`,
 *     NO `source` and NO `target`.  (1,970 rows in staging, back to 22 April.)
 *   · React Flow — nodes `{id, type, position, data}`; edges
 *     `{id, source, target, data}`.
 *
 * `useScenario.loadScenario` used to hydrate that column into the canvas store
 * VERBATIM. On a CEE-written row that put CEE-shaped objects into a store whose
 * every consumer assumes React Flow shape, which produced, on **every reload of
 * a decision Olumi drafted**:
 *
 *   1. `reseedIds` → `getMaxNumericId(edges.map(e => e.id))` → `undefined.replace`
 *      → TypeError thrown OUT of `hydrateGraphSlice`, swallowed by the
 *      `.catch()` at `routes/CanvasMVP.tsx:64`. The graph HAD already been
 *      `set()` into the store, so the rest of `loadScenario` — framing, stage,
 *      `lastSavedAt`, analysis hydration — silently never ran.
 *   2. `computeGraphHash` → `from: e.source` → `undefined.localeCompare` thrown
 *      inside a `useMemo` DURING RENDER → React's error boundary took the whole
 *      canvas: **0 nodes**, under a panel reading "Your work is auto-saved."
 *
 * Hardening each consumer is whack-a-mole: a sweep of `src/` at this SHA found
 * ten store-reachable sites across three severity tiers, plus 64 unguarded
 * `node.data.*` reads. Every such patch is a NEW place that has to remember
 * both shapes. Normalising ONCE at the hydration boundary retires the class.
 *
 * ⚠ NO NEW MAPPER. This deliberately reuses `mapDraftNodeToCanvas` /
 * `mapDraftEdgeToCanvas` from `applyDraftResult.ts` — the mappers the DRAFT path
 * has always used for exactly this conversion. `applyDraftResult`'s header
 * already warns that it is "HOP 1 OF 3" of a hand-mirrored family; a fourth
 * hand-written copy here is precisely the defect this estate keeps paying for.
 * The reload path was not missing a mapper — it was missing a CALL to the one
 * that already existed.
 *
 * ⚠ PER-ELEMENT, NOT PER-GRAPH. Shape is decided element by element, so a mixed
 * row (a CEE graph a client partially overwrote, or vice versa) normalises
 * correctly rather than being classified by whichever element happens to be
 * first.
 *
 * ⚠ IDENTITY FOR ALREADY-CANVAS-SHAPED INPUT. A row already in React Flow shape
 * must come through byte-identical — those rows reload correctly today
 * (witnessed 2/2) and every existing autosave/history pin depends on their
 * projection not moving. `normalisePersistedGraph` returns the SAME node objects
 * by reference in that case; only the documented `DEFAULT_EDGE_DATA` backfill,
 * which `loadScenario` already performed, is applied to edges.
 */

import type { Edge } from '@xyflow/react'
import { mapDraftNodeToCanvas, mapDraftEdgeToCanvas } from './applyDraftResult'
import { DEFAULT_EDGE_DATA, type EdgeData } from '../domain/edges'

/**
 * Is this persisted node already in canvas shape?
 *
 * `position` is the discriminator: React Flow requires it on every node and
 * CEE's GraphV3 carries no geometry at all — `mergeServerGraph`'s header states
 * that CEE measures `layout_present` as false for every real graph. Testing for
 * the field's PRESENCE (not its truthiness) keeps a legitimately-persisted
 * `{x: 0, y: 0}` on the canvas-shaped side.
 */
export function isCanvasShapedNode(n: unknown): boolean {
  return typeof n === 'object' && n !== null && 'position' in (n as object)
}

/**
 * Is this persisted edge already in canvas shape?
 *
 * Both endpoints must be strings. A CEE edge carries neither key; a React Flow
 * edge carries both. Requiring BOTH means a half-written edge is normalised
 * (where the mapper's `from`/`to` fallback can still recover it) rather than
 * passed through with one endpoint undefined.
 */
export function isCanvasShapedEdge(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const { source, target } = e as { source?: unknown; target?: unknown }
  return typeof source === 'string' && typeof target === 'string'
}

export interface NormalisedGraph {
  nodes: any[]
  edges: Edge<EdgeData>[]
}

/**
 * Normalise a persisted `scenarios.graph` payload to canvas shape.
 *
 * Edges always receive the `DEFAULT_EDGE_DATA` backfill — that is not new
 * behaviour, it is what `loadScenario` already did to every persisted edge, and
 * several consumers (including the DEV assertion in `useConversation`) rely on
 * `edge.data` being present.
 */
export function normalisePersistedGraph(graph: unknown): NormalisedGraph {
  const g = (graph ?? {}) as { nodes?: unknown[]; edges?: unknown[] }
  const rawNodes = Array.isArray(g.nodes) ? g.nodes : []
  const rawEdges = Array.isArray(g.edges) ? g.edges : []

  const nodes = rawNodes.map((n) => (isCanvasShapedNode(n) ? n : mapDraftNodeToCanvas(n)))

  const edges = rawEdges.map((e, i) => {
    const canvasEdge: any = isCanvasShapedEdge(e) ? e : mapDraftEdgeToCanvas(e, i)
    return {
      ...canvasEdge,
      data: {
        ...DEFAULT_EDGE_DATA,
        ...((canvasEdge.data as Partial<EdgeData> | undefined) ?? {}),
      },
    } as Edge<EdgeData>
  })

  return { nodes, edges }
}
