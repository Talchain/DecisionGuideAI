import { describe, it, expect } from 'vitest'
import { BoardState, type Handle } from '@/sandbox/state/boardState'

function createBoardWithDecisionAndOptions() {
  const s = new BoardState('test-board')
  const d = s.addNode({ type: 'decision', x: 0, y: 0, label: 'D' })
  const o1 = s.addNode({ type: 'option', x: 100, y: 0, label: 'O1' })
  const o2 = s.addNode({ type: 'option', x: 120, y: 40, label: 'O2' })
  return { s, d, o1, o2 }
}

describe('BoardState option-handle aware edge behavior', () => {
  it('deduplicates edges by including source/target handles in the key', () => {
    const { s, d, o1 } = createBoardWithDecisionAndOptions()

    // First edge with stable option handle
    const h1 = `option:${o1.id}` as Handle
    const r1 = s.addEdge({ source: d.id, target: o1.id, sourceHandle: h1 })
    expect(r1.id).toBeTruthy()

    // Duplicate with identical handles -> rejected
    const dup = s.addEdge({ source: d.id, target: o1.id, sourceHandle: h1 })
    expect(dup.error).toMatch(/already exists/i)

    // Different handle on same source/target -> allowed (different key)
    const r2 = s.addEdge({ source: d.id, target: o1.id, sourceHandle: 'right' })
    expect(r2.id).toBeTruthy()

    // Duplicate of the second edge -> rejected
    const dup2 = s.addEdge({ source: d.id, target: o1.id, sourceHandle: 'right' })
    expect(dup2.error).toMatch(/already exists/i)
  })

  it('getDecisionEdgeHandles returns stable option:<optionId> ids for connected options', () => {
    const { s, d, o1, o2 } = createBoardWithDecisionAndOptions()

    s.addEdge({ source: d.id, target: o1.id, sourceHandle: `option:${o1.id}` as Handle })
    s.addEdge({ source: d.id, target: o2.id, sourceHandle: `option:${o2.id}` as Handle })

    const handles = s.getDecisionEdgeHandles(d.id)
    expect(handles.sort()).toEqual([`option:${o1.id}`, `option:${o2.id}`].sort())
  })

  it('persists option handle ids through Yjs snapshot bytes (getUpdate/replaceWithUpdate)', () => {
    const { s, d, o1 } = createBoardWithDecisionAndOptions()
    const h = `option:${o1.id}` as Handle
    s.addEdge({ source: d.id, target: o1.id, sourceHandle: h })

    const bytes = s.getUpdate()

    // New instance should accept and fully restore state
    const s2 = new BoardState('other-board')
    s2.replaceWithUpdate(bytes)

    const b = s2.getBoard()
    expect(b.edges.length).toBe(1)
    expect(b.edges[0].source).toBe(d.id)
    expect(b.edges[0].target).toBe(o1.id)
    expect(b.edges[0].sourceHandle).toBe(h)
  })
})
