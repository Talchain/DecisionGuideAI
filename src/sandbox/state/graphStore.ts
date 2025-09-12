import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Graph, Node, Edge, emptyGraph, normalizeNode, SCHEMA_VERSION } from '@/domain/graph'

export type GraphAPI = {
  decisionId: string
  graph: Graph
  getGraph: () => Graph
  upsertNode: (node: Node) => void
  removeNode: (nodeId: string) => void
  upsertEdge: (edge: Edge) => void
  removeEdge: (edgeId: string) => void
  updateNodeFields: (nodeId: string, patch: Partial<Omit<Node, 'id' | 'type'>>) => void
  setView: (nodeId: string, view: NonNullable<Node['view']>) => void
  reloadFromStorage: () => void
}

export const GraphContext = createContext<GraphAPI | null>(null)

const keyFor = (decisionId: string) => `dgai:graph:decision:${decisionId}`

function clampAndNormalize(g: any): Graph {
  try {
    if (!g || typeof g !== 'object') return emptyGraph()
    const nodes: Record<string, Node> = {}
    const edges: Record<string, Edge> = {}
    for (const [id, n] of Object.entries<any>(g.nodes || {})) {
      if (!n || typeof n !== 'object') continue
      nodes[id] = normalizeNode({ id, type: n.type, title: n.title ?? '', notes: n.notes, krImpacts: n.krImpacts, view: n.view })
    }
    for (const [id, e] of Object.entries<any>(g.edges || {})) {
      if (!e || typeof e !== 'object') continue
      const from = String(e.from || '')
      const to = String(e.to || '')
      const kind = e.kind as Edge['kind']
      if (!from || !to) continue
      edges[id] = { id, from, to, kind: (kind ?? 'supports'), notes: e.notes }
    }
    return { schemaVersion: SCHEMA_VERSION, nodes, edges }
  } catch {
    return emptyGraph()
  }
}

export function GraphProvider({ decisionId, children }: { decisionId: string; children: React.ReactNode }) {
  const storageKey = useMemo(() => keyFor(decisionId), [decisionId])
  const [graph, setGraph] = useState<Graph>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return emptyGraph()
      const parsed = JSON.parse(raw)
      if (parsed?.schemaVersion !== SCHEMA_VERSION) return clampAndNormalize(parsed)
      return clampAndNormalize(parsed)
    } catch { return emptyGraph() }
  })
  const saveTimerRef = useRef<number | null>(null)

  const scheduleSave = useCallback((next: Graph) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
    }, 800)
  }, [storageKey])

  const updateGraph = useCallback((fn: (g: Graph) => Graph) => {
    setGraph(prev => {
      const next = fn(prev)
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  useEffect(() => () => { if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current) }, [])

  const api = useMemo<GraphAPI>(() => ({
    decisionId,
    graph,
    getGraph: () => graph,
    upsertNode: (node: Node) => {
      const n = normalizeNode(node)
      updateGraph(g => ({ ...g, nodes: { ...g.nodes, [n.id]: { ...g.nodes[n.id], ...n } } }))
    },
    removeNode: (nodeId: string) => {
      updateGraph(g => {
        const nodes = { ...g.nodes }
        const edges = { ...g.edges }
        delete nodes[nodeId]
        for (const [id, e] of Object.entries(edges)) { if (e.from === nodeId || e.to === nodeId) delete edges[id] }
        return { ...g, nodes, edges }
      })
    },
    upsertEdge: (edge: Edge) => {
      const e: Edge = { ...edge, kind: edge.kind ?? 'supports' }
      updateGraph(g => ({ ...g, edges: { ...g.edges, [e.id]: { ...g.edges[e.id], ...e } } }))
    },
    removeEdge: (edgeId: string) => {
      updateGraph(g => { const edges = { ...g.edges }; delete edges[edgeId]; return { ...g, edges } })
    },
    updateNodeFields: (nodeId: string, patch: Partial<Omit<Node, 'id' | 'type'>>) => {
      updateGraph(g => {
        const prev = g.nodes[nodeId]
        if (!prev) return g
        const next = normalizeNode({ ...prev, ...patch })
        return { ...g, nodes: { ...g.nodes, [nodeId]: next } }
      })
    },
    setView: (nodeId: string, view: NonNullable<Node['view']>) => {
      updateGraph(g => {
        const prev = g.nodes[nodeId]
        if (!prev) return g
        const next = { ...prev, view: { ...prev.view, ...view } }
        return { ...g, nodes: { ...g.nodes, [nodeId]: normalizeNode(next) } }
      })
    },
    reloadFromStorage: () => {
      try {
        const raw = localStorage.getItem(storageKey)
        const parsed = raw ? JSON.parse(raw) : null
        setGraph(clampAndNormalize(parsed))
      } catch { setGraph(emptyGraph()) }
    },
  }), [decisionId, graph, storageKey, updateGraph])

  return React.createElement(GraphContext.Provider, { value: api, children })
}

export function useGraph(): GraphAPI {
  const ctx = useContext(GraphContext)
  if (!ctx) throw new Error('useGraph must be used within GraphProvider')
  return ctx
}

export function useGraphOptional(): GraphAPI | null {
  return useContext(GraphContext)
}
