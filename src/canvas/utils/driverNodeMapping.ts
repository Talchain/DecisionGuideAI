/**
 * Driver to Node ID Mapping
 *
 * Maps drivers from analysis results to their corresponding canvas node IDs.
 * Uses multiple matching strategies with graceful fallbacks:
 * 1. Exact node_id match (if provided by API)
 * 2. Node ID prefix extraction (e.g., "risk_market_saturation" → "risk")
 * 3. Exact label match (case-insensitive, trimmed)
 * 4. Partial label match (contains)
 * 5. Word overlap match (at least 2 words in common)
 */

import type { Node, Edge } from '@xyflow/react'

export interface DriverFromAPI {
  label: string
  polarity?: 'up' | 'down' | 'neutral'
  strength?: 'low' | 'medium' | 'high'
  contribution?: number
  nodeId?: string
  edgeId?: string
  nodeKind?: string | null
}

export interface MappedDriver extends DriverFromAPI {
  /** Resolved node ID (null if no match found) */
  resolvedNodeId: string | null
  /** How the nodeId was resolved */
  matchType: 'api' | 'prefix' | 'exact_label' | 'partial_label' | 'word_overlap' | 'none'
}

/**
 * Normalise label for comparison
 */
function normaliseLabel(label: string): string {
  return label.toLowerCase().trim().replace(/['"]/g, '')
}

/**
 * Extract node type from API node_id prefix
 * e.g., "risk_market_saturation" → finds node with type "risk"
 */
function extractTypeFromPrefix(nodeId: string): string | null {
  const prefixMatch = nodeId.match(/^(goal|decision|option|factor|risk|outcome|action)_/i)
  return prefixMatch ? prefixMatch[1].toLowerCase() : null
}

/**
 * Find node by ID prefix type (looks for a node of that type with a similar label)
 */
function findNodeByPrefixType(
  nodeId: string,
  label: string,
  nodes: Node[]
): string | null {
  const expectedType = extractTypeFromPrefix(nodeId)
  if (!expectedType) return null

  const normalisedLabel = normaliseLabel(label)

  // Find nodes of the expected type
  const nodesOfType = nodes.filter(n =>
    n.type?.toLowerCase() === expectedType ||
    (n.data as any)?.kind?.toLowerCase() === expectedType
  )

  // Try exact label match first among nodes of this type
  const exactMatch = nodesOfType.find(n => {
    const canvasLabel = normaliseLabel((n.data as any)?.label || '')
    return canvasLabel === normalisedLabel
  })
  if (exactMatch) return exactMatch.id

  // Try partial match
  const partialMatch = nodesOfType.find(n => {
    const canvasLabel = normaliseLabel((n.data as any)?.label || '')
    return canvasLabel.includes(normalisedLabel) || normalisedLabel.includes(canvasLabel)
  })
  if (partialMatch) return partialMatch.id

  return null
}

/**
 * Find node by exact label match
 */
function findNodeByExactLabel(label: string, nodes: Node[]): string | null {
  const normalised = normaliseLabel(label)
  const match = nodes.find(n => {
    const canvasLabel = normaliseLabel((n.data as any)?.label || '')
    return canvasLabel === normalised
  })
  return match?.id || null
}

/**
 * Find node by partial label match
 */
function findNodeByPartialLabel(label: string, nodes: Node[]): string | null {
  const normalised = normaliseLabel(label)
  const match = nodes.find(n => {
    const canvasLabel = normaliseLabel((n.data as any)?.label || '')
    if (!canvasLabel) return false
    return canvasLabel.includes(normalised) || normalised.includes(canvasLabel)
  })
  return match?.id || null
}

/**
 * Find node by word overlap (at least 2 words in common)
 */
function findNodeByWordOverlap(label: string, nodes: Node[]): string | null {
  const driverWords = new Set(
    label.toLowerCase().split(/\s+/).filter(w => w.length > 2)
  )

  let bestMatch: { nodeId: string; overlap: number } | null = null

  for (const node of nodes) {
    const canvasLabel = ((node.data as any)?.label || '').toLowerCase()
    const canvasWords = new Set(canvasLabel.split(/\s+/).filter(w => w.length > 2))

    let overlap = 0
    for (const word of driverWords) {
      if (canvasWords.has(word)) overlap++
    }

    if (overlap >= 2 && (!bestMatch || overlap > bestMatch.overlap)) {
      bestMatch = { nodeId: node.id, overlap }
    }
  }

  return bestMatch?.nodeId || null
}

/**
 * Map a single driver to its node ID using multiple strategies
 */
export function mapDriverToNodeId(
  driver: DriverFromAPI,
  nodes: Node[]
): MappedDriver {
  // 1. Direct node_id from API
  if (driver.nodeId) {
    const node = nodes.find(n => n.id === driver.nodeId)
    if (node) {
      return { ...driver, resolvedNodeId: driver.nodeId, matchType: 'api' }
    }

    // Try prefix-based matching if direct ID didn't work
    const prefixMatch = findNodeByPrefixType(driver.nodeId, driver.label, nodes)
    if (prefixMatch) {
      return { ...driver, resolvedNodeId: prefixMatch, matchType: 'prefix' }
    }
  }

  // 2. Exact label match
  const exactMatch = findNodeByExactLabel(driver.label, nodes)
  if (exactMatch) {
    return { ...driver, resolvedNodeId: exactMatch, matchType: 'exact_label' }
  }

  // 3. Partial label match
  const partialMatch = findNodeByPartialLabel(driver.label, nodes)
  if (partialMatch) {
    return { ...driver, resolvedNodeId: partialMatch, matchType: 'partial_label' }
  }

  // 4. Word overlap match
  const wordMatch = findNodeByWordOverlap(driver.label, nodes)
  if (wordMatch) {
    return { ...driver, resolvedNodeId: wordMatch, matchType: 'word_overlap' }
  }

  // No match found
  return { ...driver, resolvedNodeId: null, matchType: 'none' }
}

/**
 * Map all drivers to node IDs
 */
export function mapDriversToNodes(
  drivers: DriverFromAPI[],
  nodes: Node[]
): MappedDriver[] {
  return drivers.map(driver => mapDriverToNodeId(driver, nodes))
}

/**
 * Get match quality score (higher = better match)
 */
export function getMatchQuality(matchType: MappedDriver['matchType']): number {
  switch (matchType) {
    case 'api': return 100
    case 'prefix': return 90
    case 'exact_label': return 80
    case 'partial_label': return 60
    case 'word_overlap': return 40
    case 'none': return 0
  }
}
