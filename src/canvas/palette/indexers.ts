/**
 * Command Palette Indexers
 *
 * Pure functions for indexing canvas entities and searching them.
 * Implements lightweight fuzzy matching with stable sorting:
 * - Exact matches first
 * - Prefix matches second
 * - Fuzzy matches last
 *
 * Performance target: ≤75ms P95 on 1k items
 */

import { sanitizeLabel } from '../utils/sanitize'

export type PaletteItemKind =
  | 'node'
  | 'edge'
  | 'driver'
  | 'template'
  | 'run'
  | 'action'

export interface PaletteItem {
  id: string
  kind: PaletteItemKind
  label: string
  description?: string
  keywords?: string[]
  metadata?: Record<string, unknown>
}

export interface SearchResult extends PaletteItem {
  score: number
  matchType: 'exact' | 'prefix' | 'fuzzy'
}

/**
 * Index nodes from canvas state
 */
export function indexNodes(nodes: Array<{ id: string; data: { label?: string } }>): PaletteItem[] {
  return nodes.map(node => ({
    id: `node:${node.id}`,
    kind: 'node' as const,
    label: sanitizeLabel(node.data.label || node.id),
    description: `Node • ${node.id}`,
    keywords: ['focus', 'select', 'node'],
    metadata: { nodeId: node.id },
  }))
}

/**
 * Index edges from canvas state
 */
export function indexEdges(
  edges: Array<{ id: string; source: string; target: string; data?: { label?: string } }>
): PaletteItem[] {
  return edges.map(edge => ({
    id: `edge:${edge.id}`,
    kind: 'edge' as const,
    label: sanitizeLabel(edge.data?.label || `${edge.source} → ${edge.target}`),
    description: `Edge • ${edge.source} → ${edge.target}`,
    keywords: ['focus', 'edge', 'connection'],
    metadata: { edgeId: edge.id, source: edge.source, target: edge.target },
  }))
}

/**
 * Index drivers from last run result
 */
export function indexDrivers(
  drivers: Array<{ label: string; polarity: string; strength: string; node_id?: string; edge_id?: string }>
): PaletteItem[] {
  return drivers.map((driver, idx) => ({
    id: `driver:${idx}`,
    kind: 'driver' as const,
    label: sanitizeLabel(driver.label),
    description: `Driver • ${driver.polarity} ${driver.strength}`,
    keywords: ['driver', 'impact', driver.polarity, driver.strength],
    metadata: { nodeId: driver.node_id, edgeId: driver.edge_id },
  }))
}

/**
 * Index templates
 */
export function indexTemplates(
  templates: Array<{ id: string; title: string; tags?: string[] }>
): PaletteItem[] {
  return templates.map(template => ({
    id: `template:${template.id}`,
    kind: 'template' as const,
    label: sanitizeLabel(template.title),
    description: `Template${template.tags?.length ? ` • ${template.tags.join(', ')}` : ''}`,
    keywords: ['template', 'load', ...(template.tags || [])],
    metadata: { templateId: template.id },
  }))
}

/**
 * Index recent runs from history
 */
export function indexRuns(
  runs: Array<{ id: string; seed?: number; hash?: string; timestamp: number }>
): PaletteItem[] {
  return runs.map(run => ({
    id: `run:${run.id}`,
    kind: 'run' as const,
    label: `Run ${run.seed ? `seed=${run.seed}` : run.id.slice(0, 8)}`,
    description: `Run • ${run.hash?.slice(0, 12) || 'No hash'} • ${new Date(run.timestamp).toLocaleString()}`,
    keywords: ['run', 'history', 'result'],
    metadata: { runId: run.id, seed: run.seed, hash: run.hash },
  }))
}

/**
 * Index available actions
 */
export function indexActions(): PaletteItem[] {
  return [
    {
      id: 'action:run',
      kind: 'action',
      label: 'Run Analysis',
      description: 'Start a new PLoT run',
      keywords: ['run', 'analyze', 'execute'],
    },
    {
      id: 'action:cancel',
      kind: 'action',
      label: 'Cancel Run',
      description: 'Stop the current analysis',
      keywords: ['cancel', 'stop', 'abort'],
    },
    {
      id: 'action:compare',
      kind: 'action',
      label: 'Open Compare',
      description: 'Compare two runs',
      keywords: ['compare', 'diff', 'delta'],
    },
    {
      id: 'action:inspector',
      kind: 'action',
      label: 'Open Inspector',
      description: 'Show edge/node inspector',
      keywords: ['inspector', 'details', 'properties'],
    },
    {
      id: 'action:results',
      kind: 'action',
      label: 'Open Results',
      description: 'Show analysis results',
      keywords: ['results', 'report', 'output'],
    },
    {
      id: 'action:copy-seed',
      kind: 'action',
      label: 'Copy Seed & Hash',
      description: 'Copy seed and response hash to clipboard',
      keywords: ['copy', 'seed', 'hash', 'clipboard'],
    },
  ]
}

