import { describe, it, expect } from 'vitest'
import { initialHistory, push, doUndo, doRedo, applyOp, type Op, type SamState } from '../../state/history'

const baseState = (): SamState => ({ nodes: [], edges: [], renames: {} })

describe('undo/redo ring buffer', () => {
  it('push/undo/redo is pure and redo clears after new push', () => {
    let h = initialHistory(baseState(), 3)

    const n1 = { id: 'n1', x: 0, y: 0, label: 'A' }
    const n2 = { id: 'n2', x: 10, y: 10, label: 'B' }

    h = push(h, { type: 'add', payload: { kind: 'node', node: n1 } })
    h = push(h, { type: 'add', payload: { kind: 'node', node: n2 } })

    expect(h.present.nodes.map(n => n.id)).toEqual(['n1', 'n2'])
    const hAfterAdds = h

    const hUndo = doUndo(h)
    expect(hUndo.present.nodes.map(n => n.id)).toEqual(['n1'])
    expect(h.present.nodes.map(n => n.id)).toEqual(['n1', 'n2']) // original unchanged

    const hRedo = doRedo(hUndo)
    expect(hRedo.present.nodes.map(n => n.id)).toEqual(['n1', 'n2'])

    // New push should clear redo
    const hNew = push(hRedo, { type: 'edit', payload: { id: 'n1', from: 'A', to: 'A1' } })
    expect(hNew.redo.length).toBe(0)

    console.log('GATES: PASS — undo/redo unit')
  })

  it('cap at 50 trims oldest, and move undo/redo restores exact coords', () => {
    const cap = 5
    let h = initialHistory(baseState(), cap)

    // push 6 adds to trigger cap trim
    for (let i = 0; i < cap + 1; i++) {
      h = push(h, { type: 'add', payload: { kind: 'node', node: { id: `n${i}`, x: 0, y: 0, label: `N${i}` } } })
    }
    expect(h.undo.length).toBe(cap) // trimmed to cap

    // add node to move
    h = push(h, { type: 'add', payload: { kind: 'node', node: { id: 'nm', x: 5, y: 7, label: 'M' } } })

    // move nm
    h = push(h, { type: 'move', payload: { id: 'nm', from: { x: 5, y: 7 }, to: { x: 42, y: 99 } } })
    expect(h.present.nodes.find(n => n.id === 'nm')!.x).toBe(42)
    expect(h.present.nodes.find(n => n.id === 'nm')!.y).toBe(99)

    // undo move -> exact original
    h = doUndo(h)
    expect(h.present.nodes.find(n => n.id === 'nm')!.x).toBe(5)
    expect(h.present.nodes.find(n => n.id === 'nm')!.y).toBe(7)

    // redo move -> exact target
    h = doRedo(h)
    expect(h.present.nodes.find(n => n.id === 'nm')!.x).toBe(42)
    expect(h.present.nodes.find(n => n.id === 'nm')!.y).toBe(99)

    console.log('GATES: PASS — undo/redo unit')
  })
})
