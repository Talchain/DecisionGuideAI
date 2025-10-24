// Hardened store with timer cleanup, ID reseeding, edge debouncing
import { create } from 'zustand'
import { Node, Edge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react'
import { saveSnapshot as persistSnapshot, importCanvas as persistImport, exportCanvas as persistExport } from './persist'
import { setsEqual } from './store/utils'
import { DEFAULT_EDGE_DATA, type EdgeData } from './domain/edges'
import { NODE_REGISTRY, type NodeType } from './domain/nodes'
import { applyLayout, applyLayoutWithPolicy } from './layout'
import { mergePolicy } from './layout/policy'
import { policyToPreset, policyToSpacing } from './layout/adapters'
import { getInvalidNodes as getInvalidNodesUtil, getNextInvalidNode as getNextInvalidNodeUtil, type InvalidNodeInfo } from './utils/validateOutgoing'

const initialNodes: Node[] = [
  { id: '1', type: 'decision', position: { x: 250, y: 100 }, data: { label: 'Start' } },
  { id: '2', type: 'decision', position: { x: 100, y: 250 }, data: { label: 'Option A' } },
  { id: '3', type: 'decision', position: { x: 400, y: 250 }, data: { label: 'Option B' } },
  { id: '4', type: 'decision', position: { x: 250, y: 400 }, data: { label: 'Outcome' } }
]

const initialEdges: Edge<EdgeData>[] = [
  { id: 'e1', source: '1', target: '2', label: 'Path A', data: DEFAULT_EDGE_DATA },
  { id: 'e2', source: '1', target: '3', label: 'Path B', data: DEFAULT_EDGE_DATA },
  { id: 'e3', source: '2', target: '4', data: DEFAULT_EDGE_DATA },
  { id: 'e4', source: '3', target: '4', data: DEFAULT_EDGE_DATA }
]

interface ClipboardData {
  nodes: Node[]
  edges: Edge<EdgeData>[]
}

type ReconnectEnd = 'source' | 'target'

interface ReconnectState {
  edgeId: string
  end: ReconnectEnd
}

interface CanvasState {
  nodes: Node[]
  edges: Edge<EdgeData>[]
  history: { past: { nodes: Node[]; edges: Edge<EdgeData>[] }[]; future: { nodes: Node[]; edges: Edge<EdgeData>[] }[] }
  selection: { nodeIds: Set<string>; edgeIds: Set<string> }
  clipboard: ClipboardData | null
  reconnecting: ReconnectState | null
  touchedNodeIds: Set<string>  // Nodes with edited probabilities
  nextNodeId: number
  nextEdgeId: number
  _internal: { lastHistoryHash: string }
  addNode: (pos?: { x: number; y: number }, type?: NodeType) => void
  updateNodeLabel: (id: string, label: string) => void
  updateNode: (id: string, updates: Partial<Node>) => void
  updateEdge: (id: string, updates: Partial<Edge<EdgeData>>) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onSelectionChange: (params: { nodes: Node[]; edges: Edge<EdgeData>[] }) => void
  selectNodeWithoutHistory: (nodeId: string) => void
  addEdge: (edge: Omit<Edge<EdgeData>, 'id'>) => void
  pushHistory: (debounced?: boolean) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  deleteSelected: () => void
  duplicateSelected: () => void
  copySelected: () => void
  pasteClipboard: () => void
  cutSelected: () => void
  selectAll: () => void
  nudgeSelected: (dx: number, dy: number) => void
  saveSnapshot: () => boolean
  importCanvas: (json: string) => boolean
  exportCanvas: () => string
  applyLayout: () => Promise<void>
  applySimpleLayout: (preset: 'grid' | 'hierarchy' | 'flow', spacing: 'small' | 'medium' | 'large') => void
  applyGuidedLayout: (policy?: Partial<import('./layout/policy').LayoutPolicy>) => void
  resetCanvas: () => void
  createNodeId: () => string
  createEdgeId: () => string
  reseedIds: (nodes: Node[], edges: Edge[]) => void
  deleteEdge: (id: string) => void
  updateEdgeEndpoints: (id: string, updates: { source?: string; target?: string }) => void
  beginReconnect: (edgeId: string, end: ReconnectEnd) => void
  completeReconnect: (nodeId: string) => void
  cancelReconnect: () => void
  reset: () => void
  cleanup: () => void
}

let historyTimer: ReturnType<typeof setTimeout> | null = null
let nudgeTimer: ReturnType<typeof setTimeout> | null = null
const MAX_HISTORY = 50
export const HISTORY_DEBOUNCE_MS = 200

function clearTimers() {
  if (historyTimer) {
    clearTimeout(historyTimer)
    historyTimer = null
  }
  if (nudgeTimer) {
    clearTimeout(nudgeTimer)
    nudgeTimer = null
  }
}

function historyHash(nodes: Node[], edges: Edge[]): string {
  const n = nodes.map(n => `${n.id}@${n.position.x},${n.position.y}:${n.type ?? ''}:${n.data?.label ?? ''}`).join('|')
  const e = edges.map(e => `${e.id}:${e.source}>${e.target}:${e.label ?? ''}:${(e.data as any)?.schemaVersion ?? ''}`).join('|')
  return `${n}#${e}`
}

function pushToHistory(get: () => CanvasState, set: (fn: (s: CanvasState) => Partial<CanvasState>) => void) {
  const { nodes, edges, history, _internal } = get()

  // Guard: only push if state actually changed (unless history is empty - always push first snapshot)
  const h = historyHash(nodes, edges)
  if (history.past.length > 0 && h === _internal.lastHistoryHash) {
    // Even if no change, clear future (user took new action after undo)
    if (history.future.length > 0) {
      set(() => ({ history: { ...history, future: [] } }))
    }
    return
  }

  // Strip selection flags from history snapshots - selection is ephemeral UI state
  const cleanNodes = nodes.map(n => ({ ...n, selected: undefined }))
  const cleanEdges = edges.map(e => ({ ...e, selected: undefined }))

  const past = [...history.past, { nodes: cleanNodes, edges: cleanEdges }].slice(-MAX_HISTORY)
  set(() => ({
    history: { past, future: [] },
    _internal: { lastHistoryHash: h }
  }))
}

function scheduleHistoryPush(get: () => CanvasState, set: (fn: (s: CanvasState) => Partial<CanvasState>) => void) {
  if (historyTimer) clearTimeout(historyTimer)
  historyTimer = setTimeout(() => pushToHistory(get, set), HISTORY_DEBOUNCE_MS)
}

function getMaxNumericId(ids: string[]): number {
  return ids.reduce((max, id) => {
    const num = parseInt(id.replace(/\D/g, ''), 10)
    return isNaN(num) ? max : Math.max(max, num)
  }, 0)
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  history: { past: [], future: [] },
  selection: { nodeIds: new Set(), edgeIds: new Set() },
  _internal: { lastHistoryHash: '' },
  clipboard: null,
  reconnecting: null,
  touchedNodeIds: new Set(),
  nextNodeId: 5,
  nextEdgeId: 5,

  createNodeId: () => {
    const { nextNodeId } = get()
    set({ nextNodeId: nextNodeId + 1 })
    return String(nextNodeId)
  },

  createEdgeId: () => {
    const { nextEdgeId } = get()
    set({ nextEdgeId: nextEdgeId + 1 })
    return `e${nextEdgeId}`
  },

  reseedIds: (nodes, edges) => {
    const maxNodeId = getMaxNumericId(nodes.map(n => n.id))
    const maxEdgeId = getMaxNumericId(edges.map(e => e.id))
    set({ 
      nextNodeId: Math.max(maxNodeId + 1, 5),
      nextEdgeId: Math.max(maxEdgeId + 1, 5)
    })
  },

  addNode: (pos, type = 'decision') => {
    pushToHistory(get, set)
    const id = get().createNodeId()
    set((s) => ({ nodes: [...s.nodes, { id, type, position: pos || { x: 200, y: 200 }, data: { label: `Node ${id}` } }] }))
  },

  updateNodeLabel: (id, label) => {
    pushToHistory(get, set)
    set((s) => ({ nodes: s.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n) }))
  },

  updateNode: (id, updates) => {
    // Validate node type if being updated
    if (updates.type && !NODE_REGISTRY[updates.type as NodeType]) {
      console.warn(`[Canvas] Invalid node type: ${updates.type}`)
      return
    }
    pushToHistory(get, set)
    set((s) => ({ 
      nodes: s.nodes.map(n => n.id === id ? { ...n, ...updates, data: { ...n.data, ...updates.data } } : n) 
    }))
  },

  updateEdge: (id, updates) => {
    pushToHistory(get, set)
    set((s) => {
      const touchedNodeIds = new Set(s.touchedNodeIds)

      const edges = s.edges.map(e => {
        if (e.id !== id) return e

        // Check if confidence changed
        const oldConfidence = e.data?.confidence
        const newConfidence = updates.data?.confidence

        // If confidence changed, mark source node as touched
        if (newConfidence !== undefined && oldConfidence !== newConfidence) {
          touchedNodeIds.add(e.source)
        }

        // Merge updates, ensuring required EdgeData fields are preserved
        const updatedEdge: Edge<EdgeData> = {
          ...e,
          ...updates,
          data: updates.data ? { ...e.data, ...updates.data } : e.data
        }
        return updatedEdge
      })

      return { edges, touchedNodeIds }
    })
  },

  onNodesChange: (changes) => {
    // Guard no-op changes
    if (!changes || changes.length === 0) return
    
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }))
    
    // Debounce history for drag operations
    const isDrag = changes.some(c => c.type === 'position' && (c as any).dragging)
    if (isDrag) {
      scheduleHistoryPush(get, set)
    } else {
      // Immediate push for non-drag changes (select, remove, add)
      pushToHistory(get, set)
    }
  },

  onEdgesChange: (changes) => {
    // Guard no-op changes
    if (!changes || changes.length === 0) return
    
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) as Edge<EdgeData>[] }))
    
    // Edges don't have position changes, always push immediately
    pushToHistory(get, set)
  },

  onSelectionChange: ({ nodes, edges }) => {
    const newNodeIds = new Set(nodes.map(n => n.id))
    const newEdgeIds = new Set(edges.map(e => e.id))

    const { selection } = get()

    // Handle initial state safely
    const prevNodeIds = selection?.nodeIds ?? new Set<string>()
    const prevEdgeIds = selection?.edgeIds ?? new Set<string>()

    // Compare by value using setsEqual utility
    const nodeIdsChanged = !setsEqual(newNodeIds, prevNodeIds)
    const edgeIdsChanged = !setsEqual(newEdgeIds, prevEdgeIds)

    // Early return if selection didn't actually change (prevents render loop)
    if (!nodeIdsChanged && !edgeIdsChanged) return

    // Only commit when different
    set({
      selection: {
        nodeIds: newNodeIds,
        edgeIds: newEdgeIds,
      },
    })
  },

  // Select a node without pushing to history (for focus/navigation)
  selectNodeWithoutHistory: (nodeId) => {
    set(s => ({
      nodes: s.nodes.map(n => ({
        ...n,
        selected: n.id === nodeId
      })),
      selection: {
        nodeIds: new Set([nodeId]),
        edgeIds: new Set()
      }
    }))
  },

  addEdge: (edge) => {
    pushToHistory(get, set)
    const id = get().createEdgeId()
    set((s) => {
      const touchedNodeIds = new Set(s.touchedNodeIds)

      // If edge has non-zero confidence, mark source node as touched
      if (edge.data?.confidence && edge.data.confidence > 0) {
        touchedNodeIds.add(edge.source)
      }

      return {
        edges: [...s.edges, { id, ...edge }],
        touchedNodeIds
      }
    })
  },

  pushHistory: (debounced = false) => {
    if (debounced) {
      clearTimers()
      historyTimer = setTimeout(() => pushToHistory(get, set), HISTORY_DEBOUNCE_MS)
      return
    }
    pushToHistory(get, set)
  },

  undo: () => {
    const { history, nodes, edges } = get()
    if (history.past.length === 0) return
    const prev = history.past[history.past.length - 1]
    const past = history.past.slice(0, -1)
    const future = [{ nodes, edges }, ...history.future]
    set({ nodes: prev.nodes, edges: prev.edges, history: { past, future } })
    // Reset hash after undo
    const { nodes: newNodes, edges: newEdges } = get()
    set(() => ({ _internal: { lastHistoryHash: historyHash(newNodes, newEdges) } }))
  },

  redo: () => {
    const { history, nodes, edges } = get()
    if (history.future.length === 0) return
    const next = history.future[0]
    const past = [...history.past, { nodes, edges }]
    const future = history.future.slice(1)
    set({ nodes: next.nodes, edges: next.edges, history: { past, future } })
    // Reset hash after redo
    const { nodes: newNodes, edges: newEdges } = get()
    set(() => ({ _internal: { lastHistoryHash: historyHash(newNodes, newEdges) } }))
  },

  canUndo: () => get().history.past.length > 0,
  canRedo: () => get().history.future.length > 0,

  deleteSelected: () => {
    pushToHistory(get, set)
    const { selection } = get()
    set((s) => ({
      nodes: s.nodes.filter(n => !selection.nodeIds.has(n.id)),
      edges: s.edges.filter(e => !selection.nodeIds.has(e.source) && !selection.nodeIds.has(e.target) && !selection.edgeIds.has(e.id)),
      selection: { nodeIds: new Set(), edgeIds: new Set() }
    }))
  },

  duplicateSelected: () => {
    pushToHistory(get, set)
    const { nodes, edges, selection } = get()
    const selectedNodes = nodes.filter(n => selection.nodeIds.has(n.id))
    if (selectedNodes.length === 0) return

    const idMap: Record<string, string> = {}
    const newNodes: Node[] = []
    
    selectedNodes.forEach(node => {
      const newId = get().createNodeId()
      idMap[node.id] = newId
      newNodes.push({
        ...node,
        id: newId,
        position: { x: node.position.x + 50, y: node.position.y + 50 },
        data: { ...node.data }
      })
    })

    const selectedEdges = edges.filter(e => selection.nodeIds.has(e.source) && selection.nodeIds.has(e.target))
    const newEdges: Edge<EdgeData>[] = selectedEdges.map(edge => ({
      ...edge,
      id: get().createEdgeId(),
      source: idMap[edge.source],
      target: idMap[edge.target]
    }))

    set((s) => ({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...newEdges],
      selection: { nodeIds: new Set(newNodes.map(n => n.id)), edgeIds: new Set() }
    }))
  },

  copySelected: () => {
    const { nodes, edges, selection } = get()
    const selectedNodes = nodes.filter(n => selection.nodeIds.has(n.id))
    const selectedEdges = edges.filter(e => selection.nodeIds.has(e.source) && selection.nodeIds.has(e.target))
    set({ clipboard: { nodes: selectedNodes, edges: selectedEdges } })
  },

  pasteClipboard: () => {
    const { clipboard } = get()
    if (!clipboard || clipboard.nodes.length === 0) return

    pushToHistory(get, set)
    const idMap: Record<string, string> = {}
    const newNodes: Node[] = []

    clipboard.nodes.forEach(node => {
      const newId = get().createNodeId()
      idMap[node.id] = newId
      newNodes.push({
        ...node,
        id: newId,
        position: { x: node.position.x + 50, y: node.position.y + 50 },
        data: { ...node.data }
      })
    })

    const newEdges: Edge<EdgeData>[] = clipboard.edges.map(edge => ({
      ...edge,
      id: get().createEdgeId(),
      source: idMap[edge.source],
      target: idMap[edge.target]
    }))

    set((s) => ({
      nodes: [...s.nodes, ...newNodes],
      edges: [...s.edges, ...newEdges],
      selection: { nodeIds: new Set(newNodes.map(n => n.id)), edgeIds: new Set() }
    }))
  },

  cutSelected: () => {
    // Atomic operation: copy + delete in single history frame
    // This prevents double-frame if copySelected ever mutates in future
    const { nodes, edges, selection } = get()
    const selectedNodes = nodes.filter(n => selection.nodeIds.has(n.id))
    const selectedEdges = edges.filter(e => selection.nodeIds.has(e.source) && selection.nodeIds.has(e.target))
    
    // Push history once before mutation
    pushToHistory(get, set)
    
    // Set clipboard and delete in same transaction
    set((s) => ({
      clipboard: { nodes: selectedNodes, edges: selectedEdges },
      nodes: s.nodes.filter(n => !selection.nodeIds.has(n.id)),
      edges: s.edges.filter(e => !selection.nodeIds.has(e.source) && !selection.nodeIds.has(e.target) && !selection.edgeIds.has(e.id)),
      selection: { nodeIds: new Set(), edgeIds: new Set() }
    }))
  },

  selectAll: () => {
    const { nodes, edges, history, _internal } = get()

    // Save current state to history BEFORE selection (if hash matches last save)
    // This ensures undo will work after delete-all
    const currentHash = historyHash(nodes, edges)

    // If hash matches, no structural changes happened since last push
    // But we're about to modify selection, so save current state first
    // This enables: selectAll → delete → undo to work
    if (_internal.lastHistoryHash === currentHash) {
      const cleanNodes = nodes.map(n => ({ ...n, selected: undefined }))
      const cleanEdges = edges.map(e => ({ ...e, selected: undefined }))
      const past = [...history.past, { nodes: cleanNodes, edges: cleanEdges }].slice(-MAX_HISTORY)

      // Mark hash as "dirty" so next operation (like delete) will push
      set({
        history: { past, future: [] },
        _internal: { lastHistoryHash: '' }
      })
    }

    // Set selected: true on all nodes and edges so React Flow shows them as selected
    const updatedNodes = nodes.map(n => ({ ...n, selected: true }))
    const updatedEdges = edges.map(e => ({ ...e, selected: true }))
    set({
      nodes: updatedNodes,
      edges: updatedEdges,
      selection: {
        nodeIds: new Set(nodes.map(n => n.id)),
        edgeIds: new Set(edges.map(e => e.id))
      }
    })
  },

  nudgeSelected: (dx, dy) => {
    const { selection } = get()
    if (selection.nodeIds.size === 0) return

    // On first nudge in burst, push current state to history
    // Subsequent nudges within 500ms window won't push (coalesced into single undo frame)
    if (!nudgeTimer) {
      pushToHistory(get, set)
    }

    // Apply nudge immediately (responsive)
    set((s) => ({
      nodes: s.nodes.map(n => 
        selection.nodeIds.has(n.id)
          ? { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } }
          : n
      )
    }))

    // Reset debounce timer: if 500ms passes without another nudge, burst is complete
    if (nudgeTimer) clearTimeout(nudgeTimer)
    nudgeTimer = setTimeout(() => {
      nudgeTimer = null
    }, 500)
  },

  saveSnapshot: () => {
    const { nodes, edges } = get()
    return persistSnapshot({ nodes, edges })
  },

  importCanvas: (json: string) => {
    const imported = persistImport(json)
    if (!imported) return false

    // Clear history since this is a full import
    clearTimers()
    
    // Reseed IDs to avoid collisions
    get().reseedIds(imported.nodes, imported.edges)
    
    set({
      nodes: imported.nodes,
      edges: imported.edges,
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set() }
    })
    
    return true
  },

  exportCanvas: () => {
    const { nodes, edges } = get()
    return persistExport({ nodes, edges })
  },

  applyLayout: async () => {
    const { nodes, edges } = get()
    
    // Dynamic import to avoid bundling ELK if not used
    const { layoutGraph } = await import('./utils/layout')
    const { useLayoutStore } = await import('./layoutStore')
    const layoutOptions = useLayoutStore.getState()
    
    // Push to history before layout
    pushToHistory(get, set)
    
    try {
      const { nodes: layoutedNodes } = await layoutGraph(nodes, edges, {
        direction: layoutOptions.direction,
        spacing: layoutOptions.nodeSpacing,
        preserveLocked: layoutOptions.respectLocked
      })
      
      set({ nodes: layoutedNodes })
    } catch (err) {
      console.error('[CANVAS] Layout failed:', err)
    }
  },

  applySimpleLayout: (preset, spacing) => {
    const { nodes, edges, selection } = get()
    
    if (nodes.length < 2) {
      return // Nothing to layout
    }
    
    // Convert nodes to layout format
    const layoutNodes = nodes.map(n => ({
      id: n.id,
      width: n.width || 200,
      height: n.height || 80,
      locked: selection.nodeIds.has(n.id) // Preserve selected nodes
    }))
    
    const layoutEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target
    }))
    
    // Apply layout
    const result = applyLayout(layoutNodes, layoutEdges, {
      preset,
      spacing,
      preserveSelection: false,
      minimizeCrossings: true
    })
    
    // Push to history before applying
    pushToHistory(get, set)
    
    // Update node positions
    const updatedNodes = nodes.map(node => {
      const newPos = result.positions[node.id]
      return newPos ? { ...node, position: newPos } : node
    })
    
    set({ nodes: updatedNodes })
  },

  applyGuidedLayout: (policy) => {
    const { nodes, edges } = get()
    
    if (nodes.length < 2) {
      return
    }
    
    const effectivePolicy = mergePolicy(policy)
    
    // Convert to layout format with semantic node types
    const layoutNodes = nodes.map(n => ({
      id: n.id,
      kind: (n.type || 'decision') as 'goal' | 'decision' | 'option' | 'risk' | 'outcome',
      width: n.width || 200,
      height: n.height || 80,
      locked: effectivePolicy.respectLocked && Boolean(n.data?.locked)
    }))
    
    const layoutEdges = edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target
    }))
    
    // Apply semantic layout with full policy support
    const result = applyLayoutWithPolicy(
      layoutNodes,
      layoutEdges,
      {
        preset: policyToPreset(effectivePolicy),
        spacing: policyToSpacing(effectivePolicy),
        preserveSelection: false,
        minimizeCrossings: true
      },
      effectivePolicy
    )
    
    pushToHistory(get, set)
    
    const updatedNodes = nodes.map(node => {
      const newPos = result.positions[node.id]
      return newPos ? { ...node, position: newPos } : node
    })
    
    set({ nodes: updatedNodes })
  },

  resetCanvas: () => {
    const { nodes, edges } = get()
    if (nodes.length === 0 && edges.length === 0) return

    pushToHistory(get, set)
    set({
      nodes: [],
      edges: [],
      touchedNodeIds: new Set(),
      nextNodeId: 1,
      nextEdgeId: 1
    })
  },

  deleteEdge: (id) => {
    const { edges, selection } = get()
    const edge = edges.find(e => e.id === id)
    if (!edge) return

    pushToHistory(get, set)
    
    const newEdges = edges.filter(e => e.id !== id)
    const newEdgeIds = new Set(selection.edgeIds)
    newEdgeIds.delete(id)
    
    set({ 
      edges: newEdges,
      selection: { ...selection, edgeIds: newEdgeIds }
    })
  },

  updateEdgeEndpoints: (id, updates) => {
    const { edges, nodes } = get()
    const edge = edges.find(e => e.id === id)
    if (!edge) return

    const newSource = updates.source ?? edge.source
    const newTarget = updates.target ?? edge.target

    // Validate: no self-loops
    if (newSource === newTarget) {
      return // Caller should show toast: "That connection isn't allowed."
    }

    // Validate: no duplicates
    const duplicate = edges.find(e => 
      e.id !== id && e.source === newSource && e.target === newTarget
    )
    if (duplicate) {
      return // Caller should show toast: "A connector already exists between those nodes."
    }

    // Validate: nodes exist
    const sourceExists = nodes.some(n => n.id === newSource)
    const targetExists = nodes.some(n => n.id === newTarget)
    if (!sourceExists || !targetExists) {
      return
    }

    pushToHistory(get, set)

    const newEdges = edges.map(e => 
      e.id === id 
        ? { ...e, source: newSource, target: newTarget }
        : e
    )

    set({ 
      edges: newEdges,
      selection: { ...get().selection, edgeIds: new Set([id]) }
    })
  },

  beginReconnect: (edgeId, end) => {
    const { edges } = get()
    const edge = edges.find(e => e.id === edgeId)
    if (!edge) return

    set({ reconnecting: { edgeId, end } })
  },

  completeReconnect: (nodeId) => {
    const { reconnecting } = get()
    if (!reconnecting) return

    const { edgeId, end } = reconnecting
    const updates = end === 'source' 
      ? { source: nodeId }
      : { target: nodeId }

    get().updateEdgeEndpoints(edgeId, updates)
    set({ reconnecting: null })
  },

  cancelReconnect: () => {
    set({ reconnecting: null })
  },

  reset: () => {
    clearTimers()
    set({
      nodes: initialNodes,
      edges: initialEdges,
      history: { past: [], future: [] },
      selection: { nodeIds: new Set(), edgeIds: new Set() },
      nextNodeId: 5,
      nextEdgeId: 5,
      _internal: { lastHistoryHash: historyHash(initialNodes, initialEdges) }
    })
  },

  cleanup: clearTimers
}))

/**
 * Validation selectors and helpers
 */

// Re-export InvalidNodeInfo type for compatibility
export type InvalidNode = InvalidNodeInfo

/**
 * Get all nodes with invalid outgoing probability sums
 * A node is invalid if it has 2+ non-zero outgoing edges and probabilities don't sum to 100% (±1%)
 * Uses shared validation util with touched node tracking to avoid flagging pristine nodes
 */
export const getInvalidNodes = (state: CanvasState): InvalidNode[] => {
  return getInvalidNodesUtil(state.nodes, state.edges, state.touchedNodeIds)
}

/**
 * Check if the canvas has any validation errors
 */
export const hasValidationErrors = (state: CanvasState): boolean => {
  return getInvalidNodes(state).length > 0
}

/**
 * Get the next invalid node (for Alt+V cycling)
 * If currentNodeId is provided, returns the next invalid node after it
 * Otherwise returns the first invalid node
 */
export const getNextInvalidNode = (state: CanvasState, currentNodeId?: string): InvalidNode | null => {
  return getNextInvalidNodeUtil(state.nodes, state.edges, state.touchedNodeIds, currentNodeId)
}
