// src/canvas/store.ts
// Zustand store for canvas state with history and persistence

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Node, Edge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange } from '@xyflow/react'

interface CanvasState {
  nodes: Node[]
  edges: Edge[]
  history: { nodes: Node[]; edges: Edge[] }[]
  historyIndex: number
  selectedNodes: string[]
  
  // Actions
  setNodes: (nodes: Node[]) => void
  setEdges: (edges: Edge[]) => void
  addNode: (node: Node) => void
  removeNode: (id: string) => void
  updateNodeLabel: (id: string, label: string) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  addEdge: (edge: Edge) => void
  
  // History
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
  pushHistory: () => void
  
  // Selection
  setSelectedNodes: (ids: string[]) => void
  deleteSelected: () => void
  
  // Reset
  reset: () => void
}

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'decision',
    position: { x: 250, y: 100 },
    data: { label: 'Start' }
  },
  {
    id: '2',
    type: 'decision',
    position: { x: 100, y: 250 },
    data: { label: 'Option A' }
  },
  {
    id: '3',
    type: 'decision',
    position: { x: 400, y: 250 },
    data: { label: 'Option B' }
  },
  {
    id: '4',
    type: 'decision',
    position: { x: 250, y: 400 },
    data: { label: 'Outcome' }
  }
]

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', label: 'Path A' },
  { id: 'e1-3', source: '1', target: '3', label: 'Path B' },
  { id: 'e2-4', source: '2', target: '4' },
  { id: 'e3-4', source: '3', target: '4' }
]

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      nodes: initialNodes,
      edges: initialEdges,
      history: [{ nodes: initialNodes, edges: initialEdges }],
      historyIndex: 0,
      selectedNodes: [],

  setNodes: (nodes) => {
    set({ nodes })
    get().pushHistory()
  },

  setEdges: (edges) => {
    set({ edges })
    get().pushHistory()
  },

  addNode: (node) => {
    set((state) => ({ nodes: [...state.nodes, node] }))
    get().pushHistory()
  },

  removeNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id)
    }))
    get().pushHistory()
  },

  updateNodeLabel: (id, label) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n
      )
    }))
    get().pushHistory()
  },

  onNodesChange: (changes) => {
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes)
    }))
  },

  onEdgesChange: (changes) => {
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges)
    }))
  },

  addEdge: (edge) => {
    set((state) => ({ edges: [...state.edges, edge] }))
    get().pushHistory()
  },

  pushHistory: () => {
    const { nodes, edges, history, historyIndex } = get()
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push({ nodes, edges })
    set({ history: newHistory, historyIndex: newHistory.length - 1 })
  },

  undo: () => {
    const { history, historyIndex } = get()
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1]
      set({
        nodes: prevState.nodes,
        edges: prevState.edges,
        historyIndex: historyIndex - 1
      })
    }
  },

  redo: () => {
    const { history, historyIndex } = get()
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1]
      set({
        nodes: nextState.nodes,
        edges: nextState.edges,
        historyIndex: historyIndex + 1
      })
    }
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,

  setSelectedNodes: (ids) => set({ selectedNodes: ids }),

  deleteSelected: () => {
    const { selectedNodes } = get()
    set((state) => ({
      nodes: state.nodes.filter((n) => !selectedNodes.includes(n.id)),
      edges: state.edges.filter(
        (e) => !selectedNodes.includes(e.source) && !selectedNodes.includes(e.target)
      ),
      selectedNodes: []
    }))
    get().pushHistory()
  },

  reset: () => {
    set({
      nodes: initialNodes,
      edges: initialEdges,
      history: [{ nodes: initialNodes, edges: initialEdges }],
      historyIndex: 0,
      selectedNodes: []
    })
  }
}),
    {
      name: 'canvas-storage',
      partialize: (state) => ({
        nodes: state.nodes,
        edges: state.edges
      })
    }
  )
)
