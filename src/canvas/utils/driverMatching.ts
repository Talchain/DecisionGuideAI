/**
 * Driver Matching Utilities
 *
 * ID-first strategy with graceful label fallback for highlighting drivers.
 * Backend provides drivers with IDs when available, but older responses may only have labels.
 */

import type { Node, Edge } from '@xyflow/react'

export interface Driver {
  kind: 'node' | 'edge'
  id?: string
  label?: string
}

export interface DriverMatch {
  kind: 'node' | 'edge'
  targetId: string
  matchType: 'id' | 'label'
  confidence: 'exact' | 'fuzzy'
}

/**
 * Normalize string for fuzzy matching
 * Lowercase, remove punctuation, remove all whitespace
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w]/g, '') // Remove all non-word characters (including spaces)
    .trim()
}

/**
 * Find node matches for a driver
 * Primary: match by ID
 * Fallback: fuzzy match by label
 */
export function findNodeMatches(
  driver: Driver,
  nodes: Node[]
): DriverMatch[] {
  if (driver.kind !== 'node') return []

  // Primary: ID match
  if (driver.id) {
    const node = nodes.find(n => n.id === driver.id)
    if (node) {
      return [{
        kind: 'node',
        targetId: node.id,
        matchType: 'id',
        confidence: 'exact'
      }]
    }
  }

  // Fallback: Label match
  if (driver.label) {
    const normalizedDriver = normalize(driver.label)
    const matches: DriverMatch[] = []

    for (const node of nodes) {
      const nodeLabel = node.data?.label
      if (!nodeLabel || typeof nodeLabel !== 'string') continue

      const normalizedNode = normalize(nodeLabel)

      // Exact normalized match
      if (normalizedNode === normalizedDriver) {
        matches.push({
          kind: 'node',
          targetId: node.id,
          matchType: 'label',
          confidence: 'exact'
        })
      }
      // Fuzzy: contains (but only if normalizedNode contains normalizedDriver)
      // Don't match if normalizedDriver contains normalizedNode (too broad)
      else if (normalizedNode.includes(normalizedDriver)) {
        matches.push({
          kind: 'node',
          targetId: node.id,
          matchType: 'label',
          confidence: 'fuzzy'
        })
      }
    }

    // Sort: exact confidence first
    return matches.sort((a, b) => {
      if (a.confidence === b.confidence) return 0
      return a.confidence === 'exact' ? -1 : 1
    })
  }

  return []
}

/**
 * Find edge matches for a driver
 * Primary: match by ID
 * Fallback: fuzzy match by label
 */
export function findEdgeMatches(
  driver: Driver,
  edges: Edge[]
): DriverMatch[] {
  if (driver.kind !== 'edge') return []

  // Primary: ID match
  if (driver.id) {
    const edge = edges.find(e => e.id === driver.id)
    if (edge) {
      return [{
        kind: 'edge',
        targetId: edge.id,
        matchType: 'id',
        confidence: 'exact'
      }]
    }
  }

  // Fallback: Label match
  if (driver.label) {
    const normalizedDriver = normalize(driver.label)
    const matches: DriverMatch[] = []

    for (const edge of edges) {
      const edgeLabel = edge.label
      if (!edgeLabel || typeof edgeLabel !== 'string') continue

      const normalizedEdge = normalize(edgeLabel)

      // Exact normalized match
      if (normalizedEdge === normalizedDriver) {
        matches.push({
          kind: 'edge',
          targetId: edge.id,
          matchType: 'label',
          confidence: 'exact'
        })
      }
      // Fuzzy: contains (but only if normalizedEdge contains normalizedDriver)
      // Don't match if normalizedDriver contains normalizedEdge (too broad)
      else if (normalizedEdge.includes(normalizedDriver)) {
        matches.push({
          kind: 'edge',
          targetId: edge.id,
          matchType: 'label',
          confidence: 'fuzzy'
        })
      }
    }

    // Sort: exact confidence first
    return matches.sort((a, b) => {
      if (a.confidence === b.confidence) return 0
      return a.confidence === 'exact' ? -1 : 1
    })
  }

  return []
}

/**
 * Find all matches for a driver (nodes or edges)
 * If driver has ID, uses kind to optimize search
 * If driver only has label, searches both nodes and edges for best match
 */
export function findDriverMatches(
  driver: Driver,
  nodes: Node[],
  edges: Edge[]
): DriverMatch[] {
  // If driver has ID, respect the kind field
  if (driver.id) {
    if (driver.kind === 'node') {
      return findNodeMatches(driver, nodes)
    } else {
      return findEdgeMatches(driver, edges)
    }
  }

  // If driver only has label (no ID), search both nodes and edges
  // This handles cases where backend doesn't provide kind information
  if (driver.label) {
    const nodeMatches = findNodeMatches({ ...driver, kind: 'node' }, nodes)
    const edgeMatches = findEdgeMatches({ ...driver, kind: 'edge' }, edges)

    // Combine and sort by confidence (exact before fuzzy)
    const allMatches = [...nodeMatches, ...edgeMatches]
    return allMatches.sort((a, b) => {
      if (a.confidence === b.confidence) return 0
      return a.confidence === 'exact' ? -1 : 1
    })
  }

  return []
}
