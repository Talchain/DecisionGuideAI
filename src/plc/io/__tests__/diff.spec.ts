import { describe, it, expect } from 'vitest'
import { diffImport, normalizeImport, type PlcState } from '../diff'

function s(nodes: Array<{id:string,x:number,y:number,label?:string}>, edges: Array<{from:string,to:string,label?:string}> = []): PlcState {
  return { nodes: nodes.map(n => ({ id: n.id, x: n.x, y: n.y, label: n.label })), edges: edges.map(e => ({ from: e.from, to: e.to, label: e.label })) }
}

describe('PLC IO diff', () => {
  it('add-only', () => {
    const cur = s([])
    const inc = s([{ id: 'a', x: 0, y: 0 }], [{ from: 'a', to: 'a' }])
    const d = diffImport(cur, inc)
    expect(d.addNodes.map(n => n.id)).toEqual(['a'])
    expect(d.addEdges).toEqual([{ from: 'a', to: 'a' }])
    expect(d.removeNodes.length).toBe(0)
    expect(d.removeEdges.length).toBe(0)
    expect(d.moves.length).toBe(0)
  })
  it('remove-only', () => {
    const cur = s([{ id: 'a', x: 0, y: 0 }], [{ from: 'a', to: 'a' }])
    const inc = s([])
    const d = diffImport(cur, inc)
    expect(d.removeNodes).toEqual(['a'])
    // removing node a implies removing edge that references it
    expect(d.removeEdges).toEqual([{ from: 'a', to: 'a' }])
    expect(d.addNodes.length).toBe(0)
    expect(d.addEdges.length).toBe(0)
    expect(d.moves.length).toBe(0)
  })
  it('moves-only', () => {
    const cur = s([{ id: 'a', x: 0, y: 0 }])
    const inc = s([{ id: 'a', x: 10, y: 5 }])
    const d = diffImport(cur, inc)
    expect(d.moves).toEqual([{ id: 'a', to: { x: 10, y: 5 } }])
    expect(d.addNodes.length).toBe(0)
    expect(d.removeNodes.length).toBe(0)
  })
  it('mixed add/remove/move and edges', () => {
    const cur = s([{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 5, y: 5 }], [{ from: 'a', to: 'b' }])
    const inc = s([{ id: 'a', x: 1, y: 1 }, { id: 'c', x: 3, y: 3 }], [{ from: 'a', to: 'c' }])
    const d = diffImport(cur, inc)
    expect(d.removeNodes).toEqual(['b'])
    expect(d.addNodes.map(n => n.id)).toEqual(['c'])
    expect(d.moves).toEqual([{ id: 'a', to: { x: 1, y: 1 } }])
    // edge from a->b removed, add a->c
    expect(d.removeEdges).toEqual([{ from: 'a', to: 'b' }])
    expect(d.addEdges).toEqual([{ from: 'a', to: 'c' }])
  })
})
