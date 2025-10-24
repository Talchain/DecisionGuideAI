/**
 * Blueprint insertion hook
 * Handles inserting template blueprints into the canvas with:
 * - Viewport-centered positioning
 * - Correct node type mapping (goal/option/risk/outcome/decision)
 * - Template metadata stamping
 * - Probability labels on edges
 */

import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Blueprint } from '../../templates/blueprints/types'
import { useCanvasStore } from '../store'
import { DEFAULT_EDGE_DATA } from '../domain/edges'

export function useBlueprintInsert() {
  const { getViewport } = useReactFlow()
  const createNodeId = useCanvasStore(s => s.createNodeId)
  const createEdgeId = useCanvasStore(s => s.createEdgeId)
  
  const insertBlueprint = useCallback((blueprint: Blueprint) => {
    const viewport = getViewport()
    const centerX = -viewport.x + (window.innerWidth / 2) / viewport.zoom
    const centerY = -viewport.y + (window.innerHeight / 2) / viewport.zoom
    
    // Create ID mapping for nodes
    const nodeIdMap = new Map<string, string>()
    blueprint.nodes.forEach(node => {
      nodeIdMap.set(node.id, createNodeId())
    })
    
    // Calculate bounds of blueprint
    const positions = blueprint.nodes.map(n => n.position || { x: 0, y: 0 })
    const minX = Math.min(...positions.map(p => p.x))
    const maxX = Math.max(...positions.map(p => p.x))
    const minY = Math.min(...positions.map(p => p.y))
    const maxY = Math.max(...positions.map(p => p.y))
    const blueprintCenterX = (minX + maxX) / 2
    const blueprintCenterY = (minY + maxY) / 2
    
    // Template metadata
    const templateCreatedAt = new Date().toISOString()
    
    // Create nodes with correct types and template metadata
    const newNodes = blueprint.nodes.map(node => {
      const pos = node.position || { x: 0, y: 0 }
      return {
        id: nodeIdMap.get(node.id)!,
        type: node.kind, // Use actual node kind: goal, option, risk, outcome, decision
        position: {
          x: centerX + (pos.x - blueprintCenterX),
          y: centerY + (pos.y - blueprintCenterY)
        },
        data: {
          label: node.label,
          kind: node.kind,
          templateId: blueprint.id,
          templateName: blueprint.name,
          templateCreatedAt
        }
      }
    })
    
    // Create edges with probability labels
    const newEdges = blueprint.edges.map(edge => {
      const pct = edge.probability != null ? Math.round(edge.probability * 100) : undefined
      const label = pct != null ? `${pct}%` : undefined
      const edgeId = createEdgeId()
      
      return {
        id: edgeId,
        source: nodeIdMap.get(edge.from)!,
        target: nodeIdMap.get(edge.to)!,
        label,
        data: {
          ...DEFAULT_EDGE_DATA,
          weight: edge.weight ?? DEFAULT_EDGE_DATA.weight,
          label,
          confidence: edge.probability
        }
      }
    })
    
    // Batch update store
    const store = useCanvasStore.getState()
    store.pushHistory()
    useCanvasStore.setState(state => ({
      nodes: [...state.nodes, ...newNodes],
      edges: [...state.edges, ...newEdges]
    }))
    
    return { nodeIdMap, newNodes, newEdges }
  }, [getViewport, createNodeId, createEdgeId])
  
  return { insertBlueprint }
}
