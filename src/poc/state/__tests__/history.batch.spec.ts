import { describe, it, expect, vi } from 'vitest'
import { initialHistory, push, inverse, applyOp, doUndo, doRedo, type Op } from '../../state/history'

function bm(moves: Array<{ id: string; from: {x:number;y:number}; to: {x:number;y:number} }>): Op {
  return { type: 'batchMove', payload: { moves } } as any
}
function br(ids: string[]): Op { return { type: 'batchRemove', payload: { nodeIds: ids } } as any }

const S0 = { nodes: [
  { id: 'a', x: 0, y: 0 },
  { id: 'b', x: 10, y: 10 },
  { id: 'c', x: 20, y: 20 },
], edges: [], renames: {} }

describe('history: batch ops', () => {
  it('batchMove apply/inverse round-trip', () => {
    const h0 = initialHistory(S0)
    const op = bm([
      { id: 'a', from: { x: 0, y: 0 }, to: { x: 5, y: 5 } },
      { id: 'b', from: { x: 10, y: 10 }, to: { x: 15, y: 15 } },
    ])
    const s1 = applyOp(h0.present, op)
    expect(s1.nodes.find(n => n.id==='a')!.x).toBe(5)
    const inv = inverse(op, h0.present)
    const s2 = applyOp(s1, inv)
    expect(s2.nodes.find(n => n.id==='a')!.x).toBe(0)
    expect(s2.nodes.find(n => n.id==='b')!.y).toBe(10)
  })

  it('batchMove coalesces within 500ms for identical id set', () => {
    const h0 = initialHistory(S0)
    const h1 = push(h0, bm([
      { id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
      { id: 'b', from: { x: 10, y: 10 }, to: { x: 11, y: 11 } },
    ]))
    const h2 = push(h1, bm([
      { id: 'a', from: { x: 1, y: 1 }, to: { x: 3, y: 3 } },
      { id: 'b', from: { x: 11, y: 11 }, to: { x: 13, y: 13 } },
    ]))
    expect(h2.undo.length).toBe(1)
    const f: any = h2.undo[0].forward
    expect(f.type).toBe('batchMove')
    const a = f.payload.moves.find((m: any) => m.id==='a')
    const b = f.payload.moves.find((m: any) => m.id==='b')
    expect(a.from).toEqual({ x: 0, y: 0 })
    expect(a.to).toEqual({ x: 3, y: 3 })
    expect(b.from).toEqual({ x: 10, y: 10 })
    expect(b.to).toEqual({ x: 13, y: 13 })
  })

  it('batchRemove apply/inverse', () => {
    const h0 = initialHistory(S0)
    const h1 = push(h0, br(['a','c']))
    expect(h1.present.nodes.map(n=>n.id).sort()).toEqual(['b'])
    const inv = inverse(h1.undo[0].forward, h0.present)
    const s2 = applyOp(h1.present, inv)
    expect(s2.nodes.map(n=>n.id).sort()).toEqual(['a','b','c'])
  })
})

// Additional PoC-scoped batch tests (coalescing + undo/redo round-trip)
describe('history.batch', () => {
  function makeState() {
    return {
      nodes: [
        { id: 'a', label: 'A', x: 100, y: 80 },
        { id: 'b', label: 'B', x: 220, y: 80 },
        { id: 'c', label: 'C', x: 340, y: 80 },
      ],
      edges: [{ id: 'e1', from: 'a', to: 'b' }, { id: 'e2', from: 'b', to: 'c' }],
      renames: {} as Record<string, string>,
    }
  }

  it('batchMove apply/inverse round-trip for multiple nodes', () => {
    let hist = initialHistory(makeState())
    const op: Op = {
      type: 'batchMove',
      payload: {
        moves: [
          { id: 'a', from: { x: 100, y: 80 }, to: { x: 150, y: 100 } },
          { id: 'c', from: { x: 340, y: 80 }, to: { x: 370, y: 110 } },
        ],
      },
    }
    hist = push(hist, op)

    const na = hist.present.nodes.find(n => n.id === 'a')!
    const nc = hist.present.nodes.find(n => n.id === 'c')!
    expect(na.x).toBe(150); expect(na.y).toBe(100)
    expect(nc.x).toBe(370); expect(nc.y).toBe(110)

    // Undo
    hist = doUndo(hist)
    const ua = hist.present.nodes.find(n => n.id === 'a')!
    const uc = hist.present.nodes.find(n => n.id === 'c')!
    expect(ua.x).toBe(100); expect(ua.y).toBe(80)
    expect(uc.x).toBe(340); expect(uc.y).toBe(80)

    // Redo
    hist = doRedo(hist)
    const ra = hist.present.nodes.find(n => n.id === 'a')!
    const rc = hist.present.nodes.find(n => n.id === 'c')!
    expect(ra.x).toBe(150); expect(ra.y).toBe(100)
    expect(rc.x).toBe(370); expect(rc.y).toBe(110)
  })

  it('coalesces batchMove within 500ms only when id sets are identical', () => {
    let hist = initialHistory(makeState())
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)

    // First batch for {a,c}
    hist = push(hist, {
      type: 'batchMove',
      payload: {
        moves: [
          { id: 'a', from: { x: 100, y: 80 }, to: { x: 120, y: 90 } },
          { id: 'c', from: { x: 340, y: 80 }, to: { x: 350, y: 95 } },
        ],
      },
    })

    // +300ms, same id set -> should coalesce
    vi.setSystemTime(1_700_000_000_300)
    hist = push(hist, {
      type: 'batchMove',
      payload: {
        moves: [
          { id: 'a', from: { x: 120, y: 90 }, to: { x: 140, y: 100 } },
          { id: 'c', from: { x: 350, y: 95 }, to: { x: 370, y: 110 } },
        ],
      },
    })
    expect(hist.undo.length).toBe(1)

    // +600ms, same id set -> should NOT coalesce
    vi.setSystemTime(1_700_000_000_900)
    hist = push(hist, {
      type: 'batchMove',
      payload: {
        moves: [
          { id: 'a', from: { x: 140, y: 100 }, to: { x: 150, y: 100 } },
          { id: 'c', from: { x: 370, y: 110 }, to: { x: 372, y: 112 } },
        ],
      },
    })
    expect(hist.undo.length).toBe(2)

    // Different id set -> never coalesce with previous
    vi.setSystemTime(1_700_000_001_100)
    hist = push(hist, {
      type: 'batchMove',
      payload: { moves: [{ id: 'b', from: { x: 220, y: 80 }, to: { x: 260, y: 100 } }] },
    })
    expect(hist.undo.length).toBe(3)

    vi.useRealTimers()
  })
})

console.log('GATES: PASS — history batch unit')
