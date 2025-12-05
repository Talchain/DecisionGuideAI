/**
 * Ghost Edge Suggestions
 *
 * Pattern-based AI suggestions for logical graph connections.
 * Suggests edges based on node type semantics:
 * - Options/decisions → outcomes
 * - Factors → options/decisions
 * - Risks → outcomes (negative weight)
 * - Outcomes → outcomes (chaining)
 */

import { Node, Edge } from '@xyflow/react'

export interface GhostSuggestion {
  from: string
  to: string
  suggestedWeight: number
  confidence: number
  reasoning: string
}

interface SuggestionPattern {
  fromTypes: string[]
  toTypes: string[]
  weight: number
  confidence: number
  reasoning: string
}

const SUGGESTION_PATTERNS: SuggestionPattern[] = [
  // Pattern 1: Options/decisions → outcomes (high confidence)
  {
    fromTypes: ['option', 'decision'],
    toTypes: ['outcome'],
    weight: 0.5,
    confidence: 0.8,
    reasoning: 'Decisions typically influence outcomes',
  },
  // Pattern 2: Factors → options/decisions (medium confidence)
  {
    fromTypes: ['factor'],
    toTypes: ['option', 'decision'],
    weight: 0.3,
    confidence: 0.6,
    reasoning: 'Factors often influence decisions',
  },
  // Pattern 3: Risks → outcomes (negative weight)
  {
    fromTypes: ['risk'],
    toTypes: ['outcome'],
    weight: -0.3,
    confidence: 0.7,
    reasoning: 'Risks typically reduce outcomes',
  },
  // Pattern 4: Outcomes → outcomes (chaining)
  {
    fromTypes: ['outcome'],
    toTypes: ['outcome'],
    weight: 0.4,
    confidence: 0.5,
    reasoning: 'Outcomes can cascade to other outcomes',
  },
]

/**
 * Get node type from node data or type field
 */
function getNodeType(node: Node): string {
  return node.data?.type || node.type || 'unknown'
}

/**
 * Generate ghost edge suggestions based on node type patterns
 * @param hoveredNodeId - ID of node being hovered
 * @param nodes - All nodes in graph
 * @param edges - All edges in graph
 * @returns Top 3 suggestions sorted by confidence
 */
export function generateGhostSuggestions(
  hoveredNodeId: string,
  nodes: Node[],
  edges: Edge[]
): GhostSuggestion[] {
  const suggestions: GhostSuggestion[] = []
  const hoveredNode = nodes.find((n) => n.id === hoveredNodeId)

  if (!hoveredNode) return []

  const hoveredType = getNodeType(hoveredNode)

  // Create set of existing edges for fast lookup
  const existingEdgeIds = new Set(edges.map((e) => `${e.source}-${e.target}`))

  // Apply each pattern
  for (const pattern of SUGGESTION_PATTERNS) {
    // Check if hovered node matches pattern's from types
    if (!pattern.fromTypes.includes(hoveredType)) continue

    // Find candidate target nodes
    const candidates = nodes.filter((n) => {
      if (n.id === hoveredNodeId) return false // Don't suggest self-loops

      const targetType = getNodeType(n)
      if (!pattern.toTypes.includes(targetType)) return false

      // Don't suggest existing connections
      if (existingEdgeIds.has(`${hoveredNodeId}-${n.id}`)) return false

      return true
    })

    // Add suggestions for each candidate
    candidates.forEach((candidate) => {
      suggestions.push({
        from: hoveredNodeId,
        to: candidate.id,
        suggestedWeight: pattern.weight,
        confidence: pattern.confidence,
        reasoning: pattern.reasoning,
      })
    })
  }

  // Sort by confidence descending, return top 3
  return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 3)
}

/**
 * Check if suggestions should be shown
 * Only show in building stage, with sufficient nodes
 */
export function shouldShowGhosts(journeyStage: string, nodeCount: number): boolean {
  return journeyStage === 'building' && nodeCount >= 2
}
