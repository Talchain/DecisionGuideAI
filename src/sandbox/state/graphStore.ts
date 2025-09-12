import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Edge, Graph, Node } from '@/domain/graph'
import { emptyGraph, normalizeNode, SCHEMA_VERSION } from '@/domain/graph'
import { useTelemetry } from '@/lib/useTelemetry'

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
  selectedNodeId?: string | null
  selectedEdgeId?: string | null
  setSelectedNode: (nodeId: string | null) => void
  setSelectedEdge: (edgeId: string | null) => void
  // Snapshots API (UI-only storage)
  saveSnapshot: (name?: string) => { snapId: string }
  duplicateSnapshot: (srcSnapId: string) => { snapId: string } | { error: string }
  restoreSnapshot: (snapId: string) => { ok: true } | { ok: false, error: string }
  listSnapshots: () => Array<{ id: string; name: string; createdAt: number }>
  renameSnapshot: (snapId: string, name: string) => { ok: true } | { ok: false, error: string }
  deleteSnapshot: (snapId: string) => { ok: true } | { ok: false, error: string }
  undoDeleteSnapshot: () => { ok: true } | { ok: false, error: string }
  // AI Draft
  applyDraft: (draft: { nodes: Node[]; edges: Edge[] }) => { ok: true; bbox: { x: number; y: number; w: number; h: number }; added: { nodes: string[]; edges: string[] } } | { ok: false, error: string }
  undoLastDraft: () => { ok: true } | { ok: false, error: string }
}

export const GraphContext = createContext<GraphAPI | null>(null)

