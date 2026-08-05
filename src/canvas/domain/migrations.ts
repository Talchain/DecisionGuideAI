/**
 * Canvas schema migrations
 * Handles data model evolution with safe defaults
 * British English: initialise, serialise
 */

import { z } from 'zod'
import { AnyNodeDataImportSchema, NodeTypeEnum } from './nodes'
import { EdgeDataSchema, DEFAULT_EDGE_DATA } from './edges'
import { captureError } from '../../lib/monitoring'

/**
 * Schema versions
 */
export const SCHEMA_VERSION_V1 = 1
export const SCHEMA_VERSION_V2 = 2
export const CURRENT_SCHEMA_VERSION = SCHEMA_VERSION_V2

/**
 * V1 snapshot schema (legacy)
 * Simple nodes/edges without rich types or edge properties
 */
const V1SnapshotSchema = z.object({
  version: z.literal(1).optional(), // May be missing in very old snapshots
  timestamp: z.number().optional(),
  nodes: z.array(z.any()), // Untyped nodes in v1
  edges: z.array(z.any()), // Untyped edges in v1
})

/**
 * V2 snapshot schema (current)
 * Includes node types and edge visual properties
 */
const V2SnapshotSchema = z.object({
  version: z.literal(2),
  timestamp: z.number(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
    /**
     * 2.590 — the IMPORT variant of the node-data union (permissive on
     * undeclared keys). The strict union stripped every field outside each
     * per-type schema's declared set, silently destroying the goal target /
     * unit / cap and everything BaseNode reads. Shape validation, the
     * discriminant and per-field types are unchanged; see the rationale on
     * AnyNodeDataImportSchema in ./nodes.ts.
     */
    data: AnyNodeDataImportSchema,
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    /**
     * ReactFlow renderer type ('styled' on every real export). Without this
     * field the strict strip-mode parse silently removed it, and imported
     * edges lost the StyledEdge renderer — defaultEdgeOptions only applies to
     * newly-added edges and memoizedEdges does not re-apply it (2.463).
     */
    type: z.string().optional(),
    label: z.string().optional(),
    data: EdgeDataSchema.optional(),
  })),
})

/**
 * 2.463 — import/export node-data normalisation.
 *
 * The V2 snapshot's `data: AnyNodeDataSchema` discriminates on `data.type`,
 * but every node today's product creates (CEE draft path mapDraftNodeToCanvas,
 * patch path buildNode, manual addNode) carries `data.kind` — or, for manual
 * nodes, only a label plus the top-level ReactFlow `node.type`. Without
 * normalisation every real export failed re-import with
 * `invalid_union_discriminator` (walk-582 §T2).
 *
 * Canonical semantic kind := data.kind ?? data.type ?? node.type — first
 * candidate that is a VALID NodeType wins (precedence matches the live-path
 * convention `kind ?? type`, e.g. plot adapter and usePathHighlight). Both
 * `data.type` and `data.kind` are written back so the strict discriminated
 * union parses AND the store receives exactly the kind-bearing shape live
 * creation paths produce.
 *
 * Closure stays: when no candidate is a valid NodeType the node is returned
 * UNTOUCHED and the strict parse rejects it — no invented kinds, no
 * passthrough.
 *
 * Non-mutating: exportSnapshot hands this the LIVE store arrays.
 */
const VALID_NODE_TYPES: ReadonlySet<string> = new Set(NodeTypeEnum.options)

function canonicalNodeKind(node: any): string | null {
  const candidates = [node?.data?.kind, node?.data?.type, node?.type]
  for (const cand of candidates) {
    if (typeof cand === 'string' && VALID_NODE_TYPES.has(cand)) return cand
  }
  return null
}

export function normaliseSnapshotNodes(nodes: any[]): any[] {
  if (!Array.isArray(nodes)) return nodes
  return nodes.map((node) => {
    const canonical = canonicalNodeKind(node)
    if (canonical === null) return node // strict parse will reject — closure preserved
    if (node?.data?.type === canonical && node?.data?.kind === canonical) return node
    return {
      ...node,
      data: { ...(node?.data ?? {}), type: canonical, kind: canonical },
    }
  })
}

export type V1Snapshot = z.infer<typeof V1SnapshotSchema>
export type V2Snapshot = z.infer<typeof V2SnapshotSchema>

/**
 * Migrate v1 node to v2 with safe defaults
 * Infers type from label/context or defaults to 'decision'
 */
