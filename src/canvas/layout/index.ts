/**
 * Layout engine selector and coordinator
 */

import { applyGridLayout } from './engines/grid'
import { applyHierarchyLayout } from './engines/hierarchy'
import { applyFlowLayout } from './engines/flow'
import { applySemanticLayout } from './engines/semantic'
import type { LayoutNode, LayoutEdge, LayoutOptions, LayoutResult } from './types'
import type { LayoutPolicy } from './policy'

/**
 * Apply layout based on selected preset
 */
export function applyLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions
): LayoutResult {
  const preserveIds = options.preserveSelection 
    ? new Set(nodes.filter(n => n.locked).map(n => n.id))
    : new Set<string>()
  
  switch (options.preset) {
    case 'grid':
      return applyGridLayout(nodes, options.spacing, preserveIds)
    
    case 'hierarchy':
      return applyHierarchyLayout(nodes, edges, options.spacing, preserveIds)
    
    case 'flow':
      return applyFlowLayout(nodes, edges, options.spacing, preserveIds)
    
    default:
      return { positions: {}, duration: 0 }
  }
}

/**
 * Apply semantic layout with full policy support
 */
export function applyLayoutWithPolicy(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  options: LayoutOptions,
  policy: LayoutPolicy
): LayoutResult {
  const preserveIds = options.preserveSelection 
    ? new Set(nodes.filter(n => n.locked).map(n => n.id))
    : new Set<string>()
  
  return applySemanticLayout(nodes, edges, options.spacing, policy, preserveIds)
}

export * from './types'
export { applyGridLayout, applyHierarchyLayout, applyFlowLayout, applySemanticLayout }