/**
 * Calculate match score for a query against a label
 * Returns { score: 0-100, matchType: 'exact' | 'prefix' | 'fuzzy' | null }
 */
function calculateMatchScore(
  query: string,
  label: string,
  keywords: string[] = []
): { score: number; matchType: 'exact' | 'prefix' | 'fuzzy' | null } {
  const lowerQuery = query.toLowerCase()
  const lowerLabel = label.toLowerCase()

  // Exact match (case-insensitive)
  if (lowerLabel === lowerQuery) {
    return { score: 100, matchType: 'exact' }
  }

  // Prefix match
  if (lowerLabel.startsWith(lowerQuery)) {
    return { score: 90, matchType: 'prefix' }
  }

  // Word boundary prefix (e.g., "node" matches "Risk Node")
  const words = lowerLabel.split(/\s+/)
  if (words.some(word => word.startsWith(lowerQuery))) {
    return { score: 85, matchType: 'prefix' }
  }

  // Keyword match
  const lowerKeywords = keywords.map(k => k.toLowerCase())
  if (lowerKeywords.some(kw => kw === lowerQuery || kw.startsWith(lowerQuery))) {
    return { score: 80, matchType: 'prefix' }
  }

  // Fuzzy match (all characters present in order)
  let labelIdx = 0
  let queryIdx = 0
  const matches: number[] = []

  while (labelIdx < lowerLabel.length && queryIdx < lowerQuery.length) {
    if (lowerLabel[labelIdx] === lowerQuery[queryIdx]) {
      matches.push(labelIdx)
      queryIdx++
    }
    labelIdx++
  }

  if (queryIdx === lowerQuery.length) {
    // All query chars found - score based on compactness
    const span = matches[matches.length - 1] - matches[0] + 1
    const compactness = lowerQuery.length / span
    const score = Math.max(50, Math.min(75, 50 + compactness * 25))
    return { score, matchType: 'fuzzy' }
  }

  return { score: 0, matchType: null }
}

/**
 * Search items with fuzzy matching and stable sorting
 * @param query - Search query
 * @param items - Items to search
 * @param limit - Maximum results (default 20)
 */
export function searchItems(query: string, items: PaletteItem[], limit = 20): SearchResult[] {
  if (!query.trim()) {
    // No query - return all items grouped by kind, limited
    return items.slice(0, limit).map(item => ({
      ...item,
      score: 0,
      matchType: 'exact' as const,
    }))
  }

  const results: SearchResult[] = []

  for (const item of items) {
    const { score, matchType } = calculateMatchScore(query, item.label, item.keywords)

    if (matchType && score > 0) {
      results.push({ ...item, score, matchType })
    }
  }

  // Stable sort: exact > prefix > fuzzy, then by score descending, then by original index
  results.sort((a, b) => {
    // Primary: match type
    const typeOrder = { exact: 0, prefix: 1, fuzzy: 2 }
    const typeDiff = typeOrder[a.matchType] - typeOrder[b.matchType]
    if (typeDiff !== 0) return typeDiff

    // Secondary: score descending
    const scoreDiff = b.score - a.score
    if (scoreDiff !== 0) return scoreDiff

    // Tertiary: alphabetical by label
    return a.label.localeCompare(b.label)
  })

  return results.slice(0, limit)
}

/**
 * Group results by kind for sectioned display
 */
export function groupResultsByKind(results: SearchResult[]): Record<PaletteItemKind, SearchResult[]> {
  const groups: Record<string, SearchResult[]> = {
    action: [],
    node: [],
    edge: [],
    driver: [],
    template: [],
    run: [],
  }

  for (const result of results) {
    groups[result.kind].push(result)
  }

  return groups as Record<PaletteItemKind, SearchResult[]>
}
