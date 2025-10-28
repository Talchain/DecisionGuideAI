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
 * Lowercase, collapse whitespace, remove punctuation
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
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
      // Fuzzy: contains
      else if (normalizedNode.includes(normalizedDriver) || normalizedDriver.includes(normalizedNode)) {
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
      // Fuzzy: contains
      else if (normalizedEdge.includes(normalizedDriver) || normalizedDriver.includes(normalizedEdge)) {
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
 */
export function findDriverMatches(
  driver: Driver,
  nodes: Node[],
  edges: Edge[]
): DriverMatch[] {
  if (driver.kind === 'node') {
    return findNodeMatches(driver, nodes)
  } else {
    return findEdgeMatches(driver, edges)
  }
}
