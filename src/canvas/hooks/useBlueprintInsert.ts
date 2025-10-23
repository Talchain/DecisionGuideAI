import { useCallback } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Blueprint } from '../../templates/blueprints/types'
import { useCanvasStore } from '../store'

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
    
    // Create nodes with adjusted positions
    const newNodes = blueprint.nodes.map(node => {
      const pos = node.position || { x: 0, y: 0 }
      return {
        id: nodeIdMap.get(node.id)!,
        type: node.kind === 'decision' ? 'decision' : 'decision', // Map to available node types
        position: {
          x: centerX + (pos.x - blueprintCenterX),
          y: centerY + (pos.y - blueprintCenterY)
        },
        data: {
          label: node.label,
          kind: node.kind
        }
      }
    })
    
    // Create edges with mapped IDs
    const newEdges = blueprint.edges.map(edge => ({
      id: createEdgeId(),
      source: nodeIdMap.get(edge.from)!,
      target: nodeIdMap.get(edge.to)!,
      data: {
        probability: edge.probability,
        weight: edge.weight,
        style: 'default' as const
      }
    }))
    
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