const keyFor = (decisionId: string) => `dgai:graph:decision:${decisionId}`
const keySnapList = (decisionId: string) => `dgai:graph:snap:list:${decisionId}`
const keySnap = (decisionId: string, snapId: string) => `dgai:graph:snap:${decisionId}:${snapId}`

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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const sessionIdRef = useRef<string>(Math.random().toString(36).slice(2))
  const { track } = useTelemetry()
  // Last-deleted snapshot (UI-only TTL memory)
  const lastDeletedRef = useRef<null | { id: string; name: string; payload: Graph; timer: number | null }>(null)
  // Last AI draft (UI-only)
  const lastDraftRef = useRef<null | { nodes: string[]; edges: string[] }>(null)

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

  // Reload graph when localStorage updates (e.g., cross-tab or tests)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      try {
        if (!e) return
        if (e.key === storageKey) {
          const parsed = e.newValue ? JSON.parse(e.newValue) : null
          setGraph(clampAndNormalize(parsed))
        }
      } catch {}
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey])

  const api = useMemo<GraphAPI>(() => ({
    decisionId,
    graph,
    getGraph: () => graph,
    selectedNodeId,
    selectedEdgeId,
    setSelectedNode: (id) => setSelectedNodeId(id),
    setSelectedEdge: (id) => setSelectedEdgeId(id),
    saveSnapshot: (name?: string) => {
      const snapId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const entry = { id: snapId, name: name || 'Snapshot', createdAt: Date.now() }
      try {
        // Write payload
        const payload: Graph = clampAndNormalize(graph)
        localStorage.setItem(keySnap(decisionId, snapId), JSON.stringify(payload))
        // Update list
        const raw = localStorage.getItem(keySnapList(decisionId))
        const list = raw ? (JSON.parse(raw) as Array<{ id: string; name: string; createdAt: number }>) : []
        list.push(entry)
        localStorage.setItem(keySnapList(decisionId), JSON.stringify(list))
        try { track('sandbox_snapshot_create', { decisionId, route: 'combined', sessionId: sessionIdRef.current, snapId, name: entry.name }) } catch {}
      } catch {}
      return { snapId }
    },
    applyDraft: (draft) => {
      try {
        const addedNodes: string[] = []
        const addedEdges: string[] = []
        const next: Graph = { ...graph, nodes: { ...graph.nodes }, edges: { ...graph.edges } }
        // Deduplicate by type+title
        const byTypeTitle = new Map<string, string>()
        for (const n of Object.values(next.nodes)) byTypeTitle.set(`${n.type}::${n.title}`.toLowerCase(), n.id)
        // Place nodes (respect incoming view if provided)
        let count = 0
        for (const n of draft.nodes) {
          const key = `${n.type}::${n.title}`.toLowerCase()
          let id = byTypeTitle.get(key)
          if (id) {
            // merge meta.generated if present
            next.nodes[id] = { ...next.nodes[id], meta: { ...(next.nodes[id].meta || {}), generated: (n.meta?.generated || next.nodes[id].meta?.generated) } }
            continue
          }
          id = n.id && !next.nodes[n.id] ? n.id : `n_${Math.random().toString(36).slice(2,8)}`
          const view = n.view || { x: 80 + (count%4)*220, y: 80 + Math.floor(count/4)*180, w: 160, h: 80 }
          next.nodes[id] = { id, type: n.type, title: n.title, notes: n.notes, krImpacts: n.krImpacts, view, meta: { ...(n.meta || {}), generated: true } }
          byTypeTitle.set(key, id)
          addedNodes.push(id)
          count++
        }
        // Upsert edges if endpoints exist
        for (const e of draft.edges) {
          const from = byTypeTitle.get(`${(next.nodes[e.from]?.type || 'X')}::${next.nodes[e.from]?.title}`.toLowerCase()) || e.from
          const to = byTypeTitle.get(`${(next.nodes[e.to]?.type || 'X')}::${next.nodes[e.to]?.title}`.toLowerCase()) || e.to
          const fromOk = !!next.nodes[from]
          const toOk = !!next.nodes[to]
          if (!fromOk || !toOk) continue
          let id = e.id && !next.edges[e.id] ? e.id : `e_${Math.random().toString(36).slice(2,8)}`
          next.edges[id] = { id, from, to, kind: e.kind, notes: e.notes, meta: { ...(e.meta || {}), generated: true } }
          addedEdges.push(id)
        }
        // Persist and update state
        setGraph(next)
        scheduleSave(next)
        lastDraftRef.current = { nodes: addedNodes, edges: addedEdges }
        const xs = addedNodes.map(id => next.nodes[id]?.view?.x ?? 0)
        const ys = addedNodes.map(id => next.nodes[id]?.view?.y ?? 0)
        const ws = addedNodes.map(id => next.nodes[id]?.view?.w ?? 160)
        const hs = addedNodes.map(id => next.nodes[id]?.view?.h ?? 80)
        const minX = xs.length ? Math.min(...xs) : 0
        const minY = ys.length ? Math.min(...ys) : 0
        const maxX = xs.length ? Math.max(...xs.map((x,i)=> x + (ws[i]||160))) : 0
        const maxY = ys.length ? Math.max(...ys.map((y,i)=> y + (hs[i]||80))) : 0
        const bbox = { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) }
        try { track('sandbox_graph_ai_draft', { decisionId, route: 'combined', sessionId: sessionIdRef.current, countNodes: addedNodes.length, countEdges: addedEdges.length }) } catch {}
        return { ok: true, bbox, added: { nodes: addedNodes, edges: addedEdges } }
      } catch { return { ok: false, error: 'error' } }
    },
    undoLastDraft: () => {
      try {
        const last = lastDraftRef.current
        if (!last) return { ok: false, error: 'not_found' }
        setGraph(prev => {
          const nodes = { ...prev.nodes }
          const edges = { ...prev.edges }
          for (const id of last.edges) { delete edges[id] }
          for (const id of last.nodes) { delete nodes[id] }
          const next = { ...prev, nodes, edges }
          scheduleSave(next)
          return next
        })
        lastDraftRef.current = null
        return { ok: true }
      } catch { return { ok: false, error: 'error' } }
    },
    duplicateSnapshot: (srcSnapId: string) => {
      try {
        const raw = localStorage.getItem(keySnap(decisionId, srcSnapId))
        if (!raw) return { error: 'not_found' }
        const from = JSON.parse(raw)
        const snapId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
        const entry = { id: snapId, name: `Copy of ${srcSnapId}`, createdAt: Date.now() }
        localStorage.setItem(keySnap(decisionId, snapId), JSON.stringify(clampAndNormalize(from)))
        const listRaw = localStorage.getItem(keySnapList(decisionId))
        const list = listRaw ? JSON.parse(listRaw) : []
        list.push(entry)
        localStorage.setItem(keySnapList(decisionId), JSON.stringify(list))
        try { track('sandbox_snapshot_duplicate', { decisionId, route: 'combined', sessionId: sessionIdRef.current, srcSnapId, snapId }) } catch {}
        return { snapId }
      } catch { return { error: 'error' } }
    },
    restoreSnapshot: (snapId: string) => {
      try {
        const raw = localStorage.getItem(keySnap(decisionId, snapId))
        if (!raw) return { ok: false, error: 'not_found' }
        const g = clampAndNormalize(JSON.parse(raw))
        setGraph(g)
        scheduleSave(g)
        try { track('sandbox_snapshot_restore', { decisionId, route: 'combined', sessionId: sessionIdRef.current, snapId }) } catch {}
        return { ok: true }
      } catch { return { ok: false, error: 'error' } }
    },
    listSnapshots: () => {
      try {
        const raw = localStorage.getItem(keySnapList(decisionId))
        const list = raw ? JSON.parse(raw) as Array<{ id: string; name: string; createdAt: number }> : []
        return list
      } catch { return [] }
    },
    renameSnapshot: (snapId: string, name: string) => {
      try {
        const raw = localStorage.getItem(keySnapList(decisionId))
        const list: Array<{ id: string; name: string; createdAt: number }> = raw ? JSON.parse(raw) : []
        const idx = list.findIndex(e => e.id === snapId)
        if (idx === -1) return { ok: false, error: 'not_found' }
        list[idx] = { ...list[idx], name }
        localStorage.setItem(keySnapList(decisionId), JSON.stringify(list))
        try { track('sandbox_snapshot_rename', { decisionId, route: 'combined', sessionId: sessionIdRef.current, snapId, name }) } catch {}
        return { ok: true }
      } catch { return { ok: false, error: 'error' } }
    },
    deleteSnapshot: (snapId: string) => {
      try {
        const raw = localStorage.getItem(keySnapList(decisionId))
        const list: Array<{ id: string; name: string; createdAt: number }> = raw ? JSON.parse(raw) : []
        const idx = list.findIndex(e => e.id === snapId)
        const entry = idx >= 0 ? list[idx] : null
        const payloadRaw = localStorage.getItem(keySnap(decisionId, snapId))
        const payload = payloadRaw ? clampAndNormalize(JSON.parse(payloadRaw)) : null
        const next = list.filter(e => e.id !== snapId)
        localStorage.setItem(keySnapList(decisionId), JSON.stringify(next))
        try { localStorage.removeItem(keySnap(decisionId, snapId)) } catch {}
        // Capture for 10s undo
        if (entry && payload) {
          if (lastDeletedRef.current?.timer) window.clearTimeout(lastDeletedRef.current.timer)
          const t = window.setTimeout(() => { lastDeletedRef.current = null }, 10000)
          lastDeletedRef.current = { id: entry.id, name: entry.name, payload, timer: t as unknown as number }
        }
        try { track('sandbox_snapshot_delete', { decisionId, route: 'combined', sessionId: sessionIdRef.current, snapId }) } catch {}
        return { ok: true }
      } catch { return { ok: false, error: 'error' } }
    },
    undoDeleteSnapshot: () => {
      try {
        const last = lastDeletedRef.current
        if (!last) return { ok: false, error: 'not_found' }
        // reinsert list entry and payload under same id
        const listRaw = localStorage.getItem(keySnapList(decisionId))
        const list: Array<{ id: string; name: string; createdAt: number }> = listRaw ? JSON.parse(listRaw) : []
        if (!list.find(e => e.id === last.id)) {
          list.push({ id: last.id, name: last.name, createdAt: Date.now() })
          localStorage.setItem(keySnapList(decisionId), JSON.stringify(list))
        }
        localStorage.setItem(keySnap(decisionId, last.id), JSON.stringify(last.payload))
        if (last.timer) { try { window.clearTimeout(last.timer) } catch {} }
        lastDeletedRef.current = null
        return { ok: true }
      } catch { return { ok: false, error: 'error' } }
    },
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
  }), [decisionId, graph, storageKey, updateGraph, selectedNodeId, selectedEdgeId])

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
