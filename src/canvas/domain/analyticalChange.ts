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
