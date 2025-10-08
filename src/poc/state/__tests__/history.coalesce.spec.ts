import { describe, it, expect } from 'vitest'
import { initialHistory, push, doUndo, type Op } from '../../state/history'

function move(id: string, from: {x:number;y:number}, to: {x:number;y:number}): Op {
  return { type: 'move', payload: { id, from, to } }
}

describe('history: coalesce small jitter moves', () => {
  it('merges rapid successive moves on same node within window', () => {
    const h0 = initialHistory({ nodes: [{ id: 'n1', x: 0, y: 0 }], edges: [], renames: {} })
    const h1 = push(h0, move('n1', { x: 0, y: 0 }, { x: 1, y: 1 }))
    // emulate rapid next move
    const h2 = push(h1, move('n1', { x: 1, y: 1 }, { x: 10, y: 10 }))
    expect(h2.undo.length).toBe(1)
    const f = h2.undo[0].forward as any
    expect(f.type).toBe('move')
    expect(f.payload.from).toEqual({ x: 0, y: 0 })
    expect(f.payload.to).toEqual({ x: 10, y: 10 })
  })

  it('redo clears after new op', () => {
    const h0 = initialHistory({ nodes: [{ id: 'n1', x: 0, y: 0 }], edges: [], renames: {} })
    const h1 = push(h0, move('n1', { x: 0, y: 0 }, { x: 5, y: 5 }))
    // undo then new op clears redo
    const u1 = doUndo(h1)
    const h2 = push(u1, { type: 'add', payload: { kind: 'node', node: { id: 'n2', x: 0, y: 0 } } as any })
    expect(h2.redo.length).toBe(0)
  })
})
