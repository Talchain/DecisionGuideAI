/**
 * Canvas schema migrations
 * Handles data model evolution with safe defaults
 * British English: initialise, serialise
 */

import { z } from 'zod'
import { NodeDataSchema, AnyNodeDataSchema } from './nodes'
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
    data: AnyNodeDataSchema,
  })),
  edges: z.array(z.object({
    id: z.string(),
    source: z.string(),
    target: z.string(),
    label: z.string().optional(),
    data: EdgeDataSchema.optional(),
  })),
})

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
    const migratedNodes = snapshot.nodes.map(migrateNodeV1ToV2)
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
  
  // Heuristic: v2 has typed node data
  if (snapshot.nodes?.some((n: any) => n.data?.type !== undefined)) {
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
      return V2SnapshotSchema.parse(rawSnapshot)
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
 */
export function exportSnapshot(nodes: any[], edges: any[]): V2Snapshot {
  return {
    version: 2,
    timestamp: Date.now(),
    nodes,
    edges,
  }
}
