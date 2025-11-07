/**
 * Blueprint insertion hook (v1.2 - Sprint 2)
 * Handles inserting template blueprints into the canvas with:
 * - Viewport-centered positioning
 * - Correct node type mapping (goal/option/risk/outcome/decision)
 * - Template metadata stamping
 * - Probability labels on edges
 * - Centralized limit enforcement (prevents exceeding node/edge caps)
 */

import { useCallback, useState, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { Blueprint } from '../../templates/blueprints/types'
import { useCanvasStore } from '../store'
import { DEFAULT_EDGE_DATA } from '../domain/edges'
import { checkLimits, formatLimitError } from '../utils/limitGuard'
import { plot } from '../../adapters/plot'
import type { LimitsV1 } from '../../adapters/plot/types'

export function useBlueprintInsert() {
  const { getViewport } = useReactFlow()
  const createNodeId = useCanvasStore(s => s.createNodeId)
  const createEdgeId = useCanvasStore(s => s.createEdgeId)
  const [limits, setLimits] = useState<LimitsV1 | null>(null)

  // Fetch engine limits on mount (Sprint 2: centralized enforcement)
  useEffect(() => {
    const fetchLimits = async () => {
      try {
        const adapter = plot as any
        if (adapter.limits && typeof adapter.limits === 'function') {
          const result = await adapter.limits()
          setLimits(result)
        }
      } catch (err) {
        console.warn('[useBlueprintInsert] Failed to fetch limits:', err)
      }
    }
    fetchLimits()
  }, [])

  const insertBlueprint = useCallback((blueprint: Blueprint): { nodeIdMap: Map<string, string>; newNodes: any[]; newEdges: any[]; error?: string } => {
    // Sprint 2: Check limits BEFORE inserting
    const store = useCanvasStore.getState()
    const currentNodes = store.nodes.length
    const currentEdges = store.edges.length
    const nodesToAdd = blueprint.nodes.length
    const edgesToAdd = blueprint.edges.length

    const limitCheck = checkLimits(currentNodes, currentEdges, nodesToAdd, edgesToAdd, limits)
    if (!limitCheck.allowed) {
      const error = formatLimitError(limitCheck)
      console.warn('[useBlueprintInsert] Limit check failed:', error)
      return { nodeIdMap: new Map(), newNodes: [], newEdges: [], error }
    }
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
          body: node.body,           // v1.2: rich description
          prior: node.prior,         // v1.2: prior probability (0-1)
          utility: node.utility,     // v1.2: utility value (-1 to +1)
          templateId: blueprint.id,
          templateName: blueprint.name,
          templateCreatedAt
        }
      }
    })
    
    // Create edges with probability labels
    const newEdges = blueprint.edges.map((edge, index) => {
      const pct = edge.probability != null ? Math.round(edge.probability * 100) : undefined
      const label = pct != null ? `${pct}%` : undefined
      const edgeId = createEdgeId()

      const newEdge = {
        id: edgeId,
        type: 'styled',
        source: nodeIdMap.get(edge.from)!,
        target: nodeIdMap.get(edge.to)!,
        label,
        data: {
          ...DEFAULT_EDGE_DATA,
          weight: edge.weight ?? DEFAULT_EDGE_DATA.weight,
          label,
          confidence: edge.probability,
          belief: edge.belief ?? edge.probability,  // v1.2: prefer belief, fallback to probability for legacy
          provenance: edge.provenance,              // v1.2: source tracking
          templateId: blueprint.id
        }
      }

      // Diagnostic: log first edge to verify v1.2 field plumbing (dev only)
      if (index === 0 && import.meta.env.DEV) {
        console.log('[EdgeInsert]', {
          id: newEdge.id,
          weight: newEdge.data.weight,
          belief: newEdge.data.belief,
          provenance: newEdge.data.provenance,
          confidence: newEdge.data.confidence
        })
      }

      return newEdge
    })
    
    // Batch update store
    store.pushHistory()
    useCanvasStore.setState(state => ({
      nodes: [...state.nodes, ...newNodes],
      edges: [...state.edges, ...newEdges]
    }))

    return { nodeIdMap, newNodes, newEdges }
  }, [getViewport, createNodeId, createEdgeId, limits])

  return { insertBlueprint }
}
