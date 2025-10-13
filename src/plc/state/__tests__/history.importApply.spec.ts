import { describe, it, expect } from 'vitest'
import { applyOp, inverse, labelOf, type PlcState, type ImportApplyOp } from '../history'

function st(nodes: Array<{id:string,label:string,x:number,y:number}>, edges: Array<{from:string,to:string,label?:string}> = []): PlcState {
  return { nodes: nodes.map(n => ({ id: n.id, label: n.label, x: n.x, y: n.y })), edges: edges.map(e => ({ from: e.from, to: e.to, label: e.label })) }
}

describe('history importApply', () => {
  it('apply then inverse restores exactly; label formats', () => {
    const before = st(
      [
        { id: 'a', label: 'A', x: 0, y: 0 },
        { id: 'b', label: 'B', x: 5, y: 5 },
      ],
      [ { from: 'a', to: 'b' } ]
    )

    const op: ImportApplyOp = {
      type: 'importApply',
      meta: { kind: 'import-apply' },
      payload: {
        // add c, remove b, move a, remove a->b, add a->c
        addNodes: [ { id: 'c', label: 'C', x: 10, y: 10 } ],
        removeNodes: [ { id: 'b', label: 'B', x: 5, y: 5 } ],
        moves: [ { id: 'a', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } } ],
        addEdges: [ { from: 'a', to: 'c' } ],
        removeEdges: [ { from: 'a', to: 'b' } ],
      }
    }

    const after = applyOp(before, op)
    expect(after.nodes.map(n => n.id).sort()).toEqual(['a','c'])
    const a = after.nodes.find(n => n.id==='a')!
    expect(a.x).toBe(1)
    expect(a.y).toBe(1)
    expect(after.edges).toEqual([{ from: 'a', to: 'c' }])

    const inv = inverse(op) as ImportApplyOp
    const restored = applyOp(after, inv)
    // exact restoration
    expect(restored).toEqual(before)

    // label
    const lbl = labelOf(op)
    expect(lbl).toMatch(/Import Apply: \+\d\/\-\d\/Δ\d/)
  })
})
