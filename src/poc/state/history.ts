// src/poc/state/history.ts
// Local-only undo/redo ring buffer with pure ops (op + inverse). Not persisted across reloads.

export type Id = string

export interface SamNode {
  id: Id
  x: number
  y: number
  label?: string
}

export interface SamEdge {
  id?: Id
  from: Id
  to: Id
  label?: string
}

export interface SamState {
  nodes: SamNode[]
  edges: SamEdge[]
  renames: Record<Id, string>
}

export type Op =
  | { type: 'add'; payload: { kind: 'node'; node: SamNode } }
  | { type: 'add'; payload: { kind: 'edge'; edge: SamEdge } }
  | { type: 'remove'; payload: { kind: 'node'; id: Id } }
  | { type: 'remove'; payload: { kind: 'edge'; id?: Id; from?: Id; to?: Id } }
  | { type: 'move'; payload: { id: Id; from: { x: number; y: number }; to: { x: number; y: number } } }
  | { type: 'edit'; payload: { id: Id; from?: string; to?: string } }
  | { type: 'connect'; payload: { edge: SamEdge } }
  | { type: 'disconnect'; payload: { id?: Id; from?: Id; to?: Id } }

export interface Pair { forward: Op; inverse: Op }

export interface History {
  present: SamState
  undo: Pair[]
  redo: Pair[]
  cap: number
}

export function cloneState(s: SamState): SamState {
  return { nodes: s.nodes.map(n => ({ ...n })), edges: s.edges.map(e => ({ ...e })), renames: { ...s.renames } }
}

export function initialHistory(present?: SamState, cap = 50): History {
  const base: SamState = present ? cloneState(present) : { nodes: [], edges: [], renames: {} }
  return { present: base, undo: [], redo: [], cap }
}

export function applyOp(state: SamState, op: Op): SamState {
  const s = cloneState(state)
  switch (op.type) {
    case 'add':
      if (op.payload.kind === 'node') {
        s.nodes = [...s.nodes, { ...op.payload.node }]
      } else {
        s.edges = [...s.edges, { ...op.payload.edge }]
      }
      return s
    case 'remove':
      if (op.payload.kind === 'node') {
        s.nodes = s.nodes.filter(n => n.id !== op.payload.id)
        s.edges = s.edges.filter(e => e.from !== op.payload.id && e.to !== op.payload.id)
      } else if (op.payload.kind === 'edge') {
        const p = op.payload
        if (p.id) {
          s.edges = s.edges.filter(e => e.id !== p.id)
        } else if (p.from && p.to) {
          s.edges = s.edges.filter(e => !(e.from === p.from && e.to === p.to))
        }
      }
      return s
    case 'move':
      s.nodes = s.nodes.map(n => (n.id === op.payload.id ? { ...n, x: op.payload.to.x, y: op.payload.to.y } : n))
      return s
    case 'edit': {
      const to = op.payload.to
      if (to === undefined || to === null) {
        const { [op.payload.id]: _, ...rest } = s.renames
        s.renames = rest
      } else {
        s.renames = { ...s.renames, [op.payload.id]: to }
      }
      return s
    }
    case 'connect':
      s.edges = [...s.edges, { ...op.payload.edge }]
      return s
    case 'disconnect':
      if (op.payload.id) {
        s.edges = s.edges.filter(e => e.id !== op.payload.id)
      } else if (op.payload.from && op.payload.to) {
        s.edges = s.edges.filter(e => !(e.from === op.payload.from && e.to === op.payload.to))
      }
      return s
  }
}

export function inverse(op: Op, prev: SamState): Op {
  switch (op.type) {
    case 'add':
      return op.payload.kind === 'node'
        ? { type: 'remove', payload: { kind: 'node', id: op.payload.node.id } }
        : { type: 'remove', payload: { kind: 'edge', id: op.payload.edge.id, from: op.payload.edge.from, to: op.payload.edge.to } }
    case 'remove':
      if (op.payload.kind === 'node') {
        const node = prev.nodes.find(n => n.id === op.payload.id)
        return node
          ? { type: 'add', payload: { kind: 'node', node: { ...node } } }
          : op
      } else if (op.payload.kind === 'edge') {
        const p = op.payload
        const edge = prev.edges.find(e => (p.id ? e.id === p.id : e.from === p.from && e.to === p.to))
        return edge
          ? { type: 'add', payload: { kind: 'edge', edge: { ...edge } } }
          : op
      } else {
        return op
      }
    case 'move':
      return { type: 'move', payload: { id: op.payload.id, from: op.payload.to, to: op.payload.from } }
    case 'edit': {
      const prevName = prev.renames[op.payload.id]
      return { type: 'edit', payload: { id: op.payload.id, from: op.payload.to, to: prevName } }
    }
    case 'connect':
      return { type: 'disconnect', payload: { id: op.payload.edge.id, from: op.payload.edge.from, to: op.payload.edge.to } }
    case 'disconnect': {
      const edge = prev.edges.find(e => (op.payload.id ? e.id === op.payload.id : e.from === op.payload.from && e.to === op.payload.to))
      return edge
        ? { type: 'connect', payload: { edge: { ...edge } } }
        : op
    }
  }
}

export function canUndo(h: History): boolean { return h.undo.length > 0 }
export function canRedo(h: History): boolean { return h.redo.length > 0 }

export function push(h: History, forward: Op): History {
  const inv = inverse(forward, h.present)
  const nextPresent = applyOp(h.present, forward)
  const pair: Pair = { forward, inverse: inv }
  const nextUndo = [...h.undo, pair]
  const cappedUndo = nextUndo.length > h.cap ? nextUndo.slice(nextUndo.length - h.cap) : nextUndo
  return { present: nextPresent, undo: cappedUndo, redo: [], cap: h.cap }
}

export function doUndo(h: History): History {
  if (!canUndo(h)) return h
  const pair = h.undo[h.undo.length - 1]
  const prevUndo = h.undo.slice(0, -1)
  const nextPresent = applyOp(h.present, pair.inverse)
  const nextRedo = [...h.redo, pair]
  return { present: nextPresent, undo: prevUndo, redo: nextRedo, cap: h.cap }
}

export function doRedo(h: History): History {
  if (!canRedo(h)) return h
  const pair = h.redo[h.redo.length - 1]
  const prevRedo = h.redo.slice(0, -1)
  const nextPresent = applyOp(h.present, pair.forward)
  const nextUndo = [...h.undo, pair]
  const cappedUndo = nextUndo.length > h.cap ? nextUndo.slice(nextUndo.length - h.cap) : nextUndo
  return { present: nextPresent, undo: cappedUndo, redo: prevRedo, cap: h.cap }
}
