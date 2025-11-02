/**
 * Template Normalizer
 *
 * Normalizes different template API response formats into a consistent structure.
 *
 * Handles variations:
 * - Flat format: { nodes, edges } (current API behavior)
 * - Nested format: { graph: { nodes, edges }, version, default_seed, meta } (expected format)
 * - Missing fields: version, default_seed, meta (provide sensible defaults)
 */

import type { ApiGraph } from '../../types/plot'

/**
 * Raw template graph response from /v1/templates/{id}/graph
 * Can be either flat or nested format
 */
export type RawTemplateGraphResponse =
  | {
      // Flat format (current API)
      nodes: unknown[]
      edges: unknown[]
      version?: string
      default_seed?: number
      meta?: {
        suggested_positions?: Record<string, { x: number; y: number }>
        [key: string]: unknown
      }
    }
  | {
      // Nested format (expected API)
      graph: {
        nodes: unknown[]
        edges: unknown[]
      }
      version?: string
      default_seed?: number
      meta?: {
        suggested_positions?: Record<string, { x: number; y: number }>
        [key: string]: unknown
      }
    }

/**
 * Normalized template graph structure
 */
export interface NormalizedTemplateGraph {
  nodes: unknown[]
  edges: unknown[]
  version: string
  default_seed: number | undefined
  meta: {
    suggested_positions?: Record<string, { x: number; y: number }>
    [key: string]: unknown
  }
}

/**
 * Type guard: check if response has nested graph structure
 */
function hasNestedGraph(
  response: RawTemplateGraphResponse
): response is { graph: { nodes: unknown[]; edges: unknown[] }; version?: string; default_seed?: number; meta?: Record<string, unknown> } {
  return 'graph' in response && response.graph !== null && typeof response.graph === 'object'
}

/**
 * Normalize template graph response to consistent structure
 *
 * Handles both flat and nested formats, provides sensible defaults for missing fields.
 *
 * @param response - Raw API response from /v1/templates/{id}/graph
 * @returns Normalized template graph with guaranteed structure
 * @throws Error if response is invalid (missing nodes/edges arrays)
 */
export function normalizeTemplateGraph(response: unknown): NormalizedTemplateGraph {
  // Validate response is an object
  if (!response || typeof response !== 'object') {
    throw new Error('[templateNormalizer] Invalid response: expected object')
  }

  const raw = response as RawTemplateGraphResponse

  // Extract nodes and edges (handle both formats)
  let nodes: unknown[]
  let edges: unknown[]

  if (hasNestedGraph(raw)) {
    // Nested format: { graph: { nodes, edges } }
    nodes = raw.graph.nodes
    edges = raw.graph.edges
  } else {
    // Flat format: { nodes, edges }
    if (!('nodes' in raw) || !('edges' in raw)) {
      throw new Error('[templateNormalizer] Invalid response: missing nodes or edges')
    }
    nodes = raw.nodes
    edges = raw.edges
  }

  // Validate arrays
  if (!Array.isArray(nodes)) {
    throw new Error('[templateNormalizer] Invalid response: nodes must be an array')
  }
  if (!Array.isArray(edges)) {
    throw new Error('[templateNormalizer] Invalid response: edges must be an array')
  }

  // Extract metadata with defaults
  const version = raw.version || '1.0'
  const default_seed = raw.default_seed // Allow undefined (caller will handle)
  const meta = raw.meta || {}

  return {
    nodes,
    edges,
    version,
    default_seed,
    meta,
  }
}

/**
 * Raw template list item from /v1/templates
 */
export interface RawTemplateListItem {
  id: string
  label?: string
  name?: string // Future API might use 'name' instead of 'label'
  summary?: string
  description?: string // Future API might use 'description' instead of 'summary'
  version?: string
}

/**
 * Normalized template list item
 */
export interface NormalizedTemplateListItem {
  id: string
  name: string
  description: string
  version: string
}

/**
 * Normalize template list item to consistent structure
 *
 * Handles field name variations (label/name, summary/description)
 *
 * @param item - Raw API template list item
 * @returns Normalized template with consistent field names
 */
export function normalizeTemplateListItem(item: RawTemplateListItem): NormalizedTemplateListItem {
  return {
    id: item.id,
    name: item.name || item.label || 'Untitled Template',
    description: item.description || item.summary || '',
    version: item.version || '1.0',
  }
}
