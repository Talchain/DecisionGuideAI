// src/plc/state/history.ts
export type MoveOp = { type: 'move'; payload: { id: string; from: { x: number; y: number }; to: { x: number; y: number } } }
export type BatchMoveOp = { type: 'batchMove'; payload: { moves: Array<{ id: string; from: { x: number; y: number }; to: { x: number; y: number }> } } }
export type Op = MoveOp | BatchMoveOp

export interface PlcState {
  nodes: Array<{ id: string; label: string; x?: number; y?: number }>
  edges: Array<{ from: string; to: string; label?: string }>
}

export interface History {
  past: Op[]
  future: Op[]
  present: PlcState
}

export function applyOp(state: PlcState, op: Op): PlcState {
  if (op.type === 'move') {
    return {
      ...state,
      nodes: state.nodes.map(n => n.id === op.payload.id ? { ...n, x: op.payload.to.x, y: op.payload.to.y } : n)
    }
  }
  if (op.type === 'batchMove') {
    const map = new Map(op.payload.moves.map(m => [m.id, m.to]))
    return {
      ...state,
      nodes: state.nodes.map(n => map.has(n.id) ? { ...n, x: map.get(n.id)!.x, y: map.get(n.id)!.y } : n)
    }
  }
  return state
}

export function inverse(op: Op): Op {
  if (op.type === 'move') {
    return { type: 'move', payload: { id: op.payload.id, from: op.payload.to, to: op.payload.from } }
  }
  if (op.type === 'batchMove') {
    return {
      type: 'batchMove',
      payload: { moves: op.payload.moves.map(m => ({ id: m.id, from: m.to, to: m.from })) }
    }
  }
  return op
}

export function initialHistory(seed: PlcState): History {
  return { past: [], future: [], present: seed }
}

export function push(h: History, op: Op): History {
  return {
    past: [...h.past, op],
    future: [],
    present: applyOp(h.present, op)
  }
}

export function undo(h: History): History {
  if (h.past.length === 0) return h
  const op = h.past[h.past.length - 1]
  const inv = inverse(op)
  const prev = applyOp(h.present, inv)
  return { past: h.past.slice(0, -1), future: [op, ...h.future], present: prev }
}

export function redo(h: History): History {
  if (h.future.length === 0) return h
  const op = h.future[0]
  const next = applyOp(h.present, op)
  return { past: [...h.past, op], future: h.future.slice(1), present: next }
}
