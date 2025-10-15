// Hardened store with timer cleanup, ID reseeding, edge debouncing
import { create } from 'zustand'
import { Node, Edge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react'

const initialNodes: Node[] = [
  { id: '1', type: 'decision', position: { x: 250, y: 100 }, data: { label: 'Start' } },
  { id: '2', type: 'decision', position: { x: 100, y: 250 }, data: { label: 'Option A' } },
  { id: '3', type: 'decision', position: { x: 400, y: 250 }, data: { label: 'Option B' } },
  { id: '4', type: 'decision', position: { x: 250, y: 400 }, data: { label: 'Outcome' } }
]

const initialEdges: Edge[] = [
  { id: 'e1', source: '1', target: '2', label: 'Path A' },
  { id: 'e2', source: '1', target: '3', label: 'Path B' },
  { id: 'e3', source: '2', target: '4' },
  { id: 'e4', source: '3', target: '4' }
]

interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  history: { past: { nodes: Node[]; edges: Edge[] }[]; future: { nodes: Node[]; edges: Edge[] }[] }
  selection: { nodeIds: Set<string>; edgeIds: Set<string> }
  nextNodeId: number
  nextEdgeId: number
  addNode: (pos?: { x: number; y: number }) => void
  updateNodeLabel: (id: string, label: string) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onSelectionChange: (params: { nodes: Node[]; edges: Edge[] }) => void
  addEdge: (edge: Omit<Edge, 'id'>) => void
  pushHistory: (debounced?: boolean) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  deleteSelected: () => void
  createNodeId: () => string
  createEdgeId: () => string
  reseedIds: (nodes: Node[], edges: Edge[]) => void
  reset: () => void
  cleanup: () => void
}

let historyTimer: ReturnType<typeof setTimeout> | null = null
const MAX_HISTORY = 50

function clearTimers() {
  if (historyTimer) {
    clearTimeout(historyTimer)
    historyTimer = null
  }
}

function pushToHistory(get: () => CanvasState, set: (fn: (s: CanvasState) => Partial<CanvasState>) => void) {
  const { nodes, edges, history } = get()
  const past = [...history.past, { nodes, edges }].slice(-MAX_HISTORY)
  set(() => ({ history: { past, future: [] } }))
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

  addNode: (pos) => {
    pushToHistory(get, set)
    const id = get().createNodeId()
    set((s) => ({ nodes: [...s.nodes, { id, type: 'decision', position: pos || { x: 200, y: 200 }, data: { label: `Node ${id}` } }] }))
  },

  updateNodeLabel: (id, label) => {
    pushToHistory(get, set)
    set((s) => ({ nodes: s.nodes.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n) }))
  },

  onNodesChange: (changes) => {
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) }))
    const isDrag = changes.some(c => c.type === 'position' && c.dragging)
    get().pushHistory(isDrag)
  },

  onEdgesChange: (changes) => {
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }))
    // Detect edge drag/manipulation (select changes during drag are common)
    const isEdgeUpdate = changes.some(c => c.type === 'select' || c.type === 'remove' || c.type === 'add')
    get().pushHistory(isEdgeUpdate)
  },

  onSelectionChange: ({ nodes, edges }) => {
    set({ selection: { nodeIds: new Set(nodes.map(n => n.id)), edgeIds: new Set(edges.map(e => e.id)) } })
  },

  addEdge: (edge) => {
    pushToHistory(get, set)
    const id = get().createEdgeId()
    set((s) => ({ edges: [...s.edges, { id, ...edge }] }))
  },

  pushHistory: (debounced = false) => {
    if (debounced) {
      clearTimers()
      historyTimer = setTimeout(() => pushToHistory(get, set), 200)
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
  },

  redo: () => {
    const { history, nodes, edges } = get()
    if (history.future.length === 0) return
    const next = history.future[0]
    const past = [...history.past, { nodes, edges }]
    const future = history.future.slice(1)
    set({ nodes: next.nodes, edges: next.edges, history: { past, future } })
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

  reset: () => {
    clearTimers()
    set({ 
      nodes: initialNodes, 
      edges: initialEdges, 
      history: { past: [], future: [] }, 
      selection: { nodeIds: new Set(), edgeIds: new Set() }, 
      nextNodeId: 5,
      nextEdgeId: 5
    })
  },

  cleanup: clearTimers
}))
