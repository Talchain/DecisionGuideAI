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
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠⚠ THE SHAPE TEST IS A PROPERTY OF THE ENVELOPE, NEVER AN OBSERVATION ABOUT
 * WHAT CEE CURRENTLY EMITS (P0, 2026-08-26)
 * ─────────────────────────────────────────────────────────────────────────────
 * This header used to state, as a fact about the data, that *"`scenarios.graph`
 * carries no geometry at all"* — and `isCanvasShapedNode` was built on it,
 * discriminating purely on `'position' in n`. A census of staging `scenarios`
 * then found **19 GraphV3 rows carrying node `position`**, all written within
 * the preceding 30 days. Every one of them defeated the discriminator and
 * hydrated UNPROJECTED: the P0 walked back in through this module's own front
 * door, and the whole suite stayed green because the fixture precondition in
 * `store.ceeShapedHydration.p0` explicitly asserts CEE nodes carry no position
 * (CLAUDE.md trap 13d — a corpus that omits a class the contract admits cannot
 * certify the code over that class).
 *
 * A shape predicate must therefore test what makes a node THAT SHAPE, not a
 * field one writer happens not to send yet — see `isCanvasShapedNode` for the
 * contract-required marker it uses instead.
 *
 * ⚠ WHAT THE GUARDS DO AND DO NOT COVER — stated exactly, because an earlier
 * draft of this header claimed the post-condition test *"REDs if any second
 * shape reaches the store by ANY ROUTE"*, and review MEASURED that false: it
 * severed the call at `useScenario.ts:699` and the spec stayed 15/15 green.
 * **That sentence was a contingent claim stated as settled fact — the precise
 * defect this module exists to close, re-armed in the header of its own fix.**
 *   · `normalisePersistedGraph.geometryBearingCeeRow.p0.spec.ts` asserts a
 *     post-condition over THIS FUNCTION'S OUTPUT for the fixtures under test.
 *     It proves the projector projects. It cannot see ROUTES at all: a caller
 *     that never calls this function is invisible to it.
 *   · `hydrationRouteNormalisation.sourceScan.spec.ts` is what watches routes.
 *     It derives every `hydrateGraphSlice` caller from source and requires each
 *     to normalise or be a REGISTERED KNOWN GAP.
 * Neither is a claim about deployed data. Together they cover "the projector is
 * correct" and "every route reaches it"; they do not cover a store already
 * populated before this change shipped.
 *
 * ⚠ SHAPE IS NORMALISED; LAYOUT IS PRESERVED. A projected node keeps whatever
 * geometry the row carried (`mapDraftNodeToCanvas` hardcodes `{x: 0, y: 0}`,
 * which is right for its WIRE callers and wrong for a persisted row). Fixing a
 * shape defect by discarding the user's layout would swap one silent loss for
 * another.
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
 * ⚠ `position` ALONE IS NOT THE DISCRIMINATOR, AND USING IT AS ONE WAS A P0
 * (measured 2026-08-26). The original rule here was `'position' in n`, justified
 * by *"React Flow requires it on every node and CEE's GraphV3 carries no
 * geometry at all"*. That is a claim about the DATA, and the data refutes it: a
 * census of staging `scenarios` found **19 GraphV3 rows carrying node
 * `position`**, all updated within the preceding 30 days. For every one of them
 * this predicate answered TRUE, the node was passed through UNPROJECTED, and a
 * CEE-shaped object reached a store whose every consumer assumes React Flow —
 * the exact P0 this module exists to retire, re-entering through its own front
 * door.
 *
 * ── THE TEST IS A POSITIVE, CONTRACT-GUARANTEED CEE MARKER ─────────────────
 * The first version of this fix discriminated on the React Flow ENVELOPE
 * (`data`). That is a real improvement on `'position' in n` — it is a property
 * of the shape rather than a claim about a producer — but review found it is
 * still a NEGATIVE test against a contract that does not forbid the thing:
 * `NodeV3Schema` is **`.passthrough()`** (`@talchain/schemas/dist/graph.js:256`,
 * `.passthrough()` at :273), so a CEE node carrying `data` is contract-
 * PERMITTED, merely unobserved — **the very same admissibility that let
 * `position` through.** Shipping that would have re-armed this defect's own
 * mechanism one level along.
 *
 * So the CEE side is now identified by what the contract REQUIRES. On
 * `NodeV3Schema`, `id`, `kind` and `label` carry no `.optional()`: any node that
 * validates as GraphV3 **must** have `kind` and `label` at the top level. That
 * is guaranteed by the schema, not observed in a sample — the difference
 * between *"the data has not done this yet"* and *"the data cannot."*
 *
 * A canvas node keeps `kind`/`label` inside `data`; the top level is React
 * Flow's own `{id, type, position, data}`. So the two shapes are separated by a
 * marker each one is REQUIRED to carry, in opposite places.
 *
 * ⚠ THE ENVELOPE TEST IS KEPT AS THE SECOND LIMB, and its contingency is stated
 * rather than implied away: it is what a node must present once it is NOT
 * CEE-marked, and `position` presence (not truthiness) keeps a legitimate
 * `{x: 0, y: 0}` on the canvas side. It is a sufficient test for the shapes this
 * estate writes today; it is not a contract guarantee, because React Flow does
 * not require `data`. If a canvas writer ever emits a node without `data`, this
 * limb sends it through the projector — which preserves its geometry and gives
 * it an envelope, so the failure mode is conservative rather than lossy.
 */
