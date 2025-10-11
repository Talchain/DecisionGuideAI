import { describe, it, expect } from 'vitest'
import { initialHistory, push, undo, redo, applyOp, inverse, type Op } from '../history'

const S0 = { nodes: [
  { id: 'a', label: 'A', x: 100, y: 80 },
  { id: 'b', label: 'B', x: 220, y: 80 },
], edges: [] }

describe('plc history', () => {
  it('move apply/inverse round-trip', () => {
    const op: Op = { type: 'move', payload: { id: 'a', from: { x: 100, y: 80 }, to: { x: 140, y: 100 } } }
    const s1 = applyOp(S0 as any, op)
    expect(s1.nodes.find(n=>n.id==='a')!.x).toBe(140)
    const s2 = applyOp(s1 as any, inverse(op))
    expect(s2.nodes.find(n=>n.id==='a')!.x).toBe(100)
  })

  it('undo/redo single move', () => {
    let h = initialHistory(S0 as any)
    h = push(h, { type: 'move', payload: { id: 'a', from: { x: 100, y: 80 }, to: { x: 140, y: 100 } } })
    expect(h.present.nodes.find(n=>n.id==='a')!.x).toBe(140)
    h = undo(h)
    expect(h.present.nodes.find(n=>n.id==='a')!.x).toBe(100)
    h = redo(h)
    expect(h.present.nodes.find(n=>n.id==='a')!.x).toBe(140)
  })

  it('batchMove applies for multiple nodes', () => {
    let h = initialHistory(S0 as any)
    h = push(h, { type: 'batchMove', payload: { moves: [
      { id: 'a', from: { x: 100, y: 80 }, to: { x: 120, y: 95 } },
      { id: 'b', from: { x: 220, y: 80 }, to: { x: 260, y: 110 } },
    ] } })
    expect(h.present.nodes.find(n=>n.id==='a')!.x).toBe(120)
    expect(h.present.nodes.find(n=>n.id==='b')!.y).toBe(110)
  })
})
