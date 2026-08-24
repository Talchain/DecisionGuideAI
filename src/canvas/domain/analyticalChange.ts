/**
 * Shared "is this graph edit analysis-affecting?" taxonomy.
 *
 * Single source of truth for which node/edge fields change the analysis (and
 * therefore should invalidate readiness / dirty the freshness overlay), used by
 * both the store edit actions (updateNode/updateEdge) and the raw patch-apply path
 * (applyAutoApplyPatch). Cosmetic fields — label, body, description, position,
 * colour — are deliberately excluded.
 *
 * Comparison is SEMANTIC: structured fields (observedState, prior, interventions)
 * are compared by value, so a re-normalised object with identical content (e.g.
 * CEE re-sending the same observed_state) is NOT treated as a change. This prevents
 * shallow-reference churn from fabricating a stale verdict.
 */

import type { Edge, Node } from '@xyflow/react'
import { STALE_NODE_FIELDS, STALE_EDGE_FIELDS } from './analyticalNodeFields'

// The 'stale' (analysis-affecting) subset now DERIVES from the single
// analyticalNodeFields registry — the same source the autosave persist dirty-gate
// derives from. Adding a field there with the 'stale' purpose reaches this consumer
// automatically; analyticalNodeFields.registry.spec.ts fails loud on any drift.
// The `probability`/`impact` (risk P1.7, #453) and `success_threshold`/
// `goal_threshold_raw` (#457) inclusions live in the registry's per-field notes.
export const ANALYTICAL_NODE_DATA_FIELDS = STALE_NODE_FIELDS

export const ANALYTICAL_EDGE_FIELDS = STALE_EDGE_FIELDS

/** Key-order-insensitive deep equality for small JSON-safe analytical values. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  const aArr = Array.isArray(a)
  if (aArr !== Array.isArray(b)) return false
  if (aArr) {
    const ax = a as unknown[]
    const bx = b as unknown[]
    return ax.length === bx.length && ax.every((v, i) => deepEqual(v, bx[i]))
  }
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const ak = Object.keys(ao)
  const bk = Object.keys(bo)
  return ak.length === bk.length && ak.every((k) => k in bo && deepEqual(ao[k], bo[k]))
}

/** True when a node update touches an analytically meaningful field by VALUE. */
export function hasAnalyticalNodeChange(oldNode: Node, updates: Partial<Node>): boolean {
  // Node-level: kind change (ReactFlow `type` field).
  if (updates.type !== undefined && updates.type !== oldNode.type) return true

  const oldData = (oldNode.data ?? {}) as Record<string, unknown>
  const newData = updates.data as Record<string, unknown> | undefined
  if (!newData) return false

  for (const field of ANALYTICAL_NODE_DATA_FIELDS) {
    if (field in newData && !deepEqual(newData[field], oldData[field])) return true
  }
  return false
}

/** True when an edge update touches an analytically meaningful field by VALUE. */
export function hasAnalyticalEdgeChange(oldEdge: Edge, updates: Partial<Edge>): boolean {
  // Top-level endpoint changes (defence-in-depth; primary path is updateEdgeEndpoints).
  if (updates.source !== undefined && updates.source !== oldEdge.source) return true
  if (updates.target !== undefined && updates.target !== oldEdge.target) return true

  const oldData = (oldEdge.data ?? {}) as Record<string, unknown>
  const newData = updates.data as Record<string, unknown> | undefined
  if (!newData) return false

  for (const field of ANALYTICAL_EDGE_FIELDS) {
    if (field in newData && !deepEqual(newData[field], oldData[field])) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// § Graph-level lift — the SAME taxonomy, asked of two complete graphs
//
// WHY THIS LIVES HERE AND NOT IN THE CONSUMER. The consumer that needs it
// (`useGuidanceInvalidationOnEdit`) watches the canvas store and holds two
// COMPLETE graphs, not an update partial. Writing the comparison there would
// have made it a FOURTH authority on "did this edit change the analysis" —
// alongside this file, `computeGraphHash`, and `applyPatch`'s raw path — and
// the first version of that consumer did exactly that, via `diffSnapshots`,
// which stringifies the WHOLE `data` object and therefore answered YES to a
// label rename. It shipped a blanket `clearGuidanceItems()` on cosmetic edits.
// Convergence rule: name the canonical owner and remove the competitor. This
// file is the owner, so the lift belongs here and derives from the same
// registry-backed `ANALYTICAL_*_FIELDS` as everything above.
//
// ⚠ ONE DELIBERATE DIFFERENCE FROM `hasAnalyticalNodeChange`, AND IT IS NOT A
// NEW RULE. That function takes an UPDATE PARTIAL, so it can only ask
// `field in newData` — a field DELETED from `data` is invisible to it, and it
// cannot be otherwise, because an absent key in a partial means "not being
// updated". Here both sides are complete objects, so absence is meaningful and
// the comparison is symmetric. Same field list, same `deepEqual`, same source of
// truth; only the direction of the question differs.
// ---------------------------------------------------------------------------

export interface AnalyticalGraphState {
  readonly nodes: readonly Node[]
  readonly edges: readonly Edge[]
}

function analyticalDataChanged(
  fields: readonly string[],
  prevData: unknown,
  currData: unknown,
): boolean {
  const prev = (prevData ?? {}) as Record<string, unknown>
  const curr = (currData ?? {}) as Record<string, unknown>
  for (const field of fields) {
    if (!deepEqual(prev[field], curr[field])) return true
  }
  return false
}

/**
 * True when the graph moved in a way that invalidates an analysis authored
 * against `prev` — i.e. an element was added or removed, or a surviving
 * element's ANALYTICAL fields changed by value.
 *
 * FALSE for the cosmetic and transient classes this module has always excluded:
 * position, `label`, `description`, `category`, `extractionType`, colour, and
 * every `ephemeral` registry field (`_baseline_snapshot`, the derived
 * goal-threshold caches). Those are a user tidying their model, not changing it,
 * and a consumer that treats them as a change destroys work.
 */
export function hasAnalyticalGraphChange(
  prev: AnalyticalGraphState,
  curr: AnalyticalGraphState,
): boolean {
  if (prev.nodes.length !== curr.nodes.length) return true
  if (prev.edges.length !== curr.edges.length) return true

  const prevNodes = new Map(prev.nodes.map((n) => [n.id, n]))
  for (const node of curr.nodes) {
    const before = prevNodes.get(node.id)
    if (!before) return true // an id that was not there is an add
    // Node-level kind reclassification, the same signal the per-update
    // function checks first.
    if (before.type !== node.type) return true
    if (analyticalDataChanged(ANALYTICAL_NODE_DATA_FIELDS, before.data, node.data)) return true
  }

  const prevEdges = new Map(prev.edges.map((e) => [e.id, e]))
  for (const edge of curr.edges) {
    const before = prevEdges.get(edge.id)
    if (!before) return true
    if (before.source !== edge.source || before.target !== edge.target) return true
    if (analyticalDataChanged(ANALYTICAL_EDGE_FIELDS, before.data, edge.data)) return true
  }

  return false
}