export function isCanvasShapedNode(n: unknown): boolean {
  if (typeof n !== 'object' || n === null) return false
  const node = n as {
    position?: unknown
    data?: unknown
    kind?: unknown
    label?: unknown
  }

  // (1) POSITIVE, CONTRACT-REQUIRED CEE MARKER. `NodeV3Schema` requires BOTH,
  // so this cannot be defeated by a producer starting to emit an extra field —
  // it can only be defeated by CEE ceasing to emit a REQUIRED one.
  if (typeof node.kind === 'string' && typeof node.label === 'string') {
    return false
  }

  // (2) Otherwise the node must present the React Flow envelope.
  if (!('position' in node)) return false
  return typeof node.data === 'object' && node.data !== null
}

/**
 * Geometry keys that must never end up inside `data`.
 *
 * `mapDraftNodeToCanvas` destructures only `{id, kind, type, label,
 * observed_state}` and spreads the REST onto `data`, so a persisted node that
 * carries geometry would deposit `position` into `data` while the mapper's
 * hardcoded `{x: 0, y: 0}` took the real top-level slot. Layout is presentation
 * and belongs at the root of a React Flow node or nowhere.
 */
const CANVAS_GEOMETRY_KEYS = ['position', 'positionAbsolute', 'measured'] as const

/** A usable `{x, y}`, or null. Guards against a malformed persisted value. */
function readPersistedPosition(n: unknown): { x: number; y: number } | null {
  if (typeof n !== 'object' || n === null) return null
  const pos = (n as { position?: unknown }).position
  if (typeof pos !== 'object' || pos === null) return null
  const { x, y } = pos as { x?: unknown; y?: unknown }
  if (typeof x !== 'number' || !Number.isFinite(x)) return null
  if (typeof y !== 'number' || !Number.isFinite(y)) return null
  return { x, y }
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

  const nodes = rawNodes.map((n) => {
    if (isCanvasShapedNode(n)) return n

    // Project the shape — then put the LAYOUT back. `mapDraftNodeToCanvas`
    // hardcodes `{x: 0, y: 0}` because its other three callers convert WIRE
    // nodes, which genuinely have no geometry. A persisted row can have some,
    // and normalising the shape must not scramble the user's canvas: fixing a
    // shape defect by silently discarding layout would trade one silent loss
    // for another. The mapper stays byte-unchanged for its other callers; the
    // salvage lives here, at the boundary that owns the persisted column.
    const mapped = mapDraftNodeToCanvas(n)
    const persistedPosition = readPersistedPosition(n)

    if (persistedPosition) mapped.position = persistedPosition

    // A CEE-MARKED NODE THAT ALSO CARRIES `data`. `NodeV3Schema` is
    // `.passthrough()`, so this is contract-PERMITTED — and the lesson of this
    // whole change is that "permitted but unobserved" is exactly the class that
    // eventually arrives (trap 13d). The mapper's `...rest` would nest it as
    // `data.data`, hiding the canvas payload from every `data.*` consumer.
    // Flatten it UNDERNEATH the CEE values: the top-level fields are the ones
    // the contract requires, so they win a collision.
    const nested = mapped.data?.data
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      mapped.data = { ...nested, ...mapped.data }
      delete mapped.data.data
    }

    // `...rest` deposits any geometry the row carried into `data`. Strip it:
    // layout is presentation, and a duplicate copy inside `data` would ride
    // into the autosave hash and every `data.*` consumer as if it were content.
    for (const key of CANVAS_GEOMETRY_KEYS) {
      if (mapped.data && key in mapped.data) delete mapped.data[key]
    }

    return mapped
  })

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