function migrateNodeV1ToV2(node: any): any {
  const label = node.data?.label || 'Untitled'
  
  // Infer type from label keywords (best effort)
  let type = 'decision' // default
  const lowerLabel = label.toLowerCase()
  
  if (lowerLabel.includes('goal') || lowerLabel.includes('target')) {
    type = 'goal'
  } else if (lowerLabel.includes('option') || lowerLabel.includes('choice')) {
    type = 'option'
  } else if (lowerLabel.includes('risk') || lowerLabel.includes('threat')) {
    type = 'risk'
  } else if (lowerLabel.includes('outcome') || lowerLabel.includes('result')) {
    type = 'outcome'
  }
  
  return {
    ...node,
    type: type, // Set React Flow node type to match our domain type
    data: {
      label,
      type,
      description: node.data?.description,
    },
  }
}

/**
 * Migrate v1 edge to v2 with default visual properties
 * Adds weight=1, style=solid, curvature=0.15
 * Top-level edge.label takes precedence over edge.data.label
 */
function migrateEdgeV1ToV2(edge: any): any {
  return {
    ...edge,
    data: {
      ...DEFAULT_EDGE_DATA,
      ...(edge.data || {}), // Preserve any existing data
      label: edge.label, // Top-level label wins
    },
  }
}

/**
 * Migrate v1 snapshot to v2
 * Returns migrated snapshot or null on failure
 */
export function migrateV1ToV2(snapshot: V1Snapshot): V2Snapshot | null {
  try {
    // Normalised so v1-migrated nodes also gain `data.kind` — store parity
    // with what live creation paths produce (2.463).
    const migratedNodes = normaliseSnapshotNodes(snapshot.nodes.map(migrateNodeV1ToV2))
    const migratedEdges = snapshot.edges.map(migrateEdgeV1ToV2)

    const v2Snapshot: V2Snapshot = {
      version: 2,
      timestamp: snapshot.timestamp || Date.now(),
      nodes: migratedNodes,
      edges: migratedEdges,
    }
    
    // Validate migrated data
    const validated = V2SnapshotSchema.parse(v2Snapshot)
    
    return validated
  } catch (error) {
    captureError(error as Error, {
      component: 'canvas-migration',
      migration: 'v1-to-v2',
    })
    return null
  }
}

/**
 * Detect snapshot version
 * Returns 1, 2, or null if unrecognised
 */
export function detectVersion(snapshot: any): number | null {
  // Explicit version field
  if (snapshot.version === 2) return 2
  if (snapshot.version === 1) return 1
  
  // Heuristic: v2 has schemaVersion in edge data
  if (snapshot.edges?.some((e: any) => e.data?.schemaVersion === 2)) {
    return 2
  }
  
  // Heuristic: v2 has typed node data (data.kind is the modern spelling —
  // without it a version-less kind-bearing file was routed to the DESTRUCTIVE
  // v1 migration, which rebuilds data as {label, type, description} and drops
  // kind/observedState/interventions; 2.463)
  if (snapshot.nodes?.some((n: any) => n.data?.type !== undefined || n.data?.kind !== undefined)) {
    return 2
  }
  
  // Default to v1 if nodes/edges present
  if (snapshot.nodes && snapshot.edges) {
    return 1
  }
  
  return null
}

/**
 * Import snapshot with automatic migration
 * Returns validated v2 snapshot or null on failure
 */
export function importSnapshot(rawSnapshot: any): V2Snapshot | null {
  const version = detectVersion(rawSnapshot)
  
  if (version === null) {
    captureError(new Error('Unrecognised snapshot format'), {
      component: 'canvas-migration',
    })
    return null
  }
  
  if (version === 2) {
    try {
      // 2.463: normalise the kind/type discriminant before the strict parse.
      // `version` is backfilled only because detectVersion has ALREADY ruled
      // this a v2 file — heuristic-detected v2 files (no explicit version
      // field) previously always failed the z.literal(2) parse.
      const normalised = {
        ...rawSnapshot,
        version: 2,
        nodes: normaliseSnapshotNodes(rawSnapshot.nodes),
      }
      return V2SnapshotSchema.parse(normalised)
    } catch (error) {
      captureError(error as Error, {
        component: 'canvas-migration',
        validation: 'v2-parse-failed',
      })
      return null
    }
  }
  
  // version === 1, migrate
  return migrateV1ToV2(rawSnapshot)
}

/**
 * Export current graph as v2 snapshot
 *
 * 2.463: node data is normalised on the way out too, so exports are
 * self-describing (both `data.type` and `data.kind`) — a file exported after
 * this fix re-imports on OLDER deployed builds whose import still requires
 * `data.type`. Non-mutating: the live store arrays are never modified.
 */
export function exportSnapshot(nodes: any[], edges: any[]): V2Snapshot {
  return {
    version: 2,
    timestamp: Date.now(),
    nodes: normaliseSnapshotNodes(nodes),
    edges,
  }
}
